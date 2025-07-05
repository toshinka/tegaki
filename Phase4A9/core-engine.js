// core-engine.js
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
import * as TransformUtils from './core/utils/transform-utils.js'; // Import transform-utils.js

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
        // this.transform = { x: 0, y: 0, scale: 1, rotation: 0, flipX: 1, flipY: 1 }; // 削除またはコメントアウト
        this.modelMatrix = TransformUtils.create(); [cite_start]// modelMatrixを導入 [cite: 1, 2]
        this.originalImageData = null;
        this.gpuDirty = true; // GPUテクスチャが更新を必要とするか
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
        // displayCanvasはポインタイベントの座標計算と、Canvas2Dフォールバック用に保持
        this.displayCanvas = document.getElementById('drawingCanvas');
        this.displayCtx = this.displayCanvas.getContext('2d', { willReadFrequently: true });
        this.canvasArea = document.getElementById('canvas-area');
        this.canvasContainer = document.getElementById('canvas-container');
        this.width = this.displayCanvas.width;
        this.height = this.displayCanvas.height;

        this.renderingBridge = new RenderingBridge(this.displayCanvas);

        // compositionDataは主にPNGエクスポートやCanvas2Dモードで使用
        this.compositionData = new ImageData(this.width, this.height);
        this.isDrawing = false; this.isPanning = false; this.isSpaceDown = false;

        this.isVDown = false; this.isShiftDown = false;

        this.isLayerTransforming = false;
        this.transformTargetLayer = null;
        // this.originalLayerTransform = null; // 削除またはコメントアウト
        this.originalModelMatrix = null; [cite_start]// 行列保存用 [cite: 1, 2]
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
        this._setupDatGui(); [cite_start]// dat.guiのセットアップ [cite: 1, 2]
    }

    _setupDatGui() {
        const gui = new dat.GUI();
        this.gui = gui; // GUIインスタンスを保持

        this.guiValues = {
            x: 0,
            y: 0,
            scale: 1.0,
            rotation: 0
        };

        const updateTransform = () => {
            const activeLayer = this.app.layerManager.getCurrentLayer();
            if (!activeLayer || activeLayer === this.app.layerManager.layers[0]) return; [cite_start]// 背景レイヤーは移動させない [cite: 1, 2]

            [cite_start]// まず行列をリセットし、GUIの現在の値で変換を適用 [cite: 1, 2]
            TransformUtils.reset(activeLayer.modelMatrix);
            TransformUtils.translate(activeLayer.modelMatrix, this.guiValues.x, this.guiValues.y);
            TransformUtils.rotate(activeLayer.modelMatrix, TransformUtils.degToRad(this.guiValues.rotation));
            TransformUtils.scale(activeLayer.modelMatrix, this.guiValues.scale, this.guiValues.scale);

            this.renderAllLayers(); [cite_start]// 変更を反映 [cite: 1, 2]
        };

        [cite_start]// GUIコントローラーを追加 [cite: 1, 2]
        gui.add(this.guiValues, 'x', -this.width / 2, this.width / 2).step(1).onChange(updateTransform);
        gui.add(this.guiValues, 'y', -this.height / 2, this.height / 2).step(1).onChange(updateTransform);
        gui.add(this.guiValues, 'scale', 0.1, 5.0).step(0.01).onChange(updateTransform);
        gui.add(this.guiValues, 'rotation', -180, 180).step(1).onChange(updateTransform);

        // GUIの値を現在のアクティブレイヤーに同期させる関数
        this.updateTransformGUI = () => {
            const activeLayer = this.app.layerManager.getCurrentLayer();
            if (activeLayer && activeLayer !== this.app.layerManager.layers[0]) {
                const { x, y } = TransformUtils.getTranslation(activeLayer.modelMatrix);
                // 仮でスケールと回転は未取得。必要に応じてTransformUtilsにgetterを追加
                this.guiValues.x = x;
                this.guiValues.y = y;
                // this.guiValues.scale = activeLayer.transform?.scale ?? 1.0;
                // this.guiValues.rotation = activeLayer.transform?.rotation ?? 0;
            } else {
                this.guiValues.x = 0;
                this.guiValues.y = 0;
                this.guiValues.scale = 1.0;
                this.guiValues.rotation = 0;
            }
            // GUIの表示を更新
            for (const i in gui.__controllers) {
                gui.__controllers[i].updateDisplay();
            }
        };

        // アクティブレイヤー切り替え時にもGUIを更新
        this.app.layerManager.onLayerSwitch = this.updateTransformGUI;
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
        if (e.button !== 0) return;

        const coords = this.getCanvasCoordinates(e);

        if (this.isVDown) {
            this.startLayerTransform(e);
            e.preventDefault(); return;
        }
        if (this.isSpaceDown) {
            this.dragStartX = e.clientX; this.dragStartY = e.clientY; this.isPanning = true;
            this.canvasStartX = this.viewTransform.left; this.canvasStartY = this.viewTransform.top;
            e.preventDefault(); return;
        }

        if (!coords) return;

        const activeLayer = this.app.layerManager.getCurrentLayer();
        if (!activeLayer || !activeLayer.visible) return;

        this._resetDirtyRect();

        if (this.currentTool === 'bucket') {
            this.app.bucketTool.fill(activeLayer.imageData, coords.x, coords.y, hexToRgba(this.currentColor));
            activeLayer.gpuDirty = true; // バケツツールはCPUでImageDataを直接変更するので、GPUに更新を通知
            this.renderAllLayers();
            this.saveState();
            return;
        }

        this.isDrawing = true;
        this.pressureHistory = [e.pressure > 0 ? e.pressure : 0.5]; // 0圧を回避
        this.lastPoint = { ...coords, pressure: this.pressureHistory[0] };

        const size = this.calculatePressureSize(this.currentSize, this.lastPoint.pressure);

        this._updateDirtyRect(coords.x, coords.y, size);

        this.renderingBridge.drawCircle(
            activeLayer,
            this.lastPoint.x, this.lastPoint.y,
            size,
            hexToRgba(this.currentColor),
            this.app.penSettingsManager.isEraserMode
        );
        this.renderAllLayers();
    }

    onPointerMove(e) {
        if (this.isLayerTransforming) {
            this.applyLayerTransformPreview(e); [cite_start]// レイヤー変形プレビュー [cite: 1, 2]
            return;
        }

        if (this.isPanning) {
            const dx = e.clientX - this.dragStartX;
            const dy = e.clientY - this.dragStartY;
            this.viewTransform.left = this.canvasStartX + dx;
            this.viewTransform.top = this.canvasStartY + dy;
            this._applyViewTransform();
            return;
        }

        if (!this.isDrawing) return;
        const activeLayer = this.app.layerManager.getCurrentLayer();
        if (!activeLayer || !activeLayer.visible) return;

        const currentPoint = this.getCanvasCoordinates(e);
        if (!currentPoint) return;

        this.pressureHistory.push(e.pressure > 0 ? e.pressure : 0.5);
        if (this.pressureHistory.length > this.maxPressureHistory) {
            this.pressureHistory.shift();
        }

        const size = this.calculatePressureSize(this.currentSize, this._getAveragePressure());

        // ダーティ矩形を更新
        this._updateDirtyRect(currentPoint.x, currentPoint.y, size);
        this._updateDirtyRect(this.lastPoint.x, this.lastPoint.y, size);

        this.renderingBridge.drawLine(
            activeLayer,
            this.lastPoint.x, this.lastPoint.y,
            currentPoint.x, currentPoint.y,
            size,
            hexToRgba(this.currentColor),
            this.app.penSettingsManager.isEraserMode,
            this.calculatePressureSize.bind(this) // 筆圧計算関数を渡す
        );
        this.renderAllLayers();

        this.lastPoint = { ...currentPoint, pressure: this._getAveragePressure() };
    }

    onPointerUp(e) {
        if (this.isLayerTransforming) {
            this.commitLayerTransform(); [cite_start]// レイヤー変形確定 [cite: 1, 2]
        }
        if (this.isDrawing) {
            this.isDrawing = false;
            if (this.animationFrameId) {
                cancelAnimationFrame(this.animationFrameId);
                this.animationFrameId = null;
            }
            // 描画の最後に最終レンダリングをかける
            this._renderDirty();
            const activeLayer = this.app.layerManager.getCurrentLayer();
            if (activeLayer) {
                // GPU上の描画結果をCPUのImageDataに同期する（次の描画や保存のため）
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

    _applyViewTransform() {
        // キャンバスのスタイルを更新して表示を調整
        const scale = this.viewTransform.scale;
        const translateX = this.viewTransform.left;
        const translateY = this.viewTransform.top;
        [cite_start]// Y軸反転はシェーダーで行うため、ここでは行わない [cite: 2]
        this.canvasContainer.style.transform = `translate(${translateX}px, ${translateY}px) scale(${scale})`;
        this.canvasContainer.style.transformOrigin = '0 0';
        this.renderAllLayers();
    }

    handleWheel(e) {
        e.preventDefault();
        const scaleAmount = -e.deltaY * 0.001; // ホイールの量に応じてスケール量を調整
        const oldScale = this.viewTransform.scale;
        let newScale = oldScale * (1 + scaleAmount);

        // 最小・最大スケール制限
        newScale = Math.max(0.1, Math.min(newScale, 10.0));

        // スケール変更の中心をマウス位置に合わせる
        const mouseX = e.clientX - this.canvasArea.getBoundingClientRect().left;
        const mouseY = e.clientY - this.canvasArea.getBoundingClientRect().top;

        this.viewTransform.left -= (mouseX / oldScale) * (newScale - oldScale);
        this.viewTransform.top -= (mouseY / oldScale) * (newScale - oldScale);
        this.viewTransform.scale = newScale;

        this._applyViewTransform();
    }

    // CanvasManagerクラス内に以下のメソッドを追加または修正
    getCanvasCoordinates(e) {
        try {
            const rect = this.displayCanvas.getBoundingClientRect();
            // イベントのクライアント座標を、表示スケールとパンを考慮してキャンバス内部座標に変換
            const clientX = e.clientX;
            const clientY = e.clientY;

            // コンテナのオフセットとスケールを考慮
            const containerRect = this.canvasContainer.getBoundingClientRect();
            const scale = this.viewTransform.scale;

            // マウスイベントの座標をキャンバスコンテナ内の相対座標に変換
            const xInContainer = clientX - containerRect.left;
            const yInContainer = clientY - containerRect.top;

            // コンテナのスケールを逆適用して、元のキャンバス座標空間での位置を取得
            let x = xInContainer / scale;
            let y = yInContainer / scale;

            // スクロールによるオフセットを考慮
            x -= this.viewTransform.left / scale;
            y -= this.viewTransform.top / scale;

            [cite_start]// Y軸反転はシェーダーで行うため、ここでは行わない [cite: 2]
            // x, yは論理ピクセル座標 (0 to width/height)

            if (x < 0 || x >= this.width || y < 0 || y >= this.height) {
                return null;
            }
            return { x: x, y: y };
        } catch (error) {
            console.warn('座標変換エラー:', error);
            return null;
        }
    }

    [cite_start]// 新しい座標変換関数（ワールド座標→レイヤーローカル座標）[cite: 1]
    transformWorldToLocal(worldX, worldY, layerModelMatrix) {
        [cite_start]// gl-matrixのinvertとvec4.transformMat4を使用 [cite: 1]
        const invMatrix = TransformUtils.invert(layerModelMatrix);
        const local = TransformUtils.transformVec2([0, 0], [worldX, worldY], invMatrix);
        return { x: local[0], y: local[1] };
    }


    startLayerTransform(e = null) {
        const activeLayer = this.app.layerManager.getCurrentLayer();
        if (!activeLayer || activeLayer === this.app.layerManager.layers[0]) return; [cite_start]// 背景レイヤーは移動させない [cite: 1, 2]
        this.isLayerTransforming = true;
        this.transformTargetLayer = activeLayer;
        // 非破壊変形ではないので、変形開始前の状態を保存
        if (!this.transformTargetLayer.originalImageData) {
            this.transformTargetLayer.originalImageData = new ImageData(
                new Uint8ClampedArray(this.transformTargetLayer.imageData.data),
                this.transformTargetLayer.imageData.width,
                this.transformTargetLayer.imageData.height
            );
        }
        this.originalModelMatrix = TransformUtils.create(); [cite_start]// 元の行列をコピーして保存 [cite: 1, 2]
        TransformUtils.copy(this.originalModelMatrix, activeLayer.modelMatrix);

        if (e) {
            this.transformMode = this.isShiftDown ? 'rotate_scale' : 'move';
            this.transformStartX = e.clientX;
            this.transformStartY = e.clientY;
            // dat.guiの値を初期化して現在のアクティブレイヤーの値に合わせる
            this.updateTransformGUI();
        }
    }

    applyLayerTransformPreview(e) {
        if (!this.isLayerTransforming || !this.transformTargetLayer) return;

        const activeLayer = this.transformTargetLayer;
        [cite_start]// 元の行列をベースに変換を適用 [cite: 1, 2]
        TransformUtils.copy(activeLayer.modelMatrix, this.originalModelMatrix);

        const dx = e.clientX - this.transformStartX;
        const dy = e.clientY - this.transformStartY;

        if (this.transformMode === 'move') {
            [cite_start]// 平行移動 [cite: 1]
            // GUIの値を更新し、それを元に行列を再構築
            this.guiValues.x = TransformUtils.getTranslation(this.originalModelMatrix).x + dx;
            this.guiValues.y = TransformUtils.getTranslation(this.originalModelMatrix).y + dy;
            TransformUtils.translate(activeLayer.modelMatrix, dx, dy);

        } else if (this.transformMode === 'rotate_scale') {
            [cite_start]// 回転とスケール (簡易的な実装、必要に応じて改善) [cite: 1]
            const centerX = this.width / 2; // 仮の中心点
            const centerY = this.height / 2; // 仮の中心点

            const startVecX = this.transformStartX - centerX;
            const startVecY = this.transformStartY - centerY;
            const currentVecX = e.clientX - centerX;
            const currentVecY = e.clientY - centerY;

            const startAngle = Math.atan2(startVecY, startVecX);
            const currentAngle = Math.atan2(currentVecY, currentVecX);
            const angleDelta = currentAngle - startAngle; // ラジアン

            const startDist = Math.sqrt(startVecX * startVecX + startVecY * startVecY);
            const currentDist = Math.sqrt(currentVecX * currentVecX + currentVecY * currentVecY);
            const scaleDelta = currentDist / startDist;

            [cite_start]// 回転を適用 (ラジアン) [cite: 1]
            TransformUtils.rotate(activeLayer.modelMatrix, angleDelta);
            [cite_start]// スケールを適用 [cite: 1]
            TransformUtils.scale(activeLayer.modelMatrix, scaleDelta, scaleDelta);

            // GUIの値を更新
            this.guiValues.rotation = TransformUtils.radToDeg(angleDelta); // 仮
            this.guiValues.scale = scaleDelta; // 仮
        }
        // GUIの表示も更新
        this.updateTransformGUI(); [cite_start]// [cite: 1]

        this.renderAllLayers(); [cite_start]// プレビューを再描画 [cite: 1]
    }

    commitLayerTransform() {
        if (!this.isLayerTransforming || !this.transformTargetLayer) return;

        this.isLayerTransforming = false;
        this.transformTargetLayer.gpuDirty = true; [cite_start]// 行列が変更されたことをGPUに通知 [cite: 1]
        [cite_start]// transform-utils.jsの関数を使ってmodelMatrixをLayerオブジェクトに適用 [cite: 1]
        // applyLayerTransformPreviewで既にmodelMatrixが更新されているため、ここでは状態確定のみ
        this.app.canvasManager.saveState(); // 確定した状態を履歴に保存
        this.transformTargetLayer = null;
        this.originalModelMatrix = null;
        [cite_start]// GUIの表示を最終的なレイヤーの状態に同期させる [cite: 1]
        this.updateTransformGUI();
    }


    _getAveragePressure() {
        if (this.pressureHistory.length === 0) return 0.5;
        const sum = this.pressureHistory.reduce((a, b) => a + b, 0);
        return sum / this.pressureHistory.length;
    }

    calculatePressureSize(baseSize, pressure) {
        if (!this.pressureSettings.dynamicRange) return baseSize;

        const effectivePressure = Math.max(0, Math.min(pressure - this.pressureSettings.minPressure, this.pressureSettings.maxPressure - this.pressureSettings.minPressure));
        const normalizedPressure = effectivePressure / (this.pressureSettings.maxPressure - this.pressureSettings.minPressure);

        // 筆圧カーブの適用 (pow関数で調整)
        const curvedPressure = Math.pow(normalizedPressure, 1.0 / this.pressureSettings.curve);

        const minSizePixels = baseSize * this.pressureSettings.minSizeRatio;
        return minSizePixels + (baseSize - minSizePixels) * curvedPressure;
    }

    _resetDirtyRect() {
        this.dirtyRect = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity };
    }

    _updateDirtyRect(x, y, size) {
        const halfSize = size / 2;
        this.dirtyRect.minX = Math.min(this.dirtyRect.minX, x - halfSize);
        this.dirtyRect.minY = Math.min(this.dirtyRect.minY, y - halfSize);
        this.dirtyRect.maxX = Math.max(this.dirtyRect.maxX, x + halfSize);
        this.dirtyRect.maxY = Math.max(this.dirtyRect.maxY, y + halfSize);
    }

    _renderDirty() {
        const rect = this.dirtyRect;
        if (rect.minX > rect.maxX) return; // 何も描画されていない

        // ステップ1: レイヤー合成
        this.renderingBridge.compositeLayers(this.app.layerManager.layers, this.compositionData, rect);

        // ステップ2: 画面への表示
        this.renderingBridge.renderToDisplay(this.compositionData, rect);
    }

    renderAllLayers() {
        this.dirtyRect = { minX: 0, minY: 0, maxX: this.width, maxY: this.height }; // 全体を再描画
        this.renderingBridge.compositeLayers(this.app.layerManager.layers, this.compositionData, this.dirtyRect);
        this.renderingBridge.renderToDisplay(this.compositionData, this.dirtyRect);
    }

    // 状態保存
    saveState() {
        // 現在のレイヤーデータをディープコピー
        const layersData = this.app.layerManager.layers.map(layer => {
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
                // transform: { ...layer.transform }, // 削除またはコメントアウト
                [cite_start]modelMatrix: TransformUtils.copy(TransformUtils.create(), layer.modelMatrix), // modelMatrixを保存 [cite: 1]
                gpuDirty: true
            };
        });

        // 履歴の末尾に追加し、redoの可能性があればそれ以降を削除
        this.history = this.history.slice(0, this.historyIndex + 1);
        this.history.push({
            layers: layersData,
            activeLayerIndex: this.app.layerManager.activeLayerIndex
        });
        this.historyIndex = this.history.length - 1;
    }

    // 状態復元
    restoreState(offset) {
        const newIndex = this.historyIndex + offset;
        if (newIndex < 0 || newIndex >= this.history.length) return;

        this.historyIndex = newIndex;
        const state = this.history[this.historyIndex];

        // レイヤーを復元
        this.app.layerManager.layers = state.layers.map(layerData => {
            const layer = new Layer(layerData.name, layerData.imageData.width, layerData.imageData.height);
            layer.visible = layerData.visible;
            layer.opacity = layerData.opacity;
            layer.blendMode = layerData.blendMode;
            layer.imageData = new ImageData(
                new Uint8ClampedArray(layerData.imageData.data),
                layerData.imageData.width,
                layerData.imageData.height
            );
            // layer.transform = { ...layerData.transform }; // 削除またはコメントアウト
            [cite_start]layer.modelMatrix = TransformUtils.copy(TransformUtils.create(), layerData.modelMatrix); // modelMatrixを復元 [cite: 1]
            layer.gpuDirty = true; // 復元されたレイヤーはGPUの更新が必要
            return layer;
        });
        this.app.layerManager.activeLayerIndex = state.activeLayerIndex;
        this.app.layerUIManager.renderLayers(); // UIも更新

        // GUIの表示も更新
        this.updateTransformGUI(); [cite_start]// [cite: 1]

        this.renderAllLayers();
    }

    undo() {
        this.restoreState(-1);
    }

    redo() {
        this.restoreState(1);
    }

    exportMergedImage() {
        // 一時的なCanvasを作成
        const exportCanvas = document.createElement('canvas');
        exportCanvas.width = this.width;
        exportCanvas.height = this.height;
        const exportCtx = exportCanvas.getContext('2d');

        // 最終合成結果をcompositionDataに取得
        const fullRect = { minX: 0, minY: 0, maxX: this.width, maxY: this.height };
        this.renderingBridge.compositeLayers(this.app.layerManager.layers, this.compositionData, fullRect);

        // WebGLエンジンから直接ピクセルデータを読み込む
        const gl = this.renderingBridge.engines['webgl']?.gl;
        if (gl && this.renderingBridge.currentEngineType === 'webgl') {
            const pixels = new Uint8Array(this.width * this.height * 4);
            // 画面に描画した内容を読み出す
            this.renderingBridge.renderToDisplay(null, fullRect); [cite_start]// renderToDisplayを呼ぶことで、WebGLEngineが最終合成結果をdisplayCanvasに描画 [cite: 1, 2]
            gl.readPixels(0, 0, this.width, this.height, gl.RGBA, gl.UNSIGNED_BYTE, pixels);

            // WebGLのY軸反転を補正
            const correctedPixels = new Uint8ClampedArray(this.width * this.height * 4);
            for (let y = 0; y < this.height; y++) {
                const s = y * this.width * 4;
                const d = (this.height - 1 - y) * this.width * 4;
                correctedPixels.set(pixels.subarray(s, s + this.width * 4), d);
            }
            const imageData = new ImageData(correctedPixels, this.width, this.height);
            exportCtx.putImageData(imageData, 0, 0);

        } else {
            // Canvas2Dの場合
            exportCtx.putImageData(this.compositionData, 0, 0);
        }

        // ダウンロード処理
        const dataURL = exportCanvas.toDataURL('image/png');
        const a = document.createElement('a');
        a.href = dataURL;
        a.download = 'toshinka-tegaki-merged.png';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    }

    setCurrentTool(tool) {
        this.currentTool = tool;
    }
}

