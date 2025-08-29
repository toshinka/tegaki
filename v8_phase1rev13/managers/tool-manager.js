/**
 * 🚀 ToolManager v8.12.0完全対応版 - Manager注入エラー修正版・初期化順序修正・DI形式対応
 * 📋 RESPONSIBILITY: v8 Tool群管理・切り替え・Manager統一注入・CanvasManager連携・描画Container管理
 * 🚫 PROHIBITION: 描画処理・座標変換・UI操作・CanvasManager逆参照・双方向依存・v7 API混在・初期化順序違反
 * ✅ PERMISSION: v8 Tool作成・Manager注入・Tool切り替え・CanvasManager単方向利用・Container取得・EventBus通信
 * 
 * 📏 DESIGN_PRINCIPLE: Tool管理中心・Manager統一注入・CanvasManager単方向依存・v8 Tool連携・DI対応
 * 🔄 INTEGRATION: AppCore→ToolManager作成→Manager注入→v8 Tool初期化→EventBus通知
 * 🚀 V8_MIGRATION: v8 Tool対応・WebGPU対応・Container階層・Manager統一注入・DI形式対応・初期化順序修正
 * 
 * 📌 提供メソッド一覧（v8対応・実装確認済み）:
 * ✅ constructor(canvasManagerOrOptions) - v8対応ToolManager初期化・DI形式対応🚨修正
 * ✅ setManagers(managers) - Manager統一注入（Map→Object確実変換）
 * ✅ initializeV8Tools() - v8 Tool群初期化
 * ✅ switchTool(toolName) - アクティブTool切り替え
 * ✅ getActiveTool() - 現在のアクティブTool取得
 * ✅ getDrawContainer() - v8描画Container取得
 * ✅ handleV8ToolCreationError(toolName, error) - v8 Toolエラー処理
 * ✅ isReady() - 初期化完了確認🚨新規追加
 * 
 * 📌 他ファイル呼び出しメソッド一覧（実装確認済み）:
 * ✅ canvasManager.getDrawContainer() - v8描画Container取得（修正済み）🚨修正
 * ✅ window.Tegaki.AbstractTool.setManagers() - Tool Manager注入（確認済み）
 * ✅ window.Tegaki.PenTool.constructor() - PenTool初期化（確認済み）
 * ✅ window.Tegaki.EraserTool.constructor() - EraserTool初期化（確認済み）
 * ✅ window.Tegaki.ErrorManagerInstance.logError() - エラー記録（確認済み）
 * ✅ window.Tegaki.EventBusInstance.emit() - イベント通知（確認済み）
 * 
 * 📐 初期化フロー（初期化順序修正版）:
 * 開始 → ToolManager作成（CanvasManager注入・遅延初期化）🚨修正 → 
 * Manager統一注入（setManagers）→ v8描画Container取得・検証🚨修正 → 
 * v8 Tool群初期化（PenTool・EraserTool） → アクティブTool設定 → 完了
 * 🚨修正済み依存関係: AppCore→CanvasManager完全初期化→ToolManager作成→Manager注入→描画Container取得→v8 Tool初期化
 * 
 * 🚨 Manager統一登録キー（AppCore連携・受信形式）:
 * - "canvas" → CanvasManager - キャンバス・Container階層管理
 * - "coordinate" → CoordinateManager - 座標変換・高精度変換
 * - "record" → RecordManager - 操作履歴・アンドゥ・リドゥ
 * - "config" → ConfigManager - 設定管理
 * - "error" → ErrorManager - エラー処理
 * - "eventbus" → EventBusInstance - イベント通信
 * - "shortcut" → ShortcutManager - ショートカット管理
 * - "navigation" → NavigationManager - ナビゲーション管理
 * 
 * 🔧 ツール切り替えフロー:
 * switchTool(toolName) → 現在ツールの非アクティブ化 → 新ツールのアクティブ化 → UI更新・EventBus通知
 * 
 * 🔧 Manager注入フロー（初期化順序修正版）:
 * AppCore: Map形式でManager群作成 → ToolManager.setManagers(): Map受信→Object確実変換 → 
 * v8描画Container取得・検証🚨修正 → Tool初期化時: プレーンObject形式でManager注入 → 
 * AbstractTool: Object前提でManager存在確認
 * 
 * 🔑 Manager登録キー: "tool"（AppCore統一登録用）
 */

