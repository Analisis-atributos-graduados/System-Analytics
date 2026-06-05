import { StorageUtils } from '../utils/storage.utils.js';
import RubricaService from '../services/rubrica.service.js';
import AuthService from '../services/auth.service.js';
import ApiService from '../services/api.service.js';
import { showErrorNotification, showSuccessNotification } from '../utils/api.utils.js';
import { ValidatorUtils } from '../utils/validator.utils.js';
import { StepIndicatorComponent } from '../components/step-indicator.component.js';

export class ConfigurationView {
    constructor(router) {
        this.router = router;
        this.currentStep = 0;
        this.existingRubrics = [];

        const user = AuthService.getCurrentUser();
        if (user && user.rol === 'PROFESOR') {
            localStorage.removeItem('configCompleted');
        }

        this.comiteCreating = false;
        this.comiteEditing = false;

        this.showRejectionForm = false;
        this.comiteSelectedCurso = '';
        this.comiteSelectedNrc = '';
        this.comiteCursos = [];
        this.comiteNrcs = [];
        this.comiteActiveRubric = null;
        this.previewRubricId = null;
        this.configData = (() => {
            const loaded = StorageUtils.load('configData');
            return {
                courseName: loaded?.courseName || '',
                courseCode: loaded?.courseCode || '',
                instructor: loaded?.instructor || '',
                semestre: loaded?.semestre || '',
                topic: loaded?.topic || '',
                descripcion_tema: loaded?.descripcion_tema || '',
                rubrica_id: loaded?.rubrica_id || null,
                curso_id: loaded?.curso_id || null,
                rubrica: loaded?.rubrica || this.getEmptyRubrica()
            };
        })();

        this._loadExistingRubrics();
    }

    getEmptyRubrica() {
        return {
            nombre_rubrica: '',
            descripcion: '',
            criterios: [
                {
                    id: Date.now(),
                    nombre_criterio: '',
                    descripcion_criterio: '',
                    peso: 0.15,
                    orden: 1,
                    niveles: [
                        {
                            id: Date.now() + '_1',
                            nombre_nivel: 'Excelente',
                            puntaje_min: 3,
                            puntaje_max: 3,
                            descriptores: [''],
                            orden: 1
                        },
                        {
                            id: Date.now() + '_2',
                            nombre_nivel: 'Regular',
                            puntaje_min: 1,
                            puntaje_max: 2,
                            descriptores: [''],
                            orden: 2
                        },
                        {
                            id: Date.now() + '_3',
                            nombre_nivel: 'Insuficiente',
                            puntaje_min: 0,
                            puntaje_max: 0,
                            descriptores: [''],
                            orden: 3
                        }
                    ]
                }
            ]
        };
    }

    async _loadExistingRubrics() {
        try {
            const user = AuthService.getCurrentUser();
            const isReviewRole = user && ['COMITE_ACADEMICO', 'DOCENTE_CIAC', 'DIRECTOR_ESCUELA'].includes(user.rol);

            const rubricas = await RubricaService.getAll();
            this.existingRubrics = Array.isArray(rubricas) ? rubricas : [];
            console.log('Rúbricas cargadas:', this.existingRubrics.length);

            if (isReviewRole) {
                const { CursoService } = await import('../services/curso.service.js');
                this.comiteCursos = await CursoService.getAll();
                this.reRender();
            } else {
                if (this.currentStep === 0) {
                    this.updateRubricStatusForCurrentNrc();
                } else if (this.currentStep === 2) {
                    this.reRender();
                }
            }
        } catch (error) {
            console.error('Error cargando rúbricas:', error);
            this.existingRubrics = [];
            if (this.currentStep === 0) {
                this.updateRubricStatusForCurrentNrc();
            }
        }
    }

    updateRubricStatusForCurrentNrc() {
        const courseCodeInput = document.getElementById('courseCode');
        if (!courseCodeInput) return;

        const nrcId = parseInt(courseCodeInput.value);
        const hasRubric = Array.isArray(this.existingRubrics) && this.existingRubrics.some(r => r.nrc_id === nrcId);

        let warningDiv = document.getElementById('nrc-rubric-warning');
        const btnNext = document.getElementById('btnNext');

        if (nrcId && !hasRubric) {
            if (!warningDiv) {
                warningDiv = document.createElement('div');
                warningDiv.id = 'nrc-rubric-warning';
                warningDiv.style.cssText = 'margin-top: 8px; color: var(--danger-color); font-size: 13.5px; font-weight: 500; display: flex; align-items: center; gap: 6px;';
                warningDiv.innerHTML = '⚠️ No existe una rúbrica aprobada para este NRC. Solicítala al Comité Académico.';
                courseCodeInput.parentNode.appendChild(warningDiv);
            }
            if (btnNext) {
                btnNext.disabled = true;
                btnNext.style.opacity = '0.5';
                btnNext.style.cursor = 'not-allowed';
            }
        } else {
            if (warningDiv) {
                warningDiv.remove();
            }

            if (nrcId && hasRubric) {
                if (btnNext) {
                    btnNext.disabled = false;
                    btnNext.style.opacity = '1';
                    btnNext.style.cursor = 'pointer';
                }
            } else {
                if (btnNext) {
                    btnNext.disabled = true;
                    btnNext.style.opacity = '0.5';
                    btnNext.style.cursor = 'not-allowed';
                }
            }
        }
    }

    async render() {
        const user = AuthService.getCurrentUser();
        const isReviewRole = user && ['COMITE_ACADEMICO', 'DOCENTE_CIAC', 'DIRECTOR_ESCUELA'].includes(user.rol);

        if (isReviewRole) {
            return await this.renderComiteRubricManagement();
        }

        const steps = ['Información del curso', 'Detalles del tema', 'Configuración de rúbrica'];
        const stepIndicator = new StepIndicatorComponent(steps, this.currentStep);

        const stepContent = await this.renderStep();

        return `
            <div class="page-title">
                <h2>Configuración de evaluación</h2>
            </div>
            <p class="page-subtitle">Configura los parámetros necesarios para tu evaluación automatizada.</p>
            
            ${stepIndicator.render()}
            
            <div class="main-card">
                <div class="card-header">
                    <h3>${steps[this.currentStep]}</h3>
                </div>
                <div class="card-body">
                    ${stepContent}
                </div>
                <div class="card-footer">
                    ${this.renderFooter()}
                </div>
            </div>
        `;
    }

    async renderStep() {
        switch (this.currentStep) {
            case 0: return await this.renderStep1();
            case 1: return this.renderStep2();
            case 2: return this.renderStep3();
            default: return '';
        }
    }

    async renderStep1() {
        const user = AuthService.getCurrentUser();
        let courses = [];
        let nrcOptions = '<option value="">-- Selecciona un curso primero --</option>';
        try {
            const CursoService = (await import('../services/curso.service.js')).CursoService;
            courses = await CursoService.getMyCourses();

            if (this.configData.curso_id) {
                try {
                    const nrcs = await CursoService.getCourseNrcs(this.configData.curso_id);
                    if (nrcs && nrcs.length > 0) {
                        nrcOptions = '<option value="">-- Selecciona un NRC --</option>' + nrcs.map(nrc => `
                            <option value="${nrc}" ${this.configData.courseCode == nrc ? 'selected' : ''}>
                                ${nrc}
                            </option>
                        `).join('');
                    } else {
                        nrcOptions = '<option value="">Sin NRCs asignados</option>';
                    }
                } catch (nrcErr) {
                    console.error('Error cargando NRCs iniciales:', nrcErr);
                    nrcOptions = `<option value="${this.configData.courseCode || ''}" selected>${this.configData.courseCode || '-- Error cargando NRCs --'}</option>`;
                }
            }
        } catch (error) {
            console.error('Error cargando cursos:', error);
            showErrorNotification('No se pudieron cargar tus cursos.');
        }

        if (!courses) courses = [];

        let courseWarningHTML = '';
        let defaultCourseOption = '<option value="">-- Selecciona un curso --</option>';

        if (courses.length === 0) {
            defaultCourseOption = '<option value="">No tienes cursos asignados</option>';
            courseWarningHTML = `
                <div id="no-courses-warning" style="margin-top: 8px; color: var(--danger-color); font-size: 13.5px; font-weight: 500; display: flex; align-items: center; gap: 6px;">
                    ⚠️ No tienes cursos asignados en el sistema.
                </div>
            `;

            setTimeout(() => {
                const btnNext = document.getElementById('btnNext');
                if (btnNext) {
                    btnNext.disabled = true;
                    btnNext.style.opacity = '0.5';
                    btnNext.style.cursor = 'not-allowed';
                }
            }, 0);
        }

        const options = courses.map(c => `
            <option value="${c.id}" 
                ${this.configData.curso_id == c.id ? 'selected' : ''}>
                ${c.nombre}
            </option>
        `).join('');

        const currentNrc = parseInt(this.configData.courseCode);
        const hasRubric = this.existingRubrics.some(r => r.nrc_id === currentNrc);

        let rubricWarningHTML = '';
        if (courses.length > 0 && currentNrc && !hasRubric) {
            rubricWarningHTML = `
                <div id="nrc-rubric-warning" style="margin-top: 8px; color: var(--danger-color); font-size: 13.5px; font-weight: 500; display: flex; align-items: center; gap: 6px;">
                    ⚠️ No existe una rúbrica aprobada para este NRC. Solicítala al Comité Académico.
                </div>
            `;

            setTimeout(() => {
                const btnNext = document.getElementById('btnNext');
                if (btnNext) {
                    btnNext.disabled = true;
                    btnNext.style.opacity = '0.5';
                    btnNext.style.cursor = 'not-allowed';
                }
            }, 0);
        } else if (!currentNrc) {
            setTimeout(() => {
                const btnNext = document.getElementById('btnNext');
                if (btnNext) {
                    btnNext.disabled = true;
                    btnNext.style.opacity = '0.5';
                    btnNext.style.cursor = 'not-allowed';
                }
            }, 0);
        }

        return `
            <div class="form-group">
                <label for="courseName">Nombre del curso *</label>
                <select id="courseName" required class="form-control">
                    ${defaultCourseOption}
                    ${options}
                </select>
                ${courseWarningHTML}
            </div>

            <div class="form-group">
                <label for="courseCode">Código del curso (NRC) *</label>
                <select id="courseCode" required class="form-control">
                    ${nrcOptions}
                </select>
                ${rubricWarningHTML}
            </div>

            <div class="form-group">
                <label for="instructor">Instructor *</label>
                <input type="text" id="instructor" value="${this.configData.instructor || user?.nombre || ''}" 
                       placeholder="Nombre del instructor" disabled required>
                <small class="text-muted">El nombre del instructor se toma de tu cuenta</small>
            </div>

            <div class="form-group">
                <label for="semestre">Semestre *</label>
                <input type="text" id="semestre" value="${this.configData.semestre || ''}" 
                       placeholder="Ej: 2025-1" required>
                <small>Formato: YYYY-N (ejemplo: 2025-1 para primer semestre de 2025)</small>
            </div>
        `;
    }


