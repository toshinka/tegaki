/**
 * 🎨 ふたば☆ちゃんねる風ベクターお絵描きツール v1.0
 * 🎯 ライブラリ活用最適化版 - DRY・SOLID原則適用
 * 
 * 🎯 AI_WORK_SCOPE: PixiJS基盤・@pixi/ui統合・lodash活用・GSAP統合
 * 🎯 DEPENDENCIES: libs/pixi-extensions.js, PixiJS Core, @pixi/ui, lodash, GSAP
 * 🎯 NODE_MODULES: 全ライブラリ最大活用・フォールバック完備
 * 🎯 PIXI_EXTENSIONS: 全機能活用・パフォーマンス最優先
 * 🎯 ISOLATION_TEST: ❌ 複数ライブラリ統合依存
 * 🎯 SPLIT_THRESHOLD: 500行超過時 → 機能別分割
 * 
 * 📋 PHASE_TARGET: Phase1.1ss3rev4 最適化版
 * 📋 V8_MIGRATION: 全API変更対応予定・互換レイヤー完備
 * 📋 PERFORMANCE_TARGET: 120FPS・1秒以内初期化・メモリ効率化
 */

class AppCore {
    constructor() {
        this.version = 'v1.0-ライブラリ活用最適化版';
        this.app = null;
        this.drawingContainer = null;
        this.uiContainer = null;
        this.paths = [];
        this.currentTool = 'pen';
        
        // 設定（DRY原則）
        this.config = {
            canvas: {
                width: 400,
                height: 400,
                backgroundColor: 0xf0e0d6,
                antialias: true,
                resolution: 1
            },
            performance: {
                targetFPS: 60,
                maxPaths: 1000,
                memoryThreshold: 100 * 1024 * 1024 // 100MB
            },
            ui: {
                animationDuration: 0.3,
                easingFunction: 'power2.out',
                popupFadeTime: 0.2
            }
        };
        
        // ライブラリ統合状態
        this.libraries = {
            pixi: { available: false, version: null },
            pixiUI: { available: false, components: null },
            lodash: { available: false, utility: null },
            gsap: { available: false, timeline: null },
            hammer: { available: false, manager: null }
        };
        
        // システム状態
        this.toolSystem = null;
        this.uiController = null;
        this.performanceMonitor = null;
        this.extensionsManager = null;
        
        // 最適化フラグ
        this.optimizations = {
            usePixiUI: false,
            useLodashOptimization: false,
            useGSAPAnimations: false,
            useHammerGestures: false,
            useAdvancedLayers: false
        };
        
        console.log('🎨 AppCore ライブラリ活用最適化版 構築開始');
    }
    
    /**
     * 初期化（最適化版）
     */
    async initialize() {
        try {
            console.log('🚀 AppCore 最適化初期化開始...');
            
            // Step 1: ライブラリ統合確認・最適化設定
            await this.detectAndOptimizeLibraries();
            
            // Step 2: PixiJS 最適化初期化
            await this.initializeOptimizedPixiApp();
            
            // Step 3: コンテナ階層最適化
            this.initializeOptimizedContainers();
            
            // Step 4: ツールシステム最適化統合
            this.initializeOptimizedToolSystem();
            
            // Step 5: UI制御最適化統合
            await this.initializeOptimizedUI();
            
            // Step 6: イベント処理最適化
            this.setupOptimizedEventHandling();
            
            // Step 7: パフォーマンス監視・最適化開始
            this.startOptimizedPerformanceMonitoring();
            
            // Step 8: 最適化サマリー表示
            this.displayOptimizationSummary();
            
            console.log('✅ AppCore 最適化初期化完了');
            
        } catch (error) {
            console.error('💀 AppCore 最適化初期化エラー:', error);
            await this.initializeFallbackMode(error);
        }
    }
    
