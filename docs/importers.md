# Data Importers

The application supports importing data from various CSV/JSON sources. Below is a list of supported importers and their details.

**Note**: All importers automatically populate the `source` column in the database with a unique identifier (e.g., `pge`, `tesla`, `withings`) to track the origin of the data.

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
    *   Parses `Debit` and `Credit` columns to `amount` (currency symbols and thousands separators are stripped, e.g. `$1,234.56`).
    *   Identical transactions on the same day (same date, description, and amount) are all preserved; re-imports match them one-to-one instead of collapsing them.
    *   *Note*: Currently defaults `account_id` to 1.

## Health

### Withings
*   **File Type**: CSV (various exports)
*   **Detection**: Checks for specific columns like `Activity type`, `Weight (kg)`, `light (s)`, etc.
*   **Data Processed**:
    *   **Activities**: Maps all records from `activities.csv` to the `activities` table (Running, Cycling, Hiking, Walking sessions, etc.).
    *   **Steps**: Maps daily aggregates from `aggregates_steps.csv` to the `steps` table.
    *   **Weight**: Maps to `weight` table (`weight_kg`, `fat_mass_kg`, `bone_mass_kg`, `muscle_mass_kg`, `hydration_kg`).
    *   **Sleep**: Maps to `sleep` table (duration, stages, heart rate, snoring). Manually logged sleep without stage breakdown falls back to the `from`/`to` interval for duration.
    *   **Blood Pressure / Heart Rate**: Maps to `heart` table (systolic, diastolic, heart rate). Heart-rate-only measurements (empty systolic/diastolic) are kept with `NULL` blood pressure values.
    *   The `Comments` column (weight, height, blood pressure exports) is preserved in the `note` column.
    *   **Height**: Maps to `height` table (`height_m`).
    *   **Temperature**: Maps to `body_temperature` table (`temperature_c`).

### Cronometer
*   **File Type**: CSV
*   **Detection**: Checks for `Energy (kcal)` and `Completed` (Daily Summary) or `Food Name` (Servings).
*   **Data Processed**:
    *   **Daily Summary**: Maps to `nutrition_daily` (energy, macros, vitamins, minerals).
    *   **Servings**: Maps to `nutrition_servings` (detailed per-food entries). Multiple foods logged at the same time are all preserved (matched by timestamp + food name on re-import).
    *   Nutrient columns absent from an export are stored as `NULL` (not `0`), so merging a partial export never overwrites real values with zeros. Present-but-empty values are stored as `0`.

### Dive Log
*   **File Type**: CSV (scuba diving log exports)
*   **Detection**: Checks for columns `Spot`, `Depth (m)`, and `Time (min)`.
*   **Data Processed**:
    *   Imports into `dives` table.
    *   Parses `Date` (`DD/MM/YYYY`) into `timestamp`.
    *   Maps `Spot`, `City`, `Region`, and `Country` as separate database fields.
    *   Converts `Depth (m)` and `Time (min)` (with comma decimals) into `max_depth_meters` and `duration_minutes`.
    *   Maps `Température fond` (or surface temp) into `water_temp_c`.
    *   Maps `Observations` to `note`, `Type` to `dive_type`, `Center` to `center`, `Divers` to `buddy`, and `Number` to `dive_number`.

## Music

### Spotify
*   **File Type**: JSON (Streaming History)
*   **Detection**: Checks for `spotify_track_uri` and `master_metadata_track_name`.
*   **Data Processed**:
    *   Imports into `music` table.
    *   `ts` -> `timestamp`
    *   `master_metadata_track_name` -> `track_name`
    *   `master_metadata_album_artist_name` -> `artist_name`
    *   `master_metadata_album_album_name` -> `album_name`
    *   `spotify_track_uri` -> `track_uri`
    *   `ms_played` -> `duration_ms`
    *   `platform` -> `platform`
    *   Podcast episodes (`episode_name` / `episode_show_name` / `spotify_episode_uri`) and audiobook chapters (`audiobook_*`) are imported too, mapped onto the same columns.

## Calendar

### Google Calendar
*   **File Type**: ICS (iCalendar export from Google Takeout or a calendar's "Export" option)
*   **Detection**: `.ics` files (or content starting with `BEGIN:VCALENDAR`) whose events hold `DTSTART` and `SUMMARY` properties.
*   **Data Processed**:
    *   Imports each `VEVENT` into the `calendar_events` table.
    *   `DTSTART` -> `timestamp`, `DTEND` -> `end_timestamp`. Date-only values are flagged with `all_day = 1` (an all-day `DTEND` is exclusive, per the iCalendar spec).
    *   Times with a `Z` suffix are treated as UTC; times with a `TZID` (or floating times) are interpreted in the local timezone.
    *   `SUMMARY` -> `title`, `DESCRIPTION` -> `description`, `LOCATION` -> `location`, `STATUS` -> `status`.
    *   Folded lines and escaped text (`\n`, `\,`, `\;`) are handled.
    *   Recurring events (`RRULE`) are imported as a single event at their first occurrence.
    *   Re-imports match existing events by start time and title.

## Location

### Google Timeline
*   **File Type**: JSON (monthly semantic segment exports, e.g. `timeline.json`, or the legacy Semantic Location History export)
*   **Detection**: Checks for `semanticSegments` or `timelineObjects` properties.
*   **Data Processed**:
    *   Imports into `location` table.
    *   **Semantic segments format**: extracts `timelinePath` points, visit locations (a point at both the start and end of each visit), and activity start/end coordinates when no path is present.
    *   **Legacy `timelineObjects` format**: extracts `placeVisit` locations (start and end of the visit), `activitySegment` start/end locations, and `simplifiedRawPath` points (E7 integer coordinates are converted to degrees).

## Water

### Flume
*   **File Type**: CSV
*   **Detection**: Checks for columns `datetime` and `liters`.
*   **Data Processed**:
    *   Imports into `water_daily` table.
    *   `liters` -> `usage_liters`.
