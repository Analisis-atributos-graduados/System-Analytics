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

    async update(rubricaId, rubricaData) {
        try {
            this.validateRubrica(rubricaData);

            const endpoint = getEndpoint('RUBRICA_DETAIL', rubricaId);
            const response = await ApiService.put(endpoint, rubricaData);
            console.log('Rúbrica actualizada:', response.nombre_rubrica);
            return response;
        } catch (error) {
            console.error(`Error al actualizar rúbrica ${rubricaId}:`, error);
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

        let totalPuntos = 0.0;
        rubricaData.criterios.forEach((criterio, index) => {
            if (!criterio.nombre_criterio) {
                throw new Error(`El criterio ${index + 1} necesita un nombre`);
            }
            if (!criterio.niveles || criterio.niveles.length === 0) {
                throw new Error(`El criterio "${criterio.nombre_criterio}" debe tener al menos un nivel`);
            }
            const scores = criterio.niveles.map(n => {
                const p = parseFloat(n.puntaje);
                return isNaN(p) ? 0 : p;
            });
            const maxScore = Math.max(...scores, 0);
            totalPuntos += maxScore;
        });

        if (Math.abs(totalPuntos - 20.0) > 0.01) {
            throw new Error(`La suma de los puntos máximos de los criterios debe ser exactamente 20 (actual: ${totalPuntos.toFixed(2)} pts)`);
        }

        return true;
    }
}

export default new RubricaService();
