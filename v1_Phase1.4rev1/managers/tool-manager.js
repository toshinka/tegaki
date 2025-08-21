/**
 * 🎯 境界管理システム - 座標統合完成版
 * 
 * 🎯 AI_WORK_SCOPE: キャンバス境界イベント・範囲外描画継続・座標変換統合
 * 🎯 DEPENDENCIES: ConfigManager, ErrorManager, EventBus, CoordinateManager
 * 🎯 UNIFIED_SYSTEMS: ✅ ConfigManager, ErrorManager, EventBus, CoordinateManager統合済み
 * 🎯 ISOLATION_TEST: ✅ 単体テスト可能（境界管理機能）
 * 🎯 SPLIT_THRESHOLD: 400行制限遵守（境界管理特化）
 * 📋 PHASE_TARGET: Phase1.4-座標統合 - CoordinateManager完全統合対応
 * 🔄 COORDINATE_INTEGRATION: 境界判定・座標変換をCoordinateManager経由に統一
 */

/**
 * 境界管理システム（座標統合完成版）
 * キャンバス外での描画継続を可能にする境界越え描画システム
 * CoordinateManager完全統合・統一座標処理
 */
class BoundaryManager {
    constructor() {
        this.version = 'v1.0-Phase1.4-coordinate-integrated';
        
        // 🔄 COORDINATE_INTEGRATION: CoordinateManager統合
        this.coordinateManager = null;
        this.coordinateIntegration = {
            enabled: false,
            duplicateElimination: false,
            performanceOptimized: false
        };
        
        // 基本設定
        this.canvasElement = null;
        this.boundaryMargin = 20;
        this.isInitialized = false;
        
        // 境界追跡状態
        this.isTrackingOutside = false;
        this.outsidePointer = null;
        this.expandedHitArea = null;
        
        // 設定
        this.config = {
            enabled: true,
            margin: 20,
            trackingEnabled: true,
            visualizeEnabled: false,
            crossInDelay: 0,
            supportedPointers: ['mouse', 'pen', 'touch'],
            debugging: false
        };
        
        console.log(`🎯 BoundaryManager ${this.version} 構築開始（座標統合版）`);
    }
    
    /**
     * 🎯 境界管理システム初期化（座標統合完全版）
     */
    initialize(canvasElement, coordinateManager = null) {
        try {
            console.log('🎯 BoundaryManager初期化開始（座標統合完全版）');
            
            if (!canvasElement) {
                throw new Error('canvasElement が必要です');
            }
            
            this.canvasElement = canvasElement;
            
            // 🔄 COORDINATE_INTEGRATION: CoordinateManager統合（完全実装）
            if (coordinateManager) {
                this.coordinateManager = coordinateManager;
                console.log('✅ BoundaryManager: 外部CoordinateManager統合完了');
            } else if (window.CoordinateManager) {
                this.coordinateManager = new window.CoordinateManager();
                console.log('✅ BoundaryManager: 新規CoordinateManager作成・統合完了');
            } else {
                console.warn('⚠️ BoundaryManager: CoordinateManager利用不可 - フォールバック処理で継続');
                this.coordinateManager = null;
            }
            
            // 座標統合設定確認
            if (this.coordinateManager) {
                const integrationStatus = this.coordinateManager.getIntegrationStatus();
                this.coordinateIntegration = {
                    enabled: integrationStatus.managerCentralization,
                    duplicateElimination: integrationStatus.duplicateElimination,
                    performanceOptimized: integrationStatus.performanceOptimized
                };
                
                if (!this.coordinateIntegration.enabled) {
                    console.warn('⚠️ BoundaryManager: 座標統合が無効です。ConfigManagerで coordinate.integration.managerCentralization を有効化してください');
                }
                
                console.log('🔄 BoundaryManager座標統合設定:', this.coordinateIntegration);
            }
            
            // ConfigManager設定読み込み
            this.loadConfigFromConfigManager();
            
            // 境界追跡システム設定
            this.initializeBoundaryTracking();
            
            // 拡張ヒットエリア作成
            this.createExpandedHitArea();
            
            this.isInitialized = true;
            
            console.log('✅ BoundaryManager 初期化完了（座標統合版）');
            
            // 初期化完了イベント（座標統合情報付き）
            if (window.EventBus) {
                window.EventBus.safeEmit('boundary.manager.initialized', {
                    margin: this.boundaryMargin,
                    config: this.config,
                    coordinateManager: !!this.coordinateManager,
                    coordinateIntegration: this.coordinateIntegration || null,
                    timestamp: Date.now()
                });
            }
            
            return this;
            
        } catch (error) {
            if (window.ErrorManager) {
                window.ErrorManager.showError('error', 
                    `境界管理初期化失敗: ${error.message}`, 
                    { 
                        config: this.config,
                        hasCanvasElement: !!canvasElement,
                        hasCoordinateManager: !!coordinateManager
                    }
                );
            }
            throw error;
        }
    }
    
