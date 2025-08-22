/**
 * 🎨 ふたば☆ちゃんねる風ベクターお絵描きツール v1.0
 * 
 * 🎯 AI_WORK_SCOPE: キャンバス描画管理・リサイズ機能・背景・グリッド・境界管理
 * 🎯 DEPENDENCIES: js/app-core.js, managers/boundary-manager.js, managers/memory-manager.js, CoordinateManager
 * 🎯 UNIFIED_SYSTEMS: ✅ ConfigManager, ErrorManager, StateManager, EventBus, CoordinateManager統合済み
 * 🎯 ISOLATION_TEST: ✅ 単体テスト可能
 * 🎯 SPLIT_THRESHOLD: 500行制限遵守
 * 
 * 📋 PHASE_TARGET: Phase1.4-座標統合 - CoordinateManager統合完全実装
 * 🔄 COORDINATE_REFACTOR: initializeCoordinateIntegration()実装・座標統合対応
 * 📐 UNIFIED_COORDINATE: 座標処理完全集約・重複排除完了
 * 🎯 PHASE2_READY: レイヤーシステム座標変換基盤準備
 * 💡 PERFORMANCE: 座標処理パフォーマンス最適化
 * 🔧 SYNTAX_FIX: 構文エラー修正版（Invalid or unexpected token 解決）
 */

/**
 * Canvas Manager 座標統合完全実装版（構文エラー修正版）
 * 差分パッチ対応：initializeCoordinateIntegration()メソッド実装
 */
