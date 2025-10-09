import { DOMUtils } from '../utils/dom.utils.js';
import { StorageUtils } from '../utils/storage.utils.js';

export class AnalysisView {
    constructor(router) {
        this.router = router;
        this.analysisData = StorageUtils.load('analysisResults');
    }

    render() {
        if (!this.analysisData) {
            this.renderNoData();
            return;
        }

        const html = `
            <div class="page-title">
                <h2>Dashboard de análisis</h2>
            </div>
            <p class="page-subtitle">Revisa los resultados de evaluación del documento procesado.</p>

            ${this.renderStats()}
            ${this.renderAnalysisDetails()}
        `;

        DOMUtils.render('#main-content', html);
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

    renderStats() {
        const puntajeGlobal = (this.analysisData.nota_final);
        const analisis = this.analysisData.analisis;

        return `
            <div class="stats-grid">
                <div class="stat-card">
                    <div class="stat-icon green-icon">📊</div>
                    <div class="stat-content">
                        <h3>Nota</h3>
                        <p style="color: #10b981;">${puntajeGlobal.toFixed(1)}</p>
                    </div>
                </div>
                <div class="stat-card">
                    <div class="stat-icon blue-icon">📝</div>
                    <div class="stat-content">
                        <h3>Aplicación Conceptos</h3>
                        <p>${(analisis.aplicacion_conceptos * 100).toFixed(1)}%</p>
                    </div>
                </div>
                <div class="stat-card">
                    <div class="stat-icon purple-icon">🔗</div>
                    <div class="stat-content">
                        <h3>Relación Contextual</h3>
                        <p>${(analisis.relacion_contextual * 100).toFixed(1)}%</p>
                    </div>
                </div>
                <div class="stat-card">
                    <div class="stat-icon orange-icon">💡</div>
                    <div class="stat-content">
                        <h3>Coherencia Lógica</h3>
                        <p>${(analisis.coherencia_logica * 100).toFixed(1)}%</p>
                    </div>
                </div>
            </div>
        `;
    }

    renderAnalysisDetails() {
        const analisis = this.analysisData.analisis;
        const puntajeGlobal = (this.analysisData.nota_final);

        return `
            <div style="margin-top: 40px;">
                <h3 style="margin-bottom: 20px; font-size: 20px;">Detalles del Análisis</h3>
                
                <div class="analysis-item">
                    <div style="margin-bottom: 30px;">
                        <div style="text-align: center; margin-bottom: 20px;">
                            <div style="font-size: 48px; color: #10b981; font-weight: 700;">
                                ${puntajeGlobal.toFixed(1)}
                            </div>
                            <div style="font-size: 14px; color: #888;">Nota</div>
                        </div>
                        <div class="progress-bar" style="height: 12px;">
                            <div class="progress-fill" style="width: ${(puntajeGlobal / 20) * 100}%;"></div>
                        </div>
                    </div>

                    <div class="analysis-metrics">
                        ${this.renderMetric('Aplicación de conceptos', analisis.aplicacion_conceptos)}
                        ${this.renderMetric('Relación contextual', analisis.relacion_contextual)}
                        ${this.renderMetric('Coherencia lógica', analisis.coherencia_logica)}
                    </div>
                </div>

                <div style="margin-top: 30px; text-align: center;">
                    <button class="btn btn-primary" id="btn-download-report">
                        📥 Descargar Reporte Completo
                    </button>
                    <button class="btn btn-secondary" id="btn-new-analysis" style="margin-left: 10px;">
                        📤 Nuevo Análisis
                    </button>
                </div>
            </div>
        `;
    }

    renderMetric(label, value) {
        const percentage = (value * 100).toFixed(1);
        return `
            <div class="metric-box">
                <div class="metric-label">${label}</div>
                <div class="metric-value green">${percentage}%</div>
                <div class="progress-bar">
                    <div class="progress-fill" style="width: ${percentage}%;"></div>
                </div>
            </div>
        `;
    }

    attachEvents() {
        document.getElementById('btn-download-report')?.addEventListener('click', () => {
            this.downloadReport();
        });

        document.getElementById('btn-new-analysis')?.addEventListener('click', () => {
            this.router.navigate('upload');
        });
    }

    downloadReport() {
        const reportData = JSON.stringify(this.analysisData, null, 2);
        const blob = new Blob([reportData], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `reporte-analisis-${Date.now()}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }
}