const express = require('express');
const router = express.Router();
const { authController } = require('../controllers');
const { authenticate, validate, schemas } = require('../middleware');

// Public routes
router.post('/register', validate(schemas.register), authController.register);
router.post('/verify-email', validate(schemas.verifyOTP), authController.verifyEmail);
router.post('/resend-otp', validate(schemas.forgotPassword), authController.resendOTP);
router.post('/login', validate(schemas.login), authController.login);
router.post('/refresh', validate(schemas.refreshToken), authController.refreshToken);
router.post('/forgot-password', validate(schemas.forgotPassword), authController.forgotPassword);
router.post('/reset-password', validate(schemas.resetPassword), authController.resetPassword);

// Protected routes
router.use(authenticate);
router.post('/logout', authController.logout);
router.get('/me', authController.getMe);
router.put('/me', validate(schemas.updateUser), authController.updateMe);
router.put('/change-password', authController.changePassword);

module.exports = router;
