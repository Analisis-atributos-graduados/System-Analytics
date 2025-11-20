import AuthService from './services/auth.service.js';

document.addEventListener('DOMContentLoaded', () => {
    const loginView = document.getElementById('login-view');
    const registerView = document.getElementById('register-view');
    const goToRegisterLink = document.getElementById('go-to-register');
    const goToLoginLink = document.getElementById('go-to-login');
    const loginForm = document.getElementById('login-form');
    const googleLoginButton = document.querySelector('.btn-google');
    const submitButton = loginForm.querySelector('button[type="submit"]');

    // Toggle between login and register views
    goToRegisterLink.addEventListener('click', (e) => {
        e.preventDefault();
        loginView.style.display = 'none';
        registerView.style.display = 'block';
    });

    goToLoginLink.addEventListener('click', (e) => {
        e.preventDefault();
        loginView.style.display = 'block';
        registerView.style.display = 'none';
    });

    // Handle the real login
    const handleLogin = async (e) => {
        e.preventDefault();
        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;
        
        if (!email || !password) {
            alert('Por favor, ingrese su correo y contraseña.');
            return;
        }

        const originalButtonText = submitButton.innerHTML;
        submitButton.disabled = true;
        submitButton.innerHTML = 'Iniciando sesión...';

        try {
            // 1. Log in to get the token
            await AuthService.login(email, password);

            // 2. Fetch user data (which also stores the user and role)
            const user = await AuthService.getMe();
            
            console.log(`Login exitoso. Usuario: ${user.nombre_completo}, Rol: ${user.rol}`);

            // 3. Redirect to the main app
            window.location.href = 'index.html';

        } catch (error) {
            alert(`Error en el inicio de sesión: ${error.message}`);
        } finally {
            submitButton.disabled = false;
            submitButton.innerHTML = originalButtonText;
        }
    };

    loginForm.addEventListener('submit', handleLogin);

    // Temporarily disable Google Login
    googleLoginButton.addEventListener('click', (e) => {
        e.preventDefault();
        alert('El inicio de sesión con Google no está implementado todavía.');
    });
});