    renderStep2() {
        return `
            <div class="form-group">
                <label for="topic">Tema de la evaluación *</label>
                <input type="text" id="topic" value="${this.configData.topic || ''}" 
                       placeholder="Ej: Examen Final - Derivadas e Integrales" required>
            </div>

            <div class="form-group">
                <label for="descripcion_tema">Descripción del tema</label>
                <textarea id="descripcion_tema" rows="4" 
                          placeholder="Describe brevemente los temas que cubre esta evaluación...">${this.configData.descripcion_tema || ''}</textarea>
                <small>Esta descripción ayudará al sistema a contextualizar mejor la evaluación</small>
            </div>
        `;
    }

    renderStep3() {
        const user = AuthService.getCurrentUser();
        const isProfessor = user && user.rol === 'PROFESOR';

        if (isProfessor) {
            this.configData.rubrica_id = this.configData.rubrica_id || (this.existingRubrics.length > 0 ? this.existingRubrics[0].id : null);

            if (this.existingRubrics.length === 0) {
                setTimeout(() => {
                    const btnFinish = document.getElementById('btnFinish');
                    if (btnFinish) {
                        btnFinish.disabled = true;
                        btnFinish.title = 'No hay rúbricas disponibles. Contacta al Comité Académico.';
                        btnFinish.style.opacity = '0.5';
                        btnFinish.style.cursor = 'not-allowed';
                    }
                }, 0);

                return `
                    <div class="rubric-selector">
                        <h4>Seleccionar Rúbrica para la Evaluación</h4>
                    </div>
                    <div style="padding: 24px; background: rgba(241, 196, 15, 0.1); border: 1px solid rgba(241, 196, 15, 0.4); border-radius: var(--radius-md); text-align: center;">
                        <span style="font-size: 40px; display: block; margin-bottom: 12px;">⚠️</span>
                        <p style="font-weight: 600; font-size: 15px; color: var(--text-color); margin: 0 0 8px 0;">No hay rúbricas disponibles</p>
                        <p style="font-size: 13.5px; color: var(--secondary-text); margin: 0;">El Comité Académico aún no ha creado ni aprobado ninguna rúbrica para el sistema. No puedes continuar hasta que exista al menos una rúbrica aprobada.</p>
                    </div>
                `;
            }

            return `
                <div class="rubric-selector">
                    <h4>Seleccionar Rúbrica para la Evaluación</h4>
                    <p class="text-muted">Como profesor, puedes seleccionar y utilizar cualquiera de las rúbricas oficiales diseñadas por el Comité Académico.</p>
                </div>
                <input type="radio" name="rubricOption" value="existing" checked style="display: none;">
                
                <div id="existing-rubric-section" class="form-section" style="display: block;">
                    ${this.renderExistingRubricSelector()}
                </div>
            `;
        }

        return `
            <div class="rubric-selector">
                <h4>¿Qué rúbrica quieres usar?</h4>
                
                <div class="rubric-options">
                    <label class="radio-card">
                        <input type="radio" name="rubricOption" value="existing" 
                               ${this.configData.rubrica_id ? 'checked' : ''}>
                        <div class="radio-content">
                            <strong>📋 Usar rúbrica existente</strong>
                            <small>Selecciona una de tus rúbricas guardadas</small>
                        </div>
                    </label>

                    <label class="radio-card">
                        <input type="radio" name="rubricOption" value="new" 
                               ${!this.configData.rubrica_id ? 'checked' : ''}>
                        <div class="radio-content">
                            <strong>➕ Crear nueva rúbrica</strong>
                            <small>Define criterios y niveles personalizados</small>
                        </div>
                    </label>
                </div>
            </div>

            <div id="existing-rubric-section" class="form-section" 
                 style="display: ${this.configData.rubrica_id ? 'block' : 'none'}">
                ${this.renderExistingRubricSelector()}
            </div>

            <div id="new-rubric-section" class="form-section" 
                 style="display: ${!this.configData.rubrica_id ? 'block' : 'none'}">
                ${this.renderNewRubricForm()}
            </div>
        `;
    }

    renderExistingRubricSelector() {
        if (this.existingRubrics.length === 0) {
            return `
                <div class="alert alert-warning" style="padding: 1rem; background-color: #fff3cd; border: 1px solid #ffeeba; border-radius: 6px; color: #856404;">
                    ⚠️ No hay rúbricas registradas en el sistema. Por favor, solicita al Comité Académico que cree una.
                </div>
            `;
        }

        return `
            <div class="form-group">
                <label for="selectRubric">Selecciona una rúbrica</label>
                <select id="selectRubric" class="form-control">
                    <option value="">-- Selecciona una rúbrica --</option>
                    ${this.existingRubrics.map(r => `
                        <option value="${r.id}" ${this.configData.rubrica_id === r.id ? 'selected' : ''}>
                            ${r.nombre_rubrica} (${r.criterios?.length || 0} criterios)
                        </option>
                    `).join('')}
                </select>
            </div>

            ${this.configData.rubrica_id ? this.renderRubricPreview() : ''}
        `;
    }

    renderRubricPreview() {
        const rubrica = this.existingRubrics.find(r => r.id === this.configData.rubrica_id);
        if (!rubrica || !rubrica.criterios) return '';

        return `
            <div class="rubric-preview">
                <h5>Vista previa: ${rubrica.nombre_rubrica}</h5>
                ${rubrica.descripcion ? `<p class="text-muted">${rubrica.descripcion}</p>` : ''}
                
                ${rubrica.criterios.map((criterio, idx) => `
                    <div class="criterio-preview-card">
                        <div class="criterio-preview-header">
                            <span class="criterio-numero">${idx + 1}</span>
                            <strong>${criterio.nombre_criterio}</strong>
                            <span class="criterio-peso-badge">${(criterio.peso * 100).toFixed(0)}%</span>
                        </div>
                        ${criterio.descripcion_criterio ? `
                            <p class="criterio-descripcion-small">${criterio.descripcion_criterio}</p>
                        ` : ''}
                        
                        ${criterio.niveles && criterio.niveles.length > 0 ? `
                            <div class="niveles-preview">
                                ${criterio.niveles.map(nivel => `
                                    <div class="nivel-preview-item">
                                        <strong>${nivel.nombre_nivel}</strong>
                                        <span class="nivel-puntaje">
                                            ${nivel.puntaje_min === nivel.puntaje_max
                ? `${nivel.puntaje_min} pts`
                : `${nivel.puntaje_min}-${nivel.puntaje_max} pts`}
                                        </span>
                                    </div>
                                `).join('')}
                            </div>
                        ` : ''}
                    </div>
                `).join('')}
            </div>
        `;
    }

    renderNewRubricForm() {
        const rubrica = this.configData.rubrica;

        return `
            <div class="form-group">
                <label for="rubricName">Nombre de la rúbrica *</label>
                <input type="text" id="rubricName" value="${rubrica.nombre_rubrica || ''}" 
                       placeholder="Ej: Rúbrica Proyecto Final 2025-1" required>
            </div>

            <div class="form-group">
                <label for="rubricDesc">Descripción</label>
                <textarea id="rubricDesc" rows="2" 
                          placeholder="Describe el propósito de esta rúbrica...">${rubrica.descripcion || ''}</textarea>
            </div>

            <div class="criterios-section">
                <div class="section-header">
                    <h5>Criterios de evaluación</h5>
                    <button type="button" class="btn btn-sm btn-secondary" id="addCriterio">
                        ➕ Agregar criterio
                    </button>
                </div>

                <div id="criterios-list">
                    ${rubrica.criterios.map((c, index) => this.renderCriterioItem(c, index)).join('')}
                </div>

                <div class="peso-total">
                    <strong>Peso total:</strong> 
                    <span id="pesoTotal">${this.calculateTotalPeso()}%</span>
                    <span class="status-icon" id="pesoStatus">${this.calculateTotalPeso() === 100 ? '✅' : '⚠️'}</span>
                </div>
                <small class="text-muted">El peso total debe sumar 100%</small>
            </div>

            <div class="form-group">
                <label>
                    <input type="checkbox" id="saveRubric" checked>
                    Guardar esta rúbrica para uso futuro
                </label>
            </div>
        `;
    }

    renderCriterioItem(criterio, index) {
        if (!criterio.niveles || criterio.niveles.length === 0) {
            criterio.niveles = [
                {
                    id: Date.now() + '_1',
                    nombre_nivel: 'Excelente',
                    puntaje_min: 3,
                    puntaje_max: 3,
                    descriptores: [''],
                    orden: 1
                }
            ];
        }

        return `
            <div class="criterio-item" data-criterio-id="${criterio.id}">
                <div class="criterio-header">
                    <span class="criterio-number">${index + 1}</span>
                    <input type="text" class="criterio-nombre" data-criterio-index="${index}"
                        value="${criterio.nombre_criterio || ''}" 
                        placeholder="Nombre del criterio" required>
                    <button type="button" class="btn-icon btn-delete" data-action="delete-criterio" data-index="${index}">
                        🗑️
                    </button>
                </div>

                <div class="criterio-body">
                    <div class="form-group">
                        <label>Descripción del criterio</label>
                        <textarea class="criterio-descripcion" data-criterio-index="${index}" rows="2" 
                                placeholder="¿Qué evalúa este criterio?">${criterio.descripcion_criterio || ''}</textarea>
                    </div>

                    <div class="form-group peso-group">
                        <label>Peso (%)</label>
                        <div class="peso-input-group">
                            <input type="number" class="criterio-peso" data-criterio-index="${index}"
                                value="${(criterio.peso * 100).toFixed(0)}" 
                                min="1" max="100" step="1" required>
                            <span class="input-suffix">%</span>
                        </div>
                        <input type="range" class="peso-slider" data-criterio-index="${index}"
                            value="${(criterio.peso * 100).toFixed(0)}" 
                            min="0" max="100" step="5">
                    </div>

                    <!-- NIVELES -->
                    <div class="niveles-section">
                        <div class="niveles-header">
                            <label>Niveles de desempeño</label>
                            <!-- Botón oculto/deshabilitado porque solo se permite 1 descriptor por ahora, 
                                 pero mantenemos la estructura si se requiere en el futuro o para agregar niveles -->
                            <button type="button" class="btn btn-sm btn-secondary" 
                                    data-action="add-nivel" data-criterio-index="${index}">
                                ➕ Agregar nivel
                            </button>
                        </div>

                        <div class="niveles-list">
                            ${criterio.niveles.map((nivel, nIndex) =>
            this.renderNivelItem(nivel, index, nIndex)
        ).join('')}
                        </div>
                    </div>
                </div>
            </div>
        `;
    }


