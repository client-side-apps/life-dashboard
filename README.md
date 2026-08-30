# Life

A personal tool to visualize and manage life data including Map, Timeline, Health, Finance, Energy, and Movies. 
See [supported data sources](docs/importers.md).

All data is stored in a local SQLite database (`.sqlite` file) and never leaves your machine.

Includes a web UI (fully client side, everything happens locally in your browser) and a CLI (no network call)


## How to serve locally

You can serve the application locally using Python or Node.js:

### Node.js (via npx)

```bash
npx -y serve -p 8000
```

### Python

```bash
python -m http.server 8000
```

Then open http://localhost:8000 in your browser.

## Running Tests

Run tests locally using Node.js:

```bash
node --test
```

## CLI Tool

The project includes a pure Node.js CLI tool (`cli.js`) to inspect the database and import data from various exporters without any external dependencies.

### View Database Summary

To see a summary of the tables and the number of rows contained in a database:

```bash
node cli.js summary <db_path>
```

Example:

```bash
node cli.js summary demo.sqlite
```

### Import Data

To import a file or all files in a directory recursively:

```bash
node cli.js import <db_path> <file_or_dir_path> [options]
```

Options:
- `--provider <name>`: Force a specific data importer (e.g., `pge`, `tesla`, `sfcu`, `withings`, `cronometer`, `google_timeline`, `spotify`, `flume`, `divelog`).
- `--demo`: Seeds the `accounts` table with standard demo accounts and adds custom note annotations for 2025 records.

Example:

```bash
node cli.js import demo.sqlite data-samples
```

## Development

### Technology Stack
*   **Vanilla JavaScript Only**: Do not use TypeScript. Use modern JavaScript (ESM imports, `await`, `fetch`...).
*   **No Frameworks**: No Angular, React, Next.js, or other JS frameworks.
*   **Web Standards**: Optimize for using standard web APIs. Utilize Web Components and Custom Elements where appropriate.

### Dependencies & Build
*   **No Build Step**: The app should run by serving `index.html` from a (local) web server.
*   **Libraries**: Minimal library usage allowed only for charting, mapping, and database access.
*   **Import Maps**: Use import maps to de-couple from library locations.

### HTML Structure
*   **Native Elements**: Prefer native HTML elements over custom ones (e.g., `<select>`, `<input type="date">`, `<input type="file">`).
*   **Semantic HTML**: Use tags like `<main>`, `<nav>`, `<footer>`, `<header>`.

### Styling
*   **Pure CSS**: Use classes and plain CSS. No Tailwind or shadcn/ui.
*   **Modern Features**: Use CSS variables, color functions, etc.
*   **Clean Code**: Maintain reusable CSS and avoid presentational class names (e.g., no "centered").
*   **Layout vs. theme**: `app.css` owns layout and structure and reads every colour, font, border, radius and shadow from a CSS variable. A theme in `themes/` (`pixel.css`, `cozy.css`) defines those variables, plus the few ornaments unique to it. New rules go in `app.css` with tokens; hard-coded colours or fonts outside a theme are a bug.
*   **Themes**: The header gear opens the settings popover, holding the theme (`pixel`, `cozy`) and the light / dark / system appearance. Each theme covers both appearances via `[data-theme="dark"]`. Choices persist in `localStorage` (`skin`, and `theme` — absent means follow the system).

### Database
*   **Schema**: Expected tables and columns are documented in [docs/schema.md](docs/schema.md).
*   **Naming Convention**: Database columns must have the unit in the name (e.g., `energy_kwh`, `duration_minutes`).
*   **Source**: All tables must have a `source` column (TEXT) to identify the origin of the data (e.g., 'withings', 'pge').
*   **Timestamps**: Any column representing a date or time must be named `timestamp` and stored as an `INTEGER` (Unix timestamp in milliseconds).

### Data Import
*   **Importers**: Supported data importers and file formats are documented in [docs/importers.md](docs/importers.md).
