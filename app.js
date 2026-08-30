import { dbService } from './src/db.js';
import * as dataRepository from './src/services/data-repository.js';
import { FileStorage } from './src/utils/file-storage.js';
import { describeDbStatus } from './src/utils/db-status.js';
import { MapView } from './src/views/map-view.js';
import { TimelineView } from './src/views/timeline-view.js';
import { HealthView } from './src/views/health-view.js';
import { FinanceView } from './src/views/finance-view.js';
import { EnergyView } from './src/views/energy-view.js';
import { MusicView } from './src/views/music-view.js';

import { RawDataView } from './src/views/raw-data-view.js';
import { ImportView } from './src/views/import-view.js';
import './src/components/chart-card/chart-card.js';
import './src/components/date-range-picker/date-range-picker.js';
import './src/components/data-view/data-view.js';

// Main App Entry Point

// Visual themes in themes/*.css. The first one is the default.
const SKINS = ['pixel', 'cozy'];

// Light/dark preference. 'system' follows the OS and is stored as no value at all.
const APPEARANCES = ['system', 'light', 'dark'];

function systemTheme() {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function storedAppearance() {
    const stored = localStorage.getItem('theme');
    return stored === 'light' || stored === 'dark' ? stored : 'system';
}

const state = {
    // db is now managed by dbService, but we might keep track of loaded status here
    isDbLoaded: false,
    currentView: 'map',
    appearance: storedAppearance(),
    theme: storedAppearance() === 'system' ? systemTheme() : storedAppearance(),
    skin: SKINS.includes(localStorage.getItem('skin')) ? localStorage.getItem('skin') : SKINS[0],
    isDirty: false,
    isDirty: false,
    lastSavedTime: null,
    startDate: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // Default 1 year
    endDate: new Date().toISOString().split('T')[0]
};


// DOM Elements
const elements = {
    viewContainer: document.getElementById('view-container'),
    navButtons: document.querySelectorAll('.nav-btn'),
    importDataBtn: document.getElementById('import-data-btn'),
    statusIndicator: document.getElementById('db-status'),
    datePicker: document.getElementById('global-date-picker'),
    settingsPanel: document.getElementById('settings-panel'),
    themeSelect: document.getElementById('theme-select'),
    appearanceSelect: document.getElementById('appearance-select'),
    themeStylesheet: document.getElementById('theme-stylesheet')
};

// Initialization
async function init() {
    applySkin(state.skin);
    applyAppearance(state.appearance);

    // Initialize Date Picker
    if (elements.datePicker) {
        elements.datePicker.startDate = state.startDate;
        elements.datePicker.endDate = state.endDate;
    }

    setupEventListeners();
    // Check for stored DB handle
    // Check for stored DB handle
    await checkStoredDatabase();

    // Listen for DB modifications
    dbService.onModification = () => {
        // A database can be created by importing data without opening a file first.
        state.isDbLoaded = !!dbService.db;
        state.isDirty = true;
        updateStatus();
    };
}

function updateStatus() {
    const statusEl = elements.statusIndicator;
    const status = describeDbStatus({
        hasDatabase: !!dbService.db,
        fileName: dbService.fileHandle ? dbService.fileHandle.name : null,
        isDirty: state.isDirty
    });

    statusEl.innerHTML = '';

    if (status.state === 'saved') {
        statusEl.className = 'status-indicator status-autosaved';
        const label = document.createElement('span');
        label.textContent = `Saved to ${status.fileName}`;
        statusEl.appendChild(label);
        return;
    }

    if (status.state === 'unsaved') {
        statusEl.className = 'status-indicator status-unsaved';
        const label = document.createElement('span');
        label.textContent = 'Unsaved changes';
        const button = document.createElement('button');
        button.id = 'manual-save-btn';
        button.className = 'btn-small';
        button.textContent = 'SAVE';
        statusEl.append(label, button);
        return;
    }

    statusEl.className = 'status-indicator';
}

function databaseFileName() {
    return `life-dashboard-${new Date().toISOString().slice(0, 10)}.sqlite`;
}

async function handleManualSave() {
    // Saving to a file the user picks keeps a handle around, so later changes
    // are written back to that file instead of downloading a new copy.
    if ('showSaveFilePicker' in window) {
        try {
            const handle = await window.showSaveFilePicker({
                suggestedName: databaseFileName(),
                types: [{
                    description: 'SQLite Database',
                    accept: { 'application/x-sqlite3': ['.sqlite', '.db', '.sqlite3'] }
                }]
            });

            await dbService.saveToDisk(handle);
            dbService.setFileHandle(handle);
            state.isDirty = false;
            updateStatus();

            // Remembering the file only affects the next session, so a failure
            // here must not look like a failed save.
            try {
                await FileStorage.set(handle);
            } catch (err) {
                console.warn('Could not remember the database file for next time:', err);
            }
            return;
        } catch (err) {
            if (err.name === 'AbortError') return;
            console.error('Failed to save to file, falling back to download:', err);
        }
    }

    downloadDatabase();
}

function downloadDatabase() {
    const data = dbService.export();
    const blob = new Blob([data], { type: 'application/octet-stream' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = databaseFileName();
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    state.isDirty = false;
    updateStatus();
}

async function checkStoredDatabase() {
    try {
        const handle = await FileStorage.get();
        if (!handle) return;

        console.log('Found stored database handle');

        // Check permission
        const opts = { mode: 'readwrite' };
        if ((await handle.queryPermission(opts)) === 'granted') {
            await loadDatabaseFromHandle(handle);
        } else {
            console.log('Permission needed for stored handle');
            state.pendingHandle = handle;
            // The view will render a "Resume" button if state.pendingHandle is set
            renderView(state.currentView);
        }
    } catch (e) {
        console.error('Error checking stored DB', e);
    }
}

async function loadDatabaseFromHandle(handle) {
    try {
        const file = await handle.getFile();
        await loadDatabase(file);
        dbService.setFileHandle(handle);
        // Ensure it's stored (refresh expiry if handled differently in other browsers, but mainly essentially)
        await FileStorage.set(handle);
        state.pendingHandle = null;
    } catch (e) {
        console.error('Failed to load from handle:', e);
        await FileStorage.clear(); // Clear bad handle
        alert('Failed to load stored database. Please open it again.');
    }
}

async function handleAutoSaveOpen() {
    try {
        const [handle] = await window.showOpenFilePicker({
            types: [{
                description: 'SQLite Database',
                accept: { 'application/x-sqlite3': ['.sqlite', '.db', '.sqlite3'] }
            }],
            multiple: false
        });

        if (handle) {
            await loadDatabaseFromHandle(handle);
        }
    } catch (err) {
        if (err.name !== 'AbortError') {
            console.error('Auto-save open error:', err);
            alert('Failed to open database: ' + err.message);
        }
    }
}


function setupEventListeners() {
    // Settings: theme (skin) selection
    if (elements.themeSelect) {
        elements.themeSelect.addEventListener('change', (e) => {
            const skin = SKINS.includes(e.target.value) ? e.target.value : SKINS[0];
            state.skin = skin;
            localStorage.setItem('skin', skin);
            applySkin(skin);
        });
    }

    // Settings: light / dark / system appearance
    if (elements.appearanceSelect) {
        elements.appearanceSelect.addEventListener('change', (e) => {
            applyAppearance(APPEARANCES.includes(e.target.value) ? e.target.value : 'system');
        });
    }

    // System Theme Listener because why not
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', e => {
        if (state.appearance === 'system') {
            state.theme = e.matches ? 'dark' : 'light';
            applyTheme(state.theme);
        }
    });

    // Routing
    window.addEventListener('hashchange', handleRouting);
    window.addEventListener('load', handleRouting);

    // DB Selection (Event Delegation)
    document.addEventListener('change', async (e) => {
        if (e.target && e.target.id === 'start-db-input') {
            const file = e.target.files[0];
            if (file) {
                console.log('File selected:', file.name);
                await loadDatabase(file);
            }
        }
    });

    document.addEventListener('click', async (e) => {
        if (e.target) {
            if (e.target.id === 'load-demo-btn') {
                e.preventDefault();
                await loadDemoDatabase();
            } else if (e.target.closest('#auto-save-btn') || e.target.closest('#open-db-btn')) {
                e.preventDefault();
                await handleAutoSaveOpen();
            } else if (e.target.id === 'resume-db-btn') {
                e.preventDefault();
                if (state.pendingHandle) {
                    // Need to request permission here, inside user gesture
                    if ((await state.pendingHandle.requestPermission({ mode: 'readwrite' })) === 'granted') {
                        await loadDatabaseFromHandle(state.pendingHandle);
                    } else {
                        alert('Permission denied. Cannot load database.');
                    }
                }
            } else if (e.target.closest('#forget-db-btn')) {
                // Handle forget button (icon or wrapper)
                await FileStorage.clear();
                state.pendingHandle = null;
                renderView(state.currentView);
            } else if (e.target.id === 'manual-save-btn') {
                e.preventDefault();
                await handleManualSave();
            }
        }
    });


    // Modal keyboard support
    document.addEventListener('keydown', (e) => {
        const modal = document.getElementById('modal-overlay');
        if (!modal || modal.classList.contains('hidden')) return;

        if (e.key === 'Escape') {
            modal.classList.add('hidden');
            return;
        }

        // Focus trap
        if (e.key === 'Tab') {
            const focusable = modal.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
            if (focusable.length === 0) return;
            const first = focusable[0];
            const last = focusable[focusable.length - 1];

            if (e.shiftKey && document.activeElement === first) {
                e.preventDefault();
                last.focus();
            } else if (!e.shiftKey && document.activeElement === last) {
                e.preventDefault();
                first.focus();
            }
        }
    });

    // Global Date Picker
    if (elements.datePicker) {
        elements.datePicker.addEventListener('date-change', (e) => {
            const { startDate, endDate } = e.detail;
            state.startDate = startDate;
            state.endDate = endDate;

            // Update current view if it exists
            if (state.currentViewInstance) {
                state.currentViewInstance.setAttribute('start-date', startDate);
                state.currentViewInstance.setAttribute('end-date', endDate);
            }
        });
    }
}

// Swaps the themes/*.css stylesheet. Charts read their palette from CSS
// variables at draw time, so the view is re-rendered once the new one is live.
function applySkin(skin) {
    document.documentElement.setAttribute('data-skin', skin);

    if (elements.themeSelect) {
        elements.themeSelect.value = skin;
    }

    const href = `themes/${skin}.css`;
    if (!elements.themeStylesheet || elements.themeStylesheet.getAttribute('href') === href) {
        return;
    }

    elements.themeStylesheet.addEventListener('load', () => {
        applyTheme(state.theme);
        // Re-run routing so the view and its subview redraw with the new palette
        state.currentView = null;
        handleRouting();
    }, { once: true });
    elements.themeStylesheet.setAttribute('href', href);
}

// 'system' is stored as the absence of a preference, so the app keeps
// following the OS after a reload.
function applyAppearance(appearance) {
    state.appearance = appearance;

    if (appearance === 'system') {
        localStorage.removeItem('theme');
    } else {
        localStorage.setItem('theme', appearance);
    }

    if (elements.appearanceSelect) {
        elements.appearanceSelect.value = appearance;
    }

    state.theme = appearance === 'system' ? systemTheme() : appearance;
    applyTheme(state.theme);
}

function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);

    // Notify current view if it supports theme updates
    if (state.currentViewInstance && typeof state.currentViewInstance.updateTheme === 'function') {
        state.currentViewInstance.updateTheme(theme);
    }
}

