/**
 * PixiJS統一レンダラー v3.2
 * PixiJS単一エンジン統一による干渉問題完全根絶
 * 規約: 総合AIコーディング規約v4.1準拠（PixiJS統一座標対応）
 */

import * as PIXI from 'pixi.js';

/**
 * PixiJS統一レンダラー - 全描画処理統一管理
 * OGL・Konva.js完全排除・単一Canvas・PixiJS統一制御
 */
export class PixiUnifiedRenderer {
    constructor(canvas, eventStore) {
        this.canvas = canvas;
        this.eventStore = eventStore;
        this.app = null;
        
        // PixiJS統一レイヤー管理
        this.layers = {
            background: null,
            drawing: null,
            ui: null,
            debug: null
        };
        
        // レンダリング設定
        this.config = {
            backgroundColor: 0xffffee, // ふたば背景色
            antialias: true,
            autoDensity: true,
            resolution: window.devicePixelRatio || 1,
            powerPreference: 'high-performance',
            hello: false // PixiJS起動メッセージ無効
        };
        
        // パフォーマンス監視
        this.performance = {
            fps: 0,
            lastFrame: Date.now(),
            frameCount: 0,
            averageFPS: 60,
            renderTime: 0
        };
        
        // Phase段階対応フラグ
        this.phase1Ready = false;
        
        // 🎨 Phase2: ツール連携（封印中）
        // this.toolProcessor = null;        // 🔒Phase2解封
        // this.colorProcessor = null;       // 🔒Phase2解封
        // this.layerProcessor = null;       // 🔒Phase2解封
        
        // ⚡ Phase3: Chrome API連携（封印中）
        // this.offscreenProcessor = null;   // 🔒Phase3解封
        // this.modernExporter = null;       // 🔒Phase3解封
        
        this.isReady = false;
    }
    
    /**
     * PixiJS統一アプリケーション初期化
     */
    async initialize() {
        try {
            console.log('🎨 PixiJS統一レンダラー初期化開始');
            
            // PixiJS Application作成（単一インスタンス）
            this.app = new PIXI.Application({
                view: this.canvas,
                width: this.canvas.width,
                height: this.canvas.height,
                ...this.config
            });
            
            // グローバル参照設定（デバッグ用）
            if (process.env.NODE_ENV === 'development') {
                window.__PIXI_APP__ = this.app;
            }
            
            // PixiJS統一レイヤー構築
            this.setupUnifiedLayers();
            
            // パフォーマンス監視開始
            this.setupPerformanceMonitoring();
            
            // イベント連携設定
            this.setupEventIntegration();
            
            // リサイズ対応設定
            this.setupResizeHandling();
            
            this.phase1Ready = true;
            this.isReady = true;
            
            console.log('✅ PixiJS統一レンダラー初期化完了');
            this.logRendererInfo();
            
        } catch (error) {
            console.error('❌ PixiJS統一レンダラー初期化エラー:', error);
            throw error;
        }
    }
    
    /**
     * PixiJS統一レイヤー構築
     */
    setupUnifiedLayers() {
        // 背景レイヤー（PixiJS Container）
        this.layers.background = new PIXI.Container();
        this.layers.background.name = 'background';
        this.layers.background.zIndex = 0;
        
        // 描画レイヤー（PixiJS Container）
        this.layers.drawing = new PIXI.Container();
        this.layers.drawing.name = 'drawing';
        this.layers.drawing.zIndex = 10;
        
        // UIレイヤー（PixiJS Container）
        this.layers.ui = new PIXI.Container();
        this.layers.ui.name = 'ui';
        this.layers.ui.zIndex = 20;
        
        // デバッグレイヤー（開発時のみ）
        if (process.env.NODE_ENV === 'development') {
            this.layers.debug = new PIXI.Container();
            this.layers.debug.name = 'debug';
            this.layers.debug.zIndex = 30;
        }
        
        // PixiJS Stage統一管理
        this.app.stage.addChild(
            this.layers.background,
            this.layers.drawing,
            this.layers.ui
        );
        
        if (this.layers.debug) {
            this.app.stage.addChild(this.layers.debug);
        }
        
        // zIndex有効化
        this.app.stage.sortableChildren = true;
        
        console.log('🎨 PixiJS統一レイヤー構築完了');
    }
    
