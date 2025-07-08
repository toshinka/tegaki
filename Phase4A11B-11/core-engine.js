/*
 * ===================================================================================
 * Toshinka Tegaki Tool - Core Engine
 * Version: 3.2.0 (Phase 4A11B-11 - IndexedDB Integration)
 *
 * - 変更点 (Phase 4A11B-11):
 * - 「📜 Phase4A11B-11」指示書に基づき、IndexedDBへのレイヤーデータ保存・復元機能を追加。
 *
 * - 1. IndexedDB連携:
 * - `core/db/db-indexed.js` をインポートし、Dexie.js経由でDB操作を行うようにした。
 * - 描画完了時(`onPointerUp`)や変形確定時(`commitLayerTransform`)に、
 * アクティブレイヤーの画像データをIndexedDBに自動保存する処理を追加。
 *
 * - 2. 起動時のデータ復元:
 * - アプリケーション起動時にIndexedDBから前回保存したレイヤーデータを読み込み、
 * キャンバスの状態を復元する処理を実装。
 * - データがない場合は、通常の初期レイヤーを作成する。
 *
 * - 3. 初期化処理の改善:
 * - `DOMContentLoaded`イベント内で、指示書に従い`RenderingBridge.init()`を呼び出し、
 * その後、非同期でアプリケーションの初期化(`initialize`メソッド)を行うようにフローを修正。
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
import { isValidMatrix, transformWorldToLocal } from './core/utils/transform-utils.js';
// ★★★★★ 追加 (Phase 4A11B-11) ★★★★★
// IndexedDBを操作するための関数をインポート
import { saveLayerToIndexedDB, loadLayersFromIndexedDB, clearAllLayersFromIndexedDB } from './core/db/db-indexed.js';


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
        this.isDraggingLayer = false;

        this.isLayerTransforming = false;
        this.cellBufferInitialized = false;
        
        this.isSpaceDown = false;
        this.isVDown = false;
        
        this.cellBuffer = null;
        
        this.lastPoint = null;
        
        this.transformStartWorldX = 0;
        this.transformStartWorldY = 0;
        
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
    }

    _isPointOnLayer(worldCoords, layer) {
        if (!layer || !layer.visible) return false;

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
        
        const coords = getCanvasCoordinates(e, this.displayCanvas, this.viewTransform);
        const activeLayer = this.app.layerManager.getCurrentLayer();
        if (!activeLayer) return;

        if (this.isSpaceDown) {
            this.isPanning = true;
            this.dragStartX = e.clientX; 
            this.dragStartY = e.clientY; 
            this.canvasStartX = this.viewTransform.left; 
            this.canvasStartY = this.viewTransform.top;
            return;
        }

        if (this.isLayerTransforming) {
            if (!activeLayer.visible) return;

            this.isDraggingLayer = true;
            this.transformStartWorldX = coords.x;
            this.transformStartWorldY = coords.y;
            
            console.log("🖱️ レイヤーのドラッグ移動を開始します。");
            return;
        }
        
        if (!activeLayer.visible || !this._isPointOnLayer(coords, activeLayer)) {
            return;
        }

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
            // ★★★★★ 追加 (Phase 4A11B-11) ★★★★★
            this.saveActiveLayerToDB(); // 塗りつぶし後、DBに保存
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

        if (this.isPanning) {
            const dx = e.clientX - this.dragStartX; 
            const dy = e.clientY - this.dragStartY;
            this.viewTransform.left = this.canvasStartX + dx; 
            this.viewTransform.top = this.canvasStartY + dy;
            this.applyViewTransform(); 
            return;
        }

        if (this.isDraggingLayer) {
            const activeLayer = this.app.layerManager.getCurrentLayer();
            if (!activeLayer || !this.cellBufferInitialized) return;
            
            const dx = coords.x - this.transformStartWorldX;
            const dy = coords.y - this.transformStartWorldY;
            
            const SUPER_SAMPLING_FACTOR = this.renderingBridge.currentEngine?.SUPER_SAMPLING_FACTOR || 1.0;
            const adjustedDx = dx * SUPER_SAMPLING_FACTOR;
            const adjustedDy = dy * SUPER_SAMPLING_FACTOR;

            const translationMatrix = mat4.create();
            mat4.fromTranslation(translationMatrix, [adjustedDx, adjustedDy, 0]);

            const newMatrix = mat4.create();
            mat4.multiply(newMatrix, translationMatrix, this.cellBuffer.originalModelMatrix);
            activeLayer.modelMatrix = newMatrix;

            activeLayer.imageData.data.set(this.cellBuffer.imageData.data);
            activeLayer.gpuDirty = true;
            
            this.renderAllLayers();
            return;
        }

        if (this.isDrawing) {
            const activeLayer = this.app.layerManager.getCurrentLayer();
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
            // ★★★★★ 追加 (Phase 4A11B-11) ★★★★★
            this.saveActiveLayerToDB(); // 描画完了後、DBに保存
        }
        
        if (this.isDraggingLayer) {
            this.isDraggingLayer = false;
            console.log("🖱️ レイヤーのドラッグ移動が完了しました。Vキーを離すと位置が確定されます。");
        }

        this.isPanning = false;
        if (document.documentElement.hasPointerCapture(e.pointerId)) {
            document.documentElement.releasePointerCapture(e.pointerId);
        }
    }

    startLayerTransform() {
        if (this.isLayerTransforming) return;

        const activeLayer = this.app.layerManager.getCurrentLayer();
        if (!activeLayer || !activeLayer.visible) {
            console.warn("⚠️ 変形対象の表示レイヤーがありません。");
            return;
        }

        this.isLayerTransforming = true;
        
        this.cellBuffer = {
            imageData: new ImageData(
                new Uint8ClampedArray(activeLayer.imageData.data),
                activeLayer.imageData.width,
                activeLayer.imageData.height
            ),
            originalModelMatrix: mat4.clone(activeLayer.modelMatrix)
        };
        this.cellBufferInitialized = true;
        console.log("🎨 変形モード開始: セルバッファに現在のレイヤー情報をコピーしました。");

        activeLayer.clear();
        this.renderAllLayers();
        
        activeLayer.imageData.data.set(this.cellBuffer.imageData.data);
        activeLayer.gpuDirty = true;
        this.renderAllLayers();
    }

    commitLayerTransform() {
        if (!this.isLayerTransforming) return;
        this.isLayerTransforming = false;
        
        const activeLayer = this.app.layerManager.getCurrentLayer();
        if (!this.cellBufferInitialized || !activeLayer) {
            console.warn("❌ 変形確定処理が中断されました: 対象レイヤーまたはセルバッファがありません。");
            this.cellBuffer = null;
            this.cellBufferInitialized = false;
            this.updateCursor();
            return;
        }
        
        const transformedImageData = this.renderingBridge.getTransformedImageData(activeLayer);
        
        if (!transformedImageData) {
            console.warn("❌ レイヤー転写に失敗: getTransformedImageDataがnullを返しました。変形前の状態に復元します。");
            this.restoreLayerBackup();
            this.cellBuffer = null;
            this.cellBufferInitialized = false;
            this.updateCursor();
            return;
        }
        
        console.log("📋 転写開始:", { w: transformedImageData.width, h: transformedImageData.height });

        activeLayer.imageData.data.set(transformedImageData.data);
        console.info("✅ 転写成功");

        mat4.identity(activeLayer.modelMatrix);
        activeLayer.gpuDirty = true;
        
        this.cellBuffer = null;
        this.cellBufferInitialized = false;
        console.log("🧹 セルバッファを破棄し、変形モードを終了しました。");
        
        this.renderAllLayers();
        this.saveState();
        // ★★★★★ 追加 (Phase 4A11B-11) ★★★★★
        this.saveActiveLayerToDB(); // 変形確定後、DBに保存
    }

    cancelLayerTransform() {
        if (!this.isLayerTransforming) return;
        this.isLayerTransforming = false;
        
        const activeLayer = this.app.layerManager.getCurrentLayer();
        if (!this.cellBufferInitialized || !activeLayer) {
            this.cellBuffer = null;
            this.cellBufferInitialized = false;
            return;
        }

        console.log("↩️ 変形をキャンセルし、元の状態に戻します。");
        activeLayer.imageData.data.set(this.cellBuffer.imageData.data);
        activeLayer.modelMatrix = mat4.clone(this.cellBuffer.originalModelMatrix);
        activeLayer.gpuDirty = true;
        
        this.cellBuffer = null;
        this.cellBufferInitialized = false;

        this.renderAllLayers();
    }

    restoreLayerBackup() {
        const activeLayer = this.app.layerManager.getCurrentLayer();
        if (!this.cellBufferInitialized || !activeLayer) {
            console.warn("↩️ 復元するバックアップデータがありません。");
            return;
        }

        console.warn("↩️ 変形をキャンセルし、バックアップからレイヤーを復元します。");
        activeLayer.imageData.data.set(this.cellBuffer.imageData.data);
        activeLayer.modelMatrix = mat4.clone(this.cellBuffer.originalModelMatrix);
        activeLayer.gpuDirty = true;

        this.renderAllLayers();
    }
    
    applyLayerTransform({ translation = [0, 0, 0], scale = 1.0, rotation = 0, flip = null }) {
        if (!this.isLayerTransforming || !this.cellBufferInitialized) return;

        const activeLayer = this.app.layerManager.getCurrentLayer();
        if (!activeLayer) return;

        const SUPER_SAMPLING_FACTOR = this.renderingBridge.currentEngine?.SUPER_SAMPLING_FACTOR || 1.0;
        const adjustedTranslation = [
            translation[0] * SUPER_SAMPLING_FACTOR,
            translation[1] * SUPER_SAMPLING_FACTOR,
            translation[2] * SUPER_SAMPLING_FACTOR
        ];

        const transformMatrix = mat4.create();
        
        const centerX = (activeLayer.imageData.width * SUPER_SAMPLING_FACTOR) / 2;
        const centerY = (activeLayer.imageData.height * SUPER_SAMPLING_FACTOR) / 2;
        
        mat4.translate(transformMatrix, transformMatrix, [centerX, centerY, 0]);
        mat4.rotateZ(transformMatrix, transformMatrix, rotation * (Math.PI / 180));
        
        let scaleVec = [scale, scale, 1];
        if (flip === 'x') scaleVec[0] *= -1;
        if (flip === 'y') scaleVec[1] *= -1;
        mat4.scale(transformMatrix, transformMatrix, scaleVec);
        
        mat4.translate(transformMatrix, transformMatrix, [-centerX, -centerY, 0]);
        mat4.translate(transformMatrix, transformMatrix, adjustedTranslation);

        mat4.multiply(activeLayer.modelMatrix, transformMatrix, activeLayer.modelMatrix);

        activeLayer.imageData.data.set(this.cellBuffer.imageData.data);
        activeLayer.gpuDirty = true;
        this.renderAllLayers();
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
                    console.warn("⚠ saveState: 不正な modelMatrix を検出したため、リセットします。");
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

    // ★★★★★ 新設 (Phase 4A11B-11) ★★★★★
    /**
     * ImageDataオブジェクトをDataURL文字列に変換します。
     * @param {ImageData} imageData - 変換するImageDataオブジェクト。
     * @returns {string} DataURL形式の文字列。
     */
    _imageDataToDataURL(imageData) {
        const tempCanvas = document.createElement('canvas');
        const tempCtx = tempCanvas.getContext('2d');
        tempCanvas.width = imageData.width;
        tempCanvas.height = imageData.height;
        tempCtx.putImageData(imageData, 0, 0);
        return tempCanvas.toDataURL();
    }

    // ★★★★★ 新設 (Phase 4A11B-11) ★★★★★
    /**
     * 現在アクティブなレイヤーのデータをIndexedDBに保存します。
     */
    async saveActiveLayerToDB() {
        const activeLayer = this.app.layerManager.getCurrentLayer();
        const activeIndex = this.app.layerManager.activeLayerIndex;
        if (activeLayer) {
            try {
                const imageDataUrl = this._imageDataToDataURL(activeLayer.imageData);
                await saveLayerToIndexedDB(activeIndex, activeLayer.name, imageDataUrl);
                console.log(`💾 レイヤー "${activeLayer.name}" (ID: ${activeIndex}) をIndexedDBに保存しました。`);
            } catch (err) {
                console.error("IndexedDBへのレイヤー保存に失敗しました。", err);
            }
        }
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
                console.warn("⚠ restoreState: 保存された modelMatrix が不正なため、初期化します。");
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
        if (this.isLayerTransforming) {
            this.canvasArea.style.cursor = 'move';
            return;
        }
        if (this.isPanning) {
            this.canvasArea.style.cursor = 'grabbing';
            return;
        }
        if (this.isSpaceDown) {
            this.canvasArea.style.cursor = 'grab';
            return;
        }

        const activeLayer = this.app.layerManager.getCurrentLayer();
        if (activeLayer && coords && this._isPointOnLayer(coords, activeLayer)) {
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
        this.toolManager.setTool('pen');
        // ★★★★★ 変更 (Phase 4A11B-11) ★★★★★
        // 初期レイヤーの作成は、DB復元処理の後に行うため、ここでは呼び出さない。
        // this.layerManager.setupInitialLayers(); 
    }

    // ★★★★★ 新設 (Phase 4A11B-11) ★★★★★
    /**
     * アプリケーションの非同期初期化処理を行います。
     * IndexedDBからレイヤーを復元し、なければ新しいレイヤーを作成します。
     */
    async initialize() {
        console.log("🛠️ アプリケーションの初期化を開始します...");

        // DataURL形式の画像データをImageDataオブジェクトに変換するヘルパー関数
        const dataURLToImageData = (dataURL, width, height) => {
            return new Promise((resolve, reject) => {
                const img = new Image();
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    const ctx = canvas.getContext('2d');
                    canvas.width = width;
                    canvas.height = height;
                    ctx.drawImage(img, 0, 0);
                    resolve(ctx.getImageData(0, 0, width, height));
                };
                img.onerror = reject;
                img.src = dataURL;
            });
        };

        const savedLayers = await loadLayersFromIndexedDB();

        if (savedLayers && savedLayers.length > 0) {
            console.log("💾 IndexedDBからレイヤーデータを復元します。", savedLayers);
            const restoredLayers = [];
            for (const savedLayer of savedLayers) {
                const newLayer = new Layer(
                    savedLayer.name,
                    this.canvasManager.width,
                    this.canvasManager.height
                );
                try {
                    const imageData = await dataURLToImageData(
                        savedLayer.imageData,
                        newLayer.imageData.width,
                        newLayer.imageData.height
                    );
                    newLayer.imageData = imageData;
                    restoredLayers.push(newLayer);
                } catch (error) {
                     console.error(`レイヤー "${savedLayer.name}" のImageData復元に失敗しました。`, error);
                     restoredLayers.push(newLayer); // 失敗した場合は空のレイヤーとして追加
                }
            }
            this.layerManager.layers = restoredLayers;
            this.layerManager.switchLayer(0);
            this.layerUIManager.renderLayerList();
            this.canvasManager.saveState(); // 復元状態を初期履歴として保存

        } else {
            console.log("💾 保存されたデータがないため、初期レイヤーを作成します。");
            await clearAllLayersFromIndexedDB(); // 念のためDBをクリア
            this.layerManager.setupInitialLayers();
            // 初期レイヤーもDBに保存しておく
            this.canvasManager.saveActiveLayerToDB();
        }

        this.canvasManager.renderAllLayers();
        console.log("✅ アプリケーションの初期化が完了しました。");
    }
}

// ★★★★★ 修正 (Phase 4A11B-11) ★★★★★
// 起動時の処理をasync/awaitを使って非同期処理に対応
window.addEventListener('DOMContentLoaded', async () => {
    if (!window.toshinkaTegakiInitialized) {
        window.toshinkaTegakiInitialized = true;
        
        // 指示書に基づき、WebGL/Canvasの静的初期化処理を呼び出す
        // ※RenderingBridgeクラスにinit静的メソッドが実装されていることが前提
        if (typeof RenderingBridge.init === 'function') {
            RenderingBridge.init();
            console.log("🚀 RenderingBridge.init() を呼び出しました。");
        } else {
            console.warn("⚠️ RenderingBridge.init() が見つかりませんでした。このメソッドは指示書で必須とされています。");
        }
        
        // アプリケーション本体のインスタンスを作成
        window.toshinkaTegakiTool = new ToshinkaTegakiTool();
        // DBからの復元などを含む非同期の初期化処理を実行
        await window.toshinkaTegakiTool.initialize();
    }
});