class ToolManager {
    /**
     * 🚨修正版 - ToolManager初期化・DI形式対応・初期化順序修正
     * @param {CanvasManager|Object} canvasManagerOrOptions - CanvasManager直接またはDIオプション
     */
    constructor(canvasManagerOrOptions) {
        console.log('🚀 ToolManager v8.12.0対応版作成開始 - Manager注入エラー修正版・初期化順序修正');
        
        // 基本プロパティ初期化
        this.canvasManager = null;
        this.drawContainer = null;
        this.tools = new Map();
        this.activeTool = null;
        this.initialized = false;
        
        // Manager管理（修正版）
        this.managers = null;           // Map形式で受信・保持
        this.managersObject = null;     // Object形式で変換・Tool注入用
        this.managersMap = null;        // 代替プロパティ（AppCore互換）
        
        // v8機能対応状況
        this.isWebGPUSupported = false;
        this.v8FeaturesEnabled = false;
        
        // デバッグ情報
        this.debugInfo = {
            constructorInput: null,
            canvasManagerInjection: 'pending',
            managerInjectionStatus: 'pending',
            toolInitializationStatus: 'pending',
            drawContainerStatus: 'pending',
            lastError: null
        };
        
        // 🚨修正: DI形式対応・初期化順序修正
        try {
            this.debugInfo.constructorInput = typeof canvasManagerOrOptions;
            
            // DI Object形式チェック
            if (canvasManagerOrOptions && 
                typeof canvasManagerOrOptions === 'object' && 
                canvasManagerOrOptions.canvasManager) {
                
                console.log('🔧 DI Object形式で受信');
                this.canvasManager = canvasManagerOrOptions.canvasManager;
                this.debugInfo.canvasManagerInjection = 'success - DI object';
                
            } else if (canvasManagerOrOptions && 
                       typeof canvasManagerOrOptions.getDrawContainer === 'function') {
                
                console.log('🔧 CanvasManager直接形式で受信');
                this.canvasManager = canvasManagerOrOptions;
                this.debugInfo.canvasManagerInjection = 'success - direct';
                
            } else {
                throw new Error('ToolManager: 有効なCanvasManagerが必要です（DI形式: {canvasManager} またはCanvasManager直接）');
            }
            
            // 🚨修正重要: CanvasManager検証はするが、getDrawContainer呼び出しは後で行う
            if (!this.canvasManager) {
                throw new Error('ToolManager: CanvasManagerが未設定');
            }
            
            if (typeof this.canvasManager.getDrawContainer !== 'function') {
                throw new Error('ToolManager: CanvasManager.getDrawContainer()メソッドが利用できません');
            }
            
            console.log('✅ CanvasManager注入成功 - getDrawContainerメソッド確認済み');
            console.log('⚠️ 描画Container取得は後続処理で実行（初期化順序修正）');
            
        } catch (error) {
            this.debugInfo.canvasManagerInjection = 'failed';
            this.debugInfo.lastError = error.message;
            console.error('💀 ToolManager初期化エラー:', error);
            throw error;
        }
        
        console.log('🔧 CanvasManager注入状況:', this.debugInfo.canvasManagerInjection);
        console.log('✅ ToolManager v8.12.0対応版作成完了 - Manager注入エラー修正版');
    }
    
