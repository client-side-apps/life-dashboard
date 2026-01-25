# Database Schema

This document outlines the expected database schema for the Life Dashboard application. The application uses a SQLite database (via sql.js).

## Tables

### `location`
Stores daily history of location coordinates.

| Column | Type | Description |
| :--- | :--- | :--- |
| `id` | INTEGER | Primary Key |
| `timestamp` | INTEGER | Timestamp (Unix ms) |
| `lat` | REAL | Latitude |
| `lng` | REAL | Longitude |

### `weight`
Stores body weight measurements.

| Column | Type | Description |
| :--- | :--- | :--- |
| `id` | INTEGER | Primary Key |
| `timestamp` | INTEGER | Date/Time of measurement |
| `weight_kg` | REAL | Weight value (kg) |

### `sleep`
Stores sleep duration.

| Column | Type | Description |
| :--- | :--- | :--- |
| `id` | INTEGER | Primary Key |
| `timestamp` | INTEGER | Date of sleep record |
| `duration_hours` | REAL | Sleep duration (hours) |

### `steps`
Stores daily step counts.

| Column | Type | Description |
| :--- | :--- | :--- |
| `id` | INTEGER | Primary Key |
| `timestamp` | INTEGER | Date of record |
| `count` | INTEGER | Number of steps |

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



### `blood_pressure`
Stores blood pressure and heart rate measurements.

| Column | Type | Description |
| :--- | :--- | :--- |
| `id` | INTEGER | Primary Key |
| `timestamp` | INTEGER | Date/Time of measurement |
| `systolic_mmhg` | INTEGER | Systolic pressure (mmHg) |
| `diastolic_mmhg` | INTEGER | Diastolic pressure (mmHg) |
| `heart_rate_bpm` | INTEGER | Heart rate (bpm) |

### `body_temperature`
Stores body temperature measurements.

| Column | Type | Description |
| :--- | :--- | :--- |
| `id` | INTEGER | Primary Key |
| `timestamp` | INTEGER | Date/Time of measurement |
| `temperature_c` | REAL | Temperature (°C) |

### `height`
Stores height measurements.

| Column | Type | Description |
| :--- | :--- | :--- |
| `id` | INTEGER | Primary Key |
| `timestamp` | INTEGER | Date/Time of measurement |
| `height_m` | REAL | Height (m) |
