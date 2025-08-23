/**
 * 🎨 Tegaki Project - Main Application Entry Point
 * 責務明確化版 - 統合初期化スクリプト
 */

class TegakiApplication {
    constructor() {
        this.managers = {};
        this.initialized = false;
        this.config = {
            canvas: {
                width: 400,
                height: 400,
                backgroundColor: 0xffffff,
                antialias: true,
                preserveDrawingBuffer: true
            },
            drawing: {
                defaultTool: 'pen',
                smoothing: true,
                pressureSupport: true
            }
        };
    }

    /**
     * アプリケーション初期化
     * 実装ガイドv12の順序に従って初期化
     */
    async initialize() {
        try {
            console.log('🎨 Tegaki初期化開始...');

            // STEP 1: 基盤システム初期化（依存順序）
            await this.initializeCoreSystem();
            
            // STEP 2: Canvas・座標システム初期化
            await this.initializeCanvasSystem();
            
            // STEP 3: ツールシステム初期化
            await this.initializeToolSystem();
            
            // STEP 4: UI・機能拡張システム初期化
            await this.initializeExtendedSystem();
            
            // STEP 5: イベント統合・最終接続
            await this.finalizeIntegration();
            
            this.initialized = true;
            console.log('✅ Tegaki初期化完了');
            
            // 初期化完了イベント発火
            if (window.EventBus) {
                window.EventBus.emit('app:initialized');
            }
            
        } catch (error) {
            console.error('❌ Tegaki初期化エラー:', error);
            if (window.ErrorManager) {
                window.ErrorManager.handle(error, 'TegakiApplication.initialize');
            }
            throw error;
        }
    }

    /**
     * STEP 1: 基盤システム初期化
     */
    async initializeCoreSystem() {
        console.log('📡 基盤システム初期化中...');
        
        // 1. EventBus（依存なし）
        if (typeof EventBus !== 'undefined') {
            window.EventBus = new EventBus();
            this.managers.eventBus = window.EventBus;
            console.log('✅ EventBus初期化完了');
        }

        // 2. ErrorManager（依存なし）
        if (typeof ErrorManager !== 'undefined') {
            window.ErrorManager = new ErrorManager();
            this.managers.errorManager = window.ErrorManager;
            console.log('✅ ErrorManager初期化完了');
        }

        // 3. ConfigManager（ErrorManager依存）
        if (typeof ConfigManager !== 'undefined') {
            window.ConfigManager = new ConfigManager();
            this.managers.configManager = window.ConfigManager;
            console.log('✅ ConfigManager初期化完了');
        }

        // 4. StateManager（EventBus, ErrorManager依存）
        if (typeof StateManager !== 'undefined') {
            window.StateManager = new StateManager();
            this.managers.stateManager = window.StateManager;
            console.log('✅ StateManager初期化完了');
        }
    }

    /**
     * STEP 2: Canvas・座標システム初期化
     */
    async initializeCanvasSystem() {
        console.log('🎯 Canvas・座標システム初期化中...');

        // 5. CoordinateManager（ErrorManager依存）
        if (typeof CoordinateManager !== 'undefined') {
            window.CoordinateManager = new CoordinateManager();
            this.managers.coordinateManager = window.CoordinateManager;
            console.log('✅ CoordinateManager初期化完了');
        }

        // 6. CanvasManager（EventBus, StateManager, CoordinateManager依存）
        if (typeof CanvasManager !== 'undefined') {
            window.CanvasManager = new CanvasManager();
            this.managers.canvasManager = window.CanvasManager;
            
            // Canvasコンテナ取得・初期化
            const canvasContainer = document.getElementById('canvas-container');
            if (!canvasContainer) {
                throw new Error('Canvas container (#canvas-container) が見つかりません');
            }
            
            // Canvas初期化（左上直線バグ対策含む）
            await window.CanvasManager.initialize(canvasContainer, this.config.canvas);
            
            console.log('✅ CanvasManager初期化完了');
        }
    }

