/**
 * 🎨 UIManager - ユーザーインターフェース管理システム (Phase1修正版)
 * 📋 RESPONSIBILITY: 「UI要素・イベント・表示状態」管理専門
 * 🔄 INTEGRATION: ツールボタン・ステータス表示・設定パネル統合管理
 * 
 * 📏 DESIGN_PRINCIPLE: UI管理専門・他システムとの疎結合
 * 🚫 DRAWING_PROHIBITION: 直接描画処理は禁止 - ToolManagerに委譲
 * ✅ UI_AUTHORITY: UI表示・操作イベントの統一管理
 * 
 * 🔧 Phase1修正内容:
 * - ErrorManagerの重複宣言問題解消
 * - UIManager本来の責務に集中
 * - キャンバス境界線の透明化対応
 * - 統一システム連携強化
 * 
 * 📋 参考定義:
 * - ルールブック: 1.1 責務分離の絶対原則 - UIManager
 * - シンボル辞典: UIManager系API - UI管理API群
 * - 手順書: Phase 1: 緊急修復（基本動作復旧）
 */

// Tegaki名前空間初期化
window.Tegaki = window.Tegaki || {};

class UIManager {
    constructor() {
        this.initialized = false;
        this.version = 'v1-phase1-fix';
        
        // 統一システム参照
        this.configManager = null;
        this.errorManager = null;
        this.stateManager = null;
        this.eventBus = null;
        
        // UI要素参照
        this.toolButtons = new Map();
        this.statusElements = new Map();
        this.settingPanels = new Map();
        this.popupPanels = new Map();
        
        // UI状態管理
        this.uiState = {
            activeToolId: 'pen-tool',
            panelsVisible: new Set(),
            statusDisplayEnabled: true,
            interfaceMode: 'desktop' // desktop, mobile, tablet
        };
        
        // イベントハンドラー管理
        this.eventHandlers = new Map();
        
        console.log('🎨 UIManager インスタンス作成完了（Phase1修正版）');
    }

    /**
     * UIManager初期化
     */
    initialize() {
        try {
            console.log('🎨 UIManager初期化開始...');
            
            if (this.initialized) {
                console.warn('⚠️ UIManager already initialized');
                return true;
            }

            // 統一システム参照取得
            this._initializeSystemReferences();
            
            // UI要素検索・登録
            this._initializeUIElements();
            
            // ツールボタン設定
            this._setupToolButtons();
            
            // ステータス表示設定
            this._setupStatusDisplay();
            
            // 設定パネル設定
            this._setupSettingPanels();
            
            // ポップアップ設定
            this._setupPopupPanels();
            
            // キーボードショートカット設定
            this._setupKeyboardShortcuts();
            
            // レスポンシブ対応
            this._setupResponsiveHandling();
            
            // Phase1修正: キャンバス境界線透明化
            this._fixCanvasBorderTransparency();
            
            this.initialized = true;
            
            // EventBus通知
            if (this.eventBus?.safeEmit) {
                this.eventBus.safeEmit('ui.initialized', {
                    toolButtons: this.toolButtons.size,
                    statusElements: this.statusElements.size,
                    panels: this.settingPanels.size
                });
            }
            
            console.log('✅ UIManager初期化完了');
            return true;
            
        } catch (error) {
            console.error('❌ UIManager初期化失敗:', error);
            
            if (this.errorManager?.showError) {
                this.errorManager.showError('error', `UIManager初期化エラー: ${error.message}`, {
                    context: 'UIManager.initialize',
                    nonCritical: true
                });
            }
            
            return false;
        }
    }

    /**
     * 統一システム参照初期化
     */
    _initializeSystemReferences() {
        try {
            // ConfigManager
            this.configManager = window.Tegaki?.ConfigManagerInstance || 
                                 window.ConfigManager;
            
            // ErrorManager
            this.errorManager = window.Tegaki?.ErrorManagerInstance || 
                               window.ErrorManager;
            
            // StateManager
            this.stateManager = window.Tegaki?.StateManagerInstance || 
                               window.StateManager;
            
            // EventBus
            this.eventBus = window.Tegaki?.EventBusInstance || 
                           window.EventBus;
            
            console.log('✅ UIManager - 統一システム参照取得完了:', {
                configManager: !!this.configManager,
                errorManager: !!this.errorManager,
                stateManager: !!this.stateManager,
                eventBus: !!this.eventBus
            });
            
        } catch (error) {
            console.warn('⚠️ 統一システム参照取得で問題発生:', error);
        }
    }

