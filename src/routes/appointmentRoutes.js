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
  authorize(ROLES.APPOINTMENT_AGENT, ROLES.ADMIN, ROLES.CUSTOMER, ROLES.SALES_STAFF),
  validate(schemas.mongoId, 'params'),
  validate(schemas.cancelAppointment),
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

// Travel fee (ocular visits)
router.put(
  '/:id/travel-fee',
  authorize(ROLES.CASHIER, ROLES.ADMIN),
  validate(schemas.mongoId, 'params'),
  validate(schemas.setTravelFee),
  appointmentController.setTravelFee
);

router.put(
  '/:id/travel-fee/collect',
  authorize(ROLES.SALES_STAFF),
  validate(schemas.mongoId, 'params'),
  validate(schemas.collectTravelFee),
  appointmentController.collectTravelFee
);

router.put(
  '/:id/travel-fee/verify',
  authorize(ROLES.CASHIER),
  validate(schemas.mongoId, 'params'),
  validate(schemas.verifyTravelFee),
  appointmentController.verifyTravelFee
);

module.exports = router;
