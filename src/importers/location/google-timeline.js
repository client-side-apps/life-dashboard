import { BaseImporter } from '../base-importer.js';

export class GoogleTimelineImporter extends BaseImporter {

    static detect(data) {
        // Check if it has semanticSegments which is typical of the semantic JSON export
        return data && (Array.isArray(data.semanticSegments) || Array.isArray(data.timelineObjects));
    }

    static getTable() {
        return 'location';
    }

    static extractItems(data) {
        const items = [];
        const segments = data.semanticSegments || data.timelineObjects || [];

        for (const segment of segments) {
            // We want to extract high fidelity points from timelinePath if available
            if (segment.timelinePath && Array.isArray(segment.timelinePath)) {
                items.push(...segment.timelinePath);
            }
            // If no timelinePath, maybe we can use the start/end location if it's a visit?
            // But timelinePath is the best source for "path" data.
            // Visits usually have a 'placeLocation'
            else if (segment.visit && segment.visit.topCandidate && segment.visit.topCandidate.placeLocation) {
                // Construct a point-like object for consistency
                items.push({
                    point: segment.visit.topCandidate.placeLocation.latLng,
                    time: segment.startTime
                });
            }
            // Activities might have start/end logic but timelinePath is usually present for activities too?
            // Let's stick to simple extraction for now.
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
