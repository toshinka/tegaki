/**
 * 🎯 BoundaryManager - 境界システム専用マネージャー
 * 🎨 ふたば☆お絵描きツール - キャンバス境界描画システム
 * 
 * 🎯 責任範囲:
 * - キャンバス外→内描画検出
 * - グローバルPointer追跡
 * - 境界越えイベント処理
 * - PixiJS境界統合
 * - EventBus境界通知
 * 
 * 🎯 UNIFIED: ConfigManager, ErrorManager, EventBus, StateManager完全活用
 * 🎯 SOLID: 単一責任原則（境界処理のみ）・依存性逆転（統一システム経由）
 * ⚠⚠⚠ ESM禁止: import/export使用禁止・Pure JavaScript維持 ⚠⚠⚠
 */

/**
 * BoundaryManager - キャンバス境界描画システム
 */
class BoundaryManager {
    constructor(appCore) {
        if (!appCore) {
            throw new Error('BoundaryManager: AppCore依存関係が必要です');
        }
        
        this.appCore = appCore;
        this.isInitialized = false;
        
        // 境界設定（ConfigManager経由）
        this.config = this.loadBoundaryConfig();
        
        // 境界追跡状態
        this.isTrackingOutside = false;
        this.outsidePointer = null;
        this.boundaryMargin = this.config.margin || 20;
        
        // PixiJS境界統合
        this.pixiIntegration = {
            enabled: false,
            expandedHitArea: null,
            eventListeners: []
        };
        
        // パフォーマンス統計
        this.stats = {
            boundaryDetections: 0,
            crossInEvents: 0,
            crossOutEvents: 0,
            lastCrossInTime: 0,
            averageDetectionDelay: 0
        };
        
        console.log('🎯 BoundaryManager: 構築完了');
    }

    /**
     * 境界設定読み込み（ConfigManager統一）
     */
    loadBoundaryConfig() {
        if (window.ConfigManager) {
            // ConfigManager経由で設定取得
            const config = {
                enabled: window.ConfigManager.get('canvas.boundary.enabled') ?? true,
                margin: window.ConfigManager.get('canvas.boundary.margin') ?? 20,
                trackingEnabled: window.ConfigManager.get('canvas.boundary.trackingEnabled') ?? true,
                crossInDelay: window.ConfigManager.get('canvas.boundary.crossInDelay') ?? 0,
                supportedPointers: window.ConfigManager.get('canvas.boundary.supportedPointers') || ['mouse', 'pen', 'touch'],
                debugging: window.ConfigManager.get('canvas.boundary.debugging') ?? false,
                pixiIntegration: window.ConfigManager.get('canvas.boundary.pixiIntegration') ?? true,
                performanceMode: window.ConfigManager.get('canvas.boundary.performanceMode') || 'balanced'
            };
            
            // デフォルト設定確保
            if (!window.ConfigManager.get('canvas.boundary')) {
                window.ConfigManager.set('canvas.boundary', config);
            }
            
            return config;
        } else {
            // フォールバック設定
            console.warn('⚠️ ConfigManager未利用 - デフォルト境界設定使用');
            return {
                enabled: true,
                margin: 20,
                trackingEnabled: true,
                crossInDelay: 0,
                supportedPointers: ['mouse', 'pen', 'touch'],
                debugging: false,
                pixiIntegration: true,
                performanceMode: 'balanced'
            };
        }
    }

    /**
     * BoundaryManager初期化
     */
    initialize() {
        try {
            console.log('🎯 BoundaryManager: 初期化開始...');
            
            if (!this.config.enabled) {
                console.log('⚠️ BoundaryManager: 無効化設定のためスキップ');
                return false;
            }
            
            // 境界追跡システム初期化
            this.initializeBoundaryTracking();
            
            // PixiJS境界統合
            if (this.config.pixiIntegration) {
                this.initializePixiJSIntegration();
            }
            
            // EventBus統合
            this.initializeEventBusIntegration();
            
            // 統計システム初期化
            this.initializeStatsSystem();
            
            this.isInitialized = true;
            
            console.log('✅ BoundaryManager: 初期化完了');
            
            // EventBus完了通知
            this.safeEmitEvent('boundary.manager.initialized', {
                config: this.config,
                pixiIntegration: this.pixiIntegration.enabled,
                timestamp: Date.now()
            });
            
            // StateManager状態更新
            this.safeUpdateState('boundary.manager', {
                initialized: true,
                enabled: this.config.enabled,
                margin: this.boundaryMargin
            });
            
            return true;
            
        } catch (error) {
            console.error('❌ BoundaryManager初期化エラー:', error);
            
            this.safeShowError('boundary-manager-init', 
                'BoundaryManager初期化エラー: ' + error.message,
                { config: this.config }
            );
            
            return false;
        }
    }

