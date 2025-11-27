import ApiService from './api.service.js';

export class CursoService {
    static async getAll() {
        return await ApiService.get('/cursos');
    }

    static async getEnabled() {
        return await ApiService.get('/cursos?habilitados_only=true');
    }

    static async create(cursoData) {
        return await ApiService.post('/cursos', cursoData);
    }

    static async update(id, cursoData) {
        return await ApiService.put(`/cursos/${id}`, cursoData);
    }

    static async delete(id) {
        return await ApiService.delete(`/cursos/${id}`);
    }

    static async toggleStatus(id) {
        return await ApiService.request(`/cursos/${id}/toggle`, {
            method: 'PATCH'
        });
    }
}
