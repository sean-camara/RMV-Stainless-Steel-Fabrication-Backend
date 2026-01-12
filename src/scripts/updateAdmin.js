const mongoose = require('mongoose');
require('dotenv').config();

async function updateAdmin() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/rmv');
    console.log('Connected to MongoDB');

    // First, list all admin users
    const admins = await mongoose.connection.db.collection('users').find({ role: 'admin' }).toArray();
    console.log('Admin users found:', admins.length);
    admins.forEach(admin => {
      console.log('- Email:', admin.email, '| firstName:', admin.firstName, '| lastName:', admin.lastName);
    });

    // Update all admin users that are missing firstName or lastName
    const result = await mongoose.connection.db.collection('users').updateMany(
      { role: 'admin', $or: [{ firstName: { $exists: false } }, { lastName: { $exists: false } }, { firstName: null }, { lastName: null }, { firstName: '' }, { lastName: '' }] },
      { $set: { firstName: 'Sean John', lastName: 'Camara' } }
    );

    console.log('Updated:', result.modifiedCount, 'user(s)');

    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  }
}

updateAdmin();
