/*
 * ===================================================================================
 * Toshinka Tegaki Tool - Core Engine
 * Version: 2.7.0 (Refined Pen Pressure Curve - Mk.II)
 *
 * - 修正：
 * - ペンの「ON荷重」問題をさらに改善するため、筆圧計算ロジックを再々調整。
 * - 描き始めの数点の筆圧を抑制するロジックを強化し、より立ち上がりの遅いカーブに変更。
 * - これにより、弱いタッチでの繊細な「入り」の表現がさらに向上し、シャープな先細り線を描きやすくする。
 * ===================================================================================
 */

// --- Module Imports ---
import { TopBarManager, LayerUIManager } from './ui/ui-manager.js';
import { ShortcutManager } from './ui/shortcut-manager.js';
import { BucketTool } from './tools/toolset.js';
import { RenderingBridge } from './core/rendering/rendering-bridge.js';
import { mat4 } from 'gl-matrix'; // gl-matrixライブラリをインポート

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

function rgbaToHex(r, g, b) {
    return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
}

class Layer {
    constructor(name, width, height) {
        this.name = name;
        this.visible = true;
        this.opacity = 100;
        this.blendMode = 'normal';
        this.imageData = new ImageData(width, height);
        this.transform = { x: 0, y: 0, scale: 1, rotation: 0, flipX: 1, flipY: 1 };
        this.originalImageData = null;
        this.gpuDirty = true; // GPUテクスチャが更新を必要とするか
        this.modelMatrix = mat4.create(); // 初期状態は単位行列
    }
}

class LayerManager {
    constructor(app) {
        this.app = app;
        this.layers = [];
        this.currentLayerIndex = -1;
    }

    setupInitialLayers() {
        const initialLayer = new Layer('Layer 1', this.app.canvasManager.width, this.app.canvasManager.height);
        this.addLayer(initialLayer);
        this.setCurrentLayer(0);
    }

    addLayer(layer) {
        this.layers.push(layer);
        this.currentLayerIndex = this.layers.length - 1;
        this.app.layerUIManager.updateLayerList();
        this.app.canvasManager.renderAllLayers();
    }

    removeLayer(index) {
        if (this.layers.length > 1 && index >= 0 && index < this.layers.length) {
            this.layers.splice(index, 1);
            if (this.currentLayerIndex >= this.layers.length) {
                this.currentLayerIndex = this.layers.length - 1;
            }
            this.app.layerUIManager.updateLayerList();
            this.app.canvasManager.renderAllLayers();
        } else if (this.layers.length === 1) {
            alert("最低1つのレイヤーが必要です。");
        }
    }

    moveLayer(fromIndex, toIndex) {
        if (fromIndex < 0 || fromIndex >= this.layers.length ||
            toIndex < 0 || toIndex >= this.layers.length ||
            fromIndex === toIndex) {
            return;
        }
        const [movedLayer] = this.layers.splice(fromIndex, 1);
        this.layers.splice(toIndex, 0, movedLayer);
        this.currentLayerIndex = toIndex; // 移動後のレイヤーを選択状態にする
        this.app.layerUIManager.updateLayerList();
        this.app.canvasManager.renderAllLayers();
    }

    setCurrentLayer(index) {
        if (index >= 0 && index < this.layers.length) {
            this.currentLayerIndex = index;
            this.app.layerUIManager.updateLayerList();
            // レイヤー変更時に、CanvasManagerに現在のレイヤーを通知したり、再描画したりする
            this.app.canvasManager.renderAllLayers();
        }
    }

    getCurrentLayer() {
        return this.layers[this.currentLayerIndex];
    }

    getLayers() {
        return this.layers;
    }

    duplicateLayer(index) {
        if (index >= 0 && index < this.layers.length) {
            const originalLayer = this.layers[index];
            const duplicatedLayer = new Layer(`${originalLayer.name} (Copy)`, originalLayer.imageData.width, originalLayer.imageData.height);
            // ImageDataをディープコピー
            duplicatedLayer.imageData = new ImageData(
                new Uint8ClampedArray(originalLayer.imageData.data),
                originalLayer.imageData.width,
                originalLayer.imageData.height
            );
            duplicatedLayer.visible = originalLayer.visible;
            duplicatedLayer.opacity = originalLayer.opacity;
            duplicatedLayer.blendMode = originalLayer.blendMode;
            // modelMatrixもコピー
            mat4.copy(duplicatedLayer.modelMatrix, originalLayer.modelMatrix);

            this.layers.splice(index + 1, 0, duplicatedLayer);
            this.setCurrentLayer(index + 1);
            this.app.layerUIManager.updateLayerList();
            this.app.canvasManager.renderAllLayers();
        }
    }
}