    /**
     * ConfigManager設定読み込み
     */
    loadConfigFromConfigManager() {
        try {
            if (window.ConfigManager) {
                const canvasConfig = window.ConfigManager.getCanvasConfig();
                const boundaryConfig = canvasConfig.boundary || {};
                
                this.config = {
                    ...this.config,
                    ...boundaryConfig
                };
                
                this.boundaryMargin = this.config.margin || 20;
                
                console.log('✅ BoundaryManager: ConfigManager設定読み込み完了', this.config);
            } else {
                console.warn('⚠️ BoundaryManager: ConfigManager利用不可 - デフォルト設定使用');
            }
        } catch (error) {
            console.warn('⚠️ BoundaryManager設定読み込み失敗:', error.message);
        }
    }
    
    /**
     * 境界追跡システム初期化
     */
    initializeBoundaryTracking() {
        if (!this.config.trackingEnabled) {
            console.log('🎯 境界追跡システム無効');
            return;
        }
        
        // ドキュメント全体のポインターイベントリスナー設定
        document.addEventListener('pointermove', (e) => this.handleGlobalPointerMove(e));
        document.addEventListener('pointerup', (e) => this.handleGlobalPointerUp(e));
        document.addEventListener('pointerleave', (e) => this.handleGlobalPointerLeave(e));
        
        console.log('✅ 境界追跡システム初期化完了');
    }
    
    /**
     * 🔄 境界越えイン処理（座標統合完全実装版）
     */
    handleBoundaryCrossIn(event, canvasRect) {
        try {
            if (!this.coordinateManager) {
                // フォールバック処理：CoordinateManager未利用時の基本座標変換
                console.warn('⚠️ CoordinateManager未利用 - フォールバック座標変換実行');
                
                const basicCoords = {
                    x: Math.max(0, Math.min(canvasRect.width, event.clientX - canvasRect.left)),
                    y: Math.max(0, Math.min(canvasRect.height, event.clientY - canvasRect.top))
                };
                
                if (window.EventBus) {
                    window.EventBus.safeEmit('boundary.cross.in', {
                        position: basicCoords,
                        pressure: event.pressure || 0.5,
                        pointerId: event.pointerId,
                        pointerType: event.pointerType || 'unknown',
                        originalEvent: event,
                        fromOutside: true,
                        coordinateManagerUsed: false,
                        timestamp: Date.now()
                    });
                }
                
                console.log(`🎯 境界越えイン（フォールバック）: (${basicCoords.x.toFixed(1)}, ${basicCoords.y.toFixed(1)})`);
                
                this.isTrackingOutside = false;
                this.outsidePointer = null;
                return;
            }
            
            // CoordinateManager統合座標変換
            const canvasCoords = this.coordinateManager.screenToCanvas(
                event.clientX, event.clientY, canvasRect
            );
            
            // 座標妥当性確認
            if (!this.coordinateManager.validateCoordinateIntegrity(canvasCoords)) {
                throw new Error('境界越え座標変換で無効な座標が生成されました');
            }
            
            // 座標精度適用
            const preciseCoords = {
                x: this.coordinateManager.applyPrecision(canvasCoords.x),
                y: this.coordinateManager.applyPrecision(canvasCoords.y)
            };
            
            // 境界越え描画開始イベント発火（座標統合情報付き）
            if (window.EventBus) {
                window.EventBus.safeEmit('boundary.cross.in', {
                    position: preciseCoords,
                    pressure: event.pressure || 0.5,
                    pointerId: event.pointerId,
                    pointerType: event.pointerType || 'unknown',
                    originalEvent: event,
                    fromOutside: true,
                    coordinateManagerUsed: true,
                    coordinateIntegration: this.coordinateIntegration,
                    timestamp: Date.now()
                });
            }
            
            console.log(`🎯 境界越えイン（座標統合）: (${preciseCoords.x.toFixed(1)}, ${preciseCoords.y.toFixed(1)})`);
            
            // 追跡状態リセット
            this.isTrackingOutside = false;
            this.outsidePointer = null;
            
        } catch (error) {
            if (window.ErrorManager) {
                window.ErrorManager.showError('warning', 
                    `境界越えイン処理エラー: ${error.message}`, 
                    { 
                        pointerId: event.pointerId,
                        hasCoordinateManager: !!this.coordinateManager,
                        coordinateIntegration: this.coordinateIntegration
                    }
                );
            }
            
            // エラー時も追跡状態リセット
            this.isTrackingOutside = false;
            this.outsidePointer = null;
        }
    }
    
