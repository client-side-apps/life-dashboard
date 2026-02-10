import { test } from 'node:test';
import assert from 'node:assert';
import { WithingsImporter } from './withings.js';

test('WithingsImporter - Activities Table', async (t) => {

    await t.test('Activity with steps', () => {
        // Mock row
        const row = {
            'Activity type': 'Walking',
            'Data': '{"steps":1000,"distance":1000,"calories":50}',
            'from': '2025-01-01T08:00:00.000Z',
            'to': '2025-01-01T09:00:00.000Z'
        };

        const result = WithingsImporter.mapRow(row);

        assert.ok(result);
        assert.strictEqual(result.table, 'activities');
        assert.strictEqual(result.data.steps, 1000);
        assert.strictEqual(result.data.type, 'Walking');
        // Check timestamps
        assert.strictEqual(result.data.timestamp, new Date('2025-01-01T08:00:00.000Z').getTime());
        assert.strictEqual(result.data.end_timestamp, new Date('2025-01-01T09:00:00.000Z').getTime());
    });

    await t.test('Activity with 0 steps (e.g. Yoga) is imported', () => {
        const row = {
            'Activity type': 'Yoga',
            'Data': '{"calories":100}',
            'from': '2025-01-01T18:00:00.000Z',
            'to': '2025-01-01T19:00:00.000Z'
        };

        const result = WithingsImporter.mapRow(row);

        assert.ok(result);
        assert.strictEqual(result.table, 'activities');
        assert.strictEqual(result.data.type, 'Yoga');
        assert.strictEqual(result.data.steps, 0);
        assert.strictEqual(result.data.timestamp, new Date('2025-01-01T18:00:00.000Z').getTime());
        assert.strictEqual(result.data.end_timestamp, new Date('2025-01-01T19:00:00.000Z').getTime());
    });

    await t.test('Multi Sport activity is ignored', () => {
        const row = {
            'Activity type': 'Multi Sport',
            'Data': '{"steps":500}',
            'from': '2025-01-01T10:00:00.000Z',
            'to': '2025-01-01T11:00:00.000Z'
        };

        const result = WithingsImporter.mapRow(row);

        assert.strictEqual(result, null);
    });

});
