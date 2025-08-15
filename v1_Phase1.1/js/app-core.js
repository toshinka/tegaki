/**
 * 🎨 ふたば☆ちゃんねる風ベクターお絵描きツール v1.0
 * 🎯 AI_WORK_SCOPE: PixiJS Application管理・基盤システム提供・拡張機能統合
 * 🎯 DEPENDENCIES: libs/pixi-extensions.js, js/utils/coordinates.js, js/utils/performance.js
 * 🎯 NODE_MODULES: pixi.js@^7.4.3, @pixi/ui, @pixi/layers, @pixi/gif
 * 🎯 PIXI_EXTENSIONS: Application基盤・レイヤーシステム・UI統合
 * 🎯 ISOLATION_TEST: 可能（PixiExtensions依存）
 * 🎯 SPLIT_THRESHOLD: 400行（基盤システム・分割は慎重に）
 * 📋 PHASE_TARGET: Phase1
 * 📋 V8_MIGRATION: new PIXI.Application() → await PIXI.Application.init()
 */

/**
 * PixiJS基盤システム - アプリケーションコア
 * 元HTMLのDrawingEngineを基にした改良版
 */
class AppCore {
    constructor() {
        this.app = null;
        this.drawingContainer = null;
        this.uiContainer = null;
        this.paths = [];
        this.currentTool = 'pen';
        this.isDrawing = false;
        
        // 描画設定（元HTML互換）
        this.canvasWidth = 400;
        this.canvasHeight = 400;
        this.backgroundColor = 0xf0e0d6; // ふたばクリーム
        
        // ツールシステム設定
        this.toolSystem = {
            brushSize: 16.0,
            brushColor: 0x800000, // ふたばマルーン
            opacity: 0.85,
            pressure: 0.5,
            smoothing: 0.3
        };
        
        console.log('🎯 AppCore 構築開始...');
    }
    
    /**
     * アプリケーションコア初期化
     */
    async init() {
        console.group('🎯 PixiJS基盤システム初期化');
        
        try {
            // Step1: PixiJS Application作成
            await this.createPixiApplication();
            
            // Step2: 拡張機能統合
            this.integrateExtensions();
            
            // Step3: コンテナ構造構築
            this.setupContainers();
            
            // Step4: 基本システム初期化
            this.setupBasicSystems();
            
            // Step5: UI統合準備
            this.prepareUIIntegration();
            
            console.log('✅ PixiJS基盤システム初期化完了');
            
        } catch (error) {
            console.error('❌ PixiJS基盤システム初期化エラー:', error);
            throw error;
        } finally {
            console.groupEnd();
        }
        
        return this;
    }
    
    /**
     * PixiJS Application作成
     */
    async createPixiApplication() {
        console.log('🖼️ PixiJS Application作成中...');
        
        const appOptions = {
            width: this.canvasWidth,
            height: this.canvasHeight,
            backgroundColor: this.backgroundColor,
            antialias: true,
            resolution: 1, // 元HTML互換: 固定値
            autoDensity: false // 元HTML互換: 無効化
        };
        
        // 📋 V8_MIGRATION: v8移行時の変更予定
        if (PIXI.VERSION.startsWith('7')) {
            // v7 方式
            this.app = new PIXI.Application(appOptions);
            console.log('✅ PixiJS v7 Application作成完了');
        } else {
            // v8 方式（Phase4で実装予定）
            // this.app = await PIXI.Application.init(appOptions);
            // console.log('✅ PixiJS v8 Application作成完了');
            console.error('❌ PixiJS v8は Phase4 で対応予定');
        }
        
        // DOM統合
        const canvasElement = document.getElementById('drawing-canvas');
        if (canvasElement) {
            canvasElement.appendChild(this.app.view);
            console.log('✅ キャンバスDOM統合完了');
        } else {
            throw new Error('drawing-canvas 要素が見つかりません');
        }
        
        // Canvas情報更新
        this.updateCanvasInfo();
    }
    
    /**
     * 拡張機能統合
     */
    integrateExtensions() {
        console.log('🔧 拡張機能統合中...');
        
        if (!window.PixiExtensions) {
            console.warn('⚠️ PixiExtensions が利用できません');
            return;
        }
        
        // レイヤーシステム統合
        if (window.PixiExtensions.hasFeature('layers')) {
            this.setupAdvancedLayers();
            console.log('📝 @pixi/layers 統合完了');
        } else {
            console.log('📝 基本コンテナ使用（レイヤーなし）');
        }
        
        // UI拡張統合
        if (window.PixiExtensions.hasFeature('ui')) {
            console.log('🎨 @pixi/ui 統合準備完了');
        }
        
        // GSAP統合
        if (window.PixiExtensions.hasFeature('gsap')) {
            console.log('🎭 GSAP 統合準備完了');
        }
    }
    
