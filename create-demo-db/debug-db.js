import { DatabaseSync } from 'node:sqlite';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = path.join(__dirname, '../demo.sqlite');

const db = new DatabaseSync(DB_PATH);

try {
    console.log("Checking tables...");
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").all();
    console.log("Tables found:", tables.map(t => t.name));

    const tablesToCheck = ['activities', 'steps', 'nutrition_daily', 'nutrition_servings'];
    tablesToCheck.forEach(table => {
        try {
            const row = db.prepare(`SELECT count(*) as count FROM "${table}"`).get();
            console.log(`Count for ${table}:`, row ? row.count : 0);
        } catch (e) {
            console.log(`Error counting ${table}:`, e.message);
        }
    });
} catch (e) {
    console.error("Debug error:", e);
} finally {
    db.close();
}
