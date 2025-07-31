// ShortcutController.js - ショートカット専門制御（450-550行）

/**
 * ⌨️ OGL統一エンジン用ショートカットコントローラー
 * 標準ショートカット・キャンバス操作・カスタマイズ対応
 */
export class ShortcutController {
    constructor(oglEngine) {
        this.engine = oglEngine;
        
        // ショートカット定義
        this.shortcuts = new Map();
        this.activeModifiers = {
            ctrl: false,
            alt: false,
            shift: false,
            meta: false
        };
        
        // キーボード状態
        this.pressedKeys = new Set();
        this.isEnabled = true;
        
        // イベントリスナー参照
        this.boundEvents = {};
        
        // Phase2以降拡張予定
        // this.customShortcuts = new Map();    // Phase2でカスタムショートカット
        // this.gestureShortcuts = new Map();   // Phase2でジェスチャーショートカット
        // this.contextShortcuts = new Map();   // Phase2でコンテキスト依存ショートカット
        // this.shortcutHistory = [];           // Phase2でショートカット履歴
        // this.shortcutUI = null;              // Phase2でショートカット設定UI
        
        console.log('⌨️ ショートカットコントローラー初期化');
    }
    
    /**
     * 🔧 標準ショートカット登録
     */
    registerDefaultShortcuts() {
        // === 基本操作 ===
        this.registerShortcut('KeyZ', { ctrl: true }, () => {
            this.engine.history?.undo();
            this.showShortcutFeedback('元に戻す');
        }, 'アンドゥ');
        
        this.registerShortcut('KeyY', { ctrl: true }, () => {
            this.engine.history?.redo();
            this.showShortcutFeedback('やり直し');
        }, 'リドゥ');
        
        this.registerShortcut('KeyZ', { ctrl: true, shift: true }, () => {
            this.engine.history?.redo();
            this.showShortcutFeedback('やり直し');
        }, 'リドゥ（代替）');
        
        // === ツール切り替え ===
        this.registerShortcut('KeyP', {}, () => {
            this.engine.selectTool('pen');
            this.showShortcutFeedback('ペンツール');
        }, 'ペンツール');
        
        this.registerShortcut('KeyE', {}, () => {
            this.engine.selectTool('eraser');
            this.showShortcutFeedback('消しゴム');
        }, '消しゴム');
        
        // Phase2でエアスプレー・ボカシ等追加予定
        /*
        this.registerShortcut('KeyA', {}, () => {
            this.engine.selectTool('airbrush');
            this.showShortcutFeedback('エアスプレー');
        }, 'エアスプレー');
        
        this.registerShortcut('KeyB', {}, () => {
            this.engine.selectTool('blur');
            this.showShortcutFeedback('ボカシ');
        }, 'ボカシ');
        */
        
        // === キャンバス操作 ===
        this.registerShortcut('Delete', {}, () => {
            if (confirm('キャンバスをクリアしますか？')) {
                this.engine.clearCanvas();
                this.showShortcutFeedback('キャンバスクリア');
            }
        }, 'キャンバスクリア');
        
        // === 表示制御 ===
        this.registerShortcut('Space', {}, () => {
            // Phase2でキャンバス移動モード実装予定
            this.showShortcutFeedback('キャンバス移動（Phase2実装予定）');
        }, 'キャンバス移動');
        
        this.registerShortcut('KeyH', {}, () => {
            // Phase2でUI表示切り替え実装予定
            this.showShortcutFeedback('UI表示切り替え（Phase2実装予定）');
        }, 'UI表示切り替え');
        
        // === ファイル操作 ===
        this.registerShortcut('KeyS', { ctrl: true }, (e) => {
            e.preventDefault();
            // Phase4でファイル保存実装予定
            this.showShortcutFeedback('保存（Phase4実装予定）');
        }, '保存');
        
        this.registerShortcut('KeyO', { ctrl: true }, (e) => {
            e.preventDefault();
            // Phase4でファイル読み込み実装予定
            this.showShortcutFeedback('開く（Phase4実装予定）');
        }, '開く');
        
        // === 選択・編集 ===
        this.registerShortcut('KeyA', { ctrl: true }, (e) => {
            e.preventDefault();
            // Phase3で全選択実装予定
            this.showShortcutFeedback('全選択（Phase3実装予定）');
        }, '全選択');
        
        this.registerShortcut('KeyC', { ctrl: true }, (e) => {
            e.preventDefault();
            // Phase3でコピー実装予定
            this.showShortcutFeedback('コピー（Phase3実装予定）');
        }, 'コピー');
        
        this.registerShortcut('KeyV', { ctrl: true }, (e) => {
            e.preventDefault();
            // Phase3で貼り付け実装予定
            this.showShortcutFeedback('貼り付け（Phase3実装予定）');
        }, '貼り付け');
        
        // === デバッグ・開発用 ===
        if (import.meta.env?.DEV) {
            this.registerShortcut('F12', {}, (e) => {
                e.preventDefault();
                console.log('🔍 エンジン状態:', this.engine.getEngineState());
                this.showShortcutFeedback('エンジン状態出力');
            }, 'エンジン状態出力');
            
            this.registerShortcut('KeyD', { ctrl: true, shift: true }, (e) => {
                e.preventDefault();
                this.engine.forceRender();
                this.showShortcutFeedback('強制レンダリング');
            }, '強制レンダリング');
        }
        
        // イベントリスナー設定
        this.setupKeyboardListeners();
        
        console.log(`✅ 標準ショートカット登録完了: ${this.shortcuts.size}個`);
    }
    