class PenSettingsManager {
    constructor(app) {
        this.app = app;
        this.size = 5;
        this.opacity = 100;
        this.hardness = 50; // 0-100
        this.blendMode = 'normal';
        this.updateUI();
    }

    setSize(newSize) {
        this.size = Math.max(1, Math.min(200, newSize));
        this.updateUI();
    }

    setOpacity(newOpacity) {
        this.opacity = Math.max(0, Math.min(100, newOpacity));
        this.updateUI();
    }

    setHardness(newHardness) {
        this.hardness = Math.max(0, Math.min(100, newHardness));
        this.updateUI();
    }

    setBlendMode(newBlendMode) {
        this.blendMode = newBlendMode;
        this.updateUI();
    }

    updateUI() {
        document.getElementById('pen-size-slider').value = this.size;
        document.getElementById('pen-size-value').textContent = this.size;
        document.getElementById('pen-opacity-slider').value = this.opacity;
        document.getElementById('pen-opacity-value').textContent = this.opacity;
        document.getElementById('pen-hardness-slider').value = this.hardness;
        document.getElementById('pen-hardness-value').textContent = this.hardness;
        document.getElementById('blend-mode-select').value = this.blendMode;
    }
}

class ColorManager {
    constructor(app) {
        this.app = app;
        this.mainColor = '#000000';
        this.subColor = '#FFFFFF';
        this.currentColorTarget = 'main'; // 'main' or 'sub'
        this.initColorPickers();
    }

    initColorPickers() {
        const mainColorInput = document.getElementById('main-color-picker');
        const subColorInput = document.getElementById('sub-color-picker');
        const colorSwapButton = document.getElementById('color-swap');

        if (mainColorInput) {
            mainColorInput.value = this.mainColor;
            mainColorInput.addEventListener('input', (e) => this.setMainColor(e.target.value));
            mainColorInput.addEventListener('click', () => this.setCurrentColorTarget('main'));
        }
        if (subColorInput) {
            subColorInput.value = this.subColor;
            subColorInput.addEventListener('input', (e) => this.setSubColor(e.target.value));
            subColorInput.addEventListener('click', () => this.setCurrentColorTarget('sub'));
        }
        if (colorSwapButton) {
            colorSwapButton.addEventListener('click', () => this.swapColors());
        }

        this.updateColorPickerUI();
    }

    setMainColor(hex) {
        this.mainColor = hex;
        this.updateColorPickerUI();
        this.app.canvasManager.renderAllLayers(); // 色変更時に再描画が必要な場合
    }

    setSubColor(hex) {
        this.subColor = hex;
        this.updateColorPickerUI();
        this.app.canvasManager.renderAllLayers(); // 色変更時に再描画が必要な場合
    }

    setCurrentColorTarget(target) {
        this.currentColorTarget = target;
        this.updateColorPickerUI();
    }

    getCurrentColor() {
        return this.currentColorTarget === 'main' ? this.mainColor : this.subColor;
    }

    swapColors() {
        [this.mainColor, this.subColor] = [this.subColor, this.mainColor];
        this.updateColorPickerUI();
    }

    updateColorPickerUI() {
        const mainColorInput = document.getElementById('main-color-picker');
        const subColorInput = document.getElementById('sub-color-picker');
        const mainColorDisplay = document.getElementById('main-color-display');
        const subColorDisplay = document.getElementById('sub-color-display');

        if (mainColorInput) mainColorInput.value = this.mainColor;
        if (subColorInput) subColorInput.value = this.subColor;
        if (mainColorDisplay) {
            mainColorDisplay.style.backgroundColor = this.mainColor;
            mainColorDisplay.classList.toggle('active', this.currentColorTarget === 'main');
        }
        if (subColorDisplay) {
            subColorDisplay.style.backgroundColor = this.subColor;
            subColorDisplay.classList.toggle('active', this.currentColorTarget === 'sub');
        }
    }
}

