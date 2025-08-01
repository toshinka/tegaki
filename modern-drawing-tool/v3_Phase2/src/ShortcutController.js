// ShortcutController.js - ショートカット専門（Phase1基盤・封印対象）

/**
 * 🔥 ショートカット専門制御（Phase1基盤・封印対象）
 * 責務: 標準ショートカット定義、キャンバス操作ショートカット、カスタマイズUI・設定画面
 */
export class ShortcutController {
    constructor(oglEngine, eventStore) {
        this.engine = oglEngine;
        this.eventStore = eventStore;
        
        // ショートカット定義
        this.shortcuts = new Map();
        this.keyState = new Map();
        this.isEnabled = true;
        
        // カスタマイズ設定
        this.customShortcuts = new Map();
        this.disabledShortcuts = new Set();
        
        // イベントリスナー参照
        this.boundEventHandlers = {};
        
        console.log('✅ ShortcutController初期化完了');
    }
    
    /**
     * フルスクリーン切替
     */
    toggleFullscreen() {
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen().catch(err => {
                console.warn('🚨 フルスクリーン開始失敗:', err);
            });
        } else {
            document.exitFullscreen().catch(err => {
                console.warn('🚨 フルスクリーン終了失敗:', err);
            });
        }
    }
    
    /**
     * 入力フィールドフォーカス判定
     */
    isInputFieldFocused() {
        const activeElement = document.activeElement;
        if (!activeElement) return false;
        
        const inputTypes = ['input', 'textarea', 'select'];
        const tagName = activeElement.tagName.toLowerCase();
        const isEditable = activeElement.contentEditable === 'true';
        
        return inputTypes.includes(tagName) || isEditable;
    }
    
    /**
     * ショートカット有効/無効切替
     */
    setEnabled(enabled) {
        this.isEnabled = enabled;
        console.log(`🎮 ショートカット${enabled ? '有効' : '無効'}`);
    }
    
    /**
     * 特定ショートカット無効化
     */
    disableShortcut(keyCombo) {
        const normalizedCombo = this.normalizeKeyCombo(keyCombo);
        this.disabledShortcuts.add(normalizedCombo);
        console.log(`🎮 ショートカット無効化: ${keyCombo}`);
    }
    
    /**
     * 特定ショートカット有効化
     */
    enableShortcut(keyCombo) {
        const normalizedCombo = this.normalizeKeyCombo(keyCombo);
        this.disabledShortcuts.delete(normalizedCombo);
        console.log(`🎮 ショートカット有効化: ${keyCombo}`);
    }
    
    /**
     * カスタムショートカット設定
     */
    setCustomShortcut(keyCombo, action, description = '') {
        const normalizedCombo = this.normalizeKeyCombo(keyCombo);
        
        // 既存ショートカットとの競合チェック
        if (this.shortcuts.has(normalizedCombo)) {
            console.warn(`🚨 ショートカット競合: ${keyCombo} は既に使用中`);
            return false;
        }
        
        this.customShortcuts.set(normalizedCombo, {
            action,
            description,
            originalCombo: keyCombo,
            enabled: true,
            custom: true
        });
        
        this.shortcuts.set(normalizedCombo, this.customShortcuts.get(normalizedCombo));
        
        console.log(`🎮 カスタムショートカット設定: ${keyCombo} → ${action}`);
        return true;
    }
    
    /**
     * カスタムショートカット削除
     */
    removeCustomShortcut(keyCombo) {
        const normalizedCombo = this.normalizeKeyCombo(keyCombo);
        
        if (this.customShortcuts.has(normalizedCombo)) {
            this.customShortcuts.delete(normalizedCombo);
            this.shortcuts.delete(normalizedCombo);
            
            console.log(`🎮 カスタムショートカット削除: ${keyCombo}`);
            return true;
        }
        
        return false;
    }
    
    /**
     * ショートカット一覧取得
     */
    getShortcuts() {
        const shortcuts = [];
        
        this.shortcuts.forEach((shortcut, combo) => {
            shortcuts.push({
                keyCombo: combo,
                action: shortcut.action,
                description: shortcut.description,
                enabled: shortcut.enabled,
                custom: shortcut.custom || false
            });
        });
        
        return shortcuts.sort((a, b) => a.keyCombo.localeCompare(b.keyCombo));
    }
    
    /**
     * アクション別ショートカット検索
     */
    getShortcutByAction(action) {
        for (const [combo, shortcut] of this.shortcuts) {
            if (shortcut.action === action && shortcut.enabled) {
                return {
                    keyCombo: combo,
                    description: shortcut.description
                };
            }
        }
        return null;
    }
    
    /**
     * ショートカット設定保存
     */
    saveSettings() {
        const settings = {
            customShortcuts: Array.from(this.customShortcuts.entries()),
            disabledShortcuts: Array.from(this.disabledShortcuts)
        };
        
        try {
            localStorage.setItem('shortcut-settings', JSON.stringify(settings));
            console.log('🎮 ショートカット設定保存完了');
            return true;
        } catch (error) {
            console.warn('🚨 ショートカット設定保存失敗:', error);
            return false;
        }
    }
    
    /**
     * ショートカット設定読み込み
     */
    loadSettings() {
        try {
            const saved = localStorage.getItem('shortcut-settings');
            if (!saved) return false;
            
            const settings = JSON.parse(saved);
            
            // カスタムショートカット復元
            if (settings.customShortcuts) {
                settings.customShortcuts.forEach(([combo, shortcut]) => {
                    this.customShortcuts.set(combo, shortcut);
                    this.shortcuts.set(combo, shortcut);
                });
            }
            
            // 無効化ショートカット復元
            if (settings.disabledShortcuts) {
                this.disabledShortcuts = new Set(settings.disabledShortcuts);
            }
            
            console.log('🎮 ショートカット設定読み込み完了');
            return true;
        } catch (error) {
            console.warn('🚨 ショートカット設定読み込み失敗:', error);
            return false;
        }
    }
    
    /**
     * ショートカット設定リセット
     */
    resetSettings() {
        this.customShortcuts.clear();
        this.disabledShortcuts.clear();
        
        // 標準ショートカットのみ残す
        const defaultShortcuts = new Map();
        this.shortcuts.forEach((shortcut, combo) => {
            if (!shortcut.custom) {
                defaultShortcuts.set(combo, shortcut);
            }
        });
        
        this.shortcuts = defaultShortcuts;
        
        try {
            localStorage.removeItem('shortcut-settings');
        } catch (error) {
            console.warn('🚨 ショートカット設定削除失敗:', error);
        }
        
        console.log('🎮 ショートカット設定リセット完了');
    }
    
    /**
     * ヘルプ表示用ショートカット情報
     */
    getHelpInfo() {
        const categories = {
            '基本操作': [],
            'ツール': [],
            'キャンバス': [],
            'UI': [],
            '編集': [],
            'ファイル': [],
            'アニメーション': []
        };
        
        this.shortcuts.forEach((shortcut, combo) => {
            if (!shortcut.enabled) return;
            
            const info = {
                keyCombo: this.formatKeyCombo(combo),
                description: shortcut.description
            };
            
            // カテゴリ分類
            if (shortcut.action.includes('undo') || shortcut.action.includes('redo')) {
                categories['基本操作'].push(info);
            } else if (shortcut.action.includes('Tool')) {
                categories['ツール'].push(info);
            } else if (shortcut.action.includes('canvas') || shortcut.action.includes('View') || shortcut.action.includes('flip')) {
                categories['キャンバス'].push(info);
            } else if (shortcut.action.includes('ui') || shortcut.action.includes('toggle') || shortcut.action.includes('Fullscreen')) {
                categories['UI'].push(info);
            } else if (shortcut.action.includes('copy') || shortcut.action.includes('paste') || shortcut.action.includes('select')) {
                categories['編集'].push(info);
            } else if (shortcut.action.includes('save') || shortcut.action.includes('open') || shortcut.action.includes('export')) {
                categories['ファイル'].push(info);
            } else if (shortcut.action.includes('animation') || shortcut.action.includes('frame') || shortcut.action.includes('play')) {
                categories['アニメーション'].push(info);
            } else {
                categories['基本操作'].push(info);
            }
        });
        
        return categories;
    }
    
    /**
     * キーコンビネーション表示用フォーマット
     */
    formatKeyCombo(combo) {
        return combo
            .replace('Ctrl+', 'Ctrl + ')
            .replace('Shift+', 'Shift + ')
            .replace('Alt+', 'Alt + ')
            .replace('Meta+', 'Cmd + ')
            .replace('Key', '')
            .replace('Digit', '')
            .replace('Bracket', 'Bracket');
    }
    
    /**
     * デバッグ情報取得
     */
    getDebugInfo() {
        return {
            totalShortcuts: this.shortcuts.size,
            customShortcuts: this.customShortcuts.size,
            disabledShortcuts: this.disabledShortcuts.size,
            isEnabled: this.isEnabled,
            currentKeyState: Array.from(this.keyState.entries()).filter(([key, pressed]) => pressed)
        };
    }
}
     * 標準ショートカット登録
     */
    registerDefaultShortcuts() {
        // 🔥 Phase1: 基本ショートカット
        this.registerShortcut('Ctrl+KeyZ', 'undo', 'アンドゥ');
        this.registerShortcut('Ctrl+KeyY', 'redo', 'リドゥ');
        this.registerShortcut('Ctrl+Shift+KeyZ', 'redo', 'リドゥ（代替）');
        
        // キャンバス操作
        this.registerShortcut('Ctrl+Digit0', 'resetView', 'ビューリセット');
        this.registerShortcut('KeyH', 'flipHorizontal', 'キャンバス左右反転');
        this.registerShortcut('Shift+KeyH', 'flipVertical', 'キャンバス上下反転');
        this.registerShortcut('Delete', 'clearLayer', 'レイヤー内消去');
        
        // ツール切り替え（Phase1基本ツール）
        this.registerShortcut('KeyP', 'selectPenTool', 'ペンツール');
        this.registerShortcut('KeyE', 'selectEraserTool', '消しゴムツール');
        this.registerShortcut('KeyA', 'selectAirsprayTool', 'エアスプレーツール');
        this.registerShortcut('KeyB', 'selectBlurTool', 'ボカシツール');
        
        // UI制御
        this.registerShortcut('Tab', 'toggleUI', 'UI表示切替');
        this.registerShortcut('KeyF', 'toggleFullscreen', 'フルスクリーン切替');
        this.registerShortcut('Escape', 'cancelAction', 'アクションキャンセル');
        
        // 🎨 Phase2: 拡張ショートカット（封印解除時追加）
        /*
        this.registerShortcut('Ctrl+KeyC', 'copy', 'コピー');
        this.registerShortcut('Ctrl+KeyV', 'paste', '貼り付け');
        this.registerShortcut('Ctrl+KeyA', 'selectAll', '全選択');
        this.registerShortcut('Ctrl+KeyD', 'deselect', '選択解除');
        this.registerShortcut('KeyI', 'eyedropper', 'スポイトツール');
        this.registerShortcut('KeyG', 'bucketFill', '塗りつぶしツール');
        this.registerShortcut('KeyM', 'selectTool', '選択ツール');
        this.registerShortcut('KeyT', 'textTool', 'テキストツール');
        this.registerShortcut('KeyS', 'shapeTool', '図形ツール');
        this.registerShortcut('KeyV', 'moveLayer', 'レイヤー内絵画移動');
        this.registerShortcut('BracketLeft', 'decreaseBrushSize', 'ブラシサイズ縮小');
        this.registerShortcut('BracketRight', 'increaseBrushSize', 'ブラシサイズ拡大');
        */
        
        // ⚡ Phase3: 高度ショートカット（封印解除時追加）
        /*
        this.registerShortcut('Ctrl+KeyS', 'save', '保存');
        this.registerShortcut('Ctrl+Shift+KeyS', 'saveAs', '名前を付けて保存');
        this.registerShortcut('Ctrl+KeyO', 'open', '開く');
        this.registerShortcut('Ctrl+KeyN', 'new', '新規');
        this.registerShortcut('Ctrl+Shift+KeyE', 'export', 'エクスポート');
        this.registerShortcut('Space', 'playAnimation', 'アニメーション再生');
        this.registerShortcut('Comma', 'prevFrame', '前のフレーム');
        this.registerShortcut('Period', 'nextFrame', '次のフレーム');
        */
        
        console.log('🎮 標準ショートカット登録完了:', this.shortcuts.size + '個');
    }
    
    /**
     * ショートカット登録
     */
    registerShortcut(keyCombo, action, description = '') {
        const normalizedCombo = this.normalizeKeyCombo(keyCombo);
        
        this.shortcuts.set(normalizedCombo, {
            action,
            description,
            originalCombo: keyCombo,
            enabled: true
        });
        
        console.log(`🎮 ショートカット登録: ${keyCombo} → ${action}`);
    }
    
    /**
     * キーリスニング開始
     */
    startListening() {
        this.boundEventHandlers = {
            keydown: this.handleKeyDown.bind(this),
            keyup: this.handleKeyUp.bind(this)
        };
        
        // グローバルキーイベント
        document.addEventListener('keydown', this.boundEventHandlers.keydown);
        document.addEventListener('keyup', this.boundEventHandlers.keyup);
        
        console.log('🎮 ショートカットリスニング開始');
    }
    
    /**
     * キーリスニング停止
     */
    stopListening() {
        document.removeEventListener('keydown', this.boundEventHandlers.keydown);
        document.removeEventListener('keyup', this.boundEventHandlers.keyup);
        
        this.boundEventHandlers = {};
        this.keyState.clear();
        
        console.log('🎮 ショートカットリスニング停止');
    }
    
    /**
     * KeyDown処理
     */
    handleKeyDown(event) {
        if (!this.isEnabled) return;
        
        // 入力フィールドフォーカス時は無効
        if (this.isInputFieldFocused()) return;
        
        // キー状態更新
        this.keyState.set(event.code, true);
        
        // 修飾キー状態取得
        const combo = this.getCurrentKeyCombo(event);
        
        if (combo && this.shortcuts.has(combo)) {
            const shortcut = this.shortcuts.get(combo);
            
            if (shortcut.enabled && !this.disabledShortcuts.has(combo)) {
                event.preventDefault();
                this.executeAction(shortcut.action, event);
                
                console.log(`🎮 ショートカット実行: ${combo} → ${shortcut.action}`);
            }
        }
    }
    
    /**
     * KeyUp処理
     */
    handleKeyUp(event) {
        this.keyState.set(event.code, false);
    }
    
    /**
     * 現在のキーコンビネーション取得
     */
    getCurrentKeyCombo(event) {
        const modifiers = [];
        
        if (event.ctrlKey) modifiers.push('Ctrl');
        if (event.shiftKey) modifiers.push('Shift');
        if (event.altKey) modifiers.push('Alt');
        if (event.metaKey) modifiers.push('Meta');
        
        return modifiers.length > 0 
            ? `${modifiers.join('+')}+${event.code}`
            : event.code;
    }
    
    /**
     * キーコンビネーション正規化
     */
    normalizeKeyCombo(combo) {
        const parts = combo.split('+');
        const modifiers = parts.slice(0, -1).sort();
        const key = parts[parts.length - 1];
        
        return modifiers.length > 0 
            ? `${modifiers.join('+')}+${key}`
            : key;
    }
    
    /**
     * アクション実行
     */
    executeAction(action, event) {
        switch (action) {
            // Phase1: 基本アクション
            case 'undo':
                this.eventStore.emit(this.eventStore.eventTypes.HISTORY_UNDO);
                break;
                
            case 'redo':
                this.eventStore.emit(this.eventStore.eventTypes.HISTORY_REDO);
                break;
                
            case 'resetView':
                this.eventStore.emit('canvas:reset:view');
                break;
                
            case 'flipHorizontal':
                this.eventStore.emit('canvas:flip:horizontal');
                break;
                
            case 'flipVertical':
                this.eventStore.emit('canvas:flip:vertical');
                break;
                
            case 'clearLayer':
                this.eventStore.emit('layer:clear:active');
                break;
                
            // ツール切り替え
            case 'selectPenTool':
                this.engine.setTool('pen');
                this.eventStore.emit(this.eventStore.eventTypes.TOOL_CHANGE, { tool: 'pen' });
                break;
                
            case 'selectEraserTool':
                this.engine.setTool('eraser');
                this.eventStore.emit(this.eventStore.eventTypes.TOOL_CHANGE, { tool: 'eraser' });
                break;
                
            case 'selectAirsprayTool':
                this.engine.setTool('airspray');
                this.eventStore.emit(this.eventStore.eventTypes.TOOL_CHANGE, { tool: 'airspray' });
                break;
                
            case 'selectBlurTool':
                this.engine.setTool('blur');
                this.eventStore.emit(this.eventStore.eventTypes.TOOL_CHANGE, { tool: 'blur' });
                break;
                
            // UI制御
            case 'toggleUI':
                this.eventStore.emit('ui:toggle:all');
                break;
                
            case 'toggleFullscreen':
                this.toggleFullscreen();
                break;
                
            case 'cancelAction':
                this.eventStore.emit('action:cancel');
                break;
                
            // Phase2: 拡張アクション（封印解除時実装）
            /*
            case 'copy':
                this.eventStore.emit('edit:copy');
                break;
                
            case 'paste':
                this.eventStore.emit('edit:paste');
                break;
                
            case 'selectAll':
                this.eventStore.emit('selection:all');
                break;
                
            case 'deselect':
                this.eventStore.emit('selection:clear');
                break;
                
            case 'eyedropper':
                this.engine.setTool('eyedropper');
                this.eventStore.emit(this.eventStore.eventTypes.TOOL_CHANGE, { tool: 'eyedropper' });
                break;
                
            case 'bucketFill':
                this.engine.setTool('bucketFill');
                this.eventStore.emit(this.eventStore.eventTypes.TOOL_CHANGE, { tool: 'bucketFill' });
                break;
                
            case 'selectTool':
                this.engine.setTool('select');
                this.eventStore.emit(this.eventStore.eventTypes.TOOL_CHANGE, { tool: 'select' });
                break;
                
            case 'decreaseBrushSize':
                this.eventStore.emit('tool:size:decrease');
                break;
                
            case 'increaseBrushSize':
                this.eventStore.emit('tool:size:increase');
                break;
            */
            
            default:
                console.warn(`🚨 未実装アクション: ${action}`);
        }
    }
    
    /**