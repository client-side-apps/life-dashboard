
const DB_NAME = 'life_dashboard_config';
const STORE_NAME = 'file_handles';
const KEY = 'db_handle';

export const FileStorage = {
    async get() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(DB_NAME, 1);

            request.onerror = () => resolve(null);
            request.onupgradeneeded = (e) => {
                e.target.result.createObjectStore(STORE_NAME);
            };

            request.onsuccess = (e) => {
                const db = e.target.result;
                if (!db.objectStoreNames.contains(STORE_NAME)) {
                    resolve(null);
                    return;
                }
                const tx = db.transaction(STORE_NAME, 'readonly');
                const store = tx.objectStore(STORE_NAME);
                const req = store.get(KEY);

                req.onsuccess = () => resolve(req.result);
                req.onerror = () => resolve(null);
            };
        });
    },

    async set(handle) {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(DB_NAME, 1);

            request.onerror = reject;
            request.onupgradeneeded = (e) => {
                e.target.result.createObjectStore(STORE_NAME);
            };

            request.onsuccess = (e) => {
                const db = e.target.result;
                const tx = db.transaction(STORE_NAME, 'readwrite');
                const store = tx.objectStore(STORE_NAME);
                store.put(handle, KEY);
                tx.oncomplete = () => resolve();
                tx.onerror = reject;
            };
        });
    },

    async clear() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(DB_NAME, 1);
            request.onsuccess = (e) => {
                const db = e.target.result;
                if (!db.objectStoreNames.contains(STORE_NAME)) {
                    resolve();
                    return;
                }
                const tx = db.transaction(STORE_NAME, 'readwrite');
                const store = tx.objectStore(STORE_NAME);
                store.delete(KEY);
                tx.oncomplete = () => resolve();
            };
        });
    }
};
