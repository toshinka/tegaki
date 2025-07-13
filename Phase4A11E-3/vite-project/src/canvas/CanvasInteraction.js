import { mat4 } from 'gl-matrix';
import { isValidMatrix, transformWorldToLocal, getCanvasCoordinates, hexToRgba } from '../../utils/TransformUtils.js';

/**
 * [クラス責務] CanvasInteraction.js
 * 目的：ユーザーのキャンバスに対するすべての入力（マウス、ペン、タッチ操作）を管理・解釈する。
 * 責務：
 * 1. ポインタイベントの処理：'pointerdown', 'pointermove', 'pointerup' を購読する。
 * 2. 意図の解釈：現在のツール（from ToolStore）や修飾キーの状態に応じて、イベントが「描画」「レイヤー移動」「視点操作」のいずれであるかを判断する。
 * 3. 処理の委譲：解釈した意図に基づき、具体的な処理を他のモジュールに委譲する。
 * - 描画 → CanvasViewport (Renderer) に描画命令
 * - 状態変更 → HistoryStore にスナップショット作成依頼
 * - 座標変換 → TransformUtils を利用
 *
 * 旧canvas-manager.jsの入力処理と描画キックのロジックがこのクラスに集約された。
 * 状態管理（Undo/Redo, ViewTransform）は分離され、外部から注入される。
 */
export class CanvasInteraction {
    constructor(canvas, { layerStore, toolStore, historyStore, viewport }) {
        this.canvas = canvas;
        this.layerStore = layerStore;
        this.toolStore = toolStore;
        this.historyStore = historyStore;
        this.viewport = viewport;
        
        this.canvasArea = document.getElementById('canvas-area');
        if (!this.canvasArea) console.error("❌ CanvasInteraction: 'canvas-area' not found!");
        
        // --- Interaction State ---
        this.isDrawing = false;
        this.isPanning = false;
        this.isDraggingLayer = false;
        this.isLayerTransforming = false;
        this.layerTransformPending = false;
        this.transformDragStarted = false;

        // --- Keyboard State ---
        this.isShiftDown = false;
        this.isSpaceDown = false;

        // --- Drawing-related State ---
        this.lastPoint = null;
        this.pressureHistory = [];
        this.maxPressureHistory = 5;
        
        // --- Drag/Pan State ---
        this.dragStartX = 0;
        this.dragStartY = 0;
        this.panStart = { left: 0, top: 0 };
        
        // --- Transform State ---
        this.transformStartWorld = { x: 0, y: 0 };
        this.transformOriginalModelMatrix = null;
        
        // --- Callbacks ---
        this.onDrawEnd = null;

        this.bindEvents();
        console.log("✅ CanvasInteraction: 初期化成功");
    }

    bindEvents() {
        this.canvasArea.addEventListener('pointerdown', this.onPointerDown.bind(this));
        document.addEventListener('pointermove', this.onPointerMove.bind(this));
        document.addEventListener('pointerup', this.onPointerUp.bind(this));
        
        // Prevent context menu on right-click
        document.addEventListener('contextmenu', e => e.preventDefault());

        // Handle keyboard state for panning, etc.
        // Note: A dedicated KeyboardHandler/ShortcutHandler would be better.
        document.addEventListener('keydown', e => {
            if (e.key === ' ') this.isSpaceDown = true;
            if (e.shiftKey) this.isShiftDown = true;
            this.updateCursor();
        });
        document.addEventListener('keyup', e => {
            if (e.key === ' ') this.isSpaceDown = false;
            if (e.shiftKey) this.isShiftDown = false;
            this.updateCursor();
        });
    }