class LayerManager {
    constructor(app) {
        this.app = app;
        this.layers = [];
        this.activeLayerIndex = 0;
        this.onLayerSwitch = null; // レイヤー切り替え時のコールバック
    }

    setupInitialLayers() {
        // Background layer
        const backgroundLayer = new Layer('背景', this.app.canvasManager.width, this.app.canvasManager.height);
        backgroundLayer.fill('#FFFFFF'); // 白で塗りつぶす
        this.layers.push(backgroundLayer);
        this.app.canvasManager.renderAllLayers();
        this.app.canvasManager.saveState();
    }

    addLayer() {
        const newLayer = new Layer(`レイヤー ${this.layers.length}`, this.app.canvasManager.width, this.app.canvasManager.height);
        // 現在のアクティブレイヤーの直後に挿入
        const insertIndex = this.activeLayerIndex + 1;
        this.layers.splice(insertIndex, 0, newLayer);
        this.renameLayers();
        this.switchLayer(insertIndex);
        this.app.canvasManager.saveState();
    }

    deleteActiveLayer() {
        if (this.activeLayerIndex === 0 || this.layers.length <= 1) return;
        this.layers.splice(this.activeLayerIndex, 1);
        const newActiveIndex = Math.min(this.layers.length - 1, this.activeLayerIndex);
        this.renameLayers();
        this.switchLayer(newActiveIndex);
        this.app.canvasManager.renderAllLayers();
        this.app.canvasManager.saveState();
    }

