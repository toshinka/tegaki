/**
 * EmergencyRecoveryStore - IndexedDBベースの緊急復帰チェックポイント管理
 * 
 * 目的:
 * 長時間描画中の突然のクラッシュや誤操作に備え、最新の描画状態を1件だけ退避する。
 * localStorage の制限を避けるため IndexedDB を使用し、パフォーマンスのために保存頻度を強く制限する。
 * SettingsManagerを設定正本とし、本classは操作中記録・間隔・非表示時記録のruntime派生状態だけを持つ。
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
        this._lastSaveReason = null;
        this._periodicEnabled = true;
        this._saveOnHide = true;
        this._eventBus = null;
        // Project全体のserializeを伴うため、重いCAFでも操作を周期的に塞ぎにくい
        // 1分を安全な既定値とする。短周期はSettingsで明示選択した場合だけ使う。
        this._saveInterval = 60000;
        this._debounceDelay = 1000; // 変更後の遅延 (1秒)
        this._drawingRetryDelay = 500;
        this._idleTimeout = 2000;
        this._debounceTimer = null;
        this._idleHandle = null;
        this._idleFallbackTimer = null;
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
        if (!this._periodicEnabled) return false;
        if (this._isSaving) {
            this._pendingSave = true;
            return true;
        }

        this._pendingSave = true;
        this._cancelIdleAttempt();
        if (this._debounceTimer) clearTimeout(this._debounceTimer);
        
        this._debounceTimer = setTimeout(() => {
            this._debounceTimer = null;
            this._scheduleIdleAttempt();
        }, this._debounceDelay);
        return true;
    }

    /**
     * 通常の流量制限を無視して可能な限り早く保存を試みる（ページ離脱時など）
     */
    forceCheckpointSoon(options = {}) {
        const reason = options.reason || 'forced';
        const isHideReason = reason === 'pagehide' || reason === 'visibility-hidden';
        if (isHideReason && !this._saveOnHide) return false;
        if (this._isSaving) return false;
        this._cancelScheduledAttempt();
        this.performSave({ force: true, reason }).catch(() => {});
        return true;
    }

    /**
     * 保存を試みる（流量制限付き）
     */
    async _trySave(options = {}) {
        const force = options.force === true;
        if (!force && !this._periodicEnabled) {
            this._pendingSave = false;
            return false;
        }
        const now = Date.now();

        if (!force && this._isDrawingActive()) {
            this._pendingSave = true;
            this._scheduleRetry(this._drawingRetryDelay);
            return;
        }
        
        // 1. 前回の保存から一定時間経過しているか
        if (!force && now - this._lastSaveTime < this._saveInterval) {
            // インターバル中なら後でまた試す
            this._pendingSave = true;
            this._scheduleRetry(this._saveInterval - (now - this._lastSaveTime));
            return;
        }

        // 2. 現在保存中か
        if (this._isSaving) {
            this._pendingSave = true;
            return;
        }

        return this.performSave({ force });
    }

    /**
     * 描画状態のキャプチャと保存を実行
     */
    async performSave(options = {}) {
        const force = options.force === true;
        if (!force && !this._periodicEnabled) {
            this._pendingSave = false;
            return false;
        }
        if (!window.projectManager) return false;
        const reason = options.reason || (force ? 'forced' : 'periodic');
        if (!force && this._isDrawingActive()) {
            this._pendingSave = true;
            this._scheduleRetry(this._drawingRetryDelay);
            return;
        }
        
        this._isSaving = true;
        this._pendingSave = false; // 保存開始時にフラグを下ろす
        // console.log('[EmergencyRecovery] Starting background save...');

        const saveStartedAt = this._now();
        try {
            // プロジェクトデータのエクスポート（重い処理）
            const exportStartedAt = this._now();
            const projectData = await window.projectManager.exportProject();
            this._recordPerf('emergency-recovery.export-project', exportStartedAt, { force });
            if (!projectData) throw new Error('Export failed');

            await this.init();
            
            const savedAt = Date.now();
            const data = {
                id: 'latest',
                timestamp: savedAt,
                // Hospital復元はprojectDataだけを使う。旧checkpointとのshape互換だけ維持する。
                thumbnail: null,
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

            this._lastSaveTime = savedAt;
            this._lastSaveReason = reason;
            this._recordPerf('emergency-recovery.total', saveStartedAt, { force, reason });
            this._eventBus?.emit?.('emergency-recovery:saved', {
                timestamp: savedAt,
                reason
            });
            // console.log('[EmergencyRecovery] Checkpoint saved successfully.');
            return true;
        } catch (e) {
            console.warn('[EmergencyRecovery] Background save failed:', e);
            return false;
        } finally {
            this._isSaving = false;
            
            // 保存中に変更があった場合は、デバウンス時間後に再試行
            if (this._pendingSave) {
                this._scheduleRetry(this._debounceDelay);
            }
        }
    }

    _scheduleIdleAttempt() {
        if (this._isSaving) {
            this._pendingSave = true;
            return;
        }
        this._cancelIdleAttempt();

        const run = () => {
            this._idleHandle = null;
            this._idleFallbackTimer = null;
            this._trySave().catch(() => {});
        };
        if (typeof window.requestIdleCallback === 'function') {
            this._idleHandle = window.requestIdleCallback(run, {
                timeout: this._idleTimeout
            });
            return;
        }
        this._idleFallbackTimer = setTimeout(run, 50);
    }

    _scheduleRetry(delayMs) {
        this._cancelScheduledAttempt();
        const delay = Math.max(0, Number(delayMs) || 0);
        this._debounceTimer = setTimeout(() => {
            this._debounceTimer = null;
            this._scheduleIdleAttempt();
        }, delay);
    }

    _cancelScheduledAttempt() {
        if (this._debounceTimer) {
            clearTimeout(this._debounceTimer);
            this._debounceTimer = null;
        }
        this._cancelIdleAttempt();
    }

    _cancelIdleAttempt() {
        if (this._idleHandle !== null && typeof window.cancelIdleCallback === 'function') {
            window.cancelIdleCallback(this._idleHandle);
        }
        if (this._idleFallbackTimer !== null) {
            clearTimeout(this._idleFallbackTimer);
        }
        this._idleHandle = null;
        this._idleFallbackTimer = null;
    }

    /**
     * SettingsManagerの値をruntime schedulingへ反映する。
     * Project保存shapeやIndexedDB checkpointの正本は変更しない。
     */
    configure(options = {}) {
        const previousInterval = this._saveInterval;
        const previousPeriodicEnabled = this._periodicEnabled;

        if (options.eventBus) this._eventBus = options.eventBus;
        if (typeof options.periodicEnabled === 'boolean') {
            this._periodicEnabled = options.periodicEnabled;
        }
        if (typeof options.saveOnHide === 'boolean') {
            this._saveOnHide = options.saveOnHide;
        }

        const intervalSeconds = Number(options.intervalSeconds);
        if ([5, 10, 30, 60, 180, 300].includes(intervalSeconds)) {
            this._saveInterval = intervalSeconds * 1000;
        }

        if (!this._periodicEnabled) {
            this._pendingSave = false;
            this._cancelScheduledAttempt();
        } else if (
            previousPeriodicEnabled &&
            previousInterval !== this._saveInterval &&
            this._pendingSave &&
            !this._isSaving
        ) {
            const elapsed = Date.now() - this._lastSaveTime;
            this._scheduleRetry(Math.max(0, this._saveInterval - elapsed));
        }

        return this.getStatus();
    }

    getStatus() {
        return {
            periodicEnabled: this._periodicEnabled,
            saveOnHide: this._saveOnHide,
            intervalSeconds: this._saveInterval / 1000,
            lastSaveTime: this._lastSaveTime || null,
            lastSaveReason: this._lastSaveReason,
            isSaving: this._isSaving,
            pending: this._pendingSave
        };
    }

    _isDrawingActive() {
        return window.BrushCore?.isDrawing === true
            || window.drawingEngine?.isDrawing === true;
    }

    _now() {
        return globalThis.performance?.now?.() || Date.now();
    }

    _recordPerf(label, startedAt, extra = {}) {
        if (window.TEGAKI_CONFIG?.debug !== true || !Number.isFinite(startedAt)) return;
        const duration = this._now() - startedAt;
        const level = duration >= 250 ? 'FREEZE'
            : duration >= 100 ? 'SEVERE'
            : duration >= 50 ? 'LAG'
            : duration >= 33 ? 'DROP'
            : duration >= 16 ? 'FRAME'
            : null;
        if (!level) return;

        const entry = {
            label,
            level,
            durationMs: Number(duration.toFixed(2)),
            extra
        };
        console.warn(`[TegakiPerf:${level}] ${label}: ${entry.durationMs}ms`, entry);
        window.TegakiStrokeInputProfiler?.recordPerf?.(entry);
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

}

export const emergencyRecoveryStore = new EmergencyRecoveryStore();

// 下位互換性のためにグローバルに登録
window.emergencyRecoveryStore = emergencyRecoveryStore;
