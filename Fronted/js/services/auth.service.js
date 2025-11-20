import { auth } from '../config/firebase.config.js';
import { 
    signInWithEmailAndPassword, 
    createUserWithEmailAndPassword,
    signOut,
    onAuthStateChanged,
    GoogleAuthProvider,
    signInWithPopup
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';
import ApiService from './api.service.js';
import { StorageUtils } from '../utils/storage.utils.js';

const USER_KEY = 'currentUser';

class AuthService {
    constructor() {
        this.currentUser = null;
        this.firebaseUser = null;
        this.authToken = null;
        
        // Escuchar cambios en el estado de autenticación
        this.setupAuthListener();
    }

    /**
     * Configura el listener de cambios de autenticación de Firebase
     */
    setupAuthListener() {
        if (!auth) {
            console.error('Firebase Auth no está inicializado');
            return;
        }

        onAuthStateChanged(auth, async (firebaseUser) => {
            if (firebaseUser) {
                this.firebaseUser = firebaseUser;
                console.log('🔐 Usuario autenticado:', firebaseUser.email);
                
                try {
                    // Obtener el ID token
                    this.authToken = await firebaseUser.getIdToken();
                    
                    // Obtener datos del usuario desde el backend
                    await this.syncUserWithBackend();
                } catch (error) {
                    console.error('Error al sincronizar usuario:', error);
                }
            } else {
                this.firebaseUser = null;
                this.authToken = null;
                this.currentUser = null;
                StorageUtils.remove(USER_KEY);
                console.log('🔓 Usuario no autenticado');
            }
        });
    }

    /**
     * Inicia sesión con email y contraseña
     */
    async loginWithEmail(email, password) {
        try {
            const userCredential = await signInWithEmailAndPassword(auth, email, password);
            const firebaseUser = userCredential.user;
            
            // Obtener token
            this.authToken = await firebaseUser.getIdToken();
            this.firebaseUser = firebaseUser;
            
            // Sincronizar con backend
            await this.syncUserWithBackend();
            
            console.log('✅ Login exitoso:', firebaseUser.email);
            return this.currentUser;
        } catch (error) {
            console.error('❌ Error en login:', error);
            throw this.handleAuthError(error);
        }
    }

    /**
 * Inicia sesión con Google
 */
async loginWithGoogle() {
    try {
        console.log('🔵 Iniciando login con Google...');
        
        const provider = new GoogleAuthProvider();
        const result = await signInWithPopup(auth, provider);
        const firebaseUser = result.user;
        
        // Obtener token
        this.authToken = await firebaseUser.getIdToken();
        this.firebaseUser = firebaseUser;
        
        console.log('✅ Autenticado en Firebase:', firebaseUser.email);
        
        // Intentar obtener usuario del backend
        try {
            await this.syncUserWithBackend();
            console.log('✅ Usuario existente en backend, login exitoso');
            return this.currentUser;
            
        } catch (error) {
            // Si el usuario no existe en backend (404), registrar automáticamente
            if (error.message.includes('Usuario no encontrado')) {
                console.log('⚠️ Usuario nuevo con Google, iniciando registro...');
                
                // Mostrar modal para seleccionar rol
                const rol = await this.showRoleSelectionModal(firebaseUser.displayName || firebaseUser.email);
                
                if (!rol) {
                    console.log('❌ Usuario canceló selección de rol');
                    await this.logout();
                    throw new Error('Debes seleccionar un rol para continuar');
                }
                
                console.log('📝 Registrando usuario con rol:', rol);
                
                // Registrar en backend
                const backendUser = await ApiService.post('/auth/register', {
                    firebase_uid: firebaseUser.uid,
                    email: firebaseUser.email,
                    nombre: firebaseUser.displayName || firebaseUser.email.split('@')[0],
                    rol: rol
                });
                
                this.currentUser = backendUser;
                StorageUtils.save(USER_KEY, backendUser);
                
                console.log('✅ Usuario registrado exitosamente con Google');
                return backendUser;
            }
            
            // Si es otro error, lanzarlo
            throw error;
        }
        
    } catch (error) {
        console.error('❌ Error en login con Google:', error);
        throw this.handleAuthError(error);
    }
}

/**
 * Muestra un modal para seleccionar el rol del usuario
 */
async showRoleSelectionModal(userName) {
    return new Promise((resolve) => {
        // Crear modal
        const modal = document.createElement('div');
        modal.id = 'role-selection-modal';
        modal.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0, 0, 0, 0.7);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 9999;
            animation: fadeIn 0.3s ease;
        `;
        
        modal.innerHTML = `
            <div style="
                background: white;
                padding: 40px;
                border-radius: 12px;
                max-width: 450px;
                width: 90%;
                box-shadow: 0 10px 40px rgba(0,0,0,0.3);
                animation: slideUp 0.3s ease;
            ">
                <h2 style="
                    margin: 0 0 12px 0;
                    color: #333;
                    font-size: 24px;
                    font-weight: 600;
                ">¡Bienvenido ${userName}!</h2>
                
                <p style="
                    margin: 0 0 24px 0;
                    color: #666;
                    font-size: 15px;
                    line-height: 1.5;
                ">Para completar tu registro, selecciona tu rol en el sistema:</p>
                
                <div style="margin-bottom: 24px;">
                    <label style="
                        display: block;
                        padding: 16px;
                        border: 2px solid #e0e0e0;
                        border-radius: 8px;
                        margin-bottom: 12px;
                        cursor: pointer;
                        transition: all 0.3s;
                    " onmouseover="this.style.borderColor='#667eea'; this.style.background='#f8f9ff'" 
                       onmouseout="this.style.borderColor='#e0e0e0'; this.style.background='white'">
                        <input type="radio" name="role" value="PROFESOR" style="margin-right: 12px;">
                        <strong style="color: #333; font-size: 16px;">👨‍🏫 Profesor</strong>
                        <p style="margin: 8px 0 0 28px; color: #666; font-size: 13px;">
                            Crear y gestionar evaluaciones de mis estudiantes
                        </p>
                    </label>
                    
                    <label style="
                        display: block;
                        padding: 16px;
                        border: 2px solid #e0e0e0;
                        border-radius: 8px;
                        cursor: pointer;
                        transition: all 0.3s;
                    " onmouseover="this.style.borderColor='#667eea'; this.style.background='#f8f9ff'" 
                       onmouseout="this.style.borderColor='#e0e0e0'; this.style.background='white'">
                        <input type="radio" name="role" value="AREA_CALIDAD" style="margin-right: 12px;">
                        <strong style="color: #333; font-size: 16px;">📊 Área de Calidad</strong>
                        <p style="margin: 8px 0 0 28px; color: #666; font-size: 13px;">
                            Ver y analizar todas las evaluaciones de la institución
                        </p>
                    </label>
                </div>
                
                <div style="display: flex; gap: 12px;">
                    <button id="role-cancel-btn" style="
                        flex: 1;
                        padding: 14px;
                        background: #f0f0f0;
                        border: none;
                        border-radius: 8px;
                        cursor: pointer;
                        font-size: 15px;
                        font-weight: 500;
                        color: #666;
                        transition: all 0.3s;
                    " onmouseover="this.style.background='#e0e0e0'" 
                       onmouseout="this.style.background='#f0f0f0'">
                        Cancelar
                    </button>
                    
                    <button id="role-confirm-btn" style="
                        flex: 1;
                        padding: 14px;
                        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                        border: none;
                        border-radius: 8px;
                        cursor: pointer;
                        font-size: 15px;
                        font-weight: 500;
                        color: white;
                        transition: all 0.3s;
                    " onmouseover="this.style.transform='translateY(-2px)'; this.style.boxShadow='0 8px 20px rgba(102,126,234,0.3)'" 
                       onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='none'">
                        Confirmar
                    </button>
                </div>
            </div>
        `;
        
        // Agregar animaciones CSS
        const style = document.createElement('style');
        style.textContent = `
            @keyframes fadeIn {
                from { opacity: 0; }
                to { opacity: 1; }
            }
            @keyframes slideUp {
                from { transform: translateY(50px); opacity: 0; }
                to { transform: translateY(0); opacity: 1; }
            }
        `;
        document.head.appendChild(style);
        
        document.body.appendChild(modal);
        
        // Event listeners
        document.getElementById('role-confirm-btn').onclick = () => {
            const selectedRole = document.querySelector('input[name="role"]:checked');
            if (!selectedRole) {
                alert('Por favor selecciona un rol');
                return;
            }
            
            const rol = selectedRole.value;
            document.body.removeChild(modal);
            document.head.removeChild(style);
            resolve(rol);
        };
        
        document.getElementById('role-cancel-btn').onclick = () => {
            document.body.removeChild(modal);
            document.head.removeChild(style);
            resolve(null);
        };
        
        // Cerrar con ESC
        const handleEscape = (e) => {
            if (e.key === 'Escape') {
                document.body.removeChild(modal);
                document.head.removeChild(style);
                document.removeEventListener('keydown', handleEscape);
                resolve(null);
            }
        };
        document.addEventListener('keydown', handleEscape);
    });
}

    /**
     * Registra un nuevo usuario
     */
    async register(email, password, nombre, rol) {
        try {
            // 1. Crear usuario en Firebase
            const userCredential = await createUserWithEmailAndPassword(auth, email, password);
            const firebaseUser = userCredential.user;
            
            // 2. Obtener token
            this.authToken = await firebaseUser.getIdToken();
            this.firebaseUser = firebaseUser;
            
            // 3. Registrar en backend
            const backendUser = await ApiService.post('/auth/register', {
                firebase_uid: firebaseUser.uid,
                email: firebaseUser.email,
                nombre: nombre,
                rol: rol
            });
            
            this.currentUser = backendUser;
            StorageUtils.save(USER_KEY, backendUser);
            
            console.log('✅ Registro exitoso:', backendUser);
            return backendUser;
        } catch (error) {
            console.error('❌ Error en registro:', error);
            throw this.handleAuthError(error);
        }
    }

    /**
 * Sincroniza el usuario de Firebase con el backend
 */
async syncUserWithBackend() {
    try {
        console.log('🔄 Sincronizando usuario con backend...');
        
        const backendUser = await ApiService.get('/auth/me');
        
        if (!backendUser) {
            throw new Error('Backend no devolvió datos de usuario');
        }
        
        this.currentUser = backendUser;
        StorageUtils.save(USER_KEY, backendUser);
        
        console.log('✅ Usuario sincronizado:', backendUser.email, '- Rol:', backendUser.rol);
        return backendUser;
        
    } catch (error) {
        console.error('❌ Error sincronizando con backend:', error);
        
        // IMPORTANTE: Solo limpiar si es un 404 real
        if (error.message.includes('Usuario no encontrado') || error.message.includes('404')) {
            console.warn('⚠️ Usuario no existe en backend');
            
            // NO cerrar sesión aquí, dejarlo al método que llamó
            throw new Error('Usuario no encontrado en el sistema');
        }
        
        // Para otros errores (red, servidor caído, etc), NO limpiar sesión
        throw error;
    }
}



    /**
     * Cierra sesión
     */
    async logout() {
        try {
            await signOut(auth);
            this.firebaseUser = null;
            this.authToken = null;
            this.currentUser = null;
            StorageUtils.remove(USER_KEY);
            console.log('✅ Logout exitoso');
        } catch (error) {
            console.error('❌ Error en logout:', error);
            throw error;
        }
    }

    /**
     * Obtiene el token de autenticación actual
     */
    async getToken() {
        if (!this.firebaseUser) {
            return null;
        }
        
        try {
            // Refrescar token si es necesario
            this.authToken = await this.firebaseUser.getIdToken(true);
            return this.authToken;
        } catch (error) {
            console.error('Error obteniendo token:', error);
            return null;
        }
    }

    /**
 * Verifica si el usuario está autenticado
 */
isAuthenticated() {
    const hasFirebaseUser = this.firebaseUser !== null;
    const hasBackendUser = this.currentUser !== null;
    const hasToken = this.authToken !== null;
    
    console.log('🔐 Verificando autenticación:', {
        firebaseUser: hasFirebaseUser,
        backendUser: hasBackendUser,
        token: hasToken,
        result: hasFirebaseUser && hasBackendUser
    });
    
    return hasFirebaseUser && hasBackendUser;
}

/**
 * Obtiene el usuario actual
 */
getCurrentUser() {
    // Intentar obtener de memoria
    if (this.currentUser) {
        return this.currentUser;
    }
    
    // Intentar obtener de localStorage
    const storedUser = StorageUtils.load(USER_KEY);
    if (storedUser) {
        this.currentUser = storedUser;
        console.log('👤 Usuario recuperado de localStorage:', storedUser.email);
        return storedUser;
    }
    
    console.warn('⚠️ No hay usuario actual disponible');
    return null;
}


    /**
     * Verifica si el usuario tiene un rol específico
     */
    hasRole(rol) {
        return this.currentUser?.rol === rol;
    }

    /**
     * Maneja errores de autenticación de Firebase
     */
    handleAuthError(error) {
        const errorMessages = {
            'auth/invalid-email': 'Email inválido',
            'auth/user-disabled': 'Usuario deshabilitado',
            'auth/user-not-found': 'Usuario no encontrado',
            'auth/wrong-password': 'Contraseña incorrecta',
            'auth/email-already-in-use': 'El email ya está registrado',
            'auth/weak-password': 'La contraseña es muy débil (mínimo 6 caracteres)',
            'auth/operation-not-allowed': 'Operación no permitida',
            'auth/invalid-credential': 'Credenciales inválidas',
            'auth/popup-closed-by-user': 'Popup cerrado por el usuario'
        };

        const message = errorMessages[error.code] || error.message || 'Error de autenticación';
        return new Error(message);
    }

    /**
 * Espera a que Firebase Auth termine de cargar el estado del usuario
 * @returns {Promise<boolean>} true si hay usuario autenticado, false si no
 */
waitForAuth() {
    return new Promise((resolve) => {
        console.log('⏳ Esperando a Firebase Auth...');
        
        let resolved = false;
        
        // Timeout de seguridad (8 segundos - más tiempo para Firebase)
        const timeout = setTimeout(() => {
            if (!resolved) {
                console.warn('⚠️ Timeout esperando Firebase Auth');
                resolved = true;
                unsubscribe();
                resolve(false);
            }
        }, 8000);
        
        // Escuchar cambios de autenticación
        const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
            if (resolved) return; // Ya resolvimos, ignorar
            
            console.log('🔔 onAuthStateChanged disparado:', firebaseUser ? firebaseUser.email : 'sin usuario');
            
            if (firebaseUser) {
                // Hay usuario en Firebase
                console.log('🔐 Usuario Firebase detectado:', firebaseUser.email);
                this.firebaseUser = firebaseUser;
                
                try {
                    // Obtener token
                    this.authToken = await firebaseUser.getIdToken();
                    console.log('🎫 Token obtenido');
                    
                    // Sincronizar con backend
                    await this.syncUserWithBackend();
                    console.log('✅ Usuario sincronizado con backend');
                    
                    // Resolver como exitoso
                    clearTimeout(timeout);
                    resolved = true;
                    unsubscribe();
                    resolve(true);
                    
                } catch (error) {
                    console.error('❌ Error sincronizando con backend:', error);
                    
                    // Si el backend no encuentra al usuario, cerrar sesión de Firebase
                    if (error.message.includes('Usuario no encontrado') || error.message.includes('404')) {
                        console.warn('⚠️ Usuario no existe en backend, cerrando sesión...');
                        await this.logout();
                    }
                    
                    clearTimeout(timeout);
                    resolved = true;
                    unsubscribe();
                    resolve(false);
                }
                
            } else {
                // No hay usuario en Firebase
                console.log('❌ No hay usuario en Firebase');
                
                // Limpiar datos locales si existen
                const storedUser = StorageUtils.load(USER_KEY);
                if (storedUser) {
                    console.warn('🗑️ Limpiando usuario de localStorage (sesión caducada)');
                    StorageUtils.remove(USER_KEY);
                }
                
                clearTimeout(timeout);
                resolved = true;
                unsubscribe();
                resolve(false);
            }
        });
    });
}

    
}

// Exportar instancia única (singleton)
const authServiceInstance = new AuthService();
export default authServiceInstance;
