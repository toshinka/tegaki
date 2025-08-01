// UIController.js - Fresco風UI制御統合（Phase2・封印解除時実装）

/**
 * 🎨 Fresco風UI制御統合（Phase2・封印解除時実装）
 * 責務: 左側サイドバー詳細実装、ポップアップパレット・スライダー、TAB切り替え・自由移動システム、通知システム・ツールチップ
 */
export class UIController {
    constructor(eventStore, toolProcessor) {
        this.eventStore = eventStore;
        this.toolProcessor = toolProcessor;
        
        // UI要素参照
        this.sidebar = null;
        this.canvasArea = null;
        this.popupContainer = null;
        
        // UI状態
        this.activePopups = new Map();
        this.uiVisible = true;
        this.fullscreenMode = false;
        
        // アニメーション設定
        this.animationDuration = 300;
        
        // 初期化
        this.initializeElements();
        this.subscribeToEvents();
        
        console.log('✅ UIController初期化完了');
    }
    
    /**
     * Fresco風UI初期化
     */
    initializeFrescoUI() {
        this.createLeftSidebar();
        this.setupEventListeners();
        this.createNotificationSystem();
        
        console.log('🎨 Fresco風UI初期化完了');
    }
    
    /**
     * DOM要素初期化
     */
    initializeElements() {
        this.sidebar = document.getElementById('sidebar');
        this.canvasArea = document.getElementById('canvasArea');
        this.popupContainer = document.getElementById('popupContainer');
        
        if (!this.sidebar || !this.canvasArea || !this.popupContainer) {
            console.error('🚨 必要なDOM要素が見つかりません');
            return;
        }
    }
    
    /**
     * イベント購読
     */
    subscribeToEvents() {
        // ツール変更イベント
        this.eventStore.on('tool:change', this.handleToolChange.bind(this), 'ui-controller');
        
        // UI制御イベント
        this.eventStore.on('ui:toggle:all', this.toggleUI.bind(this), 'ui-controller');
        this.eventStore.on('ui:popup:show', this.showPopup.bind(this), 'ui-controller');
        this.eventStore.on('ui:popup:hide', this.hidePopup.bind(this), 'ui-controller');
        
        // 通知イベント
        this.eventStore.on('system:success', this.showSuccessNotification.bind(this), 'ui-controller');
        this.eventStore.on('engine:error', this.showErrorNotification.bind(this), 'ui-controller');
        
        console.log('📝 UIイベント購読開始');
    }
    
    /**
     * 左側サイドバー作成（Fresco風詳細実装）
     */
    createLeftSidebar() {
        // サイドバークリア
        this.sidebar.innerHTML = '';
        
        // ツールカテゴリ別にグループ化
        const toolsByCategory = this.toolProcessor.getToolsByCategory();
        
        // 上部グループ（設定・ファイル操作）
        const topGroup = this.createToolGroup('top', [
            { id: 'settings', name: '設定', icon: '⚙️', action: () => this.showSettingsPanel() },
            { id: 'download', name: 'ダウンロード', icon: '📥', action: () => this.showDownloadDialog() },
            { id: 'resize', name: 'リサイズ', icon: '⤢', action: () => this.showResizeDialog() }
        ]);
        
        // ツールグループ（描画・効果・ユーティリティ）
        const drawingTools = toolsByCategory.drawing || [];
        const effectTools = toolsByCategory.effect || [];
        const utilityTools = toolsByCategory.utility || [];
        const selectionTools = toolsByCategory.selection || [];
        
        const toolGroup = this.createToolGroup('tools', [
            ...drawingTools,
            ...effectTools,
            ...utilityTools,
            ...selectionTools
        ]);
        
        // 下部グループ（アニメ・レイヤー）
        const bottomGroup = this.createToolGroup('bottom', [
            { id: 'animation', name: 'アニメ', icon: '🎬', action: () => this.toggleAnimationMode() },
            { id: 'layers', name: 'レイヤー', icon: '📚', action: () => this.toggleLayerPanel() }
        ]);
        
        // サイドバーに追加
        this.sidebar.appendChild(topGroup);
        
        // 区切り線
        const separator1 = document.createElement('div');
        separator1.className = 'sidebar-separator';
        separator1.style.cssText = `
            height: 1px;
            background: rgba(170, 90, 86, 0.3);
            margin: 12px 0;
        `;
        this.sidebar.appendChild(separator1);
        
        this.sidebar.appendChild(toolGroup);
        
        const separator2 = document.createElement('div');
        separator2.className = 'sidebar-separator';
        separator2.style.cssText = separator1.style.cssText;
        this.sidebar.appendChild(separator2);
        
        this.sidebar.appendChild(bottomGroup);
        
        console.log('🎨 左側サイドバー作成完了');
    }
    
    /**
     * ツールグループ作成
     */
    createToolGroup(groupName, tools) {
        const group = document.createElement('div');
        group.className = `tool-group tool-group-${groupName}`;
        group.style.cssText = `
            display: flex;
            flex-direction: column;
            gap: 6px;
        `;
        
        tools.forEach(tool => {
            const button = this.createToolButton(tool);
            group.appendChild(button);
        });
        
        return group;
    }
    
    /**
     * ツールボタン作成（Fresco風詳細デザイン）
     */
    createToolButton(tool) {
        const button = document.createElement('button');
        button.className = 'tool-button';
        button.setAttribute('data-tool-id', tool.id);
        button.innerHTML = tool.icon;
        button.title = tool.name;