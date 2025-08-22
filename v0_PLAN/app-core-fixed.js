/**
 * 🎨 AppCoreシステム（分割最適化版・座標統合修正版・CanvasManager統合完全修正版・初期化修正版）
 * 🎯 AI_WORK_SCOPE: PixiJSアプリケーション基盤・システム統合・初期化制御
 * 🎯 DEPENDENCIES: 統一システム4種、BoundaryManager、CoordinateManager、CanvasManager
 * 🎯 SPLIT_RESULT: 650行 → 350行（46%削減）
 * 🔧 EMERGENCY_FIX: Manager初期化メソッド統一・エラーハンドリング強化・CanvasManager統合
 * 🔄 COORDINATE_INTEGRATION: CoordinateManager統合・座標統合Phase1.4・CanvasManager完全対応
 * 🔧 INITIALIZATION_FIX: 初期化順序修正版・エラー処理強化版・canvasElement依存関係修正
 */

(function(global) {
    'use strict';

    function AppCore() {
        this.validateUnifiedSystems();
        this.initializeConfig();
        
        // 基本プロパティ
        this.app = null;
        this.drawingContainer = null;
        this.uiContainer = null;
        
        // 分離された管理システム
        this.boundaryManager = null;
        this.coordinateManager = null;
        this.toolManager = null;
        this.uiManager = null;
        this.canvasManager = null; // 🔧 CanvasManager追加
        
        // 状態管理
        this.isInitializing = false;
        this.initializationComplete = false;
        this.initializationFailed = false;
        
        console.log('🎨 AppCore インスタンス作成完了（座標統合版・CanvasManager対応・初期化修正版）');
    }
    
    /**
     * 統一システム依存性確認（修正版）
     */
    AppCore.prototype.validateUnifiedSystems = function() {
        var required = ['ConfigManager', 'ErrorManager', 'StateManager', 'EventBus'];
        var missing = [];
        
        for (var i = 0; i < required.length; i++) {
            if (!window[required[i]]) {
                missing.push(required[i]);
            }
        }
        
        if (missing.length > 0) {
            throw new Error('AppCore: 統一システム依存性エラー: ' + missing.join(', '));
        }
    };
    
    /**
     * 設定初期化（修正版）
     */
    AppCore.prototype.initializeConfig = function() {
        try {
            var canvasConfig = window.ConfigManager.getCanvasConfig();
            this.canvasWidth = canvasConfig.width;
            this.canvasHeight = canvasConfig.height;
            this.backgroundColor = canvasConfig.backgroundColor;
            
            // 境界描画設定追加
            this.boundaryConfig = window.ConfigManager.get('canvas.boundary') || {
                enabled: true,
                margin: 20,
                trackingEnabled: true
            };
            
        } catch (error) {
            console.warn('⚠️ 設定初期化で問題発生、フォールバック使用:', error.message);
            
            // フォールバック設定
            this.canvasWidth = 400;
            this.canvasHeight = 400;
            this.backgroundColor = 0xf0e0d6;
            this.boundaryConfig = {
                enabled: true,
                margin: 20,
                trackingEnabled: true
            };
        }
    };
    
    /**
     * アプリケーション初期化（分割最適化版・座標統合修正版・CanvasManager完全対応・初期化修正版）
     */
    AppCore.prototype.initialize = function() {
        var self = this;
        console.log('🚀 AppCore 初期化開始（座標統合版・CanvasManager完全対応・初期化修正版）...');
        this.isInitializing = true;
        
        return new Promise(function(resolve, reject) {
            self.initializeBasicSystems()
                .then(function() {
                    return self.initializeManagers();
                })
                .then(function() {
                    return self.initializeApplication();
                })
                .then(function() {
                    // 完了処理
                    self.completeInitialization();
                    resolve(self);
                })
                .catch(function(error) {
                    self.handleInitializationError(error).then(function() {
                        resolve(self); // エラーハンドリング後も継続
                    });
                });
        });
    };
    
    /**
     * 基盤システム初期化（座標統合修正版・初期化修正版）
     */
    AppCore.prototype.initializeBasicSystems = function() {
        var self = this;
        console.log('🔧 基盤システム初期化中（初期化修正版）...');
        
        return new Promise(function(resolve, reject) {
            // DOM確認
            self.verifyDOMElements()
                .then(function() {
                    // 🔄 COORDINATE_INTEGRATION: 座標管理システム初期化（エラーハンドリング強化・初期化修正版）
                    if (window.CoordinateManager) {
                        try {
                            self.coordinateManager = new window.CoordinateManager();
                            console.log('✅ CoordinateManager初期化完了');
                            
                            // 座標統合設定確認
                            var integrationStatus = self.coordinateManager.getIntegrationStatus();
                            console.log('🔄 AppCore座標統合設定:', integrationStatus);
                            
                        } catch (error) {
                            console.warn('⚠️ CoordinateManager初期化失敗（オプション）:', error.message);
                            self.coordinateManager = null;
                        }
                    } else {
                        console.warn('⚠️ CoordinateManager利用不可（オプション）');
                    }
                    
                    // PixiJSアプリケーション初期化
                    return self.initializePixiApp();
                })
                .then(function() {
                    // コンテナ初期化
                    self.initializeContainers();
                    
                    console.log('✅ 基盤システム初期化完了（初期化修正版）');
                    resolve();
                })
                .catch(reject);
        });
    };
    
    /**
     * 管理システム初期化（座標統合修正版・CanvasManager完全対応・初期化修正版・canvasElement依存関係修正）
     */
    AppCore.prototype.initializeManagers = function() {
        var self = this;
        console.log('🔧 管理システム初期化中（CanvasManager完全対応・初期化修正版・canvasElement修正）...');
        
        return new Promise(function(resolve, reject) {
            // 🔧 CanvasManager初期化（座標統合対応・最優先・初期化修正版・canvasElement修正）
            if (window.CanvasManager) {
                self.canvasManager = new window.CanvasManager();
                // 🔄 COORDINATE_INTEGRATION: 適切な引数で初期化・canvasElement修正
                self.canvasManager.initialize(self, self.app && self.app.view)
                    .then(function() {
                        console.log('✅ CanvasManager初期化完了（座標統合版・初期化修正版・canvasElement修正）');
                        return self.initializeToolManager();
                    })
                    .then(function() {
                        return self.initializeBoundaryManager();
                    })
                    .then(function() {
                        return self.initializeUIManager();
                    })
                    .then(function() {
                        console.log('✅ 管理システム初期化完了（座標統合版・CanvasManager完全対応・初期化修正版・canvasElement修正）');
                        resolve();
                    })
                    .catch(function(error) {
                        console.warn('⚠️ CanvasManager初期化失敗:', error.message);
                        self.canvasManager = null;
                        
                        // CanvasManagerなしで他のManagerを初期化
                        self.initializeToolManager()
                            .then(function() {
                                return self.initializeBoundaryManager();
                            })
                            .then(function() {
                                return self.initializeUIManager();
                            })
                            .then(resolve)
                            .catch(reject);
                    });
            } else {
                console.warn('⚠️ CanvasManager利用不可');
                
                // CanvasManagerなしで他のManagerを初期化
                self.initializeToolManager()
                    .then(function() {
                        return self.initializeBoundaryManager();
                    })
                    .then(function() {
                        return self.initializeUIManager();
                    })
                    .then(resolve)
                    .catch(reject);
            }
        });
    };
    
    /**
     * ToolManager初期化（初期化修正版）
     */
    AppCore.prototype.initializeToolManager = function() {
        var self = this;
        
        return new Promise(function(resolve, reject) {
            if (window.ToolManager) {
                try {
                    self.toolManager = new window.ToolManager({ appCore: self });
                    // 🔄 COORDINATE_INTEGRATION: initialize()を先に呼び、その後座標統合初期化
                    self.toolManager.initialize()
                        .then(function() {
                            // CoordinateManager統合初期化
                            if (self.coordinateManager && 
                                typeof self.toolManager.initializeCoordinateManagerIntegration === 'function') {
                                self.toolManager.initializeCoordinateManagerIntegration(self.coordinateManager);
                                console.log('✅ ToolManager: CoordinateManager統合完了（初期化修正版）');
                            } else {
                                console.warn('⚠️ ToolManager: CoordinateManager統合をスキップ（CoordinateManagerまたはメソッドが見つかりません）');
                            }
                            resolve();
                        })
                        .catch(function(error) {
                            console.warn('⚠️ ToolManager初期化失敗（オプション）:', error.message);
                            self.toolManager = null;
                            resolve(); // エラーでも継続
                        });
                } catch (error) {
                    console.warn('⚠️ ToolManager初期化失敗（オプション）:', error.message);
                    self.toolManager = null;
                    resolve(); // エラーでも継続
                }
            } else {
                console.warn('⚠️ ToolManager利用不可（オプション）');
                resolve();
            }
        });
    };
    
    /**
     * BoundaryManager初期化（初期化修正版・canvasElement依存関係修正）
     */
    AppCore.prototype.initializeBoundaryManager = function() {
        var self = this;
        
        return new Promise(function(resolve, reject) {
            if (window.BoundaryManager) {
                try {
                    self.boundaryManager = new window.BoundaryManager();
                    
                    // 🔧 canvasElement依存関係修正: app.viewまたはcanvasManager.canvasElementを使用
                    var canvasElement = null;
                    if (self.canvasManager && self.canvasManager.canvasElement) {
                        canvasElement = self.canvasManager.canvasElement;
                        console.log('🎨 BoundaryManager: CanvasManagerからcanvasElement取得');
                    } else if (self.app && self.app.view) {
                        canvasElement = self.app.view;
                        console.log('🎨 BoundaryManager: PixiJSからcanvasElement取得');
                    }
                    
                    // 🔄 COORDINATE_INTEGRATION: CoordinateManagerを渡してBoundaryManager初期化
                    if (self.coordinateManager) {
                        self.boundaryManager.initialize(canvasElement, self.coordinateManager)
                            .then(function() {
                                console.log('✅ BoundaryManager初期化完了（座標統合版・初期化修正版・canvasElement修正）');
                                resolve();
                            })
                            .catch(function(error) {
                                console.warn('⚠️ BoundaryManager初期化失敗（オプション）:', error.message);
                                self.boundaryManager = null;
                                resolve(); // エラーでも継続
                            });
                    } else {
                        // CoordinateManagerなしでBoundaryManager初期化
                        self.boundaryManager.initialize(canvasElement)
                            .then(function() {
                                console.warn('⚠️ BoundaryManager: CoordinateManager未提供 - 基本機能のみ提供');
                                resolve();
                            })
                            .catch(function(error) {
                                console.warn('⚠️ BoundaryManager初期化失敗（オプション）:', error.message);
                                self.boundaryManager = null;
                                resolve(); // エラーでも継続
                            });
                    }
                } catch (error) {
                    console.warn('⚠️ BoundaryManager初期化失敗（オプション）:', error.message);
                    self.boundaryManager = null;
                    resolve(); // エラーでも継続
                }
            } else {
                console.warn('⚠️ BoundaryManager利用不可（オプション）');
                resolve();
            }
        });
    };
    
    /**
     * UIManager初期化（初期化修正版）
     */
    AppCore.prototype.initializeUIManager = function() {
        var self = this;
        
        return new Promise(function(resolve, reject) {
            if (window.UIManager) {
                try {
                    self.uiManager = new window.UIManager(self);
                    self.uiManager.init() // ← UIManagerは init() メソッド（initialize()ではない）
                        .then(function() {
                            console.log('✅ UIManager初期化完了（初期化修正版）');
                            resolve();
                        })
                        .catch(function(error) {
                            console.warn('⚠️ UIManager初期化失敗（オプション）:', error.message);
                            self.uiManager = null;
                            resolve(); // エラーでも継続
                        });
                } catch (error) {
                    console.warn('⚠️ UIManager初期化失敗（オプション）:', error.message);
                    self.uiManager = null;
                    resolve(); // エラーでも継続
                }
            } else {
                console.warn('⚠️ UIManager利用不可（オプション）');
                resolve();
            }
        });
    };
    
    /**
     * アプリケーション初期化（修正版）
     */
    AppCore.prototype.initializeApplication = function() {
        var self = this;
        console.log('🔧 アプリケーション初期化中...');
        
        return new Promise(function(resolve, reject) {
            try {
                // イベントリスナー設定
                self.setupEventListeners();
                
                // PixiJS境界システム統合
                self.initializePixiBoundarySystem();
                
                // 初期化検証
                self.verifyInitialization();
                
                console.log('✅ アプリケーション初期化完了');
                resolve();
                
            } catch (error) {
                reject(error);
            }
        });
    };
    
    /**
     * DOM要素確認（修正版）
     */
    AppCore.prototype.verifyDOMElements = function() {
        return new Promise(function(resolve, reject) {
            var canvasElement = document.getElementById('drawing-canvas');
            if (!canvasElement) {
                reject(new Error('drawing-canvas 要素が見つかりません'));
                return;
            }
            
            // キャンバス要素クリア
            while (canvasElement.firstChild) {
                canvasElement.removeChild(canvasElement.firstChild);
            }
            
            console.log('✅ DOM要素確認完了');
            resolve();
        });
    };
    
    /**
     * PixiJSアプリケーション初期化（修正版）
     */
    AppCore.prototype.initializePixiApp = function() {
        var self = this;
        return new Promise(function(resolve, reject) {
            try {
                var canvasConfig = window.ConfigManager.getCanvasConfig();
                var pixiConfig = window.ConfigManager.getPixiConfig();
                
                self.app = new PIXI.Application({
                    width: canvasConfig.width,
                    height: canvasConfig.height,
                    backgroundColor: canvasConfig.backgroundColor,
                    antialias: pixiConfig.antialias,
                    resolution: pixiConfig.resolution || window.devicePixelRatio || 1
                });
                
                var canvasElement = document.getElementById('drawing-canvas');
                canvasElement.appendChild(self.app.view);
                
                // キャンバス要素の基本設定
                self.app.view.style.cursor = pixiConfig.cursor || 'crosshair';
                self.app.view.style.touchAction = 'none'; // タッチスクロール防止
                
                console.log('✅ PixiJSアプリケーション初期化完了');
                resolve();
                
            } catch (error) {
                console.error('❌ PixiJSアプリケーション初期化失敗:', error);
                reject(error);
            }
        });
    };
    
    /**
     * コンテナ初期化（修正版）
     */
    AppCore.prototype.initializeContainers = function() {
        try {
            // 描画レイヤー
            this.drawingContainer = new PIXI.Container();
            this.drawingContainer.name = 'drawing-layer';
            this.app.stage.addChild(this.drawingContainer);
            
            // UIレイヤー
            this.uiContainer = new PIXI.Container();
            this.uiContainer.name = 'ui-layer';
            this.app.stage.addChild(this.uiContainer);
            
            // ステージのインタラクティブ設定
            this.app.stage.interactive = true;
            this.app.stage.hitArea = new PIXI.Rectangle(0, 0, this.canvasWidth, this.canvasHeight);
            
            console.log('✅ コンテナ初期化完了');
            
        } catch (error) {
            console.error('❌ コンテナ初期化失敗:', error);
            throw error;
        }
    };
    
    /**
     * イベントリスナー設定（修正版・CanvasManager統合対応・初期化修正版）
     */
    AppCore.prototype.setupEventListeners = function() {
        var self = this;
        try {
            // 🔧 CanvasManager統合: 描画イベントはCanvasManagerに委譲（初期化修正版）
            if (this.canvasManager && this.canvasManager.initialized) {
                console.log('🎨 描画イベントはCanvasManagerに委譲（初期化確認済み）');
                // CanvasManagerが既にsetupEventHandlers()で設定済み
            } else {
                // フォールバック: AppCoreで直接処理
                this.app.stage.on('pointerdown', function(event) {
                    self.handlePointerDown(event);
                });
                this.app.stage.on('pointermove', function(event) {
                    self.handlePointerMove(event);
                });
                this.app.stage.on('pointerup', function(event) {
                    self.handlePointerUp(event);
                });
                this.app.stage.on('pointerupoutside', function(event) {
                    self.handlePointerUp(event);
                });
                console.log('🔧 フォールバック: AppCore直接イベント処理（CanvasManager未初期化）');
            }
            
            // 境界越えイベント（BoundaryManager統合）
            if (window.EventBus && typeof window.EventBus.on === 'function') {
                window.EventBus.on('boundary.cross.in', function(data) {
                    self.handleBoundaryCrossIn(data);
                });
            }
            
            // ウィンドウイベント
            window.addEventListener('resize', function() {
                self.handleResize();
            });
            
            // ツールイベント
            if (window.EventBus && typeof window.EventBus.on === 'function') {
                window.EventBus.on('tool.changed', function(data) {
                    self.handleToolChanged(data);
                });
            }
            
            console.log('✅ イベントリスナー設定完了（CanvasManager統合対応・初期化修正版）');
            
        } catch (error) {
            console.warn('⚠️ イベントリスナー設定で問題発生:', error.message);
        }
    };
    
    /**
     * PixiJS境界システム統合初期化（座標統合修正版）
     */
    AppCore.prototype.initializePixiBoundarySystem = function() {
        if (!this.app || !this.boundaryManager) {
            console.warn('⚠️ PixiJS境界システム統合スキップ（依存関係不足）');
            return;
        }
        
        var self = this;
        try {
            console.log('🎯 PixiJS境界システム統合初期化中...');
            
            // 拡張ヒットエリア設定（座標統合対応）
            var margin = this.boundaryManager.boundaryMargin || 20;
            
            // 🔄 COORDINATE_INTEGRATION: CoordinateManager経由でのマージン処理
            var adjustedMargin = margin;
            if (this.coordinateManager) {
                adjustedMargin = this.coordinateManager.applyPrecision(margin);
            }
            
            this.app.stage.hitArea = new PIXI.Rectangle(
                -adjustedMargin,
                -adjustedMargin,
                this.canvasWidth + adjustedMargin * 2,
                this.canvasHeight + adjustedMargin * 2
            );
            
            // インタラクティブ強化
            this.app.stage.interactive = true;
            this.app.stage.interactiveChildren = true;
            
            // 境界統合イベント設定
            this.setupPixiBoundaryEvents();
            
            console.log('✅ PixiJS境界システム統合完了（座標統合版）');
            
        } catch (error) {
            console.warn('⚠️ PixiJS境界システム統合で問題発生:', error.message);
        }
    };
    
    /**
     * PixiJS境界イベント設定（修正版）
     */
    AppCore.prototype.setupPixiBoundaryEvents = function() {
        var self = this;
        try {
            // 境界越えイベント統合
            if (window.EventBus && typeof window.EventBus.on === 'function') {
                window.EventBus.on('boundary.cross.in', function(data) {
                    self.handlePixiBoundaryCross(data);
                });
            }
            
            // PixiJSネイティブイベント拡張
            this.app.stage.on('pointerenter', function(event) {
                console.log('🎯 PixiJS ポインター エンター');
                if (window.EventBus && typeof window.EventBus.emit === 'function') {
                    window.EventBus.emit('pixi.pointer.enter', { event: event });
                }
            });
            
            this.app.stage.on('pointerleave', function(event) {
                console.log('🎯 PixiJS ポインター リーブ');
                if (window.EventBus && typeof window.EventBus.emit === 'function') {
                    window.EventBus.emit('pixi.pointer.leave', { event: event });
                }
            });
            
        } catch (error) {
            console.warn('⚠️ PixiJS境界イベント設定で問題発生:', error.message);
        }
    };
    
    /**
     * PixiJS境界越え処理（座標統合修正版）
     */
    AppCore.prototype.handlePixiBoundaryCross = function(data) {
        if (!this.coordinateManager) return;
        
        try {
            // 🔄 COORDINATE_INTEGRATION: CoordinateManager経由での座標処理
            var coords;
            
            if (this.coordinateManager) {
                coords = this.coordinateManager.extractPointerCoordinates(
                    event, 
                    this.app.view.getBoundingClientRect(), 
                    this.app
                );
            } else {
                // フォールバック処理
                var rect = this.app.view.getBoundingClientRect();
                coords = {
                    canvas: {
                        x: event.clientX - rect.left,
                        y: event.clientY - rect.top
                    },
                    pressure: event.pressure || 0.5
                };
                console.warn('⚠️ CoordinateManager未利用 - フォールバック座標処理');
            }
            
            // ToolManagerの描画開始メソッドを呼び出し
            this.toolManager.startDrawing(coords.canvas.x, coords.canvas.y, coords.pressure);
            
            if (window.EventBus && typeof window.EventBus.emit === 'function') {
                window.EventBus.emit('drawing.started', {
                    position: coords.canvas,
                    pressure: coords.pressure,
                    tool: this.toolManager.getCurrentTool() || 'unknown',
                    coordinateManagerUsed: !!this.coordinateManager
                });
            }
            
        } catch (error) {
            if (window.ErrorManager && typeof window.ErrorManager.showError === 'function') {
                window.ErrorManager.showError('warning', 
                    'ポインターダウンエラー: ' + error.message, 
                    { additionalInfo: 'ポインター処理', event: event.type }
                );
            }
        }
    };
    
    /**
     * ポインター移動ハンドラー（座標統合修正版・CanvasManager委譲）
     */
    AppCore.prototype.handlePointerMove = function(event) {
        // 🔧 CanvasManager統合: 描画処理はCanvasManagerに委譲
        if (this.canvasManager) {
            // CanvasManagerが直接処理するため、座標表示のみ更新
            try {
                var coords;
                if (this.coordinateManager) {
                    coords = this.coordinateManager.extractPointerCoordinates(
                        event, 
                        this.app.view.getBoundingClientRect()
                    );
                } else {
                    var rect = this.app.view.getBoundingClientRect();
                    coords = {
                        canvas: {
                            x: event.clientX - rect.left,
                            y: event.clientY - rect.top
                        }
                    };
                }
                this.updateCoordinateDisplay(coords.canvas);
            } catch (error) {
                console.warn('⚠️ 座標表示更新エラー:', error.message);
            }
            return;
        }
        
        // フォールバック: 直接処理
        try {
            // 🔄 COORDINATE_INTEGRATION: CoordinateManager経由での座標処理
            var coords;
            
            if (this.coordinateManager) {
                coords = this.coordinateManager.extractPointerCoordinates(
                    event, 
                    this.app.view.getBoundingClientRect()
                );
            } else {
                // フォールバック処理
                var rect = this.app.view.getBoundingClientRect();
                coords = {
                    canvas: {
                        x: event.clientX - rect.left,
                        y: event.clientY - rect.top
                    },
                    pressure: event.pressure || 0.5
                };
            }
            
            // 座標表示更新
            this.updateCoordinateDisplay(coords.canvas);
            
            // ツール描画継続
            if (this.toolManager) {
                this.toolManager.continueDrawing(coords.canvas.x, coords.canvas.y, coords.pressure);
            }
            
        } catch (error) {
            // ポインター移動エラーは頻繁に発生する可能性があるため、警告レベル
            console.warn('⚠️ ポインター移動処理エラー:', error.message);
        }
    };
    
    /**
     * ポインターアップハンドラー（修正版・CanvasManager委譲）
     */
    AppCore.prototype.handlePointerUp = function(event) {
        // 🔧 CanvasManager統合: 描画処理はCanvasManagerに委譲
        if (this.canvasManager) {
            // CanvasManagerが直接処理するため、ここでは何もしない
            return;
        }
        
        // フォールバック: ToolManager直接処理
        if (!this.toolManager) return;
        
        try {
            this.toolManager.stopDrawing();
            
            if (window.EventBus && typeof window.EventBus.emit === 'function') {
                window.EventBus.emit('drawing.ended', {
                    timestamp: Date.now()
                });
            }
            
        } catch (error) {
            if (window.ErrorManager && typeof window.ErrorManager.showError === 'function') {
                window.ErrorManager.showError('warning', 
                    'ポインターアップエラー: ' + error.message, 
                    { additionalInfo: 'ポインター処理', event: event.type }
                );
            }
        }
    };
    
    /**
     * 座標表示更新（修正版）
     */
    AppCore.prototype.updateCoordinateDisplay = function(canvasCoords) {
        try {
            var coordinatesElement = document.getElementById('coordinates');
            if (coordinatesElement) {
                coordinatesElement.textContent = 'x: ' + Math.round(canvasCoords.x) + ', y: ' + Math.round(canvasCoords.y);
            }
        } catch (error) {
            // 座標表示エラーは致命的ではないため、ログのみ
            console.warn('⚠️ 座標表示更新エラー:', error.message);
        }
    };
    
    /**
     * リサイズハンドラー（座標統合修正版・CanvasManager委譲）
     */
    AppCore.prototype.handleResize = function() {
        if (!this.app) return;
        
        console.log('🔄 ウィンドウリサイズ検出');
        
        // 🔧 CanvasManager統合: リサイズ処理はCanvasManagerに委譲
        if (this.canvasManager && typeof this.canvasManager.resize === 'function') {
            this.canvasManager.resize(this.canvasWidth, this.canvasHeight);
        }
        
        // 🔄 COORDINATE_INTEGRATION: CoordinateManagerにリサイズ通知
        if (this.coordinateManager && typeof this.coordinateManager.updateCanvasSize === 'function') {
            this.coordinateManager.updateCanvasSize(this.canvasWidth, this.canvasHeight);
        }
        
        if (window.EventBus && typeof window.EventBus.emit === 'function') {
            window.EventBus.emit('window.resized', {
                width: this.canvasWidth,
                height: this.canvasHeight,
                coordinateManagerUpdated: !!this.coordinateManager,
                canvasManagerUpdated: !!this.canvasManager,
                timestamp: Date.now()
            });
        }
    };
    
    /**
     * ツール変更ハンドラー（修正版）
     */
    AppCore.prototype.handleToolChanged = function(data) {
        console.log('🔧 ツール変更: ' + (data.previousTool || '不明') + ' → ' + (data.tool || '不明'));
    };
    
    /**
     * 初期化完了処理（座標統合修正版・CanvasManager対応）
     */
    AppCore.prototype.completeInitialization = function() {
        this.isInitializing = false;
        this.initializationComplete = true;
        
        if (window.EventBus && typeof window.EventBus.emit === 'function') {
            window.EventBus.emit('appCore.initialized', {
                success: true,
                components: this.getInitializationStats(),
                coordinateManagerIntegrated: !!this.coordinateManager,
                canvasManagerIntegrated: !!this.canvasManager,
                timestamp: Date.now()
            });
        }
        
        console.log('✅ AppCore 初期化完了（座標統合版・CanvasManager完全対応・初期化修正版・canvasElement修正）');
        
        // 🆕 座標統合診断の自動実行
        if (typeof window.checkCoordinateIntegration === 'function') {
            setTimeout(function() {
                console.log('🔍 座標統合自動診断実行中...');
                window.checkCoordinateIntegration();
            }, 1000);
        }
    };
    
    /**
     * 初期化エラー処理（修正版）
     */
    AppCore.prototype.handleInitializationError = function(error) {
        var self = this;
        console.error('💀 AppCore初期化エラー:', error);
        
        this.initializationFailed = true;
        this.isInitializing = false;
        
        return new Promise(function(resolve, reject) {
            if (window.ErrorManager && typeof window.ErrorManager.showError === 'function') {
                window.ErrorManager.showError('error', error.message, {
                    additionalInfo: 'AppCore初期化失敗',
                    showReload: true
                });
            }
            
            // フォールバックモード試行
            self.initializeFallbackMode(error)
                .then(resolve)
                .catch(resolve); // フォールバック失敗でも継続
        });
    };
    
    /**
     * 初期化検証（座標統合修正版・CanvasManager対応）
     */
    AppCore.prototype.verifyInitialization = function() {
        var verification = {
            pixiApp: !!this.app,
            drawingContainer: !!this.drawingContainer,
            boundaryManager: !!this.boundaryManager,
            coordinateManager: !!this.coordinateManager,
            toolManager: !!this.toolManager,
            uiManager: !!this.uiManager,
            canvasManager: !!this.canvasManager // 🔧 CanvasManager検証追加
        };
        
        var passCount = 0;
        var totalCount = 0;
        var key;
        
        for (key in verification) {
            if (verification.hasOwnProperty(key)) {
                totalCount++;
                if (verification[key]) {
                    passCount++;
                }
            }
        }
        
        console.log('✅ 初期化検証: ' + passCount + '/' + totalCount + ' (' + (passCount/totalCount*100).toFixed(1) + '%)');
        
        // 座標統合確認
        if (this.coordinateManager) {
            var integrationStatus = this.coordinateManager.getIntegrationStatus();
            console.log('🔄 座標統合状態:', {
                enabled: integrationStatus.managerCentralization,
                duplicateElimination: integrationStatus.duplicateElimination,
                performanceOptimized: integrationStatus.performanceOptimized
            });
        }
        
        // CanvasManager統合確認
        if (this.canvasManager) {
            var canvasIntegrationState = this.canvasManager.getCoordinateIntegrationState();
            console.log('🎨 CanvasManager座標統合状態:', {
                coordinateManagerAvailable: canvasIntegrationState.coordinateManagerAvailable,
                integrationEnabled: canvasIntegrationState.integrationEnabled,
                duplicateElimination: canvasIntegrationState.duplicateElimination
            });
        }
        
        if (passCount < 3) { // 最低限PixiJS, DrawingContainer, 1つのManagerがあれば動作可能
            var failed = [];
            for (key in verification) {
                if (verification.hasOwnProperty(key) && !verification[key]) {
                    failed.push(key);
                }
            }
            
            if (window.ErrorManager && typeof window.ErrorManager.showError === 'function') {
                window.ErrorManager.showError('warning', '初期化未完了: ' + failed.join(', '));
            }
        }
    };
    
    /**
     * 初期化統計取得（座標統合修正版・CanvasManager対応）
     */
    AppCore.prototype.getInitializationStats = function() {
        var stats = {
            pixiApp: !!this.app,
            drawingContainer: !!this.drawingContainer,
            boundaryManager: !!this.boundaryManager,
            coordinateManager: !!this.coordinateManager,
            toolManager: !!this.toolManager,
            uiManager: !!this.uiManager,
            canvasManager: !!this.canvasManager, // 🔧 CanvasManager統計追加
            initializationComplete: this.initializationComplete,
            initializationFailed: this.initializationFailed
        };
        
        // 座標統合状態を追加
        if (this.coordinateManager) {
            var integrationStatus = this.coordinateManager.getIntegrationStatus();
            stats.coordinateIntegration = {
                enabled: integrationStatus.managerCentralization,
                duplicateElimination: integrationStatus.duplicateElimination,
                performanceOptimized: integrationStatus.performanceOptimized
            };
        }
        
        // CanvasManager統合状態を追加
        if (this.canvasManager) {
            var canvasIntegrationState = this.canvasManager.getCoordinateIntegrationState();
            stats.canvasManagerIntegration = {
                coordinateManagerAvailable: canvasIntegrationState.coordinateManagerAvailable,
                integrationEnabled: canvasIntegrationState.integrationEnabled,
                duplicateElimination: canvasIntegrationState.duplicateElimination
            };
        }
        
        return stats;
    };
    
    /**
     * フォールバックモード初期化（修正版）
     */
    AppCore.prototype.initializeFallbackMode = function(originalError) {
        var self = this;
        console.log('🛡️ フォールバックモード初期化中...');
        
        return new Promise(function(resolve, reject) {
            try {
                // 最低限のPixiJSアプリケーション作成
                if (!self.app) {
                    var fallbackConfig = {
                        width: window.ConfigManager && window.ConfigManager.get('canvas.width') || 400,
                        height: window.ConfigManager && window.ConfigManager.get('canvas.height') || 400,
                        backgroundColor: window.ConfigManager && window.ConfigManager.get('canvas.backgroundColor') || 0xf0e0d6
                    };
                    
                    self.app = new PIXI.Application(fallbackConfig);
                    var canvasElement = document.getElementById('drawing-canvas');
                    if (canvasElement) {
                        canvasElement.appendChild(self.app.view);
                    }
                }
                
                // 最低限のコンテナ作成
                if (!self.drawingContainer) {
                    self.initializeContainers();
                }
                
                if (window.ErrorManager && typeof window.ErrorManager.showError === 'function') {
                    window.ErrorManager.showError('recovery', '基本描画機能は利用可能です', {
                        additionalInfo: 'フォールバックモードで動作中'
                    });
                }
                
                console.log('✅ フォールバックモード初期化完了');
                resolve();
                
            } catch (fallbackError) {
                console.error('💀 フォールバックモード初期化失敗:', fallbackError);
                if (window.ErrorManager && typeof window.ErrorManager.showCriticalError === 'function') {
                    window.ErrorManager.showCriticalError(originalError.message, {
                        additionalInfo: 'フォールバック失敗: ' + fallbackError.message
                    });
                }
                reject(fallbackError);
            }
        });
    };
    
    /**
     * キャンバスリサイズ（座標統合修正版・CanvasManager委譲）
     */
    AppCore.prototype.resize = function(newWidth, newHeight, centerContent) {
        centerContent = centerContent || false;
        
        if (!this.app) {
            console.warn('⚠️ PixiJSアプリが初期化されていません');
            return;
        }
        
        try {
            // 🔧 CanvasManager統合: リサイズ処理はCanvasManagerに委譲
            if (this.canvasManager && typeof this.canvasManager.resize === 'function') {
                var success = this.canvasManager.resize(newWidth, newHeight, centerContent);
                if (success) {
                    // AppCore内部サイズも更新
                    this.canvasWidth = newWidth;
                    this.canvasHeight = newHeight;
                    console.log('📐 キャンバスリサイズ（CanvasManager委譲）: ' + newWidth + 'x' + newHeight);
                }
                return success;
            }
            
            // フォールバック: 直接処理
            var oldWidth = this.canvasWidth;
            var oldHeight = this.canvasHeight;
            
            // ConfigManager経由での妥当性確認
            var canvasConfig = window.ConfigManager.getCanvasConfig();
            var validWidth = Math.max(canvasConfig.minWidth || 100, Math.min(canvasConfig.maxWidth || 2000, newWidth));
            var validHeight = Math.max(canvasConfig.minHeight || 100, Math.min(canvasConfig.maxHeight || 2000, newHeight));
            
            this.canvasWidth = validWidth;
            this.canvasHeight = validHeight;
            
            // 🔄 COORDINATE_INTEGRATION: 座標管理システム更新
            if (this.coordinateManager && typeof this.coordinateManager.updateCanvasSize === 'function') {
                this.coordinateManager.updateCanvasSize(validWidth, validHeight);
            }
            
            // アプリケーションリサイズ
            this.app.renderer.resize(validWidth, validHeight);
            this.app.stage.hitArea = new PIXI.Rectangle(0, 0, validWidth, validHeight);
            
            // 境界管理システム更新
            if (this.boundaryManager && typeof this.boundaryManager.updateCanvasSize === 'function') {
                this.boundaryManager.updateCanvasSize();
            }
            
            if (window.EventBus && typeof window.EventBus.emit === 'function') {
                window.EventBus.emit('canvas.resized', {
                    width: validWidth,
                    height: validHeight,
                    previousWidth: oldWidth,
                    previousHeight: oldHeight,
                    coordinateManagerUpdated: !!this.coordinateManager,
                    canvasManagerUsed: false,
                    timestamp: Date.now()
                });
            }
            
            console.log('📐 キャンバスリサイズ（座標統合版・フォールバック）: ' + validWidth + 'x' + validHeight);
            
        } catch (error) {
            if (window.ErrorManager && typeof window.ErrorManager.showError === 'function') {
                window.ErrorManager.showError('error', 
                    'キャンバスリサイズエラー: ' + error.message, 
                    { additionalInfo: 'キャンバスリサイズ', newWidth: newWidth, newHeight: newHeight }
                );
            }
        }
    };
    
    /**
     * 🆕 座標統合状態取得（外部アクセス用・CanvasManager対応）
     */
    AppCore.prototype.getCoordinateIntegrationState = function() {
        return {
            coordinateManagerAvailable: !!this.coordinateManager,
            boundaryManagerIntegrated: !!(this.boundaryManager && this.boundaryManager.coordinateManager),
            toolManagerIntegrated: !!(this.toolManager && this.toolManager.coordinateManager),
            canvasManagerIntegrated: !!(this.canvasManager && this.canvasManager.coordinateManager), // 🔧 CanvasManager統合状態追加
            coordinateManagerState: this.coordinateManager ? 
                (this.coordinateManager.getCoordinateState && this.coordinateManager.getCoordinateState()) : null,
            canvasManagerState: this.canvasManager ?
                this.canvasManager.getCoordinateIntegrationState() : null, // 🔧 CanvasManager状態追加
            appCoreState: this.getInitializationStats(),
            phase2Ready: !!(this.coordinateManager && 
                           this.boundaryManager && this.boundaryManager.coordinateManager && 
                           this.toolManager && this.toolManager.coordinateManager &&
                           this.canvasManager && this.canvasManager.coordinateManager) // 🔧 CanvasManager統合確認追加
        };
    };
    
    /**
     * システム破棄（座標統合修正版・CanvasManager対応）
     */
    AppCore.prototype.destroy = function() {
        try {
            // CanvasManager破棄
            if (this.canvasManager && typeof this.canvasManager.destroy === 'function') {
                this.canvasManager.destroy();
                this.canvasManager = null;
            }
            
            // 境界管理システム破棄
            if (this.boundaryManager && typeof this.boundaryManager.destroy === 'function') {
                this.boundaryManager.destroy();
                this.boundaryManager = null;
            }
            
            // ツールマネージャー破棄
            if (this.toolManager && typeof this.toolManager.destroy === 'function') {
                this.toolManager.destroy();
                this.toolManager = null;
            }
            
            // UIマネージャー破棄
            if (this.uiManager && typeof this.uiManager.destroy === 'function') {
                this.uiManager.destroy();
                this.uiManager = null;
            }
            
            // PixiJSアプリケーション破棄
            if (this.app) {
                this.app.destroy(true);
                this.app = null;
            }
            
            // プロパティクリア
            this.drawingContainer = null;
            this.uiContainer = null;
            this.coordinateManager = null; // 🔄 座標統合対応
            
            console.log('🎨 AppCore 破棄完了（座標統合版・CanvasManager完全対応・初期化修正版・canvasElement修正）');
            
        } catch (error) {
            if (window.ErrorManager && typeof window.ErrorManager.showError === 'function') {
                window.ErrorManager.showError('warning', 
                    'AppCore破棄エラー: ' + error.message,
                    { additionalInfo: 'AppCore破棄処理' }
                );
            }
        }
    };

    // グローバル登録
    global.AppCore = AppCore;
    console.log('🎨 AppCore グローバル登録完了（座標統合版・初期化メソッド統一・CanvasManager完全対応・初期化修正版・canvasElement修正）');

})(window);

