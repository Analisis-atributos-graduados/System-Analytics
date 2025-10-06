import { DOMUtils } from '../utils/dom.utils.js';
import { StorageUtils } from '../utils/storage.utils.js';
import DocumentService from '../services/document.service.js';

export class UploadView {
    constructor(router) {
        this.router = router;
        this.courseData = StorageUtils.load('currentCourse') || this.getMockData();
        this.selectedFiles = [];
    }

    getMockData() {
        return {
            courseName: 'Metodología de la investigación',
            courseCode: '1048',
            instructor: 'Juan Perez',
            period: '2025-20',
            topic: 'Investigación'
        };
    }

    render() {
        const html = `
            <div class="course-banner">
                <div class="banner-content">
                    <div class="banner-title">${this.courseData.courseName} (${this.courseData.courseCode})</div>
                    <div class="banner-info">
                        <span>Tema: ${this.courseData.topic} •</span>
                        <span>Instructor: ${this.courseData.instructor} •</span>
                        <span>Período: ${this.courseData.period}</span>
                    </div>
                </div>
                <div class="banner-badge">Configurado</div>
            </div>

            <div class="page-title">
                <h2>Carga de documentos</h2>
            </div>
            <p class="page-subtitle">Sube trabajos académicos para obtener evaluaciones automatizadas con IA. El sistema analizará contenido, estructura y gramática según la rúbrica configurada.</p>

            <div class="main-card">
                <div class="card-icon purple-icon">📤</div>
                <h3 class="card-title">Subir trabajos para análisis</h3>
                <p class="card-subtitle">Arrastra y suelta archivos aquí o haz clic para seleccionar</p>

                <div class="upload-area" id="upload-area">
                    <div class="upload-icon">⬆️</div>
                    <div class="upload-text">Seleccionar archivos</div>
                    <div class="upload-hint">Formatos soportados: PDF, DOC, DOCX, TXT (máx. 10MB)</div>
                    <input type="file" id="file-input" multiple accept=".pdf,.doc,.docx,.txt" style="display: none;">
                </div>

                <div id="files-list" class="files-list"></div>

                <div class="nav-buttons">
                    <button class="btn btn-secondary" id="btn-previous">← Anterior</button>
                    <button class="btn btn-primary" id="btn-upload" disabled>Subir y analizar →</button>
                </div>
            </div>
        `;

        DOMUtils.render('#main-content', html);
        this.attachEvents();
        this.addStyles();
    }

    addStyles() {
        if (!document.getElementById('upload-view-styles')) {
            const style = document.createElement('style');
            style.id = 'upload-view-styles';
            style.textContent = `
                .course-banner {
                    background: linear-gradient(135deg, rgba(102, 126, 234, 0.1) 0%, rgba(118, 75, 162, 0.1) 100%);
                    border: 1px solid rgba(102, 126, 234, 0.2);
                    border-radius: 15px;
                    padding: 25px;
                    margin-bottom: 40px;
                    position: relative;
                }

                .banner-title {
                    font-size: 18px;
                    color: #e0e0e0;
                    font-weight: 600;
                    margin-bottom: 8px;
                }

                .banner-info {
                    display: flex;
                    gap: 20px;
                    font-size: 13px;
                    color: #888;
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
                    background: var(--gradient-blue);
                    border-radius: 8px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 18px;
                }

                .file-item-details {
                    flex: 1;
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
                    transition: all 0.3s;
                }

                .file-item-remove:hover {
                    background: rgba(239, 68, 68, 0.2);
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
    }

    attachEvents() {
        const uploadArea = document.getElementById('upload-area');
        const fileInput = document.getElementById('file-input');
        const btnUpload = document.getElementById('btn-upload');

        // Click to select files
        uploadArea?.addEventListener('click', () => {
            fileInput?.click();
        });

        // File input change
        fileInput?.addEventListener('change', (e) => {
            this.handleFileSelect(e.target.files);
        });

        // Drag and drop
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
            this.handleFileSelect(e.dataTransfer.files);
        });

        // Navigation buttons
        document.getElementById('btn-previous')?.addEventListener('click', () => {
            this.router.navigate('configuration');
        });

        btnUpload?.addEventListener('click', async () => {
            await this.uploadFiles();
        });
    }

    handleFileSelect(files) {
        const validFiles = Array.from(files).filter(file => {
            const validExtensions = ['.pdf', '.doc', '.docx', '.txt'];
            const extension = '.' + file.name.split('.').pop().toLowerCase();
            const maxSize = 10 * 1024 * 1024; // 10MB

            if (!validExtensions.includes(extension)) {
                alert(`Archivo ${file.name} no tiene un formato válido.`);
                return false;
            }

            if (file.size > maxSize) {
                alert(`Archivo ${file.name} excede el tamaño máximo de 10MB.`);
                return false;
            }

            return true;
        });

        this.selectedFiles = [...this.selectedFiles, ...validFiles];
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

        const html = this.selectedFiles.map((file, index) => `
            <div class="file-item">
                <div class="file-item-info">
                    <div class="file-item-icon">📄</div>
                    <div class="file-item-details">
                        <div class="file-item-name">${file.name}</div>
                        <div class="file-item-size">${this.formatFileSize(file.size)}</div>
                    </div>
                </div>
                <button class="file-item-remove" data-index="${index}">🗑️ Eliminar</button>
            </div>
        `).join('');

        filesList.innerHTML = html;

        // Attach remove events
        document.querySelectorAll('.file-item-remove').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const index = parseInt(e.currentTarget.dataset.index);
                this.removeFile(index);
            });
        });
    }

    removeFile(index) {
        this.selectedFiles.splice(index, 1);
        this.renderFilesList();
        this.updateUploadButton();
    }

    updateUploadButton() {
        const btnUpload = document.getElementById('btn-upload');
        if (btnUpload) {
            btnUpload.disabled = this.selectedFiles.length === 0;
        }
    }

    async uploadFiles() {
        if (this.selectedFiles.length === 0) return;

        try {
            // Show loading state
            const btnUpload = document.getElementById('btn-upload');
            if (btnUpload) {
                btnUpload.disabled = true;
                btnUpload.innerHTML = '⏳ Subiendo...';
            }

            // Upload files to API
            const courseId = this.courseData.courseCode;
            await DocumentService.uploadDocuments(courseId, this.selectedFiles);

            // Save to storage for demo
            const uploadedDocs = this.selectedFiles.map(file => ({
                id: Date.now() + Math.random(),
                name: file.name,
                size: file.size,
                uploadDate: new Date().toISOString(),
                status: 'processing'
            }));

            StorageUtils.save('uploadedDocuments', uploadedDocs);

            // Navigate to analysis
            this.router.navigate('analysis');

        } catch (error) {
            console.error('Error uploading files:', error);
            alert('Error al subir archivos. Por favor intenta nuevamente.');
            
            const btnUpload = document.getElementById('btn-upload');
            if (btnUpload) {
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