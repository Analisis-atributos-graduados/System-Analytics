import { DOMUtils } from '../utils/dom.utils.js';
import { StorageUtils } from '../utils/storage.utils.js';
import DocumentService from '../services/document.service.js';

export class UploadView {
    constructor(router) {
        this.router = router;
        this.courseData = StorageUtils.load('configData') || {}; // Load from localStorage
        this.selectedFiles = [];
        this.studentList = '';
        this.documentType = null; // 'examen' or 'ensayo'
    }

    render() {
        this.courseData = StorageUtils.load('configData') || {}; // Load from localStorage
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
                </div>
                <div class="banner-badge">Configurado</div>
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
                    <div class="card-icon purple-icon">📤</div>
                    <h3 class="card-title">Subir trabajos para análisis</h3>
                    <p class="card-subtitle">Arrastra y suelta archivos aquí o haz clic para seleccionar</p>

                    <div class="upload-area" id="upload-area">
                        <div class="upload-icon">⬆️</div>
                        <div class="upload-text">Seleccionar archivos</div>
                        <div class="upload-hint">Formatos soportados: PDF, DOC, DOCX, TXT, JPG, JPEG, PNG (máx. 10MB)</div>
                        <input type="file" id="file-input" accept=".pdf,.doc,.docx,.txt" style="display: none;" multiple>
                    </div>

                    <div id="files-list" class="files-list"></div>

                    <div id="student-list-container" class="form-group ${studentListVisible ? '' : 'hidden'}" style="margin-top: 20px;">
                        <label class="form-label">Lista de Alumnos</label>
                        <textarea class="form-input textarea" id="student-list" placeholder="Escribe los nombres de los alumnos, uno por línea..." rows="6">${this.studentList}</textarea>
                    </div>

                    <div class="nav-buttons">
                        <button class="btn btn-secondary" id="btn-previous">← Anterior</button>
                        <button class="btn btn-primary" id="btn-upload" disabled>Subir y analizar →</button>
                    </div>
                </div>
            </div>
        `;

        DOMUtils.render('#main-content', html);
        this.addStyles();
        this.attachEvents();
    }

    addStyles() {
        if (document.getElementById('upload-view-styles')) return;

        const style = document.createElement('style');
        style.id = 'upload-view-styles';
        style.textContent = `
            .course-banner {
                background: var(--primary-light);
                border: 1px solid var(--primary-border);
                border-radius: 15px;
                padding: 25px;
                margin-bottom: 40px;
                position: relative;
            }

            .banner-title {
                font-size: 18px;
                color: var(--text-color);
                font-weight: 600;
                margin-bottom: 8px;
            }

            .banner-info {
                display: flex;
                gap: 20px;
                font-size: 13px;
                color: var(--secondary-text);
                flex-wrap: wrap;
            }

            .banner-badge {
                position: absolute;
                top: 25px;
                right: 25px;
                background: rgba(16, 185, 129, 0.1);
                color: #10b981;
                padding: 6px 15px;
                border-radius: 15px;
                font-size: 12px;
                font-weight: 600;
            }

            .document-type-selection {
                text-align: center;
                margin-bottom: 40px;
            }

            .section-label {
                color: var(--secondary-text);
                margin-bottom: 20px;
                font-size: 14px;
            }

            .button-group {
                display: flex;
                justify-content: center;
                gap: 20px;
            }

            .button-group .btn.active {
                background: var(--primary-color);
                color: white;
                border-color: var(--primary-color);
            }

            .hidden {
                display: none;
            }

            .files-list {
                margin-top: 30px;
            }

            .file-item {
                display: flex;
                align-items: center;
                justify-content: space-between;
                padding: 15px;
                background: rgba(0, 0, 0, 0.3);
                border: 1px solid rgba(255, 255, 255, 0.1);
                border-radius: 10px;
                margin-bottom: 10px;
            }

            .file-item-info {
                display: flex;
                align-items: center;
                gap: 12px;
                flex: 1;
            }

            .file-item-icon {
                width: 40px;
                height: 40px;
                background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%);
                border-radius: 8px;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 18px;
            }

            .file-item-name {
                font-size: 14px;
                color: #e0e0e0;
                margin-bottom: 3px;
            }

            .file-item-size {
                font-size: 12px;
                color: #888;
            }

