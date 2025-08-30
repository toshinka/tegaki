/**
 * 📄 FILE: js/utils/coordinate-manager.js
 * 📌 RESPONSIBILITY: 統一座標変換システム・ログ削減版
 * 
 * @provides
 *   - CoordinateManager（クラス）
 *   - clientToWorld(clientX, clientY): {x, y}
 *   - clientToCanvas(clientX, clientY): {x, y}
 *   - toCanvasCoords(clientX, clientY): {x, y} - API統一エイリアス
 *   - canvasToWorld(canvasX, canvasY): {x, y}
 *   - setCanvasManager(canvasManager): Promise<void>
 *   - isReady(): boolean
 *   - isV8Ready(): boolean
 *   - waitForReady(): Promise<void>
 *   - clearV8Cache(): void - v8キャッシュクリア
 *   - testCoordinate(clientX, clientY): Object
 *   - getDebugInfo(): Object
 *
 * @uses
 *   - CanvasManager.getCanvasElement(): HTMLCanvasElement
 *   - CanvasManager.getDrawContainer(): PIXI.Container
 *   - CanvasManager.isV8Ready(): boolean
 *
 * @initflow
 *   1. constructor → 2. setCanvasManager → 3. 準備完了 → 4. 座標変換利用可能
 *
 * @forbids
 *   💀 双方向依存禁止
 *   🚫 直接DOM座標使用禁止
 *   🚫 DPR未考慮座標変換禁止
 *   🚫 Container変形無視禁止
 *   🚫 未実装メソッド呼び出し禁止
 *   🚫 NaN座標変換結果許可禁止
 *
 * @manager-key
 *   window.Tegaki.CoordinateManagerInstance
 *
 * @dependencies-strict
 *   REQUIRED: CanvasManager (v8対応)
 *   OPTIONAL: NavigationManager
 *   FORBIDDEN: 他Manager直接参照
 *
 * @integration-flow
 *   AppCore → CoordinateManager.setCanvasManager() → Tool.toCanvasCoords()
 *
 * @method-naming-rules
 *   - clientToXxx() - DOM座標からの変換
 *   - canvasToXxx() - Canvas座標からの変換
 *   - toCanvasCoords() - 統一API
 *   - isV8Ready() - 準備状態確認
 *
 * @event-contract
 *   ・clientX/Y は必ずNumber.isFinite()でチェック
 *   ・変換結果は必ず有効座標を保証
 *   ・エラー時はフォールバック座標を返す
 *
 * @coordinate-contract
 *   ・DOM座標→Canvas座標→World座標の一方向変換
 *   ・DPR補正は一回のみ（Cache内で実行）
 *   ・Container変形はWorld座標変換時に適用
 *
 * @input-validation
 *   ・clientX/Y が NaN/undefined の場合は即座にエラー
 *   ・座標変換途中でNaN発生時はフォールバック
 *   ・Manager未準備時は待機またはエラー
 *
 * @error-handling
 *   throw: 必須Manager未設定・重大座標変換失敗
 *   warn: 一時的エラー・キャッシュ無効（重要時のみ）
 *   log: 初期化完了・重大エラー（最低限のみ）
 *
 * @state-management
 *   - キャッシュは直接操作せず、updateCanvasCache()経由
 *   - 座標変換結果はイミュータブル
 *   - 状態確認は必ずisReady()経由
 *
 * @performance-notes
 *   - 座標変換は高頻度、キャッシュ最適化必須
 *   - DPR計算は重い処理、キャッシュ活用
 *   - 16ms維持、バッチ変換対応
 *   - console.log削減による性能向上
 */

