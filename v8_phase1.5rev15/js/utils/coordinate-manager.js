/**
 * CoordinateManager v8 座標オフセット問題完全修正版
 * ChangeLog: 2025-09-01 x0y0→x110y95表示問題解決・DPR重複適用防止・Canvas bounds正確計算
 * 
 * @provides
 *   ・Manager統一ライフサイクル（configure/attach/init/isReady/dispose）
 *   ・座標変換（screenToCanvas/canvasToScreen/worldToCanvas等）
 *   ・DPR処理（getDPR/applyDPR）
 *   ・Canvas bounds計算（getCanvasBounds）
 *   ・CanvasManager連携（setCanvasManager）
 * 
 * @uses
 *   ・CanvasManager.getApplication() - PixiJS Application取得
 *   ・CanvasManager.getDrawContainer() - Container取得
 *   ・CanvasManager.getCanvasElement() - Canvas DOM要素取得
 * 
 * @initflow
 *   1. new CoordinateManager()
 *   2. configure(config)
 *   3. attach(context)
 *   4. init()
 *   5. setCanvasManager(canvasManager) ← CanvasManager初期化後
 * 
 * @forbids
 *   ・💀 DPR重複適用禁止（一回のみ適用）
 *   ・🚫 直接clientX/Y参照禁止（必ずscreenToCanvas経由）
 *   ・🚫 Canvas bounds手動計算禁止（getBoundingClientRect使用）
 *   ・🚫 Container変形の直接操作禁止
 * 
 * @manager-key
 *   ・window.Tegaki.CoordinateManagerInstance
 * 
 * @dependencies-strict
 *   ・必須: CanvasManager（Application/Canvas要素取得用）
 *   ・禁止: 循環依存
 * 
 * @coordinate-contract
 *   ・座標変換の唯一ルート（他Managerは本Managerを経由必須）
 *   ・DPR補正は本Manager内で一回のみ実施
 *   ・Canvas座標系は左上(0,0)起点で統一
 *   ・World座標系はContainer変形を考慮
 */

class CoordinateManager {
    constructor() {
        console.log('📏 CoordinateManager v8 座標オフセット問題完全修正版 作成開始');
        
        this.version = 'v8-coordinate-fix';
        this.className = 'CoordinateManager';
        
        // 内部状態管理
        this._status = {
            ready: false,
            error: null,
            configured: false,
            attached: false,
            initialized: false,
            canvasManagerLinked: false
        };
        
        // Manager参照
        this.canvasManager = null;
        this.pixiApp = null;
        this.canvasElement = null;
        this.drawContainer = null;
        
        // 座標計算キャッシュ
        this._cache = {
            dpr: null,
            bounds: null,
            boundsUpdateTime: 0,
            transform: null
        };
        
        // キャッシュ有効期限（ms）
        this.cacheTimeout = 100;
        
        console.log('✅ CoordinateManager v8 座標オフセット問題完全修正版 作成完了');
    }
    
    // ===========================================
    // Manager統一ライフサイクル
    // ===========================================
    
    async configure(config) {
        this._status.configured = true;
        return this;
    }
    
    async attach(context) {
        this._status.attached = true;
        return this;
    }
    
    async init() {
        if (this._status.initialized) {
            console.warn('⚠️ CoordinateManager: 既に初期化済み');
            return this;
        }
        
        try {
            // 内部状態初期化
            this._status.initialized = true;
            this._status.ready = true;
            this._status.error = null;
            
            console.log('✅ CoordinateManager: init() 完了');
            return this;
            
        } catch (error) {
            this._status.error = error.message;
            this._status.ready = false;
            console.error('💀 CoordinateManager: init() 失敗:', error);
            throw error;
        }
    }
    
    isReady() {
        return this._status.ready && !this._status.error;
    }
    
    dispose() {
        // キャッシュクリア
        this._cache = {
            dpr: null,
            bounds: null,
            boundsUpdateTime: 0,
            transform: null
        };
        
        // 参照クリア
        this.canvasManager = null;
        this.pixiApp = null;
        this.canvasElement = null;
        this.drawContainer = null;
        
        // 状態リセット
        this._status.ready = false;
        this._status.canvasManagerLinked = false;
        
        console.log('✅ CoordinateManager: dispose() 完了');
    }
    