    /**
     * 高度なレイヤーシステム設定
     */
    setupAdvancedLayers() {
        try {
            // @pixi/layers使用
            const backgroundLayer = window.PixiExtensions.createAdvancedLayer({
                zIndex: 0,
                sorted: true
            });
            backgroundLayer.name = 'background';
            
            const drawingLayer = window.PixiExtensions.createAdvancedLayer({
                zIndex: 1,
                sorted: true
            });
            drawingLayer.name = 'drawing';
            
            const uiLayer = window.PixiExtensions.createAdvancedLayer({
                zIndex: 2,
                sorted: true
            });
            uiLayer.name = 'ui';
            
            this.app.stage.addChild(backgroundLayer);
            this.app.stage.addChild(drawingLayer);
            this.app.stage.addChild(uiLayer);
            
            this.drawingContainer = drawingLayer;
            this.uiContainer = uiLayer;
            
        } catch (error) {
            console.warn('⚠️ 高度レイヤー設定失敗、基本コンテナに切り替え:', error);
            this.setupBasicContainers();
        }
    }
    
    /**
     * コンテナ構造構築
     */
    setupContainers() {
        if (!this.drawingContainer) {
            this.setupBasicContainers();
        }
        
        // インタラクティブ設定
        this.app.stage.interactive = true;
        this.app.stage.hitArea = new PIXI.Rectangle(0, 0, this.canvasWidth, this.canvasHeight);
        
        console.log('📦 コンテナ構造構築完了');
    }
    
    /**
     * 基本コンテナ設定（フォールバック）
     */
    setupBasicContainers() {
        this.drawingContainer = new PIXI.Container();
        this.drawingContainer.name = 'drawing';
        this.drawingContainer.sortableChildren = true;
        
        this.uiContainer = new PIXI.Container();
        this.uiContainer.name = 'ui';
        this.uiContainer.sortableChildren = true;
        
        this.app.stage.addChild(this.drawingContainer);
        this.app.stage.addChild(this.uiContainer);
        
        console.log('📦 基本コンテナ設定完了（フォールバック）');
    }
    
    /**
     * 基本システム初期化
     */
    setupBasicSystems() {
        // イベントシステム初期化
        this.setupEventSystem();
        
        // パフォーマンス監視初期化
        this.setupPerformanceMonitoring();
        
        // 座標系初期化
        this.setupCoordinateSystem();
        
        console.log('⚙️ 基本システム初期化完了');
    }
    
    /**
     * イベントシステム設定
     */
    setupEventSystem() {
        // 元HTMLのイベント処理を統合
        this.app.stage.on('pointerdown', (event) => this.handlePointerDown(event));
        this.app.stage.on('pointermove', (event) => this.handlePointerMove(event));
        this.app.stage.on('pointerup', (event) => this.handlePointerUp(event));
        this.app.stage.on('pointerupoutside', (event) => this.handlePointerUp(event));
        
        console.log('🖱️ イベントシステム設定完了');
    }
    
    /**
     * パフォーマンス監視設定
     */
    setupPerformanceMonitoring() {
        // FPS監視
        let frameCount = 0;
        let lastTime = performance.now();
        
        const updateFPS = () => {
            frameCount++;
            const currentTime = performance.now();
            
            if (currentTime - lastTime >= 1000) {
                const fps = Math.round((frameCount * 1000) / (currentTime - lastTime));
                const fpsElement = document.getElementById('fps');
                if (fpsElement) {
                    fpsElement.textContent = fps;
                }
                
                frameCount = 0;
                lastTime = currentTime;
            }
            
            requestAnimationFrame(updateFPS);
        };
        
        updateFPS();
        console.log('📊 パフォーマンス監視設定完了');
    }
    
    /**
     * 座標系設定
     */
    setupCoordinateSystem() {
        // 座標変換ヘルパー（元HTML互換）
        this.getLocalPointerPosition = (event) => {
            const rect = this.app.view.getBoundingClientRect();
            const originalEvent = event.data.originalEvent;
            const x = (originalEvent.clientX - rect.left) * (this.canvasWidth / rect.width);
            const y = (originalEvent.clientY - rect.top) * (this.canvasHeight / rect.height);
            return { x, y };
        };
        
        console.log('📐 座標系設定完了');
    }
    
    /**
     * UI統合準備
     */
    prepareUIIntegration() {
        // 将来のUI統合用のフック
        this.uiHooks = {
            onToolChange: [],
            onBrushSizeChange: [],
            onOpacityChange: []
        };
        
        console.log('🎨 UI統合準備完了');
    }
    
