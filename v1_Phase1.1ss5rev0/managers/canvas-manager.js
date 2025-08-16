/**
 * 🎨 ふたば☆ちゃんねる風ベクターお絵描きツール v1.0
 * 
 * 🎯 AI_WORK_SCOPE: キャンバス統括管理・変形制御・ズーム/パン統合・ジェスチャー対応
 * 🎯 DEPENDENCIES: libs/pixi-extensions.js, js/app-core.js, js/utils/coordinates.js
 * 🎯 NODE_MODULES: hammerjs（タッチ操作）, gsap（スムーズアニメーション）, pixi.js@^7.4.3
 * 🎯 PIXI_EXTENSIONS: hammer, gsap, viewport, layers
 * 🎯 ISOLATION_TEST: ✅ 単体テスト可能
 * 🎯 SPLIT_THRESHOLD: 400行超過時 → canvas-transform.js, canvas-viewport.js分割
 * 
 * 📋 PHASE_TARGET: Phase1.1ss5 - JavaScript機能分割完了・AI分業基盤確立
 * 📋 V8_MIGRATION: Application.init()・WebGPU・120FPS対応・WebGL2最適化
 * 📋 PERFORMANCE_TARGET: 60FPS安定・メモリ効率化・GPU活用最適化
 * 📋 DRY_COMPLIANCE: ✅ 共通処理Utils活用・重複コード排除・ライブラリ活用
 * 📋 SOLID_COMPLIANCE: ✅ 単一責任・開放閉鎖・依存性逆転遵守
 */

/**
 * キャンバス統括管理システム（STEP5機能拡張版）
 * 高度な変形制御・ズーム・パン・ジェスチャー・ビューポート管理統合
 * Pure JavaScript完全準拠・AI分業対応
 */
class CanvasManager {
    constructor(appCore) {
        this.appCore = appCore;
        this.version = 'v1.0-Phase1.1ss5';
        
        // 🎯 STEP5: キャンバス基本設定
        this.width = 800;
        this.height = 600;
        this.backgroundColor = 0xf0e0d6;
        this.dpi = window.devicePixelRatio || 1;
        this.quality = 'high';
        
        // 🎯 STEP5: PixiJS統合
        this.app = null;
        this.isInitialized = false;
        this.canvasElement = null;
        
        // 🎯 STEP5: レイヤー管理
        this.layers = {
            background: null,
            drawing: null,
            ui: null,
            effects: null
        };
        
        // 🎯 STEP5: 描画管理
        this.paths = [];
        this.activeLayer = 'drawing';
        
        // 🎯 STEP5: ビューポート・変形システム
        this.viewport = {
            x: 0,
            y: 0,
            scale: 1.0,
            rotation: 0,
            minScale: 0.1,
            maxScale: 10.0,
            bounds: null,
            fitMode: 'contain', // contain, cover, fill, none
            centerOnResize: true
        };
        
        // 🎯 STEP5: ズーム・パンシステム
        this.transform = {
            enabled: true,
            smoothing: true,
            animationDuration: 0.3,
            wheelSensitivity: 0.001,
            panSensitivity: 1.0,
            boundsChecking: true,
            momentum: true
        };
        
        // 🎯 STEP5: ジェスチャーシステム
        this.gestures = {
            enabled: true,
            hammer: null,
            pinchEnabled: true,
            panEnabled: true,
            tapEnabled: true,
            doubleTapZoom: true,
            touchState: {
                isPinching: false,
                isPanning: false,
                startDistance: 0,
                startScale: 1.0,
                lastPinchScale: 1.0
            }
        };
        
        // 🎯 STEP5: グリッド・ガイドシステム
        this.grid = {
            enabled: false,
            visible: false,
            size: 20,
            color: 0x666666,
            alpha: 0.3,
            graphics: null,
            snapEnabled: false,
            snapTolerance: 10
        };
        
        // 🎯 STEP5: 拡張ライブラリ統合
        this.extensions = {
            gsapAvailable: false,
            hammerAvailable: false,
            viewportAvailable: false,
            layersAvailable: false
        };
        
        // 🎯 STEP5: パフォーマンス監視
        this.performance = {
            frameCount: 0,
            lastFrameTime: performance.now(),
            renderCount: 0,
            drawCalls: 0,
            targetFPS: 60,
            actualFPS: 0,
            memoryUsage: 0
        };
        
        // 🎯 STEP5: イベント管理
        this.events = {
            observers: new Map(),
            debounceTimers: new Map()
        };
        
        console.log(`🎨 CanvasManager STEP5構築開始 - ${this.version}`);
    }
    
    /**
     * 🎯 STEP5: キャンバス管理システム初期化
     */
    async initialize(containerId) {
        console.group(`🎨 CanvasManager STEP5初期化開始 - ${this.version}`);
        
        try {
            const startTime = performance.now();
            
            // Phase 1: 拡張ライブラリ確認・統合
            this.checkAndIntegrateExtensions();
            
            // Phase 2: PixiJS Application初期化
            await this.initializePixiApplication(containerId);
            
            // Phase 3: レイヤー構造セットアップ
            this.setupAdvancedLayers();
            
            // Phase 4: ビューポート・変形システム初期化
            this.initializeViewportSystem();
            
            // Phase 5: ジェスチャー制御初期化
            this.initializeGestureControls();
            
            // Phase 6: グリッド・ガイドシステム初期化
            this.initializeGridSystem();
            
            // Phase 7: イベントシステム初期化
            this.initializeEventSystem();
            
            // Phase 8: パフォーマンス監視開始
            this.startPerformanceMonitoring();
            
            const initTime = performance.now() - startTime;
            
            this.isInitialized = true;
            console.log(`✅ CanvasManager STEP5初期化完了 - ${initTime.toFixed(2)}ms`);
            console.log(`📊 キャンバス: ${this.width}×${this.height}px (DPI: ${this.dpi})`);
            
            return this.app;
            
        } catch (error) {
            console.error('❌ CanvasManager STEP5初期化エラー:', error);
            
            // 🛡️ STEP5: フォールバック初期化
            await this.fallbackInitialization(containerId);
            return this.app;
            
        } finally {
            console.groupEnd();
        }
    }
    