class CanvasManager {
    constructor(app) {
        this.app = app;
        this.displayCanvas = document.getElementById('drawingCanvas');
        this.ctx = this.displayCanvas.getContext('2d', { willReadFrequently: true });
        this.width = this.displayCanvas.width;
        this.height = this.displayCanvas.height;
        this.renderingBridge = new RenderingBridge(this.displayCanvas);
        this.currentTool = 'pen'; // 現在選択されているツール
        this.isDrawing = false;
        this.lastPoint = null;
        this.lastPressure = 1.0;
        this.strokePoints = [];
        this.path2D = new Path2D(); // Path2Dオブジェクトの追加

        this.canvasArea = document.getElementById('canvasArea'); // 親要素を取得
        this.bufferCanvas = document.createElement('canvas'); // レイヤー描画用の一時バッファ
        this.bufferCanvas.width = this.width;
        this.bufferCanvas.height = this.height;
        this.bufferCtx = this.bufferCanvas.getContext('2d', { willReadFrequently: true });

        // カメラの視点変換行列
        this.viewTransform = { scale: 1, rotation: 0, flipX: 1, flipY: 1, left: 0, top: 0 };
        // カメラの初期設定
        this.camera = {
            x: this.width / 2,
            y: this.height / 2,
            scale: 1,
        };

        this.bindEvents();
    }

    setCurrentTool(tool) {
        this.currentTool = tool;
    }

    renderAllLayers() {
        const layers = this.app.layerManager.getLayers();
        if (layers.length === 0) {
            this.renderingBridge.clear(this.width, this.height);
            return;
        }

        // WebGLエンジンが利用可能かつアクティブな場合
        if (this.renderingBridge.getEngineType() === 'webgl') {
            const glEngine = this.renderingBridge.getEngine();
            if (glEngine) {
                // 各レイヤーのテクスチャを更新（ImageDataが更新されたレイヤーのみ）
                layers.forEach(layer => {
                    if (layer.gpuDirty) {
                        glEngine.updateLayerTexture(layer);
                        layer.gpuDirty = false; // 更新後フラグをリセット
                    }
                });
                // 全レイヤーを合成してディスプレイに描画
                glEngine.compositeLayers(layers, this.width, this.height, this.camera);
            }
        } else {
            // Canvas2Dの場合 (既存の描画ロジック)
            this.ctx.clearRect(0, 0, this.width, this.height);
            layers.forEach(layer => {
                if (layer.visible) {
                    this.ctx.globalAlpha = layer.opacity / 100;
                    this.ctx.globalCompositeOperation = layer.blendMode;
                    this.ctx.drawImage(layer.imageData.canvas ? layer.imageData.canvas : this._createImageBitmapFromImageData(layer.imageData), 0, 0);
                }
            });
            this.ctx.globalAlpha = 1.0; // リセット
            this.ctx.globalCompositeOperation = 'source-over'; // リセット
        }
    }

    _createImageBitmapFromImageData(imageData) {
        // ImageDataから直接ImageBitmapを作成し、描画に使用する（パフォーマンスのため）
        // オフスクリーンCanvasを使わない場合
        if (typeof createImageBitmap === 'function') {
            return createImageBitmap(imageData);
        } else {
            // フォールバック: 一時的なCanvas要素を使用
            const canvas = document.createElement('canvas');
            canvas.width = imageData.width;
            canvas.height = imageData.height;
            const ctx = canvas.getContext('2d');
            ctx.putImageData(imageData, 0, 0);
            return canvas;
        }
    }

