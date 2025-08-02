/**
 * ショートカット制御・詳細キー対応
 * モダンお絵かきツール v3.3 - Phase1キーボード統合システム
 * 
 * 機能:
 * - 詳細ショートカットキー・組み合わせ対応
 * - ツール切り替え・サイズ調整・アニメーション制御
 * - EventStore統合・カスタマイズ可能設定
 * - PixiJS v8連携・DOM競合回避
 * - エアスプレー専用ショートカット（v3.3新機能）
 */

/**
 * ショートカット制御
 * 詳細キー組み合わせ・EventStore統合・設定管理
 */
class ShortcutController {
    constructor(eventStore) {
        this.eventStore = eventStore;
        
        // キー状態管理
        this.pressedKeys = new Set();
        this.keySequence = [];
        this.sequenceTimeout = null;
        this.sequenceTimeoutDelay = 1000; // 1秒
        
        // ショートカット設定（v3.3完全版）
        this.shortcuts = {
            // 基本操作
            'ctrl+z': { action: 'undo', description: 'アンドゥ' },
            'ctrl+y': { action: 'redo', description: 'リドゥ' },
            'ctrl+shift+z': { action: 'redo', description: 'リドゥ（代替）' },
            'delete': { action: 'clear-layer', description: 'レイヤー内消去' },
            'ctrl+0': { action: 'reset-view', description: 'ビューリセット' },
            
            // キャンバス操作
            'space': { action: 'pan-mode', description: '移動モード', type: 'hold' },
            'arrowup': { action: 'canvas-up', description: 'キャンバス上移動' },
            'arrowdown': { action: 'canvas-down', description: 'キャンバス下移動' },
            'arrowleft': { action: 'canvas-left', description: 'キャンバス左移動' },
            'arrowright': { action: 'canvas-right', description: 'キャンバス右移動' },
            'shift+arrowup': { action: 'canvas-rotate-ccw', description: 'キャンバス反時計回り' },
            'shift+arrowdown': { action: 'canvas-rotate-cw', description: 'キャンバス時計回り' },
            'shift+arrowleft': { action: 'canvas-zoom-out', description: 'キャンバス縮小' },
            'shift+arrowright': { action: 'canvas-zoom-in', description: 'キャンバス拡大' },
            'h': { action: 'canvas-flip-h', description: 'キャンバス左右反転' },
            'shift+h': { action: 'canvas-flip-v', description: 'キャンバス上下反転' },
            
            // レイヤー操作
            'arrowup+layer': { action: 'layer-up', description: 'レイヤー上移動', prefix: true },
            'arrowdown+layer': { action: 'layer-down', description: 'レイヤー下移動', prefix: true },
            'shift+arrowup+layer': { action: 'folder-up', description: 'フォルダ上移動', prefix: true },
            'shift+arrowdown+layer': { action: 'folder-down', description: 'フォルダ下移動', prefix: true },
            
            // レイヤー内絵画操作
            'v': { action: 'layer-content-mode', description: 'レイヤー内容操作モード', type: 'hold' },
            'v+drag': { action: 'layer-content-move', description: 'レイヤー内容移動', combo: true },
            'v+shift+space': { action: 'layer-content-transform', description: 'レイヤー内容変形', combo: true },
            'v+h': { action: 'layer-content-flip-h', description: 'レイヤー内容左右反転', combo: true },
            'v+shift+h': { action: 'layer-content-flip-v', description: 'レイヤー内容上下反転', combo: true },
            
            // ツール切り替え
            'p': { action: 'tool-pen', description: 'ペンツール' },
            'e': { action: 'tool-eraser', description: '消しゴムツール' },
            'a': { action: 'tool-airbrush', description: 'エアスプレーツール（v3.3新機能）' },
            'b': { action: 'tool-blur', description: 'ボカシツール' },
            'i': { action: 'tool-eyedropper', description: 'スポイトツール' },
            'g': { action: 'tool-fill', description: '塗りつぶしツール' },
            'm': { action: 'tool-select', description: '範囲選択ツール' },
            't': { action: 'tool-text', description: 'テキストツール' },
            
            // ツールサイズ調整
            'p+[': { action: 'pen-size-decrease', description: 'ペンサイズ縮小', combo: true },
            'p+]': { action: 'pen-size-increase', description: 'ペンサイズ拡大', combo: true },
            'e+[': { action: 'eraser-size-decrease', description: '消しゴムサイズ縮小', combo: true },
            'e+]': { action: 'eraser-size-increase', description: '消しゴムサイズ拡大', combo: true },
            'a+[': { action: 'airbrush-size-decrease', description: 'エアスプレーサイズ縮小', combo: true },
            'a+]': { action: 'airbrush-size-increase', description: 'エアスプレーサイズ拡大', combo: true },
            'b+[': { action: 'blur-size-decrease', description: 'ボカシサイズ縮小', combo: true },
            'b+]': { action: 'blur-size-increase', description: 'ボカシサイズ拡大', combo: true },
            
            // UI操作
            'tab': { action: 'toggle-panels', description: 'パネル表示切り替え' },
            'escape': { action: 'close-popups', description: '全ポップアップ閉じる' },
            'ctrl+alt+r': { action: 'reset-panel-positions', description: 'パネル位置リセット' },
            
            // アニメーション専用（Phase3準備）
            'alt+arrowleft': { action: 'anim-frame-prev', description: '前フレーム' },
            'alt+arrowright': { action: 'anim-frame-next', description: '次フレーム' },
            'shift+alt+arrowleft': { action: 'anim-cut-prev-5', description: '5カット戻る' },
            'shift+alt+arrowright': { action: 'anim-cut-next-5', description: '5カット進む' },
            'alt+space': { action: 'anim-play-pause', description: '再生/停止' },
            'alt+j': { action: 'anim-shuttle-back', description: 'シャトル戻し' },
            'alt+l': { action: 'anim-shuttle-forward', description: 'シャトル送り' },
            'alt+o': { action: 'anim-onion-toggle', description: 'オニオンスキン切り替え' },
            'alt+o+1': { action: 'anim-onion-cut', description: 'カットオニオンスキン', combo: true },
            'alt+o+2': { action: 'anim-onion-folder', description: 'フォルダオニオンスキン', combo: true },
            'alt+o+3': { action: 'anim-onion-layer', description: 'レイヤーオニオンスキン', combo: true },
            'alt+s': { action: 'anim-sync-toggle', description: '同期モード切り替え' },
            'ctrl+plus': { action: 'timeline-zoom-in', description: 'タイムライン拡大' },
            'ctrl+minus': { action: 'timeline-zoom-out', description: 'タイムライン縮小' }
        };
        
        // カスタマイズ可能設定
        this.settings = {
            enabled: true,
            sequenceEnabled: true,
            preventDefaults: [
                'ctrl+z', 'ctrl+y', 'ctrl+s', 'ctrl+o', 'tab', 'space'
            ],
            customizable: true
        };
        
        // コンボ状態管理
        this.comboState = {
            active: null,
            startTime: null,
            timeout: 2000 // 2秒
        };
        
        this.initializeEventListeners();
        this.setupEventStoreIntegration();
        
        console.log('✅ ShortcutController初期化完了 - 詳細ショートカット対応');
    }
    
