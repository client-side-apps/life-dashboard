import * as dataRepository from '../services/data-repository.js';
import { DataView } from '../components/data-view/data-view.js';

const ROWS_PER_PAGE = 100;

export class RawDataView extends DataView {
    constructor() {
        super();
        this.currentTable = null;
        this.page = 1;
        this.pageCount = 1;
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
        this.page = 1;
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
            this.page = 1;
            this.resetAddRow();
            this.loadTableData();
        });

        const prevBtn = this.querySelector('#data-page-prev');
        const nextBtn = this.querySelector('#data-page-next');
        if (prevBtn) prevBtn.addEventListener('click', () => this.goToPage(this.page - 1));
        if (nextBtn) nextBtn.addEventListener('click', () => this.goToPage(this.page + 1));

        const addRowBtn = this.querySelector('#add-row-btn');
        const addRowForm = this.querySelector('#add-row-form');
        if (addRowBtn && addRowForm) {
            addRowBtn.addEventListener('click', () => this.toggleAddRowForm());
            addRowForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.submitAddRow();
            });
        }
    }

    /**
     * Hides the add-row form and its status. Called when the selected table
     * changes, so a half-filled form never carries over to another table.
     */
    resetAddRow() {
        const btn = this.querySelector('#add-row-btn');
        const form = this.querySelector('#add-row-form');
        const status = this.querySelector('#add-row-status');

        if (btn) btn.hidden = !this.currentTable;
        if (form) {
            form.replaceChildren();
            form.hidden = true;
        }
        if (status) status.hidden = true;
    }

    /**
     * Shows or hides a form with one field per column of the selected table.
     * 'id' is auto-assigned and 'source' is stamped as 'manual', so neither
     * gets a field.
     */
    toggleAddRowForm() {
        const form = this.querySelector('#add-row-form');
        if (!form || !this.currentTable) return;

        if (!form.hidden) {
            this.resetAddRow();
            return;
        }

        const columns = dataRepository.getTableColumns(this.currentTable)
            .filter(col => col.name !== 'id' && col.name !== 'source');

        form.innerHTML = columns.map(col => {
            const isNumeric = ['INTEGER', 'REAL', 'NUMERIC'].includes((col.type || '').toUpperCase());
            const isTimestamp = col.name === 'timestamp' || col.name.endsWith('_timestamp');

            let input;
            if (isTimestamp) {
                input = `<input type="datetime-local" id="add-row-field-${col.name}" name="${col.name}">`;
            } else if (isNumeric) {
                input = `<input type="number" step="any" id="add-row-field-${col.name}" name="${col.name}">`;
            } else {
                input = `<input type="text" id="add-row-field-${col.name}" name="${col.name}">`;
            }

            return `
                <label for="add-row-field-${col.name}">${col.name}</label>
                ${input}
            `;
        }).join('') + `
            <span></span>
            <button type="submit" class="primary-btn">Add Row</button>
        `;

        form.hidden = false;
    }

    async submitAddRow() {
        const form = this.querySelector('#add-row-form');
        if (!form || !this.currentTable) return;

        const data = {};
        for (const input of form.querySelectorAll('input')) {
            const value = input.value.trim();
            if (value === '') continue;

            if (input.type === 'datetime-local') {
                const ts = new Date(value).getTime();
                if (isNaN(ts)) continue;
                data[input.name] = ts;
            } else if (input.type === 'number') {
                data[input.name] = Number(value);
            } else {
                data[input.name] = value;
            }
        }

        if (Object.keys(data).length === 0) {
            this.setAddRowStatus('warning', 'Fill in at least one field.');
            return;
        }
        data.source = 'manual';

        try {
            dataRepository.insertRecord(this.currentTable, data);
            let message = `Row added to ${this.currentTable}.`;

            if (dataRepository.hasFileHandle()) {
                await dataRepository.saveDatabase();
                message += ' Changes saved to database file.';
            }

            this.resetAddRow();
            this.setAddRowStatus('success', message);
            await this.loadTableData();
        } catch (err) {
            console.error('Add row failed', err);
            this.setAddRowStatus('error', `Error: ${err.message}`);
        }
    }

    /**
     * Shows the add-row status element with the given text. The element lives
     * in the template; only its text and visibility change.
     * @param {'success'|'warning'|'error'} kind
     */
    setAddRowStatus(kind, text) {
        const status = this.querySelector('#add-row-status');
        if (!status) return;
        status.className = `import-log-item import-log-${kind}`;
        status.textContent = text;
        status.hidden = false;
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

    /**
     * Shows another page of the current table. Out of range pages are ignored,
     * so the buttons stay harmless at the first and last page.
     */
    goToPage(page) {
        if (page < 1 || page > this.pageCount) return;
        this.page = page;
        this.loadTableData();
    }

    async loadTableData() {
        if (!this.currentTable) return;

        await this.showLoading();

        try {
            const { rows: data, dateColumn, totalRows, page, pageCount, offset } = dataRepository.getTablePage(
                this.currentTable,
                {
                    startDate: this.startDate,
                    endDate: this.endDate,
                    page: this.page,
                    pageSize: ROWS_PER_PAGE
                }
            );

            this.page = page;
            this.pageCount = pageCount;

            const table = this.querySelector('#data-table');
            const thead = table.querySelector('thead');
            const tbody = table.querySelector('tbody');
            const countSpan = this.querySelector('#data-count');

            thead.innerHTML = '';
            tbody.innerHTML = '';
            countSpan.textContent = '';

            if (data.length === 0) {
                tbody.innerHTML = '<tr><td class="table-empty-message">No data found</td></tr>';
                this.renderPagination(1);
                return;
            }

            const firstRow = offset + 1;
            const lastRow = offset + data.length;
            countSpan.textContent = `Showing rows ${firstRow}-${lastRow} of ${totalRows}` +
                (dateColumn ? ` (sorted by ${dateColumn})` : '');
            this.renderPagination(pageCount);

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

    /**
     * Updates the page controls below the table. They stay hidden as long as
     * the whole result fits on a single page.
     */
    renderPagination(pageCount) {
        const pagination = this.querySelector('#data-pagination');
        const prevBtn = this.querySelector('#data-page-prev');
        const nextBtn = this.querySelector('#data-page-next');
        const label = this.querySelector('#data-page-label');
        if (!pagination || !prevBtn || !nextBtn || !label) return;

        pagination.hidden = pageCount <= 1;
        label.textContent = `Page ${this.page} of ${pageCount}`;
        prevBtn.disabled = this.page <= 1;
        nextBtn.disabled = this.page >= pageCount;
    }
}

customElements.define('raw-data-view', RawDataView);