    _isPointOnLayer(worldCoords, layer) {
        if (!layer || !layer.visible) return false;
        const currentActiveLayer = this.layerStore.getCurrentLayer();
        if (!currentActiveLayer || !isValidMatrix(currentActiveLayer.modelMatrix)) return false;

        const SUPER_SAMPLING_FACTOR = this.viewport.renderer?.SUPER_SAMPLING_FACTOR || 1.0;
        const superX = worldCoords.x * SUPER_SAMPLING_FACTOR;
        const superY = worldCoords.y * SUPER_SAMPLING_FACTOR;
        const local = transformWorldToLocal(superX, superY, layer.modelMatrix, mat4);
        
        const layerWidth = layer.imageData.width * SUPER_SAMPLING_FACTOR;
        const layerHeight = layer.imageData.height * SUPER_SAMPLING_FACTOR;
        
        return local.x >= 0 && local.x < layerWidth && local.y >= 0 && local.y < layerHeight;
    }

    onPointerDown(e) {
        if (e.button !== 0) return; // Only main button

        const activeLayer = this.layerStore.getCurrentLayer();
        if (!activeLayer || !activeLayer.visible) {
            console.warn("🎨 CanvasInteraction.onPointerDown: No active/visible layer to draw on.");
            return;
        }

        const coords = getCanvasCoordinates(e, this.canvas, this.viewport.viewTransform);
        
        // --- Determine user's intent ---

        // 1. Panning Intent
        if (this.isSpaceDown) {
            this.isPanning = true;
            this.dragStartX = e.clientX;
            this.dragStartY = e.clientY;
            this.panStart.left = this.viewport.viewTransform.left;
            this.panStart.top = this.viewport.viewTransform.top;
            this.updateCursor();
            return;
        }

        // 2. Layer Transform Intent
        if (this.isLayerTransforming) {
            this.isDraggingLayer = true;
            this.transformStartWorld = { x: Math.round(coords.x), y: Math.round(coords.y) };
            return;
        }
        
        // 3. Drawing Intent
        const SUPER_SAMPLING_FACTOR = this.viewport.renderer?.SUPER_SAMPLING_FACTOR || 1.0;
        const superX = coords.x * SUPER_SAMPLING_FACTOR;
        const superY = coords.y * SUPER_SAMPLING_FACTOR;
        const local = transformWorldToLocal(superX, superY, activeLayer.modelMatrix, mat4);
        
        this.viewport.clearDirtyRect();

        const { tool, color, size, pressureSettings } = this.toolStore.getToolSettings();

        // Handle bucket tool separately as it's a single-click action
        if (tool === 'bucket') {
            // NOTE: The original BucketTool logic was on the `app` object.
            // A dedicated Tool class (e.g., BucketTool.js) would handle this.
            // For now, this is a placeholder for where that logic would be called.
            console.log("Bucket tool clicked (logic to be implemented in a dedicated tool class).");
            // e.g., this.bucketTool.fill(activeLayer, local.x, local.y);
            this.viewport.renderAllLayers(this.layerStore.getLayers());
            this.historyStore.saveState();
            this.onDrawEnd?.(activeLayer);
            return;
        }

        // --- Start Drawing ---
        this.isDrawing = true;
        this.pressureHistory = [e.pressure > 0 ? e.pressure : 0.5];
        this.lastPoint = { ...local, pressure: this.pressureHistory[0] };
        
        const pressureSize = this.calculatePressureSize(size, this.lastPoint.pressure, pressureSettings);
        this.viewport.updateDirtyRect(local.x, local.y, pressureSize);
        
        const isEraser = tool === 'eraser';
        this.viewport.drawCircle(local.x, local.y, pressureSize / 2, hexToRgba(color), isEraser, activeLayer);
        
        this.viewport._requestRender(this.layerStore.getLayers());
        document.documentElement.setPointerCapture(e.pointerId);
    }

