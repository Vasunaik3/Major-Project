import assert from 'node:assert/strict';
import test from 'node:test';
import { getSystemSettings, validateSystemSettings } from '../src/services/systemSettingsService.js';

test('default settings include storage, simulator, and fan controls', () => {
  const settings = getSystemSettings();
  assert.deepEqual(Object.keys(settings.thresholds), ['temperature', 'humidity', 'gasLevel']);
  assert.ok(settings.simulator.intervalMs >= 1000);
  assert.ok(settings.fanControl.temperatureOn > settings.fanControl.temperatureOff);
  assert.ok(settings.fanControl.humidityOn > settings.fanControl.humidityOff);
  assert.ok(settings.fanControl.gasLevelOn > settings.fanControl.gasLevelOff);
});

test('settings validation rejects inverted critical/preferred ranges', () => {
  const settings = structuredClone(getSystemSettings());
  settings.thresholds.temperature.highWarning = settings.thresholds.temperature.lowWarning;
  assert.ok(validateSystemSettings(settings).some((message) => message.includes('temperature')));
});

test('settings validation rejects invalid simulator cadence and fan hysteresis', () => {
  const intervalSettings = structuredClone(getSystemSettings());
  intervalSettings.simulator.intervalMs = 500;
  assert.ok(validateSystemSettings(intervalSettings).some((message) => message.includes('simulator.intervalMs')));

  const fanSettings = structuredClone(getSystemSettings());
  fanSettings.fanControl.gasLevelOn = fanSettings.fanControl.gasLevelOff;
  assert.ok(validateSystemSettings(fanSettings).some((message) => message.includes('gas ON threshold')));
});
