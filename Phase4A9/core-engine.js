/*
 * ===================================================================================
 * Toshinka Tegaki Tool - Core Engine
 * Version: 4.0.0 (WebGL Layer Transform - Phase4A9)
 *
 * - 改修：
 * - 1. 非破壊レイヤー変形の導入 (modelMatrix):
 * -   Layerクラスが持つ変形情報を、従来の `transform` オブジェクトから
 * -   gl-matrix の `mat4` 型 `modelMatrix` に完全移行。
 * -   `start/apply/commitLayerTransform` といった破壊的変形ロジックを全て廃止し、
 * -   マウスドラッグやGUIによる変形操作を、`modelMatrix` の更新のみで完結させた。
 * -   これにより、変形を繰り返しても画質が一切劣化しない高品質な編集フローを実現。
 *
 * - 2. ペン描画の座標追従:
 * -   `transformWorldToLocal` ユーティリティを導入。ペン/バケツツールの描画時に、
 * -   マウスのスクリーン座標を現在のアクティブレイヤーのローカル座標に変換。
 * -   これにより、レイヤーが移動・回転・拡縮されていても、正しい位置に描画される。
 *
 * - 3. dat.GUIによる変形コントロール:
 * -   アクティブレイヤーの「X移動」「Y移動」「回転」「拡縮」をリアルタイムに
 * -   調整できるデバッグ用UIを導入。行列計算の挙動確認と微調整が容易になった。
 * ===================================================================================
 */

