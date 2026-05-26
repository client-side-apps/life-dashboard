import { test } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';

test('Database Schema and Documentation Consistency', async (t) => {
    // 1. Resolve paths
    const schemaDocPath = path.resolve(import.meta.dirname, '../docs/schema.md');
    const dbJsPath = path.resolve(import.meta.dirname, '../src/db.js');

    assert.ok(fs.existsSync(schemaDocPath), 'schema.md should exist');
    assert.ok(fs.existsSync(dbJsPath), 'src/db.js should exist');

    // 2. Parse docs/schema.md to get documented tables and columns
    const schemaDocContent = fs.readFileSync(schemaDocPath, 'utf8');
    const documented = parseSchemaDoc(schemaDocContent);

    // 3. Parse src/db.js to get expected tables and columns
    const dbJsContent = fs.readFileSync(dbJsPath, 'utf8');
    const expected = parseExpectedSchemas(dbJsContent);

    // 4. Run tests
    await t.test('All tables in src/db.js must be documented in schema.md (except metadata)', () => {
        const expectedTables = Object.keys(expected);
        const documentedTables = Object.keys(documented);

        for (const table of expectedTables) {
            assert.ok(
                documentedTables.includes(table),
                `Table "${table}" is defined in src/db.js but not documented in docs/schema.md`
            );
        }
    });

    await t.test('All tables in schema.md must exist in src/db.js', () => {
        const expectedTables = Object.keys(expected);
        const documentedTables = Object.keys(documented);

        for (const table of documentedTables) {
            assert.ok(
                expectedTables.includes(table),
                `Table "${table}" is documented in docs/schema.md but not defined in src/db.js`
            );
        }
    });

    // Check individual table structures
    for (const tableName of Object.keys(expected)) {
        if (!documented[tableName]) continue;

        await t.test(`table "${tableName}" columns must match documentation`, () => {
            const expCols = expected[tableName];
            const docTable = documented[tableName];
            const docCols = docTable.columns;

            // Every column in schema.md must exist in db.js with same type/pk
            for (const colName of Object.keys(docCols)) {
                const docCol = docCols[colName];
                const expCol = expCols[colName];

                assert.ok(
                    expCol,
                    `Column "${colName}" is documented in docs/schema.md for table "${tableName}" but is missing in src/db.js`
                );
                assert.strictEqual(
                    expCol.type,
                    docCol.type,
                    `Column "${colName}" in table "${tableName}" should have type "${docCol.type}" (from schema.md), but is defined as "${expCol.type}" in src/db.js`
                );
                assert.strictEqual(
                    expCol.pk,
                    docCol.pk,
                    `Column "${colName}" in table "${tableName}" primary key status should be ${docCol.pk} (from schema.md), but is ${expCol.pk} in src/db.js`
                );
            }

            // If table has no wildcard (...), db.js must not have any extra columns
            if (!docTable.hasWildcard) {
                for (const colName of Object.keys(expCols)) {
                    assert.ok(
                        docCols[colName],
                        `Column "${colName}" is defined in src/db.js for table "${tableName}" but is missing in docs/schema.md`
                    );
                }
            }
        });
    }
});

// Parse schema.md into structured object
function parseSchemaDoc(content) {
    const lines = content.split('\n');
    const tables = {};
    let currentTable = null;

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();

        // Match "### `table_name`" or "### table_name"
        const headerMatch = line.match(/^###\s+`?(\w+)`?/);
        if (headerMatch) {
            currentTable = headerMatch[1];
            tables[currentTable] = {
                columns: {},
                hasWildcard: false
            };
            continue;
        }

        if (currentTable && line.startsWith('|')) {
            const cells = line.split('|').map(c => c.trim()).filter((_, idx, arr) => idx > 0 && idx < arr.length - 1);
            if (cells.length < 2) continue;

            const colNameRaw = cells[0];
            const colTypeRaw = cells[1];

            // Skip table headers and separators
            if (colNameRaw.toLowerCase() === 'column' || colNameRaw.includes('---')) {
                continue;
            }

            const colName = colNameRaw.replace(/`/g, '');
            if (colName === '...') {
                tables[currentTable].hasWildcard = true;
                continue;
            }

            if (!colName) continue;

            const colType = colTypeRaw.toUpperCase();
            const isPk = cells[2] && cells[2].toUpperCase().includes('PRIMARY KEY');

            tables[currentTable].columns[colName] = {
                type: colType,
                pk: isPk
            };
        }
    }
    return tables;
}

// Parse src/db.js to extract expected table and column schemas
function parseExpectedSchemas(content) {
    const schemasMatch = content.match(/const schemas = \[\s*([\s\S]*?)\s*\];/);
    if (!schemasMatch) {
        throw new Error("Could not find schemas array in db.js");
    }

    const schemasText = schemasMatch[1];
    const sqlStatements = [];
    const backtickRegex = /`([\s\S]*?)`/g;
    let match;
    while ((match = backtickRegex.exec(schemasText)) !== null) {
        sqlStatements.push(match[1].trim());
    }

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

    return expected;
}
