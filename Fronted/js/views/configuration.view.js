import { DOMUtils } from '../utils/dom.utils.js';
import { StepIndicatorComponent } from '../components/step-indicator.component.js';
import { StorageUtils } from '../utils/storage.utils.js';

export class ConfigurationView {
    constructor(router) {
        this.router = router;
        this.currentStep = 0; // 0-3 para los 4 pasos
        this.configData = StorageUtils.load('configData') || {
            courseName: '',
            courseCode: '',
            instructor: '',
            semestre: '',
            topic: '',
            descripcion_tema: '',
            rubricFile: null
        };
    }

    render() {
        const steps = [
            { icon: '📚', title: 'Registro del curso' },
            { icon: '🎯', title: 'Registro del tópico' },
            { icon: '📋', title: 'Subir rúbrica' },
            { icon: '✓', title: 'Listo para análisis' }
        ];

        const stepIndicator = new StepIndicatorComponent(steps, this.currentStep);

        const html = `
            <div class="page-title">
                <h2>Configuración inicial</h2>
            </div>
            <p class="page-subtitle">Configura el curso, tema y rúbrica antes de comenzar el análisis de documentos</p>

            ${stepIndicator.render()}

            <div class="main-card">
                ${this.renderCurrentStep()}
            </div>
        `;

        DOMUtils.render('#main-content', html);
        this.attachEvents();
    }

    renderCurrentStep() {
        switch(this.currentStep) {
            case 0: return this.renderStep1();
            case 1: return this.renderStep2();
            case 2: return this.renderStep3();
            case 3: return this.renderStep4();
            default: return this.renderStep1();
        }
    }

    // PASO 1: Registro del curso con SPINNER
    renderStep1() {
        return `
            <div class="card-icon blue-icon">📚</div>
            <h3 class="card-title">Registro del curso</h3>
            <p class="card-subtitle">Ingresa la información básica del curso académico</p>

            <form id="step1-form" class="config-form">
                <div class="form-group">
                    <label class="form-label">Nombre del curso</label>
                    <input type="text"
                           class="form-input"
                           id="course-name"
                           value="${this.configData.courseName}"
                           placeholder="ej. Metodología de la Investigación"
                           required>
                </div>

                <div class="form-row">
                    <div class="form-group">
                        <label class="form-label">Código del curso</label>
                        <input type="text" 
                               class="form-input" 
                               id="course-code" 
                               value="${this.configData.courseCode}"
                               placeholder="ej. MET-101">
                    </div>

                    <div class="form-group">
                        <label class="form-label">Ciclo</label>
                        <input type="text" 
                               class="form-input" 
                               id="period" 
                               value="${this.configData.semestre}"
                               placeholder="ej. 2025-1"
                               required>
                    </div>
                </div>

                <div class="form-group">
                    <label class="form-label">Profesor</label>
                    <input type="text" 
                           class="form-input" 
                           id="instructor" 
                           value="${this.configData.instructor}"
                           placeholder="ej. Dr. Juan Pérez"
                           required>
                </div>

                <div class="nav-buttons">
                    ${this.currentStep > 0 ? `
                        <button type="button" class="btn btn-secondary" id="btn-back">
                            ← Anterior
                        </button>
                    ` : '<div></div>'}
                    <button type="submit" class="btn btn-primary">
                        Siguiente →
                    </button>
                </div>
            </form>
        `;
    }

    // PASO 2: Registro del tópico
    renderStep2() {
        return `
            <div class="card-icon teal-icon">🎯</div>
            <h3 class="card-title">Registro del tópico</h3>
            <p class="card-subtitle">Define el tema específico que será evaluado en los trabajos</p>

            <form id="step2-form" class="config-form">
                <div class="form-group">
                    <label class="form-label">Tópico/Tema</label>
                    <input type="text" 
                           class="form-input" 
                           id="topic" 
                           value="${this.configData.topic}"
                           placeholder="ej. Cambio Climático y Sostenibilidad"
                           required>
                </div>

                <div class="form-group">
                    <label class="form-label">Descripción del tópico</label>
                    <textarea class="form-input textarea" 
                              id="topic-description" 
                              placeholder="Describe los aspectos específicos que deben abordar los trabajos, objetivos de aprendizaje, y criterios temáticos importantes..."
                              rows="6"
                              required>${this.configData.descripcion_tema}</textarea>
                </div>

                <div class="nav-buttons">
                    <button type="button" class="btn btn-secondary" id="btn-back">
                        ← Anterior
                    </button>
                    <button type="submit" class="btn btn-primary">
                        Siguiente →
                    </button>
                </div>
            </form>
        `;
    }

