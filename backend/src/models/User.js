import mongoose from 'mongoose';

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 100 },
    email: { type: String, required: true, lowercase: true, trim: true, maxlength: 254 },
    passwordHash: { type: String, required: true, select: false },
    role: { type: String, enum: ['ADMIN', 'OPERATOR', 'VIEWER'], default: 'VIEWER' },
    tokenVersion: { type: Number, default: 0, min: 0 },
  },
  { timestamps: true, versionKey: false },
);

userSchema.index({ email: 1 }, { unique: true });

export default mongoose.models.User || mongoose.model('User', userSchema);
