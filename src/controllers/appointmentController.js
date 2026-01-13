const { Appointment, User } = require('../models');
const { activityService, emailService } = require('../services');
const config = require('../config');
const { asyncHandler, AppError } = require('../middleware');

/**
 * @desc    Create appointment (customer booking)
 * @route   POST /api/appointments
 * @access  Private/Customer
 */
const createAppointment = asyncHandler(async (req, res) => {
  const {
    scheduledDate,
    appointmentType,
    interestedCategory,
    description,
    siteAddress,
    notes,
  } = req.body;

  // Validate scheduled date is within business hours
  const date = new Date(scheduledDate);
  const hour = date.getHours();

  if (hour < config.business.appointmentHours.start || hour >= config.business.appointmentHours.end) {
    throw new AppError(
      `Appointments must be scheduled between ${config.business.appointmentHours.start}:00 and ${config.business.appointmentHours.end}:00`,
      400
    );
  }

  // Attempt auto-assignment for ocular visits to avoid double-booking
  let autoAssignedSalesStaff = null;
  if (appointmentType === 'ocular_visit') {
    const salesStaffList = await User.find({
      role: config.roles.SALES_STAFF,
      isActive: true,
    }).select('_id profile.firstName profile.lastName');

    if (salesStaffList.length > 0) {
      // Find first staff without a conflicting appointment at the same slot
      for (const staff of salesStaffList) {
        const conflict = await Appointment.findOne({
          assignedSalesStaff: staff._id,
          scheduledDate: date,
          status: { $nin: ['cancelled', 'no_show'] },
        }).lean();

        if (!conflict) {
          autoAssignedSalesStaff = staff;
          break;
        }
      }
    }
  }

  const initialStatus = autoAssignedSalesStaff ? 'scheduled' : 'pending';

  // Create appointment
  const appointment = await Appointment.create({
    customer: req.userId,
    scheduledDate: date,
    appointmentType,
    interestedCategory,
    description,
    siteAddress: appointmentType === 'ocular_visit' ? siteAddress : undefined,
    assignedSalesStaff: autoAssignedSalesStaff ? autoAssignedSalesStaff._id : undefined,
    notes: {
      customerNotes: notes,
    },
    status: initialStatus,
    statusHistory: [{
      status: 'pending',
      changedBy: req.userId,
      notes: 'Appointment booked by customer',
    }].concat(autoAssignedSalesStaff ? [{
      status: 'scheduled',
      changedBy: req.userId,
      notes: `Auto-assigned to ${autoAssignedSalesStaff.profile.firstName} ${autoAssignedSalesStaff.profile.lastName}`,
    }] : []),
  });

  // Log activity
  await activityService.logAppointment(
    req.userId,
    req.userRole,
    'appointment_created',
    appointment._id
  );

  res.status(201).json({
    success: true,
    message: 'Appointment booked successfully. Waiting for agent assignment.',
    data: { appointment },
  });
});

/**
 * @desc    Get all appointments
 * @route   GET /api/appointments
 * @access  Private
 */
