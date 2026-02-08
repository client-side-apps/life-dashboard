import { test } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { SfcuImporter } from './sfcu.js';
import { CSVParser } from '../../utils/csv-parser.js';

test('SfcuImporter with Real Data', async (t) => {
    const samplePath = path.resolve(import.meta.dirname, '../../../data-samples/finance/sfcu/AccountHistory.csv');
    const content = fs.readFileSync(samplePath, 'utf-8');
    const rows = CSVParser.parse(content);

    await t.test('detects SFCU data from file content', () => {
        assert.ok(SfcuImporter.detect(rows));
    });

    await t.test('maps transaction rows correctly', () => {
        // "******3444",12/1/2025,,"ACH Debit Property Mgmt - RENT",1800.00,,Posted,37583.29
        const debitRow = rows.find(r => r['Description'] === 'ACH Debit Property Mgmt - RENT' && r['Post Date'] === '12/1/2025');
        assert.ok(debitRow, 'Should find the debit row');

        const mappedDebit = SfcuImporter.mapRow(debitRow);
        assert.strictEqual(mappedDebit.data.amount, -1800.00);
        assert.strictEqual(mappedDebit.data.description, 'ACH Debit Property Mgmt - RENT');

        // "******3444",12/1/2025,,"ACH Credit Tech Corp Inc - PAYROLL",,2500.00,Posted,39383.29
        const creditRow = rows.find(r => r['Description'] === 'ACH Credit Tech Corp Inc - PAYROLL' && r['Post Date'] === '12/1/2025');
        assert.ok(creditRow, 'Should find the credit row');

        const mappedCredit = SfcuImporter.mapRow(creditRow);
        assert.strictEqual(mappedCredit.data.amount, 2500.00);
    });
});
