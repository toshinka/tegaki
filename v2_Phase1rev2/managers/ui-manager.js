/**
 * 🎨 Tegaki Project - UI Manager v12
 * 🎯 責務: UI制御・ツールバー管理・レイアウト制御
 * 📐 依存: EventBus, SettingsManager
 * 🔧 Phase: STEP3 - 機能拡張
 */

class UIManager {
    constructor() {
        this.version = 'v12-step3';
        this.validateDependencies();
        
        // UI要素管理
        this.toolbar = null;
        this.statusBar = null;
        this.toolButtons = new Map();
        
        // UI状態
        this.currentTool = 'pen';
        this.isUIVisible = true;
        this.compactMode = false;
        
        // 設定管理
        this.settingsManager = null;
        
        console.log('🎨 UIManager v12 構築完了');
    }
    
    /**
     * 依存関係確認
     */
    validateDependencies() {
        const required = ['EventBus'];
        const missing = required.filter(dep => !window[dep]);
        
        if (missing.length > 0) {
            throw new Error(`UIManager依存関係エラー: ${missing.join(', ')}`);
        }
        
        console.log('✅ UIManager依存関係確認完了');
    }
    
    /**
     * 初期化
     */
    initialize() {
        console.log('🎨 UIManager初期化開始...');
        
        try {
            // SettingsManager参照取得
            if (window.SettingsManager) {
                this.settingsManager = window.SettingsManager;
            }
            
            // UI要素作成
            this.createToolbar();
            this.createStatusBar();
            
            // イベント設定
            this.setupEventHandlers();
            
            // 初期状態適用
            this.applyInitialState();
            
            console.log('✅ UIManager初期化完了');
            return this;
            
        } catch (error) {
            console.error('❌ UIManager初期化エラー:', error);
            if (window.ErrorManager) {
                window.ErrorManager.showError('init-error', `UIManager初期化失敗: ${error.message}`);
            }
            throw error;
        }
    }
    
    /**
     * ツールバー作成
     */
    createToolbar() {
        // 既存のツールバーを確認
        this.toolbar = document.querySelector('.toolbar');
        
        if (!this.toolbar) {
            this.toolbar = document.createElement('div');
            this.toolbar.className = 'toolbar';
            document.body.appendChild(this.toolbar);
        }
        
        // ツールバーの基本構造作成
        this.toolbar.innerHTML = `
            <div class="toolbar-section tools">
                <div class="tool-group">
                    <button class="tool-button active" data-tool="pen" title="ペンツール (P)">
                        🖊️ <span class="tool-name">ペン</span>
                    </button>
                    <button class="tool-button" data-tool="eraser" title="消しゴム (E)">
                        🧽 <span class="tool-name">消しゴム</span>
                    </button>
                </div>
            </div>
            
            <div class="toolbar-section actions">
                <div class="action-group">
                    <button class="action-button" id="undo-button" title="元に戻す (Ctrl+Z)" disabled>
                        ↩️ <span class="action-name">元に戻す</span>
                    </button>
                    <button class="action-button" id="redo-button" title="やり直し (Ctrl+Y)" disabled>
                        ↪️ <span class="action-name">やり直し</span>
                    </button>
                    <button class="action-button" id="clear-button" title="クリア">
                        🗑️ <span class="action-name">クリア</span>
                    </button>
                </div>
            </div>
            
            <div class="toolbar-section controls">
                <div class="control-group">
                    <button class="control-button" id="fullscreen-button" title="フルスクリーン">
                        🔳 <span class="control-name">フルスクリーン</span>
                    </button>
                    <button class="control-button" id="compact-button" title="コンパクト表示">
                        📱 <span class="control-name">コンパクト</span>
                    </button>
                </div>
            </div>
        `;
        
        // ツールボタン参照を保存
        this.updateToolButtonReferences();
        
        // ツールバーイベント設定
        this.setupToolbarEvents();
        
        console.log('🔧 ツールバー作成完了');
    }
    
