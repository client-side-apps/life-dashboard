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
                <chart-card title="Active Time (min)" chart-id="activity-time-chart"></chart-card>
            </div>
             <div class="list-container">
                <div class="list-header">
                    <h3>Recent Activities</h3>
                    <div id="activity-filter-container"></div>
                </div>
                <ul id="activity-list" class="data-list"></ul>
            </div>
        `;

        this.createChart('activity-steps-chart', 'Steps', 'steps', 'count', getChartColor(ChartColors.Green), startDate, endDate, (data) => {
            return this.aggregateDailyData(data, 'count');
        });

        this.createChart('activity-time-chart', 'Active Time (min)', 'steps', 'duration', getChartColor(ChartColors.Blue), startDate, endDate, (data) => {
            // Filter out 'Walking' and convert duration to minutes
            return this.aggregateDailyData(data, 'duration', item => item.type !== 'Walking')
                .map(d => ({ ...d, duration: Math.round((d.duration || 0) / 60) }));
        });

        this.renderActivityList(startDate, endDate);
    }

    aggregateDailyData(data, valueKey, filterFn) {
        const dailyMap = new Map();

        data.forEach(item => {
            if (filterFn && !filterFn(item)) return;

            const date = new Date(item.timestamp);
            date.setHours(0, 0, 0, 0);
            const key = date.getTime();

            if (!dailyMap.has(key)) {
                dailyMap.set(key, 0);
            }
            dailyMap.set(key, dailyMap.get(key) + (item[valueKey] || 0));
        });

        return Array.from(dailyMap.entries()).map(([timestamp, value]) => ({
            timestamp,
            [valueKey]: value
        })).sort((a, b) => a.timestamp - b.timestamp);
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

    async createChart(chartId, label, tableName, valueCol, color, startDate, endDate, processDataFn) {
        const chartCard = this.querySelector(`chart-card[chart-id="${chartId}"]`);
        if (!chartCard) return;

        const valid = await this.checkTable(tableName);
        if (!valid) {
            chartCard.innerHTML += `<p>Table "${tableName}" not found.</p>`;
            return;
        }

        let data = dataRepository.getTimeSeriesData(tableName, startDate, endDate, 'ASC');

        if (processDataFn) {
            data = processDataFn(data);
        }

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