    applyStrokeToCurrentLayer(strokePoints, penSettings, color, isEraser = false) {
        const currentLayer = this.app.layerManager.getCurrentLayer();
        if (!currentLayer) return;

        const penColor = hexToRgba(color);
        penColor.a = Math.round(penSettings.opacity * 2.55); // 0-255

        // WebGLエンジンが利用可能かつアクティブな場合
        if (this.renderingBridge.getEngineType() === 'webgl') {
            const glEngine = this.renderingBridge.getEngine();
            if (glEngine) {
                // ストロークポイントをWebGL座標系に変換してブラシ描画
                glEngine.drawBrush(
                    currentLayer,
                    strokePoints,
                    {
                        color: [penColor.r / 255, penColor.g / 255, penColor.b / 255, penColor.a / 255],
                        radius: penSettings.size / 2, // 半径として渡す
                        hardness: penSettings.hardness / 100,
                        isEraser: isEraser
                    },
                    this.camera
                );
                currentLayer.gpuDirty = true; // GPUテクスチャが更新されたことをマーク
                this.renderAllLayers(); // 描画後に再レンダリング
            }
        } else {
            // Canvas2Dの場合 (既存の描画ロジック)
            this.bufferCtx.clearRect(0, 0, this.width, this.height); // バッファをクリア

            this.bufferCtx.lineCap = 'round';
            this.bufferCtx.lineJoin = 'round';
            this.bufferCtx.strokeStyle = `rgba(${penColor.r}, ${penColor.g}, ${penColor.b}, ${penColor.a / 255})`;
            this.bufferCtx.fillStyle = `rgba(${penColor.r}, ${penColor.g}, ${penColor.b}, ${penColor.a / 255})`;
            this.bufferCtx.lineWidth = penSettings.size;
            this.bufferCtx.globalCompositeOperation = isEraser ? 'destination-out' : 'source-over';

            if (strokePoints.length === 1) {
                // 点の場合
                const p = strokePoints[0];
                this.bufferCtx.beginPath();
                this.bufferCtx.arc(p.x, p.y, penSettings.size / 2, 0, Math.PI * 2);
                this.bufferCtx.fill();
            } else {
                this.bufferCtx.beginPath();
                this.bufferCtx.moveTo(strokePoints[0].x, strokePoints[0].y);
                for (let i = 1; i < strokePoints.length; i++) {
                    const p = strokePoints[i];
                    this.bufferCtx.lineTo(p.x, p.y);
                }
                this.bufferCtx.stroke();
            }

            // バッファの内容を現在のレイヤーのImageDataに合成
            this.bufferCtx.globalCompositeOperation = 'source-over'; // リセット
            const layerData = currentLayer.imageData;
            const bufferData = this.bufferCtx.getImageData(0, 0, this.width, this.height);

            for (let i = 0; i < layerData.data.length; i += 4) {
                if (bufferData.data[i + 3] > 0) { // バッファに描画されたピクセルのみを処理
                    if (isEraser) {
                        layerData.data[i + 0] = 0;
                        layerData.data[i + 1] = 0;
                        layerData.data[i + 2] = 0;
                        layerData.data[i + 3] = 0;
                    } else {
                        layerData.data[i + 0] = bufferData.data[i + 0];
                        layerData.data[i + 1] = bufferData.data[i + 1];
                        layerData.data[i + 2] = bufferData.data[i + 2];
                        layerData.data[i + 3] = bufferData.data[i + 3];
                    }
                }
            }
            this.renderAllLayers(); // 描画後に再レンダリング
        }
    }

    fillCurrentLayer(color) {
        const currentLayer = this.app.layerManager.getCurrentLayer();
        if (!currentLayer) return;

        const fillColor = hexToRgba(color);
        const data = currentLayer.imageData.data;
        for (let i = 0; i < data.length; i += 4) {
            data[i] = fillColor.r;
            data[i + 1] = fillColor.g;
            data[i + 2] = fillColor.b;
            data[i + 3] = fillColor.a;
        }
        currentLayer.gpuDirty = true; // GPUテクスチャが更新されたことをマーク
        this.renderAllLayers();
    }

    exportMergedImage() {
        const mergedCanvas = document.createElement('canvas');
        mergedCanvas.width = this.width;
        mergedCanvas.height = this.height;
        const mergedCtx = mergedCanvas.getContext('2d');

        const layers = this.app.layerManager.getLayers();

        // WebGLエンジンで合成した結果をエクスポート
        if (this.renderingBridge.getEngineType() === 'webgl') {
            const glEngine = this.renderingBridge.getEngine();
            if (glEngine) {
                // まずGLへ全レイヤーを合成したテクスチャをレンダリング
                glEngine.compositeLayers(layers, this.width, this.height, this.camera);
                // その結果をImageDataとして取得
                const imageData = glEngine.getCurrentFrameBufferData(this.width, this.height);
                if (imageData) {
                    mergedCtx.putImageData(imageData, 0, 0);
                } else {
                    console.error("Failed to get merged image data from WebGL.");
                    return;
                }
            }
        } else {
            // Canvas2Dの場合（既存ロジック）
            layers.forEach(layer => {
                if (layer.visible) {
                    mergedCtx.globalAlpha = layer.opacity / 100;
                    mergedCtx.globalCompositeOperation = layer.blendMode;
                    mergedCtx.drawImage(layer.imageData.canvas ? layer.imageData.canvas : this._createImageBitmapFromImageData(layer.imageData), 0, 0);
                }
            });
        }
        mergedCtx.globalAlpha = 1.0;
        mergedCtx.globalCompositeOperation = 'source-over';

        const dataURL = mergedCanvas.toDataURL('image/png');
        const link = document.createElement('a');
        link.href = dataURL;
        link.download = 'merged_image.png';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }

