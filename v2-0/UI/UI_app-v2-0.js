// app-v2-0.js
// Last updated: 2025-06-17 17:30:49
// Author: toshinka

class TegakiUIManager {
    constructor(appManager) {
        this.app = appManager;
        this.currentUser = 'toshinka';
        this.currentTimestamp = '2025-06-17 17:30:49';

        // UI状態管理
        this.state = {
            activePanel: null,
            modalOpen: false,
            toolbarCollapsed: false,
            sidebarCollapsed: false,
            isDragging: false,
            dragStartPos: { x: 0, y: 0 },
            zoom: 100,
            cursorPosition: { x: 0, y: 0 }
        };

        // パフォーマンスモニタリング
        this.metrics = {
            fps: 0,
            lastFrameTime: 0,
            frameCount: 0,
            memoryUsage: 0
        };

        this.initialize();
    }

    async initialize() {
        console.log(`Initializing UI Manager at ${this.currentTimestamp}`);

        try {
            // DOMイベントの設定
            this.setupEventListeners();

            // ツールバーの初期化
            this.initializeToolbar();

            // サイドバーの初期化
            this.initializeSidebar();

            // キャンバス領域の初期化
            this.initializeCanvasArea();

            // モーダルダイアログの初期化
            this.initializeModals();

            // パフォーマンスモニタリングの開始
            this.startPerformanceMonitoring();

            console.log('UI Manager initialization completed');

        } catch (error) {
            console.error('UI Manager initialization failed:', error);
            throw error;
        }
    }

    setupEventListeners() {
        // ウィンドウイベント
        window.addEventListener('resize', this.handleResize.bind(this));
        window.addEventListener('beforeunload', this.handleBeforeUnload.bind(this));

        // キーボードイベント
        document.addEventListener('keydown', this.handleKeyDown.bind(this));
        document.addEventListener('keyup', this.handleKeyUp.bind(this));

        // タッチイベント
        if ('ontouchstart' in window) {
            this.setupTouchEvents();
        }

        // アプリケーションイベント
        this.app.config.container.addEventListener('tegaki-tool-changed', 
            this.handleToolChange.bind(this));
        this.app.config.container.addEventListener('tegaki-layer-changed',
            this.handleLayerChange.bind(this));
        this.app.config.container.addEventListener('tegaki-color-changed',
            this.handleColorChange.bind(this));
    }

    setupTouchEvents() {
        const container = this.app.config.container;
        
        container.addEventListener('touchstart', this.handleTouchStart.bind(this));
        container.addEventListener('touchmove', this.handleTouchMove.bind(this));
        container.addEventListener('touchend', this.handleTouchEnd.bind(this));
        
        // ジェスチャー設定
        this.setupGestureRecognition();
    }

    initializeToolbar() {
        const toolbar = document.querySelector('.tegaki-toolbar');
        
        // ツールボタンの設定
        this.setupToolButtons();
        
        // ツールバーのカスタマイズ機能
        this.setupToolbarCustomization();
        
        // ツールバーの折りたたみ機能
        this.setupToolbarCollapse();
    }

    initializeSidebar() {
        // カラーパネルの初期化
        this.initializeColorPanel();
        
        // ブラシパネルの初期化
        this.initializeBrushPanel();
        
        // レイヤーパネルの初期化
        this.initializeLayerPanel();
        
        // サイドバーの折りたたみ機能
        this.setupSidebarCollapse();
    }

    initializeCanvasArea() {
        const container = document.getElementById('canvas-container');
        
        // ズーム・パン機能の設定
        this.setupZoomPan();
        
        // グリッド表示の設定
        this.setupGrid();
        
        // ルーラー表示の設定
        this.setupRulers();
        
        // カーソル情報の表示
        this.setupCursorInfo();
    }

    initializeModals() {
        // 設定モーダル
        this.setupSettingsModal();
        
        // ヘルプモーダル
        this.setupHelpModal();
        
        // エクスポートモーダル
        this.setupExportModal();
    }

    // カラーパネル関連
    initializeColorPanel() {
        const colorPanel = document.querySelector('.color-panel');
        
        // カラースライダーの設定
        this.setupColorSliders();
        
        // カラースウォッチの設定
        this.setupColorSwatches();
        
        // カラーピッカーの設定
        this.setupColorPicker();
    }

    setupColorSliders() {
        const sliders = document.querySelectorAll('.color-sliders input');
        
        sliders.forEach(slider => {
            slider.addEventListener('input', (event) => {
                const value = event.target.value;
                const type = event.target.id.split('-')[0];
                
                this.updateColor(type, value);
            });
        });
    }

    setupColorSwatches() {
        const swatchContainer = document.getElementById('color-swatches');
        
        // デフォルトカラーパレットの設定
        const defaultColors = [
            '#000000', '#FFFFFF', '#FF0000', '#00FF00', '#0000FF',
            '#FFFF00', '#FF00FF', '#00FFFF', '#808080', '#C0C0C0'
        ];

        defaultColors.forEach(color => {
            const swatch = document.createElement('div');
            swatch.className = 'color-swatch';
            swatch.style.backgroundColor = color;
            swatch.addEventListener('click', () => {
                this.app.getManager('color').setPrimaryColor(color);
            });
            swatchContainer.appendChild(swatch);
        });
    }

