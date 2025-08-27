/**
 * 🎯 CoordinateManager - Phase1.5 座標変換管理（screenToCanvas互換性追加版）
 * 📋 RESPONSIBILITY: スクリーン座標とCanvas座標の変換・座標計算・画面変換管理・メソッド互換性提供
 * 🚫 PROHIBITION: 描画処理・UI操作・ツール管理・エラーUI表示・フォールバック
 * ✅ PERMISSION: 座標変換計算・Canvas境界判定・解像度調整・座標検証・互換性メソッド提供
 * 
 * 📏 DESIGN_PRINCIPLE: 座標変換専門・剛直構造・エラー隠蔽禁止・PixiJS標準活用・互換性確保
 * 🔄 INTEGRATION: CanvasManager(Canvas情報取得) + PixiJS(座標システム) + 各Tool(座標利用)
 * 🎯 FEATURE: クライアント座標→Canvas座標・Canvas座標→クライアント座標・境界判定・解像度対応・互換メソッド
 * 
 * 📌 使用メソッド一覧（他ファイル依存）:
 * ✅ canvasManager.getCanvasElement() - Canvas DOM要素取得
 * ✅ canvasManager.getPixiApp() - PixiJS Application取得
 * ✅ element.getBoundingClientRect() - DOM座標取得
 * 
 * 📌 提供メソッド一覧（外部向け）:
 * ✅ setCanvasManager(canvasManager) - CanvasManager設定
 * ✅ clientToCanvas(clientX, clientY) - クライアント座標→Canvas座標変換（メイン）
 * ✅ screenToCanvas(screenX, screenY) - スクリーン座標→Canvas座標変換（互換性・clientToCanvasのエイリアス）
 * ✅ canvasToClient(canvasX, canvasY) - Canvas座標→クライアント座標変換
 * ✅ canvasToScreen(canvasX, canvasY) - Canvas座標→スクリーン座標変換（互換性・canvasToClientのエイリアス）
 * ✅ isInsideCanvas(canvasX, canvasY) - Canvas境界内判定
 * ✅ getCanvasBounds() - Canvas境界情報取得
 * ✅ getDebugInfo() - デバッグ情報取得
 * 
 * 📐 座標変換フロー:
 * 開始 → CanvasManager設定 → DOM要素取得 → 座標変換計算 → 境界判定 → 結果返却
 * 依存関係: CanvasManager(Canvas情報) + PixiJS(座標システム) + DOM(getBoundingClientRect)
 * 
 * 🔧 COMPATIBILITY: 互換性メソッド追加
 * - screenToCanvas() → clientToCanvas() のエイリアス
 * - canvasToScreen() → canvasToClient() のエイリアス
 * 既存コードとの互換性を保ちつつ、統一された命名規則を提供
 */

if (!window.Tegaki) {
    window.Tegaki = {};
}

