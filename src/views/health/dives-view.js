import * as dataRepository from '../../services/data-repository.js';
import { DataView } from '../../components/data-view/data-view.js';
import { getChartColor, ChartColors } from '../../utils/style.js';
import Chart from 'chart.js';
import L from 'leaflet';

export class HealthDivesView extends DataView {
    constructor() {
        super();
        this.charts = {};
        
        // Leaflet maps
        this.dashboardMap = null;
        this.listMap = null;
        this.dashboardMarkersGroup = null;
        this.listMarkersGroup = null;
        this.activeListMarker = null;
        
        // Active Tab
        this.activeTab = 'dashboard'; // 'dashboard' or 'list'
        
        // Filter states
        this.selectedCountry = '';
        this.selectedRegion = '';
        this.selectedCity = '';
        this.selectedType = '';
        this.selectedCenter = '';
        
        // Table Pagination
        this.tablePage = 1;
        this.tablePageSize = 5;
        
        // Coordinates lookup for dive locations
        this.coordinateLookup = {
            'argelès': [42.5481, 3.0229],
            'argelès-sur-mer': [42.5481, 3.0229],
            'banyuls': [42.4828, 3.1293],
            'banyuls-sur-mer': [42.4828, 3.1293],
            'carry-le-rouet': [43.3298, 5.1524],
            'el quseir': [26.1085, 34.2755],
            'key largo': [25.0865, -80.4473],
            'kona': [19.6399, -155.9969],
            'la ciotat': [43.1748, 5.6045],
            'lavezzi': [41.3411, 9.2536],
            'maddalena': [41.2132, 9.4079],
            'maui': [20.7984, -156.3319],
            'monterey': [36.6002, -121.8947],
            'théoule': [43.5074, 6.9407],
            'théoule-sur-mer': [43.5074, 6.9407],
            'tignes': [45.4683, 6.9066],
            'roses': [42.2618, 3.1782],
            'praslin': [-4.3218, 55.7420],
            'hurghada': [27.2579, 33.8116],
            'corse': [42.0396, 9.0129],
            'vosges': [48.0802, 6.9463],
            'sardaigne': [40.1209, 9.0129],
            'egypt': [26.8206, 30.8025],
            'france': [46.2276, 2.2137],
            'italy': [41.8719, 12.5674],
            'seychelles': [-4.6796, 55.4920],
            'usa': [37.0902, -95.7129],
            'spain': [40.4637, -3.7492]
        };
    }

    connectedCallback() {
        super.connectedCallback();
        this.renderStructure();
        this.initMaps();
        this.populateFilters();
        this.bindTabEvents();
        this.updateDashboard();
    }

    disconnectedCallback() {
        // Cleanup charts
        Object.values(this.charts).forEach(chart => {
            if (chart) chart.destroy();
        });
        this.charts = {};

        // Cleanup maps
        if (this.dashboardMap) {
            this.dashboardMap.remove();
            this.dashboardMap = null;
        }

        // Cleanup card minimaps
        if (this.cardMinimaps) {
            this.cardMinimaps.forEach(m => {
                try { m.remove(); } catch(e) {}
            });
            this.cardMinimaps = [];
        }
    }

    onDateRangeChanged() {
        this.updateDashboard();
    }

    getCoordinates(d) {
        if (!d) return null;
        const city = (d.city || '').toLowerCase().trim();
        const region = (d.region || '').toLowerCase().trim();
        const country = (d.country || '').toLowerCase().trim();
        const spot = (d.spot || '').toLowerCase().trim();

        if (city && this.coordinateLookup[city]) return this.coordinateLookup[city];
        if (region && this.coordinateLookup[region]) return this.coordinateLookup[region];
        if (spot && this.coordinateLookup[spot]) return this.coordinateLookup[spot];
        
        const combinedCity = `${city}, ${country}`;
        if (this.coordinateLookup[combinedCity]) return this.coordinateLookup[combinedCity];
        
        const combinedRegion = `${region}, ${country}`;
        if (this.coordinateLookup[combinedRegion]) return this.coordinateLookup[combinedRegion];

        if (country && this.coordinateLookup[country]) return this.coordinateLookup[country];
        
        return null;
    }

