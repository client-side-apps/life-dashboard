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
                    
                    <div style="margin-bottom: 1rem;">
                        <label for="type-select">Type:</label>
                        <select id="type-select">
                            <option value="">(Auto-detect)</option>
                            <option value="energy">Energy</option>
                            <option value="finance">Finance</option>
                        </select>
                        
                        <label for="provider-select" style="margin-left: 1rem;">Provider:</label>
                        <select id="provider-select">
                            <option value="">(Auto-detect)</option>
                            <option value="pge">PG&E</option>
                            <option value="tesla">Tesla</option>
                            <option value="sfcu">SFCU</option>
                        </select>
                    </div>

                    <input type="file" id="csv-input" multiple>
                    <div id="status-area" style="margin-top: 1rem; color: #888;"></div>
                </div>
            </div>
        `;

        const input = this.querySelector('#csv-input');
        const status = this.querySelector('#status-area');
        const typeSelect = this.querySelector('#type-select');
        const providerSelect = this.querySelector('#provider-select');

        input.addEventListener('change', async (e) => {
            const files = e.target.files;
            if (!files.length) return;

            status.innerHTML = 'Starting import...<br>';

            const options = {
                type: typeSelect.value,
                provider: providerSelect.value
            };

            for (const file of files) {
                status.innerHTML += `Processing <strong>${file.name}</strong>... `;

                try {
                    const text = await file.text();
                    const result = await DataImporter.import(file.name, text, options);

                    status.innerHTML += `<span style="color: ${result.success > 0 ? 'green' : 'orange'}">
                        ${result.message}
                    </span><br>`;
                } catch (err) {
                    console.error(err);
                    status.innerHTML += `<span style="color: red">Error: ${err.message}</span><br>`;
                }
            }
            status.innerHTML += '<strong>All operations completed.</strong>';
        });
    }
}

customElements.define('import-view', ImportView);
