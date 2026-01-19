import sqlite3 from 'sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DB_PATH = path.join(__dirname, '../demo.sqlite');

const db = new sqlite3.Database(DB_PATH);

db.serialize(() => {
    console.log("Verifying demo.sqlite...");

    // Check tables
    db.all("SELECT name FROM sqlite_master WHERE type='table'", (err, tables) => {
        if (err) {
            console.error("Error getting tables:", err);
            return;
        }
        console.log("Tables:", tables.map(t => t.name));

        // Check counts
        const tableList = tables.map(t => t.name);
        tableList.forEach(table => {
            db.get(`SELECT count(*) as count FROM "${table}"`, (err, row) => {
                if (err) console.error(`Error counting ${table}:`, err);
                else console.log(`${table}: ${row.count} rows`);
            });
        });

        // Check timestamp type and value in electricity_grid_hourly
        if (tableList.includes('electricity_grid_hourly')) {
            db.get(`SELECT timestamp FROM electricity_grid_hourly LIMIT 1`, (err, row) => {
                if (row) {
                    console.log(`Sample electricity_grid_hourly timestamp: ${row.timestamp} (Type: ${typeof row.timestamp})`);
                }
            });
        }
    });
});
