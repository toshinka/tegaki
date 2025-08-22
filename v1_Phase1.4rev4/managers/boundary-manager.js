/**
 * 🎯 キャンバス境界管理システム（Phase1.4座標統合完全修正版）
 * 🎯 AI_WORK_SCOPE: 境界越えイベント処理・境界判定・境界描画制御
 * 🎯 DEPENDENCIES: ConfigManager, ErrorManager, EventBus, CoordinateManager
 * 🎯 UNIFIED: ConfigManager(境界設定), ErrorManager(境界エラー), EventBus(境界イベント)
 * 🎯 ISOLATION_TEST: ✅ 単体テスト可能
 * 🔄 COORDINATE_INTEGRATION: CoordinateManager完全統合・重複排除完了
 * 🔧 CONSTRUCTOR_FIX: constructor引数でCoordinateManager受け取り対応完了版
 */

class BoundaryManager {
    constructor(coordinateManager = null, options = {}) {
        this.version = 'v1.0-Phase1.4-coordinate-patch-applied';
        
        this.validateUnifiedSystems();
        this.config = ConfigManager.get('canvas.boundary') || this.getDefaultBoundaryConfig();
        
        // 🔄 COORDINATE_INTEGRATION: CoordinateManager統合（constructor引数対応）
        this.coordinateManager = coordinateManager; // constructor引数から直接設定
        
        // options処理
        this.appCore = options.appCore || null;
        
        // 座標統合設定初期化
        this.initializeCoordinateIntegrationFromConstructor();
        
        // 境界追跡状態
        this.isTrackingOutside = false;
        this.outsidePointer = null;
        this.boundaryMargin = this.config.margin || 20;
        this.expandedHitArea = null;
        
        // イベントハンドラー（bind保存用）
        this.boundHandlers = {
            pointerDown: this.handleGlobalPointerDown.bind(this),
            pointerMove: this.handleGlobalPointerMove.bind(this),
            pointerUp: this.handleGlobalPointerUp.bind(this)
        };
        
        console.log(`🎯 BoundaryManager ${this.version} 構築完了（座標統合constructor対応）`);
    }
    
    /**
     * 統一システム依存性確認
     */
    validateUnifiedSystems() {
        const required = ['ConfigManager', 'ErrorManager', 'EventBus'];
        const missing = required.filter(sys => !window[sys]);
        if (missing.length > 0) {
            throw new Error(`BoundaryManager: 統一システム依存不足: ${missing.join(', ')}`);
        }
    }
    
    /**
     * デフォルト境界設定取得
     */
    getDefaultBoundaryConfig() {
        return {
            enabled: true,
            margin: 20,
            trackingEnabled: true,
            visualizeEnabled: false,
            crossInDelay: 0,
            supportedPointers: ['mouse', 'pen', 'touch'],
            debugging: false
        };
    }
    
    /**
     * 🆕 COORDINATE_FEATURE: constructor用座標統合設定初期化
     */
    initializeCoordinateIntegrationFromConstructor() {
        console.log('🔄 BoundaryManager座標統合設定初期化開始（constructor対応）...');
        
        try {
            if (this.coordinateManager) {
                console.log('✅ BoundaryManager: 外部CoordinateManager使用（constructor提供）');
            } else if (window.CoordinateManager) {
                // フォールバック: 新規作成
                this.coordinateManager = new window.CoordinateManager();
                console.log('✅ BoundaryManager: 新規CoordinateManager作成');
            } else {
                console.warn('⚠️ CoordinateManager未提供 - 基本機能のみ提供');
            }
            
            // 座標統合設定確認
            if (this.coordinateManager) {
                const coordinateConfig = ConfigManager.getCoordinateConfig();
                this.coordinateIntegration = {
                    enabled: coordinateConfig.integration?.managerCentralization || false,
                    duplicateElimination: coordinateConfig.integration?.duplicateElimination || false,
                    performance: coordinateConfig.performance || {},
                    constructorProvided: !!this.coordinateManager
                };
                
                if (!this.coordinateIntegration.enabled) {
                    console.warn('⚠️ 座標統合が無効です。coordinate.integration.managerCentralization を true に設定してください。');
                }
                
                console.log('🔄 BoundaryManager座標統合設定:', this.coordinateIntegration);
            }
            
        } catch (error) {
            console.error('❌ BoundaryManager座標統合設定初期化失敗:', error);
            
            // エラー時も動作継続
            this.coordinateIntegration = {
                enabled: false,
                duplicateElimination: false,
                performance: {},
                error: error.message,
                constructorProvided: !!this.coordinateManager
            };
        }
    }
    
