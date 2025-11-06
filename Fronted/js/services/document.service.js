import ApiService from './api.service.js';
import { API_CONFIG } from '../config/api.config.js';

class DocumentService {

    async getSignedUrl(file) {
        try {
            const response = await ApiService.post(API_CONFIG.ENDPOINTS.GENERATE_UPLOAD_URL, { filename: file.name, content_type: file.type });
            return response;
        } catch (error) {
            console.error('Error getting signed URL:', error);
            throw error;
        }
    }

    async uploadFileToGCS(signedUrl, file, requestTimestamp) {
        try {
            const headers = {
                'Content-Type': file.type,
            };
            if (requestTimestamp) {
                headers['x-goog-date'] = requestTimestamp;
            }

            const response = await fetch(signedUrl, {
                method: 'PUT',
                body: file,
                headers: headers
            });
            if (!response.ok) {
                throw new Error('Failed to upload file to GCS');
            }
        } catch (error) {
            console.error('Error uploading file to GCS:', error);
            throw error;
        }
    }

    async getEvaluacion(evaluacionId) {
        try {
            const response = await ApiService.get(`/evaluaciones/${evaluacionId}`);
            return response;
        } catch (error) {
            console.error(`Error getting evaluation ${evaluacionId}:`, error);
            throw error;
        }
    }

    async enqueueExamBatch(evaluationData) {
        try {
            const response = await ApiService.post(API_CONFIG.ENDPOINTS.ANALIZAR, evaluationData);
            return response;
        } catch (error) {
            console.error('Error enqueuing exam batch:', error);
            throw error;
        }
    }

    async downloadTranscriptionsZip(evaluacionIds) {
        try {
            const response = await fetch(`${API_CONFIG.BASE_URL}/evaluaciones/transcripciones/zip`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(evaluacionIds)
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            return response.blob(); // Return as a Blob
        } catch (error) {
            console.error('Error downloading transcriptions ZIP:', error);
            throw error;
        }
    }
}

export default new DocumentService();