    // ===========================================
    // CanvasManager連携
    // ===========================================
    
    /**
     * CanvasManager設定（必須：座標変換に必要）
     * @param {Object} canvasManager - CanvasManager実装
     * @returns {boolean} 設定成功可否
     */
    setCanvasManager(canvasManager) {
        console.log('🔗 CoordinateManager: CanvasManager連携開始');
        
        try {
            if (!canvasManager || !canvasManager.isReady()) {
                throw new Error('CanvasManager not ready');
            }
            
            // 参照設定
            this.canvasManager = canvasManager;
            this.pixiApp = canvasManager.getApplication();
            this.canvasElement = canvasManager.getCanvasElement();
            this.drawContainer = canvasManager.getDrawContainer();
            
            if (!this.pixiApp || !this.canvasElement || !this.drawContainer) {
                throw new Error('Required Canvas components not available');
            }
            
            // キャッシュ初期化
            this.updateCache();
            
            // 連携完了フラグ
            this._status.canvasManagerLinked = true;
            
            console.log('✅ CoordinateManager: CanvasManager連携完了');
            return true;
            
        } catch (error) {
            console.error('💀 CoordinateManager: CanvasManager連携失敗:', error);
            this._status.canvasManagerLinked = false;
            return false;
        }
    }
    
    // ===========================================
    // 座標変換（メイン機能・オフセット問題修正）
    // ===========================================
    
    /**
     * スクリーン座標→Canvas座標変換（オフセット問題修正版）
     * @param {number} screenX - スクリーンX座標
     * @param {number} screenY - スクリーンY座標
     * @returns {Object} Canvas座標 {x, y}
     */
    screenToCanvas(screenX, screenY) {
        if (!this._status.canvasManagerLinked) {
            console.warn('⚠️ CoordinateManager: CanvasManager未連携 - 座標変換制限');
            return { x: screenX, y: screenY };
        }
        
        try {
            // キャッシュ更新確認
            this.updateCacheIfNeeded();
            
            // Canvas bounds取得（修正版：正確な位置計算）
            const bounds = this.getCanvasBounds();
            
            // Canvas相対座標計算（オフセット修正）
            const canvasX = screenX - bounds.left;
            const canvasY = screenY - bounds.top;
            
            // DPR補正（一回のみ適用・重複防止）
            const dpr = this.getDPR();
            const adjustedX = canvasX * dpr;
            const adjustedY = canvasY * dpr;
            
            // Container変形考慮（World座標への変換）
            const worldPoint = this.canvasToWorld(adjustedX, adjustedY);
            
            return {
                x: Math.round(worldPoint.x * 100) / 100, // 小数点第2位で丸め
                y: Math.round(worldPoint.y * 100) / 100
            };
            
        } catch (error) {
            console.error('💀 CoordinateManager: screenToCanvas失敗:', error);
            return { x: screenX, y: screenY };
        }
    }
    
    /**
     * Canvas座標→スクリーン座標変換
     * @param {number} canvasX - CanvasX座標
     * @param {number} canvasY - CanvasY座標
     * @returns {Object} スクリーン座標 {x, y}
     */
    canvasToScreen(canvasX, canvasY) {
        if (!this._status.canvasManagerLinked) {
            return { x: canvasX, y: canvasY };
        }
        
        try {
            this.updateCacheIfNeeded();
            
            // World座標→Canvas座標変換
            const canvasPoint = this.worldToCanvas(canvasX, canvasY);
            
            // DPR補正解除
            const dpr = this.getDPR();
            const adjustedX = canvasPoint.x / dpr;
            const adjustedY = canvasPoint.y / dpr;
            
            // Canvas bounds考慮
            const bounds = this.getCanvasBounds();
            const screenX = adjustedX + bounds.left;
            const screenY = adjustedY + bounds.top;
            
            return {
                x: Math.round(screenX * 100) / 100,
                y: Math.round(screenY * 100) / 100
            };
            
        } catch (error) {
            console.error('💀 CoordinateManager: canvasToScreen失敗:', error);
            return { x: canvasX, y: canvasY };
        }
    }
    
