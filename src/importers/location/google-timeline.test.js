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

    it('should record both ends of a visit', () => {
        const data = {
            semanticSegments: [
                {
                    startTime: "2023-01-01T13:00:00Z",
                    endTime: "2023-01-01T14:00:00Z",
                    visit: {
                        topCandidate: {
                            placeLocation: { latLng: "46.0, 5.0" }
                        }
                    }
                }
            ]
        };
        const items = GoogleTimelineImporter.extractItems(data);
        assert.strictEqual(items.length, 2);
        assert.strictEqual(items[0].time, "2023-01-01T13:00:00Z");
        assert.strictEqual(items[1].time, "2023-01-01T14:00:00Z");
    });

    it('should extract activity start/end when no timelinePath exists', () => {
        const data = {
            semanticSegments: [
                {
                    startTime: "2023-01-01T10:00:00Z",
                    endTime: "2023-01-01T10:30:00Z",
                    activity: {
                        start: { latLng: "45.0, 4.0" },
                        end: { latLng: "45.1, 4.1" }
                    }
                }
            ]
        };
        const items = GoogleTimelineImporter.extractItems(data);
        assert.strictEqual(items.length, 2);
        assert.deepStrictEqual(items[0], { point: "45.0, 4.0", time: "2023-01-01T10:00:00Z" });
        assert.deepStrictEqual(items[1], { point: "45.1, 4.1", time: "2023-01-01T10:30:00Z" });
    });

    it('should extract items from the legacy timelineObjects format', () => {
        const data = {
            timelineObjects: [
                {
                    placeVisit: {
                        location: { latitudeE7: 457521100, longitudeE7: 48321490 },
                        duration: {
                            startTimestamp: "2021-05-01T09:00:00Z",
                            endTimestamp: "2021-05-01T10:00:00Z"
                        }
                    }
                },
                {
                    activitySegment: {
                        startLocation: { latitudeE7: 377490000, longitudeE7: -1224194000 },
                        endLocation: { latitudeE7: 378490000, longitudeE7: -1224094000 },
                        duration: {
                            startTimestamp: "2021-05-01T10:00:00Z",
                            endTimestamp: "2021-05-01T10:30:00Z"
                        },
                        simplifiedRawPath: {
                            points: [
                                { latE7: 377500000, lngE7: -1224150000, timestamp: "2021-05-01T10:15:00Z" }
                            ]
                        }
                    }
                }
            ]
        };

        const items = GoogleTimelineImporter.extractItems(data);
        assert.strictEqual(items.length, 5, 'Visit start+end, raw path point, activity start+end');

        const visitRow = GoogleTimelineImporter.mapRow(items[0]);
        assert.strictEqual(visitRow.lat, 45.75211);
        assert.strictEqual(visitRow.lng, 4.832149);
        assert.strictEqual(visitRow.timestamp, new Date("2021-05-01T09:00:00Z").getTime());

        const pathRow = GoogleTimelineImporter.mapRow(items[2]);
        assert.strictEqual(pathRow.lat, 37.75);
        assert.strictEqual(pathRow.lng, -122.415);
    });

    it('should handle synthetic data format (no degrees)', () => {
        const item = { point: "37.7749,-122.4194", time: "2023-10-27T08:15:00.000-07:00" };
        const row = GoogleTimelineImporter.mapRow(item);

        assert.strictEqual(row.lat, 37.7749);
        assert.strictEqual(row.lng, -122.4194);
    });

    it('should detect the on-device Timeline export (top-level array)', () => {
        const data = [
            { startTime: "2025-01-01T08:00:00Z", endTime: "2025-01-01T09:00:00Z", visit: {} }
        ];
        assert.ok(GoogleTimelineImporter.detect(data));
        assert.strictEqual(GoogleTimelineImporter.detect([{ foo: 'bar' }]), false);
    });

    it('should parse geo: URI coordinates', () => {
        const row = GoogleTimelineImporter.mapRow({ point: "geo:37.7749,-122.4194", time: "2025-01-01T08:00:00Z" });
        assert.strictEqual(row.lat, 37.7749);
        assert.strictEqual(row.lng, -122.4194);
    });

    it('should reject out-of-range coordinates and invalid times', () => {
        assert.strictEqual(GoogleTimelineImporter.mapRow({ point: "137.0,-122.0", time: "2025-01-01T08:00:00Z" }), null);
        assert.strictEqual(GoogleTimelineImporter.mapRow({ point: "37.0,-222.0", time: "2025-01-01T08:00:00Z" }), null);
        assert.strictEqual(GoogleTimelineImporter.mapRow({ point: "37.0,-122.0", time: "not a time" }), null);
    });

    it('should extract on-device segments with geo: strings and minute offsets', () => {
        const data = [
            {
                startTime: "2025-01-01T08:00:00.000Z",
                endTime: "2025-01-01T09:00:00.000Z",
                timelinePath: [
                    { point: "geo:37.7749,-122.4194", durationMinutesOffsetFromStartTime: "0" },
                    { point: "geo:37.7849,-122.4094", durationMinutesOffsetFromStartTime: "30" }
                ]
            },
            {
                startTime: "2025-01-01T10:00:00.000Z",
                endTime: "2025-01-01T11:00:00.000Z",
                visit: { topCandidate: { placeLocation: "geo:37.7749,-122.4194" } }
            },
            {
                startTime: "2025-01-01T12:00:00.000Z",
                endTime: "2025-01-01T12:30:00.000Z",
                activity: { start: "geo:37.7749,-122.4194", end: "geo:37.7849,-122.4094" }
            }
        ];

        const items = GoogleTimelineImporter.extractItems(data);
        assert.strictEqual(items.length, 6, 'two path points, visit start+end, activity start+end');

        const second = GoogleTimelineImporter.mapRow(items[1]);
        assert.strictEqual(second.timestamp, new Date("2025-01-01T08:30:00.000Z").getTime(), 'offset minutes are added to segment start');
        assert.strictEqual(second.lat, 37.7849);

        const visitStart = GoogleTimelineImporter.mapRow(items[2]);
        assert.strictEqual(visitStart.lat, 37.7749);
        assert.strictEqual(visitStart.timestamp, new Date("2025-01-01T10:00:00.000Z").getTime());
    });

    it('should extract the raw Records.json format', () => {
        const data = {
            locations: [
                { latitudeE7: 377490000, longitudeE7: -1224194000, timestamp: "2025-01-01T08:00:00Z" },
                { latitudeE7: 377500000, longitudeE7: -1224150000, timestampMs: "1735718400000" },
                { latitudeE7: 377510000 } // no longitude/time: skipped
            ]
        };

        assert.ok(GoogleTimelineImporter.detect(data));

        const items = GoogleTimelineImporter.extractItems(data);
        assert.strictEqual(items.length, 2);

        const first = GoogleTimelineImporter.mapRow(items[0]);
        assert.strictEqual(first.lat, 37.749);
        assert.strictEqual(first.lng, -122.4194);

        const second = GoogleTimelineImporter.mapRow(items[1]);
        assert.strictEqual(second.timestamp, 1735718400000);
    });
});
