import { BaseImporter } from '../base-importer.js';
import { ICSParser } from '../../utils/ics-parser.js';

/**
 * Imports Google Calendar exports (.ics files from Google Takeout or a
 * calendar's "Export" option). Rows are VEVENT objects produced by ICSParser.
 */
export class GoogleCalendarImporter extends BaseImporter {
    static get source() {
        return 'google_calendar';
    }

    static detect(rows) {
        if (!rows || !Array.isArray(rows) || rows.length === 0) return false;
        const first = rows[0];
        return typeof first === 'object' && 'DTSTART' in first && 'SUMMARY' in first;
    }

    static getTable() {
        return 'calendar_events';
    }

    static mapRow(row) {
        if (!row.DTSTART || !row.SUMMARY) return null;

        const start = ICSParser.parseDate(row.DTSTART.value, row.DTSTART.params);
        if (!start) return null;

        let endTimestamp = null;
        if (row.DTEND) {
            const end = ICSParser.parseDate(row.DTEND.value, row.DTEND.params);
            if (end) endTimestamp = end.timestamp;
        }
        // DTEND is exclusive for all-day events; a single-day event ends the next
        // midnight. Default a missing DTEND to a one-day span for all-day events.
        if (endTimestamp === null && start.allDay) {
            endTimestamp = start.timestamp + 24 * 3600 * 1000;
        }

        return {
            timestamp: start.timestamp,
            end_timestamp: endTimestamp,
            title: row.SUMMARY.value,
            description: row.DESCRIPTION ? row.DESCRIPTION.value : null,
            location: row.LOCATION ? row.LOCATION.value : null,
            all_day: start.allDay ? 1 : 0,
            status: row.STATUS ? row.STATUS.value : null,
            source: 'google_calendar'
        };
    }
}
