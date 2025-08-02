/**
 * PixiUIController v3.2 - PixiJS統一UI制御システム
 * Adobe Fresco風UI + ふたば色統合 + Chrome API最適化
 * 規約: 総合AIコーディング規約v4.1準拠（PixiJS統一座標対応）
 */

import * as PIXI from 'pixi.js';

/**
 * PixiJS統一UI制御システム
 * PixiJS Text/Sprite活用による完全統合UI実装
 */
export class PixiUIController {
    constructor(pixiApp, coordinateUnifier, eventStore) {
        this.app = pixiApp;
        this.coordinate = coordinateUnifier;
        this.eventStore = eventStore;
        
        // UI状態管理
        this.isInitialized = false;
        this.activePopups = new Map();
        this.uiElements = new Map();
        this.animations = new Map();
        
        // PixiJS UI階層
        this.uiContainer = new PIXI.Container();
        this.popupContainer = new PIXI.Container();
        this.modalContainer = new PIXI.Container();
        this.app.stage.addChild(this.uiContainer);
        this.app.stage.addChild(this.popupContainer);
        this.app.stage.addChild(this.modalContainer);
        
        // サイドバー・パネル管理
        this.sidebar = null;
        this.layerPanel = null;
        this.timeline = null;
        this.toolPalette = null;
        
        // Adobe Fresco風カラーパレット
        this.futabaColors = {
            maroon: 0x800000,
            lightMaroon: 0xaa5a56,
            medium: 0xcf9c97,
            cream: 0xf0e0d6,
            background: 0xffffee
        };
        
        // アニメーション設定
        this.animationSettings = {
            duration: 250,
            easing: PIXI.Ticker.shared.elapsedMS * 0.001,
            popupScale: { from: 0.8, to: 1.0 },
            fadeAlpha: { from: 0, to: 1 }
        };
        
        this.initialize();
    }
    
    /**
     * UI制御システム初期化
     */
    async initialize() {
        try {
            console.log('🎨 PixiUIController初期化開始 - Adobe Fresco風UI');
            
            // UIテクスチャ読み込み
            await this.loadUITextures();
            
            // サイドバー構築
            this.createSidebar();
            
            // レイヤーパネル構築
            this.createLayerPanel();
            
            // ツールパレット構築
            this.createToolPalette();
            
            // イベントリスナー設定
            this.setupEventListeners();
            
            // リサイズ対応
            this.setupResponsiveLayout();
            
            this.isInitialized = true;
            console.log('✅ PixiUIController初期化完了 - PixiJS統一UI稼働');
            
        } catch (error) {
            console.error('❌ PixiUIController初期化エラー:', error);
            throw error;
        }
    }
    
    /**
     * UIテクスチャ読み込み
     */
    async loadUITextures() {
        // PixiJS Loader（v8対応）
        const loader = new PIXI.Assets();
        
        // アイコンテクスチャ群
        const iconPaths = {
            pencil: './icons/pencil.png',
            paintbrush: './icons/paintbrush.png',
            eraser: './icons/eraser.png',
            eyedropper: './icons/eyedropper.png',
            select: './icons/select.png',
            layer: './icons/layer.png',
            folder: './icons/folder.png',
            eye: './icons/eye.png',
            plus: './icons/plus.png',
            trash: './icons/trash.png'
        };
        
        try {
            // 並列読み込み
            const textures = await Promise.all(
                Object.entries(iconPaths).map(async ([key, path]) => {
                    try {
                        const texture = await PIXI.Assets.load(path);
                        return [key, texture];
                    } catch (error) {
                        console.warn(`⚠️ アイコン読み込み失敗: ${path} - フォールバック生成`);
                        return [key, this.createFallbackTexture(key)];
                    }
                })
            );
            
            this.iconTextures = new Map(textures);
            console.log('📦 UIテクスチャ読み込み完了');
            
        } catch (error) {
            console.warn('⚠️ UIテクスチャ読み込み部分失敗 - フォールバック使用');
            this.createFallbackTextures();
        }
    }
    
    /**
     * フォールバックテクスチャ生成
     */
    createFallbackTexture(iconType) {
        const graphics = new PIXI.Graphics();
        const size = 44;
        
        // ふたば色基調のシンプルアイコン
        graphics.beginFill(this.futabaColors.cream);
        graphics.lineStyle(2, this.futabaColors.maroon);
        
        switch (iconType) {
            case 'pencil':
                graphics.drawRect(size * 0.2, size * 0.2, size * 0.6, size * 0.6);
                graphics.moveTo(size * 0.3, size * 0.3);
                graphics.lineTo(size * 0.7, size * 0.7);
                break;
            case 'paintbrush':
                graphics.drawCircle(size * 0.5, size * 0.5, size * 0.25);
                break;
            case 'eraser':
                graphics.drawRoundedRect(size * 0.25, size * 0.25, size * 0.5, size * 0.5, 4);
                break;
            default:
                graphics.drawRect(size * 0.25, size * 0.25, size * 0.5, size * 0.5);
        }
        
        graphics.endFill();
        
        return this.app.renderer.generateTexture(graphics);
    }
    
