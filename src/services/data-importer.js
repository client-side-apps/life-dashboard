import { CSVParser } from '../utils/csv-parser.js';
import { dbService } from '../db.js';
import { PgeImporter } from '../importers/energy/pge.js';
import { TeslaImporter } from '../importers/energy/tesla.js';
import { SfcuImporter } from '../importers/finance/sfcu.js';
import { WithingsImporter } from '../importers/health/withings.js';

export class DataImporter {

    static importers = [PgeImporter, TeslaImporter, SfcuImporter, WithingsImporter];

    static async import(filename, content, options = {}) {
        await dbService.ensureInitialized();

        let rows;
        try {
            // Pre-process for PGE preamble if needed, 
            // but let's try to keep it cleaner. 
            // If we split by lines we can check header match manually before parsing?
            // Or we just try parsing.

            // Special handling for PGE preamble which confuses the generic parser header detection
            if (content.indexOf('TYPE,DATE,START TIME') > 0) {
                const pgeHeaderIndex = content.indexOf('TYPE,DATE,START TIME');
                content = content.substring(pgeHeaderIndex);
            }

            rows = CSVParser.parse(content);
        } catch (e) {
            return { success: 0, skipped: 0, errors: 0, message: "Failed to parse CSV: " + e.message };
        }

        if (!rows || rows.length === 0) {
            return { success: 0, skipped: 0, errors: 0, message: "File is empty or could not be parsed." };
        }

        // Detect Importer
        let ImporterClass = null;

        if (options.provider) {
            if (options.provider === 'pge') ImporterClass = PgeImporter;
            else if (options.provider === 'tesla') ImporterClass = TeslaImporter;
            else if (options.provider === 'sfcu') ImporterClass = SfcuImporter;
        } else {
            ImporterClass = this.importers.find(i => i.detect(rows));
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

        for (const row of rows) {
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

        return {
            success: successCount,
            skipped: skippedCount,
            errors: errorCount,
            message: `Type: ${ImporterClass.name}. Processed: ${successCount}. Errors: ${errorCount}`
        };
    }

    static async findExisting(table, data) {
        if (['electricity_grid_hourly', 'electricity_solar_hourly', 'gas_daily', 'steps', 'weight', 'height', 'body_temperature', 'sleep', 'blood_pressure'].includes(table)) {
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
                'INSERT INTO steps (timestamp, count) VALUES (?, ?)',
                [data.timestamp, data.count]
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
                'INSERT INTO sleep (timestamp, duration_hours) VALUES (?, ?)',
                [data.timestamp, data.duration_hours]
            );
        } else if (table === 'blood_pressure') {
            dbService.query(
                'INSERT INTO blood_pressure (timestamp, systolic_mmhg, diastolic_mmhg, heart_rate_bpm) VALUES (?, ?, ?, ?)',
                [data.timestamp, data.systolic_mmhg, data.diastolic_mmhg, data.heart_rate_bpm]
            );
        }
    }
}

