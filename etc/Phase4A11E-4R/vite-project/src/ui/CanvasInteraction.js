import { ViewportTransform } from '../engine/ViewportTransform.js';
import { mat4 } from 'gl-matrix';
import { hexToRgba } from '../utils/ColorUtils.js';

/**
 * ワールド座標からローカル座標への変換を行う補助関数
 */
function transformWorldToLocal(worldX, worldY, modelMatrix) {
    // モデル行列の逆行列を計算
    const invMatrix = mat4.create();
    mat4.invert(invMatrix, modelMatrix);
    
    // 同次座標で変換
    const worldVec = [worldX, worldY, 0, 1];
    const localVec = [0, 0, 0, 0];
    
    // 逆行列を適用してローカル座標を取得
    for (let i = 0; i < 4; i++) {
        localVec[i] = 
            invMatrix[i] * worldVec[0] +
            invMatrix[i + 4] * worldVec[1] +
    
        invMatrix[i + 8] * worldVec[2] +
            invMatrix[i + 12] * worldVec[3];
    }
    
    return { x: localVec[0], y: localVec[1] };
}

/**
 * [クラス責務] CanvasInteraction.js
 * 目的：ユーザーのキャンバスに対するすべての入力（マウス、ペン、タッチ操作）を管理・解釈する。
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
        
        // 修正: viewportTransformを正しく初期化
        this.viewportTransform = viewport;
        
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
        this.canvasArea.addEventListener('pointerdown', this.handlePointerDown.bind(this));
        // pointermoveとpointerupはdocumentに登録することで、カーソルがキャンバス外に出ても追跡できるようにする
        document.addEventListener('pointermove', this.handlePointerMove.bind(this));
        document.addEventListener('pointerup', this.handlePointerUp.bind(this));
        // キャンバスエリアでの右クリックメニューを無効化
        this.canvasArea.addEventListener('contextmenu', e => e.preventDefault());
    }

    handlePointerDown(e) {
        // 主ボタン（左クリックまたはペン先）でない場合は無視
        if (e.button !== 0) return;

        const activeLayer = this.layerStore.getCurrentLayer();
        if (!activeLayer || !activeLayer.visible) {
            console.log("PointerDown ignored: No active/visible layer.");
            return;
        }
        
        // ポインターキャプチャを設定
        this.canvasArea.setPointerCapture(e.pointerId);

        // 修正: ViewportTransformコンストラクタの使用を修正
        const coords = this.viewportTransform.screenToWorld(e.clientX, e.clientY);
        
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
        
        // 修正: transformWorldToLocal関数を使用
        const localPoint = transformWorldToLocal(superX, superY, activeLayer.modelMatrix);
        
        this.viewport.clearDirtyRect();

        const { tool, mainColor, size, pressureSettings } = this.toolStore.getState();

        if (tool === 'bucket') {
            this.toolActions.fill(activeLayer, localPoint.x, localPoint.y);
            this.viewport.renderAllLayers(this.layerStore.getLayers());
            this.historyStore.saveState();
            this.onDrawEnd?.(activeLayer);
            return;
        }

        this.isDrawing = true;
        this.historyStore.saveState();
        this.pressureHistory = [e.pressure > 0 ? e.pressure : 0.5];
        this.lastPoint = { ...localPoint, pressure: this.pressureHistory[0] };
        
        const pressureSize = this.calculatePressureSize(size, this.lastPoint.pressure, pressureSettings);
        this.viewport.updateDirtyRect(localPoint.x, localPoint.y, pressureSize);
        
        const isEraser = tool === 'eraser';
        // クリック時に点を描画
        this.viewport.drawCircle(localPoint.x, localPoint.y, pressureSize / 2, hexToRgba(mainColor), isEraser, activeLayer);
        
        this.viewport._requestRender(this.layerStore.getLayers());
    }

    handlePointerMove(e) {
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
            const coords = this.viewportTransform.screenToWorld(e.clientX, e.clientY);

            const SUPER_SAMPLING_FACTOR = this.viewport.renderer?.SUPER_SAMPLING_FACTOR || 1.0;
            const superX = coords.x * SUPER_SAMPLING_FACTOR;
            const superY = coords.y * SUPER_SAMPLING_FACTOR;
            
            // 修正: transformWorldToLocal関数を使用
            const local = transformWorldToLocal(superX, superY, activeLayer.modelMatrix);
            
            const currentPressure = e.pressure > 0 ? e.pressure : 0.5;
            this.pressureHistory.push(currentPressure);
            if (this.pressureHistory.length > this.maxPressureHistory) this.pressureHistory.shift();
            
            const lastSize = this.calculatePressureSize(size, this.lastPoint.pressure, pressureSettings);
            const pressureSize = this.calculatePressureSize(size, currentPressure, pressureSettings);
            this.viewport.updateDirtyRect(this.lastPoint.x, this.lastPoint.y, lastSize);
            this.viewport.updateDirtyRect(local.x, local.y, pressureSize);

            const isEraser = tool === 'eraser';
            
            const boundCalculatePressureSize = (baseSize, pressure) => {
                return this.calculatePressureSize(baseSize, pressure, pressureSettings);
            };

            this.viewport.drawLine(
                this.lastPoint.x, this.lastPoint.y, 
                local.x, local.y, 
                size,
                hexToRgba(mainColor), 
                isEraser,
                this.lastPoint.pressure,
                currentPressure,
                boundCalculatePressureSize,
                activeLayer
            );

            this.lastPoint = { ...local, pressure: currentPressure };
            this.viewport._requestRender(this.layerStore.getLayers());
            return;
        }
        
        this.updateCursor();
    }
    
    async handlePointerUp(e) { 
        if (this.isDrawing) {
            this.canvasArea.releasePointerCapture(e.pointerId);

            const activeLayer = this.layerStore.getCurrentLayer();
            if (activeLayer) {
                this.viewport.syncDirtyRectToImageData(activeLayer, this.viewport.dirtyRect);
                this.historyStore.saveState(); 
                this.onDrawEnd?.(activeLayer);
            }
        }
        
        if (this.isPanning) {
             this.canvasArea.releasePointerCapture(e.pointerId);
        }
        
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