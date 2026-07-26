/**
 * Carbon footprint estimation from energy and location data.
 * Factors are rough averages in kg CO2e; tune them to your region.
 */
export const EMISSION_FACTORS = {
    // California grid average (kg CO2e per kWh imported from the grid)
    electricity_kg_per_kwh: 0.21,
    // EPA factor for natural gas (kg CO2e per therm)
    gas_kg_per_therm: 5.3,
    // Average passenger car (kg CO2e per km)
    car_kg_per_km: 0.17,
    // Medium/long-haul flight per passenger (kg CO2e per km)
    flight_kg_per_km: 0.15
};

// Above this daily travel distance, the day is assumed to include a flight.
export const FLIGHT_DISTANCE_THRESHOLD_KM = 500;

/**
 * Great-circle distance between two coordinates, in km.
 */
export function haversineKm(lat1, lng1, lat2, lng2) {
    const toRad = (deg) => deg * Math.PI / 180;
    const R = 6371;
    const dLat = toRad(lat2 - lat1);
    const dLng = toRad(lng2 - lng1);
    const a = Math.sin(dLat / 2) ** 2 +
        Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(a));
}

function dayStart(ts) {
    return new Date(ts).setHours(0, 0, 0, 0);
}

/**
 * Total distance traveled per day, from consecutive location points.
 * @param {Array<{timestamp: number, lat: number, lng: number}>} locationRows
 * @returns {Map<number, number>} day timestamp (local midnight) -> km
 */
export function dailyTravelKm(locationRows) {
    const kmByDay = new Map();
    const sorted = [...locationRows].sort((a, b) => a.timestamp - b.timestamp);

    for (let i = 1; i < sorted.length; i++) {
        const prev = sorted[i - 1];
        const curr = sorted[i];
        // Only count movement within the same day so a gap in data doesn't
        // attribute a whole trip to one day boundary.
        const day = dayStart(curr.timestamp);
        if (dayStart(prev.timestamp) !== day) continue;

        const km = haversineKm(prev.lat, prev.lng, curr.lat, curr.lng);
        if (isNaN(km) || km <= 0) continue;
        kmByDay.set(day, (kmByDay.get(day) || 0) + km);
    }
    return kmByDay;
}

/**
 * Daily carbon footprint estimate.
 * @param {Object} input
 * @param {Array<{timestamp: number, import_kwh: number}>} input.electricityRows daily grid imports
 * @param {Array<{timestamp: number, usage_therms: number}>} input.gasRows daily gas usage
 * @param {Array<{timestamp: number, lat: number, lng: number}>} input.locationRows location points
 * @returns {Array<{timestamp: number, electricity_kg: number|null, gas_kg: number|null, travel_kg: number|null, travel_km: number}>}
 *   one entry per day holding data, sorted by day
 */
export function computeDailyFootprint({ electricityRows = [], gasRows = [], locationRows = [] }) {
    const days = new Map();
    const entry = (day) => {
        if (!days.has(day)) {
            days.set(day, { timestamp: day, electricity_kg: null, gas_kg: null, travel_kg: null, travel_km: 0 });
        }
        return days.get(day);
    };

    const round = (v) => Math.round(v * 100) / 100;

    for (const row of electricityRows) {
        if (row.import_kwh == null) continue;
        const e = entry(dayStart(row.timestamp));
        e.electricity_kg = round((e.electricity_kg || 0) + row.import_kwh * EMISSION_FACTORS.electricity_kg_per_kwh);
    }

    for (const row of gasRows) {
        if (row.usage_therms == null) continue;
        const e = entry(dayStart(row.timestamp));
        e.gas_kg = round((e.gas_kg || 0) + row.usage_therms * EMISSION_FACTORS.gas_kg_per_therm);
    }

    for (const [day, km] of dailyTravelKm(locationRows)) {
        const e = entry(day);
        const factor = km > FLIGHT_DISTANCE_THRESHOLD_KM
            ? EMISSION_FACTORS.flight_kg_per_km
            : EMISSION_FACTORS.car_kg_per_km;
        e.travel_km = round(km);
        e.travel_kg = round(km * factor);
    }

    return Array.from(days.values()).sort((a, b) => a.timestamp - b.timestamp);
}
