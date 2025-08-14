/**
 * 🎨 ふたば☆ちゃんねる風お絵描きツール - メインエントリーポイント
 * 🎯 AI_WORK_SCOPE: アプリケーション初期化・CDN検証・動的読み込み統括
 * 🎯 DEPENDENCIES: なし（エントリーポイント）
 * 🎯 CDN_USAGE: 全CDNライブラリ検証
 * 🎯 ISOLATION_TEST: ❌ 他ファイル依存
 * 🎯 SPLIT_THRESHOLD: 100行維持（超過時app-loader.js分割）
 * 
 * 📋 PHASE_TARGET: Phase1基盤
 * 📋 V8_MIGRATION: PIXI.Application.init()対応予定
 * 📋 PERFORMANCE_TARGET: 初期化1秒以内
 * 
 * 📋 PLANNED_LIBRARIES: @pixi/layers（Phase2）, @pixi/gif（Phase3）
 */

/**
 * アプリケーション初期化・統括クラス
 */
class FutabaDrawingApp {
    constructor() {
        this.version = 'v1.0-Phase1';
        this.isInitialized = false;
        this.components = new Map();
        this.startTime = performance.now();
        
        console.log(`🎨 ふたば☆ちゃんねる風ベクターお絵描きツール ${this.version} 初期化開始`);
    }

    /**
     * アプリケーション初期化メイン処理
     */
    async init() {
        try {
            // Step 1: CDNライブラリ検証
            await this.validateCDNLibraries();
            console.log('✅ CDNライブラリ検証完了');

            // Step 2: ライブラリマネージャー初期化
            const { LibraryManager } = await import('./managers/library-manager.js');
            this.components.set('libraryManager', LibraryManager);
            await LibraryManager.validateAllLibraries();
            console.log('✅ ライブラリマネージャー初期化完了');

            // Step 3: アプリケーションコア初期化
            const { AppCore } = await import('./app-core.js');
            this.appCore = new AppCore();
            await this.appCore.init();
            this.components.set('appCore', this.appCore);
            console.log('✅ アプリケーションコア初期化完了');

            // Step 4: マネージャー統括初期化
            await this.initializeManagers();
            console.log('✅ マネージャー初期化完了');

            // Step 5: UI初期化・DOM統合
            await this.initializeUI();
            console.log('✅ UI初期化完了');

            // Step 6: イベント統合・最終化
            this.setupGlobalEvents();
            console.log('✅ イベントシステム初期化完了');

            // 初期化完了
            this.isInitialized = true;
            const initTime = performance.now() - this.startTime;
            
            console.log(`🎉 ${this.version} 初期化完了！`);
            console.log(`⏱️ 初期化時間: ${initTime.toFixed(2)}ms`);
            console.log(`📊 読み込み済みコンポーネント: ${this.components.size}個`);
            
            // 📋 Phase2準備: レイヤーシステム基盤確認
            if (window.PIXI && window.PIXI.layers) {
                console.log('📋 Phase2準備: @pixi/layers 利用可能');
            } else {
                console.log('📋 Phase2準備: @pixi/layers Phase2で有効化予定');
            }
            
            // 📋 Phase3準備: GIF機能基盤確認
            if (window.PIXI && window.PIXI.gif) {
                console.log('📋 Phase3準備: @pixi/gif 利用可能');
            } else {
                console.log('📋 Phase3準備: @pixi/gif Phase3で有効化予定');
            }

        } catch (error) {
            console.error('❌ アプリケーション初期化エラー:', error);
            this.showErrorMessage(error);
        }
    }

    /**
     * CDNライブラリ基本検証
     */
    async validateCDNLibraries() {
        const requiredLibraries = [
            { name: 'PIXI', global: 'PIXI' },
            { name: 'PIXI_UI', global: 'PIXI_UI' }
        ];

        const optionalLibraries = [
            { name: 'Viewport', global: 'Viewport' },
            { name: 'PIXI.filters', global: 'PIXI', property: 'filters' },
            { name: 'GSAP', global: 'gsap' },
            { name: 'Lodash', global: '_' },
            { name: 'Hammer', global: 'Hammer' }
        ];

        // 必須ライブラリ検証
        for (const lib of requiredLibraries) {
            const available = this.checkLibraryAvailable(lib);
            if (!available) {
                throw new Error(`必須CDNライブラリ ${lib.name} が読み込まれていません`);
            }
        }

        // オプションライブラリ検証（警告のみ）
        for (const lib of optionalLibraries) {
            const available = this.checkLibraryAvailable(lib);
            if (!available) {
                console.warn(`⚠️ オプションライブラリ ${lib.name} が読み込まれていません`);
            } else {
                console.log(`✅ ${lib.name} 利用可能`);
            }
        }
    }

    /**
     * ライブラリ可用性チェック
     */
    checkLibraryAvailable(lib) {
        if (lib.property) {
            return window[lib.global] && window[lib.global][lib.property];
        }
        return window[lib.global] !== undefined;
    }

