import { CSVParser } from '../utils/csv-parser.js';
import { dbService } from '../db.js';
import { PgeImporter } from '../importers/energy/pge.js';
import { TeslaImporter } from '../importers/energy/tesla.js';
import { SfcuImporter } from '../importers/finance/sfcu.js';
import { WithingsImporter } from '../importers/health/withings.js';
import { GoogleTimelineImporter } from '../importers/location/google-timeline.js';

export class DataImporter {

    static importers = [PgeImporter, TeslaImporter, SfcuImporter, WithingsImporter, GoogleTimelineImporter];

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

        // For JSON importers, mapRow might actually handle the whole object or we iterate provided array
        // But to keep it consistent, let's assume if it's JSON the importer can return an iterable or we pass the whole thing
        // Actually, existing design iterates 'rows'. 
        // Let's adapt: if json, we might need a different strategy or the importer wraps it.
        // EASIEST: if isJson, we treat jsonData as the "rows" source if it's an array, 
        // or we wrap it in an array if it's a single object, OR we let the importer handle it differently?
        // Better: Let's defer to the importer to extraction "items" from the raw data if needed.
        // But `detect` already ran. 
        // Let's normalize:
        const itemsToProcess = isJson ? (ImporterClass.extractItems ? ImporterClass.extractItems(jsonData) : (Array.isArray(jsonData) ? jsonData : [jsonData])) : rows;

        dbService.query('BEGIN TRANSACTION');

        for (const row of itemsToProcess) {
            try {
                const mapped = ImporterClass.mapRow(row);
                if (!mapped) continue;

                // Handle both legacy (just data) and new (table + data) formats
                let table = defaultTable;
                let data = mapped;

                if (mapped.table && mapped.data) {
                    table = mapped.table;
                    data = mapped.data;
                }

                if (!table) continue;

                // Check duplicate / existing
                const existingId = await this.findExisting(table, data);
                if (existingId) {
                    await this.update(table, existingId, data);
                    // Consider it success if we updated it? Or separate count?
                    // For now count as success
                    successCount++;
                } else {
                    await this.insert(table, data);
                    successCount++;
                }

            } catch (err) {
                console.warn("Row error", err);
                errorCount++;
            }
        }

        dbService.query('COMMIT');

        return {
            success: successCount,
            skipped: skippedCount,
            errors: errorCount,
            message: `Type: ${ImporterClass.name}. Processed: ${successCount}. Errors: ${errorCount}`
        };
    }

    static async findExisting(table, data) {
        if (['location', 'electricity_grid_hourly', 'electricity_solar_hourly', 'gas_daily', 'steps', 'weight', 'height', 'body_temperature', 'sleep', 'blood_pressure'].includes(table)) {
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
        }
    }
}

