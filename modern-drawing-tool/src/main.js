// main.js - Phase段階的import管理テンプレート（Phase1+Phase2統合対応版）

// 🔥 Phase1: OGL統一基盤（実装済み・動作確認済み）
import { OGLUnifiedEngine } from './OGLDrawingCore.js';
import { OGLInputController } from './OGLInputController.js';
import { ShortcutController } from './ShortcutController.js';
import { HistoryController } from './HistoryController.js';
import { EventStore } from './EventStore.js';

// 🎨 Phase2: ツール・UI・カラー統合（同時実装・動作確認）
import { ToolProcessor } from './ToolProcessor.js';
import { UIController } from './UIController.js';
import { ColorProcessor } from './ColorProcessor.js';
import { LayerProcessor } from './LayerProcessor.js';
// import { CanvasController } from './CanvasController.js';  // 次回実装

// ⚡ Phase3: 高度ツール・メッシュ変形・アニメーション（Phase2完成後封印解除）
// import { AdvancedToolProcessor } from './AdvancedToolProcessor.js';
// import { AnimationController } from './AnimationController.js';
// import { FileController } from './FileController.js';
// import { MeshDeformController } from './MeshDeformController.js';

// 🏪 Stores段階的追加（Phase3で実装）
// import { AnimationStore } from './stores/AnimationStore.js';
// import { ProjectStore } from './stores/ProjectStore.js';

/**
 * 🎯 モダンお絵かきツール統合アプリケーション
 * Phase1+Phase2統合実装対応・OGL統一エンジン版
 */
class DrawingApp {
    constructor(canvasElement) {
        // 基本要素
        this.canvas = canvasElement;
        
        // 🔥 Phase1: OGL統一基盤初期化
        this.eventStore = new EventStore();
        this.engine = new OGLUnifiedEngine(this.canvas);
        this.inputController = new OGLInputController(this.engine, this.eventStore);
        this.shortcuts = new ShortcutController(this.engine, this.eventStore);
        this.history = new HistoryController(this.engine, this.eventStore);
        
        // 🎨 Phase2: ツール・UI統合
        this.toolProcessor = new ToolProcessor(this.engine, this.eventStore);
        this.uiController = new UIController(this.eventStore, this.toolProcessor);
        this.colorProcessor = new ColorProcessor(this.engine, this.eventStore);
        this.layerProcessor = new LayerProcessor(this.engine, this.eventStore);
        
        // Phase2拡張（次回実装）
        // this.canvasController = new CanvasController(this.engine, this.eventStore);
        
        // ⚡ Phase3: 高度機能（封印解除時追加）
        // this.advancedToolProcessor = new AdvancedToolProcessor(this.engine, this.eventStore);
        // this.animationController = new AnimationController(this.engine, this.eventStore);
        // this.fileController = new FileController(this.eventStore);
        
        // 初期化状態
        this.initialized = false;
        this.currentPhase = 'Phase1+Phase2(ほぼ完全)';
        
        console.log('✅ DrawingApp初期化完了（Phase1+Phase2対応）');
    }
    
    /**
     * アプリケーション初期化
     */
    async initialize() {
        try {
            // Phase1基盤初期化
            await this.initializePhase1();
            
            // Phase2統合初期化
            await this.initializePhase2();
            
            // Phase2拡張初期化
            await this.initializePhase2Extended();
            
            this.initialized = true;
            console.log('🚀 DrawingApp初期化完了');
            
            return true;
            
        } catch (error) {
            console.error('🚨 DrawingApp初期化エラー:', error);
            this.handleInitializationError(error);
            return false;
        }
    }
    
    /**
     * 🔥 Phase1: OGL統一基盤初期化
     */
    async initializePhase1() {
        console.log('🔥 Phase1初期化開始...');
        
        // EventStore基盤初期化
        this.eventStore.setupPhaseEvents();
        
        // OGL統一エンジン初期化
        await this.engine.initialize();
        
        // 入力制御初期化
        this.inputController.initialize();
        
        // ショートカット初期化
        this.shortcuts.initialize();
        
        // 履歴管理初期化
        this.history.initialize();
        
        console.log('✅ Phase1基盤初期化完了');
    }
    