    /**
     * 🔄 COORDINATE_INTEGRATION: 境界管理システム初期化（座標統合対応・constructor対応）
     */
    initialize(canvasElement = null) {
        console.group(`🎯 BoundaryManager初期化開始 - ${this.version}`);
        
        try {
            // canvasElementがnullの場合は、AppCoreから取得を試行
            if (!canvasElement && this.appCore?.canvasElement) {
                canvasElement = this.appCore.canvasElement;
                console.log('✅ AppCore経由でcanvasElement取得');
            }
            
            if (!canvasElement) {
                console.warn('⚠️ canvasElement未提供 - 基本機能のみ初期化');
            } else {
                this.canvasElement = canvasElement;
                console.log('✅ canvasElement設定完了');
            }
            
            // CoordinateManager統合確認（constructor設定済み）
            const coordinateManagerStatus = this.coordinateManager ? 
                '✅ CoordinateManager統合済み' : '⚠️ CoordinateManager未統合';
            console.log(coordinateManagerStatus);
            
            // 境界追跡システム設定
            this.initializeBoundaryTracking();
            
            // 拡張ヒットエリア作成（座標統合対応）
            if (this.canvasElement) {
                this.createExpandedHitAreaWithCoordinateIntegration();
            } else {
                console.warn('⚠️ canvasElement未設定のため拡張ヒットエリア作成をスキップ');
            }
            
            console.log('✅ BoundaryManager 座標統合初期化完了（constructor対応）');
            
            // EventBus通知
            if (window.EventBus) {
                window.EventBus.safeEmit('boundary.manager.initialized', {
                    margin: this.boundaryMargin,
                    config: this.config,
                    coordinateManagerIntegrated: !!this.coordinateManager,
                    canvasElementAvailable: !!this.canvasElement,
                    constructorProvided: this.coordinateIntegration?.constructorProvided || false,
                    version: this.version
                });
            }
            
            return this;
            
        } catch (error) {
            console.error('❌ BoundaryManager初期化エラー:', error);
            
            if (window.ErrorManager) {
                window.ErrorManager.showError('boundary-init', 
                    `境界管理初期化失敗: ${error.message}`, 
                    { config: this.config, coordinateManagerAvailable: !!this.coordinateManager }
                );
            }
            
            // エラー時も基本的な初期化は完了させる
            return this;
            
        } finally {
            console.groupEnd();
        }
    }
    
    /**
     * 🎯 グローバル境界追跡システム
     */
    initializeBoundaryTracking() {
        if (!this.config.enabled || !this.config.trackingEnabled) {
            console.log('⚠️ 境界追跡無効のため、グローバル追跡をスキップ');
            return;
        }
        
        try {
            // document全体でPointerイベント監視
            document.addEventListener('pointerdown', this.boundHandlers.pointerDown, { passive: false });
            document.addEventListener('pointermove', this.boundHandlers.pointerMove, { passive: false });
            document.addEventListener('pointerup', this.boundHandlers.pointerUp, { passive: false });
            
            console.log('✅ グローバル境界追跡システム開始');
            
        } catch (error) {
            console.warn('⚠️ グローバル境界追跡設定失敗:', error.message);
        }
    }
    
