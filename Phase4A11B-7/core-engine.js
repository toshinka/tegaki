/*
 * ===================================================================================
 * Toshinka Tegaki Tool - Core Engine
 * Version: 3.0.0 (Phase 4A11B-7 - Cell Buffer Drawing)
 *
 * - 🎯 改修目的 (Phase 4A11B-7):
 * - レイヤー移動後に描画位置がズレる問題を根本的に解決するため、描画方式を刷新。
 * - 旧方式：直接レイヤーに描画（modelMatrixの逆変換で座標計算）
 * - 新方式：一時的なセルバッファ（tempCanvas）に描画し、描画完了後にレイヤーへ転写する。
 *
 * - 💡主な変更点：
 * - 1. CanvasManagerに一時描画用の`tempCanvas`を追加。プレビュー用に画面の一番上に配置。
 * - 2. ペン・消しゴムツールでの描画(onPointerDown/Move)を、この`tempCanvas`に対して行うように変更。
 * - この際、`modelMatrix`による座標変換（transformWorldToLocal）は行わない。
 * - 3. 描画終了時(onPointerUp)に、`tempCanvas`の内容をアクティブレイヤーに転写する`_transferTempCanvasToLayer`処理を実装。
 * - 転写時にレイヤーの`modelMatrix`を考慮し、正しい位置・姿勢で貼り付ける。
 * - 4. 描画中の`dirtyRect`による部分更新を停止し、`onPointerUp`での全更新に切り替え。
 * - 5. バケツツールは従来通り、直接imageDataを操作する方式を維持。
 * ===================================================================================
 */

// --- glMatrix 定義 ---
const mat4 = window.glMatrix.mat4;
const vec4 = window.glMatrix.vec4;

// --- Module Imports ---
import { TopBarManager, LayerUIManager } from './ui/ui-manager.js';
import { ShortcutManager } from './ui/shortcut-manager.js';
import { BucketTool } from './tools/toolset.js';
import { RenderingBridge } from './core/rendering/rendering-bridge.js';
import { LayerManager } from './layer-manager/layer-manager.js';
import { PenSettingsManager } from './ui/pen-settings-manager.js';
import { ColorManager } from './ui/color-manager.js';
import { ToolManager } from './ui/tool-manager.js';

// --- Utility Functions ---

function hexToRgba(hex) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16),
        a: 255
    } : { r: 0, g: 0, b: 0, a: 255 };
}

function isValidMatrix(m) {
    return m && m.length === 16 && Array.from(m).every(Number.isFinite);
}

function transformWorldToLocal(worldX, worldY, modelMatrix) {
    const invMatrix = mat4.create();
    if (!mat4.invert(invMatrix, modelMatrix)) {
        console.warn("⚠ transformWorldToLocal: inversion failed");
        return { x: worldX, y: worldY };
    }
    const worldPos = vec4.fromValues(worldX, worldY, 0, 1);
    const localPos = vec4.create();
    vec4.transformMat4(localPos, worldPos, invMatrix);
    return { x: localPos[0], y: localPos[1] };
}

function getCanvasCoordinates(e, canvas, viewTransform) {
    const rect = canvas.getBoundingClientRect();
    let x = e.clientX - rect.left;
    let y = e.clientY - rect.top;

    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    x *= scaleX;
    y *= scaleY;

    if (viewTransform) {
        if (viewTransform.flipX === -1) {
            x = canvas.width - x;
        }
        if (viewTransform.flipY === -1) {
            y = canvas.height - y;
        }
    }
    
    return { x, y };
}

// --- Core Logic Classes ---
export class Layer {
    constructor(name, width, height) {
        this.name = name;
        this.visible = true;
        this.opacity = 100;
        this.blendMode = 'normal';
        this.imageData = new ImageData(width, height);
        this.modelMatrix = mat4.create();
        this.gpuDirty = true;
    }
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

