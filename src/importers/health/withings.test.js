import { test } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { WithingsImporter } from './withings.js';
import { CSVParser } from '../../utils/csv-parser.js';

test('WithingsImporter', async (t) => {

    // Helper to load and parse a sample file
    const loadSample = (filename) => {
        const samplePath = path.resolve(import.meta.dirname, `../../../data-samples/health/withings/${filename}`);
        const content = fs.readFileSync(samplePath, 'utf-8');
        return CSVParser.parse(content);
    };

    await t.test('Weight Data', async (t) => {
        const rows = loadSample('weight.csv');

        await t.test('detects weight data', () => {
            assert.ok(WithingsImporter.detect(rows));
        });

        await t.test('maps weight row correctly', () => {
            // "2025-01-01 08:00:00",74.98,12.5,3.2,59.8,43.5,
            const row = rows[0];
            const result = WithingsImporter.mapRow(row);

            assert.strictEqual(result.table, 'weight');
            assert.strictEqual(result.data.weight_kg, 74.98);
            // Verify timestamp is parsed correctly
            const expectedTime = new Date("2025-01-01 08:00:00").getTime();
            assert.strictEqual(result.data.timestamp, expectedTime);
        });
    });

    await t.test('Sleep Data', async (t) => {
        const rows = loadSample('sleep.csv');

        await t.test('detects sleep data', () => {
            assert.ok(WithingsImporter.detect(rows));
        });

        await t.test('maps sleep row correctly', () => {
            // 2025-01-01T06:56:55.687Z,2025-01-01T16:14:00.000Z,15887,7944,7944,1650,...
            const row = rows[0];
            const result = WithingsImporter.mapRow(row);

            assert.strictEqual(result.table, 'sleep');
            // total sleep = (15887 + 7944 + 7944) / 3600 = 8.83
            assert.strictEqual(result.data.duration_hours, 8.83);
            assert.strictEqual(result.data.light_seconds, 15887);
            assert.strictEqual(result.data.deep_seconds, 7944);
            assert.strictEqual(result.data.rem_seconds, 7944);
            assert.strictEqual(result.data.awake_seconds, 1650);

            const expectedTime = new Date("2025-01-01T16:14:00.000Z").getTime();
            assert.strictEqual(result.data.timestamp, expectedTime);
        });
    });

    await t.test('Activities Data', async (t) => {
        const rows = loadSample('activities.csv');

        await t.test('detects activities data', () => {
            assert.ok(WithingsImporter.detect(rows));
        });

        await t.test('maps activities row correctly', () => {
            // 2025-01-07T08:28:43-08:00,Walking,...
            const row = rows[0];
            const result = WithingsImporter.mapRow(row);

            assert.strictEqual(result.table, 'activities');
            assert.strictEqual(result.data.steps, 318);
            assert.strictEqual(result.data.type, 'Walking');
            assert.strictEqual(result.data.distance, 277);
            assert.strictEqual(result.data.calories, 18);
            assert.strictEqual(result.data.elevation, 5);
            assert.strictEqual(result.data.hr_average, 0);

            const expectedTime = new Date("2025-01-07T08:28:43-08:00").getTime();
            assert.strictEqual(result.data.timestamp, expectedTime);

            const expectedEndTime = new Date("2025-01-07T08:33:00-08:00").getTime();
            assert.strictEqual(result.data.end_timestamp, expectedEndTime);
        });
    });

    await t.test('Blood Pressure Data', async (t) => {
        const rows = loadSample('bp.csv');

        await t.test('detects bp data', () => {
            assert.ok(WithingsImporter.detect(rows));
        });

        await t.test('maps bp row correctly', () => {
            // "2026-01-10 18:30:00",70,120,80,
            const row = rows[1]; // Second row has valid BP data
            const result = WithingsImporter.mapRow(row);

            assert.strictEqual(result.table, 'heart');
            assert.strictEqual(result.data.systolic_mmhg, 120);
            assert.strictEqual(result.data.diastolic_mmhg, 80);
            assert.strictEqual(result.data.heart_rate_bpm, 70);

            const expectedTime = new Date("2026-01-10 18:30:00").getTime();
            assert.strictEqual(result.data.timestamp, expectedTime);
        });
    });

    await t.test('Height Data', async (t) => {
        const rows = loadSample('height.csv');

        await t.test('detects height data', () => {
            assert.ok(WithingsImporter.detect(rows));
        });

        await t.test('maps height row correctly', () => {
            // "2026-01-01 12:00:00",1.75,
            const row = rows[0];
            const result = WithingsImporter.mapRow(row);

            assert.strictEqual(result.table, 'height');
            assert.strictEqual(result.data.height_m, 1.75);

            const expectedTime = new Date("2026-01-01 12:00:00").getTime();
            assert.strictEqual(result.data.timestamp, expectedTime);
        });
    });

    await t.test('Body Temperature Data', async (t) => {
        const rows = loadSample('body_temperature.csv');

        await t.test('detects body temp data', () => {
            assert.ok(WithingsImporter.detect(rows));
        });

        await t.test('maps body temp row correctly', () => {
            // "2026-01-10 08:05:00",36.6
            const row = rows[0];
            const result = WithingsImporter.mapRow(row);

            assert.strictEqual(result.table, 'body_temperature');
            assert.strictEqual(result.data.temperature_c, 36.6);

            const expectedTime = new Date("2026-01-10 08:05:00").getTime();
            assert.strictEqual(result.data.timestamp, expectedTime);
        });
    });

    await t.test('Data preservation', async (t) => {
        await t.test('keeps heart-rate-only measurements from bp.csv', () => {
            const rows = loadSample('bp.csv');
            // "2026-01-10 08:30:00",65,,, -> heart rate only, no BP
            const hrOnlyRow = rows[0];
            const result = WithingsImporter.mapRow(hrOnlyRow);

            assert.ok(result, 'Heart-rate-only row should not be dropped');
            assert.strictEqual(result.table, 'heart');
            assert.strictEqual(result.data.systolic_mmhg, null);
            assert.strictEqual(result.data.diastolic_mmhg, null);
            assert.strictEqual(result.data.heart_rate_bpm, 65);
        });

        await t.test('maps Comments column to note', () => {
            const result = WithingsImporter.mapRow({
                'Date': '2025-01-01 08:00:00',
                'Weight (kg)': '74.98',
                'Fat mass (kg)': '12.5',
                'Comments': 'after morning run'
            });
            assert.strictEqual(result.data.note, 'after morning run');
        });

        await t.test('keeps manually logged sleep without stage breakdown', () => {
            const result = WithingsImporter.mapRow({
                'from': '2025-01-01T23:00:00Z',
                'to': '2025-01-02T07:00:00Z',
                'light (s)': '0',
                'deep (s)': '0',
                'rem (s)': '0',
                'awake (s)': '0'
            });
            assert.ok(result, 'Manual sleep entry should not be dropped');
            assert.strictEqual(result.table, 'sleep');
            assert.strictEqual(result.data.duration_hours, 8);
        });
    });
});
