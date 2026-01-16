# RMV Stainless Steel Fabrication - Backend

RESTful API backend for RMV Stainless Steel Fabrication company. Built with Node.js, Express, and MongoDB.

## 🚀 Features

### Authentication & Authorization
- JWT-based authentication
- Email verification system
- Password reset with email tokens
- Role-based access control (RBAC)
- Secure password hashing with bcrypt

### User Management
- User registration and login
- Multiple user roles support
- Profile management
- Admin user management

### Appointment System
- Customer appointment booking
- Appointment assignment to sales staff
- Status tracking (pending, assigned, confirmed, completed, cancelled, no_show)
- Date and time slot management

### Project Management
- Project creation from appointments
- Project status workflow
- Blueprint management
- Cost tracking

### Payment System
- Payment creation and tracking
- Multiple payment types (downpayment, progress, final)
- Payment status management
- Receipt generation

### Activity Logging
- Comprehensive activity tracking
- User action logging
- Audit trail for compliance

### Email Service
- Verification emails
- Password reset emails
- Appointment confirmations
- Payment notifications

## 🛠️ Tech Stack

- **Node.js** - Runtime environment
- **Express.js** - Web framework
- **MongoDB** - Database
- **Mongoose** - ODM for MongoDB
- **JWT** - Authentication tokens
- **bcryptjs** - Password hashing
- **Nodemailer** - Email sending
- **Multer** - File uploads
- **express-validator** - Input validation
- **cors** - Cross-origin resource sharing
- **helmet** - Security headers
- **morgan** - HTTP request logging

## 📁 Project Structure

```
backend/
├── src/
│   ├── config/
│   │   ├── database.js          # MongoDB connection
│   │   └── index.js             # Environment config
│   ├── controllers/
│   │   ├── adminController.js   # Admin operations
│   │   ├── appointmentController.js
│   │   ├── authController.js    # Auth operations
│   │   ├── paymentController.js
│   │   ├── projectController.js
│   │   ├── userController.js
│   │   └── index.js
│   ├── middleware/
│   │   ├── auth.js              # JWT verification
│   │   ├── error.js             # Error handling
│   │   ├── rbac.js              # Role-based access
│   │   ├── upload.js            # File upload config
│   │   ├── validate.js          # Request validation
│   │   └── index.js
│   ├── models/
│   │   ├── ActivityLog.js
│   │   ├── Appointment.js
│   │   ├── Payment.js
│   │   ├── Project.js
│   │   ├── User.js
│   │   └── index.js
│   ├── routes/
│   │   ├── adminRoutes.js
│   │   ├── appointmentRoutes.js
│   │   ├── authRoutes.js
│   │   ├── paymentRoutes.js
│   │   ├── projectRoutes.js
│   │   ├── userRoutes.js
│   │   └── index.js
│   ├── scripts/
│   │   └── seedUsers.js         # Database seeding
│   ├── seeds/
│   │   └── adminSeed.js         # Admin user seed
│   ├── services/
│   │   ├── activityService.js   # Activity logging
│   │   ├── emailService.js      # Email sending
│   │   ├── tokenService.js      # JWT operations
│   │   └── index.js
│   ├── app.js                   # Express app setup
│   └── server.js                # Server entry point
├── Dockerfile                   # Docker configuration
├── mongo-init.js                # MongoDB initialization
└── package.json
```


## 🚀 Getting Started

### Prerequisites / First-time Setup

- **Node.js 18+** (LTS recommended)
- **MongoDB**: Use **MongoDB Atlas** (recommended) or local MongoDB 6+
- **npm** (or yarn)
- **Git**

### 1. Clone the repository
```bash
git clone https://github.com/sean-camara/RMV-Stainless-Steel-Fabrication-Backend.git
cd RMV-Stainless-Steel-Fabrication-Backend
```

### 2. Install dependencies
```bash
npm install
```

### 3. Environment Setup

