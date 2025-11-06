import { DOMUtils } from '../utils/dom.utils.js';
import { StorageUtils } from '../utils/storage.utils.js';

export class Router {
    constructor() {
        this.routes = {};
        this.currentRoute = null;
    }

    register(path, view) {
        this.routes[path] = view;
    }

    navigate(path) {
        console.log(`Router: Attempting to navigate to: ${path}`);
        // Validar si la ruta está habilitada
        if (!this.isRouteEnabled(path)) {
            alert('Debes completar los pasos anteriores antes de acceder a esta sección');
            console.log(`Router: Navigation to ${path} blocked by isRouteEnabled.`);
            return;
        }

        if (this.routes[path]) {
            this.currentRoute = path;
            const view = this.routes[path];
            console.log(`Router: Rendering view for path: ${path}`);
            
            // Render the view
            DOMUtils.render('#main-content', '');
            view.render();
            
            // Update navigation active state
            this.updateNavigation();
            
            // Update URL without reload
            window.history.pushState({}, '', `#${path}`);
            console.log(`Router: Successfully navigated to: ${path}`);
        } else {
            console.log(`Router: Route not found for path: ${path}`);
        }
    }

    isRouteEnabled(path) {
        console.log(`Router: Checking if route ${path} is enabled.`);
        // Ajustes siempre está habilitado
        if (path === 'settings') {
            return true;
        }

        // Configuración siempre está habilitada
        if (path === 'configuration') {
            return true;
        }

        // Upload solo si configuración está completa
        if (path === 'upload') {
            return StorageUtils.load('configurationComplete') === true;
        }

        // Analysis solo si hay archivos subidos
        if (path === 'analysis') {
            return StorageUtils.load('uploadComplete') === true;
        }

        return false;
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