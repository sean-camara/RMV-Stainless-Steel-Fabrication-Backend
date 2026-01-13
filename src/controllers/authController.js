const { User, PendingUser } = require('../models');
const { tokenService, emailService, activityService } = require('../services');
const config = require('../config');
const { asyncHandler, AppError } = require('../middleware');

/**
 * @desc    Register new customer
 * @route   POST /api/auth/register
 * @access  Public
 */
const register = asyncHandler(async (req, res) => {
  const { email, password, firstName, lastName, phone } = req.body;

  // Check if user already exists (verified)
  const existingUser = await User.findOne({ email });
  if (existingUser) {
    throw new AppError('Email already registered', 400);
  }

  // Check if there's a pending registration - delete it to allow new registration
  await PendingUser.deleteOne({ email });

  // Generate OTP
  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  const otpExpires = new Date(Date.now() + config.business.otpValidityMinutes * 60 * 1000);

  // Create pending user (NOT the actual user yet)
  const pendingUser = await PendingUser.create({
    email,
    password,
    profile: {
      firstName,
      lastName,
      phone,
    },
    otp,
    otpExpires,
  });

  // Send OTP email
  try {
    await emailService.sendOTP(email, otp, 'verification');
    console.log('Verification email sent to:', email);
  } catch (emailError) {
    console.log('Email service error:', emailError.message);
    console.log('OTP for testing:', otp);
  }

  // In development mode, include OTP in response for testing
  const responseData = {
    email: pendingUser.email,
  };

  // Include OTP in development mode for testing
  if (config.nodeEnv === 'development') {
    responseData.otp = otp;
    responseData.message = 'Development mode: Use this OTP to verify';
  }

  res.status(201).json({
    success: true,
    message: 'Registration initiated. Please check your email for verification code.',
    data: responseData,
  });
});

/**
 * @desc    Verify email with OTP
 * @route   POST /api/auth/verify-email
 * @access  Public
 */
