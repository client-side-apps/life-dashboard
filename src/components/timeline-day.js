import L from 'leaflet';
import { getChartColor, ChartColors } from '../utils/style.js';

export class TimelineDay extends HTMLElement {
    constructor() {
        super();
        this._data = null;
        this.map = null;
        this.observer = null;
    }

    connectedCallback() {
        // No-op for now, render is called by setter
    }

    disconnectedCallback() {
        if (this.map) {
            this.map.remove();
            this.map = null;
        }
        if (this.observer) {
            this.observer.disconnect();
            this.observer = null;
        }
    }

    set data({ date, events }) {
        this._data = { date, events };
        this.render();
    }

    updateTheme(theme) {
        // Re-render to update map styles
        this.render();
    }

    render() {
        if (!this._data) return;

        // Cleanup previous map/observer
        if (this.map) {
            this.map.remove();
            this.map = null;
        }
        if (this.observer) {
            this.observer.disconnect();
            this.observer = null;
        }

        const { date, events } = this._data;

        // Categorize events
        const locationEvents = events.filter(e => e.type === 'location');
        const activityEvents = events.filter(e => e.type === 'activity');
        const workoutEvents = events.filter(e => e.type === 'workout');
        const weightEvents = events.filter(e => e.type === 'weight');
        const sleepEvents = events.filter(e => e.type === 'sleep');
        const nutritionEvents = events.filter(e => e.type === 'nutrition');
        const musicEvents = events.filter(e => e.type === 'music');
        const diveEvents = events.filter(e => e.type === 'dive');
        const postEvents = events.filter(e => e.type === 'post');
        const calendarEvents = events.filter(e => e.type === 'calendar');

        // Calculate Stats
        let stats = [];

        // Steps
        let totalSteps = 0;
        let totalDist = 0;
        const stepNotes = [];
        activityEvents.forEach(e => {
            const steps = parseInt(e.details.match(/(\d+) steps/)?.[1] || 0);
            totalSteps += steps;

            // Extract distance if present "2000 steps, 1.50km"
            const distMatch = e.details.match(/([\d\.]+)km/);
            if (distMatch) {
                totalDist += parseFloat(distMatch[1]);
            }
            if (e.note) {
                stepNotes.push(e.note);
            }
        });

        if (totalSteps > 0) {
            stats.push({
                icon: 'steps',
                label: 'Steps',
                value: totalSteps.toLocaleString(),
                sub: totalDist > 0 ? `${totalDist.toFixed(1)} km` : null,
                note: stepNotes.length > 0 ? stepNotes.join('; ') : null
            });
        }

        // Workouts (any activity that isn't walking)
        const workoutIcons = {
            'Running': 'running',
            'Cycling': 'cycling',
            'Swimming': 'swimming',
            'Hiking': 'hiking',
            'Ski': 'ski',
            'Multi Sport': 'multisport'
        };

        [...workoutEvents].sort((a, b) => a.timestamp - b.timestamp).forEach(e => {
            const durationMinutes = e.end_timestamp
                ? Math.round((e.end_timestamp - e.timestamp) / 60000)
                : null;
            const durationStr = durationMinutes
                ? (durationMinutes >= 60
                    ? `${Math.floor(durationMinutes / 60)}h ${durationMinutes % 60}m`
                    : `${durationMinutes}m`)
                : null;

            const subParts = [];
            if (e.distance) subParts.push(`${(e.distance / 1000).toFixed(2)} km`);
            if (e.calories) subParts.push(`${Math.round(e.calories)} kcal`);
            if (e.hr_average) subParts.push(`${e.hr_average} bpm avg`);

            stats.push({
                icon: workoutIcons[e.activity_type] || 'workout',
                label: e.activity_type,
                value: durationStr || new Date(e.timestamp).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' }),
                sub: subParts.length > 0 ? subParts.join(' · ') : null,
                note: e.note || null
            });
        });

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

            const formatTime = (ts) => {
                if (!ts) return '';
                const d = new Date(ts);
                return d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
            };

            const sleepRange = bestSleep.start_timestamp && bestSleep.timestamp
                ? `from ${formatTime(bestSleep.start_timestamp)} to ${formatTime(bestSleep.timestamp)}`
                : null;

            stats.push({
                icon: 'sleep',
                label: 'Sleep',
                value: `${sleepDuration.toFixed(1)}h`,
                sub: sleepRange,
                note: bestSleep.note || null,
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
                icon: 'nutrition',
                label: 'Nutrition',
                value: `${Math.round(totalCals)} kcal`,
                linkId: `nutrition-toggle-${date}`,
                expandHtml: `<div class="stat-details-collapsible" id="nutrition-toggle-${date}" hidden>
                    <div class="nutrition-macros">Fat: ${Math.round(totalFat)}g · Carbs: ${Math.round(totalCarbs)}g · Protein: ${Math.round(totalProtein)}g</div>
                    ${sorted.map(meal => `
                        <div class="nutrition-meal">
                            <strong>${meal.meal_group} (${meal.calories} kcal)</strong>
                            <ul class="nutrition-foods">${meal.foods.map(f =>
                                `<li>${f.name} (${formatAmount(f.amount)})${f.note ? ` — <span class="timeline-inline-note">${f.note}</span>` : ''}</li>`
                            ).join('')}</ul>
                        </div>
                    `).join('')}
                </div>`
            });
        }

