export class ChartCard extends HTMLElement {
    constructor() {
        super();
    }

    connectedCallback() {
        if (!this.hasAttribute('rendered')) {
            this.render();
            this.setAttribute('rendered', 'true');
        }
    }

    render() {
        const title = this.getAttribute('title') || 'Chart';
        const chartId = this.getAttribute('chart-id') || `chart-${Math.random().toString(36).substr(2, 9)}`;

        this.innerHTML = `
            <div class="chart-container">
                <h3>${title}</h3>
                <canvas id="${chartId}"></canvas>
            </div>
        `;
    }
}

customElements.define('chart-card', ChartCard);