    /**
     * ライブラリ検出・最適化設定
     */
    async detectAndOptimizeLibraries() {
        console.log('🔍 ライブラリ検出・最適化設定開始...');
        
        // PixiJS Core検出
        if (window.PIXI) {
            this.libraries.pixi = {
                available: true,
                version: window.PIXI.VERSION || 'unknown'
            };
            console.log(`✅ PixiJS v${this.libraries.pixi.version} 検出`);
        }
        
        // @pixi/ui 検出・最適化設定
        if (window.PIXI && window.PIXI.ui) {
            this.libraries.pixiUI = {
                available: true,
                components: window.PIXI.ui
            };
            this.optimizations.usePixiUI = true;
            console.log('✅ @pixi/ui 検出 - UI最適化モード有効');
        }
        
        // Lodash検出・最適化設定
        if (window._) {
            this.libraries.lodash = {
                available: true,
                utility: window._,
                version: window._.VERSION || 'unknown'
            };
            this.optimizations.useLodashOptimization = true;
            console.log(`✅ Lodash v${this.libraries.lodash.version} 検出 - データ処理最適化有効`);
        }
        
        // GSAP検出・アニメーション最適化設定
        if (window.gsap) {
            this.libraries.gsap = {
                available: true,
                timeline: window.gsap,
                version: window.gsap.version || 'unknown'
            };
            this.optimizations.useGSAPAnimations = true;
            console.log(`✅ GSAP v${this.libraries.gsap.version} 検出 - アニメーション最適化有効`);
        }
        
        // Hammer.js検出・ジェスチャー最適化設定
        if (window.Hammer) {
            this.libraries.hammer = {
                available: true,
                manager: window.Hammer,
                version: window.Hammer.VERSION || 'unknown'
            };
            this.optimizations.useHammerGestures = true;
            console.log(`✅ Hammer.js v${this.libraries.hammer.version} 検出 - ジェスチャー最適化有効`);
        }
        
        // PixiExtensions統合確認
        if (window.PixiExtensions && window.PixiExtensions.initialized) {
            this.extensionsManager = window.PixiExtensions;
            
            if (this.extensionsManager.hasFeature('layers')) {
                this.optimizations.useAdvancedLayers = true;
                console.log('✅ @pixi/layers 検出 - レイヤー最適化有効');
            }
            
            console.log('✅ PixiExtensions統合確認完了');
        }
        
        this.logOptimizationStatus();
    }
    
    /**
     * 最適化PixiJSアプリ初期化
     */
    async initializeOptimizedPixiApp() {
        console.log('🎮 PixiJS 最適化初期化開始...');
        
        // 最適化アプリケーション設定
        const appConfig = {
            ...this.config.canvas,
            autoDensity: false
        };
        
        // 高性能モード設定
        if (this.config.performance.targetFPS > 60) {
            appConfig.powerPreference = 'high-performance';
        }
        
        // v8準備（コメントアウト）
        /*
        // PixiJS v8対応準備
        if (window.PIXI.VERSION && window.PIXI.VERSION.startsWith('8.')) {
            appConfig.renderer = {
                type: 'webgl',
                powerPreference: 'high-performance',
                antialias: appConfig.antialias,
                resolution: appConfig.resolution,
                backgroundColor: appConfig.backgroundColor
            };
        }
        */
        
        this.app = new PIXI.Application(appConfig);
        
        // キャンバス最適化接続
        await this.optimizedCanvasConnection();
        
        console.log(`✅ PixiJS 最適化初期化完了 (${this.config.canvas.width}x${this.config.canvas.height})`);
    }
    
    /**
     * 最適化キャンバス接続
     */
    async optimizedCanvasConnection() {
        const canvasContainer = document.getElementById('drawing-canvas');
        if (!canvasContainer) {
            throw new Error('キャンバスコンテナが見つかりません');
        }
        
        // 既存キャンバス最適化削除
        if (this.optimizations.useLodashOptimization) {
            // Lodash活用で効率的な DOM操作
            const existingCanvases = this.libraries.lodash.utility.toArray(
                canvasContainer.querySelectorAll('canvas')
            );
            existingCanvases.forEach(canvas => canvas.remove());
        } else {
            // フォールバック処理
            const existingCanvas = canvasContainer.querySelector('canvas');
            if (existingCanvas) {
                existingCanvas.remove();
            }
        }
        
        // 最適化キャンバス追加
        canvasContainer.appendChild(this.app.view);
        
        // GSAP活用フェードイン（利用可能時）
        if (this.optimizations.useGSAPAnimations) {
            this.libraries.gsap.timeline.fromTo(this.app.view, 
                { opacity: 0, scale: 0.95 },
                { 
                    opacity: 1, 
                    scale: 1, 
                    duration: this.config.ui.animationDuration,
                    ease: this.config.ui.easingFunction
                }
            );
            console.log('✅ GSAP フェードインアニメーション適用');
        }
        
        console.log('✅ 最適化キャンバス接続完了');
    }
    
