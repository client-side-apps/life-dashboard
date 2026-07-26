import { test } from 'node:test';
import assert from 'node:assert';

import { haversineKm, dailyTravelKm, computeDailyFootprint, EMISSION_FACTORS } from './carbon.js';

test('haversineKm computes known distances', () => {
    // San Francisco -> Los Angeles is roughly 560 km
    const km = haversineKm(37.7749, -122.4194, 34.0522, -118.2437);
    assert.ok(km > 540 && km < 580, `expected ~560 km, got ${km}`);
    assert.strictEqual(haversineKm(37, -122, 37, -122), 0);
});

test('dailyTravelKm sums consecutive points within a day only', () => {
    const day1 = new Date(2025, 5, 1, 8).getTime();
    const rows = [
        { timestamp: day1, lat: 37.7749, lng: -122.4194 },
        { timestamp: day1 + 3600000, lat: 37.7849, lng: -122.4094 },
        // Next point is on another day: the gap must not be counted.
        { timestamp: day1 + 86400000 * 2, lat: 34.0522, lng: -118.2437 }
    ];

    const kmByDay = dailyTravelKm(rows);
    assert.strictEqual(kmByDay.size, 1);
    const km = kmByDay.get(new Date(2025, 5, 1).getTime());
    assert.ok(km > 1 && km < 3, `expected a short hop, got ${km}`);
});

test('computeDailyFootprint applies emission factors per source', () => {
    const day = new Date(2025, 5, 1).getTime();
    const result = computeDailyFootprint({
        electricityRows: [{ timestamp: day + 3600000, import_kwh: 10 }],
        gasRows: [{ timestamp: day + 7200000, usage_therms: 2 }],
        locationRows: [
            { timestamp: day + 8 * 3600000, lat: 37.7749, lng: -122.4194 },
            { timestamp: day + 9 * 3600000, lat: 37.8749, lng: -122.4194 }
        ]
    });

    assert.strictEqual(result.length, 1);
    const e = result[0];
    assert.strictEqual(e.timestamp, day);
    assert.strictEqual(e.electricity_kg, Math.round(10 * EMISSION_FACTORS.electricity_kg_per_kwh * 100) / 100);
    assert.strictEqual(e.gas_kg, Math.round(2 * EMISSION_FACTORS.gas_kg_per_therm * 100) / 100);
    // ~11.1 km at the car factor
    assert.ok(e.travel_kg > 1.5 && e.travel_kg < 2.5, `expected car-factor travel, got ${e.travel_kg}`);
});

test('computeDailyFootprint uses the flight factor for long-distance days', () => {
    const day = new Date(2025, 5, 2).getTime();
    const result = computeDailyFootprint({
        locationRows: [
            { timestamp: day + 8 * 3600000, lat: 37.7749, lng: -122.4194 },
            // SF -> Portland within the same day (~870 km)
            { timestamp: day + 11 * 3600000, lat: 45.5152, lng: -122.6784 }
        ]
    });

    assert.strictEqual(result.length, 1);
    const e = result[0];
    assert.ok(e.travel_km > 500, 'day should cross the flight threshold');
    const expected = Math.round(e.travel_km * EMISSION_FACTORS.flight_kg_per_km * 100) / 100;
    assert.ok(Math.abs(e.travel_kg - expected) < 0.05);
    assert.strictEqual(e.electricity_kg, null);
    assert.strictEqual(e.gas_kg, null);
});
