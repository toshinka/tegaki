/**
 * 🎯 キャンバス境界管理システム（ConfigManager参照修正版）
 * 🎯 AI_WORK_SCOPE: 境界越えイベント処理・境界判定・境界描画制御
 * 🎯 DEPENDENCIES: ConfigManager, ErrorManager, EventBus, coordinate-manager.js
 * 🎯 UNIFIED: ConfigManager(境界設定), ErrorManager(境界エラー), EventBus(境界イベント)
 * 🎯 ISOLATION_TEST: ✅ 単体テスト可能
 * 🔧 CONFIG_FIX: ConfigManager静的参照をインスタンス参照に修正
 */

class BoundaryManager {
    constructor() {
        this.validateUnifiedSystems();
        
        // 🔧 CONFIG_FIX: ConfigManagerのインスタンス参照を使用
        this.config = this.configManager.get('canvas.boundary') || this.getDefaultBoundaryConfig();
        this.coordinateManager = null; // 後で依存注入
        
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
        
        console.log('🎯 BoundaryManager 初期化完了（ConfigManager修正版）');
    }
    
    /**
     * 🔧 CONFIG_FIX: 統一システム依存性確認（インスタンス参照版）
     */
    validateUnifiedSystems() {
        const required = ['ConfigManager', 'ErrorManager', 'EventBus'];
        const missing = required.filter(sys => !window[sys]);
        if (missing.length > 0) {
            throw new Error(`BoundaryManager: 統一システム依存不足: ${missing.join(', ')}`);
        }
        
        // 🔧 CONFIG_FIX: 統一システムへのインスタンス参照を確立
        this.configManager = window.ConfigManager;
        this.errorManager = window.ErrorManager;
        this.eventBus = window.EventBus;
        
        console.log('✅ BoundaryManager: 統一システム依存性確認完了');
    }
    
    /**
     * デフォルト境界設定取得
     */
    getDefaultBoundaryConfig() {
        return {
            enabled: true,
            margin: 20,
            trackingEnabled: true,
            crossInDelay: 0,
            supportedPointers: ['mouse', 'pen', 'touch'],
            debugging: false
        };
    }
    