            .file-item-remove {
                padding: 8px 16px;
                background: rgba(239, 68, 68, 0.1);
                color: #ef4444;
                border: 1px solid rgba(239, 68, 68, 0.3);
                border-radius: 8px;
                font-size: 12px;
                cursor: pointer;
            }

            @media (max-width: 768px) {
                .banner-badge {
                    position: static;
                    margin-top: 15px;
                    display: inline-block;
                }
            }
        `;
        document.head.appendChild(style);
    }

    attachEvents() {
        document.getElementById('btn-type-exam')?.addEventListener('click', () => {
            this.documentType = 'examen';
            this.render();
        });

        document.getElementById('btn-type-essay')?.addEventListener('click', () => {
            this.documentType = 'ensayo/informe';
            this.render();
        });

        const uploadArea = document.getElementById('upload-area');
        const fileInput = document.getElementById('file-input');
        this.studentListInput = document.getElementById('student-list');
        this.uploadedPdfs = []; // Initialize uploadedPdfs

        uploadArea?.addEventListener('click', () => fileInput?.click());

        fileInput?.addEventListener('change', (e) => {
            if (e.target.files.length > 0) {
                this.handleFileSelect(e.target.files);
            }
        });

        uploadArea?.addEventListener('dragover', (e) => {
            e.preventDefault();
            uploadArea.style.borderColor = '#667eea';
            uploadArea.style.background = 'rgba(102, 126, 234, 0.05)';
        });

        uploadArea?.addEventListener('dragleave', (e) => {
            e.preventDefault();
            uploadArea.style.borderColor = 'rgba(255, 255, 255, 0.2)';
            uploadArea.style.background = 'transparent';
        });

        uploadArea?.addEventListener('drop', (e) => {
            e.preventDefault();
            uploadArea.style.borderColor = 'rgba(255, 255, 255, 0.2)';
            uploadArea.style.background = 'transparent';
            if (e.dataTransfer.files.length > 0) {
                this.handleFileSelect(e.dataTransfer.files);
            }
        });

        this.studentListInput?.addEventListener('input', (e) => {
            this.studentList = e.target.value;
            this.updateUploadButton();
        });

        document.getElementById('btn-previous')?.addEventListener('click', () => {
            this.router.navigate('configuration');
        });

        document.getElementById('btn-upload')?.addEventListener('click', async () => {
            await this.uploadFiles();
        });
    }

    handleFileSelect(files) {
        const validExtensions = ['.pdf', '.doc', '.docx', '.txt', '.jpg', '.jpeg', '.png'];
        const maxSize = 10 * 1024 * 1024;

        for (const file of files) {
            const extension = '.' + file.name.split('.').pop().toLowerCase();
            if (!validExtensions.includes(extension)) {
                alert(`Archivo ${file.name} no tiene un formato válido.`);
                continue;
            }

            if (file.size > maxSize) {
                alert(`Archivo ${file.name} excede el tamaño máximo de 10MB.`);
                continue;
            }

            if (!this.selectedFiles.find(f => f.name === file.name)) {
                this.selectedFiles.push(file);
            }
        }

        this.renderFilesList();
        this.updateUploadButton();
    }

    renderFilesList() {
        const filesList = document.getElementById('files-list');
        if (!filesList) return;

        if (this.selectedFiles.length === 0) {
            filesList.innerHTML = '';
            return;
        }

        filesList.innerHTML = this.selectedFiles.map(file => `
            <div class="file-item">
                <div class="file-item-info">
                    <div class="file-item-icon">📄</div>
                    <div>
                        <div class="file-item-name">${file.name}</div>
                        <div class="file-item-size">${this.formatFileSize(file.size)}</div>
                    </div>
                </div>
                <button class="file-item-remove" data-filename="${file.name}">🗑️ Eliminar</button>
            </div>
        `).join('');

        document.querySelectorAll('.file-item-remove').forEach(button => {
            button.addEventListener('click', (e) => {
                const filename = e.target.dataset.filename;
                this.selectedFiles = this.selectedFiles.filter(f => f.name !== filename);
                this.renderFilesList();
                this.updateUploadButton();
            });
        });
    }

    updateUploadButton() {
        const btnUpload = document.getElementById('btn-upload');
        if (!btnUpload) return;

        let isEnabled = false;
        if (this.documentType === 'examen') {
            isEnabled = this.selectedFiles.length > 0 && this.studentList.trim() !== '';
        } else if (this.documentType === 'ensayo/informe') {
            isEnabled = this.selectedFiles.length > 0;
        }
        btnUpload.disabled = !isEnabled;
    }

    async uploadFiles() {
    const isExam = this.documentType === 'examen';
    if (this.selectedFiles.length === 0 || (isExam && !this.studentListInput.value.trim())) {
        alert('Por favor, selecciona al menos un archivo y proporciona la lista de alumnos si es un examen.');
        return;
    }
    this.showProcessing(true);

    try {
        // ✅ CORREGIDO: Subir archivos usando el proxy del backend
        const uploadedFilesInfo = await Promise.all(
            this.selectedFiles.map(async (file) => {
                // Crear FormData para cada archivo
                const formData = new FormData();
                formData.append('file', file);
                formData.append('filename', file.name);

                // Subir usando el endpoint proxy
                const response = await fetch('https://analitica-backend-511391059179.southamerica-east1.run.app/upload-file-proxy', {
                    method: 'POST',
                    body: formData
                });

                if (!response.ok) {
                    throw new Error(`Error uploading ${file.name}: ${response.status}`);
                }

                const result = await response.json();
                console.log(`✅ Archivo subido: ${file.name} → ${result.filename}`);
                
                return {
                    gcs_filename: result.filename,
                    original_filename: file.name
                };
            })
        );

        console.log('Todos los archivos subidos:', uploadedFilesInfo);

        // Load courseData just before use to ensure it's up-to-date
        const currentCourseData = StorageUtils.load('configData') || {};

        // Empaquetar TODOS los datos en un solo objeto
        const evaluationData = {
            tipo_documento: this.documentType,
            pdf_files: uploadedFilesInfo,
            student_list: this.studentListInput?.value || '',
            nombre_curso: currentCourseData.courseName,
            codigo_curso: currentCourseData.courseCode,
            instructor: currentCourseData.instructor,
            semestre: currentCourseData.semestre,
            tema: currentCourseData.topic,
            descripcion_tema: currentCourseData.descripcion_tema || ""
        };

        // Encolar el lote de exámenes
        console.log('Sending evaluationData to backend:', evaluationData);
        const response = await DocumentService.enqueueExamBatch(evaluationData);

        console.log('Batch enqueued successfully:', response);
        alert('¡El lote de exámenes ha sido enviado para su análisis! Serás redirigido a la página de resultados.');

        if (response.evaluacion_ids && response.evaluacion_ids.length > 0) {
            await this.pollForResults(response.evaluacion_ids);
        } else {
            alert(response.message || "No se iniciaron evaluaciones.");
            this.showProcessing(false);
        }

    } catch (error) {
        console.error('Error uploading files:', error);
        alert('Error al subir archivos: ' + error.message);
        this.showProcessing(false);
    }
}

    async pollForResults(evaluacionIds) {
        const interval = 5000; // 5 seconds
        const maxAttempts = 60; // 5 minutes
        let attempts = 0;

        const poll = async (resolve, reject) => {
            if (attempts >= maxAttempts) {
                return reject(new Error("El análisis está tardando demasiado. Por favor, revisa los resultados más tarde."));
            }

            try {
                const results = await Promise.all(evaluacionIds.map(id => DocumentService.getEvaluacion(id)));
                
                const allDone = results.every(r => r.resultado_analisis);

                if (allDone) {
                    console.log('Results before saving to localStorage:', results);
                    StorageUtils.save('analysisResults', { evaluaciones: results });
                    console.log('Saved analysisResults to localStorage:', { evaluaciones: results });
                    StorageUtils.save('uploadComplete', true);
                    this.router.navigate('analysis');
                    resolve();
                } else {
                    attempts++;
                    setTimeout(() => poll(resolve, reject), interval);
                }
            } catch (error) {
                reject(error);
            }
        };

        return new Promise(poll);
    }

    showProcessing(isProcessing) {
        const btnUpload = document.getElementById('btn-upload');
        if (btnUpload) {
            if (isProcessing) {
                btnUpload.disabled = true;
                btnUpload.innerHTML = '⏳ Procesando análisis... (esto puede tardar)';
            } else {
                btnUpload.disabled = false;
                btnUpload.innerHTML = 'Subir y analizar →';
            }
        }
    }

    formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
    }


}