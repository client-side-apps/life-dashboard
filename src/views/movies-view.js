import { dbService } from '../db.js';

export class MoviesView extends HTMLElement {
    constructor() {
        super();
    }

    connectedCallback() {
        this.render();
    }

    async render() {
        // Clear current content if any
        this.innerHTML = '';

        const template = document.getElementById('movies-view-template');
        const content = template.content.cloneNode(true);
        this.appendChild(content);

        this.loadMovies();
    }

    async loadMovies() {
        const grid = this.querySelector('#movies-grid');

        const tables = dbService.getTables();
        if (!tables.includes('movies')) {
            grid.innerHTML = 'Table "movies" not found.';
            return;
        }

        const movies = dbService.query('SELECT * FROM movies ORDER BY time_watched DESC LIMIT 50');

        if (movies.length === 0) {
            grid.innerHTML = 'No movies found.';
            return;
        }

        grid.innerHTML = movies.map(m => {
            const title = m.title || m.name || 'Unknown Title';
            const year = m.year || '';
            const rating = m.rating || m.my_rating || '';
            const watched = m.time_watched || m.date_watched;
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