    /**
     * フォールバックテクスチャ群生成
     */
    createFallbackTextures() {
        const iconTypes = ['pencil', 'paintbrush', 'eraser', 'eyedropper', 'select', 
                          'layer', 'folder', 'eye', 'plus', 'trash'];
        
        this.iconTextures = new Map();
        iconTypes.forEach(type => {
            this.iconTextures.set(type, this.createFallbackTexture(type));
        });
    }
    
    /**
     * サイドバー構築
     */
    createSidebar() {
        this.sidebar = new PIXI.Container();
        this.sidebar.name = 'sidebar';
        
        // サイドバー背景
        const background = this.createUIBackground(72, this.app.view.height, 
                                                  this.futabaColors.maroon);
        this.sidebar.addChild(background);
        
        // ツールボタン配置
        const tools = [
            { id: 'pen', icon: 'pencil', y: 80 },
            { id: 'airbrush', icon: 'paintbrush', y: 140 },
            { id: 'eraser', icon: 'eraser', y: 200 },
            { id: 'eyedropper', icon: 'eyedropper', y: 260 },
            { id: 'select', icon: 'select', y: 320 }
        ];
        
        tools.forEach(tool => {
            const button = this.createToolButton(tool.id, tool.icon, 36, tool.y);
            this.sidebar.addChild(button);
        });
        
        // 区切り線
        const separator = this.createSeparatorLine(8, 360, 56, 2);
        this.sidebar.addChild(separator);
        
        // システムボタン
        const systemButtons = [
            { id: 'layers', icon: 'layer', y: 380 },
            { id: 'animation', icon: 'folder', y: 440 }
        ];
        
        systemButtons.forEach(button => {
            const btn = this.createToolButton(button.id, button.icon, 36, button.y);
            this.sidebar.addChild(btn);
        });
        
        this.uiContainer.addChild(this.sidebar);
        this.uiElements.set('sidebar', this.sidebar);
    }
    
    /**
     * レイヤーパネル構築
     */
    createLayerPanel() {
        this.layerPanel = new PIXI.Container();
        this.layerPanel.name = 'layerPanel';
        this.layerPanel.x = this.app.view.width - 300;
        
        // パネル背景
        const background = this.createUIBackground(300, this.app.view.height,
                                                  this.futabaColors.lightMaroon);
        this.layerPanel.addChild(background);
        
        // ヘッダー
        const header = this.createPanelHeader('レイヤー', 300, 40);
        this.layerPanel.addChild(header);
        
        // レイヤーリスト容器
        const layerList = new PIXI.Container();
        layerList.name = 'layerList';
        layerList.y = 50;
        this.layerPanel.addChild(layerList);
        
        // サンプルレイヤー項目
        const sampleLayer = this.createLayerItem('レイヤー1', 0, true, 0.8);
        layerList.addChild(sampleLayer);
        
        // レイヤー操作ボタン
        const controls = this.createLayerControls();
        controls.y = this.app.view.height - 60;
        this.layerPanel.addChild(controls);
        
        this.uiContainer.addChild(this.layerPanel);
        this.uiElements.set('layerPanel', this.layerPanel);
    }
    
    /**
     * ツールパレット構築
     */
    createToolPalette() {
        // 最初は非表示（ツール選択時にポップアップ表示）
        this.toolPalette = new PIXI.Container();
        this.toolPalette.name = 'toolPalette';
        this.toolPalette.visible = false;
        this.toolPalette.alpha = 0;
        
        this.popupContainer.addChild(this.toolPalette);
        this.uiElements.set('toolPalette', this.toolPalette);
    }
    
    /**
     * UI背景作成
     */
    createUIBackground(width, height, color, alpha = 0.95) {
        const background = new PIXI.Graphics();
        
        // ふたば色グラデーション風背景
        background.beginFill(color, alpha);
        background.drawRect(0, 0, width, height);
        background.endFill();
        
        // 境界線
        background.lineStyle(1, this.futabaColors.cream, 0.3);
        background.drawRect(0, 0, width, height);
        
        return background;
    }
    
