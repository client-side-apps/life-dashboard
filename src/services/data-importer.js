import { CSVParser } from '../utils/csv-parser.js';
import { dbService } from '../db.js';
import { PgeImporter } from '../importers/energy/pge.js';
import { TeslaImporter } from '../importers/energy/tesla.js';
import { SfcuImporter } from '../importers/finance/sfcu.js';
import { WithingsImporter } from '../importers/health/withings.js';
import { CronometerImporter } from '../importers/health/cronometer.js';
import { GoogleTimelineImporter } from '../importers/location/google-timeline.js';
import { FlumeImporter } from '../importers/water/flume.js';
import { SpotifyImporter } from '../importers/music/spotify.js';
import { DiveLogImporter } from '../importers/health/dive-logs.js';

export class DataImporter {

    static importers = [PgeImporter, TeslaImporter, SfcuImporter, WithingsImporter, CronometerImporter, GoogleTimelineImporter, FlumeImporter, SpotifyImporter, DiveLogImporter];

    static async import(filename, content, options = {}) {
        await dbService.ensureInitialized();

        let rows;
        let jsonData;
        const isJson = filename.toLowerCase().endsWith('.json');

        try {
            if (isJson) {
                jsonData = JSON.parse(content);
            } else {
                // Special handling for PGE preamble which confuses the generic parser header detection
                if (content.indexOf('TYPE,DATE,START TIME') > 0) {
                    const pgeHeaderIndex = content.indexOf('TYPE,DATE,START TIME');
                    content = content.substring(pgeHeaderIndex);
                }
                rows = CSVParser.parse(content);
            }
        } catch (e) {
            return { success: 0, skipped: 0, errors: 0, message: "Failed to parse file: " + e.message };
        }

        if ((!isJson && (!rows || rows.length === 0)) || (isJson && !jsonData)) {
            return { success: 0, skipped: 0, errors: 0, message: "File is empty or could not be parsed." };
        }

        // Detect Importer
        let ImporterClass = null;

        if (options.provider) {
            if (options.provider === 'pge') ImporterClass = PgeImporter;
            else if (options.provider === 'tesla') ImporterClass = TeslaImporter;
            else if (options.provider === 'sfcu') ImporterClass = SfcuImporter;
            else if (options.provider === 'google_timeline') ImporterClass = GoogleTimelineImporter;
            else if (options.provider === 'divelog') ImporterClass = DiveLogImporter;
        } else {
            ImporterClass = this.importers.find(i => isJson ? i.detect(jsonData) : i.detect(rows));
        }

        if (!ImporterClass) {
            return { success: 0, skipped: 0, errors: 0, message: "Unknown file format." };
        }

        console.log(`Detected format: ${ImporterClass.name}`);
        // Importer might return a fixed table or null if dynamic
        const defaultTable = ImporterClass.getTable();
        const source = options.provider || ImporterClass.source || null;

        let successCount = 0;
        let skippedCount = 0;
        let errorCount = 0;

        const itemsToProcess = isJson ? (ImporterClass.extractItems ? ImporterClass.extractItems(jsonData) : (Array.isArray(jsonData) ? jsonData : [jsonData])) : rows;

        // Pre-processing: Map all items to their target tables and data
        const processedItems = [];
        for (const row of itemsToProcess) {
            try {
                const mapped = ImporterClass.mapRow(row);
                if (!mapped) continue;

                let table = defaultTable;
                let data = mapped;

                if (mapped.table && mapped.data) {
                    table = mapped.table;
                    data = mapped.data;
                }

                if (data && typeof data === 'object' && source) {
                    data.source = source;
                }

                if (options.demo) {
                    applyDemoNotes(table, data);
                }

                if (table) {
                    processedItems.push({ table, data });
                }
            } catch (err) {
                console.warn("Row mapping error", err);
                errorCount++;
            }
        }

        if (processedItems.length === 0) {
            return { success: 0, skipped: 0, errors: errorCount, message: `Type: ${ImporterClass.name}. No valid items found.` };
        }

        // Optimization: Batch existence check
        // Group by table to minimize context switching? 
        // Actually, we just need to know which ones exist.
        // Let's do it per table.
        let itemsByTable = {};
        for (const item of processedItems) {
            if (!itemsByTable[item.table]) itemsByTable[item.table] = [];
            itemsByTable[item.table].push(item.data);
        }

        // Post-process hook (e.g. aggregation)
        if (ImporterClass.postProcess) {
            itemsByTable = ImporterClass.postProcess(itemsByTable);
        }

        // Items created by postProcess (e.g. daily aggregates) don't go through
        // the mapping loop above, so stamp their source here. An undefined
        // source cannot be bound as a SQL parameter and would make every
        // insert of these rows fail silently.
        for (const items of Object.values(itemsByTable)) {
            for (const item of items) {
                if (item && typeof item === 'object' && item.source === undefined) {
                    item.source = source;
                }
            }
        }



        dbService.query('BEGIN TRANSACTION');

        // Tables where the timestamp alone is not a unique key: several rows can
        // legitimately share a timestamp (e.g. two identical purchases the same
        // day, two foods logged at the same time). For these, match existing
        // records by a composite key and consume matches one-by-one, so that
        // genuine duplicates are preserved rather than collapsed into one row.
        const complexKeyTables = ['transactions', 'dives', 'nutrition_servings', 'music'];
        const matchTracker = new Map(); // Map<compositeKey, {ids: number[], next: number}>

        try {
            for (const [table, items] of Object.entries(itemsByTable)) {
                // Get range of timestamps for this batch
                const timestamps = items.map(i => i.timestamp).filter(t => t);

                if (timestamps.length === 0) continue; // Should not happen if mapRow works

                const minTime = timestamps.reduce((min, t) => t < min ? t : min, Infinity);
                const maxTime = timestamps.reduce((max, t) => t > max ? t : max, -Infinity);

                // Fetch existing records in this range
                // This optimization targets the simple time-series tables where
                // timestamp is the unique key.

                const existingMap = new Map(); // Map<timestamp, id>

                if (!complexKeyTables.includes(table)) {
                    const existingRecords = await this.findExistingBatch(table, minTime, maxTime);
                    existingRecords.forEach(r => existingMap.set(r.timestamp, r.id));
                }

                // Now process inserts/updates
                for (const data of items) {
                    try {
                        let existingId = null;

                        if (complexKeyTables.includes(table)) {
                            const key = `${table}|${this.buildKey(table, data)}`;
                            let tracker = matchTracker.get(key);
                            if (!tracker) {
                                tracker = { ids: await this.findExistingAll(table, data), next: 0 };
                                matchTracker.set(key, tracker);
                            }
                            // Each occurrence in the file consumes one existing
                            // record; extra occurrences are inserted as new rows.
                            if (tracker.next < tracker.ids.length) {
                                existingId = tracker.ids[tracker.next++];
                            }
                        } else {
                            existingId = existingMap.get(data.timestamp);
                        }

                        if (existingId) {
                            await this.update(table, existingId, data);
                            successCount++;
                        } else {
                            await this.insert(table, data);
                            successCount++;
                        }
                    } catch (err) {
                        console.warn("Row import error", err);
                        errorCount++;
                    }
                }
            }

            dbService.query('COMMIT');
        } catch (e) {
            dbService.query('ROLLBACK');
            console.error("Import transaction failed", e);
            throw e;
        }

        return {
            success: successCount,
            skipped: skippedCount,
            errors: errorCount,
            message: `Type: ${ImporterClass.name}. Processed: ${successCount}. Errors: ${errorCount}`
        };
    }

