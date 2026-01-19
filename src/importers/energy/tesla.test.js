import { test } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { TeslaImporter } from './tesla.js';
import { CSVParser } from '../../utils/csv-parser.js';

test('TeslaImporter with Real Data', async (t) => {
    const samplePath = path.resolve(import.meta.dirname, '../../../data-samples/energy/tesla/data');
    const content = fs.readFileSync(samplePath, 'utf-8');
    const rows = CSVParser.parse(content);

    await t.test('detects Tesla data from file content', () => {
        assert.ok(TeslaImporter.detect(rows));
    });

    await t.test('maps valid row correctly', () => {
        // 2025-11-01T00:00:00-07:00,65.3,48.2,7.3,1.3,0.3,57.7,6.3,0
        // Home(65.3), Solar(48.2), FromGrid(7.3)

        const row = rows.find(r => r['Date time'] === '2025-11-01T00:00:00-07:00');
        assert.ok(row, 'Should find the specific row');

        const mapped = TeslaImporter.mapRow(row);

        // 2025-11-01T00:00:00-07:00 -> ISO 2025-11-01T07:00:00.000Z
        const expectedTime = new Date('2025-11-01T00:00:00-07:00').toISOString();

        assert.strictEqual(mapped.data.time, expectedTime);
        assert.strictEqual(mapped.data.consumption, 65.3);
        assert.strictEqual(mapped.data.solar, 48.2);
        assert.strictEqual(mapped.data.import, 7.3);
    });
});
