/**
 * Admin Seed Script
 * Creates the initial admin user for the system
 * 
 * Usage: npm run seed:admin
 */

require('dotenv').config();
const mongoose = require('mongoose');
const config = require('../config');
const { User } = require('../models');

const adminData = {
  email: 'RMVadmin@gmail.com',
  password: 'RMVadminPassword13',
  role: 'admin',
  profile: {
    firstName: 'RMV',
    lastName: 'Administrator',
    phone: '+639123456789',
  },
  isEmailVerified: true,
  isActive: true,
};

const seedAdmin = async () => {
  try {
    // Connect to database
    await mongoose.connect(config.mongodbUri || 'mongodb://localhost:27017/rmv_fabrication');
    console.log('Connected to MongoDB');

    // Check if admin already exists (case-insensitive)
    const existingAdmin = await User.findOne({ 
      email: { $regex: new RegExp(`^${adminData.email}$`, 'i') }
    });
    
    if (existingAdmin) {
      // Update the existing admin with new password
      existingAdmin.email = adminData.email;
      existingAdmin.password = adminData.password;
      existingAdmin.profile = adminData.profile;
      await existingAdmin.save();
      console.log('');
      console.log('╔═══════════════════════════════════════════════════════════╗');
      console.log('║          Admin User Updated Successfully!                 ║');
      console.log('╠═══════════════════════════════════════════════════════════╣');
      console.log(`║  Email: ${adminData.email.padEnd(48)}║`);
      console.log(`║  Password: ${adminData.password.padEnd(45)}║`);
      console.log('╚═══════════════════════════════════════════════════════════╝');
      console.log('');
      process.exit(0);
    }

    // Create admin user
    const admin = await User.create(adminData);

    console.log('');
    console.log('╔═══════════════════════════════════════════════════════════╗');
    console.log('║          Admin User Created Successfully!                 ║');
    console.log('╠═══════════════════════════════════════════════════════════╣');
    console.log(`║  Email: ${adminData.email.padEnd(48)}║`);
    console.log(`║  Password: ${adminData.password.padEnd(45)}║`);
    console.log('║                                                           ║');
    console.log('║  ⚠️  IMPORTANT: Change this password after first login!   ║');
    console.log('╚═══════════════════════════════════════════════════════════╝');
    console.log('');

    process.exit(0);
  } catch (error) {
    console.error('Seed failed:', error);
    process.exit(1);
  }
};

seedAdmin();
