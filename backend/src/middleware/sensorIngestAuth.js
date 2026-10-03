export function sensorIngestAuth(request, response, next) {
  const expectedToken = process.env.SENSOR_INGEST_TOKEN;
  if (!expectedToken) return next();

  if (request.get('x-sensor-token') !== expectedToken) {
    return response.status(401).json({ error: 'Invalid sensor ingestion token.' });
  }
  next();
}
