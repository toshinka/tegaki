/**
 * UIController - Adobe Fresco風UI制御統合（Phase2拡張）
 * 左側サイドバー・ポップアップパレット・スライダー・通知システム統合
 */
export class UIController {
    constructor(eventStore) {
        this.eventStore = eventStore;
        
        // UI要素参照
        this.sidebar = null;
        this.popupContainer = null;
        this.activePopups = new Map();
        
        // UI状態
        this.sidebarCollapsed = false;
        this.fullscreenMode = false;
        this.activeToolPopup = null;
        
        // ツールアイコン定義（Phosphor Icons互換）
        this.toolIcons = {
            pen: '✏️',
            eraser: '🗑️',
            airspray: '🖌️',
            blur: '🌫️',
            eyedropper: '💧',
            fill: '🪣',
            selection: '⬚',
            text: '📝',
            shape: '⭕',
            transform: '✂️',
            settings: '⚙️',
            download: '📥',
            resize: '⤢',
            animation: '🎬',
            layers: '📚'
        };
        
        // 通知システム
        this.notifications = [];
        this.maxNotifications = 5;
        
        this.initializeUI();
        this.setupEventSubscriptions();
    }
    
    // UI初期化
    initializeUI() {
        this.createSidebar();
        this.createPopupContainer();
        this.createNotificationSystem();
        this.setupResponsiveDesign();
        
        console.log('✅ Adobe Fresco-style UI initialized');
    }
    
    // 左側サイドバー作成
    createSidebar() {
        this.sidebar = document.getElementById('sidebar');
        if (!this.sidebar) {
            console.error('🚨 Sidebar element not found');
            return;
        }
        
        // サイドバーツールアイコン生成
        this.createToolIcons();
        
        // サイドバー操作設定
        this.setupSidebarInteractions();
    }
    
    // ツールアイコン生成
    createToolIcons() {
        const toolGroups = [
            // 上部グループ
            {
                name: 'settings',
                tools: ['settings', 'download', 'resize'],
                className: 'tool-group-top'
            },
            // メインツールグループ
            {
                name: 'main',
                tools: ['pen', 'airspray', 'blur', 'eraser', 'eyedropper', 'selection', 'fill', 'text', 'shape', 'transform'],
                className: 'tool-group-main'
            },
            // 下部グループ
            {
                name: 'panels',
                tools: ['animation', 'layers'],
                className: 'tool-group-bottom'
            }
        ];
        
        this.sidebar.innerHTML = '';
        
        toolGroups.forEach(group => {
            const groupElement = document.createElement('div');
            groupElement.className = `tool-group ${group.className}`;
            
            group.tools.forEach(toolName => {
                const toolButton = this.createToolButton(toolName);
                groupElement.appendChild(toolButton);
            });
            
            this.sidebar.appendChild(groupElement);
        });
    }
    
    // ツールボタン作成
    createToolButton(toolName) {
        const button = document.createElement('button');
        button.className = 'tool-button';
        button.setAttribute('data-tool', toolName);
        button.setAttribute('title', this.getToolTitle(toolName));
        
        // アイコン設定
        const icon = document.createElement('span');
        icon.className = 'tool-icon';
        icon.textContent = this.toolIcons[toolName] || '❓';
        button.appendChild(icon);
        
        // クリックイベント
        button.addEventListener('click', (e) => {
            this.handleToolClick(toolName, e);
        });
        
        // ホバーエフェクト
        this.setupToolButtonHover(button, toolName);
        
        return button;
    }
    