const verifyEmail = asyncHandler(async (req, res) => {
  const { email, otp } = req.body;

  // Find pending user with password (needed to create real user)
  const pendingUser = await PendingUser.findOne({ email }).select('+password');

  if (!pendingUser) {
    throw new AppError('No pending registration found. Please register again.', 404);
  }

  if (new Date() > pendingUser.otpExpires) {
    await PendingUser.deleteOne({ email });
    throw new AppError('OTP expired. Please register again.', 400);
  }

  if (pendingUser.otp !== otp) {
    throw new AppError('Invalid OTP', 400);
  }

  // Check if user already exists (edge case)
  const existingUser = await User.findOne({ email });
  if (existingUser) {
    await PendingUser.deleteOne({ email });
    throw new AppError('Email already registered', 400);
  }

  // Create user document directly without triggering pre-save hook
  // This is necessary because the password is already hashed in PendingUser
  const user = new User({
    email: pendingUser.email,
    password: pendingUser.password, // Already hashed
    role: config.roles.CUSTOMER,
    profile: pendingUser.profile,
    isEmailVerified: true,
  });

  // Mark password as not modified to prevent double hashing
  user.$__.activePaths.default('password');
  user.isNew = true;
  
  // Use collection.insertOne to bypass mongoose middleware entirely
  await User.collection.insertOne({
    email: user.email,
    password: pendingUser.password,
    role: user.role,
    profile: user.profile,
    isEmailVerified: true,
    isActive: true,
    isDeleted: false,
    refreshTokens: [],
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  // Fetch the created user
  const createdUser = await User.findOne({ email });

  // Delete pending user
  await PendingUser.deleteOne({ email });

  // Log activity
  await activityService.logAuth(createdUser._id, createdUser.role, 'email_verified', {
    ipAddress: req.ip,
  });

  res.json({
    success: true,
    message: 'Email verified successfully. Please sign in to continue.',
    data: {
      email: user.email,
    },
  });
});

/**
 * @desc    Resend verification OTP
 * @route   POST /api/auth/resend-otp
 * @access  Public
 */
const resendOTP = asyncHandler(async (req, res) => {
  const { email } = req.body;

  // Check for pending user first
  const pendingUser = await PendingUser.findOne({ email });

  if (!pendingUser) {
    // Check if user already exists and is verified
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      throw new AppError('Email already verified. Please sign in.', 400);
    }
    throw new AppError('No pending registration found. Please register again.', 404);
  }

  // Generate new OTP
  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  const otpExpires = new Date(Date.now() + config.business.otpValidityMinutes * 60 * 1000);

  pendingUser.otp = otp;
  pendingUser.otpExpires = otpExpires;
  await pendingUser.save();

  // Try to send OTP email
  try {
    await emailService.sendOTP(email, otp, 'verification');
    console.log('Resent verification email to:', email);
  } catch (emailError) {
    console.log('Email service error:', emailError.message);
    console.log('OTP for testing:', otp);
  }

  // Include OTP in development mode
  const responseData = { success: true, message: 'OTP sent successfully' };
  if (config.nodeEnv === 'development') {
    responseData.otp = otp;
  }

  res.json(responseData);
});

/**
 * @desc    Login user
 * @route   POST /api/auth/login
 * @access  Public
 */
const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  // Find user with password
  const user = await User.findOne({ email }).select('+password');

  if (!user) {
    throw new AppError('Invalid email or password', 401);
  }

  // Check password
  const isMatch = await user.comparePassword(password);
  if (!isMatch) {
    // Log failed attempt
    await activityService.logAuth(user._id, user.role, 'login_failed', {
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });
    throw new AppError('Invalid email or password', 401);
  }

  // Check if account is active
  if (!user.isActive) {
    throw new AppError('Account is deactivated. Please contact support.', 401);
  }

  // Check if email is verified (for customers only)
  if (user.role === config.roles.CUSTOMER && !user.isEmailVerified) {
    throw new AppError('Please verify your email first', 401, 'EMAIL_NOT_VERIFIED');
  }

  // Generate tokens
  const tokens = tokenService.generateTokens(user._id, user.role);

  // Save refresh token
  user.refreshTokens.push({ token: tokens.refreshToken });
  user.lastLogin = new Date();
  await user.save();

  // Cleanup old refresh tokens to cap size and age
  await tokenService.cleanupExpiredTokens(user._id);

  // Log activity
  await activityService.logAuth(user._id, user.role, 'login', {
    ipAddress: req.ip,
    userAgent: req.headers['user-agent'],
  });

  res.json({
    success: true,
    message: 'Login successful',
    data: {
      user: {
        id: user._id,
        email: user.email,
        role: user.role,
        firstName: user.profile?.firstName || '',
        lastName: user.profile?.lastName || '',
        phone: user.profile?.phone || '',
        address: user.profile?.address || {},
        isEmailVerified: user.isEmailVerified,
      },
      ...tokens,
    },
  });
});

/**
 * @desc    Refresh access token
 * @route   POST /api/auth/refresh
 * @access  Public
 */
const refreshToken = asyncHandler(async (req, res) => {
  const { refreshToken } = req.body;

  // Verify refresh token
  let decoded;
  try {
    decoded = tokenService.verifyRefreshToken(refreshToken);
  } catch (error) {
    throw new AppError('Invalid or expired refresh token', 401);
  }

  // Find user and check if refresh token exists
  const user = await User.findById(decoded.userId);

  if (!user) {
    throw new AppError('User not found', 401);
  }

  const tokenExists = user.refreshTokens.some((t) => t.token === refreshToken);
  if (!tokenExists) {
    throw new AppError('Refresh token not found', 401);
  }

  if (!user.isActive) {
    throw new AppError('Account is deactivated', 401);
  }

  // Generate new access token
  const accessToken = tokenService.generateAccessToken(user._id, user.role);

  res.json({
    success: true,
    data: {
      accessToken,
    },
  });
});

/**
 * @desc    Logout user
 * @route   POST /api/auth/logout
 * @access  Private
 */
const logout = asyncHandler(async (req, res) => {
  const { refreshToken } = req.body;

  if (refreshToken) {
    // Remove specific refresh token
    await User.updateOne(
      { _id: req.userId },
      { $pull: { refreshTokens: { token: refreshToken } } }
    );
  }

  // Log activity
  await activityService.logAuth(req.userId, req.userRole, 'logout', {
    ipAddress: req.ip,
  });

  res.json({
    success: true,
    message: 'Logged out successfully',
  });
});

/**
 * @desc    Forgot password - send reset OTP
 * @route   POST /api/auth/forgot-password
 * @access  Public
 */
