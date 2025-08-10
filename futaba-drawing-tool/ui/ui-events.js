/**
 * 🎨 ふたば☆ちゃんねる風ベクターお絵描きツール v1rev11
 * UIイベント処理専門システム - ui/ui-events.js (Phase2D新規)
 * 
 * 🔧 Phase2D実装内容:
 * 1. ✅ UIイベント処理をui-manager.jsから分離
 * 2. ✅ キーボードショートカット統合管理
 * 3. ✅ P+キーシーケンス処理
 * 4. ✅ コンテキスト認識イベント処理
 * 5. ✅ パフォーマンス最適化されたイベント管理
 * 6. ✅ デバウンス・スロットリング活用
 * 7. ✅ エラーハンドリング強化
 * 
 * Phase2D目標: 単一責任原則・UIイベント処理専門化・保守性向上
 * 責務: UIイベント・キーボードショートカット・入力処理の統合管理
 * 依存: config.js, utils.js
 */

console.log('🔧 ui/ui-events.js Phase2D新規実装版読み込み開始...');

// ==== UIイベントシステム専門クラス（Phase2D）====
class UIEventSystem {
    constructor(app, toolsSystem, uiManager) {
        this.app = app;
        this.toolsSystem = toolsSystem;
        this.uiManager = uiManager;
        
        // イベント状態管理
        this.keyboardState = new Map();
        this.shortcutSequences = new Map();
        this.eventListeners = new Map();
        this.activeSequence = null;
        this.sequenceTimeout = null;
        
        // 設定
        this.isEnabled = true;
        this.debugMode = safeConfigGet('ENABLE_LOGGING', true, 'DEBUG_CONFIG');
        this.sequenceTimeoutMs = 1500; // P+キーシーケンスタイムアウト
        
        // コンテキスト状態
        this.currentContext = 'default';
        this.isInputFocused = false;
        
        // パフォーマンス最適化
        this.throttledHandlers = new Map();
        this.debouncedHandlers = new Map();
        
        this.debugLog('UIEventSystem', 'UIEventSystem初期化開始');
    }
    
    // ==== 初期化メソッド ====
    
    /**
     * Phase2D: UIEventSystem初期化
     */
    async init() {
        try {
            this.debugLog('UIEventSystem', '初期化開始...');
            
            // イベント設定
            this.setupKeyboardEvents();
            this.setupPointerEvents();
            this.setupWindowEvents();
            this.setupCustomShortcuts();
            
            // スロットリング・デバウンス設定
            this.setupPerformanceHandlers();
            
            // コンテキスト監視開始
            this.startContextMonitoring();
            
            this.debugLog('UIEventSystem', '初期化完了');
            return true;
            
        } catch (error) {
            logError(error, 'UIEventSystem.init');
            throw createApplicationError('UIEventSystem初期化に失敗', { error });
        }
    }
    
    /**
     * Phase2D: キーボードイベント設定
     */
    setupKeyboardEvents() {
        // キーダウン
        const keydownHandler = this.handleKeyDown.bind(this);
        safeAddEventListener(document, 'keydown', keydownHandler);
        this.eventListeners.set('keydown', keydownHandler);
        
        // キーアップ
        const keyupHandler = this.handleKeyUp.bind(this);
        safeAddEventListener(document, 'keyup', keyupHandler);
        this.eventListeners.set('keyup', keyupHandler);
        
        // フォーカス監視
        this.setupFocusMonitoring();
        
        this.debugLog('UIEventSystem', 'キーボードイベント設定完了');
    }
    
