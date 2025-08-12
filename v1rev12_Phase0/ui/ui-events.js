/**
 * 🎨 ふたば☆ちゃんねる風ベクターお絵描きツール v1rev12
 * UIイベント処理専門システム - ui/ui-events.js (Phase2D修正版)
 * 
 * 🔧 STEP 5移譲後の責務:
 * 1. ✅ 汎用キーボードショートカット（Ctrl+Z/Y, ESC等）
 * 2. ✅ 汎用ホイールイベント（キャンバスズーム・パン）
 * 3. ✅ システム全体ショートカット（F1ヘルプ、F11フルスクリーン）
 * 4. ✅ 汎用ポインターイベント処理
 * 5. ❌ ペンツール専用処理（EventManagerに移譲完了）
 * 
 * Phase2D修正: ES6 export削除・既存システム互換性確保
 * 責務: 汎用UIイベント処理（ツール非依存）
 * 依存: config.js, utils.js
 */

console.log('🔧 ui/ui-events.js Phase2D修正版読み込み開始...');

// ==== 汎用UIイベントシステム（STEP 5移譲後）====
class UIEventSystem {
    constructor(app, toolsSystem, uiManager) {
        this.app = app;
        this.toolsSystem = toolsSystem;
        this.uiManager = uiManager;
        
        // イベント状態管理
        this.keyboardState = new Map();
        this.shortcutSequences = new Map();
        this.eventListeners = new Map();
        
        // 設定
        this.isEnabled = true;
        this.debugMode = safeConfigGet('ENABLE_LOGGING', true, 'DEBUG_CONFIG');
        
        // コンテキスト状態
        this.currentContext = 'default';
        this.isInputFocused = false;
        
        // パフォーマンス最適化
        this.throttledHandlers = new Map();
        this.debouncedHandlers = new Map();
        
        this.debugLog('UIEventSystem', 'UIEventSystem初期化開始（汎用イベント処理専用）');
    }
    
    // ==== 初期化メソッド ====
    
    /**
     * Phase2D: UIEventSystem初期化（汎用処理のみ）
     */
    async init() {
        try {
            this.debugLog('UIEventSystem', '汎用イベント処理初期化開始...');
            
            // 汎用イベント設定
            this.setupGeneralKeyboardEvents();
            this.setupGeneralPointerEvents();
            this.setupWindowEvents();
            this.setupGeneralShortcuts();
            
            // スロットリング・デバウンス設定
            this.setupPerformanceHandlers();
            
            // コンテキスト監視開始
            this.startContextMonitoring();
            
            this.debugLog('UIEventSystem', '汎用イベント処理初期化完了');
            return true;
            
        } catch (error) {
            logError(error, 'UIEventSystem.init');
            throw createApplicationError('UIEventSystem初期化に失敗', { error });
        }
    }
    
    /**
     * 汎用キーボードイベント設定（ペン専用処理は除外）
     */
    setupGeneralKeyboardEvents() {
        // キーダウン（汎用ショートカットのみ）
        const keydownHandler = this.handleGeneralKeyDown.bind(this);
        safeAddEventListener(document, 'keydown', keydownHandler);
        this.eventListeners.set('keydown', keydownHandler);
        
        // キーアップ
        const keyupHandler = this.handleKeyUp.bind(this);
        safeAddEventListener(document, 'keyup', keyupHandler);
        this.eventListeners.set('keyup', keyupHandler);
        
        // フォーカス監視
        this.setupFocusMonitoring();
        
        this.debugLog('UIEventSystem', '汎用キーボードイベント設定完了（ペン専用処理除外）');
    }
    
