import { DOMUtils } from '../utils/dom.utils.js';
import { StepIndicatorComponent } from '../components/step-indicator.component.js';
import CourseService from '../services/course.service.js';
import { StorageUtils } from '../utils/storage.utils.js';

export class ConfigurationView {
    constructor(router) {
        this.router = router;
        this.courseData = StorageUtils.load('currentCourse') || this.getMockData();
    }

    getMockData() {
        return {
            courseName: 'Metodología de la investigación',
            courseCode: '1048',
            instructor: 'Juan Perez',
            period: '2025-20',
            topic: 'Investigación',
            topicDescription: 'Examen de investigación semestral...',
            rubric: {
                name: 'ACTA DE CONSTITUCIÓN DEL PROYECTO (1).docx',
                size: 1.81 * 1024 * 1024
            }
        };
    }

    render() {
        const steps = [
            { icon: '📚', title: 'Registro del curso' },
            { icon: '🎯', title: 'Registro del tópico' },
            { icon: '📋', title: 'Subir rúbrica' },
            { icon: '✓', title: 'Listo para análisis' }
        ];

        const stepIndicator = new StepIndicatorComponent(steps, 3);

        const html = `
            <div class="page-title">
                <h2>Configuración inicial</h2>
            </div>
            <p class="page-subtitle">Configura el curso, tema y rúbrica antes de comenzar el análisis de documentos</p>

            ${stepIndicator.render()}

            <div class="main-card">
                <div class="card-icon green-icon">✓</div>
                <h3 class="card-title">Configuración completada</h3>
                <p class="card-subtitle">Revisa la información antes de proceder al análisis de documentos</p>

                <div class="summary-grid">
                    ${this.renderCourseInfo()}
                    ${this.renderTopicInfo()}
                    ${this.renderRubricInfo()}
                </div>

                <div class="nav-buttons">
                    <button class="btn btn-secondary" id="btn-previous">← Anterior</button>
                    <button class="btn btn-primary" id="btn-next">Comenzar análisis →</button>
                </div>
            </div>
        `;

        DOMUtils.render('#main-content', html);
        this.attachEvents();
    }

    renderCourseInfo() {
        return `
            <div class="summary-card">
                <div class="summary-header">
                    <div class="summary-header-icon blue-icon">📚</div>
                    <h4 class="summary-title">Información del curso</h4>
                </div>
                <div class="summary-item">
                    <div class="summary-label">Curso:</div>
                    <div class="summary-value">${this.courseData.courseName}</div>
                </div>
                <div class="summary-item">
                    <div class="summary-label">Código:</div>
                    <div class="summary-value">${this.courseData.courseCode}</div>
                </div>
                <div class="summary-item">
                    <div class="summary-label">Instructor:</div>
                    <div class="summary-value">${this.courseData.instructor}</div>
                </div>
                <div class="summary-item">
                    <div class="summary-label">Período:</div>
                    <div class="summary-value">${this.courseData.period}</div>
                </div>
            </div>
        `;
    }

    renderTopicInfo() {
        return `
            <div class="summary-card">
                <div class="summary-header">
                    <div class="summary-header-icon teal-icon">🎯</div>
                    <h4 class="summary-title">Tópico de evaluación</h4>
                </div>
                <div class="summary-item">
                    <div class="summary-label">Tema:</div>
                    <div class="summary-value">${this.courseData.topic}</div>
                </div>
                <div class="summary-item">
                    <div class="summary-label" style="margin-top: 10px;">${this.courseData.topicDescription}</div>
                </div>
            </div>
        `;
    }

    renderRubricInfo() {
        return `
            <div class="summary-card" style="grid-column: span 2;">
                <div class="summary-header">
                    <div class="summary-header-icon orange-icon">📋</div>
                    <h4 class="summary-title">Rúbrica de evaluación</h4>
                </div>
                <div class="file-display">
                    <div class="file-icon">📄</div>
                    <div class="file-info">
                        <div class="file-name">${this.courseData.rubric.name}</div>
                        <div class="file-size">${(this.courseData.rubric.size / (1024 * 1024)).toFixed(2)} MB</div>
                    </div>
                </div>
            </div>
        `;
    }

    attachEvents() {
        document.getElementById('btn-next')?.addEventListener('click', () => {
            this.router.navigate('upload');
        });
    }
}