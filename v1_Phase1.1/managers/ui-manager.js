/**
 * 🎨 UIManager - UI系統括制御
 * 責務: 
 * - ツールボタン制御（@pixi/ui Button活用）
 * - ポップアップ管理（@pixi/ui Popup活用）
 * - スライダー制御（@pixi/ui Slider活用）
 * - ステータスバー更新
 * - アイコン管理（pixi-svg + Tabler Icons活用）
 * 
 * 🎯 AI_WORK_SCOPE: UI系統括制御専用ファイル
 * 🎯 DEPENDENCIES: app-core.js, extension-loader.js
 * 📋 SPLIT_PLAN: 500行超過時の分割予定
 * - ButtonManager → ui/button-manager.js
 * - SliderManager → ui/slider-manager.js  
 * - PopupManager → ui/popup-manager.js
 */

class UIManager {
    constructor(appCore) {
        this.appCore = appCore;
        this.extensions = appCore.extensions;
        this.uiContainer = new PIXI.Container();
        this.toolButtons = new Map();
        this.sliders = new Map();
        this.popups = new Map();
        this.statusElements = new Map();
        this.isInitialized = false;
        
        // ふたば☆ちゃんねる風カラーシステム
        this.colors = {
            primary: 0x800000,        // ふたば主線
            secondary: 0xaa5a56,      // セカンダリ
            accent: 0xcf9c97,         // アクセント
            light: 0xe9c2ba,          // 境界線
            cream: 0xf0e0d6,          // キャンバス背景
            background: 0xffffee      // アプリ背景
        };
    }
    
    async init() {
        console.log('🎨 UIManager 初期化開始...');
        
        try {
            await this.setupToolButtons();
            await this.setupSliders();
            await this.setupPopups();
            await this.setupStatusBar();
            await this.loadIcons();
            
            this.appCore.stage.addChild(this.uiContainer);
            this.isInitialized = true;
            console.log('✅ UIManager 初期化完了');
        } catch (error) {
            console.error('❌ UIManager 初期化失敗:', error);
            // フォールバック処理
            await this.initializeFallbackUI();
        }
    }
    
    async setupToolButtons() {
        if (this.extensions.isAvailable('UI')) {
            console.log('✅ @pixi/ui Button使用でツールボタン作成');
            await this.createPixiUIButtons();
        } else {
            console.log('⚠️ @pixi/ui未検出: フォールバックボタン作成');
            await this.createFallbackButtons();
        }
    }
    
    async createPixiUIButtons() {
        // ペンツールボタン（@pixi/ui使用）
        const penButton = new this.extensions.UI.Button({
            text: 'Pen',
            width: 60,
            height: 40,
            backgroundColor: this.colors.primary,
            borderColor: this.colors.accent,
            textColor: 0xffffff,
            fontSize: 12
        });
        
        penButton.x = 10;
        penButton.y = 60;
        
        penButton.onPress.connect(() => {
            this.appCore.getManager('tool')?.setTool('pen');
            this.setActiveButton('pen');
        });
        
        this.toolButtons.set('pen', penButton);
        this.uiContainer.addChild(penButton);
        
        // 消しゴムツールボタン（@pixi/ui使用）
        const eraserButton = new this.extensions.UI.Button({
            text: 'Eraser',
            width: 60,
            height: 40,
            backgroundColor: this.colors.secondary,
            borderColor: this.colors.accent,
            textColor: 0xffffff,
            fontSize: 12
        });
        
        eraserButton.x = 10;
        eraserButton.y = 110;
        
        eraserButton.onPress.connect(() => {
            this.appCore.getManager('tool')?.setTool('eraser');
            this.setActiveButton('eraser');
        });
        
        this.toolButtons.set('eraser', eraserButton);
        this.uiContainer.addChild(eraserButton);
    }
    
    async createFallbackButtons() {
        // 独自実装でのボタン作成（既存デザインの移植）
        console.log('⚠️ @pixi/ui未検出: フォールバックボタン作成');
        
        // ペンボタン（フォールバック）
        const penButton = this.createFallbackButton('Pen', 10, 60, () => {
            this.appCore.getManager('tool')?.setTool('pen');
            this.setActiveButton('pen');
        });
        
        this.toolButtons.set('pen', penButton);
        this.uiContainer.addChild(penButton);
        
        // 消しゴムボタン（フォールバック）
        const eraserButton = this.createFallbackButton('Eraser', 10, 110, () => {
            this.appCore.getManager('tool')?.setTool('eraser');
            this.setActiveButton('eraser');
        });
        
        this.toolButtons.set('eraser', eraserButton);
        this.uiContainer.addChild(eraserButton);
    }
    