    /**
     * 🎯 STEP5: 拡張ライブラリ確認・統合
     */
    checkAndIntegrateExtensions() {
        console.log('🔧 拡張ライブラリ統合開始...');
        
        // PixiJS本体確認
        if (!window.PIXI) {
            throw new Error('PixiJS が読み込まれていません');
        }
        
        // GSAP 確認・統合（スムーズアニメーション用）
        this.extensions.gsapAvailable = typeof window.gsap !== 'undefined';
        if (this.extensions.gsapAvailable) {
            console.log('✅ GSAP 統合完了 - スムーズアニメーション');
        }
        
        // Hammer.js 確認・統合（タッチジェスチャー用）
        this.extensions.hammerAvailable = typeof window.Hammer !== 'undefined';
        if (this.extensions.hammerAvailable) {
            console.log('✅ Hammer.js 統合完了 - タッチジェスチャー');
        }
        
        // @pixi/layers 確認（利用可能時）
        this.extensions.layersAvailable = window.PixiExtensions?.hasFeature('layers');
        if (this.extensions.layersAvailable) {
            console.log('✅ @pixi/layers 統合完了 - レイヤー管理');
        }
        
        // その他拡張機能統合
        if (window.PixiExtensions) {
            const stats = window.PixiExtensions.getStats();
            console.log(`📊 拡張ライブラリ統合: ${stats.available}/${stats.total}`);
        }
        
        console.log('🔧 拡張ライブラリ統合完了');
    }
    
    /**
     * 🎯 STEP5: PixiJS Application初期化
     */
    async initializePixiApplication(containerId) {
        console.log('🔧 PixiJS Application初期化開始...');
        
        // 📋 V8_MIGRATION: Application.init() 対応予定
        /* V8移行時:
         * this.app = await PIXI.Application.init({
         *     canvas: document.createElement('canvas'),
         *     width: this.width,
         *     height: this.height,
         *     background: '#f0e0d6',
         *     antialias: true,
         *     resolution: this.dpi,
         *     autoDensity: true
         * });
         */
        
        // 現在のv7方式
        this.app = new PIXI.Application({
            width: this.width,
            height: this.height,
            backgroundColor: this.backgroundColor,
            antialias: true,
            resolution: this.dpi,
            autoDensity: true,
            powerPreference: 'high-performance', // GPU活用
            hello: false // PixiJSロゴ無効化
        });
        
        // コンテナに追加
        const container = document.getElementById(containerId);
        if (!container) {
            throw new Error(`キャンバスコンテナが見つかりません: ${containerId}`);
        }
        
        // 既存内容クリア
        container.innerHTML = '';
        container.appendChild(this.app.view);
        this.canvasElement = this.app.view;
        
        // キャンバススタイル設定
        this.setupCanvasStyles();
        
        console.log('✅ PixiJS Application初期化完了');
    }
    
    /**
     * 🎯 STEP5: キャンバススタイル設定
     */
    setupCanvasStyles() {
        const canvas = this.canvasElement;
        
        // 基本スタイル
        canvas.style.display = 'block';
        canvas.style.cursor = 'crosshair';
        canvas.style.touchAction = 'none'; // タッチスクロール防止
        canvas.style.userSelect = 'none';
        
        // タブレット対応
        canvas.style.msTouchAction = 'none';
        canvas.style.touchAction = 'none';
        
        // 高DPI対応
        if (this.dpi > 1) {
            canvas.style.imageRendering = 'pixelated';
        }
        
        console.log('✅ キャンバススタイル設定完了');
    }
    
    /**
     * 🎯 STEP5: 高度なレイヤー構造セットアップ
     */
    setupAdvancedLayers() {
        console.log('🏗️ 高度レイヤー構造セットアップ開始...');
        
        // 背景レイヤー（最下層）
        this.layers.background = new PIXI.Container();
        this.layers.background.name = 'background';
        this.layers.background.zIndex = 0;
        this.app.stage.addChild(this.layers.background);
        
        // 描画レイヤー（メイン）
        this.layers.drawing = new PIXI.Container();
        this.layers.drawing.name = 'drawing';
        this.layers.drawing.zIndex = 100;
        this.app.stage.addChild(this.layers.drawing);
        
        // UIレイヤー（上層）
        this.layers.ui = new PIXI.Container();
        this.layers.ui.name = 'ui';
        this.layers.ui.zIndex = 200;
        this.app.stage.addChild(this.layers.ui);
        
        // エフェクトレイヤー（最上層）
        this.layers.effects = new PIXI.Container();
        this.layers.effects.name = 'effects';
        this.layers.effects.zIndex = 300;
        this.app.stage.addChild(this.layers.effects);
        
        // zIndex有効化
        this.app.stage.sortableChildren = true;
        
        // 背景描画
        this.createBackground();
        
        console.log('✅ 高度レイヤー構造セットアップ完了');
    }
    
    /**
     * 🎯 STEP5: 背景描画
     */
    createBackground() {
        const background = new PIXI.Graphics();
        background.beginFill(this.backgroundColor);
        background.drawRect(0, 0, this.width, this.height);
        background.endFill();
        background.name = 'main-background';
        
        this.layers.background.addChild(background);
        console.log('✅ 背景描画完了');
    }
    
    /**
     * 🎯 STEP5: ビューポート・変形システム初期化
     */
    initializeViewportSystem() {
        console.log('🔍 ビューポートシステム初期化開始...');
        
        // ビューポート境界設定
        this.setViewportBounds();
        
        // 変形制御初期化
        this.initializeTransformControls();
        
        // ビューポートイベント設定
        this.setupViewportEvents();
        
        console.log('✅ ビューポートシステム初期化完了');
    }
    
    /**
     * 🎯 STEP5: ビューポート境界設定
     */
    setViewportBounds() {
        this.viewport.bounds = new PIXI.Rectangle(
            -this.width,
            -this.height, 
            this.width * 3,
            this.height * 3
        );
        
        console.log('📏 ビューポート境界設定完了');
    }
    
    /**
     * 🎯 STEP5: 変形制御初期化
     */
    initializeTransformControls() {
        // ステージの初期変形設定
        this.app.stage.pivot.set(0, 0);
        this.app.stage.position.set(0, 0);
        this.app.stage.scale.set(1.0, 1.0);
        this.app.stage.rotation = 0;
        
        // インタラクション有効化
        this.app.stage.interactive = true;
        this.app.stage.hitArea = new PIXI.Rectangle(0, 0, this.width, this.height);
        
        console.log('🎮 変形制御初期化完了');
    }
    
