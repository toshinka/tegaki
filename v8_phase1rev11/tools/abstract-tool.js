/**
 * 🎯 AbstractTool Phase1.5 Manager存在確認修正版
 * 
 * 【提供するメソッド一覧】
 * - constructor(toolName) - Tool基底クラス初期化
 * - setCanvasManager(canvasManager) - v8 CanvasManager設定
 * - setManagers(managers) - Manager統一注入（Object形式前提・確実確認）
 * - getManager(managerKey) - Manager取得
 * - activate() - Tool アクティブ化
 * - deactivate() - Tool 非アクティブ化
 * - onPointerDown(event) - ポインタダウンハンドラ（サブクラス実装）
 * - onPointerMove(event) - ポインタムーブハンドラ（サブクラス実装）
 * - onPointerUp(event) - ポインタアップハンドラ（サブクラス実装）
 * - startOperation(operationType) - 操作開始（RecordManager連携）
 * - endOperation() - 操作終了（RecordManager連携）
 * 
 * 【他ファイルから呼び出すメソッド一覧】
 * - CanvasManager.getDrawContainer() - v8描画Container取得
 * - RecordManager.startOperation() - 操作記録開始
 * - RecordManager.endOperation() - 操作記録終了
 * - CoordinateManager.screenToCanvas() - 座標変換
 * - ErrorManager.logError() - エラー記録
 * - EventBus.emit() - イベント通知
 * 
 * 【Manager登録キー統一】
 * - canvas - CanvasManager（必須）
 * - coordinate - CoordinateManager（必須）
 * - record - RecordManager（必須）
 * - config - ConfigManager
 * - error - ErrorManager
 * - event - EventBus
 * - shortcut - ShortcutManager
 * - navigation - NavigationManager
 * 
 * 【Tool操作フロー】
 * 1. activate() - Tool アクティブ化・イベント登録
 * 2. onPointerDown() - ポインタダウン・操作開始
 * 3. startOperation() - RecordManager操作記録開始
 * 4. onPointerMove() - ポインタ移動・描画更新
 * 5. onPointerUp() - ポインタアップ・操作完了
 * 6. endOperation() - RecordManager操作記録終了
 * 7. deactivate() - Tool 非アクティブ化・イベント削除
 * 
 * 【Manager注入フロー修正版】
 * 1. ToolManager: Map→Object確実変換済みデータを注入
 * 2. setManagers(): Object形式前提・型確認・存在確認
 * 3. 必須Manager確認: canvas, coordinate, record
 * 4. Manager個別アクセス: getManager(key)経由
 */

class AbstractTool {
    constructor(toolName) {
        console.log(`🎯 AbstractTool 作成開始: ${toolName}`);
        
        this.toolName = toolName;
        this.isActive = false;
        this.isDrawing = false;
        
        // Manager管理（修正版 - Object形式前提）
        this.managers = null;           // Object形式で受信・保持
        this.canvasManager = null;      // 専用設定済み
        
        // 必須Manager定義
        this.requiredManagers = ['canvas', 'coordinate', 'record'];
        
        // v8対応状況
        this.v8FeaturesEnabled = false;
        this.drawContainer = null;
        
        // 操作状態（RecordManager連携）
        this.currentOperation = null;
        this.operationStartTime = null;
        
        // デバッグ情報
        this.debugInfo = {
            managerInjectionStatus: 'pending',
            requiredManagersStatus: 'pending',
            canvasManagerStatus: 'pending',
            lastError: null
        };
        
        console.log(`✅ ${toolName} AbstractTool 作成完了`);
    }
    
    /**
     * 操作開始（RecordManager連携）
     * @param {string} operationType - 操作タイプ（draw, erase等）
     */
    startOperation(operationType) {
        console.log(`🚀 ${this.toolName} 操作開始: ${operationType}`);
        
        try {
            const recordManager = this.getManager('record');
            
            if (recordManager && typeof recordManager.startOperation === 'function') {
                this.currentOperation = recordManager.startOperation(operationType, this.toolName);
                this.operationStartTime = Date.now();
                console.log(`✅ ${this.toolName} RecordManager操作記録開始: ${operationType}`);
            } else {
                console.warn(`⚠️ ${this.toolName} RecordManager操作記録スキップ（未対応）`);
            }
            
        } catch (error) {
            console.error(`💀 ${this.toolName} 操作記録開始エラー:`, error);
            // RecordManager エラーでも操作は継続
        }
    }
    