    createFallbackButton(text, x, y, onClick) {
        const button = new PIXI.Container();
        button.x = x;
        button.y = y;
        button.interactive = true;
        button.cursor = 'pointer';
        
        // ボタン背景
        const bg = new PIXI.Graphics();
        bg.beginFill(this.colors.primary);
        bg.lineStyle(1, this.colors.accent);
        bg.drawRoundedRect(0, 0, 60, 40, 4);
        bg.endFill();
        
        // ボタンテキスト
        const buttonText = new PIXI.Text(text, {
            fontSize: 12,
            fill: 0xffffff,
            fontFamily: 'Arial'
        });
        buttonText.anchor.set(0.5);
        buttonText.x = 30;
        buttonText.y = 20;
        
        button.addChild(bg, buttonText);
        
        // クリックイベント
        button.on('pointerdown', onClick);
        
        // ホバー効果
        button.on('pointerover', () => {
            bg.tint = 0xcccccc;
        });
        
        button.on('pointerout', () => {
            bg.tint = 0xffffff;
        });
        
        return button;
    }
    
    async setupSliders() {
        if (this.extensions.isAvailable('UI')) {
            console.log('✅ @pixi/ui Slider使用');
            await this.createPixiUISliders();
        } else {
            console.log('⚠️ @pixi/ui未検出: フォールバックスライダー作成');
            await this.createFallbackSliders();
        }
    }
    
    async createPixiUISliders() {
        // ブラシサイズスライダー（@pixi/ui使用）
        const sizeSlider = new this.extensions.UI.Slider({
            min: 1,
            max: 100,
            value: 16,
            width: 200,
            height: 20,
            trackColor: this.colors.light,
            fillColor: this.colors.primary,
            handleColor: this.colors.accent
        });
        
        sizeSlider.x = 80;
        sizeSlider.y = 70;
        
        sizeSlider.onChange.connect((value) => {
            this.appCore.getManager('tool')?.setBrushSize(value);
            this.updateStatusBar('brushSize', value);
        });
        
        this.sliders.set('size', sizeSlider);
        this.uiContainer.addChild(sizeSlider);
        
        // 不透明度スライダー（@pixi/ui使用）
        const opacitySlider = new this.extensions.UI.Slider({
            min: 0,
            max: 100,
            value: 85,
            width: 200,
            height: 20,
            trackColor: this.colors.light,
            fillColor: this.colors.secondary,
            handleColor: this.colors.accent
        });
        
        opacitySlider.x = 80;
        opacitySlider.y = 100;
        
        opacitySlider.onChange.connect((value) => {
            this.appCore.getManager('tool')?.setBrushOpacity(value / 100);
            this.updateStatusBar('opacity', value);
        });
        
        this.sliders.set('opacity', opacitySlider);
        this.uiContainer.addChild(opacitySlider);
    }
    
    async createFallbackSliders() {
        // 独自実装でのスライダー作成
        console.log('⚠️ @pixi/ui未検出: フォールバックスライダー作成');
        
        // 既存のスライダー実装を移植
        // DOMスライダーとの連携維持
        this.setupDOMSliderConnections();
    }
    
    setupDOMSliderConnections() {
        // 既存のDOMスライダーとの連携
        const penSizeSlider = document.getElementById('pen-size-slider');
        const penOpacitySlider = document.getElementById('pen-opacity-slider');
        
        if (penSizeSlider) {
            // DOM側のスライダーイベントをPixiJS側にも反映
            this.setupDOMSliderConnection(penSizeSlider, 'size');
        }
        
        if (penOpacitySlider) {
            this.setupDOMSliderConnection(penOpacitySlider, 'opacity');
        }
    }
    
    setupDOMSliderConnection(element, type) {
        // DOM要素の変更をPixiJS側に反映する連携処理
        // 詳細は既存ui-manager.jsから移植
    }
    
    async setupPopups() {
        if (this.extensions.isAvailable('UI')) {
            console.log('✅ @pixi/ui Popup使用');
            await this.createPixiUIPopups();
        } else {
            console.log('⚠️ @pixi/ui未検出: DOM popupとの連携維持');
            await this.setupDOMPopupConnections();
        }
    }
    
    async createPixiUIPopups() {
        // 設定ポップアップ（@pixi/ui使用）
        this.settingsPopup = new this.extensions.UI.Popup({
            title: '設定',
            content: '設定内容...',
            width: 300,
            height: 200,
            backgroundColor: this.colors.background,
            borderColor: this.colors.accent
        });
        
        this.popups.set('settings', this.settingsPopup);
    }
    