    renderNivelItem(nivel, criterioIndex, nivelIndex) {

        if (!nivel.descriptores || nivel.descriptores.length === 0) {
            nivel.descriptores = [''];
        }

        return `
            <div class="nivel-item" data-nivel-id="${nivel.id}">
                <div class="nivel-header">
                    <input type="text" class="nivel-nombre" 
                        data-criterio-index="${criterioIndex}" data-nivel-index="${nivelIndex}"
                        value="${nivel.nombre_nivel || ''}" 
                        placeholder="Ej: Excelente, Bueno, Regular..." required>
                    
                    <div class="nivel-puntaje-inputs">
                        <input type="number" class="nivel-puntaje-min" 
                            data-criterio-index="${criterioIndex}" data-nivel-index="${nivelIndex}"
                            value="${nivel.puntaje_min}" min="0" max="20" step="0.5" 
                            placeholder="Min" required>
                        <span>-</span>
                        <input type="number" class="nivel-puntaje-max" 
                            data-criterio-index="${criterioIndex}" data-nivel-index="${nivelIndex}"
                            value="${nivel.puntaje_max}" min="0" max="20" step="0.5" 
                            placeholder="Max" required>
                        <span class="text-muted">pts</span>
                    </div>

                    <button type="button" class="btn-icon btn-delete" 
                            data-action="delete-nivel" 
                            data-criterio-index="${criterioIndex}" 
                            data-nivel-index="${nivelIndex}">
                        🗑️
                    </button>
                </div>

                <div class="nivel-body">
                    <label>Descriptor (qué debe lograr el estudiante)</label>
                    <div class="descriptores-list">
                        <div class="descriptor-item">
                            <span class="descriptor-bullet">•</span>
                            <textarea class="descriptor-input auto-expand" 
                                data-criterio-index="${criterioIndex}" 
                                data-nivel-index="${nivelIndex}"
                                data-descriptor-index="0"
                                placeholder="Describe el nivel de desempeño..."
                                rows="2">${nivel.descriptores[0] || ''}</textarea>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }


    renderFooter() {
        return `
            <div class="button-group">
                ${this.currentStep > 0 ? `
                    <button class="btn btn-secondary" id="btnBack">
                        ← Anterior
                    </button>
                ` : ''}
                
                ${this.currentStep < 2 ? `
                    <button class="btn btn-primary" id="btnNext">
                        Siguiente →
                    </button>
                ` : `
                    <button class="btn btn-primary" id="btnFinish">
                        ✅ Finalizar configuración
                    </button>
                `}
            </div>
        `;
    }

    calculateTotalPeso() {
        const rubrica = this.configData.rubrica;
        if (!rubrica || !rubrica.criterios) return 0;

        const total = rubrica.criterios.reduce((sum, c) => sum + (c.peso || 0), 0);
        return Math.round(total * 100);
    }

    attachEventListeners() {
        const user = AuthService.getCurrentUser();
        const isReviewRole = user && ['COMITE_ACADEMICO', 'DOCENTE_CIAC', 'DIRECTOR_ESCUELA'].includes(user.rol);

        if (isReviewRole) {
            this.attachComiteEventListeners();
            return;
        }

        const btnBack = document.getElementById('btnBack');
        const btnNext = document.getElementById('btnNext');
        const btnFinish = document.getElementById('btnFinish');

        if (btnBack) btnBack.addEventListener('click', () => this.previousStep());
        if (btnNext) btnNext.addEventListener('click', () => this.nextStep());
        if (btnFinish) btnFinish.addEventListener('click', () => this.finish());

        if (this.currentStep === 0) {
            const courseSelect = document.getElementById('courseName');
            const courseCodeInput = document.getElementById('courseCode');

            if (courseSelect) {
                courseSelect.addEventListener('change', async (e) => {
                    const selectedOption = e.target.options[e.target.selectedIndex];
                    const cursoId = selectedOption.value;
                    const nombre = selectedOption.text;

                    const btnNext = document.getElementById('btnNext');
                    let warningDiv = document.getElementById('nrc-rubric-warning');
                    if (warningDiv) warningDiv.remove();

                    if (cursoId) {
                        this.configData.curso_id = parseInt(cursoId);
                        this.configData.courseName = nombre;

                        if (courseCodeInput) {
                            courseCodeInput.innerHTML = '<option value="">Cargando NRCs...</option>';
                            if (btnNext) {
                                btnNext.disabled = true;
                                btnNext.style.opacity = '0.5';
                                btnNext.style.cursor = 'not-allowed';
                            }
                            try {
                                const CursoService = (await import('../services/curso.service.js')).CursoService;
                                const nrcs = await CursoService.getCourseNrcs(cursoId);
                                if (nrcs && nrcs.length > 0) {
                                    courseCodeInput.innerHTML = '<option value="">-- Selecciona un NRC --</option>' + nrcs.map(nrc => `
                                        <option value="${nrc}">${nrc}</option>
                                    `).join('');
                                    this.configData.courseCode = '';
                                } else {
                                    courseCodeInput.innerHTML = '<option value="">Sin NRCs asignados</option>';
                                    this.configData.courseCode = '';
                                }
                            } catch (err) {
                                console.error('Error al cargar NRCs:', err);
                                courseCodeInput.innerHTML = '<option value="">Error al cargar NRCs</option>';
                                this.configData.courseCode = '';
                            }
                        }
                    } else {
                        this.configData.curso_id = null;
                        this.configData.courseName = '';
                        this.configData.courseCode = '';
                        if (courseCodeInput) {
                            courseCodeInput.innerHTML = '<option value="">-- Selecciona un curso primero --</option>';
                        }
                        if (btnNext) {
                            btnNext.disabled = true;
                            btnNext.style.opacity = '0.5';
                            btnNext.style.cursor = 'not-allowed';
                        }
                    }

                    this.saveConfig();
                });
            }

            if (courseCodeInput) {
                courseCodeInput.addEventListener('change', (e) => {
                    const nrcId = parseInt(e.target.value);
                    this.configData.courseCode = e.target.value;
                    this.saveConfig();

                    const hasRubric = this.existingRubrics.some(r => r.nrc_id === nrcId);

                    let warningDiv = document.getElementById('nrc-rubric-warning');
                    const btnNext = document.getElementById('btnNext');

                    if (nrcId && !hasRubric) {
                        if (!warningDiv) {
                            warningDiv = document.createElement('div');
                            warningDiv.id = 'nrc-rubric-warning';
                            warningDiv.style.cssText = 'margin-top: 8px; color: var(--danger-color); font-size: 13.5px; font-weight: 500; display: flex; align-items: center; gap: 6px;';
                            warningDiv.innerHTML = '⚠️ No existe una rúbrica aprobada para este NRC. Solicítala al Comité Académico.';
                            courseCodeInput.parentNode.appendChild(warningDiv);
                        }
                        if (btnNext) {
                            btnNext.disabled = true;
                            btnNext.style.opacity = '0.5';
                            btnNext.style.cursor = 'not-allowed';
                        }
                    } else {
                        if (warningDiv) {
                            warningDiv.remove();
                        }

                        if (nrcId && hasRubric) {
                            if (btnNext) {
                                btnNext.disabled = false;
                                btnNext.style.opacity = '1';
                                btnNext.style.cursor = 'pointer';
                            }
                        } else {
                            if (btnNext) {
                                btnNext.disabled = true;
                                btnNext.style.opacity = '0.5';
                                btnNext.style.cursor = 'not-allowed';
                            }
                        }
                    }
                });
            }

        }

        if (this.currentStep === 1) {
            const topic = document.getElementById('topic');
            if (topic) {
                topic.addEventListener('input', (e) => {
                    const sanitized = ValidatorUtils.sanitizeText(e.target.value, true);
                    if (e.target.value !== sanitized) {
                        e.target.value = sanitized;
                    }
                });
            }

            const descripcionTema = document.getElementById('descripcion_tema');
            if (descripcionTema) {
                descripcionTema.addEventListener('input', (e) => {
                    const sanitized = ValidatorUtils.sanitizeText(e.target.value, true);
                    if (e.target.value !== sanitized) {
                        e.target.value = sanitized;
                    }
                });
            }
        }

        if (this.currentStep === 2) {
            this.attachStep3Listeners();
        }
    }

    attachStep3Listeners() {

        document.querySelectorAll('input[name="rubricOption"]').forEach(radio => {
            radio.addEventListener('change', (e) => {
                const value = e.target.value;
                const existingSection = document.getElementById('existing-rubric-section');
                const newSection = document.getElementById('new-rubric-section');

                if (existingSection) existingSection.style.display = value === 'existing' ? 'block' : 'none';
                if (newSection) newSection.style.display = value === 'new' ? 'block' : 'none';

                if (value === 'new') {
                    this.configData.rubrica_id = null;
                }
            });
        });

        const selectRubric = document.getElementById('selectRubric');
        if (selectRubric) {
            selectRubric.addEventListener('change', async (e) => {
                const rubricaId = parseInt(e.target.value);
                if (rubricaId) {
                    this.configData.rubrica_id = rubricaId;
                    this.reRender();
                } else {
                    this.configData.rubrica_id = null;
                }
            });
        }

        this.attachNewRubricListeners();
    }

    attachNewRubricListeners() {
        const rubricName = document.getElementById('rubricName');
        const rubricDesc = document.getElementById('rubricDesc');

        if (rubricName) {
            rubricName.addEventListener('input', (e) => {

                const sanitized = ValidatorUtils.sanitizeText(e.target.value, true);
                if (e.target.value !== sanitized) {
                    e.target.value = sanitized;
                }
                this.configData.rubrica.nombre_rubrica = sanitized;
                this.saveConfig();
            });
        }

        if (rubricDesc) {
            rubricDesc.addEventListener('input', (e) => {

                const sanitized = ValidatorUtils.sanitizeText(e.target.value);
                if (e.target.value !== sanitized) {
                    e.target.value = sanitized;
                }
                this.configData.rubrica.descripcion = sanitized;
                this.saveConfig();
            });
        }

        const addCriterio = document.getElementById('addCriterio');
        if (addCriterio) {
            addCriterio.addEventListener('click', () => this.addCriterio());
        }

        const mainContent = document.getElementById('main-content');
        if (mainContent) {

            if (this._inputHandler) {
                mainContent.removeEventListener('input', this._inputHandler);
            }

            this._inputHandler = (e) => {
                const target = e.target;

                if (target.classList.contains('criterio-nombre')) {
                    const index = parseInt(target.dataset.criterioIndex);

                    const sanitized = ValidatorUtils.sanitizeText(target.value, true);
                    if (target.value !== sanitized) {
                        target.value = sanitized;
                    }
                    this.configData.rubrica.criterios[index].nombre_criterio = sanitized;
                    this.saveConfig();
                }

                if (target.classList.contains('criterio-descripcion')) {
                    const index = parseInt(target.dataset.criterioIndex);

                    const sanitized = ValidatorUtils.sanitizeText(target.value, true);
                    if (target.value !== sanitized) {
                        target.value = sanitized;
                    }
                    this.configData.rubrica.criterios[index].descripcion_criterio = sanitized;
                    this.saveConfig();
                }

                if (target.classList.contains('criterio-peso') || target.classList.contains('peso-slider')) {
                    const index = parseInt(target.dataset.criterioIndex);
                    let val = parseFloat(target.value);

                    if (val < 1) val = 1;
                    if (val > 100) val = 100;

                    if (parseFloat(target.value) !== val) {
                        target.value = val;
                    }

                    const peso = val / 100;
                    this.configData.rubrica.criterios[index].peso = peso;

                    const criterioBody = target.closest('.criterio-body');
                    if (criterioBody) {
                        const inputPeso = criterioBody.querySelector('.criterio-peso');
                        const sliderPeso = criterioBody.querySelector('.peso-slider');
                        if (inputPeso && inputPeso !== target) inputPeso.value = val;
                        if (sliderPeso && sliderPeso !== target) sliderPeso.value = val;
                    }

                    this.updatePesoTotal();
                    this.saveConfig();
                }

                if (target.classList.contains('nivel-nombre')) {
                    const cIndex = parseInt(target.dataset.criterioIndex);
                    const nIndex = parseInt(target.dataset.nivelIndex);

                    const sanitized = ValidatorUtils.sanitizeText(target.value, true);
                    if (target.value !== sanitized) {
                        target.value = sanitized;
                    }
                    this.configData.rubrica.criterios[cIndex].niveles[nIndex].nombre_nivel = sanitized;
                    this.saveConfig();
                }

                if (target.classList.contains('nivel-puntaje-min')) {
                    const cIndex = parseInt(target.dataset.criterioIndex);
                    const nIndex = parseInt(target.dataset.nivelIndex);
                    let val = parseFloat(target.value) || 0;
                    if (val < 0) val = 0;
                    if (val > 20) val = 20;
                    if (parseFloat(target.value) !== val) target.value = val;

                    this.configData.rubrica.criterios[cIndex].niveles[nIndex].puntaje_min = val;
                    this.saveConfig();
                }

                if (target.classList.contains('nivel-puntaje-max')) {
                    const cIndex = parseInt(target.dataset.criterioIndex);
                    const nIndex = parseInt(target.dataset.nivelIndex);
                    let val = parseFloat(target.value) || 0;
                    if (val < 0) val = 0;
                    if (val > 20) val = 20;
                    if (parseFloat(target.value) !== val) target.value = val;

                    this.configData.rubrica.criterios[cIndex].niveles[nIndex].puntaje_max = val;
                    this.saveConfig();
                }

                if (target.type === 'number') {
                    const val = target.value;
                    if (val.length > 1 && val.startsWith('0') && !val.startsWith('0.')) {
                        target.value = parseFloat(val);
                    }
                }

                if (target.classList.contains('descriptor-input')) {
                    const cIndex = parseInt(target.dataset.criterioIndex);
                    const nIndex = parseInt(target.dataset.nivelIndex);
                    const dIndex = parseInt(target.dataset.descriptorIndex);

                    const sanitized = ValidatorUtils.sanitizeText(target.value, true);
                    if (target.value !== sanitized) {
                        target.value = sanitized;
                    }
                    this.configData.rubrica.criterios[cIndex].niveles[nIndex].descriptores[dIndex] = sanitized;
                    this.saveConfig();
                }
            };

            mainContent.addEventListener('input', this._inputHandler);

            if (this._clickHandler) {
                mainContent.removeEventListener('click', this._clickHandler);
            }

            this._clickHandler = (e) => {
                const target = e.target.closest('[data-action]');
                if (!target) return;

                e.preventDefault();
                e.stopPropagation();

                const action = target.dataset.action;
                const cIndex = parseInt(target.dataset.criterioIndex);
                const nIndex = parseInt(target.dataset.nivelIndex);
                const dIndex = parseInt(target.dataset.descriptorIndex);

                console.log('Acción:', action, 'Criterio:', cIndex, 'Nivel:', nIndex);

                switch (action) {
                    case 'delete-criterio':
                        this.deleteCriterio(cIndex);
                        break;
                    case 'add-nivel':
                        this.addNivel(cIndex);
                        break;
                    case 'delete-nivel':
                        this.deleteNivel(cIndex, nIndex);
                        break;
                    case 'add-descriptor':
                        this.addDescriptor(cIndex, nIndex);
                        break;
                    case 'delete-descriptor':
                        this.deleteDescriptor(cIndex, nIndex, dIndex);
                        break;
                }
            };

            mainContent.addEventListener('click', this._clickHandler);
        }
    }


    addCriterio() {
        console.log('Agregando criterio');

        const newCriterio = {
            id: Date.now() + Math.random(),
            nombre_criterio: '',
            descripcion_criterio: '',
            peso: 0.1,
            orden: this.configData.rubrica.criterios.length + 1,
            niveles: [
                {
                    id: Date.now() + Math.random() + '_1',
                    nombre_nivel: 'Excelente',
                    puntaje_min: 3,
                    puntaje_max: 3,
                    descriptores: [''],
                    orden: 1
                }
            ]
        };

        this.configData.rubrica.criterios.push(newCriterio);

        console.log('Criterio agregado. Total criterios:', this.configData.rubrica.criterios.length);

        this.saveConfig();
        this.reRender();
    }


    deleteCriterio(index) {
        if (this.configData.rubrica.criterios.length <= 1) {
            showErrorNotification(new Error('Debe haber al menos un criterio'));
            return;
        }

        if (!confirm('¿Eliminar este criterio?')) return;

        this.configData.rubrica.criterios.splice(index, 1);
        this.configData.rubrica.criterios.forEach((c, i) => c.orden = i + 1);

        this.reRender();
        this.saveConfig();
    }

    addNivel(criterioIndex) {
        console.log('➕ Agregando nivel al criterio', criterioIndex);

        const niveles = this.configData.rubrica.criterios[criterioIndex].niveles;
        const newNivel = {
            id: Date.now() + Math.random(),
            nombre_nivel: '',
            puntaje_min: 0,
            puntaje_max: 0,
            descriptores: [''],
            orden: niveles.length + 1
        };

        niveles.push(newNivel);

        console.log('Nivel agregado. Total niveles:', niveles.length);

        this.saveConfig();
        this.reRender();
    }


    deleteNivel(criterioIndex, nivelIndex) {
        const niveles = this.configData.rubrica.criterios[criterioIndex].niveles;

        if (niveles.length <= 1) {
            showErrorNotification(new Error('Debe haber al menos un nivel'));
            return;
        }

        niveles.splice(nivelIndex, 1);
        niveles.forEach((n, i) => n.orden = i + 1);

        this.reRender();
        this.saveConfig();
    }

    addDescriptor(criterioIndex, nivelIndex) {
        console.warn('Solo se permite un descriptor por nivel');
    }

    deleteDescriptor(criterioIndex, nivelIndex, descriptorIndex) {
        console.warn('No se puede eliminar el descriptor único');
    }

    destroy() {
        const mainContent = document.getElementById('main-content');
        if (mainContent) {
            if (this._inputHandler) {
                mainContent.removeEventListener('input', this._inputHandler);
            }
            if (this._clickHandler) {
                mainContent.removeEventListener('click', this._clickHandler);
            }
        }
    }


    updatePesoTotal() {
        const total = this.calculateTotalPeso();
        const pesoTotalEl = document.getElementById('pesoTotal');
        const pesoStatusEl = document.getElementById('pesoStatus');

        if (pesoTotalEl) pesoTotalEl.textContent = `${total}%`;
        if (pesoStatusEl) pesoStatusEl.textContent = total === 100 ? '✅' : '⚠️';
    }

    async reRender() {
        console.log('Re-renderizando vista...');

        const container = document.getElementById('main-content');
        if (container) {
            container.innerHTML = await this.render();
            this.attachEventListeners();
            console.log('Vista re-renderizada');
        }
    }


    previousStep() {
        if (this.currentStep > 0) {
            this.currentStep--;
            this.reRender();
        }
    }

    async nextStep() {
        if (!this.validateCurrentStep()) return;

        if (this.currentStep === 0) {
            const courseSelect = document.getElementById('courseName');
            if (courseSelect && courseSelect.selectedIndex > 0) {
                this.configData.courseName = courseSelect.options[courseSelect.selectedIndex].text;
            }

            this.configData.courseCode = document.getElementById('courseCode')?.value;
            this.configData.instructor = document.getElementById('instructor')?.value;
            this.configData.semestre = document.getElementById('semestre')?.value;
        } else if (this.currentStep === 1) {
            this.configData.topic = document.getElementById('topic')?.value;
            this.configData.descripcion_tema = document.getElementById('descripcion_tema')?.value;
        }

        this.saveConfig();
        this.currentStep++;
        this.reRender();
    }

    validateCurrentStep() {
        if (this.currentStep === 0) {
            const courseName = document.getElementById('courseName');
            if (!courseName?.value) {
                showErrorNotification(new Error('Debe seleccionar un curso'));
                courseName?.focus();
                return false;
            }

            const courseCode = document.getElementById('courseCode');
            if (!ValidatorUtils.isValidCourseCode(courseCode?.value)) {
                showErrorNotification(new Error('Código de curso inválido: debe ser un número de 4 a 5 dígitos'));
                courseCode?.focus();
                return false;
            }

            const instructor = document.getElementById('instructor');
            if (!instructor.value.trim()) {

                const user = AuthService.getCurrentUser();
                if (user?.nombre) {
                    instructor.value = user.nombre;
                } else {
                    showErrorNotification(new Error('El nombre del instructor es requerido'));
                    return false;
                }
            }

            const semestre = document.getElementById('semestre');
            if (!ValidatorUtils.isValidSemester(semestre?.value)) {
                showErrorNotification(new Error('Semestre inválido (ej: 2025-1)'));
                semestre?.focus();
                return false;
            }

            const user = AuthService.getCurrentUser();
            if (user && user.rol === 'PROFESOR') {
                const nrcVal = parseInt(courseCode?.value);
                const hasRubric = Array.isArray(this.existingRubrics) && this.existingRubrics.some(r => r.nrc_id === nrcVal);
                if (!hasRubric) {
                    showErrorNotification(new Error('No existe una rúbrica aprobada para este NRC. Solicítala al Comité Académico.'));
                    courseCode?.focus();
                    return false;
                }
            }

        } else if (this.currentStep === 1) {

            const topic = document.getElementById('topic');
            if (!ValidatorUtils.isValidDescription(topic?.value)) {
                showErrorNotification(new Error('Tema inválido: solo letras y puntuación básica, sin números ni símbolos'));
                topic?.focus();
                return false;
            }

            const descripcion = document.getElementById('descripcion_tema');
            if (!ValidatorUtils.isValidDescription(descripcion?.value)) {
                showErrorNotification(new Error('La descripción del tema es obligatoria y debe contener solo letras y puntuación básica'));
                descripcion?.focus();
                return false;
            }
        }

        return true;
    }

    async finish() {
        const btnFinish = document.getElementById('btnFinish');

        try {
            const rubricOption = document.querySelector('input[name="rubricOption"]:checked');

            if (!rubricOption) {
                showErrorNotification(new Error('Selecciona una opción de rúbrica'));
                return;
            }

            if (rubricOption.value === 'existing') {
                if (!this.configData.rubrica_id) {
                    if (this.existingRubrics.length === 0) {
                        showErrorNotification(new Error('No hay rúbricas aprobadas disponibles. Contacta al Comité Académico.'));
                    } else {
                        showErrorNotification(new Error('Selecciona una rúbrica existente'));
                    }
                    return;
                }
            } else {
                const rubrica = this.configData.rubrica;

                if (!ValidatorUtils.isValidDescription(rubrica.nombre_rubrica)) {
                    showErrorNotification(new Error('El nombre de la rúbrica es inválido: solo letras y puntuación básica, sin números ni símbolos'));
                    return;
                }

                if (!rubrica.descripcion || !ValidatorUtils.isValidDescription(rubrica.descripcion)) {
                    showErrorNotification(new Error('La descripción de la rúbrica es obligatoria y debe contener solo letras y puntuación básica'));
                    return;
                }

                if (!rubrica.criterios || rubrica.criterios.length === 0) {
                    showErrorNotification(new Error('Debe haber al menos un criterio'));
                    return;
                }

                for (let i = 0; i < rubrica.criterios.length; i++) {
                    const criterio = rubrica.criterios[i];

                    if (!ValidatorUtils.isValidDescription(criterio.nombre_criterio)) {
                        showErrorNotification(new Error(`Nombre del criterio ${i + 1} inválido: solo letras y puntuación básica, sin números ni símbolos`));
                        return;
                    }

                    if (!criterio.descripcion_criterio || !ValidatorUtils.isValidDescription(criterio.descripcion_criterio)) {
                        showErrorNotification(new Error(`La descripción del criterio "${criterio.nombre_criterio}" es obligatoria y debe contener solo letras y puntuación básica`));
                        return;
                    }

                    if (!criterio.niveles || criterio.niveles.length === 0) {
                        showErrorNotification(new Error(`El criterio "${criterio.nombre_criterio}" debe tener al menos un nivel`));
                        return;
                    }

                    for (let j = 0; j < criterio.niveles.length; j++) {
                        const nivel = criterio.niveles[j];

                        if (!ValidatorUtils.isValidDescription(nivel.nombre_nivel)) {
                            showErrorNotification(new Error(`Nombre del nivel ${j + 1} en "${criterio.nombre_criterio}" inválido: solo letras y puntuación básica, sin números ni símbolos`));
                            return;
                        }

                        nivel.descriptores = nivel.descriptores.filter(d => d.trim() !== '');

                        if (nivel.descriptores.length === 0) {
                            showErrorNotification(new Error(`El nivel "${nivel.nombre_nivel}" en "${criterio.nombre_criterio}" debe tener al menos un descriptor`));
                            return;
                        }

                        for (const desc of nivel.descriptores) {
                            if (!ValidatorUtils.isValidDescription(desc)) {
                                showErrorNotification(new Error(`Descriptor inválido en nivel "${nivel.nombre_nivel}": debe contener solo letras y puntuación básica, sin números ni símbolos`));
                                return;
                            }
                        }
                    }
                }

                const total = this.calculateTotalPeso();
                if (total !== 100) {
                    showErrorNotification(new Error(`El peso total debe ser exactamente 100% (actual: ${total}%)`));
                    return;
                }

                if (btnFinish) {
                    btnFinish.disabled = true;
                    btnFinish.innerHTML = '⏳ Procesando...';
                }

                const saveRubric = document.getElementById('saveRubric');
                if (saveRubric && saveRubric.checked) {
                    try {
                        const savedRubrica = await RubricaService.create(rubrica);
                        this.configData.rubrica_id = savedRubrica.id;
                        showSuccessNotification('✅ Rúbrica guardada exitosamente');
                    } catch (error) {
                        console.error('Error guardando rúbrica:', error);
                        showErrorNotification(error);

                        if (btnFinish) {
                            btnFinish.disabled = false;
                            btnFinish.innerHTML = '✅ Finalizar configuración';
                        }
                        return;
                    }
                }
            }

            if (btnFinish && !btnFinish.disabled) {
                btnFinish.disabled = true;
                btnFinish.innerHTML = '⏳ Procesando...';
            }


            this.saveConfig();

            localStorage.setItem('configCompleted', 'true');
            const uploadTab = document.querySelector('.nav-tab[data-route="upload"]');
            if (uploadTab) {
                uploadTab.classList.remove('disabled');
                uploadTab.removeAttribute('aria-disabled');
                uploadTab.removeAttribute('title');
            }

            showSuccessNotification('✅ Configuración completada exitosamente');

            setTimeout(() => {
                this.router.navigate('upload');
            }, 1000);

        } catch (error) {
            console.error('Error en finish:', error);
            showErrorNotification(error);

            if (btnFinish) {
                btnFinish.disabled = false;
                btnFinish.innerHTML = '✅ Finalizar configuración';
            }
        }
    }

    async renderComiteRubricManagement() {
        if (this.comiteCreating || this.comiteEditing) {
            const modeTitle = this.comiteEditing ? 'Actualizar Rúbrica' : 'Crear Nueva Rúbrica';
            const modeDesc = this.comiteEditing
                ? 'Modifica los criterios y niveles de la rúbrica rechazada para volver a enviarla a revisión.'
                : 'Diseña una rúbrica con sus criterios, pesos y niveles de puntaje para que los profesores puedan utilizarla.';

            return `
                <div class="page-title" style="text-align: center; margin-bottom: 24px;">
                    <h2 style="font-family: 'Outfit', sans-serif; font-weight: 700; background: linear-gradient(135deg, var(--primary-color), #764ba2); -webkit-background-clip: text; -webkit-text-fill-color: transparent;">${modeTitle}</h2>
                    <p style="color: var(--secondary-text); margin-top: 8px;">${modeDesc}</p>
                    <div style="margin-top: 10px; font-weight: 600; font-size: 15px; color: var(--primary-color); background: rgba(52,152,219,0.1); padding: 8px 16px; display: inline-block; border-radius: 20px;">
                        🎯 Asociada al NRC: ${this.configData.rubrica.nrc_id}
                    </div>
                </div>

                <div class="main-card" style="background: var(--card-bg); border: 1px solid var(--card-border); border-radius: var(--radius-lg); box-shadow: var(--shadow-md);">
                    <div class="card-header" style="border-bottom: 1px solid var(--card-border); padding: 20px;">
                        <h3 style="margin: 0; font-size: 18px; font-weight: 600; color: var(--text-color);">📋 Formulario de Rúbrica</h3>
                    </div>
                    <div class="card-body" style="padding: 24px;">
                        ${this.renderNewRubricForm()}
                    </div>
                    <div class="card-footer" style="display: flex; justify-content: flex-end; gap: 12px; padding: 20px; border-top: 1px solid var(--card-border);">
                        <button type="button" class="btn btn-secondary" id="btnCancelComiteRubric" style="border-radius: var(--radius-md); font-weight: 600; padding: 10px 24px; cursor: pointer;">
                            Cancelar
                        </button>
                        <button type="button" class="btn btn-success" id="btnSaveComiteRubric" style="border-radius: var(--radius-md); font-weight: 600; padding: 10px 24px; cursor: pointer; background: var(--success-color); color: white; border: none;">
                            💾 Guardar Rúbrica
                        </button>
                    </div>
                </div>
            `;
        }

        const courseOptions = this.comiteCursos.map(c => `
            <option value="${c.id}" ${this.comiteSelectedCurso == c.id ? 'selected' : ''}>
                ${c.nombre}
            </option>
        `).join('');

        const nrcOptions = this.comiteNrcs.map(nrc => `
            <option value="${nrc}" ${this.comiteSelectedNrc == nrc ? 'selected' : ''}>
                ${nrc}
            </option>
        `).join('');

        let mainSectionHTML = `
            <div style="padding: 40px; text-align: center; color: var(--secondary-text); background: var(--card-bg); border: 1px solid var(--card-border); border-radius: var(--radius-lg);">
                <span style="font-size: 48px; display: block; margin-bottom: 15px;">🔍</span>
                <p style="font-size: 16px; margin: 0; font-weight: 500;">Selecciona un curso y luego un NRC para visualizar o configurar su rúbrica.</p>
            </div>
        `;

        if (this.comiteSelectedNrc) {
            this.comiteActiveRubric = this.existingRubrics.find(r => r.nrc_id === parseInt(this.comiteSelectedNrc));

            if (this.comiteActiveRubric) {
                const r = this.comiteActiveRubric;

                let approvalCardHTML = '';
                const isRejected = r.estado_ciac === 'rechazado' || r.estado_director === 'rechazado';
                const isApproved = r.estado_ciac === 'aprobado' && r.estado_director === 'aprobado';

                let reviewBannerClass = 'info';
                let reviewBannerTitle = '⏳ Rúbrica en Revisión';
                let reviewBannerDesc = 'La rúbrica ha sido enviada y está en espera de revisión por el Docente CIAC y el Director de Escuela.';

                if (isApproved) {
                    reviewBannerClass = 'success';
                    reviewBannerTitle = '✅ Rúbrica Aprobada';
                    reviewBannerDesc = 'Esta rúbrica ha sido aprobada por todos los revisores y se encuentra activa para su uso.';
                } else if (isRejected) {
                    reviewBannerClass = 'danger';
                    reviewBannerTitle = '❌ Rúbrica Rechazada';
                    reviewBannerDesc = 'Uno o más revisores han rechazado la propuesta con observaciones. Por favor revise los comentarios y actualice la rúbrica.';
                }

                const user = AuthService.getCurrentUser();
                const isComite = user?.rol === 'COMITE_ACADEMICO';
                const isCIAC = user?.rol === 'DOCENTE_CIAC';
                const isDirector = user?.rol === 'DIRECTOR_ESCUELA';

                let actionsHTML = '';
                if (isComite && isRejected) {
                    actionsHTML = `
                        <div style="margin-top: 20px; display: flex; justify-content: flex-end;">
                            <button type="button" id="btnUpdateComiteRubric" class="btn btn-primary" style="padding: 10px 24px; font-weight: 600; border-radius: var(--radius-md); font-family: 'Outfit', sans-serif;">
                                📝 Actualizar Rúbrica y Re-enviar
                            </button>
                        </div>
                    `;
                } else if (isCIAC && r.estado_ciac === 'pendiente') {
                    if (this.showRejectionForm) {
                        actionsHTML = `
                            <div style="margin-top: 20px; border-top: 1px dashed rgba(0,0,0,0.1); padding-top: 16px;">
                                <label style="display: block; font-weight: 600; font-size: 13.5px; color: var(--text-color); margin-bottom: 8px;">Motivo del Rechazo *</label>
                                <textarea id="review-comment" class="form-control" rows="3" placeholder="Escribe el motivo o los cambios requeridos..." style="width: 100%; border-radius: var(--radius-md); padding: 10px;"></textarea>
                                <div style="margin-top: 12px; display: flex; gap: 8px; justify-content: flex-end;">
                                    <button type="button" id="btnCancelReview" class="btn btn-secondary" style="padding: 8px 16px; font-size: 13px;">Cancelar</button>
                                    <button type="button" id="btnConfirmReject" class="btn btn-danger" style="padding: 8px 16px; font-size: 13px; background: var(--error-color); color: white; border: none; font-weight: 600;">Confirmar Rechazo</button>
                                </div>
                            </div>
                        `;
                    } else {
                        actionsHTML = `
                            <div style="margin-top: 20px; display: flex; gap: 12px; justify-content: flex-end;">
                                <button type="button" id="btnApproveRubric" class="btn btn-success" style="padding: 10px 24px; font-weight: 600; border-radius: var(--radius-md); background: var(--success-color); color: white; border: none; cursor: pointer;">
                                    Aprobar Rúbrica
                                </button>
                                <button type="button" id="btnRejectRubric" class="btn btn-danger" style="padding: 10px 24px; font-weight: 600; border-radius: var(--radius-md); background: var(--error-color); color: white; border: none; cursor: pointer;">
                                    Rechazar Rúbrica
                                </button>
                            </div>
                        `;
                    }
                } else if (isDirector && r.estado_director === 'pendiente') {
                    if (this.showRejectionForm) {
                        actionsHTML = `
                            <div style="margin-top: 20px; border-top: 1px dashed rgba(0,0,0,0.1); padding-top: 16px;">
                                <label style="display: block; font-weight: 600; font-size: 13.5px; color: var(--text-color); margin-bottom: 8px;">Motivo del Rechazo *</label>
                                <textarea id="review-comment" class="form-control" rows="3" placeholder="Escribe el motivo o los cambios requeridos..." style="width: 100%; border-radius: var(--radius-md); padding: 10px;"></textarea>
                                <div style="margin-top: 12px; display: flex; gap: 8px; justify-content: flex-end;">
                                    <button type="button" id="btnCancelReview" class="btn btn-secondary" style="padding: 8px 16px; font-size: 13px;">Cancelar</button>
                                    <button type="button" id="btnConfirmReject" class="btn btn-danger" style="padding: 8px 16px; font-size: 13px; background: var(--error-color); color: white; border: none; font-weight: 600;">Confirmar Rechazo</button>
                                </div>
                            </div>
                        `;
                    } else {
                        actionsHTML = `
                            <div style="margin-top: 20px; display: flex; gap: 12px; justify-content: flex-end;">
                                <button type="button" id="btnApproveRubric" class="btn btn-success" style="padding: 10px 24px; font-weight: 600; border-radius: var(--radius-md); background: var(--success-color); color: white; border: none; cursor: pointer;">
                                    Aprobar Rúbrica
                                </button>
                                <button type="button" id="btnRejectRubric" class="btn btn-danger" style="padding: 10px 24px; font-weight: 600; border-radius: var(--radius-md); background: var(--error-color); color: white; border: none; cursor: pointer;">
                                    Rechazar Rúbrica
                                </button>
                            </div>
                        `;
                    }
                }

                approvalCardHTML = `
                    <div style="margin-top: 24px; padding: 20px; border-radius: var(--radius-lg); border: 1px solid; ${reviewBannerClass === 'success' ? 'background: rgba(46, 204, 113, 0.08); border-color: rgba(46, 204, 113, 0.3); color: #27ae60;' :
                        reviewBannerClass === 'danger' ? 'background: rgba(231, 76, 60, 0.08); border-color: rgba(231, 76, 60, 0.3); color: #c0392b;' :
                            'background: rgba(52, 152, 219, 0.08); border-color: rgba(52, 152, 219, 0.3); color: #2980b9;'
                    }">
                        <h4 style="margin: 0 0 12px 0; font-size: 16px; font-weight: 700; display: flex; align-items: center; gap: 8px;">${reviewBannerTitle}</h4>
                        <p style="margin: 0 0 20px 0; font-size: 14.5px; opacity: 0.9;">${reviewBannerDesc}</p>
                        
                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; border-top: 1px solid rgba(0,0,0,0.1); padding-top: 16px;">
                            <div style="background: var(--card-bg); border: 1px solid var(--card-border); padding: 16px; border-radius: var(--radius-md); color: var(--text-color);">
                                <h5 style="margin: 0 0 8px 0; font-size: 13.5px; color: var(--secondary-text); font-weight: 600;">Docente CIAC</h5>
                                <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
                                    <span style="font-weight: 700; font-size: 14px; color: ${r.estado_ciac === 'aprobado' ? '#2ecc71' : r.estado_ciac === 'rechazado' ? '#e74c3c' : '#f1c40f'};">
                                        ${r.estado_ciac === 'aprobado' ? 'Aprobó' : r.estado_ciac === 'rechazado' ? 'Rechazó' : 'Pendiente'}
                                    </span>
                                </div>
                                ${r.mensaje_ciac ? `<p style="margin: 0; padding: 8px 12px; background: rgba(0,0,0,0.03); border-left: 3px solid #e74c3c; border-radius: var(--radius-xs); font-size: 13px; font-style: italic; color: var(--secondary-text); line-height: 1.4;">"${r.mensaje_ciac}"</p>` : ''}
                            </div>
                            <div style="background: var(--card-bg); border: 1px solid var(--card-border); padding: 16px; border-radius: var(--radius-md); color: var(--text-color);">
                                <h5 style="margin: 0 0 8px 0; font-size: 13.5px; color: var(--secondary-text); font-weight: 600;">Director de Escuela</h5>
                                <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
                                    <span style="font-weight: 700; font-size: 14px; color: ${r.estado_director === 'aprobado' ? '#2ecc71' : r.estado_director === 'rechazado' ? '#e74c3c' : '#f1c40f'};">
                                        ${r.estado_director === 'aprobado' ? 'Aprobó' : r.estado_director === 'rechazado' ? 'Rechazó' : 'Pendiente'}
                                    </span>
                                </div>
                                ${r.mensaje_director ? `<p style="margin: 0; padding: 8px 12px; background: rgba(0,0,0,0.03); border-left: 3px solid #e74c3c; border-radius: var(--radius-xs); font-size: 13px; font-style: italic; color: var(--secondary-text); line-height: 1.4;">"${r.mensaje_director}"</p>` : ''}
                            </div>
                        </div>
                        