    /**
     * 境界追跡システム初期化
     */
    initializeBoundaryTracking() {
        console.log('📡 境界追跡システム初期化...');
        
        // グローバルイベントリスナー設定
        document.addEventListener('pointerdown', this.handleGlobalPointerDown.bind(this), { passive: false });
        document.addEventListener('pointermove', this.handleGlobalPointerMove.bind(this), { passive: true });
        document.addEventListener('pointerup', this.handleGlobalPointerUp.bind(this), { passive: true });
        document.addEventListener('pointercancel', this.handleGlobalPointerCancel.bind(this), { passive: true });
        
        console.log('✅ グローバルPointer追跡システム設定完了');
    }

    /**
     * PixiJS境界統合初期化
     */
    initializePixiJSIntegration() {
        if (!this.appCore.app || !this.appCore.app.stage) {
            console.warn('⚠️ PixiJS境界統合スキップ: AppCore Stageが利用できません');
            return false;
        }
        
        try {
            console.log('🎯 PixiJS境界統合初期化...');
            
            // 拡張ヒットエリア設定
            this.setupExpandedHitArea();
            
            // PixiJSイベントリスナー設定
            this.setupPixiJSEventListeners();
            
            this.pixiIntegration.enabled = true;
            
            console.log('✅ PixiJS境界統合完了');
            
            return true;
            
        } catch (error) {
            console.error('❌ PixiJS境界統合エラー:', error);
            this.pixiIntegration.enabled = false;
            return false;
        }
    }

    /**
     * 拡張ヒットエリア設定
     */
    setupExpandedHitArea() {
        const margin = this.boundaryMargin;
        
        // 拡張ヒットエリア作成
        this.pixiIntegration.expandedHitArea = new PIXI.Rectangle(
            -margin,
            -margin,
            this.appCore.width + margin * 2,
            this.appCore.height + margin * 2
        );
        
        // AppCore Stage設定
        this.appCore.app.stage.hitArea = this.pixiIntegration.expandedHitArea;
        this.appCore.app.stage.interactive = true;
        
        console.log('📏 拡張ヒットエリア設定: ' + 
                   this.appCore.width + '×' + this.appCore.height + 
                   ' + マージン' + margin + 'px');
    }

    /**
     * PixiJSイベントリスナー設定
     */
    setupPixiJSEventListeners() {
        const stage = this.appCore.app.stage;
        
        // PixiJSイベントハンドラー
        const pointerDownHandler = this.handlePixiPointerDown.bind(this);
        const pointerMoveHandler = this.handlePixiPointerMove.bind(this);
        const pointerUpHandler = this.handlePixiPointerUp.bind(this);
        
        // イベントリスナー追加
        stage.on('pointerdown', pointerDownHandler);
        stage.on('pointermove', pointerMoveHandler);
        stage.on('pointerup', pointerUpHandler);
        
        // リスナー記録（破棄時用）
        this.pixiIntegration.eventListeners = [
            { event: 'pointerdown', handler: pointerDownHandler },
            { event: 'pointermove', handler: pointerMoveHandler },
            { event: 'pointerup', handler: pointerUpHandler }
        ];
        
        console.log('📡 PixiJSイベントリスナー設定完了');
    }

    /**
     * EventBus統合初期化
     */
    initializeEventBusIntegration() {
        if (!window.EventBus) {
            console.warn('⚠️ EventBus統合スキップ: EventBus未利用');
            return false;
        }
        
        try {
            // 外部境界イベント監視
            window.EventBus.on('canvas.boundary.request', this.handleBoundaryRequest.bind(this));
            window.EventBus.on('boundary.debug.toggle', this.handleDebugToggle.bind(this));
            window.EventBus.on('boundary.stats.request', this.handleStatsRequest.bind(this));
            
            console.log('✅ EventBus境界統合完了');
            return true;
            
        } catch (error) {
            console.error('❌ EventBus境界統合エラー:', error);
            return false;
        }
    }