    /**
     * 📝 ショートカット登録
     */
    registerShortcut(keyCode, modifiers, action, description) {
        const shortcutKey = this.createShortcutKey(keyCode, modifiers);
        
        this.shortcuts.set(shortcutKey, {
            keyCode,
            modifiers,
            action,
            description,
            timestamp: Date.now()
        });
        
        console.log(`📝 ショートカット登録: ${shortcutKey} - ${description}`);
    }
    
    /**
     * 🔑 ショートカットキー生成
     */
    createShortcutKey(keyCode, modifiers) {
        const parts = [];
        
        if (modifiers.ctrl) parts.push('Ctrl');
        if (modifiers.alt) parts.push('Alt');
        if (modifiers.shift) parts.push('Shift');
        if (modifiers.meta) parts.push('Meta');
        
        parts.push(keyCode);
        
        return parts.join('+');
    }
    
    /**
     * ⌨️ キーボードリスナー設定
     */
    setupKeyboardListeners() {
        // キーダウン
        this.boundEvents.keydown = (e) => this.handleKeyDown(e);
        document.addEventListener('keydown', this.boundEvents.keydown);
        
        // キーアップ
        this.boundEvents.keyup = (e) => this.handleKeyUp(e);
        document.addEventListener('keyup', this.boundEvents.keyup);
        
        // フォーカス喪失時のリセット
        this.boundEvents.blur = () => this.resetKeyboardState();
        window.addEventListener('blur', this.boundEvents.blur);
        
        // ページ離脱時のクリーンアップ
        this.boundEvents.beforeunload = () => this.cleanup();
        window.addEventListener('beforeunload', this.boundEvents.beforeunload);
        
        console.log('⌨️ キーボードリスナー設定完了');
    }
    
    /**
     * ⬇️ キーダウン処理
     */
    handleKeyDown(e) {
        if (!this.isEnabled) return;
        
        // 修飾キー状態更新
        this.updateModifiers(e);
        
        // 押下キー記録
        this.pressedKeys.add(e.code);
        
        // 入力フィールドにフォーカスがある場合はスキップ
        if (this.isInputFieldFocused()) {
            return;
        }
        
        // ショートカット検索・実行
        const shortcutKey = this.createShortcutKey(e.code, this.activeModifiers);
        const shortcut = this.shortcuts.get(shortcutKey);
        
        if (shortcut) {
            try {
                shortcut.action(e);
                this.logShortcutExecution(shortcutKey, shortcut.description);
            } catch (error) {
                console.error(`🚨 ショートカット実行エラー: ${shortcutKey}`, error);
                this.showShortcutFeedback(`エラー: ${shortcut.description}`, 'error');
            }
        }
    }
    
    /**
     * ⬆️ キーアップ処理
     */
    handleKeyUp(e) {
        if (!this.isEnabled) return;
        
        // 修飾キー状態更新
        this.updateModifiers(e);
        
        // 押下キー削除
        this.pressedKeys.delete(e.code);
    }
    
    /**
     * 🔄 修飾キー状態更新
     */
    updateModifiers(e) {
        this.activeModifiers.ctrl = e.ctrlKey;
        this.activeModifiers.alt = e.altKey;
        this.activeModifiers.shift = e.shiftKey;
        this.activeModifiers.meta = e.metaKey;
    }
    
    /**
     * 📝 入力フィールドフォーカス判定
     */
    isInputFieldFocused() {
        const activeElement = document.activeElement;
        if (!activeElement) return false;
        
        const inputTags = ['INPUT', 'TEXTAREA', 'SELECT'];
        const isContentEditable = activeElement.contentEditable === 'true';
        
        return inputTags.includes(activeElement.tagName) || isContentEditable;
    }
    
