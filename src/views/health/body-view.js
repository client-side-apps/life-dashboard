import { dbService } from '../../db.js';
import { DataView } from '../../components/data-view/data-view.js';

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
                <chart-card title="Height" chart-id="body-height-chart"></chart-card>
                <chart-card title="Body Temperature" chart-id="body-temp-chart"></chart-card>
            </div>
        `;

        this.createChart('body-weight-chart', 'Weight', 'weight', 'weight_kg', 'rgb(75, 192, 192)', startDate, endDate);
        this.createChart('body-height-chart', 'Height', 'height', 'height_m', 'rgb(54, 162, 235)', startDate, endDate);
        this.createChart('body-temp-chart', 'Temperature', 'body_temperature', 'temperature_c', 'rgb(255, 99, 132)', startDate, endDate);
    }

    async createChart(chartId, label, tableName, valueCol, color, startDate, endDate) {
        const chartCard = this.querySelector(`chart-card[chart-id="${chartId}"]`);
        if (!chartCard) return;

        const valid = await this.checkTable(tableName);
        if (!valid) {
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
        const tables = dbService.getTables();
        return tables.includes(tableName);
    }
}

customElements.define('health-body-view', HealthBodyView);