    // CanvasManager内でUIイベントと連携する例を更新
    bindEvents() {
        this.canvasArea.addEventListener('pointerdown', this.onPointerDown.bind(this));
        document.addEventListener('pointermove', this.onPointerMove.bind(this));
        document.addEventListener('pointerup', this.onPointerUp.bind(this));
        this.canvasArea.addEventListener('wheel', this.handleWheel.bind(this), { passive: false });
        document.addEventListener('contextmenu', e => e.preventDefault());
        document.getElementById('saveMergedButton')?.addEventListener('click', () => this.exportMergedImage());

        let draggingLayer = false;
        let lastMouse = null;

        // レイヤー移動用のマウスイベントリスナー
        this.displayCanvas.addEventListener('mousedown', (e) => {
            // 左クリックかつ移動ツールが選択されている場合のみ反応
            if (e.button !== 0 || this.app.toolManager.currentTool !== 'move') return;
            const activeLayer = this.app.layerManager.getCurrentLayer();
            if (!activeLayer) return;

            lastMouse = { x: e.clientX, y: e.clientY };
            draggingLayer = true;
            e.preventDefault(); // デフォルトのドラッグ動作を防止
        });

        this.displayCanvas.addEventListener('mousemove', (e) => {
            if (!draggingLayer || !lastMouse || this.app.toolManager.currentTool !== 'move') return;
            const activeLayer = this.app.layerManager.getCurrentLayer();
            if (!activeLayer) return;

            // マウスのピクセル移動量をWebGLのワールド座標系の移動量に変換
            // WebGLのNDC (Normalized Device Coordinates) に合わせるため、キャンバスサイズで正規化し、2倍する
            // カメラのスケールも考慮に入れる
            const dx = (e.clientX - lastMouse.x) / this.displayCanvas.width * 2 / this.camera.scale;
            const dy = (e.clientY - lastMouse.y) / this.displayCanvas.height * 2 / this.camera.scale;
            
            // Y軸の向きを合わせるために-dyとする (UIのY軸は下向き、WebGLのY軸は通常上向き)
            this.moveLayer(activeLayer, dx, -dy);
            lastMouse = { x: e.clientX, y: e.clientY };
        });

        this.displayCanvas.addEventListener('mouseup', () => {
            draggingLayer = false;
            lastMouse = null;
        });
    }

    onPointerDown(e) {
        this.isDrawing = true;
        const currentTool = this.app.toolManager.currentTool;
        const { offsetX, offsetY } = e;
        const pressure = e.pressure !== undefined ? e.pressure : 1.0;
        this.lastPoint = { x: offsetX, y: offsetY };
        this.lastPressure = pressure;
        this.strokePoints = [{ x: offsetX, y: offsetY, pressure: pressure }];

        if (currentTool === 'pen' || currentTool === 'eraser') {
            const color = this.app.colorManager.getCurrentColor();
            const penSettings = this.app.penSettingsManager;
            this.applyStrokeToCurrentLayer(this.strokePoints, penSettings, color, currentTool === 'eraser');
        } else if (currentTool === 'bucket') {
            const color = this.app.colorManager.getCurrentColor();
            this.fillCurrentLayer(color);
        }
    }

