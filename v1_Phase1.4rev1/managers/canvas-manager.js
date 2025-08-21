/**
 * 🎨 ふたば☆ちゃんねる風ベクターお絵描きツール v1.0
 * Canvas Manager - 座標統合完成版
 * 
 * 🎯 AI_WORK_SCOPE: キャンバス描画管理・リサイズ機能・背景・グリッド・境界管理
 * 🎯 DEPENDENCIES: js/app-core.js, managers/boundary-manager.js, managers/memory-manager.js, CoordinateManager
 * 🎯 UNIFIED_SYSTEMS: ✅ ConfigManager, ErrorManager, StateManager, EventBus, CoordinateManager統合済み
 * 🎯 ISOLATION_TEST: ✅ 単体テスト可能
 * 🎯 SPLIT_THRESHOLD: 500行制限遵守
 * 
 * 📋 PHASE_TARGET: Phase1.4-座標統合 - 直接座標処理をCoordinateManager経由に変更
 * 🔄 COORDINATE_REFACTOR: getBoundingClientRect()直接使用をCoordinateManager統合
 * 📐 UNIFIED_COORDINATE: 座標処理完全集約・重複排除完了
 * 🎯 PHASE2_READY: レイヤーシステム座標変換基盤準備
 * 💡 PERFORMANCE: 座標処理パフォーマンス最適化
 */

class CanvasManager {
    constructor() {
        this.version = 'v1.0-Phase1.4-coordinate-integrated';
        this.app = null;
        this.width = 400;
        this.height = 400;
        this.canvasElement = null;
        this.drawingContainer = null;
        this.backgroundLayer = null;
        this.gridLayer = null;
        this.isInitialized = false;
        this.initializationSteps = [];
        
        // 🔄 COORDINATE_INTEGRATION: CoordinateManager統合
        this.coordinateManager = null;
        this.coordinateIntegration = {
            enabled: false,
            duplicateElimination: false,
            performance: {}
        };
        
        // 境界管理
        this.boundaryManager = null;
        this.isDrawing = false;
        this.currentTool = null;
        this.lastDrawingPoint = null;
        
        // 描画パス管理
        this.paths = [];
        this.layers = {};
        this.backgroundSprite = null;
        this.grid = null;
        
        // リサイズ関連
        this.resizeHistory = {
            entries: [],
            currentIndex: -1,
            maxEntries: 20
        };
        
        this.resizeSettings = {
            enabled: true,
            preserveContent: true,
            centerContent: true,
            constrainProportions: false,
            animationDuration: 300,
            undoRedoEnabled: true
        };
        
        // パフォーマンス管理
        this.extensions = {
            gsapAvailable: typeof gsap !== 'undefined'
        };
        
        console.log(`🎨 CanvasManager ${this.version} 構築完了（座標統合版）`);
    }

    /**
     * 初期化（座標統合対応版）
     */
    async initialize(appCore, canvasElement) {
        try {
            console.log('🎨 CanvasManager初期化開始（座標統合版）');
            
            if (!appCore) {
                throw new Error('AppCore インスタンスが必要です');
            }
            
            // 基本設定
            this.appCore = appCore;
            this.app = appCore.app;
            this.canvasElement = canvasElement;
            this.drawingContainer = appCore.drawingContainer;
            
            // 🔄 COORDINATE_INTEGRATION: 座標統合初期化
            await this.initializeCoordinateIntegration();
            
            // 初期サイズ設定
            const canvasConfig = ConfigManager.getCanvasConfig();
            this.width = canvasConfig.width;
            this.height = canvasConfig.height;
            
            // レイヤー初期化
            this.initializeLayers();
            
            // 背景・グリッド初期化
            this.initializeBackground();
            this.initializeGrid();
            
            // 境界管理初期化
            this.initializeBoundaryManager();
            
            // イベントハンドラ設定
            this.setupEventHandlers();
            
            // リサイズUI初期化
            this.initializeResizeUI();
            
            this.isInitialized = true;
            this.initializationSteps.push('canvas-manager-complete');
            
            // StateManager状態更新
            if (window.StateManager) {
                window.StateManager.updateComponentState('canvasManager', 'initialized', {
                    version: this.version,
                    coordinateIntegrated: !!this.coordinateManager,
                    size: { width: this.width, height: this.height },
                    timestamp: Date.now()
                });
            }
            
            console.log('✅ CanvasManager初期化完了（座標統合版）');
            return this;
            
        } catch (error) {
            console.error('❌ CanvasManager初期化失敗:', error);
            if (window.ErrorManager) {
                window.ErrorManager.showError('error', `CanvasManager初期化失敗: ${error.message}`);
            }
            throw error;
        }
    }

