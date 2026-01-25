import { dbService } from '../db.js';
import { DataView } from '../components/data-view/data-view.js';
import '../components/timeline-day.js';


export class TimelineView extends DataView {
    constructor() {
        super();
        this.currentTable = null; // Not used anymore
    }

    connectedCallback() {
        super.connectedCallback();
        this.render();
    }

    async render() {
        this.innerHTML = '';
        const template = document.getElementById('timeline-view-template');
        const content = template.content.cloneNode(true);
        this.appendChild(content);

        // Table selection removed


        // Initialize picker.
        // Default to today
        const today = new Date().toISOString().split('T')[0];
        const picker = this.querySelector('date-range-picker');
        if (picker) {
            picker.startDate = today;
            picker.endDate = today;
            this.startDate = today;
            this.endDate = today;
        }

        // loadData called implicitly? No, need to trigger.
        // If we set props, onDateRangeChanged will fire? 
        // No, we set via prop setter which calls updateChildren, NOT onDateRangeChanged unless we call it.
        // Wait, I updated DataView to call onDateRangeChanged in attributeChangedCallback, but props also call setAttribute.
        // So setting this.startDate -> calls setAttribute -> calls attributeChangedCallback -> calls onDateRangeChanged.
        // So setting dates above WILL trigger loadData via hook.
    }

    onDateRangeChanged() {
        this.loadData();
    }

    // loadTableOptions removed


    loadData() {
        const content = this.querySelector('#timeline-content');
        if (!content) return;

        content.innerHTML = '<div class="loading">Loading timeline...</div>';

        const startDate = this.startDate;
        const endDate = this.endDate;

        if (!startDate || !endDate) return;

        const startTs = new Date(startDate + 'T00:00:00').getTime();
        const endTs = new Date(endDate + 'T23:59:59.999').getTime();

        const events = [];

        // 1. Fetch Location
        try {
            const locData = dbService.query(
                `SELECT * FROM location WHERE timestamp >= ? AND timestamp <= ?`,
                [startTs, endTs]
            );
            locData.forEach(row => {
                events.push({
                    timestamp: row.timestamp,
                    type: 'location',
                    title: 'Location Update',
                    details: `${row.lat.toFixed(4)}, ${row.lng.toFixed(4)}`
                });
            });
        } catch (e) { console.warn('Location fetch failed', e); }

        // 2. Fetch Activities (Steps)
        try {
            const stepData = dbService.query(
                `SELECT * FROM steps WHERE timestamp >= ? AND timestamp <= ?`,
                [startTs, endTs]
            );
            stepData.forEach(row => {
                const type = row.type || 'Activity';
                // Only show if interesting (e.g., > 100 steps or specific type)
                if (row.count > 0) {
                    events.push({
                        timestamp: row.timestamp,
                        type: 'activity',
                        title: type,
                        details: `${row.count} steps` + (row.distance ? `, ${(row.distance / 1000).toFixed(2)}km` : '')
                    });
                }
            });
        } catch (e) { console.warn('Steps fetch failed', e); }

        // 3. Fetch Weight
        try {
            const weightData = dbService.query(
                `SELECT * FROM weight WHERE timestamp >= ? AND timestamp <= ?`,
                [startTs, endTs]
            );
            weightData.forEach(row => {
                events.push({
                    timestamp: row.timestamp,
                    type: 'weight',
                    title: 'Weight Measurement',
                    details: `${row.weight_kg} kg`
                });
            });
        } catch (e) { console.warn('Weight fetch failed', e); }

        // 4. Fetch Sleep
        try {
            const sleepData = dbService.query(
                `SELECT * FROM sleep WHERE timestamp >= ? AND timestamp <= ?`,
                [startTs, endTs]
            );
            sleepData.forEach(row => {
                events.push({
                    timestamp: row.timestamp,
                    type: 'sleep',
                    title: 'Sleep',
                    details: `${row.duration_hours} hrs`
                });
            });
        } catch (e) { console.warn('Sleep fetch failed', e); }

        // Sort all events by time DESC
        events.sort((a, b) => b.timestamp - a.timestamp);

        if (events.length === 0) {
            content.innerHTML = '<div class="no-data">No events found for this period.</div>';
            return;
        }

        // Group by Day
        const groupedByDay = {};
        events.forEach(event => {
            const dateStr = new Date(event.timestamp).toISOString().split('T')[0];
            if (!groupedByDay[dateStr]) {
                groupedByDay[dateStr] = [];
            }
            groupedByDay[dateStr].push(event);
        });

        const sortedDays = Object.keys(groupedByDay).sort().reverse();

        content.innerHTML = '';
        sortedDays.forEach(dateStr => {
            const dayEvents = groupedByDay[dateStr];
            const dayEl = document.createElement('timeline-day');
            dayEl.data = { date: dateStr, events: dayEvents };
            content.appendChild(dayEl);
        });
    }
}

customElements.define('timeline-view', TimelineView);
