import * as dataRepository from '../services/data-repository.js';
import { DataView } from '../components/data-view/data-view.js';
import { getChartColor, ChartColors } from '../utils/style.js';
import { computeDailyFootprint, EMISSION_FACTORS, FLIGHT_DISTANCE_THRESHOLD_KM } from '../utils/carbon.js';

export class CarbonView extends DataView {
    connectedCallback() {
        super.connectedCallback();
        this.render();
    }

    onDateRangeChanged() {
        this.render();
    }

    async render() {
        const startDate = this.startDate;
        const endDate = this.endDate;

        this.innerHTML = `
            <div class="carbon-container">
                <div class="finance-dashboard">
                    <div class="card">
                        <h3>Total</h3>
                        <p class="amount primary" id="carbon-total">--</p>
                    </div>
                    <div class="card">
                        <h3>Electricity</h3>
                        <p class="amount secondary" id="carbon-electricity">--</p>
                    </div>
                    <div class="card">
                        <h3>Gas</h3>
                        <p class="amount secondary" id="carbon-gas">--</p>
                    </div>
                    <div class="card">
                        <h3>Travel</h3>
                        <p class="amount accent" id="carbon-travel">--</p>
                    </div>
                </div>

                <div class="charts-grid">
                    <chart-card title="Daily Carbon Footprint (kg CO2e)" chart-id="carbon-daily-chart"></chart-card>
                </div>

                <p class="carbon-disclaimer">
                    Estimates only. Electricity: grid imports × ${EMISSION_FACTORS.electricity_kg_per_kwh} kg/kWh ·
                    Gas: ${EMISSION_FACTORS.gas_kg_per_therm} kg/therm ·
                    Travel: distance between location points × ${EMISSION_FACTORS.car_kg_per_km} kg/km
                    (${EMISSION_FACTORS.flight_kg_per_km} kg/km on days over ${FLIGHT_DISTANCE_THRESHOLD_KM} km, assumed flights).
                </p>
            </div>
        `;

        this.loadData(startDate, endDate);
    }

    loadData(startDate, endDate) {
        const electricityRows = dataRepository.getTimeSeriesData('electricity_grid_daily', startDate, endDate, 'ASC');
        const gasRows = dataRepository.getTimeSeriesData('gas_daily', startDate, endDate, 'ASC');
        const locationRows = dataRepository.getTimeSeriesData('location', startDate, endDate, 'ASC');

        const daily = computeDailyFootprint({ electricityRows, gasRows, locationRows });

        // Totals
        const sum = (key) => daily.reduce((acc, d) => acc + (d[key] || 0), 0);
        const electricityTotal = sum('electricity_kg');
        const gasTotal = sum('gas_kg');
        const travelTotal = sum('travel_kg');
        const total = electricityTotal + gasTotal + travelTotal;

        const fmt = (kg) => kg >= 1000 ? `${(kg / 1000).toFixed(2)} t` : `${Math.round(kg)} kg`;
        const setText = (id, value) => {
            const el = this.querySelector(`#${id}`);
            if (el) el.textContent = value;
        };

        setText('carbon-total', fmt(total));
        setText('carbon-electricity', fmt(electricityTotal));
        setText('carbon-gas', fmt(gasTotal));
        setText('carbon-travel', fmt(travelTotal));

        // Stacked daily chart
        const chartCard = this.querySelector('chart-card[chart-id="carbon-daily-chart"]');
        if (!chartCard) return;

        chartCard.setDateRange(startDate, endDate);
        chartCard.setTimeSeriesData(daily, {
            series: [
                { label: 'Electricity (kg)', key: 'electricity_kg', color: getChartColor(ChartColors.Yellow) },
                { label: 'Gas (kg)', key: 'gas_kg', color: getChartColor(ChartColors.Red) },
                { label: 'Travel (kg)', key: 'travel_kg', color: getChartColor(ChartColors.Blue) }
            ],
            startDate: startDate,
            endDate: endDate,
            interval: 'daily',
            stacked: true,
            fill: true
        });
    }
}

customElements.define('carbon-view', CarbonView);