    /**
     * Manager統一注入（Map→Object確実変換修正版・描画Container取得追加）
     * @param {Map} managers - AppCoreから受信するManagerのMap
     */
    setManagers(managers) {
        console.log('🔧 ToolManager - Manager統一注入開始（修正版）');
        
        try {
            // 受信データ型確認・デバッグ
            console.log('📦 受信Manager型:', managers?.constructor?.name || 'undefined');
            console.log('📦 受信Manager内容:', managers);
            
            // Map形式での受信確認・代替形式対応
            if (managers instanceof Map) {
                console.log('✅ Map形式で受信');
                this.managers = managers;
                this.managersMap = managers; // 代替プロパティも設定
                
            } else if (managers && typeof managers === 'object' && !Array.isArray(managers)) {
                console.log('🔧 Object形式で受信 - Map変換実行');
                // Object→Map変換
                this.managers = new Map(Object.entries(managers));
                this.managersMap = this.managers;
                console.log('✅ Object→Map変換完了');
                
            } else {
                throw new Error(`ToolManager: ManagerはMap形式またはObject形式で受信する必要があります（受信型: ${managers?.constructor?.name || 'undefined'}）`);
            }
            
            console.log('✅ ToolManager: Manager群保存完了');
            console.log('📋 Manager キー一覧:', Array.from(this.managers.keys()));
            
            // Map→Object確実変換（修正版）
            this.managersObject = Object.fromEntries(this.managers);
            
            // 変換確認・デバッグ
            console.log('📦 Map→Object変換完了');
            console.log('📦 変換後Object型:', this.managersObject?.constructor?.name || 'undefined');
            console.log('📦 変換後Object キー一覧:', Object.keys(this.managersObject || {}));
            
            // 変換成功確認
            if (!this.managersObject || Object.keys(this.managersObject).length === 0) {
                throw new Error('Map→Object変換は成功したが、Objectが空です');
            }
            
            // 必須Manager存在確認
            const requiredManagers = ['canvas', 'coordinate', 'record'];
            const availableKeys = Object.keys(this.managersObject);
            const missingManagers = requiredManagers.filter(key => !availableKeys.includes(key));
            
            if (missingManagers.length > 0) {
                console.warn('⚠️ 必須Manager不足（継続）:', missingManagers.join(', '));
                console.warn('📋 利用可能Manager:', availableKeys);
                // 🚨修正: 必須Manager不足でもエラーではなく警告で継続
            } else {
                console.log('✅ 必須Manager確認完了:', requiredManagers);
            }
            
            // 🚨修正追加: Manager注入完了後にDrawContainer取得実行
            this.initializeDrawContainer();
            
            this.debugInfo.managerInjectionStatus = 'success';
            console.log('✅ ToolManager: Manager統一注入完了（Map→Object変換成功）');
            console.log('📋 利用可能Manager:', availableKeys);
            
        } catch (error) {
            const errorMsg = `Manager統一注入エラー: ${error.message}`;
            console.error('💀 Manager注入エラー:', errorMsg);
            this.debugInfo.managerInjectionStatus = 'failed';
            this.debugInfo.lastError = errorMsg;
            throw new Error(errorMsg);
        }
    }
    
    /**
     * 🚨新規追加 - DrawContainer初期化（Manager注入後実行）
     */
    initializeDrawContainer() {
        console.log('🎨 DrawContainer初期化開始（Manager注入後）');
        
        try {
            // CanvasManager最終確認
            if (!this.canvasManager) {
                throw new Error('DrawContainer初期化: CanvasManagerが未設定');
            }
            
            if (typeof this.canvasManager.getDrawContainer !== 'function') {
                throw new Error('DrawContainer初期化: CanvasManager.getDrawContainer()メソッドが利用できません');
            }
            
            // DrawContainer取得・検証
            const drawContainer = this.canvasManager.getDrawContainer();
            if (!drawContainer) {
                throw new Error('DrawContainer初期化: v8描画Containerの取得に失敗しました');
            }
            
            // Container妥当性確認
            if (!drawContainer.addChild || typeof drawContainer.addChild !== 'function') {
                throw new Error('DrawContainer初期化: 取得したContainerが無効（addChildメソッドなし）');
            }
            
            this.drawContainer = drawContainer;
            this.debugInfo.drawContainerStatus = 'success';
            console.log('✅ DrawContainer初期化完了');
            console.log('📦 v8描画Container取得成功:', !!this.drawContainer);
            
        } catch (error) {
            this.debugInfo.drawContainerStatus = 'failed';
            this.debugInfo.lastError = error.message;
            console.error('💀 DrawContainer初期化エラー:', error);
            throw error;
        }
    }
    
    /**
     * v8依存関係確認
     */
    checkV8Dependencies() {
        console.log('🔍 v8依存関係確認開始');
        
        // PixiJS v8確認
        if (!window.PIXI || !window.PIXI.Application) {
            throw new Error('PixiJS v8が利用できません');
        }
        
        // WebGPU対応確認
        this.isWebGPUSupported = !!window.PIXI.WebGPURenderer;
        
        // v8機能確認
        const v8Features = [
            'Container',
            'Graphics', 
            'Application'
        ];
        
        for (const feature of v8Features) {
            if (!window.PIXI[feature]) {
                throw new Error(`PixiJS v8機能不足: ${feature}`);
            }
        }
        
        this.v8FeaturesEnabled = true;
        console.log('✅ v8依存関係確認完了');
        console.log('🔧 WebGPU対応状況:', this.isWebGPUSupported ? '対応' : '非対応');
    }
    
