const { User, Project, Appointment, Payment, ActivityLog } = require('../models');
const { activityService } = require('../services');
const config = require('../config');
const { asyncHandler, AppError } = require('../middleware');

/**
 * @desc    Get admin dashboard overview
 * @route   GET /api/admin/dashboard
 * @access  Private/Admin
 */
const getDashboard = asyncHandler(async (req, res) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const thisMonth = new Date(today.getFullYear(), today.getMonth(), 1);

  const [
    userStats,
    projectStats,
    appointmentStats,
    paymentStats,
    recentActivity,
  ] = await Promise.all([
    // User statistics
    User.aggregate([
      { $match: { isDeleted: { $ne: true } } },
      { $group: { _id: '$role', count: { $sum: 1 } } },
    ]),
    
    // Project statistics
    Promise.all([
      Project.countDocuments({ isDeleted: { $ne: true } }),
      Project.countDocuments({ status: 'in_fabrication' }),
      Project.countDocuments({ status: 'completed' }),
      Project.countDocuments({ createdAt: { $gte: thisMonth } }),
    ]),
    
    // Appointment statistics
    Promise.all([
      Appointment.countDocuments({ scheduledDate: { $gte: today }, status: 'pending' }),
      Appointment.countDocuments({ scheduledDate: { $gte: today }, status: 'scheduled' }),
      Appointment.countDocuments({ 
        scheduledDate: { $gte: today, $lt: new Date(today.getTime() + 24 * 60 * 60 * 1000) }
      }),
    ]),
    
    // Payment statistics
    Promise.all([
      Payment.aggregate([
        { $match: { status: 'verified' } },
        { $group: { _id: null, total: { $sum: '$amount.received' } } },
      ]),
      Payment.aggregate([
        { $match: { status: 'verified', 'verification.verifiedAt': { $gte: thisMonth } } },
        { $group: { _id: null, total: { $sum: '$amount.received' } } },
      ]),
      Payment.countDocuments({ status: 'submitted' }),
    ]),
    
    // Recent activity
    ActivityLog.find()
      .populate('userId', 'profile.firstName profile.lastName role')
      .sort({ createdAt: -1 })
      .limit(10),
  ]);

  res.json({
    success: true,
    data: {
      users: {
        byRole: userStats.reduce((acc, curr) => {
          acc[curr._id] = curr.count;
          return acc;
        }, {}),
        total: userStats.reduce((sum, curr) => sum + curr.count, 0),
      },
      projects: {
        total: projectStats[0],
        inFabrication: projectStats[1],
        completed: projectStats[2],
        thisMonth: projectStats[3],
      },
      appointments: {
        pending: appointmentStats[0],
        scheduled: appointmentStats[1],
        today: appointmentStats[2],
      },
      payments: {
        totalReceived: paymentStats[0][0]?.total || 0,
        thisMonth: paymentStats[1][0]?.total || 0,
        pendingVerification: paymentStats[2],
      },
      recentActivity,
    },
  });
});

/**
 * @desc    Get activity logs
 * @route   GET /api/admin/activity-logs
 * @access  Private/Admin
 */
const getActivityLogs = asyncHandler(async (req, res) => {
  const { page = 1, limit = 50, action, resourceType, userId, startDate, endDate } = req.query;

  const result = await activityService.getAllActivity({
    page: parseInt(page),
    limit: parseInt(limit),
    action,
    resourceType,
    userId,
    startDate,
    endDate,
  });

  res.json({
    success: true,
    data: result,
  });
});

/**
 * @desc    Get system reports
 * @route   GET /api/admin/reports
 * @access  Private/Admin
 */
const getReports = asyncHandler(async (req, res) => {
  const { type, startDate, endDate } = req.query;

  const dateFilter = {};
  if (startDate) dateFilter.$gte = new Date(startDate);
  if (endDate) dateFilter.$lte = new Date(endDate);
  const hasDateFilter = Object.keys(dateFilter).length > 0;

  let report = {};

  switch (type) {
    case 'revenue':
      report = await generateRevenueReport(hasDateFilter ? { createdAt: dateFilter } : {});
      break;
    case 'projects':
      report = await generateProjectReport(hasDateFilter ? { createdAt: dateFilter } : {});
      break;
    case 'appointments':
      report = await generateAppointmentReport(hasDateFilter ? { scheduledDate: dateFilter } : {});
      break;
    default:
      // Overview report
      report = {
        revenue: await generateRevenueReport(hasDateFilter ? { createdAt: dateFilter } : {}),
        projects: await generateProjectReport(hasDateFilter ? { createdAt: dateFilter } : {}),
        appointments: await generateAppointmentReport(hasDateFilter ? { scheduledDate: dateFilter } : {}),
      };
  }

  res.json({
    success: true,
    data: { report },
  });
});

