/**
 * Abstract Base Importer
 */
export class BaseImporter {
    /**
     * @param {Array<Object>} rows - Parsed CSV rows
     * @returns {boolean} - True if this importer can handle the data
     */
    static detect(rows) {
        throw new Error("mthod 'detect' must be implemented");
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
}
