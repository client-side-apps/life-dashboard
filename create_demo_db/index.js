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
import { GoogleTimelineImporter } from '../src/importers/location/google-timeline.js';

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

const importers = [PgeImporter, TeslaImporter, SfcuImporter, WithingsImporter, GoogleTimelineImporter];

async function run() {
    await new Promise((resolve) => {
        db.serialize(async () => {
            // ==========================================
            // 1. Create Tables
            // ==========================================

            // Location History
            db.run(`CREATE TABLE IF NOT EXISTS location (
                id INTEGER PRIMARY KEY, 
                lat REAL, 
                lng REAL, 
                timestamp INTEGER
            )`);

            // Health Data
            db.run(`CREATE TABLE IF NOT EXISTS weight (id INTEGER PRIMARY KEY, weight_kg REAL, timestamp INTEGER)`);
            db.run(`CREATE TABLE IF NOT EXISTS sleep (id INTEGER PRIMARY KEY, duration_hours REAL, timestamp INTEGER, light_seconds INTEGER, deep_seconds INTEGER, rem_seconds INTEGER, awake_seconds INTEGER)`);
            db.run(`CREATE TABLE IF NOT EXISTS steps (id INTEGER PRIMARY KEY, count INTEGER, timestamp INTEGER, type TEXT, distance REAL, calories REAL)`);
            db.run(`CREATE TABLE IF NOT EXISTS blood_pressure (id INTEGER PRIMARY KEY, timestamp INTEGER, systolic_mmhg INTEGER, diastolic_mmhg INTEGER, heart_rate_bpm INTEGER)`);
            db.run(`CREATE TABLE IF NOT EXISTS height (id INTEGER PRIMARY KEY, timestamp INTEGER, height_m REAL)`);
            db.run(`CREATE TABLE IF NOT EXISTS body_temperature (id INTEGER PRIMARY KEY, timestamp INTEGER, temperature_c REAL)`);

            // Finance Data
            db.run(`CREATE TABLE IF NOT EXISTS accounts (id INTEGER PRIMARY KEY, name TEXT, balance REAL, type TEXT)`);
            db.run(`CREATE TABLE IF NOT EXISTS transactions (id INTEGER PRIMARY KEY, timestamp INTEGER, description TEXT, amount REAL, account_id INTEGER)`);

            // Energy Data
            // Energy Data
            db.run(`CREATE TABLE IF NOT EXISTS electricity_grid_hourly (id INTEGER PRIMARY KEY, timestamp INTEGER, import_kwh REAL)`);
            db.run(`CREATE TABLE IF NOT EXISTS electricity_solar_hourly (id INTEGER PRIMARY KEY, timestamp INTEGER, solar_kwh REAL, consumption_kwh REAL)`);
            db.run(`CREATE TABLE IF NOT EXISTS gas_daily (id INTEGER PRIMARY KEY, timestamp INTEGER, usage_therms REAL)`);


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

    db.serialize(() => {
        db.run("BEGIN TRANSACTION");

        // Prepare statements could be optimized but simple runs are fine for demo script
        const itemsToProcess = isJson ? (ImporterClass.extractItems ? ImporterClass.extractItems(jsonData) : (Array.isArray(jsonData) ? jsonData : [jsonData])) : rows;

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

                insertData(table, data);

            } catch (err) {
                console.warn("Row error", err);
            }
        }
        db.run("COMMIT");
    });
}

function insertData(table, data) {
    if (table === 'electricity_grid_hourly') {
        const imp = data.import_kwh !== null ? data.import_kwh : 0;
        db.run(
            'INSERT INTO electricity_grid_hourly (timestamp, import_kwh) VALUES (?, ?)',
            [data.timestamp, imp],
            (err) => { if (err) console.error(err.message); }
        );
    } else if (table === 'electricity_solar_hourly') {
        const solar = data.solar_kwh !== null ? data.solar_kwh : 0;
        const consumption = data.consumption_kwh !== null ? data.consumption_kwh : 0;
        db.run(
            'INSERT INTO electricity_solar_hourly (timestamp, solar_kwh, consumption_kwh) VALUES (?, ?, ?)',
            [data.timestamp, solar, consumption],
            (err) => { if (err) console.error(err.message); }
        );
    } else if (table === 'gas_daily') {
        db.run(
            'INSERT INTO gas_daily (timestamp, usage_therms) VALUES (?, ?)',
            [data.timestamp, data.usage_therms],
            (err) => { if (err) console.error(err.message); }
        );
    } else if (table === 'transactions') {
        db.run(
            'INSERT INTO transactions (timestamp, description, amount, account_id) VALUES (?, ?, ?, ?)',
            [data.timestamp, data.description, data.amount, data.account_id],
            (err) => { if (err) console.error(err.message); }
        );
    } else if (table === 'weight') {
        db.run('INSERT INTO weight (timestamp, weight_kg) VALUES (?, ?)', [data.timestamp, data.weight_kg], (err) => { if (err) console.error(err.message); });
    } else if (table === 'sleep') {
        db.run('INSERT INTO sleep (timestamp, duration_hours, light_seconds, deep_seconds, rem_seconds, awake_seconds) VALUES (?, ?, ?, ?, ?, ?)', [data.timestamp, data.duration_hours, data.light_seconds, data.deep_seconds, data.rem_seconds, data.awake_seconds], (err) => { if (err) console.error(err.message); });
    } else if (table === 'steps') {
        db.run('INSERT INTO steps (timestamp, count, type, distance, calories) VALUES (?, ?, ?, ?, ?)', [data.timestamp, data.count, data.type, data.distance, data.calories], (err) => { if (err) console.error(err.message); });
    } else if (table === 'blood_pressure') {
        db.run('INSERT INTO blood_pressure (timestamp, systolic_mmhg, diastolic_mmhg, heart_rate_bpm) VALUES (?, ?, ?, ?)', [data.timestamp, data.systolic_mmhg, data.diastolic_mmhg, data.heart_rate_bpm], (err) => { if (err) console.error(err.message); });
    } else if (table === 'height') {
        db.run('INSERT INTO height (timestamp, height_m) VALUES (?, ?)', [data.timestamp, data.height_m], (err) => { if (err) console.error(err.message); });
    } else if (table === 'body_temperature') {
        db.run('INSERT INTO body_temperature (timestamp, temperature_c) VALUES (?, ?)', [data.timestamp, data.temperature_c], (err) => { if (err) console.error(err.message); });
    } else if (table === 'location') {
        db.run('INSERT INTO location (timestamp, lat, lng) VALUES (?, ?, ?)', [data.timestamp, data.lat, data.lng], (err) => { if (err) console.error(err.message); });
    }
}

run();
