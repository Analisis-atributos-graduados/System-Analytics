export class CardComponent {
    /**
     * @param {Object} options
     * @param {string} options.icon
     * @param {string} options.iconClass
     * @param {string} options.title
     * @param {string} options.subtitle
     * @param {string} options.content
     * @returns {string}
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
     * @param {Object} options
     * @param {string} options.icon
     * @param {string} options.iconClass
     * @param {string} options.label
     * @param {string} options.value
     * @param {string} options.valueClass
     * @returns {string}
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
     * 
     * @param {Object} options
     * @param {string} options.icon
     * @param {string} options.iconClass
     * @param {string} options.title
     * @param {Array} options.items
     * @param {string} options.gridColumn
     * @returns {string}
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
     * @param {Object} options
     * @param {string} options.icon
     * @param {string} options.iconClass
     * @param {string} options.title
     * @param {Array} options.items
     * @param {string} options.footerButton
     * @returns {string}
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
     * @param {Object} options
     * @param {string} options.fileName
     * @param {string} options.fileSize
     * @param {string} options.iconClass
     * @returns {string}
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
     * @param {Object} options
     * @param {string} options.icon
     * @param {string} options.label
     * @param {string} options.value
     * @param {string} options.valueClass
     * @param {number} options.progress
     * @returns {string}
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
     * @param {Object} options
     * @param {string} options.title
     * @param {string} options.info
     * @param {string} options.badge
     * @param {string} options.badgeClass
     * @returns {string}
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