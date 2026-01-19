import { BaseImporter } from '../base-importer.js';

export class TeslaImporter extends BaseImporter {
    static detect(rows) {
        if (!rows || rows.length === 0) return false;
        const keys = Object.keys(rows[0]);
        return keys.some(k => k.includes('Solar Energy'));
    }

    static mapRow(row) {
        const timeStr = row['Date time'];
        if (!timeStr) return null;

        const isoTime = new Date(timeStr).toISOString();

        return {
            table: 'electricity',
            data: {
                time: isoTime,
                solar: parseFloat(row['Solar Energy (kWh)']) || 0,
                consumption: parseFloat(row['Home (kWh)']) || 0,
                import: parseFloat(row['From Grid (kWh)']) || 0
            }
        };
    }

    static getTable() {
        return 'electricity';
    }
}
