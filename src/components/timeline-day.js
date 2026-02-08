import L from 'leaflet';
import { getChartColor, ChartColors } from '../utils/style.js';

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
        const nutritionEvents = events.filter(e => e.type === 'nutrition');

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

        // Nutrition (Total Calories)
        if (nutritionEvents.length > 0) {
            let totalCals = 0;
            nutritionEvents.forEach(e => {
                // Title format: "Breakfast (450 kcal)"
                const calMatch = e.title.match(/\((\d+) kcal\)/);
                if (calMatch) {
                    totalCals += parseInt(calMatch[1]);
                }
            });
            stats.push({
                icon: '🥗',
                label: 'Nutrition',
                value: `${Math.round(totalCals)} kcal`
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

                     ${nutritionEvents.length > 0 ? `
                        <div class="day-nutrition-list" style="margin-top: 15px; border-top: 1px solid var(--border-color); padding-top: 10px;">
                            ${nutritionEvents.map(e => `
                                <div class="nutrition-item" style="margin-bottom: 8px;">
                                    <strong>${e.title}</strong>
                                    <div style="font-size: 0.9em; opacity: 0.8; white-space: pre-line;">${e.details}</div>
                                </div>
                            `).join('')}
                        </div>
                     ` : ''}
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

        const polyline = L.polyline(latLngs, { color: getComputedStyle(document.body).getPropertyValue('--text-color').trim(), weight: 2 }).addTo(map);

        // Start (Green -> High Contrast geometric)
        L.circleMarker(latLngs[0], { radius: 4, color: getChartColor(ChartColors.Green), fillOpacity: 1, stroke: true, weight: 1, fillColor: getChartColor(ChartColors.PrimaryText) }).addTo(map);
        // End (Red -> High Contrast geometric)
        L.circleMarker(latLngs[latLngs.length - 1], { radius: 4, color: getChartColor(ChartColors.Red), fillOpacity: 1, stroke: true, weight: 1, fillColor: getChartColor(ChartColors.PrimaryText) }).addTo(map);

        map.fitBounds(polyline.getBounds(), { padding: [20, 20] });

        this.map = map;
    }
}

customElements.define('timeline-day', TimelineDay);
