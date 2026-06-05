import DocumentService from '../services/document.service.js';
import FiltrosService from '../services/filtros.service.js';
import AuthService from '../services/auth.service.js';
import { showErrorNotification, showSuccessNotification } from '../utils/api.utils.js';

export class AnalysisView {
    constructor(router) {
        this.router = router;
        this.isDestroyed = false;
        this.dashboardStats = null;
        this.filters = {
            semestre: null,
            facultad_id: null,
            escuela_id: null,
            curso: null,
            nrc: null,
            tema: null,
            atributo: null
        };
        this.availableFilters = {
            semestres: [],
            facultades: [],
            escuelas: [],
            cursos: [],
            nrcs: [],
            temas: [],
            atributos: Array.from({ length: 12 }, (_, i) => ({
                codigo: `AG-${String(i + 1).padStart(2, '0')}`,
                nombre: `Atributo de Graduado ${i + 1}`
            }))
        };
        this.allCursos = [];
        this.isLoading = false;
        this.isAnalyzing = false;
        this.pollingInterval = null;

        this.loadInitialFilters();
    }

    updateView() {
        if (this.isDestroyed) { return; }
        const mainContent = document.getElementById('main-content');
        if (mainContent) {
            mainContent.innerHTML = this.render();
            this.attachEventListeners();
        }
    }

    async loadInitialFilters() {
        try {
            const urlParams = new URLSearchParams(window.location.search);
            const evaluacionId = urlParams.get('evaluacionId');

            if (evaluacionId) {
                console.log('Detectado evaluacionId en URL:', evaluacionId);
                await this.loadSpecificEvaluation(evaluacionId);

                window.history.replaceState({}, document.title, window.location.pathname);
                return;
            }

            const semestres = await FiltrosService.getSemestres();
            this.availableFilters.semestres = semestres;

            const user = AuthService.getCurrentUser();
            const isDirac = user && user.rol === 'DIRAC';
            if (isDirac) {
                const facultades = await FiltrosService.getFacultades();
                this.availableFilters.facultades = facultades;
            }

            if (semestres.length === 1) {
                this.filters.semestre = semestres[0];
                await this.loadCursos();
                if (isDirac) {
                    await this.viewQualityDashboard(this.filters.curso);
                }
            }

            this.updateView();

        } catch (error) {
            console.error('Error cargando filtros iniciales:', error);
            showErrorNotification('Error al cargar filtros: ' + error.message);
        }
    }

    async loadSpecificEvaluation(evaluacionId) {
        try {
            if (this.pollingInterval) {
                clearInterval(this.pollingInterval);
                this.pollingInterval = null;
            }

            const evaluacion = await DocumentService.getEvaluacion(evaluacionId);

            if (!evaluacion) {
                throw new Error('Evaluación no encontrada');
            }

            console.log('Evaluación cargada:', evaluacion);

            const nota = evaluacion.resultado_analisis ? Number(evaluacion.resultado_analisis.nota_final) : 0;
            const isComplete = evaluacion.resultado_analisis && !isNaN(nota) && nota > 0;

            if (!isComplete) {

                console.log('Evaluación en proceso. Iniciando polling...');
                this.isLoading = false;
                this.isAnalyzing = true;
                this.updateView();
                showSuccessNotification('Analizando con IA... El dashboard se cargará automáticamente.');
                this.startPolling(evaluacionId);
                return;
            }

            this.isLoading = true;
            this.isAnalyzing = false;
            this.updateView();

            this.filters.semestre = evaluacion.semestre;
            this.filters.curso = evaluacion.codigo_curso;
            this.filters.tema = evaluacion.tema;

            this.availableFilters.semestres = await FiltrosService.getSemestres();
            const user = AuthService.getCurrentUser();
            const isDirac = user && user.rol === 'DIRAC';
            if (isDirac) {
                this.availableFilters.facultades = await FiltrosService.getFacultades();
            }

            if (this.filters.semestre) {
                const cursos = await FiltrosService.getCursos(this.filters.semestre);

                if (user && ['DOCENTE_CIAC', 'DIRECTOR_ESCUELA', 'DIRAC'].includes(user.rol)) {
                    const uniqueCursosMap = new Map();
                    cursos.forEach(c => {
                        if (!uniqueCursosMap.has(c.nombre)) {
                            uniqueCursosMap.set(c.nombre, {
                                codigo: c.nombre,
                                nombre: c.nombre,
                                atributos: new Set(c.atributos || [])
                            });
                        } else {
                            const existing = uniqueCursosMap.get(c.nombre);
                            if (c.atributos) {
                                c.atributos.forEach(a => existing.atributos.add(a));
                            }
                        }
                    });
                    this.allCursos = Array.from(uniqueCursosMap.values()).map(c => ({
                        ...c,
                        atributos: Array.from(c.atributos)
                    }));
                } else {
                    this.allCursos = cursos;
                }

                this.availableFilters.cursos = this.allCursos;
            }

            if (this.filters.semestre && this.filters.curso) {
                this.availableFilters.temas = await FiltrosService.getTemas(this.filters.semestre, this.filters.curso);
            }

            await this.viewThemeDashboard(this.filters.tema);

            console.log('Dashboard cargado con evaluación completa');
            showSuccessNotification('✅ Evaluación completada');

        } catch (error) {
            console.error('Error cargando evaluación específica:', error);
            showErrorNotification('No se pudo cargar la evaluación solicitada');
            const semestres = await FiltrosService.getSemestres();
            this.availableFilters.semestres = semestres;
        } finally {
            this.isLoading = false;
            this.updateView();
        }
    }

