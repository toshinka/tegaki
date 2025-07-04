/*
 * ===================================================================================
 * Toshinka Tegaki Tool - Core Engine
 * Version: 2.8.0 (Phase 4A9: WebGL Layer Movement)
 *
 * - 修正：
 * - WebGLレイヤー移動に対応するため、レイヤーのmodelMatrixとカメラのviewMatrixを導入。
 * - UIからのレイヤー操作（移動、回転、拡大縮小）がmodelMatrixに反映されるように変更。
 * - ペン描画の座標計算がviewMatrixのみに依存し、レイヤー移動の影響を受けないように修正。
 * - カメラのパン・ズームがviewMatrixに反映されるように修正。
 * ===================================================================================
 */

// --- Module Imports ---
import { TopBarManager, LayerUIManager } from './ui/ui-manager.js';
import { ShortcutManager } from './ui/shortcut-manager.js';
import { BucketTool } from './tools/toolset.js';
import { RenderingBridge } from './core/rendering/rendering-bridge.js';

// Assume gl-matrix is loaded globally, e.g., via <script src="gl-matrix-min.js"></script>

function hexToRgba(hex) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16),
        a: 255
    } : { r: 0, g: 0, b: 0, a: 255 };
}

class Layer {
    constructor(name, width, height) {
        this.name = name;
        this.visible = true;
        this.opacity = 100;
        this.blendMode = 'normal';
        this.imageData = new ImageData(width, height);
        this.modelMatrix = mat4.create(); // WebGL model matrix for this layer
        this.originalImageData = null;
        this.gpuDirty = true; // GPUテクスチャが更新を必要とするか

        // UI-friendly transform properties (updated by UI, then converts to modelMatrix)
        this._position = { x: 0, y: 0 };
        this._rotation = 0; // in radians
        this._scale = 1;
        
        // Initialize modelMatrix based on initial properties
        this.updateModelMatrix();
    }

    // Getters/Setters for UI-friendly properties to ensure modelMatrix is updated
    get position() { return this._position; }
    set position(p) { this._position = p; this.updateModelMatrix(); }
    get rotation() { return this._rotation; }
    set rotation(r) { this._rotation = r; this.updateModelMatrix(); }
    get scale() { return this._scale; }
    set scale(s) { this._scale = s; this.updateModelMatrix(); }

    clear() {
        this.imageData.data.fill(0);
        this.gpuDirty = true;
    }
    fill(hexColor) {
        const color = hexToRgba(hexColor);
        const data = this.imageData.data;
        for (let i = 0; i < data.length; i += 4) {
            data[i] = color.r;
            data[i + 1] = color.g;
            data[i + 2] = color.b;
            data[i + 3] = color.a;
        }
        this.gpuDirty = true;
    }
    // Updates the WebGL model matrix from the layer's position, rotation, and scale properties
    updateModelMatrix() {
        mat4.identity(this.modelMatrix);
        // Apply transformations: Translate -> Rotate -> Scale (order matters for visual effect)
        // For gl-matrix, operations are applied right-to-left conceptually,
        // so you apply them in the reverse order of how they affect the object.
        // Or simply, each call updates the matrix from its current state.
        mat4.translate(this.modelMatrix, this.modelMatrix, [this._position.x, this._position.y, 0]);
        mat4.rotateZ(this.modelMatrix, this.modelMatrix, this._rotation);
        mat4.scale(this.modelMatrix, this.modelMatrix, [this._scale, this._scale, 1]);
    }
}

