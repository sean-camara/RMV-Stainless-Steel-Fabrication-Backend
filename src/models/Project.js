const mongoose = require('mongoose');
const config = require('../config');

const projectSchema = new mongoose.Schema(
  {
    // Unique project identifier
    projectNumber: {
      type: String,
      unique: true,
      required: true,
    },
    // Customer who owns the project
    customer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Customer is required'],
    },
    // Source appointment (if any)
    sourceAppointment: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Appointment',
    },
    // Project category
    category: {
      type: String,
      enum: config.business.projectCategories,
      required: [true, 'Project category is required'],
    },
    // Project title/name
    title: {
      type: String,
      required: [true, 'Project title is required'],
      maxlength: [200, 'Title cannot exceed 200 characters'],
    },
    // Detailed description
    description: {
      type: String,
      maxlength: [2000, 'Description cannot exceed 2000 characters'],
    },
    // Project specifications
    specifications: {
      material: {
        type: String,
        enum: ['304_grade', '316_grade', 'other'],
        default: '304_grade',
      },
      dimensions: {
        width: Number,    // in cm
        height: Number,   // in cm
        depth: Number,    // in cm
        unit: {
          type: String,
          default: 'cm',
        },
      },
      color: String,
      finish: {
        type: String,
        enum: ['brushed', 'polished', 'matte', 'mirror', 'other'],
      },
      additionalSpecs: String,
    },
    // Site/delivery address
    siteAddress: {
      street: String,
      barangay: String,
      city: String,
      province: String,
      zipCode: String,
      landmark: String,
    },
    // Project status
    status: {
      type: String,
      enum: [
        'draft',                    // Sales staff creating project
        'pending_blueprint',        // Waiting for engineer
        'blueprint_submitted',      // Engineer submitted blueprint
        'pending_customer_approval',// Waiting for customer approval
        'revision_requested',       // Customer requested changes
        'approved',                 // Customer approved
        'pending_initial_payment',  // Waiting for 30% payment
        'initial_payment_verified', // Cashier verified 30%
        'in_fabrication',           // Being fabricated
        'pending_midpoint_payment', // Waiting for 40% payment
        'midpoint_payment_verified',// Cashier verified 40%
        'ready_for_installation',   // Fabrication complete
        'in_installation',          // Being installed
        'pending_final_payment',    // Waiting for final 30%
        'completed',                // Fully paid and done
        'cancelled',                // Project cancelled
        'on_hold',                  // Temporarily paused
      ],
      default: 'draft',
    },
    // Assigned staff
    assignedStaff: {
      salesStaff: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
      engineer: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
      fabricationStaff: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      }],
    },
    // Consultation data (from sales)
    consultation: {
      conductedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
      conductedAt: Date,
      notes: String,
      measurements: [{
        label: String,
        value: Number,
        unit: String,
      }],
      photos: [{
        filename: String,
        originalName: String,
        path: String,
        uploadedAt: {
          type: Date,
          default: Date.now,
        },
      }],
    },
    // Blueprint data (from engineer)
    blueprint: {
      currentVersion: {
        type: Number,
        default: 0,
      },
      versions: [{
        version: Number,
        filename: String,
        originalName: String,
        path: String,
        uploadedBy: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User',
        },
        uploadedAt: {
          type: Date,
          default: Date.now,
        },
        notes: String,
      }],
    },
    // Costing data (from engineer)
    costing: {
      currentVersion: {
        type: Number,
        default: 0,
      },
      versions: [{
        version: Number,
        filename: String,
        originalName: String,
        path: String,
        uploadedBy: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User',
        },
        uploadedAt: {
          type: Date,
          default: Date.now,
        },
        totalAmount: Number,
        breakdown: [{
          item: String,
          quantity: Number,
          unitPrice: Number,
          total: Number,
        }],
        notes: String,
      }],
      // Final approved costing
      approvedAmount: Number,
    },
    // Customer approval
    customerApproval: {
      isApproved: {
        type: Boolean,
        default: false,
      },
      approvedAt: Date,
      approvedVersion: {
        blueprint: Number,
        costing: Number,
      },
      signature: String, // Base64 or file path
    },
    // Revision tracking
    revisions: [{
      requestedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
      requestedAt: {
        type: Date,
        default: Date.now,
      },
      type: {
        type: String,
        enum: ['minor', 'major'],
        default: 'minor',
      },
      description: String,
      resolvedAt: Date,
      resolvedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
    }],
    // Payment stages (30-40-30 default)
    paymentStages: {
      initial: {
        percentage: {
          type: Number,
          default: config.business.paymentStages.initial,
        },
        amount: Number,
      },
      midpoint: {
        percentage: {
          type: Number,
          default: config.business.paymentStages.midpoint,
        },
        amount: Number,
      },
      final: {
        percentage: {
          type: Number,
          default: config.business.paymentStages.final,
        },
        amount: Number,
      },
    },
    // Fabrication tracking
    fabrication: {
      startedAt: Date,
      completedAt: Date,
      progress: {
        type: Number,
        min: 0,
        max: 100,
        default: 0,
      },
      photos: [{
        filename: String,
        originalName: String,
        path: String,
        caption: String,
        uploadedBy: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User',
        },
        uploadedAt: {
          type: Date,
          default: Date.now,
        },
      }],
      notes: [{
        content: String,
        createdBy: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User',
        },
        createdAt: {
          type: Date,
          default: Date.now,
        },
      }],
    },
    // Installation tracking
    installation: {
      scheduledDate: Date,
      startedAt: Date,
      completedAt: Date,
      notes: String,
      photos: [{
        filename: String,
        originalName: String,
        path: String,
        caption: String,
        uploadedBy: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User',
        },
        uploadedAt: {
          type: Date,
          default: Date.now,
        },
      }],
    },
    // Timeline tracking
    timeline: {
      estimatedCompletion: Date,
      actualCompletion: Date,
    },
    // Status history for audit
    statusHistory: [{
      status: String,
      changedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
      changedAt: {
        type: Date,
        default: Date.now,
      },
      notes: String,
    }],
    // Soft delete
    isDeleted: {
      type: Boolean,
      default: false,
    },
    deletedAt: Date,
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Indexes
projectSchema.index({ projectNumber: 1 });
projectSchema.index({ customer: 1 });
projectSchema.index({ status: 1 });
projectSchema.index({ category: 1 });
projectSchema.index({ 'assignedStaff.engineer': 1 });
projectSchema.index({ 'assignedStaff.fabricationStaff': 1 });
projectSchema.index({ isDeleted: 1 });
projectSchema.index({ createdAt: -1 });