    /**
     * 🎯 拡張ヒットエリア作成（座標統合対応版）
     */
    createExpandedHitArea() {
        if (!this.canvasElement) return null;
        
        try {
            const rect = this.canvasElement.getBoundingClientRect();
            
            // CoordinateManager経由でのマージン処理
            let adjustedMargin = this.boundaryMargin;
            
            if (this.coordinateManager) {
                // 精度適用されたマージン
                adjustedMargin = this.coordinateManager.applyPrecision(this.boundaryMargin);
            }
            
            this.expandedHitArea = {
                left: rect.left - adjustedMargin,
                top: rect.top - adjustedMargin,
                right: rect.right + adjustedMargin,
                bottom: rect.bottom + adjustedMargin
            };
            
            if (this.config.debugging) {
                console.log('🎯 拡張ヒットエリア作成（座標統合版）:', {
                    expandedHitArea: this.expandedHitArea,
                    margin: adjustedMargin,
                    coordinateManagerUsed: !!this.coordinateManager
                });
            }
            
            return this.expandedHitArea;
            
        } catch (error) {
            console.warn('⚠️ 拡張ヒットエリア作成エラー:', error.message);
            
            // フォールバック処理
            const rect = this.canvasElement.getBoundingClientRect();
            this.expandedHitArea = {
                left: rect.left - this.boundaryMargin,
                top: rect.top - this.boundaryMargin,
                right: rect.right + this.boundaryMargin,
                bottom: rect.bottom + this.boundaryMargin
            };
            
            return this.expandedHitArea;
        }
    }
    
    /**
     * グローバルポインター移動処理
     */
    handleGlobalPointerMove(event) {
        if (!this.config.enabled || !this.canvasElement) return;
        
        try {
            const canvasRect = this.canvasElement.getBoundingClientRect();
            const expandedArea = this.expandedHitArea || this.createExpandedHitArea();
            
            const isInExpandedArea = this.isPointInExpandedArea(event.clientX, event.clientY, expandedArea);
            const isInCanvasArea = this.isPointInCanvasArea(event.clientX, event.clientY, canvasRect);
            
            // 拡張エリア内だがキャンバス外
            if (isInExpandedArea && !isInCanvasArea && !this.isTrackingOutside) {
                this.startTrackingOutside(event);
            }
            // 拡張エリア外に出た
            else if (!isInExpandedArea && this.isTrackingOutside) {
                this.stopTrackingOutside();
            }
            // キャンバス内に戻った
            else if (isInCanvasArea && this.isTrackingOutside) {
                this.handleBoundaryCrossIn(event, canvasRect);
            }
            
        } catch (error) {
            if (this.config.debugging) {
                console.warn('⚠️ グローバルポインター移動処理エラー:', error.message);
            }
        }
    }
    
    /**
     * グローバルポインターアップ処理
     */
    handleGlobalPointerUp(event) {
        if (this.isTrackingOutside) {
            this.stopTrackingOutside();
            
            if (window.EventBus) {
                window.EventBus.safeEmit('boundary.pointer.up', {
                    pointerId: event.pointerId,
                    wasTrackingOutside: true,
                    timestamp: Date.now()
                });
            }
        }
    }
    
