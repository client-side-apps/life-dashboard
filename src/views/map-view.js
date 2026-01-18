import { dbService } from '../db.js';
import L from 'leaflet';

export class MapView extends HTMLElement {
    constructor() {
        super();
        this.map = null;
        this.currentTable = 'location_history';
        this.markersLayer = null;
        this.tileLayer = null;
    }

    connectedCallback() {
        this.render();
    }

    disconnectedCallback() {
        if (this.map) {
            this.map.remove();
            this.map = null;
        }
    }

    async render() {
        this.innerHTML = '';
        const template = document.getElementById('map-view-template');
        const content = template.content.cloneNode(true);
        this.appendChild(content);

        this.initMap();
        this.loadTableOptions();
    }

    initMap() {
        // Default to a world view or a specific user location if we had one.
        // We'll try to fit bounds after loading data.
        this.map = L.map('leaflet-map').setView([0, 0], 2);

        this.updateTheme(document.documentElement.getAttribute('data-theme') || 'light');
    }

    updateTheme(theme) {
        if (!this.map) return;

        if (this.tileLayer) {
            this.map.removeLayer(this.tileLayer);
        }

        if (theme === 'dark') {
            this.tileLayer = L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
                attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
                subdomains: 'abcd',
                maxZoom: 20
            });
        } else {
            this.tileLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            });
        }

        this.tileLayer.addTo(this.map);
    }

    loadTableOptions() {
        const tables = dbService.getTables();
        const select = this.querySelector('#map-table-select');

        if (tables.length === 0) {
            select.innerHTML = '<option>No tables found</option>';
            return;
        }

        select.innerHTML = tables.map(t =>
            `<option value="${t}" ${t === this.currentTable ? 'selected' : ''}>${t}</option>`
        ).join('');

        select.addEventListener('change', (e) => {
            this.currentTable = e.target.value;
            this.loadData();
        });

        // Trigger initial load
        if (tables.includes(this.currentTable)) {
            this.loadData();
        } else if (tables.length > 0) {
            this.currentTable = tables[0];
            select.value = this.currentTable;
            this.loadData();
        }
    }

    async loadData() {
        if (!this.map) return;

        // Clear existing markers
        if (this.markersLayer) {
            this.map.removeLayer(this.markersLayer);
        }
        this.markersLayer = L.layerGroup().addTo(this.map);

        const statsDiv = this.querySelector('#map-stats');
        statsDiv.textContent = 'Loading...';

        try {
            // Heuristic to find lat/lng columns
            // We'll fetch one row to inspect columns or use PRAGMA
            const sample = dbService.query(`SELECT * FROM "${this.currentTable}" LIMIT 1`);

            if (sample.length === 0) {
                statsDiv.textContent = 'Table is empty';
                return;
            }

            const columns = Object.keys(sample[0]);
            const latCol = columns.find(c => /lat|latitude/i.test(c));
            const lngCol = columns.find(c => /lng|lon|longitude/i.test(c));
            const timeCol = columns.find(c => /time|date|timestamp/i.test(c));

            if (!latCol || !lngCol) {
                statsDiv.textContent = 'No spatial columns found (lat/lng)';
                return;
            }

            // Fetch data (limit for performance for now, maybe 1000)
            const data = dbService.query(`SELECT "${latCol}", "${lngCol}" ${timeCol ? `, "${timeCol}"` : ''} FROM "${this.currentTable}" ORDER BY "${timeCol || latCol}" DESC LIMIT 2000`);

            const bounds = L.latLngBounds();

            data.forEach(row => {
                const lat = row[latCol];
                const lng = row[lngCol];
                if (lat && lng) {
                    const marker = L.circleMarker([lat, lng], {
                        radius: 5,
                        fillColor: "var(--primary-color)",
                        color: "#fff",
                        weight: 1,
                        opacity: 1,
                        fillOpacity: 0.8
                    });

                    if (timeCol && row[timeCol]) {
                        marker.bindPopup(`Time: ${new Date(row[timeCol]).toLocaleString()}`);
                    }

                    this.markersLayer.addLayer(marker);
                    bounds.extend([lat, lng]);
                }
            });

            if (data.length > 0) {
                this.map.fitBounds(bounds);
                statsDiv.textContent = `Showing ${data.length} points`;
            } else {
                statsDiv.textContent = 'No valid points found';
            }

        } catch (err) {
            console.error('Error loading map data:', err);
            statsDiv.textContent = 'Error loading data';
        }
    }
}

customElements.define('map-view', MapView);
