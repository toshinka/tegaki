/**
 * PixiJS v8統合UI制御・Adobe Fresco風UI
 * モダンお絵かきツール v3.3 - Phase2 UI統合システム
 * 
 * 機能:
 * - PixiJS v8統合UI・レスポンシブ対応
 * - サイドバーツール配置・33pxアイコン管理
 * - 移動可能ポップアップ統合制御
 * - ふたば色統一・軽やか色適用
 * - Phosphor Icons統合・DOM最適化
 */

import { Container, Graphics, Text, Sprite, Texture } from 'pixi.js';

/**
 * PixiJS v8統合UI制御
 * Adobe Fresco風・移動可能パネル・レスポンシブ対応
 */
class PixiV8UIController {
    constructor(pixiApp, eventStore) {
        this.app = pixiApp;
        this.eventStore = eventStore;
        this.renderer = pixiApp.renderer;
        
        // UI状態管理
        this.uiState = {
            sidebarVisible: true,
            layerPanelVisible: true,
            animationMode: false,
            fullscreenMode: false,
            currentTool: 'pen'
        };
        
        // UI要素参照
        this.elements = {
            sidebar: null,
            layerPanel: null,
            timeline: null,
            popupContainer: null,
            shortcutHint: null
        };
        
        // ツール設定（v3.3仕様：33pxアイコン）
        this.toolConfig = {
            pen: { icon: 'pencil', label: 'ペン', shortcut: 'P' },
            airbrush: { icon: 'paint-brush', label: 'エアスプレー', shortcut: 'A' },
            eraser: { icon: 'eraser', label: '消しゴム', shortcut: 'E' },
            blur: { icon: 'blur', label: 'ボカシ', shortcut: 'B' },
            eyedropper: { icon: 'eyedropper', label: 'スポイト', shortcut: 'I' },
            fill: { icon: 'paint-bucket', label: '塗りつぶし', shortcut: 'G' },
            select: { icon: 'selection', label: '範囲選択', shortcut: 'M' },
            text: { icon: 'text-aa', label: 'テキスト', shortcut: 'T' }
        };
        
        // 移動可能ポップアップ管理
        this.activePopups = new Map();
        this.popupZIndex = 2000;
        
        // レスポンシブ設定
        this.breakpoints = {
            mobile: 768,
            tablet: 1024,
            desktop: 1200
        };
        
        // パフォーマンス最適化
        this.useGPUAcceleration = true;
        this.animationFrame = null;
        
        this.initializeDOMElements();
        this.setupToolbar();
        this.setupEventListeners();
        this.setupResponsiveLayout();
        
        console.log('✅ PixiV8UIController初期化完了 - Adobe Fresco風UI');
    }
    
    /**
     * DOM要素初期化・参照取得
     * v3.3レイアウト対応・要素確保
     */
    initializeDOMElements() {
        // 主要UI要素取得
        this.elements.sidebar = document.getElementById('sidebar');
        this.elements.layerPanel = document.getElementById('layerPanel');
        this.elements.timeline = document.getElementById('timeline');
        this.elements.popupContainer = document.getElementById('popupContainer');
        this.elements.shortcutHint = document.getElementById('shortcutHint');
        
        // 要素存在確認
        if (!this.elements.sidebar) {
            console.error('❌ サイドバー要素が見つかりません');
            return;
        }
        
        // GPU加速適用
        if (this.useGPUAcceleration) {
            Object.values(this.elements).forEach(element => {
                if (element) {
                    element.style.transform = 'translateZ(0)';
                    element.style.willChange = 'transform';
                }
            });
        }
        
        console.log('📐 DOM要素初期化完了');
    }
    
    /**
     * ツールバー設定・33pxアイコン配置
     * Phosphor Icons統合・v3.3仕様準拠
     */
    setupToolbar() {
        if (!this.elements.sidebar) return;
        
        // サイドバークリア
        this.elements.sidebar.innerHTML = '';
        
        // 特殊ボタン群（上部）
        this.createSpecialButtons();
        
        // 区切り線
        this.createSeparator();
        
        // メインツール群
        this.createMainTools();
        
        // 区切り線
        this.createSeparator();
        
        // 下部ボタン群
        this.createBottomButtons();
        
        console.log('🔧 ツールバー設定完了 - 33pxアイコン配置');
    }
    
