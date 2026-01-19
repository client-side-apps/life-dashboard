# Data Importers

The application supports importing data from various CSV sources. Below is a list of supported importers and their details.

## Energy

### PG&E (Pacific Gas and Electric)
*   **File Type**: CSV
*   **Detection**: Checks for columns `TYPE` and `START TIME` (or `Electric usage`).
*   **Data Processed**:
    *   **Electric usage**: Imports into `electricity_grid_hourly` table. Maps `IMPORT (kWh)` to `import_kwh`.
    *   **Natural gas usage**: Imports into `gas_daily` table. Maps `USAGE (therms)` or `Usage` to `usage_therms`.

### Tesla
*   **File Type**: CSV (Tesla App Export)
*   **Detection**: Checks for `Solar Energy` related columns.
*   **Data Processed**:
    *   Imports into `electricity_solar_hourly` table.
    *   Maps `Solar Energy (kWh)` to `solar_kwh`.
    *   Maps `Home (kWh)` to `consumption_kwh`.

## Finance

### SFCU (Stanford Federal Credit Union)
*   **File Type**: CSV
*   **Detection**: Checks for columns `Account Number`, `Post Date`, and `Description`.
*   **Data Processed**:
    *   Imports into `transactions` table.
    *   Maps `Post Date` to `date`.
    *   Maps `Description` to `description`.
    *   Parses `Debit` (negative) and `Credit` (positive) columns to `amount`.
    *   *Note*: Currently defaults `account_id` to 1.
