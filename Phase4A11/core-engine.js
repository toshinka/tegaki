/*
 * ===================================================================================
 * Toshinka Tegaki Tool - Core Engine
 * Version: 2.8.0 (Non-Destructive Transforms)
 *
 * - 修正：
 * - 1. 非破壊変形ロジックの導入:
 * -   レイヤー変形時にピクセルを再計算する破壊的な方法を完全に廃止。
 * -   変形情報（移動、回転、拡縮）を行列(Matrix)として保持し、
 * -   描画時にGPU側でリアルタイムに変形させる方式に変更。
 * -   これにより、何度変形しても画質が全く劣化しなくなった。
 *
 * - 2. 変形プレビューの高速化:
 * -   CPUでの重い画像処理が不要になったため、レイヤー変形時のプレビューが
 * -   非常に高速かつ滑らかになった。
 *
 * - 3. コードのシンプル化:
 * -   変形のために一時的な画像データを保持する必要がなくなり、
 * -   `originalImageData`等のプロパティを廃止。ロジックが大幅に簡潔になった。
 * ===================================================================================
 */

// --- Module Imports ---
import { TopBarManager, LayerUIManager } from './ui/ui-manager.js';
import { ShortcutManager } from './ui/shortcut-manager.js';
import { BucketTool } from './tools/toolset.js';
import { RenderingBridge } from './core/rendering/rendering-bridge.js';

