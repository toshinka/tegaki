/**
 * 🎨 Canvas Manager - Phase1.2-STEP3完全版
 * 🎯 キャンバス管理・リサイズ機能・PixiJSv8対応
 * 
 * 🎯 AI_WORK_SCOPE: キャンバス描画・リサイズ・レイヤー管理・PixiJS統合
 * 🎯 DEPENDENCIES: PIXI, Memory Manager, Error Manager, Config Manager  
 * 🎯 NODE_MODULES: pixi.js v7→v8対応, gsap（オプション）
 * 🎯 車輪の再発明回避: PIXI Application, GSAP Animation, Manager統合
 */

/**
 * Canvas Manager - メインクラス
 * DRY・SOLID原則準拠、Pure JavaScript実装
 */
class CanvasManager {
    constructor() {
        // 🎯 基本プロパティ
        this.app = null;
        this.canvasElement = null;
        this.width = 800;
        this.height = 600;
        
        // 🎯 レイヤーシステム
        this.layers = {
            background: null,
            grid: null,
            drawing: null,
            overlay: null,
            ui: null
        };
        
        // 🎯 描画データ
        this.paths = [];
        this.currentPath = null;
        this.isDrawing = false;
        
        // 🎯 グリッドシステム
        this.grid = null;
        this.gridSettings = {
            enabled: false,
            size: 20,
            color: 0x333333,
            alpha: 0.3,
            type: 'square' // square, dot, line
        };
        
        // 🎯 背景設定
        this.background = {
            color: 0xFFFFFF,
            texture: null,
            alpha: 1.0
        };
        
        // 🎯 PixiJS拡張機能検出
        this.extensions = {
            gsapAvailable: typeof gsap !== 'undefined',
            // 📋 V8_MIGRATION: PixiJS v8機能検出予定
            pixiV8Features: false
        };
        
        // 🎯 リサイズシステム（Phase1.2-STEP3）
        this.resizeHistory = {
            entries: [],
            maxEntries: 20,
            currentIndex: -1
        };
        
        this.resizeSettings = {
            enabled: true,
            preserveContent: true,
            centerContent: true,
            animationDuration: 0.3,
            constrainProportions: false,
            minSize: { width: 100, height: 100 },
            maxSize: { width: 4096, height: 4096 }
        };
        
        this.resizeUI = {
            panel: null,
            widthInput: null,
            heightInput: null,
            applyButton: null,
            applyCenterButton: null,
            presetButtons: null,
            statusDisplay: null
        };
        
        // 🎯 バージョン・ステータス
        this.version = 'Phase1.2-STEP3-Fixed';
        this.initialized = false;
        
        console.log('🎨 CanvasManager構築完了');
    }
    
    // ==========================================
    // 🎯 初期化・セットアップ
    // ==========================================
    
    /**
     * Canvas Manager初期化
     * @param {Object} config - 初期化設定
     */
    async initialize(config = {}) {
        console.log('🎨 CanvasManager初期化開始...');
        
        try {
            // 🎯 設定マージ
            this.mergeConfig(config);
            
            // 🎯 PixiJS Application作成
            await this.createPixiApp();
            
            // 🎯 キャンバス要素セットアップ
            this.setupCanvasElement();
            
            // 🎯 レイヤーシステム初期化
            this.initializeLayers();
            
            // 🎯 背景・グリッド初期化
            this.initializeBackground();
            this.initializeGrid();
            
            // 🎯 イベントハンドラー設定
            this.setupEventHandlers();
            
            // 🎯 リサイズシステム初期化（Phase1.2-STEP3）
            this.initializeResizeSystem();
            
            // 🎯 初期化完了
            this.initialized = true;
            
            // 🎯 成功イベント発火
            this.dispatchEvent('canvas-initialized', {
                width: this.width,
                height: this.height,
                version: this.version
            });
            
            console.log('✅ CanvasManager初期化完了');
            return true;
            
        } catch (error) {
            console.error('❌ CanvasManager初期化エラー:', error);
            
            // Error Manager連携
            if (window.ErrorManager) {
                window.ErrorManager.handleError('canvas-init', error);
            }
            
            throw error;
        }
    }
    
    /**
     * 設定マージ
     * @param {Object} config - 設定オブジェクト
     */
    mergeConfig(config) {
        // 基本サイズ
        if (config.width) this.width = config.width;
        if (config.height) this.height = config.height;
        
        // 背景設定
        if (config.background) {
            Object.assign(this.background, config.background);
        }
        
        // グリッド設定
        if (config.grid) {
            Object.assign(this.gridSettings, config.grid);
        }
        
        // リサイズ設定
        if (config.resize) {
            Object.assign(this.resizeSettings, config.resize);
        }
        
        console.log('⚙️ Canvas設定マージ完了');
    }
    
    /**
     * PixiJS Application作成
     */
    async createPixiApp() {
        try {
            // 📋 V8_MIGRATION: PixiJS v8では new PIXI.Application() に変更予定
            const appConfig = {
                width: this.width,
                height: this.height,
                backgroundColor: this.background.color,
                resolution: window.devicePixelRatio || 1,
                autoDensity: true,
                powerPreference: 'high-performance',
                // 📋 V8_MIGRATION: backgroundAlpha に名称変更予定
                transparent: false
            };
            
            // PixiJS v7 互換
            if (PIXI.VERSION.startsWith('7')) {
                this.app = new PIXI.Application(appConfig);
            } else {
                // 📋 V8_MIGRATION: v8 対応
                this.app = new PIXI.Application();
                await this.app.init(appConfig);
            }
            
            console.log(`🎭 PixiJS Application作成完了 (${PIXI.VERSION})`);
            
        } catch (error) {
            console.error('❌ PixiJS Application作成エラー:', error);
            throw error;
        }
    }
    
