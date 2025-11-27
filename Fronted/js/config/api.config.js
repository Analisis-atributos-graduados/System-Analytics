export const API_CONFIG = {
    BASE_URL: 'https://analitica-backend-511391059179.us-central1.run.app',
    //BASE_URL: 'http://127.0.0.1:8000', // Para desarrollo local

    ENDPOINTS: {
        // Auth
        AUTH_REGISTER: '/auth/register',
        AUTH_ME: '/auth/me',

        // Rúbricas
        RUBRICAS: '/rubricas',
        RUBRICA_DETAIL: (id) => `/rubricas/${id}`,

        // Evaluaciones
        EVALUACIONES: '/evaluaciones',
        EVALUACION_DETAIL: (id) => `/evaluaciones/${id}`,
        ENQUEUE_BATCH: '/evaluaciones/enqueue-exam-batch',
        DASHBOARD_STATS: '/evaluaciones/dashboard-stats', // ✅ NUEVO
        QUALITY_DASHBOARD_STATS: '/evaluaciones/quality-dashboard-stats', // ✅ NUEVO - AG-07
        DOWNLOAD_TRANSCRIPTIONS: '/evaluaciones/download-transcriptions', // ✅ NUEVO

        // Filtros
        FILTROS_SEMESTRES: '/filtros/semestres',
        FILTROS_CURSOS: '/filtros/cursos',
        FILTROS_TEMAS: '/filtros/temas',

        // Uploads (público)
        GENERATE_UPLOAD_URL: '/generate-upload-url',
        UPLOAD_FILE_PROXY: '/upload-file-proxy'
    },

    TIMEOUT: 30000,

    HEADERS: {
        'Accept': 'application/json'
    }
};

/**
 * Helper para construir URLs con query params
 */
export const buildURL = (endpoint, params = {}) => {
    // Si el endpoint ya es una URL completa (empieza con http), no concatenar BASE_URL
    const urlString = endpoint.startsWith('http') ? endpoint : API_CONFIG.BASE_URL + endpoint;
    const url = new URL(urlString);

    Object.keys(params).forEach(key => {
        if (params[key] !== null && params[key] !== undefined) {
            url.searchParams.append(key, params[key]);
        }
    });
    return url.toString();
};

/**
 * Obtiene un endpoint por nombre
 */
export const getEndpoint = (key, ...args) => {
    const endpoint = API_CONFIG.ENDPOINTS[key];

    if (typeof endpoint === 'function') {
        return API_CONFIG.BASE_URL + endpoint(...args);
    }

    return API_CONFIG.BASE_URL + endpoint;
};
