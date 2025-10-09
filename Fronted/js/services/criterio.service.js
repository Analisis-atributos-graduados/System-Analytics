import ApiService from './api.service.js';
import { API_CONFIG } from '../config/api.config.js';

class CriterioService {
    /**
     * Obtener criterios de evaluación
     * GET /criterios/
     * Response: [
     *   { "nombre": "aplicacion_conceptos", "peso": 0.33333333333333 },
     *   { "nombre": "relacion_contextual", "peso": 0.33333333333333 },
     *   { "nombre": "coherencia_logica", "peso": 0.33333333333333 }
     * ]
     */
    async getCriterios() {
        try {
            const response = await ApiService.get(API_CONFIG.ENDPOINTS.CRITERIOS);
            return response;
        } catch (error) {
            console.error('Error al obtener criterios:', error);
            throw error;
        }
    }

    /**
     * Actualizar pesos de criterios
     * PUT /criterios/
     * Body: {
     *   "aplicacion_conceptos": 0.8,
     *   "relacion_contextual": 0.1,
     *   "coherencia_logica": 0.1
     * }
     * Response: {
     *   "resultado": [
     *     { "analisis": {...}, "puntaje_global": 0.51 }
     *   ]
     * }
     */
    async updateCriterios(criterios) {
        try {
            const response = await ApiService.put(API_CONFIG.ENDPOINTS.CRITERIOS, criterios);
            return response;
        } catch (error) {
            console.error('Error al actualizar criterios:', error);
            throw error;
        }
    }

    /**
     * Normalizar nombres de criterios para mostrar
     */
    getNombreAmigable(nombre) {
        const nombres = {
            'aplicacion_conceptos': 'Aplicación de conceptos',
            'relacion_contextual': 'Relación contextual',
            'coherencia_logica': 'Coherencia lógica'
        };
        return nombres[nombre] || nombre;
    }

    /**
     * Obtener descripción del criterio
     */
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