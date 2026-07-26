import * as dataRepository from '../services/data-repository.js';
import { DataView } from '../components/data-view/data-view.js';
import '../components/timeline-day.js';
import { getDaysWindow, toDayKey } from '../utils/day-range.js';

// Tables feeding the timeline, with the condition qualifying a row as an event.
const TIMELINE_SOURCES = [
    { table: 'location' },
    { table: 'steps', where: 'count > 0' },
    { table: 'activities', where: "type IS NOT NULL AND type != 'Walking'" },
    { table: 'weight' },
    { table: 'sleep' },
    { table: 'nutrition_servings' },
    { table: 'music' },
    { table: 'dives' }
];

// Days rendered per batch. Further batches load as the user scrolls down.
const DAYS_PER_CHUNK = 10;

// How close to the end of the timeline the user must scroll to trigger the next batch.
const LOAD_MORE_MARGIN_PX = 600;

export class TimelineView extends DataView {
    constructor() {
        super();
        this.days = [];
        this.loadedDays = 0;
        this.isLoadingChunk = false;
        this.sentinel = null;
        this.sentinelObserver = null;
    }

    connectedCallback() {
        super.connectedCallback();
        this.render();
    }

    onDateRangeChanged() {
        this.loadData();
    }

    getScrollContainer() {
        return this.closest('.view-container') || document.getElementById('view-container');
    }

    /**
     * Lists the days holding data for the selected range, then renders the first batch.
     * Remaining days are rendered on demand by loadNextChunk() as the user scrolls.
     */
    async loadData() {
        const content = this.querySelector('#timeline-content');
        if (!content) return;

        await this.showLoading();

        try {
            this.teardownSentinel();
            content.innerHTML = '';
            this.days = [];
            this.loadedDays = 0;

            const startDate = this.startDate;
            const endDate = this.endDate;

            if (!startDate || !endDate) return;

            this.rangeStartTs = new Date(startDate + 'T00:00:00').getTime();
            this.rangeEndTs = new Date(endDate + 'T23:59:59.999').getTime();

            this.days = dataRepository.getDaysWithData(TIMELINE_SOURCES, this.rangeStartTs, this.rangeEndTs);

            if (this.days.length === 0) {
                content.innerHTML = '<div class="no-data">No events found for this period.</div>';
                this.updateStats();
                this.updateScale([]); // Clear scale
                return;
            }

            this.setupSentinel(content);
            this.loadNextChunk();
        } finally {
            this.hideLoading();
        }
    }

    /**
     * Renders the next batch of days, reading only the events those days need.
     */
    loadNextChunk() {
        if (this.isLoadingChunk || this.loadedDays >= this.days.length) return;

        const content = this.querySelector('#timeline-content');
        if (!content) return;

        this.isLoadingChunk = true;
        try {
            const chunkDays = this.days.slice(this.loadedDays, this.loadedDays + DAYS_PER_CHUNK);
            const eventsByDay = this.fetchEvents(chunkDays);

            chunkDays.forEach(dateStr => {
                const dayEvents = eventsByDay[dateStr];
                if (!dayEvents || dayEvents.length === 0) return;

                dayEvents.sort((a, b) => b.timestamp - a.timestamp);

                const dayEl = document.createElement('timeline-day');
                dayEl.dataset.date = dateStr; // Set dataset for query
                dayEl.data = { date: dateStr, events: dayEvents };
                content.insertBefore(dayEl, this.sentinel);
            });

            this.loadedDays += chunkDays.length;
            this.updateStats();

            if (this.loadedDays >= this.days.length) this.teardownSentinel();
        } finally {
            this.isLoadingChunk = false;
        }

        requestAnimationFrame(() => {
            this.updateScale(this.days.slice(0, this.loadedDays));
            // The batch may not fill the viewport: keep loading until it does.
            this.loadMoreIfSentinelVisible();
        });
    }

