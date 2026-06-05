import {
    getAuth,
    setPersistence,
    browserLocalPersistence
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';

export const FIREBASE_CONFIG = {
    apiKey: "AIzaSyCdNacVMEquF_e9rv4zbs-IDHW8Vs_S9is",
    authDomain: "semilleros-493300.firebaseapp.com",
    projectId: "semilleros-493300",
    storageBucket: "semilleros-493300.firebasestorage.app",
    messagingSenderId: "121734839794",
    appId: "1:121734839794:web:2fd3e1171cb6c4af7cbf6b"
};

export let auth = null;
export let app = null;

export const initializeFirebase = async () => {
    try {
        console.log('Inicializando Firebase...');

        const { initializeApp } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js');

        app = initializeApp(FIREBASE_CONFIG);
        auth = getAuth(app);

        await setPersistence(auth, browserLocalPersistence);
        console.log('Persistencia configurada: LOCAL');

        console.log('Firebase inicializado correctamente');
        console.log('Auth Domain:', FIREBASE_CONFIG.authDomain);

        return { app, auth };
    } catch (error) {
        console.error('Error al inicializar Firebase:', error);
        throw error;
    }
};

export const isFirebaseInitialized = () => {
    return app !== null && auth !== null;
};
