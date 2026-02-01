import { DataImporter } from '../services/data-importer.js';
import JSZip from 'jszip';
import * as dataRepository from '../services/data-repository.js';

export class ImportView extends HTMLElement {
    constructor() {
        super();
    }

    connectedCallback() {
        this.render();
    }

    render() {
        // Check if File System Access API is supported
        const supportsFileSystem = 'showDirectoryPicker' in window;

        this.innerHTML = `
            <div class="import-container">
                <h1>Import Data</h1>
                <div class="card">
                    <h2>Import Data</h2>
                    <p>Select CSV files or a folder to import data from.</p>
                    
                    <div class="import-filter-container">
                        <label for="type-select">Type:</label>
                        <select id="type-select" class="select-input">
                            <option value="">(Auto-detect)</option>
                            <option value="energy">Energy</option>
                            <option value="finance">Finance</option>
                        </select>
                        
                        <label for="provider-select">Provider:</label>
                        <select id="provider-select" class="select-input">
                            <option value="">(Auto-detect)</option>
                            <option value="pge">PG&E</option>
                            <option value="tesla">Tesla</option>
                            <option value="sfcu">SFCU</option>
                        </select>
                    </div>

                    <div class="import-actions">
                        <div class="file-input-wrapper">
                            <input type="file" id="csv-input" multiple accesskey="f">
                            <label for="csv-input" class="primary-btn">Choose Files</label>
                        </div>
                        ${supportsFileSystem ? `
                            <span class="separator">or</span>
                            <button id="folder-btn" class="secondary-btn">Select Folder</button>
                        ` : ''}
                    </div>

                    <div id="status-area" class="import-status-area"></div>
                </div>
            </div>
            
        `;

        const input = this.querySelector('#csv-input');
        const status = this.querySelector('#status-area');
        const folderBtn = this.querySelector('#folder-btn');

        // Bind events
        input.addEventListener('change', (e) => this.handleFileSelection(e.target.files));

        if (folderBtn) {
            folderBtn.addEventListener('click', () => this.handleFolderSelection());
        }
    }

    async handleFileSelection(fileList) {
        if (!fileList || fileList.length === 0) return;
        await this.processFiles(Array.from(fileList));
    }

    async handleFolderSelection() {
        try {
            const dirHandle = await window.showDirectoryPicker();
            const files = [];

            const status = this.querySelector('#status-area');
            status.innerHTML = '<div class="import-loading-container">Scanning directory...</div>';

            await this.scanDirectory(dirHandle, files);

            if (files.length === 0) {
                status.innerHTML = '<div class="import-log-warning import-log-item">No files found in selected folder.</div>';
                return;
            }

            await this.processFiles(files);

        } catch (err) {
            if (err.name !== 'AbortError') {
                console.error('Folder selection failed:', err);
                const status = this.querySelector('#status-area');
                status.innerHTML = `<div class="import-log-error import-log-item">Folder selection failed: ${err.message}</div>`;
            }
        }
    }

    async scanDirectory(dirHandle, fileList) {
        for await (const entry of dirHandle.values()) {
            if (entry.kind === 'file') {
                try {
                    const file = await entry.getFile();
                    fileList.push(file);
                } catch (e) {
                    console.warn(`Failed to access file ${entry.name}`, e);
                }
            } else if (entry.kind === 'directory') {
                await this.scanDirectory(entry, fileList);
            }
        }
    }

