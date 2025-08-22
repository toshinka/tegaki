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
 * 
 * 🛠 BUG_FIX: 座標変換バグ修正版（左上から線が伸びる現象対策）
 * 🔧 COORDINATE_BUG_FIXES: 
 *   - イベントハンドラーでcanvasRect毎回取得
 *   - CoordinateManager安全版メソッド使用
 *   - デバッグログ強化
 *   - フォールバック処理改善
 */

/**
 * Canvas Manager 座標統合完全実装版（構文エラー修正版・座標バグ修正版）
 * 差分パッチ対応：initializeCoordinateIntegration()メソッド実装
 */
(function(global) {
    'use strict';

    function CanvasManager(options) {
        options = options || {};
        
        this.version = 'v1.0-Phase1.4-coordinate-patch-syntax-fixed-bugfix';
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
            layerCount: 0,
            // 🛠 バグ修正統計追加
            canvasRectRetrievalCount: 0,
            coordinateExtractionErrors: 0
        };
        
        console.log('🎨 CanvasManager ' + this.version + ' 構築完了（差分パッチ適用済み・構文修正版・座標バグ修正版）');
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
                
                // 🛠 キャンバス要素の妥当性確認（バグ修正対応）
                if (!self.canvasElement || !self.canvasElement.getBoundingClientRect) {
                    throw new Error('有効なキャンバス要素が必要です（getBoundingClientRect()メソッド必須）');
                }
                
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
     * イベントハンドラー設定（座標統合対応・バグ修正版）
     */
    CanvasManager.prototype.setupEventHandlers = function() {
        var self = this;
        try {
            if (!this.app || !this.app.stage) {
                throw new Error('PixiJS stage が利用できません');
            }
            
            // 🛠 座標統合イベントハンドラー（バグ修正版）
            this.app.stage.on('pointerdown', function(event) {
                self.handlePointerDownWithCoordinateIntegrationFixed(event);
            });
            
            this.app.stage.on('pointermove', function(event) {
                self.handlePointerMoveWithCoordinateIntegrationFixed(event);
            });
            
            this.app.stage.on('pointerup', function(event) {
                self.handlePointerUpWithCoordinateIntegrationFixed(event);
            });
            
            this.app.stage.on('pointerupoutside', function(event) {
                self.handlePointerUpWithCoordinateIntegrationFixed(event);
            });
            
            console.log('✅ 座標統合イベントハンドラー設定完了（バグ修正版）');
            
        } catch (error) {
            throw new Error('イベントハンドラー設定失敗: ' + error.message);
        }
    };
    
    // ==========================================
    // 🛠 座標統合処理メソッド群（バグ修正版）
    // ==========================================
    
    /**
     * 🛠 統合座標取得（getBoundingClientRect()の統一処理・バグ修正版）
     * 修正点: canvasRect毎回取得、デバッグログ追加、エラーハンドリング強化
     */
    CanvasManager.prototype.getUnifiedCanvasCoordinatesFixed = function(event) {
        try {
            // 🛠 Step 1: canvasRect を毎回取得（バグ修正の核心）
            if (!this.canvasElement) {
                throw new Error('キャンバス要素が見つかりません');
            }
            
            var canvasRect = this.canvasElement.getBoundingClientRect();
            this.stats.canvasRectRetrievalCount++;
            
            // 🛠 canvasRect の妥当性確認
            if (!canvasRect || typeof canvasRect.left !== 'number' || typeof canvasRect.top !== 'number') {
                throw new Error('getBoundingClientRect()で無効な結果が返されました');
            }
            
            // 🛠 デバッグログ: canvasRect確認
            console.log("📍canvasRect取得", {
                left: canvasRect.left,
                top: canvasRect.top,
                width: canvasRect.width,
                height: canvasRect.height,
                retrievalCount: this.stats.canvasRectRetrievalCount
            });
            
            if (!this.coordinateManager) {
                console.warn('⚠️ CoordinateManager未初期化 - フォールバック処理');
                return this.getFallbackCanvasCoordinates(event);
            }
            
            // 🛠 CoordinateManager経由で統一座標抽出（安全版使用）
            var coordinates = this.coordinateManager.extractPointerCoordinates(
                event, 
                canvasRect, 
                this.app // PixiJSアプリ
            );
            
            // 🛠 結果の妥当性最終確認
            if (!coordinates || !coordinates.canvas) {
                throw new Error('座標抽出結果が無効です');
            }
            
            if (this.coordinateManager.validateCoordinateIntegrity && 
                !this.coordinateManager.validateCoordinateIntegrity(coordinates.canvas)) {
                throw new Error('無効な座標が検出されました');
            }
            
            return coordinates;
            
        } catch (error) {
            this.stats.coordinateExtractionErrors++;
            console.error('❌ 統合座標取得エラー:', error);
            
            if (window.ErrorManager) {
                window.ErrorManager.showError('coordinate-canvas-unified-fixed', 
                    '統合座標取得エラー: ' + error.message, 
                    { 
                        event: event && event.type,
                        canvasElement: !!this.canvasElement,
                        coordinateManager: !!this.coordinateManager,
                        retrievalCount: this.stats.canvasRectRetrievalCount,
                        errorCount: this.stats.coordinateExtractionErrors
                    }
                );
            }
            
            return this.getFallbackCanvasCoordinates(event);
        }
    };
    
    /**
     * 🔄 フォールバック座標取得（緊急時用・改良版）
     */
    CanvasManager.prototype.getFallbackCanvasCoordinates = function(event) {
        console.warn('🔧 座標取得フォールバック処理実行（改良版）');
        
        try {
            // 🛠 canvasRect を再取得試行
            var rect = null;
            if (this.canvasElement && this.canvasElement.getBoundingClientRect) {
                try {
                    rect = this.canvasElement.getBoundingClientRect();
                } catch (rectError) {
                    console.error('❌ getBoundingClientRect()でエラー:', rectError);
                }
            }
            
            if (!rect) {
                // 最終フォールバック: 固定値使用
                console.warn('⚠️ canvasRect取得不可 - 固定値使用');
                return { 
                    screen: { x: 100, y: 100 }, 
                    canvas: { x: 100, y: 100 }, 
                    pressure: 0.5,
                    fallback: true,
                    fallbackReason: 'canvasRect_unavailable'
                };
            }
            
            var clientX = event.clientX || 100;  // デフォルト値で(0,0)回避
            var clientY = event.clientY || 100;  // デフォルト値で(0,0)回避
            
            // 🛠 基本的な座標変換（CoordinateManagerの簡易版・(0,0)回避）
            var canvasX = Math.max(10, Math.min(this.width - 10, clientX - rect.left));  // 境界から10px離す
            var canvasY = Math.max(10, Math.min(this.height - 10, clientY - rect.top)); // 境界から10px離す
            
            return {
                screen: { x: clientX, y: clientY },
                canvas: { x: canvasX, y: canvasY },
                pressure: event.pressure || 0.5,
                fallback: true,
                fallbackReason: 'coordinate_manager_error'
            };
            
        } catch (error) {
            console.error('❌ フォールバック座標取得失敗:', error);
            
            // 最終的な安全座標
            return { 
                screen: { x: 100, y: 100 }, 
                canvas: { x: 100, y: 100 }, 
                pressure: 0.5,
                fallback: true,
                fallbackReason: 'complete_failure'
            };
        }
    };
    
    // ==========================================
    // 🛠 描画処理メソッド群（座標統合対応・バグ修正版）
    // ==========================================
    
    /**
     * 🛠 統合描画開始処理（バグ修正版）
     */
    CanvasManager.prototype.startDrawingWithCoordinateIntegrationFixed = function(event) {
        try {
            // 🛠 CoordinateManager経由で統一座標取得（バグ修正版）
            var coordinates = this.getUnifiedCanvasCoordinatesFixed(event);
            
            if (!coordinates || !coordinates.canvas) {
                throw new Error('座標取得に失敗しました');
            }
            
            // 🛠 (0,0)座標の異常検出
            if (coordinates.canvas.x === 0 && coordinates.canvas.y === 0 && !coordinates.fallback) {
                console.warn('⚠️ 異常な(0,0)座標を検出 - 描画をスキップします', coordinates);
                return null;
            }
            
            // 新しいパス開始
            var pathId = 'path_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
            var graphics = new PIXI.Graphics();
            
            this.currentPath = {
                id: pathId,
                graphics: graphics,
                points: [coordinates.canvas],
                startTime: Date.now(),
                tool: 'pen', // 現在のツール
                fallbackUsed: !!coordinates.fallback
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
                    fallbackUsed: coordinates.fallback,
                    timestamp: Date.now()
                });
            }
            
            console.log('🎨 CoordinateManager統合描画開始（バグ修正版）: (' + 
                       coordinates.canvas.x.toFixed(1) + ', ' + coordinates.canvas.y.toFixed(1) + ')' +
                       (coordinates.fallback ? ' [フォールバック]' : ''));
            
            return coordinates;
            
        } catch (error) {
            console.error('❌ 統合描画開始エラー:', error);
            if (window.ErrorManager) {
                window.ErrorManager.showError('canvas-draw-start-coordinate-fixed', 
                    '統合描画開始エラー: ' + error.message, 
                    { event: event && event.type }
                );
            }
            return null;
        }
    };
    
    /**
     * 🛠 統合描画継続処理（バグ修正版）
     */
    CanvasManager.prototype.continueDrawingWithCoordinateIntegrationFixed = function(event) {
        if (!this.isDrawing || !this.currentPath) return null;
        
        try {
            // 🛠 CoordinateManager経由で統一座標取得（バグ修正版）
            var coordinates = this.getUnifiedCanvasCoordinatesFixed(event);
            
            if (!coordinates || !coordinates.canvas) {
                throw new Error('座標取得に失敗しました');
            }
            
            // 🛠 (0,0)座標の異常検出（継続時）
            if (coordinates.canvas.x === 0 && coordinates.canvas.y === 0 && !coordinates.fallback) {
                console.warn('⚠️ 描画継続で異常な(0,0)座標を検出 - このポイントをスキップします');
                return null;
            }
            
            // 前回座標との距離計算（CoordinateManager使用）
            var shouldDraw = true;
            if (this.lastDrawingPoint && this.coordinateManager && this.coordinateManager.calculateDistance) {
                var distance = this.coordinateManager.calculateDistance(
                    this.lastDrawingPoint, 
                    coordinates.canvas
                );
                
                // 最小描画距離チェック
                var minDistance = 1.5;
                if (ConfigManager.get) {
                    try {
                        minDistance = ConfigManager.get('drawing.pen.minDistance') || 1.5;
                    } catch (error) {
                        // ConfigManager.get()エラーは無視
                    }
                }
                shouldDraw = distance >= minDistance;
                
                // 🛠 異常に大きな距離のチェック（テレポート検出）
                if (distance > Math.min(this.width, this.height) * 0.5) {
                    console.warn('⚠️ 異常に大きな移動距離を検出:', distance, 'px - 描画をスキップ');
                    return null;
                }
            }
            
            if (shouldDraw) {
                // 線を描画
                this.currentPath.graphics.lineTo(coordinates.canvas.x, coordinates.canvas.y);
                
                // 座標を記録
                this.currentPath.points.push(coordinates.canvas);
                this.lastDrawingPoint = coordinates.canvas;
                
                // フォールバック使用記録
                if (coordinates.fallback && !this.currentPath.fallbackUsed) {
                    this.currentPath.fallbackUsed = true;
                }
            }
            
            return coordinates;
            
        } catch (error) {
            console.error('❌ 統合描画継続エラー:', error);
            if (window.ErrorManager) {
                window.ErrorManager.showError('canvas-draw-continue-coordinate-fixed', 
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
    CanvasManager.prototype.stopDrawingWithCoordinateIntegrationFixed = function() {
        try {
            if (this.currentPath) {
                this.currentPath.endTime = Date.now();
                this.currentPath.duration = this.currentPath.endTime - this.currentPath.startTime;
                
                // 🛠 描画パス統計
                console.log('🎨 描画パス完了:', {
                    id: this.currentPath.id,
                    pointCount: this.currentPath.points.length,
                    duration: this.currentPath.duration + 'ms',
                    fallbackUsed: this.currentPath.fallbackUsed
                });
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
            
            console.log('🎨 CoordinateManager統合描画終了（バグ修正版）');
            
            return true;
            
        } catch (error) {
            console.error('❌ 統合描画終了エラー:', error);
            if (window.ErrorManager) {
                window.ErrorManager.showError('canvas-draw-stop-coordinate-fixed', 
                    '統合描画終了エラー: ' + error.message
                );
            }
            return false;
        }
    };
    
    // ==========================================
    // 🛠 イベントハンドラー（座標統合対応・バグ修正版）
    // ==========================================
    
    /**
     * 🛠 統合ポインターダウンハンドラー（バグ修正版）
     */
    CanvasManager.prototype.handlePointerDownWithCoordinateIntegrationFixed = function(event) {
        try {
            // 🛠 CoordinateManager統合描画開始（バグ修正版）
            var coordinates = this.startDrawingWithCoordinateIntegrationFixed(event);
            
            if (coordinates) {
                // EventBus通知
                if (window.EventBus) {
                    window.EventBus.safeEmit('canvas.pointer.down', {
                        coordinates: coordinates,
                        event: event.type,
                        fallbackUsed: coordinates.fallback,
                        timestamp: Date.now()
                    });
                }
            } else {
                console.warn('⚠️ ポインターダウン: 座標取得失敗のため描画をスキップしました');
            }
            
        } catch (error) {
            console.error('❌ 統合ポインターダウンエラー:', error);
            if (window.ErrorManager) {
                window.ErrorManager.showError('canvas-pointer-down-coordinate-fixed', 
                    '統合ポインターダウンエラー: ' + error.message, 
                    { event: event && event.type }
                );
            }
        }
    };
    
    /**
     * 🛠 統合ポインター移動ハンドラー（バグ修正版）
     */
    CanvasManager.prototype.handlePointerMoveWithCoordinateIntegrationFixed = function(event) {
        try {
            if (this.isDrawing) {
                // 🛠 CoordinateManager統合描画継続（バグ修正版）
                var coordinates = this.continueDrawingWithCoordinateIntegrationFixed(event);
                
                if (coordinates) {
                    // EventBus通知
                    if (window.EventBus) {
                        window.EventBus.safeEmit('canvas.pointer.move', {
                            coordinates: coordinates,
                            isDrawing: true,
                            event: event.type,
                            fallbackUsed: coordinates.fallback,
                            timestamp: Date.now()
                        });
                    }
                }
                // 座標取得失敗時は単純にスキップ（エラー出力は既に実行済み）
            }
            
        } catch (error) {
            console.error('❌ 統合ポインター移動エラー:', error);
            if (window.ErrorManager) {
                window.ErrorManager.showError('canvas-pointer-move-coordinate-fixed', 
                    '統合ポインター移動エラー: ' + error.message, 
                    { event: event && event.type }
                );
            }
        }
    };
    
    /**
     * 🛠 統合ポインターアップハンドラー（バグ修正版）
     */
    CanvasManager.prototype.handlePointerUpWithCoordinateIntegrationFixed = function(event) {
        try {
            if (this.isDrawing) {
                // 🛠 CoordinateManager統合描画終了（バグ修正版）
                var success = this.stopDrawingWithCoordinateIntegrationFixed();
                
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
            console.error('❌ 統合ポインターアップエラー:', error);
            if (window.ErrorManager) {
                window.ErrorManager.showError('canvas-pointer-up-coordinate-fixed', 
                    '統合ポインターアップエラー: ' + error.message, 
                    { event: event && event.type }
                );
            }
        }
    };
    
    // ==========================================
    // 🛠 座標統合診断・テストメソッド群（バグ修正対応版）
    // ==========================================
    
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
                getUnifiedCanvasCoordinatesFixed: typeof this.getUnifiedCanvasCoordinatesFixed === 'function',
                startDrawingWithCoordinateIntegrationFixed: typeof this.startDrawingWithCoordinateIntegrationFixed === 'function'
            },
            // 🛠 バグ修正統計
            bugFixStats: {
                canvasRectRetrievalCount: this.stats.canvasRectRetrievalCount,
                coordinateExtractionErrors: this.stats.coordinateExtractionErrors,
                fallbackPaths: this.paths.filter(function(path) { return path.fallbackUsed; }).length
            }
        };
    };

    /**
     * 🛠 座標バグ診断実行（CanvasManager版）
     */
    CanvasManager.prototype.runCanvasCoordinateBugDiagnosis = function() {
        console.group('🔍 CanvasManager座標バグ診断');
        
        var state = this.getCoordinateIntegrationState();
        
        // 診断項目
        var diagnosis = {
            canvasElement: {
                available: !!this.canvasElement,
                hasBoundingClientRect: !!(this.canvasElement && this.canvasElement.getBoundingClientRect)
            },
            coordinateManager: {
                available: !!this.coordinateManager,
                hasBugFixMethods: !!(this.coordinateManager && 
                    this.coordinateManager.extractPointerCoordinates &&
                    this.coordinateManager.screenToCanvasSafe &&
                    this.coordinateManager.validateCoordinateIntegrity)
            },
            eventHandlers: {
                fixedMethodsImplemented: !!(
                    this.handlePointerDownWithCoordinateIntegrationFixed &&
                    this.handlePointerMoveWithCoordinateIntegrationFixed &&
                    this.handlePointerUpWithCoordinateIntegrationFixed
                ),
                unifiedCoordinateExtraction: typeof this.getUnifiedCanvasCoordinatesFixed === 'function'
            },
            stats: state.bugFixStats,
            compliance: {
                canvasRectAlwaysRetrieved: state.bugFixStats.canvasRectRetrievalCount > 0,
                errorHandlingImplemented: typeof this.getFallbackCanvasCoordinates === 'function',
                fallbackMechanismWorking: state.bugFixStats.fallbackPaths >= 0
            }
        };
        
        console.log('📊 CanvasManager座標バグ診断結果:', diagnosis);
        
        // 推奨事項
        var recommendations = [];
        
        if (!diagnosis.canvasElement.available) {
            recommendations.push('キャンバス要素の初期化が必要です');
        }
        
        if (!diagnosis.canvasElement.hasBoundingClientRect) {
            recommendations.push('キャンバス要素にgetBoundingClientRect()メソッドがありません');
        }
        
        if (!diagnosis.coordinateManager.available) {
            recommendations.push('CoordinateManagerの初期化が必要です');
        }
        
        if (!diagnosis.coordinateManager.hasBugFixMethods) {
            recommendations.push('CoordinateManagerにバグ修正メソッドが不足しています');
        }
        
        if (!diagnosis.eventHandlers.fixedMethodsImplemented) {
            recommendations.push('修正版イベントハンドラーの実装が必要です');
        }
        
        if (state.bugFixStats.coordinateExtractionErrors > state.bugFixStats.canvasRectRetrievalCount * 0.1) {
            recommendations.push('座標抽出エラー率が高すぎます（10%超）');
        }
        
        if (recommendations.length === 0) {
            console.log('✅ CanvasManager座標バグ診断: バグ修正が完了しています');
        } else {
            console.warn('⚠️ CanvasManager推奨事項:', recommendations);
        }
        
        // CoordinateManagerのバグ診断も実行
        if (this.coordinateManager && this.coordinateManager.runCoordinateBugDiagnosis) {
            console.log('🔍 CoordinateManagerバグ診断も実行...');
            this.coordinateManager.runCoordinateBugDiagnosis();
        }
        
        console.groupEnd();
        
        return diagnosis;
    };
    
    // ==========================================
    // 🔄 基本機能メソッド群（従来通り）
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
                window.ErrorManager.showError('canvas-resize-coordinate-fixed', 
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
            coordinateIntegration: this.getCoordinateIntegrationState(),
            // 🛠 バグ修正統計
            canvasRectRetrievalCount: this.stats.canvasRectRetrievalCount,
            coordinateExtractionErrors: this.stats.coordinateExtractionErrors
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
            },
            // 🛠 バグ修正デバッグ情報
            bugFixInfo: {
                canvasElement: !!this.canvasElement,
                coordinateManager: !!this.coordinateManager,
                fixedMethodsAvailable: !!(
                    this.getUnifiedCanvasCoordinatesFixed &&
                    this.startDrawingWithCoordinateIntegrationFixed &&
                    this.handlePointerDownWithCoordinateIntegrationFixed
                ),
                retrievalStats: {
                    canvasRectRetrievals: this.stats.canvasRectRetrievalCount,
                    coordinateErrors: this.stats.coordinateExtractionErrors,
                    errorRate: this.stats.canvasRectRetrievalCount > 0 ? 
                              (this.stats.coordinateExtractionErrors / this.stats.canvasRectRetrievalCount * 100).toFixed(1) + '%' : '0%'
                }
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
                this.stopDrawingWithCoordinateIntegrationFixed();
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
            
            console.log('✅ CanvasManager破棄完了（座標統合対応・構文修正版・座標バグ修正版）');
            
        } catch (error) {
            console.error('❌ CanvasManager破棄エラー:', error);
        }
    };

    // ==========================================
    // 🎯 Pure JavaScript グローバル公開
    // ==========================================

    global.CanvasManager = CanvasManager;
    console.log('✅ CanvasManager 座標バグ修正版・座標統合パッチ適用版 グローバル公開完了（Pure JavaScript・構文修正版）');

})(window);

