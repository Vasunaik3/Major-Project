import { getFanStatus, setManualFanStatus, switchFanToAuto } from '../services/fanService.js';

export async function fanStatus(_request, response) {
  response.json({ fan: await getFanStatus() });
}

export async function controlFan(request, response) {
  const { mode, status } = request.body;
  const fan = mode === 'MANUAL'
    ? await setManualFanStatus(status)
    : await switchFanToAuto();
  response.json({ fan });
}

export function validateFanControl(body) {
  const errors = [];
  if (!['AUTO', 'MANUAL'].includes(body.mode)) errors.push('mode must be AUTO or MANUAL.');
  if (body.mode === 'MANUAL' && !['ON', 'OFF'].includes(body.status)) {
    errors.push('status must be ON or OFF when mode is MANUAL.');
  }
  if (body.mode === 'AUTO' && body.status !== undefined) {
    errors.push('status must be omitted when mode is AUTO.');
  }
  return errors;
}
