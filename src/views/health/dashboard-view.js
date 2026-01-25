import * as dataRepository from '../../services/data-repository.js';
import { DataView } from '../../components/data-view/data-view.js';

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
            </div>
        `;

        // We need to wait for chart-card elements to be upgraded if they aren't already,
        // but since we just set innerHTML, they are fresh.
        // We can just call createChart.

        this.createChart('weight-chart', 'Weight', 'weight', 'weight_kg', 'rgb(75, 192, 192)', startDate, endDate);
        this.createChart('sleep-chart', 'Sleep Duration', 'sleep', 'duration_hours', 'rgb(153, 102, 255)', startDate, endDate);
        this.createChart('steps-chart', 'Steps', 'steps', 'count', 'rgb(255, 159, 64)', startDate, endDate);
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