    /**
     * STEP 3: ツールシステム初期化
     */
    async initializeToolSystem() {
        console.log('🔧 ツールシステム初期化中...');

        // 7. ToolManager（EventBus, StateManager, ツール群依存）
        if (typeof ToolManager !== 'undefined') {
            window.ToolManager = new ToolManager();
            this.managers.toolManager = window.ToolManager;
            
            // ツール初期化
            await window.ToolManager.initialize();
            
            // デフォルトツール設定
            if (this.config.drawing.defaultTool) {
                await window.ToolManager.setActiveTool(this.config.drawing.defaultTool);
            }
            
            console.log('✅ ToolManager初期化完了');
        }
    }

    /**
     * STEP 4: UI・機能拡張システム初期化
     */
    async initializeExtendedSystem() {
        console.log('🎨 拡張システム初期化中...');

        // 8. MemoryManager（EventBus, CanvasManager依存）
        if (typeof MemoryManager !== 'undefined') {
            window.MemoryManager = new MemoryManager();
            this.managers.memoryManager = window.MemoryManager;
            await window.MemoryManager.initialize();
            console.log('✅ MemoryManager初期化完了');
        }

        // 9. BoundaryManager（CanvasManager依存）
        if (typeof BoundaryManager !== 'undefined') {
            window.BoundaryManager = new BoundaryManager();
            this.managers.boundaryManager = window.BoundaryManager;
            await window.BoundaryManager.initialize();
            console.log('✅ BoundaryManager初期化完了');
        }

        // 10. SettingsManager（EventBus, ConfigManager依存）
        if (typeof SettingsManager !== 'undefined') {
            window.SettingsManager = new SettingsManager();
            this.managers.settingsManager = window.SettingsManager;
            await window.SettingsManager.initialize();
            console.log('✅ SettingsManager初期化完了');
        }

        // 11. UIManager（EventBus, SettingsManager依存）
        if (typeof UIManager !== 'undefined') {
            window.UIManager = new UIManager();
            this.managers.uiManager = window.UIManager;
            await window.UIManager.initialize();
            console.log('✅ UIManager初期化完了');
        }
    }

    /**
     * STEP 5: イベント統合・最終接続
     */
    async finalizeIntegration() {
        console.log('🔗 最終統合処理中...');

        // イベントリスナー設定
        this.setupEventListeners();

        // キーボードショートカット設定
        this.setupKeyboardShortcuts();

        // UI統合
        this.setupUIIntegration();

        console.log('✅ 最終統合完了');
    }

    /**
     * イベントリスナー設定
     */
    setupEventListeners() {
        if (!window.EventBus) return;

        // ツール変更イベント
        window.EventBus.on('tool:change', (data) => {
            console.log('ツール変更:', data.toolName);
            this.updateStatusBar();
        });

        // 描画イベント
        window.EventBus.on('canvas:draw', (data) => {
            if (window.MemoryManager) {
                window.MemoryManager.captureSnapshot();
            }
        });

        // 座標更新イベント
        window.EventBus.on('canvas:mousemove', (data) => {
            this.updateCursorPosition(data.x, data.y);
        });
    }

    /**
     * キーボードショートカット設定
     */
    setupKeyboardShortcuts() {
        document.addEventListener('keydown', (event) => {
            // フォーカスがinput要素にある場合はスキップ
            if (event.target.tagName === 'INPUT') return;

            // Ctrl/Cmd + Z: Undo
            if ((event.ctrlKey || event.metaKey) && event.key === 'z' && !event.shiftKey) {
                event.preventDefault();
                if (window.MemoryManager) {
                    window.MemoryManager.undo();
                }
                return;
            }

            // Ctrl/Cmd + Shift + Z: Redo
            if ((event.ctrlKey || event.metaKey) && event.key === 'z' && event.shiftKey) {
                event.preventDefault();
                if (window.MemoryManager) {
                    window.MemoryManager.redo();
                }
                return;
            }

            // P: ペンツール
            if (event.key.toLowerCase() === 'p' && !event.ctrlKey && !event.metaKey) {
                event.preventDefault();
                if (window.ToolManager) {
                    window.ToolManager.setActiveTool('pen');
                }
                return;
            }

            // E: 消しゴムツール
            if (event.key.toLowerCase() === 'e' && !event.ctrlKey && !event.metaKey) {
                event.preventDefault();
                if (window.ToolManager) {
                    window.ToolManager.setActiveTool('eraser');
                }
                return;
            }
        });
    }

