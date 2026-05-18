import { StorageUtils } from '../utils/storage.utils.js';
import { ValidatorUtils } from '../utils/validator.utils.js';
import { showSuccessNotification, showErrorNotification } from '../utils/api.utils.js';
import AuthService from '../services/auth.service.js';
import { CursoService } from '../services/curso.service.js';
import { MetaPorcentajeService } from '../services/meta-porcentaje.service.js';
import ApiService from '../services/api.service.js';
import UserService from '../services/user.service.js';

export class SettingsView {
    constructor(router) {
        this.router = router;
        this.user = AuthService.getCurrentUser();
        this.isQuality = this.user?.rol === 'AREA_CALIDAD';
        this.courses = [];
        this.metaPorcentaje = 80;

        this.users = [];

        this.attributes = Array.from({ length: 12 }, (_, i) => ({
            codigo: `AG-${String(i + 1).padStart(2, '0')}`,
            nombre: `Atributo de Graduado ${i + 1}`
        }));

        this.attributeMapping = new Map();
    }

    async render() {
        setTimeout(() => this.loadData(), 0);

        const pageSubtitle = this.isQuality
            ? 'Arrastra los cursos desde el panel izquierdo a los atributos. Un curso puede estar en múltiples atributos.'
            : 'Gestiona la configuración de tu cuenta.';

        return `
            <style>
                .config-section {
                    margin-bottom: 20px;
                    background: var(--card-bg);
                    border: 1px solid var(--card-border);
                    border-radius: var(--radius-lg);
                    padding: 24px;
                }
                .section-header {
                    display: flex;
                    align-items: center;
                    gap: 12px;
                    margin-bottom: 20px;
                    border-bottom: 1px solid var(--card-border);
                    padding-bottom: 15px;
                }
                .section-title {
                    font-size: 18px;
                    font-weight: 600;
                    color: var(--text-color);
                    margin: 0;
                }

                /* Drag and Drop Styles */
                .dnd-container {
                    display: flex;
                    gap: 24px;
                    align-items: flex-start;
                }

                .pool-section {
                    flex: 1;
                    min-width: 250px;
                    background: var(--input-bg);
                    border: 1px solid var(--card-border);
                    border-radius: var(--radius-md);
                    padding: 16px;
                    position: sticky;
                    top: 20px;
                    max-height: 80vh;
                    overflow-y: auto;
                }

                .attributes-section {
                    flex: 3;
                    display: grid;
                    grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
                    gap: 16px;
                }

                .drop-zone {
                    min-height: 100px;
                    background: var(--bg-color);
                    border: 2px dashed var(--card-border);
                    border-radius: var(--radius-sm);
                    padding: 10px;
                    transition: all 0.2s ease;
                }

                .drop-zone.drag-over {
                    background: var(--primary-light);
                    border-color: var(--primary-color);
                }

                .attribute-card {
                    background: var(--card-bg);
                    border: 1px solid var(--card-border);
                    border-radius: var(--radius-sm);
                    padding: 16px;
                }

                .attribute-header {
                    font-weight: 700;
                    color: var(--primary-color);
                    margin-bottom: 10px;
                    display: flex;
                    justify-content: space-between;
                }

                .draggable-course {
                    background: var(--card-bg);
                    border: 1px solid var(--card-border);
                    padding: 8px 12px;
                    margin-bottom: 8px;
                    border-radius: 4px;
                    cursor: grab;
                    font-size: 13px;
                    box-shadow: var(--shadow-sm);
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                }

                .draggable-course:active {
                    cursor: grabbing;
                }

                .draggable-course.dragging {
                    opacity: 0.5;
                    border: 1px dashed var(--primary-color);
                }
                
                /* Estilo para cursos en el Pool (Source) */
                .pool-section .draggable-course {
                    border-left: 3px solid var(--secondary-color);
                }

                /* Estilo para cursos asignados */
                .attribute-zone .draggable-course {
                    border-left: 3px solid var(--primary-color);
                }
                
                .remove-btn {
                    cursor: pointer;
                    color: var(--error-color);
                    font-weight: bold;
                    margin-left: 8px;
                    display: none;
                }
                
                .attribute-zone .remove-btn {
                    display: block;
                }

                .pool-header {
                    margin-bottom: 12px;
                    font-weight: 600;
                    color: var(--text-color);
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                }
                
                .badge-count {
                    background: var(--secondary-text);
                    color: white;
                    padding: 2px 6px;
                    border-radius: 10px;
                    font-size: 11px;
                }
            </style>

            <div class="page-title" style="text-align: center; margin-bottom: 30px;">
                <h2 style="margin: 0;">Ajustes</h2>
            </div>
            <div id="settings-content">
            </div>
        `;
    }

