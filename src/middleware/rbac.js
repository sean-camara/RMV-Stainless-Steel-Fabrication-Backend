const config = require('../config');

/**
 * Role-based access control middleware
 * @param  {...string} allowedRoles - Roles allowed to access the route
 */
const authorize = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required.',
      });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to perform this action.',
      });
    }

    next();
  };
};

/**
 * Check if user is admin
 */
const isAdmin = (req, res, next) => {
  if (!req.user || req.user.role !== config.roles.ADMIN) {
    return res.status(403).json({
      success: false,
      message: 'Admin access required.',
    });
  }
  next();
};

/**
 * Check if user is internal staff (not customer)
 */
const isStaff = (req, res, next) => {
  if (!req.user || req.user.role === config.roles.CUSTOMER) {
    return res.status(403).json({
      success: false,
      message: 'Staff access required.',
    });
  }
  next();
};

/**
 * Check if user is the owner of a resource or is admin
 */
const isOwnerOrAdmin = (resourceUserIdField = 'userId') => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required.',
      });
    }

    const resourceUserId = req.params[resourceUserIdField] || req.body[resourceUserIdField];

    if (
      req.user.role === config.roles.ADMIN ||
      req.user._id.toString() === resourceUserId
    ) {
      return next();
    }

    return res.status(403).json({
      success: false,
      message: 'You do not have permission to access this resource.',
    });
  };
};

/**
 * Check if user can access customer data
 * Customers can only access their own data
 * Staff can access based on their role
 */
const canAccessCustomerData = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: 'Authentication required.',
    });
  }

  const customerId = req.params.customerId || req.body.customerId || req.query.customerId;

  // Admin can access all
  if (req.user.role === config.roles.ADMIN) {
    return next();
  }

  // Customer can only access their own data
  if (req.user.role === config.roles.CUSTOMER) {
    if (req.user._id.toString() === customerId) {
      return next();
    }
    return res.status(403).json({
      success: false,
      message: 'You can only access your own data.',
    });
  }

  // Staff roles can access customer data based on their responsibilities
  const staffRolesWithCustomerAccess = [
    config.roles.APPOINTMENT_AGENT,
    config.roles.SALES_STAFF,
    config.roles.ENGINEER,
    config.roles.CASHIER,
    config.roles.FABRICATION_STAFF,
  ];

  if (staffRolesWithCustomerAccess.includes(req.user.role)) {
    return next();
  }

  return res.status(403).json({
    success: false,
    message: 'You do not have permission to access this data.',
  });
};

// Role constants for convenience
const ROLES = config.roles;

module.exports = {
  authorize,
  isAdmin,
  isStaff,
  isOwnerOrAdmin,
  canAccessCustomerData,
  ROLES,
};
