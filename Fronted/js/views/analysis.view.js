import DocumentService from '../services/document.service.js';
import FiltrosService from '../services/filtros.service.js';
import AuthService from '../services/auth.service.js';
import { showErrorNotification, showSuccessNotification } from '../utils/api.utils.js';

export class AnalysisView {
    constructor(router) {
        this.router = router;
        this.dashboardStats = null;
        this.filters = {
            semestre: null,
            curso: null,
            tema: null
        };
        this.availableFilters = {
            semestres: [],
            cursos: [],
            temas: []
        };
        this.isLoading = false;
        this.isAnalyzing = false;
        this.pollingInterval = null;

        // Cargar filtros iniciales
        this.loadInitialFilters();
    }

    updateView() {
        const mainContent = document.getElementById('main-content');
        if (mainContent) {
            mainContent.innerHTML = this.render();
            this.attachEventListeners();
        }
    }

    async loadInitialFilters() {
        try {
            // ✅ NUEVO: Verificar si hay un ID de evaluación en la URL
            const urlParams = new URLSearchParams(window.location.search);
            const evaluacionId = urlParams.get('evaluacionId');

            if (evaluacionId) {
                console.log('🔗 Detectado evaluacionId en URL:', evaluacionId);
                await this.loadSpecificEvaluation(evaluacionId);

                // Limpiar URL para no re-cargar al refrescar
                window.history.replaceState({}, document.title, window.location.pathname);
                return;
            }

            const semestres = await FiltrosService.getSemestres();
            this.availableFilters.semestres = semestres;

            if (semestres.length === 1) {
                this.filters.semestre = semestres[0];
                await this.loadCursos();
            }

            this.updateView();

        } catch (error) {
            console.error('Error cargando filtros iniciales:', error);
            showErrorNotification('Error al cargar filtros: ' + error.message);
        }
    }

    async loadSpecificEvaluation(evaluacionId) {
        try {
            this.isLoading = true;
            this.isAnalyzing = false; // Manejo más granular ahora
            this.updateView();

            if (this.pollingInterval) {
                clearInterval(this.pollingInterval);
                this.pollingInterval = null;
            }

            const evaluacion = await DocumentService.getEvaluacion(evaluacionId);

            if (!evaluacion) {
                throw new Error('Evaluación no encontrada');
            }

            console.log('✅ Evaluación cargada:', evaluacion);

            // 1. Establecer filtros y cargar listas de filtros INMEDIATAMENTE
            this.filters.semestre = evaluacion.semestre;
            this.filters.curso = evaluacion.codigo_curso;
            this.filters.tema = evaluacion.tema;

            this.availableFilters.semestres = await FiltrosService.getSemestres();
            if (this.filters.semestre) {
                this.availableFilters.cursos = await FiltrosService.getCursos(this.filters.semestre);
            }
            if (this.filters.semestre && this.filters.curso) {
                this.availableFilters.temas = await FiltrosService.getTemas(this.filters.semestre, this.filters.curso);
            }

            // 2. Cargar el dashboard (incluso si está vacío o pendiente)
            // Esto renderizará la estructura y los filtros seleccionados.
            await this.viewThemeDashboard(this.filters.tema);

            // 3. Verificar si la evaluación está completa y, si no, iniciar polling.
            const nota = evaluacion.resultado_analisis ? Number(evaluacion.resultado_analisis.nota_final) : 0;
            if (!evaluacion.resultado_analisis || isNaN(nota) || nota === 0) {
                console.log('⏳ Evaluación en proceso. Los resultados se actualizarán automáticamente.');
                showSuccessNotification('Análisis en curso... El dashboard se actualizará automáticamente.');
                this.startPolling(evaluacionId); // El polling refrescará cuando esté listo.
            }

        } catch (error) {
            console.error('Error cargando evaluación específica:', error);
            showErrorNotification('No se pudo cargar la evaluación solicitada');
            const semestres = await FiltrosService.getSemestres();
            this.availableFilters.semestres = semestres;
            this.isLoading = false;
            this.updateView();
        }
    }

