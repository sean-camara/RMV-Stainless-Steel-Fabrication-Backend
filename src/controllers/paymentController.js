const { Payment, Project, User } = require('../models');
const { activityService, emailService } = require('../services');
const config = require('../config');
const { asyncHandler, AppError } = require('../middleware');

/**
 * @desc    Get payments for a project
 * @route   GET /api/payments/project/:projectId
 * @access  Private
 */
const getProjectPayments = asyncHandler(async (req, res) => {
  const { projectId } = req.params;

  const project = await Project.findById(projectId);
  if (!project) {
    throw new AppError('Project not found', 404);
  }

  // Check access for customers
  if (req.userRole === config.roles.CUSTOMER && 
      project.customer.toString() !== req.userId.toString()) {
    throw new AppError('Access denied', 403);
  }

  const payments = await Payment.find({ project: projectId })
    .populate('verification.verifiedBy', 'profile.firstName profile.lastName')
    .populate('qrCode.uploadedBy', 'profile.firstName profile.lastName')
    .sort({ stage: 1 });

  res.json({
    success: true,
    data: { payments },
  });
});

/**
 * @desc    Get payment by ID
 * @route   GET /api/payments/:id
 * @access  Private
 */
const getPayment = asyncHandler(async (req, res) => {
  const payment = await Payment.findById(req.params.id)
    .populate('project', 'projectNumber title category')
    .populate('customer', 'email profile.firstName profile.lastName')
    .populate('verification.verifiedBy', 'profile.firstName profile.lastName')
    .populate('qrCode.uploadedBy', 'profile.firstName profile.lastName');

  if (!payment) {
    throw new AppError('Payment not found', 404);
  }

  // Check access for customers
  if (req.userRole === config.roles.CUSTOMER && 
      payment.customer._id.toString() !== req.userId.toString()) {
    throw new AppError('Access denied', 403);
  }

  res.json({
    success: true,
    data: { payment },
  });
});

/**
 * @desc    Upload QR code for payment stage (cashier)
 * @route   POST /api/payments/:id/qrcode
 * @access  Private/Cashier
 */
const uploadQRCode = asyncHandler(async (req, res) => {
  const payment = await Payment.findById(req.params.id);

  if (!payment) {
    throw new AppError('Payment not found', 404);
  }

  if (!req.file) {
    throw new AppError('No file uploaded', 400);
  }

  payment.qrCode = {
    filename: req.file.filename,
    originalName: req.file.originalname,
    path: req.file.path,
    uploadedBy: req.userId,
    uploadedAt: new Date(),
  };

  await payment.save();

  // Log activity
  await activityService.logPayment(
    req.userId,
    req.userRole,
    'qr_code_uploaded',
    payment._id
  );

  res.json({
    success: true,
    message: 'QR code uploaded successfully',
    data: { payment },
  });
});

/**
 * @desc    Submit payment proof (customer)
 * @route   POST /api/payments/:id/proof
 * @access  Private/Customer
 */
const submitPaymentProof = asyncHandler(async (req, res) => {
  const { paymentMethod } = req.body;

  const payment = await Payment.findById(req.params.id)
    .populate('project', 'projectNumber');

  if (!payment) {
    throw new AppError('Payment not found', 404);
  }

  if (payment.customer.toString() !== req.userId.toString()) {
    throw new AppError('Access denied', 403);
  }

  if (payment.status === 'verified') {
    throw new AppError('Payment has already been verified', 400);
  }

  if (!req.file) {
    throw new AppError('No file uploaded', 400);
  }

  payment.paymentProof = {
    filename: req.file.filename,
    originalName: req.file.originalname,
    path: req.file.path,
    uploadedAt: new Date(),
  };
  payment.paymentMethod = paymentMethod;
  payment.status = 'submitted';
  payment.statusHistory.push({
    status: 'submitted',
    changedBy: req.userId,
    notes: `Payment proof submitted via ${paymentMethod}`,
  });

  await payment.save();

  // Log activity
  await activityService.logPayment(
    req.userId,
    req.userRole,
    'payment_proof_uploaded',
    payment._id,
    `Payment proof for ${payment.project.projectNumber}`
  );

  res.json({
    success: true,
    message: 'Payment proof submitted successfully. Waiting for verification.',
    data: { payment },
  });
});

