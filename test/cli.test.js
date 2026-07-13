import { test, before, after } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'child_process';
import { DatabaseSync } from 'node:sqlite';

const testDbPath = path.resolve(import.meta.dirname, '../test_temp.sqlite');
const cliPath = path.resolve(import.meta.dirname, '../cli.js');
const samplesDir = path.resolve(import.meta.dirname, '../data-samples');

before(() => {
    if (fs.existsSync(testDbPath)) {
        fs.unlinkSync(testDbPath);
    }
});

after(() => {
    if (fs.existsSync(testDbPath)) {
        fs.unlinkSync(testDbPath);
    }
});

test('CLI Tool tests', async (t) => {
    await t.test('import command should create and populate DB', () => {
        const diveLogsSample = path.join(samplesDir, 'health/dive-logs.csv');
        
        try {
            const stdout = execSync(`node "${cliPath}" import "${testDbPath}" "${diveLogsSample}"`);
            console.log("DEBUG execSync stdout:", stdout.toString());
        } catch (e) {
            console.error("DEBUG execSync error:", e);
            console.error("DEBUG execSync stderr:", e.stderr?.toString());
            console.error("DEBUG execSync stdout:", e.stdout?.toString());
        }
        
        assert.ok(fs.existsSync(testDbPath), 'test_temp.sqlite should have been created');
        
        const db = new DatabaseSync(testDbPath);
        const dives = db.prepare("SELECT count(*) as count FROM dives").get();
        assert.ok(dives && dives.count > 0, "Dives should be imported");
        db.close();
    });

    await t.test('summary command should return output with table counts', () => {
        const output = execSync(`node "${cliPath}" summary "${testDbPath}"`).toString();
        
        assert.match(output, /Database Summary for test_temp.sqlite/, 'Output should contain database summary title');
        assert.match(output, /dives\s*\|\s*\d+/, 'Output should contain dives table with row counts');
    });

    await t.test('import with --demo flag should seed accounts and notes', () => {
        const diveLogsSample = path.join(samplesDir, 'health/dive-logs.csv');
        execSync(`node "${cliPath}" import "${testDbPath}" "${diveLogsSample}" --demo`, { stdio: 'pipe' });

        const db = new DatabaseSync(testDbPath);
        const accounts = db.prepare("SELECT count(*) as count FROM accounts").get();
        assert.strictEqual(accounts.count, 4, "Accounts should be seeded");
        
        const diveWithNote = db.prepare("SELECT note FROM dives WHERE dive_number = 109").get();
        assert.ok(diveWithNote, "Should find dive 109");
        assert.match(diveWithNote.note, /Amazing dive!/, "Note should match 2025 dive note");

        db.close();
    });
});