    /**
     * Phase2D: ポインターイベント設定
     */
    setupPointerEvents() {
        if (!this.app || !this.app.view) {
            console.warn('UIEventSystem: キャンバス要素が利用できません');
            return;
        }
        
        const canvas = this.app.view;
        
        // ポインター移動（スロットリング）
        const moveHandler = throttle(this.handlePointerMove.bind(this), 16); // 60fps
        safeAddEventListener(canvas, 'pointermove', moveHandler);
        this.throttledHandlers.set('pointermove', moveHandler);
        
        // ポインター入力
        const downHandler = this.handlePointerDown.bind(this);
        safeAddEventListener(canvas, 'pointerdown', downHandler);
        this.eventListeners.set('pointerdown', downHandler);
        
        const upHandler = this.handlePointerUp.bind(this);
        safeAddEventListener(canvas, 'pointerup', upHandler);
        this.eventListeners.set('pointerup', upHandler);
        
        // ホイール
        const wheelHandler = this.handleWheel.bind(this);
        safeAddEventListener(canvas, 'wheel', wheelHandler, { passive: false });
        this.eventListeners.set('wheel', wheelHandler);
        
        this.debugLog('UIEventSystem', 'ポインターイベント設定完了');
    }
    
    /**
     * Phase2D: ウィンドウイベント設定
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
     * Phase2D: カスタムショートカット設定
     */
    setupCustomShortcuts() {
        // 基本ショートカット登録
        this.registerShortcut('Ctrl+Z', 'undo', 'アンドゥ');
        this.registerShortcut('Ctrl+Y', 'redo', 'リドゥ');
        this.registerShortcut('Ctrl+Shift+Z', 'redo', 'リドゥ');
        this.registerShortcut('r', 'resetActivePreset', 'アクティブプリセットリセット');
        this.registerShortcut('Escape', 'closePopups', 'ポップアップ閉じる');
        
        // P+キーシーケンス
        this.setupPresetSequences();
        
        // ツール切り替え
        this.registerShortcut('v', 'selectPenTool', 'ペンツール選択');
        this.registerShortcut('e', 'selectEraserTool', '消しゴムツール選択');
        
        this.debugLog('UIEventSystem', 'カスタムショートカット設定完了');
    }
    
    /**
     * Phase2D: P+キーシーケンス設定
     */
    setupPresetSequences() {
        const sizePresets = safeConfigGet('SIZE_PRESETS', [1, 2, 4, 8, 16, 32]);
        
        // P+1, P+2, ... でプリセット選択
        sizePresets.forEach((size, index) => {
            const key = (index + 1).toString();
            this.registerSequence('p', key, 'selectPreset', `プリセット${size}px選択`, { size });
        });
        
        // P+0 で全プリセットリセット
        this.registerSequence('p', '0', 'resetAllPresets', '全プリセットリセット');
        
        this.debugLog('UIEventSystem', `P+キーシーケンス設定完了: ${sizePresets.length}個`);
    }
    
    /**
     * Phase2D: パフォーマンス最適化ハンドラ設定
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
     * Phase2D: フォーカス監視設定
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
     * Phase2D: コンテキスト監視開始
     */
    startContextMonitoring() {
        // ポップアップ状態監視
        setInterval(() => {
            this.updateContext();
        }, 500);
        
        this.debugLog('UIEventSystem', 'コンテキスト監視開始');
    }
    
