// MongoDB initialization script
// This runs when the container is first created

db = db.getSiblingDB('rmv_fabrication');

// Create collections with validation
db.createCollection('users', {
  validator: {
    $jsonSchema: {
      bsonType: 'object',
      required: ['email', 'password', 'role', 'isActive'],
      properties: {
        email: {
          bsonType: 'string',
          description: 'Email is required'
        },
        role: {
          enum: ['customer', 'appointment_agent', 'sales_staff', 'engineer', 'cashier', 'fabrication_staff', 'admin'],
          description: 'Role must be a valid role'
        },
        isActive: {
          bsonType: 'bool',
          description: 'Active status is required'
        }
      }
    }
  }
});

// Create indexes
db.users.createIndex({ email: 1 }, { unique: true });
db.users.createIndex({ role: 1 });
db.users.createIndex({ isActive: 1 });

db.appointments.createIndex({ scheduledDate: 1 });
db.appointments.createIndex({ assignedSalesStaff: 1 });
db.appointments.createIndex({ status: 1 });
db.appointments.createIndex({ customer: 1 });

db.projects.createIndex({ projectNumber: 1 }, { unique: true });
db.projects.createIndex({ customer: 1 });
db.projects.createIndex({ status: 1 });
db.projects.createIndex({ category: 1 });

db.payments.createIndex({ project: 1 });
db.payments.createIndex({ stage: 1 });
db.payments.createIndex({ status: 1 });

db.activitylogs.createIndex({ userId: 1 });
db.activitylogs.createIndex({ action: 1 });
db.activitylogs.createIndex({ createdAt: -1 });

print('MongoDB initialization completed successfully');
