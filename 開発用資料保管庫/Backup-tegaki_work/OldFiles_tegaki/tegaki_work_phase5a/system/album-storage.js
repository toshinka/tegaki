/**
 * AlbumStorage - IndexedDBベースの通常アルバムストレージ
 * 
 * 目的:
 * localStorage の容量制限を回避するため、作品のスナップショット（アルバム）を IndexedDB に保存する。
 * 旧 localStorage データの移行も担当する。
 */
export class AlbumStorage {
    constructor() {
        this.dbName = 'TegakiAlbumStorage';
        this.version = 1;
        this.storeName = 'snapshots';
        this.db = null;
    }

    /**
     * IndexedDB の初期化
     */
    async init() {
        if (this.db) return;

        return new Promise((resolve, reject) => {
            const req = indexedDB.open(this.dbName, this.version);

            req.onupgradeneeded = (e) => {
                const db = e.target.result;
                if (!db.objectStoreNames.contains(this.storeName)) {
                    const store = db.createObjectStore(this.storeName, { keyPath: 'id' });
                    store.createIndex('order', 'order', { unique: false });
                    store.createIndex('timestamp', 'timestamp', { unique: false });
                }
            };

            req.onsuccess = (e) => {
                this.db = e.target.result;
                resolve();
            };

            req.onerror = () => {
                console.error('[AlbumStorage] IndexedDB init failed');
                reject(new Error('IndexedDB init failed'));
            };
        });
    }

    /**
     * 全スナップショットを取得（order順）
     */
    async getAllSnapshots() {
        await this.init();
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction(this.storeName, 'readonly');
            const store = tx.objectStore(this.storeName);
            const index = store.index('order');
            const req = index.getAll();

            req.onsuccess = () => resolve(req.result || []);
            req.onerror = () => reject(new Error('Snapshots acquisition failed'));
        });
    }

    /**
     * スナップショットを1件追加/更新
     */
    async putSnapshot(snapshot) {
        await this.init();
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction(this.storeName, 'readwrite');
            const store = tx.objectStore(this.storeName);
            const req = store.put(snapshot);

            req.onsuccess = () => resolve();
            req.onerror = () => reject(new Error('Snapshot save failed'));
        });
    }

    /**
     * 全スナップショットを一括保存（並べ替え反映用）
     */
    async putAllSnapshots(snapshots) {
        await this.init();
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction(this.storeName, 'readwrite');
            const store = tx.objectStore(this.storeName);

            const clearReq = store.clear();
            clearReq.onerror = () => reject(new Error('Bulk save clear failed'));
            clearReq.onsuccess = () => {
                if (snapshots.length === 0) {
                    return;
                }

                snapshots.forEach((snap, index) => {
                    // order を確実に更新
                    snap.order = index;
                    const req = store.put(snap);
                    req.onerror = () => reject(new Error(`Bulk save failed at index ${index}`));
                });
            };

            tx.oncomplete = () => resolve();
            tx.onerror = (e) => reject(e);
        });
    }

    /**
     * 指定したIDのスナップショットを削除
     */
    async deleteSnapshots(ids) {
        await this.init();
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction(this.storeName, 'readwrite');
            const store = tx.objectStore(this.storeName);

            let completed = 0;
            ids.forEach(id => {
                const req = store.delete(id);
                req.onsuccess = () => {
                    completed++;
                    if (completed === ids.length) resolve();
                };
            });

            tx.oncomplete = () => resolve();
        });
    }

    /**
     * localStorage からの移行
     */
    async migrateFromLocalStorage() {
        if (localStorage.getItem('tegaki_album_migrated') === 'true') {
            return false;
        }

        const oldData = localStorage.getItem('tegaki_album');
        if (!oldData) {
            localStorage.setItem('tegaki_album_migrated', 'true');
            return false;
        }

        try {
            const snapshots = JSON.parse(oldData);
            if (!Array.isArray(snapshots)) throw new Error('Invalid format');

            console.log(`[AlbumStorage] Migrating ${snapshots.length} items from localStorage...`);
            
            // order を付与して保存
            const migrated = snapshots.map((s, idx) => ({
                ...s,
                order: s.order !== undefined ? s.order : idx
            }));

            await this.putAllSnapshots(migrated);
            
            localStorage.setItem('tegaki_album_migrated', 'true');
            console.log('[AlbumStorage] Migration completed.');
            return true;
        } catch (e) {
            console.error('[AlbumStorage] Migration failed:', e);
            return false;
        }
    }
}

export const albumStorage = new AlbumStorage();
window.albumStorage = albumStorage;
