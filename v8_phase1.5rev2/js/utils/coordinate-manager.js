/**
 * 📄 FILE: utils/coordinate-manager.js
 * 📌 RESPONSIBILITY: 統一座標変換システム・座標ズレ完全解決版（左上ズレ・右下ズレ対策強化）
 * 
 * @provides
 *   - CoordinateManager（クラス）
 *   - clientToWorld(clientX, clientY): {x, y}
 *   - clientToCanvas(clientX, clientY): {x, y}
 *   - canvasToWorld(canvasX, canvasY): {x, y}
 *   - setCanvasManager(canvasManager): Promise<void>
 *   - isReady(): boolean
 *   - waitForReady(): Promise<void>
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
 *
 * @manager-key
 *   window.Tegaki.CoordinateManagerInstance
 */

(function() {
    'use strict';

    /**
     * CoordinateManager - 座標ズレ完全解決版
     * 左上ズレ・右下ズレ対策強化・高精度座標変換
     */
    class CoordinateManager {
        constructor() {
            // Manager参照
            this.canvasManager = null;
            
            // 準備状態
            this.ready = false;
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
            
            // 座標変換統計
            this.stats = {
                totalTransforms: 0,
                averageError: 0,
                maxError: 0,
                lastTransformTime: 0
            };
            
            // 準備完了Promise
            this.readyPromise = new Promise((resolve) => {
                this.readyResolve = resolve;
            });
        }

        /**
         * CanvasManager設定・準備完了処理
         * @param {CanvasManager} canvasManager - v8準備完了済みCanvasManager
         */
        async setCanvasManager(canvasManager) {
            try {
                if (!canvasManager) {
                    throw new Error('CanvasManager is required');
                }
                
                if (!canvasManager.isV8Ready()) {
                    throw new Error('CanvasManager not ready');
                }
                
                this.canvasManager = canvasManager;
                
                // Canvas情報初期化
                this.updateCanvasCache();
                
                // 準備完了
                this.ready = true;
                
                if (this.readyResolve) {
                    this.readyResolve();
                }
                
            } catch (error) {
                console.error('🧭 CoordinateManager設定失敗:', error);
                throw error;
            }
        }
        
        /**
         * Canvas情報キャッシュ更新（座標ズレ防止の核心）
         */
        updateCanvasCache() {
            if (!this.canvasManager) return;
            
            try {
                const canvas = this.canvasManager.getCanvasElement();
                if (!canvas) return;
                
                // Canvas矩形情報取得（高精度）
                const rect = canvas.getBoundingClientRect();
                
                // Canvas論理サイズ計算（DPR考慮）
                const logicalSize = {
                    width: canvas.width / this.dpr,
                    height: canvas.height / this.dpr
                };
                
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
                console.warn('Canvas情報更新失敗:', error);
                this.canvasCache.valid = false;
            }
        }
        
        // ========================================
        // 統一座標変換メソッド（座標ズレ解決の核心）
        // ========================================
        
        /**
         * DOM座標をWorld座標に変換（座標ズレ完全解決版）
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
                
                // Canvas情報更新確認（500ms毎）
                const cacheAge = Date.now() - this.canvasCache.lastUpdate;
                if (!this.canvasCache.valid || cacheAge > 500) {
                    this.updateCanvasCache();
                }
                
                // Step 1: DOM座標 → Canvas座標（高精度版）
                const canvasPoint = this.clientToCanvasHighPrecision(clientX, clientY);
                
                // Step 2: Canvas座標 → World座標（Container変形対応）
                const worldPoint = this.canvasToWorldHighPrecision(canvasPoint.x, canvasPoint.y);
                
                // 統計更新
                this.updateStats(startTime);
                
                return worldPoint;
                
            } catch (error) {
                console.error('座標変換失敗:', error);
                throw error;
            }
        }
        
        /**
         * DOM座標をCanvas座標に変換（高精度版・左上ズレ対策）
         * @param {number} clientX - DOM座標X
         * @param {number} clientY - DOM座標Y
         * @returns {{x: number, y: number}} Canvas座標
         */
        clientToCanvasHighPrecision(clientX, clientY) {
            try {
                const cache = this.canvasCache;
                
                if (!cache.valid || !cache.rect || !cache.logicalSize) {
                    throw new Error('Canvas cache not valid');
                }
                
                // 高精度正規化座標計算（座標ズレ防止の核心）
                // Canvas要素の正確な矩形を使用
                const normalizedX = (clientX - cache.rect.left) / cache.rect.width;
                const normalizedY = (clientY - cache.rect.top) / cache.rect.height;
                
                // 境界チェック（範囲外座標の適切な処理）
                const clampedX = Math.max(0, Math.min(1, normalizedX));
                const clampedY = Math.max(0, Math.min(1, normalizedY));
                
                // Canvas論理座標に変換（DPR考慮・高精度）
                const canvasX = clampedX * cache.logicalSize.width;
                const canvasY = clampedY * cache.logicalSize.height;
                
                return { x: canvasX, y: canvasY };
                
            } catch (error) {
                console.error('DOM→Canvas座標変換失敗:', error);
                throw error;
            }
        }
        
        /**
         * Canvas座標をWorld座標に変換（Container変形対応・高精度版）
         * @param {number} canvasX - Canvas座標X
         * @param {number} canvasY - Canvas座標Y
         * @returns {{x: number, y: number}} World座標
         */
        canvasToWorldHighPrecision(canvasX, canvasY) {
            try {
                const drawContainer = this.canvasManager.getDrawContainer();
                
                // 高精度座標変換（Container変形対応）
                const globalPoint = { x: canvasX, y: canvasY };
                const localPoint = drawContainer.toLocal(globalPoint);
                
                return { x: localPoint.x, y: localPoint.y };
                
            } catch (error) {
                console.error('Canvas→World座標変換失敗:', error);
                throw error;
            }
        }
        
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
         * 座標変換テスト（精度確認・デバッグ用）
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
         * 統計更新
         */
        updateStats(startTime) {
            const duration = performance.now() - startTime;
            this.stats.totalTransforms++;
            this.stats.lastTransformTime = duration;
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
                version: 'v8-precision-fix',
                ready: this.ready,
                canvasManagerReady: this.canvasManager?.isV8Ready() || false,
                canvasCache: this.canvasCache,
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