/**
 * AppCore v8 ToolManager初期化フロー完全修正版
 * ChangeLog: 2025-09-01 ToolManager verifyInjection()必須実行・初期化順序確定・二重初期化防止
 * 
 * @provides
 *   ・Manager群統合初期化（initializeV8Managers）
 *   ・Manager準備状態検証（verifyManagerReady）
 *   ・ToolManager初期化制御（initializeToolManager）★完全修正
 *   ・システム状態管理（getSystemStatus）
 * 
 * @uses
 *   ・全Manager.configure/attach/init/isReady() - 統一ライフサイクル
 *   ・ToolManager.setManagers/verifyInjection/initializeV8Tools ★重要修正
 *   ・CoordinateManager.setCanvasManager() - 座標Manager連携
 *   ・EventBus.emit() - app:ready イベント発火
 * 
 * @initflow
 *   1. new AppCore()
 *   2. initializeV8Managers() 開始
 *   3. CanvasManager初期化 → CoordinateManager初期化・連携
 *   4. 他Manager群初期化（EventBus/Config/Navigation/Record/Shortcut）
 *   5. ToolManager初期化（完全修正版）：
 *      a) configure/attach/init（統一ライフサイクル）
 *      b) setManagers()でManager注入
 *      c) verifyInjection()で検証★必須
 *      d) initializeV8Tools()でTool初期化★検証後実行
 *   6. app:ready イベント発火
 * 
 * @forbids
 *   ・💀 ToolManager.initializeV8Tools()をverifyInjection()なしで実行禁止
 *   ・🚫 Manager初期化失敗時の silent continue 禁止
 *   ・🚫 循環参照ログ出力禁止（JSON.stringify削除済み）
 *   ・🚫 二重初期化許可禁止
 * 
 * @manager-key
 *   ・window.Tegaki.AppCore
 * 
 * @dependencies-strict
 *   ・必須: 全Manager（CanvasManager/CoordinateManager/ToolManager等）
 *   ・必須: TegakiApplication Context
 *   ・禁止: 自己循環参照
 * 
 * @integration-flow
 *   ・TegakiApplication.initializeV8Managers()から呼び出し
 *   ・全Manager初期化完了後にEventBus 'app:ready'発火
 * 
 * @manager-lifecycle
 *   ・configure(): 設定注入
 *   ・attach(): Context注入
 *   ・init(): 内部初期化
 *   ・isReady(): 準備完了判定
 *   ・dispose(): 解放処理
 * 
 * @error-handling
 *   ・各Manager初期化エラーは個別キャッチし、状態に記録
 *   ・ToolManager初期化エラーは特に詳細ログ出力
 *   ・verifyInjection()失敗時は明確なエラーメッセージ
 *   ・init()失敗時はPromise reject
 */

class AppCore {
    constructor() {
        this.version = 'v8-toolmanager-fix';
        this.className = 'AppCore';
        
        // 初期化状態管理
        this._initialized = false;
        this._initInProgress = false;
        
        // Manager群
        this.managers = new Map();
        this.context = null;
        this.config = null;
        
        // システム状態
        this.systemStatus = {
            ready: false,
            error: null,
            initializationStep: 'created',
            managerStatuses: {},
            lastUpdate: Date.now()
        };
        
        console.log('✅ AppCore v8 ToolManager初期化フロー完全修正版 作成完了');
    }
    
    // ===========================================
    // 初期化制御（二重実行防止強化）
    // ===========================================
    