const getAppointments = asyncHandler(async (req, res) => {
  const { page = 1, limit = 20, status, date, salesStaff } = req.query;
  const skip = (page - 1) * limit;

  const query = {};

  // Role-based filtering
  if (req.userRole === config.roles.CUSTOMER) {
    query.customer = req.userId;
  } else if (req.userRole === config.roles.SALES_STAFF) {
    query.assignedSalesStaff = req.userId;
  }

  if (status) query.status = status;
  if (salesStaff) query.assignedSalesStaff = salesStaff;

  if (date) {
    const startDate = new Date(date);
    startDate.setHours(0, 0, 0, 0);
    const endDate = new Date(date);
    endDate.setHours(23, 59, 59, 999);
    query.scheduledDate = { $gte: startDate, $lte: endDate };
  }

  const [appointments, total] = await Promise.all([
    Appointment.find(query)
      .populate('customer', 'email profile.firstName profile.lastName profile.phone')
      .populate('assignedSalesStaff', 'email profile.firstName profile.lastName')
      .sort({ scheduledDate: 1 })
      .skip(skip)
      .limit(parseInt(limit)),
    Appointment.countDocuments(query),
  ]);

  res.json({
    success: true,
    data: {
      appointments,
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
 * @desc    Get appointment by ID
 * @route   GET /api/appointments/:id
 * @access  Private
 */
const getAppointment = asyncHandler(async (req, res) => {
  const appointment = await Appointment.findById(req.params.id)
    .populate('customer', 'email profile.firstName profile.lastName profile.phone profile.address')
    .populate('assignedSalesStaff', 'email profile.firstName profile.lastName profile.phone')
    .populate('statusHistory.changedBy', 'profile.firstName profile.lastName');

  if (!appointment) {
    throw new AppError('Appointment not found', 404);
  }

  // Check access
  if (req.userRole === config.roles.CUSTOMER && 
      appointment.customer._id.toString() !== req.userId.toString()) {
    throw new AppError('Access denied', 403);
  }

  res.json({
    success: true,
    data: { appointment },
  });
});

/**
 * @desc    Assign sales staff to appointment (agent only)
 * @route   PUT /api/appointments/:id/assign
 * @access  Private/Appointment Agent
 */
const assignSalesStaff = asyncHandler(async (req, res) => {
  const { salesStaffId, agentNotes } = req.body;

  const appointment = await Appointment.findById(req.params.id)
    .populate('customer', 'email profile.firstName profile.lastName');

  if (!appointment) {
    throw new AppError('Appointment not found', 404);
  }

  if (appointment.status !== 'pending') {
    throw new AppError('Appointment has already been assigned', 400);
  }

  // Verify sales staff exists and has correct role
  const salesStaff = await User.findOne({
    _id: salesStaffId,
    role: config.roles.SALES_STAFF,
    isActive: true,
  });

  if (!salesStaff) {
    throw new AppError('Sales staff not found', 404);
  }

  // Check for conflicts
  const conflictingAppointment = await Appointment.findOne({
    assignedSalesStaff: salesStaffId,
    scheduledDate: appointment.scheduledDate,
    status: { $nin: ['cancelled', 'no_show'] },
    _id: { $ne: appointment._id },
  });

  if (conflictingAppointment) {
    throw new AppError('Sales staff already has an appointment at this time', 400);
  }

  // Assign
  appointment.assignedSalesStaff = salesStaffId;
  appointment.status = 'scheduled';
  appointment.notes.agentNotes = agentNotes;
  appointment.statusHistory.push({
    status: 'scheduled',
    changedBy: req.userId,
    notes: `Assigned to ${salesStaff.profile.firstName} ${salesStaff.profile.lastName}`,
  });

  await appointment.save();

  // Send confirmation email to customer
  await emailService.sendAppointmentConfirmation(
    appointment.customer.email,
    appointment,
    `${appointment.customer.profile.firstName} ${appointment.customer.profile.lastName}`
  );

  // Log activity
  await activityService.logAppointment(
    req.userId,
    req.userRole,
    'appointment_scheduled',
    appointment._id,
    `Assigned to ${salesStaff.profile.firstName} ${salesStaff.profile.lastName}`
  );

  res.json({
    success: true,
    message: 'Sales staff assigned successfully',
    data: { appointment },
  });
});

/**
 * @desc    Get available slots for a date
 * @route   GET /api/appointments/slots
 * @access  Private
 */
const getAvailableSlots = asyncHandler(async (req, res) => {
  const { date, salesStaffId } = req.query;

  if (!date) {
    throw new AppError('Date is required', 400);
  }

  const targetDate = new Date(date);
  
  // If no specific sales staff, get all sales staff availability
  if (!salesStaffId) {
    const salesStaffList = await User.find({
      role: config.roles.SALES_STAFF,
      isActive: true,
    }).select('_id profile.firstName profile.lastName');

    const availability = await Promise.all(
      salesStaffList.map(async (staff) => {
        const slots = await Appointment.findAvailableSlots(targetDate, staff._id);
        return {
          salesStaff: {
            id: staff._id,
            name: `${staff.profile.firstName} ${staff.profile.lastName}`,
          },
          slots,
        };
      })
    );

    return res.json({
      success: true,
      data: { availability },
    });
  }

  // Get specific sales staff availability
  const slots = await Appointment.findAvailableSlots(targetDate, salesStaffId);

  res.json({
    success: true,
    data: { slots },
  });
});

/**
 * @desc    Cancel appointment
 * @route   PUT /api/appointments/:id/cancel
 * @access  Private
 */
const cancelAppointment = asyncHandler(async (req, res) => {
  const { reason, message } = req.body;

  const appointment = await Appointment.findById(req.params.id)
    .populate('customer', 'email profile.firstName profile.lastName email')
    .populate('assignedSalesStaff', 'profile.firstName profile.lastName');

  if (!appointment) {
    throw new AppError('Appointment not found', 404);
  }

  // Check access for customers (agents/admins already authorized via route)
  if (req.userRole === config.roles.CUSTOMER && 
      appointment.customer._id.toString() !== req.userId.toString()) {
    throw new AppError('Access denied', 403);
  }

  if (['cancelled', 'completed', 'no_show'].includes(appointment.status)) {
    throw new AppError('Appointment cannot be cancelled once completed or marked as no-show', 400);
  }

  const now = new Date();
  const cutoffTime = new Date(appointment.scheduledDate);
  cutoffTime.setHours(cutoffTime.getHours() - config.business.cancellationCutoffHours);
  const isWithinPolicy = now < cutoffTime;

  const cancellationReason = reason?.trim() || 'Appointment cancelled';
  const customerMessage = (message || '').trim() || 'Your appointment has been cancelled. Please book a new time that works for you.';
  const customerName = `${appointment.customer.profile.firstName} ${appointment.customer.profile.lastName}`.trim();

  appointment.status = 'cancelled';
  appointment.cancellation = {
    cancelledBy: req.userId,
    cancelledAt: now,
    reason: cancellationReason,
    isWithinPolicy,
  };
  appointment.statusHistory.push({
    status: 'cancelled',
    changedBy: req.userId,
    notes: cancellationReason,
  });

  await appointment.save();

  // Notify customer the appointment is cancelled but keep history intact
  await emailService.sendAppointmentCancellation(
    appointment.customer.email,
    {
      scheduledDate: appointment.scheduledDate,
      appointmentType: appointment.appointmentType,
      reason: cancellationReason,
      message: customerMessage,
    },
    customerName
  );

  await activityService.logAppointment(
    req.userId,
    req.userRole,
    'appointment_cancelled',
    appointment._id,
    `${cancellationReason}${isWithinPolicy ? '' : ' (within 24h window)'}`
  );

  res.json({
    success: true,
    message: isWithinPolicy
      ? 'Appointment cancelled successfully'
      : 'Appointment cancelled. Note: Cancellation was made less than 24 hours before the scheduled time.',
    data: { appointment },
  });
});

/**
 * @desc    Complete appointment (sales staff)
 * @route   PUT /api/appointments/:id/complete
 * @access  Private/Sales Staff
 */
const completeAppointment = asyncHandler(async (req, res) => {
  const { salesNotes } = req.body;

  const appointment = await Appointment.findById(req.params.id);

  if (!appointment) {
    throw new AppError('Appointment not found', 404);
  }

  if (appointment.assignedSalesStaff.toString() !== req.userId.toString()) {
    throw new AppError('You are not assigned to this appointment', 403);
  }

  if (appointment.status !== 'scheduled' && appointment.status !== 'confirmed' && appointment.status !== 'in_progress') {
    throw new AppError('Appointment cannot be completed', 400);
  }

  appointment.status = 'completed';
  appointment.notes.salesNotes = salesNotes;
  appointment.statusHistory.push({
    status: 'completed',
    changedBy: req.userId,
    notes: 'Consultation completed',
  });

  await appointment.save();

  // Log activity
  await activityService.logAppointment(
    req.userId,
    req.userRole,
    'appointment_completed',
    appointment._id
  );

  res.json({
    success: true,
    message: 'Appointment completed successfully',
    data: { appointment },
  });
});

/**
 * @desc    Mark no show
 * @route   PUT /api/appointments/:id/no-show
 * @access  Private/Staff
 */
const markNoShow = asyncHandler(async (req, res) => {
  const appointment = await Appointment.findById(req.params.id);

  if (!appointment) {
    throw new AppError('Appointment not found', 404);
  }

  appointment.status = 'no_show';
  appointment.statusHistory.push({
    status: 'no_show',
    changedBy: req.userId,
    notes: 'Customer did not show up',
  });

  await appointment.save();

  // Log activity
  await activityService.logAppointment(
    req.userId,
    req.userRole,
    'appointment_no_show',
    appointment._id
  );

  res.json({
    success: true,
    message: 'Appointment marked as no-show',
    data: { appointment },
  });
});

/**
 * @desc    Set travel fee for ocular visit (cashier/admin)
 * @route   PUT /api/appointments/:id/travel-fee
 * @access  Private/Cashier, Admin
 */
const setTravelFee = asyncHandler(async (req, res) => {
  const { amount, notes, isRequired = true } = req.body;

  const appointment = await Appointment.findById(req.params.id);
  if (!appointment) {
    throw new AppError('Appointment not found', 404);
  }

  if (appointment.appointmentType !== 'ocular_visit') {
    throw new AppError('Travel fee only applies to ocular visits', 400);
  }

  appointment.travelFee = {
    isRequired,
    amount: isRequired ? amount : 0,
    status: isRequired ? 'pending' : 'not_required',
    notes,
  };

  appointment.statusHistory.push({
    status: appointment.status,
    changedBy: req.userId,
    notes: isRequired ? `Travel fee set: ₱${amount}` : 'Travel fee marked not required',
  });

  await appointment.save();

  res.json({
    success: true,
    message: 'Travel fee updated',
    data: { travelFee: appointment.travelFee },
  });
});

/**
 * @desc    Record travel fee collected on-site (sales staff)
 * @route   PUT /api/appointments/:id/travel-fee/collect
 * @access  Private/Sales Staff
 */
const collectTravelFee = asyncHandler(async (req, res) => {
  const { collectedAmount, notes } = req.body;

  const appointment = await Appointment.findById(req.params.id);
  if (!appointment) {
    throw new AppError('Appointment not found', 404);
  }

  if (appointment.appointmentType !== 'ocular_visit') {
    throw new AppError('Travel fee only applies to ocular visits', 400);
  }

  if (!appointment.travelFee?.isRequired || appointment.travelFee.status === 'not_required') {
    throw new AppError('Travel fee is not required for this appointment', 400);
  }

  if (appointment.travelFee.status !== 'pending') {
    throw new AppError('Travel fee is not pending collection', 400);
  }

  appointment.travelFee.status = 'collected';
  appointment.travelFee.collectedBy = req.userId;
  appointment.travelFee.collectedAt = new Date();
  appointment.travelFee.amount = collectedAmount;
  appointment.travelFee.notes = notes;

  appointment.statusHistory.push({
    status: appointment.status,
    changedBy: req.userId,
    notes: `Travel fee collected: ₱${collectedAmount}`,
  });

  await appointment.save();

  res.json({
    success: true,
    message: 'Travel fee marked as collected',
    data: { travelFee: appointment.travelFee },
  });
});

/**
 * @desc    Verify collected travel fee (cashier)
 * @route   PUT /api/appointments/:id/travel-fee/verify
 * @access  Private/Cashier
 */
const verifyTravelFee = asyncHandler(async (req, res) => {
  const { notes } = req.body;

  const appointment = await Appointment.findById(req.params.id);
  if (!appointment) {
    throw new AppError('Appointment not found', 404);
  }

  if (!appointment.travelFee?.isRequired || appointment.travelFee.status === 'not_required') {
    throw new AppError('Travel fee is not required for this appointment', 400);
  }

  if (appointment.travelFee.status !== 'collected') {
    throw new AppError('Travel fee is not pending verification', 400);
  }

  appointment.travelFee.status = 'verified';
  appointment.travelFee.verifiedBy = req.userId;
  appointment.travelFee.verifiedAt = new Date();
  appointment.travelFee.notes = notes;

  appointment.statusHistory.push({
    status: appointment.status,
    changedBy: req.userId,
    notes: 'Travel fee verified',
  });

  await appointment.save();

  res.json({
    success: true,
    message: 'Travel fee verified',
    data: { travelFee: appointment.travelFee },
  });
});

/**
 * @desc    Get calendar view for appointment agent
 * @route   GET /api/appointments/calendar
 * @access  Private/Appointment Agent, Admin
 */
const getCalendarView = asyncHandler(async (req, res) => {
  const { startDate, endDate } = req.query;

  if (!startDate || !endDate) {
    throw new AppError('Start date and end date are required', 400);
  }

  const appointments = await Appointment.find({
    scheduledDate: {
      $gte: new Date(startDate),
      $lte: new Date(endDate),
    },
    status: { $nin: ['cancelled', 'no_show'] },
  })
    .populate('customer', 'profile.firstName profile.lastName')
    .populate('assignedSalesStaff', 'profile.firstName profile.lastName')
    .sort({ scheduledDate: 1 });

  // Group by date for calendar view
  const calendar = {};
  appointments.forEach((apt) => {
    const dateKey = apt.scheduledDate.toISOString().split('T')[0];
    if (!calendar[dateKey]) {
      calendar[dateKey] = [];
    }
    calendar[dateKey].push({
      id: apt._id,
      time: apt.scheduledDate.toTimeString().slice(0, 5),
      customer: apt.customer 
        ? `${apt.customer.profile.firstName} ${apt.customer.profile.lastName}` 
        : 'Unknown',
      salesStaff: apt.assignedSalesStaff 
        ? `${apt.assignedSalesStaff.profile.firstName} ${apt.assignedSalesStaff.profile.lastName}` 
        : 'Unassigned',
      type: apt.appointmentType,
      status: apt.status,
      category: apt.interestedCategory,
    });
  });

  res.json({
    success: true,
    data: { calendar },
  });
});

module.exports = {
  createAppointment,
  getAppointments,
  getAppointment,
  assignSalesStaff,
  getAvailableSlots,
  cancelAppointment,
  completeAppointment,
  markNoShow,
  setTravelFee,
  collectTravelFee,
  verifyTravelFee,
  getCalendarView,
};
