import { DataImporter } from '../services/data-importer.js';

export class ImportView extends HTMLElement {
    constructor() {
        super();
    }

    connectedCallback() {
        this.render();
    }

    render() {
        this.innerHTML = `
            <div class="import-container">
                <h1>Import Data</h1>
                <div class="card">
                    <h2>Import Data</h2>
                    <p>Select CSV files and specify the data type/provider.</p>
                    
                    <div class="import-filter-container">
                        <label for="type-select">Type:</label>
                        <select id="type-select">
                            <option value="">(Auto-detect)</option>
                            <option value="energy">Energy</option>
                            <option value="finance">Finance</option>
                        </select>
                        
                        <label for="provider-select">Provider:</label>
                        <select id="provider-select">
                            <option value="">(Auto-detect)</option>
                            <option value="pge">PG&E</option>
                            <option value="tesla">Tesla</option>
                            <option value="sfcu">SFCU</option>
                        </select>
                    </div>

                    <input type="file" id="csv-input" multiple>
                    <div id="status-area" class="import-status-area"></div>
                </div>
            </div>
        `;

        const input = this.querySelector('#csv-input');
        const status = this.querySelector('#status-area');
        const typeSelect = this.querySelector('#type-select');
        const providerSelect = this.querySelector('#provider-select');

        // Helper to let UI update before blocking work
        const waitFrame = () => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));

        input.addEventListener('change', async (e) => {
            const files = e.target.files;
            if (!files.length) return;

            // Immediate feedback
            status.innerHTML = `
                <div id="import-loading-indicator" class="import-loading-container">
                    <svg width="20" height="20" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" class="spin-animation">
                        <path d="M12 2A10 10 0 1 0 22 12A10 10 0 0 0 12 2Zm0 18a8 8 0 1 1 8-8A8 8 0 0 1 12 20Z" opacity="0.25" fill="currentColor"/>
                        <path d="M12 2V4A8 8 0 0 1 20 12H22A10 10 0 0 0 12 2Z" fill="currentColor"/>
                    </svg>
                    <span>Starting import...</span>
                </div>
            `;

            // Allow paint
            await waitFrame();

            const options = {
                type: typeSelect.value,
                provider: providerSelect.value
            };

            for (const file of files) {
                // Use appendChild to avoid blowing away the spinner (which is in innerHTML)
                const logItem = document.createElement('div');
                logItem.innerHTML = `Processing <strong>${file.name}</strong>...`;
                status.appendChild(logItem);

                await waitFrame(); // Update UI again

                try {
                    const text = await file.text();
                    const result = await DataImporter.import(file.name, text, options);

                    logItem.innerHTML += `<div class="${result.success > 0 ? 'import-log-success' : 'import-log-warning'} import-log-item">
                        ${result.message}
                    </div>`;
                } catch (err) {
                    console.error(err);
                    logItem.innerHTML += `<div class="import-log-error import-log-item">Error: ${err.message}</div>`;
                }
            }

            // Remove spinner
            const spinner = status.querySelector('#import-loading-indicator');
            if (spinner) spinner.remove();

            // All done message
            const doneMsg = document.createElement('div');
            doneMsg.className = 'import-done-message';
            doneMsg.textContent = 'All operations completed.';
            status.appendChild(doneMsg);
        });
    }
}

customElements.define('import-view', ImportView);
