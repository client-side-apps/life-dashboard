import { dbService } from '../db.js';
import { DataView } from '../components/data-view/data-view.js';

export class TimelineView extends DataView {
    constructor() {
        super();
        this.currentTable = 'location'; // Default, but allow selection
    }

    connectedCallback() {
        super.connectedCallback();
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

        // Initialize picker.
        // Default to today
        const today = new Date().toISOString().split('T')[0];
        const picker = this.querySelector('date-range-picker');
        if (picker) {
            picker.startDate = today;
            picker.endDate = today;
            this.startDate = today;
            this.endDate = today;
        }

        // loadData called implicitly? No, need to trigger.
        // If we set props, onDateRangeChanged will fire? 
        // No, we set via prop setter which calls updateChildren, NOT onDateRangeChanged unless we call it.
        // Wait, I updated DataView to call onDateRangeChanged in attributeChangedCallback, but props also call setAttribute.
        // So setting this.startDate -> calls setAttribute -> calls attributeChangedCallback -> calls onDateRangeChanged.
        // So setting dates above WILL trigger loadData via hook.
    }

    onDateRangeChanged() {
        this.loadData();
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
            // Wait for dates to start loadData
        } else if (tables.length > 0) {
            this.currentTable = tables[0];
            select.value = this.currentTable;
        }
    }

    loadData() {
        const content = this.querySelector('#timeline-content');
        if (!content) return;

        content.innerHTML = 'Loading...';

        const startDate = this.startDate;
        const endDate = this.endDate;

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

        if (startDate && endDate) {
            const startTs = new Date(startDate + 'T00:00:00').getTime();
            const endTs = new Date(endDate + 'T23:59:59.999').getTime();
            query += ` WHERE "${timeCol}" >= ? AND "${timeCol}" <= ?`;
            params.push(startTs);
            params.push(endTs);
        }

        query += ` ORDER BY "${timeCol}" DESC LIMIT 100`; // Limit for performance

        const data = dbService.query(query, params);

        if (data.length === 0) {
            content.innerHTML = 'No records found for this period.';
            return;
        }

        content.innerHTML = `
            <div class="timeline-list">
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
