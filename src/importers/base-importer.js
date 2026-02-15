/**
 * Abstract Base Importer
 */
export class BaseImporter {
    /**
     * @param {Array<Object>} rows - Parsed CSV rows
     * @returns {boolean} - True if this importer can handle the data
     */
    static detect(rows) {
        throw new Error("method 'detect' must be implemented");
    }

    /**
     * @param {Object} row - Single CSV row object
     * @returns {Object|null} - Mapped data object or null if row is invalid
     */
    static mapRow(row) {
        throw new Error("method 'mapRow' must be implemented");
    }

    /**
     * @returns {string} - The name of the table to insert into ('electricity', 'transactions', etc.)
     */
    static getTable() {
        return 'electricity';
    }

    /**
     * @returns {string|null} - The source identifier (e.g. 'withings', 'pge')
     */
    static get source() {
        return null;
    }
    /**
     * Optional hook to process items after mapping but before insertion.
     * Useful for aggregation or cross-table logic.
     * @param {Object} itemsByTable - Map of table name to array of data objects
     * @returns {Object} - Updated itemsByTable
     */
    static postProcess(itemsByTable) {
        return itemsByTable;
    }
}