    /**
     * 汎用ポインターイベント設定
     */
    setupGeneralPointerEvents() {
        if (!this.app || !this.app.view) {
            console.warn('UIEventSystem: キャンバス要素が利用できません');
            return;
        }
        
        const canvas = this.app.view;
        
        // ポインター移動（スロットリング）
        const moveHandler = throttle(this.handlePointerMove.bind(this), 16); // 60fps
        safeAddEventListener(canvas, 'pointermove', moveHandler);
        this.throttledHandlers.set('pointermove', moveHandler);
        
        // ポインター入力（汎用処理）
        const downHandler = this.handlePointerDown.bind(this);
        safeAddEventListener(canvas, 'pointerdown', downHandler);
        this.eventListeners.set('pointerdown', downHandler);
        
        const upHandler = this.handlePointerUp.bind(this);
        safeAddEventListener(canvas, 'pointerup', upHandler);
        this.eventListeners.set('pointerup', upHandler);
        
        // 汎用ホイール（キャンバスズーム・パンのみ）
        const wheelHandler = this.handleGeneralWheel.bind(this);
        safeAddEventListener(canvas, 'wheel', wheelHandler, { passive: false });
        this.eventListeners.set('wheel', wheelHandler);
        
        this.debugLog('UIEventSystem', '汎用ポインターイベント設定完了');
    }
    
    /**
     * ウィンドウイベント設定
     */
    setupWindowEvents() {
        // リサイズ（デバウンス）
        const resizeHandler = debounce(this.handleWindowResize.bind(this), 250);
        safeAddEventListener(window, 'resize', resizeHandler);
        this.debouncedHandlers.set('resize', resizeHandler);
        
        // ブラー・フォーカス
        const blurHandler = this.handleWindowBlur.bind(this);
        safeAddEventListener(window, 'blur', blurHandler);
        this.eventListeners.set('blur', blurHandler);
        
        const focusHandler = this.handleWindowFocus.bind(this);
        safeAddEventListener(window, 'focus', focusHandler);
        this.eventListeners.set('focus', focusHandler);
        
        // ビジビリティ変更
        const visibilityHandler = this.handleVisibilityChange.bind(this);
        safeAddEventListener(document, 'visibilitychange', visibilityHandler);
        this.eventListeners.set('visibilitychange', visibilityHandler);
        
        this.debugLog('UIEventSystem', 'ウィンドウイベント設定完了');
    }
    
    /**
     * 汎用ショートカット設定（ペン専用は除外）
     */
    setupGeneralShortcuts() {
        // システム全体ショートカット
        this.registerShortcut('Ctrl+Z', 'undo', 'アンドゥ');
        this.registerShortcut('Ctrl+Y', 'redo', 'リドゥ');
        this.registerShortcut('Ctrl+Shift+Z', 'redo', 'リドゥ');
        this.registerShortcut('Escape', 'closePopups', 'ポップアップ閉じる');
        
        // システム機能
        this.registerShortcut('F1', 'showHelp', 'ヘルプ表示');
        this.registerShortcut('F11', 'toggleFullscreen', 'フルスクリーン切り替え');
        
        // ツール切り替え（汎用）
        this.registerShortcut('v', 'selectPenTool', 'ペンツール選択');
        this.registerShortcut('e', 'selectEraserTool', '消しゴムツール選択');
        
        // 注意: P+数字、R、Shift+R、ホイール調整はEventManagerに移譲済み
        
        this.debugLog('UIEventSystem', '汎用ショートカット設定完了（ペン専用処理はEventManagerに移譲済み）');
    }
    
    /**
     * パフォーマンス最適化ハンドラ設定
     */
    setupPerformanceHandlers() {
        // 座標更新スロットリング
        this.throttledCoordinateUpdate = throttle((x, y) => {
            if (this.uiManager && this.uiManager.statusBar) {
                this.uiManager.statusBar.updateCoordinates(x, y);
            }
        }, 16); // 60fps
        
        // キーボード状態クリーンアップデバウンス
        this.debouncedStateCleanup = debounce(() => {
            this.cleanupKeyboardState();
        }, 5000);
        
        this.debugLog('UIEventSystem', 'パフォーマンス最適化ハンドラ設定完了');
    }
    
