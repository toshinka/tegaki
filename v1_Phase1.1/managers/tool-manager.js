/**
 * 🎨 ふたば☆ちゃんねる風ベクターお絵描きツール v1.0
 * 🎯 AI_WORK_SCOPE: ツール系統括・描画ツール切り替え・設定管理
 * 🎯 DEPENDENCIES: js/tools/pen-tool.js, js/tools/eraser-tool.js
 * 🎯 NODE_MODULES: pixi.js@^7.4.3, lodash（利用可能時）
 * 🎯 PIXI_EXTENSIONS: 描画機能・Graphics統合
 * 🎯 ISOLATION_TEST: 可能（ツール依存）
 * 🎯 SPLIT_THRESHOLD: 400行（ツール統括・分割は慎重）
 * 📋 PHASE_TARGET: Phase1
 * 📋 V8_MIGRATION: 変更なし（ツール管理専用）
 */

/**
 * ツール統合管理システム
 * 元HTMLのToolSystemを基にした改良版
 */
class ToolManager {
    constructor() {
        this.currentTool = 'pen';
        this.tools = new Map();
        this.isDrawing = false;
        this.currentPath = null;
        this.lastPoint = null;
        
        // グローバル描画設定（全ツール共通）
        this.globalSettings = {
            brushSize: 16.0,
            brushColor: 0x800000, // ふたばマルーン
            opacity: 0.85,/**
 * 🎨 ふたば☆ちゃんねる風ベクターお絵描きツール v1.0
 * 🎯 AI_WORK_SCOPE: ツール系統括・描画ツール切り替え・設定管理
 * 🎯 DEPENDENCIES: js/tools/pen-tool.js, js/tools/eraser-tool.js
 * 🎯 NODE_MODULES: pixi.js@^7.4.3, lodash（利用可能時）
 * 🎯 PIXI_EXTENSIONS: 描画機能・Graphics統合
 * 🎯 ISOLATION_TEST: 可能（ツール依存）
 * 🎯 SPLIT_THRESHOLD: 400行（ツール統括・分割は慎重）
 * 📋 PHASE_TARGET: Phase1
 * 📋 V8_MIGRATION: 変更なし（ツール管理専用）
 */

/**
 * ツール統合管理システム
 * 元HTMLのToolSystemを基にした改良版
 * DRY原則: 共通設定を統一管理
 * SOLID原則: 単一責任 - ツール管理のみ
 */
export class ToolManager {
    constructor() {
        this.currentTool = 'pen';
        this.tools = new Map();
        this.isDrawing = false;
        this.currentPath = null;
        this.lastPoint = null;
        
        // グローバル描画設定（全ツール共通）
        this.globalSettings = {
            brushSize: 16.0,
            brushColor: 0x800000, // ふたばマルーン
            opacity: 0.85,
            pressure: 0.5,
            smoothing: 0.3,
            pressureSensitivity: true,
            edgeSmoothing: true,
            gpuAcceleration: true
        };
        
        console.log('🔧 ToolManager 構築開始...');
    }
    
    /**
     * ツール管理システム初期化
     * @param {DrawingEngine} drawingEngine - 描画エンジンインスタンス
     */
    init(drawingEngine) {
        this.drawingEngine = drawingEngine;
        this.registerDefaultTools();
        console.log('✅ ToolManager 初期化完了 - 登録ツール:', Array.from(this.tools.keys()));
    }
    
    /**
     * デフォルトツール登録
     * 元HTMLのペン・消しゴムツールを統合管理
     */
    registerDefaultTools() {
        // ペンツール登録
        this.registerTool('pen', {
            name: 'ベクターペン',
            icon: 'pen',
            type: 'drawing',
            settings: {
                ...this.globalSettings,
                blendMode: 'normal'
            }
        });
        
        // 消しゴムツール登録
        this.registerTool('eraser', {
            name: '消しゴム', 
            icon: 'eraser',
            type: 'erasing',
            settings: {
                ...this.globalSettings,
                blendMode: 'erase',
                color: this.drawingEngine?.backgroundColor || 0xf0e0d6
            }
        });
    }
    
    /**
     * ツール登録
     * @param {string} toolId - ツールID
     * @param {Object} toolConfig - ツール設定
     */
    registerTool(toolId, toolConfig) {
        this.tools.set(toolId, toolConfig);
        console.log(`🔧 ツール登録: ${toolId} - ${toolConfig.name}`);
    }
    
    /**
     * アクティブツール設定
     * @param {string} toolId - 設定するツールID
     */
    setTool(toolId) {
        if (!this.tools.has(toolId)) {
            console.warn(`⚠️ 未知のツール: ${toolId}`);
            return false;
        }
        
        this.currentTool = toolId;
        console.log(`🎯 ツール切り替え: ${this.tools.get(toolId).name}`);
        return true;
    }
    
    /**
     * 現在のツール取得
     */
    getCurrentTool() {
        return this.tools.get(this.currentTool);
    }
    
    /**
     * 現在のツール名取得
     */
    getCurrentToolName() {
        const tool = this.getCurrentTool();
        return tool ? tool.name : 'Unknown';
    }
    
    // === 描画設定管理（DRY原則） ===
    
    /**
     * ブラシサイズ設定
     * @param {number} size - ブラシサイズ (0.1 - 100)
     */
    setBrushSize(size) {
        this.globalSettings.brushSize = Math.max(0.1, Math.min(100, Math.round(size * 10) / 10));
    }
    
    /**
     * 不透明度設定
     * @param {number} opacity - 不透明度 (0.0 - 1.0)
     */
    setOpacity(opacity) {
        this.globalSettings.opacity = Math.max(0, Math.min(1, Math.round(opacity * 1000) / 1000));
    }
    
    /**
     * 筆圧設定
     * @param {number} pressure - 筆圧 (0.0 - 1.0)
     */
    setPressure(pressure) {
        this.globalSettings.pressure = Math.max(0, Math.min(1, Math.round(pressure * 1000) / 1000));
    }
    
    /**
     * 線補正設定
     * @param {number} smoothing - 線補正 (0.0 - 1.0)
     */
    setSmoothing(smoothing) {
        this.globalSettings.smoothing = Math.max(0, Math.min(1, Math.round(smoothing * 1000) / 1000));
    }
    
    /**
     * 色設定
     * @param {number} color - PIXI.js色コード
     */
    setBrushColor(color) {
        this.globalSettings.brushColor = color;
    }
    
    /**
     * 筆圧感度切り替え
     * @param {boolean} enabled - 有効/無効
     */
    setPressureSensitivity(enabled) {
        this.globalSettings.pressureSensitivity = enabled;
    }
    
    /**
     * エッジスムージング切り替え
     * @param {boolean} enabled - 有効/無効
     */
    setEdgeSmoothing(enabled) {
        this.globalSettings.edgeSmoothing = enabled;
    }
    
    /**
     * GPU加速切り替え
     * @param {boolean} enabled - 有効/無効
     */
    setGPUAcceleration(enabled) {
        this.globalSettings.gpuAcceleration = enabled;
    }
    
    // === 描画処理統合（元HTMLのDrawingEngine統合） ===
    
    /**
     * 描画開始
     * @param {number} x - X座標
     * @param {number} y - Y座標
     */
    startDrawing(x, y) {
        if (!this.drawingEngine) {
            console.warn('⚠️ DrawingEngine未設定');
            return;
        }
        
        this.isDrawing = true;
        this.lastPoint = { x, y };
        
        const tool = this.getCurrentTool();
        if (!tool) {
            console.warn('⚠️ 無効なツール');
            return;
        }
        
        // 元HTMLのcreatePathロジック統合
        this.currentPath = this.createPath(x, y, tool);
    }
    
    /**
     * 描画継続
     * @param {number} x - X座標
     * @param {number} y - Y座標
     */
    continueDrawing(x, y) {
        if (!this.isDrawing || !this.currentPath) return;
        
        // 元HTMLのdrawLineロジック統合
        this.drawLine(this.currentPath, x, y);
        this.lastPoint = { x, y };
    }
    
    /**
     * 描画終了
     */
    stopDrawing() {
        if (this.currentPath) {
            this.currentPath.isComplete = true;
        }
        this.isDrawing = false;
        this.currentPath = null;
        this.lastPoint = null;
    }
    
    /**
     * パス作成（元HTMLのDrawingEngine.createPath統合）
     * @param {number} x - X座標
     * @param {number} y - Y座標
     * @param {Object} tool - ツール設定
     */
    createPath(x, y, tool) {
        const path = {
            id: `path_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            graphics: new PIXI.Graphics(),
            points: [],
            color: tool.type === 'erasing' ? 
                this.drawingEngine.backgroundColor : 
                this.globalSettings.brushColor,
            size: this.globalSettings.brushSize,
            opacity: tool.type === 'erasing' ? 1.0 : this.globalSettings.opacity,
            tool: this.currentTool,
            isComplete: false
        };
        
        // 初回描画: 円形ブラシで点を描画（元HTML方式）
        path.graphics.beginFill(path.color, path.opacity);
        path.graphics.drawCircle(x, y, path.size / 2);
        path.graphics.endFill();
        
        path.points.push({ x, y, size: path.size });
        
        // v8移行準備: Graphics API変更対応
        // v8: path.graphics.circle(x, y, path.size / 2).fill(path.color, path.opacity);
        
        this.drawingEngine.drawingContainer.addChild(path.graphics);
        this.drawingEngine.paths.push(path);
        return path;
    }
    
    /**
     * 線描画（元HTMLのDrawingEngine.drawLine統合）
     * @param {Object} path - パスオブジェクト
     * @param {number} x - X座標
     * @param {number} y - Y座標
     */
    drawLine(path, x, y) {
        if (!path || path.points.length === 0) return;
        
        const lastPoint = path.points[path.points.length - 1];
        const distance = Math.sqrt((x - lastPoint.x) ** 2 + (y - lastPoint.y) ** 2);
        
        // 最小距離フィルタ（元HTML同様）
        if (distance < 1.5) return;
        
        // 連続する円形で線を描画（元HTML方式）
        const steps = Math.max(1, Math.ceil(distance / 1.5));
        for (let i = 1; i <= steps; i++) {
            const t = i / steps;
            const px = lastPoint.x + (x - lastPoint.x) * t;
            const py = lastPoint.y + (y - lastPoint.y) * t;
            
            path.graphics.beginFill(path.color, path.opacity);
            path.graphics.drawCircle(px, py, path.size / 2);
            path.graphics.endFill();
            
            // v8移行準備: Graphics API変更対応
            // v8: path.graphics.circle(px, py, path.size / 2).fill(path.color, path.opacity);
        }
        
        path.points.push({ x, y, size: path.size });
    }
    
    // === 状態取得メソッド ===
    
    /**
     * 全設定取得
     */
    getAllSettings() {
        return { ...this.globalSettings };
    }
    
    /**
     * 登録ツールリスト取得
     */
    getRegisteredTools() {
        return Array.from(this.tools.entries()).map(([id, config]) => ({
            id,
            name: config.name,
            icon: config.icon,
            type: config.type
        }));
    }
    
    /**
     * 描画状態取得
     */
    getDrawingState() {
        return {
            isDrawing: this.isDrawing,
            currentTool: this.currentTool,
            pathCount: this.drawingEngine?.paths?.length || 0
        };
    }
}

// デフォルトエクスポート（互換性確保）
export default ToolManager;/**
 * 🎨 ふたば☆ちゃんねる風ベクターお絵描きツール v1.0
 * 🎯 AI_WORK_SCOPE: ツール系統括・描画ツール切り替え・設定管理
 * 🎯 DEPENDENCIES: js/tools/pen-tool.js, js/tools/eraser-tool.js
 * 🎯 NODE_MODULES: pixi.js@^7.4.3, lodash（利用可能時）
 * 🎯 PIXI_EXTENSIONS: 描画機能・Graphics統合
 * 🎯 ISOLATION_TEST: 可能（ツール依存）
 * 🎯 SPLIT_THRESHOLD: 400行（ツール統括・分割は慎重）
 * 📋 PHASE_TARGET: Phase1
 * 📋 V8_MIGRATION: 変更なし（ツール管理専用）
 */

/**
 * ツール統合管理システム
 * 元HTMLのToolSystemを基にした改良版
 * DRY原則: 共通設定を統一管理
 * SOLID原則: 単一責任 - ツール管理のみ
 */
export class ToolManager {
    constructor() {
        this.currentTool = 'pen';
        this.tools = new Map();
        this.isDrawing = false;
        this.currentPath = null;
        this.lastPoint = null;
        
        // グローバル描画設定（全ツール共通）
        this.globalSettings = {
            brushSize: 16.0,
            brushColor: 0x800000, // ふたばマルーン
            opacity: 0.85,
            pressure: 0.5,
            smoothing: 0.3,
            pressureSensitivity: true,
            edgeSmoothing: true,
            gpuAcceleration: true
        };
        
        console.log('🔧 ToolManager 構築開始...');
    }
    
    /**
     * ツール管理システム初期化
     * @param {DrawingEngine} drawingEngine - 描画エンジンインスタンス
     */
    init(drawingEngine) {
        this.drawingEngine = drawingEngine;
        this.registerDefaultTools();
        console.log('✅ ToolManager 初期化完了 - 登録ツール:', Array.from(this.tools.keys()));
    }
    
    /**
     * デフォルトツール登録
     * 元HTMLのペン・消しゴムツールを統合管理
     */
    registerDefaultTools() {
        // ペンツール登録
        this.registerTool('pen', {
            name: 'ベクターペン',
            icon: 'pen',
            type: 'drawing',
            settings: {
                ...this.globalSettings,
                blendMode: 'normal'
            }
        });
        
        // 消しゴムツール登録
        this.registerTool('eraser', {
            name: '消しゴム', 
            icon: 'eraser',
            type: 'erasing',
            settings: {
                ...this.globalSettings,
                blendMode: 'erase',
                color: this.drawingEngine?.backgroundColor || 0xf0e0d6
            }
        });
    }
    
    /**
     * ツール登録
     * @param {string} toolId - ツールID
     * @param {Object} toolConfig - ツール設定
     */
    registerTool(toolId, toolConfig) {
        this.tools.set(toolId, toolConfig);
        console.log(`🔧 ツール登録: ${toolId} - ${toolConfig.name}`);
    }
    
    /**
     * アクティブツール設定
     * @param {string} toolId - 設定するツールID
     */
    setTool(toolId) {
        if (!this.tools.has(toolId)) {
            console.warn(`⚠️ 未知のツール: ${toolId}`);
            return false;
        }
        
        this.currentTool = toolId;
        console.log(`🎯 ツール切り替え: ${this.tools.get(toolId).name}`);
        return true;
    }
    
    /**
     * 現在のツール取得
     */
    getCurrentTool() {
        return this.tools.get(this.currentTool);
    }
    
    /**
     * 現在のツール名取得
     */
    getCurrentToolName() {
        const tool = this.getCurrentTool();
        return tool ? tool.name : 'Unknown';
    }
    
    // === 描画設定管理（DRY原則） ===
    
    /**
     * ブラシサイズ設定
     * @param {number} size - ブラシサイズ (0.1 - 100)
     */
    setBrushSize(size) {
        this.globalSettings.brushSize = Math.max(0.1, Math.min(100, Math.round(size * 10) / 10));
    }
    
    /**
     * 不透明度設定
     * @param {number} opacity - 不透明度 (0.0 - 1.0)
     */
    setOpacity(opacity) {
        this.globalSettings.opacity = Math.max(0, Math.min(1, Math.round(opacity * 1000) / 1000));
    }
    
    /**
     * 筆圧設定
     * @param {number} pressure - 筆圧 (0.0 - 1.0)
     */
    setPressure(pressure) {
        this.globalSettings.pressure = Math.max(0, Math.min(1, Math.round(pressure * 1000) / 1000));
    }
    
    /**
     * 線補正設定
     * @param {number} smoothing - 線補正 (0.0 - 1.0)
     */
    setSmoothing(smoothing) {
        this.globalSettings.smoothing = Math.max(0, Math.min(1, Math.round(smoothing * 1000) / 1000));
    }
    
    /**
     * 色設定
     * @param {number} color - PIXI.js色コード
     */
    setBrushColor(color) {
        this.globalSettings.brushColor = color;
    }
    
    /**
     * 筆圧感度切り替え
     * @param {boolean} enabled - 有効/無効
     */
    setPressureSensitivity(enabled) {
        this.globalSettings.pressureSensitivity = enabled;
    }
    
    /**
     * エッジスムージング切り替え
     * @param {boolean} enabled - 有効/無効
     */
    setEdgeSmoothing(enabled) {
        this.globalSettings.edgeSmoothing = enabled;
    }
    
    /**
     * GPU加速切り替え
     * @param {boolean} enabled - 有効/無効
     */
    setGPUAcceleration(enabled) {
        this.globalSettings.gpuAcceleration = enabled;
    }
    
    // === 描画処理統合（元HTMLのDrawingEngine統合） ===
    
    /**
     * 描画開始
     * @param {number} x - X座標
     * @param {number} y - Y座標
     */
    startDrawing(x, y) {
        if (!this.drawingEngine) {
            console.warn('⚠️ DrawingEngine未設定');
            return;
        }
        
        this.isDrawing = true;
        this.lastPoint = { x, y };
        
        const tool = this.getCurrentTool();
        if (!tool) {
            console.warn('⚠️ 無効なツール');
            return;
        }
        
        // 元HTMLのcreatePathロジック統合
        this.currentPath = this.createPath(x, y, tool);
    }
    
    /**
     * 描画継続
     * @param {number} x - X座標
     * @param {number} y - Y座標
     */
    continueDrawing(x, y) {
        if (!this.isDrawing || !this.currentPath) return;
        
        // 元HTMLのdrawLineロジック統合
        this.drawLine(this.currentPath, x, y);
        this.lastPoint = { x, y };
    }
    
    /**
     * 描画終了
     */
    stopDrawing() {
        if (this.currentPath) {
            this.currentPath.isComplete = true;
        }
        this.isDrawing = false;
        this.currentPath = null;
        this.lastPoint = null;
    }
    
    /**
     * パス作成（元HTMLのDrawingEngine.createPath統合）
     * @param {number} x - X座標
     * @param {number} y - Y座標
     * @param {Object} tool - ツール設定
     */
    createPath(x, y, tool) {
        const path = {
            id: `path_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            graphics: new PIXI.Graphics(),
            points: [],
            color: tool.type === 'erasing' ? 
                this.drawingEngine.backgroundColor : 
                this.globalSettings.brushColor,
            size: this.globalSettings.brushSize,
            opacity: tool.type === 'erasing' ? 1.0 : this.globalSettings.opacity,
            tool: this.currentTool,
            isComplete: false
        };
        
        // 初回描画: 円形ブラシで点を描画（元HTML方式）
        path.graphics.beginFill(path.color, path.opacity);
        path.graphics.drawCircle(x, y, path.size / 2);
        path.graphics.endFill();
        
        path.points.push({ x, y, size: path.size });
        
        // v8移行準備: Graphics API変更対応
        // v8: path.graphics.circle(x, y, path.size / 2).fill(path.color, path.opacity);
        
        this.drawingEngine.drawingContainer.addChild(path.graphics);
        this.drawingEngine.paths.push(path);
        return path;
    }
    
    /**
     * 線描画（元HTMLのDrawingEngine.drawLine統合）
     * @param {Object} path - パスオブジェクト
     * @param {number} x - X座標
     * @param {number} y - Y座標
     */
    drawLine(path, x, y) {
        if (!path || path.points.length === 0) return;
        
        const lastPoint = path.points[path.points.length - 1];
        const distance = Math.sqrt((x - lastPoint.x) ** 2 + (y - lastPoint.y) ** 2);
        
        // 最小距離フィルタ（元HTML同様）
        if (distance < 1.5) return;
        
        // 連続する円形で線を描画（元HTML方式）
        const steps = Math.max(1, Math.ceil(distance / 1.5));
        for (let i = 1; i <= steps; i++) {
            const t = i / steps;
            const px = lastPoint.x + (x - lastPoint.x) * t;
            const py = lastPoint.y + (y - lastPoint.y) * t;
            
            path.graphics.beginFill(path.color, path.opacity);
            path.graphics.drawCircle(px, py, path.size / 2);
            path.graphics.endFill();
            
            // v8移行準備: Graphics API変更対応
            // v8: path.graphics.circle(px, py, path.size / 2).fill(path.color, path.opacity);
        }
        
        path.points.push({ x, y, size: path.size });
    }
    
    // === 状態取得メソッド ===
    
    /**
     * 全設定取得
     */
    getAllSettings() {
        return { ...this.globalSettings };
    }
    
    /**
     * 登録ツールリスト取得
     */
    getRegisteredTools() {
        return Array.from(this.tools.entries()).map(([id, config]) => ({
            id,
            name: config.name,
            icon: config.icon,
            type: config.type
        }));
    }
    
    /**
     * 描画状態取得
     */
    getDrawingState() {
        return {
            isDrawing: this.isDrawing,
            currentTool: this.currentTool,
            pathCount: this.drawingEngine?.paths?.length || 0
        };
    }
}

// デフォルトエクスポート（互換性確保）
export default ToolManager;
            pressure: 0.5,
            smoothing: 0.3,
            pressureSensitivity: true,
            edgeSmoothing: true,
            gpuAcceleration: true
        };
        
        console.log('🔧 ToolManager 構築開始...');
    }
    
    /**
     * ツール管理システム初期化
     */
    init(drawingEngine) {