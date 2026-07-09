import multer from 'multer';
import { uploadBuffer, isCloudinaryConfigured } from '../services/cloudinary.service.js';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
});

export const uploadMiddleware = upload.single('file');

export async function uploadFile(req, res) {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    if (!isCloudinaryConfigured()) {
      return res.status(503).json({
        error: 'File upload is not configured. Add Cloudinary credentials to .env',
      });
    }

    const folder = req.body.folder || 'nexuspartners';
    const result = await uploadBuffer(req.file.buffer, folder);

    return res.json({
      url: result.secure_url,
      publicId: result.public_id,
      resourceType: result.resource_type,
    });
  } catch (err) {
    console.error('Upload error:', err);
    return res.status(500).json({ error: 'Upload failed' });
  }
}