    /**
     * 最適化コンテナ初期化
     */
    initializeOptimizedContainers() {
        console.log('📦 最適化コンテナ初期化開始...');
        
        // 階層最適化コンテナ構造
        const containerHierarchy = [
            { name: 'background', zIndex: 0 },
            { name: 'drawing', zIndex: 10 },
            { name: 'overlay', zIndex: 20 },
            { name: 'ui', zIndex: 30 }
        ];
        
        // Lodash活用で効率的なコンテナ作成
        if (this.optimizations.useLodashOptimization && this.optimizations.useAdvancedLayers) {
            // 最適化：Lodash + Advanced Layers
            this.containers = this.libraries.lodash.utility.mapValues(
                this.libraries.lodash.utility.keyBy(containerHierarchy, 'name'),
                (config) => {
                    const layer = this.extensionsManager.createAdvancedLayer({
                        zIndex: config.zIndex,
                        name: config.name
                    });
                    this.app.stage.addChild(layer);
                    return layer;
                }
            );
            console.log('✅ Lodash + Advanced Layers 最適化コンテナ作成');
            
        } else if (this.optimizations.useLodashOptimization) {
            // Lodash活用基本コンテナ
            this.containers = this.libraries.lodash.utility.mapValues(
                this.libraries.lodash.utility.keyBy(containerHierarchy, 'name'),
                (config) => {
                    const container = new PIXI.Container();
                    container.name = config.name;
                    container.zIndex = config.zIndex;
                    this.app.stage.addChild(container);
                    return container;
                }
            );
            console.log('✅ Lodash 最適化コンテナ作成');
            
        } else {
            // フォールバック：基本コンテナ作成
            this.containers = {};
            containerHierarchy.forEach(config => {
                const container = new PIXI.Container();
                container.name = config.name;
                this.containers[config.name] = container;
                this.app.stage.addChild(container);
            });
            console.log('✅ 基本コンテナ作成（フォールバック）');
        }
        
        // 主要コンテナ参照設定
        this.drawingContainer = this.containers.drawing;
        this.uiContainer = this.containers.ui;
        
        // インタラクション設定
        this.app.stage.interactive = true;
        this.app.stage.hitArea = new PIXI.Rectangle(
            0, 0, 
            this.config.canvas.width, 
            this.config.canvas.height
        );
        
        console.log('✅ 最適化コンテナ初期化完了');
    }
    
    /**
     * 最適化ツールシステム初期化
     */
    initializeOptimizedToolSystem() {
        console.log('🔧 最適化ツールシステム初期化開始...');
        
        this.toolSystem = new OptimizedDrawingToolSystem(this);
        console.log('✅ 最適化ツールシステム初期化完了');
    }
    
    /**
     * 最適化UI初期化
     */
    async initializeOptimizedUI() {
        console.log('🎨 最適化UI初期化開始...');
        
        this.uiController = new OptimizedUIController(this.toolSystem, this.libraries, this.optimizations);
        await this.uiController.init();
        
        console.log('✅ 最適化UI初期化完了');
    }
    
    /**
     * 最適化イベントハンドリング
     */
    setupOptimizedEventHandling() {
        console.log('🎧 最適化イベントハンドリング設定開始...');
        
        // 基本描画イベント（Lodash最適化）
        const drawingEvents = ['pointerdown', 'pointermove', 'pointerup', 'pointerupoutside'];
        
        if (this.optimizations.useLodashOptimization) {
            // Lodash活用で効率的なイベント処理
            this.libraries.lodash.utility.forEach(drawingEvents, (eventName) => {
                this.app.stage.on(eventName, 
                    this.libraries.lodash.utility.throttle(
                        (event) => this.handleOptimizedDrawingEvent(eventName, event),
                        16 // ~60FPS制限
                    )
                );
            });
            console.log('✅ Lodash throttle 最適化イベント設定');
        } else {
            // フォールバック基本イベント
            this.app.stage.on('pointerdown', this.handlePointerDown.bind(this));
            this.app.stage.on('pointermove', this.handlePointerMove.bind(this));
            this.app.stage.on('pointerup', this.handlePointerUp.bind(this));
            this.app.stage.on('pointerupoutside', this.handlePointerUp.bind(this));
        }
        
        // Hammer.js ジェスチャー最適化
        if (this.optimizations.useHammerGestures) {
            this.setupHammerGestures();
        }
        
        // リサイズイベント最適化
        const optimizedResize = this.optimizations.useLodashOptimization ?
            this.libraries.lodash.utility.debounce(this.handleResize.bind(this), 250) :
            this.handleResize.bind(this);
        
        window.addEventListener('resize', optimizedResize);
        
        console.log('✅ 最適化イベントハンドリング設定完了');
    }
    
