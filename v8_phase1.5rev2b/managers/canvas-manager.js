/**
 * 📄 FILE: managers/canvas-manager.js
 * 📌 RESPONSIBILITY: PixiJS v8 Canvas管理・Graphics階層分離・描画消失問題解決
 * 
 * @provides
 *   - CanvasManager（クラス）
 *   - initializeV8Application(pixiApp): Promise<void>
 *   - getDrawContainer(): PIXI.Container
 *   - createStrokeGraphics(strokeId?): PIXI.Graphics
 *   - addPermanentGraphics(graphics): boolean
 *   - clearTemporaryGraphics(): void
 *   - getTemporaryGraphics(): PIXI.Graphics
 *   - getCanvasElement(): HTMLCanvasElement
 *   - getPixiApp(): PIXI.Application
 *   - isV8Ready(): boolean
 *   - getTransformCoefficients(): Object
 *   - resizeV8Canvas(width, height): void
 *   - getDebugInfo(): Object
 *
 * @uses
 *   - PIXI.Application（v8 Application）
 *   - PIXI.Container（階層管理）
 *   - PIXI.Graphics（描画オブジェクト）
 *   - window.Tegaki.ErrorManagerInstance.showError（エラー処理）
 *
 * @initflow
 *   1. constructor → 2. initializeV8Application → 3. createV8DrawingContainer
 *   → 4. initializeGraphicsManagement → 5. v8Ready = true
 *
 * @forbids
 *   💀 双方向依存禁止
 *   🚫 フォールバック禁止
 *   🚫 フェイルセーフ禁止
 *   🚫 v7/v8二重管理禁止
 *   🚫 未実装メソッド呼び出し禁止
 *   🚫 Graphics全消去による描画消失禁止
 *   🚫 Container階層の不適切操作禁止
 *   🚫 DPR無制限拡大禁止
 *
 * @manager-key
 *   window.Tegaki.CanvasManagerInstance
 *
 * @dependencies-strict
 *   REQUIRED: PixiJS v8.12.0
 *   OPTIONAL: ErrorManager
 *   FORBIDDEN: 他のCanvas管理システム、v7互換コード
 *
 * @integration-flow
 *   AppCore.createCanvasV8 → CanvasManager.initializeV8Application
 *   → DrawContainer作成 → ToolManager注入可能
 *
 * @method-naming-rules
 *   初期化系: initializeV8xxx()
 *   取得系: getDrawContainer(), getCanvasElement()
 *   Graphics管理: createStrokeGraphics(), addPermanentGraphics(), clearTemporaryGraphics()
 *   座標系: getTransformCoefficients()
 *
 * @error-handling
 *   throw: 初期化失敗・必須コンポーネント未作成・Graphics操作失敗
 *   false: オプション機能失敗・設定更新失敗
 *   warn: 性能低下・メモリ不足
 *
 * @testing-hooks
 *   - getDebugInfo(): システム状態詳細・Graphics統計・メモリ使用量
 *   - isV8Ready(): 完全準備状態確認
 *   - getGraphicsStats(): Graphics管理統計
 *
 * @state-management
 *   Graphics状態は直接操作禁止・専用メソッド経由のみ
 *   Container階層の自動管理・zIndex自動設定
 *   メモリリーク防止・Graphics適切解放
 *
 * @performance-notes
 *   WebGPU対応・Graphics分離でメモリ効率化・Container階層最適化
 *   DPR制限(2.0)・400x400固定で高速描画・60fps維持
 */

