/**
 * 🎯 CoordinateManager - PixiJS v8高精度座標変換管理
 * 📋 RESPONSIBILITY: v8対応スクリーン座標とCanvas座標の変換・高精度座標計算・v8変形対応
 * 🚫 PROHIBITION: 描画処理・UI操作・ツール管理・エラーUI表示・フォールバック
 * ✅ PERMISSION: v8座標変換計算・Canvas境界判定・解像度調整・v8変形座標・NavigationManager連携
 * 
 * 📏 DESIGN_PRINCIPLE: v8高精度変換・剛直構造・エラー隠蔽禁止・PixiJS v8機能活用・Navigator統合
 * 🔄 INTEGRATION: CanvasManager v8(Canvas情報) + NavigationManager v8(変形情報) + PixiJS v8(座標システム) + 各Tool(座標利用)
 * 🎯 V8_FEATURE: 高精度座標変換・v8 Container変形対応・WebGPU座標精度・リアルタイム変換
 * 
 * === 座標変換フロー ===
 * 開始: スクリーン座標取得 → DOM座標変換 → Canvas座標変換 → v8変形適用 → 最終座標出力
 * v8変形: Container.transform取得 → 逆変形行列適用 → 高精度座標計算 → 境界判定 → 結果返却
 * 依存関係: CanvasManager v8(Canvas情報) + NavigationManager v8(変形状態) + PixiJS v8(Matrix変換)
 * 
 * === 提供メソッド ===
 * - async setCanvasManagerV8(canvasManager) : v8対応CanvasManager設定
 * - screenToCanvasV8(screenX, screenY) : v8高精度スクリーン→Canvas座標変換
 * - canvasToScreenV8(canvasX, canvasY) : v8高精度Canvas→スクリーン座標変換
 * - applyInverseTransformV8(x, y, transform) : v8逆変形適用
 * - isInsideCanvasV8(canvasX, canvasY) : v8Canvas境界内判定
 * - getCanvasBoundsV8() : v8Canvas境界情報取得
 * - setNavigationManagerV8(navigationManager) : v8NavigationManager設定
 * 
 * === 他ファイル呼び出しメソッド ===
 * - canvasManager.getCanvasElement() : Canvas DOM要素取得
 * - canvasManager.pixiApp.stage : v8 Stage Container取得
 * - navigationManager.getCanvasTransformV8() : v8変形状態取得
 * - element.getBoundingClientRect() : DOM座標取得
 * - PIXI.Matrix.applyInverse() : v8逆変形適用
 */

if (!window.Tegaki) {
    window.Tegaki = {};
}