    static async findExistingBatch(table, minTime, maxTime) {
        if (['location', 'electricity_hourly', 'electricity_grid_daily', 'gas_daily', 'steps', 'weight', 'height', 'body_temperature', 'sleep', 'heart', 'water_daily', 'nutrition_daily', 'activities'].includes(table)) {
            return dbService.query(`SELECT id, timestamp FROM "${table}" WHERE timestamp >= ? AND timestamp <= ?`, [minTime, maxTime]);
        }
        return [];
    }

    /**
     * Composite key identifying "the same record" within a complex-key table.
     * Rows sharing a key are matched positionally against existing records.
     */
    static buildKey(table, data) {
        if (table === 'transactions') {
            return `${data.timestamp}|${data.description}|${data.amount}`;
        } else if (table === 'nutrition_servings') {
            return `${data.timestamp}|${data.food_name ?? ''}`;
        } else if (table === 'music') {
            return `${data.timestamp}|${data.track_uri ?? ''}|${data.track_name ?? ''}`;
        } else if (table === 'dives') {
            return data.dive_number ? `n|${data.dive_number}` : `t|${data.timestamp}|${data.spot}`;
        }
        return `${data.timestamp}`;
    }

    /**
     * Return ALL existing record ids matching the composite key, oldest first,
     * so duplicates in the database can each be matched to a duplicate in the file.
     */
    static async findExistingAll(table, data) {
        let result = [];
        if (table === 'transactions') {
            result = dbService.query(
                'SELECT id FROM transactions WHERE timestamp = ? AND description = ? AND amount = ? ORDER BY id',
                [data.timestamp, data.description, data.amount]
            );
        } else if (table === 'nutrition_servings') {
            result = dbService.query(
                'SELECT id FROM nutrition_servings WHERE timestamp = ? AND food_name IS ? ORDER BY id',
                [data.timestamp, data.food_name ?? null]
            );
        } else if (table === 'music') {
            result = dbService.query(
                'SELECT id FROM music WHERE timestamp = ? AND track_uri IS ? AND track_name IS ? ORDER BY id',
                [data.timestamp, data.track_uri ?? null, data.track_name ?? null]
            );
        } else if (table === 'dives') {
            if (data.dive_number) {
                result = dbService.query('SELECT id FROM dives WHERE dive_number = ? ORDER BY id', [data.dive_number]);
            } else {
                result = dbService.query('SELECT id FROM dives WHERE timestamp = ? AND spot = ? ORDER BY id', [data.timestamp, data.spot]);
            }
        }
        return result.map(r => r.id);
    }

