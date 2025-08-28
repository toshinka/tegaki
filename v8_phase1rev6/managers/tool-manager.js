/**
 * 🔧 ToolManager v8 - PixiJS v8.12.0完全対応版（v8 Tool連携・WebGPU対応・非同期初期化）
 * 📋 RESPONSIBILITY: v8 Tool管理・v8切り替え・v8イベント委譲・v8 Manager統一注入処理・WebGPU対応Tool作成
 * 🚫 PROHIBITION: 描画処理・Canvas管理・複雑な初期化・設定管理・エラー隠蔽・フォールバック・v7 API混在
 * ✅ PERMISSION: v8 Tool作成・選択・イベント転送・状態管理・v8 Manager統一注入・非同期初期化対応
 * 
 * 📏 DESIGN_PRINCIPLE: v8 Tool専任管理・責務分離・v8 Manager統一注入・エラー隠蔽禁止・WebGPU対応Tool作成
 * 🔄 INTEGRATION: v8 PenTool・v8 EraserTool管理・v8 Manager統一注入・EventBus通信・ErrorManager報告
 * 🚀 V8_MIGRATION: v8 Tool作成・setCanvasManagerV8連携・WebGPU対応状況通知・非同期初期化対応
 * 
 * 📌 提供メソッド一覧（v8対応）:
 * ✅ async createV8Tools() - v8 Tool作成・setCanvasManagerV8呼び出し・WebGPU対応確認
 * ✅ async initializeV8ToolsWithManagers() - v8 Manager統一注入・非同期対応・WebGPU最適化
 * ✅ selectV8Tool(toolName) - v8 Tool選択・即座反映・WebGPU状況通知
 * ✅ handleV8PointerEvents(x, y, event) - v8高精度イベント委譲・リアルタイム対応
 * ✅ isV8Ready() - v8対応状況確認・WebGPU対応Tool確認
 * ✅ getV8DebugInfo() - v8専用デバッグ情報・WebGPU状況・Tool v8状態
 * 
 * 📌 他ファイル呼び出しメソッド一覧:
 * ✅ new window.Tegaki.PenTool() - v8 PenTool作成（pen-tool.js v8版✅確認済み）
 * ✅ new window.Tegaki.EraserTool() - v8 EraserTool作成（eraser-tool.js🔄実装予定）
 * ✅ tool.setCanvasManagerV8(canvasManager) - v8 CanvasManager設定（AbstractTool v8✅確認済み）
 * ✅ tool.setManagers(managers) - Manager統一注入（AbstractTool継承✅確認済み）
 * ✅ tool.activate() / tool.deactivate() - v8 Tool有効無効化（AbstractTool✅確認済み）
 * ✅ tool.onPointerDown/Move/Up() - v8ポインターイベント処理（v8 PenTool✅確認済み）
 * ✅ window.Tegaki.ErrorManagerInstance.showError() - エラー表示（error-manager.js✅確認済み）
 * ✅ window.Tegaki.EventBusInstance.emit() - イベント通知（event-bus.js✅確認済み）
 * 
 * 📐 v8 Tool管理フロー:
 * 開始 → v8依存関係確認 → v8 Tool作成(PenTool,EraserTool) → setCanvasManagerV8設定 → 
 * WebGPU対応確認 → v8 Manager統一注入 → selectV8Tool(pen) → UI更新 → v8イベント委譲 → 状態管理 → 終了
 * 
 * 🚨 CRITICAL_V8_DEPENDENCIES: v8必須依存関係
 * - window.Tegaki.PenTool !== null - v8 PenToolクラス存在必須
 * - this.canvasManager.isV8Ready() === true - v8 CanvasManager準備必須
 * - tool.setCanvasManagerV8 !== undefined - v8 Tool連携メソッド必須
 * - this.webgpuSupported !== null - WebGPU対応状況確定必須
 * 
 * 🔧 V8_INITIALIZATION_ORDER: v8初期化順序（厳守必要）
 * 1. ToolManager作成・v8依存関係確認
 * 2. v8 Tool作成（PenTool・EraserTool）
 * 3. setCanvasManagerV8でv8 CanvasManager設定
 * 4. WebGPU対応状況確認・Tool最適化
 * 5. v8 Manager統一注入・非同期対応
 * 6. selectV8Tool('pen')でv8デフォルトツール選択
 * 7. v8描画・イベント処理可能
 * 
 * 🚫 V8_ABSOLUTE_PROHIBITIONS: v8移行時絶対禁止事項
 * - v7 Tool作成方式継続・v8機能無視
 * - setCanvasManagerV8無視・v7連携方式継続
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
 * v8 Tool連携・WebGPU対応・非同期初期化
 */
