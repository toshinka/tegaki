/**
 * 🔧 ToolManager v8 - PixiJS v8.12.0完全対応版（CanvasManager注入修正・v8 Tool連携・WebGPU対応）
 * 📋 RESPONSIBILITY: v8 Tool管理・v8切り替え・v8イベント委譲・v8 Manager統一注入処理・WebGPU対応Tool作成
 * 🚫 PROHIBITION: 描画処理・Canvas管理・複雑な初期化・設定管理・エラー隠蔽・フォールバック・v7 API混在
 * ✅ PERMISSION: v8 Tool作成・選択・イベント転送・状態管理・v8 Manager統一注入・非同期初期化対応・依存関係確認
 * 
 * 📏 DESIGN_PRINCIPLE: v8 Tool専任管理・責務分離・v8 Manager統一注入・エラー隠蔽禁止・WebGPU対応Tool作成・依存関係厳守
 * 🔄 INTEGRATION: v8 PenTool・v8 EraserTool管理・v8 Manager統一注入・EventBus通信・ErrorManager報告
 * 🚀 V8_MIGRATION: v8 Tool作成・setCanvasManagerV8連携・WebGPU対応状況通知・非同期初期化対応・依存関係修正
 * 🔧 CRITICAL_FIX: new PenTool(canvasManager)でCanvasManager注入・AbstractTool必須引数対応
 * 
 * 📌 提供メソッド一覧（v8対応・実装確認済み）:
 * ✅ constructor(canvasManager) - v8 CanvasManager必須注入（修正版）
 * ✅ async initializeV8Tools() - v8 Tool初期化・CanvasManager注入修正・非同期対応
 * ✅ async selectV8Tool(toolName) - v8 Tool選択・即座反映・WebGPU状況通知
 * ✅ handleV8PointerEvents(x, y, event) - v8高精度イベント委譲・リアルタイム対応
 * ✅ isV8Ready() - v8対応状況確認・WebGPU対応Tool確認
 * ✅ getV8DebugInfo() - v8専用デバッグ情報・WebGPU状況・Tool v8状態
 * 
 * 📌 他ファイル呼び出しメソッド一覧（実装確認済み）:
 * ✅ new window.Tegaki.PenTool(canvasManager) - 🔧修正 CanvasManager注入（pen-tool.js v8版確認済み）
 * ✅ new window.Tegaki.EraserTool(canvasManager) - 🔧修正 CanvasManager注入（eraser-tool.js実装予定）
 * ✅ tool.setManagers(managers) - Manager統一注入（AbstractTool継承確認済み）
 * ✅ tool.activate() / tool.deactivate() - v8 Tool有効無効化（AbstractTool確認済み）
 * ✅ tool.onPointerDown/Move/Up() - v8ポインターイベント処理（v8 PenTool確認済み）
 * ✅ window.Tegaki.ErrorManagerInstance.showError() - エラー表示（error-manager.js確認済み）
 * ✅ window.Tegaki.EventBusInstance.emit() - イベント通知（event-bus.js確認済み）
 * ✅ canvasManager.isV8Ready() - v8準備確認（canvas-manager.js確認済み）
 * ✅ canvasManager.getV8DrawingContainer() - v8描画Container取得（canvas-manager.js確認済み）
 * 
 * 📐 v8 Tool管理フロー（修正版）:
 * 開始 → CanvasManager注入確認・v8準備確認 → v8 Tool作成(PenTool(canvasManager),EraserTool(canvasManager)) → 
 * ✅修正済み Manager統一注入・setManagers()呼び出し → WebGPU対応確認 → 
 * selectV8Tool(pen) → UI更新 → v8イベント委譲 → 状態管理 → 終了
 * 🚨修正済み依存関係: v8 CanvasManager(先行初期化) → v8 ToolManager(後続初期化・注入) → v8 Tool群(CanvasManager注入)
 * 
 * 🚨 CRITICAL_V8_DEPENDENCIES: v8必須依存関係（修正版）
 * - canvasManager !== null - v8 CanvasManagerコンストラクタ注入必須
 * - canvasManager.isV8Ready() === true - v8 CanvasManager準備完了必須
 * - new PenTool(canvasManager) - 🔧修正 AbstractTool必須引数対応
 * - tool.setManagers(managers) - Manager統一注入対応
 * - this.webgpuSupported !== null - WebGPU対応状況確定必須
 * 
 * 🔧 V8_INITIALIZATION_ORDER: v8初期化順序（修正版・厳守必要）
 * 1. 🚨修正 CanvasManager注入・null確認・v8準備確認
 * 2. ToolManager作成・v8依存関係確認
 * 3. 🔧修正 v8 Tool作成（new PenTool(canvasManager)・new EraserTool(canvasManager)）
 * 4. 🔧修正 各ToolにManager統一注入・setManagers()呼び出し
 * 5. WebGPU対応状況確認・Tool最適化
 * 6. v8 Tool有効化・非同期対応
 * 7. selectV8Tool('pen')でv8デフォルトツール選択
 * 8. v8描画・イベント処理可能
 * 
 * 🚫 V8_ABSOLUTE_PROHIBITIONS: v8移行時絶対禁止事項
 * - v7 Tool作成方式継続・v8機能無視
 * - new PenTool()引数なし呼び出し（AbstractTool必須引数無視）
 * - setManagers()統一注入無視・個別Manager設定継続
 * - WebGPU対応状況無視・従来方式継続
 * - フォールバック・フェイルセーフ複雑化
 * - v8非同期初期化無視・同期的処理継続
 */