    renameLayers() {
        this.layers.forEach((layer, index) => {
            if (index > 0) layer.name = `レイヤー ${index}`;
        });
    }

    switchLayer(index) {
        if (index < 0 || index >= this.layers.length) return;
        this.activeLayerIndex = index;
        if (this.app.layerUIManager) {
            this.app.layerUIManager.renderLayers();
        }
        [cite_start]if (this.onLayerSwitch) { // レイヤー切り替えコールバックを呼び出す [cite: 1]
            this.onLayerSwitch();
        }
    }

    getCurrentLayer() {
        return this.layers[this.activeLayerIndex] || null;
    }

    duplicateLayer(layerToDuplicate) {
        const duplicatedLayer = new Layer(`${layerToDuplicate.name} コピー`, layerToDuplicate.imageData.width, layerToDuplicate.imageData.height);
        duplicatedLayer.imageData = new ImageData(
            new Uint8ClampedArray(layerToDuplicate.imageData.data),
            layerToDuplicate.imageData.width,
            layerToDuplicate.imageData.height
        );
        // duplicatedLayer.transform = { ...layerToDuplicate.transform }; // 削除またはコメントアウト
        duplicatedLayer.modelMatrix = TransformUtils.copy(TransformUtils.create(), layerToDuplicate.modelMatrix); [cite_start]// modelMatrixをコピー [cite: 1]
        duplicatedLayer.visible = layerToDuplicate.visible;
        duplicatedLayer.opacity = layerToDuplicate.opacity;
        duplicatedLayer.blendMode = layerToDuplicate.blendMode;
        duplicatedLayer.gpuDirty = true;

        const insertIndex = this.activeLayerIndex + 1;
        this.layers.splice(insertIndex, 0, duplicatedLayer);
        this.renameLayers();
        this.switchLayer(insertIndex);
        this.app.canvasManager.saveState();
    }
}

