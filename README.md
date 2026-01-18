# Life Dashboard

A personal dashboard to visualize and manage life data including Map, Timeline, Health, Finance, Energy, and Movies.

Everything happens locally in your browser. All data is stored in a local SQLite database (`.sqlite` file) and never leaves your machine.

## How to serve locally

You can serve the application locally using Python or Node.js:

### Python

```bash
python -m http.server 8000
```

Then open http://localhost:8000 in your browser.

### Node.js (via npx)

```bash
npx -y serve
```