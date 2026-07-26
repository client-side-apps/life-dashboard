import { test } from 'node:test';
import assert from 'node:assert';
import { dayStartTs, dayEndTs, toDayKey, getDaysWindow } from './day-range.js';

test('dayStartTs and dayEndTs bound the UTC day', () => {
    assert.strictEqual(dayStartTs('2026-02-17'), Date.UTC(2026, 1, 17, 0, 0, 0, 0));
    assert.strictEqual(dayEndTs('2026-02-17'), Date.UTC(2026, 1, 17, 23, 59, 59, 999));
});

test('toDayKey returns the UTC day of a timestamp', () => {
    assert.strictEqual(toDayKey(dayStartTs('2026-02-17')), '2026-02-17');
    assert.strictEqual(toDayKey(dayEndTs('2026-02-17')), '2026-02-17');
});

test('getDaysWindow spans the whole batch of days', () => {
    const days = ['2026-02-17', '2026-02-16', '2026-02-15']; // Most recent first
    const { startTs, endTs } = getDaysWindow(days, 0, Number.MAX_SAFE_INTEGER);

    assert.strictEqual(startTs, dayStartTs('2026-02-15'));
    assert.strictEqual(endTs, dayEndTs('2026-02-17'));
});

test('getDaysWindow never reaches outside the selected range', () => {
    const days = ['2026-02-17', '2026-02-16', '2026-02-15'];
    const rangeStartTs = dayStartTs('2026-02-15') + 3600 * 1000;
    const rangeEndTs = dayEndTs('2026-02-17') - 3600 * 1000;

    const { startTs, endTs } = getDaysWindow(days, rangeStartTs, rangeEndTs);

    assert.strictEqual(startTs, rangeStartTs);
    assert.strictEqual(endTs, rangeEndTs);
});

test('consecutive batches cover a day list without gap or overlap', () => {
    const days = ['2026-02-17', '2026-02-16', '2026-02-15', '2026-02-14'];
    const rangeStartTs = dayStartTs('2026-02-14');
    const rangeEndTs = dayEndTs('2026-02-17');

    const first = getDaysWindow(days.slice(0, 2), rangeStartTs, rangeEndTs);
    const second = getDaysWindow(days.slice(2), rangeStartTs, rangeEndTs);

    assert.strictEqual(first.endTs, rangeEndTs);
    assert.strictEqual(second.startTs, rangeStartTs);
    assert.strictEqual(second.endTs + 1, first.startTs);
});