    /**
     * Reads every event of the given days and groups them by day.
     * @param {string[]} chunkDays days ('YYYY-MM-DD'), most recent first
     * @returns {Object<string, Array>} events indexed by day
     */
    fetchEvents(chunkDays) {
        // The day list is contiguous, so this window holds exactly these days' events.
        const { startTs, endTs } = getDaysWindow(chunkDays, this.rangeStartTs, this.rangeEndTs);

        const read = (table) => dataRepository.getTimestampRangeData(table, startTs, endTs, 'DESC');

        const events = [];

        // 1. Fetch Location
        try {
            read('location').forEach(row => {
                events.push({
                    timestamp: row.timestamp,
                    type: 'location',
                    title: 'Location Update',
                    details: `${row.lat.toFixed(4)}, ${row.lng.toFixed(4)}`,
                    note: row.note
                });
            });
        } catch (e) { console.warn('Location fetch failed', e); }

        // 2. Fetch Activities (Steps)
        try {
            read('steps').forEach(row => {
                const type = row.type || 'Activity';
                if (row.count > 0) {
                    events.push({
                        timestamp: row.timestamp,
                        type: 'activity',
                        title: type,
                        details: `${row.count} steps` + (row.distance ? `, ${(row.distance / 1000).toFixed(2)}km` : ''),
                        note: row.note
                    });
                }
            });
        } catch (e) { console.warn('Steps fetch failed', e); }

        // 2b. Fetch Workouts (any activity that isn't walking)
        try {
            read('activities').forEach(row => {
                if (!row.type || row.type === 'Walking') return;
                events.push({
                    timestamp: row.timestamp,
                    type: 'workout',
                    activity_type: row.type,
                    end_timestamp: row.end_timestamp,
                    calories: row.calories,
                    distance: row.distance,
                    steps: row.steps,
                    elevation: row.elevation,
                    hr_average: row.hr_average,
                    note: row.note
                });
            });
        } catch (e) { console.warn('Activities fetch failed', e); }

        // 3. Fetch Weight
        try {
            read('weight').forEach(row => {
                events.push({
                    timestamp: row.timestamp,
                    type: 'weight',
                    title: 'Weight Measurement',
                    details: `${row.weight_kg} kg`,
                    note: row.note
                });
            });
        } catch (e) { console.warn('Weight fetch failed', e); }

        // 4. Fetch Sleep
        try {
            read('sleep').forEach(row => {
                events.push({
                    timestamp: row.timestamp,
                    type: 'sleep',
                    duration_hours: row.duration_hours,
                    start_timestamp: row.start_timestamp,
                    deep_seconds: row.deep_seconds,
                    light_seconds: row.light_seconds,
                    rem_seconds: row.rem_seconds,
                    awake_seconds: row.awake_seconds,
                    note: row.note
                });
            });
        } catch (e) { console.warn('Sleep fetch failed', e); }

        // 5. Fetch Nutrition Servings
        try {
            const mealsByDayAndGroup = {};
            read('nutrition_servings').forEach(row => {
                const dateStr = toDayKey(row.timestamp);
                const key = `${dateStr}_${row.meal_group}`;
                if (!mealsByDayAndGroup[key]) {
                    mealsByDayAndGroup[key] = {
                        timestamp: row.timestamp,
                        type: 'nutrition',
                        meal_group: row.meal_group,
                        foods: [],
                        calories: 0,
                        fat_g: 0,
                        carbs_g: 0,
                        protein_g: 0
                    };
                }
                const item = mealsByDayAndGroup[key];
                item.foods.push({ name: row.food_name, amount: row.amount, note: row.note });
                item.calories += row.energy_kcal;
                item.fat_g += row.fat_g || 0;
                item.carbs_g += row.carbs_g || 0;
                item.protein_g += row.protein_g || 0;
            });
            Object.values(mealsByDayAndGroup).forEach(meal => {
                events.push({
                    timestamp: meal.timestamp,
                    type: 'nutrition',
                    meal_group: meal.meal_group,
                    foods: meal.foods,
                    calories: Math.round(meal.calories),
                    fat_g: meal.fat_g,
                    carbs_g: meal.carbs_g,
                    protein_g: meal.protein_g
                });
            });
        } catch (e) { console.warn('Nutrition fetch failed', e); }

        // 6. Fetch Music (Spotify)
        try {
            read('music').forEach(row => {
                events.push({
                    timestamp: row.timestamp,
                    type: 'music',
                    track_name: row.track_name,
                    artist_name: row.artist_name,
                    duration_ms: row.duration_ms,
                    platform: row.platform,
                    note: row.note
                });
            });
        } catch (e) { console.warn('Music fetch failed', e); }

        // 7. Fetch Dive Logs
        try {
            read('dives').forEach(row => {
                events.push({
                    timestamp: row.timestamp,
                    type: 'dive',
                    dive_number: row.dive_number,
                    spot: row.spot,
                    city: row.city,
                    region: row.region,
                    country: row.country,
                    max_depth_meters: row.max_depth_meters,
                    duration_minutes: row.duration_minutes,
                    water_temp_c: row.water_temp_c,
                    dive_type: row.dive_type,
                    center: row.center,
                    divers: row.divers,
                    total_divers: row.total_divers,
                    note: row.note
                });
            });
        } catch (e) { console.warn('Dives fetch failed', e); }

        // Group by Day
        const groupedByDay = {};
        events.forEach(event => {
            const dateStr = toDayKey(event.timestamp);
            if (!groupedByDay[dateStr]) {
                groupedByDay[dateStr] = [];
            }
            groupedByDay[dateStr].push(event);
        });

        return groupedByDay;
    }