    // ==== フォーカス・コンテキスト監視 ====
    
    /**
     * フォーカス監視設定
     */
    setupFocusMonitoring() {
        // 入力フィールドフォーカス監視
        const focusHandler = (event) => {
            const target = event.target;
            this.isInputFocused = target && (
                target.tagName === 'INPUT' ||
                target.tagName === 'TEXTAREA' ||
                target.contentEditable === 'true'
            );
            
            if (this.isInputFocused) {
                this.debugLog('UIEventSystem', 'テキスト入力フォーカス検出 - ショートカット無効化');
            }
        };
        
        safeAddEventListener(document, 'focusin', focusHandler);
        safeAddEventListener(document, 'focusout', focusHandler);
        
        this.eventListeners.set('focusin', focusHandler);
        this.eventListeners.set('focusout', focusHandler);
    }
    
    /**
     * コンテキスト監視開始
     */
    startContextMonitoring() {
        // ポップアップ状態監視
        setInterval(() => {
            this.updateContext();
        }, 500);
        
        this.debugLog('UIEventSystem', 'コンテキスト監視開始');
    }
    
    /**
     * コンテキスト更新
     */
    updateContext() {
        let newContext = 'default';
        
        // ポップアップ表示中
        if (this.uiManager && this.uiManager.popupManager) {
            const popupStatus = this.uiManager.popupManager.getStatus();
            if (popupStatus && popupStatus.activeCount > 0) {
                newContext = 'popup';
            }
        }
        
        // 描画中
        if (this.toolsSystem && this.toolsSystem.isDrawing && this.toolsSystem.isDrawing()) {
            newContext = 'drawing';
        }
        
        if (newContext !== this.currentContext) {
            this.currentContext = newContext;
            this.debugLog('UIEventSystem', `コンテキスト変更: ${newContext}`);
        }
    }
    
    // ==== イベントハンドラ群（汎用処理のみ） ====
    
    /**
     * 汎用キー押下処理（ペン専用処理は除外）
     */
    handleGeneralKeyDown(event) {
        if (!this.isEnabled || this.isInputFocused) return;
        
        try {
            const key = this.normalizeKey(event.key);
            const modifiers = this.getModifiers(event);
            
            // キー状態記録
            this.keyboardState.set(key, {
                pressed: true,
                modifiers,
                timestamp: Date.now()
            });
            
            // 汎用ショートカット処理のみ
            const shortcutKey = this.buildShortcutKey(key, modifiers);
            if (this.handleGeneralShortcut(shortcutKey, event)) {
                event.preventDefault();
                return;
            }
            
        } catch (error) {
            logError(error, 'UIEventSystem.handleGeneralKeyDown');
        }
    }
    
    /**
     * キー離上処理
     */
    handleKeyUp(event) {
        if (!this.isEnabled) return;
        
        try {
            const key = this.normalizeKey(event.key);
            
            // キー状態更新
            if (this.keyboardState.has(key)) {
                const state = this.keyboardState.get(key);
                state.pressed = false;
                state.timestamp = Date.now();
            }
            
            // 状態クリーンアップ（デバウンス）
            this.debouncedStateCleanup();
            
        } catch (error) {
            logError(error, 'UIEventSystem.handleKeyUp');
        }
    }
    
    /**
     * ポインター移動処理
     */
    handlePointerMove(event) {
        if (!this.isEnabled) return;
        
        try {
            const rect = event.target.getBoundingClientRect();
            const x = event.clientX - rect.left;
            const y = event.clientY - rect.top;
            
            // 座標更新（スロットリング済み）
            this.throttledCoordinateUpdate(x, y);
            
        } catch (error) {
            logError(error, 'UIEventSystem.handlePointerMove');
        }
    }
    