    extractPartners(diversJson) {
        if (!diversJson) return [];
        let diversList = [];
        try {
            diversList = JSON.parse(diversJson);
            if (!Array.isArray(diversList)) {
                diversList = typeof diversJson === 'string' ? diversJson.split(/[+,]/) : [];
            }
        } catch (e) {
            if (typeof diversJson === 'string') {
                diversList = diversJson.split(/[+,]/);
            }
        }
        const partners = [];
        diversList.forEach(p => {
            let name = p.trim().toLowerCase();
            if (!name) return;
            if (name.includes('steren')) return;
            if (name === '?') return;
            if (name.includes('mono') || name.includes('instructor')) return;
            if (name.includes('plongeur') || name.includes('diver')) return;
            
            // Format to Title Case
            const formatted = p.trim().replace(/\b\w/g, c => c.toUpperCase());
            partners.push(formatted);
        });
        return partners;
    }

    renderStructure() {
        this.innerHTML = `
            <style>
                .dives-dashboard-container {
                    display: flex;
                    flex-direction: column;
                    gap: 1.5rem;
                    width: 100%;
                    box-sizing: border-box;
                }
                
                .dives-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    flex-wrap: wrap;
                    gap: 1rem;
                    background: var(--card-bg);
                    padding: 1rem;
                    border: 1px solid var(--border-color);
                }
                
                .dives-title-area {
                    display: flex;
                    flex-direction: column;
                    gap: 0.5rem;
                }

                .dives-title {
                    font-size: 1.8rem;
                    font-weight: bold;
                    margin: 0;
                    color: var(--text-color);
                }

                .dives-tabs {
                    display: flex;
                    gap: 0.25rem;
                    background: var(--bg-color);
                    border: 1px solid var(--border-color);
                    padding: 2px;
                }

                .dives-tab-btn {
                    background: none;
                    border: none;
                    color: var(--text-color);
                    padding: 0.4rem 1rem;
                    font-weight: bold;
                    cursor: pointer;
                    font-size: 0.85rem;
                    text-transform: var(--label-transform);
                    transition: all 0.2s;
                }

                .dives-tab-btn.active {
                    background: var(--primary-color);
                    color: var(--primary-text);
                }
                
                .dives-filters {
                    display: flex;
                    gap: 0.75rem;
                    flex-wrap: wrap;
                    align-items: center;
                }
                
                .dives-filter-group {
                    display: flex;
                    flex-direction: column;
                    gap: 0.25rem;
                }
                
                .dives-filter-group label {
                    font-size: 0.75rem;
                    text-transform: var(--label-transform);
                    opacity: 0.8;
                    font-weight: bold;
                }
                
                .dives-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
                    gap: 1.5rem;
                }
                
                @media (min-width: 1024px) {
                    .dives-grid {
                        grid-template-columns: 320px 1fr 1fr;
                    }
                }
                
                .dives-column {
                    display: flex;
                    flex-direction: column;
                    gap: 1.5rem;
                }
                
                .dives-card {
                    background: var(--card-bg);
                    border: 1px solid var(--border-color);
                    padding: 1rem;
                    display: flex;
                    flex-direction: column;
                    gap: 0.75rem;
                    box-sizing: border-box;
                    min-width: 0;
                }
                
                .dives-card h3 {
                    margin: 0;
                    font-size: 0.95rem;
                    text-transform: var(--label-transform);
                    border-bottom: 1px solid var(--border-color);
                    padding-bottom: 0.5rem;
                    letter-spacing: 0.05em;
                }
                
                .dives-stats-grid {
                    display: grid;
                    grid-template-columns: 1fr 1fr;
                    gap: 0.75rem;
                }
                
                .dives-stat-card-large {
                    grid-row: span 2;
                    background: rgba(0, 188, 212, 0.05);
                    border: 1px solid var(--border-color);
                    padding: 1rem;
                    display: flex;
                    flex-direction: column;
                    justify-content: center;
                    align-items: center;
                    text-align: center;
                }
                
                .dives-stat-card-small {
                    background: var(--bg-color);
                    border: 1px solid var(--border-color);
                    padding: 0.5rem 0.75rem;
                    display: flex;
                    flex-direction: column;
                    justify-content: center;
                }
                
                .stat-num-lg {
                    font-size: 3rem;
                    font-weight: 900;
                    line-height: 1;
                    color: var(--primary-color);
                }
                
                .stat-num-sm {
                    font-size: 1.5rem;
                    font-weight: 800;
                    line-height: 1.2;
                    font-family: monospace;
                }
                
                .stat-lbl-lg {
                    font-size: 0.85rem;
                    text-transform: var(--label-transform);
                    opacity: 0.8;
                    margin-bottom: 0.25rem;
                }
                
                .stat-lbl-sm {
                    font-size: 0.7rem;
                    text-transform: var(--label-transform);
                    opacity: 0.7;
                    margin-bottom: 0.15rem;
                }
                
                .chart-canvas-container {
                    position: relative;
                    width: 100%;
                    height: 200px;
                }
                
                /* .table-pagination and .pagination-btn come from app.css */

                .mini-table {
                    width: 100%;
                    border-collapse: collapse;
                    font-size: 0.85rem;
                }
                
                .mini-table th, .mini-table td {
                    padding: 0.4rem 0.5rem;
                    text-align: left;
                    border-bottom: 1px solid var(--border-color);
                }
                
                .mini-table th {
                    font-weight: bold;
                    opacity: 0.8;
                }

                /* List View Layout */
                .dives-list-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
                    gap: 1.5rem;
                    width: 100%;
                }

                .dive-card-item {
                    border: 1px solid var(--border-color);
                    background: var(--card-bg);
                    padding: 1rem;
                    display: flex;
                    flex-direction: column;
                    gap: 0.5rem;
                    box-sizing: border-box;
                    transition: all 0.2s;
                }

                .dive-card-item:hover {
                    border-color: var(--primary-color) !important;
                    background: rgba(0, 188, 212, 0.05) !important;
                }

                .dive-minimap {
                    height: 150px;
                    width: 100%;
                    border: 1px solid var(--border-color);
                    margin-top: 0.5rem;
                    background: #0d1b2e;
                }
            </style>
            
            <div class="dives-dashboard-container">
                <!-- Header & Filters -->
                <div class="dives-header">
                    <div class="dives-tabs">
                        <button class="dives-tab-btn active" id="tab-dashboard">Dashboard</button>
                        <button class="dives-tab-btn" id="tab-list">Dive List</button>
                    </div>
                    <div class="dives-filters">
                        <div class="dives-filter-group">
                            <label for="filter-country">Country</label>
                            <select id="filter-country" class="select-input"></select>
                        </div>
                        <div class="dives-filter-group">
                            <label for="filter-region">Region</label>
                            <select id="filter-region" class="select-input"></select>
                        </div>
                        <div class="dives-filter-group">
                            <label for="filter-city">City</label>
                            <select id="filter-city" class="select-input"></select>
                        </div>
                        <div class="dives-filter-group">
                            <label for="filter-type">Type</label>
                            <select id="filter-type" class="select-input"></select>
                        </div>
                        <div class="dives-filter-group">
                            <label for="filter-center">Center</label>
                            <select id="filter-center" class="select-input"></select>
                        </div>
                    </div>
                </div>
                
                <!-- Panel 1: Dashboard View -->
                <div id="panel-dashboard" class="dives-grid">
                    <!-- Column 1: Stats & Donut & Cumulative Line -->
                    <div class="dives-column">
                        <div class="dives-card">
                            <h3>Key Metrics</h3>
                            <div class="dives-stats-grid">
                                <div class="dives-stat-card-large">
                                    <span class="stat-lbl-lg">Count</span>
                                    <span class="stat-num-lg" id="lbl-count">--</span>
                                </div>
                                <div class="dives-stat-card-small">
                                    <span class="stat-lbl-sm">Total hours</span>
                                    <span class="stat-num-sm" id="lbl-hours">--</span>
                                </div>
                                <div class="dives-stat-card-small">
                                    <span class="stat-lbl-sm">Max depth</span>
                                    <span class="stat-num-sm" id="lbl-max-depth">--</span>
                                </div>
                                <div class="dives-stat-card-small">
                                    <span class="stat-lbl-sm">Average time</span>
                                    <span class="stat-num-sm" id="lbl-avg-time">--</span>
                                </div>
                                <div class="dives-stat-card-small">
                                    <span class="stat-lbl-sm">Average depth</span>
                                    <span class="stat-num-sm" id="lbl-avg-depth">--</span>
                                </div>
                            </div>
                        </div>
                        
                        <div class="dives-card">
                            <h3>Dive Types</h3>
                            <div class="chart-canvas-container" style="height: 180px;">
                                <canvas id="chart-types"></canvas>
                            </div>
                        </div>

                        <div class="dives-card">
                            <h3>Cumulative Dives</h3>
                            <div class="chart-canvas-container" style="height: 180px;">
                                <canvas id="chart-cumulative"></canvas>
                            </div>
                        </div>
                    </div>
                    
                    <!-- Column 2: Leaflet Map & Region Bar Chart -->
                    <div class="dives-column">
                        <div class="dives-card" style="padding: 0.5rem; gap: 0.5rem;">
                            <h3 style="margin: 0.5rem 0.5rem 0 0.5rem;">Dive Sites Map</h3>
                            <div id="dives-map" style="height: 310px; width: 100%; border: 1px solid var(--border-color);"></div>
                        </div>
                        
                        <div class="dives-card">
                            <h3>Dives by Region</h3>
                            <div class="chart-canvas-container" style="height: 250px;">
                                <canvas id="chart-regions"></canvas>
                            </div>
                        </div>
                    </div>
                    
                    <!-- Column 3: Scatter Plot, Partners, Averages, Centers -->
                    <div class="dives-column">
                        <div class="dives-card">
                            <h3>Depth vs Time</h3>
                            <div class="chart-canvas-container" style="height: 200px;">
                                <canvas id="chart-scatter"></canvas>
                            </div>
                        </div>
                        
                        <div class="dives-card">
                            <h3>Dives by Partner</h3>
                            <div class="chart-canvas-container" style="height: 170px;">
                                <canvas id="chart-partners"></canvas>
                            </div>
                        </div>
                        
                        <div class="dives-card" style="padding: 0.75rem;">
                            <h3 style="font-size: 0.85rem; border-bottom: 1px solid var(--border-color); padding-bottom: 0.3rem;">Avg Time by Region</h3>
                            <table class="mini-table">
                                <thead>
                                    <tr>
                                        <th>Region/Country</th>
                                        <th class="align-right">Avg Time</th>
                                    </tr>
                                </thead>
                                <tbody id="avg-time-table-body">
                                </tbody>
                            </table>
                            <div class="table-pagination">
                                <button class="pagination-btn" id="btn-prev" disabled>&lt;</button>
                                <span id="txt-page">1-5 / 10</span>
                                <button class="pagination-btn" id="btn-next" disabled>&gt;</button>
                            </div>
                        </div>
                        
                        <div class="dives-card">
                            <h3>Dives by Center</h3>
                            <div class="chart-canvas-container" style="height: 210px;">
                                <canvas id="chart-centers"></canvas>
                            </div>
                        </div>
                    </div>
                </div>
                
                <!-- Panel 2: List View (Grid of cards with minimaps) -->
                <div id="panel-list" style="display: none;">
                    <div class="dives-list-grid" id="dives-list-container">
                        <!-- Dive Cards dynamically rendered here -->
                    </div>
                </div>
            </div>
        `;
    }