    async loadEscuelas() {
        if (!this.filters.facultad_id) {
            this.availableFilters.escuelas = [];
            return;
        }
        try {
            const escuelas = await FiltrosService.getEscuelas(this.filters.facultad_id);
            this.availableFilters.escuelas = escuelas;
        } catch (error) {
            console.error('Error cargando escuelas:', error);
        }
    }

    async loadNrcs() {
        if (!this.filters.semestre || !this.filters.curso) {
            this.availableFilters.nrcs = [];
            return;
        }
        try {
            const nrcs = await FiltrosService.getNrcs(this.filters.semestre, this.filters.curso);
            this.availableFilters.nrcs = nrcs;
        } catch (error) {
            console.error('Error cargando NRCs:', error);
        }
    }

    async loadCursos() {
        if (!this.filters.semestre) return;

        try {
            const user = AuthService.getCurrentUser();
            const isDirac = user && user.rol === 'DIRAC';
            const escuelaId = isDirac ? this.filters.escuela_id : null;

            const cursos = await FiltrosService.getCursos(this.filters.semestre, escuelaId);

            if (user && ['DOCENTE_CIAC', 'DIRECTOR_ESCUELA', 'DIRAC'].includes(user.rol)) {
                const uniqueCursosMap = new Map();

                cursos.forEach(c => {
                    if (!uniqueCursosMap.has(c.nombre)) {
                        uniqueCursosMap.set(c.nombre, {
                            codigo: c.nombre,
                            nombre: c.nombre,
                            atributos: new Set(c.atributos || [])
                        });
                    } else {
                        const existing = uniqueCursosMap.get(c.nombre);
                        if (c.atributos) {
                            c.atributos.forEach(a => existing.atributos.add(a));
                        }
                    }
                });

                this.allCursos = Array.from(uniqueCursosMap.values()).map(c => ({
                    ...c,
                    atributos: Array.from(c.atributos)
                }));

            } else {
                this.allCursos = cursos;
            }

            this.applyCourseFilters();

        } catch (error) {
            console.error('Error cargando cursos:', error);
        }
    }

