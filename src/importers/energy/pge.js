import { BaseImporter } from '../base-importer.js';

export class PgeImporter extends BaseImporter {
    static detect(rows) {
        if (!rows || !Array.isArray(rows) || rows.length === 0) return false;
        const keys = Object.keys(rows[0]);
        // Check for 'Electric usage' in keys if header was messed up, or standard keys
        if (keys.includes('TYPE') && keys.includes('START TIME')) return true;
        // Fallback if header row was skipped or malformed but contained "Electric usage"
        if (keys.some(k => k === 'Electric usage')) return true;
        return false;
    }

    static mapRow(row) {
        const type = row['TYPE'] || row['Type']; // Handle case sensitivity if needed

        if (type === 'Electric usage') {
            const dateStr = row['DATE'];
            const timeStr = row['START TIME'];
            if (!dateStr || !timeStr) return null;

            const isoTime = new Date(`${dateStr} ${timeStr}`).getTime();
            return {
                table: 'electricity_grid_hourly',
                data: {
                    timestamp: isoTime,
                    import_kwh: parseFloat(row['IMPORT (kWh)']) || 0
                }
            };
        } else if (type === 'Natural gas usage') {
            const dateStr = row['Date'] || row['DATE'];
            const timeStr = row['Start time'] || row['START TIME'];
            if (!dateStr || !timeStr) return null;

            const isoTime = new Date(`${dateStr} ${timeStr}`).getTime();
            const usage = parseFloat(row['Usage']) || parseFloat(row['USAGE (therms)']) || 0;
            return {
                table: 'gas_daily',
                data: {
                    timestamp: isoTime,
                    usage_therms: usage
                }
            };
        }
        return null;
    }

    static getTable() {
        return null; // Dynamic
    }
}
