import { test, before, after } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';

import { dbService } from '../src/db.js';
import { DataImporter } from '../src/services/data-importer.js';

const testDbPath = path.resolve(import.meta.dirname, '../test_importer_temp.sqlite');

before(async () => {
    if (fs.existsSync(testDbPath)) {
        fs.unlinkSync(testDbPath);
    }
    await dbService.connectNode(testDbPath);
});

after(() => {
    if (fs.existsSync(testDbPath)) {
        fs.unlinkSync(testDbPath);
    }
});

test('DataImporter duplicate handling', async (t) => {

    await t.test('preserves identical same-day transactions and stays idempotent on re-import', async () => {
        const csv = [
            'Account Number,Post Date,Check,Description,Debit,Credit,Status,Balance',
            '"******3444",12/30/2025,,"ACH Debit Coffee Shop",5.50,,Posted,100.00',
            '"******3444",12/30/2025,,"ACH Debit Coffee Shop",5.50,,Posted,94.50',
            '"******3444",12/30/2025,,"ACH Debit Grocery Store",88.60,,Posted,5.90'
        ].join('\n');

        await DataImporter.import('AccountHistory.csv', csv);

        let rows = dbService.query("SELECT * FROM transactions WHERE description = 'ACH Debit Coffee Shop'");
        assert.strictEqual(rows.length, 2, 'Both identical coffee purchases should be stored');

        // Re-importing the same file must not collapse nor duplicate them
        await DataImporter.import('AccountHistory.csv', csv);

        rows = dbService.query("SELECT * FROM transactions WHERE description = 'ACH Debit Coffee Shop'");
        assert.strictEqual(rows.length, 2, 'Re-import should neither collapse nor duplicate');

        const all = dbService.query('SELECT * FROM transactions');
        assert.strictEqual(all.length, 3);
    });

    await t.test('preserves multiple servings logged at the same time and stays idempotent', async () => {
        const csv = [
            'Day,Time,Group,Food Name,Amount,Energy (kcal),Category',
            '2026-02-07,08:00 AM,Breakfast,"Oatmeal","1 cup",150.0,"Grains"',
            '2026-02-07,08:00 AM,Breakfast,"Coffee","1 cup",5.0,"Beverages"',
            '2026-02-07,08:00 AM,Breakfast,"Coffee","1 cup",5.0,"Beverages"'
        ].join('\n');

        await DataImporter.import('servings.csv', csv);

        let rows = dbService.query('SELECT * FROM nutrition_servings');
        assert.strictEqual(rows.length, 3, 'Same-time servings should all be stored');

        await DataImporter.import('servings.csv', csv);

        rows = dbService.query('SELECT * FROM nutrition_servings');
        assert.strictEqual(rows.length, 3, 'Re-import should neither collapse nor duplicate servings');

        const coffees = dbService.query("SELECT * FROM nutrition_servings WHERE food_name = 'Coffee'");
        assert.strictEqual(coffees.length, 2);
    });

    await t.test('inserts PGE daily aggregates created by postProcess', async () => {
        const pgeCsv = [
            'TYPE,DATE,START TIME,END TIME,IMPORT (kWh),EXPORT (kWh),COST,NOTES',
            'Electric usage,2025-04-01,00:00,00:59,0.46,0.00,$0.16',
            'Electric usage,2025-04-01,01:00,01:59,0.54,0.00,$0.20'
        ].join('\n');

        const result = await DataImporter.import('pge.csv', pgeCsv);
        assert.strictEqual(result.errors, 0);

        const daily = dbService.query('SELECT * FROM electricity_grid_daily');
        assert.strictEqual(daily.length, 1, 'postProcess daily aggregate should be inserted');
        assert.ok(Math.abs(daily[0].import_kwh - 1.0) < 1e-9);
        assert.ok(Math.abs(daily[0].cost - 0.36) < 1e-9);
        assert.strictEqual(daily[0].source, 'pge');
    });

    await t.test('merges PGE and Tesla data for the same hour without losing either', async () => {
        const pgeCsv = [
            'TYPE,DATE,START TIME,END TIME,IMPORT (kWh),EXPORT (kWh),COST,NOTES',
            'Electric usage,2025-03-01,00:00,00:59,0.46,0.00,$0.16'
        ].join('\n');
        const teslaCsv = [
            'Date time,Home (kWh),Vehicle (kWh),From Powerwall (kWh),Solar Energy (kWh),From Grid (kWh),To Grid (kWh)',
            '2025-03-01T00:00:00,1.2,0.0,0.5,0.0,0.4,0.0'
        ].join('\n');

        await DataImporter.import('pge.csv', pgeCsv);
        await DataImporter.import('tesla.csv', teslaCsv);

        const ts = new Date('2025-03-01T00:00:00').getTime();
        const rows = dbService.query('SELECT * FROM electricity_hourly WHERE timestamp = ?', [ts]);
        assert.strictEqual(rows.length, 1, 'PGE and Tesla data should merge into one hourly row');
        assert.strictEqual(rows[0].cost, 0.16, 'PGE cost should survive the Tesla import');
        assert.strictEqual(rows[0].home_consumption_kwh, 1.2, 'Tesla data should be merged in');
    });
});