    /**
     * 操作終了（RecordManager連携）
     */
    endOperation() {
        if (!this.currentOperation) {
            return; // 操作記録なし
        }
        
        const operationTime = Date.now() - this.operationStartTime;
        console.log(`🏁 ${this.toolName} 操作終了 (${operationTime}ms)`);
        
        try {
            const recordManager = this.getManager('record');
            
            if (recordManager && typeof recordManager.endOperation === 'function') {
                recordManager.endOperation();
                console.log(`✅ ${this.toolName} RecordManager操作記録終了`);
            }
            
        } catch (error) {
            console.error(`💀 ${this.toolName} 操作記録終了エラー:`, error);
        } finally {
            this.currentOperation = null;
            this.operationStartTime = null;
        }
    }
    
    /**
     * ポインタダウンハンドラ（サブクラスで実装）
     * @param {PIXI.FederatedPointerEvent} event - ポインタイベント
     */
    onPointerDown(event) {
        // サブクラスで実装
        console.log(`🎯 ${this.toolName} onPointerDown - サブクラスで実装してください`);
    }
    
    /**
     * ポインタムーブハンドラ（サブクラスで実装）
     * @param {PIXI.FederatedPointerEvent} event - ポインタイベント
     */
    onPointerMove(event) {
        // サブクラスで実装
        console.log(`🎯 ${this.toolName} onPointerMove - サブクラスで実装してください`);
    }
    
    /**
     * ポインタアップハンドラ（サブクラスで実装）
     * @param {PIXI.FederatedPointerEvent} event - ポインタイベント
     */
    onPointerUp(event) {
        // サブクラスで実装
        console.log(`🎯 ${this.toolName} onPointerUp - サブクラスで実装してください`);
    }
    
    /**
     * 座標変換（CoordinateManager連携）
     * @param {Object} screenPoint - スクリーン座標 {x, y}
     * @returns {Object} キャンバス座標 {x, y}
     */
    screenToCanvas(screenPoint) {
        try {
            const coordinateManager = this.getManager('coordinate');
            
            if (coordinateManager && typeof coordinateManager.screenToCanvas === 'function') {
                return coordinateManager.screenToCanvas(screenPoint);
            } else {
                // CoordinateManager未対応の場合は座標そのまま
                console.warn(`⚠️ ${this.toolName} CoordinateManager座標変換スキップ`);
                return screenPoint;
            }
            
        } catch (error) {
            console.error(`💀 ${this.toolName} 座標変換エラー:`, error);
            // エラー時は座標そのまま
            return screenPoint;
        }
    }
    
    /**
     * エラーログ（ErrorManager連携）
     * @param {string} message - エラーメッセージ
     * @param {*} details - エラー詳細
     */
    logError(message, details) {
        try {
            const errorManager = this.getManager('error');
            
            if (errorManager && typeof errorManager.logError === 'function') {
                errorManager.logError(`${this.toolName.toUpperCase()} ERROR`, `${message}: ${details}`);
            } else {
                console.error(`💀 ${this.toolName} ${message}:`, details);
            }
            
        } catch (error) {
            console.error(`💀 ${this.toolName} ErrorManager連携エラー:`, error);
            console.error(`💀 ${this.toolName} 元のエラー - ${message}:`, details);
        }
    }
    
    /**
     * デバッグ情報取得
     */
    getDebugInfo() {
        return {
            toolName: this.toolName,
            isActive: this.isActive,
            isDrawing: this.isDrawing,
            v8FeaturesEnabled: this.v8FeaturesEnabled,
            hasDrawContainer: !!this.drawContainer,
            hasCanvasManager: !!this.canvasManager,
            managersAvailable: this.managers ? Object.keys(this.managers) : [],
            requiredManagers: this.requiredManagers,
            currentOperation: this.currentOperation,
            operationStartTime: this.operationStartTime,
            ...this.debugInfo
        };
    }
    
