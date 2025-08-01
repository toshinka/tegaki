// main.js - Phase段階的import管理テンプレート（Phase1+Phase2統合対応版）

// 🔥 Phase1: OGL統一基盤（実装済み・動作確認済み）
import { OGLUnifiedEngine } from './OGLDrawingCore.js';
import { OGLInputController } from './OGLInputController.js';
import { ShortcutController } from './ShortcutController.js';
import { HistoryController } from './HistoryController.js';
import { EventStore } from './EventStore.js';

// 🎨 Phase2: ツール・UI・カラー統合（同時実装・動作確認）
import { ToolProcessor } from './ToolProcessor.js';
import { UIController } from './UIController.js';
import { ColorProcessor } from './ColorProcessor.js';
import { LayerProcessor } from './LayerProcessor.js';
// import { CanvasController } from './CanvasController.js';  // 次回実装

// ⚡ Phase3: 高度ツール・メッシュ変形・アニメーション（Phase2完成後封印解除）
// import { AdvancedToolProcessor } from './AdvancedToolProcessor.js';
// import { AnimationController } from './AnimationController.js';
// import { FileController } from './FileController.js';
// import { MeshDeformController } from './MeshDeformController.js';

// 🏪 Stores段階的追加（Phase3で実装）
// import { AnimationStore } from './stores/AnimationStore.js';
// import { ProjectStore } from './stores/ProjectStore.js';

/**
 * 🎯 モダンお絵かきツール統合アプリケーション
 * Phase1+Phase2統合実装対応・OGL統一エンジン版
 */
class DrawingApp {
    constructor(canvasElement) {
        // 基本要素
        this.canvas = canvasElement;
        
        // 🔥 Phase1: OGL統一基盤初期化
        this.eventStore = new EventStore();
        this.engine = new OGLUnifiedEngine(this.canvas);
        this.inputController = new OGLInputController(this.engine, this.eventStore);
        this.shortcuts = new ShortcutController(this.engine, this.eventStore);
        this.history = new HistoryController(this.engine, this.eventStore);
        
        // 🎨 Phase2: ツール・UI統合
        this.toolProcessor = new ToolProcessor(this.engine, this.eventStore);
        this.uiController = new UIController(this.eventStore, this.toolProcessor);
        this.colorProcessor = new ColorProcessor(this.engine, this.eventStore);
        this.layerProcessor = new LayerProcessor(this.engine, this.eventStore);
        
        // Phase2拡張（次回実装）
        // this.canvasController = new CanvasController(this.engine, this.eventStore);
        
        // ⚡ Phase3: 高度機能（封印解除時追加）
        // this.advancedToolProcessor = new AdvancedToolProcessor(this.engine, this.eventStore);
        // this.animationController = new AnimationController(this.engine, this.eventStore);
        // this.fileController = new FileController(this.eventStore);
        
        // 初期化状態
        this.initialized = false;
        this.currentPhase = 'Phase1+Phase2(ほぼ完全)';
        
        console.log('✅ DrawingApp初期化完了（Phase1+Phase2対応）');
    }
    
    /**
     * アプリケーション初期化
     */
    async initialize() {
        try {
            // Phase1基盤初期化
            await this.initializePhase1();
            
            // Phase2統合初期化
            await this.initializePhase2();
            
        // Phase2拡張初期化
        await this.initializePhase2Extended();
            
            this.initialized = true;
            console.log('🚀 DrawingApp初期化完了');
            
            return true;
            
        } catch (error) {
            console.error('🚨 DrawingApp初期化エラー:', error);
            this.handleInitializationError(error);
            return false;
        }
    }
    
    /**
     * 🔥 Phase1: OGL統一基盤初期化
     */
    async initializePhase1() {
        console.log('🔥 Phase1初期化開始...');
        
        // Event