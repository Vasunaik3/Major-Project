import mongoose from 'mongoose';

const storageConditionSchema = new mongoose.Schema(
  {
    deviceId: { type: String, required: true, trim: true },
    condition: { type: String, enum: ['NORMAL', 'GOOD', 'WARNING', 'CRITICAL'], required: true },
    status: { type: String, enum: ['NORMAL', 'GOOD', 'WARNING', 'CRITICAL'], required: true },
    reason: { type: String, trim: true, maxlength: 500, default: '' },
    message: { type: String, trim: true, maxlength: 500, default: '' },
    temperatureStatus: { type: String, enum: ['NORMAL', 'WARNING', 'CRITICAL'], required: true },
    humidityStatus: { type: String, enum: ['NORMAL', 'WARNING', 'CRITICAL'], required: true },
    gasStatus: { type: String, enum: ['NORMAL', 'WARNING', 'CRITICAL'], required: true },
    abnormalMetrics: [{ metric: { type: String }, status: { type: String, enum: ['WARNING', 'CRITICAL'] } }],
    sustainedMetrics: [{ metric: { type: String }, durationMs: { type: Number }, readings: { type: Number } }],
    thresholds: { type: mongoose.Schema.Types.Mixed, default: {} },
    sensorReading: { type: mongoose.Schema.Types.ObjectId, ref: 'SensorReading', default: null },
    source: { type: String, enum: ['SIMULATED', 'HARDWARE'], default: 'SIMULATED' },
    timestamp: { type: Date, default: Date.now, required: true },
  },
  { timestamps: true, versionKey: false },
);

storageConditionSchema.index({ timestamp: -1 });
storageConditionSchema.index({ deviceId: 1, timestamp: -1 });
storageConditionSchema.index({ deviceId: 1, condition: 1, timestamp: -1 });

export default mongoose.models.StorageCondition || mongoose.model('StorageCondition', storageConditionSchema);
