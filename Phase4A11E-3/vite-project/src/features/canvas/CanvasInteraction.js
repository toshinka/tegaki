import { mat4 } from 'gl-matrix';
import { getCanvasCoordinates, hexToRgba } from '../../utils/Transform.js';
import { transformWorldToLocal, isValidMatrix } from '../../utils/Transform.js';

/**
 * [クラス責務] CanvasInteraction.js
 * 目的：ユーザーのキャンバスに対するすべての入力（マウス、ペン、タッチ操作）を管理・解釈する。
 * 旧canvas-manager.jsの入力処理と描画キックのロジックがこのクラスに集約された。
 */
export class CanvasInteraction {
    constructor(canvas, { layerStore, toolStore, historyStore, viewport, layerActions, toolActions }) {
        this.canvas = canvas;
        this.layerStore = layerStore;
        this.toolStore = toolStore;
        this.historyStore = historyStore;
        this.viewport = viewport;
        this.layerActions = layerActions;
        this.toolActions = toolActions;
        
        this.canvasArea = document.getElementById('canvas-area');
        if (!this.canvasArea) console.error("❌ CanvasInteraction: 'canvas-area' not found!");
        
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
        console.log("✅ CanvasInteraction: 初期化成功");
    }

    bindEvents() {
        this.canvasArea.addEventListener('pointerdown', this.onPointerDown.bind(this));
        document.addEventListener('pointermove', this.onPointerMove.bind(this));
        document.addEventListener('pointerup', this.onPointerUp.bind(this));
        document.addEventListener('contextmenu', e => e.preventDefault());
    }

    onPointerDown(e) {
        if (e.button !== 0) return;

        const activeLayer = this.layerStore.getCurrentLayer();
        if (!activeLayer || !activeLayer.visible) {
            return;
        }

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

        this.isDrawing = true;
        this.pressureHistory = [e.pressure > 0 ? e.pressure : 0.5];
        this.lastPoint = { ...local, pressure: this.pressureHistory[0] };
        
        const pressureSize = this.calculatePressureSize(size, this.lastPoint.pressure, pressureSettings);
        this.viewport.updateDirtyRect(local.x, local.y, pressureSize);
        
        const isEraser = tool === 'eraser';
        this.viewport.drawCircle(local.x, local.y, pressureSize / 2, hexToRgba(mainColor), isEraser, activeLayer);
        
        this.viewport._requestRender(this.layerStore.getLayers());
        document.documentElement.setPointerCapture(e.pointerId);
    }

    onPointerMove(e) {
        const coords = getCanvasCoordinates(e, this.canvas, this.viewport.viewTransform);

        if (this.isPanning) {
            const dx = e.clientX - this.dragStartX;
            const dy = e.clientY - this.dragStartY;
            this.viewport.viewTransform.left = this.panStart.left + dx;
            this.viewport.viewTransform.top = this.panStart.top + dy;
            this.viewport.applyViewTransform();
            return;
        }
        if (this.isDraggingLayer) { /* ... (unchanged) ... */ }
        if (this.isDrawing) {
            const activeLayer = this.layerStore.getCurrentLayer();
            if (!activeLayer) return;
            
            const { tool, mainColor, size, pressureSettings } = this.toolStore.getState();

            const SUPER_SAMPLING_FACTOR = this.viewport.renderer?.SUPER_SAMPLING_FACTOR || 1.0;
            const superX = coords.x * SUPER_SAMPLING_FACTOR;
            const superY = coords.y * SUPER_SAMPLING_FACTOR;
            const local = transformWorldToLocal(superX, superY, activeLayer.modelMatrix);
            
            const currentPressure = e.pressure > 0 ? e.pressure : 0.5;
            this.pressureHistory.push(currentPressure);
            if (this.pressureHistory.length > this.maxPressureHistory) this.pressureHistory.shift();
            
            const lastSize = this.calculatePressureSize(size, this.lastPoint.pressure, pressureSettings);
            const pressureSize = this.calculatePressureSize(size, currentPressure, pressureSettings);
            this.viewport.updateDirtyRect(this.lastPoint.x, this.lastPoint.y, lastSize);
            this.viewport.updateDirtyRect(local.x, local.y, pressureSize);

            const isEraser = tool === 'eraser';
            this.viewport.drawLine(
                this.lastPoint.x, this.lastPoint.y, 
                local.x, local.y, 
                size, hexToRgba(mainColor), isEraser, 
                this.lastPoint.pressure, currentPressure, 
                (s, p) => this.calculatePressureSize(s, p, pressureSettings), 
                activeLayer
            );

            this.lastPoint = { ...local, pressure: currentPressure };
            this.viewport._requestRender(this.layerStore.getLayers());
            return;
        }
        
        this.updateCursor();
    }
    
    async onPointerUp(e) { /* ... (unchanged from previous step) ... */ }
    
    startLayerTransform() { /* ... (unchanged from previous step) ... */ }
    
    commitLayerTransform() { /* ... (unchanged from previous step) ... */ }
    
    cancelLayerTransform() { /* ... (unchanged from previous step) ... */ }
    
    applyLayerTransform(transform) {
        if (!this.isLayerTransforming || !this.transformOriginalModelMatrix) return;
        const activeLayer = this.layerStore.getCurrentLayer();
        if (!activeLayer) return;
        
        // This logic is complex and has been simplified for brevity, but the core idea is to
        // create a transformation matrix from the input (translation, scale, etc.)
        // and multiply it with the layer's current modelMatrix.
        // Example for translation:
        // const transformMatrix = mat4.create();
        // mat4.fromTranslation(transformMatrix, [translation[0], translation[1], 0]);
        // mat4.multiply(activeLayer.modelMatrix, transformMatrix, activeLayer.modelMatrix);

        this.viewport.renderAllLayers(this.layerStore.getLayers());
    }
    
    calculatePressureSize(baseSize, pressure, pressureSettings) { /* ... (unchanged) ... */ }
    
    updateCursor() { /* ... (unchanged from previous step) ... */ }
}