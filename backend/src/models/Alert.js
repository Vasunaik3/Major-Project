import mongoose from 'mongoose';

const alertSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: [
        'TEMPERATURE_HIGH', 'TEMPERATURE_LOW', 'HUMIDITY_HIGH', 'HUMIDITY_LOW',
        'GAS_HIGH', 'GAS_ABNORMAL', 'MULTIPLE_ABNORMAL', 'SENSOR_DATA_STALE', 'SYSTEM',
      ],
      required: true,
    },
    severity: { type: String, enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL', 'INFO', 'WARNING'], required: true },
    message: { type: String, required: true, trim: true, maxlength: 500 },
    deviceId: { type: String, trim: true, default: null },
    sensorValue: { type: Number, default: null },
    threshold: { type: Number, default: null },
    resolved: { type: Boolean, default: false },
    resolvedAt: { type: Date, default: null },
    resolutionReason: { type: String, trim: true, maxlength: 300, default: null },
    timestamp: { type: Date, default: Date.now, required: true },
  },
  { timestamps: true, versionKey: false },
);

alertSchema.index({ resolved: 1, timestamp: -1 });
alertSchema.index({ severity: 1, timestamp: -1 });
alertSchema.index(
  { deviceId: 1, type: 1 },
  {
    unique: true,
    name: 'one_open_alert_per_device_type',
    partialFilterExpression: { deviceId: { $type: 'string' }, resolved: false },
  },
);

export default mongoose.models.Alert || mongoose.model('Alert', alertSchema);