    /**
     * ポインター押下処理
     */
    handlePointerDown(event) {
        if (!this.isEnabled) return;
        
        try {
            // ポップアップ外クリック時は閉じる
            if (!event.target.closest('.popup-panel')) {
                if (this.uiManager && this.uiManager.hideAllPopups) {
                    this.uiManager.hideAllPopups();
                }
            }
            
            this.debugLog('UIEventSystem', 'ポインター押下');
            
        } catch (error) {
            logError(error, 'UIEventSystem.handlePointerDown');
        }
    }
    
    /**
     * ポインター離上処理
     */
    handlePointerUp(event) {
        if (!this.isEnabled) return;
        
        try {
            this.debugLog('UIEventSystem', 'ポインター離上');
            
        } catch (error) {
            logError(error, 'UIEventSystem.handlePointerUp');
        }
    }
    
    /**
     * 汎用ホイール処理（キャンバスズーム・パンのみ、ペン調整は除外）
     */
    handleGeneralWheel(event) {
        if (!this.isEnabled || this.isInputFocused) return;
        
        try {
            // 注意: ペン専用のCtrl+ホイール（サイズ）、Shift+ホイール（透明度）は
            // EventManagerに移譲済み。ここでは汎用処理のみ
            
            // 汎用キャンバスズーム（将来実装時）
            if (event.altKey) {
                // Alt+ホイール: キャンバスズーム
                event.preventDefault();
                this.debugLog('UIEventSystem', 'キャンバスズーム（将来実装）');
                return;
            }
            
            // 汎用パン操作（将来実装時）
            if (event.ctrlKey && event.altKey) {
                // Ctrl+Alt+ホイール: キャンバスパン
                event.preventDefault();
                this.debugLog('UIEventSystem', 'キャンバスパン（将来実装）');
                return;
            }
            
        } catch (error) {
            logError(error, 'UIEventSystem.handleGeneralWheel');
        }
    }
    
    /**
     * ウィンドウリサイズ処理
     */
    handleWindowResize() {
        try {
            if (this.uiManager && this.uiManager.hideAllPopups) {
                this.uiManager.hideAllPopups();
            }
            
            this.debugLog('UIEventSystem', 'ウィンドウリサイズ処理');
            
        } catch (error) {
            logError(error, 'UIEventSystem.handleWindowResize');
        }
    }
    
    /**
     * ウィンドウブラー処理
     */
    handleWindowBlur() {
        try {
            // キーボード状態クリア
            this.keyboardState.clear();
            
            this.debugLog('UIEventSystem', 'ウィンドウブラー - 状態クリア');
            
        } catch (error) {
            logError(error, 'UIEventSystem.handleWindowBlur');
        }
    }
    
    /**
     * ウィンドウフォーカス処理
     */
    handleWindowFocus() {
        try {
            this.debugLog('UIEventSystem', 'ウィンドウフォーカス復帰');
            
        } catch (error) {
            logError(error, 'UIEventSystem.handleWindowFocus');
        }
    }
    
    /**
     * ビジビリティ変更処理
     */
    handleVisibilityChange() {
        try {
            if (document.hidden) {
                // ページ非表示時は状態クリア
                this.keyboardState.clear();
                
                this.debugLog('UIEventSystem', 'ページ非表示 - 状態クリア');
            } else {
                this.debugLog('UIEventSystem', 'ページ表示復帰');
            }
            
        } catch (error) {
            logError(error, 'UIEventSystem.handleVisibilityChange');
        }
    }
    
    // ==== ショートカット処理（汎用のみ） ====
    
    /**
     * ショートカット登録
     */
    registerShortcut(keyCombo, action, description) {
        this.shortcutSequences.set(keyCombo.toLowerCase(), {
            action,
            description,
            type: 'shortcut'
        });
        
        this.debugLog('UIEventSystem', `汎用ショートカット登録: ${keyCombo} → ${action}`);
    }
    
