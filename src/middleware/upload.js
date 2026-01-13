const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const config = require('../config');

// Ensure upload directory exists before writing
const ensureDir = (dirPath) => {
  const absolute = path.isAbsolute(dirPath) ? dirPath : path.join(process.cwd(), dirPath);
  if (!fs.existsSync(absolute)) {
    fs.mkdirSync(absolute, { recursive: true });
  }
  return absolute;
};

// Storage configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    let uploadPath = `${config.upload.basePath}/`;

    // Determine subfolder based on field name
    switch (file.fieldname) {
      case 'blueprint':
      case 'costing':
        uploadPath += 'blueprints/';
        break;
      case 'photo':
      case 'photos':
      case 'consultationPhoto':
      case 'fabricationPhoto':
      case 'installationPhoto':
        uploadPath += 'photos/';
        break;
      case 'paymentProof':
        uploadPath += 'payments/';
        break;
      case 'qrCode':
        uploadPath += 'qrcodes/';
        break;
      default:
        uploadPath += 'misc/';
    }

    ensureDir(uploadPath);
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    const uniqueId = uuidv4();
    const ext = path.extname(file.originalname);
    const filename = `${uniqueId}${ext}`;
    cb(null, filename);
  },
});

// File filter
const fileFilter = (req, file, cb) => {
  const allowedImageTypes = ['image/jpeg', 'image/jpg', 'image/png'];
  const allowedPdfTypes = ['application/pdf'];
  const allowedTypes = [...allowedImageTypes, ...allowedPdfTypes];

  if (file.fieldname === 'blueprint' || file.fieldname === 'costing') {
    // Only PDF for blueprints and costing
    if (!allowedPdfTypes.includes(file.mimetype)) {
      const error = new Error('Only PDF files are allowed for blueprints and costing');
      error.code = 'INVALID_FILE_TYPE';
      return cb(error, false);
    }
  } else if (
    file.fieldname === 'paymentProof' ||
    file.fieldname === 'photo' ||
    file.fieldname === 'photos' ||
    file.fieldname === 'consultationPhoto' ||
    file.fieldname === 'fabricationPhoto' ||
    file.fieldname === 'installationPhoto' ||
    file.fieldname === 'qrCode'
  ) {
    // Images and PDFs for proofs and photos
    if (!allowedTypes.includes(file.mimetype)) {
      const error = new Error('Only JPG, PNG, and PDF files are allowed');
      error.code = 'INVALID_FILE_TYPE';
      return cb(error, false);
    }
  } else {
    if (!allowedTypes.includes(file.mimetype)) {
      const error = new Error('Invalid file type');
      error.code = 'INVALID_FILE_TYPE';
      return cb(error, false);
    }
  }

  cb(null, true);
};

// Multer upload configurations
const uploadImage = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: config.upload.maxSizeImage,
  },
});

const uploadPdf = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: config.upload.maxSizePdf,
  },
});

const uploadAny = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: config.upload.maxSizePdf, // Use larger limit
  },
});

// Export specific upload middlewares
module.exports = {
  uploadBlueprint: uploadPdf.single('blueprint'),
  uploadCosting: uploadPdf.single('costing'),
  uploadPaymentProof: uploadImage.single('paymentProof'),
  uploadQrCode: uploadImage.single('qrCode'),
  uploadConsultationPhotos: uploadImage.array('consultationPhoto', 10),
  uploadFabricationPhoto: uploadImage.single('fabricationPhoto'),
  uploadInstallationPhoto: uploadImage.single('installationPhoto'),
  uploadSingle: uploadAny.single('file'),
  uploadMultiple: uploadAny.array('files', 10),
};