    /**
     * UI統合設定
     */
    setupUIIntegration() {
        // ツールボタンのクリックイベント
        document.querySelectorAll('.tool-btn[data-tool]').forEach(button => {
            button.addEventListener('click', () => {
                const toolName = button.getAttribute('data-tool');
                if (window.ToolManager) {
                    window.ToolManager.setActiveTool(toolName);
                }
            });
        });

        // ペンツール設定ポップアップ
        const penToolBtn = document.getElementById('pen-tool-btn');
        const penSettingsPopup = document.getElementById('pen-settings-popup');
        const penSettingsClose = document.getElementById('pen-settings-close');

        if (penToolBtn && penSettingsPopup) {
            // ダブルクリックで設定画面表示
            penToolBtn.addEventListener('dblclick', () => {
                penSettingsPopup.style.display = 'flex';
            });

            // 閉じるボタン
            if (penSettingsClose) {
                penSettingsClose.addEventListener('click', () => {
                    penSettingsPopup.style.display = 'none';
                });
            }

            // 背景クリックで閉じる
            penSettingsPopup.addEventListener('click', (e) => {
                if (e.target === penSettingsPopup) {
                    penSettingsPopup.style.display = 'none';
                }
            });
        }
    }

    /**
     * ステータスバー更新
     */
    updateStatusBar() {
        // ツール名の更新など、シンプルに
        const statusInfo = document.querySelector('.status-info');
        if (statusInfo && window.StateManager) {
            const currentTool = window.StateManager.getCurrentTool();
            if (currentTool) {
                const toolElements = document.querySelectorAll('.status-info');
                if (toolElements[1]) {
                    toolElements[1].textContent = `Tool: ${currentTool}`;
                }
            }
        }
    }

    /**
     * カーソル位置更新
     */
    updateCursorPosition(x, y) {
        const statusElements = document.querySelectorAll('.status-info');
        if (statusElements[3]) {
            statusElements[3].textContent = `座標: x: ${Math.round(x)}, y: ${Math.round(y)}`;
        }
    }
}

/**
 * DOM読み込み完了後の初期化
 */
document.addEventListener('DOMContentLoaded', async () => {
    try {
        console.log('📋 DOM読み込み完了 - Tegaki初期化開始');
        
        // グローバルアプリケーションインスタンス作成
        window.TegakiApp = new TegakiApplication();
        
        // アプリケーション初期化実行
        await window.TegakiApp.initialize();
        
        // 初期化完了メッセージ
        console.log('🎉 Tegakiアプリケーション準備完了!');
        
    } catch (error) {
        console.error('💥 Tegaki初期化に失敗:', error);
    }
});

/**
 * ページ離脱時のクリーンアップ
 */
window.addEventListener('beforeunload', () => {
    if (window.TegakiApp && window.TegakiApp.initialized) {
        console.log('🧹 Tegakiクリーンアップ実行');
        
        // 設定保存
        if (window.ConfigManager) {
            window.ConfigManager.save();
        }
        
        // メモリクリーンアップ
        if (window.MemoryManager) {
            window.MemoryManager.cleanup();
        }
    }
});

/**
 * グローバルエラーハンドリング
 */
window.addEventListener('error', (event) => {
    if (window.ErrorManager) {
        window.ErrorManager.handle(event.error, 'Global Error Handler');
    }
});

window.addEventListener('unhandledrejection', (event) => {
    if (window.ErrorManager) {
        window.ErrorManager.handle(event.reason, 'Unhandled Promise Rejection');
    }
});