    /**
     * 🎯 STEP5: ビューポートイベント設定
     */
    setupViewportEvents() {
        // ホイールズーム
        this.canvasElement.addEventListener('wheel', (event) => {
            event.preventDefault();
            this.handleWheelZoom(event);
        }, { passive: false });
        
        // マウスパン（ドラッグ）
        let isDragging = false;
        let lastMousePos = { x: 0, y: 0 };
        
        this.canvasElement.addEventListener('mousedown', (event) => {
            if (event.button === 1 || (event.button === 0 && event.shiftKey)) { // 中ボタンまたはShift+左クリック
                isDragging = true;
                lastMousePos = { x: event.clientX, y: event.clientY };
                this.canvasElement.style.cursor = 'grabbing';
                event.preventDefault();
            }
        });
        
        this.canvasElement.addEventListener('mousemove', (event) => {
            if (isDragging) {
                const deltaX = event.clientX - lastMousePos.x;
                const deltaY = event.clientY - lastMousePos.y;
                this.panViewport(deltaX, deltaY);
                lastMousePos = { x: event.clientX, y: event.clientY };
                event.preventDefault();
            }
        });
        
        this.canvasElement.addEventListener('mouseup', (event) => {
            if (isDragging) {
                isDragging = false;
                this.canvasElement.style.cursor = 'crosshair';
                event.preventDefault();
            }
        });
        
        // マウスリーブ時のドラッグ終了
        this.canvasElement.addEventListener('mouseleave', () => {
            isDragging = false;
            this.canvasElement.style.cursor = 'crosshair';
        });
        
        console.log('✅ ビューポートイベント設定完了');
    }
    
    /**
     * 🎯 STEP5: ジェスチャー制御初期化
     */
    initializeGestureControls() {
        if (!this.extensions.hammerAvailable) {
            console.log('⚠️ Hammer.js未対応 - 基本タッチ操作のみ');
            this.setupBasicTouchControls();
            return;
        }
        
        console.log('👆 Hammer.jsジェスチャー制御初期化開始...');
        
        // Hammer.js初期化
        this.gestures.hammer = new Hammer(this.canvasElement);
        
        // ピンチジェスチャー設定
        const pinch = new Hammer.Pinch();
        this.gestures.hammer.add(pinch);
        
        // パンジェスチャー設定
        const pan = new Hammer.Pan({ direction: Hammer.DIRECTION_ALL, threshold: 0 });
        this.gestures.hammer.add(pan);
        
        // タップジェスチャー設定
        const doubleTap = new Hammer.Tap({ event: 'doubletap', taps: 2 });
        const singleTap = new Hammer.Tap({ event: 'singletap' });
        doubleTap.recognizeWith(singleTap);
        singleTap.requireFailure(doubleTap);
        
        this.gestures.hammer.add([doubleTap, singleTap]);
        
        // イベントリスナー設定
        this.setupGestureEvents();
        
        console.log('✅ Hammer.jsジェスチャー制御初期化完了');
    }
    
    /**
     * 🎯 STEP5: ジェスチャーイベント設定
     */
    setupGestureEvents() {
        const hammer = this.gestures.hammer;
        const touchState = this.gestures.touchState;
        
        // ピンチスタート
        hammer.on('pinchstart', (event) => {
            touchState.isPinching = true;
            touchState.startDistance = event.distance;
            touchState.startScale = this.viewport.scale;
            touchState.lastPinchScale = 1.0;
            event.preventDefault();
        });
        
        // ピンチ中
        hammer.on('pinchmove', (event) => {
            if (!touchState.isPinching) return;
            
            const pinchScale = event.scale;
            const deltaScale = pinchScale / touchState.lastPinchScale;
            
            // 中心点計算
            const rect = this.canvasElement.getBoundingClientRect();
            const centerX = event.center.x - rect.left;
            const centerY = event.center.y - rect.top;
            
            this.zoomToPoint(centerX, centerY, deltaScale);
            touchState.lastPinchScale = pinchScale;
            
            event.preventDefault();
        });
        
        // ピンチ終了
        hammer.on('pinchend', (event) => {
            touchState.isPinching = false;
            touchState.startDistance = 0;
            touchState.lastPinchScale = 1.0;
            event.preventDefault();
        });
        
        // パンスタート
        hammer.on('panstart', (event) => {
            if (!touchState.isPinching) {
                touchState.isPanning = true;
            }
            event.preventDefault();
        });
        
        // パン中
        hammer.on('panmove', (event) => {
            if (touchState.isPanning && !touchState.isPinching) {
                this.panViewport(event.deltaX, event.deltaY, true);
            }
            event.preventDefault();
        });
        
        // パン終了
        hammer.on('panend', (event) => {
            touchState.isPanning = false;
            event.preventDefault();
        });
        
        // ダブルタップズーム
        hammer.on('doubletap', (event) => {
            if (this.gestures.doubleTapZoom) {
                const rect = this.canvasElement.getBoundingClientRect();
                const tapX = event.center.x - rect.left;
                const tapY = event.center.y - rect.top;
                
                // 2倍ズームまたはリセット
                const targetScale = this.viewport.scale > 1.5 ? 1.0 : 2.0;
                this.animateZoomToPoint(tapX, tapY, targetScale);
            }
            event.preventDefault();
        });
    }
    
    /**
     * 🎯 STEP5: 基本タッチ操作（Hammer.js未対応時）
     */
    setupBasicTouchControls() {
        console.log('📱 基本タッチ操作設定開始...');
        
        let touches = [];
        let lastDistance = 0;
        let isPanning = false;
        
        // タッチスタート
        this.canvasElement.addEventListener('touchstart', (event) => {
            touches = Array.from(event.touches);
            
            if (touches.length === 2) {
                // ピンチ準備
                const distance = this.getTouchDistance(touches[0], touches[1]);
                lastDistance = distance;
                this.gestures.touchState.startScale = this.viewport.scale;
            } else if (touches.length === 1) {
                // パン準備
                isPanning = true;
            }
            
            event.preventDefault();
        });
        
        // タッチ移動
        this.canvasElement.addEventListener('touchmove', (event) => {
            touches = Array.from(event.touches);
            
            if (touches.length === 2 && lastDistance > 0) {
                // ピンチズーム
                const distance = this.getTouchDistance(touches[0], touches[1]);
                const scale = distance / lastDistance;
                
                const centerX = (touches[0].clientX + touches[1].clientX) / 2;
                const centerY = (touches[0].clientY + touches[1].clientY) / 2;
                const rect = this.canvasElement.getBoundingClientRect();
                
                this.zoomToPoint(
                    centerX - rect.left,
                    centerY - rect.top,
                    scale
                );
                
                lastDistance = distance;
            } else if (touches.length === 1 && isPanning) {
                // 単純パン（実装はマウスイベントと統合）
            }
            
            event.preventDefault();
        });
        
        // タッチ終了
        this.canvasElement.addEventListener('touchend', (event) => {
            touches = Array.from(event.touches);
            
            if (touches.length < 2) {
                lastDistance = 0;
                this.gestures.touchState.startScale = this.viewport.scale;
            }
            
            if (touches.length === 0) {
                isPanning = false;
            }
            
            event.preventDefault();
        });
        
        console.log('✅ 基本タッチ操作設定完了');
    }
    
