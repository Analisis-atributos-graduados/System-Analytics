/**
 * Utilidad para validación de entradas usando Expresiones Regulares (Regex)
 */
export class ValidatorUtils {
    static PATTERNS = {
        // Solo letras y espacios simples. No números, no símbolos.
        // Ej: "Juan Perez", "María de los Ángeles"
        NAME: /^[a-zA-ZáéíóúÁÉÍÓÚñÑ]+(?: [a-zA-ZáéíóúÁÉÍÓÚñÑ]+)*$/,

        // Email estándar
        EMAIL: /^[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,6}$/,

        // Contraseña: Mínimo 6 caracteres
        PASSWORD: /^.{6,}$/,

        // Código de curso: Letras mayúsculas (2-4) - Números (3-4)
        // Ej: CA-301, FIS-1002
        COURSE_CODE: /^[A-Z]{2,4}-\d{3,4}$/,

        // Semestre: YYYY-N (1 o 2)
        // Ej: 2025-1, 2024-2
        SEMESTER: /^\d{4}-[1-2]$/,

        // Texto seguro: Letras, números, puntuación básica. Evita scripts.
        TEXT_AREA: /^[\w\s.,;:"'()áéíóúÁÉÍÓÚñÑ-]*$/,

        // Números positivos (enteros o decimales)
        NUMBER: /^\d+(\.\d+)?$/
    };

    /**
     * Valida un valor contra un patrón específico
     * @param {string} value Valor a validar
     * @param {RegExp} pattern Patrón regex
     * @returns {boolean} true si es válido
     */
    static validate(value, pattern) {
        if (value === null || value === undefined) return false;
        return pattern.test(String(value).trim());
    }

    /**
     * Valida un nombre de persona
     */
    static isValidName(name) {
        return this.validate(name, this.PATTERNS.NAME);
    }

    /**
     * Valida un email
     */
    static isValidEmail(email) {
        return this.validate(email, this.PATTERNS.EMAIL);
    }

    /**
     * Valida un código de curso
     */
    static isValidCourseCode(code) {
        return this.validate(code, this.PATTERNS.COURSE_CODE);
    }

    /**
     * Valida un semestre
     */
    static isValidSemester(semester) {
        return this.validate(semester, this.PATTERNS.SEMESTER);
    }

    /**
     * Valida texto general (descripciones, temas)
     */
    static isValidText(text) {
        return this.validate(text, this.PATTERNS.TEXT_AREA);
    }
}
