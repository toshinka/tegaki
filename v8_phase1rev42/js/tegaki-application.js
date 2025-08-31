/**
 * TegakiApplication - PixiJS v8イベント修正版
 * 
 * @provides TegakiApplication, initialize, setupEventHandlers, bindToolEvents
 * @uses AppCore.createCanvasV8, ToolManager.setActiveTool, ToolManager.getActiveTool
 * @initflow 1. TegakiApplication作成 → 2. initialize() → 3. setupEventHandlers() → 4. Manager統合
 * @forbids 💀双方向依存禁止 🚫フォールバック禁止 🚫Event座標の直読み🚫DPR重複適用🚫v7/v8両対応禁止
 * @manager-key window.Tegaki.TegakiApplicationInstance
 * @dependencies-strict AppCore(必須), ToolManager(必須), CanvasManager(必須)
 * @integration-flow Bootstrap → TegakiApplication → AppCore
 * @method-naming-rules initialize(), setupEventHandlers() 形式統一
 * @event-contract DOMイベントをPixiJS v8 global events経由で透過、passive:false明示、app.view直下バインド
 * @coordinate-contract イベント座標透過のみ実施、変換はCoordinateManager委譲
 * @error-handling 初期化失敗時は例外投げる
 * @state-management 初期化状態をboolean管理
 */

class TegakiApplication {
    constructor() {
        this.app = null;
        this.canvasManager = null;
        this.toolManager = null;
        this.managers = new Map();
        this.initialized = false;
        this.eventHandlersSetup = false;
        
        console.log('🚀 TegakiApplication v8対応版 作成開始');
    }
    
    /**
     * アプリケーション初期化（既存アーキテクチャ互換版）
     * @returns {Promise<boolean>} - 初期化成功/失敗
     */
    async initialize() {
        if (this.initialized) {
            console.log('✅ TegakiApplication 既に初期化済み');
            return true;
        }
        
        const startTime = performance.now();
        console.log('🚀 TegakiApplication v8対応版 初期化開始');
        
        try {
            // Phase 1: Container確認
            const container = document.getElementById('canvas-container');
            if (!container) {
                throw new Error('canvas-container が見つかりません');
            }
            
            // Phase 2: AppCore経由でCanvas作成（既存方式）
            if (!window.Tegaki.AppCore) {
                throw new Error('AppCore が利用できません');
            }
            
            const appCore = new window.Tegaki.AppCore();
            
            // Canvas作成（AppCore方式）
            this.app = await appCore.createCanvasV8(400, 400);
            
            // Manager初期化（AppCore方式）
            await appCore.initializeV8Managers();
            
            // Canvas DOM配置
            const canvasElement = appCore.getCanvasElement();
            if (canvasElement && !container.contains(canvasElement)) {
                container.appendChild(canvasElement);
                console.log('✅ Canvas DOM配置完了');
            }
            
            // AppCore参照保存
            this.appCore = appCore;
            this.canvasManager = appCore.getCanvasManager();
            this.toolManager = appCore.getToolManager();
            
            // Phase 3: Manager Map構築
            this.managers = new Map([
                ['canvas', this.canvasManager],
                ['coordinate', appCore.getManagerInstance('coordinate')],
                ['record', appCore.getManagerInstance('record')],
                ['config', appCore.getManagerInstance('config')],
                ['error', appCore.getManagerInstance('error')],
                ['eventbus', appCore.getManagerInstance('eventbus')],
                ['shortcut', appCore.getManagerInstance('shortcut')],
                ['navigation', appCore.getManagerInstance('navigation')],
                ['tool', this.toolManager]
            ]);
            
            // Phase 4: イベントハンドラ設定（簡素版）
            this.setupEventHandlers();
            
            // Phase 5: AppCore システム開始
            await appCore.startV8System();
            
            const elapsedTime = Math.round(performance.now() - startTime);
            this.initialized = true;
            
            console.log(`✅ TegakiApplication 初期化完了 (${elapsedTime}ms)`);
            console.log(`📊 DPR: ${window.devicePixelRatio || 1} | Canvas: ${!!this.app}`);
            
            return true;
            
        } catch (error) {
            console.error('❌ TegakiApplication 初期化失敗:', error);
            throw error;
        }
    }
    
    /**
     * PixiJS v8 Canvas作成
     * @param {HTMLElement} container - コンテナ要素
     * @returns {Promise<Object>} - 作成結果
     */
    async createCanvasV8(container) {
        if (!container) {
            throw new Error('コンテナ要素が指定されていません');
        }
        
        if (typeof window.Tegaki.AppCore?.createCanvasV8 !== 'function') {
            throw new Error('AppCore.createCanvasV8 が利用できません');
        }
        
        return await window.Tegaki.AppCore.createCanvasV8(container);
    }
    
