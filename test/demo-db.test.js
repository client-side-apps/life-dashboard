import { test } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

test('Demo Database Schema Validation', async (t) => {
    // 1. Resolve paths
    const dbPath = path.resolve(import.meta.dirname, '../demo.sqlite');
    const dbJsPath = path.resolve(import.meta.dirname, '../src/db.js');

    assert.ok(fs.existsSync(dbPath), 'demo.sqlite file should exist');
    assert.ok(fs.existsSync(dbJsPath), 'src/db.js file should exist');

    // 2. Parse db.js to extract expected tables and column definitions
    const dbJsContent = fs.readFileSync(dbJsPath, 'utf8');
    const schemasMatch = dbJsContent.match(/const schemas = \[\s*([\s\S]*?)\s*\];/);
    assert.ok(schemasMatch, 'Should find schemas array in db.js');

    const schemasText = schemasMatch[1];
    const sqlStatements = [];
    const backtickRegex = /`([\s\S]*?)`/g;
    let match;
    while ((match = backtickRegex.exec(schemasText)) !== null) {
        sqlStatements.push(match[1].trim());
    }
    assert.ok(sqlStatements.length > 0, 'Should extract at least one CREATE TABLE statement');

    const expected = {};
    for (const sql of sqlStatements) {
        const tableMatch = sql.match(/CREATE TABLE\s+(?:IF NOT EXISTS\s+)?(\w+)\s*\(([\s\S]*)\)/i);
        if (!tableMatch) continue;

        const tableName = tableMatch[1];
        const columnsText = tableMatch[2];
        const columnsList = columnsText.split(',').map(c => c.trim()).filter(Boolean);
        const columns = {};

        for (const colDef of columnsList) {
            const parts = colDef.split(/\s+/);
            if (parts.length < 2) continue;
            const colName = parts[0];
            const colType = parts[1].toUpperCase();
            const isPk = colDef.toUpperCase().includes('PRIMARY KEY');
            columns[colName] = { type: colType, pk: isPk };
        }

        expected[tableName] = columns;
    }

    // 3. Connect to demo.sqlite and verify the schemas
    const db = new DatabaseSync(dbPath);

    const actualTables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").all().map(row => row.name);

    // Run tests for each expected table
    for (const expectedTable of Object.keys(expected)) {
        await t.test(`table "${expectedTable}" should exist and match schema`, async () => {
            assert.ok(actualTables.includes(expectedTable), `Table "${expectedTable}" should exist in demo.sqlite`);

            const rows = db.prepare(`PRAGMA table_info("${expectedTable}")`).all();
            const actualCols = {};
            rows.forEach(row => {
                actualCols[row.name] = {
                    type: row.type.toUpperCase(),
                    pk: row.pk === 1
                };
            });

            const expectedCols = expected[expectedTable];

            // Verify expected columns
            for (const colName of Object.keys(expectedCols)) {
                const exp = expectedCols[colName];
                const act = actualCols[colName];

                assert.ok(act, `Column "${colName}" should exist in table "${expectedTable}"`);
                assert.strictEqual(act.type, exp.type, `Column "${colName}" in table "${expectedTable}" should have type "${exp.type}", but got "${act.type}"`);
                assert.strictEqual(act.pk, exp.pk, `Column "${colName}" in table "${expectedTable}" primary key status should be ${exp.pk}, but got ${act.pk}`);
            }

            // Verify no extra columns exist in actual database
            for (const colName of Object.keys(actualCols)) {
                assert.ok(expectedCols[colName], `Column "${colName}" exists in demo.sqlite table "${expectedTable}", but is not defined in src/db.js`);
            }
        });
    }

    // Clean up
    db.close();
});