    // ツールクリック処理
    handleToolClick(toolName, event) {
        // 特殊機能ハンドリング
        switch (toolName) {
            case 'settings':
                this.openSettingsPanel();
                break;
            case 'download':
                this.openDownloadPanel();
                break;
            case 'resize':
                this.openResizePanel();
                break;
            case 'animation':
                this.toggleAnimationMode();
                break;
            case 'layers':
                this.toggleLayerPanel();
                break;
            default:
                // 通常のツール切り替え
                this.switchTool(toolName);
    // ツールクリック処理
    handleToolClick(toolName, event) {
        // 特殊機能ハンドリング
        switch (toolName) {
            case 'settings':
                this.openSettingsPanel();
                break;
            case 'download':
                this.openDownloadPanel();
                break;
            case 'resize':
                this.openResizePanel();
                break;
            case 'animation':
                this.toggleAnimationMode();
                break;
            case 'layers':
                this.toggleLayerPanel();
                break;
            default:
                // 通常のツール切り替え
                this.switchTool(toolName);
                this.toggleToolPopup(toolName, event.currentTarget);
                break;
        }
        
        // アクティブ状態更新
        this.updateActiveToolButton(toolName);
    }
    
    // ツール切り替え
    switchTool(toolName) {
        this.eventStore.emit(this.eventStore.eventTypes.TOOL_CHANGE, {
            tool: toolName
        });
    }
    
    // ツールポップアップ切り替え
    toggleToolPopup(toolName, buttonElement) {
        // 既存のポップアップを閉じる
        if (this.activeToolPopup && this.activeToolPopup !== toolName) {
            this.closePopup(this.activeToolPopup);
        }
        
        // 同じツールのポップアップの場合は切り替え
        if (this.activeToolPopup === toolName) {
            this.closePopup(toolName);
            this.activeToolPopup = null;
        } else {
            this.openToolPopup(toolName, buttonElement);
            this.activeToolPopup = toolName;
        }
    }
    
    // ツールポップアップ開く
    openToolPopup(toolName, buttonElement) {
        const popupConfig = this.getToolPopupConfig(toolName);
        if (!popupConfig) return;
        
        const popup = this.createPopup(toolName, popupConfig, buttonElement);
        this.activePopups.set(toolName, popup);
        
        this.eventStore.emit(this.eventStore.eventTypes.UI_POPUP_OPEN, {
            tool: toolName,
            popup: popup
        });
    }
    
    // ツールポップアップ設定取得
    getToolPopupConfig(toolName) {
        const configs = {
            pen: {
                title: 'ペン設定',
                controls: [
                    { type: 'slider', name: 'size', label: 'サイズ', min: 1, max: 100, value: 3 },
                    { type: 'slider', name: 'opacity', label: '不透明度', min: 0, max: 1, step: 0.1, value: 1 },
                    { type: 'checkbox', name: 'pressure', label: '筆圧感度', checked: true },
                    { type: 'slider', name: 'smoothing', label: 'スムージング', min: 0, max: 1, step: 0.1, value: 0.5 }
                ]
            },
            airspray: {
                title: 'エアスプレー設定',
                controls: [
                    { type: 'slider', name: 'size', label: 'サイズ', min: 5, max: 200, value: 20 },
                    { type: 'slider', name: 'opacity', label: '不透明度', min: 0, max: 1, step: 0.1, value: 0.3 },
                    { type: 'slider', name: 'density', label: '密度', min: 0, max: 1, step: 0.1, value: 0.6 },
                    { type: 'slider', name: 'scatter', label: '拡散', min: 0.1, max: 3, step: 0.1, value: 1 }
                ]
            },
            blur: {
                title: 'ボカシ設定',
                controls: [
                    { type: 'slider', name: 'size', label: 'サイズ', min: 1, max: 50, value: 15 },
                    { type: 'slider', name: 'strength', label: '強度', min: 0, max: 1, step: 0.1, value: 0.7 },
                    { type: 'select', name: 'type', label: '種類', options: ['gaussian', 'motion', 'radial'], value: 'gaussian' },
                    { type: 'checkbox', name: 'edgeProtection', label: 'エッジ保護', checked: true }
                ]
            },
            eraser: {
                title: '消しゴム設定',
                controls: [
                    { type: 'slider', name: 'size', label: 'サイズ', min: 1, max: 200, value: 10 },
                    { type: 'slider', name: 'hardness', label: '硬さ', min: 0, max: 1, step: 0.1, value: 0.8 },
                    { type: 'select', name: 'mode', label: 'モード', options: ['pixel', 'layer'], value: 'pixel' }
                ]
            },
            eyedropper: {
                title: 'スポイト設定',
                controls: [
                    { type: 'slider', name: 'size', label: 'サンプル範囲', min: 1, max: 10, value: 1 },
                    { type: 'select', name: 'mode', label: 'モード', options: ['average', 'center'], value: 'average' },
                    { type: 'checkbox', name: 'showPreview', label: 'プレビュー表示', checked: true }
                ]
            },
            fill: {
                title: '塗りつぶし設定',
                controls: [
                    { type: 'slider', name: 'tolerance', label: '許容値', min: 0, max: 255, value: 32 },
                    { type: 'checkbox', name: 'antiAlias', label: 'アンチエイリアス', checked: true },
                    { type: 'checkbox', name: 'contiguous', label: '隣接領域のみ', checked: true }
                ]
            },
            selection: {
                title: '選択設定',
                controls: [
                    { type: 'select', name: 'type', label: '選択種類', options: ['rectangle', 'ellipse', 'lasso', 'magic'], value: 'rectangle' },
                    { type: 'checkbox', name: 'antiAlias', label: 'アンチエイリアス', checked: true },
                    { type: 'slider', name: 'feather', label: 'ぼかし', min: 0, max: 20, value: 0 }
                ]
            }
        };
        
        return configs[toolName];
    }
    
    // ポップアップ作成
    createPopup(toolName, config, buttonElement) {
        const popup = document.createElement('div');
        popup.className = 'popup-panel tool-popup';
        popup.setAttribute('data-tool', toolName);
        
        // ヘッダー作成
        const header = document.createElement('div');
        header.className = 'popup-header';
        header.innerHTML = `
            <span class="popup-title">${config.title}</span>
            <button class="popup-close" data-action="close">×</button>
        `;
        popup.appendChild(header);
        
        // コントロール作成
        const content = document.createElement('div');
        content.className = 'popup-content';
        
        config.controls.forEach(control => {
            const controlElement = this.createControl(control, toolName);
            content.appendChild(controlElement);
        });
        
        popup.appendChild(content);
        
        // 位置計算・設定
        this.positionPopup(popup, buttonElement);
        
        // イベントリスナー設定
        this.setupPopupInteractions(popup, toolName);
        
        // ポップアップコンテナに追加
        this.popupContainer.appendChild(popup);
        
        // 表示アニメーション
        requestAnimationFrame(() => {
            popup.classList.add('visible');
        });
        
        return popup;
    }
    
    // コントロール作成
    createControl(config, toolName) {
        const controlGroup = document.createElement('div');
        controlGroup.className = 'control-group';
        
        const label = document.createElement('div');
        label.className = 'control-label';
        
        let controlElement;
        
        switch (config.type) {
            case 'slider':
                controlElement = this.createSliderControl(config, toolName);
                label.innerHTML = `
                    <span>${config.label}</span>
                    <input type="number" class="control-input" value="${config.value}" 
                           min="${config.min}" max="${config.max}" step="${config.step || 1}"
                           data-control="${config.name}">
                `;
                break;
                
            case 'checkbox':
                controlElement = this.createCheckboxControl(config, toolName);
                label.innerHTML = `<span>${config.label}</span>`;
                break;
                
            case 'select':
                controlElement = this.createSelectControl(config, toolName);
                label.innerHTML = `<span>${config.label}</span>`;
                break;
        }
        
        controlGroup.appendChild(label);
        if (controlElement) {
            controlGroup.appendChild(controlElement);
        }
        
        return controlGroup;
    }
    
    // スライダーコントロール作成
    createSliderControl(config, toolName) {
        const slider = document.createElement('input');
        slider.type = 'range';
        slider.className = 'control-slider';
        slider.min = config.min;
        slider.max = config.max;
        slider.step = config.step || 1;
        slider.value = config.value;
        slider.setAttribute('data-control', config.name);
        
        // スライダー変更イベント
        slider.addEventListener('input', (e) => {
            this.handleControlChange(toolName, config.name, parseFloat(e.target.value));
            // 連動する数値入力を更新
            const numberInput = slider.parentElement.querySelector('.control-input');
            if (numberInput) {
                numberInput.value = e.target.value;
            }
        });
        
        return slider;
    }
    
    // チェックボックスコントロール作成
    createCheckboxControl(config, toolName) {
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.className = 'control-checkbox';
        checkbox.checked = config.checked;
        checkbox.setAttribute('data-control', config.name);
        
        checkbox.addEventListener('change', (e) => {
            this.handleControlChange(toolName, config.name, e.target.checked);
        });
        
        return checkbox;
    }
    
    // セレクトコントロール作成
    createSelectControl(config, toolName) {
        const select = document.createElement('select');
        select.className = 'control-select';
        select.setAttribute('data-control', config.name);
        
        config.options.forEach(option => {
            const optionElement = document.createElement('option');
            optionElement.value = option;
            optionElement.textContent = option;
            if (option === config.value) {
                optionElement.selected = true;
            }
            select.appendChild(optionElement);
        });
        
        select.addEventListener('change', (e) => {
            this.handleControlChange(toolName, config.name, e.target.value);
        });
        
        return select;
    }
    
    // コントロール変更処理
    handleControlChange(toolName, controlName, value) {
        console.log(`⚙️ Control changed: ${toolName}.${controlName} = ${value}`);
        
        // ツール設定更新イベント発火
        this.eventStore.emit(this.eventStore.eventTypes.TOOL_CONFIG_CHANGE, {
            tool: toolName,
            property: controlName,
            value: value
        });
    }
    
    // ポップアップ位置設定
    positionPopup(popup, buttonElement) {
        const buttonRect = buttonElement.getBoundingClientRect();
        const sidebarRect = this.sidebar.getBoundingClientRect();
        
        // 右側に24px離して配置
        popup.style.position = 'fixed';
        popup.style.left = `${sidebarRect.right + 24}px`;
        popup.style.top = `${buttonRect.top}px`;
        popup.style.zIndex = '1000';
    }
    
    // ポップアップインタラクション設定
    setupPopupInteractions(popup, toolName) {
        // 閉じるボタン
        const closeButton = popup.querySelector('.popup-close');
        if (closeButton) {
            closeButton.addEventListener('click', () => {
                this.closePopup(toolName);
            });
        }
        
        // 数値入力との連動
        const numberInputs = popup.querySelectorAll('.control-input');
        numberInputs.forEach(input => {
            input.addEventListener('input', (e) => {
                const controlName = e.target.getAttribute('data-control');
                const value = parseFloat(e.target.value);
                
                // 対応するスライダーを更新
                const slider = popup.querySelector(`input[type="range"][data-control="${controlName}"]`);
                if (slider) {
                    slider.value = value;
                }
                
                this.handleControlChange(toolName, controlName, value);
            });
        });
        
        // ドラッグ移動対応
        this.makePopupDraggable(popup);
    }
    
    // ポップアップドラッグ移動
    makePopupDraggable(popup) {
        const header = popup.querySelector('.popup-header');
        if (!header) return;
        
        let isDragging = false;
        let startX, startY, startLeft, startTop;
        
        header.addEventListener('mousedown', (e) => {
            isDragging = true;
            startX = e.clientX;
            startY = e.clientY;
            startLeft = parseInt(popup.style.left);
            startTop = parseInt(popup.style.top);
            
            header.style.cursor = 'grabbing';
            e.preventDefault();
        });
        
        document.addEventListener('mousemove', (e) => {
            if (!isDragging) return;
            
            const deltaX = e.clientX - startX;
            const deltaY = e.clientY - startY;
            
            popup.style.left = `${startLeft + deltaX}px`;
            popup.style.top = `${startTop + deltaY}px`;
        });
        
        document.addEventListener('mouseup', () => {
            if (isDragging) {
                isDragging = false;
                header.style.cursor = 'grab';
            }
        });
        
        header.style.cursor = 'grab';
    }
    
    // ポップアップ閉じる
    closePopup(toolName) {
        const popup = this.activePopups.get(toolName);
        if (!popup) return;
        
        popup.classList.remove('visible');
        
        setTimeout(() => {
            if (popup.parentElement) {
                popup.parentElement.removeChild(popup);
            }
            this.activePopups.delete(toolName);
            
            if (this.activeToolPopup === toolName) {
                this.activeToolPopup = null;
            }
        }, 300);
        
        this.eventStore.emit(this.eventStore.eventTypes.UI_POPUP_CLOSE, {
            tool: toolName
        });
    }
    
    // 全ポップアップ閉じる
    closeAllPopups() {
        this.activePopups.forEach((popup, toolName) => {
            this.closePopup(toolName);
        });
    }
    
    // アクティブツールボタン更新
    updateActiveToolButton(toolName) {
        // 全ボタンの活性状態リセット
        const allButtons = this.sidebar.querySelectorAll('.tool-button');
        allButtons.forEach(button => {
            button.classList.remove('active');
        });
        
        // 指定ツールを活性化
        const activeButton = this.sidebar.querySelector(`[data-tool="${toolName}"]`);
        if (activeButton) {
            activeButton.classList.add('active');
        }
    }
    
    // ツールボタンホバー設定
    setupToolButtonHover(button, toolName) {
        const tooltip = this.createTooltip(toolName);
        
        button.addEventListener('mouseenter', (e) => {
            this.showTooltip(tooltip, e.currentTarget);
        });
        
        button.addEventListener('mouseleave', () => {
            this.hideTooltip(tooltip);
        });
    }
    
    // ツールチップ作成
    createTooltip(toolName) {
        const tooltip = document.createElement('div');
        tooltip.className = 'tool-tooltip';
        tooltip.textContent = this.getToolTitle(toolName);
        document.body.appendChild(tooltip);
        return tooltip;
    }
    
    // ツールチップ表示
    showTooltip(tooltip, buttonElement) {
        const rect = buttonElement.getBoundingClientRect();
        tooltip.style.position = 'fixed';
        tooltip.style.left = `${rect.right + 10}px`;
        tooltip.style.top = `${rect.top + rect.height / 2 - tooltip.offsetHeight / 2}px`;
        tooltip.style.opacity = '1';
        tooltip.style.visibility = 'visible';
    }
    
    // ツールチップ非表示
    hideTooltip(tooltip) {
        tooltip.style.opacity = '0';
        tooltip.style.visibility = 'hidden';
    }
    
    // ツールタイトル取得
    getToolTitle(toolName) {
        const titles = {
            pen: 'ペンツール (P)',
            eraser: '消しゴムツール (E)',
            airspray: 'エアスプレーツール (A)',
            blur: 'ボカシツール',
            eyedropper: 'スポイトツール (I)',
            fill: '塗りつぶしツール (G)',
            selection: '選択ツール (S)',
            text: 'テキストツール (T)',
            shape: '図形ツール',
            transform: '変形ツール',
            settings: '設定',
            download: 'ダウンロード',
            resize: 'リサイズ',
            animation: 'アニメーション',
            layers: 'レイヤー'
        };
        
        return titles[toolName] || toolName;
    }
    
    // ポップアップコンテナ作成
    createPopupContainer() {
        this.popupContainer = document.getElementById('popupContainer');
        if (!this.popupContainer) {
            this.popupContainer = document.createElement('div');
            this.popupContainer.id = 'popupContainer';
            this.popupContainer.style.cssText = `
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                pointer-events: none;
                z-index: 1000;
            `;
            document.body.appendChild(this.popupContainer);
        }
        
        // ポップアップ用CSS追加
        this.addPopupStyles();
    }
    
    // ポップアップ用CSS追加
    addPopupStyles() {
        const style = document.createElement('style');
        style.textContent = `
            .tool-popup {
                pointer-events: auto;
                opacity: 0;
                transform: translateX(-10px);
                transition: all 0.3s ease-out;
            }
            
            .tool-popup.visible {
                opacity: 1;
                transform: translateX(0);
            }
            
            .popup-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding: 8px 12px;
                background: rgba(128, 0, 0, 0.1);
                border-bottom: 1px solid rgba(128, 0, 0, 0.2);
                user-select: none;
            }
            
            .popup-title {
                font-weight: 600;
                color: var(--text-color);
                font-size: 12px;
            }
            
            .popup-close {
                background: none;
                border: none;
                font-size: 14px;
                cursor: pointer;
                color: var(--text-color);
                opacity: 0.7;
                padding: 2px 6px;
                border-radius: 2px;
            }
            
            .popup-close:hover {
                opacity: 1;
                background: rgba(128, 0, 0, 0.1);
            }
            
            .popup-content {
                padding: 12px;
                max-width: 250px;
            }
            
            .control-checkbox {
                margin-right: 8px;
            }
            
            .control-select {
                width: 100%;
                padding: 4px 8px;
                border: 1px solid var(--sub-color);
                border-radius: 3px;
                font-size: 11px;
                background: white;
            }
            
            .tool-tooltip {
                background: rgba(0, 0, 0, 0.8);
                color: white;
                padding: 4px 8px;
                border-radius: 4px;
                font-size: 11px;
                opacity: 0;
                visibility: hidden;
                transition: all 0.2s ease;
                pointer-events: none;
                z-index: 2000;
                white-space: nowrap;
            }
        `;
        document.head.appendChild(style);
    }
    
    // 通知システム作成
    createNotificationSystem() {
        this.notificationContainer = document.createElement('div');
        this.notificationContainer.className = 'notification-container';
        this.notificationContainer.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            z-index: 2000;
            pointer-events: none;
        `;
        document.body.appendChild(this.notificationContainer);
        
        this.addNotificationStyles();
    }
    
    // 通知表示
    showNotification(message, type = 'info', duration = 3000) {
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.textContent = message;
        
        this.notificationContainer.appendChild(notification);
        this.notifications.push(notification);
        
        // 表示アニメーション
        requestAnimationFrame(() => {
            notification.classList.add('visible');
        });
        
        // 自動削除
        setTimeout(() => {
            this.removeNotification(notification);
        }, duration);
        
        // 最大通知数制限
        if (this.notifications.length > this.maxNotifications) {
            this.removeNotification(this.notifications[0]);
        }
    }
    
    // 通知削除
    removeNotification(notification) {
        notification.classList.remove('visible');
        
        setTimeout(() => {
            if (notification.parentElement) {
                notification.parentElement.removeChild(notification);
            }
            const index = this.notifications.indexOf(notification);
            if (index > -1) {
                this.notifications.splice(index, 1);
            }
        }, 300);
    }
    
    // 通知用CSS追加
    addNotificationStyles() {
        const style = document.createElement('style');
        style.textContent = `
            .notification {
                background: rgba(128, 0, 0, 0.9);
                color: white;
                padding: 12px 16px;
                border-radius: 6px;
                margin-bottom: 8px;
                font-size: 12px;
                transform: translateX(100%);
                opacity: 0;
                transition: all 0.3s ease-out;
                pointer-events: auto;
                box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
            }
            
            .notification.visible {
                transform: translateX(0);
                opacity: 1;
            }
            
            .notification-success {
                background: rgba(34, 139, 34, 0.9);
            }
            
            .notification-warning {
                background: rgba(255, 140, 0, 0.9);
            }
            
            .notification-error {
                background: rgba(220, 20, 60, 0.9);
            }
        `;
        document.head.appendChild(style);
    }
    
    // レスポンシブデザイン設定
    setupResponsiveDesign() {
        const mediaQuery = window.matchMedia('(max-width: 768px)');
        
        const handleScreenChange = (e) => {
            if (e.matches) {
                // モバイル表示（タッチデバイス非対応だが画面サイズ対応）
                this.sidebar.classList.add('mobile-layout');
            } else {
                // デスクトップ表示
                this.sidebar.classList.remove('mobile-layout');
            }
        };
        
        mediaQuery.addEventListener('change', handleScreenChange);
        handleScreenChange(mediaQuery);
    }
    
    // サイドバーインタラクション設定
    setupSidebarInteractions() {
        // サイドバー切り替え（Tab キーは ShortcutController で処理）
        this.eventStore.on(this.eventStore.eventTypes.UI_SIDEBAR_TOGGLE, () => {
            this.toggleSidebar();
        });
    }
    
    // サイドバー切り替え
    toggleSidebar() {
        this.sidebarCollapsed = !this.sidebarCollapsed;
        this.sidebar.classList.toggle('collapsed', this.sidebarCollapsed);
        
        // アクティブポップアップがある場合は閉じる
        if (this.sidebarCollapsed) {
            this.closeAllPopups();
        }
        
        console.log(`📐 Sidebar ${this.sidebarCollapsed ? 'collapsed' : 'expanded'}`);
    }
    
    // 特殊パネル開く系メソッド（Phase3-4で実装拡張）
    openSettingsPanel() {
        console.log('⚙️ Settings panel opened');
        this.showNotification('設定パネルを開きました');
    }
    
    openDownloadPanel() {
        console.log('📥 Download panel opened');
        this.showNotification('ダウンロードパネルを開きました');
    }
    
    openResizePanel() {
        console.log('⤢ Resize panel opened');
        this.showNotification('リサイズパネルを開きました');
    }
    
    toggleAnimationMode() {
        console.log('🎬 Animation mode toggled');
        this.eventStore.emit(this.eventStore.eventTypes.ANIMATION_START, {
            mode: 'toggle'
        });
    }
    
    toggleLayerPanel() {
        console.log('📚 Layer panel toggled');
        this.showNotification('レイヤーパネルを切り替えました');
    }
    
    // イベント購読設定
    setupEventSubscriptions() {
        // ツール変更時のUI更新
        this.eventStore.on(this.eventStore.eventTypes.TOOL_CHANGE, (data) => {
            this.updateActiveToolButton(data.payload.tool);
        });
        
        // フルスクリーンモード切り替え
        document.addEventListener('fullscreenchange', () => {
            this.fullscreenMode = !!document.fullscreenElement;
            document.body.classList.toggle('fullscreen-drawing', this.fullscreenMode);
        });
        
        // ESCキーでポップアップ閉じる（ShortcutControllerと連携）
        this.eventStore.on(self.eventStore.eventTypes.UI_POPUP_CLOSE, (data) => {
            if (data.payload.all) {
                this.closeAllPopups();
            }
        });
    }
    
    // デバッグ情報
    getDebugInfo() {
        return {
            sidebarCollapsed: this.sidebarCollapsed,
            fullscreenMode: this.fullscreenMode,
            activePopups: Array.from(this.activePopups.keys()),
            activeToolPopup: this.activeToolPopup,
            notificationCount: this.notifications.length
        };
    }
    
    // クリーンアップ
    destroy() {
        this.closeAllPopups();
        
        if (this.notificationContainer) {
            this.notificationContainer.remove();
        }
        
        this.notifications = [];
        
        console.log('✅ UI controller destroyed');
    }
}