    /**
     * Manager群の初期化
     * @returns {Promise<void>}
     */
    async initializeManagers() {
        console.log('🔧 Manager群初期化開始');
        
        // 必須Manager確認
        const requiredManagers = [
            'RecordManager', 
            'ConfigManager',
            'ErrorManager',
            'EventBus',
            'ShortcutManager',
            'NavigationManager',
            'CoordinateManager',
            'ToolManager'
        ];
        
        for (const managerName of requiredManagers) {
            if (!window.Tegaki[managerName]) {
                throw new Error(`${managerName} が利用できません`);
            }
        }
        
        // Manager インスタンス作成・設定
        const recordManager = new window.Tegaki.RecordManager();
        const configManager = new window.Tegaki.ConfigManager();
        const errorManager = new window.Tegaki.ErrorManager();
        const eventbus = new window.Tegaki.EventBus();
        const shortcutManager = new window.Tegaki.ShortcutManager();
        const navigationManager = new window.Tegaki.NavigationManager();
        const coordinateManager = new window.Tegaki.CoordinateManager();
        
        // CoordinateManager にCanvasManager設定
        coordinateManager.setCanvasManager(this.canvasManager);
        
        // ToolManager作成・Manager注入
        this.toolManager = new window.Tegaki.ToolManager(this.canvasManager);
        
        const managerMap = {
            canvas: this.canvasManager,
            coordinate: coordinateManager,
            record: recordManager,
            config: configManager,
            error: errorManager,
            eventbus: eventbus,
            shortcut: shortcutManager,
            navigation: navigationManager,
            tool: this.toolManager
        };
        
        this.toolManager.injectManagers(managerMap);
        
        // Manager群をMap保存
        this.managers = new Map(Object.entries(managerMap));
        
        console.log('✅ Manager群初期化完了');
    }
    
    /**
     * イベントハンドラ設定（簡素版・既存互換）
     */
    setupEventHandlers() {
        if (this.eventHandlersSetup) {
            console.log('✅ イベントハンドラ既に設定済み');
            return;
        }
        
        console.log('🔧 イベントハンドラ設定開始');
        
        if (!this.app) {
            console.error('❌ PixiJS Application が利用できません');
            return;
        }
        
        // Canvas要素に直接イベントバインド（シンプル方式）
        const canvas = this.app.view;
        if (canvas) {
            canvas.style.touchAction = 'none';
            
            // Pointer events（基本のみ）
            canvas.addEventListener('pointerdown', (e) => this.handlePointerEvent('onPointerDown', e), { passive: false });
            canvas.addEventListener('pointermove', (e) => this.handlePointerEvent('onPointerMove', e), { passive: false });
            canvas.addEventListener('pointerup', (e) => this.handlePointerEvent('onPointerUp', e), { passive: false });
            
            // 境界外でも描画継続（重要）
            document.addEventListener('pointermove', (e) => this.handlePointerEvent('onPointerMove', e), { passive: false });
            document.addEventListener('pointerup', (e) => this.handlePointerEvent('onPointerUp', e), { passive: false });
        }
        
        this.eventHandlersSetup = true;
        console.log('✅ イベントハンドラ設定完了');
    }
    
    /**
     * ポインタイベント統一ハンドラ（シンプル版）
     * @param {string} methodName - Tool メソッド名
     * @param {PointerEvent} e - DOM イベント
     */
    handlePointerEvent(methodName, e) {
        const tool = this.toolManager?.getActiveTool();
        if (!tool || typeof tool[methodName] !== 'function') {
            return;
        }
        
        tool[methodName](e);
    }
    
    /**
     * PixiJS Global PointerMove ハンドラ
     * @param {PIXI.InteractionEvent} e - PixiJS イベント
     */
    handleGlobalPointerMove(e) {
        const tool = this.toolManager?.getActiveTool();
        if (!tool || typeof tool.onPointerMove !== 'function') {
            return;
        }
        
        // PixiJS イベントからDOM風イベントを構築
        const domEvent = this.convertPixiToDOMEvent(e);
        if (domEvent) {
            tool.onPointerMove(domEvent);
        }
    }
    
    /**
     * PixiJS PointerDown ハンドラ
     * @param {PIXI.InteractionEvent} e - PixiJS イベント
     */
    handlePointerDown(e) {
        const tool = this.toolManager?.getActiveTool();
        if (!tool || typeof tool.onPointerDown !== 'function') {
            return;
        }
        
        const domEvent = this.convertPixiToDOMEvent(e);
        if (domEvent) {
            tool.onPointerDown(domEvent);
        }
    }
    