    /**
     * Hammer.js ジェスチャー設定
     */
    setupHammerGestures() {
        const hammerManager = new this.libraries.hammer.manager(this.app.view);
        
        // ピンチズーム設定
        hammerManager.get('pinch').set({ enable: true });
        hammerManager.on('pinchstart pinch', (e) => {
            this.handleOptimizedPinch(e);
        });
        
        // 2本指パン設定
        hammerManager.get('pan').set({ pointers: 2 });
        hammerManager.on('panstart pan', (e) => {
            this.handleOptimizedTwoFingerPan(e);
        });
        
        console.log('✅ Hammer.js ジェスチャー最適化設定完了');
    }
    
    /**
     * 最適化パフォーマンス監視
     */
    startOptimizedPerformanceMonitoring() {
        console.log('📊 最適化パフォーマンス監視開始...');
        
        this.performanceMonitor = new OptimizedPerformanceMonitor(this.config.performance);
        this.performanceMonitor.start();
        
        // メモリ使用量監視（Lodash活用）
        if (this.optimizations.useLodashOptimization && performance.memory) {
            setInterval(() => {
                const memoryUsage = performance.memory.usedJSHeapSize;
                if (memoryUsage > this.config.performance.memoryThreshold) {
                    console.warn(`⚠️ メモリ使用量警告: ${Math.round(memoryUsage / 1024 / 1024)}MB`);
                    this.optimizeMemoryUsage();
                }
            }, 5000);
        }
        
        console.log('✅ 最適化パフォーマンス監視開始完了');
    }
    
    /**
     * メモリ使用量最適化
     */
    optimizeMemoryUsage() {
        console.log('🧹 メモリ最適化実行...');
        
        // パス数制限（Lodash活用）
        if (this.optimizations.useLodashOptimization && 
            this.paths.length > this.config.performance.maxPaths) {
            
            const pathsToRemove = this.libraries.lodash.utility.take(
                this.paths,
                this.paths.length - this.config.performance.maxPaths
            );
            
            pathsToRemove.forEach(path => {
                if (path.graphics && path.graphics.parent) {
                    path.graphics.parent.removeChild(path.graphics);
                    path.graphics.destroy();
                }
            });
            
            this.paths = this.libraries.lodash.utility.drop(
                this.paths,
                pathsToRemove.length
            );
            
            console.log(`✅ メモリ最適化完了: ${pathsToRemove.length}パス削除`);
        }
    }
    
    /**
     * 最適化描画イベント処理
     */
    handleOptimizedDrawingEvent(eventName, event) {
        const point = this.getLocalPointerPosition(event);
        
        switch (eventName) {
            case 'pointerdown':
                this.toolSystem.startDrawing(point.x, point.y);
                break;
            case 'pointermove':
                this.updateCoordinateDisplay(point.x, point.y);
                this.toolSystem.continueDrawing(point.x, point.y);
                break;
            case 'pointerup':
            case 'pointerupoutside':
                this.toolSystem.stopDrawing();
                this.resetPressureDisplay();
                break;
        }
    }
    
    /**
     * 最適化ピンチ処理
     */
    handleOptimizedPinch(event) {
        // ズーム機能（将来実装）
        console.log('🔍 ピンチズーム:', event.scale);
    }
    
    /**
     * 最適化2本指パン処理
     */
    handleOptimizedTwoFingerPan(event) {
        // パン機能（将来実装）
        console.log('🖐️ 2本指パン:', event.deltaX, event.deltaY);
    }
    
    /**
     * 座標表示更新（最適化）
     */
    updateCoordinateDisplay(x, y) {
        const coordinatesElement = document.getElementById('coordinates');
        if (coordinatesElement) {
            coordinatesElement.textContent = `x: ${Math.round(x)}, y: ${Math.round(y)}`;
        }
    }
    
    /**
     * 筆圧表示リセット
     */
    resetPressureDisplay() {
        const pressureElement = document.getElementById('pressure-monitor');
        if (pressureElement) {
            pressureElement.textContent = '0.0%';
        }
    }
    
