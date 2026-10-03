export function validateBody(validator) {
  return (request, response, next) => {
    const errors = validator(request.body ?? {});
    if (errors.length > 0) {
      return response.status(400).json({ error: 'Validation failed', details: errors });
    }
    next();
  };
}

export function isEmail(value) {
  return typeof value === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

export function isFiniteNumber(value) {
  return typeof value === 'number' && Number.isFinite(value);
}

export function validateSensorPayload(body) {
  const errors = [];
  if (typeof body.deviceId !== 'string' || body.deviceId.trim().length === 0) {
    errors.push('deviceId is required and must be a non-empty string.');
  }
  for (const field of ['temperature', 'humidity', 'gasLevel']) {
    if (!isFiniteNumber(body[field])) errors.push(`${field} must be a finite number.`);
  }
  if (isFiniteNumber(body.temperature) && (body.temperature < -50 || body.temperature > 100)) {
    errors.push('temperature must be between -50 and 100 °C.');
  }
  if (isFiniteNumber(body.humidity) && (body.humidity < 0 || body.humidity > 100)) {
    errors.push('humidity must be between 0 and 100%.');
  }
  if (isFiniteNumber(body.gasLevel) && body.gasLevel < 0) {
    errors.push('gasLevel must be zero or greater.');
  }
  if (body.timestamp !== undefined && Number.isNaN(Date.parse(body.timestamp))) {
    errors.push('timestamp must be a valid date.');
  }
  if (body.source !== undefined && !['SIMULATED', 'HARDWARE'].includes(body.source)) {
    errors.push('source must be SIMULATED or HARDWARE.');
  }
  return errors;
}
