const { Project, Appointment, Payment, User } = require('../models');
const { activityService, emailService } = require('../services');
const config = require('../config');
const { asyncHandler, AppError } = require('../middleware');

/**
 * @desc    Create project (from sales consultation)
 * @route   POST /api/projects
 * @access  Private/Sales Staff
 */
const createProject = asyncHandler(async (req, res) => {
  const {
    customerId,
    appointmentId,
    category,
    title,
    description,
    specifications,
    siteAddress,
  } = req.body;

  // Verify customer exists
  const customer = await User.findOne({
    _id: customerId,
    role: config.roles.CUSTOMER,
  });

  if (!customer) {
    throw new AppError('Customer not found', 404);
  }

  // Create project
  const project = await Project.create({
    customer: customerId,
    sourceAppointment: appointmentId,
    category,
    title,
    description,
    specifications,
    siteAddress,
    assignedStaff: {
      salesStaff: req.userId,
    },
    status: 'draft',
    statusHistory: [{
      status: 'draft',
      changedBy: req.userId,
      notes: 'Project created from consultation',
    }],
  });

  // Link appointment to project if provided
  if (appointmentId) {
    await Appointment.findByIdAndUpdate(appointmentId, {
      convertedToProject: project._id,
    });
  }

  // Log activity
  await activityService.logProject(
    req.userId,
    req.userRole,
    'project_created',
    project._id
  );

  res.status(201).json({
    success: true,
    message: 'Project created successfully',
    data: { project },
  });
});

/**
 * @desc    Get all projects
 * @route   GET /api/projects
 * @access  Private
 */
