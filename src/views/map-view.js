import * as dataRepository from '../services/data-repository.js';
import L from 'leaflet';
import { DataView } from '../components/data-view/data-view.js';

export class MapView extends DataView {
    constructor() {
        super();
        this.map = null;
        this.currentTable = 'location';
        this.markersLayer = null;
        this.tileLayer = null;
    }

    connectedCallback() {
        super.connectedCallback();
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
        await this.loadData();
    }

    onDateRangeChanged() {
        this.loadData();
    }

    initMap() {
        // Default to a world view or a specific user location if we had one.
        // We'll try to fit bounds after loading data.
        this.map = L.map('leaflet-map', { preferCanvas: true }).setView([0, 0], 2);

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
            this.tileLayer = L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
                attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
                subdomains: 'abcd',
                maxZoom: 20
            });
        }

        this.tileLayer.addTo(this.map);
    }



    async loadData() {
        if (!this.map) return;
        if (!this.currentTable) return;

        await this.showLoading();

        try {
            // Clear existing markers
            if (this.markersLayer) {
                this.map.removeLayer(this.markersLayer);
            }
            this.markersLayer = L.layerGroup().addTo(this.map);

            const statsDiv = this.querySelector('#map-stats');
            statsDiv.textContent = '';

            const startDate = this.startDate;
            const endDate = this.endDate;

            // Heuristic to find lat/lng columns
            // We'll fetch one row to inspect columns or use PRAGMA
            // const sample = dbService.query(`SELECT * FROM "${this.currentTable}" LIMIT 1`);
            const sample = dataRepository.executeQuery(`SELECT * FROM "${this.currentTable}" LIMIT 1`);

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

            // We use getSpatialData which returns * (all cols)
            // This differs slightly from original which selected specific cols, but logic works same.
            const data = dataRepository.getSpatialData(this.currentTable, startDate, endDate, 2000);

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
            } else {
                statsDiv.textContent = 'No valid points found';
            }

        } catch (err) {
            console.error('Error loading map data:', err);
            const statsDiv = this.querySelector('#map-stats');
            if (statsDiv) statsDiv.textContent = 'Error loading data';
        } finally {
            this.hideLoading();
        }
    }
}

customElements.define('map-view', MapView);
