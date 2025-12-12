import ApiService from './api.service.js';
import { getEndpoint } from '../config/api.config.js';

class RubricaService {
 
    async getAll() {
        try {
            const endpoint = getEndpoint('RUBRICAS');
            const rubricas = await ApiService.get(endpoint);
            console.log('Rúbricas obtenidas:', rubricas.length);
            return rubricas;
        } catch (error) {
            console.error('Error al obtener rúbricas:', error);
            throw error;
        }
    }

    async getById(rubricaId) {
        try {
            const endpoint = getEndpoint('RUBRICA_DETAIL', rubricaId);
            const rubrica = await ApiService.get(endpoint);
            console.log('Rúbrica obtenida:', rubrica.nombre_rubrica);
            return rubrica;
        } catch (error) {
            console.error(`Error al obtener rúbrica ${rubricaId}:`, error);
            throw error;
        }
    }

    async create(rubricaData) {
        try {
            this.validateRubrica(rubricaData);

            const endpoint = getEndpoint('RUBRICAS');
            const response = await ApiService.post(endpoint, rubricaData);
            console.log('Rúbrica creada:', response.nombre_rubrica);
            return response;
        } catch (error) {
            console.error('Error al crear rúbrica:', error);
            throw error;
        }
    }

    async delete(rubricaId) {
        try {
            const endpoint = getEndpoint('RUBRICA_DETAIL', rubricaId);
            const response = await ApiService.delete(endpoint);
            console.log('Rúbrica desactivada:', rubricaId);
            return response;
        } catch (error) {
            console.error(`Error al eliminar rúbrica ${rubricaId}:`, error);
            throw error;
        }
    }

    validateRubrica(rubricaData) {
        if (!rubricaData.nombre_rubrica) {
            throw new Error('El nombre de la rúbrica es requerido');
        }

        if (!rubricaData.criterios || rubricaData.criterios.length === 0) {
            throw new Error('Debe haber al menos un criterio');
        }

        const sumaPesos = rubricaData.criterios.reduce((sum, c) => sum + c.peso, 0);
        if (Math.abs(sumaPesos - 1.0) > 0.01) {
            throw new Error(`La suma de los pesos debe ser 1.0 (actual: ${sumaPesos.toFixed(2)})`);
        }

        rubricaData.criterios.forEach((criterio, index) => {
            if (!criterio.nombre_criterio) {
                throw new Error(`El criterio ${index + 1} necesita un nombre`);
            }
            if (criterio.peso < 0 || criterio.peso > 1) {
                throw new Error(`El peso del criterio "${criterio.nombre_criterio}" debe estar entre 0 y 1`);
            }
        });

        return true;
    }

    convertPuntosAPesos(rubricaAntigua) {
        const totalPuntos = rubricaAntigua.total_puntos || 20;
        
        return {
            nombre_rubrica: rubricaAntigua.nombre_rubrica,
            descripcion: rubricaAntigua.descripcion || '',
            criterios: rubricaAntigua.criterios.map((criterio, index) => ({
                nombre_criterio: criterio.nombre,
                descripcion_criterio: criterio.descripcion || '',
                peso: criterio.puntaje / totalPuntos,
                orden: index + 1
            }))
        };
    }
}

export default new RubricaService();