class CanvasManager {
    constructor(app) {
        this.app = app;
        this.displayCanvas = document.getElementById('drawingCanvas'); 
        this.displayCtx = this.displayCanvas.getContext('2d', { willReadFrequently: true });
        this.canvasArea = document.getElementById('canvas-area');
        this.canvasContainer = document.getElementById('canvas-container');
        this.width = this.displayCanvas.width;
        this.height = this.displayCanvas.height;

        this.renderingBridge = new RenderingBridge(this.displayCanvas);

        this.compositionData = new ImageData(this.width, this.height);
        this.isDrawing = false; this.isPanning = false; this.isSpaceDown = false;
        
        this.isVDown = false; this.isShiftDown = false; // V for layer transform, Shift for scale mode
        
        this.isLayerTransforming = false;
        this.transformTargetLayer = null;
        this.originalLayerTransform = null; // Store initial position, rotation, scale
        this.transformMode = 'move'; this.transformStartX = 0; this.transformStartY = 0;
        
        this.currentTool = 'pen';
        this.currentColor = '#800000'; this.currentSize = 1; this.lastPoint = null;
        
        this.pressureSettings = {
            sensitivity: 0.8, minPressure: 0.1, maxPressure: 1.0, curve: 0.7,
            minSizeRatio: 0.3, dynamicRange: true
        };
        this.pressureHistory = [];
        this.maxPressureHistory = 5;

        this.history = []; this.historyIndex = -1;

        this.dirtyRect = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity };
        this.animationFrameId = null;

        // Camera/View State - now based on these properties, matrices will be derived
        this.camera = { x: 0, y: 0, scale: 1, rotation: 0 };
        this.viewMatrix = mat4.create();
        this.projectionMatrix = mat4.create();

