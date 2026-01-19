import { createRequire } from "module";
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const require = createRequire(import.meta.url);
const sqlite3 = require('sqlite3').verbose();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// DB is in the parent directory
const DB_PATH = join(__dirname, '../demo.sqlite');
const db = new sqlite3.Database(DB_PATH);

db.serialize(() => {
    console.log("Checking electricity table schema:");
    db.all("PRAGMA table_info(electricity)", (err, rows) => {
        if (err) console.error(err);
        else console.table(rows);
    });

    console.log("Checking gas table schema:");
    db.all("PRAGMA table_info(gas)", (err, rows) => {
        if (err) console.error(err);
        else console.table(rows);
    });

    console.log("Checking transactions table schema:");
    db.all("PRAGMA table_info(transactions)", (err, rows) => {
        if (err) console.error(err);
        else console.table(rows);
    });

    // Check row counts
    db.each("SELECT count(*) as count FROM electricity", (err, row) => console.log('Electricity rows:', row.count));
    db.each("SELECT count(*) as count FROM gas", (err, row) => console.log('Gas rows:', row.count));
    db.each("SELECT count(*) as count FROM transactions", (err, row) => console.log('Transactions rows:', row.count));
});

db.close();

