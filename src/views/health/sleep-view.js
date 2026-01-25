import { dbService } from '../../db.js';
import { DataView } from '../../components/data-view/data-view.js';

export class HealthSleepView extends DataView {
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
                <chart-card title="Sleep Duration" chart-id="sleep-detail-chart"></chart-card>
            </div>
            <div class="list-container">
                <h3>Sleep History</h3>
                <ul id="sleep-list" class="data-list"></ul>
            </div>
        `;

        this.createChart('sleep-detail-chart', 'Sleep Duration', 'sleep', 'duration_hours', 'rgb(153, 102, 255)', startDate, endDate);
        this.renderSleepList(startDate, endDate);
    }

    async renderSleepList(startDate, endDate) {
        const listContainer = this.querySelector('#sleep-list');
        if (!listContainer) return;

        let query = `SELECT * FROM sleep`;
        let params = [];

        if (startDate && endDate) {
            query += ` WHERE timestamp >= ? AND timestamp <= ?`;
            const startTs = new Date(startDate + 'T00:00:00').getTime();
            const endTs = new Date(endDate + 'T23:59:59.999').getTime();
            params.push(startTs);
            params.push(endTs);
        }
        query += ` ORDER BY timestamp DESC`;

        const data = dbService.query(query, params);

        if (data.length === 0) {
            listContainer.innerHTML = '<li>No sleep records found.</li>';
            return;
        }

        listContainer.innerHTML = data.map(item => {
            const date = new Date(item.timestamp).toLocaleDateString();
            const duration = item.duration_hours.toFixed(1) + 'h';

            const formatTime = (seconds) => {
                if (!seconds) return '0h 0m';
                const h = Math.floor(seconds / 3600);
                const m = Math.floor((seconds % 3600) / 60);
                return `${h}h ${m}m`;
            };

            const deep = item.deep_seconds ? formatTime(item.deep_seconds) : 'N/A';
            const light = item.light_seconds ? formatTime(item.light_seconds) : 'N/A';
            const rem = item.rem_seconds ? formatTime(item.rem_seconds) : 'N/A';
            const awake = item.awake_seconds ? formatTime(item.awake_seconds) : 'N/A';

            return `
                <li class="sleep-item">
                    <div class="sleep-header">
                        <span class="sleep-date">${date}</span>
                        <span class="sleep-duration">${duration} Total</span>
                    </div>
                    <div class="sleep-details">
                        <span title="Deep Sleep">Deep: ${deep}</span>
                        <span title="Light Sleep">Light: ${light}</span>
                        <span title="REM Sleep">REM: ${rem}</span>
                        <span title="Awake">Awake: ${awake}</span>
                    </div>
                </li>
            `;
        }).join('');
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

customElements.define('health-sleep-view', HealthSleepView);