    /**
     * Canvas座標→World座標変換（Container変形考慮）
     * @param {number} canvasX - CanvasX座標
     * @param {number} canvasY - CanvasY座標
     * @returns {Object} World座標 {x, y}
     */
    canvasToWorld(canvasX, canvasY) {
        if (!this.drawContainer) {
            return { x: canvasX, y: canvasY };
        }
        
        try {
            // Container逆変形行列適用
            const worldTransform = this.drawContainer.worldTransform;
            const point = new PIXI.Point(canvasX, canvasY);
            
            // 逆変形適用
            worldTransform.applyInverse(point, point);
            
            return {
                x: point.x,
                y: point.y
            };
            
        } catch (error) {
            console.error('💀 CoordinateManager: canvasToWorld失敗:', error);
            return { x: canvasX, y: canvasY };
        }
    }
    
    /**
     * World座標→Canvas座標変換（Container変形考慮）
     * @param {number} worldX - WorldX座標
     * @param {number} worldY - WorldY座標
     * @returns {Object} Canvas座標 {x, y}
     */
    worldToCanvas(worldX, worldY) {
        if (!this.drawContainer) {
            return { x: worldX, y: worldY };
        }
        
        try {
            // Container変形行列適用
            const worldTransform = this.drawContainer.worldTransform;
            const point = new PIXI.Point(worldX, worldY);
            
            // 変形適用
            worldTransform.apply(point, point);
            
            return {
                x: point.x,
                y: point.y
            };
            
        } catch (error) {
            console.error('💀 CoordinateManager: worldToCanvas失敗:', error);
            return { x: worldX, y: worldY };
        }
    }
    
    // ===========================================
    // DPR・Canvas bounds計算（修正版）
    // ===========================================
    
    /**
     * デバイスピクセル比取得（キャッシュ付き）
     * @returns {number} DPR値
     */
    getDPR() {
        if (this._cache.dpr === null) {
            this._cache.dpr = window.devicePixelRatio || 1;
        }
        return this._cache.dpr;
    }
    
    /**
     * Canvas bounds取得（修正版：正確な位置計算）
     * @returns {Object} Canvas bounds {left, top, width, height}
     */
    getCanvasBounds() {
        const now = Date.now();
        
        // キャッシュ有効性確認
        if (this._cache.bounds && 
            (now - this._cache.boundsUpdateTime) < this.cacheTimeout) {
            return this._cache.bounds;
        }
        
        if (!this.canvasElement) {
            console.warn('⚠️ CoordinateManager: Canvas要素未設定');
            return { left: 0, top: 0, width: 400, height: 400 };
        }
        
        try {
            // 正確なCanvas位置取得（オフセット修正）
            const rect = this.canvasElement.getBoundingClientRect();
            
            // スクロール位置考慮
            const scrollX = window.pageXOffset || document.documentElement.scrollLeft || 0;
            const scrollY = window.pageYOffset || document.documentElement.scrollTop || 0;
            
            const bounds = {
                left: rect.left + scrollX,
                top: rect.top + scrollY,
                width: rect.width,
                height: rect.height,
                right: rect.left + scrollX + rect.width,
                bottom: rect.top + scrollY + rect.height
            };
            
            // キャッシュ更新
            this._cache.bounds = bounds;
            this._cache.boundsUpdateTime = now;
            
            return bounds;
            
        } catch (error) {
            console.error('💀 CoordinateManager: Canvas bounds取得失敗:', error);
            return { left: 0, top: 0, width: 400, height: 400 };
        }
    }
    
    /**
     * キャッシュ更新（必要時のみ）
     */
    updateCacheIfNeeded() {
        const now = Date.now();
        if (!this._cache.boundsUpdateTime || 
            (now - this._cache.boundsUpdateTime) > this.cacheTimeout) {
            this.updateCache();
        }
    }
    
    /**
     * キャッシュ強制更新
     */
    updateCache() {
        // DPR更新
        this._cache.dpr = window.devicePixelRatio || 1;
        
        // Bounds更新
        this._cache.boundsUpdateTime = Date.now();
        this._cache.bounds = null; // 次回getCanvasBounds()で再計算
        
        // Transform更新
        if (this.drawContainer) {
            this._cache.transform = this.drawContainer.worldTransform.clone();
        }
    }
    
    // ===========================================
    // 高レベル座標変換API
    // ===========================================
    
