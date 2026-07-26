import { test } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { dbService } from '../src/db.js';
import { getDaysWithData, getTimestampRangeData } from '../src/services/data-repository.js';
import { getDaysWindow, toDayKey } from '../src/utils/day-range.js';

// Same shape as the sources the timeline view reads from.
const SOURCES = [
    { table: 'location' },
    { table: 'steps', where: 'count > 0' },
    { table: 'weight' },
    { table: 'sleep' },
    { table: 'nutrition_servings' },
    { table: 'music' },
    { table: 'dives' },
    { table: 'calendar_events' }
];

const DAYS_PER_CHUNK = 7;

// Work on a copy: connecting runs schema migrations that would modify demo.sqlite.
function connectToDemoCopy() {
    const source = path.resolve(import.meta.dirname, '../demo.sqlite');
    const copy = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'life-dashboard-')), 'demo.sqlite');
    fs.copyFileSync(source, copy);
    return dbService.connectNode(copy);
}

function getFullRange() {
    let min = Infinity;
    let max = -Infinity;

    for (const { table } of SOURCES) {
        const rows = dbService.query(`SELECT MIN(timestamp) AS min_ts, MAX(timestamp) AS max_ts FROM "${table}"`);
        if (rows.length === 0 || rows[0].min_ts === null) continue;
        min = Math.min(min, rows[0].min_ts);
        max = Math.max(max, rows[0].max_ts);
    }

    // The view selects whole local days, as the date picker does.
    const startDate = new Date(min).toISOString().split('T')[0];
    const endDate = new Date(max).toISOString().split('T')[0];

    return {
        startTs: new Date(startDate + 'T00:00:00').getTime(),
        endTs: new Date(endDate + 'T23:59:59.999').getTime()
    };
}

test('getDaysWithData lists days holding data, most recent first', async () => {
    await connectToDemoCopy();
    const { startTs, endTs } = getFullRange();

    const days = getDaysWithData(SOURCES, startTs, endTs);

    assert.ok(days.length > 0, 'demo database should hold data');
    assert.strictEqual(new Set(days).size, days.length, 'days should be unique');
    assert.deepStrictEqual(days, [...days].sort().reverse(), 'days should be sorted most recent first');

    for (const day of days) {
        const { startTs: dayStart, endTs: dayEnd } = getDaysWindow([day], startTs, endTs);
        const rows = SOURCES.flatMap(({ table }) => getTimestampRangeData(table, dayStart, dayEnd));
        assert.ok(rows.length > 0, `day ${day} should hold at least one row`);
    }
});

test('reading days in batches covers every row exactly once', async () => {
    await connectToDemoCopy();
    const { startTs, endTs } = getFullRange();

    const days = getDaysWithData(SOURCES, startTs, endTs);
    const daysWithData = new Set(days);
    assert.ok(days.length > DAYS_PER_CHUNK, 'demo database should span several batches');

    for (const { table } of SOURCES) {
        // What a single query over the whole range returns, restricted to the days rendered.
        const expected = getTimestampRangeData(table, startTs, endTs)
            .filter(row => daysWithData.has(toDayKey(row.timestamp)));

        // What batched loading returns.
        const loaded = [];
        for (let i = 0; i < days.length; i += DAYS_PER_CHUNK) {
            const batch = days.slice(i, i + DAYS_PER_CHUNK);
            const window = getDaysWindow(batch, startTs, endTs);
            loaded.push(...getTimestampRangeData(table, window.startTs, window.endTs));
        }

        const serialize = (rows) => rows.map(row => JSON.stringify(row)).sort();
        assert.deepStrictEqual(serialize(loaded), serialize(expected), `batched reads should match a full read of ${table}`);
    }
});