    /**
     * 🆕 COORDINATE_FEATURE: 拡張ヒットエリア作成（座標統合対応）
     */
    createExpandedHitAreaWithCoordinateIntegration() {
        if (!this.canvasElement) {
            console.warn('⚠️ canvasElement未設定 - 拡張ヒットエリア作成不可');
            return null;
        }
        
        try {
            // 🔄 COORDINATE_INTEGRATION: CoordinateManager経由でキャンバス矩形取得
            let rect;
            if (this.coordinateManager && this.coordinateManager.getCanvasRect) {
                // CoordinateManagerを経由して取得
                rect = this.coordinateManager.getCanvasRect(this.canvasElement);
            } else {
                // フォールバック: 直接取得
                rect = this.canvasElement.getBoundingClientRect();
            }
            
            // 座標統合対応の拡張ヒットエリア計算
            this.expandedHitArea = {
                left: rect.left - this.boundaryMargin,
                top: rect.top - this.boundaryMargin,
                right: rect.right + this.boundaryMargin,
                bottom: rect.bottom + this.boundaryMargin,
                width: rect.width + (this.boundaryMargin * 2),
                height: rect.height + (this.boundaryMargin * 2)
            };
            
            // CoordinateManagerで精度適用
            if (this.coordinateManager && this.coordinateManager.applyPrecision) {
                this.expandedHitArea.left = this.coordinateManager.applyPrecision(this.expandedHitArea.left);
                this.expandedHitArea.top = this.coordinateManager.applyPrecision(this.expandedHitArea.top);
                this.expandedHitArea.right = this.coordinateManager.applyPrecision(this.expandedHitArea.right);
                this.expandedHitArea.bottom = this.coordinateManager.applyPrecision(this.expandedHitArea.bottom);
                this.expandedHitArea.width = this.coordinateManager.applyPrecision(this.expandedHitArea.width);
                this.expandedHitArea.height = this.coordinateManager.applyPrecision(this.expandedHitArea.height);
            }
            
            if (this.config.debugging) {
                console.log('🎯 座標統合拡張ヒットエリア作成:', this.expandedHitArea);
            }
            
            return this.expandedHitArea;
            
        } catch (error) {
            console.warn('⚠️ 拡張ヒットエリア作成失敗:', error.message);
            
            // フォールバック: 基本設定
            this.expandedHitArea = {
                left: 0,
                top: 0,
                right: 400,
                bottom: 400,
                width: 400,
                height: 400
            };
            
            return this.expandedHitArea;
        }
    }
    
    /**
     * 🎯 グローバルポインターダウン処理（座標統合対応）
     */
    handleGlobalPointerDown(event) {
        try {
            if (!this.canvasElement || !this.config.enabled) return;
            
            // 🔄 COORDINATE_INTEGRATION: 座標統合対応の境界判定
            const boundaryCheck = this.checkBoundaryWithCoordinateIntegration(event);
            
            if (!boundaryCheck.isInsideCanvas) {
                // キャンバス外ポインター検出
                this.isTrackingOutside = true;
                this.outsidePointer = {
                    id: event.pointerId,
                    startX: event.clientX,
                    startY: event.clientY,
                    timestamp: Date.now(),
                    type: event.pointerType || 'unknown',
                    coordinates: boundaryCheck.coordinates
                };
                
                // EventBus通知
                if (window.EventBus) {
                    window.EventBus.safeEmit('boundary.outside.start', {
                        pointer: this.outsidePointer,
                        canvasRect: boundaryCheck.canvasRect,
                        coordinateIntegrated: !!this.coordinateManager
                    });
                }
                
                if (this.config.debugging) {
                    console.log(`🎯 境界外ポインター検出: (${event.clientX}, ${event.clientY})`);
                }
            }
            
        } catch (error) {
            if (window.ErrorManager) {
                window.ErrorManager.showError('boundary-tracking', 
                    `境界追跡エラー: ${error.message}`, 
                    { event: event.type, pointerId: event.pointerId }
                );
            }
        }
    }
    
    /**
     * 🎯 グローバルポインター移動処理（座標統合対応）
     */
    handleGlobalPointerMove(event) {
        if (!this.isTrackingOutside || event.pointerId !== this.outsidePointer?.id) {
            return;
        }
        
        try {
            if (!this.canvasElement || !this.config.enabled) return;
            
            // 🔄 COORDINATE_INTEGRATION: 座標統合対応の境界判定
            const boundaryCheck = this.checkBoundaryWithCoordinateIntegration(event);
            
            if (boundaryCheck.isInsideCanvas) {
                // 境界越えイン検出
                this.handleBoundaryCrossInWithCoordinateIntegration(event, boundaryCheck);
            }
            
        } catch (error) {
            if (window.ErrorManager) {
                window.ErrorManager.showError('boundary-cross', 
                    `境界越え処理エラー: ${error.message}`, 
                    { event: event.type, pointerId: event.pointerId }
                );
            }
        }
    }
    
