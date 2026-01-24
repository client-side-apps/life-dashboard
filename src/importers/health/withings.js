import { BaseImporter } from '../base-importer.js';

export class WithingsImporter extends BaseImporter {
    static detect(rows) {
        if (!rows || rows.length === 0) return false;
        const first = rows[0];

        // Check for specific columns present in various Withings exports
        const isActivity = 'Activity type' in first && 'Data' in first; // activities.csv
        const isBP = 'Systolic' in first && 'Diastolic' in first; // bp.csv
        const isHeight = 'Height (m)' in first; // height.csv
        const isWeight = 'Weight (kg)' in first; // weight.csv
        const isSleep = 'light (s)' in first && 'deep (s)' in first; // sleep.csv
        const isTemp = 'value (°C)' in first; // body_temperature.csv

        return isActivity || isBP || isHeight || isWeight || isSleep || isTemp;
    }

    static getTable() {
        return null; // Dynamic table based on row content
    }

    static mapRow(row) {
        // 1. Activities (Steps)
        if ('Activity type' in row && 'Data' in row) {
            try {
                const data = JSON.parse(row.Data);
                const steps = data.steps || 0;

                // Only import if there are steps
                if (steps > 0) {
                    return {
                        table: 'steps',
                        data: {
                            timestamp: new Date(row.from).getTime(),
                            count: parseInt(steps, 10)
                        }
                    };
                }
            } catch (e) {
                console.warn('Failed to parse activity data JSON', e);
            }
            return null;
        }

        // 2. Blood Pressure
        if ('Systolic' in row && 'Diastolic' in row && row.Systolic && row.Diastolic) {
            return {
                table: 'blood_pressure',
                data: {
                    timestamp: new Date(row.Date).getTime(),
                    systolic_mmhg: parseInt(row.Systolic, 10),
                    diastolic_mmhg: parseInt(row.Diastolic, 10),
                    heart_rate_bpm: row['Heart rate'] ? parseInt(row['Heart rate'], 10) : null
                }
            };
        }

        // 3. Height
        if ('Height (m)' in row && row['Height (m)']) {
            return {
                table: 'height',
                data: {
                    timestamp: new Date(row.Date).getTime(),
                    height_m: parseFloat(row['Height (m)'])
                }
            };
        }

        // 4. Weight
        if ('Weight (kg)' in row && row['Weight (kg)']) {
            return {
                table: 'weight',
                data: {
                    timestamp: new Date(row.Date).getTime(),
                    weight_kg: parseFloat(row['Weight (kg)'])
                }
            };
        }

        // 5. Sleep
        if ('light (s)' in row && 'deep (s)' in row) {
            // Calculate total sleep in hours
            const light = parseInt(row['light (s)'] || 0, 10);
            const deep = parseInt(row['deep (s)'] || 0, 10);
            const rem = parseInt(row['rem (s)'] || 0, 10);
            const totalSeconds = light + deep + rem;

            if (totalSeconds > 0) {
                return {
                    table: 'sleep',
                    data: {
                        timestamp: new Date(row.to).getTime(), // Using 'to' as the date of waking up/recording for the day
                        duration_hours: parseFloat((totalSeconds / 3600).toFixed(2)) // Hours
                    }
                };
            }
            return null;
        }

        // 6. Body Temperature
        if ('value (°C)' in row && row['value (°C)']) {
            return {
                table: 'body_temperature',
                data: {
                    timestamp: new Date(row.date).getTime(), // Note: lowercase 'date' in temp csv
                    temperature_c: parseFloat(row['value (°C)'])
                }
            };
        }

        return null;
    }
}