    /**
     * パフォーマンス監視設定
     */
    setupPerformanceMonitoring() {
        // PixiJS Ticker活用FPS監視
        this.app.ticker.add(() => {
            this.updatePerformanceStats();
        });
        
        // 定期パフォーマンスレポート
        this.performanceInterval = setInterval(() => {
            this.logPerformanceStats();
        }, 10000); // 10秒間隔
        
        console.log('⚡ PixiJS パフォーマンス監視開始');
    }
    
    /**
     * パフォーマンス統計更新
     */
    updatePerformanceStats() {
        const now = Date.now();
        const deltaTime = now - this.performance.lastFrame;
        
        this.performance.frameCount++;
        this.performance.lastFrame = now;
        
        // FPS計算
        if (deltaTime > 0) {
            this.performance.fps = 1000 / deltaTime;
            
            // 平均FPS更新（移動平均）
            this.performance.averageFPS = 
                (this.performance.averageFPS * 0.95) + (this.performance.fps * 0.05);
        }
        
        // レンダリング時間測定
        const renderStart = performance.now();
        // レンダリング処理は既にPixiJSが実行
        this.performance.renderTime = performance.now() - renderStart;
    }
    
    /**
     * イベント連携設定
     */
    setupEventIntegration() {
        // ポインターイベント統一処理
        this.app.stage.interactive = true;
        this.app.stage.hitArea = new PIXI.Rectangle(0, 0, this.canvas.width, this.canvas.height);
        
        // PixiJS → EventStore 連携
        this.app.stage.on('pointerdown', (event) => {
            this.eventStore.emit('input:pointer:down', {
                pixi: event.data.getLocalPosition(this.app.stage),
                global: event.data.global,
                pressure: event.data.pressure || 1.0,
                pointerType: event.data.pointerType || 'mouse'
            });
        });
        
        this.app.stage.on('pointermove', (event) => {
            this.eventStore.emit('input:pointer:move', {
                pixi: event.data.getLocalPosition(this.app.stage),
                global: event.data.global,
                pressure: event.data.pressure || 1.0,
                pointerType: event.data.pointerType || 'mouse'
            });
        });
        
        this.app.stage.on('pointerup', (event) => {
            this.eventStore.emit('input:pointer:up', {
                pixi: event.data.getLocalPosition(this.app.stage),
                global: event.data.global,
                pressure: event.data.pressure || 1.0,
                pointerType: event.data.pointerType || 'mouse'
            });
        });
        
        // EventStore → PixiJS 描画連携
        this.eventStore.on('draw:stroke', (data) => {
            this.drawStroke(data);
        });
        
        this.eventStore.on('draw:clear', (data) => {
            this.clearDrawing(data);
        });
        
        console.log('📡 PixiJS - EventStore 連携設定完了');
    }
    
    /**
     * リサイズ処理設定
     */
    setupResizeHandling() {
        // ResizeObserver活用（モダンAPI）
        if (window.ResizeObserver) {
            this.resizeObserver = new ResizeObserver((entries) => {
                this.handleResize();
            });
            this.resizeObserver.observe(this.canvas);
        } else {
            // フォールバック
            window.addEventListener('resize', () => {
                this.handleResize();
            });
        }
    }
    
    /**
     * PixiJS統一描画処理
     */
    drawStroke(strokeData) {
        try {
            const { points, tool, color, size, opacity } = strokeData;
            
            if (!points || points.length === 0) {
                return null;
            }
            
            // PixiJS Graphics統一描画
            const graphics = new PIXI.Graphics();
            
            // 高品質線描画設定
            graphics.lineStyle({
                width: size || 2,
                color: color || 0x800000,
                alpha: opacity || 1.0,
                cap: PIXI.LINE_CAP.ROUND,
                join: PIXI.LINE_JOIN.ROUND,
                native: true // GPU最適化
            });
            
            // PixiJS自然座標系描画（変換不要）
            if (points.length === 1) {
                // 単点描画
                graphics.drawCircle(points[0].x, points[0].y, (size || 2) / 2);
            } else {
                // スムーズ曲線描画
                graphics.moveTo(points[0].x, points[0].y);
                
                for (let i = 1; i < points.length - 1; i++) {
                    const xc = (points[i].x + points[i + 1].x) / 2;
                    const yc = (points[i].y + points[i + 1].y) / 2;
                    graphics.quadraticCurveTo(points[i].x, points[i].y, xc, yc);
                }
                
                if (points.length > 1) {
                    const last = points[points.length - 1];
                    graphics.lineTo(last.x, last.y);
                }
            }
            
            // 描画レイヤーに追加
            this.layers.drawing.addChild(graphics);
            
            // 描画完了イベント発信
            this.eventStore.emit('draw:stroke:complete', {
                graphics: graphics,
                strokeData: strokeData,
                timestamp: Date.now()
            });
            
            return graphics;
            
        } catch (error) {
            console.error('❌ PixiJS描画エラー:', error);
            return null;
        }
    }
    
