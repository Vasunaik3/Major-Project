import { refreshSensorSimulatorInterval } from '../simulator/sensorSimulator.js';
import { loadSystemSettings, saveSystemSettings, validateSystemSettings } from '../services/systemSettingsService.js';

export async function getSettings(_request, response) {
  response.json({ settings: await loadSystemSettings() });
}

export async function putSettings(request, response) {
  const settings = await saveSystemSettings(request.body, request.user._id);
  refreshSensorSimulatorInterval();
  response.json({ settings, message: 'System settings saved and applied.' });
}

export function validateSettings(body) {
  return validateSystemSettings(body);
}
