import { CSVParser } from '../utils/csv-parser.js';
import { dbService } from '../db.js';
import { PgeImporter } from '../importers/energy/pge.js';
import { TeslaImporter } from '../importers/energy/tesla.js';
import { SfcuImporter } from '../importers/finance/sfcu.js';
import { WithingsImporter } from '../importers/health/withings.js';
import { CronometerImporter } from '../importers/health/cronometer.js';
import { GoogleTimelineImporter } from '../importers/location/google-timeline.js';
import { FlumeImporter } from '../importers/water/flume.js';

export class DataImporter {

    static importers = [PgeImporter, TeslaImporter, SfcuImporter, WithingsImporter, CronometerImporter, GoogleTimelineImporter, FlumeImporter];

    static async import(filename, content, options = {}) {
        await dbService.ensureInitialized();

        let rows;
        let jsonData;
        const isJson = filename.toLowerCase().endsWith('.json');

        try {
            if (isJson) {
                jsonData = JSON.parse(content);
            } else {
                // Special handling for PGE preamble which confuses the generic parser header detection
                if (content.indexOf('TYPE,DATE,START TIME') > 0) {
                    const pgeHeaderIndex = content.indexOf('TYPE,DATE,START TIME');
                    content = content.substring(pgeHeaderIndex);
                }
                rows = CSVParser.parse(content);
            }
        } catch (e) {
            return { success: 0, skipped: 0, errors: 0, message: "Failed to parse file: " + e.message };
        }

        if ((!isJson && (!rows || rows.length === 0)) || (isJson && !jsonData)) {
            return { success: 0, skipped: 0, errors: 0, message: "File is empty or could not be parsed." };
        }

        // Detect Importer
        let ImporterClass = null;

        if (options.provider) {
            if (options.provider === 'pge') ImporterClass = PgeImporter;
            else if (options.provider === 'tesla') ImporterClass = TeslaImporter;
            else if (options.provider === 'sfcu') ImporterClass = SfcuImporter;
            else if (options.provider === 'google_timeline') ImporterClass = GoogleTimelineImporter;
        } else {
            ImporterClass = this.importers.find(i => isJson ? i.detect(jsonData) : i.detect(rows));
        }

        if (!ImporterClass) {
            return { success: 0, skipped: 0, errors: 0, message: "Unknown file format." };
        }

        console.log(`Detected format: ${ImporterClass.name}`);
        // Importer might return a fixed table or null if dynamic
        const defaultTable = ImporterClass.getTable();

        let successCount = 0;
        let skippedCount = 0;
        let errorCount = 0;

        const itemsToProcess = isJson ? (ImporterClass.extractItems ? ImporterClass.extractItems(jsonData) : (Array.isArray(jsonData) ? jsonData : [jsonData])) : rows;

        // Pre-processing: Map all items to their target tables and data
        const processedItems = [];
        for (const row of itemsToProcess) {
            try {
                const mapped = ImporterClass.mapRow(row);
                if (!mapped) continue;

                let table = defaultTable;
                let data = mapped;

                if (mapped.table && mapped.data) {
                    table = mapped.table;
                    data = mapped.data;
                }

                if (table) {
                    processedItems.push({ table, data });
                }
            } catch (err) {
                console.warn("Row mapping error", err);
                errorCount++;
            }
        }

        if (processedItems.length === 0) {
            return { success: 0, skipped: 0, errors: errorCount, message: `Type: ${ImporterClass.name}. No valid items found.` };
        }

        // Optimization: Batch existence check
        // Group by table to minimize context switching? 
        // Actually, we just need to know which ones exist.
        // Let's do it per table.
        const itemsByTable = {};
        for (const item of processedItems) {
            if (!itemsByTable[item.table]) itemsByTable[item.table] = [];
            itemsByTable[item.table].push(item.data);
        }

        dbService.query('BEGIN TRANSACTION');

        try {
            for (const [table, items] of Object.entries(itemsByTable)) {
                // Get range of timestamps for this batch
                const timestamps = items.map(i => i.timestamp).filter(t => t);

                if (timestamps.length === 0) continue; // Should not happen if mapRow works

                const minTime = timestamps.reduce((min, t) => t < min ? t : min, Infinity);
                const maxTime = timestamps.reduce((max, t) => t > max ? t : max, -Infinity);

                // Fetch existing records in this range
                // Note: For transactions, we need more than just timestamp, so this optimization 
                // mainly targets the simple time-series tables.

                const existingMap = new Map(); // Map<timestamp, id>

                if (table !== 'transactions') {
                    const existingRecords = await this.findExistingBatch(table, minTime, maxTime);
                    existingRecords.forEach(r => existingMap.set(r.timestamp, r.id));
                }

                // Now process inserts/updates
                for (const data of items) {
                    try {
                        let existingId = null;

                        if (table === 'transactions') {
                            // Fallback to individual check for complex keys
                            existingId = await this.findExisting(table, data);
                        } else {
                            existingId = existingMap.get(data.timestamp);
                        }

                        if (existingId) {
                            await this.update(table, existingId, data);
                            successCount++;
                        } else {
                            await this.insert(table, data);
                            // Update our local map in case of duplicates within the same file?
                            // Technically possible, but usually we just process them. 
                            // If we have duplicates in the file, we might overwrite or insert twice.
                            // The map check prevents inserting twice if we update the map, 
                            // BUT we don't know the new ID without querying back.
                            // Since we trust the file is sequential or distinct usually, 
                            // we can perhaps skip updating the map for performance, 
                            // OR we assume the user doesn't have duplicates in the same import file.
                            successCount++;
                        }
                    } catch (err) {
                        console.warn("Row import error", err);
                        errorCount++;
                    }
                }
            }

            dbService.query('COMMIT');
        } catch (e) {
            dbService.query('ROLLBACK');
            console.error("Import transaction failed", e);
            throw e;
        }

        return {
            success: successCount,
            skipped: skippedCount,
            errors: errorCount,
            message: `Type: ${ImporterClass.name}. Processed: ${successCount}. Errors: ${errorCount}`
        };
    }

