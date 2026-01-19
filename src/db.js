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
            this.ensureSchema();
            this.tables = this.getTables();
            console.log('Database loaded with tables:', this.tables);

            return true;
        } catch (error) {
            console.error('Database connection error:', error);
            throw error;
        }
    }

    async ensureInitialized() {
        if (this.db) {
            this.ensureSchema();
            return;
        }
        console.log('Initializing new empty database...');
        try {
            const SQL = await initSqlJs({
                locateFile: filename => `https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.8.0/${filename}`
            });
            this.db = new SQL.Database();
            this.ensureSchema();
            this.tables = this.getTables();
            console.log('New database initialized.');
        } catch (error) {
            console.error('Failed to initialize empty database:', error);
            throw error;
        }
    }

    ensureSchema() {
        if (!this.db) return;

        // Define schemas matching create_demo_db
        const schemas = [
            `CREATE TABLE IF NOT EXISTS location_history (id INTEGER PRIMARY KEY, lat REAL, lng REAL, timestamp TEXT)`,
            `CREATE TABLE IF NOT EXISTS weight (id INTEGER PRIMARY KEY, value REAL, timestamp TEXT)`,
            `CREATE TABLE IF NOT EXISTS sleep (id INTEGER PRIMARY KEY, value REAL, timestamp TEXT)`,
            `CREATE TABLE IF NOT EXISTS steps (id INTEGER PRIMARY KEY, value INTEGER, timestamp TEXT)`,
            `CREATE TABLE IF NOT EXISTS accounts (id INTEGER PRIMARY KEY, name TEXT, balance REAL, type TEXT)`,
            `CREATE TABLE IF NOT EXISTS transactions (id INTEGER PRIMARY KEY, timestamp TEXT, description TEXT, amount REAL, account_id INTEGER)`,
            `CREATE TABLE IF NOT EXISTS electricity_grid_hourly (id INTEGER PRIMARY KEY, timestamp TEXT, import_kwh REAL)`,
            `CREATE TABLE IF NOT EXISTS electricity_solar_hourly (id INTEGER PRIMARY KEY, timestamp TEXT, solar_kwh REAL, consumption_kwh REAL)`,
            `CREATE TABLE IF NOT EXISTS gas_daily (id INTEGER PRIMARY KEY, timestamp TEXT, usage_therms REAL)`,
            `CREATE TABLE IF NOT EXISTS movies (id INTEGER PRIMARY KEY, title TEXT, year INTEGER, rating INTEGER, timestamp TEXT, poster_url TEXT)`
        ];

        schemas.forEach(sql => this.db.run(sql));
        this.tables = this.getTables();
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

    export() {
        if (!this.db) throw new Error("Database not connected");
        return this.db.export();
    }
}

export const dbService = new DatabaseService();
