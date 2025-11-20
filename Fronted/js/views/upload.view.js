import { DOMUtils } from '../utils/dom.utils.js';
import { StorageUtils } from '../utils/storage.utils.js';
import DocumentService from '../services/document.service.js';
import { showErrorNotification, showSuccessNotification } from '../utils/api.utils.js';

export class UploadView {
    constructor(router) {
        this.router = router;
        this.courseData = StorageUtils.load('configData') || {};
        this.selectedFiles = []; // ✅ Archivos seleccionados pero NO subidos
        this.studentList = '';
        this.documentType = null;
    }

    render() {
        this.courseData = StorageUtils.load('configData') || {};
        
        // Validar que haya configuración
        if (!this.courseData.courseName || !this.courseData.rubrica_id) {
            return this.renderMissingConfig();
        }

        const uploadSectionVisible = this.documentType !== null;
        const studentListVisible = this.documentType === 'examen';

        const html = `
            <div class="course-banner">
                <div class="banner-content">
                    <div class="banner-title">${this.courseData.courseName || 'Sin curso'} (${this.courseData.courseCode || 'N/A'})</div>
                    <div class="banner-info">
                        <span>Tema: ${this.courseData.topic || 'N/A'} •</span>
                        <span>Profesor: ${this.courseData.instructor || 'N/A'} •</span>
                        <span>Ciclo: ${this.courseData.semestre || 'N/A'}</span>
                    </div>
                    <div class="banner-rubric">
                        📋 Rúbrica: ${this.courseData.rubrica?.nombre_rubrica || 'Configurada (ID: ' + this.courseData.rubrica_id + ')'}
                    </div>
                </div>
                <button class="banner-badge" id="btnEditConfig">
                    ⚙️ Editar configuración
                </button>
            </div>

            <div class="page-title">
                <h2>Carga de documentos</h2>
            </div>
            <p class="page-subtitle">Sube trabajos académicos para obtener evaluaciones automatizadas con IA.</p>

            <div class="document-type-selection">
                <p class="section-label">Tipo de documento que se va a evaluar</p>
                <div class="button-group">
                    <button class="btn btn-secondary ${this.documentType === 'examen' ? 'active' : ''}" id="btn-type-exam">
                        ✍️ Exámenes manuscritos
                    </button>
                    <button class="btn btn-secondary ${this.documentType === 'ensayo/informe' ? 'active' : ''}" id="btn-type-essay">
                        📄 Informes / Ensayos
                    </button>
                </div>
            </div>

            <div id="upload-content" class="${uploadSectionVisible ? '' : 'hidden'}">
                <div class="main-card">
                    <div class="card-header">
                        <h3>Archivos a evaluar</h3>
                    </div>
                    <div class="card-body">
                        ${this.renderUploadArea()}
                        ${this.renderFilesList()}
                    </div>
                </div>

                ${studentListVisible ? this.renderStudentList() : ''}

                <div class="action-section">
                    <button class="btn btn-primary btn-large" id="btnStartEvaluation" 
                            ${this.canStartEvaluation() ? '' : 'disabled'}>
                        🚀 Iniciar evaluación
                    </button>
                    ${!this.canStartEvaluation() ? `
                        <p class="warning-text">
                            ${this.getWarningMessage()}
                        </p>
                    ` : ''}
                </div>
            </div>
        `;

        return html;
    }

    renderMissingConfig() {
        return `
            <div class="empty-state">
                <div class="empty-icon">⚠️</div>
                <h2>Configuración incompleta</h2>
                <p>Antes de subir archivos, necesitas completar la configuración del curso y seleccionar una rúbrica.</p>
                <button class="btn btn-primary" id="btnGoToConfig">
                    ⚙️ Ir a configuración
                </button>
            </div>
        `;
    }

    renderUploadArea() {
        return `
            <div class="upload-area" id="uploadArea">
                <input type="file" id="fileInput" multiple 
                    accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document" 
                    style="display: none;">
                <div class="upload-icon">📁</div>
                <h3>Arrastra tus archivos aquí</h3>
                <p>Soporta PDF y Word (.pdf, .doc, .docx)</p>
                <button class="btn btn-secondary" id="btnSelectFiles">Seleccionar archivos</button>
            </div>
        `;
    }

    renderFilesList() {
        // ✅ CAMBIO: Mostrar selectedFiles en lugar de uploadedFiles
        if (this.selectedFiles.length === 0) {
            return '';
        }

        return `
            <div class="files-list">
                <h4>Archivos seleccionados (${this.selectedFiles.length})</h4>
                <div class="files-grid">
                    ${this.selectedFiles.map((file, index) => `
                        <div class="file-card">
                            <div class="file-icon">${this.getFileIcon(file.name)}</div>
                            <div class="file-info">
                                <div class="file-name">${file.name}</div>
                                <div class="file-size">${this.formatFileSize(file.size)}</div>
                            </div>
                            <span class="file-status pending">Pendiente</span>
                            <button class="btn-icon btn-delete" data-index="${index}">
                                🗑️
                            </button>
                        </div>
                    `).join('')}
                </div>
                <small class="text-muted">Los archivos se subirán al iniciar la evaluación</small>
            </div>
        `;
    }

