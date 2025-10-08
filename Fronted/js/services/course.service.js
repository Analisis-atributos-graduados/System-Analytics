import ApiService from './api.service.js';
import { API_CONFIG } from '../config/api.config.js';

class CourseService {
    async getCourses() {
        return await ApiService.get(API_CONFIG.ENDPOINTS.COURSES);
    }

    async getCourseById(id) {
        return await ApiService.get(`${API_CONFIG.ENDPOINTS.COURSES}/${id}`);
    }

    async createCourse(courseData) {
        return await ApiService.post(API_CONFIG.ENDPOINTS.COURSES, courseData);
    }

    async updateCourse(id, courseData) {
        return await ApiService.put(`${API_CONFIG.ENDPOINTS.COURSES}/${id}`, courseData);
    }

    async deleteCourse(id) {
        return await ApiService.delete(`${API_CONFIG.ENDPOINTS.COURSES}/${id}`);
    }

    async createTopic(courseId, topicData) {
        return await ApiService.post(`${API_CONFIG.ENDPOINTS.TOPICS}`, {
            courseId,
            ...topicData
        });
    }

    async uploadRubric(courseId, file) {
        return await ApiService.uploadFile(`${API_CONFIG.ENDPOINTS.RUBRICS}/${courseId}`, file);
    }
}

export default new CourseService();