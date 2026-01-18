import { dbService } from '../db.js';
import Chart from 'chart.js';

export class HealthView extends HTMLElement {
    constructor() {
        super();
        this.charts = {}; // Store chart instances to destroy them
    }

    connectedCallback() {
        this.render();
    }

    disconnectedCallback() {
        Object.values(this.charts).forEach(chart => chart.destroy());
    }

    async render() {
        this.innerHTML = '';
        const template = document.getElementById('health-view-template');
        const content = template.content.cloneNode(true);
        this.appendChild(content);

        this.querySelectorAll('.health-nav button').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.querySelectorAll('.health-nav button').forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');
                this.loadSubView(e.target.dataset.subview);
            });
        });

        // Default view
        this.loadSubView('dashboard');
    }

    async loadSubView(subview) {
        const content = this.querySelector('#health-content');

        // Destroy existing charts
        Object.values(this.charts).forEach(chart => chart.destroy());
        this.charts = {};

        content.innerHTML = ''; // Clear

        if (subview === 'dashboard') {
            content.innerHTML = `
                <div class="dashboard-grid">
                    <div class="chart-container">
                        <h3>Weight</h3>
                        <canvas id="weight-chart"></canvas>
                    </div>
                    <div class="chart-container">
                        <h3>Sleep</h3>
                        <canvas id="sleep-chart"></canvas>
                    </div>
                    <div class="chart-container">
                        <h3>Steps</h3>
                        <canvas id="steps-chart"></canvas>
                    </div>
                </div>
            `;

            this.createChart('weight-chart', 'Weight', 'weight', 'kg', 'rgb(75, 192, 192)');
            this.createChart('sleep-chart', 'Sleep Duration', 'sleep', 'hours', 'rgb(153, 102, 255)');
            this.createChart('steps-chart', 'Steps', 'steps', 'count', 'rgb(255, 159, 64)');

        } else {
            content.innerHTML = `<h3>${subview.charAt(0).toUpperCase() + subview.slice(1)} view placeholder</h3>`;
        }
    }

    async createChart(canvasId, label, tableName, valueCol, color) {
        const ctx = document.getElementById(canvasId);
        if (!ctx) return;

        // Fetch data
        // Assume table has specific structure or try generic time/value
        const valid = await this.checkTable(tableName);
        if (!valid) {
            ctx.parentNode.innerHTML += `<p>Table "${tableName}" not found.</p>`;
            return;
        }

        const data = dbService.query(`SELECT * FROM "${tableName}" ORDER BY time DESC LIMIT 30`);
        // Reverse for chart (oldest to newest)
        data.reverse();

        const labels = data.map(d => new Date(d.time || d.date).toLocaleDateString());
        const values = data.map(d => d.value || d[valueCol] || 0);

        this.charts[canvasId] = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: label,
                    data: values,
                    borderColor: color,
                    tension: 0.1,
                    fill: false
                }]
            },
            options: {
                responsive: true,
                scales: {
                    y: {
                        beginAtZero: false
                    }
                }
            }
        });
    }

    async checkTable(tableName) {
        const tables = dbService.getTables();
        return tables.includes(tableName);
    }
}

customElements.define('health-view', HealthView);