const getProjects = asyncHandler(async (req, res) => {
  const { page = 1, limit = 20, status, category, customer } = req.query;
  const skip = (page - 1) * limit;

  const query = {};

  // Role-based filtering
  if (req.userRole === config.roles.CUSTOMER) {
    query.customer = req.userId;
  } else if (req.userRole === config.roles.ENGINEER) {
    query['assignedStaff.engineer'] = req.userId;
  } else if (req.userRole === config.roles.FABRICATION_STAFF) {
    query['assignedStaff.fabricationStaff'] = req.userId;
  } else if (req.userRole === config.roles.SALES_STAFF) {
    query['assignedStaff.salesStaff'] = req.userId;
  }

  if (status) query.status = status;
  if (category) query.category = category;
  if (customer) query.customer = customer;

  const [projects, total] = await Promise.all([
    Project.find(query)
      .populate('customer', 'email profile.firstName profile.lastName')
      .populate('assignedStaff.salesStaff', 'profile.firstName profile.lastName')
      .populate('assignedStaff.engineer', 'profile.firstName profile.lastName')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit)),
    Project.countDocuments(query),
  ]);

  res.json({
    success: true,
    data: {
      projects,
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
 * @desc    Get project by ID
 * @route   GET /api/projects/:id
 * @access  Private
 */
const getProject = asyncHandler(async (req, res) => {
  const project = await Project.findById(req.params.id)
    .populate('customer', 'email profile.firstName profile.lastName profile.phone profile.address')
    .populate('sourceAppointment')
    .populate('assignedStaff.salesStaff', 'profile.firstName profile.lastName email')
    .populate('assignedStaff.engineer', 'profile.firstName profile.lastName email')
    .populate('assignedStaff.fabricationStaff', 'profile.firstName profile.lastName')
    .populate('statusHistory.changedBy', 'profile.firstName profile.lastName')
    .populate('revisions.requestedBy', 'profile.firstName profile.lastName')
    .populate('revisions.resolvedBy', 'profile.firstName profile.lastName');

  if (!project) {
    throw new AppError('Project not found', 404);
  }

  // Check access for customers
  if (req.userRole === config.roles.CUSTOMER && 
      project.customer._id.toString() !== req.userId.toString()) {
    throw new AppError('Access denied', 403);
  }

  // Get associated payments
  const payments = await Payment.find({ project: project._id })
    .sort({ stage: 1 });

  res.json({
    success: true,
    data: { 
      project,
      payments,
    },
  });
});

/**
 * @desc    Update project consultation data (sales staff)
 * @route   PUT /api/projects/:id/consultation
 * @access  Private/Sales Staff
 */
const updateConsultation = asyncHandler(async (req, res) => {
  const { notes, measurements } = req.body;

  const project = await Project.findById(req.params.id);

  if (!project) {
    throw new AppError('Project not found', 404);
  }

  project.consultation = {
    ...project.consultation,
    conductedBy: req.userId,
    conductedAt: new Date(),
    notes,
    measurements,
  };

  await project.save();

  // Log activity
  await activityService.logProject(
    req.userId,
    req.userRole,
    'project_updated',
    project._id,
    'Consultation data updated'
  );

  res.json({
    success: true,
    message: 'Consultation data updated',
    data: { project },
  });
});

/**
 * @desc    Upload consultation photos
 * @route   POST /api/projects/:id/consultation/photos
 * @access  Private/Sales Staff
 */
const uploadConsultationPhotos = asyncHandler(async (req, res) => {
  const project = await Project.findById(req.params.id);

  if (!project) {
    throw new AppError('Project not found', 404);
  }

  if (!req.files || req.files.length === 0) {
    throw new AppError('No files uploaded', 400);
  }

  const photos = req.files.map((file) => ({
    filename: file.filename,
    originalName: file.originalname,
    path: file.path,
    uploadedAt: new Date(),
  }));

  project.consultation.photos = [...(project.consultation.photos || []), ...photos];
  await project.save();

  res.json({
    success: true,
    message: 'Photos uploaded successfully',
    data: { photos: project.consultation.photos },
  });
});

/**
 * @desc    Submit project to engineer
 * @route   PUT /api/projects/:id/submit-to-engineer
 * @access  Private/Sales Staff
 */
const submitToEngineer = asyncHandler(async (req, res) => {
  const { engineerId } = req.body;

  const project = await Project.findById(req.params.id)
    .populate('customer', 'email profile.firstName profile.lastName');

  if (!project) {
    throw new AppError('Project not found', 404);
  }

  if (project.status !== 'draft') {
    throw new AppError('Project has already been submitted', 400);
  }

  // Verify engineer
  const engineer = await User.findOne({
    _id: engineerId,
    role: config.roles.ENGINEER,
    isActive: true,
  });

  if (!engineer) {
    throw new AppError('Engineer not found', 404);
  }

  project.assignedStaff.engineer = engineerId;
  project.status = 'pending_blueprint';
  project.statusHistory.push({
    status: 'pending_blueprint',
    changedBy: req.userId,
    notes: `Submitted to engineer: ${engineer.profile.firstName} ${engineer.profile.lastName}`,
  });

  await project.save();

  // Log activity
  await activityService.logProject(
    req.userId,
    req.userRole,
    'project_assigned',
    project._id,
    `Assigned to engineer: ${engineer.profile.firstName} ${engineer.profile.lastName}`
  );

  res.json({
    success: true,
    message: 'Project submitted to engineer',
    data: { project },
  });
});

/**
 * @desc    Upload blueprint (engineer)
 * @route   POST /api/projects/:id/blueprint
 * @access  Private/Engineer
 */
const uploadBlueprint = asyncHandler(async (req, res) => {
  const { notes } = req.body;

  const project = await Project.findById(req.params.id);

  if (!project) {
    throw new AppError('Project not found', 404);
  }

  if (!req.file) {
    throw new AppError('No file uploaded', 400);
  }

  const newVersion = (project.blueprint.currentVersion || 0) + 1;

  project.blueprint.versions.push({
    version: newVersion,
    filename: req.file.filename,
    originalName: req.file.originalname,
    path: req.file.path,
    uploadedBy: req.userId,
    uploadedAt: new Date(),
    notes,
  });
  project.blueprint.currentVersion = newVersion;

  // Log activity
  const action = newVersion === 1 ? 'blueprint_uploaded' : 'blueprint_revised';
  await activityService.logProject(
    req.userId,
    req.userRole,
    action,
    project._id,
    `Blueprint v${newVersion} uploaded`
  );

  await project.save();

  res.json({
    success: true,
    message: 'Blueprint uploaded successfully',
    data: { 
      version: newVersion,
      blueprint: project.blueprint,
    },
  });
});

/**
 * @desc    Upload costing (engineer)
 * @route   POST /api/projects/:id/costing
 * @access  Private/Engineer
 */
const uploadCosting = asyncHandler(async (req, res) => {
  const { totalAmount, breakdown, notes } = req.body;

  const project = await Project.findById(req.params.id);

  if (!project) {
    throw new AppError('Project not found', 404);
  }

  if (!req.file) {
    throw new AppError('No file uploaded', 400);
  }

  const newVersion = (project.costing.currentVersion || 0) + 1;

  project.costing.versions.push({
    version: newVersion,
    filename: req.file.filename,
    originalName: req.file.originalname,
    path: req.file.path,
    uploadedBy: req.userId,
    uploadedAt: new Date(),
    totalAmount,
    breakdown: breakdown ? JSON.parse(breakdown) : [],
    notes,
  });
  project.costing.currentVersion = newVersion;

  // Log activity
  const action = newVersion === 1 ? 'costing_uploaded' : 'costing_revised';
  await activityService.logProject(
    req.userId,
    req.userRole,
    action,
    project._id,
    `Costing v${newVersion} uploaded - ₱${totalAmount}`
  );

  await project.save();

  res.json({
    success: true,
    message: 'Costing uploaded successfully',
    data: { 
      version: newVersion,
      costing: project.costing,
    },
  });
});

/**
 * @desc    Submit for customer approval (engineer)
 * @route   PUT /api/projects/:id/submit-for-approval
 * @access  Private/Engineer
 */
const submitForApproval = asyncHandler(async (req, res) => {
  const project = await Project.findById(req.params.id)
    .populate('customer', 'email profile.firstName profile.lastName');

  if (!project) {
    throw new AppError('Project not found', 404);
  }

  if (!project.blueprint.currentVersion || !project.costing.currentVersion) {
    throw new AppError('Blueprint and costing must be uploaded first', 400);
  }

  project.status = 'pending_customer_approval';
  project.statusHistory.push({
    status: 'pending_customer_approval',
    changedBy: req.userId,
    notes: 'Submitted for customer approval',
  });

  await project.save();

  // Send email to customer
  await emailService.sendBlueprintReady(
    project.customer.email,
    project,
    `${project.customer.profile.firstName} ${project.customer.profile.lastName}`
  );

  // Log activity
  await activityService.logProject(
    req.userId,
    req.userRole,
    'approval_requested',
    project._id
  );

  res.json({
    success: true,
    message: 'Project submitted for customer approval',
    data: { project },
  });
});

/**
 * @desc    Customer approve project
 * @route   PUT /api/projects/:id/approve
 * @access  Private/Customer
 */
const approveProject = asyncHandler(async (req, res) => {
  const project = await Project.findById(req.params.id);

  if (!project) {
    throw new AppError('Project not found', 404);
  }

  if (project.customer.toString() !== req.userId.toString()) {
    throw new AppError('Access denied', 403);
  }

  if (project.status !== 'pending_customer_approval') {
    throw new AppError('Project is not pending approval', 400);
  }

  // Get latest costing for approved amount
  const latestCosting = project.costing.versions[project.costing.versions.length - 1];
  
  project.customerApproval = {
    isApproved: true,
    approvedAt: new Date(),
    approvedVersion: {
      blueprint: project.blueprint.currentVersion,
      costing: project.costing.currentVersion,
    },
  };
  project.costing.approvedAmount = latestCosting.totalAmount;
  project.status = 'approved';
  project.statusHistory.push({
    status: 'approved',
    changedBy: req.userId,
    notes: 'Approved by customer',
  });

  await project.save();

  // Create payment records for all stages
  await Payment.create([
    {
      project: project._id,
      customer: project.customer,
      stage: 'initial',
      amount: {
        expected: project.paymentStages.initial.amount,
      },
      status: 'pending',
    },
    {
      project: project._id,
      customer: project.customer,
      stage: 'midpoint',
      amount: {
        expected: project.paymentStages.midpoint.amount,
      },
      status: 'pending',
    },
    {
      project: project._id,
      customer: project.customer,
      stage: 'final',
      amount: {
        expected: project.paymentStages.final.amount,
      },
      status: 'pending',
    },
  ]);

  // Update project status to pending initial payment
  project.status = 'pending_initial_payment';
  project.statusHistory.push({
    status: 'pending_initial_payment',
    changedBy: req.userId,
    notes: 'Waiting for initial 30% payment',
  });
  await project.save();

  // Log activity
  await activityService.logProject(
    req.userId,
    req.userRole,
    'project_approved',
    project._id
  );

  res.json({
    success: true,
    message: 'Project approved successfully. Please proceed with the initial payment.',
    data: { project },
  });
});

/**
 * @desc    Customer request revision
 * @route   PUT /api/projects/:id/request-revision
 * @access  Private/Customer
 */
const requestRevision = asyncHandler(async (req, res) => {
  const { description, type = 'minor' } = req.body;

  const project = await Project.findById(req.params.id);

  if (!project) {
    throw new AppError('Project not found', 404);
  }

  if (project.customer.toString() !== req.userId.toString()) {
    throw new AppError('Access denied', 403);
  }

  if (project.status !== 'pending_customer_approval') {
    throw new AppError('Project is not pending approval', 400);
  }

  project.revisions.push({
    requestedBy: req.userId,
    requestedAt: new Date(),
    type,
    description,
  });

  project.status = 'revision_requested';
  project.statusHistory.push({
    status: 'revision_requested',
    changedBy: req.userId,
    notes: description,
  });

  await project.save();

  // Log activity
  await activityService.logProject(
    req.userId,
    req.userRole,
    'revision_requested',
    project._id,
    `${type} revision: ${description}`
  );

  res.json({
    success: true,
    message: 'Revision request submitted',
    data: { project },
  });
});

/**
 * @desc    Update project status
 * @route   PUT /api/projects/:id/status
 * @access  Private/Staff
 */
const updateProjectStatus = asyncHandler(async (req, res) => {
  const { status, notes } = req.body;

  const project = await Project.findById(req.params.id)
    .populate('customer', 'email profile.firstName profile.lastName');

  if (!project) {
    throw new AppError('Project not found', 404);
  }

  const previousStatus = project.status;
  project.status = status;
  project.statusHistory.push({
    status,
    changedBy: req.userId,
    notes,
  });

  // Handle specific status transitions
  if (status === 'in_fabrication' && previousStatus !== 'in_fabrication') {
    project.fabrication.startedAt = new Date();
  }
  if (status === 'ready_for_installation') {
    project.fabrication.completedAt = new Date();
    project.fabrication.progress = 100;
  }
  if (status === 'in_installation' && !project.installation.startedAt) {
    project.installation.startedAt = new Date();
  }
  if (status === 'completed') {
    project.installation.completedAt = new Date();
    project.timeline.actualCompletion = new Date();
  }

  await project.save();

  // Send email notification for major status changes
  const notifyStatuses = ['approved', 'in_fabrication', 'ready_for_installation', 'in_installation', 'completed'];
  if (notifyStatuses.includes(status)) {
    await emailService.sendProjectStatusUpdate(
      project.customer.email,
      project,
      `${project.customer.profile.firstName} ${project.customer.profile.lastName}`,
      status
    );
  }

  // Log activity
  await activityService.logProject(
    req.userId,
    req.userRole,
    'project_status_changed',
    project._id,
    `Status changed from ${previousStatus} to ${status}`
  );

  res.json({
    success: true,
    message: 'Project status updated',
    data: { project },
  });
});

/**
 * @desc    Assign fabrication staff
 * @route   PUT /api/projects/:id/assign-fabrication
 * @access  Private/Admin
 */
const assignFabricationStaff = asyncHandler(async (req, res) => {
  const { staffIds } = req.body;

  const project = await Project.findById(req.params.id);

  if (!project) {
    throw new AppError('Project not found', 404);
  }

  // Verify all staff members
  const staff = await User.find({
    _id: { $in: staffIds },
    role: config.roles.FABRICATION_STAFF,
    isActive: true,
  });

  if (staff.length !== staffIds.length) {
    throw new AppError('One or more staff members not found', 404);
  }

  project.assignedStaff.fabricationStaff = staffIds;
  await project.save();

  // Log activity
  await activityService.logProject(
    req.userId,
    req.userRole,
    'project_assigned',
    project._id,
    `Assigned to fabrication staff`
  );

  res.json({
    success: true,
    message: 'Fabrication staff assigned',
    data: { project },
  });
});

/**
 * @desc    Update fabrication progress
 * @route   PUT /api/projects/:id/fabrication/progress
 * @access  Private/Fabrication Staff
 */
const updateFabricationProgress = asyncHandler(async (req, res) => {
  const { progress, notes } = req.body;

  const project = await Project.findById(req.params.id);

  if (!project) {
    throw new AppError('Project not found', 404);
  }

  project.fabrication.progress = progress;
  if (notes) {
    project.fabrication.notes.push({
      content: notes,
      createdBy: req.userId,
      createdAt: new Date(),
    });
  }

  await project.save();

  // Log activity
  await activityService.logProject(
    req.userId,
    req.userRole,
    'fabrication_progress_updated',
    project._id,
    `Progress updated to ${progress}%`
  );

  res.json({
    success: true,
    message: 'Fabrication progress updated',
    data: { 
      progress: project.fabrication.progress,
      fabrication: project.fabrication,
    },
  });
});

/**
 * @desc    Upload fabrication photo
 * @route   POST /api/projects/:id/fabrication/photo
 * @access  Private/Fabrication Staff
 */
const uploadFabricationPhoto = asyncHandler(async (req, res) => {
  const { caption } = req.body;

  const project = await Project.findById(req.params.id);

  if (!project) {
    throw new AppError('Project not found', 404);
  }

  if (!req.file) {
    throw new AppError('No file uploaded', 400);
  }

  project.fabrication.photos.push({
    filename: req.file.filename,
    originalName: req.file.originalname,
    path: req.file.path,
    caption,
    uploadedBy: req.userId,
    uploadedAt: new Date(),
  });

  await project.save();

  // Log activity
  await activityService.logProject(
    req.userId,
    req.userRole,
    'fabrication_photo_uploaded',
    project._id
  );

  res.json({
    success: true,
    message: 'Photo uploaded successfully',
    data: { photos: project.fabrication.photos },
  });
});

/**
 * @desc    Get projects pending for engineer
 * @route   GET /api/projects/pending/engineer
 * @access  Private/Engineer
 */
const getPendingForEngineer = asyncHandler(async (req, res) => {
  const projects = await Project.find({
    $or: [
      { status: 'pending_blueprint', 'assignedStaff.engineer': req.userId },
      { status: 'revision_requested', 'assignedStaff.engineer': req.userId },
    ],
  })
    .populate('customer', 'profile.firstName profile.lastName')
    .sort({ createdAt: 1 });

  res.json({
    success: true,
    data: { projects },
  });
});

/**
 * @desc    Get projects for fabrication
 * @route   GET /api/projects/fabrication
 * @access  Private/Fabrication Staff
 */
const getFabricationProjects = asyncHandler(async (req, res) => {
  const projects = await Project.find({
    'assignedStaff.fabricationStaff': req.userId,
    status: { $in: ['in_fabrication', 'pending_midpoint_payment', 'midpoint_payment_verified'] },
  })
    .populate('customer', 'profile.firstName profile.lastName')
    .sort({ 'fabrication.startedAt': 1 });

  res.json({
    success: true,
    data: { projects },
  });
});

module.exports = {
  createProject,
  getProjects,
  getProject,
  updateConsultation,
  uploadConsultationPhotos,
  submitToEngineer,
  uploadBlueprint,
  uploadCosting,
  submitForApproval,
  approveProject,
  requestRevision,
  updateProjectStatus,
  assignFabricationStaff,
  updateFabricationProgress,
  uploadFabricationPhoto,
  getPendingForEngineer,
  getFabricationProjects,
};
