import { WithingsImporter } from '../src/importers/health/withings.js';
import { describe, it } from 'node:test';
import assert from 'node:assert';

describe('WithingsImporter', () => {
    it('should import activities with 0 steps if they have other data', () => {
        const row = {
            'Activity type': 'Cycling',
            'from': '2023-10-27T10:00:00+00:00',
            'Data': '{"steps": 0, "distance": 15000, "calories": 300}'
        };

        const result = WithingsImporter.mapRow(row);

        // Before fix, this should be null (or fail assertion if I expect it to be present)
        // I want it to be present.
        assert.ok(result, 'Should return data for 0-step activity');
        assert.strictEqual(result.table, 'steps');
        assert.strictEqual(result.data.type, 'Cycling');
        assert.strictEqual(result.data.count, 0);
        assert.strictEqual(result.data.distance, 15000);
    });

    it('should import walking activities with steps', () => {
        const row = {
            'Activity type': 'Walking',
            'from': '2023-10-27T10:00:00+00:00',
            'Data': '{"steps": 1000, "distance": 800, "calories": 50}'
        };

        const result = WithingsImporter.mapRow(row);

        assert.ok(result, 'Should return data for walking activity');
        assert.strictEqual(result.table, 'steps');
        assert.strictEqual(result.data.type, 'Walking');
        assert.strictEqual(result.data.count, 1000);
    });
});
