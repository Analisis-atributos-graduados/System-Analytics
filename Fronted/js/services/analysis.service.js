import ApiService from './api.service.js';
import { API_CONFIG } from '../config/api.config.js';

class AnalysisService {
    async getAnalysisByDocument(documentId) {
        return await ApiService.get(`${API_CONFIG.ENDPOINTS.ANALYSIS}/document/${documentId}`);
    }

    async getAllAnalysis(courseId) {
        return await ApiService.get(`${API_CONFIG.ENDPOINTS.ANALYSIS}?courseId=${courseId}`);
    }

    async getAnalysisStats(courseId) {
        return await ApiService.get(`${API_CONFIG.ENDPOINTS.ANALYSIS}/stats/${courseId}`);
    }

    async downloadReport(analysisId) {
        // Implementar descarga de reporte
        const url = `${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.ANALYSIS}/${analysisId}/report`;
        window.open(url, '_blank');
    }
}

export default new AnalysisService();