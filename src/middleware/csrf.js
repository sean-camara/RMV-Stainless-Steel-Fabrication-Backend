const { v4: uuidv4 } = require('uuid');
const config = require('../config');

const CSRF_COOKIE = 'csrf-token';
const CSRF_HEADER = 'x-csrf-token';

const cookieOptions = {
  httpOnly: false, // readable by frontend for double-submit pattern
  sameSite: 'lax',
  secure: config.nodeEnv === 'production',
  path: '/',
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
};

// Issue a CSRF token cookie if missing so clients can echo it in headers
const issueCsrfToken = (req, res, next) => {
  if (!req.cookies || !req.cookies[CSRF_COOKIE]) {
    const token = uuidv4();
    res.cookie(CSRF_COOKIE, token, cookieOptions);
  }
  next();
};

// Enforce CSRF token on state-changing requests when using cookie auth
const csrfProtect = (req, res, next) => {
  const safeMethods = ['GET', 'HEAD', 'OPTIONS'];
  if (safeMethods.includes(req.method)) return next();

  // Skip for auth endpoints and health checks to avoid blocking login flows
  const exemptPaths = [
    '/health',
    '/api/auth/login',
    '/api/auth/register',
    '/api/auth/verify-email',
    '/api/auth/resend-otp',
    '/api/auth/forgot-password',
    '/api/auth/reset-password',
    '/api/auth/refresh',
  ];
  if (exemptPaths.some((path) => req.path.startsWith(path))) return next();

  // If bearer token is present, assume header-based auth (less CSRF risk)
  if (req.headers.authorization) return next();

  const cookieToken = req.cookies?.[CSRF_COOKIE];
  const headerToken = req.headers[CSRF_HEADER];

  if (!cookieToken || !headerToken || cookieToken !== headerToken) {
    return res.status(403).json({
      success: false,
      message: 'Invalid CSRF token',
      code: 'CSRF_ERROR',
    });
  }

  return next();
};

module.exports = {
  issueCsrfToken,
  csrfProtect,
  CSRF_COOKIE,
  CSRF_HEADER,
};
