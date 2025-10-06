import { DOMUtils } from '../utils/dom.utils.js';

export class SettingsView {
    constructor(router) {
        this.router = router;
    }

    render() {
        const html = `
            <div class="page-title"><h2>Ajustes</h2></div>
            <p>Vista de ajustes (stub)</p>
        `;
        DOMUtils.render('#main-content', html);
    }
}