    async loadCursos() {
        if (!this.filters.semestre) return;

        try {
            const cursos = await FiltrosService.getCursos(this.filters.semestre);

            // ✅ Lógica específica para Área de Calidad: Agrupar por nombre
            const user = AuthService.getCurrentUser();
            if (user && user.rol === 'AREA_CALIDAD') {
                // Deduplicar por nombre
                const uniqueCursos = [];
                const seenNames = new Set();

                cursos.forEach(c => {
                    if (!seenNames.has(c.nombre)) {
                        seenNames.add(c.nombre);
                        uniqueCursos.push({
                            codigo: c.nombre, // Usamos el nombre como identificador
                            nombre: c.nombre
                        });
                    }
                });
                this.availableFilters.cursos = uniqueCursos;
            } else {
                this.availableFilters.cursos = cursos;
            }

            if (this.availableFilters.cursos.length === 1) {
                this.filters.curso = this.availableFilters.cursos[0].codigo;
                // Si es calidad, cargamos dashboard directo, si no, cargamos temas
                if (user && user.rol === 'AREA_CALIDAD') {
                    await this.viewQualityDashboard(this.filters.curso);
                } else {
                    await this.loadTemas();
                }
            }
        } catch (error) {
            console.error('Error cargando cursos:', error);
        }
    }

    async loadTemas() {
        if (!this.filters.semestre || !this.filters.curso) return;

        try {
            const temas = await FiltrosService.getTemas(
                this.filters.semestre,
                this.filters.curso
            );
            this.availableFilters.temas = temas;
        } catch (error) {
            console.error('Error cargando temas:', error);
        }
    }

    render() {
        const user = AuthService.getCurrentUser();
        const isQualityArea = user && user.rol === 'AREA_CALIDAD';

        return `
            <div class="page-title">
                <h2>📊 Dashboard de Análisis</h2>
            </div>
            <p class="page-subtitle">
                Visualiza el rendimiento académico y descarga reportes detallados.
            </p>

            <!-- Filtros Superiores -->
            <div class="filters-card">
                <div class="filters-row">
                    <!-- Semestre -->
                    <div class="filter-group">
                        <label for="filterSemestre">Semestre</label>
                        <select id="filterSemestre" class="form-control">
                            <option value="">Seleccionar semestre</option>
                            ${this.availableFilters.semestres.map(s => `
                                <option value="${s}" ${this.filters.semestre === s ? 'selected' : ''}>
                                    ${s}
                                </option>
                            `).join('')}
                        </select>
                    </div>

                    <!-- Curso -->
                    <div class="filter-group">
                        <label for="filterCurso">Curso</label>
                        <select id="filterCurso" class="form-control" 
                                ${!this.filters.semestre ? 'disabled' : ''}>
                            <option value="">Seleccionar curso</option>
                            ${this.availableFilters.cursos.map(c => `
                                <option value="${c.codigo}" ${this.filters.curso === c.codigo ? 'selected' : ''}>
                                    ${isQualityArea ? c.nombre : `${c.codigo} - ${c.nombre}`}
                                </option>
                            `).join('')}
                        </select>
                    </div>
                </div>
            </div>

            <!-- Contenido Principal -->
            <div id="results-container">
                ${this.renderContent()}
            </div>
        `;
    }

