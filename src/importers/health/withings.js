import { BaseImporter } from '../base-importer.js';

export class WithingsImporter extends BaseImporter {
    static get source() {
        return 'withings';
    }
    static detect(rows) {
        if (!rows || !Array.isArray(rows) || rows.length === 0) return false;
        const first = rows[0];

        // Check for specific columns present in various Withings exports
        const isActivity = 'Activity type' in first && 'Data' in first; // activities.csv
        const isBP = 'Systolic' in first && 'Diastolic' in first; // bp.csv
        const isHeight = 'Height (m)' in first; // height.csv
        const isWeight = 'Weight (kg)' in first; // weight.csv
        const isSleep = 'light (s)' in first && 'deep (s)' in first; // sleep.csv
        const isTemp = 'value (°C)' in first; // body_temperature.csv
        const isSteps = 'date' in first && 'value' in first && !('Activity type' in first); // aggregates_steps.csv

        return isActivity || isBP || isHeight || isWeight || isSleep || isTemp || isSteps;
    }

    static getTable() {
        return null; // Dynamic table based on row content
    }

    static mapRow(row) {
        // console.log('Mapping Withings Row Keys:', Object.keys(row));
        // 1. Activities (Sessions)
        if ('Activity type' in row && 'Data' in row) {
            try {
                const data = JSON.parse(row.Data);
                const activityType = row['Activity type'];

                if (activityType && activityType !== 'Multi Sport') {
                    return {
                        table: 'activities',
                        data: {
                            timestamp: new Date(row.from).getTime(),
                            end_timestamp: new Date(row.to).getTime(),
                            type: activityType,
                            calories: parseFloat(data.calories || data.manual_calories || 0),
                            distance: parseFloat(data.distance || data.manual_distance || 0),
                            steps: parseInt(data.steps || 0, 10),
                            elevation: parseFloat(data.elevation || 0),
                            hr_average: parseInt(data.hr_average || 0, 10)
                        }
                    };
                }
            } catch (e) {
                console.warn('Failed to parse activity data JSON', e);
            }
            return null;
        }

        // 2. Steps (Aggregates)
        if ('date' in row && 'value' in row && !('Activity type' in row)) {
            return {
                table: 'steps',
                data: {
                    timestamp: new Date(row.date).getTime(),
                    count: parseInt(row.value, 10),
                    type: 'Daily Aggregate'
                }
            };
        }

        // 2. Blood Pressure (also covers heart-rate-only measurements,
        // which the export stores in the same file with empty Systolic/Diastolic)
        if ('Systolic' in row && 'Diastolic' in row && (row.Systolic || row.Diastolic || row['Heart rate'])) {
            return {
                table: 'heart',
                data: {
                    timestamp: new Date(row.Date).getTime(),
                    systolic_mmhg: row.Systolic ? parseInt(row.Systolic, 10) : null,
                    diastolic_mmhg: row.Diastolic ? parseInt(row.Diastolic, 10) : null,
                    heart_rate_bpm: row['Heart rate'] ? parseInt(row['Heart rate'], 10) : null,
                    note: row.Comments ? row.Comments.trim() : null
                }
            };
        }

        // 3. Height
        if ('Height (m)' in row && row['Height (m)']) {
            return {
                table: 'height',
                data: {
                    timestamp: new Date(row.Date).getTime(),
                    height_m: parseFloat(row['Height (m)']),
                    note: row.Comments ? row.Comments.trim() : null
                }
            };
        }

        if ('Weight (kg)' in row && row['Weight (kg)']) {
            return {
                table: 'weight',
                data: {
                    timestamp: new Date(row.Date).getTime(),
                    weight_kg: parseFloat(row['Weight (kg)']),
                    fat_mass_kg: parseFloat(row['Fat mass (kg)'] || 0),
                    bone_mass_kg: parseFloat(row['Bone mass (kg)'] || 0),
                    muscle_mass_kg: parseFloat(row['Muscle mass (kg)'] || 0),
                    hydration_kg: parseFloat(row['Hydration (kg)'] || 0),
                    note: row.Comments ? row.Comments.trim() : null
                }
            };
        }

        // 5. Sleep
        if ('light (s)' in row && 'deep (s)' in row) {
            // Calculate total sleep in hours
            const light = parseInt(row['light (s)'] || 0, 10);
            const deep = parseInt(row['deep (s)'] || 0, 10);
            const rem = parseInt(row['rem (s)'] || 0, 10);
            const awake = parseInt(row['awake (s)'] || 0, 10);
            let totalSeconds = light + deep + rem;

            // Manually logged sleep has no stage breakdown (all zeros) but is
            // still a real night of sleep: fall back to the from/to interval.
            if (totalSeconds === 0 && row.from && row.to) {
                const intervalSeconds = (new Date(row.to).getTime() - new Date(row.from).getTime()) / 1000;
                if (intervalSeconds > 0) {
                    totalSeconds = Math.round(intervalSeconds) - awake;
                }
            }

            if (totalSeconds > 0) {
                return {
                    table: 'sleep',
                    data: {
                        timestamp: new Date(row.to).getTime(), // Using 'to' as the date of waking up/recording for the day
                        start_timestamp: new Date(row.from).getTime(),
                        duration_hours: parseFloat((totalSeconds / 3600).toFixed(2)), // Hours
                        light_seconds: light,
                        deep_seconds: deep,
                        rem_seconds: rem,
                        awake_seconds: awake,
                        wake_up_seconds: parseInt(row['wake up (s)'] || 0, 10),
                        duration_to_sleep_seconds: parseInt(row['duration to sleep (s)'] || 0, 10),
                        duration_to_wake_up_seconds: parseInt(row['duration to wake up (s)'] || 0, 10),
                        snoring_seconds: parseInt(row['snoring (s)'] || 0, 10),
                        snoring_episodes: parseInt(row['snoring episodes'] || 0, 10),
                        average_heart_rate: parseInt(row['average heart rate'], 10) || null,
                        heart_rate_min: parseInt(row['heart rate (min)'], 10) || null,
                        heart_rate_max: parseInt(row['heart rate (max)'], 10) || null
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
