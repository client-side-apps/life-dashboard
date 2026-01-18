export class ImportView extends HTMLElement {
    constructor() {
        super();
    }

    connectedCallback() {
        this.render();
    }

    async render() {
        this.innerHTML = '';
        const template = document.getElementById('import-view-template');
        const content = template.content.cloneNode(true);
        this.appendChild(content);

        this.querySelector('#do-import-btn').addEventListener('click', () => {
            alert('Import functionality is not yet implemented.');
        });
    }
}

customElements.define('import-view', ImportView);
