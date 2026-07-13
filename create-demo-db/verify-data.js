import { DatabaseSync } from 'node:sqlite';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DB_PATH = path.join(__dirname, '../demo.sqlite');

console.log("Verifying demo.sqlite...");
const db = new DatabaseSync(DB_PATH);

try {
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").all();
    const tableList = tables.map(t => t.name);
    console.log("Tables:", tableList);

    for (const table of tableList) {
        const row = db.prepare(`SELECT count(*) as count FROM "${table}"`).get();
        console.log(`${table}: ${row ? row.count : 0} rows`);
    }

    if (tableList.includes('electricity_hourly')) {
        const row = db.prepare(`SELECT timestamp FROM electricity_hourly LIMIT 1`).get();
        if (row) {
            console.log(`Sample electricity_hourly timestamp: ${row.timestamp} (Type: ${typeof row.timestamp})`);
        }
    }
} catch (e) {
    console.error("Verification error:", e);
} finally {
    db.close();
}