    /**
     * 🎯 境界管理システム初期化
     */
    initialize(canvasElement, coordinateManager) {
        try {
            if (!canvasElement) {
                throw new Error('canvasElement が必要です');
            }
            
            this.coordinateManager = coordinateManager;
            this.canvasElement = canvasElement;
            
            // 境界追跡システム設定
            this.initializeBoundaryTracking();
            
            // 拡張ヒットエリア作成
            this.createExpandedHitArea();
            
            console.log('✅ BoundaryManager 初期化完了');
            
            // 🔧 CONFIG_FIX: EventBusインスタンス参照使用
            if (this.eventBus && typeof this.eventBus.emit === 'function') {
                this.eventBus.emit('boundary.manager.initialized', {
                    margin: this.boundaryMargin,
                    config: this.config
                });
            } else if (this.eventBus && typeof this.eventBus.safeEmit === 'function') {
                this.eventBus.safeEmit('boundary.manager.initialized', {
                    margin: this.boundaryMargin,
                    config: this.config
                });
            }
            
        } catch (error) {
            // 🔧 CONFIG_FIX: ErrorManagerインスタンス参照使用
            if (this.errorManager && typeof this.errorManager.showError === 'function') {
                this.errorManager.showError('boundary-init', 
                    `境界管理初期化失敗: ${error.message}`, 
                    { config: this.config }
                );
            } else {
                console.error('❌ 境界管理初期化失敗:', error.message);
            }
            throw error;
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
        
        // document全体でPointerイベント監視
        document.addEventListener('pointerdown', this.boundHandlers.pointerDown);
        document.addEventListener('pointermove', this.boundHandlers.pointerMove);
        document.addEventListener('pointerup', this.boundHandlers.pointerUp);
        
        console.log('✅ グローバル境界追跡システム開始');
    }
    
    /**
     * 🎯 拡張ヒットエリア作成
     */
    createExpandedHitArea() {
        if (!this.canvasElement) return null;
        
        const rect = this.canvasElement.getBoundingClientRect();
        this.expandedHitArea = {
            left: rect.left - this.boundaryMargin,
            top: rect.top - this.boundaryMargin,
            right: rect.right + this.boundaryMargin,
            bottom: rect.bottom + this.boundaryMargin
        };
        
        if (this.config.debugging) {
            console.log('🎯 拡張ヒットエリア作成:', this.expandedHitArea);
        }
        
        return this.expandedHitArea;
    }
    
    /**
     * 🎯 グローバルポインターダウン処理
     */
    handleGlobalPointerDown(event) {
        try {
            if (!this.canvasElement) return;
            
            const canvasRect = this.canvasElement.getBoundingClientRect();
            const isInsideCanvas = this.isPointInCanvas(event.clientX, event.clientY, canvasRect);
            
            if (!isInsideCanvas) {
                // キャンバス外ポインター検出
                this.isTrackingOutside = true;
                this.outsidePointer = {
                    id: event.pointerId,
                    startX: event.clientX,
                    startY: event.clientY,
                    timestamp: Date.now(),
                    type: event.pointerType || 'unknown'
                };
                
                // 🔧 CONFIG_FIX: EventBusインスタンス参照使用
                if (this.eventBus && typeof this.eventBus.emit === 'function') {
                    this.eventBus.emit('boundary.outside.start', {
                        pointer: this.outsidePointer,
                        canvasRect
                    });
                } else if (this.eventBus && typeof this.eventBus.safeEmit === 'function') {
                    this.eventBus.safeEmit('boundary.outside.start', {
                        pointer: this.outsidePointer,
                        canvasRect
                    });
                }
                
                if (this.config.debugging) {
                    console.log(`🎯 境界外ポインター検出: (${event.clientX}, ${event.clientY})`);
                }
            }
            
        } catch (error) {
            // 🔧 CONFIG_FIX: ErrorManagerインスタンス参照使用
            if (this.errorManager && typeof this.errorManager.showError === 'function') {
                this.errorManager.showError('boundary-tracking', 
                    `境界追跡エラー: ${error.message}`, 
                    { event: event.type, pointerId: event.pointerId }
                );
            } else {
                console.error('❌ 境界追跡エラー:', error.message);
            }
        }
    }
    
    /**
     * 🎯 グローバルポインター移動処理
     */
    handleGlobalPointerMove(event) {
        if (!this.isTrackingOutside || event.pointerId !== this.outsidePointer?.id) {
            return;
        }
        
        try {
            if (!this.canvasElement) return;
            
            const canvasRect = this.canvasElement.getBoundingClientRect();
            const isInsideCanvas = this.isPointInCanvas(event.clientX, event.clientY, canvasRect);
            
            if (isInsideCanvas) {
                // 境界越えイン検出
                this.handleBoundaryCrossIn(event, canvasRect);
            }
            
        } catch (error) {
            // 🔧 CONFIG_FIX: ErrorManagerインスタンス参照使用
            if (this.errorManager && typeof this.errorManager.showError === 'function') {
                this.errorManager.showError('boundary-cross', 
                    `境界越え処理エラー: ${error.message}`, 
                    { event: event.type, pointerId: event.pointerId }
                );
            } else {
                console.error('❌ 境界越え処理エラー:', error.message);
            }
        }
    }
    
    /**
     * 🎯 境界越えイン処理（核心機能）
     */
    handleBoundaryCrossIn(event, canvasRect) {
        if (!this.coordinateManager) {
            console.warn('⚠️ CoordinateManager が利用できません');
            return;
        }
        
        try {
            // キャンバス座標変換
            const canvasCoords = this.coordinateManager.screenToCanvas(
                event.clientX, event.clientY, canvasRect
            );
            
            // 境界越え描画開始イベント発火
            // 🔧 CONFIG_FIX: EventBusインスタンス参照使用
            if (this.eventBus && typeof this.eventBus.emit === 'function') {
                this.eventBus.emit('boundary.cross.in', {
                    position: canvasCoords,
                    pressure: event.pressure || 0.5,
                    pointerId: event.pointerId,
                    pointerType: event.pointerType || 'unknown',
                    originalEvent: event,
                    fromOutside: true,
                    timestamp: Date.now()
                });
            } else if (this.eventBus && typeof this.eventBus.safeEmit === 'function') {
                this.eventBus.safeEmit('boundary.cross.in', {
                    position: canvasCoords,
                    pressure: event.pressure || 0.5,
                    pointerId: event.pointerId,
                    pointerType: event.pointerType || 'unknown',
                    originalEvent: event,
                    fromOutside: true,
                    timestamp: Date.now()
                });
            }
            
            console.log(`🎯 境界越えイン: (${canvasCoords.x.toFixed(1)}, ${canvasCoords.y.toFixed(1)})`);
            
            // 追跡状態リセット
            this.isTrackingOutside = false;
            this.outsidePointer = null;
            
        } catch (error) {
            // 🔧 CONFIG_FIX: ErrorManagerインスタンス参照使用
            if (this.errorManager && typeof this.errorManager.showError === 'function') {
                this.errorManager.showError('boundary-cross', 
                    `境界越えイン処理エラー: ${error.message}`, 
                    { pointerId: event.pointerId }
                );
            } else {
                console.error('❌ 境界越えイン処理エラー:', error.message);
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
            
            // 🔧 CONFIG_FIX: EventBusインスタンス参照使用
            if (this.eventBus && typeof this.eventBus.emit === 'function') {
                this.eventBus.emit('boundary.outside.end', {
                    pointerId: event.pointerId,
                    timestamp: Date.now()
                });
            } else if (this.eventBus && typeof this.eventBus.safeEmit === 'function') {
                this.eventBus.safeEmit('boundary.outside.end', {
                    pointerId: event.pointerId,
                    timestamp: Date.now()
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
    
    /**
     * 🎯 境界状態取得（診断・デバッグ用）
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
            configManager: !!this.configManager,
            errorManager: !!this.errorManager,
            eventBus: !!this.eventBus,
            isInitialized: !!(this.canvasElement && this.coordinateManager)
        };
    }
    
    /**
     * 🎯 境界設定更新
     */
    updateConfig(newConfig) {
        try {
            this.config = { ...this.config, ...newConfig };
            this.boundaryMargin = this.config.margin || 20;
            
            // 拡張ヒットエリア再計算
            this.createExpandedHitArea();
            
            // 🔧 CONFIG_FIX: EventBusインスタンス参照使用
            if (this.eventBus && typeof this.eventBus.emit === 'function') {
                this.eventBus.emit('boundary.config.updated', {
                    config: this.config
                });
            } else if (this.eventBus && typeof this.eventBus.safeEmit === 'function') {
                this.eventBus.safeEmit('boundary.config.updated', {
                    config: this.config
                });
            }
            
            console.log('🎯 境界設定更新完了:', this.config);
            
        } catch (error) {
            // 🔧 CONFIG_FIX: ErrorManagerインスタンス参照使用
            if (this.errorManager && typeof this.errorManager.showError === 'function') {
                this.errorManager.showError('boundary-config', 
                    `境界設定更新エラー: ${error.message}`, 
                    { config: newConfig }
                );
            } else {
                console.error('❌ 境界設定更新エラー:', error.message);
            }
        }
    }
    
    /**
     * 🔧 ADDED: 設定再読み込み（ConfigManager更新対応）
     */
    reloadConfig() {
        try {
            console.log('🔄 BoundaryManager設定再読み込み中...');
            
            // ConfigManagerから最新設定を取得
            this.config = this.configManager.get('canvas.boundary') || this.getDefaultBoundaryConfig();
            this.boundaryMargin = this.config.margin || 20;
            
            // 拡張ヒットエリア再計算
            this.createExpandedHitArea();
            
            console.log('✅ BoundaryManager設定再読み込み完了');
            return true;
        } catch (error) {
            console.error('❌ BoundaryManager設定再読み込み失敗:', error.message);
            return false;
        }
    }
    
    /**
     * 🎯 境界管理システム破棄
     */
    destroy() {
        try {
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
            this.coordinateManager = null;
            this.expandedHitArea = null;
            
            // 🔧 CONFIG_FIX: EventBusインスタンス参照使用
            if (this.eventBus && typeof this.eventBus.emit === 'function') {
                this.eventBus.emit('boundary.manager.destroyed');
            } else if (this.eventBus && typeof this.eventBus.safeEmit === 'function') {
                this.eventBus.safeEmit('boundary.manager.destroyed');
            }
            
            console.log('🎯 BoundaryManager 破棄完了');
            
        } catch (error) {
            // 🔧 CONFIG_FIX: ErrorManagerインスタンス参照使用
            if (this.errorManager && typeof this.errorManager.showError === 'function') {
                this.errorManager.showError('boundary-destroy', 
                    `境界管理破棄エラー: ${error.message}`
                );
            } else {
                console.error('❌ 境界管理破棄エラー:', error.message);
            }
        }
    }
    
    /**
     * 🔧 ADDED: デバッグ情報出力
     */
    debugBoundarySystem() {
        console.group('🎯 BoundaryManager デバッグ情報');
        console.log('境界追跡状態:', {
            isTrackingOutside: this.isTrackingOutside,
            outsidePointer: this.outsidePointer,
            boundaryMargin: this.boundaryMargin
        });
        console.log('統一システム状態:', {
            configManager: !!this.configManager,
            errorManager: !!this.errorManager,
            eventBus: !!this.eventBus
        });
        console.log('初期化状態:', {
            canvasElement: !!this.canvasElement,
            coordinateManager: !!this.coordinateManager,
            expandedHitArea: !!this.expandedHitArea
        });
        console.log('設定詳細:', this.config);
        console.groupEnd();
    }
}

// グローバル登録
if (typeof window !== 'undefined') {
    if (window.BoundaryManager) {
        console.warn('⚠️ BoundaryManager was already defined - replacing...');
    }
    window.BoundaryManager = BoundaryManager;
    console.log('🎯 BoundaryManager グローバル登録完了（ConfigManager修正版）');
}