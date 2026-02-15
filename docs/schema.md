# Database Schema

This document outlines the expected database schema for the Life Dashboard application. The application uses a SQLite database (via sql.js).

## Location (Map)

### `location`
Stores daily history of location coordinates.

| Column | Type | Description |
| :--- | :--- | :--- |
| `id` | INTEGER | Primary Key |
| `timestamp` | INTEGER | Timestamp (Unix ms) |
| `lat` | REAL | Latitude |
| `lng` | REAL | Longitude |
| `source` | TEXT | Source of the data |

## Health

### `weight`
Stores body weight measurements.

| Column | Type | Description |
| :--- | :--- | :--- |
| `id` | INTEGER | Primary Key |
| `timestamp` | INTEGER | Date/Time of measurement |
| `weight_kg` | REAL | Weight value (kg) |
| `fat_mass_kg` | REAL | Fat mass (kg) |
| `bone_mass_kg` | REAL | Bone mass (kg) |
| `muscle_mass_kg` | REAL | Muscle mass (kg) |
| `hydration_kg` | REAL | Hydration (kg) |
| `source` | TEXT | Source of the data |

### `sleep`
Stores sleep duration and detailed sleep metrics.

| Column | Type | Description |
| :--- | :--- | :--- |
| `id` | INTEGER | Primary Key |
| `timestamp` | INTEGER | Date of sleep record (Unix ms) |
| `start_timestamp` | INTEGER | Start time of sleep (Unix ms) |
| `duration_hours` | REAL | Sleep duration (hours) |
| `light_seconds` | INTEGER | Light sleep duration (seconds) |
| `deep_seconds` | INTEGER | Deep sleep duration (seconds) |
| `rem_seconds` | INTEGER | REM sleep duration (seconds) |
| `awake_seconds` | INTEGER | Time spent awake during sleep (seconds) |
| `wake_up_seconds` | INTEGER | Time spent waking up (seconds) |
| `duration_to_sleep_seconds` | INTEGER | Time taken to fall asleep (seconds) |
| `duration_to_wake_up_seconds` | INTEGER | Time taken to wake up fully (seconds) |
| `snoring_seconds` | INTEGER | Total snoring duration (seconds) |
| `snoring_episodes` | INTEGER | Number of snoring episodes |
| `average_heart_rate` | INTEGER | Average heart rate during sleep (bpm) |
| `heart_rate_min` | INTEGER | Minimum heart rate during sleep (bpm) |
| `heart_rate_max` | INTEGER | Maximum heart rate during sleep (bpm) |
| `source` | TEXT | Source of the data |

### `steps`
Stores daily step count aggregates.

| Column | Type | Description |
| :--- | :--- | :--- |
| `id` | INTEGER | Primary Key |
| `timestamp` | INTEGER | Time of recording (Unix ms) |
| `count` | INTEGER | Total steps for the day |
| `type` | TEXT | Measurement type (e.g. "Daily Aggregate") |
| `source` | TEXT | Source of the data |

### `activities`
Stores non-walking activity sessions (Running, Cycling, Swimming, etc.).

| Column | Type | Description |
| :--- | :--- | :--- |
| `id` | INTEGER | Primary Key |
| `timestamp` | INTEGER | Start time (Unix ms) |
| `end_timestamp` | INTEGER | End time (Unix ms) |
| `type` | TEXT | Activity type (e.g., "Running") |
| `calories` | REAL | Calories burned |
| `distance` | REAL | Distance covered (meters) |
| `steps` | INTEGER | Steps taken |
| `elevation` | REAL | Elevation gain |
| `hr_average` | INTEGER | Average heart rate (bpm) |
| `source` | TEXT | Source of the data |

### `blood_pressure`
Stores blood pressure and heart rate measurements.

| Column | Type | Description |
| :--- | :--- | :--- |
| `id` | INTEGER | Primary Key |
| `timestamp` | INTEGER | Date/Time of measurement (Unix ms) |
| `systolic_mmhg` | INTEGER | Systolic pressure (mmHg) |
| `diastolic_mmhg` | INTEGER | Diastolic pressure (mmHg) |
| `heart_rate_bpm` | INTEGER | Heart rate (bpm) |
| `source` | TEXT | Source of the data |

### `body_temperature`
Stores body temperature measurements.

