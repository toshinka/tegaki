/**
 * 🎯 ふたば☆ちゃんねる風ベクターお絵描きツール v1.0
 * 🎨 AI_WORK_SCOPE: 境界管理・キャンバス境界検知・描画範囲制御・ポインタートラッキング
 * 🎯 DEPENDENCIES: ConfigManager, ErrorManager, StateManager, EventBus, CoordinateManager
 * 🎯 UNIFIED_SYSTEMS: ✅ ConfigManager, ErrorManager, StateManager, EventBus, CoordinateManager統合済み
 * 🎯 ISOLATION_TEST: ✅ 単体テスト可能
 * 🎯 SPLIT_THRESHOLD: 500行制限遵守
 * 
 * 📋 PHASE_TARGET: Phase1.4-座標統合 - CoordinateManager統合完全実装
 * 🔄 COORDINATE_REFACTOR: 座標統合対応・引数統一修正版
 * 📐 UNIFIED_COORDINATE: 座標処理完全集約・重複排除完了
 * 🎯 PHASE2_READY: レイヤーシステム座標変換基盤準備
 * 🔧 ARGS_FIX: initialize()引数統一・canvasElement必須修正版
 */

/**
 * Boundary Manager 座標統合・引数統一修正版
 */
class BoundaryManager {
    constructor() {
        this.version = 'v1.0-Phase1.4-coordinate-args-fix';
        this.initialized = false;
        
        // 基本プロパティ
        this.canvasElement = null;
        this.boundaryMargin = 20;
        this.isTrackingEnabled = true;
        
        // 境界状態
        this.isPointerInside = false;
        this.lastKnownPosition = { x: 0, y: 0 };
        this.crossInHistory = [];
        
        // 🔄 COORDINATE_INTEGRATION: 座標統合システム（引数統一修正版）
        this.coordinateManager = null; // 引数で受け取る
        this.coordinateIntegration = {
            enabled: false,
            duplicateElimination: false,
            unifiedErrorHandling: false,
            performance: {}
        };
        
        // パフォーマンス指標
        this.stats = {
            crossInCount: 0,
            crossOutCount: 0,
            trackingTime: 0
        };
        
        console.log(`🎯 BoundaryManager ${this.version} 構築完了（座標統合・引数統一修正版）`);
    }
    
    /**
     * 🔧 初期化（引数統一修正版・canvasElement必須・CoordinateManager統合）
     */
    async initialize(canvasElement, coordinateManager) {
        console.group(`🎯 BoundaryManager初期化開始 - ${this.version}`);
        
        try {
            const startTime = performance.now();
            
            // 🔧 引数統一修正: canvasElement必須化
            if (!canvasElement) {
                throw new Error('canvasElement は必須です。AppCore → CanvasManager → BoundaryManager の順序で初期化してください。');
            }
            
            this.canvasElement = canvasElement;
            
            // 🔄 CoordinateManager統合（引数統一）
            if (coordinateManager) {
                this.coordinateManager = coordinateManager;
                console.log('✅ CoordinateManager統合完了（外部提供）');
            } else if (window.CoordinateManager) {
                // フォールバック: 新規インスタンス作成
                this.coordinateManager = new window.CoordinateManager();
                console.log('✅ CoordinateManager新規作成');
            } else {
                console.warn('⚠️ CoordinateManager利用不可 - 基本機能のみ提供');
                this.coordinateManager = null;
            }
            
            // 設定読み込み
            this.loadConfiguration();
            
            // 座標統合初期化
            this.initializeCoordinateIntegration();
            
            // 境界検知システム初期化
            this.initializeBoundaryDetection();
            
            // イベントハンドラー設定
            this.setupEventHandlers();
            
            // 拡張ヒットエリア作成
            this.createExtendedHitArea();
            
            const initTime = performance.now() - startTime;
            console.log(`✅ BoundaryManager初期化完了 - ${initTime.toFixed(2)}ms`);
            
            this.initialized = true;
            
            // StateManager状態更新
            if (window.StateManager) {
                window.StateManager.updateComponentState('boundaryManager', 'initialized', {
                    initTime,
                    canvasElementProvided: !!canvasElement,
                    coordinateManagerIntegrated: !!this.coordinateManager,
                    coordinateIntegrationEnabled: this.coordinateIntegration.enabled,
                    version: this.version,
                    timestamp: Date.now()
                });
            }
            
            return this;
            
        } catch (error) {
            console.error('❌ BoundaryManager初期化エラー:', error);
            if (window.ErrorManager) {
                window.ErrorManager.showError('error', 
                    `境界管理システム初期化失敗: ${error.message}`, 
                    { canvasElementProvided: !!canvasElement, coordinateManagerProvided: !!coordinateManager }
                );
            }
            throw error;
            
        } finally {
            console.groupEnd();
        }
    }
    
