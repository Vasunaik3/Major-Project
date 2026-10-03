import SensorReading from '../models/SensorReading.js';
import StorageCondition from '../models/StorageCondition.js';
import { getSystemSettings, loadSystemSettings, saveSystemSettings } from './systemSettingsService.js';

const sensorDefinitions = {
  temperature: {
    label: 'Temperature',
    unit: '°C',
    lowWarning: ['STORAGE_TEMP_WARNING_LOW_C', 25],
    highWarning: ['STORAGE_TEMP_WARNING_HIGH_C', 30],
    lowCritical: ['STORAGE_TEMP_CRITICAL_LOW_C', 23],
    highCritical: ['STORAGE_TEMP_CRITICAL_HIGH_C', 34],
  },
  humidity: {
    label: 'Humidity',
    unit: '%',
    lowWarning: ['STORAGE_HUMIDITY_WARNING_LOW_PERCENT', 55],
    highWarning: ['STORAGE_HUMIDITY_WARNING_HIGH_PERCENT', 75],
    lowCritical: ['STORAGE_HUMIDITY_CRITICAL_LOW_PERCENT', 45],
    highCritical: ['STORAGE_HUMIDITY_CRITICAL_HIGH_PERCENT', 85],
  },
  gasLevel: {
    label: 'Gas level',
    unit: 'index',
    lowWarning: ['STORAGE_GAS_WARNING_LOW_LEVEL', 100],
    highWarning: ['STORAGE_GAS_WARNING_HIGH_LEVEL', 300],
    lowCritical: ['STORAGE_GAS_CRITICAL_LOW_LEVEL', 50],
    highCritical: ['STORAGE_GAS_CRITICAL_HIGH_LEVEL', 500],
  },
};

function classifyValue(value, limits) {
  if (value <= limits.lowCritical || value >= limits.highCritical) return 'CRITICAL';
  if (value < limits.lowWarning || value > limits.highWarning) return 'WARNING';
  return 'NORMAL';
}

export function getStorageThresholds() {
  return getSystemSettings().thresholds;
}

export async function loadStorageThresholds() {
  return (await loadSystemSettings()).thresholds;
}

export async function updateStorageThresholds(thresholds, updatedBy) {
  const current = getSystemSettings();
  const updated = await saveSystemSettings({ ...current, thresholds }, updatedBy);
  return updated.thresholds;
}

/** Classify a single reading. Keeps evaluation separate from persistence for reuse/testing. */
export function evaluateStorageCondition(reading) {
  const thresholds = getStorageThresholds();
  const temperatureStatus = classifyValue(reading.temperature, thresholds.temperature);
  const humidityStatus = classifyValue(reading.humidity, thresholds.humidity);
  const gasStatus = classifyValue(reading.gasLevel, thresholds.gasLevel);
  const statuses = { temperatureStatus, humidityStatus, gasStatus };
  const metricNames = { temperatureStatus: 'temperature', humidityStatus: 'humidity', gasStatus: 'gasLevel' };
  const abnormalMetrics = Object.entries(statuses)
    .filter(([, status]) => status !== 'NORMAL')
    .map(([key, status]) => ({ metric: metricNames[key], status }));
  const criticalMetrics = abnormalMetrics.filter(({ status }) => status === 'CRITICAL');
  const warningMetrics = abnormalMetrics.filter(({ status }) => status === 'WARNING');

  let status = 'NORMAL';
  let message = 'Storage conditions are suitable';
  if (criticalMetrics.length > 0) {
    status = 'CRITICAL';
    message = `Critical ${criticalMetrics.map(({ metric }) => sensorDefinitions[metric].label.toLowerCase()).join(', ')} level detected`;
  } else if (warningMetrics.length >= 2) {
    status = 'CRITICAL';
    message = 'Multiple storage parameters are outside preferred ranges';
  } else if (warningMetrics.length === 1) {
    status = 'WARNING';
    message = `${sensorDefinitions[warningMetrics[0].metric].label} is outside the preferred range`;
  }

  return {
    status,
    message,
    ...statuses,
    abnormalMetrics,
    sustainedMetrics: [],
    thresholds,
  };
}

function abnormalStreakDuration(readings, metric, limits, maxGapMs) {
  let streakStart = null;
  let previousTimestamp = null;
  let count = 0;

  for (const reading of readings) {
    const currentTime = new Date(reading.timestamp).getTime();
    if (previousTimestamp !== null && currentTime - previousTimestamp > maxGapMs) {
      streakStart = null;
      count = 0;
    }
    previousTimestamp = currentTime;

    if (classifyValue(reading[metric], limits) === 'NORMAL') {
      streakStart = null;
      count = 0;
      continue;
    }
    if (streakStart === null) streakStart = currentTime;
    count += 1;
  }
  return streakStart === null ? null : { durationMs: previousTimestamp - streakStart, count };
}

async function findSustainedMetrics(reading, evaluation) {
  const durationMs = Math.max(0, Number(process.env.STORAGE_ABNORMAL_SUSTAINED_MS) || 60_000);
  if (durationMs === 0 || evaluation.abnormalMetrics.length === 0) return [];

  const intervalMs = getSystemSettings().simulator.intervalMs;
  const maxGapMs = Math.max(intervalMs * 2, Number(process.env.STORAGE_MAX_READING_GAP_MS) || 15_000);
  const minimumReadings = Math.max(2, Math.floor(Number(process.env.STORAGE_ABNORMAL_MIN_READINGS) || 3));
  const start = new Date(new Date(reading.timestamp).getTime() - durationMs - maxGapMs);
  const history = await SensorReading.find({
    deviceId: reading.deviceId,
    timestamp: { $gte: start, $lte: reading.timestamp },
  })
    .sort({ timestamp: 1, _id: 1 })
    .limit(2000)
    .select('temperature humidity gasLevel timestamp')
    .lean();

  return evaluation.abnormalMetrics.flatMap(({ metric }) => {
    const streak = abnormalStreakDuration(history, metric, evaluation.thresholds[metric], maxGapMs);
    return streak && streak.durationMs >= durationMs && streak.count >= minimumReadings
      ? [{ metric, durationMs: streak.durationMs, readings: streak.count }]
      : [];
  });
}

/** Evaluate and persist each computed condition, including normal state for a current-state dashboard. */
export async function recordStorageCondition(reading) {
  const evaluation = evaluateStorageCondition(reading);
  evaluation.sustainedMetrics = await findSustainedMetrics(reading, evaluation);

  if (evaluation.sustainedMetrics.length > 0) {
    evaluation.status = 'CRITICAL';
    evaluation.message = `Sustained abnormal ${evaluation.sustainedMetrics.map(({ metric }) => sensorDefinitions[metric].label.toLowerCase()).join(', ')} conditions detected`;
  }

  const condition = await StorageCondition.create({
    deviceId: reading.deviceId,
    condition: evaluation.status,
    status: evaluation.status,
    reason: evaluation.message,
    message: evaluation.message,
    temperatureStatus: evaluation.temperatureStatus,
    humidityStatus: evaluation.humidityStatus,
    gasStatus: evaluation.gasStatus,
    abnormalMetrics: evaluation.abnormalMetrics,
    sustainedMetrics: evaluation.sustainedMetrics,
    thresholds: evaluation.thresholds,
    sensorReading: reading._id,
    source: reading.source || 'SIMULATED',
    timestamp: reading.timestamp,
  });

  return { ...evaluation, _id: condition._id, timestamp: condition.timestamp };
}