    /**
     * 📊 ショートカット実行ログ
     */
    logShortcutExecution(shortcutKey, description) {
        if (import.meta.env?.DEV) {
            console.log(`⌨️ ショートカット実行: ${shortcutKey} - ${description}`);
        }
        
        // Phase2以降でショートカット使用統計追加予定
    }
    
    /**
     * 💡 ショートカットフィードバック表示
     */
    showShortcutFeedback(message, type = 'info') {
        // 通知要素作成
        const feedback = document.createElement('div');
        feedback.className = 'shortcut-feedback';
        feedback.style.cssText = `
            position: fixed;
            top: 20px;
            left: 50%;
            transform: translateX(-50%);
            padding: 8px 16px;
            background: ${type === 'error' ? 'rgba(220,20,60,0.9)' : 'rgba(42,42,42,0.9)'};
            color: white;
            border-radius: 20px;
            font-size: 14px;
            font-weight: 600;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
            backdrop-filter: blur(10px);
            z-index: 10000;
            opacity: 0;
            transform: translateX(-50%) translateY(-20px);
            transition: all 200ms ease-out;
            pointer-events: none;
            border: 1px solid rgba(255,255,255,0.2);
        `;
        feedback.textContent = message;
        
        document.body.appendChild(feedback);
        
        // アニメーション表示
        setTimeout(() => {
            feedback.style.opacity = '1';
            feedback.style.transform = 'translateX(-50%) translateY(0)';
        }, 50);
        
        // 2秒後に削除
        setTimeout(() => {
            feedback.style.opacity = '0';
            feedback.style.transform = 'translateX(-50%) translateY(-20px)';
            setTimeout(() => feedback.remove(), 200);
        }, 2000);
    }
    
    /**
     * 📋 ショートカット一覧取得
     */
    getShortcutList() {
        const shortcutList = [];
        
        this.shortcuts.forEach((shortcut, key) => {
            shortcutList.push({
                key,
                description: shortcut.description,
                modifiers: shortcut.modifiers,
                keyCode: shortcut.keyCode
            });
        });
        
        return shortcutList.sort((a, b) => a.description.localeCompare(b.description));
    }
    
