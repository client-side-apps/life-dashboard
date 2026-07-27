import { test } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { dbService } from '../src/db.js';
import { getTablePage } from '../src/services/data-repository.js';

// Work on a copy: connecting runs schema migrations that would modify demo.sqlite.
function connectToDemoCopy() {
    const source = path.resolve(import.meta.dirname, '../demo.sqlite');
    const copy = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'life-dashboard-')), 'demo.sqlite');
    fs.copyFileSync(source, copy);
    return dbService.connectNode(copy);
}

// A table with more rows than a page holds, to exercise paging.
const TABLE = 'location';
const PAGE_SIZE = 10;

test('getTablePage reads one page at a time, most recent first', async () => {
    await connectToDemoCopy();
    const totalRows = dbService.query(`SELECT COUNT(*) AS count FROM ${TABLE}`)[0].count;
    assert.ok(totalRows > PAGE_SIZE, `expected ${TABLE} to hold more than ${PAGE_SIZE} rows`);

    const first = getTablePage(TABLE, { page: 1, pageSize: PAGE_SIZE });
    assert.strictEqual(first.rows.length, PAGE_SIZE);
    assert.strictEqual(first.totalRows, totalRows);
    assert.strictEqual(first.dateColumn, 'timestamp');
    assert.strictEqual(first.page, 1);
    assert.strictEqual(first.offset, 0);
    assert.strictEqual(first.pageCount, Math.ceil(totalRows / PAGE_SIZE));

    const timestamps = first.rows.map(r => r.timestamp);
    assert.deepStrictEqual(timestamps, [...timestamps].sort((a, b) => b - a));

    const second = getTablePage(TABLE, { page: 2, pageSize: PAGE_SIZE });
    assert.strictEqual(second.offset, PAGE_SIZE);
    assert.strictEqual(second.rows.length, PAGE_SIZE);
    // Pages do not overlap and stay in order.
    const firstIds = new Set(first.rows.map(r => r.id));
    assert.ok(second.rows.every(r => !firstIds.has(r.id)));
    assert.ok(second.rows[0].timestamp <= first.rows[first.rows.length - 1].timestamp);
});

test('getTablePage clamps the page number to the available pages', async () => {
    await connectToDemoCopy();
    const { pageCount } = getTablePage(TABLE, { pageSize: PAGE_SIZE });

    const beyondLast = getTablePage(TABLE, { page: pageCount + 50, pageSize: PAGE_SIZE });
    assert.strictEqual(beyondLast.page, pageCount);
    assert.ok(beyondLast.rows.length > 0);

    const beforeFirst = getTablePage(TABLE, { page: 0, pageSize: PAGE_SIZE });
    assert.strictEqual(beforeFirst.page, 1);
    assert.strictEqual(beforeFirst.offset, 0);
});

test('getTablePage counts only the rows of the date range', async () => {
    await connectToDemoCopy();
    const totalRows = dbService.query(`SELECT COUNT(*) AS count FROM ${TABLE}`)[0].count;

    // Local day of the most recent row, the same way the view builds its range.
    const latest = new Date(getTablePage(TABLE, { pageSize: 1 }).rows[0].timestamp);
    const day = [
        latest.getFullYear(),
        String(latest.getMonth() + 1).padStart(2, '0'),
        String(latest.getDate()).padStart(2, '0')
    ].join('-');

    const dayPage = getTablePage(TABLE, { startDate: day, endDate: day, pageSize: PAGE_SIZE });
    const expected = dbService.query(
        `SELECT COUNT(*) AS count FROM ${TABLE} WHERE timestamp >= ? AND timestamp <= ?`,
        [new Date(day + 'T00:00:00').getTime(), new Date(day + 'T23:59:59.999').getTime()]
    )[0].count;

    assert.ok(expected > 0 && expected < totalRows);
    assert.strictEqual(dayPage.totalRows, expected);
    assert.strictEqual(dayPage.pageCount, Math.max(1, Math.ceil(expected / PAGE_SIZE)));
});

test('getTablePage returns an empty page for an unknown table', async () => {
    await connectToDemoCopy();
    const result = getTablePage('no_such_table', { pageSize: PAGE_SIZE });
    assert.deepStrictEqual(result.rows, []);
    assert.strictEqual(result.totalRows, 0);
    assert.strictEqual(result.pageCount, 1);
});
