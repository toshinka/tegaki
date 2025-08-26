/**
 * 🎯 AbstractTool - ツール基底クラス（Phase1.5スタブ版）
 * 📋 RESPONSIBILITY: 全ツール共通処理・非破壊編集基盤・RecordManager連携
 * 🚫 PROHIBITION: 具体的描画処理・UI操作・Manager管理
 * ✅ PERMISSION: 共通処理・操作記録・座標処理・基底機能
 * 
 * 📏 DESIGN_PRINCIPLE: 継承基盤・共通処理集約・非破壊編集対応
 * 🔄 INTEGRATION: RecordManager・CoordinateManager連携・全ツール継承
 * 🎯 Phase1.5: 基本基底機能・操作記録基盤（詳細実装は後続Phase1.5で完成）
 */

// Tegaki名前空間初期化
window.Tegaki = window.Tegaki || {};

/**
 * AbstractTool - ツール基底クラス（スタブ版）
 * 全ツールが継承する共通基盤・Phase1.5で段階的に実装予定
 */
class AbstractTool {
    constructor(toolName) {
        console.log(`🎯 AbstractTool Phase1.5 スタブ版 - ${toolName} 基底クラス作成`);
        
        // 基本情報
        this.toolName = toolName || 'unknown';
        this.isInitialized = false;
        
        // Manager参照
        this.canvasManager = null;
        this.coordinateManager = null;
        this.recordManager = null;
        
        // 操作状態
        this.isActive = false;
        this.isDrawing = false;
        this.currentOperation = null;
        
        // 設定
        this.settings = {};
        
        console.log(`🎯 AbstractTool ${toolName} スタブ作成完了 - Phase1.5で詳細実装予定`);
    }
    
    /**
     * 初期化（Manager連携）
     */
    initialize(managers = {}) {
        this.canvasManager = managers.canvasManager || null;
        this.coordinateManager = managers.coordinateManager || null;
        this.recordManager = managers.recordManager || null;
        
        this.isInitialized = true;
        
        console.log(`🎯 ${this.toolName} AbstractTool 初期化完了`);
        return true;
    }
    
    /**
     * ツール有効化
     */
    activate() {
        if (!this.isInitialized) {
            console.warn('⚠️ Tool not initialized');
            return false;
        }
        
        this.isActive = true;
        console.log(`🎯 ${this.toolName} ツール有効化（スタブ）`);
        return true;
    }
    
    /**
     * ツール無効化
     */
    deactivate() {
        this.isActive = false;
        this.isDrawing = false;
        this.currentOperation = null;
        
        console.log(`🎯 ${this.toolName} ツール無効化（スタブ）`);
        return true;
    }
    
    /**
     * ポインター押下処理（基底・オーバーライド推奨）
     */
    onPointerDown(x, y, event) {
        if (!this.isActive) return false;
        
        // 座標有効性確認
        if (!this.isValidCoordinate(x, y)) {
            console.warn(`⚠️ Invalid coordinates: (${x}, ${y})`);
            return false;
        }
        
        this.isDrawing = true;
        
        // 操作開始記録（スタブ）
        this.startOperation('pointer_down', { x, y, tool: this.toolName });
        
        console.log(`🎯 ${this.toolName} ポインター押下（基底処理）: (${x.toFixed(1)}, ${y.toFixed(1)})`);
        return true;
    }
    
    /**
     * ポインター移動処理（基底・オーバーライド推奨）
     */
    onPointerMove(x, y, event) {
        if (!this.isActive || !this.isDrawing) return false;
        
        // 座標有効性確認
        if (!this.isValidCoordinate(x, y)) {
            return false; // 無効座標は無視
        }
        
        console.log(`🎯 ${this.toolName} ポインター移動（基底処理）: (${x.toFixed(1)}, ${y.toFixed(1)})`);
        return true;
    }
    
    /**
     * ポインター離上処理（基底・オーバーライド推奨）
     */
    onPointerUp(x, y, event) {
        if (!this.isActive) return false;
        
        this.isDrawing = false;
        
        // 操作終了記録（スタブ）
        this.endOperation('pointer_up', { x, y, tool: this.toolName });
        
        console.log(`🎯 ${this.toolName} ポインター離上（基底処理）`);
        return true;
    }
    
    /**
     * 座標有効性確認
     */
    isValidCoordinate(x, y) {
        return x !== null && y !== null && 
               typeof x === 'number' && typeof y === 'number' &&
               !isNaN(x) && !isNaN(y);
    }
    
    /**
     * 操作開始記録（RecordManager連携・スタブ）
     */
    startOperation(operationType, data = {}) {
        if (!this.recordManager) {
            console.log(`🎯 ${this.toolName} 操作開始（RecordManager未接続）: ${operationType}`);
            return null;
        }
        
        const operationData = {
            type: operationType,
            tool: this.toolName,
            startTime: Date.now(),
            data: { ...data },
            undo: null, // 具体的ツールで設定
            redo: null  // 具体的ツールで設定
        };
        
        this.currentOperation = operationData;
        
        console.log(`🎯 ${this.toolName} 操作開始記録（スタブ）: ${operationType}`);
        return operationData;
    }
    