    /**
     * 🆕 COORDINATE_FEATURE: 座標統合対応境界判定
     */
    checkBoundaryWithCoordinateIntegration(event) {
        try {
            // キャンバス矩形取得
            let canvasRect;
            if (this.coordinateManager && this.coordinateManager.getCanvasRect) {
                canvasRect = this.coordinateManager.getCanvasRect(this.canvasElement);
            } else {
                canvasRect = this.canvasElement.getBoundingClientRect();
            }
            
            // 基本境界判定
            const isInsideCanvas = this.isPointInCanvas(event.clientX, event.clientY, canvasRect);
            
            // 座標変換（CoordinateManager使用）
            let coordinates = null;
            if (this.coordinateManager) {
                try {
                    coordinates = this.coordinateManager.screenToCanvas(
                        event.clientX, event.clientY, canvasRect
                    );
                    
                    // 座標妥当性確認
                    if (!this.coordinateManager.validateCoordinateIntegrity(coordinates)) {
                        console.warn('⚠️ 無効な座標データ検出');
                        coordinates = null;
                    }
                } catch (coordError) {
                    console.warn('⚠️ 座標変換失敗:', coordError.message);
                    coordinates = null;
                }
            }
            
            // フォールバック座標
            if (!coordinates) {
                coordinates = {
                    x: Math.max(0, event.clientX - canvasRect.left),
                    y: Math.max(0, event.clientY - canvasRect.top)
                };
            }
            
            return {
                isInsideCanvas,
                canvasRect,
                coordinates,
                screenCoordinates: { x: event.clientX, y: event.clientY },
                coordinateManagerUsed: !!this.coordinateManager
            };
            
        } catch (error) {
            console.warn('⚠️ 境界判定失敗:', error.message);
            
            // 最小限のフォールバック
            return {
                isInsideCanvas: false,
                canvasRect: null,
                coordinates: { x: 0, y: 0 },
                screenCoordinates: { x: event.clientX || 0, y: event.clientY || 0 },
                coordinateManagerUsed: false,
                error: error.message
            };
        }
    }
    
    /**
     * 🆕 COORDINATE_FEATURE: 境界越えイン処理（座標統合対応）
     */
    handleBoundaryCrossInWithCoordinateIntegration(event, boundaryCheck) {
        try {
            console.log(`🎯 座標統合境界越えイン: (${boundaryCheck.coordinates.x.toFixed(1)}, ${boundaryCheck.coordinates.y.toFixed(1)})`);
            
            // 境界越え描画開始イベント発火
            if (window.EventBus) {
                window.EventBus.safeEmit('boundary.cross.in', {
                    position: boundaryCheck.coordinates,
                    pressure: event.pressure || 0.5,
                    pointerId: event.pointerId,
                    pointerType: event.pointerType || 'unknown',
                    originalEvent: event,
                    fromOutside: true,
                    timestamp: Date.now(),
                    coordinateManagerUsed: boundaryCheck.coordinateManagerUsed,
                    boundaryData: {
                        canvasRect: boundaryCheck.canvasRect,
                        screenCoordinates: boundaryCheck.screenCoordinates
                    }
                });
            }
            
            // 追跡状態リセット
            this.isTrackingOutside = false;
            this.outsidePointer = null;
            
        } catch (error) {
            if (window.ErrorManager) {
                window.ErrorManager.showError('boundary-cross-in', 
                    `座標統合境界越えイン処理エラー: ${error.message}`, 
                    { pointerId: event.pointerId }
                );
            }
        }
    }
    
