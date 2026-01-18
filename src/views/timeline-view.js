import { dbService } from '../db.js';

export class TimelineView extends HTMLElement {
    constructor() {
        super();
        this.currentTable = 'location_history'; // Default, but allow selection
    }

    connectedCallback() {
        this.render();
    }

    async render() {
        this.innerHTML = '';
        const template = document.getElementById('timeline-view-template');
        const content = template.content.cloneNode(true);
        this.appendChild(content);

        this.loadTableOptions();

        this.querySelector('#timeline-table-select').addEventListener('change', (e) => {
            this.currentTable = e.target.value;
            this.loadData();
        });

        this.querySelector('#timeline-date-picker').addEventListener('change', (e) => {
            this.loadData(e.target.value);
        });
    }

    loadTableOptions() {
        const tables = dbService.getTables();
        const select = this.querySelector('#timeline-table-select');

        if (tables.length === 0) {
            select.innerHTML = '<option>No tables found</option>';
            return;
        }

        select.innerHTML = tables.map(t =>
            `<option value="${t}" ${t === this.currentTable ? 'selected' : ''}>${t}</option>`
        ).join('');

        if (tables.includes(this.currentTable)) {
            this.loadData();
        } else if (tables.length > 0) {
            this.currentTable = tables[0];
            select.value = this.currentTable;
            this.loadData();
        }
    }

    loadData(dateFilter = null) {
        const content = this.querySelector('#timeline-content');
        content.innerHTML = 'Loading...';

        // Find time column
        const sample = dbService.query(`SELECT * FROM "${this.currentTable}" LIMIT 1`);
        if (sample.length === 0) {
            content.innerHTML = 'Table is empty';
            return;
        }

        const columns = Object.keys(sample[0]);
        const timeCol = columns.find(c => /time|date|timestamp/i.test(c));

        if (!timeCol) {
            content.innerHTML = 'No timestamp column found in this table.';
            return;
        }

        let query = `SELECT * FROM "${this.currentTable}"`;
        let params = [];

        if (dateFilter) {
            // Assuming ISO string or similar in DB. Simple string match for date or range query needed.
            // If timestamp is integer (unix), this is harder.
            // For now, let's assume ISO string which is common in SQLite for readability or ints.
            // We'll try a LIKE query for string dates first.
            query += ` WHERE "${timeCol}" LIKE ?`;
            params.push(`${dateFilter}%`);
        }

        query += ` ORDER BY "${timeCol}" DESC LIMIT 100`; // Limit for performance

        const data = dbService.query(query, params);

        if (data.length === 0) {
            content.innerHTML = 'No records found for this period.';
            return;
        }

        content.innerHTML = `
            <div class="timeline-list" style="display: flex; flex-direction: column; gap: 1rem;">
                ${data.map(row => {
            const time = row[timeCol];
            // Display other columns simply
            const details = Object.entries(row)
                .filter(([k]) => k !== timeCol)
                .map(([k, v]) => `<div><strong>${k}:</strong> ${v}</div>`)
                .join('');

            return `
                        <div class="timeline-item">
                            <div class="timeline-time">${new Date(time).toLocaleString()}</div>
                            <div class="timeline-details">
                                ${details}
                            </div>
                        </div>
                    `;
        }).join('')}
            </div>
        `;
    }
}

customElements.define('timeline-view', TimelineView);