    renderContent() {
        if (this.isLoading) {
            return `
                <div class="loading-state">
                    <div class="spinner"></div>
                    <p>Cargando datos...</p>
                </div>
            `;
        }

        if (this.isAnalyzing) {
            return `
                <div class="loading-state">
                    <div class="spinner"></div>
                    <h3>🤖 Analizando con Inteligencia Artificial...</h3>
                    <p>Estamos procesando los documentos y evaluando con Gemini.</p>
                    <p class="text-muted">Por favor espera, los resultados aparecerán automáticamente.</p>
                </div>
            `;
        }

        // ✅ Detectar rol del usuario
        const user = AuthService.getCurrentUser();
        const isQualityArea = user && user.rol === 'AREA_CALIDAD';

        // ✅ Dashboard del Área de Calidad (agregado)
        if (isQualityArea) {
            if (!this.filters.curso) {
                return `
                    <div class="empty-state">
                        <div class="empty-icon">👆</div>
                        <h3>Selecciona un curso</h3>
                        <p>Para ver el rendimiento agregado (todos los códigos/secciones).</p>
                    </div>
                `;
            }
            return this.renderQualityDashboard();
        }

        // ✅ Dashboard del Profesor (individual)
        if (!this.filters.curso) {
            return `
                <div class="empty-state">
                    <div class="empty-icon">👆</div>
                    <h3>Selecciona un curso</h3>
                    <p>Para ver los temas evaluados y sus estadísticas.</p>
                </div>
            `;
        }

        // Si hay curso seleccionado pero no tema, mostrar lista de temas
        if (!this.filters.tema) {
            return this.renderThemesList();
        }

        // Si hay tema seleccionado, mostrar Dashboard
        return this.renderDashboard();
    }

    // =========================================
    // DASHBOARD DEL ÁREA DE CALIDAD
    // =========================================

    renderQualityDashboard() {
        if (!this.dashboardStats) return '';

        const stats = this.dashboardStats;

        return `
            <div class="quality-dashboard">
                <!-- Header informativo -->
                <div class="dashboard-header">
                    <h3 class="section-title">📊 Dashboard de Calidad - ${this.filters.curso}</h3>
                    <p class="section-subtitle">Vista agregada de rendimiento académico (AG-07)</p>
                </div>

                <!-- Grid de métricas -->
                <div class="dashboard-grid">
                    ${this.renderStudentCountCard(stats.total_alumnos)}
                    ${this.renderPerformanceDistribution(stats.criterios)}
                    ${this.renderCriteriaTable(stats.criterios)}
                    ${this.renderAchievementIndicator(stats.porcentaje_logro)}
                </div>
            </div>
        `;
    }

    renderStudentCountCard(total) {
        return `
            <div class="metric-card">
                <div class="metric-icon">👥</div>
                <div class="metric-value">${total}</div>
                <div class="metric-label">Total de alumnos evaluados</div>
                <p class="metric-note">Suma de todos los códigos/secciones del curso</p>
            </div>
        `;
    }

    renderPerformanceDistribution(criterios) {
        // Asumimos que viene un solo criterio AG-07 o tomamos el primero
        const c = criterios[0] || { excelente: 0, bueno: 0, requiereMejora: 0, noAceptable: 0 };

        const total = c.excelente + c.bueno + c.requiereMejora + c.noAceptable;
        const porcentajes = {
            excelente: total > 0 ? (c.excelente / total) * 100 : 0,
            bueno: total > 0 ? (c.bueno / total) * 100 : 0,
            requiereMejora: total > 0 ? (c.requiereMejora / total) * 100 : 0,
            noAceptable: total > 0 ? (c.noAceptable / total) * 100 : 0
        };

        return `
            <div class="metric-card distribution-card">
                <h4 class="card-title">📈 Distribución de Desempeño</h4>
                <div class="distribution-bars">
                    <div class="distribution-row">
                        <span class="dist-label">Excelente (16-20)</span>
                        <div class="dist-bar">
                            <div class="dist-fill excelente" style="width: ${porcentajes.excelente}%"></div>
                        </div>
                        <span class="dist-value">${porcentajes.excelente.toFixed(1)}%</span>
                    </div>
                    <div class="distribution-row">
                        <span class="dist-label">Bueno (11-15)</span>
                        <div class="dist-bar">
                            <div class="dist-fill bueno" style="width: ${porcentajes.bueno}%"></div>
                        </div>
                        <span class="dist-value">${porcentajes.bueno.toFixed(1)}%</span>
                    </div>
                    <div class="distribution-row">
                        <span class="dist-label">Req. Mejora (6-10)</span>
                        <div class="dist-bar">
                            <div class="dist-fill mejora" style="width: ${porcentajes.requiereMejora}%"></div>
                        </div>
                        <span class="dist-value">${porcentajes.requiereMejora.toFixed(1)}%</span>
                    </div>
                    <div class="distribution-row">
                        <span class="dist-label">No Aceptable (0-5)</span>
                        <div class="dist-bar">
                            <div class="dist-fill no-aceptable" style="width: ${porcentajes.noAceptable}%"></div>
                        </div>
                        <span class="dist-value">${porcentajes.noAceptable.toFixed(1)}%</span>
                    </div>
                </div>
            </div>
        `;
    }