    /**
     * ツールボタン作成
     */
    createToolButton(toolId, iconType, x, y) {
        const button = new PIXI.Container();
        button.name = toolId;
        button.x = x;
        button.y = y;
        
        // ボタン背景
        const bg = new PIXI.Graphics();
        bg.beginFill(this.futabaColors.medium, 0.3);
        bg.drawRoundedRect(-22, -22, 44, 44, 8);
        bg.endFill();
        button.addChild(bg);
        
        // アイコン
        const iconTexture = this.iconTextures.get(iconType) || this.iconTextures.get('pencil');
        const icon = new PIXI.Sprite(iconTexture);
        icon.anchor.set(0.5);
        icon.width = 24;
        icon.height = 24;
        icon.tint = this.futabaColors.cream;
        button.addChild(icon);
        
        // インタラクション設定
        button.eventMode = 'static';
        button.cursor = 'pointer';
        
        // ホバーアニメーション
        button.on('pointerover', () => {
            this.animateButtonHover(button, true);
        });
        
        button.on('pointerout', () => {
            this.animateButtonHover(button, false);
        });
        
        // クリックイベント
        button.on('pointerdown', () => {
            this.handleToolButtonClick(toolId, button);
        });
        
        return button;
    }
    
    /**
     * パネルヘッダー作成
     */
    createPanelHeader(title, width, height) {
        const header = new PIXI.Container();
        
        // ヘッダー背景
        const bg = new PIXI.Graphics();
        bg.beginFill(this.futabaColors.maroon, 0.8);
        bg.drawRect(0, 0, width, height);
        bg.endFill();
        header.addChild(bg);
        
        // タイトルテキスト
        const titleText = new PIXI.Text(title, {
            fontFamily: 'Arial, sans-serif',
            fontSize: 14,
            fill: this.futabaColors.cream,
            align: 'center'
        });
        titleText.anchor.set(0.5);
        titleText.x = width / 2;
        titleText.y = height / 2;
        header.addChild(titleText);
        
        return header;
    }
    
    /**
     * レイヤー項目作成
     */
    createLayerItem(name, index, visible = true, opacity = 1.0) {
        const item = new PIXI.Container();
        item.name = `layer-${index}`;
        item.y = index * 60;
        
        // アイテム背景
        const bg = new PIXI.Graphics();
        bg.beginFill(this.futabaColors.cream, 0.1);
        bg.drawRect(0, 0, 290, 55);
        bg.endFill();
        item.addChild(bg);
        
        // 表示切り替えボタン
        const visibilityButton = this.createVisibilityButton(visible);
        visibilityButton.x = 10;
        visibilityButton.y = 15;
        item.addChild(visibilityButton);
        
        // サムネイル
        const thumbnail = this.createLayerThumbnail();
        thumbnail.x = 45;
        thumbnail.y = 8;
        item.addChild(thumbnail);
        
        // レイヤー名
        const nameText = new PIXI.Text(name, {
            fontFamily: 'Arial, sans-serif',
            fontSize: 12,
            fill: this.futabaColors.cream
        });
        nameText.x = 120;
        nameText.y = 12;
        item.addChild(nameText);
        
        // 不透明度スライダー
        const opacitySlider = this.createOpacitySlider(opacity);
        opacitySlider.x = 120;
        opacitySlider.y = 35;
        item.addChild(opacitySlider);
        
        // インタラクション
        item.eventMode = 'static';
        item.cursor = 'pointer';
        
        item.on('pointerdown', () => {
            this.selectLayer(index);
        });
        
        return item;
    }
    
    /**
     * 表示切り替えボタン作成
     */
    createVisibilityButton(visible) {
        const button = new PIXI.Container();
        
        const icon = new PIXI.Graphics();
        if (visible) {
            // 目のアイコン（簡易版）
            icon.beginFill(this.futabaColors.cream);
            icon.drawEllipse(0, 0, 12, 8);
            icon.endFill();
            icon.beginFill(this.futabaColors.maroon);
            icon.drawCircle(0, 0, 4);
            icon.endFill();
        } else {
            // 閉じた目（線）
            icon.lineStyle(2, this.futabaColors.cream);
            icon.moveTo(-8, 0);
            icon.lineTo(8, 0);
        }
        
        button.addChild(icon);
        button.eventMode = 'static';
        button.cursor = 'pointer';
        
        return button;
    }
    
    /**
     * レイヤーサムネイル作成
     */
    createLayerThumbnail() {
        const thumbnail = new PIXI.Graphics();
        
        // サムネイル枠
        thumbnail.lineStyle(1, this.futabaColors.cream, 0.5);
        thumbnail.beginFill(this.futabaColors.background, 0.8);
        thumbnail.drawRect(0, 0, 64, 40);
        thumbnail.endFill();
        
        // サンプル描画内容（ランダムストローク）
        thumbnail.lineStyle(2, this.futabaColors.maroon, 0.7);
        thumbnail.moveTo(10, 20);
        thumbnail.quadraticCurveTo(32, 10, 54, 20);
        thumbnail.quadraticCurveTo(40, 30, 20, 25);
        
        return thumbnail;
    }
    
