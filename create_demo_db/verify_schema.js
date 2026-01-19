const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// DB is in the parent directory
const DB_PATH = path.join(__dirname, '../demo.sqlite');
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
});

db.close();
