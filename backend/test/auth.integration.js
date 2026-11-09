import assert from 'node:assert/strict';
import { once } from 'node:events';
import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import app from '../src/app.js';
import User from '../src/models/User.js';

const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/smart_onion_storage';
const secret = `AUTH_TEST_${Date.now()}_${Math.random()}`;
process.env.JWT_SECRET = secret;

async function run() {
  await mongoose.connect(uri);
  const suffix = Date.now();
  const accounts = [];
  let server;

  try {
    server = app.listen(0);
    await once(server, 'listening');
    const origin = `http://127.0.0.1:${server.address().port}`;
    const request = async (path, { token, method = 'GET', body } = {}) => {
      const headers = {};
      if (token) headers.Authorization = `Bearer ${token}`;
      if (body) headers['Content-Type'] = 'application/json';
      const response = await fetch(`${origin}${path}`, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
      });
      return { response, data: await response.json() };
    };

    const register = async (number) => {
      const email = `auth-test-${suffix}-${number}@example.com`;
      const password = `StrongPass${number}123!`;
      const result = await request('/api/auth/register', {
        method: 'POST',
        body: { name: `Authentication Test ${number}`, email, password },
      });
      assert.equal(result.response.status, 201);
      assert.equal(result.data.user.email, email);
      assert.deepEqual(Object.keys(result.data.user).sort(), ['email', 'id', 'name']);

      const storedUser = await User.findOne({ email }).select('+passwordHash');
      assert.ok(storedUser);
      assert.notEqual(storedUser.passwordHash, password);
      assert.equal(await bcrypt.compare(password, storedUser.passwordHash), true);
      accounts.push(storedUser);
      return { email, password, token: result.data.token };
    };

    const first = await register(1);
    const login = await request('/api/auth/login', {
      method: 'POST',
      body: { email: first.email, password: first.password },
    });
    assert.equal(login.response.status, 200);
    const currentUser = await request('/api/auth/me', { token: login.data.token });
    assert.equal(currentUser.response.status, 200);
    assert.equal(currentUser.data.user.email, first.email);

    const second = await register(2);
    const protectedPaths = [
      '/api/dashboard/summary',
      '/api/sensors/latest',
      '/api/sensors/history?limit=1',
      '/api/alerts?limit=1',
      '/api/fan/status',
      '/api/reports',
      '/api/settings',
      '/api/simulator/scenario',
      '/api/images?limit=1',
      '/api/predictions?limit=1',
    ];

    for (const path of protectedPaths) {
      assert.equal((await request(path)).response.status, 401, `${path} must require authentication`);
      for (const account of [first, second]) {
        assert.equal(
          (await request(path, { token: account.token })).response.status,
          200,
          `${path} must be available to every authenticated account`,
        );
      }
    }

    const fanControl = await request('/api/fan/control', {
      token: first.token,
      method: 'POST',
      body: { mode: 'MANUAL', status: 'ON' },
    });
    assert.equal(fanControl.response.status, 200);
    assert.equal(fanControl.data.fan.status, 'ON');
    const autoFan = await request('/api/fan/control', {
      token: second.token,
      method: 'POST',
      body: { mode: 'AUTO' },
    });
    assert.equal(autoFan.response.status, 200);
    assert.equal(autoFan.data.fan.mode, 'AUTO');

    const scenarioUpdate = await request('/api/simulator/scenario', {
      token: second.token,
      method: 'PUT',
      body: { scenario: 'HIGH_GAS' },
    });
    assert.equal(scenarioUpdate.response.status, 200);
    assert.equal(scenarioUpdate.data.simulator.scenario, 'HIGH_GAS');
    await request('/api/simulator/scenario', {
      token: first.token,
      method: 'PUT',
      body: { scenario: 'NORMAL' },
    });

    const logout = await request('/api/auth/logout', { token: login.data.token, method: 'POST' });
    assert.equal(logout.response.status, 200);
    assert.equal((await request('/api/auth/me', { token: login.data.token })).response.status, 401);

    console.log('Unified authentication and common-access integration checks passed.');
  } finally {
    if (server) await new Promise((resolve) => server.close(resolve));
    if (accounts.length) await User.deleteMany({ _id: { $in: accounts.map(({ _id }) => _id) } });
    await mongoose.disconnect();
  }
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