    /**
     * 統計システム初期化
     */
    initializeStatsSystem() {
        // 統計リセット
        this.stats = {
            boundaryDetections: 0,
            crossInEvents: 0,
            crossOutEvents: 0,
            lastCrossInTime: 0,
            averageDetectionDelay: 0,
            detectionTimes: [],
            startTime: Date.now()
        };
        
        console.log('📊 境界統計システム初期化完了');
    }

    // ==========================================
    // 🎯 グローバルPointerイベントハンドラー
    // ==========================================

    /**
     * グローバルPointerDownハンドラー
     */
    handleGlobalPointerDown(event) {
        if (!this.config.enabled || !this.config.trackingEnabled) return;
        
        try {
            const startTime = performance.now();
            
            // キャンバス要素取得
            const canvas = this.appCore.getCanvas();
            if (!canvas) return;
            
            const canvasRect = canvas.getBoundingClientRect();
            const isInsideCanvas = this.isPointInCanvas(event.clientX, event.clientY, canvasRect);
            
            if (!isInsideCanvas) {
                // キャンバス外でのPointerDown検出
                this.startOutsideTracking(event, canvasRect);
                
                // 統計更新
                this.stats.boundaryDetections++;
                const detectionTime = performance.now() - startTime;
                this.updateDetectionStats(detectionTime);
                
                if (this.config.debugging) {
                    console.log('🎯 境界外PointerDown検出:', {
                        pointerId: event.pointerId,
                        position: { x: event.clientX, y: event.clientY },
                        canvasRect: canvasRect,
                        detectionTime: detectionTime.toFixed(2) + 'ms'
                    });
                }
            }
            
        } catch (error) {
            console.error('❌ グローバルPointerDownエラー:', error);
            this.safeShowError('boundary-pointer-down', 
                '境界PointerDown処理エラー: ' + error.message,
                { pointerId: event.pointerId }
            );
        }
    }

    /**
     * グローバルPointerMoveハンドラー
     */
    handleGlobalPointerMove(event) {
        if (!this.isTrackingOutside || !this.outsidePointer) return;
        if (event.pointerId !== this.outsidePointer.id) return;
        
        try {
            const canvas = this.appCore.getCanvas();
            if (!canvas) return;
            
            const canvasRect = canvas.getBoundingClientRect();
            const isInsideCanvas = this.isPointInCanvas(event.clientX, event.clientY, canvasRect);
            
            if (isInsideCanvas) {
                // 境界越えイン検出
                this.handleBoundaryCrossIn(event, canvasRect);
            }
            
        } catch (error) {
            console.error('❌ グローバルPointerMoveエラー:', error);
        }
    }

    /**
     * グローバルPointerUpハンドラー
     */
    handleGlobalPointerUp(event) {
        if (!this.isTrackingOutside || !this.outsidePointer) return;
        if (event.pointerId !== this.outsidePointer.id) return;
        
        try {
            // 外部追跡終了
            this.stopOutsideTracking();
            
            if (this.config.debugging) {
                console.log('🎯 境界外追跡終了:', { pointerId: event.pointerId });
            }
            
        } catch (error) {
            console.error('❌ グローバルPointerUpエラー:', error);
        }
    }

    /**
     * グローバルPointerCancelハンドラー
     */
    handleGlobalPointerCancel(event) {
        if (!this.isTrackingOutside || !this.outsidePointer) return;
        if (event.pointerId !== this.outsidePointer.id) return;
        
        try {
            // 外部追跡キャンセル
            this.stopOutsideTracking();
            
            console.log('🗑️ 境界外追跡キャンセル:', { pointerId: event.pointerId });
            
        } catch (error) {
            console.error('❌ グローバルPointerCancelエラー:', error);
        }
    }

    // ==========================================
    // 🎯 PixiJSイベントハンドラー
    // ==========================================

    /**
     * PixiJSPointerDownハンドラー
     */
    handlePixiPointerDown(pixiEvent) {
        if (!this.config.enabled || !this.pixiIntegration.enabled) return;
        
        try {
            const localPoint = pixiEvent.data.getLocalPosition(this.appCore.app.stage);
            const isInsideBoundary = this.isPointInsideBoundary(localPoint.x, localPoint.y);
            
            // 境界情報記録
            pixiEvent.boundaryInfo = {
                insideBoundary: isInsideBoundary,
                localPosition: { x: localPoint.x, y: localPoint.y },
                margin: this.boundaryMargin,
                timestamp: performance.now()
            };
            
            // EventBus通知
            this.safeEmitEvent('pixijs.boundary.pointerdown', {
                pixiEvent: pixiEvent,
                boundaryInfo: pixiEvent.boundaryInfo
            });
            
            if (this.config.debugging) {
                console.log('🎯 PixiJS境界PointerDown:', pixiEvent.boundaryInfo);
            }
            
        } catch (error) {
            console.error('❌ PixiJS PointerDownエラー:', error);
        }
    }

