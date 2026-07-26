import * as dataRepository from '../../services/data-repository.js';
import { DataView } from '../../components/data-view/data-view.js';
import { getChartColor, ChartColors } from '../../utils/style.js';

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
                <chart-card title="Active Time (7-day total)" chart-id="activity-active-time-chart"></chart-card>
            </div>
             <div class="list-container">
                <div class="list-header">
                    <h3>Recent Activities</h3>
                    <div id="activity-filter-container"></div>
                </div>
                <ul id="activity-list" class="data-list"></ul>
            </div>
        `;

        this.createChart('activity-steps-chart', 'Steps', 'steps', 'count', getChartColor(ChartColors.Green), startDate, endDate);
        this.createActiveTimeChart(startDate, endDate);
        this.renderActivityList(startDate, endDate);
    }

    /**
     * Charts active time (total duration of activities that aren't walking)
     * as a 7-day rolling total, one point per day.
     */
    async createActiveTimeChart(startDate, endDate) {
        const chartCard = this.querySelector('chart-card[chart-id="activity-active-time-chart"]');
        if (!chartCard) return;

        const valid = await this.checkTable('activities');
        if (!valid) {
            chartCard.innerHTML += `<p>Table "activities" not found.</p>`;
            return;
        }

        const dayMs = 24 * 3600 * 1000;
        const startTs = new Date(startDate + 'T00:00:00').getTime();
        const endTs = new Date(endDate + 'T23:59:59.999').getTime();

        // Read 6 extra days back so the first days of the range have a full window.
        const rows = dataRepository.getTimestampRangeData('activities', startTs - 6 * dayMs, endTs, 'ASC');

        const minutesByDay = new Map();
        rows.forEach(row => {
            if (!row.type || row.type === 'Walking') return;
            if (!row.end_timestamp || row.end_timestamp <= row.timestamp) return;
            const dayTs = new Date(row.timestamp).setHours(0, 0, 0, 0);
            const minutes = (row.end_timestamp - row.timestamp) / 60000;
            minutesByDay.set(dayTs, (minutesByDay.get(dayTs) || 0) + minutes);
        });

        const data = [];
        for (let dayTs = startTs; dayTs <= endTs; dayTs = new Date(dayTs + dayMs).setHours(0, 0, 0, 0)) {
            let weeklyMinutes = 0;
            for (let i = 0; i < 7; i++) {
                const windowDayTs = new Date(dayTs - i * dayMs).setHours(0, 0, 0, 0);
                weeklyMinutes += minutesByDay.get(windowDayTs) || 0;
            }
            data.push({ timestamp: dayTs, active_hours: Math.round(weeklyMinutes / 60 * 10) / 10 });
        }

        chartCard.setDateRange(startDate, endDate);
        chartCard.setTimeSeriesData(data, {
            series: [{
                label: 'Active Time (h)',
                key: 'active_hours',
                color: getChartColor(ChartColors.Orange)
            }],
            startDate: startDate,
            endDate: endDate,
            interval: 'daily'
        });
    }

    async renderActivityList(startDate, endDate) {
        const listContainer = this.querySelector('#activity-list');
        const filterContainer = this.querySelector('#activity-filter-container');
        if (!listContainer) return;

        // 1. Get available activity types for the filter
        const types = dataRepository.getDistinctValues('steps', 'type');

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

        // 3. Fetch Data
        const data = dataRepository.getSteps({
            startDate,
            endDate,
            type: this.selectedType
        });

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

customElements.define('health-activity-view', HealthActivityView);
