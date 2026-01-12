const express = require('express');
const router = express.Router();
const { adminController } = require('../controllers');
const { authenticate, isAdmin, validate, schemas } = require('../middleware');

// All routes require admin authentication
router.use(authenticate);
router.use(isAdmin);

// Dashboard overview
router.get('/dashboard', adminController.getDashboard);

// Activity logs
router.get('/activity-logs', adminController.getActivityLogs);

// Reports
router.get('/reports', adminController.getReports);

// All projects overview
router.get('/projects', adminController.getAllProjects);

// Update payment stages for a project
router.put(
  '/projects/:id/payment-stages',
  validate(schemas.mongoId, 'params'),
  adminController.updatePaymentStages
);

module.exports = router;
