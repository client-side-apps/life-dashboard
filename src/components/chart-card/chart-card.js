import Chart from 'chart.js';
import { calculateMovingAverage } from '../../utils/math.js';

export class ChartCard extends HTMLElement {
    constructor() {
        super();
        this.chartInstance = null;
        this._startDate = null;
        this._endDate = null;
        this.timestamps = []; // Store timestamps for sync
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
                <canvas id="${chartId}" role="img" aria-label="${title}"></canvas>
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
        // Ensure we are rendered
        if (!this.hasAttribute('rendered')) {
            this.render();
            this.setAttribute('rendered', 'true');
        }

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
     * Sets chart data and options directly.
     * @param {Object} data - Chart.js data object { labels, datasets }
     * @param {Object} options - Chart.js options object
     */
    setChartData(data, options) {
        this.setConfiguration({
            ...options,
            data: data
        });
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
        const { series, interval = 'daily', startDate, endDate, fill = false, stacked = false } = config;

        // Reset timestamps
        this.timestamps = [];

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
        this.timestamps = []; // Clear and rebuild
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
            labels.push(`${dateObj.getFullYear()}-${String(dateObj.getMonth()+1).padStart(2,'0')}-${String(dateObj.getDate()).padStart(2,'0')}` + (interval === 'hourly' ? ' ' + dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''));

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
                labels.push(`${dateObj.getFullYear()}-${String(dateObj.getMonth()+1).padStart(2,'0')}-${String(dateObj.getDate()).padStart(2,'0')}`);
            } else {
                labels.push(`${dateObj.getFullYear()}-${String(dateObj.getMonth()+1).padStart(2,'0')}-${String(dateObj.getDate()).padStart(2,'0')} ${dateObj.toLocaleTimeString()}`);
            }
            this.timestamps.push(currentTs);

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

        // Calculate Rolling Weekly Average
        const weekMs = 7 * 24 * 3600 * 1000;
        const windowSize = Math.round(weekMs / step);
        const movingAverages = {};

        series.forEach(s => {
            const rawData = normalizedData[s.key];
            movingAverages[s.key] = calculateMovingAverage(rawData, windowSize);
        });

        const datasets = [];
        series.forEach(s => {
            // Original Daily Data (Faded)
            const rawDataset = {
                label: s.label,
                data: normalizedData[s.key],
                borderColor: this._hexToRgba(s.color, 0.2),
                borderWidth: 1,
                pointRadius: 0, 
                pointHoverRadius: 4,
                tension: 0, 
                stepped: 'middle', 
                fill: false,
                spanGaps: false,
                order: 1
            };
            if (stacked) rawDataset.stack = 'raw';
            datasets.push(rawDataset);

            // Rolling Average (Prominent)
            const avgDataset = {
                label: s.label + ' (7d Avg)',
                data: movingAverages[s.key],
                borderColor: s.color,
                borderWidth: 2,
                pointRadius: 0,
                pointHoverRadius: 4,
                tension: 0.4,
                fill: fill ? (stacked ? true : 'origin') : false,
                backgroundColor: fill ? this._hexToRgba(s.color, 0.2) : undefined,
                spanGaps: true,
                order: 2
            };
            if (stacked) avgDataset.stack = 'avg';
            datasets.push(avgDataset);
        });

        // Initialize cached colors
        this._updateThemeColors();

        // Define vertical line plugin
        const verticalLinePlugin = {
            id: 'verticalLine',
            afterDraw: (chart) => {
                if (chart.tooltip && chart.tooltip._active && chart.tooltip._active.length) {
                    const activePoint = chart.tooltip._active[0];
                    const ctx = chart.ctx;
                    const x = activePoint.element.x;
                    const topY = chart.scales.y.top;
                    const bottomY = chart.scales.y.bottom;

                    ctx.save();
                    ctx.beginPath();
                    ctx.moveTo(x, topY);
                    ctx.lineTo(x, bottomY);
                    ctx.lineWidth = 1;
                    ctx.strokeStyle = this._themeColors.textSecondary;
                    ctx.stroke();
                    ctx.restore();
                }
            }
        };

        // Define sync plugin
        const syncPlugin = {
            id: 'syncPlugin',
            afterEvent: (chart, args) => {
                const { event } = args;
                // Only handle mousemove/mouseout
                if (event.type !== 'mousemove' && event.type !== 'mouseout') return;

                // If mouseout or not in chart area
                if (event.type === 'mouseout' || !args.inChartArea) {
                    this.dispatchEvent(new CustomEvent('chart-hover', {
                        detail: { timestamp: null, originalEvent: event },
                        bubbles: true,
                        composed: true
                    }));
                    return;
                }

                if (event.type === 'mousemove') {
                    const elements = chart.getElementsAtEventForMode(event, 'index', { intersect: false }, true);
                    if (elements && elements.length > 0) {
                        const index = elements[0].index;
                        const timestamp = this.timestamps[index];
                        this.dispatchEvent(new CustomEvent('chart-hover', {
                            detail: { timestamp, originalEvent: event },
                            bubbles: true,
                            composed: true
                        }));
                    }
                }
            }
        };

        this.setConfiguration({
            type: 'line',
            data: { labels, datasets },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: {
                    mode: 'index',
                    intersect: false,
                },
                plugins: {
                    tooltip: {
                        enabled: true,
                        mode: 'index',
                        intersect: false,
                        position: 'nearest',
                        backgroundColor: 'rgba(255, 255, 255, 0.9)',
                        titleColor: '#000',
                        bodyColor: '#333',
                        borderColor: '#ccc',
                        borderWidth: 1,
                        displayColors: true,
                        callbacks: {
                            label: function (context) {
                                let label = context.dataset.label || '';
                                if (label) {
                                    label += ': ';
                                }
                                if (context.parsed.y !== null) {
                                    let val = context.parsed.y;
                                    // Round 7d average to 1 decimal place
                                    if (context.dataset.label && context.dataset.label.includes('(7d Avg)')) {
                                        val = Math.round(val * 10) / 10;
                                    }
                                    label += val;
                                }
                                return label;
                            }
                        }
                    },
                    legend: {
                        display: false,
                        labels: {
                            color: this._themeColors.textPrimary
                        }
                    }
                },
                scales: {
                    y: {
                        stacked: stacked,
                        beginAtZero: true,
                        grid: {
                            color: this._themeColors.borderColor
                        },
                        ticks: {
                            display: true,
                            color: this._themeColors.textSecondary
                        }
                    },
                    x: {
                        stacked: stacked,
                        grid: {
                            display: false
                        },
                        ticks: {
                            display: true,
                            color: this._themeColors.textSecondary,
                            maxRotation: 0,
                            autoSkip: true,
                            maxTicksLimit: 10
                        }
                    }
                }
            },
            plugins: [verticalLinePlugin, syncPlugin]
        });

