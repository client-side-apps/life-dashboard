import { CronometerImporter } from './cronometer.js';
import { CSVParser } from '../../utils/csv-parser.js';
import { readFileSync } from 'fs';
import { describe, it } from 'node:test';
import assert from 'node:assert';

describe('CronometerImporter', () => {

    it('should detect and parse daily summary data', () => {
        const content = readFileSync('data-samples/health/cronometer/dailysummary.csv', 'utf8');
        const rows = CSVParser.parse(content);

        assert.ok(CronometerImporter.detect(rows), 'Should detect daily summary CSV');

        const mapped = rows.map(row => CronometerImporter.mapRow(row)).filter(r => r);
        assert.strictEqual(mapped.length, 365, 'Should parse 365 rows');

        const first = mapped[0];
        assert.strictEqual(first.table, 'nutrition_daily');
        assert.strictEqual(new Date(first.data.timestamp).toISOString().split('T')[0], '2025-01-01');
        assert.strictEqual(first.data.energy_kcal, 2244.85);
        assert.strictEqual(first.data.protein_g, 147.34);
        assert.strictEqual(first.data.completed, 1);
    });

    it('should detect and parse servings data', () => {
        const content = readFileSync('data-samples/health/cronometer/servings.csv', 'utf8');
        const rows = CSVParser.parse(content);

        assert.ok(CronometerImporter.detect(rows), 'Should detect servings CSV');

        const mapped = rows.map(row => CronometerImporter.mapRow(row)).filter(r => r);
        assert.strictEqual(mapped.length, 4, 'Should parse 4 rows');

        const first = mapped[0];
        assert.strictEqual(first.table, 'nutrition_servings');
        // 2026-02-07 08:00 AM
        assert.strictEqual(first.data.meal_group, 'Breakfast');
        assert.strictEqual(first.data.food_name, 'Oatmeal');
        assert.strictEqual(first.data.energy_kcal, 150.0);
    });

    it('should not fabricate zeros for nutrient columns absent from the export', () => {
        const row = { 'Date': '2026-01-01', 'Completed': 'true', 'Energy (kcal)': '2000', 'Protein (g)': '' };
        const mapped = CronometerImporter.mapRow(row);

        assert.strictEqual(mapped.data.energy_kcal, 2000);
        // Present-but-empty column is a tracked zero
        assert.strictEqual(mapped.data.protein_g, 0);
        // Absent column stays absent (NULL in DB) so a merge re-import
        // cannot overwrite real values with zeros
        assert.ok(!('carbs_g' in mapped.data), 'Absent nutrient should be omitted, not set to 0');
    });

    it('should handle BOM in CSVParser (Integration check)', () => {
        const content = '\uFEFFDate,Energy (kcal),Completed\n2026-01-01,2000,true';
        const rows = CSVParser.parse(content);
        assert.strictEqual(rows.length, 1);
        assert.ok('Date' in rows[0], 'Header should be Date, not \\uFEFFDate');
    });
});