class PenSettingsManager {
    constructor(app) {
        this.app = app;
        this.isEraserMode = false;
        this.pressureSettings = this.app.canvasManager.pressureSettings; // CanvasManagerから参照
        this.initUI();
    }

    initUI() {
        document.getElementById('brush-tool').addEventListener('click', () => this.setEraserMode(false));
        document.getElementById('eraser-tool').addEventListener('click', () => this.setEraserMode(true));
        document.getElementById('brush-size-slider').addEventListener('input', (e) => {
            const size = parseInt(e.target.value);
            this.setSize(size);
            document.getElementById('brush-size-value').textContent = size;
        });

        const sensitivitySlider = document.getElementById('pressure-sensitivity');
        const minPressureSlider = document.getElementById('min-pressure');
        const maxPressureSlider = document.getElementById('max-pressure');
        const curveSlider = document.getElementById('pressure-curve');
        const minSizeRatioSlider = document.getElementById('min-size-ratio');
        const dynamicRangeToggle = document.getElementById('dynamic-range-toggle');

        sensitivitySlider.value = this.pressureSettings.sensitivity;
        minPressureSlider.value = this.pressureSettings.minPressure;
        maxPressureSlider.value = this.pressureSettings.maxPressure;
        curveSlider.value = this.pressureSettings.curve;
        minSizeRatioSlider.value = this.pressureSettings.minSizeRatio;
        dynamicRangeToggle.checked = this.pressureSettings.dynamicRange;

        const updatePressureSettings = () => {
            this.pressureSettings.sensitivity = parseFloat(sensitivitySlider.value);
            this.pressureSettings.minPressure = parseFloat(minPressureSlider.value);
            this.pressureSettings.maxPressure = parseFloat(maxPressureSlider.value);
            this.pressureSettings.curve = parseFloat(curveSlider.value);
            this.pressureSettings.minSizeRatio = parseFloat(minSizeRatioSlider.value);
            this.pressureSettings.dynamicRange = dynamicRangeToggle.checked;
        };

        sensitivitySlider.addEventListener('input', updatePressureSettings);
        minPressureSlider.addEventListener('input', updatePressureSettings);
        maxPressureSlider.addEventListener('input', updatePressureSettings);
        curveSlider.addEventListener('input', updatePressureSettings);
        minSizeRatioSlider.addEventListener('input', updatePressureSettings);
        dynamicRangeToggle.addEventListener('change', updatePressureSettings);
    }

