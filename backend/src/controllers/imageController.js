import { unlink, readFile } from 'node:fs/promises';
import path from 'node:path';
import OnionImage from '../models/OnionImage.js';
import { matchesImageSignature, uploadDirectory } from '../middleware/imageUpload.js';

export const MODEL_UNAVAILABLE_MESSAGE =
  'AI analysis is unavailable because the model has not yet been trained.';

function statusMessage(status) {
  if (status === 'COMPLETED') return 'Image analysis completed.';
  if (status === 'PROCESSING') return 'Image analysis is processing.';
  if (status === 'PENDING') return 'Image is queued for analysis.';
  if (status === 'FAILED') return 'Image analysis failed.';
  return MODEL_UNAVAILABLE_MESSAGE;
}

function serializeImage(image) {
  const data = typeof image.toObject === 'function' ? image.toObject() : image;
  return {
    ...data,
    originalName: data.originalName || path.basename(data.imageUrl || 'onion-image'),
    mimeType: data.mimeType || null,
    sizeBytes: data.sizeBytes || null,
    uploadedAt: data.uploadedAt || data.createdAt,
    analysisStatus: data.analysisStatus === 'NOT_ANALYZED' ? 'MODEL_NOT_AVAILABLE' : data.analysisStatus,
    predictedClass: data.predictedClass ?? null,
    confidence: data.confidence ?? null,
    modelVersion: data.modelVersion ?? null,
    analyzedAt: data.analyzedAt ?? null,
  };
}

export async function uploadImage(request, response) {
  if (!request.file) return response.status(400).json({ error: 'Upload an image using the "image" form field.' });

  const imageBytes = await readFile(request.file.path);
  if (!matchesImageSignature(imageBytes, request.file.mimetype)) {
    await unlink(request.file.path).catch(() => {});
    return response.status(400).json({ error: 'The uploaded file contents do not match a supported image type.' });
  }

  try {
    const image = await OnionImage.create({
      imageUrl: `/uploads/${request.file.filename}`,
      originalName: path.basename(request.file.originalname).slice(0, 255),
      mimeType: request.file.mimetype,
      sizeBytes: request.file.size,
      uploadedAt: new Date(),
      analysisStatus: 'MODEL_NOT_AVAILABLE',
      predictedClass: null,
      confidence: null,
      modelVersion: null,
    });
    response.status(201).json({ image: serializeImage(image), message: MODEL_UNAVAILABLE_MESSAGE });
  } catch (error) {
    await unlink(path.join(uploadDirectory, request.file.filename)).catch(() => {});
    throw error;
  }
}

export async function listImages(request, response) {
  const limit = Number(request.query.limit ?? 50);
  if (!Number.isInteger(limit) || limit < 1 || limit > 200) {
    return response.status(400).json({ error: 'limit must be an integer from 1 to 200.' });
  }
  const allowedStatuses = ['PENDING', 'PROCESSING', 'COMPLETED', 'MODEL_NOT_AVAILABLE', 'FAILED'];
  if (request.query.status && !allowedStatuses.includes(request.query.status)) {
    return response.status(400).json({ error: `status must be one of: ${allowedStatuses.join(', ')}.` });
  }

  const filter = {};
  if (request.query.status === 'MODEL_NOT_AVAILABLE') {
    filter.analysisStatus = { $in: ['MODEL_NOT_AVAILABLE', 'NOT_ANALYZED'] };
  } else if (request.query.status) {
    filter.analysisStatus = request.query.status;
  }
  const images = await OnionImage.find(filter).sort({ uploadedAt: -1 }).limit(limit).lean();
  response.json({ images: images.map(serializeImage), count: images.length });
}

export async function getImage(request, response) {
  const image = await OnionImage.findById(request.params.id).lean();
  if (!image) return response.status(404).json({ error: 'Image not found.' });
  const serializedImage = serializeImage(image);
  response.json({ image: serializedImage, message: statusMessage(serializedImage.analysisStatus) });
}

export function getUploadedFile(request, response, next) {
  const { filename } = request.params;
  if (!filename || filename !== path.basename(filename)) {
    return response.status(404).json({ error: 'Image file not found.' });
  }
  response.sendFile(path.join(uploadDirectory, filename), (error) => {
    if (error && !response.headersSent) next(error);
  });
}
