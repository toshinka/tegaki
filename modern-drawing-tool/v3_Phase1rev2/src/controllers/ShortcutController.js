// ⌨️ ショートカット管理システム - 統一キーボード操作・Phase拡張対応
// キーボードショートカット・マクロ・カスタマイズ機能

/**
 * 🚀 ShortcutController - 統一ショートカット管理システム
 * 
 * 【責務】
 * - キーボードショートカットの一元管理
 * - ツール・機能の素早いアクセス
 * - カスタマイズ可能なキーバインディング
 * - Phase2・3での拡張ショートカット対応
 */
export class ShortcutController {
    constructor(eventStore) {
        this.eventStore = eventStore;
        
        // ショートカット定義（Phase1基本セット）
        this.shortcuts = new Map();
        this.setupPhase1Shortcuts();
        
        // キー状態管理
        this.pressedKeys = new Set();
        this.keySequence = [];
        this.sequenceTimeout = null;
        this.sequenceTimeoutDuration = 1000; // 1秒
        
        // カスタムショートカット
        this.customShortcuts = new Map();
        
        // マクロ機能
        this.macros = new Map();
        this.isRecordingMacro = false;
        this.currentMacro = [];
        
        // Phase2・3拡張準備
        // this.advancedShortcuts = new Map();  // 🔒Phase2解封
        // this.animationShortcuts = new Map(); // 🔒Phase3解封

        // イベントリスナー設定
        this.setupEventListeners();
        
        console.log('⌨️ ShortcutController初期化完了');
    }

    /**
     * 🔥 Phase1基本ショートカット設定
     */
    setupPhase1Shortcuts() {
        const phase1Shortcuts = [
            // ツール切り替え
            { keys: ['KeyP'], action: 'tool:change', params: { tool: 'pen' }, description: 'ペンツール' },
            { keys: ['KeyB'], action: 'tool:change', params: { tool: 'brush' }, description: 'ブラシツール' },
            { keys: ['KeyE'], action: 'tool:change', params: { tool: 'eraser' }, description: '消しゴムツール' },
            { keys: ['KeyV'], action: 'tool:change', params: { tool: 'select' }, description: '選択ツール' },
            { keys: ['KeyI'], action: 'tool:change', params: { tool: 'eyedropper' }, description: 'スポイトツール' },
            { keys: ['KeyZ'], action: 'tool:change', params: { tool: 'zoom' }, description: 'ズームツール' },
            
            // 編集操作
            { keys: ['ControlLeft', 'KeyZ'], action: 'history:undo', description: 'アンドゥ' },
            { keys: ['ControlLeft', 'KeyY'], action: 'history:redo', description: 'リドゥ' },
            { keys: ['ControlLeft', 'ShiftLeft', 'KeyZ'], action: 'history:redo', description: 'リドゥ（別キー）' },
            
            // 表示操作
            { keys: ['Tab'], action: 'ui:sidebar:toggle', description: 'サイドバー切り替え' },
            { keys: ['F11'], action: 'ui:fullscreen:toggle', description: 'フルスクリーン切り替え' },
            { keys: ['ControlLeft', 'KeyF'], action: 'ui:fullscreen:toggle', description: 'フルスクリーン切り替え（代替）' },
            { keys: ['Space'], action: 'tool:pan:temporary', description: '一時パンモード' },
            
            // キャンバス操作
            { keys: ['ControlLeft', 'Key0'], action: 'canvas:reset:zoom', description: 'ズームリセット' },
            { keys: ['ControlLeft', 'Equal'], action: 'canvas:zoom:in', description: 'ズームイン' },
            { keys: ['ControlLeft', 'Minus'], action: 'canvas:zoom:out', description: 'ズームアウト' },
            
            // システム
            { keys: ['F1'], action: 'system:help', description: 'ヘルプ表示' },
            { keys: ['Escape'], action: 'system:cancel', description: 'キャンセル・閉じる' },
            
            // デバッグ（開発時）
            { keys: ['F12', 'ShiftLeft'], action: 'debug:coordinate:grid', description: '座標グリッド表示切り替え' },
            { keys: ['ControlLeft', 'ShiftLeft', 'KeyD'], action: 'debug:mode:toggle', description: 'デバッグモード切り替え' }
        ];

        // ショートカット登録
        phase1Shortcuts.forEach(shortcut => {
            const keyCombo = shortcut.keys.join('+');
            this.shortcuts.set(keyCombo, shortcut);
        });

        console.log('🔥 Phase1ショートカット設定完了:', this.shortcuts.size + '個');
    }