    /**
     * 描画クリア処理
     */
    clearDrawing(clearData = {}) {
        try {
            if (clearData.layer === 'all' || !clearData.layer) {
                // 全描画クリア
                this.layers.drawing.removeChildren();
                console.log('🎨 PixiJS全描画クリア完了');
            } else if (clearData.graphics) {
                // 特定Graphics削除
                this.layers.drawing.removeChild(clearData.graphics);
                clearData.graphics.destroy();
            }
            
            this.eventStore.emit('draw:clear:complete', {
                cleared: clearData,
                timestamp: Date.now()
            });
            
        } catch (error) {
            console.error('❌ PixiJS描画クリアエラー:', error);
        }
    }
    
    /**
     * UI要素描画（PixiJS Text/Sprite統一）
     */
    drawUIElement(element) {
        try {
            let uiElement = null;
            
            if (element.type === 'text') {
                uiElement = new PIXI.Text(element.text, {
                    fontFamily: element.fontFamily || 'Arial, sans-serif',
                    fontSize: element.fontSize || 12,
                    fill: element.color || 0x800000,
                    stroke: element.strokeColor || 0xffffff,
                    strokeThickness: element.strokeWidth || 0
                });
            } else if (element.type === 'sprite') {
                uiElement = PIXI.Sprite.from(element.texture);
                if (element.tint) {
                    uiElement.tint = element.tint;
                }
            } else if (element.type === 'graphics') {
                uiElement = new PIXI.Graphics();
                if (element.drawFunction) {
                    element.drawFunction(uiElement);
                }
            }
            
            if (uiElement) {
                uiElement.x = element.x || 0;
                uiElement.y = element.y || 0;
                if (element.alpha !== undefined) {
                    uiElement.alpha = element.alpha;
                }
                
                this.layers.ui.addChild(uiElement);
                
                return uiElement;
            }
            
        } catch (error) {
            console.error('❌ PixiJS UI描画エラー:', error);
            return null;
        }
    }
    
    /**
     * リサイズ処理
     */
    handleResize() {
        try {
            const rect = this.canvas.getBoundingClientRect();
            const width = rect.width;
            const height = rect.height;
            
            // PixiJS統一リサイズ
            this.app.renderer.resize(width, height);
            
            // レイヤーhitArea更新
            this.app.stage.hitArea = new PIXI.Rectangle(0, 0, width, height);
            
            // EventStore通知
            this.eventStore.emit('viewport:resize', {
                width: width,
                height: height,
                pixiNative: true
            });
            
            console.log(`🎨 PixiJS統一リサイズ: ${width}x${height}`);
            
        } catch (error) {
            console.error('❌ PixiJS リサイズエラー:', error);
        }
    }
    
    /**
     * レイヤー管理（PixiJS Container活用）
     */
    createLayer(layerId, parentLayerId = 'drawing') {
        try {
            const layer = new PIXI.Container();
            layer.name = layerId;
            
            const parentLayer = this.layers[parentLayerId] || this.layers.drawing;
            parentLayer.addChild(layer);
            
            console.log(`🎨 PixiJSレイヤー作成: ${layerId}`);
            return layer;
            
        } catch (error) {
            console.error('❌ PixiJS レイヤー作成エラー:', error);
            return null;
        }
    }
    
    /**
     * レイヤー検索
     */
    findLayer(layerId) {
        const searchInContainer = (container) => {
            if (container.name === layerId) {
                return container;
            }
            
            for (const child of container.children) {
                if (child instanceof PIXI.Container) {
                    const found = searchInContainer(child);
                    if (found) return found;
                }
            }
            
            return null;
        };
        
        return searchInContainer(this.app.stage);
    }
    
