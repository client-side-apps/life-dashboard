import L from 'leaflet';

export class TimelineDay extends HTMLElement {
    constructor() {
        super();
        this._data = null;
        this.map = null;
    }

    set data({ date, events }) {
        this._data = { date, events };
        this.render();
    }

    render() {
        if (!this._data) return;
        const { date, events } = this._data;

        // Categorize events
        const locationEvents = events.filter(e => e.type === 'location');
        const activityEvents = events.filter(e => e.type === 'activity');
        const weightEvents = events.filter(e => e.type === 'weight');
        const sleepEvents = events.filter(e => e.type === 'sleep');

        // Calculate Stats
        let stats = [];

        // Steps
        let totalSteps = 0;
        let totalDist = 0;
        activityEvents.forEach(e => {
            const steps = parseInt(e.details.match(/(\d+) steps/)?.[1] || 0);
            totalSteps += steps;

            // Extract distance if present "2000 steps, 1.50km"
            const distMatch = e.details.match(/([\d\.]+)km/);
            if (distMatch) {
                totalDist += parseFloat(distMatch[1]);
            }
        });

        if (totalSteps > 0) {
            stats.push({
                icon: '👟',
                label: 'Steps',
                value: totalSteps.toLocaleString(),
                sub: totalDist > 0 ? `${totalDist.toFixed(1)} km` : null
            });
        }

        // Sleep
        let sleepDuration = 0;
        sleepEvents.forEach(e => {
            const hours = parseFloat(e.details.match(/([\d\.]+) hrs/)?.[1] || 0);
            sleepDuration += hours;
        });

        if (sleepDuration > 0) {
            stats.push({
                icon: '😴',
                label: 'Sleep',
                value: `${sleepDuration.toFixed(1)}h`
            });
        }

        // Weight (Take the last measurement of the day)
        if (weightEvents.length > 0) {
            const lastWeight = weightEvents[0].details; // Sorted DESC, so first is latest? No, events sorted DESC.
            // Wait, usually we want the morning weight? 
            // If sorted DESC (latest first), then index 0 is evening. 
            // Let's just take the first one available in the list.
            stats.push({
                icon: '⚖️',
                label: 'Weight',
                value: lastWeight
            });
        }

        this.innerHTML = `
            <div class="day-card">
                <div class="day-header">
                    <span class="day-date">${new Date(date).toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</span>
                </div>
                
                ${locationEvents.length > 0 ? `<div class="day-map-container" id="map-${date}"></div>` : ''}

                <div class="day-content">
                     ${stats.length > 0 ? `
                        <div class="day-stats-grid">
                            ${stats.map(s => `
                                <div class="stat-item">
                                    <div class="stat-icon">${s.icon}</div>
                                    <div class="stat-info">
                                        <div class="stat-value">${s.value}</div>
                                        <div class="stat-label">${s.label}</div>
                                        ${s.sub ? `<div class="stat-sub">${s.sub}</div>` : ''}
                                    </div>
                                </div>
                            `).join('')}
                        </div>
                     ` : '<div class="day-empty">No activity data recorded</div>'}
                </div>
            </div>
        `;

        if (locationEvents.length > 0) {
            requestAnimationFrame(() => this.initMap(locationEvents, `map-${date}`));
        }
    }

    initMap(locations, elementId) {
        const element = this.querySelector(`#${elementId}`);
        if (!element) return;

        const map = L.map(element, {
            zoomControl: false,
            scrollWheelZoom: false,
            attributionControl: false,
            dragging: false
        });

        const latLngs = locations.map(l => {
            const parts = l.details.split(',').map(s => parseFloat(s.trim()));
            return parts;
        }).filter(p => !isNaN(p[0]) && !isNaN(p[1]));

        if (latLngs.length === 0) return;

        const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
        if (isDark) {
            L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', { maxZoom: 20 }).addTo(map);
        } else {
            L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', { maxZoom: 20 }).addTo(map);
        }

        const polyline = L.polyline(latLngs, { color: 'var(--primary-color)', weight: 3 }).addTo(map);

        L.circleMarker(latLngs[0], { radius: 4, color: '#2ecc71', fillOpacity: 1 }).addTo(map);
        L.circleMarker(latLngs[latLngs.length - 1], { radius: 4, color: '#e74c3c', fillOpacity: 1 }).addTo(map);

        map.fitBounds(polyline.getBounds(), { padding: [20, 20] });

        this.map = map;
    }
}

customElements.define('timeline-day', TimelineDay);