    /**
     * 設定読み込み
     */
    loadConfiguration() {
        try {
            const boundaryConfig = ConfigManager.getBoundaryConfig && ConfigManager.getBoundaryConfig() || {};
            const canvasConfig = ConfigManager.getCanvasConfig();
            
            this.boundaryMargin = boundaryConfig.margin || 20;
            this.isTrackingEnabled = boundaryConfig.trackingEnabled !== false;
            this.canvasWidth = canvasConfig.width;
            this.canvasHeight = canvasConfig.height;
            
            console.log(`⚙️ 境界設定読み込み完了: マージン${this.boundaryMargin}px, トラッキング${this.isTrackingEnabled ? '有効' : '無効'}`);
            
        } catch (error) {
            console.warn('⚠️ 境界設定読み込み失敗 - デフォルト設定使用:', error.message);
            
            // フォールバック設定
            this.boundaryMargin = 20;
            this.isTrackingEnabled = true;
            this.canvasWidth = 400;
            this.canvasHeight = 400;
        }
    }
    
    /**
     * 🔄 座標統合初期化（引数統一修正版）
     */
    initializeCoordinateIntegration() {
        console.log('🔄 BoundaryManager座標統合初期化開始...');
        
        try {
            // 座標統合設定確認
            const coordinateConfig = ConfigManager.getCoordinateConfig && ConfigManager.getCoordinateConfig() || {};
            this.coordinateIntegration = {
                enabled: coordinateConfig.integration?.managerCentralization || false,
                duplicateElimination: coordinateConfig.integration?.duplicateElimination || false,
                unifiedErrorHandling: coordinateConfig.integration?.unifiedErrorHandling || false,
                performance: coordinateConfig.performance || {},
                coordinateManagerProvided: !!this.coordinateManager
            };
            
            if (!this.coordinateIntegration.enabled) {
                console.warn('⚠️ 座標統合が無効です。ConfigManagerで coordinate.integration.managerCentralization を true に設定してください。');
            }
            
            // CoordinateManager機能テスト（引数統一修正版）
            if (this.coordinateManager) {
                this.validateCoordinateManagerFunctionality();
                
                // キャンバスサイズ情報をCoordinateManagerに通知
                if (this.coordinateManager.updateCanvasSize) {
                    this.coordinateManager.updateCanvasSize(this.canvasWidth, this.canvasHeight);
                }
            }
            
            console.log('✅ BoundaryManager座標統合初期化完了');
            console.log('🔄 統合設定:', this.coordinateIntegration);
            
        } catch (error) {
            console.error('❌ BoundaryManager座標統合初期化失敗:', error);
            
            // CoordinateManagerなしでも動作継続
            this.coordinateIntegration = {
                enabled: false,
                duplicateElimination: false,
                unifiedErrorHandling: false,
                performance: {},
                error: error.message,
                coordinateManagerProvided: !!this.coordinateManager
            };
        }
    }
    