    /**
     * 🎨 Phase2連携準備（封印中）
     */
    /*
    connectToolProcessor(toolProcessor) {        // 🔒Phase2解封
        this.toolProcessor = toolProcessor;
        this.toolProcessor.setRenderer(this);
        console.log('🎨 ToolProcessor連携完了');
    }
    
    connectColorProcessor(colorProcessor) {      // 🔒Phase2解封
        this.colorProcessor = colorProcessor;
        this.colorProcessor.setRenderer(this);
        console.log('🎨 ColorProcessor連携完了');
    }
    
    connectLayerProcessor(layerProcessor) {      // 🔒Phase2解封
        this.layerProcessor = layerProcessor;
        this.layerProcessor.setRenderer(this);
        console.log('🎨 LayerProcessor連携完了');
    }
    */
    
    /**
     * ⚡ Phase3連携準備（封印中）
     */
    /*
    initializeOffscreenProcessing() {            // 🔒Phase3解封
        this.offscreenProcessor = new PixiOffscreenProcessor(this);
        return this.offscreenProcessor;
    }
    
    initializeModernExporter() {                 // 🔒Phase3解封
        this.modernExporter = new PixiModernExporter(this);
        return this.modernExporter;
    }
    */
    
    /**
     * パフォーマンス統計ログ出力
     */
    logPerformanceStats() {
        if (process.env.NODE_ENV === 'development') {
            console.log('⚡ PixiJS パフォーマンス統計:', {
                fps: Math.round(this.performance.fps),
                averageFPS: Math.round(this.performance.averageFPS),
                frameCount: this.performance.frameCount,
                renderTime: Math.round(this.performance.renderTime * 100) / 100
            });
        }
    }
    
    /**
     * レンダラー情報ログ出力
     */
    logRendererInfo() {
        const info = this.getInfo();
        console.log('🎨 PixiJS統一レンダラー情報:', info);
    }
    
    /**
     * システム情報取得
     */
    getInfo() {
        return {
            type: this.app.renderer.type === PIXI.RENDERER_TYPE.WEBGL ? 'WebGL' : 'Canvas',
            version: PIXI.VERSION,
            resolution: this.app.renderer.resolution,
            backgroundColor: this.config.backgroundColor,
            size: {
                width: this.app.view.width,
                height: this.app.view.height
            },
            layers: Object.keys(this.layers).length,
            phase1Ready: this.phase1Ready,
            unified: true,
            pixiNative: true
        };
    }
    
    /**
     * パフォーマンス情報取得
     */
    getPerformanceInfo() {
        return {
            fps: Math.round(this.performance.fps),
            averageFPS: Math.round(this.performance.averageFPS),
            frameCount: this.performance.frameCount,
            renderTime: this.performance.renderTime,
            memoryUsage: this.getMemoryUsage()
        };
    }
    
    /**
     * メモリ使用量取得
     */
    getMemoryUsage() {
        if (performance.memory) {
            return {
                used: Math.round(performance.memory.usedJSHeapSize / 1024 / 1024),
                total: Math.round(performance.memory.totalJSHeapSize / 1024 / 1024),
                limit: Math.round(performance.memory.jsHeapSizeLimit / 1024 / 1024)
            };
        }
        return null;
    }
    
    /**
     * 準備状態確認
     */
    isReady() {
        return this.isReady && this.app && this.app.renderer;
    }
    
    /**
     * デバッグ表示切り替え
     */
    toggleDebugLayer() {
        if (this.layers.debug) {
            this.layers.debug.visible = !this.layers.debug.visible;
            console.log(`🔍 PixiJS デバッグレイヤー: ${this.layers.debug.visible ? '表示' : '非表示'}`);
        }
    }
    
    /**
     * 破棄処理
     */
    destroy() {
        try {
            // パフォーマンス監視停止
            if (this.performanceInterval) {
                clearInterval(this.performanceInterval);
            }
            
            // ResizeObserver停止
            if (this.resizeObserver) {
                this.resizeObserver.disconnect();
            }
            
            // PixiJS Application破棄
            if (this.app) {
                this.app.destroy(true, {
                    children: true,
                    texture: true,
                    baseTexture: true
                });
            }
            
            console.log('🎨 PixiJS統一レンダラー破棄完了');
            
        } catch (error) {
            console.error('❌ PixiJS レンダラー破棄エラー:', error);
        }
    }
}