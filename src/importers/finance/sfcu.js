import { BaseImporter } from '../base-importer.js';

export class SfcuImporter extends BaseImporter {
    static get source() {
        return 'sfcu';
    }
    static detect(rows) {
        if (!rows || !Array.isArray(rows) || rows.length === 0) return false;
        const keys = Object.keys(rows[0]);
        return keys.includes('Account Number') && keys.includes('Post Date') && keys.includes('Description');
    }

    static mapRow(row) {
        const dateStr = row['Post Date'];
        if (!dateStr) return null;

        const isoDate = new Date(dateStr).getTime();
        const description = row['Description'];

        // Parse amount (Debit or Credit). Amounts may be formatted with
        // currency symbols and thousands separators (e.g. "$1,234.56"),
        // which parseFloat would silently truncate at the first comma.
        const parseAmount = (value) => {
            const cleaned = value.toString().replace(/[$,\s]/g, '');
            const parsed = parseFloat(cleaned);
            return isNaN(parsed) ? null : parsed;
        };

        let amount = 0;
        if (row['Debit']) {
            const debit = parseAmount(row['Debit']);
            if (debit === null) return null;
            amount = -1 * debit;
        } else if (row['Credit']) {
            const credit = parseAmount(row['Credit']);
            if (credit === null) return null;
            amount = credit;
        }

        return {
            table: 'transactions',
            data: {
                timestamp: isoDate,
                description: description,
                amount: amount,
                // category: ... logic todo
                account_id: 1 // Default for import
            }
        };
    }

    static getTable() {
        return 'transactions';
    }
}
