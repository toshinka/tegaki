/**
 * ショートカット制御 v3.2
 * キーボードショートカット統一管理・PixiJS統合・デスクトップ最適化
 * 規約: 総合AIコーディング規約v4.1準拠（PixiJS統一座標対応）
 */

/**
 * ショートカット制御クラス
 * キーボードショートカット・ホットキー・アクセシビリティ対応
 */
export class ShortcutController {
    constructor(eventStore) {
        this.eventStore = eventStore;
        
        // ショートカット登録マップ
        this.shortcuts = new Map();
        this.sequences = new Map(); // キーシーケンス対応
        
        // キー状態管理
        this.keyStates = new Map();
        this.modifierStates = {
            ctrl: false,
            shift: false,
            alt: false,
            meta: false
        };
        
        // シーケンス入力管理
        this.sequenceBuffer = [];
        this.sequenceTimeout = null;
        this.sequenceTimeoutMs = 1000;
        
        // 統計・デバッグ
        this.stats = {
            totalShortcuts: 0,
            triggeredShortcuts: 0,
            failedShortcuts: 0,
            sequences: 0
        };
        
        // Phase段階対応
        this.phase1Ready = false;
        
        this.isReady = false;
        this.initialize();
    }
    
    /**
     * ショートカット制御初期化
     */
    initialize() {
        try {
            console.log('⌨️ ショートカット制御初期化開始');
            
            // EventStore連携設定
            this.setupEventStoreIntegration();
            
            // Phase1基本ショートカット登録
            this.registerPhase1Shortcuts();
            
            // キーボードイベント設定
            this.setupKeyboardEvents();
            
            // アクセシビリティ対応設定
            this.setupAccessibility();
            
            this.phase1Ready = true;
            this.isReady = true;
            
            console.log('✅ ショートカット制御初期化完了');
            this.showRegisteredShortcuts();
            
        } catch (error) {
            console.error('❌ ショートカット制御初期化エラー:', error);
        }
    }
    
    /**
     * EventStore連携設定
     */
    setupEventStoreIntegration() {
        // 入力イベント購読
        this.eventStore.on('input:key:down', (data) => {
            this.handleKeyDown(data);
        });
        
        this.eventStore.on('input:key:up', (data) => {
            this.handleKeyUp(data);
        });
        
        console.log('📡 EventStore連携設定完了');
    }
    
    /**
     * Phase1基本ショートカット登録
     */
    registerPhase1Shortcuts() {
        // システム・基本操作
        this.register('Ctrl+Z', 'history:undo', '元に戻す');
        this.register('Ctrl+Y', 'history:redo', 'やり直し');
        this.register('Ctrl+Shift+Z', 'history:redo', 'やり直し（代替）');
        
        // ビュー操作（PixiJS統一座標対応）
        this.register('Ctrl+0', 'viewport:reset', 'ビューリセット');
        this.register('Ctrl++', 'viewport:zoom:in', 'ズームイン');
        this.register('Ctrl+-', 'viewport:zoom:out', 'ズームアウト');
        this.register('Space', 'viewport:pan:mode', 'パンモード切り替え', { 
            keydown: true, 
            keyup: true 
        });
        
        // キャンバス操作
        this.register('Delete', 'draw:clear:selection', '選択範囲削除');
        this.register('Escape', 'action:cancel', 'キャンセル');
        this.register('Enter', 'action:confirm', '確定');
        
        // PixiJS統一座標デバッグ
        if (process.env.NODE_ENV === 'development') {
            this.register('Ctrl+Shift+D', 'debug:toggle', 'デバッグ表示切り替え');
            this.register('Ctrl+Shift+G', 'debug:grid:toggle', 'グリッド表示切り替え');
            this.register('Ctrl+Shift+P', 'debug:performance', 'パフォーマンス表示');
        }
        
        // 🎨 Phase2: ツール・UI ショートカット予約（封印中）
        /*
        this.register('B', 'tool:select:brush', 'ブラシツール');     // 🔒Phase2解封
        this.register('P', 'tool:select:pen', 'ペンツール');         // 🔒Phase2解封
        this.register('E', 'tool:select:eraser', '消しゴムツール');   // 🔒Phase2解封
        this.register('V', 'tool:select:move', '移動ツール');        // 🔒Phase2解封
        this.register('L', 'layer:new', '新規レイヤー');             // 🔒Phase2解封
        this.register('Ctrl+L', 'layer:duplicate', 'レイヤー複製');  // 🔒Phase2解封
        */
        
        console.log(`⌨️ Phase1基本ショートカット登録完了: ${this.shortcuts.size}件`);
    }
    