                        ${actionsHTML}
                    </div>
                `;

                mainSectionHTML = `
                    <div class="main-card" style="background: var(--card-bg); border: 1px solid var(--card-border); border-radius: var(--radius-lg); padding: 24px; box-shadow: var(--shadow-sm);">
                        <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid var(--card-border); padding-bottom: 15px; margin-bottom: 20px;">
                            <h3 style="margin: 0; font-size: 18px; font-weight: 600; color: var(--text-color);">👁️ Rúbrica Configurada</h3>
                            ${isComite ? `
                            <button type="button" class="btn btn-danger btn-sm btn-delete-rubric" data-id="${r.id}" style="padding: 6px 12px; font-size: 13px; font-weight: 600; background-color: rgba(231,76,60,0.1); border: 1px solid rgba(231,76,60,0.2); color: #e74c3c; border-radius: var(--radius-md); cursor: pointer;">
                                🗑️ Eliminar Rúbrica
                            </button>
                            ` : ''}
                        </div>
                        
                        ${this.renderComiteRubricPreview()}
                        ${approvalCardHTML}
                    </div>
                `;
            } else {
                mainSectionHTML = `
                    <div style="padding: 40px; text-align: center; color: var(--secondary-text); background: var(--card-bg); border: 1px solid var(--card-border); border-radius: var(--radius-lg); box-shadow: var(--shadow-sm);">
                        <span style="font-size: 48px; display: block; margin-bottom: 15px;">📋</span>
                        <p style="font-size: 16px; margin: 0 0 20px 0; font-weight: 500;">No existe una rúbrica configurada para el NRC ${this.comiteSelectedNrc}.</p>
                        <button type="button" class="btn btn-primary" id="btnCreateComiteRubricForNrc" style="padding: 10px 24px; font-weight: 600; border-radius: var(--radius-md); font-family: 'Outfit', sans-serif;">
                            ➕ Crear Rúbrica para NRC ${this.comiteSelectedNrc}
                        </button>
                    </div>
                `;
            }
        }

        return `
            <div class="page-title" style="text-align: center; margin-bottom: 24px;">
                <h2 style="font-family: 'Outfit', sans-serif; font-weight: 700; background: linear-gradient(135deg, var(--primary-color), #764ba2); -webkit-background-clip: text; -webkit-text-fill-color: transparent;">Gestión de Rúbricas</h2>
                <p style="color: var(--secondary-text); margin-top: 8px;">Define y administra las rúbricas asociadas a los NRCs de la universidad.</p>
            </div>

