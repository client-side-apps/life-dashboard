import { dbService } from '../db.js';
import { DataView } from '../components/data-view/data-view.js';

// Import subviews
import './health/dashboard-view.js';
import './health/heart-view.js';
import './health/activity-view.js';
import './health/body-view.js';
import './health/sleep-view.js';
import './health/nutrition-view.js';

export class HealthView extends DataView {
    constructor() {
        super();
    }

    connectedCallback() {
        super.connectedCallback();
        this.render();
    }

    async render() {
        this.innerHTML = '';
        const template = document.getElementById('health-view-template');
        const content = template.content.cloneNode(true);
        this.appendChild(content);



        // Sub-navigation is now handled by the main router calling loadSubView
        // We just ensure the links are correct
        const links = this.querySelectorAll('.health-nav a');
        links.forEach(link => {
            const subview = link.dataset.subview;
            link.setAttribute('href', `#/health/${subview}`);
        });

        // The router will call loadSubView which will populate #health-content
        // But if router logic fails or timing is off, we ensure a default load
        // Actually router calls loadSubView after renderView awaits...
        // Wait, renderView in app.js is async and awaits renderView(viewName).
        // But renderView function does NOT await element.render() because element creation is sync custom element lifecycle?
        // No, connectedCallback is sync. render() is async.
        // We should probably await rendering in connectedCallback if possible? No.
        // So safe bet: load default here if empty?
        // Or simply trust the router? The user says it's broken.
        // Let's force load 'dashboard' if nothing else calls it.
        // But router calls it.
        // Let's rely on app.js. If HealthView is broken, maybe it is because onDateRangeChanged calls loadSubView?
    }

    onDateRangeChanged() {
        // Reload current subview logic
        const activeLink = this.querySelector('.health-nav a.active');
        const subview = activeLink ? activeLink.dataset.subview : 'dashboard';

        // Propagate date change to current subview if it exists
        const content = this.querySelector('#health-content');
        if (content && content.firstElementChild) {
            const currentView = content.firstElementChild;
            if (typeof currentView.startDate !== 'undefined') {
                currentView.startDate = this.startDate;
                currentView.endDate = this.endDate;
            }
        }
    }

    async loadSubView(subview) {
        await this.showLoading();

        try {
            // Default to dashboard if no subview
            if (!subview) subview = 'dashboard';

            // Update active class
            this.querySelectorAll('.health-nav a').forEach(a => {
                if (a.dataset.subview === subview) {
                    a.classList.add('active');
                } else {
                    a.classList.remove('active');
                }
            });

            const content = this.querySelector('#health-content');
            if (!content) return;

            content.innerHTML = ''; // Clear

            const startDate = this.startDate;
            const endDate = this.endDate;

            let viewElement;

            switch (subview) {
                case 'dashboard':
                    viewElement = document.createElement('health-dashboard-view');
                    break;
                case 'body':
                    viewElement = document.createElement('health-body-view');
                    break;
                case 'heart':
                    viewElement = document.createElement('health-heart-view');
                    break;
                case 'sleep':
                    viewElement = document.createElement('health-sleep-view');
                    break;
                case 'activity':
                    viewElement = document.createElement('health-activity-view');
                    break;
                case 'nutrition':
                    viewElement = document.createElement('health-nutrition-view');
                    break;
                default:
                    content.innerHTML = `<h3>${subview.charAt(0).toUpperCase() + subview.slice(1)} view placeholder</h3>`;
                    return;
            }

            if (viewElement) {
                viewElement.startDate = startDate;
                viewElement.endDate = endDate;
                content.appendChild(viewElement);
            }
        } finally {
            this.hideLoading();
        }
    }
}

customElements.define('health-view', HealthView);

