# Database Schema

This document outlines the expected database schema for the Life Dashboard application. The application uses a SQLite database (via sql.js).

## Tables

### `location_history`
Stores daily history of location coordinates.

| Column | Type | Description |
| :--- | :--- | :--- |
| `id` | INTEGER | Primary Key |
| `lat` | REAL | Latitude |
| `lng` | REAL | Longitude |
| `timestamp` | INTEGER | Timestamp (Unix ms) |

### `weight`
Stores body weight measurements.

| Column | Type | Description |
| :--- | :--- | :--- |
| `id` | INTEGER | Primary Key |
| `value` | REAL | Weight value (e.g., in kg or lbs) |
| `timestamp` | INTEGER | Date/Time of measurement |

### `sleep`
Stores sleep duration or quality metrics.

| Column | Type | Description |
| :--- | :--- | :--- |
| `id` | INTEGER | Primary Key |
| `value` | REAL | Sleep duration (likely in hours) or score |
| `timestamp` | INTEGER | Date of sleep record |

### `steps`
Stores daily step counts.

| Column | Type | Description |
| :--- | :--- | :--- |
| `id` | INTEGER | Primary Key |
| `value` | INTEGER | Number of steps |
| `timestamp` | INTEGER | Date of record |

### `accounts`
Stores financial account information.

| Column | Type | Description |
| :--- | :--- | :--- |
| `id` | INTEGER | Primary Key |
| `name` | TEXT | Name of the account (e.g., "Checking", "Savings") |
| `balance` | REAL | Current balance |
| `type` | TEXT | Type of account |

### `transactions`
Stores financial transactions associated with accounts.

| Column | Type | Description |
| :--- | :--- | :--- |
| `id` | INTEGER | Primary Key |
| `timestamp` | INTEGER | Date of transaction |
| `description` | TEXT | Description/Payee |
| `amount` | REAL | Transaction amount |
| `account_id` | INTEGER | Foreign Key linking to `accounts.id` |

### `electricity_grid_hourly`
Stores hourly electricity import data from the grid.

| Column | Type | Description |
| :--- | :--- | :--- |
| `id` | INTEGER | Primary Key |
| `timestamp` | INTEGER | Hourly timestamp |
| `import_kwh` | REAL | Electricity imported from grid (kWh) |

### `electricity_solar_hourly`
Stores hourly solar production and home consumption data.

| Column | Type | Description |
| :--- | :--- | :--- |
| `id` | INTEGER | Primary Key |
| `timestamp` | INTEGER | Hourly timestamp |
| `solar_kwh` | REAL | Solar energy produced (kWh) |
| `consumption_kwh`| REAL | Energy consumed by home (kWh) |

### `gas_daily`
Stores daily gas usage data.

| Column | Type | Description |
| :--- | :--- | :--- |
| `id` | INTEGER | Primary Key |
| `timestamp` | INTEGER | Daily timestamp |
| `usage_therms` | REAL | Gas usage in therms |