    /**
     * イベントリスナー初期化
     * DOM統合・PixiJS v8競合回避
     */
    initializeEventListeners() {
        document.addEventListener('keydown', this.handleKeyDown.bind(this), true);
        document.addEventListener('keyup', this.handleKeyUp.bind(this), true);
        
        // フォーカス管理（PixiJS Canvas優先）
        document.addEventListener('focusin', this.handleFocusChange.bind(this));
        document.addEventListener('focusout', this.handleFocusChange.bind(this));
        
        console.log('⌨️ ショートカットイベントリスナー設定完了');
    }
    
    /**
     * EventStore統合設定
     * イベント連携・アクション実行
     */
    setupEventStoreIntegration() {
        // アクション実行結果監視
        this.eventStore.on('shortcut-executed', (data) => {
            console.log(`⌨️ ショートカット実行: ${data.shortcut} → ${data.action}`);
        });
        
        // エラー監視
        this.eventStore.on('shortcut-error', (data) => {
            console.error(`❌ ショートカットエラー: ${data.shortcut}`, data.error);
        });
    }
    
    /**
     * キー押下処理
     * 組み合わせ判定・シーケンス管理・アクション実行
     */
    handleKeyDown(event) {
        if (!this.settings.enabled) return;
        
        const key = this.normalizeKey(event);
        
        // 入力フィールド判定（除外処理）
        if (this.isInputElement(event.target)) {
            return;
        }
        
        // キー状態更新
        this.pressedKeys.add(key);
        
        // シーケンス更新
        if (this.settings.sequenceEnabled) {
            this.updateKeySequence(key);
        }
        
        // ショートカット判定・実行
        const shortcut = this.detectShortcut();
        if (shortcut) {
            this.executeShortcut(shortcut, event);
        }
        
        // コンボ状態管理
        this.updateComboState(key);
    }
    