    onPointerMove(e) {
        const coords = getCanvasCoordinates(e, this.canvas, this.viewport.viewTransform);

        // --- Panning ---
        if (this.isPanning) {
            const dx = e.clientX - this.dragStartX;
            const dy = e.clientY - this.dragStartY;
            this.viewport.viewTransform.left = this.panStart.left + dx;
            this.viewport.viewTransform.top = this.panStart.top + dy;
            this.viewport.applyViewTransform();
            return;
        }
        
        // --- Layer Dragging ---
        if (this.isDraggingLayer) {
            const activeLayer = this.layerStore.getCurrentLayer();
            if (!activeLayer) return;
            
            const dx = coords.x - this.transformStartWorld.x;
            const dy = coords.y - this.transformStartWorld.y;
            const SUPER_SAMPLING_FACTOR = this.viewport.renderer?.SUPER_SAMPLING_FACTOR || 1.0;

            const translationMatrix = mat4.create();
            mat4.fromTranslation(translationMatrix, [dx * SUPER_SAMPLING_FACTOR, dy * SUPER_SAMPLING_FACTOR, 0]);

            const newMatrix = mat4.create();
            mat4.multiply(newMatrix, translationMatrix, this.transformOriginalModelMatrix);
            
            this.layerStore.updateCurrentLayer({ modelMatrix: newMatrix });
            this.viewport.renderAllLayers(this.layerStore.getLayers());
            return;
        }
        
        // --- Drawing ---
        if (this.isDrawing) {
            const activeLayer = this.layerStore.getCurrentLayer();
            if (!activeLayer) return;
            
            const { tool, color, size, pressureSettings } = this.toolStore.getToolSettings();

            const SUPER_SAMPLING_FACTOR = this.viewport.renderer?.SUPER_SAMPLING_FACTOR || 1.0;
            const superX = coords.x * SUPER_SAMPLING_FACTOR;
            const superY = coords.y * SUPER_SAMPLING_FACTOR;
            const local = transformWorldToLocal(superX, superY, activeLayer.modelMatrix, mat4);
            
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
                size, hexToRgba(color), isEraser, 
                this.lastPoint.pressure, currentPressure, 
                (s, p) => this.calculatePressureSize(s, p, pressureSettings), 
                activeLayer
            );

            this.lastPoint = { ...local, pressure: currentPressure };
            this.viewport._requestRender(this.layerStore.getLayers());
            return;
        }
        