    /**
     * Appends the element observed to trigger loading of the next batch of days.
     */
    setupSentinel(content) {
        this.sentinel = document.createElement('div');
        this.sentinel.className = 'timeline-sentinel';
        this.sentinel.textContent = 'Loading more…';
        content.appendChild(this.sentinel);

        this.sentinelObserver = new IntersectionObserver(entries => {
            if (entries.some(entry => entry.isIntersecting)) this.loadNextChunk();
        }, { root: this.getScrollContainer(), rootMargin: `${LOAD_MORE_MARGIN_PX}px 0px` });

        this.sentinelObserver.observe(this.sentinel);
    }

    teardownSentinel() {
        if (this.sentinelObserver) {
            this.sentinelObserver.disconnect();
            this.sentinelObserver = null;
        }
        if (this.sentinel) {
            this.sentinel.remove();
            this.sentinel = null;
        }
    }

    /**
     * The observer only reports changes, so a batch that leaves the sentinel on
     * screen (short content, tall window) needs an explicit follow-up check.
     */
    loadMoreIfSentinelVisible() {
        if (!this.sentinel) return;

        const container = this.getScrollContainer();
        if (!container) return;

        const sentinelRect = this.sentinel.getBoundingClientRect();
        const containerRect = container.getBoundingClientRect();

        if (sentinelRect.top <= containerRect.bottom + LOAD_MORE_MARGIN_PX) {
            this.loadNextChunk();
        }
    }

    updateStats() {
        const stats = this.querySelector('#timeline-stats');
        if (!stats) return;

        if (this.days.length === 0) {
            stats.textContent = '';
        } else if (this.loadedDays >= this.days.length) {
            stats.textContent = `${this.days.length} day${this.days.length > 1 ? 's' : ''} with data`;
        } else {
            stats.textContent = `${this.loadedDays} of ${this.days.length} days`;
        }
    }