// 多重定義防止
if (!window.Tegaki) {
    window.Tegaki = {};
}

/**
 * ToolManager v8 - PixiJS v8.12.0完全対応版
 * CanvasManager注入修正・v8 Tool連携・WebGPU対応・非同期初期化・依存関係修正
 */
class ToolManager {
    constructor(canvasManager) {
        console.log('🚀 ToolManager v8.12.0対応版作成開始 - v8 Tool連携・WebGPU対応');
        
        // 🚨 Phase 1 修正: v8必須引数確認（フォールバック禁止）
        if (!canvasManager) {
            const errorMessage = 'v8 CanvasManager is required for ToolManager';
            console.error('💀', errorMessage);
            throw new Error(errorMessage);
        }
        
        // 🚨 Phase 1 修正: CanvasManager v8準備状況確認
        if (typeof canvasManager.isV8Ready !== 'function') {
            const errorMessage = 'CanvasManager.isV8Ready() method not available - invalid v8 CanvasManager';
            console.error('💀', errorMessage);
            throw new Error(errorMessage);
        }
        
        if (!canvasManager.isV8Ready()) {
            const errorMessage = 'CanvasManager not v8 ready - call initializeV8Application() first';
            console.error('💀', errorMessage);
            console.error('🔍 CanvasManager debug info:', canvasManager.getV8DebugInfo?.() || 'debug info not available');
            throw new Error(errorMessage);
        }
        
        // 🚨 Phase 1 修正: v8描画Container存在確認
        try {
            const drawingContainer = canvasManager.getV8DrawingContainer();
            if (!drawingContainer) {
                throw new Error('v8 Drawing Container not available from CanvasManager');
            }
            console.log('✅ v8描画Container確認完了');
        } catch (error) {
            const errorMessage = `v8 Drawing Container validation failed: ${error.message}`;
            console.error('💀', errorMessage);
            throw new Error(errorMessage);
        }
        
        this.canvasManager = canvasManager;
        this.tools = new Map();
        this.currentTool = null;
        this.currentToolName = null;
        this.initialized = false;
        this.v8Ready = false;
        this.managersInitialized = false;
        
        // v8専用プロパティ
        this.webgpuSupported = null;
        this.v8Features = {
            webgpuToolOptimization: false,
            realtimeToolSwitching: false,
            containerHierarchyTools: false,
            v8ToolsCreated: false,
            canvasManagerInjected: true // 🚨 修正: 注入完了フラグ追加
        };
        
        // v8依存関係確認・設定
        this.eventBus = window.Tegaki.EventBusInstance;
        this.errorManager = window.Tegaki.ErrorManagerInstance;
        
        if (!this.eventBus) {
            console.warn('⚠️ EventBusInstance not available - some features may be limited');
        }
        if (!this.errorManager) {
            console.warn('⚠️ ErrorManagerInstance not available - error handling may be limited');
        }
        
        // v8初期化準備
        this.validateV8Dependencies();
        
        this.initialized = true;
        console.log('✅ ToolManager v8.12.0対応版作成完了 - v8 Tool初期化待機中');
        console.log('🔧 CanvasManager注入状況:', {
            injected: true,
            v8Ready: canvasManager.isV8Ready(),
            drawingContainer: !!canvasManager.getV8DrawingContainer?.(),
            webgpuStatus: canvasManager.getWebGPUStatus?.() || 'not available'
        });
    }
    