    /**
     * 設定値取得（ConfigManager連携）
     * @param {string} key - 設定キー
     * @param {*} defaultValue - デフォルト値
     * @returns {*} 設定値
     */
    getConfig(key, defaultValue) {
        try {
            const configManager = this.getManager('config');
            
            if (configManager && typeof configManager.get === 'function') {
                return configManager.get(key, defaultValue);
            } else {
                console.warn(`⚠️ ${this.toolName} ConfigManager未対応 - デフォルト値使用: ${key}`);
                return defaultValue;
            }
            
        } catch (error) {
            console.warn(`⚠️ ${this.toolName} Config取得エラー: ${key} - デフォルト値使用`);
            return defaultValue;
        }
    }
}

// グローバル登録
if (!window.Tegaki) window.Tegaki = {};
window.Tegaki.AbstractTool = AbstractTool;

console.log('🎯 AbstractTool Phase1.5 Manager存在確認修正版 Loaded');
console.log('📏 修正内容: Object形式前提・Map対策・型安全性確保・詳細デバッグ');
console.log('🚀 特徴: startOperation/endOperation方式対応・Manager統一注入完成・架空メソッド削除');
     * v8 CanvasManager設定
     */
    setCanvasManager(canvasManager) {
        if (!canvasManager) {
            throw new Error(`${this.toolName}: CanvasManagerが必要です`);
        }
        
        this.canvasManager = canvasManager;
        
        // v8描画Container取得
        if (typeof canvasManager.getDrawContainer === 'function') {
            this.drawContainer = canvasManager.getDrawContainer();
            this.debugInfo.canvasManagerStatus = 'success';
            console.log(`✅ ${this.toolName}: CanvasManager設定完了`);
        } else {
            this.debugInfo.canvasManagerStatus = 'failed - no getDrawContainer';
            throw new Error(`${this.toolName}: CanvasManagerにgetDrawContainer()メソッドがありません`);
        }
    }
    
    /**
     * Manager統一注入（Object形式前提・確実確認修正版）
     * @param {Object} managers - ToolManagerから受信するManagerのObject
     */
    setManagers(managers) {
        console.log(`🔧 ${this.toolName} Manager統一注入開始...（修正版）`);
        
        // 受信データ型確認・デバッグ（修正版）
        console.log(`📦 ${this.toolName} 受信Manager型:`, managers?.constructor?.name || 'undefined');
        console.log(`📦 ${this.toolName} 受信Manager内容:`, managers);
        
        // Object形式での受信確認（修正版）
        if (!managers || typeof managers !== 'object' || managers.constructor !== Object) {
            const errorMsg = `${this.toolName}: ManagerはObject形式で受信する必要があります（受信型: ${managers?.constructor?.name || 'undefined'}）`;
            console.error(`💀 ${this.toolName} Manager注入エラー:`, errorMsg);
            this.debugInfo.managerInjectionStatus = 'failed - invalid type';
            this.debugInfo.lastError = errorMsg;
            throw new Error(errorMsg);
        }
        
        // Map オブジェクト対策（Map が渡された場合の明確なエラー）
        if (managers instanceof Map) {
            const errorMsg = `${this.toolName}: MapオブジェクトではなくプレーンObjectを受信する必要があります。ToolManagerでMap→Object変換が未完了の可能性があります。`;
            console.error(`💀 ${this.toolName} Map受信エラー:`, errorMsg);
            this.debugInfo.managerInjectionStatus = 'failed - received Map instead of Object';
            this.debugInfo.lastError = errorMsg;
            throw new Error(errorMsg);
        }
        
        // Object形式で保存
        this.managers = managers;
        console.log(`✅ ${this.toolName}: Manager群をObject形式で保存完了`);
        
        // 利用可能Manager確認（修正版 - Object.keys()で確実取得）
        const availableKeys = Object.keys(this.managers);
        console.log(`📋 ${this.toolName} 利用可能Manager キー:`, availableKeys);
        console.log(`📋 ${this.toolName} 利用可能Manager数:`, availableKeys.length);
        
        // 個別Manager存在確認（デバッグ詳細）
        for (const key of availableKeys) {
            const manager = this.managers[key];
            console.log(`📦 ${this.toolName} Manager[${key}]:`, manager?.constructor?.name || 'undefined');
        }
        
        // 必須Manager存在確認（修正版）
        const missingManagers = this.requiredManagers.filter(key => {
            const exists = availableKeys.includes(key);
            const hasValue = this.managers[key] != null;
            console.log(`🔍 ${this.toolName} 必須Manager[${key}]: exists=${exists}, hasValue=${hasValue}`);
            return !exists || !hasValue;
        });
        
        if (missingManagers.length > 0) {
            const errorMsg = `${this.toolName}: Missing required managers: ${missingManagers.join(', ')}`;
            console.error(`💀 ${this.toolName} 必須Manager不足:`, errorMsg);
            console.error(`📋 ${this.toolName} 利用可能Manager:`, availableKeys);
            console.error(`📋 ${this.toolName} 必須Manager:`, this.requiredManagers);
            
            this.debugInfo.managerInjectionStatus = 'failed - missing required';
            this.debugInfo.requiredManagersStatus = `missing: ${missingManagers.join(', ')}`;
            this.debugInfo.lastError = errorMsg;
            throw new Error(errorMsg);
        }
        
        // Manager注入完了
        this.debugInfo.managerInjectionStatus = 'success';
        this.debugInfo.requiredManagersStatus = 'all present';
        
        console.log(`✅ ${this.toolName}: 必須Manager確認完了:`, this.requiredManagers);
        console.log(`✅ ${this.toolName}: Manager統一注入完了（Object形式）`);
    }
    
    /**
     * Manager取得
     * @param {string} managerKey - Manager登録キー
     * @returns {Object} Manager インスタンス
     */
    getManager(managerKey) {
        if (!this.managers) {
            throw new Error(`${this.toolName}: Manager未注入。先にsetManagers()を実行してください。`);
        }
        
        const manager = this.managers[managerKey];
        if (!manager) {
            const availableKeys = Object.keys(this.managers);
            throw new Error(`${this.toolName}: Manager '${managerKey}' が見つかりません。利用可能: ${availableKeys.join(', ')}`);
        }
        
        return manager;
    }
    
    /**
     * Tool アクティブ化
     */
    activate() {
        console.log(`🎯 ${this.toolName} Tool アクティブ化`);
        
        if (!this.drawContainer) {
            throw new Error(`${this.toolName}: 描画Container未設定。先にsetCanvasManager()を実行してください。`);
        }
        
        // イベントリスナー登録
        if (this.drawContainer.eventMode !== 'static') {
            this.drawContainer.eventMode = 'static';
        }
        
        this.drawContainer.on('pointerdown', this.onPointerDown.bind(this));
        this.drawContainer.on('pointermove', this.onPointerMove.bind(this));
        this.drawContainer.on('pointerup', this.onPointerUp.bind(this));
        this.drawContainer.on('pointerupoutside', this.onPointerUp.bind(this));
        
        this.isActive = true;
        console.log(`✅ ${this.toolName} Tool アクティブ化完了`);
        
        // イベント通知
        const eventBus = this.getManager('event');
        if (eventBus && typeof eventBus.emit === 'function') {
            eventBus.emit('tool:activated', { toolName: this.toolName });
        }
    }
    
    /**
     * Tool 非アクティブ化
     */
    deactivate() {
        console.log(`🎯 ${this.toolName} Tool 非アクティブ化`);
        
        if (this.drawContainer) {
            this.drawContainer.off('pointerdown', this.onPointerDown.bind(this));
            this.drawContainer.off('pointermove', this.onPointerMove.bind(this));
            this.drawContainer.off('pointerup', this.onPointerUp.bind(this));
            this.drawContainer.off('pointerupoutside', this.onPointerUp.bind(this));
        }
        
        // 未完了操作の終了
        if (this.currentOperation) {
            this.endOperation();
        }
        
        this.isActive = false;
        this.isDrawing = false;
        console.log(`✅ ${this.toolName} Tool 非アクティブ化完了`);
        
        // イベント通知
        const eventBus = this.getManager('event');
        if (eventBus && typeof eventBus.emit === 'function') {
            eventBus.emit('tool:deactivated', { toolName: this.toolName });
        }
    }
    
    /**