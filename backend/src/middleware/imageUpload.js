import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import multer from 'multer';

const moduleDirectory = path.dirname(fileURLToPath(import.meta.url));
export const uploadDirectory = path.resolve(moduleDirectory, '../../uploads');
fs.mkdirSync(uploadDirectory, { recursive: true });

const extensions = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp' };
const storage = multer.diskStorage({
  destination: (_request, _file, callback) => callback(null, uploadDirectory),
  filename: (_request, file, callback) => callback(null, `${crypto.randomUUID()}${extensions[file.mimetype]}`),
});

export const imageUpload = multer({
  storage,
  limits: { fileSize: Number(process.env.IMAGE_MAX_SIZE_MB || 5) * 1024 * 1024 },
  fileFilter: (_request, file, callback) => {
    if (!extensions[file.mimetype]) {
      const error = new Error('Only JPEG, PNG, and WebP images are accepted.');
      error.status = 400;
      return callback(error);
    }
    callback(null, true);
  },
});

export function matchesImageSignature(buffer, mimeType) {
  if (!Buffer.isBuffer(buffer)) return false;
  if (mimeType === 'image/jpeg') return buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  if (mimeType === 'image/png') return buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  if (mimeType === 'image/webp') return buffer.length >= 12 && buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP';
  return false;
}
