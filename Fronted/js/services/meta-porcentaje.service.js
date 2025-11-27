import ApiService from './api.service.js';

export class MetaPorcentajeService {
    static async get() {
        return await ApiService.get('/meta-porcentaje/');
    }

    static async update(porcentaje) {
        return await ApiService.put('/meta-porcentaje/', { porcentaje });
    }
}
