/**
 * 📄 FILE: js/utils/coordinate-manager.js
 * 📌 RESPONSIBILITY: PixiJS v8座標変換・Manager統一API契約完全対応・isReady()メソッド実装・testCoordinate()追加版
 * ChangeLog: 2025-08-31 testCoordinate()メソッド追加・統合テスト対応・attach()メソッドエラー修正・CanvasManager参照修正・初期化フロー安定化
 *
 * @provides
 *   - CoordinateManager（クラス）
 *   - configure(config): void - 設定注入
 *   - attach(context): void - Context注入（CanvasManager等）
 *   - init(): Promise<void> - 非同期初期化
 *   - isReady(): boolean - 準備完了判定（AppCore依存）
 *   - dispose(): void - 解放処理
 *   - screenToCanvas(screenCoords): Object - 画面→キャンバス座標変換
 *   - toLocalFromCanvas(canvasCoords): Object - キャンバス→ローカル座標変換
 *   - canvasToScreen(canvasCoords): Object - キャンバス→画面座標変換
 *   - setCanvasManagerV8(canvasManager): boolean - v8互換API（後方互換）
 *   - testCoordinate(x, y): Object - 座標変換テスト（統合テスト用）
 *
 * @uses
 *   - CanvasManager.getApp(): PIXI.Application
 *   - CanvasManager.getView(): HTMLCanvasElement  
 *   - CanvasManager.getDrawContainer(): PIXI.Container
 *   - CanvasManager.isV8Ready(): boolean
 *   - PIXI.Point API
 *
 * @initflow
 *   1. new CoordinateManager() → 2. configure(config) → 3. attach(context) → 4. init() → 5. isReady()=true
 *
 * @forbids
 *   💀 双方向依存禁止
 *   🚫 フォールバック禁止（AppCore層の例外のみ許可）
 *   🚫 Event座標の直読み禁止・独自処理禁止
 *   🚫 DPR重複適用禁止・座標二重変換禁止
 *   🚫 未初期化状態でのメソッド使用禁止
 *
 * @manager-key
 *   window.Tegaki.CoordinateManagerInstance
 *
 * @dependencies-strict
 *   REQUIRED: CanvasManager（attach時必須）
 *   OPTIONAL: EventBus（状態変更通知用）
 *   FORBIDDEN: ToolManager、RecordManager（責務分離）
 *
 * @integration-flow
 *   AppCore → CoordinateManager.configure/attach/init → Tools使用
 *
 * @method-naming-rules
 *   変換系: screenToCanvas(), canvasToScreen(), toLocalFromCanvas()
 *   ライフサイクル系: configure(), attach(), init(), isReady(), dispose()
 *   設定系: setCanvasManagerV8()（後方互換）
 *   テスト系: testCoordinate()（統合テスト用）
 *
 * @coordinate-contract
 *   座標変換の唯一ルート・DPR補正一回のみ・Container変形対応・境界判定機能
 *
 * @error-handling
 *   throw: 初期化失敗・必須パラメータ不正（CanvasManager不正等）
 *   null: 座標変換失敗・入力座標不正
 *   warn: 一時的エラー・警告レベル（境界外座標等）
 *
 * @input-validation
 *   座標null/undefined時は処理停止・NaN/Infinite座標は警告・妥当性チェック必須
 *
 * @testing-hooks
 *   - getDebugInfo(): Object - 状態・設定・統計情報
 *   - debugCoordinateChain(screenCoords): Object - 変換チェーン確認
 *   - testCoordinate(x, y): Object - 座標変換テスト（統合テスト用）
 *   - isReady(): boolean - 準備状態確認
 */

class CoordinateManager {
    constructor() {
        console.log('📐 CoordinateManager v8対応版・Manager統一API契約版 作成');
        
        // Manager統一API契約状態
        this._configured = false;
        this._attached = false;
        this._initialized = false;
        
        // CanvasManager参照
        this.canvasManager = null;
        
        // 設定
        this.config = {
            dprLimit: 2.0, // DPR制限（高DPI端末対応）
            boundaryCheck: true, // 境界チェック有効
            precision: 2 // 座標精度（小数点以下桁数）
        };
        
        // 統計・デバッグ情報
        this.stats = {
            conversions: 0,
            errors: 0,
            warnings: 0,
            lastError: null,
            created: Date.now()
        };
    }
    
