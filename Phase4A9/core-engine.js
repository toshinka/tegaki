/*
 * ===================================================================================
 * Toshinka Tegaki Tool - Core Engine
 * Version: 2.8.0 (Phase4A9: WebGL Layer Transform)
 *
 * - 修正：
 * - Phase4A9対応：WebGL描画におけるレイヤー移動機能を実装。
 * - 1. MVP行列(Model-View-Projection)の導入と管理:
 * -   - `projectionMatrix`: Y軸反転を含む正射影行列を管理。
 * -   - `viewMatrix`: カメラのパン・ズームを反映するビュー行列を管理。
 * -   - `modelMatrix`: 各レイヤーの移動・回転・拡縮を保持。
 * - 2. 座標系の分離:
 * -   - `convertCanvasToLayerCoords`: ユーザーの入力を`viewMatrix`のみでワールド座標に変換。
 * -     これにより、レイヤーの移動状態に関わらず、ペン先の位置が固定される。
 * - 3. レイヤー移動UIの刷新:
 * -   - マウスドラッグによる移動量をワールド座標系で計算し、レイヤーの`modelMatrix`に直接反映。
 * -     表示のみが移動し、描画の当たり判定には影響を与えない構造を実現。
 * ===================================================================================
 */

// --- Module Imports ---
import { TopBarManager, LayerUIManager } from './ui/ui-manager.js';
import { ShortcutManager } from './ui/shortcut-manager.js';
import { BucketTool } from './tools/toolset.js';
import { RenderingBridge } from './core/rendering/rendering-bridge.js';
import { mat4, vec2, vec4 } from 'gl-matrix'; // gl-matrixライブラリをインポート

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
        this.gpuDirty = true; // GPUテクスチャが更新を必要とするか
        
        // modelMatrix: レイヤーのローカル座標 -> ワールド座標への変換行列
        this.modelMatrix = mat4.create();
        // 初期状態でレイヤーのサイズを反映させておく
        // これにより、原点が中心(-0.5, 0.5)でサイズが1x1のユニットクワッドが、
        // レイヤーのピクセルサイズにスケーリングされる
        mat4.scale(this.modelMatrix, this.modelMatrix, [width, height, 1]);
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
    }

    setSubColor(hex) {
        this.subColor = hex;
        this.updateColorPickerUI();
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
        // displayCanvasは2Dフォールバック用とイベント取得用に保持するが、
        // WebGL描画はrenderingBridgeが管理する別キャンバスで行う
        this.displayCanvas = document.getElementById('drawingCanvas');
        this.ctx = this.displayCanvas.getContext('2d', { willReadFrequently: true });
        this.width = this.displayCanvas.width;
        this.height = this.displayCanvas.height;
        this.renderingBridge = new RenderingBridge(this.displayCanvas);
        this.isDrawing = false;
        this.lastPoint = null; // ワールド座標での最後の点
        this.strokePoints = []; // ワールド座標でのストローク

        this.canvasArea = document.getElementById('canvasArea');

        // カメラ設定 (ワールド座標系)
        this.camera = { x: 0, y: 0, scale: 1 };

        // MVP行列
        this.projectionMatrix = mat4.create();
        this.viewMatrix = mat4.create();

        this.updateProjectionMatrix();
        this.updateViewMatrix();
        this.bindEvents();
    }

    updateProjectionMatrix() {
        // WebGLクリップ空間(-1~1)に合わせる正射影
        // アスペクト比を考慮
        const aspectRatio = this.width / this.height;
        mat4.ortho(this.projectionMatrix, -aspectRatio, aspectRatio, -1, 1, -1, 1);
        // WebGL(Y軸上向き)とUI(Y軸下向き)の座標系を統一するためY軸を反転
        mat4.scale(this.projectionMatrix, this.projectionMatrix, [1, -1, 1]);
    }

    updateViewMatrix() {
        mat4.identity(this.viewMatrix);
        mat4.scale(this.viewMatrix, this.viewMatrix, [this.camera.scale, this.camera.scale, 1]);
        mat4.translate(this.viewMatrix, this.viewMatrix, [-this.camera.x, -this.camera.y, 0]);
    }

    convertCanvasToWorldCoords(x, y) {
        // 1. キャンバス座標 (ピクセル) をNDC (正規化デバイス座標, -1 to 1) に変換
        const nx = (2 * x) / this.width - 1;
        const ny = 1 - (2 * y) / this.height; // Y軸は下向きが正なので反転

        // 2. viewMatrixの逆行列を使って、NDCをワールド座標に変換
        const invView = mat4.create();
        if (!mat4.invert(invView, this.viewMatrix)) return null;

        // 3. projectionMatrixの逆行列も必要
        const invProj = mat4.create();
        if (!mat4.invert(invProj, this.projectionMatrix)) return null;

        const clipPos = vec4.fromValues(nx, ny, 0, 1);
        vec4.transformMat4(clipPos, clipPos, invProj);
        vec4.transformMat4(clipPos, clipPos, invView);

        return { x: clipPos[0], y: clipPos[1] };
    }


    setCurrentTool(tool) {
        this.app.toolManager.currentTool = tool; // ToolManager側に状態を持たせる
    }

    renderAllLayers() {
        const layers = this.app.layerManager.getLayers();
        if (!this.renderingBridge.getEngine()) return;

        this.updateViewMatrix(); // 毎フレームViewMatrixを更新

        // WebGLエンジンが利用可能かつアクティブな場合
        if (this.renderingBridge.getEngineType() === 'webgl') {
            const glEngine = this.renderingBridge.getEngine();
            layers.forEach(layer => {
                if (layer.gpuDirty) {
                    glEngine.updateLayerTexture(layer);
                    layer.gpuDirty = false;
                }
            });
            // 行列を渡して合成描画を依頼
            glEngine.compositeLayers(layers, this.width, this.height, this.viewMatrix, this.projectionMatrix);
        } else {
            // (省略) Canvas2Dのフォールバックロジック
        }
    }

    applyStrokeToCurrentLayer(strokePoints, penSettings, color, isEraser = false) {
        const currentLayer = this.app.layerManager.getCurrentLayer();
        if (!currentLayer) return;

        const penColor = hexToRgba(color);

        if (this.renderingBridge.getEngineType() === 'webgl') {
            const glEngine = this.renderingBridge.getEngine();
            if (glEngine) {
                // ワールド座標のストロークをそのまま渡す
                glEngine.drawBrush(
                    currentLayer,
                    strokePoints,
                    {
                        color: [penColor.r / 255, penColor.g / 255, penColor.b / 255, (penSettings.opacity / 100)],
                        radius: penSettings.size, // ワールド単位での半径
                        hardness: penSettings.hardness / 100,
                        isEraser: isEraser
                    }
                );
                currentLayer.gpuDirty = true;
                this.renderAllLayers();
            }
        } else {
            // (省略) Canvas2Dのフォールバックロジック
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
        currentLayer.gpuDirty = true;
        this.renderAllLayers();
    }
    
    exportMergedImage() {
        // この関数は現在WebGLの最新の描画状態を正しく反映しない可能性があるため、
        // 必要に応じて改修が必要です。
        console.warn("exportMergedImage may not reflect the latest WebGL state correctly.");
    }


    bindEvents() {
        // イベントリスナーに使用するキャンバスを決定 (WebGLが有効ならそのキャンバス)
        const eventCanvas = this.renderingBridge.getEngine()?.canvas || this.displayCanvas;

        eventCanvas.addEventListener('pointerdown', this.onPointerDown.bind(this));
        document.addEventListener('pointermove', this.onPointerMove.bind(this));
        document.addEventListener('pointerup', this.onPointerUp.bind(this));
        eventCanvas.addEventListener('wheel', this.handleWheel.bind(this), { passive: false });
        document.addEventListener('contextmenu', e => e.preventDefault());
        document.getElementById('saveMergedButton')?.addEventListener('click', () => this.exportMergedImage());
        
        let lastMouse = null; // レイヤー移動用の最後のマウス座標

        eventCanvas.addEventListener('pointerdown', (e) => {
            // 中ボタン(ホイール)クリックまたはスペースキー押下中の左クリックで視点移動
            if (e.button === 1 || (e.button === 0 && e.altKey)) { // Alt+LeftClick for panning
                 lastMouse = { x: e.clientX, y: e.clientY };
                 e.preventDefault();
                 return;
            }

            // 移動ツールが選択されている場合
            if (this.app.toolManager.currentTool === 'move' && e.button === 0) {
                lastMouse = { x: e.clientX, y: e.clientY };
                e.preventDefault();
            }
        });

        document.addEventListener('pointermove', (e) => {
            if (!lastMouse) return;

            const dx = e.clientX - lastMouse.x;
            const dy = e.clientY - lastMouse.y;
            lastMouse = { x: e.clientX, y: e.clientY };

            // 視点移動
            if (e.buttons === 4 || (e.buttons === 1 && e.altKey)) { // Middle button or Alt+LeftClick
                 this.camera.x -= dx / this.camera.scale;
                 this.camera.y -= dy / this.camera.scale;
                 this.renderAllLayers();
                 return;
            }

            // レイヤー移動
            if (this.app.toolManager.currentTool === 'move' && e.buttons === 1) {
                const activeLayer = this.app.layerManager.getCurrentLayer();
                if (!activeLayer) return;

                // マウスのスクリーン移動量を、ワールド座標系での移動量に変換
                // カメラのスケールを考慮
                const worldDx = dx / this.camera.scale * (this.width / this.height);
                const worldDy = dy / this.camera.scale;

                this.moveLayer(activeLayer, worldDx, -worldDy); // Y軸の向きを合わせる
            }
        });

        document.addEventListener('pointerup', () => {
            lastMouse = null;
            if (this.isDrawing) {
               this.onPointerUp();
            }
        });
    }

    onPointerDown(e) {
        // 左クリック以外、または描画ツール以外の場合は何もしない
        if (e.button !== 0 || (this.app.toolManager.currentTool !== 'pen' && this.app.toolManager.currentTool !== 'eraser' && this.app.toolManager.currentTool !== 'bucket')) {
            return;
        }

        this.isDrawing = true;
        const worldPos = this.convertCanvasToWorldCoords(e.offsetX, e.offsetY);
        if (!worldPos) return;

        const pressure = e.pressure !== undefined ? e.pressure : 1.0;
        this.lastPoint = { x: worldPos.x, y: worldPos.y, pressure };
        this.strokePoints = [this.lastPoint];

        const currentTool = this.app.toolManager.currentTool;
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

        const worldPos = this.convertCanvasToWorldCoords(e.offsetX, e.offsetY);
        if (!worldPos) return;

        const pressure = e.pressure !== undefined ? e.pressure : 1.0;
        const currentPoint = { x: worldPos.x, y: worldPos.y, pressure };
        
        this.strokePoints.push(currentPoint);
        this.lastPoint = currentPoint;

        const color = this.app.colorManager.getCurrentColor();
        const penSettings = this.app.penSettingsManager;
        this.applyStrokeToCurrentLayer(this.strokePoints, penSettings, color, this.app.toolManager.currentTool === 'eraser');
        this.strokePoints = [currentPoint]; // 連続描画のために最後の点のみ残す
    }

    onPointerUp() {
        if (!this.isDrawing) return;
        this.isDrawing = false;
        this.lastPoint = null;
        this.strokePoints = [];
        this.renderAllLayers(); // 描画確定後に最終レンダリング
    }

    handleWheel(e) {
        e.preventDefault();

        const scaleAmount = 1.1;
        const zoomFactor = e.deltaY < 0 ? scaleAmount : 1 / scaleAmount;
        
        const mouseWorldPos = this.convertCanvasToWorldCoords(e.offsetX, e.offsetY);
        if(!mouseWorldPos) return;

        this.camera.scale *= zoomFactor;
        this.camera.scale = Math.max(0.1, Math.min(20, this.camera.scale));

        const newMouseWorldPos = this.convertCanvasToWorldCoords(e.offsetX, e.offsetY);
        if(!newMouseWorldPos) return;
        
        this.camera.x += (mouseWorldPos.x - newMouseWorldPos.x);
        this.camera.y += (mouseWorldPos.y - newMouseWorldPos.y);

        this.renderAllLayers();
    }
    
    moveLayer(layer, dx, dy) {
        if (!layer) return;
        // modelMatrixに平行移動を追加
        mat4.translate(layer.modelMatrix, layer.modelMatrix, [dx, dy, 0]);
        layer.gpuDirty = true; // 行列が変わったのでテクスチャは同じでも再描画が必要
        this.renderAllLayers();
    }
}

class ToolManager {
    constructor(app) {
        this.app = app;
        this.currentTool = 'pen';
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
        
        const eventCanvas = this.app.canvasManager.renderingBridge.getEngine()?.canvas || this.app.canvasManager.displayCanvas;
        if(tool === 'move' || e.altKey) {
            eventCanvas.style.cursor = 'grab';
        } else if (tool === 'pen' || tool === 'eraser') {
            eventCanvas.style.cursor = 'crosshair';
        } else {
            eventCanvas.style.cursor = 'default';
        }
    }
}

class ToshinkaTegakiTool {
    constructor() {
        this.initManagers();
    }
    initManagers() {
        this.toolManager = new ToolManager(this); // CanvasManagerより先に初期化
        this.canvasManager = new CanvasManager(this);
        this.layerManager = new LayerManager(this);
        this.penSettingsManager = new PenSettingsManager(this);
        this.colorManager = new ColorManager(this);
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
        window.toshinkaTegakiTool = new ToshinkaTegakiTool();
        window.toshinkaTegakiInitialized = true;
        console.log("ToshinkaTegakiTool initialized.");
    }
});