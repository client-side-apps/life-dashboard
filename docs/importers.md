# Data Importers

The application supports importing data from various CSV sources. Below is a list of supported importers and their details.

## Energy

### PG&E (Pacific Gas and Electric)
*   **File Type**: CSV
*   **Detection**: Checks for columns `TYPE` and `START TIME` (or `Electric usage`).
*   **Data Processed**:
    *   **Electric usage**: Imports into `electricity_grid_hourly` table. Maps `IMPORT (kWh)` to `import_kwh`. Timestamp mapped to `timestamp` (Unix ms).
    *   **Natural gas usage**: Imports into `gas_daily` table. Maps `USAGE (therms)` or `Usage` to `usage_therms`. Timestamp mapped to `timestamp` (Unix ms).

### Tesla
*   **File Type**: CSV (Tesla App Export)
*   **Detection**: Checks for `Solar Energy` related columns.
*   **Data Processed**:
    *   Imports into `electricity_solar_hourly` table.
    *   Maps `Solar Energy (kWh)` to `solar_kwh`.
    *   Maps `Home (kWh)` to `consumption_kwh`.
    *   Maps `Date time` to `timestamp` (Unix ms).

## Finance

### SFCU (Stanford Federal Credit Union)
*   **File Type**: CSV
*   **Detection**: Checks for columns `Account Number`, `Post Date`, and `Description`.
*   **Data Processed**:
    *   Imports into `transactions` table.
    *   Maps `Post Date` to `timestamp` (Unix timestamp in ms).
    *   Maps `Description` to `description`.
    *   Parses `Debit` (negative) and `Credit` (positive) columns to `amount`.
    *   *Note*: Currently defaults `account_id` to 1.

## Timeline

### Google Timeline (Location History)
*   **File Type**: JSON (`Records.json` or `timeline.json`)
*   **Detection**: Checks for `semanticSegments` or `timelineObjects` properties.
*   **Data Processed**:
    *   Imports into `location` table.
    *   Extracts coordinates from `timelinePath` points or visit locations.
    *   Maps `point` coordinates (lat, lng) and `time` to `timestamp`.