    renderStudentList() {
        return `
            <div class="main-card">
                <div class="card-header">
                    <h3>Lista de estudiantes</h3>
                </div>
                <div class="card-body">
                    <p class="info-text">
                        Ingresa la lista de estudiantes (uno por línea) en el orden que aparecen en los exámenes.
                    </p>
                    <textarea id="studentListInput" rows="10" 
                              placeholder="Juan Pérez&#10;María García&#10;Pedro Rodríguez&#10;...">${this.studentList}</textarea>
                    <small class="text-muted">
                        El sistema intentará emparejar automáticamente cada examen con el estudiante correspondiente.
                    </small>
                </div>
            </div>
        `;
    }

    canStartEvaluation() {
        if (this.selectedFiles.length === 0) return false;
        if (this.documentType === 'examen' && !this.studentList.trim()) return false;
        if (!this.courseData.rubrica_id) return false;
        return true;
    }

    getWarningMessage() {
        if (this.selectedFiles.length === 0) {
            return '⚠️ Selecciona al menos un archivo PDF';
        }
        if (this.documentType === 'examen' && !this.studentList.trim()) {
            return '⚠️ Ingresa la lista de estudiantes';
        }
        if (!this.courseData.rubrica_id) {
            return '⚠️ Configura una rúbrica primero';
        }
        return '';
    }

    formatFileSize(bytes) {
        if (!bytes) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
    }

