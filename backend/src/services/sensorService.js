import SensorReading from '../models/SensorReading.js';
import { evaluateAlerts } from './alertService.js';
import { recordAutomaticFanState } from './fanService.js';
import { recordStorageCondition } from './storageConditionService.js';

export async function ingestSensorReading(payload) {
  const reading = await SensorReading.create({
    deviceId: payload.deviceId.trim(),
    temperature: payload.temperature,
    humidity: payload.humidity,
    gasLevel: payload.gasLevel,
    timestamp: payload.timestamp ? new Date(payload.timestamp) : new Date(),
    source: payload.source === 'HARDWARE' ? 'HARDWARE' : 'SIMULATED',
  });

  const [storageCondition, fanActivity, alertChanges] = await Promise.all([
    recordStorageCondition(reading),
    recordAutomaticFanState(reading),
    evaluateAlerts(reading),
  ]);

  return {
    reading,
    storageCondition,
    fanActivity,
    alerts: alertChanges.created,
    resolvedAlerts: alertChanges.resolved,
  };
}