    /**
     * キー離上処理
     * ホールド系ショートカット・コンボ終了
     */
    handleKeyUp(event) {
        if (!this.settings.enabled) return;
        
        const key = this.normalizeKey(event);
        
        // キー状態更新
        this.pressedKeys.delete(key);
        
        // ホールド系ショートカット終了
        this.handleHoldShortcutEnd(key);
        
        // コンボ終了判定
        this.checkComboEnd();
    }
    
    /**
     * キー正規化
     * ブラウザ差異吸収・統一形式
     */
    normalizeKey(event) {
        let key = event.key.toLowerCase();
        
        // 修飾キー統一
        const modifiers = [];
        if (event.ctrlKey) modifiers.push('ctrl');
        if (event.shiftKey) modifiers.push('shift');
        if (event.altKey) modifiers.push('alt');
        if (event.metaKey) modifiers.push('meta');
        
        // 特殊キー名統一
        const keyMap = {
            ' ': 'space',
            'escape': 'escape',
            'delete': 'delete',
            'backspace': 'backspace',
            'enter': 'enter',
            'tab': 'tab'
        };
        
        key = keyMap[key] || key;
        
        // 修飾キー組み合わせ
        if (modifiers.length > 0) {
            return modifiers.join('+') + '+' + key;
        }
        
        return key;
    }
    
    /**
     * ショートカット検出
     * 現在の押下キー状態から該当ショートカット判定
     */
    detectShortcut() {
        const pressedArray = Array.from(this.pressedKeys).sort();
        const pressedString = pressedArray.join('+');
        
        // 完全一致検索
        if (this.shortcuts[pressedString]) {
            return pressedString;
        }
        
        // 部分一致検索（コンボ系）
        for (const shortcut in this.shortcuts) {
            if (this.shortcuts[shortcut].combo && pressedString.includes(shortcut.split('+')[0])) {
                return shortcut;
            }
        }
        
        // シーケンス検索
        if (this.settings.sequenceEnabled) {
            const sequenceString = this.keySequence.join(' ');
            for (const shortcut in this.shortcuts) {
                if (shortcut.includes(' ') && sequenceString.endsWith(shortcut)) {
                    return shortcut;
                }
            }
        }
        
        return null;
    }
    
    /**
     * ショートカット実行
     * アクション実行・イベント発行・preventDefault
     */
    executeShortcut(shortcut, event) {
        const config = this.shortcuts[shortcut];
        if (!config) return;
        
        try {
            // preventDefault判定
            if (this.settings.preventDefaults.includes(shortcut)) {
                event.preventDefault();
                event.stopPropagation();
            }
            
            // アクション実行
            this.performAction(config.action, shortcut, event);
            
            // EventStore通知
            this.eventStore.emit('shortcut-executed', {
                shortcut: shortcut,
                action: config.action,
                description: config.description,
                timestamp: Date.now()
            });
            
        } catch (error) {
            this.eventStore.emit('shortcut-error', {
                shortcut: shortcut,
                action: config.action,
                error: error.message,
                timestamp: Date.now()
            });
        }
    }
    
