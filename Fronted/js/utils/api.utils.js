/**
 * Utilidades para manejo de API
 */

/**
 * Maneja errores de API de forma consistente
 */
export const handleApiError = (error, context = '') => {
    console.error(`API Error ${context}:`, error);

    // Errores de red
    if (error.message.includes('Failed to fetch')) {
        return {
            title: 'Error de Conexión',
            message: 'No se pudo conectar con el servidor. Verifica tu conexión a internet.',
            type: 'network'
        };
    }

    // Errores de autenticación
    if (error.message.includes('Sesión')) {
        return {
            title: 'Sesión Expirada',
            message: 'Tu sesión ha expirado. Por favor inicia sesión nuevamente.',
            type: 'auth'
        };
    }

    // Errores de validación
    if (error.message.includes('requerido') || error.message.includes('debe')) {
        return {
            title: 'Datos Inválidos',
            message: error.message,
            type: 'validation'
        };
    }

    // Error genérico
    return {
        title: 'Error',
        message: error.message || 'Ocurrió un error inesperado',
        type: 'generic'
    };
};

/**
 * Muestra una notificación de error en la UI
 */
export const showErrorNotification = (error, duration = 5000) => {
    const errorInfo = handleApiError(error);
    
    const notification = document.createElement('div');
    notification.className = 'notification error';
    notification.innerHTML = `
        <div class="notification-header">
            <strong>${errorInfo.title}</strong>
            <button class="close-btn">&times;</button>
        </div>
        <div class="notification-body">${errorInfo.message}</div>
    `;

    document.body.appendChild(notification);

    // Auto-cerrar
    const timeout = setTimeout(() => {
        notification.remove();
    }, duration);

    // Cerrar manualmente
    notification.querySelector('.close-btn').addEventListener('click', () => {
        clearTimeout(timeout);
        notification.remove();
    });

    return notification;
};

/**
 * Muestra una notificación de éxito
 */
export const showSuccessNotification = (message, duration = 3000) => {
    const notification = document.createElement('div');
    notification.className = 'notification success';
    notification.innerHTML = `
        <div class="notification-header">
            <strong>✅ Éxito</strong>
            <button class="close-btn">&times;</button>
        </div>
        <div class="notification-body">${message}</div>
    `;

    document.body.appendChild(notification);

    const timeout = setTimeout(() => {
        notification.remove();
    }, duration);

    notification.querySelector('.close-btn').addEventListener('click', () => {
        clearTimeout(timeout);
        notification.remove();
    });

    return notification;
};
