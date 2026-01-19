import { dbService } from '../db.js';

export class EnergyView extends HTMLElement {
    constructor() {
        super();
    }

    connectedCallback() {
        this.render();
    }

    async render() {
        this.innerHTML = '';
        const template = document.getElementById('energy-view-template');
        const content = template.content.cloneNode(true);
        this.appendChild(content);

        // Date selection logic
        const startInput = this.querySelector('#energy-start-date');
        const endInput = this.querySelector('#energy-end-date');
        const updateBtn = this.querySelector('#energy-update-btn');

        // Set default dates
        const today = new Date().toISOString().split('T')[0];
        endInput.value = today;

        // Find oldest date
        let oldestDate = today;
        try {
            const tables = dbService.getTables();
            let minDates = [];
            if (tables.includes('electricity_solar_hourly')) {
                const res = dbService.query('SELECT MIN(timestamp) as min_time FROM electricity_solar_hourly');
                if (res.length > 0 && res[0].min_time) minDates.push(res[0].min_time);
            }
            if (tables.includes('electricity_grid_hourly')) {
                const res = dbService.query('SELECT MIN(timestamp) as min_time FROM electricity_grid_hourly');
                if (res.length > 0 && res[0].min_time) minDates.push(res[0].min_time);
            }
            if (tables.includes('gas_daily')) {
                const res = dbService.query('SELECT MIN(timestamp) as min_time FROM gas_daily');
                if (res.length > 0 && res[0].min_time) minDates.push(res[0].min_time);
            }

            if (minDates.length > 0) {
                minDates.sort();
                oldestDate = minDates[0].split('T')[0];
            }
        } catch (e) {
            console.warn('Error fetching oldest date:', e);
        }
        startInput.value = oldestDate;

        const reloadHandler = () => this.loadCharts();
        startInput.addEventListener('change', reloadHandler);
        endInput.addEventListener('change', reloadHandler);

        await this.loadCharts();
    }

    async loadCharts() {
        const startInput = this.querySelector('#energy-start-date');
        const endInput = this.querySelector('#energy-end-date');

        const startDate = startInput ? startInput.value : null;
        const endDate = endInput ? endInput.value : null;

        // Hypothetical table names: electricity, gas
        await this.createMultiLineChart('solar-chart', 'electricity_solar_hourly',
            [{ label: 'Solar Production', col: 'solar_kwh', color: '#f1c40f' },
            { label: 'Consumption', col: 'consumption_kwh', color: '#2ecc71' }],
            startDate, endDate);

        await this.createSingleLineChart('elec-import-chart', 'Electricity Import', 'electricity_grid_hourly', 'import_kwh', '#3498db', startDate, endDate);

        await this.createSingleLineChart('gas-chart', 'Gas Import', 'gas_daily', 'usage_therms', '#e74c3c', startDate, endDate);
    }

    async createMultiLineChart(chartId, tableName, datasetsConfig, startDate, endDate) {
        const chartCard = this.querySelector(`chart-card[chart-id="${chartId}"]`);
        if (!chartCard) return;

        // Check table
        const tables = dbService.getTables();
        if (!tables.includes(tableName)) {
            // Try to find a partial match or fail gracefully
            // For redundancy, check if we have data columns in another table? 
            // Simplification: just show "No data" if table missing
            chartCard.innerHTML += `<p>Table "${tableName}" not found.</p>`;
            return;
        }

        let query = `SELECT * FROM "${tableName}"`;
        let params = [];

        if (startDate && endDate) {
            query += ` WHERE timestamp >= ? AND timestamp <= ?`;
            // Add time component to end date to cover the full day if needed, or if stored as ISO string
            // Assuming simplified YYYY-MM-DD string comparison or ISO
            params.push(startDate);
            params.push(endDate + 'T23:59:59');
        }
        query += ` ORDER BY timestamp ASC`; // Chart.js usually cleaner with sorted data if we use dates

        const data = dbService.query(query, params);
        // data.reverse(); // If ASC, no need to reverse

        chartCard.setDateRange(startDate, endDate);

        const labels = data.map(d => new Date(d.timestamp || d.date).toLocaleDateString());

        const datasets = datasetsConfig.map(cfg => ({
            label: cfg.label,
            data: data.map(d => d[cfg.col] || 0),
            borderColor: cfg.color,
            tension: 0.1,
            fill: false
        }));

        chartCard.setConfiguration({
            type: 'line',
            data: { labels, datasets },
            options: { responsive: true }
        });
    }

    async createSingleLineChart(chartId, label, tableName, valueCol, color, startDate, endDate) {
        const chartCard = this.querySelector(`chart-card[chart-id="${chartId}"]`);
        if (!chartCard) return;

        const tables = dbService.getTables();
        if (!tables.includes(tableName)) {
            chartCard.innerHTML += `<p>Table "${tableName}" not found.</p>`;
            return;
        }

        let query = `SELECT * FROM "${tableName}"`;
        let params = [];

        if (startDate && endDate) {
            query += ` WHERE timestamp >= ? AND timestamp <= ?`;
            params.push(startDate);
            params.push(endDate + 'T23:59:59');
        }
        query += ` ORDER BY timestamp ASC`;

        const data = dbService.query(query, params);

        chartCard.setDateRange(startDate, endDate);

        const labels = data.map(d => new Date(d.timestamp || d.date).toLocaleDateString());
        const values = data.map(d => d[valueCol] || 0);

        chartCard.setConfiguration({
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: label,
                    data: values,
                    borderColor: color,
                    tension: 0.1,
                    fill: false
                }]
            },
            options: { responsive: true }
        });
    }
}

customElements.define('energy-view', EnergyView);