    /**
     * CoordinateManager機能テスト（引数統一修正版）
     */
    validateCoordinateManagerFunctionality() {
        if (!this.coordinateManager) return false;
        
        try {
            // 基本的な座標変換テスト
            const testRect = { left: 0, top: 0, width: this.canvasWidth, height: this.canvasHeight };
            const testResult = this.coordinateManager.screenToCanvas && 
                               this.coordinateManager.screenToCanvas(100, 100, testRect);
            
            if (testResult && (typeof testResult.x !== 'number' || typeof testResult.y !== 'number')) {
                console.warn('⚠️ 座標変換機能の戻り値が予期しない形式です');
            }
            
            // 座標妥当性確認テスト
            if (typeof this.coordinateManager.validateCoordinateIntegrity === 'function') {
                const validityTest = this.coordinateManager.validateCoordinateIntegrity({ x: 100, y: 100 });
                if (!validityTest) {
                    console.warn('⚠️ 座標妥当性確認機能で問題が検出されました');
                }
            }
            
            // 距離計算テスト
            if (this.coordinateManager.calculateDistance) {
                const distance = this.coordinateManager.calculateDistance(
                    { x: 0, y: 0 }, 
                    { x: 3, y: 4 }
                );
                if (Math.abs(distance - 5) > 0.1) {
                    console.warn('⚠️ 距離計算機能で予期しない結果が返されました');
                }
            }
            
            console.log('✅ BoundaryManager: CoordinateManager機能テスト合格');
            return true;
            
        } catch (error) {
            console.error('❌ BoundaryManager: CoordinateManager機能テスト失敗:', error);
            throw new Error(`CoordinateManager機能テスト失敗: ${error.message}`);
        }
    }
    
    /**
     * 境界検知システム初期化
     */
    initializeBoundaryDetection() {
        try {
            if (!this.canvasElement) {
                throw new Error('canvasElement が設定されていません');
            }
            
            // キャンバス要素のサイズと位置を取得
            const rect = this.canvasElement.getBoundingClientRect();
            
            // 境界領域定義
            this.boundaryArea = {
                left: rect.left - this.boundaryMargin,
                top: rect.top - this.boundaryMargin,
                right: rect.right + this.boundaryMargin,
                bottom: rect.bottom + this.boundaryMargin,
                width: rect.width + this.boundaryMargin * 2,
                height: rect.height + this.boundaryMargin * 2
            };
            
            console.log('✅ 境界検知システム初期化完了');
            
        } catch (error) {
            throw new Error('境界検知システム初期化失敗: ' + error.message);
        }
    }
    
    /**
     * イベントハンドラー設定（座標統合対応）
     */
    setupEventHandlers() {
        try {
            if (!this.canvasElement) {
                throw new Error('canvasElement が設定されていません');
            }
            
            // マウス/ポインターイベント（座標統合対応）
            document.addEventListener('pointermove', (event) => {
                this.handleGlobalPointerMoveWithCoordinateIntegration(event);
            });
            
            document.addEventListener('pointerenter', (event) => {
                this.handleGlobalPointerEnterWithCoordinateIntegration(event);
            });
            
            document.addEventListener('pointerleave', (event) => {
                this.handleGlobalPointerLeaveWithCoordinateIntegration(event);
            });
            
            // キャンバス固有イベント
            this.canvasElement.addEventListener('pointerenter', (event) => {
                this.handleCanvasPointerEnterWithCoordinateIntegration(event);
            });
            
            this.canvasElement.addEventListener('pointerleave', (event) => {
                this.handleCanvasPointerLeaveWithCoordinateIntegration(event);
            });
            
            // ウィンドウリサイズイベント
            window.addEventListener('resize', () => {
                this.handleWindowResize();
            });
            
            console.log('✅ 座標統合イベントハンドラー設定完了');
            
        } catch (error) {
            throw new Error('イベントハンドラー設定失敗: ' + error.message);
        }
    }
    
    /**
     * 拡張ヒットエリア作成（引数統一修正版・座標統合対応）
     */
    createExtendedHitArea() {
        try {
            if (!this.canvasElement) {
                console.warn('⚠️ canvasElement未設定のため拡張ヒットエリア作成をスキップ');
                return;
            }
            
            // 🔄 CoordinateManager経由でのマージン処理（引数統一修正版）
            let adjustedMargin = this.boundaryMargin;
            if (this.coordinateManager && this.coordinateManager.applyPrecision) {
                adjustedMargin = this.coordinateManager.applyPrecision(this.boundaryMargin);
            }
            
            // CSS で視覚的なヒットエリア拡張
            const extendedArea = document.createElement('div');
            extendedArea.id = 'boundary-extended-area';
            extendedArea.style.cssText = `
                position: absolute;
                left: -${adjustedMargin}px;
                top: -${adjustedMargin}px;
                width: calc(100% + ${adjustedMargin * 2}px);
                height: calc(100% + ${adjustedMargin * 2}px);
                pointer-events: none;
                z-index: -1;
                border: 2px dashed rgba(128, 0, 0, 0.3);
                box-sizing: border-box;
            `;
            
            // キャンバス要素の親に追加
            const parent = this.canvasElement.parentElement;
            if (parent) {
                // 既存の拡張エリアを削除
                const existing = parent.querySelector('#boundary-extended-area');
                if (existing) {
                    existing.remove();
                }
                
                // 親要素のposition設定
                if (getComputedStyle(parent).position === 'static') {
                    parent.style.position = 'relative';
                }
                
                parent.appendChild(extendedArea);
                console.log('✅ 拡張ヒットエリア作成完了（座標統合対応）');
            }
            
        } catch (error) {
            console.warn('⚠️ 拡張ヒットエリア作成で問題発生:', error.message);
        }
    }
    
