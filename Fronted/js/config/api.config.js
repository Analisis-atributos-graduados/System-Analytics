export const API_CONFIG = {
    BASE_URL: 'https://analitica-backend-511391059179.us-central1.run.app',
    //BASE_URL: 'http://127.0.0.1:8000',

    ENDPOINTS: {

        AUTH_REGISTER: '/auth/register',
        AUTH_ME: '/auth/me',

        RUBRICAS: '/rubricas',
        RUBRICA_DETAIL: (id) => `/rubricas/${id}`,

        EVALUACIONES: '/evaluaciones',
        EVALUACION_DETAIL: (id) => `/evaluaciones/${id}`,
        ENQUEUE_BATCH: '/evaluaciones/enqueue-exam-batch',
        DASHBOARD_STATS: '/evaluaciones/dashboard-stats',
        QUALITY_DASHBOARD_STATS: '/evaluaciones/quality-dashboard-stats',
        DOWNLOAD_TRANSCRIPTIONS: '/evaluaciones/download-transcriptions',

        FILTROS_SEMESTRES: '/filtros/semestres',
        FILTROS_CURSOS: '/filtros/cursos',
        FILTROS_TEMAS: '/filtros/temas',

        GENERATE_UPLOAD_URL: '/generate-upload-url',
        UPLOAD_FILE_PROXY: '/upload-file-proxy'
    },

    TIMEOUT: 30000,

    HEADERS: {
        'Accept': 'application/json'
    }
};

export const buildURL = (endpoint, params = {}) => {
    const urlString = endpoint.startsWith('http') ? endpoint : API_CONFIG.BASE_URL + endpoint;
    const url = new URL(urlString);

    Object.keys(params).forEach(key => {
        if (params[key] !== null && params[key] !== undefined) {
            url.searchParams.append(key, params[key]);
        }
    });
    return url.toString();
};

export const getEndpoint = (key, ...args) => {
    const endpoint = API_CONFIG.ENDPOINTS[key];

    if (typeof endpoint === 'function') {
        return API_CONFIG.BASE_URL + endpoint(...args);
    }

    return API_CONFIG.BASE_URL + endpoint;
};
