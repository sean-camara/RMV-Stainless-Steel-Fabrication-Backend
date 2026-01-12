const express = require('express');
const router = express.Router();
const { projectController } = require('../controllers');
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

// Get projects (role-filtered in controller)
router.get('/', projectController.getProjects);

// Engineer specific routes
router.get(
  '/pending/engineer',
  authorize(ROLES.ENGINEER),
  projectController.getPendingForEngineer
);

// Fabrication staff specific routes
router.get(
  '/fabrication',
  authorize(ROLES.FABRICATION_STAFF),
  projectController.getFabricationProjects
);

// Create project (sales staff)
router.post(
  '/',
  authorize(ROLES.SALES_STAFF, ROLES.ADMIN),
  validate(schemas.createProject),
  projectController.createProject
);

// Get single project
router.get('/:id', validate(schemas.mongoId, 'params'), projectController.getProject);

// Update consultation data (sales staff)
router.put(
  '/:id/consultation',
  authorize(ROLES.SALES_STAFF),
  validate(schemas.mongoId, 'params'),
  projectController.updateConsultation
);

// Upload consultation photos
router.post(
  '/:id/consultation/photos',
  authorize(ROLES.SALES_STAFF),
  validate(schemas.mongoId, 'params'),
  upload.uploadConsultationPhotos,
  projectController.uploadConsultationPhotos
);

// Submit to engineer
router.put(
  '/:id/submit-to-engineer',
  authorize(ROLES.SALES_STAFF, ROLES.ADMIN),
  validate(schemas.mongoId, 'params'),
  projectController.submitToEngineer
);

// Upload blueprint (engineer)
router.post(
  '/:id/blueprint',
  authorize(ROLES.ENGINEER),
  validate(schemas.mongoId, 'params'),
  upload.uploadBlueprint,
  projectController.uploadBlueprint
);

// Upload costing (engineer)
router.post(
  '/:id/costing',
  authorize(ROLES.ENGINEER),
  validate(schemas.mongoId, 'params'),
  upload.uploadCosting,
  projectController.uploadCosting
);

// Submit for customer approval (engineer)
router.put(
  '/:id/submit-for-approval',
  authorize(ROLES.ENGINEER),
  validate(schemas.mongoId, 'params'),
  projectController.submitForApproval
);

// Customer approve project
router.put(
  '/:id/approve',
  authorize(ROLES.CUSTOMER),
  validate(schemas.mongoId, 'params'),
  projectController.approveProject
);

// Customer request revision
router.put(
  '/:id/request-revision',
  authorize(ROLES.CUSTOMER),
  validate(schemas.mongoId, 'params'),
  projectController.requestRevision
);

// Update project status (staff)
router.put(
  '/:id/status',
  authorize(
    ROLES.ADMIN,
    ROLES.SALES_STAFF,
    ROLES.ENGINEER,
    ROLES.CASHIER,
    ROLES.FABRICATION_STAFF
  ),
  validate(schemas.mongoId, 'params'),
  validate(schemas.updateProjectStatus),
  projectController.updateProjectStatus
);

// Assign fabrication staff (admin)
router.put(
  '/:id/assign-fabrication',
  authorize(ROLES.ADMIN),
  validate(schemas.mongoId, 'params'),
  projectController.assignFabricationStaff
);

// Update fabrication progress
router.put(
  '/:id/fabrication/progress',
  authorize(ROLES.FABRICATION_STAFF, ROLES.ADMIN),
  validate(schemas.mongoId, 'params'),
  projectController.updateFabricationProgress
);

// Upload fabrication photo
router.post(
  '/:id/fabrication/photo',
  authorize(ROLES.FABRICATION_STAFF),
  validate(schemas.mongoId, 'params'),
  upload.uploadFabricationPhoto,
  projectController.uploadFabricationPhoto
);

module.exports = router;
