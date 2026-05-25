import { StorageUtils } from '../utils/storage.utils.js';
import { ValidatorUtils } from '../utils/validator.utils.js';
import { showSuccessNotification, showErrorNotification } from '../utils/api.utils.js';
import AuthService from '../services/auth.service.js';
import UserService from '../services/user.service.js';

export class SettingsView {
    constructor(router) {
        this.router = router;
        this.user = AuthService.getCurrentUser();
        this.isAdmin = this.user?.rol === 'ADMINISTRADOR';
        this.hasUserManagement = this.user?.rol === 'ADMINISTRADOR' || this.user?.rol === 'DIRAC';
        this.users = [];
    }

    async render() {
        setTimeout(() => this.loadData(), 0);

        return `
            <div class="page-title" style="text-align: center; margin-bottom: 30px;">
                <h2 style="margin: 0; font-family: 'Outfit', sans-serif; font-weight: 700; background: linear-gradient(135deg, var(--primary-color), var(--secondary-color)); -webkit-background-clip: text; -webkit-text-fill-color: transparent;">Ajustes de Cuenta</h2>
                <p style="color: var(--secondary-text); margin-top: 8px;">Gestiona tu perfil y configuraciones de seguridad.</p>
            </div>
            <div id="settings-content" style="display: flex; flex-direction: column; gap: 24px;">
            </div>
        `;
    }

    async loadData() {
        try {
            const container = document.getElementById('settings-content');
            if (!container) return;

            this.renderContent(container);

            if (this.hasUserManagement) {
                await this.loadUsers();
            }

            this.attachEvents();
        } catch (error) {
            console.error('Error cargando configuración:', error);
            showErrorNotification('Error al cargar la configuración');
        }
    }

    async loadUsers() {
        try {
            this.users = await UserService.getProfesores();
            this.renderUserTable();
        } catch (error) {
            console.error('Error cargando profesores:', error);
            this.users = [];
        }
    }

    renderContent(container) {
        let adminContent = '';
        if (this.hasUserManagement) {
            adminContent = this.renderUserManagement();
        }

        container.innerHTML = `
            ${this.renderPasswordChange()}
            ${adminContent}
        `;
    }

    renderUserManagement() {
        const activeRole = this.user?.rol;
        const showAddBtn = activeRole === 'ADMINISTRADOR';

        return `
            <div class="config-section" style="background: var(--card-bg); border: 1px solid var(--card-border); border-radius: var(--radius-lg); padding: 24px; box-shadow: var(--shadow-sm);">
                <div class="section-header" style="display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid var(--card-border); padding-bottom: 15px; margin-bottom: 20px;">
                    <div style="display: flex; align-items: center; gap: 12px;">
                        <span style="font-size: 20px;">👥</span>
                        <h3 class="section-title" style="margin: 0; font-size: 18px; font-weight: 600; color: var(--text-color);">Gestión de Roles de Usuarios</h3>
                    </div>
                    ${showAddBtn ? `
                    <button id="add-user-btn" class="btn btn-primary" style="padding: 8px 16px; font-weight: 600; border-radius: var(--radius-md);">
                        + Agregar Usuario
                    </button>
                    ` : ''}
                </div>
                <div id="users-table-container">
                    <p style="text-align: center; color: var(--secondary-text);">Cargando usuarios...</p>
                </div>
            </div>
        `;
    }