    renderCriteriaTable(criterios) {
        return `
            <div class="metric-card criteria-table-card">
                <h4 class="card-title">📋 Rendimiento por Atributo</h4>
                <div class="table-responsive">
                    <table class="criteria-table">
                        <thead>
                            <tr>
                                <th>Atributo</th>
                                <th>Excelente (16-20)</th>
                                <th>Bueno (11-15)</th>
                                <th>Req. Mejora (6-10)</th>
                                <th>No Aceptable (0-5)</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${criterios.map(c => `
                                <tr>
                                    <td class="criteria-code">${c.codigo}</td>
                                    <td class="value-excelente">${c.excelente}</td>
                                    <td class="value-bueno">${c.bueno}</td>
                                    <td class="value-mejora">${c.requiereMejora}</td>
                                    <td class="value-no-aceptable">${c.noAceptable}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
        `;
    }

    renderAchievementIndicator(porcentaje) {
        return `
            <div class="metric-card achievement-card">
                <h4 class="card-title">🎯 Porcentaje de Logro</h4>
                <div class="achievement-circle">
                    <div class="achievement-value">${porcentaje}%</div>
                </div>
                <div class="achievement-bar-container">
                    <div class="achievement-bar">
                        <div class="achievement-fill" style="width: ${porcentaje}%"></div>
                    </div>
                </div>
                <div class="achievement-label">
                    Estudiantes con nivel Excelente o Bueno
                </div>
            </div>
        `;
    }

    renderThemesList() {
        if (this.availableFilters.temas.length === 0) {
            return `
                <div class="empty-state">
                    <h3>No hay temas evaluados</h3>
                    <p>No se encontraron evaluaciones para este curso.</p>
                </div>
            `;
        }

        return `
            <h3 class="section-title">Temas Evaluados</h3>
            <div class="themes-grid">
                ${this.availableFilters.temas.map(tema => `
                    <div class="theme-card">
                        <div class="theme-icon">📑</div>
                        <div class="theme-info">
                            <h4>${tema}</h4>
                            <p>Ver estadísticas detalladas</p>
                        </div>
                        <button class="btn btn-primary btn-sm" data-action="view-theme" data-tema="${tema}">
                            Ver Dashboard ➔
                        </button>
                    </div>
                `).join('')}
            </div>
        `;
    }

    renderDashboard() {
        if (!this.dashboardStats) return '';

        const stats = this.dashboardStats;
        const isHandwritten = stats.tipo_documento === 'examen' || stats.tipo_documento === 'examenes manuscritos';

        return `
            <div class="dashboard-header">
                <button class="btn btn-secondary btn-sm" id="btnBackToThemes">
                    ⬅ Volver a temas
                </button>
                <h3>${this.filters.tema}</h3>
                ${isHandwritten ? `
                    <button class="btn btn-success btn-sm" id="btnDownloadTranscriptions">
                        📥 Descargar Transcripciones (ZIP)
                    </button>
                ` : ''}
            </div>

            <!-- Estadísticas Generales -->
            <div class="stats-grid">
                <div class="stat-card">
                    <div class="stat-icon blue">👥</div>
                    <div class="stat-data">
                        <span>Total Estudiantes</span>
                        <h3>${stats.general.total}</h3>
                    </div>
                </div>
                <div class="stat-card green">
                    <div class="stat-icon">📊</div>
                    <div class="stat-data">
                        <span>Promedio General</span>
                        <h3>${stats.general.promedio}</h3>
                    </div>
                </div>
                <div class="stat-card orange">
                    <div class="stat-icon">⚠️</div>
                    <div class="stat-data">
                        <span>Desaprobados</span>
                        <h3>${stats.general.desaprobados}</h3>
                    </div>
                </div>
                <div class="stat-card purple">
                    <div class="stat-icon">✅</div>
                    <div class="stat-data">
                        <span>Aprobados</span>
                        <h3>${stats.general.aprobados}</h3>
                    </div>
                </div>
            </div>

            <div class="charts-row">
                <!-- Distribución de Notas -->
                <div class="chart-card">
                    <h4>Distribución de Notas</h4>
                    <div class="bar-chart">
                        ${Object.entries(stats.distribucion).map(([range, count]) => `
                            <div class="bar-row">
                                <span class="bar-label">${range}</span>
                                <div class="bar-container">
                                    <div class="bar-fill ${this.getBarColor(range)}" 
                                         style="width: ${(count / stats.general.total * 100) || 0}%"></div>
                                </div>
                                <span class="bar-value">${count}</span>
                            </div>
                        `).join('')}
                    </div>
                </div>

                <!-- Promedio por Criterio -->
                <div class="chart-card">
                    <h4>Promedio por Criterio</h4>
                    <div class="bar-chart">
                        ${stats.criterios.map(c => `
                            <div class="bar-row">
                                <span class="bar-label">${c.nombre}</span>
                                <div class="bar-container">
                                    <div class="bar-fill purple-gradient" 
                                         style="width: ${c.porcentaje}%"></div>
                                </div>
                                <span class="bar-value">${c.porcentaje}%</span>
                            </div>
                        `).join('')}
                    </div>
                </div>
            </div>

            <!-- Lista de Estudiantes (Acordeón) -->
            <div class="main-card">
                <div class="card-header">
                    <h4>Lista de Estudiantes (${stats.estudiantes.length})</h4>
                </div>
                <div class="card-body">
                    <div class="student-accordion">
                        ${stats.estudiantes.map(e => `
                            <div class="student-item" data-id="${e.id}">
                                <div class="student-header" onclick="this.parentElement.classList.toggle('active')">
                                    <div class="student-info">
                                        <div class="student-avatar">${e.nombre.charAt(0)}</div>
                                        <div>
                                            <strong>${e.nombre}</strong>
                                            <small>Evaluado: ${e.fecha ? new Date(e.fecha).toLocaleDateString() : 'N/A'}</small>
                                        </div>
                                    </div>
                                    <div class="student-grade">
                                        <span class="nota-large ${e.nota >= 10.5 ? 'text-green' : 'text-red'}">
                                            ${e.nota}
                                        </span>
                                        <span class="toggle-icon">▼</span>
                                    </div>
                                </div>
                                <div class="student-details">
                                    <div class="criteria-grid">
                                        ${e.criterios.map(c => `
                                            <div class="criterion-detail-card">
                                                <div class="criterion-header">
                                                    <span class="criterion-name">${c.nombre}</span>
                                                    <span class="criterion-score ${c.porcentaje >= 50 ? 'high' : 'low'}">
                                                        ${c.porcentaje}%
                                                    </span>
                                                </div>
                                                <div class="criterion-feedback">
                                                    <p>${c.feedback}</p>
                                                </div>
                                            </div>
                                        `).join('')}
                                    </div>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>
            </div>
        `;
    }

    getBarColor(range) {
        if (range === '0-4' || range === '5-8') return 'bg-red';
        if (range === '9-12') return 'bg-orange';
        return 'bg-green';
    }

    attachEventListeners() {
        // Filtros
        const filterSemestre = document.getElementById('filterSemestre');
        if (filterSemestre) {
            filterSemestre.addEventListener('change', async (e) => {
                this.filters.semestre = e.target.value || null;
                this.filters.curso = null;
                this.filters.tema = null;
                this.availableFilters.cursos = [];
                this.availableFilters.temas = [];
                if (this.filters.semestre) await this.loadCursos();
                this.updateView();
            });
        }

        const filterCurso = document.getElementById('filterCurso');
        if (filterCurso) {
            filterCurso.addEventListener('change', async (e) => {
                this.filters.curso = e.target.value || null;
                this.filters.tema = null;
                this.availableFilters.temas = [];

                const user = AuthService.getCurrentUser();
                if (user && user.rol === 'AREA_CALIDAD') {
                    // Si es calidad, cargamos dashboard directo
                    if (this.filters.curso) {
                        await this.viewQualityDashboard(this.filters.curso);
                    } else {
                        this.updateView();
                    }
                } else {
                    // Si es profesor, cargamos temas
                    if (this.filters.curso) await this.loadTemas();
                    this.updateView();
                }
            });
        }

        // Ver Dashboard de un tema
        document.querySelectorAll('[data-action="view-theme"]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const tema = e.target.dataset.tema;
                this.viewThemeDashboard(tema);
            });
        });

