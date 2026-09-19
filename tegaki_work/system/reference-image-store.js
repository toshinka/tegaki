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

export const DEFAULT_WORKSPACE_ID = 'default';
export const DEFAULT_WORKSPACE_NAME = '未分類／全体共有';

export class ReferenceImageStore {
    /**
     * @param {object} [options]
     * @param {string} [options.dbName]
     * @param {number} [options.version]
     * @param {string} [options.storeName]
     * @param {string} [options.workspaceStoreName]
     * @param {string} [options.snapshotLinkStoreName]
     */
    constructor(options = {}) {
        this.dbName = options.dbName || 'TegakiReferenceImages';
        this.version = options.version || 2;
        this.storeName = options.storeName || 'reference_images';
        this.workspaceStoreName = options.workspaceStoreName || 'workspaces';
        this.snapshotLinkStoreName = options.snapshotLinkStoreName || 'snapshot_workspaces';
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
                            store.createIndex('workspaceId', 'workspaceId', { unique: false });
                        } else {
                            const store = req.transaction?.objectStore(this.storeName);
                            if (store && !store.indexNames.contains('workspaceId')) {
                                store.createIndex('workspaceId', 'workspaceId', { unique: false });
                            }
                        }
                        if (!db.objectStoreNames.contains(this.workspaceStoreName)) {
                            const wsStore = db.createObjectStore(this.workspaceStoreName, { keyPath: 'id' });
                            wsStore.createIndex('createdAt', 'createdAt', { unique: false });
                        }
                        if (!db.objectStoreNames.contains(this.snapshotLinkStoreName)) {
                            db.createObjectStore(this.snapshotLinkStoreName, { keyPath: 'snapshotId' });
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
     * @param {string} [entry.workspaceId]
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
                    workspaceId: String(entry.workspaceId || DEFAULT_WORKSPACE_ID),
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
     * @param {string|null} [workspaceId] 指定時は該当Workspaceに限定。省略/null時は全件取得
     * @returns {Promise<Array<object>>}
     */
    async getAllReferences(workspaceId = null) {
        const initialized = await this.init();
        if (!initialized || !this.db) return [];

        return new Promise((resolve) => {
            try {
                const tx = this.db.transaction([this.storeName], 'readonly');
                const store = tx.objectStore(this.storeName);
                const req = store.getAll();

                req.onsuccess = () => {
                    let records = Array.isArray(req.result) ? req.result : [];
                    if (workspaceId !== null && workspaceId !== undefined) {
                        const targetWs = String(workspaceId);
                        records = records.filter(r => (r.workspaceId || DEFAULT_WORKSPACE_ID) === targetWs);
                    }
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
     * 保存されている全Workspaceのリストを取得
     * @returns {Promise<Array<{id: string, name: string, createdAt: number, isDefault: boolean}>>}
     */
    async getAllWorkspaces() {
        const initialized = await this.init();
        const defaultWs = {
            id: DEFAULT_WORKSPACE_ID,
            name: DEFAULT_WORKSPACE_NAME,
            createdAt: 0,
            isDefault: true
        };
        if (!initialized || !this.db) return [defaultWs];

        return new Promise((resolve) => {
            try {
                const hasWsStore = this.db.objectStoreNames.contains(this.workspaceStoreName);
                if (!hasWsStore) {
                    resolve([defaultWs]);
                    return;
                }
                const tx = this.db.transaction([this.workspaceStoreName, this.storeName], 'readonly');
                const wsStore = tx.objectStore(this.workspaceStoreName);
                const refStore = tx.objectStore(this.storeName);

                const wsReq = wsStore.getAll();
                const refReq = refStore.getAll();

                let wsList = null;
                let refList = null;

                const checkDone = () => {
                    if (wsList === null || refList === null) return;
                    const map = new Map();
                    map.set(DEFAULT_WORKSPACE_ID, defaultWs);

                    for (const ws of wsList) {
                        if (ws?.id) {
                            map.set(ws.id, {
                                id: ws.id,
                                name: ws.name || ws.id,
                                createdAt: ws.createdAt || 0,
                                isDefault: ws.id === DEFAULT_WORKSPACE_ID
                            });
                        }
                    }

                    for (const ref of refList) {
                        const wsId = ref?.workspaceId;
                        if (wsId && wsId !== DEFAULT_WORKSPACE_ID && !map.has(wsId)) {
                            map.set(wsId, {
                                id: wsId,
                                name: `Workspace ${wsId.slice(0, 8)}`,
                                createdAt: ref.updatedAt || 0,
                                isDefault: false
                            });
                        }
                    }

                    const result = Array.from(map.values());
                    result.sort((a, b) => {
                        if (a.id === DEFAULT_WORKSPACE_ID) return -1;
                        if (b.id === DEFAULT_WORKSPACE_ID) return 1;
                        return (a.createdAt || 0) - (b.createdAt || 0);
                    });
                    resolve(result);
                };

                wsReq.onsuccess = () => { wsList = Array.isArray(wsReq.result) ? wsReq.result : []; checkDone(); };
                wsReq.onerror = () => { wsList = []; checkDone(); };
                refReq.onsuccess = () => { refList = Array.isArray(refReq.result) ? refReq.result : []; checkDone(); };
                refReq.onerror = () => { refList = []; checkDone(); };
                tx.onerror = () => resolve([defaultWs]);
            } catch (err) {
                console.warn('[ReferenceImageStore] getAllWorkspaces failed:', err);
                resolve([defaultWs]);
            }
        });
    }

    /**
     * Workspace を保存（新規作成または更新）
     * @param {object} ws
     * @param {string} ws.id
     * @param {string} ws.name
     * @returns {Promise<boolean>}
     */
    async saveWorkspace(ws) {
        if (!ws || !ws.id) return false;
        const initialized = await this.init();
        if (!initialized || !this.db) return false;

        return new Promise((resolve) => {
            try {
                if (!this.db.objectStoreNames.contains(this.workspaceStoreName)) {
                    resolve(false);
                    return;
                }
                const tx = this.db.transaction([this.workspaceStoreName], 'readwrite');
                const store = tx.objectStore(this.workspaceStoreName);
                const record = {
                    id: String(ws.id),
                    name: String(ws.name || ws.id).trim() || String(ws.id),
                    createdAt: ws.createdAt || Date.now(),
                    updatedAt: Date.now()
                };
                const req = store.put(record);
                req.onsuccess = () => resolve(true);
                req.onerror = () => resolve(false);
                tx.onerror = () => resolve(false);
            } catch (err) {
                console.warn('[ReferenceImageStore] saveWorkspace failed:', err);
                resolve(false);
            }
        });
    }

    /**
     * 特定のWorkspaceメタデータを取得
     * @param {string} id
     * @returns {Promise<{id: string, name: string, isDefault?: boolean}|null>}
     */
    async getWorkspace(id) {
        if (!id || id === DEFAULT_WORKSPACE_ID) {
            return { id: DEFAULT_WORKSPACE_ID, name: DEFAULT_WORKSPACE_NAME, isDefault: true };
        }
        const list = await this.getAllWorkspaces();
        return list.find(w => w.id === id) || null;
    }

    /**
     * AlbumスナップショットとWorkspaceのローカル紐付けを保存
     * @param {number|string} snapshotId
     * @param {string} workspaceId
     * @returns {Promise<boolean>}
     */
    async setSnapshotWorkspace(snapshotId, workspaceId) {
        if (!snapshotId) return false;
        const initialized = await this.init();
        if (!initialized || !this.db) return false;

        return new Promise((resolve) => {
            try {
                if (!this.db.objectStoreNames.contains(this.snapshotLinkStoreName)) {
                    resolve(false);
                    return;
                }
                const tx = this.db.transaction([this.snapshotLinkStoreName], 'readwrite');
                const store = tx.objectStore(this.snapshotLinkStoreName);
                const record = {
                    snapshotId: String(snapshotId),
                    workspaceId: String(workspaceId || DEFAULT_WORKSPACE_ID),
                    linkedAt: Date.now()
                };
                const req = store.put(record);
                req.onsuccess = () => resolve(true);
                req.onerror = () => resolve(false);
                tx.onerror = () => resolve(false);
            } catch (err) {
                console.warn('[ReferenceImageStore] setSnapshotWorkspace failed:', err);
                resolve(false);
            }
        });
    }

    /**
     * Albumスナップショットに紐付いたWorkspace IDを取得
     * @param {number|string} snapshotId
     * @returns {Promise<string|null>}
     */
    async getSnapshotWorkspace(snapshotId) {
        if (!snapshotId) return null;
        const initialized = await this.init();
        if (!initialized || !this.db) return null;

        return new Promise((resolve) => {
            try {
                if (!this.db.objectStoreNames.contains(this.snapshotLinkStoreName)) {
                    resolve(null);
                    return;
                }
                const tx = this.db.transaction([this.snapshotLinkStoreName], 'readonly');
                const store = tx.objectStore(this.snapshotLinkStoreName);
                const req = store.get(String(snapshotId));
                req.onsuccess = () => {
                    resolve(req.result?.workspaceId || null);
                };
                req.onerror = () => resolve(null);
                tx.onerror = () => resolve(null);
            } catch (err) {
                console.warn('[ReferenceImageStore] getSnapshotWorkspace failed:', err);
                resolve(null);
            }
        });
    }

    /**
     * AlbumスナップショットのWorkspace紐付けを削除
     * @param {number|string} snapshotId
     * @returns {Promise<boolean>}
     */
    async deleteSnapshotWorkspace(snapshotId) {
        if (!snapshotId) return false;
        const initialized = await this.init();
        if (!initialized || !this.db) return false;

        return new Promise((resolve) => {
            try {
                if (!this.db.objectStoreNames.contains(this.snapshotLinkStoreName)) {
                    resolve(false);
                    return;
                }
                const tx = this.db.transaction([this.snapshotLinkStoreName], 'readwrite');
                const store = tx.objectStore(this.snapshotLinkStoreName);
                const req = store.delete(String(snapshotId));
                req.onsuccess = () => resolve(true);
                req.onerror = () => resolve(false);
                tx.onerror = () => resolve(false);
            } catch (err) {
                console.warn('[ReferenceImageStore] deleteSnapshotWorkspace failed:', err);
                resolve(false);
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

if (typeof window !== 'undefined') {
    window.ReferenceImageStore = ReferenceImageStore;
    window.referenceImageStore = referenceImageStore;
}