    /**
     * 不透明度スライダー作成
     */
    createOpacitySlider(value) {
        const slider = new PIXI.Container();
        
        // スライダートラック
        const track = new PIXI.Graphics();
        track.beginFill(this.futabaColors.medium, 0.3);
        track.drawRoundedRect(0, 0, 120, 8, 4);
        track.endFill();
        slider.addChild(track);
        
        // スライダー値部分
        const fill = new PIXI.Graphics();
        fill.beginFill(this.futabaColors.cream, 0.8);
        fill.drawRoundedRect(0, 0, 120 * value, 8, 4);
        fill.endFill();
        slider.addChild(fill);
        
        // スライダーハンドル
        const handle = new PIXI.Graphics();
        handle.beginFill(this.futabaColors.cream);
        handle.drawCircle(120 * value, 4, 6);
        handle.endFill();
        slider.addChild(handle);
        
        // インタラクション
        slider.eventMode = 'static';
        slider.cursor = 'pointer';
        
        return slider;
    }
    
    /**
     * レイヤー操作ボタン群作成
     */
    createLayerControls() {
        const controls = new PIXI.Container();
        
        const buttons = [
            { icon: 'plus', x: 20, action: 'addLayer' },
            { icon: 'trash', x: 70, action: 'deleteLayer' },
            { icon: 'folder', x: 120, action: 'createFolder' }
        ];
        
        buttons.forEach(btn => {
            const button = this.createControlButton(btn.icon, btn.action);
            button.x = btn.x;
            controls.addChild(button);
        });
        
        return controls;
    }
    
    /**
     * 制御ボタン作成
     */
    createControlButton(iconType, action) {
        const button = new PIXI.Container();
        
        // ボタン背景
        const bg = new PIXI.Graphics();
        bg.beginFill(this.futabaColors.medium, 0.5);
        bg.drawRoundedRect(-15, -15, 30, 30, 4);
        bg.endFill();
        button.addChild(bg);
        
        // アイコン
        const iconTexture = this.iconTextures.get(iconType);
        if (iconTexture) {
            const icon = new PIXI.Sprite(iconTexture);
            icon.anchor.set(0.5);
            icon.width = 20;
            icon.height = 20;
            icon.tint = this.futabaColors.cream;
            button.addChild(icon);
        }
        
        // インタラクション
        button.eventMode = 'static';
        button.cursor = 'pointer';
        
        button.on('pointerdown', () => {
            this.handleControlAction(action);
        });
        
        return button;
    }
    
    /**
     * 区切り線作成
     */
    createSeparatorLine(x, y, width, height) {
        const line = new PIXI.Graphics();
        line.beginFill(this.futabaColors.cream, 0.3);
        line.drawRect(x, y, width, height);
        line.endFill();
        return line;
    }
    
    /**
     * イベントリスナー設定
     */
    setupEventListeners() {
        // ツール変更要求
        this.eventStore.on('ui:tool:select', (data) => {
            this.showToolPalette(data.tool, data.position);
        });
        
        // ポップアップ表示要求
        this.eventStore.on('ui:popup:show', (data) => {
            this.showPopup(data.type, data.config, data.position);
        });
        
        // ポップアップ非表示要求
        this.eventStore.on('ui:popup:hide', (data) => {
            this.hidePopup(data.id);
        });
        
        // レイヤーパネル切り替え
        this.eventStore.on('ui:panel:toggle', (data) => {
            this.togglePanel(data.panel);
        });
        
        // UI更新要求
        this.eventStore.on('ui:update', (data) => {
            this.updateUI(data);
        });
        
        // アニメーション完了
        this.eventStore.on('ui:animation:complete', (data) => {
            this.handleAnimationComplete(data.id);
        });
    }
    
    /**
     * レスポンシブレイアウト設定
     */
    setupResponsiveLayout() {
        // リサイズイベント監視
        this.eventStore.on('viewport:resize', (data) => {
            this.handleResize(data.width, data.height);
        });
        
        // 初期レイアウト調整
        this.adjustLayout();
    }
    
    /**
     * ツールボタンクリック処理
     */
    handleToolButtonClick(toolId, button) {
        // ツール切り替えアニメーション
        this.animateToolSelection(button);
        
        // ツール変更イベント発信
        this.eventStore.emit('tool:change', { tool: toolId });
        
        // ツール固有UI表示
        this.showToolSpecificUI(toolId, button);
        
        console.log(`🎨 ツール選択: ${toolId}`);
    }
    
    /**
     * ツール固有UI表示
     */
    showToolSpecificUI(toolId, sourceButton) {
        const buttonGlobalPos = sourceButton.parent.toGlobal(sourceButton.position);
        
        switch (toolId) {
            case 'pen':
                this.showPenToolPopup(buttonGlobalPos);
                break;
            case 'airbrush':
                this.showAirbrushToolPopup(buttonGlobalPos);
                break;
            case 'eraser':
                this.showEraserToolPopup(buttonGlobalPos);
                break;
            default:
                this.hideAllToolPopups();
        }
    }
    
