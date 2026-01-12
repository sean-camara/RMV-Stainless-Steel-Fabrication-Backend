const express = require('express');
const router = express.Router();
const { userController } = require('../controllers');
const { authenticate, authorize, isAdmin, validate, schemas, ROLES } = require('../middleware');

// All routes require authentication
router.use(authenticate);

// Get users by role (for dropdowns) - any staff can access
router.get(
  '/role/:role',
  authorize(
    ROLES.ADMIN,
    ROLES.APPOINTMENT_AGENT,
    ROLES.SALES_STAFF,
    ROLES.ENGINEER,
    ROLES.CASHIER
  ),
  userController.getUsersByRole
);

// Admin only routes
router.get('/', isAdmin, userController.getUsers);
router.post('/', isAdmin, validate(schemas.createUser), userController.createUser);
router.get('/:id', isAdmin, validate(schemas.mongoId, 'params'), userController.getUser);
router.put('/:id', isAdmin, validate(schemas.mongoId, 'params'), userController.updateUser);
router.put('/:id/deactivate', isAdmin, validate(schemas.mongoId, 'params'), userController.deactivateUser);
router.put('/:id/reactivate', isAdmin, validate(schemas.mongoId, 'params'), userController.reactivateUser);
router.delete('/:id', isAdmin, validate(schemas.mongoId, 'params'), userController.deleteUser);
router.put('/:id/reset-password', isAdmin, validate(schemas.mongoId, 'params'), userController.resetUserPassword);

module.exports = router;
