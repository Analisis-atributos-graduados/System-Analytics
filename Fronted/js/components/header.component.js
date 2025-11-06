export class HeaderComponent {
    constructor() {
        this.notifications = 2;
    }

    render() {
        return `
            <div class="header">
                <div class="logo-section">
                    <div class="logo">
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
                </div>
            </div>
        `;
    }

    attachEvents() {
        // No theme-related events here anymore
    }
}