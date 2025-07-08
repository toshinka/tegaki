// libs/db-indexed.js

const DB_NAME = 'TegakiToolDB';
const DB_VERSION = 1;
const STORE_NAME = 'layers';

let db = null;

export async function initDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onupgradeneeded = (event) => {
            db = event.target.result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME);
            }
        };

        request.onsuccess = (event) => {
            db = event.target.result;
            resolve();
        };

        request.onerror = (event) => {
            console.error('IndexedDB init error:', event);
            reject(event);
        };
    });
}

export function saveLayerImage(layerId, imageData) {
    if (!db) throw new Error('DB not initialized');

    const tx = db.transaction([STORE_NAME], 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    store.put(imageData, layerId);
}

export function loadLayerImage(layerId) {
    if (!db) throw new Error('DB not initialized');

    return new Promise((resolve, reject) => {
        const tx = db.transaction([STORE_NAME], 'readonly');
        const store = tx.objectStore(STORE_NAME);
        const request = store.get(layerId);

        request.onsuccess = () => {
            resolve(request.result || null);
        };

        request.onerror = (event) => {
            console.error('Error loading layer image:', event);
            reject(event);
        };
    });
}

export function deleteLayerImage(layerId) {
    if (!db) throw new Error('DB not initialized');

    const tx = db.transaction([STORE_NAME], 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    store.delete(layerId);
}
