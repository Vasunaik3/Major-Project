import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import Alert from '../src/models/Alert.js';
import SensorReading from '../src/models/SensorReading.js';
import { checkSensorDataStaleness, evaluateAlerts } from '../src/services/alertService.js';

const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/smart_onion_storage';
const deviceId = `ALERT_LIFECYCLE_TEST_${Date.now()}`;

async function run() {
  process.env.ALERT_SIGNIFICANT_CHANGE_COOLDOWN_MS = '30000';
  await mongoose.connect(uri);

  try {
    const addReading = async (values = {}, timestamp = new Date()) => {
      const reading = await SensorReading.create({
        deviceId,
        temperature: 26.5,
        humidity: 68,
        gasLevel: 180,
        ...values,
        timestamp,
      });
      return { reading, changes: await evaluateAlerts(reading) };
    };

    let result = await addReading({ temperature: 31 });
    assert.equal(result.changes.created.length, 1, 'abnormal start creates one alert');
    assert.equal(result.changes.created[0].type, 'TEMPERATURE_HIGH');

    result = await addReading({ temperature: 31 });
    assert.equal(result.changes.created.length, 0, 'same ongoing condition is deduplicated');

    result = await addReading({ temperature: 33 });
    assert.equal(result.changes.created[0]?.severity, 'HIGH', 'severity escalation creates an event');

    result = await addReading();
    assert.ok(result.changes.resolved.some((alert) => alert.type === 'TEMPERATURE_HIGH'), 'normal recovery resolves the alert');

    await SensorReading.deleteMany({ deviceId });
    await SensorReading.create({
      deviceId,
      temperature: 26.5,
      humidity: 68,
      gasLevel: 180,
      timestamp: new Date(Date.now() - 30_000),
    });
    let stale = await checkSensorDataStaleness(new Date());
    assert.ok(stale.created.some((alert) => alert.type === 'SENSOR_DATA_STALE'), 'stale data creates an alert');

    stale = await checkSensorDataStaleness(new Date());
    assert.equal(stale.created.length, 0, 'ongoing stale state is deduplicated');

    result = await addReading();
    assert.ok(result.changes.resolved.some((alert) => alert.type === 'SENSOR_DATA_STALE'), 'new data resolves stale alert');
    console.log('Alert lifecycle integration checks passed.');
  } finally {
    await Alert.deleteMany({ deviceId });
    await SensorReading.deleteMany({ deviceId });
    await mongoose.disconnect();
  }
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