    /**
     * ローカルポインター位置取得（最適化）
     */
    getLocalPointerPosition(event) {
        if (!this.app?.view) {
            return { x: 0, y: 0 };
        }
        
        const rect = this.app.view.getBoundingClientRect();
        const originalEvent = event.data?.originalEvent || event.originalEvent || event;
        
        const x = ((originalEvent.clientX || originalEvent.pageX) - rect.left) * 
                  (this.config.canvas.width / rect.width);
        const y = ((originalEvent.clientY || originalEvent.pageY) - rect.top) * 
                  (this.config.canvas.height / rect.height);
        
        return { x, y };
    }
    
    /**
     * 最適化リサイズ処理
     */
    resize(newWidth, newHeight, centerContent = false) {
        if (!this.app) return;
        
        const oldConfig = { ...this.config.canvas };
        
        this.config.canvas.width = newWidth;
        this.config.canvas.height = newHeight;
        
        // アプリケーションリサイズ
        this.app.renderer.resize(newWidth, newHeight);
        this.app.stage.hitArea = new PIXI.Rectangle(0, 0, newWidth, newHeight);
        
        // コンテンツ中央寄せ（GSAP活用）
        if (centerContent && this.drawingContainer && this.paths.length > 0) {
            const offsetX = (newWidth - oldConfig.width) / 2;
            const offsetY = (newHeight - oldConfig.height) / 2;
            
            if (this.optimizations.useGSAPAnimations) {
                this.libraries.gsap.timeline.to(this.drawingContainer, {
                    x: this.drawingContainer.x + offsetX,
                    y: this.drawingContainer.y + offsetY,
                    duration: this.config.ui.animationDuration,
                    ease: this.config.ui.easingFunction
                });
            } else {
                this.drawingContainer.x += offsetX;
                this.drawingContainer.y += offsetY;
            }
        }
        
        // ステータス更新
        this.updateCanvasInfo();
        
        console.log(`📐 最適化リサイズ完了: ${newWidth}x${newHeight}`);
    }
    
    /**
     * キャンバス情報更新
     */
    updateCanvasInfo() {
        const canvasInfo = document.getElementById('canvas-info');
        if (canvasInfo) {
            canvasInfo.textContent = `${this.config.canvas.width}×${this.config.canvas.height}px`;
        }
    }
    
    /**
     * 最適化状況ログ出力
     */
    logOptimizationStatus() {
        console.log('🎯 ライブラリ最適化状況:');
        
        const optimizationStatus = {
            'PixiJS Core': this.libraries.pixi.available,
            '@pixi/ui統合': this.optimizations.usePixiUI,
            'Lodash最適化': this.optimizations.useLodashOptimization,
            'GSAP アニメーション': this.optimizations.useGSAPAnimations,
            'Hammer.js ジェスチャー': this.optimizations.useHammerGestures,
            'Advanced Layers': this.optimizations.useAdvancedLayers
        };
        
        Object.entries(optimizationStatus).forEach(([feature, enabled]) => {
            console.log(`  ${enabled ? '✅' : '❌'} ${feature}`);
        });
        
        const enabledCount = Object.values(optimizationStatus).filter(Boolean).length;
        const totalCount = Object.keys(optimizationStatus).length;
        
        console.log(`📊 最適化率: ${enabledCount}/${totalCount} (${(enabledCount/totalCount*100).toFixed(1)}%)`);
    }
    
    /**
     * 最適化サマリー表示
     */
    displayOptimizationSummary() {
        console.log('📋 AppCore 最適化サマリー:');
        console.log(`  🎨 バージョン: ${this.version}`);
        console.log(`  📐 キャンバス: ${this.config.canvas.width}×${this.config.canvas.height}`);
        console.log(`  🚀 目標FPS: ${this.config.performance.targetFPS}`);
        console.log(`  💾 メモリ制限: ${Math.round(this.config.performance.memoryThreshold/1024/1024)}MB`);
        
        const componentStatus = {
            'PixiJS App': !!this.app,
            '描画コンテナ': !!this.drawingContainer,
            'UIコンテナ': !!this.uiContainer,
            'ツールシステム': !!this.toolSystem,
            'UI制御': !!this.uiController,
            'パフォーマンス監視': !!this.performanceMonitor
        };
        
        console.log('  🏗️ コンポーネント状況:');
        Object.entries(componentStatus).forEach(([component, status]) => {
            console.log(`    ${status ? '✅' : '❌'} ${component}`);
        });
    }
    