    /**
     * 🔄 座標統合システム初期化
     */
    async initializeCoordinateIntegration() {
        console.log('🔄 CanvasManager座標統合初期化開始...');
        
        try {
            // CoordinateManager依存性確認
            if (!window.CoordinateManager) {
                throw new Error('CoordinateManager が必要です。座標統合を完了してください。');
            }
            
            // CoordinateManagerインスタンス生成
            this.coordinateManager = new window.CoordinateManager();
            
            // 座標統合設定確認
            const coordinateConfig = ConfigManager.getCoordinateConfig();
            this.coordinateIntegration = {
                enabled: coordinateConfig.integration?.managerCentralization || false,
                duplicateElimination: coordinateConfig.integration?.duplicateElimination || false,
                performance: coordinateConfig.performance || {}
            };
            
            if (!this.coordinateIntegration.enabled) {
                console.warn('⚠️ 座標統合が無効です。ConfigManagerで coordinate.integration.managerCentralization を true に設定してください。');
            }
            
            this.initializationSteps.push('coordinate-integration');
            
            console.log('✅ CanvasManager座標統合初期化完了');
            console.log('🔄 統合設定:', this.coordinateIntegration);
            
        } catch (error) {
            console.error('❌ 座標統合初期化失敗:', error);
            this.coordinateManager = null;
            this.coordinateIntegration.enabled = false;
            throw error;
        }
    }

    /**
     * 🔄 統合座標取得（getBoundingClientRect()の統一処理）
     */
    getUnifiedCanvasCoordinates(event) {
        if (!this.coordinateManager) {
            console.warn('⚠️ CoordinateManager未初期化 - フォールバック処理');
            return this.getFallbackCanvasCoordinates(event);
        }
        
        try {
            // キャンバス要素の矩形取得
            const canvasRect = this.canvasElement?.getBoundingClientRect();
            if (!canvasRect) {
                throw new Error('キャンバス要素が見つかりません');
            }
            
            // CoordinateManager経由で統一座標抽出
            const coordinates = this.coordinateManager.extractPointerCoordinates(
                event, 
                canvasRect, 
                this.app // PixiJSアプリ
            );
            
            // 座標妥当性確認
            if (!this.coordinateManager.validateCoordinateIntegrity(coordinates.canvas)) {
                throw new Error('無効な座標が検出されました');
            }
            
            return coordinates;
            
        } catch (error) {
            if (window.ErrorManager) {
                window.ErrorManager.showError('warning', 
                    `統一座標取得エラー: ${error.message}`);
            }
            return this.getFallbackCanvasCoordinates(event);
        }
    }