            <!-- Seleccionadores -->
            <div class="main-card" style="background: var(--card-bg); border: 1px solid var(--card-border); border-radius: var(--radius-lg); padding: 20px; margin-bottom: 24px; box-shadow: var(--shadow-sm); display: flex; gap: 16px; flex-wrap: wrap;">
                <div class="form-group" style="flex: 1; min-width: 250px; margin-bottom: 0;">
                    <label for="comiteCourseSelect" style="display: block; font-weight: 600; margin-bottom: 8px; font-size: 13.5px;">Curso</label>
                    <select id="comiteCourseSelect" class="form-control" style="border-radius: var(--radius-md); width: 100%;">
                        <option value="">-- Selecciona un curso --</option>
                        ${courseOptions}
                    </select>
                </div>
                <div class="form-group" style="flex: 1; min-width: 250px; margin-bottom: 0;">
                    <label for="comiteNrcSelect" style="display: block; font-weight: 600; margin-bottom: 8px; font-size: 13.5px;">NRC</label>
                    <select id="comiteNrcSelect" class="form-control" style="border-radius: var(--radius-md); width: 100%;" ${!this.comiteSelectedCurso ? 'disabled' : ''}>
                        <option value="">-- Selecciona un NRC --</option>
                        ${nrcOptions}
                    </select>
                </div>
            </div>