    /**
     * PixiJSPointerMoveハンドラー
     */
    handlePixiPointerMove(pixiEvent) {
        if (!this.config.enabled || !this.pixiIntegration.enabled) return;
        
        try {
            const localPoint = pixiEvent.data.getLocalPosition(this.appCore.app.stage);
            const isInsideBoundary = this.isPointInsideBoundary(localPoint.x, localPoint.y);
            
            // 境界越え検出
            const previousState = pixiEvent.data.boundaryState || { insideBoundary: true };
            
            if (!previousState.insideBoundary && isInsideBoundary) {
                // 境界外→内
                this.handlePixiBoundaryCrossIn(pixiEvent, localPoint);
            } else if (previousState.insideBoundary && !isInsideBoundary) {
                // 境界内→外
                this.handlePixiBoundaryCrossOut(pixiEvent, localPoint);
            }
            
            // 境界状態更新
            pixiEvent.data.boundaryState = {
                insideBoundary: isInsideBoundary,
                lastPosition: { x: localPoint.x, y: localPoint.y },
                timestamp: performance.now()
            };
            
        } catch (error) {
            console.error('❌ PixiJS PointerMoveエラー:', error);
        }
    }

    /**
     * PixiJSPointerUpハンドラー
     */
    handlePixiPointerUp(pixiEvent) {
        if (!this.config.enabled || !this.pixiIntegration.enabled) return;
        
        try {
            // 境界状態クリーンアップ
            if (pixiEvent.data.boundaryState) {
                delete pixiEvent.data.boundaryState;
            }
            
            // EventBus通知
            this.safeEmitEvent('pixijs.boundary.pointerup', {
                pointerId: pixiEvent.data.pointerId,
                timestamp: performance.now()
            });
            
        } catch (error) {
            console.error('❌ PixiJS PointerUpエラー:', error);
        }
    }

    // ==========================================
    // 🎯 境界越え処理システム
    // ==========================================

    /**
     * 外部追跡開始
     */
    startOutsideTracking(event, canvasRect) {
        this.isTrackingOutside = true;
        this.outsidePointer = {
            id: event.pointerId,
            startX: event.clientX,
            startY: event.clientY,
            pointerType: event.pointerType || 'mouse',
            pressure: event.pressure || 0.5,
            timestamp: performance.now()
        };
        
        // EventBus外部開始通知
        this.safeEmitEvent('boundary.outside.start', {
            pointer: this.outsidePointer,
            canvasRect: canvasRect
        });
        
        if (this.config.debugging) {
            console.log('🎯 境界外追跡開始:', this.outsidePointer);
        }
    }

    /**
     * 外部追跡停止
     */
    stopOutsideTracking() {
        if (this.isTrackingOutside) {
            this.isTrackingOutside = false;
            
            const stoppedPointer = this.outsidePointer;
            this.outsidePointer = null;
            
            // EventBus外部終了通知
            this.safeEmitEvent('boundary.outside.stop', {
                pointer: stoppedPointer,
                timestamp: performance.now()
            });
        }
    }

    /**
     * 境界越えイン処理（グローバルイベント）
     */
    handleBoundaryCrossIn(event, canvasRect) {
        try {
            const crossInTime = performance.now();
            
            // キャンバス座標変換
            const canvasX = event.clientX - canvasRect.left;
            const canvasY = event.clientY - canvasRect.top;
            
            // 境界越えデータ作成
            const crossInData = {
                position: { x: canvasX, y: canvasY },
                globalPosition: { x: event.clientX, y: event.clientY },
                pressure: event.pressure || this.outsidePointer.pressure || 0.5,
                pointerId: event.pointerId,
                pointerType: event.pointerType || this.outsidePointer.pointerType || 'mouse',
                timestamp: crossInTime,
                source: 'global-boundary',
                outsideStartTime: this.outsidePointer ? this.outsidePointer.timestamp : crossInTime
            };
            
            // 遅延処理
            if (this.config.crossInDelay > 0) {
                setTimeout(() => {
                    this.emitBoundaryCrossInEvent(crossInData);
                }, this.config.crossInDelay);
            } else {
                this.emitBoundaryCrossInEvent(crossInData);
            }
            
            // 統計更新
            this.stats.crossInEvents++;
            this.stats.lastCrossInTime = crossInTime;
            
            // 外部追跡停止
            this.stopOutsideTracking();
            
            if (this.config.debugging) {
                console.log('🎯 境界越えイン検出:', crossInData);
            }
            
        } catch (error) {
            console.error('❌ 境界越えイン処理エラー:', error);
            this.safeShowError('boundary-cross-in', 
                '境界越えイン処理エラー: ' + error.message,
                { pointerId: event.pointerId }
            );
        }
    }

