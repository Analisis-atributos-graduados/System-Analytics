import { ConfigurationView } from '../views/configuration.view.js';
import { UploadView } from '../views/upload.view.js';
import { AnalysisView } from '../views/analysis.view.js';
import { SettingsView } from '../views/settings.view.js';
import AuthService from '../services/auth.service.js';
import { showErrorNotification } from '../utils/api.utils.js';

export class Router {
    constructor() {
        this.routes = {
            'configuration': ConfigurationView,
            'upload': UploadView,
            'analysis': AnalysisView,
            'settings': SettingsView
        };

        this.currentView = null;
        console.log('Router creado con rutas:', Object.keys(this.routes));
    }

    async navigate(fullRoute) {
        console.log('Navegando a:', fullRoute);

        const [routeName, queryString] = fullRoute.split('?');

        if (routeName === 'settings') {
            const user = AuthService.getCurrentUser();
            // Ambos roles pueden entrar, pero verán cosas distintas.
            if (!user || !['AREA_CALIDAD', 'PROFESOR'].includes(user.rol)) {
                console.warn('Acceso denegado a ajustes');
                showErrorNotification('No tienes permisos para acceder a esta sección');
                return;
            }
        }

        if (queryString) {
            const newUrl = `${window.location.pathname}?${queryString}`;
            window.history.pushState({}, '', newUrl);
        } else {
            window.history.pushState({}, '', window.location.pathname);
        }

        const ViewClass = this.routes[routeName];

        if (!ViewClass) {
            console.error(`Ruta no encontrada: ${routeName}`);
            return;
        }

        try {
            if (this.currentView && typeof this.currentView.destroy === 'function') {
                this.currentView.destroy();
            }

            this.currentView = new ViewClass(this);

            const mainContent = document.getElementById('main-content');
            if (!mainContent) {
                console.error('Contenedor #main-content no encontrado');
                return;
            }

            mainContent.innerHTML = await this.currentView.render();

            if (typeof this.currentView.attachEventListeners === 'function') {
                this.currentView.attachEventListeners();
            }

            this.updateActiveNav(routeName);

            console.log('Vista renderizada:', routeName);

        } catch (error) {
            console.error(`Error al renderizar vista ${routeName}:`, error);
        }
    }

    updateActiveNav(routeName) {
        document.querySelectorAll('.nav-tab').forEach(tab => {
            tab.classList.remove('active');
        });

        const activeTab = document.querySelector(`.nav-tab[data-route="${routeName}"]`);
        if (activeTab) {
            activeTab.classList.add('active');
        }
    }
}
