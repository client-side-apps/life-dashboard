import * as dataRepository from '../services/data-repository.js';
import { DataView } from '../components/data-view/data-view.js';

export class EnergyView extends DataView {
    constructor() {
        super();
    }

    connectedCallback() {
        super.connectedCallback();
        this.render();
    }

    async render() {
        this.innerHTML = '';
        const template = document.getElementById('energy-view-template');
        const content = template.content.cloneNode(true);
        this.appendChild(content);

        // Date selection logic
        const datePicker = this.querySelector('#energy-date-picker');

        // Set default dates logic remains, but we push it to the picker which syncs back to us
        const today = new Date().toISOString().split('T')[0];

        // Find oldest date
        let oldestDate = today;
        try {
            oldestDate = dataRepository.getEnergyOldestDate();
        } catch (e) {
            console.warn('Error fetching oldest date:', e);
        }

        // Initialize picker. DataView listens to this via MutationObserver/bubbling
        datePicker.startDate = oldestDate;
        datePicker.endDate = today;

        // Ensure we initialize our own state too if the picker doesn't bubble immediately on set
        // But DataView setupDatePicker tries to sync.
        // Let's force sync or just call loadCharts which reads from properties
        this.startDate = oldestDate;
        this.endDate = today;

        await this.loadCharts();
    }

    onDateRangeChanged() {
        this.loadCharts();
    }

    async loadCharts() {
        const startDate = this.startDate;
        const endDate = this.endDate;

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
        const tables = dataRepository.getTables();
        if (!tables.includes(tableName)) {
            chartCard.innerHTML += `<p>Table "${tableName}" not found.</p>`;
            return;
        }

        const data = dataRepository.getTimeSeriesData(tableName, startDate, endDate, 'ASC');

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

        const tables = dataRepository.getTables();
        if (!tables.includes(tableName)) {
            chartCard.innerHTML += `<p>Table "${tableName}" not found.</p>`;
            return;
        }

        const data = dataRepository.getTimeSeriesData(tableName, startDate, endDate, 'ASC');

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