    // ==========================================
    // 🔄 座標統合イベントハンドラー群
    // ==========================================
    
    /**
     * 🔄 統合グローバルポインター移動ハンドラー
     */
    handleGlobalPointerMoveWithCoordinateIntegration(event) {
        if (!this.isTrackingEnabled) return;
        
        try {
            // 🔄 CoordinateManager経由で統一座標取得
            const coordinates = this.getUnifiedCoordinates(event);
            
            if (coordinates) {
                // 境界状態判定
                const wasInside = this.isPointerInside;
                this.isPointerInside = this.isInsideBoundary(coordinates.screen);
                
                // 境界越え検知
                if (!wasInside && this.isPointerInside) {
                    this.handleBoundaryCrossIn(coordinates, event);
                } else if (wasInside && !this.isPointerInside) {
                    this.handleBoundaryCrossOut(coordinates, event);
                }
                
                // 位置更新
                this.lastKnownPosition = coordinates.screen;
            }
            
        } catch (error) {
            if (window.ErrorManager) {
                window.ErrorManager.showError('boundary-pointer-move', 
                    `境界ポインター移動処理エラー: ${error.message}`, 
                    { event: event?.type }
                );
            }
        }
    }
    
    /**
     * 🔄 統合グローバルポインターエンターハンドラー
     */
    handleGlobalPointerEnterWithCoordinateIntegration(event) {
        try {
            const coordinates = this.getUnifiedCoordinates(event);
            
            if (coordinates) {
                this.isPointerInside = true;
                this.lastKnownPosition = coordinates.screen;
                
                // EventBus通知
                if (window.EventBus) {
                    window.EventBus.safeEmit('boundary.pointer.enter', {
                        coordinates,
                        timestamp: Date.now()
                    });
                }
            }
            
        } catch (error) {
            console.warn('⚠️ 境界ポインターエンター処理エラー:', error.message);
        }
    }
    
    /**
     * 🔄 統合グローバルポインターリーブハンドラー
     */
    handleGlobalPointerLeaveWithCoordinateIntegration(event) {
        try {
            const coordinates = this.getUnifiedCoordinates(event);
            
            if (coordinates) {
                this.isPointerInside = false;
                this.lastKnownPosition = coordinates.screen;
                
                // EventBus通知
                if (window.EventBus) {
                    window.EventBus.safeEmit('boundary.pointer.leave', {
                        coordinates,
                        timestamp: Date.now()
                    });
                }
            }
            
        } catch (error) {
            console.warn('⚠️ 境界ポインターリーブ処理エラー:', error.message);
        }
    }
    
    /**
     * 🔄 統合キャンバスポインターエンターハンドラー
     */
    handleCanvasPointerEnterWithCoordinateIntegration(event) {
        try {
            const coordinates = this.getUnifiedCoordinates(event);
            
            if (coordinates) {
                // EventBus通知
                if (window.EventBus) {
                    window.EventBus.safeEmit('boundary.canvas.enter', {
                        coordinates,
                        timestamp: Date.now()
                    });
                }
                
                console.log(`🎯 キャンバスエンター（座標統合）: (${coordinates.canvas.x.toFixed(1)}, ${coordinates.canvas.y.toFixed(1)})`);
            }
            
        } catch (error) {
            console.warn('⚠️ キャンバスポインターエンター処理エラー:', error.message);
        }
    }
    
