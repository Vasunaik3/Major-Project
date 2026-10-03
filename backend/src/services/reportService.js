import Alert from '../models/Alert.js';
import FanActivity from '../models/FanActivity.js';
import SensorReading from '../models/SensorReading.js';
import StorageCondition from '../models/StorageCondition.js';

const CONDITION_STATES = ['NORMAL', 'WARNING', 'CRITICAL'];

function maximumSampleGapMs() {
  const configured = Number(process.env.REPORT_MAX_SAMPLE_GAP_MS);
  const interval = Number(process.env.SIMULATOR_INTERVAL_MS) || 5000;
  return Number.isFinite(configured) && configured > 0 ? configured : Math.max(interval * 2, 15_000);
}

export function summarizeValues(readings, field) {
  if (!readings.length) return { average: null, minimum: null, maximum: null, samples: 0 };
  const values = readings.map((reading) => reading[field]).filter(Number.isFinite);
  if (!values.length) return { average: null, minimum: null, maximum: null, samples: 0 };
  return {
    average: values.reduce((sum, value) => sum + value, 0) / values.length,
    minimum: Math.min(...values),
    maximum: Math.max(...values),
    samples: values.length,
  };
}

function normalizeCondition(value) {
  if (value === 'GOOD') return 'NORMAL';
  return CONDITION_STATES.includes(value) ? value : null;
}

/** Calculate time in each state from transition samples, capping gaps to avoid inventing downtime. */
export function calculateStateDurations(records, from, to, getState, maxGapMs = maximumSampleGapMs(), states = CONDITION_STATES) {
  const startMs = new Date(from).getTime();
  const endMs = new Date(to).getTime();
  const durations = Object.fromEntries(states.map((state) => [state, 0]));
  const sorted = [...records]
    .map((record) => ({ timestamp: new Date(record.timestamp), state: getState(record) }))
    .filter((record) => Number.isFinite(record.timestamp.getTime()) && record.state && record.timestamp.getTime() <= endMs)
    .sort((left, right) => left.timestamp - right.timestamp);

  for (let index = 0; index < sorted.length; index += 1) {
    const current = sorted[index];
    const currentMs = current.timestamp.getTime();
    const nextMs = sorted[index + 1]?.timestamp.getTime() ?? endMs;
    const segmentStart = Math.max(startMs, currentMs);
    const segmentEnd = Math.min(endMs, nextMs, currentMs + maxGapMs);
    if (segmentEnd > segmentStart && Object.hasOwn(durations, current.state)) {
      durations[current.state] += segmentEnd - segmentStart;
    }
  }
  return durations;
}

async function getTransitionSeries(Model, filter, start, end, stateExpression) {
  const predecessor = await Model.findOne({ ...filter, timestamp: { $lt: start } })
    .sort({ timestamp: -1, _id: -1 })
    .lean();
  const transitions = await Model.aggregate([
    { $match: { ...filter, timestamp: { $gte: start, $lte: end } } },
    { $sort: { timestamp: 1, _id: 1 } },
    { $set: { reportState: stateExpression } },
    {
      $setWindowFields: {
        sortBy: { timestamp: 1, _id: 1 },
        output: { previousState: { $shift: { output: '$reportState', by: -1, default: null } } },
      },
    },
    { $match: { $expr: { $ne: ['$reportState', '$previousState'] } } },
    { $project: { timestamp: 1, state: '$reportState' } },
  ]);

  const points = [];
  if (predecessor) {
    const state = typeof stateExpression === 'string'
      ? predecessor[stateExpression.replace('$', '')]
      : (predecessor.status || predecessor.condition);
    points.push({ timestamp: start, state });
  }
  for (const transition of transitions) {
    const state = normalizeCondition(transition.state) || transition.state;
    if (points.length && points[points.length - 1].state === state) continue;
    points.push({ timestamp: transition.timestamp, state });
  }
  return points;
}

async function getFanTransitions(start, end) {
  const predecessor = await FanActivity.findOne({ timestamp: { $lt: start } }).sort({ timestamp: -1, _id: -1 }).lean();
  const transitions = await FanActivity.aggregate([
    { $match: { timestamp: { $gte: start, $lte: end } } },
    { $sort: { timestamp: 1, _id: 1 } },
    { $set: { reportState: '$status' } },
    {
      $setWindowFields: {
        sortBy: { timestamp: 1, _id: 1 },
        output: { previousState: { $shift: { output: '$reportState', by: -1, default: null } } },
      },
    },
    { $match: { $expr: { $ne: ['$reportState', '$previousState'] } } },
    { $project: { timestamp: 1, state: '$reportState' } },
  ]);
  const points = [];
  if (predecessor) points.push({ timestamp: start, state: predecessor.status });
  for (const transition of transitions) {
    if (points.length && points[points.length - 1].state === transition.state) continue;
    points.push({ timestamp: transition.timestamp, state: transition.state });
  }
  return points;
}

function alertSeverityKey(severity) {
  if (severity === 'WARNING') return 'MEDIUM';
  if (severity === 'INFO') return 'LOW';
  return ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].includes(severity) ? severity : 'LOW';
}