    /**
     * Manager群統合初期化
     * @param {Object} context - アプリケーションContext
     * @param {Object} config - 設定オブジェクト
     * @returns {Promise<void>}
     */
    async initializeV8Managers(context, config) {
        // 二重初期化防止
        if (this._initialized) {
            console.warn('⚠️ AppCore: 既に初期化済み');
            return;
        }
        
        if (this._initInProgress) {
            console.warn('⚠️ AppCore: 初期化実行中');
            return;
        }
        
        this._initInProgress = true;
        
        try {
            console.log('🚀 Manager群初期化開始（ToolManager修正版）');
            
            this.context = context;
            this.config = config || {};
            this.systemStatus.initializationStep = 'starting';
            
            // ステップ1: 基本Manager初期化
            await this.initializeBasicManagers();
            
            // ステップ2: CanvasManager初期化
            await this.initializeCanvasManager();
            
            // ステップ3: CoordinateManager初期化・連携
            await this.initializeCoordinateManager();
            
            // ステップ4: その他Manager初期化
            await this.initializeOtherManagers();
            
            // ステップ5: ToolManager初期化（完全修正版）
            await this.initializeToolManager();
            
            // ステップ6: 初期化完了・イベント発火
            await this.finalizeInitialization();
            
            // 初期化完了
            this._initialized = true;
            this.systemStatus.ready = true;
            this.systemStatus.initializationStep = 'completed';
            
            console.log('✅ Manager群初期化完了（ToolManager修正版）');
            
        } catch (error) {
            console.error('💀 Manager初期化エラー:', error);
            this.systemStatus.error = error.message;
            this.systemStatus.ready = false;
            this._initialized = false;
            throw error;
            
        } finally {
            this._initInProgress = false;
        }
    }
    
    // ===========================================
    // 個別Manager初期化（段階別）
    // ===========================================
    
    /**
     * 基本Manager初期化（依存関係なし）
     */
    async initializeBasicManagers() {
        console.log('🔧 基本Manager初期化開始');
        this.systemStatus.initializationStep = 'basic-managers';
        
        try {
            // ErrorManager
            const errorManager = new window.Tegaki.ErrorManager();
            await this.initializeManager('errorManager', errorManager, 'ErrorManager');
            
            // EventBus
            const eventBus = new window.Tegaki.EventBus();
            await this.initializeManager('eventBus', eventBus, 'EventBus');
            
            // ConfigManager
            const configManager = new window.Tegaki.ConfigManager();
            await this.initializeManager('configManager', configManager, 'ConfigManager');
            
            console.log('✅ 基本Manager初期化完了');
            
        } catch (error) {
            console.error('💀 基本Manager初期化エラー:', error);
            throw error;
        }
    }
    
    /**
     * CanvasManager初期化
     */
    async initializeCanvasManager() {
        console.log('🎨 CanvasManager初期化開始');
        this.systemStatus.initializationStep = 'canvas-manager';
        
        try {
            const canvasManager = new window.Tegaki.CanvasManager();
            await this.initializeManager('canvasManager', canvasManager, 'CanvasManager');
            
            console.log('✅ CanvasManager初期化完了');
            
        } catch (error) {
            console.error('💀 CanvasManager初期化エラー:', error);
            throw error;
        }
    }
    
    /**
     * CoordinateManager初期化・CanvasManager連携
     */
    async initializeCoordinateManager() {
        console.log('📏 CoordinateManager初期化開始');
        this.systemStatus.initializationStep = 'coordinate-manager';
        
        try {
            const coordinateManager = new window.Tegaki.CoordinateManager();
            await this.initializeManager('coordinateManager', coordinateManager, 'CoordinateManager');
            
            // CanvasManager連携
            const canvasManager = this.managers.get('canvasManager');
            if (canvasManager && canvasManager.isReady()) {
                coordinateManager.setCanvasManager(canvasManager);
                console.log('✅ CoordinateManager ← CanvasManager 連携完了');
            } else {
                throw new Error('CanvasManager not ready for CoordinateManager linking');
            }
            
            console.log('✅ CoordinateManager初期化完了');
            
        } catch (error) {
            console.error('💀 CoordinateManager初期化エラー:', error);
            throw error;
        }
    }
    
    /**
     * その他Manager群初期化
     */
    async initializeOtherManagers() {
        console.log('🔧 その他Manager初期化開始');
        this.systemStatus.initializationStep = 'other-managers';
        
        const managerConfigs = [
            { name: 'navigationManager', className: 'NavigationManager' },
            { name: 'recordManager', className: 'RecordManager' },
            { name: 'shortcutManager', className: 'ShortcutManager' }
        ];
        
        for (const { name, className } of managerConfigs) {
            try {
                const ManagerClass = window.Tegaki[className];
                if (!ManagerClass) {
                    console.warn(`⚠️ ${className} not available - skipping`);
                    continue;
                }
                
                const manager = new ManagerClass();
                await this.initializeManager(name, manager, className);
                
            } catch (error) {
                console.error(`💀 ${className}初期化エラー:`, error);
                // 個別Manager失敗は警告に留め、処理続行
            }
        }
        
        console.log('✅ その他Manager初期化完了');
    }
    