    // 🎨 Phase2拡張ショートカット（解封時有効化）
    /*
    setupPhase2Shortcuts() {                        // 🔒Phase2解封
        const phase2Shortcuts = [
            // UI拡張
            { keys: ['KeyL'], action: 'ui:layer:panel:toggle', description: 'レイヤーパネル切り替え' },
            { keys: ['KeyC'], action: 'ui:color:picker:open', description: 'カラーピッカー' },
            { keys: ['KeyT'], action: 'tool:change', params: { tool: 'text' }, description: 'テキストツール' },
            { keys: ['KeyS'], action: 'tool:change', params: { tool: 'shape' }, description: '図形ツール' },
            
            // レイヤー操作
            { keys: ['ControlLeft', 'ShiftLeft', 'KeyN'], action: 'layer:new', description: '新規レイヤー' },
            { keys: ['ControlLeft', 'ShiftLeft', 'KeyD'], action: 'layer:duplicate', description: 'レイヤー複製' },
            { keys: ['Delete'], action: 'layer:clear', description: 'レイヤークリア' },
            
            // ファイル操作
            { keys: ['ControlLeft', 'KeyN'], action: 'file:new', description: '新規ファイル' },
            { keys: ['ControlLeft', 'KeyO'], action: 'file:open', description: 'ファイルを開く' },
            { keys: ['ControlLeft', 'KeyS'], action: 'file:save', description: '保存' },
            { keys: ['ControlLeft', 'ShiftLeft', 'KeyS'], action: 'file:save:as', description: '名前を付けて保存' },
            { keys: ['ControlLeft', 'ShiftLeft', 'KeyE'], action: 'file:export', description: 'エクスポート' }
        ];

        phase2Shortcuts.forEach(shortcut => {
            const keyCombo = shortcut.keys.join('+');
            this.shortcuts.set(keyCombo, shortcut);
        });

        console.log('🎨 Phase2ショートカット拡張完了');
    }
    */

    // ⚡ Phase3拡張ショートカット（解封時有効化）
    /*
    setupPhase3Shortcuts() {                        // 🔒Phase3解封
        const phase3Shortcuts = [
            // アニメーション
            { keys: ['KeyO'], action: 'animation:onion:skin:toggle', description: 'オニオンスキン切り替え' },
            { keys: ['ShiftLeft', 'KeyT'], action: 'animation:timeline:toggle', description: 'タイムライン切り替え' },
            { keys: ['KeyK'], action: 'animation:keyframe:add', description: 'キーフレーム追加' },
            { keys: ['Enter'], action: 'animation:play:toggle', description: 'アニメ再生・停止' },
            
            // メッシュ変形
            { keys: ['KeyM'], action: 'tool:change', params: { tool: 'mesh' }, description: 'メッシュ変形ツール' },
            { keys: ['ControlLeft', 'KeyM'], action: 'mesh:create', description: 'メッシュ作成' },
            
            // 高度な出力
            { keys: ['ControlLeft', 'ShiftLeft', 'KeyV'], action: 'export:video', description: '動画出力' },
            { keys: ['ControlLeft', 'ShiftLeft', 'KeyG'], action: 'export:gif', description: 'GIF出力' }
        ];

        phase3Shortcuts.forEach(shortcut => {
            const keyCombo = shortcut.keys.join('+');
            this.shortcuts.set(keyCombo, shortcut);
        });

        console.log('⚡ Phase3ショートカット拡張完了');
    }
    */

