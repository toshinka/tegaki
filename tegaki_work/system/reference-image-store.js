/**
 * ============================================================================
 * ファイル名: system/reference-image-store.js
 * 責務: Reference / Preview Viewer の参照画像（Blob＋メタデータ）をIndexedDBで
 *       同一ブラウザ・同一アプリ内のローカル保存領域に永続化する
 * 依存: なし
 * 被依存: ui/reference-preview-viewer.js
 * 公開API: ReferenceImageStore, referenceImageStore
 * ============================================================================
 */

export class ReferenceImageStore {
    /**
     * @param {object} [options]
     * @param {string} [options.dbName]
     * @param {number} [options.version]
     * @param {string} [options.storeName]
     */
    constructor(options = {}) {
        this.dbName = options.dbName || 'TegakiReferenceImages';
        this.version = options.version || 1;
        this.storeName = options.storeName || 'reference_images';
        this.db = null;
        this._isAvailable = true;
        this._initPromise = null;
    }

    /**
     * IndexedDB の初期化
     * @returns {Promise<boolean>}
     */
    async init() {
        if (this.db) return true;
        if (this._initPromise) return this._initPromise;
        this._initPromise = this._doInit();
        return this._initPromise;
    }

    async _doInit() {
        const idb = (typeof indexedDB !== 'undefined') ? indexedDB : globalThis.indexedDB;
        if (!idb) {
            this._isAvailable = false;
            return false;
        }

        try {
            return await new Promise((resolve) => {
                const req = idb.open(this.dbName, this.version);

                req.onupgradeneeded = (e) => {
                    try {
                        const db = e.target?.result || req.result;
                        if (!db.objectStoreNames.contains(this.storeName)) {
                            const store = db.createObjectStore(this.storeName, { keyPath: 'id' });
                            store.createIndex('order', 'order', { unique: false });
                        }
                    } catch (upgradeErr) {
                        console.warn('[ReferenceImageStore] Upgrade error:', upgradeErr);
                    }
                };

                req.onsuccess = (e) => {
                    this.db = e.target?.result || req.result;
                    this._isAvailable = true;
                    resolve(true);
                };

                req.onerror = () => {
                    this._isAvailable = false;
                    resolve(false);
                };

                req.onblocked = () => {
                    this._isAvailable = false;
                    resolve(false);
                };
            });
        } catch (err) {
            this._isAvailable = false;
            return false;
        }
    }

    /**
     * 参照画像を1件保存（または更新）
     * @param {object} entry
     * @param {string} entry.id
     * @param {string} entry.name
     * @param {number} [entry.order]
     * @param {number} [entry.origWidth]
     * @param {number} [entry.origHeight]
     * @param {number} entry.width
     * @param {number} entry.height
     * @param {boolean} [entry.downscaled]
     * @param {Blob|ArrayBuffer} entry.blob
     * @param {string} [entry.mimeType]
     * @returns {Promise<boolean>}
     */
    async saveReference(entry) {
        if (!entry || !entry.id) return false;
        const initialized = await this.init();
        if (!initialized || !this.db) return false;

        return new Promise((resolve) => {
            try {
                const tx = this.db.transaction([this.storeName], 'readwrite');
                const store = tx.objectStore(this.storeName);

                const record = {
                    id: String(entry.id),
                    name: String(entry.name || 'Reference'),
                    order: typeof entry.order === 'number' ? entry.order : Date.now(),
                    origWidth: Math.max(1, Math.round(Number(entry.origWidth) || Number(entry.width) || 1)),
                    origHeight: Math.max(1, Math.round(Number(entry.origHeight) || Number(entry.height) || 1)),
                    width: Math.max(1, Math.round(Number(entry.width) || 1)),
                    height: Math.max(1, Math.round(Number(entry.height) || 1)),
                    downscaled: Boolean(entry.downscaled),
                    blob: entry.blob,
                    mimeType: entry.mimeType || 'image/png',
                    updatedAt: Date.now()
                };

                const req = store.put(record);
                req.onsuccess = () => resolve(true);
                req.onerror = () => resolve(false);
                tx.onerror = () => resolve(false);
                tx.onabort = () => resolve(false);
            } catch (err) {
                console.warn('[ReferenceImageStore] saveReference failed:', err);
                resolve(false);
            }
        });
    }

    /**
     * 参照画像を1件削除
     * @param {string} id
     * @returns {Promise<boolean>}
     */
    async deleteReference(id) {
        if (!id) return false;
        const initialized = await this.init();
        if (!initialized || !this.db) return false;

        return new Promise((resolve) => {
            try {
                const tx = this.db.transaction([this.storeName], 'readwrite');
                const store = tx.objectStore(this.storeName);
                const req = store.delete(String(id));
                req.onsuccess = () => resolve(true);
                req.onerror = () => resolve(false);
                tx.onerror = () => resolve(false);
                tx.onabort = () => resolve(false);
            } catch (err) {
                console.warn('[ReferenceImageStore] deleteReference failed:', err);
                resolve(false);
            }
        });
    }

    /**
     * 全ての参照画像レコードを order 順で取得
     * @returns {Promise<Array<object>>}
     */
    async getAllReferences() {
        const initialized = await this.init();
        if (!initialized || !this.db) return [];

        return new Promise((resolve) => {
            try {
                const tx = this.db.transaction([this.storeName], 'readonly');
                const store = tx.objectStore(this.storeName);
                const req = store.getAll();

                req.onsuccess = () => {
                    const records = Array.isArray(req.result) ? req.result : [];
                    records.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
                    resolve(records);
                };
                req.onerror = () => resolve([]);
                tx.onerror = () => resolve([]);
            } catch (err) {
                console.warn('[ReferenceImageStore] getAllReferences failed:', err);
                resolve([]);
            }
        });
    }

    /**
     * 保存済み参照画像を全消去
     * @returns {Promise<boolean>}
     */
    async clearAll() {
        const initialized = await this.init();
        if (!initialized || !this.db) return false;

        return new Promise((resolve) => {
            try {
                const tx = this.db.transaction([this.storeName], 'readwrite');
                const store = tx.objectStore(this.storeName);
                const req = store.clear();
                req.onsuccess = () => resolve(true);
                req.onerror = () => resolve(false);
                tx.onerror = () => resolve(false);
                tx.onabort = () => resolve(false);
            } catch (err) {
                resolve(false);
            }
        });
    }

    /**
     * IndexedDBが利用可能かつ接続済みか確認
     * @returns {boolean}
     */
    isAvailable() {
        return this._isAvailable && Boolean(this.db);
    }
}

export const referenceImageStore = new ReferenceImageStore();