    async setupDOMPopupConnections() {
        // 既存のDOMポップアップとの連携を維持
        const penSettingsPopup = document.getElementById('pen-settings');
        const resizeSettingsPopup = document.getElementById('resize-settings');
        
        if (penSettingsPopup) {
            this.setupDOMPopupConnection(penSettingsPopup, 'pen-settings');
        }
        
        if (resizeSettingsPopup) {
            this.setupDOMPopupConnection(resizeSettingsPopup, 'resize-settings');
        }
    }
    
    setupDOMPopupConnection(element, type) {
        // DOM側のポップアップとの連携維持
        // 既存のドラッグ機能などを保持
    }
    
    async setupStatusBar() {
        // ステータスバー要素の参照を取得
        this.statusElements.set('currentTool', document.getElementById('current-tool'));
        this.statusElements.set('canvasInfo', document.getElementById('canvas-info'));
        this.statusElements.set('currentColor', document.getElementById('current-color'));
        this.statusElements.set('coordinates', document.getElementById('coordinates'));
        this.statusElements.set('pressureMonitor', document.getElementById('pressure-monitor'));
        this.statusElements.set('fps', document.getElementById('fps'));
        this.statusElements.set('gpuUsage', document.getElementById('gpu-usage'));
        this.statusElements.set('memoryUsage', document.getElementById('memory-usage'));
        
        // FPS監視開始
        this.startFPSMonitoring();
    }
    
    startFPSMonitoring() {
        if (this.appCore.app) {
            this.appCore.app.ticker.add(() => {
                const fps = Math.round(this.appCore.app.ticker.FPS);
                this.updateStatusBar('fps', fps);
            });
        }
    }
    
    async loadIcons() {
        if (this.extensions.isAvailable('SVG') && this.extensions.Tabler) {
            console.log('✅ Tabler Icons読み込み開始');
            
            try {
                // ペンアイコン読み込み
                const penIcon = await this.extensions.Tabler.loadIcon('pencil');
                if (penIcon) {
                    // アイコンをボタンに適用
                    this.applyIconToButton('pen', penIcon);
                }
                
                // 消しゴムアイコン読み込み
                const eraserIcon = await this.extensions.Tabler.loadIcon('eraser');
                if (eraserIcon) {
                    this.applyIconToButton('eraser', eraserIcon);
                }
                
                console.log('✅ アイコン読み込み完了');
            } catch (error) {
                console.warn('⚠️ アイコン読み込み失敗:', error);
            }
        }
    }
    
    applyIconToButton(buttonName, icon) {
        const button = this.toolButtons.get(buttonName);
        if (button && icon) {
            // アイコンをボタンに追加（実装詳細）
            icon.scale.set(0.5);
            button.addChild(icon);
        }
    }
    
    async initializeFallbackUI() {
        // 完全フォールバックモード
        console.log('🔄 フォールバックUIモード初期化');
        this.isInitialized = true;
    }
    
    // 公開API
    updateCurrentTool(toolName) {
        console.log(`🔄 現在のツール: ${toolName}`);
        this.updateStatusBar('currentTool', toolName);
        this.setActiveButton(toolName);
    }
    
    setActiveButton(toolName) {
        // 全ボタンを非アクティブ化
        this.toolButtons.forEach((button, name) => {
            if (button.tint !== undefined) {
                button.tint = name === toolName ? 0x90EE90 : 0xFFFFFF;
            }
        });
    }
    
    updateStatusBar(type, value) {
        const element = this.statusElements.get(type);
        if (element) {
            switch (type) {
                case 'currentTool':
                    element.textContent = value;
                    break;
                case 'fps':
                    element.textContent = value.toString();
                    break;
                case 'brushSize':
                    // ブラシサイズ表示更新
                    break;
                case 'opacity':
                    // 不透明度表示更新
                    break;
                default:
                    element.textContent = value.toString();
            }
        }
    }
    
    updateCoordinates(x, y) {
        this.updateStatusBar('coordinates', `x: ${Math.round(x)}, y: ${Math.round(y)}`);
    }
    
    updateCanvasInfo(width, height) {
        this.updateStatusBar('canvasInfo', `${width}×${height}px`);
    }
    
    showPopup(popupName) {
        const popup = this.popups.get(popupName);
        if (popup && popup.show) {
            popup.show();
        }
    }
    
    hidePopup(popupName) {
        const popup = this.popups.get(popupName);
        if (popup && popup.hide) {
            popup.hide();
        }
    }
    
    // イベントハンドラー
    onEvent(eventName, data) {
        switch (eventName) {
            case 'toolChanged':
                this.updateCurrentTool(data.toolName);
                break;
            case 'canvasResized':
                this.updateCanvasInfo(data.width, data.height);
                break;
            case 'coordinatesChanged':
                this.updateCoordinates(data.x, data.y);
                break;
        }
    }
}