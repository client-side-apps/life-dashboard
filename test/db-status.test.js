import { test } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { dbService } from '../src/db.js';
import { describeDbStatus } from '../src/utils/db-status.js';

// Work on a copy: connecting runs schema migrations that would modify demo.sqlite.
function connectToDemoCopy() {
    const source = path.resolve(import.meta.dirname, '../demo.sqlite');
    const copy = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'life-dashboard-')), 'demo.sqlite');
    fs.copyFileSync(source, copy);
    return dbService.connectNode(copy);
}

test('no indicator without a database', () => {
    assert.deepStrictEqual(describeDbStatus({ hasDatabase: false, isDirty: true }), {
        state: 'hidden',
        showSaveButton: false,
        fileName: null
    });
});

test('a database created without a file offers a save button once modified', () => {
    const status = describeDbStatus({ hasDatabase: true, fileName: null, isDirty: true });
    assert.strictEqual(status.state, 'unsaved');
    assert.strictEqual(status.showSaveButton, true);
});

test('a database backed by a file shows where it is saved', () => {
    const status = describeDbStatus({ hasDatabase: true, fileName: 'life.sqlite', isDirty: true });
    assert.strictEqual(status.state, 'saved');
    assert.strictEqual(status.fileName, 'life.sqlite');
    assert.strictEqual(status.showSaveButton, false);
});

test('an unmodified database without a file shows nothing', () => {
    const status = describeDbStatus({ hasDatabase: true, fileName: null, isDirty: false });
    assert.strictEqual(status.state, 'idle');
    assert.strictEqual(status.showSaveButton, false);
});

test('opening a database does not report a modification, inserting does', async (t) => {
    let modifications = 0;
    dbService.onModification = () => { modifications++; };
    t.after(() => { dbService.onModification = null; });

    await connectToDemoCopy();
    assert.strictEqual(modifications, 0, 'schema setup must not mark the database as modified');

    dbService.query('INSERT INTO weight (timestamp, weight_kg, source) VALUES (?, ?, ?)', [1, 70, 'manual']);
    assert.strictEqual(modifications, 1);
});