    /**
     * アクション実行
     * 具体的な機能実行・EventStore連携
     */
    performAction(action, shortcut, event) {
        switch (action) {
            // 基本操作
            case 'undo':
                this.eventStore.emit('history-action', { type: 'undo' });
                break;
            case 'redo':
                this.eventStore.emit('history-action', { type: 'redo' });
                break;
            case 'clear-layer':
                this.eventStore.emit('layer-clear', { target: 'active' });
                break;
            case 'reset-view':
                this.eventStore.emit('canvas-reset-view', {});
                break;
                
            // キャンバス操作
            case 'pan-mode':
                this.eventStore.emit('tool-changed', { tool: 'pan', temporary: true });
                break;
            case 'canvas-up':
                this.eventStore.emit('canvas-move', { direction: 'up', amount: 10 });
                break;
            case 'canvas-down':
                this.eventStore.emit('canvas-move', { direction: 'down', amount: 10 });
                break;
            case 'canvas-left':
                this.eventStore.emit('canvas-move', { direction: 'left', amount: 10 });
                break;
            case 'canvas-right':
                this.eventStore.emit('canvas-move', { direction: 'right', amount: 10 });
                break;
            case 'canvas-flip-h':
                this.eventStore.emit('canvas-flip', { axis: 'horizontal' });
                break;
            case 'canvas-flip-v':
                this.eventStore.emit('canvas-flip', { axis: 'vertical' });
                break;
                
            // ツール切り替え
            case 'tool-pen':
                this.eventStore.emit('tool-changed', { tool: 'pen' });
                break;
            case 'tool-eraser':
                this.eventStore.emit('tool-changed', { tool: 'eraser' });
                break;
            case 'tool-airbrush':
                this.eventStore.emit('tool-changed', { tool: 'airbrush' });
                break;
            case 'tool-blur':
                this.eventStore.emit('tool-changed', { tool: 'blur' });
                break;
            case 'tool-eyedropper':
                this.eventStore.emit('tool-changed', { tool: 'eyedropper' });
                break;
            case 'tool-fill':
                this.eventStore.emit('tool-changed', { tool: 'fill' });
                break;
            case 'tool-select':
                this.eventStore.emit('tool-changed', { tool: 'select' });
                break;
            case 'tool-text':
                this.eventStore.emit('tool-changed', { tool: 'text' });
                break;
                
            // ツールサイズ調整
            case 'pen-size-decrease':
                this.eventStore.emit('tool-config-updated', { tool: 'pen', property: 'size', delta: -1 });
                break;
            case 'pen-size-increase':
                this.eventStore.emit('tool-config-updated', { tool: 'pen', property: 'size', delta: 1 });
                break;
            case 'eraser-size-decrease':
                this.eventStore.emit('tool-config-updated', { tool: 'eraser', property: 'size', delta: -2 });
                break;
            case 'eraser-size-increase':
                this.eventStore.emit('tool-config-updated', { tool: 'eraser', property: 'size', delta: 2 });
                break;
            case 'airbrush-size-decrease':
                this.eventStore.emit('airbrush-settings-change', { property: 'radius', delta: -5 });
                break;
            case 'airbrush-size-increase':
                this.eventStore.emit('airbrush-settings-change', { property: 'radius', delta: 5 });
                break;
            case 'blur-size-decrease':
                this.eventStore.emit('tool-config-updated', { tool: 'blur', property: 'size', delta: -2 });
                break;
            case 'blur-size-increase':
                this.eventStore.emit('tool-config-updated', { tool: 'blur', property: 'size', delta: 2 });
                break;
                
            // UI操作
            case 'toggle-panels':
                this.eventStore.emit('ui-panel-toggle', { target: 'configurable' });
                break;
            case 'close-popups':
                this.eventStore.emit('popup-hide', { target: 'all' });
                break;
            case 'reset-panel-positions':
                this.eventStore.emit('ui-panel-reset', { target: 'all' });
                break;
                
            // アニメーション操作（Phase3準備）
            case 'anim-frame-prev':
                this.eventStore.emit('animation-frame-change', { direction: 'prev' });
                break;
            case 'anim-frame-next':
                this.eventStore.emit('animation-frame-change', { direction: 'next' });
                break;
            case 'anim-cut-prev-5':
                this.eventStore.emit('animation-frame-change', { direction: 'prev', amount: 5 });
                break;
            case 'anim-cut-next-5':
                this.eventStore.emit('animation-frame-change', { direction: 'next', amount: 5 });
                break;
            case 'anim-play-pause':
                this.eventStore.emit('animation-playback', { action: 'toggle' });
                break;
            case 'anim-onion-toggle':
                this.eventStore.emit('onion-skin-toggle', { target: 'all' });
                break;
            case 'anim-onion-cut':
                this.eventStore.emit('onion-skin-toggle', { target: 'cut' });
                break;
            case 'anim-onion-folder':
                this.eventStore.emit('onion-skin-toggle', { target: 'folder' });
                break;
            case 'anim-onion-layer':
                this.eventStore.emit('onion-skin-toggle', { target: 'layer' });
                break;
            case 'anim-sync-toggle':
                this.eventStore.emit('animation-sync-toggle', {});
                break;
                
            // レイヤー操作
            case 'layer-up':
                this.eventStore.emit('layer-navigation', { direction: 'up' });
                break;
            case 'layer-down':
                this.eventStore.emit('layer-navigation', { direction: 'down' });
                break;
            case 'folder-up':
                this.eventStore.emit('folder-navigation', { direction: 'up' });
                break;
            case 'folder-down':
                this.eventStore.emit('folder-navigation', { direction: 'down' });
                break;
                
            // レイヤー内容操作
            case 'layer-content-mode':
                this.eventStore.emit('layer-content-mode', { enabled: true });
                break;
            case 'layer-content-move':
                this.eventStore.emit('layer-content-transform', { type: 'move' });
                break;
            case 'layer-content-transform':
                this.eventStore.emit('layer-content-transform', { type: 'scale-rotate' });
                break;
            case 'layer-content-flip-h':
                this.eventStore.emit('layer-content-transform', { type: 'flip', axis: 'horizontal' });
                break;
            case 'layer-content-flip-v':
                this.eventStore.emit('layer-content-transform', { type: 'flip', axis: 'vertical' });
                break;
                
            default:
                console.warn(`⚠️ 未実装アクション: ${action}`);
        }
    }
    