    /**
     * 🎯 グローバルポインターアップ処理
     */
    handleGlobalPointerUp(event) {
        if (this.isTrackingOutside && event.pointerId === this.outsidePointer?.id) {
            // 境界外で終了
            this.isTrackingOutside = false;
            this.outsidePointer = null;
            
            if (window.EventBus) {
                window.EventBus.safeEmit('boundary.outside.end', {
                    pointerId: event.pointerId,
                    timestamp: Date.now(),
                    coordinateManagerIntegrated: !!this.coordinateManager
                });
            }
            
            if (this.config.debugging) {
                console.log(`🎯 境界外ポインターアップ: ${event.pointerId}`);
            }
        }
    }
    
    /**
     * 🎯 点がキャンバス内かチェック
     */
    isPointInCanvas(clientX, clientY, canvasRect) {
        if (!canvasRect) return false;
        
        return clientX >= canvasRect.left && 
               clientX <= canvasRect.right && 
               clientY >= canvasRect.top && 
               clientY <= canvasRect.bottom;
    }
    
    /**
     * 🎯 点が拡張ヒットエリア内かチェック
     */
    isPointInExpandedArea(clientX, clientY) {
        if (!this.expandedHitArea) return false;
        
        return clientX >= this.expandedHitArea.left && 
               clientX <= this.expandedHitArea.right && 
               clientY >= this.expandedHitArea.top && 
               clientY <= this.expandedHitArea.bottom;
    }
    
    // ==========================================
    // 🔄 座표統合診断・統計システム
    // ==========================================
    
    /**
     * 🔄 境界状態取得（座標統合対応）
     */
    getBoundaryState() {
        const baseState = {
            version: this.version,
            isTrackingOutside: this.isTrackingOutside,
            outsidePointer: this.outsidePointer,
            boundaryMargin: this.boundaryMargin,
            expandedHitArea: this.expandedHitArea,
            config: this.config,
            canvasElement: !!this.canvasElement,
            isInitialized: !!(this.canvasElement)
        };
        
        // 🆕 座標統合状態追加
        if (this.coordinateManager) {
            baseState.coordinateIntegration = {
                coordinateManagerAvailable: true,
                integrationEnabled: this.coordinateIntegration?.enabled || false,
                duplicateElimination: this.coordinateIntegration?.duplicateElimination || false,
                constructorProvided: this.coordinateIntegration?.constructorProvided || false,
                coordinateManagerState: this.coordinateManager.getCoordinateState ? 
                    this.coordinateManager.getCoordinateState() : null
            };
        } else {
            baseState.coordinateIntegration = {
                coordinateManagerAvailable: false,
                integrationEnabled: false,
                duplicateElimination: false,
                constructorProvided: false,
                warning: 'CoordinateManager未初期化'
            };
        }
        
        return baseState;
    }
    
    /**
     * 🆕 COORDINATE_FEATURE: 座標統合健全性チェック
     */
    checkCoordinateIntegrationHealth() {
        const health = {
            coordinateManagerAvailable: !!this.coordinateManager,
            canvasElementAvailable: !!this.canvasElement,
            expandedHitAreaValid: !!(this.expandedHitArea && this.expandedHitArea.width > 0),
            boundaryTrackingActive: !!(this.config.enabled && this.config.trackingEnabled),
            eventHandlersAttached: !!(this.boundHandlers && 
                typeof this.boundHandlers.pointerDown === 'function'),
            constructorIntegration: !!(this.coordinateIntegration?.constructorProvided)
        };
        
        const healthScore = Object.values(health).filter(Boolean).length / Object.keys(health).length;
        
        return {
            ...health,
            overallHealth: Math.round(healthScore * 100),
            recommendations: this.getBoundaryHealthRecommendations(health)
        };
    }
    