    /**
     * UI要素検索・登録
     */
    _initializeUIElements() {
        try {
            // ツールボタン検索
            const toolButtons = document.querySelectorAll('.tool-button');
            toolButtons.forEach(button => {
                const toolId = button.id || button.dataset.tool;
                if (toolId) {
                    this.toolButtons.set(toolId, button);
                }
            });
            
            // ステータス要素検索
            const statusElements = document.querySelectorAll('.status-item');
            statusElements.forEach(element => {
                const statusId = element.id || element.dataset.status;
                if (statusId) {
                    this.statusElements.set(statusId, element);
                }
            });
            
            // 設定パネル検索
            const settingPanels = document.querySelectorAll('.setting-panel, .popup-panel');
            settingPanels.forEach(panel => {
                const panelId = panel.id;
                if (panelId) {
                    this.settingPanels.set(panelId, panel);
                }
            });
            
            console.log('✅ UI要素登録完了:', {
                toolButtons: this.toolButtons.size,
                statusElements: this.statusElements.size,
                settingPanels: this.settingPanels.size
            });
            
        } catch (error) {
            console.error('❌ UI要素登録エラー:', error);
        }
    }

    /**
     * ツールボタン設定
     */
    _setupToolButtons() {
        try {
            this.toolButtons.forEach((button, toolId) => {
                // クリックイベント
                const clickHandler = (event) => {
                    event.preventDefault();
                    this._handleToolButtonClick(toolId, button);
                };
                
                button.addEventListener('click', clickHandler);
                this.eventHandlers.set(`${toolId}_click`, clickHandler);
                
                // ダブルクリックイベント（設定パネル表示）
                const dblclickHandler = (event) => {
                    event.preventDefault();
                    this._handleToolButtonDoubleClick(toolId, button);
                };
                
                button.addEventListener('dblclick', dblclickHandler);
                this.eventHandlers.set(`${toolId}_dblclick`, dblclickHandler);
                
                // ホバーイベント（ツールチップ）
                const mouseenterHandler = () => {
                    this._showToolTooltip(toolId, button);
                };
                
                const mouseleaveHandler = () => {
                    this._hideToolTooltip();
                };
                
                button.addEventListener('mouseenter', mouseenterHandler);
                button.addEventListener('mouseleave', mouseleaveHandler);
                this.eventHandlers.set(`${toolId}_mouseenter`, mouseenterHandler);
                this.eventHandlers.set(`${toolId}_mouseleave`, mouseleaveHandler);
            });
            
            // デフォルトツール設定
            this._setActiveToolButton(this.uiState.activeToolId);
            
            console.log('✅ ツールボタン設定完了');
            
        } catch (error) {
            console.error('❌ ツールボタン設定エラー:', error);
        }
    }

    /**
     * ツールボタンクリックハンドラー
     */
    _handleToolButtonClick(toolId, buttonElement) {
        try {
            // アクティブツール設定
            this._setActiveToolButton(toolId);
            
            // ToolManagerに通知
            const toolManager = window.Tegaki?.ToolManagerInstance || 
                               window.ToolManager;
            
            if (toolManager?.setTool) {
                const toolName = this._getToolNameFromId(toolId);
                toolManager.setTool(toolName);
            }
            
            // EventBus通知
            if (this.eventBus?.safeEmit) {
                this.eventBus.safeEmit('ui.tool.selected', {
                    toolId,
                    toolName: this._getToolNameFromId(toolId),
                    timestamp: Date.now()
                });
            }
            
            console.log(`🔧 ツール選択: ${toolId}`);
            
        } catch (error) {
            console.error('❌ ツールボタンクリックエラー:', error);
            
            if (this.errorManager?.showError) {
                this.errorManager.showError('warning', `ツール選択エラー: ${error.message}`, {
                    context: 'UIManager.toolButtonClick',
                    toolId,
                    nonCritical: true
                });
            }
        }
    }

