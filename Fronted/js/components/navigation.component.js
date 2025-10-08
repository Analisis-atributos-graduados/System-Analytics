import { DOMUtils } from '../utils/dom.utils.js';
import { StorageUtils } from '../utils/storage.utils.js';

export class NavigationComponent {
    constructor(router) {
        this.router = router;
        this.tabs = [
            { id: 'configuration', label: 'Configuración', icon: '📚', badge: null, alwaysEnabled: false },
            { id: 'upload', label: 'Subir archivos', icon: '📤', badge: null, alwaysEnabled: false },
            { id: 'analysis', label: 'Análisis', icon: '📊', badge: null, alwaysEnabled: false },
            { id: 'settings', label: 'Ajustes', icon: '⚙️', badge: null, alwaysEnabled: true }
        ];
    }

    render() {
        const tabsHTML = this.tabs.map(tab => {
            const isEnabled = this.isTabEnabled(tab);
            const isActive = tab.id === this.router.currentRoute;
            
            return `
                <button class="nav-tab 
                              ${isActive ? 'active' : ''} 
                              ${!isEnabled ? 'disabled' : ''}
                              ${tab.badge ? 'has-badge' : ''}"
                        data-route="${tab.id}"
                        ${tab.badge ? `data-badge="${tab.badge}"` : ''}
                        ${!isEnabled ? 'disabled' : ''}>
                    ${tab.icon} ${tab.label}
                </button>
            `;
        }).join('');

        return `
            <div class="nav-tabs">
                ${tabsHTML}
            </div>
        `;
    }

    isTabEnabled(tab) {
        // Ajustes siempre está habilitado
        if (tab.alwaysEnabled) return true;

        // Configuración siempre está habilitada (es el inicio)
        if (tab.id === 'configuration') return true;

        // Upload solo si configuración está completa
        if (tab.id === 'upload') {
            return StorageUtils.load('configurationComplete') === true;
        }

        // Analysis solo si hay archivos subidos
        if (tab.id === 'analysis') {
            const uploadComplete = StorageUtils.load('uploadComplete') === true;
            return uploadComplete;
        }

        return false;
    }

    attachEvents() {
        document.querySelectorAll('.nav-tab:not(.disabled)').forEach(tab => {
            tab.addEventListener('click', (e) => {
                const route = e.currentTarget.dataset.route;
                if (this.isTabEnabled({ id: route })) {
                    this.router.navigate(route);
                }
            });
        });
    }
}