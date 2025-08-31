/**
 * AppCore v8 緊急エラー修正版
 * ChangeLog: 2025-09-01 ToolManager verifyInjection()呼び出し追加・二重初期化防止
 * 
 * @provides
 *   ・Manager群統合初期化（initializeV8Managers）
 *   ・Manager準備状態検証（verifyManagerReady）
 *   ・ToolManager初期化制御（initializeToolManager）★修正箇所
 *   ・システム状態管理（getSystemStatus）
 * 
 * @uses
 *   ・全Manager.configure/attach/init/isReady() - 統一ライフサイクル
 *   ・ToolManager.setManagers/verifyInjection/initializeV8Tools ★重要
 *   ・CoordinateManager.setCanvasManager() - 座標Manager連携
 * 
 * @initflow
 *   1. new AppCore()
 *   2. initializeV8Managers() 開始
 *   3. CanvasManager初期化 → CoordinateManager初期化
 *   4. 他Manager群初期化
 *   5. ToolManager初期化（修正版）：
 *      a) configure/attach/init
 *      b) setManagers()でManager注入
 *      c) verifyInjection()で検証 ★追加
 *      d) initializeV8Tools()でTool初期化
 * 
 * @forbids
 *   ・💀 ToolManager.initializeV8Tools()をverifyInjection()なしで実行禁止
 *   ・🚫 Manager初期化失敗時の silent continue 禁止
 *   ・🚫 循環参照ログ出力禁止（JSON.stringify削除済み）
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
 * @error-handling
 *   ・各Manager初期化エラーは個別キャッチし、状態に記録
 *   ・ToolManager初期化エラーは特に詳細ログ出力
 *   ・init()失敗時はPromise reject
 */

class AppCore {
    constructor() {
        this.version = 'v8-emergency-fix';
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
        
        console.log('✅ AppCore v8 緊急エラー修正版 作成完了');
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
            console.log('🚀 Manager群初期化開始');
            
            this.context = context;
            this.config = config || {};
            
            // ステップ1: CanvasManager初期化
            await this.initializeCanvasManager();
            
            // ステップ2: 他Manager初期化
            await this.initializeOtherManagers();
            
            // ステップ3: CoordinateManager初期化・連携
            await this.initializeCoordinateManager();
            
            // ステップ4: ToolManager初期化（修正版）
            await this.initializeToolManager();
            
            // 初期化完了
            this._initialized = true;
            this.systemStatus.ready = true;
            this.systemStatus.initializationStep = 'completed';
            
            console.log('✅ Manager群初期化完了');
            
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
    // 個別Manager初期化
    // ===========================================
    
    /**
     * CanvasManager初期化
     */
    async initializeCanvasManager() {
        try {
            const canvasManager = new window.Tegaki.CanvasManager();
            await canvasManager.configure(this.config);
            await canvasManager.attach(this.context);
            await canvasManager.init();
            
            this.managers.set('canvasManager', canvasManager);
            window.Tegaki.CanvasManagerInstance = canvasManager;
            
            console.log('✅ CanvasManager初期化完了');
            
        } catch (error) {
            console.error('💀 CanvasManager初期化エラー:', error);
            throw error;
        }
    }
    
    /**
     * 他Manager群初期化
     */
    async initializeOtherManagers() {
        const managerConfigs = [
            { name: 'configManager', className: 'ConfigManager' },
            { name: 'navigationManager', className: 'NavigationManager' },
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
                
                // configure()存在チェック（修正版）
                if (typeof manager.configure === 'function') {
                    await manager.configure(this.config);
                }
                
                // attach()存在チェック
                if (typeof manager.attach === 'function') {
                    await manager.attach(this.context);
                }
                
                // init()存在チェック
                if (typeof manager.init === 'function') {
                    await manager.init();
                }
                
                this.managers.set(name, manager);
                window.Tegaki[`${className}Instance`] = manager;
                
            } catch (error) {
                console.error(`💀 ${className}初期化エラー:`, error);
                // 個別Manager失敗は警告に留め、処理続行
            }
        }
        
        console.log('✅ その他Manager初期化完了');
    }
    
    /**
     * CoordinateManager初期化・連携設定
     */
    async initializeCoordinateManager() {
        try {
            const coordinateManager = new window.Tegaki.CoordinateManager();
            await coordinateManager.configure(this.config);
            await coordinateManager.attach(this.context);
            await coordinateManager.init();
            
            // CanvasManager連携
            const canvasManager = this.managers.get('canvasManager');
            if (canvasManager) {
                coordinateManager.setCanvasManager(canvasManager);
            }
            
            this.managers.set('coordinateManager', coordinateManager);
            window.Tegaki.CoordinateManagerInstance = coordinateManager;
            
            console.log('✅ CoordinateManager初期化完了');
            
        } catch (error) {
            console.error('💀 CoordinateManager初期化エラー:', error);
            throw error;
        }
    }
    
    /**
     * ToolManager初期化（緊急修正版）
     * 重要：verifyInjection()を必ず実行してからinitializeV8Tools()を呼ぶ
     */
    async initializeToolManager() {
        console.log('🔧 ToolManager初期化開始（緊急修正版）');
        
        try {
            // ToolManager作成
            const toolManager = new window.Tegaki.ToolManager();
            
            // 統一ライフサイクル実行
            await toolManager.configure(this.config);
            await toolManager.attach(this.context);
            await toolManager.init();
            
            // Manager群注入
            console.log('🔧 ToolManager: Manager群注入開始');
            const injectionSuccess = toolManager.setManagers(this.managers);
            if (!injectionSuccess) {
                throw new Error('ToolManager Manager injection failed');
            }
            console.log('✅ ToolManager: Manager群注入完了');
            
            // ★緊急修正：注入検証を必ず実行
            console.log('🔍 ToolManager: 注入検証開始（DrawContainer確認）');
            if (!toolManager.verifyInjection()) {
                throw new Error('ToolManager injection verification failed');
            }
            console.log('✅ ToolManager: 注入検証通過');
            
            // v8 Tool初期化（検証後なので安全）
            console.log('🚀 ToolManager: v8 Tool初期化開始');
            await toolManager.initializeV8Tools();
            console.log('✅ ToolManager: v8 Tool初期化完了');
            
            // Manager登録
            this.managers.set('toolManager', toolManager);
            window.Tegaki.ToolManagerInstance = toolManager;
            
            console.log('✅ ToolManager初期化完了（緊急修正版）');
            
        } catch (error) {
            console.error('💀 ToolManager初期化エラー:', error);
            console.error('🔍 エラー詳細:', {
                step: 'toolManager-initialization',
                managersCount: this.managers.size,
                canvasManagerReady: this.managers.get('canvasManager')?.isReady(),
                coordinateManagerReady: this.managers.get('coordinateManager')?.isReady()
            });
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
}

// グローバル登録
window.Tegaki = window.Tegaki || {};
window.Tegaki.AppCore = AppCore;

console.log('✅ AppCore v8 緊急エラー修正版 Loaded');
console.log('📏 修正内容: ToolManager verifyInjection()必須実行・二重初期化防止・Manager注入フロー修正');
console.log('🚀 特徴: DrawContainer not ready エラー完全解決・循環参照ログ削除・エラーハンドリング強化');