        // Volver a lista de temas
        const btnBack = document.getElementById('btnBackToThemes');
        if (btnBack) {
            btnBack.addEventListener('click', () => {
                this.filters.tema = null;
                this.dashboardStats = null;
                this.updateView();
            });
        }

        // Descargar Transcripciones
        const btnDownload = document.getElementById('btnDownloadTranscriptions');
        if (btnDownload) {
            btnDownload.addEventListener('click', () => this.downloadTranscriptions());
        }
    }

    async viewThemeDashboard(tema) {
        this.filters.tema = tema;
        this.isLoading = true;
        this.updateView();

        try {
            const stats = await DocumentService.getDashboardStats(this.filters);
            this.dashboardStats = stats;
        } catch (error) {
            console.error('Error loading dashboard:', error);
            showErrorNotification(error);
            this.filters.tema = null; // Volver atrás si falla
        } finally {
            this.isLoading = false;
            this.updateView();
        }
    }

    async viewQualityDashboard(curso) {
        this.filters.curso = curso;
        this.isLoading = true;
        this.updateView();

        try {
            const stats = await DocumentService.getQualityDashboardStats({
                semestre: this.filters.semestre,
                curso: curso
            });
            this.dashboardStats = stats;
        } catch (error) {
            console.error('Error loading quality dashboard:', error);
            showErrorNotification(error);
            this.filters.curso = null;
        } finally {
            this.isLoading = false;
            this.updateView();
        }
    }

    async downloadTranscriptions() {
        try {
            // Mostrar indicador de carga en el botón si fuera necesario
            await DocumentService.downloadTranscriptions(this.filters);
        } catch (error) {
            console.error('Error downloading:', error);
            showErrorNotification('Error al descargar transcripciones');
        }
    }
    startPolling(evaluacionId) {
        let attempts = 0;
        const maxAttempts = 60; // 5 minutos aprox

        this.pollingInterval = setInterval(async () => {
            attempts++;
            try {
                const evaluacion = await DocumentService.getEvaluacion(evaluacionId);
                const nota = evaluacion.resultado_analisis ? Number(evaluacion.resultado_analisis.nota_final) : 0;
                console.log(`🔄 Polling intento ${attempts}: Nota ${nota}`);

                if (nota > 0) {
                    // Evaluación completada
                    clearInterval(this.pollingInterval);
                    this.pollingInterval = null;
                    this.isAnalyzing = false;
                    showSuccessNotification('✅ Evaluación completada');

                    // Recargar vista completa
                    this.loadSpecificEvaluation(evaluacionId);
                } else if (attempts >= maxAttempts) {
                    clearInterval(this.pollingInterval);
                    this.pollingInterval = null;
                    this.isAnalyzing = false;
                    showErrorNotification('Tiempo de espera agotado. Recarga la página.');
                    this.updateView();
                }
            } catch (error) {
                console.error('Error en polling:', error);
            }
        }, 5000);
    }
}