    /**
     * ToolManager初期化（緊急修正版・完全版）
     * 重要：verifyInjection()を必ず実行してからinitializeV8Tools()を呼ぶ
     */
    async initializeToolManager() {
        console.log('🔧 ToolManager初期化開始（緊急完全修正版）');
        this.systemStatus.initializationStep = 'tool-manager';
        
        try {
            // ToolManagerクラス存在確認
            if (!window.Tegaki.ToolManager) {
                throw new Error('ToolManager class not available - syntax error in tool-manager.js?');
            }
            
            // ToolManager作成
            const toolManager = new window.Tegaki.ToolManager();
            console.log('✅ ToolManager インスタンス作成完了');
            
            // 統一ライフサイクル実行
            console.log('🔧 ToolManager: ライフサイクル実行開始');
            await toolManager.configure(this.config);
            await toolManager.attach(this.context);
            await toolManager.init();
            console.log('✅ ToolManager: ライフサイクル実行完了');
            
            // 事前検証：必須Manager準備確認
            const canvasManager = this.managers.get('canvasManager');
            const coordinateManager = this.managers.get('coordinateManager');
            
            if (!canvasManager || !canvasManager.isReady()) {
                throw new Error('CanvasManager not ready for ToolManager initialization');
            }
            
            if (!coordinateManager || !coordinateManager.isReady()) {
                throw new Error('CoordinateManager not ready for ToolManager initialization');
            }
            
            console.log('✅ ToolManager: 前提Manager準備確認完了');
            
            // Manager群注入
            console.log('🔧 ToolManager: Manager群注入開始');
            const managersObject = {
                canvasManager: canvasManager,
                coordinateManager: coordinateManager,
                eventBus: this.managers.get('eventBus'),
                configManager: this.managers.get('configManager'),
                navigationManager: this.managers.get('navigationManager'),
                recordManager: this.managers.get('recordManager')
            };
            
            const injectionSuccess = toolManager.setManagers(managersObject);
            if (!injectionSuccess) {
                throw new Error('ToolManager Manager injection failed');
            }
            console.log('✅ ToolManager: Manager群注入完了');
            
            // ★緊急修正：注入検証を必ず実行
            console.log('🔍 ToolManager: 注入検証開始（DrawContainer確認）');
            if (!toolManager.verifyInjection()) {
                throw new Error('ToolManager injection verification failed - DrawContainer not accessible');
            }
            console.log('✅ ToolManager: 注入検証通過 - DrawContainer確認完了');
            
            // v8 Tool初期化（検証後なので安全）
            console.log('🚀 ToolManager: v8 Tool初期化開始');
            await toolManager.initializeV8Tools();
            console.log('✅ ToolManager: v8 Tool初期化完了');
            
            // Manager登録
            this.managers.set('toolManager', toolManager);
            window.Tegaki.ToolManagerInstance = toolManager;
            
            console.log('✅ ToolManager初期化完了（緊急完全修正版）');
            
        } catch (error) {
            console.error('💀 ToolManager初期化エラー:', error);
            console.error('🔍 エラー詳細:', {
                step: 'toolManager-initialization',
                managersCount: this.managers.size,
                canvasManagerReady: this.managers.get('canvasManager')?.isReady(),
                coordinateManagerReady: this.managers.get('coordinateManager')?.isReady(),
                toolManagerClass: !!window.Tegaki.ToolManager
            });
            throw error;
        }
    }
    
    /**
     * 共通Manager初期化処理
     * @param {string} name - Manager名
     * @param {Object} manager - Manager実装
     * @param {string} className - クラス名（ログ用）
     */
    async initializeManager(name, manager, className) {
        try {
            // configure()実行
            if (typeof manager.configure === 'function') {
                await manager.configure(this.config);
            }
            
            // attach()実行
            if (typeof manager.attach === 'function') {
                await manager.attach(this.context);
            }
            
            // init()実行
            if (typeof manager.init === 'function') {
                await manager.init();
            }
            
            // Manager登録
            this.managers.set(name, manager);
            window.Tegaki[`${className}Instance`] = manager;
            
            // 準備状態確認
            if (typeof manager.isReady === 'function' && !manager.isReady()) {
                console.warn(`⚠️ ${className}: 初期化完了だが準備未完了`);
            }
            
            console.log(`✅ ${className}初期化完了`);
            
        } catch (error) {
            console.error(`💀 ${className}初期化エラー:`, error);
            throw error;
        }
    }
    