    /**
     * v8 Tool初期化（修正版）
     */
    async initializeV8Tools() {
        console.log('🚀 v8 Tool初期化開始（修正版）');
        
        try {
            // 前提条件確認
            if (!this.managersObject) {
                throw new Error('Manager統一注入が未完了です。先にsetManagers()を実行してください。');
            }
            
            if (!this.drawContainer) {
                throw new Error('DrawContainer未初期化です。先にinitializeDrawContainer()を実行してください。');
            }
            
            console.log('✅ Manager統一注入準備完了:', typeof this.managersObject);
            console.log('✅ DrawContainer準備完了:', !!this.drawContainer);
            console.log('📋 注入予定Manager キー:', Object.keys(this.managersObject));
            
            // v8依存関係確認
            this.checkV8Dependencies();
            
            // v8 Tool作成・Manager注入
            await this.createV8PenTool();
            await this.createV8EraserTool();
            
            // デフォルトツール設定
            if (this.tools.has('pen')) {
                this.switchTool('pen');
                console.log('✅ デフォルトツール設定完了: pen');
            } else {
                console.warn('⚠️ デフォルトツール(pen)が利用できません');
            }
            
            this.initialized = true;
            this.debugInfo.toolInitializationStatus = 'success';
            console.log('🚀 v8 Tool初期化完了');
            
        } catch (error) {
            this.debugInfo.toolInitializationStatus = 'failed';
            this.debugInfo.lastError = error.message;
            console.error('💀 v8 Tool初期化エラー:', error);
            throw error;
        }
    }
    
    /**
     * v8 PenTool作成（修正版）
     */
    async createV8PenTool() {
        console.log('1️⃣ v8 PenTool作成開始...（修正版）');
        
        try {
            // PenToolクラス確認
            if (!window.Tegaki?.PenTool) {
                throw new Error('PenTool class not available');
            }
            
            // PenTool作成・CanvasManager注入
            const penTool = new window.Tegaki.PenTool();
            
            // CanvasManager注入（利用可能な場合のみ）
            if (typeof penTool.setCanvasManager === 'function') {
                penTool.setCanvasManager(this.canvasManager);
                console.log('✅ PenTool作成完了 - CanvasManager注入済み');
            } else {
                console.warn('⚠️ PenTool.setCanvasManager() not available - スキップ');
            }
            
            // Manager統一注入（Object形式で注入）
            console.log('🔧 PenTool Manager注入開始 - Object形式');
            console.log('📦 注入予定Object:', this.managersObject);
            console.log('📦 注入予定キー:', Object.keys(this.managersObject));
            
            if (typeof penTool.setManagers === 'function') {
                penTool.setManagers(this.managersObject);  // Object形式で注入
                console.log('✅ PenTool Manager統一注入完了');
            } else {
                console.warn('⚠️ PenTool.setManagers() not available - スキップ');
            }
            
            // Tool登録
            this.tools.set('pen', penTool);
            console.log('✅ PenTool登録完了');
            
        } catch (error) {
            console.error('💀 PenTool作成エラー:', error);
            this.handleV8ToolCreationError('pen', error);
            // 🚨修正: PenTool作成失敗でもシステムは継続
        }
    }
    
    /**
     * v8 EraserTool作成（修正版）
     */
    async createV8EraserTool() {
        console.log('2️⃣ v8 EraserTool作成開始...（修正版）');
        
        try {
            // EraserToolクラス確認
            if (!window.Tegaki?.EraserTool) {
                throw new Error('EraserTool class not available');
            }
            
            // EraserTool作成・CanvasManager注入
            const eraserTool = new window.Tegaki.EraserTool();
            
            // CanvasManager注入（利用可能な場合のみ）
            if (typeof eraserTool.setCanvasManager === 'function') {
                eraserTool.setCanvasManager(this.canvasManager);
                console.log('✅ EraserTool作成完了 - CanvasManager注入済み');
            } else {
                console.warn('⚠️ EraserTool.setCanvasManager() not available - スキップ');
            }
            
            // Manager統一注入（Object形式で注入）
            console.log('🔧 EraserTool Manager注入開始 - Object形式');
            
            if (typeof eraserTool.setManagers === 'function') {
                eraserTool.setManagers(this.managersObject);  // Object形式で注入
                console.log('✅ EraserTool Manager統一注入完了');
            } else {
                console.warn('⚠️ EraserTool.setManagers() not available - スキップ');
            }
            
            // Tool登録
            this.tools.set('eraser', eraserTool);
            console.log('✅ EraserTool登録完了');
            
        } catch (error) {
            console.error('💀 EraserTool作成エラー:', error);
            this.handleV8ToolCreationError('eraser', error);
            // 🚨修正: EraserTool作成失敗でもシステムは継続
        }
    }
    
