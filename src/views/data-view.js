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
        const downloadBtn = this.querySelector('#download-db-btn');
        if (downloadBtn) {
            downloadBtn.addEventListener('click', () => this.downloadDatabase());
        }

        const importBtn = this.querySelector('#import-data-btn');
        if (importBtn) {
            importBtn.addEventListener('click', () => {
                window.location.hash = '#/import';
            });
        }

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

        // Date picker listener
        const datePicker = this.querySelector('#data-date-picker');
        if (datePicker) {
            datePicker.addEventListener('date-change', () => this.loadTableData());
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

        const datePicker = this.querySelector('#data-date-picker');
        const startDate = datePicker ? datePicker.startDate : null;
        const endDate = datePicker ? datePicker.endDate : null;

        let query = `SELECT * FROM "${this.currentTable}"`;
        let params = [];
        let dateColumn = null;

        // Detect date column by checking first row or schema
        // Simplest way: check column names from a limit 1 query
        const schemaCheck = dbService.query(`SELECT * FROM "${this.currentTable}" LIMIT 1`);
        if (schemaCheck.length > 0) {
            const cols = Object.keys(schemaCheck[0]);
            // Priority list of date column names
            const dateCols = ['timestamp', 'time', 'date', 'time_watched', 'created_at', 'datetime'];
            dateColumn = dateCols.find(col => cols.includes(col));
        }

        if (dateColumn && startDate && endDate) {
            query += ` WHERE "${dateColumn}" >= ? AND "${dateColumn}" <= ?`;
            params.push(startDate);
            // Append end of day time for end date
            params.push(endDate + (endDate.includes('T') ? '' : 'T23:59:59'));
            query += ` ORDER BY "${dateColumn}" DESC`;
        } else if (dateColumn) {
            query += ` ORDER BY "${dateColumn}" DESC`;
        }

        query += ` LIMIT 100`;

        const data = dbService.query(query, params);

        const table = this.querySelector('#data-table');
        const thead = table.querySelector('thead');
        const tbody = table.querySelector('tbody');
        const countSpan = this.querySelector('#data-count');

        thead.innerHTML = '';
        tbody.innerHTML = '';
        countSpan.textContent = '';

        if (data.length === 0) {
            tbody.innerHTML = '<tr><td style="text-align:center; padding: 1rem;">No data found</td></tr>';
            return;
        }

        countSpan.textContent = `Showing ${data.length} rows` + (dateColumn ? ` (sorted by ${dateColumn})` : '');

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

