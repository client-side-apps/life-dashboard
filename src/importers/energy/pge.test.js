import { test } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { PgeImporter } from './pge.js';
import { CSVParser } from '../../utils/csv-parser.js';

test('PgeImporter with Real Data', async (t) => {
    // Resolve path to sample file
    const samplePath = path.resolve(import.meta.dirname, '../../../data-samples/energy/pge/pge_electric_usage.csv');
    const content = fs.readFileSync(samplePath, 'utf-8');

    await t.test('detects PGE data from file content', () => {
        // Strip preamble for the test, mimicking what DataImporter does.
        const pgeHeaderIndex = content.indexOf('TYPE,DATE,START TIME');
        const cleanContent = content.substring(pgeHeaderIndex);
        const rows = CSVParser.parse(cleanContent);

        assert.ok(PgeImporter.detect(rows));

        // Verify mapping of a known row
        // Electric usage,2025-01-01,07:00,07:59,0.36,0.00,$0.13
        const firstRow = rows.find(r => r['TYPE'] === 'Electric usage' && r['DATE'] === '2025-01-01' && r['START TIME'] === '07:00');
        assert.ok(firstRow, 'Should find electricity row');

        const mapped = PgeImporter.mapRow(firstRow);
        assert.strictEqual(mapped.table, 'electricity_hourly');
        assert.strictEqual(mapped.data.grid_import_kwh, 0.36);
    });

    await t.test('detects and maps Gas data', () => {
        // Read real gas file
        const gasSamplePath = path.resolve(import.meta.dirname, '../../../data-samples/energy/pge/pge_natural_gas_usage.csv');
        const gasContent = fs.readFileSync(gasSamplePath, 'utf-8');

        // Strip preamble logic similar to main import
        const pgeHeaderIndex = gasContent.indexOf('TYPE,DATE,START TIME');
        const cleanGasContent = gasContent.substring(pgeHeaderIndex);
        const gasRows = CSVParser.parse(cleanGasContent);

        const gasRow = gasRows.find(r => r['DATE'] === '2025-12-13');
        assert.ok(gasRow, 'Should find row with data');

        // 2.05 therms
        const mapped = PgeImporter.mapRow(gasRow);
        assert.strictEqual(mapped.table, 'gas_daily');
        assert.strictEqual(mapped.data.usage_therms, 2.05);
    });
});
