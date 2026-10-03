import bcrypt from 'bcryptjs';
import User from '../models/User.js';
import { createAccessToken, publicUser } from '../services/authService.js';

export async function register(request, response) {
  const { name, email, password } = request.body;
  const passwordHash = await bcrypt.hash(password, 12);
  // Public registration cannot grant elevated privileges, even if a role is included in the request.
  const user = await User.create({ name: name.trim(), email: email.trim().toLowerCase(), passwordHash, role: 'VIEWER' });
  response.status(201).json({ user: publicUser(user), token: createAccessToken(user) });
}

export async function login(request, response) {
  const email = request.body.email.trim().toLowerCase();
  const user = await User.findOne({ email }).select('+passwordHash');
  if (!user || !(await bcrypt.compare(request.body.password, user.passwordHash))) {
    return response.status(401).json({ error: 'Invalid email or password.' });
  }
  response.json({ user: publicUser(user), token: createAccessToken(user) });
}

export function me(request, response) {
  response.json({ user: publicUser(request.user) });
}

export async function logout(request, response) {
  await User.updateOne({ _id: request.user._id }, { $inc: { tokenVersion: 1 } });
  response.json({ message: 'Signed out successfully.' });
}

export function validateRegister(body) {
  const errors = [];
  if (typeof body.name !== 'string' || body.name.trim().length < 2 || body.name.trim().length > 100) {
    errors.push('name must be between 2 and 100 characters.');
  }
  if (typeof body.email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email.trim())) {
    errors.push('email must be valid.');
  }
  if (typeof body.password !== 'string' || body.password.length < 8 || body.password.length > 128) {
    errors.push('password must be between 8 and 128 characters.');
  }
  return errors;
}

export function validateLogin(body) {
  const errors = [];
  if (typeof body.email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email.trim())) {
    errors.push('email must be valid.');
  }
  if (typeof body.password !== 'string' || body.password.length === 0) {
    errors.push('password is required.');
  }
  return errors;
}