    /**
     * ステータスバー作成
     */
    createStatusBar() {
        // 既存のステータスバーを確認
        this.statusBar = document.querySelector('.status-bar');
        
        if (!this.statusBar) {
            this.statusBar = document.createElement('div');
            this.statusBar.className = 'status-bar';
            document.body.appendChild(this.statusBar);
        }
        
        this.statusBar.innerHTML = `
            <div class="status-section left">
                <span class="status-item" id="tool-status">
                    ツール: <span id="current-tool">ペン</span>
                </span>
                <span class="status-item" id="coordinate-status">
                    座標: <span id="current-coordinates">--, --</span>
                </span>
            </div>
            
            <div class="status-section center">
                <span class="status-item" id="canvas-status">
                    キャンバス: <span id="canvas-size">800×600</span>
                </span>
            </div>
            
            <div class="status-section right">
                <span class="status-item" id="memory-status">
                    履歴: <span id="history-count">1/50</span>
                </span>
                <span class="status-item" id="version-status">
                    v12
                </span>
            </div>
        `;
        
        console.log('📊 ステータスバー作成完了');
    }
    
    /**
     * ツールボタン参照更新
     */
    updateToolButtonReferences() {
        this.toolButtons.clear();
        
        const toolButtons = this.toolbar.querySelectorAll('.tool-button');
        toolButtons.forEach(button => {
            const tool = button.dataset.tool;
            if (tool) {
                this.toolButtons.set(tool, button);
            }
        });
        
        console.log('🔧 ツールボタン参照更新:', this.toolButtons.size + '個');
    }
    
    /**
     * ツールバーイベント設定
     */
    setupToolbarEvents() {
        // ツールボタンイベント
        this.toolButtons.forEach((button, tool) => {
            button.addEventListener('click', () => {
                this.selectTool(tool);
            });
        });
        
        // アクションボタンイベント
        const undoButton = this.toolbar.querySelector('#undo-button');
        if (undoButton) {
            undoButton.addEventListener('click', () => {
                this.executeUndo();
            });
        }
        
        const redoButton = this.toolbar.querySelector('#redo-button');
        if (redoButton) {
            redoButton.addEventListener('click', () => {
                this.executeRedo();
            });
        }
        
        const clearButton = this.toolbar.querySelector('#clear-button');
        if (clearButton) {
            clearButton.addEventListener('click', () => {
                this.executeClear();
            });
        }
        
        // コントロールボタンイベント
        const fullscreenButton = this.toolbar.querySelector('#fullscreen-button');
        if (fullscreenButton) {
            fullscreenButton.addEventListener('click', () => {
                this.toggleFullscreen();
            });
        }
        
        const compactButton = this.toolbar.querySelector('#compact-button');
        if (compactButton) {
            compactButton.addEventListener('click', () => {
                this.toggleCompactMode();
            });
        }
        
        console.log('📡 ツールバーイベント設定完了');
    }
    
    /**
     * イベントハンドラー設定
     */
    setupEventHandlers() {
        if (!window.EventBus) return;
        
        // ツール変更通知
        window.EventBus.on('tool:change', (data) => {
            this.updateToolUI(data.tool);
        });
        
        // メモリ状態変更通知
        window.EventBus.on('memory:snapshot-saved', (data) => {
            this.updateMemoryStatus(data);
        });
        
        window.EventBus.on('memory:undo', (data) => {
            this.updateMemoryStatus(data);
        });
        
        window.EventBus.on('memory:redo', (data) => {
            this.updateMemoryStatus(data);
        });
        
        // 座標更新通知
        window.EventBus.on('canvas:pointer-move', (data) => {
            this.updateCoordinateStatus(data.coordinates);
        });
        
        // キーボードショートカット
        this.setupKeyboardShortcuts();
        
        console.log('📡 UIManager イベントハンドラー設定完了');
    }
    
    /**
     * キーボードショートカット設定
     */
    setupKeyboardShortcuts() {
        document.addEventListener('keydown', (e) => {
            // テキスト入力中は無視
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
                return;
            }
            
            // ツールショートカット
            if (!e.ctrlKey && !e.metaKey && !e.altKey) {
                switch (e.key.toLowerCase()) {
                    case 'p':
                        e.preventDefault();
                        this.selectTool('pen');
                        break;
                    case 'e':
                        e.preventDefault();
                        this.selectTool('eraser');
                        break;
                    case 'f':
                        e.preventDefault();
                        this.toggleFullscreen();
                        break;
                    case 'tab':
                        e.preventDefault();
                        this.toggleUIVisibility();
                        break;
                }
            }
        });
        
