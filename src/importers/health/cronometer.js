import { BaseImporter } from '../base-importer.js';

export class CronometerImporter extends BaseImporter {
    static get source() {
        return 'cronometer';
    }
    static detect(rows) {
        if (!rows || !Array.isArray(rows) || rows.length === 0) return false;
        const first = rows[0];

        // Daily Summary has 'Date' and 'Completed' (boolean)
        const isDaily = 'Date' in first && 'Completed' in first && 'Energy (kcal)' in first;

        // Servings has 'Day', 'Time', 'Group', 'Food Name'
        const isServings = 'Day' in first && 'Time' in first && 'Group' in first && 'Food Name' in first;

        return isDaily || isServings;
    }

    static getTable() {
        return null; // Dynamic
    }

    static mapRow(row) {
        // Shared column mapping
        // CSV Header -> DB Column
        const nutrientMap = {
            'Energy (kcal)': 'energy_kcal',
            'Alcohol (g)': 'alcohol_g',
            'Caffeine (mg)': 'caffeine_mg',
            'Water (g)': 'water_g',
            'B1 (Thiamine) (mg)': 'b1_mg',
            'B2 (Riboflavin) (mg)': 'b2_mg',
            'B3 (Niacin) (mg)': 'b3_mg',
            'B5 (Pantothenic Acid) (mg)': 'b5_mg',
            'B6 (Pyridoxine) (mg)': 'b6_mg',
            'B12 (Cobalamin) (µg)': 'b12_ug',
            'Folate (µg)': 'folate_ug',
            'Vitamin A (µg)': 'vitamin_a_ug',
            'Vitamin C (mg)': 'vitamin_c_mg',
            'Vitamin D (IU)': 'vitamin_d_iu',
            'Vitamin E (mg)': 'vitamin_e_mg',
            'Vitamin K (µg)': 'vitamin_k_ug',
            'Calcium (mg)': 'calcium_mg',
            'Copper (mg)': 'copper_mg',
            'Iron (mg)': 'iron_mg',
            'Magnesium (mg)': 'magnesium_mg',
            'Manganese (mg)': 'manganese_mg',
            'Phosphorus (mg)': 'phosphorus_mg',
            'Potassium (mg)': 'potassium_mg',
            'Selenium (µg)': 'selenium_ug',
            'Sodium (mg)': 'sodium_mg',
            'Zinc (mg)': 'zinc_mg',
            'Carbs (g)': 'carbs_g',
            'Fiber (g)': 'fiber_g',
            'Starch (g)': 'starch_g',
            'Sugars (g)': 'sugars_g',
            'Added Sugars (g)': 'added_sugars_g',
            'Net Carbs (g)': 'net_carbs_g',
            'Fat (g)': 'fat_g',
            'Cholesterol (mg)': 'cholesterol_mg',
            'Monounsaturated (g)': 'monounsaturated_g',
            'Polyunsaturated (g)': 'polyunsaturated_g',
            'Saturated (g)': 'saturated_g',
            'Trans-Fats (g)': 'trans_fats_g',
            'Omega-3 (g)': 'omega_3_g',
            'Omega-6 (g)': 'omega_6_g',
            'Cystine (g)': 'cystine_g',
            'Histidine (g)': 'histidine_g',
            'Isoleucine (g)': 'isoleucine_g',
            'Leucine (g)': 'leucine_g',
            'Lysine (g)': 'lysine_g',
            'Methionine (g)': 'methionine_g',
            'Phenylalanine (g)': 'phenylalanine_g',
            'Protein (g)': 'protein_g',
            'Threonine (g)': 'threonine_g',
            'Tryptophan (g)': 'tryptophan_g',
            'Tyrosine (g)': 'tyrosine_g',
            'Valine (g)': 'valine_g'
        };

        const mapNutrients = (sourceRow) => {
            const data = {};
            for (const [csvHeader, dbCol] of Object.entries(nutrientMap)) {
                if (csvHeader in sourceRow && sourceRow[csvHeader] !== '') {
                    data[dbCol] = parseFloat(sourceRow[csvHeader]);
                } else {
                    data[dbCol] = 0; // Default to 0 if missing/empty? Or null? Database schema allows NULL but REAL implies numbers. 
                    // Let's use 0 for nutritional values as missing often means 0 in these exports, 
                    // or keep it null if we want to distinguish "no data".
                    // Cronometer CSVs usually have empty string for 0 or missing.
                    // Given the schema is REAL, null is valid. 
                    // However, for charts, 0 is easier. Let's start with 0 if it parses to NaN.
                }
            }
            return data;
        };

        // 1. Daily Summary
        if ('Date' in row && 'Completed' in row) {
            const data = mapNutrients(row);
            data.timestamp = new Date(row.Date).getTime();

            if (!data.timestamp || isNaN(data.timestamp)) return null;

            return {
                table: 'nutrition_daily',
                data: data
            };
        }

        // 2. Servings
        if ('Day' in row && 'Time' in row) {
            const data = mapNutrients(row);
            // Combine Day and Time
            // Day: 2026-01-08, Time: 7:13 AM
            const timeStr = row.Time || '00:00 AM';
            const dateStr = `${row.Day} ${timeStr}`;
            data.timestamp = new Date(dateStr).getTime();

            data.meal_group = row.Group;
            data.food_name = row['Food Name'];
            data.amount = row.Amount;
            data.category = row.Category;

            if (!data.timestamp || isNaN(data.timestamp)) return null;

            return {
                table: 'nutrition_servings',
                data: data
            };
        }

        return null;
    }
}
