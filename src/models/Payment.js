const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema(
  {
    // Associated project
    project: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Project',
      required: [true, 'Project is required'],
    },
    // Customer (denormalized for easier queries)
    customer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Customer is required'],
    },
    // Payment stage
    stage: {
      type: String,
      enum: ['initial', 'midpoint', 'final'],
      required: [true, 'Payment stage is required'],
    },
    // Amount details
    amount: {
      expected: {
        type: Number,
        required: [true, 'Expected amount is required'],
      },
      received: Number,
    },
    // Payment method
    paymentMethod: {
      type: String,
      enum: ['gcash', 'bank_transfer', 'cash', 'other'],
    },
    // Payment proof uploaded by customer
    paymentProof: {
      filename: String,
      originalName: String,
      path: String,
      uploadedAt: Date,
    },
    // QR Code for this payment (uploaded by cashier)
    qrCode: {
      filename: String,
      originalName: String,
      path: String,
      uploadedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
      uploadedAt: Date,
    },
    // Payment status
    status: {
      type: String,
      enum: [
        'pending',      // Waiting for payment
        'submitted',    // Customer submitted proof
        'verified',     // Cashier verified
        'rejected',     // Payment proof rejected
      ],
      default: 'pending',
    },
    // Verification details
    verification: {
      verifiedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
      verifiedAt: Date,
      notes: String,
      referenceNumber: String, // Bank/GCash reference
    },
    // Rejection details
    rejection: {
      rejectedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
      rejectedAt: Date,
      reason: String,
    },
    // Receipt (generated after verification)
    receipt: {
      receiptNumber: String,
      generatedAt: Date,
      filename: String,
      path: String,
    },
    // Due date
    dueDate: Date,
    // Status history
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
paymentSchema.index({ project: 1, stage: 1 }, { unique: true });
paymentSchema.index({ customer: 1 });
paymentSchema.index({ status: 1 });
paymentSchema.index({ isDeleted: 1 });

// Compound index for common query patterns
paymentSchema.index({ project: 1, stage: 1, status: 1 });

// Virtual for payment completion percentage
paymentSchema.virtual('completionPercentage').get(function () {
  if (!this.amount.expected || !this.amount.received) return 0;
  return Math.min(100, Math.round((this.amount.received / this.amount.expected) * 100));
});

// Static: Generate receipt number
paymentSchema.statics.generateReceiptNumber = async function () {
  const year = new Date().getFullYear();
  const month = String(new Date().getMonth() + 1).padStart(2, '0');
  const count = await this.countDocuments({
    'receipt.receiptNumber': { $exists: true },
    createdAt: {
      $gte: new Date(year, 0, 1),
      $lt: new Date(year + 1, 0, 1),
    },
  });
  return `RMV-RCT-${year}${month}-${String(count + 1).padStart(4, '0')}`;
};

// Soft delete middleware
paymentSchema.pre(/^find/, function (next) {
  if (this.getOptions().includeDeleted !== true) {
    this.where({ isDeleted: { $ne: true } });
  }
  next();
});

const Payment = mongoose.model('Payment', paymentSchema);

module.exports = Payment;