    /**
     * 🎛️ イベントリスナー設定
     */
    setupEventListeners() {
        document.addEventListener('keydown', this.handleKeyDown.bind(this));
        document.addEventListener('keyup', this.handleKeyUp.bind(this));
        
        // フォーカス関連イベント
        window.addEventListener('blur', this.handleWindowBlur.bind(this));
        window.addEventListener('focus', this.handleWindowFocus.bind(this));
    }

    /**
     * ⌨️ キーダウン処理
     */
    handleKeyDown(event) {
        // 入力フィールドでの処理をスキップ
        if (this.isInputElement(event.target)) {
            return;
        }

        const keyCode = event.code;
        this.pressedKeys.add(keyCode);
        
        // キーシーケンス記録
        this.addToKeySequence(keyCode);
        
        // ショートカット判定
        const shortcut = this.findMatchingShortcut();
        if (shortcut) {
            event.preventDefault();
            this.executeShortcut(shortcut);
        }

        // マクロ記録中
        if (this.isRecordingMacro) {
            this.addToCurrentMacro('keydown', keyCode, Date.now());
        }
    }

    /**
     * ⌨️ キーアップ処理
     */
    handleKeyUp(event) {
        const keyCode = event.code;
        this.pressedKeys.delete(keyCode);
        
        // マクロ記録中
        if (this.isRecordingMacro) {
            this.addToCurrentMacro('keyup', keyCode, Date.now());
        }
    }

    /**
     * 🎯 ショートカット検索
     */
    findMatchingShortcut() {
        const currentKeys = Array.from(this.pressedKeys).sort();
        const keyCombo = currentKeys.join('+');
        
        return this.shortcuts.get(keyCombo) || this.customShortcuts.get(keyCombo);
    }

    /**
     * ⚡ ショートカット実行
     */
    executeShortcut(shortcut) {
        console.log('⚡ ショートカット実行:', shortcut.description);
        
        // イベント通知
        this.eventStore.emit(shortcut.action, {
            ...shortcut.params,
            shortcut: shortcut,
            timestamp: Date.now()
        });

        // ショートカット実行ログ
        this.logShortcutExecution(shortcut);
    }

    /**
     * 📊 ショートカット実行ログ
     */
    logShortcutExecution(shortcut) {
        if (!this.executionLog) {
            this.executionLog = [];
        }

        this.executionLog.push({
            action: shortcut.action,
            description: shortcut.description,
            timestamp: Date.now(),
            keys: shortcut.keys
        });

        // ログサイズ制限
        if (this.executionLog.length > 100) {
            this.executionLog.shift();
        }
    }

    /**
     * 📝 キーシーケンス追加
     */
    addToKeySequence(keyCode) {
        this.keySequence.push({
            key: keyCode,
            timestamp: Date.now()
        });

        // シーケンス長制限
        if (this.keySequence.length > 10) {
            this.keySequence.shift();
        }

        // タイムアウト設定
        clearTimeout(this.sequenceTimeout);
        this.sequenceTimeout = setTimeout(() => {
            this.keySequence = [];
        }, this.sequenceTimeoutDuration);
    }

    /**
     * 🎯 入力要素判定
     */
    isInputElement(element) {
        const inputTypes = ['INPUT', 'TEXTAREA', 'SELECT'];
        return inputTypes.includes(element.tagName) || 
               element.contentEditable === 'true';
    }

    /**
     * 🪟 ウィンドウフォーカス処理
     */
    handleWindowBlur() {
        // フォーカス失われた時に押下状態クリア
        this.pressedKeys.clear();
    }

    /**
     * 🪟 ウィンドウフォーカス復帰処理
     */
    handleWindowFocus() {
        // フォーカス復帰時にキー状態リセット
        this.pressedKeys.clear();
        this.keySequence = [];
    }