    /**
     * ペンツールポップアップ表示
     */
    showPenToolPopup(position) {
        const popup = this.createToolPopup('pen', {
            title: 'ペンツール',
            width: 280,
            height: 200,
            controls: [
                { type: 'slider', label: 'サイズ', min: 1, max: 64, value: 12 },
                { type: 'slider', label: '不透明度', min: 0, max: 1, value: 0.85 },
                { type: 'checkbox', label: '筆圧感度', checked: true },
                { type: 'checkbox', label: 'スムージング', checked: true }
            ]
        });
        
        this.showPopupAtPosition(popup, position, 'pen-tool');
    }
    
    /**
     * エアスプレーツールポップアップ表示
     */
    showAirbrushToolPopup(position) {
        const popup = this.createToolPopup('airbrush', {
            title: 'エアスプレー',
            width: 280,
            height: 220,
            controls: [
                { type: 'slider', label: 'サイズ', min: 5, max: 100, value: 24 },
                { type: 'slider', label: '不透明度', min: 0, max: 1, value: 0.3 },
                { type: 'slider', label: '密度', min: 0, max: 1, value: 0.8 },
                { type: 'slider', label: '広がり', min: 0.5, max: 2, value: 1.2 }
            ]
        });
        
        this.showPopupAtPosition(popup, position, 'airbrush-tool');
    }
    
    /**
     * 消しゴムツールポップアップ表示
     */
    showEraserToolPopup(position) {
        const popup = this.createToolPopup('eraser', {
            title: '消しゴム',
            width: 260,
            height: 180,
            controls: [
                { type: 'slider', label: 'サイズ', min: 1, max: 64, value: 16 },
                { type: 'slider', label: '硬さ', min: 0, max: 1, value: 0.8 }
            ]
        });
        
        this.showPopupAtPosition(popup, position, 'eraser-tool');
    }
    
    /**
     * ツールポップアップ作成
     */
    createToolPopup(toolType, config) {
        const popup = new PIXI.Container();
        popup.name = `${toolType}-popup`;
        
        // ポップアップ背景（ふたば色・Chrome最適化）
        const background = this.createPopupBackground(config.width, config.height);
        popup.addChild(background);
        
        // タイトルヘッダー
        const header = this.createPopupHeader(config.title, config.width);
        popup.addChild(header);
        
        // 制御項目群
        let yOffset = 50;
        config.controls.forEach((control, index) => {
            const controlElement = this.createControlElement(control, config.width - 40);
            controlElement.x = 20;
            controlElement.y = yOffset;
            popup.addChild(controlElement);
            yOffset += 35;
        });
        
        // プレビュー領域
        const preview = this.createToolPreview(toolType);
        preview.x = config.width - 80;
        preview.y = 60;
        popup.addChild(preview);
        
        return popup;
    }
    
    /**
     * ポップアップ背景作成
     */
    createPopupBackground(width, height) {
        const background = new PIXI.Graphics();
        
        // グラデーション風背景
        background.beginFill(this.futabaColors.lightMaroon, 0.95);
        background.drawRoundedRect(0, 0, width, height, 16);
        background.endFill();
        
        // 境界線
        background.lineStyle(1, this.futabaColors.cream, 0.4);
        background.drawRoundedRect(0, 0, width, height, 16);
        
        // ドロップシャドウ効果
        const shadow = new PIXI.Graphics();
        shadow.beginFill(0x000000, 0.3);
        shadow.drawRoundedRect(4, 4, width, height, 16);
        shadow.endFill();
        
        const container = new PIXI.Container();
        container.addChild(shadow);
        container.addChild(background);
        
        return container;
    }
    
    /**
     * ポップアップヘッダー作成
     */
    createPopupHeader(title, width) {
        const header = new PIXI.Container();
        
        // ヘッダー背景
        const bg = new PIXI.Graphics();
        bg.beginFill(this.futabaColors.maroon, 0.8);
        bg.drawRoundedRect(0, 0, width, 40, 16);
        bg.endFill();
        header.addChild(bg);
        
        // タイトルテキスト
        const titleText = new PIXI.Text(title, {
            fontFamily: 'Arial, sans-serif',
            fontSize: 14,
            fill: this.futabaColors.cream,
            fontWeight: 'bold'
        });
        titleText.anchor.set(0.5);
        titleText.x = width / 2;
        titleText.y = 20;
        header.addChild(titleText);
        
        // 閉じるボタン
        const closeButton = this.createCloseButton();
        closeButton.x = width - 25;
        closeButton.y = 20;
        header.addChild(closeButton);
        
        return header;
    }
    
