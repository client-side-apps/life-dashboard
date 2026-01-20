export class DateRangePicker extends HTMLElement {
    constructor() {
        super();
        this._startDate = null;
        this._endDate = null;
    }

    connectedCallback() {
        this.render();
        this.setupEventListeners();
    }

    static get observedAttributes() {
        return ['start-date', 'end-date', 'min-date', 'max-date'];
    }

    attributeChangedCallback(name, oldValue, newValue) {
        if (oldValue === newValue) return;

        if (name === 'start-date') {
            this._startDate = newValue;
            const input = this.querySelector('.start-date');
            if (input) input.value = newValue;
        } else if (name === 'end-date') {
            this._endDate = newValue;
            const input = this.querySelector('.end-date');
            if (input) input.value = newValue;
        } else if (name === 'min-date') {
            const inputs = this.querySelectorAll('input');
            inputs.forEach(input => input.min = newValue);
        } else if (name === 'max-date') {
            const inputs = this.querySelectorAll('input');
            inputs.forEach(input => input.max = newValue);
        }
    }

    get startDate() {
        return this._startDate;
    }

    set startDate(value) {
        this.setAttribute('start-date', value);
    }

    get endDate() {
        return this._endDate;
    }

    set endDate(value) {
        this.setAttribute('end-date', value);
    }

    render() {
        // Don't overwrite if we already have inputs (to preserve focus/state if re-connected)
        if (this.querySelector('.date-controls-wrapper')) return;

        this.innerHTML = `
            <div class="date-controls-wrapper">
                <label class="date-input-label">
                    Start: 
                    <input type="date" class="start-date date-input">
                </label>
                <label class="date-input-label">
                    End: 
                    <input type="date" class="end-date date-input">
                </label>
            </div>
        `;

        if (this.hasAttribute('start-date')) {
            const input = this.querySelector('.start-date');
            if (input) input.value = this.getAttribute('start-date');
        }
        if (this.hasAttribute('end-date')) {
            const input = this.querySelector('.end-date');
            if (input) input.value = this.getAttribute('end-date');
        }
        if (this.hasAttribute('min-date')) {
            const min = this.getAttribute('min-date');
            this.querySelectorAll('input').forEach(i => i.min = min);
        }
        if (this.hasAttribute('max-date')) {
            const max = this.getAttribute('max-date');
            this.querySelectorAll('input').forEach(i => i.max = max);
        }
    }

    setupEventListeners() {
        const startInput = this.querySelector('.start-date');
        const endInput = this.querySelector('.end-date');

        if (!startInput || !endInput) return;

        const handleChange = () => {
            this._startDate = startInput.value;
            this._endDate = endInput.value;

            // Reflect to attributes
            if (this._startDate) this.setAttribute('start-date', this._startDate);
            if (this._endDate) this.setAttribute('end-date', this._endDate);

            this.dispatchEvent(new CustomEvent('date-change', {
                detail: {
                    startDate: this._startDate,
                    endDate: this._endDate
                },
                bubbles: true,
                composed: true
            }));
        };

        startInput.addEventListener('change', handleChange);
        endInput.addEventListener('change', handleChange);
    }
}

customElements.define('date-range-picker', DateRangePicker);
