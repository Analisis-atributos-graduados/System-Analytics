export class HeaderComponent {
    constructor() {
        this.notifications = 2;
    }

    render() {
        return `
            <div class="header">
                <div class="logo-section">
                    <div class="logo">
                        <div class="notification-badge">${this.notifications}</div>
                    </div>
                    <div class="logo-text">
                        <h1>EvalIA</h1>
                        <p>Sistema de Evaluación Académica Inteligente</p>
                    </div>
                </div>
                <div class="header-right">
                    <button class="university-btn" id="university-btn">
                        🎓 Universidad
                    </button>
                    <div class="theme-toggle" id="theme-toggle">🌙</div>
                </div>
            </div>
        `;
    }

    attachEvents() {
        document.getElementById('theme-toggle')?.addEventListener('click', () => {
            this.toggleTheme();
        });
    }

    toggleTheme() {
        // Implementar cambio de tema
        console.log('Theme toggle clicked');
    }
}