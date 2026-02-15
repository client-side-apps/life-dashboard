import { BaseImporter } from '../base-importer.js';

export class FlumeImporter extends BaseImporter {
    static get source() {
        return 'flume';
    }
    /**
     * @param {Array<Object>} rows
     * @returns {boolean}
     */
    static detect(rows) {
        if (!rows || !Array.isArray(rows) || rows.length === 0) return false;
        const keys = Object.keys(rows[0]);
        // Flume export CSV has 'datetime' and 'liters' columns
        return keys.includes('datetime') && keys.includes('liters');
    }

    /**
     * @param {Object} row
     * @returns {Object|null}
     */
    static mapRow(row) {
        if (!row.datetime || row.liters === undefined || row.liters === null) return null;

        const timestamp = new Date(row.datetime).getTime();
        const usageLiters = parseFloat(row.liters);

        if (isNaN(timestamp) || isNaN(usageLiters)) return null;

        return {
            table: 'water_daily',
            data: {
                timestamp,
                usage_liters: usageLiters
            }
        };
    }

    static getTable() {
        return 'water_daily';
    }
}
