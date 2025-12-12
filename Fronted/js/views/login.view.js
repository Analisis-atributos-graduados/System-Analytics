import AuthService from '../services/auth.service.js';
import { DOMUtils } from '../utils/dom.utils.js';
import { ValidatorUtils } from '../utils/validator.utils.js';

export class LoginView {
    constructor() {
        this.isLoading = false;
        window.appLoginView = this;
    }

    render() {
        return `
            <div class="login-form">
                <div style="text-align: center; margin-bottom: 20px;">
                    <h2 style="color: var(--text-color); font-size: 1.5rem; margin: 0;">Iniciar Sesión</h2>
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
                            <div style="position: relative;">
                                <input type="password" id="login-password" required 
                                       placeholder="••••••••" style="padding-right: 40px;">
                                <button type="button" id="toggle-password" style="position: absolute; right: 10px; top: 50%; transform: translateY(-50%); background: none; border: none; cursor: pointer; color: var(--secondary-text);">
                                    <svg class="eye-open" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
                                    <svg class="eye-closed" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display: none;"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>
                                </button>
                            </div>
                        </div>

                        <div style="text-align: right; margin-top: -10px; margin-bottom: 15px; font-size: 13px;">
                            <a href="#" id="forgot-password-link">¿Olvidaste tu contraseña?</a>
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
            </div>
        `;
    }