    applyCourseFilters() {
        let filtered = this.allCursos;

        if (this.filters.atributo) {
            filtered = filtered.filter(c => c.atributos && c.atributos.includes(this.filters.atributo));
        }

        this.availableFilters.cursos = filtered;

        if (this.filters.curso && !filtered.find(c => c.codigo === this.filters.curso)) {
            this.filters.curso = null;
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
        const isQualityArea = user && ['DOCENTE_CIAC', 'DIRECTOR_ESCUELA', 'DIRAC'].includes(user.rol);
        const isDirac = user && user.rol === 'DIRAC';

        return `
            <div class="page-title">
                <h2>📊 Dashboard de Análisis</h2>
            </div>
            <p class="page-subtitle">
                Visualiza el rendimiento académico y descarga reportes detallados.
            </p>

            <!-- Filtros Superiores -->
            <div class="filters-card">
                ${isDirac ? `
                <div class="filters-grid" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem;">
                    <!-- Semestre -->
                    <div class="filter-group">
                        <label for="filterSemestre">Ciclo / Semestre</label>
                        <select id="filterSemestre" class="form-control">
                            <option value="">Seleccionar ciclo</option>
                            ${this.availableFilters.semestres.map(s => `
                                <option value="${s}" ${this.filters.semestre === s ? 'selected' : ''}>
                                    ${s}
                                </option>
                            `).join('')}
                        </select>
                    </div>

                    <!-- Facultad -->
                    <div class="filter-group">
                        <label for="filterFacultad">Facultad</label>
                        <select id="filterFacultad" class="form-control" ${!this.filters.semestre ? 'disabled' : ''}>
                            <option value="">Todas las facultades</option>
                            ${(this.availableFilters.facultades || []).map(f => `
                                <option value="${f.id}" ${Number(this.filters.facultad_id) === Number(f.id) ? 'selected' : ''}>
                                    ${f.nombre}
                                </option>
                            `).join('')}
                        </select>
                    </div>

                    <!-- Escuela -->
                    <div class="filter-group">
                        <label for="filterEscuela">Escuela</label>
                        <select id="filterEscuela" class="form-control" ${!this.filters.semestre || !this.filters.facultad_id ? 'disabled' : ''}>
                            <option value="">Todas las escuelas</option>
                            ${(this.availableFilters.escuelas || []).map(e => `
                                <option value="${e.id}" ${Number(this.filters.escuela_id) === Number(e.id) ? 'selected' : ''}>
                                    ${e.nombre}
                                </option>
                            `).join('')}
                        </select>
                    </div>

                    <!-- Atributo -->
                    <div class="filter-group">
                        <label for="filterAtributo">Atributo</label>
                        <select id="filterAtributo" class="form-control" ${!this.filters.semestre ? 'disabled' : ''}>
                            <option value="">Seleccionar atributo</option>
                            ${this.availableFilters.atributos.map(a => `
                                <option value="${a.codigo}" ${this.filters.atributo === a.codigo ? 'selected' : ''}>
                                    ${a.codigo} - ${a.nombre}
                                </option>
                            `).join('')}
                        </select>
                    </div>

                    <!-- Curso -->
                    <div class="filter-group">
                        <label for="filterCurso">Curso</label>
                        <select id="filterCurso" class="form-control" ${!this.filters.semestre ? 'disabled' : ''}>
                            <option value="">${this.filters.semestre && this.availableFilters.cursos.length === 0 ? 'No tienes cursos asignados' : 'Todos los cursos'}</option>
                            ${this.availableFilters.cursos.map(c => `
                                <option value="${c.codigo}" ${this.filters.curso === c.codigo ? 'selected' : ''}>
                                    ${c.nombre}
                                </option>
                            `).join('')}
                        </select>
                    </div>

                    <!-- NRC -->
                    <div class="filter-group">
                        <label for="filterNrc">NRC</label>
                        <select id="filterNrc" class="form-control" ${!this.filters.semestre || !this.filters.curso ? 'disabled' : ''}>
                            <option value="">Todos los NRCs</option>
                            ${(this.availableFilters.nrcs || []).map(n => `
                                <option value="${n}" ${Number(this.filters.nrc) === Number(n) ? 'selected' : ''}>
                                    ${n}
                                </option>
                            `).join('')}
                        </select>
                    </div>
                </div>
                ` : `
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

                    <!-- Atributo (Solo Calidad) -->
                    ${isQualityArea ? `
                    <div class="filter-group">
                        <label for="filterAtributo">Atributo</label>
                        <select id="filterAtributo" class="form-control" ${!this.filters.semestre ? 'disabled' : ''}>
                            <option value="">Seleccionar atributo</option>
                            ${this.availableFilters.atributos.map(a => `
                                <option value="${a.codigo}" ${this.filters.atributo === a.codigo ? 'selected' : ''}>
                                    ${a.codigo} - ${a.nombre}
                                </option>
                            `).join('')}
                        </select>
                    </div>
                    ` : ''}

                    <!-- Curso -->
                    <div class="filter-group">
                        <label for="filterCurso">Curso</label>
                        <select id="filterCurso" class="form-control" 
                                ${!this.filters.semestre || (isQualityArea && !this.filters.atributo) ? 'disabled' : ''}>
                            <option value="">${this.filters.semestre && this.availableFilters.cursos.length === 0 ? 'No tienes cursos asignados' : 'Seleccionar curso'}</option>
                            ${this.availableFilters.cursos.map(c => `
                                <option value="${c.codigo}" ${this.filters.curso === c.codigo ? 'selected' : ''}>
                                    ${c.nombre}
                                </option>
                            `).join('')}
                        </select>
                    </div>
                </div>
                `}
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

        const user = AuthService.getCurrentUser();
        const isQualityArea = user && ['DOCENTE_CIAC', 'DIRECTOR_ESCUELA', 'DIRAC'].includes(user.rol);
        const isDirac = user && user.rol === 'DIRAC';

        if (isQualityArea) {
            if (isDirac) {
                if (!this.filters.semestre) {
                    return `
                        <div class="empty-state">
                            <div class="empty-icon">📅</div>
                            <h3>Selecciona un ciclo / semestre</h3>
                            <p>Para ver las estadísticas de calidad a nivel global, facultad o escuela.</p>
                        </div>
                    `;
                }
            } else {
                if (!this.filters.curso) {
                    return `
                        <div class="empty-state">
                            <div class="empty-icon">👆</div>
                            <h3>Selecciona un curso</h3>
                            <p>Para ver el rendimiento agregado (todos los códigos/secciones).</p>
                        </div>
                    `;
                }
            }
            return this.renderQualityDashboard();
        }

        if (!this.filters.curso) {
            return `
                <div class="empty-state">
                    <div class="empty-icon">👆</div>
                    <h3>Selecciona un curso</h3>
                    <p>Para ver los temas evaluados y sus estadísticas.</p>
                </div>
            `;
        }

        if (!this.filters.tema) {
            return this.renderThemesList();
        }

        return this.renderDashboard();
    }

    renderQualityDashboard() {
        if (!this.dashboardStats) return '';

        const stats = this.dashboardStats;
        const user = AuthService.getCurrentUser();
        const isDirac = user && user.rol === 'DIRAC';

        let dashboardTitle = this.filters.curso ? `${this.filters.curso}` : 'Global';
        let subDetails = [];

        if (isDirac) {
            if (this.filters.facultad_id) {
                const fac = this.availableFilters.facultades.find(f => Number(f.id) === Number(this.filters.facultad_id));
                if (fac) subDetails.push(`Facultad: ${fac.nombre}`);
            }
            if (this.filters.escuela_id) {
                const esc = this.availableFilters.escuelas.find(e => Number(e.id) === Number(this.filters.escuela_id));
                if (esc) subDetails.push(`Escuela: ${esc.nombre}`);
            }
            if (this.filters.nrc) {
                subDetails.push(`NRC: ${this.filters.nrc}`);
            }
        }

        const subtitle = subDetails.length > 0 ? subDetails.join(' | ') : 'Vista agregada de rendimiento académico';

        return `
            <div class="quality-dashboard">
                <!-- Header informativo -->
                <div class="dashboard-header">
                    <h3 class="section-title">📊 Dashboard de Calidad - ${dashboardTitle}</h3>
                    <p class="section-subtitle">${subtitle} (${this.filters.atributo || 'AG-07'})</p>
                </div>

                <!-- Grid de métricas -->
                <div class="dashboard-grid">
                    ${this.renderStudentCountCard(stats.total_alumnos)}
                    ${this.renderPerformanceDistribution(stats.criterios)}
                    ${this.renderCriteriaTable(stats.criterios)}
                    ${this.renderAchievementIndicator(stats.porcentaje_logro)}
                </div>

                <!-- Resultados por Profesor -->
                ${this.renderFeedbacksProfesores(stats.feedbacks_profesores)}
            </div>
        `;
    }

    renderFeedbacksProfesores(feedbacks) {
        if (!feedbacks || feedbacks.length === 0) {
            return `
                <div class="main-card" style="margin-top: 2rem; margin-bottom: 2rem;">
                    <div class="card-header">
                        <h4>📝 Resultados por Profesor</h4>
                    </div>
                    <div class="card-body">
                        <p class="text-muted" style="text-align: center; margin: 1rem 0;">No hay resultados de evaluación registrados por los profesores para este curso.</p>
                    </div>
                </div>
            `;
        }

        return `
            <div class="main-card" style="margin-top: 2rem; margin-bottom: 2rem;">
                <div class="card-header">
                    <h4>📝 Resultados</h4>
                </div>
                <div class="card-body" style="padding: 1.5rem;">
                    <div class="feedback-profesores-list" style="display: flex; flex-direction: column; gap: 2rem;">
                        ${feedbacks.map(f => `
                            <div class="profesor-feedback-card" style="background: rgba(255, 255, 255, 0.02); border: 1px solid rgba(255, 255, 255, 0.08); border-radius: 8px; padding: 1.5rem;">
                                <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid rgba(255, 255, 255, 0.08); padding-bottom: 0.75rem; margin-bottom: 1rem;">
                                    <h4 style="margin: 0; color: #a78bfa; font-size: 1.2rem;">👨‍🏫 Profesor: ${f.profesor}</h4>
                                    <span style="background: rgba(167, 139, 250, 0.1); color: #a78bfa; padding: 0.25rem 0.75rem; border-radius: 20px; font-size: 0.85rem; font-weight: 500;">
                                        Tema: ${f.tema}
                                    </span>
                                </div>
                                <div style="display: flex; flex-direction: column; gap: 1rem;">
                                    <div>
                                        <h5 style="margin: 0 0 0.25rem 0; color: var(--text-color); font-weight: 600; font-size: 0.95rem;">Hallazgos:</h5>
                                        <p style="white-space: pre-wrap; margin: 0; background: rgba(0, 0, 0, 0.15); padding: 0.75rem; border-radius: 6px; border: 1px solid rgba(255,255,255,0.04); font-size: 0.9rem; color: var(--text-color);">${f.hallazgos || 'Ninguno registrado'}</p>
                                    </div>
                                    <div>
                                        <h5 style="margin: 0 0 0.25rem 0; color: var(--text-color); font-weight: 600; font-size: 0.95rem;">Fortalezas logradas por los estudiantes:</h5>
                                        <p style="white-space: pre-wrap; margin: 0; background: rgba(0, 0, 0, 0.15); padding: 0.75rem; border-radius: 6px; border: 1px solid rgba(255,255,255,0.04); font-size: 0.9rem; color: var(--text-color);">${f.fortalezas || 'Ninguna registrada'}</p>
                                    </div>
                                    <div>
                                        <h5 style="margin: 0 0 0.25rem 0; color: var(--text-color); font-weight: 600; font-size: 0.95rem;">Oportunidades de mejora:</h5>
                                        <p style="white-space: pre-wrap; margin: 0; background: rgba(0, 0, 0, 0.15); padding: 0.75rem; border-radius: 6px; border: 1px solid rgba(255,255,255,0.04); font-size: 0.9rem; color: var(--text-color);">${f.oportunidades || 'Ninguna registrada'}</p>
                                    </div>
                                </div>
                            </div>
                        `).join('')}
                    </div>
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

            ${this.renderGlobalFeedbackSection(stats)}
        `;
    }

    getBarColor(range) {
        if (range === '0-4' || range === '5-8') return 'bg-red';
        if (range === '9-12') return 'bg-orange';
        return 'bg-green';
    }

    renderGlobalFeedbackSection(stats) {
        const user = AuthService.getCurrentUser();
        if (!user) return '';

        const feedback = stats.feedback_global || { hallazgos: '', fortalezas: '', oportunidades: '' };
        const hasFeedback = !!(feedback.hallazgos?.trim() || feedback.fortalezas?.trim() || feedback.oportunidades?.trim());

        const isProfessor = user.rol === 'PROFESOR';
        const isQualityViewer = ['DOCENTE_CIAC', 'DIRAC', 'DIRECTOR_ESCUELA'].includes(user.rol);

        if (!isProfessor && !isQualityViewer) {
            return '';
        }

        if (isQualityViewer) {
            if (!hasFeedback) {
                return `
                    <div class="main-card" style="margin-top: 2rem; margin-bottom: 2rem;">
                        <div class="card-header">
                            <h4>📝 Resultado de la Evaluación</h4>
                        </div>
                        <div class="card-body">
                            <p class="text-muted" style="text-align: center; margin: 1rem 0;">El profesor aún no ha registrado los resultados globales de esta evaluación.</p>
                        </div>
                    </div>
                `;
            }

            return `
                <div class="main-card" style="margin-top: 2rem; margin-bottom: 2rem;">
                    <div class="card-header">
                        <h4>📝 Resultado de la Evaluación (Vista de Observación)</h4>
                    </div>
                    <div class="card-body">
                        <div class="feedback-item" style="margin-bottom: 1.5rem;">
                            <h5 style="font-weight: 600; margin-bottom: 0.5rem; color: #a78bfa;">Hallazgos</h5>
                            <p style="white-space: pre-wrap; background: rgba(255,255,255,0.03); padding: 1rem; border-radius: 6px; border: 1px solid rgba(255,255,255,0.08); margin: 0; color: var(--text-color);">${feedback.hallazgos || 'Ninguno registrado'}</p>
                        </div>
                        <div class="feedback-item" style="margin-bottom: 1.5rem;">
                            <h5 style="font-weight: 600; margin-bottom: 0.5rem; color: #a78bfa;">Fortalezas logradas por los estudiantes</h5>
                            <p style="white-space: pre-wrap; background: rgba(255,255,255,0.03); padding: 1rem; border-radius: 6px; border: 1px solid rgba(255,255,255,0.08); margin: 0; color: var(--text-color);">${feedback.fortalezas || 'Ninguna registrada'}</p>
                        </div>
                        <div class="feedback-item" style="margin-bottom: 1.5rem;">
                            <h5 style="font-weight: 600; margin-bottom: 0.5rem; color: #a78bfa;">Oportunidades de mejora</h5>
                            <p style="white-space: pre-wrap; background: rgba(255,255,255,0.03); padding: 1rem; border-radius: 6px; border: 1px solid rgba(255,255,255,0.08); margin: 0; color: var(--text-color);">${feedback.oportunidades || 'Ninguna registrada'}</p>
                        </div>
                    </div>
                </div>
            `;
        }

        return `
            <!-- Resultado de la Evaluación -->
            <div class="main-card" style="margin-top: 2rem; margin-bottom: 2rem;">
                <div class="card-header">
                    <h4>📝 Resultado de la Evaluación</h4>
                </div>
                <div class="card-body">
                    <form id="global-feedback-form">
                        <div class="form-group" style="margin-bottom: 1.5rem;">
                            <label for="feedbackHallazgos" style="font-weight: 600; display: block; margin-bottom: 0.5rem;">Hallazgos</label>
                            <textarea id="feedbackHallazgos" class="form-control" rows="3" placeholder="Describe los hallazgos encontrados..." style="width: 100%; border-radius: 6px; padding: 0.75rem; border: 1px solid #d1d5db; box-sizing: border-box;">${feedback.hallazgos || ''}</textarea>
                        </div>
                        <div class="form-group" style="margin-bottom: 1.5rem;">
                            <label for="feedbackFortalezas" style="font-weight: 600; display: block; margin-bottom: 0.5rem;">Fortalezas logradas por los estudiantes</label>
                            <textarea id="feedbackFortalezas" class="form-control" rows="3" placeholder="Describe las fortalezas demostradas..." style="width: 100%; border-radius: 6px; padding: 0.75rem; border: 1px solid #d1d5db; box-sizing: border-box;">${feedback.fortalezas || ''}</textarea>
                        </div>
                        <div class="form-group" style="margin-bottom: 1.5rem;">
                            <label for="feedbackOportunidades" style="font-weight: 600; display: block; margin-bottom: 0.5rem;">Oportunidades de mejora</label>
                            <textarea id="feedbackOportunidades" class="form-control" rows="3" placeholder="Describe las oportunidades de mejora identificadas..." style="width: 100%; border-radius: 6px; padding: 0.75rem; border: 1px solid #d1d5db; box-sizing: border-box;">${feedback.oportunidades || ''}</textarea>
                        </div>
                        <div style="margin-top: 1.5rem;">
                            <button type="submit" class="btn ${hasFeedback ? 'btn-primary' : 'btn-success'}" id="btnSaveGlobalFeedback" data-action="${hasFeedback ? 'update' : 'upload'}" style="border-radius: 6px; font-weight: 600; padding: 0.5rem 1.5rem; display: flex; align-items: center; gap: 8px;">
                                ${hasFeedback ? '🔄 Actualizar' : '📤 Subir'}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        `;
    }

    attachEventListeners() {
        const user = AuthService.getCurrentUser();
        const isDirac = user && user.rol === 'DIRAC';

        if (isDirac) {
            const filterSemestre = document.getElementById('filterSemestre');
            if (filterSemestre) {
                filterSemestre.addEventListener('change', async (e) => {
                    this.filters.semestre = e.target.value || null;
                    this.filters.facultad_id = null;
                    this.filters.escuela_id = null;
                    this.filters.curso = null;
                    this.filters.nrc = null;
                    this.availableFilters.escuelas = [];
                    this.availableFilters.cursos = [];
                    this.availableFilters.nrcs = [];
                    if (this.filters.semestre) {
                        await this.loadCursos();
                    }
                    if (this.filters.semestre) {
                        await this.viewQualityDashboard(this.filters.curso);
                    } else {
                        this.dashboardStats = null;
                        this.updateView();
                    }
                });
            }

            const filterFacultad = document.getElementById('filterFacultad');
            if (filterFacultad) {
                filterFacultad.addEventListener('change', async (e) => {
                    this.filters.facultad_id = e.target.value ? Number(e.target.value) : null;
                    this.filters.escuela_id = null;
                    this.filters.curso = null;
                    this.filters.nrc = null;
                    this.availableFilters.escuelas = [];
                    this.availableFilters.cursos = [];
                    this.availableFilters.nrcs = [];
                    if (this.filters.facultad_id) {
                        await this.loadEscuelas();
                    }
                    await this.loadCursos();
                    await this.viewQualityDashboard(this.filters.curso);
                });
            }

            const filterEscuela = document.getElementById('filterEscuela');
            if (filterEscuela) {
                filterEscuela.addEventListener('change', async (e) => {
                    this.filters.escuela_id = e.target.value ? Number(e.target.value) : null;
                    this.filters.curso = null;
                    this.filters.nrc = null;
                    this.availableFilters.cursos = [];
                    this.availableFilters.nrcs = [];
                    await this.loadCursos();
                    await this.viewQualityDashboard(this.filters.curso);
                });
            }

            const filterAtributo = document.getElementById('filterAtributo');
            if (filterAtributo) {
                filterAtributo.addEventListener('change', async (e) => {
                    this.filters.atributo = e.target.value || null;
                    await this.viewQualityDashboard(this.filters.curso);
                });
            }

            const filterCurso = document.getElementById('filterCurso');
            if (filterCurso) {
                filterCurso.addEventListener('change', async (e) => {
                    this.filters.curso = e.target.value || null;
                    this.filters.nrc = null;
                    this.availableFilters.nrcs = [];
                    if (this.filters.curso) {
                        await this.loadNrcs();
                    }
                    await this.viewQualityDashboard(this.filters.curso);
                });
            }

            const filterNrc = document.getElementById('filterNrc');
            if (filterNrc) {
                filterNrc.addEventListener('change', async (e) => {
                    this.filters.nrc = e.target.value || null;
                    await this.viewQualityDashboard(this.filters.curso);
                });
            }
        } else {
            const filterSemestre = document.getElementById('filterSemestre');
            if (filterSemestre) {
                filterSemestre.addEventListener('change', async (e) => {
                    this.filters.semestre = e.target.value || null;
                    this.filters.curso = null;
                    this.filters.tema = null;
                    this.filters.atributo = null;
                    this.availableFilters.cursos = [];
                    this.availableFilters.temas = [];
                    if (this.filters.semestre) await this.loadCursos();
                    this.updateView();
                });
            }

            const filterAtributo = document.getElementById('filterAtributo');
            if (filterAtributo) {
                filterAtributo.addEventListener('change', async (e) => {
                    this.filters.atributo = e.target.value || null;
                    this.filters.curso = null;
                    this.applyCourseFilters();
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
                    if (user && ['DOCENTE_CIAC', 'DIRECTOR_ESCUELA', 'DIRAC'].includes(user.rol)) {
                        if (this.filters.curso) {
                            await this.viewQualityDashboard(this.filters.curso);
                        } else {
                            this.updateView();
                        }
                    } else {
                        if (this.filters.curso) await this.loadTemas();
                        this.updateView();
                    }
                });
            }
        }

        document.querySelectorAll('[data-action="view-theme"]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const tema = e.target.dataset.tema;
                this.viewThemeDashboard(tema);
            });
        });

        const btnBack = document.getElementById('btnBackToThemes');
        if (btnBack) {
            btnBack.addEventListener('click', () => {
                this.filters.tema = null;
                this.dashboardStats = null;
                this.updateView();
            });
        }

        const btnDownload = document.getElementById('btnDownloadTranscriptions');
        if (btnDownload) {
            btnDownload.addEventListener('click', () => this.downloadTranscriptions());
        }

        const formFeedback = document.getElementById('global-feedback-form');
        if (formFeedback) {
            formFeedback.addEventListener('submit', async (e) => {
                e.preventDefault();

                const stats = this.dashboardStats;
                if (!stats || !stats.estudiantes || stats.estudiantes.length === 0) {
                    showErrorNotification('No hay evaluaciones en este grupo para actualizar.');
                    return;
                }

                const targetEvaluacionId = stats.estudiantes[0].id;

                const payload = {
                    hallazgos: document.getElementById('feedbackHallazgos').value.trim(),
                    fortalezas: document.getElementById('feedbackFortalezas').value.trim(),
                    oportunidades: document.getElementById('feedbackOportunidades').value.trim()
                };

                if (!payload.hallazgos && !payload.fortalezas && !payload.oportunidades) {
                    showErrorNotification('Por favor escribe algo antes de guardar el resultado.');
                    return;
                }

                const btnSave = document.getElementById('btnSaveGlobalFeedback');
                const actionType = btnSave.dataset.action;

                btnSave.disabled = true;
                btnSave.innerHTML = '⏳ Guardando...';

                try {
                    await DocumentService.updateFeedbackProfesor(targetEvaluacionId, payload);

                    const isUpload = actionType === 'upload';
                    showSuccessNotification(isUpload
                        ? '✅ Resultado de evaluación subido correctamente.'
                        : '✅ Resultado de evaluación actualizado correctamente.'
                    );

                    if (this.dashboardStats) {
                        this.dashboardStats.feedback_global = payload;
                    }

                    btnSave.dataset.action = 'update';
                    btnSave.className = 'btn btn-primary';
                    btnSave.innerHTML = '🔄 Actualizar';
                } catch (error) {
                    console.error('Error al guardar feedback global:', error);
                    showErrorNotification('Error al guardar: ' + error.message);
                } finally {
                    btnSave.disabled = false;
                }
            });
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
            this.filters.tema = null;
        } finally {
            this.isLoading = false;
            this.updateView();
        }
    }

    async viewQualityDashboard(curso) {
        this.filters.curso = curso;
        this.isLoading = true;
        this.updateView();

        const user = AuthService.getCurrentUser();
        const isDirac = user && user.rol === 'DIRAC';

        try {
            const payload = {
                semestre: this.filters.semestre,
                curso: curso || null,
                atributo: this.filters.atributo || null
            };

            if (isDirac) {
                if (this.filters.facultad_id) payload.facultad_id = this.filters.facultad_id;
                if (this.filters.escuela_id) payload.escuela_id = this.filters.escuela_id;
                if (this.filters.nrc) payload.nrc = this.filters.nrc;
            }

            const stats = await DocumentService.getQualityDashboardStats(payload);
            this.dashboardStats = stats;
        } catch (error) {
            console.error('Error loading quality dashboard:', error);
            showErrorNotification(error.message || error);
            if (!isDirac) {
                this.filters.curso = null;
            }
        } finally {
            this.isLoading = false;
            this.updateView();
        }
    }

    async downloadTranscriptions() {
        try {
            await DocumentService.downloadTranscriptions(this.filters);
        } catch (error) {
            console.error('Error downloading:', error);
            showErrorNotification('Error al descargar transcripciones');
        }
    }
    startPolling(evaluacionId) {
        let attempts = 0;
        const maxAttempts = 60;

        this.pollingInterval = setInterval(async () => {
            attempts++;
            try {
                const evaluacion = await DocumentService.getEvaluacion(evaluacionId);
                const nota = evaluacion.resultado_analisis ? Number(evaluacion.resultado_analisis.nota_final) : 0;
                console.log(`🔄 Polling intento ${attempts}: Nota ${nota}`);

                if (nota > 0) {

                    clearInterval(this.pollingInterval);
                    this.pollingInterval = null;
                    this.isAnalyzing = false;
                    showSuccessNotification('✅ Evaluación completada');

                    this.loadSpecificEvaluation(evaluacionId);
                } else if (attempts >= maxAttempts) {
                    clearInterval(this.pollingInterval);
                    this.isAnalyzing = false;
                    showErrorNotification('Tiempo de espera agotado. Por favor recarga la página.');
                }
            } catch (error) {
                console.error('Error en polling:', error);
            }
        }, 5000);
    }

    destroy() {
        this.isDestroyed = true;
        if (this.pollingInterval) {
            clearInterval(this.pollingInterval);
            this.pollingInterval = null;
        }
        this.isLoading = false;
        this.isAnalyzing = false;
    }
}
