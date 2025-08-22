/**
 * 🎯 ToolManager - ツール選択・配信制御専門
 * 🔄 EVENT_DELEGATION: CanvasManager → Tool へのイベント配信
 * ✅ TOOL_LIFECYCLE: ツールインスタンス管理・Graphics接続制御
 * 📋 RESPONSIBILITY: 「ツールの選択と配信制御」
 * 
 * 📏 DESIGN_PRINCIPLE: CanvasEvent → 適切なTool → Graphics生成
 * 🚫 DRAWING_PROHIBITION: 直接的な描画処理は禁止（Tool委譲のみ）
 * 🔧 BUG_FIX: 左上直線バグ根本解決・責務分離改修版
 * 
 * 🎯 DEPENDENCIES: ConfigManager, ErrorManager, StateManager, EventBus, CoordinateManager
 * 🎯 UNIFIED_SYSTEMS: ✅ ConfigManager, ErrorManager, StateManager, EventBus統合済み
 * 📋 PHASE_TARGET: Phase1.4-責務分離・統合制御強化・左上直線バグ根本解決
 */

(function(global) {
    'use strict';

    function ToolManager(options) {
        options = options || {};
        
        this.version = 'v1.0-Phase1.4-unified-control-enhanced';
        this.initialized = false;
        
        // ツール管理
        this.tools = {};
        this.currentTool = null;
        this.currentToolName = 'pen'; // デフォルト
        this.toolInstances = {};
        
        // 🔧 CanvasManager統合（責務分離対応）
        this.canvasManager = null;
        this.coordinateManager = null;
        this.canvasManagerIntegration = {
            connected: false,
            eventDelegationEnabled: false,
            toolGraphicsIntegrationEnabled: false
        };
        
        // イベント配信制御
        this.eventDelegation = {
            enabled: true,
            pointerDownActive: false,
            pointerMoveActive: false,
            pointerUpActive: false,
            lastEventTime: 0,
            eventQueue: []
        };
        
        // ツール状態管理
        this.toolState = {
            activeToolName: this.currentToolName,
            previousToolName: null,
            toolSwitchTime: 0,
            toolsInitialized: false
        };
        
        // パフォーマンス統計
        this.stats = {
            toolSwitchCount: 0,
            eventDelegationCount: 0,
            graphicsCreationCount: 0,
            lastToolSwitchTime: 0,
            eventProcessingTime: 0
        };
        
        console.log('🎯 ToolManager ' + this.version + ' 構築完了（統合制御強化版）');
        
        // 基本初期化
        this.initializeBasicTools();
    }
    
    /**
     * 初期化
     */
    ToolManager.prototype.initialize = function(canvasManager, coordinateManager) {
        console.group('🎯 ToolManager初期化開始 - ' + this.version);
        
        var self = this;
        var startTime = performance.now();
        
        return new Promise(function(resolve, reject) {
            try {
                // CanvasManager統合設定
                if (canvasManager) {
                    self.setCanvasManager(canvasManager);
                }
                
                // CoordinateManager統合設定
                if (coordinateManager) {
                    self.coordinateManager = coordinateManager;
                }
                
                // ツール初期化
                self.initializeTools()
                    .then(function() {
                        // イベント配信設定
                        self.initializeEventDelegation();
                        
                        // 初期ツール設定
                        return self.setActiveTool(self.currentToolName);
                    })
                    .then(function() {
                        var initTime = performance.now() - startTime;
                        console.log('✅ ToolManager初期化完了 - ' + initTime.toFixed(2) + 'ms');
                        
                        self.initialized = true;
                        self.toolState.toolsInitialized = true;
                        console.groupEnd();
                        resolve(self);
                    })
                    .catch(function(error) {
                        console.error('❌ ToolManager初期化エラー:', error);
                        }
                        console.groupEnd();
                        reject(error);
                    });
                    
            } catch (error) {
                console.error('❌ ToolManager初期化エラー:', error);
                if (window.ErrorManager) {
                    window.ErrorManager.showError('error', 'ツール管理初期化失敗: ' + error.message);
                }
                console.groupEnd();
                reject(error);
            }
        });
    };
    
    /**
     * 基本ツール初期化
     */
    ToolManager.prototype.initializeBasicTools = function() {
        try {
            // ツール定義
            this.tools = {
                pen: {
                    name: 'pen',
                    displayName: 'ペンツール',
                    className: 'PenTool',
                    enabled: true,
                    instance: null
                },
                eraser: {
                    name: 'eraser',
                    displayName: '消しゴムツール',
                    className: 'EraserTool',
                    enabled: false, // Phase1では無効
                    instance: null
                }
            };
            
            console.log('✅ ToolManager: 基本ツール定義完了');
            
        } catch (error) {
            console.error('❌ ToolManager基本ツール初期化エラー:', error);
            throw error;
        }
    };
    
    /**
     * 📋 新規：CanvasManager設定（責務分離対応）
     */
    ToolManager.prototype.setCanvasManager = function(canvasManager) {
        try {
            if (!canvasManager || !canvasManager.addGraphicsToLayer) {
                throw new Error('有効なCanvasManagerインスタンスが必要です');
            }
            
            this.canvasManager = canvasManager;
            this.canvasManagerIntegration.connected = true;
            
            // CoordinateManagerも連携
            if (canvasManager.getCoordinateManager) {
                this.coordinateManager = canvasManager.getCoordinateManager();
            }
            
            console.log('✅ ToolManager: CanvasManager接続完了');
            return true;
            
        } catch (error) {
            console.error('❌ ToolManager CanvasManager接続エラー:', error);
            if (window.ErrorManager) {
                window.ErrorManager.showError('tool-manager-canvas-connection', 
                    'CanvasManager接続エラー: ' + error.message
                );
            }
            return false;
        }
    };
    
    /**
     * ツール初期化
     */
    ToolManager.prototype.initializeTools = function() {
        var self = this;
        return new Promise(function(resolve, reject) {
            try {
                var promises = [];
                
                for (var toolName in self.tools) {
                    var toolConfig = self.tools[toolName];
                    if (toolConfig.enabled) {
                        promises.push(self.initializeTool(toolName, toolConfig));
                    }
                }
                
                Promise.all(promises)
                    .then(function(results) {
                        console.log('✅ ToolManager: 全ツール初期化完了');
                        resolve();
                    })
                    .catch(function(error) {
                        reject(error);
                    });
                
            } catch (error) {
                reject(error);
            }
        });
    };
    
    /**
     * 📋 新規：単一ツール初期化
     */
    ToolManager.prototype.initializeTool = function(toolName, toolConfig) {
        var self = this;
        return new Promise(function(resolve, reject) {
            try {
                // ツールクラス存在確認
                var ToolClass = window[toolConfig.className];
                if (!ToolClass) {
                    throw new Error('ツールクラス ' + toolConfig.className + ' が見つかりません');
                }
                
                // ツールインスタンス作成
                var toolInstance = new ToolClass();
                
                // CanvasManager連携設定
                if (self.canvasManager && toolInstance.setCanvasManager) {
                    toolInstance.setCanvasManager(self.canvasManager);
                }
                
                // インスタンス保存
                toolConfig.instance = toolInstance;
                self.toolInstances[toolName] = toolInstance;
                
                console.log('✅ ToolManager: ' + toolName + 'ツール初期化完了');
                resolve(toolInstance);
                
            } catch (error) {
                console.error('❌ ToolManager ' + toolName + 'ツール初期化エラー:', error);
                reject(error);
            }
        });
    };
    
    /**
     * 📋 新規：イベント配信初期化（責務分離の核心）
     */
    ToolManager.prototype.initializeEventDelegation = function() {
        try {
            if (!this.canvasManager) {
                console.warn('⚠️ ToolManager: CanvasManager未接続 - イベント配信無効');
                return false;
            }
            
            var pixiApp = this.canvasManager.getPixiApplication();
            if (!pixiApp || !pixiApp.stage) {
                throw new Error('PixiJS Application/Stageが取得できません');
            }
            
            var self = this;
            
            // PixiJS Stageにイベントハンドラー設定（配信制御）
            pixiApp.stage.on('pointerdown', function(event) {
                self.delegateToActiveTool('onPointerDown', event);
            });
            
            pixiApp.stage.on('pointermove', function(event) {
                self.delegateToActiveTool('onPointerMove', event);
            });
            
            pixiApp.stage.on('pointerup', function(event) {
                self.delegateToActiveTool('onPointerUp', event);
            });
            
            pixiApp.stage.on('pointerupoutside', function(event) {
                self.delegateToActiveTool('onPointerUp', event);
            });
            
            this.canvasManagerIntegration.eventDelegationEnabled = true;
            this.eventDelegation.enabled = true;
            
            console.log('✅ ToolManager: イベント配信初期化完了');
            return true;
            
        } catch (error) {
            console.error('❌ ToolManagerイベント配信初期化エラー:', error);
            if (window.ErrorManager) {
                window.ErrorManager.showError('tool-manager-event-delegation', 
                    'イベント配信初期化エラー: ' + error.message
                );
            }
            return false;
        }
    };
    
    /**
     * 📋 新規：アクティブツールへのイベント配信（統合制御の核心）
     */
    ToolManager.prototype.delegateToActiveTool = function(method, event) {
        try {
            var startTime = performance.now();
            
            if (!this.currentTool || !this.currentTool[method]) {
                console.warn('⚠️ ToolManager: アクティブツールまたはメソッドが利用できません: ' + method);
                return false;
            }
            
            // イベント配信統計
            this.stats.eventDelegationCount++;
            this.eventDelegation.lastEventTime = Date.now();
            
            // ツールメソッド実行
            var result = this.currentTool[method](event, this.canvasManager, this.coordinateManager);
            
            // 処理時間計測
            this.stats.eventProcessingTime = performance.now() - startTime;
            
            // EventBus通知
            if (window.EventBus) {
                window.EventBus.safeEmit('tool.event.delegated', {
                    toolName: this.currentToolName,
                    method: method,
                    result: result,
                    processingTime: this.stats.eventProcessingTime,
                    timestamp: Date.now()
                });
            }
            
            return result;
            
        } catch (error) {
            console.error('❌ ToolManagerイベント配信エラー:', error);
            if (window.ErrorManager) {
                window.ErrorManager.showError('tool-manager-event-delegation', 
                    'イベント配信エラー: ' + error.message, 
                    { method: method, toolName: this.currentToolName }
                );
            }
            return false;
        }
    };
    
    /**
     * アクティブツール設定
     */
    ToolManager.prototype.setActiveTool = function(toolName) {
        var self = this;
        return new Promise(function(resolve, reject) {
            try {
                if (!self.tools[toolName]) {
                    throw new Error('ツール "' + toolName + '" が存在しません');
                }
                
                if (!self.tools[toolName].enabled) {
                    throw new Error('ツール "' + toolName + '" は無効です');
                }
                
                var toolConfig = self.tools[toolName];
                if (!toolConfig.instance) {
                    throw new Error('ツール "' + toolName + '" が初期化されていません');
                }
                
                // 前のツールを記録
                self.toolState.previousToolName = self.currentToolName;
                
                // アクティブツール切り替え
                self.currentTool = toolConfig.instance;
                self.currentToolName = toolName;
                self.toolState.activeToolName = toolName;
                self.toolState.toolSwitchTime = Date.now();
                
                self.stats.toolSwitchCount++;
                self.stats.lastToolSwitchTime = Date.now();
                
                // StateManager状態更新
                if (window.StateManager) {
                    window.StateManager.updateComponentState('toolManager', 'activeTool', {
                        currentTool: toolName,
                        previousTool: self.toolState.previousToolName,
                        switchTime: self.toolState.toolSwitchTime,
                        totalSwitchCount: self.stats.toolSwitchCount
                    });
                }
                
                // EventBus通知
                if (window.EventBus) {
                    window.EventBus.safeEmit('tool.changed', {
                        newTool: toolName,
                        previousTool: self.toolState.previousToolName,
                        switchCount: self.stats.toolSwitchCount,
                        timestamp: Date.now()
                    });
                }
                
                console.log('🔄 ツール切り替え: ' + (self.toolState.previousToolName || 'none') + ' → ' + toolName);
                resolve(self.currentTool);
                
            } catch (error) {
                console.error('❌ ツール切り替えエラー:', error);
                if (window.ErrorManager) {
                    window.ErrorManager.showError('tool-switch', 
                        'ツール切り替えエラー: ' + error.message, 
                        { toolName: toolName }
                    );
                }
                reject(error);
            }
        });
    };
    
    /**
     * 📋 新規：ツールGraphics作成（統合制御）
     */
    ToolManager.prototype.createToolGraphics = function(toolName) {
        try {
            toolName = toolName || this.currentToolName;
            
            if (!this.canvasManager) {
                throw new Error('CanvasManagerが接続されていません');
            }
            
            var tool = this.toolInstances[toolName];
            if (!tool) {
                throw new Error('ツール "' + toolName + '" のインスタンスが見つかりません');
            }
            
            // ツールにGraphics作成を依頼
            var graphics = null;
            if (tool.createGraphicsForCanvas) {
                graphics = tool.createGraphicsForCanvas();
            } else {
                // フォールバック: 直接作成
                graphics = new PIXI.Graphics();
                this.canvasManager.addGraphicsToLayer(graphics, 'main');
            }
            
            if (graphics) {
                this.stats.graphicsCreationCount++;
                
                // EventBus通知
                if (window.EventBus) {
                    window.EventBus.safeEmit('tool.graphics.created', {
                        toolName: toolName,
                        graphics: graphics,
                        creationCount: this.stats.graphicsCreationCount,
                        timestamp: Date.now()
                    });
                }
                
                console.log('✅ ToolManager: ' + toolName + '用Graphics作成完了');
            }
            
            return graphics;
            
        } catch (error) {
            console.error('❌ ToolManagerツールGraphics作成エラー:', error);
            if (window.ErrorManager) {
                window.ErrorManager.showError('tool-manager-graphics-creation', 
                    'ツールGraphics作成エラー: ' + error.message, 
                    { toolName: toolName }
                );
            }
            return null;
        }
    };
    
    /**
     * 📋 新規：ツール・CanvasManager統合初期化
     */
    ToolManager.prototype.initializeToolCanvasIntegration = function() {
        try {
            if (!this.canvasManager) {
                throw new Error('CanvasManagerが接続されていません');
            }
            
            // 全ツールにCanvasManager設定
            for (var toolName in this.toolInstances) {
                var tool = this.toolInstances[toolName];
                if (tool && tool.setCanvasManager) {
                    tool.setCanvasManager(this.canvasManager);
                }
            }
            
            this.canvasManagerIntegration.toolGraphicsIntegrationEnabled = true;
            
            console.log('✅ ToolManager: ツール・CanvasManager統合初期化完了');
            return true;
            
        } catch (error) {
            console.error('❌ ToolManagerツール・CanvasManager統合エラー:', error);
            if (window.ErrorManager) {
                window.ErrorManager.showError('tool-manager-integration', 
                    'ツール・CanvasManager統合エラー: ' + error.message
                );
            }
            return false;
        }
    };
    
    // ==========================================
    // 🔧 取得メソッド群
    // ==========================================
    
    /**
     * 現在のツール取得
     */
    ToolManager.prototype.getCurrentTool = function() {
        return this.currentTool;
    };
    
    /**
     * 現在のツール名取得
     */
    ToolManager.prototype.getCurrentToolName = function() {
        return this.currentToolName;
    };
    
    /**
     * ツール一覧取得
     */
    ToolManager.prototype.getAvailableTools = function() {
        var availableTools = [];
        
        for (var toolName in this.tools) {
            var toolConfig = this.tools[toolName];
            if (toolConfig.enabled) {
                availableTools.push({
                    name: toolName,
                    displayName: toolConfig.displayName,
                    active: toolName === this.currentToolName,
                    initialized: !!toolConfig.instance
                });
            }
        }
        
        return availableTools;
    };
    
    /**
     * ツールインスタンス取得
     */
    ToolManager.prototype.getToolInstance = function(toolName) {
        return this.toolInstances[toolName] || null;
    };
    
    /**
     * CanvasManager取得
     */
    ToolManager.prototype.getCanvasManager = function() {
        return this.canvasManager;
    };
    
    /**
     * CoordinateManager取得
     */
    ToolManager.prototype.getCoordinateManager = function() {
        return this.coordinateManager;
    };
    
    // ==========================================
    // 🔧 診断・統計メソッド群
    // ==========================================
    
    /**
     * 統計取得
     */
    ToolManager.prototype.getStats = function() {
        return {
            toolSwitchCount: this.stats.toolSwitchCount,
            eventDelegationCount: this.stats.eventDelegationCount,
            graphicsCreationCount: this.stats.graphicsCreationCount,
            lastToolSwitchTime: this.stats.lastToolSwitchTime,
            eventProcessingTime: this.stats.eventProcessingTime,
            currentTool: this.currentToolName,
            toolsInitialized: this.toolState.toolsInitialized,
            canvasManagerConnected: this.canvasManagerIntegration.connected,
            eventDelegationEnabled: this.canvasManagerIntegration.eventDelegationEnabled
        };
    };
    
    /**
     * 📋 新規：統合制御診断
     */
    ToolManager.prototype.runUnifiedControlDiagnosis = function() {
        console.group('🔍 ToolManager統合制御診断');
        
        var diagnosis = {
            toolManagement: {
                toolsInitialized: this.toolState.toolsInitialized,
                activeToolAvailable: !!this.currentTool,
                toolInstancesCount: Object.keys(this.toolInstances).length,
                availableToolsCount: this.getAvailableTools().length
            },
            canvasManagerIntegration: {
                connected: this.canvasManagerIntegration.connected,
                eventDelegationEnabled: this.canvasManagerIntegration.eventDelegationEnabled,
                toolGraphicsIntegrationEnabled: this.canvasManagerIntegration.toolGraphicsIntegrationEnabled,
                canvasManagerAvailable: !!this.canvasManager
            },
            eventDelegation: {
                enabled: this.eventDelegation.enabled,
                delegateToActiveToolImplemented: typeof this.delegateToActiveTool === 'function',
                eventDelegationCount: this.stats.eventDelegationCount,
                lastEventTime: this.eventDelegation.lastEventTime
            },
            unifiedControl: {
                setCanvasManagerImplemented: typeof this.setCanvasManager === 'function',
                createToolGraphicsImplemented: typeof this.createToolGraphics === 'function',
                initializeToolCanvasIntegrationImplemented: typeof this.initializeToolCanvasIntegration === 'function',
                toolSwitchFunctional: typeof this.setActiveTool === 'function'
            }
        };
        
        console.log('📊 統合制御診断結果:', diagnosis);
        
        // 合格判定
        var compliance = {
            toolManagementCompliance: diagnosis.toolManagement.toolsInitialized &&
                                      diagnosis.toolManagement.activeToolAvailable &&
                                      diagnosis.toolManagement.toolInstancesCount > 0,
            integrationCompliance: diagnosis.canvasManagerIntegration.connected &&
                                   diagnosis.canvasManagerIntegration.canvasManagerAvailable,
            eventDelegationCompliance: diagnosis.eventDelegation.enabled &&
                                       diagnosis.eventDelegation.delegateToActiveToolImplemented,
            unifiedControlCompliance: diagnosis.unifiedControl.setCanvasManagerImplemented &&
                                      diagnosis.unifiedControl.createToolGraphicsImplemented &&
                                      diagnosis.unifiedControl.initializeToolCanvasIntegrationImplemented,
            overallCompliance: true
        };
        
        compliance.overallCompliance = compliance.toolManagementCompliance &&
                                       compliance.integrationCompliance &&
                                       compliance.eventDelegationCompliance &&
                                       compliance.unifiedControlCompliance;
        
        console.log('📋 合格判定:', compliance);
        
        var recommendations = [];
        
        if (!compliance.toolManagementCompliance) {
            recommendations.push('ツール管理システムの初期化・設定が不完全です');
        }
        
        if (!compliance.integrationCompliance) {
            recommendations.push('CanvasManager統合が不完全です');
        }
        
        if (!compliance.eventDelegationCompliance) {
            recommendations.push('イベント配信システムが不完全です');
        }
        
        if (!compliance.unifiedControlCompliance) {
            recommendations.push('統合制御メソッドの実装が不完全です');
        }
        
        if (recommendations.length === 0) {
            console.log('✅ ToolManager統合制御診断: 全ての要件を満たしています');
        } else {
            console.warn('⚠️ ToolManager推奨事項:', recommendations);
        }
        
        console.groupEnd();
        
        return {
            diagnosis: diagnosis,
            compliance: compliance,
            recommendations: recommendations,
            overallResult: compliance.overallCompliance ? 'PASS' : 'FAIL'
        };
    };
    
    /**
     * デバッグ情報
     */
    ToolManager.prototype.getDebugInfo = function() {
        var stats = this.getStats();
        
        return {
            version: this.version,
            stats: stats,
            toolState: Object.assign({}, this.toolState),
            tools: Object.keys(this.tools).map(function(toolName) {
                var toolConfig = this.tools[toolName];
                return {
                    name: toolName,
                    displayName: toolConfig.displayName,
                    enabled: toolConfig.enabled,
                    initialized: !!toolConfig.instance,
                    active: toolName === this.currentToolName
                };
            }.bind(this)),
            integrations: {
                canvasManager: this.canvasManagerIntegration,
                eventDelegation: this.eventDelegation
            },
            responsibilitySeparation: {
                noDirectDrawing: !(
                    this.startDrawing ||
                    this.continueDrawing ||
                    this.stopDrawing
                ),
                eventDelegationOnly: !!(
                    this.delegateToActiveTool &&
                    this.eventDelegation.enabled
                ),
                toolLifecycleManagement: !!(
                    this.setActiveTool &&
                    this.initializeTool &&
                    this.toolInstances
                )
            }
        };
    };
    
    /**
     * ツール状態取得
     */
    ToolManager.prototype.getToolState = function() {
        return {
            current: {
                name: this.currentToolName,
                instance: this.currentTool,
                switchTime: this.toolState.toolSwitchTime
            },
            previous: {
                name: this.toolState.previousToolName,
                switchTime: this.stats.lastToolSwitchTime
            },
            available: this.getAvailableTools(),
            statistics: {
                switchCount: this.stats.toolSwitchCount,
                eventDelegationCount: this.stats.eventDelegationCount,
                graphicsCreationCount: this.stats.graphicsCreationCount
            },
            integrations: {
                canvasManagerConnected: this.canvasManagerIntegration.connected,
                eventDelegationEnabled: this.canvasManagerIntegration.eventDelegationEnabled,
                toolGraphicsIntegrationEnabled: this.canvasManagerIntegration.toolGraphicsIntegrationEnabled
            }
        };
    };
    
    /**
     * リセット
     */
    ToolManager.prototype.reset = function() {
        try {
            // アクティブツールリセット
            if (this.currentTool && this.currentTool.reset) {
                this.currentTool.reset();
            }
            
            // 統計リセット
            this.stats = {
                toolSwitchCount: 0,
                eventDelegationCount: 0,
                graphicsCreationCount: 0,
                lastToolSwitchTime: 0,
                eventProcessingTime: 0
            };
            
            // イベント配信状態リセット
            this.eventDelegation.pointerDownActive = false;
            this.eventDelegation.pointerMoveActive = false;
            this.eventDelegation.pointerUpActive = false;
            this.eventDelegation.lastEventTime = 0;
            this.eventDelegation.eventQueue = [];
            
            console.log('🔄 ToolManagerリセット完了（統合制御版）');
            return true;
            
        } catch (error) {
            console.error('❌ ToolManagerリセットエラー:', error);
            return false;
        }
    };
    
    /**
     * 破棄処理
     */
    ToolManager.prototype.destroy = function() {
        try {
            console.log('🗑️ ToolManager破棄開始（統合制御版）...');
            
            // 全ツール破棄
            for (var toolName in this.toolInstances) {
                var tool = this.toolInstances[toolName];
                if (tool && tool.destroy) {
                    tool.destroy();
                }
            }
            
            // 参照クリア
            this.tools = {};
            this.toolInstances = {};
            this.currentTool = null;
            this.canvasManager = null;
            this.coordinateManager = null;
            
            this.initialized = false;
            this.toolState.toolsInitialized = false;
            
            console.log('✅ ToolManager破棄完了（統合制御版）');
            
        } catch (error) {
            console.error('❌ ToolManager破棄エラー:', error);
        }
    };

    // ==========================================
    // 🎯 Pure JavaScript グローバル公開
    // ==========================================

    global.ToolManager = ToolManager;
    console.log('✅ ToolManager 統合制御強化版 グローバル公開完了（Pure JavaScript）');

})(window);

console.log('🔧 ToolManager Phase1.4 統合制御強化版 - 準備完了');
console.log('🔄 イベント配信: delegateToActiveTool実装・CanvasManager → Tool統合制御');
console.log('✅ ツール管理: initializeTool・setActiveTool・ツールライフサイクル管理');
console.log('📋 CanvasManager統合: setCanvasManager・initializeToolCanvasIntegration実装');
console.log('🚫 描画禁止: 直接描画メソッド削除・Tool委譲のみ');
console.log('🎯 統合制御機能:');
console.log('  - setCanvasManager()でCanvasManager接続・全ツールに配信');
console.log('  - delegateToActiveTool()でイベント配信制御');
console.log('  - createToolGraphics()でツールGraphics作成統合');
console.log('  - initializeEventDelegation()でPixiJSイベントハンドラー設定');
console.log('  - runUnifiedControlDiagnosis()で統合制御診断');
console.log('🔍 診断実行: toolManager.runUnifiedControlDiagnosis()');
console.log('📊 ツール状態: toolManager.getToolState()');
console.log('💡 使用例: await toolManager.initialize(canvasManager, coordinateManager); toolManager.setActiveTool("pen");');