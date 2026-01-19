import Chart from 'chart.js';

export class ChartCard extends HTMLElement {
    constructor() {
        super();
        this.chartInstance = null;
        this._startDate = null;
        this._endDate = null;
    }

    get startDate() { return this._startDate; }
    set startDate(val) { this._startDate = val; }

    get endDate() { return this._endDate; }
    set endDate(val) { this._endDate = val; }

    setDateRange(start, end) {
        this.startDate = start;
        this.endDate = end;
    }

    connectedCallback() {
        if (!this.hasAttribute('rendered')) {
            this.render();
            this.setAttribute('rendered', 'true');
        }
    }

    disconnectedCallback() {
        if (this.chartInstance) {
            this.chartInstance.destroy();
            this.chartInstance = null;
        }
    }

    render() {
        const title = this.getAttribute('title') || 'Chart';
        // We don't strictly need a random ID anymore if we querySelector the canvas
        // but keeping a unique ID is good practice in case it's used elsewhere or for debugging.
        // However, shadow DOM would be better for isolation, but let's stick to light DOM for now as per existing style.
        const chartId = this.getAttribute('chart-id') || `chart-${Math.random().toString(36).substr(2, 9)}`;

        this.innerHTML = `
            <div class="chart-container">
                <h3>${title}</h3>
                <canvas id="${chartId}"></canvas>
            </div>
        `;
    }

    /**
     * Sets the configuration for the Chart.js instance.
     * @param {Object} config - The Chart.js configuration object.
     */
    setConfiguration(config) {
        // Destroy existing chart if it exists
        if (this.chartInstance) {
            this.chartInstance.destroy();
        }

        const canvas = this.querySelector('canvas');
        if (!canvas) {
            console.error('ChartCard: Canvas element not found.');
            return;
        }

        this.chartInstance = new Chart(canvas, config);
    }
}

customElements.define('chart-card', ChartCard);

