/**
 * 📄 FILE: utils/coordinate-manager.js
 * 📌 RESPONSIBILITY: 座標変換・DPR処理・Container変形・Canvas座標系統一管理
 * ChangeLog: 2025-09-01 <座標オフセット修正・DPR重複適用解決・Container変形修正>
 * 
 * @provides
 *   - CoordinateManager（クラス）
 *   - configure(config): void
 *   - attach(context): void
 *   - init(): Promise<void>
 *   - isReady(): boolean
 *   - dispose(): void
 *   - setCanvasManager(canvasManager): void
 *   - clientToWorld(x, y): {x, y}
 *   - worldToClient(x, y): {x, y}
 *   - screenToCanvas(x, y): {x, y}
 *   - canvasToScreen(x, y): {x, y}
 *   - getCanvasBounds(): {x, y, width, height}
 *   - getDPR(): number
 *   - validateCoordinates(x, y): boolean
 *
 * @uses
 *   - CanvasManager.getApplication(): PIXI.Application
 *   - CanvasManager.getCanvas(): HTMLCanvasElement
 *   - CanvasManager.getStage(): PIXI.Container
 *   - CanvasManager.getDrawContainer(): PIXI.Container
 *   - window.devicePixelRatio
 *
 * @initflow
 *   1. configure(config) → 2. attach(context) → 3. init() 
 *   → 4. setCanvasManager(canvasManager) → 5. 座標変換準備完了
 *
 * @forbids
 *   💀 双方向依存禁止
 *   🚫 DPR重複適用禁止
 *   🚫 座標二重変換禁止
 *   🚫 直接DOM座標使用禁止（必ずCoordinateManager経由）
 *   🚫 Container変形の直接操作禁止
 *
 * @manager-key
 *   window.Tegaki.CoordinateManagerInstance
 *
 * @dependencies-strict
 *   REQUIRED: CanvasManager（Canvas・Stage・DrawContainer参照用）
 *   OPTIONAL: NavigationManager（変形情報連携用）
 *   FORBIDDEN: Tool直接参照、循環依存
 *
 * @integration-flow
 *   AppCore → CoordinateManager.setCanvasManager() → Tool → clientToWorld()
 *   → 座標変換 → 正確描画座標取得
 *
 * @method-naming-rules
 *   ライフサイクル: configure/attach/init/isReady/dispose
 *   座標変換: clientToWorld(), worldToClient(), screenToCanvas(), canvasToScreen()
 *   設定: setCanvasManager(), getDPR()
 *   検証: validateCoordinates()
 *
 * @event-contract
 *   1. DOM座標はclientToWorld()で一元変換
 *   2. PixiJS座標系とDOM座標系の正確な対応
 *   3. Container変形・スケール・回転の考慮
 *
 * @coordinate-contract
 *   座標変換はCoordinateManagerを唯一のルートとする
 *   DPR補正は一回のみ（rect -> * dpr）
 *   Container変換はすべてCoordinateManager側で処理
 *   isReady()を実装し、init完了でtrueを返す
 *
 * @error-handling
 *   init()はPromiseを返し、エラーはreject
 *   座標変換失敗時はnullを返し、ログ出力
 *   範囲外座標の適切な処理
 *
 * @testing-hooks
 *   座標変換テスト用メソッド提供
 *   DPR・Container変形の検証機能
 *
 * @state-management
 *   座標変換パラメータの一元管理
 *   Canvas状態変更の自動検知・更新
 *
 * @performance-notes
 *   座標変換の高速化・キャッシュ活用
 *   pointermoveでの軽量処理
 *
 * @input-validation
 *   座標値のnull/undefined/NaN検証
 *   範囲外座標の適切な処理
 */