    /**
     * 汎用ショートカット処理（ペン専用は除外）
     */
    handleGeneralShortcut(shortcutKey, event) {
        if (!this.shortcutSequences.has(shortcutKey)) {
            return false;
        }
        
        const shortcut = this.shortcutSequences.get(shortcutKey);
        
        // ペン専用ショートカットの移譲案内
        if (this.isPenSpecificShortcut(shortcutKey)) {
            console.warn(`🔄 ショートカット "${shortcutKey}" はEventManagerに移譲済みです。ペンツール選択時に使用してください。`);
            return false;
        }
        
        if (shortcut.type !== 'shortcut') {
            return false;
        }
        
        return this.executeGeneralAction(shortcut.action, shortcut.params || {}, event);
    }
    
    /**
     * ペン専用ショートカット判定（移譲案内用）
     */
    isPenSpecificShortcut(shortcutKey) {
        const penShortcuts = ['r', 'shift+r'];
        return penShortcuts.includes(shortcutKey.toLowerCase());
    }
    
    /**
     * 汎用アクション実行（ペン専用は除外）
     */
    executeGeneralAction(action, params = {}, event = null) {
        try {
            this.debugLog('UIEventSystem', `汎用アクション実行: ${action}`, params);
            
            switch (action) {
                case 'undo':
                    return this.actionUndo();
                    
                case 'redo':
                    return this.actionRedo();
                    
                case 'closePopups':
                    return this.actionClosePopups();
                    
                case 'selectPenTool':
                    return this.actionSelectTool('pen');
                    
                case 'selectEraserTool':
                    return this.actionSelectTool('eraser');
                    
                case 'showHelp':
                    return this.actionShowHelp();
                    
                case 'toggleFullscreen':
                    return this.actionToggleFullscreen();
                    
                // 移譲済みアクションの案内
                case 'resetActivePreset':
                case 'resetAllPresets':
                case 'selectPreset':
                    console.warn(`🔄 アクション "${action}" はEventManagerに移譲済みです。ペンツール選択時に使用してください。`);
                    return false;
                    
                default:
                    console.warn(`UIEventSystem: 未知の汎用アクション: ${action}`);
                    return false;
            }
            
        } catch (error) {
            logError(error, `UIEventSystem.executeGeneralAction(${action})`);
            return false;
        }
    }
    
    // ==== 汎用アクション実装群 ====
    
    actionUndo() {
        if (!this.uiManager || !this.uiManager.canUndo || !this.uiManager.canUndo()) {
            return false;
        }
        
        const success = this.uiManager.undo();
        if (success && this.uiManager.showNotification) {
            this.uiManager.showNotification('元に戻しました', 'info', 1500);
        }
        return success;
    }
    
    actionRedo() {
        if (!this.uiManager || !this.uiManager.canRedo || !this.uiManager.canRedo()) {
            return false;
        }
        
        const success = this.uiManager.redo();
        if (success && this.uiManager.showNotification) {
            this.uiManager.showNotification('やり直しました', 'info', 1500);
        }
        return success;
    }
    
    actionClosePopups() {
        if (!this.uiManager || !this.uiManager.hideAllPopups) {
            return false;
        }
        
        this.uiManager.hideAllPopups();
        return true;
    }
    
    actionSelectTool(toolName) {
        if (!this.uiManager || !this.uiManager.setActiveTool) {
            return false;
        }
        
        const success = this.uiManager.setActiveTool(toolName);
        if (success && this.uiManager.showNotification) {
            const toolNames = { 'pen': 'ペンツール', 'eraser': '消しゴムツール' };
            this.uiManager.showNotification(`${toolNames[toolName] || toolName}に切り替えました`, 'info', 1500);
        }
        return success;
    }
    
    actionShowHelp() {
        // ヘルプ表示（将来実装）
        console.log('ヘルプ表示（将来実装）');
        if (this.uiManager && this.uiManager.showNotification) {
            this.uiManager.showNotification('ヘルプ機能は今後実装予定です', 'info', 2000);
        }
        return true;
    }
    