console.log('🔄 AppCore Phase1.4 座標統合版・CanvasManager完全対応・初期化修正版・canvasElement修正 - 準備完了');
console.log('📋 座標統合実装完了: CoordinateManager統合・Manager連携・座標処理最適化');
console.log('🔧 Manager初期化統一: initialize()メソッド統一・CoordinateManager依存注入・初期化順序修正');
console.log('🎨 CanvasManager完全統合: 描画処理委譲・リサイズ処理委譲・統合状態確認・初期化確認強化');
console.log('🎯 境界システム統合: PixiJS境界システム・座標変換・イベント連携');
console.log('🔧 初期化修正完了: Manager初期化順序修正・エラーハンドリング強化・canvasElement依存関係修正');
console.log('✅ 主な修正事項:');
console.log('  - ES6構文をES5互換に変更（class → function、arrow function → function、const/let → var）');
console.log('  - Promise-based初期化チェーン実装');
console.log('  - BoundaryManager初期化時のcanvasElement依存関係修正');
console.log('  - CanvasManagerからcanvasElement取得、フォールバックでPixiJS app.view使用');
console.log('  - 初期化順序最適化: PixiJS → CanvasManager → 他Managers');
console.log('  - エラーハンドリング強化とフォールバック処理改善');
console.log('💡 使用例: const appCore = new window.AppCore(); await appCore.initialize();');INTEGRATION: PixiJS座標系変換
            var pixiCoords = this.coordinateManager.canvasToPixi(
                data.position.x, 
                data.position.y, 
                this.app
            );
            
            // アクティブツールに境界越え通知
            if (this.toolManager && this.toolManager.currentTool && 
                typeof this.toolManager.currentTool.handleBoundaryCrossIn === 'function') {
                this.toolManager.currentTool.handleBoundaryCrossIn(
                    pixiCoords.x, 
                    pixiCoords.y, 
                    {
                        pressure: data.pressure,
                        pointerId: data.pointerId,
                        originalEvent: data.originalEvent,
                        pointerType: data.pointerType
                    }
                );
            }
            
            console.log('🎯 PixiJS境界越え処理完了（座標統合）: (' + pixiCoords.x.toFixed(1) + ', ' + pixiCoords.y.toFixed(1) + ')');
            
        } catch (error) {
            if (window.ErrorManager && typeof window.ErrorManager.showError === 'function') {
                window.ErrorManager.showError('error', 
                    'PixiJS境界越え処理エラー: ' + error.message, 
                    { additionalInfo: 'PixiJS境界処理', data: data }
                );
            }
        }
    };
    
    /**
     * 境界越え描画開始処理（修正版・CanvasManager統合対応）
     */
    AppCore.prototype.handleBoundaryCrossIn = function(data) {
        // 🔧 CanvasManager統合: 描画処理はCanvasManagerに委譲
        if (this.canvasManager && typeof this.canvasManager.handleBoundaryCrossIn === 'function') {
            this.canvasManager.handleBoundaryCrossIn(data);
            return;
        }
        
        // フォールバック: ToolManager直接処理
        if (!this.toolManager) {
            console.warn('⚠️ ToolManager が利用できません');
            return;
        }
        
        try {
            var currentTool = this.toolManager.getCurrentTool();
            var currentToolInstance = this.toolManager.registeredTools.get(currentTool);
            
            if (currentToolInstance && typeof currentToolInstance.handleBoundaryCrossIn === 'function') {
                currentToolInstance.handleBoundaryCrossIn(
                    data.position.x, 
                    data.position.y, 
                    {
                        pressure: data.pressure,
                        pointerId: data.pointerId,
                        originalEvent: data.originalEvent,
                        pointerType: data.pointerType
                    }
                );
            }
            
            console.log('🎯 境界越え描画開始: (' + data.position.x.toFixed(1) + ', ' + data.position.y.toFixed(1) + ')');
            
        } catch (error) {
            if (window.ErrorManager && typeof window.ErrorManager.showError === 'function') {
                window.ErrorManager.showError('warning', 
                    '境界越え描画エラー: ' + error.message, 
                    { additionalInfo: '境界越え処理', data: data }
                );
            }
        }
    };
    
    /**
     * ポインターダウンハンドラー（座標統合修正版・CanvasManager委譲）
     */
    AppCore.prototype.handlePointerDown = function(event) {
        // 🔧 CanvasManager統合: 描画処理はCanvasManagerに委譲
        if (this.canvasManager) {
            // CanvasManagerが直接処理するため、ここでは何もしない
            return;
        }
        
        // フォールバック: 直接処理
        if (!this.toolManager) {
            console.warn('⚠️ ToolManager が利用できません');
            return;
        }
        
        try {
            // 🔄 COORDINATE_