    renderPasswordChange() {
        const eyeIconHTML = `
            <svg class="eye-open" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
            <svg class="eye-closed" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display: none;"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>
        `;

        return `
            <div class="config-section" style="background: var(--card-bg); border: 1px solid var(--card-border); border-radius: var(--radius-lg); padding: 24px; box-shadow: var(--shadow-sm);">
                <div class="section-header" style="display: flex; align-items: center; gap: 12px; border-bottom: 1px solid var(--card-border); padding-bottom: 15px; margin-bottom: 20px;">
                    <span style="font-size: 20px;">🔑</span>
                    <h3 class="section-title" style="margin: 0; font-size: 18px; font-weight: 600; color: var(--text-color);">Cambiar mi contraseña</h3>
                </div>
                <div id="change-password-form">
                    <div style="max-width: 480px; display: flex; flex-direction: column; gap: 16px;">
                        <div>
                            <label style="display: block; margin-bottom: 8px; font-weight: 600; color: var(--text-color);">Contraseña actual</label>
                            <div style="position: relative;">
                                <input type="password" id="current-password" class="form-control" style="width: 100%; padding-right: 40px; border-radius: var(--radius-md);">
                                <button type="button" class="toggle-password-btn" data-target="current-password" style="position: absolute; right: 10px; top: 50%; transform: translateY(-50%); background: none; border: none; cursor: pointer; color: var(--secondary-text);">${eyeIconHTML}</button>
                            </div>
                        </div>
                        <div>
                            <label style="display: block; margin-bottom: 8px; font-weight: 600; color: var(--text-color);">Nueva contraseña</label>
                            <div style="position: relative;">
                                <input type="password" id="new-password" class="form-control" style="width: 100%; padding-right: 40px; border-radius: var(--radius-md);">
                                <button type="button" class="toggle-password-btn" data-target="new-password" style="position: absolute; right: 10px; top: 50%; transform: translateY(-50%); background: none; border: none; cursor: pointer; color: var(--secondary-text);">${eyeIconHTML}</button>
                            </div>
                            <small style="color: var(--secondary-text); font-size: 12.5px; display: block; margin-top: 4px;">Mínimo 8 caracteres, una mayúscula, un número y un carácter especial.</small>
                        </div>
                        <div>
                            <label style="display: block; margin-bottom: 8px; font-weight: 600; color: var(--text-color);">Confirmar nueva contraseña</label>
                            <div style="position: relative;">
                                <input type="password" id="new-password-confirm" class="form-control" style="width: 100%; padding-right: 40px; border-radius: var(--radius-md);">
                                <button type="button" class="toggle-password-btn" data-target="new-password-confirm" style="position: absolute; right: 10px; top: 50%; transform: translateY(-50%); background: none; border: none; cursor: pointer; color: var(--secondary-text);">${eyeIconHTML}</button>
                            </div>
                        </div>
                        <div style="margin-top: 8px;">
                            <button id="change-password-btn" class="btn btn-primary" style="padding: 10px 20px; font-weight: 600; border-radius: var(--radius-md);">
                                Actualizar Contraseña
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    renderUserTable() {
        const container = document.getElementById('users-table-container');
        if (!container) return;

        if (this.users.length === 0) {
            container.innerHTML = '<p style="text-align: center; color: var(--secondary-text);">No hay usuarios registrados.</p>';
            return;
        }

        const activeRole = this.user?.rol;
        const isAdminSession = activeRole === 'ADMINISTRADOR';

        container.innerHTML = `
            <div class="table-responsive" style="margin-top: 15px; overflow-x: auto;">
                <table style="width: 100%; border-collapse: collapse; min-width: 900px;">
                    <thead>
                        <tr style="border-bottom: 2px solid var(--card-border); text-align: left; color: var(--secondary-text);">
                            <th style="padding: 12px; font-weight: 600; width: 220px;">Nombre</th>
                            <th style="padding: 12px; font-weight: 600; width: 220px;">Email</th>
                            <th style="padding: 12px; font-weight: 600; text-align: center; width: 90px;">Profesor</th>
                            <th style="padding: 12px; font-weight: 600; text-align: center; width: 100px;">Docente CIAC</th>
                            <th style="padding: 12px; font-weight: 600; text-align: center; width: 100px;">Dir. Escuela</th>
                            <th style="padding: 12px; font-weight: 600; text-align: center; width: 100px;">Comité Acad.</th>
                            <th style="padding: 12px; font-weight: 600; text-align: center; width: 90px;">DIRAC</th>
                            ${isAdminSession ? `<th style="padding: 12px; font-weight: 600; text-align: center; width: 90px;">Admin</th>` : ''}
                        </tr>
                    </thead>
                    <tbody>
                        ${this.users.map(rowUser => {
                            const isSelf = rowUser.email.toLowerCase().trim() === this.user?.email?.toLowerCase().trim();
                            const hasAdminRole = rowUser.roles.includes('ADMINISTRADOR');
                            const isDisabledRow = !isAdminSession && hasAdminRole;

                            return `
                            <tr style="border-bottom: 1px solid var(--card-border); transition: background-color 0.2s ease; ${isDisabledRow ? 'opacity: 0.6;' : ''}">
                                <td style="padding: 12px; color: var(--text-color); font-weight: 500;">
                                    ${rowUser.nombre}
                                    ${isSelf ? ' <span style="font-style: italic; color: var(--secondary-text); font-size: 11px;">(Tú)</span>' : ''}
                                </td>
                                <td style="padding: 12px; color: var(--secondary-text); font-size: 13px;">${rowUser.email}</td>
                                
                                <td style="padding: 12px; text-align: center;">
                                    <input type="checkbox" class="role-checkbox" data-email="${rowUser.email}" data-nombre="${rowUser.nombre}" data-role="PROFESOR" 
                                           ${rowUser.roles.includes('PROFESOR') ? 'checked' : ''} 
                                           ${isDisabledRow ? 'disabled' : ''}>
                                </td>
                                <td style="padding: 12px; text-align: center;">
                                    <input type="checkbox" class="role-checkbox" data-email="${rowUser.email}" data-nombre="${rowUser.nombre}" data-role="DOCENTE_CIAC" 
                                           ${rowUser.roles.includes('DOCENTE_CIAC') ? 'checked' : ''} 
                                           ${isDisabledRow ? 'disabled' : ''}>
                                </td>
                                <td style="padding: 12px; text-align: center;">
                                    <input type="checkbox" class="role-checkbox" data-email="${rowUser.email}" data-nombre="${rowUser.nombre}" data-role="DIRECTOR_ESCUELA" 
                                           ${rowUser.roles.includes('DIRECTOR_ESCUELA') ? 'checked' : ''} 
                                           ${isDisabledRow ? 'disabled' : ''}>
                                </td>
                                <td style="padding: 12px; text-align: center;">
                                    <input type="checkbox" class="role-checkbox" data-email="${rowUser.email}" data-nombre="${rowUser.nombre}" data-role="COMITE_ACADEMICO" 
                                           ${rowUser.roles.includes('COMITE_ACADEMICO') ? 'checked' : ''} 
                                           ${isDisabledRow ? 'disabled' : ''}>
                                </td>
                                <td style="padding: 12px; text-align: center;">
                                    <input type="checkbox" class="role-checkbox" data-email="${rowUser.email}" data-nombre="${rowUser.nombre}" data-role="DIRAC" 
                                           ${rowUser.roles.includes('DIRAC') ? 'checked' : ''} 
                                           ${isDisabledRow ? 'disabled' : ''}>
                                </td>
                                ${isAdminSession ? `
                                <td style="padding: 12px; text-align: center;">
                                    <input type="checkbox" class="role-checkbox" data-email="${rowUser.email}" data-nombre="${rowUser.nombre}" data-role="ADMINISTRADOR" 
                                           ${hasAdminRole ? 'checked' : ''} 
                                           ${isSelf ? 'disabled' : ''}>
                                </td>
                                ` : ''}
                            </tr>
                            `;
                        }).join('')}
                    </tbody>
                </table>
            </div>
            <div style="margin-top: 15px; font-size: 13px; color: var(--secondary-text); display: flex; align-items: center; gap: 8px;">
                <span style="font-size: 16px;">ℹ️</span>
                <span>Desmarcar todos los roles de un usuario eliminará su cuenta del sistema automáticamente. Las casillas se actualizan en tiempo real.</span>
            </div>
        `;

        document.querySelectorAll('.role-checkbox').forEach(cb => {
            cb.addEventListener('change', async (e) => {
                const target = e.currentTarget;
                const email = target.dataset.email;
                const nombre = target.dataset.nombre;
                
                const rowCheckboxes = document.querySelectorAll(`.role-checkbox[data-email="${email}"]`);
                const checkedRoles = Array.from(rowCheckboxes)
                                           .filter(c => c.checked)
                                           .map(c => c.dataset.role);

                if (checkedRoles.length === 0) {
                    const confirmDelete = confirm(`Has desmarcado todos los roles de ${nombre}. Esto eliminará su acceso y cuenta del sistema.\n\n¿Deseas continuar?`);
                    if (!confirmDelete) {
                        target.checked = !target.checked;
                        return;
                    }
                }

                try {
                    rowCheckboxes.forEach(c => c.disabled = true);
                    const response = await UserService.updateUserRoles(email, nombre, checkedRoles);
                    showSuccessNotification(response.message || 'Roles actualizados correctamente');
                    await this.loadUsers();
                } catch (error) {
                    console.error('Error al actualizar roles:', error);
                    showErrorNotification(error.message || 'Error al actualizar roles');
                    await this.loadUsers();
                }
            });
        });
    }

    showAddUserModal() {
        const modal = document.createElement('div');
        modal.id = 'add-user-modal';
        modal.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0, 0, 0, 0.6);
            backdrop-filter: blur(4px);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 9999;
        `;

        modal.innerHTML = `
            <div style="background: var(--card-bg); padding: 30px; border-radius: var(--radius-lg); max-width: 500px; width: 90%; box-shadow: var(--shadow-lg); border: 1px solid var(--card-border);">
                <h3 style="margin: 0 0 20px 0; color: var(--text-color); font-family: 'Outfit', sans-serif; font-weight: 700;">Agregar Nuevo Usuario</h3>
                
                <div style="margin-bottom: 16px;">
                    <label style="display: block; margin-bottom: 8px; font-weight: 600; color: var(--text-color);">Email institucional</label>
                    <input type="email" id="new-user-email" class="form-control" placeholder="nombre@universidad.edu" style="width: 100%; border-radius: var(--radius-md);">
                </div>

                <div style="margin-bottom: 16px;">
                    <label style="display: block; margin-bottom: 8px; font-weight: 600; color: var(--text-color);">Nombre completo</label>
                    <input type="text" id="new-user-name" class="form-control" placeholder="Nombre completo" style="width: 100%; border-radius: var(--radius-md);">
                </div>

                <div style="margin-bottom: 16px;">
                    <label style="display: block; margin-bottom: 8px; font-weight: 600; color: var(--text-color);">Rol</label>
                    <select id="new-user-role" class="form-control" style="width: 100%; border-radius: var(--radius-md);">
                        <option value="PROFESOR">Profesor</option>
                        <option value="DOCENTE_CIAC">Docente CIAC</option>
                        <option value="DIRECTOR_ESCUELA">Director de Escuela</option>
                        <option value="COMITE_ACADEMICO">Comité Académico</option>
                        <option value="DIRAC">DIRAC</option>
                        <option value="ADMINISTRADOR">Administrador</option>
                    </select>
                </div>

                <div style="margin-bottom: 16px;">
                    <label style="display: block; margin-bottom: 8px; font-weight: 600; color: var(--text-color);">Contraseña inicial</label>
                    <div style="position: relative;">
                        <input type="password" id="new-user-password" class="form-control" placeholder="Mínimo 8 caracteres" style="width: 100%; padding-right: 40px; border-radius: var(--radius-md);">
                        <button type="button" class="toggle-password-btn" data-target="new-user-password" style="position: absolute; right: 10px; top: 50%; transform: translateY(-50%); background: none; border: none; cursor: pointer; color: var(--secondary-text);">
                            <svg class="eye-open" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
                            <svg class="eye-closed" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display: none;"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>
                        </button>
                    </div>
                    <small style="color: var(--secondary-text); font-size: 11.5px; display: block; margin-top: 4px;">Debe tener al menos 8 caracteres, una mayúscula, un número y un símbolo especial.</small>
                </div>

                <div style="margin-bottom: 24px;">
                    <label style="display: block; margin-bottom: 8px; font-weight: 600; color: var(--text-color);">Confirmar contraseña</label>
                    <div style="position: relative;">
                        <input type="password" id="new-user-password-confirm" class="form-control" placeholder="Repite la contraseña" style="width: 100%; padding-right: 40px; border-radius: var(--radius-md);">
                        <button type="button" class="toggle-password-btn" data-target="new-user-password-confirm" style="position: absolute; right: 10px; top: 50%; transform: translateY(-50%); background: none; border: none; cursor: pointer; color: var(--secondary-text);">
                            <svg class="eye-open" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
                            <svg class="eye-closed" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display: none;"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>
                        </button>
                    </div>
                </div>

                <div style="display: flex; gap: 12px; justify-content: flex-end;">
                    <button id="cancel-add-user" class="btn btn-secondary" style="padding: 8px 16px; border-radius: var(--radius-md);">Cancelar</button>
                    <button id="confirm-add-user" class="btn btn-primary" style="padding: 8px 16px; border-radius: var(--radius-md);">Crear Usuario</button>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        modal.querySelectorAll('.toggle-password-btn').forEach(btn => {
            btn.addEventListener('click', function () {
                const targetId = this.dataset.target;
                const passwordInput = modal.querySelector(`#${targetId}`);
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

        document.getElementById('cancel-add-user').onclick = () => {
            document.body.removeChild(modal);
        };

        document.getElementById('confirm-add-user').onclick = async () => {
            const email = document.getElementById('new-user-email').value.trim();
            const nombre = document.getElementById('new-user-name').value.trim();
            const rol = document.getElementById('new-user-role').value;
            const password = document.getElementById('new-user-password').value;
            const passwordConfirm = document.getElementById('new-user-password-confirm').value;

            if (!email || !nombre || !password || !passwordConfirm) {
                showErrorNotification('Por favor completa todos los campos');
                return;
            }

            if (!ValidatorUtils.isValidName(nombre)) {
                showErrorNotification('El nombre solo debe contener letras y espacios');
                return;
            }

            if (!ValidatorUtils.isValidEmail(email)) {
                showErrorNotification('Por favor ingresa un email válido');
                return;
            }

            if (!ValidatorUtils.isValidStrongPassword(password)) {
                showErrorNotification('La contraseña debe tener al menos 8 caracteres, una mayúscula, una minúscula, un número y un carácter especial');
                return;
            }

            if (password !== passwordConfirm) {
                showErrorNotification('Las contraseñas no coinciden');
                return;
            }

            try {
                await UserService.create({ email, nombre, rol, password });
                showSuccessNotification('Usuario creado correctamente');
                document.body.removeChild(modal);
                await this.loadUsers();
            } catch (error) {
                showErrorNotification(error.message || 'Error al crear usuario');
            }
        };

        const handleEsc = (e) => {
            if (e.key === 'Escape' && document.body.contains(modal)) {
                document.body.removeChild(modal);
                document.removeEventListener('keydown', handleEsc);
            }
        };
        document.addEventListener('keydown', handleEsc);
    }

