/**
 * main.js - Phase2-A Viteエントリーポイント
 * 責務: アプリケーション統合初期化（Vite最適化版）
 */

import { ServiceContainer } from './core/ServiceContainer.js';
import { ToolEngineController } from './core/ToolEngineController.js';
import { BezierStrokeRenderer } from './engine/BezierStrokeRenderer.js';
import { Canvas2DRenderer } from './engine/Canvas2DRenderer.js';
import { ToolStore } from './tools/ToolStore.js';
import { ToolPanel } from './ui/ToolPanel.js';

// ================================================================
// Phase2-A Vite版アプリケーション初期化
// ================================================================
let isDrawing = false;

async function initializeApp() {
    console.log('🚀 Phase2-A Vite版アプリケーション初期化開始');

    // ServiceContainer初期化（DI基盤）
    const container = ServiceContainer.getInstance();
    
    // 各サービスをコンテナに登録
    const canvas = document.getElementById('vector-canvas');
    const bezierRenderer = new BezierStrokeRenderer(canvas);
    const canvas2DRenderer = new Canvas2DRenderer(canvas);
    const toolStore = new ToolStore();
    
    container.register('bezierRenderer', bezierRenderer);
    container.register('canvas2DRenderer', canvas2DRenderer);
    container.register('toolStore', toolStore);

    // ToolEngineController初期化（厳格連動制御）
    const toolEngineController = new ToolEngineController(container);
    container.register('toolEngineController', toolEngineController);

    // ToolPanel初期化（UI制御）- containerを渡すように修正
    const toolPanel = new ToolPanel(container);
    container.register('toolPanel', toolPanel);
    
    // レンダラー初期化
    bezierRenderer.initCanvas();
    canvas2DRenderer.initCanvas();

    // イベントリスナー設定
    setupEventListeners(container);

    console.log('✅ Phase2-A Vite版アプリケーション初期化完了');
}

function setupEventListeners(container) {
    const toolStore = container.resolve('toolStore');
    const toolEngineController = container.resolve('toolEngineController');

    // ペン設定制御
    document.getElementById('penSizeSlider').addEventListener('input', (e) => {
        const size = parseInt(e.target.value);
        document.getElementById('penSizeValue').value = size;
        document.getElementById('statusSize').textContent = size;
        toolStore.updateToolSettings('pen', { size });
        toolEngineController.updateCurrentToolSettings({ size });
    });

    document.getElementById('penSizeValue').addEventListener('change', (e) => {
        const size = parseInt(e.target.value);
        document.getElementById('penSizeSlider').value = size;
        document.getElementById('statusSize').textContent = size;
        toolStore.updateToolSettings('pen', { size });
        toolEngineController.updateCurrentToolSettings({ size });
    });

    document.getElementById('penOpacitySlider').addEventListener('input', (e) => {
        const opacity = parseInt(e.target.value);
        document.getElementById('penOpacityValue').value = opacity;
        document.getElementById('statusOpacity').textContent = opacity + '%';
        toolStore.updateToolSettings('pen', { opacity: opacity / 100 });
        toolEngineController.updateCurrentToolSettings({ opacity: opacity / 100 });
    });

    document.getElementById('penOpacityValue').addEventListener('change', (e) => {
        const opacity = parseInt(e.target.value);
        document.getElementById('penOpacitySlider').value = opacity;
        document.getElementById('statusOpacity').textContent = opacity + '%';
        toolStore.updateToolSettings('pen', { opacity: opacity / 100 });
        toolEngineController.updateCurrentToolSettings({ opacity: opacity / 100 });
    });

    // キャンバス描画制御
    const canvas = document.getElementById('vector-canvas');
    canvas.style.touchAction = 'none';

    canvas.addEventListener('pointerdown', (e) => {
        if (e.button !== 0) return;
        canvas.setPointerCapture(e.pointerId);
        const rect = canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        const pressure = e.pressure !== undefined ? e.pressure : 0.5;
        
        toolEngineController.startStroke(x, y, pressure);
        isDrawing = true;
        e.preventDefault();
    });

    canvas.addEventListener('pointermove', (e) => {
        if (!isDrawing) return;
        const rect = canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        const pressure = e.pressure !== undefined ? e.pressure : 0.5;
        
        toolEngineController.continueStroke(x, y, pressure);
        e.preventDefault();
    });

    const onPointerUp = (e) => {
        if (isDrawing) {
            toolEngineController.endStroke();
            isDrawing = false;
            if (canvas.hasPointerCapture(e.pointerId)) {
                canvas.releasePointerCapture(e.pointerId);
            }
        }
        e.preventDefault();
    };

    canvas.addEventListener('pointerup', onPointerUp);
    canvas.addEventListener('pointerleave', onPointerUp);
    canvas.addEventListener('pointercancel', onPointerUp);
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
}

// DOMContentLoaded時に初期化実行
document.addEventListener('DOMContentLoaded', initializeApp);