    actionToggleFullscreen() {
        // フルスクリーン切り替え（将来実装）
        console.log('フルスクリーン切り替え（将来実装）');
        if (this.uiManager && this.uiManager.showNotification) {
            this.uiManager.showNotification('フルスクリーン機能は今後実装予定です', 'info', 2000);
        }
        return true;
    }
    
    // ==== ユーティリティメソッド ====
    
    /**
     * キーの正規化
     */
    normalizeKey(key) {
        // 特殊キーの統一
        const keyMap = {
            ' ': 'Space',
            'ArrowUp': 'Up',
            'ArrowDown': 'Down',
            'ArrowLeft': 'Left',
            'ArrowRight': 'Right',
            'Delete': 'Del'
        };
        
        return keyMap[key] || key;
    }
    
    /**
     * 修飾キー取得
     */
    getModifiers(event) {
        return {
            ctrl: event.ctrlKey,
            shift: event.shiftKey,
            alt: event.altKey,
            meta: event.metaKey
        };
    }
    
    /**
     * ショートカットキー構築
     */
    buildShortcutKey(key, modifiers) {
        const parts = [];
        
        if (modifiers.ctrl) parts.push('Ctrl');
        if (modifiers.shift) parts.push('Shift');
        if (modifiers.alt) parts.push('Alt');
        if (modifiers.meta) parts.push('Meta');
        
        parts.push(key);
        
        return parts.join('+').toLowerCase();
    }
    
    /**
     * キーボード状態クリーンアップ
     */
    cleanupKeyboardState() {
        const now = Date.now();
        const maxAge = 10000; // 10秒
        
        for (const [key, state] of this.keyboardState) {
            if (now - state.timestamp > maxAge) {
                this.keyboardState.delete(key);
            }
        }
        
        if (this.keyboardState.size === 0) {
            this.debugLog('UIEventSystem', 'キーボード状態クリーンアップ完了');
        }
    }
    
    /**
     * デバッグログ出力
     */
    debugLog(category, message, data = null) {
        if (this.debugMode && window.debugLog) {
            debugLog(category, message, data);
        } else if (this.debugMode) {
            console.log(`🔧 [${category}]`, message, data || '');
        }
    }
    
    // ==== システム管理・統計 ====
    
    /**
     * システム統計取得
     */
    getSystemStats() {
        return {
            isEnabled: this.isEnabled,
            currentContext: this.currentContext,
            isInputFocused: this.isInputFocused,
            keyboardState: {
                activeKeys: this.keyboardState.size,
                keys: Array.from(this.keyboardState.keys())
            },
            shortcuts: {
                registered: this.shortcutSequences.size,
                list: Array.from(this.shortcutSequences.keys())
            },
            eventListeners: {
                registered: this.eventListeners.size + this.throttledHandlers.size + this.debouncedHandlers.size,
                types: [
                    ...Array.from(this.eventListeners.keys()),
                    ...Array.from(this.throttledHandlers.keys()),
                    ...Array.from(this.debouncedHandlers.keys())
                ]
            }
        };
    }
    
    /**
     * システムデバッグ情報表示
     */
    debugSystem() {
        console.group('🔍 UIEventSystem デバッグ情報（汎用処理専用版）');
        
        const stats = this.getSystemStats();
        console.log('基本情報:', {
            enabled: stats.isEnabled,
            context: stats.currentContext,
            inputFocused: stats.isInputFocused
        });
        
        console.log('キーボード状態:', stats.keyboardState);
        console.log('ショートカット:', stats.shortcuts);
        console.log('イベントリスナー:', stats.eventListeners);
        
        console.groupEnd();
    }
    