    async deleteUser(userId, userName) {
        if (!confirm(`¿Estás seguro de eliminar al usuario "${userName}"?\n\nEsta acción no se puede deshacer.`)) {
            return;
        }

        try {
            await UserService.delete(userId);
            showSuccessNotification('Usuario eliminado correctamente');
            await this.loadUsers();
        } catch (error) {
            showErrorNotification(error.message || 'Error al eliminar usuario');
        }
    }

    attachEvents() {
        const addUserBtn = document.getElementById('add-user-btn');
        if (addUserBtn) {
            addUserBtn.addEventListener('click', () => this.showAddUserModal());
        }

        const changePasswordBtn = document.getElementById('change-password-btn');
        if (changePasswordBtn) {
            changePasswordBtn.addEventListener('click', async () => {
                const currentPassword = document.getElementById('current-password').value;
                const newPassword = document.getElementById('new-password').value;
                const newPasswordConfirm = document.getElementById('new-password-confirm').value;

                if (!currentPassword || !newPassword || !newPasswordConfirm) {
                    showErrorNotification('Por favor completa todos los campos de contraseña.');
                    return;
                }

                if (newPassword !== newPasswordConfirm) {
                    showErrorNotification('Las nuevas contraseñas no coinciden.');
                    return;
                }

                if (!ValidatorUtils.isValidStrongPassword(newPassword)) {
                    showErrorNotification('La nueva contraseña no cumple los requisitos de seguridad.');
                    return;
                }

                try {
                    await AuthService.updatePassword(currentPassword, newPassword);
                    showSuccessNotification('Contraseña actualizada correctamente.');
                    document.getElementById('current-password').value = '';
                    document.getElementById('new-password').value = '';
                    document.getElementById('new-password-confirm').value = '';
                } catch (error) {
                    showErrorNotification(error.message || 'Error al actualizar la contraseña.');
                }
            });
        }

        const passwordToggles = document.querySelectorAll('#change-password-form .toggle-password-btn');
        passwordToggles.forEach(btn => {
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
    }
}
