export const API_CONFIG = {
    BASE_URL: 'http://localhost:8080/api',
    ENDPOINTS: {
        COURSES: '/courses',
        TOPICS: '/topics',
        RUBRICS: '/rubrics',
        DOCUMENTS: '/documents',
        ANALYSIS: '/analysis',
        SETTINGS: '/settings'
    },
    TIMEOUT: 30000,
    HEADERS: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
    }
};

export const getEndpoint = (key) => {
    return API_CONFIG.BASE_URL + API_CONFIG.ENDPOINTS[key];
};