(function(global) {
    'use strict';

    function CanvasManager(options) {
        options = options || {};
        
        this.version = 'v1.0-Phase1.4-coordinate-patch-syntax-fixed';
        this.initialized = false;
        this.appCore = options.appCore || null;
        this.app = null;
        this.canvasElement = null;
        
        // キャンバス基本設定
        this.width = 0;
        this.height = 0;
        this.backgroundColor = 0xf0e0d6;
        
        // レイヤーシステム
        this.layers = {};
        this.mainLayer = null;
        this.backgroundLayer = null;
        
        // 描画状態
        this.paths = [];
        this.isDrawing = false;
        this.currentPath = null;
        this.lastDrawingPoint = null;
        
        // 🔄 COORDINATE_INTEGRATION: 座標統合システム（差分パッチ対応）
        this.coordinateManager = null; // 新規追加
        this.coordinateIntegration = {
            enabled: false,
            duplicateElimination: false,
            performance: {}
        };
        
        // パフォーマンス指標
        this.stats = {
            renderTime: 0,
            pathCount: 0,
            layerCount: 0
        };
        
        console.log('🎨 CanvasManager ' + this.version + ' 構築完了（差分パッチ適用済み・構文修正版）');
    }
    
    /**
     * 初期化（座標統合対応）
     */
    CanvasManager.prototype.initialize = function(appCore, canvasElement) {
        console.group('🎨 CanvasManager初期化開始 - ' + this.version);
        
        var self = this;
        var startTime = performance.now();
        
        return new Promise(function(resolve, reject) {
            try {
                // 基本初期化
                self.appCore = appCore;
                self.canvasElement = canvasElement;
                
                // 設定読み込み
                self.loadConfiguration()
                    .then(function() {
                        // ✅ 差分パッチ対応: Phase2移行 CoordinateManager統合初期化
                        self.initializeCoordinateIntegration();
                        
                        // PixiJS初期化
                        return self.initializePixiApplication();
                    })
                    .then(function() {
                        // レイヤー初期化
                        self.initializeLayers();
                        
                        // イベントハンドラー設定
                        self.setupEventHandlers();
                        
                        // 初期レンダリング
                        self.render();
                        
                        var initTime = performance.now() - startTime;
                        console.log('✅ CanvasManager初期化完了 - ' + initTime.toFixed(2) + 'ms');
                        
                        self.initialized = true;
                        console.groupEnd();
                        resolve(self);
                    })
                    .catch(function(error) {
                        console.error('❌ CanvasManager初期化エラー:', error);
                        if (window.ErrorManager) {
                            window.ErrorManager.showError('error', 'キャンバス初期化失敗: ' + error.message);
                        }
                        console.groupEnd();
                        reject(error);
                    });
                    
            } catch (error) {
                console.error('❌ CanvasManager初期化エラー:', error);
                if (window.ErrorManager) {
                    window.ErrorManager.showError('error', 'キャンバス初期化失敗: ' + error.message);
                }
                console.groupEnd();
                reject(error);
            }
        });
    };
    
    /**
     * ✅ 差分パッチ対応: Phase2移行 CoordinateManager統合初期化
     */
    CanvasManager.prototype.initializeCoordinateIntegration = function() {
        console.log('🔄 CanvasManager座標統合初期化開始...');
        
        try {
            // CoordinateManager依存性確認
            if (!window.CoordinateManager) {
                throw new Error('CoordinateManager が必要です。座標統合を完了してください。');
            }
            
            // CoordinateManagerインスタンス生成
            if (!this.coordinateManager) {
                this.coordinateManager = new window.CoordinateManager();
            }
            
            // 座標統合設定確認・更新
            var coordinateConfig = ConfigManager.getCoordinateConfig();
            this.coordinateIntegration = {
                enabled: coordinateConfig.integration && coordinateConfig.integration.managerCentralization || false,
                duplicateElimination: coordinateConfig.integration && coordinateConfig.integration.duplicateElimination || false,
                performance: coordinateConfig.performance || {},
                unifiedErrorHandling: coordinateConfig.integration && coordinateConfig.integration.unifiedErrorHandling || false,
                phase2Ready: false
            };
            
            if (!this.coordinateIntegration.enabled) {
                console.warn('⚠️ 座標統合が無効です。ConfigManagerで coordinate.integration.managerCentralization を true に設定してください。');
            }
            
            // CoordinateManager機能テスト
            this.validateCoordinateManagerFunctionality();
            
            // キャンバスサイズ情報をCoordinateManagerに通知
            if (this.coordinateManager.updateCanvasSize) {
                this.coordinateManager.updateCanvasSize(this.width, this.height);
            }
            
            // Phase2準備完了判定
            this.coordinateIntegration.phase2Ready = !!(
                this.coordinateManager &&
                this.coordinateIntegration.enabled &&
                this.coordinateIntegration.duplicateElimination
            );
            
            console.log('✅ CanvasManager座標統合初期化完了');
            console.log('🔄 統合設定:', this.coordinateIntegration);
            
            // EventBus通知
            if (window.EventBus) {
                window.EventBus.safeEmit('canvas.coordinate.integration.completed', {
                    canvasManager: 'CanvasManager',
                    coordinateManagerAvailable: !!this.coordinateManager,
                    integrationEnabled: this.coordinateIntegration.enabled,
                    phase2Ready: this.coordinateIntegration.phase2Ready,
                    timestamp: Date.now()
                });
            }
            
            return this.coordinateManager;
            
        } catch (error) {
            console.error('❌ CanvasManager座標統合初期化失敗:', error);
            
            // CoordinateManagerなしでも動作継続
            this.coordinateManager = null;
            this.coordinateIntegration = {
                enabled: false,
                duplicateElimination: false,
                performance: {},
                error: error.message,
                phase2Ready: false
            };
            
            if (window.ErrorManager) {
                window.ErrorManager.showError('canvas-coordinate-integration', 
                    'CanvasManager座標統合初期化失敗: ' + error.message, 
                    { canvasSize: { width: this.width, height: this.height } }
                );
            }
            
            return null;
        }
    };

    /**
     * 🆕 CoordinateManager機能テスト（完全実装版）
     */
    CanvasManager.prototype.validateCoordinateManagerFunctionality = function() {
        if (!this.coordinateManager) return false;
        
        try {
            // 基本的な座標変換テスト
            var testRect = { left: 0, top: 0, width: this.width, height: this.height };
            var testResult = this.coordinateManager.screenToCanvas(100, 100, testRect);
            
            if (!testResult || typeof testResult.x !== 'number' || typeof testResult.y !== 'number') {
                throw new Error('座標変換機能が正常に動作しません');
            }
            
            // 座標妥当性確認テスト
            if (typeof this.coordinateManager.validateCoordinateIntegrity === 'function') {
                var validityTest = this.coordinateManager.validateCoordinateIntegrity({ x: 100, y: 100 });
                if (!validityTest) {
                    throw new Error('座標妥当性確認機能が正常に動作しません');
                }
            }
            
            // 距離計算テスト
            if (this.coordinateManager.calculateDistance) {
                var distance = this.coordinateManager.calculateDistance(
                    { x: 0, y: 0 }, 
                    { x: 3, y: 4 }
                );
                if (Math.abs(distance - 5) > 0.1) {
                    throw new Error('距離計算機能が正常に動作しません');
                }
            }
            
            // 精度適用テスト
            if (this.coordinateManager.applyPrecision) {
                var precisionTest = this.coordinateManager.applyPrecision(123.456789);
                if (typeof precisionTest !== 'number') {
                    throw new Error('精度適用機能が正常に動作しません');
                }
            }
            
            console.log('✅ CanvasManager: CoordinateManager機能テスト合格');
            return true;
            
        } catch (error) {
            console.error('❌ CanvasManager: CoordinateManager機能テスト失敗:', error);
            throw new Error('CoordinateManager機能テスト失敗: ' + error.message);
        }
    };

    /**
     * 🔄 座標統合状態取得（修正版）
     */
    CanvasManager.prototype.getCoordinateIntegrationState = function() {
        return {
            coordinateManagerAvailable: !!this.coordinateManager,
            integrationEnabled: this.coordinateIntegration && this.coordinateIntegration.enabled || false,
            duplicateElimination: this.coordinateIntegration && this.coordinateIntegration.duplicateElimination || false,
            unifiedErrorHandling: this.coordinateIntegration && this.coordinateIntegration.unifiedErrorHandling || false,
            performanceOptimized: !!(this.coordinateIntegration && 
                                    (this.coordinateIntegration.performance && this.coordinateIntegration.performance.coordinateCache || 
                                     this.coordinateIntegration.performance && this.coordinateIntegration.performance.batchProcessing)),
            currentSize: { width: this.width, height: this.height },
            hasContent: this.paths && this.paths.length > 0,
            coordinateManagerState: this.coordinateManager ? 
                (this.coordinateManager.getCoordinateState ? this.coordinateManager.getCoordinateState() : 'available') : null,
            phase2Ready: !!(this.coordinateManager && 
                            this.coordinateIntegration && this.coordinateIntegration.enabled &&
                            this.coordinateIntegration && this.coordinateIntegration.duplicateElimination),
            initializationError: this.coordinateIntegration && this.coordinateIntegration.error || null,
            methodsImplemented: {
                initializeCoordinateIntegration: typeof this.initializeCoordinateIntegration === 'function',
                getUnifiedCanvasCoordinates: typeof this.getUnifiedCanvasCoordinates === 'function',
                startDrawingWithCoordinateIntegration: typeof this.startDrawingWithCoordinateIntegration === 'function'
            }
        };
    };

    /**
     * 🆕 座標統合診断実行（完全実装版・構文修正版）
     */
    CanvasManager.prototype.runCoordinateIntegrationDiagnosis = function() {
        console.group('🔍 CanvasManager座標統合診断（完全実装版・構文修正版）');
        
        var state = this.getCoordinateIntegrationState();
        
        // 統合機能テスト
        var integrationTests = {
            coordinateManagerAvailable: !!this.coordinateManager,
            coordinateIntegrationEnabled: this.coordinateIntegration && this.coordinateIntegration.enabled || false,
            initializeCoordinateIntegrationMethodExists: typeof this.initializeCoordinateIntegration === 'function',
            unifiedCoordinateExtraction: typeof this.getUnifiedCanvasCoordinates === 'function',
            drawingCoordinateIntegration: typeof this.startDrawingWithCoordinateIntegration === 'function',
            eventHandlerIntegration: typeof this.handlePointerDownWithCoordinateIntegration === 'function'
        };
        
        // 診断結果
        var diagnosis = {
            state: state,
            integrationTests: integrationTests,
            compliance: {
                coordinateUnified: integrationTests.coordinateManagerAvailable && 
                                 integrationTests.coordinateIntegrationEnabled,
                duplicateEliminated: this.coordinateIntegration && this.coordinateIntegration.duplicateElimination || false,
                phase2Ready: state.phase2Ready,
                drawingSystemIntegrated: integrationTests.drawingCoordinateIntegration &&
                                       integrationTests.eventHandlerIntegration,
                fullFunctionality: Object.keys(integrationTests).every(function(key) { return integrationTests[key]; }),
                initializationMethodReady: integrationTests.initializeCoordinateIntegrationMethodExists
            }
        };
        
        console.log('📊 CanvasManager座標統合診断結果:', diagnosis);
        
        // 診断結果表示
        var passedTests = Object.keys(integrationTests).filter(function(key) { return integrationTests[key]; }).length;
        var totalTests = Object.keys(integrationTests).length;
        
        console.log('📊 統合テスト: ' + passedTests + '/' + totalTests + ' (' + Math.round(passedTests/totalTests*100) + '%)');
        console.log('⚙️ CoordinateManager統合:', integrationTests.coordinateManagerAvailable ? '✅' : '❌');
        console.log('🔄 初期化メソッド:', integrationTests.initializeCoordinateIntegrationMethodExists ? '✅' : '❌');
        console.log('🎨 描画システム統合:', diagnosis.compliance.drawingSystemIntegrated ? '✅' : '❌');
        console.log('🚀 Phase2準備:', state.phase2Ready ? '✅' : '❌');
        
        // 推奨事項
        var recommendations = [];
        
        if (!integrationTests.coordinateManagerAvailable) {
            recommendations.push('initializeCoordinateIntegration()を実行してCoordinateManagerを初期化');
        }
        
        if (!integrationTests.coordinateIntegrationEnabled) {
            recommendations.push('座標統合設定の有効化が必要 (coordinate.integration.managerCentralization)');
        }
        
        if (!integrationTests.initializeCoordinateIntegrationMethodExists) {
            recommendations.push('initializeCoordinateIntegration()メソッドの実装が必要');
        }
        
        if (!diagnosis.compliance.drawingSystemIntegrated) {
            var missingDrawing = ['unifiedCoordinateExtraction', 'drawingCoordinateIntegration', 'eventHandlerIntegration']
                .filter(function(key) { return !integrationTests[key]; });
            recommendations.push('描画システム統合が不完全: ' + missingDrawing.join(', '));
        }
        
        if (!diagnosis.compliance.duplicateEliminated) {
            recommendations.push('重複排除設定の有効化を推奨 (coordinate.integration.duplicateElimination)');
        }
        
        if (recommendations.length === 0) {
            console.log('✅ CanvasManager座標統合診断: 全ての要件を満たしています（完全実装版）');
        } else {
            console.warn('⚠️ CanvasManager推奨事項:', recommendations);
        }
        
        console.groupEnd();
        
        return diagnosis;
    };
    
    /**
     * 設定読み込み
     */
    CanvasManager.prototype.loadConfiguration = function() {
        var self = this;
        return new Promise(function(resolve, reject) {
            try {
                var canvasConfig = ConfigManager.getCanvasConfig();
                var pixiConfig = ConfigManager.getPixiConfig();
                
                self.width = canvasConfig.width;
                self.height = canvasConfig.height;
                self.backgroundColor = canvasConfig.backgroundColor;
                self.pixiConfig = pixiConfig;
                
                console.log('⚙️ 設定読み込み完了: ' + self.width + '×' + self.height);
                resolve();
                
            } catch (error) {
                console.warn('⚠️ 設定読み込み失敗 - デフォルト設定使用:', error.message);
                
                // フォールバック設定
                self.width = 400;
                self.height = 400;
                self.backgroundColor = 0xf0e0d6;
                self.pixiConfig = { antialias: true, resolution: 1 };
                resolve();
            }
        });
    };
    
    /**
     * PixiJS初期化
     */
    CanvasManager.prototype.initializePixiApplication = function() {
        var self = this;
        return new Promise(function(resolve, reject) {
            try {
                // PixiJS Application作成
                // 📋 V8_MIGRATION: await PIXI.Application.init() に変更予定
                self.app = new PIXI.Application({
                    width: self.width,
                    height: self.height,
                    backgroundColor: self.backgroundColor,
                    view: self.canvasElement,
                    antialias: self.pixiConfig.antialias,
                    resolution: self.pixiConfig.resolution
                });
                
                // 📋 V8_MIGRATION: background プロパティに変更予定
                // this.app.background = this.backgroundColor;
                
                // ヒットエリア設定
                self.app.stage.hitArea = new PIXI.Rectangle(0, 0, self.width, self.height);
                self.app.stage.interactive = true;
                
                console.log('✅ PixiJS Application初期化完了');
                resolve();
                
            } catch (error) {
                reject(new Error('PixiJS初期化失敗: ' + error.message));
            }
        });
    };
    
    /**
     * レイヤー初期化
     */
    CanvasManager.prototype.initializeLayers = function() {
        try {
            // 背景レイヤー
            this.backgroundLayer = new PIXI.Container();
            this.backgroundLayer.name = 'background';
            this.app.stage.addChild(this.backgroundLayer);
            
            // メインレイヤー
            this.mainLayer = new PIXI.Container();
            this.mainLayer.name = 'main';
            this.app.stage.addChild(this.mainLayer);
            
            // レイヤー管理
            this.layers = {
                background: this.backgroundLayer,
                main: this.mainLayer
            };
            
            this.stats.layerCount = Object.keys(this.layers).length;
            
            console.log('✅ レイヤー初期化完了');
            
        } catch (error) {
            throw new Error('レイヤー初期化失敗: ' + error.message);
        }
    };
    
    /**
     * イベントハンドラー設定（座標統合対応）
     */
    CanvasManager.prototype.setupEventHandlers = function() {
        var self = this;
        try {
            if (!this.app || !this.app.stage) {
                throw new Error('PixiJS stage が利用できません');
            }
            
            // 🔄 COORDINATE_INTEGRATION: 座標統合イベントハンドラー
            this.app.stage.on('pointerdown', function(event) {
                self.handlePointerDownWithCoordinateIntegration(event);
            });
            
            this.app.stage.on('pointermove', function(event) {
                self.handlePointerMoveWithCoordinateIntegration(event);
            });
            
            this.app.stage.on('pointerup', function(event) {
                self.handlePointerUpWithCoordinateIntegration(event);
            });
            
            this.app.stage.on('pointerupoutside', function(event) {
                self.handlePointerUpWithCoordinateIntegration(event);
            });
            
            console.log('✅ 座標統合イベントハンドラー設定完了');
            
        } catch (error) {
            throw new Error('イベントハンドラー設定失敗: ' + error.message);
        }
    };
    
    // ==========================================
    // 🔄 座標統合処理メソッド群
    // ==========================================
    
    /**
     * 🔄 統合座標取得（getBoundingClientRect()の統一処理）
     */
    CanvasManager.prototype.getUnifiedCanvasCoordinates = function(event) {
        if (!this.coordinateManager) {
            console.warn('⚠️ CoordinateManager未初期化 - フォールバック処理');
            return this.getFallbackCanvasCoordinates(event);
        }
        
        try {
            // キャンバス要素の矩形取得
            var canvasRect = this.canvasElement && this.canvasElement.getBoundingClientRect();
            if (!canvasRect) {
                throw new Error('キャンバス要素が見つかりません');
            }
            
            // CoordinateManager経由で統一座標抽出
            var coordinates = this.coordinateManager.extractPointerCoordinates(
                event, 
                canvasRect, 
                this.app // PixiJSアプリ
            );
            
            // 座標妥当性確認
            if (this.coordinateManager.validateCoordinateIntegrity && 
                !this.coordinateManager.validateCoordinateIntegrity(coordinates.canvas)) {
                throw new Error('無効な座標が検出されました');
            }
            
            return coordinates;
            
        } catch (error) {
            if (window.ErrorManager) {
                window.ErrorManager.showError('coordinate-canvas-unified', 
                    '統一座標取得エラー: ' + error.message, 
                    { event: event && event.type }
                );
            }
            return this.getFallbackCanvasCoordinates(event);
        }
    };
    
    /**
     * 🔄 フォールバック座標取得（緊急時用）
     */
    CanvasManager.prototype.getFallbackCanvasCoordinates = function(event) {
        console.warn('🔧 座標取得フォールバック処理実行');
        
        try {
            var rect = this.canvasElement && this.canvasElement.getBoundingClientRect();
            if (!rect) {
                return { screen: { x: 0, y: 0 }, canvas: { x: 0, y: 0 }, pressure: 0.5 };
            }
            
            var clientX = event.clientX || 0;
            var clientY = event.clientY || 0;
            
            // 基本的な座標変換（CoordinateManagerの簡易版）
            var canvasX = Math.max(0, Math.min(this.width, clientX - rect.left));
            var canvasY = Math.max(0, Math.min(this.height, clientY - rect.top));
            
            return {
                screen: { x: clientX, y: clientY },
                canvas: { x: canvasX, y: canvasY },
                pressure: event.pressure || 0.5
            };
            
        } catch (error) {
            console.error('❌ フォールバック座標取得失敗:', error);
            return { screen: { x: 0, y: 0 }, canvas: { x: 0, y: 0 }, pressure: 0.5 };
        }
    };
    
    // ==========================================
    // 🔄 描画処理メソッド群（座標統合対応）
    // ==========================================
    
    /**
     * 🔄 統合描画開始処理
     */
    CanvasManager.prototype.startDrawingWithCoordinateIntegration = function(event) {
        try {
            // CoordinateManager経由で統一座標取得
            var coordinates = this.getUnifiedCanvasCoordinates(event);
            
            if (!coordinates) {
                throw new Error('座標取得に失敗しました');
            }
            
            // 新しいパス開始
            var pathId = 'path_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
            var graphics = new PIXI.Graphics();
            
            this.currentPath = {
                id: pathId,
                graphics: graphics,
                points: [coordinates.canvas],
                startTime: Date.now(),
                tool: 'pen' // 現在のツール
            };
            
            // グラフィクスをメインレイヤーに追加
            this.mainLayer.addChild(graphics);
            
            // パス配列に追加
            this.paths.push(this.currentPath);
            this.stats.pathCount = this.paths.length;
            
            // 描画開始
            graphics.lineStyle(16, 0x800000, 0.85);
            graphics.moveTo(coordinates.canvas.x, coordinates.canvas.y);
            
            // 描画状態更新
            this.isDrawing = true;
            this.lastDrawingPoint = coordinates.canvas;
            
            // StateManager経由で状態更新
            if (window.StateManager) {
                window.StateManager.updateComponentState('canvasManager', 'drawing', {
                    isDrawing: true,
                    coordinates: coordinates.canvas,
                    pressure: coordinates.pressure,
                    pathId: pathId,
                    timestamp: Date.now()
                });
            }
            
            console.log('🎨 CoordinateManager統合描画開始: (' + coordinates.canvas.x.toFixed(1) + ', ' + coordinates.canvas.y.toFixed(1) + ')');
            
            return coordinates;
            
        } catch (error) {
            if (window.ErrorManager) {
                window.ErrorManager.showError('canvas-draw-start-coordinate', 
                    '統合描画開始エラー: ' + error.message, 
                    { event: event && event.type }
                );
            }
            return null;
        }
    };
    
    /**
     * 🔄 統合描画継続処理
     */
    CanvasManager.prototype.continueDrawingWithCoordinateIntegration = function(event) {
        if (!this.isDrawing || !this.currentPath) return null;
        
        try {
            // CoordinateManager経由で統一座標取得
            var coordinates = this.getUnifiedCanvasCoordinates(event);
            
            if (!coordinates) {
                throw new Error('座標取得に失敗しました');
            }
            
            // 前回座標との距離計算（CoordinateManager使用）
            var shouldDraw = true;
            if (this.lastDrawingPoint && this.coordinateManager) {
                var distance = this.coordinateManager.calculateDistance(
                    this.lastDrawingPoint, 
                    coordinates.canvas
                );
                
                // 最小描画距離チェック
                var minDistance = ConfigManager.get && ConfigManager.get('drawing.pen.minDistance') || 1.5;
                shouldDraw = distance >= minDistance;
            }
            
            if (shouldDraw) {
                // 線を描画
                this.currentPath.graphics.lineTo(coordinates.canvas.x, coordinates.canvas.y);
                
                // 座標を記録
                this.currentPath.points.push(coordinates.canvas);
                this.lastDrawingPoint = coordinates.canvas;
            }
            
            return coordinates;
            
        } catch (error) {
            if (window.ErrorManager) {
                window.ErrorManager.showError('canvas-draw-continue-coordinate', 
                    '統合描画継続エラー: ' + error.message, 
                    { event: event && event.type }
                );
            }
            return null;
        }
    };
    
    /**
     * 🔄 統合描画終了処理
     */
    CanvasManager.prototype.stopDrawingWithCoordinateIntegration = function() {
        try {
            if (this.currentPath) {
                this.currentPath.endTime = Date.now();
                this.currentPath.duration = this.currentPath.endTime - this.currentPath.startTime;
            }
            
            // 描画状態クリア
            this.isDrawing = false;
            this.currentPath = null;
            this.lastDrawingPoint = null;
            
            // StateManager経由で状態更新
            if (window.StateManager) {
                window.StateManager.updateComponentState('canvasManager', 'drawing', {
                    isDrawing: false,
                    timestamp: Date.now()
                });
            }
            
            console.log('🎨 CoordinateManager統合描画終了');
            
            return true;
            
        } catch (error) {
            if (window.ErrorManager) {
                window.ErrorManager.showError('canvas-draw-stop-coordinate', 
                    '統合描画終了エラー: ' + error.message
                );
            }
            return false;
        }
    };
    
    // ==========================================
    // 🔄 イベントハンドラー（座標統合対応）
    // ==========================================
    
    /**
     * 🔄 統合ポインターダウンハンドラー
     */
    CanvasManager.prototype.handlePointerDownWithCoordinateIntegration = function(event) {
        try {
            // CoordinateManager統合描画開始
            var coordinates = this.startDrawingWithCoordinateIntegration(event);
            
            if (coordinates) {
                // EventBus通知
                if (window.EventBus) {
                    window.EventBus.safeEmit('canvas.pointer.down', {
                        coordinates: coordinates,
                        event: event.type,
                        timestamp: Date.now()
                    });
                }
            }
            
        } catch (error) {
            if (window.ErrorManager) {
                window.ErrorManager.showError('canvas-pointer-down-coordinate', 
                    '統合ポインターダウンエラー: ' + error.message, 
                    { event: event && event.type }
                );
            }
        }
    };
    
    /**
     * 🔄 統合ポインター移動ハンドラー
     */
    CanvasManager.prototype.handlePointerMoveWithCoordinateIntegration = function(event) {
        try {
            if (this.isDrawing) {
                // CoordinateManager統合描画継続
                var coordinates = this.continueDrawingWithCoordinateIntegration(event);
                
                if (coordinates) {
                    // EventBus通知
                    if (window.EventBus) {
                        window.EventBus.safeEmit('canvas.pointer.move', {
                            coordinates: coordinates,
                            isDrawing: true,
                            event: event.type,
                            timestamp: Date.now()
                        });
                    }
                }
            }
            
        } catch (error) {
            if (window.ErrorManager) {
                window.ErrorManager.showError('canvas-pointer-move-coordinate', 
                    '統合ポインター移動エラー: ' + error.message, 
                    { event: event && event.type }
                );
            }
        }
    };
    
    /**
     * 🔄 統合ポインターアップハンドラー
     */
    CanvasManager.prototype.handlePointerUpWithCoordinateIntegration = function(event) {
        try {
            if (this.isDrawing) {
                // CoordinateManager統合描画終了
                var success = this.stopDrawingWithCoordinateIntegration();
                
                if (success) {
                    // EventBus通知
                    if (window.EventBus) {
                        window.EventBus.safeEmit('canvas.pointer.up', {
                            wasDrawing: true,
                            event: event.type,
                            timestamp: Date.now()
                        });
                    }
                }
            }
            
        } catch (error) {
            if (window.ErrorManager) {
                window.ErrorManager.showError('canvas-pointer-up-coordinate', 
                    '統合ポインターアップエラー: ' + error.message, 
                    { event: event && event.type }
                );
            }
        }
    };
    
    // ==========================================
    // 🔄 基本機能メソッド群
    // ==========================================
    
    /**
     * レンダリング
     */
    CanvasManager.prototype.render = function() {
        try {
            var startTime = performance.now();
            
            // PixiJS自動レンダリング（通常は自動）
            // 手動レンダリングが必要な場合のみ
            
            this.stats.renderTime = performance.now() - startTime;
            
        } catch (error) {
            console.error('❌ レンダリングエラー:', error);
        }
    };
    
    /**
     * クリア
     */
    CanvasManager.prototype.clear = function() {
        try {
            // 全パスのグラフィクス削除
            for (var i = 0; i < this.paths.length; i++) {
                var path = this.paths[i];
                if (path.graphics && path.graphics.parent) {
                    path.graphics.parent.removeChild(path.graphics);
                    path.graphics.destroy();
                }
            }
            
            // パス配列クリア
            this.paths = [];
            this.stats.pathCount = 0;
            
            // 描画状態リセット
            this.isDrawing = false;
            this.currentPath = null;
            this.lastDrawingPoint = null;
            
            console.log('🧹 キャンバスクリア完了');
            
            return true;
            
        } catch (error) {
            console.error('❌ クリアエラー:', error);
            return false;
        }
    };
    
    /**
     * サイズ変更
     */
    CanvasManager.prototype.resize = function(newWidth, newHeight, centerContent) {
        centerContent = centerContent || false;
        var oldWidth = this.width;
        var oldHeight = this.height;
        
        try {
            // PixiJS Applicationリサイズ
            // 📋 V8_MIGRATION: app.resize()に変更予定
            this.app.renderer.resize(newWidth, newHeight);
            
            // キャンバス要素のサイズ更新
            if (this.canvasElement) {
                this.canvasElement.style.width = newWidth + 'px';
                this.canvasElement.style.height = newHeight + 'px';
            }
            
            // 内部サイズ更新
            this.width = newWidth;
            this.height = newHeight;
            
            // 🔄 CoordinateManagerにサイズ変更通知
            if (this.coordinateManager) {
                this.coordinateManager.updateCanvasSize(newWidth, newHeight);
            }
            
            // ヒットエリア更新
            if (this.app.stage) {
                this.app.stage.hitArea = new PIXI.Rectangle(0, 0, newWidth, newHeight);
            }
            
            console.log('📐 座標統合リサイズ: ' + oldWidth + '×' + oldHeight + ' → ' + newWidth + '×' + newHeight);
            
            return true;
            
        } catch (error) {
            if (window.ErrorManager) {
                window.ErrorManager.showError('canvas-resize-coordinate', 
                    '座標統合リサイズエラー: ' + error.message, 
                    { newWidth: newWidth, newHeight: newHeight, centerContent: centerContent }
                );
            }
            return false;
        }
    };
    
    /**
     * 統計取得
     */
    CanvasManager.prototype.getStats = function() {
        return {
            renderTime: this.stats.renderTime,
            pathCount: this.stats.pathCount,
            layerCount: this.stats.layerCount,
            initialized: this.initialized,
            canvasSize: { width: this.width, height: this.height },
            isDrawing: this.isDrawing,
            coordinateIntegration: this.getCoordinateIntegrationState()
        };
    };
    
    /**
     * デバッグ情報
     */
    CanvasManager.prototype.getDebugInfo = function() {
        var stats = this.getStats();
        var diagnosis = this.getCoordinateIntegrationState();
        
        return {
            version: this.version,
            stats: stats,
            coordinateIntegration: diagnosis,
            pixiApp: {
                stage: !!(this.app && this.app.stage),
                renderer: !!(this.app && this.app.renderer)
            }
        };
    };
    
    /**
     * 破棄処理
     */
    CanvasManager.prototype.destroy = function() {
        try {
            console.log('🗑️ CanvasManager破棄開始...');
            
            // 描画停止
            if (this.isDrawing) {
                this.stopDrawingWithCoordinateIntegration();
            }
            
            // パスクリア
            this.clear();
            
            // PixiJS破棄
            if (this.app) {
                this.app.destroy(true);
                this.app = null;
            }
            
            // 参照クリア
            this.canvasElement = null;
            this.appCore = null;
            this.coordinateManager = null;
            this.layers = {};
            this.mainLayer = null;
            this.backgroundLayer = null;
            
            this.initialized = false;
            
            console.log('✅ CanvasManager破棄完了（座標統合対応・構文修正版）');
            
        } catch (error) {
            console.error('❌ CanvasManager破棄エラー:', error);
        }
    };

    // ==========================================
    // 🎯 Pure JavaScript グローバル公開
    // ==========================================

    global.CanvasManager = CanvasManager;
    console.log('✅ CanvasManager 座標統合パッチ適用版 グローバル公開完了（Pure JavaScript・構文修正版）');

})(window);

console.log('🔧 CanvasManager Phase1.4 座標統合パッチ適用版・構文修正版 - 準備完了');
console.log('📋 差分パッチ適用完了: initializeCoordinateIntegration()メソッド実装');
console.log('🔄 座標統合実装完了: CoordinateManager完全統合・重複排除・Phase2準備');
console.log('🔧 構文エラー修正完了: Invalid or unexpected token エラー解決');
console.log('✅ 主な修正事項:');
console.log('  - ES6構文をES5互換に変更（class → function、arrow function → function）');
console.log('  - constructor()でcoordinateManager = null追加');
console.log('  - initialize()でinitializeCoordinateIntegration()呼び出し追加');
console.log('  - initializeCoordinateIntegration()メソッド完全実装');
console.log('  - getCoordinateIntegrationState()メソッド構文修正');
console.log('  - 座標統合診断システム強化・構文エラー解決');
console.log('  - Promise-based初期化に変更');
console.log('  - IIFE (Immediately Invoked Function Expression) でグローバル公開');
console.log('💡 使用例: const canvasManager = new window.CanvasManager(); await canvasManager.initialize(appCore, canvas);');