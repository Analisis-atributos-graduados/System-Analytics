export class ValidatorUtils {
    static PATTERNS = {
        NAME: /^[a-zA-ZáéíóúÁÉÍÓÚñÑ]+(?: [a-zA-ZáéíóúÁÉÍÓÚñÑ]+)*$/,

        EMAIL: /^[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,6}$/,

        PASSWORD: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&_.,-])[A-Za-z\d@$!%*?&_.,-]{8,}$/,

        DESCRIPTION: /^[a-zA-ZáéíóúÁÉÍÓÚñÑüÜ.,;:¿?¡!()\-\s]+$/,

        COURSE_CODE: /^\d{4,5}$/,

        SEMESTER: /^\d{4}-[1-2]$/,

        TEXT_AREA: /^[\w\s.,;:"'()áéíóúÁÉÍÓÚñÑ-]+$/,

        NUMBER: /^\d+(\.\d+)?$/
    };

    /**
     * @param {string} value
     * @param {RegExp} pattern
     * @returns {boolean}
     */
    static validate(value, pattern) {
        if (value === null || value === undefined) return false;
        return pattern.test(String(value).trim());
    }

    static isValidName(name) {
        return this.validate(name, this.PATTERNS.NAME);
    }

    static isValidEmail(email) {
        return this.validate(email, this.PATTERNS.EMAIL);
    }

    static isValidCourseCode(code) {
        return this.validate(code, this.PATTERNS.COURSE_CODE);
    }

    static isValidSemester(semester) {
        return this.validate(semester, this.PATTERNS.SEMESTER);
    }

    static isValidText(text) {
        return this.validate(text, this.PATTERNS.TEXT_AREA);
    }

    static isValidStrongPassword(password) {
        return this.validate(password, this.PATTERNS.PASSWORD);
    }

    static isValidDescription(text) {
        if (!text || text.trim().length === 0) return false;
        return this.validate(text, this.PATTERNS.DESCRIPTION);
    }

    /**
     * @param {boolean} preserveTrailing
     */
    static sanitizeText(text, preserveTrailing = false) {
        if (!text) return '';

        let sanitized = text.replace(/[^a-zA-ZáéíóúÁÉÍÓÚñÑüÜ\s.,;:¿?¡!()\-]/g, '');

        sanitized = sanitized.replace(/\s{2,}/g, ' ');

        return preserveTrailing ? sanitized : sanitized.trim();
    }
}
