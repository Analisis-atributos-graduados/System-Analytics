import { DOMUtils } from '../utils/dom.utils.js';
import { StorageUtils } from '../utils/storage.utils.js';
import DocumentService from '../services/document.service.js';

export class UploadView {
    constructor(router) {
        this.router = router;
        this.courseData = StorageUtils.load('configData') || {};
        this.selectedFiles = [];
    }

    render() {
        const html = `
            <div class="course-banner">
                <div class="banner-content">
                    <div class="banner-title">${this.courseData.courseName || 'Sin curso'} (${this.courseData.courseCode || 'N/A'})</div>
                    <div class="banner-info">
                        <span>Tema: ${this.courseData.topic || 'N/A'} •</span>
                        <span>Instructor: ${this.courseData.instructor || 'N/A'} •</span>
                        <span>Período: ${this.courseData.period || 'N/A'}</span>
                    </div>
                </div>
                <div class="banner-badge">Configurado</div>
            </div>

            <div class="page-title">
                <h2>Carga de documentos</h2>
            </div>
            <p class="page-subtitle">Sube trabajos académicos para obtener evaluaciones automatizadas con IA.</p>

            <div class="main-card">
                <div class="card-icon purple-icon">📤</div>
                <h3 class="card-title">Subir trabajos para análisis</h3>
                <p class="card-subtitle">Arrastra y suelta archivos aquí o haz clic para seleccionar</p>

                <div class="upload-area" id="upload-area">
                    <div class="upload-icon">⬆️</div>
                    <div class="upload-text">Seleccionar archivos</div>
                    <div class="upload-hint">Formatos soportados: PDF, DOC, DOCX, TXT (máx. 10MB)</div>
                    <input type="file" id="file-input" accept=".pdf,.doc,.docx,.txt" style="display: none;">
                </div>

                <div id="files-list" class="files-list"></div>

                <div class="nav-buttons">
                    <button class="btn btn-secondary" id="btn-previous">← Anterior</button>
                    <button class="btn btn-primary" id="btn-upload" disabled>Subir y analizar →</button>
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
        const uploadArea = document.getElementById('upload-area');
        const fileInput = document.getElementById('file-input');

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

        document.getElementById('btn-previous')?.addEventListener('click', () => {
            this.router.navigate('configuration');
        });

        document.getElementById('btn-upload')?.addEventListener('click', async () => {
            await this.uploadFiles();
        });
    }

    handleFileSelect(files) {
        const file = files[0]; // Solo el primer archivo
        const validExtensions = ['.pdf', '.doc', '.docx', '.txt'];
        const extension = '.' + file.name.split('.').pop().toLowerCase();
        const maxSize = 10 * 1024 * 1024;

        if (!validExtensions.includes(extension)) {
            alert(`Archivo ${file.name} no tiene un formato válido.`);
            return;
        }

        if (file.size > maxSize) {
            alert(`Archivo ${file.name} excede el tamaño máximo de 10MB.`);
            return;
        }

        this.selectedFiles = [file];
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

        const file = this.selectedFiles[0];
        filesList.innerHTML = `
            <div class="file-item">
                <div class="file-item-info">
                    <div class="file-item-icon">📄</div>
                    <div>
                        <div class="file-item-name">${file.name}</div>
                        <div class="file-item-size">${this.formatFileSize(file.size)}</div>
                    </div>
                </div>
                <button class="file-item-remove" id="btn-remove-file">🗑️ Eliminar</button>
            </div>
        `;

        document.getElementById('btn-remove-file')?.addEventListener('click', () => {
            this.selectedFiles = [];
            this.renderFilesList();
            this.updateUploadButton();
        });
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
            const btnUpload = document.getElementById('btn-upload');
            if (btnUpload) {
                btnUpload.disabled = true;
                btnUpload.innerHTML = '⏳ Subiendo...';
            }

            const result = await DocumentService.uploadDocument(this.selectedFiles[0], this.courseData);
            
            StorageUtils.save('analysisResults', result);
            StorageUtils.save('uploadComplete', true);

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