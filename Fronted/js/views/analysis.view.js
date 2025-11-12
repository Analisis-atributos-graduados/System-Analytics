import { DOMUtils } from '../utils/dom.utils.js';
import { StorageUtils } from '../utils/storage.utils.js';
import { API_CONFIG } from '../config/api.config.js';
import DocumentService from '../services/document.service.js';

export class AnalysisView {
    constructor(router) {
        this.router = router;
        this.expandedItems = new Set();
    }

    render() {
        this.analysisData = StorageUtils.load('analysisResults');
        console.log('Loaded analysisData in AnalysisView render:', this.analysisData);

        if (this.analysisData && this.analysisData.evaluaciones) {
            this.students = this.analysisData.evaluaciones.map(e => ({
                id: e.id,
                nombre: e.nombre_alumno,
                puntajeGlobal: e.resultado_analisis ? e.resultado_analisis.nota_final : 0, // Use final grade (0-20)
                analisis: e.resultado_analisis || { aplicacion_conceptos: 0, relacion_contextual: 0, coherencia_logica: 0 },
                meta: `Evaluado: ${new Date().toLocaleDateString()}` // Placeholder, ideally from backend
            }));
        } else {
            this.students = [];
        }

        if (!this.analysisData || this.students.length === 0) {
            this.renderNoData();
            return;
        }

        const html = `
            <div class="page-title">
                <h2>Dashboard de análisis</h2>
            </div>
            <p class="page-subtitle">Revisa los resultados de evaluación de todos los documentos procesados.</p>

            ${this.renderDownloadButton()}
            ${this.renderStatistics()}
            ${this.renderStudentsList()}
        `;

        DOMUtils.render('#main-content', html);
        this.addStyles();
        this.attachEvents();
    }

    renderNoData() {
        const html = `
            <div class="page-title">
                <h2>Dashboard de análisis</h2>
            </div>
            <div class="main-card" style="text-align: center; padding: 80px 40px;">
                <div style="font-size: 64px; margin-bottom: 20px;">📊</div>
                <h3>No hay análisis disponibles</h3>
                <p style="color: #888; margin: 20px 0;">Sube un documento para comenzar el análisis.</p>
                <button class="btn btn-primary" id="btn-go-upload">
                    📤 Ir a Subir Archivos
                </button>
            </div>
        `;

        DOMUtils.render('#main-content', html);
        
        document.getElementById('btn-go-upload')?.addEventListener('click', () => {
            this.router.navigate('upload');
        });
    }

    renderDownloadButton() {
    const hasExams = this.analysisData?.evaluaciones?.some(e => e.tipo_documento === 'examen');
    
    // Solo mostrar el botón si hay exámenes
    if (!hasExams) {
        return ''; // No renderizar nada
    }
    
    return `
        <div style="margin-bottom: 30px;">
            <button class="btn btn-primary" id="btn-download-transcriptions">
                Descargar Transcripciones (solo exámenes)
            </button>
        </div>
    `;
    }