    updateScale(sortedDays) {
        const scaleEl = this.querySelector('#timeline-scale');
        const container = this.getScrollContainer();
        const content = this.querySelector('#timeline-content');

        if (!scaleEl || !container || !content || !sortedDays || sortedDays.length === 0) return;

        scaleEl.innerHTML = '';

        // Determine granularity
        const monthsSeen = new Set();
        const markers = [];

        const days = Array.from(content.children).filter(el => el.tagName === 'TIMELINE-DAY');
        if (days.length === 0) return;

        const totalHeight = container.scrollHeight;
        const viewHeight = container.clientHeight;
        const containerRect = container.getBoundingClientRect();

        if (totalHeight <= viewHeight) return; // No scrolling needed

        days.forEach(day => {
            const dateStr = day.dataset.date;
            if (!dateStr) return;
            const d = new Date(dateStr);
            const monthKey = `${d.getFullYear()}-${d.getMonth()}`; // Unique month
            const label = d.toLocaleDateString(undefined, { month: 'short', year: '2-digit' }); // "Jan 24"

            if (!monthsSeen.has(monthKey)) {
                monthsSeen.add(monthKey);

                // Calculate position relative to container content top
                const dayRect = day.getBoundingClientRect();
                const top = dayRect.top - containerRect.top + container.scrollTop;

                // Map content position (0 to totalHeight) to Viewport Height (0 to viewHeight)
                // Percent = top / totalHeight
                const pct = (top / totalHeight) * 100;

                const marker = document.createElement('div');
                marker.className = 'scale-marker';
                marker.textContent = label;
                marker.style.top = `${pct}%`;
                marker.title = `Jump to ${label}`;

                marker.addEventListener('click', (e) => {
                    e.stopPropagation();
                    container.scrollTo({ top: top, behavior: 'smooth' });
                });

                markers.push(marker);
            }
        });

        // Filter overlapping markers?
        // Simple collision detection
        const sortedMarkers = markers.sort((a, b) => parseFloat(a.style.top) - parseFloat(b.style.top));

        let lastTop = -100;
        sortedMarkers.forEach(m => {
            const top = parseFloat(m.style.top); // is %
            // Assume each marker is approx 5% height? or 20px.
            // 20px in % depends on viewHeight.
            const pxHeight = 25;
            const pxPct = (pxHeight / viewHeight) * 100;

            if (top - lastTop > pxPct) {
                scaleEl.appendChild(m);
                lastTop = top;
            }
        });
    }

    setupScrollListeners() {
        const container = this.getScrollContainer();
        if (!container) return;

        if (this._scrollHandler) {
            container.removeEventListener('scroll', this._scrollHandler);
            window.removeEventListener('pointermove', this._mouseMoveHandler, true);
        }

        this._scrollHandler = this.handleScroll.bind(this);
        this._mouseMoveHandler = this.handleMouseMove.bind(this);

        container.addEventListener('scroll', this._scrollHandler, { passive: true });
        // Use capture: true to attempt to catch events before they are swallowed
        window.addEventListener('pointermove', this._mouseMoveHandler, { passive: true, capture: true });
    }

    disconnectedCallback() {
        const container = this.getScrollContainer();
        if (container && this._scrollHandler) {
            container.removeEventListener('scroll', this._scrollHandler);
        }
        if (this._mouseMoveHandler) {
            window.removeEventListener('pointermove', this._mouseMoveHandler, true);
        }
        this.teardownSentinel();
        super.disconnectedCallback();
    }

    handleMouseMove(e) {
        this.lastMouseY = e.clientY;
        this.lastMouseMoveTime = Date.now();

        // Always update if we are visible/scrolling, or if we want hover effect.
        // For now, only update if scrolling was recently active or just keep it responsive.
        if (this.isScrolling) {
            this.updateIndicator();
        }
    }

    handleScroll() {
        if (!this.isConnected) return;

        this.isScrolling = true;
        this.updateIndicator();

        clearTimeout(this._scrollTimeout);
        this._scrollTimeout = setTimeout(() => {
            this.isScrolling = false;
            this.hideIndicator();
        }, 500);
    }

