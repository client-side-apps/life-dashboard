import { dbService } from '../db.js';
import { DataView } from '../components/data-view/data-view.js';

export class HealthView extends DataView {
    constructor() {
        super();
    }

    connectedCallback() {
        super.connectedCallback();
        this.render();
    }

    async render() {
        this.innerHTML = '';
        const template = document.getElementById('health-view-template');
        const content = template.content.cloneNode(true);
        this.appendChild(content);

        // Date selection logic
        const datePicker = this.querySelector('#health-date-picker');

        // Set default dates (Last 30 days)
        const today = new Date();
        const past30 = new Date();
        past30.setDate(today.getDate() - 30);

        const endDate = today.toISOString().split('T')[0];
        const startDate = past30.toISOString().split('T')[0];

        datePicker.startDate = startDate;
        datePicker.endDate = endDate;

        this.startDate = startDate;
        this.endDate = endDate;

        // Sub-navigation is now handled by the main router calling loadSubView
        // We just ensure the links are correct
        const links = this.querySelectorAll('.health-nav a');
        links.forEach(link => {
            const subview = link.dataset.subview;
            link.setAttribute('href', `#/health/${subview}`);
        });

        // Initial load will be triggered by router if subview is present in hash
        // or we default it here if not (router passes null/undefined)
    }

    onDateRangeChanged() {
        // Reload current subview logic
        const activeLink = this.querySelector('.health-nav a.active');
        const subview = activeLink ? activeLink.dataset.subview : 'dashboard';
        this.loadSubView(subview);
    }

    async loadSubView(subview) {
        // Default to dashboard if no subview
        if (!subview) subview = 'dashboard';

        // Update active class
        this.querySelectorAll('.health-nav a').forEach(a => {
            if (a.dataset.subview === subview) {
                a.classList.add('active');
            } else {
                a.classList.remove('active');
            }
        });

        const content = this.querySelector('#health-content');
        if (!content) return;

        content.innerHTML = ''; // Clear

        const startDate = this.startDate;
        const endDate = this.endDate;

        if (subview === 'dashboard') {
            content.innerHTML = `
                <div class="dashboard-grid">
                    <chart-card title="Weight" chart-id="weight-chart"></chart-card>
                    <chart-card title="Sleep Duration" chart-id="sleep-chart"></chart-card>
                    <chart-card title="Steps" chart-id="steps-chart"></chart-card>
                </div>
            `;

            this.createChart('weight-chart', 'Weight', 'weight', 'weight_kg', 'rgb(75, 192, 192)', startDate, endDate);
            this.createChart('sleep-chart', 'Sleep Duration', 'sleep', 'duration_hours', 'rgb(153, 102, 255)', startDate, endDate);
            this.createChart('steps-chart', 'Steps', 'steps', 'count', 'rgb(255, 159, 64)', startDate, endDate);

        } else if (subview === 'body') {
            content.innerHTML = `
                <div class="dashboard-grid">
                    <chart-card title="Weight" chart-id="body-weight-chart"></chart-card>
                    <chart-card title="Height" chart-id="body-height-chart"></chart-card>
                    <chart-card title="Body Temperature" chart-id="body-temp-chart"></chart-card>
                </div>
            `;
            this.createChart('body-weight-chart', 'Weight', 'weight', 'weight_kg', 'rgb(75, 192, 192)', startDate, endDate);
            this.createChart('body-height-chart', 'Height', 'height', 'height_m', 'rgb(54, 162, 235)', startDate, endDate);
            this.createChart('body-temp-chart', 'Temperature', 'body_temperature', 'temperature_c', 'rgb(255, 99, 132)', startDate, endDate);

        } else if (subview === 'heart') {
            content.innerHTML = `
                <div class="dashboard-grid">
                    <chart-card title="Blood Pressure" chart-id="bp-chart"></chart-card>
                    <chart-card title="Heart Rate" chart-id="hr-chart"></chart-card>
                </div>
            `;
            // For BP we need Systolic and Diastolic. createChart only supports one series.
            // We'll manually call logic or extend createChart.
            // For now, let's render Systolic as main, or implement a multi-series helper.
            // Let's implement a multi-series helper method.
            this.createMultiSeriesChart('bp-chart', [
                { label: 'Systolic', key: 'systolic_mmhg', color: 'rgb(255, 99, 132)' },
                { label: 'Diastolic', key: 'diastolic_mmhg', color: 'rgb(54, 162, 235)' }
            ], 'blood_pressure', startDate, endDate);

            this.createChart('hr-chart', 'Heart Rate', 'blood_pressure', 'heart_rate_bpm', 'rgb(255, 99, 132)', startDate, endDate);

        } else if (subview === 'sleep') {
            content.innerHTML = `
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

        } else if (subview === 'activity') {
            content.innerHTML = `
                <div class="dashboard-grid">
                    <chart-card title="Steps" chart-id="activity-steps-chart"></chart-card>
                </div>
                 <div class="list-container">
                    <h3>Recent Activities</h3>
                    <ul id="activity-list" class="data-list"></ul>
                </div>
            `;
            this.createChart('activity-steps-chart', 'Steps', 'steps', 'count', 'rgb(255, 159, 64)', startDate, endDate);
            this.renderActivityList(startDate, endDate);

        } else {
            content.innerHTML = `<h3>${subview.charAt(0).toUpperCase() + subview.slice(1)} view placeholder</h3>`;
        }
    }

    async renderActivityList(startDate, endDate) {
        const listContainer = this.querySelector('#activity-list');
        if (!listContainer) return;

        let query = `SELECT * FROM steps`;
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

            // Format duration of phases if available
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

        // Fetch data
        // Assume table has specific structure or try generic time/value
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
                key: valueCol || 'value', // Default to 'value' if not specified
                color: color
            }],
            startDate: startDate,
            endDate: endDate,
            interval: 'daily' // Most health data is daily
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
            series: seriesConfig,
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

customElements.define('health-view', HealthView);
