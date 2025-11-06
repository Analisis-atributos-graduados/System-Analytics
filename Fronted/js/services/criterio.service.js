import ApiService from './api.service.js';
import { API_CONFIG } from '../config/api.config.js';

class CriterioService {
    async getCriterios() {
        try {
            const response = await ApiService.get(API_CONFIG.ENDPOINTS.CRITERIOS);
            // Transform the dictionary to a list of objects
            return Object.keys(response).map(key => ({
                nombre: key,
                peso: response[key]
            }));
        } catch (error) {
            console.error('Error al obtener criterios:', error);
            throw error;
        }
    }

    async updateCriterios(criterios) {
        try {
            const response = await ApiService.post(API_CONFIG.ENDPOINTS.CRITERIOS, criterios);
            return response;
        } catch (error) {
            console.error('Error al actualizar criterios:', error);
            throw error;
        }
    }

    getNombreAmigable(nombre) {
        const nombres = {
            'aplicacion_conceptos': 'Aplicación de conceptos',
            'relacion_contextual': 'Relación contextual',
            'coherencia_logica': 'Coherencia lógica'
        };
        return nombres[nombre] || nombre;
    }

    getDescripcion(nombre) {
        const descripciones = {
            'aplicacion_conceptos': 'Uso adecuado y aplicación de conceptos teóricos',
            'relacion_contextual': 'Conexión con el contexto y situación planteada',
            'coherencia_logica': 'Consistencia y estructura lógica del argumento'
        };
        return descripciones[nombre] || '';
    }
}

export default new CriterioService();