    /**
     * グローバルポインターリーブ処理
     */
    handleGlobalPointerLeave(event) {
        if (this.isTrackingOutside) {
            this.stopTrackingOutside();
        }
    }
    
    /**
     * 外部追跡開始
     */
    startTrackingOutside(event) {
        this.isTrackingOutside = true;
        this.outsidePointer = {
            pointerId: event.pointerId,
            pointerType: event.pointerType || 'unknown',
            startTime: Date.now()
        };
        
        if (window.EventBus) {
            window.EventBus.safeEmit('boundary.tracking.started', {
                pointer: this.outsidePointer,
                timestamp: Date.now()
            });
        }
        
        if (this.config.debugging) {
            console.log('🎯 外部追跡開始:', this.outsidePointer);
        }
    }
    
    /**
     * 外部追跡停止
     */
    stopTrackingOutside() {
        if (!this.isTrackingOutside) return;
        
        const trackingDuration = this.outsidePointer ? 
            Date.now() - this.outsidePointer.startTime : 0;
        
        if (window.EventBus) {
            window.EventBus.safeEmit('boundary.tracking.stopped', {
                pointer: this.outsidePointer,
                duration: trackingDuration,
                timestamp: Date.now()
            });
        }
        
        if (this.config.debugging) {
            console.log(`🎯 外部追跡停止 (${trackingDuration}ms)`, this.outsidePointer);
        }
        
        this.isTrackingOutside = false;
        this.outsidePointer = null;
    }
    
    /**
     * 拡張エリア内判定
     */
    isPointInExpandedArea(x, y, expandedArea) {
        if (!expandedArea) return false;
        
        return x >= expandedArea.left && x <= expandedArea.right &&
               y >= expandedArea.top && y <= expandedArea.bottom;
    }
    
    /**
     * キャンバスエリア内判定
     */
    isPointInCanvasArea(x, y, canvasRect) {
        if (!canvasRect) return false;
        
        return x >= canvasRect.left && x <= canvasRect.right &&
               y >= canvasRect.top && y <= canvasRect.bottom;
    }
    
    /**
     * 🎯 境界状態取得（座標統合情報追加版）
     */
    getBoundaryState() {
        return {
            isTrackingOutside: this.isTrackingOutside,
            outsidePointer: this.outsidePointer,
            boundaryMargin: this.boundaryMargin,
            expandedHitArea: this.expandedHitArea,
            config: this.config,
            canvasElement: !!this.canvasElement,
            coordinateManager: !!this.coordinateManager,
            isInitialized: !!(this.canvasElement && this.coordinateManager),
            // 座標統合状態詳細
            coordinateIntegration: this.coordinateIntegration || {
                enabled: false,
                reason: 'CoordinateManager未統合'
            },
            coordinateManagerState: this.coordinateManager ? 
                this.coordinateManager.getCoordinateState() : null,
            phase2Ready: !!(this.coordinateManager && 
                            this.coordinateIntegration?.enabled)
        };
    }
    
    /**
     * 境界管理座標統合診断
     */
    runBoundaryCoordinateIntegrationDiagnosis() {
        console.group('🔍 BoundaryManager座標統合診断');
        
        const state = this.getBoundaryState();
        
        const diagnosis = {
            boundaryManager: {
                initialized: state.isInitialized,
                coordinateManagerAvailable: !!this.coordinateManager,
                coordinateIntegrationEnabled: state.coordinateIntegration?.enabled || false
            },
            coordinateIntegration: {
                managerCentralization: this.coordinateIntegration?.enabled || false,
                duplicateElimination: this.coordinateIntegration?.duplicateElimination || false,
                performanceOptimized: this.coordinateIntegration?.performanceOptimized || false
            },
            functionality: {
                boundaryCrossInSupported: !!this.coordinateManager,
                expandedHitAreaOptimized: !!this.coordinateManager,
                coordinateValidationEnabled: !!this.coordinateManager,
                fallbackProcessingReady: true
            }
        };
        
        // 推奨事項生成
        const recommendations = [];
        
        if (!diagnosis.boundaryManager.coordinateManagerAvailable) {
            recommendations.push('Co