- Copy `.env.example` to `.env` and fill in the required values:

  - **MONGODB_URI** (required): Your MongoDB Atlas connection string (see below)
  - **JWT_SECRET** and **JWT_REFRESH_SECRET** (required): Set strong secrets
  - **SMTP_***: For email sending (Gmail SMTP supported)

**Minimal example:**
```env
PORT=5000
MONGODB_URI=mongodb+srv://<user>:<pass>@cluster0.mongodb.net/rmv?retryWrites=true&w=majority
JWT_SECRET=your-super-secret-jwt-key
JWT_REFRESH_SECRET=your-super-secret-refresh-key
```

> **Note:**
> - The backend will **fail to start** if `MONGODB_URI` is missing or invalid.
> - If you use a different variable name (like `MONGO_URI`), it will be ignored.
> - Local MongoDB is optional; Atlas is recommended for most users.

### 4. Start MongoDB

- **Atlas:** No action needed (cloud-hosted)
- **Local:**
  ```bash
  mongod
  ```

### 5. Seed the database (optional)
```bash
npm run seed
```
Creates a default admin user:
- Email: `admin@rmvsteel.com`
- Password: `Admin123!`

### 6. Start the development server
```bash
npm run dev
```

> **Windows users:**
> - **Do NOT double-click `server.js`** (this triggers a Windows Script Host error)
> - **Always start the backend using `npm run dev`**

### 7. Server will run on
`http://localhost:5000`

---

### MongoDB Atlas Setup

