import assert from 'node:assert/strict';
import { unlink } from 'node:fs/promises';
import path from 'node:path';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import app from '../src/app.js';
import OnionImage from '../src/models/OnionImage.js';
import User from '../src/models/User.js';
import { uploadDirectory } from '../src/middleware/imageUpload.js';

const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/smart_onion_storage';
const secret = `IMAGE_API_TEST_${Date.now()}_${Math.random()}`;
process.env.JWT_SECRET = secret;

async function run() {
  await mongoose.connect(uri);
  const email = `image-api-${Date.now()}@example.com`;
  let user;
  let server;
  let imageId;
  let savedFile;

  try {
    user = await User.create({ name: 'Image API Test', email, passwordHash: 'test-hash', role: 'OPERATOR' });
    const token = jwt.sign({ sub: user.id, tokenVersion: user.tokenVersion ?? 0 }, secret, { expiresIn: '5m' });
    server = app.listen(0);
    await new Promise((resolve) => server.once('listening', resolve));
    const origin = `http://127.0.0.1:${server.address().port}`;
    const authHeaders = { Authorization: `Bearer ${token}` };

    const validBytes = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00]);
    const form = new FormData();
    form.append('image', new Blob([validBytes], { type: 'image/png' }), 'sample.png');
    const uploadResponse = await fetch(`${origin}/api/images`, { method: 'POST', headers: authHeaders, body: form });
    assert.equal(uploadResponse.status, 201);
    const uploadPayload = await uploadResponse.json();
    imageId = uploadPayload.image._id;
    savedFile = path.join(uploadDirectory, path.basename(uploadPayload.image.imageUrl));
    assert.equal(uploadPayload.image.analysisStatus, 'MODEL_NOT_AVAILABLE');
    assert.equal(uploadPayload.image.predictedClass, null);
    assert.equal(uploadPayload.image.confidence, null);
    assert.equal(uploadPayload.image.modelVersion, null);
    assert.match(uploadPayload.message, /model has not yet been trained/i);

    const uploadedFileUrl = new URL(uploadPayload.image.imageUrl, origin);
    assert.equal((await fetch(uploadedFileUrl)).status, 401, 'uploaded image files require authentication');
    const fileResponse = await fetch(uploadedFileUrl, { headers: authHeaders });
    assert.equal(fileResponse.status, 200);
    assert.equal(fileResponse.headers.get('content-type'), 'image/png');
    assert.deepEqual(Buffer.from(await fileResponse.arrayBuffer()), validBytes);

    const listResponse = await fetch(`${origin}/api/images?limit=10`, { headers: authHeaders });
    const listPayload = await listResponse.json();
    assert.equal(listResponse.status, 200);
    assert.ok(listPayload.images.some((image) => image._id === imageId));

    const detailResponse = await fetch(`${origin}/api/images/${imageId}`, { headers: authHeaders });
    const detailPayload = await detailResponse.json();
    assert.equal(detailResponse.status, 200);
    assert.equal(detailPayload.image._id, imageId);

    const invalidForm = new FormData();
    invalidForm.append('image', new Blob(['not a png'], { type: 'image/png' }), 'invalid.png');
    const invalidResponse = await fetch(`${origin}/api/images`, { method: 'POST', headers: authHeaders, body: invalidForm });
    assert.equal(invalidResponse.status, 400);
    console.log('Image upload API integration checks passed.');
  } finally {
    if (imageId) await OnionImage.deleteOne({ _id: imageId });
    if (savedFile) await unlink(savedFile).catch(() => {});
    if (user) await User.deleteOne({ _id: user._id });
    if (server) await new Promise((resolve) => server.close(resolve));
    await mongoose.disconnect();
  }
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