    // PASO 3: Subir rúbrica (OPCIONAL)
    renderStep3() {
        return `
            <div class="card-icon orange-icon">📋</div>
            <h3 class="card-title">Subir rúbrica de evaluación</h3>
            <p class="card-subtitle">Carga el documento con los criterios de evaluación específicos (opcional)</p>

            <form id="step3-form" class="config-form">
                <div class="upload-area" id="rubric-upload-area">
                    <div class="upload-icon">⬆️</div>
                    <div class="upload-text">Seleccionar archivo de rúbrica</div>
                    <div class="upload-hint">PDF, DOC, DOCX (máx. 10MB) - Opcional</div>
                    <input type="file" 
                           id="rubric-input" 
                           accept=".pdf,.doc,.docx" 
                           style="display: none;">
                </div>

                ${this.configData.rubricFile ? `
                    <div class="file-display" style="margin-top: 20px;">
                        <div class="file-icon">📄</div>
                        <div class="file-info">
                            <div class="file-name">${this.configData.rubricFile.name}</div>
                            <div class="file-size">${this.formatFileSize(this.configData.rubricFile.size)}</div>
                        </div>
                        <button type="button" class="btn btn-secondary" id="btn-remove-rubric" style="padding: 8px 16px;">
                            🗑️ Eliminar
                        </button>
                    </div>
                ` : ''}

                <div class="nav-buttons">
                    <button type="button" class="btn btn-secondary" id="btn-back">
                        ← Anterior
                    </button>
                    <button type="submit" class="btn btn-primary">
                        Siguiente →
                    </button>
                </div>
            </form>
        `;
    }

    // PASO 4: Resumen y confirmación
    renderStep4() {
        return `
            <div class="card-icon green-icon">✓</div>
            <h3 class="card-title">Configuración completada</h3>
            <p class="card-subtitle">Revisa la información antes de proceder al análisis de documentos</p>

            <div class="summary-grid">
                <div class="summary-card">
                    <div class="summary-header">
                        <div class="summary-header-icon blue-icon">📚</div>
                        <h4 class="summary-title">Información del curso</h4>
                    </div>
                    <div class="summary-item">
                        <div class="summary-label">Curso:</div>
                        <div class="summary-value">${this.configData.courseName}</div>
                    </div>
                    <div class="summary-item">
                        <div class="summary-label">Código:</div>
                        <div class="summary-value">${this.configData.courseCode}</div>
                    </div>
                    <div class="summary-item">
                        <div class="summary-label">Profesor:</div>
                        <div class="summary-value">${this.configData.instructor}</div>
                    </div>
                    <div class="summary-item">
                        <div class="summary-label">Ciclo:</div>
                        <div class="summary-value">${this.configData.semestre}</div>
                    </div>
                </div>

                <div class="summary-card">
                    <div class="summary-header">
                        <div class="summary-header-icon teal-icon">🎯</div>
                        <h4 class="summary-title">Tópico de evaluación</h4>
                    </div>
                    <div class="summary-item">
                        <div class="summary-label">Tema:</div>
                        <div class="summary-value">${this.configData.topic}</div>
                    </div>
                    <div class="summary-item">
                        <div class="summary-label" style="margin-top: 10px;">${this.configData.descripcion_tema}</div>
                    </div>
                </div>

                <div class="summary-card" style="grid-column: span 2;">
                    <div class="summary-header">
                        <div class="summary-header-icon orange-icon">📋</div>
                        <h4 class="summary-title">Rúbrica de evaluación</h4>
                    </div>
                    <div class="file-display">
                        <div class="file-icon">📄</div>
                        <div class="file-info">
                            <div class="file-name">${this.configData.rubricFile?.name || 'Sin archivo'}</div>
                            <div class="file-size">${this.configData.rubricFile ? this.formatFileSize(this.configData.rubricFile.size) : ''}</div>
                        </div>
                    </div>
                </div>
            </div>

            <div class="nav-buttons">
                <button type="button" class="btn btn-secondary" id="btn-back">
                    ← Anterior
                </button>
                <button type="button" class="btn btn-primary" id="btn-finish">
                    Comenzar análisis →
                </button>
            </div>
        `;
    }