    /**
     * キャンバス要素セットアップ
     */
    setupCanvasElement() {
        // キャンバス要素取得
        this.canvasElement = this.app.canvas || this.app.view;
        
        if (!this.canvasElement) {
            throw new Error('PixiJSキャンバス要素が取得できません');
        }
        
        // DOM追加
        const container = document.getElementById('canvas-container');
        if (container) {
            container.appendChild(this.canvasElement);
        } else {
            document.body.appendChild(this.canvasElement);
        }
        
        // スタイル設定
        this.canvasElement.style.display = 'block';
        this.canvasElement.style.cursor = 'crosshair';
        
        // データ属性
        this.canvasElement.setAttribute('data-canvas-manager', this.version);
        
        console.log('📱 キャンバス要素セットアップ完了');
    }
    
    /**
     * レイヤーシステム初期化
     */
    initializeLayers() {
        // 各レイヤー作成
        this.layers.background = new PIXI.Container();
        this.layers.grid = new PIXI.Container();
        this.layers.drawing = new PIXI.Container();
        this.layers.overlay = new PIXI.Container();
        this.layers.ui = new PIXI.Container();
        
        // レイヤー名設定
        this.layers.background.name = 'background';
        this.layers.grid.name = 'grid';
        this.layers.drawing.name = 'drawing';
        this.layers.overlay.name = 'overlay';
        this.layers.ui.name = 'ui';
        
        // ステージに追加（奥から手前へ）
        this.app.stage.addChild(this.layers.background);
        this.app.stage.addChild(this.layers.grid);
        this.app.stage.addChild(this.layers.drawing);
        this.app.stage.addChild(this.layers.overlay);
        this.app.stage.addChild(this.layers.ui);
        
        // インタラクティブ設定
        this.layers.drawing.interactive = true;
        this.layers.drawing.hitArea = new PIXI.Rectangle(0, 0, this.width, this.height);
        
        console.log('🗂️ レイヤーシステム初期化完了');
    }
    
    /**
     * 背景初期化
     */
    initializeBackground() {
        const bg = new PIXI.Graphics();
        bg.beginFill(this.background.color, this.background.alpha);
        bg.drawRect(0, 0, this.width, this.height);
        bg.endFill();
        
        this.layers.background.addChild(bg);
        this.backgroundGraphics = bg;
        
        console.log('🖼️ 背景初期化完了');
    }
    
    /**
     * グリッド初期化
     */
    initializeGrid() {
        if (!this.gridSettings.enabled) {
            return;
        }
        
        this.grid = new PIXI.Graphics();
        this.updateGrid();
        this.layers.grid.addChild(this.grid);
        
        console.log('⚏ グリッド初期化完了');
    }
    
    /**
     * イベントハンドラー設定
     */
    setupEventHandlers() {
        // 描画イベント
        this.layers.drawing.on('pointerdown', this.onDrawStart.bind(this));
        this.layers.drawing.on('pointermove', this.onDrawMove.bind(this));
        this.layers.drawing.on('pointerup', this.onDrawEnd.bind(this));
        this.layers.drawing.on('pointerupoutside', this.onDrawEnd.bind(this));
        
        // リサイズイベント
        window.addEventListener('resize', this.onWindowResize.bind(this));
        
        console.log('🎮 イベントハンドラー設定完了');
    }
    
    // ==========================================
    // 🎯 描画機能
    // ==========================================
    
    /**
     * 描画開始
     * @param {PIXI.FederatedPointerEvent} event - ポインターイベント
     */
    onDrawStart(event) {
        if (this.isDrawing) return;
        
        this.isDrawing = true;
        const position = event.data.getLocalPosition(this.layers.drawing);
        
        // 新しいパス作成
        this.currentPath = {
            id: this.generatePathId(),
            points: [{ x: position.x, y: position.y }],
            graphics: new PIXI.Graphics(),
            timestamp: Date.now(),
            tool: this.getCurrentTool()
        };
        
        // 描画開始
        this.currentPath.graphics.lineStyle(2, 0x000000, 1);
        this.currentPath.graphics.moveTo(position.x, position.y);
        
        this.layers.drawing.addChild(this.currentPath.graphics);
        
        // Memory Manager連携
        if (window.MemoryManager) {
            window.MemoryManager.record('draw-start', {
                pathId: this.currentPath.id,
                position: { x: position.x, y: position.y }
            });
        }
        
        console.log(`✏️ 描画開始: Path ${this.currentPath.id}`);
    }
    
    /**
     * 描画移動
     * @param {PIXI.FederatedPointerEvent} event - ポインターイベント
     */
    onDrawMove(event) {
        if (!this.isDrawing || !this.currentPath) return;
        
        const position = event.data.getLocalPosition(this.layers.drawing);
        
        // ポイント追加
        this.currentPath.points.push({ x: position.x, y: position.y });
        
        // 描画更新
        this.currentPath.graphics.lineTo(position.x, position.y);
    }
    
    /**
     * 描画終了
     * @param {PIXI.FederatedPointerEvent} event - ポインターイベント
     */
    onDrawEnd(event) {
        if (!this.isDrawing || !this.currentPath) return;
        
        this.isDrawing = false;
        
        // パス保存
        this.paths.push(this.currentPath);
        
        // Memory Manager連携
        if (window.MemoryManager) {
            window.MemoryManager.record('draw-end', {
                pathId: this.currentPath.id,
                pointCount: this.currentPath.points.length
            });
        }
        
        // イベント発火
        this.dispatchEvent('path-complete', {
            path: this.currentPath,
            totalPaths: this.paths.length
        });
        
        console.log(`✏️ 描画終了: Path ${this.currentPath.id} (${this.currentPath.points.length}点)`);
        
        this.currentPath = null;
    }
    
