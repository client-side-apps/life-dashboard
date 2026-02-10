import * as dataRepository from '../services/data-repository.js';
import { DataView } from '../components/data-view/data-view.js';
import { getChartColor, ChartColors } from '../utils/style.js';

const ELECTRICITY_COST_PER_KWH = 0.20; // $0.20 per kWh
const GAS_COST_PER_THERM = 1.20; // $1.20 per Therm

export class EnergyView extends DataView {
    constructor() {
        super();
    }

    connectedCallback() {
        super.connectedCallback();
        // Stage 1: Immediate Loading State
        this.innerHTML = '<div class="loading-overlay" style="position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; background: rgba(255,255,255,0.8); z-index: 100;">Loading Energy View...</div>';

        // Stage 2: Defer full render to ensure paint
        setTimeout(() => {
            this.setupView();
            this.refresh();
        }, 50);
    }

    setupView() {
        this.innerHTML = '';
        const template = document.getElementById('energy-view-template');
        const content = template.content.cloneNode(true);
        this.appendChild(content);

        // Ensure overlay is visible initially (it might be hidden in template)
        // refresh() will handle it, but to avoid flash of content we can force it
        const loader = this.querySelector('.loading-overlay');
        if (loader) loader.classList.remove('hidden');
    }

    async loadData() {
        const startDate = this.startDate;
        const endDate = this.endDate;

        // Daily Cost Chart
        await this.createCostChart('cost-chart', startDate, endDate);

        // Hypothetical table names: electricity, gas
        await this.createMultiLineChart('solar-chart', 'electricity_solar_hourly',
            [{ label: 'Solar Production', col: 'solar_kwh', color: getChartColor(ChartColors.Yellow) },
            { label: 'Consumption', col: 'consumption_kwh', color: getChartColor(ChartColors.Magenta) }],
            startDate, endDate);

        await this.createSingleLineChart('elec-import-chart', 'Electricity Import', 'electricity_grid_daily', 'import_kwh', getChartColor(ChartColors.Cyan), startDate, endDate);

        await this.createSingleLineChart('gas-chart', 'Gas Import', 'gas_daily', 'usage_therms', getChartColor(ChartColors.Red), startDate, endDate);

        await this.createSingleLineChart('water-chart', 'Water Usage', 'water_daily', 'usage_liters', getChartColor(ChartColors.Blue), startDate, endDate);
    }