    /**
     * マネージャー統括初期化
     */
    async initializeManagers() {
        // UI Manager（@pixi/ui統合）
        const { UIManager } = await import('./managers/ui-manager.js');
        this.uiManager = new UIManager(this.appCore);
        this.components.set('uiManager', this.uiManager);

        // Tool Manager（ツール統括）
        const { ToolManager } = await import('./managers/tool-manager.js');
        this.toolManager = new ToolManager(this.appCore, this.uiManager);
        this.components.set('toolManager', this.toolManager);

        // Canvas Manager（pixi-viewport統合）
        const { CanvasManager } = await import('./managers/canvas-manager.js');
        this.canvasManager = new CanvasManager(this.appCore);
        this.components.set('canvasManager', this.canvasManager);

        // Settings Manager（設定統括）
        const { SettingsManager } = await import('./managers/settings-manager.js');
        this.settingsManager = new SettingsManager();
        this.components.set('settingsManager', this.settingsManager);

        // マネージャー相互連携設定
        this.uiManager.setToolManager(this.toolManager);
        this.toolManager.setCanvasManager(this.canvasManager);
        this.canvasManager.setSettingsManager(this.settingsManager);
    }

    /**
     * UI初期化・DOM統合
     */
    async initializeUI() {
        // ツールバー初期化
        await this.uiManager.initializeToolbar();

        // ステータスパネル初期化
        await this.uiManager.initializeStatusPanel();

        // ポップアップシステム初期化
        await this.uiManager.initializePopupSystem();

        // キャンバス統合
        await this.canvasManager.integrateWithDOM();
    }

    /**
     * グローバルイベント設定
     */
    setupGlobalEvents() {
        // エラーハンドリング
        window.addEventListener('error', (event) => {
            console.error('グローバルエラー:', event.error);
            this.showErrorMessage(event.error);
        });

        // 未処理Promise拒否
        window.addEventListener('unhandledrejection', (event) => {
            console.error('未処理Promise拒否:', event.reason);
            this.showErrorMessage(event.reason);
        });

        // ページ離脱前の保存確認（将来機能）
        window.addEventListener('beforeunload', (event) => {
            if (this.hasUnsavedChanges()) {
                event.preventDefault();
                event.returnValue = '';
            }
        });

        // キーボードショートカット（基本的なもの）
        document.addEventListener('keydown', (event) => {
            this.handleGlobalKeyboard(event);
        });

        // リサイズ対応
        window.addEventListener('resize', () => {
            if (this.appCore) {
                this.appCore.handleResize();
            }
        });
    }

    /**
     * グローバルキーボードハンドリング
     */
    handleGlobalKeyboard(event) {
        // Ctrl+Z: アンドゥ（将来実装）
        if (event.ctrlKey && event.key === 'z' && !event.shiftKey) {
            event.preventDefault();
            console.log('アンドゥ（未実装）');
        }

        // Ctrl+Shift+Z: リドゥ（将来実装）
        if (event.ctrlKey && event.key === 'z' && event.shiftKey) {
            event.preventDefault();
            console.log('リドゥ（未実装）');
        }

        // Escape: ポップアップを閉じる
        if (event.key === 'Escape') {
            this.uiManager?.closeAllPopups();
        }
    }

    /**
     * 未保存変更チェック（将来実装）
     */
    hasUnsavedChanges() {
        // 📋 Phase2実装: レイヤー変更検出
        // 📋 Phase3実装: アニメーション変更検出
        return false;
    }

    /**
     * エラーメッセージ表示
     */
    showErrorMessage(error) {
        const errorDiv = document.createElement('div');
        errorDiv.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: #ff4444;
            color: white;
            padding: 16px;
            border-radius: 8px;
            box-shadow: 0 4px 16px rgba(255, 68, 68, 0.3);
            z-index: 9999;
            max-width: 400px;
            font-family: monospace;
            font-size: 12px;
        `;
        errorDiv.innerHTML = `
            <strong>エラーが発生しました:</strong><br>
            ${error.message || error}
            <br><br>
            <button onclick="this.parentNode.remove()" 
                    style="background:rgba(255,255,255,0.2);border:none;color:white;padding:4px 8px;border-radius:4px;cursor:pointer;">
                閉じる
            </button>
        `;
        
        document.body.appendChild(errorDiv);
        
        // 10秒後自動削除
        setTimeout(() => {
            if (errorDiv.parentNode) {
                errorDiv.remove();
            }
        }, 10000);
    }
}

/**
 * アプリケーション起動
 */
window.addEventListener('DOMContentLoaded', async () => {
    try {
        // グローバル変数として保存（デバッグ・開発用）
        window.futabaDrawingApp = new FutabaDrawingApp();
        await window.futabaDrawingApp.init();
        
        // 📋 V8_MIGRATION: 将来的にPixiJS v8対応
        // const app = await PIXI.Application.init({...});
        
    } catch (error) {
        console.error('❌ アプリケーション起動失敗:', error);
        
        // フォールバック表示
        document.body.innerHTML = `
            <div style="display:flex;justify-content:center;align-items:center;height:100vh;background:#ffffee;">
                <div style="text-align:center;color:#800000;">
                    <h2>🎨 お絵描きツール</h2>
                    <p>申し訳ございませんが、アプリケーションの初期化に失敗しました。</p>
                    <p style="font-family:monospace;font-size:12px;color:#666;">${error.message}</p>
                    <button onclick="location.reload()" 
                            style="background:#800000;color:white;border:none;padding:8px 16px;border-radius:4px;cursor:pointer;margin-top:16px;">
                        再読み込み
                    </button>
                </div>
            </div>
        `;
    }
});