    static async findExisting(table, data) {
        if (['location', 'electricity_hourly', 'electricity_grid_daily', 'gas_daily', 'steps', 'weight', 'height', 'body_temperature', 'sleep', 'heart', 'water_daily', 'nutrition_daily', 'activities'].includes(table)) {
            // Unique key: timestamp
            const result = dbService.query(`SELECT id FROM "${table}" WHERE timestamp = ?`, [data.timestamp]);
            return result.length > 0 ? result[0].id : null;
        }
        const ids = await this.findExistingAll(table, data);
        return ids.length > 0 ? ids[0] : null;
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
        if (table === 'electricity_hourly') {
            dbService.query(
                'INSERT INTO electricity_hourly (timestamp, grid_import_kwh, grid_export_kwh, solar_kwh, home_consumption_kwh, vehicle_kwh, battery_kwh, cost, source, note) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
                [
                    data.timestamp,
                    data.grid_import_kwh || 0,
                    data.grid_export_kwh || 0,
                    data.solar_kwh || 0,
                    data.home_consumption_kwh || 0,
                    data.vehicle_kwh || 0,
                    data.battery_kwh || 0,
                    data.cost || 0,
                    data.source,
                    data.note || null
                ]
            );
        } else if (table === 'electricity_grid_daily') {
            dbService.query(
                'INSERT INTO electricity_grid_daily (timestamp, import_kwh, cost, source, note) VALUES (?, ?, ?, ?, ?)',
                [data.timestamp, data.import_kwh || 0, data.cost || 0, data.source, data.note || null]
            );
        } else if (table === 'gas_daily') {
            dbService.query(
                'INSERT INTO gas_daily (timestamp, usage_therms, cost, source, note) VALUES (?, ?, ?, ?, ?)',
                [data.timestamp, data.usage_therms || 0, data.cost || 0, data.source, data.note || null]
            );
        } else if (table === 'transactions') {
            dbService.query(
                'INSERT INTO transactions (timestamp, description, amount, account_id, source, note) VALUES (?, ?, ?, ?, ?, ?)',
                [data.timestamp, data.description, data.amount, data.account_id, data.source, data.note || null]
            );
        } else if (table === 'steps') {
            dbService.query(
                'INSERT INTO steps (timestamp, count, type, distance, calories, source, note) VALUES (?, ?, ?, ?, ?, ?, ?)',
                [data.timestamp, data.count, data.type, data.distance || null, data.calories || null, data.source, data.note || null]
            );
        } else if (table === 'weight') {
            dbService.query(
                'INSERT INTO weight (timestamp, weight_kg, fat_mass_kg, bone_mass_kg, muscle_mass_kg, hydration_kg, source, note) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
                [
                    data.timestamp,
                    data.weight_kg,
                    data.fat_mass_kg || null,
                    data.bone_mass_kg || null,
                    data.muscle_mass_kg || null,
                    data.hydration_kg || null,
                    data.source,
                    data.note || null
                ]
            );
        } else if (table === 'height') {
            dbService.query(
                'INSERT INTO height (timestamp, height_m, source, note) VALUES (?, ?, ?, ?)',
                [data.timestamp, data.height_m, data.source, data.note || null]
            );
        } else if (table === 'body_temperature') {
            dbService.query(
                'INSERT INTO body_temperature (timestamp, temperature_c, source, note) VALUES (?, ?, ?, ?)',
                [data.timestamp, data.temperature_c, data.source, data.note || null]
            );
        } else if (table === 'sleep') {
            dbService.query(
                'INSERT INTO sleep (timestamp, start_timestamp, duration_hours, light_seconds, deep_seconds, rem_seconds, awake_seconds, wake_up_seconds, duration_to_sleep_seconds, duration_to_wake_up_seconds, snoring_seconds, snoring_episodes, average_heart_rate, heart_rate_min, heart_rate_max, source, note) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
                [
                    data.timestamp,
                    data.start_timestamp || null,
                    data.duration_hours,
                    data.light_seconds || 0,
                    data.deep_seconds || 0,
                    data.rem_seconds || 0,
                    data.awake_seconds || 0,
                    data.wake_up_seconds || 0,
                    data.duration_to_sleep_seconds || 0,
                    data.duration_to_wake_up_seconds || 0,
                    data.snoring_seconds || 0,
                    data.snoring_episodes || 0,
                    data.average_heart_rate || null,
                    data.heart_rate_min || null,
                    data.heart_rate_max || null,
                    data.source,
                    data.note || null
                ]
            );
        } else if (table === 'heart') {
            dbService.query(
                'INSERT INTO heart (timestamp, systolic_mmhg, diastolic_mmhg, heart_rate_bpm, source, note) VALUES (?, ?, ?, ?, ?, ?)',
                [data.timestamp, data.systolic_mmhg ?? null, data.diastolic_mmhg ?? null, data.heart_rate_bpm || null, data.source, data.note || null]
            );
        } else if (table === 'location') {
            dbService.query(
                'INSERT INTO location (timestamp, lat, lng, source, note) VALUES (?, ?, ?, ?, ?)',
                [data.timestamp, data.lat, data.lng, data.source, data.note || null]
            );
        } else if (table === 'water_daily') {
            dbService.query(
                'INSERT INTO water_daily (timestamp, usage_liters, source, note) VALUES (?, ?, ?, ?)',
                [data.timestamp, data.usage_liters, data.source, data.note || null]
            );
        } else if (table === 'nutrition_daily') {
            const keys = Object.keys(data).filter(k => k !== 'timestamp' && k !== 'source');
            const columns = ['timestamp', ...keys, 'source'];
            const placeholders = columns.map(() => '?').join(', ');
            const values = [data.timestamp, ...keys.map(k => data[k]), data.source];

            dbService.query(
                `INSERT INTO nutrition_daily (${columns.join(', ')}) VALUES (${placeholders})`,
                values
            );
        } else if (table === 'nutrition_servings') {
            const keys = Object.keys(data).filter(k => k !== 'timestamp' && k !== 'source');
            const columns = ['timestamp', ...keys, 'source'];
            const placeholders = columns.map(() => '?').join(', ');
            const values = [data.timestamp, ...keys.map(k => data[k]), data.source];

            dbService.query(
                `INSERT INTO nutrition_servings (${columns.join(', ')}) VALUES (${placeholders})`,
                values
            );
        } else if (table === 'activities') {
            dbService.query(
                'INSERT INTO activities (timestamp, end_timestamp, type, calories, distance, steps, elevation, hr_average, source, note) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
                [
                    data.timestamp,
                    data.end_timestamp || null,
                    data.type,
                    data.calories || 0,
                    data.distance || 0,
                    data.steps || 0,
                    data.elevation || 0,
                    data.hr_average || null,
                    data.source,
                    data.note || null
                ]
            );
        } else if (table === 'music') {
            dbService.query(
                'INSERT INTO music (timestamp, track_name, artist_name, album_name, track_uri, duration_ms, platform, source, note) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
                [data.timestamp, data.track_name, data.artist_name, data.album_name, data.track_uri, data.duration_ms, data.platform || null, data.source, data.note || null]
            );
        } else if (table === 'dives') {
            dbService.query(
                'INSERT INTO dives (timestamp, dive_number, spot, city, region, country, max_depth_meters, duration_minutes, water_temp_c, dive_type, center, divers, total_divers, source, note) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
                [
                    data.timestamp,
                    data.dive_number,
                    data.spot,
                    data.city,
                    data.region,
                    data.country,
                    data.max_depth_meters,
                    data.duration_minutes,
                    data.water_temp_c,
                    data.dive_type,
                    data.center,
                    data.divers,
                    data.total_divers,
                    data.source,
                    data.note || null
                ]
            );
        }
    }
}