    /**
     * 描画パス作成（元HTML互換）
     */
    createPath(x, y, size, color, opacity, tool = 'pen') {
        const path = {
            id: `path_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            graphics: new PIXI.Graphics(),
            points: [],
            color: tool === 'eraser' ? this.backgroundColor : color,
            size: size,
            opacity: tool === 'eraser' ? 1.0 : opacity,
            tool: tool,
            isComplete: false
        };
        
        // 初回描画: 円形ブラシ（元HTML互換）
        path.graphics.beginFill(path.color, path.opacity);
        path.graphics.drawCircle(x, y, size / 2);
        path.graphics.endFill();
        
        path.points.push({ x, y, size });
        
        this.drawingContainer.addChild(path.graphics);
        this.paths.push(path);
        return path;
    }
    
    /**
     * 線描画（元HTML互換）
     */
    drawLine(path, x, y) {
        if (!path || path.points.length === 0) return;
        
        const lastPoint = path.points[path.points.length - 1];
        const distance = Math.sqrt((x - lastPoint.x) ** 2 + (y - lastPoint.y) ** 2);
        
        // 最小距離フィルタ
        if (distance < 1.5) return;
        
        // 連続する円形で線を描画（元HTML互換）
        const steps = Math.max(1, Math.ceil(distance / 1.5));
        for (let i = 1; i <= steps; i++) {
            const t = i / steps;
            const px = lastPoint.x + (x - lastPoint.x) * t;
            const py = lastPoint.y + (y - lastPoint.y) * t;
            
            path.graphics.beginFill(path.color, path.opacity);
            path.graphics.drawCircle(px, py, path.size / 2);
            path.graphics.endFill();
        }
        
        path.points.push({ x, y, size: path.size });
    }
    
    /**
     * ポインター押下処理
     */
    handlePointerDown(event) {
        const point = this.getLocalPointerPosition(event);
        
        this.isDrawing = true;
        this.currentPath = this.createPath(
            point.x, point.y, 
            this.toolSystem.brushSize, 
            this.toolSystem.brushColor, 
            this.toolSystem.opacity, 
            this.currentTool
        );
    }
    
    /**
     * ポインター移動処理
     */
    handlePointerMove(event) {
        const point = this.getLocalPointerPosition(event);
        
        // 座標表示更新
        const coordsElement = document.getElementById('coordinates');
        if (coordsElement) {
            coordsElement.textContent = `x: ${Math.round(point.x)}, y: ${Math.round(point.y)}`;
        }
        
        // 描画処理
        if (this.isDrawing && this.currentPath) {
            this.drawLine(this.currentPath, point.x, point.y);
            
            // 筆圧モニター更新
            const pressureElement = document.getElementById('pressure-monitor');
            if (pressureElement) {
                const pressure = Math.min(100, this.toolSystem.pressure * 100 + Math.random() * 20);
                pressureElement.textContent = pressure.toFixed(1) + '%';
            }
        }
    }
    
    /**
     * ポインター離上処理
     */
    handlePointerUp(event) {
        if (this.currentPath) {
            this.currentPath.isComplete = true;
        }
        
        this.isDrawing = false;
        this.currentPath = null;
        
        // 筆圧モニターリセット
        const pressureElement = document.getElementById('pressure-monitor');
        if (pressureElement) {
            pressureElement.textContent = '0.0%';
        }
    }
    
    /**
     * キャンバスリサイズ
     */
    resize(newWidth, newHeight, centerContent = false) {
        const oldWidth = this.canvasWidth;
        const oldHeight = this.canvasHeight;
        
        this.canvasWidth = newWidth;
        this.canvasHeight = newHeight;
        
        // PixiJS Application リサイズ
        this.app.renderer.resize(newWidth, newHeight);
        this.app.stage.hitArea = new PIXI.Rectangle(0, 0, newWidth, newHeight);
        
        // コンテンツ中央寄せ
        if (centerContent && this.paths.length > 0) {
            const offsetX = (newWidth - oldWidth) / 2;
            const offsetY = (newHeight - oldHeight) / 2;
            
            this.paths.forEach(path => {
                path.graphics.x += offsetX;
                path.graphics.y += offsetY;
            });
        }
        
        this.updateCanvasInfo();
        console.log(`📏 キャンバスリサイズ: ${newWidth}×${newHeight}px`);
    }
    
    /**
     * キャンバス情報更新
     */
    updateCanvasInfo() {
        const canvasInfoElement = document.getElementById('canvas-info');
        if (canvasInfoElement) {
            canvasInfoElement.textContent = `${this.canvasWidth}×${this.canvasHeight}px`;
        }
    }
    
    /**
     * キャンバスクリア
     */
    clear() {
        this.paths.forEach(path => {
            this.drawingContainer.removeChild(path.graphics);
            path.graphics.destroy();
        });
        this.paths = [];
        console.log('🧹 キャンバスクリア完了');
    }
    
    /**
     * ツール設定更新
     */
    updateToolSettings(settings) {
        Object.assign(this.toolSystem, settings);
        console.log('🔧 ツール設定更新:', settings);
    }
    
    /**
     * アプリケーション状態取得
     */
    getStatus() {
        return {
            initialized: !!this.app,
            canvasSize: { width: this.canvasWidth, height: this.canvasHeight },
            currentTool: this.currentTool,
            pathCount: this.paths.length,
            isDrawing: this.isDrawing,
            toolSettings: { ...this.toolSystem },
            pixiVersion: PIXI.VERSION,
            extensions: window.PixiExtensions ? window.PixiExtensions.getStats() : null
        };
    }
}

// グローバル公開（main.jsからアクセス可能）
if (typeof window !== 'undefined') {
    window.AppCore = AppCore;
    console.log('✅ AppCore グローバル公開完了');
}

console.log('🎯 AppCore 準備完了 - PixiJS基盤システム');
console.log('💡 使用例: const appCore = new AppCore(); await appCore.init();');