const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const cookieParser = require('cookie-parser');
const path = require('path');
const fs = require('fs');
const config = require('./config');
const { errorHandler, notFound, sanitize, issueCsrfToken, csrfProtect } = require('./middleware');
const {
  authRoutes,
  userRoutes,
  appointmentRoutes,
  projectRoutes,
  paymentRoutes,
  adminRoutes,
} = require('./routes');

const app = express();

// Security middleware
app.use(helmet());

// Lightweight request logger (console + file)
const logDir = path.join(__dirname, '../logs');
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}
const makeLogStream = (dateStr) => fs.createWriteStream(path.join(logDir, `access-${dateStr}.log`), { flags: 'a' });
let currentLogDate = new Date().toISOString().slice(0, 10);
let accessLogStream = makeLogStream(currentLogDate);

app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    const line = `${req.method} ${req.originalUrl} ${res.statusCode} - ${duration}ms`;
    console.log(line);

    // Rotate daily without external deps
    const today = new Date().toISOString().slice(0, 10);
    if (today !== currentLogDate) {
      accessLogStream.end();
      currentLogDate = today;
      accessLogStream = makeLogStream(currentLogDate);
    }

    accessLogStream.write(`${new Date().toISOString()} ${line}\n`);
  });
  next();
});

// CORS configuration - explicit allowlist
const allowedOrigins = [
  'http://localhost:3000',
  'http://localhost:3001', 
  'http://localhost:3002',
  'http://localhost:3003',
  'http://localhost:5173', // Vite default
  config.frontendUrl,
].filter(Boolean);

if (process.env.ALLOWED_ORIGINS) {
  allowedOrigins.push(...process.env.ALLOWED_ORIGINS.split(',').map((origin) => origin.trim()).filter(Boolean));
}

app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl) only in development
    if (!origin) {
      if (config.nodeEnv === 'development') {
        return callback(null, true);
      }
      return callback(new Error('Not allowed by CORS: No origin provided'));
    }

    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error(`Not allowed by CORS: Origin ${origin} is not in the allowed list`));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-csrf-token', 'X-CSRF-Token', 'X-Requested-With'],
}));

// Cookies (for CSRF and future secure cookies)
app.use(cookieParser());

// Rate limiting
const limiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.maxRequests,
  message: {
    success: false,
    message: 'Too many requests, please try again later.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api', limiter);

// Stricter rate limit for auth routes
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // 10 attempts
  message: {
    success: false,
    message: 'Too many login attempts, please try again after 15 minutes.',
  },
});
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);

// Rate limit for password reset
const passwordResetLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 attempts per window
  message: {
    success: false,
    message: 'Too many password reset attempts, please try again after 15 minutes.',
  },
});
app.use('/api/auth/forgot-password', passwordResetLimiter);
app.use('/api/auth/reset-password', passwordResetLimiter);

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Basic input sanitization for body/query
app.use(sanitize());

// CSRF double-submit token (non-breaking: enforced only for cookie-based flows)
app.use(issueCsrfToken);
app.use(csrfProtect);

// Static files for uploads
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    success: true, 
    message: 'RMV API is running',
    timestamp: new Date().toISOString(),
  });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/appointments', appointmentRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/admin', adminRoutes);

// 404 handler
app.use(notFound);

// Error handler
app.use(errorHandler);

module.exports = app;
