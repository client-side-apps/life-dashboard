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
            const costStr = (row['COST'] || '').replace('$', '');
            return {
                table: 'electricity_hourly',
                data: {
                    timestamp: isoTime,
                    grid_import_kwh: parseFloat(row['IMPORT (kWh)']) || 0,
                    grid_export_kwh: parseFloat(row['EXPORT (kWh)']) || 0,
                    cost: parseFloat(costStr) || 0
                }
            };
        } else if (type === 'Natural gas usage') {
            const dateStr = row['Date'] || row['DATE'];
            const timeStr = row['Start time'] || row['START TIME'];
            if (!dateStr || !timeStr) return null;

            const isoTime = new Date(`${dateStr} ${timeStr}`).getTime();
            const usage = parseFloat(row['Usage']) || parseFloat(row['USAGE (therms)']) || 0;
            const costStr = (row['Cost'] || row['COST'] || '').replace('$', '');
            return {
                table: 'gas_daily',
                data: {
                    timestamp: isoTime,
                    usage_therms: usage,
                    cost: parseFloat(costStr) || 0
                }
            };
        }
        return null;
    }

    static getTable() {
        return null; // Dynamic
    }

    static postProcess(itemsByTable) {
        if (!itemsByTable['electricity_hourly']) return itemsByTable;

        const dailyMap = new Map();
        for (const item of itemsByTable['electricity_hourly']) {
            const day = new Date(item.timestamp);
            day.setHours(0, 0, 0, 0);
            const dayTimestamp = day.getTime();

            if (!dailyMap.has(dayTimestamp)) {
                dailyMap.set(dayTimestamp, { import: 0, cost: 0 });
            }
            const current = dailyMap.get(dayTimestamp);
            current.import += (item.grid_import_kwh || 0);
            current.cost += (item.cost || 0);
        }

        if (dailyMap.size > 0) {
            if (!itemsByTable['electricity_grid_daily']) {
                itemsByTable['electricity_grid_daily'] = [];
            }
            for (const [timestamp, totals] of dailyMap.entries()) {
                itemsByTable['electricity_grid_daily'].push({
                    timestamp: timestamp,
                    import_kwh: totals.import,
                    cost: totals.cost
                });
            }
        }

        return itemsByTable;
    }
}