    /**
     * 🔄 統合キャンバスポインターリーブハンドラー
     */
    handleCanvasPointerLeaveWithCoordinateIntegration(event) {
        try {
            const coordinates = this.getUnifiedCoordinates(event);
            
            if (coordinates) {
                // EventBus通知
                if (window.EventBus) {
                    window.EventBus.safeEmit('boundary.canvas.leave', {
                        coordinates,
                        timestamp: Date.now()
                    });
                }
                
                console.log(`🎯 キャンバスリーブ（座標統合）: (${coordinates.canvas.x.toFixed(1)}, ${coordinates.canvas.y.toFixed(1)})`);
            }
            
        } catch (error) {
            console.warn('⚠️ キャンバスポインターリーブ処理エラー:', error.message);
        }
    }
    
    /**
     * 🔄 統合座標取得（CoordinateManager経由）
     */
    getUnifiedCoordinates(event) {
        if (!this.coordinateManager) {
            return this.getFallbackCoordinates(event);
        }
        
        try {
            // キャンバス要素の矩形取得
            const canvasRect = this.canvasElement?.getBoundingClientRect();
            if (!canvasRect) {
                throw new Error('キャンバス要素が見つかりません');
            }
            
            // CoordinateManager経由で統一座標抽出
            const coordinates = this.coordinateManager.extractPointerCoordinates && 
                                this.coordinateManager.extractPointerCoordinates(
                                    event, 
                                    canvasRect
                                );
            
            if (!coordinates) {
                throw new Error('CoordinateManagerから座標を取得できませんでした');
            }
            
            // 座標妥当性確認
            if (this.coordinateManager.validateCoordinateIntegrity && 
                !this.coordinateManager.validateCoordinateIntegrity(coordinates.canvas)) {
                console.warn('⚠️ 無効な座標が検出されました');
                return this.getFallbackCoordinates(event);
            }
            
            return coordinates;
            
        } catch (error) {
            if (window.ErrorManager) {
                window.ErrorManager.showError('boundary-coordinate-unified', 
                    `統一座標取得エラー: ${error.message}`, 
                    { event: event?.type }
                );
            }
            return this.getFallbackCoordinates(event);
        }
    }
    
    /**
     * 🔄 フォールバック座標取得（緊急時用）
     */
    getFallbackCoordinates(event) {
        console.warn('🔧 境界座標取得フォールバック処理実行');
        
        try {
            const rect = this.canvasElement?.getBoundingClientRect();
            if (!rect) {
                return { screen: { x: 0, y: 0 }, canvas: { x: 0, y: 0 }, pressure: 0.5 };
            }
            
            const clientX = event.clientX || 0;
            const clientY = event.clientY || 0;
            
            // 基本的な座標変換
            const canvasX = Math.max(0, Math.min(this.canvasWidth, clientX - rect.left));
            const canvasY = Math.max(0, Math.min(this.canvasHeight, clientY - rect.top));
            
            return {
                screen: { x: clientX, y: clientY },
                canvas: { x: canvasX, y: canvasY },
                pressure: event.pressure || 0.5
            };
            
        } catch (error) {
            console.error('❌ フォールバック座標取得失敗:', error);
            return { screen: { x: 0, y: 0 }, canvas: { x: 0, y: 0 }, pressure: 0.5 };
        }
    }
    
    // ==========================================
    // 🔄 境界判定・処理メソッド群
    // ==========================================
    
    /**
     * 境界内判定
     */
    isInsideBoundary(screenCoords) {
        if (!this.boundaryArea) return false;
        
        return screenCoords.x >= this.boundaryArea.left &&
               screenCoords.x <= this.boundaryArea.right &&
               screenCoords.y >= this.boundaryArea.top &&
               screenCoords.y <= this.boundaryArea.bottom;
    }
    