    /**
     * 操作終了記録（RecordManager連携・スタブ）
     */
    endOperation(operationType, data = {}) {
        if (!this.currentOperation) {
            console.log(`🎯 ${this.toolName} 操作終了（操作未開始）: ${operationType}`);
            return null;
        }
        
        this.currentOperation.endTime = Date.now();
        this.currentOperation.duration = this.currentOperation.endTime - this.currentOperation.startTime;
        
        // RecordManagerに記録（実装されている場合のみ）
        if (this.recordManager && typeof this.recordManager.recordOperation === 'function') {
            const recordId = this.recordManager.recordOperation(this.currentOperation);
            console.log(`🎯 ${this.toolName} 操作記録完了: ${recordId}`);
        } else {
            console.log(`🎯 ${this.toolName} 操作終了（RecordManager未接続）: ${operationType}`);
        }
        
        const completedOperation = this.currentOperation;
        this.currentOperation = null;
        
        return completedOperation;
    }
    
    /**
     * 操作記録（直接記録用・スタブ）
     */
    recordOperation(operation) {
        if (!this.recordManager) {
            console.log(`🎯 ${this.toolName} 操作記録（RecordManager未接続）`);
            return null;
        }
        
        const operationData = {
            tool: this.toolName,
            timestamp: Date.now(),
            ...operation
        };
        
        if (typeof this.recordManager.recordOperation === 'function') {
            return this.recordManager.recordOperation(operationData);
        }
        
        console.log(`🎯 ${this.toolName} 操作記録（スタブ）:`, operationData.type || 'unknown');
        return null;
    }
    
    /**
     * 設定管理
     */
    getSettings() {
        return { ...this.settings };
    }
    
    setSetting(key, value) {
        this.settings[key] = value;
        console.log(`🎯 ${this.toolName} 設定変更: ${key} = ${value}`);
        return true;
    }
    
    /**
     * CanvasManager設定
     */
    setCanvasManager(canvasManager) {
        this.canvasManager = canvasManager;
        console.log(`🎯 ${this.toolName} CanvasManager設定完了`);
        return true;
    }
    
    /**
     * CoordinateManager設定
     */
    setCoordinateManager(coordinateManager) {
        this.coordinateManager = coordinateManager;
        console.log(`🎯 ${this.toolName} CoordinateManager設定完了`);
        return true;
    }
    
    /**
     * RecordManager設定
     */
    setRecordManager(recordManager) {
        this.recordManager = recordManager;
        console.log(`🎯 ${this.toolName} RecordManager設定完了`);
        return true;
    }
    
    /**
     * デバッグ情報取得
     */
    getDebugInfo() {
        return {
            // 基本情報
            toolName: this.toolName,
            isInitialized: this.isInitialized,
            isActive: this.isActive,
            isDrawing: this.isDrawing,
            
            // Manager連携状態
            managers: {
                canvasManager: !!this.canvasManager,
                coordinateManager: !!this.coordinateManager,
                recordManager: !!this.recordManager
            },
            
            // 操作状態
            currentOperation: this.currentOperation ? {
                type: this.currentOperation.type,
                startTime: this.currentOperation.startTime,
                duration: this.currentOperation.duration || null
            } : null,
            
            // 設定
            settings: this.getSettings(),
            
            // Phase情報
            phase: {
                current: '1.5',
                implementationStatus: 'stub', // スタブ実装
                features: {
                    baseToolFunctions: true,
                    operationRecording: 'stub',
                    coordinateIntegration: 'stub',
                    advancedFeatures: false // Phase2で実装
                }
            }
        };
    }
    
    /**
     * Phase1.5準備完了判定
     */
    isReadyForPhase15() {
        return this.isInitialized && this.isActive;
    }
    
    /**
     * Phase2準備機能（将来実装用プレースホルダー）
     */
    enableAdvancedRecording() {
        console.log(`🎯 ${this.toolName} 高度記録機能（Phase2で実装予定）`);
        return false; // Phase2で実装
    }
    
    setPerformanceMode(enabled) {
        console.log(`🎯 ${this.toolName} パフォーマンスモード（Phase2で実装予定）`);
        return false; // Phase2で実装
    }
    
    enablePressureSupport() {
        console.log(`🎯 ${this.toolName} 筆圧サポート（Phase2で実装予定）`);
        return false; // Phase2で実装
    }
}

// Tegaki名前空間に登録
window.Tegaki.AbstractTool = AbstractTool;

console.log('🎯 AbstractTool Phase1.5 Loaded - スタブ版・ツール基底クラス準備完了');
console.log('🎯 abstract-tool.js loaded - Phase1.5基本クラス・全ツール継承基盤準備');