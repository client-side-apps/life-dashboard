import { dbService } from '../db.js';

export class DataView extends HTMLElement {
    constructor() {
        super();
        this.currentTable = null;
    }

    connectedCallback() {
        this.render();
    }

    async render() {
        this.innerHTML = '';
        const template = document.getElementById('data-view-template');
        const content = template.content.cloneNode(true);
        this.appendChild(content);

        this.loadTableOptions();
    }

    loadTableOptions() {
        const tables = dbService.getTables();
        const select = this.querySelector('#data-table-select');

        if (tables.length === 0) {
            select.innerHTML = '<option value="" disabled selected>No tables found</option>';
            return;
        }

        select.innerHTML = '<option value="" disabled selected>Select Table</option>' +
            tables.map(t => `<option value="${t}">${t}</option>`).join('');

        select.addEventListener('change', (e) => {
            this.currentTable = e.target.value;
            this.loadTableData();
        });

        const downloadBtn = this.querySelector('#download-db-btn');
        if (downloadBtn) {
            downloadBtn.addEventListener('click', () => this.downloadDatabase());
        }
    }

    async downloadDatabase() {
        try {
            const data = dbService.export();
            const blob = new Blob([data], { type: 'application/octet-stream' });
            const url = URL.createObjectURL(blob);

            const a = document.createElement('a');
            a.href = url;
            a.download = 'life-dashboard.sqlite';
            document.body.appendChild(a);
            a.click();

            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        } catch (error) {
            console.error('Failed to export database:', error);
            alert('Failed to export database');
        }
    }

    async loadTableData() {
        if (!this.currentTable) return;

        const data = dbService.getAll(this.currentTable, 100); // Limit 100 for display
        const table = this.querySelector('#data-table');
        const thead = table.querySelector('thead');
        const tbody = table.querySelector('tbody');
        const countSpan = this.querySelector('#data-count');

        thead.innerHTML = '';
        tbody.innerHTML = '';
        countSpan.textContent = '';

        if (data.length === 0) {
            tbody.innerHTML = '<tr><td style="text-align:center; padding: 1rem;">Table is empty</td></tr>';
            return;
        }

        countSpan.textContent = `Showing first ${data.length} rows`;

        // Headers
        const columns = Object.keys(data[0]);
        const headerRow = document.createElement('tr');
        columns.forEach(col => {
            const th = document.createElement('th');
            th.textContent = col;
            headerRow.appendChild(th);
        });
        thead.appendChild(headerRow);

        // Body
        data.forEach(row => {
            const tr = document.createElement('tr');
            columns.forEach(col => {
                const td = document.createElement('td');
                td.textContent = row[col];
                tr.appendChild(td);
            });
            tbody.appendChild(tr);
        });
    }
}

customElements.define('data-view', DataView);

