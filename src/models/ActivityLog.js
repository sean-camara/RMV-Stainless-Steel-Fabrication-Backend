const mongoose = require('mongoose');

const activityLogSchema = new mongoose.Schema(
  {
    // User who performed the action
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    // User's role at time of action
    userRole: {
      type: String,
      required: true,
    },
    // Action type
    action: {
      type: String,
      enum: [
        // Auth actions
        'login',
        'logout',
        'login_failed',
        'password_reset_request',
        'password_reset_complete',
        'email_verified',
        
        // User actions
        'user_created',
        'user_updated',
        'user_deactivated',
        'user_reactivated',
        'user_deleted',
        
        // Appointment actions
        'appointment_created',
        'appointment_scheduled',
        'appointment_confirmed',
        'appointment_cancelled',
        'appointment_completed',
        'appointment_no_show',
        
        // Project actions
        'project_created',
        'project_updated',
        'project_status_changed',
        'project_assigned',
        'project_cancelled',
        
        // Blueprint actions
        'blueprint_uploaded',
        'blueprint_revised',
        'costing_uploaded',
        'costing_revised',
        
        // Customer approval actions
        'approval_requested',
        'revision_requested',
        'project_approved',
        
        // Payment actions
        'payment_proof_uploaded',
        'payment_verified',
        'payment_rejected',
        'receipt_generated',
        'qr_code_uploaded',
        
        // Fabrication actions
        'fabrication_started',
        'fabrication_progress_updated',
        'fabrication_photo_uploaded',
        'fabrication_completed',
        
        // Installation actions
        'installation_scheduled',
        'installation_started',
        'installation_completed',
        
        // System actions
        'system_config_changed',
        'data_exported',
        'report_generated',
      ],
      required: true,
    },
    // Resource type
    resourceType: {
      type: String,
      enum: ['user', 'appointment', 'project', 'payment', 'system'],
    },
    // Resource ID
    resourceId: {
      type: mongoose.Schema.Types.ObjectId,
    },
    // Description
    description: {
      type: String,
      required: true,
    },
    // Changes made (for update actions)
    changes: {
      before: mongoose.Schema.Types.Mixed,
      after: mongoose.Schema.Types.Mixed,
    },
    // Additional metadata
    metadata: {
      ipAddress: String,
      userAgent: String,
      additionalInfo: mongoose.Schema.Types.Mixed,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes for efficient querying
activityLogSchema.index({ userId: 1 });
activityLogSchema.index({ action: 1 });
activityLogSchema.index({ resourceType: 1, resourceId: 1 });
activityLogSchema.index({ createdAt: -1 });
activityLogSchema.index({ userRole: 1 });

// TTL index - keep logs for 1 year (365 days)
activityLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: 365 * 24 * 60 * 60 });

// Static method to log activity
activityLogSchema.statics.log = async function (data) {
  try {
    return await this.create({
      userId: data.userId,
      userRole: data.userRole,
      action: data.action,
      resourceType: data.resourceType,
      resourceId: data.resourceId,
      description: data.description,
      changes: data.changes,
      metadata: data.metadata,
    });
  } catch (error) {
    console.error('Failed to log activity:', error);
    // Don't throw - logging should not break main functionality
  }
};

const ActivityLog = mongoose.model('ActivityLog', activityLogSchema);

module.exports = ActivityLog;
