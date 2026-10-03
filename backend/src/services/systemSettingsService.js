import StorageThresholdConfig from '../models/StorageThresholdConfig.js';

const sensorEnvironmentDefaults = {
  temperature: {
    lowCritical: ['STORAGE_TEMP_CRITICAL_LOW_C', 23],
    lowWarning: ['STORAGE_TEMP_WARNING_LOW_C', 25],
    highWarning: ['STORAGE_TEMP_WARNING_HIGH_C', 30],
    highCritical: ['STORAGE_TEMP_CRITICAL_HIGH_C', 34],
  },
  humidity: {
    lowCritical: ['STORAGE_HUMIDITY_CRITICAL_LOW_PERCENT', 45],
    lowWarning: ['STORAGE_HUMIDITY_WARNING_LOW_PERCENT', 55],
    highWarning: ['STORAGE_HUMIDITY_WARNING_HIGH_PERCENT', 75],
    highCritical: ['STORAGE_HUMIDITY_CRITICAL_HIGH_PERCENT', 85],
  },
  gasLevel: {
    lowCritical: ['STORAGE_GAS_CRITICAL_LOW_LEVEL', 50],
    lowWarning: ['STORAGE_GAS_WARNING_LOW_LEVEL', 100],
    highWarning: ['STORAGE_GAS_WARNING_HIGH_LEVEL', 300],
    highCritical: ['STORAGE_GAS_CRITICAL_HIGH_LEVEL', 500],
  },
};

function envNumber(name, fallback, minimum = 0) {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value >= minimum ? value : fallback;
}

function environmentDefaults() {
  return {
    thresholds: Object.fromEntries(Object.entries(sensorEnvironmentDefaults).map(([sensor, fields]) => [
      sensor,
      Object.fromEntries(Object.entries(fields).map(([field, [name, fallback]]) => [field, envNumber(name, fallback)])),
    ])),
    simulator: {
      intervalMs: Math.max(1000, envNumber('SIMULATOR_INTERVAL_MS', 5000, 1000)),
    },
    fanControl: {
      temperatureOn: envNumber('FAN_ON_TEMP_C', 28),
      temperatureOff: envNumber('FAN_OFF_TEMP_C', 24),
      humidityOn: envNumber('FAN_ON_HUMIDITY_PERCENT', 78),
      humidityOff: envNumber('FAN_OFF_HUMIDITY_PERCENT', 72),
      gasLevelOn: envNumber('FAN_ON_GAS_LEVEL', 350),
      gasLevelOff: envNumber('FAN_OFF_GAS_LEVEL', 250),
      minimumOnMs: envNumber('FAN_MIN_ON_DURATION_MS', 15_000, 1000),
      minimumOffMs: envNumber('FAN_MIN_OFF_DURATION_MS', 10_000, 1000),
    },
  };
}

let persistedSettings = null;
let metadata = { updatedAt: null, updatedBy: null };

export function getSystemSettings() {
  const defaults = environmentDefaults();
  if (!persistedSettings) return { ...defaults, ...metadata };
  return {
    thresholds: Object.fromEntries(Object.keys(defaults.thresholds).map((sensor) => [
      sensor,
      { ...defaults.thresholds[sensor], ...persistedSettings.thresholds?.[sensor] },
    ])),
    simulator: { ...defaults.simulator, ...persistedSettings.simulator },
    fanControl: { ...defaults.fanControl, ...persistedSettings.fanControl },
    ...metadata,
  };
}

export async function loadSystemSettings() {
  const document = await StorageThresholdConfig.findOne({ key: 'storage' }).lean();
  persistedSettings = document ? {
    thresholds: document.thresholds || {},
    simulator: document.simulator || {},
    fanControl: document.fanControl || {},
  } : null;
  metadata = { updatedAt: document?.updatedAt || null, updatedBy: document?.updatedBy || null };
  return getSystemSettings();
}

export function validateSystemSettings(settings) {
  const errors = [];
  for (const sensor of Object.keys(sensorEnvironmentDefaults)) {
    const values = settings?.thresholds?.[sensor];
    const fields = ['lowCritical', 'lowWarning', 'highWarning', 'highCritical'];
    if (!values || fields.some((field) => typeof values[field] !== 'number' || !Number.isFinite(values[field]))) {
      errors.push(`${sensor} requires numeric lowCritical, lowWarning, highWarning, and highCritical values.`);
      continue;
    }
    if (!(values.lowCritical < values.lowWarning && values.lowWarning < values.highWarning && values.highWarning < values.highCritical)) {
      errors.push(`${sensor} must follow lowCritical < lowWarning < highWarning < highCritical.`);
    }
  }

  const interval = settings?.simulator?.intervalMs;
  if (!Number.isInteger(interval) || interval < 1000 || interval > 3_600_000) {
    errors.push('simulator.intervalMs must be an integer between 1000 and 3600000 milliseconds.');
  }

  const fan = settings?.fanControl;
  const fanFields = ['temperatureOn', 'temperatureOff', 'humidityOn', 'humidityOff', 'gasLevelOn', 'gasLevelOff', 'minimumOnMs', 'minimumOffMs'];
  if (!fan || fanFields.some((field) => typeof fan[field] !== 'number' || !Number.isFinite(fan[field]))) {
    errors.push('fanControl requires numeric ON/OFF thresholds and minimum ON/OFF durations.');
  } else {
    if (fan.temperatureOn <= fan.temperatureOff) errors.push('Fan temperature ON threshold must exceed its OFF threshold.');
    if (fan.humidityOn <= fan.humidityOff) errors.push('Fan humidity ON threshold must exceed its OFF threshold.');
    if (fan.gasLevelOn <= fan.gasLevelOff) errors.push('Fan gas ON threshold must exceed its OFF threshold.');
    if (fan.minimumOnMs < 0 || fan.minimumOnMs > 3_600_000 || fan.minimumOffMs < 0 || fan.minimumOffMs > 3_600_000) {
      errors.push('Fan minimum durations must be between 0 and 3600000 milliseconds.');
    }
  }
  return errors;
}

export async function saveSystemSettings(settings, updatedBy) {
  const errors = validateSystemSettings(settings);
  if (errors.length) throw Object.assign(new Error(errors.join(' ')), { status: 400, details: errors });

  const normalized = {
    thresholds: Object.fromEntries(Object.entries(settings.thresholds).map(([sensor, values]) => [sensor, {
      lowCritical: values.lowCritical,
      lowWarning: values.lowWarning,
      highWarning: values.highWarning,
      highCritical: values.highCritical,
    }])),
    simulator: { intervalMs: settings.simulator.intervalMs },
    fanControl: {
      temperatureOn: settings.fanControl.temperatureOn,
      temperatureOff: settings.fanControl.temperatureOff,
      humidityOn: settings.fanControl.humidityOn,
      humidityOff: settings.fanControl.humidityOff,
      gasLevelOn: settings.fanControl.gasLevelOn,
      gasLevelOff: settings.fanControl.gasLevelOff,
      minimumOnMs: settings.fanControl.minimumOnMs,
      minimumOffMs: settings.fanControl.minimumOffMs,
    },
  };
  const document = await StorageThresholdConfig.findOneAndUpdate(
    { key: 'storage' },
    { $set: { ...normalized, updatedBy } },
    { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true },
  );
  persistedSettings = normalized;
  metadata = { updatedAt: document.updatedAt, updatedBy: document.updatedBy };
  return getSystemSettings();
}