    /**
     * ➕ カスタムショートカット追加
     */
    addCustomShortcut(keys, action, params = {}, description = '') {
        const keyCombo = keys.sort().join('+');
        
        const customShortcut = {
            keys: keys,
            action: action,
            params: params,
            description: description || `カスタム: ${action}`,
            isCustom: true
        };

        this.customShortcuts.set(keyCombo, customShortcut);
        
        console.log('➕ カスタムショートカット追加:', description);
        return keyCombo;
    }

    /**
     * ➖ カスタムショートカット削除
     */
    removeCustomShortcut(keys) {
        const keyCombo = keys.sort().join('+');
        const removed = this.customShortcuts.delete(keyCombo);
        
        if (removed) {
            console.log('➖ カスタムショートカット削除:', keyCombo);
        }
        
        return removed;
    }

    /**
     * 📋 ショートカット一覧取得
     */
    getAllShortcuts() {
        const allShortcuts = new Map();
        
        // 基本ショートカット
        this.shortcuts.forEach((value, key) => {
            allShortcuts.set(key, { ...value, type: 'default' });
        });
        
        // カスタムショートカット
        this.customShortcuts.forEach((value, key) => {
            allShortcuts.set(key, { ...value, type: 'custom' });
        });
        
        return allShortcuts;
    }

    /**
     * 🔍 ショートカット検索
     */
    searchShortcuts(query) {
        const searchTerm = query.toLowerCase();
        const results = [];
        
        this.getAllShortcuts().forEach((shortcut, keyCombo) => {
            if (shortcut.description.toLowerCase().includes(searchTerm) ||
                shortcut.action.toLowerCase().includes(searchTerm) ||
                keyCombo.toLowerCase().includes(searchTerm)) {
                results.push({ keyCombo, ...shortcut });
            }
        });
        
        return results;
    }

    /**
     * 🎬 マクロ記録開始
     */
    startMacroRecording(macroName) {
        if (this.isRecordingMacro) {
            console.warn('⚠️ 既にマクロ記録中です');
            return false;
        }

        this.isRecordingMacro = true;
        this.currentMacro = [];
        this.currentMacroName = macroName;
        this.macroStartTime = Date.now();
        
        console.log('🎬 マクロ記録開始:', macroName);
        return true;
    }

    /**
     * ⏹️ マクロ記録停止
     */
    stopMacroRecording() {
        if (!this.isRecordingMacro) {
            console.warn('⚠️ マクロ記録中ではありません');
            return null;
        }

        this.isRecordingMacro = false;
        
        const macro = {
            name: this.currentMacroName,
            actions: [...this.currentMacro],
            duration: Date.now() - this.macroStartTime,
            created: new Date().toISOString()
        };

        this.macros.set(this.currentMacroName, macro);
        
        console.log('⏹️ マクロ記録完了:', this.currentMacroName, macro.actions.length + 'アクション');
        
        // リセット
        this.currentMacro = [];
        this.currentMacroName = null;
        this.macroStartTime = null;
        
        return macro;
    }

    /**
     * 📝 マクロにアクション追加
     */
    addToCurrentMacro(type, data, timestamp) {
        if (!this.isRecordingMacro) return;
        
        this.currentMacro.push({
            type: type,
            data: data,
            timestamp: timestamp,
            relativeTime: timestamp - this.macroStartTime
        });
    }

    /**
     * ▶️ マクロ実行
     */
    async executeMacro(macroName) {
        const macro = this.macros.get(macroName);
        if (!macro) {
            console.warn('⚠️ マクロが見つかりません:', macroName);
            return false;
        }

        console.log('▶️ マクロ実行開始:', macroName);
        
        let lastTime = 0;
        for (const action of macro.actions) {
            // タイミング調整
            const delay = action.relativeTime - lastTime;
            if (delay > 0) {
                await this.sleep(Math.min(delay, 1000)); // 最大1秒の遅延
            }
            
            // アクション実行
            if (action.type === 'keydown') {
                this.simulateKeyDown(action.data);
            } else if (action.type === 'keyup') {
                this.simulateKeyUp(action.data);
            }
            
            lastTime = action.relativeTime;
        }
        
        console.log('✅ マクロ実行完了:', macroName);
        return true;
    }

