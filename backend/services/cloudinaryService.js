import { v2 as cloudinary } from 'cloudinary';
import { env } from '../config/env.js';

cloudinary.config({
  cloud_name: env.cloudinaryCloudName,
  api_key: env.cloudinaryApiKey,
  api_secret: env.cloudinaryApiSecret,
});

export { cloudinary };

export async function destroyCloudinaryImage(publicId, context = {}) {
  if (!publicId) return;
  try {
    await cloudinary.uploader.destroy(publicId, { resource_type: 'image' });
  } catch (err) {
    console.error('[admin] cloudinary_delete_failed', {
      publicId,
      context,
      error: err?.message || String(err),
    });
    throw err;
  }
}