    renderStatistics() {
        const students = this.students;
        if (!students || students.length === 0) return '';

        const totalStudents = students.length;
        const averageScore = students.reduce((sum, s) => sum + s.puntajeGlobal, 0) / totalStudents; // Use final grades
        const failedStudents = students.filter(s => s.puntajeGlobal < 10.5).length; // Passing grade >= 10.5 (for 11 or higher)
        
        const avgAplicacion = students.reduce((sum, s) => sum + s.analisis.aplicacion_conceptos, 0) / totalStudents;
        const avgRelacion = students.reduce((sum, s) => sum + s.analisis.relacion_contextual, 0) / totalStudents;
        const avgCoherencia = students.reduce((sum, s) => sum + s.analisis.coherencia_logica, 0) / totalStudents;

        return `
            <div style="margin-bottom: 40px;">
                <h3 style="margin-bottom: 20px; font-size: 20px;">Estadísticas Generales</h3>
                
                <!-- Tarjetas de resumen -->
                <div class="stats-grid">
                    <div class="stat-card">
                        <div class="stat-icon blue-icon">👥</div>
                        <div class="stat-content">
                            <h3>Total Estudiantes</h3>
                            <p>${totalStudents}</p>
                        </div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-icon green-icon">📊</div>
                        <div class="stat-content">
                            <h3>Promedio General</h3>
                            <p style="color: #10b981;">${averageScore.toFixed(1)}</p> <!-- Display average grade -->
                        </div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-icon orange-icon">⚠️</div>
                        <div class="stat-content">
                            <h3>Desaprobados</h3>
                            <p style="color: #f97316;">${failedStudents}</p>
                        </div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-icon purple-icon">✅</div>
                        <div class="stat-content">
                            <h3>Aprobados</h3>
                            <p style="color: #10b981;">${totalStudents - failedStudents}</p>
                        </div>
                    </div>
                </div>

                <!-- Gráficos -->
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 30px; margin-top: 30px;">
                    <!-- Distribución de notas -->
                    <div class="chart-card">
                        <h4 style="margin-bottom: 20px; font-size: 16px;">Distribución de Notas</h4>
                        <div class="bar-chart">
                            ${this.renderBarChart(students)}
                        </div>
                    </div>

                    <!-- Promedio por criterio -->
                    <div class="chart-card">
                        <h4 style="margin-bottom: 20px; font-size: 16px;">Promedio por Criterio</h4>
                        <div style="display: flex; flex-direction: column; gap: 15px;">
                            ${this.renderCriteriaBar('Aplicación Conceptos', avgAplicacion)}
                            ${this.renderCriteriaBar('Relación Contextual', avgRelacion)}
                            ${this.renderCriteriaBar('Coherencia Lógica', avgCoherencia)}
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    renderBarChart(students) {
        const ranges = [
            { label: '0-4', min: 0, max: 5, color: '#ef4444' },
            { label: '5-8', min: 5, max: 9, color: '#f97316' },
            { label: '9-12', min: 9, max: 13, color: '#f59e0b' },
            { label: '13-16', min: 13, max: 17, color: '#10b981' },
            { label: '17-20', min: 17, max: 21, color: '#059669' } // Max is exclusive, so 21 for 20
        ];

        const counts = ranges.map(range => 
            students.filter(s => s.puntajeGlobal >= range.min && s.puntajeGlobal < range.max).length
        );

        const maxCount = Math.max(...counts, 1);

        return ranges.map((range, i) => `
            <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 10px;">
                <span style="width: 80px; font-size: 12px; color: #999;">${range.label}</span>
                <div style="flex: 1; background: rgba(255,255,255,0.05); border-radius: 5px; height: 30px; position: relative;">
                    <div style="width: ${(counts[i] / maxCount) * 100}%; height: 100%; background: ${range.color}; border-radius: 5px; display: flex; align-items: center; justify-content: flex-end; padding-right: 10px;">
                        <span style="color: white; font-size: 12px; font-weight: 600;">${counts[i]}</span>
                    </div>
                </div>
            </div>
        `).join('');
    }

    renderCriteriaBar(label, value) {
        const percentage = (value * 100).toFixed(1);
        return `
            <div>
                <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                    <span style="font-size: 13px; color: #666;">${label}</span>
                    <span style="font-size: 13px; color: #10b981; font-weight: 600;">${percentage}%</span>
                </div>
                <div class="progress-bar">
                    <div class="progress-fill" style="width: ${percentage}%;"></div>
                </div>
            </div>
        `;
    }

    renderStudentsList() {
        const students = this.students;
        if (!students || students.length === 0) return '<p>No hay estudiantes para mostrar.</p>';

        return `
            <div>
                <h3 style="margin-bottom: 20px; font-size: 20px;">Lista de Estudiantes (${students.length})</h3>
                
                <div class="students-list">
                    ${students.map((student, index) => this.renderStudentItem(student, index)).join('')}
                </div>
            </div>
        `;
    }

    renderStudentItem(student, index) {
        const isExpanded = this.expandedItems.has(index);
        const nota = student.puntajeGlobal.toFixed(1); // Display grade with one decimal
        const statusColor = student.puntajeGlobal >= 10.5 ? '#10b981' : '#ef4444'; // Passing grade >= 10.5 (for 11 or higher)

        return `
            <div class="student-item ${isExpanded ? 'expanded' : ''}" data-index="${index}">
                <div class="student-header">
                    <div class="student-info">
                        <div class="student-avatar">${student.nombre.charAt(0)}</div>
                        <div>
                            <div class="student-name">${student.nombre}</div>
                            <div class="student-meta">${student.meta}</div>
                        </div>
                    </div>
                    <div class="student-score" style="color: ${statusColor};">
                        ${nota}
                    </div>
                    <div class="expand-icon">${isExpanded ? '▼' : '▶'}</div>
                </div>

                ${isExpanded ? `
                    <div class="student-details expanded-details">
                        <div class="details-grid">
                            ${this.renderDetailMetric('Aplicación de Conceptos', student.analisis.aplicacion_conceptos)}
                            ${this.renderDetailMetric('Relación Contextual', student.analisis.relacion_contextual)}
                            ${this.renderDetailMetric('Coherencia Lógica', student.analisis.coherencia_logica)}
                        </div>
                    </div> <!-- Added missing closing div -->
                ` : `
                    <div class="student-details">
                        <div class="details-grid">
                            ${this.renderDetailMetric('Aplicación de Conceptos', student.analisis.aplicacion_conceptos)}
                            ${this.renderDetailMetric('Relación Contextual', student.analisis.relacion_contextual)}
                            ${this.renderDetailMetric('Coherencia Lógica', student.analisis.coherencia_logica)}
                        </div>
                    </div> <!-- Added missing closing div -->
                `}
            </div>
        `;
    }

    renderDetailMetric(label, value) {
        const percentage = (value * 100).toFixed(1);
        return `
            <div class="detail-metric">
                <div class="detail-label" style="color: #555;">${label}</div>
                <div class="detail-value">${percentage}%</div>
                <div class="progress-bar" style="height: 8px;">
                    <div class="progress-fill" style="width: ${percentage}%;"></div>
                </div>
            </div>
        `;
    }



    addStyles() {
        if (document.getElementById('analysis-view-styles')) return;

        const style = document.createElement('style');
        style.id = 'analysis-view-styles';
        style.textContent = `
            .chart-card {
                background: var(--card-bg);
                border: 1px solid var(--card-border);
                border-radius: 15px;
                padding: 25px;
            }

            .students-list {
                display: flex;
                flex-direction: column;
                align-items: stretch; /* Ensure flex items stretch */
                flex-wrap: wrap; /* Allow items to wrap */
            }

            .student-item {
                background: var(--card-bg);
                border: 1px solid var(--card-border);
                border-radius: 12px;
                flex-shrink: 0; /* Prevent shrinking */
                min-height: fit-content; /* Ensure it sizes based on content */
                overflow: visible; /* Ensure content is not clipped */
                flex-basis: auto; /* Ensure size is determined by content */
                box-sizing: border-box; /* Include padding and border in total height */
                margin-bottom: 15px; /* Add spacing between items */
                display: block; /* Ensure block-level behavior */
                cursor: pointer;
            }

            .student-item:last-child {
                margin-bottom: 0; /* No margin for the last item */
            }

            .student-item:hover {
                border-color: var(--primary-light);
                transform: translateX(5px);
            }

            .student-header {
                display: flex;
                align-items: center;
                justify-content: space-between;
                padding: 20px;
            }

            .student-info {
                display: flex;
                align-items: center;
                gap: 15px;
                flex: 1;
            }

            .student-avatar {
                width: 50px;
                height: 50px;
                border-radius: 50%;
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 20px;
                font-weight: 700;
                color: white;
            }

            .student-name {
                font-size: 16px;
                color: var(--text-color);
                font-weight: 600;
                margin-bottom: 4px;
            }

            .student-meta {
                font-size: 12px;
                color: var(--secondary-text);
            }

            .student-score {
                font-size: 24px;
                font-weight: 700;
                margin-right: 20px;
            }

            .expand-icon {
                font-size: 14px;
                color: var(--secondary-text);
                transition: transform 0.3s;
            }

            .student-item.expanded .expand-icon {
                transform: rotate(90deg);
            }

            .student-details {
                padding: 0 20px;
                border-top: 1px solid var(--card-border);
                box-sizing: border-box; /* Include padding and border in total height */
                max-height: 0;
                overflow: hidden;
                transition: max-height 0.3s ease-out, padding 0.3s ease-out;
            }

            .student-details.expanded-details {
                max-height: 500px; /* Sufficiently large value to show content */
                padding-bottom: 20px;
            }

            @keyframes slideDown {
                from {
                    opacity: 0;
                    transform: translateY(-10px);
                }
                to {
                    opacity: 1;
                    transform: translateY(0);
                }
            }

            .details-grid {
                display: grid;
                grid-template-columns: repeat(3, 1fr);
                gap: 20px;
                margin-top: 20px;
            }

            .detail-metric {
                background: var(--input-bg);
                padding: 15px;
                border-radius: 10px;
            }

            .detail-label {
                font-size: 12px;
                color: var(--secondary-text);
                margin-bottom: 8px;
            }

            .detail-value {
                font-size: 20px;
                color: #10b981;
                font-weight: 700;
                margin-bottom: 10px;
            }

            @media (max-width: 768px) {
                .details-grid {
                    grid-template-columns: 1fr;
                }
            }
        `;
        document.head.appendChild(style);
    }

    attachEvents() {
        document.getElementById('btn-download-transcriptions')?.addEventListener('click', () => {
            this.downloadTranscriptions();
        });

        document.querySelectorAll('.student-item').forEach(item => {
            item.addEventListener('click', (e) => {
                if (e.target.closest('.btn-view-details')) {
                    const studentId = e.target.closest('.btn-view-details').dataset.id;
                    this.viewStudentDetails(studentId);
                    return;
                }
                const index = parseInt(e.currentTarget.dataset.index);
                this.toggleStudent(index);
            });
        });
    }

    toggleStudent(index) {
        if (this.expandedItems.has(index)) {
            this.expandedItems.delete(index); // Close if already open
        } else {
            this.expandedItems.add(index); // Open the clicked one
        }
        this.render();
    }

    viewStudentDetails(studentId) {
        // Here you would navigate to a detailed view or show a modal
        alert(`Navegando a los detalles del estudiante con ID: ${studentId}`);
        // Example: this.router.navigate(`analysis/${studentId}`);
    }

    async downloadTranscriptions() {
    if (!this.analysisData || !this.analysisData.evaluaciones || this.analysisData.evaluaciones.length === 0) {
        alert("No hay análisis disponibles para descargar transcripciones.");
        return;
    }

    const evaluacionesExamen = this.analysisData.evaluaciones.filter(e => e.tipo_documento === 'examen');
    
    if (evaluacionesExamen.length === 0) {
        alert("No hay exámenes disponibles. Las transcripciones solo están disponibles para exámenes manuscritos.");
        return;
    }

    const evaluacionIds = evaluacionesExamen.map(e => e.id);
    
    try {
        const blob = await DocumentService.downloadTranscriptionsZip(evaluacionIds);
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', 'transcripciones-evaluaciones.zip');
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
    } catch (error) {
        console.error("Error al descargar el ZIP de transcripciones:", error);
        alert("Error al descargar el archivo ZIP de transcripciones.");
    }
}

}