// --- Core Logic Classes ---

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
        this.gpuDirty = true;
        
        // ★★★ 修正: 非破壊変形用のプロパティ ★★★
        this.transform = { x: 0, y: 0, scale: 1, rotation: 0 };
        // この行列に最終的な変形情報が格納される
        this.transformMatrix = glMatrix.mat4.create(); 
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
        this.isDrawing = false; this.isPanning = false; this.isSpaceDown = false;
        
        this.isVDown = false; this.isShiftDown = false;
        
        // ★★★ 修正: 変形ロジックを大幅に簡略化 ★★★
        this.isLayerTransforming = false;
        this.transformTargetLayer = null;
        this.originalLayerTransform = null;
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

        this.dragStartX = 0; this.dragStartY = 0; this.canvasStartX = 0; this.canvasStartY = 0;
        this.viewTransform = { scale: 1, rotation: 0, flipX: 1, flipY: 1, left: 0, top: 0 };
        
        this.bindEvents();
    }
    
    bindEvents() { /* ...変更なし... */ }
    onPointerDown(e) { /* ...変更なし... */ }
    onPointerMove(e) {
        if (this.isLayerTransforming) {
            // ★★★ 修正: プレビュー処理を新しい方式に変更 ★★★
            this.applyLayerTransformPreview(e); 
            return;
        }
        if (this.isPanning) { /* ...変更なし... */ }
        if (!this.isDrawing) return;
        /* ...以降変更なし... */
    }
    onPointerUp(e) {
        if (this.isLayerTransforming) {
            // ★★★ 修正: コミット処理を新しい方式に変更 ★★★
            this.commitLayerTransform();
        }
        /* ...以降変更なし... */
    }

    _renderDirty() { /* ...変更なし... */ }
    renderAllLayers() { /* ...変更なし... */ }
    _requestRender() { /* ...変更なし... */ }
    _updateDirtyRect(x, y, radius) { /* ...変更なし... */ }
    _resetDirtyRect() { /* ...変更なし... */ }
    calculatePressureSize(baseSizeInput, pressure) { /* ...変更なし... */ }
    getCanvasCoordinates(e) { /* ...変更なし... */ }

    // ★★★★★ 修正箇所: 変形関連のメソッドを全面的に刷新 ★★★★★

    startLayerTransform(e) {
        const activeLayer = this.app.layerManager.getCurrentLayer();
        if (!activeLayer || this.app.layerManager.layers.indexOf(activeLayer) === 0) return;
        
        this.isLayerTransforming = true;
        this.transformTargetLayer = activeLayer;
        
        // 変形開始時のtransform値を保存
        this.originalLayerTransform = { ...activeLayer.transform };
        
        this.transformMode = this.isShiftDown ? 'rotate_scale' : 'move';
        this.transformStartX = e.clientX;
        this.transformStartY = e.clientY;
    }

    applyLayerTransformPreview(e) {
        if (!this.isLayerTransforming) return;

        const layer = this.transformTargetLayer;
        const dx = e.clientX - this.transformStartX;
        const dy = e.clientY - this.transformStartY;

        // 1. ユーザーフレンドリーなtransformオブジェクトを更新
        if (this.transformMode === 'move') {
            layer.transform.x = this.originalLayerTransform.x + dx / this.viewTransform.scale;
            layer.transform.y = this.originalLayerTransform.y + dy / this.viewTransform.scale;
        } else {
            layer.transform.rotation = this.originalLayerTransform.rotation + dx * 0.5;
            const scaleFactor = 1 - dy * 0.005;
            layer.transform.scale = Math.max(0.1, this.originalLayerTransform.scale * scaleFactor);
        }

        // 2. transformオブジェクトから描画用の行列を計算
        this._updateTransformMatrix(layer);

        // 3. 再描画をリクエスト（GPUが新しい行列を使って描画する）
        this.renderAllLayers();
    }

    commitLayerTransform() {
        if (!this.isLayerTransforming) return;
        
        // 最終的なtransform値を持つ行列を再計算
        this._updateTransformMatrix(this.transformTargetLayer);

        this.isLayerTransforming = false;
        this.transformTargetLayer = null;
        this.originalLayerTransform = null;
        
        this.renderAllLayers();
        this.saveState(); // 変形後の状態で履歴を保存
    }

    // transformオブジェクトから行列を計算するヘルパー関数
    _updateTransformMatrix(layer) {
        const mat = layer.transformMatrix;
        const t = layer.transform;
        
        // 行列を初期化
        glMatrix.mat4.identity(mat);
        
        // WebGLのクリップ座標系（-1~1）に変換
        // 1. ピクセル座標から-0.5~0.5の範囲に
        // 2. スケールを2倍して-1~1の範囲に
        glMatrix.mat4.scale(mat, mat, [2.0 / this.width, -2.0 / this.height, 1.0]);
        glMatrix.mat4.translate(mat, mat, [this.width / 2, -this.height/2, 0]);
        
        // 変形を適用（順番が重要：拡縮→回転→移動）
        glMatrix.mat4.translate(mat, mat, [t.x, t.y, 0]);
        glMatrix.mat4.rotateZ(mat, mat, t.rotation * Math.PI / 180);
        glMatrix.mat4.scale(mat, mat, [t.scale, t.scale, 1.0]);

        // 中心を原点に戻す
        glMatrix.mat4.translate(mat, mat, [-this.width / 2, -this.height / 2, 0]);
    }
    
    // ★★★★★ 履歴管理の修正 ★★★★★
    saveState() {
        if(this.isLayerTransforming) return;
        const state = {
            layers: this.app.layerManager.layers.map(layer => ({
                name: layer.name,
                visible: layer.visible,
                opacity: layer.opacity,
                blendMode: layer.blendMode,
                imageData: new ImageData(
                    new Uint8ClampedArray(layer.imageData.data),
                    layer.imageData.width,
                    layer.imageData.height
                ),
                // transformオブジェクトをそのまま保存
                transform: { ...layer.transform } 
            })),
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
            
            // 保存されたtransformオブジェクトを復元
            if (layerData.transform) {
                layer.transform = { ...layerData.transform };
            }
            
            // 復元されたtransformから行列を再計算
            this._updateTransformMatrix(layer);

            layer.gpuDirty = true;
            return layer;
        });
        this.app.layerManager.switchLayer(state.activeLayerIndex);
        this.renderAllLayers();
    }

    // --- 以下、既存のメソッド (変更なし) ---
    undo() { if (this.historyIndex > 0) { this.historyIndex--; this.restoreState(this.history[this.historyIndex]); } }
    redo() { if (this.historyIndex < this.history.length - 1) { this.historyIndex++; this.restoreState(this.history[this.historyIndex]); } }
    setCurrentTool(tool) { /* ... */ }
    setCurrentColor(color) { /* ... */ }
    setCurrentSize(size) { /* ... */ }
    clearCanvas() { /* ... */ }
    exportMergedImage() { /* ... */ }
    updateCursor() { /* ... */ }
    applyViewTransform() { /* ... */ }
    flipHorizontal() { /* ... */ }
    flipVertical() { /* ... */ }
    zoom(factor) { /* ... */ }
    rotate(degrees) { /* ... */ }
    resetView() { /* ... */ }
    handleWheel(e) { /* ... */ }
}
// 他のクラス(LayerManager, PenSettingsManagerなど)は変更なし