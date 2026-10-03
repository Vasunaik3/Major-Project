import FanActivity from '../models/FanActivity.js';
import SensorReading from '../models/SensorReading.js';
import { getSystemSettings } from './systemSettingsService.js';

export function getFanThresholds() {
  const configured = getSystemSettings().fanControl;
  return {
    temperatureOn: configured.temperatureOn,
    temperatureOff: configured.temperatureOff,
    humidityOn: configured.humidityOn,
    humidityOff: configured.humidityOff,
    gasOn: configured.gasLevelOn,
    gasOff: configured.gasLevelOff,
    minimumOnMs: configured.minimumOnMs,
    minimumOffMs: configured.minimumOffMs,
  };
}

function getTriggers(reading, thresholds, fanIsOn) {
  const temperatureLimit = fanIsOn ? thresholds.temperatureOff : thresholds.temperatureOn;
  const humidityLimit = fanIsOn ? thresholds.humidityOff : thresholds.humidityOn;
  const gasLimit = fanIsOn ? thresholds.gasOff : thresholds.gasOn;
  const triggers = [];
  if (reading.temperature >= temperatureLimit) triggers.push('High temperature');
  if (reading.humidity >= humidityLimit) triggers.push('High humidity');
  if (reading.gasLevel >= gasLimit) triggers.push('Abnormal gas level');
  return triggers;
}

/** Pure transition rule, split out to keep the thresholds and minimum-time behavior testable. */
export function evaluateAutomaticFanState(reading, current = null, now = Date.now()) {
  const thresholds = getFanThresholds();
  const wasOn = current?.status === 'ON';
  const triggers = getTriggers(reading, thresholds, wasOn);
  let status = triggers.length > 0 ? 'ON' : 'OFF';
  let reason = status === 'ON' ? triggers.join('; ') : 'Normal storage conditions';

  if (current && status !== current.status) {
    const sinceLastTransition = Math.max(0, now - new Date(current.timestamp || current.updatedAt || 0).getTime());
    const minimumDuration = current.status === 'ON' ? thresholds.minimumOnMs : thresholds.minimumOffMs;
    if (sinceLastTransition < minimumDuration) {
      status = current.status;
      reason = current.status === 'ON' ? triggers.join('; ') || 'Minimum ON duration active' : 'Minimum OFF duration active';
    }
  }

  return { mode: 'AUTO', status, reason, triggers };
}

export async function getFanStatus() {
  const latest = await FanActivity.findOne().sort({ timestamp: -1, _id: -1 }).lean();
  return latest ?? {
    mode: 'AUTO',
    status: 'OFF',
    reason: 'Normal storage conditions',
    timestamp: null,
    simulated: true,
  };
}

export async function recordAutomaticFanState(reading, { forceMode = false } = {}) {
  const current = await FanActivity.findOne().sort({ timestamp: -1, _id: -1 });
  if (!forceMode && current?.mode === 'MANUAL') return current;

  const next = evaluateAutomaticFanState(reading, current);
  if (current?.mode === 'AUTO' && current.status === next.status && !forceMode) return current;

  return FanActivity.create({ ...next, simulated: true });
}

export async function setManualFanStatus(status) {
  return FanActivity.create({
    mode: 'MANUAL',
    status,
    reason: 'Manual control',
    simulated: true,
  });
}

export async function switchFanToAuto() {
  const latestReading = await SensorReading.findOne().sort({ timestamp: -1, _id: -1 }).lean();
  if (latestReading) return recordAutomaticFanState(latestReading, { forceMode: true });
  return FanActivity.create({
    mode: 'AUTO',
    status: 'OFF',
    reason: 'Normal storage conditions',
    simulated: true,
  });
}
