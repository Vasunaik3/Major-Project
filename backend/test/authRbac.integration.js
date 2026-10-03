import assert from 'node:assert/strict';
import { once } from 'node:events';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import app from '../src/app.js';
import StorageThresholdConfig from '../src/models/StorageThresholdConfig.js';
import User from '../src/models/User.js';
import { evaluateAutomaticFanState, getFanThresholds } from '../src/services/fanService.js';
import { getSystemSettings } from '../src/services/systemSettingsService.js';
import { evaluateStorageCondition, loadStorageThresholds } from '../src/services/storageConditionService.js';

const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/smart_onion_storage';
const secret = `AUTH_RBAC_TEST_${Date.now()}_${Math.random()}`;
process.env.JWT_SECRET = secret;

async function run() {
  await mongoose.connect(uri);
  const email = `auth-rbac-${Date.now()}@example.com`;
  let registeredViewer;
  let operator;
  let viewer;
  let admin;
  let server;
  let previousThresholdConfig;

  try {
    previousThresholdConfig = await StorageThresholdConfig.findOne({ key: 'storage' }).lean();
    server = app.listen(0);
    await once(server, 'listening');
    const origin = `http://127.0.0.1:${server.address().port}`;
    const request = async (path, { token, method = 'GET', body } = {}) => {
      const headers = {};
      if (token) headers.Authorization = `Bearer ${token}`;
      if (body) headers['Content-Type'] = 'application/json';
      const response = await fetch(`${origin}${path}`, { method, headers, body: body ? JSON.stringify(body) : undefined });
      return { response, data: await response.json() };
    };
    const tokenFor = (user) => jwt.sign({ sub: user.id, tokenVersion: user.tokenVersion ?? 0 }, secret, { expiresIn: '5m' });

    const registered = await request('/api/auth/register', {
      method: 'POST',
      body: { name: 'Registered Operator', email, password: 'StrongPass123!', role: 'ADMIN' },
    });
    assert.equal(registered.response.status, 201);
    assert.equal(registered.data.user.role, 'VIEWER', 'registration ignores requested role escalation and assigns the least-privilege role');
    registeredViewer = await User.findOne({ email }).select('+passwordHash');
    assert.notEqual(registeredViewer.passwordHash, 'StrongPass123!');
    assert.equal(await bcrypt.compare('StrongPass123!', registeredViewer.passwordHash), true);

    const me = await request('/api/auth/me', { token: registered.data.token });
    assert.equal(me.response.status, 200);
    assert.equal(me.data.user.role, 'VIEWER');

    const signedOut = await request('/api/auth/logout', { token: registered.data.token, method: 'POST' });
    assert.equal(signedOut.response.status, 200);
    assert.equal((await request('/api/auth/me', { token: registered.data.token })).response.status, 401);

    const loggedIn = await request('/api/auth/login', {
      method: 'POST',
      body: { email, password: 'StrongPass123!' },
    });
    assert.equal(loggedIn.response.status, 200);

    viewer = registeredViewer;
    operator = await User.create({ name: 'Operator Test', email: `operator-${Date.now()}@example.com`, passwordHash: await bcrypt.hash('OperatorPass123!', 12), role: 'OPERATOR' });
    admin = await User.create({ name: 'Admin Test', email: `admin-${Date.now()}@example.com`, passwordHash: await bcrypt.hash('AdminPass123!', 12), role: 'ADMIN' });
    const viewerToken = loggedIn.data.token;
    const operatorToken = tokenFor(operator);
    const adminToken = tokenFor(admin);

    assert.equal((await request('/api/dashboard/summary', { token: viewerToken })).response.status, 200);
    assert.equal((await request('/api/sensors/history?limit=1', { token: viewerToken })).response.status, 200);
    assert.equal((await request('/api/reports', { token: viewerToken })).response.status, 200);
    assert.equal((await request('/api/alerts', { token: viewerToken })).response.status, 403);
    assert.equal((await request('/api/fan/status', { token: viewerToken })).response.status, 403);
    assert.equal((await request('/api/images', { token: viewerToken })).response.status, 403);

    assert.equal((await request('/api/alerts', { token: operatorToken })).response.status, 200);
    assert.equal((await request('/api/fan/status', { token: operatorToken })).response.status, 200);
    assert.equal((await request('/api/reports', { token: operatorToken })).response.status, 403);
    assert.equal((await request('/api/admin/users', { token: operatorToken })).response.status, 403);
    assert.equal((await request('/api/settings', { token: operatorToken })).response.status, 403);
    assert.equal((await request('/api/settings', { token: viewerToken })).response.status, 403);

    const users = await request('/api/admin/users', { token: adminToken });
    assert.equal(users.response.status, 200);
    const changedRole = await request(`/api/admin/users/${viewer.id}/role`, { token: adminToken, method: 'PATCH', body: { role: 'OPERATOR' } });
    assert.equal(changedRole.response.status, 200);
    assert.equal(changedRole.data.user.role, 'OPERATOR');
    assert.equal((await request('/api/fan/status', { token: viewerToken })).response.status, 200, 'the database role change applies to the existing JWT');
    const selfDemotion = await request(`/api/admin/users/${admin.id}/role`, { token: adminToken, method: 'PATCH', body: { role: 'VIEWER' } });
    assert.equal(selfDemotion.response.status, 400);
    const thresholdResponse = await request('/api/admin/thresholds', { token: adminToken });
    assert.equal(thresholdResponse.response.status, 200);
    const updatedThresholds = structuredClone(thresholdResponse.data.thresholds);
    updatedThresholds.temperature.highWarning += 0.5;
    updatedThresholds.temperature.highCritical += 0.5;
    const saveThresholds = await request('/api/admin/thresholds', { token: adminToken, method: 'PUT', body: { thresholds: updatedThresholds } });
    assert.equal(saveThresholds.response.status, 200);
    assert.equal(saveThresholds.data.thresholds.temperature.highWarning, updatedThresholds.temperature.highWarning);

    const settingsResponse = await request('/api/settings', { token: adminToken });
    assert.equal(settingsResponse.response.status, 200);
    const settings = structuredClone(settingsResponse.data.settings);
    const invalidSettings = structuredClone(settings);
    invalidSettings.fanControl.temperatureOn = invalidSettings.fanControl.temperatureOff;
    assert.equal((await request('/api/settings', { token: adminToken, method: 'PUT', body: invalidSettings })).response.status, 400);
    settings.simulator.intervalMs = 7000;
    settings.fanControl.temperatureOn += 1;
    settings.fanControl.temperatureOff += 1;
    settings.fanControl.minimumOnMs += 1000;
    const savedSettings = await request('/api/settings', { token: adminToken, method: 'PUT', body: settings });
    assert.equal(savedSettings.response.status, 200);
    assert.equal(getSystemSettings().simulator.intervalMs, 7000);
    assert.equal(getFanThresholds().temperatureOn, settings.fanControl.temperatureOn);
    assert.equal(getFanThresholds().minimumOnMs, settings.fanControl.minimumOnMs);
    const warningTemperature = (settings.thresholds.temperature.highWarning + settings.thresholds.temperature.highCritical) / 2;
    const condition = evaluateStorageCondition({
      temperature: warningTemperature,
      humidity: (settings.thresholds.humidity.lowWarning + settings.thresholds.humidity.highWarning) / 2,
      gasLevel: (settings.thresholds.gasLevel.lowWarning + settings.thresholds.gasLevel.highWarning) / 2,
    });
    assert.equal(condition.temperatureStatus, 'WARNING', 'updated preferred/critical limits drive condition classification');
    const automaticFan = evaluateAutomaticFanState({
      temperature: settings.fanControl.temperatureOn,
      humidity: settings.fanControl.humidityOff - 1,
      gasLevel: settings.fanControl.gasLevelOff - 1,
    });
    assert.equal(automaticFan.status, 'ON', 'updated fan thresholds drive automatic control');

    console.log('Authentication and role-based access integration checks passed.');
  } finally {
    if (server) await new Promise((resolve) => server.close(resolve));
    if (registeredViewer) await User.deleteOne({ _id: registeredViewer._id });
    if (operator) await User.deleteOne({ _id: operator._id });
    if (admin) await User.deleteOne({ _id: admin._id });
    if (previousThresholdConfig) {
      await StorageThresholdConfig.findOneAndUpdate({ key: 'storage' }, { $set: {
        thresholds: previousThresholdConfig.thresholds,
        simulator: previousThresholdConfig.simulator || {},
        fanControl: previousThresholdConfig.fanControl || {},
        updatedBy: previousThresholdConfig.updatedBy,
      } }, { upsert: true });
    } else {
      await StorageThresholdConfig.deleteOne({ key: 'storage' });
    }
    await loadStorageThresholds();
    await mongoose.disconnect();
  }
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
