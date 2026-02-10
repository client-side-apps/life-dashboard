import * as dataRepository from '../../services/data-repository.js';
import { DataView } from '../../components/data-view/data-view.js';
import { getChartColor, ChartColors } from '../../utils/style.js';

export class HealthSleepView extends DataView {
    constructor() {
        super();
    }

    connectedCallback() {
        super.connectedCallback();
        this.render();
    }

    onDateRangeChanged() {
        this.render();
    }

    async render() {
        const startDate = this.startDate;
        const endDate = this.endDate;

        this.innerHTML = `
            <div class="dashboard-grid">
                <chart-card title="Sleep Duration" chart-id="sleep-duration-chart"></chart-card>
                <chart-card title="Sleep Schedule" chart-id="sleep-schedule-chart"></chart-card>
            </div>
        `;

        this.createChart('sleep-duration-chart', 'Duration (Hours)', 'sleep', 'duration_hours', getChartColor(ChartColors.Magenta), startDate, endDate);
        this.renderScheduleChart('sleep-schedule-chart', startDate, endDate);
    }

    async renderScheduleChart(chartId, startDate, endDate) {
        const chartCard = this.querySelector(`chart-card[chart-id="${chartId}"]`);
        if (!chartCard) return;

        const rawData = dataRepository.getTimeSeriesData('sleep', startDate, endDate, 'ASC');

        // Transform data to show bedtime and wake time as offsets from midnight
        const processedData = rawData.map(row => {
            const wakeDate = new Date(row.timestamp);
            const startOfDay = new Date(wakeDate.getFullYear(), wakeDate.getMonth(), wakeDate.getDate()).getTime();

            return {
                timestamp: row.timestamp,
                bedtime_offset: (row.start_timestamp - startOfDay) / 3600000,
                wake_offset: (row.timestamp - startOfDay) / 3600000
            };
        });

        chartCard.setDateRange(startDate, endDate);
        chartCard.setTimeSeriesData(processedData, {
            series: [
                { label: 'Bedtime', key: 'bedtime_offset', color: getChartColor(ChartColors.Yellow) },
                { label: 'Wake Up', key: 'wake_offset', color: getChartColor(ChartColors.Cyan) }
            ],
            startDate: startDate,
            endDate: endDate,
            interval: 'daily'
        });
    }

    async createChart(chartId, label, tableName, valueCol, color, startDate, endDate) {
        const chartCard = this.querySelector(`chart-card[chart-id="${chartId}"]`);
        if (!chartCard) return;

        const valid = await this.checkTable(tableName);
        if (!valid) {
            chartCard.innerHTML += `<p>Table "${tableName}" not found.</p>`;
            return;
        }

        const data = dataRepository.getTimeSeriesData(tableName, startDate, endDate, 'ASC');

        chartCard.setDateRange(startDate, endDate);

        chartCard.setTimeSeriesData(data, {
            series: [{
                label: label,
                key: valueCol || 'value',
                color: color
            }],
            startDate: startDate,
            endDate: endDate,
            interval: 'daily'
        });
    }

    async checkTable(tableName) {
        const tables = dataRepository.getTables();
        return tables.includes(tableName);
    }
}

customElements.define('health-sleep-view', HealthSleepView);