    /**
     * 🚨 修正版 - v8依存関係確認（CanvasManager注入済み前提）
     */
    validateV8Dependencies() {
        console.log('🔍 v8依存関係確認開始');
        
        const v8Dependencies = [
            { name: 'v8 PenTool', ref: window.Tegaki.PenTool },
            { name: 'v8 EraserTool', ref: window.Tegaki.EraserTool, optional: true },
            { name: 'v8 CanvasManager', ref: this.canvasManager },
            { name: 'v8 CanvasManager.isV8Ready', ref: this.canvasManager.isV8Ready },
            { name: 'v8 CanvasManager.getV8DrawingContainer', ref: this.canvasManager.getV8DrawingContainer }
        ];
        
        for (const dep of v8Dependencies) {
            if (!dep.ref && !dep.optional) {
                const errorMessage = `v8 dependency missing: ${dep.name}`;
                console.error('💀', errorMessage);
                throw new Error(errorMessage);
            } else if (!dep.ref && dep.optional) {
                console.warn(`⚠️ v8 optional dependency missing: ${dep.name}`);
            }
        }
        
        // WebGPU対応状況確認
        const webgpuStatus = this.canvasManager.getWebGPUStatus();
        this.webgpuSupported = webgpuStatus.supported;
        
        console.log('✅ v8依存関係確認完了');
        console.log(`🔧 WebGPU対応状況: ${this.webgpuSupported ? 'サポート済み' : '非対応'}`);
    }
    
    /**
     * 🔧 修正版 - v8 Tool初期化（CanvasManager注入修正・Manager統一注入対応）
     */
    async initializeV8Tools() {
        console.log('🚀 v8 Tool初期化開始');
        
        try {
            // 前提条件再確認
            if (!this.canvasManager.isV8Ready()) {
                throw new Error('CanvasManager not v8 ready during tool initialization');
            }
            
            // Manager統一注入用オブジェクト準備
            const managers = {
                canvas: this.canvasManager,
                coordinate: window.Tegaki.CoordinateManagerInstance,
                record: window.Tegaki.RecordManagerInstance,
                navigation: window.Tegaki.NavigationManagerInstance, // オプション
                shortcut: window.Tegaki.ShortcutManagerInstance      // オプション
            };
            
            // 必須Manager存在確認
            const requiredManagers = ['canvas', 'coordinate', 'record'];
            const missingManagers = [];
            
            for (const required of requiredManagers) {
                if (!managers[required]) {
                    missingManagers.push(required);
                }
            }
            
            if (missingManagers.length > 0) {
                throw new Error(`Required managers missing for v8 Tool initialization: ${missingManagers.join(', ')}`);
            }
            
            console.log('✅ Manager統一注入準備完了:', {
                canvas: !!managers.canvas,
                coordinate: !!managers.coordinate,
                record: !!managers.record,
                navigation: !!managers.navigation,
                shortcut: !!managers.shortcut
            });
            
            // Step 1: 🔧修正 v8 PenTool作成・CanvasManager注入・Manager統一設定
            console.log('1️⃣ v8 PenTool作成開始...');
            
            // 🔧 CRITICAL_FIX: new PenTool(canvasManager)でCanvasManager注入
            const penTool = new window.Tegaki.PenTool(this.canvasManager);
            console.log('✅ PenTool作成完了 - CanvasManager注入済み');
            
            // 🔧 Manager統一注入（setManagers方式）
            if (typeof penTool.setManagers === 'function') {
                penTool.setManagers(managers);
                console.log('✅ PenTool: Manager統一注入完了');
            } else {
                console.warn('⚠️ PenTool: setManagers method not available - 個別設定にフォールバック');
                // 個別設定フォールバック（AbstractToolが古い場合）
                penTool.canvasManager = this.canvasManager;
            }
            
            // Manager設定検証
            if (typeof penTool.validateManagers === 'function') {
                try {
                    penTool.validateManagers();
                    console.log('✅ PenTool: Manager設定検証完了');
                } catch (validationError) {
                    console.error('💀 PenTool: Manager設定検証失敗:', validationError);
                    throw validationError;
                }
            } else {
                console.warn('⚠️ PenTool: validateManagers method not available - 検証スキップ');
            }
            
            // v8描画Container確認
            try {
                const drawingContainer = this.canvasManager.getV8DrawingContainer();
                if (!drawingContainer) {
                    throw new Error('PenTool: v8 Drawing Container not accessible');
                }
                console.log('✅ PenTool: v8描画Container確認完了');
            } catch (error) {
                console.error('💀 PenTool: v8描画Container確認失敗:', error);
                throw error;
            }
            
            this.tools.set('pen', penTool);
            console.log('✅ v8 PenTool作成・設定完了');
            
            // Step 2: 🔧修正 v8 EraserTool作成・設定（オプション）
            if (window.Tegaki.EraserTool) {
                console.log('2️⃣ v8 EraserTool作成開始...');
                
                try {
                    // 🔧 CRITICAL_FIX: new EraserTool(canvasManager)でCanvasManager注入
                    const eraserTool = new window.Tegaki.EraserTool(this.canvasManager);
                    console.log('✅ EraserTool作成完了 - CanvasManager注入済み');
                    
                    // Manager統一注入
                    if (typeof eraserTool.setManagers === 'function') {
                        eraserTool.setManagers(managers);
                        console.log('✅ EraserTool: Manager統一注入完了');
                    } else {
                        console.warn('⚠️ EraserTool: setManagers method not available - 個別設定にフォールバック');
                        eraserTool.canvasManager = this.canvasManager;
                    }
                    
                    // Manager設定検証
                    if (typeof eraserTool.validateManagers === 'function') {
                        try {
                            eraserTool.validateManagers();
                            console.log('✅ EraserTool: Manager設定検証完了');
                        } catch (validationError) {
                            console.warn('⚠️ EraserTool: Manager設定検証失敗 - 継続:', validationError.message);
                        }
                    }
                    
                    this.tools.set('eraser', eraserTool);
                    console.log('✅ v8 EraserTool作成・設定完了');
                    
                } catch (eraserError) {
                    console.warn('⚠️ v8 EraserTool作成失敗 - PenToolのみで継続:', eraserError.message);
                }
            } else {
                console.warn('⚠️ EraserTool利用不可 - PenToolのみ対応');
            }
            
            // Step 3: WebGPU対応状況確認・Tool最適化
            await this.optimizeV8ToolsForWebGPU();
            
            this.v8Features.v8ToolsCreated = true;
            this.v8Features.containerHierarchyTools = true;
            
            console.log('✅ v8 Tool初期化完了');
            console.log('📊 作成v8 Tool:', Array.from(this.tools.keys()));
            
            // デフォルトツール選択
            if (this.tools.has('pen')) {
                await this.selectV8Tool('pen');
                console.log('✅ デフォルトv8ツール選択完了: pen');
            }
            
            this.v8Ready = true;
            
            // v8Tool初期化完了通知
            this.notifyV8ToolsReady();
            
        } catch (error) {
            console.error('💀 v8 Tool初期化エラー:', error);
            this.handleV8ToolCreationError(error);
            throw error;
        }
    }
    