    static async findExistingBatch(table, minTime, maxTime) {
        if (['location', 'electricity_grid_hourly', 'electricity_solar_hourly', 'gas_daily', 'steps', 'weight', 'height', 'body_temperature', 'sleep', 'blood_pressure', 'water_daily', 'nutrition_daily', 'nutrition_servings'].includes(table)) {
            return dbService.query(`SELECT id, timestamp FROM "${table}" WHERE timestamp >= ? AND timestamp <= ?`, [minTime, maxTime]);
        }
        return [];
    }

    static async findExisting(table, data) {
        if (['location', 'electricity_grid_hourly', 'electricity_solar_hourly', 'gas_daily', 'steps', 'weight', 'height', 'body_temperature', 'sleep', 'blood_pressure', 'water_daily', 'nutrition_daily', 'nutrition_servings'].includes(table)) {
            // Unique key: timestamp
            const result = dbService.query(`SELECT id FROM "${table}" WHERE timestamp = ?`, [data.timestamp]);
            return result.length > 0 ? result[0].id : null;
        } else if (table === 'transactions') {
            // Unique composite: timestamp, description, amount
            const result = dbService.query(
                'SELECT id FROM transactions WHERE timestamp = ? AND description = ? AND amount = ?',
                [data.timestamp, data.description, data.amount]
            );
            return result.length > 0 ? result[0].id : null;
        }
        return null;
    }

    static async update(table, id, data) {
        // Construct dynamic update query
        // Only update fields that are present and not null
        const keys = Object.keys(data).filter(k => k !== 'timestamp' && k !== 'id' && data[k] !== null && data[k] !== undefined);

        if (keys.length === 0) return;

        const setClause = keys.map(k => `${k} = ?`).join(', ');
        const values = keys.map(k => data[k]);
        values.push(id);

        const sql = `UPDATE "${table}" SET ${setClause} WHERE id = ?`;
        dbService.query(sql, values);
    }