        // Also update internal state if needed
        this.startDate = startDate;
        this.endDate = endDate;
    }

    _hexToRgba(hex, alpha) {
        let c;
        if (/^#([A-Fa-f0-9]{3}){1,2}$/.test(hex)) {
            c = hex.substring(1).split('');
            if (c.length == 3) {
                c = [c[0], c[0], c[1], c[1], c[2], c[2]];
            }
            c = '0x' + c.join('');
            return 'rgba(' + [(c >> 16) & 255, (c >> 8) & 255, c & 255].join(',') + ',' + alpha + ')';
        }
        return hex;
    }

    _updateThemeColors() {
        const style = getComputedStyle(document.body);
        // Use --text-color for both primary and secondary text as we don't have a secondary text variable
        // This ensures readability in both light and dark modes.
        const textColor = style.getPropertyValue('--text-color').trim() || '#000';
        const borderColor = style.getPropertyValue('--border-color').trim() || '#ccc';
        
        this._themeColors = {
            textPrimary: textColor,
            textSecondary: textColor,
            borderColor: borderColor
        };
    }

    /**
     * Updates the chart theme.
     * Can be called by parent components when theme changes.
     */
    updateTheme() {
        if (!this.chartInstance) return;

        this._updateThemeColors();

        const options = this.chartInstance.options;

        // Update scales
        if (options.scales.x && options.scales.x.ticks) options.scales.x.ticks.color = this._themeColors.textSecondary;
        if (options.scales.y && options.scales.y.grid) options.scales.y.grid.color = this._themeColors.borderColor;
        if (options.scales.y && options.scales.y.ticks) options.scales.y.ticks.color = this._themeColors.textSecondary;

        // Update legend
        if (options.plugins.legend && options.plugins.legend.labels) options.plugins.legend.labels.color = this._themeColors.textPrimary;

        this.chartInstance.update();
    }

    /**
     * Highlights a specific timestamp on the chart.
     * @param {number|null} timestamp - The timestamp to highlight.
     */
    setHighlightTimestamp(timestamp) {
        if (!this.chartInstance) return;

        if (timestamp === null) {
            this.chartInstance.tooltip.setActiveElements([], { x: 0, y: 0 });
            this.chartInstance.update('none'); // Update without animation
            return;
        }

        // Find closest index
        // Since timestamps are sorted, we could binary search, but checking all is fine for small N.
        let closestIndex = -1;
        let minDiff = Infinity;

        // Optimized: assume sorted
        // actually just linear scan is fine for < 1000 points
        for (let i = 0; i < this.timestamps.length; i++) {
            const diff = Math.abs(this.timestamps[i] - timestamp);
            if (diff < minDiff) {
                minDiff = diff;
                closestIndex = i;
            }
        }

        // Must be reasonably close? e.g. within half a step?
        // Let's say if it's within the view range it's fine.
        // Actually for sync, we want the closest point even if slightly off (e.g. hourly vs daily)
        // accepted for now.

        if (closestIndex !== -1) {
            const activeElements = this.chartInstance.data.datasets.map((ds, i) => ({
                datasetIndex: i,
                index: closestIndex,
            }));

            this.chartInstance.tooltip.setActiveElements(activeElements, { x: 0, y: 0 });
            this.chartInstance.update('none');
        }
    }
}

customElements.define('chart-card', ChartCard);

