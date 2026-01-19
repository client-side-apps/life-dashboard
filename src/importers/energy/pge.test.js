import { test } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { PgeImporter } from './pge.js';
import { CSVParser } from '../../utils/csv-parser.js';

test('PgeImporter with Real Data', async (t) => {
    // Resolve path to sample file
    const samplePath = path.resolve(import.meta.dirname, '../../../data-samples/energy/pge/pge_electric_usage_interval_data_Service 2_2_2025-11-14_to_2025-12-21.csv');
    const content = fs.readFileSync(samplePath, 'utf-8');

    await t.test('detects PGE data from file content', () => {
        // We need to handle the preamble issue logic which currently resides in DataImporter.import
        // But the PgeImporter.detect logic is:
        // keys.includes('TYPE') && keys.includes('START TIME')
        // The file has preamble, so CSVParser.parse(content) without skipping preamble will fail to find these keys in the first row.

        // However, PgeImporter logic also has: 
        // if (keys.some(k => k === 'Electric usage')) return true;
        // Let's see if the raw parse works or if we need to mimic DataImporter's preprocessing.

        // DataImporter does:
        // if (content.indexOf('TYPE,DATE,START TIME') > 0) { content = content.substring(...) }

        // So for the unit test of the *Importer*, we should probably pass it the clean data if it expects clean data,
        // OR the Importer should be robust enough.
        // Currently PgeImporter expects rows.

        let rows = CSVParser.parse(content);

        // If parsed as is with preamble, the first row will be the preamble title. 
        // The rows won't match standard PGE headers.

        // Let's manually strip preamble for the test to verify mapRow, 
        // mimicking what DataImporter does.
        const pgeHeaderIndex = content.indexOf('TYPE,DATE,START TIME');
        const cleanContent = content.substring(pgeHeaderIndex);
        rows = CSVParser.parse(cleanContent);

        assert.ok(PgeImporter.detect(rows));

        // Verify mapping of a known row
        // Electric usage,2025-11-14,07:00,07:59,3.39,0.00,$1.02
        const firstRow = rows.find(r => r['TYPE'] === 'Electric usage' && r['DATE'] === '2025-11-14' && r['START TIME'] === '07:00');
        assert.ok(firstRow, 'Should find electricity row');

        const mapped = PgeImporter.mapRow(firstRow);
        assert.strictEqual(mapped.table, 'electricity');
        assert.strictEqual(mapped.data.consumption_kwh, null);
        assert.strictEqual(mapped.data.time, new Date('2025-11-14 07:00').toISOString());
    });

    await t.test('detects and maps Gas data', () => {
        // Read real gas file
        const gasSamplePath = path.resolve(import.meta.dirname, '../../../data-samples/energy/pge/pge_natural_gas_usage_interval_data_Service 1_1_2025-11-14_to_2025-12-21.csv');
        const gasContent = fs.readFileSync(gasSamplePath, 'utf-8');

        // Strip preamble logic similar to main import (mimicked here for unit test)
        const pgeHeaderIndex = gasContent.indexOf('TYPE,DATE,START TIME');
        const cleanGasContent = gasContent.substring(pgeHeaderIndex);
        const gasRows = CSVParser.parse(cleanGasContent);

        const gasRow = gasRows.find(r => r['DATE'] === '2025-12-13');
        assert.ok(gasRow, 'Should find row with data');

        // 5.19 therms
        const mapped = PgeImporter.mapRow(gasRow);
        assert.strictEqual(mapped.table, 'gas');
        assert.strictEqual(mapped.data.import_kwh, 5.19);
    });
});

