const { ActivityLog } = require('../models');

class ActivityService {
  /**
   * Log an activity
   */
  async log(data) {
    try {
      return await ActivityLog.log(data);
    } catch (error) {
      console.error('Activity log failed:', error);
    }
  }

  /**
   * Log authentication activity
   */
  async logAuth(userId, userRole, action, metadata = {}) {
    return this.log({
      userId,
      userRole,
      action,
      resourceType: 'user',
      resourceId: userId,
      description: this.getAuthDescription(action),
      metadata,
    });
  }

  /**
   * Log user management activity
   */
  async logUserAction(actorId, actorRole, action, targetUserId, changes = null, metadata = {}) {
    return this.log({
      userId: actorId,
      userRole: actorRole,
      action,
      resourceType: 'user',
      resourceId: targetUserId,
      description: this.getUserActionDescription(action),
      changes,
      metadata,
    });
  }

  /**
   * Log appointment activity
   */
  async logAppointment(userId, userRole, action, appointmentId, description = null, metadata = {}) {
    return this.log({
      userId,
      userRole,
      action,
      resourceType: 'appointment',
      resourceId: appointmentId,
      description: description || this.getAppointmentDescription(action),
      metadata,
    });
  }

  /**
   * Log project activity
   */
  async logProject(userId, userRole, action, projectId, description = null, changes = null, metadata = {}) {
    return this.log({
      userId,
      userRole,
      action,
      resourceType: 'project',
      resourceId: projectId,
      description: description || this.getProjectDescription(action),
      changes,
      metadata,
    });
  }

  /**
   * Log payment activity
   */
  async logPayment(userId, userRole, action, paymentId, description = null, metadata = {}) {
    return this.log({
      userId,
      userRole,
      action,
      resourceType: 'payment',
      resourceId: paymentId,
      description: description || this.getPaymentDescription(action),
      metadata,
    });
  }

  /**
   * Get user's activity history
   */
  async getUserActivity(userId, options = {}) {
    const { page = 1, limit = 20, action } = options;
    const skip = (page - 1) * limit;

    const query = { userId };
    if (action) query.action = action;

    const [logs, total] = await Promise.all([
      ActivityLog.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      ActivityLog.countDocuments(query),
    ]);

    return {
      logs,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get resource activity history
   */
  async getResourceActivity(resourceType, resourceId, options = {}) {
    const { page = 1, limit = 20 } = options;
    const skip = (page - 1) * limit;

    const query = { resourceType, resourceId };

    const [logs, total] = await Promise.all([
      ActivityLog.find(query)
        .populate('userId', 'profile.firstName profile.lastName email')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      ActivityLog.countDocuments(query),
    ]);

    return {
      logs,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get all activity for admin dashboard
   */
  async getAllActivity(options = {}) {
    const { page = 1, limit = 50, action, resourceType, userId, startDate, endDate } = options;
    const skip = (page - 1) * limit;

    const query = {};
    if (action) query.action = action;
    if (resourceType) query.resourceType = resourceType;
    if (userId) query.userId = userId;
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate);
    }

    const [logs, total] = await Promise.all([
      ActivityLog.find(query)
        .populate('userId', 'profile.firstName profile.lastName email role')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      ActivityLog.countDocuments(query),
    ]);

    return {
      logs,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    };
  }

  // Description helpers
  getAuthDescription(action) {
    const descriptions = {
      login: 'User logged in',
      logout: 'User logged out',
      login_failed: 'Failed login attempt',
      password_reset_request: 'Password reset requested',
      password_reset_complete: 'Password reset completed',
      email_verified: 'Email verified',
    };
    return descriptions[action] || action;
  }

  getUserActionDescription(action) {
    const descriptions = {
      user_created: 'User account created',
      user_updated: 'User profile updated',
      user_deactivated: 'User account deactivated',
      user_reactivated: 'User account reactivated',
      user_deleted: 'User account deleted',
    };
    return descriptions[action] || action;
  }

  getAppointmentDescription(action) {
    const descriptions = {
      appointment_created: 'Appointment booked',
      appointment_scheduled: 'Appointment scheduled',
      appointment_confirmed: 'Appointment confirmed',
      appointment_cancelled: 'Appointment cancelled',
      appointment_completed: 'Appointment completed',
      appointment_no_show: 'Customer did not show up',
    };
    return descriptions[action] || action;
  }

  getProjectDescription(action) {
    const descriptions = {
      project_created: 'Project created',
      project_updated: 'Project details updated',
      project_status_changed: 'Project status changed',
      project_assigned: 'Project assigned to staff',
      project_cancelled: 'Project cancelled',
      blueprint_uploaded: 'Blueprint uploaded',
      blueprint_revised: 'Blueprint revised',
      costing_uploaded: 'Costing uploaded',
      costing_revised: 'Costing revised',
      approval_requested: 'Approval requested from customer',
      revision_requested: 'Revision requested by customer',
      project_approved: 'Project approved by customer',
      fabrication_started: 'Fabrication started',
      fabrication_progress_updated: 'Fabrication progress updated',
      fabrication_photo_uploaded: 'Fabrication photo uploaded',
      fabrication_completed: 'Fabrication completed',
      installation_scheduled: 'Installation scheduled',
      installation_started: 'Installation started',
      installation_completed: 'Installation completed',
    };
    return descriptions[action] || action;
  }

  getPaymentDescription(action) {
    const descriptions = {
      payment_proof_uploaded: 'Payment proof uploaded',
      payment_verified: 'Payment verified',
      payment_rejected: 'Payment rejected',
      receipt_generated: 'Receipt generated',
      qr_code_uploaded: 'QR code uploaded',
    };
    return descriptions[action] || action;
  }
}

module.exports = new ActivityService();