    async processFiles(files) {
        const status = this.querySelector('#status-area');
        const typeSelect = this.querySelector('#type-select');
        const providerSelect = this.querySelector('#provider-select');

        // Helper to let UI update
        const waitFrame = () => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));

        status.innerHTML = `
            <div id="import-loading-indicator" class="import-loading-container">
                <svg width="20" height="20" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" class="spin-animation">
                    <path d="M12 2A10 10 0 1 0 22 12A10 10 0 0 0 12 2Zm0 18a8 8 0 1 1 8-8A8 8 0 0 1 12 20Z" opacity="0.25" fill="currentColor"/>
                    <path d="M12 2V4A8 8 0 0 1 20 12H22A10 10 0 0 0 12 2Z" fill="currentColor"/>
                </svg>
                <span>Starting import of ${files.length} file(s)...</span>
            </div>
        `;

        await waitFrame();

        const options = {
            type: typeSelect.value,
            provider: providerSelect.value
        };

        let totalSuccess = 0;
        let totalErrors = 0;

        // Pre-process files to handle ZIP archives
        const filesToProcess = [];

        for (const file of files) {
            if (file.name.toLowerCase().endsWith('.zip')) {
                const logItem = document.createElement('div');
                logItem.className = 'import-log-pending';
                logItem.innerHTML = `Extracting <strong>${file.name}</strong>...`;
                status.appendChild(logItem);

                try {
                    const zip = await JSZip.loadAsync(file);
                    let extractedCount = 0;

                    // Get all files from zip
                    const entries = Object.values(zip.files).filter(entry => !entry.dir && !entry.name.startsWith('__MACOSX') && !entry.name.endsWith('.DS_Store'));

                    for (const entry of entries) {
                        filesToProcess.push({
                            name: entry.name,
                            text: () => entry.async("string")
                        });
                        extractedCount++;
                    }

                    logItem.insertAdjacentHTML('beforeend', `<div class="import-log-success import-log-item">Extracted ${extractedCount} files.</div>`);

                } catch (err) {
                    console.error("Zip extraction error", err);
                    logItem.insertAdjacentHTML('beforeend', `<div class="import-log-error import-log-item">Failed to unzip: ${err.message}</div>`);
                    totalErrors++; // Count the zip failure as an error
                }
            } else {
                filesToProcess.push(file);
            }
        }

        // Update count if files expanded
        if (filesToProcess.length !== files.length) {
            const spinner = status.querySelector('#import-loading-indicator span');
            if (spinner) spinner.textContent = `Processing ${filesToProcess.length} file(s) (after extraction)...`;
        }

        for (const file of filesToProcess) {
            // Append log item
            const logItem = document.createElement('div');
            logItem.innerHTML = `Processing <strong>${file.name}</strong>...`;
            logItem.className = 'import-log-pending';
            status.appendChild(logItem);

            // Scroll to bottom
            status.scrollTop = status.scrollHeight;

            await waitFrame();

            try {
                const text = await file.text();
                const result = await DataImporter.import(file.name, text, options);

                logItem.insertAdjacentHTML('beforeend', `<div class="${result.success > 0 ? 'import-log-success' : 'import-log-warning'} import-log-item">
                    ${result.message}
                </div>`);

                if (result.success > 0) totalSuccess++;
                if (result.errors > 0) totalErrors++;

            } catch (err) {
                console.error(err);
                logItem.insertAdjacentHTML('beforeend', `<div class="import-log-error import-log-item">Error: ${err.message}</div>`);
                totalErrors++;
            }
        }

        // Remove spinner
        const spinner = status.querySelector('#import-loading-indicator');
        if (spinner) spinner.remove();

        // Final summary
        const doneMsg = document.createElement('div');
        doneMsg.className = 'import-done-message';
        doneMsg.innerHTML = `<strong>Batch Completed.</strong> Files with success: ${totalSuccess}, Files with errors: ${totalErrors}`;
        status.appendChild(doneMsg);
        status.scrollTop = status.scrollHeight;

        if (totalSuccess > 0) {
            // Auto-save if supported
            if (dataRepository.hasFileHandle()) {
                const savingMsg = document.createElement('div');
                savingMsg.textContent = 'Saving changes to database file...';
                status.appendChild(savingMsg);
                status.scrollTop = status.scrollHeight;

                try {
                    await dataRepository.saveDatabase();
                    savingMsg.textContent = 'Changes saved to database file successfully.';
                    savingMsg.className = 'import-log-success';
                } catch (e) {
                    savingMsg.textContent = 'Failed to auto-save changes: ' + e.message;
                    savingMsg.className = 'import-log-error';
                }
            } else {
                console.log('No file handle, skipping auto-save.');
            }
        }
    }
}

customElements.define('import-view', ImportView);