async function handleRouting() {
    const hash = window.location.hash || '#/map';
    // Format: #/viewName/subViewName
    const parts = hash.slice(1).split('/').filter(p => p);

    // Default to map if empty
    if (parts.length === 0) {
        window.location.hash = '#/map';
        return;
    }

    const viewName = parts[0];
    const subViewName = parts[1] || null;

    if (state.currentView !== viewName) {
        await renderView(viewName);
        state.currentView = viewName;
    }

    // Update Nav Activity
    elements.navButtons.forEach(btn => {
        const btnHash = btn.getAttribute('href');
        if (btnHash === `#/${viewName}`) {
            btn.classList.add('active');
            btn.setAttribute('aria-current', 'page');
        } else {
            btn.classList.remove('active');
            btn.removeAttribute('aria-current');
        }
    });

    // Handle Subview
    if (state.currentViewInstance && typeof state.currentViewInstance.loadSubView === 'function') {
        // If subview is null, the view might have a default
        state.currentViewInstance.loadSubView(subViewName);
    }
}

// Deprecated in favor of direct hash manipulation, but kept for compatibility if needed
function switchView(viewName) {
    window.location.hash = `#/${viewName}`;
}

async function renderView(viewName) {
    elements.viewContainer.innerHTML = ''; // Clear container

    // Optional: Destroy previous view instance
    if (state.currentViewInstance && state.currentViewInstance.destroy) {
        state.currentViewInstance.destroy();
    }
    state.currentViewInstance = null;

    if (!state.isDbLoaded && viewName !== 'data' && viewName !== 'import') {
        if (dbService.db === null) {
            const supportsFileSystem = 'showOpenFilePicker' in window;

            let actionButtons = '';

            if (state.pendingHandle) {
                // Show Resume UI
                actionButtons = `
                    <div class="resume-container">
                        <button id="resume-db-btn" class="primary-btn">Resume Session</button>
                    </div>
                `;
            } else {
                // Show Standard UI
                actionButtons = `
                    ${supportsFileSystem ? `
                        <button id="auto-save-btn" class="primary-btn">Open Database (Auto-Save)</button>
                        <span class="separator">or</span>
                    ` : ''}
                    
                    <div class="file-input-wrapper">
                        <input type="file" id="start-db-input" accept=".sqlite,.db,.sqlite3" class="file-input">
                        <label for="start-db-input" class="secondary-btn">Open Read-Only</label>
                    </div>
                    
                    <div class="welcome-actions">
                        <button id="load-demo-btn" class="secondary-btn">Load Demo Database</button>
                    </div>
                `;
            }

            elements.viewContainer.innerHTML = `
                <div class="placeholder-message">
                    <h2>Welcome to Life Dashboard</h2>
                    <p>Please select a database file to get started.</p>
                    <div class="welcome-controls">
                        ${actionButtons}
                    </div>
                </div>
                <style>
                    .welcome-controls {
                        display: flex;
                        flex-direction: column;
                        align-items: center;
                        gap: 1rem;
                        margin-top: 2rem;
                    }
                    .file-input-wrapper input[type="file"] {
                        display: none;
                    }
                    .text-small {
                        font-size: 0.85rem;
                        padding: 0.3rem 0.8rem;
                    }
                </style>
            `;

            // Event listener is handled via delegation in setupEventListeners
            return;
        }
    }

    let tagName;

    switch (viewName) {
        case 'map':
            tagName = 'map-view';
            break;
        case 'timeline':
            tagName = 'timeline-view';
            break;
        case 'health':
            tagName = 'health-view';
            break;
        case 'finance':
            tagName = 'finance-view';
            break;
        case 'energy':
            tagName = 'energy-view';
            break;
        case 'music':
            tagName = 'music-view';
            break;
        case 'data':
        case 'data':
            tagName = 'raw-data-view';
            break;
        case 'import':
            tagName = 'import-view';
            break;
        default:
            tagName = null;
    }

    if (tagName) {
        const element = document.createElement(tagName);
        // Set dates immediately
        element.setAttribute('start-date', state.startDate);
        element.setAttribute('end-date', state.endDate);

        elements.viewContainer.appendChild(element);
        state.currentViewInstance = element;

        // Focus management: move focus to new content
        requestAnimationFrame(() => {
            const heading = element.querySelector('h2, h3');
            if (heading) {
                heading.setAttribute('tabindex', '-1');
                heading.focus();
            } else {
                elements.viewContainer.setAttribute('tabindex', '-1');
                elements.viewContainer.focus();
            }
        });
    } else {
        elements.viewContainer.innerHTML = `
            <div class="view-placeholder">
                <h2>${viewName.charAt(0).toUpperCase() + viewName.slice(1)} View</h2>
                <p>This view is under construction.</p>
            </div>
        `;
    }
}

