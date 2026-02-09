# Data Importers

The application supports importing data from various CSV/JSON sources. Below is a list of supported importers and their details.

## Energy

### PG&E (Pacific Gas and Electric)
*   **File Type**: CSV
*   **Detection**: Checks for columns `TYPE` and `START TIME` (or `Electric usage`).
*   **Data Processed**:
    *   **Electric usage**: Imports into `electricity_hourly` table. Maps `IMPORT (kWh)` to `grid_import_kwh` and `EXPORT (kWh)` to `grid_export_kwh`. Post-processes to create daily summaries in `electricity_grid_daily`.
    *   **Natural gas usage**: Imports into `gas_daily` table. Maps `USAGE (therms)` or `Usage` to `usage_therms`.

### Tesla
*   **File Type**: CSV (Tesla App Export)
*   **Detection**: Checks for `Solar Energy` related columns.
*   **Data Processed**:
    *   Imports into `electricity_hourly` table.
    *   `Solar Energy (kWh)` -> `solar_kwh`
    *   `Home (kWh)` -> `home_consumption_kwh`
    *   `Vehicle (kWh)` -> `vehicle_kwh`
    *   `From Grid (kWh)` -> `grid_import_kwh`
    *   `To Grid (kWh)` -> `grid_export_kwh`
    *   `From Powerwall (kWh)` -> `battery_kwh`

## Finance

### SFCU (Stanford Federal Credit Union)
*   **File Type**: CSV
*   **Detection**: Checks for columns `Account Number`, `Post Date`, and `Description`.
*   **Data Processed**:
    *   Imports into `transactions` table.
    *   Maps `Post Date` to `timestamp`.
    *   Maps `Description` to `description`.
    *   Parses `Debit` and `Credit` columns to `amount`.
    *   *Note*: Currently defaults `account_id` to 1.

## Health

### Withings
*   **File Type**: CSV (various exports)
*   **Detection**: Checks for specific columns like `Activity type`, `Weight (kg)`, `light (s)`, etc.
*   **Data Processed**:
    *   **Activities**: Maps all records from `activities.csv` to the `activities` table (Running, Cycling, Hiking, Walking sessions, etc.).
    *   **Steps**: Maps daily aggregates from `aggregates_steps.csv` to the `steps` table.
    *   **Weight**: Maps to `weight` table (`weight_kg`, `fat_mass_kg`, `bone_mass_kg`, `muscle_mass_kg`, `hydration_kg`).
    *   **Sleep**: Maps to `sleep` table (duration, stages, heart rate, snoring).
    *   **Blood Pressure**: Maps to `blood_pressure` table (systolic, diastolic, heart rate).
    *   **Height**: Maps to `height` table (`height_m`).
    *   **Temperature**: Maps to `body_temperature` table (`temperature_c`).

### Cronometer
*   **File Type**: CSV
*   **Detection**: Checks for `Energy (kcal)` and `Completed` (Daily Summary) or `Food Name` (Servings).
*   **Data Processed**:
    *   **Daily Summary**: Maps to `nutrition_daily` (energy, macros, vitamins, minerals).
    *   **Servings**: Maps to `nutrition_servings` (detailed per-food entries).

## Location

### Google Timeline
*   **File Type**: JSON (`Records.json` or `timeline.json`)
*   **Detection**: Checks for `semanticSegments` or `timelineObjects` properties.
*   **Data Processed**:
    *   Imports into `location` table.
    *   Extracts coordinates from `timelinePath` points and visits.

## Water

### Flume
*   **File Type**: CSV
*   **Detection**: Checks for columns `datetime` and `liters`.
*   **Data Processed**:
    *   Imports into `water_daily` table.
    *   `liters` -> `usage_liters`.