    /**
     * 特殊ボタン作成（DL・リサイズ・カラーパレット）
     */
    createSpecialButtons() {
        const specialButtons = [
            { icon: 'download', action: 'download', label: 'DL' },
            { icon: 'resize', action: 'resize', label: 'リサイズ' },
            { icon: 'palette', action: 'color-palette', label: 'カラーパレット' }
        ];
        
        specialButtons.forEach(config => {
            const button = this.createToolButton(config);
            button.classList.add('special-button');
            this.elements.sidebar.appendChild(button);
        });
    }
    
    /**
     * メインツール作成
     */
    createMainTools() {
        Object.entries(this.toolConfig).forEach(([toolName, config]) => {
            const button = this.createToolButton({
                icon: config.icon,
                action: `tool-${toolName}`,
                label: config.label,
                shortcut: config.shortcut
            });
            
            button.dataset.tool = toolName;
            button.classList.add('main-tool');
            
            // デフォルトツール設定
            if (toolName === this.uiState.currentTool) {
                button.classList.add('active');
            }
            
            this.elements.sidebar.appendChild(button);
        });
    }
    
    /**
     * 下部ボタン作成（アニメ・レイヤー・設定）
     */
    createBottomButtons() {
        const bottomButtons = [
            { icon: 'film', action: 'animation-mode', label: 'アニメ' },
            { icon: 'stack', action: 'layer-panel', label: 'レイヤー' },
            { icon: 'gear', action: 'settings', label: '設定' }
        ];
        
        bottomButtons.forEach(config => {
            const button = this.createToolButton(config);
            button.classList.add('bottom-button');
            this.elements.sidebar.appendChild(button);
        });
    }
    
    /**
     * ツールボタン作成（v3.3仕様：33px）
     * Phosphor Icons統合・統一スタイル
     */
    createToolButton(config) {
        const button = document.createElement('button');
        button.className = 'tool-button';
        button.title = `${config.label}${config.shortcut ? ` (${config.shortcut})` : ''}`;
        button.dataset.action = config.action;
        
        // アイコン作成（Phosphor Icons準備）
        const iconElement = document.createElement('span');
        iconElement.className = 'tool-icon';
        iconElement.textContent = this.getIconText(config.icon);
        
        button.appendChild(iconElement);
        
        // クリックイベント
        button.addEventListener('click', (e) => {
            this.handleToolButtonClick(config.action, button);
        });
        
        return button;
    }
    
    /**
     * アイコンテキスト取得（Phosphor Icons代替）
     * 実装イメージ.png参考・暫定的文字アイコン
     */
    getIconText(iconName) {
        const iconMap = {
            // 特殊ボタン
            'download': '📥',
            'resize': '⤢',
            'palette': '🎨',
            
            // メインツール
            'pencil': '✏️',
            'paint-brush': '🖌️',
            'eraser': '🗑️',
            'blur': '🌫️',
            'eyedropper': '💧',
            'paint-bucket': '🪣',
            'selection': '⬚',
            'text-aa': '📝',
            
            // 下部ボタン
            'film': '🎬',
            'stack': '📚',
            'gear': '⚙️',
            
            // レイヤー制御
            'plus': '➕',
            'folder': '📁',
            'eye': '👁️',
            'trash': '🗑️'
        };
        
        return iconMap[iconName] || '?';
    }
    
    /**
     * 区切り線作成
     */
    createSeparator() {
        const separator = document.createElement('div');
        separator.className = 'toolbar-separator';
        separator.style.cssText = `
            width: 80%;
            height: 1px;
            background: rgba(240, 224, 214, 0.3);
            margin: 4px 0;
        `;
        this.elements.sidebar.appendChild(separator);
    }
    
    /**
     * イベントリスナー設定
     * UI操作・レスポンシブ・キーボード統合
     */
    setupEventListeners() {
        // ツールボタンクリック処理は個別設定済み
        
        // レイヤーパネル制御
        const addLayerBtn = document.getElementById('addLayerBtn');
        const addFolderBtn = document.getElementById('addFolderBtn');
        
        if (addLayerBtn) {
            addLayerBtn.addEventListener('click', () => {
                this.eventStore.emit('layer-created', { name: '新規レイヤー' });
            });
        }
        
        if (addFolderBtn) {
            addFolderBtn.addEventListener('click', () => {
                this.eventStore.emit('folder-created', { name: '新規フォルダ' });
            });
        }
        
        // ウィンドウリサイズ
        window.addEventListener('resize', () => {
            this.handleWindowResize();
        });
        
        // EventStore統合
        this.setupEventStoreIntegration();
        
        console.log('🎮 イベントリスナー設定完了');
    }
    