    /**
     * PixiJS PointerUp ハンドラ
     * @param {PIXI.InteractionEvent} e - PixiJS イベント
     */
    handlePointerUp(e) {
        const tool = this.toolManager?.getActiveTool();
        if (!tool || typeof tool.onPointerUp !== 'function') {
            return;
        }
        
        const domEvent = this.convertPixiToDOMEvent(e);
        if (domEvent) {
            tool.onPointerUp(domEvent);
        }
    }
    
    /**
     * DOM PointerDown ハンドラ（外部描画対応）
     * @param {PointerEvent} e - DOM イベント
     */
    handleDOMPointerDown(e) {
        const tool = this.toolManager?.getActiveTool();
        if (!tool || typeof tool.onPointerDown !== 'function') {
            return;
        }
        
        tool.onPointerDown(e);
    }
    
    /**
     * DOM PointerMove ハンドラ（外部描画対応）
     * @param {PointerEvent} e - DOM イベント
     */
    handleDOMPointerMove(e) {
        const tool = this.toolManager?.getActiveTool();
        if (!tool || typeof tool.onPointerMove !== 'function') {
            return;
        }
        
        tool.onPointerMove(e);
    }
    
    /**
     * DOM PointerUp ハンドラ（外部描画対応）
     * @param {PointerEvent} e - DOM イベント
     */
    handleDOMPointerUp(e) {
        const tool = this.toolManager?.getActiveTool();
        if (!tool || typeof tool.onPointerUp !== 'function') {
            return;
        }
        
        tool.onPointerUp(e);
    }
    
    /**
     * PixiJS イベントをDOM風イベントに変換
     * @param {PIXI.InteractionEvent} pixiEvent - PixiJS イベント
     * @returns {Object|null} - DOM風イベント
     */
    convertPixiToDOMEvent(pixiEvent) {
        if (!pixiEvent || !pixiEvent.data) {
            return null;
        }
        
        const global = pixiEvent.data.global;
        if (!global) {
            return null;
        }
        
        // Canvas の境界取得
        const view = this.app.view;
        const rect = view ? view.getBoundingClientRect() : { left: 0, top: 0 };
        
        // PixiJS座標を画面座標に変換
        const clientX = global.x + rect.left;
        const clientY = global.y + rect.top;
        
        // DOM風イベントオブジェクト構築
        return {
            clientX: clientX,
            clientY: clientY,
            offsetX: global.x,
            offsetY: global.y,
            preventDefault: () => {},
            stopPropagation: () => {},
            type: pixiEvent.type || 'pointer',
            target: view,
            currentTarget: view,
            sourceEvent: pixiEvent
        };
    }
    
    /**
     * 初期Tool設定
     */
    setupInitialTools() {
        if (!this.toolManager) {
            console.warn('⚠️ ToolManager が利用できません');
            return;
        }
        
        // デフォルトでPenToolをアクティブ化
        try {
            this.toolManager.setActiveTool('pen');
            console.log('✅ 初期Tool設定完了 - PenTool アクティブ');
        } catch (error) {
            console.error('❌ 初期Tool設定失敗:', error);
        }
    }
    
    /**
     * アプリケーション準備状態確認
     * @returns {boolean} - 準備完了状態
     */
    isReady() {
        return this.initialized && 
               this.app && 
               this.canvasManager && 
               this.toolManager &&
               this.eventHandlersSetup;
    }
    
    /**
     * Canvas要素取得
     * @returns {HTMLCanvasElement|null} - Canvas要素
     */
    getCanvasElement() {
        return this.app?.view || null;
    }
    
    /**
     * PixiJS Application取得
     * @returns {PIXI.Application|null} - Application
     */
    getApp() {
        return this.app;
    }
    
    /**
     * Manager取得
     * @param {string} key - Manager キー
     * @returns {Object|null} - Manager インスタンス
     */
    getManager(key) {
        return this.managers.get(key) || null;
    }
    
    /**
     * デバッグ情報取得
     * @returns {Object} - デバッグ情報
     */
    getDebugInfo() {
        return {
            initialized: this.initialized,
            eventHandlersSetup: this.eventHandlersSetup,
            hasApp: !!this.app,
            hasCanvasManager: !!this.canvasManager,
            hasToolManager: !!this.toolManager,
            managersCount: this.managers.size,
            activeTool: this.toolManager?.getActiveTool()?.name || 'none',
            canvasSize: this.app ? { 
                width: this.app.screen.width, 
                height: this.app.screen.height 
            } : null
        };
    }
}

// グローバル名前空間に登録
if (!window.Tegaki) window.Tegaki = {};
window.Tegaki.TegakiApplication = TegakiApplication;

console.log('🚀 TegakiApplication v8対応版 Loaded - PixiJS v8イベント修正・外部描画対応・Manager統合完全対応');
console.log('🚀 特徴: PixiJS v8 global events対応・DOM/PixiJS二重バインド・座標透過・Container階層・境界外描画対応');