    /**
     * 📖 ショートカットヘルプ表示
     */
    showShortcutHelp() {
        const shortcuts = this.getShortcutList();
        
        // ヘルプモーダル作成
        const modal = document.createElement('div');
        modal.className = 'shortcut-help-modal';
        modal.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0,0,0,0.8);
            backdrop-filter: blur(5px);
            z-index: 10000;
            display: flex;
            align-items: center;
            justify-content: center;
            opacity: 0;
            transition: opacity 300ms ease-out;
        `;
        
        // ヘルプ内容
        const helpContent = document.createElement('div');
        helpContent.style.cssText = `
            background: #2a2a2a;
            border-radius: 12px;
            padding: 24px;
            max-width: 600px;
            max-height: 80vh;
            overflow-y: auto;
            box-shadow: 0 8px 32px rgba(0,0,0,0.5);
        `;
        
        // タイトル
        const title = document.createElement('h2');
        title.textContent = 'ショートカット一覧';
        title.style.cssText = `
            color: #ffffff;
            font-size: 20px;
            margin: 0 0 20px 0;
            text-align: center;
        `;
        helpContent.appendChild(title);
        
        // ショートカットリスト
        const shortcutGrid = document.createElement('div');
        shortcutGrid.style.cssText = `
            display: grid;
            grid-template-columns: 1fr 2fr;
            gap: 12px 20px;
            color: #cccccc;
            font-size: 14px;
        `;
        
        shortcuts.forEach(shortcut => {
            // キー表示
            const keyDisplay = document.createElement('div');
            keyDisplay.textContent = shortcut.key.replace(/Key|Arrow/g, '').replace(/\+/g, ' + ');
            keyDisplay.style.cssText = `
                font-family: monospace;
                background: rgba(255,255,255,0.1);
                padding: 4px 8px;
                border-radius: 6px;
                text-align: center;
                font-weight: 600;
            `;
            
            // 説明
            const description = document.createElement('div');
            description.textContent = shortcut.description;
            
            shortcutGrid.appendChild(keyDisplay);
            shortcutGrid.appendChild(description);
        });
        
        helpContent.appendChild(shortcutGrid);
        
        // 閉じるボタン
        const closeButton = document.createElement('button');
        closeButton.textContent = '閉じる (ESC)';
        closeButton.style.cssText = `
            display: block;
            margin: 20px auto 0;
            padding: 8px 16px;
            background: #007acc;
            color: white;
            border: none;
            border-radius: 6px;
            cursor: pointer;
            font-size: 14px;
        `;
        
        closeButton.addEventListener('click', () => {
            this.hideShortcutHelp(modal);
        });
        
        helpContent.appendChild(closeButton);
        modal.appendChild(helpContent);
        document.body.appendChild(modal);
        
        // ESCキーで閉じる
        const escHandler = (e) => {
            if (e.code === 'Escape') {
                this.hideShortcutHelp(modal);
                document.removeEventListener('keydown', escHandler);
            }
        };
        document.addEventListener('keydown', escHandler);
        
        // 背景クリックで閉じる
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                this.hideShortcutHelp(modal);
                document.removeEventListener('keydown', escHandler);
            }
        });
        
        // アニメーション表示
        setTimeout(() => {
            modal.style.opacity = '1';
        }, 50);
    }
    
    /**
     * 🚫 ショートカットヘルプ非表示
     */
    hideShortcutHelp(modal) {
        modal.style.opacity = '0';
        setTimeout(() => modal.remove(), 300);
    }
    
    /**
     * ⚙️ ショートカット有効/無効切り替え
     */
    setEnabled(enabled) {
        this.isEnabled = enabled;
        console.log(`⚙️ ショートカット ${enabled ? '有効' : '無効'}`);
    }
    
    /**
     * 🔄 キーボード状態リセット
     */
    resetKeyboardState() {
        this.pressedKeys.clear();
        this.activeModifiers = {
            ctrl: false,
            alt: false,
            shift: false,
            meta: false
        };
        
        console.log('🔄 キーボード状態リセット');
    }
    
    /**
     * 📊 ショートカット統計取得
     */
    getShortcutStats() {
        return {
            totalShortcuts: this.shortcuts.size,
            isEnabled: this.isEnabled,
            pressedKeys: Array.from(this.pressedKeys),
            activeModifiers: { ...this.activeModifiers }
        };
    }
    
    /**
     * 🧹 クリーンアップ
     */
    cleanup() {
        try {
            // イベントリスナー削除
            Object.entries(this.boundEvents).forEach(([event, handler]) => {
                if (event === 'beforeunload' || event === 'blur') {
                    window.removeEventListener(event, handler);
                } else {
                    document.removeEventListener(event, handler);
                }
            });
            
            // 状態リセット
            this.resetKeyboardState();
            this.shortcuts.clear();
            this.boundEvents = {};
            
            console.log('🧹 ショートカットコントローラー クリーンアップ完了');
            
        } catch (error) {
            console.error('🚨 ショートカットコントローラー クリーンアップエラー:', error);
        }
    }
    
    // Phase2以降拡張予定機能スタブ
    
    /**
     * Phase2: カスタムショートカット管理
     */
    /*
    initializeCustomShortcuts() {
        // Phase2で実装: ユーザーカスタマイズ可能ショートカット
        // this.customShortcuts = new CustomShortcutManager();
    }
    
    registerCustomShortcut(keyCode, modifiers, action, description) {
        // Phase2で実装: カスタムショートカット登録
    }
    
    exportShortcutSettings() {
        // Phase2で実装: ショートカット設定エクスポート
    }
    
    importShortcutSettings(settings) {
        // Phase2で実装: ショートカット設定インポート
    }
    */
    
    /**
     * Phase2: ジェスチャーショートカット統合
     */
    /*
    initializeGestureShortcuts() {
        // Phase2で実装: マウス・タッチジェスチャーとショートカット統合
        // this.gestureShortcuts = new GestureShortcutManager();
    }
    
    registerGestureShortcut(gesture, action, description) {
        // Phase2で実装: ジェスチャーショートカット登録
    }
    */
    
    /**
     * Phase2: コンテキスト依存ショートカット
     */
    /*
    initializeContextShortcuts() {
        // Phase2で実装: ツール・モード依存ショートカット
        // this.contextShortcuts = new ContextShortcutManager();
    }
    
    setShortcutContext(context) {
        // Phase2で実装: ショートカットコンテキスト切り替え
    }
    */
    
    /**
     * Phase2: ショートカット設定UI
     */
    /*
    initializeShortcutUI() {
        // Phase2で実装: ショートカット設定・カスタマイズUI
        // this.shortcutUI = new ShortcutSettingsUI();
    }
    
    showShortcutSettings() {
        // Phase2で実装: ショートカット設定画面表示
    }
    */
}