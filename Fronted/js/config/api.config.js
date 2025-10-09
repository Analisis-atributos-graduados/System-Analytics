export const API_CONFIG = {
    BASE_URL: 'http://127.0.0.1:8000',
    ENDPOINTS: {
        ANALIZAR: '/analizar/',
        CRITERIOS: '/criterios/'
    },
    TIMEOUT: 30000,
    HEADERS: {
        'Accept': 'application/json'
    }
};

export const getEndpoint = (key) => {
    return API_CONFIG.BASE_URL + API_CONFIG.ENDPOINTS[key];
};