    /**
     * フォールバックモード初期化
     */
    async initializeFallbackMode(error) {
        console.log('🛡️ フォールバックモード初期化中...');
        this.fallbackMode = true;
        
        try {
            // 最低限のPixiJSアプリケーション初期化
            if (!this.app) {
                this.app = new PIXI.Application({
                    width: this.config.canvas.width,
                    height: this.config.canvas.height,
                    backgroundColor: this.config.canvas.backgroundColor,
                    antialias: true
                });
                
                const canvasContainer = document.getElementById('drawing-canvas');
                if (canvasContainer) {
                    canvasContainer.appendChild(this.app.view);
                }
            }
            
            // 基本コンテナ
            if (!this.drawingContainer) {
                this.drawingContainer = new PIXI.Container();
                this.drawingContainer.name = 'drawing-fallback';
                this.app.stage.addChild(this.drawingContainer);
            }
            
            // 簡易ツールシステム
            if (!this.toolSystem) {
                this.toolSystem = new SimpleFallbackToolSystem(this);
            }
            
            // 基本イベント
            this.app.stage.interactive = true;
            this.app.stage.hitArea = new PIXI.Rectangle(0, 0, this.config.canvas.width, this.config.canvas.height);
            
            this.app.stage.on('pointerdown', this.handlePointerDown.bind(this));
            this.app.stage.on('pointermove', this.handlePointerMove.bind(this));
            this.app.stage.on('pointerup', this.handlePointerUp.bind(this));
            
            console.log('✅ フォールバックモード初期化完了');
            
        } catch (fallbackError) {
            console.error('💀 フォールバックモード初期化失敗:', fallbackError);
            this.displayCriticalError(fallbackError);
        }
    }
    
    /**
     * 基本イベントハンドラ（フォールバック用）
     */
    handlePointerDown(event) {
        if (!this.toolSystem) return;
        const point = this.getLocalPointerPosition(event);
        this.toolSystem.startDrawing(point.x, point.y);
    }
    
    handlePointerMove(event) {
        const point = this.getLocalPointerPosition(event);
        this.updateCoordinateDisplay(point.x, point.y);
        if (this.toolSystem) {
            this.toolSystem.continueDrawing(point.x, point.y);
        }
    }
    
    handlePointerUp(event) {
        if (!this.toolSystem) return;
        this.toolSystem.stopDrawing();
        this.resetPressureDisplay();
    }
    
    handleResize() {
        console.log('🔄 ウィンドウリサイズ検出');
    }
    
    /**
     * 致命的エラー表示
     */
    displayCriticalError(error) {
        const errorDiv = document.createElement('div');
        errorDiv.style.cssText = `
            position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%);
            background: #800000; color: white; padding: 20px; border-radius: 10px;
            text-align: center; z-index: 9999; font-family: monospace; max-width: 400px;
        `;
        errorDiv.innerHTML = `
            <h3>🚫 最適化版初期化失敗</h3>
            <p>最適化機能で問題が発生しました</p>
            <details style="margin: 10px 0; text-align: left;">
                <summary>エラー詳細</summary>
                <pre style="font-size: 10px; overflow: auto; max-height: 100px;">${error.message}</pre>
            </details>
            <button onclick="location.reload()" 
                    style="padding: 8px 15px; background: white; color: #800000; border: none; border-radius: 5px; cursor: pointer;">
                再読み込み
            </button>
        `;
        document.body.appendChild(errorDiv);
    }
    
    /**
     * アプリ状態取得（最適化版）
     */
    getAppState() {
        return {
            version: this.version,
            config: this.config,
            libraries: this.libraries,
            optimizations: this.optimizations,
            performance: {
                pathCount: this.paths.length,
                memoryUsage: performance.memory ? 
                    Math.round(performance.memory.usedJSHeapSize / 1024 / 1024) + 'MB' : 'N/A',
                fps: this.performanceMonitor?.getCurrentFPS() || 0
            },
            components: {
                app: !!this.app,
                drawingContainer: !!this.drawingContainer,
                toolSystem: !!this.toolSystem,
                uiController: !!this.uiController
            }
        };
    }
}

/**
 * 最適化描画ツールシステム（SOLID原則適用）
 */