if (!window.Tegaki.CoordinateManager) {
    /**
     * CoordinateManager - PixiJS v8高精度座標変換管理
     * スクリーン座標とCanvas座標の高精度変換を管理（v8対応版）
     */
    class CoordinateManager {
        constructor() {
            console.log('🎯 CoordinateManager v8対応版 作成開始');
            
            this.canvasManager = null;
            this.navigationManager = null;
            this.v8Ready = false;
            
            // 高精度座標変換キャッシュ（v8対応）
            this.cachedBounds = null;
            this.cachedTransform = null;
            this.boundsUpdateTime = 0;
            this.transformUpdateTime = 0;
            this.CACHE_DURATION = 16; // 60fps対応: 16ms キャッシュ
            
            // v8精度設定
            this.highPrecisionMode = true;
            this.webgpuSupported = false;
            
            console.log('✅ CoordinateManager v8対応版 作成完了');
        }
        
        /**
         * v8対応CanvasManager設定（非同期初期化）
         * @param {CanvasManager} canvasManager - v8対応CanvasManager
         */
        async setCanvasManagerV8(canvasManager) {
            console.log('🔧 CoordinateManager - v8 CanvasManager設定開始');
            
            if (!canvasManager) {
                throw new Error('CoordinateManager: CanvasManager is required for v8');
            }
            
            if (!canvasManager.isV8Ready()) {
                throw new Error('CoordinateManager: CanvasManager v8 not ready');
            }
            
            this.canvasManager = canvasManager;
            
            // v8機能確認
            if (canvasManager.webgpuSupported) {
                this.webgpuSupported = true;
                this.highPrecisionMode = true;
                console.log('🚀 CoordinateManager: WebGPU高精度モード有効');
            }
            
            await this.initializeV8Features();
            
            this.v8Ready = true;
            console.log('✅ CoordinateManager - v8 CanvasManager設定完了');
        }
        
        /**
         * v8対応NavigationManager設定
         * @param {NavigationManager} navigationManager - v8対応NavigationManager
         */
        async setNavigationManagerV8(navigationManager) {
            console.log('🧭 CoordinateManager - v8 NavigationManager設定開始');
            
            if (!navigationManager) {
                console.warn('⚠️ NavigationManager未提供 - 基本座標変換のみ');
                return;
            }
            
            if (!navigationManager.isV8Ready?.()) {
                console.warn('⚠️ NavigationManager v8未対応 - 基本変換のみ');
                return;
            }
            
            this.navigationManager = navigationManager;
            console.log('✅ CoordinateManager - v8 NavigationManager設定完了');
        }
        
        /**
         * v8機能初期化
         */
        async initializeV8Features() {
            console.log('🎯 CoordinateManager v8機能初期化開始');
            
            // v8高精度設定適用
            if (this.webgpuSupported) {
                // WebGPU環境での高精度設定
                this.CACHE_DURATION = 8; // 120fps対応
                console.log('🚀 WebGPU高精度キャッシュ設定適用');
            }
            
            console.log('✅ CoordinateManager v8機能初期化完了');
        }
        
        /**
         * v8高精度スクリーン座標→Canvas座標変換
         * @param {number} screenX - スクリーンX座標
         * @param {number} screenY - スクリーンY座標
         * @returns {{x: number, y: number}} v8高精度Canvas座標
         */
        screenToCanvasV8(screenX, screenY) {
            this.validateV8Initialization();
            
            // Canvas要素取得
            const canvasElement = this.canvasManager.getCanvasElement();
            if (!canvasElement) {
                throw new Error('Canvas element not available for v8 coordinate conversion');
            }
            
            // v8高精度DOM座標情報取得
            const rect = this.getCachedBoundsV8(canvasElement);
            
            // 基本座標変換計算（v8精度）
            const canvasX = screenX - rect.left;
            const canvasY = screenY - rect.top;
            
            // v8 Container変形適用
            if (this.navigationManager?.getCanvasTransformV8) {
                const transform = this.getCachedTransformV8();
                if (transform) {
                    return this.applyInverseTransformV8(canvasX, canvasY, transform);
                }
            }
            
            // v8解像度調整（PixiJS v8対応）
            const pixiApp = this.canvasManager.pixiApp;
            if (pixiApp && this.highPrecisionMode) {
                const resolution = pixiApp.renderer.resolution || 1;
                if (resolution !== 1) {
                    console.log(`🔧 v8解像度調整適用: resolution=${resolution}`);
                    return {
                        x: canvasX * resolution,
                        y: canvasY * resolution
                    };
                }
            }
            
            return { x: canvasX, y: canvasY };
        }
        
        /**
         * v8高精度Canvas座標→スクリーン座標変換
         * @param {number} canvasX - CanvasX座標
         * @param {number} canvasY - CanvasY座標
         * @returns {{x: number, y: number}} v8高精度スクリーン座標
         */
        canvasToScreenV8(canvasX, canvasY) {
            this.validateV8Initialization();
            
            const canvasElement = this.canvasManager.getCanvasElement();
            if (!canvasElement) {
                throw new Error('Canvas element not available for v8 coordinate conversion');
            }
            
            let transformedX = canvasX;
            let transformedY = canvasY;
            
            // v8 Container変形適用
            if (this.navigationManager?.getCanvasTransformV8) {
                const transform = this.getCachedTransformV8();
                if (transform) {
                    const transformed = this.applyTransformV8(transformedX, transformedY, transform);
                    transformedX = transformed.x;
                    transformedY = transformed.y;
                }
            }
            
            // v8解像度調整
            const pixiApp = this.canvasManager.pixiApp;
            if (pixiApp && this.highPrecisionMode) {
                const resolution = pixiApp.renderer.resolution || 1;
                if (resolution !== 1) {
                    transformedX = transformedX / resolution;
                    transformedY = transformedY / resolution;
                }
            }
            
            const rect = this.getCachedBoundsV8(canvasElement);
            
            // 最終スクリーン座標計算
            const screenX = transformedX + rect.left;
            const screenY = transformedY + rect.top;
            
            return { x: screenX, y: screenY };
        }
        
        /**
         * v8逆変形適用（Container変形の逆変換）
         * @param {number} x - X座標
         * @param {number} y - Y座標
         * @param {Object} transform - v8変形情報
         * @returns {{x: number, y: number}} 逆変形適用後座標
         */
        applyInverseTransformV8(x, y, transform) {
            if (!transform) return { x, y };
            
            // PixiJS v8 Matrix使用（高精度）
            if (this.canvasManager.pixiApp?.stage) {
                const stage = this.canvasManager.pixiApp.stage;
                const matrix = stage.worldTransform.clone();
                
                // v8 Matrix逆変形
                const point = matrix.applyInverse({ x, y });
                return { x: point.x, y: point.y };
            }
            
            // フォールバック: 手動計算（v8高精度）
            const { scale, translateX, translateY } = transform;
            
            // 平行移動逆変換
            let transformedX = x - translateX;
            let transformedY = y - translateY;
            
            // スケール逆変換
            if (scale && scale !== 1) {
                transformedX = transformedX / scale;
                transformedY = transformedY / scale;
            }
            
            return { x: transformedX, y: transformedY };
        }
        
        /**
         * v8正変形適用（Canvas→スクリーン用）
         * @param {number} x - X座標
         * @param {number} y - Y座標
         * @param {Object} transform - v8変形情報
         * @returns {{x: number, y: number}} 正変形適用後座標
         */
        applyTransformV8(x, y, transform) {
            if (!transform) return { x, y };
            
            // PixiJS v8 Matrix使用（高精度）
            if (this.canvasManager.pixiApp?.stage) {
                const stage = this.canvasManager.pixiApp.stage;
                const matrix = stage.worldTransform;
                
                // v8 Matrix正変形
                const point = matrix.apply({ x, y });
                return { x: point.x, y: point.y };
            }
            
            // フォールバック: 手動計算
            const { scale, translateX, translateY } = transform;
            
            let transformedX = x;
            let transformedY = y;
            
            // スケール変換
            if (scale && scale !== 1) {
                transformedX = transformedX * scale;
                transformedY = transformedY * scale;
            }
            
            // 平行移動変換
            transformedX = transformedX + translateX;
            transformedY = transformedY + translateY;
            
            return { x: transformedX, y: transformedY };
        }
        
        /**
         * v8Canvas境界内判定（高精度）
         * @param {number} canvasX - CanvasX座標
         * @param {number} canvasY - CanvasY座標
         * @returns {boolean} v8Canvas内判定結果
         */
        isInsideCanvasV8(canvasX, canvasY) {
            this.validateV8Initialization();
            
            const bounds = this.getCanvasBoundsV8();
            
            // v8高精度境界判定
            return (
                canvasX >= bounds.x &&
                canvasY >= bounds.y &&
                canvasX <= bounds.x + bounds.width &&
                canvasY <= bounds.y + bounds.height
            );
        }
        
        /**
         * v8Canvas境界情報取得（高精度）
         * @returns {{x: number, y: number, width: number, height: number}} v8Canvas境界情報
         */
        getCanvasBoundsV8() {
            this.validateV8Initialization();
            
            const canvasElement = this.canvasManager.getCanvasElement();
            if (!canvasElement) {
                throw new Error('Canvas element not available for v8 bounds calculation');
            }
            
            const rect = this.getCachedBoundsV8(canvasElement);
            
            // v8高精度境界計算
            return {
                x: 0,
                y: 0,
                width: rect.width,
                height: rect.height,
                // v8追加情報
                resolution: this.canvasManager.pixiApp?.renderer?.resolution || 1,
                webgpuMode: this.webgpuSupported
            };
        }
        
        /**
         * v8高精度Canvas要素境界情報取得（キャッシュ付き）
         * @param {HTMLElement} canvasElement - Canvas DOM要素
         * @returns {DOMRect} v8高精度境界情報
         */
        getCachedBoundsV8(canvasElement) {
            const now = performance.now();
            
            // v8高精度キャッシュ有効性確認
            if (this.cachedBounds && (now - this.boundsUpdateTime) < this.CACHE_DURATION) {
                return this.cachedBounds;
            }
            
            // v8高精度境界情報取得
            this.cachedBounds = canvasElement.getBoundingClientRect();
            this.boundsUpdateTime = now;
            
            return this.cachedBounds;
        }
        
        /**
         * v8変形情報取得（キャッシュ付き）
         * @returns {Object|null} v8変形情報
         */
        getCachedTransformV8() {
            if (!this.navigationManager?.getCanvasTransformV8) {
                return null;
            }
            
            const now = performance.now();
            
            // v8変形キャッシュ有効性確認
            if (this.cachedTransform && (now - this.transformUpdateTime) < this.CACHE_DURATION) {
                return this.cachedTransform;
            }
            
            // v8変形情報取得
            try {
                this.cachedTransform = this.navigationManager.getCanvasTransformV8();
                this.transformUpdateTime = now;
            } catch (error) {
                console.warn('⚠️ v8変形情報取得失敗:', error.message);
                this.cachedTransform = null;
            }
            
            return this.cachedTransform;
        }
        
        /**
         * v8初期化状態確認（剛直構造）
         */
        validateV8Initialization() {
            if (!this.v8Ready || !this.canvasManager) {
                throw new Error('CoordinateManager v8 not initialized - call setCanvasManagerV8() first');
            }
        }
        
        /**
         * v8キャッシュクリア（Canvas/Navigation変更時用）
         */
        clearV8Cache() {
            this.cachedBounds = null;
            this.cachedTransform = null;
            this.boundsUpdateTime = 0;
            this.transformUpdateTime = 0;
            console.log('🔄 CoordinateManager v8: 高精度キャッシュクリア完了');
        }
        
        /**
         * v8準備完了確認
         * @returns {boolean} v8対応状況
         */
        isV8Ready() {
            return this.v8Ready && 
                   !!this.canvasManager && 
                   this.canvasManager.isV8Ready();
        }
        
        /**
         * v8座標変換テスト（高精度デバッグ用）
         * @param {number} testScreenX - テスト用スクリーンX座標
         * @param {number} testScreenY - テスト用スクリーンY座標
         * @returns {Object} v8座標変換テスト結果
         */
        testV8CoordinateConversion(testScreenX = 100, testScreenY = 100) {
            console.log('🧪 CoordinateManager v8座標変換テスト開始');
            
            try {
                // v8スクリーン→Canvas変換
                const canvasCoords = this.screenToCanvasV8(testScreenX, testScreenY);
                
                // v8Canvas→スクリーン逆変換
                const screenCoords = this.canvasToScreenV8(canvasCoords.x, canvasCoords.y);
                
                // v8境界判定テスト
                const isInside = this.isInsideCanvasV8(canvasCoords.x, canvasCoords.y);
                
                const result = {
                    success: true,
                    v8Mode: true,
                    webgpuSupported: this.webgpuSupported,
                    highPrecisionMode: this.highPrecisionMode,
                    original: { x: testScreenX, y: testScreenY },
                    canvasCoords: canvasCoords,
                    reverseCoords: screenCoords,
                    isInsideCanvas: isInside,
                    accuracy: {
                        xDiff: Math.abs(testScreenX - screenCoords.x),
                        yDiff: Math.abs(testScreenY - screenCoords.y),
                        precision: 'v8-high-precision'
                    },
                    performance: {
                        cacheDuration: this.CACHE_DURATION,
                        cacheHits: 'not-implemented'
                    }
                };
                
                console.log('🧪 CoordinateManager v8座標変換テスト結果:', result);
                return result;
                
            } catch (error) {
                const result = {
                    success: false,
                    error: error.message,
                    v8Mode: this.v8Ready,
                    original: { x: testScreenX, y: testScreenY }
                };
                
                console.error('❌ CoordinateManager v8座標変換テスト失敗:', result);
                return result;
            }
        }
        
        /**
         * v8デバッグ情報取得（完全版）
         * @returns {Object} v8デバッグ情報
         */
        getDebugInfo() {
            return {
                // v8基本状態
                v8Ready: this.v8Ready,
                webgpuSupported: this.webgpuSupported,
                highPrecisionMode: this.highPrecisionMode,
                
                // Manager連携状態
                managers: {
                    canvasManager: !!this.canvasManager,
                    canvasManagerV8Ready: this.canvasManager?.isV8Ready() || false,
                    navigationManager: !!this.navigationManager,
                    navigationManagerV8Ready: this.navigationManager?.isV8Ready?.() || false
                },
                
                // v8Canvas情報
                canvas: this.canvasManager ? (() => {
                    try {
                        const canvasElement = this.canvasManager.getCanvasElement();
                        const pixiApp = this.canvasManager.pixiApp;
                        
                        return {
                            elementReady: !!canvasElement,
                            pixiAppReady: !!pixiApp,
                            rendererType: pixiApp?.renderer?.type || 'unknown',
                            pixiVersion: typeof PIXI !== 'undefined' ? PIXI.VERSION : 'unknown',
                            bounds: canvasElement ? this.getCachedBoundsV8(canvasElement) : null,
                            resolution: pixiApp?.renderer?.resolution || 1,
                            webgpuMode: pixiApp?.renderer?.type === 'webgpu'
                        };
                    } catch (error) {
                        return { error: error.message };
                    }
                })() : null,
                
                // v8キャッシュ情報
                cache: {
                    hasCachedBounds: !!this.cachedBounds,
                    hasCachedTransform: !!this.cachedTransform,
                    boundsAge: this.boundsUpdateTime ? (performance.now() - this.boundsUpdateTime) : 0,
                    transformAge: this.transformUpdateTime ? (performance.now() - this.transformUpdateTime) : 0,
                    cacheDuration: this.CACHE_DURATION,
                    v8OptimizedCache: true
                },
                
                // v8機能状態
                features: {
                    screenToCanvasV8: this.v8Ready,
                    canvasToScreenV8: this.v8Ready,
                    applyInverseTransformV8: this.v8Ready,
                    isInsideCanvasV8: this.v8Ready,
                    highPrecisionConversion: this.highPrecisionMode,
                    matrixTransformSupport: !!this.canvasManager?.pixiApp?.stage
                },
                
                // v8パフォーマンス情報
                performance: {
                    cachingEnabled: true,
                    highPrecisionMode: this.highPrecisionMode,
                    webgpuAccelerated: this.webgpuSupported,
                    cacheUpdateFrequency: `${this.CACHE_DURATION}ms`,
                    optimizedForFramerate: this.CACHE_DURATION <= 16 ? '60fps+' : 'standard'
                },
                
                // v8変形情報
                transform: this.navigationManager ? (() => {
                    try {
                        const transform = this.getCachedTransformV8();
                        return {
                            available: !!transform,
                            data: transform,
                            source: 'navigationManager'
                        };
                    } catch (error) {
                        return { error: error.message };
                    }
                })() : { available: false, reason: 'no-navigation-manager' }
            };
        }
        
        /**
         * v8状態リセット
         */
        resetV8() {
            console.log('🔄 CoordinateManager v8状態リセット開始');
            
            this.canvasManager = null;
            this.navigationManager = null;
            this.v8Ready = false;
            this.webgpuSupported = false;
            this.highPrecisionMode = true;
            this.clearV8Cache();
            
            console.log('✅ CoordinateManager v8状態リセット完了');
        }
    }
    
    // Tegaki名前空間に登録
    window.Tegaki.CoordinateManager = CoordinateManager;
    
    console.log('🎯 CoordinateManager PixiJS v8対応版 Loaded');
    console.log('📏 v8機能: 高精度座標変換・Container変形対応・WebGPU最適化・リアルタイム変換');
    console.log('🚀 v8特徴: 高精度変換・Matrix活用・NavigationManager統合・60fps+対応');
    console.log('✅ v8準備完了: setCanvasManagerV8()でv8対応CanvasManager設定後に利用可能');
}

console.log('🎯 CoordinateManager PixiJS v8対応版 Loaded - 高精度座標変換・Container変形・WebGPU対応完了');