    /**
     * 🎨 Phase2: ツール・UI・カラー統合初期化
     */
    async initializePhase2() {
        console.log('🎨 Phase2初期化開始...');
        
        // ツール処理初期化
        await this.toolProcessor.initialize();
        
        // UI制御初期化
        this.uiController.initializeFrescoUI();
        
        // カラー処理初期化
        await this.colorProcessor.initialize();
        
        // レイヤー処理初期化
        await this.layerProcessor.initialize();
        
        console.log('✅ Phase2統合初期化完了');
    }
    
    /**
     * 🎨 Phase2拡張: 追加機能初期化
     */
    async initializePhase2Extended() {
        console.log('🎨 Phase2拡張初期化開始...');
        
        // キャンバスコントローラー初期化（次回実装）
        // if (this.canvasController) {
        //     await this.canvasController.initialize();
        // }
        
        // 拡張UI機能初期化
        this.setupExtendedUI();
        
        // 拡張イベント購読
        this.setupExtendedEvents();
        
        console.log('✅ Phase2拡張初期化完了');
    }
    
    /**
     * 拡張UI機能セットアップ
     */
    setupExtendedUI() {
        // 通知システム初期化
        this.setupNotificationSystem();
        
        // ツールチップシステム初期化
        this.setupTooltipSystem();
        
        // コンテキストメニュー初期化
        this.setupContextMenu();
    }
    
    /**
     * 拡張イベント購読セットアップ
     */
    setupExtendedEvents() {
        // アプリケーションレベルイベント
        this.eventStore.on('app:fullscreen:toggle', this.toggleFullscreen.bind(this), 'drawing-app');
        this.eventStore.on('app:reset', this.resetApplication.bind(this), 'drawing-app');
        this.eventStore.on('app:export', this.exportCanvas.bind(this), 'drawing-app');
        
        // エラーハンドリング
        this.eventStore.on('engine:error', this.handleEngineError.bind(this), 'drawing-app');
        this.eventStore.on('system:critical:error', this.handleCriticalError.bind(this), 'drawing-app');
    }
    
    /**
     * 通知システムセットアップ
     */
    setupNotificationSystem() {
        const notificationContainer = document.createElement('div');
        notificationContainer.id = 'notification-container';
        notificationContainer.className = `
            fixed top-4 right-4 z-50 
            flex flex-col gap-2
            max-w-sm
        `;
        document.body.appendChild(notificationContainer);
    }
    
    /**
     * ツールチップシステムセットアップ
     */
    setupTooltipSystem() {
        const tooltip = document.createElement('div');
        tooltip.id = 'global-tooltip';
        tooltip.className = `
            absolute z-50 px-2 py-1
            bg-gray-800 text-white text-sm rounded
            pointer-events-none opacity-0 transition-opacity
        `;
        document.body.appendChild(tooltip);
    }
    
    /**
     * コンテキストメニューセットアップ
     */
    setupContextMenu() {
        // 右クリックメニュー無効化（カスタムメニュー使用）
        document.addEventListener('contextmenu', (e) => {
            if (e.target.closest('#canvasArea')) {
                e.preventDefault();
                this.showCustomContextMenu(e.clientX, e.clientY);
            }
        });
    }
    
