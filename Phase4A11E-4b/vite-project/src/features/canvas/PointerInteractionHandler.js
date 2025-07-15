import { mat4 } from 'gl-matrix';
import { getCanvasCoordinates, hexToRgba } from '../../utils/TransformUtils.js';
import { transformWorldToLocal, isValidMatrix } from '../../utils/TransformUtils.js';

/**
 * [クラス責務] PointerInteractionHandler.js
 * 目的：ユーザーのキャンバスに対するすべての入力（マウス、ペン、タッチ操作）を管理・解釈する。
 */
export class PointerInteractionHandler {
    constructor(canvas, { layerStore, toolStore, historyStore, viewport, layerActions, toolActions }) {
        this.canvas = canvas;
        this.layerStore = layerStore;
        this.toolStore = toolStore;
        this.historyStore = historyStore;
        this.viewport = viewport;
        this.layerActions = layerActions;
        this.toolActions = toolActions;
        
        this.canvasArea = document.getElementById('canvas-area');
        if (!this.canvasArea) console.error("❌ PointerInteractionHandler: 'canvas-area' not found!");
        
        // --- Interaction State ---
        this.isDrawing = false;
        this.isPanning = false;
        this.isDraggingLayer = false;
        this.isLayerTransforming = false;
        
        // --- Keyboard State (for ShortcutHandler) ---
        this.isShiftDown = false;
        this.isSpaceDown = false;
        this.isVDown = false;

        // --- Drawing-related State ---
        this.strokePoints = []; // 変更：線描画のための頂点リスト
        this.lastPoint = null;
        this.pressureHistory = [];
        this.maxPressureHistory = 5;
        
        this.dragStartX = 0;
        this.dragStartY = 0;
        this.panStart = { left: 0, top: 0 };
        this.transformStartWorld = { x: 0, y: 0 };
        this.transformOriginalModelMatrix = null;
        
        this.onDrawEnd = null;

        this.bindEvents();
        console.log("✅ PointerInteractionHandler: 初期化成功");
    }

    bindEvents() {
        this.canvasArea.addEventListener('pointerdown', this.handlePointerDown.bind(this));
        document.addEventListener('pointermove', this.handlePointerMove.bind(this));
        document.addEventListener('pointerup', this.handlePointerUp.bind(this));
        this.canvasArea.addEventListener('contextmenu', e => e.preventDefault());
    }

    handlePointerDown(e) {
        if (e.button !== 0) return;

        const activeLayer = this.layerStore.getCurrentLayer();
        if (!activeLayer || !activeLayer.visible) {
            console.log("PointerDown ignored: No active/visible layer.");
            return;
        }
        
        e.currentTarget.setPointerCapture(e.pointerId);

        const coords = getCanvasCoordinates(e, this.canvas, this.viewport.viewTransform);
        
        if (this.isSpaceDown) {
            this.isPanning = true;
            this.dragStartX = e.clientX;
            this.dragStartY = e.clientY;
            this.panStart.left = this.viewport.viewTransform.left;
            this.panStart.top = this.viewport.viewTransform.top;
            this.updateCursor();
            return;
        }
        if (this.isLayerTransforming) {
            this.isDraggingLayer = true;
            this.transformStartWorld = { x: Math.round(coords.x), y: Math.round(coords.y) };
            return;
        }
        
        this.isDrawing = true;
        this.historyStore.saveState(); // 描画開始前に状態を保存

        const SUPER_SAMPLING_FACTOR = this.viewport.renderer?.SUPER_SAMPLING_FACTOR || 1.0;
        const superX = coords.x * SUPER_SAMPLING_FACTOR;
        const superY = coords.y * SUPER_SAMPLING_FACTOR;
        const local = transformWorldToLocal(superX, superY, activeLayer.modelMatrix);
        
        this.viewport.clearDirtyRect();

        const { tool, mainColor, size, pressureSettings } = this.toolStore.getState();

        if (tool === 'bucket') {
            this.toolActions.fill(activeLayer, local.x, local.y);
            this.viewport.renderAllLayers(this.layerStore.getLayers());
            this.historyStore.saveState();
            this.onDrawEnd?.(activeLayer);
            return;
        }
        
        // 変更：描画用の頂点リストを初期化
        this.strokePoints = [local.x, local.y];
        
        const currentPressure = e.pressure > 0 ? e.pressure : 0.5;
        this.pressureHistory = [currentPressure];
        this.lastPoint = { ...local, pressure: this.pressureHistory[0] };
        
        const pressureSize = this.calculatePressureSize(size, this.lastPoint.pressure, pressureSettings);
        this.viewport.updateDirtyRect(local.x, local.y, pressureSize);
        
        const isEraser = tool === 'eraser';
        
        // 変更：単点を描画するためにdrawStrokeを呼び出す
        // viewportにこのメソッドが追加されていることを想定
        if (typeof this.viewport.drawStroke === 'function') {
            this.viewport.drawStroke(this.strokePoints, pressureSize, hexToRgba(mainColor), isEraser, activeLayer);
        } else {
            // フォールバックとして従来のCircle描画を呼ぶ
            this.viewport.drawCircle(local.x, local.y, pressureSize / 2, hexToRgba(mainColor), isEraser, activeLayer);
        }
        
        this.viewport._requestRender(this.layerStore.getLayers());
    }

