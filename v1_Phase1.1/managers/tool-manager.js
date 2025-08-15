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
     */
    init(drawingEngine) {