import * as dataRepository from '../services/data-repository.js';
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




        // loadData called implicitly? No, need to trigger.
        // If we set props, onDateRangeChanged will fire? 
        // No, we set via prop setter which calls updateChildren, NOT onDateRangeChanged unless we call it.
        // Wait, I updated DataView to call onDateRangeChanged in attributeChangedCallback, but props also call setAttribute.
        // So setting this.startDate -> calls setAttribute -> calls attributeChangedCallback -> calls onDateRangeChanged.
        // So setting dates above WILL trigger loadData via hook.
        // But since connectedCallback runs render, and we are setting attributes before append,
        // attributeChangedCallback runs BEFORE render is done (and before create querySelector finds anything).
        // So we must call loadData explicitly at the end of render.
        await this.loadData();
    }

    onDateRangeChanged() {
        this.loadData();
    }

    // loadTableOptions removed


    async loadData() {
        const content = this.querySelector('#timeline-content');
        if (!content) return;

        await this.showLoading();

        try {
            content.innerHTML = '';

            const startDate = this.startDate;
            const endDate = this.endDate;

            if (!startDate || !endDate) return;

            const startTs = new Date(startDate + 'T00:00:00').getTime();
            const endTs = new Date(endDate + 'T23:59:59.999').getTime();

            const events = [];

            // 1. Fetch Location
            try {
                const locData = dataRepository.getDateRangeData('location', startDate, endDate);
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
                const stepData = dataRepository.getDateRangeData('steps', startDate, endDate);
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
                const weightData = dataRepository.getDateRangeData('weight', startDate, endDate);
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
                const sleepData = dataRepository.getDateRangeData('sleep', startDate, endDate);
                sleepData.forEach(row => {
                    events.push({
                        timestamp: row.timestamp,
                        type: 'sleep',
                        title: 'Sleep',
                        duration_hours: row.duration_hours
                    });
                });
            } catch (e) { console.warn('Sleep fetch failed', e); }

            // 5. Fetch Nutrition Servings (Meals)
            try {
                const nutritionData = dataRepository.getDateRangeData('nutrition_servings', startDate, endDate);

                // Group by day and meal group
                const mealsByDayAndGroup = {};
                // key: "YYYY-MM-DD_MealGroup", value: { timestamp, meal_group, foods: [] }

                nutritionData.forEach(row => {
                    const dateStr = new Date(row.timestamp).toISOString().split('T')[0];
                    const key = `${dateStr}_${row.meal_group}`;

                    if (!mealsByDayAndGroup[key]) {
                        mealsByDayAndGroup[key] = {
                            timestamp: row.timestamp, // Use timestamp of first item
                            type: 'nutrition',
                            title: `${row.meal_group}`, // Breakfast, Lunch, etc.
                            details: [], // Will store food names + calories
                            calories: 0
                        };
                    }

                    const item = mealsByDayAndGroup[key];
                    // Format: "Food Name (Amount)"
                    const foodDetail = `${row.food_name} (${row.amount})`;
                    item.details.push(foodDetail);
                    item.calories += row.energy_kcal;
                });

                // Convert to events
                Object.values(mealsByDayAndGroup).forEach(meal => {
                    events.push({
                        timestamp: meal.timestamp,
                        type: 'nutrition',
                        title: `${meal.title} (${Math.round(meal.calories)} kcal)`,
                        details: meal.details.join('\n') // TimelineDay should handle newlines or we format as list
                    });
                });

            } catch (e) { console.warn('Nutrition fetch failed', e); }

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
        } finally {
            this.hideLoading();
        }
    }
}

customElements.define('timeline-view', TimelineView);