| Column | Type | Description |
| :--- | :--- | :--- |
| `id` | INTEGER | Primary Key |
| `timestamp` | INTEGER | Date/Time of measurement (Unix ms) |
| `temperature_c` | REAL | Temperature (°C) |
| `source` | TEXT | Source of the data |

### `height`
Stores height measurements.

| Column | Type | Description |
| :--- | :--- | :--- |
| `id` | INTEGER | Primary Key |
| `timestamp` | INTEGER | Date/Time of measurement (Unix ms) |
| `height_m` | REAL | Height (m) |
| `source` | TEXT | Source of the data |

### `nutrition_daily`
Stores daily nutrient and macro totals.

| Column | Type | Description |
| :--- | :--- | :--- |
| `id` | INTEGER | Primary Key |
| `timestamp` | INTEGER | Date of record (Unix ms) |
| `energy_kcal` | REAL | Total calories |
| `protein_g` | REAL | Total protein (g) |
| `carbs_g` | REAL | Total carbohydrates (g) |
| `fat_g` | REAL | Total fat (g) |
| `...` | REAL | Other fields (fiber, sugars, vitamins/minerals) |
| `source` | TEXT | Source of the data |

### `nutrition_servings`
Stores individual food entries/servings.

| Column | Type | Description |
| :--- | :--- | :--- |
| `id` | INTEGER | Primary Key |
| `timestamp` | INTEGER | Time of entry (Unix ms) |
| `meal_group` | TEXT | Group (e.g., Breakfast, Lunch) |
| `food_name` | TEXT | Description of food |
| `amount` | TEXT | Amount entered |
| `category` | TEXT | Food category |
| `energy_kcal` | REAL | Calories for this serving |
| `...` | REAL | Other fields (macros, vitamins/minerals) |
| `source` | TEXT | Source of the data |

## Finance

### `accounts`
Stores financial account information.

| Column | Type | Description |
| :--- | :--- | :--- |
| `id` | INTEGER | Primary Key |
| `name` | TEXT | Name of the account (e.g., "Checking", "Savings") |
| `balance` | REAL | Current balance |
| `type` | TEXT | Type of account |
| `source` | TEXT | Source of the data |

### `transactions`
Stores financial transactions associated with accounts.

| Column | Type | Description |
| :--- | :--- | :--- |
| `id` | INTEGER | Primary Key |
| `timestamp` | INTEGER | Date of transaction (Unix ms) |
| `description` | TEXT | Description/Payee |
| `amount` | REAL | Transaction amount |
| `account_id` | INTEGER | Foreign Key linking to `accounts.id` |
| `source` | TEXT | Source of the data |

## Energy

### `electricity_hourly`
Stores hourly electricity data: Grid Import/Export, Solar Production, Home Consumption, Vehicle Charging, and Powerwall usage.

| Column | Type | Description |
| :--- | :--- | :--- |
| `id` | INTEGER | Primary Key |
| `timestamp` | INTEGER | Hourly timestamp (Unix ms) |
| `grid_import_kwh` | REAL | Electricity imported from grid (kWh) |
| `grid_export_kwh` | REAL | Electricity exported to grid (kWh) |
| `solar_kwh` | REAL | Solar energy produced (kWh) |
| `home_consumption_kwh` | REAL | Energy consumed by home (kWh) |
| `vehicle_kwh` | REAL | Energy used for vehicle charging (kWh) |
| `battery_kwh` | REAL | Energy from Powerwall (kWh) |
| `cost` | REAL | Cost of grid interaction ($) |
| `source` | TEXT | Source of the data |


### `gas_daily`
Stores daily gas usage data.

| Column | Type | Description |
| :--- | :--- | :--- |
| `id` | INTEGER | Primary Key |
| `timestamp` | INTEGER | Daily timestamp (Unix ms) |
| `usage_therms` | REAL | Gas usage in therms |
| `cost` | REAL | Daily cost ($) |
| `source` | TEXT | Source of the data |

### `water_daily`
Stores daily water usage data.

| Column | Type | Description |
| :--- | :--- | :--- |
| `id` | INTEGER | Primary Key |
| `timestamp` | INTEGER | Daily timestamp (Unix ms) |
| `usage_liters` | REAL | Water usage (liters) |
| `source` | TEXT | Source of the data |

