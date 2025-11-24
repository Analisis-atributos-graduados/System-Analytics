import AuthService from '../services/auth.service.js';
import { DOMUtils } from '../utils/dom.utils.js';
import { ValidatorUtils } from '../utils/validator.utils.js';

export class LoginView {
    constructor() {
        this.isLoading = false;
    }

    render() {
        return `
            <div class="login-form">
                <div class="tabs">
                    <button class="tab active" data-tab="login">Iniciar Sesión</button>
                    <button class="tab" data-tab="register">Registrarse</button>
                </div>

                <!-- Tab: Login -->
                <div id="login-tab" class="tab-content active">
                    <form id="login-form">
                        <div class="form-group">
                            <label for="login-email">Email</label>
                            <input type="email" id="login-email" required 
                                   placeholder="tu@email.com">
                        </div>
                        
                        <div class="form-group">
                            <label for="login-password">Contraseña</label>
                            <input type="password" id="login-password" required 
                                   placeholder="••••••••">
                        </div>

                        <div id="login-error" class="error-message" style="display: none;"></div>

                        <button type="submit" class="btn btn-primary btn-block" 
                                id="btn-login" ${this.isLoading ? 'disabled' : ''}>
                            ${this.isLoading ? 'Iniciando sesión...' : 'Iniciar Sesión'}
                        </button>
                    </form>

                    <div class="divider">o</div>

                    <button class="btn btn-google btn-block" id="btn-google-login">
                        <svg width="18" height="18" viewBox="0 0 18 18">
                            <path fill="#4285F4" d="M16.51 8H8.98v3h4.3c-.18 1-.74 1.48-1.6 2.04v2.01h2.6a7.8 7.8 0 0 0 2.38-5.88c0-.57-.05-.66-.15-1.18z"/>
                            <path fill="#34A853" d="M8.98 17c2.16 0 3.97-.72 5.3-1.94l-2.6-2a4.8 4.8 0 0 1-7.18-2.54H1.83v2.07A8 8 0 0 0 8.98 17z"/>
                            <path fill="#FBBC05" d="M4.5 10.52a4.8 4.8 0 0 1 0-3.04V5.41H1.83a8 8 0 0 0 0 7.18l2.67-2.07z"/>
                            <path fill="#EA4335" d="M8.98 4.18c1.17 0 2.23.4 3.06 1.2l2.3-2.3A8 8 0 0 0 1.83 5.4L4.5 7.49a4.77 4.77 0 0 1 4.48-3.3z"/>
                        </svg>
                        Continuar con Google
                    </button>
                </div>

                <!-- Tab: Register -->
                <div id="register-tab" class="tab-content">
                    <form id="register-form">
                        <div class="form-group">
                            <label for="register-name">Nombre completo</label>
                            <input type="text" id="register-name" required 
                                   placeholder="Juan Pérez">
                        </div>

                        <div class="form-group">
                            <label for="register-email">Email</label>
                            <input type="email" id="register-email" required 
                                   placeholder="tu@email.com">
                        </div>
                        
                        <div class="form-group">
                            <label for="register-password">Contraseña</label>
                            <input type="password" id="register-password" required 
                                   placeholder="••••••••" minlength="6">
                            <small>Mínimo 6 caracteres</small>
                        </div>

                        <div class="form-group">
                            <label for="register-role">Rol</label>
                            <select id="register-role" required>
                                <option value="">Selecciona tu rol</option>
                                <option value="PROFESOR">Profesor</option>
                                <option value="AREA_CALIDAD">Área de Calidad</option>
                            </select>
                        </div>

                        <div id="register-error" class="error-message" style="display: none;"></div>

                        <button type="submit" class="btn btn-primary btn-block" 
                                id="btn-register" ${this.isLoading ? 'disabled' : ''}>
                            ${this.isLoading ? 'Registrando...' : 'Crear cuenta'}
                        </button>
                    </form>
                </div>
            </div>
        `;
    }