    /**
     * 💤 待機処理
     */
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * 🎯 キーダウンシミュレート
     */
    simulateKeyDown(keyCode) {
        const event = new KeyboardEvent('keydown', {
            code: keyCode,
            bubbles: true,
            cancelable: true
        });
        document.dispatchEvent(event);
    }

    /**
     * 🎯 キーアップシミュレート
     */
    simulateKeyUp(keyCode) {
        const event = new KeyboardEvent('keyup', {
            code: keyCode,
            bubbles: true,
            cancelable: true
        });
        document.dispatchEvent(event);
    }

    /**
     * 📚 マクロ一覧取得
     */
    getAllMacros() {
        return new Map(this.macros);
    }

    /**
     * 🗑️ マクロ削除
     */
    deleteMacro(macroName) {
        const deleted = this.macros.delete(macroName);
        if (deleted) {
            console.log('🗑️ マクロ削除:', macroName);
        }
        return deleted;
    }

    /**
     * 💾 設定保存
     */
    saveSettings() {
        const settings = {
            customShortcuts: Object.fromEntries(this.customShortcuts),
            macros: Object.fromEntries(this.macros),
            sequenceTimeoutDuration: this.sequenceTimeoutDuration,
            version: '1.0'
        };
        
        try {
            localStorage.setItem('shortcutSettings', JSON.stringify(settings));
            console.log('💾 ショートカット設定保存完了');
            return true;
        } catch (error) {
            console.error('❌ 設定保存失敗:', error);
            return false;
        }
    }

    /**
     * 📂 設定読み込み
     */
    loadSettings() {
        try {
            const settingsJson = localStorage.getItem('shortcutSettings');
            if (!settingsJson) return false;
            
            const settings = JSON.parse(settingsJson);
            
            // カスタムショートカット復元
            if (settings.customShortcuts) {
                this.customShortcuts = new Map(Object.entries(settings.customShortcuts));
            }
            
            // マクロ復元
            if (settings.macros) {
                this.macros = new Map(Object.entries(settings.macros));
            }
            
            // その他設定
            if (settings.sequenceTimeoutDuration) {
                this.sequenceTimeoutDuration = settings.sequenceTimeoutDuration;
            }
            
            console.log('📂 ショートカット設定読み込み完了');
            return true;
        } catch (error) {
            console.error('❌ 設定読み込み失敗:', error);
            return false;
        }
    }

    /**
     * 🔧 設定リセット
     */
    resetSettings() {
        this.customShortcuts.clear();
        this.macros.clear();
        this.sequenceTimeoutDuration = 1000;
        
        try {
            localStorage.removeItem('shortcutSettings');
            console.log('🔧 ショートカット設定リセット完了');
            return true;
        } catch (error) {
            console.error('❌ 設定リセット失敗:', error);
            return false;
        }
    }

    /**
     * 📊 使用統計取得
     */
    getUsageStats() {
        const stats = {
            totalShortcuts: this.shortcuts.size,
            customShortcuts: this.customShortcuts.size,
            totalMacros: this.macros.size,
            executionLog: this.executionLog?.length || 0,
            isRecordingMacro: this.isRecordingMacro,
            currentPressedKeys: Array.from(this.pressedKeys)
        };
        
        return stats;
    }

    /**
     * 🎯 ショートカット競合チェック
     */
    checkConflicts() {
        const conflicts = [];
        const allShortcuts = this.getAllShortcuts();
        const keyCombos = Array.from(allShortcuts.keys());
        
        keyCombos.forEach(combo1 => {
            keyCombos.forEach(combo2 => {
                if (combo1 !== combo2 && combo1 === combo2) {
                    conflicts.push({
                        keyCombo: combo1,
                        shortcut1: allShortcuts.get(combo1),
                        shortcut2: allShortcuts.get(combo2)
                    });
                }
            });
        });
        
        return conflicts;
    }

