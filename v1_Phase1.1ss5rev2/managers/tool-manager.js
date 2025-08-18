/**
 * 🎨 ふたば☆ちゃんねる風ベクターお絵描きツール v1.0
 * 🎯 AI_WORK_SCOPE: ツール系統括・描画制御・設定管理
 * 🎯 DEPENDENCIES: js/managers/canvas-manager.js (Pure JavaScript)
 * 🎯 NODE_MODULES: pixi.js@^7.4.3
 * 🎯 PIXI_EXTENSIONS: 描画ツール統合
 * 🎯 ISOLATION_TEST: 可能（ツール単体機能）
 * 🎯 SPLIT_THRESHOLD: 400行（ツール制御・分割慎重）
 * 📋 PHASE_TARGET: Phase1.1ss3 - Pure JavaScript完全準拠
 * 📋 V8_MIGRATION: 変更なし（描画ロジック専用）
 * 📋 RULEBOOK_COMPLIANCE: 1.2実装原則「Pure JavaScript維持」完全準拠
 */

/**
 * ツール管理システム
 * 元HTMLのToolSystemを基にした改良版
 * Pure JavaScript完全準拠・グローバル公開方式
 */
class ToolManager {
    constructor() {
        this.currentTool = 'pen';
        this.canvasManager = null;
        this.isDrawing = false;
        this.currentPath = null;
        this.lastPoint = null;
        
        // グローバル設定（元HTML互換）
        this.globalSettings = {
            brushSize: 16.0,
            brushColor: 0x800000,
            opacity: 0.85,
            pressure: 0.5,
            smoothing: 0.3,
            pressureSensitivity: true,
            edgeSmoothing: true,
            gpuAcceleration: true
        };
        
        // 登録ツール管理
        this.registeredTools = new Map();
        
        console.log('🎨 ToolManager 構築開始（Pure JavaScript）...');
    }
    
    /**
     * ツール管理システム初期化
     * @param {CanvasManager} canvasManager - キャンバス管理システム
     */
    init(canvasManager) {
        if (!canvasManager) {
            throw new Error('CanvasManager が必要です');
        }
        
        this.canvasManager = canvasManager;
        
        console.log('✅ ToolManager初期化完了（Pure JavaScript）');
        return this;
    }
    
    /**
     * ツール登録
     * @param {string} name - ツール名
     * @param {Object} toolInstance - ツールインスタンス
     */
    registerTool(name, toolInstance) {
        this.registeredTools.set(name, toolInstance);
        console.log(`🔧 ツール登録: ${name}`);
    }
    
    /**
     * ツール設定
     * @param {string} tool - ツール名
     */
    setTool(tool) {
        if (!this.registeredTools.has(tool)) {
            console.warn(`⚠️ 未登録ツール: ${tool}`);
            return false;
        }
        
        this.currentTool = tool;
        console.log(`🎯 ツール変更: ${tool}`);
        return true;
    }
    
    /**
     * 描画開始
     * @param {number} x - X座標
     * @param {number} y - Y座標
     */
    startDrawing(x, y) {
        if (!this.canvasManager) {
            console.warn('⚠️ CanvasManager 未初期化');
            return;
        }
        
        this.isDrawing = true;
        this.lastPoint = { x, y };
        
        // 現在のツールで描画開始
        const currentToolInstance = this.registeredTools.get(this.currentTool);
        if (currentToolInstance && currentToolInstance.startDrawing) {
            currentToolInstance.startDrawing(x, y);
        } else {
            // フォールバック: 直接キャンバスに描画
            this.currentPath = this.canvasManager.createPath(
                x, y, 
                this.globalSettings.brushSize,
                this.globalSettings.brushColor,
                this.globalSettings.opacity,
                this.currentTool
            );
        }
        
        console.log(`✏️ 描画開始: ${this.currentTool} at (${Math.round(x)}, ${Math.round(y)})`);
    }
    
