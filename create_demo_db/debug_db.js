
import { createRequire } from "module";
import path from 'path';
import { fileURLToPath } from 'url';

const require = createRequire(import.meta.url);
const sqlite3 = require('sqlite3').verbose();
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = path.join(__dirname, '../demo.sqlite');

const db = new sqlite3.Database(DB_PATH);

db.serialize(() => {
    console.log("Checking tables...");
    db.all("SELECT name FROM sqlite_master WHERE type='table'", (err, tables) => {
        if (err) {
            console.error("Error fetching tables:", err);
            return;
        }
        console.log("Tables found:", tables.map(t => t.name));

        const tablesToCheck = ['activities', 'steps', 'nutrition_daily', 'nutrition_servings'];
        tablesToCheck.forEach(table => {
            db.get(`SELECT count(*) as count FROM ${table}`, (err, row) => {
                if (err) {
                    console.log(`Error counting ${table}:`, err.message);
                } else {
                    console.log(`Count for ${table}:`, row.count);
                }
            });
        });
    });
});