    /**
     * ツールボタンダブルクリックハンドラー（設定パネル表示）
     */
    _handleToolButtonDoubleClick(toolId, buttonElement) {
        try {
            const settingPanelId = this._getSettingPanelIdFromToolId(toolId);
            
            if (settingPanelId && this.settingPanels.has(settingPanelId)) {
                this.togglePanel(settingPanelId);
            }
            
            console.log(`⚙️ ツール設定表示: ${toolId}`);
            
        } catch (error) {
            console.error('❌ ツール設定表示エラー:', error);
        }
    }

    /**
     * アクティブツールボタン設定
     */
    _setActiveToolButton(toolId) {
        try {
            // 全ボタンのアクティブ状態解除
            this.toolButtons.forEach((button) => {
                button.classList.remove('active');
            });
            
            // 指定ボタンをアクティブに
            const activeButton = this.toolButtons.get(toolId);
            if (activeButton) {
                activeButton.classList.add('active');
                this.uiState.activeToolId = toolId;
                
                // ステータス表示更新
                this._updateToolStatus(toolId);
            }
            
        } catch (error) {
            console.error('❌ アクティブツールボタン設定エラー:', error);
        }
    }

    /**
     * ステータス表示設定
     */
    _setupStatusDisplay() {
        try {
            // FPS表示更新
            this._startFPSMonitoring();
            
            // メモリ使用量表示更新
            this._startMemoryMonitoring();
            
            // 座標表示設定
            this._setupCoordinateDisplay();
            
            // キャンバス情報表示
            this._updateCanvasInfo();
            
            console.log('✅ ステータス表示設定完了');
            
        } catch (error) {
            console.error('❌ ステータス表示設定エラー:', error);
        }
    }

    /**
     * FPS監視開始
     */
    _startFPSMonitoring() {
        let lastTime = performance.now();
        let frameCount = 0;
        
        const updateFPS = () => {
            frameCount++;
            const currentTime = performance.now();
            
            if (currentTime - lastTime >= 1000) {
                const fps = Math.round((frameCount * 1000) / (currentTime - lastTime));
                this._updateStatusElement('fps', `${fps}`);
                
                frameCount = 0;
                lastTime = currentTime;
            }
            
            if (this.uiState.statusDisplayEnabled) {
                requestAnimationFrame(updateFPS);
            }
        };
        
        requestAnimationFrame(updateFPS);
    }

    /**
     * メモリ監視開始
     */
    _startMemoryMonitoring() {
        const updateMemory = () => {
            try {
                if (performance.memory) {
                    const memory = (performance.memory.usedJSHeapSize / 1048576).toFixed(1);
                    this._updateStatusElement('memory-usage', `${memory}MB`);
                }
            } catch (error) {
                // メモリ監視エラーは無視
            }
        };
        
        updateMemory();
        setInterval(updateMemory, 2000);
    }

    /**
     * 座標表示設定
     */
    _setupCoordinateDisplay() {
        try {
            // キャンバス要素での座標表示
            const canvas = document.querySelector('canvas');
            if (canvas) {
                const mousemoveHandler = (event) => {
                    const rect = canvas.getBoundingClientRect();
                    const x = Math.round(event.clientX - rect.left);
                    const y = Math.round(event.clientY - rect.top);
                    this._updateStatusElement('coordinates', `x: ${x}, y: ${y}`);
                };
                
                canvas.addEventListener('mousemove', mousemoveHandler);
                this.eventHandlers.set('canvas_mousemove', mousemoveHandler);
            }
            
        } catch (error) {
            console.error('❌ 座標表示設定エラー:', error);
        }
    }

