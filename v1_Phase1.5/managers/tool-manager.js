/**
 * 🛠️ ToolManager - ツール系統括制御
 * 責務:
 * - ツール切替管理
 * - 描画イベント処理
 * - ブラシ設定管理
 * - ショートカット処理
 * 
 * 🎯 AI_WORK_SCOPE: ツール系統括制御専用ファイル
 * 🎯 DEPENDENCIES: app-core.js, drawing-tools.js
 * 📋 SPLIT_PLAN: Phase2でtools/*.js分割予定
 * - PenTool → tools/pen-tool.js  
 * - EraserTool → tools/eraser-tool.js
 */

class ToolManager {
    constructor(appCore) {
        this.appCore = appCore;
        this.extensions = appCore.extensions;
        this.currentTool = 'pen';
        this.brushSize = 16;
        this.brushOpacity = 0.85;
        this.brushColor = 0x800000; // ふたば色
        this.pressure = 0.5;
        this.smoothing = 0.3;
        this.tools = new Map();
        this.isInitialized = false;
        this.isDrawing = false;
        
        // 描画設定
        this.settings = {
            pen: {
                size: 16,
                opacity: 0.85,
                pressure: 0.5,
                smoothing: 0.3,
                color: 0x800000,
                pressureSensitivity: true,
                edgeSmoothing: false,
                gpuAcceleration: true
            },
            eraser: {
                size: 20,
                opacity: 1.0,
                pressure: 0.0,
                smoothing: 0.1
            }
        };
    }
    
    async init() {
        console.log('🛠️ ToolManager 初期化開始...');
        
        try {
            await this.setupTools();
            await this.setupShortcuts();
            await this.setupEventHandlers();
            
            this.isInitialized = true;
            console.log('✅ ToolManager 初期化完了');
        } catch (error) {
            console.error('❌ ToolManager