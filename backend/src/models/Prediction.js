import mongoose from 'mongoose';

const predictionSchema = new mongoose.Schema(
  {
    imageId: { type: mongoose.Schema.Types.ObjectId, ref: 'OnionImage', required: true },
    // Null until a trained model is integrated; no inference is performed by this prototype.
    predictedClass: { type: String, default: null, trim: true },
    confidence: { type: Number, default: null, min: 0, max: 1 },
    modelVersion: { type: String, default: null, trim: true },
    status: {
      type: String,
      enum: ['NOT_AVAILABLE', 'QUEUED', 'COMPLETED', 'FAILED'],
      default: 'NOT_AVAILABLE',
      required: true,
    },
    timestamp: { type: Date, default: Date.now, required: true },
  },
  { timestamps: true, versionKey: false },
);

predictionSchema.index({ imageId: 1, timestamp: -1 });
predictionSchema.index({ modelVersion: 1, timestamp: -1 });

export default mongoose.models.Prediction || mongoose.model('Prediction', predictionSchema);
