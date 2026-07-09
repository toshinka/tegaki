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
        this.version = 2;
        this.storeName = 'snapshots';
        this.metaStoreName = 'snapshotMetadata';
        this.db = null;
        this._metadataReady = false;
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
                if (!db.objectStoreNames.contains(this.metaStoreName)) {
                    const metaStore = db.createObjectStore(this.metaStoreName, { keyPath: 'id' });
                    metaStore.createIndex('order', 'order', { unique: false });
                    metaStore.createIndex('timestamp', 'timestamp', { unique: false });
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

    async getSnapshot(id) {
        await this.init();
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction(this.storeName, 'readonly');
            const store = tx.objectStore(this.storeName);
            const req = store.get(id);

            req.onsuccess = () => resolve(req.result || null);
            req.onerror = () => reject(new Error('Snapshot acquisition failed'));
        });
    }

    async getSnapshotsByIds(ids = []) {
        await this.init();
        if (!Array.isArray(ids) || ids.length === 0) return [];
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction(this.storeName, 'readonly');
            const store = tx.objectStore(this.storeName);
            const snapshots = [];
            let completed = 0;
            const orderById = new Map(ids.map((id, index) => [id, index]));

            ids.forEach(id => {
                const req = store.get(id);
                req.onsuccess = () => {
                    completed++;
                    if (req.result) snapshots.push(req.result);
                    if (completed === ids.length) {
                        snapshots.sort((a, b) => (orderById.get(a.id) ?? 0) - (orderById.get(b.id) ?? 0));
                        resolve(snapshots);
                    }
                };
                req.onerror = () => reject(new Error('Snapshot acquisition failed'));
            });
        });
    }

    async getSnapshotSummaries() {
        await this.init();
        await this._ensureMetadata();
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction(this.metaStoreName, 'readonly');
            const store = tx.objectStore(this.metaStoreName);
            const index = store.index('order');
            const req = index.getAll();

            req.onsuccess = () => resolve(req.result || []);
            req.onerror = () => reject(new Error('Snapshot metadata acquisition failed'));
        });
    }

    /**
     * スナップショットを1件追加/更新
     */
    async putSnapshot(snapshot) {
        await this.init();
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction([this.storeName, this.metaStoreName], 'readwrite');
            const store = tx.objectStore(this.storeName);
            const metaStore = tx.objectStore(this.metaStoreName);
            const summary = this._createSnapshotSummary(snapshot, snapshot?.order);

            store.put(snapshot);
            metaStore.put(summary);
            tx.oncomplete = () => resolve(summary);
            tx.onerror = () => reject(new Error('Snapshot save failed'));
        });
    }

    async putSnapshots(snapshots = []) {
        await this.init();
        if (!Array.isArray(snapshots) || snapshots.length === 0) return [];
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction([this.storeName, this.metaStoreName], 'readwrite');
            const store = tx.objectStore(this.storeName);
            const metaStore = tx.objectStore(this.metaStoreName);
            const summaries = snapshots.map((snapshot, index) => {
                const normalized = {
                    ...snapshot,
                    order: snapshot.order !== undefined ? snapshot.order : index
                };
                const summary = this._createSnapshotSummary(normalized, normalized.order);
                store.put(normalized);
                metaStore.put(summary);
                return summary;
            });

            tx.oncomplete = () => resolve(summaries);
            tx.onerror = () => reject(new Error('Snapshots save failed'));
        });
    }

    /**
     * 全スナップショットを一括保存（並べ替え反映用）
     */
    async putAllSnapshots(snapshots) {
        await this.init();
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction([this.storeName, this.metaStoreName], 'readwrite');
            const store = tx.objectStore(this.storeName);
            const metaStore = tx.objectStore(this.metaStoreName);

            const clearReq = store.clear();
            clearReq.onerror = () => reject(new Error('Bulk save clear failed'));
            clearReq.onsuccess = () => {
                metaStore.clear();
                if (snapshots.length === 0) {
                    return;
                }

                snapshots.forEach((snap, index) => {
                    // order を確実に更新
                    snap.order = index;
                    const summary = this._createSnapshotSummary(snap, index);
                    const req = store.put(snap);
                    metaStore.put(summary);
                    req.onerror = () => reject(new Error(`Bulk save failed at index ${index}`));
                });
            };

            tx.oncomplete = () => resolve();
            tx.onerror = (e) => reject(e);
        });
    }

    async updateSnapshotOrder(ids = []) {
        await this.init();
        if (!Array.isArray(ids)) return;
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction([this.storeName, this.metaStoreName], 'readwrite');
            const store = tx.objectStore(this.storeName);
            const metaStore = tx.objectStore(this.metaStoreName);

            ids.forEach((id, order) => {
                const snapshotReq = store.get(id);
                snapshotReq.onsuccess = () => {
                    const snapshot = snapshotReq.result;
                    if (!snapshot) return;
                    snapshot.order = order;
                    store.put(snapshot);
                };

                const metaReq = metaStore.get(id);
                metaReq.onsuccess = () => {
                    const summary = metaReq.result;
                    if (!summary) return;
                    summary.order = order;
                    metaStore.put(summary);
                };
            });

            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(new Error('Snapshot order update failed'));
        });
    }

    async estimateUsage(snapshots = null) {
        await this.init();
        const targetSnapshots = snapshots || await this.getSnapshotSummaries();
        let albumBytes = 0;
        let projectBytes = 0;
        let thumbnailBytes = 0;
        let maxSnapshotBytes = 0;
        let maxSnapshotId = null;

        targetSnapshots.forEach(snapshot => {
            const meta = snapshot?.storageMeta || {};
            const thumbnailBytesForSnapshot = Number(meta.thumbnailBytes) || this._estimateStringBytes(snapshot?.thumbnail);
            const projectBytesForSnapshot = Number(meta.projectBytes)
                || (snapshot?.projectData ? this._estimateJsonBytes(snapshot.projectData) : 0);
            const estimatedSnapshotBytes = Number(meta.albumBytes) || (thumbnailBytesForSnapshot + projectBytesForSnapshot);
            thumbnailBytes += thumbnailBytesForSnapshot;
            projectBytes += projectBytesForSnapshot;
            albumBytes += estimatedSnapshotBytes;
            if (estimatedSnapshotBytes > maxSnapshotBytes) {
                maxSnapshotBytes = estimatedSnapshotBytes;
                maxSnapshotId = snapshot?.id ?? null;
            }
        });

        let storageEstimate = null;
        if (globalThis.navigator?.storage?.estimate) {
            try {
                storageEstimate = await globalThis.navigator.storage.estimate();
            } catch {
                storageEstimate = null;
            }
        }

        return {
            count: targetSnapshots.length,
            albumBytes,
            projectBytes,
            thumbnailBytes,
            maxSnapshotBytes,
            maxSnapshotId,
            browserUsageBytes: Number(storageEstimate?.usage) || null,
            browserQuotaBytes: Number(storageEstimate?.quota) || null
        };
    }

    /**
     * 指定したIDのスナップショットを削除
     */
    async deleteSnapshots(ids) {
        await this.init();
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction([this.storeName, this.metaStoreName], 'readwrite');
            const store = tx.objectStore(this.storeName);
            const metaStore = tx.objectStore(this.metaStoreName);

            ids.forEach(id => {
                store.delete(id);
                metaStore.delete(id);
            });

            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(new Error('Snapshot delete failed'));
        });
    }

    async _ensureMetadata() {
        if (this._metadataReady) return;
        const counts = await this._getStoreCounts();
        if (counts.snapshots === counts.metadata) {
            this._metadataReady = true;
            return;
        }
        await this._rebuildMetadata();
        this._metadataReady = true;
    }

    async _getStoreCounts() {
        await this.init();
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction([this.storeName, this.metaStoreName], 'readonly');
            const snapshotReq = tx.objectStore(this.storeName).count();
            const metaReq = tx.objectStore(this.metaStoreName).count();
            let snapshots = 0;
            let metadata = 0;

            snapshotReq.onsuccess = () => { snapshots = Number(snapshotReq.result) || 0; };
            metaReq.onsuccess = () => { metadata = Number(metaReq.result) || 0; };
            tx.oncomplete = () => resolve({ snapshots, metadata });
            tx.onerror = () => reject(new Error('Album metadata count failed'));
        });
    }

    async _rebuildMetadata() {
        await this.init();
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction([this.storeName, this.metaStoreName], 'readwrite');
            const snapshotStore = tx.objectStore(this.storeName);
            const metaStore = tx.objectStore(this.metaStoreName);
            metaStore.clear();

            const req = snapshotStore.openCursor();
            req.onsuccess = (event) => {
                const cursor = event.target.result;
                if (!cursor) return;
                const summary = this._createSnapshotSummary(cursor.value, cursor.value?.order);
                metaStore.put(summary);
                cursor.continue();
            };
            req.onerror = () => reject(new Error('Album metadata rebuild failed'));
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(new Error('Album metadata rebuild failed'));
        });
    }

    _createSnapshotSummary(snapshot, order = 0) {
        const thumbnailBytes = this._estimateStringBytes(snapshot?.thumbnail);
        const projectBytes = this._estimateJsonBytes(snapshot?.projectData);
        const activeCafBytes = this._estimateJsonBytes(snapshot?.activeCafData);
        const albumBytes = thumbnailBytes + projectBytes + activeCafBytes;
        return {
            id: snapshot?.id,
            order: Number.isFinite(order) ? order : (Number(snapshot?.order) || 0),
            timestamp: Number(snapshot?.timestamp) || Date.now(),
            thumbnail: typeof snapshot?.thumbnail === 'string' ? snapshot.thumbnail : '',
            currentFrame: snapshot?.currentFrame ?? null,
            snapshotType: snapshot?.snapshotType || null,
            hasProjectData: !!snapshot?.projectData,
            hasActiveCafData: !!snapshot?.activeCafData,
            projectReference: this._createProjectReferenceSummary(snapshot?.projectReference),
            storageMeta: {
                thumbnailBytes,
                projectBytes,
                activeCafBytes,
                albumBytes
            }
        };
    }

    _createProjectReferenceSummary(reference) {
        if (!reference || typeof reference !== 'object') return null;
        return {
            type: reference.type || null,
            fileName: reference.fileName || null,
            savedAt: reference.savedAt || null,
            hasFileHandle: !!reference.fileHandle
        };
    }

    _estimateStringBytes(value) {
        return typeof value === 'string' ? value.length * 2 : 0;
    }

    _estimateJsonBytes(value) {
        if (!value) return 0;
        try {
            return JSON.stringify(value).length * 2;
        } catch {
            return 0;
        }
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