        // ✅ 1. 一時セル（tempCanvas）の作成
        this.tempCanvas = document.createElement('canvas');
        this.tempCtx = this.tempCanvas.getContext('2d');
        this.canvasContainer.appendChild(this.tempCanvas); // DOMに追加
        
        // スタイル設定
        const SUPER_SAMPLING_FACTOR = this.renderingBridge.currentEngine?.SUPER_SAMPLING_FACTOR || 1.0;
        this.tempCanvas.width = this.width * SUPER_SAMPLING_FACTOR;
        this.tempCanvas.height = this.height * SUPER_SAMPLING_FACTOR;
        
        const displayStyle = window.getComputedStyle(this.displayCanvas);
        this.tempCanvas.style.position = 'absolute';
        this.tempCanvas.style.left = '0px';
        this.tempCanvas.style.top = '0px';
        this.tempCanvas.style.width = this.displayCanvas.style.width;
        this.tempCanvas.style.height = this.displayCanvas.style.height;
        this.tempCanvas.style.zIndex = (parseInt(displayStyle.zIndex) || 0) + 2;
        this.tempCanvas.style.pointerEvents = 'none'; // マウスイベントを透過させる

        this.isDrawing = false; 
        this.isPanning = false; 
        this.isSpaceDown = false;
        this.isLayerMoving = false;
        
        this.isVDown = false; 
        
        this.lastPoint = null;
        
        this.transformStartWorldX = 0;
        this.transformStartWorldY = 0;
        this.originalModelMatrix = null;
        
        this.pressureSettings = {
            sensitivity: 0.8, minPressure: 0.1, maxPressure: 1.0, curve: 0.7,
            minSizeRatio: 0.3, dynamicRange: true
        };
        this.pressureHistory = [];
        this.maxPressureHistory = 5;

        this.history = []; 
        this.historyIndex = -1;

        this.dragStartX = 0; 
        this.dragStartY = 0; 
        this.canvasStartX = 0; 
        this.canvasStartY = 0;
        this.viewTransform = { scale: 1, rotation: 0, flipX: 1, flipY: 1, left: 0, top: 0 };
        
