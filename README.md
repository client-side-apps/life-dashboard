# Life Dashboard

A personal dashboard to visualize and manage life data including Map, Timeline, Health, Finance, Energy, and Movies. 
See [supported data sources](docs/importers.md).

Everything happens locally in your browser. All data is stored in a local SQLite database (`.sqlite` file) and never leaves your machine.

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

### Database
*   **Schema**: Expected tables and columns are documented in [docs/schema.md](docs/schema.md).
*   **Naming Convention**: Database columns must have the unit in the name (e.g., `energy_kwh`, `duration_minutes`).

### Data Import
*   **Importers**: Supported data importers and file formats are documented in [docs/importers.md](docs/importers.md).