    /**
     * EventStore統合設定
     * システム間連携・状態同期
     */
    setupEventStoreIntegration() {
        // ツール変更イベント
        this.eventStore.on('tool-changed', (data) => {
            this.updateActiveToolButton(data.tool);
        });
        
        // UI表示切り替えイベント
        this.eventStore.on('ui-panel-toggle', (data) => {
            this.togglePanel(data.target);
        });
        
        // ポップアップ表示・非表示
        this.eventStore.on('popup-show', (data) => {
            this.showPopup(data.type, data.config);
        });
        
        this.eventStore.on('popup-hide', (data) => {
            this.hidePopup(data.target);
        });
        
        // レイヤー関連イベント
        this.eventStore.on('layer-created', (data) => {
            this.addLayerToPanel(data);
        });
        
        this.eventStore.on('layer-deleted', (data) => {
            this.removeLayerFromPanel(data.layerId);
        });
        
        console.log('🔗 EventStore統合完了');
    }
    
    /**
     * レスポンシブレイアウト設定
     * ブレークポイント対応・動的調整
     */
    setupResponsiveLayout() {
        // 初期レイアウト調整
        this.adjustLayoutForScreenSize();
        
        // メディアクエリ監視
        const mediaQueries = {
            mobile: window.matchMedia(`(max-width: ${this.breakpoints.mobile}px)`),
            tablet: window.matchMedia(`(max-width: ${this.breakpoints.tablet}px)`)
        };
        
        Object.entries(mediaQueries).forEach(([breakpoint, mq]) => {
            mq.addListener(() => {
                this.handleBreakpointChange(breakpoint, mq.matches);
            });
        });
        
        console.log('📱 レスポンシブレイアウト設定完了');
    }
    
    /**
     * ツールボタンクリック処理
     * アクション分岐・状態更新
     */
    handleToolButtonClick(action, buttonElement) {
        switch (action) {
            // 特殊ボタン
            case 'download':
                this.handleDownload();
                break;
            case 'resize':
                this.showResizeDialog();
                break;
            case 'color-palette':
                this.showColorPalette();
                break;
                
            // メインツール
            case 'tool-pen':
            case 'tool-airbrush':
            case 'tool-eraser':
            case 'tool-blur':
            case 'tool-eyedropper':
            case 'tool-fill':
            case 'tool-select':
            case 'tool-text':
                const toolName = action.replace('tool-', '');
                this.setActiveTool(toolName);
                break;
                
            // 下部ボタン
            case 'animation-mode':
                this.toggleAnimationMode();
                break;
            case 'layer-panel':
                this.toggleLayerPanel();
                break;
            case 'settings':
                this.showSettings();
                break;
                
            default:
                console.warn(`⚠️ 未実装アクション: ${action}`);
        }
        
        // ボタンフィードバック
        this.animateButtonClick(buttonElement);
    }
    
    /**
     * アクティブツール設定
     * ボタン状態更新・EventStore通知
     */
    setActiveTool(toolName) {
        if (this.toolConfig[toolName]) {
            const previousTool = this.uiState.currentTool;
            this.uiState.currentTool = toolName;
            
            this.updateActiveToolButton(toolName);
            
            this.eventStore.emit('tool-changed', {
                tool: toolName,
                previousTool: previousTool
            });
            
            console.log(`🔧 ツール変更: ${previousTool} → ${toolName}`);
        }
    }
    
    /**
     * アクティブツールボタン更新
     * 視覚的状態反映
     */
    updateActiveToolButton(toolName) {
        // 全ツールボタン非アクティブ化
        const toolButtons = this.elements.sidebar.querySelectorAll('.main-tool');
        toolButtons.forEach(btn => btn.classList.remove('active'));
        
        // 対象ツールボタンアクティブ化
        const activeButton = this.elements.sidebar.querySelector(`[data-tool="${toolName}"]`);
        if (activeButton) {
            activeButton.classList.add('active');
        }
    }
    
