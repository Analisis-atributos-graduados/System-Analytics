export class UploadAreaComponent {
    constructor(options = {}) {
        this.acceptedTypes = options.acceptedTypes || ['.pdf', '.doc', '.docx', '.txt'];
        this.maxSize = options.maxSize || 10 * 1024 * 1024;
        this.multiple = options.multiple !== false;
        this.onFilesSelected = options.onFilesSelected || (() => {});
        this.onError = options.onError || ((error) => console.error(error));
    }

    render(containerId = 'upload-container') {
        const html = `
            <div class="upload-area" id="${containerId}-area">
                <div class="upload-icon" id="${containerId}-icon">⬆️</div>
                <div class="upload-text" id="${containerId}-text">
                    Seleccionar archivos
                </div>
                <div class="upload-hint" id="${containerId}-hint">
                    Formatos soportados: ${this.acceptedTypes.join(', ')} (máx. ${this.formatSize(this.maxSize)})
                </div>
                <input type="file" 
                       id="${containerId}-input" 
                       ${this.multiple ? 'multiple' : ''}
                       accept="${this.acceptedTypes.join(',')}" 
                       style="display: none;">
            </div>
        `;

        return html;
    }

    attachEvents(containerId = 'upload-container') {
        const uploadArea = document.getElementById(`${containerId}-area`);
        const fileInput = document.getElementById(`${containerId}-input`);

        if (!uploadArea || !fileInput) {
            console.error('Upload area or input not found');
            return;
        }

        uploadArea.addEventListener('click', (e) => {
            e.stopPropagation();
            fileInput.click();
        });

        fileInput.addEventListener('change', (e) => {
            this.handleFileSelect(e.target.files);
            e.target.value = '';
        });

        ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
            uploadArea.addEventListener(eventName, (e) => {
                e.preventDefault();
                e.stopPropagation();
            });
        });

        ['dragenter', 'dragover'].forEach(eventName => {
            uploadArea.addEventListener(eventName, () => {
                uploadArea.classList.add('upload-area-dragover');
                uploadArea.style.borderColor = '#667eea';
                uploadArea.style.background = 'rgba(102, 126, 234, 0.05)';
            });
        });

        ['dragleave', 'drop'].forEach(eventName => {
            uploadArea.addEventListener(eventName, () => {
                uploadArea.classList.remove('upload-area-dragover');
                uploadArea.style.borderColor = 'rgba(255, 255, 255, 0.2)';
                uploadArea.style.background = 'transparent';
            });
        });

        uploadArea.addEventListener('drop', (e) => {
            const files = e.dataTransfer.files;
            this.handleFileSelect(files);
        });
    }

    handleFileSelect(files) {
        if (!files || files.length === 0) {
            return;
        }

        const validFiles = [];
        const errors = [];

        Array.from(files).forEach(file => {
            const validation = this.validateFile(file);
            
            if (validation.isValid) {
                validFiles.push(file);
            } else {
                errors.push({
                    file: file.name,
                    errors: validation.errors
                });
            }
        });

        if (errors.length > 0) {
            this.handleErrors(errors);
        }

        if (validFiles.length > 0) {
            this.onFilesSelected(validFiles);
        }
    }

    validateFile(file) {
        const errors = [];

        const extension = '.' + file.name.split('.').pop().toLowerCase();
        if (!this.acceptedTypes.includes(extension)) {
            errors.push(`Formato no permitido. Use: ${this.acceptedTypes.join(', ')}`);
        }

        if (file.size > this.maxSize) {
            errors.push(`Tamaño excede el máximo (${this.formatSize(this.maxSize)})`);
        }

        if (/[<>:"/\\|?*]/.test(file.name)) {
            errors.push('El nombre contiene caracteres no permitidos');
        }

        return {
            isValid: errors.length === 0,
            errors
        };
    }

    handleErrors(errors) {
        errors.forEach(({ file, errors: fileErrors }) => {
            const message = `Error en "${file}": ${fileErrors.join(', ')}`;
            this.onError(message);
        });
    }

    formatSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
    }

    setLoading(containerId, isLoading) {
        const uploadArea = document.getElementById(`${containerId}-area`);
        const icon = document.getElementById(`${containerId}-icon`);
        const text = document.getElementById(`${containerId}-text`);

        if (!uploadArea) return;

        if (isLoading) {
            uploadArea.style.pointerEvents = 'none';
            uploadArea.style.opacity = '0.6';
            if (icon) icon.textContent = '⏳';
            if (text) text.textContent = 'Subiendo archivos...';
        } else {
            uploadArea.style.pointerEvents = 'auto';
            uploadArea.style.opacity = '1';
            if (icon) icon.textContent = '⬆️';
            if (text) text.textContent = 'Seleccionar archivos';
        }
    }

    reset(containerId) {
        const fileInput = document.getElementById(`${containerId}-input`);
        if (fileInput) {
            fileInput.value = '';
        }
        this.setLoading(containerId, false);
    }
}

export default UploadAreaComponent;