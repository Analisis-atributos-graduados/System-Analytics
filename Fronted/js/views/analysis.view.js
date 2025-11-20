import DocumentService from '../services/document.service.js';
import FiltrosService from '../services/filtros.service.js';
import AuthService from '../services/auth.service.js';
import { showErrorNotification } from '../utils/api.utils.js';

export class AnalysisView {
    constructor(router) {
        this.router = router;
        this.evaluaciones = [];
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
        
        // Cargar filtros iniciales
        this.loadInitialFilters();
    }

    async loadInitialFilters() {
        try {
            const semestres = await FiltrosService.getSemestres();
            this.availableFilters.semestres = semestres;
            
            // Si solo hay un semestre, seleccionarlo automáticamente
            if (semestres.length === 1) {
                this.filters.semestre = semestres[0];
                await this.loadCursos();
            }
        } catch (error) {
            console.error('Error cargando filtros iniciales:', error);
        }
    }

    async loadCursos() {
        if (!this.filters.semestre) return;
        
        try {
            const cursos = await FiltrosService.getCursos(this.filters.semestre);
            this.availableFilters.cursos = cursos;
            
            // Si solo hay un curso, seleccionarlo
            if (cursos.length === 1) {
                this.filters.curso = cursos[0].codigo;
                await this.loadTemas();
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
        
        return `
            <div class="page-title">
                <h2>📊 Resultados de evaluaciones</h2>
            </div>
            <p class="page-subtitle">
                Consulta y descarga los resultados de las evaluaciones procesadas.
                ${user?.rol === 'AREA_CALIDAD' ? '(Vista completa - Área de Calidad)' : ''}
            </p>

            <!-- Filtros jerárquicos -->
            <div class="filters-card">
                <div class="filters-row">
                    <!-- Semestre -->
                    <div class="filter-group">
                        <label for="filterSemestre">Semestre</label>
                        <select id="filterSemestre" class="form-control">
                            <option value="">Todos los semestres</option>
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
                            <option value="">Todos los cursos</option>
                            ${this.availableFilters.cursos.map(c => `
                                <option value="${c.codigo}" ${this.filters.curso === c.codigo ? 'selected' : ''}>
                                    ${c.codigo} - ${c.nombre}
                                </option>
                            `).join('')}
                        </select>
                    </div>

                    <!-- Tema -->
                    <div class="filter-group">
                        <label for="filterTema">Tema</label>
                        <select id="filterTema" class="form-control" 
                                ${!this.filters.curso ? 'disabled' : ''}>
                            <option value="">Todos los temas</option>
                            ${this.availableFilters.temas.map(t => `
                                <option value="${t}" ${this.filters.tema === t ? 'selected' : ''}>
                                    ${t}
                                </option>
                            `).join('')}
                        </select>
                    </div>

                    <!-- Botón filtrar -->
                    <div class="filter-group">
                        <label>&nbsp;</label>
                        <button class="btn btn-primary" id="btnFilter" 
                                ${!this.filters.tema ? 'disabled' : ''}>
                            🔍 Filtrar
                        </button>
                    </div>
                </div>
            </div>

            <!-- Resultados -->
            <div id="results-container">
                ${this.renderResults()}
            </div>
        `;
    }

    renderResults() {
        if (this.isLoading) {
            return `
                <div class="loading-state">
                    <div class="spinner"></div>
                    <p>Cargando resultados...</p>
                </div>
            `;
        }

        if (this.evaluaciones.length === 0) {
            return `
                <div class="empty-state">
                    <div class="empty-icon">📋</div>
                    <h3>No hay evaluaciones</h3>
                    <p>Selecciona los filtros y haz clic en "Filtrar" para ver los resultados.</p>
                </div>
            `;
        }

        return `
            <div class="main-card">
                <div class="card-header">
                    <h3>Resultados (${this.evaluaciones.length})</h3>
                    <button class="btn btn-secondary btn-sm" id="btnExportAll">
                        📥 Exportar todo
                    </button>
                </div>
                <div class="card-body">
                    <table class="results-table">
                        <thead>
                            <tr>
                                <th>Alumno</th>
                                <th>Curso</th>
                                <th>Tema</th>
                                <th>Nota Final</th>
                                <th>Fecha</th>
                                <th>Acciones</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${this.evaluaciones.map(e => this.renderEvaluacionRow(e)).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
        `;
    }

    renderEvaluacionRow(evaluacion) {
        const nota = evaluacion.resultado_analisis?.nota_final;
        const notaClass = nota >= 0.7 ? 'nota-alta' : nota >= 0.5 ? 'nota-media' : 'nota-baja';

        return `
            <tr>
                <td><strong>${evaluacion.nombre_alumno}</strong></td>
                <td>${evaluacion.codigo_curso}</td>
                <td>${evaluacion.tema}</td>
                <td>
                    ${nota !== null && nota !== undefined ? 
                        `<span class="nota-badge ${notaClass}">${(nota * 20).toFixed(2)}</span>` :
                        '<span class="badge-pending">Procesando...</span>'
                    }
                </td>
                <td>${new Date(evaluacion.fecha_creacion).toLocaleDateString()}</td>
                <td>
                    <button class="btn btn-sm btn-primary" data-id="${evaluacion.id}" data-action="view">
                        👁️ Ver
                    </button>
                </td>
            </tr>
        `;
    }

    attachEventListeners() {
        // Filtro semestre
        const filterSemestre = document.getElementById('filterSemestre');
        if (filterSemestre) {
            filterSemestre.addEventListener('change', async (e) => {
                this.filters.semestre = e.target.value || null;
                this.filters.curso = null;
                this.filters.tema = null;
                this.availableFilters.cursos = [];
                this.availableFilters.temas = [];
                
                if (this.filters.semestre) {
                    await this.loadCursos();
                }
                
                this.render();
                this.attachEventListeners();
            });
        }

        // Filtro curso
        const filterCurso = document.getElementById('filterCurso');
        if (filterCurso) {
            filterCurso.addEventListener('change', async (e) => {
                this.filters.curso = e.target.value || null;
                this.filters.tema = null;
                this.availableFilters.temas = [];
                
                if (this.filters.curso) {
                    await this.loadTemas();
                }
                
                this.render();
                this.attachEventListeners();
            });
        }

        // Filtro tema
        const filterTema = document.getElementById('filterTema');
        if (filterTema) {
            filterTema.addEventListener('change', (e) => {
                this.filters.tema = e.target.value || null;
                this.render();
                this.attachEventListeners();
            });
        }

        // Botón filtrar
        const btnFilter = document.getElementById('btnFilter');
        if (btnFilter) {
            btnFilter.addEventListener('click', () => this.applyFilters());
        }

        // Botones de acción en tabla
        document.querySelectorAll('[data-action="view"]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const id = parseInt(e.target.closest('[data-id]').dataset.id);
                this.viewEvaluacion(id);
            });
        });

