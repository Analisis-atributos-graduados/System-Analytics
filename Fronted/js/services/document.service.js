import { API_CONFIG } from '../config/api.config.js';

class DocumentService {
    /**
     * Subir documento con información del curso
     * POST /upload/
     */
    async uploadDocument(file, courseData) {
        try {
            const formData = new FormData();
            
            formData.append('file', file);
            formData.append('nombre_curso', courseData.courseName);
            formData.append('codigo_curso', courseData.courseCode);
            formData.append('instructor', courseData.instructor);
            formData.append('semestre', courseData.period);
            formData.append('tema', courseData.topic);
            formData.append('descripcion_tema', courseData.topicDescription || '');

            const response = await fetch(API_CONFIG.BASE_URL + API_CONFIG.ENDPOINTS.ANALIZAR, {
                method: 'POST',
                body: formData
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            return await response.json();
        } catch (error) {
            console.error('Error uploading document:', error);
            throw error;
        }
    }
}

export default new DocumentService();