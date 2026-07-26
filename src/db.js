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
                locateFile: filename => `vendor/${filename}`
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

    async connectNode(dbPath) {
        try {
            const { DatabaseSync } = await import('node:sqlite');
            this.db = new DatabaseSync(dbPath);
            this.isNode = true;
            this.ensureSchema();
            return true;
        } catch (error) {
            console.error('Database connection error (Node):', error);
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
                locateFile: filename => `vendor/${filename}`
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

        // Migration: the 'blood_pressure' table was renamed to 'heart' since it
        // also stores heart-rate-only measurements. Rename before the CREATE
        // TABLE statements run, so existing data moves to the new name instead
        // of being shadowed by a freshly created empty 'heart' table.
        this.refreshTables();
        if (this.tables.includes('blood_pressure') && !this.tables.includes('heart')) {
            console.log('Migrating table blood_pressure: renaming to heart');
            this.query('ALTER TABLE blood_pressure RENAME TO heart');
            this.query('DROP INDEX IF EXISTS idx_blood_pressure_timestamp');
        }

        // Define schemas matching create_demo_db
        // Added 'source' column and 'note' column to all tables
        const schemas = [
            `CREATE TABLE IF NOT EXISTS location (id INTEGER PRIMARY KEY, timestamp INTEGER, lat REAL, lng REAL, source TEXT, note TEXT)`,
            `CREATE TABLE IF NOT EXISTS weight (id INTEGER PRIMARY KEY, timestamp INTEGER, weight_kg REAL, fat_mass_kg REAL, bone_mass_kg REAL, muscle_mass_kg REAL, hydration_kg REAL, source TEXT, note TEXT)`,
            `CREATE TABLE IF NOT EXISTS sleep (id INTEGER PRIMARY KEY, timestamp INTEGER, start_timestamp INTEGER, duration_hours REAL, light_seconds INTEGER, deep_seconds INTEGER, rem_seconds INTEGER, awake_seconds INTEGER, wake_up_seconds INTEGER, duration_to_sleep_seconds INTEGER, duration_to_wake_up_seconds INTEGER, snoring_seconds INTEGER, snoring_episodes INTEGER, average_heart_rate INTEGER, heart_rate_min INTEGER, heart_rate_max INTEGER, source TEXT, note TEXT)`,
            `CREATE TABLE IF NOT EXISTS steps (id INTEGER PRIMARY KEY, timestamp INTEGER, count INTEGER, type TEXT, distance REAL, calories REAL, source TEXT, note TEXT)`,
            `CREATE TABLE IF NOT EXISTS activities (id INTEGER PRIMARY KEY, timestamp INTEGER, end_timestamp INTEGER, type TEXT, calories REAL, distance REAL, steps INTEGER, elevation REAL, hr_average INTEGER, source TEXT, note TEXT)`,
            `CREATE TABLE IF NOT EXISTS accounts (id INTEGER PRIMARY KEY, name TEXT, balance REAL, type TEXT, source TEXT, note TEXT)`,
            `CREATE TABLE IF NOT EXISTS transactions (id INTEGER PRIMARY KEY, timestamp INTEGER, description TEXT, amount REAL, account_id INTEGER, source TEXT, note TEXT)`,
            `CREATE TABLE IF NOT EXISTS electricity_hourly (id INTEGER PRIMARY KEY, timestamp INTEGER, grid_import_kwh REAL, grid_export_kwh REAL, solar_kwh REAL, home_consumption_kwh REAL, vehicle_kwh REAL, battery_kwh REAL, cost REAL, source TEXT, note TEXT)`,
            `CREATE TABLE IF NOT EXISTS electricity_grid_daily (id INTEGER PRIMARY KEY, timestamp INTEGER, import_kwh REAL, cost REAL, source TEXT, note TEXT)`,
            `CREATE TABLE IF NOT EXISTS gas_daily (id INTEGER PRIMARY KEY, timestamp INTEGER, usage_therms REAL, cost REAL, source TEXT, note TEXT)`,
            `CREATE TABLE IF NOT EXISTS heart (id INTEGER PRIMARY KEY, timestamp INTEGER, systolic_mmhg INTEGER, diastolic_mmhg INTEGER, heart_rate_bpm INTEGER, source TEXT, note TEXT)`,
            `CREATE TABLE IF NOT EXISTS body_temperature (id INTEGER PRIMARY KEY, timestamp INTEGER, temperature_c REAL, source TEXT, note TEXT)`,
            `CREATE TABLE IF NOT EXISTS height (id INTEGER PRIMARY KEY, timestamp INTEGER, height_m REAL, source TEXT, note TEXT)`,
            `CREATE TABLE IF NOT EXISTS water_daily (id INTEGER PRIMARY KEY, timestamp INTEGER, usage_liters REAL, source TEXT, note TEXT)`,
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
                source TEXT,
                note TEXT
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
                source TEXT,
                note TEXT
            )`,
            `CREATE TABLE IF NOT EXISTS music (
                id INTEGER PRIMARY KEY,
                timestamp INTEGER,
                track_name TEXT,
                artist_name TEXT,
                album_name TEXT,
                track_uri TEXT,
                duration_ms INTEGER,
                platform TEXT,
                source TEXT,
                note TEXT
            )`,
            `CREATE TABLE IF NOT EXISTS dives (
                id INTEGER PRIMARY KEY,
                timestamp INTEGER,
                dive_number INTEGER,
                spot TEXT,
                city TEXT,
                region TEXT,
                country TEXT,
                max_depth_meters REAL,
                duration_minutes REAL,
                water_temp_c REAL,
                dive_type TEXT,
                center TEXT,
                divers TEXT,
                total_divers INTEGER,
                source TEXT,
                note TEXT
            )`
        ];

        // Create indexes for performance
        const indexes = [
            `CREATE INDEX IF NOT EXISTS idx_location_timestamp ON location (timestamp)`,
            `CREATE INDEX IF NOT EXISTS idx_steps_timestamp ON steps (timestamp)`,
            `CREATE INDEX IF NOT EXISTS idx_weight_timestamp ON weight (timestamp)`,
            `CREATE INDEX IF NOT EXISTS idx_sleep_timestamp ON sleep (timestamp)`,
            `CREATE INDEX IF NOT EXISTS idx_transactions_timestamp ON transactions (timestamp)`,
            `CREATE INDEX IF NOT EXISTS idx_electricity_hourly_timestamp ON electricity_hourly (timestamp)`,
            `CREATE INDEX IF NOT EXISTS idx_electricity_grid_daily_timestamp ON electricity_grid_daily (timestamp)`,
            `CREATE INDEX IF NOT EXISTS idx_gas_daily_timestamp ON gas_daily (timestamp)`,
            `CREATE INDEX IF NOT EXISTS idx_heart_timestamp ON heart (timestamp)`,
            `CREATE INDEX IF NOT EXISTS idx_body_temperature_timestamp ON body_temperature (timestamp)`,
            `CREATE INDEX IF NOT EXISTS idx_height_timestamp ON height (timestamp)`,
            `CREATE INDEX IF NOT EXISTS idx_water_daily_timestamp ON water_daily (timestamp)`,
            `CREATE INDEX IF NOT EXISTS idx_nutrition_daily_timestamp ON nutrition_daily (timestamp)`,
            `CREATE INDEX IF NOT EXISTS idx_nutrition_servings_timestamp ON nutrition_servings (timestamp)`,
            `CREATE INDEX IF NOT EXISTS idx_music_timestamp ON music (timestamp)`,
            `CREATE INDEX IF NOT EXISTS idx_dives_timestamp ON dives (timestamp)`
        ];

        schemas.forEach(sql => this.query(sql));
        indexes.forEach(sql => this.query(sql));

        // Migration: Add 'source' and 'note' columns to existing tables if missing
        this.refreshTables(); // Ensure this.tables is populated
        const tablesToMigrate = [
            'location', 'weight', 'sleep', 'steps', 'activities', 'accounts',
            'transactions', 'electricity_hourly', 'electricity_grid_daily', 'gas_daily', 'heart',
            'body_temperature', 'height', 'water_daily', 'nutrition_daily', 'nutrition_servings', 'music', 'dives'
        ];

        tablesToMigrate.forEach(table => {
            if (this.tables.includes(table)) {
                try {
                    // Check if column exists
                    const cols = this.query(`PRAGMA table_info("${table}")`);
                    if (cols.length > 0) {
                        const hasSource = cols.some(row => row.name === 'source');
                        if (!hasSource) {
                            console.log(`Migrating table ${table}: adding source column`);
                            this.query(`ALTER TABLE "${table}" ADD COLUMN source TEXT`);
                        }
                        const hasNote = cols.some(row => row.name === 'note');
                        if (!hasNote) {
                            console.log(`Migrating table ${table}: adding note column`);
                            this.query(`ALTER TABLE "${table}" ADD COLUMN note TEXT`);
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
            if (this.isNode) {
                if (params.length === 0) {
                    if (upperSql.startsWith('SELECT') || upperSql.startsWith('PRAGMA')) {
                        const results = this.db.prepare(sql).all();
                        if (isSchemaChange) {
                            this.refreshTables();
                        }
                        return results;
                    } else {
                        this.db.exec(sql);
                        if (isSchemaChange) {
                            this.refreshTables();
                        }
                        return [];
                    }
                } else {
                    const stmt = this.db.prepare(sql);
                    if (upperSql.startsWith('SELECT') || upperSql.startsWith('PRAGMA')) {
                        const results = stmt.all(...params);
                        return results;
                    } else {
                        stmt.run(...params);
                        return [];
                    }
                }
            }

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
