// PixiJS v8統合パッケージ（メインimport）
import { Application, Container, Graphics, Text, Sprite } from 'pixi.js';

// Phosphor Icons CSS import
import '@phosphor-icons/web/regular';

// PixiJS v8統一システム
import { PixiV8UnifiedRenderer } from '@pixi/PixiV8UnifiedRenderer.js';
import { PixiV8InputController } from '@pixi/PixiV8InputController.js';
import { PixiV8UIController } from '@pixi/PixiV8UIController.js';
import { PixiV8LayerProcessor } from '@pixi/PixiV8LayerProcessor.js';

// 状態管理・ユーティリティ
import { EventStore } from '@stores/EventStore.js';
import { ProjectStore } from '@stores/ProjectStore.js';
import { ColorProcessor } from '@utils/ColorProcessor.js';
import { ShortcutController } from '@utils/ShortcutController.js';
import { CanvasController } from '@utils/CanvasController.js';

// Chrome API検出・性能監視
import { ChromeAPIDetector } from '@utils/ChromeAPIDetector.js';
import { PerformanceUtils } from '@utils/PerformanceUtils.js';

/**
 * PixiJS v8統合 モダンお絵かきツール メインアプリケーション
 * Adobe Fresco風UI + ふたば☆ちゃんねるカラー + Chrome最新API統合
 */
class ModernDrawingToolV34 {
    constructor() {
        this.app = null;
        this.renderer = null;
        this.inputController = null;
        this.uiController = null;
        this.layerProcessor = null;
        
        // ストア初期化
        this.eventStore = new EventStore();
        this.projectStore = new ProjectStore();
        
        // ユーティリティ初期化
        this.colorProcessor = new ColorProcessor();
        this.shortcutController = new ShortcutController();
        this.canvasController = new CanvasController();
        
        // Chrome API・性能監視
        this.chromeAPI = new ChromeAPIDetector();
        this.performance = new PerformanceUtils();
        
        // 現在の設定
        this.currentTool = 'pen';
        this.currentColor = '#800000'; // ふたばマルーン
        this.brushSize = 12;
        this.opacity = 1.0;
        
        // 初期化実行
        this.initialize();
    }
    
    async initialize() {
        try {
            console.log('🎨 モダンお絵かきツール v3.4 初期化開始');
            
            // Chrome API機能検出
            const capabilities = await this.chromeAPI.detectCapabilities();
            console.log('Chrome API Capabilities:', capabilities);
            
            // 性能監視開始
            this.performance.initializeHighFrequencyMode();
            
            // PixiJS v8統合レンダラー初期化
            await this.initializePixiV8();
            
            // システムコンポーネント初期化
            this.initializeControllers();
            
            // UI イベントリスナー設定
            this.setupUIEventListeners();
            
            // ショートカットキー設定
            this.setupKeyboardShortcuts();
            
            // 性能監視UI更新
            this.setupPerformanceMonitoring();
            
            console.log('✅ モダンお絵かきツール v3.4 初期化完了');
            
        } catch (error) {
            console.error('❌ 初期化エラー:', error);
            this.handleInitializationError(error);
        }
    }
    
    async initializePixiV8() {
        // PixiJS v8統合アプリケーション初期化
        this.app = new Application();
        
        // Canvas要素の取得
        const canvasContainer = document.getElementById('pixi-canvas');
        if (!canvasContainer) {
            throw new Error('Canvas container not found');
        }
        
        // WebGPU優先設定（フォールバック付き）
        const initConfig = {
            width: window.innerWidth - window.DESIGN_CONFIG.sizes.sidebarWidth - window.DESIGN_CONFIG.sizes.layerPanelWidth,
            height: window.innerHeight - 100, // タイムライン分考慮
            backgroundColor: 0xffffee, // ふたば背景色
            antialias: true,
            autoDensity: true,
            powerPreference: 'high-performance'
        };
        
        // WebGPU対応確認・設定
        if (await this.chromeAPI.checkWebGPU()) {
            initConfig.preference = 'webgpu';
            console.log('🚀 WebGPU enabled for maximum performance');
        } else {
            initConfig.preference = 'webgl';
            console.log('⚡ WebGL fallback mode');
        }
        
        await this.app.init(initConfig);
        
        // Canvas DOMに追加
        canvasContainer.appendChild(this.app.canvas);
        
        // PixiJS v8統一レンダラー初期化
        this.renderer = new PixiV8UnifiedRenderer(this.app);
        await this.renderer.initialize();
        
        // 基本レイヤー構造作成
        this.createInitialLayers();
        
        console.log(`🎨 PixiJS v${this.app.renderer.type} initialized with ${this.app.canvas.width}x${this.app.canvas.height}`);
    }
    
