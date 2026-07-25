import { BaseImporter } from '../base-importer.js';

export class GoogleTimelineImporter extends BaseImporter {
    static get source() {
        return 'google-timeline';
    }

    static detect(data) {
        // Check if it has semanticSegments which is typical of the semantic JSON export
        return data && (Array.isArray(data.semanticSegments) || Array.isArray(data.timelineObjects));
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
        return [];
    }

    /**
     * Modern "semantic segments" export format.
     */
    static extractSemanticSegments(segments) {
        const items = [];

        for (const segment of segments) {
            // High fidelity points from timelinePath if available
            if (segment.timelinePath && Array.isArray(segment.timelinePath)) {
                items.push(...segment.timelinePath);
            }
            // Visits have a 'placeLocation'; the user was there for the whole
            // start/end span, so record a point at both ends of the visit.
            else if (segment.visit && segment.visit.topCandidate && segment.visit.topCandidate.placeLocation) {
                const latLng = segment.visit.topCandidate.placeLocation.latLng;
                if (segment.startTime) {
                    items.push({ point: latLng, time: segment.startTime });
                }
                if (segment.endTime && segment.endTime !== segment.startTime) {
                    items.push({ point: latLng, time: segment.endTime });
                }
            }
            // Activities without a timelinePath still carry start/end coordinates
            else if (segment.activity) {
                if (segment.activity.start && segment.activity.start.latLng && segment.startTime) {
                    items.push({ point: segment.activity.start.latLng, time: segment.startTime });
                }
                if (segment.activity.end && segment.activity.end.latLng && segment.endTime) {
                    items.push({ point: segment.activity.end.latLng, time: segment.endTime });
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

    static mapRow(item) {
        if (!item.point || !item.time) return null;

        // Parse point "45.75211°, 4.832149°"
        // Remove '°' and split
        const parts = item.point.replace(/°/g, '').split(',');
        if (parts.length !== 2) return null;

        const lat = parseFloat(parts[0].trim());
        const lng = parseFloat(parts[1].trim());

        if (isNaN(lat) || isNaN(lng)) return null;

        return {
            lat,
            lng,
            timestamp: new Date(item.time).getTime()
        };
    }
}