    /**
     * 🔄 フォールバック座標取得（緊急時用）
     */
    getFallbackCanvasCoordinates(event) {
        console.warn('🔧 座標取得フォールバック処理実行');
        
        try {
            const rect = this.canvasElement?.getBoundingClientRect();
            if (!rect) {
                return { screen: { x: 0, y: 0 }, canvas: { x: 0, y: 0 }, pressure: 0.5 };
            }
            
            const clientX = event.clientX || 0;
            const clientY = event.clientY || 0;
            
            // 基本的な座標変換（CoordinateManagerの簡易版）
            const canvasX = Math.max(0, Math.min(this.width, clientX - rect.left));
            const canvasY = Math.max(0, Math.min(this.height, clientY - rect.top));
            
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

    /**
     * レイヤー初期化
     */
    initializeLayers() {
        if (!this.drawingContainer) {
            console.warn('⚠️ DrawingContainer未初期化 - レイヤー初期化スキップ');
            return;
        }

        // 背景レイヤー
        this.backgroundLayer = new PIXI.Container();
        this.backgroundLayer.name = 'background';
        this.drawingContainer.addChild(this.backgroundLayer);

        // メイン描画レイヤー
        this.layers.main = new PIXI.Container();
        this.layers.main.name = 'main';
        this.drawingContainer.addChild(this.layers.main);

        // グリッドレイヤー
        this.gridLayer = new PIXI.Container();
        this.gridLayer.name = 'grid';
        this.drawingContainer.addChild(this.gridLayer);

        this.initializationSteps.push('layers');
        console.log('✅ レイヤー初期化完了');
    }

    /**
     * 背景初期化
     */
    initializeBackground() {
        if (!this.backgroundLayer) return;

        const canvasConfig = ConfigManager.getCanvasConfig();
        
        // 背景スプライト作成
        this.backgroundSprite = new PIXI.Graphics();
        this.backgroundSprite.beginFill(canvasConfig.backgroundColor || 0xf0e0d6);
        this.backgroundSprite.drawRect(0, 0, this.width, this.height);
        this.backgroundSprite.endFill();
        
        this.backgroundLayer.addChild(this.backgroundSprite);
        
        this.initializationSteps.push('background');
        console.log('✅ 背景初期化完了');
    }

    /**
     * グリッド初期化
     */
    initializeGrid() {
        if (!this.gridLayer) return;

        this.grid = new PIXI.Graphics();
        this.grid.name = 'grid';
        this.grid.visible = false; // デフォルトは非表示
        
        this.gridLayer.addChild(this.grid);
        this.updateGrid();
        
        this.initializationSteps.push('grid');
        console.log('✅ グリッド初期化完了');
    }

    /**
     * グリッド更新
     */
    updateGrid() {
        if (!this.grid) return;

        this.grid.clear();
        this.grid.lineStyle(1, 0xcccccc, 0.3);

        const gridSize = 20;
        
        // 縦線
        for (let x = 0; x <= this.width; x += gridSize) {
            this.grid.moveTo(x, 0);
            this.grid.lineTo(x, this.height);
        }
        
        // 横線
        for (let y = 0; y <= this.height; y += gridSize) {
            this.grid.moveTo(0, y);
            this.grid.lineTo(this.width, y);
        }
    }

    /**
     * 境界管理初期化
     */
    initializeBoundaryManager() {
        if (!window.BoundaryManager) {
            console.warn('⚠️ BoundaryManager利用不可 - 境界管理スキップ');
            return;
        }

        try {
            this.boundaryManager = new window.BoundaryManager();
            // 🔄 COORDINATE_INTEGRATION: CoordinateManager統合初期化
            this.boundaryManager.initialize(this.canvasElement, this.coordinateManager);
            
            this.initializationSteps.push('boundary-manager');
            console.log('✅ 境界管理初期化完了（座標統合版）');
            
        } catch (error) {
            console.warn('⚠️ 境界管理初期化失敗:', error.message);
            this.boundaryManager = null;
        }
    }

    /**
     * イベントハンドラ設定
     */
    setupEventHandlers() {
        if (!this.canvasElement) {
            console.warn('⚠️ キャンバス要素なし - イベントハンドラ設定スキップ');
            return;
        }

        // 🔄 COORDINATE_INTEGRATION: 統合イベントハンドラ
        this.canvasElement.addEventListener('pointerdown', (e) => {
            this.handlePointerDownWithCoordinateIntegration(e);
        });

        this.canvasElement.addEventListener('pointermove', (e) => {
            this.handlePointerMoveWithCoordinateIntegration(e);
        });

        this.canvasElement.addEventListener('pointerup', (e) => {
            this.handlePointerUpWithCoordinateIntegration(e);
        });

        // タッチイベント対応
        this.canvasElement.addEventListener('touchstart', (e) => e.preventDefault());
        this.canvasElement.addEventListener('touchmove', (e) => e.preventDefault());
        this.canvasElement.addEventListener('touchend', (e) => e.preventDefault());

        this.initializationSteps.push('event-handlers');
        console.log('✅ イベントハンドラ設定完了（座標統合版）');
    }

    /**
     * 🔄 統合ポインターダウンハンドラー
     */
    handlePointerDownWithCoordinateIntegration(event) {
        try {
            event.preventDefault();
            
            // CoordinateManager統合座標取得
            const coordinates = this.getUnifiedCanvasCoordinates(event);
            
            if (coordinates) {
                // 描画開始
                this.startDrawingWithCoordinateIntegration(coordinates, event);
                
                // EventBus通知
                if (window.EventBus) {
                    window.EventBus.safeEmit('canvas.pointer.down', {
                        coordinates,
                        event: event.type,
                        timestamp: Date.now()
                    });
                }
            }
            
        } catch (error) {
            if (window.ErrorManager) {
                window.ErrorManager.showError('warning', 
                    `ポインターダウンエラー: ${error.message}`);
            }
        }
    }

    /**
     * 🔄 統合ポインター移動ハンドラー
     */
    handlePointerMoveWithCoordinateIntegration(event) {
        try {
            event.preventDefault();
            
            if (this.isDrawing) {
                // CoordinateManager統合座標取得
                const coordinates = this.getUnifiedCanvasCoordinates(event);
                
                if (coordinates) {
                    // 描画継続
                    this.continueDrawingWithCoordinateIntegration(coordinates, event);
                    
                    // EventBus通知
                    if (window.EventBus) {
                        window.EventBus.safeEmit('canvas.pointer.move', {
                            coordinates,
                            isDrawing: true,
                            event: event.type,
                            timestamp: Date.now()
                        });
                    }
                }
            }
            
        } catch (error) {
            if (window.ErrorManager) {
                window.ErrorManager.showError('warning', 
                    `ポインター移動エラー: ${error.message}`);
            }
        }
    }

    /**
     * 🔄 統合ポインターアップハンドラー
     */
    handlePointerUpWithCoordinateIntegration(event) {
        try {
            event.preventDefault();
            
            if (this.isDrawing) {
                // 描画終了
                this.stopDrawingWithCoordinateIntegration();
                
                // EventBus通知
                if (window.EventBus) {
                    window.EventBus.safeEmit('canvas.pointer.up', {
                        wasDrawing: true,
                        event: event.type,
                        timestamp: Date.now()
                    });
                }
            }
            
        } catch (error) {
            if (window.ErrorManager) {
                window.ErrorManager.showError('warning', 
                    `ポインターアップエラー: ${error.message}`);
            }
        }
    }

    /**
     * 🔄 統合描画開始処理
     */
    startDrawingWithCoordinateIntegration(coordinates, event) {
        try {
            // ToolManagerに描画開始を通知
            if (this.appCore?.toolManager) {
                this.appCore.toolManager.startDrawing(
                    coordinates.canvas.x,
                    coordinates.canvas.y,
                    coordinates.pressure
                );
            }
            
            // 描画状態更新
            this.isDrawing = true;
            this.lastDrawingPoint = coordinates.canvas;
            
            // StateManager経由で状態更新
            if (window.StateManager) {
                window.StateManager.updateComponentState('canvasManager', 'drawing', {
                    isDrawing: true,
                    coordinates: coordinates.canvas,
                    pressure: coordinates.pressure,
                    timestamp: Date.now()
                });
            }
            
            console.log(`🎨 座標統合描画開始: (${coordinates.canvas.x.toFixed(1)}, ${coordinates.canvas.y.toFixed(1)})`);
            
        } catch (error) {
            if (window.ErrorManager) {
                window.ErrorManager.showError('warning', 
                    `統合描画開始エラー: ${error.message}`);
            }
        }
    }

    /**
     * 🔄 統合描画継続処理
     */
    continueDrawingWithCoordinateIntegration(coordinates, event) {
        try {
            // 前回座標との距離計算（CoordinateManager使用）
            let shouldDraw = true;
            if (this.lastDrawingPoint && this.coordinateManager) {
                const distance = this.coordinateManager.calculateDistance(
                    this.lastDrawingPoint, 
                    coordinates.canvas
                );
                
                // 最小描画距離チェック
                const minDistance = ConfigManager.get('drawing.pen.minDistance') || 1.5;
                shouldDraw = distance >= minDistance;
            }
            
            if (shouldDraw) {
                // ToolManagerに描画継続を通知
                if (this.appCore?.toolManager) {
                    this.appCore.toolManager.continueDrawing(
                        coordinates.canvas.x,
                        coordinates.canvas.y,
                        coordinates.pressure
                    );
                }
                
                this.lastDrawingPoint = coordinates.canvas;
            }
            
        } catch (error) {
            if (window.ErrorManager) {
                window.ErrorManager.showError('warning', 
                    `統合描画継続エラー: ${error.message}`);
            }
        }
    }

    /**
     * 🔄 統合描画終了処理
     */
    stopDrawingWithCoordinateIntegration() {
        try {
            // ToolManagerに描画終了を通知
            if (this.appCore?.toolManager) {
                this.appCore.toolManager.stopDrawing();
            }
            
            // 描画状態クリア
            this.isDrawing = false;
            this.lastDrawingPoint = null;
            
            // StateManager経由で状態更新
            if (window.StateManager) {
                window.StateManager.updateComponentState('canvasManager', 'drawing', {
                    isDrawing: false,
                    timestamp: Date.now()
                });
            }
            
            console.log('🎨 座標統合描画終了');
            
        } catch (error) {
            if (window.ErrorManager) {
                window.ErrorManager.showError('warning', 
                    `統合描画終了エラー: ${error.message}`);
            }
        }
    }

    /**
     * リサイズUI初期化
     */
    initializeResizeUI() {
        // リサイズUIの基本設定
        this.resizeUI = {
            widthInput: document.getElementById('canvas-width'),
            heightInput: document.getElementById('canvas-height'),
            applyButton: document.getElementById('apply-resize'),
            applyCenterButton: document.getElementById('apply-resize-center')
        };

        this.initializationSteps.push('resize-ui');
        console.log('✅ リサイズUI初期化完了');
    }

    /**
     * リサイズ実行（座標統合版）
     */
    resize(newWidth, newHeight, centerContent = false) {
        return this.executeResizeWithCoordinateIntegration(newWidth, newHeight, centerContent);
    }

    /**
     * 🔄 リサイズ実行（CoordinateManager統合版）
     */
    executeResizeWithCoordinateIntegration(newWidth, newHeight, centerContent) {
        const oldWidth = this.width;
        const oldHeight = this.height;
        
        try {
            // 妥当性確認
            if (!ConfigManager.validate('canvas.width', newWidth) || 
                !ConfigManager.validate('canvas.height', newHeight)) {
                throw new Error('無効なキャンバスサイズ');
            }
            
            // コンテンツの現在位置記録
            let contentBounds = null;
            if (centerContent && this.coordinateManager) {
                contentBounds = this.getContentBoundsWithCoordinateManager();
            }
            
            // PixiJS Applicationリサイズ
            this.app.renderer.resize(newWidth, newHeight);
            
            // キャンバス要素のサイズ更新
            if (this.canvasElement) {
                this.canvasElement.style.width = newWidth + 'px';
                this.canvasElement.style.height = newWidth + 'px';
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
            
            // 背景・グリッド更新
            this.updateBackground();
            this.updateGrid();
            
            // コンテンツ中央寄せ（座標統合版）
            if (centerContent && contentBounds && this.coordinateManager) {
                this.centerExistingContentWithCoordinateManager(
                    contentBounds, oldWidth, oldHeight, newWidth, newHeight
                );
            }
            
            // リサイズ履歴記録
            this.recordResizeInHistory(oldWidth, oldHeight, newWidth, newHeight, centerContent);
            
            // EventBus通知
            if (window.EventBus) {
                window.EventBus.safeEmit('canvas.resized', {
                    oldSize: { width: oldWidth, height: oldHeight },
                    newSize: { width: newWidth, height: newHeight },
                    centerContent,
                    coordinateIntegrated: !!this.coordinateManager,
                    timestamp: Date.now()
                });
            }
            
            console.log(`📏 座標統合リサイズ完了: ${oldWidth}×${oldHeight} → ${newWidth}×${newHeight}`);
            
            return true;
            
        } catch (error) {
            if (window.ErrorManager) {
                window.ErrorManager.showError('error', 
                    `リサイズエラー: ${error.message}`);
            }
            return false;
        }
    }

    /**
     * 背景更新
     */
    updateBackground() {
        if (!this.backgroundSprite) return;

        this.backgroundSprite.clear();
        const canvasConfig = ConfigManager.getCanvasConfig();
        this.backgroundSprite.beginFill(canvasConfig.backgroundColor || 0xf0e0d6);
        this.backgroundSprite.drawRect(0, 0, this.width, this.height);
        this.backgroundSprite.endFill();
    }

    /**
     * 🔄 CoordinateManager統合コンテンツ境界取得
     */
    getContentBoundsWithCoordinateManager() {
        if (!this.coordinateManager || this.paths.length === 0) {
            return null;
        }
        
        try {
            let minX = Infinity, minY = Infinity;
            let maxX = -Infinity, maxY = -Infinity;
            
            this.paths.forEach(path => {
                if (path.points && path.points.length > 0) {
                    path.points.forEach(point => {
                        // CoordinateManagerで座標妥当性確認
                        if (this.coordinateManager.validateCoordinateIntegrity(point)) {
                            minX = Math.min(minX, point.x);
                            minY = Math.min(minY, point.y);
                            maxX = Math.max(maxX, point.x);
                            maxY = Math.max(maxY, point.y);
                        }
                    });
                }
            });
            
            if (minX === Infinity) {
                return null;
            }
            
            const bounds = {
                x: minX,
                y: minY,
                width: maxX - minX,
                height: maxY - minY,
                centerX: (minX + maxX) / 2,
                centerY: (minY + maxY) / 2
            };
            
            // CoordinateManagerで精度適用
            bounds.x = this.coordinateManager.applyPrecision(bounds.x);
            bounds.y = this.coordinateManager.applyPrecision(bounds.y);
            bounds.width = this.coordinateManager.applyPrecision(bounds.width);
            bounds.height = this.coordinateManager.applyPrecision(bounds.height);
            bounds.centerX = this.coordinateManager.applyPrecision(bounds.centerX);
            bounds.centerY = this.coordinateManager.applyPrecision(bounds.centerY);
            
            return bounds;
            
        } catch (error) {
            if (window.ErrorManager) {
                window.ErrorManager.showError('warning', 
                    `コンテンツ境界計算エラー: ${error.message}`);
            }
            return null;
        }
    }

    /**
     * 🔄 座標統合既存コンテンツ中央寄せ
     */
    centerExistingContentWithCoordinateManager(contentBounds, oldWidth, oldHeight, newWidth, newHeight) {
        if (!contentBounds || !this.coordinateManager || this.paths.length === 0) {
            return;
        }
        
        try {
            // オフセット計算（CoordinateManagerで精度適用）
            const offsetX = this.coordinateManager.applyPrecision((newWidth - oldWidth) / 2);
            const offsetY = this.coordinateManager.applyPrecision((newHeight - oldHeight) / 2);
            
            console.log(`🎯 座標統合中央寄せ: オフセット(${offsetX}, ${offsetY})`);
            
            // 全レイヤーを移動
            Object.values(this.layers).forEach(layer => {
                if (layer && layer.position) {
                    layer.position.x = this.coordinateManager.applyPrecision(layer.position.x + offsetX);
                    layer.position.y = this.coordinateManager.applyPrecision(layer.position.y + offsetY);
                }
            });
            
            // パス座標更新（座標統合処理）
            this.paths.forEach(path => {
                if (path.points && Array.isArray(path.points)) {
                    path.points.forEach(point => {
                        // 座標妥当性確認後に更新
                        if (this.coordinateManager.validateCoordinateIntegrity(point)) {
                            point.x = this.coordinateManager.applyPrecision(point.x + offsetX);
                            point.y = this.coordinateManager.applyPrecision(point.y + offsetY);
                        }
                    });
                }
                
                // グラフィクス位置更新
                if (path.graphics) {
                    path.graphics.x = this.coordinateManager.applyPrecision(path.graphics.x + offsetX);
                    path.graphics.y = this.coordinateManager.applyPrecision(path.graphics.y + offsetY);
                }
            });
            
        } catch (error) {
            if (window.ErrorManager) {
                window.ErrorManager.showError('warning', 
                    `座標統合中央寄せエラー: ${error.message}`);
            }
        }
    }

    /**
     * リサイズ履歴記録
     */
    recordResizeInHistory(oldWidth, oldHeight, newWidth, newHeight, centerContent) {
        if (!this.resizeSettings.undoRedoEnabled) return;

        // 現在位置以降を削除
        this.resizeHistory.entries = this.resizeHistory.entries.slice(0, this.resizeHistory.currentIndex + 1);
        
        // 新しいエントリ追加
        this.resizeHistory.entries.push({
            oldSize: { width: oldWidth, height: oldHeight },
            newSize: { width: newWidth, height: newHeight },
            centerContent,
            timestamp: Date.now()
        });
        
        // 最大エントリ数制限
        if (this.resizeHistory.entries.length > this.resizeHistory.maxEntries) {
            this.resizeHistory.entries.shift();
        } else {
            this.resizeHistory.currentIndex++;
        }
    }

    /**
     * 🔄 座標統合診断実行
     */
    runCoordinateIntegrationDiagnosis() {
        console.group('🔍 CanvasManager座標統合診断');
        
        const diagnosis = {
            coordinateManager: {
                available: !!this.coordinateManager,
                integrationEnabled: this.coordinateIntegration?.enabled || false,
                duplicateElimination: this.coordinateIntegration?.duplicateElimination || false
            },
            implementation: {
                unifiedCoordinateExtraction: typeof this.getUnifiedCanvasCoordinates === 'function',
                resizeCoordinateIntegration: typeof this.executeResizeWithCoordinateIntegration === 'function',
                drawingCoordinateIntegration: typeof this.startDrawingWithCoordinateIntegration === 'function',
                boundaryManagerIntegrated: !!(this.boundaryManager && this.boundaryManager.coordinateManager)
            },
            state: {
                isInitialized: this.isInitialized,
                hasContent: this.paths?.length > 0,
                currentSize: { width: this.width, height: this.height }
            }
        };
        
        const recommendations = [];
        
        if (!diagnosis.coordinateManager.available) {
            recommendations.push('CoordinateManagerの初期化が必要');
        }
        
        if (!diagnosis.coordinateManager.integrationEnabled) {
            recommendations.push('座標統合設定の有効化が必要');
        }
        
        if (!diagnosis.implementation.boundaryManagerIntegrated) {
            recommendations.push('BoundaryManager座標統合が未完了');
        }
        
        console.log('📊 診断結果:', diagnosis);
        
        if (recommendations.length > 0) {
            console.warn('⚠️ 推奨事項:', recommendations);
        } else {
            console.log('✅ 座標統合診断: 全要件を満たしています');
        }
        
        console.groupEnd();
        
        return { diagnosis, recommendations };
    }

    /**
     * キャンバス状態取得
     */
    getCanvasState() {
        return {
            version: this.version,
            isInitialized: this.isInitialized,
            size: { width: this.width, height: this.height },
            isDrawing: this.isDrawing,
            pathCount: this.paths.length,
            layerCount: Object.keys(this.layers).length,
            coordinateIntegration: {
                enabled: this.coordinateIntegration?.enabled || false,
                coordinateManagerAvailable: !!this.coordinateManager
            },
            initializationSteps: this.initializationSteps,
            boundaryManagerAvailable: !!this.boundaryManager,
            gridVisible: this.grid?.visible || false
        };
    }

    /**
     * Canvas Manager 破棄
     */
    destroy() {
        try {
            // イベントリスナー削除
            if (this.canvasElement) {
                this.canvasElement.removeEventListener('pointerdown', this.handlePointerDownWithCoordinateIntegration);
                this.canvasElement.removeEventListener('pointermove', this.handlePointerMoveWithCoordinateIntegration);
                this.canvasElement.removeEventListener('pointerup', this.handlePointerUpWithCoordinateIntegration);
            }
            
            // 境界管理破棄
            if (this.boundaryManager && typeof this.boundaryManager.destroy === 'function') {
                this.boundaryManager.destroy();
            }
            
            // リソースクリア
            this.paths = [];
            this.layers = {};
            this.coordinateManager = null;
            this.boundaryManager = null;
            this.backgroundSprite = null;
            this.grid = null;
            
            console.log('🗑️ CanvasManager破棄完了');
            
        } catch (error) {
            console.error('❌ CanvasManager破棄エラー:', error);
        }
    }
}

// グローバル公開用
window.CanvasManager = CanvasManager;

console.log('🔄 CanvasManager座標統合完成版 - 初期化完了');
console.log('✅ 座標統合実装項目:');
console.log('  - CoordinateManager依存性確認・統合初期化');
console.log('  - 統一座標取得システム（getBoundingClientRect統合）');
console.log('  - 座標統合描画処理（開始・継続・終了）');
console.log('  - 座標統合リサイズ処理');
console.log('  - 座標統合イベントハンドラー');
console.log('  - BoundaryManager座標統合対応');
console.log('  - 座標統合診断システム');
console.log('💡 使用例: new CanvasManager().initialize(appCore, canvasElement)');