// --- Module Imports ---
import { TopBarManager, LayerUIManager } from './ui/ui-manager.js';
import { ShortcutManager } from './ui/shortcut-manager.js';
import { BucketTool } from './tools/toolset.js';
import { RenderingBridge } from './core/rendering/rendering-bridge.js';
// ★★★ Phase4A9 追加: 行列演算ユーティリティのインポート ★★★
import { create, reset as resetMatrix, translate, rotate, scale, clone, getTranslation, transformWorldToLocal } from './core/utils/transform-utils.js';

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
        
        // ★★★ Phase4A9 変更: transformプロパティをmodelMatrixに置き換え ★★★
        // 各レイヤーが自身の位置・回転・スケール情報を持つ行列
        this.modelMatrix = create();

        // 破壊的変形用のプロパティは不要になったためコメントアウト (削除も可)
        // this.transform = { x: 0, y: 0, scale: 1, rotation: 0, flipX: 1, flipY: 1 };
        // this.originalImageData = null;
        
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
        
        this.isDrawing = false; this.isPanning = false; this.isSpaceDown = false;
        this.isVDown = false; this.isShiftDown = false;
        
        // ★★★ Phase4A9 変更: 非破壊変形用のプロパティ ★★★
        this.isLayerTransforming = false;       // レイヤーを変形中か
        this.transformMode = 'move';            // 'move', 'rotate_scale'
        this.transformStartX = 0;               // 変形開始時のマウスX
        this.transformStartY = 0;               // 変形開始時のマウスY
        this.originalMatrix = create();         // 変形開始時の行列を保持

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
        // ★★★ Phase4A9 追加: dat.GUIのセットアップ ★★★
        this.setupTransformGUI();
    }
    
    bindEvents() {
        this.canvasArea.addEventListener('pointerdown', this.onPointerDown.bind(this));
        document.addEventListener('pointermove', this.onPointerMove.bind(this));
        document.addEventListener('pointerup', this.onPointerUp.bind(this));
        this.canvasArea.addEventListener('wheel', this.handleWheel.bind(this), { passive: false });
        document.addEventListener('contextmenu', e => e.preventDefault());
        document.getElementById('saveMergedButton')?.addEventListener('click', () => this.exportMergedImage());
    }

    onPointerDown(e) {
        if (e.button !== 0 && e.button !== 2) return; // 右クリックも変形に使う場合があるので許可
        
        // ★★★ Phase4A9 変更: Vキーによるレイヤー変形開始処理 ★★★
        if (this.isVDown) {
            this.startLayerTransform(e);
            e.preventDefault(); return;
        }

        if (e.button !== 0) return; // 以降は左クリックのみ

        if (this.isSpaceDown) {
            this.dragStartX = e.clientX; this.dragStartY = e.clientY; this.isPanning = true;
            this.canvasStartX = this.viewTransform.left; this.canvasStartY = this.viewTransform.top;
            e.preventDefault(); return;
        }

        const activeLayer = this.app.layerManager.getCurrentLayer();
        if (!activeLayer || !activeLayer.visible) return;

        // ★★★ Phase4A9 変更: ワールド座標をレイヤーのローカル座標に変換 ★★★
        const worldCoords = this.getCanvasCoordinates(e);
        if (!worldCoords) return;
        const localCoords = transformWorldToLocal(worldCoords.x, worldCoords.y, activeLayer.modelMatrix);
        if (!localCoords) return; // レイヤー範囲外（逆行列計算不能）なら何もしない

        this._resetDirtyRect();
        
        if (this.currentTool === 'bucket') {
            this.app.bucketTool.fill(activeLayer.imageData, localCoords[0], localCoords[1], hexToRgba(this.currentColor));
            activeLayer.gpuDirty = true;
            this.renderAllLayers();
            this.saveState();
            return;
        }

        this.isDrawing = true;
        this.pressureHistory = [e.pressure > 0 ? e.pressure : 0.5];
        this.lastPoint = { x: localCoords[0], y: localCoords[1], pressure: this.pressureHistory[0] };
        
        const size = this.calculatePressureSize(this.currentSize, this.lastPoint.pressure);
        
        // ダーティ矩形の計算はワールド座標で行う必要がある
        this._updateDirtyRectWithTransform(localCoords[0], localCoords[1], size, activeLayer.modelMatrix);
        
        this.renderingBridge.drawCircle(
            localCoords[0], localCoords[1], size / 2, 
            hexToRgba(this.currentColor), this.currentTool === 'eraser',
            activeLayer
        );
        
        this._requestRender();
        document.documentElement.setPointerCapture(e.pointerId);
    }
    
    onPointerMove(e) {
        // ★★★ Phase4A9 変更: 非破壊のレイヤー変形処理 ★★★
        if (this.isLayerTransforming) {
            this.applyLayerTransform(e);
            return;
        }

        if (this.isPanning) {
            const dx = e.clientX - this.dragStartX; const dy = e.clientY - this.dragStartY;
            this.viewTransform.left = this.canvasStartX + dx; this.viewTransform.top = this.canvasStartY + dy;
            this.applyViewTransform(); return;
        }
        if (!this.isDrawing) return;
        
        const activeLayer = this.app.layerManager.getCurrentLayer();
        if (!activeLayer || !activeLayer.visible) return;
        
        const worldCoords = this.getCanvasCoordinates(e);
        if (!worldCoords) { this.lastPoint = null; return; }
        const localCoords = transformWorldToLocal(worldCoords.x, worldCoords.y, activeLayer.modelMatrix);
        if (!localCoords) { this.lastPoint = null; return; }

        if (!this.lastPoint) { 
            this.pressureHistory = [e.pressure > 0 ? e.pressure : 0.5];
            this.lastPoint = { x: localCoords[0], y: localCoords[1], pressure: e.pressure > 0 ? e.pressure : 0.5 }; 
            return;
        }

        const currentPressure = e.pressure > 0 ? e.pressure : 0.5;
        this.pressureHistory.push(currentPressure);
        if (this.pressureHistory.length > this.maxPressureHistory) {
            this.pressureHistory.shift();
        }
        
        const lastSize = this.calculatePressureSize(this.currentSize, this.lastPoint.pressure);
        const currentSize = this.calculatePressureSize(this.currentSize, currentPressure);
        
        this._updateDirtyRectWithTransform(this.lastPoint.x, this.lastPoint.y, lastSize, activeLayer.modelMatrix);
        this._updateDirtyRectWithTransform(localCoords[0], localCoords[1], currentSize, activeLayer.modelMatrix);

        this.renderingBridge.drawLine(
            this.lastPoint.x, this.lastPoint.y, localCoords[0], localCoords[1],
            this.currentSize, hexToRgba(this.currentColor), this.currentTool === 'eraser',
            this.lastPoint.pressure, currentPressure, 
            this.calculatePressureSize.bind(this),
            activeLayer
        );
        
        this.lastPoint = { x: localCoords[0], y: localCoords[1], pressure: currentPressure };
        this._requestRender();
    }
    
    onPointerUp(e) {
        // ★★★ Phase4A9 変更: 変形終了処理 ★★★
        if (this.isLayerTransforming) {
             this.isLayerTransforming = false;
             this.saveState(); // 変形が終わったら履歴に保存
        }
        
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

        this.isPanning = false;
        if (document.documentElement.hasPointerCapture(e.pointerId)) {
            document.documentElement.releasePointerCapture(e.pointerId);
        }
    }

    _renderDirty() {
        const rect = this.dirtyRect;
        if (rect.minX > rect.maxX) return;
        this.renderingBridge.compositeLayers(this.app.layerManager.layers, this.compositionData, rect);
        this.renderingBridge.renderToDisplay(this.compositionData, rect);
    }

    renderAllLayers() {
        this.dirtyRect = { minX: 0, minY: 0, maxX: this.width, maxY: this.height };
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

    // ★★★ Phase4A9 追加: 変形を考慮したダーティ矩形更新 ★★★
    _updateDirtyRectWithTransform(localX, localY, radius, modelMatrix) {
        // ローカル座標の点をワールド座標に変換して、その周囲をダーティ矩形とする
        const worldPos = glMatrix.vec4.create();
        glMatrix.vec4.transformMat4(worldPos, [localX, localY, 0, 1], modelMatrix);
        this._updateDirtyRect(worldPos[0], worldPos[1], radius);
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
        
        const minSize = baseSize * this.pressureSettings.minSizeRatio;
        const maxSize = baseSize;
        const finalSize = minSize + (maxSize - minSize) * curvedPressure;
        
        return Math.max(0.1, finalSize);
    }

    getCanvasCoordinates(e) {
        try {
            const rect = this.displayCanvas.getBoundingClientRect();
            if (rect.width === 0 || rect.height === 0) return null;
            let x = e.clientX - rect.left;
            let y = e.clientY - rect.top;
            x = x * (this.width / rect.width);
            y = y * (this.height / rect.height);
            if (this.viewTransform.flipX === -1) { x = this.width - x; }
            if (this.viewTransform.flipY === -1) { y = this.height - y; }
            if (x < 0 || x >= this.width || y < 0 || y >= this.height) { return null; }
            return { x: x, y: y };
        } catch (error) {
            console.warn('座標変換エラー:', error);
            return null;
        }
    }

    // ★★★ Phase4A9 変更: 非破壊変形ロジック群 ★★★
    startLayerTransform(e) {
        const activeLayer = this.app.layerManager.getCurrentLayer();
        // 背景レイヤーは動かせない
        if (!activeLayer || this.app.layerManager.layers.indexOf(activeLayer) === 0) return;

        this.isLayerTransforming = true;
        this.transformMode = this.isShiftDown ? 'rotate_scale' : 'move';
        this.transformStartX = e.clientX;
        this.transformStartY = e.clientY;
        // 変形開始時の行列をディープコピーして保存
        this.originalMatrix = clone(activeLayer.modelMatrix);
    }
    
    applyLayerTransform(e) {
        if (!this.isLayerTransforming) return;
        const activeLayer = this.app.layerManager.getCurrentLayer();
        if (!activeLayer) return;

        const dx = (e.clientX - this.transformStartX) / this.viewTransform.scale;
        const dy = (e.clientY - this.transformStartY) / this.viewTransform.scale;
        
        // 変形開始時の行列を元に、現在の変形を適用する
        const newMatrix = clone(this.originalMatrix);

        if (this.transformMode === 'move') {
            translate(newMatrix, dx, dy);
        } else { // rotate_scale
            // 移動量を回転とスケールに変換
            const angle = dx * 0.5 * (Math.PI / 180); // 度からラジアンへ
            const scaleFactor = Math.max(0.1, 1 - dy * 0.005);
            
            // レイヤーの中心を回転・拡縮の基点にする
            const centerX = this.width / 2;
            const centerY = this.height / 2;

            // 1. 原点へ移動
            translate(newMatrix, centerX, centerY);
            // 2. 回転と拡縮
            rotate(newMatrix, angle);
            scale(newMatrix, scaleFactor, scaleFactor);
            // 3. 元の位置へ戻す
            translate(newMatrix, -centerX, -centerY);
        }
        
        activeLayer.modelMatrix = newMatrix;
        this.updateTransformGUI(); // GUIの値を更新
        this.renderAllLayers();
    }
    
    // 破壊的コミット処理は不要になったため、以前の commitLayerTransform は削除

    saveState() {
        if (this.isLayerTransforming) return; // 変形中は保存しない
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
                // ★★★ Phase4A9 変更: modelMatrixを保存 ★★★
                modelMatrix: clone(layer.modelMatrix)
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
            // ★★★ Phase4A9 変更: modelMatrixを復元 ★★★
            if (layerData.modelMatrix) {
                layer.modelMatrix = clone(layerData.modelMatrix);
            }
            layer.gpuDirty = true;
            return layer;
        });
        this.app.layerManager.switchLayer(state.activeLayerIndex);
        this.renderAllLayers();
    }

    undo() { if (this.historyIndex > 0) { this.historyIndex--; this.restoreState(this.history[this.historyIndex]); } }
    redo() { if (this.historyIndex < this.history.length - 1) { this.historyIndex++; this.restoreState(this.history[this.historyIndex]); } }
    setCurrentTool(tool) { this.currentTool = tool; this.updateCursor(); }
    setCurrentColor(color) { this.currentColor = color; }
    setCurrentSize(size) { this.currentSize = size; }
    
    clearCanvas() {
        const activeLayer = this.app.layerManager.getCurrentLayer();
        if (activeLayer) {
            activeLayer.clear();
            // ★★★ Phase4A9 変更: クリア時に変形もリセット ★★★
            resetMatrix(activeLayer.modelMatrix);
            if (this.app.layerManager.activeLayerIndex === 0) {
                activeLayer.fill('#f0e0d6');
            }
            this.updateTransformGUI();
            this.renderAllLayers();
            this.saveState();
        }
    }
    
    exportMergedImage() {
        const exportCanvas = document.createElement('canvas');
        exportCanvas.width = this.width;
        exportCanvas.height = this.height;
        const exportCtx = exportCanvas.getContext('2d');
        
        const fullRect = { minX: 0, minY: 0, maxX: this.width, maxY: this.height };
        this.renderingBridge.compositeLayers(this.app.layerManager.layers, this.compositionData, fullRect);

        const gl = this.renderingBridge.engines['webgl']?.gl;
        if (gl && this.renderingBridge.currentEngineType === 'webgl') {
             const pixels = new Uint8Array(this.width * this.height * 4);
             this.renderingBridge.renderToDisplay(null, fullRect);
             gl.readPixels(0, 0, this.width, this.height, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
             
             // Y軸反転はシェーダー側で解決済みのため、JSでの反転は不要
             const finalImageData = new ImageData(new Uint8ClampedArray(pixels), this.width, this.height);
             exportCtx.putImageData(finalImageData, 0, 0);

        } else {
            exportCtx.putImageData(this.compositionData, 0, 0);
        }
        
        const dataURL = exportCanvas.toDataURL('image/png');
        const link = document.createElement('a');
        link.href = dataURL;
        link.download = 'merged_image.png';
        link.click();
    }
    
    updateCursor() { let cursor = 'crosshair'; if (this.isVDown) cursor = 'move'; if (this.isSpaceDown) cursor = 'grab'; if (this.currentTool === 'eraser') cursor = 'cell'; if (this.currentTool === 'bucket') cursor = 'copy'; this.canvasArea.style.cursor = cursor; }
    applyViewTransform() { const t = this.viewTransform; this.canvasContainer.style.transform = `translate(${t.left}px, ${t.top}px) scale(${t.scale * t.flipX}, ${t.scale * t.flipY}) rotate(${t.rotation}deg)`; }
    flipHorizontal() { this.viewTransform.flipX *= -1; this.applyViewTransform(); }
    flipVertical() { this.viewTransform.flipY *= -1; this.applyViewTransform(); }
    zoom(factor) { this.viewTransform.scale = Math.max(0.1, this.viewTransform.scale * factor); this.applyViewTransform(); }
    rotate(degrees) { this.viewTransform.rotation = (this.viewTransform.rotation + degrees) % 360; this.applyViewTransform(); }
    resetView() { this.viewTransform = { scale: 1, rotation: 0, flipX: 1, flipY: 1, left: 0, top: 0 }; this.applyViewTransform(); }
    handleWheel(e) { e.preventDefault(); if (e.shiftKey) { this.rotate(-e.deltaY * 0.2); } else { this.zoom(e.deltaY > 0 ? 1 / 1.05 : 1.05); } }

    // ★★★ Phase4A9 追加: dat.GUI関連のメソッド群 ★★★
    setupTransformGUI() {
        if (typeof dat === 'undefined') {
            console.warn('dat.GUI is not loaded. Transform GUI will be disabled.');
            return;
        }
        this.gui = new dat.GUI();
        this.guiValues = {
            x: 0, y: 0, rotation: 0, scale: 1,
            reset: () => {
                const layer = this.app.layerManager.getCurrentLayer();
                if (layer) {
                    resetMatrix(layer.modelMatrix);
                    this.updateTransformGUI();
                    this.renderAllLayers();
                }
            }
        };

        const updateMatrixFromGUI = () => {
            const layer = this.app.layerManager.getCurrentLayer();
            if (!layer) return;
            
            // GUIの値から行列を再構築
            resetMatrix(layer.modelMatrix);
            
            const centerX = this.width / 2;
            const centerY = this.height / 2;

            // 1. GUIのX,Yで移動
            translate(layer.modelMatrix, this.guiValues.x, this.guiValues.y);
            // 2. 中心を原点に移動
            translate(layer.modelMatrix, centerX, centerY);
            // 3. 回転とスケール
            rotate(layer.modelMatrix, this.guiValues.rotation * (Math.PI / 180));
            scale(layer.modelMatrix, this.guiValues.scale, this.guiValues.scale);
            // 4. 中心を元の位置に戻す
            translate(layer.modelMatrix, -centerX, -centerY);
            
            this.renderAllLayers();
        };

        this.gui.add(this.guiValues, 'x', -this.width, this.width).name('X').onChange(updateMatrixFromGUI);
        this.gui.add(this.guiValues, 'y', -this.height, this.height).name('Y').onChange(updateMatrixFromGUI);
        this.gui.add(this.guiValues, 'rotation', -360, 360).name('Rotation').onChange(updateMatrixFromGUI);
        this.gui.add(this.guiValues, 'scale', 0.1, 5).name('Scale').onChange(updateMatrixFromGUI);
        this.gui.add(this.guiValues, 'reset').name('Reset Transform');

        // 最初は非表示にしておく
        this.gui.close();
    }

    updateTransformGUI() {
        if (!this.gui) return;
        const layer = this.app.layerManager.getCurrentLayer();
        if (!layer) return;
        
        // modelMatrixから平行移動量を取得
        const translation = getTranslation(layer.modelMatrix);
        this.guiValues.x = translation.x;
        this.guiValues.y = translation.y;
        
        // Note: 回転とスケールを正確に分離するのは複雑なため、ここでは平行移動のみを同期します。
        // this.guiValues.rotation = ...
        // this.guiValues.scale = ...

        // GUIの表示を更新
        for (let i in this.gui.__controllers) {
            this.gui.__controllers[i].updateDisplay();
        }
    }
}