    /**
     * キーシーケンス更新
     * 複数キー組み合わせ対応
     */
    updateKeySequence(key) {
        this.keySequence.push(key);
        
        // シーケンス長制限
        if (this.keySequence.length > 5) {
            this.keySequence.shift();
        }
        
        // タイムアウト設定
        if (this.sequenceTimeout) {
            clearTimeout(this.sequenceTimeout);
        }
        
        this.sequenceTimeout = setTimeout(() => {
            this.keySequence = [];
        }, this.sequenceTimeoutDelay);
    }
    
    /**
     * コンボ状態管理
     * ツール+キー組み合わせ対応
     */
    updateComboState(key) {
        const toolKeys = ['p', 'e', 'a', 'b', 'v'];
        
        if (toolKeys.includes(key)) {
            this.comboState.active = key;
            this.comboState.startTime = Date.now();
            
            // コンボタイムアウト
            setTimeout(() => {
                if (this.comboState.active === key) {
                    this.comboState.active = null;
                }
            }, this.comboState.timeout);
        }
    }
    
    /**
     * コンボ終了チェック
     */
    checkComboEnd() {
        if (this.comboState.active && this.pressedKeys.size === 0) {
            this.comboState.active = null;
        }
    }
    
    /**
     * ホールド系ショートカット終了処理
     */
    handleHoldShortcutEnd(key) {
        const holdShortcuts = {
            'space': 'pan-mode-end',
            'v': 'layer-content-mode-end'
        };
        
        if (holdShortcuts[key]) {
            this.eventStore.emit('shortcut-hold-end', {
                key: key,
                action: holdShortcuts[key],
                timestamp: Date.now()
            });
        }
    }
    
    /**
     * 入力要素判定
     * ショートカット除外対象判定
     */
    isInputElement(element) {
        const inputTypes = ['input', 'textarea', 'select'];
        const tagName = element.tagName.toLowerCase();
        
        if (inputTypes.includes(tagName)) {
            return true;
        }
        
        if (element.contentEditable === 'true') {
            return true;
        }
        
        return false;
    }
    
    /**
     * フォーカス変更処理
     */
    handleFocusChange(event) {
        // PixiJS Canvas以外にフォーカスが移った場合のクリア処理
        if (event.type === 'focusout' && !this.isPixiCanvas(event.relatedTarget)) {
            this.resetKeyState();
        }
    }
    
    /**
     * PixiJS Canvas判定
     */
    isPixiCanvas(element) {
        return element && element.id === 'pixi-canvas';
    }
    
    /**
     * キー状態リセット
     */
    resetKeyState() {
        this.pressedKeys.clear();
        this.keySequence = [];
        this.comboState.active = null;
        
        if (this.sequenceTimeout) {
            clearTimeout(this.sequenceTimeout);
        }
    }
    
    /**
     * ショートカット登録
     * 動的ショートカット追加・カスタマイズ
     */
    register(shortcut, action, description = '') {
        if (typeof action === 'string') {
            this.shortcuts[shortcut] = {
                action: action,
                description: description
            };
        } else if (typeof action === 'function') {
            // 関数直接登録
            this.shortcuts[shortcut] = {
                action: `custom-${Date.now()}`,
                description: description,
                handler: action
            };
        }
        
        console.log(`📝 ショートカット登録: ${shortcut} → ${action}`);
    }
    
    /**
     * ショートカット解除
     */
    unregister(shortcut) {
        if (this.shortcuts[shortcut]) {
            delete this.shortcuts[shortcut];
            console.log(`🗑️ ショートカット解除: ${shortcut}`);
        }
    }
    
