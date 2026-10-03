import User from '../models/User.js';
import { loadStorageThresholds, updateStorageThresholds } from '../services/storageConditionService.js';

const ROLES = ['ADMIN', 'OPERATOR', 'VIEWER'];

export async function listUsers(_request, response) {
  const users = await User.find().select('_id name email role createdAt').sort({ createdAt: -1 }).limit(500).lean();
  response.json({ users, count: users.length });
}

export async function changeUserRole(request, response) {
  const { role } = request.body;
  if (request.params.id === request.user.id && role !== 'ADMIN') {
    return response.status(400).json({ error: 'Administrators cannot change their own role.' });
  }
  const user = await User.findById(request.params.id);
  if (!user) return response.status(404).json({ error: 'User not found.' });

  if (user.role === 'ADMIN' && role !== 'ADMIN') {
    const adminCount = await User.countDocuments({ role: 'ADMIN' });
    if (adminCount <= 1) return response.status(409).json({ error: 'The final administrator cannot be demoted.' });
  }
  user.role = role;
  await user.save();
  response.json({ user: { id: user.id, name: user.name, email: user.email, role: user.role, createdAt: user.createdAt } });
}

export function validateRoleChange(body) {
  return ROLES.includes(body.role) ? [] : [`role must be one of: ${ROLES.join(', ')}.`];
}

export async function getThresholds(_request, response) {
  const thresholds = await loadStorageThresholds();
  response.json({ thresholds });
}

export async function putThresholds(request, response) {
  const thresholds = await updateStorageThresholds(request.body.thresholds, request.user._id);
  response.json({ thresholds, message: 'Storage thresholds updated.' });
}

export function validateThresholds(body) {
  const errors = [];
  const sensors = ['temperature', 'humidity', 'gasLevel'];
  for (const sensor of sensors) {
    const values = body.thresholds?.[sensor];
    if (!values || ['lowCritical', 'lowWarning', 'highWarning', 'highCritical'].some((key) => typeof values[key] !== 'number' || !Number.isFinite(values[key]))) {
      errors.push(`${sensor} requires numeric lowCritical, lowWarning, highWarning, and highCritical values.`);
      continue;
    }
    if (!(values.lowCritical < values.lowWarning && values.lowWarning < values.highWarning && values.highWarning < values.highCritical)) {
      errors.push(`${sensor} limits must follow lowCritical < lowWarning < highWarning < highCritical.`);
    }
  }
  return errors;
}