    async loadData() {
        try {
            const container = document.getElementById('settings-content');
            if (!container) return;

            const [courses, metaData] = await Promise.all([
                CursoService.getAll(),
                MetaPorcentajeService.get()
            ]);

            this.courses = courses;
            this.metaPorcentaje = metaData.porcentaje;

            this.attributes.forEach(attr => {
                this.attributeMapping.set(attr.codigo, new Set());
            });

            this.courses.forEach(curso => {
                if (curso.atributos && Array.isArray(curso.atributos)) {
                    curso.atributos.forEach(attr => {
                        const code = attr.atributo_codigo || attr;
                        if (this.attributeMapping.has(code)) {
                            this.attributeMapping.get(code).add(curso.id);
                        }
                    });
                }
            });

            if (this.isQuality) {
                await this.loadUsers();
            }

            this.renderContent(container);

            this.attributeMapping.forEach((courseIds, attrCode) => {
                const zone = document.querySelector(`.attribute-zone[data-attr="${attrCode}"]`);
                if (zone) {
                    if (courseIds.size === 0) {
                        zone.innerHTML = '<div class="empty-courses-msg">Sin cursos asignados</div>';
                    } else {
                        courseIds.forEach(courseId => {
                            const course = this.courses.find(c => c.id === courseId);
                            if (course) {
                                zone.insertAdjacentHTML('beforeend', this.renderStaticCourse(course));
                            }
                        });
                    }
                }
            });

            const unassignedZone = document.getElementById('unassigned-courses-zone');
            if (unassignedZone) {
                const assignedCourseIds = new Set();
                this.attributeMapping.forEach((courseIds) => {
                    courseIds.forEach(id => assignedCourseIds.add(id));
                });

                const unassignedCourses = this.courses.filter(c => !assignedCourseIds.has(c.id));

                if (unassignedCourses.length === 0) {
                    unassignedZone.innerHTML = '<span style="font-size: 13px; color: var(--secondary-text); font-style: italic;">Todos los cursos en Supabase están asignados a un AG.</span>';
                } else {
                    unassignedZone.innerHTML = '';
                    unassignedCourses.forEach(course => {
                        unassignedZone.insertAdjacentHTML('beforeend', this.renderStaticCourse(course));
                    });
                }
            }

            this.attachEvents();
        } catch (error) {
            console.error('Error cargando configuración:', error);
            showErrorNotification('Error al cargar la configuración');
        }
    }

    async loadUsers() {
        try {
            this.users = await UserService.getAll();
            setTimeout(() => this.renderUserTable(), 100);
        } catch (error) {
            console.error('Error cargando usuarios:', error);
            this.users = [];
        }
    }

    renderContent(container) {
        let qualityContent = '';
        if (this.isQuality) {
            qualityContent = `
                ${this.renderGoalConfig()}
                ${this.renderUserManagement()}
                ${this.renderDragAndDropInterface()}
            `;
        }

        container.innerHTML = `
            ${this.renderPasswordChange()}
            ${qualityContent}
        `;
    }

    renderGoalConfig() {
        return `
            <div class="config-section">
                <div class="section-header" style="justify-content: flex-start;">
                    <div class="section-icon">🎯</div>
                    <h3 class="section-title">Meta de Aprobación</h3>
                </div>
                <div class="config-item" style="display: flex; align-items: center; justify-content: space-between;">
                    <div>
                        <span class="config-label">Porcentaje objetivo</span>
                        <div style="display: flex; align-items: center; gap: 10px;">
                            <input type="number" id="goal-input" value="${this.metaPorcentaje}" min="0" max="100" class="form-control" style="width: 100px;">
                            <span>%</span>
                        </div>
                    </div>
                    <button id="save-goal-btn" class="btn btn-primary">Guardar Meta</button>
                </div>
            </div>
        `;
    }

