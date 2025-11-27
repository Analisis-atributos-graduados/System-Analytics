import { StorageUtils } from '../utils/storage.utils.js';
import { showSuccessNotification, showErrorNotification } from '../utils/api.utils.js';
import AuthService from '../services/auth.service.js';
import { CursoService } from '../services/curso.service.js';
import { MetaPorcentajeService } from '../services/meta-porcentaje.service.js';

/**
 * Vista de configuración del sistema.
 * Muestra la meta de aprobación y la gestión de cursos.
 * Incluye un botón global "Guardar Cambios" que persiste todas las modificaciones.
 */
export class SettingsView {
    constructor(router) {
        this.router = router;
        this.user = AuthService.getCurrentUser();
        this.isQuality = this.user?.rol === 'AREA_CALIDAD';
        this.courses = [];
        this.metaPorcentaje = 80;
        this.changedCourses = new Map(); // Track course changes: id -> new estado
    }

    /** Renderiza la estructura básica y dispara la carga de datos */
    async render() {
        // Insertar el HTML y luego cargar datos en segundo plano
        setTimeout(() => this.loadData(), 0);
        return `
            <style>
                /* Estilos específicos para el switch */
                .switch {
                    position: relative;
                    display: inline-block;
                    width: 50px;
                    height: 24px;
                }
                .switch input {
                    opacity: 0;
                    width: 0;
                    height: 0;
                }
                .slider {
                    position: absolute;
                    cursor: pointer;
                    top: 0;
                    left: 0;
                    right: 0;
                    bottom: 0;
                    background-color: #ccc;
                    transition: .4s;
                    border-radius: 34px;
                }
                .slider:before {
                    position: absolute;
                    content: "";
                    height: 16px;
                    width: 16px;
                    left: 4px;
                    bottom: 4px;
                    background-color: white;
                    transition: .4s;
                    border-radius: 50%;
                }
                input:checked + .slider {
                    background-color: var(--primary-color, #667eea);
                }
                input:checked + .slider:before {
                    transform: translateX(26px);
                }
                .config-section {
                    margin-bottom: 20px;
                    background: var(--card-bg);
                    border: 1px solid var(--card-border);
                    border-radius: var(--radius-lg);
                    padding: 24px;
                }
                .section-header {
                    display: flex;
                    justify-content: flex-start; /* Alineado a la izquierda */
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
                .course-item {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding: 12px;
                    border-bottom: 1px solid var(--card-border);
                }
                .course-item:last-child {
                    border-bottom: none;
                }
            </style>

            <div class="page-title">
                <h2>Configuración del sistema</h2>
            </div>
            <p class="page-subtitle">Ajusta los parámetros de evaluación y revisa la configuración del curso.</p>
            <div id="settings-content">
                <div class="loading-spinner">Cargando configuración...</div>
            </div>
            <button id="global-save-btn" class="btn btn-primary" style="margin-top: 20px;">Guardar Cambios</button>
        `;
    }

    /** Carga cursos y meta de porcentaje en paralelo */
    async loadData() {
        try {
            const container = document.getElementById('settings-content');
            if (!container) return;
            const [courses, metaData] = await Promise.all([
                this.isQuality ? CursoService.getAll() : CursoService.getEnabled(),
                MetaPorcentajeService.get()
            ]);
            this.courses = courses;
            this.metaPorcentaje = metaData.porcentaje;
            this.changedCourses.clear(); // Reset changes
            this.renderContent(container);
            this.attachEvents();
        } catch (error) {
            console.error('Error cargando configuración:', error);
            showErrorNotification('Error al cargar la configuración');
            const container = document.getElementById('settings-content');
            if (container) container.innerHTML = '<p class="error-text">No se pudo cargar la configuración.</p>';
        }
    }

    /** Inserta el HTML de la meta y la gestión de cursos */
    renderContent(container) {
        container.innerHTML = `
            ${this.renderGoalConfig()}
            ${this.renderCourseManagement()}
        `;
    }

    /** Renderiza la sección de meta de aprobación */
    renderGoalConfig() {
        const disabled = !this.isQuality ? 'disabled' : '';
        const helpText = this.isQuality
            ? 'Define el porcentaje mínimo para considerar un criterio como aprobado.'
            : 'Este valor es definido por el Área de Calidad.';
        return `
            <div class="config-section">
                <div class="section-header">
                    <div class="section-icon">🎯</div>
                    <h3 class="section-title">Meta de Aprobación</h3>
                </div>
                <div class="config-item">
                    <span class="config-label">Porcentaje objetivo</span>
                    <div style="display: flex; flex-direction: column; gap: 5px;">
                        <div style="display: flex; align-items: center; gap: 10px;">
                            <input type="number" id="goal-input" value="${this.metaPorcentaje}" min="0" max="100" class="form-control" style="width: 100px;">
                            <span>%</span>
                        </div>
                        <small class="text-muted">${helpText}</small>
                    </div>
                </div>
            </div>
        `;
    }

