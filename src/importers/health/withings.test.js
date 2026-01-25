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
            // "2026-01-10 08:00:00",75.5,12.5,3.2,59.8,43.5,
            const row = rows[0];
            const result = WithingsImporter.mapRow(row);

            assert.strictEqual(result.table, 'weight');
            assert.strictEqual(result.data.weight_kg, 75.5);
            // Verify timestamp is parsed correctly
            const expectedTime = new Date("2026-01-10 08:00:00").getTime();
            assert.strictEqual(result.data.timestamp, expectedTime);
        });
    });

    await t.test('Sleep Data', async (t) => {
        const rows = loadSample('sleep.csv');

        await t.test('detects sleep data', () => {
            assert.ok(WithingsImporter.detect(rows));
        });

        await t.test('maps sleep row correctly', () => {
            // 2026-01-10T23:30:00-08:00,2026-01-11T07:30:00-08:00,...
            // light: 18000, deep: 7200, rem: 5400, awake: 1200
            const row = rows[0];
            const result = WithingsImporter.mapRow(row);

            assert.strictEqual(result.table, 'sleep');
            assert.strictEqual(result.data.duration_hours, 8.5);
            assert.strictEqual(result.data.light_seconds, 18000);
            assert.strictEqual(result.data.deep_seconds, 7200);
            assert.strictEqual(result.data.rem_seconds, 5400);
            assert.strictEqual(result.data.awake_seconds, 1200);

            const expectedTime = new Date("2026-01-11T07:30:00-08:00").getTime();
            assert.strictEqual(result.data.timestamp, expectedTime);
        });
    });

    await t.test('Activities Data', async (t) => {
        const rows = loadSample('activities.csv');

        await t.test('detects activities data', () => {
            assert.ok(WithingsImporter.detect(rows));
        });

        await t.test('maps activities row correctly', () => {
            // 2026-01-10T18:00:00-08:00,...Walking,"{""calories"":120,""effduration"":1800...""steps"":2500,""distance"":1800...
            const row = rows[0];
            const result = WithingsImporter.mapRow(row);

            assert.strictEqual(result.table, 'steps');
            assert.strictEqual(result.data.count, 2500);
            assert.strictEqual(result.data.type, 'Walking');
            assert.strictEqual(result.data.distance, 1800);
            assert.strictEqual(result.data.calories, 120);

            const expectedTime = new Date("2026-01-10T18:00:00-08:00").getTime();
            assert.strictEqual(result.data.timestamp, expectedTime);
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

            assert.strictEqual(result.table, 'blood_pressure');
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
});