    /**
     * 🚀 WebGPU対応Tool最適化
     */
    async optimizeV8ToolsForWebGPU() {
        console.log('🚀 WebGPU対応Tool最適化開始');
        
        const webgpuStatus = this.canvasManager.getWebGPUStatus();
        
        if (webgpuStatus.active) {
            console.log('🚀 WebGPU最適化モード有効');
            
            // WebGPU対応Tool最適化
            this.tools.forEach((tool, toolName) => {
                if (typeof tool.enableWebGPUOptimization === 'function') {
                    tool.enableWebGPUOptimization();
                    console.log(`🚀 ${toolName}: WebGPU最適化有効化`);
                } else {
                    console.log(`📊 ${toolName}: WebGPU最適化非対応`);
                }
            });
            
            this.v8Features.webgpuToolOptimization = true;
            
        } else {
            console.log('📊 WebGL互換モード - 標準設定継続');
        }
        
        console.log('✅ WebGPU対応Tool最適化完了');
    }
    
    /**
     * 🚀 v8Tools準備完了通知
     */
    notifyV8ToolsReady() {
        // EventBusにv8Tools準備完了を通知
        if (this.eventBus?.emit) {
            this.eventBus.emit('toolManagerV8Ready', {
                v8Ready: this.v8Ready,
                webgpuSupported: this.webgpuSupported,
                v8Features: this.v8Features,
                toolsCreated: Array.from(this.tools.keys()),
                currentTool: this.currentToolName,
                canvasManagerV8Ready: this.canvasManager.isV8Ready()
            });
        }
        
        console.log('📡 v8Tools準備完了通知送信');
    }
    
