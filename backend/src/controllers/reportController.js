import { buildStorageReport } from '../services/reportService.js';

const MAX_RANGE_DAYS = 366;

function parseDate(value, endOfDay = false) {
  if (typeof value !== 'string') return null;
  const dateOnly = /^\d{4}-\d{2}-\d{2}$/.test(value);
  const date = new Date(dateOnly ? `${value}T${endOfDay ? '23:59:59.999' : '00:00:00.000'}Z` : value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export async function getStorageReport(request, response) {
  const now = new Date();
  const to = request.query.to ? parseDate(request.query.to, true) : now;
  const from = request.query.from
    ? parseDate(request.query.from)
    : new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  if (!from || !to) return response.status(400).json({ error: 'from and to must be valid ISO dates or YYYY-MM-DD values.' });
  if (from > to) return response.status(400).json({ error: 'from must be earlier than or equal to to.' });
  if (to.getTime() - from.getTime() > MAX_RANGE_DAYS * 24 * 60 * 60 * 1000) {
    return response.status(400).json({ error: `Report date range cannot exceed ${MAX_RANGE_DAYS} days.` });
  }

  const report = await buildStorageReport({ from, to });
  response.json({ report });
}