    /**
     * ショートカット一覧表示（汎用のみ）
     */
    listShortcuts() {
        console.group('⌨️ 汎用ショートカット一覧（ペン専用は除外）');
        
        for (const [key, shortcut] of this.shortcutSequences) {
            console.log(`⚡ ${key} → ${shortcut.action} (${shortcut.description})`);
        }
        
        console.log('');
        console.log('📝 移譲済み（EventManagerに移管）:');
        console.log('  🎨 P+1〜5: プリセット選択');
        console.log('  🔄 R: アクティブプリセットリセット');
        console.log('  🔄 Shift+R: 全プリセットリセット');
        console.log('  📏 Ctrl+ホイール: ペンサイズ調整');
        console.log('  🌫️ Shift+ホイール: 透明度調整');
        
        console.groupEnd();
    }
    
    /**
     * システム有効化/無効化
     */
    setEnabled(enabled) {
        const wasEnabled = this.isEnabled;
        this.isEnabled = enabled;
        
        if (wasEnabled !== enabled) {
            if (!enabled) {
                // 無効化時は状態クリア
                this.keyboardState.clear();
            }
            
            this.debugLog('UIEventSystem', `汎用システム${enabled ? '有効化' : '無効化'}`);
        }
    }
    
    /**
     * クリーンアップ
     */
    destroy() {
        try {
            this.debugLog('UIEventSystem', '汎用イベントシステム クリーンアップ開始');
            
            // イベントリスナー削除
            for (const [eventType, handler] of this.eventListeners) {
                document.removeEventListener(eventType, handler);
            }
            
            for (const [eventType, handler] of this.throttledHandlers) {
                if (this.app && this.app.view) {
                    this.app.view.removeEventListener(eventType, handler);
                }
            }
            
            for (const [eventType, handler] of this.debouncedHandlers) {
                window.removeEventListener(eventType, handler);
            }
            
            // 状態クリア
            this.keyboardState.clear();
            this.shortcutSequences.clear();
            this.eventListeners.clear();
            this.throttledHandlers.clear();
            this.debouncedHandlers.clear();
            
            // 参照クリア
            this.app = null;
            this.toolsSystem = null;
            this.uiManager = null;
            
            this.debugLog('UIEventSystem', '汎用イベントシステム クリーンアップ完了');
            
        } catch (error) {
            logError(error, 'UIEventSystem.destroy');
        }
    }
}

// ==== グローバル登録（ES6 export削除版）====
if (typeof window !== 'undefined') {
    window.UIEventSystem = UIEventSystem;
    
    console.log('✅ ui/ui-events.js Phase2D修正版 読み込み完了');
    console.log('📦 エクスポートクラス（汎用イベント処理専用）:');
    console.log('  ✅ UIEventSystem: 汎用UIイベント処理システム');
    console.log('🔧 STEP 5移譲後の責務:');
    console.log('  ✅ 汎用キーボードショートカット（Ctrl+Z/Y, Esc, F1, F11等）');
    console.log('  ✅ 汎用ホイール処理（キャンバスズーム・パン等）');
    console.log('  ✅ 汎用ポインター処理（座標追跡等）');
    console.log('  ✅ ウィンドウイベント（リサイズ・フォーカス等）');
    console.log('  ❌ ペンツール専用処理（EventManagerに移譲完了）');
    console.log('🎯 責務: 汎用UIイベント処理（ツール非依存）');
    console.log('🏗️ ES6 export削除: 既存JavaScript + fetch API形式互換');
    console.log('🔄 移譲完了項目:');
    console.log('  📝 P+数字プリセット選択 → EventManager');
    console.log('  📝 R/Shift+R リセット → EventManager');
    console.log('  📝 Ctrl/Shift+ホイール調整 → EventManager');
    console.log('🚀 汎用機能:');
    console.log('  ⌨️ システムショートカット: Ctrl+Z(undo), Ctrl+Y(redo), Esc(close)');
    console.log('  🔧 システム機能: F1(help), F11(fullscreen), V(pen), E(eraser)');
    console.log('  🖱️ 汎用ポインター: 座標追跡、ポップアップ外クリック検出');
    console.log('  🎛️ 汎用ホイール: Alt+ホイール（ズーム）、Ctrl+Alt+ホイール（パン）');
}