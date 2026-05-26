import { createRequire } from "module";
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Import App Logic
import { CSVParser } from '../src/utils/csv-parser.js';
import { PgeImporter } from '../src/importers/energy/pge.js';
import { TeslaImporter } from '../src/importers/energy/tesla.js';
import { SfcuImporter } from '../src/importers/finance/sfcu.js';
import { WithingsImporter } from '../src/importers/health/withings.js';
import { CronometerImporter } from '../src/importers/health/cronometer.js';
import { GoogleTimelineImporter } from '../src/importers/location/google-timeline.js';
import { SpotifyImporter } from '../src/importers/music/spotify.js';
import { FlumeImporter } from '../src/importers/water/flume.js';

const require = createRequire(import.meta.url);
const sqlite3 = require('sqlite3').verbose();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

function dirname(file) {
    return path.dirname(file);
}

const DB_PATH = path.join(__dirname, '../demo.sqlite');
const SAMPLES_DIR = path.join(__dirname, '../data-samples');

// Delete existing file if present
if (fs.existsSync(DB_PATH)) {
    try {
        fs.unlinkSync(DB_PATH);
    } catch (e) {
        console.error("Could not delete existing DB, maybe it's open?", e);
    }
}

const db = new sqlite3.Database(DB_PATH);

const importers = [PgeImporter, TeslaImporter, SfcuImporter, WithingsImporter, CronometerImporter, GoogleTimelineImporter, SpotifyImporter, FlumeImporter];

