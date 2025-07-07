/*
 * ===================================================================================
 * Toshinka Tegaki Tool - Core Engine
 * Version: 2.9.1 (Phase 4A11-Refactor)
 *
 * - 修正：
 * - 巨大化した core-engine.js の責務を分離するため、関連クラスを外部モジュールに分割。
 * - LayerManager -> layer-manager/layer-manager.js
 * - PenSettingsManager -> ui/pen-settings-manager.js
 * - ColorManager -> ui/color-manager.js
 * - ToolManager -> ui/tool-manager.js
 * - 上記モジュールをインポートして利用するように変更。
 * * Phase4A11A-1 改修:
 * - glMatrix定義追加
 * - modelMatrix の明示初期化
 * - isValidMatrix() 関数追加
 * - transformWorldToLocal() 関数追加
 * - Vキーによるレイヤー移動モード実装
 * - 座標変換の正常化
 * * Phase4A11A-1Γ 改修:
 * - modelMatrix の保存・復元処理を修正
 * - Float32Array(16) 形式の正確な保持
 * - レイヤー移動時の画像飛びバグを修正
 * * Phase4A11A-1Δ 改修:
 * - isValidMatrix() 関数のFloat32Array対応修正
 * - 正常な行列の誤判定を解消
 * ===================================================================================
 */

// --- glMatrix 定義 ---
const mat4 = window.glMatrix.mat4;
const vec4 = window.glMatrix.vec4;

// --- Module Imports ---
// 既存のインポート
import { TopBarManager, LayerUIManager } from './ui/ui-manager.js';
import { ShortcutManager } from './ui/shortcut-manager.js';
import { BucketTool } from './tools/toolset.js';
import { RenderingBridge } from './core/rendering/rendering-bridge.js';

// ✨分割したクラスを新しくインポートします
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

// 🔧 修正: Float32Array対応版のisValidMatrix
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

// ✏️ 修正: canvas.styleとcanvas.width/heightのズレを補正する
function getCanvasCoordinates(e, canvas) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return {
        x: (e.clientX - rect.left) * scaleX,
        y: (e.clientY - rect.top) * scaleY
    };
}

// --- Core Logic Classes ---

// ✨Layerクラスは他のファイルから参照されるので「export」を追加します
export class Layer {
    constructor(name, width, height) {
        this.name = name;
        this.visible = true;
        this.opacity = 100;
        this.blendMode = 'normal';
        this.imageData = new ImageData(width, height);
        // modelMatrix の明示初期化
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

        this.compositionData = new ImageData(this.width, this.height);
        this.isDrawing = false; 
        this.isPanning = false; 
        this.isSpaceDown = false;
        this.isLayerMoving = false;
        
        this.isVDown = false; 
        this.isShiftDown = false;
        
        this.currentTool = 'pen';
        this.currentColor = '#800000'; 
        this.currentSize = 1; 
        this.lastPoint = null;
        
        // レイヤー移動用の変数
        this.transformStartX = 0;
        this.transformStartY = 0;
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
        
        // Vキーによるレイヤー移動モード
        document.addEventListener("keydown", (e) => {
            if (e.key === "v" || e.key === "V") {
                this.isVDown = true;
                this.updateCursor();
            }
            if (e.key === " ") {
                this.isSpaceDown = true;
                this.updateCursor();
            }
        });
        
        document.addEventListener("keyup", (e) => {
            if (e.key === "v" || e.key === "V") {
                this.isVDown = false;
                this.updateCursor();
            }
            if (e.key === " ") {
                this.isSpaceDown = false;
                this.updateCursor();
            }
        });
    }