    initializeControllers() {
        // PixiJS v8統一入力コントローラー
        this.inputController = new PixiV8InputController(this.app, {
            onPointerDown: this.handlePointerDown.bind(this),
            onPointerMove: this.handlePointerMove.bind(this),
            onPointerUp: this.handlePointerUp.bind(this),
            targetFPS: window.DESIGN_CONFIG.performance.targetFPS
        });
        
        // UI制御コントローラー
        this.uiController = new PixiV8UIController(this.app, {
            designConfig: window.DESIGN_CONFIG,
            onToolChange: this.handleToolChange.bind(this),
            onColorChange: this.handleColorChange.bind(this)
        });
        
        // レイヤー処理コントローラー
        this.layerProcessor = new PixiV8LayerProcessor(this.app, {
            onLayerCreate: this.handleLayerCreate.bind(this),
            onLayerDelete: this.handleLayerDelete.bind(this),
            onLayerSelect: this.handleLayerSelect.bind(this)
        });
        
        // キャンバス制御
        this.canvasController.initialize(this.app);
        
        console.log('🎮 All controllers initialized');
    }
    
    createInitialLayers() {
        // ベースレイヤーコンテナ
        this.baseContainer = new Container();
        this.app.stage.addChild(this.baseContainer);
        
        // 背景レイヤー（白）
        const backgroundLayer = new Graphics();
        backgroundLayer
            .rect(0, 0, this.app.canvas.width, this.app.canvas.height)
            .fill(0xffffff);
        backgroundLayer.name = '背景';
        this.baseContainer.addChild(backgroundLayer);
        
        // 描画レイヤー1（透明）
        const drawingLayer = new Container();
        drawingLayer.name = 'レイヤー 1';
        this.baseContainer.addChild(drawingLayer);
        
        // レイヤー情報をプロジェクトストアに保存
        this.projectStore.addLayer({
            id: 'background',
            name: '背景',
            container: backgroundLayer,
            visible: true,
            opacity: 1.0,
            type: 'background'
        });
        
        this.projectStore.addLayer({
            id: 'layer1',
            name: 'レイヤー 1',
            container: drawingLayer,
            visible: true,
            opacity: 1.0,
            type: 'drawing'
        });
        
        this.projectStore.setActiveLayer('layer1');
        
        console.log('📚 Initial layers created');
    }
    
    setupUIEventListeners() {
        // ツールボタンイベント
        document.querySelectorAll('.tool-button').forEach(button => {
            button.addEventListener('click', (e) => {
                const tool = e.currentTarget.dataset.tool;
                if (tool) {
                    this.selectTool(tool);
                }
            });
        });
        
        // カラープリセットイベント
        document.querySelectorAll('.color-preset').forEach(preset => {
            preset.addEventListener('click', (e) => {
                const color = e.currentTarget.dataset.color;
                if (color) {
                    this.setColor(color);
                }
            });
        });
        
        // レイヤーパネル表示切り替え
        const layersButton = document.querySelector('[data-tool="layers"]');
        const layerPanel = document.getElementById('layer-panel');
        
        layersButton?.addEventListener('click', () => {
            layerPanel.classList.toggle('hidden');
        });
        
        // カラーパレット表示切り替え
        const colorButton = document.querySelector('[data-tool="color"]');
        const colorPopup = document.getElementById('color-popup');
        
        colorButton?.addEventListener('click', (e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            colorPopup.style.left = `${rect.right + 10}px`;
            colorPopup.style.top = `${rect.top}px`;
            colorPopup.classList.toggle('active');
        });
        
        // ポップアップ閉じるボタン
        document.querySelectorAll('.popup-close').forEach(button => {
            button.addEventListener('click', (e) => {
                e.currentTarget.closest('.popup').classList.remove('active');
            });
        });
        
        // ウィンドウリサイズ対応
        window.addEventListener('resize', this.handleResize.bind(this));
        
        console.log('🎯 UI event listeners setup complete');
    }
    
