/**
 * ⌨️ ShortcutManager - Phase1.5スタブ実装版（修正版）
 * 📋 RESPONSIBILITY: キーボードショートカット・アクセラレーション・効率化UI
 * 🚫 PROHIBITION: 描画処理・座標変換・レイヤー管理・ツール実装
 * ✅ PERMISSION: EventBus通信・Manager連携・コンテキスト管理・UI統合
 * 
 * 📏 DESIGN_PRINCIPLE: EventBus中心・疎結合設計・コンテキスト管理・競合回避
 * 🔄 INTEGRATION: Phase1.5基盤・EventBus必須・全Manager連携・UI統合
 * 🎯 Phase1.5: 基本ショートカット・Phase別管理・効率化準備
 */

(function() {
    'use strict';
    
    /**
     * ShortcutManager - キーボードショートカット管理
     */
    class ShortcutManager {
        constructor(config = {}) {
            console.log('⌨️ ShortcutManager Phase1.5スタブ実装 - 初期化開始');
            
            this.eventBus = null;
            this.config = config;
            
            // ショートカット状態（Phase1.5基盤）
            this.keys = new Set();
            this.activeContext = 'default';
            this.enabled = false;  // 初期は無効
            
            // ショートカット定義（Phase1.5基盤・段階的実装予定）
            this.shortcuts = new Map();
            this.contexts = new Map();
            
            // フォーカス管理（ブラウザ競合回避）
            this.canvasHasFocus = false;
            this.preventDefaults = new Set();
            
            this.initializeComplete = false;
            this.isSetup = false;
            
            console.log('⌨️ ShortcutManager スタブ実装完了');
        }
        
        /**
         * 初期化（Phase1.5スタブ - EventBus連携準備）
         */
        initialize(eventBus) {
            console.log('⌨️ ShortcutManager 初期化 - Phase1.5スタブ版');
            
            if (!eventBus) {
                console.warn('⚠️ ShortcutManager: EventBus未提供 - Phase1.5開発中');
                return false;
            }
            
            this.eventBus = eventBus;
            
            // Phase1.5: 基本キーボードイベント準備（スタブ）
            this.setupEventListeners();
            
            // Phase1.5: EventBus連携準備（スタブ）
            this.setupEventBusListeners();
            
            this.initializeComplete = true;
            console.log('✅ ShortcutManager 初期化完了 - Phase1.5スタブ版');
            
            return true;
        }
        
        /**
         * 🆕 Phase1.5ショートカット設定（app-core.jsからの呼び出し用）
         */
        setupPhase15Shortcuts() {
            console.log('⌨️ ShortcutManager Phase1.5ショートカット設定開始');
            
            if (this.isSetup) {
                console.log('⚠️ Phase1.5ショートカット既に設定済み - スキップ');
                return;
            }
            
            // Phase1.5: 基本編集ショートカット設定
            this.defineShortcut('default', 'Ctrl+Z', 'undo', 'アンドゥ');
            this.defineShortcut('default', 'Ctrl+Y', 'redo', 'リドゥ');
            
            // Phase1.5: 基本ツールショートカット設定
            this.defineShortcut('default', 'KeyP', 'tool:pen', 'ペンツール');
            this.defineShortcut('default', 'KeyE', 'tool:eraser', '消しゴムツール');
            
            // Phase1.5: 基本ナビゲーションショートカット設定
            this.defineShortcut('default', 'Space', 'navigation:pan', 'パンモード');
            this.defineShortcut('default', 'Ctrl+Digit0', 'navigation:reset', 'ビューリセット');
            
            // Phase1.5: ブラウザ競合回避設定
            this.preventDefaults.add('Ctrl+Z');
            this.preventDefaults.add('Ctrl+Y');
            this.preventDefaults.add('Space');
            
            this.isSetup = true;
            console.log('✅ ShortcutManager Phase1.5ショートカット設定完了');
        }
        
        /**
         * ショートカット定義（Phase1.5スタブ実装）
         */
        defineShortcut(context, keyCombo, action, description) {
            if (!this.contexts.has(context)) {
                this.contexts.set(context, new Map());
            }
            
            const contextShortcuts = this.contexts.get(context);
            contextShortcuts.set(keyCombo, { action, description });
            
            console.log(`⌨️ ShortcutManager ショートカット定義: [${context}] ${keyCombo} -> ${action} (${description})`);
        }
        
        /**
         * 🆕 ショートカット機能有効化（app-core.jsからの呼び出し用）
         */
        enable() {
            if (!this.initializeComplete) {
                console.warn('⚠️ ShortcutManager: 初期化未完了 - 有効化をスキップ');
                return false;
            }
            
            this.enabled = true;
            console.log('✅ ShortcutManager 機能有効化完了');
            return true;
        }
        
        /**
         * ショートカット機能無効化
         */
        disable() {
            this.enabled = false;
            console.log('⚠️ ShortcutManager 機能無効化');
        }
        
        /**
         * イベントリスナー設定（Phase1.5スタブ実装）
         */
        setupEventListeners() {
            console.log('⌨️ ShortcutManager イベントリスナー設定 - Phase1.5スタブ');
            
            // Phase1.5: 基本的なキーボードイベント準備
            document.addEventListener('keydown', (e) => {
                this.handleKeyDown(e);
            });
            
            document.addEventListener('keyup', (e) => {
                this.handleKeyUp(e);
            });
            
            // Phase1.5: フォーカス管理（ブラウザ競合回避）
            document.addEventListener('focusin', (e) => {
                this.handleFocusChange(e);
            });
            
            document.addEventListener('focusout', (e) => {
                this.handleFocusChange(e);
            });
            
            console.log('⌨️ ShortcutManager イベントリスナー設定完了 - Phase1.5スタブ');
        }
        
        /**
         * EventBus連携設定（Phase1.5スタブ実装）
         */
        setupEventBusListeners() {
            if (!this.eventBus) return;
            
            console.log('⌨️ ShortcutManager EventBus連携設定 - Phase1.5スタブ');
            
            // Phase1.5: コンテキスト変更イベント準備（スタブ）
            this.eventBus.on('shortcut:context', (data) => {
                this.setContext(data.context);
            });
            
            // Phase1.5: ショートカット有効/無効切り替えイベント準備（スタブ）
            this.eventBus.on('shortcut:toggle', (data) => {
                this.setEnabled(data.enabled);
            });
            
            console.log('⌨️ ShortcutManager EventBus連携設定完了 - Phase1.5スタブ');
        }
        
        /**
         * キーダウン処理（Phase1.5スタブ実装）
         */
        handleKeyDown(event) {
            if (!this.initializeComplete || !this.enabled) return;
            
            // Phase1.5: キー状態更新
            this.keys.add(event.code);
            
            // Phase1.5: ショートカット判定（スタブ）
            const keyCombo = this.getKeyCombo(event);
            if (keyCombo) {
                const shortcut = this.findShortcut(keyCombo);
                if (shortcut) {
                    console.log(`⌨️ ShortcutManager ショートカット実行: ${keyCombo} -> ${shortcut.action} - Phase1.5スタブ`);
                    
                    // Phase1.5: ブラウザ競合回避（スタブ）
                    if (this.preventDefaults.has(keyCombo)) {
                        event.preventDefault();
                    }
                    
                    // Phase1.5: EventBus経由でアクション実行（スタブ）
                    this.executeShortcut(shortcut, keyCombo);
                    
                    return;
                }
            }
        }
        
        /**
         * キーアップ処理（Phase1.5スタブ実装）
         */
        handleKeyUp(event) {
            if (!this.initializeComplete) return;
            
            this.keys.delete(event.code);
        }
        
        /**
         * フォーカス変更処理（Phase1.5スタブ実装）
         */
        handleFocusChange(event) {
            // Phase1.5: キャンバスフォーカス判定（スタブ）
            const target = event.target;
            this.canvasHasFocus = target && (
                target.tagName === 'CANVAS' || 
                target.closest('#canvas-container') ||
                target.closest('.canvas-area')
            );
            
            console.log(`⌨️ ShortcutManager フォーカス変更: canvas=${this.canvasHasFocus} - Phase1.5スタブ`);
        }
        
        /**
         * キーコンビネーション取得（Phase1.5スタブ実装）
         */
        getKeyCombo(event) {
            const parts = [];
            
            if (event.ctrlKey) parts.push('Ctrl');
            if (event.altKey) parts.push('Alt');
            if (event.shiftKey) parts.push('Shift');
            if (event.metaKey) parts.push('Meta');
            
            parts.push(event.code);
            
            return parts.join('+');
        }
        
        /**
         * ショートカット検索（Phase1.5スタブ実装）
         */
        findShortcut(keyCombo) {
            const contextShortcuts = this.contexts.get(this.activeContext);
            if (contextShortcuts && contextShortcuts.has(keyCombo)) {
                return contextShortcuts.get(keyCombo);
            }
            
            // Phase1.5: デフォルトコンテキストへのフォールバック（スタブ）
            if (this.activeContext !== 'default') {
                const defaultShortcuts = this.contexts.get('default');
                if (defaultShortcuts && defaultShortcuts.has(keyCombo)) {
                    return defaultShortcuts.get(keyCombo);
                }
            }
            
            return null;
        }
        
        /**
         * ショートカット実行（Phase1.5スタブ実装）
         */
        executeShortcut(shortcut, keyCombo) {
            if (!this.eventBus) {
                console.warn('⚠️ ShortcutManager: EventBus未接続 - ショートカット実行不可');
                return;
            }
            
            console.log(`⌨️ ShortcutManager アクション実行: ${shortcut.action} (${keyCombo}) - Phase1.5スタブ`);
            
            // Phase1.5: EventBus経由でのアクション配信（スタブ）
            this.eventBus.emit('shortcut:action', {
                action: shortcut.action,
                keyCombo: keyCombo,
                description: shortcut.description,
                context: this.activeContext
            });
            
            // Phase1.5: 個別アクションイベント配信（スタブ）
            this.eventBus.emit(shortcut.action, { source: 'shortcut', keyCombo });
        }
        
        /**
         * コンテキスト設定（Phase1.5スタブ実装）
         */
        setContext(context) {
            if (this.activeContext !== context) {
                console.log(`⌨️ ShortcutManager コンテキスト変更: ${this.activeContext} -> ${context} - Phase1.5スタブ`);
                this.activeContext = context;
                
                // Phase1.5: EventBus通知（スタブ）
                if (this.eventBus) {
                    this.eventBus.emit('shortcut:context:changed', { 
                        oldContext: this.activeContext, 
                        newContext: context 
                    });
                }
            }
        }
        
        /**
         * 有効/無効設定（Phase1.5スタブ実装）
         */
        setEnabled(enabled) {
            if (this.enabled !== enabled) {
                console.log(`⌨️ ShortcutManager 有効状態変更: ${this.enabled} -> ${enabled} - Phase1.5スタブ`);
                this.enabled = enabled;
                
                // Phase1.5: EventBus通知（スタブ）
                if (this.eventBus) {
                    this.eventBus.emit('shortcut:enabled:changed', { enabled });
                }
            }
        }
        
        /**
         * ショートカット一覧取得（Phase1.5スタブ実装）
         */
        getShortcuts(context = null) {
            const targetContext = context || this.activeContext;
            const contextShortcuts = this.contexts.get(targetContext);
            
            if (!contextShortcuts) {
                return [];
            }
            
            const shortcuts = [];
            for (const [keyCombo, shortcut] of contextShortcuts.entries()) {
                shortcuts.push({
                    keyCombo,
                    action: shortcut.action,
                    description: shortcut.description,
                    context: targetContext
                });
            }
            
            return shortcuts;
        }
        
        /**
         * 現在の状態取得（Phase1.5スタブ実装）
         */
        getShortcutState() {
            return {
                enabled: this.enabled,
                activeContext: this.activeContext,
                canvasHasFocus: this.canvasHasFocus,
                activeKeys: Array.from(this.keys),
                availableContexts: Array.from(this.contexts.keys()),
                initialized: this.initializeComplete,
                setupCompleted: this.isSetup
            };
        }
        
        /**
         * Phase1.5ステータス確認
         */
        getPhase15Status() {
            return {
                phase: 'Phase1.5',
                implementation: 'stub',
                features: {
                    basicShortcuts: this.isSetup ? 'setup' : 'not_setup',
                    contextManagement: 'stub',
                    eventBusIntegration: this.eventBus ? 'connected' : 'disconnected',
                    browserConflictAvoidance: 'stub'
                },
                shortcuts: {
                    total: Array.from(this.contexts.values()).reduce((sum, ctx) => sum + ctx.size, 0),
                    contexts: this.contexts.size,
                    preventDefaults: this.preventDefaults.size
                },
                nextStep: 'DetailedImplementation - Phase別ショートカット・UI統合・アクセシビリティ対応'
            };
        }
        
        /**
         * 🆕 デバッグ情報取得
         */
        getDebugInfo() {
            return {
                enabled: this.enabled,
                initialized: this.initializeComplete,
                setupCompleted: this.isSetup,
                eventBusConnected: !!this.eventBus,
                activeContext: this.activeContext,
                shortcutCount: Array.from(this.contexts.values()).reduce((sum, ctx) => sum + ctx.size, 0),
                contextCount: this.contexts.size,
                canvasHasFocus: this.canvasHasFocus,
                activeKeys: Array.from(this.keys).length
            };
        }
    }

// Managers統一ライフサイクルメソッド一括追加
// NavigationManager・RecordManager・ShortcutManager等に統一ライフサイクルメソッドを追加

(function() {
    'use strict';
    
    console.log('🔧 Managers統一ライフサイクルメソッド一括追加開始');
    
    /**
     * Manager統一ライフサイクルメソッド追加
     * @param {Function} ManagerClass Manager クラス
     * @param {string} className クラス名
     */
    function addLifecycleMethods(ManagerClass, className) {
        if (!ManagerClass) {
            console.warn(`🔧 ${className} not found, skipping lifecycle extension`);
            return;
        }
        
        const prototype = ManagerClass.prototype;
        
        // configure（設定注入）
        if (!prototype.configure) {
            prototype.configure = function(config) {
                this._config = { ...config };
                this._configured = true;
            };
        }
        
        // attach（参照注入）
        if (!prototype.attach) {
            prototype.attach = function(context) {
                this._context = context;
                this._attached = true;
                
                // Manager固有の参照設定
                if (className === 'NavigationManager') {
                    this._canvasManager = context.canvasManager;
                    this._coordinateManager = context.coordinateManager;
                } else if (className === 'CoordinateManager') {
                    this._canvasManager = context.canvasManager || context.canvas;
                } else if (className === 'RecordManager') {
                    // RecordManagerは独立動作
                } else if (className === 'ShortcutManager') {
                    // ShortcutManagerは独立動作
                }
            };
        }
        
        // init（内部初期化）
        if (!prototype.init) {
            prototype.init = function() {
                this._initialized = true;
                
                // Manager固有の初期化処理
                if (className === 'NavigationManager') {
                    // Navigation固有初期化があれば実行
                    if (typeof this.initializeNavigation === 'function') {
                        this.initializeNavigation();
                    }
                } else if (className === 'CoordinateManager') {
                    // Coordinate固有初期化があれば実行
                    if (typeof this.initializeCoordinates === 'function') {
                        this.initializeCoordinates();
                    }
                }
                
                return Promise.resolve();
            };
        }
        
        // isReady（準備完了確認）
        if (!prototype.isReady) {
            prototype.isReady = function() {
                return this._initialized || true;
            };
        }
        
        // dispose（解放）
        if (!prototype.dispose) {
            prototype.dispose = function() {
                this._initialized = false;
                this._attached = false;
                this._configured = false;
                this._context = null;
                this._config = null;
            };
        }
        
        console.log(`🔧 ${className} 統一ライフサイクルメソッド追加完了`);
    }
    
    // 各Manager拡張実行
    const managersToExtend = [
        { class: window.Tegaki?.EventBus, name: 'EventBus' },
        { class: window.Tegaki?.NavigationManager, name: 'NavigationManager' },
        { class: window.Tegaki?.RecordManager, name: 'RecordManager' },
        { class: window.Tegaki?.ShortcutManager, name: 'ShortcutManager' },
        { class: window.Tegaki?.CoordinateManager, name: 'CoordinateManager' }
    ];
    
    for (const manager of managersToExtend) {
        addLifecycleMethods(manager.class, manager.name);
    }
    
    console.log('🔧 Managers統一ライフサイクルメソッド一括追加完了');
    
})();
    
    // Tegaki名前空間にShortcutManagerを公開
    if (typeof window.Tegaki === 'undefined') {
        window.Tegaki = {};
    }
    
    window.Tegaki.ShortcutManager = ShortcutManager;
    
    console.log('⌨️ ShortcutManager Phase1.5スタブ実装（修正版） - 名前空間登録完了');
    console.log('🔧 setupPhase15Shortcuts・enableメソッド追加済み');
    console.log('🔧 次のステップ: 詳細実装・Phase別ショートカット管理・UI統合・アクセシビリティ対応');
    
})();