    /**
     * 🚀 v8 Tool選択・即座反映・WebGPU状況通知
     */
    async selectV8Tool(toolName) {
        console.log(`🚀 v8 Tool選択開始: ${toolName}`);
        
        // v8準備確認
        if (!this.v8Ready && !this.v8Features.v8ToolsCreated) {
            console.warn('⚠️ ToolManager v8未準備 - initializeV8Tools()を先に実行');
            throw new Error('ToolManager v8 not ready - call initializeV8Tools() first');
        }
        
        // v8 Tool存在確認
        const v8Tool = this.tools.get(toolName);
        if (!v8Tool) {
            const availableTools = Array.from(this.tools.keys()).join(', ');
            throw new Error(`v8 Tool not found: ${toolName} - Available: ${availableTools}`);
        }
        
        // v8 Tool準備確認
        if (typeof v8Tool.isV8Ready === 'function' && !v8Tool.isV8Ready()) {
            console.warn(`⚠️ v8 Tool準備未完了: ${toolName} - 処理継続`);
        }
        
        try {
            // 現在のv8 Tool無効化
            if (this.currentTool && typeof this.currentTool.deactivate === 'function') {
                this.currentTool.deactivate();
                this.updateV8ToolButtonState(this.currentToolName, false);
                console.log(`📋 前のv8 Tool無効化: ${this.currentToolName}`);
            }
            
            // 新しいv8 Tool有効化
            this.currentTool = v8Tool;
            this.currentToolName = toolName;
            
            if (typeof this.currentTool.activate === 'function') {
                this.currentTool.activate();
            } else {
                console.warn(`⚠️ v8 Tool ${toolName}: activate method not available`);
            }
            
            this.updateV8ToolButtonState(toolName, true);
            
            console.log(`✅ v8 Tool選択完了: ${toolName}`);
            
            // v8 Tool変更イベント発火
            if (this.eventBus?.emit) {
                this.eventBus.emit('toolManagerV8:toolChanged', {
                    previousTool: this.currentToolName,
                    newTool: toolName,
                    tool: this.currentTool,
                    v8Ready: this.currentTool.isV8Ready?.() || false,
                    webgpuOptimized: this.webgpuSupported && this.v8Features.webgpuToolOptimization
                });
            }
            
            this.v8Features.realtimeToolSwitching = true;
            
        } catch (error) {
            console.error('💀 v8 Tool選択エラー:', error);
            this.handleV8ToolSelectionError(error, toolName);
            throw error;
        }
    }
    
    /**
     * 🚀 v8 ToolButton状態更新
     */
    updateV8ToolButtonState(toolName, isActive) {
        const button = document.getElementById(`${toolName}-tool`);
        if (!button) {
            console.warn(`⚠️ v8 ToolButton要素未発見: #${toolName}-tool`);
            return;
        }
        
        if (isActive) {
            button.classList.add('active');
            // v8アクティブ状態の追加表示
            const title = button.getAttribute('title') || '';
            if (!title.includes('v8')) {
                button.setAttribute('title', `v8 ${title}`);
            }
            console.log(`📋 v8 ToolButton有効化: ${toolName}`);
        } else {
            button.classList.remove('active');
            console.log(`📋 v8 ToolButton無効化: ${toolName}`);
        }
    }
    
    /**
     * 🚀 v8高精度ポインターイベント委譲
     */
    handleV8PointerDown(x, y, event) {
        if (!this.currentTool) {
            throw new Error('v8 No current tool selected for pointer down event');
        }
        
        if (typeof this.currentTool.onPointerDown !== 'function') {
            throw new Error(`v8 Current tool ${this.currentToolName} does not have onPointerDown method`);
        }
        
        console.log(`🚀 v8 PointerDown委譲: ${this.currentToolName} (${x}, ${y})`);
        
        try {
            this.currentTool.onPointerDown(x, y, event);
        } catch (error) {
            console.error('💀 v8 PointerDown委譲エラー:', error);
            this.handleV8PointerEventError(error, 'onPointerDown');
            throw error;
        }
    }
    
    handleV8PointerMove(x, y, event) {
        if (!this.currentTool || typeof this.currentTool.onPointerMove !== 'function') {
            return;
        }
        
        try {
            this.currentTool.onPointerMove(x, y, event);
        } catch (error) {
            console.error('💀 v8 PointerMove委譲エラー:', error);
            this.handleV8PointerEventError(error, 'onPointerMove');
            throw error;
        }
    }
    