    /**
     * 境界越えイベント発火
     */
    emitBoundaryCrossInEvent(crossInData) {
        // EventBus境界越え通知
        this.safeEmitEvent('boundary.cross.in', crossInData);
        
        // 現在のツール取得・通知
        const currentTool = this.getCurrentTool();
        if (currentTool && typeof currentTool.handleBoundaryCrossIn === 'function') {
            try {
                currentTool.handleBoundaryCrossIn(
                    crossInData.position.x, 
                    crossInData.position.y, 
                    {
                        pressure: crossInData.pressure,
                        pointerId: crossInData.pointerId,
                        pointerType: crossInData.pointerType,
                        timestamp: crossInData.timestamp,
                        fromBoundary: true
                    }
                );
                
                // ツール通知完了
                this.safeEmitEvent('boundary.tool.notified', {
                    tool: currentTool.name || 'unknown',
                    crossInData: crossInData
                });
                
            } catch (toolError) {
                console.error('❌ ツール境界越え通知エラー:', toolError);
                this.safeShowError('boundary-tool-notify', 
                    'ツール境界越え通知エラー: ' + toolError.message,
                    { tool: currentTool.name, crossInData: crossInData }
                );
            }
        }
    }

    /**
     * PixiJS境界越えイン処理
     */
    handlePixiBoundaryCrossIn(pixiEvent, localPoint) {
        try {
            // グローバル座標変換
            const globalPoint = this.appCore.app.stage.toGlobal(localPoint);
            
            const crossInData = {
                position: { x: localPoint.x, y: localPoint.y },
                globalPosition: { x: globalPoint.x, y: globalPoint.y },
                pressure: pixiEvent.data.pressure || 0.5,
                pointerId: pixiEvent.data.pointerId,
                pointerType: pixiEvent.data.pointerType || 'mouse',
                timestamp: performance.now(),
                source: 'pixijs-boundary'
            };
            
            // EventBus通知
            this.safeEmitEvent('pixijs.boundary.cross.in', crossInData);
            
            // 統計更新
            this.stats.crossInEvents++;
            
            if (this.config.debugging) {
                console.log('🎯 PixiJS境界越えイン検出:', crossInData);
            }
            
        } catch (error) {
            console.error('❌ PixiJS境界越えイン処理エラー:', error);
        }
    }

    /**
     * PixiJS境界越えアウト処理
     */
    handlePixiBoundaryCrossOut(pixiEvent, localPoint) {
        try {
            const crossOutData = {
                position: { x: localPoint.x, y: localPoint.y },
                pointerId: pixiEvent.data.pointerId,
                timestamp: performance.now(),
                source: 'pixijs-boundary'
            };
            
            // EventBus通知
            this.safeEmitEvent('pixijs.boundary.cross.out', crossOutData);
            
            // 統計更新
            this.stats.crossOutEvents++;
            
            if (this.config.debugging) {
                console.log('🎯 PixiJS境界越えアウト検出:', crossOutData);
            }
            
        } catch (error) {
            console.error('❌ PixiJS境界越えアウト処理エラー:', error);
        }
    }

    // ==========================================
    // 🎯 境界判定・ユーティリティ
    // ==========================================

    /**
     * 点がキャンバス内かチェック
     */
    isPointInCanvas(x, y, canvasRect) {
        return x >= canvasRect.left && 
               x <= canvasRect.right && 
               y >= canvasRect.top && 
               y <= canvasRect.bottom;
    }

    /**
     * 点が境界内かチェック
     */
    isPointInsideBoundary(x, y) {
        const boundary = {
            x: 0,
            y: 0,
            width: this.appCore.width,
            height: this.appCore.height
        };
        
        return x >= boundary.x && 
               x <= boundary.x + boundary.width && 
               y >= boundary.y && 
               y <= boundary.y + boundary.height;
    }