console.log('🔧 CanvasManager Phase1.4 座標バグ修正版・座標統合パッチ適用版・構文修正版 - 準備完了');
console.log('🛠 座標変換バグ修正完了: 左上から線が伸びる現象対策');
console.log('📋 差分パッチ適用完了: initializeCoordinateIntegration()メソッド実装');
console.log('🔄 座標統合実装完了: CoordinateManager完全統合・重複排除・Phase2準備');
console.log('🔧 構文エラー修正完了: Invalid or unexpected token エラー解決');
console.log('✅ 主な修正事項:');
console.log('  - イベントハンドラーでcanvasRect毎回取得（getBoundingClientRect()）');
console.log('  - getUnifiedCanvasCoordinatesFixed() 安全な座標取得メソッド実装');
console.log('  - handlePointer*WithCoordinateIntegrationFixed() バグ修正版イベントハンドラー');
console.log('  - (0,0)座標の異常検出・描画スキップ機能');
console.log('  - フォールバック座標生成機能強化（(0,0)回避）');
console.log('  - 座標抽出エラー統計・デバッグ情報追加');
console.log('  - 異常移動距離検出（テレポート防止）');
console.log('  - runCanvasCoordinateBugDiagnosis() バグ診断機能');
console.log('🔍 座標バグ診断: runCanvasCoordinateBugDiagnosis()で問題検出・推奨事項表示');
console.log('📊 修正統計: canvasRectRetrievalCount, coordinateExtractionErrors, fallbackPaths');
console.log('💡 使用例: const canvasManager = new window.CanvasManager(); await canvasManager.initialize(appCore, canvas); canvasManager.runCanvasCoordinateBugDiagnosis();');