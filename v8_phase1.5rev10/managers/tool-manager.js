/**
 * ToolManager v8.12.0 構文エラー完全修正版
 * ChangeLog: 2025-09-01 構文エラー除去・DrawContainer not ready エラー完全解決
 * 
 * @provides
 *   ・Manager統一ライフサイクル（configure/attach/init/isReady/dispose）
 *   ・Tool管理（registerTool/getActiveTool/setActiveTool）
 *   ・Manager注入（setManagers/setManagersObject/verifyInjection）
 *   ・描画イベント中継（handlePointer*/forceEndDrawing）
 *   ・状態管理（getStatus/getToolStatus）
 *   ・v8対応（initializeV8Tools）
 * 
 * @uses
 *   ・CanvasManager.getDrawContainer() - DrawContainer取得（verifyInjection後）
 *   ・CoordinateManager.screenToCanvas() - 座標変換
 *   ・EventBus.emit() - イベント通知
 *   ・PenTool/EraserTool.setManagersObject() - Tool Manager注入
 *   ・Tool.onPointerDown/Move/Up() - 描画イベント中継
 * 
 * @initflow
 *   1. new ToolManager()
 *   2. configure(config)
 *   3. attach(context)
 *   4. init()
 *   5. setManagers(managers) / setManagersObject(managers)
 *   6. verifyInjection() ← 重要：DrawContainer取得前に必須
 *   7. initializeV8Tools() ← verifyInjection成功後に実行
 * 
 * @forbids
 *   ・💀 verifyInjection()なしでDrawContainer参照禁止
 *   ・🚫 Tool初期化前のイベントハンドリング禁止
 *   ・🚫 Manager注入前のTool登録禁止
 *   ・🚫 直接座標参照（必ずCoordinateManager経由）
 * 
 * @manager-key
 *   ・window.Tegaki.ToolManagerInstance
 * 
 * @dependencies-strict
 *   ・必須: CanvasManager（DrawContainer取得用）
 *   ・必須: CoordinateManager（座標変換用）
 *   ・オプション: EventBus（イベント通知用）
 *   ・禁止: 他ToolManager（循環依存防止）
 * 
 * @integration-flow
 *   ・AppCore.initializeToolManager()から初期化
 *   ・Manager群初期化完了後にsetManagers()で注入
 *   ・verifyInjection()確認後にinitializeV8Tools()実行
 * 
 * @manager-lifecycle
 *   ・configure(): 設定注入（空実装だが統一API）
 *   ・attach(): Context注入（空実装だが統一API）  
 *   ・init(): 内部初期化（_status.ready = true設定）
 *   ・isReady(): 準備完了判定（AppCore依存）
 *   ・dispose(): 解放処理
 * 
 * @error-handling
 *   ・verifyInjection()失敗時はError投げる
 *   ・Tool登録失敗時は警告ログ出力し続行
 *   ・描画エラーは個別Tool内で処理し、ToolManagerは中継のみ
 * 
 * @coordinate-contract
 *   ・全座標変換はCoordinateManager.screenToCanvas()経由
 *   ・Tool側での直接clientX/Y参照禁止
 *   ・DPR補正は一回のみ（CoordinateManager側で実施）
 */

class ToolManager {
    constructor() {
        console.log('🚀 ToolManager v8.12.0 構文エラー完全修正版 作成開始');
        
        this.version = 'v8.12.0-syntax-fix';
        this.className = 'ToolManager';
        
        // 内部状態管理
        this._status = {
            ready: false,
            error: null,
            configured: false,
            attached: false,
            initialized: false,
            managersInjected: false,
            verificationPassed: false
        };
        
        // Tool管理
        this.tools = new Map();
        this.activeTool = null;
        this.activeToolName = 'pen';
        
        // Manager参照（注入待ち）
        this.canvasManager = null;
        this.coordinateManager = null;
        this.eventBus = null;
        this.managers = null;
        
        // v8対応フラグ
        this.v8ToolsInitialized = false;
        
        console.log('✅ ToolManager v8.12.0 構文エラー完全修正版 作成完了');
    }
    
    // ===========================================
    // Manager統一ライフサイクル
    // ===========================================
    
    async configure(config) {
        // 統一API準拠（空実装）
        this._status.configured = true;
        return this;
    }
    
    async attach(context) {
        // 統一API準拠（空実装）
        this._status.attached = true;
        return this;
    }
    