/**
 * @desc    Verify payment (cashier)
 * @route   PUT /api/payments/:id/verify
 * @access  Private/Cashier
 */
const verifyPayment = asyncHandler(async (req, res) => {
  const { amountReceived, referenceNumber, notes } = req.body;

  const payment = await Payment.findById(req.params.id)
    .populate('project')
    .populate('customer', 'email profile.firstName profile.lastName');

  if (!payment) {
    throw new AppError('Payment not found', 404);
  }

  if (payment.status !== 'submitted') {
    throw new AppError('Payment is not pending verification', 400);
  }

  payment.amount.received = amountReceived;
  payment.status = 'verified';
  payment.verification = {
    verifiedBy: req.userId,
    verifiedAt: new Date(),
    notes,
    referenceNumber,
  };
  payment.statusHistory.push({
    status: 'verified',
    changedBy: req.userId,
    notes: `Verified - Amount: ₱${amountReceived}`,
  });

  // Generate receipt
  const receiptNumber = await Payment.generateReceiptNumber();
  payment.receipt = {
    receiptNumber,
    generatedAt: new Date(),
  };

  await payment.save();

  // Update project status based on payment stage
  const project = await Project.findById(payment.project._id);
  const stageStatusMap = {
    initial: 'initial_payment_verified',
    midpoint: 'midpoint_payment_verified',
    final: 'completed',
  };

  // Only update if current status matches expected
  const expectedStatuses = {
    initial: 'pending_initial_payment',
    midpoint: 'pending_midpoint_payment',
    final: 'pending_final_payment',
  };

  if (project.status === expectedStatuses[payment.stage]) {
    project.status = stageStatusMap[payment.stage];
    project.statusHistory.push({
      status: project.status,
      changedBy: req.userId,
      notes: `${payment.stage} payment verified`,
    });

    // For initial payment, move to fabrication
    if (payment.stage === 'initial') {
      project.status = 'in_fabrication';
      project.fabrication.startedAt = new Date();
      project.statusHistory.push({
        status: 'in_fabrication',
        changedBy: req.userId,
        notes: 'Fabrication started after initial payment',
      });
    }

    await project.save();
  }

  // Send email to customer
  await emailService.sendPaymentVerification(
    payment.customer.email,
    payment,
    project,
    `${payment.customer.profile.firstName} ${payment.customer.profile.lastName}`
  );

  // Log activity
  await activityService.logPayment(
    req.userId,
    req.userRole,
    'payment_verified',
    payment._id,
    `Verified ₱${amountReceived} for ${project.projectNumber}`
  );

  res.json({
    success: true,
    message: 'Payment verified successfully',
    data: { 
      payment,
      receipt: payment.receipt,
    },
  });
});

/**
 * @desc    Reject payment (cashier)
 * @route   PUT /api/payments/:id/reject
 * @access  Private/Cashier
 */
const rejectPayment = asyncHandler(async (req, res) => {
  const { reason } = req.body;

  const payment = await Payment.findById(req.params.id)
    .populate('project', 'projectNumber');

  if (!payment) {
    throw new AppError('Payment not found', 404);
  }

  if (payment.status !== 'submitted') {
    throw new AppError('Payment is not pending verification', 400);
  }

  payment.status = 'rejected';
  payment.rejection = {
    rejectedBy: req.userId,
    rejectedAt: new Date(),
    reason,
  };
  payment.statusHistory.push({
    status: 'rejected',
    changedBy: req.userId,
    notes: reason,
  });

  await payment.save();

  // Log activity
  await activityService.logPayment(
    req.userId,
    req.userRole,
    'payment_rejected',
    payment._id,
    reason
  );

  res.json({
    success: true,
    message: 'Payment rejected',
    data: { payment },
  });
});