    attachEventListeners() {

        document.getElementById('login-form').addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleLogin();
        });

        document.getElementById('btn-google-login').addEventListener('click', () => {
            this.handleGoogleLogin();
        });

        document.getElementById('toggle-password').addEventListener('click', function () {
            const passwordInput = document.getElementById('login-password');
            const eyeOpen = this.querySelector('.eye-open');
            const eyeClosed = this.querySelector('.eye-closed');

            if (passwordInput.type === 'password') {
                passwordInput.type = 'text';
                eyeOpen.style.display = 'none';
                eyeClosed.style.display = 'block';
            } else {
                passwordInput.type = 'password';
                eyeOpen.style.display = 'block';
                eyeClosed.style.display = 'none';
            }
        });

        document.getElementById('forgot-password-link').addEventListener('click', (e) => {
            e.preventDefault();
            this.showPasswordResetModal();
        });
    }

    showPasswordResetModal() {
        const modal = document.createElement('div');
        modal.id = 'password-reset-modal';
        modal.style.cssText = `
            position: fixed; top: 0; left: 0; right: 0; bottom: 0;
            background: rgba(0, 0, 0, 0.7);
            display: flex; align-items: center; justify-content: center;
            z-index: 10000;
        `;
        modal.innerHTML = `
            <div style="background: var(--card-bg); padding: 30px; border-radius: 12px; max-width: 450px; width: 90%; box-shadow: 0 10px 40px rgba(0,0,0,0.3);">
                <h3 style="margin: 0 0 15px 0; color: var(--text-color);">Recuperar Contraseña</h3>
                <p style="margin: 0 0 20px 0; color: var(--secondary-text); font-size: 14px;">
                    Ingresa tu email y te enviaremos un enlace para restablecer tu contraseña.
                </p>
                <div id="reset-feedback" style="display: none; margin-bottom: 15px; padding: 10px; border-radius: 6px; font-size: 14px;"></div>
                <div id="reset-form">
                    <div class="form-group">
                        <label for="reset-email">Email</label>
                        <input type="email" id="reset-email" required placeholder="tu@email.com" class="form-control" style="width: 100%;">
                    </div>
                    <div style="display: flex; gap: 12px; justify-content: flex-end; margin-top: 20px;">
                        <button id="cancel-reset" class="btn btn-secondary">Cancelar</button>
                        <button id="confirm-reset" class="btn btn-primary">Enviar enlace</button>
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        const removeModal = () => document.body.removeChild(modal);

        document.getElementById('cancel-reset').onclick = removeModal;

        document.getElementById('confirm-reset').onclick = async () => {
            const emailInput = document.getElementById('reset-email');
            const email = emailInput.value.trim();
            const feedbackDiv = document.getElementById('reset-feedback');
            const formDiv = document.getElementById('reset-form');

            if (!ValidatorUtils.isValidEmail(email)) {
                feedbackDiv.textContent = 'Por favor ingresa un email válido.';
                feedbackDiv.style.cssText += 'background: var(--error-light); color: var(--error-dark); display: block;';
                return;
            }

            try {
                await AuthService.sendPasswordResetEmail(email);
                formDiv.style.display = 'none';
                feedbackDiv.textContent = '¡Hecho! Si existe una cuenta con ese email, recibirás un correo con instrucciones en unos minutos.';
                feedbackDiv.style.cssText += 'background: var(--success-light); color: var(--success-dark); display: block;';
                document.getElementById('cancel-reset').textContent = 'Cerrar';
            } catch (error) {
                feedbackDiv.textContent = error.message || 'Ocurrió un error al enviar el email.';
                feedbackDiv.style.cssText += 'background: var(--error-light); color: var(--error-dark); display: block;';
            }
        };

        modal.addEventListener('click', (e) => {
            if (e.target.id === 'password-reset-modal') {
                removeModal();
            }
        });
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
            console.log('Login exitoso, redirigiendo...');
            window.location.href = '/index.html';
        } catch (error) {
            console.error('Error en login:', error);
            this.showError('login', error.message);
        } finally {
            this.setLoading(false, 'login');
        }
    }

    async handleGoogleLogin() {
        this.setLoading(true, 'login');
        this.hideError('login');

        try {
            const user = await AuthService.loginWithGoogle();

            if (!user) {
                console.log('Usuario nuevo con Google, completar registro');

                this.showError('login', 'Por favor completa tu registro seleccionando un rol');
                return;
            }

            console.log('Login con Google exitoso, redirigiendo...');
            window.location.href = '/index.html';
        } catch (error) {
            console.error('Error en login con Google:', error);
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
            button.textContent = loading ? 'Iniciando sesión...' : 'Iniciar Sesión';
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

    async showAccountLinkingPrompt(email) {
        return new Promise((resolve, reject) => {
            const modal = document.createElement('div');
            modal.id = 'account-linking-modal';
            modal.style.cssText = `
                position: fixed; top: 0; left: 0; right: 0; bottom: 0;
                background: rgba(0, 0, 0, 0.7);
                display: flex; align-items: center; justify-content: center;
                z-index: 10000;
            `;
            modal.innerHTML = `
                <div style="background: var(--card-bg); padding: 30px; border-radius: 12px; max-width: 450px; width: 90%; box-shadow: 0 10px 40px rgba(0,0,0,0.3);">
                    <h3 style="margin: 0 0 15px 0; color: var(--text-color);">Vincular Cuenta</h3>
                    <p style="margin: 0 0 20px 0; color: var(--secondary-text); font-size: 14px;">
                        Ya existe una cuenta con el email <strong>${email}</strong> registrada con otro método.
                        Para vincularla con tu cuenta de Google, por favor, introduce tu contraseña actual.
                    </p>
                    <div id="linking-feedback" style="display: none; margin-bottom: 15px; padding: 10px; border-radius: 6px; font-size: 14px;"></div>
                    <div class="form-group">
                        <label for="linking-password">Contraseña actual</label>
                        <div style="position: relative;">
                            <input type="password" id="linking-password" required class="form-control" style="width: 100%; padding-right: 40px;">
                            <button type="button" class="toggle-password-btn" data-target="linking-password" style="position: absolute; right: 10px; top: 50%; transform: translateY(-50%); background: none; border: none; cursor: pointer; color: var(--secondary-text);">
                                <svg class="eye-open" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
                                <svg class="eye-closed" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display: none;"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>
                            </button>
                        </div>
                    </div>
                    <div style="display: flex; gap: 12px; justify-content: flex-end; margin-top: 20px;">
                        <button id="cancel-linking" class="btn btn-secondary">Cancelar</button>
                        <button id="confirm-linking" class="btn btn-primary">Vincular Cuenta</button>
                    </div>
                </div>
            `;

            document.body.appendChild(modal);

            modal.querySelectorAll('.toggle-password-btn').forEach(btn => {
                btn.addEventListener('click', function () {
                    const targetId = this.dataset.target;
                    const passwordInput = document.getElementById(targetId);
                    const eyeOpen = this.querySelector('.eye-open');
                    const eyeClosed = this.querySelector('.eye-closed');

                    if (passwordInput.type === 'password') {
                        passwordInput.type = 'text';
                        eyeOpen.style.display = 'none';
                        eyeClosed.style.display = 'block';
                    } else {
                        passwordInput.type = 'password';
                        eyeOpen.style.display = 'block';
                        eyeClosed.style.display = 'none';
                    }
                });
            });

            const removeModal = () => document.body.removeChild(modal);

            document.getElementById('cancel-linking').onclick = () => {
                removeModal();
                reject(new Error('Vinculación de cuenta cancelada por el usuario.'));
            };

            document.getElementById('confirm-linking').onclick = () => {
                const passwordInput = document.getElementById('linking-password');
                const password = passwordInput.value;
                const feedbackDiv = document.getElementById('linking-feedback');

                if (!password) {
                    feedbackDiv.textContent = 'Por favor introduce tu contraseña actual.';
                    feedbackDiv.style.cssText += 'background: var(--error-light); color: var(--error-dark); display: block;';
                    return;
                }
                removeModal();
                resolve(password);
            };

            modal.addEventListener('click', (e) => {
                if (e.target.id === 'account-linking-modal') {
                    removeModal();
                    reject(new Error('Vinculación de cuenta cancelada por el usuario.'));
                }
            });
        });
    }
}
