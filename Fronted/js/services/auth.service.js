import { auth } from '../config/firebase.config.js';
import {
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword,
    signOut,
    onAuthStateChanged,
    GoogleAuthProvider,
    signInWithPopup,
    updatePassword as firebaseUpdatePassword,
    EmailAuthProvider,
    reauthenticateWithCredential,
    sendPasswordResetEmail as firebaseSendPasswordResetEmail,
    fetchSignInMethodsForEmail,
    linkWithCredential
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';
import ApiService from './api.service.js';
import { StorageUtils } from '../utils/storage.utils.js';

const USER_KEY = 'currentUser';

class AuthService {
    constructor() {
        this.currentUser = null;
        this.firebaseUser = null;
        this.authToken = null;

        this.setupAuthListener();
    }

    setupAuthListener() {
        if (!auth) {
            console.error('Firebase Auth no está inicializado');
            return;
        }

        onAuthStateChanged(auth, async (firebaseUser) => {
            if (firebaseUser) {
                this.firebaseUser = firebaseUser;
                console.log('Usuario autenticado:', firebaseUser.email);

                try {
                    this.authToken = await firebaseUser.getIdToken();

                    await this.syncUserWithBackend();
                } catch (error) {
                    console.error('Error al sincronizar usuario:', error);
                }
            } else {
                this.firebaseUser = null;
                this.authToken = null;
                this.currentUser = null;
                StorageUtils.remove(USER_KEY);
                console.log('Usuario no autenticado');
            }
        });
    }

    async loginWithEmail(email, password) {
        try {
            const userCredential = await signInWithEmailAndPassword(auth, email, password);
            const firebaseUser = userCredential.user;

            this.authToken = await firebaseUser.getIdToken();
            this.firebaseUser = firebaseUser;

            await this.syncUserWithBackend();

            console.log('Login exitoso:', firebaseUser.email);
            return this.currentUser;
        } catch (error) {
            console.error('Error en login:', error);
            throw this.handleAuthError(error);
        }
    }

    async loginWithGoogle() {
        try {
            console.log('Iniciando login con Google...');

            const provider = new GoogleAuthProvider();
            const result = await signInWithPopup(auth, provider);
            const firebaseUser = result.user;
            const googleCredential = result.credential;

            this.authToken = await firebaseUser.getIdToken();
            this.firebaseUser = firebaseUser;

            console.log('Autenticado en Firebase:', firebaseUser.email);

            try {
                await this.syncUserWithBackend();
                console.log('Usuario autorizado, login exitoso');
                return this.currentUser;

            } catch (error) {
                if (error.code === 'auth/account-exists-with-different-credential') {
                    console.warn('Cuenta existe con diferentes credenciales. Iniciando flujo de vinculación...');
                    await this.handleAccountLinking(firebaseUser.email, googleCredential);

                    await this.syncUserWithBackend();
                    console.log('Cuenta vinculada y sincronizada, login exitoso');
                    return this.currentUser;
                }

                else if (error.message.includes('Usuario no encontrado') ||
                    error.message.includes('403') ||
                    error.message.includes('Acceso denegado')) {

                    console.log('Usuario no autorizado');
                    await this.logout();
                    throw new Error('Acceso denegado. Tu cuenta no tiene permisos para acceder al sistema. Por favor contacta al administrador.');
                }

                throw error;
            }

        } catch (error) {
            console.error('Error en login con Google:', error);
            if (error.code === 'auth/account-exists-with-different-credential') {
                const email = error.customData.email;
                const credential = GoogleAuthProvider.credentialFromError(error);
                await this.handleAccountLinking(email, credential);
            }
            throw this.handleAuthError(error);
        }
    }

    async handleAccountLinking(email, googleCredential) {
        return new Promise(async (resolve, reject) => {
            let userToLink = this.firebaseUser
            let password = null;
            if (window.appLoginView && typeof window.appLoginView.showAccountLinkingPrompt === 'function') {
                try {
                    password = await window.appLoginView.showAccountLinkingPrompt(email);
                    if (!password) {
                        return reject(new Error('Vinculación de cuenta cancelada.'));
                    }
                } catch (uiError) {
                    return reject(new Error('Error en la interacción de vinculación: ' + uiError.message));
                }
            } else {
                return reject(new Error('No se puede mostrar el prompt de vinculación de cuenta.'));
            }

            try {

                if (!userToLink) {
                    const userCredential = await signInWithEmailAndPassword(auth, email, password);
                    userToLink = userCredential.user;
                } else {

                    const credential = EmailAuthProvider.credential(email, password);
                    await reauthenticateWithCredential(userToLink, credential);
                }

                await linkWithCredential(userToLink, googleCredential);

                this.firebaseUser = userToLink;
                this.authToken = await userToLink.getIdToken();

                console.log('Cuenta de Google vinculada exitosamente.');
                resolve(true);

            } catch (error) {
                console.error('Error durante la vinculación:', error);

                if (!this.firebaseUser) {
                    await this.logout();
                }
                reject(this.handleAuthError(error));
            }
        });
    }

    async showRoleSelectionModal(userName) {
        return new Promise((resolve) => {

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

    async register(email, password, nombre, rol) {
        try {

            const userCredential = await createUserWithEmailAndPassword(auth, email, password);
            const firebaseUser = userCredential.user;

            this.authToken = await firebaseUser.getIdToken();
            this.firebaseUser = firebaseUser;

            const backendUser = await ApiService.post('/auth/register', {
                firebase_uid: firebaseUser.uid,
                email: firebaseUser.email,
                nombre: nombre,
                rol: rol
            });

            this.currentUser = backendUser;
            StorageUtils.save(USER_KEY, backendUser);

            console.log('Registro exitoso:', backendUser);
            return backendUser;
        } catch (error) {
            console.error('Error en registro:', error);
            throw this.handleAuthError(error);
        }
    }

    async syncUserWithBackend() {
        try {
            console.log('Sincronizando usuario con backend...');

            const backendUser = await ApiService.get('/auth/me');

            if (!backendUser) {
                throw new Error('Backend no devolvió datos de usuario');
            }

            this.currentUser = backendUser;
            StorageUtils.save(USER_KEY, backendUser);

            console.log('Usuario sincronizado:', backendUser.email, '- Rol:', backendUser.rol);
            return backendUser;

        } catch (error) {
            console.error('Error sincronizando con backend:', error);

            if (error.message.includes('Usuario no encontrado') || error.message.includes('404')) {
                console.warn('Usuario no existe en backend');

                throw new Error('Usuario no encontrado en el sistema');
            }

            throw error;
        }
    }

    async logout() {
        try {
            await signOut(auth);
            this.firebaseUser = null;
            this.authToken = null;
            this.currentUser = null;
            StorageUtils.remove(USER_KEY);
            console.log('Logout exitoso');
        } catch (error) {
            console.error('Error en logout:', error);
            throw error;
        }
    }

    async updatePassword(currentPassword, newPassword) {
        if (!this.firebaseUser) {
            throw new Error('No hay un usuario autenticado.');
        }

        try {
            const credential = EmailAuthProvider.credential(this.firebaseUser.email, currentPassword);

            await reauthenticateWithCredential(this.firebaseUser, credential);

            await firebaseUpdatePassword(this.firebaseUser, newPassword);

            console.log('Contraseña actualizada correctamente.');
        } catch (error) {
            console.error('Error al actualizar la contraseña:', error);
            throw this.handleAuthError(error);
        }
    }

    async sendPasswordResetEmail(email) {
        try {
            await firebaseSendPasswordResetEmail(auth, email);
            console.log('Email de recuperación enviado a:', email);
        } catch (error) {
            console.error('Error al enviar email de recuperación:', error);
            throw this.handleAuthError(error);
        }
    }

    async getToken() {
        if (!this.firebaseUser) {
            return null;
        }

        try {
            this.authToken = await this.firebaseUser.getIdToken(true);
            return this.authToken;
        } catch (error) {
            console.error('Error obteniendo token:', error);
            return null;
        }
    }

    isAuthenticated() {
        const hasFirebaseUser = this.firebaseUser !== null;
        const hasBackendUser = this.currentUser !== null;
        const hasToken = this.authToken !== null;

        console.log('Verificando autenticación:', {
            firebaseUser: hasFirebaseUser,
            backendUser: hasBackendUser,
            token: hasToken,
            result: hasFirebaseUser && hasBackendUser
        });

        return hasFirebaseUser && hasBackendUser;
    }

    getCurrentUser() {
        if (this.currentUser) {
            return this.currentUser;
        }

        const storedUser = StorageUtils.load(USER_KEY);
        if (storedUser) {
            this.currentUser = storedUser;
            console.log('Usuario recuperado de localStorage:', storedUser.email);
            return storedUser;
        }

        console.warn('No hay usuario actual disponible');
        return null;
    }

    hasRole(rol) {
        return this.currentUser?.rol === rol;
    }

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
 * @returns {Promise<boolean>}
 */
    waitForAuth() {
        return new Promise((resolve) => {
            console.log('Esperando a Firebase Auth...');

            let resolved = false;

            const timeout = setTimeout(() => {
                if (!resolved) {
                    console.warn('Timeout esperando Firebase Auth');
                    resolved = true;
                    unsubscribe();
                    resolve(false);
                }
            }, 8000);

            const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
                if (resolved) return;

                console.log('onAuthStateChanged disparado:', firebaseUser ? firebaseUser.email : 'sin usuario');

                if (firebaseUser) {
                    console.log('Usuario Firebase detectado:', firebaseUser.email);
                    this.firebaseUser = firebaseUser;

                    try {
                        this.authToken = await firebaseUser.getIdToken();
                        console.log('Token obtenido');

                        await this.syncUserWithBackend();
                        console.log('Usuario sincronizado con backend');

                        clearTimeout(timeout);
                        resolved = true;
                        unsubscribe();
                        resolve(true);

                    } catch (error) {
                        console.error('Error sincronizando con backend:', error);

                        if (error.message.includes('Usuario no encontrado') || error.message.includes('404')) {
                            console.warn('Usuario no existe en backend, cerrando sesión...');
                            await this.logout();
                        }

                        clearTimeout(timeout);
                        resolved = true;
                        unsubscribe();
                        resolve(false);
                    }

                } else {
                    console.log('No hay usuario en Firebase');

                    const storedUser = StorageUtils.load(USER_KEY);
                    if (storedUser) {
                        console.warn('Limpiando usuario de localStorage (sesión caducada)');
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

const authServiceInstance = new AuthService();
export default authServiceInstance;
