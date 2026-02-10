import * as dataRepository from '../services/data-repository.js';
import { DataView } from '../components/data-view/data-view.js';
import { getChartColor, ChartColors } from '../utils/style.js';

export class EnergyView extends DataView {
    constructor() {
        super();
    }

    connectedCallback() {
        super.connectedCallback();
        // Stage 1: Immediate Loading State
        this.innerHTML = '<div class="loading-overlay" style="position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; background: rgba(255,255,255,0.8); z-index: 100;">Loading Energy View...</div>';

        // Stage 2: Defer full render to ensure paint
        setTimeout(() => {
            this.setupView();
            this.refresh();
        }, 50);
    }

    setupView() {
        this.innerHTML = '';
        const template = document.getElementById('energy-view-template');
        const content = template.content.cloneNode(true);
        this.appendChild(content);

        // Ensure overlay is visible initially (it might be hidden in template)
        // refresh() will handle it, but to avoid flash of content we can force it
        const loader = this.querySelector('.loading-overlay');
        if (loader) loader.classList.remove('hidden');
    }

    async loadData() {
        const startDate = this.startDate;
        const endDate = this.endDate;

        // All hourly electricity data (Grid + Solar) is in one table
        await this.createMultiLineChart('solar-chart', 'electricity_hourly',
            [{ label: 'Solar Production', col: 'solar_kwh', color: getChartColor(ChartColors.Yellow) },
            { label: 'Consumption', col: 'home_consumption_kwh', color: getChartColor(ChartColors.Magenta) }],
            startDate, endDate);

        // Grid Flow Chart: Merge Import and Export into Net Grid (Import - Export)
        const gridData = dataRepository.getTimeSeriesData('electricity_hourly', startDate, endDate, 'ASC');
        const netGridData = gridData.map(row => ({
            ...row,
            net_grid_kwh: (row.grid_import_kwh || 0) - (row.grid_export_kwh || 0)
        }));

        await this.renderMultiLineChart('grid-flow-chart', netGridData,
            [{ label: 'Net Grid (Import-Export)', col: 'net_grid_kwh', color: getChartColor(ChartColors.Orange) }],
            startDate, endDate);

        await this.createSingleLineChart('gas-chart', 'Gas Import', 'gas_daily', 'usage_therms', getChartColor(ChartColors.Red), startDate, endDate);

        await this.createSingleLineChart('water-chart', 'Water Usage', 'water_daily', 'usage_liters', getChartColor(ChartColors.Blue), startDate, endDate);
    }

    async createMultiLineChart(chartId, tableName, datasetsConfig, startDate, endDate) {
        const data = dataRepository.getTimeSeriesData(tableName, startDate, endDate, 'ASC');
        await this.renderMultiLineChart(chartId, data, datasetsConfig, startDate, endDate, tableName);
    }

    async renderMultiLineChart(chartId, data, datasetsConfig, startDate, endDate, tableName = '') {
        const chartCard = this.querySelector(`chart-card[chart-id="${chartId}"]`);
        if (!chartCard) return;

        chartCard.setDateRange(startDate, endDate);
        const interval = this._detectInterval(data, tableName);

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

        const interval = this._detectInterval(data, tableName);

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
    _detectInterval(data, tableName) {
        // Auto-detect interval from actual data spacing rather than table name
        if (data.length >= 2) {
            const gaps = [];
            for (let i = 1; i < Math.min(data.length, 10); i++) {
                gaps.push(data[i].timestamp - data[i - 1].timestamp);
            }
            const medianGap = gaps.sort((a, b) => a - b)[Math.floor(gaps.length / 2)];
            // If median gap is >= 12 hours, treat as daily
            if (medianGap >= 12 * 3600 * 1000) return 'daily';
            return 'hourly';
        }
        // Fallback to table name heuristic
        return tableName.includes('hourly') ? 'hourly' : 'daily';
    }
}

customElements.define('energy-view', EnergyView);
