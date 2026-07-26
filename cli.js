import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

// Import App Logic
import { dbService } from './src/db.js';
import { DataImporter } from './src/services/data-importer.js';

async function processPath(inputPath, options = {}) {
    const stat = fs.statSync(inputPath);
    if (stat.isDirectory()) {
        const files = fs.readdirSync(inputPath);
        for (const file of files) {
            if (file.startsWith('.')) continue;
            await processPath(path.join(inputPath, file), options);
        }
    } else {
        await processFile(inputPath, options);
    }
}

async function processFile(filePath, options = {}) {
    const content = fs.readFileSync(filePath, 'utf-8');
    const filename = path.basename(filePath);

    // Call the shared DataImporter logic
    const result = await DataImporter.import(filename, content, options);
    console.log(result.message || `Processed ${filename}`);
}

function summary(dbPath) {
    if (!fs.existsSync(dbPath)) {
        console.error(`Database file does not exist: ${dbPath}`);
        process.exit(1);
    }

    dbService.connectNode(dbPath).then(() => {
        try {
            const tables = dbService.query("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'");
            if (tables.length === 0) {
                console.log("No tables found in the database.");
                return;
            }

            console.log(`\nDatabase Summary for ${path.basename(dbPath)}:`);
            console.log("=".repeat(50));
            console.log(`${"Table Name".padEnd(30)} | ${"Row Count".padStart(15)}`);
            console.log("-".repeat(50));

            let totalRows = 0;
            for (const tableObj of tables) {
                const tableName = tableObj.name;
                const countRow = dbService.query(`SELECT count(*) as count FROM "${tableName}"`);
                const count = countRow.length > 0 ? countRow[0].count : 0;
                totalRows += count;
                console.log(`${tableName.padEnd(30)} | ${String(count).padStart(15)}`);
            }
            console.log("-".repeat(50));
            console.log(`${"Total".padEnd(30)} | ${String(totalRows).padStart(15)}`);
            console.log("=".repeat(50));
        } catch (e) {
            console.error(`Error querying database: ${e.message}`);
        } finally {
            if (dbService.db) {
                dbService.db.close();
            }
        }
    }).catch(e => {
        console.error(`Failed to open database: ${e.message}`);
        process.exit(1);
    });
}

async function main() {
    const args = process.argv.slice(2);
    if (args.length === 0 || args[0] === '--help' || args[0] === '-h') {
        printUsage();
        process.exit(0);
    }

    const command = args[0];
    if (command === 'summary') {
        const dbPath = args[1];
        if (!dbPath) {
            console.error("Error: Missing database path.");
            printUsage();
            process.exit(1);
        }
        summary(dbPath);
    } else if (command === 'import') {
        const dbPath = args[1];
        const inputPath = args[2];
        if (!dbPath || !inputPath) {
            console.error("Error: Missing database path or input path.");
            printUsage();
            process.exit(1);
        }

        let provider = null;
        let demo = false;
        for (let i = 3; i < args.length; i++) {
            if (args[i] === '--provider') {
                provider = args[i + 1];
                i++;
            } else if (args[i] === '--demo') {
                demo = true;
            }
        }

        try {
            await dbService.connectNode(dbPath);
        } catch (e) {
            console.error(`Failed to open database: ${e.message}`);
            process.exit(1);
        }

        try {
            if (demo) {
                // Seed demo accounts using shared query helper
                const accounts = [
                    { id: 1, name: "SFCU Checking", balance: 5432.10, type: "checking", source: "demo" },
                    { id: 2, name: "Savings", balance: 12000.50, type: "savings", source: "demo" },
                    { id: 3, name: "401k", balance: 85000.00, type: "retirement", source: "demo" },
                    { id: 4, name: "Crypto Wallet", balance: 3200.00, type: "sellable_asset", source: "demo" }
                ];
                dbService.query('BEGIN TRANSACTION');
                for (const acc of accounts) {
                    const existing = dbService.query('SELECT id FROM accounts WHERE id = ?', [acc.id]);
                    if (existing.length > 0) {
                        dbService.query('UPDATE accounts SET name = ?, balance = ?, type = ?, source = ? WHERE id = ?', [acc.name, acc.balance, acc.type, acc.source, acc.id]);
                    } else {
                        dbService.query('INSERT INTO accounts (id, name, balance, type, source) VALUES (?, ?, ?, ?, ?)', [acc.id, acc.name, acc.balance, acc.type, acc.source]);
                    }
                }
                dbService.query('COMMIT');
            }

            await processPath(inputPath, { provider, demo });
        } catch (e) {
            console.error("An error occurred during import:", e);
        } finally {
            if (dbService.db) {
                dbService.db.close();
            }
        }
    } else {
        console.error(`Error: Unknown command "${command}"`);
        printUsage();
        process.exit(1);
    }
}

function printUsage() {
    console.log(`
Usage:
  node cli.js summary <db_path>
  node cli.js import <db_path> <file_or_dir_path> [options]

Options:
  --provider <name>  Force a specific data provider (e.g. pge, tesla, sfcu, withings, cronometer, google_timeline, google_calendar, spotify, flume, divelog)
  --demo             Seed demo accounts and generate 2025 demo notes
`);
}

main();
