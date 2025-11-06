import { DOMUtils } from '../utils/dom.utils.js';
import { StorageUtils } from '../utils/storage.utils.js';
import CriterioService from '../services/criterio.service.js';

export class SettingsView {
    constructor(router) {
        this.router = router;
        this.courseData = StorageUtils.load('configData') || {};
        this.criterios = [];
    }

    async render() {
        await this.loadCriterios();

        const html = `
            <div class="page-title">
                <h2>Configuración del sistema</h2>
            </div>
            <p class="page-subtitle">Ajusta los parámetros de evaluación y revisa la configuración del curso.</p>

            ${this.renderCourseConfig()}
            ${this.renderCriteriaConfig()}
            ${this.renderThemeToggle()}
        `;

        DOMUtils.render('#main-content', html);
        this.attachEvents();
    }

    async loadCriterios() {
        try {
            this.criterios = await CriterioService.getCriterios();
        } catch (error) {
            console.error('Error al cargar criterios:', error);
            this.criterios = [];
        }
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

    renderCriteriaConfig() {
        if (this.criterios.length === 0) {
            return `
                <div class="config-section">
                    <div class="section-header">
                        <div class="section-icon purple-icon">📊</div>
                        <h3 class="section-title">Criterios de evaluación</h3>
                    </div>
                    <p style="color: #888; text-align: center; padding: 20px;">
                        No se pudieron cargar los criterios. Verifica la conexión con la API.
                    </p>
                </div>
            `;
        }

        return `
            <div class="config-section">
                <div class="section-header">
                    <div class="section-icon purple-icon">📊</div>
                    <h3 class="section-title">Criterios de evaluación</h3>
                </div>
                
                ${this.criterios.map((criterio, index) => `
                    <div class="config-item" ${index === this.criterios.length - 1 ? 'style="border-bottom: none;"' : ''}>
                        <div>
                            <div style="font-size: 14px; color: var(--text-color); margin-bottom: 5px; font-weight: 500;">
                                ${CriterioService.getNombreAmigable(criterio.nombre)}
                            </div>
                            <div style="font-size: 12px; color: var(--secondary-text);">
                                ${CriterioService.getDescripcion(criterio.nombre)}
                            </div>
                        </div>
                        <div style="display: flex; align-items: center; gap: 15px;">
                            <input type="number" 
                                   class="peso-input" 
                                   data-criterio="${criterio.nombre}"
                                   value="${(criterio.peso * 100).toFixed(0)}"
                                   min="0" 
                                   max="100"
                                   step="1"
                                   style="width: 70px; padding: 8px; background: var(--input-bg); border: 1px solid var(--input-border); border-radius: 8px; color: var(--input-text); text-align: center;">
                            <span style="color: var(--secondary-text);">%</span>
                        </div>
                    </div>
                `).join('')}

                <div style="margin-top: 20px; padding: 15px; background: var(--primary-light); border-radius: 10px; border: 1px solid var(--primary-border);">
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <span style="color: var(--primary-color); font-weight: 500;">Total:</span>
                        <span id="total-percentage" style="color: var(--primary-color); font-weight: 700; font-size: 18px;">100%</span>
                    </div>
                </div>

                <button class="btn btn-primary" id="btn-save-criteria" style="margin-top: 20px; width: 100%;">
                    💾 Guardar Cambios
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

        // Actualizar total cuando cambian los inputs
        document.querySelectorAll('.peso-input').forEach(input => {
            input.addEventListener('input', () => {
                this.updateTotal();
            });
        });

        document.getElementById('btn-save-criteria')?.addEventListener('click', async () => {
            await this.saveCriteria();
        });
    }

    updateTotal() {
        const inputs = document.querySelectorAll('.peso-input');
        let total = 0;
        
        inputs.forEach(input => {
            total += parseFloat(input.value) || 0;
        });

        const totalEl = document.getElementById('total-percentage');
        if (totalEl) {
            totalEl.textContent = `${total.toFixed(0)}%`;
            
            // Cambiar color si no suma 100
            if (Math.abs(total - 100) > 0.1) {
                totalEl.style.color = '#ef4444';
            } else {
                totalEl.style.color = '#10b981';
            }
        }
    }

    async saveCriteria() {
        const inputs = document.querySelectorAll('.peso-input');
        const newCriterios = {};
        let total = 0;

        inputs.forEach(input => {
            const criterio = input.dataset.criterio;
            const peso = parseFloat(input.value) / 100;
            newCriterios[criterio] = peso;
            total += parseFloat(input.value);
        });

        // Validar que sume 100%
        if (Math.abs(total - 100) > 0.1) {
            alert('Los pesos deben sumar exactamente 100%');
            return;
        }

        try {
            const btn = document.getElementById('btn-save-criteria');
            if (btn) {
                btn.disabled = true;
                btn.textContent = '⏳ Guardando...';
            }

            const response = await CriterioService.updateCriterios(newCriterios);
            
            alert('Criterios actualizados correctamente');
            
            // Recargar criterios
            await this.render();

        } catch (error) {
            console.error('Error al guardar criterios:', error);
            alert('Error al guardar los criterios. Intenta nuevamente.');
            
            const btn = document.getElementById('btn-save-criteria');
            if (btn) {
                btn.disabled = false;
                btn.textContent = '💾 Guardar Cambios';
            }
        }
    }
}