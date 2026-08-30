/**
 * Helpers to slice a time range into days.
 * A day is identified by its UTC calendar date ('YYYY-MM-DD'), consistent with
 * how event timestamps are bucketed for display.
 */

/** First millisecond of a day. */
export function dayStartTs(day) {
    return Date.parse(`${day}T00:00:00.000Z`);
}

/** Last millisecond of a day. */
export function dayEndTs(day) {
    return Date.parse(`${day}T23:59:59.999Z`);
}

/** Day a timestamp belongs to. */
export function toDayKey(timestamp) {
    return new Date(timestamp).toISOString().split('T')[0];
}

/**
 * Timestamp window covering a batch of days, never reaching outside the selected range.
 * @param {string[]} days days ('YYYY-MM-DD'), most recent first
 * @param {number} rangeStartTs start of the selected range, in milliseconds
 * @param {number} rangeEndTs end of the selected range, in milliseconds
 * @returns {{startTs: number, endTs: number}}
 */
export function getDaysWindow(days, rangeStartTs, rangeEndTs) {
    return {
        startTs: Math.max(rangeStartTs, dayStartTs(days[days.length - 1])),
        endTs: Math.min(rangeEndTs, dayEndTs(days[0]))
    };
}

/**
 * Local midnight `days` days away from the day `dayTs` falls in.
 * Unlike the helpers above this works in local time, matching views that
 * bucket by the day the user lived through. Days are shifted on the calendar
 * rather than by 24 hours: a daylight saving change makes a day 23 or 25 hours
 * long, so adding 24 hours and rounding down to midnight lands on the wrong
 * day, or on the same day forever.
 */
export function shiftLocalDays(dayTs, days) {
    const date = new Date(dayTs);
    date.setHours(0, 0, 0, 0);
    date.setDate(date.getDate() + days);
    return date.getTime();
}
