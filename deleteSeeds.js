const mongoose = require('mongoose');
require('dotenv').config();

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);
  
  const result = await mongoose.connection.db.collection('users').deleteMany({
    email: {
      $in: [
        'customer@rmv.com',
        'agent@rmv.com',
        'sales@rmv.com',
        'engineer@rmv.com',
        'cashier@rmv.com',
        'fabrication@rmv.com',
        'admin@rmv.com'
      ]
    }
  });
  
  console.log('Deleted', result.deletedCount, 'seed users');
  await mongoose.disconnect();
}

run().catch(console.error);
