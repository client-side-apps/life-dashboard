import { dbService } from '../../db.js';
import { DataView } from '../../components/data-view/data-view.js';

export class HealthActivityView extends DataView {
    constructor() {
        super();
        this.selectedType = 'All';
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
                <chart-card title="Steps" chart-id="activity-steps-chart"></chart-card>
            </div>
             <div class="list-container">
                <div class="list-header">
                    <h3>Recent Activities</h3>
                    <div id="activity-filter-container"></div>
                </div>
                <ul id="activity-list" class="data-list"></ul>
            </div>
        `;

        this.createChart('activity-steps-chart', 'Steps', 'steps', 'count', 'rgb(255, 159, 64)', startDate, endDate);
        this.renderActivityList(startDate, endDate);
    }

    async renderActivityList(startDate, endDate) {
        const listContainer = this.querySelector('#activity-list');
        const filterContainer = this.querySelector('#activity-filter-container');
        if (!listContainer) return;

        // 1. Get available activity types for the filter
        const typesData = dbService.query('SELECT DISTINCT type FROM steps WHERE type IS NOT NULL ORDER BY type ASC');
        const types = typesData.map(r => r.type);

        // 2. Render Filter if it doesn't exist or needs update
        if (filterContainer && filterContainer.innerHTML === '') {
            const select = document.createElement('select');
            select.innerHTML = `<option value="All">All Types</option>` +
                types.map(t => `<option value="${t}" ${this.selectedType === t ? 'selected' : ''}>${t}</option>`).join('');

            select.addEventListener('change', (e) => {
                this.selectedType = e.target.value;
                this.renderActivityList(this.startDate, this.endDate); // Re-render list only
            });
            filterContainer.appendChild(select);
        }

        // 3. Build Query
        let query = `SELECT * FROM steps`;
        let params = [];
        let whereClauses = [];

        if (startDate && endDate) {
            whereClauses.push(`timestamp >= ? AND timestamp <= ?`);
            const startTs = new Date(startDate + 'T00:00:00').getTime();
            const endTs = new Date(endDate + 'T23:59:59.999').getTime();
            params.push(startTs);
            params.push(endTs);
        }

        if (this.selectedType && this.selectedType !== 'All') {
            whereClauses.push(`type = ?`);
            params.push(this.selectedType);
        }

        if (whereClauses.length > 0) {
            query += ` WHERE ` + whereClauses.join(' AND ');
        }

        query += ` ORDER BY timestamp DESC`;

        const data = dbService.query(query, params);

        if (data.length === 0) {
            listContainer.innerHTML = '<li>No activities found.</li>';
            return;
        }

        listContainer.innerHTML = data.map(item => {
            const date = new Date(item.timestamp).toLocaleString();
            const distance = item.distance ? `${(item.distance / 1000).toFixed(2)} km` : '';
            const calories = item.calories ? `${Math.round(item.calories)} kcal` : '';
            const type = item.type || 'Walking';

            return `
                <li class="activity-item">
                    <div class="activity-header">
                        <span class="activity-type">${type}</span>
                        <span class="activity-date">${date}</span>
                    </div>
                    <div class="activity-details">
                        <span>${item.count} steps</span>
                        ${distance ? `<span>${distance}</span>` : ''}
                        ${calories ? `<span>${calories}</span>` : ''}
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

customElements.define('health-activity-view', HealthActivityView);