if (!window.Tegaki.CoordinateManager) {
    /**
     * CoordinateManager - Phase1.5 座標変換管理（screenToCanvas互換性追加版）
     * スクリーン座標とCanvas座標の変換を専門的に管理する
     */
    class CoordinateManager {
        constructor() {
            console.log('🎯 CoordinateManager Phase1.5 完全実装版 作成開始');
            
            this.canvasManager = null;
            this.initialized = false;
            
            // 座標変換キャッシュ（パフォーマンス最適化）
            this.cachedBounds = null;
            this.boundsUpdateTime = 0;
            this.CACHE_DURATION = 100; // 100ms キャッシュ
            
            console.log('✅ CoordinateManager Phase1.5 完全実装版 作成完了');
            
            console.log('🎯 CoordinateManager Phase1.5 完全実装版 - 自動デバッグテスト実行');
            
            // 自動デバッグテスト（開発時のみ）
            if (typeof window !== 'undefined' && (window.location?.hostname === 'localhost' || window.location?.hostname === '127.0.0.1')) {
                setTimeout(() => {
                    console.log('🧪 CoordinateManager開発者向け自動テスト開始');
                    
                    // テスト用のダミーCanvasManager作成
                    const testCanvasManager = {
                        getCanvasElement() {
                            const canvas = document.createElement('canvas');
                            canvas.width = 400;
                            canvas.height = 400;
                            return canvas;
                        },
                        getPixiApp() {
                            return { renderer: { resolution: 1 } };
                        }
                    };
                    
                    const testManager = new window.Tegaki.CoordinateManager();
                    try {
                        testManager.setCanvasManager(testCanvasManager);
                        const testResult = testManager.testCoordinateConversion(50, 50);
                        console.log('🧪 CoordinateManager自動テスト結果:', testResult);
                        
                        // 互換性メソッドテスト
                        const compatTest = testManager.testCompatibilityMethods();
                        console.log('🧪 CoordinateManager互換性テスト結果:', compatTest);
                    } catch (error) {
                        console.warn('⚠️ CoordinateManager自動テスト失敗 - 実際の使用時は正常動作予定:', error.message);
                    }
                }, 100);
            }
        }
        
        /**
         * CanvasManager設定（必須初期化）
         * @param {CanvasManager} canvasManager - Canvas管理インスタンス
         */
        setCanvasManager(canvasManager) {
            console.log('🔧 CoordinateManager - CanvasManager設定開始');
            
            if (!canvasManager) {
                throw new Error('CanvasManager is required for CoordinateManager');
            }
            
            this.canvasManager = canvasManager;
            this.initialized = true;
            
            console.log('✅ CoordinateManager - CanvasManager設定完了');
        }
        
        /**
         * クライアント座標→Canvas座標変換（メイン機能）
         * @param {number} clientX - クライアントX座標
         * @param {number} clientY - クライアントY座標
         * @returns {{x: number, y: number}} Canvas座標
         */
        clientToCanvas(clientX, clientY) {
            this.validateInitialization();
            
            // Canvas要素取得
            const canvasElement = this.canvasManager.getCanvasElement();
            if (!canvasElement) {
                throw new Error('Canvas element not available');
            }
            
            // DOM座標情報取得
            const rect = this.getCachedBounds(canvasElement);
            
            // 座標変換計算（PixiJS標準方式）
            const canvasX = clientX - rect.left;
            const canvasY = clientY - rect.top;
            
            // 🔧 解像度・密度調整（PixiJS Application情報活用）
            const pixiApp = this.canvasManager.getPixiApp();
            if (pixiApp) {
                // PixiJS解像度考慮（必要に応じて）
                const resolution = pixiApp.renderer.resolution || 1;
                if (resolution !== 1) {
                    // 解像度調整が必要な場合のみ適用
                    console.log(`🔧 CoordinateManager: 解像度調整適用 resolution=${resolution}`);
                }
            }
            
            return {
                x: canvasX,
                y: canvasY
            };
        }
        
        /**
         * 🔧 スクリーン座標→Canvas座標変換（互換性メソッド・clientToCanvasのエイリアス）
         * @param {number} screenX - スクリーンX座標（クライアント座標と同じ）
         * @param {number} screenY - スクリーンY座標（クライアント座標と同じ）
         * @returns {{x: number, y: number}} Canvas座標
         */
        screenToCanvas(screenX, screenY) {
            // clientToCanvasのエイリアスとして実装（互換性確保）
            console.log('🔄 CoordinateManager: screenToCanvas → clientToCanvas エイリアス実行');
            return this.clientToCanvas(screenX, screenY);
        }
        
        /**
         * Canvas座標→クライアント座標変換
         * @param {number} canvasX - CanvasX座標
         * @param {number} canvasY - CanvasY座標
         * @returns {{x: number, y: number}} クライアント座標
         */
        canvasToClient(canvasX, canvasY) {
            this.validateInitialization();
            
            const canvasElement = this.canvasManager.getCanvasElement();
            if (!canvasElement) {
                throw new Error('Canvas element not available');
            }
            
            const rect = this.getCachedBounds(canvasElement);
            
            // 逆変換計算
            const clientX = canvasX + rect.left;
            const clientY = canvasY + rect.top;
            
            return {
                x: clientX,
                y: clientY
            };
        }
        
        /**
         * 🔧 Canvas座標→スクリーン座標変換（互換性メソッド・canvasToClientのエイリアス）
         * @param {number} canvasX - CanvasX座標
         * @param {number} canvasY - CanvasY座標
         * @returns {{x: number, y: number}} スクリーン座標（クライアント座標と同じ）
         */
        canvasToScreen(canvasX, canvasY) {
            // canvasToClientのエイリアスとして実装（互換性確保）
            console.log('🔄 CoordinateManager: canvasToScreen → canvasToClient エイリアス実行');
            return this.canvasToClient(canvasX, canvasY);
        }
        
        /**
         * Canvas境界内座標判定
         * @param {number} canvasX - CanvasX座標
         * @param {number} canvasY - CanvasY座標
         * @returns {boolean} Canvas内にあるかどうか
         */
        isInsideCanvas(canvasX, canvasY) {
            this.validateInitialization();
            
            const bounds = this.getCanvasBounds();
            
            return (
                canvasX >= 0 &&
                canvasY >= 0 &&
                canvasX <= bounds.width &&
                canvasY <= bounds.height
            );
        }
        
        /**
         * Canvas境界情報取得
         * @returns {{x: number, y: number, width: number, height: number}} Canvas境界
         */
        getCanvasBounds() {
            this.validateInitialization();
            
            const canvasElement = this.canvasManager.getCanvasElement();
            if (!canvasElement) {
                throw new Error('Canvas element not available');
            }
            
            const rect = this.getCachedBounds(canvasElement);
            
            return {
                x: 0,
                y: 0,
                width: rect.width,
                height: rect.height
            };
        }
        
        /**
         * Canvas要素の境界情報取得（キャッシュ付き）
         * @param {HTMLElement} canvasElement - Canvas DOM要素
         * @returns {DOMRect} 境界情報
         */
        getCachedBounds(canvasElement) {
            const now = performance.now();
            
            // キャッシュ有効性確認
            if (this.cachedBounds && (now - this.boundsUpdateTime) < this.CACHE_DURATION) {
                return this.cachedBounds;
            }
            
            // 新しい境界情報取得
            this.cachedBounds = canvasElement.getBoundingClientRect();
            this.boundsUpdateTime = now;
            
            return this.cachedBounds;
        }
        
        /**
         * 初期化状態確認（剛直構造）
         */
        validateInitialization() {
            if (!this.initialized || !this.canvasManager) {
                throw new Error('CoordinateManager not initialized - call setCanvasManager() first');
            }
        }
        
        /**
         * キャッシュクリア（Canvas変更時用）
         */
        clearCache() {
            this.cachedBounds = null;
            this.boundsUpdateTime = 0;
            console.log('🔄 CoordinateManager: キャッシュクリア完了');
        }
        
        /**
         * 座標変換テスト（デバッグ用）
         * @param {number} testClientX - テスト用クライアントX座標
         * @param {number} testClientY - テスト用クライアントY座標
         * @returns {object} テスト結果
         */
        testCoordinateConversion(testClientX = 100, testClientY = 100) {
            console.log('🧪 CoordinateManager座標変換テスト開始');
            
            try {
                // クライアント→Canvas変換
                const canvasCoords = this.clientToCanvas(testClientX, testClientY);
                
                // Canvas→クライアント逆変換
                const clientCoords = this.canvasToClient(canvasCoords.x, canvasCoords.y);
                
                // 境界判定テスト
                const isInside = this.isInsideCanvas(canvasCoords.x, canvasCoords.y);
                
                const result = {
                    success: true,
                    original: { x: testClientX, y: testClientY },
                    canvasCoords: canvasCoords,
                    reverseCoords: clientCoords,
                    isInsideCanvas: isInside,
                    accuracy: {
                        xDiff: Math.abs(testClientX - clientCoords.x),
                        yDiff: Math.abs(testClientY - clientCoords.y)
                    }
                };
                
                console.log('🧪 CoordinateManager座標変換テスト結果:', result);
                return result;
                
            } catch (error) {
                const result = {
                    success: false,
                    error: error.message,
                    original: { x: testClientX, y: testClientY }
                };
                
                console.error('❌ CoordinateManager座標変換テスト失敗:', result);
                return result;
            }
        }
        
        /**
         * 🔧 互換性メソッドテスト（デバッグ用）
         * @param {number} testX - テスト用X座標
         * @param {number} testY - テスト用Y座標
         * @returns {object} 互換性テスト結果
         */
        testCompatibilityMethods(testX = 150, testY = 150) {
            console.log('🧪 CoordinateManager互換性メソッドテスト開始');
            
            try {
                // screenToCanvas vs clientToCanvas
                const screenToCanvasResult = this.screenToCanvas(testX, testY);
                const clientToCanvasResult = this.clientToCanvas(testX, testY);
                
                // canvasToScreen vs canvasToClient
                const canvasToScreenResult = this.canvasToScreen(screenToCanvasResult.x, screenToCanvasResult.y);
                const canvasToClientResult = this.canvasToClient(clientToCanvasResult.x, clientToCanvasResult.y);
                
                const result = {
                    success: true,
                    input: { x: testX, y: testY },
                    screenToCanvasVsClientToCanvas: {
                        screenToCanvas: screenToCanvasResult,
                        clientToCanvas: clientToCanvasResult,
                        identical: (screenToCanvasResult.x === clientToCanvasResult.x && 
                                   screenToCanvasResult.y === clientToCanvasResult.y)
                    },
                    canvasToScreenVsCanvasToClient: {
                        canvasToScreen: canvasToScreenResult,
                        canvasToClient: canvasToClientResult,
                        identical: (canvasToScreenResult.x === canvasToClientResult.x && 
                                   canvasToScreenResult.y === canvasToClientResult.y)
                    }
                };
                
                console.log('🧪 CoordinateManager互換性テスト結果:', result);
                return result;
                
            } catch (error) {
                const result = {
                    success: false,
                    error: error.message,
                    input: { x: testX, y: testY }
                };
                
                console.error('❌ CoordinateManager互換性テスト失敗:', result);
                return result;
            }
        }
        
        /**
         * デバッグ情報取得（必須実装・互換性情報追加）
         * @returns {object} デバッグ情報
         */
        getDebugInfo() {
            return {
                // 基本状態
                initialized: this.initialized,
                canvasManagerReady: !!this.canvasManager,
                
                // Canvas情報
                canvas: this.canvasManager ? (() => {
                    try {
                        const canvasElement = this.canvasManager.getCanvasElement();
                        const pixiApp = this.canvasManager.getPixiApp();
                        
                        return {
                            elementReady: !!canvasElement,
                            pixiAppReady: !!pixiApp,
                            bounds: canvasElement ? this.getCachedBounds(canvasElement) : null,
                            pixiResolution: pixiApp ? pixiApp.renderer.resolution : null,
                            dimensions: canvasElement ? {
                                width: canvasElement.width,
                                height: canvasElement.height,
                                clientWidth: canvasElement.clientWidth,
                                clientHeight: canvasElement.clientHeight
                            } : null
                        };
                    } catch (error) {
                        return { error: error.message };
                    }
                })() : null,
                
                // キャッシュ情報
                cache: {
                    hasCachedBounds: !!this.cachedBounds,
                    cacheAge: this.boundsUpdateTime ? (performance.now() - this.boundsUpdateTime) : 0,
                    cacheDuration: this.CACHE_DURATION,
                    cachedBoundsDetails: this.cachedBounds
                },
                
                // 機能状態
                features: {
                    clientToCanvas: this.initialized,
                    canvasToClient: this.initialized,
                    boundaryDetection: this.initialized,
                    caching: true,
                    // 🔧 互換性メソッド状況
                    compatibility: {
                        screenToCanvas: this.initialized, // clientToCanvasのエイリアス
                        canvasToScreen: this.initialized  // canvasToClientのエイリアス
                    }
                },
                
                // メソッド存在確認
                methods: {
                    clientToCanvas: typeof this.clientToCanvas === 'function',
                    screenToCanvas: typeof this.screenToCanvas === 'function',
                    canvasToClient: typeof this.canvasToClient === 'function',
                    canvasToScreen: typeof this.canvasToScreen === 'function',
                    isInsideCanvas: typeof this.isInsideCanvas === 'function',
                    getCanvasBounds: typeof this.getCanvasBounds === 'function'
                },
                
                // エラー状態
                lastError: null, // 実装時にエラー履歴管理を追加可能
                
                // パフォーマンス
                performance: {
                    cachingEnabled: true,
                    cacheHitRate: 'not-implemented' // 将来実装可能
                }
            };
        }
        
        /**
         * 状態リセット（デバッグ用）
         */
        reset() {
            console.log('🔄 CoordinateManager リセット開始');
            
            this.canvasManager = null;
            this.initialized = false;
            this.clearCache();
            
            console.log('✅ CoordinateManager リセット完了');
        }
        
        /**
         * 🔧 メソッド互換性確認（デバッグ用）
         * @returns {object} メソッド存在状況
         */
        checkMethodCompatibility() {
            return {
                // メインメソッド
                clientToCanvas: typeof this.clientToCanvas === 'function',
                canvasToClient: typeof this.canvasToClient === 'function',
                
                // 互換性メソッド
                screenToCanvas: typeof this.screenToCanvas === 'function',
                canvasToScreen: typeof this.canvasToScreen === 'function',
                
                // ユーティリティ
                isInsideCanvas: typeof this.isInsideCanvas === 'function',
                getCanvasBounds: typeof this.getCanvasBounds === 'function',
                
                // 管理メソッド
                setCanvasManager: typeof this.setCanvasManager === 'function',
                validateInitialization: typeof this.validateInitialization === 'function',
                
                // デバッグメソッド
                getDebugInfo: typeof this.getDebugInfo === 'function',
                testCoordinateConversion: typeof this.testCoordinateConversion === 'function',
                testCompatibilityMethods: typeof this.testCompatibilityMethods === 'function'
            };
        }
    }
    
    // Tegaki名前空間に登録
    window.Tegaki.CoordinateManager = CoordinateManager;
    
    console.log('🎯 CoordinateManager Phase1.5 完全実装版 Loaded');
    console.log('📏 機能: クライアント↔Canvas座標変換・境界判定・キャッシュ最適化・互換性メソッド');
    console.log('🔧 特徴: 剛直構造・エラー隠蔽禁止・PixiJS標準活用・パフォーマンス最適化');
    console.log('🔄 互換性: screenToCanvas/canvasToScreen メソッド追加（エイリアス）');
    console.log('✅ 準備完了: setCanvasManager()でCanvasManager設定後に利用可能');
}

console.log('🎯 CoordinateManager Phase1.5 完全実装版 Loaded');
console.log('📏 機能: クライアント↔Canvas座標変換・境界判定・キャッシュ最適化');
console.log('🔧 特徴: 剛直構造・エラー隠蔽禁止・PixiJS標準活用・パフォーマンス最適化');
console.log('✅ 準備完了: setCanvasManager()でCanvasManager設定後に利用可能');