export const API_CONFIG = {
    BASE_URL: 'https://analitica-backend-511391059179.southamerica-east1.run.app',
    //BASE_URL: 'http://127.0.0.1:8000',
    ENDPOINTS: {
        ANALIZAR: '/enqueue-exam-batch',
        CRITERIOS: '/criterios',
        GENERATE_UPLOAD_URL: '/generate-upload-url'
    },
    TIMEOUT: 30000,
    HEADERS: {
        'Accept': 'application/json'
    }
};

export const getEndpoint = (key) => {
    return API_CONFIG.BASE_URL + API_CONFIG.ENDPOINTS[key];
};