    setSize(size) {
        this.app.canvasManager.currentSize = size;
        document.getElementById('brush-size-value').textContent = size;
    }

    setEraserMode(isEraser) {
        this.isEraserMode = isEraser;
        document.getElementById('brush-tool').classList.toggle('active', !isEraser);
        document.getElementById('eraser-tool').classList.toggle('active', isEraser);
    }
}

class ColorManager {
    constructor(app) {
        this.app = app;
        this.mainColor = '#800000'; // Default red
        this.subColor = '#f0e0d6'; // Default off-white
        this.currentColor = this.mainColor;
        this.currentColorIndex = 0; // 0 for main, 1 for sub
        this.setupColorPicker();
    }

    setupColorPicker() {
        const mainColorPicker = document.getElementById('mainColorPicker');
        const subColorPicker = document.getElementById('subColorPicker');
        const colorSwapButton = document.getElementById('colorSwapButton');

        mainColorPicker.value = this.mainColor;
        subColorPicker.value = this.subColor;

        mainColorPicker.addEventListener('input', (e) => {
            this.mainColor = e.target.value;
            this.updateColorDisplays();
            if (this.currentColorIndex === 0) {
                this.app.canvasManager.currentColor = this.mainColor;
            }
        });

        subColorPicker.addEventListener('input', (e) => {
            this.subColor = e.target.value;
            this.updateColorDisplays();
            if (this.currentColorIndex === 1) {
                this.app.canvasManager.currentColor = this.subColor;
            }
        });

        colorSwapButton.addEventListener('click', () => {
            this.swapColors();
        });

        document.getElementById('colorPalette')?.addEventListener('click', (e) => {
            if (e.target.classList.contains('color-swatch')) {
                const color = e.target.dataset.color;
                this.setColor(color);
            }
        });

        document.getElementById('colorPickerButton')?.addEventListener('click', () => {
            // ここにスポイトツールのロジックを実装する
            alert('スポイトツールは現在開発中です！');
        });
    }