    /**
     * キーボードイベント設定
     */
    setupKeyboardEvents() {
        // グローバルキーイベント監視
        document.addEventListener('keydown', (event) => {
            this.handleRawKeyDown(event);
        }, { capture: true });
        
        document.addEventListener('keyup', (event) => {
            this.handleRawKeyUp(event);
        }, { capture: true });
        
        // フォーカス管理
        document.addEventListener('focusin', () => {
            this.resetKeyStates();
        });
        
        document.addEventListener('focusout', () => {
            this.resetKeyStates();
        });
        
        // ページ離脱時の状態リセット
        window.addEventListener('beforeunload', () => {
            this.resetKeyStates();
        });
        
        console.log('⌨️ キーボードイベント設定完了');
    }
    
    /**
     * アクセシビリティ対応設定
     */
    setupAccessibility() {
        // Sticky Keys対応
        this.stickyKeysEnabled = false;
        
        // ショートカットヘルプ機能
        this.register('F1', 'help:shortcuts', 'ショートカットヘルプ');
        this.register('Ctrl+/', 'help:shortcuts', 'ショートカットヘルプ（代替）');
        
        console.log('♿ アクセシビリティ対応設定完了');
    }
    
    /**
     * ショートカット登録
     */
    register(keyCombo, action, description = '', options = {}) {
        try {
            const normalizedCombo = this.normalizeKeyCombo(keyCombo);
            
            if (this.shortcuts.has(normalizedCombo)) {
                console.warn(`⚠️ ショートカット重複: ${keyCombo} -> ${action}`);
            }
            
            this.shortcuts.set(normalizedCombo, {
                action: action,
                description: description,
                keyCombo: keyCombo,
                normalizedCombo: normalizedCombo,
                options: {
                    preventDefault: options.preventDefault !== false,
                    stopPropagation: options.stopPropagation !== false,
                    keydown: options.keydown !== false,
                    keyup: options.keyup === true,
                    repeat: options.repeat === true,
                    ...options
                },
                stats: {
                    registered: Date.now(),
                    triggered: 0,
                    lastTriggered: null
                }
            });
            
            this.stats.totalShortcuts++;
            
            if (process.env.NODE_ENV === 'development') {
                console.debug(`⌨️ ショートカット登録: ${keyCombo} -> ${action}`);
            }
            
            return true;
            
        } catch (error) {
            console.error('❌ ショートカット登録エラー:', error);
            return false;
        }
    }
    
    /**
     * キーコンビネーション正規化
     */
    normalizeKeyCombo(keyCombo) {
        const parts = keyCombo.toLowerCase()
            .split('+')
            .map(part => part.trim())
            .sort((a, b) => {
                // 修飾キー順序統一: ctrl, shift, alt, meta, キー
                const order = { 'ctrl': 1, 'shift': 2, 'alt': 3, 'meta': 4 };
                return (order[a] || 5) - (order[b] || 5);
            });
        
        return parts.join('+');
    }
    
    /**
     * 生キーダウンイベント処理
     */
    handleRawKeyDown(event) {
        try {
            // 修飾キー状態更新
            this.updateModifierStates(event);
            
            // キー状態記録
            this.keyStates.set(event.code, {
                key: event.key,
                code: event.code,
                timestamp: Date.now(),
                repeat: event.repeat
            });
            
            // ショートカット判定
            const currentCombo = this.getCurrentKeyCombo(event);
            if (currentCombo) {
                this.checkAndTriggerShortcut(currentCombo, event, 'keydown');
            }
            
        } catch (error) {
            console.error('❌ 生キーダウン処理エラー:', error);
        }
    }
    
    /**
     * 生キーアップイベント処理
     */
    handleRawKeyUp(event) {
        try {
            // 修飾キー状態更新
            this.updateModifierStates(event);
            
            // キー状態削除
            this.keyStates.delete(event.code);
            
            // キーアップ対応ショートカット判定
            const currentCombo = this.getCurrentKeyCombo(event);
            if (currentCombo) {
                this.checkAndTriggerShortcut(currentCombo, event, 'keyup');
            }
            
        } catch (error) {
            console.error('❌ 生キーアップ処理エラー:', error);
        }
    }
    
