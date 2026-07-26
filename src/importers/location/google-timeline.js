import { BaseImporter } from '../base-importer.js';

export class GoogleTimelineImporter extends BaseImporter {
    static get source() {
        return 'google-timeline';
    }

    static detect(data) {
        if (!data) return false;
        // Takeout semantic export or on-device export wrapped in an object
        if (Array.isArray(data.semanticSegments) || Array.isArray(data.timelineObjects)) return true;
        // Raw Takeout "Records.json" (full location history)
        if (Array.isArray(data.locations)) return true;
        // On-device Timeline export (phone): a top-level array of segments
        if (Array.isArray(data) && data.length > 0) {
            const first = data[0];
            return !!(first && typeof first === 'object' && first.startTime &&
                (first.visit || first.activity || first.timelinePath));
        }
        return false;
    }

    static getTable() {
        return 'location';
    }

    static extractItems(data) {
        if (Array.isArray(data.semanticSegments)) {
            return this.extractSemanticSegments(data.semanticSegments);
        }
        if (Array.isArray(data.timelineObjects)) {
            return this.extractTimelineObjects(data.timelineObjects);
        }
        if (Array.isArray(data.locations)) {
            return this.extractRecords(data.locations);
        }
        if (Array.isArray(data)) {
            // On-device exports use the same segment shapes as semanticSegments.
            return this.extractSemanticSegments(data);
        }
        return [];
    }

    /**
     * "Semantic segments" format, used by both the Takeout semantic export and
     * the on-device Timeline export. The on-device variant stores coordinates
     * as 'geo:lat,lng' strings and timelinePath times as minute offsets from
     * the segment start.
     */
    static extractSemanticSegments(segments) {
        const items = [];

        // Coordinates appear as objects ({ latLng: '…' }) or plain strings.
        const latLngOf = (loc) => {
            if (!loc) return null;
            if (typeof loc === 'string') return loc;
            return loc.latLng || null;
        };

        for (const segment of segments) {
            // High fidelity points from timelinePath if available
            if (segment.timelinePath && Array.isArray(segment.timelinePath)) {
                for (const p of segment.timelinePath) {
                    let time = p.time || null;
                    // On-device exports carry an offset instead of a timestamp.
                    if (!time && p.durationMinutesOffsetFromStartTime != null && segment.startTime) {
                        const startTs = new Date(segment.startTime).getTime();
                        const offsetMin = parseFloat(p.durationMinutesOffsetFromStartTime);
                        if (!isNaN(startTs) && !isNaN(offsetMin)) {
                            time = new Date(startTs + offsetMin * 60000).toISOString();
                        }
                    }
                    if (p.point && time) {
                        items.push({ point: p.point, time });
                    }
                }
            }
            // Visits have a 'placeLocation'; the user was there for the whole
            // start/end span, so record a point at both ends of the visit.
            else if (segment.visit && segment.visit.topCandidate) {
                const latLng = latLngOf(segment.visit.topCandidate.placeLocation);
                if (latLng) {
                    if (segment.startTime) {
                        items.push({ point: latLng, time: segment.startTime });
                    }
                    if (segment.endTime && segment.endTime !== segment.startTime) {
                        items.push({ point: latLng, time: segment.endTime });
                    }
                }
            }
            // Activities without a timelinePath still carry start/end coordinates
            else if (segment.activity) {
                const start = latLngOf(segment.activity.start);
                if (start && segment.startTime) {
                    items.push({ point: start, time: segment.startTime });
                }
                const end = latLngOf(segment.activity.end);
                if (end && segment.endTime) {
                    items.push({ point: end, time: segment.endTime });
                }
            }
        }
        return items;
    }

    /**
     * Legacy "Semantic Location History" export format (timelineObjects with
     * placeVisit / activitySegment and E7 integer coordinates).
     */
    static extractTimelineObjects(objects) {
        const items = [];
        const e7Point = (loc) => {
            if (!loc || loc.latitudeE7 === undefined || loc.longitudeE7 === undefined) return null;
            return `${loc.latitudeE7 / 1e7},${loc.longitudeE7 / 1e7}`;
        };

        for (const obj of objects) {
            if (obj.placeVisit) {
                const point = e7Point(obj.placeVisit.location);
                const duration = obj.placeVisit.duration || {};
                if (point) {
                    if (duration.startTimestamp) {
                        items.push({ point, time: duration.startTimestamp });
                    }
                    if (duration.endTimestamp && duration.endTimestamp !== duration.startTimestamp) {
                        items.push({ point, time: duration.endTimestamp });
                    }
                }
            } else if (obj.activitySegment) {
                const segment = obj.activitySegment;
                const duration = segment.duration || {};

                // Prefer the raw path when present: it has per-point timestamps
                const rawPoints = segment.simplifiedRawPath && Array.isArray(segment.simplifiedRawPath.points)
                    ? segment.simplifiedRawPath.points
                    : [];
                for (const p of rawPoints) {
                    const point = e7Point({ latitudeE7: p.latE7, longitudeE7: p.lngE7 });
                    const time = p.timestamp || (p.timestampMs ? new Date(parseInt(p.timestampMs, 10)).toISOString() : null);
                    if (point && time) {
                        items.push({ point, time });
                    }
                }

                const start = e7Point(segment.startLocation);
                if (start && duration.startTimestamp) {
                    items.push({ point: start, time: duration.startTimestamp });
                }
                const end = e7Point(segment.endLocation);
                if (end && duration.endTimestamp) {
                    items.push({ point: end, time: duration.endTimestamp });
                }
            }
        }
        return items;
    }

    /**
     * Raw Takeout "Records.json" format: a flat 'locations' array of E7
     * coordinates with a 'timestamp' (ISO) or legacy 'timestampMs' field.
     */
    static extractRecords(locations) {
        const items = [];
        for (const loc of locations) {
            if (loc.latitudeE7 === undefined || loc.longitudeE7 === undefined) continue;
            const time = loc.timestamp || (loc.timestampMs ? new Date(parseInt(loc.timestampMs, 10)).toISOString() : null);
            if (!time) continue;
            items.push({ point: `${loc.latitudeE7 / 1e7},${loc.longitudeE7 / 1e7}`, time });
        }
        return items;
    }

    static mapRow(item) {
        if (!item.point || !item.time) return null;

        // Points come as '45.75211°, 4.832149°', '45.75211,4.832149'
        // or 'geo:45.75211,4.832149' (on-device exports).
        const parts = item.point.replace(/^geo:/i, '').replace(/°/g, '').split(',');
        if (parts.length !== 2) return null;

        const lat = parseFloat(parts[0].trim());
        const lng = parseFloat(parts[1].trim());

        if (isNaN(lat) || isNaN(lng)) return null;
        if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;

        const timestamp = new Date(item.time).getTime();
        if (isNaN(timestamp)) return null;

        return { lat, lng, timestamp };
    }
}
