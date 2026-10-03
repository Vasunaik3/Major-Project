import assert from 'node:assert/strict';
import test from 'node:test';
import { buildAlertCandidates } from '../src/services/alertService.js';

function reading(overrides = {}) {
  return {
    deviceId: 'ALERT_TEST_01',
    temperature: 26.5,
    humidity: 68,
    gasLevel: 180,
    ...overrides,
  };
}

test('normal sensor readings do not produce alerts', () => {
  assert.deepEqual(buildAlertCandidates(reading()), []);
});

test('slightly high temperature starts one low alert', () => {
  const candidates = buildAlertCandidates(reading({ temperature: 31 }));
  assert.equal(candidates.length, 1);
  assert.equal(candidates[0].type, 'TEMPERATURE_HIGH');
  assert.equal(candidates[0].severity, 'LOW');
});

test('high humidity and abnormal gas produce specific alerts', () => {
  const humidity = buildAlertCandidates(reading({ humidity: 80 }));
  const gas = buildAlertCandidates(reading({ gasLevel: 420 }));
  assert.equal(humidity[0].type, 'HUMIDITY_HIGH');
  assert.equal(humidity[0].severity, 'MEDIUM');
  assert.equal(gas[0].type, 'GAS_ABNORMAL');
  assert.equal(gas[0].severity, 'MEDIUM');
});

test('multiple abnormal metrics create an aggregate alert', () => {
  const candidates = buildAlertCandidates(reading({ temperature: 31, humidity: 80 }));
  const aggregate = candidates.find((candidate) => candidate.type === 'MULTIPLE_ABNORMAL');
  assert.ok(aggregate);
  assert.equal(aggregate.sensorValue, 2);
  assert.equal(aggregate.severity, 'HIGH');
});

test('critical gas level maps to critical severity', () => {
  const candidates = buildAlertCandidates(reading({ gasLevel: 500 }));
  assert.equal(candidates[0].type, 'GAS_ABNORMAL');
  assert.equal(candidates[0].severity, 'CRITICAL');
});