    /**
     * EventStore経由キーダウン処理
     */
    handleKeyDown(keyData) {
        // シーケンス入力処理
        this.processKeySequence(keyData);
    }
    
    /**
     * EventStore経由キーアップ処理
     */
    handleKeyUp(keyData) {
        // 現在はキーダウンのみでショートカット判定
    }
    
    /**
     * 修飾キー状態更新
     */
    updateModifierStates(event) {
        this.modifierStates.ctrl = event.ctrlKey;
        this.modifierStates.shift = event.shiftKey;
        this.modifierStates.alt = event.altKey;
        this.modifierStates.meta = event.metaKey;
    }
    
    /**
     * 現在のキーコンビネーション取得
     */
    getCurrentKeyCombo(event) {
        const parts = [];
        
        if (event.ctrlKey) parts.push('ctrl');
        if (event.shiftKey) parts.push('shift');
        if (event.altKey) parts.push('alt');
        if (event.metaKey) parts.push('meta');
        
        // メインキー追加
        const mainKey = this.normalizeKey(event.key);
        if (mainKey) {
            parts.push(mainKey);
        }
        
        return parts.length > 0 ? parts.join('+') : null;
    }
    
    /**
     * キー名正規化
     */
    normalizeKey(key) {
        const keyMap = {
            ' ': 'space',
            'ArrowUp': 'up',
            'ArrowDown': 'down',
            'ArrowLeft': 'left',
            'ArrowRight': 'right',
            'Backspace': 'backspace',
            'Tab': 'tab',
            'Enter': 'enter',
            'Escape': 'escape',
            'Delete': 'delete'
        };
        
        return keyMap[key] || key.toLowerCase();
    }
    
    /**
     * ショートカット判定・実行
     */
    checkAndTriggerShortcut(keyCombo, event, eventType) {
        const shortcut = this.shortcuts.get(keyCombo);
        
        if (!shortcut) {
            return false;
        }
        
        // イベントタイプチェック
        if (eventType === 'keydown' && !shortcut.options.keydown) {
            return false;
        }
        if (eventType === 'keyup' && !shortcut.options.keyup) {
            return false;
        }
        
        // リピート制御
        if (event.repeat && !shortcut.options.repeat) {
            return false;
        }
        
        try {
            // ブラウザデフォルト動作制御
            if (shortcut.options.preventDefault) {
                event.preventDefault();
            }
            if (shortcut.options.stopPropagation) {
                event.stopPropagation();
            }
            
            // ショートカット実行
            this.executeShortcut(shortcut, event);
            
            return true;
            
        } catch (error) {
            console.error('❌ ショートカット実行エラー:', error);
            this.stats.failedShortcuts++;
            return false;
        }
    }
    
    /**
     * ショートカット実行
     */
    executeShortcut(shortcut, event) {
        // 統計更新
        shortcut.stats.triggered++;
        shortcut.stats.lastTriggered = Date.now();
        this.stats.triggeredShortcuts++;
        
        // EventStore経由でアクション発信
        this.eventStore.emit('shortcut:triggered', {
            action: shortcut.action,
            keyCombo: shortcut.keyCombo,
            description: shortcut.description,
            event: {
                key: event.key,
                code: event.code,
                modifiers: { ...this.modifierStates }
            },
            timestamp: Date.now()
        });
        
        // 直接アクション発信
        this.eventStore.emit(shortcut.action, {
            source: 'shortcut',
            keyCombo: shortcut.keyCombo,
            event: event
        });
        
        console.log(`⌨️ ショートカット実行: ${shortcut.keyCombo} -> ${shortcut.action}`);
    }
    
    /**
     * キーシーケンス処理（将来拡張用）
     */
    processKeySequence(keyData) {
        // シーケンス入力バッファ管理
        this.sequenceBuffer.push({
            key: keyData.key,
            timestamp: Date.now()
        });
        
        // タイムアウト管理
        if (this.sequenceTimeout) {
            clearTimeout(this.sequenceTimeout);
        }
        
        this.sequenceTimeout = setTimeout(() => {
            this.sequenceBuffer = [];
        }, this.sequenceTimeoutMs);
        
        // シーケンス判定（現在は未実装）
        // this.checkKeySequences();
    }
    
