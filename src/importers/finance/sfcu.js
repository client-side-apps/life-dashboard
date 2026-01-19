import { BaseImporter } from '../base-importer.js';

export class SfcuImporter extends BaseImporter {
    static detect(rows) {
        if (!rows || rows.length === 0) return false;
        const keys = Object.keys(rows[0]);
        return keys.includes('Account Number') && keys.includes('Post Date') && keys.includes('Description');
    }

    static mapRow(row) {
        const dateStr = row['Post Date'];
        if (!dateStr) return null;

        const isoDate = new Date(dateStr).getTime();
        const description = row['Description'];

        // Parse amount (Debit or Credit)
        let amount = 0;
        if (row['Debit']) {
            amount = -1 * parseFloat(row['Debit']);
        } else if (row['Credit']) {
            amount = parseFloat(row['Credit']);
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