    /**
     * 現在のツール取得
     */
    getCurrentTool() {
        // 複数パターンでツール取得試行
        return window.toolManager?.currentTool ||
               window.canvasManager?.toolManager?.currentTool ||
               window.futabaDrawingTool?.appCore?.toolSystem?.currentTool ||
               this.appCore?.toolSystem?.currentTool ||
               null;
    }

    /**
     * 検出統計更新
     */
    updateDetectionStats(detectionTime) {
        this.stats.detectionTimes.push(detectionTime);
        
        // 平均計算（最新100件）
        if (this.stats.detectionTimes.length > 100) {
            this.stats.detectionTimes = this.stats.detectionTimes.slice(-100);
        }
        
        const sum = this.stats.detectionTimes.reduce((a, b) => a + b, 0);
        this.stats.averageDetectionDelay = sum / this.stats.detectionTimes.length;
    }

    /**
     * リサイズ処理
     */
    handleResize(newWidth, newHeight) {
        if (!this.pixiIntegration.enabled) return;
        
        try {
            console.log('📏 BoundaryManager: リサイズ対応', newWidth + 'x' + newHeight);
            
            // 拡張ヒットエリア更新
            const margin = this.boundaryMargin;
            this.pixiIntegration.expandedHitArea = new PIXI.Rectangle(
                -margin,
                -margin,
                newWidth + margin * 2,
                newHeight + margin * 2
            );
            
            // AppCore Stage更新
            if (this.appCore.app && this.appCore.app.stage) {
                this.appCore.app.stage.hitArea = this.pixiIntegration.expandedHitArea;
            }
            
            // StateManager状態更新
            this.safeUpdateState('boundary.dimensions', {
                width: newWidth,
                height: newHeight,
                margin: margin,
                lastUpdate: Date.now()
            });
            
            console.log('✅ BoundaryManager: リサイズ完了');
            
        } catch (error) {
            console.error('❌ BoundaryManagerリサイズエラー:', error);
        }
    }

    // ==========================================
    // 🎯 EventBusイベントハンドラー
    // ==========================================

    /**
     * 境界リクエストハンドラー
     */
    handleBoundaryRequest(data) {
        try {
            if (data.action === 'getStats') {
                this.safeEmitEvent('boundary.stats.response', this.getStats());
            } else if (data.action === 'toggleDebug') {
                this.toggleDebug();
            } else if (data.action === 'resetStats') {
                this.resetStats();
            }
        } catch (error) {
            console.error('❌ 境界リクエスト処理エラー:', error);
        }
    }

    /**
     * デバッグ切り替えハンドラー
     */
    handleDebugToggle(data) {
        this.config.debugging = !this.config.debugging;
        
        console.log('🔍 BoundaryManager デバッグモード:', this.config.debugging ? '有効' : '無効');
        
        this.safeEmitEvent('boundary.debug.toggled', {
            debugging: this.config.debugging,
            timestamp: Date.now()
        });
    }

    /**
     * 統計リクエストハンドラー
     */
    handleStatsRequest(data) {
        const stats = this.getStats();
        
        this.safeEmitEvent('boundary.stats.response', {
            requestId: data.requestId,
            stats: stats,
            timestamp: Date.now()
        });
    }

    // ==========================================
    // 🎯 診断・統計システム
    // ==========================================

