import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { connectDatabase } from '../config/database.js';
import User from '../models/User.js';

dotenv.config();

async function seedAdmin() {
  const email = process.env.BOOTSTRAP_ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.BOOTSTRAP_ADMIN_PASSWORD;
  const name = process.env.BOOTSTRAP_ADMIN_NAME?.trim() || 'Storage Administrator';
  if (!email || !password || password.length < 12) {
    throw new Error('Set BOOTSTRAP_ADMIN_EMAIL and a BOOTSTRAP_ADMIN_PASSWORD with at least 12 characters in backend/.env.');
  }

  await connectDatabase();
  const passwordHash = await bcrypt.hash(password, 12);
  const admin = await User.findOneAndUpdate(
    { email },
    { $set: { name, email, passwordHash, role: 'ADMIN' } },
    { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true },
  );
  console.log(`Administrator account provisioned for ${admin.email}.`);
  await mongoose.disconnect();
}

seedAdmin().catch(async (error) => {
  console.error('Admin provisioning failed:', error.message);
  await mongoose.disconnect();
  process.exitCode = 1;
});
