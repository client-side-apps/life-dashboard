import { CSVParser } from '../utils/csv-parser.js';
import { dbService } from '../db.js';
import { PgeImporter } from '../importers/energy/pge.js';
import { TeslaImporter } from '../importers/energy/tesla.js';
import { SfcuImporter } from '../importers/finance/sfcu.js';

export class DataImporter {

    static importers = [PgeImporter, TeslaImporter, SfcuImporter];

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
        if (table === 'electricity') {
            // Unique key: time
            const result = dbService.query('SELECT id FROM electricity WHERE time = ?', [data.time]);
            return result.length > 0 ? result[0].id : null;
        } else if (table === 'gas') {
            const result = dbService.query('SELECT id FROM gas WHERE time = ?', [data.time]);
            return result.length > 0 ? result[0].id : null;
        } else if (table === 'transactions') {
            // Unique composite: date, description, amount
            const result = dbService.query(
                'SELECT id FROM transactions WHERE date = ? AND description = ? AND amount = ?',
                [data.date, data.description, data.amount]
            );
            return result.length > 0 ? result[0].id : null;
        }
        return null;
    }

    static async update(table, id, data) {
        // Construct dynamic update query
        // Only update fields that are present and not null
        const keys = Object.keys(data).filter(k => k !== 'time' && k !== 'id' && data[k] !== null && data[k] !== undefined);

        if (keys.length === 0) return;

        const setClause = keys.map(k => `${k} = ?`).join(', ');
        const values = keys.map(k => data[k]);
        values.push(id);

        const sql = `UPDATE "${table}" SET ${setClause} WHERE id = ?`;
        dbService.query(sql, values);
    }

    static async insert(table, data) {
        if (table === 'electricity') {
            // Handle nulls
            const solar = data.solar !== null ? data.solar : 0;
            const consumption = data.consumption !== null ? data.consumption : 0;
            const imp = data.import !== null ? data.import : 0;

            dbService.query(
                'INSERT INTO electricity (time, solar, consumption, import) VALUES (?, ?, ?, ?)',
                [data.time, solar, consumption, imp]
            );
        } else if (table === 'gas') {
            dbService.query(
                'INSERT INTO gas (time, import) VALUES (?, ?)',
                [data.time, data.import]
            );
        } else if (table === 'transactions') {
            dbService.query(
                'INSERT INTO transactions (date, description, amount, account_id) VALUES (?, ?, ?, ?)',
                [data.date, data.description, data.amount, data.account_id]
            );
        }
    }
}