    onPointerDown(e) {
        if (e.button !== 0) return;
        
        const activeLayer = this.app.layerManager.getCurrentLayer();
        if (!activeLayer) return;
        
        // modelMatrix の有効性チェック
        if (!isValidMatrix(activeLayer.modelMatrix)) {
            console.warn("⚠ onPointerDown: invalid modelMatrix detected, resetting");
            activeLayer.modelMatrix = mat4.create();
        }
        
        if (this.isSpaceDown) {
            this.dragStartX = e.clientX; 
            this.dragStartY = e.clientY; 
            this.isPanning = true;
            this.canvasStartX = this.viewTransform.left; 
            this.canvasStartY = this.viewTransform.top;
            e.preventDefault(); 
            return;
        }
        
        // Vキーによるレイヤー移動モード
        if (this.isVDown) {
            this.isLayerMoving = true;
            const coords = getCanvasCoordinates(e, this.displayCanvas);
            this.transformStartX = coords.x;
            this.transformStartY = coords.y;
            this.originalModelMatrix = mat4.clone(activeLayer.modelMatrix);
            console.log("🔵 レイヤー移動開始:", coords);
            e.preventDefault();
            return;
        }
        
        const coords = getCanvasCoordinates(e, this.displayCanvas);
        if (!coords) return;
        
        // 座標変換: ワールド座標からローカル座標へ
        const local = transformWorldToLocal(coords.x, coords.y, activeLayer.modelMatrix);
        console.log("📍 描画座標変換:", { world: coords, local: local });
        
        if (!activeLayer.visible) return;

        this._resetDirtyRect();
        
        if (this.currentTool === 'bucket') {
            this.app.bucketTool.fill(activeLayer.imageData, local.x, local.y, hexToRgba(this.currentColor));
            activeLayer.gpuDirty = true;
            this.renderAllLayers();
            this.saveState();
            return;
        }

        this.isDrawing = true;
        this.pressureHistory = [e.pressure > 0 ? e.pressure : 0.5];
        this.lastPoint = { ...local, pressure: this.pressureHistory[0] };
        
        const size = this.calculatePressureSize(this.currentSize, this.lastPoint.pressure);
        
        this._updateDirtyRect(local.x, local.y, size);
        
        this.renderingBridge.drawCircle(
            local.x, local.y, size / 2, 
            hexToRgba(this.currentColor), this.currentTool === 'eraser',
            activeLayer
        );
        
        this._requestRender();
        document.documentElement.setPointerCapture(e.pointerId);
    }
    
    onPointerMove(e) {
        const activeLayer = this.app.layerManager.getCurrentLayer();
        if (!activeLayer) return;
        
        // modelMatrix の有効性チェック
        if (!isValidMatrix(activeLayer.modelMatrix)) {
            console.warn("⚠ onPointerMove: invalid modelMatrix detected, resetting");
            activeLayer.modelMatrix = mat4.create();
        }
        
        if (this.isPanning) {
            const dx = e.clientX - this.dragStartX; 
            const dy = e.clientY - this.dragStartY;
            this.viewTransform.left = this.canvasStartX + dx; 
            this.viewTransform.top = this.canvasStartY + dy;
            this.applyViewTransform(); 
            return;
        }
        
        // レイヤー移動処理
        if (this.isLayerMoving) {
            const coords = getCanvasCoordinates(e, this.displayCanvas);
            const dx = coords.x - this.transformStartX;
            const dy = coords.y - this.transformStartY;
            if (!isFinite(dx) || !isFinite(dy)) return;
            const newMatrix = mat4.clone(this.originalModelMatrix);
            mat4.translate(newMatrix, newMatrix, [dx, dy, 0]);
            activeLayer.modelMatrix = newMatrix;
            activeLayer.gpuDirty = true;
            console.log("🔄 レイヤー移動:", { dx, dy, matrix: Array.from(newMatrix) });
            this.renderAllLayers();
            return;
        }

        if (!this.isDrawing) return;

        const coords = getCanvasCoordinates(e, this.displayCanvas);
        if (!coords) {
            this.lastPoint = null;
            return;
        }

        // 座標変換: ワールド座標からローカル座標へ
        const local = transformWorldToLocal(coords.x, coords.y, activeLayer.modelMatrix);

        if (!activeLayer.visible) return;

        if (!this.lastPoint) {
            this.pressureHistory = [e.pressure > 0 ? e.pressure : 0.5];
            this.lastPoint = { ...local, pressure: e.pressure > 0 ? e.pressure : 0.5 };
            return;
        }

        const currentPressure = e.pressure > 0 ? e.pressure : 0.5;
        this.pressureHistory.push(currentPressure);
        if (this.pressureHistory.length > this.maxPressureHistory) {
            this.pressureHistory.shift();
        }

        const lastSize = this.calculatePressureSize(this.currentSize, this.lastPoint.pressure);
        const currentSize = this.calculatePressureSize(this.currentSize, currentPressure);

        this._updateDirtyRect(this.lastPoint.x, this.lastPoint.y, lastSize);
        this._updateDirtyRect(local.x, local.y, currentSize);

        this.renderingBridge.drawLine(
            this.lastPoint.x, this.lastPoint.y, local.x, local.y,
            this.currentSize, hexToRgba(this.currentColor), this.currentTool === 'eraser',
            this.lastPoint.pressure, currentPressure, this.calculatePressureSize.bind(this),
            activeLayer
        );
        this.lastPoint = { ...local, pressure: currentPressure };
        this._requestRender();
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
        // レイヤー移動終了
        if (this.isLayerMoving) {
            this.isLayerMoving = false;
            console.log("🔴 レイヤー移動終了");
            this.saveState();
        }
        this.isPanning = false;
        if (document.documentElement.hasPointerCapture(e.pointerId)) {
            document.documentElement.releasePointerCapture(e.pointerId);
        }
    }