    /**
     * 設定パネル設定
     */
    _setupSettingPanels() {
        try {
            this.settingPanels.forEach((panel, panelId) => {
                // ドラッグ可能設定
                if (panel.classList.contains('draggable')) {
                    this._makePanelDraggable(panel, panelId);
                }
                
                // 閉じるボタン設定
                const closeButton = panel.querySelector('.close-button, .popup-close');
                if (closeButton) {
                    const closeHandler = () => this.hidePanel(panelId);
                    closeButton.addEventListener('click', closeHandler);
                    this.eventHandlers.set(`${panelId}_close`, closeHandler);
                }
                
                // 初期状態を非表示に
                panel.style.display = 'none';
            });
            
            console.log('✅ 設定パネル設定完了');
            
        } catch (error) {
            console.error('❌ 設定パネル設定エラー:', error);
        }
    }

    /**
     * パネルをドラッグ可能にする
     */
    _makePanelDraggable(panel, panelId) {
        try {
            const titleElement = panel.querySelector('.popup-title, .panel-title');
            if (!titleElement) return;
            
            let isDragging = false;
            let startX, startY, startLeft, startTop;
            
            const pointerdownHandler = (e) => {
                isDragging = true;
                startX = e.clientX;
                startY = e.clientY;
                
                const rect = panel.getBoundingClientRect();
                startLeft = rect.left;
                startTop = rect.top;
                
                titleElement.setPointerCapture(e.pointerId);
                panel.style.zIndex = '1000';
                e.preventDefault();
            };
            
            const pointermoveHandler = (e) => {
                if (!isDragging) return;
                
                const deltaX = e.clientX - startX;
                const deltaY = e.clientY - startY;
                
                panel.style.left = `${startLeft + deltaX}px`;
                panel.style.top = `${startTop + deltaY}px`;
                panel.style.position = 'fixed';
                
                e.preventDefault();
            };
            
            const pointerupHandler = (e) => {
                isDragging = false;
                titleElement.releasePointerCapture(e.pointerId);
                panel.style.zIndex = '';
                e.preventDefault();
            };
            
            titleElement.addEventListener('pointerdown', pointerdownHandler);
            document.addEventListener('pointermove', pointermoveHandler);
            titleElement.addEventListener('pointerup', pointerupHandler);
            
            this.eventHandlers.set(`${panelId}_drag_down`, pointerdownHandler);
            this.eventHandlers.set(`${panelId}_drag_move`, pointermoveHandler);
            this.eventHandlers.set(`${panelId}_drag_up`, pointerupHandler);
            
        } catch (error) {
            console.error('❌ パネルドラッグ設定エラー:', error);
        }
    }

    /**
     * ポップアップパネル設定
     */
    _setupPopupPanels() {
        try {
            // PopupManager連携設定
            this.popupPanels = this.settingPanels;
            
            console.log('✅ ポップアップパネル設定完了');
            
        } catch (error) {
            console.error('❌ ポップアップパネル設定エラー:', error);
        }
    }

    /**
     * キーボードショートカット設定
     */
    _setupKeyboardShortcuts() {
        try {
            const keydownHandler = (event) => {
                // Escキー: 全パネル閉じる
                if (event.key === 'Escape') {
                    this.hideAllPanels();
                    event.preventDefault();
                }
                
                // ツールショートカット
                if (event.key >= '1' && event.key <= '9') {
                    const toolIndex = parseInt(event.key) - 1;
                    const toolButtons = Array.from(this.toolButtons.keys());
                    if (toolButtons[toolIndex]) {
                        this._setActiveToolButton(toolButtons[toolIndex]);
                        event.preventDefault();
                    }
                }
            };
            
            document.addEventListener('keydown', keydownHandler);
            this.eventHandlers.set('global_keydown', keydownHandler);
            
            console.log('✅ キーボードショートカット設定完了');
            
        } catch (error) {
            console.error('❌ キーボードショートカット設定エラー:', error);
        }
    }

    /**
     * レスポンシブ対応設定
     */
    _setupResponsiveHandling() {
        try {
            const resizeHandler = () => {
                const width = window.innerWidth;
                
                if (width <= 768) {
                    this.uiState.interfaceMode = 'mobile';
                } else if (width <= 1024) {
                    this.uiState.interfaceMode = 'tablet';
                } else {
                    this.uiState.interfaceMode = 'desktop';
                }
                
                // UI適応
                this._adaptUIForMode();
            };
            
            window.addEventListener('resize', resizeHandler);
            this.eventHandlers.set('window_resize', resizeHandler);
            
            // 初期設定
            resizeHandler();
            
            console.log('✅ レスポンシブ対応設定完了');
            
        } catch (error) {
            console.error('❌ レスポンシブ対応設定エラー:', error);
        }
    }

