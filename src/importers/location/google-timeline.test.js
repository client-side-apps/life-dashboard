import { describe, it } from 'node:test';
import assert from 'node:assert';
import { GoogleTimelineImporter } from './google-timeline.js';

describe('GoogleTimelineImporter', () => {

    it('should detect valid timeline JSON', () => {
        const data = { semanticSegments: [] };
        assert.ok(GoogleTimelineImporter.detect(data));

        const data2 = { timelineObjects: [] };
        assert.ok(GoogleTimelineImporter.detect(data2));
    });

    it('should not detect valid invalid data', () => {
        assert.strictEqual(GoogleTimelineImporter.detect({ foo: 'bar' }), false);
        assert.strictEqual(GoogleTimelineImporter.detect([]), false); // Expected undefined or false, depending on implementation implied
    });

    it('should extract items from semanticSegments', () => {
        const data = {
            semanticSegments: [
                {
                    timelinePath: [
                        { point: "45.0, 4.0", time: "2023-01-01T12:00:00Z" }
                    ]
                },
                {
                    visit: {
                        topCandidate: {
                            placeLocation: { latLng: "46.0, 5.0" } // Missing time at this level, extracted from startTime
                        }
                    },
                    startTime: "2023-01-01T13:00:00Z"
                }
            ]
        };

        const items = GoogleTimelineImporter.extractItems(data);
        assert.strictEqual(items.length, 2);
        assert.deepStrictEqual(items[0], { point: "45.0, 4.0", time: "2023-01-01T12:00:00Z" });
        assert.deepStrictEqual(items[1], { point: "46.0, 5.0", time: "2023-01-01T13:00:00Z" });
    });

    it('should map items to location rows', () => {
        const item = { point: "45.75211°, 4.832149°", time: "2009-11-14T08:48:00.000-08:00" };
        const row = GoogleTimelineImporter.mapRow(item);

        assert.strictEqual(row.lat, 45.75211);
        assert.strictEqual(row.lng, 4.832149);
        assert.ok(row.timestamp > 0);
    });

    it('should handle synthetic data format (no degrees)', () => {
        const item = { point: "37.7749,-122.4194", time: "2023-10-27T08:15:00.000-07:00" };
        const row = GoogleTimelineImporter.mapRow(item);

        assert.strictEqual(row.lat, 37.7749);
        assert.strictEqual(row.lng, -122.4194);
    });
});
