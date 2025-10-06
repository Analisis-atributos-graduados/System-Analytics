import { DOMUtils } from '../utils/dom.utils.js';

export class Router {
    constructor() {
        this.routes = {};
        this.currentRoute = null;
    }

    register(path, view) {
        this.routes[path] = view;
    }

    navigate(path) {
        if (this.routes[path]) {
            this.currentRoute = path;
            const view = this.routes[path];
            
            // Render the view
            DOMUtils.render('#main-content', '');
            view.render();
            
            // Update navigation active state
            this.updateNavigation();
            
            // Update URL without reload
            window.history.pushState({}, '', `#${path}`);
        }
    }

    updateNavigation() {
        document.querySelectorAll('.nav-tab').forEach(tab => {
            tab.classList.remove('active');
            if (tab.dataset.route === this.currentRoute) {
                tab.classList.add('active');
            }
        });
    }

    init() {
        // Handle browser back/forward
        window.addEventListener('popstate', () => {
            const path = window.location.hash.slice(1) || 'configuration';
            this.navigate(path);
        });

        // Load initial route
        const initialPath = window.location.hash.slice(1) || 'configuration';
        this.navigate(initialPath);
    }
}