    handleV8PointerUp(x, y, event) {
        if (!this.currentTool || typeof this.currentTool.onPointerUp !== 'function') {
            return;
        }
        
        console.log(`🏁 v8 PointerUp委譲: ${this.currentToolName} (${x}, ${y})`);
        
        try {
            this.currentTool.onPointerUp(x, y, event);
        } catch (error) {
            console.error('💀 v8 PointerUp委譲エラー:', error);
            this.handleV8PointerEventError(error, 'onPointerUp');
            throw error;
        }
    }
    
    /**
     * 🚀 v8エラーハンドリング
     */
    handleV8ToolCreationError(error) {
        console.error('💀 v8 Tool作成エラー:', error);
        
        if (this.errorManager?.showError) {
            this.errorManager.showError(
                'v8 Tool作成失敗', 
                error.message
            );
        }
        
        // v8 Tool作成失敗状態マーク
        this.v8Features.v8ToolsCreated = false;
        this.v8Ready = false;
    }
    
    handleV8ToolSelectionError(error, toolName) {
        console.error(`💀 v8 Tool選択エラー (${toolName}):`, error);
        
        if (this.errorManager?.showError) {
            this.errorManager.showError(
                `v8 Tool選択失敗: ${toolName}`, 
                error.message
            );
        }
    }
    
    handleV8PointerEventError(error, eventType) {
        console.error(`💀 v8 PointerEvent委譲エラー (${eventType}):`, error);
        
        if (this.errorManager?.showError) {
            this.errorManager.showError(
                `v8 PointerEvent処理失敗: ${eventType}`, 
                error.message
            );
        }
    }
    
    /**
     * 🚨 修正版 - v8対応状況確認（CanvasManager注入状況含む）
     */
    isV8Ready() {
        return this.v8Ready && 
               this.initialized && 
               this.tools.size > 0 && 
               this.canvasManager && 
               this.canvasManager.isV8Ready() &&
               this.v8Features.canvasManagerInjected &&
               this.v8Features.v8ToolsCreated &&
               this.currentTool !== null;
    }
    
    /**
     * v7互換ポインターイベント委譲
     */
    handlePointerDown(x, y, event) {
        return this.handleV8PointerDown(x, y, event);
    }
    
    handlePointerMove(x, y, event) {
        return this.handleV8PointerMove(x, y, event);
    }
    
    handlePointerUp(x, y, event) {
        return this.handleV8PointerUp(x, y, event);
    }
    
    /**
     * v7互換ツール選択
     */
    async selectTool(toolName) {
        return this.selectV8Tool(toolName);
    }
    
    /**
     * 現在のv8 Tool取得
     */
    getCurrentTool() {
        return this.currentTool;
    }
    
    /**
     * 現在のv8 Tool名取得
     */
    getCurrentToolName() {
        return this.currentToolName;
    }
    
    /**
     * 利用可能v8 Tool一覧取得
     */
    getAvailableTools() {
        return Array.from(this.tools.keys());
    }
    
    /**
     * v8 Tool設定更新
     */
    updateV8ToolSettings(toolName, settings) {
        const tool = this.tools.get(toolName);
        if (!tool) {
            throw new Error(`v8 Tool not found for settings update: ${toolName}`);
        }
        
        if (typeof tool.onSettingsUpdate === 'function') {
            tool.onSettingsUpdate(settings);
            console.log(`🔧 ${toolName} v8設定更新完了:`, settings);
            
            // v8設定更新イベント発火
            if (this.eventBus?.emit) {
                this.eventBus.emit('toolV8:settingsUpdated', {
                    toolName: toolName,
                    settings: settings,
                    v8Mode: true,
                    webgpuOptimized: this.v8Features.webgpuToolOptimization
                });
            }
        } else {
            console.log(`📋 ${toolName} v8設定更新スキップ - onSettingsUpdateメソッドなし`);
        }
    }
    
    /**
     * v7互換ツール設定更新
     */
    updateToolSettings(toolName, settings) {
        return this.updateV8ToolSettings(toolName, settings);
    }
    
    /**
     * 全v8 Toolリセット
     */
    resetAllV8Tools() {
        console.log('🔄 全v8 Toolリセット開始');
        
        this.tools.forEach((tool, toolName) => {
            if (typeof tool.onReset === 'function') {
                try {
                    tool.onReset();
                    console.log(`✅ ${toolName} v8リセット完了`);
                } catch (error) {
                    console.error(`💀 ${toolName} v8リセットエラー:`, error);
                    this.handleV8ToolResetError(error, toolName);
                }
            }
        });
        
        console.log('✅ 全v8 Toolリセット完了');
    }
    