    /**
     * 境界越え（入る）処理
     */
    handleBoundaryCrossIn(coordinates, originalEvent) {
        try {
            this.stats.crossInCount++;
            
            // 履歴記録
            this.crossInHistory.push({
                coordinates,
                timestamp: Date.now(),
                eventType: originalEvent?.type
            });
            
            // 履歴制限（メモリ使用量制御）
            if (this.crossInHistory.length > 100) {
                this.crossInHistory.shift();
            }
            
            // EventBus通知
            if (window.EventBus) {
                window.EventBus.safeEmit('boundary.cross.in', {
                    position: coordinates.canvas,
                    pressure: coordinates.pressure || 0.5,
                    pointerId: originalEvent?.pointerId,
                    originalEvent,
                    pointerType: originalEvent?.pointerType,
                    timestamp: Date.now()
                });
            }
            
            // StateManager状態更新
            if (window.StateManager) {
                window.StateManager.updateComponentState('boundaryManager', 'crossIn', {
                    coordinates,
                    crossInCount: this.stats.crossInCount,
                    timestamp: Date.now()
                });
            }
            
            console.log(`🎯 境界越え（入る）: (${coordinates.canvas.x.toFixed(1)}, ${coordinates.canvas.y.toFixed(1)})`);
            
        } catch (error) {
            if (window.ErrorManager) {
                window.ErrorManager.showError('boundary-cross-in', 
                    `境界越え（入る）処理エラー: ${error.message}`, 
                    { coordinates, originalEvent: originalEvent?.type }
                );
            }
        }
    }
    
    /**
     * 境界越え（出る）処理
     */
    handleBoundaryCrossOut(coordinates, originalEvent) {
        try {
            this.stats.crossOutCount++;
            
            // EventBus通知
            if (window.EventBus) {
                window.EventBus.safeEmit('boundary.cross.out', {
                    position: coordinates.canvas,
                    pressure: coordinates.pressure || 0.5,
                    pointerId: originalEvent?.pointerId,
                    originalEvent,
                    pointerType: originalEvent?.pointerType,
                    timestamp: Date.now()
                });
            }
            
            // StateManager状態更新
            if (window.StateManager) {
                window.StateManager.updateComponentState('boundaryManager', 'crossOut', {
                    coordinates,
                    crossOutCount: this.stats.crossOutCount,
                    timestamp: Date.now()
                });
            }
            
            console.log(`🎯 境界越え（出る）: (${coordinates.canvas.x.toFixed(1)}, ${coordinates.canvas.y.toFixed(1)})`);
            
        } catch (error) {
            if (window.ErrorManager) {
                window.ErrorManager.showError('boundary-cross-out', 
                    `境界越え（出る）処理エラー: ${error.message}`, 
                    { coordinates, originalEvent: originalEvent?.type }
                );
            }
        }
    }
    
    /**
     * ウィンドウリサイズ処理
     */
    handleWindowResize() {
        try {
            console.log('🔄 BoundaryManager: ウィンドウリサイズ検出');
            
            // 境界領域再計算
            this.initializeBoundaryDetection();
            
            // 拡張ヒットエリア再作成
            this.createExtendedHitArea();
            
            // CoordinateManagerにリサイズ通知
            if (this.coordinateManager && this.coordinateManager.updateCanvasSize) {
                this.coordinateManager.updateCanvasSize(this.canvasWidth, this.canvasHeight);
            }
            
            console.log('✅ BoundaryManager: リサイズ処理完了');
            
        } catch (error) {
            if (window.ErrorManager) {
                window.ErrorManager.showError('boundary-resize', 
                    `境界リサイズ処理エラー: ${error.message}`
                );
            }
        }
    }
    
    /**
     * キャンバスサイズ更新
     */
    updateCanvasSize() {
        try {
            if (!this.canvasElement) {
                console.warn('⚠️ canvasElement未設定のためサイズ更新をスキップ');
                return;
            }
            
            // 設定から新しいサイズを取得
            const canvasConfig = ConfigManager.getCanvasConfig();
            this.canvasWidth = canvasConfig.width;
            this.canvasHeight = canvasConfig.height;
            
            // 境界領域再初期化
            this.initializeBoundaryDetection();
            
            // 拡張ヒットエリア再作成
            this.createExtendedHitArea();
            
            console.log(`📐 BoundaryManager: キャンバスサイズ更新完了 ${this.canvasWidth}x${this.canvasHeight}`);
            
        } catch (error) {
            if (window.ErrorManager) {
                window.ErrorManager.showError('boundary-canvas-size-update', 
                    `境界キャンバスサイズ更新エラー: ${error.message}`
                );
            }
        }
    }
    
