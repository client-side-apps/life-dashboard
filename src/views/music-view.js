import { dbService } from '../db.js';
import * as dataRepository from '../services/data-repository.js';
import { DataView } from '../components/data-view/data-view.js';
import '../components/chart-card/chart-card.js';

export class MusicView extends DataView {
    constructor() {
        super();
    }

    connectedCallback() {
        super.connectedCallback();
        this.render();
    }

    async render() {
        this.innerHTML = '';
        const template = document.getElementById('music-view-template');
        const content = template.content.cloneNode(true);
        this.appendChild(content);

        await this.loadData();
    }

    async loadData() {
        await this.showLoading();

        try {
            const startDate = this.startDate;
            const endDate = this.endDate;

            // Fetch data
            const musicData = dataRepository.getTimeSeriesData('music', startDate, endDate);

            this.renderChart(musicData);
            this.renderTopStats(musicData);

        } finally {
            this.hideLoading();
        }
    }

    onDateRangeChanged() {
        this.loadData();
    }

    renderChart(data) {
        const chartCard = this.querySelector('chart-card[chart-id="music-chart"]');
        if (!chartCard) return;

        // Aggregate by day
        const dailyDuration = new Map();

        data.forEach(row => {
            const dateStr = new Date(row.timestamp).toISOString().split('T')[0];
            const duration = (row.duration_ms || 0) / 60000; // Minutes
            dailyDuration.set(dateStr, (dailyDuration.get(dateStr) || 0) + duration);
        });

        // Convert Map to array of objects for setTimeSeriesData
        const chartData = [];
        for (const [dateStr, duration] of dailyDuration.entries()) {
            // chart-card expects timestamp
            const timestamp = new Date(dateStr + 'T00:00:00').getTime();
            chartData.push({ timestamp, duration });
        }

        chartCard.setTimeSeriesData(chartData, {
            series: [{ label: 'Listening Time (min)', key: 'duration', color: '#1DB954' }],
            interval: 'daily',
            startDate: this.startDate,
            endDate: this.endDate,
            fill: true
        });
    }

    renderTopStats(data) {
        const container = this.querySelector('#music-values');
        if (!container) return;

        // Simple stats: Total Time, Top Artist
        let totalMs = 0;
        const artistCounts = {};

        data.forEach(row => {
            totalMs += (row.duration_ms || 0);
            if (row.artist_name) {
                artistCounts[row.artist_name] = (artistCounts[row.artist_name] || 0) + 1;
            }
        });

        const totalHours = (totalMs / 3600000).toFixed(1);

        let topArtist = '-';
        let maxCount = 0;
        for (const [artist, count] of Object.entries(artistCounts)) {
            if (count > maxCount) {
                maxCount = count;
                topArtist = artist;
            }
        }

        container.innerHTML = `
            <div class="stat-card">
                <h3>Total Listening Time</h3>
                <p class="stat-value">${totalHours} hrs</p>
            </div>
            <div class="stat-card">
                <h3>Top Artist</h3>
                <p class="stat-value small">${topArtist}</p>
            </div>
        `;
    }
}

customElements.define('music-view', MusicView);