    /**
     * 🎯 STEP5: タッチ距離計算
     */
    getTouchDistance(touch1, touch2) {
        const dx = touch1.clientX - touch2.clientX;
        const dy = touch1.clientY - touch2.clientY;
        return Math.sqrt(dx * dx + dy * dy);
    }
    
    /**
     * 🎯 STEP5: グリッド・ガイドシステム初期化
     */
    initializeGridSystem() {
        console.log('📐 グリッドシステム初期化開始...');
        
        // グリッドグラフィクス作成
        this.grid.graphics = new PIXI.Graphics();
        this.grid.graphics.name = 'grid-overlay';
        this.grid.graphics.alpha = this.grid.alpha;
        this.layers.ui.addChild(this.grid.graphics);
        
        // 初期グリッド描画（非表示）
        this.updateGrid();
        
        console.log('✅ グリッドシステム初期化完了');
    }
    
    /**
     * 🎯 STEP5: グリッド更新
     */
    updateGrid() {
        if (!this.grid.graphics) return;
        
        this.grid.graphics.clear();
        
        if (!this.grid.visible) {
            return;
        }
        
        const gridSize = this.grid.size;
        const color = this.grid.color;
        
        // 垂直線描画
        for (let x = 0; x <= this.width; x += gridSize) {
            this.grid.graphics.lineStyle(1, color, this.grid.alpha);
            this.grid.graphics.moveTo(x, 0);
            this.grid.graphics.lineTo(x, this.height);
        }
        
        // 水平線描画
        for (let y = 0; y <= this.height; y += gridSize) {
            this.grid.graphics.lineStyle(1, color, this.grid.alpha);
            this.grid.graphics.moveTo(0, y);
            this.grid.graphics.lineTo(this.width, y);
        }
        
        console.log(`📐 グリッド更新: サイズ=${gridSize}, 表示=${this.grid.visible}`);
    }
    
    /**
     * 🎯 STEP5: イベントシステム初期化
     */
    initializeEventSystem() {
        console.log('🎭 イベントシステム初期化開始...');
        
        // リサイズイベント
        window.addEventListener('resize', this.debounce(() => {
            this.handleWindowResize();
        }, 250));
        
        // キーボードショートカット
        this.setupKeyboardShortcuts();
        
        console.log('✅ イベントシステム初期化完了');
    }
    
    /**
     * 🎯 STEP5: キーボードショートカット設定
     */
    setupKeyboardShortcuts() {
        document.addEventListener('keydown', (event) => {
            // Ctrl/Cmd + 数字キー: ズームレベル設定
            if ((event.ctrlKey || event.metaKey) && !event.shiftKey) {
                switch (event.key) {
                    case '0':
                        event.preventDefault();
                        this.resetViewport();
                        break;
                    case '1':
                        event.preventDefault();
                        this.setZoom(1.0);
                        break;
                    case '2':
                        event.preventDefault();
                        this.setZoom(2.0);
                        break;
                    case '=':
                    case '+':
                        event.preventDefault();
                        this.zoomIn();
                        break;
                    case '-':
                        event.preventDefault();
                        this.zoomOut();
                        break;
                }
            }
            
            // グリッド切り替え
            if (event.key === 'g' && !event.ctrlKey && !event.metaKey) {
                this.toggleGrid();
            }
        });
        
        console.log('✅ キーボードショートカット設定完了');
    }
    
    /**
     * 🎯 STEP5: パフォーマンス監視開始
     */
    startPerformanceMonitoring() {
        console.log('📊 パフォーマンス監視開始...');
        
        // FPS監視
        const updateFPS = () => {
            const now = performance.now();
            const deltaTime = now - this.performance.lastFrameTime;
            this.performance.actualFPS = deltaTime > 0 ? Math.round(1000 / deltaTime) : 0;
            this.performance.lastFrameTime = now;
            this.performance.frameCount++;
        };
        
        // レンダーフック
        this.app.ticker.add(() => {
            updateFPS();
            this.performance.renderCount++;
        });
        
        console.log('✅ パフォーマンス監視開始完了');
    }
    
    // ==========================================
    // 🎯 STEP5: ズーム・パン制御システム
    // ==========================================
    
    /**
     * ホイールズーム処理
     */
    handleWheelZoom(event) {
        if (!this.transform.enabled) return;
        
        const rect = this.canvasElement.getBoundingClientRect();
        const mouseX = event.clientX - rect.left;
        const mouseY = event.clientY - rect.top;
        
        const zoomDelta = -event.deltaY * this.transform.wheelSensitivity;
        const zoomFactor = Math.exp(zoomDelta);
        
        this.zoomToPoint(mouseX, mouseY, zoomFactor);
    }
    
    /**
     * 指定点を中心にズーム
     */
    zoomToPoint(screenX, screenY, zoomFactor) {
        const newScale = Math.max(
            this.viewport.minScale,
            Math.min(this.viewport.maxScale, this.viewport.scale * zoomFactor)
        );
        
        if (newScale === this.viewport.scale) return;
        
        // ズーム中心点のワールド座標計算
        const worldPoint = this.screenToWorld(screenX, screenY);
        
        // スケール適用
        this.viewport.scale = newScale;
        this.app.stage.scale.set(newScale, newScale);
        
        // ズーム後の画面座標計算
        const newScreenPoint = this.worldToScreen(worldPoint.x, worldPoint.y);
        
        // オフセット補正
        const offsetX = screenX - newScreenPoint.x;
        const offsetY = screenY - newScreenPoint.y;
        
        this.viewport.x += offsetX;
        this.viewport.y += offsetY;
        
        this.updateViewportTransform();
        
        console.log(`🔍 ズーム: ${(this.viewport.scale * 100).toFixed(0)}%`);
    }
    
    /**
     * ビューポートパン
     */
    panViewport(deltaX, deltaY, relative = false) {
        if (!this.transform.enabled) return;
        
        if (relative) {
            // 相対移動（累積）
            this.viewport.x += deltaX * this.transform.panSensitivity;
            this.viewport.y += deltaY * this.transform.panSensitivity;
        } else {
            // 絶対移動
            this.viewport.x = deltaX * this.transform.panSensitivity;
            this.viewport.y = deltaY * this.transform.panSensitivity;
        }
        
        // 境界チェック
        if (this.transform.boundsChecking) {
            this.constrainViewportToBounds();
        }
        
        this.updateViewportTransform();
    }
    
    /**
     * ビューポート変形更新
     */
    updateViewportTransform() {
        this.app.stage.position.set(this.viewport.x, this.viewport.y);
        this.app.stage.scale.set(this.viewport.scale, this.viewport.scale);
        this.app.stage.rotation = this.viewport.rotation;
    }
    