    hideIndicator() {
        const indicator = this.querySelector('#timeline-date-indicator');
        if (indicator) indicator.style.display = 'none';
    }

    updateIndicator() {
        const container = this.getScrollContainer();
        if (!container) return;

        const indicator = this.querySelector('#timeline-date-indicator');
        if (!indicator) return;

        let targetY = this.lastMouseY;
        const now = Date.now();
        const mouseAge = now - (this.lastMouseMoveTime || 0);

        // Fallback: If mouse hasn't moved recently but we are scrolling, 
        // it's likely a scrollbar drag where events are swallowed.
        // Estimate position based on scroll thumb.
        if (mouseAge > 100 && this.isScrolling) {
            const trackHeight = container.clientHeight;
            const contentHeight = container.scrollHeight;
            const scrollTop = container.scrollTop;

            if (contentHeight > trackHeight) {
                // Estimate thumb position
                // Thumb height is variable, usually: trackHeight * (trackHeight / contentHeight)
                const minThumb = 30; // Min px
                let thumbHeight = Math.max(minThumb, trackHeight * (trackHeight / contentHeight));

                const scrollableDist = contentHeight - trackHeight;
                const trackScrollableDist = trackHeight - thumbHeight;

                const ratio = scrollTop / scrollableDist;
                const thumbTop = ratio * trackScrollableDist;
                const thumbCenter = thumbTop + thumbHeight / 2;

                const containerRect = container.getBoundingClientRect();
                const estimatedY = containerRect.top + thumbCenter;

                // Only use estimate if reasonable (e.g. mouse was near scrollbar last time)
                // Or just assume if we are scrolling without mouse events, we are dragging scrollbar.
                targetY = estimatedY;
            }
        }

        if (!targetY) return;

        // Check bounds
        const rect = container.getBoundingClientRect();
        if (targetY < rect.top || targetY > rect.bottom) {
            indicator.style.display = 'none';
            return;
        }

        // Find date at targetY
        const dateStr = this.findDateAtPosition(targetY);

        if (dateStr) {
            indicator.textContent = dateStr;
            indicator.style.display = 'block';
            indicator.style.top = `${targetY}px`;
        } else {
            indicator.style.display = 'none';
        }
    }

    findDateAtPosition(clientY) {
        const content = this.querySelector('#timeline-content');
        if (!content) return null;

        const days = Array.from(content.children).filter(el => el.tagName === 'TIMELINE-DAY');
        if (days.length === 0) return null;

        // 1. Check strict overlap
        for (const day of days) {
            const rect = day.getBoundingClientRect();
            if (clientY >= rect.top && clientY <= rect.bottom) {
                return day.dataset.date;
            }
        }

        // 2. Check closest if not overlapping (e.g. gap)
        // If above first element
        const firstRect = days[0].getBoundingClientRect();
        if (clientY < firstRect.top) return days[0].dataset.date;

        // If below last element
        const lastRect = days[days.length - 1].getBoundingClientRect();
        if (clientY > lastRect.bottom) return days[days.length - 1].dataset.date;

        // If in between elements, find the one "above" the cursor (since we read top-down)
        // Iterate backwards to find first element whose bottom is above clientY?
        // Or just iterate forwards and keep track of last seen.

        // Simpler: Find the element with smallest distance to clientY
        let closestDate = null;
        let minDist = Infinity;

        for (const day of days) {
            const rect = day.getBoundingClientRect();
            // dist to center?
            const dist = Math.abs(clientY - (rect.top + rect.height / 2));
            if (dist < minDist) {
                minDist = dist;
                closestDate = day.dataset.date;
            }
        }

        return closestDate;
    }

    async render() {
        this.innerHTML = '';
        const template = document.getElementById('timeline-view-template');
        const content = template.content.cloneNode(true);
        this.appendChild(content);

        this.setupScrollListeners(); // Setup listeners after render

        await this.loadData();
    }

}

customElements.define('timeline-view', TimelineView);