    /**
     * ボタンクリックアニメーション
     * フィードバック・UX向上
     */
    animateButtonClick(button) {
        button.style.transform = 'scale(0.95)';
        setTimeout(() => {
            button.style.transform = '';
        }, 100);
    }
    
    /**
     * カラーパレット表示
     * 移動可能ポップアップ
     */
    showColorPalette() {
        const paletteConfig = {
            title: 'カラーパレット',
            content: this.createColorPaletteContent(),
            position: { x: 80, y: 100 },
            size: { width: 240, height: 200 }
        };
        
        this.showPopup('color-palette', paletteConfig);
    }
    
    /**
     * カラーパレット内容作成
     * HSV円形ピッカー・ふたばカラープリセット
     */
    createColorPaletteContent() {
        const container = document.createElement('div');
        container.className = 'color-palette-content';
        
        // HSV円形ピッカー
        const hsvPicker = document.createElement('div');
        hsvPicker.className = 'hsv-picker';
        hsvPicker.title = 'HSV色相環';
        
        // カスタム色選択用の中心点
        const centerPoint = document.createElement('div');
        centerPoint.style.cssText = `
            position: absolute;
            top: 50%;
            left: 50%;
            width: 8px;
            height: 8px;
            background: white;
            border: 2px solid #800000;
            border-radius: 50%;
            transform: translate(-50%, -50%);
            pointer-events: none;
        `;
        hsvPicker.appendChild(centerPoint);
        
        // ふたばカラープリセット
        const presets = document.createElement('div');
        presets.className = 'color-presets';
        
        const futabaColors = [
            '#800000', '#aa5a56', '#cf9c97', '#e9c2ba', '#f0e0d6',
            '#000000', '#ffffff', '#808080', '#ff0000', '#00ff00'
        ];
        
        futabaColors.forEach(color => {
            const swatch = document.createElement('div');
            swatch.className = 'color-swatch';
            swatch.style.backgroundColor = color;
            swatch.title = color;
            swatch.addEventListener('click', () => {
                this.selectColor(color);
            });
            presets.appendChild(swatch);
        });
        
        container.appendChild(hsvPicker);
        container.appendChild(presets);
        
        return container;
    }
    
    /**
     * 色選択処理
     */
    selectColor(color) {
        this.eventStore.emit('color-selected', { 
            color: color,
            timestamp: Date.now() 
        });
        console.log(`🎨 色選択: ${color}`);
    }
    
    /**
     * 移動可能ポップアップ表示
     * ドラッグ&ドロップ対応
     */
    showPopup(type, config) {
        if (this.activePopups.has(type)) {
            this.hidePopup(type);
        }
        
        const popup = this.createMovablePopup(type, config);
        this.elements.popupContainer.appendChild(popup);
        this.activePopups.set(type, popup);
        
        console.log(`📋 ポップアップ表示: ${type}`);
    }
    
    /**
     * 移動可能ポップアップ作成
     * ドラッグハンドル・閉じるボタン付き
     */
    createMovablePopup(type, config) {
        const popup = document.createElement('div');
        popup.className = 'popup-panel';
        popup.style.cssText = `
            left: ${config.position.x}px;
            top: ${config.position.y}px;
            width: ${config.size.width}px;
            min-height: ${config.size.height}px;
            z-index: ${this.popupZIndex++};
        `;
        
        // ヘッダー（ドラッグハンドル）
        const header = document.createElement('div');
        header.className = 'popup-header';
        
        const title = document.createElement('span');
        title.className = 'popup-title';
        title.textContent = config.title;
        
        const closeBtn = document.createElement('button');
        closeBtn.className = 'popup-close';
        closeBtn.textContent = '×';
        closeBtn.addEventListener('click', () => {
            this.hidePopup(type);
        });
        
        header.appendChild(title);
        header.appendChild(closeBtn);
        
        // コンテンツ
        const content = document.createElement('div');
        content.className = 'popup-content';
        if (config.content instanceof HTMLElement) {
            content.appendChild(config.content);
        } else {
            content.innerHTML = config.content;
        }
        
        popup.appendChild(header);
        popup.appendChild(content);
        
        // ドラッグ機能追加
        this.makeDraggable(popup, header);
        
        return popup;
    }
    
