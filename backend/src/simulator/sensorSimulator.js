import { getSystemSettings } from '../services/systemSettingsService.js';

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const noise = (amplitude) => (Math.random() * 2 - 1) * amplitude;

export const SIMULATION_SCENARIOS = Object.freeze([
  'NORMAL',
  'HIGH_TEMPERATURE',
  'HIGH_HUMIDITY',
  'HIGH_GAS',
  'SPOILAGE_RISK',
]);

const BASELINE = Object.freeze({ temperature: 26.5, humidity: 68, gasLevel: 180 });
const TARGETS = {
  NORMAL: BASELINE,
  HIGH_TEMPERATURE: { temperature: 35, humidity: 68, gasLevel: 180 },
  HIGH_HUMIDITY: { temperature: 28, humidity: 85, gasLevel: 180 },
  HIGH_GAS: { temperature: 28, humidity: 68, gasLevel: 500 },
  SPOILAGE_RISK: { temperature: 35, humidity: 85, gasLevel: 500 },
};

let selectedScenario = 'NORMAL';
let scenarioStartedAt = Date.now();
let simulatorRunning = false;
let currentValues = { ...BASELINE };
let stopCurrentSimulator = null;
let restartSimulatorTimer = null;

function getScenarioPhase(now = Date.now(), intervalMs = 5000) {
  if (selectedScenario === 'NORMAL') return { phase: 'NORMAL', progress: 0 };
  const rampMs = Math.max(intervalMs, Number(process.env.SIMULATOR_RAMP_DURATION_MS) || 45_000);
  const holdMs = Math.max(intervalMs, Number(process.env.SIMULATOR_HOLD_DURATION_MS) || 20_000);
  const recoveryMs = Math.max(intervalMs, Number(process.env.SIMULATOR_RECOVERY_DURATION_MS) || 45_000);
  const cycleMs = rampMs + holdMs + recoveryMs;
  const elapsed = (now - scenarioStartedAt) % cycleMs;

  if (elapsed < rampMs) return { phase: 'RAMP_UP', progress: elapsed / rampMs };
  if (elapsed < rampMs + holdMs) return { phase: 'HOLD', progress: 1 };
  return { phase: 'RECOVERY', progress: 1 - (elapsed - rampMs - holdMs) / recoveryMs };
}

export function getSensorSimulatorStatus() {
  const intervalMs = getSystemSettings().simulator.intervalMs;
  return {
    enabled: process.env.SIMULATOR_ENABLED !== 'false',
    running: simulatorRunning,
    deviceId: process.env.SIMULATOR_DEVICE_ID || 'SIMULATOR_01',
    scenario: selectedScenario,
    intervalMs,
    phase: getScenarioPhase(Date.now(), intervalMs).phase,
    availableScenarios: SIMULATION_SCENARIOS,
  };
}

export function setSensorScenario(scenario) {
  if (!SIMULATION_SCENARIOS.includes(scenario)) {
    throw new RangeError(`Unsupported simulation scenario: ${scenario}`);
  }
  selectedScenario = scenario;
  scenarioStartedAt = Date.now();
  currentValues = { ...BASELINE };
  return getSensorSimulatorStatus();
}

function readScenarioFromEnvironment() {
  const configured = process.env.SIMULATOR_SCENARIO;
  return SIMULATION_SCENARIOS.includes(configured) ? configured : 'NORMAL';
}

function generateReading() {
  const intervalMs = getSystemSettings().simulator.intervalMs;
  const { progress } = getScenarioPhase(Date.now(), intervalMs);
  const target = TARGETS[selectedScenario];

  // Smoothly follow each scenario's ramp/hold/recovery target, with small sensor-like noise.
  currentValues.temperature = clamp(
    currentValues.temperature + (BASELINE.temperature + (target.temperature - BASELINE.temperature) * progress - currentValues.temperature) * 0.38 + noise(0.12),
    25,
    35,
  );
  currentValues.humidity = clamp(
    currentValues.humidity + (BASELINE.humidity + (target.humidity - BASELINE.humidity) * progress - currentValues.humidity) * 0.38 + noise(0.35),
    55,
    85,
  );
  currentValues.gasLevel = clamp(
    currentValues.gasLevel + (BASELINE.gasLevel + (target.gasLevel - BASELINE.gasLevel) * progress - currentValues.gasLevel) * 0.38 + noise(2),
    100,
    500,
  );

  return {
    deviceId: process.env.SIMULATOR_DEVICE_ID || 'SIMULATOR_01',
    temperature: Number(currentValues.temperature.toFixed(1)),
    humidity: Number(currentValues.humidity.toFixed(1)),
    gasLevel: Math.round(currentValues.gasLevel),
  };
}

export function startSensorSimulator() {
  if (stopCurrentSimulator) stopCurrentSimulator();
  if (process.env.SIMULATOR_ENABLED === 'false') {
    console.log('Sensor simulator disabled by configuration.');
    simulatorRunning = false;
    return () => {};
  }

  const intervalMs = getSystemSettings().simulator.intervalMs;
  selectedScenario = readScenarioFromEnvironment();
  scenarioStartedAt = Date.now();
  currentValues = { ...BASELINE };
  let inFlight = false;

  const publish = async () => {
    if (inFlight) return;
    inFlight = true;
    try {
      const apiUrl = process.env.SIMULATOR_API_URL ||
        `http://127.0.0.1:${Number(process.env.PORT) || 5000}/api/sensors/data`;
      const headers = { 'content-type': 'application/json' };
      if (process.env.SENSOR_INGEST_TOKEN) headers['x-sensor-token'] = process.env.SENSOR_INGEST_TOKEN;
      const reading = generateReading();
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify(reading),
        signal: AbortSignal.timeout(4000),
      });
      if (!response.ok) {
        const detail = (await response.text()).slice(0, 300);
        throw new Error(`Ingestion API returned ${response.status}: ${detail}`);
      }
      console.log(`[simulator:${selectedScenario}] reading sent: ${JSON.stringify(reading)}`);
    } catch (error) {
      console.error('[simulator] Failed to send reading:', error.message);
    } finally {
      inFlight = false;
    }
  };

  void publish();
  let timer = setInterval(publish, intervalMs);
  simulatorRunning = true;
  console.log(`Sensor simulator posting every ${intervalMs} ms; scenario=${selectedScenario}.`);
  restartSimulatorTimer = () => {
    clearInterval(timer);
    const nextIntervalMs = getSystemSettings().simulator.intervalMs;
    timer = setInterval(publish, nextIntervalMs);
    console.log(`Sensor simulator interval updated to ${nextIntervalMs} ms.`);
  };
  const stop = () => {
    clearInterval(timer);
    simulatorRunning = false;
    restartSimulatorTimer = null;
    if (stopCurrentSimulator === stop) stopCurrentSimulator = null;
  };
  stopCurrentSimulator = stop;
  return stop;
}

export function refreshSensorSimulatorInterval() {
  restartSimulatorTimer?.();
}