    renderUserManagement() {
        if (!this.isQuality) return '';

        return `
            <div class="config-section">
                <div class="section-header">
                    <div class="section-icon">👥</div>
                    <h3 class="section-title">Gestión de Usuarios</h3>
                    <button id="add-user-btn" class="btn btn-primary" style="margin-left: auto;">
                        + Agregar Usuario
                    </button>
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
            <div class="config-section">
                <div class="section-header" style="justify-content: flex-start;">
                    <div class="section-icon">🔑</div>
                    <h3 class="section-title">Cambiar mi contraseña</h3>
                </div>
                <div id="change-password-form">
                    <div style="max-width: 400px; display: flex; flex-direction: column; gap: 16px;">
                        <div>
                            <label style="display: block; margin-bottom: 8px; font-weight: 600;">Contraseña actual</label>
                            <div style="position: relative;">
                                <input type="password" id="current-password" class="form-control" style="width: 100%; padding-right: 40px;">
                                <button type="button" class="toggle-password-btn" data-target="current-password" style="position: absolute; right: 10px; top: 50%; transform: translateY(-50%); background: none; border: none; cursor: pointer; color: var(--secondary-text);">${eyeIconHTML}</button>
                            </div>
                        </div>
                        <div>
                            <label style="display: block; margin-bottom: 8px; font-weight: 600;">Nueva contraseña</label>
                            <div style="position: relative;">
                                <input type="password" id="new-password" class="form-control" style="width: 100%; padding-right: 40px;">
                                <button type="button" class="toggle-password-btn" data-target="new-password" style="position: absolute; right: 10px; top: 50%; transform: translateY(-50%); background: none; border: none; cursor: pointer; color: var(--secondary-text);">${eyeIconHTML}</button>
                            </div>
                            <small style="color: var(--secondary-text); font-size: 12px;">Mínimo 8 caracteres, una mayúscula, un número y un carácter especial.</small>
                        </div>
                        <div>
                            <label style="display: block; margin-bottom: 8px; font-weight: 600;">Confirmar nueva contraseña</label>
                            <div style="position: relative;">
                                <input type="password" id="new-password-confirm" class="form-control" style="width: 100%; padding-right: 40px;">
                                <button type="button" class="toggle-password-btn" data-target="new-password-confirm" style="position: absolute; right: 10px; top: 50%; transform: translateY(-50%); background: none; border: none; cursor: pointer; color: var(--secondary-text);">${eyeIconHTML}</button>
                            </div>
                        </div>
                        <div style="margin-top: 10px;">
                            <button id="change-password-btn" class="btn btn-primary">Cambiar Contraseña</button>
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

        container.innerHTML = `
            <div class="table-responsive">
                <table style="width: 100%; border-collapse: collapse;">
                    <thead>
                        <tr style="border-bottom: 2px solid var(--card-border);">
                            <th style="padding: 12px; text-align: left;">Email</th>
                            <th style="padding: 12px; text-align: left;">Nombre</th>
                            <th style="padding: 12px; text-align: left;">Rol</th>
                            <th style="padding: 12px; text-align: center;">Acciones</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${this.users.map(user => `
                            <tr style="border-bottom: 1px solid var(--card-border);">
                                <td style="padding: 12px;">${user.email}</td>
                                <td style="padding: 12px;">${user.nombre}</td>
                                <td style="padding: 12px;">
                                    <span style="background: ${user.rol === 'AREA_CALIDAD' ? 'var(--primary-color)' : 'var(--secondary-color)'}; color: white; padding: 4px 8px; border-radius: 4px; font-size: 12px;">
                                        ${user.rol === 'AREA_CALIDAD' ? 'Admin' : 'Profesor'}
                                    </span>
                                </td>
                                <td style="padding: 12px; text-align: center;">
                                    ${user.id !== this.user.id ? `
                                        <button class="btn-delete-user" data-user-id="${user.id}" data-user-name="${user.nombre}" style="background: var(--error-color); color: white; border: none; padding: 6px 12px; border-radius: 4px; cursor: pointer;">
                                            Eliminar
                                        </button>
                                    ` : '<span style="color: var(--secondary-text);">Tú</span>'}
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        `;

        document.querySelectorAll('.btn-delete-user').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const userId = parseInt(e.target.dataset.userId);
                const userName = e.target.dataset.userName;
                this.deleteUser(userId, userName);
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
            background: rgba(0, 0, 0, 0.7);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 9999;
        `;

        modal.innerHTML = `
            <div style="background: var(--card-bg); padding: 30px; border-radius: 12px; max-width: 500px; width: 90%; box-shadow: 0 10px 40px rgba(0,0,0,0.3);">
                <h3 style="margin: 0 0 20px 0; color: var(--text-color);">Agregar Nuevo Usuario</h3>
                
                <div style="margin-bottom: 16px;">
                    <label style="display: block; margin-bottom: 8px; font-weight: 600;">Email institucional</label>
                    <input type="email" id="new-user-email" class="form-control" placeholder="profesor@universidad.edu" style="width: 100%;">
                </div>

                <div style="margin-bottom: 16px;">
                    <label style="display: block; margin-bottom: 8px; font-weight: 600;">Nombre completo</label>
                    <input type="text" id="new-user-name" class="form-control" placeholder="Nombre del profesor" style="width: 100%;">
                </div>

                <div style="margin-bottom: 16px;">
                    <label style="display: block; margin-bottom: 8px; font-weight: 600;">Rol</label>
                    <select id="new-user-role" class="form-control" style="width: 100%;">
                        <option value="PROFESOR">Profesor</option>
                        <option value="AREA_CALIDAD">Área de Calidad</option>
                    </select>
                </div>

                <div style="margin-bottom: 16px;">
                    <label style="display: block; margin-bottom: 8px; font-weight: 600;">Contraseña inicial</label>
                    <div style="position: relative;">
                        <input type="password" id="new-user-password" class="form-control" placeholder="Mínimo 8 caracteres" style="width: 100%; padding-right: 40px;">
                        <button type="button" class="toggle-password-btn" data-target="new-user-password" style="position: absolute; right: 10px; top: 50%; transform: translateY(-50%); background: none; border: none; cursor: pointer; color: var(--secondary-text);">
                            <svg class="eye-open" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
                            <svg class="eye-closed" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display: none;"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>
                        </button>
                    </div>
                    <small style="color: var(--secondary-text); font-size: 12px;">Mínimo 8 caracteres, una mayúscula, un número y un carácter especial</small>
                </div>

                <div style="margin-bottom: 24px;">
                    <label style="display: block; margin-bottom: 8px; font-weight: 600;">Confirmar contraseña</label>
                    <div style="position: relative;">
                        <input type="password" id="new-user-password-confirm" class="form-control" placeholder="Repite la contraseña" style="width: 100%; padding-right: 40px;">
                        <button type="button" class="toggle-password-btn" data-target="new-user-password-confirm" style="position: absolute; right: 10px; top: 50%; transform: translateY(-50%); background: none; border: none; cursor: pointer; color: var(--secondary-text);">
                            <svg class="eye-open" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
                            <svg class="eye-closed" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display: none;"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>
                        </button>
                    </div>
                </div>

                <div style="display: flex; gap: 12px; justify-content: flex-end;">
                    <button id="cancel-add-user" class="btn btn-secondary">Cancelar</button>
                    <button id="confirm-add-user" class="btn btn-primary">Crear Usuario</button>
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

    renderDragAndDropInterface() {
        if (!this.isQuality) return '';

        return `
            <div class="config-section">
                <div class="section-header" style="justify-content: flex-start;">
                    <div class="section-icon">📚</div>
                    <h3 class="section-title">Cursos por Atributo de Graduado</h3>
                </div>
                <p style="color: var(--secondary-text); margin-bottom: 24px; font-size: 14px; line-height: 1.5;">
                    Visualización en tiempo real de los cursos asignados a cada Atributo de Graduado (AG).
                </p>
                
                <div style="margin-bottom: 20px; padding: 15px; background: var(--input-bg); border-radius: var(--radius-sm); border: 1px dashed var(--card-border);">
                    <h4 style="margin: 0 0 10px 0; color: var(--secondary-text); font-size: 14px;">Cursos Sin Asignar</h4>
                    <div id="unassigned-courses-zone" style="display: flex; flex-wrap: wrap; gap: 10px;">
                        <span style="font-size: 13px; color: var(--secondary-text); font-style: italic;">Cargando...</span>
                    </div>
                </div>

                <div class="attributes-section-view">
                    ${this.attributes.map(attr => `
                        <div class="attribute-card-view">
                            <div class="attribute-header-view">
                                <span>${attr.codigo}</span>
                                <span style="font-size: 12px; font-weight: normal; color: var(--secondary-text);">${attr.nombre}</span>
                            </div>
                            <div class="course-list-static attribute-zone" data-attr="${attr.codigo}">
                                <!-- Los cursos asignados se renderizan estáticamente aquí -->
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
            
            <style>
                .attributes-section-view {
                    display: grid;
                    grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
                    gap: 20px;
                    margin-top: 15px;
                }
                .attribute-card-view {
                    background: var(--card-bg);
                    border: 1px solid var(--card-border);
                    border-radius: var(--radius-lg);
                    padding: 20px;
                    transition: all 0.2s ease;
                    box-shadow: var(--shadow-sm);
                }
                .attribute-card-view:hover {
                    transform: translateY(-2px);
                    box-shadow: var(--shadow-md);
                    border-color: var(--primary-color);
                }
                .attribute-header-view {
                    font-weight: 700;
                    color: var(--primary-color);
                    margin-bottom: 15px;
                    font-size: 15px;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    border-bottom: 1px solid var(--card-border);
                    padding-bottom: 10px;
                }
                .course-list-static {
                    display: flex;
                    flex-direction: column;
                    gap: 10px;
                    min-height: 40px;
                }
                .course-badge-static {
                    background: var(--input-bg);
                    border: 1px solid var(--card-border);
                    border-left: 4px solid var(--primary-color);
                    padding: 10px 14px;
                    border-radius: var(--radius-sm);
                    font-size: 13.5px;
                    color: var(--text-color);
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    box-shadow: var(--shadow-sm);
                    font-weight: 500;
                }
                .empty-courses-msg {
                    color: var(--secondary-text);
                    font-size: 13px;
                    font-style: italic;
                    text-align: center;
                    padding: 15px 0;
                }
            </style>
        `;
    }

    renderStaticCourse(curso) {
        return `
            <div class="course-badge-static" data-id="${curso.id}">
                <span>📖 ${curso.nombre}</span>
            </div>
        `;
    }

    async _saveConfiguration(payload) {
        try {
            await ApiService.post('/cursos/assign-attributes', payload);
            showSuccessNotification('Configuración de meta guardada correctamente');
        } catch (error) {
            showErrorNotification('Error al guardar la configuración');
            console.error(error);
        }
    }

    _getGoalPayload() {
        const input = document.getElementById('goal-input');
        return parseInt(input.value) || 80;
    }

    async saveGoal() {
        console.log('Guardando meta...');
        const payload = {
            meta: this._getGoalPayload(),
            asignaciones: []
        };
        await this._saveConfiguration(payload);
    }

    validateGoalInput(event) {
        const input = event.target;
        let value = input.value.replace(/[^0-9]/g, '');
        if (value === '') { input.value = ''; return; }
        let numValue = parseInt(value, 10);
        if (numValue > 100) numValue = 100;
        if (String(numValue) !== input.value) input.value = numValue;
    }

    attachEvents() {
        const goalInput = document.getElementById('goal-input');
        if (goalInput) {
            goalInput.addEventListener('input', this.validateGoalInput.bind(this));
        }

        const saveGoalBtn = document.getElementById('save-goal-btn');
        if (saveGoalBtn) {
            saveGoalBtn.addEventListener('click', () => this.saveGoal());
        }

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