// Virtual for total paid amount
projectSchema.virtual('totalPaidAmount').get(function () {
  // This would be calculated from payments
  return 0; // Placeholder - actual calculation done via aggregation
});

// Pre-save: Generate project number
projectSchema.pre('save', async function (next) {
  if (this.isNew && !this.projectNumber) {
    const year = new Date().getFullYear();
    const count = await mongoose.model('Project').countDocuments({
      createdAt: {
        $gte: new Date(year, 0, 1),
        $lt: new Date(year + 1, 0, 1),
      },
    });
    this.projectNumber = `RMV-${year}-${String(count + 1).padStart(4, '0')}`;
  }
  next();
});

// Pre-save: Calculate payment stage amounts
projectSchema.pre('save', function (next) {
  if (this.costing?.approvedAmount) {
    const total = this.costing.approvedAmount;
    this.paymentStages.initial.amount = Math.round((total * this.paymentStages.initial.percentage) / 100);
    this.paymentStages.midpoint.amount = Math.round((total * this.paymentStages.midpoint.percentage) / 100);
    this.paymentStages.final.amount = total - this.paymentStages.initial.amount - this.paymentStages.midpoint.amount;
  }
  next();
});

// Soft delete middleware
projectSchema.pre(/^find/, function (next) {
  if (this.getOptions().includeDeleted !== true) {
    this.where({ isDeleted: { $ne: true } });
  }
  next();
});

const Project = mongoose.model('Project', projectSchema);

module.exports = Project;
