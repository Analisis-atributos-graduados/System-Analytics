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
}

export default new UserService();