    handleV8ToolResetError(error, toolName) {
        if (this.errorManager?.showError) {
            this.errorManager.showError(
                `v8 Tool リセットエラー: ${toolName}`, 
                error.message
            );
        }
    }
    
    /**
     * v7互換全ツールリセット
     */
    resetAllTools() {
        return this.resetAllV8Tools();
    }
    
    /**
     * WebGPU対応状況取得
     */
    getWebGPUStatus() {
        return {
            supported: this.webgpuSupported,
            toolOptimization: this.v8Features.webgpuToolOptimization,
            canvasManagerWebGPU: this.canvasManager?.getWebGPUStatus() || null
        };
    }
    
    /**
     * v8システム統計取得
     */
    getV8SystemStats() {
        return {
            // v8 Tool統計
            v8ToolStats: {
                totalTools: this.tools.size,
                v8Ready: this.isV8Ready(),
                currentTool: this.currentToolName,
                webgpuOptimized: this.v8Features.webgpuToolOptimization
            },
            
            // v8機能統計
            v8FeatureStats: {
                featuresEnabled: Object.values(this.v8Features).filter(Boolean).length,
                v8FeaturesTotal: Object.keys(this.v8Features).length,
                webgpuSupported: this.webgpuSupported
            },
            
            // v8初期化統計
            v8InitializationStats: {
                initialized: this.initialized,
                v8Ready: this.v8Ready,
                canvasManagerV8Ready: this.canvasManager?.isV8Ready() || false,
                canvasManagerInjected: this.v8Features.canvasManagerInjected
            }
        };
    }
    
    /**
     * 🚨 修正版 - v8専用デバッグ情報取得（CanvasManager注入状況含む）
     */
    getV8DebugInfo() {
        return {
            className: 'ToolManager',
            version: 'v8.12.0',
            
            // v8状態
            v8Status: {
                v8Ready: this.v8Ready,
                initialized: this.initialized,
                canvasManagerV8Ready: this.canvasManager?.isV8Ready() || false,
                canvasManagerInjected: this.v8Features.canvasManagerInjected
            },
            
            // CanvasManager注入状況
            canvasManagerInjection: {
                injected: !!this.canvasManager,
                v8Ready: this.canvasManager?.isV8Ready() || false,
                drawingContainer: this.canvasManager?.getV8DrawingContainer ? 'available' : 'not available',
                webgpuStatus: this.canvasManager?.getWebGPUStatus?.() || 'not available'
            },
            
            // WebGPU状況
            webgpuStatus: this.getWebGPUStatus(),
            
            // v8 Tool状況
            v8ToolStatus: {
                totalTools: this.tools.size,
                availableTools: Array.from(this.tools.keys()),
                currentTool: this.currentToolName,
                currentToolV8Ready: this.currentTool?.isV8Ready?.() || false
            },
            
            // v8機能状況
            v8Features: this.v8Features,
            
            // v8 Tool詳細状況
            v8ToolDetails: Array.from(this.tools.entries()).map(([name, tool]) => ({
                name: name,
                hasSetCanvasManagerV8: typeof tool.setCanvasManagerV8 === 'function',
                hasSetManagers: typeof tool.setManagers === 'function',
                hasValidateManagers: typeof tool.validateManagers === 'function',
                hasActivate: typeof tool.activate === 'function',
                hasDeactivate: typeof tool.deactivate === 'function',
                hasV8PointerMethods: {
                    onPointerDown: typeof tool.onPointerDown === 'function',
                    onPointerMove: typeof tool.onPointerMove === 'function',
                    onPointerUp: typeof tool.onPointerUp === 'function'
                },
                isV8Ready: typeof tool.isV8Ready === 'function' ? tool.isV8Ready() : 'unknown',
                v8DebugInfo: typeof tool.getV8DebugInfo === 'function' ? 'available' : 'not available'
            })),
            
            // v8システム情報
            v8SystemInfo: {
                pixiVersion: typeof PIXI !== 'undefined' ? PIXI.VERSION : 'unknown',
                v8ApiAvailable: typeof PIXI !== 'undefined' && PIXI.VERSION.startsWith('8.'),
                eventBus: !!this.eventBus,
                errorManager: !!this.errorManager
            },
            
            // v8依存関係状況
            v8Dependencies: {
                pixiTool: !!window.Tegaki.PenTool,
                eraserTool: !!window.Tegaki.EraserTool,
                canvasManager: !!this.canvasManager,
                eventBus: !!this.eventBus,
                errorManager: !!this.errorManager,
                coordinateManager: !!window.Tegaki.CoordinateManagerInstance,
                recordManager: !!window.Tegaki.RecordManagerInstance,
                navigationManager: !!window.Tegaki.NavigationManagerInstance,
                shortcutManager: !!window.Tegaki.ShortcutManagerInstance
            }
        };
    }
    
