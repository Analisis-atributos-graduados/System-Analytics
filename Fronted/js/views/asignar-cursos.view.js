import { showSuccessNotification, showErrorNotification } from '../utils/api.utils.js';
import AuthService from '../services/auth.service.js';
import { CursoService } from '../services/curso.service.js';
import ApiService from '../services/api.service.js';

export class AsignarCursosView {
    constructor(router) {
        this.router = router;
        this.user = AuthService.getCurrentUser();
        this.isCommittee = this.user?.rol === 'COMITE_ACADEMICO';
        this.isCIAC = this.user?.rol === 'DOCENTE_CIAC';
        
        this.courses = [];
        this.metaPorcentaje = 80;
        this.aprobadoMapping = 'pendiente';
        
        this.attributes = Array.from({ length: 12 }, (_, i) => ({
            codigo: `AG-${String(i + 1).padStart(2, '0')}`,
            nombre: `Atributo de Graduado ${i + 1}`
        }));

        this.attributeMapping = new Map();
        this.draggedElement = null;
    }

    async render() {
        setTimeout(() => this.loadData(), 0);

        return `
            <style>
                .asignar-container {
                    display: flex;
                    flex-direction: column;
                    gap: 24px;
                    font-family: 'Outfit', sans-serif;
                }
                .status-banner {
                    padding: 16px 20px;
                    border-radius: var(--radius-lg);
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    gap: 16px;
                    box-shadow: var(--shadow-sm);
                    animation: fadeIn 0.4s ease;
                }
                .status-banner.pendiente {
                    background: rgba(241, 196, 15, 0.12);
                    border: 1px solid rgba(241, 196, 15, 0.3);
                    color: #d35400;
                }
                .status-banner.aprobado {
                    background: rgba(46, 204, 113, 0.12);
                    border: 1px solid rgba(46, 204, 113, 0.3);
                    color: #27ae60;
                }
                .status-title {
                    font-weight: 700;
                    font-size: 16px;
                    margin: 0 0 4px 0;
                    display: flex;
                    align-items: center;
                    gap: 8px;
                }
                .status-desc {
                    font-size: 14px;
                    margin: 0;
                    opacity: 0.9;
                }
                
                /* Layout */
                .workspace-layout {
                    display: flex;
                    gap: 24px;
                    align-items: flex-start;
                }
                
                .pool-card {
                    flex: 1;
                    min-width: 280px;
                    background: var(--card-bg);
                    border: 1px solid var(--card-border);
                    border-radius: var(--radius-lg);
                    padding: 20px;
                    position: sticky;
                    top: 20px;
                    max-height: 80vh;
                    overflow-y: auto;
                    box-shadow: var(--shadow-sm);
                }
                
                .grid-card {
                    flex: 3;
                    display: grid;
                    grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
                    gap: 20px;
                }
                
                /* Cards and zones */
                .ag-card {
                    background: var(--card-bg);
                    border: 1px solid var(--card-border);
                    border-radius: var(--radius-md);
                    padding: 16px;
                    transition: all 0.25s ease;
                    box-shadow: var(--shadow-xs);
                    display: flex;
                    flex-direction: column;
                    gap: 12px;
                }
                .ag-card.drag-over {
                    border-color: var(--primary-color);
                    background: rgba(52, 152, 219, 0.05);
                    box-shadow: var(--shadow-md);
                }
                .ag-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    border-bottom: 1px solid var(--card-border);
                    padding-bottom: 8px;
                }
                .ag-code {
                    font-weight: 700;
                    color: var(--primary-color);
                    font-size: 15px;
                }
                .ag-title {
                    font-size: 12px;
                    color: var(--secondary-text);
                }
                
                .drop-zone {
                    min-height: 80px;
                    border-radius: var(--radius-sm);
                    padding: 8px;
                    display: flex;
                    flex-direction: column;
                    gap: 8px;
                    transition: background-color 0.2s;
                }
                .drop-zone.active-editing {
                    border: 2px dashed var(--card-border);
                    background: var(--input-bg);
                }
                
                /* Badges */
                .course-badge {
                    background: var(--card-bg);
                    border: 1px solid var(--card-border);
                    border-left: 4px solid var(--primary-color);
                    padding: 8px 12px;
                    border-radius: var(--radius-sm);
                    font-size: 13px;
                    color: var(--text-color);
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    font-weight: 500;
                    box-shadow: var(--shadow-xs);
                }
                .drop-zone .course-badge {
                    border-left-color: var(--primary-color);
                }
                
                .course-badge.draggable {
                    cursor: grab;
                }
                .course-badge.draggable:active {
                    cursor: grabbing;
                }
                .course-badge.dragging {
                    opacity: 0.4;
                    transform: scale(0.98);
                }
                
                .remove-badge-btn {
                    background: none;
                    border: none;
                    color: var(--error-color);
                    font-weight: bold;
                    cursor: pointer;
                    font-size: 14px;
                    padding: 0 4px;
                    opacity: 0.7;
                    transition: opacity 0.2s;
                }
                .remove-badge-btn:hover {
                    opacity: 1;
                }
                
                .empty-msg {
                    color: var(--secondary-text);
                    font-size: 12.5px;
                    font-style: italic;
                    text-align: center;
                    padding: 20px 0;
                }
                
                /* Actions footer */
                .actions-bar {
                    background: var(--card-bg);
                    border: 1px solid var(--card-border);
                    border-radius: var(--radius-lg);
                    padding: 20px;
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    box-shadow: var(--shadow-sm);
                }
                
                @keyframes fadeIn {
                    from { opacity: 0; transform: translateY(-5px); }
                    to { opacity: 1; transform: translateY(0); }
                }
            </style>

            <div class="asignar-container">
                <div class="page-title" style="text-align: center;">
                    <h2 style="margin: 0; font-family: 'Outfit', sans-serif; font-weight: 700; background: linear-gradient(135deg, var(--primary-color), #764ba2); -webkit-background-clip: text; -webkit-text-fill-color: transparent;">Asignación de Cursos a Atributos de Graduado</h2>
                    <p style="color: var(--secondary-text); margin-top: 8px;">Relaciona los cursos con los Atributos de Graduado que evaluarán.</p>
                </div>
                
                <div id="status-banner-container"></div>
                
                <div class="workspace-layout">
                    <!-- Sidebar: Pool of courses -->
                    <div class="pool-card">
                        <div style="border-bottom: 1px solid var(--card-border); padding-bottom: 12px; margin-bottom: 16px; display: flex; justify-content: space-between; align-items: center;">
                            <h3 style="margin: 0; font-size: 16px; font-weight: 600; color: var(--text-color);">Cursos Disponibles</h3>
                            <span id="pool-count" class="badge-count" style="background: var(--primary-color); color: white; padding: 2px 8px; border-radius: 12px; font-size: 11.5px; font-weight: bold;">0</span>
                        </div>
                        <div id="pool-dropzone" class="drop-zone" data-pool="true" style="min-height: 150px;">
                            <!-- List of unassigned courses -->
                            <p class="empty-msg">Cargando cursos...</p>
                        </div>
                    </div>
                    
                    <!-- Grid of Attributes -->
                    <div class="grid-card">
                        ${this.attributes.map(attr => `
                            <div class="ag-card" data-attr-code="${attr.codigo}">
                                <div class="ag-header">
                                    <span class="ag-code">${attr.codigo}</span>
                                    <span class="ag-title">${attr.nombre}</span>
                                </div>
                                <div class="drop-zone attr-zone" data-attr="${attr.codigo}">
                                    <!-- Courses assigned to this attribute -->
                                    <p class="empty-msg">Sin cursos asignados</p>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>
                
                <!-- Actions Bar -->
                <div class="actions-bar">
                    <div style="display: flex; align-items: center; gap: 16px;">
                        <div>
                            <label style="display: block; font-weight: 600; font-size: 14px; margin-bottom: 4px; color: var(--text-color);">Meta de Aprobación</label>
                            <div style="display: flex; align-items: center; gap: 8px;">
                                <input type="number" id="meta-input" class="form-control" style="width: 80px; text-align: center; border-radius: var(--radius-md);" min="0" max="100" value="80">
                                <span style="font-weight: 600; color: var(--text-color);">%</span>
                            </div>
                        </div>
                    </div>
                    <div id="action-buttons-container" style="display: flex; gap: 12px;">
                        <!-- Buttons will render dynamically -->
                    </div>
                </div>
            </div>
        `;
    }

    async loadData() {
        try {
            const [statusRes, courses] = await Promise.all([
                ApiService.get('/cursos/mapping-status'),
                CursoService.getAll()
            ]);

            this.aprobadoMapping = statusRes.aprobado_mapping;
            this.metaPorcentaje = statusRes.meta;
            this.courses = courses;

            const metaInput = document.getElementById('meta-input');
            if (metaInput) {
                metaInput.value = this.metaPorcentaje;
                if (this.aprobadoMapping === 'aprobado' && this.isCIAC) {
                    metaInput.disabled = true;
                }
            }

            this.attributes.forEach(attr => {
                this.attributeMapping.set(attr.codigo, new Set());
            });

            this.courses.forEach(curso => {
                if (curso.atributos && Array.isArray(curso.atributos)) {
                    curso.atributos.forEach(attr => {
                        const code = attr.atributo_codigo || attr;
                        if (this.attributeMapping.has(code)) {
                            this.attributeMapping.get(code).add(curso.id);
                        }
                    });
                }
            });

            this.renderStatusBanner();
            this.renderLayoutContent();
            this.renderActionButtons();
            
            this.setupDragAndDrop();
            
            this.attachEvents();
        } catch (error) {
            console.error('Error al cargar datos de asignación:', error);
            showErrorNotification('Error al cargar la información de asignación');
        }
    }

    isEditingAllowed() {
        if (this.isCommittee) return true;
        if (this.isCIAC && this.aprobadoMapping === 'pendiente') return true;
        return false;
    }

    renderStatusBanner() {
        const container = document.getElementById('status-banner-container');
        if (!container) return;

        if (this.aprobadoMapping === 'pendiente') {
            container.innerHTML = `
                <div class="status-banner pendiente">
                    <div>
                        <h4 class="status-title">⚠️ Propuesta Pendiente de Aprobación</h4>
                        <p class="status-desc">El Comité Académico ha propuesto la asignación actual de cursos. Debe ser revisada y aprobada por el Docente CIAC.</p>
                    </div>
                </div>
            `;
        } else {
            container.innerHTML = `
                <div class="status-banner aprobado">
                    <div>
                        <h4 class="status-title">✅ Asignación Aprobada</h4>
                        <p class="status-desc">La asignación de cursos ha sido aprobada oficialmente y se encuentra en modo de solo lectura.</p>
                    </div>
                </div>
            `;
        }
    }

    renderLayoutContent() {
        const isEditable = this.isEditingAllowed();
        
        this.attributeMapping.forEach((courseIds, attrCode) => {
            const zone = document.querySelector(`.attr-zone[data-attr="${attrCode}"]`);
            if (!zone) return;

            if (courseIds.size === 0) {
                zone.innerHTML = '<p class="empty-msg">Sin cursos asignados</p>';
            } else {
                zone.innerHTML = '';
                courseIds.forEach(courseId => {
                    const course = this.courses.find(c => c.id === courseId);
                    if (course) {
                        zone.insertAdjacentHTML('beforeend', this.renderCourseBadge(course, isEditable, true));
                    }
                });
            }
        });

        const poolZone = document.getElementById('pool-dropzone');
        if (poolZone) {
            const countLabel = document.getElementById('pool-count');
            if (countLabel) {
                countLabel.innerText = this.courses.length;
            }

            if (this.courses.length === 0) {
                poolZone.innerHTML = '<p class="empty-msg" style="text-align: center; width: 100%;">No hay cursos disponibles</p>';
            } else {
                poolZone.innerHTML = '';
                this.courses.forEach(course => {
                    poolZone.insertAdjacentHTML('beforeend', this.renderCourseBadge(course, isEditable, false));
                });
            }
        }
    }

    renderCourseBadge(course, isEditable, isAssigned) {
        const canDrag = isEditable ? 'draggable="true"' : '';
        const editClass = isEditable ? 'draggable' : '';
        
        let removeBtnHTML = '';
        if (isEditable && isAssigned) {
            removeBtnHTML = `<button class="remove-badge-btn" data-course-id="${course.id}" title="Quitar asignación">&times;</button>`;
        }

        return `
            <div class="course-badge ${editClass}" data-id="${course.id}" ${canDrag}>
                <span style="display: flex; align-items: center; gap: 8px;">📖 ${course.nombre}</span>
                ${removeBtnHTML}
            </div>
        `;
    }

    renderActionButtons() {
        const container = document.getElementById('action-buttons-container');
        if (!container) return;

        if (this.isCommittee) {
            container.innerHTML = `
                <button id="save-proposal-btn" class="btn btn-primary" style="padding: 10px 20px; font-weight: 600; border-radius: var(--radius-md);">
                    Guardar Propuesta
                </button>
            `;
        } else if (this.isCIAC) {
            if (this.aprobadoMapping === 'pendiente') {
                container.innerHTML = `
                    <button id="approve-no-changes-btn" class="btn btn-secondary" style="padding: 10px 20px; font-weight: 600; border-radius: var(--radius-md); border: 1px solid var(--card-border);">
                        Aprobar sin cambios
                    </button>
                    <button id="approve-save-btn" class="btn btn-primary" style="padding: 10px 20px; font-weight: 600; border-radius: var(--radius-md);">
                        Aprobar y Guardar Asignación
                    </button>
                `;
            } else {
                container.innerHTML = `
                    <span style="color: var(--secondary-text); font-weight: 600; align-self: center; font-size: 14px;">📝 Solo Lectura</span>
                `;
            }
        }
    }

    setupDragAndDrop() {
        if (!this.isEditingAllowed()) {
            document.querySelectorAll('.drop-zone').forEach(zone => {
                zone.classList.remove('active-editing');
            });
            return;
        }

        document.querySelectorAll('.drop-zone').forEach(zone => {
            zone.classList.add('active-editing');
        });

        const badges = document.querySelectorAll('.course-badge.draggable');
        badges.forEach(badge => {
            badge.addEventListener('dragstart', (e) => {
                this.draggedElement = badge;
                badge.classList.add('dragging');
                e.dataTransfer.setData('text/plain', badge.dataset.id);
            });

            badge.addEventListener('dragend', () => {
                if (this.draggedElement) {
                    this.draggedElement.classList.remove('dragging');
                }
                this.draggedElement = null;
                
                document.querySelectorAll('.ag-card').forEach(card => card.classList.remove('drag-over'));
            });
        });

        const dropZones = document.querySelectorAll('.drop-zone');
        dropZones.forEach(zone => {
            const card = zone.closest('.ag-card');

            zone.addEventListener('dragover', (e) => {
                e.preventDefault();
                if (card) {
                    card.classList.add('drag-over');
                }
            });

            zone.addEventListener('dragleave', () => {
                if (card) {
                    card.classList.remove('drag-over');
                }
            });

            zone.addEventListener('drop', (e) => {
                e.preventDefault();
                if (card) {
                    card.classList.remove('drag-over');
                }

                const courseId = parseInt(e.dataTransfer.getData('text/plain'));
                if (isNaN(courseId)) return;

                const isPool = zone.dataset.pool === 'true';
                const targetAttr = zone.dataset.attr;

                this.moveCourse(courseId, isPool ? null : targetAttr);
            });
        });
    }

    moveCourse(courseId, targetAttrCode) {
        if (targetAttrCode) {
            this.attributeMapping.get(targetAttrCode).add(courseId);
        } else {
            this.attributeMapping.forEach((courseIds) => {
                courseIds.delete(courseId);
            });
        }

        this.renderLayoutContent();
        this.setupDragAndDrop();
        this.attachRemoveEvents();
    }

    attachRemoveEvents() {
        const removeButtons = document.querySelectorAll('.remove-badge-btn');
        removeButtons.forEach(btn => {
            btn.addEventListener('click', (e) => {
                const courseId = parseInt(e.currentTarget.dataset.courseId);
                this.moveCourse(courseId, null);
            });
        });
    }

    _getAssignmentsPayload() {
        const asignaciones = [];
        this.attributeMapping.forEach((courseIds, attrCode) => {
            asignaciones.push({
                atributo: attrCode,
                cursos: Array.from(courseIds)
            });
        });
        return asignaciones;
    }

    async saveAssignment(isApproveDirectly = false) {
        const metaInput = document.getElementById('meta-input');
        const metaVal = parseInt(metaInput.value) || 80;

        if (metaVal < 0 || metaVal > 100) {
            showErrorNotification('La meta de aprobación debe estar entre 0 y 100%');
            return;
        }

        const payload = {
            meta: metaVal,
            asignaciones: this._getAssignmentsPayload()
        };

        try {
            const res = await ApiService.post('/cursos/assign-attributes', payload);
            showSuccessNotification(res.message || 'Asignación guardada correctamente');
            
            await this.loadData();
        } catch (error) {
            console.error('Error al guardar asignaciones:', error);
            showErrorNotification('Ocurrió un error al guardar la asignación');
        }
    }

    async approveWithoutChanges() {
        if (!confirm('¿Estás seguro de aprobar la propuesta actual sin realizar cambios?')) {
            return;
        }

        try {
            const res = await ApiService.post('/cursos/approve-mapping', {});
            showSuccessNotification(res.message || 'Propuesta aprobada con éxito');
            await this.loadData();
        } catch (error) {
            console.error('Error al aprobar propuesta:', error);
            showErrorNotification('Ocurrió un error al aprobar la propuesta');
        }
    }

    attachEvents() {
        this.attachRemoveEvents();

        const metaInput = document.getElementById('meta-input');
        if (metaInput) {
            metaInput.addEventListener('input', (e) => {
                let value = e.target.value.replace(/[^0-9]/g, '');
                if (value === '') { e.target.value = ''; return; }
                let numValue = parseInt(value, 10);
                if (numValue > 100) numValue = 100;
                e.target.value = numValue;
            });
        }

        const saveProposalBtn = document.getElementById('save-proposal-btn');
        if (saveProposalBtn) {
            saveProposalBtn.addEventListener('click', () => this.saveAssignment(false));
        }

        const approveSaveBtn = document.getElementById('approve-save-btn');
        if (approveSaveBtn) {
            approveSaveBtn.addEventListener('click', () => this.saveAssignment(true));
        }

        const approveNoChangesBtn = document.getElementById('approve-no-changes-btn');
        if (approveNoChangesBtn) {
            approveNoChangesBtn.addEventListener('click', () => this.approveWithoutChanges());
        }
    }

    attachEventListeners() {
        this.attachEvents();
    }
}
