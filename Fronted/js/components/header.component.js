import AuthService from '../services/auth.service.js';

export class HeaderComponent {
    constructor() {
        this.currentUser = AuthService.getCurrentUser();
    }

    render() {
        return `
            <div class="header">
                <div class="logo-section">
                    <div class="logo"></div>
                    <div class="logo-text">
                        <h1>EvalIA</h1>
                        <p>Sistema de Evaluación Académica Inteligente</p>
                    </div>
                </div>
                <div class="header-right">
                    <button class="university-btn" id="university-btn" title="${this.currentUser?.email || ''}">
                        👤 ${this.currentUser?.nombre || 'Usuario'}
                    </button>
                    <button class="theme-toggle" id="theme-toggle" title="Cambiar tema">
                        🌙
                    </button>
                    <button class="btn btn-sm btn-danger" id="logout-btn" title="Cerrar sesión">
                        🚪 Salir
                    </button>
                </div>
            </div>
        `;
    }

    attachEventListeners() {
        // Botón de tema
        const themeToggle = document.getElementById('theme-toggle');
        if (themeToggle) {
            themeToggle.addEventListener('click', () => {
                document.body.classList.toggle('light-theme');
                const isLight = document.body.classList.contains('light-theme');
                themeToggle.textContent = isLight ? '☀️' : '🌙';
                localStorage.setItem('theme', isLight ? 'light' : 'dark');
            });
            
            // Cargar tema guardado
            const savedTheme = localStorage.getItem('theme');
            if (savedTheme === 'light') {
                document.body.classList.add('light-theme');
                themeToggle.textContent = '☀️';
            }
        }

        // Botón de logout
        const logoutBtn = document.getElementById('logout-btn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', async () => {
                if (confirm('¿Estás seguro de que quieres cerrar sesión?')) {
                    try {
                        await AuthService.logout();
                        window.location.href = './login.html';
                    } catch (error) {
                        console.error('Error al cerrar sesión:', error);
                        alert('Error al cerrar sesión');
                    }
                }
            });
        }

        // Botón de universidad (info del usuario)
        const universityBtn = document.getElementById('university-btn');
        if (universityBtn) {
            universityBtn.addEventListener('click', () => {
                alert(`Usuario: ${this.currentUser?.nombre}\nEmail: ${this.currentUser?.email}\nRol: ${this.currentUser?.rol}`);
            });
        }
    }
}
