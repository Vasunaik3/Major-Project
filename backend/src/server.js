import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { connectDatabase } from './config/database.js';
import { startAlertMonitor } from './services/alertService.js';
import { loadStorageThresholds } from './services/storageConditionService.js';
import { startSensorSimulator } from './simulator/sensorSimulator.js';

dotenv.config();

async function startServer() {
  if (!process.env.JWT_SECRET) {
    throw new Error('JWT_SECRET must be configured. Copy .env.example to .env and set a private secret.');
  }

  await connectDatabase();
  await loadStorageThresholds();
  const { default: app } = await import('./app.js');
  const port = Number(process.env.PORT) || 5000;
  let stopSimulator = () => {};
  let stopAlertMonitor = () => {};
  const server = app.listen(port, () => {
    console.log(`Smart Onion Storage API listening on port ${port}`);
    stopSimulator = startSensorSimulator();
    stopAlertMonitor = startAlertMonitor();
  });

  const shutdown = async () => {
    stopSimulator();
    stopAlertMonitor();
    server.close(async () => {
      await mongoose.disconnect();
      process.exit(0);
    });
  };
  process.once('SIGINT', shutdown);
  process.once('SIGTERM', shutdown);
}

startServer().catch((error) => {
  console.error('Backend startup failed:', error.message);
  process.exitCode = 1;
});