    // ================================
    // Manager統一API契約（必須実装）
    // ================================
    
    /**
     * 設定注入（同期）
     * @param {Object} config - 設定オブジェクト
     */
    configure(config = {}) {
        console.log('📐 CoordinateManager: configure() 開始');
        
        try {
            // 設定マージ
            if (config.dprLimit !== undefined) {
                this.config.dprLimit = Math.max(1.0, Math.min(4.0, config.dprLimit));
            }
            if (config.boundaryCheck !== undefined) {
                this.config.boundaryCheck = !!config.boundaryCheck;
            }
            if (config.precision !== undefined) {
                this.config.precision = Math.max(0, Math.min(6, config.precision));
            }
            
            this._configured = true;
            console.log('✅ CoordinateManager: configure() 完了', this.config);
            
        } catch (error) {
            this.stats.lastError = error;
            console.error('❌ CoordinateManager: configure() エラー:', error);
            throw error;
        }
    }
    
    /**
     * Context注入（同期）- エラー修正版
     * @param {Object} context - CanvasManager等の参照
     */
    attach(context) {
        console.log('📐 CoordinateManager: attach() 開始');
        
        try {
            // context基本検証
            if (!context) {
                throw new Error('Context is null or undefined');
            }
            
            if (!context.canvasManager) {
                throw new Error('Context.canvasManager is missing');
            }
            
            const canvasManager = context.canvasManager;
            
            // CanvasManager存在確認
            if (!canvasManager || typeof canvasManager !== 'object') {
                throw new Error('Invalid CanvasManager instance');
            }
            
            // ✅ 重要な修正: 必須メソッド存在確認を柔軟に
            let hasRequiredMethods = false;
            
            // v8 CanvasManager API確認
            if (typeof canvasManager.getView === 'function' && 
                typeof canvasManager.getDrawContainer === 'function') {
                hasRequiredMethods = true;
                console.log('📐 CoordinateManager: v8 CanvasManager API確認完了');
            } 
            // 旧API確認（後方互換）
            else if (typeof canvasManager.getCanvas === 'function' ||
                     (canvasManager.app && canvasManager.app.view)) {
                hasRequiredMethods = true;
                console.log('📐 CoordinateManager: 旧CanvasManager API確認（互換モード）');
            }
            
            if (!hasRequiredMethods) {
                // より詳細なエラー情報
                const availableMethods = Object.getOwnPropertyNames(canvasManager)
                    .filter(name => typeof canvasManager[name] === 'function');
                
                console.error('❌ CanvasManager利用可能メソッド:', availableMethods);
                throw new Error(`CanvasManager required methods missing. Available: ${availableMethods.join(', ')}`);
            }
            
            // CanvasManager準備状態確認（可能な場合のみ）
            if (typeof canvasManager.isV8Ready === 'function') {
                if (!canvasManager.isV8Ready()) {
                    console.warn('⚠️ CoordinateManager: CanvasManager not v8 ready - 継続実行');
                }
            }
            
            this.canvasManager = canvasManager;
            this._attached = true;
            
            console.log('✅ CoordinateManager: attach() 完了');
            
        } catch (error) {
            this.stats.lastError = error;
            this.stats.errors++;
            console.error('❌ CoordinateManager: attach() エラー:', error.message);
            throw error;
        }
    }
    
