// import initSqlJs from 'sql.js'; // Loaded via script tag in index.html

class DatabaseService {
    constructor() {
        this.db = null;
        this.tables = [];
        this.fileHandle = null;
    }

    setFileHandle(handle) {
        this.fileHandle = handle;
    }

    async saveToDisk() {
        if (!this.db) return false;
        if (!this.fileHandle) {
            console.warn('Cannot save to disk: No file handle available.');
            return false;
        }

        try {
            console.log('Exporting database for save...');
            const data = this.export();

            console.log('Writing to file...');
            const writable = await this.fileHandle.createWritable();
            await writable.write(data);
            await writable.close();
            console.log('Database saved successfully.');
            return true;
        } catch (error) {
            console.error('Failed to save database to disk:', error);
            throw error;
        }
    }

    async connect(file) {
        try {
            // initSqlJs is provided globally by the script tag
            const SQL = await initSqlJs({
                locateFile: filename => `https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.8.0/${filename}`
            });

            const arrayBuffer = await file.arrayBuffer();
            const uint8Array = new Uint8Array(arrayBuffer);

            this.db = new SQL.Database(uint8Array);

            // Load table list
            this.ensureSchema();

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
        try {
            const SQL = await initSqlJs({
                locateFile: filename => `https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.8.0/${filename}`
            });
            this.db = new SQL.Database();
            this.ensureSchema();
        } catch (error) {
            console.error('Failed to initialize empty database:', error);
            throw error;
        }
    }

    ensureSchema() {
        if (!this.db) return;

        // Define schemas matching create_demo_db
        // Added 'source' column to all tables
        const schemas = [
            `CREATE TABLE IF NOT EXISTS location (id INTEGER PRIMARY KEY, timestamp INTEGER, lat REAL, lng REAL, source TEXT)`,
            `CREATE TABLE IF NOT EXISTS weight (id INTEGER PRIMARY KEY, timestamp INTEGER, weight_kg REAL, fat_mass_kg REAL, bone_mass_kg REAL, muscle_mass_kg REAL, hydration_kg REAL, source TEXT)`,
            `CREATE TABLE IF NOT EXISTS sleep (id INTEGER PRIMARY KEY, timestamp INTEGER, start_timestamp INTEGER, duration_hours REAL, light_seconds INTEGER, deep_seconds INTEGER, rem_seconds INTEGER, awake_seconds INTEGER, wake_up_seconds INTEGER, duration_to_sleep_seconds INTEGER, duration_to_wake_up_seconds INTEGER, snoring_seconds INTEGER, snoring_episodes INTEGER, average_heart_rate INTEGER, heart_rate_min INTEGER, heart_rate_max INTEGER, source TEXT)`,
            `CREATE TABLE IF NOT EXISTS steps (id INTEGER PRIMARY KEY, timestamp INTEGER, count INTEGER, type TEXT, distance REAL, calories REAL, source TEXT)`,
            `CREATE TABLE IF NOT EXISTS activities (id INTEGER PRIMARY KEY, timestamp INTEGER, end_timestamp INTEGER, type TEXT, calories REAL, distance REAL, steps INTEGER, elevation REAL, hr_average INTEGER, source TEXT)`,
            `CREATE TABLE IF NOT EXISTS accounts (id INTEGER PRIMARY KEY, name TEXT, balance REAL, type TEXT, source TEXT)`,
            `CREATE TABLE IF NOT EXISTS transactions (id INTEGER PRIMARY KEY, timestamp INTEGER, description TEXT, amount REAL, account_id INTEGER, source TEXT)`,
            `CREATE TABLE IF NOT EXISTS electricity_hourly (id INTEGER PRIMARY KEY, timestamp INTEGER, grid_import_kwh REAL, grid_export_kwh REAL, solar_kwh REAL, home_consumption_kwh REAL, vehicle_kwh REAL, battery_kwh REAL, cost REAL, source TEXT)`,
            `CREATE TABLE IF NOT EXISTS blood_pressure (id INTEGER PRIMARY KEY, timestamp INTEGER, systolic_mmhg INTEGER, diastolic_mmhg INTEGER, heart_rate_bpm INTEGER, source TEXT)`,
            `CREATE TABLE IF NOT EXISTS body_temperature (id INTEGER PRIMARY KEY, timestamp INTEGER, temperature_c REAL, source TEXT)`,
            `CREATE TABLE IF NOT EXISTS height (id INTEGER PRIMARY KEY, timestamp INTEGER, height_m REAL, source TEXT)`,
            `CREATE TABLE IF NOT EXISTS water_daily (id INTEGER PRIMARY KEY, timestamp INTEGER, usage_liters REAL, source TEXT)`,
            `CREATE TABLE IF NOT EXISTS nutrition_daily (
                id INTEGER PRIMARY KEY,
                timestamp INTEGER,
                energy_kcal REAL,
                alcohol_g REAL,
                caffeine_mg REAL,
                water_g REAL,
                b1_mg REAL,
                b2_mg REAL,
                b3_mg REAL,
                b5_mg REAL,
                b6_mg REAL,
                b12_ug REAL,
                folate_ug REAL,
                vitamin_a_ug REAL,
                vitamin_c_mg REAL,
                vitamin_d_iu REAL,
                vitamin_e_mg REAL,
                vitamin_k_ug REAL,
                calcium_mg REAL,
                copper_mg REAL,
                iron_mg REAL,
                magnesium_mg REAL,
                manganese_mg REAL,
                phosphorus_mg REAL,
                potassium_mg REAL,
                selenium_ug REAL,
                sodium_mg REAL,
                zinc_mg REAL,
                carbs_g REAL,
                fiber_g REAL,
                starch_g REAL,
                sugars_g REAL,
                added_sugars_g REAL,
                net_carbs_g REAL,
                fat_g REAL,
                cholesterol_mg REAL,
                monounsaturated_g REAL,
                polyunsaturated_g REAL,
                saturated_g REAL,
                trans_fats_g REAL,
                omega_3_g REAL,
                omega_6_g REAL,
                cystine_g REAL,
                histidine_g REAL,
                isoleucine_g REAL,
                leucine_g REAL,
                lysine_g REAL,
                methionine_g REAL,
                phenylalanine_g REAL,
                protein_g REAL,
                threonine_g REAL,
                tryptophan_g REAL,
                tyrosine_g REAL,
                valine_g REAL,
                completed INTEGER,
                source TEXT
            )`,
            `CREATE TABLE IF NOT EXISTS nutrition_servings (
                id INTEGER PRIMARY KEY,
                timestamp INTEGER,
                meal_group TEXT,
                food_name TEXT,
                amount TEXT,
                category TEXT,
                energy_kcal REAL,
                alcohol_g REAL,
                caffeine_mg REAL,
                water_g REAL,
                b1_mg REAL,
                b2_mg REAL,
                b3_mg REAL,
                b5_mg REAL,
                b6_mg REAL,
                b12_ug REAL,
                folate_ug REAL,
                vitamin_a_ug REAL,
                vitamin_c_mg REAL,
                vitamin_d_iu REAL,
                vitamin_e_mg REAL,
                vitamin_k_ug REAL,
                calcium_mg REAL,
                copper_mg REAL,
                iron_mg REAL,
                magnesium_mg REAL,
                manganese_mg REAL,
                phosphorus_mg REAL,
                potassium_mg REAL,
                selenium_ug REAL,
                sodium_mg REAL,
                zinc_mg REAL,
                carbs_g REAL,
                fiber_g REAL,
                starch_g REAL,
                sugars_g REAL,
                added_sugars_g REAL,
                net_carbs_g REAL,
                fat_g REAL,
                cholesterol_mg REAL,
                monounsaturated_g REAL,
                polyunsaturated_g REAL,
                saturated_g REAL,
                trans_fats_g REAL,
                omega_3_g REAL,
                omega_6_g REAL,
                cystine_g REAL,
                histidine_g REAL,
                isoleucine_g REAL,
                leucine_g REAL,
                lysine_g REAL,
                methionine_g REAL,
                phenylalanine_g REAL,
                protein_g REAL,
                threonine_g REAL,
                tryptophan_g REAL,
                tyrosine_g REAL,
                valine_g REAL,
                source TEXT
            )`
        ];

        // Create indexes for performance
        const indexes = [
            `CREATE INDEX IF NOT EXISTS idx_location_timestamp ON location (timestamp)`,
            `CREATE INDEX IF NOT EXISTS idx_steps_timestamp ON steps (timestamp)`,

            `CREATE INDEX IF NOT EXISTS idx_weight_timestamp ON weight (timestamp)`,
            `CREATE INDEX IF NOT EXISTS idx_sleep_timestamp ON sleep (timestamp)`,
            `CREATE INDEX IF NOT EXISTS idx_steps_timestamp ON steps (timestamp)`,
            `CREATE INDEX IF NOT EXISTS idx_transactions_timestamp ON transactions (timestamp)`,
            `CREATE INDEX IF NOT EXISTS idx_electricity_hourly_timestamp ON electricity_hourly (timestamp)`,
            `CREATE INDEX IF NOT EXISTS idx_blood_pressure_timestamp ON blood_pressure (timestamp)`,
            `CREATE INDEX IF NOT EXISTS idx_body_temperature_timestamp ON body_temperature (timestamp)`,
            `CREATE INDEX IF NOT EXISTS idx_height_timestamp ON height (timestamp)`,
            `CREATE INDEX IF NOT EXISTS idx_water_daily_timestamp ON water_daily (timestamp)`,
            `CREATE INDEX IF NOT EXISTS idx_nutrition_daily_timestamp ON nutrition_daily (timestamp)`,
            `CREATE INDEX IF NOT EXISTS idx_nutrition_servings_timestamp ON nutrition_servings (timestamp)`
        ];

        schemas.forEach(sql => this.db.run(sql));
        indexes.forEach(sql => this.db.run(sql));

        // Migration: Add 'source' column to existing tables if missing
        this.refreshTables(); // Ensure this.tables is populated
        const tablesToMigrate = [
            'location', 'weight', 'sleep', 'steps', 'activities', 'accounts',
            'transactions', 'electricity_hourly', 'blood_pressure',
            'body_temperature', 'height', 'water_daily', 'nutrition_daily', 'nutrition_servings'
        ];

        tablesToMigrate.forEach(table => {
            if (this.tables.includes(table)) {
                try {
                    // Check if column exists
                    const cols = this.db.exec(`PRAGMA table_info("${table}")`);
                    if (cols.length > 0) {
                        const hasSource = cols[0].values.some(row => row[1] === 'source');
                        if (!hasSource) {
                            console.log(`Migrating table ${table}: adding source column`);
                            this.db.run(`ALTER TABLE "${table}" ADD COLUMN source TEXT`);
                        }
                    }
                } catch (e) {
                    console.error(`Failed to migrate table ${table}`, e);
                }
            }
        });

        this.refreshTables();
    }

    query(sql, params = []) {
        if (!this.db) throw new Error("Database not connected");

        // Use exec for simple queries or prepare/bind for params
        // sql.js exec returns [{columns, values}]
        // We want to return an array of objects for easier consumption

        // Check for modification to notify listeners (e.g. for dirty state)
        const upperSql = sql.trim().toUpperCase();
        const isSchemaChange = upperSql.startsWith('CREATE') || upperSql.startsWith('DROP') || upperSql.startsWith('ALTER');

        if (upperSql.startsWith('INSERT') || upperSql.startsWith('UPDATE') ||
            upperSql.startsWith('DELETE') || isSchemaChange) {
            this.notifyModification();
        }

        try {
            let results;
            if (params.length > 0) {
                const stmt = this.db.prepare(sql);
                stmt.bind(params);
                results = [];
                while (stmt.step()) {
                    results.push(stmt.getAsObject());
                }
                stmt.free();
            } else {
                const result = this.db.exec(sql);
                if (!result || result.length === 0) {
                    results = [];
                } else {
                    const columns = result[0].columns;
                    const values = result[0].values;

                    results = values.map(row => {
                        const obj = {};
                        columns.forEach((col, index) => {
                            obj[col] = row[index];
                        });
                        return obj;
                    });
                }
            }

            if (isSchemaChange) {
                this.refreshTables();
            }

            return results;
        } catch (error) {
            console.error('Query error:', error);
            return [];
        }
    }

    refreshTables() {
        if (!this.db) {
            this.tables = [];
            return [];
        }
        const result = this.query("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'");
        this.tables = result.map(row => row.name);
        return this.tables;
    }

    getTables() {
        return this.tables;
    }

    // Helper to get all data from a table
    getAll(tableName, limit = 1000) {
        return this.query(`SELECT * FROM "${tableName}" LIMIT ?`, [limit]);
    }

    export() {
        if (!this.db) throw new Error("Database not connected");
        return this.db.export();
    }

    set onModification(callback) {
        this._onModification = callback;
    }

    notifyModification() {
        if (this._onModification) {
            this._onModification();
        }
    }
}

export const dbService = new DatabaseService();