            <!-- Main view area -->
            <div id="comite-main-view">
                ${mainSectionHTML}
            </div>
        `;
    }

    renderComiteRubricsList() {
        return '';
    }

    renderComiteRubricPreview() {
        const rubrica = this.comiteActiveRubric;
        if (!rubrica || !rubrica.criterios) return '';

        return `
            <div class="rubric-preview" style="border: none; padding: 0;">
                <h4 style="margin: 0 0 6px 0; color: var(--primary-color); font-size: 18px; font-weight: 700;">${rubrica.nombre_rubrica}</h4>
                ${rubrica.descripcion ? `<p class="text-muted" style="margin-bottom: 20px; font-size: 14px; line-height: 1.5;">${rubrica.descripcion}</p>` : ''}
                <div class="criterios-preview-list" style="display: flex; flex-direction: column; gap: 20px;">
                    ${rubrica.criterios.map((criterio, idx) => `
                        <div class="criterio-preview-card" style="border: 1px solid var(--card-border); border-radius: var(--radius-md); padding: 16px; background-color: var(--input-bg);">
                            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; border-bottom: 1px solid var(--card-border); padding-bottom: 8px;">
                                <h5 style="margin: 0; font-size: 15px; font-weight: 600; color: var(--text-color);">${idx + 1}. ${criterio.nombre_criterio}</h5>
                                <span style="font-weight: 700; color: var(--primary-color); font-size: 14px;">Peso: ${(criterio.peso * 100).toFixed(0)}%</span>
                            </div>
                            <p style="margin-bottom: 12px; font-size: 13.5px; color: var(--secondary-text); line-height: 1.4;">${criterio.descripcion_criterio || 'Sin descripción'}</p>
                            
                            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 12px;">
                                ${criterio.niveles?.map(nivel => `
                                    <div style="border: 1px solid var(--card-border); border-radius: var(--radius-sm); padding: 12px; background-color: var(--card-bg);">
                                        <div style="display: flex; justify-content: space-between; font-weight: 600; font-size: 13px; border-bottom: 1px dashed var(--card-border); padding-bottom: 4px; margin-bottom: 8px; color: var(--text-color);">
                                            <span>${nivel.nombre_nivel}</span>
                                            <span style="color: var(--primary-color);">${nivel.puntaje_min} - ${nivel.puntaje_max} pts</span>
                                        </div>
                                        <div style="font-size: 12px; color: var(--secondary-text); line-height: 1.4;">
                                            ${nivel.descriptores?.map(d => `<p style="margin: 0 0 4px 0;">• ${d}</p>`).join('') || 'Sin descriptores'}
                                        </div>
                                    </div>
                                `).join('') || ''}
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    }

    async saveComiteRubric() {
        const rubrica = this.configData.rubrica;

        if (!ValidatorUtils.isValidDescription(rubrica.nombre_rubrica)) {
            showErrorNotification(new Error('El nombre de la rúbrica es inválido: solo letras y puntuación básica, sin números ni símbolos'));
            return;
        }

        if (!rubrica.descripcion || !ValidatorUtils.isValidDescription(rubrica.descripcion)) {
            showErrorNotification(new Error('La descripción de la rúbrica es obligatoria y debe contener solo letras y puntuación básica'));
            return;
        }

        if (!rubrica.criterios || rubrica.criterios.length === 0) {
            showErrorNotification(new Error('Debe haber al menos un criterio'));
            return;
        }

        for (let i = 0; i < rubrica.criterios.length; i++) {
            const criterio = rubrica.criterios[i];

            if (!ValidatorUtils.isValidDescription(criterio.nombre_criterio)) {
                showErrorNotification(new Error(`Nombre del criterio ${i + 1} inválido: solo letras y puntuación básica, sin números ni símbolos`));
                return;
            }

            if (!criterio.descripcion_criterio || !ValidatorUtils.isValidDescription(criterio.descripcion_criterio)) {
                showErrorNotification(new Error(`La descripción del criterio "${criterio.nombre_criterio}" es obligatoria y debe contener solo letras y puntuación básica`));
                return;
            }

            if (!criterio.niveles || criterio.niveles.length === 0) {
                showErrorNotification(new Error(`El criterio "${criterio.nombre_criterio}" debe tener al menos un nivel`));
                return;
            }

            for (let j = 0; j < criterio.niveles.length; j++) {
                const nivel = criterio.niveles[j];

                if (!ValidatorUtils.isValidDescription(nivel.nombre_nivel)) {
                    showErrorNotification(new Error(`Nombre del nivel ${j + 1} en "${criterio.nombre_criterio}" inválido: solo letras y puntuación básica, sin números ni símbolos`));
                    return;
                }

                nivel.descriptores = nivel.descriptores.filter(d => d.trim() !== '');

                if (nivel.descriptores.length === 0) {
                    showErrorNotification(new Error(`El nivel "${nivel.nombre_nivel}" en "${criterio.nombre_criterio}" debe tener al menos un descriptor`));
                    return;
                }

                for (const desc of nivel.descriptores) {
                    if (!ValidatorUtils.isValidDescription(desc)) {
                        showErrorNotification(new Error(`Descriptor inválido en nivel "${nivel.nombre_nivel}": debe contener solo letras y puntuación básica, sin números ni símbolos`));
                        return;
                    }
                }
            }
        }

        const total = this.calculateTotalPeso();
        if (total !== 100) {
            showErrorNotification(new Error(`El peso total debe ser exactamente 100% (actual: ${total}%)`));
            return;
        }

        const btnSave = document.getElementById('btnSaveComiteRubric');
        if (btnSave) {
            btnSave.disabled = true;
            btnSave.innerHTML = '⏳ Guardando...';
        }

        try {
            if (this.comiteEditing) {
                await RubricaService.update(rubrica.id, rubrica);
                showSuccessNotification('✅ Rúbrica actualizada y re-enviada a revisión con éxito');
            } else {
                await RubricaService.create(rubrica);
                showSuccessNotification('✅ Rúbrica guardada y enviada a revisión exitosamente');
            }

            this.comiteCreating = false;
            this.comiteEditing = false;
            this.configData.rubrica = this.getEmptyRubrica();
            this.saveConfig();

            await this._loadExistingRubrics();
            this.reRender();
        } catch (error) {
            console.error('Error guardando rúbrica:', error);
            showErrorNotification(error);
        } finally {
            if (btnSave) {
                btnSave.disabled = false;
                btnSave.innerHTML = '💾 Guardar Rúbrica';
            }
        }
    }

    async submitReview(aprobado, mensaje) {
        const user = AuthService.getCurrentUser();
        const role = user?.rol;
        const rubricaId = this.comiteActiveRubric?.id;
        if (!rubricaId) return;

        let endpoint = '';
        if (role === 'DOCENTE_CIAC') {
            endpoint = `/rubricas/${rubricaId}/aprobar-ciac`;
        } else if (role === 'DIRECTOR_ESCUELA') {
            endpoint = `/rubricas/${rubricaId}/aprobar-director`;
        } else {
            showErrorNotification('Rol no autorizado para revisión.');
            return;
        }

        try {
            await ApiService.post(endpoint, { aprobado, mensaje });
            showSuccessNotification(`Rúbrica ${aprobado ? 'aprobada' : 'rechazada'} correctamente.`);
            this.showRejectionForm = false;
            await this._loadExistingRubrics();
        } catch (error) {
            console.error('Error al enviar revisión de rúbrica:', error);
            showErrorNotification(error.message || 'Error al procesar la revisión');
        }
    }

    attachComiteEventListeners() {
        if (this.comiteCreating || this.comiteEditing) {
            const addCriterio = document.getElementById('addCriterio');
            if (addCriterio) {
                addCriterio.addEventListener('click', () => this.addCriterio());
            }

            const mainContent = document.getElementById('main-content');
            if (mainContent) {
                if (this._inputHandler) {
                    mainContent.removeEventListener('input', this._inputHandler);
                }
                this._inputHandler = (e) => {
                    const target = e.target;
                    if (target.classList.contains('criterio-nombre')) {
                        const index = parseInt(target.dataset.criterioIndex);
                        const sanitized = ValidatorUtils.sanitizeText(target.value, true);
                        if (target.value !== sanitized) target.value = sanitized;
                        this.configData.rubrica.criterios[index].nombre_criterio = sanitized;
                    }
                    if (target.classList.contains('criterio-descripcion')) {
                        const index = parseInt(target.dataset.criterioIndex);
                        const sanitized = ValidatorUtils.sanitizeText(target.value, true);
                        if (target.value !== sanitized) target.value = sanitized;
                        this.configData.rubrica.criterios[index].descripcion_criterio = sanitized;
                    }
                    if (target.classList.contains('criterio-peso') || target.classList.contains('peso-slider')) {
                        const index = parseInt(target.dataset.criterioIndex);
                        let val = parseFloat(target.value);
                        if (val < 1) val = 1;
                        if (val > 100) val = 100;
                        if (parseFloat(target.value) !== val) target.value = val;
                        const peso = val / 100;
                        this.configData.rubrica.criterios[index].peso = peso;

                        const criterioBody = target.closest('.criterio-body');
                        if (criterioBody) {
                            const inputPeso = criterioBody.querySelector('.criterio-peso');
                            const sliderPeso = criterioBody.querySelector('.peso-slider');
                            if (inputPeso && inputPeso !== target) inputPeso.value = val;
                            if (sliderPeso && sliderPeso !== target) sliderPeso.value = val;
                        }
                        this.updatePesoTotal();
                    }
                    if (target.classList.contains('nivel-nombre')) {
                        const cIndex = parseInt(target.dataset.criterioIndex);
                        const nIndex = parseInt(target.dataset.nivelIndex);
                        const sanitized = ValidatorUtils.sanitizeText(target.value, true);
                        if (target.value !== sanitized) target.value = sanitized;
                        this.configData.rubrica.criterios[cIndex].niveles[nIndex].nombre_nivel = sanitized;
                    }
                    if (target.classList.contains('nivel-puntaje-min')) {
                        const cIndex = parseInt(target.dataset.criterioIndex);
                        const nIndex = parseInt(target.dataset.nivelIndex);
                        let val = parseFloat(target.value) || 0;
                        if (val < 0) val = 0;
                        if (val > 20) val = 20;
                        if (parseFloat(target.value) !== val) target.value = val;
                        this.configData.rubrica.criterios[cIndex].niveles[nIndex].puntaje_min = val;
                    }
                    if (target.classList.contains('nivel-puntaje-max')) {
                        const cIndex = parseInt(target.dataset.criterioIndex);
                        const nIndex = parseInt(target.dataset.nivelIndex);
                        let val = parseFloat(target.value) || 0;
                        if (val < 0) val = 0;
                        if (val > 20) val = 20;
                        if (parseFloat(target.value) !== val) target.value = val;
                        this.configData.rubrica.criterios[cIndex].niveles[nIndex].puntaje_max = val;
                    }
                    if (target.classList.contains('descriptor-input')) {
                        const cIndex = parseInt(target.dataset.criterioIndex);
                        const nIndex = parseInt(target.dataset.nivelIndex);
                        const dIndex = parseInt(target.dataset.descriptorIndex);
                        const sanitized = ValidatorUtils.sanitizeText(target.value, true);
                        if (target.value !== sanitized) target.value = sanitized;
                        this.configData.rubrica.criterios[cIndex].niveles[nIndex].descriptores[dIndex] = sanitized;
                    }
                };
                mainContent.addEventListener('input', this._inputHandler);

                if (this._clickHandler) {
                    mainContent.removeEventListener('click', this._clickHandler);
                }
                this._clickHandler = (e) => {
                    const target = e.target.closest('[data-action]');
                    if (!target) return;
                    e.preventDefault();
                    e.stopPropagation();

                    const action = target.dataset.action;
                    const cIndex = parseInt(target.dataset.criterioIndex);
                    const nIndex = parseInt(target.dataset.nivelIndex);
                    const dIndex = parseInt(target.dataset.descriptorIndex);

                    switch (action) {
                        case 'delete-criterio':
                            this.deleteCriterio(cIndex);
                            break;
                        case 'add-nivel':
                            this.addNivel(cIndex);
                            break;
                        case 'delete-nivel':
                            this.deleteNivel(cIndex, nIndex);
                            break;
                        case 'add-descriptor':
                            this.addDescriptor(cIndex, nIndex);
                            break;
                        case 'delete-descriptor':
                            this.deleteDescriptor(cIndex, nIndex, dIndex);
                            break;
                    }
                };
                mainContent.addEventListener('click', this._clickHandler);
            }

            const btnCancel = document.getElementById('btnCancelComiteRubric');
            if (btnCancel) {
                btnCancel.addEventListener('click', () => {
                    this.comiteCreating = false;
                    this.comiteEditing = false;
                    this.configData.rubrica = this.getEmptyRubrica();
                    this.saveConfig();
                    this.reRender();
                });
            }

            const btnSave = document.getElementById('btnSaveComiteRubric');
            if (btnSave) {
                btnSave.addEventListener('click', () => this.saveComiteRubric());
            }

        } else {
            const courseSelect = document.getElementById('comiteCourseSelect');
            if (courseSelect) {
                courseSelect.addEventListener('change', async (e) => {
                    const cursoId = e.target.value;
                    this.comiteSelectedCurso = cursoId;
                    this.comiteSelectedNrc = '';
                    this.comiteActiveRubric = null;
                    this.comiteNrcs = [];
                    if (cursoId) {
                        try {
                            const { CursoService } = await import('../services/curso.service.js');
                            this.comiteNrcs = await CursoService.getCourseNrcs(cursoId);
                        } catch (err) {
                            console.error('Error cargando NRCs:', err);
                        }
                    }
                    this.reRender();
                });
            }

            const nrcSelect = document.getElementById('comiteNrcSelect');
            if (nrcSelect) {
                nrcSelect.addEventListener('change', (e) => {
                    const nrcId = e.target.value;
                    this.comiteSelectedNrc = nrcId;
                    if (nrcId) {
                        this.comiteActiveRubric = this.existingRubrics.find(r => r.nrc_id === parseInt(nrcId));
                    } else {
                        this.comiteActiveRubric = null;
                    }
                    this.reRender();
                });
            }

            const btnCreateNrc = document.getElementById('btnCreateComiteRubricForNrc');
            if (btnCreateNrc) {
                btnCreateNrc.addEventListener('click', () => {
                    this.comiteCreating = true;
                    this.comiteEditing = false;
                    this.configData.rubrica = this.getEmptyRubrica();
                    this.configData.rubrica.nrc_id = parseInt(this.comiteSelectedNrc);
                    this.reRender();
                });
            }

            const btnUpdateRubric = document.getElementById('btnUpdateComiteRubric');
            if (btnUpdateRubric) {
                btnUpdateRubric.addEventListener('click', () => {
                    this.comiteEditing = true;
                    this.comiteCreating = false;
                    this.configData.rubrica = JSON.parse(JSON.stringify(this.comiteActiveRubric));
                    this.reRender();
                });
            }

            const btnDelete = document.querySelector('.btn-delete-rubric');
            if (btnDelete) {
                btnDelete.addEventListener('click', async (e) => {
                    const rubricId = parseInt(e.currentTarget.dataset.id);
                    if (confirm('¿Estás seguro de que deseas eliminar esta rúbrica de forma permanente?')) {
                        try {
                            await RubricaService.delete(rubricId);
                            showSuccessNotification('🗑️ Rúbrica eliminada exitosamente');
                            this.comiteActiveRubric = null;
                            await this._loadExistingRubrics();
                            this.reRender();
                        } catch (error) {
                            showErrorNotification(error);
                        }
                    }
                });
            }

            const btnApprove = document.getElementById('btnApproveRubric');
            if (btnApprove) {
                btnApprove.addEventListener('click', () => {
                    this.submitReview(true, null);
                });
            }

            const btnReject = document.getElementById('btnRejectRubric');
            if (btnReject) {
                btnReject.addEventListener('click', () => {
                    this.showRejectionForm = true;
                    this.reRender();
                });
            }

            const btnCancelReview = document.getElementById('btnCancelReview');
            if (btnCancelReview) {
                btnCancelReview.addEventListener('click', () => {
                    this.showRejectionForm = false;
                    this.reRender();
                });
            }

            const btnConfirmReject = document.getElementById('btnConfirmReject');
            if (btnConfirmReject) {
                btnConfirmReject.addEventListener('click', () => {
                    const commentInput = document.getElementById('review-comment');
                    const comment = commentInput ? commentInput.value.trim() : '';
                    if (!comment) {
                        showErrorNotification('El motivo del rechazo es obligatorio.');
                        return;
                    }
                    this.submitReview(false, comment);
                });
            }
        }
    }

    saveConfig() {
        StorageUtils.save('configData', this.configData);
    }
}