    /**
     * 制御要素作成
     */
    createControlElement(config, width) {
        const element = new PIXI.Container();
        
        // ラベル
        const label = new PIXI.Text(config.label, {
            fontFamily: 'Arial, sans-serif',
            fontSize: 12,
            fill: this.futabaColors.cream
        });
        label.y = 5;
        element.addChild(label);
        
        switch (config.type) {
            case 'slider':
                const slider = this.createSlider(config, width - 100);
                slider.x = 80;
                element.addChild(slider);
                break;
                
            case 'checkbox':
                const checkbox = this.createCheckbox(config.checked);
                checkbox.x = width - 30;
                element.addChild(checkbox);
                break;
        }
        
        return element;
    }
    
    /**
     * スライダー作成
     */
    createSlider(config, width) {
        const slider = new PIXI.Container();
        
        // スライダートラック
        const track = new PIXI.Graphics();
        track.beginFill(this.futabaColors.medium, 0.4);
        track.drawRoundedRect(0, 0, width, 12, 6);
        track.endFill();
        slider.addChild(track);
        
        // 現在値の割合計算
        const ratio = (config.value - config.min) / (config.max - config.min);
        
        // スライダー値部分
        const fill = new PIXI.Graphics();
        fill.beginFill(this.futabaColors.cream, 0.8);
        fill.drawRoundedRect(0, 0, width * ratio, 12, 6);
        fill.endFill();
        slider.addChild(fill);
        
        // スライダーハンドル
        const handle = new PIXI.Graphics();
        handle.beginFill(this.futabaColors.cream);
        handle.drawCircle(width * ratio, 6, 8);
        handle.endFill();
        slider.addChild(handle);
        
        // 値表示
        const valueText = new PIXI.Text(config.value.toString(), {
            fontFamily: 'Arial, sans-serif',
            fontSize: 10,
            fill: this.futabaColors.cream
        });
        valueText.anchor.set(0.5);
        valueText.x = width + 20;
        valueText.y = 6;
        slider.addChild(valueText);
        
        // インタラクション
        slider.eventMode = 'static';
        slider.cursor = 'pointer';
        
        return slider;
    }
    
    /**
     * チェックボックス作成
     */
    createCheckbox(checked) {
        const checkbox = new PIXI.Container();
        
        // チェックボックス枠
        const box = new PIXI.Graphics();
        box.lineStyle(2, this.futabaColors.cream, 0.8);
        box.beginFill(checked ? this.futabaColors.cream : 0x000000, checked ? 0.8 : 0);
        box.drawRoundedRect(-8, -8, 16, 16, 2);
        box.endFill();
        checkbox.addChild(box);
        
        // チェックマーク
        if (checked) {
            const check = new PIXI.Graphics();
            check.lineStyle(2, this.futabaColors.maroon);
            check.moveTo(-4, 0);
            check.lineTo(-1, 3);
            check.lineTo(4, -4);
            checkbox.addChild(check);
        }
        
        // インタラクション
        checkbox.eventMode = 'static';
        checkbox.cursor = 'pointer';
        
        return checkbox;
    }
    
    /**
     * ツールプレビュー作成
     */
    createToolPreview(toolType) {
        const preview = new PIXI.Container();
        
        // プレビュー枠
        const frame = new PIXI.Graphics();
        frame.lineStyle(1, this.futabaColors.cream, 0.5);
        frame.beginFill(this.futabaColors.background, 0.9);
        frame.drawRoundedRect(0, 0, 64, 64, 4);
        frame.endFill();
        preview.addChild(frame);
        
        // ツール別プレビュー描画
        const previewGraphics = new PIXI.Graphics();
        switch (toolType) {
            case 'pen':
                previewGraphics.lineStyle(3, this.futabaColors.maroon, 0.8);
                previewGraphics.moveTo(10, 32);
                previewGraphics.quadraticCurveTo(32, 20, 54, 32);
                break;
            case 'airbrush':
                // エアスプレー効果
                for (let i = 0; i < 20; i++) {
                    const x = 32 + (Math.random() - 0.5) * 30;
                    const y = 32 + (Math.random() - 0.5) * 30;
                    const alpha = Math.random() * 0.5;
                    previewGraphics.beginFill(this.futabaColors.maroon, alpha);
                    previewGraphics.drawCircle(x, y, Math.random() * 2 + 1);
                    previewGraphics.endFill();
                }
                break;
            case 'eraser':
                previewGraphics.lineStyle(8, this.futabaColors.background, 1);
                previewGraphics.moveTo(20, 32);
                previewGraphics.lineTo(44, 32);
                break;
        }
        preview.addChild(previewGraphics);
        
        return preview;
    }
    
    /**
     * 閉じるボタン作成
     */
    createCloseButton() {
        const button = new PIXI.Graphics();
        button.lineStyle(2, this.futabaColors.cream);
        button.moveTo(-6, -6);
        button.lineTo(6, 6);
        button.moveTo(6, -6);
        button.lineTo(-6, 6);
        
        button.eventMode = 'static';
        button.cursor = 'pointer';
        
        button.on('pointerdown', () => {
            this.hideAllToolPopups();
        });
        
        return button;
    }
    
