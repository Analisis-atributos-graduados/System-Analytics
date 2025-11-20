import { StorageUtils } from '../utils/storage.utils.js';
import RubricaService from '../services/rubrica.service.js';
import AuthService from '../services/auth.service.js';
import { showErrorNotification, showSuccessNotification } from '../utils/api.utils.js';
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

    render() {
        const steps = ['Información del curso', 'Detalles del tema', 'Configuración de rúbrica'];
        const stepIndicator = new StepIndicatorComponent(steps, this.currentStep);
        
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
                    ${this.renderStep()}
                </div>
                <div class="card-footer">
                    ${this.renderFooter()}
                </div>
            </div>
        `;
    }

    renderStep() {
        switch (this.currentStep) {
            case 0: return this.renderStep1();
            case 1: return this.renderStep2();
            case 2: return this.renderStep3();
            default: return '';
        }
    }

    renderStep1() {
        const user = AuthService.getCurrentUser();
        
        return `
            <div class="form-group">
                <label for="courseName">Nombre del curso *</label>
                <input type="text" id="courseName" value="${this.configData.courseName || ''}" 
                       placeholder="Ej: Cálculo Avanzado" required>
            </div>

            <div class="form-group">
                <label for="courseCode">Código del curso *</label>
                <input type="text" id="courseCode" value="${this.configData.courseCode || ''}" 
                       placeholder="Ej: CA-301" required>
            </div>

            <div class="form-group">
                <label for="instructor">Instructor *</label>
                <input type="text" id="instructor" value="${user?.nombre || this.configData.instructor || ''}" 
                       placeholder="Nombre del instructor" required>
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
                                min="0" max="100" step="5" required>
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
                            value="${nivel.puntaje_min}" min="0" step="0.5" 
                            placeholder="Min" required>
                        <span>-</span>
                        <input type="number" class="nivel-puntaje-max" 
                            data-criterio-index="${criterioIndex}" data-nivel-index="${nivelIndex}"
                            value="${nivel.puntaje_max}" min="0" step="0.5" 
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
                    <label>Descriptores (qué debe lograr el estudiante)</label>
                    <div class="descriptores-list">
                        ${nivel.descriptores.map((desc, dIndex) => `
                            <div class="descriptor-item">
                                <span class="descriptor-bullet">•</span>
                                <input type="text" class="descriptor-input" 
                                    data-criterio-index="${criterioIndex}" 
                                    data-nivel-index="${nivelIndex}"
                                    data-descriptor-index="${dIndex}"
                                    value="${desc || ''}" 
                                    placeholder="Descriptor ${dIndex + 1}">
                                <button type="button" class="btn-icon btn-delete-small" 
                                        data-action="delete-descriptor"
                                        data-criterio-index="${criterioIndex}" 
                                        data-nivel-index="${nivelIndex}"
                                        data-descriptor-index="${dIndex}">
                                    ✕
                                </button>
                            </div>
                        `).join('')}
                    </div>
                    <button type="button" class="btn btn-sm btn-secondary" 
                            data-action="add-descriptor" 
                            data-criterio-index="${criterioIndex}" 
                            data-nivel-index="${nivelIndex}">
                        ➕ Agregar descriptor
                    </button>
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
                this.configData.rubrica.nombre_rubrica = e.target.value;
                this.saveConfig();
            });
        }

        if (rubricDesc) {
            rubricDesc.addEventListener('input', (e) => {
                this.configData.rubrica.descripcion = e.target.value;
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
                    this.configData.rubrica.criterios[index].nombre_criterio = target.value;
                    this.saveConfig();
                }
                
                // Descripción de criterio
                if (target.classList.contains('criterio-descripcion')) {
                    const index = parseInt(target.dataset.criterioIndex);
                    this.configData.rubrica.criterios[index].descripcion_criterio = target.value;
                    this.saveConfig();
                }
                
                // Peso de criterio
                if (target.classList.contains('criterio-peso') || target.classList.contains('peso-slider')) {
                    const index = parseInt(target.dataset.criterioIndex);
                    const peso = parseFloat(target.value) / 100;
                    this.configData.rubrica.criterios[index].peso = peso;
                    
                    // Sincronizar input y slider
                    const criterioBody = target.closest('.criterio-body');
                    if (criterioBody) {
                        const inputPeso = criterioBody.querySelector('.criterio-peso');
                        const sliderPeso = criterioBody.querySelector('.peso-slider');
                        if (inputPeso) inputPeso.value = target.value;
                        if (sliderPeso) sliderPeso.value = target.value;
                    }
                    
                    this.updatePesoTotal();
                    this.saveConfig();
                }
                
                // Nombre de nivel
                if (target.classList.contains('nivel-nombre')) {
                    const cIndex = parseInt(target.dataset.criterioIndex);
                    const nIndex = parseInt(target.dataset.nivelIndex);
                    this.configData.rubrica.criterios[cIndex].niveles[nIndex].nombre_nivel = target.value;
                    this.saveConfig();
                }
                
                // Puntajes de nivel
                if (target.classList.contains('nivel-puntaje-min')) {
                    const cIndex = parseInt(target.dataset.criterioIndex);
                    const nIndex = parseInt(target.dataset.nivelIndex);
                    this.configData.rubrica.criterios[cIndex].niveles[nIndex].puntaje_min = parseFloat(target.value) || 0;
                    this.saveConfig();
                }
                
                if (target.classList.contains('nivel-puntaje-max')) {
                    const cIndex = parseInt(target.dataset.criterioIndex);
                    const nIndex = parseInt(target.dataset.nivelIndex);
                    this.configData.rubrica.criterios[cIndex].niveles[nIndex].puntaje_max = parseFloat(target.value) || 0;
                    this.saveConfig();
                }
                
                // Descriptores
                if (target.classList.contains('descriptor-input')) {
                    const cIndex = parseInt(target.dataset.criterioIndex);
                    const nIndex = parseInt(target.dataset.nivelIndex);
                    const dIndex = parseInt(target.dataset.descriptorIndex);
                    this.configData.rubrica.criterios[cIndex].niveles[nIndex].descriptores[dIndex] = target.value;
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
        this.configData.rubrica.criterios[criterioIndex].niveles[nivelIndex].descriptores.push('');
        this.reRender();
        this.saveConfig();
    }

    deleteDescriptor(criterioIndex, nivelIndex, descriptorIndex) {
        const descriptores = this.configData.rubrica.criterios[criterioIndex].niveles[nivelIndex].descriptores;
        
        if (descriptores.length <= 1) {
            showErrorNotification(new Error('Debe haber al menos un descriptor'));
            return;
        }

        descriptores.splice(descriptorIndex, 1);
        this.reRender();
        this.saveConfig();
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

    reRender() {
        console.log('🔄 Re-renderizando vista...');
        
        const container = document.getElementById('main-content');
        if (container) {
            container.innerHTML = this.render();
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
            this.configData.courseName = document.getElementById('courseName')?.value;
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
            const fields = ['courseName', 'courseCode', 'instructor', 'semestre'];
            for (const field of fields) {
                const element = document.getElementById(field);
                if (!element || !element.value.trim()) {
                    showErrorNotification(new Error(`El campo es obligatorio`));
                    element?.focus();
                    return false;
                }
            }
        } else if (this.currentStep === 1) {
            const topic = document.getElementById('topic');
            if (!topic || !topic.value.trim()) {
                showErrorNotification(new Error('El tema de la evaluación es obligatorio'));
                topic?.focus();
                return false;
            }
        }

        return true;
    }

    async finish() {
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
                
                if (!rubrica.nombre_rubrica) {
                    showErrorNotification(new Error('El nombre de la rúbrica es obligatorio'));
                    return;
                }

                if (!rubrica.criterios || rubrica.criterios.length === 0) {
                    showErrorNotification(new Error('Debe haber al menos un criterio'));
                    return;
                }

                // Validar cada criterio
                for (let i = 0; i < rubrica.criterios.length; i++) {
                    const criterio = rubrica.criterios[i];
                    
                    if (!criterio.nombre_criterio) {
                        showErrorNotification(new Error(`El criterio ${i + 1} necesita un nombre`));
                        return;
                    }

                    if (!criterio.niveles || criterio.niveles.length === 0) {
                        showErrorNotification(new Error(`El criterio "${criterio.nombre_criterio}" debe tener al menos un nivel`));
                        return;
                    }

                    // Validar niveles
                    for (let j = 0; j < criterio.niveles.length; j++) {
                        const nivel = criterio.niveles[j];
                        
                        if (!nivel.nombre_nivel) {
                            showErrorNotification(new Error(`El nivel ${j + 1} del criterio "${criterio.nombre_criterio}" necesita un nombre`));
                            return;
                        }

                        // Filtrar descriptores vacíos
                        nivel.descriptores = nivel.descriptores.filter(d => d.trim() !== '');
                    }
                }

                const total = this.calculateTotalPeso();
                if (Math.abs(total - 100) > 1) {
                    showErrorNotification(new Error(`El peso total debe ser 100% (actual: ${total}%)`));
                    return;
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
                        return;
                    }
                }
            }

            this.saveConfig();
            
            showSuccessNotification('✅ Configuración completada exitosamente');
            
            setTimeout(() => {
                this.router.navigate('upload');
            }, 1000);

        } catch (error) {
            console.error('Error en finish:', error);
            showErrorNotification(error);
        }
    }

    saveConfig() {
        StorageUtils.save('configData', this.configData);
    }
}
