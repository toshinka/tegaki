/*
 * ===================================================================================
 * Toshinka Tegaki Tool - Core Engine
 * Version: 2.9.8 (Phase 4A11B-7 - Cell-Buffer Move)
 *
 * - 変更点 (Phase 4A11B-7):
 * - 「📜 Phase 4A11B-7」指示書に基づき、Vキーでのレイヤー移動ロジックを改修。
 * - 目的: レイヤー移動時に他のレイヤーが動いて見える問題を根本的に解決する。
 * - 方式: セルバッファ（一時的なデータ保持領域）を利用した転写方式を導入。
 *
 * - 1. onPointerDown (Vキー押下時):
 * - アクティブレイヤーの画像データ(imageData)を`cellBuffer`にコピーして退避。
 * - アクティブレイヤーを一旦クリアし、移動元の絵を消す。
 * - これにより「レイヤーを持ち上げた」状態を表現する。
 *
 * - 2. onPointerMove (移動中):
 * - マウスの動きに合わせてレイヤーの変換行列(modelMatrix)を更新。
 * - `cellBuffer`に退避しておいた元の画像データを、都度アクティブレイヤーに書き戻す。
 * - レンダリングエンジンは、この書き戻された画像データと更新された変換行列を使って描画するため、
 * あたかも持ち上げたレイヤーだけが滑らかに移動しているように見える。
 *
 * - 3. onPointerUp (移動完了時):
 * - 移動後の最終的な変換行列を、レイヤーの画像データ自体に焼き付ける（転写）。
 * - この処理には`renderingBridge.getTransformedImageData`を利用し、WebGLに計算させる。
 * - 変換を焼き付けたので、レイヤーの変換行列は初期状態（単位行列）に戻す。
 * - これにより「レイヤーを置き直した」状態が確定する。
 * - `cellBuffer`を破棄して、一連の処理を完了する。
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
        
        // ★★★★★ 新規追加 (Phase 4A11B-7) ★★★★★
        // レイヤー移動時に使う一時的なデータ置き場（セルバッファ）
        this.cellBuffer = null;
        
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

        // ★★★★★ 修正 (Phase 4A11B-7) ★★★★★
        // レイヤー移動開始処理
        if (this.isVDown) {
            this.isLayerMoving = true;
            this.transformStartWorldX = coords.x;
            this.transformStartWorldY = coords.y;
            this.originalModelMatrix = mat4.clone(activeLayer.modelMatrix);

            // 1. アクティブレイヤーの現在の内容をセルバッファにコピーして退避
            this.cellBuffer = {
                imageData: new ImageData(
                    new Uint8ClampedArray(activeLayer.imageData.data),
                    activeLayer.imageData.width,
                    activeLayer.imageData.height
                )
            };
            console.log("🎨 セルバッファに現在のレイヤーの imageData をコピーしました。");

            // 2. アクティブレイヤーをクリアして「持ち上げた」状態にする
            activeLayer.clear();
            
            // 3. クリアした状態を画面に反映させる
            this.renderAllLayers();
            return;
        }
        
        if (!activeLayer.visible) return;

        const SUPER_SAMPLING_FACTOR = this.renderingBridge.currentEngine?.SUPER_SAMPLING_FACTOR || 1.0;
        const superX = coords.x * SUPER_SAMPLING_FACTOR;
        const superY = coords.y * SUPER_SAMPLING_FACTOR;
        const local = transformWorldToLocal(superX, superY, activeLayer.modelMatrix);
        
        console.log("📍 描画座標変換:", { world: coords, super: {x: superX, y: superY}, local: local });

        this._resetDirtyRect();
        
        if (this.app.toolManager.currentTool === 'bucket') {
            this.app.bucketTool.fill(activeLayer.imageData, Math.round(local.x), Math.round(local.y), hexToRgba(this.app.colorManager.currentColor));
            activeLayer.gpuDirty = true;
            this.renderAllLayers();
            this.saveState();
            return;
        }

        this.isDrawing = true;
        this.pressureHistory = [e.pressure > 0 ? e.pressure : 0.5];
        this.lastPoint = { ...local, pressure: this.pressureHistory[0] };
        
        const size = this.calculatePressureSize(this.app.penSettingsManager.currentSize, this.lastPoint.pressure);
        
        this._updateDirtyRect(local.x, local.y, size);
        
        this.renderingBridge.drawCircle(
            local.x, local.y, size / 2, 
            hexToRgba(this.app.colorManager.currentColor), this.app.toolManager.currentTool === 'eraser',
            activeLayer
        );
        
        this._requestRender();
        document.documentElement.setPointerCapture(e.pointerId);
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

        // ★★★★★ 修正 (Phase 4A11B-7) ★★★★★
        // レイヤー移動中の処理
        if (this.isLayerMoving) {
            if (!activeLayer || !this.cellBuffer) return; // セルバッファがなければ処理しない
            
            // 1. マウスの移動量から新しい変換行列を計算
            const dx = coords.x - this.transformStartWorldX;
            const dy = coords.y - this.transformStartWorldY;
            
            const SUPER_SAMPLING_FACTOR = this.renderingBridge.currentEngine?.SUPER_SAMPLING_FACTOR || 1.0;
            const adjustedDx = dx * SUPER_SAMPLING_FACTOR;
            const adjustedDy = dy * SUPER_SAMPLING_FACTOR;

            const translationMatrix = mat4.create();
            mat4.fromTranslation(translationMatrix, [adjustedDx, adjustedDy, 0]);

            const newMatrix = mat4.create();
            mat4.multiply(newMatrix, translationMatrix, this.originalModelMatrix);

            // 2. レイヤーの変換行列を更新
            activeLayer.modelMatrix = newMatrix;

            // 3. セルバッファから画像データを書き戻し、移動中の絵を表示させる
            //    ※activeLayer.imageDataはonPointerDownでクリアされているため、この処理が必要
            console.log(`🎯 セルバッファ描画開始: {x: ${Math.round(coords.x)}, y: ${Math.round(coords.y)}}`);
            activeLayer.imageData.data.set(this.cellBuffer.imageData.data);
            activeLayer.gpuDirty = true;
            
            // 4. 更新された状態で再描画
            this.renderAllLayers();
            return;
        }

        if (this.isDrawing) {
            if (!activeLayer) return;
            const SUPER_SAMPLING_FACTOR = this.renderingBridge.currentEngine?.SUPER_SAMPLING_FACTOR || 1.0;
            const superX = coords.x * SUPER_SAMPLING_FACTOR;
            const superY = coords.y * SUPER_SAMPLING_FACTOR;
            const local = transformWorldToLocal(superX, superY, activeLayer.modelMatrix);
            
            const currentPressure = e.pressure > 0 ? e.pressure : 0.5;
            this.pressureHistory.push(currentPressure);
            if (this.pressureHistory.length > this.maxPressureHistory) {
                this.pressureHistory.shift();
            }
            
            const lastSize = this.calculatePressureSize(this.app.penSettingsManager.currentSize, this.lastPoint.pressure);
            const currentSize = this.calculatePressureSize(this.app.penSettingsManager.currentSize, currentPressure);
            this._updateDirtyRect(this.lastPoint.x, this.lastPoint.y, lastSize);
            this._updateDirtyRect(local.x, local.y, currentSize);

            this.renderingBridge.drawLine(
                this.lastPoint.x, this.lastPoint.y, local.x, local.y,
                this.app.penSettingsManager.currentSize, hexToRgba(this.app.colorManager.currentColor), this.app.toolManager.currentTool === 'eraser',
                this.lastPoint.pressure, currentPressure, 
                this.calculatePressureSize.bind(this),
                activeLayer
            );
            
            this.lastPoint = { ...local, pressure: currentPressure };
            this._requestRender();
            return;
        }

        this.updateCursor(coords);
    }
    
    onPointerUp(e) {
        if (this.isDrawing) {
            this.isDrawing = false;
            
            if (this.animationFrameId) {
                cancelAnimationFrame(this.animationFrameId);
                this.animationFrameId = null;
            }
            
            this._renderDirty();

            const activeLayer = this.app.layerManager.getCurrentLayer();
            if (activeLayer) {
                this.renderingBridge.syncDirtyRectToImageData(activeLayer, this.dirtyRect);
            }
            
            this.lastPoint = null;
            this.saveState();
        }
        
        // ★★★★★ 修正 (Phase 4A11B-7) ★★★★★
        // レイヤー移動完了時の転写処理
        if (this.isLayerMoving) {
            this.isLayerMoving = false;
            
            const activeLayer = this.app.layerManager.getCurrentLayer();

            // Vキーを押しっぱなしで範囲外にマウスが出た場合など、バッファがないケースを考慮
            if (!this.cellBuffer || !activeLayer) {
                this.cellBuffer = null; // 念のため破棄
                return;
            }

            console.log("📋 セルバッファ → レイヤー転写開始");

            // 1. `getTransformedImageData`を使い、移動後の見た目通りの画像データをWebGLに生成させる
            //    - activeLayerには移動後の`modelMatrix`と、`cellBuffer`からコピーした画像データが入っている
            const transformedImageData = this.renderingBridge.getTransformedImageData(activeLayer);
            
            if (transformedImageData) {
                // 2. 生成された画像データでレイヤーの内容を確定する
                activeLayer.imageData.data.set(transformedImageData.data);
            } else {
                console.error("❌ レイヤー転写に失敗しました。getTransformedImageDataがnullを返しました。");
                // 失敗した場合は、せめて元の画像データを復元する
                activeLayer.imageData.data.set(this.cellBuffer.imageData.data);
            }
            
            // 3. 変換は画像データに焼き付けられたので、レイヤーの行列は初期状態に戻す
            mat4.identity(activeLayer.modelMatrix);
            activeLayer.gpuDirty = true;
            
            // 4. セルバッファを破棄
            this.cellBuffer = null;
            console.log("🧹 セルバッファ破棄完了");
            console.log("✅ セルバッファ → レイヤー転写完了");
            
            // 5. 最終状態を画面に描画し、履歴に保存
            this.renderAllLayers();
            this.saveState();
        }

        this.isPanning = false;
        if (document.documentElement.hasPointerCapture(e.pointerId)) {
            document.documentElement.releasePointerCapture(e.pointerId);
        }
    }

    _renderDirty() {
        const rect = this.dirtyRect;
        if (rect.minX > rect.maxX) return;
        this.renderingBridge.compositeLayers(this.app.layerManager.layers, null, rect);
        this.renderingBridge.renderToDisplay(null, rect);
    }

    renderAllLayers() {
        const SUPER_SAMPLING_FACTOR = this.renderingBridge.currentEngine?.SUPER_SAMPLING_FACTOR || 1.0;
        this.dirtyRect = { 
            minX: 0, 
            minY: 0, 
            maxX: this.width * SUPER_SAMPLING_FACTOR, 
            maxY: this.height * SUPER_SAMPLING_FACTOR 
        };
        this._requestRender();
    }

    _requestRender() {
        if (!this.animationFrameId) {
            this.animationFrameId = requestAnimationFrame(() => {
                this._renderDirty();
                this.animationFrameId = null;
            });
        }
    }

    _updateDirtyRect(x, y, radius) {
        const margin = Math.ceil(radius) + 2;
        this.dirtyRect.minX = Math.min(this.dirtyRect.minX, x - margin);
        this.dirtyRect.minY = Math.min(this.dirtyRect.minY, y - margin);
        this.dirtyRect.maxX = Math.max(this.dirtyRect.maxX, x + margin);
        this.dirtyRect.maxY = Math.max(this.dirtyRect.maxY, y + margin);
    }
    
    _resetDirtyRect() {
        this.dirtyRect = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity };
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
        if (this.isSpaceDown) {
            this.canvasArea.style.cursor = 'grab';
            return;
        }
        if (this.isVDown) {
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