    setupKeyboardShortcuts() {
        // ツール切り替えショートカット
        this.shortcutController.addShortcut('KeyP', () => this.selectTool('pen'));
        this.shortcutController.addShortcut('KeyE', () => this.selectTool('eraser'));
        this.shortcutController.addShortcut('KeyG', () => this.selectTool('fill'));
        this.shortcutController.addShortcut('KeyI', () => this.selectTool('eyedropper'));
        this.shortcutController.addShortcut('KeyM', () => this.selectTool('select'));
        this.shortcutController.addShortcut('KeyT', () => this.selectTool('text'));
        
        // アンドゥ/リドゥ
        this.shortcutController.addShortcut('ctrl+KeyZ', () => this.undo());
        this.shortcutController.addShortcut('ctrl+KeyY', () => this.redo());
        
        // ブラシサイズ調整
        this.shortcutController.addShortcut('BracketLeft', () => this.adjustBrushSize(-2));
        this.shortcutController.addShortcut('BracketRight', () => this.adjustBrushSize(2));
        
        // レイヤーパネル表示切り替え
        this.shortcutController.addShortcut('Tab', () => {
            document.getElementById('layer-panel').classList.toggle('hidden');
        });
        
        console.log('⌨️ Keyboard shortcuts setup complete');
    }
    
    setupPerformanceMonitoring() {
        const monitor = document.getElementById('performance-monitor');
        const fpsElement = document.getElementById('fps');
        const memoryElement = document.getElementById('memory');
        const objectsElement = document.getElementById('objects');
        
        // 開発モードでのみ表示
        if (import.meta.env.DEV) {
            monitor.classList.add('active');
        }
        
        // 性能監視更新（1秒間隔）
        setInterval(() => {
            if (monitor.classList.contains('active')) {
                fpsElement.textContent = this.performance.getCurrentFPS();
                
                if (performance.memory) {
                    const memoryMB = Math.round(performance.memory.usedJSHeapSize / 1024 / 1024);
                    memoryElement.textContent = memoryMB;
                }
                
                // PixiJS オブジェクト数
                const objectCount = this.countPixiObjects();
                objectsElement.textContent = objectCount;
            }
        }, 1000);
        
        console.log('📊 Performance monitoring setup complete');
    }
    
    selectTool(toolName) {
        // ツールボタンの表示更新
        document.querySelectorAll('.tool-button').forEach(button => {
            button.classList.remove('active');
        });
        
        const selectedButton = document.querySelector(`[data-tool="${toolName}"]`);
        if (selectedButton) {
            selectedButton.classList.add('active');
        }
        
        // ツール状態更新
        this.currentTool = toolName;
        
        // UI コントローラーに通知
        this.uiController.setActiveTool(toolName);
        
        // 入力コントローラーに通知
        this.inputController.setActiveTool(toolName);
        
        console.log(`🔧 Tool selected: ${toolName}`);
    }
    
    setColor(color) {
        this.currentColor = color;
        
        // カラープリセットの表示更新
        document.querySelectorAll('.color-preset').forEach(preset => {
            preset.classList.remove('active');
        });
        
        const selectedPreset = document.querySelector(`[data-color="${color}"]`);
        if (selectedPreset) {
            selectedPreset.classList.add('active');
        }
        
        // カラープロセッサーに通知
        this.colorProcessor.setCurrentColor(color);
        
        console.log(`🎨 Color selected: ${color}`);
    }
    
