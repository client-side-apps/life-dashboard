import { dbService } from '../db.js';

export class EnergyView extends HTMLElement {
    constructor() {
        super();
    }

    connectedCallback() {
        this.render();
    }

    async render() {
        this.innerHTML = '';
        const template = document.getElementById('energy-view-template');
        const content = template.content.cloneNode(true);
        this.appendChild(content);

        await this.loadCharts();
    }

    async loadCharts() {
        // Hypothetical table names: electricity, gas
        await this.createMultiLineChart('solar-chart', 'electricity',
            [{ label: 'Solar Production', col: 'solar', color: '#f1c40f' },
            { label: 'Consumption', col: 'consumption', color: '#2ecc71' }]);

        await this.createSingleLineChart('elec-import-chart', 'Electricity Import', 'electricity', 'import', '#3498db');

        await this.createSingleLineChart('gas-chart', 'Gas Import', 'gas', 'import', '#e74c3c');
    }

    async createMultiLineChart(chartId, tableName, datasetsConfig) {
        const chartCard = this.querySelector(`chart-card[chart-id="${chartId}"]`);
        if (!chartCard) return;

        // Check table
        const tables = dbService.getTables();
        if (!tables.includes(tableName)) {
            // Try to find a partial match or fail gracefully
            // For redundancy, check if we have data columns in another table? 
            // Simplification: just show "No data" if table missing
            chartCard.innerHTML += `<p>Table "${tableName}" not found.</p>`;
            return;
        }

        const data = dbService.query(`SELECT * FROM "${tableName}" ORDER BY time DESC LIMIT 1000`);
        data.reverse();

        const labels = data.map(d => new Date(d.time || d.date).toLocaleDateString());

        const datasets = datasetsConfig.map(cfg => ({
            label: cfg.label,
            data: data.map(d => d[cfg.col] || 0),
            borderColor: cfg.color,
            tension: 0.1,
            fill: false
        }));

        chartCard.setConfiguration({
            type: 'line',
            data: { labels, datasets },
            options: { responsive: true }
        });
    }

    async createSingleLineChart(chartId, label, tableName, valueCol, color) {
        const chartCard = this.querySelector(`chart-card[chart-id="${chartId}"]`);
        if (!chartCard) return;

        const tables = dbService.getTables();
        if (!tables.includes(tableName)) {
            chartCard.innerHTML += `<p>Table "${tableName}" not found.</p>`;
            return;
        }

        const data = dbService.query(`SELECT * FROM "${tableName}" ORDER BY time DESC LIMIT 1000`);
        data.reverse();

        const labels = data.map(d => new Date(d.time || d.date).toLocaleDateString());
        const values = data.map(d => d[valueCol] || 0);

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
            options: { responsive: true }
        });
    }
}

customElements.define('energy-view', EnergyView);
