/*
 * ===================================================================================
 * Toshinka Tegaki Tool - Core Engine
 * Version: 3.0.2 (Phase 4A11B-7 - Cell Buffer Drawing - Completed by Gemini)
 *
 * 🎯 このファイルでは「レイヤーに直接描画する構造」から、
 * 一時セル（tempCanvas）に描画し、転写する構造へ変更を行います。
 *
 * 💡重要な変更点：
 * - 描画は modelMatrix の影響を受けないセルで行います。
 * - 描画終了後に modelMatrix で位置を決めて貼り付けます。
 *
 * - 修正 (Phase 4A11B-Fix7 - Gemini's Completion):
 * - Claudeの書きかけのコードを元に、途中で途切れた部分を補完。
 * - 未実装だった転写処理（_transferCellToLayer）にmodelMatrixの逆行列を適用するロジックを追加。
 * これにより、移動・回転・拡縮したレイヤーに対しても正しい位置に描画が転写されるように修正。
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

        this.dirtyRect = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity };
        this.animationFrameId = null;

        this.dragStartX = 0; 
        this.dragStartY = 0; 
        this.canvasStartX = 0; 
        this.canvasStartY = 0;
        this.viewTransform = { scale: 1, rotation: 0, flipX: 1, flipY: 1, left: 0, top: 0 };
        
        // ★★★★★ 新規追加：セルバッファ描画用 ★★★★★
        this.tempCanvas = null;
        this.tempCtx = null;
        this.cellStartWorldX = 0;
        this.cellStartWorldY = 0;
        
        this.bindEvents();
    }

    /**
     * ★★★★★ 新規追加：セルバッファ初期化 ★★★★★
     * 描画開始時に一時的なcanvasを作成する
     */
    _initTempCanvas() {
        if (this.tempCanvas) {
            this.tempCanvas.remove();
        }
        
        const SUPER_SAMPLING_FACTOR = this.renderingBridge.currentEngine?.SUPER_SAMPLING_FACTOR || 1.0;
        this.tempCanvas = document.createElement('canvas');
        this.tempCanvas.width = this.width * SUPER_SAMPLING_FACTOR;
        this.tempCanvas.height = this.height * SUPER_SAMPLING_FACTOR;
        this.tempCtx = this.tempCanvas.getContext('2d');

        // 描画中のプレビューのためにDOMに追加（不可視だが合成に使う）
        // ※今回は描画中のプレビューは実装しないため、DOM追加は不要
        
        console.log("🎨 セルバッファ初期化:", { 
            width: this.tempCanvas.width, 
            height: this.tempCanvas.height,
            superSampling: SUPER_SAMPLING_FACTOR
        });
    }

    /**
     * ★★★★★ 新規追加：セルバッファ破棄 ★★★★★
     * 描画終了時に一時的なcanvasを破棄する
     */
    _cleanupTempCanvas() {
        if (this.tempCanvas) {
            this.tempCanvas.remove();
            this.tempCanvas = null;
            this.tempCtx = null;
        }
        console.log("🧹 セルバッファ破棄完了");
    }

    /**
     * ★★★★★ 改修：セルバッファ → レイヤー転写 ★★★★★
     * 描画終了時に一時canvasの内容をレイヤーに転写する
     */
    _transferCellToLayer(targetLayer) {
        if (!this.tempCanvas || !targetLayer) {
            console.warn("⚠ 転写失敗: tempCanvas または targetLayer が無効");
            return;
        }

        console.log("📋 セルバッファ → レイヤー転写開始");
        
        // レイヤーのImageDataを一時canvasに変換
        const layerCanvas = document.createElement('canvas');
        layerCanvas.width = targetLayer.imageData.width;
        layerCanvas.height = targetLayer.imageData.height;
        const layerCtx = layerCanvas.getContext('2d');
        layerCtx.putImageData(targetLayer.imageData, 0, 0);

        // ★★★★★ Geminiによる修正 ★★★★★
        // ワールド座標で描画されたtempCanvasを、レイヤーのローカル座標に変換して描画するため
        // レイヤーのmodelMatrixの逆行列を算出して、転写時に適用する
        const invMatrix = mat4.create();
        mat4.invert(invMatrix, targetLayer.modelMatrix);

        // 転写先のコンテキストに変換を適用
        const m = invMatrix;
        layerCtx.setTransform(m[0], m[1], m[4], m[5], m[12], m[13]);
        
        // セルバッファの内容をレイヤーに転写
        layerCtx.drawImage(this.tempCanvas, 0, 0);

        // 変換をリセット
        layerCtx.setTransform(1, 0, 0, 1, 0, 0);

        // 転写完了したデータをレイヤーに戻す
        const newImageData = layerCtx.getImageData(0, 0, layerCanvas.width, layerCanvas.height);
        targetLayer.imageData.data.set(newImageData.data);
        targetLayer.gpuDirty = true;
        
        console.log("✅ セルバッファ → レイヤー転写完了");

        // 一時canvasを破棄
        layerCanvas.remove();
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

        console.log("🎯 セルバッファ描画開始:", { world: coords });
        
        this._initTempCanvas();

        this.cellStartWorldX = coords.x;
        this.cellStartWorldY = coords.y;

        if (this.app.toolManager.currentTool === 'bucket') {
            const SUPER_SAMPLING_FACTOR = this.renderingBridge.currentEngine?.SUPER_SAMPLING_FACTOR || 1.0;
            const superX = coords.x * SUPER_SAMPLING_FACTOR;
            const superY = coords.y * SUPER_SAMPLING_FACTOR;
            const local = transformWorldToLocal(superX, superY, activeLayer.modelMatrix);

            this.app.bucketTool.fill(activeLayer.imageData, Math.round(local.x), Math.round(local.y), hexToRgba(this.app.colorManager.currentColor));
            activeLayer.gpuDirty = true;
            this.renderAllLayers();
            this.saveState();
            return;
        }

        this.isDrawing = true;
        this.pressureHistory = [e.pressure > 0 ? e.pressure : 0.5];
        this.lastPoint = { x: coords.x, y: coords.y, pressure: this.pressureHistory[0] };
        
        const size = this.calculatePressureSize(this.app.penSettingsManager.currentSize, this.lastPoint.pressure);
        
        this._drawCircleToCell(coords.x, coords.y, size / 2, hexToRgba(this.app.colorManager.currentColor), this.app.toolManager.currentTool === 'eraser');
        
        // 描画中のプレビューは次フェーズ以降のため、ここではrequestRenderしない
        document.documentElement.setPointerCapture(e.pointerId);
    }

    _drawCircleToCell(x, y, radius, color, isEraser) {
        if (!this.tempCtx) return;

        const SUPER_SAMPLING_FACTOR = this.renderingBridge.currentEngine?.SUPER_SAMPLING_FACTOR || 1.0;
        const superX = x * SUPER_SAMPLING_FACTOR;
        const superY = y * SUPER_SAMPLING_FACTOR;
        const superRadius = radius; // calculatePressureSizeが既にSS考慮済み

        this.tempCtx.save();
        
        if (isEraser) {
            this.tempCtx.globalCompositeOperation = 'destination-out';
        } else {
            this.tempCtx.globalCompositeOperation = 'source-over';
            this.tempCtx.fillStyle = `rgba(${color.r}, ${color.g}, ${color.b}, ${color.a / 255})`;
        }
        
        this.tempCtx.beginPath();
        this.tempCtx.arc(superX, superY, superRadius, 0, Math.PI * 2);
        this.tempCtx.fill();
        
        this.tempCtx.restore();
    }

    _drawLineToCell(x1, y1, x2, y2, size, color, isEraser, pressure1, pressure2) {
        if (!this.tempCtx) return;
        
        const SUPER_SAMPLING_FACTOR = this.renderingBridge.currentEngine?.SUPER_SAMPLING_FACTOR || 1.0;
        const superX1 = x1 * SUPER_SAMPLING_FACTOR;
        const superY1 = y1 * SUPER_SAMPLING_FACTOR;
        const superX2 = x2 * SUPER_SAMPLING_FACTOR;
        const superY2 = y2 * SUPER_SAMPLING_FACTOR;

        this.tempCtx.save();

        if (isEraser) {
            this.tempCtx.globalCompositeOperation = 'destination-out';
        } else {
            this.tempCtx.globalCompositeOperation = 'source-over';
            this.tempCtx.strokeStyle = `rgba(${color.r}, ${color.g}, ${color.b}, ${color.a / 255})`;
        }
        
        const size1 = this.calculatePressureSize(size, pressure1);
        const size2 = this.calculatePressureSize(size, pressure2);
        const averageSize = (size1 + size2) / 2;
        
        this.tempCtx.lineWidth = averageSize;
        this.tempCtx.lineCap = 'round';
        this.tempCtx.lineJoin = 'round';
        
        this.tempCtx.beginPath();
        this.tempCtx.moveTo(superX1, superY1);
        this.tempCtx.lineTo(superX2, superY2);
        this.tempCtx.stroke();
        
        this.tempCtx.restore();
    }
    
    onPointerMove(e) {
        const coords = getCanvasCoordinates(e, this.displayCanvas, this.viewTransform);
        const activeLayer = this.app.layerManager.getCurrentLayer();

        if (this.isPanning) {
            const dx = e.clientX - this.dragStartX;
            const dy = e.clientY - this.dragStartY;
            this.viewTransform.left = this.canvasStartX + dx; 
            this.viewTransform.top = this.canvasStartY + dy;
            this.applyViewTransform(); 
            return;
        }

        if (this.isLayerMoving) {
            if (!activeLayer) return;
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
            if (!activeLayer || !this.lastPoint) return;
            
            const currentPressure = e.pressure > 0 ? e.pressure : 0.5;
            this.pressureHistory.push(currentPressure);
            if (this.pressureHistory.length > this.maxPressureHistory) {
                this.pressureHistory.shift();
            }
            
            this._drawLineToCell(
                this.lastPoint.x, this.lastPoint.y, coords.x, coords.y,
                this.app.penSettingsManager.currentSize, hexToRgba(this.app.colorManager.currentColor), this.app.toolManager.currentTool === 'eraser',
                this.lastPoint.pressure, currentPressure
            );

            this.lastPoint = { x: coords.x, y: coords.y, pressure: currentPressure };
            return;
        }

        this.updateCursor(coords);
    }
    
    onPointerUp(e) {
        if (this.isDrawing) {
            this.isDrawing = false;
            
            const activeLayer = this.app.layerManager.getCurrentLayer();
            if (activeLayer) {
                this._transferCellToLayer(activeLayer);
            }

            this._cleanupTempCanvas();
            this.renderAllLayers(); // 転写結果を反映
            
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