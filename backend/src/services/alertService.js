import Alert from '../models/Alert.js';
import SensorReading from '../models/SensorReading.js';
import { evaluateStorageCondition, getStorageThresholds } from './storageConditionService.js';

const severityOrder = { LOW: 0, MEDIUM: 1, HIGH: 2, CRITICAL: 3 };
const metricAlertTypes = {
  temperature: 'TEMPERATURE_HIGH',
  humidity: 'HUMIDITY_HIGH',
  gasLevel: 'GAS_ABNORMAL',
};

function numberFromEnv(name, fallback) {
  const parsed = Number(process.env[name]);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

function metricSeverity(value, status, limits) {
  if (status === 'CRITICAL') return 'CRITICAL';
  const isLow = value < limits.lowWarning;
  const warning = isLow ? limits.lowWarning : limits.highWarning;
  const critical = isLow ? limits.lowCritical : limits.highCritical;
  const progress = isLow
    ? (warning - value) / (warning - critical)
    : (value - warning) / (critical - warning);
  if (progress >= 2 / 3) return 'HIGH';
  if (progress >= 1 / 3) return 'MEDIUM';
  return 'LOW';
}

function metricThreshold(value, limits) {
  return value < limits.lowWarning ? limits.lowWarning : limits.highWarning;
}

export function buildAlertCandidates(reading, evaluation = evaluateStorageCondition(reading)) {
  const candidates = [];
  const statusByMetric = {
    temperature: evaluation.temperatureStatus,
    humidity: evaluation.humidityStatus,
    gasLevel: evaluation.gasStatus,
  };

  for (const metric of ['temperature', 'humidity', 'gasLevel']) {
    const status = statusByMetric[metric];
    if (status === 'NORMAL') continue;
    const limits = evaluation.thresholds[metric];
    const threshold = metricThreshold(reading[metric], limits);
    const severity = metricSeverity(reading[metric], status, limits);
    const displayName = metric === 'gasLevel' ? 'Gas level' : metric[0].toUpperCase() + metric.slice(1);
    const unit = metric === 'temperature' ? '°C' : metric === 'humidity' ? '%' : '';
    const type = metricAlertTypes[metric];
    const direction = reading[metric] < limits.lowWarning ? 'low' : 'high';
    candidates.push({
      type,
      severity,
      message: `${displayName} is abnormally ${direction} (${reading[metric]}${unit}; limit ${threshold}${unit}).`,
      sensorValue: reading[metric],
      threshold,
      significantDelta: numberFromEnv(`ALERT_${metric.toUpperCase()}_SIGNIFICANT_CHANGE`, metric === 'temperature' ? 1 : metric === 'humidity' ? 5 : 50),
    });
  }

  const abnormal = evaluation.abnormalMetrics;
  if (abnormal.length >= 2) {
    const containsCritical = abnormal.some(({ status }) => status === 'CRITICAL');
    const severity = containsCritical ? 'CRITICAL' : 'HIGH';
    candidates.push({
      type: 'MULTIPLE_ABNORMAL',
      severity,
      message: `${abnormal.length} sensor parameters are outside preferred storage ranges.`,
      sensorValue: abnormal.length,
      threshold: 2,
      significantDelta: 1,
    });
  }
  return candidates;
}

async function resolveActiveAlert(alert, reason, resolvedAt = new Date()) {
  alert.resolved = true;
  alert.resolvedAt = resolvedAt;
  alert.resolutionReason = reason;
  await alert.save();
}

async function createOrUpdateAlert(deviceId, candidate, timestamp) {
  const active = await Alert.findOne({ deviceId, type: candidate.type, resolved: false })
    .sort({ timestamp: -1, _id: -1 });

  if (!active) {
    try {
      return await Alert.create({ ...candidate, deviceId, resolved: false, timestamp });
    } catch (error) {
      // A concurrent sensor request may have created the active alert first.
      if (error?.code === 11000) return null;
      throw error;
    }
  }

  const severityChanged = active.severity !== candidate.severity;
  const escalated = severityOrder[candidate.severity] > severityOrder[active.severity];
  const valueChanged = typeof active.sensorValue === 'number' &&
    Math.abs(candidate.sensorValue - active.sensorValue) >= candidate.significantDelta;
  const cooldownMs = numberFromEnv('ALERT_SIGNIFICANT_CHANGE_COOLDOWN_MS', 30_000);
  const sinceLastAlert = new Date(timestamp).getTime() - new Date(active.timestamp).getTime();
  const significantChangeAllowed = sinceLastAlert >= cooldownMs;

  if (!escalated && ((!severityChanged && !valueChanged) || !significantChangeAllowed)) return null;

  await resolveActiveAlert(
    active,
    severityChanged ? `Severity changed to ${candidate.severity}.` : 'Condition changed significantly.',
    timestamp,
  );
  try {
    return await Alert.create({ ...candidate, deviceId, resolved: false, timestamp });
  } catch (error) {
    if (error?.code === 11000) return null;
    throw error;
  }
}

async function resolveAlertsNoLongerActive(deviceId, activeTypes, timestamp) {
  const openAlerts = await Alert.find({
    deviceId,
    resolved: false,
    type: { $in: [...Object.values(metricAlertTypes), 'MULTIPLE_ABNORMAL'] },
  });
  const resolved = [];
  for (const alert of openAlerts) {
    if (activeTypes.has(alert.type)) continue;
    await resolveActiveAlert(alert, 'Condition returned to the preferred range.', timestamp);
    resolved.push(alert);
  }
  return resolved;
}

/** Evaluate a stored sensor reading and create only new, escalated, or significant-change events. */
export async function evaluateAlerts(reading) {
  const evaluation = evaluateStorageCondition(reading);
  const candidates = buildAlertCandidates(reading, evaluation);
  const activeTypes = new Set(candidates.map(({ type }) => type));
  const resolved = await resolveAlertsNoLongerActive(reading.deviceId, activeTypes, reading.timestamp);
  const created = [];
  for (const candidate of candidates) {
    const alert = await createOrUpdateAlert(reading.deviceId, candidate, reading.timestamp);
    if (alert) created.push(alert);
  }
  // A new sensor sample also ends its own stale-data condition.
  const staleAlerts = await Alert.find({ deviceId: reading.deviceId, type: 'SENSOR_DATA_STALE', resolved: false });
  for (const alert of staleAlerts) {
    await resolveActiveAlert(alert, 'Sensor data resumed.', reading.timestamp);
    resolved.push(alert);
  }
  return { created, resolved };
}

function staleSeverity(ageMs, thresholdMs) {
  if (ageMs >= thresholdMs * 4) return 'CRITICAL';
  if (ageMs >= thresholdMs * 2) return 'HIGH';
  return 'MEDIUM';
}

/** Detect per-device sensor silence. Only devices that have previously reported can go stale. */
export async function checkSensorDataStaleness(now = new Date()) {
  const staleAfterMs = Math.max(1000, numberFromEnv('SENSOR_STALE_AFTER_MS', 20_000));
  const deviceIds = await SensorReading.distinct('deviceId');
  const created = [];
  const resolved = [];

  for (const deviceId of deviceIds) {
    const latest = await SensorReading.findOne({ deviceId }).sort({ timestamp: -1, _id: -1 }).lean();
    if (!latest) continue;
    const ageMs = now.getTime() - new Date(latest.timestamp).getTime();
    const existing = await Alert.findOne({ deviceId, type: 'SENSOR_DATA_STALE', resolved: false })
      .sort({ timestamp: -1, _id: -1 });

    if (ageMs <= staleAfterMs) {
      if (existing) {
        await resolveActiveAlert(existing, 'Sensor data resumed.', now);
        resolved.push(existing);
      }
      continue;
    }

    const severity = staleSeverity(ageMs, staleAfterMs);
    const candidate = {
      type: 'SENSOR_DATA_STALE',
      severity,
      message: `No sensor data received for ${Math.floor(ageMs / 1000)} seconds.`,
      sensorValue: Math.floor(ageMs / 1000),
      threshold: Math.ceil(staleAfterMs / 1000),
      significantDelta: numberFromEnv('ALERT_STALE_SIGNIFICANT_CHANGE_SECONDS', 60),
    };
    const alert = await createOrUpdateAlert(deviceId, candidate, now);
    if (alert) created.push(alert);
  }
  return { created, resolved };
}

export function startAlertMonitor() {
  if (process.env.ALERT_MONITOR_ENABLED === 'false') return () => {};
  const intervalMs = Math.max(1000, numberFromEnv('ALERT_MONITOR_INTERVAL_MS', 5000));
  let inFlight = false;
  const check = async () => {
    if (inFlight) return;
    inFlight = true;
    try {
      const result = await checkSensorDataStaleness();
      for (const alert of result.created) {
        console.log(`[alerts] ${alert.severity} ${alert.type} for ${alert.deviceId}`);
      }
    } catch (error) {
      console.error('[alerts] Sensor staleness check failed:', error.message);
    } finally {
      inFlight = false;
    }
  };
  void check();
  const timer = setInterval(check, intervalMs);
  return () => clearInterval(timer);
}