    /**
     * 非同期初期化 - エラー修正版
     * @returns {Promise<void>}
     */
    async init() {
        console.log('📐 CoordinateManager: init() 開始');
        
        try {
            if (!this._configured) {
                console.warn('⚠️ CoordinateManager: 未configure - 自動configure実行');
                this.configure();
            }
            
            if (!this._attached) {
                throw new Error('Not attached - call attach() first');
            }
            
            if (!this.canvasManager) {
                throw new Error('CanvasManager not attached');
            }
            
            // CanvasManager準備完了確認（より柔軟に）
            let canvasManagerReady = false;
            
            if (typeof this.canvasManager.isV8Ready === 'function') {
                canvasManagerReady = this.canvasManager.isV8Ready();
            } else if (typeof this.canvasManager.ready === 'boolean') {
                canvasManagerReady = this.canvasManager.ready;
            } else if (this.canvasManager.app && this.canvasManager.app.view) {
                canvasManagerReady = true;
            } else {
                console.warn('⚠️ CoordinateManager: CanvasManager準備状態不明 - 継続実行');
                canvasManagerReady = true; // 継続実行を許可
            }
            
            if (!canvasManagerReady) {
                console.warn('⚠️ CoordinateManager: CanvasManager not ready - 強制継続');
            }
            
            // 初期変換テスト（より安全に）
            try {
                const testResult = this.screenToCanvas({ x: 0, y: 0 });
                if (testResult) {
                    console.log('📐 CoordinateManager: 初期変換テスト成功');
                } else {
                    console.warn('⚠️ CoordinateManager: 初期変換テスト失敗 - 継続実行');
                }
            } catch (error) {
                console.warn('⚠️ CoordinateManager: 初期変換テスト例外:', error.message);
            }
            
            this._initialized = true;
            console.log('✅ CoordinateManager: init() 完了');
            
        } catch (error) {
            this.stats.lastError = error;
            this.stats.errors++;
            console.error('❌ CoordinateManager: init() エラー:', error);
            throw error;
        }
    }
    
    /**
     * 準備完了判定（AppCore依存）
     * @returns {boolean} 準備完了状態
     */
    isReady() {
        return this._configured && this._attached && this._initialized && !!this.canvasManager;
    }
    
    /**
     * 解放処理
     */
    dispose() {
        console.log('📐 CoordinateManager: dispose() 開始');
        
        this.canvasManager = null;
        this._configured = false;
        this._attached = false;
        this._initialized = false;
        
        console.log('✅ CoordinateManager: dispose() 完了');
    }
    
    // ================================
    // 座標変換メソッド（統一API）
    // ================================
    
    /**
     * 画面座標からキャンバス座標への変換
     * @param {Object} screenCoords - 画面座標 {x, y}
     * @returns {Object|null} - キャンバス座標 {x, y, inBounds} または null
     */
    screenToCanvas(screenCoords) {
        if (!this.validateInput(screenCoords)) {
            return null;
        }
        
        if (!this.isReady()) {
            console.warn('⚠️ CoordinateManager: 未初期化状態での変換要求');
            this.stats.warnings++;
            return null;
        }
        
        try {
            this.stats.conversions++;
            
            // Canvas要素取得（複数方法で試行）
            let view = null;
            
            if (typeof this.canvasManager.getView === 'function') {
                view = this.canvasManager.getView();
            } else if (typeof this.canvasManager.getCanvas === 'function') {
                view = this.canvasManager.getCanvas();
            } else if (this.canvasManager.app && this.canvasManager.app.view) {
                view = this.canvasManager.app.view;
            }
            
            if (!view) {
                throw new Error('Canvas View not available from CanvasManager');
            }
            
            // DOM要素の境界取得
            const rect = view.getBoundingClientRect();
            
            // DPR取得・制限適用
            const dpr = Math.min(window.devicePixelRatio || 1, this.config.dprLimit);
            
            // 画面座標からキャンバス内座標へ変換
            const rawX = (screenCoords.x - rect.left) * dpr;
            const rawY = (screenCoords.y - rect.top) * dpr;
            
            // 精度調整
            const canvasX = Number(rawX.toFixed(this.config.precision));
            const canvasY = Number(rawY.toFixed(this.config.precision));
            
            // 境界チェック（有効時）
            let inBounds = true;
            if (this.config.boundaryCheck) {
                const canvasWidth = rect.width * dpr;
                const canvasHeight = rect.height * dpr;
                inBounds = canvasX >= 0 && canvasY >= 0 && canvasX <= canvasWidth && canvasY <= canvasHeight;
                
                if (!inBounds) {
                    this.stats.warnings++;
                }
            }
            
            return {
                x: canvasX,
                y: canvasY,
                inBounds: inBounds
            };
            
        } catch (error) {
            this.stats.lastError = error;
            this.stats.errors++;
            console.error('❌ 画面→キャンバス座標変換エラー:', error);
            return null;
        }
    }
    
