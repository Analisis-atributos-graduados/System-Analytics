import { StorageUtils } from '../utils/storage.utils.js';
import RubricaService from '../services/rubrica.service.js';
import AuthService from '../services/auth.service.js';
import { showErrorNotification, showSuccessNotification } from '../utils/api.utils.js';
import { ValidatorUtils } from '../utils/validator.utils.js';
import { StepIndicatorComponent } from '../components/step-indicator.component.js';

export class ConfigurationView {
    constructor(router) {
        this.router = router;
        this.currentStep = 0;
        this.existingRubrics = [];
        this.configData = StorageUtils.load('configData') || {
            courseName: '',
            courseCode: '',
            instructor: '',
            semestre: '',
            topic: '',
            descripcion_tema: '',
            rubrica_id: null,
            rubrica: this.getEmptyRubrica()
        };

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
                    peso: 0.15,  // 15% por defecto
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
            this.existingRubrics = await RubricaService.getAll();
            console.log('✅ Rúbricas cargadas:', this.existingRubrics.length);

            if (this.currentStep === 2) {
                this.render();
                this.attachEventListeners();
            }
        } catch (error) {
            console.error('Error cargando rúbricas:', error);
        }
    }

    async render() {
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
        try {
            // ✅ Cargar cursos habilitados desde el backend
            const CursoService = (await import('../services/curso.service.js')).CursoService;
            courses = await CursoService.getEnabled();
        } catch (error) {
            console.error('Error cargando cursos:', error);
            showErrorNotification('No se pudieron cargar los cursos. Usando lista local.');
            // Fallback local si falla el backend
            courses = [
                { id: 0, nombre: 'Cálculo Avanzado', codigo: 'MAT301' },
                { id: 0, nombre: 'Física II', codigo: 'FIS202' }
            ];
        }

        // Si courses viene vacío o nulo
        if (!courses) courses = [];

        // Mapear a formato simple si es necesario, pero el backend devuelve objetos completos
        // El select value será el ID del curso ahora, no el nombre
        // Pero espera, el backend espera curso_id.
        // Debemos guardar curso_id en configData.

        // Generar HTML del select
        const options = courses.map(c => `
            <option value="${c.id}" 
                ${this.configData.curso_id == c.id ? 'selected' : ''}
                data-codigo="${c.codigo || ''}">
                ${c.nombre}
            </option>
        `).join('');

        return `
            <div class="form-group">
                <label for="courseName">Nombre del curso *</label>
                <select id="courseName" required class="form-control">
                    <option value="">-- Selecciona un curso --</option>
                    ${options}
                </select>
            </div>

            <div class="form-group">
                <label for="courseCode">Código del curso *</label>
                <input type="text" id="courseCode" value="${this.configData.courseCode || ''}" 
                       placeholder="Ej: 1234 o 12345" pattern="[0-9]{4,5}" maxlength="5" required>
                <small class="text-muted">Ingrese un código numérico de 4 a 5 dígitos</small>
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
                <div class="empty-state">
                    <p>📋 No tienes rúbricas guardadas aún.</p>
                    <p>Selecciona "Crear nueva rúbrica" para comenzar.</p>
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
        // ✅ ASEGURAR QUE niveles EXISTA
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
        // ✅ ASEGURAR QUE descriptores EXISTA
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
        // Navegación
        const btnBack = document.getElementById('btnBack');
        const btnNext = document.getElementById('btnNext');
        const btnFinish = document.getElementById('btnFinish');

        if (btnBack) btnBack.addEventListener('click', () => this.previousStep());
        if (btnNext) btnNext.addEventListener('click', () => this.nextStep());
        if (btnFinish) btnFinish.addEventListener('click', () => this.finish());

        // ✅ Sanitización y Lógica para Step 1: Nombre del curso
        if (this.currentStep === 0) {
            const courseSelect = document.getElementById('courseName');
            const courseCodeInput = document.getElementById('courseCode');

            if (courseSelect) {
                courseSelect.addEventListener('change', (e) => {
                    const selectedOption = e.target.options[e.target.selectedIndex];
                    const cursoId = selectedOption.value;
                    const nombre = selectedOption.text;
                    const codigo = selectedOption.dataset.codigo || '';

                    if (cursoId) {
                        this.configData.curso_id = parseInt(cursoId);
                        this.configData.courseName = nombre; // Mantener para compatibilidad visual si se necesita
                        this.configData.courseCode = codigo;

                        if (courseCodeInput) {
                            courseCodeInput.value = codigo;
                        }
                    } else {
                        this.configData.curso_id = null;
                        this.configData.courseName = '';
                        this.configData.courseCode = '';
                        if (courseCodeInput) courseCodeInput.value = '';
                    }

                    this.saveConfig();
                });
            }
        }

        // ✅ Sanitización para Step 2: Tema y Descripción del tema
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
        // Radio buttons
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

        // Selector de rúbrica existente
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

        // Formulario de nueva rúbrica
        this.attachNewRubricListeners();
    }

    attachNewRubricListeners() {
        const rubricName = document.getElementById('rubricName');
        const rubricDesc = document.getElementById('rubricDesc');

        if (rubricName) {
            rubricName.addEventListener('input', (e) => {
                // ✅ Sanitizar nombre de rúbrica
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
                // ✅ Sanitizar descripción (eliminar números, símbolos y múltiples espacios)
                const sanitized = ValidatorUtils.sanitizeText(e.target.value);
                if (e.target.value !== sanitized) {
                    e.target.value = sanitized;
                }
                this.configData.rubrica.descripcion = sanitized;
                this.saveConfig();
            });
        }

        // Botón agregar criterio
        const addCriterio = document.getElementById('addCriterio');
        if (addCriterio) {
            addCriterio.addEventListener('click', () => this.addCriterio());
        }

        // ✅ USAR EVENT DELEGATION PARA EVITAR DUPLICADOS
        // Remover listener antiguo si existe
        const mainContent = document.getElementById('main-content');
        if (mainContent) {
            // Crear una función nombrada para poder removerla
            if (this._inputHandler) {
                mainContent.removeEventListener('input', this._inputHandler);
            }

            this._inputHandler = (e) => {
                const target = e.target;

                // Nombre de criterio
                if (target.classList.contains('criterio-nombre')) {
                    const index = parseInt(target.dataset.criterioIndex);
                    // ✅ Sanitizar nombre de criterio
                    const sanitized = ValidatorUtils.sanitizeText(target.value, true);
                    if (target.value !== sanitized) {
                        target.value = sanitized;
                    }
                    this.configData.rubrica.criterios[index].nombre_criterio = sanitized;
                    this.saveConfig();
                }

                // Descripción de criterio
                if (target.classList.contains('criterio-descripcion')) {
                    const index = parseInt(target.dataset.criterioIndex);
                    // ✅ Sanitizar descripción (eliminar números, símbolos y múltiples espacios)
                    const sanitized = ValidatorUtils.sanitizeText(target.value, true);
                    if (target.value !== sanitized) {
                        target.value = sanitized;
                    }
                    this.configData.rubrica.criterios[index].descripcion_criterio = sanitized;
                    this.saveConfig();
                }

                // Peso de criterio
                if (target.classList.contains('criterio-peso') || target.classList.contains('peso-slider')) {
                    const index = parseInt(target.dataset.criterioIndex);
                    let val = parseFloat(target.value);

                    // Validar rango 1-100
                    if (val < 1) val = 1;
                    if (val > 100) val = 100;

                    // Actualizar valor en el input si fue corregido
                    if (parseFloat(target.value) !== val) {
                        target.value = val;
                    }

                    const peso = val / 100;
                    this.configData.rubrica.criterios[index].peso = peso;

                    // Sincronizar input y slider
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

                // Nombre de nivel
                if (target.classList.contains('nivel-nombre')) {
                    const cIndex = parseInt(target.dataset.criterioIndex);
                    const nIndex = parseInt(target.dataset.nivelIndex);
                    // ✅ Sanitizar nombre de nivel
                    const sanitized = ValidatorUtils.sanitizeText(target.value, true);
                    if (target.value !== sanitized) {
                        target.value = sanitized;
                    }
                    this.configData.rubrica.criterios[cIndex].niveles[nIndex].nombre_nivel = sanitized;
                    this.saveConfig();
                }

                // Puntajes de nivel
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

                // ✅ NUEVO: Sanitizar inputs numéricos (eliminar ceros a la izquierda)
                if (target.type === 'number') {
                    const val = target.value;
                    if (val.length > 1 && val.startsWith('0') && !val.startsWith('0.')) {
                        target.value = parseFloat(val);
                    }
                }

                // Descriptores
                if (target.classList.contains('descriptor-input')) {
                    const cIndex = parseInt(target.dataset.criterioIndex);
                    const nIndex = parseInt(target.dataset.nivelIndex);
                    const dIndex = parseInt(target.dataset.descriptorIndex);
                    // ✅ Sanitizar descriptor (eliminar números, símbolos y múltiples espacios)
                    const sanitized = ValidatorUtils.sanitizeText(target.value, true);
                    if (target.value !== sanitized) {
                        target.value = sanitized;
                    }
                    this.configData.rubrica.criterios[cIndex].niveles[nIndex].descriptores[dIndex] = sanitized;
                    this.saveConfig();
                }
            };

            mainContent.addEventListener('input', this._inputHandler);

            // Event delegation para clicks
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

                console.log('🔘 Acción:', action, 'Criterio:', cIndex, 'Nivel:', nIndex);

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
        console.log('➕ Agregando criterio');

        const newCriterio = {
            id: Date.now() + Math.random(), // ✅ ID único
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

        console.log('✅ Criterio agregado. Total criterios:', this.configData.rubrica.criterios.length);

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
            id: Date.now() + Math.random(), // ✅ ID único
            nombre_nivel: '',
            puntaje_min: 0,
            puntaje_max: 0,
            descriptores: [''],
            orden: niveles.length + 1
        };

        niveles.push(newNivel);

        console.log('✅ Nivel agregado. Total niveles:', niveles.length);

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
        // Deshabilitado: Solo un descriptor por nivel
        console.warn('Solo se permite un descriptor por nivel');
    }

    deleteDescriptor(criterioIndex, nivelIndex, descriptorIndex) {
        // Deshabilitado: No se puede eliminar el único descriptor
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
        console.log('🔄 Re-renderizando vista...');

        const container = document.getElementById('main-content');
        if (container) {
            container.innerHTML = await this.render();
            this.attachEventListeners();
            console.log('✅ Vista re-renderizada');
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

        // Guardar datos del paso actual
        if (this.currentStep === 0) {
            // ✅ CORREGIDO: Obtener el TEXTO del curso, no el valor (ID)
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
            // Validar que se haya seleccionado un curso
            const courseName = document.getElementById('courseName');
            if (!courseName?.value) {
                showErrorNotification(new Error('Debe seleccionar un curso'));
                courseName?.focus();
                return false;
            }

            // Validar Código del Curso
            const courseCode = document.getElementById('courseCode');
            if (!ValidatorUtils.isValidCourseCode(courseCode?.value)) {
                showErrorNotification(new Error('Código de curso inválido: debe ser un número de 4 a 5 dígitos'));
                courseCode?.focus();
                return false;
            }

            // Validar Instructor (Ahora es read-only, pero validamos igual)
            const instructor = document.getElementById('instructor');
            if (!instructor.value.trim()) {
                // Si está vacío, intentar llenarlo con el usuario actual
                const user = AuthService.getCurrentUser();
                if (user?.nombre) {
                    instructor.value = user.nombre;
                } else {
                    showErrorNotification(new Error('El nombre del instructor es requerido'));
                    return false;
                }
            }

            // Validar Semestre
            const semestre = document.getElementById('semestre');
            if (!ValidatorUtils.isValidSemester(semestre?.value)) {
                showErrorNotification(new Error('Semestre inválido (ej: 2025-1)'));
                semestre?.focus();
                return false;
            }

        } else if (this.currentStep === 1) {
            // Validar Tema
            const topic = document.getElementById('topic');
            if (!ValidatorUtils.isValidDescription(topic?.value)) {
                showErrorNotification(new Error('Tema inválido: solo letras y puntuación básica, sin números ni símbolos'));
                topic?.focus();
                return false;
            }

            // Validar Descripción (OBLIGATORIO)
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
                    showErrorNotification(new Error('Selecciona una rúbrica existente'));
                    return;
                }
            } else {
                // Validar rúbrica nueva
                const rubrica = this.configData.rubrica;

                if (!ValidatorUtils.isValidDescription(rubrica.nombre_rubrica)) {
                    showErrorNotification(new Error('El nombre de la rúbrica es inválido: solo letras y puntuación básica, sin números ni símbolos'));
                    return;
                }

                // ✅ REQUERIR descripción de rúbrica
                if (!rubrica.descripcion || !ValidatorUtils.isValidDescription(rubrica.descripcion)) {
                    showErrorNotification(new Error('La descripción de la rúbrica es obligatoria y debe contener solo letras y puntuación básica'));
                    return;
                }

                if (!rubrica.criterios || rubrica.criterios.length === 0) {
                    showErrorNotification(new Error('Debe haber al menos un criterio'));
                    return;
                }

                // Validar cada criterio
                for (let i = 0; i < rubrica.criterios.length; i++) {
                    const criterio = rubrica.criterios[i];

                    if (!ValidatorUtils.isValidDescription(criterio.nombre_criterio)) {
                        showErrorNotification(new Error(`Nombre del criterio ${i + 1} inválido: solo letras y puntuación básica, sin números ni símbolos`));
                        return;
                    }

                    // ✅ REQUERIR descripción de criterio
                    if (!criterio.descripcion_criterio || !ValidatorUtils.isValidDescription(criterio.descripcion_criterio)) {
                        showErrorNotification(new Error(`La descripción del criterio "${criterio.nombre_criterio}" es obligatoria y debe contener solo letras y puntuación básica`));
                        return;
                    }

                    if (!criterio.niveles || criterio.niveles.length === 0) {
                        showErrorNotification(new Error(`El criterio "${criterio.nombre_criterio}" debe tener al menos un nivel`));
                        return;
                    }

                    // Validar niveles
                    for (let j = 0; j < criterio.niveles.length; j++) {
                        const nivel = criterio.niveles[j];

                        if (!ValidatorUtils.isValidDescription(nivel.nombre_nivel)) {
                            showErrorNotification(new Error(`Nombre del nivel ${j + 1} en "${criterio.nombre_criterio}" inválido: solo letras y puntuación básica, sin números ni símbolos`));
                            return;
                        }

                        // Filtrar descriptores vacíos y validar
                        nivel.descriptores = nivel.descriptores.filter(d => d.trim() !== '');

                        // ✅ REQUERIR al menos un descriptor no vacío
                        if (nivel.descriptores.length === 0) {
                            showErrorNotification(new Error(`El nivel "${nivel.nombre_nivel}" en "${criterio.nombre_criterio}" debe tener al menos un descriptor`));
                            return;
                        }

                        // ✅ Validar descriptores con isValidDescription
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

                // ✅ Todas las validaciones pasaron - AHORA bloquear el botón
                if (btnFinish) {
                    btnFinish.disabled = true;
                    btnFinish.innerHTML = '⏳ Procesando...';
                }

                // Guardar rúbrica si está marcado
                const saveRubric = document.getElementById('saveRubric');
                if (saveRubric && saveRubric.checked) {
                    try {
                        const savedRubrica = await RubricaService.create(rubrica);
                        this.configData.rubrica_id = savedRubrica.id;
                        showSuccessNotification('✅ Rúbrica guardada exitosamente');
                    } catch (error) {
                        console.error('Error guardando rúbrica:', error);
                        showErrorNotification(error);
                        // Reabilitar botón en caso de error
                        if (btnFinish) {
                            btnFinish.disabled = false;
                            btnFinish.innerHTML = '✅ Finalizar configuración';
                        }
                        return;
                    }
                }
            }

            // ✅ Si usó rúbrica existente, también bloquear aquí
            if (btnFinish && !btnFinish.disabled) {
                btnFinish.disabled = true;
                btnFinish.innerHTML = '⏳ Procesando...';
            }

            this.saveConfig();

            showSuccessNotification('✅ Configuración completada exitosamente');

            setTimeout(() => {
                this.router.navigate('upload');
            }, 1000);

        } catch (error) {
            console.error('Error en finish:', error);
            showErrorNotification(error);
            // Reabilitar botón en caso de error
            if (btnFinish) {
                btnFinish.disabled = false;
                btnFinish.innerHTML = '✅ Finalizar configuración';
            }
        }
    }

    saveConfig() {
        StorageUtils.save('configData', this.configData);
    }
}
