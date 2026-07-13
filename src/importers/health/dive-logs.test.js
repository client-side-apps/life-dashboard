import { test, describe, it } from 'node:test';
import assert from 'node:assert';
import { DiveLogImporter } from './dive-logs.js';

describe('DiveLogImporter', () => {
    describe('detect', () => {
        it('should return true for valid Dive Log CSV headers', () => {
            const rows = [{ Spot: 'Mauresque', 'Depth (m)': '16,2', 'Time (min)': '30' }];
            assert.strictEqual(DiveLogImporter.detect(rows), true);
        });

        it('should return false for missing headers', () => {
            const rows = [{ Other: 'data' }];
            assert.strictEqual(DiveLogImporter.detect(rows), false);
        });

        it('should return false for empty rows', () => {
            assert.strictEqual(DiveLogImporter.detect([]), false);
        });
    });

    describe('mapRow', () => {
        it('should map a valid row correctly', () => {
            const row = {
                Number: '109',
                Spot: 'Manta Heaven',
                City: 'Kona',
                Country: 'USA',
                Date: '18/08/2025',
                Type: 'Exploration',
                'Depth (m)': '11,6',
                'Time (min)': '50',
                Observations: 'Raies manta, cigale des mers',
                Center: 'Big Island Divers',
                Divers: 'Steren + Anne + 5 plongeurs + mono',
                '# divers': '8',
                'Température fond': '24'
            };

            const result = DiveLogImporter.mapRow(row);

            assert.deepStrictEqual(result, {
                table: 'dives',
                data: {
                    timestamp: new Date(2025, 7, 18).getTime(), // August is 7
                    dive_number: 109,
                    spot: 'Manta Heaven',
                    city: 'Kona',
                    region: null,
                    country: 'USA',
                    max_depth_meters: 11.6,
                    duration_minutes: 50.0,
                    water_temp_c: 24.0,
                    dive_type: 'Exploration',
                    center: 'Big Island Divers',
                    divers: JSON.stringify(['Steren', 'Anne', '5 plongeurs', 'mono']),
                    total_divers: 8,
                    note: 'Raies manta, cigale des mers'
                }
            });
        });

        it('should handle missing city or country cleanly', () => {
            const row = {
                Date: '18/08/2025',
                Spot: 'Blue Hole',
                Country: 'Belize',
                'Depth (m)': '30',
                'Time (min)': '40'
            };

            const result = DiveLogImporter.mapRow(row);
            assert.strictEqual(result.data.spot, 'Blue Hole');
            assert.strictEqual(result.data.city, null);
            assert.strictEqual(result.data.country, 'Belize');
        });

        it('should return null for invalid date', () => {
            const row = {
                Date: 'invalid-date',
                Spot: 'Manta Heaven',
                'Depth (m)': '11,6',
                'Time (min)': '50'
            };
            assert.strictEqual(DiveLogImporter.mapRow(row), null);
        });
    });

    describe('getTable', () => {
        it('should return dives', () => {
            assert.strictEqual(DiveLogImporter.getTable(), 'dives');
        });
    });
});
