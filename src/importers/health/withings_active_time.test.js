import { test } from 'node:test';
import assert from 'node:assert';
import { WithingsImporter } from './withings.js';

test('WithingsImporter - Active Time', async (t) => {

    await t.test('Activity with steps and no duration', () => {
        // Mock row
        const row = {
            'Activity type': 'Walking',
            'Data': '{"steps":1000,"distance":1000,"calories":50}',
            'from': '2025-01-01T08:00:00.000Z',
            'to': '2025-01-01T08:00:00.000Z' // Same time -> 0 duration
        };

        const result = WithingsImporter.mapRow(row);

        assert.ok(result);
        assert.strictEqual(result.table, 'steps');
        assert.strictEqual(result.data.count, 1000);
        assert.strictEqual(result.data.duration, 0);
    });

    await t.test('Activity with explicit duration in Data', () => {
        const row = {
            'Activity type': 'Cycling',
            'Data': '{"steps":0,"distance":5000,"calories":200,"duration":1800}', // 30 mins
            'from': '2025-01-01T10:00:00.000Z',
            'to': '2025-01-01T10:00:00.000Z' // Ignored if Data has duration? Or maybe used if Data doesn't?
        };

        const result = WithingsImporter.mapRow(row);

        assert.ok(result);
        assert.strictEqual(result.table, 'steps');
        assert.strictEqual(result.data.type, 'Cycling');
        assert.strictEqual(result.data.duration, 1800);
    });

    await t.test('Activity with calculated duration from timestamps', () => {
        const row = {
            'Activity type': 'Swimming',
            'Data': '{"calories":300}',
            'from': '2025-01-01T12:00:00.000Z',
            'to': '2025-01-01T13:00:00.000Z' // 1 hour difference
        };

        const result = WithingsImporter.mapRow(row);

        assert.ok(result);
        assert.strictEqual(result.table, 'steps');
        assert.strictEqual(result.data.type, 'Swimming');
        assert.strictEqual(result.data.duration, 3600); // 3600 seconds
    });

    await t.test('Activity with 0 steps but positive duration is imported', () => {
        const row = {
            'Activity type': 'Yoga',
            'Data': '{"calories":100}',
            'from': '2025-01-01T18:00:00.000Z',
            'to': '2025-01-01T19:00:00.000Z'
        };

        const result = WithingsImporter.mapRow(row);

        assert.ok(result);
        assert.strictEqual(result.table, 'steps');
        assert.strictEqual(result.data.type, 'Yoga');
        assert.strictEqual(result.data.duration, 3600);
    });

    await t.test('Activity with 0 steps and 0 duration is NOT imported', () => {
        const row = {
            'Activity type': 'Unknown',
            'Data': '{}',
            'from': '2025-01-01T20:00:00.000Z',
            'to': '2025-01-01T20:00:00.000Z'
        };

        const result = WithingsImporter.mapRow(row);

        assert.strictEqual(result, null);
    });

});
