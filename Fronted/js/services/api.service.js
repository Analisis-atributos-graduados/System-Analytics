import { API_CONFIG } from '../config/api.config.js';
import AuthService from './auth.service.js';

class ApiService {
    constructor() {
        this.baseURL = API_CONFIG.BASE_URL;
        this.headers = API_CONFIG.HEADERS;
    }

    async request(endpoint, options = {}) {
        const url = (endpoint.startsWith('http') ? endpoint : this.baseURL + endpoint);

        // Obtener token de Firebase (async)
        const token = await AuthService.getToken();
        const authHeaders = token ? { 'Authorization': `Bearer ${token}` } : {};

        const config = {
            ...options,
            headers: {
                ...this.headers,
                ...options.headers,
                ...authHeaders
            }
        };

        try {
            const response = await fetch(url, config);

            if (response.status === 401 || response.status === 403) {
                // Token inválido o expirado
                console.error('❌ Sesión expirada o sin permisos');
                await AuthService.logout();
                window.location.href = '/login.html';
                throw new Error('Sesión expirada. Por favor, inicie sesión de nuevo.');
            }

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({
                    detail: response.statusText
                }));
                const errorMessage = typeof errorData.detail === 'object'
                    ? JSON.stringify(errorData.detail)
                    : (errorData.detail || `HTTP error! status: ${response.status}`);
                throw new Error(errorMessage);
            }

            if (response.status === 204) {
                return null;
            }

            return await response.json();
        } catch (error) {
            console.error('API Error:', error);
            throw error;
        }
    }

    get(endpoint) {
        return this.request(endpoint, { method: 'GET' });
    }

    post(endpoint, data) {
        return this.request(endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(data)
        });
    }

    put(endpoint, data) {
        return this.request(endpoint, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(data)
        });
    }

    delete(endpoint) {
        return this.request(endpoint, { method: 'DELETE' });
    }
}

export default new ApiService();