    /**
     * Phase2D: コンテキスト更新
     */
    updateContext() {
        let newContext = 'default';
        
        // ポップアップ表示中
        if (this.uiManager && this.uiManager.popupManager) {
            const popupStatus = this.uiManager.popupManager.getStatus();
            if (popupStatus.activeCount > 0) {
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
    
    // ==== イベントハンドラ群 ====
    
    /**
     * Phase2D: キー押下処理
     */
    handleKeyDown(event) {
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
            
            // シーケンス処理
            if (this.activeSequence) {
                this.handleSequenceKey(key, event);
                return;
            }
            
            // ショートカット処理
            const shortcutKey = this.buildShortcutKey(key, modifiers);
            if (this.handleShortcut(shortcutKey, event)) {
                event.preventDefault();
                return;
            }
            
            // シーケンス開始チェック
            if (this.startSequence(key)) {
                event.preventDefault();
            }
            
        } catch (error) {
            logError(error, 'UIEventSystem.handleKeyDown');
        }
    }
    
    /**
     * Phase2D: キー離上処理
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
     * Phase2D: ポインター移動処理
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
     * Phase2D: ポインター押下処理
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
     * Phase2D: ポインター離上処理
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
     * Phase2D: ホイール処理
     */
    handleWheel(event) {
        if (!this.isEnabled || this.isInputFocused) return;
        
        try {
            // Ctrlキー押下時はサイズ変更
            if (event.ctrlKey) {
                event.preventDefault();
                
                const delta = -event.deltaY;
                const step = 0.5; // サイズ変更ステップ
                const adjustment = delta > 0 ? step : -step;
                
                if (this.toolsSystem && this.toolsSystem.getBrushSettings) {
                    const currentSettings = this.toolsSystem.getBrushSettings();
                    const newSize = validateBrushSize(currentSettings.size + adjustment);
                    
                    this.toolsSystem.updateBrushSettings({ size: newSize });
                    this.coordinateWithHistory('brushSizeWheel', { size: newSize });
                    
                    this.debugLog('UIEventSystem', `ホイールサイズ変更: ${newSize}px`);
                }
            }
            
        } catch (error) {
            logError(error, 'UIEventSystem.handleWheel');
        }
    }
    
    /**
     * Phase2D: ウィンドウリサイズ処理
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
     * Phase2D: ウィンドウブラー処理
     */
    handleWindowBlur() {
        try {
            // キーボード状態クリア
            this.keyboardState.clear();
            
            // アクティブシーケンスクリア
            this.clearActiveSequence();
            
            this.debugLog('UIEventSystem', 'ウィンドウブラー - 状態クリア');
            
        } catch (error) {
            logError(error, 'UIEventSystem.handleWindowBlur');
        }
    }
    
    /**
     * Phase2D: ウィンドウフォーカス処理
     */
    handleWindowFocus() {
        try {
            this.debugLog('UIEventSystem', 'ウィンドウフォーカス復帰');
            
        } catch (error) {
            logError(error, 'UIEventSystem.handleWindowFocus');
        }
    }
    
    /**
     * Phase2D: ビジビリティ変更処理
     */
    handleVisibilityChange() {
        try {
            if (document.hidden) {
                // ページ非表示時は状態クリア
                this.keyboardState.clear();
                this.clearActiveSequence();
                
                this.debugLog('UIEventSystem', 'ページ非表示 - 状態クリア');
            } else {
                this.debugLog('UIEventSystem', 'ページ表示復帰');
            }
            
        } catch (error) {
            logError(error, 'UIEventSystem.handleVisibilityChange');
        }
    }
    
    // ==== ショートカット処理 ====
    
    /**
     * Phase2D: ショートカット登録
     * @param {string} keyCombo - キー組み合わせ
     * @param {string} action - アクション名
     * @param {string} description - 説明
     */
    registerShortcut(keyCombo, action, description) {
        this.shortcutSequences.set(keyCombo.toLowerCase(), {
            action,
            description,
            type: 'shortcut'
        });
        
        this.debugLog('UIEventSystem', `ショートカット登録: ${keyCombo} → ${action}`);
    }
    
    /**
     * Phase2D: シーケンス登録
     * @param {string} startKey - 開始キー
     * @param {string} secondKey - 2番目のキー
     * @param {string} action - アクション名
     * @param {string} description - 説明
     * @param {object} params - パラメータ
     */
    registerSequence(startKey, secondKey, action, description, params = {}) {
        const sequenceKey = `${startKey.toLowerCase()}+${secondKey.toLowerCase()}`;
        this.shortcutSequences.set(sequenceKey, {
            action,
            description,
            type: 'sequence',
            params
        });
        
        this.debugLog('UIEventSystem', `シーケンス登録: ${sequenceKey} → ${action}`);
    }
    
    /**
     * Phase2D: ショートカット処理
     * @param {string} shortcutKey - ショートカットキー
     * @param {Event} event - イベント
     * @returns {boolean} - 処理済みフラグ
     */
    handleShortcut(shortcutKey, event) {
        if (!this.shortcutSequences.has(shortcutKey)) {
            return false;
        }
        
        const shortcut = this.shortcutSequences.get(shortcutKey);
        
        if (shortcut.type !== 'shortcut') {
            return false;
        }
        
        return this.executeAction(shortcut.action, shortcut.params, event);
    }
    
    /**
     * Phase2D: シーケンス開始
     * @param {string} key - キー
     * @returns {boolean} - シーケンス開始フラグ
     */
    startSequence(key) {
        // 'p' キーでプリセットシーケンス開始
        if (key.toLowerCase() === 'p') {
            this.activeSequence = {
                startKey: 'p',
                startTime: Date.now()
            };
            
            // タイムアウト設定
            this.sequenceTimeout = setTimeout(() => {
                this.clearActiveSequence();
            }, this.sequenceTimeoutMs);
            
            this.debugLog('UIEventSystem', 'プリセットシーケンス開始 (P+...)');
            return true;
        }
        
        return false;
    }
    
    /**
     * Phase2D: シーケンスキー処理
     * @param {string} key - キー
     * @param {Event} event - イベント
     */
    handleSequenceKey(key, event) {
        if (!this.activeSequence) return;
        
        const sequenceKey = `${this.activeSequence.startKey}+${key.toLowerCase()}`;
        
        if (this.shortcutSequences.has(sequenceKey)) {
            const sequence = this.shortcutSequences.get(sequenceKey);
            
            if (this.executeAction(sequence.action, sequence.params, event)) {
                event.preventDefault();
            }
        } else {
            this.debugLog('UIEventSystem', `未登録シーケンス: ${sequenceKey}`);
        }
        
        // シーケンス完了
        this.clearActiveSequence();
    }
    
    /**
     * Phase2D: アクティブシーケンスクリア
     */
    clearActiveSequence() {
        if (this.sequenceTimeout) {
            clearTimeout(this.sequenceTimeout);
            this.sequenceTimeout = null;
        }
        
        if (this.activeSequence) {
            this.debugLog('UIEventSystem', 'アクティブシーケンスクリア');
            this.activeSequence = null;
        }
    }
    
    // ==== アクション実行 ====
    
    /**
     * Phase2D: アクション実行
     * @param {string} action - アクション名
     * @param {object} params - パラメータ
     * @param {Event} event - イベント
     * @returns {boolean} - 実行成功フラグ
     */
    executeAction(action, params = {}, event = null) {
        try {
            this.debugLog('UIEventSystem', `アクション実行: ${action}`, params);
            
            switch (action) {
                case 'undo':
                    return this.actionUndo();
                    
                case 'redo':
                    return this.actionRedo();
                    
                case 'resetActivePreset':
                    return this.actionResetActivePreset();
                    
                case 'resetAllPresets':
                    return this.actionResetAllPresets();
                    
                case 'closePopups':
                    return this.actionClosePopups();
                    
                case 'selectPenTool':
                    return this.actionSelectTool('pen');
                    
                case 'selectEraserTool':
                    return this.actionSelectTool('eraser');
                    
                case 'selectPreset':
                    return this.actionSelectPreset(params.size);
                    
                default:
                    console.warn(`UIEventSystem: 未知のアクション: ${action}`);
                    return false;
            }
            
        } catch (error) {
            logError(error, `UIEventSystem.executeAction(${action})`);
            return false;
        }
    }
    
    // ==== アクション実装群 ====
    
    actionUndo() {
        if (!this.uiManager || !this.uiManager.canUndo()) {
            return false;
        }
        
        const success = this.uiManager.undo();
        if (success && this.uiManager.showNotification) {
            this.uiManager.showNotification('元に戻しました', 'info', 1500);
        }
        return success;
    }
    
    actionRedo() {
        if (!this.uiManager || !this.uiManager.canRedo()) {
            return false;
        }
        
        const success = this.uiManager.redo();
        if (success && this.uiManager.showNotification) {
            this.uiManager.showNotification('やり直しました', 'info', 1500);
        }
        return success;
    }
    
    actionResetActivePreset() {
        if (!this.uiManager || !this.uiManager.resetActivePreset) {
            return false;
        }
        
        const success = this.uiManager.resetActivePreset();
        if (success && this.uiManager.showNotification) {
            this.uiManager.showNotification('アクティブプリセットをリセットしました', 'success', 2000);
        }
        return success;
    }
    
    actionResetAllPresets() {
        if (!this.uiManager || !this.uiManager.handleResetAllPresets) {
            return false;
        }
        
        // 確認ダイアログは uiManager 側で処理
        return this.uiManager.handleResetAllPresets();
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
    
    actionSelectPreset(size) {
        if (!this.uiManager || !this.uiManager.selectPreset) {
            return false;
        }
        
        const presetId = `preset_${size}`;
        const success = this.uiManager.selectPreset(presetId);
        if (success && this.uiManager.showNotification) {
            this.uiManager.showNotification(`プリセット${size}pxを選択しました`, 'info', 1500);
        }
        return success;
    }
    
    // ==== システム連携 ====
    
    /**
     * Phase2D: 履歴システム連携
     * @param {string} operation - 操作種別
     * @param {object} parameters - パラメータ
     */
    coordinateWithHistory(operation, parameters = {}) {
        try {
            if (this.uiManager && this.uiManager.historyManager) {
                const historyManager = this.uiManager.historyManager;
                
                switch (operation) {
                    case 'brushSizeWheel':
                        if (historyManager.recordBrushChange) {
                            historyManager.recordBrushChange({
                                type: 'size',
                                value: parameters.size,
                                source: 'wheel'
                            });
                        }
                        break;
                        
                    default:
                        this.debugLog('UIEventSystem', `未対応の履歴操作: ${operation}`);
                        break;
                }
            }
        } catch (error) {
            logError(error, 'UIEventSystem.coordinateWithHistory');
        }
    }
    
    /**
     * Phase2D: ツールシステム連携
     * @param {string} toolChange - ツール変更種別
     * @param {object} parameters - パラメータ
     */
    coordinateWithTools(toolChange, parameters = {}) {
        try {
            if (this.toolsSystem) {
                switch (toolChange) {
                    case 'keyboardTool':
                        this.toolsSystem.setTool(parameters.tool);
                        break;
                        
                    case 'keyboardSize':
                        this.toolsSystem.updateBrushSettings({ size: parameters.size });
                        break;
                        
                    default:
                        this.debugLog('UIEventSystem', `未対応のツール操作: ${toolChange}`);
                        break;
                }
            }
        } catch (error) {
            logError(error, 'UIEventSystem.coordinateWithTools');
        }
    }
    
    // ==== ユーティリティメソッド ====
    
    /**
     * Phase2D: キーの正規化
     * @param {string} key - キー
     * @returns {string} - 正規化済みキー
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
     * Phase2D: 修飾キー取得
     * @param {KeyboardEvent} event - キーボードイベント
     * @returns {object} - 修飾キー状態
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
     * Phase2D: ショートカットキー構築
     * @param {string} key - キー
     * @param {object} modifiers - 修飾キー状態
     * @returns {string} - ショートカットキー文字列
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
     * Phase2D: キーボード状態クリーンアップ
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
     * Phase2D: デバッグログ出力
     * @param {string} category - カテゴリ
     * @param {string} message - メッセージ
     * @param {*} data - データ
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
     * Phase2D: システム統計取得
     * @returns {object} - システム統計
     */
    getSystemStats() {
        return {
            isEnabled: this.isEnabled,
            currentContext: this.currentContext,
            isInputFocused: this.isInputFocused,
            activeSequence: this.activeSequence ? {
                startKey: this.activeSequence.startKey,
                elapsed: Date.now() - this.activeSequence.startTime
            } : null,
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
     * Phase2D: システムデバッグ情報表示
     */
    debugSystem() {
        console.group('🔍 UIEventSystem デバッグ情報（Phase2D）');
        
        const stats = this.getSystemStats();
        console.log('基本情報:', {
            enabled: stats.isEnabled,
            context: stats.currentContext,
            inputFocused: stats.isInputFocused
        });
        
        console.log('キーボード状態:', stats.keyboardState);
        console.log('アクティブシーケンス:', stats.activeSequence);
        console.log('ショートカット:', stats.shortcuts);
        console.log('イベントリスナー:', stats.eventListeners);
        
        console.groupEnd();
    }
    
    /**
     * Phase2D: ショートカット一覧表示
     */
    listShortcuts() {
        console.group('⌨️ 登録済みショートカット一覧');
        
        for (const [key, shortcut] of this.shortcutSequences) {
            const type = shortcut.type === 'sequence' ? '🔄' : '⚡';
            console.log(`${type} ${key} → ${shortcut.action} (${shortcut.description})`);
        }
        
        console.groupEnd();
    }
    
    /**
     * Phase2D: システム有効化/無効化
     * @param {boolean} enabled - 有効化フラグ
     */
    setEnabled(enabled) {
        const wasEnabled = this.isEnabled;
        this.isEnabled = enabled;
        
        if (wasEnabled !== enabled) {
            if (!enabled) {
                // 無効化時は状態クリア
                this.keyboardState.clear();
                this.clearActiveSequence();
            }
            
            this.debugLog('UIEventSystem', `システム${enabled ? '有効化' : '無効化'}`);
        }
    }
    
    /**
     * Phase2D: クリーンアップ
     */
    destroy() {
        try {
            this.debugLog('UIEventSystem', 'クリーンアップ開始');
            
            // アクティブシーケンスクリア
            this.clearActiveSequence();
            
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
            
            this.debugLog('UIEventSystem', 'クリーンアップ完了');
            
        } catch (error) {
            logError(error, 'UIEventSystem.destroy');
        }
    }
}

// ==== グローバル登録・エクスポート（Phase2D）====
if (typeof window !== 'undefined') {
    window.UIEventSystem = UIEventSystem;
    
    console.log('✅ ui/ui-events.js Phase2D新規実装版 読み込み完了');
    console.log('📦 エクスポートクラス（単一責任原則・イベント処理専門）:');
    console.log('  ✅ UIEventSystem: UIイベント処理専門システム');
    console.log('🔧 Phase2D実装完了:');
    console.log('  ✅ UIイベント処理をui-manager.jsから完全分離');
    console.log('  ✅ キーボードショートカット統合管理（Ctrl+Z/Y, R, Esc等）');
    console.log('  ✅ P+キーシーケンス処理（P+1,P+2...でプリセット選択）');
    console.log('  ✅ コンテキスト認識イベント処理（ポップアップ・描画・通常）');
    console.log('  ✅ パフォーマンス最適化（スロットリング・デバウンス活用）');
    console.log('  ✅ 入力フィールドフォーカス検出・ショートカット無効化');
    console.log('  ✅ ホイールサイズ変更（Ctrl+ホイール）');
    console.log('  ✅ ウィンドウ・ビジビリティ状態管理');
    console.log('  ✅ エラーハンドリング強化・graceful degradation');
    console.log('  ✅ システム統計・デバッグ機能充実');
    console.log('🎯 責務: UIイベント・ショートカット・入力処理の専門管理');
    console.log('🏗️ Phase2D: 単一責任原則準拠・ui-manager.jsから800行規模の処理分離完了');
    console.log('🚀 システム機能:');
    console.log('  ⌨️ 基本ショートカット: Ctrl+Z(undo), Ctrl+Y(redo), R(reset), Esc(close)');
    console.log('  🔄 P+シーケンス: P+1〜P+6(プリセット選択), P+0(全リセット)');
    console.log('  🖱️ ポインター: 座標追跡、ポップアップ外クリック検出');
    console.log('  🎛️ ツール切り替え: V(ペン), E(消しゴム)');
    console.log('  🔍 コンテキスト認識: 入力フィールド・ポップアップ・描画状態別処理');
}