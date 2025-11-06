import { Router } from './router/router.js';
import { HeaderComponent } from './components/header.component.js';
import { NavigationComponent } from './components/navigation.component.js';
import { ConfigurationView } from './views/configuration.view.js';
import { UploadView } from './views/upload.view.js';
import { AnalysisView } from './views/analysis.view.js';
import { SettingsView } from './views/settings.view.js';
import { DOMUtils } from './utils/dom.utils.js';
import { StorageUtils } from './utils/storage.utils.js'; // Import StorageUtils

// Function to apply theme from localStorage
function applyThemeFromLocalStorage() {
    const savedTheme = StorageUtils.load('theme') || 'dark-theme'; // Default to dark-theme
    document.body.className = savedTheme;
}

class App {
    constructor() {
        this.router = new Router();
        this.init();
    }

    init() {
        applyThemeFromLocalStorage(); // Apply theme immediately on load

        console.log('App: Initializing components...');

        // Render header
        console.log('App: Rendering HeaderComponent...');
        const header = new HeaderComponent();
        DOMUtils.render('#header', header.render());
        header.attachEvents();
        console.log('App: HeaderComponent rendered.');

        // Register routes
        this.router.register('configuration', new ConfigurationView(this.router));
        this.router.register('upload', new UploadView(this.router));
        this.router.register('analysis', new AnalysisView(this.router));
        this.router.register('settings', new SettingsView(this.router));
        console.log('App: Routes registered.');

        // Render navigation
        console.log('App: Rendering NavigationComponent...');
        const navigation = new NavigationComponent(this.router);
        DOMUtils.render('#navigation', navigation.render());
        navigation.attachEvents();
        console.log('App: NavigationComponent rendered.');

        // Initialize router
        console.log('App: Initializing router...');
        this.router.init();
        console.log('App: Router initialized.');

        // Setup help button
        this.setupHelpButton();
    }

    setupHelpButton() {
        document.getElementById('help-button')?.addEventListener('click', () => {
            alert('Sistema de ayuda\n\nEvalIA es un sistema de evaluación académica inteligente que te permite:\n\n• Configurar cursos y criterios\n• Subir documentos académicos\n• Obtener evaluaciones automatizadas\n• Analizar resultados detallados');
        });
    }
}

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    new App();
});