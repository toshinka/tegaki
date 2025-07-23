/**
 * ToolPanel.js - ツール選択UI（Phosphor Icons統合）
 * 
 * 憲章準拠：
 * - Store購読・Actions呼び出し厳格実装
 * - Phosphor Icons統合（CDN読み込み対応）
 * - ユーザー期待値優先UI設計
 * 
 * Phase2-A制約：
 * - ペンツール中心UI
 * - 既存デザイン継承
 * - Store/Actions連動確認
 */
export class ToolPanel {
    constructor(container) {
        this.container = container;
        this.toolStore = container.resolve('toolStore');
        this.toolActions = this.toolStore.actions;
        
        // UI要素参照
        this.toolbarElement = null;
        this.toolButtons = new Map();
        this.controlPanels = new Map();
        
        // Phosphor Icons読み込み状態
        this.iconsLoaded = false;
        
        // Store購読
        this.unsubscribe = this.toolStore.subscribe(this.handleStoreChange.bind(this));
        
        // 初期化
        this.init();
    }

    /**
     * UI初期化
     */
    init() {
        this.loadPhosphorIcons();
        this.setupToolbar();
        this.setupControlPanels();
        this.setupEventListeners();
        this.updateUIFromStore();
        
        console.log('✅ ToolPanel initialized with Phosphor Icons');
    }

    /**
     * Phosphor Icons CDN読み込み
     */
    loadPhosphorIcons() {
        if (document.querySelector('script[src*="phosphor-icons"]')) {
            this.iconsLoaded = true;
            return;
        }

        const script = document.createElement('script');
        script.src = 'https://cdnjs.cloudflare.com/ajax/libs/phosphor-icons/2.0.2/phosphor.min.js';
        script.onload = () => {
            this.iconsLoaded = true;
            this.updateToolButtonIcons();
        };
        script.onerror = () => {
            console.warn('Phosphor Icons読み込み失敗、フォールバック絵文字使用');
            this.iconsLoaded = false;
        };
        document.head.appendChild(script);
    }

    /**
     * ツールバー要素設定
     */
    setupToolbar() {
        this.toolbarElement = document.querySelector('.toolbar');
        if (!this.toolbarElement) {
            console.error('ツールバー要素が見つかりません');
            return;
        }

        // 既存ボタンをクリア
        this.toolbarElement.innerHTML = '';

        // ツールボタン生成
        const tools = this.toolStore.getAvailableTools();
        tools.forEach(toolName => {
            const button = this.createToolButton(toolName);
            this.toolButtons.set(toolName, button);
            this.toolbarElement.appendChild(button);
        });
    }

    /**
     * ツールボタン作成
     */
    createToolButton(toolName) {
        const button = document.createElement('div');
        button.className = 'tool-button';
        button.dataset.tool = toolName;
        button.title = this.getToolDisplayName(toolName);
        
        // アイコン設定（Phosphor Icons読み込み前はフォールバック）
        this.setButtonIcon(button, toolName);
        
        return button;
    }

    /**
     * ボタンアイコン設定
     */
    setButtonIcon(button, toolName) {
        if (this.iconsLoaded && window.phosphor) {
            // Phosphor Icons使用
            const iconName = this.getPhosphorIconName(toolName);
            button.innerHTML = `<i class="ph ph-${iconName}"></i>`;
        } else {
            // フォールバック絵文字
            button.textContent = this.getFallbackEmoji(toolName);
        }
    }

    /**
     * Phosphor Icons アイコン名取得
     */
    getPhosphorIconName(toolName) {
        const iconMap = {
            pen: 'pen-nib',
            brush: 'paint-brush',
            eraser: 'eraser'
        };
        return iconMap[toolName] || 'question';
    }

    /**
     * フォールバック絵文字取得
     */
    getFallbackEmoji(toolName) {
        const emojiMap = {
            pen: '✏️',
            brush: '🖌️',
            eraser: '🧹'
        };
        return emojiMap[toolName] || '❓';
    }

    /**
     * ツール表示名取得
     */
    getToolDisplayName(toolName) {
        const displayNames = {
            pen: 'ベクターペンツール',
            brush: 'ブラシツール',
            eraser: '消しゴムツール'
        };
        return displayNames[toolName] || toolName;
    }

    /**
     * ツールボタンアイコン更新
     */
    updateToolButtonIcons() {
        this.toolButtons.forEach((button, toolName) => {
            this.setButtonIcon(button, toolName);
        });
    }

    /**
     * コントロールパネル設定
     */
    setupControlPanels() {
        // ペンツール用コントロールパネル
        this.setupPenControls();
        
        // 他のツール用コントロールは後のPhaseで実装
    }

    /**
     * ペンコントロール設定
     */
    setupPenControls() {
        const penControlsElement = document.getElementById('penControls');
        if (!penControlsElement) {
            console.error('ペンコントロール要素が見つかりません');
            return;
        }

        this.controlPanels.set('pen', penControlsElement);
        
        // コントロール要素参照取得
        this.penControls = {
            sizeSlider: document.getElementById('penSizeSlider'),
            sizeValue: document.getElementById('penSizeValue'),
            opacitySlider: document.getElementById('penOpacitySlider'),
            opacityValue: document.getElementById('penOpacityValue')
        };
    }

