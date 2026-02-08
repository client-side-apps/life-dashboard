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

        // Sleep (use max record to avoid double-counting segments)
        let sleepDuration = 0;
        let bestSleep = null;
        sleepEvents.forEach(e => {
            if ((e.duration_hours || 0) > sleepDuration) {
                sleepDuration = e.duration_hours;
                bestSleep = e;
            }
        });

        if (sleepDuration > 0) {
            const formatPhase = (seconds) => {
                if (!seconds) return '0h 0m';
                const h = Math.floor(seconds / 3600);
                const m = Math.floor((seconds % 3600) / 60);
                return h > 0 ? `${h}h ${m}m` : `${m}m`;
            };

            stats.push({
                icon: '😴',
                label: 'Sleep',
                value: `${sleepDuration.toFixed(1)}h`,
                linkId: `sleep-toggle-${date}`,
                expandHtml: `<div class="stat-details-collapsible" id="sleep-toggle-${date}" hidden>
                    <ul class="sleep-phases">
                        <li>Deep: ${formatPhase(bestSleep.deep_seconds)}</li>
                        <li>Light: ${formatPhase(bestSleep.light_seconds)}</li>
                        <li>REM: ${formatPhase(bestSleep.rem_seconds)}</li>
                        <li>Awake: ${formatPhase(bestSleep.awake_seconds)}</li>
                    </ul>
                </div>`
            });
        }

        // Nutrition (Total Calories)
        if (nutritionEvents.length > 0) {
            let totalCals = 0;
            let totalFat = 0;
            let totalCarbs = 0;
            let totalProtein = 0;
            nutritionEvents.forEach(e => {
                totalCals += e.calories || 0;
                totalFat += e.fat_g || 0;
                totalCarbs += e.carbs_g || 0;
                totalProtein += e.protein_g || 0;
            });
            // Sort meals: Breakfast, Lunch, Snacks, Dinner
            const mealOrder = { 'Breakfast': 0, 'Lunch': 1, 'Snacks': 2, 'Dinner': 3 };
            const sorted = [...nutritionEvents].sort((a, b) =>
                (mealOrder[a.meal_group] ?? 99) - (mealOrder[b.meal_group] ?? 99)
            );

            const formatAmount = (amount) => {
                if (!amount) return '';
                const mulMatch = amount.match(/^([\d.]+)\s*x\s*([\d.]+)\s*(.+)$/);
                if (mulMatch) {
                    const qty = parseFloat(mulMatch[1]) * parseFloat(mulMatch[2]);
                    const unit = mulMatch[3].trim();
                    const rounded = parseFloat(qty.toFixed(1));
                    return rounded === 1 ? unit : `${rounded} ${unit}`;
                }
                const simpleMatch = amount.match(/^([\d.]+)\s+(.+)$/);
                if (simpleMatch) {
                    const qty = parseFloat(simpleMatch[1]);
                    const unit = simpleMatch[2].trim();
                    const rounded = parseFloat(qty.toFixed(1));
                    return rounded === 1 ? unit : `${rounded} ${unit}`;
                }
                return amount;
            };

            stats.push({
                icon: '🥗',
                label: 'Nutrition',
                value: `${Math.round(totalCals)} kcal`,
                linkId: `nutrition-toggle-${date}`,
                expandHtml: `<div class="stat-details-collapsible" id="nutrition-toggle-${date}" hidden>
                    <div class="nutrition-macros">Fat: ${Math.round(totalFat)}g · Carbs: ${Math.round(totalCarbs)}g · Protein: ${Math.round(totalProtein)}g</div>
                    ${sorted.map(meal => `
                        <div class="nutrition-meal">
                            <strong>${meal.meal_group} (${meal.calories} kcal)</strong>
                            <ul class="nutrition-foods">${meal.foods.map(f =>
                                `<li>${f.name} (${formatAmount(f.amount)})</li>`
                            ).join('')}</ul>
                        </div>
                    `).join('')}
                </div>`
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

                <div class="day-body">
                ${locationEvents.length > 0 ? `<div class="day-map-container" id="map-${date}"></div>` : ''}

                <div class="day-content">
                     ${stats.length > 0 ? `
                        <div class="day-stats-list">
                            ${stats.map(s => `
                                <div class="stat-item">
                                    <span class="stat-icon">${s.icon}</span>
                                    ${s.linkId
                                        ? `<a href="#" class="stat-label stat-toggle" data-target="${s.linkId}">${s.label}:</a>`
                                        : `<span class="stat-label">${s.label}:</span>`
                                    }
                                    <span class="stat-value">${s.value}</span>
                                    ${s.sub ? `<span class="stat-sub">(${s.sub})</span>` : ''}
                                </div>
                                ${s.expandHtml || ''}
                            `).join('')}
                        </div>
                     ` : '<div class="day-empty">No activity data recorded</div>'}

                </div>
                </div>
            </div>
        `;

        if (locationEvents.length > 0) {
            // Lazy load map using IntersectionObserver
            const observer = new IntersectionObserver((entries) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        // Using requestAnimationFrame to ensure we are in a paint frame,
                        // but IntersectionObserver mainly fires when visible.
                        // We also cache the style before init.
                        this.initMap(locationEvents, `map-${date}`);
                        observer.unobserve(entry.target);
                        observer.disconnect();
                    }
                });
            }, { rootMargin: '50px' }); // Preload slightly before view

            const mapContainer = this.querySelector(`#map-${date}`);
            if (mapContainer) {
                observer.observe(mapContainer);
            }
        }

        // Stat toggles (sleep, nutrition)
        this.querySelectorAll('.stat-toggle').forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const target = this.querySelector(`#${link.dataset.target}`);
                if (target) target.hidden = !target.hidden;
            });
        });
    }

    initMap(locations, elementId) {
        const element = this.querySelector(`#${elementId}`);
        if (!element) return;

        // Check again if already initialized (just in case)
        if (this.map) return;

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

        const textColor = getComputedStyle(document.body).getPropertyValue('--text-color').trim();
        const polyline = L.polyline(latLngs, { color: textColor, weight: 2 }).addTo(map);

        // Start (Green -> High Contrast geometric)
        L.circleMarker(latLngs[0], { radius: 4, color: getChartColor(ChartColors.Green), fillOpacity: 1, stroke: true, weight: 1, fillColor: getChartColor(ChartColors.PrimaryText) }).addTo(map);
        // End (Red -> High Contrast geometric)
        L.circleMarker(latLngs[latLngs.length - 1], { radius: 4, color: getChartColor(ChartColors.Red), fillOpacity: 1, stroke: true, weight: 1, fillColor: getChartColor(ChartColors.PrimaryText) }).addTo(map);

        map.fitBounds(polyline.getBounds(), { padding: [20, 20] });

        this.map = map;
    }
}

customElements.define('timeline-day', TimelineDay);
