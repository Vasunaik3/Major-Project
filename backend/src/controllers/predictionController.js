import { listPredictions, predictionPlaceholderMessage } from '../services/predictionService.js';

export async function getPredictions(request, response) {
  const limit = Number(request.query.limit ?? 50);
  if (!Number.isInteger(limit) || limit < 1 || limit > 200) {
    return response.status(400).json({ error: 'limit must be an integer from 1 to 200.' });
  }
  response.json({
    analysisAvailable: false,
    message: predictionPlaceholderMessage,
    predictions: await listPredictions(limit),
  });
}
