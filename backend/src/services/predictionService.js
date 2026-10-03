import Prediction from '../models/Prediction.js';

export const predictionPlaceholderMessage =
  'AI analysis module will be integrated after dataset collection and model training.';

export async function listPredictions(limit = 50) {
  return Prediction.find()
    .sort({ timestamp: -1, _id: -1 })
    .limit(limit)
    .populate('imageId', 'imageUrl uploadedAt analysisStatus')
    .lean();
}

// Future integration point: call a Python FastAPI inference service here, then persist its
// result in Prediction. The current software prototype intentionally performs no inference.
