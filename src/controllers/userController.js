const { User } = require('../models');
const { activityService, tokenService } = require('../services');
const config = require('../config');
const { asyncHandler, AppError } = require('../middleware');

/**
 * @desc    Get all users (admin only)
 * @route   GET /api/users
 * @access  Private/Admin
 */
const getUsers = asyncHandler(async (req, res) => {
  const { page = 1, limit = 20, role, isActive, search } = req.query;
  const skip = (page - 1) * limit;

  const query = {};
  if (role) query.role = role;
  if (isActive !== undefined) query.isActive = isActive === 'true';
  if (search) {
    query.$or = [
      { email: { $regex: search, $options: 'i' } },
      { 'profile.firstName': { $regex: search, $options: 'i' } },
      { 'profile.lastName': { $regex: search, $options: 'i' } },
    ];
  }

  const [users, total] = await Promise.all([
    User.find(query)
      .select('-refreshTokens')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit)),
    User.countDocuments(query),
  ]);

  res.json({
    success: true,
    data: {
      users,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit),
      },
    },
  });
});

/**
 * @desc    Get user by ID
 * @route   GET /api/users/:id
 * @access  Private/Admin
 */
const getUser = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id).select('-refreshTokens');

  if (!user) {
    throw new AppError('User not found', 404);
  }

  res.json({
    success: true,
    data: { user },
  });
});

/**
 * @desc    Create internal staff user (admin only)
 * @route   POST /api/users
 * @access  Private/Admin
 */
const createUser = asyncHandler(async (req, res) => {
  const { email, password, role, firstName, lastName, phone } = req.body;

  // Customers must register themselves
  if (role === config.roles.CUSTOMER) {
    throw new AppError('Customers must register through the public registration', 400);
  }

  // Check if email exists
  const existingUser = await User.findOne({ email });
  if (existingUser) {
    throw new AppError('Email already registered', 400);
  }

  // Create user (staff accounts are pre-verified)
  const user = await User.create({
    email,
    password,
    role,
    profile: {
      firstName,
      lastName,
      phone,
    },
    isEmailVerified: true, // Staff accounts are pre-verified
    createdBy: req.userId,
  });

  // Log activity
  await activityService.logUserAction(
    req.userId,
    req.userRole,
    'user_created',
    user._id,
    null,
    { role, email }
  );

  res.status(201).json({
    success: true,
    message: 'User created successfully',
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
 * @desc    Update user
 * @route   PUT /api/users/:id
 * @access  Private/Admin
 */
const updateUser = asyncHandler(async (req, res) => {
  const { firstName, lastName, phone, address, role, isActive } = req.body;

  const user = await User.findById(req.params.id);

  if (!user) {
    throw new AppError('User not found', 404);
  }

  const changes = { before: {}, after: {} };

  if (firstName) {
    changes.before.firstName = user.profile.firstName;
    user.profile.firstName = firstName;
    changes.after.firstName = firstName;
  }
  if (lastName) {
    changes.before.lastName = user.profile.lastName;
    user.profile.lastName = lastName;
    changes.after.lastName = lastName;
  }
  if (phone) {
    changes.before.phone = user.profile.phone;
    user.profile.phone = phone;
    changes.after.phone = phone;
  }
  if (address) {
    changes.before.address = user.profile.address;
    user.profile.address = { ...user.profile.address, ...address };
    changes.after.address = user.profile.address;
  }
  if (role && user.role !== config.roles.CUSTOMER) {
    // Can't change customer to staff or vice versa
    if (role !== config.roles.CUSTOMER) {
      changes.before.role = user.role;
      user.role = role;
      changes.after.role = role;
    }
  }
  if (isActive !== undefined) {
    changes.before.isActive = user.isActive;
    user.isActive = isActive;
    changes.after.isActive = isActive;
  }

  await user.save();

  // Log activity
  await activityService.logUserAction(
    req.userId,
    req.userRole,
    'user_updated',
    user._id,
    changes
  );

  res.json({
    success: true,
    message: 'User updated successfully',
    data: {
      user: {
        id: user._id,
        email: user.email,
        role: user.role,
        profile: user.profile,
        isActive: user.isActive,
      },
    },
  });
});

/**
 * @desc    Deactivate user
 * @route   PUT /api/users/:id/deactivate
 * @access  Private/Admin
 */
const deactivateUser = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id);

  if (!user) {
    throw new AppError('User not found', 404);
  }

  if (user._id.toString() === req.userId.toString()) {
    throw new AppError('You cannot deactivate your own account', 400);
  }

  user.isActive = false;
  user.refreshTokens = []; // Invalidate all sessions
  await user.save();

  // Log activity
  await activityService.logUserAction(
    req.userId,
    req.userRole,
    'user_deactivated',
    user._id
  );

  res.json({
    success: true,
    message: 'User deactivated successfully',
  });
});

/**
 * @desc    Reactivate user
 * @route   PUT /api/users/:id/reactivate
 * @access  Private/Admin
 */
const reactivateUser = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id);

  if (!user) {
    throw new AppError('User not found', 404);
  }

  user.isActive = true;
  await user.save();

  // Log activity
  await activityService.logUserAction(
    req.userId,
    req.userRole,
    'user_reactivated',
    user._id
  );

  res.json({
    success: true,
    message: 'User reactivated successfully',
  });
});

/**
 * @desc    Soft delete user
 * @route   DELETE /api/users/:id
 * @access  Private/Admin
 */
const deleteUser = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id);

  if (!user) {
    throw new AppError('User not found', 404);
  }

  if (user._id.toString() === req.userId.toString()) {
    throw new AppError('You cannot delete your own account', 400);
  }

  // Soft delete
  user.isDeleted = true;
  user.deletedAt = new Date();
  user.isActive = false;
  user.refreshTokens = [];
  await user.save();

  // Log activity
  await activityService.logUserAction(
    req.userId,
    req.userRole,
    'user_deleted',
    user._id
  );

  res.json({
    success: true,
    message: 'User deleted successfully',
  });
});

/**
 * @desc    Get users by role (for dropdowns/assignments)
 * @route   GET /api/users/role/:role
 * @access  Private/Staff
 */
const getUsersByRole = asyncHandler(async (req, res) => {
  const { role } = req.params;

  if (!Object.values(config.roles).includes(role)) {
    throw new AppError('Invalid role', 400);
  }

  const users = await User.find({ role, isActive: true })
    .select('_id email profile.firstName profile.lastName')
    .sort({ 'profile.firstName': 1 });

  res.json({
    success: true,
    data: { users },
  });
});

/**
 * @desc    Reset user password (admin only)
 * @route   PUT /api/users/:id/reset-password
 * @access  Private/Admin
 */
const resetUserPassword = asyncHandler(async (req, res) => {
  const { newPassword } = req.body;

  const user = await User.findById(req.params.id);

  if (!user) {
    throw new AppError('User not found', 404);
  }

  user.password = newPassword;
  user.refreshTokens = []; // Invalidate all sessions
  await user.save();

  // Log activity
  await activityService.logUserAction(
    req.userId,
    req.userRole,
    'user_updated',
    user._id,
    { after: { passwordReset: true } }
  );

  res.json({
    success: true,
    message: 'Password reset successfully',
  });
});

module.exports = {
  getUsers,
  getUser,
  createUser,
  updateUser,
  deactivateUser,
  reactivateUser,
  deleteUser,
  getUsersByRole,
  resetUserPassword,
};