(function() {
    'use strict';

    /**
     * CoordinateManager - ログ削減・高性能版
     * NaN防止・高精度座標変換・最低限ログ
     */
    class CoordinateManager {
        constructor() {
            // Manager参照
            this.canvasManager = null;
            
            // 準備状態
            this.ready = false;
            this.v8Ready = false;
            this.readyPromise = null;
            this.readyResolve = null;
            
            // 座標変換設定
            this.dpr = Math.min(window.devicePixelRatio || 1, 2.0);
            
            // Canvas情報キャッシュ（座標ズレ防止）
            this.canvasCache = {
                element: null,
                rect: null,
                logicalSize: null,
                lastUpdate: 0,
                valid: false
            };
            
            // v8キャッシュ（高性能版）
            this.v8Cache = {
                stage: null,
                drawContainer: null,
                lastUpdate: 0,
                valid: false
            };
            
            // 座標変換統計
            this.stats = {
                totalTransforms: 0,
                nanResults: 0,
                errorResults: 0,
                lastTransformTime: 0
            };
            
            // 準備完了Promise
            this.readyPromise = new Promise((resolve) => {
                this.readyResolve = resolve;
            });
        }

        /**
         * CanvasManager設定・準備完了処理（v8対応強化版）
         */
        async setCanvasManager(canvasManager) {
            try {
                if (!canvasManager) {
                    throw new Error('CanvasManager is required');
                }
                
                if (!canvasManager.isV8Ready()) {
                    throw new Error('CanvasManager not v8 ready');
                }
                
                this.canvasManager = canvasManager;
                
                // Canvas情報初期化
                this.updateCanvasCache();
                
                // v8キャッシュ初期化
                this.updateV8Cache();
                
                // 準備完了
                this.ready = true;
                this.v8Ready = true;
                
                if (this.readyResolve) {
                    this.readyResolve();
                }
                
            } catch (error) {
                console.error('🚨 CoordinateManager設定失敗:', error);
                throw error;
            }
        }
        
        /**
         * Canvas情報キャッシュ更新（NaN防止強化版）
         */
        updateCanvasCache() {
            if (!this.canvasManager) return;
            
            try {
                const canvas = this.canvasManager.getCanvasElement();
                if (!canvas) return;
                
                // Canvas矩形情報取得
                const rect = canvas.getBoundingClientRect();
                
                // 矩形情報検証（NaN・無効値チェック）
                if (!this.isValidRect(rect)) {
                    return;
                }
                
                // Canvas論理サイズ計算（DPR考慮・NaN防止）
                const logicalSize = {
                    width: Math.max(canvas.width / this.dpr, 1),
                    height: Math.max(canvas.height / this.dpr, 1)
                };
                
                // 論理サイズ検証
                if (!this.isValidSize(logicalSize)) {
                    return;
                }
                
                // キャッシュ更新
                this.canvasCache = {
                    element: canvas,
                    rect: {
                        left: rect.left,
                        top: rect.top,
                        width: rect.width,
                        height: rect.height,
                        right: rect.right,
                        bottom: rect.bottom
                    },
                    logicalSize: logicalSize,
                    lastUpdate: Date.now(),
                    valid: true
                };
                
            } catch (error) {
                // エラー時のみログ出力
                console.warn('Canvas情報更新失敗:', error);
                this.canvasCache.valid = false;
            }
        }
        
        /**
         * 矩形情報有効性チェック（NaN防止）
         */
        isValidRect(rect) {
            if (!rect) return false;
            
            const values = [rect.left, rect.top, rect.width, rect.height];
            for (const value of values) {
                if (!Number.isFinite(value)) {
                    return false;
                }
            }
            
            return rect.width > 0 && rect.height > 0;
        }
        
        /**
         * サイズ情報有効性チェック（NaN防止）
         */
        isValidSize(size) {
            if (!size) return false;
            
            return Number.isFinite(size.width) && 
                   Number.isFinite(size.height) && 
                   size.width > 0 && 
                   size.height > 0;
        }
        
        /**
         * v8キャッシュ更新（高性能版）
         */
        updateV8Cache() {
            if (!this.canvasManager?.isV8Ready()) return;
            
            try {
                const stage = this.canvasManager.pixiApp?.stage;
                const drawContainer = this.canvasManager.getDrawContainer();
                
                this.v8Cache = {
                    stage: stage,
                    drawContainer: drawContainer,
                    lastUpdate: Date.now(),
                    valid: !!(stage && drawContainer)
                };
                
            } catch (error) {
                this.v8Cache.valid = false;
            }
        }
        
        /**
         * v8キャッシュクリア
         */
        clearV8Cache() {
            this.v8Cache.valid = false;
            this.canvasCache.valid = false;
        }
        
        // ========================================
        // 統一座標変換メソッド（NaN防止強化版）
        // ========================================
        
        /**
         * DOM座標をWorld座標に変換（NaN防止完全版）
         */
        clientToWorld(clientX, clientY) {
            const startTime = performance.now();
            
            try {
                if (!this.ready) {
                    throw new Error('CoordinateManager not ready');
                }
                
                // 入力値検証（NaN防止）
                if (!Number.isFinite(clientX) || !Number.isFinite(clientY)) {
                    throw new Error(`Invalid input coordinates: x=${clientX}, y=${clientY}`);
                }
                
                // Canvas情報更新確認（500ms毎）
                const cacheAge = Date.now() - this.canvasCache.lastUpdate;
                if (!this.canvasCache.valid || cacheAge > 500) {
                    this.updateCanvasCache();
                }
                
                // キャッシュ再確認
                if (!this.canvasCache.valid) {
                    throw new Error('Canvas cache not valid after update');
                }
                
                // v8キャッシュ更新確認
                const v8CacheAge = Date.now() - this.v8Cache.lastUpdate;
                if (!this.v8Cache.valid || v8CacheAge > 500) {
                    this.updateV8Cache();
                }
                
                // Step 1: DOM座標 → Canvas座標（高精度版）
                const canvasPoint = this.clientToCanvasHighPrecision(clientX, clientY);
                
                // 中間結果検証
                if (!this.isValidCoordinate(canvasPoint)) {
                    throw new Error(`Invalid canvas coordinate result`);
                }
                
                // Step 2: Canvas座標 → World座標（Container変形対応）
                const worldPoint = this.canvasToWorldHighPrecision(canvasPoint.x, canvasPoint.y);
                
                // 最終結果検証
                if (!this.isValidCoordinate(worldPoint)) {
                    throw new Error(`Invalid world coordinate result`);
                }
                
                // 統計更新
                this.updateStats(startTime, true);
                
                return worldPoint;
                
            } catch (error) {
                // エラー時のみログ出力
                console.error('座標変換失敗:', error);
                this.updateStats(startTime, false);
                
                // フォールバック座標（NaN回避）
                const fallback = { x: 0, y: 0 };
                return fallback;
            }
        }
        
        /**
         * 座標有効性チェック（NaN防止）
         */
        isValidCoordinate(coord) {
            if (!coord) return false;
            return Number.isFinite(coord.x) && Number.isFinite(coord.y);
        }
        
        /**
         * DOM座標をCanvas座標に変換（NaN防止強化版）
         */
        clientToCanvasHighPrecision(clientX, clientY) {
            try {
                const cache = this.canvasCache;
                
                if (!cache.valid || !cache.rect || !cache.logicalSize) {
                    throw new Error('Canvas cache not valid');
                }
                
                // 高精度正規化座標計算（NaN防止）
                const deltaX = clientX - cache.rect.left;
                const deltaY = clientY - cache.rect.top;
                
                // 0除算防止
                if (cache.rect.width <= 0 || cache.rect.height <= 0) {
                    throw new Error('Invalid canvas rect dimensions');
                }
                
                const normalizedX = deltaX / cache.rect.width;
                const normalizedY = deltaY / cache.rect.height;
                
                // NaN確認
                if (!Number.isFinite(normalizedX) || !Number.isFinite(normalizedY)) {
                    throw new Error(`Normalized coordinates NaN`);
                }
                
                // 境界チェック（範囲外座標の適切な処理）
                const clampedX = Math.max(0, Math.min(1, normalizedX));
                const clampedY = Math.max(0, Math.min(1, normalizedY));
                
                // Canvas論理座標に変換（DPR考慮・高精度）
                const canvasX = clampedX * cache.logicalSize.width;
                const canvasY = clampedY * cache.logicalSize.height;
                
                // 最終結果NaN確認
                if (!Number.isFinite(canvasX) || !Number.isFinite(canvasY)) {
                    throw new Error(`Canvas coordinates NaN`);
                }
                
                return { x: canvasX, y: canvasY };
                
            } catch (error) {
                console.error('DOM→Canvas座標変換失敗:', error);
                throw error;
            }
        }
        
        /**
         * Canvas座標をWorld座標に変換（Container変形対応・NaN防止版）
         */
        canvasToWorldHighPrecision(canvasX, canvasY) {
            try {
                // 入力値検証
                if (!Number.isFinite(canvasX) || !Number.isFinite(canvasY)) {
                    throw new Error(`Invalid canvas coordinates`);
                }
                
                // v8キャッシュ使用（高性能）
                let drawContainer = this.v8Cache.valid ? 
                    this.v8Cache.drawContainer : 
                    this.canvasManager.getDrawContainer();
                
                if (!drawContainer) {
                    throw new Error('DrawContainer not available');
                }
                
                // Container変形なし（Phase1.5では等価変換）
                // Phase2でズーム・パン実装時に toLocal() 使用
                const worldPoint = { x: canvasX, y: canvasY };
                
                // 結果検証
                if (!Number.isFinite(worldPoint.x) || !Number.isFinite(worldPoint.y)) {
                    throw new Error(`World coordinates NaN`);
                }
                
                return worldPoint;
                
            } catch (error) {
                console.error('Canvas→World座標変換失敗:', error);
                throw error;
            }
        }
        
        // ========================================
        // 公開API（統一インターフェース）
        // ========================================
        
        /**
         * 公開API: DOM座標 → Canvas座標
         */
        clientToCanvas(clientX, clientY) {
            return this.clientToCanvasHighPrecision(clientX, clientY);
        }
        
        /**
         * 公開API: Canvas座標 → World座標
         */
        canvasToWorld(canvasX, canvasY) {
            return this.canvasToWorldHighPrecision(canvasX, canvasY);
        }
        
        /**
         * 統一API: DOM座標 → Canvas座標（Tool用エイリアス）
         * PenToolなどで使用される統一メソッド名
         */
        toCanvasCoords(clientX, clientY) {
            return this.clientToCanvasHighPrecision(clientX, clientY);
        }
        
        /**
         * 座標変換テスト（精度確認・デバッグ用）
         */
        testCoordinate(clientX, clientY) {
            try {
                const startTime = performance.now();
                
                // 段階的座標変換
                const canvasPoint = this.clientToCanvas(clientX, clientY);
                const worldPoint = this.canvasToWorld(canvasPoint.x, canvasPoint.y);
                
                const endTime = performance.now();
                
                return {
                    input: { x: clientX, y: clientY },
                    canvas: canvasPoint,
                    world: worldPoint,
                    transformTime: endTime - startTime,
                    success: true
                };
                
            } catch (error) {
                return {
                    input: { x: clientX, y: clientY },
                    error: error.message,
                    success: false
                };
            }
        }
        
        /**
         * 統計更新（NaN対応）
         */
        updateStats(startTime, success) {
            const duration = performance.now() - startTime;
            this.stats.totalTransforms++;
            this.stats.lastTransformTime = duration;
            
            if (!success) {
                this.stats.errorResults++;
            }
        }
        
        /**
         * 準備完了確認
         */
        isReady() {
            return this.ready && 
                   !!this.canvasManager && 
                   this.canvasManager.isV8Ready() &&
                   this.canvasCache.valid;
        }
        
        /**
         * v8準備完了確認
         */
        isV8Ready() {
            return this.v8Ready && 
                   this.isReady() && 
                   this.v8Cache.valid;
        }
        
        /**
         * 準備完了まで待機
         */
        waitForReady() {
            if (this.isReady()) {
                return Promise.resolve();
            }
            return this.readyPromise;
        }
        
        /**
         * デバッグ情報取得
         */
        getDebugInfo() {
            return {
                className: 'CoordinateManager',
                version: 'v8-performance-optimized',
                ready: this.ready,
                v8Ready: this.v8Ready,
                canvasManagerReady: this.canvasManager?.isV8Ready() || false,
                canvasCache: {
                    valid: this.canvasCache.valid,
                    lastUpdate: this.canvasCache.lastUpdate,
                    age: Date.now() - this.canvasCache.lastUpdate,
                    rect: this.canvasCache.rect,
                    logicalSize: this.canvasCache.logicalSize
                },
                v8Cache: {
                    valid: this.v8Cache.valid,
                    lastUpdate: this.v8Cache.lastUpdate,
                    age: Date.now() - this.v8Cache.lastUpdate
                },
                stats: this.stats,
                precisionTest: this.isReady() ? {
                    topLeft: this.testCoordinate(0, 0),
                    center: this.testCoordinate(200, 200),
                    bottomRight: this.testCoordinate(400, 400)
                } : null
            };
        }
    }

    // グローバル登録
    if (!window.Tegaki) {
        window.Tegaki = {};
    }
    window.Tegaki.CoordinateManager = CoordinateManager;

})();