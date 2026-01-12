require('dotenv').config();

module.exports = {
  // Server
  nodeEnv: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT, 10) || 5000,

  // MongoDB
  mongodbUri: process.env.MONGODB_URI || 'mongodb://localhost:27017/rmv_fabrication',

  // JWT
  jwt: {
    secret: process.env.JWT_SECRET || 'default_jwt_secret_change_in_production',
    refreshSecret: process.env.JWT_REFRESH_SECRET || 'default_refresh_secret_change_in_production',
    expiresIn: process.env.JWT_EXPIRES_IN || '1h',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  },

  // Email (Gmail SMTP)
  smtp: {
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT, 10) || 587,
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
    from: process.env.SMTP_FROM || 'RMV Stainless Steel <noreply@rmvsteel.com>',
  },

  // Frontend URL (for CORS and email links)
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:3000',

  // File Upload Limits
  upload: {
    maxSizeImage: parseInt(process.env.UPLOAD_MAX_SIZE_IMAGE, 10) || 10 * 1024 * 1024, // 10MB
    maxSizePdf: parseInt(process.env.UPLOAD_MAX_SIZE_PDF, 10) || 25 * 1024 * 1024, // 25MB
  },

  // Rate Limiting
  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS, 10) || 15 * 60 * 1000, // 15 minutes
    maxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS, 10) || 100,
  },

  // Business Rules
  business: {
    // Appointment settings
    appointmentHours: {
      start: 9, // 9:00 AM
      end: 18,  // 6:00 PM
    },
    slotDurationMinutes: 60,
    cancellationCutoffHours: 24,

    // Payment stages (percentages)
    paymentStages: {
      initial: 30,
      midpoint: 40,
      final: 30,
    },

    // Project categories
    projectCategories: ['gate', 'railing', 'grills', 'door', 'fence', 'staircase', 'furniture', 'kitchen', 'custom', 'gates', 'railings', 'commercial'],

    // OTP settings
    otpValidityMinutes: 10,
  },

  // User Roles
  roles: {
    CUSTOMER: 'customer',
    APPOINTMENT_AGENT: 'appointment_agent',
    SALES_STAFF: 'sales_staff',
    ENGINEER: 'engineer',
    CASHIER: 'cashier',
    FABRICATION_STAFF: 'fabrication_staff',
    ADMIN: 'admin',
  },
};