    /**
     * ポップアップを指定位置に表示
     */
    showPopupAtPosition(popup, position, id) {
        // 既存ポップアップを隠す
        this.hideAllToolPopups();
        
        // ポップアップを適切な位置に配置
        const adjustedPos = this.calculatePopupPosition(popup, position);
        popup.x = adjustedPos.x;
        popup.y = adjustedPos.y;
        
        // アニメーション付き表示
        popup.alpha = 0;
        popup.scale.set(0.8);
        this.popupContainer.addChild(popup);
        
        this.animatePopupShow(popup, id);
        this.activePopups.set(id, popup);
    }
    
    /**
     * ポップアップ位置計算
     */
    calculatePopupPosition(popup, sourcePosition) {
        const popupBounds = popup.getBounds();
        const viewWidth = this.app.view.width;
        const viewHeight = this.app.view.height;
        
        let x = sourcePosition.x + 80; // サイドバー右側
        let y = sourcePosition.y - popupBounds.height / 2;
        
        // 画面内調整
        if (x + popupBounds.width > viewWidth - 50) {
            x = sourcePosition.x - popupBounds.width - 20; // 左側に表示
        }
        
        if (y < 20) y = 20;
        if (y + popupBounds.height > viewHeight - 20) {
            y = viewHeight - popupBounds.height - 20;
        }
        
        return { x, y };
    }
    
    /**
     * ポップアップ表示アニメーション
     */
    animatePopupShow(popup, id) {
        const animation = {
            id: id,
            target: popup,
            startTime: Date.now(),
            duration: this.animationSettings.duration,
            fromAlpha: 0,
            toAlpha: 1,
            fromScale: 0.8,
            toScale: 1.0
        };
        
        this.animations.set(id, animation);
        this.updateAnimation(animation);
    }
    
    /**
     * ボタンホバーアニメーション
     */
    animateButtonHover(button, isHover) {
        const targetScale = isHover ? 1.1 : 1.0;
        const targetAlpha = isHover ? 1.0 : 0.8;
        
        // 簡易アニメーション
        const duration = 150;
        const startTime = Date.now();
        const startScale = button.scale.x;
        const startAlpha = button.alpha;
        
        const animate = () => {
            const elapsed = Date.now() - startTime;
            const progress = Math.min(elapsed / duration, 1);
            const easeProgress = this.easeOutCubic(progress);
            
            button.scale.set(startScale + (targetScale - startScale) * easeProgress);
            button.alpha = startAlpha + (targetAlpha - startAlpha) * easeProgress;
            
            if (progress < 1) {
                requestAnimationFrame(animate);
            }
        };
        
        animate();
    }
    
    /**
     * ツール選択アニメーション
     */
    animateToolSelection(button) {
        // 選択フィードバック
        const flash = new PIXI.Graphics();
        flash.beginFill(this.futabaColors.cream, 0.6);
        flash.drawCircle(0, 0, 30);
        flash.endFill();
        
        button.addChild(flash);
        
        // フラッシュアニメーション
        let scale = 0;
        const animate = () => {
            scale += 0.1;
            flash.scale.set(scale);
            flash.alpha = 1 - scale;
            
            if (scale < 1.5) {
                requestAnimationFrame(animate);
            } else {
                button.removeChild(flash);
            }
        };
        
        animate();
    }
    
    /**
     * アニメーション更新
     */
    updateAnimation(animation) {
        const elapsed = Date.now() - animation.startTime;
        const progress = Math.min(elapsed / animation.duration, 1);
        const easeProgress = this.easeOutCubic(progress);
        
        // アルファ・スケール更新
        animation.target.alpha = animation.fromAlpha + 
            (animation.toAlpha - animation.fromAlpha) * easeProgress;
        
        const scale = animation.fromScale + 
            (animation.toScale - animation.fromScale) * easeProgress;
        animation.target.scale.set(scale);
        
        if (progress < 1) {
            requestAnimationFrame(() => this.updateAnimation(animation));
        } else {
            this.animations.delete(animation.id);
            this.eventStore.emit('ui:animation:complete', { id: animation.id });
        }
    }
    
    /**
     * イージング関数
     */
    easeOutCubic(t) {
        return 1 - Math.pow(1 - t, 3);
    }
    
    /**
     * すべてのツールポップアップを隠す
     */
    hideAllToolPopups() {
        this.activePopups.forEach((popup, id) => {
            this.animatePopupHide(popup, id);
        });
    }
    
