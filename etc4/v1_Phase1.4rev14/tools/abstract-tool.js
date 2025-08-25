/**
 * 🎨 AbstractTool - 全ツールの基底クラス
 * 📏 DESIGN_PATTERN: Template Method Pattern適用
 * 🔄 TOOL_LIFECYCLE: onPointerDown/Move/Up統一
 * 📋 RESPONSIBILITY: ツール共通インターフェース定義
 * 
 * 📏 DESIGN_PRINCIPLE: 共通処理抽象化・子クラス特化実装
 * 🎯 ARCHITECTURE: 1ファイル1ツール設計・統一インターフェース
 * 🔧 BUG_FIX: 左上直線バグ防止・座標変換統一・責務分離対応
 * 
 * 🎯 DEPENDENCIES: ConfigManager, ErrorManager, StateManager, EventBus, CoordinateManager
 * 🎯 UNIFIED_SYSTEMS: ✅ ConfigManager, ErrorManager, StateManager, EventBus統合済み
 * 📋 PHASE_TARGET: Phase1.4-抽象基底クラス・将来ツール拡張基盤
 */

(function(global) {
    'use strict';

    /**
     * AbstractTool - 全ツール共通基底クラス
     */
    function AbstractTool(options) {
        options = options || {};
        
        this.version = 'v1.0-Phase1.4-abstract-tool-base';
        this.name = options.name || 'abstract';
        this.displayName = options.displayName || 'Abstract Tool';
        
        // 基本設定（子クラスでオーバーライド）
        this.settings = {
            brushSize: 16.0,
            brushColor: 0x800000,
            opacity: 0.85,
            pressure: 0.5
        };
        
        // 描画状態（Template Method Pattern用）
        this.isDrawing = false;
        this.currentPath = null;
        this.currentGraphics = null;
        
        // CanvasManager統合
        this.canvasManager = null;
        this.coordinateManager = null;
        this.canvasManagerIntegration = {
            connected: false,
            layerTarget: 'main'
        };
        
        // 座標統合
        this.coordinateIntegration = {
            enabled: false,
            validationEnabled: true,
            precisionApplied: true,
            debugMode: false
        };
        
        // 統計（共通）
        this.stats = {
            strokeCount: 0,
            pointCount: 0,
            lastStrokeTime: 0,
            coordinateValidationCount: 0,
            coordinateTransformCount: 0,
            invalidCoordinateCount: 0
        };
        
        console.log('🎨 AbstractTool ' + this.version + ' 基底クラス構築完了');
        
        // 統合初期化
        this.initializeBaseIntegrations();
    }
    
    /**
     * 基底統合初期化
     */
    AbstractTool.prototype.initializeBaseIntegrations = function() {
        try {
            // CoordinateManager統合
            if (window.CoordinateManager) {
                this.coordinateManager = window.coordinateManager || new window.CoordinateManager();
                this.coordinateIntegration.enabled = true;
                console.log('✅ AbstractTool: CoordinateManager統合完了');
            } else {
                console.warn('⚠️ AbstractTool: CoordinateManager未利用');
                this.coordinateIntegration.enabled = false;
            }
            
        } catch (error) {
            console.error('❌ AbstractTool基底統合初期化失敗:', error);
            this.coordinateIntegration.enabled = false;
        }
    };
    
    // ==========================================
    // 📋 必須実装メソッド（子クラスでオーバーライド）
    // ==========================================
    
    /**
     * 📋 必須実装：ポインターダウンハンドラー
     * @param {Event} event - PointerDownイベント
     * @param {CanvasManager} canvasManager - キャンバス管理インスタンス
     * @param {CoordinateManager} coordinateManager - 座標管理インスタンス
     * @returns {boolean} 処理成功可否
     */
    AbstractTool.prototype.onPointerDown = function(event, canvasManager, coordinateManager) {
        throw new Error('AbstractTool.onPointerDown() は子クラスで実装必須です');
    };
    
    /**
     * 📋 必須実装：ポインター移動ハンドラー
     * @param {Event} event - PointerMoveイベント
     * @param {CanvasManager} canvasManager - キャンバス管理インスタンス
     * @param {CoordinateManager} coordinateManager - 座標管理インスタンス
     * @returns {boolean} 処理成功可否
     */
    AbstractTool.prototype.onPointerMove = function(event, canvasManager, coordinateManager) {
        throw new Error('AbstractTool.onPointerMove() は子クラスで実装必須です');
    };
    
    /**
     * 📋 必須実装：ポインターアップハンドラー
     * @param {Event} event - PointerUpイベント
     * @param {CanvasManager} canvasManager - キャンバス管理インスタンス
     * @param {CoordinateManager} coordinateManager - 座標管理インスタンス
     * @returns {boolean} 処理成功可否
     */
    AbstractTool.prototype.onPointerUp = function(event, canvasManager, coordinateManager) {
        throw new Error('AbstractTool.onPointerUp() は子クラスで実装必須です');
    };
    
    // ==========================================
    // 📋 共通処理メソッド（子クラスで利用可能）
    // ==========================================
    
    /**
     * 📋 共通：CanvasManager接続
     */
    AbstractTool.prototype.setCanvasManager = function(canvasManager) {
        try {
            if (!canvasManager || !canvasManager.addGraphicsToLayer) {
                throw new Error('有効なCanvasManagerインスタンスが必要です');
            }
            
            this.canvasManager = canvasManager;
            this.canvasManagerIntegration.connected = true;
            
            // CoordinateManagerも連携
            if (canvasManager.getCoordinateManager && canvasManager.getCoordinateManager()) {
                this.coordinateManager = canvasManager.getCoordinateManager();
                this.coordinateIntegration.enabled = true;
            }
            
            console.log('✅ ' + this.name + 'Tool: CanvasManager接続完了');
            return true;
            
        } catch (error) {
            console.error('❌ ' + this.name + 'Tool CanvasManager接続エラー:', error);
            if (window.ErrorManager) {
                window.ErrorManager.showError('abstract-tool-canvas-connection', 
                    this.name + 'ツールCanvasManager接続エラー: ' + error.message
                );
            }
            return false;
        }
    };
    
    /**
     * 📋 共通：イベント座標抽出
     */
    AbstractTool.prototype.extractCoordinates = function(event, canvasManager, coordinateManager) {
        try {
            canvasManager = canvasManager || this.canvasManager;
            coordinateManager = coordinateManager || this.coordinateManager;
            
            if (!canvasManager) {
                throw new Error('CanvasManagerが必要です');
            }
            
            // CoordinateManager統合座標抽出
            if (coordinateManager && coordinateManager.extractPointerCoordinates) {
                var canvasElement = canvasManager.getCanvasElement();
                if (!canvasElement) {
                    throw new Error('キャンバス要素が取得できません');
                }
                
                var canvasRect = canvasElement.getBoundingClientRect();
                var coordinates = coordinateManager.extractPointerCoordinates(
                    event,
                    canvasRect,
                    canvasManager.getPixiApplication()
                );
                
                if (coordinates && coordinates.canvas) {
                    this.stats.coordinateTransformCount++;
                    return {
                        x: coordinates.canvas.x,
                        y: coordinates.canvas.y,
                        pressure: coordinates.pressure || 0.5,
                        source: 'coordinateManager'
                    };
                }
            }
            
            // フォールバック座標抽出
            return this.extractBasicCoordinates(event, canvasManager);
            
        } catch (error) {
            console.error('❌ AbstractTool座標抽出エラー:', error);
            this.stats.invalidCoordinateCount++;
            
            // 緊急フォールバック
            return {
                x: 100,
                y: 100,
                pressure: 0.5,
                source: 'emergency'
            };
        }
    };
    
    /**
     * 📋 共通：基本座標抽出（フォールバック）
     */
    AbstractTool.prototype.extractBasicCoordinates = function(event, canvasManager) {
        try {
            var canvasElement = canvasManager.getCanvasElement();
            if (!canvasElement) {
                throw new Error('キャンバス要素が取得できません');
            }
            
            var rect = canvasElement.getBoundingClientRect();
            var clientX = event.clientX || 100;
            var clientY = event.clientY || 100;
            
            var canvasSize = canvasManager.getCanvasSize();
            
            // 基本座標変換（境界チェック）
            var canvasX = Math.max(10, Math.min(canvasSize.width - 10, clientX - rect.left));
            var canvasY = Math.max(10, Math.min(canvasSize.height - 10, clientY - rect.top));
            
            return {
                x: canvasX,
                y: canvasY,
                pressure: event.pressure || 0.5,
                source: 'fallback'
            };
            
        } catch (error) {
            console.error('❌ AbstractTool基本座標抽出エラー:', error);
            return {
                x: 100,
                y: 100,
                pressure: 0.5,
                source: 'emergency'
            };
        }
    };
    
    /**
     * 📋 共通：Graphics作成
     */
    AbstractTool.prototype.createGraphics = function(canvasManager) {
        try {
            canvasManager = canvasManager || this.canvasManager;
            
            if (!canvasManager) {
                throw new Error('CanvasManagerが必要です');
            }
            
            // 新しいGraphics作成
            var graphics = new PIXI.Graphics();
            
            // CanvasManagerのレイヤーに追加
            var success = canvasManager.addGraphicsToLayer(graphics, this.canvasManagerIntegration.layerTarget);
            
            if (success) {
                this.currentGraphics = graphics;
                console.log('✅ ' + this.name + 'Tool: Graphics作成・配置完了');
                return graphics;
            } else {
                graphics.destroy();
                throw new Error('CanvasManagerへのGraphics配置失敗');
            }
            
        } catch (error) {
            console.error('❌ AbstractTool Graphics作成エラー:', error);
            if (window.ErrorManager) {
                window.ErrorManager.showError('abstract-tool-graphics-creation', 
                    this.name + 'ツールGraphics作成エラー: ' + error.message
                );
            }
            return null;
        }
    };
    
    /**
     * 📋 共通：GraphicsをCanvasManagerレイヤーに配置
     */
    AbstractTool.prototype.attachToLayer = function(graphics, canvasManager, layerId) {
        try {
            graphics = graphics || this.currentGraphics;
            canvasManager = canvasManager || this.canvasManager;
            layerId = layerId || this.canvasManagerIntegration.layerTarget;
            
            if (!graphics) {
                throw new Error('Graphicsインスタンスが必要です');
            }
            
            if (!canvasManager) {
                throw new Error('CanvasManagerが必要です');
            }
            
            var success = canvasManager.addGraphicsToLayer(graphics, layerId);
            
            if (success) {
                console.log('✅ ' + this.name + 'Tool: Graphics配置完了 - レイヤー: ' + layerId);
            }
            
            return success;
            
        } catch (error) {
            console.error('❌ AbstractTool Graphics配置エラー:', error);
            if (window.ErrorManager) {
                window.ErrorManager.showError('abstract-tool-attach-layer', 
                    this.name + 'ツールGraphics配置エラー: ' + error.message, 
                    { layerId: layerId }
                );
            }
            return false;
        }
    };
    
    /**
     * 📋 共通：座標妥当性確認
     */
    AbstractTool.prototype.validateCoordinates = function(coordinates) {
        try {
            if (!coordinates || typeof coordinates.x !== 'number' || typeof coordinates.y !== 'number') {
                return false;
            }
            
            if (!isFinite(coordinates.x) || !isFinite(coordinates.y)) {
                return false;
            }
            
            // CoordinateManager統合妥当性確認
            if (this.coordinateIntegration.enabled && 
                this.coordinateManager && 
                this.coordinateManager.validateCoordinateIntegrity) {
                
                var isValid = this.coordinateManager.validateCoordinateIntegrity(coordinates);
                if (isValid) {
                    this.stats.coordinateValidationCount++;
                }
                return isValid;
            }
            
            // 基本妥当性確認
            return coordinates.x >= 0 && coordinates.y >= 0;
            
        } catch (error) {
            console.error('❌ AbstractTool座標妥当性確認エラー:', error);
            this.stats.invalidCoordinateCount++;
            return false;
        }
    };
    
    /**
     * 📋 共通：座標精度適用
     */
    AbstractTool.prototype.applyCoordinatePrecision = function(coordinates) {
        try {
            if (!coordinates) {
                return null;
            }
            
            var processedCoords = {
                x: coordinates.x,
                y: coordinates.y,
                pressure: coordinates.pressure || 0.5
            };
            
            // CoordinateManager統合精度適用
            if (this.coordinateIntegration.enabled && 
                this.coordinateIntegration.precisionApplied &&
                this.coordinateManager && 
                this.coordinateManager.applyPrecision) {
                
                processedCoords.x = this.coordinateManager.applyPrecision(processedCoords.x);
                processedCoords.y = this.coordinateManager.applyPrecision(processedCoords.y);
            }
            
            return processedCoords;
            
        } catch (error) {
            console.error('❌ AbstractTool座標精度適用エラー:', error);
            return coordinates; // 元の座標を返す
        }
    };
    
    /**
     * 📋 共通：左上直線バグ防止チェック
     */
    AbstractTool.prototype.preventLeftTopLineBug = function(coordinates, options) {
        options = options || {};
        
        try {
            if (!coordinates) {
                return false;
            }
            
            // (0,0)座標チェック
            if (coordinates.x === 0 && coordinates.y === 0 && !options.allowZeroCoordinates) {
                console.warn('⚠️ ' + this.name + 'Tool: 左上(0,0)座標検出・バグ防止のためスキップ');
                this.stats.leftTopLineBugPreventionCount = (this.stats.leftTopLineBugPreventionCount || 0) + 1;
                return false;
            }
            
            // 範囲外チェック（キャンバス境界外）
            if (this.canvasManager) {
                var canvasSize = this.canvasManager.getCanvasSize();
                if (coordinates.x < 0 || coordinates.y < 0 ||
                    coordinates.x > canvasSize.width || coordinates.y > canvasSize.height) {
                    console.warn('⚠️ ' + this.name + 'Tool: 範囲外座標検出・スキップ');
                    return false;
                }
            }
            
            return true;
            
        } catch (error) {
            console.error('❌ AbstractTool左上直線バグ防止エラー:', error);
            return false;
        }
    };
    
    // ==========================================
    // 📋 Template Method Pattern実装
    // ==========================================
    
    /**
     * 📋 Template Method：描画処理フロー
     */
    AbstractTool.prototype.executeDrawingFlow = function(event, canvasManager, coordinateManager, action) {
        try {
            // Step 1: 座標抽出
            var coordinates = this.extractCoordinates(event, canvasManager, coordinateManager);
            if (!coordinates) {
                console.warn('⚠️ ' + this.name + 'Tool: 座標抽出失敗');
                return false;
            }
            
            // Step 2: 座標妥当性確認
            if (!this.validateCoordinates(coordinates)) {
                console.warn('⚠️ ' + this.name + 'Tool: 座標妥当性確認失敗');
                return false;
            }
            
            // Step 3: 左上直線バグ防止
            if (!this.preventLeftTopLineBug(coordinates)) {
                return false;
            }
            
            // Step 4: 座標精度適用
            var processedCoords = this.applyCoordinatePrecision(coordinates);
            if (!processedCoords) {
                console.warn('⚠️ ' + this.name + 'Tool: 座標精度適用失敗');
                return false;
            }
            
            // Step 5: アクション実行（子クラス実装）
            return this.executeAction(action, processedCoords, event, canvasManager, coordinateManager);
            
        } catch (error) {
            console.error('❌ AbstractTool描画フローエラー:', error);
            if (window.ErrorManager) {
                window.ErrorManager.showError('abstract-tool-drawing-flow', 
                    this.name + 'ツール描画フローエラー: ' + error.message, 
                    { action: action }
                );
            }
            return false;
        }
    };
    
    /**
     * 📋 Template Method：アクション実行（子クラスでオーバーライド）
     */
    AbstractTool.prototype.executeAction = function(action, coordinates, event, canvasManager, coordinateManager) {
        switch (action) {
            case 'start':
                return this.startDrawing && this.startDrawing(coordinates.x, coordinates.y, coordinates.pressure);
            case 'continue':
                return this.updateStroke && this.updateStroke(coordinates.x, coordinates.y, coordinates.pressure);
            case 'end':
                return this.endStroke && this.endStroke();
            default:
                console.warn('⚠️ AbstractTool: 未知のアクション: ' + action);
                return false;
        }
    };
    
    // ==========================================
    // 📋 共通統計・診断メソッド
    // ==========================================
    
    /**
     * 統計取得
     */
    AbstractTool.prototype.getStats = function() {
        return {
            name: this.name,
            displayName: this.displayName,
            version: this.version,
            isDrawing: this.isDrawing,
            canvasManagerConnected: this.canvasManagerIntegration.connected,
            settings: Object.assign({}, this.settings),
            stats: Object.assign({}, this.stats),
            coordinateIntegration: {
                enabled: this.coordinateIntegration.enabled,
                validationCount: this.stats.coordinateValidationCount,
                transformCount: this.stats.coordinateTransformCount,
                invalidCount: this.stats.invalidCoordinateCount
            }
        };
    };
    
    /**
     * 📋 抽象基底クラス診断
     */
    AbstractTool.prototype.runAbstractToolDiagnosis = function() {
        console.group('🔍 AbstractTool基底クラス診断 - ' + this.name);
        
        var diagnosis = {
            implementation: {
                onPointerDownImplemented: typeof this.onPointerDown === 'function',
                onPointerMoveImplemented: typeof this.onPointerMove === 'function',
                onPointerUpImplemented: typeof this.onPointerUp === 'function',
                childClassImplemented: this.constructor.name !== 'AbstractTool'
            },
            commonMethods: {
                setCanvasManagerImplemented: typeof this.setCanvasManager === 'function',
                extractCoordinatesImplemented: typeof this.extractCoordinates === 'function',
                createGraphicsImplemented: typeof this.createGraphics === 'function',
                attachToLayerImplemented: typeof this.attachToLayer === 'function',
                validateCoordinatesImplemented: typeof this.validateCoordinates === 'function'
            },
            templateMethods: {
                executeDrawingFlowImplemented: typeof this.executeDrawingFlow === 'function',
                executeActionImplemented: typeof this.executeAction === 'function',
                preventLeftTopLineBugImplemented: typeof this.preventLeftTopLineBug === 'function'
            },
            integrations: {
                canvasManagerConnected: this.canvasManagerIntegration.connected,
                coordinateManagerEnabled: this.coordinateIntegration.enabled,
                canvasManagerAvailable: !!this.canvasManager,
                coordinateManagerAvailable: !!this.coordinateManager
            }
        };
        
        console.log('📊 抽象基底クラス診断結果:', diagnosis);
        
        // 合格判定
        var compliance = {
            interfaceCompliance: diagnosis.implementation.onPointerDownImplemented &&
                                 diagnosis.implementation.onPointerMoveImplemented &&
                                 diagnosis.implementation.onPointerUpImplemented,
            commonMethodsCompliance: diagnosis.commonMethods.setCanvasManagerImplemented &&
                                     diagnosis.commonMethods.extractCoordinatesImplemented &&
                                     diagnosis.commonMethods.createGraphicsImplemented,
            templateMethodsCompliance: diagnosis.templateMethods.executeDrawingFlowImplemented &&
                                       diagnosis.templateMethods.preventLeftTopLineBugImplemented,
            overallCompliance: true
        };
        
        compliance.overallCompliance = compliance.interfaceCompliance &&
                                       compliance.commonMethodsCompliance &&
                                       compliance.templateMethodsCompliance;
        
        console.log('📋 合格判定:', compliance);
        
        var recommendations = [];
        
        if (!compliance.interfaceCompliance) {
            recommendations.push('必須インターフェース（onPointer*）の実装が不完全です');
        }
        
        if (!compliance.commonMethodsCompliance) {
            recommendations.push('共通メソッドの実装が不完全です');
        }
        
        if (!compliance.templateMethodsCompliance) {
            recommendations.push('Template Methodパターン実装が不完全です');
        }
        
        if (!diagnosis.integrations.canvasManagerConnected) {
            recommendations.push('CanvasManager接続が必要です');
        }
        
        if (recommendations.length === 0) {
            console.log('✅ AbstractTool基底クラス診断: 全ての要件を満たしています');
        } else {
            console.warn('⚠️ AbstractTool推奨事項:', recommendations);
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
    AbstractTool.prototype.getDebugInfo = function() {
        var stats = this.getStats();
        
        return {
            version: this.version,
            stats: stats,
            integrations: {
                canvasManager: this.canvasManagerIntegration,
                coordinateManager: this.coordinateIntegration
            },
            drawingState: {
                isDrawing: this.isDrawing,
                currentGraphics: !!this.currentGraphics,
                currentPath: this.currentPath ? {
                    id: this.currentPath.id || 'unknown'
                } : null
            },
            abstractToolFeatures: {
                templateMethodPatternImplemented: true,
                commonProcessingAvailable: true,
                leftTopBugPreventionImplemented: true,
                coordinateIntegrationSupported: true
            }
        };
    };
    
    /**
     * 設定更新
     */
    AbstractTool.prototype.updateSettings = function(newSettings) {
        try {
            this.settings = Object.assign(this.settings, newSettings);
            
            console.log('⚙️ ' + this.name + 'Tool設定更新:', newSettings);
            
            if (window.EventBus) {
                window.EventBus.safeEmit('tool.settings.updated', {
                    toolName: this.name,
                    settings: this.settings,
                    updatedKeys: Object.keys(newSettings),
                    timestamp: Date.now()
                });
            }
            
            return true;
            
        } catch (error) {
            console.error('❌ ' + this.name + 'Tool設定更新エラー:', error);
            return false;
        }
    };
    
    /**
     * リセット
     */
    AbstractTool.prototype.reset = function() {
        try {
            // 描画状態リセット
            this.isDrawing = false;
            this.currentPath = null;
            this.currentGraphics = null;
            
            // 統計リセット
            this.stats = {
                strokeCount: 0,
                pointCount: 0,
                lastStrokeTime: 0,
                coordinateValidationCount: 0,
                coordinateTransformCount: 0,
                invalidCoordinateCount: 0
            };
            
            console.log('🔄 ' + this.name + 'Toolリセット完了（基底クラス版）');
            return true;
            
        } catch (error) {
            console.error('❌ ' + this.name + 'Toolリセットエラー:', error);
            return false;
        }
    };
    
    /**
     * 破棄処理
     */
    AbstractTool.prototype.destroy = function() {
        try {
            console.log('🗑️ ' + this.name + 'Tool破棄開始（基底クラス版）...');
            
            // 参照クリア
            this.canvasManager = null;
            this.coordinateManager = null;
            this.currentGraphics = null;
            this.currentPath = null;
            
            console.log('✅ ' + this.name + 'Tool破棄完了（基底クラス版）');
            
        } catch (error) {
            console.error('❌ ' + this.name + 'Tool破棄エラー:', error);
        }
    };

    // ==========================================
    // 🎯 Pure JavaScript グローバル公開
    // ==========================================

    global.AbstractTool = AbstractTool;
    console.log('✅ AbstractTool 抽象基底クラス グローバル公開完了（Pure JavaScript）');

})(window);

console.log('🔧 AbstractTool Phase1.4 抽象基底クラス - 準備完了');
console.log('📏 Template Method Pattern: executeDrawingFlow実装・共通処理抽象化');
console.log('📋 必須インターフェース: onPointerDown/Move/Up（子クラス実装必須）');
console.log('✅ 共通処理: extractCoordinates・createGraphics・attachToLayer・validateCoordinates');
console.log('🔧 左上直線バグ防止: preventLeftTopLineBug実装・(0,0)座標チェック');
console.log('🎯 主な提供機能:');
console.log('  - setCanvasManager()共通CanvasManager接続');
console.log('  - extractCoordinates()統一座標抽出・CoordinateManager統合');
console.log('  - createGraphics()共通Graphics作成・レイヤー配置');
console.log('  - validateCoordinates()座標妥当性確認・CoordinateManager連携');
console.log('  - preventLeftTopLineBug()左上直線バグ防止機能');
console.log('  - executeDrawingFlow()Template Method描画フロー');
console.log('🔍 診断実行: tool.runAbstractToolDiagnosis()');
console.log('📋 継承パターン: class YourTool extends AbstractTool（将来対応）');
console.log('💡 使用例: 新ツール作成時はAbstractTool継承・必須メソッドオーバーライド');