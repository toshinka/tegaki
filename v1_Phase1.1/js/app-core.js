/**
 * 🎨 アプリケーションコア - PixiJS基盤管理
 * 🎯 AI_WORK_SCOPE: PixiJS初期化・基盤管理・Viewport統合
 * 🎯 DEPENDENCIES: main.js
 * 🎯 CDN_USAGE: PIXI, pixi-viewport, pixi-filters
 * 🎯 ISOLATION_TEST: ✅ 単体テスト可能
 * 🎯 SPLIT_THRESHOLD: 300行超過時 → pixi-renderer.js分割
 * 
 * 📋 PHASE_TARGET: Phase1基盤
 * 📋 V8_MIGRATION: PIXI.Application.init()対応予定
 * 📋 PERFORMANCE_TARGET: 60FPS安定・120FPS準備
 */

export class AppCore {
    constructor() {
        this.app = null;
        this.viewport = null;
        this.drawingContainer = null;
        this.backgroundContainer = null;
        
        // 📋 Phase2準備: レイヤーシステム用
        this.layerManager = null;
        this.layers = new Map();
        
        // 📋 Phase3準備: アニメーション用
        this.animationManager = null;
        this.timeline = null;
        
        // パフォーマンス監視
        this.fpsCounter = 0;
        this.lastFPSUpdate = performance.now();
        
        // 設定
        this.settings = {
            width: 400,
            height: 400,
            backgroundColor: 0xf0e0d6, // ふたば色
            resolution: 1, // 📋 V8_MIGRATION: devicePixelRatio対応改善予定
            antialias: true,
            // 📋 V8_FEATURE: WebGPU準備
            preferWebGPU: false // Phase4で有効化
        };
    }

    /**
     * PixiJS初期化・基盤構築
     */
    async init() {
        console.log('🔧 AppCore初期化開始');
        
        try {
            // PixiJS Application作成
            await this.createPixiApplication();
            console.log('✅ PixiJS Application作成完了');

            // Viewport統合（pixi-viewport活用）
            await this.setupViewport();
            console.log('✅ Viewport統合完了');

            // 描画コンテナ構築
            this.setupDrawingContainers();
            console.log('✅ 描画コンテナ構築完了');

            // DOM統合
            this.integrateDOMElements();
            console.log('✅ DOM統合完了');

            // フィルター・エフェクト準備
            this.setupFiltersAndEffects();
            console.log('✅ フィルター・エフェクト準備完了');

            // パフォーマンス監視開始
            this.startPerformanceMonitoring();
            console.log('✅ パフォーマンス監視開始');

            // 📋 Phase2準備確認
            this.checkPhase2Readiness();
            
            console.log('🎉 AppCore初期化完了');
            
        } catch (error) {
            console.error('❌ AppCore初期化エラー:', error);
            throw error;
        }
    }

    /**
     * PixiJS Application作成
     * 📋 V8_MIGRATION: PIXI.Application.init()対応予定
     */
    async createPixiApplication() {
        // V7用設定
        const appOptions = {
            width: this.settings.width,
            height: this.settings.height,
            backgroundColor: this.settings.backgroundColor,
            resolution: this.settings.resolution,
            antialias: this.settings.antialias,
            // 📋 V8_MIGRATION: 以下オプション名変更予定
            // backgroundColor → background: '#f0e0d6'
            // resolution → resolution (同名継続)
            preserveDrawingBuffer: true // エクスポート用
        };

        // 📋 V8_MIGRATION: 将来の初期化方式
        if (PIXI.VERSION.startsWith('8')) {
            // V8モード（Phase4で有効化）
            // this.app = new PIXI.Application();
            // await this.app.init({
            //     ...appOptions,
            //     preference: this.settings.preferWebGPU ? 'webgpu' : 'webgl'
            // });
        } else {
            // V7モード（現在）
            this.app = new PIXI.Application(appOptions);
        }

        // レンダラー最適化
        this.optimizeRenderer();
    }

    /**
     * レンダラー最適化設定
     */
    optimizeRenderer() {
        const renderer = this.app.renderer;
        
        // バッチ処理最適化
        renderer.plugins.batch.size = 8192; // バッチサイズ増加
        
        // 📋 V8_FEATURE: WebGPU最適化準備
        if (renderer.type === PIXI.RENDERER_TYPE.WEBGPU) {
            // WebGPU用最適化（Phase4）
            console.log('📋 WebGPU Renderer検出（Phase4機能）');
        } else if (renderer.type === PIXI.RENDERER_TYPE.WEBGL) {
            // WebGL最適化
            const gl = renderer.gl;
            gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
        }

        // FPS設定
        this.app.ticker.maxFPS = 60; // Phase1-3: 60FPS
        // 📋 Phase4: this.app.ticker.maxFPS = 120; // 120FPS対応
    }