        // Exportar todo
        const btnExportAll = document.getElementById('btnExportAll');
        if (btnExportAll) {
            btnExportAll.addEventListener('click', () => this.exportAll());
        }
    }

    async applyFilters() {
        try {
            this.isLoading = true;
            this.render();
            this.attachEventListeners();

            const filters = {};
            if (this.filters.semestre) filters.semestre = this.filters.semestre;
            if (this.filters.curso) filters.curso = this.filters.curso;
            if (this.filters.tema) filters.tema = this.filters.tema;

            this.evaluaciones = await DocumentService.getAllEvaluations(filters);

            this.isLoading = false;
            this.render();
            this.attachEventListeners();

        } catch (error) {
            this.isLoading = false;
            console.error('Error aplicando filtros:', error);
            showErrorNotification(error);
            this.render();
            this.attachEventListeners();
        }
    }

    async viewEvaluacion(id) {
        try {
            const evaluacion = await DocumentService.getEvaluacion(id);
            // Mostrar modal o navegar a vista detalle
            console.log('Evaluación:', evaluacion);
            // TODO: Implementar vista de detalle
        } catch (error) {
            console.error('Error viewing evaluation:', error);
            showErrorNotification(error);
        }
    }

    exportAll() {
        // TODO: Implementar exportación a CSV/Excel
        console.log('Exportar evaluaciones:', this.evaluaciones);
    }
}
