import { Router } from 'express';
import { getLatestSensorData, getSensorHistory, postSensorData, validateSensorQuery, validateSensorRequest } from '../controllers/sensorController.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { requireRole } from '../middleware/requireRole.js';
import { sensorIngestAuth } from '../middleware/sensorIngestAuth.js';
import { validateBody } from '../utils/validation.js';

const router = Router();
router.post('/data', sensorIngestAuth, validateBody(validateSensorRequest), postSensorData);
router.get('/latest', requireAuth, requireRole('ADMIN', 'OPERATOR', 'VIEWER'), getLatestSensorData);
router.get('/history', requireAuth, requireRole('ADMIN', 'OPERATOR', 'VIEWER'), (request, response, next) => {
  const errors = validateSensorQuery(request.query);
  if (errors.length) return response.status(400).json({ error: 'Validation failed', details: errors });
  next();
}, getSensorHistory);

export default router;
