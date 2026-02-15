import { dbService } from '../db.js';

export function getTables() {
    return dbService.getTables();
}

/**
 * Generic query execution for raw data views or complex edge cases.
 * Try to avoid using this directly in views if a specific method can be created.
 */
export function executeQuery(query, params = []) {
    return dbService.query(query, params);
}

export function exportDatabase() {
    return dbService.export();
}

export async function saveDatabase() {
    return dbService.saveToDisk();
}

export function hasFileHandle() {
    return !!dbService.fileHandle;
}

// --- Finance ---

export function getAccounts() {
    return dbService.query('SELECT * FROM accounts');
}

export function getTransactions({ accountId, startDate, endDate, limit = 50 } = {}) {
    let query = 'SELECT * FROM transactions';
    let params = [];
    let conditions = [];

    if (accountId) {
        conditions.push('account_id = ?');
        params.push(accountId);
    }

    if (startDate && endDate) {
        conditions.push('timestamp >= ? AND timestamp <= ?');
        // Ensure local day boundaries
        const startTs = new Date(startDate + 'T00:00:00').getTime();
        const endTs = new Date(endDate + 'T23:59:59.999').getTime();
        params.push(startTs);
        params.push(endTs);
    }

    if (conditions.length > 0) {
        query += ' WHERE ' + conditions.join(' AND ');
    }

    query += ' ORDER BY timestamp DESC';

    if (limit) {
        query += ` LIMIT ${limit}`;
    }

    return dbService.query(query, params);
}

// --- Energy ---

export function getEnergyOldestDate() {
    // Check standard tables
    const tables = getTables();
    let minDates = [];

    const checkTable = (tbl) => {
        if (tables.includes(tbl)) {
            const res = dbService.query(`SELECT MIN(timestamp) as min_time FROM "${tbl}"`);
            if (res.length > 0 && res[0].min_time) minDates.push(res[0].min_time);
        }
    };

    checkTable('electricity_solar_hourly');
    checkTable('electricity_grid_hourly');
    checkTable('gas_daily');
    checkTable('water_daily');

    if (minDates.length === 0) return new Date().toISOString().split('T')[0];

    minDates.sort((a, b) => a - b);
    return new Date(minDates[0]).toISOString().split('T')[0];
}

export function getTimeSeriesData(tableName, startDate, endDate, orderBy = 'ASC') {
    const tables = getTables();
    if (!tables.includes(tableName)) return [];

    let query = `SELECT * FROM "${tableName}"`;
    let params = [];

    if (startDate && endDate) {
        query += ` WHERE timestamp >= ? AND timestamp <= ?`;
        const startTs = new Date(startDate + 'T00:00:00').getTime();
        const endTs = new Date(endDate + 'T23:59:59.999').getTime();
        params.push(startTs);
        params.push(endTs);
    }

    query += ` ORDER BY timestamp ${orderBy}`;

    return dbService.query(query, params);
}

export async function ensureDailyEnergyData() {
    const tables = getTables();
    if (!tables.includes('electricity_grid_hourly') || !tables.includes('electricity_grid_daily')) return;

    // Check if daily data exists
    const dailyCount = dbService.query('SELECT COUNT(*) as c FROM electricity_grid_daily')[0].c;
    if (dailyCount > 0) return;

    // Check if hourly data exists
    const hourlyData = dbService.query('SELECT timestamp, import_kwh FROM electricity_grid_hourly');
    if (hourlyData.length === 0) return;

    console.log('Backfilling electricity_grid_daily from hourly data...');

    const dailyMap = new Map();
    for (const item of hourlyData) {
        const day = new Date(item.timestamp);
        day.setHours(0, 0, 0, 0);
        const dayTimestamp = day.getTime();

        if (!dailyMap.has(dayTimestamp)) {
            dailyMap.set(dayTimestamp, 0);
        }
        dailyMap.set(dayTimestamp, dailyMap.get(dayTimestamp) + (item.import_kwh || 0));
    }

    if (dailyMap.size > 0) {
        dbService.query('BEGIN TRANSACTION');
        try {
            for (const [timestamp, usage] of dailyMap.entries()) {
                dbService.query(
                    'INSERT INTO electricity_grid_daily (timestamp, import_kwh) VALUES (?, ?)',
                    [timestamp, usage]
                );
            }
            dbService.query('COMMIT');
            console.log(`Backfilled ${dailyMap.size} daily records.`);
        } catch (e) {
            dbService.query('ROLLBACK');
            console.error('Failed to backfill daily energy data', e);
        }
    }
}