async function run() {
    await new Promise((resolve) => {
        db.serialize(async () => {
            // ==========================================
            // 1. Create Tables
            // ==========================================

            // Location History
            db.run(`CREATE TABLE IF NOT EXISTS location (
                id INTEGER PRIMARY KEY, 
                timestamp INTEGER,
                lat REAL, 
                lng REAL,
                source TEXT,
                note TEXT
            )`);

            // Health Data
            db.run(`CREATE TABLE IF NOT EXISTS weight (id INTEGER PRIMARY KEY, timestamp INTEGER, weight_kg REAL, fat_mass_kg REAL, bone_mass_kg REAL, muscle_mass_kg REAL, hydration_kg REAL, source TEXT, note TEXT)`);
            db.run(`CREATE TABLE IF NOT EXISTS sleep (id INTEGER PRIMARY KEY, timestamp INTEGER, start_timestamp INTEGER, duration_hours REAL, light_seconds INTEGER, deep_seconds INTEGER, rem_seconds INTEGER, awake_seconds INTEGER, wake_up_seconds INTEGER, duration_to_sleep_seconds INTEGER, duration_to_wake_up_seconds INTEGER, snoring_seconds INTEGER, snoring_episodes INTEGER, average_heart_rate INTEGER, heart_rate_min INTEGER, heart_rate_max INTEGER, source TEXT, note TEXT)`);
            db.run(`CREATE TABLE IF NOT EXISTS steps (id INTEGER PRIMARY KEY, timestamp INTEGER, count INTEGER, type TEXT, distance REAL, calories REAL, source TEXT, note TEXT)`);
            db.run(`CREATE TABLE IF NOT EXISTS activities (id INTEGER PRIMARY KEY, timestamp INTEGER, end_timestamp INTEGER, type TEXT, calories REAL, distance REAL, steps INTEGER, elevation REAL, hr_average INTEGER, source TEXT, note TEXT)`);
            db.run(`CREATE TABLE IF NOT EXISTS blood_pressure (id INTEGER PRIMARY KEY, timestamp INTEGER, systolic_mmhg INTEGER, diastolic_mmhg INTEGER, heart_rate_bpm INTEGER, source TEXT, note TEXT)`);
            db.run(`CREATE TABLE IF NOT EXISTS height (id INTEGER PRIMARY KEY, timestamp INTEGER, height_m REAL, source TEXT, note TEXT)`);
            db.run(`CREATE TABLE IF NOT EXISTS body_temperature (id INTEGER PRIMARY KEY, timestamp INTEGER, temperature_c REAL, source TEXT, note TEXT)`);
            db.run(`CREATE TABLE IF NOT EXISTS water_daily (id INTEGER PRIMARY KEY, timestamp INTEGER, usage_liters REAL, source TEXT, note TEXT)`);
            db.run(`CREATE TABLE IF NOT EXISTS nutrition_daily (
                id INTEGER PRIMARY KEY,
                timestamp INTEGER,
                energy_kcal REAL,
                alcohol_g REAL,
                caffeine_mg REAL,
                water_g REAL,
                b1_mg REAL,
                b2_mg REAL,
                b3_mg REAL,
                b5_mg REAL,
                b6_mg REAL,
                b12_ug REAL,
                folate_ug REAL,
                vitamin_a_ug REAL,
                vitamin_c_mg REAL,
                vitamin_d_iu REAL,
                vitamin_e_mg REAL,
                vitamin_k_ug REAL,
                calcium_mg REAL,
                copper_mg REAL,
                iron_mg REAL,
                magnesium_mg REAL,
                manganese_mg REAL,
                phosphorus_mg REAL,
                potassium_mg REAL,
                selenium_ug REAL,
                sodium_mg REAL,
                zinc_mg REAL,
                carbs_g REAL,
                fiber_g REAL,
                starch_g REAL,
                sugars_g REAL,
                added_sugars_g REAL,
                net_carbs_g REAL,
                fat_g REAL,
                cholesterol_mg REAL,
                monounsaturated_g REAL,
                polyunsaturated_g REAL,
                saturated_g REAL,
                trans_fats_g REAL,
                omega_3_g REAL,
                omega_6_g REAL,
                cystine_g REAL,
                histidine_g REAL,
                isoleucine_g REAL,
                leucine_g REAL,
                lysine_g REAL,
                methionine_g REAL,
                phenylalanine_g REAL,
                protein_g REAL,
                threonine_g REAL,
                tryptophan_g REAL,
                tyrosine_g REAL,
                valine_g REAL,
                completed INTEGER,
                source TEXT,
                note TEXT
            )`);
            db.run(`CREATE TABLE IF NOT EXISTS nutrition_servings (
                id INTEGER PRIMARY KEY,
                timestamp INTEGER,
                meal_group TEXT,
                food_name TEXT,
                amount TEXT,
                category TEXT,
                energy_kcal REAL,
                alcohol_g REAL,
                caffeine_mg REAL,
                water_g REAL,
                b1_mg REAL,
                b2_mg REAL,
                b3_mg REAL,
                b5_mg REAL,
                b6_mg REAL,
                b12_ug REAL,
                folate_ug REAL,
                vitamin_a_ug REAL,
                vitamin_c_mg REAL,
                vitamin_d_iu REAL,
                vitamin_e_mg REAL,
                vitamin_k_ug REAL,
                calcium_mg REAL,
                copper_mg REAL,
                iron_mg REAL,
                magnesium_mg REAL,
                manganese_mg REAL,
                phosphorus_mg REAL,
                potassium_mg REAL,
                selenium_ug REAL,
                sodium_mg REAL,
                zinc_mg REAL,
                carbs_g REAL,
                fiber_g REAL,
                starch_g REAL,
                sugars_g REAL,
                added_sugars_g REAL,
                net_carbs_g REAL,
                fat_g REAL,
                cholesterol_mg REAL,
                monounsaturated_g REAL,
                polyunsaturated_g REAL,
                saturated_g REAL,
                trans_fats_g REAL,
                omega_3_g REAL,
                omega_6_g REAL,
                cystine_g REAL,
                histidine_g REAL,
                isoleucine_g REAL,
                leucine_g REAL,
                lysine_g REAL,
                methionine_g REAL,
                phenylalanine_g REAL,
                protein_g REAL,
                threonine_g REAL,
                tryptophan_g REAL,
                tyrosine_g REAL,
                valine_g REAL,
                source TEXT,
                note TEXT
            )`);

            // Music Data
            db.run(`CREATE TABLE IF NOT EXISTS music (
                id INTEGER PRIMARY KEY,
                timestamp INTEGER,
                track_name TEXT,
                artist_name TEXT,
                album_name TEXT,
                track_uri TEXT,
                duration_ms INTEGER,
                platform TEXT,
                source TEXT,
                note TEXT
            )`);

            // Finance Data
            db.run(`CREATE TABLE IF NOT EXISTS accounts (id INTEGER PRIMARY KEY, name TEXT, balance REAL, type TEXT, source TEXT, note TEXT)`);
            db.run(`CREATE TABLE IF NOT EXISTS transactions (id INTEGER PRIMARY KEY, timestamp INTEGER, description TEXT, amount REAL, account_id INTEGER, source TEXT, note TEXT)`);

            // Energy Data
            db.run(`CREATE TABLE IF NOT EXISTS electricity_hourly (
                id INTEGER PRIMARY KEY,
                timestamp INTEGER,
                grid_import_kwh REAL,
                grid_export_kwh REAL,
                solar_kwh REAL,
                home_consumption_kwh REAL,
                vehicle_kwh REAL,
                battery_kwh REAL,
                cost REAL,
                source TEXT,
                note TEXT
            )`);
            db.run(`CREATE TABLE IF NOT EXISTS electricity_grid_daily (id INTEGER PRIMARY KEY, timestamp INTEGER, import_kwh REAL, cost REAL, source TEXT, note TEXT)`);
            db.run(`CREATE TABLE IF NOT EXISTS gas_daily (id INTEGER PRIMARY KEY, timestamp INTEGER, usage_therms REAL, cost REAL, source TEXT, note TEXT)`);


            // 2. Generate Random Data (for things missing samples)
            // ==========================================

            console.log("Generating random data for: Location, Health...");

            // Location
            // const stmtLocation = db.prepare("INSERT INTO location (lat, lng, timestamp) VALUES (?, ?, ?)");
            // const baseLat = 37.7749;
            // const baseLng = -122.4194;
            // for (let i = 0; i < 100; i++) {
            //     const lat = baseLat + (Math.random() - 0.5) * 0.1;
            //     const lng = baseLng + (Math.random() - 0.5) * 0.1;
            //     const time = new Date(Date.now() - i * 3600000).getTime();
            //     stmtLocation.run(lat, lng, time);
            // }
            // stmtLocation.finalize();

            // Health data is now imported from samples

            // Accounts (Create specific ones + random)
            const stmtAccounts = db.prepare("INSERT INTO accounts (id, name, balance, type) VALUES (?, ?, ?, ?)");
            // Ensure ID 1 exists for SFCU import
            stmtAccounts.run(1, "SFCU Checking", 5432.10, "checking");
            stmtAccounts.run(2, "Savings", 12000.50, "savings");
            stmtAccounts.run(3, "401k", 85000.00, "retirement");
            stmtAccounts.run(4, "Crypto Wallet", 3200.00, "sellable_asset");
            stmtAccounts.finalize();



            resolve();
        });
    });

    // ==========================================
    // 3. Import Real Data from Samples
    // ==========================================
    console.log("Importing real data from samples...");
    await processDirectory(SAMPLES_DIR);

    console.log("Closing DB...");
    db.close();
    console.log("Done.");
}