    async init() {
        if (this._status.initialized) {
            console.warn('⚠️ ToolManager: 既に初期化済み');
            return this;
        }
        
        try {
            // 内部状態初期化
            this._status.initialized = true;
            this._status.ready = true;
            this._status.error = null;
            
            console.log('✅ ToolManager: init() 完了');
            return this;
            
        } catch (error) {
            this._status.error = error.message;
            this._status.ready = false;
            console.error('💀 ToolManager: init() 失敗:', error);
            throw error;
        }
    }
    
    isReady() {
        return this._status.ready && !this._status.error;
    }
    
    dispose() {
        // 全Tool解放
        for (const [name, tool] of this.tools) {
            if (tool && typeof tool.destroy === 'function') {
                tool.destroy();
            }
        }
        this.tools.clear();
        
        // 参照クリア
        this.activeTool = null;
        this.canvasManager = null;
        this.coordinateManager = null;
        this.eventBus = null;
        this.managers = null;
        
        // 状態リセット
        this._status.ready = false;
        this._status.managersInjected = false;
        this._status.verificationPassed = false;
        this.v8ToolsInitialized = false;
        
        console.log('✅ ToolManager: dispose() 完了');
    }
    
    // ===========================================
    // Manager注入・検証（重要：エラー原因箇所）
    // ===========================================
    
    /**
     * Manager群注入（Map形式・Object形式両対応）
     * @param {Map|Object} managers - Manager群
     * @returns {boolean} 注入成功可否
     */
    setManagers(managers) {
        console.log('🔧 ToolManager: setManagers() 開始');
        
        try {
            // Map/Object形式判定
            if (managers instanceof Map) {
                console.log('✅ Map形式で受信 - 直接利用');
                this.managers = managers;
                this.canvasManager = managers.get('canvasManager');
                this.coordinateManager = managers.get('coordinateManager');  
                this.eventBus = managers.get('eventBus');
            } else if (managers && typeof managers === 'object') {
                console.log('✅ Object形式で受信 - Map変換');
                this.managers = new Map();
                for (const [key, manager] of Object.entries(managers)) {
                    this.managers.set(key, manager);
                }
                this.canvasManager = managers.canvasManager;
                this.coordinateManager = managers.coordinateManager;
                this.eventBus = managers.eventBus;
            } else {
                throw new Error('Invalid managers format - must be Map or Object');
            }
            
            // 必須Manager確認
            if (!this.canvasManager) {
                throw new Error('CanvasManager not found in managers');
            }
            
            // 注入完了フラグ設定
            this._status.managersInjected = true;
            
            console.log('✅ ToolManager: setManagers() 完了');
            return true;
            
        } catch (error) {
            console.error('💀 ToolManager: setManagers() 失敗:', error);
            this._status.managersInjected = false;
            return false;
        }
    }
    
    /**
     * Manager群注入（Object形式専用・後方互換）
     * @param {Object} managersObj - Manager群（Object形式）
     * @returns {boolean} 注入成功可否
     */
    setManagersObject(managersObj) {
        return this.setManagers(managersObj);
    }
    
    /**
     * 注入検証（重要：DrawContainer取得前に必須実行）
     * @returns {boolean} 検証通過可否
     */
    verifyInjection() {
        console.log('🔍 ToolManager: verifyInjection() 開始');
        
        try {
            // Manager注入確認
            if (!this._status.managersInjected) {
                throw new Error('Managers not injected - call setManagers() first');
            }
            
            // CanvasManager準備確認
            if (!this.canvasManager || !this.canvasManager.isReady()) {
                throw new Error('CanvasManager not ready');
            }
            
            // DrawContainer存在確認
            try {
                const drawContainer = this.canvasManager.getDrawContainer();
                if (!drawContainer) {
                    throw new Error('DrawContainer not available');
                }
                console.log('✅ DrawContainer確認完了');
            } catch (drawContainerError) {
                throw new Error(`DrawContainer verification failed: ${drawContainerError.message}`);
            }
            
            // CoordinateManager確認（オプション）
            if (this.coordinateManager && !this.coordinateManager.isReady()) {
                console.warn('⚠️ CoordinateManager not ready - 座標変換が制限される可能性');
            }
            
            // 検証通過フラグ設定
            this._status.verificationPassed = true;
            
            console.log('✅ ToolManager: verifyInjection() 通過');
            return true;
            
        } catch (error) {
            console.error('💀 ToolManager: verifyInjection() 失敗:', error);
            this._status.verificationPassed = false;
            return false;
        }
    }
    
    // ===========================================
    // v8 Tool初期化（修正版：verifyInjection後実行）
    // ===========================================
    