    /**
     * カスタムコンテキストメニュー表示
     */
    showCustomContextMenu(x, y) {
        const menu = document.createElement('div');
        menu.className = `
            fixed z-50 bg-white border border-gray-200 rounded shadow-lg
            py-1 min-w-32
        `;
        menu.style.left = `${x}px`;
        menu.style.top = `${y}px`;
        
        const menuItems = [
            { label: 'アンドゥ', action: () => this.history.undo() },
            { label: 'リドゥ', action: () => this.history.redo() },
            { label: '---', separator: true },
            { label: 'すべて選択', action: () => this.selectAll() },
            { label: 'コピー', action: () => this.copy() },
            { label: '貼り付け', action: () => this.paste() },
        ];
        
        menuItems.forEach(item => {
            if (item.separator) {
                const separator = document.createElement('hr');
                separator.className = 'my-1 border-gray-200';
                menu.appendChild(separator);
            } else {
                const menuItem = document.createElement('div');
                menuItem.className = `
                    px-3 py-1 hover:bg-gray-100 cursor-pointer text-sm
                `;
                menuItem.textContent = item.label;
                menuItem.onclick = () => {
                    item.action();
                    menu.remove();
                };
                menu.appendChild(menuItem);
            }
        });
        
        document.body.appendChild(menu);
        
        // クリック外で閉じる
        const closeMenu = (e) => {
            if (!menu.contains(e.target)) {
                menu.remove();
                document.removeEventListener('click', closeMenu);
            }
        };
        setTimeout(() => document.addEventListener('click', closeMenu), 0);
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
     * アプリケーションリセット
     */
    resetApplication() {
        if (confirm('すべての作業内容が失われます。続行しますか？')) {
            this.engine.clearCanvas();
            this.history.clearHistory();
            this.layerProcessor.resetLayers();
            console.log('🔄 アプリケーションリセット完了');
        }
    }
    
    /**
     * キャンバスエクスポート
     */
    exportCanvas() {
        try {
            const dataURL = this.engine.exportToDataURL();
            const link = document.createElement('a');
            link.download = `drawing_${Date.now()}.png`;
            link.href = dataURL;
            link.click();
            
            this.eventStore.emitSuccess('画像をエクスポートしました');
        } catch (error) {
            console.error('🚨 エクスポートエラー:', error);
            this.eventStore.emitError(error, 'export');
        }
    }
    
    /**
     * 初期化エラーハンドリング
     */
    handleInitializationError(error) {
        console.error('🚨 初期化失敗:', error);
        
        // エラー表示UI
        const errorDiv = document.createElement('div');
        errorDiv.className = `
            fixed inset-0 bg-red-50 flex items-center justify-center z-50
        `;
        errorDiv.innerHTML = `
            <div class="bg-white p-8 rounded-lg shadow-lg max-w-md">
                <h2 class="text-xl font-bold text-red-600 mb-4">初期化エラー</h2>
                <p class="text-gray-700 mb-4">アプリケーションの初期化に失敗しました。</p>
                <p class="text-sm text-gray-500 mb-4">${error.message}</p>
                <button class="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700"
                        onclick="location.reload()">
                    ページを再読み込み
                </button>
            </div>
        `;
        document.body.appendChild(errorDiv);
    }
    
    /**
     * エンジンエラーハンドリング
     */
    handleEngineError(eventData) {
        console.error('🚨 エンジンエラー:', eventData.payload);
        this.showNotification('描画エンジンエラーが発生しました', 'error');
    }
    
    /**
     * クリティカルエラーハンドリング
     */
    handleCriticalError(eventData) {
        console.error('🚨 クリティカルエラー:', eventData.payload);
        this.showNotification('重大なエラーが発生しました。ページを再読み込みしてください。', 'error', 10000);
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
            setTimeout(() => notification.remove(), 300);
        }, duration);
    }
    
    /**
     * 選択操作（プレースホルダー）
     */
    selectAll() {
        console.log('🔄 すべて選択（未実装）');
    }
    
    copy() {
        console.log('🔄 コピー（未実装）');
    }
    
    paste() {
        console.log('🔄 貼り付け（未実装）');
    }
    
    /**
     * デバッグ情報取得
     */
    getDebugInfo() {
        return {
            initialized: this.initialized,
            currentPhase: this.currentPhase,
            engineStatus: this.engine.getStatus(),
            eventStore: this.eventStore.getEventStats(),
            historyStats: this.history.getHistoryStats()
        };
    }
}

/**
 * アプリケーション起動
 */
document.addEventListener('DOMContentLoaded', async () => {
    console.log('🚀 アプリケーション起動開始');
    
    // キャンバス要素取得
    const canvas = document.getElementById('canvas');
    if (!canvas) {
        console.error('🚨 キャンバス要素が見つかりません');
        return;
    }
    
    // アプリケーション初期化
    const app = new DrawingApp(canvas);
    const success = await app.initialize();
    
    if (success) {
        console.log('✅ アプリケーション起動完了');
        
        // グローバル変数として設定（デバッグ用）
        window.drawingApp = app;
        
        // 開発者向けデバッグ情報
        console.log('🔧 デバッグ情報:', app.getDebugInfo());
    } else {
        console.error('🚨 アプリケーション起動失敗');
    }
});