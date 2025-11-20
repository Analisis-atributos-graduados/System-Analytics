import { DOMUtils } from '../utils/dom.utils.js';

export class RegisterView {
    constructor(router) {
        this.router = router;
    }

    render() {
        const html = `
            <div class="login-container">
                <div class="login-card">
                    <div class="auth-header">
                        <div class="logo">⚛</div>
                        <h1>Crea tu Cuenta en EvalIA</h1>
                        <p>Comienza a evaluar de forma inteligente</p>
                    </div>
                    
                    <button class="btn-google">
                        <img src="https://upload.wikimedia.org/wikipedia/commons/c/c1/Google_%22G%22_logo.svg" alt="Google Logo" />
                        Registrarse con Google
                    </button>

                    <div class="login-divider"><span>o</span></div>

                    <form id="register-form" class="auth-form">
                        <div class="form-group">
                            <label class="form-label" for="fullname">Nombre Completo</label>
                            <input type="text" id="fullname" class="form-input" placeholder="Tu Nombre Completo" required>
                        </div>
                        <div class="form-group">
                            <label class="form-label" for="email">Correo Electrónico</label>
                            <input type="email" id="email" class="form-input" placeholder="tu@email.com" required>
                        </div>
                        <div class="form-group">
                            <label class="form-label" for="password">Contraseña</label>
                            <input type="password" id="password" class="form-input" placeholder="Crea una contraseña segura" required>
                        </div>
                        <button type="submit" class="btn btn-primary auth-btn">Crear Cuenta</button>
                    </form>

                    <div class="auth-footer">
                        <p>¿Ya tienes una cuenta? <a href="#login" id="go-to-login">Inicia Sesión</a></p>
                    </div>
                </div>
            </div>
        `;
        DOMUtils.render('#main-content', html);
        this.attachEvents();
    }

    attachEvents() {
        document.querySelector('.btn-google')?.addEventListener('click', () => {
            this.router.navigate('configuration');
        });

        document.getElementById('register-form')?.addEventListener('submit', (e) => {
            e.preventDefault();
            this.router.navigate('configuration');
        });

        document.getElementById('go-to-login')?.addEventListener('click', (e) => {
            e.preventDefault();
            this.router.navigate('login');
        });
    }
}