    static async insert(table, data) {
        if (table === 'electricity_grid_hourly') {
            dbService.query(
                'INSERT INTO electricity_grid_hourly (timestamp, import_kwh) VALUES (?, ?)',
                [data.timestamp, data.import_kwh || 0]
            );
        } else if (table === 'electricity_solar_hourly') {
            dbService.query(
                'INSERT INTO electricity_solar_hourly (timestamp, solar_kwh, consumption_kwh) VALUES (?, ?, ?)',
                [data.timestamp, data.solar_kwh || 0, data.consumption_kwh || 0]
            );
        } else if (table === 'gas_daily') {
            dbService.query(
                'INSERT INTO gas_daily (timestamp, usage_therms) VALUES (?, ?)',
                [data.timestamp, data.usage_therms || 0]
            );
        } else if (table === 'transactions') {
            dbService.query(
                'INSERT INTO transactions (timestamp, description, amount, account_id) VALUES (?, ?, ?, ?)',
                [data.timestamp, data.description, data.amount, data.account_id]
            );
        } else if (table === 'steps') {
            dbService.query(
                'INSERT INTO steps (timestamp, count, type, distance, calories) VALUES (?, ?, ?, ?, ?)',
                [data.timestamp, data.count, data.type, data.distance, data.calories]
            );
        } else if (table === 'weight') {
            dbService.query(
                'INSERT INTO weight (timestamp, weight_kg) VALUES (?, ?)',
                [data.timestamp, data.weight_kg]
            );
        } else if (table === 'height') {
            dbService.query(
                'INSERT INTO height (timestamp, height_m) VALUES (?, ?)',
                [data.timestamp, data.height_m]
            );
        } else if (table === 'body_temperature') {
            dbService.query(
                'INSERT INTO body_temperature (timestamp, temperature_c) VALUES (?, ?)',
                [data.timestamp, data.temperature_c]
            );
        } else if (table === 'sleep') {
            dbService.query(
                'INSERT INTO sleep (timestamp, duration_hours, light_seconds, deep_seconds, rem_seconds, awake_seconds) VALUES (?, ?, ?, ?, ?, ?)',
                [data.timestamp, data.duration_hours, data.light_seconds, data.deep_seconds, data.rem_seconds, data.awake_seconds]
            );
        } else if (table === 'blood_pressure') {
            dbService.query(
                'INSERT INTO blood_pressure (timestamp, systolic_mmhg, diastolic_mmhg, heart_rate_bpm) VALUES (?, ?, ?, ?)',
                [data.timestamp, data.systolic_mmhg, data.diastolic_mmhg, data.heart_rate_bpm]
            );
        } else if (table === 'location') {
            dbService.query(
                'INSERT INTO location (timestamp, lat, lng) VALUES (?, ?, ?)',
                [data.timestamp, data.lat, data.lng]
            );
        } else if (table === 'water_daily') {
            dbService.query(
                'INSERT INTO water_daily (timestamp, usage_liters) VALUES (?, ?)',
                [data.timestamp, data.usage_liters]
            );
        } else if (table === 'nutrition_daily') {
            const keys = Object.keys(data).filter(k => k !== 'timestamp');
            const columns = ['timestamp', ...keys];
            const placeholders = columns.map(() => '?').join(', ');
            const values = [data.timestamp, ...keys.map(k => data[k])];

            dbService.query(
                `INSERT INTO nutrition_daily (${columns.join(', ')}) VALUES (${placeholders})`,
                values
            );
        } else if (table === 'nutrition_servings') {
            const keys = Object.keys(data).filter(k => k !== 'timestamp');
            const columns = ['timestamp', ...keys];
            const placeholders = columns.map(() => '?').join(', ');
            const values = [data.timestamp, ...keys.map(k => data[k])];

            dbService.query(
                `INSERT INTO nutrition_servings (${columns.join(', ')}) VALUES (${placeholders})`,
                values
            );
        }
    }
}

