import { test, describe, it } from 'node:test';
import assert from 'node:assert';
import { FlumeImporter } from './flume.js';

describe('FlumeImporter', () => {
    describe('detect', () => {
        it('should return true for valid Flume CSV rows', () => {
            const rows = [{ datetime: '2023-01-01 00:00:00', liters: '100' }];
            assert.strictEqual(FlumeImporter.detect(rows), true);
        });

        it('should return false for invalid rows', () => {
            const rows = [{ other: 'data' }];
            assert.strictEqual(FlumeImporter.detect(rows), false);
        });

        it('should return false for empty rows', () => {
            assert.strictEqual(FlumeImporter.detect([]), false);
        });
    });

    describe('mapRow', () => {
        it('should map a valid row correctly', () => {
            const row = { datetime: '2025-11-01 00:00:00', liters: '4059.12' };
            const result = FlumeImporter.mapRow(row);

            assert.deepStrictEqual(result, {
                table: 'water_daily',
                data: {
                    timestamp: new Date('2025-11-01 00:00:00').getTime(),
                    usage_liters: 4059.12
                }
            });
        });

        it('should return null for invalid data', () => {
            assert.strictEqual(FlumeImporter.mapRow({ datetime: 'invalid', liters: '100' }), null);
            assert.strictEqual(FlumeImporter.mapRow({ datetime: '2023-01-01', liters: 'invalid' }), null);
        });

        it('should return null for missing fields', () => {
            assert.strictEqual(FlumeImporter.mapRow({ liters: '100' }), null);
        });
    });

    describe('getTable', () => {
        it('should return water_daily', () => {
            assert.strictEqual(FlumeImporter.getTable(), 'water_daily');
        });
    });
});