    /**
     * 描画継続
     * @param {number} x - X座標
     * @param {number} y - Y座標
     */
    continueDrawing(x, y) {
        if (!this.isDrawing || !this.canvasManager) return;
        
        // 現在のツールで描画継続
        const currentToolInstance = this.registeredTools.get(this.currentTool);
        if (currentToolInstance && currentToolInstance.continueDrawing) {
            currentToolInstance.continueDrawing(x, y);
        } else {
            // フォールバック: 直接キャンバスに描画
            if (this.currentPath) {
                this.canvasManager.drawLine(this.currentPath, x, y);
            }
        }
        
        this.lastPoint = { x, y };
    }
    
    /**
     * 描画終了
     */
    stopDrawing() {
        if (!this.isDrawing) return;
        
        // 現在のツールで描画終了
        const currentToolInstance = this.registeredTools.get(this.currentTool);
        if (currentToolInstance && currentToolInstance.stopDrawing) {
            currentToolInstance.stopDrawing();
        } else {
            // フォールバック処理
            if (this.currentPath) {
                this.currentPath.isComplete = true;
            }
        }
        
        this.isDrawing = false;
        this.currentPath = null;
        this.lastPoint = null;
        
        console.log(`✏️ 描画終了: ${this.currentTool}`);
    }
    
    /**
     * ブラシサイズ設定
     * @param {number} size - ブラシサイズ
     */
    setBrushSize(size) {
        this.globalSettings.brushSize = Math.max(0.1, Math.min(100, Math.round(size * 10) / 10));
        console.log(`🖌️ ブラシサイズ: ${this.globalSettings.brushSize}px`);
    }
    
    /**
     * 不透明度設定
     * @param {number} opacity - 不透明度（0-1）
     */
    setOpacity(opacity) {
        this.globalSettings.opacity = Math.max(0, Math.min(1, Math.round(opacity * 1000) / 1000));
        console.log(`🌫️ 不透明度: ${Math.round(this.globalSettings.opacity * 100)}%`);
    }
    
    /**
     * 筆圧設定
     * @param {number} pressure - 筆圧（0-1）
     */
    setPressure(pressure) {
        this.globalSettings.pressure = Math.max(0, Math.min(1, Math.round(pressure * 1000) / 1000));
        console.log(`✍️ 筆圧: ${Math.round(this.globalSettings.pressure * 100)}%`);
    }
    
    /**
     * 線補正設定
     * @param {number} smoothing - 線補正（0-1）
     */
    setSmoothing(smoothing) {
        this.globalSettings.smoothing = Math.max(0, Math.min(1, Math.round(smoothing * 1000) / 1000));
        console.log(`📏 線補正: ${Math.round(this.globalSettings.smoothing * 100)}%`);
    }
    
    /**
     * グローバル設定更新
     * @param {Object} settings - 設定オブジェクト
     */
    updateGlobalSettings(settings) {
        if (settings.brushSize !== undefined) {
            this.setBrushSize(settings.brushSize);
        }
        
        if (settings.opacity !== undefined) {
            this.setOpacity(settings.opacity);
        }
        
        if (settings.pressure !== undefined) {
            this.setPressure(settings.pressure);
        }
        
        if (settings.smoothing !== undefined) {
            this.setSmoothing(settings.smoothing);
        }
        
        if (settings.pressureSensitivity !== undefined) {
            this.globalSettings.pressureSensitivity = settings.pressureSensitivity;
            console.log(`📱 筆圧感度: ${settings.pressureSensitivity ? 'ON' : 'OFF'}`);
        }
        
        if (settings.edgeSmoothing !== undefined) {
            this.globalSettings.edgeSmoothing = settings.edgeSmoothing;
            console.log(`✨ エッジスムージング: ${settings.edgeSmoothing ? 'ON' : 'OFF'}`);
        }
        
        if (settings.gpuAcceleration !== undefined) {
            this.globalSettings.gpuAcceleration = settings.gpuAcceleration;
            console.log(`🚀 GPU加速: ${settings.gpuAcceleration ? 'ON' : 'OFF'}`);
        }
        
        // 現在のツールに設定変更を通知
        const currentToolInstance = this.registeredTools.get(this.currentTool);
        if (currentToolInstance && currentToolInstance.updateSettings) {
            currentToolInstance.updateSettings(this.globalSettings);
        }
    }
    
