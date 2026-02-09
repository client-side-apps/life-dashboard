import * as dataRepository from '../../services/data-repository.js';
import { DataView } from '../../components/data-view/data-view.js';
import { getChartColor, ChartColors } from '../../utils/style.js';

export class HealthNutritionView extends DataView {
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
                <chart-card title="Energy Intake" chart-id="energy-chart"></chart-card>
                <chart-card title="Macronutrients" chart-id="macros-chart"></chart-card>
                <chart-card title="Water Intake" chart-id="water-chart"></chart-card>
            </div>
        `;

        // Energy Chart
        this.createChart('energy-chart', 'Calories', 'nutrition_daily', 'energy_kcal', getChartColor(ChartColors.Yellow), startDate, endDate);

        // Macros Chart (Multi-series)
        this.createMultiSeriesChart('macros-chart', [
            { label: 'Protein (g)', key: 'protein_g', color: getChartColor(ChartColors.Red) },
            { label: 'Carbs (g)', key: 'carbs_g', color: getChartColor(ChartColors.Blue) },
            { label: 'Fat (g)', key: 'fat_g', color: getChartColor(ChartColors.Orange) }
        ], 'nutrition_daily', startDate, endDate);

        // Water Chart
        this.createChart('water-chart', 'Water (g)', 'nutrition_daily', 'water_g', getChartColor(ChartColors.Blue), startDate, endDate);
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
            interval: 'daily',
            fill: true
        });
    }

    async createMultiSeriesChart(chartId, seriesConfig, tableName, startDate, endDate) {
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
            series: seriesConfig,
            startDate: startDate,
            endDate: endDate,
            interval: 'daily',
            fill: true
        });
    }

    async checkTable(tableName) {
        const tables = dataRepository.getTables();
        return tables.includes(tableName);
    }
}

customElements.define('health-nutrition-view', HealthNutritionView);
