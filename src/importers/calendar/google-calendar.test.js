import { test } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';

import { GoogleCalendarImporter } from './google-calendar.js';
import { ICSParser } from '../../utils/ics-parser.js';

const samplePath = path.resolve(import.meta.dirname, '../../../data-samples/calendar/google/personal-calendar.ics');
const sampleContent = fs.readFileSync(samplePath, 'utf-8');

test('ICSParser parses every VEVENT of the sample file', () => {
    const rows = ICSParser.parse(sampleContent);
    assert.strictEqual(rows.length, 10);
    for (const row of rows) {
        assert.ok(row.DTSTART, 'every event should have a DTSTART');
        assert.ok(row.SUMMARY, 'every event should have a SUMMARY');
    }
});

test('ICSParser unfolds continuation lines and unescapes text', () => {
    const rows = ICSParser.parse(sampleContent);
    const tahoe = rows.find(r => r.SUMMARY.value === 'Vacation: Tahoe');
    assert.ok(tahoe);
    // The description is folded across two lines in the file.
    assert.ok(tahoe.DESCRIPTION.value.includes('remember to pick up the rental skis'));
    // Escaped commas are unescaped.
    assert.strictEqual(rows[0].LOCATION.value, '123 Main St, Palo Alto, CA');
    // Escaped newlines become real newlines.
    assert.ok(rows[0].DESCRIPTION.value.includes('\nBring insurance card.'));
});

test('detect recognizes parsed ICS events', () => {
    const rows = ICSParser.parse(sampleContent);
    assert.strictEqual(GoogleCalendarImporter.detect(rows), true);
    assert.strictEqual(GoogleCalendarImporter.detect([]), false);
    assert.strictEqual(GoogleCalendarImporter.detect([{ 'TYPE': 'Electric usage' }]), false);
});

test('mapRow maps a timed event with timezone', () => {
    const rows = ICSParser.parse(sampleContent);
    const mapped = GoogleCalendarImporter.mapRow(rows[0]);

    assert.strictEqual(mapped.title, 'Dentist appointment');
    assert.strictEqual(mapped.location, '123 Main St, Palo Alto, CA');
    assert.strictEqual(mapped.all_day, 0);
    assert.strictEqual(mapped.status, 'CONFIRMED');
    assert.strictEqual(mapped.source, 'google_calendar');
    // TZID times are interpreted as local time.
    assert.strictEqual(mapped.timestamp, new Date(2025, 0, 14, 10, 0, 0).getTime());
    assert.strictEqual(mapped.end_timestamp, new Date(2025, 0, 14, 11, 0, 0).getTime());
});

test('mapRow maps an all-day event with exclusive DTEND', () => {
    const rows = ICSParser.parse(sampleContent);
    const tahoe = rows.find(r => r.SUMMARY.value === 'Vacation: Tahoe');
    const mapped = GoogleCalendarImporter.mapRow(tahoe);

    assert.strictEqual(mapped.all_day, 1);
    assert.strictEqual(mapped.timestamp, new Date(2025, 2, 10).getTime());
    assert.strictEqual(mapped.end_timestamp, new Date(2025, 2, 15).getTime());
});

test('mapRow maps a UTC event', () => {
    const rows = ICSParser.parse(sampleContent);
    const sync = rows.find(r => r.SUMMARY.value === 'Team sync (video call)');
    const mapped = GoogleCalendarImporter.mapRow(sync);

    assert.strictEqual(mapped.all_day, 0);
    assert.strictEqual(mapped.timestamp, Date.UTC(2025, 3, 22, 16, 0, 0));
    // Empty LOCATION is stored as an empty string value; keep it falsy-safe.
    assert.ok(mapped.location === '' || mapped.location === null);
});

test('mapRow returns null for rows without a start or summary', () => {
    assert.strictEqual(GoogleCalendarImporter.mapRow({}), null);
    assert.strictEqual(GoogleCalendarImporter.mapRow({ DTSTART: { value: 'garbage' }, SUMMARY: { value: 'x' } }), null);
});
