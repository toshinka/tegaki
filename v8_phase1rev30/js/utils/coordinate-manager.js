/**
 * 📄 FILE: utils/coordinate-manager.js
 * 📌 RESPONSIBILITY: 統一座標変換システム・座標ズレ完全解決版
 * 
 * @provides
 *   - CoordinateManager（クラス）
 *   - clientToWorld(clientX, clientY): {x, y}
 *   - clientToCanvas(clientX, clientY): {x, y}
 *   - canvasToWorld(canvasX, canvasY): {x, y}
 *   - worldToCanvas(worldX, worldY): {x, y}
 *   - setCanvasManager(canvasManager): Promise<void>
 *   - isReady(): boolean
 *   - getTransformMatrix(): PIXI.Matrix
 *   - getDebugInfo(): Object
 *   - waitForReady(): Promise<void>
 *
 * @uses
 *   - CanvasManager.getCanvasElement(): HTMLCanvasElement
 *   - CanvasManager.getDrawContainer(): PIXI.Container
 *   - CanvasManager.getPixiApp(): PIXI.Application
 *   - CanvasManager.isV8Ready(): boolean
 *   - PIXI.Matrix（変形行列計算）
 *   - window.Tegaki.EventBusInstance.emit（状態通知）
 *
 * @initflow
 *   1. constructor → 2. setCanvasManager → 3. 準備完了待機 → 4. 座標変換メソッド利用可能
 *
 * @forbids
 *   💀 双方向依存禁止
 *   🚫 フォールバック禁止
 *   🚫 フェイルセーフ禁止
 *   🚫 v7/v8二重管理禁止
 *   🚫 未実装メソッド呼び出し禁止
 *   🚫 直接DOM座標使用禁止
 *   🚫 DPR未考慮座標変換禁止
 *   🚫 Container変形無視座標変換禁止
 *
 * @manager-key
 *   window.Tegaki.CoordinateManagerInstance
 *
 * @dependencies-strict
 *   REQUIRED: CanvasManager（v8Ready状態）, PIXI.Matrix
 *   OPTIONAL: EventBus（状態通知用）
 *   FORBIDDEN: 他の座標変換システム、直接Canvas操作
 *
 * @integration-flow
 *   AppCore.initializeDrawingManagers() → CoordinateManager.setCanvasManager(canvasManager)
 *   → 準備完了 → PenTool等から座標変換呼び出し
 *
 * @method-naming-rules
 *   座標変換: clientToXxx() / canvasToXxx() / worldToXxx()
 *   準備管理: setCanvasManager() / isReady() / waitForReady()
 *   情報取得: getTransformMatrix() / getDebugInfo()
 *
 * @error-handling
 *   throw: CanvasManager未設定・準備未完了・座標変換失敗
 *   false: オプション機能失敗
 *   warn: 精度低下・変換近似
 *
 * @testing-hooks
 *   - getDebugInfo(): 座標変換詳細情報・変換行列・精度統計
 *   - isReady(): 準備完了状態
 *   - testCoordinate(clientX, clientY): テスト用座標変換
 *
 * @performance-notes
 *   座標変換最適化・DPR制限・Container変形キャッシュ・統計取得
 *   60fps維持・メモリ効率・WebGPU対応
 */