function applyDemoNotes(table, data) {
    if (!data || !data.timestamp) return;
    const date = new Date(data.timestamp);
    const day = date.getDate();
    const month = date.getMonth();
    const year = date.getFullYear();

    if (year === 2025) {
        if (table === 'weight' && day === 15) {
            data.note = "Weight up slightly. Had a salty dinner last night.";
        } else if (table === 'sleep' && day === 10) {
            data.note = "Hard to fall asleep. Drank coffee too late in the afternoon.";
        } else if (table === 'sleep' && day === 20) {
            data.note = "Slept incredibly well. Did a 5k run in the evening.";
        } else if (table === 'steps' && day === 5) {
            data.note = "Walked to work and took the stairs all day.";
        } else if (table === 'steps' && day === 22) {
            data.note = "Long hiking trip in the state park!";
        } else if (table === 'activities' && day === 12) {
            data.note = "New personal best speed today!";
        } else if (table === 'music' && day === 14 && month === 2) {
            data.note = "Listen while coding the new life dashboard features!";
        } else if (table === 'transactions' && data.amount < -100 && day === 1) {
            data.note = "Monthly rent payment.";
        } else if (table === 'transactions' && data.amount < -50 && day === 18) {
            data.note = "Weekly grocery run at Whole Foods.";
        } else if (table === 'location' && day === 20 && month === 5) {
            data.note = "Had a great lunch meeting here.";
        } else if (table === 'nutrition_servings' && data.food_name && data.food_name.toLowerCase().includes('coffee') && day === 7) {
            data.note = "Extra strong espresso shot today.";
        } else if (table === 'dives' && day === 18 && month === 7) {
            data.note = "Amazing dive! Saw a turtle and several reef sharks.";
        }
    }
}