        // If not doing anything else, just update the cursor
        this.updateCursor(coords);
    }

    async onPointerUp(e) {
        if (this.isDrawing) {
            this.isDrawing = false;
            
            // Final render of the stroke
            this.viewport._renderDirty(this.layerStore.getLayers());

            const activeLayer = this.layerStore.getCurrentLayer();
            if (activeLayer) {
                // Sync the drawn part from GPU to CPU ImageData for persistence
                this.viewport.syncDirtyRectToImageData(activeLayer, this.viewport.dirtyRect);
                
                // Trigger callback (e.g., for saving to DB)
                await this.onDrawEnd?.(activeLayer);
            }
            
            this.lastPoint = null;
            this.historyStore.saveState(); // Save the state after the drawing is complete
        }

        if (this.isDraggingLayer) {
            this.isDraggingLayer = false;
        }
        
        if (this.isPanning) {
            this.isPanning = false;
            this.updateCursor();
        }

        if (document.documentElement.hasPointerCapture(e.pointerId)) {
            document.documentElement.releasePointerCapture(e.pointerId);
        }
    }
    
    // --- Layer Transform Methods ---
    // These methods would be triggered by UI buttons (not by direct canvas interaction)
    
    startLayerTransform() {
        if (this.isLayerTransforming) return;
        const activeLayer = this.layerStore.getCurrentLayer();
        if (!activeLayer || !activeLayer.visible) return;

        this.isLayerTransforming = true;
        this.transformOriginalModelMatrix = mat4.clone(activeLayer.modelMatrix);

        // This logic creates a temporary copy of the layer to transform visually
        if (activeLayer.gpuDirty) {
            this.viewport.renderAllLayers(this.layerStore.getLayers());
        }
        const syncedImageData = this.viewport.getTransformedImageData(activeLayer);
        if (syncedImageData) {
            this.layerStore.updateCurrentLayer({ transformStage: syncedImageData });
        } else {
            console.error("Failed to get ImageData for transform. Aborting.");
            this.isLayerTransforming = false;
            return;
        }
        
        this.updateCursor();
    }
    
    async commitLayerTransform() {
        if (!this.isLayerTransforming) return;
        this.isLayerTransforming = false;
        
        const activeLayer = this.layerStore.getCurrentLayer();
        if (!activeLayer || !this.transformOriginalModelMatrix) return;
        
        const transformedImageData = this.viewport.getTransformedImageData(activeLayer);
        
        if (!transformedImageData || transformedImageData.width === 0) {
            console.warn("Transform failed: empty image data. Reverting.");
            this.layerStore.updateCurrentLayer({ 
                modelMatrix: mat4.clone(this.transformOriginalModelMatrix),
                transformStage: null
            });
        } else {
            // "Bake" the transformation into the ImageData
            const newImageData = new ImageData(
                new Uint8ClampedArray(transformedImageData.data),
                transformedImageData.width,
                transformedImageData.height
            );
            this.layerStore.updateCurrentLayer({
                imageData: newImageData,
                modelMatrix: mat4.create(), // Reset matrix
                transformStage: null,
                gpuDirty: true
            });
            await this.onDrawEnd?.(this.layerStore.getCurrentLayer());
        }

        this.transformOriginalModelMatrix = null;
        this.viewport.renderAllLayers(this.layerStore.getLayers());
        this.historyStore.saveState();
        this.updateCursor();
    }
    
    cancelLayerTransform() {
        if (!this.isLayerTransforming) return;
        this.isLayerTransforming = false;
        
        if (this.transformOriginalModelMatrix) {
            this.layerStore.updateCurrentLayer({
                modelMatrix: mat4.clone(this.transformOriginalModelMatrix),
                transformStage: null,
                gpuDirty: true,
            });
        }
        
        this.transformOriginalModelMatrix = null;
        this.viewport.renderAllLayers(this.layerStore.getLayers());
        this.updateCursor();
    }

    // --- Utility Methods ---

    calculatePressureSize(baseSize, pressure, pressureSettings) {
        // This complex pressure calculation logic is preserved from the original file
        const superSamplingFactor = this.viewport.renderer?.SUPER_SAMPLING_FACTOR || 1.0;
        const { curve, minSizeRatio } = pressureSettings;
        
        let normalizedPressure = Math.max(0, Math.min(1, pressure || 0));
        const tempHistory = [...this.pressureHistory, normalizedPressure];
        if (tempHistory.length > this.maxPressureHistory) tempHistory.shift();
        
        const smoothedPressure = tempHistory.reduce((sum, p) => sum + p, 0) / tempHistory.length;
        
        const curvedPressure = Math.pow(smoothedPressure, curve);
        
        const superSamplingBaseSize = baseSize * superSamplingFactor;
        const minSize = superSamplingBaseSize * minSizeRatio;
        const maxSize = superSamplingBaseSize;
        const finalSize = minSize + (maxSize - minSize) * curvedPressure;
        
        return Math.max(0.1 * superSamplingFactor, finalSize);
    }
    
    updateCursor(coords) {
        if (this.isLayerTransforming) { this.canvasArea.style.cursor = 'move'; return; }
        if (this.isPanning) { this.canvasArea.style.cursor = 'grabbing'; return; }
        if (this.isSpaceDown) { this.canvasArea.style.cursor = 'grab'; return; }
        
        const { tool } = this.toolStore.getToolSettings();
        switch (tool) {
            case 'pen': this.canvasArea.style.cursor = 'crosshair'; break;
            case 'eraser': this.canvasArea.style.cursor = 'cell'; break;
            case 'bucket': this.canvasArea.style.cursor = 'copy'; break;
            default: this.canvasArea.style.cursor = 'default';
        }
    }
}