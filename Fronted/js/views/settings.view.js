import { DOMUtils } from '../utils/dom.utils.js';
import { StorageUtils } from '../utils/storage.utils.js';
import AuthService from '../services/auth.service.js';

export class SettingsView {
    constructor(router) {
        this.router = router;
        this.userRole = StorageUtils.load('userRole') || 'PROFESOR';
        this.courseData = StorageUtils.load('configData') || {};
    }

    async render() {
        const html = `
            <div class="page-title">
                <h2>Configuración del sistema</h2>
            </div>
            <p class="page-subtitle">Ajusta los parámetros de evaluación y revisa la configuración del curso.</p>

            ${this.renderCourseConfig()}
            ${this.renderThemeToggle()}
            
            <div class="config-section">
                <div class="section-header">
                    <div class="section-icon red-icon">➡️</div>
                    <h3 class="section-title">Acciones de Cuenta</h3>
                </div>
                <div class="config-item" style="border-bottom: none;">
                    <button class="btn btn-danger" id="btn-logout" style="width: 100%;">
                        Cerrar Sesión
                    </button>
                </div>
            </div>
        `;

        DOMUtils.render('#main-content', html);
        this.attachEvents();
    }

    renderThemeToggle() {
        const currentTheme = StorageUtils.load('theme') || 'dark-theme';
        const isLight = (currentTheme === 'light-theme');
        return `
            <div class="config-section">
                <div class="section-header">
                    <div class="section-icon purple-icon">🎨</div>
                    <h3 class="section-title">Tema de la interfaz</h3>
                </div>
                <div class="config-item" style="border-bottom: none;">
                    <span class="config-label">Modo Claro/Oscuro</span>
                    <label class="switch">
                        <input type="checkbox" id="theme-toggle" ${isLight ? 'checked' : ''}>
                        <span class="slider round"></span>
                    </label>
                </div>
            </div>
            <style>
                /* Basic Toggle Switch CSS */
                .switch {
                    position: relative;
                    display: inline-block;
                    width: 60px;
                    height: 34px;
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
                    -webkit-transition: .4s;
                    transition: .4s;
                }

                .slider:before {
                    position: absolute;
                    content: "";
                    height: 26px;
                    width: 26px;
                    left: 4px;
                    bottom: 4px;
                    background-color: white;
                    -webkit-transition: .4s;
                    transition: .4s;
                }

                input:checked + .slider {
                    background-color: #667eea;
                }

                input:focus + .slider {
                    box-shadow: 0 0 1px #667eea;
                }

                input:checked + .slider:before {
                    -webkit-transform: translateX(26px);
                    -ms-transform: translateX(26px);
                    transform: translateX(26px);
                }

                /* Rounded sliders */
                .slider.round {
                    border-radius: 34px;
                }

                .slider.round:before {
                    border-radius: 50%;
                }
            </style>
        `;
    }

    renderCourseConfig() {
        if (this.userRole === 'AREA_DE_CALIDAD') {
            return '';
        }

        return `
            <div class="config-section">
                <div class="section-header">
                    <div class="section-icon blue-icon">📚</div>
                    <h3 class="section-title">Configuración actual del curso</h3>
                </div>
                <div class="config-item">
                    <span class="config-label">Curso</span>
                    <span class="config-value">${this.courseData.courseName || 'No configurado'}</span>
                </div>
                <div class="config-item">
                    <span class="config-label">Código</span>
                    <span class="config-value">${this.courseData.courseCode || 'N/A'}</span>
                </div>
                <div class="config-item">
                    <span class="config-label">Profesor</span>
                    <span class="config-value">${this.courseData.instructor || 'N/A'}</span>
                </div>
                <div class="config-item">
                    <span class="config-label">Ciclo</span>
                    <span class="config-value">${this.courseData.semestre || 'N/A'}</span>
                </div>
                <div class="config-item">
                    <span class="config-label">Tema de evaluación</span>
                    <span class="config-value">${this.courseData.topic || 'N/A'}</span>
                </div>
                <div class="config-item" style="border-bottom: none;">
                    <span class="config-label">Rúbrica</span>
                    <span class="config-value">${this.courseData.rubricFile?.name || 'No subida'}</span>
                </div>
                <button class="btn btn-secondary" id="btn-modify-config" style="margin-top: 20px; width: 100%;">
                    ⚙️ Modificar configuración
                </button>
            </div>
        `;
    }

    attachEvents() {
        document.getElementById('btn-modify-config')?.addEventListener('click', () => {
            this.router.navigate('configuration');
        });

        document.getElementById('theme-toggle')?.addEventListener('change', (e) => {
            const newTheme = e.target.checked ? 'light-theme' : 'dark-theme';
            document.body.className = newTheme;
            StorageUtils.save('theme', newTheme);
        });

        document.getElementById('btn-logout')?.addEventListener('click', () => {
            AuthService.logout(); // Usar el servicio de autenticación para un logout completo
        });
    }
}