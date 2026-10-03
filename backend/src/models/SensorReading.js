import mongoose from 'mongoose';

const sensorReadingSchema = new mongoose.Schema(
  {
    deviceId: { type: String, required: true, trim: true },
    temperature: { type: Number, required: true, min: -50, max: 100 },
    humidity: { type: Number, required: true, min: 0, max: 100 },
    gasLevel: { type: Number, required: true, min: 0 },
    timestamp: { type: Date, default: Date.now, required: true },
    source: { type: String, enum: ['SIMULATED', 'HARDWARE'], default: 'SIMULATED' },
  },
  { timestamps: true, versionKey: false },
);

sensorReadingSchema.index({ deviceId: 1, timestamp: -1 });
sensorReadingSchema.index({ timestamp: -1 });

export default mongoose.models.SensorReading || mongoose.model('SensorReading', sensorReadingSchema);