class ToolManager {
    constructor(canvasManager) {
        console.log('🚀 ToolManager v8.12.0対応版作成開始 - v8 Tool連携・WebGPU対応');
        
        // v8必須引数確認（フォールバック禁止）
        if (!canvasManager) {
            throw new Error('v8 CanvasManager is required for ToolManager');
        }
        
        if (!canvasManager.isV8Ready()) {
            throw new Error('CanvasManager not v8 ready - call initializeV8() first');
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
            v8ToolsCreated: false
        };
        
        // v8依存関係確認・設定
        this.eventBus = window.Tegaki.EventBusInstance;
        this.errorManager = window.Tegaki.ErrorManagerInstance;
        
        if (!this.eventBus) {
            throw new Error('v8 EventBusInstance is required');
        }
        if (!this.errorManager) {
            throw new Error('v8 ErrorManagerInstance is required');
        }
        
        // v8初期化準備
        this.validateV8Dependencies();
        
        this.initialized = true;
        console.log('✅ ToolManager v8.12.0対応版作成完了 - v8 Tool作成・Manager注入待機中');
    }
    
    /**
     * 🚀 v8依存関係確認
     */
    validateV8Dependencies() {
        console.log('🔍 v8依存関係確認開始');
        
        const v8Dependencies = [
            { name: 'v8 PenTool', ref: window.Tegaki.PenTool },
            { name: 'v8 EraserTool', ref: window.Tegaki.EraserTool },
            { name: 'v8 CanvasManager', ref: this.canvasManager },
            { name: 'v8 CanvasManager.isV8Ready', ref: this.canvasManager.isV8Ready }
        ];
        
        for (const dep of v8Dependencies) {
            if (!dep.ref) {
                throw new Error(`v8 dependency missing: ${dep.name}`);
            }
        }
        
        // WebGPU対応状況確認
        const webgpuStatus = this.canvasManager.getWebGPUStatus();
        this.webgpuSupported = webgpuStatus.supported;
        
        console.log('✅ v8依存関係確認完了');
        console.log(`🔧 WebGPU対応状況: ${this.webgpuSupported ? 'サポート済み' : '非対応'}`);
    }
    
