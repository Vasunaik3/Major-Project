import assert from 'node:assert/strict';
import { once } from 'node:events';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import app from '../src/app.js';
import Alert from '../src/models/Alert.js';
import FanActivity from '../src/models/FanActivity.js';
import SensorReading from '../src/models/SensorReading.js';
import StorageCondition from '../src/models/StorageCondition.js';
import User from '../src/models/User.js';
import { startSensorSimulator } from '../src/simulator/sensorSimulator.js';

const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/smart_onion_storage';
const secret = `SIMULATOR_TEST_${Date.now()}_${Math.random()}`;
const deviceId = `SIMULATOR_TEST_${Date.now()}`;
process.env.JWT_SECRET = secret;
process.env.SIMULATOR_ENABLED = 'true';
process.env.SIMULATOR_INTERVAL_MS = '1000';
process.env.SIMULATOR_DEVICE_ID = deviceId;
process.env.SIMULATOR_SCENARIO = 'NORMAL';
process.env.FAN_MIN_OFF_DURATION_MS = '1000';
process.env.FAN_MIN_ON_DURATION_MS = '1000';
process.env.STORAGE_TEMP_WARNING_HIGH_C = '30';
process.env.STORAGE_TEMP_CRITICAL_HIGH_C = '34';
process.env.STORAGE_HUMIDITY_WARNING_HIGH_PERCENT = '75';
process.env.STORAGE_HUMIDITY_CRITICAL_HIGH_PERCENT = '85';
process.env.STORAGE_GAS_WARNING_HIGH_LEVEL = '300';
process.env.STORAGE_GAS_CRITICAL_HIGH_LEVEL = '500';

const delay = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

async function run() {
  await mongoose.connect(uri);
  const email = `simulator-${Date.now()}@example.com`;
  let user;
  let server;
  let stopSimulator;
  const fanActivityIds = [];

  try {
    user = await User.create({
      name: 'Simulator Integration Test',
      email,
      passwordHash: await bcrypt.hash('SimulatorTestPass123!', 4),
    });
    const fanBaseline = await FanActivity.create({
      mode: 'AUTO',
      status: 'OFF',
      reason: 'Simulator integration test baseline',
      simulated: true,
    });
    fanActivityIds.push(fanBaseline._id);
    const token = jwt.sign({ sub: user.id, tokenVersion: user.tokenVersion }, secret, { expiresIn: '5m' });

    server = app.listen(0);
    await once(server, 'listening');
    const origin = `http://127.0.0.1:${server.address().port}`;
    process.env.SIMULATOR_API_URL = `${origin}/api/sensors/data`;
    stopSimulator = startSensorSimulator();

    let simulatedReading;
    for (let attempt = 0; attempt < 30 && !simulatedReading; attempt += 1) {
      simulatedReading = await SensorReading.findOne({ deviceId }).sort({ timestamp: -1 }).lean();
      if (!simulatedReading) await delay(100);
    }
    assert.ok(simulatedReading, 'simulator should publish a reading to the Express API');
    assert.equal(simulatedReading.source, 'SIMULATED');
    assert.ok(simulatedReading.temperature >= 25 && simulatedReading.temperature <= 35);
    assert.ok(simulatedReading.humidity >= 55 && simulatedReading.humidity <= 85);
    assert.ok(simulatedReading.gasLevel >= 100 && simulatedReading.gasLevel <= 500);
    let storageCondition;
    for (let attempt = 0; attempt < 30 && !storageCondition; attempt += 1) {
      storageCondition = await StorageCondition.findOne({ sensorReading: simulatedReading._id });
      if (!storageCondition) await delay(100);
    }
    assert.ok(storageCondition, 'ingestion should store a storage-condition record');

    const authHeaders = { Authorization: `Bearer ${token}` };
    const healthResponse = await fetch(`${origin}/api/health`);
    assert.equal(healthResponse.status, 200, 'frontend-compatible API health endpoint should respond');

    const dashboardResponse = await fetch(`${origin}/api/dashboard/summary`, { headers: authHeaders });
    const dashboard = await dashboardResponse.json();
    assert.equal(dashboardResponse.status, 200);
    assert.equal(dashboard.latestReading.deviceId, deviceId);
    assert.equal(dashboard.latestReading.source, 'SIMULATED');
    assert.equal(dashboard.simulator.running, true);

    const historyResponse = await fetch(`${origin}/api/sensors/history?deviceId=${deviceId}&limit=10`, { headers: authHeaders });
    const history = await historyResponse.json();
    assert.equal(historyResponse.status, 200);
    assert.ok(history.readings.some((reading) => reading._id === String(simulatedReading._id)), 'chart history endpoint should include simulator data');

    stopSimulator();
    stopSimulator = null;
    await delay(1100);
    const ingestHeaders = { 'Content-Type': 'application/json' };
    if (process.env.SENSOR_INGEST_TOKEN) ingestHeaders['x-sensor-token'] = process.env.SENSOR_INGEST_TOKEN;
    const stressResponse = await fetch(`${origin}/api/sensors/data`, {
      method: 'POST',
      headers: ingestHeaders,
      body: JSON.stringify({ deviceId, temperature: 35, humidity: 85, gasLevel: 500 }),
    });
    const stressResult = await stressResponse.json();
    assert.equal(stressResponse.status, 201);
    assert.equal(stressResult.reading.source, 'SIMULATED');
    assert.equal(stressResult.fanActivity.status, 'ON', 'abnormal simulated readings should trigger automatic fan control');
    assert.equal(stressResult.fanActivity.simulated, true);
    fanActivityIds.push(stressResult.fanActivity._id);
    assert.ok(stressResult.alerts.length > 0, 'abnormal simulated readings should create alerts');

    const alertResponse = await fetch(`${origin}/api/alerts?resolved=false&limit=20`, { headers: authHeaders });
    const alertPayload = await alertResponse.json();
    assert.equal(alertResponse.status, 200);
    assert.ok(alertPayload.alerts.some((alert) => alert.deviceId === deviceId), 'alerts should be visible through the protected API');

    const manualFanResponse = await fetch(`${origin}/api/fan/control`, {
      method: 'POST',
      headers: { ...authHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode: 'MANUAL', status: 'OFF' }),
    });
    const manualFan = await manualFanResponse.json();
    assert.equal(manualFanResponse.status, 200);
    assert.equal(manualFan.fan.mode, 'MANUAL');
    assert.equal(manualFan.fan.status, 'OFF');
    assert.equal(manualFan.fan.simulated, true);
    fanActivityIds.push(manualFan.fan._id);

    const unauthorizedResponse = await fetch(`${origin}/api/dashboard/summary`);
    assert.equal(unauthorizedResponse.status, 401, 'dashboard data must require authentication');

    console.log('Simulator, dashboard API, alerts, and fan integration checks passed.');
  } finally {
    stopSimulator?.();
    if (server) await new Promise((resolve) => server.close(resolve));
    if (user) await User.deleteOne({ _id: user._id });
    await Alert.deleteMany({ deviceId });
    await SensorReading.deleteMany({ deviceId });
    await StorageCondition.deleteMany({ deviceId });
    await FanActivity.deleteMany({ _id: { $in: fanActivityIds } });
    await mongoose.disconnect();
  }
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