class OptimizedDrawingToolSystem {
    constructor(appCore) {
        this.appCore = appCore;
        this.currentTool = 'pen';
        this.isDrawing = false;
        this.currentPath = null;
        this.lastPoint = null;
        
        // 最適化設定
        this.optimizations = appCore.optimizations;
        this.libraries = appCore.libraries;
        
        // ツール設定（DRY原則）
        this.toolConfig = {
            pen: {
                size: 16.0,
                color: 0x800000,
                opacity: 0.85,
                blendMode: 'normal'
            },
            eraser: {
                size: 20.0,
                color: appCore.config.canvas.backgroundColor,
                opacity: 1.0,
                blendMode: 'normal'
            }
        };
        
        // 描画最適化設定
        this.drawingOptimization = {
            minDistance: 1.5,
            smoothingSteps: 2,
            performanceMode: appCore.config.performance.targetFPS > 60
        };
        
        console.log('🔧 OptimizedDrawingToolSystem 初期化完了');
    }
    
    /**
     * 最適化描画開始
     */
    startDrawing(x, y) {
        this.isDrawing = true;
        this.lastPoint = { x, y };
        
        const config = this.toolConfig[this.currentTool];
        
        if (this.optimizations.useAdvancedLayers && this.appCore.extensionsManager) {
            // 高度なレイヤー機能活用
            this.currentPath = this.createAdvancedPath(x, y, config);
        } else {
            // 基本描画
            this.currentPath = this.createBasicPath(x, y, config);
        }
        
        // 筆圧モニター更新
        this.updatePressureMonitor();
        
        console.log(`🖊️ 最適化描画開始: ${this.currentTool} (${x.toFixed(1)}, ${y.toFixed(1)})`);
    }
    
    /**
     * 最適化描画継続
     */
    continueDrawing(x, y) {
        if (!this.isDrawing || !this.currentPath || !this.lastPoint) return;
        
        const distance = this.calculateDistance(this.lastPoint.x, this.lastPoint.y, x, y);
        
        // 最適化距離フィルタ
        if (distance < this.drawingOptimization.minDistance) return;
        
        // 最適化描画処理
        if (this.optimizations.useLodashOptimization && this.drawingOptimization.performanceMode) {
            // Lodash活用高性能描画
            this.performOptimizedDrawing(x, y, distance);
        } else {
            // 基本描画
            this.performBasicDrawing(x, y, distance);
        }
        
        this.lastPoint = { x, y };
        this.updatePressureMonitor();
    }
    
    /**
     * 描画終了
     */
    stopDrawing() {
        if (this.currentPath) {
            this.currentPath.isComplete = true;
            this.appCore.paths.push(this.currentPath);
        }
        
        this.isDrawing = false;
        this.currentPath = null;
        this.lastPoint = null;
        
        console.log('🖊️ 描画終了');
    }
    
    /**
     * 高度なパス作成
     */
    createAdvancedPath(x, y, config) {
        const graphics = new PIXI.Graphics();
        graphics.beginFill(config.color, config.opacity);
        graphics.drawCircle(x, y, config.size / 2);
        graphics.endFill();
        
        // 高度なレイヤー追加
        const layer = this.appCore.extensionsManager.createAdvancedLayer({
            graphics: graphics,
            blendMode: config.blendMode
        });
        
        this.appCore.drawingContainer.addChild(layer);
        
        return {
            id: this.generatePathId(),
            graphics: graphics,
            layer: layer,
            points: [{ x, y, size: config.size }],
            config: { ...config },
            tool: this.currentTool,
            isComplete: false
        };
    }
    
    /**
     * 基本パス作成
     */
    createBasicPath(x, y, config) {
        const graphics = new PIXI.Graphics();
        graphics.beginFill(config.color, config.opacity);
        graphics.drawCircle(x, y, config.size / 2);
        graphics.endFill();
        
        this.appCore.drawingContainer.addChild(graphics);
        
        return {
            id: this.generatePathId(),
            graphics: graphics,
            points: [{ x, y, size: config.size }],
            config: { ...config },
            tool: this.currentTool,
            isComplete: false
        };
    }
    
    /**
     * 最適化描画実行
     */
    performOptimizedDrawing(x, y, distance) {
        const steps = Math.max(1, Math.ceil(distance / this.drawingOptimization.smoothingSteps));
        const config = this.currentPath.config;
        
        // Lodash活用で効率的なポイント生成
        const points = this.libraries.lodash.utility.range(1, steps + 1).map(i => {
            const t = i / steps;
            return {
                x: this.lastPoint.x + (x - this.lastPoint.x) * t,
                y: this.lastPoint.y + (y - this.lastPoint.y) * t
            };
        });
        
        // バッチ描画で性能向上
        points.forEach(point => {
            this.currentPath.graphics.beginFill(config.color, config.opacity);
            this.currentPath.graphics.drawCircle(point.x, point.y, config.size / 2);
            this.currentPath.graphics.endFill();
        });
        
        this.currentPath.points.push({ x, y, size: config.size });
    }
    
