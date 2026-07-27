import { test } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { dbService } from '../src/db.js';
import { getTableColumns, insertRecord } from '../src/services/data-repository.js';

// Work on a copy: connecting runs schema migrations that would modify demo.sqlite.
function connectToDemoCopy() {
    const source = path.resolve(import.meta.dirname, '../demo.sqlite');
    const copy = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'life-dashboard-')), 'demo.sqlite');
    fs.copyFileSync(source, copy);
    return dbService.connectNode(copy);
}

test('getTableColumns lists columns of a known table', async () => {
    await connectToDemoCopy();
    const columns = getTableColumns('weight');
    const names = columns.map(c => c.name);
    assert.ok(names.includes('timestamp'));
    assert.ok(names.includes('weight_kg'));
    assert.ok(names.includes('source'));
    assert.deepStrictEqual(getTableColumns('no_such_table'), []);
});

test('insertRecord adds a row with the given values', async () => {
    await connectToDemoCopy();
    const timestamp = new Date('2025-06-01T08:00:00Z').getTime();

    insertRecord('weight', { timestamp, weight_kg: 71.5, source: 'manual', note: 'entered by hand' });

    const rows = dbService.query('SELECT * FROM weight WHERE timestamp = ?', [timestamp]);
    assert.strictEqual(rows.length, 1);
    assert.strictEqual(rows[0].weight_kg, 71.5);
    assert.strictEqual(rows[0].source, 'manual');
    assert.strictEqual(rows[0].note, 'entered by hand');
});

test('insertRecord rejects unknown tables and columns', async () => {
    await connectToDemoCopy();
    assert.throws(() => insertRecord('no_such_table', { timestamp: 1 }), /Unknown table/);
    assert.throws(() => insertRecord('weight', { not_a_column: 1 }), /Unknown column/);
    assert.throws(() => insertRecord('weight', {}), /No values/);
});