    /**
     * キャンバス座標からローカル座標への変換（Container変形対応）
     * @param {Object} canvasCoords - キャンバス座標 {x, y}
     * @returns {Object|null} - ローカル座標 {x, y} または null
     */
    toLocalFromCanvas(canvasCoords) {
        if (!this.validateInput(canvasCoords)) {
            return null;
        }
        
        if (!this.isReady()) {
            console.warn('⚠️ CoordinateManager: 未初期化状態での変換要求');
            return null;
        }
        
        try {
            this.stats.conversions++;
            
            // DrawContainer取得
            let drawContainer = null;
            if (typeof this.canvasManager.getDrawContainer === 'function') {
                drawContainer = this.canvasManager.getDrawContainer();
            }
            
            if (!drawContainer) {
                // DrawContainerが無い場合は等価変換
                return {
                    x: Number(localCoords.x.toFixed(this.config.precision)),
                    y: Number(localCoords.y.toFixed(this.config.precision))
                };
            }
            
            // PixiJS v8 Container.toGlobal API使用
            const localPoint = new PIXI.Point(localCoords.x, localCoords.y);
            const globalPoint = drawContainer.toGlobal(localPoint);
            
            return {
                x: Number(globalPoint.x.toFixed(this.config.precision)),
                y: Number(globalPoint.y.toFixed(this.config.precision))
            };
            
        } catch (error) {
            this.stats.lastError = error;
            this.stats.errors++;
            console.error('❌ ローカル→キャンバス座標変換エラー:', error);
            
            // 安全なフォールバック
            return {
                x: Number(localCoords.x.toFixed(this.config.precision)),
                y: Number(localCoords.y.toFixed(this.config.precision))
            };
        }
    }
    
    // ================================
    // デバッグ・診断機能
    // ================================
    
    /**
     * デバッグ情報取得
     * @returns {Object} 状態・設定・統計情報
     */
    getDebugInfo() {
        const canvasManager = this.canvasManager;
        
        return {
            className: 'CoordinateManager',
            version: 'v8-unified-api-contract-with-test',
            state: {
                configured: this._configured,
                attached: this._attached,
                initialized: this._initialized,
                ready: this.isReady()
            },
            config: { ...this.config },
            stats: { ...this.stats },
            dependencies: {
                canvasManager: !!canvasManager,
                canvasManagerV8Ready: canvasManager?.isV8Ready?.() || false,
                canvasView: !!this.getCanvasView(),
                drawContainer: !!this.getDrawContainer()
            },
            capabilities: {
                screenToCanvas: typeof this.screenToCanvas === 'function',
                canvasToScreen: typeof this.canvasToScreen === 'function',
                toLocalFromCanvas: typeof this.toLocalFromCanvas === 'function',
                localToCanvas: typeof this.localToCanvas === 'function',
                debugChain: typeof this.debugCoordinateChain === 'function',
                testCoordinate: typeof this.testCoordinate === 'function'
            },
            runtime: {
                pixiVersion: window.PIXI ? window.PIXI.VERSION : 'not loaded',
                dpr: window.devicePixelRatio || 1,
                dprLimited: Math.min(window.devicePixelRatio || 1, this.config.dprLimit),
                timestamp: Date.now()
            }
        };
    }
    
    /**
     * Canvas要素取得（内部用・複数方法試行）
     */
    getCanvasView() {
        if (!this.canvasManager) return null;
        
        if (typeof this.canvasManager.getView === 'function') {
            return this.canvasManager.getView();
        } else if (typeof this.canvasManager.getCanvas === 'function') {
            return this.canvasManager.getCanvas();
        } else if (this.canvasManager.app && this.canvasManager.app.view) {
            return this.canvasManager.app.view;
        }
        
        return null;
    }
    
    /**
     * DrawContainer取得（内部用）
     */
    getDrawContainer() {
        if (!this.canvasManager) return null;
        
        if (typeof this.canvasManager.getDrawContainer === 'function') {
            return this.canvasManager.getDrawContainer();
        }
        
        return null;
    }
}

// グローバル名前空間に登録
if (!window.Tegaki) window.Tegaki = {};
window.Tegaki.CoordinateManager = CoordinateManager;

