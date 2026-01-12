const mongoose = require('mongoose');
const config = require('../config');

const appointmentSchema = new mongoose.Schema(
  {
    // Customer who booked the appointment
    customer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Customer is required'],
    },
    // Assigned sales staff (assigned by appointment agent)
    assignedSalesStaff: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    // Scheduled date and time
    scheduledDate: {
      type: Date,
      required: [true, 'Scheduled date is required'],
    },
    // End time (calculated based on slot duration in pre-save hook)
    scheduledEndDate: {
      type: Date,
    },
    // Appointment type
    appointmentType: {
      type: String,
      enum: ['office_consultation', 'ocular_visit'],
      default: 'office_consultation',
    },
    // For ocular visits - site address
    siteAddress: {
      street: String,
      barangay: String,
      city: String,
      province: String,
      zipCode: String,
      landmark: String,
    },
    // Project category of interest
    interestedCategory: {
      type: String,
      enum: config.business.projectCategories,
    },
    // Customer's initial description
    description: {
      type: String,
      maxlength: [1000, 'Description cannot exceed 1000 characters'],
    },
    // Appointment status
    status: {
      type: String,
      enum: [
        'pending',          // Just booked, waiting for agent assignment
        'scheduled',        // Agent assigned sales staff
        'confirmed',        // Customer confirmed
        'in_progress',      // Consultation ongoing
        'completed',        // Consultation done
        'cancelled',        // Cancelled by customer or staff
        'no_show',          // Customer didn't show up
      ],
      default: 'pending',
    },
    // Cancellation details
    cancellation: {
      cancelledBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
      cancelledAt: Date,
      reason: String,
      isWithinPolicy: Boolean, // True if cancelled 24+ hours before
    },
    // Notes from various stages
    notes: {
      customerNotes: String,      // Notes from customer when booking
      agentNotes: String,         // Notes from appointment agent
      salesNotes: String,         // Notes from sales staff after consultation
    },
    // If consultation leads to a project
    convertedToProject: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Project',
    },
    // Timestamps for status changes
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
appointmentSchema.index({ scheduledDate: 1, assignedSalesStaff: 1 });
appointmentSchema.index({ customer: 1 });
appointmentSchema.index({ status: 1 });
appointmentSchema.index({ isDeleted: 1 });

// Virtual to check if appointment can be cancelled
appointmentSchema.virtual('canBeCancelled').get(function () {
  if (this.status === 'cancelled' || this.status === 'completed' || this.status === 'no_show') {
    return false;
  }
  const now = new Date();
  const cutoffTime = new Date(this.scheduledDate);
  cutoffTime.setHours(cutoffTime.getHours() - config.business.cancellationCutoffHours);
  return now < cutoffTime;
});

// Pre-save: Calculate end time
appointmentSchema.pre('save', function (next) {
  if (this.isNew || this.isModified('scheduledDate')) {
    const endDate = new Date(this.scheduledDate);
    endDate.setMinutes(endDate.getMinutes() + config.business.slotDurationMinutes);
    this.scheduledEndDate = endDate;
  }
  next();
});

// Static: Find available slots for a date
appointmentSchema.statics.findAvailableSlots = async function (date, salesStaffId) {
  const startOfDay = new Date(date);
  startOfDay.setHours(config.business.appointmentHours.start, 0, 0, 0);

  const endOfDay = new Date(date);
  endOfDay.setHours(config.business.appointmentHours.end, 0, 0, 0);

  // Get all appointments for that day and sales staff
  const bookedAppointments = await this.find({
    assignedSalesStaff: salesStaffId,
    scheduledDate: { $gte: startOfDay, $lt: endOfDay },
    status: { $nin: ['cancelled', 'no_show'] },
    isDeleted: false,
  });

  // Generate all possible slots
  const slots = [];
  let currentSlot = new Date(startOfDay);

  while (currentSlot < endOfDay) {
    const slotEnd = new Date(currentSlot);
    slotEnd.setMinutes(slotEnd.getMinutes() + config.business.slotDurationMinutes);

    // Check if slot is booked
    const isBooked = bookedAppointments.some((apt) => {
      return apt.scheduledDate.getTime() === currentSlot.getTime();
    });

    slots.push({
      start: new Date(currentSlot),
      end: slotEnd,
      isAvailable: !isBooked,
    });

    currentSlot = slotEnd;
  }

  return slots;
};

// Soft delete middleware
appointmentSchema.pre(/^find/, function (next) {
  if (this.getOptions().includeDeleted !== true) {
    this.where({ isDeleted: { $ne: true } });
  }
  next();
});

const Appointment = mongoose.model('Appointment', appointmentSchema);

module.exports = Appointment;