class LayerManager { 
    constructor(app) { this.app = app; this.layers = []; this.activeLayerIndex = -1; this.width = 344; this.height = 135; this.mergeCanvas = document.createElement('canvas'); this.mergeCanvas.width = this.width; this.mergeCanvas.height = this.height; this.mergeCtx = this.mergeCanvas.getContext('2d'); } 
    setupInitialLayers() { const bgLayer = new Layer('背景', this.width, this.height); bgLayer.fill('#f0e0d6'); this.layers.push(bgLayer); const drawingLayer = new Layer('レイヤー 1', this.width, this.height); this.layers.push(drawingLayer); this.switchLayer(1); this.app.canvasManager.renderAllLayers(); this.app.canvasManager.saveState(); } 
    addLayer() { if (this.layers.length >= 99) return; const insertIndex = this.activeLayerIndex + 1; const newLayer = new Layer(`レイヤー ${this.layers.length + 1}`, this.width, this.height); this.layers.splice(insertIndex, 0, newLayer); this.renameLayers(); this.switchLayer(insertIndex); this.app.canvasManager.saveState(); } 
    deleteActiveLayer() { if (this.activeLayerIndex === 0 || this.layers.length <= 1) return; this.layers.splice(this.activeLayerIndex, 1); const newActiveIndex = Math.min(this.layers.length - 1, this.activeLayerIndex); this.renameLayers(); this.switchLayer(newActiveIndex); this.app.canvasManager.renderAllLayers(); this.app.canvasManager.saveState(); } 
    renameLayers() { this.layers.forEach((layer, index) => { if (index > 0) layer.name = `レイヤー ${index}`; }); } 
    switchLayer(index) { 
        if (index < 0 || index >= this.layers.length) return; 
        this.activeLayerIndex = index; 
        if (this.app.layerUIManager) { this.app.layerUIManager.renderLayers(); }
        // ★★★ Phase4A9 追加: レイヤー切り替え時にGUIを更新 ★★★
        if (this.app.canvasManager) { this.app.canvasManager.updateTransformGUI(); }
    } 
    getCurrentLayer() { return this.layers[this.activeLayerIndex] || null; } 
    duplicateActiveLayer() { 
        const activeLayer = this.getCurrentLayer(); 
        if (!activeLayer) return; 
        const newLayer = new Layer(`${activeLayer.name}のコピー`, this.width, this.height); 
        newLayer.imageData.data.set(activeLayer.imageData.data); 
        newLayer.visible = activeLayer.visible; 
        newLayer.opacity = activeLayer.opacity; 
        newLayer.blendMode = activeLayer.blendMode; 
        // ★★★ Phase4A9 追加: modelMatrixも複製 ★★★
        newLayer.modelMatrix = clone(activeLayer.modelMatrix);
        newLayer.gpuDirty = true; 
        const insertIndex = this.activeLayerIndex + 1; 
        this.layers.splice(insertIndex, 0, newLayer); 
        this.renameLayers(); this.switchLayer(insertIndex); 
        this.app.canvasManager.saveState(); 
    } 
    mergeDownActiveLayer() {
        if (this.activeLayerIndex <= 0) return;
        // ★★★ Phase4A9 警告: この関数は非破壊変形に対応していません ★★★
        // 変形を焼き付けてからマージする必要があります。今回は未対応。
        console.warn("Merge Down does not currently support transformed layers correctly. Merging will use the layer's raw pixel data without its transformation.");

        const topLayer = this.layers[this.activeLayerIndex];
        const bottomLayer = this.layers[this.activeLayerIndex - 1];
        const tempCtx = this.mergeCtx;
        tempCtx.clearRect(0, 0, this.width, this.height);
        tempCtx.putImageData(bottomLayer.imageData, 0, 0);
        tempCtx.globalAlpha = topLayer.opacity / 100;
        tempCtx.globalCompositeOperation = topLayer.blendMode;
        const topLayerCanvas = document.createElement('canvas');
        topLayerCanvas.width = this.width;
        topLayerCanvas.height = this.height;
        const topLayerCtx = topLayerCanvas.getContext('2d');
        topLayerCtx.putImageData(topLayer.imageData, 0, 0);
        tempCtx.drawImage(topLayerCanvas, 0, 0);
        bottomLayer.imageData = tempCtx.getImageData(0, 0, this.width, this.height);
        bottomLayer.gpuDirty = true;
        this.layers.splice(this.activeLayerIndex, 1);
        this.switchLayer(this.activeLayerIndex - 1);
        this.app.canvasManager.renderAllLayers();
        this.app.canvasManager.saveState();
    } 
}

// PenSettingsManager, ColorManager, ToolManagerクラスは変更なしのため省略

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
        this.penSettingsManager.setSize(1);
        this.colorManager.setColor(this.colorManager.mainColor);
    }
}

window.addEventListener('DOMContentLoaded', () => {
    if (!window.toshinkaTegakiInitialized) {
        window.toshinkaTegakiInitialized = true;
        window.toshinkaTegakiTool = new ToshinkaTegakiTool();
    }
});