async function processDirectory(dir) {
    const files = fs.readdirSync(dir);
    for (const file of files) {
        const fullPath = path.join(dir, file);
        const stat = fs.statSync(fullPath);
        if (stat.isDirectory()) {
            await processDirectory(fullPath);
        } else {
            await processFile(fullPath);
        }
    }
}

async function processFile(filePath) {
    console.log(`Processing ${path.basename(filePath)}...`);
    let content = fs.readFileSync(filePath, 'utf-8');

    // PGE Logic from DataImporter
    if (content.indexOf('TYPE,DATE,START TIME') > 0) {
        const pgeHeaderIndex = content.indexOf('TYPE,DATE,START TIME');
        content = content.substring(pgeHeaderIndex);
    }

    let rows;
    let jsonData;
    const isJson = filePath.toLowerCase().endsWith('.json');

    try {
        if (isJson) {
            jsonData = JSON.parse(content);
        } else {
            rows = CSVParser.parse(content);
        }
    } catch (e) {
        console.warn(`Failed to parse ${filePath}: ${e.message}`);
        return;
    }

    if ((!isJson && (!rows || rows.length === 0)) || (isJson && !jsonData)) {
        // console.warn(`No rows in ${filePath}`);
        return;
    }

    // Detect Importer
    const ImporterClass = importers.find(i => isJson ? i.detect(jsonData) : i.detect(rows));
    if (!ImporterClass) {
        console.log(`No importer detected for ${path.basename(filePath)}`);
        return;
    }

    console.log(`Using ${ImporterClass.name}`);
    const defaultTable = ImporterClass.getTable();

    // Prepare items (Sync/Async safe now)
    const itemsToProcess = isJson ? (ImporterClass.extractItems ? ImporterClass.extractItems(jsonData) : (Array.isArray(jsonData) ? jsonData : [jsonData])) : rows;

    // 1. Buffer items by table
    let itemsByTable = {};
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

            if (!table) continue;

            // Set source
            data.source = data.source || ImporterClass.source || table;

            // Generate some nice sample notes for demo SQLite
            if (data && data.timestamp) {
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
                    }
                }
            }

            if (!itemsByTable[table]) itemsByTable[table] = [];
            itemsByTable[table].push(data);

        } catch (err) {
            console.warn("Row error", err);
        }
    }

    // 2. Post-process hook (Aggregation)
    if (ImporterClass.postProcess) {
        itemsByTable = await ImporterClass.postProcess(itemsByTable);
    }

    // 3. Insert Data (Wrapped in Promise)
    return new Promise((resolve, reject) => {
        db.serialize(() => {
            db.run("BEGIN TRANSACTION");

            for (const [table, items] of Object.entries(itemsByTable)) {
                for (const data of items) {
                    insertData(table, data);
                }
            }

            db.run("COMMIT", (err) => {
                if (err) reject(err);
                else resolve();
            });
        });
    });
}