    attachEvents() {
        // Eventos según el paso actual
        switch(this.currentStep) {
            case 0: this.attachStep1Events(); break;
            case 1: this.attachStep2Events(); break;
            case 2: this.attachStep3Events(); break;
            case 3: this.attachStep4Events(); break;
        }
    }

    attachStep1Events() {
        const form = document.getElementById('step1-form');

        form?.addEventListener('submit', (e) => {
            e.preventDefault();
            this.saveStep1Data();
        });
    }

    attachStep2Events() {
        const form = document.getElementById('step2-form');
        
        form?.addEventListener('submit', (e) => {
            e.preventDefault();
            this.saveStep2Data();
        });

        document.getElementById('btn-back')?.addEventListener('click', () => {
            this.goToPreviousStep();
        });
    }

    attachStep3Events() {
        const uploadArea = document.getElementById('rubric-upload-area');
        const fileInput = document.getElementById('rubric-input');
        const form = document.getElementById('step3-form');

        uploadArea?.addEventListener('click', () => {
            fileInput?.click();
        });

        fileInput?.addEventListener('change', (e) => {
            if (e.target.files.length > 0) {
                this.handleRubricFile(e.target.files[0]);
            }
        });

        document.getElementById('btn-remove-rubric')?.addEventListener('click', () => {
            this.configData.rubricFile = null;
            StorageUtils.save('configData', this.configData);
            this.render();
        });

        form?.addEventListener('submit', (e) => {
            e.preventDefault();
            this.saveStep3Data();
        });

        document.getElementById('btn-back')?.addEventListener('click', () => {
            this.goToPreviousStep();
        });
    }

    attachStep4Events() {
        document.getElementById('btn-back')?.addEventListener('click', () => {
            this.goToPreviousStep();
        });

        document.getElementById('btn-finish')?.addEventListener('click', () => {
            this.finishConfiguration();
        });
    }

    // Guardar datos de cada paso
    saveStep1Data() {
        this.configData.courseName = document.getElementById('course-name').value;
        this.configData.courseCode = document.getElementById('course-code').value;
        this.configData.instructor = document.getElementById('instructor').value;
        this.configData.semestre = document.getElementById('period').value;
        console.log('Before saving Step 1 data:', this.configData);
        StorageUtils.save('configData', this.configData);
        console.log('After saving Step 1 data:', this.configData);
        this.goToNextStep();
    }

    saveStep2Data() {
        this.configData.topic = document.getElementById('topic').value;
        this.configData.descripcion_tema = document.getElementById('topic-description').value;

        console.log('Before saving Step 2 data:', this.configData);
        StorageUtils.save('configData', this.configData);
        console.log('After saving Step 2 data:', this.configData);
        this.goToNextStep();
    }

    saveStep3Data() {
        // Ya guardado en handleRubricFile
        this.goToNextStep();
    }

    handleRubricFile(file) {
        // Validar archivo
        const maxSize = 10 * 1024 * 1024;
        if (file.size > maxSize) {
            alert('El archivo excede el tamaño máximo de 10MB');
            return;
        }

        this.configData.rubricFile = {
            name: file.name,
            size: file.size,
            type: file.type,
            lastModified: file.lastModified
        };

        StorageUtils.save('configData', this.configData);
        this.render();
    }

    goToNextStep() {
        if (this.currentStep < 3) {
            this.currentStep++;
            this.render();
        }
    }

    goToPreviousStep() {
        if (this.currentStep > 0) {
            this.currentStep--;
            this.render();
        }
    }

    finishConfiguration() {
        // Marcar configuración como completada
        StorageUtils.save('configurationComplete', true);
        console.log('Before saving configData in finishConfiguration:', this.configData);
        StorageUtils.save('configData', this.configData);
        console.log('After saving configData in finishConfiguration:', this.configData);
        
        // Habilitar navegación a upload
        this.router.navigate('upload');
    }

    formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
    }
}