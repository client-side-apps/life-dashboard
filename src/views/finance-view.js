import { dbService } from '../db.js';

export class FinanceView extends HTMLElement {
    constructor() {
        super();
        this.accounts = [];
        this.currentAccount = null;
    }

    connectedCallback() {
        this.render();
    }

    async render() {
        this.innerHTML = '';
        const template = document.getElementById('finance-view-template');
        const content = template.content.cloneNode(true);
        this.appendChild(content);

        this.loadSummary();
        this.loadTransactions();
    }

    async loadSummary() {
        const tables = dbService.getTables();

        if (tables.includes('accounts')) {
            const accounts = dbService.query('SELECT * FROM accounts');

            let total = 0;
            let retirement = 0;
            let sell = 0;

            accounts.forEach(acc => {
                const bal = parseFloat(acc.balance || acc.amount || 0);
                const type = (acc.type || '').toLowerCase();
                const name = (acc.name || '').toLowerCase();

                if (type.includes('retirement') || name.includes('pension')) {
                    retirement += bal;
                } else if (type.includes('sell') || name.includes('stock') || name.includes('crypto')) {
                    sell += bal;
                    total += bal;
                } else {
                    total += bal;
                }
            });

            this.updateAmount('total-money', total);
            this.updateAmount('retirement-money', retirement);
            this.updateAmount('sell-money', sell);

            // Populate select
            const select = this.querySelector('#finance-account-select');
            accounts.forEach(acc => {
                const opt = document.createElement('option');
                opt.value = acc.id || acc.account_id || acc.name;
                opt.textContent = acc.name;
                select.appendChild(opt);
            });

            select.addEventListener('change', (e) => {
                this.currentAccount = e.target.value;
                this.loadTransactions();
            });

        } else {
            this.querySelector('#total-money').textContent = 'No data';
            this.querySelector('#retirement-money').textContent = 'No data';
            this.querySelector('#sell-money').textContent = 'No data';
        }
    }

    async loadTransactions() {
        const tbody = this.querySelector('#transaction-body');
        tbody.innerHTML = '<tr><td colspan="3" class="text-center p-1">Loading...</td></tr>';

        const tables = dbService.getTables();
        if (!tables.includes('transactions')) {
            tbody.innerHTML = '<tr><td colspan="3" class="text-center p-1">No transactions table found</td></tr>';
            return;
        }

        let query = 'SELECT * FROM transactions';
        let params = [];

        // Filter by account if selected
        if (this.currentAccount) {
            query += ' WHERE account_id = ?';
            params.push(this.currentAccount);
        }

        query += ' ORDER BY date DESC LIMIT 50';

        const transactions = dbService.query(query, params);

        if (transactions.length === 0) {
            tbody.innerHTML = '<tr><td colspan="3" class="text-center p-1">No transactions found</td></tr>';
            return;
        }

        tbody.innerHTML = transactions.map(t => {
            const date = new Date(t.date || t.timestamp).toLocaleDateString();
            const desc = t.description || t.payee || 'Unknown';
            const amount = parseFloat(t.amount || t.value || 0);
            const amountClass = amount >= 0 ? '' : 'accent-color';

            return `
                <tr>
                    <td>${date}</td>
                    <td>${desc}</td>
                    <td class="align-right ${amountClass}">
                        ${this.formatCurrency(amount)}
                    </td>
                </tr>
            `;
        }).join('');
    }

    updateAmount(id, amount) {
        this.querySelector(`#${id}`).textContent = this.formatCurrency(amount);
    }

    formatCurrency(amount) {
        return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
    }
}

customElements.define('finance-view', FinanceView);
