import { Router } from './router/router.js';
import { HeaderComponent } from './components/header.component.js';
import { NavigationComponent } from './components/navigation.component.js';
import AuthService from './services/auth.service.js';

/**
 * Inicializa la aplicación principal
 */
export default async function initializeApp() {
    console.log('🚀 Inicializando componentes de la aplicación...');

    try {
        // Verificar usuario
        const currentUser = AuthService.getCurrentUser();
        if (!currentUser) {
            console.error('❌ No hay usuario autenticado en main.js');
            window.location.href = './login.html';
            return;
        }

        console.log('✅ Usuario cargado en app:', currentUser.email, '- Rol:', currentUser.rol);

        // Renderizar header
        console.log('📋 Renderizando header...');
        const headerComponent = new HeaderComponent();
        const headerContainer = document.getElementById('header');
        if (headerContainer) {
            headerContainer.innerHTML = headerComponent.render();
            headerComponent.attachEventListeners();
            console.log('✅ Header renderizado');
        } else {
            console.error('❌ Contenedor #header no encontrado');
        }

        // Renderizar navegación
        console.log('📋 Renderizando navegación...');
        const navigationComponent = new NavigationComponent();
        const navContainer = document.getElementById('navigation');
        if (navContainer) {
            navContainer.innerHTML = navigationComponent.render();
            navigationComponent.attachEventListeners();
            console.log('✅ Navegación renderizada');
        } else {
            console.error('❌ Contenedor #navigation no encontrado');
        }

        // Inicializar router
        console.log('🛣️ Inicializando router...');
        const router = new Router();

        // Navegar a la ruta inicial según el rol
        let initialRoute = 'configuration';

        if (currentUser.rol === 'AREA_CALIDAD') {
            initialRoute = 'analysis';
        }

        router.navigate(initialRoute);

        console.log('✅ Router inicializado - Ruta inicial:', initialRoute);

        // Guardar router y loginView globalmente para debugging y acceso de AuthService
        window.appRouter = router;
        // Asumimos que LoginView se instancia en el DOM cuando es necesario
        // pero para el flujo de linking necesitamos acceso directo
        if (window.location.pathname.endsWith('login.html')) {
            const { LoginView } = await import('./views/login.view.js');
            window.appLoginView = new LoginView();
        }

        console.log('🎉 Aplicación cargada exitosamente');

    } catch (error) {
        console.error('❌ Error al inicializar app:', error);
        alert('Error al inicializar la aplicación: ' + error.message);
        throw error;
    }
}