    _resetDirtyRect() {
        this.dirtyRect = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity };
    }

    _updateDirtyRect(x, y, size) {
        this.dirtyRect.minX = Math.min(this.dirtyRect.minX, x - size);
        this.dirtyRect.minY = Math.min(this.dirtyRect.minY, y - size);
        this.dirtyRect.maxX = Math.max(this.dirtyRect.maxX, x + size);
        this.dirtyRect.maxY = Math.max(this.dirtyRect.maxY, y + size);
    }
    
    _requestRender() {
        if (!this.animationFrameId) {
            this.animationFrameId = requestAnimationFrame(() => {
                this._renderDirty();
                this.animationFrameId = null;
            });
        }
    }

    _renderDirty() {
        const rect = this.dirtyRect;
        if (rect.minX > rect.maxX) return; // ダーティ領域が不正な場合は何もしない

        this.renderingBridge.compositeLayers(this.app.layerManager.layers, this.compositionData, rect);
        this.renderingBridge.renderToDisplay(this.compositionData, rect);
    }

    renderAllLayers() {
        this.dirtyRect = { minX: 0, minY: 0, maxX: this.width, maxY: this.height };
        this._requestRender();
    }

    calculatePressureSize(baseSize, pressure) {
        if (!this.pressureSettings.dynamicRange) {
            return baseSize;
        }

        const clampedPressure = Math.max(this.pressureSettings.minPressure, Math.min(pressure, this.pressureSettings.maxPressure));
        const normalizedPressure = (clampedPressure - this.pressureSettings.minPressure) / (this.pressureSettings.maxPressure - this.pressureSettings.minPressure);
        const adjustedPressure = Math.pow(normalizedPressure, this.pressureSettings.curve) * this.pressureSettings.sensitivity;

        const sizeRange = baseSize * (1 - this.pressureSettings.minSizeRatio);
        return baseSize * this.pressureSettings.minSizeRatio + sizeRange * adjustedPressure;
    }

    saveState() {
        // 現在のレイヤーの状態を保存
        // TODO: レイヤー全体ではなく、ダーティ矩形領域のみを保存するように最適化
        const currentState = this.app.layerManager.layers.map(layer => ({
            name: layer.name,
            visible: layer.visible,
            opacity: layer.opacity,
            blendMode: layer.blendMode,
            imageData: new ImageData(layer.imageData.data, layer.imageData.width, layer.imageData.height), // ディープコピー
            modelMatrix: mat4.clone(layer.modelMatrix) // modelMatrix も保存
        }));

        this.history = this.history.slice(0, this.historyIndex + 1);
        this.history.push(currentState);
        this.historyIndex = this.history.length - 1;

        console.log("History saved. Index:", this.historyIndex, "Total:", this.history.length);
    }

    undo() {
        if (this.historyIndex > 0) {
            this.historyIndex--;
            this.restoreState();
            console.log("Undo. Index:", this.historyIndex);
        } else {
            console.log("No more undo history.");
        }
    }

    redo() {
        if (this.historyIndex < this.history.length - 1) {
            this.historyIndex++;
            this.restoreState();
            console.log("Redo. Index:", this.historyIndex);
        } else {
            console.log("No more redo history.");
        }
    }

    restoreState() {
        if (this.history.length === 0) return;

        const savedState = this.history[this.historyIndex];
        this.app.layerManager.layers = savedState.map(savedLayer => {
            const newLayer = new Layer(savedLayer.name, savedLayer.imageData.width, savedLayer.imageData.height);
            newLayer.visible = savedLayer.visible;
            newLayer.opacity = savedLayer.opacity;
            newLayer.blendMode = savedLayer.blendMode;
            newLayer.imageData = new ImageData(savedLayer.imageData.data, savedLayer.imageData.width, savedLayer.imageData.height);
            newLayer.modelMatrix = mat4.clone(savedLayer.modelMatrix); // modelMatrix も復元
            newLayer.gpuDirty = true; // GPU側もダーティにする
            return newLayer;
        });

        this.app.layerManager.currentLayerIndex = 0; // 必要に応じて調整
        this.renderAllLayers();
        this.app.layerUIManager.updateLayerList(this.app.layerManager.layers); // UIも更新
    }

    exportMergedImage() {
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = this.width;
        tempCanvas.height = this.height;
        const tempCtx = tempCanvas.getContext('2d');

        // WebGL Engineから最終的な合成結果をImageDataとして取得
        const mergedImageData = new ImageData(this.width, this.height);
        this.renderingBridge.compositeLayers(this.app.layerManager.layers, mergedImageData, { minX: 0, minY: 0, maxX: this.width, maxY: this.height });
        
        tempCtx.putImageData(mergedImageData, 0, 0);

        const dataURL = tempCanvas.toDataURL('image/png');
        const a = document.createElement('a');
        a.href = dataURL;
        a.download = 'toshinka_tegaki_tool_merged.png';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        console.log("画像をエクスポートしました。");
    }

    updateCursor() {
        if (this.isSpaceDown || this.isPanning) {
            this.canvasArea.style.cursor = 'grab';
        } else if (this.isVDown || this.isLayerMoving) {
            this.canvasArea.style.cursor = 'move';
        } else {
            this.canvasArea.style.cursor = 'crosshair';
        }
    }

    handleWheel(e) {
        e.preventDefault();
        if (e.shiftKey) {
            this.rotate(-e.deltaY * 0.2);
        } else {
            this.zoom(e.deltaY > 0 ? 1 / 1.05 : 1.05);
        }
    }
    
    // ✨ LayerManager, PenSettingsManager, ColorManager, ToolManager のクラス定義はここからゴッソリ削除されました。

}

class ToshinkaTegakiTool {
    constructor() {
        this.initManagers();
    }
    initManagers() {
        this.canvasManager = new CanvasManager(this);
        this.layerManager = new LayerManager(this);
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
        this.canvasManager.renderAllLayers();
    }
}

document.addEventListener('DOMContentLoaded', () => {
    // WebGLがサポートされているかチェック
    if (!WebGLEngine.isSupported()) {
        alert("お使いのブラウザはWebGLをサポートしていません。描画ツールが正しく動作しない可能性があります。");
    }

    const app = new ToshinkaTegakiTool();
    window.app = app; // デバッグ用にグローバルに公開
    console.log("Toshinka Tegaki Tool initialized.");
});