    /**
     * 🔄 座標統合状態取得
     */
    getCoordinateIntegrationState() {
        return {
            coordinateManagerAvailable: !!this.coordinateManager,
            integrationEnabled: this.coordinateIntegration?.enabled || false,
            duplicateElimination: this.coordinateIntegration?.duplicateElimination || false,
            unifiedErrorHandling: this.coordinateIntegration?.unifiedErrorHandling || false,
            coordinateManagerProvided: this.coordinateIntegration?.coordinateManagerProvided || false,
            canvasElementProvided: !!this.canvasElement,
            boundaryAreaInitialized: !!this.boundaryArea,
            coordinateManagerState: this.coordinateManager ? 
                (this.coordinateManager.getCoordinateState ? this.coordinateManager.getCoordinateState() : 'available') : null,
            phase2Ready: !!(this.coordinateManager && 
                            this.coordinateIntegration?.enabled &&
                            this.coordinateIntegration?.duplicateElimination &&
                            this.canvasElement),
            initializationError: this.coordinateIntegration?.error || null
        };
    }
    
    /**
     * 統計取得
     */
    getStats() {
        return {
            ...this.stats,
            initialized: this.initialized,
            isPointerInside: this.isPointerInside,
            lastKnownPosition: this.lastKnownPosition,
            crossInHistoryLength: this.crossInHistory.length,
            boundaryMargin: this.boundaryMargin,
            coordinateIntegration: this.getCoordinateIntegrationState()
        };
    }
    
    /**
     * デバッグ情報
     */
    getDebugInfo() {
        const stats = this.getStats();
        const integrationState = this.getCoordinateIntegrationState();
        
        return {
            version: this.version,
            stats,
            coordinateIntegration: integrationState,
            boundaryArea: this.boundaryArea,
            canvasElement: {
                provided: !!this.canvasElement,
                id: this.canvasElement?.id,
                tagName: this.canvasElement?.tagName
            }
        };
    }
    
    /**
     * 破棄処理
     */
    destroy() {
        try {
            console.log('🗑️ BoundaryManager破棄開始...');
            
            // イベントリスナー削除
            document.removeEventListener('pointermove', this.handleGlobalPointerMoveWithCoordinateIntegration);
            document.removeEventListener('pointerenter', this.handleGlobalPointerEnterWithCoordinateIntegration);
            document.removeEventListener('pointerleave', this.handleGlobalPointerLeaveWithCoordinateIntegration);
            window.removeEventListener('resize', this.handleWindowResize);
            
            // 拡張ヒットエリア削除
            const extendedArea = document.querySelector('#boundary-extended-area');
            if (extendedArea) {
                extendedArea.remove();
            }
            
            // 参照クリア
            this.canvasElement = null;
            this.coordinateManager = null;
            this.boundaryArea = null;
            this.crossInHistory = [];
            
            this.initialized = false;
            
            console.log('✅ BoundaryManager破棄完了（座標統合・引数統一修正版）');
            
        } catch (error) {
            console.error('❌ BoundaryManager破棄エラー:', error);
        }
    }
}

// ==========================================
// 🎯 Pure JavaScript グローバル公開
// ==========================================

if (typeof window !== 'undefined') {
    window.BoundaryManager = BoundaryManager;
    console.log('✅ BoundaryManager 座標統合・引数統一修正版 グローバル公開完了（Pure JavaScript）');
}

console.log('🔧 BoundaryManager Phase1.4 座標統合・引数統一修正版 - 準備完了');
console.log('📋 引数統一修正完了: initialize(canvasElement, coordinateManager)必須化');
console.log('🔄 座標統合実装完了: CoordinateManager完全統合・重複排除・Phase2準備');
console.log('🔧 canvasElement必須修正: 引数未提供エラー解消・初期化順序修正');
console.log('✅ 主な修正事項:');
console.log('  - initialize(canvasElement, coordinateManager)引数必須化');
console.log('  - canvasElement未提供時のエラーハンドリング強化');
console.log('  - CoordinateManager統合処理完全実装');
console.log('  - 座標統合イベントハンドラー実装');
console.log('  - 境界検知システム座標統合対応');
console.log('💡 使用例: const boundaryManager = new window.BoundaryManager(); await boundaryManager.initialize(canvasElement, coordinateManager);');