        this.bindEvents();
        this.updateViewMatrices(); // Initial setup of matrices
    }
    
    bindEvents() {
        this.canvasArea.addEventListener('pointerdown', this.onPointerDown.bind(this));
        document.addEventListener('pointermove', this.onPointerMove.bind(this));
        document.addEventListener('pointerup', this.onPointerUp.bind(this));
        this.canvasArea.addEventListener('wheel', this.handleWheel.bind(this), { passive: false });
        document.addEventListener('contextmenu', e => e.preventDefault());
        document.getElementById('saveMergedButton')?.addEventListener('click', () => this.exportMergedImage());

        // Keyboard events for V key (layer transform) and Shift key (scale mode)
        document.addEventListener('keydown', this.onKeyDown.bind(this));
        document.addEventListener('keyup', this.onKeyUp.bind(this));
    }

    onKeyDown(e) {
        if (e.key === 'v' || e.key === 'V') {
            this.isVDown = true;
            if (this.currentTool !== 'move') { // Set to move tool if V is pressed
                this.app.toolManager.setTool('move');
            }
        }
        if (e.key === 'Shift') {
            this.isShiftDown = true;
        }
        if (e.code === 'Space') {
            this.isSpaceDown = true;
            this.displayCanvas.style.cursor = 'grab';
        }
    }

    onKeyUp(e) {
        if (e.key === 'v' || e.key === 'V') {
            this.isVDown = false;
        }
        if (e.key === 'Shift') {
            this.isShiftDown = false;
        }
        if (e.code === 'Space') {
            this.isSpaceDown = false;
            this.displayCanvas.style.cursor = 'default';
        }
    }

    // New/Modified method to update view and projection matrices
    updateViewMatrices() {
        // Projection Matrix: Orthographic projection + Y-axis inversion
        // This ensures WebGL's Y-up matches canvas's Y-down (origin top-left)
        mat4.identity(this.projectionMatrix);
        // Orthographic projection: left, right, bottom, top, near, far
        // For Y-down (canvas-like) coordinates: 0, width, height, 0 (bottom, top swapped)
        mat4.ortho(this.projectionMatrix, 0, this.width, this.height, 0, -1, 1);
        
        // View Matrix: Camera pan/zoom/rotation
        mat4.identity(this.viewMatrix);
        // Translate camera: negate camera.x/y to move the world
        mat4.translate(this.viewMatrix, this.viewMatrix, [-this.camera.x, -this.camera.y, 0]);
        // Rotate around camera origin
        mat4.rotateZ(this.viewMatrix, this.viewMatrix, this.camera.rotation);
        // Scale camera view
        mat4.scale(this.viewMatrix, this.viewMatrix, [this.camera.scale, this.camera.scale, 1]);

        this.renderingBridge.setMatrices(this.projectionMatrix, this.viewMatrix);
        this.renderAllLayers();
    }

    // Modify getCanvasCoordinates to use inverse of Projection * View matrix
    // This converts screen coordinates (from pointer events) to world coordinates.
    getCanvasCoordinates(e) {
        const rect = this.displayCanvas.getBoundingClientRect();
        
        // Normalized Device Coordinates (NDC)
        // x and y range from -1 to +1 (left to right, bottom to top)
        const x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
        const y = ((e.clientY - rect.top) / rect.height) * 2 - 1; // Y is inverted for WebGL NDC

        let clipCoords = vec4.fromValues(x, y, 0, 1);

        // Get the inverse of the Projection * View matrix
        let invProjView = mat4.create();
        mat4.multiply(invProjView, this.projectionMatrix, this.viewMatrix);
        mat4.invert(invProjView, invProjView);

        // Transform clip coordinates back to world coordinates
        let worldCoords = vec4.create();
        vec4.transformMat4(worldCoords, clipCoords, invProjView);

        // Normalize by W component
        return { x: worldCoords[0] / worldCoords[3], y: worldCoords[1] / worldCoords[3] };
    }

    onPointerDown(e) {
        if (e.button !== 0) return;
        
        if (this.isVDown && this.currentTool === 'move') { // Only allow transform if 'move' tool is active
            this.startLayerTransform(e);
            e.preventDefault(); return;
        }
        if (this.isSpaceDown) {
            this.dragStartX = e.clientX; this.dragStartY = e.clientY; this.isPanning = true;
            // Store current camera position for panning
            this.canvasStartX = this.camera.x; this.canvasStartY = this.camera.y;
            e.preventDefault(); return;
        }

        const coords = this.getCanvasCoordinates(e); // Use the new function for accurate world coords
        if (!coords) return;
        
        const activeLayer = this.app.layerManager.getCurrentLayer();
        if (!activeLayer || !activeLayer.visible) return;

        this._resetDirtyRect();
        
        if (this.currentTool === 'bucket') {
            // Bucket tool still operates on ImageData in local layer coordinates.
            // Its fill will not be affected by modelMatrix.
            this.app.bucketTool.fill(activeLayer.imageData, coords.x, coords.y, hexToRgba(this.currentColor));
            activeLayer.gpuDirty = true; // Notifies GPU texture needs update
            this.renderAllLayers();
            this.saveState();
            return;
        }

        this.isDrawing = true;
        this.pressureHistory = [e.pressure > 0 ? e.pressure : 0.5]; // 0圧を回避
        this.lastPoint = { ...coords, pressure: this.pressureHistory[0] };
        
        const size = this.calculatePressureSize(this.currentSize, this.lastPoint.pressure);
        
        this._updateDirtyRect(coords.x, coords.y, size);
        
        // Pass active layer, current projection & view matrices for brush drawing
        this.renderingBridge.drawCircle(
            coords.x, coords.y, size / 2, 
            hexToRgba(this.currentColor), this.currentTool === 'eraser',
            activeLayer, // pass active layer to know which FBO to draw to
            this.projectionMatrix, this.viewMatrix // Pass matrices for brush drawing
        );
        
        this._requestRender();
        document.documentElement.setPointerCapture(e.pointerId);
    }

    onPointerMove(e) {
        if (this.isLayerTransforming) {
            const dx = e.clientX - this.transformStartX;
            const dy = e.clientY - this.transformStartY;
            const targetLayer = this.transformTargetLayer;
            const original = this.originalLayerTransform; // {x, y, scale, rotation}

            // Adjust delta based on current camera scale for consistent movement speed
            const scaledDx = dx / this.camera.scale;
            const scaledDy = dy / this.camera.scale;

            if (this.transformMode === 'move') {
                targetLayer.position = { x: original.x + scaledDx, y: original.y + scaledDy };
            } else if (this.transformMode === 'scale') {
                // Scale factor based on vertical movement
                const scaleFactor = 1 + scaledDy * -0.01; // Invert dy for intuitive scaling (drag up to scale up)
                targetLayer.scale = Math.max(0.01, original.scale * scaleFactor); // Minimum scale to prevent inversion
            } else if (this.transformMode === 'rotate') {
                // Simple rotation based on horizontal movement
                targetLayer.rotation = original.rotation + scaledDx * 0.01; // Adjust factor for sensitivity
            }
            // `targetLayer.position/rotation/scale` setters call `updateModelMatrix()`
            targetLayer.gpuDirty = true; // Mark layer for GPU update
            this.renderAllLayers(); // Re-render to show preview
            return;
        }

        if (this.isPanning) {
            const dx = e.clientX - this.dragStartX;
            const dy = e.clientY - this.dragStartY;
            // Adjust camera position based on screen delta and current scale
            this.camera.x = this.canvasStartX - dx / this.camera.scale;
            this.camera.y = this.canvasStartY - dy / this.camera.scale;
            this.updateViewMatrices(); // Update view matrix and re-render
            return;
        }

        if (!this.isDrawing) return;
        const coords = this.getCanvasCoordinates(e);
        if (!coords) {
            this.lastPoint = null; return;
        }
        const activeLayer = this.app.layerManager.getCurrentLayer();
        if (!activeLayer || !activeLayer.visible) return;
        if (!this.lastPoint) {
            this.pressureHistory = [e.pressure > 0 ? e.pressure : 0.5];
            this.lastPoint = { ...coords, pressure: e.pressure > 0 ? e.pressure : 0.5 };
            return;
        }
        const currentPressure = e.pressure > 0 ? e.pressure : 0.5;
        this.pressureHistory.push(currentPressure);
        if (this.pressureHistory.length > this.maxPressureHistory) {
            this.pressureHistory.shift();
        }
        const lastSize = this.calculatePressureSize(this.currentSize, this.lastPoint.pressure);
        const currentSize = this.calculatePressureSize(this.currentSize, currentPressure);
        
        this._updateDirtyRect(coords.x, coords.y, currentSize);
        
        // Pass active layer, current projection & view matrices for brush drawing
        this.renderingBridge.drawLine(
            this.lastPoint.x, this.lastPoint.y, lastSize / 2,
            coords.x, coords.y, currentSize / 2,
            hexToRgba(this.currentColor), this.currentTool === 'eraser',
            activeLayer, // pass active layer
            this.projectionMatrix, this.viewMatrix // Pass matrices for brush drawing
        );
        
        this.lastPoint = { ...coords, pressure: currentPressure };
        this._requestRender();
    }

    onPointerUp(e) {
        if (this.isLayerTransforming) {
            this.endLayerTransform();
            e.preventDefault();
        }
        if (this.isPanning) {
            this.isPanning = false;
            this.displayCanvas.style.cursor = 'default';
            e.preventDefault();
        }
        if (this.isDrawing) {
            this.isDrawing = false;
            this.lastPoint = null;
            this.saveState();
        }
        document.documentElement.releasePointerCapture(e.pointerId);
    }

    startLayerTransform(e) { // Accept event object now
        const activeLayer = this.app.layerManager.getCurrentLayer();
        if (!activeLayer) return;

        this.transformTargetLayer = activeLayer;
        this.originalLayerTransform = {
            x: activeLayer.position.x,
            y: activeLayer.position.y,
            scale: activeLayer.scale,
            rotation: activeLayer.rotation
        };
        this.transformStartX = e.clientX;
        this.transformStartY = e.clientY;
        this.isLayerTransforming = true;

        if (this.isShiftDown) {
            this.transformMode = 'scale';
            this.displayCanvas.style.cursor = 'ns-resize'; // North-South resize cursor
        } else if (e.altKey) {
            this.transformMode = 'rotate';
            this.displayCanvas.style.cursor = 'crosshair'; // General crosshair for rotation
        } else {
            this.transformMode = 'move';
            this.displayCanvas.style.cursor = 'move'; // Move cursor
        }
    }

    endLayerTransform() {
        this.isLayerTransforming = false;
        this.transformTargetLayer = null;
        this.originalLayerTransform = null;
        this.displayCanvas.style.cursor = 'default';
        this.renderAllLayers(); // Final render after transformation
        this.saveState(); // Save state after transform
    }

    handleWheel(e) {
        // Prevent default scroll behavior
        e.preventDefault();

        const scaleFactor = 1.1; // Zoom in/out factor

        if (e.ctrlKey) { // Zoom
            const oldScale = this.camera.scale;
            if (e.deltaY < 0) { // Zoom in
                this.camera.scale *= scaleFactor;
            } else { // Zoom out
                this.camera.scale /= scaleFactor;
            }
            this.camera.scale = Math.max(0.1, Math.min(10, this.camera.scale)); // Clamp zoom level

            // Zoom around mouse cursor (pinching effect)
            const mouseCoords = this.getCanvasCoordinates(e); // World coords of mouse
            
            // Adjust camera position so that the world coordinate under the mouse remains the same
            this.camera.x += mouseCoords.x * (1 / oldScale - 1 / this.camera.scale);
            this.camera.y += mouseCoords.y * (1 / oldScale - 1 / this.camera.scale);

            this.updateViewMatrices();
        } else if (e.shiftKey) { // Horizontal scroll (via vertical scroll wheel + shift)
            this.camera.x += e.deltaY / this.camera.scale;
            this.updateViewMatrices();
        } else { // Vertical scroll
            this.camera.y += e.deltaY / this.camera.scale;
            this.updateViewMatrices();
        }
    }

    // Existing renderAllLayers needs to be updated to pass matrices
    renderAllLayers() {
        // Assume LayerManager has getLayers()
        const layers = this.app.layerManager.getLayers();
        this.renderingBridge.compositeLayers(layers); // Matrices are already set in renderingBridge
    }

    // ... (other CanvasManager methods like calculatePressureSize, _updateDirtyRect, _requestRender, exportMergedImage, saveState, etc. remain the same)
    
    // Placeholder for app.layerManager.getLayers() and app.toolManager.setTool()
    // These methods should exist in your LayerManager and ToolManager classes.
}

class ToshinkaTegakiTool {
    constructor() {
        this.initManagers();
    }
    initManagers() {
        this.canvasManager = new CanvasManager(this);
        this.layerManager = new LayerManager(this); // Assuming LayerManager is defined elsewhere
        this.penSettingsManager = new PenSettingsManager(this); // Assuming PenSettingsManager is defined elsewhere
        this.colorManager = new ColorManager(this); // Assuming ColorManager is defined elsewhere
        this.toolManager = new ToolManager(this); // Assuming ToolManager is defined elsewhere
        this.topBarManager = new TopBarManager(this);
        this.shortcutManager = new ShortcutManager(this);
        this.layerUIManager = new LayerUIManager(this);
        this.bucketTool = new BucketTool(this); // Assuming BucketTool is defined elsewhere
        this.shortcutManager.initialize();
        this.layerManager.setupInitialLayers();
        this.toolManager.setTool('pen');
        this.penSettingsManager.setSize(1);
        this.colorManager.setColor(this.colorManager.mainColor);
    }
}

window.addEventListener('DOMContentLoaded', () => {
    if (!window.toshinkaTegakiInitialized) {
        window.toshinkaTegaki = new ToshinkaTegakiTool();
        window.toshinkaTegakiInitialized = true;
    }
});