/**
 * Minimal iCalendar (RFC 5545) parser, sufficient for calendar exports
 * such as Google Calendar (Takeout) .ics files.
 *
 * Returns one object per VEVENT. Each property is stored under its name as
 * `{ value, params }`, e.g.:
 *   { DTSTART: { value: '20250114T100000', params: { TZID: 'America/Los_Angeles' } },
 *     SUMMARY: { value: 'Dentist' } }
 */
export class ICSParser {
    static parse(content) {
        const lines = this.unfoldLines(content);
        const events = [];
        let current = null;

        for (const line of lines) {
            if (line === 'BEGIN:VEVENT') {
                current = {};
                continue;
            }
            if (line === 'END:VEVENT') {
                if (current) events.push(current);
                current = null;
                continue;
            }
            if (!current) continue;

            const prop = this.parseProperty(line);
            // Keep the first occurrence (e.g. several ATTENDEE lines).
            if (prop && !(prop.name in current)) {
                current[prop.name] = { value: prop.value, params: prop.params };
            }
        }

        return events;
    }

    /**
     * Joins folded lines: a line starting with a space or tab continues the
     * previous one (RFC 5545 section 3.1).
     */
    static unfoldLines(content) {
        const rawLines = content.split(/\r\n|\n|\r/);
        const lines = [];
        for (const raw of rawLines) {
            if ((raw.startsWith(' ') || raw.startsWith('\t')) && lines.length > 0) {
                lines[lines.length - 1] += raw.slice(1);
            } else if (raw.length > 0) {
                lines.push(raw);
            }
        }
        return lines;
    }

    /**
     * Parses 'NAME;PARAM=VALUE:value' into { name, params, value }.
     */
    static parseProperty(line) {
        // The name/params part cannot contain ':' except inside quoted params.
        let colonIndex = -1;
        let inQuotes = false;
        for (let i = 0; i < line.length; i++) {
            const c = line[i];
            if (c === '"') inQuotes = !inQuotes;
            else if (c === ':' && !inQuotes) { colonIndex = i; break; }
        }
        if (colonIndex === -1) return null;

        const nameAndParams = line.slice(0, colonIndex).split(';');
        const name = nameAndParams[0].toUpperCase();
        if (!name) return null;

        const params = {};
        for (const paramStr of nameAndParams.slice(1)) {
            const eq = paramStr.indexOf('=');
            if (eq === -1) continue;
            params[paramStr.slice(0, eq).toUpperCase()] = paramStr.slice(eq + 1).replace(/^"|"$/g, '');
        }

        return { name, params, value: this.unescapeText(line.slice(colonIndex + 1)) };
    }

    /**
     * Unescapes TEXT values: \\n -> newline, \\, \\; \\\\ -> literal char.
     */
    static unescapeText(value) {
        return value.replace(/\\(n|N|,|;|\\)/g, (m, c) => (c === 'n' || c === 'N') ? '\n' : c);
    }

    /**
     * Converts an iCalendar DATE or DATE-TIME value to a Unix timestamp (ms).
     * - DATE (YYYYMMDD): local midnight, flagged as all-day.
     * - DATE-TIME ending in 'Z': UTC.
     * - DATE-TIME with a TZID or floating: interpreted as local time.
     * @returns {{timestamp: number, allDay: boolean}|null}
     */
    static parseDate(value, params = {}) {
        if (!value) return null;

        const dateOnly = /^(\d{4})(\d{2})(\d{2})$/.exec(value);
        if (dateOnly || (params.VALUE === 'DATE')) {
            const m = dateOnly || /^(\d{4})(\d{2})(\d{2})/.exec(value);
            if (!m) return null;
            const ts = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])).getTime();
            return isNaN(ts) ? null : { timestamp: ts, allDay: true };
        }

        const dateTime = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(Z?)$/.exec(value);
        if (!dateTime) return null;

        const [, y, mo, d, h, mi, s, z] = dateTime;
        const ts = z === 'Z'
            ? Date.UTC(Number(y), Number(mo) - 1, Number(d), Number(h), Number(mi), Number(s))
            : new Date(Number(y), Number(mo) - 1, Number(d), Number(h), Number(mi), Number(s)).getTime();

        return isNaN(ts) ? null : { timestamp: ts, allDay: false };
    }
}
