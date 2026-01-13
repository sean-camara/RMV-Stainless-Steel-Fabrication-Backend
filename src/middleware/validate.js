const Joi = require('joi');
const config = require('../config');

/**
 * Validation middleware factory
 * @param {Joi.Schema} schema - Joi schema to validate against
 * @param {string} property - Request property to validate (body, query, params)
 */
const validate = (schema, property = 'body') => {
  return (req, res, next) => {
    const { error, value } = schema.validate(req[property], {
      abortEarly: false,
      stripUnknown: true,
    });

    if (error) {
      const errors = error.details.map((detail) => ({
        field: detail.path.join('.'),
        message: detail.message,
      }));

      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors,
      });
    }

    // Replace with validated/sanitized value
    req[property] = value;
    next();
  };
};

// Common validation schemas
const schemas = {
  // Auth schemas
  register: Joi.object({
    email: Joi.string().email().required().trim().lowercase(),
    password: Joi.string()
      .min(8)
      .required()
      .messages({
        'string.min': 'Password must be at least 8 characters long',
      }),
    confirmPassword: Joi.string().valid(Joi.ref('password')).required().messages({
      'any.only': 'Passwords do not match',
    }),
    firstName: Joi.string().min(1).max(50).required().trim(),
    lastName: Joi.string().min(1).max(50).required().trim(),
    phone: Joi.string()
      .pattern(/^(\+63|0)?9\d{9}$/)
      .allow('')
      .optional()
      .messages({
        'string.pattern.base': 'Please enter a valid Philippine phone number (e.g., 09171234567)',
      }),
  }),

  login: Joi.object({
    email: Joi.string().email().required().trim().lowercase(),
    password: Joi.string().required(),
  }),

  verifyOTP: Joi.object({
    email: Joi.string().email().required().trim().lowercase(),
    otp: Joi.string().length(6).required(),
  }),

  forgotPassword: Joi.object({
    email: Joi.string().email().required().trim().lowercase(),
  }),

  resetPassword: Joi.object({
    email: Joi.string().email().required().trim().lowercase(),
    otp: Joi.string().length(6).required(),
    newPassword: Joi.string()
      .min(8)
      .pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
      .required()
      .messages({
        'string.pattern.base': 'Password must contain at least one uppercase letter, one lowercase letter, and one number',
      }),
    confirmPassword: Joi.string().valid(Joi.ref('newPassword')).required().messages({
      'any.only': 'Passwords do not match',
    }),
  }),

  refreshToken: Joi.object({
    refreshToken: Joi.string().required(),
  }),

  // User schemas
  createUser: Joi.object({
    email: Joi.string().email().required().trim().lowercase(),
    password: Joi.string()
      .min(8)
      .pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
      .required(),
    role: Joi.string()
      .valid(...Object.values(config.roles))
      .required(),
    firstName: Joi.string().min(1).max(50).required().trim(),
    lastName: Joi.string().min(1).max(50).required().trim(),
    phone: Joi.string().pattern(/^(\+63|0)9\d{9}$/),
  }),

  updateUser: Joi.object({
    firstName: Joi.string().min(1).max(50).trim(),
    lastName: Joi.string().min(1).max(50).trim(),
    phone: Joi.string().pattern(/^(\+63|0)9\d{9}$/),
    address: Joi.object({
      street: Joi.string().max(200),
      barangay: Joi.string().max(100),
      city: Joi.string().max(100),
      province: Joi.string().max(100),
      zipCode: Joi.string().max(10),
    }),
  }),

  // Appointment schemas
  createAppointment: Joi.object({
    scheduledDate: Joi.date().min('now').required(),
    appointmentType: Joi.string().valid('office_consultation', 'ocular_visit').default('office_consultation'),
    interestedCategory: Joi.string().valid(...config.business.projectCategories),
    description: Joi.string().max(1000),
    siteAddress: Joi.object({
      street: Joi.string().max(200),
      barangay: Joi.string().max(100),
      city: Joi.string().max(100),
      province: Joi.string().max(100),
      zipCode: Joi.string().max(10),
      landmark: Joi.string().max(200),
    }).when('appointmentType', {
      is: 'ocular_visit',
      then: Joi.required(),
    }),
    notes: Joi.string().max(1000),
  }),

  assignAppointment: Joi.object({
    salesStaffId: Joi.string().hex().length(24).required(),
    agentNotes: Joi.string().max(500),
  }),

  cancelAppointment: Joi.object({
    reason: Joi.string().max(500).allow('', null),
    message: Joi.string().max(1200).allow('', null),
  }),

  // Travel fee (ocular) management
  setTravelFee: Joi.object({
    amount: Joi.number().positive().required(),
    notes: Joi.string().max(500).allow('', null),
    isRequired: Joi.boolean().default(true),
  }),

  collectTravelFee: Joi.object({
    collectedAmount: Joi.number().positive().required(),
    notes: Joi.string().max(500).allow('', null),
  }),

  verifyTravelFee: Joi.object({
    notes: Joi.string().max(500).allow('', null),
  }),

  // Project schemas
  createProject: Joi.object({
    customerId: Joi.string().hex().length(24).required(),
    appointmentId: Joi.string().hex().length(24),
    category: Joi.string().valid(...config.business.projectCategories).required(),
    title: Joi.string().min(1).max(200).required().trim(),
    description: Joi.string().max(2000),
    specifications: Joi.object({
      material: Joi.string().valid('304_grade', '316_grade', 'other'),
      dimensions: Joi.object({
        width: Joi.number().positive(),
        height: Joi.number().positive(),
        depth: Joi.number().positive(),
        unit: Joi.string().default('cm'),
      }),
      color: Joi.string().max(50),
      finish: Joi.string().valid('brushed', 'polished', 'matte', 'mirror', 'other'),
      additionalSpecs: Joi.string().max(1000),
    }),
    siteAddress: Joi.object({
      street: Joi.string().max(200),
      barangay: Joi.string().max(100),
      city: Joi.string().max(100),
      province: Joi.string().max(100),
      zipCode: Joi.string().max(10),
      landmark: Joi.string().max(200),
    }),
  }),

  updateProjectStatus: Joi.object({
    status: Joi.string().valid(
      'draft',
      'pending_blueprint',
      'blueprint_pending',
      'blueprint_submitted',
      'blueprint_uploaded',
      'pending_customer_approval',
      'client_approved',
      'client_rejected',
      'revision_requested',
      'approved',
      'pending_initial_payment',
      'dp_pending',
      'initial_payment_verified',
      'in_fabrication',
      'pending_midpoint_payment',
      'midpoint_payment_verified',
      'fabrication_done',
      'ready_for_pickup',
      'ready_for_installation',
      'in_installation',
      'pending_final_payment',
      'released',
      'completed',
      'cancelled',
      'on_hold'
    ).required(),
    notes: Joi.string().max(500),
  }),

  // Payment schemas
  submitPaymentProof: Joi.object({
    paymentMethod: Joi.string().valid('gcash', 'bank_transfer', 'cash', 'other').required(),
  }),

  verifyPayment: Joi.object({
    amountReceived: Joi.number().positive().required(),
    referenceNumber: Joi.string().max(100),
    notes: Joi.string().max(500),
  }),

  rejectPayment: Joi.object({
    reason: Joi.string().min(1).max(500).required(),
  }),

  // Pagination
  pagination: Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(20),
    sortBy: Joi.string(),
    sortOrder: Joi.string().valid('asc', 'desc').default('desc'),
  }),

  // ID param
  mongoId: Joi.object({
    id: Joi.string().hex().length(24).required(),
  }),
};

module.exports = {
  validate,
  schemas,
};