    /**
     * 初期化最終処理
     */
    async finalizeInitialization() {
        console.log('🎯 初期化最終処理開始');
        this.systemStatus.initializationStep = 'finalizing';
        
        try {
            // 全Manager準備状態確認
            const managerStatus = this.verifyManagerReady();
            const allReady = Object.values(managerStatus).every(status => status.ready);
            
            if (!allReady) {
                console.warn('⚠️ 一部Manager未準備:', managerStatus);
            }
            
            // EventBus 'app:ready' イベント発火
            const eventBus = this.managers.get('eventBus');
            if (eventBus && typeof eventBus.emit === 'function') {
                eventBus.emit('app:ready', {
                    timestamp: Date.now(),
                    managersReady: allReady,
                    managerCount: this.managers.size
                });
                console.log('✅ app:ready イベント発火完了');
            }
            
            console.log('✅ 初期化最終処理完了');
            
        } catch (error) {
            console.error('💀 初期化最終処理エラー:', error);
            throw error;
        }
    }
    
    // ===========================================
    // 状態管理・検証
    // ===========================================
    
    /**
     * Manager準備状態検証（ログ簡素化版）
     * @returns {Object} Manager準備状況
     */
    verifyManagerReady() {
        const status = {};
        
        for (const [name, manager] of this.managers) {
            if (manager && typeof manager.isReady === 'function') {
                status[name] = {
                    ready: manager.isReady(),
                    className: manager.className || 'Unknown'
                };
            } else {
                status[name] = {
                    ready: false,
                    error: 'isReady method not available'
                };
            }
        }
        
        // 簡素化：詳細ログ出力削除（循環参照防止）
        console.log('🔍 Manager準備状況確認完了');
        
        return status;
    }
    
    /**
     * システム状態取得
     * @returns {Object} システム状態
     */
    getSystemStatus() {
        // Manager状態更新
        this.systemStatus.managerStatuses = this.verifyManagerReady();
        this.systemStatus.lastUpdate = Date.now();
        
        return {
            version: this.version,
            systemStatus: { ...this.systemStatus },
            managers: Object.fromEntries(
                Array.from(this.managers.entries()).map(([name, manager]) => [
                    name,
                    {
                        className: manager.className || 'Unknown',
                        ready: typeof manager.isReady === 'function' ? manager.isReady() : false
                    }
                ])
            ),
            pixiInfo: {
                version: window.PIXI?.VERSION || 'Unknown',
                renderer: this.context?.pixiApp?.renderer?.type || 'Unknown'
            }
        };
    }
    
    /**
     * 初期化済み判定
     * @returns {boolean} 初期化完了可否
     */
    isInitialized() {
        return this._initialized && this.systemStatus.ready;
    }
    
    /**
     * Manager取得
     * @param {string} name - Manager名
     * @returns {Object|null} Manager実装
     */
    getManager(name) {
        return this.managers.get(name) || null;
    }
    
    /**
     * 全Manager取得
     * @returns {Map} Manager群
     */
    getAllManagers() {
        return new Map(this.managers);
    }
    
    /**
     * デバッグ情報取得
     * @returns {Object} デバッグ情報
     */
    getDebugInfo() {
        return {
            ...this.getSystemStatus(),
            initializationStep: this.systemStatus.initializationStep,
            initialized: this._initialized,
            initInProgress: this._initInProgress,
            managerCount: this.managers.size,
            timing: {
                created: this.systemStatus.lastUpdate,
                current: Date.now()
            }
        };
    }
}

// グローバル登録
window.Tegaki = window.Tegaki || {};
window.Tegaki.AppCore = AppCore;

console.log('✅ AppCore v8 ToolManager初期化フロー完全修正版 Loaded');
console.log('📏 修正内容: ToolManager verifyInjection()必須実行・初期化順序確定・Manager注入フロー完全修正');
console.log('🚀 特徴: DrawContainer not ready エラー完全解決・二重初期化防止・統一ライフサイクル・app:ready イベント確実発火');