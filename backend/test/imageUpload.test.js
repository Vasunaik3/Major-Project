import assert from 'node:assert/strict';
import test from 'node:test';
import OnionImage from '../src/models/OnionImage.js';
import { matchesImageSignature } from '../src/middleware/imageUpload.js';

test('accepts matching JPEG, PNG, and WebP signatures', () => {
  assert.equal(matchesImageSignature(Buffer.from([0xff, 0xd8, 0xff, 0x00]), 'image/jpeg'), true);
  assert.equal(matchesImageSignature(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), 'image/png'), true);
  const webp = Buffer.alloc(12);
  webp.write('RIFF', 0, 'ascii');
  webp.write('WEBP', 8, 'ascii');
  assert.equal(matchesImageSignature(webp, 'image/webp'), true);
});

test('rejects file content that does not match its declared MIME type', () => {
  assert.equal(matchesImageSignature(Buffer.from('not an image'), 'image/jpeg'), false);
  assert.equal(matchesImageSignature(Buffer.from([0xff, 0xd8, 0xff]), 'image/png'), false);
});

test('new image records default to unavailable without fabricated prediction values', () => {
  const image = new OnionImage({
    imageUrl: '/uploads/sample.png',
    originalName: 'sample.png',
    mimeType: 'image/png',
    sizeBytes: 100,
  });
  assert.equal(image.analysisStatus, 'MODEL_NOT_AVAILABLE');
  assert.equal(image.predictedClass, null);
  assert.equal(image.confidence, null);
  assert.equal(image.modelVersion, null);
  assert.equal(image.validateSync(), undefined);
});