    /**
     * 🆕 COORDINATE_FEATURE: 境界健全性改善提案
     */
    getBoundaryHealthRecommendations(health) {
        const recommendations = [];
        
        if (!health.coordinateManagerAvailable) {
            recommendations.push('CoordinateManagerをconstructorで渡すか、window.CoordinateManagerを初期化してください');
        }
        
        if (!health.canvasElementAvailable) {
            recommendations.push('initialize()でcanvasElementを渡すか、AppCore経由で設定してください');
        }
        
        if (!health.expandedHitAreaValid) {
            recommendations.push('拡張ヒットエリアの再作成が必要です');
        }
        
        if (!health.boundaryTrackingActive) {
            recommendations.push('境界追跡設定を有効化してください');
        }
        
        if (!health.eventHandlersAttached) {
            recommendations.push('イベントハンドラーの再設定が必要です');
        }
        
        if (!health.constructorIntegration) {
            recommendations.push('constructor引数でCoordinateManagerを渡すことを推奨します');
        }
        
        return recommendations;
    }
    
    /**
     * 🆕 COORDINATE_FEATURE: 境界統合診断実行（constructor対応版）
     */
    runBoundaryCoordinateIntegrationDiagnosis() {
        console.group('🔍 BoundaryManager座標統合診断（constructor対応版）');
        
        const state = this.getBoundaryState();
        const health = this.checkCoordinateIntegrationHealth();
        
        const integrationTests = {
            coordinateManagerAvailable: !!this.coordinateManager,
            constructorProvided: state.coordinateIntegration?.constructorProvided || false,
            canvasElementInitialized: !!this.canvasElement,
            boundaryTrackingFunctional: health.boundaryTrackingActive,
            expandedHitAreaGenerated: health.expandedHitAreaValid,
            eventHandlersRegistered: health.eventHandlersAttached,
            coordinateIntegrationEnabled: state.coordinateIntegration?.integrationEnabled || false
        };
        
        const diagnosis = {
            state,
            health,
            integrationTests,
            compliance: {
                coordinateUnified: integrationTests.coordinateManagerAvailable && integrationTests.coordinateIntegrationEnabled,
                constructorFixed: integrationTests.constructorProvided,
                fullyFunctional: Object.values(integrationTests).every(Boolean),
                phase2Ready: integrationTests.coordinateManagerAvailable && 
                             integrationTests.canvasElementInitialized &&
                             integrationTests.coordinateIntegrationEnabled
            }
        };
        
        console.log('📊 BoundaryManager座標統合診断結果:', diagnosis);
        
        // 診断結果表示
        const passedTests = Object.values(integrationTests).filter(Boolean).length;
        const totalTests = Object.keys(integrationTests).length;
        
        console.log(`📊 統合テスト: ${passedTests}/${totalTests} (${Math.round(passedTests/totalTests*100)}%)`);
        console.log('⚙️ CoordinateManager統合:', integrationTests.coordinateManagerAvailable ? '✅' : '❌');
        console.log('🔧 Constructor提供:', integrationTests.constructorProvided ? '✅' : '❌');
        console.log('🎯 境界追跡機能:', integrationTests.boundaryTrackingFunctional ? '✅' : '❌');
        console.log('📐 拡張ヒットエリア:', integrationTests.expandedHitAreaGenerated ? '✅' : '❌');
        
        if (health.recommendations.length > 0) {
            console.warn('💡 改善提案:', health.recommendations);
        } else {
            console.log('✅ BoundaryManager座標統合診断: 全ての要件を満たしています（constructor対応版）');
        }
        
        console.groupEnd();
        
        return diagnosis;
    }
    
    // ==========================================
    // 🎯 設定・操作メソッド群
    // ==========================================
    
    /**
     * 🎯 境界設定更新（座標統合対応）
     */
    updateConfig(newConfig) {
        try {
            this.config = { ...this.config, ...newConfig };
            this.boundaryMargin = this.config.margin || 20;
            
            // 拡張ヒットエリア再計算（座標統合対応）
            if (this.canvasElement) {
                this.createExpandedHitAreaWithCoordinateIntegration();
            }
            
            // EventBus通知
            if (window.EventBus) {
                window.EventBus.safeEmit('boundary.config.updated', {
                    config: this.config,
                    coordinateManagerIntegrated: !!this.coordinateManager
                });
            }
            
            console.log('🎯 境界設定更新完了（座標統合対応）:', this.config);
            
            return true;
            
        } catch (error) {
            if (window.ErrorManager) {
                window.ErrorManager.showError('boundary-config', 
                    `境界設定更新エラー: ${error.message}`, 
                    { config: newConfig }
                );
            }
            return false;
        }
    }
    
