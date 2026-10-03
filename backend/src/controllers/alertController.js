import Alert from '../models/Alert.js';

export async function listAlerts(request, response) {
  const { resolved, severity } = request.query;
  const limit = Number(request.query.limit ?? 100);
  if (resolved !== undefined && !['true', 'false'].includes(resolved)) {
    return response.status(400).json({ error: 'resolved must be true or false.' });
  }
  if (!Number.isInteger(limit) || limit < 1 || limit > 500) {
    return response.status(400).json({ error: 'limit must be an integer from 1 to 500.' });
  }
  if (severity !== undefined && !['LOW', 'MEDIUM', 'HIGH', 'CRITICAL', 'INFO', 'WARNING'].includes(severity)) {
    return response.status(400).json({ error: 'severity must be LOW, MEDIUM, HIGH, or CRITICAL.' });
  }

  const filter = {};
  if (resolved !== undefined) filter.resolved = resolved === 'true';
  if (severity) filter.severity = severity;
  const alerts = await Alert.find(filter).sort({ timestamp: -1 }).limit(limit).lean();
  response.json({ alerts, count: alerts.length });
}

export async function resolveAlert(request, response) {
  const alert = await Alert.findByIdAndUpdate(
    request.params.id,
    { resolved: true, resolvedAt: new Date(), resolutionReason: 'Resolved by operator.' },
    { new: true, runValidators: true },
  );
  if (!alert) return response.status(404).json({ error: 'Alert not found.' });
  response.json({ alert });
}