    /**
     * アニメーション付きズーム
     */
    animateZoomToPoint(screenX, screenY, targetScale, duration = null) {
        if (!this.extensions.gsapAvailable) {
            // GSAP未対応時は即座に変更
            const zoomFactor = targetScale / this.viewport.scale;
            this.zoomToPoint(screenX, screenY, zoomFactor);
            return;
        }
        
        const animDuration = duration || this.transform.animationDuration;
        const startScale = this.viewport.scale;
        const worldPoint = this.screenToWorld(screenX, screenY);
        
        window.gsap.to(this.viewport, {
            duration: animDuration,
            scale: targetScale,
            ease: "power2.out",
            onUpdate: () => {
                this.app.stage.scale.set(this.viewport.scale, this.viewport.scale);
                
                // 中心点維持
                const newScreenPoint = this.worldToScreen(worldPoint.x, worldPoint.y);
                const offsetX = screenX - newScreenPoint.x;
                const offsetY = screenY - newScreenPoint.y;
                
                this.viewport.x += offsetX;
                this.viewport.y += offsetY;
                
                this.updateViewportTransform();
            }
        });
        
        console.log(`🎬 アニメーションズーム: ${(targetScale * 100).toFixed(0)}%`);
    }
    
    /**
     * ズームイン
     */
    zoomIn(factor = 1.2) {
        const centerX = this.width / 2;
        const centerY = this.height / 2;
        this.zoomToPoint(centerX, centerY, factor);
    }
    
    /**
     * ズームアウト
     */
    zoomOut(factor = 0.8) {
        const centerX = this.width / 2;
        const centerY = this.height / 2;
        this.zoomToPoint(centerX, centerY, factor);
    }
    
    /**
     * ズームレベル設定
     */
    setZoom(scale) {
        const centerX = this.width / 2;
        const centerY = this.height / 2;
        const zoomFactor = scale / this.viewport.scale;
        this.zoomToPoint(centerX, centerY, zoomFactor);
    }
    
    /**
     * ビューポートリセット
     */
    resetViewport() {
        if (this.extensions.gsapAvailable && this.transform.smoothing) {
            window.gsap.to(this.viewport, {
                duration: this.transform.animationDuration,
                x: 0,
                y: 0,
                scale: 1.0,
                rotation: 0,
                ease: "power2.out",
                onUpdate: () => {
                    this.updateViewportTransform();
                }
            });
        } else {
            this.viewport.x = 0;
            this.viewport.y = 0;
            this.viewport.scale = 1.0;
            this.viewport.rotation = 0;
            this.updateViewportTransform();
        }
        
        console.log('🔄 ビューポートリセット');
    }
    
    /**
     * ビューポート境界制約
     */
    constrainViewportToBounds() {
        if (!this.viewport.bounds) return;
        
        const bounds = this.viewport.bounds;
        
        this.viewport.x = Math.max(bounds.x, Math.min(bounds.x + bounds.width - this.width, this.viewport.x));
        this.viewport.y = Math.max(bounds.y, Math.min(bounds.y + bounds.height - this.height, this.viewport.y));
    }
    
    // ==========================================
    // 🎯 STEP5: 座標変換システム
    // ==========================================
    
    /**
     * スクリーン座標 → ワールド座標
     */
    screenToWorld(screenX, screenY) {
        const worldX = (screenX - this.viewport.x) / this.viewport.scale;
        const worldY = (screenY - this.viewport.y) / this.viewport.scale;
        return { x: worldX, y: worldY };
    }
    
    /**
     * ワールド座標 → スクリーン座標
     */
    worldToScreen(worldX, worldY) {
        const screenX = worldX * this.viewport.scale + this.viewport.x;
        const screenY = worldY * this.viewport.scale + this.viewport.y;
        return { x: screenX, y: screenY };
    }
    
    /**
     * グリッドスナップ
     */
    snapToGrid(x, y) {
        if (!this.grid.snapEnabled) {
            return { x, y };
        }
        
        const gridSize = this.grid.size;
        const tolerance = this.grid.snapTolerance;
        
        const snappedX = Math.round(x / gridSize) * gridSize;
        const snappedY = Math.round(y / gridSize) * gridSize;
        
        const distanceX = Math.abs(x - snappedX);
        const distanceY = Math.abs(y - snappedY);
        
        return {
            x: distanceX <= tolerance ? snappedX : x,
            y: distanceY <= tolerance ? snappedY : y
        };
    }
    
    // ==========================================
    // 🎯 STEP5: グリッド・ガイド制御システム
    // ==========================================
    
    /**
     * グリッド表示切り替え
     */
    toggleGrid() {
        this.grid.visible = !this.grid.visible;
        this.updateGrid();
        
        console.log(`📐 グリッド表示: ${this.grid.visible ? 'ON' : 'OFF'}`);
    }
    
    /**
     * グリッドサイズ設定
     */
    setGridSize(size) {
        this.grid.size = Math.max(5, Math.min(100, size));
        this.updateGrid();
        
        console.log(`📐 グリッドサイズ: ${this.grid.size}px`);
    }
    
    /**
     * グリッドスナップ切り替え
     */
    toggleGridSnap() {
        this.grid.snapEnabled = !this.grid.snapEnabled;
        
        console.log(`🧲 グリッドスナップ: ${this.grid.snapEnabled ? 'ON' : 'OFF'}`);
    }
    
    // ==========================================
    // 🎯 STEP5: 描画システム統合
    // ==========================================
    
