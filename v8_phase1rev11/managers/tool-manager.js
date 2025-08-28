/**
 * 🚀 ToolManager v8.12.0完全対応版 - Manager注入エラー修正版
 * 
 * 【提供するメソッド一覧】
 * - constructor(canvasManager) - v8対応ToolManager初期化
 * - setManagers(managers) - Manager統一注入（Map→Object確実変換）
 * - initializeV8Tools() - v8 Tool群初期化
 * - switchTool(toolName) - アクティブTool切り替え
 * - getActiveTool() - 現在のアクティブTool取得
 * - getDrawContainer() - v8描画Container取得
 * - handleV8ToolCreationError(toolName, error) - v8 Toolエラー処理
 * 
 * 【他ファイルから呼び出すメソッド一覧】
 * - CanvasManager.getDrawContainer() - v8描画Container取得
 * - AbstractTool.setManagers() - Tool Manager注入
 * - PenTool.constructor() - PenTool初期化
 * - EraserTool.constructor() - EraserTool初期化
 * - ErrorManager.logError() - エラー記録
 * 
 * 【Manager登録キー】
 * - canvas - CanvasManager
 * - coordinate - CoordinateManager  
 * - record - RecordManager
 * - config - ConfigManager
 * - error - ErrorManager
 * - event - EventBus
 * - shortcut - ShortcutManager
 * - navigation - NavigationManager
 * 
 * 【ツール切り替えフロー】
 * 1. switchTool(toolName) - ツール名指定
 * 2. 現在ツールの非アクティブ化
 * 3. 新ツールのアクティブ化
 * 4. UI更新・イベント通知
 * 
 * 【Manager注入フロー】
 * 1. AppCore: Map形式でManager群作成
 * 2. ToolManager.setManagers(): Map受信→Object確実変換
 * 3. Tool初期化時: プレーンObject形式でManager注入
 * 4. AbstractTool: Object前提でManager存在確認
 */

class ToolManager {
    constructor(canvasManager) {
        console.log('🚀 ToolManager v8.12.0対応版作成開始 - Manager注入エラー修正版');
        
        // v8描画Container取得・検証
        if (!canvasManager || typeof canvasManager.getDrawContainer !== 'function') {
            throw new Error('ToolManager: 有効なCanvasManagerが必要です');
        }
        
        const drawContainer = canvasManager.getDrawContainer();
        if (!drawContainer) {
            throw new Error('ToolManager: v8描画Containerの取得に失敗しました');
        }
        console.log('📦 v8描画Container取得完了');
        
        // 基本プロパティ
        this.canvasManager = canvasManager;
        this.drawContainer = drawContainer;
        this.tools = new Map();
        this.activeTool = null;
        
        // Manager管理（修正版）
        this.managers = null;           // Map形式で受信・保持
        this.managersObject = null;     // Object形式で変換・Tool注入用
        
        // v8機能対応状況
        this.isWebGPUSupported = false;
        this.v8FeaturesEnabled = false;
        
        // デバッグ情報
        this.debugInfo = {
            managerInjectionStatus: 'pending',
            toolInitializationStatus: 'pending',
            lastError: null
        };
        
        console.log('🔧 CanvasManager注入状況:', typeof canvasManager);
        console.log('✅ ToolManager v8.12.0対応版作成完了 - Manager注入エラー修正版');
    }
    
