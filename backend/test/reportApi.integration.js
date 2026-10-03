import assert from 'node:assert/strict';
import { once } from 'node:events';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import app from '../src/app.js';
import Alert from '../src/models/Alert.js';
import FanActivity from '../src/models/FanActivity.js';
import SensorReading from '../src/models/SensorReading.js';
import StorageCondition from '../src/models/StorageCondition.js';
import User from '../src/models/User.js';

const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/smart_onion_storage';
const tokenSuffix = `REPORT_TEST_${Date.now()}`;
const secret = `${tokenSuffix}_${Math.random()}`;
process.env.JWT_SECRET = secret;
process.env.REPORT_MAX_SAMPLE_GAP_MS = '300000';

async function run() {
  await mongoose.connect(uri);
  const email = `report-${Date.now()}@example.com`;
  const from = new Date(Date.now() - 300 * 24 * 60 * 60 * 1000);
  const middle = new Date(from.getTime() + 5 * 60_000);
  const to = new Date(from.getTime() + 10 * 60_000);
  let user;
  let server;

  try {
    user = await User.create({ name: 'Report Test', email, passwordHash: 'test-hash', role: 'VIEWER' });
    await SensorReading.create([
      { deviceId: tokenSuffix, temperature: 23, humidity: 60, gasLevel: 100, timestamp: from },
      { deviceId: tokenSuffix, temperature: 31, humidity: 80, gasLevel: 400, timestamp: middle },
    ]);
    await StorageCondition.create([
      { deviceId: tokenSuffix, condition: 'NORMAL', status: 'NORMAL', reason: 'Normal', message: 'Normal', temperatureStatus: 'NORMAL', humidityStatus: 'NORMAL', gasStatus: 'NORMAL', sensorReading: null, source: 'SIMULATED', timestamp: from },
      { deviceId: tokenSuffix, condition: 'WARNING', status: 'WARNING', reason: 'Warm', message: 'Warm', temperatureStatus: 'WARNING', humidityStatus: 'NORMAL', gasStatus: 'NORMAL', sensorReading: null, source: 'SIMULATED', timestamp: middle },
    ]);
    await FanActivity.create([
      { mode: 'AUTO', status: 'OFF', reason: `${tokenSuffix}_off`, timestamp: from },
      { mode: 'MANUAL', status: 'ON', reason: `${tokenSuffix}_on`, timestamp: middle },
    ]);
    await Alert.create({ type: 'SYSTEM', severity: 'MEDIUM', message: 'Report integration alert', deviceId: tokenSuffix, sensorValue: null, threshold: null, resolved: true, timestamp: middle });

    const userToken = jwt.sign({ sub: user.id, tokenVersion: user.tokenVersion ?? 0 }, secret, { expiresIn: '5m' });
    server = app.listen(0);
    await once(server, 'listening');
    const reportUrl = new URL(`http://127.0.0.1:${server.address().port}/api/reports`);
    reportUrl.searchParams.set('from', from.toISOString());
    reportUrl.searchParams.set('to', to.toISOString());
    const response = await fetch(reportUrl, { headers: { Authorization: `Bearer ${userToken}` } });
    const { report } = await response.json();

    assert.equal(response.status, 200);
    assert.equal(report.sensorSummary.samples, 2);
    assert.equal(report.sensorSummary.temperature.average, 27);
    assert.equal(report.sensorSummary.humidity.average, 70);
    assert.equal(report.sensorSummary.gasLevel.average, 250);
    assert.equal(report.alerts.total, 1);
    assert.equal(report.alerts.bySeverity.MEDIUM, 1);
    assert.equal(report.conditionTime.milliseconds.NORMAL, 5 * 60_000);
    assert.equal(report.conditionTime.milliseconds.WARNING, 5 * 60_000);
    assert.equal(report.fanActivity.onDurationMs, 5 * 60_000);
    assert.equal(report.storageHistory.length, 2);
    assert.equal(report.fanActivity.history.length, 2);
    assert.ok(report.charts.length > 0);
    assert.equal(Object.hasOwn(report, 'aiMetrics'), false);
    console.log('Historical report API integration checks passed.');
  } finally {
    await Alert.deleteMany({ deviceId: tokenSuffix });
    await StorageCondition.deleteMany({ deviceId: tokenSuffix });
    await SensorReading.deleteMany({ deviceId: tokenSuffix });
    await FanActivity.deleteMany({ reason: new RegExp(tokenSuffix) });
    if (user) await User.deleteOne({ _id: user._id });
    if (server) await new Promise((resolve) => server.close(resolve));
    await mongoose.disconnect();
  }
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
