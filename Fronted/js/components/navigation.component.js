export class NavigationComponent {
    constructor(router) {
        this.router = router;
        this.tabs = [
            { id: 'configuration', label: 'Configuración', icon: '📚', badge: null },
            { id: 'upload', label: 'Subir archivos', icon: '📤', badge: null },
            { id: 'analysis', label: 'Análisis', icon: '📊', badge: 2 },
            { id: 'settings', label: 'Ajustes', icon: '⚙️', badge: null }
        ];
    }

    render() {
        const tabsHTML = this.tabs.map(tab => `
            <button class="nav-tab ${tab.id === this.router.currentRoute ? 'active' : ''} ${tab.badge ? 'has-badge' : ''}"
                    data-route="${tab.id}"
                    ${tab.badge ? `data-badge="${tab.badge}"` : ''}>
                ${tab.icon} ${tab.label}
            </button>
        `).join('');

        return `
            <div class="nav-tabs">
                ${tabsHTML}
            </div>
        `;
    }

    attachEvents() {
        document.querySelectorAll('.nav-tab').forEach(tab => {
            tab.addEventListener('click', (e) => {
                const route = e.currentTarget.dataset.route;
                this.router.navigate(route);
            });
        });
    }
}