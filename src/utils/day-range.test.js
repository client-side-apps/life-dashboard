import { test } from 'node:test';
import assert from 'node:assert';
import { dayStartTs, dayEndTs, toDayKey, getDaysWindow, shiftLocalDays } from './day-range.js';

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

// A daylight saving change makes a local day 23 or 25 hours long. The tests
// below pin a zone that observes it, so they hold wherever they are run.
process.env.TZ = 'America/Los_Angeles';

test('shiftLocalDays moves one calendar day across the autumn 25-hour day', () => {
    const fallBack = new Date(2025, 10, 2).getTime(); // 2025-11-02, 25 hours long

    assert.strictEqual(shiftLocalDays(fallBack, 1), new Date(2025, 10, 3).getTime());
    assert.strictEqual(shiftLocalDays(fallBack, -1), new Date(2025, 10, 1).getTime());
});

test('shiftLocalDays moves one calendar day across the spring 23-hour day', () => {
    const springForward = new Date(2025, 2, 9).getTime(); // 2025-03-09, 23 hours long

    assert.strictEqual(shiftLocalDays(springForward, 1), new Date(2025, 2, 10).getTime());
    assert.strictEqual(shiftLocalDays(springForward, -1), new Date(2025, 2, 8).getTime());
});

test('stepping day by day always advances, so a range spanning a change terminates', () => {
    const endTs = new Date(2025, 10, 10).getTime();
    let steps = 0;

    for (let dayTs = new Date(2025, 9, 25).getTime(); dayTs <= endTs; dayTs = shiftLocalDays(dayTs, 1)) {
        assert.ok(++steps <= 32, 'the loop never advanced past a daylight saving change');
    }

    assert.strictEqual(steps, 17); // Oct 25 to Nov 10 inclusive
});

test('a rolling window of 7 days holds 7 distinct days across a change', () => {
    const day = new Date(2025, 2, 12).getTime(); // Window reaches back over 2025-03-09
    const window = new Set();

    for (let i = 0; i < 7; i++) {
        window.add(shiftLocalDays(day, -i));
    }

    assert.strictEqual(window.size, 7);
    assert.ok(window.has(new Date(2025, 2, 9).getTime()), 'the shortened day is counted once');
});
