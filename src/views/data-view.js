import { dbService } from '../db.js';

export class DataView {
    constructor() {
        this.container = null;
        this.currentTable = '';
    }

    async render(container) {
        this.container = container;

        const template = document.getElementById('data-view-template');
        const content = template.content.cloneNode(true);
        container.appendChild(content);

        this.loadTableOptions();
    }

    loadTableOptions() {
        const tables = dbService.getTables();
        const select = this.container.querySelector('#data-table-select');

        select.innerHTML = '<option value="" disabled selected>Select Table</option>' +
            tables.map(t => `<option value="${t}">${t}</option>`).join('');

        select.addEventListener('change', (e) => {
            this.currentTable = e.target.value;
            this.loadData();
        });
    }

    async loadData() {
        if (!this.currentTable) return;

        const table = this.container.querySelector('#data-table');
        const thead = table.querySelector('thead');
        const tbody = table.querySelector('tbody');
        const countSpan = this.container.querySelector('#data-count');

        tbody.innerHTML = '<tr><td style="padding: 1rem;">Loading...</td></tr>';

        // Fetch columns first or just fetch data and infer
        const data = dbService.getAll(this.currentTable, 100); // Limit 100 for now

        if (data.length === 0) {
            tbody.innerHTML = '<tr><td style="padding: 1rem;">Table is empty</td></tr>';
            thead.innerHTML = '';
            countSpan.textContent = '0 rows';
            return;
        }

        countSpan.textContent = `Showing first ${data.length} rows`;

        const columns = Object.keys(data[0]);

        thead.innerHTML = `
            <tr>
                ${columns.map(c => `<th>${c}</th>`).join('')}
            </tr>
        `;

        tbody.innerHTML = data.map(row => `
            <tr>
                ${columns.map(c => `<td>${row[c] !== null ? row[c] : '<em style="opacity:0.5">null</em>'}</td>`).join('')}
            </tr>
        `).join('');
    }

    destroy() { }
}
