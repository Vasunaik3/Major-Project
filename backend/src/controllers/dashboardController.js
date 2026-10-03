import Alert from '../models/Alert.js';
import SensorReading from '../models/SensorReading.js';
import StorageCondition from '../models/StorageCondition.js';
import { getFanStatus } from '../services/fanService.js';
import { getStorageThresholds } from '../services/storageConditionService.js';
import { getSensorSimulatorStatus } from '../simulator/sensorSimulator.js';

export async function dashboardSummary(_request, response) {
  const [latestReading, latestCondition, fan, activeAlertCount] = await Promise.all([
    SensorReading.findOne().sort({ timestamp: -1, _id: -1 }).lean(),
    StorageCondition.findOne().sort({ timestamp: -1, _id: -1 }).lean(),
    getFanStatus(),
    Alert.countDocuments({ resolved: false }),
  ]);
  response.json({
    latestReading,
    storageCondition: latestCondition,
    fan,
    activeAlertCount,
    storageThresholds: getStorageThresholds(),
    simulator: getSensorSimulatorStatus(),
  });
}
