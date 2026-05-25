import ApiService from './api.service.js';

class UserService {

    async getAll() {
        return await ApiService.get('/users/');
    }

    async create(userData) {
        return await ApiService.post('/users/', userData);
    }

    async update(userId, userData) {
        return await ApiService.patch(`/users/${userId}`, userData);
    }

    async delete(userId) {
        return await ApiService.delete(`/users/${userId}`);
    }

    async getProfesores() {
        return await ApiService.get('/users/profesores');
    }

    async updateUserRoles(email, nombre, roles) {
        return await ApiService.post('/users/update-roles', { email, nombre, roles });
    }
}

export default new UserService();