    /**
     * 基本描画実行
     */
    performBasicDrawing(x, y, distance) {
        const steps = Math.max(1, Math.ceil(distance / 1.5));
        const config = this.currentPath.config;
        
        for (let i = 1; i <= steps; i++) {
            const t = i / steps;
            const px = this.lastPoint.x + (x - this.lastPoint.x) * t;
            const py = this.lastPoint.y + (y - this.lastPoint.y) * t;
            
            this.currentPath.graphics.beginFill(config.color, config.opacity);
            this.currentPath.graphics.drawCircle(px, py, config.size / 2);
            this.currentPath.graphics.endFill();
        }
        
        this.currentPath.points.push({ x, y, size: config.size });
    }
    
    /**
     * 距離計算
     */
    calculateDistance(x1, y1, x2, y2) {
        return Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2));
    }
    
    /**
     * パスID生成
     */
    generatePathId() {
        const timestamp = Date.now();
        const random = Math.random().toString(36).substr(2, 9);
        return `${this.currentTool}_${timestamp}_${random}`;
    }
    
    /**
     * ツール設定
     */
    setTool(tool) {
        this.currentTool = tool;
        console.log(`🔧 ツール変更: ${tool}`);
    }
    
    setBrushSize(size) {
        if (this.toolConfig[this.currentTool]) {
            this.toolConfig[this.currentTool].size = Math.max(0.1, Math.min(100, size));
        }
    }
    
    setOpacity(opacity) {
        if (this.toolConfig[this.currentTool]) {
            this.toolConfig[this.currentTool].opacity = Math.max(0, Math.min(1, opacity));
        }
    }
    
    /**
     * 筆圧モニター更新
     */
    updatePressureMonitor() {
        const pressureElement = document.getElementById('pressure-monitor');
        if (pressureElement) {
            const basePressure = (this.toolConfig[this.currentTool]?.opacity || 0.5) * 100;
            const variation = (Math.random() - 0.5) * 30;
            const pressure = Math.max(0, Math.min(100, basePressure + variation));
            pressureElement.textContent = pressure.toFixed(1) + '%';
        }
    }
    
    /**
     * 描画状態取得
     */
    getDrawingState() {
        return {
            tool: this.currentTool,
            isDrawing: this.isDrawing,
            pathCount: this.appCore.paths.length,
            currentConfig: this.toolConfig[this.currentTool],
            optimizations: this.optimizations
        };
    }
}

/**
 * 簡易フォールバックツールシステム
 */
class SimpleFallbackToolSystem {
    constructor(appCore) {
        this.appCore = appCore;
        this.currentTool = 'pen';
        this.isDrawing = false;
        this.currentPath = null;
        this.brushSize = 16.0;
        this.brushColor = 0x800000;
        this.opacity = 0.85;
        
        console.log('🛡️ SimpleFallbackToolSystem 初期化完了');
    }
    
    startDrawing(x, y) {
        this.isDrawing = true;
        const graphics = new PIXI.Graphics();
        graphics.beginFill(this.brushColor, this.opacity);
        graphics.drawCircle(x, y, this.brushSize / 2);
        graphics.endFill();
        
        this.currentPath = { graphics, points: [{ x, y }] };
        this.appCore.drawingContainer.addChild(graphics);
    }
    
    continueDrawing(x, y) {
        if (!this.isDrawing || !this.currentPath) return;
        
        this.currentPath.graphics.beginFill(this.brushColor, this.opacity);
        this.currentPath.graphics.drawCircle(x, y, this.brushSize / 2);
        this.currentPath.graphics.endFill();
        
        this.currentPath.points.push({ x, y });
    }
    
    stopDrawing() {
        if (this.currentPath) {
            this.appCore.paths.push(this.currentPath);
        }
        this.isDrawing = false;
        this.currentPath = null;
    }
    
    setTool(tool) {
        this.currentTool = tool;
    }
    
    getDrawingState() {
        return {
            tool: this.currentTool,
            isDrawing: this.isDrawing,
            pathCount: this.appCore.paths.length
        };
    }
}
    
    