    attachEventListeners() {
        console.log('📎 Adjuntando event listeners de upload view...');
        
        // Botón editar configuración
        const btnEditConfig = document.getElementById('btnEditConfig');
        if (btnEditConfig) {
            btnEditConfig.addEventListener('click', () => {
                this.router.navigate('configuration');
            });
        }

        // Botón ir a configuración
        const btnGoToConfig = document.getElementById('btnGoToConfig');
        if (btnGoToConfig) {
            btnGoToConfig.addEventListener('click', () => {
                this.router.navigate('configuration');
            });
        }

        // Selección de tipo de documento
        const btnTypeExam = document.getElementById('btn-type-exam');
        const btnTypeEssay = document.getElementById('btn-type-essay');

        if (btnTypeExam) {
            btnTypeExam.addEventListener('click', () => {
                console.log('📝 Tipo de documento seleccionado: examen');
                this.selectDocumentType('examen');
            });
        }

        if (btnTypeEssay) {
            btnTypeEssay.addEventListener('click', () => {
                console.log('📄 Tipo de documento seleccionado: ensayo/informe');
                this.selectDocumentType('ensayo/informe');
            });
        }

        // Upload de archivos
        this.attachUploadListeners();

        // Lista de estudiantes
        const studentListInput = document.getElementById('studentListInput');
        if (studentListInput) {
            studentListInput.addEventListener('input', (e) => {
                this.studentList = e.target.value;
                this.updateStartButton();
            });
        }

        // Botón iniciar evaluación
        const btnStartEvaluation = document.getElementById('btnStartEvaluation');
        if (btnStartEvaluation) {
            btnStartEvaluation.addEventListener('click', () => this.startEvaluation());
        }

        // Botones eliminar archivo
        document.querySelectorAll('.btn-delete').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const index = parseInt(e.target.closest('[data-index]').dataset.index);
                this.removeFile(index);
            });
        });
        
        console.log('✅ Event listeners adjuntados');
    }

    selectDocumentType(type) {
        console.log('🔄 Cambiando tipo de documento a:', type);
        this.documentType = type;
        
        // Re-renderizar
        const container = document.getElementById('main-content');
        if (container) {
            container.innerHTML = this.render();
            this.attachEventListeners();
            console.log('✅ Vista re-renderizada con tipo:', type);
        }
    }

    attachUploadListeners() {
        const uploadArea = document.getElementById('uploadArea');
        const fileInput = document.getElementById('fileInput');
        const btnSelectFiles = document.getElementById('btnSelectFiles');

        if (!uploadArea || !fileInput) {
            console.log('⚠️ Área de upload no disponible todavía');
            return;
        }

        console.log('📤 Configurando listeners de upload...');

        // Click en área de upload
        uploadArea.addEventListener('click', (e) => {
            if (e.target.id !== 'btnSelectFiles') {
                fileInput.click();
            }
        });

        // Click en botón
        if (btnSelectFiles) {
            btnSelectFiles.addEventListener('click', (e) => {
                e.stopPropagation();
                fileInput.click();
            });
        }

        // Drag & Drop
        uploadArea.addEventListener('dragover', (e) => {
            e.preventDefault();
            uploadArea.classList.add('drag-over');
        });

        uploadArea.addEventListener('dragleave', () => {
            uploadArea.classList.remove('drag-over');
        });

        uploadArea.addEventListener('drop', (e) => {
            e.preventDefault();
            uploadArea.classList.remove('drag-over');
            
            const files = Array.from(e.dataTransfer.files).filter(f => this.isValidFileType(f));
            
            if (files.length === 0) {
                showErrorNotification(new Error('Solo se permiten archivos PDF o Word (.pdf, .doc, .docx)'));
                return;
            }
            
            this.handleFiles(files);
        });

        // Selección de archivos
        fileInput.addEventListener('change', (e) => {
            const files = Array.from(e.target.files);
            this.handleFiles(files);
            fileInput.value = '';
        });
        
        console.log('✅ Listeners de upload configurados');
    }

    // ✅ CAMBIO PRINCIPAL: Solo guardar archivos, NO subirlos
    handleFiles(files) {
        if (files.length === 0) return;

        const invalidFiles = files.filter(f => !this.isValidFileType(f));
        
        if (invalidFiles.length > 0) {
            showErrorNotification(new Error(
                `Los siguientes archivos no son válidos: ${invalidFiles.map(f => f.name).join(', ')}`
            ));
            return;
        }

        console.log(`📁 ${files.length} archivo(s) seleccionado(s)`);

        // ✅ Solo agregar a la lista, NO subir
        this.selectedFiles.push(...files);

        showSuccessNotification(`✅ ${files.length} archivo(s) seleccionado(s)`);
        
        // Re-renderizar
        const container = document.getElementById('main-content');
        if (container) {
            container.innerHTML = this.render();
            this.attachEventListeners();
        }
    }

    removeFile(index) {
        this.selectedFiles.splice(index, 1);
        
        // Re-renderizar
        const container = document.getElementById('main-content');
        if (container) {
            container.innerHTML = this.render();
            this.attachEventListeners();
        }
    }

    updateStartButton() {
        const btn = document.getElementById('btnStartEvaluation');
        if (btn) {
            btn.disabled = !this.canStartEvaluation();
        }
    }

    // ✅ CAMBIO: Subir archivos AQUÍ, no antes
    async startEvaluation() {
        try {
            console.log('🚀 Iniciando evaluación...');

            if (!this.courseData.rubrica_id) {
                throw new Error('No se ha seleccionado una rúbrica. Ve a configuración.');
            }

            if (this.selectedFiles.length === 0) {
                throw new Error('Debes seleccionar al menos un archivo');
            }

            this.showLoading();

            // ✅ SUBIR ARCHIVOS AHORA
            console.log(`📤 Subiendo ${this.selectedFiles.length} archivos...`);
            const uploadedFiles = [];

            for (const file of this.selectedFiles) {
                try {
                    console.log(`  📤 Subiendo: ${file.name}`);
                    const result = await DocumentService.uploadFileProxy(file);
                    
                    uploadedFiles.push({
                        gcs_filename: result.gcs_filename,
                        original_filename: result.original_filename || file.name
                    });
                    
                    console.log(`  ✅ Subido: ${result.gcs_filename}`);
                } catch (error) {
                    console.error(`  ❌ Error subiendo ${file.name}:`, error);
                    throw new Error(`Error subiendo ${file.name}: ${error.message}`);
                }
            }

            console.log(`✅ Todos los archivos subidos (${uploadedFiles.length})`);

            // Preparar payload
            const evaluationData = {
                pdf_files: uploadedFiles,
                student_list: this.studentList.trim(),
                rubrica_id: this.courseData.rubrica_id,
                nombre_curso: this.courseData.courseName,
                codigo_curso: this.courseData.courseCode,
                instructor: this.courseData.instructor,
                semestre: this.courseData.semestre,
                tema: this.courseData.topic,
                descripcion_tema: this.courseData.descripcion_tema || '',
                tipo_documento: this.documentType
            };

            console.log('📤 Enviando evaluación:', evaluationData);

            const response = await DocumentService.enqueueExamBatch(evaluationData);

            console.log('✅ Respuesta del servidor:', response);

            showSuccessNotification(`✅ Evaluación iniciada: ${response.total || uploadedFiles.length} documento(s) en proceso`);

            // Limpiar y redirigir
            setTimeout(() => {
                this.selectedFiles = [];
                this.studentList = '';
                this.documentType = null;
                this.router.navigate('analysis');
            }, 2000);

        } catch (error) {
            console.error('❌ Error al iniciar evaluación:', error);
            showErrorNotification(error);
            this.hideLoading();
        }
    }

    showLoading() {
        const btn = document.getElementById('btnStartEvaluation');
        if (btn) {
            btn.disabled = true;
            btn.innerHTML = '⏳ Subiendo y procesando...';
        }
    }

    hideLoading() {
        const btn = document.getElementById('btnStartEvaluation');
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = '🚀 Iniciar evaluación';
        }
    }

    isValidFileType(file) {
        const validTypes = [
            'application/pdf',
            'application/msword',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        ];
        
        const validExtensions = ['.pdf', '.doc', '.docx'];
        const fileName = file.name.toLowerCase();
        
        return validTypes.includes(file.type) || 
            validExtensions.some(ext => fileName.endsWith(ext));
    }

    getFileIcon(filename) {
        const ext = filename.toLowerCase().split('.').pop();
        
        if (ext === 'pdf') return '📕';
        if (ext === 'doc' || ext === 'docx') return '📘';
        return '📄';
    }
}
