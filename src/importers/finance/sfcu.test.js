import { test } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { SfcuImporter } from './sfcu.js';
import { CSVParser } from '../../../utils/csv-parser.js';

test('SfcuImporter with Real Data', async (t) => {
    const samplePath = path.resolve(import.meta.dirname, '../../../../data-samples/finance/sfcu/AccountHistory.csv');
    const content = fs.readFileSync(samplePath, 'utf-8');
    const rows = CSVParser.parse(content);

    await t.test('detects SFCU data from file content', () => {
        assert.ok(SfcuImporter.detect(rows));
    });

    await t.test('maps transaction rows correctly', () => {
        // "******3444",11/28/2025,,"ACH Debit WEB - BANK OF AMERICA  - MORTGAGE  14zs63czt",25000.00,,Posted,28828.67
        // Note: CSVParser should strip quotes from values

        const debitRow = rows.find(r => r['Description'] === 'ACH Debit WEB - BANK OF AMERICA  - MORTGAGE  14zs63czt');
        assert.ok(debitRow, 'Should find the debit row');

        const mappedDebit = SfcuImporter.mapRow(debitRow);
        assert.strictEqual(mappedDebit.data.amount, -25000.00);
        assert.strictEqual(mappedDebit.data.description, 'ACH Debit WEB - BANK OF AMERICA  - MORTGAGE  14zs63czt');

        // "******3444",11/27/2025,,"Deposit Online Transfer from Savings Regular 3435",,10000.00,Posted,53828.67
        const creditRow = rows.find(r => r['Description'] === 'Deposit Online Transfer from Savings Regular 3435');
        assert.ok(creditRow, 'Should find the credit row');

        const mappedCredit = SfcuImporter.mapRow(creditRow);
        assert.strictEqual(mappedCredit.data.amount, 10000.00);
    });
});
