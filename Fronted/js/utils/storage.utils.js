export class StorageUtils {
    static save(key, data) {
        try {
            const serialized = JSON.stringify(data);
            sessionStorage.setItem(key, serialized);
        } catch (error) {
            console.error('Error saving to storage:', error);
        }
    }

    static load(key) {
        try {
            const serialized = sessionStorage.getItem(key);
            return serialized ? JSON.parse(serialized) : null;
        } catch (error) {
            console.error('Error loading from storage:', error);
            return null;
        }
    }

    static remove(key) {
        sessionStorage.removeItem(key);
    }

    static clear() {
        sessionStorage.clear();
    }
}