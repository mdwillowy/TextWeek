import multer from 'multer';
import crypto from 'crypto';
import { CloudinaryStorage } from 'multer-storage-cloudinary';
import { cloudinary } from '../services/cloudinaryService.js';

const storage = new CloudinaryStorage({
  cloudinary,
  params: () => ({
    folder: 'textweek/uploads',
    resource_type: 'image',
    public_id: `${Date.now()}-${crypto.randomUUID()}`,
  }),
});

function fileFilter(_req, file, cb) {
  if (!file.mimetype.startsWith('image/')) {
    cb(new Error('Only image uploads are allowed'));
    return;
  }
  cb(null, true);
}

const MAX_IMAGE_UPLOAD_BYTES = 3 * 1024 * 1024;

function createImageUpload(fileSizeBytes) {
  return multer({
    storage,
    fileFilter,
    limits: {
      fileSize: fileSizeBytes,
    },
  });
}

export const avatarUpload = createImageUpload(MAX_IMAGE_UPLOAD_BYTES);
export const chatImageUpload = createImageUpload(MAX_IMAGE_UPLOAD_BYTES);
