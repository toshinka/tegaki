// src/main.js

import { ServiceContainer } from './core/ServiceContainer.js';
import { ToolEngineController } from './engine/ToolEngineController.js';
import { BezierCalculationEngine } from './engine/BezierCalculationEngine.js';
import { OGLRenderingEngine } from './engine/OGLRenderingEngine.js';
import { ToolStore } from './features/tools/ToolStore.js';
import { ToolPanel } from './features/tools/ToolPanel.js';

class App {
    constructor() {
        this.serviceContainer = new ServiceContainer(); [cite: 96]
        this.setupDependencies();
        this.initialize();
    }

    setupDependencies() {
        // 専門エンジンをDIコンテナに登録 [cite: 97]
        this.serviceContainer.register('BezierCalculationEngine', () => new BezierCalculationEngine()); [cite: 97]
        this.serviceContainer.register('OGLRenderingEngine', () => new OGLRenderingEngine()); [cite: 97]
        
        // 制御エンジンと状態ストアを登録
        this.serviceContainer.register('ToolEngineController', () => new ToolEngineController(this.serviceContainer)); [cite: 98]
        this.serviceContainer.register('ToolStore', () => new ToolStore(this.serviceContainer));
    }

    initialize() {
        // UIを初期化
        this.toolPanel = new ToolPanel(this.serviceContainer); [cite: 100]

        // デフォルトツールを選択して協調エンジンを起動
        const toolStore = this.serviceContainer.resolve('ToolStore');
        toolStore.selectTool('pen');
        
        // イベントリスナーを設定
        this.setupEventListeners(); [cite: 101]
    }

    setupEventListeners() {
        const canvas = document.getElementById('vector-canvas'); [cite: 102]
        const toolEngineController = this.serviceContainer.resolve('ToolEngineController');

        canvas.addEventListener('pointerdown', (e) => {
            const rect = canvas.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            const pressure = e.pressure || 1.0;
            toolEngineController.startStroke(x, y, pressure); [cite: 103]
        });

        canvas.addEventListener('pointermove', (e) => {
            if (e.buttons === 0) return;
            const rect = canvas.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            const pressure = e.pressure || 1.0; [cite: 104]
            toolEngineController.continueStroke(x, y, pressure); [cite: 105]
        });

        canvas.addEventListener('pointerup', () => {
            toolEngineController.endStroke(); [cite: 106]
        });
        
        canvas.addEventListener('pointerleave', () => {
            toolEngineController.endStroke();
        });
    }
}

// アプリケーション開始
document.addEventListener('DOMContentLoaded', () => {
    new App(); [cite: 107]
});