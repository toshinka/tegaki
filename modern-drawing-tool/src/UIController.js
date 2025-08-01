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
        this.activeTool = 'pen';
        
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
            console.warn('🚨 一部のDOM要素が見つかりません - 動的作成を試行');
            this.createMissingElements();
        }
    }
    
    /**
     * 不足DOM要素を動的作成
     */
    createMissingElements() {
        if (!this.sidebar) {
            this.sidebar = document.createElement('div');
            this.sidebar.id = 'sidebar';
            this.sidebar.className = `
                fixed left-0 top-0 h-full w-16 
                bg-gray-800 flex flex-col items-center py-4 gap-2
                z-40 transition-all duration-300
            `;
            document.body.appendChild(this.sidebar);
        }
        
        if (!this.canvasArea) {
            this.canvasArea = document.createElement('div');
            this.canvasArea.id = 'canvasArea';
            this.canvasArea.className = `
                ml-16 h-screen flex-1 relative
                bg-gray-100 overflow-hidden
            `;
            document.body.appendChild(this.canvasArea);
        }
        
        if (!this.popupContainer) {
            this.popupContainer = document.createElement('div');
            this.popupContainer.id = 'popupContainer';
            this.popupContainer.className = 'fixed inset-0 pointer-events-none z-30';
            document.body.appendChild(this.popupContainer);
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
        const toolsByCategory = this.getToolsByCategory();
        
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
            width: 80%;
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
     * ツールカテゴリ取得（デフォルト実装）
     */
    getToolsByCategory() {
        return {
            drawing: [
                { id: 'pen', name: 'ペン', icon: '✏️', action: () => this.selectTool('pen') },
                { id: 'airspray', name: 'エアスプレー', icon: '🖌️', action: () => this.selectTool('airspray') }
            ],
            effect: [
                { id: 'blur', name: 'ボカシ', icon: '🌫️', action: () => this.selectTool('blur') },
                { id: 'eraser', name: '消しゴム', icon: '🗑️', action: () => this.selectTool('eraser') }
            ],
            utility: [
                { id: 'eyedropper', name: 'スポイト', icon: '💧', action: () => this.selectTool('eyedropper') },
                { id: 'fill', name: '塗りつぶし', icon: '🪣', action: () => this.selectTool('fill') }
            ],
            selection: [
                { id: 'select', name: '範囲選択', icon: '⬚', action: () => this.selectTool('select') },
                { id: 'transform', name: '変形', icon: '✂️', action: () => this.selectTool('transform') }
            ]
        };
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
            width: 100%;
            align-items: center;
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
        
        // Fresco風スタイル適用
        button.style.cssText = `
            width: 44px;
            height: 44px;
            border: none;
            background: transparent;
            color: #888888;
            font-size: 20px;
            border-radius: 8px;
            cursor: pointer;
            transition: all 250ms ease-out;
            position: relative;
            display: flex;
            align-items: center;
            justify-content: center;
        `;
        
        // ホバーエフェクト
        button.addEventListener('mouseenter', () => {
            if (!button.classList.contains('active')) {
                button.style.background = 'rgba(255,255,255,0.15)';
                button.style.color = '#cccccc';
                button.style.transform = 'scale(1.05)';
            }
            this.showTooltip(button, tool.name);
        });
        
        button.addEventListener('mouseleave', () => {
            if (!button.classList.contains('active')) {
                button.style.background = 'transparent';
                button.style.color = '#888888';
                button.style.transform = 'scale(1)';
            }
            this.hideTooltip();
        });
        
        // クリックイベント
        button.addEventListener('click', () => {
            if (tool.action) {
                tool.action();
            }
        });
        
        return button;
    }
    
    /**
     * ツール選択
     */
    selectTool(toolId) {
        // 前のツールの選択解除
        const prevButton = this.sidebar.querySelector('.tool-button.active');
        if (prevButton) {
            prevButton.classList.remove('active');
            prevButton.style.background = 'transparent';
            prevButton.style.color = '#888888';
            prevButton.style.borderLeft = 'none';
        }
        
        // 新しいツールの選択
        const newButton = this.sidebar.querySelector(`[data-tool-id="${toolId}"]`);
        if (newButton) {
            newButton.classList.add('active');
            newButton.style.background = 'rgba(170, 90, 86, 0.15)';
            newButton.style.color = '#ffffff';
            newButton.style.borderLeft = '3px solid #aa5a56';
        }
        
        this.activeTool = toolId;
        
        // ツール変更イベント発火
        this.eventStore.emit('tool:change', { tool: toolId });
        
        console.log(`🎨 ツール選択: ${toolId}`);
    }
    
    /**
     * ツールチップ表示
     */
    showTooltip(element, text) {
        let tooltip = document.getElementById('tool-tooltip');
        if (!tooltip) {
            tooltip = document.createElement('div');
            tooltip.id = 'tool-tooltip';
            tooltip.className = `
                absolute z-50 px-2 py-1
                bg-gray-800 text-white text-sm rounded
                pointer-events-none opacity-0 transition-opacity
                whitespace-nowrap
            `;
            document.body.appendChild(tooltip);
        }
        
        tooltip.textContent = text;
        
        // 位置計算
        const rect = element.getBoundingClientRect();
        tooltip.style.left = `${rect.right + 8}px`;
        tooltip.style.top = `${rect.top + (rect.height / 2) - (tooltip.offsetHeight / 2)}px`;
        
        // 表示アニメーション
        setTimeout(() => {
            tooltip.style.opacity = '1';
        }, 300);
    }
    
    /**
     * ツールチップ非表示
     */
    hideTooltip() {
        const tooltip = document.getElementById('tool-tooltip');
        if (tooltip) {
            tooltip.style.opacity = '0';
        }
    }
    
    /**
     * イベントリスナー設定
     */
    setupEventListeners() {
        // キーボードショートカット
        document.addEventListener('keydown', this.handleKeyboardShortcut.bind(this));
        
        // ウィンドウリサイズ
        window.addEventListener('resize', this.handleWindowResize.bind(this));
        
        // フルスクリーン変更
        document.addEventListener('fullscreenchange', this.handleFullscreenChange.bind(this));
    }
    
    /**
     * キーボードショートカット処理
     */
    handleKeyboardShortcut(event) {
        // Tab: UI表示切り替え
        if (event.key === 'Tab' && !event.ctrlKey && !event.shiftKey) {
            event.preventDefault();
            this.toggleUI();
            return;
        }
        
        // F11: フルスクリーン切り替え
        if (event.key === 'F11') {
            event.preventDefault();
            this.toggleFullscreen();
            return;
        }
        
        // ツール選択ショートカット
        const toolShortcuts = {
            'b': 'pen',
            'e': 'eraser',
            'i': 'eyedropper',
            'g': 'fill',
            'm': 'select',
            't': 'transform'
        };
        
        if (toolShortcuts[event.key] && !event.ctrlKey && !event.shiftKey && !event.altKey) {
            event.preventDefault();
            this.selectTool(toolShortcuts[event.key]);
        }
    }
    
    /**
     * ウィンドウリサイズ処理
     */
    handleWindowResize() {
        // ポップアップの位置調整
        this.activePopups.forEach((popup, toolId) => {
            this.repositionPopup(popup, toolId);
        });
    }
    
    /**
     * フルスクリーン変更処理
     */
    handleFullscreenChange() {
        this.fullscreenMode = !!document.fullscreenElement;
        
        if (this.fullscreenMode) {
            this.sidebar.style.background = 'rgba(42, 42, 42, 0.9)';
        } else {
            this.sidebar.style.background = 'rgb(42, 42, 42)';
        }
    }
    
    /**
     * UI表示切り替え
     */
    toggleUI() {
        this.uiVisible = !this.uiVisible;
        
        if (this.uiVisible) {
            this.sidebar.style.transform = 'translateX(0)';
            this.sidebar.style.opacity = '1';
        } else {
            this.sidebar.style.transform = 'translateX(-100%)';
            this.sidebar.style.opacity = '0';
        }
        
        // 他のUIパネルも同様に制御
        this.eventStore.emit('ui:visibility:change', { visible: this.uiVisible });
        
        console.log(`🎨 UI表示切り替え: ${this.uiVisible ? '表示' : '非表示'}`);
    }
    
    /**
     * フルスクリーン切り替え
     */
    toggleFullscreen() {
        if (document.fullscreenElement) {
            document.exitFullscreen();
        } else {
            document.documentElement.requestFullscreen();
        }
    }
    
    /**
     * 通知システム作成
     */
    createNotificationSystem() {
        let container = document.getElementById('notification-container');
        if (!container) {
            container = document.createElement('div');
            container.id = 'notification-container';
            container.className = `
                fixed top-4 right-4 z-50 
                flex flex-col gap-2
                max-w-sm
            `;
            document.body.appendChild(container);
        }
    }
    
    /**
     * ツール変更処理
     */
    handleToolChange(eventData) {
        const { tool } = eventData.payload;
        
        // ポップアップ表示
        if (this.shouldShowPopup(tool)) {
            this.showToolPopup(tool);
        } else {
            this.hideAllPopups();
        }
        
        console.log(`🎨 ツール変更処理: ${tool}`);
    }
    
    /**
     * ポップアップ表示判定
     */
    shouldShowPopup(tool) {
        const popupTools = ['pen', 'airspray', 'blur', 'eraser'];
        return popupTools.includes(tool);
    }
    
    /**
     * ツールポップアップ表示
     */
    showToolPopup(toolId) {
        // 既存ポップアップを非表示
        this.hideAllPopups();
        
        const button = this.sidebar.querySelector(`[data-tool-id="${toolId}"]`);
        if (!button) return;
        
        const popup = this.createToolPopup(toolId);
        this.activePopups.set(toolId, popup);
        
        // 位置設定
        const rect = button.getBoundingClientRect();
        popup.style.left = `${rect.right + 24}px`;
        popup.style.top = `${rect.top + (rect.height / 2) - (popup.offsetHeight / 2)}px`;
        
        this.popupContainer.appendChild(popup);
        
        // アニメーション
        setTimeout(() => {
            popup.style.transform = 'translateX(0) scale(1)';
            popup.style.opacity = '1';
        }, 10);
        
        console.log(`🎨 ポップアップ表示: ${toolId}`);
    }
    
    /**
     * ツールポップアップ作成
     */
    createToolPopup(toolId) {
        const popup = document.createElement('div');
        popup.className = 'tool-popup';
        popup.style.cssText = `
            position: absolute;
            background: rgba(42, 42, 42, 0.96);
            border-radius: 16px;
            padding: 16px;
            backdrop-filter: blur(10px);
            box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
            transform: translateX(-20px) scale(0.9);
            opacity: 0;
            transition: all 300ms ease-out;
            pointer-events: auto;
            min-width: 200px;
            color: white;
        `;
        
        const content = this.getPopupContent(toolId);
        popup.innerHTML = content;
        
        // スライダーイベント設定
        this.setupPopupEvents(popup, toolId);
        
        return popup;
    }
    
    /**
     * ポップアップコンテンツ取得
     */
    getPopupContent(toolId) {
        const configs = {
            pen: {
                title: 'ペンツール',
                controls: [
                    { type: 'slider', label: 'サイズ', id: 'size', min: 1, max: 100, value: 5 },
                    { type: 'slider', label: '不透明度', id: 'opacity', min: 0, max: 100, value: 100 },
                    { type: 'checkbox', label: '筆圧感度', id: 'pressure', checked: true }
                ]
            },
            airspray: {
                title: 'エアスプレー',
                controls: [
                    { type: 'slider', label: '噴射強度', id: 'intensity', min: 0, max: 100, value: 50 },
                    { type: 'slider', label: '粒子密度', id: 'density', min: 10, max: 100, value: 30 },
                    { type: 'slider', label: '拡散範囲', id: 'spread', min: 5, max: 50, value: 15 }
                ]
            },
            blur: {
                title: 'ボカシツール',
                controls: [
                    { type: 'slider', label: 'ボカシ強度', id: 'strength', min: 0, max: 12, value: 3 },
                    { type: 'select', label: 'ボカシ種類', id: 'type', options: ['ガウシアン', 'モーション', '放射状'], value: 'ガウシアン' },
                    { type: 'checkbox', label: 'エッジ保護', id: 'edgeProtect', checked: false }
                ]
            },
            eraser: {
                title: '消しゴム',
                controls: [
                    { type: 'slider', label: 'サイズ', id: 'size', min: 1, max: 100, value: 10 },
                    { type: 'slider', label: '強度', id: 'strength', min: 1, max: 100, value: 100 },
                    { type: 'checkbox', label: 'ソフト消し', id: 'soft', checked: false }
                ]
            }
        };
        
        const config = configs[toolId];
        if (!config) return '<div>設定なし</div>';
        
        let html = `<h3 style="margin: 0 0 12px 0; color: #fff; font-size: 14px;">${config.title}</h3>`;
        
        config.controls.forEach(control => {
            html += this.createControlHTML(control);
        });
        
        return html;
    }
    
    /**
     * コントロールHTML作成
     */
    createControlHTML(control) {
        switch (control.type) {
            case 'slider':
                return `
                    <div style="margin-bottom: 12px;">
                        <label style="display: block; font-size: 12px; color: #ccc; margin-bottom: 4px;">
                            ${control.label}
                        </label>
                        <input type="range" 
                               id="${control.id}" 
                               min="${control.min}" 
                               max="${control.max}" 
                               value="${control.value}"
                               style="width: 100%; height: 6px; background: #555; outline: none; border-radius: 3px;">
                    </div>
                `;
            case 'checkbox':
                return `
                    <div style="margin-bottom: 12px;">
                        <label style="display: flex; align-items: center; font-size: 12px; color: #ccc; cursor: pointer;">
                            <input type="checkbox" 
                                   id="${control.id}" 
                                   ${control.checked ? 'checked' : ''}
                                   style="margin-right: 8px;">
                            ${control.label}
                        </label>
                    </div>
                `;
            case 'select':
                const options = control.options.map(opt => 
                    `<option value="${opt}" ${opt === control.value ? 'selected' : ''}>${opt}</option>`
                ).join('');
                return `
                    <div style="margin-bottom: 12px;">
                        <label style="display: block; font-size: 12px; color: #ccc; margin-bottom: 4px;">
                            ${control.label}
                        </label>
                        <select id="${control.id}" 
                                style="width: 100%; padding: 4px; background: #555; color: #fff; border: none; border-radius: 4px;">
                            ${options}
                        </select>
                    </div>
                `;
            default:
                return '';
        }
    }
    
    /**
     * ポップアップイベント設定
     */
    setupPopupEvents(popup, toolId) {
        const sliders = popup.querySelectorAll('input[type="range"]');
        const checkboxes = popup.querySelectorAll('input[type="checkbox"]');
        const selects = popup.querySelectorAll('select');
        
        // スライダーイベント
        sliders.forEach(slider => {
            slider.addEventListener('input', (e) => {
                this.eventStore.emit('tool:config:update', {
                    tool: toolId,
                    property: slider.id,
                    value: parseFloat(e.target.value)
                });
            });
        });
        
        // チェックボックスイベント
        checkboxes.forEach(checkbox => {
            checkbox.addEventListener('change', (e) => {
                this.eventStore.emit('tool:config:update', {
                    tool: toolId,
                    property: checkbox.id,
                    value: e.target.checked
                });
            });
        });
        
        // セレクトイベント
        selects.forEach(select => {
            select.addEventListener('change', (e) => {
                this.eventStore.emit('tool:config:update', {
                    tool: toolId,
                    property: select.id,
                    value: e.target.value
                });
            });
        });
    }
    
    /**
     * ポップアップ再配置
     */
    repositionPopup(popup, toolId) {
        const button = this.sidebar.querySelector(`[data-tool-id="${toolId}"]`);
        if (!button) return;
        
        const rect = button.getBoundingClientRect();
        popup.style.left = `${rect.right + 24}px`;
        popup.style.top = `${rect.top + (rect.height / 2) - (popup.offsetHeight / 2)}px`;
    }
    
    /**
     * 全ポップアップ非表示
     */
    hideAllPopups() {
        this.activePopups.forEach((popup, toolId) => {
            popup.style.transform = 'translateX(-20px) scale(0.9)';
            popup.style.opacity = '0';
            setTimeout(() => {
                if (popup.parentNode) {
                    popup.parentNode.removeChild(popup);
                }
            }, 300);
        });
        this.activePopups.clear();
    }
    
    /**
     * ポップアップ表示
     */
    showPopup(eventData) {
        const { type, target, content } = eventData.payload;
        // 実装予定
    }
    
    /**
     * ポップアップ非表示
     */
    hidePopup(eventData) {
        const { target } = eventData.payload;
        // 実装予定
    }
    
    /**
     * 成功通知表示
     */
    showSuccessNotification(eventData) {
        this.showNotification(eventData.payload.message, 'success');
    }
    
    /**
     * エラー通知表示
     */
    showErrorNotification(eventData) {
        this.showNotification(eventData.payload.error, 'error');
    }
    
    /**
     * 通知表示
     */
    showNotification(message, type = 'info', duration = 3000) {
        const container = document.getElementById('notification-container');
        if (!container) return;
        
        const notification = document.createElement('div');
        const bgColor = type === 'error' ? 'bg-red-500' : type === 'success' ? 'bg-green-500' : 'bg-blue-500';
        
        notification.className = `
            ${bgColor} text-white px-4 py-2 rounded shadow-lg
            transform transition-all duration-300 translate-x-full
            text-sm max-w-xs
        `;
        notification.textContent = message;
        
        container.appendChild(notification);
        
        // アニメーション
        setTimeout(() => {
            notification.classList.remove('translate-x-full');
        }, 10);
        
        // 自動削除
        setTimeout(() => {
            notification.classList.add('translate-x-full');
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.parentNode.removeChild(notification);
                }
            }, 300);
        }, duration);
    }
    
    /**
     * 設定パネル表示
     */
    showSettingsPanel() {
        console.log('⚙️ 設定パネル表示（未実装）');
        this.showNotification('設定パネルは開発中です', 'info');
    }
    
    /**
     * ダウンロードダイアログ表示
     */
    showDownloadDialog() {
        console.log('📥 ダウンロードダイアログ表示（未実装）');
        this.showNotification('ダウンロード機能は開発中です', 'info');
    }
    
    /**
     * リサイズダイアログ表示
     */
    showResizeDialog() {
        console.log('⤢ リサイズダイアログ表示（未実装）');
        this.showNotification('リサイズ機能は開発中です', 'info');
    }
    
    /**
     * アニメーションモード切り替え
     */
    toggleAnimationMode() {
        console.log('🎬 アニメーションモード切り替え（未実装）');
        this.showNotification('アニメーション機能は開発中です', 'info');
    }
    
    /**
     * レイヤーパネル切り替え
     */
    toggleLayerPanel() {
        console.log('📚 レイヤーパネル切り替え（未実装）');
        this.showNotification('レイヤーパネルは開発中です', 'info');
    }
    
    /**
     * デバッグ情報取得
     */
    getDebugInfo() {
        return {
            uiVisible: this.uiVisible,
            fullscreenMode: this.fullscreenMode,
            activeTool: this.activeTool,
            activePopupsCount: this.activePopups.size,
            sidebarElements: this.sidebar ? this.sidebar.children.length : 0
        };
    }
}