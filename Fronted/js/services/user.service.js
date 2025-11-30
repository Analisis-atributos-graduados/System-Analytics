import ApiService from './api.service.js';

class UserService {
    /**
     * Obtiene todos los usuarios
     */
    async getAll() {
        return await ApiService.get('/users/');
    }

    /**
     * Crea un nuevo usuario (solo Admin)
     */
    async create(userData) {
        return await ApiService.post('/users/', userData);
    }

    /**
     * Actualiza un usuario
     */
    async update(userId, userData) {
        return await ApiService.patch(`/users/${userId}`, userData);
    }

    /**
     * Elimina un usuario
     */
    async delete(userId) {
        return await ApiService.delete(`/users/${userId}`);
    }
}

export default new UserService();
