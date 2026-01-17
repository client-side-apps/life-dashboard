export class ImportView {
    constructor() {
        this.container = null;
    }

    async render(container) {
        this.container = container;

        const template = document.getElementById('import-view-template');
        const content = template.content.cloneNode(true);
        container.appendChild(content);

        this.container.querySelector('#do-import-btn').addEventListener('click', () => {
            alert('Import functionality is not yet implemented.');
        });
    }

    destroy() { }
}