    /**
     * イベントリスナー設定
     */
    setupEventListeners() {
        // ツールボタンクリック
        this.toolButtons.forEach((button, toolName) => {
            button.addEventListener('click', () => {
                this.handleToolButtonClick(toolName);
            });
        });

        // ペンコントロールイベント
        if (this.penControls.sizeSlider) {
            this.penControls.sizeSlider.addEventListener('input', (e) => {
                this.handlePenSizeChange(parseInt(e.target.value));
            });
        }
        
        if (this.penControls.sizeValue) {
            this.penControls.sizeValue.addEventListener('change', (e) => {
                this.handlePenSizeChange(parseInt(e.target.value));
            });
        }

        if (this.penControls.opacitySlider) {
            this.penControls.opacitySlider.addEventListener('input', (e) => {
                this.handlePenOpacityChange(parseInt(e.target.value));
            });
        }
        
        if (this.penControls.opacityValue) {
            this.penControls.opacityValue.addEventListener('change', (e) => {
                this.handlePenOpacityChange(parseInt(e.target.value));
            });
        }
    }

    /**
     * ツールボタンクリック処理
     */
    handleToolButtonClick(toolName) {
        const result = this.toolActions.selectTool(toolName);
        if (!result.success) {
            console.error('ツール選択失敗:', result.error);
            // TODO: ユーザーへのエラー通知UI
        }
    }

    /**
     * ペンサイズ変更処理
     */
    handlePenSizeChange(size) {
        const result = this.toolActions.updatePenSize(size);
        if (!result.success) {
            console.error('ペンサイズ更新失敗:', result.error);
        }
    }

    /**
     * ペン透明度変更処理
     */
    handlePenOpacityChange(opacity) {
        const result = this.toolActions.updatePenOpacity(opacity);
        if (!result.success) {
            console.error('ペン透明度更新失敗:', result.error);
        }
    }

    /**
     * Store変更処理（購読コールバック）
     */
    handleStoreChange(change) {
        switch (change.type) {
            case 'TOOL_CHANGED':
                this.updateActiveToolButton(change.payload.currentTool);
                this.updateControlPanelVisibility(change.payload.currentTool);
                this.updateStatusBar(change.payload.currentTool, change.payload.settings);
                break;
                
            case 'TOOL_SETTINGS_CHANGED':
                if (change.payload.toolName === this.toolStore.getCurrentTool()) {
                    this.updateControlValues(change.payload.toolName, change.payload.newSettings);
                    this.updateStatusBar(change.payload.toolName, change.payload.newSettings);
                }
                break;
                
            case 'STORE_RESET':
                this.updateUIFromStore();
                break;
        }
    }

    /**
     * アクティブツールボタン更新
     */
    updateActiveToolButton(currentTool) {
        this.toolButtons.forEach((button, toolName) => {
            if (toolName === currentTool) {
                button.classList.add('active');
            } else {
                button.classList.remove('active');
            }
        });
    }

    /**
     * コントロールパネル表示切り替え
     */
    updateControlPanelVisibility(currentTool) {
        this.controlPanels.forEach((panel, toolName) => {
            if (toolName === currentTool) {
                panel.style.display = 'block';
            } else {
                panel.style.display = 'none';
            }
        });
    }

    /**
     * コントロール値更新
     */
    updateControlValues(toolName, settings) {
        if (toolName === 'pen' && this.penControls.sizeSlider) {
            if (settings.size !== undefined) {
                this.penControls.sizeSlider.value = settings.size;
                this.penControls.sizeValue.value = settings.size;
            }
            if (settings.opacity !== undefined) {
                this.penControls.opacitySlider.value = settings.opacity;
                this.penControls.opacityValue.value = settings.opacity;
            }
        }
    }

    /**
     * ステータスバー更新
     */
    updateStatusBar(toolName, settings) {
        const statusSize = document.getElementById('statusSize');
        const statusOpacity = document.getElementById('statusOpacity');
        
        if (statusSize && settings.size !== undefined) {
            statusSize.textContent = settings.size;
        }
        if (statusOpacity && settings.opacity !== undefined) {
            statusOpacity.textContent = Math.round(settings.opacity * 100) + '%';
        }
    }

    /**
     * Store状態からUI全体更新
     */
    updateUIFromStore() {
        const currentTool = this.toolStore.getCurrentTool();
        const settings = this.toolStore.getToolSettings(currentTool);
        
        this.updateActiveToolButton(currentTool);
        this.updateControlPanelVisibility(currentTool);
        this.updateControlValues(currentTool, settings);
        this.updateStatusBar(currentTool, settings);
    }

    /**
     * クリーンアップ
     */
    destroy() {
        if (this.unsubscribe) {
            this.unsubscribe();
        }
        this.toolButtons.clear();
        this.controlPanels.clear();
    }
}