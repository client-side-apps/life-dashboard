import { dbService } from '../db.js';
import { DataView } from '../components/data-view/data-view.js';

export class MoviesView extends DataView {
    constructor() {
        super();
    }

    connectedCallback() {
        super.connectedCallback();
        this.render();
    }

    async render() {
        // Clear current content if any
        this.innerHTML = '';

        const template = document.getElementById('movies-view-template');
        const content = template.content.cloneNode(true);
        this.appendChild(content);

        const picker = this.querySelector('date-range-picker');
        if (picker) {
            // Default to maybe last 6 months or year for movies?
            // Or all time? Let's do last 90 days.
            const today = new Date();
            const past = new Date();
            past.setDate(today.getDate() - 90);

            const endDate = today.toISOString().split('T')[0];
            const startDate = past.toISOString().split('T')[0];

            picker.startDate = startDate;
            picker.endDate = endDate;
            this.startDate = startDate;
            this.endDate = endDate;
        }

        this.loadMovies();
    }

    onDateRangeChanged() {
        this.loadMovies();
    }

    async loadMovies() {
        const grid = this.querySelector('#movies-grid');

        const tables = dbService.getTables();
        if (!tables.includes('movies')) {
            grid.innerHTML = 'Table "movies" not found.';
            return;
        }

        let query = 'SELECT * FROM movies';
        let params = [];

        const startDate = this.startDate;
        const endDate = this.endDate;

        if (startDate && endDate) {
            query += ' WHERE timestamp >= ? AND timestamp <= ?';
            const startTs = new Date(startDate + 'T00:00:00').getTime();
            const endTs = new Date(endDate + 'T23:59:59.999').getTime();
            params.push(startTs);
            params.push(endTs);
        }

        query += ' ORDER BY timestamp DESC LIMIT 50';

        const movies = dbService.query(query, params);

        if (movies.length === 0) {
            grid.innerHTML = 'No movies found.';
            return;
        }

        grid.innerHTML = movies.map(m => {
            const title = m.title || m.name || 'Unknown Title';
            const year = m.year || '';
            const rating = m.rating || m.my_rating || '';
            const watched = m.timestamp;
            const watchedStr = watched ? new Date(watched).toLocaleDateString() : 'Unknown date';
            const poster = m.poster_url || m.image || null; // Optional

            return `
                <div class="movie-card">
                    ${poster ? `<img src="${poster}" alt="${title}" class="movie-poster">` :
                    `<div class="movie-poster-placeholder">No Poster</div>`}
                    <div class="movie-info">
                        <h3 class="movie-title">${title} ${year ? `(${year})` : ''}</h3>
                        <div class="movie-meta">
                            <span>${watchedStr}</span>
                            <span>${rating ? `★ ${rating}` : ''}</span>
                        </div>
                    </div>
                </div>
            `;
        }).join('');
    }
}

customElements.define('movies-view', MoviesView);
