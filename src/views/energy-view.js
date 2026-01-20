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
        const datePicker = this.querySelector('#energy-date-picker');

        // Set default dates
        const today = new Date().toISOString().split('T')[0];

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
                // minDates are integers (timestamps)
                minDates.sort((a, b) => a - b);
                oldestDate = new Date(minDates[0]).toISOString().split('T')[0];
            }
        } catch (e) {
            console.warn('Error fetching oldest date:', e);
        }

        datePicker.startDate = oldestDate;
        datePicker.endDate = today;

        datePicker.addEventListener('date-change', () => this.loadCharts());

        await this.loadCharts();
    }

    async loadCharts() {
        const datePicker = this.querySelector('#energy-date-picker');

        const startDate = datePicker ? datePicker.startDate : null;
        const endDate = datePicker ? datePicker.endDate : null;

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
            chartCard.innerHTML += `<p>Table "${tableName}" not found.</p>`;
            return;
        }

        let query = `SELECT * FROM "${tableName}"`;
        let params = [];

        if (startDate && endDate) {
            query += ` WHERE timestamp >= ? AND timestamp <= ?`;
            // Convert String dates to Integer timestamps (Local Day boundaries)
            const startTs = new Date(startDate + 'T00:00:00').getTime();
            const endTs = new Date(endDate + 'T23:59:59.999').getTime();
            params.push(startTs);
            params.push(endTs);
        }
        query += ` ORDER BY timestamp ASC`;

        const data = dbService.query(query, params);

        chartCard.setDateRange(startDate, endDate);

        // Deduce interval from table name
        const interval = tableName.includes('hourly') ? 'hourly' : 'daily';

        chartCard.setTimeSeriesData(data, {
            series: datasetsConfig.map(cfg => ({
                label: cfg.label,
                key: cfg.col,
                color: cfg.color
            })),
            interval: interval,
            startDate: startDate,
            endDate: endDate
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
            const startTs = new Date(startDate + 'T00:00:00').getTime();
            const endTs = new Date(endDate + 'T23:59:59.999').getTime();
            params.push(startTs);
            params.push(endTs);
        }
        query += ` ORDER BY timestamp ASC`;

        const data = dbService.query(query, params);

        chartCard.setDateRange(startDate, endDate);

        // Deduce interval from table name
        const interval = tableName.includes('hourly') ? 'hourly' : 'daily';

        chartCard.setTimeSeriesData(data, {
            series: [{
                label: label,
                key: valueCol,
                color: color
            }],
            interval: interval,
            startDate: startDate,
            endDate: endDate
        });
    }
}

customElements.define('energy-view', EnergyView);
