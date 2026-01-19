import { createRequire } from "module";
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Import App Logic
import { CSVParser } from '../src/utils/csv-parser.js';
import { PgeImporter } from '../src/importers/energy/pge.js';
import { TeslaImporter } from '../src/importers/energy/tesla.js';
import { SfcuImporter } from '../src/importers/finance/sfcu.js';

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

const importers = [PgeImporter, TeslaImporter, SfcuImporter];

async function run() {
    await new Promise((resolve) => {
        db.serialize(async () => {
            // ==========================================
            // 1. Create Tables
            // ==========================================

            // Location History
            db.run(`CREATE TABLE IF NOT EXISTS location_history (
                id INTEGER PRIMARY KEY, 
                lat REAL, 
                lng REAL, 
                timestamp TEXT
            )`);

            // Health Data
            db.run(`CREATE TABLE IF NOT EXISTS weight (id INTEGER PRIMARY KEY, value REAL, timestamp TEXT)`);
            db.run(`CREATE TABLE IF NOT EXISTS sleep (id INTEGER PRIMARY KEY, value REAL, timestamp TEXT)`);
            db.run(`CREATE TABLE IF NOT EXISTS steps (id INTEGER PRIMARY KEY, value INTEGER, timestamp TEXT)`);

            // Finance Data
            db.run(`CREATE TABLE IF NOT EXISTS accounts (id INTEGER PRIMARY KEY, name TEXT, balance REAL, type TEXT)`);
            db.run(`CREATE TABLE IF NOT EXISTS transactions (id INTEGER PRIMARY KEY, timestamp TEXT, description TEXT, amount REAL, account_id INTEGER)`);

            // Energy Data
            // Energy Data
            db.run(`CREATE TABLE IF NOT EXISTS electricity_grid_hourly (id INTEGER PRIMARY KEY, timestamp TEXT, import_kwh REAL)`);
            db.run(`CREATE TABLE IF NOT EXISTS electricity_solar_hourly (id INTEGER PRIMARY KEY, timestamp TEXT, solar_kwh REAL, consumption_kwh REAL)`);
            db.run(`CREATE TABLE IF NOT EXISTS gas_daily (id INTEGER PRIMARY KEY, timestamp TEXT, usage_therms REAL)`);

            // Movies
            db.run(`CREATE TABLE IF NOT EXISTS movies (id INTEGER PRIMARY KEY, title TEXT, year INTEGER, rating INTEGER, timestamp TEXT, poster_url TEXT)`);


            // ==========================================
            // 2. Generate Random Data (for things missing samples)
            // ==========================================

            console.log("Generating random data for: Location, Health, Movies...");

            // Location
            const stmtLocation = db.prepare("INSERT INTO location_history (lat, lng, timestamp) VALUES (?, ?, ?)");
            const baseLat = 37.7749;
            const baseLng = -122.4194;
            for (let i = 0; i < 100; i++) {
                const lat = baseLat + (Math.random() - 0.5) * 0.1;
                const lng = baseLng + (Math.random() - 0.5) * 0.1;
                const time = new Date(Date.now() - i * 3600000).toISOString();
                stmtLocation.run(lat, lng, time);
            }
            stmtLocation.finalize();

            // Health
            const stmtWeight = db.prepare("INSERT INTO weight (value, timestamp) VALUES (?, ?)");
            let weight = 70.0;
            for (let i = 0; i < 30; i++) {
                weight += (Math.random() - 0.5) * 1.0;
                const time = new Date(Date.now() - i * 86400000).toISOString();
                stmtWeight.run(weight, time);
            }
            stmtWeight.finalize();

            const stmtSleep = db.prepare("INSERT INTO sleep (value, timestamp) VALUES (?, ?)");
            for (let i = 0; i < 30; i++) {
                const hours = 6.0 + Math.random() * 3.0;
                const time = new Date(Date.now() - i * 86400000).toISOString();
                stmtSleep.run(hours, time);
            }
            stmtSleep.finalize();

            const stmtSteps = db.prepare("INSERT INTO steps (value, timestamp) VALUES (?, ?)");
            for (let i = 0; i < 30; i++) {
                const steps = Math.floor(4000 + Math.random() * 10000);
                const time = new Date(Date.now() - i * 86400000).toISOString();
                stmtSteps.run(steps, time);
            }
            stmtSteps.finalize();

            // Accounts (Create specific ones + random)
            const stmtAccounts = db.prepare("INSERT INTO accounts (id, name, balance, type) VALUES (?, ?, ?, ?)");
            // Ensure ID 1 exists for SFCU import
            stmtAccounts.run(1, "SFCU Checking", 5432.10, "checking");
            stmtAccounts.run(2, "Savings", 12000.50, "savings");
            stmtAccounts.run(3, "401k", 85000.00, "retirement");
            stmtAccounts.run(4, "Crypto Wallet", 3200.00, "sellable_asset");
            stmtAccounts.finalize();

            // Movies
            const stmtMovies = db.prepare("INSERT INTO movies (title, year, rating, timestamp, poster_url) VALUES (?, ?, ?, ?, ?)");
            const moviesList = [
                ["Inception", 2010, 5, "https://image.tmdb.org/t/p/w200/9gk7adHYeDvHkCSEqAvQNLV5Uge.jpg"],
                ["The Matrix", 1999, 5, "https://image.tmdb.org/t/p/w200/f89U3ADr1oiB1s9GkdPOEpXUk5H.jpg"],
                ["Interstellar", 2014, 4, "https://image.tmdb.org/t/p/w200/gEU2QniL6C8zXtE5XD091nMs1S4.jpg"],
                ["The Dark Knight", 2008, 5, "https://image.tmdb.org/t/p/w200/qJ2tW6WMUDux911r6m7haRef0WH.jpg"],
                ["Pulp Fiction", 1994, 4, "https://image.tmdb.org/t/p/w200/d5iIlFn5s0ImszYzBPb8JPIfbXD.jpg"]
            ];
            moviesList.forEach(m => {
                const timeWatched = new Date(Date.now() - Math.floor(Math.random() * 100) * 86400000).toISOString();
                stmtMovies.run(m[0], m[1], m[2], timeWatched, m[3]);
            });
            stmtMovies.finalize();

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
    try {
        rows = CSVParser.parse(content);
    } catch (e) {
        console.warn(`Failed to parse ${filePath}: ${e.message}`);
        return;
    }

    if (!rows || rows.length === 0) {
        // console.warn(`No rows in ${filePath}`);
        return;
    }

    // Detect Importer
    const ImporterClass = importers.find(i => i.detect(rows));
    if (!ImporterClass) {
        console.log(`No importer detected for ${path.basename(filePath)}`);
        return;
    }

    console.log(`Using ${ImporterClass.name}`);
    const defaultTable = ImporterClass.getTable();

    db.serialize(() => {
        db.run("BEGIN TRANSACTION");

        // Prepare statements could be optimized but simple runs are fine for demo script
        for (const row of rows) {
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
    }
}

run();