    /**
     * Viewport統合（pixi-viewport活用）
     */
    async setupViewport() {
        if (!window.Viewport) {
            console.warn('⚠️ pixi-viewport未読み込み - 基本キャンバス操作のみ');
            return;
        }

        // Viewport作成
        this.viewport = new Viewport({
            screenWidth: this.settings.width,
            screenHeight: this.settings.height,
            worldWidth: 4000,  // 大きなキャンバス
            worldHeight: 4000,
            interaction: this.app.renderer.plugins.interaction,
            // 📋 V8_MIGRATION: interaction → events
            // events: this.app.renderer.events
        });

        // 操作機能有効化
        this.viewport
            .drag({
                mouseButtons: 'middle-right' // 中ボタン・右ボタンドラッグ
            })
            .pinch() // ピンチズーム
            .wheel() // ホイールズーム
            .decelerate(); // 慣性

        // ズーム制限
        this.viewport.setZoom(1, true);
        this.viewport.clampZoom({
            minScale: 0.1,
            maxScale: 10
        });

        // Appに統合
        this.app.stage.addChild(this.viewport);
        console.log('✅ pixi-viewport統合完了');
    }

    /**
     * 描画コンテナ構築
     */
    setupDrawingContainers() {
        const target = this.viewport || this.app.stage;

        // 背景コンテナ
        this.backgroundContainer = new PIXI.Container();
        this.backgroundContainer.name = 'background';
        target.addChild(this.backgroundContainer);

        // 描画コンテナ
        this.drawingContainer = new PIXI.Container();
        this.drawingContainer.name = 'drawing';
        target.addChild(this.drawingContainer);

        // グリッド表示（オプション）
        this.createGrid();

        console.log('✅ 描画コンテナ構築完了');
    }

    /**
     * グリッド表示作成
     */
    createGrid() {
        const grid = new PIXI.Graphics();
        const gridSize = 20;
        const gridColor = 0xe9c2ba; // ふたば薄色
        const gridAlpha = 0.3;

        grid.lineStyle(1, gridColor, gridAlpha);

        // 縦線
        for (let x = 0; x <= 4000; x += gridSize) {
            grid.moveTo(x, 0);
            grid.lineTo(x, 4000);
        }

        // 横線
        for (let y = 0; y <= 4000; y += gridSize) {
            grid.moveTo(0, y);
            grid.lineTo(4000, y);
        }

        this.backgroundContainer.addChild(grid);
        grid.visible = false; // デフォルトは非表示
        this.grid = grid;
    }

    /**
     * DOM要素統合
     */
    integrateDOMElements() {
        const canvasContainer = document.getElementById('canvas-container');
        if (canvasContainer) {
            // 既存canvasがあれば削除
            const existingCanvas = canvasContainer.querySelector('canvas');
            if (existingCanvas) {
                existingCanvas.remove();
            }
            
            // PixiJSキャンバスを追加
            canvasContainer.appendChild(this.app.view);
            
            // キャンバススタイル調整
            this.app.view.style.display = 'block';
            this.app.view.style.cursor = 'crosshair';
            
            console.log('✅ DOM統合完了');
        } else {
            console.error('❌ canvas-container要素が見つかりません');
        }
    }

    /**
     * フィルター・エフェクト準備
     */
    setupFiltersAndEffects() {
        if (!window.PIXI || !PIXI.filters) {
            console.warn('⚠️ pixi-filters未読み込み - 高度エフェクトは利用できません');
            return;
        }

        // 利用可能フィルター確認
        this.availableFilters = {
            blur: PIXI.filters.BlurFilter,
            alphaFilter: PIXI.filters.AlphaFilter,
            colorMatrix: PIXI.filters.ColorMatrixFilter,
            // 📋 Phase3: アニメーション用フィルター
            // glow: PIXI.filters.GlowFilter,
            // outline: PIXI.filters.OutlineFilter
        };

        console.log('✅ フィルター・エフェクト準備完了:', Object.keys(this.availableFilters));
    }

