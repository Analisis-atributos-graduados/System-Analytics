import AuthService from '../services/auth.service.js';

export class NavigationComponent {
    constructor() {
        this.currentUser = AuthService.getCurrentUser();
        this.userRole = this.currentUser?.rol || 'PROFESOR';

        this.tabs = [
            {
                id: 'configuration',
                label: ['COMITE_ACADEMICO', 'DOCENTE_CIAC', 'DIRECTOR_ESCUELA'].includes(this.userRole) ? 'Rúbricas' : 'Configuración',
                icon: ['COMITE_ACADEMICO', 'DOCENTE_CIAC', 'DIRECTOR_ESCUELA'].includes(this.userRole) ? '📋' : '⚙️',
                roles: ['PROFESOR', 'COMITE_ACADEMICO', 'DOCENTE_CIAC', 'DIRECTOR_ESCUELA']
            },
            {
                id: 'asignar-cursos',
                label: 'Asignar Cursos',
                icon: '🔗',
                roles: ['COMITE_ACADEMICO', 'DOCENTE_CIAC']
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
                roles: ['PROFESOR', 'DOCENTE_CIAC', 'DIRECTOR_ESCUELA', 'DIRAC']
            },
            {
                id: 'settings',
                label: 'Ajustes',
                icon: '⚙️',
                roles: ['PROFESOR', 'DOCENTE_CIAC', 'DIRECTOR_ESCUELA', 'COMITE_ACADEMICO', 'DIRAC', 'ADMINISTRADOR']
            }
        ];
    }

    render() {
        const visibleTabs = this.tabs.filter(tab =>
            tab.roles.includes(this.userRole)
        );

        const tabsHTML = visibleTabs.map(tab => {
            const isUploadTab = tab.id === 'upload';
            const configCompleted = localStorage.getItem('configCompleted') === 'true';
            const isDisabled = isUploadTab && !configCompleted;
            return `
                <button class="nav-tab${isDisabled ? ' disabled' : ''}" data-route="${tab.id}" ${isDisabled ? 'title="Completa la configuraci\u00f3n de r\u00fabrica para acceder" aria-disabled="true"' : ''}>
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

                if (tab.classList.contains('disabled') || tab.getAttribute('aria-disabled') === 'true') {
                    return;
                }

                navTabs.forEach(t => t.classList.remove('active'));
                tab.classList.add('active');

                if (window.appRouter) {
                    window.appRouter.navigate(route);
                } else {
                    console.error('Router no disponible');
                }
            });
        });

        console.log('Event listeners de navegación agregados');
    }
}