    /**
     * 描画状態取得
     * @returns {Object} 描画状態
     */
    getDrawingState() {
        return {
            currentTool: this.currentTool,
            isDrawing: this.isDrawing,
            globalSettings: { ...this.globalSettings },
            registeredTools: Array.from(this.registeredTools.keys()),
            currentPath: this.currentPath ? this.currentPath.id : null,
            lastPoint: this.lastPoint ? { ...this.lastPoint } : null
        };
    }
    
    /**
     * アンドゥ実行
     * @returns {boolean} アンドゥ成功フラグ
     */
    undo() {
        if (!this.canvasManager) return false;
        
        const success = this.canvasManager.undo();
        if (success) {
            console.log('↶ アンドゥ実行');
        }
        return success;
    }
    
    /**
     * キャンバスクリア
     */
    clear() {
        if (!this.canvasManager) return;
        
        this.canvasManager.clear();
        console.log('🧹 キャンバスクリア');
    }
    
    /**
     * ツール統計取得
     * @returns {Object} ツール統計
     */
    getToolStats() {
        const stats = {
            currentTool: this.currentTool,
            registeredToolsCount: this.registeredTools.size,
            isDrawing: this.isDrawing,
            globalSettings: { ...this.globalSettings }
        };
        
        // キャンバス統計追加
        if (this.canvasManager) {
            stats.canvasStats = this.canvasManager.getStats();
        }
        
        return stats;
    }
    
    /**
     * ツール切り替え可能性チェック
     * @param {string} tool - ツール名
     * @returns {boolean} 切り替え可能フラグ
     */
    canSwitchTo(tool) {
        if (this.isDrawing) {
            console.warn('⚠️ 描画中はツール変更できません');
            return false;
        }
        
        if (!this.registeredTools.has(tool)) {
            console.warn(`⚠️ 未登録ツール: ${tool}`);
            return false;
        }
        
        return true;
    }
    
    /**
     * 安全なツール切り替え
     * @param {string} tool - ツール名
     * @returns {boolean} 切り替え成功フラグ
     */
    safeSwitchTool(tool) {
        if (!this.canSwitchTo(tool)) return false;
        
        // 描画中の場合は強制終了
        if (this.isDrawing) {
            this.stopDrawing();
        }
        
        return this.setTool(tool);
    }
    
    /**
     * デバッグ情報出力
     */
    debugInfo() {
        const state = this.getDrawingState();
        const stats = this.getToolStats();
        
        console.group('🔧 ToolManager デバッグ情報');
        console.log('📊 状態:', state);
        console.log('📈 統計:', stats);
        console.groupEnd();
        
        return { state, stats };
    }
    
    /**
     * 破棄処理
     */
    destroy() {
        try {
            // 描画中の場合は終了
            if (this.isDrawing) {
                this.stopDrawing();
            }
            
            // 登録ツールクリア
            this.registeredTools.clear();
            
            // 参照クリア
            this.canvasManager = null;
            this.currentPath = null;
            this.lastPoint = null;
            
            console.log('🗑️ ToolManager 破棄完了');
            
        } catch (error) {
            console.error('❌ ToolManager 破棄エラー:', error);
        }
    }
}

// Pure JavaScript グローバル公開（ルールブック準拠）
if (typeof window !== 'undefined') {
    window.ToolManager = ToolManager;
    console.log('✅ ToolManager グローバル公開完了（Pure JavaScript）');
}

console.log('🔧 ToolManager Pure JavaScript完全準拠版 - 準備完了');
console.log('📋 ルールブック準拠: 1.2実装原則「ESM/TypeScript混在禁止・Pure JavaScript維持」');
console.log('💡 使用例: const toolManager = new window.ToolManager(); toolManager.init(canvasManager);');