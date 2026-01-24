import { createRequire } from "module";
const require = createRequire(import.meta.url);
const sqlite3 = require('sqlite3').verbose();

const db = new sqlite3.Database('./demo.sqlite');

db.serialize(() => {
    const tables = ['weight', 'sleep', 'steps', 'blood_pressure', 'height', 'body_temperature'];
    console.log("Verifying row counts...");
    tables.forEach(table => {
        db.get(`SELECT count(*) as count FROM ${table}`, (err, row) => {
            if (err) console.error(`Error querying ${table}:`, err.message);
            else console.log(`${table}: ${row.count} rows`);
        });
    });
});
// Allow allow async queries to finish
setTimeout(() => db.close(), 1000);
