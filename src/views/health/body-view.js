import * as dataRepository from '../../services/data-repository.js';
import { DataView } from '../../components/data-view/data-view.js';
import { getChartColor, ChartColors } from '../../utils/style.js';

export class HealthBodyView extends DataView {
    constructor() {
        super();
    }

    connectedCallback() {
        super.connectedCallback();
        this.render();
    }

    onDateRangeChanged() {
        this.render();
    }

    async render() {
        const startDate = this.startDate;
        const endDate = this.endDate;

        this.innerHTML = `
            <div class="dashboard-grid">
                <chart-card title="Weight" chart-id="body-weight-chart"></chart-card>
                <chart-card title="Body Composition" chart-id="body-composition-chart"></chart-card>
                <chart-card title="Height" chart-id="body-height-chart"></chart-card>
                <chart-card title="Body Temperature" chart-id="body-temp-chart"></chart-card>
            </div>
        `;

        this.createChart('body-weight-chart', 'Weight (kg)', 'weight', 'weight_kg', getChartColor(ChartColors.Magenta), startDate, endDate);
        this.renderCompositionChart('body-composition-chart', startDate, endDate);
        this.createChart('body-height-chart', 'Height (m)', 'height', 'height_m', getChartColor(ChartColors.Blue), startDate, endDate);
        this.createChart('body-temp-chart', 'Temperature (°C)', 'body_temperature', 'temperature_c', getChartColor(ChartColors.Red), startDate, endDate);
    }

    async renderCompositionChart(chartId, startDate, endDate) {
        const chartCard = this.querySelector(`chart-card[chart-id="${chartId}"]`);
        if (!chartCard) return;

        const data = dataRepository.getTimeSeriesData('weight', startDate, endDate, 'ASC');

        chartCard.setDateRange(startDate, endDate);
        chartCard.setTimeSeriesData(data, {
            series: [
                { label: 'Fat', key: 'fat_mass_kg', color: getChartColor(ChartColors.Yellow) },
                { label: 'Muscle', key: 'muscle_mass_kg', color: getChartColor(ChartColors.Red) },
                { label: 'Bone', key: 'bone_mass_kg', color: getChartColor(ChartColors.Blue) },
                { label: 'Water', key: 'hydration_kg', color: getChartColor(ChartColors.Cyan) }
            ],
            startDate: startDate,
            endDate: endDate,
            interval: 'daily',
            stacked: true,
            fill: true
        });
    }

    async createChart(chartId, label, tableName, valueCol, color, startDate, endDate) {
        const chartCard = this.querySelector(`chart-card[chart-id="${chartId}"]`);
        if (!chartCard) return;

        const valid = await this.checkTable(tableName);
        if (!valid) {
            chartCard.innerHTML += `<p>Table "${tableName}" not found.</p>`;
            return;
        }

        const data = dataRepository.getTimeSeriesData(tableName, startDate, endDate, 'ASC');

        chartCard.setDateRange(startDate, endDate);

        chartCard.setTimeSeriesData(data, {
            series: [{
                label: label,
                key: valueCol || 'value',
                color: color
            }],
            startDate: startDate,
            endDate: endDate,
            interval: 'daily'
        });
    }

    async checkTable(tableName) {
        const tables = dataRepository.getTables();
        return tables.includes(tableName);
    }
}

customElements.define('health-body-view', HealthBodyView);