    /**
     * パフォーマンス監視開始
     */
    startPerformanceMonitoring() {
        this.app.ticker.add(() => {
            this.fpsCounter++;
            
            const now = performance.now();
            if (now - this.lastFPSUpdate >= 1000) {
                const fps = Math.round((this.fpsCounter * 1000) / (now - this.lastFPSUpdate));
                
                // FPS表示更新
                const fpsElement = document.getElementById('fps');
                if (fpsElement) {
                    fpsElement.textContent = fps;
                }

                // メモリ使用量監視
                if (performance.memory) {
                    const memoryMB = Math.round(performance.memory.usedJSHeapSize / 1024 / 1024);
                    const memoryElement = document.getElementById('memory-usage');
                    if (memoryElement) {
                        memoryElement.textContent = memoryMB + 'MB';
                    }
                }

                this.fpsCounter = 0;
                this.lastFPSUpdate = now;
            }
        });
    }

    /**
     * Phase2準備確認（レイヤーシステム）
     */
    checkPhase2Readiness() {
        // @pixi/layers確認
        if (window.PIXI && PIXI.layers) {
            console.log('📋 Phase2準備: @pixi/layers 利用可能');
            // 📋 Phase2でLayer, Group機能実装予定
            this.layersReady = true;
        } else {
            console.log('📋 Phase2準備: @pixi/layers Phase2で有効化予定');
            this.layersReady = false;
        }

        // レイヤー基盤準備
        this.layers.set('background', this.backgroundContainer);
        this.layers.set('drawing', this.drawingContainer);
    }

    /**
     * キャンバスサイズ変更
     */
    resizeCanvas(width, height, centerContent = false) {
        const oldWidth = this.settings.width;
        const oldHeight = this.settings.height;

        // 設定更新
        this.settings.width = width;
        this.settings.height = height;

        // PixiJS Appリサイズ
        this.app.renderer.resize(width, height);

        // Viewportリサイズ
        if (this.viewport) {
            this.viewport.resize(width, height);
            
            // コンテンツ中央寄せ
            if (centerContent) {
                const offsetX = (width - oldWidth) / 2;
                const offsetY = (height - oldHeight) / 2;
                
                this.drawingContainer.position.x += offsetX;
                this.drawingContainer.position.y += offsetY;
            }
        }

        console.log(`🔄 キャンバスリサイズ: ${width}x${height}`);
    }

    /**
     * ウィンドウリサイズ対応
     */
    handleResize() {
        const canvasContainer = document.getElementById('canvas-container');
        if (!canvasContainer) return;

        const containerRect = canvasContainer.getBoundingClientRect();
        const maxWidth = containerRect.width - 40; // マージン考慮
        const maxHeight = containerRect.height - 40;

        // キャンバスサイズが画面を超える場合の調整
        if (this.settings.width > maxWidth || this.settings.height > maxHeight) {
            const scale = Math.min(maxWidth / this.settings.width, maxHeight / this.settings.height);
            this.app.view.style.transform = `scale(${scale})`;
        } else {
            this.app.view.style.transform = 'scale(1)';
        }
    }

    /**
     * 描画パス作成（ツール用）
     */
    createPath(options = {}) {
        const path = new PIXI.Graphics();
        
        // 描画設定適用
        if (options.strokeColor !== undefined) {
            path.lineStyle(
                options.strokeWidth || 2,
                options.strokeColor || 0x800000,
                options.strokeAlpha || 1
            );
        }

        if (options.fillColor !== undefined) {
            path.beginFill(options.fillColor, options.fillAlpha || 1);
        }

        // 描画コンテナに追加
        this.drawingContainer.addChild(path);
        
        return path;
    }

    /**
     * 全描画クリア
     */
    clearDrawing() {
        this.drawingContainer.removeChildren();
        console.log('🗑️ 描画クリア完了');
    }

    /**
     * グリッド表示切り替え
     */
    toggleGrid() {
        if (this.grid) {
            this.grid.visible = !this.grid.visible;
            console.log(`🔲 グリッド表示: ${this.grid.visible ? 'ON' : 'OFF'}`);
        }
    }

    /**
     * リソース解放
     */
    destroy() {
        if (this.app) {
            this.app.destroy(true, {
                children: true,
                texture: true,
                baseTexture: true
            });
        }
        
        console.log('🗑️ AppCore リソース解放完了');
    }
}

/**
 * 📋 V8移行用互換性ヘルパー（Phase4）
 */
export class V8Compatibility {
    static async createApplication(options) {
        if (PIXI.VERSION.startsWith('8')) {
            // V8モード
            const app = new PIXI.Application();
            await app.init({
                ...options,
                preference: options.preferWebGPU ? 'webgpu' : 'webgl'
            });
            return app;
        } else {
            // V7モード
            return new PIXI.Application(options);
        }
    }
}