        console.log('⌨️ UIManager キーボードショートカット設定完了');
    }
    
    /**
     * 初期状態適用
     */
    applyInitialState() {
        // 初期ツール選択
        this.selectTool(this.currentTool);
        
        // 初期ステータス表示
        this.updateMemoryStatus({
            canUndo: false,
            canRedo: false
        });
        
        console.log('🎯 UI初期状態適用完了');
    }
    
    /**
     * ツール選択
     */
    selectTool(toolName) {
        if (this.currentTool === toolName) {
            return; // 同じツールなら何もしない
        }
        
        const oldTool = this.currentTool;
        this.currentTool = toolName;
        
        // UI更新
        this.updateToolUI(toolName);
        
        // EventBus通知
        if (window.EventBus) {
            window.EventBus.emit('ui:tool-selected', {
                tool: toolName,
                oldTool: oldTool,
                timestamp: Date.now()
            });
        }
        
        console.log('🔧 ツール選択:', toolName);
    }
    
    /**
     * ツールUI更新
     */
    updateToolUI(toolName) {
        // ツールボタンのアクティブ状態更新
        this.toolButtons.forEach((button, tool) => {
            button.classList.toggle('active', tool === toolName);
        });
        
        // ステータスバー更新
        const currentToolSpan = this.statusBar?.querySelector('#current-tool');
        if (currentToolSpan) {
            const toolNames = {
                'pen': 'ペン',
                'eraser': '消しゴム'
            };
            currentToolSpan.textContent = toolNames[toolName] || toolName;
        }
        
        this.currentTool = toolName;
    }
    
    /**
     * アンドゥ実行
     */
    executeUndo() {
        if (window.EventBus) {
            window.EventBus.emit('ui:undo-requested');
        }
        console.log('↩️ アンドゥ実行要求');
    }
    
    /**
     * リドゥ実行
     */
    executeRedo() {
        if (window.EventBus) {
            window.EventBus.emit('ui:redo-requested');
        }
        console.log('↪️ リドゥ実行要求');
    }
    
    /**
     * クリア実行
     */
    executeClear() {
        if (confirm('キャンバスをクリアしますか？')) {
            if (window.EventBus) {
                window.EventBus.emit('ui:clear-requested');
            }
            console.log('🗑️ クリア実行要求');
        }
    }
    
    /**
     * メモリ状態更新
     */
    updateMemoryStatus(data) {
        const undoButton = this.toolbar?.querySelector('#undo-button');
        const redoButton = this.toolbar?.querySelector('#redo-button');
        
        if (undoButton) {
            undoButton.disabled = !data.canUndo;
            undoButton.classList.toggle('disabled', !data.canUndo);
        }
        
        if (redoButton) {
            redoButton.disabled = !data.canRedo;
            redoButton.classList.toggle('disabled', !data.canRedo);
        }
        
        // ステータスバー履歴表示更新（仮の値）
        const historySpan = this.statusBar?.querySelector('#history-count');
        if (historySpan) {
            historySpan.textContent = '1/50'; // 実際の値は MemoryManager から取得
        }
    }
    
    /**
     * 座標ステータス更新
     */
    updateCoordinateStatus(coordinates) {
        const coordinateSpan = this.statusBar?.querySelector('#current-coordinates');
        if (coordinateSpan && coordinates && coordinates.canvas) {
            const x = Math.round(coordinates.canvas.x);
            const y = Math.round(coordinates.canvas.y);
            coordinateSpan.textContent = `${x}, ${y}`;
        }
    }
    
    /**
     * フルスクリーン切替
     */
    toggleFullscreen() {
        try {
            if (!document.fullscreenElement) {
                document.documentElement.requestFullscreen?.() ||
                document.documentElement.webkitRequestFullscreen?.() ||
                document.documentElement.msRequestFullscreen?.();
                
                console.log('🔳 フルスクリーン ON');
            } else {
                document.exitFullscreen?.() ||
                document.webkitExitFullscreen?.() ||
                document.msExitFullscreen?.();
                
                console.log('🔳 フルスクリーン OFF');
            }
        } catch (error) {
            console.warn('⚠️ フルスクリーン切替エラー:', error);
        }
    }
    
    /**
     * コンパクトモード切替
     */
    toggleCompactMode() {
        this.compactMode = !this.compactMode;
        
        // ツールバーのコンパクト表示切替
        if (this.toolbar) {
            this.toolbar.classList.toggle('compact', this.compactMode);
        }
        
        // ステータスバーのコンパクト表示切替
        if (this.statusBar) {
            this.statusBar.classList.toggle('compact', this.compactMode);
        }
        
        console.log('📱 コンパクトモード:', this.compactMode ? 'ON' : 'OFF');
    }
    
    /**
     * UI表示切替
     */
    toggleUIVisibility() {
        this.isUIVisible = !this.isUIVisible;
        
        // ツールバー表示切替
        if (this.toolbar) {
            this.toolbar.style.display = this.isUIVisible ? 'flex' : 'none';
        }
        
        // ステータスバー表示切替
        if (this.statusBar) {
            this.statusBar.style.display = this.isUIVisible ? 'flex' : 'none';
        }
        
        console.log('👁️ UI表示:', this.isUIVisible ? 'ON' : 'OFF');
    }
    
    /**
     * キャンバスサイズ更新
     */
    updateCanvasSize(width, height) {
        const canvasSizeSpan = this.statusBar?.querySelector('#canvas-size');
        if (canvasSizeSpan) {
            canvasSizeSpan.textContent = `${width}×${height}`;
        }
        
        console.log('📐 キャンバスサイズ表示更新:', `${width}×${height}`);
    }
    
    /**
     * 通知表示
     */
    showNotification(message, type = 'info', duration = 3000) {
        // 既存の通知を削除
        const existing = document.querySelector('.ui-notification');
        if (existing) {
            existing.remove();
        }
        
        // 通知要素作成
        const notification = document.createElement('div');
        notification.className = `ui-notification ${type}`;
        notification.textContent = message;
        
        // スタイル設定
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 10px 20px;
            background: var(--notification-bg, #333);
            color: var(--notification-color, #fff);
            border-radius: 4px;
            z-index: 2000;
            opacity: 0;
            transform: translateX(20px);
            transition: all 0.3s ease;
        `;
        
        document.body.appendChild(notification);
        
        // アニメーション表示
        requestAnimationFrame(() => {
            notification.style.opacity = '1';
            notification.style.transform = 'translateX(0)';
        });
        
        // 自動消去
        setTimeout(() => {
            notification.style.opacity = '0';
            notification.style.transform = 'translateX(20px)';
            setTimeout(() => {
                notification.remove();
            }, 300);
        }, duration);
        
        console.log('📢 通知表示:', message);
    }
    
    /**
     * 状態取得
     */
    getStatus() {
        return {
            version: this.version,
            currentTool: this.currentTool,
            isUIVisible: this.isUIVisible,
            compactMode: this.compactMode,
            toolButtonsCount: this.toolButtons.size,
            hasToolbar: !!this.toolbar,
            hasStatusBar: !!this.statusBar
        };
    }
    
    /**
     * デバッグ情報
     */
    getDebugInfo() {
        const status = this.getStatus();
        
        console.group('🎨 UIManager デバッグ情報');
        console.log('📋 バージョン:', status.version);
        console.log('🔧 現在ツール:', status.currentTool);
        console.log('👁️ UI表示状態:', {
            visible: status.isUIVisible,
            compact: status.compactMode
        });
        console.log('🎛️ UI要素:', {
            toolbar: status.hasToolbar,
            statusBar: status.hasStatusBar,
            toolButtons: status.toolButtonsCount
        });
        console.groupEnd();
        
        return status;
    }
    
    /**
     * 破棄処理
     */
    destroy() {
        try {
            console.log('🗑️ UIManager破棄開始...');
            
            // 通知削除
            const notification = document.querySelector('.ui-notification');
            if (notification) {
                notification.remove();
            }
            
            // 参照クリア
            this.toolbar = null;
            this.statusBar = null;
            this.toolButtons.clear();
            this.settingsManager = null;
            
            console.log('✅ UIManager破棄完了');
            
        } catch (error) {
            console.error('❌ UIManager破棄エラー:', error);
        }
    }
}

// グローバル公開
if (typeof window !== 'undefined') {
    window.UIManager = UIManager;
    console.log('✅ UIManager v12 グローバル公開完了');
}

console.log('🎨 UIManager v12-step3 準備完了');
console.log('📋 STEP3実装: UI制御・ツールバー管理・レイアウト制御');
console.log('💡 使用例: const uiManager = new window.UIManager(); uiManager.initialize();');