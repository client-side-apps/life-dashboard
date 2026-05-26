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
        
        // Embed Import View
        const importContainer = this.querySelector('#import-view-container');
        if (importContainer) {
            const importView = document.createElement('import-view');
            importContainer.appendChild(importView);
        }

        // Add styles for layout
        const style = document.createElement('style');
        style.textContent = `
            .data-view-layout {
                display: flex;
                flex-direction: column;
                gap: 2rem;
            }
            .data-section {
                border: none;
                padding: 1rem 0;
                background: var(--bg-color);
            }
            .data-section h3 {
                border-bottom: none;
                padding-bottom: 0.5rem;
                margin-bottom: 1rem;
                text-transform: uppercase;
                font-size: 1.1rem;
            }
            .section-controls {
                display: flex;
                gap: 1rem;
                flex-wrap: wrap;
            }
            /* Hide redundant headers in embedded import view */
            import-view h1, import-view .card > h2 {
                display: none;
            }
            import-view .card {
                border: none;
                padding: 0;
                margin: 0;
            }
            import-view .import-container {
                padding: 0;
            }
            import-view {
                padding: 0 !important;
            }
            import-view .file-input {
                display: inline-block !important;
                opacity: 1 !important;
                width: auto !important;
                border: none !important;
            }
            import-view .import-actions {
                display: flex;
                align-items: center;
                gap: 1rem;
                flex-wrap: wrap;
            }
            import-view .file-input-wrapper {
                display: inline-block;
            }
            .note-cell-container {
                display: flex;
                align-items: center;
                justify-content: space-between;
                gap: 0.5rem;
                width: 100%;
                min-width: 150px;
            }
            .note-text {
                flex: 1;
                white-space: normal;
                word-break: break-word;
            }
            .placeholder-note {
                color: #888;
                font-style: italic;
                cursor: pointer;
            }
            .edit-note-btn {
                background: none;
                border: none;
                cursor: pointer;
                font-size: 0.85rem;
                padding: 2px 4px;
                opacity: 0.5;
                transition: opacity 0.2s;
            }
            .note-cell-container:hover .edit-note-btn {
                opacity: 1;
            }
            .note-edit-input {
                width: 100%;
                padding: 4px;
                font-family: inherit;
                font-size: inherit;
                border: 1px solid var(--border-color);
                background: var(--bg-color);
                color: var(--text-color);
            }
        `;
        this.appendChild(style);

        this.loadTableOptions();
        // If we have a default table or restored state, load it.
        if (this.currentTable) {
            await this.loadTableData();
        }
    }

    onDateRangeChanged() {
        this.loadTableData();
    }

    loadTableOptions() {
        const downloadBtn = this.querySelector('#download-db-btn');
        if (downloadBtn) {
            downloadBtn.addEventListener('click', () => this.downloadDatabase());
        }

        const openDbBtn = this.querySelector('#open-db-btn');
        if (openDbBtn) {
            openDbBtn.addEventListener('click', () => {
                const globalInput = document.getElementById('start-db-input');
                if (globalInput) {
                    globalInput.click();
                } else {
                    alert('Open Database functionality not fully wired in this view.');
                }
            });
        }
        
        const tables = dataRepository.getTables();
        const select = this.querySelector('#data-table-select');
        const demoBtn = this.querySelector('#load-demo-btn');

        if (downloadBtn) {
            if (tables.length === 0) {
                downloadBtn.disabled = true;
                downloadBtn.style.opacity = '0.5';
                downloadBtn.style.cursor = 'not-allowed';
            } else {
                downloadBtn.disabled = false;
                downloadBtn.style.opacity = '1';
                downloadBtn.style.cursor = 'pointer';
            }
        }

        if (tables.length === 0) {
            select.innerHTML = '<option value="" disabled selected>No tables found</option>';
            select.disabled = true;
            select.style.opacity = '0.5';
            select.style.cursor = 'not-allowed';
            if (demoBtn) {
                demoBtn.disabled = false;
                demoBtn.style.opacity = '1';
                demoBtn.style.cursor = 'pointer';
            }
            return;
        }
        
        select.disabled = false;
        select.style.opacity = '1';
        select.style.cursor = 'pointer';

        if (demoBtn) {
            demoBtn.disabled = true;
            demoBtn.style.opacity = '0.5';
            demoBtn.style.cursor = 'not-allowed';
        }

        select.innerHTML = '<option value="" disabled selected>Select Table</option>' +
            tables.map(t => `<option value="${t}">${t}</option>`).join('');

        select.addEventListener('change', (e) => {
            this.currentTable = e.target.value;
            this.loadTableData();
        });


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

        await this.showLoading();

        try {


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
                // Loaded data
            } else {
                // If data is empty, we can't easily see columns unless we use PRAGMA
                const info = dataRepository.executeQuery(`PRAGMA table_info("${this.currentTable}")`);
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
                    if (col === 'note') {
                        let noteVal = row[col] || '';
                        const renderStatic = () => {
                            td.innerHTML = `
                                <div class="note-cell-container ${!noteVal ? 'empty' : ''}">
                                    <span class="note-text ${!noteVal ? 'placeholder-note' : ''}">${noteVal || 'Add note...'}</span>
                                    <button class="edit-note-btn" aria-label="Edit note">✏️</button>
                                </div>
                            `;
                            
                            const editBtn = td.querySelector('.edit-note-btn');
                            const noteText = td.querySelector('.note-text');
                            
                            const startEdit = (e) => {
                                e.stopPropagation();
                                const input = document.createElement('input');
                                input.type = 'text';
                                input.value = noteVal;
                                input.className = 'note-edit-input';
                                td.innerHTML = '';
                                td.appendChild(input);
                                input.focus();
                                
                                let saved = false;
                                const saveNote = async () => {
                                    if (saved) return;
                                    saved = true;
                                    const newVal = input.value.trim();
                                    try {
                                        dataRepository.executeQuery(
                                            `UPDATE "${this.currentTable}" SET note = ? WHERE id = ?`,
                                            [newVal || null, row.id]
                                        );
                                        await dataRepository.saveDatabase();
                                        row[col] = newVal;
                                        noteVal = newVal;
                                        renderStatic();
                                    } catch (err) {
                                        console.error('Failed to save note:', err);
                                        renderStatic();
                                    }
                                };
                                
                                input.addEventListener('blur', saveNote);
                                input.addEventListener('keydown', (e) => {
                                    if (e.key === 'Enter') {
                                        saveNote();
                                    } else if (e.key === 'Escape') {
                                        saved = true;
                                        renderStatic();
                                    }
                                });
                            };
                            
                            editBtn.addEventListener('click', startEdit);
                            noteText.addEventListener('click', startEdit);
                        };
                        renderStatic();
                    } else if (col === dateColumn && typeof row[col] === 'number') {
                        td.textContent = new Date(row[col]).toLocaleString();
                    } else {
                        td.textContent = row[col];
                    }
                    tr.appendChild(td);
                });
                tbody.appendChild(tr);
            });
        } finally {
            this.hideLoading();
        }
    }
}

customElements.define('raw-data-view', RawDataView);