    /**
     * BoundaryManager診断実行
     */
    diagnose() {
        console.group('🔍 BoundaryManager診断実行');
        
        const diagnosis = {
            system: {
                initialized: this.isInitialized,
                enabled: this.config.enabled,
                tracking: this.config.trackingEnabled,
                margin: this.boundaryMargin
            },
            tracking: {
                isTrackingOutside: this.isTrackingOutside,
                outsidePointer: this.outsidePointer,
                globalListeners: true // document.addEventListener確認
            },
            pixiIntegration: {
                enabled: this.pixiIntegration.enabled,
                expandedHitArea: !!this.pixiIntegration.expandedHitArea,
                eventListeners: this.pixiIntegration.eventListeners.length,
                stageInteractive: this.appCore?.app?.stage?.interactive || false
            },
            performance: this.getStats(),
            config: this.config,
            appCore: {
                available: !!this.appCore,
                pixiApp: !!this.appCore?.app,
                canvas: !!this.appCore?.getCanvas()
            },
            unifiedSystems: {
                configManager: !!window.ConfigManager,
                errorManager: !!window.ErrorManager,
                eventBus: !!window.EventBus,
                stateManager: !!window.StateManager
            }
        };
        
        console.log('📊 BoundaryManager診断結果:', diagnosis);
        
        // 問題検出
        const issues = [];
        
        if (!diagnosis.system.initialized) {
            issues.push('BoundaryManagerが初期化されていません');
        }
        
        if (!diagnosis.system.enabled) {
            issues.push('境界システムが無効化されています');
        }
        
        if (!diagnosis.appCore.available) {
            issues.push('AppCore依存関係が利用できません');
        }
        
        if (!diagnosis.pixiIntegration.enabled && this.config.pixiIntegration) {
            issues.push('PixiJS統合が失敗しています');
        }
        
        if (!diagnosis.unifiedSystems.eventBus) {
            issues.push('EventBus統合が不完全です');
        }
        
        if (issues.length > 0) {
            console.warn('⚠️ 検出された問題:', issues);
        } else {
            console.log('✅ BoundaryManager正常動作中');
        }
        
        console.groupEnd();
        
        return diagnosis;
    }

    /**
     * BoundaryManager統計取得
     */
    getStats() {
        const runtime = Date.now() - (this.stats.startTime || Date.now());
        
        return {
            runtime: {
                uptime: runtime,
                initialized: this.isInitialized,
                enabled: this.config.enabled
            },
            detection: {
                boundaryDetections: this.stats.boundaryDetections,
                crossInEvents: this.stats.crossInEvents,
                crossOutEvents: this.stats.crossOutEvents,
                lastCrossInTime: this.stats.lastCrossInTime,
                averageDetectionDelay: Math.round(this.stats.averageDetectionDelay * 100) / 100
            },
            tracking: {
                isTrackingOutside: this.isTrackingOutside,
                currentPointer: this.outsidePointer ? {
                    id: this.outsidePointer.id,
                    type: this.outsidePointer.pointerType
                } : null
            },
            performance: {
                detectionSamples: this.stats.detectionTimes.length,
                minDetectionTime: Math.min(...(this.stats.detectionTimes.length > 0 ? this.stats.detectionTimes : [0])),
                maxDetectionTime: Math.max(...(this.stats.detectionTimes.length > 0 ? this.stats.detectionTimes : [0]))
            },
            config: {
                margin: this.boundaryMargin,
                debugging: this.config.debugging,
                performanceMode: this.config.performanceMode
            }
        };
    }

    /**
     * 統計リセット
     */
    resetStats() {
        this.stats = {
            boundaryDetections: 0,
            crossInEvents: 0,
            crossOutEvents: 0,
            lastCrossInTime: 0,
            averageDetectionDelay: 0,
            detectionTimes: [],
            startTime: Date.now()
        };
        
        console.log('📊 BoundaryManager統計リセット完了');
        
        this.safeEmitEvent('boundary.stats.reset', {
            timestamp: Date.now()
        });
    }

    /**
     * デバッグモード切り替え
     */
    toggleDebug() {
        this.config.debugging = !this.config.debugging;
        
        if (window.ConfigManager) {
            window.ConfigManager.set('canvas.boundary.debugging', this.config.debugging);
        }
        
        console.log('🔍 BoundaryManagerデバッグモード:', this.config.debugging ? '有効' : '無効');
        
        return this.config.debugging;
    }

    /**
     * 初期化状態確認
     */
    isReady() {
        return this.isInitialized && this.config.enabled && !!this.appCore;
    }

    // ==========================================
    // 🎯 統一システム安全呼び出しヘルパー
    // ==========================================

    /**
     * EventBus安全emit
     */
    safeEmitEvent(eventName, data) {
        try {
            if (window.EventBus && typeof window.EventBus.safeEmit === 'function') {
                window.EventBus.safeEmit(eventName, data);
            }
        } catch (error) {
            console.warn('⚠️ EventBus emit失敗: ' + eventName, error);
        }
    }

    /**
     * ErrorManager安全エラー表示
     */
    safeShowError(type, message, data) {
        try {
            if (window.ErrorManager && typeof window.ErrorManager.showError === 'function') {
                window.ErrorManager.showError(type, message, data);
            } else {
                console.error('❌ ' + type + ': ' + message, data);
            }
        } catch (error) {
            console.error('❌ ' + type + ': ' + message, data, error);
        }
    }