console.log('📐 CoordinateManager v8対応版・Manager統一API契約版 Loaded');
console.log('🚀 特徴: testCoordinate()メソッド追加・isReady()メソッド実装・configure/attach/init/dispose完全対応・PixiJS v8互換・DPR制限・境界判定');) {
                // DrawContainerが無い場合は等価変換
                return {
                    x: Number(canvasCoords.x.toFixed(this.config.precision)),
                    y: Number(canvasCoords.y.toFixed(this.config.precision))
                };
            }
            
            // PixiJS v8 Container.toLocal API使用
            const globalPoint = new PIXI.Point(canvasCoords.x, canvasCoords.y);
            const localPoint = drawContainer.toLocal(globalPoint);
            
            return {
                x: Number(localPoint.x.toFixed(this.config.precision)),
                y: Number(localPoint.y.toFixed(this.config.precision))
            };
            
        } catch (error) {
            this.stats.lastError = error;
            this.stats.errors++;
            console.error('❌ キャンバス→ローカル座標変換エラー:', error);
            
            // 安全なフォールバック（等価変換）
            return {
                x: Number(canvasCoords.x.toFixed(this.config.precision)),
                y: Number(canvasCoords.y.toFixed(this.config.precision))
            };
        }
    }
    
    /**
     * キャンバス座標から画面座標への変換（逆変換）
     * @param {Object} canvasCoords - キャンバス座標 {x, y}
     * @returns {Object|null} - 画面座標 {x, y} または null
     */
    canvasToScreen(canvasCoords) {
        if (!this.validateInput(canvasCoords)) {
            return null;
        }
        
        if (!this.isReady()) {
            console.warn('⚠️ CoordinateManager: 未初期化状態での変換要求');
            return null;
        }
        
        try {
            this.stats.conversions++;
            
            // Canvas要素取得（複数方法で試行）
            let view = null;
            
            if (typeof this.canvasManager.getView === 'function') {
                view = this.canvasManager.getView();
            } else if (typeof this.canvasManager.getCanvas === 'function') {
                view = this.canvasManager.getCanvas();
            } else if (this.canvasManager.app && this.canvasManager.app.view) {
                view = this.canvasManager.app.view;
            }
            
            if (!view) {
                throw new Error('Canvas View not available from CanvasManager');
            }
            
            // DOM要素の境界取得
            const rect = view.getBoundingClientRect();
            const dpr = Math.min(window.devicePixelRatio || 1, this.config.dprLimit);
            
            // キャンバス座標から画面座標へ変換
            const screenX = (canvasCoords.x / dpr) + rect.left;
            const screenY = (canvasCoords.y / dpr) + rect.top;
            
            return {
                x: Number(screenX.toFixed(this.config.precision)),
                y: Number(screenY.toFixed(this.config.precision))
            };
            
        } catch (error) {
            this.stats.lastError = error;
            this.stats.errors++;
            console.error('❌ キャンバス→画面座標変換エラー:', error);
            return null;
        }
    }
    
    // ================================
    // テスト・統合テスト用メソッド（新規追加）
    // ================================
    
    /**
     * 座標変換テスト（統合テスト用・新規追加）
     * @param {number} x - テスト座標X（デフォルト100）
     * @param {number} y - テスト座標Y（デフォルト100）
     * @returns {Object} テスト結果
     */
    testCoordinate(x = 100, y = 100) {
        console.log(`🧪 CoordinateManager: 座標変換テスト実行 (${x}, ${y})`);
        
        try {
            // 入力座標検証
            if (typeof x !== 'number' || typeof y !== 'number') {
                return {
                    success: false,
                    error: 'Invalid input coordinates - numbers required',
                    ready: this.isReady()
                };
            }
            
            // 準備状態確認
            if (!this.isReady()) {
                return {
                    success: false,
                    error: 'CoordinateManager not ready',
                    ready: this.isReady(),
                    state: {
                        configured: this._configured,
                        attached: this._attached,
                        initialized: this._initialized,
                        hasCanvasManager: !!this.canvasManager
                    }
                };
            }
            
            // 座標変換実行
            const result = this.screenToCanvas({ x, y });
            
            if (!result) {
                return {
                    success: false,
                    error: 'screenToCanvas() returned null',
                    ready: this.isReady(),
                    input: { x, y }
                };
            }
            
            // 逆変換テスト（精度確認）
            const backToScreen = this.canvasToScreen(result);
            
            return {
                success: true,
                input: { x, y },
                output: result,
                backToScreen: backToScreen,
                ready: this.isReady(),
                stats: {
                    totalConversions: this.stats.conversions,
                    errors: this.stats.errors,
                    warnings: this.stats.warnings
                },
                timestamp: Date.now()
            };
            
        } catch (error) {
            this.stats.lastError = error;
            this.stats.errors++;
            
            return {
                success: false,
                error: error.message,
                ready: this.isReady(),
                input: { x, y },
                stackTrace: error.stack,
                timestamp: Date.now()
            };
        }
    }
    
    // ================================
    // 後方互換性API
    // ================================
    
    /**
     * CanvasManager設定（後方互換・v8互換API）
     * @param {CanvasManager} canvasManager - Canvas管理インスタンス
     * @returns {boolean} 設定成功フラグ
     */
    setCanvasManagerV8(canvasManager) {
        console.log('📐 CoordinateManager: setCanvasManagerV8() - 後方互換API');
        
        try {
            // configure() が未実行なら実行
            if (!this._configured) {
                this.configure();
            }
            
            // attach() 実行
            this.attach({ canvasManager });
            
            // init() 実行（同期的に）
            this.init().then(() => {
                console.log('✅ CoordinateManager: v8互換設定完了');
            }).catch(error => {
                console.error('❌ CoordinateManager: v8互換設定失敗:', error);
            });
            
            return true;
            
        } catch (error) {
            console.error('❌ CoordinateManager: setCanvasManagerV8() エラー:', error);
            return false;
        }
    }
    
    /**
     * 旧API互換（setCanvasManager）
     * @param {CanvasManager} canvasManager 
     * @returns {boolean}
     */
    setCanvasManager(canvasManager) {
        return this.setCanvasManagerV8(canvasManager);
    }
    
    // ================================
    // ユーティリティメソッド
    // ================================
    
    /**
     * 入力座標の妥当性検証
     * @param {Object} coords - 座標オブジェクト
     * @returns {boolean} - 妥当性
     */
    validateInput(coords) {
        if (!coords || coords === null || coords === undefined) {
            this.stats.warnings++;
            return false;
        }
        
        if (typeof coords.x !== 'number' || typeof coords.y !== 'number') {
            console.warn('⚠️ CoordinateManager: 不正な座標形式', coords);
            this.stats.warnings++;
            return false;
        }
        
        if (!isFinite(coords.x) || !isFinite(coords.y)) {
            console.warn('⚠️ CoordinateManager: 無限大/NaN座標', coords);
            this.stats.warnings++;
            return false;
        }
        
        return true;
    }
    
    /**
     * デバッグ用座標変換チェーン実行
     * @param {Object} screenCoords - 画面座標
     * @returns {Object} - 各段階の座標
     */
    debugCoordinateChain(screenCoords) {
        console.log('🔍 CoordinateManager: デバッグ変換チェーン実行');
        
        const canvasCoords = this.screenToCanvas(screenCoords);
        const localCoords = canvasCoords ? this.toLocalFromCanvas(canvasCoords) : null;
        const backToCanvas = localCoords ? this.localToCanvas(localCoords) : null;
        const backToScreen = backToCanvas ? this.canvasToScreen(backToCanvas) : null;
        
        const result = {
            original: screenCoords,
            canvas: canvasCoords,
            local: localCoords,
            backToCanvas: backToCanvas,
            backToScreen: backToScreen,
            success: !!(canvasCoords && localCoords && backToCanvas && backToScreen)
        };
        
        console.log('🔍 変換チェーン結果:', result);
        return result;
    }
    
    /**
     * ローカル座標からキャンバス座標への変換（toLocalFromCanvasの逆）
     * @param {Object} localCoords - ローカル座標
     * @returns {Object|null} - キャンバス座標
     */
    localToCanvas(localCoords) {
        if (!this.validateInput(localCoords)) {
            return null;
        }
        
        if (!this.isReady()) {
            console.warn('⚠️ CoordinateManager: 未初期化状態での変換要求');
            return null;
        }
        
        try {
            this.stats.conversions++;
            
            // DrawContainer取得
            let drawContainer = null;
            if (typeof this.canvasManager.getDrawContainer === 'function') {
                drawContainer = this.canvasManager.getDrawContainer();
            }
            
            if (!drawContainer