        // Weight (Take the last measurement of the day)
        if (weightEvents.length > 0) {
            const lastWeight = weightEvents[0].details;
            stats.push({
                icon: 'weight',
                label: 'Weight',
                value: lastWeight,
                note: weightEvents[0].note || null
            });
        }

        // Music (Spotify tracks play log)
        if (musicEvents.length > 0) {
            const totalDurationMs = musicEvents.reduce((acc, e) => acc + (e.duration_ms || 0), 0);
            const hours = Math.floor(totalDurationMs / 3600000);
            const minutes = Math.floor((totalDurationMs % 3600000) / 60000);
            const timeStr = hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;

            stats.push({
                icon: 'music',
                label: 'Music',
                value: `${musicEvents.length} tracks`,
                sub: timeStr,
                linkId: `music-toggle-${date}`,
                expandHtml: `<div class="stat-details-collapsible" id="music-toggle-${date}" hidden>
                    <ul class="music-tracks">
                        ${musicEvents.map(t => {
                            const time = new Date(t.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                            return `<li><span class="track-time">${time}</span> <strong>${t.track_name}</strong> <span class="track-artist">by ${t.artist_name}</span>${t.note ? ` — <span class="timeline-inline-note">${t.note}</span>` : ''}</li>`;
                        }).join('')}
                    </ul>
                </div>`
            });
        }

        // Scuba Diving Logs
        if (diveEvents.length > 0) {
            const totalDuration = diveEvents.reduce((acc, e) => acc + (e.duration_minutes || 0), 0);
            const maxDepth = Math.max(...diveEvents.map(e => e.max_depth_meters || 0));

            stats.push({
                icon: 'dive',
                label: 'Diving',
                value: `${diveEvents.length} dive${diveEvents.length > 1 ? 's' : ''}`,
                sub: `${maxDepth.toFixed(1)}m max depth · ${totalDuration} min`,
                linkId: `dives-toggle-${date}`,
                expandHtml: `<div class="stat-details-collapsible" id="dives-toggle-${date}" hidden>
                    <ul class="dive-logs" style="margin: 0; padding-left: 1.25rem; list-style: disc; opacity: 0.8;">
                        ${diveEvents.map(d => {
                            const loc = [d.spot, d.city, d.country].filter(Boolean).join(', ');
                            return `<li><strong>${loc || 'Unknown site'}</strong> (Depth: ${d.max_depth_meters}m, Dur: ${d.duration_minutes} min, Temp: ${d.water_temp_c || '--'}°C)${d.note ? ` — <span class="timeline-inline-note">${d.note}</span>` : ''}</li>`;
                        }).join('')}
                    </ul>
                </div>`
            });
        }

        // Calendar Events
        [...calendarEvents].sort((a, b) => a.timestamp - b.timestamp).forEach(e => {
            const formatTime = (ts) => new Date(ts).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
            const timeStr = e.all_day
                ? 'All day'
                : (e.end_timestamp ? `${formatTime(e.timestamp)} – ${formatTime(e.end_timestamp)}` : formatTime(e.timestamp));

            stats.push({
                icon: 'calendar',
                label: e.title,
                value: timeStr,
                sub: e.location || null,
                note: e.note || null
            });
        });

        // Social Posts (Twitter): one line per post
        [...postEvents].sort((a, b) => a.timestamp - b.timestamp).forEach(p => {
            const time = new Date(p.timestamp).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
            const counts = [];
            if (p.likes) counts.push(`${p.likes} ♥`);
            if (p.reposts) counts.push(`${p.reposts} ↻`);

            stats.push({
                icon: 'post',
                label: time,
                value: p.text,
                sub: counts.length > 0 ? counts.join(' · ') : null,
                note: p.note || null
            });
        });