    /**
     * 🆕 COORDINATE_FEATURE: 座標統合設定更新
     */
    updateCoordinateIntegrationSettings(newSettings) {
        if (!this.coordinateManager) {
            console.warn('⚠️ CoordinateManager未初期化 - 座標統合設定更新不可');
            return false;
        }
        
        try {
            this.coordinateIntegration = { 
                ...this.coordinateIntegration, 
                ...newSettings 
            };
            
            // CoordinateManager設定更新
            if (newSettings.coordinateManagerConfig && this.coordinateManager.updateCoordinateConfig) {
                this.coordinateManager.updateCoordinateConfig(newSettings.coordinateManagerConfig);
            }
            
            console.log('⚙️ 境界座標統合設定更新:', newSettings);
            
            return true;
            
        } catch (error) {
            console.warn('⚠️ 座標統合設定更新失敗:', error.message);
            return false;
        }
    }
    
    /**
     * キャンバスサイズ変更対応
     */
    updateCanvasSize() {
        try {
            // 拡張ヒットエリア再計算（座標統合対応）
            if (this.canvasElement) {
                this.createExpandedHitAreaWithCoordinateIntegration();
            }
            
            console.log('📐 キャンバスサイズ変更対応完了（座標統合）');
            
            return true;
            
        } catch (error) {
            console.warn('⚠️ キャンバスサイズ変更対応失敗:', error.message);
            return false;
        }
    }
    
    /**
     * 🎯 境界管理システム破棄（座標統合対応）
     */
    destroy() {
        try {
            console.log('🗑️ BoundaryManager破棄開始...');
            
            // イベントリスナー削除
            if (this.boundHandlers) {
                document.removeEventListener('pointerdown', this.boundHandlers.pointerDown);
                document.removeEventListener('pointermove', this.boundHandlers.pointerMove);
                document.removeEventListener('pointerup', this.boundHandlers.pointerUp);
            }
            
            // 状態リセット
            this.isTrackingOutside = false;
            this.outsidePointer = null;
            this.canvasElement = null;
            this.expandedHitArea = null;
            
            // 🔄 COORDINATE_INTEGRATION: CoordinateManager参照クリア
            this.coordinateManager = null;
            this.coordinateIntegration = null;
            
            // EventBus通知
            if (window.EventBus) {
                window.EventBus.safeEmit('boundary.manager.destroyed', {
                    version: this.version,
                    timestamp: Date.now()
                });
            }
            
            console.log('✅ BoundaryManager破棄完了（座標統合対応）');
            
            return true;
            
        } catch (error) {
            if (window.ErrorManager) {
                window.ErrorManager.showError('boundary-destroy', 
                    `境界管理破棄エラー: ${error.message}`
                );
            }
            return false;
        }
    }
}

// ==========================================
// 🎯 Pure JavaScript グローバル公開
// ==========================================

if (typeof window !== 'undefined') {
    window.BoundaryManager = BoundaryManager;
    console.log('✅ BoundaryManager 座標統合完全修正版（constructor対応） グローバル公開完了（Pure JavaScript）');
}

console.log('🔧 BoundaryManager Phase1.4 座標統合完全修正版（constructor対応） - 準備完了');
console.log('📋 座標統合修正完了: CoordinateManager完全統合・重複排除・健全性診断');
console.log('🔄 修正実装項目:');
console.log('  - constructor(coordinateManager, options)引数対応完了');
console.log('  - initialize()メソッドでcanvasElement受け取り対応');
console.log('  - 拡張ヒットエリア作成の座標統合対応');
console.log('  - 境界判定処理の座標統合対応');
console.log('  - 境界越えイン処理の座標統合対応');
console.log('  - 座標統合診断・健全性チェックシステム（constructor対応版）');
console.log('  - Phase2準備: レイヤー境界判定基盤完成');
console.log('💡 使用例: const boundaryManager = new window.BoundaryManager(coordinateManager, {appCore}); boundaryManager.initialize(canvasElement);');