import ApiService from './api.service.js';
import { API_CONFIG } from '../config/api.config.js';

class DocumentService {
    async uploadDocuments(courseId, files) {
        const uploadPromises = Array.from(files).map(file => 
            ApiService.uploadFile(`${API_CONFIG.ENDPOINTS.DOCUMENTS}/${courseId}`, file)
        );
        return await Promise.all(uploadPromises);
    }

    async getDocuments(courseId) {
        return await ApiService.get(`${API_CONFIG.ENDPOINTS.DOCUMENTS}?courseId=${courseId}`);
    }

    async getDocumentById(id) {
        return await ApiService.get(`${API_CONFIG.ENDPOINTS.DOCUMENTS}/${id}`);
    }

    async deleteDocument(id) {
        return await ApiService.delete(`${API_CONFIG.ENDPOINTS.DOCUMENTS}/${id}`);
    }
}

export default new DocumentService();