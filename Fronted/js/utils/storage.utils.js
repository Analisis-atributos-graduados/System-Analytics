export class StorageUtils {
    /**
     * Guarda datos en localStorage
     */
    static save(key, data) {
        try {
            const serialized = JSON.stringify(data);
            localStorage.setItem(key, serialized);
            console.log(`💾 Guardado en localStorage: ${key}`);
            return true;
        } catch (error) {
            console.error(`❌ Error guardando en localStorage (${key}):`, error);
            return false;
        }
    }

    /**
     * Carga datos desde localStorage
     */
    static load(key) {
        try {
            const serialized = localStorage.getItem(key);
            if (!serialized) {
                console.log(`📂 No hay datos en localStorage para: ${key}`);
                return null;
            }
            const data = JSON.parse(serialized);
            console.log(`📂 Cargado de localStorage: ${key}`);
            return data;
        } catch (error) {
            console.error(`❌ Error cargando de localStorage (${key}):`, error);
            return null;
        }
    }

    /**
     * Elimina datos de localStorage
     */
    static remove(key) {
        try {
            localStorage.removeItem(key);
            console.log(`🗑️ Eliminado de localStorage: ${key}`);
            return true;
        } catch (error) {
            console.error(`❌ Error eliminando de localStorage (${key}):`, error);
            return false;
        }
    }

    /**
     * Limpia todo el localStorage
     */
    static clear() {
        try {
            localStorage.clear();
            console.log('🗑️ localStorage limpiado completamente');
            return true;
        } catch (error) {
            console.error('❌ Error limpiando localStorage:', error);
            return false;
        }
    }
}