    updateColorDisplays() {
        document.getElementById('mainColorDisplay').style.backgroundColor = this.mainColor;
        document.getElementById('subColorDisplay').style.backgroundColor = this.subColor;
    }

    setColor(hexColor) {
        if (this.currentColorIndex === 0) {
            this.mainColor = hexColor;
            document.getElementById('mainColorPicker').value = hexColor;
        } else {
            this.subColor = hexColor;
            document.getElementById('subColorPicker').value = hexColor;
        }
        this.currentColor = hexColor;
        this.updateColorDisplays();
        this.app.canvasManager.currentColor = hexColor;
    }

    swapColors() {
        [this.mainColor, this.subColor] = [this.subColor, this.mainColor];
        document.getElementById('mainColorPicker').value = this.mainColor;
        document.getElementById('subColorPicker').value = this.subColor;
        this.updateColorDisplays();
        this.currentColorIndex = 1 - this.currentColorIndex; // Toggle 0 and 1
        this.app.canvasManager.currentColor = this.currentColorIndex === 0 ? this.mainColor : this.subColor;
    }

    changeColor(increase) {
        let newIndex = this.currentColorIndex + (increase ? 1 : -1);
        newIndex = (newIndex + this.app.colorPalette.length) % this.app.colorPalette.length; // Wrap around
        this.setColor(this.app.colorPalette[newIndex]);
    }
}