    /**
     * アクティブTool切り替え
     */
    switchTool(toolName) {
        console.log(`🔄 Tool切り替え: ${toolName}`);
        
        if (!this.tools.has(toolName)) {
            console.error(`❌ 未知のTool: ${toolName}`);
            console.log('📋 利用可能Tools:', Array.from(this.tools.keys()));
            return false;
        }
        
        // 現在のTool非アクティブ化
        if (this.activeTool) {
            if (typeof this.activeTool.deactivate === 'function') {
                this.activeTool.deactivate();
                console.log('✅ 前Tool非アクティブ化完了');
            }
        }
        
        // 新しいTool アクティブ化
        this.activeTool = this.tools.get(toolName);
        if (typeof this.activeTool.activate === 'function') {
            this.activeTool.activate();
            console.log('✅ 新Tool アクティブ化完了');
        }
        
        // EventBus通知
        if (window.Tegaki?.EventBusInstance?.emit) {
            window.Tegaki.EventBusInstance.emit('toolSwitched', {
                toolName: toolName,
                previousTool: null // 必要に応じて前Tool名を記録
            });
        }
        
        console.log(`✅ アクティブTool設定完了: ${toolName}`);
        return true;
    }
    
    /**
     * 現在のアクティブTool取得
     */
    getActiveTool() {
        return this.activeTool;
    }
    
    /**
     * v8描画Container取得
     */
    getDrawContainer() {
        if (!this.drawContainer) {
            throw new Error('DrawContainer not initialized - call setManagers() first');
        }
        return this.drawContainer;
    }
    
    /**
     * 🚨新規追加 - 初期化完了確認
     */
    isReady() {
        return this.initialized && 
               !!this.canvasManager && 
               !!this.drawContainer &&
               !!this.managersObject &&
               this.tools.size > 0 &&
               this.debugInfo.managerInjectionStatus === 'success' &&
               this.debugInfo.drawContainerStatus === 'success' &&
               this.debugInfo.toolInitializationStatus === 'success';
    }
    
    /**
     * v8 Toolエラー処理
     */
    handleV8ToolCreationError(toolName, error) {
        console.error(`💀 v8 Tool作成エラー: ${toolName}:`, error);
        
        // エラー情報記録
        if (window.Tegaki?.ErrorManagerInstance?.logError) {
            window.Tegaki.ErrorManagerInstance.logError(`V8 TOOL作成失敗`, `${toolName}: ${error.message}`);
        }
        
        // Tool削除（作成済みの場合）
        if (this.tools.has(toolName)) {
            this.tools.delete(toolName);
            console.log(`🧹 失敗Tool削除完了: ${toolName}`);
        }
        
        // デバッグ情報更新
        this.debugInfo.lastError = `${toolName} creation failed: ${error.message}`;
    }
    
    /**
     * Tool存在確認
     */
    hasTool(toolName) {
        return this.tools.has(toolName);
    }
    
    /**
     * 利用可能Tool一覧取得
     */
    getAvailableTools() {
        return Array.from(this.tools.keys());
    }
    
    /**
     * アクティブTool名取得
     */
    getActiveToolName() {
        if (!this.activeTool) return null;
        
        for (const [toolName, tool] of this.tools) {
            if (tool === this.activeTool) {
                return toolName;
            }
        }
        return 'unknown';
    }
    
    /**
     * Tool統計情報取得
     */
    getToolStats() {
        return {
            totalTools: this.tools.size,
            availableTools: Array.from(this.tools.keys()),
            activeTool: this.getActiveToolName(),
            initialized: this.initialized,
            ready: this.isReady()
        };
    }
    