    /**
     * 全キー状態リセット
     */
    resetKeyStates() {
        this.keyStates.clear();
        this.modifierStates = {
            ctrl: false,
            shift: false,
            alt: false,
            meta: false
        };
        this.sequenceBuffer = [];
        
        if (this.sequenceTimeout) {
            clearTimeout(this.sequenceTimeout);
            this.sequenceTimeout = null;
        }
    }
    
    /**
     * ショートカット削除
     */
    unregister(keyCombo) {
        const normalizedCombo = this.normalizeKeyCombo(keyCombo);
        const success = this.shortcuts.delete(normalizedCombo);
        
        if (success) {
            this.stats.totalShortcuts--;
            console.log(`⌨️ ショートカット削除: ${keyCombo}`);
        }
        
        return success;
    }
    
    /**
     * 登録済みショートカット表示
     */
    showRegisteredShortcuts() {
        if (process.env.NODE_ENV === 'development') {
            console.group('⌨️ 登録済みショートカット一覧');
            
            Array.from(this.shortcuts.entries())
                .sort(([a], [b]) => a.localeCompare(b))
                .forEach(([combo, shortcut]) => {
                    console.log(`${combo.padEnd(20)} -> ${shortcut.action.padEnd(25)} (${shortcut.description})`);
                });
            
            console.groupEnd();
        }
    }
    
    /**
     * ショートカットヘルプ表示
     */
    showShortcutHelp() {
        const helpData = Array.from(this.shortcuts.entries())
            .filter(([, shortcut]) => shortcut.description)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([combo, shortcut]) => ({
                keyCombo: shortcut.keyCombo,
                description: shortcut.description,
                action: shortcut.action
            }));
        
        // EventStore経由でヘルプ表示要求
        this.eventStore.emit('help:show', {
            type: 'shortcuts',
            data: helpData
        });
        