    /**
     * ポップアップ非表示アニメーション
     */
    animatePopupHide(popup, id) {
        const animation = {
            id: id + '-hide',
            target: popup,
            startTime: Date.now(),
            duration: this.animationSettings.duration * 0.8,
            fromAlpha: popup.alpha,
            toAlpha: 0,
            fromScale: popup.scale.x,
            toScale: 0.8
        };
        
        const animate = () => {
            const elapsed = Date.now() - animation.startTime;
            const progress = Math.min(elapsed / animation.duration, 1);
            const easeProgress = this.easeOutCubic(progress);
            
            popup.alpha = animation.fromAlpha + 
                (animation.toAlpha - animation.fromAlpha) * easeProgress;
            
            const scale = animation.fromScale + 
                (animation.toScale - animation.fromScale) * easeProgress;
            popup.scale.set(scale);
            
            if (progress < 1) {
                requestAnimationFrame(animate);
            } else {
                this.popupContainer.removeChild(popup);
                this.activePopups.delete(id);
            }
        };
        
        animate();
    }
    
    /**
     * レイヤー選択処理
     */
    selectLayer(index) {
        this.eventStore.emit('layer:select', { index });
        console.log(`📚 レイヤー選択: ${index}`);
    }
    
    /**
     * 制御アクション処理
     */
    handleControlAction(action) {
        switch (action) {
            case 'addLayer':
                this.eventStore.emit('layer:add');
                break;
            case 'deleteLayer':
                this.eventStore.emit('layer:delete');
                break;
            case 'createFolder':
                this.eventStore.emit('layer:folder:create');
                break;
        }
        
        console.log(`🎛️ 制御アクション: ${action}`);
    }
    
    /**
     * パネル切り替え
     */
    togglePanel(panelName) {
        const panel = this.uiElements.get(panelName);
        if (panel) {
            panel.visible = !panel.visible;
            this.eventStore.emit('ui:panel:toggled', { panel: panelName, visible: panel.visible });
        }
    }
    
    /**
     * レイアウト調整
     */
    adjustLayout() {
        const viewWidth = this.app.view.width;
        const viewHeight = this.app.view.height;
        
        // レイヤーパネル位置調整
        if (this.layerPanel) {
            this.layerPanel.x = viewWidth - 300;
        }
        
        // UI要素の境界確認
        this.uiElements.forEach((element, name) => {
            if (element.getBounds) {
                const bounds = element.getBounds();
                if (bounds.x + bounds.width > viewWidth || bounds.y + bounds.height > viewHeight) {
                    console.warn(`⚠️ UI要素が画面外: ${name}`);
                }
            }
        });
    }
    
    /**
     * リサイズ処理
     */
    handleResize(width, height) {
        this.adjustLayout();
        console.log(`🖥️ UI レイアウト調整: ${width}x${height}`);
    }
    
    /**
     * UI情報取得
     */
    getUIInfo() {
        return {
            initialized: this.isInitialized,
            activePopups: this.activePopups.size,
            uiElements: Array.from(this.uiElements.keys()),
            activeAnimations: this.animations.size,
            viewport: {
                width: this.app.view.width,
                height: this.app.view.height
            }
        };
    }
    
    /**
     * アニメーション完了処理
     */
    handleAnimationComplete(id) {
        console.log(`✨ アニメーション完了: ${id}`);
    }
    
    /**
     * UI更新処理
     */
    updateUI(data) {
        switch (data.type) {
            case 'tool-config':
                this.updateToolConfigUI(data.tool, data.config);
                break;
            case 'layer-update':
                this.updateLayerUI(data.layers);
                break;
            default:
                console.log(`🔄 UI更新: ${data.type}`);
        }
    }
    
    /**
     * ツール設定UI更新
     */
    updateToolConfigUI(tool, config) {
        // アクティブなツールポップアップの設定値を更新
        const activePopup = this.activePopups.get(`${tool}-tool`);
        if (activePopup) {
            // スライダー値などを更新
            console.log(`🎨 ツール設定UI更新: ${tool}`);
        }
    }
    
    /**
     * レイヤーUI更新
     */
    updateLayerUI(layers) {
        const layerList = this.layerPanel?.getChildByName('layerList');
        if (layerList) {
            // レイヤーリスト更新処理
            console.log(`📚 レイヤーUI更新: ${layers.length}層`);
        }
    }
    
    /**
     * 破棄処理
     */
    destroy() {
        try {
            // アニメーション停止
            this.animations.clear();
            
            // ポップアップクリア
            this.activePopups.clear();
            
            // PixiJSコンテナ破棄
            this.uiContainer.destroy({ children: true });
            this.popupContainer.destroy({ children: true });
            this.modalContainer.destroy({ children: true });
            
            // テクスチャクリア
            if (this.iconTextures) {
                this.iconTextures.forEach(texture => {
                    if (texture.destroy) texture.destroy(true);
                });
                this.iconTextures.clear();
            }
            
            console.log('🎨 PixiUIController破棄完了');
            
        } catch (error) {
            console.error('❌ PixiUIController破棄エラー:', error);
        }
    }
}