    adjustBrushSize(delta) {
        this.brushSize = Math.max(1, Math.min(100, this.brushSize + delta));
        
        // 入力コントローラーに通知
        this.inputController.setBrushSize(this.brushSize);
        
        console.log(`🖌️ Brush size: ${this.brushSize}`);
    }
    
    // ポインター入力処理
    handlePointerDown(event) {
        if (this.currentTool === 'pen') {
            this.startDrawing(event);
        }
    }
    
    handlePointerMove(event) {
        if (this.currentTool === 'pen' && this.inputController.isDrawing) {
            this.continueDrawing(event);
        }
    }
    
    handlePointerUp(event) {
        if (this.currentTool === 'pen') {
            this.endDrawing(event);
        }
    }
    
    startDrawing(event) {
        const activeLayer = this.projectStore.getActiveLayer();
        if (!activeLayer) return;
        
        // 新しいストローク開始
        this.currentStroke = new Graphics();
        this.currentStroke.moveTo(event.global.x, event.global.y);
        
        activeLayer.container.addChild(this.currentStroke);
        
        console.log('✏️ Drawing started');
    }
    
    continueDrawing(event) {
        if (!this.currentStroke) return;
        
        // ストローク続行
        this.currentStroke
            .lineTo(event.global.x, event.global.y)
            .stroke({
                width: this.brushSize,
                color: this.currentColor,
                alpha: this.opacity,
                cap: 'round',
                join: 'round'
            });
    }
    
    endDrawing(event) {
        if (!this.currentStroke) return;
        
        // ストローク終了
        this.currentStroke = null;
        
        // 履歴に追加
        this.projectStore.addToHistory('draw', {
            layer: this.projectStore.getActiveLayerId(),
            tool: this.currentTool,
            color: this.currentColor,
            size: this.brushSize
        });
        
        console.log('✅ Drawing completed');
    }
    
    // その他のハンドラー
    handleToolChange(tool) {
        this.selectTool(tool);
    }
    
    handleColorChange(color) {
        this.setColor(color);
    }
    
    handleLayerCreate() {
        // 新規レイヤー作成処理
        console.log('📚 New layer created');
    }
    
    handleLayerDelete() {
        // レイヤー削除処理
        console.log('🗑️ Layer deleted');
    }
    
    handleLayerSelect(layerId) {
        this.projectStore.setActiveLayer(layerId);
        console.log(`📚 Layer selected: ${layerId}`);
    }
    
    handleResize() {
        if (!this.app) return;
        
        const newWidth = window.innerWidth - window.DESIGN_CONFIG.sizes.sidebarWidth - window.DESIGN_CONFIG.sizes.layerPanelWidth;
        const newHeight = window.innerHeight - 100;
        
        this.app.renderer.resize(newWidth, newHeight);
        
        console.log(`📏 Canvas resized: ${newWidth}x${newHeight}`);
    }
    
    undo() {
        this.projectStore.undo();
        console.log('↶ Undo');
    }
    
    redo() {
        this.projectStore.redo();
        console.log('↷ Redo');
    }
    
    countPixiObjects() {
        if (!this.app) return 0;
        
        let count = 0;
        const countChildren = (container) => {
            count++;
            if (container.children) {
                container.children.forEach(countChildren);
            }
        };
        
        countChildren(this.app.stage);
        return count;
    }
    
    handleInitializationError(error) {
        console.error('Initialization failed:', error);
        
        // エラー表示UI
        const errorDiv = document.createElement('div');
        errorDiv.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: #ff0000;
            color: white;
            padding: 20px;
            border-radius: 8px;
            font-family: monospace;
            z-index: 9999;
        `;
        errorDiv.textContent = `初期化エラー: ${error.message}`;
        document.body.appendChild(errorDiv);
    }
}

// アプリケーション起動
document.addEventListener('DOMContentLoaded', () => {
    window.drawingApp = new ModernDrawingToolV34();
});

console.log('🎨 モダンお絵かきツール v3.4 メインスクリプト読み込み完了');