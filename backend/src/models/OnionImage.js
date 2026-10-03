import mongoose from 'mongoose';

const onionImageSchema = new mongoose.Schema(
  {
    imageUrl: { type: String, required: true, trim: true },
    originalName: { type: String, required: true, trim: true, maxlength: 255 },
    mimeType: { type: String, enum: ['image/jpeg', 'image/png', 'image/webp'], required: true },
    sizeBytes: { type: Number, required: true, min: 1 },
    uploadedAt: { type: Date, default: Date.now, required: true },
    analysisStatus: {
      type: String,
      enum: ['PENDING', 'PROCESSING', 'COMPLETED', 'MODEL_NOT_AVAILABLE', 'FAILED'],
      default: 'MODEL_NOT_AVAILABLE',
      required: true,
    },
    predictedClass: { type: String, default: null, trim: true },
    confidence: { type: Number, default: null, min: 0, max: 1 },
    modelVersion: { type: String, default: null, trim: true },
    analyzedAt: { type: Date, default: null },
  },
  { timestamps: true, versionKey: false },
);

onionImageSchema.index({ uploadedAt: -1 });
onionImageSchema.index({ analysisStatus: 1, uploadedAt: -1 });

export default mongoose.models.OnionImage || mongoose.model('OnionImage', onionImageSchema);