function insertData(table, data) {
    const source = data.source || null;
    const note = data.note || null;

    if (table === 'electricity_hourly') {
        db.run(
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
                source,
                note
            ],
            (err) => { if (err) console.error(err.message); }
        );
    } else if (table === 'electricity_grid_daily') {
        const imp = data.import_kwh !== null ? data.import_kwh : 0;
        const cost = data.cost !== null ? data.cost : 0;
        db.run(
            'INSERT INTO electricity_grid_daily (timestamp, import_kwh, cost, source, note) VALUES (?, ?, ?, ?, ?)',
            [data.timestamp, imp, cost, source, note],
            (err) => { if (err) console.error(err.message); }
        );
    } else if (table === 'gas_daily') {
        const usage = data.usage_therms !== null ? data.usage_therms : 0;
        const cost = data.cost !== null ? data.cost : 0;
        db.run(
            'INSERT INTO gas_daily (timestamp, usage_therms, cost, source, note) VALUES (?, ?, ?, ?, ?)',
            [data.timestamp, usage, cost, source, note],
            (err) => { if (err) console.error(err.message); }
        );
    } else if (table === 'transactions') {
        db.run(
            'INSERT INTO transactions (timestamp, description, amount, account_id, source, note) VALUES (?, ?, ?, ?, ?, ?)',
            [data.timestamp, data.description, data.amount, data.account_id, source, note],
            (err) => { if (err) console.error(err.message); }
        );
    } else if (table === 'weight') {
        db.run(
            'INSERT INTO weight (timestamp, weight_kg, fat_mass_kg, bone_mass_kg, muscle_mass_kg, hydration_kg, source, note) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
            [
                data.timestamp,
                data.weight_kg,
                data.fat_mass_kg || null,
                data.bone_mass_kg || null,
                data.muscle_mass_kg || null,
                data.hydration_kg || null,
                source,
                note
            ],
            (err) => { if (err) console.error(err.message); }
        );
    } else if (table === 'sleep') {
        db.run(
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
                source,
                note
            ],
            (err) => { if (err) console.error(err.message); }
        );
    } else if (table === 'steps') {
        db.run('INSERT INTO steps (timestamp, count, type, distance, calories, source, note) VALUES (?, ?, ?, ?, ?, ?, ?)', [data.timestamp, data.count, data.type, data.distance || null, data.calories || null, source, note], (err) => { if (err) console.error(err.message); });
    } else if (table === 'blood_pressure') {
        db.run('INSERT INTO blood_pressure (timestamp, systolic_mmhg, diastolic_mmhg, heart_rate_bpm, source, note) VALUES (?, ?, ?, ?, ?, ?)', [data.timestamp, data.systolic_mmhg, data.diastolic_mmhg, data.heart_rate_bpm, source, note], (err) => { if (err) console.error(err.message); });
    } else if (table === 'height') {
        db.run('INSERT INTO height (timestamp, height_m, source, note) VALUES (?, ?, ?, ?)', [data.timestamp, data.height_m, source, note], (err) => { if (err) console.error(err.message); });
    } else if (table === 'body_temperature') {
        db.run('INSERT INTO body_temperature (timestamp, temperature_c, source, note) VALUES (?, ?, ?, ?)', [data.timestamp, data.temperature_c, source, note], (err) => { if (err) console.error(err.message); });
    } else if (table === 'location') {
        db.run('INSERT INTO location (timestamp, lat, lng, source, note) VALUES (?, ?, ?, ?, ?)', [data.timestamp, data.lat, data.lng, source, note], (err) => { if (err) console.error(err.message); });
    } else if (table === 'water_daily') {
        db.run('INSERT INTO water_daily (timestamp, usage_liters, source, note) VALUES (?, ?, ?, ?)', [data.timestamp, data.usage_liters, source, note], (err) => { if (err) console.error(err.message); });
    } else if (table === 'nutrition_daily' || table === 'nutrition_servings') {
        const keys = Object.keys(data).filter(k => k !== 'timestamp' && k !== 'id');
        const cols = ['timestamp', ...keys].join(', ');
        const placeholders = ['?', ...keys.map(() => '?')].join(', ');
        const values = [data.timestamp, ...keys.map(k => data[k])];

        db.run(`INSERT INTO ${table} (${cols}) VALUES (${placeholders})`, values, (err) => {
            if (err) console.error(`Error inserting ${table}`, err.message);
        });
    } else if (table === 'activities') {
        db.run(
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
                source,
                note
            ],
            (err) => { if (err) console.error(err.message); }
        );
    } else if (table === 'music') {
        db.run(
            'INSERT INTO music (timestamp, track_name, artist_name, album_name, track_uri, duration_ms, platform, source, note) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [data.timestamp, data.track_name, data.artist_name, data.album_name, data.track_uri, data.duration_ms, data.platform, source, note],
            (err) => { if (err) console.error(err.message); }
        );
    }
}


run();