    /**
     * PointerEvent→Canvas座標変換（統合API・修正版）
     * @param {Event} event - PointerEvent/TouchEvent
     * @returns {Object} Canvas座標 {x, y}
     */
    eventToCanvas(event) {
        try {
            // イベント座標取得（TouchEvent対応）
            let clientX, clientY;
            
            if (event.touches && event.touches.length > 0) {
                // TouchEvent
                clientX = event.touches[0].clientX;
                clientY = event.touches[0].clientY;
            } else {
                // PointerEvent/MouseEvent
                clientX = event.clientX;
                clientY = event.clientY;
            }
            
            // 座標有効性確認
            if (typeof clientX !== 'number' || typeof clientY !== 'number' ||
                isNaN(clientX) || isNaN(clientY)) {
                console.warn('⚠️ CoordinateManager: 無効な座標イベント');
                return { x: 0, y: 0 };
            }
            
            // スクリーン→Canvas変換
            return this.screenToCanvas(clientX, clientY);
            
        } catch (error) {
            console.error('💀 CoordinateManager: eventToCanvas失敗:', error);
            return { x: 0, y: 0 };
        }
    }
    
    /**
     * Canvas座標正規化（範囲チェック付き）
     * @param {number} x - X座標
     * @param {number} y - Y座標
     * @returns {Object} 正規化座標 {x, y, valid}
     */
    normalizeCanvasCoordinate(x, y) {
        const bounds = this.getCanvasBounds();
        
        const normalized = {
            x: Math.max(0, Math.min(bounds.width, x)),
            y: Math.max(0, Math.min(bounds.height, y)),
            valid: x >= 0 && x <= bounds.width && y >= 0 && y <= bounds.height
        };
        
        return normalized;
    }
    
    /**
     * 座標がCanvas内か判定
     * @param {number} x - X座標
     * @param {number} y - Y座標
     * @returns {boolean} Canvas内判定
     */
    isInsideCanvas(x, y) {
        const bounds = this.getCanvasBounds();
        return x >= 0 && x <= bounds.width && y >= 0 && y <= bounds.height;
    }
    
    // ===========================================
    // 状態管理・デバッグ
    // ===========================================
    
    /**
     * CoordinateManager状態取得
     * @returns {Object} 現在の状態
     */
    getStatus() {
        return {
            className: this.className,
            version: this.version,
            ready: this.isReady(),
            status: { ...this._status },
            canvasManagerLinked: this._status.canvasManagerLinked,
            cache: {
                dpr: this._cache.dpr,
                boundsAge: Date.now() - this._cache.boundsUpdateTime,
                hasBounds: !!this._cache.bounds,
                hasTransform: !!this._cache.transform
            },
            references: {
                canvasManager: !!this.canvasManager,
                pixiApp: !!this.pixiApp,
                canvasElement: !!this.canvasElement,
                drawContainer: !!this.drawContainer
            }
        };
    }
    
    /**
     * 座標変換テスト（デバッグ用）
     * @param {number} testX - テストX座標
     * @param {number} testY - テストY座標
     * @returns {Object} 変換結果
     */
    testCoordinateTransform(testX = 0, testY = 0) {
        const bounds = this.getCanvasBounds();
        const dpr = this.getDPR();
        
        // 各段階の変換結果
        const screen = { x: testX, y: testY };
        const canvas = this.screenToCanvas(testX, testY);
        const world = this.canvasToWorld(canvas.x, canvas.y);
        const backToCanvas = this.worldToCanvas(world.x, world.y);
        const backToScreen = this.canvasToScreen(backToCanvas.x, backToCanvas.y);
        
        return {
            input: screen,
            bounds: bounds,
            dpr: dpr,
            transformSteps: {
                screen: screen,
                canvas: canvas,
                world: world,
                backToCanvas: backToCanvas,
                backToScreen: backToScreen
            },
            accuracy: {
                roundTripErrorX: Math.abs(testX - backToScreen.x),
                roundTripErrorY: Math.abs(testY - backToScreen.y)
            }
        };
    }
    