    // ブラシパネル関連
    initializeBrushPanel() {
        const brushPanel = document.querySelector('.brush-panel');
        
        // ブラシプレビューの設定
        this.setupBrushPreview();
        
        // ブラシ設定スライダーの設定
        this.setupBrushSliders();
        
        // ブラシオプションの設定
        this.setupBrushOptions();
    }

    setupBrushPreview() {
        const preview = document.getElementById('brush-preview');
        const ctx = preview.getContext('2d');
        
        // プレビューの更新関数
        const updatePreview = () => {
            const tool = this.app.getManager('tool').getActiveTool();
            if (!tool || tool.id !== 'brush') return;

            ctx.clearRect(0, 0, preview.width, preview.height);
            
            // ブラシのプレビューを描画
            const brushEngine = this.app.getExtension('brushEngine');
            brushEngine.renderBrushPreview(ctx, tool.settings);
        };

        // ツール変更時にプレビューを更新
        this.app.config.container.addEventListener('tegaki-tool-changed', updatePreview);
    }

    // レイヤーパネル関連
    initializeLayerPanel() {
        const layerPanel = document.querySelector('.layer-panel');
        
        // レイヤーリストの設定
        this.setupLayerList();
        
        // レイヤーオプションの設定
        this.setupLayerOptions();
    }

    setupLayerList() {
        const layerList = document.getElementById('layer-list');
        
        // レイヤーのドラッグ&ドロップ
        this.setupLayerDragDrop();
        
        // レイヤーの表示/非表示トグル
        this.setupLayerVisibility();
        
        // レイヤーの選択
        this.setupLayerSelection();
    }

    // パフォーマンスモニタリング
    startPerformanceMonitoring() {
        // FPSモニタリング
        let lastTime = performance.now();
        const updateFPS = () => {
            const currentTime = performance.now();
            this.metrics.frameCount++;
            
            if (currentTime - this.metrics.lastFrameTime >= 1000) {
                this.metrics.fps = this.metrics.frameCount;
                this.metrics.frameCount = 0;
                this.metrics.lastFrameTime = currentTime;
                
                this.updateStatusBar();
            }
            
            requestAnimationFrame(updateFPS);
        };
        
        requestAnimationFrame(updateFPS);

        // メモリ使用量モニタリング
        if (performance.memory) {
            setInterval(() => {
                this.metrics.memoryUsage = performance.memory.usedJSHeapSize;
                this.updateStatusBar();
            }, 1000);
        }
    }

    updateStatusBar() {
        document.getElementById('fps').textContent = `FPS: ${this.metrics.fps}`;
        document.getElementById('memory-usage').textContent = 
            `メモリ: ${Math.round(this.metrics.memoryUsage / 1024 / 1024)}MB`;
        document.getElementById('coordinates').textContent = 
            `X: ${this.state.cursorPosition.x}, Y: ${this.state.cursorPosition.y}`;
        document.getElementById('zoom-level').textContent = 
            `ズーム: ${this.state.zoom}%`;
    }

    // イベントハンドラー
    handleResize() {
        this.app.getManager('canvas').updateCanvasSize();
        this.updateStatusBar();
    }

    handleBeforeUnload(event) {
        if (this.app.getManager('history').hasUnsavedChanges()) {
            event.preventDefault();
            event.returnValue = '';
        }
    }

    handleKeyDown(event) {
        // ショートカットキーの処理
        const shortcuts = {
            'z': { ctrl: true, action: () => this.app.undo() },
            'y': { ctrl: true, action: () => this.app.redo() },
            's': { ctrl: true, action: () => this.app.save() },
            'o': { ctrl: true, action: () => this.app.load() }
        };

        const key = event.key.toLowerCase();
        if (shortcuts[key] && 
            event.ctrlKey === shortcuts[key].ctrl) {
            event.preventDefault();
            shortcuts[key].action();
        }
    }

    // アプリケーションイベントハンドラー
    handleToolChange(event) {
        const { tool } = event.detail;
        this.updateToolUI(tool);
    }

    handleLayerChange(event) {
        const { layer } = event.detail;
        this.updateLayerUI(layer);
    }

    handleColorChange(event) {
        const { color } = event.detail;
        this.updateColorUI(color);
    }

    // UI更新関数
    updateToolUI(tool) {
        document.querySelectorAll('.tool-button').forEach(button => {
            button.classList.toggle('active', 
                button.dataset.tool === tool.id);
        });
    }

    updateLayerUI(layer) {
        const layerElements = document.querySelectorAll('.layer-item');
        layerElements.forEach(elem => {
            if (elem.dataset.layerId === layer.id) {
                elem.classList.toggle('active', true);
                elem.querySelector('.layer-visibility').checked = layer.visible;
                elem.querySelector('.layer-opacity').value = layer.opacity;
            }
        });
    }

    updateColorUI(color) {
        document.getElementById('primary-color').style.backgroundColor = color;
        
        const [h, s, l] = this.app.getManager('color').rgbToHsl(color);
        document.getElementById('hue-slider').value = h;
        document.getElementById('saturation-slider').value = s * 100;
        document.getElementById('lightness-slider').value = l * 100;
    }

    // リソース解放
    dispose() {
        // イベントリスナーの解除
        window.removeEventListener('resize', this.handleResize);
        window.removeEventListener('beforeunload', this.handleBeforeUnload);
        document.removeEventListener('keydown', this.handleKeyDown);
        document.removeEventListener('keyup', this.handleKeyUp);

        // 状態のリセット
        this.state = null;
        this.metrics = null;
    }
}