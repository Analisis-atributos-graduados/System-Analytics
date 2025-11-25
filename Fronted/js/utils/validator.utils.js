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

        // ✅ CONTRASEÑA SEGURA: Mínimo 8 caracteres, al menos:
        // - Una letra minúscula (a-z)
        // - Una letra mayúscula (A-Z)
        // - Un número (0-9)
        // - Un carácter especial (@$!%*?&_.,-) 
        PASSWORD: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&_.,-])[A-Za-z\d@$!%*?&_.,-]{8,}$/,

        // ✅ DESCRIPCIÓN: Solo letras (con acentos), espacios simples y puntuación básica
        // No acepta números, no acepta múltiples espacios consecutivos
        // Ej: "Evalúa la capacidad del estudiante para resolver problemas complejos."
        DESCRIPTION: /^[a-zA-ZáéíóúÁÉÍÓÚñÑ.,;:¿?¡!()\-]+(?: [a-zA-ZáéíóúÁÉÍÓÚñÑ.,;:¿?¡!()\-]+)*$/,

        // Código de curso: Letras mayúsculas (2-4) - Números (3-4)
        // Ej: CA-301, FIS-1002
        COURSE_CODE: /^[A-Z]{2,4}-\d{3,4}$/,

        // Semestre: YYYY-N (1 o 2)
        // Ej: 2025-1, 2024-2
        SEMESTER: /^\d{4}-[1-2]$/,

        // Texto seguro: Letras, números, puntuación básica. Evita scripts.
        // Debe tener al menos 1 caracter (+)
        TEXT_AREA: /^[\w\s.,;:"'()áéíóúÁÉÍÓÚñÑ-]+$/,

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

    /**
     * Valida una contraseña segura
     * Mínimo 8 caracteres, con mayúscula, minúscula, número y carácter especial
     */
    static isValidStrongPassword(password) {
        return this.validate(password, this.PATTERNS.PASSWORD);
    }

    /**
     * Valida una descripción (rúbrica, criterio, nivel)
     * Solo letras, espacios simples y puntuación básica. No números ni múltiples espacios.
     */
    static isValidDescription(text) {
        if (!text || text.trim().length === 0) return false;
        return this.validate(text, this.PATTERNS.DESCRIPTION);
    }

    /**
     * Sanitiza texto eliminando múltiples espacios consecutivos y caracteres no válidos
     * Útil para normalizar descripciones
     * @param {boolean} preserveTrailing - Si es true, no elimina espacios al final (útil para input en tiempo real)
     */
    static sanitizeText(text, preserveTrailing = false) {
        if (!text) return '';

        // Eliminar caracteres no permitidos (números y símbolos excepto puntuación básica)
        let sanitized = text.replace(/[^a-zA-ZáéíóúÁÉÍÓÚñÑ\s.,;:¿?¡!()\-]/g, '');

        // Reemplazar múltiples espacios por uno solo
        sanitized = sanitized.replace(/\s{2,}/g, ' ');

        // Solo hacer trim si no queremos preservar espacios finales
        return preserveTrailing ? sanitized : sanitized.trim();
    }
}