    async createCostChart(chartId, startDate, endDate) {
        const chartCard = this.querySelector(`chart-card[chart-id="${chartId}"]`);
        if (!chartCard) return;

        const electricityData = dataRepository.getTimeSeriesData('electricity_grid_daily', startDate, endDate, 'ASC');
        const gasData = dataRepository.getTimeSeriesData('gas_daily', startDate, endDate, 'ASC');

        chartCard.setDateRange(startDate, endDate);

        // Combine data
        const dataMap = new Map();

        // Helper to add data
        const addData = (data, key, rate, type) => {
            if (!data) return;
            data.forEach(item => {
                const day = new Date(item.timestamp);
                day.setHours(0, 0, 0, 0);
                const ts = day.getTime();

                if (!dataMap.has(ts)) {
                    dataMap.set(ts, { timestamp: ts, gas: 0, electricity: 0 });
                }
                const entry = dataMap.get(ts);

                // Use stored cost if available, otherwise calculate
                let cost = 0;
                if (item.cost !== undefined && item.cost !== null) {
                    cost = item.cost;
                } else {
                    const val = item[key] || 0;
                    cost = val * rate;
                }

                if (type === 'electricity') entry.electricity += cost;
                if (type === 'gas') entry.gas += cost;
            });
        };

        addData(electricityData, 'import_kwh', ELECTRICITY_COST_PER_KWH, 'electricity');
        addData(gasData, 'usage_therms', GAS_COST_PER_THERM, 'gas');

        // Convert to arrays
        const timestamps = Array.from(dataMap.keys()).sort((a, b) => a - b);
        const labels = [];
        const gasCostData = [];
        const electricityCostData = [];

        timestamps.forEach(ts => {
            const dateObj = new Date(ts);
            // Format label YYYY-MM-DD
            labels.push(`${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, '0')}-${String(dateObj.getDate()).padStart(2, '0')}`);
            const entry = dataMap.get(ts);
            gasCostData.push(entry.gas);
            electricityCostData.push(entry.electricity);
        });

        // Use custom chart type via options
        chartCard.setChartData({
            labels: labels,
            datasets: [
                {
                    label: 'Gas Cost ($)',
                    data: gasCostData,
                    backgroundColor: getChartColor(ChartColors.Red),
                    stack: 'cost'
                },
                {
                    label: 'Electricity Cost ($)',
                    data: electricityCostData,
                    backgroundColor: getChartColor(ChartColors.Cyan),
                    stack: 'cost'
                }
            ]
        }, {
            type: 'bar',
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    x: {
                        stacked: true,
                        ticks: { color: '#666' },
                        grid: { display: false }
                    },
                    y: {
                        stacked: true,
                        beginAtZero: true,
                        ticks: {
                            color: '#666',
                            callback: function(value) {
                                return '$' + value;
                            }
                        },
                        grid: { color: '#ccc' }
                    }
                },
                plugins: {
                    tooltip: {
                        mode: 'index',
                        intersect: false,
                        callbacks: {
                            label: function(context) {
                                let label = context.dataset.label || '';
                                if (label) {
                                    label += ': ';
                                }
                                if (context.parsed.y !== null) {
                                    label += new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(context.parsed.y);
                                }
                                return label;
                            }
                        }
                    },
                    legend: {
                        display: true, // Show legend for this chart
                        position: 'bottom'
                    }
                }
            }
        });
    }

    async createMultiLineChart(chartId, tableName, datasetsConfig, startDate, endDate) {
        const chartCard = this.querySelector(`chart-card[chart-id="${chartId}"]`);
        if (!chartCard) return;

        // Check table
        const tables = dataRepository.getTables();
        if (!tables.includes(tableName)) {
            chartCard.innerHTML += `<p>Table "${tableName}" not found.</p>`;
            return;
        }

        const data = dataRepository.getTimeSeriesData(tableName, startDate, endDate, 'ASC');

        chartCard.setDateRange(startDate, endDate);

        const interval = this._detectInterval(data, tableName);

        chartCard.setTimeSeriesData(data, {
            series: datasetsConfig.map(cfg => ({
                label: cfg.label,
                key: cfg.col,
                color: cfg.color
            })),
            interval: interval,
            startDate: startDate,
            endDate: endDate
        });
    }

    async createSingleLineChart(chartId, label, tableName, valueCol, color, startDate, endDate) {
        const chartCard = this.querySelector(`chart-card[chart-id="${chartId}"]`);
        if (!chartCard) return;

        const tables = dataRepository.getTables();
        if (!tables.includes(tableName)) {
            chartCard.innerHTML += `<p>Table "${tableName}" not found.</p>`;
            return;
        }

        const data = dataRepository.getTimeSeriesData(tableName, startDate, endDate, 'ASC');

        chartCard.setDateRange(startDate, endDate);

        const interval = this._detectInterval(data, tableName);

        chartCard.setTimeSeriesData(data, {
            series: [{
                label: label,
                key: valueCol,
                color: color
            }],
            interval: interval,
            startDate: startDate,
            endDate: endDate
        });
    }
    _detectInterval(data, tableName) {
        // Auto-detect interval from actual data spacing rather than table name
        if (data.length >= 2) {
            const gaps = [];
            for (let i = 1; i < Math.min(data.length, 10); i++) {
                gaps.push(data[i].timestamp - data[i - 1].timestamp);
            }
            const medianGap = gaps.sort((a, b) => a - b)[Math.floor(gaps.length / 2)];
            // If median gap is >= 12 hours, treat as daily
            if (medianGap >= 12 * 3600 * 1000) return 'daily';
            return 'hourly';
        }
        // Fallback to table name heuristic
        return tableName.includes('hourly') ? 'hourly' : 'daily';
    }
}

customElements.define('energy-view', EnergyView);