    onPointerMove(e) {
        if (!this.isDrawing) return;
        if (this.app.toolManager.currentTool === 'move') return; // 移動ツール中はペン描画を行わない

        const { offsetX, offsetY } = e;
        const pressure = e.pressure !== undefined ? e.pressure : 1.0;

        // 筆圧の閾値調整
        let effectivePressure = pressure;
        if (effectivePressure < 0.05) { // 非常に弱い筆圧は0として扱う
            effectivePressure = 0.0;
        } else if (effectivePressure < 0.1) { // 0.05から0.1の間は線形補間
            effectivePressure = (effectivePressure - 0.05) * 2;
        }

        const currentPoint = { x: offsetX, y: offsetY, pressure: effectivePressure };

        if (this.lastPoint && (Math.abs(currentPoint.x - this.lastPoint.x) > 0 || Math.abs(currentPoint.y - this.lastPoint.y) > 0)) {
            // Path2Dに追加
            if (this.strokePoints.length === 1) {
                this.path2D = new Path2D(); // 新しいストロークの開始
                this.path2D.moveTo(this.strokePoints[0].x, this.strokePoints[0].y);
            }
            this.path2D.lineTo(currentPoint.x, currentPoint.y);

            this.strokePoints.push(currentPoint);
            this.lastPoint = currentPoint;
            this.lastPressure = effectivePressure;

            const color = this.app.colorManager.getCurrentColor();
            const penSettings = this.app.penSettingsManager;
            this.applyStrokeToCurrentLayer(this.strokePoints, penSettings, color, this.app.toolManager.currentTool === 'eraser');
        }
    }

    onPointerUp() {
        this.isDrawing = false;
        this.lastPoint = null;
        this.strokePoints = []; // ストロークをリセット
        this.path2D = new Path2D(); // Path2Dもリセット
        this.renderAllLayers(); // 描画確定後に最終レンダリング
    }

    handleWheel(e) {
        e.preventDefault(); // ページのスクロールを防止

        const scaleAmount = 0.1;
        const zoomFactor = e.deltaY < 0 ? (1 + scaleAmount) : (1 - scaleAmount);

        // カーソル位置を基準にズーム
        const mouseX = e.offsetX;
        const mouseY = e.offsetY;

        // まず、現在のカメラ位置を考慮したワールド座標を計算
        const worldX = (mouseX - this.width / 2) / this.camera.scale + this.camera.x;
        const worldY = (mouseY - this.height / 2) / this.camera.scale + this.camera.y;

        // スケールを適用
        this.camera.scale *= zoomFactor;
        this.camera.scale = Math.max(0.1, Math.min(10, this.camera.scale)); // 最小・最大ズーム制限

        // 新しいカメラ位置を計算して、カーソルがワールド座標で同じ位置に留まるようにする
        this.camera.x = worldX - (mouseX - this.width / 2) / this.camera.scale;
        this.camera.y = worldY - (mouseY - this.height / 2) / this.camera.scale;

        this.renderAllLayers();
    }

    // マウスドラッグによるレイヤー移動を処理する関数
    moveLayer(layer, dx, dy) {
        if (!layer || !layer.modelMatrix) return;
        mat4.translate(layer.modelMatrix, layer.modelMatrix, [dx, dy, 0]);
        layer.gpuDirty = true;
        this.renderAllLayers(); // レイヤー移動後に再描画を要求
    }
}

class ToolManager {
    constructor(app) {
        this.app = app;
        this.currentTool = 'pen'; // 初期ツール
        this.initToolButtons();
    }

    initToolButtons() {
        document.getElementById('pen-tool').addEventListener('click', () => this.setTool('pen'));
        document.getElementById('eraser-tool').addEventListener('click', () => this.setTool('eraser'));
        document.getElementById('bucket-tool').addEventListener('click', () => this.setTool('bucket'));
        document.getElementById('move-tool').addEventListener('click', () => this.setTool('move'));
    }

    setTool(tool) {
        this.currentTool = tool;
        document.querySelectorAll('.left-toolbar .tool-btn').forEach(btn => btn.classList.remove('active'));
        document.getElementById(tool + '-tool')?.classList.add('active');
        this.app.canvasManager.setCurrentTool(tool);
    }
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
        this.bucketTool = new BucketTool(this); // Assuming BucketTool exists and is correctly imported/defined
        this.shortcutManager.initialize();
        this.layerManager.setupInitialLayers();
        this.toolManager.setTool('pen');
        this.penSettingsManager.setSize(1);
        this.colorManager.setColor(this.colorManager.mainColor);
    }
}

window.addEventListener('DOMContentLoaded', () => {
    if (!window.toshinkaTegakiInitialized) {
        window.toshinkaTegakiTool = new ToshinkaTegakiTool();
        window.toshinkaTegakiInitialized = true;
        console.log("ToshinkaTegakiTool initialized.");
    }
});