// --- Map ---

export function getSpatialData(tableName, startDate, endDate, limit = 2000) {
    const tables = getTables();
    if (!tables.includes(tableName)) return [];

    // We need to inspect columns to find lat/lng, similar to the view logic.
    // Or we can just select *, but selecting specific columns is more efficient if we knew them.
    // For now, let's select * to allow the consumer to logic it out, or we replicates the logic here?
    // Let's rely on the View to identify columns, but perform the query here.
    // Actually, the MapView logic "Heuristic to find lat/lng" relies on column names.
    // Let's just return all rows for the date range.

    let query = `SELECT * FROM "${tableName}"`;
    let params = [];

    if (startDate && endDate) {
        // Assume timestamp column exists if we are filtering by it.
        // But we should verify. 
        // For now, assume yes as per schema.
        query += ` WHERE timestamp >= ? AND timestamp <= ?`;
        const startTs = new Date(startDate + 'T00:00:00').getTime();
        const endTs = new Date(endDate + 'T23:59:59.999').getTime();
        params.push(startTs);
        params.push(endTs);
    }

    query += ` ORDER BY timestamp DESC`; // usually we want latest
    if (limit) query += ` LIMIT ${limit}`;

    return dbService.query(query, params);
}

// --- Timeline / General ---

export function getDateRangeData(tableName, startDate, endDate) {
    return getTimeSeriesData(tableName, startDate, endDate, 'DESC');
}

// --- Health / Activities ---

export function getDistinctValues(tableName, columnName) {
    const tables = getTables();
    if (!tables.includes(tableName)) return [];
    const res = dbService.query(`SELECT DISTINCT "${columnName}" FROM "${tableName}" WHERE "${columnName}" IS NOT NULL ORDER BY "${columnName}" ASC`);
    return res.map(r => r[columnName]);
}

export function getSteps({ startDate, endDate, type } = {}) {
    const tableName = 'steps';
    const tables = getTables();
    if (!tables.includes(tableName)) return [];

    let query = `SELECT * FROM "${tableName}"`;
    let params = [];
    let whereClauses = [];

    if (startDate && endDate) {
        whereClauses.push(`timestamp >= ? AND timestamp <= ?`);
        const startTs = new Date(startDate + 'T00:00:00').getTime();
        const endTs = new Date(endDate + 'T23:59:59.999').getTime();
        params.push(startTs);
        params.push(endTs);
    }

    if (type && type !== 'All') {
        whereClauses.push(`type = ?`);
        params.push(type);
    }

    if (whereClauses.length > 0) {
        query += ` WHERE ` + whereClauses.join(' AND ');
    }

    query += ` ORDER BY timestamp DESC`;

    return dbService.query(query, params);
}

export function getLatestDataDate() {
    const tables = getTables();
    let maxTimestamp = 0;

    for (const table of tables) {
        try {
            const res = dbService.query(`SELECT MAX(timestamp) as max_ts FROM "${table}"`);
            if (res.length > 0 && res[0].max_ts) {
                maxTimestamp = Math.max(maxTimestamp, res[0].max_ts);
            }
        } catch (e) {
            // Ignore tables without timestamp
            console.warn(`Could not get max timestamp for table ${table}`, e);
        }
    }

    return maxTimestamp > 0 ? maxTimestamp : null;
}