    /**
     * Manager注入状況確認
     */
    getManagerInjectionStatus() {
        return {
            managersReceived: !!this.managers,
            managersObjectConverted: !!this.managersObject,
            managersMapSet: !!this.managersMap,
            injectionStatus: this.debugInfo.managerInjectionStatus,
            availableManagerKeys: this.managersObject ? Object.keys(this.managersObject) : [],
            requiredManagers: ['canvas', 'coordinate', 'record'],
            missingManagers: this.managersObject ? 
                ['canvas', 'coordinate', 'record'].filter(key => !this.managersObject[key]) : 
                ['canvas', 'coordinate', 'record']
        };
    }
    
    /**
     * CanvasManager連携状況確認
     */
    getCanvasManagerStatus() {
        return {
            canvasManagerInjected: !!this.canvasManager,
            canvasManagerInjectionMethod: this.debugInfo.canvasManagerInjection,
            getDrawContainerAvailable: this.canvasManager && typeof this.canvasManager.getDrawContainer === 'function',
            drawContainerReady: !!this.drawContainer,
            drawContainerStatus: this.debugInfo.drawContainerStatus,
            canvasManagerType: this.canvasManager ? this.canvasManager.constructor.name : 'undefined'
        };
    }
    
    /**
     * 詳細デバッグ情報取得
     */
    getDebugInfo() {
        return {
            // 基本状態
            initialized: this.initialized,
            ready: this.isReady(),
            
            // Tool情報
            toolsCount: this.tools.size,
            toolNames: Array.from(this.tools.keys()),
            activeToolName: this.getActiveToolName(),
            
            // Manager情報
            managersAvailable: this.managersObject ? Object.keys(this.managersObject) : [],
            managerInjectionDetails: this.getManagerInjectionStatus(),
            
            // CanvasManager情報
            canvasManagerDetails: this.getCanvasManagerStatus(),
            
            // v8情報
            isWebGPUSupported: this.isWebGPUSupported,
            v8FeaturesEnabled: this.v8FeaturesEnabled,
            
            // デバッグ状況
            debugInfo: this.debugInfo,
            
            // 統計情報
            toolStats: this.getToolStats()
        };
    }
    
    /**
     * システム状態リセット
     */
    reset() {
        console.log('🔄 ToolManager リセット開始');
        
        try {
            // アクティブTool非アクティブ化
            if (this.activeTool && typeof this.activeTool.deactivate === 'function') {
                this.activeTool.deactivate();
            }
            
            // Tool全削除
            this.tools.clear();
            this.activeTool = null;
            
            // Manager情報クリア
            this.managers = null;
            this.managersObject = null;
            this.managersMap = null;
            
            // 状態リセット
            this.initialized = false;
            this.drawContainer = null;
            
            // デバッグ情報リセット
            this.debugInfo = {
                constructorInput: null,
                canvasManagerInjection: 'pending',
                managerInjectionStatus: 'pending',
                toolInitializationStatus: 'pending',
                drawContainerStatus: 'pending',
                lastError: null
            };
            
            console.log('✅ ToolManager リセット完了');
            
        } catch (error) {
            console.error('❌ ToolManager リセットエラー:', error);
            throw error;
        }
    }
    
    /**
     * EventBus通知ヘルパー
     */
    emitEvent(eventName, data = {}) {
        if (window.Tegaki?.EventBusInstance?.emit) {
            window.Tegaki.EventBusInstance.emit(eventName, {
                source: 'ToolManager',
                timestamp: Date.now(),
                ...data
            });
        }
    }
    
    /**
     * Tool操作履歴記録ヘルパー
     */
    recordToolAction(action, details = {}) {
        if (this.managersObject?.record && typeof this.managersObject.record.recordAction === 'function') {
            this.managersObject.record.recordAction({
                type: 'tool_action',
                action: action,
                tool: this.getActiveToolName(),
                timestamp: Date.now(),
                ...details
            });
        }
    }
}

// グローバル登録
if (!window.Tegaki) window.Tegaki = {};
window.Tegaki.ToolManager = ToolManager;

console.log('🚀 ToolManager v8.12.0完全対応版 Loaded - Manager注入エラー修正版');
console.log('📏 修正内容: Map→Object確実変換・デバッグ強化・型安全性向上・初期化順序修正・DI形式対応');
console.log('🚀 特徴: v8 Tool連携・WebGPU対応・非同期初期化・Container階層・リアルタイム切り替え・Manager統一注入修正');