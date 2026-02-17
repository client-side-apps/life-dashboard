# Contributing

Thank you for your interest in contributing! This guide outlines the process for adding support for new data types and visualizations.

## Adding a New Data Type

To add support for a new data source (e.g., a new health export, financial institution, or activity tracker), you need to follow these steps to ensure the data is correctly imported, stored, and visualized.

### 1. Update Documentation
*   **Files**: `docs/schema.md` and `docs/importers.md`
*   **Action**: 
    *   In `schema.md`, document the new table schema or changes to existing tables. Include column names, types, and descriptions.
    *   In `importers.md`, describe the new importer, including file type, detection logic, and how data is mapped.

### 2. Add Sample Data
*   **Directory**: `data-samples/`
*   **Action**: Add a sample file (CSV or JSON) of the data you want to import.
    *   Place it in the appropriate subdirectory (e.g., `health/`, `finance/`).
    *   Ensure the sample contains representative data (**covering the year 2025**) but **no sensitive personal information** (sanitize it if necessary).

### 3. Define Database Schema
You need to define the SQLite table structure in two places:
1.  **Demo Generation Script**: `create_demo_db/index.js`
    *   Add a `CREATE TABLE` statement in the `run()` function.
    *   Update the `insertData` function to handle inserts into this new table.
2.  **Application Database Service**: `src/db.js`
    *   Add the same `CREATE TABLE` statement to the `schemas` array in `ensureSchema()`.
    *   Add any necessary indices to the `indexes` array.
    *   Add the table name to `tablesToMigrate` if you are adding a `source` column to an existing table.

### 4. Create an Importer & Test
Create a new importer class to parse your data file and a corresponding test.

#### Importer implementation
*   **Directory**: `src/importers/<category>/` (e.g., `src/importers/health/my-new-device.js`)
*   **Base Class**: Extend `BaseImporter` (import from `../base-importer.js`).
*   **Implementation**:
    *   `static detect(rows)`: Return `true` if the file headers or content match your data format.
    *   `static mapRow(row)`: Transform a raw CSV/JSON row into a database object. Return an object with `table` and `data` properties.
        *   `table`: The name of the target table.
        *   `data`: An object matching the table columns. Timestamps should be in Unix milliseconds.
    *   `static postProcess(itemsByTable)`: (Optional) generic aggregation or post-processing if needed.

#### Test implementation
*   **Directory**: Same as the importer (e.g., `src/importers/health/`)
*   **File**: Create a new test file named `<importer>.test.js` (e.g., `my-new-device.test.js`).
*   **Content**: Use `node:test` and `node:assert` to verify:
    *   The `detect` method works for your sample file.
    *   The `mapRow` method correctly extracts fields and converts timestamps.
*   **Run Tests**:
    ```bash
    node --test src/importers/health/my-new-device.test.js
    ```

### 5. Register the Importer
You must register your new importer in two services:
1.  **Demo Generator**: `create_demo_db/index.js`
    *   Import your class.
    *   Add it to the `importers` array.
2.  **App Data Importer**: `src/services/data-importer.js`
    *   Import your class.
    *   Add it to the `static importers` array.
    *   **Crucial**: Update the `insert` method (and potentially `findExisting`) to handle writing your new data object to the database.

### 6. Regenerate Demo Database
Test your changes by regenerating the demo database with your new sample data.
```bash
node create_demo_db/index.js
```
Verify that `demo.sqlite` is created and contains your data.

### 7. Visualize Data
Now that the data is in the database, you can display it in the UI.

#### Add a Dashboard or Chart
*   **Directory**: `src/views/`
*   **Action**:
    *   Modify an existing view (e.g., `health-view.js`) or create a new one.
    *   Use `src/components/chart-card/chart-card.js` for consistent charting.
    *   Fetch data using `dataRepository` or `dbService`.

#### Add to Timeline View
*   **File**: `src/views/timeline-view.js`
*   **Action**: Update the `loadData()` method.
    *   Add a new fetch block using `dataRepository.getDateRangeData('your_table', ...)`
    *   Map the results to event objects (timestamp, type, title, details) and push them to the `events` array.


## Guidelines
*   **Dates**: Always use Unix timestamps (milliseconds) for storage.
*   **Source**: Ensure your importer sets or passes a `source` identifier so users know where the data came from.
*   **Idempotency**: Importers should handle duplicates gracefully if possible, or rely on the `DataImporter` logic to skip existing records.
