import assert from 'node:assert/strict';
import test from 'node:test';
import { calculateStateDurations, summarizeValues } from '../src/services/reportService.js';

test('summarizes readings without losing zero values', () => {
  const result = summarizeValues([{ temperature: 0 }, { temperature: 10 }], 'temperature');
  assert.deepEqual(result, { average: 5, minimum: 0, maximum: 10, samples: 2 });
});

test('caps condition duration across missing sample gaps', () => {
  const from = new Date('2026-10-03T00:00:00.000Z');
  const to = new Date('2026-10-03T00:04:00.000Z');
  const transitions = [
    { timestamp: from, state: 'NORMAL' },
    { timestamp: new Date(from.getTime() + 60_000), state: 'WARNING' },
    { timestamp: new Date(from.getTime() + 180_000), state: 'CRITICAL' },
  ];
  const result = calculateStateDurations(transitions, from, to, (record) => record.state, 120_000);
  assert.deepEqual(result, { NORMAL: 60_000, WARNING: 120_000, CRITICAL: 60_000 });
});

test('maps legacy GOOD storage state to NORMAL for duration totals', () => {
  const from = new Date('2026-10-03T00:00:00.000Z');
  const result = calculateStateDurations(
    [{ timestamp: from, state: 'NORMAL' }, { timestamp: new Date(from.getTime() + 60_000), state: 'GOOD' }],
    from,
    new Date(from.getTime() + 120_000),
    (record) => record.state === 'GOOD' ? 'NORMAL' : record.state,
    120_000,
  );
  assert.equal(result.NORMAL, 120_000);
});
