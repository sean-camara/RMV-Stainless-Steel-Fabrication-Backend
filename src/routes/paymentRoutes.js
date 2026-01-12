const express = require('express');
const router = express.Router();
const { paymentController } = require('../controllers');
const { 
  authenticate, 
  authorize, 
  validate, 
  schemas, 
  upload,
  ROLES 
} = require('../middleware');

// All routes require authentication
router.use(authenticate);

// Customer get their payments
router.get(
  '/my-payments',
  authorize(ROLES.CUSTOMER),
  paymentController.getMyPayments
);

// Pending payments (cashier)
router.get(
  '/pending',
  authorize(ROLES.CASHIER, ROLES.ADMIN),
  paymentController.getPendingPayments
);

// Payment summary (cashier/admin)
router.get(
  '/summary',
  authorize(ROLES.CASHIER, ROLES.ADMIN),
  paymentController.getPaymentSummary
);

// All payments (admin/cashier)
router.get(
  '/',
  authorize(ROLES.CASHIER, ROLES.ADMIN),
  paymentController.getAllPayments
);

// Get payments for a project
router.get('/project/:projectId', paymentController.getProjectPayments);

// Get single payment
router.get('/:id', validate(schemas.mongoId, 'params'), paymentController.getPayment);

// Upload QR code (cashier)
router.post(
  '/:id/qrcode',
  authorize(ROLES.CASHIER),
  validate(schemas.mongoId, 'params'),
  upload.uploadQrCode,
  paymentController.uploadQRCode
);

// Submit payment proof (customer)
router.post(
  '/:id/proof',
  authorize(ROLES.CUSTOMER),
  validate(schemas.mongoId, 'params'),
  upload.uploadPaymentProof,
  validate(schemas.submitPaymentProof),
  paymentController.submitPaymentProof
);

// Verify payment (cashier)
router.put(
  '/:id/verify',
  authorize(ROLES.CASHIER),
  validate(schemas.mongoId, 'params'),
  validate(schemas.verifyPayment),
  paymentController.verifyPayment
);

// Reject payment (cashier)
router.put(
  '/:id/reject',
  authorize(ROLES.CASHIER),
  validate(schemas.mongoId, 'params'),
  validate(schemas.rejectPayment),
  paymentController.rejectPayment
);

module.exports = router;