    handlePointerMove(e) {
        const coords = getCanvasCoordinates(e, this.canvas, this.viewport.viewTransform);

        if (this.isPanning) {
            const dx = e.clientX - this.dragStartX;
            const dy = e.clientY - this.dragStartY;
            this.viewport.viewTransform.left = this.panStart.left + dx;
            this.viewport.viewTransform.top = this.panStart.top + dy;
            this.viewport.applyViewTransform();
            return;
        }
        if (this.isDraggingLayer) { /* ... (unchanged) ... */ return; }
        
        if (this.isDrawing && e.currentTarget.hasPointerCapture(e.pointerId)) {
            const activeLayer = this.layerStore.getCurrentLayer();
            if (!activeLayer) return;
            
            const { tool, mainColor, size, pressureSettings } = this.toolStore.getState();

            const SUPER_SAMPLING_FACTOR = this.viewport.renderer?.SUPER_SAMPLING_FACTOR || 1.0;
            const superX = coords.x * SUPER_SAMPLING_FACTOR;
            const superY = coords.y * SUPER_SAMPLING_FACTOR;
            const local = transformWorldToLocal(superX, superY, activeLayer.modelMatrix);
            
            // 変更：頂点リストに現在の座標を追加
            this.strokePoints.push(local.x, local.y);

            const currentPressure = e.pressure > 0 ? e.pressure : 0.5;
            this.pressureHistory.push(currentPressure);
            if (this.pressureHistory.length > this.maxPressureHistory) this.pressureHistory.shift();
            
            //  dirtyRectの更新（簡略化のためストローク全体の矩形を更新）
            const pressureSize = this.calculatePressureSize(size, currentPressure, pressureSettings);
            // TODO: より正確なdirtyRect計算
            this.viewport.updateDirtyRect(this.lastPoint.x, this.lastPoint.y, pressureSize);
            this.viewport.updateDirtyRect(local.x, local.y, pressureSize);

            const isEraser = tool === 'eraser';

            // 変更：線（複数の頂点）を描画するためにdrawStrokeを呼び出す
            if (typeof this.viewport.drawStroke === 'function') {
                // NOTE: 筆圧対応はひとまず平均サイズを利用
                const avgPressure = this.pressureHistory.reduce((a, b) => a + b) / this.pressureHistory.length;
                const avgSize = this.calculatePressureSize(size, avgPressure, pressureSettings);
                this.viewport.drawStroke(this.strokePoints, avgSize, hexToRgba(mainColor), isEraser, activeLayer);
            } else {
                // フォールバック
                this.viewport.drawLine(
                    this.lastPoint.x, this.lastPoint.y, 
                    local.x, local.y, 
                    size, hexToRgba(mainColor), isEraser, 
                    this.lastPoint.pressure, currentPressure, 
                    (s, p) => this.calculatePressureSize(s, p, pressureSettings), 
                    activeLayer
                );
            }

            this.lastPoint = { ...local, pressure: currentPressure };
            this.viewport._requestRender(this.layerStore.getLayers());
            return;
        }
        
        this.updateCursor();
    }
    
    async handlePointerUp(e) { 
        if (e.currentTarget.hasPointerCapture(e.pointerId)) {
            e.currentTarget.releasePointerCapture(e.pointerId);
        }

        if (this.isDrawing) {
            const activeLayer = this.layerStore.getCurrentLayer();
            if (activeLayer) {
                // GPU上の描画結果をImageDataに同期
                this.viewport.syncDirtyRectToImageData(activeLayer, this.viewport.dirtyRect);
                this.historyStore.saveState(); 
                this.onDrawEnd?.(activeLayer);
            }
        }
        
        // 変更：頂点リストをクリア
        this.strokePoints = [];
        this.isDrawing = false;
        this.isPanning = false;
        this.isDraggingLayer = false;
        this.updateCursor();
    }
    
    startLayerTransform() { /* ... (unchanged) ... */ }
    
    commitLayerTransform() { /* ... (unchanged) ... */ }
    
    cancelLayerTransform() { /* ... (unchanged) ... */ }
    
    applyLayerTransform(transform) {
        if (!this.isLayerTransforming || !this.transformOriginalModelMatrix) return;
        const activeLayer = this.layerStore.getCurrentLayer();
        if (!activeLayer) return;
        
        // This logic is complex and has been simplified for brevity
        // ...

        this.viewport.renderAllLayers(this.layerStore.getLayers());
    }
    
    calculatePressureSize(baseSize, pressure, pressureSettings) { 
        const safeBaseSize = Math.max(1, baseSize);
        if (!pressureSettings.enabled) return safeBaseSize;
        const minSize = safeBaseSize * (pressureSettings.min / 100);
        return minSize + (safeBaseSize - minSize) * pressure;
    }
    
    updateCursor() { /* ... (unchanged) ... */ }
}