import AuthService from '../services/auth.service.js';

export class NavigationComponent {
    constructor() {
        this.currentUser = AuthService.getCurrentUser();
        this.userRole = this.currentUser?.rol || 'PROFESOR';

        this.tabs = [
            {
                id: 'configuration',
                label: 'Configuración',
                icon: '⚙️',
                roles: ['PROFESOR']
            },
            {
                id: 'upload',
                label: 'Subir archivos',
                icon: '📤',
                roles: ['PROFESOR']
            },
            {
                id: 'analysis',
                label: 'Análisis',
                icon: '📊',
                roles: ['PROFESOR', 'AREA_CALIDAD']
            },
            {
                id: 'settings',
                label: 'Ajustes',
                icon: '⚙️',
                roles: ['AREA_CALIDAD', 'PROFESOR']
            }
        ];
    }

    render() {
        const visibleTabs = this.tabs.filter(tab =>
            tab.roles.includes(this.userRole)
        );

        const tabsHTML = visibleTabs.map(tab => {
            return `
                <button class="nav-tab" data-route="${tab.id}">
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

    attachEventListeners() {
        const navTabs = document.querySelectorAll('.nav-tab');

        navTabs.forEach(tab => {
            tab.addEventListener('click', () => {
                const route = tab.dataset.route;

                // Remover active de todos
                navTabs.forEach(t => t.classList.remove('active'));

                // Agregar active al clickeado
                tab.classList.add('active');

                // Navegar usando el router global
                if (window.appRouter) {
                    window.appRouter.navigate(route);
                } else {
                    console.error('❌ Router no disponible');
                }
            });
        });

        console.log('✅ Event listeners de navegación agregados');
    }
}
