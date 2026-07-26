import { test, before, after } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

import { dbService } from '../src/db.js';

const testDbPath = path.resolve(import.meta.dirname, '../test_migration_temp.sqlite');

before(() => {
    if (fs.existsSync(testDbPath)) {
        fs.unlinkSync(testDbPath);
    }
});

after(() => {
    if (fs.existsSync(testDbPath)) {
        fs.unlinkSync(testDbPath);
    }
});

test('renames legacy blood_pressure table to heart without losing data', async () => {
    // Create a database with the old schema and a measurement in it
    const legacyDb = new DatabaseSync(testDbPath);
    legacyDb.exec('CREATE TABLE blood_pressure (id INTEGER PRIMARY KEY, timestamp INTEGER, systolic_mmhg INTEGER, diastolic_mmhg INTEGER, heart_rate_bpm INTEGER, source TEXT, note TEXT)');
    legacyDb.exec("INSERT INTO blood_pressure (timestamp, systolic_mmhg, diastolic_mmhg, heart_rate_bpm, source) VALUES (1735689600000, 120, 80, 65, 'withings')");
    legacyDb.close();

    // Connecting runs ensureSchema, which should migrate the table
    await dbService.connectNode(testDbPath);

    const tables = dbService.getTables();
    assert.ok(tables.includes('heart'), 'heart table should exist after migration');
    assert.ok(!tables.includes('blood_pressure'), 'blood_pressure table should be gone');

    const rows = dbService.query('SELECT * FROM heart');
    assert.strictEqual(rows.length, 1, 'Existing measurement should survive the rename');
    assert.strictEqual(rows[0].systolic_mmhg, 120);
    assert.strictEqual(rows[0].heart_rate_bpm, 65);
});
