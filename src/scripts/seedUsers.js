/**
 * Seed script to create test users for all roles
 * Run with: node src/scripts/seedUsers.js
 */

require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const config = require('../config');

// Connect using the same URI
const MONGODB_URI = process.env.MONGODB_URI || config.mongodbUri;

const testUsers = [
  {
    email: 'customer@rmv.com',
    password: 'password123',
    firstName: 'Juan',
    lastName: 'Dela Cruz',
    phone: '09171234567',
    role: 'customer',
  },
  {
    email: 'agent@rmv.com',
    password: 'password123',
    firstName: 'Maria',
    lastName: 'Santos',
    phone: '09181234567',
    role: 'appointment_agent',
  },
  {
    email: 'sales@rmv.com',
    password: 'password123',
    firstName: 'Pedro',
    lastName: 'Reyes',
    phone: '09191234567',
    role: 'sales_staff',
  },
  {
    email: 'engineer@rmv.com',
    password: 'password123',
    firstName: 'Jose',
    lastName: 'Garcia',
    phone: '09201234567',
    role: 'engineer',
  },
  {
    email: 'cashier@rmv.com',
    password: 'password123',
    firstName: 'Ana',
    lastName: 'Lopez',
    phone: '09211234567',
    role: 'cashier',
  },
  {
    email: 'fabrication@rmv.com',
    password: 'password123',
    firstName: 'Carlos',
    lastName: 'Mendoza',
    phone: '09221234567',
    role: 'fabrication_staff',
  },
  {
    email: 'admin@rmv.com',
    password: 'password123',
    firstName: 'Admin',
    lastName: 'User',
    phone: '09231234567',
    role: 'admin',
  },
];

async function seedUsers() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('Connected!\n');

    // Get the users collection directly
    const db = mongoose.connection.db;
    const usersCollection = db.collection('users');

    console.log('Deleting existing test users...\n');
    
    // Delete existing test users
    const testEmails = testUsers.map(u => u.email);
    await usersCollection.deleteMany({ email: { $in: testEmails } });

    console.log('Creating test users...\n');

    for (const userData of testUsers) {
      // Hash password
      const hashedPassword = await bcrypt.hash(userData.password, 12);

      // Create user with correct schema structure
      const user = {
        email: userData.email,
        password: hashedPassword,
        role: userData.role,
        profile: {
          firstName: userData.firstName,
          lastName: userData.lastName,
          phone: userData.phone,
        },
        isActive: true,
        isEmailVerified: true, // Pre-verified for testing
        emailVerification: {},
        passwordReset: {},
        refreshTokens: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      await usersCollection.insertOne(user);
      console.log(`✅ Created: ${userData.email} (${userData.role})`);
    }

    console.log('\n========================================');
    console.log('TEST ACCOUNTS CREATED SUCCESSFULLY!');
    console.log('========================================\n');
    console.log('All accounts use password: password123\n');
    console.log('Login credentials:');
    console.log('------------------');
    testUsers.forEach((u) => {
      console.log(`${u.role.padEnd(20)} -> ${u.email}`);
    });
    console.log('\n');

  } catch (error) {
    console.error('Error seeding users:', error);
  } finally {
    await mongoose.connection.close();
    console.log('Database connection closed.');
  }
}

seedUsers();