        this.bindEvents();
    }
    
    bindEvents() {
        this.canvasArea.addEventListener('pointerdown', this.onPointerDown.bind(this));
        document.addEventListener('pointermove', this.onPointerMove.bind(this));
        document.addEventListener('pointerup', this.onPointerUp.bind(this));
        this.canvasArea.addEventListener('wheel', this.handleWheel.bind(this), { passive: false });
        document.addEventListener('contextmenu', e => e.preventDefault());
        document.getElementById('saveMergedButton')?.addEventListener('click', () => this.exportMergedImage());
        
        document.addEventListener("keydown", (e) => {
            if (e.key === "v" || e.key === "V") this.isVDown = true;
            if (e.key === " ") this.isSpaceDown = true;
            this.updateCursor(getCanvasCoordinates(e, this.displayCanvas, this.viewTransform));
        });
        
        document.addEventListener("keyup", (e) => {
            if (e.key === "v" || e.key === "V") this.isVDown = false;
            if (e.key === " ") this.isSpaceDown = false;
            this.updateCursor(getCanvasCoordinates(e, this.displayCanvas, this.viewTransform));
        });
    }

    _isPointOnLayer(worldCoords, layer) {
        if (!layer) return false;

        const SUPER_SAMPLING_FACTOR = this.renderingBridge.currentEngine?.SUPER_SAMPLING_FACTOR || 1.0;
        const superX = worldCoords.x * SUPER_SAMPLING_FACTOR;
        const superY = worldCoords.y * SUPER_SAMPLING_FACTOR;

        const local = transformWorldToLocal(superX, superY, layer.modelMatrix);

        const layerWidth = this.width * SUPER_SAMPLING_FACTOR;
        const layerHeight = this.height * SUPER_SAMPLING_FACTOR;

        return local.x >= 0 && local.x < layerWidth && local.y >= 0 && local.y < layerHeight;
    }

    onPointerDown(e) {
        if (e.button !== 0) return;
        
        const activeLayer = this.app.layerManager.getCurrentLayer();
        if (!activeLayer) return;
        
        if (!isValidMatrix(activeLayer.modelMatrix)) {
            console.warn("⚠ onPointerDown: invalid modelMatrix detected, resetting");
            activeLayer.modelMatrix = mat4.create();
        }
        
        const coords = getCanvasCoordinates(e, this.displayCanvas, this.viewTransform);

        if (!this.isSpaceDown && !this.isVDown) {
            if (!this._isPointOnLayer(coords, activeLayer)) {
                return;
            }
        }
        
        if (this.isSpaceDown) {
            this.isPanning = true;
            this.dragStartX = e.clientX; 
            this.dragStartY = e.clientY; 
            this.canvasStartX = this.viewTransform.left; 
            this.canvasStartY = this.viewTransform.top;
            return;
        }

        if (this.isVDown) {
            this.isLayerMoving = true;
            this.transformStartWorldX = coords.x;
            this.transformStartWorldY = coords.y;
            this.originalModelMatrix = mat4.clone(activeLayer.modelMatrix);
            return;
        }
        
        if (!activeLayer.visible) return;

        const SUPER_SAMPLING_FACTOR = this.renderingBridge.currentEngine?.SUPER_SAMPLING_FACTOR || 1.0;
        const superCoords = { 
            x: coords.x * SUPER_SAMPLING_FACTOR, 
            y: coords.y * SUPER_SAMPLING_FACTOR 
        };
        
        const currentTool = this.app.toolManager.currentTool;

        if (currentTool === 'pen' || currentTool === 'eraser') {
            this.isDrawing = true;
            document.documentElement.setPointerCapture(e.pointerId);

            this.pressureHistory = [e.pressure > 0 ? e.pressure : 0.5];
            this.lastPoint = { ...superCoords, pressure: this.pressureHistory[0] };

            this.tempCtx.clearRect(0, 0, this.tempCanvas.width, this.tempCanvas.height);
            console.log(`✏️ セルへの描画を開始: ${currentTool}`);

            this._drawPenCircle(
                this.lastPoint.x, 
                this.lastPoint.y, 
                this.calculatePressureSize(this.app.penSettingsManager.currentSize, this.lastPoint.pressure),
                this.app.colorManager.currentColor,
                currentTool === 'eraser'
            );
            return;
        }
        
        if (currentTool === 'bucket') {
            const local = transformWorldToLocal(superCoords.x, superCoords.y, activeLayer.modelMatrix);
            this.app.bucketTool.fill(activeLayer.imageData, Math.round(local.x), Math.round(local.y), hexToRgba(this.app.colorManager.currentColor));
            activeLayer.gpuDirty = true;
            this.renderAllLayers();
            this.saveState();
            return;
        }
    }
    
    onPointerMove(e) {
        if (this.isPanning) {
            const dx = e.clientX - this.dragStartX; 
            const dy = e.clientY - this.dragStartY;
            this.viewTransform.left = this.canvasStartX + dx; 
            this.viewTransform.top = this.canvasStartY + dy;
            this.applyViewTransform(); 
            return;
        }

        if (this.isLayerMoving) {
            const activeLayer = this.app.layerManager.getCurrentLayer();
            if (!activeLayer) return;
            const coords = getCanvasCoordinates(e, this.displayCanvas, this.viewTransform);
            const dx = coords.x - this.transformStartWorldX;
            const dy = coords.y - this.transformStartWorldY;
            
            const SUPER_SAMPLING_FACTOR = this.renderingBridge.currentEngine?.SUPER_SAMPLING_FACTOR || 1.0;
            const adjustedDx = dx * SUPER_SAMPLING_FACTOR;
            const adjustedDy = dy * SUPER_SAMPLING_FACTOR;

            const translationMatrix = mat4.create();
            mat4.fromTranslation(translationMatrix, [adjustedDx, adjustedDy, 0]);

            const newMatrix = mat4.create();
            mat4.multiply(newMatrix, translationMatrix, this.originalModelMatrix);

            activeLayer.modelMatrix = newMatrix;
            
            this.renderAllLayers();
            return;
        }

        if (this.isDrawing) {
            if (!this.lastPoint) return;
            const coords = getCanvasCoordinates(e, this.displayCanvas, this.viewTransform);
            const SUPER_SAMPLING_FACTOR = this.renderingBridge.currentEngine?.SUPER_SAMPLING_FACTOR || 1.0;
            const superCoords = { 
                x: coords.x * SUPER_SAMPLING_FACTOR, 
                y: coords.y * SUPER_SAMPLING_FACTOR 
            };
            
            const currentPressure = e.pressure > 0 ? e.pressure : 0.5;
            this.pressureHistory.push(currentPressure);
            if (this.pressureHistory.length > this.maxPressureHistory) this.pressureHistory.shift();
            
            const currentPoint = { ...superCoords, pressure: currentPressure };

            this._drawPenLine(
                this.lastPoint, 
                currentPoint, 
                this.app.penSettingsManager.currentSize, 
                this.app.colorManager.currentColor,
                this.app.toolManager.currentTool === 'eraser'
            );
            
            this.lastPoint = currentPoint;
            return;
        }

        this.updateCursor(getCanvasCoordinates(e, this.displayCanvas, this.viewTransform));
    }
    
    onPointerUp(e) {
        if (this.isDrawing) {
            this.isDrawing = false;
            this._transferTempCanvasToLayer();
            this.lastPoint = null;
            this.saveState();
        }
        
        if (this.isLayerMoving) {
            this.isLayerMoving = false;
            this.saveState();
        }

        this.isPanning = false;
        if (document.documentElement.hasPointerCapture(e.pointerId)) {
            document.documentElement.releasePointerCapture(e.pointerId);
        }
    }

    _drawPenCircle(x, y, radius, color, isEraser) {
        this.tempCtx.save();
        this.tempCtx.fillStyle = color;
        if (isEraser) {
            this.tempCtx.globalCompositeOperation = 'destination-out';
        }
        this.tempCtx.beginPath();
        this.tempCtx.arc(x, y, radius / 2, 0, Math.PI * 2);
        this.tempCtx.fill();
        this.tempCtx.restore();
    }

    _drawPenLine(startPoint, endPoint, baseSize, color, isEraser) {
        this.tempCtx.save();
        this.tempCtx.strokeStyle = color;
        this.tempCtx.lineCap = 'round';
        this.tempCtx.lineJoin = 'round';
        if (isEraser) {
            this.tempCtx.globalCompositeOperation = 'destination-out';
        }
        
        const avgPressure = (startPoint.pressure + endPoint.pressure) / 2;
        const avgSize = this.calculatePressureSize(baseSize, avgPressure);
        
        this.tempCtx.lineWidth = Math.max(0.1, avgSize);
        
        this.tempCtx.beginPath();
        this.tempCtx.moveTo(startPoint.x, startPoint.y);
        this.tempCtx.lineTo(endPoint.x, endPoint.y);
        this.tempCtx.stroke();
        
        this.tempCtx.restore();
    }

    _transferTempCanvasToLayer() {
        const activeLayer = this.app.layerManager.getCurrentLayer();
        if (!activeLayer) return;
    
        console.log("✏️ 描画 → 転写 開始");
    
        const layerCanvas = document.createElement('canvas');
        const layerCtx = layerCanvas.getContext('2d');
        layerCanvas.width = activeLayer.imageData.width;
        layerCanvas.height = activeLayer.imageData.height;
        
        layerCtx.putImageData(activeLayer.imageData, 0, 0);
    
        const invMatrix = mat4.create();
        mat4.invert(invMatrix, activeLayer.modelMatrix);
        
        const m = invMatrix;
        layerCtx.setTransform(m[0], m[1], m[4], m[5], m[12], m[13]);
        
        layerCtx.drawImage(this.tempCanvas, 0, 0);
        
        layerCtx.setTransform(1, 0, 0, 1, 0, 0);
        
        activeLayer.imageData = layerCtx.getImageData(0, 0, layerCanvas.width, layerCanvas.height);
        activeLayer.gpuDirty = true;
    
        this.tempCtx.clearRect(0, 0, this.tempCanvas.width, this.tempCanvas.height);
    
        this.renderAllLayers();
        
        console.log("✅ 転写 完了");
    }

    renderAllLayers() {
        this.renderingBridge.compositeLayers(this.app.layerManager.layers);
        this.renderingBridge.renderToDisplay();
    }
    
    calculatePressureSize(baseSizeInput, pressure) {
        const baseSize = Math.max(0.1, baseSizeInput);
        let normalizedPressure = Math.max(0, Math.min(1, pressure || 0));
        
        const tempHistory = [...this.pressureHistory, normalizedPressure];
        if (tempHistory.length > this.maxPressureHistory) tempHistory.shift();
        const smoothedPressure = tempHistory.reduce((sum, p) => sum + p, 0) / tempHistory.length;

        let finalPressure = smoothedPressure;

        const historyLength = this.pressureHistory.length;
        if (this.isDrawing && historyLength <= this.maxPressureHistory) {
            const dampingFactor = historyLength / this.maxPressureHistory;
            const initialDamping = 0.2 + Math.pow(dampingFactor, 3) * 0.8;
            finalPressure *= initialDamping;
        }

        if (this.pressureSettings.dynamicRange) {
            const minHist = Math.min(...tempHistory, finalPressure);
            const maxHist = Math.max(...tempHistory, finalPressure);
            const range = maxHist - minHist;
            if (range > 0.1) {
                finalPressure = (finalPressure - minHist) / range;
            }
        }
        
        const curve = this.pressureSettings.curve;
        const curvedPressure = Math.pow(finalPressure, curve);
        
        const SUPER_SAMPLING_FACTOR = this.renderingBridge.currentEngine?.SUPER_SAMPLING_FACTOR || 1.0;
        const superSamplingBaseSize = baseSize * SUPER_SAMPLING_FACTOR;

        const minSize = superSamplingBaseSize * this.pressureSettings.minSizeRatio;
        const maxSize = superSamplingBaseSize;
        const finalSize = minSize + (maxSize - minSize) * curvedPressure;
        
        return Math.max(0.1 * SUPER_SAMPLING_FACTOR, finalSize);
    }

    saveState() {
        const state = {
            layers: this.app.layerManager.layers.map(layer => {
                if (!isValidMatrix(layer.modelMatrix)) {
                    console.warn("⚠ saveState: invalid modelMatrix detected, resetting");
                    layer.modelMatrix = mat4.create();
                }
                const savedModelMatrix = Array.from(layer.modelMatrix);
                return {
                    name: layer.name,
                    visible: layer.visible,
                    opacity: layer.opacity,
                    blendMode: layer.blendMode,
                    imageData: new ImageData(
                        new Uint8ClampedArray(layer.imageData.data),
                        layer.imageData.width,
                        layer.imageData.height
                    ),
                    modelMatrix: savedModelMatrix
                };
            }),
            activeLayerIndex: this.app.layerManager.activeLayerIndex
        };
        
        this.history = this.history.slice(0, this.historyIndex + 1);
        this.history.push(state);
        this.historyIndex++;
    }

    restoreState(state) {
        this.app.layerManager.layers = state.layers.map(layerData => {
            const layer = new Layer(layerData.name, layerData.imageData.width, layerData.imageData.height);
            layer.visible = layerData.visible;
            layer.opacity = layerData.opacity ?? 100;
            layer.blendMode = layerData.blendMode ?? 'normal';
            layer.imageData.data.set(layerData.imageData.data);
            
            layer.modelMatrix = mat4.create();
            if (layerData.modelMatrix && Array.isArray(layerData.modelMatrix) && layerData.modelMatrix.length === 16) {
                layer.modelMatrix = new Float32Array(layerData.modelMatrix);
            } else {
                console.warn("⚠ restoreState: invalid saved modelMatrix, using identity");
            }
            
            layer.gpuDirty = true;
            return layer;
        });
        
        this.app.layerManager.switchLayer(state.activeLayerIndex);
        this.renderAllLayers();
    }

    undo() { 
        if (this.historyIndex > 0) { 
            this.historyIndex--; 
            this.restoreState(this.history[this.historyIndex]); 
        } 
    }
    
    redo() { 
        if (this.historyIndex < this.history.length - 1) { 
            this.historyIndex++; 
            this.restoreState(this.history[this.historyIndex]); 
        } 
    }
    
    updateCursor(coords) {
        if (this.isPanning || this.isSpaceDown) {
            this.canvasArea.style.cursor = 'grab';
            return;
        }
        if (this.isLayerMoving || this.isVDown) {
            this.canvasArea.style.cursor = 'move';
            return;
        }

        const activeLayer = this.app.layerManager.getCurrentLayer();
        if (this._isPointOnLayer(coords, activeLayer)) {
            switch(this.app.toolManager.currentTool) {
                case 'pen':
                    this.canvasArea.style.cursor = 'crosshair';
                    break;
                case 'eraser':
                    this.canvasArea.style.cursor = 'cell';
                    break;
                case 'bucket':
                    this.canvasArea.style.cursor = 'copy';
                    break;
                default:
                    this.canvasArea.style.cursor = 'crosshair';
            }
        } else {
            this.canvasArea.style.cursor = 'not-allowed';
        }
    }
    
    applyViewTransform() { 
        const t = this.viewTransform; 
        this.canvasContainer.style.transform = `translate(${t.left}px, ${t.top}px) scale(${t.scale * t.flipX}, ${t.scale * t.flipY}) rotate(${t.rotation}deg)`; 
    }
    
    flipHorizontal() { 
        this.viewTransform.flipX *= -1; 
        this.applyViewTransform(); 
    }
    
    flipVertical() { 
        this.viewTransform.flipY *= -1; 
        this.applyViewTransform(); 
    }
    
    zoom(factor) { 
        this.viewTransform.scale = Math.max(0.1, this.viewTransform.scale * factor); 
        this.applyViewTransform(); 
    }
    
    rotate(degrees) { 
        this.viewTransform.rotation = (this.viewTransform.rotation + degrees) % 360; 
        this.applyViewTransform(); 
    }
    
    resetView() { 
        this.viewTransform = { scale: 1, rotation: 0, flipX: 1, flipY: 1, left: 0, top: 0 }; 
        this.applyViewTransform(); 
    }
    
    handleWheel(e) { 
        e.preventDefault(); 
        if (e.shiftKey) { 
            this.rotate(-e.deltaY * 0.2); 
        } else { 
            this.zoom(e.deltaY > 0 ? 1 / 1.05 : 1.05); 
        } 
    }
}

class ToshinkaTegakiTool {
    constructor() {
        this.layerManager = new LayerManager(this);
        this.canvasManager = new CanvasManager(this);
        this.penSettingsManager = new PenSettingsManager(this);
        this.colorManager = new ColorManager(this);
        this.toolManager = new ToolManager(this);
        this.topBarManager = new TopBarManager(this);
        this.shortcutManager = new ShortcutManager(this);
        this.layerUIManager = new LayerUIManager(this);
        this.bucketTool = new BucketTool(this);

        this.shortcutManager.initialize();
        this.layerManager.setupInitialLayers();
        this.toolManager.setTool('pen');
    }
}

window.addEventListener('DOMContentLoaded', () => {
    if (!window.toshinkaTegakiInitialized) {
        window.toshinkaTegakiInitialized = true;
        window.toshinkaTegakiTool = new ToshinkaTegakiTool();
    }
});