const forgotPassword = asyncHandler(async (req, res) => {
  const { email } = req.body;

  const user = await User.findOne({ email });

  if (!user) {
    // Don't reveal if email exists
    return res.json({
      success: true,
      message: 'If the email exists, a reset code has been sent.',
    });
  }

  // Generate OTP
  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  const otpExpires = new Date(Date.now() + config.business.otpValidityMinutes * 60 * 1000);

  user.passwordReset = { otp, otpExpires };
  await user.save();

  // Send OTP email
  await emailService.sendOTP(email, otp, 'reset');

  // Log activity
  await activityService.logAuth(user._id, user.role, 'password_reset_request', {
    ipAddress: req.ip,
  });

  res.json({
    success: true,
    message: 'If the email exists, a reset code has been sent.',
  });
});

/**
 * @desc    Reset password with OTP
 * @route   POST /api/auth/reset-password
 * @access  Public
 */
const resetPassword = asyncHandler(async (req, res) => {
  const { email, otp, newPassword } = req.body;

  const user = await User.findOne({ email }).select('+passwordReset.otp +passwordReset.otpExpires');

  if (!user) {
    throw new AppError('Invalid request', 400);
  }

  if (!user.passwordReset.otp || !user.passwordReset.otpExpires) {
    throw new AppError('No reset request found. Please request a new one.', 400);
  }

  if (new Date() > user.passwordReset.otpExpires) {
    throw new AppError('OTP expired. Please request a new one.', 400);
  }

  if (user.passwordReset.otp !== otp) {
    throw new AppError('Invalid OTP', 400);
  }

  // Update password
  user.password = newPassword;
  user.passwordReset = undefined;
  // Invalidate all refresh tokens
  user.refreshTokens = [];
  await user.save();

  // Log activity
  await activityService.logAuth(user._id, user.role, 'password_reset_complete', {
    ipAddress: req.ip,
  });

  res.json({
    success: true,
    message: 'Password reset successful. Please login with your new password.',
  });
});

/**
 * @desc    Get current user profile
 * @route   GET /api/auth/me
 * @access  Private
 */
const getMe = asyncHandler(async (req, res) => {
  const user = await User.findById(req.userId);

  res.json({
    success: true,
    data: {
      user: {
        id: user._id,
        email: user.email,
        role: user.role,
        firstName: user.profile?.firstName || '',
        lastName: user.profile?.lastName || '',
        phone: user.profile?.phone || '',
        address: user.profile?.address || {},
        isEmailVerified: user.isEmailVerified,
        lastLogin: user.lastLogin,
        createdAt: user.createdAt,
      },
    },
  });
});

/**
 * @desc    Update current user profile
 * @route   PUT /api/auth/me
 * @access  Private
 */
const updateMe = asyncHandler(async (req, res) => {
  const { firstName, lastName, phone, address } = req.body;

  const user = await User.findById(req.userId);

  if (firstName) user.profile.firstName = firstName;
  if (lastName) user.profile.lastName = lastName;
  if (phone) user.profile.phone = phone;
  if (address) user.profile.address = { ...user.profile.address, ...address };

  await user.save();

  res.json({
    success: true,
    message: 'Profile updated successfully',
    data: {
      user: {
        id: user._id,
        email: user.email,
        role: user.role,
        profile: user.profile,
      },
    },
  });
});

/**
 * @desc    Change password
 * @route   PUT /api/auth/change-password
 * @access  Private
 */
const changePassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;

  const user = await User.findById(req.userId).select('+password');

  const isMatch = await user.comparePassword(currentPassword);
  if (!isMatch) {
    throw new AppError('Current password is incorrect', 400);
  }

  user.password = newPassword;
  // Invalidate all other sessions
  user.refreshTokens = [];
  await user.save();

  // Generate new tokens
  const tokens = tokenService.generateTokens(user._id, user.role);
  user.refreshTokens.push({ token: tokens.refreshToken });
  await user.save();

  res.json({
    success: true,
    message: 'Password changed successfully',
    data: tokens,
  });
});

module.exports = {
  register,
  verifyEmail,
  resendOTP,
  login,
  refreshToken,
  logout,
  forgotPassword,
  resetPassword,
  getMe,
  updateMe,
  changePassword,
};
