const express = require('express');
const router = express.Router();
const { appointmentController } = require('../controllers');
const { authenticate, authorize, validate, schemas, ROLES } = require('../middleware');

// All routes require authentication
router.use(authenticate);

// Customer routes
router.post(
  '/',
  authorize(ROLES.CUSTOMER),
  validate(schemas.createAppointment),
  appointmentController.createAppointment
);

// Get appointments (role-filtered in controller)
router.get('/', appointmentController.getAppointments);

// Get available slots
router.get(
  '/slots',
  authorize(ROLES.CUSTOMER, ROLES.APPOINTMENT_AGENT, ROLES.ADMIN),
  appointmentController.getAvailableSlots
);

// Calendar view (agent/admin only)
router.get(
  '/calendar',
  authorize(ROLES.APPOINTMENT_AGENT, ROLES.ADMIN),
  appointmentController.getCalendarView
);

// Get single appointment
router.get('/:id', validate(schemas.mongoId, 'params'), appointmentController.getAppointment);

// Assign sales staff (agent only)
router.put(
  '/:id/assign',
  authorize(ROLES.APPOINTMENT_AGENT, ROLES.ADMIN),
  validate(schemas.mongoId, 'params'),
  validate(schemas.assignAppointment),
  appointmentController.assignSalesStaff
);

// Cancel appointment
router.put(
  '/:id/cancel',
  validate(schemas.mongoId, 'params'),
  appointmentController.cancelAppointment
);

// Complete appointment (sales staff)
router.put(
  '/:id/complete',
  authorize(ROLES.SALES_STAFF),
  validate(schemas.mongoId, 'params'),
  appointmentController.completeAppointment
);

// Mark no show (staff only)
router.put(
  '/:id/no-show',
  authorize(ROLES.SALES_STAFF, ROLES.APPOINTMENT_AGENT, ROLES.ADMIN),
  validate(schemas.mongoId, 'params'),
  appointmentController.markNoShow
);

module.exports = router;