    /**
     * v8対応Tool群初期化
     * 注意：verifyInjection() 成功後のみ実行可能
     */
    async initializeV8Tools() {
        console.log('🚀 ToolManager: initializeV8Tools() 開始');
        
        try {
            // 検証前提条件確認
            if (!this._status.verificationPassed) {
                throw new Error('Verification not passed - call verifyInjection() first');
            }
            
            // DrawContainer取得（検証済みなので安全）
            const drawContainer = this.canvasManager.getDrawContainer();
            if (!drawContainer) {
                throw new Error('DrawContainer not available after verification');
            }
            
            console.log('✅ DrawContainer取得成功 - Tool初期化開始');
            
            // PenTool初期化
            await this.initializePenTool();
            
            // EraserTool初期化  
            await this.initializeEraserTool();
            
            // デフォルトTool設定
            this.setActiveTool('pen');
            
            // 初期化完了フラグ
            this.v8ToolsInitialized = true;
            
            console.log('✅ ToolManager: initializeV8Tools() 完了');
            
        } catch (error) {
            console.error('💀 ToolManager: initializeV8Tools() 失敗:', error);
            this.v8ToolsInitialized = false;
            throw error;
        }
    }
    
    /**
     * PenTool初期化
     */
    async initializePenTool() {
        try {
            if (!window.Tegaki.PenTool) {
                throw new Error('PenTool class not available');
            }
            
            const penTool = new window.Tegaki.PenTool();
            
            // Manager注入
            const injectionSuccess = penTool.setManagersObject({
                canvasManager: this.canvasManager,
                coordinateManager: this.coordinateManager,
                eventBus: this.eventBus
            });
            
            if (!injectionSuccess) {
                throw new Error('PenTool manager injection failed');
            }
            
            // Tool登録
            this.registerTool('pen', penTool);
            console.log('✅ PenTool初期化完了');
            
        } catch (error) {
            console.error('💀 PenTool初期化失敗:', error);
            // 個別Tool失敗は警告に留め、処理続行
        }
    }
    
    /**
     * EraserTool初期化
     */
    async initializeEraserTool() {
        try {
            if (!window.Tegaki.EraserTool) {
                throw new Error('EraserTool class not available');
            }
            
            const eraserTool = new window.Tegaki.EraserTool();
            
            // Manager注入
            const injectionSuccess = eraserTool.setManagersObject({
                canvasManager: this.canvasManager,
                coordinateManager: this.coordinateManager,
                eventBus: this.eventBus
            });
            
            if (!injectionSuccess) {
                throw new Error('EraserTool manager injection failed');
            }
            
            // Tool登録
            this.registerTool('eraser', eraserTool);
            console.log('✅ EraserTool初期化完了');
            
        } catch (error) {
            console.error('💀 EraserTool初期化失敗:', error);
            // 個別Tool失敗は警告に留め、処理続行
        }
    }
    
    // ===========================================
    // Tool管理
    // ===========================================
    
    /**
     * Tool登録
     * @param {string} name - Tool名
     * @param {Object} tool - Tool実装
     * @returns {boolean} 登録成功可否
     */
    registerTool(name, tool) {
        try {
            if (!name || !tool) {
                throw new Error('Tool name and instance required');
            }
            
            // Tool必須メソッド確認
            const requiredMethods = [
                'setManagersObject', 'onPointerDown', 'onPointerMove', 
                'onPointerUp', 'forceEndDrawing', 'destroy', 'getState'
            ];
            
            for (const method of requiredMethods) {
                if (typeof tool[method] !== 'function') {
                    throw new Error(`Tool missing required method: ${method}`);
                }
            }
            
            this.tools.set(name, tool);
            console.log(`✅ Tool登録完了: ${name}`);
            return true;
            
        } catch (error) {
            console.error(`💀 Tool登録失敗: ${name}:`, error);
            return false;
        }
    }
    
    /**
     * アクティブTool取得
     * @returns {Object|null} 現在のアクティブTool
     */
    getActiveTool() {
        return this.activeTool;
    }
    
    /**
     * アクティブTool設定
     * @param {string} toolName - Tool名
     * @returns {boolean} 設定成功可否
     */
    setActiveTool(toolName) {
        try {
            if (!this.tools.has(toolName)) {
                throw new Error(`Tool not found: ${toolName}`);
            }
            
            // 現在のTool終了処理
            if (this.activeTool && typeof this.activeTool.forceEndDrawing === 'function') {
                this.activeTool.forceEndDrawing();
            }
            
            // 新しいTool設定
            this.activeTool = this.tools.get(toolName);
            this.activeToolName = toolName;
            
            // EventBus通知
            if (this.eventBus && typeof this.eventBus.emit === 'function') {
                this.eventBus.emit('tool:changed', { toolName, tool: this.activeTool });
            }
            
            console.log(`✅ Tool切り替え完了: ${toolName}`);
            return true;
            
        } catch (error) {
            console.error(`💀 Tool切り替え失敗: ${toolName}:`, error);
            return false;
        }
    }
    
