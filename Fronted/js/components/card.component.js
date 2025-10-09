export class CardComponent {
    /**
     * Crear una tarjeta principal con icono
     * @param {Object} options - Opciones de configuración
     * @param {string} options.icon - Emoji o icono
     * @param {string} options.iconClass - Clase CSS para el icono (blue-icon, green-icon, etc)
     * @param {string} options.title - Título de la tarjeta
     * @param {string} options.subtitle - Subtítulo de la tarjeta
     * @param {string} options.content - Contenido HTML de la tarjeta
     * @returns {string} HTML de la tarjeta
     */
    static mainCard(options) {
        const { icon, iconClass, title, subtitle, content } = options;
        
        return `
            <div class="main-card">
                <div class="card-icon ${iconClass}">${icon}</div>
                <h3 class="card-title">${title}</h3>
                <p class="card-subtitle">${subtitle}</p>
                ${content || ''}
            </div>
        `;
    }

    /**
     * Crear una tarjeta de estadística
     * @param {Object} options - Opciones de configuración
     * @param {string} options.icon - Emoji o icono
     * @param {string} options.iconClass - Clase CSS para el icono
     * @param {string} options.label - Etiqueta de la estadística
     * @param {string} options.value - Valor de la estadística
     * @param {string} options.valueClass - Clase CSS para el valor (opcional)
     * @returns {string} HTML de la tarjeta
     */
    static statCard(options) {
        const { icon, iconClass, label, value, valueClass = '' } = options;
        
        return `
            <div class="stat-card">
                <div class="stat-icon ${iconClass}">${icon}</div>
                <div class="stat-content">
                    <h3>${label}</h3>
                    <p class="${valueClass}">${value}</p>
                </div>
            </div>
        `;
    }

    /**
     * Crear una tarjeta de resumen
     * @param {Object} options - Opciones de configuración
     * @param {string} options.icon - Emoji o icono
     * @param {string} options.iconClass - Clase CSS para el icono
     * @param {string} options.title - Título de la tarjeta
     * @param {Array} options.items - Array de items {label, value}
     * @param {string} options.gridColumn - Span de columnas (opcional)
     * @returns {string} HTML de la tarjeta
     */
    static summaryCard(options) {
        const { icon, iconClass, title, items, gridColumn = '' } = options;
        
        const itemsHTML = items.map(item => `
            <div class="summary-item">
                <div class="summary-label">${item.label}</div>
                <div class="summary-value">${item.value}</div>
            </div>
        `).join('');

        return `
            <div class="summary-card" ${gridColumn ? `style="grid-column: ${gridColumn};"` : ''}>
                <div class="summary-header">
                    <div class="summary-header-icon ${iconClass}">${icon}</div>
                    <h4 class="summary-title">${title}</h4>
                </div>
                ${itemsHTML}
            </div>
        `;
    }

    /**
     * Crear una tarjeta de configuración/sección
     * @param {Object} options - Opciones de configuración
     * @param {string} options.icon - Emoji o icono
     * @param {string} options.iconClass - Clase CSS para el icono
     * @param {string} options.title - Título de la sección
     * @param {Array} options.items - Array de items {label, value}
     * @param {string} options.footerButton - HTML del botón de footer (opcional)
     * @returns {string} HTML de la tarjeta
     */
    static configCard(options) {
        const { icon, iconClass, title, items, footerButton = '' } = options;
        
        const itemsHTML = items.map((item, index) => `
            <div class="config-item" ${index === items.length - 1 ? 'style="border-bottom: none;"' : ''}>
                <span class="config-label">${item.label}</span>
                <span class="config-value">${item.value}</span>
            </div>
        `).join('');

        return `
            <div class="config-section">
                <div class="section-header">
                    <div class="section-icon ${iconClass}">${icon}</div>
                    <h3 class="section-title">${title}</h3>
                </div>
                ${itemsHTML}
                ${footerButton}
            </div>
        `;
    }

    /**
     * Crear una tarjeta de archivo
     * @param {Object} options - Opciones de configuración
     * @param {string} options.fileName - Nombre del archivo
     * @param {string} options.fileSize - Tamaño del archivo
     * @param {string} options.iconClass - Clase CSS para el icono (opcional)
     * @returns {string} HTML de la tarjeta
     */
    static fileCard(options) {
        const { fileName, fileSize, iconClass = 'orange-icon' } = options;
        
        return `
            <div class="file-display">
                <div class="file-icon ${iconClass}">📄</div>
                <div class="file-info">
                    <div class="file-name">${fileName}</div>
                    <div class="file-size">${fileSize}</div>
                </div>
            </div>
        `;
    }

    /**
     * Crear una tarjeta de métrica
     * @param {Object} options - Opciones de configuración
     * @param {string} options.icon - Emoji o icono
     * @param {string} options.label - Etiqueta de la métrica
     * @param {string} options.value - Valor de la métrica
     * @param {string} options.valueClass - Clase CSS para el valor (opcional)
     * @param {number} options.progress - Valor de 0-100 para barra de progreso (opcional)
     * @returns {string} HTML de la tarjeta
     */
    static metricCard(options) {
        const { icon, label, value, valueClass = '', progress = null } = options;
        
        const progressBar = progress !== null ? `
            <div class="progress-bar">
                <div class="progress-fill" style="width: ${progress}%;"></div>
            </div>
        ` : '';

        return `
            <div class="metric-box">
                <div class="metric-label">${icon} ${label}</div>
                <div class="metric-value ${valueClass}">${value}</div>
                ${progressBar}
            </div>
        `;
    }

    /**
     * Crear un banner informativo
     * @param {Object} options - Opciones de configuración
     * @param {string} options.title - Título del banner
     * @param {string} options.info - Información adicional
     * @param {string} options.badge - Texto del badge (opcional)
     * @param {string} options.badgeClass - Clase CSS para el badge (opcional)
     * @returns {string} HTML del banner
     */
    static infoBanner(options) {
        const { title, info, badge = '', badgeClass = 'banner-badge' } = options;
        
        const badgeHTML = badge ? `
            <div class="${badgeClass}">${badge}</div>
        ` : '';

        return `
            <div class="course-banner">
                <div class="banner-content">
                    <div class="banner-title">${title}</div>
                    <div class="banner-info">${info}</div>
                </div>
                ${badgeHTML}
            </div>
        `;
    }
}

export default CardComponent;