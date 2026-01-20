export class DataView extends HTMLElement {
    constructor() {
        super();
        this._startDate = null;
        this._endDate = null;
        this.observer = null;
    }

    static get observedAttributes() {
        return ['start-date', 'end-date'];
    }

    attributeChangedCallback(name, oldValue, newValue) {
        if (oldValue !== newValue) {
            if (name === 'start-date') this._startDate = newValue;
            if (name === 'end-date') this._endDate = newValue;

            this.updateChildren();
            this.onDateRangeChanged();
        }
    }

    get startDate() { return this._startDate; }
    set startDate(val) {
        this._startDate = val;
        this.setAttribute('start-date', val);
        this.updateChildren();
    }

    get endDate() { return this._endDate; }
    set endDate(val) {
        this._endDate = val;
        this.setAttribute('end-date', val);
        this.updateChildren();
    }

    connectedCallback() {
        // Setup MutationObserver to handle dynamic children
        this.observer = new MutationObserver((mutations) => {
            let needsUpdate = false;
            for (const mutation of mutations) {
                if (mutation.addedNodes.length > 0) {
                    needsUpdate = true;
                    // Check if new node is date-picker and attach listener
                    mutation.addedNodes.forEach(node => {
                        if (node.tagName === 'DATE-RANGE-PICKER') {
                            this.setupDatePicker(node);
                        }
                    });
                }
            }
            if (needsUpdate) this.updateChildren();
        });

        this.observer.observe(this, { childList: true, subtree: true });

        // Initial setup
        const picker = this.querySelector('date-range-picker');
        if (picker) {
            this.setupDatePicker(picker);
            // If picker has values, inherit them?
            // Or if we have values, push to picker?
            // "picker should control the data-view" -> Picker is source of truth if present.
            if (picker.startDate) this._startDate = picker.startDate;
            if (picker.endDate) this._endDate = picker.endDate;
        }

        // Listen for bubbling events just in case (though we attach directly too)
        this.addEventListener('date-change', this.handleDateChange.bind(this));
    }

    disconnectedCallback() {
        if (this.observer) this.observer.disconnect();
    }

    setupDatePicker(picker) {
        // We rely on event bubbling mostly, but can explicit attach if needed
        // date-range-picker emits 'date-change' which bubbles.
    }

    handleDateChange(e) {
        const target = e.target;
        if (target.tagName === 'DATE-RANGE-PICKER') {
            // Update our state
            this._startDate = target.startDate;
            this._endDate = target.endDate;

            // Sync attrs without triggering loop if possible, or just set props
            this.setAttribute('start-date', this._startDate);
            this.setAttribute('end-date', this._endDate);

            this.updateChildren();
            this.onDateRangeChanged();

            // Stop propagation? Probably not, maybe parent wants to know.
        }
    }

    updateChildren() {
        if (!this._startDate || !this._endDate) return;

        const charts = this.querySelectorAll('chart-card');
        charts.forEach(chart => {
            // Check if chart needs update
            if (chart.startDate !== this._startDate || chart.endDate !== this._endDate) {
                chart.startDate = this._startDate;
                chart.endDate = this._endDate;

                // If chart has a method to re-render or similar, call it.
                // Currently chart-card doesn't auto-refresh, but we set the props.
                // We might need to dispatch an event to the chart or call a method if the chart supports it.
                // For now, adhering to "inherit" requirement.
            }
        });
    }

    /**
     * Hook for subclasses to respond to date changes.
     */
    onDateRangeChanged() {
        // To be overridden by subclasses
    }
}

customElements.define('data-view', DataView);
