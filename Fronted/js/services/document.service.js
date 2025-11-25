import ApiService from './api.service.js';
import AuthService from './auth.service.js';
import { getEndpoint, buildURL } from '../config/api.config.js';

class DocumentService {
    /**
     * Solicita una URL firmada para subir un archivo directamente a GCS.
     */
    async getUploadUrl(filename, contentType) {
        try {
            const endpoint = getEndpoint('GENERATE_UPLOAD_URL');
            const response = await ApiService.post(endpoint, {
                filename,
                content_type: contentType
            });
            return response;
        } catch (error) {
            console.error(`Error getting upload URL for ${filename}:`, error);
            throw error;
        }
    }

    /**
     * Sube un archivo usando el proxy del backend
     */
    async uploadFileProxy(file, tipoDocumento) {
        try {
            const formData = new FormData();
            formData.append('file', file);
            if (tipoDocumento) {
                formData.append('tipo_documento', tipoDocumento);
            }

            const endpoint = getEndpoint('UPLOAD_FILE_PROXY');

            const token = await AuthService.getToken();

            const response = await fetch(endpoint, {
                method: 'POST',
                body: formData,
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.detail || `Upload failed: ${response.statusText}`);
            }

            return await response.json();
        } catch (error) {
            console.error('Error uploading file via proxy:', error);
            throw error;
        }
    }

    /**
     * Obtiene todas las evaluaciones (con filtros opcionales)
     */
    async getAllEvaluations(filters = {}) {
        try {
            const endpoint = buildURL(getEndpoint('EVALUACIONES'), filters);
            return await ApiService.get(endpoint);
        } catch (error) {
            console.error('Error getting evaluations:', error);
            throw error;
        }
    }
    /**
     * Obtiene estadísticas del dashboard
     */
    async getDashboardStats(filters) {
        try {
            const endpoint = buildURL(getEndpoint('DASHBOARD_STATS'), filters);
            const stats = await ApiService.get(endpoint);
            return stats;
        } catch (error) {
            console.error('Error getting dashboard stats:', error);
            throw error;
        }
    }

    /**
     * Descarga transcripciones
     */
    async downloadTranscriptions(filters) {
        try {
            const endpoint = buildURL(getEndpoint('DOWNLOAD_TRANSCRIPTIONS'), filters);

            const token = await AuthService.getToken();
            const headers = {
                'Authorization': `Bearer ${token}`
            };

            const response = await fetch(endpoint, { headers });

            if (!response.ok) {
                throw new Error('Error descargando archivo');
            }

            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `transcripciones_${filters.curso}_${filters.tema}.zip`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);

        } catch (error) {
            console.error('Error downloading transcriptions:', error);
            throw error;
        }
    }

    /**
     * Encola un lote de exámenes para procesamiento
     */
    async enqueueExamBatch(evaluationData) {
        try {
            const endpoint = getEndpoint('ENQUEUE_BATCH');

            if (!evaluationData.rubrica_id) {
                throw new Error('rubrica_id es requerido');
            }

            console.log('📤 Enviando batch con rubrica_id:', evaluationData.rubrica_id);

            const response = await ApiService.post(endpoint, evaluationData);
            return response;
        } catch (error) {
            console.error('Error enqueuing exam batch:', error);
            throw error;
        }
    }

    /**
     * Elimina una evaluación
     */
    async deleteEvaluacion(evaluacionId) {
        try {
            const endpoint = getEndpoint('EVALUACION_DETAIL', evaluacionId);
            return await ApiService.delete(endpoint);
        } catch (error) {
            console.error(`Error deleting evaluation ${evaluacionId}:`, error);
            throw error;
        }
    }
}

export default new DocumentService();
