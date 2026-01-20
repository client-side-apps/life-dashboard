import { dbService } from '../db.js';

export class HealthView extends HTMLElement {
    constructor() {
        super();
    }

    connectedCallback() {
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

        datePicker.addEventListener('date-change', () => {
            // Reload current subview logic if needed, but for now just reload dashboard logic
            // Check if we are in dashboard mode
            // ideally we should reload whatever chart is on screen
            // But logic is inside loadSubView. 
            // We can just re-trigger loadSubView with current subview?
            // Need to know current subview.
            // Simplified: just assuming dashboard for the charts we are touching.
            const urlParams = new URLSearchParams(window.location.hash.split('?')[1]); // Hash routing makes this tricky
            // Let's just re-call loadSubView with currently active tab
            const activeLink = this.querySelector('.health-nav a.active');
            const subview = activeLink ? activeLink.dataset.subview : 'dashboard';
            this.loadSubView(subview);
        });

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

        const datePicker = this.querySelector('#health-date-picker');
        const startDate = datePicker ? datePicker.startDate : null;
        const endDate = datePicker ? datePicker.endDate : null;

        if (subview === 'dashboard') {
            content.innerHTML = `
                <div class="dashboard-grid">
                    <chart-card title="Weight" chart-id="weight-chart"></chart-card>
                    <chart-card title="Sleep Duration" chart-id="sleep-chart"></chart-card>
                    <chart-card title="Steps" chart-id="steps-chart"></chart-card>
                </div>
            `;

            this.createChart('weight-chart', 'Weight', 'weight', 'kg', 'rgb(75, 192, 192)', startDate, endDate);
            this.createChart('sleep-chart', 'Sleep Duration', 'sleep', 'hours', 'rgb(153, 102, 255)', startDate, endDate);
            this.createChart('steps-chart', 'Steps', 'steps', 'count', 'rgb(255, 159, 64)', startDate, endDate);

        } else {
            content.innerHTML = `<h3>${subview.charAt(0).toUpperCase() + subview.slice(1)} view placeholder</h3>`;
        }
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

    async checkTable(tableName) {
        const tables = dbService.getTables();
        return tables.includes(tableName);
    }
}

customElements.define('health-view', HealthView);