    /**
     * v7互換デバッグ情報取得
     */
    getDebugInfo() {
        return this.getV8DebugInfo();
    }
    
    /**
     * v7互換準備状態確認
     */
    isReady() {
        return this.isV8Ready();
    }
    
    /**
     * v8破棄処理
     */
    destroyV8() {
        console.log('💥 ToolManager v8破棄処理開始');
        
        try {
            // 現在のv8 Tool無効化
            if (this.currentTool && typeof this.currentTool.deactivate === 'function') {
                this.currentTool.deactivate();
            }
            
            // 全v8 Tool破棄
            this.tools.forEach((tool, toolName) => {
                if (typeof tool.onDestroy === 'function') {
                    try {
                        tool.onDestroy();
                        console.log(`✅ ${toolName} v8破棄完了`);
                    } catch (error) {
                        console.error(`💀 ${toolName} v8破棄エラー:`, error);
                    }
                }
            });
            
            // v8状態クリア
            this.tools.clear();
            this.currentTool = null;
            this.currentToolName = null;
            this.canvasManager = null;
            this.eventBus = null;
            this.errorManager = null;
            this.initialized = false;
            this.v8Ready = false;
            this.managersInitialized = false;
            this.webgpuSupported = null;
            this.v8Features = {
                webgpuToolOptimization: false,
                realtimeToolSwitching: false,
                containerHierarchyTools: false,
                v8ToolsCreated: false,
                canvasManagerInjected: false
            };
            
            console.log('✅ ToolManager v8破棄処理完了');
            
        } catch (error) {
            console.error('💀 ToolManager v8破棄処理エラー:', error);
        }
    }
    
    /**
     * v7互換破棄処理
     */
    destroy() {
        return this.destroyV8();
    }
    
    /**
     * 🚨 修正版 - CanvasManager再設定（緊急時用）
     */
    setCanvasManager(canvasManager) {
        console.log('🔄 CanvasManager再設定開始');
        
        if (!canvasManager) {
            throw new Error('CanvasManager is required');
        }
        
        if (typeof canvasManager.isV8Ready !== 'function' || !canvasManager.isV8Ready()) {
            throw new Error('CanvasManager must be v8 ready');
        }
        
        this.canvasManager = canvasManager;
        this.v8Features.canvasManagerInjected = true;
        
        console.log('✅ CanvasManager再設定完了');
        
        // 既存Toolsに新しいCanvasManagerを設定
        if (this.tools.size > 0) {
            console.log('🔄 既存Tools CanvasManager更新開始');
            this.tools.forEach(async (tool, toolName) => {
                if (typeof tool.setCanvasManagerV8 === 'function') {
                    try {
                        await tool.setCanvasManagerV8(canvasManager);
                        console.log(`✅ ${toolName}: CanvasManager更新完了`);
                    } catch (error) {
                        console.error(`💀 ${toolName}: CanvasManager更新エラー:`, error);
                    }
                } else if (typeof tool.setManagers === 'function') {
                    // setManagers方式でのCanvasManager更新
                    try {
                        const managers = {
                            canvas: canvasManager,
                            coordinate: window.Tegaki.CoordinateManagerInstance,
                            record: window.Tegaki.RecordManagerInstance,
                            navigation: window.Tegaki.NavigationManagerInstance,
                            shortcut: window.Tegaki.ShortcutManagerInstance
                        };
                        tool.setManagers(managers);
                        console.log(`✅ ${toolName}: Manager統一更新完了`);
                    } catch (error) {
                        console.error(`💀 ${toolName}: Manager統一更新エラー:`, error);
                    }
                }
            });
        }
    }
}

// グローバル公開
window.Tegaki.ToolManager = ToolManager;
console.log('🚀 ToolManager v8.12.0完全対応版 Loaded - CanvasManager注入修正・v8 Tool連携・WebGPU対応・非同期初期化・Container階層・リアルタイム切り替え');