        console.table(helpData);
    }
    
    /**
     * 🎨 Phase2: ツールショートカット準備（封印中）
     */
    /*
    registerPhase2Shortcuts() {                 // 🔒Phase2解封
        // ツール選択
        this.register('B', 'tool:select:brush', 'ブラシツール');
        this.register('P', 'tool:select:pen', 'ペンツール');
        this.register('E', 'tool:select:eraser', '消しゴムツール');
        this.register('V', 'tool:select:move', '移動ツール');
        this.register('S', 'tool:select:select', '選択ツール');
        this.register('G', 'tool:select:bucket', '塗りつぶしツール');
        this.register('I', 'tool:select:eyedropper', 'スポイトツール');
        
        // レイヤー操作
        this.register('Ctrl+Shift+N', 'layer:new', '新規レイヤー');
        this.register('Ctrl+L', 'layer:duplicate', 'レイヤー複製');
        this.register('Ctrl+E', 'layer:merge:down', '下のレイヤーと結合');
        this.register('Ctrl+Shift+E', 'layer:merge:visible', '表示レイヤーを結合');
        
        // UI表示切り替え
        this.register('Tab', 'ui:toggle:panels', 'パネル表示切り替え');
        this.register('F', 'ui:toggle:fullscreen', 'フルスクリーン切り替え');
        
        console.log('🎨 Phase2ショートカット登録完了');
    }
    */
    
    /**
     * ⚡ Phase3: 高度機能ショートカット準備（封印中）
     */
    /*
    registerPhase3Shortcuts() {                 // 🔒Phase3解封
        // アニメーション制御
        this.register('Space', 'animation:play:pause', 'アニメーション再生/停止');
        this.register('Home', 'animation:goto:first', '最初のフレーム');
        this.register('End', 'animation:goto:last', '最後のフレーム');
        this.register('PageUp', 'animation:prev:frame', '前のフレーム');
        this.register('PageDown', 'animation:next:frame', '次のフレーム');
        
        // エクスポート
        this.register('Ctrl+Shift+E', 'export:image', '画像エクスポート');
        this.register('Ctrl+Shift+V', 'export:video', '動画エクスポート');
        
        // プロジェクト管理
        this.register('Ctrl+S', 'project:save', 'プロジェクト保存');
        this.register('Ctrl+O', 'project:open', 'プロジェクト開く');
        this.register('Ctrl+N', 'project:new', '新規プロジェクト');
        
        console.log('⚡ Phase3ショートカット登録完了');
    }
    */
    
    /**
     * 統計情報取得
     */
    getStats() {
        return {
            ...this.stats,
            registeredShortcuts: this.shortcuts.size,
            keyStates: this.keyStates.size,
            modifierStates: { ...this.modifierStates },
            sequenceBuffer: this.sequenceBuffer.length
        };
    }
    
    /**
     * システム情報取得
     */
    getInfo() {
        return {
            system: 'ショートカット制御システム',
            totalShortcuts: this.shortcuts.size,
            phase1Ready: this.phase1Ready,
            features: {
                keySequences: 'planned',
                stickyKeys: this.stickyKeysEnabled,
                accessibility: true,
                customizable: 'planned'
            },
            ready: this.isReady
        };
    }
    
    /**
     * ショートカット検索
     */
    findShortcut(query) {
        const results = [];
        
        for (const [combo, shortcut] of this.shortcuts) {
            if (combo.includes(query.toLowerCase()) ||
                shortcut.action.includes(query.toLowerCase()) ||
                shortcut.description.toLowerCase().includes(query.toLowerCase())) {
                results.push({
                    keyCombo: shortcut.keyCombo,
                    action: shortcut.action,
                    description: shortcut.description
                });
            }
        }
        
        return results;
    }
    
    /**
     * カスタムショートカット設定（将来実装用）
     */
    setCustomShortcut(keyCombo, action, description = '') {
        // 既存ショートカットとの競合チェック
        const normalizedCombo = this.normalizeKeyCombo(keyCombo);
        
        if (this.shortcuts.has(normalizedCombo)) {
            console.warn(`⚠️ カスタムショートカット競合: ${keyCombo}`);
            return false;
        }
        
        return this.register(keyCombo, action, description, { custom: true });
    }
    
    /**
     * ショートカット無効化/有効化
     */
    setEnabled(enabled) {
        this.enabled = enabled;
        
        if (!enabled) {
            this.resetKeyStates();
        }
        
        console.log(`⌨️ ショートカット制御: ${enabled ? '有効' : '無効'}`);
    }
    
    /**
     * 特定アクションのショートカット取得
     */
    getShortcutForAction(action) {
        for (const [combo, shortcut] of this.shortcuts) {
            if (shortcut.action === action) {
                return {
                    keyCombo: shortcut.keyCombo,
                    description: shortcut.description
                };
            }
        }
        return null;
    }
    
    /**
     * デバッグ情報表示
     */
    showDebugInfo() {
        console.group('⌨️ ショートカット制御 デバッグ情報');
        console.log('統計:', this.getStats());
        console.log('現在のキー状態:', Array.from(this.keyStates.entries()));
        console.log('修飾キー状態:', this.modifierStates);
        console.log('最近のシーケンス:', this.sequenceBuffer);
        console.groupEnd();
    }
    
    /**
     * パフォーマンステスト
     */
    performanceTest() {
        const testCombos = ['ctrl+z', 'ctrl+y', 'ctrl+s', 'space', 'escape'];
        const startTime = performance.now();
        
        for (let i = 0; i < 1000; i++) {
            testCombos.forEach(combo => {
                this.normalizeKeyCombo(combo);
                this.shortcuts.has(combo);
            });
        }
        
        const endTime = performance.now();
        const duration = endTime - startTime;
        
        console.log(`⚡ ショートカット処理性能: ${Math.round(duration)}ms (1000回×5種類)`);
        return duration;
    }
    
    /**
     * 準備状態確認
     */
    isReady() {
        return this.isReady && this.eventStore;
    }
    
    /**
     * 破棄処理
     */
    destroy() {
        try {
            // タイマークリア
            if (this.sequenceTimeout) {
                clearTimeout(this.sequenceTimeout);
            }
            
            // 状態リセット
            this.resetKeyStates();
            this.shortcuts.clear();
            
            console.log('⌨️ ショートカット制御破棄完了');
            
        } catch (error) {
            console.error('❌ ショートカット制御破棄エラー:', error);
        }
    }
}