    /** Renderiza la sección de gestión de cursos */
    renderCourseManagement() {
        const title = this.isQuality ? 'Gestión de Cursos' : 'Cursos Habilitados';
        return `
            <div class="config-section">
                <div class="section-header">
                    <div class="section-icon">📚</div>
                    <h3 class="section-title">${title}</h3>
                </div>
                <div class="config-item">
                    ${this.courses.length === 0 ? '<p>No hay cursos disponibles.</p>' : ''}
                    <div class="course-list">
                        ${this.courses.map(c => this.renderCourseItem(c)).join('')}
                    </div>
                </div>
            </div>
        `;
    }

    /** Renderiza un curso individual */
    renderCourseItem(curso) {
        if (this.isQuality) {
            return `
                <div class="course-item" data-id="${curso.id}">
                    <div class="course-info">
                        <strong>${curso.nombre}</strong>
                    </div>
                    <div class="course-actions">
                        <label class="switch">
                            <input type="checkbox" class="toggle-course" data-id="${curso.id}" ${curso.habilitado ? 'checked' : ''}>
                            <span class="slider round"></span>
                        </label>
                    </div>
                </div>
            `;
        } else {
            return `
                <div class="checklist-item">
                    <span class="checked-text">✅ ${curso.nombre}</span>
                </div>
            `;
        }
    }

    /** Guarda la meta y los cambios de cursos en una única acción */
    async saveAllChanges() {
        // Validate meta percentage
        const input = document.getElementById('goal-input');
        const nuevoPorcentaje = parseInt(input.value);
        if (isNaN(nuevoPorcentaje) || nuevoPorcentaje < 0 || nuevoPorcentaje > 100) {
            showErrorNotification('El porcentaje debe estar entre 0 y 100');
            return;
        }

        const updates = [];

        try {
            // Update meta if quality user
            if (this.isQuality) {
                updates.push(
                    MetaPorcentajeService.update(nuevoPorcentaje)
                        .then(() => ({ type: 'meta', success: true }))
                        .catch(error => ({ type: 'meta', success: false, error }))
                );
            }

            // Update all changed courses
            for (const [id, newStatus] of this.changedCourses.entries()) {
                updates.push(
                    CursoService.toggleStatus(id)
                        .then(() => ({ type: 'course', id, success: true }))
                        .catch(error => ({ type: 'course', id, success: false, error }))
                );
            }

            if (updates.length === 0) {
                showErrorNotification('No hay cambios para guardar');
                return;
            }

            // Execute all updates in parallel
            const results = await Promise.all(updates);

            // Check results
            const failures = results.filter(r => !r.success);

            if (failures.length === 0) {
                showSuccessNotification('Cambios guardados correctamente');
                // Clear changed courses and reload data
                this.changedCourses.clear();
                await this.loadData();
            } else {
                const metaFailed = failures.some(f => f.type === 'meta');
                const courseFailed = failures.some(f => f.type === 'course');

                let errorMsg = 'Error al guardar: ';
                if (metaFailed && courseFailed) {
                    errorMsg += 'meta de aprobación y algunos cursos';
                } else if (metaFailed) {
                    errorMsg += 'meta de aprobación';
                } else {
                    errorMsg += 'algunos cursos';
                }
                showErrorNotification(errorMsg);
            }
        } catch (error) {
            showErrorNotification('Error al guardar los cambios');
            console.error(error);
        }
    }

    /** Valida el input del porcentaje objetivo en tiempo real, previniendo valores incorrectos */
    validateGoalInput(event) {
        const input = event.target;
        let value = input.value;

        // 1. Eliminar cualquier caracter que no sea un dígito
        value = value.replace(/[^0-9]/g, '');

        // 2. Si después de limpiar no queda nada, dejar el campo vacío
        if (value === '') {
            input.value = '';
            return;
        }

        // 3. Convertir a número para eliminar ceros a la izquierda y validar el rango
        let numValue = parseInt(value, 10);

        // 4. Asegurarse de que el valor no exceda 100
        if (numValue > 100) {
            numValue = 100;
        }

        // 5. Actualizar el valor del input. Esto corrige los ceros a la izquierda y valores > 100.
        // Solo se actualiza si es estrictamente necesario para no mover el cursor.
        if (String(numValue) !== input.value) {
            input.value = numValue;
        }
    }

    /** Asocia eventos a los elementos de la vista */
    attachEvents() {
        // Guardar todos los cambios al pulsar el botón global
        const globalSaveBtn = document.getElementById('global-save-btn');
        if (globalSaveBtn) {
            globalSaveBtn.addEventListener('click', () => this.saveAllChanges());
        }

        // Live validation for goal input
        const goalInput = document.getElementById('goal-input');
        if (goalInput) {
            goalInput.addEventListener('input', this.validateGoalInput.bind(this));
        }

        // Sólo calidad puede modificar cursos (toggle) - pero no guardar inmediatamente
        if (this.isQuality) {
            document.querySelectorAll('.toggle-course').forEach(toggle => {
                toggle.addEventListener('change', e => {
                    const id = parseInt(e.target.dataset.id);
                    const newStatus = e.target.checked;

                    // Find the original course
                    const course = this.courses.find(c => c.id === id);
                    if (course) {
                        // Only track if changed from original
                        if (course.habilitado !== newStatus) {
                            this.changedCourses.set(id, newStatus);
                        }
                    } else {
                        this.changedCourses.delete(id);
                    }
                });
            });
        }
    }
}