    /**
     * ドラッグ機能実装
     * ポップアップ移動対応
     */
    makeDraggable(element, handle) {
        let isDragging = false;
        let dragOffset = { x: 0, y: 0 };
        
        handle.addEventListener('mousedown', (e) => {
            isDragging = true;
            const rect = element.getBoundingClientRect();
            dragOffset.x = e.clientX - rect.left;
            dragOffset.y = e.clientY - rect.top;
            handle.style.cursor = 'grabbing';
            e.preventDefault();
        });
        
        document.addEventListener('mousemove', (e) => {
            if (!isDragging) return;
            
            const x = e.clientX - dragOffset.x;
            const y = e.clientY - dragOffset.y;
            
            // 画面範囲制限
            const maxX = window.innerWidth - element.offsetWidth;
            const maxY = window.innerHeight - element.offsetHeight;
            
            element.style.left = Math.max(0, Math.min(maxX, x)) + 'px';
            element.style.top = Math.max(0, Math.min(maxY, y)) + 'px';
        });
        
        document.addEventListener('mouseup', () => {
            if (isDragging) {
                isDragging = false;
                handle.style.cursor = 'move';
            }
        });
    }
    
    /**
     * ポップアップ非表示
     */
    hidePopup(target) {
        if (target === 'all') {
            this.activePopups.forEach((popup, type) => {
                popup.remove();
            });
            this.activePopups.clear();
        } else if (this.activePopups.has(target)) {
            const popup = this.activePopups.get(target);
            popup.remove();
            this.activePopups.delete(target);
        }
    }
    
    /**
     * アニメーションモード切り替え
     */
    toggleAnimationMode() {
        this.uiState.animationMode = !this.uiState.animationMode;
        document.body.classList.toggle('animation-mode', this.uiState.animationMode);
        
        this.eventStore.emit('animation-mode-changed', {
            enabled: this.uiState.animationMode
        });
        
        console.log(`🎬 アニメーションモード: ${this.uiState.animationMode ? 'ON' : 'OFF'}`);
    }
    
    /**
     * レイヤーパネル切り替え
     */
    toggleLayerPanel() {
        this.uiState.layerPanelVisible = !this.uiState.layerPanelVisible;
        this.elements.layerPanel.classList.toggle('hidden', !this.uiState.layerPanelVisible);
        
        console.log(`📚 レイヤーパネル: ${this.uiState.layerPanelVisible ? '表示' : '非表示'}`);
    }
    
    /**
     * パネル切り替え汎用
     */
    togglePanel(target) {
        switch (target) {
            case 'sidebar':
                this.toggleSidebar();
                break;
            case 'layer-panel':
                this.toggleLayerPanel();
                break;
            case 'configurable':
                // TABキー対象（設定可能）
                this.toggleLayerPanel();
                break;
        }
    }
    
    /**
     * サイドバー切り替え
     */
    toggleSidebar() {
        this.uiState.sidebarVisible = !this.uiState.sidebarVisible;
        // CSS Grid対応で実装
        const appLayout = document.querySelector('.app-layout');
        if (appLayout) {
            appLayout.style.gridTemplateColumns = this.uiState.sidebarVisible
                ? 'var(--sidebar-width) 1fr var(--layer-panel-width)'
                : '0 1fr var(--layer-panel-width)';
        }
    }
    
    /**
     * ウィンドウリサイズ処理
     */
    handleWindowResize() {
        this.adjustLayoutForScreenSize();
        
        // PixiJS Canvas リサイズ
        this.eventStore.emit('canvas-resize', {
            width: window.innerWidth,
            height: window.innerHeight
        });
    }
    
    /**
     * 画面サイズ対応レイアウト調整
     */
    adjustLayoutForScreenSize() {
        const width = window.innerWidth;
        
        if (width <= this.breakpoints.mobile) {
            this.applyMobileLayout();
        } else if (width <= this.breakpoints.tablet) {
            this.applyTabletLayout();
        } else {
            this.applyDesktopLayout();
        }
    }
    
    /**
     * モバイルレイアウト適用
     */
    applyMobileLayout() {
        // レイヤーパネル自動非表示
        if (this.uiState.layerPanelVisible) {
            this.toggleLayerPanel();
        }
    }
    
    /**
     * タブレットレイアウト適用
     */
    applyTabletLayout() {
        // 中間サイズ対応
    }
    
    /**
     * デスクトップレイアウト適用
     */
    applyDesktopLayout() {
        // フル機能表示
    }
    
