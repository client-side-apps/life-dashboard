import * as dataRepository from '../../services/data-repository.js';
import { DataView } from '../../components/data-view/data-view.js';

export class HealthHeartView extends DataView {
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
                <chart-card title="Blood Pressure" chart-id="bp-chart"></chart-card>
                <chart-card title="Heart Rate" chart-id="hr-chart"></chart-card>
            </div>
        `;

        this.createMultiSeriesChart('bp-chart', [
            { label: 'Systolic', key: 'systolic_mmhg', color: 'rgb(255, 99, 132)' },
            { label: 'Diastolic', key: 'diastolic_mmhg', color: 'rgb(54, 162, 235)' }
        ], 'blood_pressure', startDate, endDate);

        this.createChart('hr-chart', 'Heart Rate', 'blood_pressure', 'heart_rate_bpm', 'rgb(255, 99, 132)', startDate, endDate);
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
            interval: 'daily'
        });
    }

    async checkTable(tableName) {
        const tables = dataRepository.getTables();
        return tables.includes(tableName);
    }
}

customElements.define('health-heart-view', HealthHeartView);
