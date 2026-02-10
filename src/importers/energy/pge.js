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
            let cost = 0;
            if (row['COST']) {
                cost = parseFloat(row['COST'].replace('$', '')) || 0;
            }
            return {
                table: 'electricity_grid_hourly',
                data: {
                    timestamp: isoTime,
                    import_kwh: parseFloat(row['IMPORT (kWh)']) || 0,
                    cost: cost
                }
            };
        } else if (type === 'Natural gas usage') {
            const dateStr = row['Date'] || row['DATE'];
            const timeStr = row['Start time'] || row['START TIME'];
            if (!dateStr || !timeStr) return null;

            const isoTime = new Date(`${dateStr} ${timeStr}`).getTime();
            const usage = parseFloat(row['Usage']) || parseFloat(row['USAGE (therms)']) || 0;
            let cost = 0;
            if (row['Cost'] || row['COST']) {
                cost = parseFloat((row['Cost'] || row['COST']).replace('$', '')) || 0;
            }
            return {
                table: 'gas_daily',
                data: {
                    timestamp: isoTime,
                    usage_therms: usage,
                    cost: cost
                }
            };
        }
        return null;
    }

    static getTable() {
        return null; // Dynamic
    }

    static postProcess(itemsByTable) {
        if (!itemsByTable['electricity_grid_hourly']) return itemsByTable;

        const dailyMap = new Map();
        for (const item of itemsByTable['electricity_grid_hourly']) {
            const day = new Date(item.timestamp);
            day.setHours(0, 0, 0, 0);
            const dayTimestamp = day.getTime();

            if (!dailyMap.has(dayTimestamp)) {
                dailyMap.set(dayTimestamp, { usage: 0, cost: 0 });
            }
            const current = dailyMap.get(dayTimestamp);
            current.usage += (item.import_kwh || 0);
            current.cost += (item.cost || 0);
        }

        if (dailyMap.size > 0) {
            if (!itemsByTable['electricity_grid_daily']) {
                itemsByTable['electricity_grid_daily'] = [];
            }
            for (const [timestamp, data] of dailyMap.entries()) {
                itemsByTable['electricity_grid_daily'].push({
                    timestamp: timestamp,
                    import_kwh: data.usage,
                    cost: data.cost
                });
            }
        }

        return itemsByTable;
    }
}