    /**
     * Phase1修正: キャンバス境界線透明化
     */
    _fixCanvasBorderTransparency() {
        try {
            // キャンバス要素の境界線を透明化
            const canvas = document.querySelector('canvas');
            if (canvas) {
                canvas.style.border = 'none';
                canvas.style.outline = 'none';
            }
            
            // キャンバスコンテナの境界線も透明化
            const canvasContainer = document.getElementById('canvas-container');
            if (canvasContainer) {
                canvasContainer.style.border = 'none';
                canvasContainer.style.outline = 'none';
            }
            
            // 描画エリア全体の境界線も確認
            const canvasArea = document.querySelector('.canvas-area');
            if (canvasArea) {
                const computedStyle = window.getComputedStyle(canvasArea);
                if (computedStyle.border && computedStyle.border !== 'none') {
                    canvasArea.style.border = 'none';
                }
            }
            
            console.log('✅ キャンバス境界線透明化完了');
            
        } catch (error) {
            console.warn('⚠️ キャンバス境界線透明化で問題発生:', error);
        }
    }

    // ========================================
    // パブリックAPI
    // ========================================

    /**
     * パネル表示
     */
    showPanel(panelId) {
        try {
            const panel = this.settingPanels.get(panelId);
            if (panel) {
                panel.style.display = 'block';
                this.uiState.panelsVisible.add(panelId);
                
                if (this.eventBus?.safeEmit) {
                    this.eventBus.safeEmit('ui.panel.shown', { panelId });
                }
            }
        } catch (error) {
            console.error('❌ パネル表示エラー:', error);
        }
    }

    /**
     * パネル非表示
     */
    hidePanel(panelId) {
        try {
            const panel = this.settingPanels.get(panelId);
            if (panel) {
                panel.style.display = 'none';
                this.uiState.panelsVisible.delete(panelId);
                
                if (this.eventBus?.safeEmit) {
                    this.eventBus.safeEmit('ui.panel.hidden', { panelId });
                }
            }
        } catch (error) {
            console.error('❌ パネル非表示エラー:', error);
        }
    }

    /**
     * パネル表示切り替え
     */
    togglePanel(panelId) {
        try {
            if (this.uiState.panelsVisible.has(panelId)) {
                this.hidePanel(panelId);
            } else {
                this.showPanel(panelId);
            }
        } catch (error) {
            console.error('❌ パネル切り替えエラー:', error);
        }
    }

    /**
     * 全パネル非表示
     */
    hideAllPanels() {
        try {
            this.uiState.panelsVisible.forEach(panelId => {
                this.hidePanel(panelId);
            });
        } catch (error) {
            console.error('❌ 全パネル非表示エラー:', error);
        }
    }

    /**
     * ステータス要素更新
     */
    updateStatus(statusId, value) {
        this._updateStatusElement(statusId, value);
    }

    // ========================================
    // 内部メソッド
    // ========================================

    /**
     * ステータス要素更新（内部）
     */
    _updateStatusElement(statusId, value) {
        try {
            const element = this.statusElements.get(statusId) || 
                           document.getElementById(statusId);
            
            if (element) {
                element.textContent = value;
            }
        } catch (error) {
            // ステータス更新エラーは無視（非致命的）
        }
    }

    /**
     * ツール名取得
     */
    _getToolNameFromId(toolId) {
        const toolMap = {
            'pen-tool': 'pen',
            'eraser-tool': 'eraser',
            'brush-tool': 'brush',
            'spray-tool': 'spray'
        };
        return toolMap[toolId] || toolId.replace('-tool', '');
    }

    /**
     * 設定パネルID取得
     */
    _getSettingPanelIdFromToolId(toolId) {
        const panelMap = {
            'pen-tool': 'pen-settings',
            'resize-tool': 'resize-settings',
            'brush-tool': 'brush-settings'
        };
        return panelMap[toolId];
    }

