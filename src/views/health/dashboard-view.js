import * as dataRepository from '../../services/data-repository.js';
import { DataView } from '../../components/data-view/data-view.js';
import { getChartColor, ChartColors } from '../../utils/style.js';

export class HealthDashboardView extends DataView {
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
                <chart-card title="Weight" chart-id="weight-chart"></chart-card>
                <chart-card title="Sleep Duration" chart-id="sleep-chart"></chart-card>
                <chart-card title="Steps" chart-id="steps-chart"></chart-card>
                <chart-card title="Nutrition (Energy Source)" chart-id="nutrition-chart"></chart-card>
            </div>
        `;

        // We need to wait for chart-card elements to be upgraded if they aren't already,
        // but since we just set innerHTML, they are fresh.
        // We can just call createChart.

        this.createChart('weight-chart', 'Weight', 'weight', 'weight_kg', getChartColor(ChartColors.Cyan), startDate, endDate);
        this.createChart('sleep-chart', 'Sleep Duration', 'sleep', 'duration_hours', getChartColor(ChartColors.Magenta), startDate, endDate);
        this.createChart('steps-chart', 'Steps', 'steps', 'count', getChartColor(ChartColors.Green), startDate, endDate);
        this.createNutritionChart('nutrition-chart', startDate, endDate);
    }

    async createNutritionChart(chartId, startDate, endDate) {
        const chartCard = this.querySelector(`chart-card[chart-id="${chartId}"]`);
        if (!chartCard) return;

        const valid = await this.checkTable('nutrition_daily');
        if (!valid) {
            chartCard.innerHTML += `<p>Table "nutrition_daily" not found.</p>`;
            return;
        }

        const data = await dataRepository.getTimeSeriesData('nutrition_daily', startDate, endDate, 'ASC');

        // Transform data: Calculate calories from macros
        // Fat: 9, Protein: 4, Carb: 4
        const transformedData = data.map(row => ({
            timestamp: row.timestamp,
            fat_kcal: (row.fat_g || 0) * 9,
            protein_kcal: (row.protein_g || 0) * 4,
            carbs_kcal: (row.carbs_g || 0) * 4
        }));

        chartCard.setDateRange(startDate, endDate);

        chartCard.setChartData({
            labels: transformedData.map(d => new Date(d.timestamp).toLocaleDateString()),
            datasets: [
                {
                    label: 'Fat (kcal)',
                    data: transformedData.map(d => d.fat_kcal),
                    backgroundColor: getChartColor(ChartColors.Orange),
                    stack: 'Stack 0'
                },
                {
                    label: 'Protein (kcal)',
                    data: transformedData.map(d => d.protein_kcal),
                    backgroundColor: getChartColor(ChartColors.Red),
                    stack: 'Stack 0'
                },
                {
                    label: 'Carbs (kcal)',
                    data: transformedData.map(d => d.carbs_kcal),
                    backgroundColor: getChartColor(ChartColors.Blue),
                    stack: 'Stack 0'
                }
            ]
        }, {
            type: 'bar',
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                x: {
                    stacked: true
                },
                y: {
                    stacked: true,
                    title: {
                        display: true,
                        text: 'Calories'
                    }
                }
            }
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

customElements.define('health-dashboard-view', HealthDashboardView);
