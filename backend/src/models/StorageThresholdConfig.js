import mongoose from 'mongoose';

const storageThresholdConfigSchema = new mongoose.Schema(
  {
    key: { type: String, enum: ['storage'], default: 'storage', unique: true },
    thresholds: { type: mongoose.Schema.Types.Mixed, required: true },
    simulator: { type: mongoose.Schema.Types.Mixed, default: {} },
    fanControl: { type: mongoose.Schema.Types.Mixed, default: {} },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true, versionKey: false },
);

export default mongoose.models.StorageThresholdConfig || mongoose.model('StorageThresholdConfig', storageThresholdConfigSchema);