1. Go to [MongoDB Atlas](https://www.mongodb.com/cloud/atlas) and create a free cluster.
2. Create a database user and password.
3. Whitelist your IP address.
4. Copy the connection string and set it as `MONGODB_URI` in your `.env` file.

---

### Configuration Flow

```
server.js
  → config/database.js
   → config/index.js
    → .env
```

All environment variables are loaded from `.env` via `config/index.js`. MongoDB connection is managed in `config/database.js`.

If `MONGODB_URI` is missing, the backend will **not** fall back to localhost and will fail fast with an error.

### Production Deployment

```bash
npm start
```

## 📚 API Endpoints

### Authentication
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/register` | Register new user |
| POST | `/api/auth/login` | User login |
| POST | `/api/auth/verify-email` | Verify email address |
| POST | `/api/auth/forgot-password` | Request password reset |
| POST | `/api/auth/reset-password` | Reset password |
| GET | `/api/auth/me` | Get current user |

### Users
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/users` | Get all users (admin) |
| GET | `/api/users/:id` | Get user by ID |
| PUT | `/api/users/:id` | Update user |
| DELETE | `/api/users/:id` | Delete user (admin) |
| PUT | `/api/users/profile` | Update own profile |

### Appointments
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/appointments` | Get appointments |
| POST | `/api/appointments` | Create appointment |
| GET | `/api/appointments/:id` | Get appointment by ID |
| PUT | `/api/appointments/:id` | Update appointment |
| DELETE | `/api/appointments/:id` | Delete appointment |
| PUT | `/api/appointments/:id/assign` | Assign to staff |
| PUT | `/api/appointments/:id/status` | Update status |

### Projects
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/projects` | Get projects |
| POST | `/api/projects` | Create project |
| GET | `/api/projects/:id` | Get project by ID |
| PUT | `/api/projects/:id` | Update project |
| DELETE | `/api/projects/:id` | Delete project |
| PUT | `/api/projects/:id/status` | Update status |

### Payments
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/payments` | Get payments |
| POST | `/api/payments` | Create payment |
| GET | `/api/payments/:id` | Get payment by ID |
| PUT | `/api/payments/:id` | Update payment |
| PUT | `/api/payments/:id/verify` | Verify payment |

### Admin
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/admin/stats` | Get dashboard stats |
| GET | `/api/admin/users` | Get all users |
| POST | `/api/admin/users` | Create user |
| GET | `/api/admin/activity-logs` | Get activity logs |
| GET | `/api/admin/reports` | Get reports data |

## 🔐 User Roles & Permissions

| Role | Permissions |
|------|-------------|
| `customer` | Book appointments, view own projects/payments |
| `appointment_agent` | Manage all appointments, assign to staff |
| `sales_staff` | Handle assigned appointments, create projects |
| `engineer` | Manage blueprints, update project specs |
| `cashier` | Process and verify payments |
| `fabrication_staff` | Update fabrication status |
| `admin` | Full system access |

## 🗄️ Database Models

### User
```javascript
{
  firstName: String,
  lastName: String,
  email: String (unique),
  password: String (hashed),
  role: String (enum),
  isVerified: Boolean,
  verificationToken: String,
  resetPasswordToken: String,
  resetPasswordExpires: Date,
  createdAt: Date,
  updatedAt: Date
}
```

### Appointment
```javascript
{
  customer: ObjectId (ref: User),
  assignedTo: ObjectId (ref: User),
  date: Date,
  timeSlot: String,
  serviceType: String,
  description: String,
  status: String (enum),
  notes: String,
  createdAt: Date,
  updatedAt: Date
}
```

### Project
```javascript
{
  customer: ObjectId (ref: User),
  appointment: ObjectId (ref: Appointment),
  name: String,
  description: String,
  specifications: Object,
  estimatedCost: Number,
  finalCost: Number,
  status: String (enum),
  assignedEngineer: ObjectId (ref: User),
  blueprints: Array,
  startDate: Date,
  estimatedEndDate: Date,
  actualEndDate: Date,
  createdAt: Date,
  updatedAt: Date
}
```

### Payment
```javascript
{
  project: ObjectId (ref: Project),
  customer: ObjectId (ref: User),
  amount: Number,
  type: String (downpayment/progress/final),
  status: String (pending/verified/rejected),
  referenceNumber: String,
  proofOfPayment: String,
  verifiedBy: ObjectId (ref: User),
  verifiedAt: Date,
  notes: String,
  createdAt: Date,
  updatedAt: Date
}
```

### ActivityLog
```javascript
{
  user: ObjectId (ref: User),
  action: String,
  resource: String,
  resourceId: ObjectId,
  details: Object,
  ipAddress: String,
  userAgent: String,
  createdAt: Date
}
```

## 🐳 Docker Deployment

### Using Docker Compose (with MongoDB)

```yaml
# docker-compose.yml in parent directory
version: '3.8'
services:
  backend:
    build: ./backend
    ports:
      - "5000:5000"
    environment:
      - MONGODB_URI=mongodb://mongo:27017/rmv_fabrication
    depends_on:
      - mongo
  
  mongo:
    image: mongo:6
    ports:
      - "27017:27017"
    volumes:
      - mongo_data:/data/db

volumes:
  mongo_data:
```

```bash
docker-compose up -d
```

## 🔧 Development Scripts

```bash
# Start development server with nodemon
npm run dev

# Start production server
npm start

# Seed database with admin user
npm run seed

# Run linter
npm run lint
```

## 🐛 Troubleshooting

### Common Issues

1. **MongoDB connection errors**
   - Ensure MongoDB is running
   - Check connection string in `.env`
   - For Atlas, whitelist your IP

2. **Email sending fails**
   - Enable "Less secure app access" or use App Password for Gmail
   - Check SMTP credentials in `.env`

3. **JWT errors**
   - Ensure `JWT_SECRET` is set in `.env`
   - Check token expiration

4. **CORS errors**
   - Frontend URL must match `FRONTEND_URL` in `.env`
   - Check CORS configuration in `app.js`

## 📄 License

This project is proprietary software for RMV Stainless Steel Fabrication.

## 👥 Contributors

- Development Team

---

**Frontend Repository**: [RMV-Stainless-Steel-Fabrication](https://github.com/YOUR_USERNAME/RMV-Stainless-Steel-Fabrication)