    /**
     * ツール状態更新
     */
    _updateToolStatus(toolId) {
        try {
            const toolName = this._getToolNameFromId(toolId);
            this._updateStatusElement('current-tool', toolName);
            
            // StateManager更新
            if (this.stateManager) {
                this.stateManager.updateComponentState('ui', 'activeTool', toolName);
            }
        } catch (error) {
            console.error('❌ ツール状態更新エラー:', error);
        }
    }

    /**
     * キャンバス情報更新
     */
    _updateCanvasInfo() {
        try {
            const canvas = document.querySelector('canvas');
            if (canvas) {
                const width = canvas.width || 400;
                const height = canvas.height || 400;
                this._updateStatusElement('canvas-info', `${width}×${height}px`);
            }
        } catch (error) {
            console.error('❌ キャンバス情報更新エラー:', error);
        }
    }

    /**
     * ツールチップ表示
     */
    _showToolTooltip(toolId, buttonElement) {
        try {
            const toolName = this._getToolNameFromId(toolId);
            // TODO: ツールチップ実装
        } catch (error) {
            // ツールチップエラーは無視
        }
    }

    /**
     * ツールチップ非表示
     */
    _hideToolTooltip() {
        // TODO: ツールチップ実装
    }

    /**
     * インターフェースモード適応
     */
    _adaptUIForMode() {
        try {
            document.body.dataset.interfaceMode = this.uiState.interfaceMode;
            
            if (this.eventBus?.safeEmit) {
                this.eventBus.safeEmit('ui.mode.changed', {
                    mode: this.uiState.interfaceMode
                });
            }
        } catch (error) {
            console.error('❌ インターフェースモード適応エラー:', error);
        }
    }

    // ========================================
    // 状態取得・診断
    // ========================================

    /**
     * UI状態取得
     */
    getUIState() {
        return {
            ...this.uiState,
            initialized: this.initialized,
            toolButtonCount: this.toolButtons.size,
            statusElementCount: this.statusElements.size,
            panelCount: this.settingPanels.size
        };
    }

    /**
     * 診断情報取得
     */
    getDiagnosticInfo() {
        return {
            version: this.version,
            initialized: this.initialized,
            uiState: this.getUIState(),
            systemReferences: {
                configManager: !!this.configManager,
                errorManager: !!this.errorManager,
                stateManager: !!this.stateManager,
                eventBus: !!this.eventBus
            },
            eventHandlers: this.eventHandlers.size
        };
    }

    /**
     * 破棄処理
     */
    destroy() {
        try {
            // イベントハンドラー削除
            this.eventHandlers.forEach((handler, key) => {
                const [elementId, eventType] = key.split('_');
                const element = this.toolButtons.get(elementId) || 
                               document.getElementById(elementId) || 
                               (eventType === 'keydown' ? document : null);
                if (element) {
                    element.removeEventListener(eventType, handler);
                }
            });
            
            // 参照クリア
            this.toolButtons.clear();
            this.statusElements.clear();
            this.settingPanels.clear();
            this.popupPanels.clear();
            this.eventHandlers.clear();
            
            this.configManager = null;
            this.errorManager = null;
            this.stateManager = null;
            this.eventBus = null;
            
            this.initialized = false;
            
            console.log('🎨 UIManager破棄完了');
            
        } catch (error) {
            console.error('❌ UIManager破棄エラー:', error);
        }
    }
}

// Tegaki名前空間に登録
window.Tegaki.UIManager = UIManager;

// 初期化レジストリ方式
window.Tegaki._registry = window.Tegaki._registry || [];
window.Tegaki._registry.push(() => {
    window.Tegaki.UIManagerInstance = new UIManager();
    console.log('🎨 UIManager registered to Tegaki namespace');
});

// グローバル登録（下位互換）
if (typeof window !== 'undefined') {
    window.UIManager = UIManager;
}

console.log('🎨 UIManager (Phase1修正版) Loaded');
console.log('✨ 修正完了: ErrorManager重複宣言解消・UIManager本来責務集中・境界線透明化');
console.log('🔧 使用例: const uiManager = new UIManager(); uiManager.initialize();');