    /**
     * パスID生成
     * @returns {string} 一意のパスID
     */
    generatePathId() {
        return `path_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
    
    /**
     * 現在のツール取得
     * @returns {string} ツール名
     */
    getCurrentTool() {
        // Tool Manager連携
        if (window.ToolManager) {
            return window.ToolManager.getCurrentTool();
        }
        return 'pen';
    }
    
    // ==========================================
    // 🎯 リサイズシステム（Phase1.2-STEP3）
    // ==========================================
    
    /**
     * リサイズシステム初期化
     */
    initializeResizeSystem() {
        console.log('📏 リサイズシステム初期化開始...');
        
        try {
            // UI要素セットアップ
            this.setupResizeUI();
            
            // イベントハンドラー設定
            this.setupResizeEventHandlers();
            
            console.log('✅ リサイズシステム初期化完了');
        } catch (error) {
            console.error('❌ リサイズシステム初期化エラー:', error);
        }
    }
    
    /**
     * リサイズUI要素セットアップ
     */
    setupResizeUI() {
        // リサイズツールボタン有効化
        const resizeTool = document.getElementById('resize-tool');
        if (resizeTool) {
            resizeTool.classList.remove('disabled');
            resizeTool.style.opacity = '1';
            resizeTool.style.cursor = 'pointer';
        }
        
        // UI要素取得
        this.resizeUI.panel = document.getElementById('resize-settings');
        this.resizeUI.widthInput = document.getElementById('canvas-width');
        this.resizeUI.heightInput = document.getElementById('canvas-height');
        this.resizeUI.applyButton = document.getElementById('apply-resize');
        this.resizeUI.applyCenterButton = document.getElementById('apply-resize-center');
        this.resizeUI.presetButtons = document.querySelectorAll('.resize-button[data-size]');
        this.resizeUI.statusDisplay = document.getElementById('canvas-info');
        
        // 現在サイズ反映
        this.updateResizeUI();
        
        console.log('🎛️ リサイズUI要素セットアップ完了');
    }
    
    /**
     * リサイズイベントハンドラー設定
     */
    setupResizeEventHandlers() {
        const ui = this.resizeUI;
        
        // 適用ボタン
        if (ui.applyButton) {
            ui.applyButton.addEventListener('click', () => {
                this.applyResize(false);
            });
        }
        
        // 中央寄せ適用ボタン
        if (ui.applyCenterButton) {
            ui.applyCenterButton.addEventListener('click', () => {
                this.applyResize(true);
            });
        }
        
        // プリセットボタン
        if (ui.presetButtons) {
            ui.presetButtons.forEach(button => {
                button.addEventListener('click', (event) => {
                    const sizeData = event.target.dataset.size;
                    if (sizeData) {
                        const [width, height] = sizeData.split(',').map(Number);
                        this.setResizePreset(width, height);
                    }
                });
            });
        }
        
        // 入力欄変更監視
        if (ui.widthInput) {
            ui.widthInput.addEventListener('input', () => {
                this.validateResizeInput();
            });
        }
        
        if (ui.heightInput) {
            ui.heightInput.addEventListener('input', () => {
                this.validateResizeInput();
            });
        }
        
        // キーボードショートカット
        document.addEventListener('keydown', (event) => {
            this.handleResizeKeyboard(event);
        });
        
        console.log('⌨️ リサイズイベントハンドラー設定完了');
    }
    
    /**
     * リサイズ実行（メイン機能）
     * @param {boolean} centerContent - コンテンツを中央寄せするか
     * @returns {boolean} 実行成功
     */
    applyResize(centerContent = false) {
        if (!this.resizeSettings.enabled) {
            console.warn('⚠️ リサイズ機能が無効化されています');
            return false;
        }
        
        const ui = this.resizeUI;
        const newWidth = parseInt(ui.widthInput.value);
        const newHeight = parseInt(ui.heightInput.value);
        
        // バリデーション
        if (!this.validateResizeValues(newWidth, newHeight)) {
            this.showResizeError('無効なサイズが指定されました');
            return false;
        }
        
        // 現在サイズと同じ場合はスキップ
        if (newWidth === this.width && newHeight === this.height) {
            console.log('📏 サイズ変更なし - スキップ');
            return true;
        }
        
        console.log(`📏 リサイズ実行開始: ${this.width}×${this.height} → ${newWidth}×${newHeight}`);
        
        try {
            // 履歴保存
            this.saveResizeToHistory();
            
            // リサイズ実行
            const success = this.executeResize(newWidth, newHeight, centerContent);
            
            if (success) {
                // UI更新
                this.updateResizeUI();
                
                // イベント発火
                this.dispatchEvent('resize-complete', {
                    oldWidth: this.width,
                    oldHeight: this.height,
                    newWidth,
                    newHeight,
                    centerContent
                });
                
                console.log(`✅ リサイズ完了: ${newWidth}×${newHeight}`);
            }
            
            return success;
            
        } catch (error) {
            console.error('❌ リサイズ実行エラー:', error);
            this.showResizeError(`リサイズに失敗しました: ${error.message}`);
            return false;
        }
    }
    
    /**
     * リサイズ実行（コア処理）
     * @param {number} newWidth - 新しい幅
     * @param {number} newHeight - 新しい高さ  
     * @param {boolean} centerContent - コンテンツ中央寄せ
     * @returns {boolean} 実行成功
     */
    executeResize(newWidth, newHeight, centerContent) {
        const oldWidth = this.width;
        const oldHeight = this.height;
        
        // コンテンツ境界取得（中央寄せ用）
        const contentBounds = centerContent ? this.getContentBounds() : null;
        
        // PixiJS Applicationリサイズ
        // 📋 V8_MIGRATION: app.resize()メソッドに変更予定
        if (this.app.renderer && typeof this.app.renderer.resize === 'function') {
            this.app.renderer.resize(newWidth, newHeight);
        } else {
            // 📋 V8_MIGRATION: v8対応
            this.app.screen = new PIXI.Rectangle(0, 0, newWidth, newHeight);
        }
        
        // キャンバス要素サイズ更新
        if (this.canvasElement) {
            this.canvasElement.style.width = newWidth + 'px';
            this.canvasElement.style.height = newHeight + 'px';
        }
        
        // 内部サイズ更新
        this.width = newWidth;
        this.height = newHeight;
        
        // ヒットエリア更新
        if (this.layers.drawing) {
            this.layers.drawing.hitArea = new PIXI.Rectangle(0, 0, newWidth, newHeight);
        }
        
        // 背景更新
        this.updateBackground();
        
        // グリッド更新
        if (this.grid && this.grid.visible) {
            this.updateGrid();
        }
        
        // コンテンツ中央寄せ
        if (centerContent && contentBounds) {
            this.centerExistingContent(contentBounds, oldWidth, oldHeight, newWidth, newHeight);
        }
        
        return true;
    }
    
    /**
     * 既存コンテンツ中央寄せ
     * @param {Object} contentBounds - コンテンツ境界
     * @param {number} oldWidth - 旧幅
     * @param {number} oldHeight - 旧高さ
     * @param {number} newWidth - 新幅
     * @param {number} newHeight - 新高さ
     */
    centerExistingContent(contentBounds, oldWidth, oldHeight, newWidth, newHeight) {
        if (!contentBounds || this.paths.length === 0) {
            return;
        }
        
        // オフセット計算
        const offsetX = (newWidth - oldWidth) / 2;
        const offsetY = (newHeight - oldHeight) / 2;
        
        console.log(`🎯 コンテンツ中央寄せ: オフセット(${offsetX}, ${offsetY})`);
        
        // 全パス移動
        this.paths.forEach(path => {
            if (path.points && Array.isArray(path.points)) {
                path.points.forEach(point => {
                    point.x += offsetX;
                    point.y += offsetY;
                });
            }
            
            // グラフィクス位置更新
            if (path.graphics) {
                if (this.extensions.gsapAvailable && this.resizeSettings.animationDuration > 0) {
                    // GSAPアニメーション
                    gsap.to(path.graphics, {
                        duration: this.resizeSettings.animationDuration,
                        x: path.graphics.x + offsetX,
                        y: path.graphics.y + offsetY,
                        ease: "power2.out"
                    });
                } else {
                    // 即座に移動
                    path.graphics.x += offsetX;
                    path.graphics.y += offsetY;
                }
            }
        });
    }
    
    /**
     * コンテンツ境界取得
     * @returns {Object|null} 境界情報
     */
    getContentBounds() {
        if (this.paths.length === 0) {
            return null;
        }
        
        let minX = Infinity, minY = Infinity;
        let maxX = -Infinity, maxY = -Infinity;
        
        this.paths.forEach(path => {
            if (path.points && path.points.length > 0) {
                path.points.forEach(point => {
                    minX = Math.min(minX, point.x);
                    minY = Math.min(minY, point.y);
                    maxX = Math.max(maxX, point.x);
                    maxY = Math.max(maxY, point.y);
                });
            }
        });
        
        if (minX === Infinity) {
            return null;
        }
        
        return {
            x: minX,
            y: minY,
            width: maxX - minX,
            height: maxY - minY
        };
    }
    
    /**
     * リサイズ値バリデーション
     * @param {number} width - 幅
     * @param {number} height - 高さ
     * @returns {boolean} 有効性
     */
    validateResizeValues(width, height) {
        const settings = this.resizeSettings;
        
        // 数値チェック
        if (!Number.isInteger(width) || !Number.isInteger(height)) {
            return false;
        }
        
        // 範囲チェック
        if (width < settings.minSize.width || width > settings.maxSize.width) {
            return false;
        }
        
        if (height < settings.minSize.height || height > settings.maxSize.height) {
            return false;
        }
        
        return true;
    }
    
    /**
     * 入力値バリデーション（リアルタイム）
     * @returns {boolean} 有効性
     */
    validateResizeInput() {
        const ui = this.resizeUI;
        const width = parseInt(ui.widthInput.value);
        const height = parseInt(ui.heightInput.value);
        
        const isValid = this.validateResizeValues(width, height);
        
        // UI状態更新
        if (ui.applyButton) ui.applyButton.disabled = !isValid;
        if (ui.applyCenterButton) ui.applyCenterButton.disabled = !isValid;
        
        // 視覚的フィードバック
        const inputs = [ui.widthInput, ui.heightInput].filter(Boolean);
        inputs.forEach(input => {
            if (isValid) {
                input.style.borderColor = '';
            } else {
                input.style.borderColor = '#cc3333';
            }
        });
        
        return isValid;
    }
    
    /**
     * プリセットサイズ設定
     * @param {number} width - 幅
     * @param {number} height - 高さ
     */
    setResizePreset(width, height) {
        const ui = this.resizeUI;
        
        if (ui.widthInput) ui.widthInput.value = width;
        if (ui.heightInput) ui.heightInput.value = height;
        
        // バリデーション実行
        this.validateResizeInput();
        
        console.log(`📐 プリセット設定: ${width}×${height}`);
    }
    
    /**
     * リサイズUI更新
     */
    updateResizeUI() {
        const ui = this.resizeUI;
        
        // 入力欄更新
        if (ui.widthInput) ui.widthInput.value = this.width;
        if (ui.heightInput) ui.heightInput.value = this.height;
        
        // ステータス表示更新
        if (ui.statusDisplay) {
            ui.statusDisplay.textContent = `${this.width}×${this.height}px`;
        }
    }
    
    /**
     * リサイズエラー表示
     * @param {string} message - エラーメッセージ
     */
    showResizeError(message) {
        console.error(`❌ リサイズエラー: ${message}`);
        
        // Error Manager連携
        if (window.ErrorManager) {
            window.ErrorManager.handleError('canvas-resize', new Error(message));
        }
        
        // 一時的なエラー表示（UI Manager統合予定）
        // TODO: Phase1.3でUI Manager統合時に改善
        if (typeof alert !== 'undefined') {
            alert(`リサイズエラー: ${message}`);
        }
    }
    
    /**
     * リサイズキーボードハンドラー
     * @param {KeyboardEvent} event - キーボードイベント
     */
    handleResizeKeyboard(event) {
        // Ctrl/Cmd + R: リサイズパネル表示切り替え
        if ((event.ctrlKey || event.metaKey) && event.key === 'r') {
            event.preventDefault();
            this.toggleResizePanel();
            return;
        }
        
        // リサイズパネル表示中のショートカット
        if (this.resizeUI.panel && !this.resizeUI.panel.hidden) {
            // Enter: 適用
            if (event.key === 'Enter') {
                event.preventDefault();
                this.applyResize(event.shiftKey);
                return;
            }
            
            // Escape: パネル閉じる
            if (event.key === 'Escape') {
                event.preventDefault();
                this.hideResizePanel();
                return;
            }
        }
    }
    
    /**
     * リサイズパネル表示切り替え
     */
    toggleResizePanel() {
        const panel = this.resizeUI.panel;
        if (!panel) return;
        
        if (panel.style.display === 'none' || panel.hidden) {
            this.showResizePanel();
        } else {
            this.hideResizePanel();
        }
    }
    
    /**
     * リサイズパネル表示
     */
    showResizePanel() {
        const panel = this.resizeUI.panel;
        if (!panel) return;
        
        panel.style.display = 'block';
        panel.hidden = false;
        panel.classList.add('show');
        
        // 入力フォーカス
        if (this.resizeUI.widthInput) {
            this.resizeUI.widthInput.focus();
        }
        
        console.log('📐 リサイズパネル表示');
    }
    
    /**
     * リサイズパネル非表示
     */
    hideResizePanel() {
        const panel = this.resizeUI.panel;
        if (!panel) return;
        
        panel.classList.remove('show');
        setTimeout(() => {
            panel.style.display = 'none';
            panel.hidden = true;
        }, 300); // アニメーション時間
        
        console.log('📐 リサイズパネル非表示');
    }
    
    // ==========================================
    // 🎯 履歴管理システム
    // ==========================================
    
    /**
     * リサイズ履歴保存
     */
    saveResizeToHistory() {
        const historyEntry = {
            timestamp: Date.now(),
            width: this.width,
            height: this.height,
            contentBounds: this.getContentBounds()
        };
        
        const history = this.resizeHistory;
        
        // 現在位置以降の履歴削除（分岐）
        if (history.currentIndex < history.entries.length - 1) {
            history.entries = history.entries.slice(0, history.currentIndex + 1);
        }
        
        // 新しい履歴追加
        history.entries.push(historyEntry);
        history.currentIndex = history.entries.length - 1;
        
        // 履歴サイズ制限
        if (history.entries.length > history.maxEntries) {
            history.entries.shift();
            history.currentIndex--;
        }
        
        // Memory Manager連携
        if (window.MemoryManager) {
            window.MemoryManager.record('canvas-resize', historyEntry);
        }
        
        console.log(`💾 リサイズ履歴保存: ${historyEntry.width}×${historyEntry.height}`);
    }
    
    /**
     * リサイズアンドゥ
     * @returns {boolean} 実行成功
     */
    undoResize() {
        const history = this.resizeHistory;
        
        if (history.currentIndex <= 0) {
            console.warn('⚠️ アンドゥ可能なリサイズ履歴がありません');
            return false;
        }
        
        history.currentIndex--;
        const targetEntry = history.entries[history.currentIndex];
        
        console.log(`↩️ リサイズアンドゥ: ${targetEntry.width}×${targetEntry.height}`);
        
        return this.restoreFromHistory(targetEntry);
    }
    
    /**
     * リサイズリドゥ
     * @returns {boolean} 実行成功
     */
    redoResize() {
        const history = this.resizeHistory;
        
        if (history.currentIndex >= history.entries.length - 1) {
            console.warn('⚠️ リドゥ可能なリサイズ履歴がありません');
            return false;
        }
        
        history.currentIndex++;
        const targetEntry = history.entries[history.currentIndex];
        
        console.log(`↪️ リサイズリドゥ: ${targetEntry.width}×${targetEntry.height}`);
        
        return this.restoreFromHistory(targetEntry);
    }
    
    /**
     * 履歴からリサイズ復元
     * @param {Object} historyEntry - 履歴エントリ
     * @returns {boolean} 実行成功
     */
    restoreFromHistory(historyEntry) {
        try {
            // 履歴保存を一時無効化
            const originalEnabled = this.resizeSettings.enabled;
            this.resizeSettings.enabled = false;
            
            // リサイズ実行
            const success = this.executeResize(historyEntry.width, historyEntry.height, false);
            
            if (success) {
                // UI更新
                this.updateResizeUI();
                
                // イベント発火
                this.dispatchEvent('resize-history-restore', {
                    width: historyEntry.width,
                    height: historyEntry.height,
                    timestamp: historyEntry.timestamp
                });
            }
            
            // 履歴保存を再有効化
            this.resizeSettings.enabled = originalEnabled;
            
            return success;
            
        } catch (error) {
            console.error('❌ 履歴復元エラー:', error);
            return false;
        }
    }
    
    // ==========================================
    // 🎯 グリッド・背景管理
    // ==========================================
    
    /**
     * グリッド更新
     */
    updateGrid() {
        if (!this.grid) return;
        
        this.grid.clear();
        
        if (!this.gridSettings.enabled) {
            this.grid.visible = false;
            return;
        }
        
        this.grid.visible = true;
        this.grid.lineStyle(1, this.gridSettings.color, this.gridSettings.alpha);
        
        const size = this.gridSettings.size;
        
        // 縦線
        for (let x = 0; x <= this.width; x += size) {
            this.grid.moveTo(x, 0);
            this.grid.lineTo(x, this.height);
        }
        
        // 横線
        for (let y = 0; y <= this.height; y += size) {
            this.grid.moveTo(0, y);
            this.grid.lineTo(this.width, y);
        }
        
        console.log(`⚏ グリッド更新: ${size}px`);
    }
    
    /**
     * 背景更新
     */
    updateBackground() {
        if (!this.backgroundGraphics) return;
        
        this.backgroundGraphics.clear();
        this.backgroundGraphics.beginFill(this.background.color, this.background.alpha);
        this.backgroundGraphics.drawRect(0, 0, this.width, this.height);
        this.backgroundGraphics.endFill();
        
        console.log(`🖼️ 背景更新: ${this.width}×${this.height}`);
    }
    
    /**
     * グリッド表示切り替え
     * @param {boolean} enabled - 有効状態
     */
    toggleGrid(enabled = null) {
        if (enabled === null) {
            this.gridSettings.enabled = !this.gridSettings.enabled;
        } else {
            this.gridSettings.enabled = enabled;
        }
        
        this.updateGrid();
        
        console.log(`⚏ グリッド${this.gridSettings.enabled ? '有効' : '無効'}`);
    }
    
    /**
     * 背景色変更
     * @param {number} color - 背景色（16進数）
     * @param {number} alpha - 透明度（0-1）
     */
    setBackgroundColor(color, alpha = 1.0) {
        this.background.color = color;
        this.background.alpha = alpha;
        
        this.updateBackground();
        
        // PixiJS Applicationの背景も更新
        if (this.app.renderer) {
            // 📋 V8_MIGRATION: backgroundColorプロパティに変更予定
            this.app.renderer.backgroundColor = color;
        }
        
        console.log(`🎨 背景色変更: 0x${color.toString(16).toUpperCase()}`);
    }
    
    // ==========================================
    // 🎯 ウィンドウリサイズ対応
    // ==========================================
    
    /**
     * ウィンドウリサイズハンドラー
     * @param {Event} event - リサイズイベント
     */
    onWindowResize(event) {
        // 自動リサイズが有効な場合のみ実行
        if (!this.resizeSettings.autoResize) {
            return;
        }
        
        const container = document.getElementById('canvas-container');
        if (!container) return;
        
        const containerRect = container.getBoundingClientRect();
        const newWidth = Math.floor(containerRect.width);
        const newHeight = Math.floor(containerRect.height);
        
        // 最小サイズチェック
        if (newWidth < this.resizeSettings.minSize.width || 
            newHeight < this.resizeSettings.minSize.height) {
            return;
        }
        
        console.log(`🪟 ウィンドウリサイズ検出: ${newWidth}×${newHeight}`);
        
        // デバウンス処理
        clearTimeout(this.windowResizeTimeout);
        this.windowResizeTimeout = setTimeout(() => {
            this.executeResize(newWidth, newHeight, true);
            this.updateResizeUI();
        }, 250);
    }
    
    // ==========================================
    // 🎯 高度リサイズ機能
    // ==========================================
    
    /**
     * 比例リサイズ（縦横比維持）
     * @param {number} newWidth - 新しい幅（nullの場合は高さから計算）
     * @param {number} newHeight - 新しい高さ（nullの場合は幅から計算）
     * @returns {boolean} 実行成功
     */
    resizeProportional(newWidth = null, newHeight = null) {
        const currentRatio = this.width / this.height;
        
        if (newWidth && !newHeight) {
            // 幅指定：高さを自動計算
            newHeight = Math.round(newWidth / currentRatio);
        } else if (newHeight && !newWidth) {
            // 高さ指定：幅を自動計算
            newWidth = Math.round(newHeight * currentRatio);
        } else if (!newWidth && !newHeight) {
            console.warn('⚠️ 比例リサイズ: サイズが指定されていません');
            return false;
        }
        
        // UI更新
        if (this.resizeUI.widthInput) this.resizeUI.widthInput.value = newWidth;
        if (this.resizeUI.heightInput) this.resizeUI.heightInput.value = newHeight;
        
        return this.applyResize(true);
    }
    
    /**
     * スマートリサイズ（コンテンツに合わせる）
     * @param {number} padding - 余白サイズ
     * @returns {boolean} 実行成功
     */
    resizeToContent(padding = 50) {
        const bounds = this.getContentBounds();
        
        if (!bounds) {
            console.warn('⚠️ スマートリサイズ: コンテンツが見つかりません');
            return false;
        }
        
        const newWidth = Math.ceil(bounds.width + padding * 2);
        const newHeight = Math.ceil(bounds.height + padding * 2);
        
        console.log(`🎯 スマートリサイズ: ${bounds.width}×${bounds.height} → ${newWidth}×${newHeight}`);
        
        // UI更新
        if (this.resizeUI.widthInput) this.resizeUI.widthInput.value = newWidth;
        if (this.resizeUI.heightInput) this.resizeUI.heightInput.value = newHeight;
        
        return this.applyResize(true);
    }
    
    // ==========================================
    // 🎯 パス・レイヤー管理
    // ==========================================
    
    /**
     * パス削除
     * @param {string} pathId - パスID
     * @returns {boolean} 削除成功
     */
    deletePath(pathId) {
        const pathIndex = this.paths.findIndex(path => path.id === pathId);
        
        if (pathIndex === -1) {
            console.warn(`⚠️ パスが見つかりません: ${pathId}`);
            return false;
        }
        
        const path = this.paths[pathIndex];
        
        // グラフィクス削除
        if (path.graphics && path.graphics.parent) {
            path.graphics.parent.removeChild(path.graphics);
            path.graphics.destroy();
        }
        
        // パス配列から削除
        this.paths.splice(pathIndex, 1);
        
        console.log(`🗑️ パス削除: ${pathId}`);
        
        // イベント発火
        this.dispatchEvent('path-deleted', {
            pathId,
            remainingPaths: this.paths.length
        });
        
        return true;
    }
    
    /**
     * 全パスクリア
     */
    clearAllPaths() {
        console.log(`🗑️ 全パスクリア開始: ${this.paths.length}個`);
        
        // 各パスのグラフィクス削除
        this.paths.forEach(path => {
            if (path.graphics && path.graphics.parent) {
                path.graphics.parent.removeChild(path.graphics);
                path.graphics.destroy();
            }
        });
        
        // パス配列クリア
        this.paths = [];
        this.currentPath = null;
        this.isDrawing = false;
        
        // イベント発火
        this.dispatchEvent('all-paths-cleared', {
            timestamp: Date.now()
        });
        
        console.log('✅ 全パスクリア完了');
    }
    
    /**
     * レイヤー表示切り替え
     * @param {string} layerName - レイヤー名
     * @param {boolean} visible - 表示状態
     */
    setLayerVisible(layerName, visible) {
        const layer = this.layers[layerName];
        
        if (!layer) {
            console.warn(`⚠️ レイヤーが見つかりません: ${layerName}`);
            return;
        }
        
        layer.visible = visible;
        
        console.log(`👁️ レイヤー${layerName}: ${visible ? '表示' : '非表示'}`);
        
        // イベント発火
        this.dispatchEvent('layer-visibility-changed', {
            layerName,
            visible
        });
    }
    
    // ==========================================
    // 🎯 エクスポート・インポート
    // ==========================================
    
    /**
     * キャンバスデータエクスポート
     * @returns {Object} エクスポートデータ
     */
    exportCanvasData() {
        const data = {
            version: this.version,
            timestamp: Date.now(),
            canvas: {
                width: this.width,
                height: this.height,
                background: this.background,
                grid: this.gridSettings
            },
            paths: this.paths.map(path => ({
                id: path.id,
                points: path.points,
                tool: path.tool,
                timestamp: path.timestamp
            }))
        };
        
        console.log(`📦 キャンバスデータエクスポート: ${data.paths.length}パス`);
        
        return data;
    }
    
    /**
     * キャンバスデータインポート
     * @param {Object} data - インポートデータ
     * @returns {boolean} インポート成功
     */
    importCanvasData(data) {
        try {
            console.log('📥 キャンバスデータインポート開始...');
            
            // バリデーション
            if (!data || !data.canvas || !data.paths) {
                throw new Error('無効なデータ形式');
            }
            
            // 現在のパスクリア
            this.clearAllPaths();
            
            // キャンバス設定復元
            if (data.canvas.width && data.canvas.height) {
                this.executeResize(data.canvas.width, data.canvas.height, false);
            }
            
            if (data.canvas.background) {
                Object.assign(this.background, data.canvas.background);
                this.updateBackground();
            }
            
            if (data.canvas.grid) {
                Object.assign(this.gridSettings, data.canvas.grid);
                this.updateGrid();
            }
            
            // パス復元
            data.paths.forEach(pathData => {
                const path = {
                    id: pathData.id || this.generatePathId(),
                    points: pathData.points || [],
                    tool: pathData.tool || 'pen',
                    timestamp: pathData.timestamp || Date.now(),
                    graphics: new PIXI.Graphics()
                };
                
                // パス描画
                if (path.points.length > 0) {
                    path.graphics.lineStyle(2, 0x000000, 1);
                    path.graphics.moveTo(path.points[0].x, path.points[0].y);
                    
                    for (let i = 1; i < path.points.length; i++) {
                        path.graphics.lineTo(path.points[i].x, path.points[i].y);
                    }
                    
                    this.layers.drawing.addChild(path.graphics);
                }
                
                this.paths.push(path);
            });
            
            // UI更新
            this.updateResizeUI();
            
            // イベント発火
            this.dispatchEvent('canvas-imported', {
                pathCount: this.paths.length,
                canvasSize: { width: this.width, height: this.height }
            });
            
            console.log(`✅ インポート完了: ${this.paths.length}パス`);
            
            return true;
            
        } catch (error) {
            console.error('❌ インポートエラー:', error);
            
            if (window.ErrorManager) {
                window.ErrorManager.handleError('canvas-import', error);
            }
            
            return false;
        }
    }
    
    // ==========================================
    // 🎯 統計・診断システム
    // ==========================================
    
    /**
     * キャンバス統計取得
     * @returns {Object} 統計データ
     */
    getCanvasStats() {
        return {
            canvas: {
                width: this.width,
                height: this.height,
                aspectRatio: this.width / this.height,
                area: this.width * this.height
            },
            content: {
                pathCount: this.paths.length,
                totalPoints: this.paths.reduce((sum, path) => sum + (path.points ? path.points.length : 0), 0),
                bounds: this.getContentBounds()
            },
            layers: Object.entries(this.layers).map(([name, layer]) => ({
                name,
                visible: layer ? layer.visible : false,
                childCount: layer ? layer.children.length : 0
            })),
            settings: {
                grid: this.gridSettings,
                background: this.background,
                resize: this.resizeSettings
            },
            history: {
                resizeEntries: this.resizeHistory.entries.length,
                canUndo: this.resizeHistory.currentIndex > 0,
                canRedo: this.resizeHistory.currentIndex < this.resizeHistory.entries.length - 1
            }
        };
    }
    
    /**
     * システム診断実行
     * @returns {Object} 診断結果
     */
    runDiagnosis() {
        console.group('🔍 Canvas Manager システム診断');
        
        const stats = this.getCanvasStats();
        
        // 機能テスト
        const tests = {
            pixiApp: !!this.app,
            canvasElement: !!this.canvasElement,
            layersInitialized: Object.values(this.layers).every(layer => !!layer),
            resizeSystem: !!this.resizeUI.panel,
            eventHandlers: this.initialized,
            memoryIntegration: !!window.MemoryManager,
            errorIntegration: !!window.ErrorManager
        };
        
        // 診断結果
        const diagnosis = {
            stats,
            tests,
            compliance: {
                phase12Step3: tests.resizeSystem && tests.pixiApp && tests.layersInitialized,
                managerIntegration: tests.memoryIntegration && tests.errorIntegration,
                coreFeatures: tests.pixiApp && tests.canvasElement && tests.eventHandlers
            }
        };
        
        console.log('📊 診断結果:', diagnosis);
        
        // 推奨事項
        const recommendations = [];
        
        if (!tests.pixiApp) recommendations.push('PixiJS Application初期化が必要');
        if (!tests.layersInitialized) recommendations.push('レイヤーシステム初期化が必要');
        if (!tests.resizeSystem) recommendations.push('リサイズシステム有効化が必要');
        if (!tests.memoryIntegration) recommendations.push('Memory Manager連携推奨');
        if (!tests.errorIntegration) recommendations.push('Error Manager連携推奨');
        
        if (recommendations.length > 0) {
            console.warn('⚠️ 推奨事項:', recommendations);
        } else {
            console.log('✅ 全システム正常動作中');
        }
        
        console.groupEnd();
        
        return diagnosis;
    }
    
    // ==========================================
    // 🎯 イベント管理
    // ==========================================
    
    /**
     * イベント発火
     * @param {string} eventType - イベント種別
     * @param {Object} detail - イベント詳細
     */
    dispatchEvent(eventType, detail = {}) {
        const event = new CustomEvent(`canvas-${eventType}`, {
            detail: {
                ...detail,
                timestamp: Date.now(),
                canvasManager: this
            }
        });
        
        // グローバルイベント発火
        if (typeof window !== 'undefined') {
            window.dispatchEvent(event);
        }
        
        // DOM要素イベント発火
        if (this.canvasElement) {
            this.canvasElement.dispatchEvent(event);
        }
        
        console.log(`🎯 イベント発火: canvas-${eventType}`, detail);
    }
    
    // ==========================================
    // 🎯 破棄・クリーンアップ
    // ==========================================
    
    /**
     * Canvas Manager破棄
     */
    destroy() {
        console.log('🗑️ Canvas Manager破棄開始...');
        
        try {
            // 描画停止
            this.isDrawing = false;
            this.currentPath = null;
            
            // パス削除
            this.clearAllPaths();
            
            // イベントハンドラー削除
            if (this.canvasElement) {
                this.canvasElement.remove();
            }
            
            // PixiJS Application破棄
            if (this.app) {
                this.app.destroy(true, true);
                this.app = null;
            }
            
            // タイマークリア
            if (this.windowResizeTimeout) {
                clearTimeout(this.windowResizeTimeout);
            }
            
            // プロパティクリア
            this.layers = {};
            this.paths = [];
            this.resizeHistory.entries = [];
            this.initialized = false;
            
            // イベント発火
            this.dispatchEvent('destroyed', {
                version: this.version
            });
            
            console.log('✅ Canvas Manager破棄完了');
            
        } catch (error) {
            console.error('❌ Canvas Manager破棄エラー:', error);
            
            if (window.ErrorManager) {
                window.ErrorManager.handleError('canvas-destroy', error);
            }
        }
    }
}

// ==========================================
// 🎯 グローバル登録・エクスポート
// ==========================================

// グローバル登録（Phase1.2仕様準拠）
if (typeof window !== 'undefined') {
    window.CanvasManager = CanvasManager;
    console.log('🌐 CanvasManager グローバル登録完了');
}

// ==========================================
// 🎯 Phase1.2-STEP3 実装完了ログ
// ==========================================

console.log('🎨 Canvas Manager Phase1.2-STEP3 実装完了');
console.log('✅ 主要機能:');
console.log('  - PixiJS統合・レイヤー管理・描画システム');
console.log('  - リサイズ機能・履歴管理・キーボードショートカット');  
console.log('  - グリッド・背景・パス管理');
console.log('  - エクスポート・インポート・統計診断');
console.log('  - Manager統合・イベントシステム');
console.log('  - PixiJSv8対応準備・構文エラー修正完了');

console.log('📋 V8_MIGRATION準備済み箇所:');
console.log('  - app.resize() → app.screen更新');
console.log('  - backgroundAlpha → transparent設定');
console.log('  - new Application() → app.init()対応');

/**
 * 📋 使用方法例:
 * 
 * // 初期化
 * const canvasManager = new CanvasManager();
 * await canvasManager.initialize({
 *     width: 1024,
 *     height: 768,
 *     background: { color: 0xFFFFFF },
 *     resize: { enabled: true, centerContent: true }
 * });
 * 
 * // リサイズ
 * canvasManager.applyResize(true); // 中央寄せリサイズ
 * canvasManager.resizeToContent(50); // コンテンツフィット
 * 
 * // データ管理  
 * const data = canvasManager.exportCanvasData();
 * canvasManager.importCanvasData(data);
 * 
 * // 診断
 * const diagnosis = canvasManager.runDiagnosis();
 */