import { dbService } from './src/db.js';
import { MapView } from './src/views/map-view.js';
import { TimelineView } from './src/views/timeline-view.js';
import { HealthView } from './src/views/health-view.js';
import { FinanceView } from './src/views/finance-view.js';
import { EnergyView } from './src/views/energy-view.js';
import { MoviesView } from './src/views/movies-view.js';
import { DataView } from './src/views/data-view.js';
import { ImportView } from './src/views/import-view.js';
import './src/components/chart-card.js';

// Main App Entry Point

const state = {
    // db is now managed by dbService, but we might keep track of loaded status here
    isDbLoaded: false,
    currentView: 'map',
    theme: localStorage.getItem('theme') || 'light'
};


// DOM Elements
const elements = {
    themeToggle: document.getElementById('theme-toggle'),
    viewContainer: document.getElementById('view-container'),
    navButtons: document.querySelectorAll('.nav-btn'),
    dbInput: document.getElementById('db-input'),
    selectDbBtn: document.getElementById('select-db-btn'),
    importDataBtn: document.getElementById('import-data-btn'),
    iconSun: document.querySelector('.icon-sun'),
    iconMoon: document.querySelector('.icon-moon')
};

// Initialization
function init() {
    applyTheme(state.theme);
    setupEventListeners();
    console.log('Life Dashboard Initialized');
}

function setupEventListeners() {
    // Theme Toggle
    elements.themeToggle.addEventListener('click', () => {
        state.theme = state.theme === 'light' ? 'dark' : 'light';
        localStorage.setItem('theme', state.theme);
        applyTheme(state.theme);
    });

    // Navigation
    elements.navButtons.forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            const view = e.target.dataset.view;
            switchView(view);
        });
    });

    // DB Selection
    elements.selectDbBtn.addEventListener('click', () => {
        elements.dbInput.click();
    });

    elements.dbInput.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (file) {
            console.log('File selected:', file.name);
            await loadDatabase(file);
        }
    });

    // Import Data View
    elements.importDataBtn.addEventListener('click', () => {
        // Remove active class from nav buttons
        elements.navButtons.forEach(btn => btn.classList.remove('active'));
        switchView('import');
    });
}

function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    if (theme === 'dark') {
        elements.iconSun.style.display = 'none';
        elements.iconMoon.style.display = 'block';
    } else {
        elements.iconSun.style.display = 'block';
        elements.iconMoon.style.display = 'none';
    }

    // Notify current view if it supports theme updates
    if (state.currentViewInstance && typeof state.currentViewInstance.updateTheme === 'function') {
        state.currentViewInstance.updateTheme(theme);
    }
}

function switchView(viewName) {
    state.currentView = viewName;

    // Update Nav
    elements.navButtons.forEach(btn => {
        if (btn.dataset.view === viewName) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });

    // Render View (Placeholder for now)
    renderView(viewName);
}

async function renderView(viewName) {
    elements.viewContainer.innerHTML = ''; // Clear container

    // Optional: Destroy previous view instance
    if (state.currentViewInstance && state.currentViewInstance.destroy) {
        state.currentViewInstance.destroy();
    }
    state.currentViewInstance = null;

    if (!state.isDbLoaded && viewName !== 'data') {
        if (dbService.db === null) {
            elements.viewContainer.innerHTML = `
                <div class="placeholder-message">
                    <h2>Welcome to Life Dashboard</h2>
                    <p>Please select a database file to get started.</p>
                    <input type="file" id="start-db-input" accept=".sqlite,.db,.sqlite3" class="file-input">
                    <p style="margin-top:1rem; font-size:0.8rem; opacity:0.7">Or for testing, <a href="#" onclick="alert('Demo functionality to be implemented')">load demo data</a>.</p>
                </div>
            `;

            // Add listener to the injected input
            const startInput = document.getElementById('start-db-input');
            if (startInput) {
                startInput.addEventListener('change', async (e) => {
                    const file = e.target.files[0];
                    if (file) {
                        await loadDatabase(file);
                    }
                });
            }
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
        case 'movies':
            tagName = 'movies-view';
            break;
        case 'data':
            tagName = 'data-view';
            break;
        case 'import':
            tagName = 'import-view';
            break;
        default:
            tagName = null;
    }

    if (tagName) {
        const element = document.createElement(tagName);
        elements.viewContainer.appendChild(element);
        state.currentViewInstance = element;
    } else {
        elements.viewContainer.innerHTML = `
            <div style="padding: 2rem; text-align: center;">
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

        console.log('Database loaded successfully');

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

init();