    /**
     * 🚀 v8 Tool作成（非同期対応・WebGPU最適化）
     */
    async createV8Tools() {
        console.log('🚀 v8 Tool作成開始');
        
        try {
            // Step 1: v8 PenTool作成・設定
            const penTool = new window.Tegaki.PenTool();
            await penTool.setCanvasManagerV8(this.canvasManager);
            this.tools.set('pen', penTool);
            console.log('✅ v8 PenTool作成・設定完了');
            
            // Step 2: v8 EraserTool作成・設定
            if (window.Tegaki.EraserTool) {
                const eraserTool = new window.Tegaki.EraserTool();
                if (typeof eraserTool.setCanvasManagerV8 === 'function') {
                    await eraserTool.setCanvasManagerV8(this.canvasManager);
                } else {
                    console.warn('⚠️ EraserTool v8対応未完了 - 基本設定のみ');
                    eraserTool.canvasManager = this.canvasManager;
                }
                this.tools.set('eraser', eraserTool);
                console.log('✅ v8 EraserTool作成・設定完了');
            } else {
                console.warn('⚠️ EraserTool利用不可 - PenToolのみ対応');
            }
            
            // Step 3: WebGPU対応状況確認・Tool最適化
            await this.optimizeV8ToolsForWebGPU();
            
            this.v8Features.v8ToolsCreated = true;
            this.v8Features.containerHierarchyTools = true;
            
            console.log('✅ v8 Tool作成完了');
            console.log('📊 作成v8 Tool:', Array.from(this.tools.keys()));
            
        } catch (error) {
            console.error('💀 v8 Tool作成エラー:', error);
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
     * 🚀 v8 Manager統一注入（非同期対応）
     */
    async initializeV8ToolsWithManagers(coordinateManager, recordManager, navigationManager, shortcutManager) {
        console.log('🚀 v8 Manager統一注入処理開始');
        
        try {
            // v8 Tool作成確認
            if (this.tools.size === 0) {
                await this.createV8Tools();
            }
            
            // Manager収集
            const v8RequiredManagers = this.collectV8RequiredManagers(
                coordinateManager, 
                recordManager, 
                navigationManager, 
                shortcutManager
            );
            
            // 各v8 ToolにManager統一注入
            for (const [toolName, tool] of this.tools) {
                console.log(`🔧 ${toolName} v8 Manager統一注入開始`);
                
                // setManagersメソッド確認
                if (typeof tool.setManagers !== 'function') {
                    throw new Error(`${toolName}: setManagers method not available for v8`);
                }
                
                // v8 Manager統一注入実行
                await tool.setManagers(v8RequiredManagers);
                console.log(`✅ ${toolName} v8 Manager統一注入完了`);
                
                // v8 Manager設定後の検証
                if (typeof tool.validateManagers === 'function') {
                    tool.validateManagers();
                    console.log(`✅ ${toolName} v8 Manager設定検証完了`);
                }
            }
            
            this.managersInitialized = true;
            this.v8Features.realtimeToolSwitching = true;
            this.v8Ready = true;
            
            console.log('✅ v8 Manager統一注入処理完了');
            
            // v8デフォルトツール選択
            await this.selectV8Tool('pen');
            
            // v8ToolManager準備完了通知
            this.notifyV8ToolManagerReady();
            
        } catch (error) {
            console.error('💀 v8 Manager統一注入エラー:', error);
            throw error;
        }
    }
    
    /**
     * 🚀 v8必要Manager収集
     */
    collectV8RequiredManagers(coordinateManager, recordManager, navigationManager, shortcutManager) {
        console.log('🔧 v8必要Manager収集開始');
        
        // v8必須Manager確認
        if (!coordinateManager) {
            throw new Error('v8 CoordinateManager is required');
        }
        if (!recordManager) {
            throw new Error('v8 RecordManager is required');
        }
        
        const v8RequiredManagers = {
            canvas: this.canvasManager,       // v8 CanvasManager
            coordinate: coordinateManager,    // v8対応必須
            record: recordManager,            // v8対応必須
            navigation: navigationManager,    // v8対応オプション
            shortcut: shortcutManager         // v8対応オプション
        };
        
        console.log('✅ v8必要Manager収集完了');
        console.log('📊 v8 Manager状況:', {
            canvas: !!v8RequiredManagers.canvas && this.canvasManager.isV8Ready(),
            coordinate: !!v8RequiredManagers.coordinate,
            record: !!v8RequiredManagers.record,
            navigation: !!v8RequiredManagers.navigation,
            shortcut: !!v8RequiredManagers.shortcut
        });
        
        return v8RequiredManagers;
    }
    
    /**
     * 🚀 v8ToolManager準備完了通知
     */
    notifyV8ToolManagerReady() {
        // EventBusにv8ToolManager準備完了を通知
        if (this.eventBus?.emit) {
            this.eventBus.emit('toolManagerV8Ready', {
                v8Ready: this.v8Ready,
                webgpuSupported: this.webgpuSupported,
                v8Features: this.v8Features,
                toolsCreated: Array.from(this.tools.keys()),
                currentTool: this.currentToolName
            });
        }
        
        console.log('📡 v8ToolManager準備完了通知送信');
    }
    
    /**
     * 🚀 v8 Tool選択・即座反映・WebGPU状況通知
     */
    async selectV8Tool(toolName) {
        console.log(`🚀 v8 Tool選択開始: ${toolName}`);
        
        // v8準備確認
        if (!this.v8Ready) {
            throw new Error('ToolManager v8 not ready - call initializeV8ToolsWithManagers first');
        }
        
        // Manager注入確認
        if (!this.managersInitialized) {
            throw new Error('v8 Managers not initialized - call initializeV8ToolsWithManagers first');
        }
        
        // v8 Tool存在確認
        const v8Tool = this.tools.get(toolName);
        if (!v8Tool) {
            throw new Error(`v8 Tool not found: ${toolName} - Available: ${Array.from(this.tools.keys()).join(', ')}`);
        }
        
        // v8 Tool準備確認
        if (typeof v8Tool.isV8Ready === 'function' && !v8Tool.isV8Ready()) {
            throw new Error(`v8 Tool not ready: ${toolName} - v8 initialization incomplete`);
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
                throw new Error(`v8 Tool ${toolName} does not have activate method`);
            }
            
            this.updateV8ToolButtonState(toolName, true);
            
            console.log(`✅ v8 Tool選択完了: ${toolName}`);
            
            // v8 Tool変更イベント発火
            this.eventBus.emit('toolManagerV8:toolChanged', {
                previousTool: this.currentToolName,
                newTool: toolName,
                tool: this.currentTool,
                v8Ready: this.currentTool.isV8Ready?.() || false,
                webgpuOptimized: this.webgpuSupported && this.v8Features.webgpuToolOptimization
            });
            
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
                button.setAttribute('title', `v8${title}`);
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
     * 🚀 v8対応状況確認
     */
    isV8Ready() {
        return this.v8Ready && 
               this.initialized && 
               this.managersInitialized &&
               this.tools.size > 0 && 
               this.canvasManager && 
               this.canvasManager.isV8Ready() &&
               this.currentTool !== null &&
               this.v8Features.v8ToolsCreated;
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
            this.eventBus.emit('toolV8:settingsUpdated', {
                toolName: toolName,
                settings: settings,
                v8Mode: true,
                webgpuOptimized: this.v8Features.webgpuToolOptimization
            });
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
                managersInitialized: this.managersInitialized,
                v8Ready: this.v8Ready,
                canvasManagerV8Ready: this.canvasManager?.isV8Ready() || false
            }
        };
    }
    
    /**
     * 🚀 v8専用デバッグ情報取得
     */
    getV8DebugInfo() {
        return {
            className: 'ToolManager',
            version: 'v8.12.0',
            
            // v8状態
            v8Status: {
                v8Ready: this.v8Ready,
                initialized: this.initialized,
                managersInitialized: this.managersInitialized,
                canvasManagerV8Ready: this.canvasManager?.isV8Ready() || false
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
                v8ToolsCreated: false
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
}

// グローバル公開
window.Tegaki.ToolManager = ToolManager;
console.log('🚀 ToolManager v8.12.0完全対応版 Loaded - v8 Tool連携・WebGPU対応・非同期初期化・Container階層・リアルタイム切り替え');