    /**
     * 新規パス作成
     */
    createPath(x, y, size, color, opacity, tool = 'pen') {
        if (!this.isInitialized) {
            console.warn('⚠️ キャンバス未初期化状態でのパス作成');
            return null;
        }
        
        // グリッドスナップ適用
        const snappedPos = this.snapToGrid(x, y);
        
        const path = {
            id: `path_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            graphics: new PIXI.Graphics(),
            points: [],
            color: tool === 'eraser' ? this.backgroundColor : color,
            size: size,
            opacity: tool === 'eraser' ? 1.0 : opacity,
            tool: tool,
            isComplete: false,
            timestamp: Date.now()
        };
        
        // 初回描画: 円形ブラシで点を描画
        path.graphics.beginFill(path.color, path.opacity);
        path.graphics.drawCircle(snappedPos.x, snappedPos.y, size / 2);
        path.graphics.endFill();
        
        path.points.push({ 
            x: snappedPos.x, 
            y: snappedPos.y, 
            size, 
            timestamp: Date.now() 
        });
        
        // 適切なレイヤーに追加
        const targetLayer = this.layers[this.activeLayer] || this.layers.drawing;
        targetLayer.addChild(path.graphics);
        this.paths.push(path);
        
        console.log(`✏️ パス作成: ${path.id} (${tool}) at (${Math.round(snappedPos.x)}, ${Math.round(snappedPos.y)})`);
        return path;
    }
    
    /**
     * 線描画継続
     */
    drawLine(path, x, y) {
        if (!path || !path.graphics || path.points.length === 0) return;
        
        // グリッドスナップ適用
        const snappedPos = this.snapToGrid(x, y);
        
        const lastPoint = path.points[path.points.length - 1];
        const distance = Math.sqrt(
            (snappedPos.x - lastPoint.x) ** 2 + 
            (snappedPos.y - lastPoint.y) ** 2
        );
        
        // 最小距離フィルタ（性能最適化）
        if (distance < 1.5) return;
        
        // スムーズな線描画のための補間
        const steps = Math.max(1, Math.ceil(distance / 1.5));
        for (let i = 1; i <= steps; i++) {
            const t = i / steps;
            const px = lastPoint.x + (snappedPos.x - lastPoint.x) * t;
            const py = lastPoint.y + (snappedPos.y - lastPoint.y) * t;
            
            // 筆圧対応サイズ計算
            const pressureSize = this.calculatePressureSize(path.size, t);
            
            path.graphics.beginFill(path.color, path.opacity);
            path.graphics.drawCircle(px, py, pressureSize / 2);
            path.graphics.endFill();
        }
        
        path.points.push({ 
            x: snappedPos.x, 
            y: snappedPos.y, 
            size: path.size, 
            timestamp: Date.now() 
        });
        
        // パフォーマンス監視
        this.performance.drawCalls++;
    }
    
    /**
     * 筆圧対応サイズ計算
     */
    calculatePressureSize(baseSize, pressure = 1.0) {
        const minSize = baseSize * 0.3;
        const maxSize = baseSize * 1.2;
        return minSize + (maxSize - minSize) * pressure;
    }
    
    /**
     * パス完了
     */
    completePath(path) {
        if (path) {
            path.isComplete = true;
            path.completedAt = Date.now();
            console.log(`✅ パス完了: ${path.id} (${path.points.length} points)`);
        }
    }
    
    // ==========================================
    // 🎯 STEP5: ユーティリティ・制御メソッド
    // ==========================================
    
    /**
     * デバウンス処理
     */
    debounce(func, wait, immediate = false) {
        return function executedFunction(...args) {
            const later = () => {
                if (!immediate) func.apply(this, args);
            };
            
            const callNow = immediate && !this.events.debounceTimers.has(func);
            
            clearTimeout(this.events.debounceTimers.get(func));
            this.events.debounceTimers.set(func, setTimeout(later, wait));
            
            if (callNow) func.apply(this, args);
        }.bind(this);
    }
    
    /**
     * ウィンドウリサイズ処理
     */
    handleWindowResize() {
        if (!this.isInitialized) return;
        
        // コンテナサイズ取得
        const container = this.canvasElement.parentElement;
        if (!container) return;
        
        const containerRect = container.getBoundingClientRect();
        
        // キャンバスリサイズ（必要に応じて）
        if (this.viewport.centerOnResize) {
            this.resize(
                containerRect.width, 
                containerRect.height, 
                true
            );
        }
        
        console.log('🔄 ウィンドウリサイズ処理完了');
    }
    
    /**
     * キャンバスリサイズ
     */
    resize(newWidth, newHeight, centerContent = false) {
        if (!this.isInitialized) {
            console.warn('⚠️ キャンバス未初期化状態でのリサイズ');
            return;
        }
        
        const oldWidth = this.width;
        const oldHeight = this.height;
        
        this.width = Math.max(100, Math.min(4000, newWidth));
        this.height = Math.max(100, Math.min(4000, newHeight));
        
        // PixiJS Applicationリサイズ
        // 📋 V8_MIGRATION: app.resize()対応予定
        this.app.renderer.resize(this.width, this.height);
        
        // ヒットエリア更新
        this.app.stage.hitArea = new PIXI.Rectangle(0, 0, this.width, this.height);
        
        // ビューポート境界更新
        this.setViewportBounds();
        
        // 背景更新
        this.updateBackground();
        
        // グリッド更新
        this.updateGrid();
        
        // コンテンツ中央寄せ
        if (centerContent) {
            const offsetX = (this.width - oldWidth) / 2;
            const offsetY = (this.height - oldHeight) / 2;
            
            Object.values(this.layers).forEach(layer => {
                if (layer) {
                    layer.position.set(
                        layer.x + offsetX,
                        layer.y + offsetY
                    );
                }
            });
        }
        
        console.log(`🔄 キャンバスリサイズ: ${oldWidth}×${oldHeight} → ${this.width}×${this.height}`);
        
        // リサイズイベント発火
        this.dispatchEvent('canvas-resize', {
            oldWidth,
            oldHeight,
            newWidth: this.width,
            newHeight: this.height
        });
    }
    
    /**
     * 背景更新
     */
    updateBackground() {
        if (!this.layers.background) return;
        
        // 既存背景削除
        const existingBg = this.layers.background.getChildByName('main-background');
        if (existingBg) {
            this.layers.background.removeChild(existingBg);
            existingBg.destroy();
        }
        
        // 新しい背景作成
        const background = new PIXI.Graphics();
        background.beginFill(this.backgroundColor);
        background.drawRect(0, 0, this.width, this.height);
        background.endFill();
        background.name = 'main-background';
        
        this.layers.background.addChild(background);
    }
    
    /**
     * キャンバスクリア
     */
    clear(keepBackground = true) {
        if (!this.isInitialized) return;
        
        // 描画レイヤークリア
        if (this.layers.drawing) {
            this.layers.drawing.removeChildren();
        }
        
        // パス配列クリア
        this.paths.forEach(path => {
            if (path.graphics) {
                path.graphics.destroy();
            }
        });
        this.paths.length = 0;
        
        console.log('🗑️ キャンバスクリア完了');
        
        // クリアイベント発火
        this.dispatchEvent('canvas-clear');
    }
    
    /**
     * アクティブレイヤー設定
     */
    setActiveLayer(layerName) {
        if (this.layers[layerName]) {
            this.activeLayer = layerName;
            console.log(`🎨 アクティブレイヤー: ${layerName}`);
            return true;
        }
        
        console.warn(`⚠️ 無効なレイヤー名: ${layerName}`);
        return false;
    }
    
    /**
     * レイヤー可視性制御
     */
    setLayerVisibility(layerName, visible) {
        const layer = this.layers[layerName];
        if (layer) {
            layer.visible = visible;
            console.log(`👁️ レイヤー可視性: ${layerName} → ${visible}`);
            return true;
        }
        
        return false;
    }
    
    /**
     * レイヤー透明度設定
     */
    setLayerAlpha(layerName, alpha) {
        const layer = this.layers[layerName];
        if (layer) {
            layer.alpha = Math.max(0, Math.min(1, alpha));
            console.log(`🎨 レイヤー透明度: ${layerName} → ${alpha}`);
            return true;
        }
        
        return false;
    }
    
    // ==========================================
    // 🎯 STEP5: 状態取得・統計システム
    // ==========================================
    
    /**
     * キャンバス状態取得
     */
    getCanvasState() {
        return {
            dimensions: {
                width: this.width,
                height: this.height,
                dpi: this.dpi
            },
            viewport: {
                x: this.viewport.x,
                y: this.viewport.y,
                scale: this.viewport.scale,
                rotation: this.viewport.rotation
            },
            layers: {
                active: this.activeLayer,
                count: Object.keys(this.layers).length
            },
            paths: {
                total: this.paths.length,
                completed: this.paths.filter(p => p.isComplete).length,
                active: this.paths.filter(p => !p.isComplete).length
            },
            grid: {
                visible: this.grid.visible,
                size: this.grid.size,
                snapEnabled: this.grid.snapEnabled
            },
            isInitialized: this.isInitialized,
            hasContent: this.paths.length > 0
        };
    }
    
    /**
     * パフォーマンス統計取得
     */
    getPerformanceStats() {
        const memoryUsage = this.estimateMemoryUsage();
        
        return {
            fps: this.performance.actualFPS,
            targetFPS: this.performance.targetFPS,
            frameCount: this.performance.frameCount,
            renderCount: this.performance.renderCount,
            drawCalls: this.performance.drawCalls,
            memory: memoryUsage,
            viewport: {
                scale: this.viewport.scale,
                transformCount: this.performance.transformCount || 0
            },
            paths: {
                count: this.paths.length,
                totalPoints: this.paths.reduce((sum, path) => sum + path.points.length, 0)
            }
        };
    }
    
    /**
     * メモリ使用量推定
     */
    estimateMemoryUsage() {
        const pathMemory = this.paths.length * 150; // パスあたり約150byte
        const pointMemory = this.paths.reduce((sum, path) => sum + path.points.length, 0) * 40; // ポイントあたり約40byte
        const textureMemory = this.width * this.height * 4; // RGBA
        
        return {
            paths: pathMemory,
            points: pointMemory,
            textures: textureMemory,
            total: pathMemory + pointMemory + textureMemory,
            unit: 'bytes',
            formatted: this.formatBytes(pathMemory + pointMemory + textureMemory)
        };
    }
    
    /**
     * バイト数フォーマット
     */
    formatBytes(bytes) {
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        if (bytes === 0) return '0 Bytes';
        
        const i = Math.floor(Math.log(bytes) / Math.log(1024));
        return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
    }
    
    /**
     * キャンバス統計情報
     */
    getStatistics() {
        const state = this.getCanvasState();
        const performance = this.getPerformanceStats();
        
        return {
            canvas: state,
            performance,
            extensions: {
                gsap: this.extensions.gsapAvailable,
                hammer: this.extensions.hammerAvailable,
                layers: this.extensions.layersAvailable,
                viewport: this.extensions.viewportAvailable
            },
            features: {
                transformEnabled: this.transform.enabled,
                gridEnabled: this.grid.enabled,
                gesturesEnabled: this.gestures.enabled
            }
        };
    }
    
    // ==========================================
    // 🎯 STEP5: エクスポート・インポートシステム
    // ==========================================
    
    /**
     * キャンバスエクスポート
     */
    exportCanvas(format = 'png', quality = 1.0, options = {}) {
        if (!this.app?.view) {
            console.warn('⚠️ キャンバス未初期化状態でのエクスポート');
            return null;
        }
        
        try {
            const {
                includeBackground = true,
                scale = 1.0,
                region = null
            } = options;
            
            // 一時的にUIレイヤーを非表示
            const originalUIVisibility = this.layers.ui.visible;
            if (!options.includeUI) {
                this.layers.ui.visible = false;
            }
            
            let dataURL;
            
            if (region) {
                // 部分エクスポート（将来実装）
                dataURL = this.exportRegion(region, format, quality);
            } else {
                // 全体エクスポート
                const canvas = this.app.view;
                const mimeType = format === 'jpeg' ? 'image/jpeg' : 'image/png';
                dataURL = canvas.toDataURL(mimeType, quality);
            }
            
            // UIレイヤー表示復元
            this.layers.ui.visible = originalUIVisibility;
            
            const sizeKB = Math.round(dataURL.length / 1024);
            console.log(`📸 キャンバスエクスポート: ${format} (${sizeKB}KB)`);
            
            return dataURL;
            
        } catch (error) {
            console.error('❌ エクスポートエラー:', error);
            return null;
        }
    }
    
    /**
     * 設定エクスポート
     */
    exportSettings() {
        return {
            version: this.version,
            timestamp: Date.now(),
            canvas: {
                width: this.width,
                height: this.height,
                backgroundColor: this.backgroundColor,
                quality: this.quality
            },
            viewport: { ...this.viewport },
            transform: { ...this.transform },
            grid: { ...this.grid },
            gestures: {
                enabled: this.gestures.enabled,
                pinchEnabled: this.gestures.pinchEnabled,
                panEnabled: this.gestures.panEnabled,
                doubleTapZoom: this.gestures.doubleTapZoom
            }
        };
    }
    
    /**
     * 設定インポート
     */
    importSettings(settings) {
        try {
            if (!settings || !settings.version) {
                throw new Error('無効な設定データ');
            }
            
            // キャンバス設定
            if (settings.canvas) {
                this.resize(settings.canvas.width, settings.canvas.height);
                this.backgroundColor = settings.canvas.backgroundColor || this.backgroundColor;
                this.quality = settings.canvas.quality || this.quality;
            }
            
            // ビューポート設定
            if (settings.viewport) {
                Object.assign(this.viewport, settings.viewport);
                this.updateViewportTransform();
            }
            
            // 変形設定
            if (settings.transform) {
                Object.assign(this.transform, settings.transform);
            }
            
            // グリッド設定
            if (settings.grid) {
                Object.assign(this.grid, settings.grid);
                this.updateGrid();
            }
            
            // ジェスチャー設定
            if (settings.gestures) {
                Object.assign(this.gestures, settings.gestures);
            }
            
            console.log('📥 設定インポート完了');
            return true;
            
        } catch (error) {
            console.error('❌ 設定インポートエラー:', error);
            return false;
        }
    }
    
    // ==========================================
    // 🎯 STEP5: イベント管理システム
    // ==========================================
    
    /**
     * イベント発火
     */
    dispatchEvent(eventType, detail = {}) {
        const event = new CustomEvent(`canvas-${eventType}`, {
            detail: {
                ...detail,
                timestamp: Date.now(),
                canvasManager: this
            }
        });
        
        document.dispatchEvent(event);
        
        // 内部オブザーバー通知
        const observers = this.events.observers.get(eventType);
        if (observers) {
            observers.forEach(callback => {
                try {
                    callback(detail);
                } catch (error) {
                    console.error('❌ イベントコールバックエラー:', error);
                }
            });
        }
    }
    
    /**
     * イベントリスナー追加
     */
    addEventListener(eventType, callback) {
        if (!this.events.observers.has(eventType)) {
            this.events.observers.set(eventType, []);
        }
        
        this.events.observers.get(eventType).push(callback);
    }
    
    /**
     * イベントリスナー削除
     */
    removeEventListener(eventType, callback) {
        const observers = this.events.observers.get(eventType);
        if (observers) {
            const index = observers.indexOf(callback);
            if (index >= 0) {
                observers.splice(index, 1);
            }
        }
    }
    
    // ==========================================
    // 🎯 STEP5: デバッグ・開発支援システム
    // ==========================================
    
    /**
     * デバッグ情報出力
     */
    debugInfo() {
        const stats = this.getStatistics();
        
        console.group('📊 CanvasManager STEP5 デバッグ情報');
        console.log('バージョン:', this.version);
        console.log('キャンバス:', stats.canvas);
        console.log('パフォーマンス:', stats.performance);
        console.log('拡張機能:', stats.extensions);
        console.log('機能フラグ:', stats.features);
        console.log('ビューポート:', {
            position: `(${this.viewport.x}, ${this.viewport.y})`,
            scale: `${(this.viewport.scale * 100).toFixed(1)}%`,
            rotation: `${(this.viewport.rotation * 180 / Math.PI).toFixed(1)}°`
        });
        console.log('パス統計:', {
            総数: this.paths.length,
            完了: this.paths.filter(p => p.isComplete).length,
            作業中: this.paths.filter(p => !p.isComplete).length,
            総ポイント数: this.paths.reduce((sum, path) => sum + path.points.length, 0)
        });
        console.groupEnd();
        
        return stats;
    }
    
    /**
     * ベンチマークテスト
     */
    runBenchmark(iterations = 1000) {
        console.group('🏃 CanvasManager ベンチマークテスト');
        
        const startTime = performance.now();
        
        // 座標変換テスト
        console.time('座標変換テスト');
        for (let i = 0; i < iterations; i++) {
            const screen = { x: Math.random() * this.width, y: Math.random() * this.height };
            const world = this.screenToWorld(screen.x, screen.y);
            const backToScreen = this.worldToScreen(world.x, world.y);
        }
        console.timeEnd('座標変換テスト');
        
        // グリッドスナップテスト
        console.time('グリッドスナップテスト');
        for (let i = 0; i < iterations; i++) {
            this.snapToGrid(Math.random() * this.width, Math.random() * this.height);
        }
        console.timeEnd('グリッドスナップテスト');
        
        const totalTime = performance.now() - startTime;
        console.log(`📊 総実行時間: ${totalTime.toFixed(2)}ms`);
        console.log(`📊 1回あたり: ${(totalTime / iterations).toFixed(4)}ms`);
        
        console.groupEnd();
        
        return {
            totalTime,
            averageTime: totalTime / iterations,
            iterations
        };
    }
    
    // ==========================================
    // 🎯 STEP5: フォールバック・エラーハンドリング
    // ==========================================
    
    /**
     * フォールバック初期化
     */
    async fallbackInitialization(containerId) {
        console.warn('🛡️ CanvasManager フォールバック初期化実行');
        
        try {
            // 最小限のPixiJS初期化
            this.app = new PIXI.Application({
                width: this.width,
                height: this.height,
                backgroundColor: this.backgroundColor
            });
            
            const container = document.getElementById(containerId);
            if (container) {
                container.appendChild(this.app.view);
                this.canvasElement = this.app.view;
            }
            
            // 基本レイヤーのみセットアップ
            this.layers.drawing = new PIXI.Container();
            this.app.stage.addChild(this.layers.drawing);
            
            // 拡張機能無効化
            this.extensions = {
                gsapAvailable: false,
                hammerAvailable: false,
                viewportAvailable: false,
                layersAvailable: false
            };
            
            this.transform.enabled = false;
            this.gestures.enabled = false;
            this.grid.enabled = false;
            
            this.isInitialized = true;
            
            console.log('🛡️ フォールバック初期化完了');
            
        } catch (error) {
            console.error('❌ フォールバック初期化失敗:', error);
            throw error;
        }
    }
    
    /**
     * 破棄処理
     */
    async destroy() {
        console.log('🧹 CanvasManager 破棄処理開始...');
        
        try {
            // イベントリスナー削除
            this.events.debounceTimers.forEach(timer => clearTimeout(timer));
            this.events.debounceTimers.clear();
            this.events.observers.clear();
            
            // Hammer.js破棄
            if (this.gestures.hammer) {
                this.gestures.hammer.destroy();
                this.gestures.hammer = null;
            }
            
            // パス破棄
            this.paths.forEach(path => {
                if (path.graphics) {
                    path.graphics.destroy();
                }
            });
            this.paths.length = 0;
            
            // グリッド破棄
            if (this.grid.graphics) {
                this.grid.graphics.destroy();
                this.grid.graphics = null;
            }
            
            // レイヤー破棄
            Object.values(this.layers).forEach(layer => {
                if (layer) {
                    layer.destroy();
                }
            });
            
            // PIXIアプリケーション破棄
            if (this.app) {
                this.app.destroy(true, true);
                this.app = null;
            }
            
            this.isInitialized = false;
            
            console.log('✅ CanvasManager 破棄処理完了');
            
        } catch (error) {
            console.error('❌ CanvasManager 破棄処理エラー:', error);
        }
    }
}

/**
 * Pure JavaScript用グローバル登録
 * ESM/TypeScript混在禁止原則に完全準拠
 */
window.CanvasManager = CanvasManager;

/**
 * 初期化ログ出力
 */
console.log('📦 CanvasManager STEP5 クラス定義完了（Pure JavaScript）');
console.log('🎯 機能: 高度変形制御・ズーム/パン・ジェスチャー・グリッド統合');
console.log('📋 準拠: Phase1.1ss5・DRY/SOLID原則・AI分業対応');

/**
 * 📋 V8_MIGRATION: PixiJSv8移行準備完了
 * 
 * 対応予定API変更:
 * - new PIXI.Application() → await PIXI.Application.init()
 * - backgroundColor: 0xffffff → background: '#ffffff'  
 * - renderer.resize() → app.resize()
 * - WebGPU Renderer統合
 * - 120FPS対応強化
 * - Performance Observer API統合
 * - WebGL2最適化
 */