        // Consolidated Daily Notes
        const dailyNotesList = [];
        if (weightEvents.length > 0 && weightEvents[0].note) {
            dailyNotesList.push({ type: 'Weight', note: weightEvents[0].note });
        }
        sleepEvents.forEach(e => { if (e.note) dailyNotesList.push({ type: 'Sleep', note: e.note }); });
        activityEvents.forEach(e => { if (e.note) dailyNotesList.push({ type: 'Activity', note: e.note }); });
        workoutEvents.forEach(e => { if (e.note) dailyNotesList.push({ type: e.activity_type || 'Workout', note: e.note }); });
        nutritionEvents.forEach(e => {
            e.foods.forEach(f => {
                if (f.note) dailyNotesList.push({ type: `Food (${e.meal_group})`, note: `${f.name}: ${f.note}` });
            });
        });
        musicEvents.forEach(e => { if (e.note) dailyNotesList.push({ type: 'Music', note: `${e.track_name} by ${e.artist_name}: ${e.note}` }); });
        locationEvents.forEach(e => { if (e.note) dailyNotesList.push({ type: 'Location', note: e.note }); });
        calendarEvents.forEach(e => { if (e.note) dailyNotesList.push({ type: 'Calendar', note: `${e.title}: ${e.note}` }); });
        postEvents.forEach(e => { if (e.note) dailyNotesList.push({ type: 'Post', note: e.note }); });
        diveEvents.forEach(e => {
            if (e.note) {
                const loc = [e.spot, e.city, e.country].filter(Boolean).join(', ');
                dailyNotesList.push({ type: 'Dive', note: `${loc ? loc + ': ' : ''}${e.note}` });
            }
        });

        const dailyNotesHtml = dailyNotesList.length > 0 ? `
            <div class="day-notes-section">
                <div class="day-notes-header">Daily Notes</div>
                <ul class="day-notes-list">
                    ${dailyNotesList.map(n => `
                        <li><span class="day-note-type">${n.type}:</span> <span class="day-note-content">${n.note}</span></li>
                    `).join('')}
                </ul>
            </div>
        ` : '';

        this.innerHTML = `
            <div class="day-card">
                <div class="day-header">
                    <span class="day-date">${(() => { const d = new Date(date); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} (${d.toLocaleDateString(undefined, { weekday: 'long' })})`; })()}</span>
                </div>

                <div class="day-body">
                ${locationEvents.length > 0 ? `<div class="day-map-container" id="map-${date}"></div>` : ''}

                <div class="day-content">
                     ${stats.length > 0 ? `
                        <div class="day-stats-list">
                            ${stats.map(s => `
                                <div class="stat-item">
                                    <span class="stat-icon icon icon-${s.icon}"></span>
                                    ${s.linkId
                                        ? `<a href="#" class="stat-label stat-toggle" data-target="${s.linkId}">${s.label}:</a>`
                                        : `<span class="stat-label">${s.label}:</span>`
                                    }
                                    <span class="stat-value">${s.value}</span>
                                    ${s.sub ? `<span class="stat-sub">(${s.sub})</span>` : ''}
                                    ${s.note ? ` — <span class="timeline-inline-note">${s.note}</span>` : ''}
                                </div>
                                ${s.expandHtml || ''}
                            `).join('')}
                        </div>
                     ` : '<div class="day-empty">No activity data recorded</div>'}
                     ${dailyNotesHtml}
                </div>
                </div>
            </div>
        `;

        if (locationEvents.length > 0) {
            // Lazy load map using IntersectionObserver
            this.observer = new IntersectionObserver((entries, observer) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        // Using requestAnimationFrame to ensure we are in a paint frame,
                        // but IntersectionObserver mainly fires when visible.
                        // We also cache the style before init.
                        this.initMap(locationEvents, `map-${date}`);
                        observer.unobserve(entry.target);
                        observer.disconnect();
                        this.observer = null;
                    }
                });
            }, { rootMargin: '50px' }); // Preload slightly before view

            const mapContainer = this.querySelector(`#map-${date}`);
            if (mapContainer) {
                this.observer.observe(mapContainer);
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

        // Add custom markers with popups for locations with notes
        const noteColor = getComputedStyle(document.body).getPropertyValue('--note-color').trim() || '#D97706';
        const noteBg = getComputedStyle(document.body).getPropertyValue('--note-bg').trim() || '#FEF3C7';

        locations.forEach(l => {
            if (l.note) {
                const parts = l.details.split(',').map(s => parseFloat(s.trim()));
                if (!isNaN(parts[0]) && !isNaN(parts[1])) {
                    const marker = L.circleMarker(parts, {
                        radius: 6,
                        color: noteColor,
                        fillColor: noteBg,
                        fillOpacity: 1,
                        weight: 2
                    }).addTo(map);
                    marker.bindPopup(`<strong>Note:</strong><br>${l.note}`);
                }
            }
        });

        map.fitBounds(polyline.getBounds(), { padding: [20, 20] });

        this.map = map;
    }
}

customElements.define('timeline-day', TimelineDay);