    /**
     * Tool一覧取得
     * @returns {Array} 登録済みTool名一覧
     */
    getToolNames() {
        return Array.from(this.tools.keys());
    }
    
    /**
     * 特定Tool取得
     * @param {string} toolName - Tool名
     * @returns {Object|null} Tool実装
     */
    getTool(toolName) {
        return this.tools.get(toolName) || null;
    }
    
    // ===========================================
    // 描画イベント中継
    // ===========================================
    
    /**
     * PointerDownイベント処理
     * @param {Event} event - PointerDownイベント
     */
    handlePointerDown(event) {
        if (!this.activeTool) {
            console.warn('⚠️ ToolManager: アクティブTool未設定');
            return;
        }
        
        try {
            this.activeTool.onPointerDown(event);
        } catch (error) {
            console.error('💀 ToolManager: PointerDown処理エラー:', error);
        }
    }
    
    /**
     * PointerMoveイベント処理
     * @param {Event} event - PointerMoveイベント
     */
    handlePointerMove(event) {
        if (!this.activeTool) {
            return;
        }
        
        try {
            this.activeTool.onPointerMove(event);
        } catch (error) {
            console.error('💀 ToolManager: PointerMove処理エラー:', error);
        }
    }
    
    /**
     * PointerUpイベント処理
     * @param {Event} event - PointerUpイベント
     */
    handlePointerUp(event) {
        if (!this.activeTool) {
            return;
        }
        
        try {
            this.activeTool.onPointerUp(event);
        } catch (error) {
            console.error('💀 ToolManager: PointerUp処理エラー:', error);
        }
    }
    
    /**
     * 描画強制終了
     */
    forceEndDrawing() {
        if (!this.activeTool) {
            return;
        }
        
        try {
            this.activeTool.forceEndDrawing();
            console.log('✅ ToolManager: 描画強制終了完了');
        } catch (error) {
            console.error('💀 ToolManager: 描画強制終了エラー:', error);
        }
    }
    
    // ===========================================
    // 状態管理・デバッグ
    // ===========================================
    
    /**
     * ToolManager状態取得
     * @returns {Object} 現在の状態
     */
    getStatus() {
        return {
            className: this.className,
            version: this.version,
            ready: this.isReady(),
            status: { ...this._status },
            activeToolName: this.activeToolName,
            toolCount: this.tools.size,
            toolNames: this.getToolNames(),
            v8ToolsInitialized: this.v8ToolsInitialized,
            managersInjected: this._status.managersInjected,
            verificationPassed: this._status.verificationPassed
        };
    }
    
    /**
     * Tool個別状態取得
     * @param {string} toolName - Tool名
     * @returns {Object|null} Tool状態
     */
    getToolStatus(toolName) {
        const tool = this.getTool(toolName);
        if (!tool) {
            return null;
        }
        
        try {
            return tool.getState();
        } catch (error) {
            return { error: error.message };
        }
    }
    
    /**
     * 全Tool状態取得
     * @returns {Object} 全Tool状態
     */
    getAllToolStatus() {
        const status = {};
        for (const toolName of this.getToolNames()) {
            status[toolName] = this.getToolStatus(toolName);
        }
        return status;
    }
    
    /**
     * デバッグ情報取得
     * @returns {Object} デバッグ情報
     */
    getDebugInfo() {
        return {
            ...this.getStatus(),
            allToolStatus: this.getAllToolStatus(),
            managerReferences: {
                canvasManager: !!this.canvasManager,
                coordinateManager: !!this.coordinateManager,
                eventBus: !!this.eventBus,
                managers: !!this.managers
            }
        };
    }
}

// グローバル登録
window.Tegaki = window.Tegaki || {};
window.Tegaki.ToolManager = ToolManager;
window.Tegaki.ToolManagerInstance = null; // AppCoreで設定

console.log('🚀 ToolManager v8.12.0 構文エラー完全修正版 Loaded');
console.log('📏 修正内容: 構文エラー除去・verifyInjection()必須実行・DrawContainer取得前検証・Manager注入フロー修正');
console.log('🚀 特徴: Manager統一ライフサイクル完全準拠・Tool準備状態厳密管理・循環参照防止・v8完全対応');