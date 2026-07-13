import { BaseImporter } from '../base-importer.js';

export class DiveLogImporter extends BaseImporter {
    static get source() {
        return 'divelog';
    }

    /**
     * @param {Array<Object>} rows
     * @returns {boolean}
     */
    static detect(rows) {
        if (!rows || !Array.isArray(rows) || rows.length === 0) return false;
        const keys = Object.keys(rows[0]);
        // Checks for key headers in the dive log export
        return keys.includes('Spot') && keys.includes('Depth (m)') && keys.includes('Time (min)');
    }

    /**
     * @param {Object} row
     * @returns {Object|null}
     */
    static mapRow(row) {
        if (!row.Date) return null;

        // Date format: DD/MM/YYYY
        const parts = row.Date.split('/');
        if (parts.length !== 3) return null;
        
        const day = parseInt(parts[0], 10);
        const month = parseInt(parts[1], 10) - 1;
        const year = parseInt(parts[2], 10);
        
        const timestamp = new Date(year, month, day).getTime();
        if (isNaN(timestamp)) return null;

        // Parse location fields separately
        const spot = row.Spot ? row.Spot.trim() : null;
        const city = row.City ? row.City.trim() : null;
        const region = row.Region ? row.Region.trim() : null;
        const country = row.Country ? row.Country.trim() : null;

        // Parse numeric values (handling comma decimals)
        const depthStr = row['Depth (m)'] ? row['Depth (m)'].toString().replace(',', '.') : '';
        const maxDepth = parseFloat(depthStr);

        const durationStr = row['Time (min)'] ? row['Time (min)'].toString().replace(',', '.') : '';
        const duration = parseFloat(durationStr);

        const tempStr = (row['Température fond'] || row['Température surface'] || '').toString().replace(',', '.');
        const temp = tempStr ? parseFloat(tempStr) : null;

        const number = row.Number ? parseInt(row.Number, 10) : null;

        const totalDivers = row['# divers'] ? parseInt(row['# divers'], 10) : null;
        const diversList = row.Divers ? row.Divers.split('+').map(d => d.trim()).filter(Boolean) : [];
        const diversJson = JSON.stringify(diversList);

        return {
            table: 'dives',
            data: {
                timestamp,
                dive_number: isNaN(number) ? null : number,
                spot,
                city,
                region,
                country,
                max_depth_meters: isNaN(maxDepth) ? null : maxDepth,
                duration_minutes: isNaN(duration) ? null : duration,
                water_temp_c: (temp === null || isNaN(temp)) ? null : temp,
                dive_type: row.Type ? row.Type.trim() : null,
                center: row.Center ? row.Center.trim() : null,
                divers: diversJson,
                total_divers: isNaN(totalDivers) ? null : totalDivers,
                note: row.Observations ? row.Observations.trim() : null
            }
        };
    }

    static getTable() {
        return 'dives';
    }
}