class ToolManager {
    constructor(app) {
        this.app = app;
        this.initUI();
    }

    initUI() {
        document.getElementById('pen-tool').addEventListener('click', () => this.setTool('pen'));
        document.getElementById('bucket-tool').addEventListener('click', () => this.setTool('bucket'));
        document.getElementById('move-tool').addEventListener('click', () => this.setTool('move'));
    }

    setTool(tool) {
        this.app.canvasManager.setCurrentTool(tool);
        document.querySelectorAll('.left-toolbar .tool-btn').forEach(btn => btn.classList.remove('active'));
        document.getElementById(tool + '-tool')?.classList.add('active');
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
        window.toshinkaTegaki = new ToshinkaTegakiTool();
        window.toshinkaTegakiInitialized = true;
        console.log("Toshinka Tegaki Tool Initialized.");
    }
    // dat.gui ライブラリの動的ロード (例)
    if (typeof dat === 'undefined') {
        const script = document.createElement('script');
        script.onload = () => {
            console.log("dat.gui loaded.");
            // dat.gui ロード後にGUIをセットアップするために、必要であればここで改めて初期化関数を呼ぶ
            // または、CanvasManagerのコンストラクタで_setupDatGuiを呼ぶようにする
            if (window.toshinkaTegaki && !window.toshinkaTegaki.canvasManager.gui) {
                window.toshinkaTegaki.canvasManager._setupDatGui();
            }
        };
        script.src = 'https://cdnjs.cloudflare.com/ajax/libs/dat-gui/0.7.7/dat.gui.min.js';
        document.head.appendChild(script);
    } else {
        // dat.guiが既に存在する場合、CanvasManagerのコンストラクタで自動的にセットアップされる
    }
});