    /**
     * ブレークポイント変更処理
     */
    handleBreakpointChange(breakpoint, matches) {
        console.log(`📐 ブレークポイント変更: ${breakpoint} - ${matches ? 'ON' : 'OFF'}`);
        this.adjustLayoutForScreenSize();
    }
    
    /**
     * レイヤーパネルにレイヤー追加
     */
    addLayerToPanel(layerData) {
        const layerContent = document.getElementById('layerContent');
        if (!layerContent) return;
        
        const layerItem = document.createElement('div');
        layerItem.className = 'layer-item';
        layerItem.dataset.layerId = layerData.id || Date.now();
        
        layerItem.innerHTML = `
            <div class="layer-row">
                <span class="layer-visibility">👁️</span>
                <span class="layer-name">${layerData.name}</span>
                <div class="layer-thumbnail"></div>
            </div>
            <div class="layer-controls">
                <div class="opacity-control">
                    <label>不透明度: <span>100%</span></label>
                    <input type="range" min="0" max="100" value="100" class="opacity-slider">
                </div>
            </div>
        `;
        
        layerContent.appendChild(layerItem);
    }
    
    /**
     * レイヤーパネルからレイヤー削除
     */
    removeLayerFromPanel(layerId) {
        const layerItem = document.querySelector(`[data-layer-id="${layerId}"]`);
        if (layerItem) {
            layerItem.remove();
        }
    }
    
    /**
     * ダウンロード処理
     */
    handleDownload() {
        this.eventStore.emit('export-request', {
            format: 'png',
            quality: 1.0
        });
        console.log('💾 ダウンロード要求');
    }
    
    /**
     * リサイズダイアログ表示
     */
    showResizeDialog() {
        const resizeConfig = {
            title: 'キャンバスリサイズ',
            content: this.createResizeDialogContent(),
            position: { x: 200, y: 150 },
            size: { width: 300, height: 200 }
        };
        
        this.showPopup('resize-dialog', resizeConfig);
    }
    
    /**
     * リサイズダイアログ内容作成
     */
    createResizeDialogContent() {
        const container = document.createElement('div');
        container.innerHTML = `
            <div class="control-group">
                <label class="control-label">幅 <input type="number" value="800" class="control-input" id="resize-width"></label>
            </div>
            <div class="control-group">
                <label class="control-label">高さ <input type="number" value="600" class="control-input" id="resize-height"></label>
            </div>
            <div class="control-group">
                <button class="apply-btn" onclick="this.applyResize()">適用</button>
                <button class="cancel-btn" onclick="this.hidePopup('resize-dialog')">キャンセル</button>
            </div>
        `;
        
        return container;
    }
    
    /**
     * 設定画面表示
     */
    showSettings() {
        console.log('⚙️ 設定画面表示（Phase3で実装予定）');
    }
    
    /**
     * ショートカットヒント表示制御
     */
    showShortcutHint(duration = 3000) {
        if (this.elements.shortcutHint) {
            this.elements.shortcutHint.classList.add('visible');
            
            setTimeout(() => {
                this.elements.shortcutHint.classList.remove('visible');
            }, duration);
        }
    }
    
    /**
     * UI状態取得
     */
    getUIState() {
        return {
            ...this.uiState,
            activePopups: Array.from(this.activePopups.keys()),
            screenSize: {
                width: window.innerWidth,
                height: window.innerHeight
            }
        };
    }
    
    /**
     * デバッグ情報取得
     */
    getDebugInfo() {
        return {
            uiState: this.getUIState(),
            toolConfig: this.toolConfig,
            popupCount: this.activePopups.size,
            elements: Object.keys(this.elements).reduce((acc, key) => {
                acc[key] = !!this.elements[key];
                return acc;
            }, {}),
            useGPUAcceleration: this.useGPUAcceleration
        };
    }
    
    /**
     * リソース解放
     */
    destroy() {
        // 全ポップアップ削除
        this.hidePopup('all');
        
        // イベントリスナー削除
        window.removeEventListener('resize', this.handleWindowResize);
        
        // アニメーションフレーム停止
        if (this.animationFrame) {
            cancelAnimationFrame(this.animationFrame);
        }
        
        // GPU加速解除
        Object.values(this.elements).forEach(element => {
            if (element) {
                element.style.transform = '';
                element.style.willChange = '';
            }
        });
        
        console.log('🗑️ PixiV8UIController リソース解放完了');
    }
}

export default PixiV8UIController;