    /**
     * Manager統一注入（Map→Object確実変換修正版）
     * @param {Map} managers - AppCoreから受信するManagerのMap
     */
    setManagers(managers) {
        console.log('🔧 ToolManager - Manager統一注入開始（修正版）');
        
        // 受信データ型確認・デバッグ
        console.log('📦 受信Manager型:', managers?.constructor?.name || 'undefined');
        console.log('📦 受信Manager内容:', managers);
        
        // Map形式での受信確認
        if (!managers || !(managers instanceof Map)) {
            const errorMsg = `ToolManager: ManagerはMap形式で受信する必要があります（受信型: ${managers?.constructor?.name || 'undefined'}）`;
            console.error('💀 Manager注入エラー:', errorMsg);
            this.debugInfo.managerInjectionStatus = 'failed - invalid type';
            throw new Error(errorMsg);
        }
        
        // Map形式で保存
        this.managers = managers;
        console.log('✅ ToolManager: Manager群をMap形式で保存完了');
        console.log('📋 Map Manager キー一覧:', Array.from(managers.keys()));
        
        // Map→Object確実変換（修正版）
        try {
            this.managersObject = Object.fromEntries(managers);
            
            // 変換確認・デバッグ
            console.log('📦 Map→Object変換完了');
            console.log('📦 変換後Object型:', this.managersObject?.constructor?.name || 'undefined');
            console.log('📦 変換後Object キー一覧:', Object.keys(this.managersObject || {}));
            console.log('📦 変換後Object内容確認:', this.managersObject);
            
            // 変換成功確認
            if (!this.managersObject || Object.keys(this.managersObject).length === 0) {
                throw new Error('Map→Object変換は成功したが、Objectが空です');
            }
            
            this.debugInfo.managerInjectionStatus = 'success';
            console.log('✅ ToolManager: Manager統一注入完了（Map→Object変換成功）');
            
        } catch (error) {
            const errorMsg = `Map→Object変換エラー: ${error.message}`;
            console.error('💀 変換エラー:', errorMsg);
            this.debugInfo.managerInjectionStatus = 'failed - conversion error';
            this.debugInfo.lastError = errorMsg;
            throw new Error(errorMsg);
        }
        
        // 必須Manager存在確認
        const requiredManagers = ['canvas', 'coordinate', 'record'];
        const availableKeys = Object.keys(this.managersObject);
        const missingManagers = requiredManagers.filter(key => !availableKeys.includes(key));
        
        if (missingManagers.length > 0) {
            const errorMsg = `ToolManager: 必須Manager不足: ${missingManagers.join(', ')}`;
            console.error('💀 必須Manager確認エラー:', errorMsg);
            console.error('📋 利用可能Manager:', availableKeys);
            this.debugInfo.managerInjectionStatus = 'failed - missing required';
            throw new Error(errorMsg);
        }
        
        console.log('✅ ToolManager: 必須Manager確認完了:', requiredManagers);
        console.log('📋 利用可能Manager:', availableKeys);
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
            // Manager注入状況確認
            if (!this.managersObject) {
                throw new Error('Manager統一注入が未完了です。先にsetManagers()を実行してください。');
            }
            
            console.log('✅ Manager統一注入準備完了:', typeof this.managersObject);
            console.log('📋 注入予定Manager キー:', Object.keys(this.managersObject));
            
            // v8 Tool作成・Manager注入
            await this.createV8PenTool();
            await this.createV8EraserTool();
            
            // デフォルトツール設定
            this.switchTool('pen');
            
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
            // PenTool作成・CanvasManager注入
            const penTool = new window.Tegaki.PenTool();
            penTool.setCanvasManager(this.canvasManager);
            console.log('✅ PenTool作成完了 - CanvasManager注入済み');
            
            // Manager統一注入（Object形式で注入）
            console.log('🔧 PenTool Manager注入開始 - Object形式');
            console.log('📦 注入予定Object:', this.managersObject);
            console.log('📦 注入予定キー:', Object.keys(this.managersObject));
            
            penTool.setManagers(this.managersObject);  // Object形式で注入
            console.log('✅ PenTool Manager統一注入完了');
            
            // Tool登録
            this.tools.set('pen', penTool);
            console.log('✅ PenTool登録完了');
            
        } catch (error) {
            console.error('💀 PenTool作成エラー:', error);
            this.handleV8ToolCreationError('pen', error);
            throw error;
        }
    }
    
    /**
     * v8 EraserTool作成（修正版）
     */
    async createV8EraserTool() {
        console.log('2️⃣ v8 EraserTool作成開始...（修正版）');
        
        try {
            // EraserTool作成・CanvasManager注入
            const eraserTool = new window.Tegaki.EraserTool();
            eraserTool.setCanvasManager(this.canvasManager);
            console.log('✅ EraserTool作成完了 - CanvasManager注入済み');
            
            // Manager統一注入（Object形式で注入）
            console.log('🔧 EraserTool Manager注入開始 - Object形式');
            eraserTool.setManagers(this.managersObject);  // Object形式で注入
            console.log('✅ EraserTool Manager統一注入完了');
            
            // Tool登録
            this.tools.set('eraser', eraserTool);
            console.log('✅ EraserTool登録完了');
            
        } catch (error) {
            console.error('💀 EraserTool作成エラー:', error);
            this.handleV8ToolCreationError('eraser', error);
            throw error;
        }
    }
    
    /**
     * アクティブTool切り替え
     */
    switchTool(toolName) {
        console.log(`🔄 Tool切り替え: ${toolName}`);
        
        if (!this.tools.has(toolName)) {
            throw new Error(`未知のTool: ${toolName}`);
        }
        
        // 現在のTool非アクティブ化
        if (this.activeTool) {
            if (typeof this.activeTool.deactivate === 'function') {
                this.activeTool.deactivate();
            }
        }
        
        // 新しいTool アクティブ化
        this.activeTool = this.tools.get(toolName);
        if (typeof this.activeTool.activate === 'function') {
            this.activeTool.activate();
        }
        
        console.log(`✅ アクティブTool設定完了: ${toolName}`);
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
        return this.drawContainer;
    }
    
    /**
     * v8 Toolエラー処理
     */
    handleV8ToolCreationError(toolName, error) {
        console.error(`💀 v8 Tool作成エラー: ${toolName}:`, error);
        
        // エラー情報記録
        if (window.Tegaki?.ErrorManager) {
            window.Tegaki.ErrorManager.logError(`V8 TOOL作成失敗`, `${toolName}: ${error.message}`);
        }
        
        // Tool削除（作成済みの場合）
        if (this.tools.has(toolName)) {
            this.tools.delete(toolName);
            console.log(`🧹 失敗Tool削除完了: ${toolName}`);
        }
    }
    
    /**
     * デバッグ情報取得
     */
    getDebugInfo() {
        return {
            ...this.debugInfo,
            toolsCount: this.tools.size,
            toolNames: Array.from(this.tools.keys()),
            activeToolName: this.activeTool ? 'unknown' : null,
            managersAvailable: this.managersObject ? Object.keys(this.managersObject) : [],
            isWebGPUSupported: this.isWebGPUSupported,
            v8FeaturesEnabled: this.v8FeaturesEnabled
        };
    }
}

// グローバル登録
if (!window.Tegaki) window.Tegaki = {};
window.Tegaki.ToolManager = ToolManager;

console.log('🚀 ToolManager v8.12.0完全対応版 Loaded - Manager注入エラー修正版');
console.log('📏 修正内容: Map→Object確実変換・デバッグ強化・型安全性向上');
console.log('🚀 特徴: v8 Tool連携・WebGPU対応・非同期初期化・Container階層・リアルタイム切り替え・Manager統一注入修正');