// import initSqlJs from 'sql.js'; // Loaded via script tag in index.html

class DatabaseService {
    constructor() {
        this.db = null;
        this.tables = [];
    }

    async connect(file) {
        try {
            console.log('Initializing SQL.js...');
            // initSqlJs is provided globally by the script tag
            const SQL = await initSqlJs({
                locateFile: filename => `https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.8.0/${filename}`
            });

            console.log('Reading file...');
            const arrayBuffer = await file.arrayBuffer();
            const uint8Array = new Uint8Array(arrayBuffer);

            console.log('Creating database instance...');
            this.db = new SQL.Database(uint8Array);

            // Load table list
            this.tables = this.getTables();
            console.log('Database loaded with tables:', this.tables);

            return true;
        } catch (error) {
            console.error('Database connection error:', error);
            throw error;
        }
    }

    query(sql, params = []) {
        if (!this.db) throw new Error("Database not connected");

        // Use exec for simple queries or prepare/bind for params
        // sql.js exec returns [{columns, values}]
        // We want to return an array of objects for easier consumption

        try {
            if (params.length > 0) {
                const stmt = this.db.prepare(sql);
                stmt.bind(params);
                const results = [];
                while (stmt.step()) {
                    results.push(stmt.getAsObject());
                }
                stmt.free();
                return results;
            } else {
                const result = this.db.exec(sql);
                if (!result || result.length === 0) return [];

                const columns = result[0].columns;
                const values = result[0].values;

                return values.map(row => {
                    const obj = {};
                    columns.forEach((col, index) => {
                        obj[col] = row[index];
                    });
                    return obj;
                });
            }
        } catch (error) {
            console.error('Query error:', error);
            return [];
        }
    }

    getTables() {
        if (!this.db) return [];
        const result = this.query("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'");
        return result.map(row => row.name);
    }

    // Helper to get all data from a table
    getAll(tableName, limit = 1000) {
        return this.query(`SELECT * FROM "${tableName}" LIMIT ?`, [limit]);
    }
}

export const dbService = new DatabaseService();