/**
 * @desc    Get pending payments for cashier
 * @route   GET /api/payments/pending
 * @access  Private/Cashier
 */
const getPendingPayments = asyncHandler(async (req, res) => {
  const payments = await Payment.find({ status: 'submitted' })
    .populate('project', 'projectNumber title category')
    .populate('customer', 'email profile.firstName profile.lastName profile.phone')
    .sort({ 'paymentProof.uploadedAt': 1 });

  res.json({
    success: true,
    data: { payments },
  });
});

/**
 * @desc    Get all payments (for reports)
 * @route   GET /api/payments
 * @access  Private/Admin, Cashier
 */
const getAllPayments = asyncHandler(async (req, res) => {
  const { page = 1, limit = 20, status, stage, startDate, endDate } = req.query;
  const skip = (page - 1) * limit;

  const query = {};
  if (status) query.status = status;
  if (stage) query.stage = stage;
  if (startDate || endDate) {
    query.createdAt = {};
    if (startDate) query.createdAt.$gte = new Date(startDate);
    if (endDate) query.createdAt.$lte = new Date(endDate);
  }

  const [payments, total] = await Promise.all([
    Payment.find(query)
      .populate('project', 'projectNumber title')
      .populate('customer', 'email profile.firstName profile.lastName')
      .populate('verification.verifiedBy', 'profile.firstName profile.lastName')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit)),
    Payment.countDocuments(query),
  ]);

  res.json({
    success: true,
    data: {
      payments,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit),
      },
    },
  });
});

/**
 * @desc    Get payment summary/stats
 * @route   GET /api/payments/summary
 * @access  Private/Admin, Cashier
 */
const getPaymentSummary = asyncHandler(async (req, res) => {
  const { startDate, endDate } = req.query;

  const dateFilter = {};
  if (startDate || endDate) {
    dateFilter.createdAt = {};
    if (startDate) dateFilter.createdAt.$gte = new Date(startDate);
    if (endDate) dateFilter.createdAt.$lte = new Date(endDate);
  }

  const [
    totalReceived,
    pendingVerification,
    byStage,
    byMethod,
  ] = await Promise.all([
    // Total received amount
    Payment.aggregate([
      { $match: { status: 'verified', ...dateFilter } },
      { $group: { _id: null, total: { $sum: '$amount.received' } } },
    ]),
    // Pending verification count
    Payment.countDocuments({ status: 'submitted' }),
    // By stage
    Payment.aggregate([
      { $match: { status: 'verified', ...dateFilter } },
      { $group: { _id: '$stage', total: { $sum: '$amount.received' }, count: { $sum: 1 } } },
    ]),
    // By payment method
    Payment.aggregate([
      { $match: { status: 'verified', ...dateFilter } },
      { $group: { _id: '$paymentMethod', total: { $sum: '$amount.received' }, count: { $sum: 1 } } },
    ]),
  ]);

  res.json({
    success: true,
    data: {
      totalReceived: totalReceived[0]?.total || 0,
      pendingVerification,
      byStage: byStage.reduce((acc, curr) => {
        acc[curr._id] = { total: curr.total, count: curr.count };
        return acc;
      }, {}),
      byMethod: byMethod.reduce((acc, curr) => {
        acc[curr._id || 'unknown'] = { total: curr.total, count: curr.count };
        return acc;
      }, {}),
    },
  });
});

/**
 * @desc    Customer get their payments
 * @route   GET /api/payments/my-payments
 * @access  Private/Customer
 */
const getMyPayments = asyncHandler(async (req, res) => {
  const payments = await Payment.find({ customer: req.userId })
    .populate('project', 'projectNumber title category status')
    .sort({ createdAt: -1 });

  res.json({
    success: true,
    data: { payments },
  });
});

module.exports = {
  getProjectPayments,
  getPayment,
  uploadQRCode,
  submitPaymentProof,
  verifyPayment,
  rejectPayment,
  getPendingPayments,
  getAllPayments,
  getPaymentSummary,
  getMyPayments,
};