    initMaps() {
        // 1. Dashboard Map
        const mapContainer = this.querySelector('#dives-map');
        if (mapContainer) {
            this.dashboardMap = L.map(mapContainer, {
                center: [20, 0],
                zoom: 2,
                minZoom: 1,
                zoomControl: true
            });
            L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
                attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
            }).addTo(this.dashboardMap);
            this.dashboardMarkersGroup = L.featureGroup().addTo(this.dashboardMap);
        }

        // 2. List Map
    }

    bindTabEvents() {
        const tabDashboard = this.querySelector('#tab-dashboard');
        const tabList = this.querySelector('#tab-list');
        const panelDashboard = this.querySelector('#panel-dashboard');
        const panelList = this.querySelector('#panel-list');

        tabDashboard.addEventListener('click', () => {
            tabDashboard.classList.add('active');
            tabList.classList.remove('active');
            panelDashboard.style.display = 'grid';
            panelList.style.display = 'none';
            this.activeTab = 'dashboard';
            
            if (this.dashboardMap) {
                this.dashboardMap.invalidateSize();
            }
        });

        tabList.addEventListener('click', () => {
            tabList.classList.add('active');
            tabDashboard.classList.remove('active');
            panelDashboard.style.display = 'none';
            panelList.style.display = 'block';
            this.activeTab = 'list';
        });
    }

    populateFilters() {
        const allData = dataRepository.getDiveLogs();

        const getUniqueSorted = (key) => {
            const set = new Set();
            allData.forEach(d => {
                if (d[key]) set.add(d[key].trim());
            });
            return Array.from(set).sort();
        };

        const populateSelect = (id, values, defaultLabel) => {
            const select = this.querySelector(`#${id}`);
            if (!select) return;
            select.innerHTML = `<option value="">All ${defaultLabel}s</option>` +
                values.map(v => `<option value="${v}">${v}</option>`).join('');
                
            select.addEventListener('change', (e) => {
                const key = id.replace('filter-', '');
                if (key === 'country') this.selectedCountry = e.target.value;
                if (key === 'region') this.selectedRegion = e.target.value;
                if (key === 'city') this.selectedCity = e.target.value;
                if (key === 'type') this.selectedType = e.target.value;
                if (key === 'center') this.selectedCenter = e.target.value;
                
                this.tablePage = 1; // Reset pagination
                this.updateDashboard();
            });
        };

        populateSelect('filter-country', getUniqueSorted('country'), 'Country');
        populateSelect('filter-region', getUniqueSorted('region'), 'Region');
        populateSelect('filter-city', getUniqueSorted('city'), 'City');
        populateSelect('filter-type', getUniqueSorted('dive_type'), 'Type');
        populateSelect('filter-center', getUniqueSorted('center'), 'Center');
    }

    updateDashboard() {
        // Fetch logs matching date range
        const dateFiltered = dataRepository.getDiveLogs({
            startDate: this.startDate,
            endDate: this.endDate
        });

        // Apply dropdown filters
        const data = dateFiltered.filter(d => {
            if (this.selectedCountry && d.country !== this.selectedCountry) return false;
            if (this.selectedRegion && d.region !== this.selectedRegion) return false;
            if (this.selectedCity && d.city !== this.selectedCity) return false;
            if (this.selectedType && d.dive_type !== this.selectedType) return false;
            if (this.selectedCenter && d.center !== this.selectedCenter) return false;
            return true;
        });

        // Update stats
        this.updateStats(data);
        
        // Update elements depending on active tab
        this.updateDashboardMap(data);
        this.renderCharts(data);
        this.renderAveragesTable(data);
        this.renderDiveScrollList(data);
    }

    updateStats(data) {
        const totalDives = data.length;
        const totalMinutes = data.reduce((acc, d) => acc + (d.duration_minutes || 0), 0);
        const totalHours = Math.round(totalMinutes / 60);

        const depths = data.map(d => d.max_depth_meters).filter(v => v !== null && !isNaN(v));
        const maxDepth = depths.length > 0 ? Math.max(...depths) : 0;

        const averageTime = totalDives > 0 ? Math.round(totalMinutes / totalDives) : 0;
        const averageDepth = depths.length > 0 ? Math.round(depths.reduce((sum, v) => sum + v, 0) / depths.length) : 0;

        this.querySelector('#lbl-count').textContent = totalDives;
        this.querySelector('#lbl-hours').textContent = totalHours;
        this.querySelector('#lbl-max-depth').textContent = maxDepth > 0 ? `${maxDepth} m` : '--';
        this.querySelector('#lbl-avg-time').textContent = averageTime > 0 ? `${averageTime} min` : '--';
        this.querySelector('#lbl-avg-depth').textContent = averageDepth > 0 ? `${averageDepth} m` : '--';
    }

    updateDashboardMap(data) {
        if (!this.dashboardMap || !this.dashboardMarkersGroup) return;

        this.dashboardMarkersGroup.clearLayers();

        const locations = {};
        data.forEach(d => {
            const city = d.city || '';
            const region = d.region || '';
            const country = d.country || '';
            const key = `${city || region}, ${country}`.toLowerCase().trim();
            
            if (this.coordinateLookup[key]) {
                if (!locations[key]) {
                    locations[key] = {
                        name: `${d.city || d.region || d.spot || 'Unknown site'}, ${d.country || ''}`,
                        coords: this.coordinateLookup[key],
                        count: 0
                    };
                }
                locations[key].count++;
            }
        });

        const markers = [];
        Object.values(locations).forEach(loc => {
            const marker = L.circleMarker(loc.coords, {
                radius: Math.min(25, 4 + Math.sqrt(loc.count) * 2.5),
                fillColor: '#00ced1',
                color: '#ffffff',
                weight: 1,
                opacity: 0.9,
                fillOpacity: 0.6
            });
            
            marker.bindPopup(`<strong>${loc.name}</strong><br/>${loc.count} dive${loc.count > 1 ? 's' : ''}`);
            marker.addTo(this.dashboardMarkersGroup);
            markers.push(marker);
        });

        if (markers.length > 0) {
            const group = L.featureGroup(markers);
            this.dashboardMap.fitBounds(group.getBounds().pad(0.2));
        } else {
            this.dashboardMap.setView([20, 0], 2);
        }
    }

    renderDiveScrollList(data) {
        const container = this.querySelector('#dives-list-container');
        if (!container) return;

        // Cleanup existing card maps
        if (this.cardMinimaps) {
            this.cardMinimaps.forEach(m => {
                try { m.remove(); } catch(e) {}
            });
        }
        this.cardMinimaps = [];

        if (data.length === 0) {
            container.innerHTML = `<div class="dives-card" style="text-align: center; padding: 2rem; grid-column: 1 / -1;">No dives found for this period.</div>`;
            return;
        }

        container.innerHTML = data.map(item => {
            const date = new Date(item.timestamp).toLocaleDateString(undefined, { year: 'numeric', month: '2-digit', day: '2-digit' });
            const depth = item.max_depth_meters ? `${item.max_depth_meters.toFixed(1)} m` : '--';
            const duration = item.duration_minutes ? `${item.duration_minutes} min` : '--';
            const temp = item.water_temp_c !== null ? `${item.water_temp_c} °C` : '--';
            const location = [item.spot, item.city, item.country].filter(Boolean).join(', ');
            const center = [item.dive_type, item.center].filter(Boolean).join(' @ ');
            let diversList = [];
            try {
                diversList = JSON.parse(item.divers);
            } catch (e) {
                if (typeof item.divers === 'string') {
                    diversList = item.divers.split(/[+,]/).map(d => d.trim());
                }
            }
            const diversStr = diversList.join(' + ');
            const totalDiversStr = item.total_divers ? ` (Total: ${item.total_divers})` : '';
            const note = item.note ? item.note.trim() : '';

            return `
                <div class="dive-card-item">
                    <div style="display: flex; justify-content: space-between; font-weight: bold; margin-bottom: 0.4rem; font-size: 0.85rem; opacity: 0.8;">
                        <span>Dive #${item.dive_number || ''}</span>
                        <span>${date}</span>
                    </div>
                    <div style="font-size: 1.05rem; font-weight: bold; color: var(--primary-color); margin-bottom: 0.5rem;">
                        ${location || 'Unknown site'}
                    </div>
                    <div style="display: flex; gap: 1rem; font-size: 0.85rem; margin-bottom: 0.5rem;">
                        <span>📏 Depth: <strong>${depth}</strong></span>
                        <span>⏱️ Time: <strong>${duration}</strong></span>
                        <span>🌡️ Temp: <strong>${temp}</strong></span>
                    </div>
                    ${diversStr ? `<div style="font-size: 0.8rem; opacity: 0.9; margin-bottom: 0.2rem;">👥 Divers: ${diversStr}${totalDiversStr}</div>` : ''}
                    ${center ? `<div style="font-size: 0.8rem; opacity: 0.9; margin-bottom: 0.2rem;">⚓ Center: ${center}</div>` : ''}
                    ${note ? `<div style="font-style: italic; font-size: 0.8rem; opacity: 0.85; margin-top: 0.5rem; border-top: 1px solid var(--border-color); padding-top: 0.4rem; line-height: 1.3;">${note}</div>` : ''}
                    <div class="dive-minimap" data-dive-num="${item.dive_number}"></div>
                </div>
            `;
        }).join('');

        // Setup IntersectionObserver for lazy-loading minimaps
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const element = entry.target;
                    const diveNum = parseInt(element.dataset.diveNum, 10);
                    const item = data.find(d => d.dive_number === diveNum);
                    
                    const coords = this.getCoordinates(item);
                    if (coords) {
                        try {
                            const map = L.map(element, {
                                zoomControl: false,
                                dragging: false,
                                scrollWheelZoom: false,
                                doubleClickZoom: false,
                                boxZoom: false,
                                touchZoom: false
                            }).setView(coords, 11);

                            L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
                                attribution: ''
                            }).addTo(map);

                            L.circleMarker(coords, {
                                radius: 6,
                                fillColor: '#00ced1',
                                color: '#ffffff',
                                weight: 1,
                                opacity: 0.9,
                                fillOpacity: 0.8
                            }).addTo(map);

                            this.cardMinimaps.push(map);
                        } catch (e) {
                            console.error('Failed to init card minimap', e);
                        }
                    } else {
                        element.style.display = 'none'; // Hide if no coordinates
                    }
                    observer.unobserve(element);
                }
            });
        }, { root: null, rootMargin: '100px' });

        container.querySelectorAll('.dive-minimap').forEach(el => {
            observer.observe(el);
        });
    }

    renderCharts(data) {
        try { this.renderTypesDonut(data); } catch (e) { console.error('Donut failed', e); }
        try { this.renderCumulativeLine(data); } catch (e) { console.error('Cumulative failed', e); }
        try { this.renderRegionsBar(data); } catch (e) { console.error('Regions failed', e); }
        try { this.renderDepthTimeScatter(data); } catch (e) { console.error('Scatter failed', e); }
        try { this.renderPartnersBar(data); } catch (e) { console.error('Partners failed', e); }
        try { this.renderCentersBar(data); } catch (e) { console.error('Centers failed', e); }
    }

    initChartCanvas(canvasId, type, config) {
        if (this.charts[canvasId]) {
            this.charts[canvasId].destroy();
        }

        const canvas = this.querySelector(`#${canvasId}`);
        if (!canvas) return null;

        const ctx = canvas.getContext('2d');
        this.charts[canvasId] = new Chart(ctx, {
            type,
            ...config
        });
        return this.charts[canvasId];
    }

    renderTypesDonut(data) {
        const counts = {};
        data.forEach(d => {
            const type = d.dive_type || 'Unknown';
            counts[type] = (counts[type] || 0) + 1;
        });

        const labels = Object.keys(counts);
        const values = Object.values(counts);

        const colors = [
            getChartColor(ChartColors.Blue),
            getChartColor(ChartColors.Cyan),
            getChartColor(ChartColors.Accent),
            getChartColor(ChartColors.Yellow),
            getChartColor(ChartColors.Magenta)
        ];

        this.initChartCanvas('chart-types', 'doughnut', {
            data: {
                labels,
                datasets: [{
                    data: values,
                    backgroundColor: colors,
                    borderWidth: 1,
                    borderColor: 'var(--card-bg)'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'right',
                        labels: {
                            color: getChartColor(ChartColors.PrimaryText),
                            font: { size: 10 }
                        }
                    }
                }
            }
        });
    }

    renderCumulativeLine(data) {
        const sorted = [...data].sort((a, b) => a.timestamp - b.timestamp);
        const labels = sorted.map(d => {
            const dateObj = new Date(d.timestamp);
            return `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, '0')}-${String(dateObj.getDate()).padStart(2, '0')}`;
        });
        const values = sorted.map((d, index) => index + 1);

        this.initChartCanvas('chart-cumulative', 'line', {
            data: {
                labels,
                datasets: [{
                    label: 'Cumulative Dives',
                    data: values,
                    borderColor: getChartColor(ChartColors.Cyan) || '#00ced1',
                    borderWidth: 2,
                    pointRadius: 0,
                    pointHoverRadius: 4,
                    fill: false,
                    tension: 0.1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    x: {
                        grid: { color: 'rgba(255, 255, 255, 0.05)' },
                        ticks: { 
                            color: getChartColor(ChartColors.PrimaryText) || '#ffffff',
                            maxTicksLimit: 6
                        }
                    },
                    y: {
                        grid: { color: 'rgba(255, 255, 255, 0.05)' },
                        ticks: { color: getChartColor(ChartColors.PrimaryText) || '#ffffff' }
                    }
                },
                plugins: {
                    legend: { display: false }
                }
            }
        });
    }

    renderRegionsBar(data) {
        const counts = {};
        data.forEach(d => {
            const name = d.region || d.country || 'Unknown';
            counts[name] = (counts[name] || 0) + 1;
        });

        const sorted = Object.entries(counts)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 10);

        const labels = sorted.map(x => x[0]);
        const values = sorted.map(x => x[1]);

        this.initChartCanvas('chart-regions', 'bar', {
            data: {
                labels,
                datasets: [{
                    data: values,
                    backgroundColor: getChartColor(ChartColors.Blue),
                    borderWidth: 0
                }]
            },
            options: {
                indexAxis: 'y',
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    x: {
                        grid: { color: 'rgba(255, 255, 255, 0.05)' },
                        ticks: { color: getChartColor(ChartColors.PrimaryText) }
                    },
                    y: {
                        grid: { display: false },
                        ticks: { color: getChartColor(ChartColors.PrimaryText), font: { size: 10 } }
                    }
                },
                plugins: {
                    legend: { display: false }
                }
            }
        });
    }

    renderDepthTimeScatter(data) {
        const chartData = data
            .filter(d => d.duration_minutes && d.max_depth_meters)
            .map(d => ({
                x: d.duration_minutes,
                y: d.max_depth_meters
            }));

        this.initChartCanvas('chart-scatter', 'scatter', {
            data: {
                datasets: [{
                    data: chartData,
                    backgroundColor: getChartColor(ChartColors.Cyan),
                    pointRadius: 4,
                    pointHoverRadius: 6
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    x: {
                        title: { display: true, text: 'Time (min)', color: getChartColor(ChartColors.PrimaryText) },
                        grid: { color: 'rgba(255, 255, 255, 0.05)' },
                        ticks: { color: getChartColor(ChartColors.PrimaryText) }
                    },
                    y: {
                        title: { display: true, text: 'Depth (m)', color: getChartColor(ChartColors.PrimaryText) },
                        grid: { color: 'rgba(255, 255, 255, 0.05)' },
                        ticks: { color: getChartColor(ChartColors.PrimaryText) }
                    }
                },
                plugins: {
                    legend: { display: false }
                }
            }
        });
    }

    renderPartnersBar(data) {
        const partnerCounts = {};
        data.forEach(d => {
            const partners = this.extractPartners(d.divers);
            partners.forEach(p => {
                partnerCounts[p] = (partnerCounts[p] || 0) + 1;
            });
        });

        const sorted = Object.entries(partnerCounts)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5); // top 5 partners

        const labels = sorted.map(x => x[0]);
        const values = sorted.map(x => x[1]);

        this.initChartCanvas('chart-partners', 'bar', {
            data: {
                labels,
                datasets: [{
                    data: values,
                    backgroundColor: getChartColor(ChartColors.Accent),
                    borderWidth: 0
                }]
            },
            options: {
                indexAxis: 'y',
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    x: {
                        grid: { color: 'rgba(255, 255, 255, 0.05)' },
                        ticks: { color: getChartColor(ChartColors.PrimaryText) }
                    },
                    y: {
                        grid: { display: false },
                        ticks: { color: getChartColor(ChartColors.PrimaryText), font: { size: 10 } }
                    }
                },
                plugins: {
                    legend: { display: false }
                }
            }
        });
    }

    renderCentersBar(data) {
        const counts = {};
        data.forEach(d => {
            const name = d.center || 'Self/Buddy';
            counts[name] = (counts[name] || 0) + 1;
        });

        const sorted = Object.entries(counts)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5);

        const labels = sorted.map(x => x[0]);
        const values = sorted.map(x => x[1]);

        this.initChartCanvas('chart-centers', 'bar', {
            data: {
                labels,
                datasets: [{
                    data: values,
                    backgroundColor: getChartColor(ChartColors.Cyan),
                    borderWidth: 0
                }]
            },
            options: {
                indexAxis: 'y',
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    x: {
                        grid: { color: 'rgba(255, 255, 255, 0.05)' },
                        ticks: { color: getChartColor(ChartColors.PrimaryText) }
                    },
                    y: {
                        grid: { display: false },
                        ticks: { color: getChartColor(ChartColors.PrimaryText), font: { size: 9 } }
                    }
                },
                plugins: {
                    legend: { display: false }
                }
            }
        });
    }

    renderAveragesTable(data) {
        const grouped = {};
        data.forEach(d => {
            const name = d.region || d.country || 'Unknown';
            if (!grouped[name]) {
                grouped[name] = { total: 0, count: 0 };
            }
            if (d.duration_minutes) {
                grouped[name].total += d.duration_minutes;
                grouped[name].count++;
            }
        });

        const tableData = Object.entries(grouped)
            .filter(x => x[1].count > 0)
            .map(x => ({
                name: x[0],
                avgTime: parseFloat((x[1].total / x[1].count).toFixed(2))
            }))
            .sort((a, b) => b.avgTime - a.avgTime);

        const tbody = this.querySelector('#avg-time-table-body');
        const btnPrev = this.querySelector('#btn-prev');
        const btnNext = this.querySelector('#btn-next');
        const txtPage = this.querySelector('#txt-page');

        if (!tbody) return;

        const totalItems = tableData.length;
        const totalPages = Math.ceil(totalItems / this.tablePageSize) || 1;

        if (this.tablePage > totalPages) this.tablePage = totalPages;

        const startIndex = (this.tablePage - 1) * this.tablePageSize;
        const endIndex = Math.min(startIndex + this.tablePageSize, totalItems);
        const pageItems = tableData.slice(startIndex, endIndex);

        tbody.innerHTML = pageItems.map(item => `
            <tr>
                <td>${item.name}</td>
                <td class="align-right" style="font-family: monospace; font-weight: bold;">${item.avgTime}</td>
            </tr>
        `).join('');

        if (pageItems.length === 0) {
            tbody.innerHTML = `<tr><td colspan="2" style="text-align: center;">No data</td></tr>`;
        }

        txtPage.textContent = totalItems > 0 ? `${startIndex + 1}-${endIndex} / ${totalItems}` : '0-0 / 0';
        
        btnPrev.disabled = this.tablePage <= 1;
        btnNext.disabled = this.tablePage >= totalPages;

        btnPrev.onclick = () => {
            this.tablePage--;
            this.renderAveragesTable(data);
        };

        btnNext.onclick = () => {
            this.tablePage++;
            this.renderAveragesTable(data);
        };
    }
}

customElements.define('health-dives-view', HealthDivesView);