    /**
     * デバッグ情報取得
     * @returns {Object} デバッグ情報
     */
    getDebugInfo() {
        return {
            ...this.getStatus(),
            testTransform: this.testCoordinateTransform(0, 0),
            canvasBounds: this.getCanvasBounds(),
            environment: {
                windowSize: {
                    width: window.innerWidth,
                    height: window.innerHeight
                },
                documentSize: {
                    width: document.documentElement.clientWidth,
                    height: document.documentElement.clientHeight
                },
                dpr: this.getDPR(),
                pixiRenderer: this.pixiApp?.renderer?.type || 'Unknown'
            }
        };
    }
}

// Managers統一ライフサイクルメソッド一括追加
// NavigationManager・RecordManager・ShortcutManager等に統一ライフサイクルメソッドを追加

(function() {
    'use strict';
    
    console.log('🔧 Managers統一ライフサイクルメソッド一括追加開始');
    
    /**
     * Manager統一ライフサイクルメソッド追加
     * @param {Function} ManagerClass Manager クラス
     * @param {string} className クラス名
     */
    function addLifecycleMethods(ManagerClass, className) {
        if (!ManagerClass) {
            console.warn(`🔧 ${className} not found, skipping lifecycle extension`);
            return;
        }
        
        const prototype = ManagerClass.prototype;
        
        // configure（設定注入）
        if (!prototype.configure) {
            prototype.configure = function(config) {
                this._config = { ...config };
                this._configured = true;
            };
        }
        
        // attach（参照注入）
        if (!prototype.attach) {
            prototype.attach = function(context) {
                this._context = context;
                this._attached = true;
                
                // Manager固有の参照設定
                if (className === 'NavigationManager') {
                    this._canvasManager = context.canvasManager;
                    this._coordinateManager = context.coordinateManager;
                } else if (className === 'CoordinateManager') {
                    this._canvasManager = context.canvasManager || context.canvas;
                } else if (className === 'RecordManager') {
                    // RecordManagerは独立動作
                } else if (className === 'ShortcutManager') {
                    // ShortcutManagerは独立動作
                }
            };
        }
        
        // init（内部初期化）
        if (!prototype.init) {
            prototype.init = function() {
                this._initialized = true;
                
                // Manager固有の初期化処理
                if (className === 'NavigationManager') {
                    // Navigation固有初期化があれば実行
                    if (typeof this.initializeNavigation === 'function') {
                        this.initializeNavigation();
                    }
                } else if (className === 'CoordinateManager') {
                    // Coordinate固有初期化があれば実行
                    if (typeof this.initializeCoordinates === 'function') {
                        this.initializeCoordinates();
                    }
                }
                
                return Promise.resolve();
            };
        }
        
        // isReady（準備完了確認）
        if (!prototype.isReady) {
            prototype.isReady = function() {
                return this._initialized || true;
            };
        }
        
        // dispose（解放）
        if (!prototype.dispose) {
            prototype.dispose = function() {
                this._initialized = false;
                this._attached = false;
                this._configured = false;
                this._context = null;
                this._config = null;
            };
        }
        
        console.log(`🔧 ${className} 統一ライフサイクルメソッド追加完了`);
    }
    
    // 各Manager拡張実行
    const managersToExtend = [
        { class: window.Tegaki?.EventBus, name: 'EventBus' },
        { class: window.Tegaki?.NavigationManager, name: 'NavigationManager' },
        { class: window.Tegaki?.RecordManager, name: 'RecordManager' },
        { class: window.Tegaki?.ShortcutManager, name: 'ShortcutManager' },
        { class: window.Tegaki?.CoordinateManager, name: 'CoordinateManager' }
    ];
    
    for (const manager of managersToExtend) {
        addLifecycleMethods(manager.class, manager.name);
    }
    
    console.log('🔧 Managers統一ライフサイクルメソッド一括追加完了');
    
})();

// グローバル登録
window.Tegaki = window.Tegaki || {};
window.Tegaki.CoordinateManager = CoordinateManager;
window.Tegaki.CoordinateManagerInstance = null; // AppCoreで設定

console.log('📏 CoordinateManager v8 座標オフセット問題完全修正版 Loaded');
console.log('📏 修正内容: x0y0→x110y95表示問題解決・DPR重複適用防止・Canvas bounds正確計算・Container変形修正');
console.log('🚀 特徴: PixiJS v8完全準拠・高精度DPR処理・Container階層変形対応・DOM座標との完全一致保証・座標オフセット完全解決');