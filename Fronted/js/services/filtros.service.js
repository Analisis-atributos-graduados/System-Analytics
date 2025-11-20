import ApiService from './api.service.js';
import { getEndpoint, buildURL } from '../config/api.config.js';

class FiltrosService {
    /**
     * Obtiene la lista de semestres disponibles
     * Filtrado automáticamente por rol en el backend
     */
    async getSemestres() {
        try {
            const endpoint = getEndpoint('FILTROS_SEMESTRES');
            const semestres = await ApiService.get(endpoint);
            console.log('📅 Semestres obtenidos:', semestres);
            return semestres;
        } catch (error) {
            console.error('Error al obtener semestres:', error);
            throw error;
        }
    }

    /**
     * Obtiene los cursos para un semestre específico
     * @param {string} semestre - Ej: "2025-1"
     */
    async getCursos(semestre) {
        try {
            if (!semestre) {
                throw new Error('El parámetro semestre es requerido');
            }

            const endpoint = buildURL(getEndpoint('FILTROS_CURSOS'), { semestre });
            const cursos = await ApiService.get(endpoint);
            console.log(`📚 Cursos obtenidos para ${semestre}:`, cursos);
            return cursos;
        } catch (error) {
            console.error('Error al obtener cursos:', error);
            throw error;
        }
    }

    /**
     * Obtiene los temas para un curso en un semestre específico
     * @param {string} semestre - Ej: "2025-1"
     * @param {string} curso - Código del curso, ej: "CA-301"
     */
    async getTemas(semestre, curso) {
        try {
            if (!semestre || !curso) {
                throw new Error('Los parámetros semestre y curso son requeridos');
            }

            const endpoint = buildURL(getEndpoint('FILTROS_TEMAS'), { 
                semestre, 
                curso 
            });
            const temas = await ApiService.get(endpoint);
            console.log(`📝 Temas obtenidos para ${semestre}/${curso}:`, temas);
            return temas;
        } catch (error) {
            console.error('Error al obtener temas:', error);
            throw error;
        }
    }

    /**
     * Obtiene todos los filtros de una vez (útil para inicialización)
     */
    async getAllFilters() {
        try {
            const semestres = await this.getSemestres();
            return {
                semestres,
                cursos: [],
                temas: []
            };
        } catch (error) {
            console.error('Error al obtener filtros:', error);
            throw error;
        }
    }
}

export default new FiltrosService();
