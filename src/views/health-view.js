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

        if (subview === 'dashboard') {
            content.innerHTML = `
                <div class="dashboard-grid">
                    <chart-card title="Weight" chart-id="weight-chart"></chart-card>
                    <chart-card title="Sleep Duration" chart-id="sleep-chart"></chart-card>
                    <chart-card title="Steps" chart-id="steps-chart"></chart-card>
                </div>
            `;

            this.createChart('weight-chart', 'Weight', 'weight', 'kg', 'rgb(75, 192, 192)');
            this.createChart('sleep-chart', 'Sleep Duration', 'sleep', 'hours', 'rgb(153, 102, 255)');
            this.createChart('steps-chart', 'Steps', 'steps', 'count', 'rgb(255, 159, 64)');

        } else {
            content.innerHTML = `<h3>${subview.charAt(0).toUpperCase() + subview.slice(1)} view placeholder</h3>`;
        }
    }

    async createChart(chartId, label, tableName, valueCol, color) {
        const chartCard = this.querySelector(`chart-card[chart-id="${chartId}"]`);
        if (!chartCard) return;

        // Fetch data
        // Assume table has specific structure or try generic time/value
        const valid = await this.checkTable(tableName);
        if (!valid) {
            chartCard.innerHTML += `<p>Table "${tableName}" not found.</p>`;
            return;
        }

        const data = dbService.query(`SELECT * FROM "${tableName}" ORDER BY time DESC LIMIT 30`);
        // Reverse for chart (oldest to newest)
        data.reverse();

        const labels = data.map(d => new Date(d.time || d.date).toLocaleDateString());
        const values = data.map(d => d.value || d[valueCol] || 0);

        chartCard.setConfiguration({
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
