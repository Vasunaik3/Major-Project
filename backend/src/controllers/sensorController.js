import SensorReading from '../models/SensorReading.js';
import StorageCondition from '../models/StorageCondition.js';
import { ingestSensorReading } from '../services/sensorService.js';
import { isFiniteNumber, validateSensorPayload } from '../utils/validation.js';

export async function postSensorData(request, response) {
  const result = await ingestSensorReading(request.body);
  response.status(201).json(result);
}

export async function getLatestSensorData(request, response) {
  const filter = request.query.deviceId ? { deviceId: request.query.deviceId } : {};
  const reading = await SensorReading.findOne(filter).sort({ timestamp: -1, _id: -1 }).lean();
  const storageCondition = reading
    ? await StorageCondition.findOne({ sensorReading: reading._id }).lean()
    : null;
  response.json({ reading, storageCondition });
}

export async function getSensorHistory(request, response) {
  const { from, to, deviceId } = request.query;
  const limit = Number(request.query.limit ?? 100);
  if (!Number.isInteger(limit) || limit < 1 || limit > 1000) {
    return response.status(400).json({ error: 'limit must be an integer from 1 to 1000.' });
  }
  if ((from && Number.isNaN(Date.parse(from))) || (to && Number.isNaN(Date.parse(to)))) {
    return response.status(400).json({ error: 'from and to must be valid dates.' });
  }
  if (from && to && new Date(from) > new Date(to)) {
    return response.status(400).json({ error: 'from must be earlier than or equal to to.' });
  }

  const filter = {};
  if (deviceId) filter.deviceId = deviceId;
  if (from || to) {
    filter.timestamp = {};
    if (from) filter.timestamp.$gte = new Date(from);
    if (to) filter.timestamp.$lte = new Date(to);
  }
  const readings = await SensorReading.find(filter).sort({ timestamp: -1, _id: -1 }).limit(limit).lean();
  readings.reverse();
  response.json({ readings, count: readings.length });
}

export function validateSensorRequest(body) {
  return validateSensorPayload(body);
}

export function validateSensorQuery(query) {
  const errors = [];
  if (query.deviceId !== undefined && (typeof query.deviceId !== 'string' || !query.deviceId.trim())) {
    errors.push('deviceId must be a non-empty string.');
  }
  if (query.limit !== undefined && (!isFiniteNumber(Number(query.limit)) || !Number.isInteger(Number(query.limit)))) {
    errors.push('limit must be an integer.');
  }
  return errors;
}