async function loadDatabase(file) {
    try {
        const placeholder = document.querySelector('.placeholder-message');
        if (placeholder) placeholder.innerHTML = '<p>Loading database...</p>';

        await dbService.connect(file);
        state.isDbLoaded = true;
        updateStatus(); // Update status on load

        console.log('Database loaded successfully');


        // Backfill daily data if needed
        await dataRepository.ensureDailyEnergyData();

        // Update Date Range based on latest data
        const latestTs = dataRepository.getLatestDataDate();
        if (latestTs) {
            const endDateObj = new Date(latestTs);
            const startDateObj = new Date(latestTs);
            startDateObj.setFullYear(startDateObj.getFullYear() - 1);

            state.endDate = endDateObj.toISOString().split('T')[0];
            state.startDate = startDateObj.toISOString().split('T')[0];

            // Update Date Picker Logic
            if (elements.datePicker) {
                elements.datePicker.startDate = state.startDate;
                elements.datePicker.endDate = state.endDate;
            }
        }

        // Refresh current view
        await renderView(state.currentView);

    } catch (err) {
        console.error('Failed to load database:', err);
        const placeholder = document.querySelector('.placeholder-message');
        if (placeholder) {
            placeholder.innerHTML = `
                <h2>Error</h2>
                <p>Failed to load database. Please ensure it is a valid SQLite file.</p>
                <button class="primary-btn" onclick="document.getElementById('db-input').click()">Try Again</button>
            `;
        }
    }
}

async function loadDemoDatabase() {
    try {
        const placeholder = document.querySelector('.placeholder-message');
        if (placeholder) placeholder.innerHTML = '<p>Loading demo database...</p>';

        const response = await fetch(`demo.sqlite?v=${Date.now()}`);
        if (!response.ok) throw new Error('Failed to fetch demo database');

        const blob = await response.blob();
        const file = new File([blob], 'demo.sqlite', { type: 'application/x-sqlite3' });

        await loadDatabase(file);
    } catch (err) {
        console.error('Failed to load demo database:', err);
        const placeholder = document.querySelector('.placeholder-message');
        if (placeholder) {
            placeholder.innerHTML = `
                <h2>Error</h2>
                <p>Failed to load demo database. Please ensure 'demo.sqlite' is in the root directory.</p>
                <button class="primary-btn" onclick="location.reload()">Reload</button>
            `;
        }
    }
}

init();
