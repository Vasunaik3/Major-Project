import mongoose from 'mongoose';

const fanActivitySchema = new mongoose.Schema(
  {
    mode: { type: String, enum: ['AUTO', 'MANUAL'], required: true },
    status: { type: String, enum: ['ON', 'OFF'], required: true },
    reason: { type: String, required: true, trim: true, maxlength: 300 },
    simulated: { type: Boolean, default: true, required: true },
    timestamp: { type: Date, default: Date.now, required: true },
  },
  { timestamps: true, versionKey: false },
);

fanActivitySchema.index({ timestamp: -1 });
fanActivitySchema.index({ mode: 1, timestamp: -1 });

export default mongoose.models.FanActivity || mongoose.model('FanActivity', fanActivitySchema);