    /**
     * 📖 ヘルプテキスト生成
     */
    generateHelpText() {
        const shortcuts = this.getAllShortcuts();
        const categories = {};
        
        // カテゴリ別にグループ化
        shortcuts.forEach((shortcut, keyCombo) => {
            const category = shortcut.action.split(':')[0] || 'その他';
            if (!categories[category]) {
                categories[category] = [];
            }
            
            categories[category].push({
                keys: this.formatKeyCombo(keyCombo),
                description: shortcut.description
            });
        });
        
        // ヘルプテキスト生成
        let helpText = '⌨️ ショートカット一覧\n\n';
        
        Object.entries(categories).forEach(([category, shortcuts]) => {
            helpText += `📂 ${category}\n`;
            shortcuts.forEach(shortcut => {
                helpText += `  ${shortcut.keys}: ${shortcut.description}\n`;
            });
            helpText += '\n';
        });
        
        return helpText;
    }

    /**
     * 🎨 キーコンボ表示形式変換
     */
    formatKeyCombo(keyCombo) {
        return keyCombo
            .replace(/ControlLeft|ControlRight/g, 'Ctrl')
            .replace(/ShiftLeft|ShiftRight/g, 'Shift')
            .replace(/AltLeft|AltRight/g, 'Alt')
            .replace(/Key([A-Z])/g, '$1')
            .replace(/\+/g, ' + ');
    }

    /**
     * 🎯 ショートカット有効/無効切り替え
     */
    toggleShortcut(keyCombo, enabled = null) {
        const shortcut = this.shortcuts.get(keyCombo) || this.customShortcuts.get(keyCombo);
        if (!shortcut) return false;
        
        shortcut.enabled = enabled !== null ? enabled : !shortcut.enabled;
        
        console.log(`🎯 ショートカット${shortcut.enabled ? '有効' : '無効'}:`, shortcut.description);
        return shortcut.enabled;
    }

    /**
     * 🔄 ショートカット変更
     */
    modifyShortcut(oldKeyCombo, newKeys, newAction = null, newParams = {}) {
        const oldShortcut = this.shortcuts.get(oldKeyCombo) || this.customShortcuts.get(oldKeyCombo);
        if (!oldShortcut) return false;
        
        // 古いショートカット削除
        this.shortcuts.delete(oldKeyCombo);
        this.customShortcuts.delete(oldKeyCombo);
        
        // 新しいショートカット作成
        const newKeyCombo = newKeys.sort().join('+');
        const newShortcut = {
            ...oldShortcut,
            keys: newKeys,
            action: newAction || oldShortcut.action,
            params: { ...oldShortcut.params, ...newParams }
        };
        
        if (oldShortcut.isCustom) {
            this.customShortcuts.set(newKeyCombo, newShortcut);
        } else {
            this.shortcuts.set(newKeyCombo, newShortcut);
        }
        
        console.log('🔄 ショートカット変更:', oldKeyCombo, '→', newKeyCombo);
        return true;
    }

    /**
     * 🗑️ リソース解放
     */
    destroy() {
        // イベントリスナー削除
        document.removeEventListener('keydown', this.handleKeyDown);
        document.removeEventListener('keyup', this.handleKeyUp);
        window.removeEventListener('blur', this.handleWindowBlur);
        window.removeEventListener('focus', this.handleWindowFocus);
        
        // タイマークリア
        clearTimeout(this.sequenceTimeout);
        
        // 設定保存
        this.saveSettings();
        
        // データクリア
        this.shortcuts.clear();
        this.customShortcuts.clear();
        this.macros.clear();
        this.pressedKeys.clear();
        this.keySequence = [];
        this.currentMacro = [];
        
        console.log('🗑️ ShortcutController リソース解放完了');
    }
}