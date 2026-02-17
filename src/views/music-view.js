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

        let totalMs = 0;
        const artistCounts = {};
        const albumCounts = {};
        const trackCounts = {};

        data.forEach(row => {
            totalMs += (row.duration_ms || 0);

            if (row.artist_name) {
                artistCounts[row.artist_name] = (artistCounts[row.artist_name] || 0) + 1;
            }

            if (row.album_name) {
                // Key by album name (simple approach)
                albumCounts[row.album_name] = (albumCounts[row.album_name] || 0) + 1;
            }

            if (row.track_name) {
                // Key by track + artist to satisfy "Track" count (assuming uniqueness by name+artist)
                const key = `${row.track_name}|||${row.artist_name}`;
                trackCounts[key] = (trackCounts[key] || 0) + 1;
            }
        });

        const totalHours = (totalMs / 3600000).toFixed(1);

        const getTop = (counts, limit = 10) => Object.entries(counts)
            .sort((a, b) => b[1] - a[1])
            .slice(0, limit);

        const topArtists = getTop(artistCounts);
        const topAlbums = getTop(albumCounts);
        const topTracks = getTop(trackCounts).map(([k, v]) => {
            const [track, artist] = k.split('|||');
            return { name: track, artist, count: v };
        });

        const renderList = (items, type) => {
            if (items.length === 0) return '<p class="stat-empty">No data</p>';
            return `<ol class="stat-list">
                ${items.map(item => {
                const name = type === 'track' ? item.name : item[0];
                const count = type === 'track' ? item.count : item[1];
                const sub = type === 'track' ? `<span class="stat-sub">by ${item.artist}</span>` : '';
                return `<li>
                        <span class="stat-item-name" title="${name}">${name}</span>
                        ${sub}
                        <span class="stat-item-count">${count}</span>
                    </li>`;
            }).join('')}
            </ol>`;
        };

        container.innerHTML = `
            <div class="stat-card">
                <h3>Listening Time</h3>
                <p class="stat-value">${totalHours} <span class="unit">hrs</span></p>
            </div>
            <div class="stat-card">
                <h3>Top Artists</h3>
                ${renderList(topArtists, 'artist')}
            </div>
            <div class="stat-card">
                <h3>Top Albums</h3>
                ${renderList(topAlbums, 'album')}
            </div>
            <div class="stat-card">
                <h3>Top Tracks</h3>
                ${renderList(topTracks, 'track')}
            </div>
        `;

        // Add some styles purely for this view or rely on global? 
        // Let's inject a style block if it doesn't break CSP (templates usually allow it).
        // Since I'm replacing the innerHTML of '#music-values', I can't easily add styles outside unless I add them to index.html or here.
        // But components usually have styles in index.html template.
        // I should probably add styles to the template in index.html for .stat-list, etc.
    }
}

customElements.define('music-view', MusicView);
