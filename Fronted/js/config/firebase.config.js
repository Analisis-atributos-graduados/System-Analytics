import { 
    getAuth, 
    setPersistence, 
    browserLocalPersistence 
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';

// Configuración de Firebase
export const FIREBASE_CONFIG = {
    apiKey: "AIzaSyCnQemmlV3iG-NKwyG-32jCRQxKUgUT4TU",
    authDomain: "evalia-475805.firebaseapp.com",
    projectId: "evalia-475805",
    storageBucket: "evalia-475805.firebasestorage.app",
    messagingSenderId: "511391059179",
    appId: "1:511391059179:web:b2e17b2cce5ad27ce4c2ae"
};

// Variables globales
export let auth = null;
export let app = null;

/**
 * Inicializa Firebase con persistencia LOCAL
 */
export const initializeFirebase = async () => {
    try {
        console.log('🔥 Inicializando Firebase...');
        
        const { initializeApp } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js');
        
        // Inicializar app
        app = initializeApp(FIREBASE_CONFIG);
        auth = getAuth(app);
        
        // IMPORTANTE: Configurar persistencia LOCAL
        await setPersistence(auth, browserLocalPersistence);
        console.log('💾 Persistencia configurada: LOCAL');
        
        console.log('✅ Firebase inicializado correctamente');
        console.log('📧 Auth Domain:', FIREBASE_CONFIG.authDomain);
        
        return { app, auth };
    } catch (error) {
        console.error('❌ Error al inicializar Firebase:', error);
        throw error;
    }
};

export const isFirebaseInitialized = () => {
    return app !== null && auth !== null;
};
