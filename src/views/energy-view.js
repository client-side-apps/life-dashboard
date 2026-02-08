import * as dataRepository from '../services/data-repository.js';
import { DataView } from '../components/data-view/data-view.js';
import { getChartColor, ChartColors } from '../utils/style.js';

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



        await this.loadCharts();
    }

    onDateRangeChanged() {
        this.loadCharts();
    }

    async loadCharts() {
        await this.showLoading();

        try {
            const startDate = this.startDate;
            const endDate = this.endDate;

            // Hypothetical table names: electricity, gas
            await this.createMultiLineChart('solar-chart', 'electricity_solar_hourly',
                [{ label: 'Solar Production', col: 'solar_kwh', color: getChartColor(ChartColors.Yellow) },
                { label: 'Consumption', col: 'consumption_kwh', color: getChartColor(ChartColors.Magenta) }],
                startDate, endDate);

            await this.createSingleLineChart('elec-import-chart', 'Electricity Import', 'electricity_grid_hourly', 'import_kwh', getChartColor(ChartColors.Cyan), startDate, endDate);

            await this.createSingleLineChart('gas-chart', 'Gas Import', 'gas_daily', 'usage_therms', getChartColor(ChartColors.Red), startDate, endDate);

            await this.createSingleLineChart('water-chart', 'Water Usage', 'water_daily', 'usage_liters', getChartColor(ChartColors.Blue), startDate, endDate);
        } catch (e) {
            console.error('EnergyView: Error loading charts', e);
        } finally {
            this.hideLoading();
        }
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
