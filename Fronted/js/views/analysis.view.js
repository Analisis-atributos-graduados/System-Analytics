// js/views/analysis.view.js
import { DOMUtils } from '../utils/dom.utils.js';

export class AnalysisView {
    constructor(router) {
        this.router = router;
    }

    render() {
        const html = `
            <div class="page-title"><h2>Análisis</h2></div>
            <p>Vista de análisis (stub)</p>
        `;
        DOMUtils.render('#main-content', html);
    }
}