(function() {
    'use strict';

    /**
     * CoordinateManager - 統一座標変換システム
     * 座標ズレ問題完全解決版
     */
    class CoordinateManager {
        constructor() {
            console.log('🧭 CoordinateManager v8対応版・座標ズレ問題解決版 作成開始');
            
            // Manager参照
            this.canvasManager = null;
            
            // 準備状態管理
            this.ready = false;
            this.readyPromise = null;
            this.readyResolve = null;
            
            // 座標変換設定
            this.dpr = Math.min(window.devicePixelRatio || 1, 2.0); // DPR制限
            this.transformMatrix = new PIXI.Matrix();
            this.lastTransformUpdate = 0;
            this.transformCacheValid = false;
            
            // 座標変換統計（精度確認用）
            this.coordinateStats = {
                totalTransforms: 0,
                clientToWorldCalls: 0,
                clientToCanvasCalls: 0,
                canvasToWorldCalls: 0,
                worldToCanvasCalls: 0,
                lastTransformTime: 0,
                averageTransformTime: 0
            };
            
            // 準備完了Promise作成
            this.readyPromise = new Promise((resolve) => {
                this.readyResolve = resolve;
            });
            
            console.log('🧭 CoordinateManager 作成完了');
        }

        /**
         * CanvasManager設定・準備完了処理
         * @param {CanvasManager} canvasManager - v8準備完了済みCanvasManager
         */
        async setCanvasManager(canvasManager) {
            console.log('🧭 CoordinateManager: CanvasManager設定開始');
            
            try {
                if (!canvasManager) {
                    throw new Error('CanvasManager is required');
                }
                
                // CanvasManager準備完了確認
                if (!canvasManager.isV8Ready()) {
                    throw new Error('CanvasManager not ready - v8 initialization required');
                }
                
                this.canvasManager = canvasManager;
                
                // 座標変換初期化
                await this.initializeCoordinateTransform();
                
                // 準備完了
                this.ready = true;
                
                // readyPromise解決
                if (this.readyResolve) {
                    this.readyResolve();
                }
                
                console.log('🧭 CoordinateManager: CanvasManager設定完了');
                
                // 状態通知
                this.emitReadyState();
                
            } catch (error) {
                console.error('🧭 CoordinateManager: CanvasManager設定失敗:', error);
                throw error;
            }
        }
        
        /**
         * 座標変換システム初期化
         */
        async initializeCoordinateTransform() {
            console.log('🧭 CoordinateManager: 座標変換システム初期化');
            
            try {
                // DPR設定更新
                this.updateDPRSettings();
                
                // 変換行列初期化
                this.updateTransformMatrix();
                
                // Canvas要素確認
                const canvas = this.canvasManager.getCanvasElement();
                if (!canvas) {
                    throw new Error('Canvas element not available');
                }
                
                // DrawContainer確認
                const drawContainer = this.canvasManager.getDrawContainer();
                if (!drawContainer) {
                    throw new Error('DrawContainer not available');
                }
                
                console.log('🧭 CoordinateManager: 座標変換システム初期化完了');
                
            } catch (error) {
                console.error('🧭 CoordinateManager: 座標変換システム初期化失敗:', error);
                throw error;
            }
        }
        
        /**
         * DPR設定更新
         */
        updateDPRSettings() {
            const newDPR = Math.min(window.devicePixelRatio || 1, 2.0);
            if (newDPR !== this.dpr) {
                this.dpr = newDPR;
                this.transformCacheValid = false;
            }
        }
        
        /**
         * 変換行列更新
         */
        updateTransformMatrix() {
            if (!this.canvasManager) return;
            
            try {
                const drawContainer = this.canvasManager.getDrawContainer();
                if (drawContainer) {
                    this.transformMatrix.copyFrom(drawContainer.worldTransform);
                    this.lastTransformUpdate = Date.now();
                    this.transformCacheValid = true;
                }
            } catch (error) {
                console.warn('🧭 CoordinateManager: 変換行列更新失敗:', error);
                this.transformCacheValid = false;
            }
        }
        
        // ========================================
        // 統一座標変換メソッド（座標ズレ解決の核心）
        // ========================================
        
        /**
         * DOM座標をWorld座標に変換（統一API・座標ズレ完全解決）
         * @param {number} clientX - DOM座標X
         * @param {number} clientY - DOM座標Y
         * @returns {{x: number, y: number}} World座標
         */
        clientToWorld(clientX, clientY) {
            const startTime = performance.now();
            
            try {
                if (!this.ready) {
                    throw new Error('CoordinateManager not ready');
                }
                
                // Step 1: DOM座標 → Canvas座標
                const canvasPoint = this.clientToCanvas(clientX, clientY);
                
                // Step 2: Canvas座標 → World座標
                const worldPoint = this.canvasToWorld(canvasPoint.x, canvasPoint.y);
                
                // 統計更新
                this.updateStats('clientToWorld', startTime);
                
                return worldPoint;
                
            } catch (error) {
                console.error('🧭 CoordinateManager.clientToWorld失敗:', error);
                throw error;
            }
        }
        
        /**
         * DOM座標をCanvas座標に変換（DPR・CSS変形対応）
         * @param {number} clientX - DOM座標X
         * @param {number} clientY - DOM座標Y
         * @returns {{x: number, y: number}} Canvas座標
         */
        clientToCanvas(clientX, clientY) {
            const startTime = performance.now();
            
            try {
                if (!this.ready) {
                    throw new Error('CoordinateManager not ready');
                }
                
                const canvas = this.canvasManager.getCanvasElement();
                const rect = canvas.getBoundingClientRect();
                
                // CSS表示サイズベースの正規化座標（0-1範囲）
                const normalizedX = (clientX - rect.left) / rect.width;
                const normalizedY = (clientY - rect.top) / rect.height;
                
                // Canvas論理サイズに変換（DPR考慮）
                const canvasLogicalWidth = canvas.width / this.dpr;
                const canvasLogicalHeight = canvas.height / this.dpr;
                
                const canvasX = normalizedX * canvasLogicalWidth;
                const canvasY = normalizedY * canvasLogicalHeight;
                
                // 統計更新
                this.updateStats('clientToCanvas', startTime);
                
                return { x: canvasX, y: canvasY };
                
            } catch (error) {
                console.error('🧭 CoordinateManager.clientToCanvas失敗:', error);
                throw error;
            }
        }
        
        /**
         * Canvas座標をWorld座標に変換（Container変形対応）
         * @param {number} canvasX - Canvas座標X
         * @param {number} canvasY - Canvas座標Y
         * @returns {{x: number, y: number}} World座標
         */
        canvasToWorld(canvasX, canvasY) {
            const startTime = performance.now();
            
            try {
                if (!this.ready) {
                    throw new Error('CoordinateManager not ready');
                }
                
                const drawContainer = this.canvasManager.getDrawContainer();
                
                // Container変形を考慮した座標変換
                const globalPoint = { x: canvasX, y: canvasY };
                const localPoint = drawContainer.toLocal(globalPoint);
                
                // 統計更新
                this.updateStats('canvasToWorld', startTime);
                
                return { x: localPoint.x, y: localPoint.y };
                
            } catch (error) {
                console.error('🧭 CoordinateManager.canvasToWorld失敗:', error);
                throw error;
            }
        }
        
        /**
         * World座標をCanvas座標に変換（逆変換）
         * @param {number} worldX - World座標X
         * @param {number} worldY - World座標Y
         * @returns {{x: number, y: number}} Canvas座標
         */
        worldToCanvas(worldX, worldY) {
            const startTime = performance.now();
            
            try {
                if (!this.ready) {
                    throw new Error('CoordinateManager not ready');
                }
                
                const drawContainer = this.canvasManager.getDrawContainer();
                
                // World座標をContainer座標系に変換
                const localPoint = { x: worldX, y: worldY };
                const globalPoint = drawContainer.toGlobal(localPoint);
                
                // 統計更新
                this.updateStats('worldToCanvas', startTime);
                
                return { x: globalPoint.x, y: globalPoint.y };
                
            } catch (error) {
                console.error('🧭 CoordinateManager.worldToCanvas失敗:', error);
                throw error;
            }
        }
        
        // ========================================
        // 変換行列・高度な座標処理
        // ========================================
        
        /**
         * 変換行列取得（キャッシュ付き）
         * @returns {PIXI.Matrix} 現在の変換行列
         */
        getTransformMatrix() {
            // キャッシュ有効期限チェック（1秒）
            const cacheAge = Date.now() - this.lastTransformUpdate;
            if (!this.transformCacheValid || cacheAge > 1000) {
                this.updateTransformMatrix();
            }
            
            return this.transformMatrix;
        }
        
        /**
         * 座標変換テスト（デバッグ用）
         * @param {number} clientX - テスト用DOM座標X
         * @param {number} clientY - テスト用DOM座標Y
         * @returns {Object} 変換結果詳細
         */
        testCoordinate(clientX, clientY) {
            try {
                const startTime = performance.now();
                
                // 段階的座標変換
                const canvasPoint = this.clientToCanvas(clientX, clientY);
                const worldPoint = this.canvasToWorld(canvasPoint.x, canvasPoint.y);
                const backToCanvas = this.worldToCanvas(worldPoint.x, worldPoint.y);
                
                const endTime = performance.now();
                
                // 逆変換精度確認
                const canvasError = {
                    x: Math.abs(canvasPoint.x - backToCanvas.x),
                    y: Math.abs(canvasPoint.y - backToCanvas.y)
                };
                
                return {
                    input: { x: clientX, y: clientY },
                    canvas: canvasPoint,
                    world: worldPoint,
                    backToCanvas: backToCanvas,
                    canvasError: canvasError,
                    transformTime: endTime - startTime,
                    precision: {
                        acceptable: canvasError.x < 1 && canvasError.y < 1,
                        highPrecision: canvasError.x < 0.1 && canvasError.y < 0.1
                    }
                };
                
            } catch (error) {
                return {
                    error: error.message,
                    input: { x: clientX, y: clientY }
                };
            }
        }
        
        // ========================================
        // 統計・状態管理
        // ========================================
        
        /**
         * 座標変換統計更新
         */
        updateStats(methodName, startTime) {
            const duration = performance.now() - startTime;
            
            this.coordinateStats.totalTransforms++;
            this.coordinateStats[methodName + 'Calls']++;
            this.coordinateStats.lastTransformTime = duration;
            
            // 平均時間更新（移動平均）
            const alpha = 0.1; // 重み係数
            this.coordinateStats.averageTransformTime = 
                this.coordinateStats.averageTransformTime * (1 - alpha) + duration * alpha;
        }
        
        /**
         * 準備完了状態通知
         */
        emitReadyState() {
            if (window.Tegaki?.EventBusInstance?.emit) {
                window.Tegaki.EventBusInstance.emit('coordinateManagerReady', {
                    ready: this.ready,
                    dpr: this.dpr,
                    canvasManager: !!this.canvasManager
                });
            }
        }
        
        /**
         * 準備完了確認
         * @returns {boolean} 準備完了状態
         */
        isReady() {
            return this.ready && 
                   !!this.canvasManager && 
                   this.canvasManager.isV8Ready();
        }
        
        /**
         * 準備完了まで待機
         * @returns {Promise<void>} 準備完了Promise
         */
        waitForReady() {
            if (this.isReady()) {
                return Promise.resolve();
            }
            return this.readyPromise;
        }
        
        /**
         * デバッグ情報取得
         * @returns {Object} 詳細デバッグ情報
         */
        getDebugInfo() {
            const canvas = this.canvasManager?.getCanvasElement();
            const drawContainer = this.canvasManager?.getDrawContainer();
            
            return {
                className: 'CoordinateManager',
                version: 'v8対応版・座標ズレ問題解決版',
                ready: this.ready,
                canvasManagerReady: this.canvasManager?.isV8Ready() || false,
                dprInfo: {
                    deviceDPR: window.devicePixelRatio,
                    effectiveDPR: this.dpr,
                    limited: this.dpr < window.devicePixelRatio
                },
                canvasInfo: canvas ? {
                    width: canvas.width,
                    height: canvas.height,
                    styleWidth: canvas.style.width,
                    styleHeight: canvas.style.height,
                    logicalSize: {
                        width: canvas.width / this.dpr,
                        height: canvas.height / this.dpr
                    }
                } : null,
                containerInfo: drawContainer ? {
                    x: drawContainer.x,
                    y: drawContainer.y,
                    scaleX: drawContainer.scale.x,
                    scaleY: drawContainer.scale.y,
                    rotation: drawContainer.rotation,
                    hasTransform: !drawContainer.worldTransform.isIdentity()
                } : null,
                transformInfo: {
                    matrixValid: this.transformCacheValid,
                    lastUpdate: this.lastTransformUpdate,
                    cacheAge: Date.now() - this.lastTransformUpdate
                },
                stats: { ...this.coordinateStats },
                testResults: this.isReady() ? {
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

    console.log('🧭 CoordinateManager v8対応版・座標ズレ問題解決版 Loaded');
    console.log('📏 特徴: DPR対応強化・Container変形対応・座標検証機能・統計取得');
    console.log('✅ 座標変換統一: clientToWorld(), clientToCanvas(), canvasToWorld(), worldToCanvas()');

})();