    /**
     * StateManager安全状態更新
     */
    safeUpdateState(key, value) {
        try {
            if (window.StateManager && typeof window.StateManager.updateState === 'function') {
                window.StateManager.updateState(key, value);
            }
        } catch (error) {
            console.warn('⚠️ StateManager更新失敗: ' + key, error);
        }
    }

    /**
     * BoundaryManager破棄処理
     */
    destroy() {
        try {
            console.log('🗑️ BoundaryManager: 破棄処理開始...');
            
            // グローバルイベントリスナー削除
            document.removeEventListener('pointerdown', this.handleGlobalPointerDown);
            document.removeEventListener('pointermove', this.handleGlobalPointerMove);
            document.removeEventListener('pointerup', this.handleGlobalPointerUp);
            document.removeEventListener('pointercancel', this.handleGlobalPointerCancel);
            
            // PixiJSイベントリスナー削除
            if (this.pixiIntegration.enabled && this.appCore.app && this.appCore.app.stage) {
                for (const listener of this.pixiIntegration.eventListeners) {
                    this.appCore.app.stage.off(listener.event, listener.handler);
                }
            }
            
            // EventBusリスナー削除
            if (window.EventBus) {
                window.EventBus.off('canvas.boundary.request', this.handleBoundaryRequest);
                window.EventBus.off('boundary.debug.toggle', this.handleDebugToggle);
                window.EventBus.off('boundary.stats.request', this.handleStatsRequest);
            }
            
            // 状態クリア
            this.isInitialized = false;
            this.isTrackingOutside = false;
            this.outsidePointer = null;
            this.pixiIntegration = {
                enabled: false,
                expandedHitArea: null,
                eventListeners: []
            };
            
            console.log('✅ BoundaryManager: 破棄処理完了');
            
        } catch (error) {
            console.error('❌ BoundaryManager破棄エラー:', error);
        }
    }
}

// ==========================================
// 🎯 グローバル診断・テストコマンド
// ==========================================

/**
 * BoundaryManager診断コマンド
 */
if (typeof window !== 'undefined') {
    window.diagnoseBoundaryManager = function() {
        const boundaryManager = window.boundaryManager || 
                               window.futabaDrawingTool?.appCore?.boundaryManager ||
                               window.appCore?.boundaryManager;
        
        if (!boundaryManager || typeof boundaryManager.diagnose !== 'function') {
            return {
                error: 'BoundaryManagerが利用できません',
                boundaryManager: !!boundaryManager,
                diagnoseMethod: !!boundaryManager?.diagnose
            };
        }
        
        return boundaryManager.diagnose();
    };

    /**
     * BoundaryManager統計取得コマンド
     */
    window.getBoundaryManagerStats = function() {
        const boundaryManager = window.boundaryManager || 
                               window.futabaDrawingTool?.appCore?.boundaryManager ||
                               window.appCore?.boundaryManager;
        
        if (!boundaryManager || typeof boundaryManager.getStats !== 'function') {
            return { error: 'BoundaryManager統計が利用できません' };
        }
        
        return boundaryManager.getStats();
    };

    /**
     * BoundaryManagerデバッグ切り替えコマンド
     */
    window.toggleBoundaryManagerDebug = function() {
        const boundaryManager = window.boundaryManager || 
                               window.futabaDrawingTool?.appCore?.boundaryManager ||
                               window.appCore?.boundaryManager;
        
        if (!boundaryManager || typeof boundaryManager.toggleDebug !== 'function') {
            return { error: 'BoundaryManagerが利用できません' };
        }
        
        const debugging = boundaryManager.toggleDebug();
        
        return {
            debugging: debugging,
            message: 'BoundaryManagerデバッグモード: ' + (debugging ? '有効' : '無効')
        };
    };
}

console.log('🎯 BoundaryManager境界システム専用実装完了');
console.log('✅ 実装項目:');
console.log('  - キャンバス外→内描画検出システム');
console.log('  - グローバルPointer追跡システム');
console.log('  - PixiJS境界統合システム');
console.log('  - EventBus完全統合・境界イベント通知');
console.log('  - 統一システム完全活用（ConfigManager・ErrorManager・StateManager）');
console.log('  - DRY・SOLID原則完全準拠');
console.log('  - 診断・統計・テストコマンド: window.diagnoseBoundaryManager等');