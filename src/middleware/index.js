const { authenticate, optionalAuth } = require('./auth');
const { authorize, isAdmin, isStaff, isOwnerOrAdmin, canAccessCustomerData, ROLES } = require('./rbac');
const { validate, schemas } = require('./validate');
const { errorHandler, notFound, asyncHandler, AppError } = require('./error');
const upload = require('./upload');

module.exports = {
  // Auth
  authenticate,
  optionalAuth,
  
  // RBAC
  authorize,
  isAdmin,
  isStaff,
  isOwnerOrAdmin,
  canAccessCustomerData,
  ROLES,
  
  // Validation
  validate,
  schemas,
  
  // Error handling
  errorHandler,
  notFound,
  asyncHandler,
  AppError,
  
  // File upload
  upload,
};
