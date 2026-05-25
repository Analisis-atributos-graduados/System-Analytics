import ApiService from './api.service.js';
import { getEndpoint, buildURL } from '../config/api.config.js';

class FiltrosService {

    async getSemestres() {
        try {
            const endpoint = getEndpoint('FILTROS_SEMESTRES');
            const semestres = await ApiService.get(endpoint);
            console.log('Semestres obtenidos:', semestres);
            return semestres;
        } catch (error) {
            console.error('Error al obtener semestres:', error);
            throw error;
        }
    }

    async getFacultades() {
        try {
            const endpoint = getEndpoint('FILTROS_FACULTADES');
            const facultades = await ApiService.get(endpoint);
            console.log('Facultades obtenidas:', facultades);
            return facultades;
        } catch (error) {
            console.error('Error al obtener facultades:', error);
            throw error;
        }
    }

    async getEscuelas(facultadId = null) {
        try {
            const params = {};
            if (facultadId) {
                params.facultad_id = facultadId;
            }
            const endpoint = buildURL(getEndpoint('FILTROS_ESCUELAS'), params);
            const escuelas = await ApiService.get(endpoint);
            console.log(`Escuelas obtenidas (facultad: ${facultadId}):`, escuelas);
            return escuelas;
        } catch (error) {
            console.error('Error al obtener escuelas:', error);
            throw error;
        }
    }

    /**
     * @param {string} semestre
     * @param {number|null} escuelaId
     */
    async getCursos(semestre, escuelaId = null) {
        try {
            if (!semestre) {
                throw new Error('El parámetro semestre es requerido');
            }

            const params = { semestre };
            if (escuelaId) {
                params.escuela_id = escuelaId;
            }

            const endpoint = buildURL(getEndpoint('FILTROS_CURSOS'), params);
            const cursos = await ApiService.get(endpoint);
            console.log(`Cursos obtenidos para ${semestre} (escuela: ${escuelaId}):`, cursos);
            return cursos;
        } catch (error) {
            console.error('Error al obtener cursos:', error);
            throw error;
        }
    }

    /**
     * @param {string} semestre
     * @param {string} curso
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
            console.log(`Temas obtenidos para ${semestre}/${curso}:`, temas);
            return temas;
        } catch (error) {
            console.error('Error al obtener temas:', error);
            throw error;
        }
    }

    /**
     * @param {string} semestre
     * @param {string} curso
     */
    async getNrcs(semestre, curso) {
        try {
            if (!semestre || !curso) {
                throw new Error('Los parámetros semestre y curso son requeridos');
            }

            const endpoint = buildURL(getEndpoint('FILTROS_NRCS'), { 
                semestre, 
                curso 
            });
            const nrcs = await ApiService.get(endpoint);
            console.log(`NRCs obtenidos para ${semestre}/${curso}:`, nrcs);
            return nrcs;
        } catch (error) {
            console.error('Error al obtener nrcs:', error);
            throw error;
        }
    }

    async getAllFilters() {
        try {
            const semestres = await this.getSemestres();
            return {
                semestres,
                cursos: [],
                temas: [],
                nrcs: []
            };
        } catch (error) {
            console.error('Error al obtener filtros:', error);
            throw error;
        }
    }
}

export default new FiltrosService();
