/**
 * EmergencyRecoveryStore - IndexedDBベースの緊急復帰チェックポイント管理
 * 
 * 目的:
 * 長時間描画中の突然のクラッシュや誤操作に備え、最新の描画状態を1件だけ退避する。
 * localStorage の制限を避けるため IndexedDB を使用し、パフォーマンスのために保存頻度を強く制限する。
 */
export class EmergencyRecoveryStore {
    constructor() {
        this.dbName = 'TegakiEmergencyRecovery';
        this.version = 1;
        this.storeName = 'snapshots';
        this.db = null;
        this._isSaving = false;
        this._pendingSave = false;
        this._lastSaveTime = 0;
        this._saveInterval = 5000; // 最低保存間隔 (5秒)
        this._debounceDelay = 1000; // 変更後の遅延 (1秒)
        this._debounceTimer = null;
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
                    db.createObjectStore(this.storeName, { keyPath: 'id' });
                }
            };
            
            req.onsuccess = (e) => {
                this.db = e.target.result;
                resolve();
            };
            
            req.onerror = () => {
                console.warn('[EmergencyRecovery] IndexedDB init failed');
                reject(new Error('IndexedDB init failed'));
            };
        });
    }

    /**
     * 自動チェックポイントを予約
     */
    scheduleCheckpoint() {
        if (this._isSaving) {
            this._pendingSave = true;
            return;
        }

        if (this._debounceTimer) clearTimeout(this._debounceTimer);
        
        this._debounceTimer = setTimeout(() => {
            this._trySave();
        }, this._debounceDelay);
    }

    /**
     * 通常の流量制限を無視して可能な限り早く保存を試みる（ページ離脱時など）
     */
    forceCheckpointSoon() {
        if (this._isSaving) return;
        this.performSave().catch(() => {});
    }

    /**
     * 保存を試みる（流量制限付き）
     */
    async _trySave() {
        const now = Date.now();
        
        // 1. 前回の保存から一定時間経過しているか
        if (now - this._lastSaveTime < this._saveInterval) {
            // インターバル中なら後でまた試す
            this._pendingSave = true;
            return;
        }

        // 2. 現在保存中か
        if (this._isSaving) {
            this._pendingSave = true;
            return;
        }

        await this.performSave();
    }

    /**
     * 描画状態のキャプチャと保存を実行
     */
    async performSave() {
        if (!window.projectManager) return;
        
        this._isSaving = true;
        this._pendingSave = false; // 保存開始時にフラグを下ろす
        // console.log('[EmergencyRecovery] Starting background save...');

        try {
            // プロジェクトデータのエクスポート（重い処理）
            const projectData = await window.projectManager.exportProject();
            if (!projectData) throw new Error('Export failed');

            // サムネイルキャプチャ
            const thumbnail = await this._captureThumbnail();
            
            await this.init();
            
            const data = {
                id: 'latest',
                timestamp: Date.now(),
                thumbnail,
                projectData,
                reason: 'auto-checkpoint'
            };

            const tx = this.db.transaction(this.storeName, 'readwrite');
            const store = tx.objectStore(this.storeName);
            
            await new Promise((resolve, reject) => {
                const req = store.put(data);
                req.onsuccess = resolve;
                req.onerror = reject;
            });

            this._lastSaveTime = Date.now();
            // console.log('[EmergencyRecovery] Checkpoint saved successfully.');
        } catch (e) {
            console.warn('[EmergencyRecovery] Background save failed:', e);
        } finally {
            this._isSaving = false;
            
            // 保存中に変更があった場合は、デバウンス時間後に再試行
            if (this._pendingSave) {
                if (this._debounceTimer) clearTimeout(this._debounceTimer);
                this._debounceTimer = setTimeout(() => {
                    this._trySave();
                }, this._debounceDelay);
            }
        }
    }

    /**
     * 最新のチェックポイントを取得
     */
    async getLatestCheckpoint() {
        try {
            await this.init();
            const tx = this.db.transaction(this.storeName, 'readonly');
            const store = tx.objectStore(this.storeName);
            
            return new Promise((resolve, reject) => {
                const req = store.get('latest');
                req.onsuccess = () => resolve(req.result);
                req.onerror = reject;
            });
        } catch (e) {
            console.warn('[EmergencyRecovery] Failed to load checkpoint:', e);
            return null;
        }
    }

    /**
     * サムネイルのキャプチャ（プレビュー用）
     */
    async _captureThumbnail() {
        if (window.exportManager?.generatePreview) {
            try {
                const result = await window.exportManager.generatePreview('png', { 
                    resolution: 0.5, 
                    transparent: false 
                });
                const blob = result?.blob || result;
                if (blob instanceof Blob) {
                    return await this._blobToDataURL(blob);
                }
            } catch (e) {
                console.warn('[EmergencyRecovery] Thumbnail capture failed:', e);
            }
        }
        return null;
    }

    _blobToDataURL(blob) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
        });
    }
}

export const emergencyRecoveryStore = new EmergencyRecoveryStore();

// 下位互換性のためにグローバルに登録
window.emergencyRecoveryStore = emergencyRecoveryStore;
