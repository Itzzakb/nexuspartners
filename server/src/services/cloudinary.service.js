import { v2 as cloudinary } from 'cloudinary';

let configured = false;

export function configureCloudinary() {
  const { CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET } = process.env;
  if (CLOUDINARY_CLOUD_NAME && CLOUDINARY_API_KEY && CLOUDINARY_API_SECRET) {
    cloudinary.config({
      cloud_name: CLOUDINARY_CLOUD_NAME,
      api_key: CLOUDINARY_API_KEY,
      api_secret: CLOUDINARY_API_SECRET,
    });
    configured = true;
  }
}

export function isCloudinaryConfigured() {
  return configured;
}

export async function uploadBuffer(buffer, folder = 'nexuspartners', options = {}) {
  if (!configured) {
    throw new Error('Cloudinary is not configured');
  }

  const { resource_type = 'auto', format } = options;

  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder,
        resource_type,
        ...(format ? { format } : {}),
      },
      (error, result) => {
        if (error) reject(error);
        else resolve(result);
      }
    );
    stream.end(buffer);
  });
}

export async function deleteAsset(publicId) {
  if (!configured || !publicId) return;
  await cloudinary.uploader.destroy(publicId);
}