(function() {
    'use strict';

    if (!window.Tegaki) {
        window.Tegaki = {};
    }

    class CanvasManager {
        constructor() {
            console.log('🎨 CanvasManager: constructed (v8 friendly)');
            
            // 基本プロパティ
            this.pixiApp = null;
            this.layers = new Map();
            this.initialized = false;
            this.v8Ready = false;
            this.activeLayerId = 'layer1';
            
            // デフォルトキャンバスサイズ（400x400固定）
            this.defaultWidth = 400;
            this.defaultHeight = 400;
            
            // Graphics管理（描画消失問題解決の核心）
            this.permanentGraphics = new Map(); // strokeId -> Graphics
            this.temporaryGraphics = null;
            this.graphicsLayers = null; // 階層管理Container群
            this.graphicsIdCounter = 0;
            
            // v8専用プロパティ
            this.rendererType = null;
            this.webgpuSupported = false;
            this.v8DrawingContainer = null;
            
            // DPR制限設定
            this.maxDPR = 2.0;
            this.effectiveDPR = 1.0;
            
            // 背景色設定（ふたばクリーム）
            this.backgroundColor = 0xf0e0d6; // #f0e0d6
            
            // Graphics統計
            this.graphicsStats = {
                totalGraphicsCreated: 0,
                permanentGraphicsCount: 0,
                temporaryGraphicsClears: 0,
                memoryOptimizations: 0
            };
        }
        
        /**
         * v8 Application設定・完全初期化（Graphics分離管理対応）
         * @param {PIXI.Application} pixiApp - 初期化済みPixiJS Application
         */
        async initializeV8Application(pixiApp) {
            if (!pixiApp) {
                throw new Error('v8 PixiJS Application is required');
            }
            
            if (!pixiApp.stage) {
                throw new Error('v8 PixiJS Application has no stage');
            }
            
            try {
                console.log('🎨 CanvasManager: v8 Application初期化開始');
                
                // Step 1: Application設定
                this.pixiApp = pixiApp;
                this.rendererType = pixiApp.renderer.type;
                this.webgpuSupported = this.rendererType === 'webgpu';
                
                // Step 2: DPR制限設定
                this.applyDPRLimit();
                
                // Step 3: キャンバスサイズを400x400に設定
                this.resizeV8Canvas(this.defaultWidth, this.defaultHeight);
                
                // Step 4: Container階層作成
                this.createV8DrawingContainer();
                
                // Step 5: Graphics管理システム初期化（重要な修正）
                this.initializeGraphicsManagement();
                
                // Step 6: 完全初期化完了
                this.v8Ready = true;
                this.initialized = true;
                
                // DOM要素のサイズも確実に設定
                if (this.pixiApp.canvas) {
                    this.pixiApp.canvas.style.width = this.defaultWidth + 'px';
                    this.pixiApp.canvas.style.height = this.defaultHeight + 'px';
                }
                
                console.log(`🎨 CanvasManager: v8初期化完了 (${this.defaultWidth}x${this.defaultHeight}, ${this.rendererType})`);
                
            } catch (error) {
                console.error('🎨 CanvasManager初期化エラー:', error);
                throw error;
            }
        }
        
        /**
         * DPR制限適用（巨大キャンバス防止）
         */
        applyDPRLimit() {
            const deviceDPR = window.devicePixelRatio || 1;
            this.effectiveDPR = Math.min(deviceDPR, this.maxDPR);
            
            if (this.pixiApp?.renderer) {
                this.pixiApp.renderer.resolution = this.effectiveDPR;
            }
        }
        
        /**
         * v8描画Container作成（階層分離対応）
         */
        createV8DrawingContainer() {
            console.log('🎨 CanvasManager: Container階層作成開始');
            
            if (!this.pixiApp?.stage) {
                throw new Error('v8 Application stage not available for layer creation');
            }
            
            // ステージのContainer機能有効化
            this.pixiApp.stage.sortableChildren = true;
            this.pixiApp.stage.interactiveChildren = true;
            
            // layer0: 背景レイヤー
            const backgroundLayer = this.createLayerV8('layer0', { 
                zIndex: 0, 
                background: true,
                color: this.backgroundColor
            });
            
            // layer1: 描画レイヤー（メイン）
            const drawingLayer = this.createLayerV8('layer1', { 
                zIndex: 1, 
                drawing: true,
                sortableChildren: true
            });
            
            // interactionOverlay: インタラクション用レイヤー
            const interactionLayer = this.createLayerV8('interactionOverlay', {
                zIndex: 2,
                interactive: true
            });
            
            // main: layer1のエイリアス
            this.layers.set('main', drawingLayer);
            
            // v8描画Container設定（確実化）
            this.v8DrawingContainer = drawingLayer;
            
            if (!this.v8DrawingContainer) {
                throw new Error('v8DrawingContainer assignment failed');
            }
            
            console.log('🎨 CanvasManager: Container階層作成完了');
        }
        
        /**
         * Graphics管理システム初期化（描画消失問題解決の核心）
         */
        initializeGraphicsManagement() {
            console.log('🎨 CanvasManager: Graphics管理システム初期化開始');
            
            if (!this.v8DrawingContainer) {
                throw new Error('Drawing container not available for Graphics management');
            }
            
            // Graphics階層Container作成
            this.graphicsLayers = {
                permanent: new PIXI.Container(),    // 確定描画（削除されない）
                temporary: new PIXI.Container(),    // 一時描画（クリア対象）
                overlay: new PIXI.Container()       // UI重ね合わせ
            };
            
            // 階層zIndex設定
            this.graphicsLayers.permanent.zIndex = 100;
            this.graphicsLayers.temporary.zIndex = 200;
            this.graphicsLayers.overlay.zIndex = 300;
            
            // 各階層の設定
            Object.entries(this.graphicsLayers).forEach(([name, layer]) => {
                layer.name = `graphics_${name}`;
                layer.sortableChildren = true;
                layer.interactiveChildren = false; // Graphics層は非インタラクティブ
                this.v8DrawingContainer.addChild(layer);
            });
            
            // 一時Graphics作成（リアルタイム描画用）
            this.temporaryGraphics = new PIXI.Graphics();
            this.temporaryGraphics.name = 'temporaryGraphics';
            this.temporaryGraphics.zIndex = 1000; // 最前面
            this.graphicsLayers.temporary.addChild(this.temporaryGraphics);
            
            // Container階層ソート
            this.v8DrawingContainer.sortChildren();
            
            console.log('🎨 CanvasManager: Graphics管理システム初期化完了');
        }
        
        // ========================================
        // Graphics管理メソッド（描画消失問題解決）
        // ========================================
        
        /**
         * ストローク専用Graphics作成（PenTool要求メソッド）
         * @param {string} strokeId - ストロークID（省略時自動生成）
         * @returns {PIXI.Graphics} 新しいGraphicsオブジェクト
         */
        createStrokeGraphics(strokeId) {
            if (!strokeId) {
                strokeId = 'stroke_' + (++this.graphicsIdCounter) + '_' + Date.now();
            }
            
            const graphics = new PIXI.Graphics();
            graphics.name = strokeId;
            graphics.zIndex = this.graphicsIdCounter; // 描画順序保証
            
            // 永続Graphics として記録（重要）
            this.permanentGraphics.set(strokeId, graphics);
            
            // 統計更新
            this.graphicsStats.totalGraphicsCreated++;
            this.graphicsStats.permanentGraphicsCount = this.permanentGraphics.size;
            
            console.log(`🎨 Graphics作成: ${strokeId}`);
            return graphics;
        }
        
        /**
         * 永続Graphics追加（確定描画用・PenTool要求メソッド）
         * @param {PIXI.Graphics} graphics - 追加するGraphics
         * @returns {boolean} 追加成功フラグ
         */
        addPermanentGraphics(graphics) {
            if (!graphics) {
                throw new Error('Graphics object is required');
            }
            
            if (!this.graphicsLayers?.permanent) {
                throw new Error('Permanent graphics layer not available');
            }
            
            try {
                // 永続レイヤーに追加
                this.graphicsLayers.permanent.addChild(graphics);
                
                // 階層ソート（zIndex順序保証）
                this.graphicsLayers.permanent.sortChildren();
                
                // 一時Graphics を最前面に維持（重要な修正）
                if (this.temporaryGraphics && this.temporaryGraphics.parent) {
                    this.temporaryGraphics.zIndex = 1000;
                    this.graphicsLayers.temporary.sortChildren();
                }
                
                console.log(`🎨 永続Graphics追加: ${graphics.name}`);
                return true;
                
            } catch (error) {
                console.error('🎨 永続Graphics追加失敗:', error);
                return false;
            }
        }
        
        /**
         * 一時Graphics取得（リアルタイム描画用・PenTool要求メソッド）
         * @returns {PIXI.Graphics} 一時描画用Graphics
         */
        getTemporaryGraphics() {
            return this.temporaryGraphics;
        }
        
        /**
         * 一時Graphicsクリア（新しい描画開始時・PenTool要求メソッド）
         */
        clearTemporaryGraphics() {
            if (this.temporaryGraphics) {
                this.temporaryGraphics.clear();
                this.graphicsStats.temporaryGraphicsClears++;
            }
        }
        
        /**
         * 全永続Graphicsクリア（Canvas全消去用）
         */
        clearAllPermanentGraphics() {
            console.log('🎨 全永続Graphics消去開始');
            
            for (const [strokeId, graphics] of this.permanentGraphics) {
                if (graphics.parent) {
                    graphics.parent.removeChild(graphics);
                }
                graphics.destroy();
                console.log(`🎨 Graphics破棄: ${strokeId}`);
            }
            
            this.permanentGraphics.clear();
            this.graphicsStats.permanentGraphicsCount = 0;
            this.graphicsStats.memoryOptimizations++;
            
            console.log('🎨 全永続Graphics消去完了');
        }
        
        // ========================================
        // 座標変換支援メソッド（CoordinateManager連携用）
        // ========================================
        
        /**
         * Canvas要素の矩形情報取得
         * @returns {DOMRect} Canvas要素のBoundingClientRect
         */
        getCanvasRect() {
            const canvas = this.getCanvasElement();
            return canvas.getBoundingClientRect();
        }
        
        /**
         * Canvas論理サイズ取得
         * @returns {{width: number, height: number}} 論理サイズ
         */
        getCanvasLogicalSize() {
            return {
                width: this.pixiApp.canvas.width / this.effectiveDPR,
                height: this.pixiApp.canvas.height / this.effectiveDPR
            };
        }
        
        /**
         * 座標変換係数取得（CoordinateManager用）
         * @returns {Object} 座標変換係数
         */
        getTransformCoefficients() {
            const rect = this.getCanvasRect();
            const logical = this.getCanvasLogicalSize();
            
            return {
                scaleX: logical.width / rect.width,
                scaleY: logical.height / rect.height,
                offsetX: rect.left,
                offsetY: rect.top,
                dpr: this.effectiveDPR,
                logicalSize: logical,
                displaySize: { width: rect.width, height: rect.height }
            };
        }
        
        // ========================================
        // v8 Container・レイヤー管理
        // ========================================
        
        /**
         * v8 Containerレイヤー作成（400x400サイズ対応）
         */
        createLayerV8(layerId, options = {}) {
            const layer = new PIXI.Container();
            layer.name = layerId;
            layer.sortableChildren = options.sortableChildren !== false;
            layer.interactiveChildren = options.interactiveChildren !== false;
            layer.zIndex = options.zIndex ?? this.layers.size;
            
            // v8高度なContainer機能設定
            if (options.mask) layer.mask = options.mask;
            if (options.filters) layer.filters = options.filters;
            if (options.blendMode) layer.blendMode = options.blendMode;
            if (options.alpha !== undefined) layer.alpha = options.alpha;
            if (options.visible !== undefined) layer.visible = options.visible;
            
            // 背景レイヤーの場合は背景Graphics作成（400x400固定）
            if (options.background && options.color !== undefined) {
                const backgroundGraphics = new PIXI.Graphics();
                backgroundGraphics.rect(0, 0, this.defaultWidth, this.defaultHeight);
                backgroundGraphics.fill({ color: options.color, alpha: 1.0 });
                backgroundGraphics.name = `${layerId}_background`;
                
                layer.addChild(backgroundGraphics);
            }
            
            // ステージに追加
            this.pixiApp.stage.addChild(layer);
            this.layers.set(layerId, layer);
            
            // Container階層自動ソート
            this.pixiApp.stage.sortChildren();
            
            return layer;
        }
        
        /**
         * キャンバスサイズ変更（400x400デフォルト・DPR制限対応）
         */
        resizeV8Canvas(width = 400, height = 400) {
            if (!this.pixiApp) {
                throw new Error('v8 PixiJS Application not available - cannot resize');
            }
            
            const deviceDPR = window.devicePixelRatio || 1;
            const limitedDPR = Math.min(deviceDPR, this.maxDPR);
            
            this.pixiApp.renderer.resize(width, height);
            this.pixiApp.renderer.resolution = limitedDPR;
            this.effectiveDPR = limitedDPR;
            
            // 背景レイヤーサイズ更新
            const backgroundLayer = this.layers.get('layer0');
            if (backgroundLayer && backgroundLayer.children.length > 0) {
                const backgroundGraphics = backgroundLayer.children[0];
                if (backgroundGraphics instanceof PIXI.Graphics) {
                    backgroundGraphics.clear();
                    backgroundGraphics.rect(0, 0, width, height);
                    backgroundGraphics.fill({ color: this.backgroundColor, alpha: 1.0 });
                }
            }
            
            // DOM要素のサイズも更新
            if (this.pixiApp.canvas) {
                this.pixiApp.canvas.style.width = width + 'px';
                this.pixiApp.canvas.style.height = height + 'px';
            }
            
            console.log(`🎨 Canvas サイズ変更: ${width}x${height} (DPR: ${limitedDPR})`);
        }
        
        // ========================================
        // アクセサーメソッド・状態確認
        // ========================================
        
        /**
         * v8描画Container取得（確実版・AppCore連携用）
         * @returns {PIXI.Container} v8描画Container
         */
        getDrawContainer() {
            if (!this.v8Ready) {
                throw new Error('CanvasManager not fully initialized');
            }
            
            if (!this.v8DrawingContainer) {
                throw new Error('v8 Drawing Container not available - initialization failed');
            }
            
            return this.v8DrawingContainer;
        }
        
        /**
         * キャンバス要素取得
         * @returns {HTMLCanvasElement} Canvas DOM要素
         */
        getCanvasElement() {
            if (!this.pixiApp?.canvas) {
                throw new Error('v8 CanvasManager: canvas element not available');
            }
            return this.pixiApp.canvas;
        }
        
        /**
         * PixiJS Application取得
         * @returns {PIXI.Application} PixiJS Application
         */
        getPixiApp() {
            return this.pixiApp;
        }
        
        /**
         * レイヤー取得
         * @param {string} layerId - レイヤーID
         * @returns {PIXI.Container|null} レイヤーContainer
         */
        getLayer(layerId) {
            const layer = this.layers.get(layerId);
            
            if (!layer && layerId === 'main') {
                throw new Error('v8 main layer not found - CanvasManager not initialized');
            }
            
            return layer || null;
        }
        
        /**
         * v8対応状況確認（完全版）
         * @returns {boolean} 完全準備状態
         */
        isV8Ready() {
            return this.v8Ready && 
                   this.initialized &&
                   !!this.pixiApp && 
                   !!this.rendererType &&
                   !!this.v8DrawingContainer &&
                   !!this.graphicsLayers &&
                   !!this.temporaryGraphics &&
                   this.layers.has('main') &&
                   this.layers.has('layer0') &&
                   this.layers.has('layer1');
        }
        
        // ========================================
        // 統計・デバッグ機能
        // ========================================
        
        /**
         * Graphics管理統計取得
         * @returns {Object} Graphics統計情報
         */
        getGraphicsStats() {
            return {
                ...this.graphicsStats,
                currentPermanentCount: this.permanentGraphics.size,
                temporaryGraphicsReady: !!this.temporaryGraphics,
                memoryUsage: {
                    permanentGraphicsMemory: this.permanentGraphics.size * 1024, // 概算
                    layersCount: Object.keys(this.graphicsLayers || {}).length
                }
            };
        }
        
        /**
         * アクティブレイヤークリア（確認付き）
         */
        clear() {
            // 一時Graphicsのみクリア
            this.clearTemporaryGraphics();
            
            // 永続Graphics全削除（確認付き）
            if (confirm('全ての描画を削除しますか？')) {
                this.clearAllPermanentGraphics();
            }
        }
        
        /**
         * デバッグ情報取得（包括版）
         * @returns {Object} 詳細デバッグ情報
         */
        getDebugInfo() {
            return {
                className: 'CanvasManager',
                version: 'v8.12.0-graphics-management-fixed',
                initialization: {
                    v8Ready: this.v8Ready,
                    initialized: this.initialized,
                    pixiAppReady: !!this.pixiApp,
                    drawContainerReady: !!this.v8DrawingContainer
                },
                pixiInfo: {
                    version: typeof PIXI !== 'undefined' ? PIXI.VERSION : 'unknown',
                    rendererType: this.rendererType,
                    webgpuSupported: this.webgpuSupported,
                    webgpuActive: this.rendererType === 'webgpu'
                },
                graphicsManagement: {
                    layersCreated: !!this.graphicsLayers,
                    permanentLayerReady: !!this.graphicsLayers?.permanent,
                    temporaryLayerReady: !!this.graphicsLayers?.temporary,
                    temporaryGraphicsReady: !!this.temporaryGraphics,
                    stats: this.getGraphicsStats()
                },
                containerHierarchy: {
                    totalLayers: this.layers.size,
                    layerNames: Array.from(this.layers.keys()),
                    activeLayer: this.activeLayerId,
                    mainLayerValid: this.layers.get('main') === this.layers.get('layer1'),
                    stageChildrenCount: this.pixiApp?.stage?.children?.length || 0
                },
                canvasInfo: this.pixiApp ? {
                    logicalSize: {
                        width: this.pixiApp.screen.width,
                        height: this.pixiApp.screen.height
                    },
                    physicalSize: {
                        width: this.pixiApp.canvas.width,
                        height: this.pixiApp.canvas.height
                    },
                    displaySize: {
                        width: this.pixiApp.canvas.style.width,
                        height: this.pixiApp.canvas.style.height
                    },
                    resolution: this.pixiApp.renderer.resolution,
                    effectiveDPR: this.effectiveDPR,
                    maxDPR: this.maxDPR,
                    backgroundColor: '0x' + this.backgroundColor.toString(16),
                    defaultSize: `${this.defaultWidth}x${this.defaultHeight}`
                } : null,
                coordinateSupport: {
                    transformCoefficientsReady: true,
                    canvasRectSupported: true,
                    logicalSizeSupported: true
                },
                memoryManagement: {
                    permanentGraphics: this.permanentGraphics.size,
                    graphicsIdCounter: this.graphicsIdCounter,
                    memoryOptimizations: this.graphicsStats.memoryOptimizations
                }
            };
        }
        
        /**
         * メモリクリーンアップ（開発・デバッグ用）
         */
        cleanup() {
            console.log('🎨 CanvasManager: メモリクリーンアップ開始');
            
            // 全Graphics破棄
            this.clearAllPermanentGraphics();
            
            // 一時Graphics破棄
            if (this.temporaryGraphics) {
                this.temporaryGraphics.destroy();
                this.temporaryGraphics = null;
            }
            
            // Graphics層破棄
            if (this.graphicsLayers) {
                Object.values(this.graphicsLayers).forEach(layer => {
                    if (layer.parent) {
                        layer.parent.removeChild(layer);
                    }
                    layer.destroy();
                });
                this.graphicsLayers = null;
            }
            
            console.log('🎨 CanvasManager: メモリクリーンアップ完了');
        }
    }

    // グローバル公開
    window.Tegaki.CanvasManager = CanvasManager;

    console.log('🎨 CanvasManager v8.12.0完全対応版 Loaded - Graphics分離管理・座標変換支援・描画消失問題解決版');

})();