export async function buildStorageReport({ from, to }) {
  const range = { timestamp: { $gte: from, $lte: to } };
  const maxGapMs = maximumSampleGapMs();
  const chartBuckets = 1200;

  const [sensorSummaryRows, sensorCharts, alertSummaryRows, alerts, fanSummaryRows, fanHistory, fanHistoryCount, conditionHistory, conditionHistoryCount, conditionTransitions, fanTransitions] = await Promise.all([
    SensorReading.aggregate([
      { $match: range },
      {
        $group: {
          _id: null,
          count: { $sum: 1 },
          temperatureAverage: { $avg: '$temperature' },
          temperatureMinimum: { $min: '$temperature' },
          temperatureMaximum: { $max: '$temperature' },
          humidityAverage: { $avg: '$humidity' },
          humidityMinimum: { $min: '$humidity' },
          humidityMaximum: { $max: '$humidity' },
          gasLevelAverage: { $avg: '$gasLevel' },
          gasLevelMinimum: { $min: '$gasLevel' },
          gasLevelMaximum: { $max: '$gasLevel' },
        },
      },
    ]),
    SensorReading.aggregate([
      { $match: range },
      {
        $bucketAuto: {
          groupBy: '$timestamp',
          buckets: chartBuckets,
          output: {
            timestamp: { $min: '$timestamp' },
            temperature: { $avg: '$temperature' },
            humidity: { $avg: '$humidity' },
            gasLevel: { $avg: '$gasLevel' },
          },
        },
      },
      { $sort: { timestamp: 1 } },
    ]),
    Alert.aggregate([
      { $match: range },
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          unresolved: { $sum: { $cond: ['$resolved', 0, 1] } },
          critical: { $sum: { $cond: [{ $eq: ['$severity', 'CRITICAL'] }, 1, 0] } },
          high: { $sum: { $cond: [{ $eq: ['$severity', 'HIGH'] }, 1, 0] } },
          medium: { $sum: { $cond: [{ $in: ['$severity', ['MEDIUM', 'WARNING']] }, 1, 0] } },
          low: { $sum: { $cond: [{ $in: ['$severity', ['LOW', 'INFO']] }, 1, 0] } },
        },
      },
    ]),
    Alert.find(range).sort({ timestamp: -1, _id: -1 }).limit(500).lean(),
    FanActivity.aggregate([
      { $match: range },
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          onEvents: { $sum: { $cond: [{ $eq: ['$status', 'ON'] }, 1, 0] } },
          offEvents: { $sum: { $cond: [{ $eq: ['$status', 'OFF'] }, 1, 0] } },
          autoEvents: { $sum: { $cond: [{ $eq: ['$mode', 'AUTO'] }, 1, 0] } },
          manualEvents: { $sum: { $cond: [{ $eq: ['$mode', 'MANUAL'] }, 1, 0] } },
        },
      },
    ]),
    FanActivity.find(range).sort({ timestamp: -1, _id: -1 }).limit(500).lean(),
    FanActivity.countDocuments(range),
    StorageCondition.find(range).sort({ timestamp: -1, _id: -1 }).limit(500).lean(),
    StorageCondition.countDocuments(range),
    getTransitionSeries(StorageCondition, {}, from, to, { $ifNull: ['$status', '$condition'] }),
    getFanTransitions(from, to),
  ]);

  const sensorSummary = sensorSummaryRows[0] || { count: 0 };
  const alertSummary = alertSummaryRows[0] || { total: 0, unresolved: 0, critical: 0, high: 0, medium: 0, low: 0 };
  const fanSummary = fanSummaryRows[0] || { total: 0, onEvents: 0, offEvents: 0, autoEvents: 0, manualEvents: 0 };
  const conditionDurations = calculateStateDurations(
    conditionTransitions,
    from,
    to,
    (record) => normalizeCondition(record.state),
    maxGapMs,
  );
  const fanDurations = calculateStateDurations(
    fanTransitions,
    from,
    to,
    (record) => record.state,
    Math.max(maxGapMs, to.getTime() - from.getTime()),
    ['ON', 'OFF'],
  );

  return {
    range: { from, to },
    sensorSummary: {
      samples: sensorSummary.count,
      temperature: { average: sensorSummary.temperatureAverage ?? null, minimum: sensorSummary.temperatureMinimum ?? null, maximum: sensorSummary.temperatureMaximum ?? null },
      humidity: { average: sensorSummary.humidityAverage ?? null, minimum: sensorSummary.humidityMinimum ?? null, maximum: sensorSummary.humidityMaximum ?? null },
      gasLevel: { average: sensorSummary.gasLevelAverage ?? null, minimum: sensorSummary.gasLevelMinimum ?? null, maximum: sensorSummary.gasLevelMaximum ?? null },
    },
    charts: sensorCharts,
    alerts: {
      total: alertSummary.total,
      unresolved: alertSummary.unresolved,
      bySeverity: { LOW: alertSummary.low, MEDIUM: alertSummary.medium, HIGH: alertSummary.high, CRITICAL: alertSummary.critical },
      history: alerts,
      historyTruncated: alertSummary.total > alerts.length,
    },
    conditionTime: { milliseconds: conditionDurations, estimatedFromSamples: true, maxSampleGapMs: maxGapMs },
    storageHistory: conditionHistory,
    storageHistoryCount: conditionHistoryCount,
    storageHistoryTruncated: conditionHistoryCount > conditionHistory.length,
    fanActivity: {
      ...fanSummary,
      onDurationMs: fanDurations.ON,
      offDurationMs: fanDurations.OFF,
      durationAssumption: 'The last recorded fan state continues until the next fan activity or report end.',
      history: fanHistory,
      historyCount: fanHistoryCount,
      historyTruncated: fanHistoryCount > fanHistory.length,
    },
    // AI metrics are intentionally absent until a dataset and trained model exist.
  };
}