    attachEventListeners() {
        // Tabs
        document.querySelectorAll('.tab').forEach(tab => {
            tab.addEventListener('click', (e) => this.switchTab(e.target.dataset.tab));
        });

        // Login form
        document.getElementById('login-form').addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleLogin();
        });

        // Register form
        document.getElementById('register-form').addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleRegister();
        });

        // Google login
        document.getElementById('btn-google-login').addEventListener('click', () => {
            this.handleGoogleLogin();
        });
    }

    switchTab(tabName) {
        // Update tab buttons
        document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
        document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');

        // Update tab content
        document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
        document.getElementById(`${tabName}-tab`).classList.add('active');

        // Clear error messages
        this.hideError('login');
        this.hideError('register');
    }

    async handleLogin() {
        const email = document.getElementById('login-email').value;
        const password = document.getElementById('login-password').value;

        this.hideError('login');

        if (!ValidatorUtils.isValidEmail(email)) {
            this.showError('login', 'Por favor ingresa un email válido');
            return;
        }

        this.setLoading(true, 'login');

        try {
            await AuthService.loginWithEmail(email, password);
            console.log('✅ Login exitoso, redirigiendo...');
            window.location.href = '/index.html';
        } catch (error) {
            console.error('❌ Error en login:', error);
            this.showError('login', error.message);
        } finally {
            this.setLoading(false, 'login');
        }
    }

    async handleRegister() {
        const nombreInput = document.getElementById('register-name').value;
        const emailInput = document.getElementById('register-email').value;
        const password = document.getElementById('register-password').value;
        const rol = document.getElementById('register-role').value;

        // Sanitizar entradas
        const nombre = nombreInput.trim();
        const email = emailInput.trim();

        this.hideError('register');

        // Validaciones exhaustivas
        if (!ValidatorUtils.isValidName(nombre)) {
            this.showError('register', 'El nombre solo debe contener letras y espacios (ej: Juan Pérez)');
            return;
        }

        if (!ValidatorUtils.isValidEmail(email)) {
            this.showError('register', 'Por favor ingresa un email válido');
            return;
        }

        if (!ValidatorUtils.validate(password, ValidatorUtils.PATTERNS.PASSWORD)) {
            this.showError('register', 'La contraseña debe tener al menos 6 caracteres');
            return;
        }

        if (!rol) {
            this.showError('register', 'Por favor selecciona un rol');
            return;
        }

        this.setLoading(true, 'register');

        try {
            await AuthService.register(email, password, nombre, rol);
            console.log('✅ Registro exitoso, redirigiendo...');
            window.location.href = '/index.html';
        } catch (error) {
            console.error('❌ Error en registro:', error);
            this.showError('register', error.message);
        } finally {
            this.setLoading(false, 'register');
        }
    }

    async handleGoogleLogin() {
        this.setLoading(true, 'login');
        this.hideError('login');

        try {
            const user = await AuthService.loginWithGoogle();

            // Si es la primera vez con Google, redirigir a completar registro
            if (!user) {
                console.log('Usuario nuevo con Google, completar registro');
                // Aquí podrías mostrar un modal para seleccionar el rol
                this.showError('login', 'Por favor completa tu registro seleccionando un rol');
                return;
            }

            console.log('✅ Login con Google exitoso, redirigiendo...');
            window.location.href = '/index.html';
        } catch (error) {
            console.error('❌ Error en login con Google:', error);
            this.showError('login', error.message);
        } finally {
            this.setLoading(false, 'login');
        }
    }

    setLoading(loading, form) {
        this.isLoading = loading;
        const button = document.getElementById(`btn-${form}`);
        if (button) {
            button.disabled = loading;
            button.textContent = loading ?
                (form === 'login' ? 'Iniciando sesión...' : 'Registrando...') :
                (form === 'login' ? 'Iniciar Sesión' : 'Crear cuenta');
        }
    }

    showError(form, message) {
        const errorDiv = document.getElementById(`${form}-error`);
        if (errorDiv) {
            errorDiv.textContent = message;
            errorDiv.style.display = 'block';
        }
    }

    hideError(form) {
        const errorDiv = document.getElementById(`${form}-error`);
        if (errorDiv) {
            errorDiv.style.display = 'none';
        }
    }
}
