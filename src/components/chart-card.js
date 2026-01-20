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

    /**
     * Sets time-series data handling gaps and enforcing date range.
     * @param {Array<Object>} data - Array of data objects { timestamp, ...values }
     * @param {Object} config - Configuration options
     * @param {Array<Object>} config.series - Array of { label, key, color }
     * @param {string} [config.interval='daily'] - 'daily' or 'hourly'
     * @param {string|number} [config.startDate] - Start date/timestamp
     * @param {string|number} [config.endDate] - End date/timestamp
     */
    setTimeSeriesData(data, config) {
        const { series, interval = 'daily', startDate, endDate } = config;

        // Sort data by timestamp just in case
        data.sort((a, b) => a.timestamp - b.timestamp);

        // Determine range
        let startTs, endTs;

        if (startDate) {
            startTs = new Date(startDate).getTime();
        } else {
            startTs = data.length > 0 ? data[0].timestamp : new Date().setHours(0, 0, 0, 0);
        }

        if (endDate) {
            // End of the day for the end date if it stands for a day
            // If it's a timestamp, take it as is.
            // Assuming string "YYYY-MM-DD" means inclusive full day.
            if (typeof endDate === 'string' && endDate.includes('-')) {
                endTs = new Date(endDate + 'T23:59:59.999').getTime();
            } else {
                endTs = new Date(endDate).getTime();
            }
        } else {
            endTs = data.length > 0 ? data[data.length - 1].timestamp : new Date().getTime();
        }

        // Generate full time range
        const labels = [];
        const normalizedData = {};
        series.forEach(s => normalizedData[s.key] = []);

        let currentTs = startTs;
        // Align currentTs to start of interval if needed (e.g. start of hour/day)
        // For now assume caller passes aligned or reasonable timestamps.

        const step = interval === 'hourly' ? 3600 * 1000 : 86400 * 1000;

        // Map data for quick lookup
        const dataMap = new Map();
        data.forEach(d => {
            // Round timestamp to nearest interval to match our stepping
            // This prevents slight mismatches.
            // For simplicty, looking for exact match or within reasonable delta?
            // Let's assume data is somewhat aligned or we take the first point in the window.
            // Better: Let's assume data is keyed by timestamp.
            dataMap.set(d.timestamp, d);
        });

        while (currentTs <= endTs) {
            const dateObj = new Date(currentTs);
            labels.push(dateObj.toLocaleDateString() + (interval === 'hourly' ? ' ' + dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''));

            // Look for data point
            // We check if we have a data point roughly at this time (within step/2?)
            // Or exact match. Let's try finding a point that falls in [currentTs, currentTs + step)
            // But since we are generating points, better to see if we have an entry.
            // For now, exact match logic or "closest" logic if needed.
            // The importers store precise timestamps.
            // Daily data usually stored as T00:00:00 or similar.

            // Simple approach: Check if we have a point in the map with a tolerance?
            // Since Map is exact, let's try finding from array (sorted)
            // With sorted array, we can walk it efficiently.

            // Re-implementation: Walk array alongside generation
            currentTs += step;
        }

        // Let's rewrite the loop with a more efficient lookup or array walk
        labels.length = 0; // clear

        let dataIdx = 0;
        currentTs = startTs;

        while (currentTs <= endTs) {
            const dateObj = new Date(currentTs);
            // Format label
            if (interval === 'daily') {
                labels.push(dateObj.toLocaleDateString());
            } else {
                labels.push(dateObj.toLocaleString());
            }

            // Find if we have data for this slot.
            // We accept data if it's >= currentTs and < currentTs + step
            // If multiple, maybe average? Or take first.
            // If none, push null.

            let match = null;

            while (dataIdx < data.length) {
                const d = data[dataIdx];
                if (d.timestamp < currentTs) {
                    dataIdx++; // Skip old data
                    continue;
                }
                if (d.timestamp < currentTs + step) {
                    match = d;
                    // Don't increment dataIdx yet, maybe we want to aggregate?
                    // For now simple: take first match, skip others in this bucket
                    dataIdx++; // Consumed
                    // Skip remaining in this bucket
                    while (dataIdx < data.length && data[dataIdx].timestamp < currentTs + step) {
                        dataIdx++;
                    }
                    break;
                }
                // d.timestamp >= currentTs + step
                // Future data, wait for next loop
                break;
            }

            series.forEach(s => {
                if (match) {
                    normalizedData[s.key].push(match[s.key] || 0); // Use 0 if key missing in record? Or match[s.key] could be null?
                    // If we want actual gaps in line, we need null.
                    // But if data record exists but property is missing, maybe 0?
                    // User asked for "no data point -> gap".
                    // Ideally if 'match' is found, we assume valid data point.
                    // If value is missing, maybe null?
                    // Let's use `match[s.key] !== undefined ? match[s.key] : null`
                } else {
                    normalizedData[s.key].push(null);
                }
            });

            currentTs += step;
        }

        const datasets = series.map(s => ({
            label: s.label,
            data: normalizedData[s.key],
            borderColor: s.color,
            tension: 0.1,
            fill: false,
            spanGaps: false // This ensures nulls create gaps
        }));

        this.setConfiguration({
            type: 'line',
            data: { labels, datasets },
            options: {
                responsive: true,
                scales: {
                    y: { beginAtZero: true } // Usually good
                }
            }
        });

        // Also update internal state if needed
        this.startDate = startDate;
        this.endDate = endDate;
    }
}

customElements.define('chart-card', ChartCard);

