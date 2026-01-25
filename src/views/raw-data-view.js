import * as dataRepository from '../services/data-repository.js';
import { DataView } from '../components/data-view/data-view.js';

export class RawDataView extends DataView {
    constructor() {
        super();
        this.currentTable = null;
    }

    connectedCallback() {
        super.connectedCallback();
        this.render();
    }

    async render() {
        this.innerHTML = '';
        const template = document.getElementById('raw-data-view-template');
        const content = template.content.cloneNode(true);
        this.appendChild(content);

        this.loadTableOptions();
    }

    onDateRangeChanged() {
        this.loadTableData();
    }

    loadTableOptions() {
        const downloadBtn = this.querySelector('#download-db-btn');
        if (downloadBtn) {
            downloadBtn.addEventListener('click', () => this.downloadDatabase());
        }

        // Assuming the 'open-db-btn' is added to the raw-data-view-template HTML
        const openDbBtn = this.querySelector('#open-db-btn');
        if (openDbBtn) {
            openDbBtn.addEventListener('click', () => {
                // Placeholder for open database logic
                alert('Open Database functionality not yet implemented.');
                // You would typically trigger a file input here to load a database file
            });
        }

        const importBtn = this.querySelector('#import-data-btn');
        if (importBtn) {
            importBtn.addEventListener('click', () => {
                window.location.hash = '#/import';
            });
        }

        const tables = dataRepository.getTables();
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
        // DataView handles this via onDateRangeChanged
        // The picker in the template needs to be detected by DataView's mechanism
        // Since we render from template, DataView's observer will pick it up
    }

    async downloadDatabase() {
        try {
            const data = dataRepository.exportDatabase();
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

        const startDate = this.startDate;
        const endDate = this.endDate;

        let query = `SELECT * FROM "${this.currentTable}"`;
        let params = [];
        let dateColumn = null;

        // Detect date column by checking first row or schema
        // Simplest way: check column names from a limit 1 query
        const schemaCheck = dataRepository.executeQuery(`SELECT * FROM "${this.currentTable}" LIMIT 1`);
        if (schemaCheck.length > 0) {
            const cols = Object.keys(schemaCheck[0]);
            // Priority list of date column names
            const dateCols = ['timestamp', 'time', 'date', 'time_watched', 'created_at', 'datetime'];
            dateColumn = dateCols.find(col => cols.includes(col));
        }

        if (dateColumn && startDate && endDate) {
            query += ` WHERE "${dateColumn}" >= ? AND "${dateColumn}" <= ?`;
            // Convert to integer timestamp (Local Day)
            const startTs = new Date(startDate + 'T00:00:00').getTime();
            const endTs = new Date(endDate + 'T23:59:59.999').getTime();
            params.push(startTs);
            params.push(endTs);
            query += ` ORDER BY "${dateColumn}" DESC`;
        } else if (dateColumn) {
            query += ` ORDER BY "${dateColumn}" DESC`;
        }

        query += ` LIMIT 100`;

        const data = dataRepository.executeQuery(query, params);

        if (data.length > 0) {
            console.log(`Loaded table ${this.currentTable}. Columns:`, Object.keys(data[0]));
        } else {
            // If data is empty, we can't easily see columns unless we use PRAGMA
            const info = dataRepository.executeQuery(`PRAGMA table_info("${this.currentTable}")`);
            console.log(`Loaded table ${this.currentTable} (empty). Schema:`, info);
        }

        const table = this.querySelector('#data-table');
        const thead = table.querySelector('thead');
        const tbody = table.querySelector('tbody');
        const countSpan = this.querySelector('#data-count');

        thead.innerHTML = '';
        tbody.innerHTML = '';
        countSpan.textContent = '';

        if (data.length === 0) {
            tbody.innerHTML = '<tr><td class="table-empty-message">No data found</td></tr>';
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
                // Format timestamp if it's the probable date column and is a number
                if (col === dateColumn && typeof row[col] === 'number') {
                    td.textContent = new Date(row[col]).toLocaleString();
                } else {
                    td.textContent = row[col];
                }
                tr.appendChild(td);
            });
            tbody.appendChild(tr);
        });
    }
}

customElements.define('raw-data-view', RawDataView);

