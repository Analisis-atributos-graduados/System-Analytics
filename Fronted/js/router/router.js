import { ConfigurationView } from '../views/configuration.view.js';
import { UploadView } from '../views/upload.view.js';
import { AnalysisView } from '../views/analysis.view.js';
import { SettingsView } from '../views/settings.view.js';

export class Router {
    constructor() {
        this.routes = {
            'configuration': ConfigurationView,
            'upload': UploadView,
            'analysis': AnalysisView,
            'settings': SettingsView
        };
        
        this.currentView = null;
        console.log('🛣️ Router creado con rutas:', Object.keys(this.routes));
    }

    navigate(routeName) {
        console.log('🔀 Navegando a:', routeName);
        
        const ViewClass = this.routes[routeName];
        
        if (!ViewClass) {
            console.error(`❌ Ruta no encontrada: ${routeName}`);
            return;
        }
        
        try {
            // Crear instancia de la vista
            this.currentView = new ViewClass(this);
            
            // Renderizar en el contenedor principal
            const mainContent = document.getElementById('main-content');
            if (!mainContent) {
                console.error('❌ Contenedor #main-content no encontrado');
                return;
            }
            
            mainContent.innerHTML = this.currentView.render();
            
            // Adjuntar event listeners
            if (typeof this.currentView.attachEventListeners === 'function') {
                this.currentView.attachEventListeners();
            }
            
            // Actualizar navegación activa
            this.updateActiveNav(routeName);
            
            console.log('✅ Vista renderizada:', routeName);
            
        } catch (error) {
            console.error(`❌ Error al renderizar vista ${routeName}:`, error);
        }
    }

    updateActiveNav(routeName) {
        // Remover clase active de todos los tabs
        document.querySelectorAll('.nav-tab').forEach(tab => {
            tab.classList.remove('active');
        });
        
        // Agregar clase active al tab correspondiente
        const activeTab = document.querySelector(`.nav-tab[data-route="${routeName}"]`);
        if (activeTab) {
            activeTab.classList.add('active');
        }
    }
}
