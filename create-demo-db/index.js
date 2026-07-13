import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DB_PATH = path.join(__dirname, '../demo.sqlite');
const SAMPLES_DIR = path.join(__dirname, '../data-samples');
const CLI_PATH = path.join(__dirname, '../cli.js');

// Delete existing file if present
if (fs.existsSync(DB_PATH)) {
    try {
        fs.unlinkSync(DB_PATH);
    } catch (e) {
        console.error("Could not delete existing DB, maybe it's open?", e);
    }
}

console.log("Generating demo database using cli.js...");
try {
    execSync(`node "${CLI_PATH}" import "${DB_PATH}" "${SAMPLES_DIR}" --demo`, { stdio: 'inherit' });
    console.log("Demo database successfully generated.");
} catch (e) {
    console.error("Failed to generate demo database:", e);
    process.exit(1);
}