    /**
     * ショートカット一覧取得
     */
    getShortcuts(category = null) {
        if (!category) {
            return { ...this.shortcuts };
        }
        
        const filtered = {};
        const categoryPrefixes = {
            'basic': ['ctrl+', 'delete', 'ctrl+0'],
            'canvas': ['space', 'arrow', 'h'],
            'tools': ['p', 'e', 'a', 'b', 'i', 'g', 'm', 't'],
            'ui': ['tab', 'escape', 'ctrl+alt'],
            'animation': ['alt+']
        };
        
        const prefixes = categoryPrefixes[category] || [];
        for (const shortcut in this.shortcuts) {
            if (prefixes.some(prefix => shortcut.startsWith(prefix))) {
                filtered[shortcut] = this.shortcuts[shortcut];
            }
        }
        
        return filtered;
    }
    
    /**
     * ショートカット設定更新
     */
    updateSettings(newSettings) {
        this.settings = {
            ...this.settings,
            ...newSettings
        };
        
        console.log('⚙️ ショートカット設定更新', newSettings);
    }
    
    /**
     * 設定保存（localStorage活用）
     */
    saveSettings() {
        try {
            const settingsData = {
                settings: this.settings,
                customShortcuts: this.getCustomShortcuts(),
                version: '3.3'
            };
            
            localStorage.setItem('shortcut-settings', JSON.stringify(settingsData));
            console.log('💾 ショートカット設定保存完了');
            
        } catch (error) {
            console.error('❌ ショートカット設定保存失敗:', error);
        }
    }
    
    /**
     * 設定読み込み
     */
    loadSettings() {
        try {
            const settingsData = localStorage.getItem('shortcut-settings');
            if (settingsData) {
                const parsed = JSON.parse(settingsData);
                
                this.settings = { ...this.settings, ...parsed.settings };
                
                // カスタムショートカット復元
                if (parsed.customShortcuts) {
                    Object.assign(this.shortcuts, parsed.customShortcuts);
                }
                
                console.log('📂 ショートカット設定読み込み完了');
            }
        } catch (error) {
            console.error('❌ ショートカット設定読み込み失敗:', error);
        }
    }
    
    /**
     * カスタムショートカット取得
     */
    getCustomShortcuts() {
        const custom = {};
        for (const shortcut in this.shortcuts) {
            if (this.shortcuts[shortcut].action.startsWith('custom-')) {
                custom[shortcut] = this.shortcuts[shortcut];
            }
        }
        return custom;
    }
    
    /**
     * デバッグ情報取得
     */
    getDebugInfo() {
        return {
            settings: { ...this.settings },
            pressedKeys: Array.from(this.pressedKeys),
            keySequence: [...this.keySequence],
            comboState: { ...this.comboState },
            shortcutCount: Object.keys(this.shortcuts).length,
            customShortcutCount: Object.keys(this.getCustomShortcuts()).length
        };
    }
    
    /**
     * ヘルプ表示用ショートカット一覧
     */
    getHelpText() {
        const categories = {
            '基本操作': this.getShortcuts('basic'),
            'キャンバス操作': this.getShortcuts('canvas'),
            'ツール切り替え': this.getShortcuts('tools'),
            'UI操作': this.getShortcuts('ui'),
            'アニメーション': this.getShortcuts('animation')
        };
        
        let helpText = 'ショートカットキー一覧\n\n';
        
        for (const [category, shortcuts] of Object.entries(categories)) {
            if (Object.keys(shortcuts).length === 0) continue;
            
            helpText += `【${category}】\n`;
            for (const [shortcut, config] of Object.entries(shortcuts)) {
                helpText += `  ${shortcut.toUpperCase()}: ${config.description}\n`;
            }
            helpText += '\n';
        }
        
        return helpText;
    }
    
    /**
     * リソース解放
     */
    destroy() {
        // イベントリスナー削除
        document.removeEventListener('keydown', this.handleKeyDown.bind(this));
        document.removeEventListener('keyup', this.handleKeyUp.bind(this));
        document.removeEventListener('focusin', this.handleFocusChange.bind(this));
        document.removeEventListener('focusout', this.handleFocusChange.bind(this));
        
        // タイマー削除
        if (this.sequenceTimeout) {
            clearTimeout(this.sequenceTimeout);
        }
        
        // 状態クリア
        this.resetKeyState();
        
        // 設定保存
        this.saveSettings();
        
        console.log('🗑️ ShortcutController リソース解放完了');
    }
}

export default ShortcutController;