import fs from 'fs';
import path from 'path';
import initSqlJs from 'sql.js';

// Global setup for sql.js if needed by db.js (but I will monkey patch dbService)
global.initSqlJs = initSqlJs;

// Import dbService to patch it
import { dbService } from '../src/db.js';

// Patch ensureInitialized to work in Node
dbService.ensureInitialized = async function() {
    if (this.db) return;
    try {
        const SQL = await initSqlJs();
        this.db = new SQL.Database();
        this.ensureSchema();
        this.tables = this.getTables();
    } catch (error) {
        console.error('Failed to initialize empty database:', error);
        throw error;
    }
};

import { DataImporter } from '../src/services/data-importer.js';

async function runBenchmark() {
    // Load sample data
    // Assuming running from 'benchmark' dir
    const samplePath = path.join(process.cwd(), '../data-samples/health/withings/weight.csv');
    const content = fs.readFileSync(samplePath, 'utf-8');

    // Create a larger dataset
    const lines = content.split('\n');
    const header = lines[0];
    const rows = lines.slice(1).filter(l => l.trim());

    let bigContent = header + '\n';
    // Repeat 5000 times to get substantial I/O overhead without taking forever
    for (let i = 0; i < 5000; i++) {
        bigContent += rows.join('\n') + '\n';
    }

    // Initialize DB once
    await dbService.ensureInitialized();

    console.log(`Starting benchmark...`);

    const start = performance.now();
    const result = await DataImporter.import('weight.csv', bigContent);
    const end = performance.now();

    console.log(`Time taken: ${(end - start).toFixed(2)}ms`);
    console.log('Result:', result);
}

runBenchmark().catch(console.error);