async function generateRevenueReport(filter) {
  const [byMonth, byCategory, byStage] = await Promise.all([
    Payment.aggregate([
      { $match: { status: 'verified', ...filter } },
      {
        $group: {
          _id: {
            year: { $year: '$verification.verifiedAt' },
            month: { $month: '$verification.verifiedAt' },
          },
          total: { $sum: '$amount.received' },
          count: { $sum: 1 },
        },
      },
      { $sort: { '_id.year': -1, '_id.month': -1 } },
      { $limit: 12 },
    ]),
    Payment.aggregate([
      { $match: { status: 'verified', ...filter } },
      {
        $lookup: {
          from: 'projects',
          localField: 'project',
          foreignField: '_id',
          as: 'projectData',
        },
      },
      { $unwind: '$projectData' },
      {
        $group: {
          _id: '$projectData.category',
          total: { $sum: '$amount.received' },
          count: { $sum: 1 },
        },
      },
    ]),
    Payment.aggregate([
      { $match: { status: 'verified', ...filter } },
      {
        $group: {
          _id: '$stage',
          total: { $sum: '$amount.received' },
          count: { $sum: 1 },
        },
      },
    ]),
  ]);

  return { byMonth, byCategory, byStage };
}

async function generateProjectReport(filter) {
  const [byStatus, byCategory, completionTime] = await Promise.all([
    Project.aggregate([
      { $match: { isDeleted: { $ne: true }, ...filter } },
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]),
    Project.aggregate([
      { $match: { isDeleted: { $ne: true }, ...filter } },
      { $group: { _id: '$category', count: { $sum: 1 } } },
    ]),
    Project.aggregate([
      { 
        $match: { 
          status: 'completed', 
          'timeline.actualCompletion': { $exists: true },
          ...filter,
        },
      },
      {
        $project: {
          daysToComplete: {
            $divide: [
              { $subtract: ['$timeline.actualCompletion', '$createdAt'] },
              1000 * 60 * 60 * 24,
            ],
          },
        },
      },
      {
        $group: {
          _id: null,
          avgDays: { $avg: '$daysToComplete' },
          minDays: { $min: '$daysToComplete' },
          maxDays: { $max: '$daysToComplete' },
        },
      },
    ]),
  ]);

  return { byStatus, byCategory, completionTime: completionTime[0] || null };
}

async function generateAppointmentReport(filter) {
  const [byStatus, byType, byCategory] = await Promise.all([
    Appointment.aggregate([
      { $match: { isDeleted: { $ne: true }, ...filter } },
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]),
    Appointment.aggregate([
      { $match: { isDeleted: { $ne: true }, ...filter } },
      { $group: { _id: '$appointmentType', count: { $sum: 1 } } },
    ]),
    Appointment.aggregate([
      { $match: { isDeleted: { $ne: true }, interestedCategory: { $exists: true }, ...filter } },
      { $group: { _id: '$interestedCategory', count: { $sum: 1 } } },
    ]),
  ]);

  return { byStatus, byType, byCategory };
}

/**
 * @desc    Get all projects for admin overview
 * @route   GET /api/admin/projects
 * @access  Private/Admin
 */
const getAllProjects = asyncHandler(async (req, res) => {
  const { page = 1, limit = 20, status, category } = req.query;
  const skip = (page - 1) * limit;

  const query = {};
  if (status) query.status = status;
  if (category) query.category = category;

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
 * @desc    Update payment stages for a project (admin override)
 * @route   PUT /api/admin/projects/:id/payment-stages
 * @access  Private/Admin
 */
const updatePaymentStages = asyncHandler(async (req, res) => {
  const { initial, midpoint, final } = req.body;

  // Validate percentages sum to 100
  if (initial + midpoint + final !== 100) {
    throw new AppError('Payment stage percentages must sum to 100', 400);
  }

  const project = await Project.findById(req.params.id);

  if (!project) {
    throw new AppError('Project not found', 404);
  }

  project.paymentStages.initial.percentage = initial;
  project.paymentStages.midpoint.percentage = midpoint;
  project.paymentStages.final.percentage = final;

  // Recalculate amounts if approved amount exists
  if (project.costing.approvedAmount) {
    const total = project.costing.approvedAmount;
    project.paymentStages.initial.amount = Math.round((total * initial) / 100);
    project.paymentStages.midpoint.amount = Math.round((total * midpoint) / 100);
    project.paymentStages.final.amount = total - project.paymentStages.initial.amount - project.paymentStages.midpoint.amount;
  }

  await project.save();

  // Update payment records if they exist
  await Payment.updateOne(
    { project: project._id, stage: 'initial' },
    { 'amount.expected': project.paymentStages.initial.amount }
  );
  await Payment.updateOne(
    { project: project._id, stage: 'midpoint' },
    { 'amount.expected': project.paymentStages.midpoint.amount }
  );
  await Payment.updateOne(
    { project: project._id, stage: 'final' },
    { 'amount.expected': project.paymentStages.final.amount }
  );

  // Log activity
  await activityService.logProject(
    req.userId,
    req.userRole,
    'project_updated',
    project._id,
    `Payment stages updated: ${initial}%-${midpoint}%-${final}%`
  );

  res.json({
    success: true,
    message: 'Payment stages updated',
    data: { paymentStages: project.paymentStages },
  });
});

module.exports = {
  getDashboard,
  getActivityLogs,
  getReports,
  getAllProjects,
  updatePaymentStages,
};