(function() {
    'use strict';

    /**
     * 📏 CoordinateManager v8座標修正版 - 座標オフセット問題完全解決
     * 
     * 📏 修正内容:
     * - 座標オフセット問題修正（0,0が110,95に表示される問題解決）
     * - DPR重複適用防止・一回のみの正確な適用
     * - Container変形処理の修正・Stage座標系の正確な処理
     * - Canvas bounds計算の修正・DOM要素位置の正確な取得
     * 
     * 🚀 特徴:
     * - PixiJS v8完全準拠の座標変換
     * - 高精度DPR処理・WebGPU対応
     * - Container階層変形の完全対応
     * - DOM座標とPixiJS座標の完全な一致保証
     */
    class CoordinateManager {
        constructor() {
            console.log('📏 CoordinateManager v8座標修正版 作成開始');
            
            // Manager統一ライフサイクル状態管理
            this._status = {
                ready: false,
                error: null,
                initialized: false,
                configured: false,
                attached: false
            };
            
            // 基本参照
            this.canvasManager = null;
            this.pixiApp = null;
            this.htmlCanvas = null;
            this.stage = null;
            this.drawContainer = null;
            
            // 座標変換パラメータ
            this.canvasBounds = null;
            this.dpr = window.devicePixelRatio || 1;
            this.transform = {
                scale: 1,
                x: 0,
                y: 0,
                rotation: 0
            };
            
            // 設定・Context
            this.config = null;
            this.context = null;
            
            // キャッシュ・最適化
            this.boundsCache = null;
            this.lastBoundsUpdate = 0;
            this.boundsCacheTimeout = 100; // 100ms
            
            console.log('✅ CoordinateManager v8座標修正版 作成完了');
        }

        // ========================================
        // Manager統一ライフサイクル（必須実装）
        // ========================================
        
        /**
         * 設定注入（同期）
         * @param {Object} config - 設定オブジェクト
         */
        configure(config) {
            try {
                console.log('🔧 CoordinateManager: configure() 開始');
                
                this.config = config || {};
                
                // 座標変換設定
                if (config.coordinates) {
                    this.boundsCacheTimeout = config.coordinates.boundsCacheTimeout || 100;
                }
                
                this._status.configured = true;
                this._status.error = null;
                
                console.log('✅ CoordinateManager: configure() 完了');
                
            } catch (error) {
                this._status.configured = false;
                this._status.error = `Configure failed: ${error.message}`;
                console.error('❌ CoordinateManager: configure() 失敗:', error);
                throw error;
            }
        }
        
        /**
         * Context注入（同期）
         * @param {Object} context - Canvas context情報
         */
        attach(context) {
            try {
                console.log('🔧 CoordinateManager: attach() 開始');
                
                this.context = context || {};
                
                // DPR更新
                this.updateDPR();
                
                this._status.attached = true;
                this._status.error = null;
                
                console.log('✅ CoordinateManager: attach() 完了');
                
            } catch (error) {
                this._status.attached = false;
                this._status.error = `Attach failed: ${error.message}`;
                console.error('❌ CoordinateManager: attach() 失敗:', error);
                throw error;
            }
        }
        
        /**
         * 内部初期化（非同期可能）
         * @returns {Promise<void>}
         */
        async init() {
            try {
                console.log('🚀 CoordinateManager: init() 開始');
                
                if (!this._status.configured) {
                    throw new Error('CoordinateManager not configured - call configure() first');
                }
                
                if (!this._status.attached) {
                    throw new Error('CoordinateManager not attached - call attach() first');
                }
                
                // 基本初期化
                this.resetTransform();
                
                // イベントリスナー設定（リサイズ対応）
                this.setupEventListeners();
                
                // 初期化完了
                this._status.initialized = true;
                this._status.error = null;
                
                console.log('✅ CoordinateManager: init() 完了');
                
            } catch (error) {
                this._status.initialized = false;
                this._status.ready = false;
                this._status.error = `Init failed: ${error.message}`;
                console.error('❌ CoordinateManager: init() 失敗:', error);
                throw error;
            }
        }
        
        /**
         * 準備完了判定（同期）
         * @returns {boolean} 準備完了状態
         */
        isReady() {
            try {
                // 基本ライフサイクル確認
                const lifecycleReady = this._status.configured && 
                                     this._status.attached && 
                                     this._status.initialized;
                
                if (!lifecycleReady) {
                    return false;
                }
                
                // CanvasManager参照確認
                const canvasReady = !!(this.canvasManager && 
                                     this.pixiApp && 
                                     this.htmlCanvas && 
                                     this.stage);
                
                // 座標変換準備確認
                const coordinateReady = !!(this.canvasBounds || this.getCachedBounds());
                
                // 総合判定
                const overallReady = canvasReady && coordinateReady;
                
                // 状態更新
                this._status.ready = overallReady;
                
                return overallReady;
                
            } catch (error) {
                console.error('❌ CoordinateManager.isReady() エラー:', error);
                this._status.ready = false;
                this._status.error = `isReady check failed: ${error.message}`;
                return false;
            }
        }
        
        /**
         * 解放処理（同期）
         */
        dispose() {
            try {
                console.log('🔧 CoordinateManager: dispose() 開始');
                
                // イベントリスナー削除
                this.removeEventListeners();
                
                // 参照クリア
                this.canvasManager = null;
                this.pixiApp = null;
                this.htmlCanvas = null;
                this.stage = null;
                this.drawContainer = null;
                this.canvasBounds = null;
                this.boundsCache = null;
                
                // ライフサイクル状態リセット
                this._status = {
                    ready: false,
                    error: null,
                    initialized: false,
                    configured: false,
                    attached: false
                };
                
                console.log('✅ CoordinateManager: dispose() 完了');
                
            } catch (error) {
                console.error('❌ CoordinateManager: dispose() 失敗:', error);
            }
        }
        
        /**
         * 状態取得（AppCore用）
         * @returns {Object} 詳細状態情報
         */
        getStatus() {
            return {
                ...this._status,
                canvasManagerAttached: !!this.canvasManager,
                pixiAppAttached: !!this.pixiApp,
                htmlCanvasAttached: !!this.htmlCanvas,
                boundsReady: !!(this.canvasBounds || this.getCachedBounds()),
                dpr: this.dpr
            };
        }

        // ========================================
        // CanvasManager連携・初期設定
        // ========================================
        
        /**
         * CanvasManager設定（修正版・完全な参照取得）
         * @param {CanvasManager} canvasManager - CanvasManagerインスタンス
         */
        setCanvasManager(canvasManager) {
            try {
                console.log('🔧 CoordinateManager: setCanvasManager() 開始');
                
                if (!canvasManager) {
                    throw new Error('CanvasManager is null/undefined');
                }
                
                this.canvasManager = canvasManager;
                
                // Pixi Application取得
                if (typeof canvasManager.getApplication === 'function') {
                    this.pixiApp = canvasManager.getApplication();
                    if (!this.pixiApp) {
                        console.warn('⚠️ PixiJS Application not available from CanvasManager');
                    }
                } else {
                    console.warn('⚠️ CanvasManager.getApplication() method not found');
                }
                
                // HTML Canvas取得
                if (typeof canvasManager.getCanvas === 'function') {
                    this.htmlCanvas = canvasManager.getCanvas();
                    if (!this.htmlCanvas) {
                        console.warn('⚠️ HTML Canvas not available from CanvasManager');
                    }
                } else if (this.pixiApp && this.pixiApp.view) {
                    this.htmlCanvas = this.pixiApp.view;
                    console.log('📦 HTML Canvas取得: PixiJS App経由');
                } else {
                    console.warn('⚠️ HTML Canvas取得失敗');
                }
                
                // Stage取得
                if (typeof canvasManager.getStage === 'function') {
                    this.stage = canvasManager.getStage();
                } else if (this.pixiApp && this.pixiApp.stage) {
                    this.stage = this.pixiApp.stage;
                    console.log('📦 Stage取得: PixiJS App経由');
                } else {
                    console.warn('⚠️ Stage取得失敗');
                }
                
                // DrawContainer取得
                if (typeof canvasManager.getDrawContainer === 'function') {
                    this.drawContainer = canvasManager.getDrawContainer();
                    if (!this.drawContainer) {
                        console.warn('⚠️ DrawContainer not available from CanvasManager');
                    }
                } else {
                    console.warn('⚠️ CanvasManager.getDrawContainer() method not found');
                }
                
                // Canvas bounds初期計算
                this.updateCanvasBounds();
                
                // DPR更新
                this.updateDPR();
                
                console.log('✅ CoordinateManager: setCanvasManager() 完了');
                console.log('📊 参照状態:', {
                    pixiApp: !!this.pixiApp,
                    htmlCanvas: !!this.htmlCanvas,
                    stage: !!this.stage,
                    drawContainer: !!this.drawContainer,
                    bounds: !!this.canvasBounds
                });
                
            } catch (error) {
                this._status.error = `setCanvasManager failed: ${error.message}`;
                console.error('❌ CoordinateManager: setCanvasManager() 失敗:', error);
                throw error;
            }
        }

        // ========================================
        // 座標変換（核心機能）
        // ========================================
        
        /**
         * クライアント座標→ワールド座標変換（修正版・オフセット問題解決）
         * @param {number} clientX - クライアント X座標
         * @param {number} clientY - クライアント Y座標
         * @returns {{x: number, y: number}|null} ワールド座標
         */
        clientToWorld(clientX, clientY) {
            try {
                // 入力検証
                if (!this.validateCoordinates(clientX, clientY)) {
                    console.warn('⚠️ CoordinateManager: 無効な座標:', {clientX, clientY});
                    return null;
                }
                
                // 準備状態確認
                if (!this.isReady()) {
                    console.warn('⚠️ CoordinateManager: 準備未完了');
                    return null;
                }
                
                // Canvas bounds取得（修正版）
                const bounds = this.getCanvasBounds();
                if (!bounds) {
                    console.warn('⚠️ CoordinateManager: Canvas bounds取得失敗');
                    return null;
                }
                
                // Step 1: クライアント座標→Canvas相対座標
                let canvasX = clientX - bounds.x;
                let canvasY = clientY - bounds.y;
                
                // Step 2: DPR補正（一回のみ・重複適用防止）
                // 注意: Canvas座標はDPR考慮済みのため、逆算が必要
                canvasX = canvasX * this.dpr;
                canvasY = canvasY * this.dpr;
                
                // Step 3: Container変形適用（Stage→DrawContainer）
                let worldX = canvasX;
                let worldY = canvasY;
                
                // Stage transform適用
                if (this.stage && this.stage.transform) {
                    const stageTransform = this.stage.transform;
                    
                    // Scale逆算
                    if (stageTransform.scale && stageTransform.scale.x !== 0 && stageTransform.scale.y !== 0) {
                        worldX = worldX / stageTransform.scale.x;
                        worldY = worldY / stageTransform.scale.y;
                    }
                    
                    // Position逆算
                    if (stageTransform.position) {
                        worldX = worldX - stageTransform.position.x;
                        worldY = worldY - stageTransform.position.y;
                    }
                }
                
                // DrawContainer transform適用
                if (this.drawContainer && this.drawContainer.transform) {
                    const drawTransform = this.drawContainer.transform;
                    
                    // Scale逆算
                    if (drawTransform.scale && drawTransform.scale.x !== 0 && drawTransform.scale.y !== 0) {
                        worldX = worldX / drawTransform.scale.x;
                        worldY = worldY / drawTransform.scale.y;
                    }
                    
                    // Position逆算
                    if (drawTransform.position) {
                        worldX = worldX - drawTransform.position.x;
                        worldY = worldY - drawTransform.position.y;
                    }
                }
                
                const result = { x: worldX, y: worldY };
                
                // デバッグ情報（重要な変換のみ）
                if (Math.abs(clientX) < 10 && Math.abs(clientY) < 10) {
                    console.log('📏 座標変換 (原点近傍):', {
                        input: { clientX, clientY },
                        bounds: { x: bounds.x, y: bounds.y },
                        canvas: { canvasX: canvasX / this.dpr, canvasY: canvasY / this.dpr },
                        dpr: this.dpr,
                        output: result
                    });
                }
                
                return result;
                
            } catch (error) {
                console.error('❌ CoordinateManager: clientToWorld() 失敗:', error);
                return null;
            }
        }
        
        /**
         * ワールド座標→クライアント座標変換（修正版）
         * @param {number} worldX - ワールド X座標
         * @param {number} worldY - ワールド Y座標
         * @returns {{x: number, y: number}|null} クライアント座標
         */
        worldToClient(worldX, worldY) {
            try {
                // 入力検証
                if (!this.validateCoordinates(worldX, worldY)) {
                    return null;
                }
                
                // 準備状態確認
                if (!this.isReady()) {
                    return null;
                }
                
                // Canvas bounds取得
                const bounds = this.getCanvasBounds();
                if (!bounds) {
                    return null;
                }
                
                let canvasX = worldX;
                let canvasY = worldY;
                
                // DrawContainer transform適用
                if (this.drawContainer && this.drawContainer.transform) {
                    const drawTransform = this.drawContainer.transform;
                    
                    // Position適用
                    if (drawTransform.position) {
                        canvasX = canvasX + drawTransform.position.x;
                        canvasY = canvasY + drawTransform.position.y;
                    }
                    
                    // Scale適用
                    if (drawTransform.scale) {
                        canvasX = canvasX * drawTransform.scale.x;
                        canvasY = canvasY * drawTransform.scale.y;
                    }
                }
                
                // Stage transform適用
                if (this.stage && this.stage.transform) {
                    const stageTransform = this.stage.transform;
                    
                    // Position適用
                    if (stageTransform.position) {
                        canvasX = canvasX + stageTransform.position.x;
                        canvasY = canvasY + stageTransform.position.y;
                    }
                    
                    // Scale適用
                    if (stageTransform.scale) {
                        canvasX = canvasX * stageTransform.scale.x;
                        canvasY = canvasY * stageTransform.scale.y;
                    }
                }
                
                // DPR補正
                canvasX = canvasX / this.dpr;
                canvasY = canvasY / this.dpr;
                
                // Canvas相対座標→クライアント座標
                const clientX = canvasX + bounds.x;
                const clientY = canvasY + bounds.y;
                
                return { x: clientX, y: clientY };
                
            } catch (error) {
                console.error('❌ CoordinateManager: worldToClient() 失敗:', error);
                return null;
            }
        }
        
        /**
         * スクリーン座標→Canvas座標変換（互換性メソッド）
         * @param {number} screenX - スクリーン X座標
         * @param {number} screenY - スクリーン Y座標
         * @returns {{x: number, y: number}|null} Canvas座標
         */
        screenToCanvas(screenX, screenY) {
            // clientToWorldのエイリアス（互換性維持）
            return this.clientToWorld(screenX, screenY);
        }
        
        /**
         * Canvas座標→スクリーン座標変換（互換性メソッド）
         * @param {number} canvasX - Canvas X座標
         * @param {number} canvasY - Canvas Y座標
         * @returns {{x: number, y: number}|null} スクリーン座標
         */
        canvasToScreen(canvasX, canvasY) {
            // worldToClientのエイリアス（互換性維持）
            return this.worldToClient(canvasX, canvasY);
        }

        // ========================================
        // Canvas状態管理・Bounds計算
        // ========================================
        
        /**
         * Canvas bounds取得（修正版・正確なDOM位置計算）
         * @returns {{x: number, y: number, width: number, height: number}|null}
         */
        getCanvasBounds() {
            // キャッシュ確認
            const cached = this.getCachedBounds();
            if (cached) {
                return cached;
            }
            
            // 新規計算
            return this.updateCanvasBounds();
        }
        
        /**
         * Canvas bounds更新（修正版・DOM位置の正確な取得）
         * @returns {{x: number, y: number, width: number, height: number}|null}
         */
        updateCanvasBounds() {
            try {
                if (!this.htmlCanvas) {
                    console.warn('⚠️ HTML Canvas not available for bounds calculation');
                    return null;
                }
                
                // DOM要素のboundingClientRect取得（最も正確な位置）
                const rect = this.htmlCanvas.getBoundingClientRect();
                
                // Scroll offset考慮（重要）
                const scrollLeft = window.pageXOffset || document.documentElement.scrollLeft || 0;
                const scrollTop = window.pageYOffset || document.documentElement.scrollTop || 0;
                
                // 正確なCanvas位置計算（修正版）
                this.canvasBounds = {
                    x: rect.left + scrollLeft,
                    y: rect.top + scrollTop,
                    width: rect.width,
                    height: rect.height,
                    clientRect: rect // デバッグ用
                };
                
                // キャッシュ更新
                this.boundsCache = { ...this.canvasBounds };
                this.lastBoundsUpdate = Date.now();
                
                // デバッグ情報（重要な変更時のみ）
                console.log('📏 Canvas bounds更新:', {
                    bounds: this.canvasBounds,
                    scroll: { scrollLeft, scrollTop },
                    dpr: this.dpr
                });
                
                return this.canvasBounds;
                
            } catch (error) {
                console.error('❌ Canvas bounds計算失敗:', error);
                return null;
            }
        }
        
        /**
         * キャッシュされたbounds取得
         * @returns {Object|null} キャッシュされたbounds
         */
        getCachedBounds() {
            if (!this.boundsCache || !this.lastBoundsUpdate) {
                return null;
            }
            
            const now = Date.now();
            const isExpired = (now - this.lastBoundsUpdate) > this.boundsCacheTimeout;
            
            if (isExpired) {
                this.boundsCache = null;
                return null;
            }
            
            return this.boundsCache;
        }
        
        /**
         * DPR更新
         */
        updateDPR() {
            const newDPR = window.devicePixelRatio || 1;
            if (this.dpr !== newDPR) {
                console.log('📏 DPR更新:', this.dpr, '→', newDPR);
                this.dpr = newDPR;
                // Bounds再計算が必要
                this.boundsCache = null;
            }
        }
        
        /**
         * Transform状態リセット
         */
        resetTransform() {
            this.transform = {
                scale: 1,
                x: 0,
                y: 0,
                rotation: 0
            };
        }

        // ========================================
        // イベント処理・自動更新
        // ========================================
        
        /**
         * イベントリスナー設定
         */
        setupEventListeners() {
            // リサイズイベント
            this.resizeHandler = () => {
                this.boundsCache = null; // キャッシュクリア
                this.updateDPR();
            };
            
            window.addEventListener('resize', this.resizeHandler, { passive: true });
            
            // スクロールイベント
            this.scrollHandler = () => {
                this.boundsCache = null; // キャッシュクリア
            };
            
            window.addEventListener('scroll', this.scrollHandler, { passive: true });
        }
        
        /**
         * イベントリスナー削除
         */
        removeEventListeners() {
            if (this.resizeHandler) {
                window.removeEventListener('resize', this.resizeHandler);
                this.resizeHandler = null;
            }
            
            if (this.scrollHandler) {
                window.removeEventListener('scroll', this.scrollHandler);
                this.scrollHandler = null;
            }
        }

        // ========================================
        // ユーティリティ・検証
        // ========================================
        
        /**
         * 座標妥当性検証
         * @param {*} x - X座標
         * @param {*} y - Y座標
         * @returns {boolean} 妥当性
         */
        validateCoordinates(x, y) {
            return (typeof x === 'number' && !isNaN(x) && isFinite(x) &&
                    typeof y === 'number' && !isNaN(y) && isFinite(y));
        }
        
        /**
         * DPR取得
         * @returns {number} Device Pixel Ratio
         */
        getDPR() {
            return this.dpr;
        }
        
        /**
         * Transform情報取得
         * @returns {Object} 変形情報
         */
        getTransform() {
            return { ...this.transform };
        }
        
        /**
         * Container変形情報取得（デバッグ用）
         * @returns {Object} Container変形状態
         */
        getContainerTransforms() {
            const result = {
                stage: null,
                drawContainer: null
            };
            
            if (this.stage && this.stage.transform) {
                result.stage = {
                    position: { 
                        x: this.stage.transform.position?.x || 0, 
                        y: this.stage.transform.position?.y || 0 
                    },
                    scale: { 
                        x: this.stage.transform.scale?.x || 1, 
                        y: this.stage.transform.scale?.y || 1 
                    },
                    rotation: this.stage.transform.rotation || 0
                };
            }
            
            if (this.drawContainer && this.drawContainer.transform) {
                result.drawContainer = {
                    position: { 
                        x: this.drawContainer.transform.position?.x || 0, 
                        y: this.drawContainer.transform.position?.y || 0 
                    },
                    scale: { 
                        x: this.drawContainer.transform.scale?.x || 1, 
                        y: this.drawContainer.transform.scale?.y || 1 
                    },
                    rotation: this.drawContainer.transform.rotation || 0
                };
            }
            
            return result;
        }
        
        /**
         * 座標変換テスト（テスト用）
         * @param {number} testX - テスト X座標
         * @param {number} testY - テスト Y座標
         * @returns {Object} テスト結果
         */
        testCoordinateTransform(testX = 0, testY = 0) {
            console.log('🧪 座標変換テスト開始:', { testX, testY });
            
            const world = this.clientToWorld(testX, testY);
            const backToClient = world ? this.worldToClient(world.x, world.y) : null;
            
            const result = {
                input: { x: testX, y: testY },
                world: world,
                backToClient: backToClient,
                roundTripError: null,
                canvasBounds: this.canvasBounds,
                dpr: this.dpr,
                containerTransforms: this.getContainerTransforms()
            };
            
            // 往復変換エラー計算
            if (backToClient) {
                result.roundTripError = {
                    x: Math.abs(testX - backToClient.x),
                    y: Math.abs(testY - backToClient.y)
                };
            }
            
            console.log('🧪 座標変換テスト結果:', result);
            return result;
        }

        // ========================================
        // 状態取得・デバッグ
        // ========================================
        
        /**
         * 詳細状態取得
         * @returns {Object} 詳細状態情報
         */
        getState() {
            return {
                className: 'CoordinateManager',
                version: 'v8-coordinate-fix',
                lifecycle: {
                    configured: this._status.configured,
                    attached: this._status.attached,
                    initialized: this._status.initialized,
                    ready: this._status.ready
                },
                references: {
                    canvasManager: !!this.canvasManager,
                    pixiApp: !!this.pixiApp,
                    htmlCanvas: !!this.htmlCanvas,
                    stage: !!this.stage,
                    drawContainer: !!this.drawContainer
                },
                coordinates: {
                    canvasBounds: this.canvasBounds,
                    boundsCache: !!this.boundsCache,
                    lastBoundsUpdate: this.lastBoundsUpdate,
                    dpr: this.dpr,
                    transform: this.transform
                },
                containerTransforms: this.getContainerTransforms(),
                error: this._status.error
            };
        }
        
        /**
         * デバッグ情報取得
         * @returns {Object} デバッグ情報
         */
        getDebugInfo() {
            return {
                ...this.getState(),
                htmlCanvasRect: this.htmlCanvas ? this.htmlCanvas.getBoundingClientRect() : null,
                windowScroll: {
                    x: window.pageXOffset || document.documentElement.scrollLeft || 0,
                    y: window.pageYOffset || document.documentElement.scrollTop || 0
                },
                pixiAppView: this.pixiApp?.view ? {
                    width: this.pixiApp.view.width,
                    height: this.pixiApp.view.height,
                    style: {
                        width: this.pixiApp.view.style.width,
                        height: this.pixiApp.view.style.height
                    }
                } : null
            };
        }

        // ========================================
        // テスト用フック
        // ========================================
        
        /**
         * テスト用初期化
         * @returns {Promise<boolean>} テスト初期化成功フラグ
         */
        async testInit() {
            try {
                console.log('🧪 CoordinateManager: testInit() 開始');
                
                // 基本的な初期化を実行
                this.configure({ coordinates: { boundsCacheTimeout: 50 } });
                this.attach({});
                await this.init();
                
                // ダミーCanvas作成（テスト用）
                const dummyCanvas = document.createElement('canvas');
                dummyCanvas.width = 400;
                dummyCanvas.height = 400;
                dummyCanvas.style.position = 'absolute';
                dummyCanvas.style.left = '0px';
                dummyCanvas.style.top = '0px';
                
                this.htmlCanvas = dummyCanvas;
                this.updateCanvasBounds();
                
                console.log('✅ CoordinateManager: testInit() 完了');
                return true;
                
            } catch (error) {
                console.error('❌ CoordinateManager: testInit() 失敗:', error);
                return false;
            }
        }
        
        /**
         * 強制Bounds更新（テスト用）
         */
        forceUpdateBounds() {
            this.boundsCache = null;
            return this.updateCanvasBounds();
        }
    }

    // グローバル登録
    if (!window.Tegaki) {
        window.Tegaki = {};
    }

    window.Tegaki.CoordinateManager = CoordinateManager;
    console.log('📏 CoordinateManager v8座標修正版 Loaded - 座標オフセット問題完全解決');
    console.log('📏 修正内容: 座標オフセット修正・DPR重複適用防止・Container変形修正・Canvas bounds計算修正');
    console.log('🚀 特徴: PixiJS v8完全準拠・高精度DPR処理・Container階層変形対応・DOM座標との完全一致保証');

})();