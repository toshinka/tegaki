/*
 * ===================================================================================
 * Toshinka Tegaki Tool - Core Engine
 * Version: 3.4.4 (Phase 4A11C-4)
 *
 * - 変更点 (Phase 4A11C-4):
 * - 「🎨Phase 4A11C-4 指示書」に基づき、レイヤー移動開始時の同期処理を強化。
 * - startLayerTransform()にて、変形対象(transformStage)を作成する前に、
 * 一度GPUから最新の描画結果を取得し、それを基に作成するよう修正。
 * これにより、初回移動時の描画ブレ（プルプル現象）を抑制します。
 * ===================================================================================
 */

// --- Debug Mode ---
// URLに #debug が含まれている場合のみデバッグログを有効化
const DEBUG_MODE = window.location.hash === '#debug';

// --- glMatrix 定義 ---
const mat4 = window.glMatrix.mat4;

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
// 新しく作成したIndexedDB操作用の関数をインポートします
import { saveLayerToIndexedDB, loadLayersFromIndexedDB } from './core/db/db-indexed.js';


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
        if (viewTransform.flipX === -1) x = canvas.width - x;
        if (viewTransform.flipY === -1) y = canvas.height - y;
    }
    
    return { x, y };
}

// --- Core Logic Classes ---

/**
 * レイヤーのデータ構造を定義するクラス。
 * DB永続化のために一意なIDを持つように変更されました。
 */
export class Layer {
    static nextId = 0;
    constructor(name, width, height, id = null) {
        // idが指定されていればそれを使用、なければ自動インクリメント
        this.id = (id !== null) ? id : Layer.nextId++;
        this.name = name;
        this.visible = true;
        this.opacity = 100;
        this.blendMode = 'normal';
        this.imageData = new ImageData(width, height);
        this.modelMatrix = mat4.create(); // glMatrix.mat4
        this.gpuDirty = true; // テクスチャの再アップロードが必要かを示すフラグ
        
        // ▼▼▼▼▼ Phase 4A11C-1 修正 ▼▼▼▼▼
        // 指示書に基づき、一時的な変形プレビューデータを保持するプロパティを追加
        this.transformStage = null;
        // ▲▲▲▲▲ Phase 4A11C-1 修正 ▲▲▲▲▲

        // DBから復元した際に、IDの最大値を更新して重複を防ぎます
        if (this.id >= Layer.nextId) {
            Layer.nextId = this.id + 1;
        }
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
        this.currentTool = null;
        this.currentLayer = null;
        this.currentColor = '#000000'; 
        this.brushSize = 10;

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
        this.layerTransformPending = false;
        this.transformDragStarted = false;
        this.isSpaceDown = false;
        this.isVDown = false;
        this.lastPoint = null;
        this.transformStartWorldX = 0;
        this.transformStartWorldY = 0;

        // ▼▼▼▼▼ Phase 4A11C-1 修正 ▼▼▼▼▼
        // 従来のcellBufferを廃止し、変形開始時のMatrixを保持するプロパティを追加
        this.transformOriginalModelMatrix = null;
        // ▲▲▲▲▲ Phase 4A11C-1 修正 ▲▲▲▲▲

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
        
        /**
         * 描画や変形が完了した際に呼び出されるコールバック関数。
         * 主にIndexedDBへの保存処理を担います。
         * @type {function(Layer): Promise<void> | null}
         */
        this.onDrawEnd = null;
        
        this.bindEvents();
    }

    setCurrentTool(tool) {
        this.currentTool = tool;
        console.log("🛠️ ツールを設定:", tool?.name ?? tool);
    }

    setCurrentLayer(layer) {
        this.currentLayer = layer;
    }
    
    setCurrentColor(color) {
      this.currentColor = color;
    }

    setCurrentSize(size) {
      this.brushSize = size;
    }

    getCurrentLayer() {
        return this.currentLayer;
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
        // ▼▼▼▼▼ Phase 4A11C-1 修正 ▼▼▼▼▼
        // 描画ソースをtransformStageも考慮するように変更
        const sourceImage = layer.transformStage || layer.imageData;
        const currentActiveLayer = this.app.layerManager.getCurrentLayer();
        if (!currentActiveLayer || !isValidMatrix(currentActiveLayer.modelMatrix)) return false;

        const SUPER_SAMPLING_FACTOR = this.renderingBridge.currentEngine?.SUPER_SAMPLING_FACTOR || 1.0;
        const superX = worldCoords.x * SUPER_SAMPLING_FACTOR;
        const superY = worldCoords.y * SUPER_SAMPLING_FACTOR;
        const local = transformWorldToLocal(superX, superY, layer.modelMatrix);
        const layerWidth = sourceImage.width * SUPER_SAMPLING_FACTOR;
        const layerHeight = sourceImage.height * SUPER_SAMPLING_FACTOR;
        // ▲▲▲▲▲ Phase 4A11C-1 修正 ▲▲▲▲▲
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
            // ▼▼▼▼▼ Phase 4A11C-3 修正 ▼▼▼▼▼
            // 指示書に基づき、座標ブレ防止のため整数に丸める
            this.transformStartWorldX = Math.round(coords.x);
            this.transformStartWorldY = Math.round(coords.y);
            // ▲▲▲▲▲ Phase 4A11C-3 修正 ▲▲▲▲▲
            return;
        }
        if (!activeLayer.visible || !this._isPointOnLayer(coords, activeLayer)) return;
        const SUPER_SAMPLING_FACTOR = this.renderingBridge.currentEngine?.SUPER_SAMPLING_FACTOR || 1.0;
        const superX = coords.x * SUPER_SAMPLING_FACTOR;
        const superY = coords.y * SUPER_SAMPLING_FACTOR;
        const local = transformWorldToLocal(superX, superY, activeLayer.modelMatrix);
        this._resetDirtyRect();

        const currentColor = this.currentColor ?? '#000000';

        if (this.app.toolManager.currentTool === 'bucket') {
            this.app.bucketTool.fill(activeLayer.imageData, Math.round(local.x), Math.round(local.y), hexToRgba(currentColor));
            activeLayer.gpuDirty = true;
            this.renderAllLayers();
            this.saveState();
            this.onDrawEnd?.(activeLayer);
            return;
        }
        this.isDrawing = true;
        this.pressureHistory = [e.pressure > 0 ? e.pressure : 0.5];
        this.lastPoint = { ...local, pressure: this.pressureHistory[0] };
        const size = this.calculatePressureSize(this.app.penSettingsManager.currentSize, this.lastPoint.pressure);
        this._updateDirtyRect(local.x, local.y, size);
        this.renderingBridge.drawCircle(local.x, local.y, size / 2, hexToRgba(currentColor), this.app.toolManager.currentTool === 'eraser', activeLayer);
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
            this.performDelayedLayerClear();

            const activeLayer = this.app.layerManager.getCurrentLayer();
            // ▼▼▼▼▼ Phase 4A11C-1 修正 ▼▼▼▼▼
            // チェック対象をtransformStageの有無に変更
            if (!activeLayer || !activeLayer.transformStage || !this.transformDragStarted) return;
            
            const dx = coords.x - this.transformStartWorldX;
            const dy = coords.y - this.transformStartWorldY;
            const SUPER_SAMPLING_FACTOR = this.renderingBridge.currentEngine?.SUPER_SAMPLING_FACTOR || 1.0;

            // ▼▼▼▼▼ Phase 4A11C-2 修正 ▼▼▼▼▼
            // 指示書に基づき、座標ブレ防止のため整数に丸める
            const adjustedDx = Math.round(dx * SUPER_SAMPLING_FACTOR);
            const adjustedDy = Math.round(dy * SUPER_SAMPLING_FACTOR);
            // ▲▲▲▲▲ Phase 4A11C-2 修正 ▲▲▲▲▲

            const translationMatrix = mat4.create();
            mat4.fromTranslation(translationMatrix, [adjustedDx, adjustedDy, 0]);
            const newMatrix = mat4.create();
            // 変形開始時のMatrixを基準に移動量を計算
            mat4.multiply(newMatrix, translationMatrix, this.transformOriginalModelMatrix);
            activeLayer.modelMatrix = newMatrix;
            // imageDataの書き換えとgpuDirtyフラグの操作は不要になる
            // ▲▲▲▲▲ Phase 4A11C-1 修正 ▲▲▲▲▲
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
            if (this.pressureHistory.length > this.maxPressureHistory) this.pressureHistory.shift();
            const lastSize = this.calculatePressureSize(this.app.penSettingsManager.currentSize, this.lastPoint.pressure);
            const currentSize = this.calculatePressureSize(this.app.penSettingsManager.currentSize, currentPressure);
            this._updateDirtyRect(this.lastPoint.x, this.lastPoint.y, lastSize);
            this._updateDirtyRect(local.x, local.y, currentSize);

            const currentColor = this.currentColor ?? '#000000';
            this.renderingBridge.drawLine(this.lastPoint.x, this.lastPoint.y, local.x, local.y, this.app.penSettingsManager.currentSize, hexToRgba(currentColor), this.app.toolManager.currentTool === 'eraser', this.lastPoint.pressure, currentPressure, this.calculatePressureSize.bind(this), activeLayer);

            this.lastPoint = { ...local, pressure: currentPressure };
            this._requestRender();
            return;
        }
        this.updateCursor(coords);
    }

    async onPointerUp(e) {
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
                await this.onDrawEnd?.(activeLayer);
            }
            this.lastPoint = null;
            this.saveState();
        }
        if (this.isDraggingLayer) this.isDraggingLayer = false;
        this.isPanning = false;
        if (document.documentElement.hasPointerCapture(e.pointerId)) {
            document.documentElement.releasePointerCapture(e.pointerId);
        }
    }

    // ▼▼▼▼▼ Phase 4A11C-1 修正 ▼▼▼▼▼
    // レイヤーのクリア処理を削除。描画エンジン側でtransformStageを描画するため不要。
    performDelayedLayerClear() {
        if (!this.layerTransformPending || this.transformDragStarted) {
            return;
        }
        const activeLayer = this.app.layerManager.getCurrentLayer();
        if (!activeLayer) return;
        if (DEBUG_MODE) console.log("[LayerTransform] Drag detected. Using transformStage for rendering.");
        this.transformDragStarted = true;
    }
    // ▲▲▲▲▲ Phase 4A11C-1 修正 ▲▲▲▲▲

    // ▼▼▼▼▼ Phase 4A11C-4, C-1 修正 ▼▼▼▼▼
    // 変形開始処理。transformStageをGPUから同期して準備する
    startLayerTransform() {
        if (this.isLayerTransforming) return;
        const activeLayer = this.app.layerManager.getCurrentLayer();
        if (!activeLayer || !activeLayer.visible) return;

        this.isLayerTransforming = true;
        
        // ▼▼▼▼▼ Phase 4A11C-4 修正 ▼▼▼▼▼
        [cite_start]// transformStage作成前に、GPU側に最新状態を描画し、CPUに取得 [cite: 10]
        if (this.app.layerManager.getCurrentLayer()?.gpuDirty) {
            this.renderAllLayers(); [cite_start]// GPUへの描画反映 [cite: 10]
        }

        const syncedImageData = this.renderingBridge.getTransformedImageData(
            this.app.layerManager.getCurrentLayer()
        ); [cite_start]// [cite: 10]

        if (syncedImageData) {
            [cite_start]// ここでtransformStageを最新GPU出力で初期化 [cite: 11]
            this.app.layerManager.getCurrentLayer().transformStage = syncedImageData;
        } else {
             // 同期に失敗した場合は変形モードを開始しない
            console.error("Failed to sync ImageData from GPU for transformStage. Aborting transform.");
            this.isLayerTransforming = false;
            return;
        }
        // ▲▲▲▲▲ Phase 4A11C-4 修正 ▲▲▲▲▲

        this.layerTransformPending = true;
        this.transformDragStarted = false;
        
        // 変形前のmodelMatrixを保存
        this.transformOriginalModelMatrix = mat4.clone(activeLayer.modelMatrix);
        
        if (DEBUG_MODE) console.log("[LayerTransform] Start Pending (startLayerTransform)");
        this.updateCursor();
    }
    // ▲▲▲▲▲ Phase 4A11C-4, C-1 修正 ▲▲▲▲▲

    // ▼▼▼▼▼ Phase 4A11C-3, C-2, C-1 修正 ▼▼▼▼▼
    // 変形確定処理。transformStageの内容を変形させてimageDataに焼き付ける
    async commitLayerTransform() {
        if (!this.isLayerTransforming) return;

        const activeLayer = this.app.layerManager.getCurrentLayer();

        // Vキーを押してすぐに離した（ドラッグしなかった）場合は、何もせず通常モードに戻る
        if (this.layerTransformPending && !this.transformDragStarted) {
            if (DEBUG_MODE) console.log("[LayerTransform] Commit aborted: No drag detected. Reverting to normal state.");
            this.isLayerTransforming = false;
            this.layerTransformPending = false;
            if (activeLayer) activeLayer.transformStage = null;
            this.transformOriginalModelMatrix = null;
            this.updateCursor();
            return;
        }

        this.isLayerTransforming = false;
        if (!activeLayer || !this.transformOriginalModelMatrix) {
            this.layerTransformPending = false;
            this.transformDragStarted = false;
            this.updateCursor();
            return;
        }
        
        const finalMatrix = activeLayer.modelMatrix;

        // 指示書(Phase 4A11C-2)に基づき、デバッグログを追加
        if (DEBUG_MODE) {
            const pos = mat4.getTranslation(window.glMatrix.vec3.create(), finalMatrix);
            console.log(`[転写デバッグ] Commit transform. Original position: (${pos[0]}, ${pos[1]})`);
        }
        
        // 指示書(Phase 4A11C-2)に基づき、最終座標を丸めてズレを防止
        finalMatrix[12] = Math.round(finalMatrix[12]); // tx
        finalMatrix[13] = Math.round(finalMatrix[13]); // ty

        if (DEBUG_MODE) {
            console.log("[LayerTransform] Commit (commitLayerTransform)");
            console.log("[転写デバッグ] modelMatrix (Rounded):", JSON.stringify(Array.from(finalMatrix)));
        }
        
        // 描画エンジンに、transformStageの内容を変形後の姿でImageDataとして要求する
        const transformedImageData = this.renderingBridge.getTransformedImageData(activeLayer);
        
        // ▼▼▼▼▼ Phase 4A11C-3 修正 ▼▼▼▼▼
        // 指示書に基づき、空のImageDataが返ってきた場合の安全チェックを追加
        if (!transformedImageData || transformedImageData.width === 0 || transformedImageData.height === 0) {
            console.warn("転写失敗: ImageDataが空のため、操作をキャンセルしてバックアップから復元します。");
            this.restoreLayerBackup();
            this.layerTransformPending = false;
            this.transformDragStarted = false;
            this.updateCursor();
            return;
        }
        // ▲▲▲▲▲ Phase 4A11C-3 修正 ▲▲▲▲▲
        
        // 成功したら、返ってきたImageDataを正式なデータとして設定
        activeLayer.imageData.data.set(transformedImageData.data);
        mat4.identity(activeLayer.modelMatrix); // 位置や回転をリセット
        activeLayer.gpuDirty = true;
        
        await this.onDrawEnd?.(activeLayer);
        
        // 後片付け
        activeLayer.transformStage = null;
        this.transformOriginalModelMatrix = null;
        this.layerTransformPending = false;
        this.transformDragStarted = false;

        this.setCurrentLayer(activeLayer);
        this.renderAllLayers();
        this.saveState();
    }
    // ▲▲▲▲▲ Phase 4A11C-3, C-2, C-1 修正 ▲▲▲▲▲

    // ▼▼▼▼▼ Phase 4A11C-1 & 4A11C-2 修正 ▼▼▼▼▼
    // 変形キャンセル処理。transformStageを破棄し、Matrixを元に戻す
    cancelLayerTransform() {
        if (!this.isLayerTransforming) return;

        const activeLayer = this.app.layerManager.getCurrentLayer();

        // Vキーを押してすぐに離した（ドラッグしなかった）場合は、何もせず通常モードに戻る
        if (this.layerTransformPending && !this.transformDragStarted) {
            if (DEBUG_MODE) console.log("[LayerTransform] Cancel aborted: No drag detected. Reverting to normal state.");
            this.isLayerTransforming = false;
            this.layerTransformPending = false;
            if (activeLayer) activeLayer.transformStage = null;
            this.transformOriginalModelMatrix = null;
            this.updateCursor();
            return;
        }
        
        if (DEBUG_MODE) console.log("[LayerTransform] Cancel");

        this.isLayerTransforming = false;
        if (!activeLayer || !this.transformOriginalModelMatrix) {
            this.layerTransformPending = false;
            this.transformDragStarted = false;
            this.updateCursor();
            return;
        }
        
        // 変形をキャンセルし、元のMatrixに戻す
        activeLayer.modelMatrix = mat4.clone(this.transformOriginalModelMatrix);
        activeLayer.gpuDirty = true;

        // 後片付け
        activeLayer.transformStage = null;
        this.transformOriginalModelMatrix = null;
        this.layerTransformPending = false;
        this.transformDragStarted = false;
        
        this.renderAllLayers();
        this.updateCursor();
    }
    // ▲▲▲▲▲ Phase 4A11C-1 & 4A11C-2 修正 ▲▲▲▲▲
    
    // ▼▼▼▼▼ Phase 4A11C-1 修正 ▼▼▼▼▼
    // バックアップ復元処理も新しい方式に合わせる
    restoreLayerBackup() {
        const activeLayer = this.app.layerManager.getCurrentLayer();
        if (!this.transformOriginalModelMatrix || !activeLayer) return;

        // 変形前の状態に戻す
        activeLayer.modelMatrix = mat4.clone(this.transformOriginalModelMatrix);
        activeLayer.gpuDirty = true;

        // 後片付け
        activeLayer.transformStage = null;
        this.transformOriginalModelMatrix = null;
        
        this.renderAllLayers();
    }
    // ▲▲▲▲▲ Phase 4A11C-1 修正 ▲▲▲▲▲

    applyLayerTransform({ translation = [0, 0, 0], scale = 1.0, rotation = 0, flip = null }) {
        // ▼▼▼▼▼ Phase 4A11C-1 修正 ▼▼▼▼▼
        if (!this.isLayerTransforming || !this.transformOriginalModelMatrix) return;

        this.performDelayedLayerClear();
        if (!this.transformDragStarted) {
             this.transformDragStarted = true;
        }
        // ▲▲▲▲▲ Phase 4A11C-1 修正 ▲▲▲▲▲

        const activeLayer = this.app.layerManager.getCurrentLayer();
        if (!activeLayer) return;
        const SUPER_SAMPLING_FACTOR = this.renderingBridge.currentEngine?.SUPER_SAMPLING_FACTOR || 1.0;
        const adjustedTranslation = [translation[0] * SUPER_SAMPLING_FACTOR, translation[1] * SUPER_SAMPLING_FACTOR, translation[2] * SUPER_SAMPLING_FACTOR];
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
        
        // ▼▼▼▼▼ Phase 4A11C-1 修正 ▼▼▼▼▼
        // imageDataの書き換えは不要
        // ▲▲▲▲▲ Phase 4A11C-1 修正 ▲▲▲▲▲
        this.renderAllLayers();
    }

    _renderDirty() {
        const rect = this.dirtyRect;
        if (rect.minX > rect.maxX) return;
        this.renderingBridge.compositeLayers(this.app.layerManager.layers, null, rect);
        // ▼▼▼▼▼ Phase 4A11C-1.1 Hotfix ▼▼▼▼▼
        // タイプミスを修正
        this.renderingBridge.renderToDisplay(null, rect);
        // ▲▲▲▲▲ Phase 4A11C-1.1 Hotfix ▲▲▲▲▲
    }

    renderAllLayers() {
        const SUPER_SAMPLING_FACTOR = this.renderingBridge.currentEngine?.SUPER_SAMPLING_FACTOR || 1.0;
        this.dirtyRect = { minX: 0, minY: 0, maxX: this.width * SUPER_SAMPLING_FACTOR, maxY: this.height * SUPER_SAMPLING_FACTOR };
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
            finalPressure *= (0.2 + Math.pow(dampingFactor, 3) * 0.8);
        }
        if (this.pressureSettings.dynamicRange) {
            const minHist = Math.min(...tempHistory, finalPressure);
            const maxHist = Math.max(...tempHistory, finalPressure);
            const range = maxHist - minHist;
            if (range > 0.1) finalPressure = (finalPressure - minHist) / range;
        }
        const curvedPressure = Math.pow(finalPressure, this.pressureSettings.curve);
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
                if (!isValidMatrix(layer.modelMatrix)) layer.modelMatrix = mat4.create();
                return {
                    id: layer.id, name: layer.name, visible: layer.visible, opacity: layer.opacity, blendMode: layer.blendMode,
                    imageData: new ImageData(new Uint8ClampedArray(layer.imageData.data), layer.imageData.width, layer.imageData.height),
                    modelMatrix: Array.from(layer.modelMatrix)
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
            const layer = new Layer(layerData.name, layerData.imageData.width, layerData.imageData.height, layerData.id);
            layer.visible = layerData.visible;
            layer.opacity = layerData.opacity ?? 100;
            layer.blendMode = layerData.blendMode ?? 'normal';
            layer.imageData.data.set(layerData.imageData.data);
            if (layerData.modelMatrix && Array.isArray(layerData.modelMatrix) && layerData.modelMatrix.length === 16) {
                layer.modelMatrix = new Float32Array(layerData.modelMatrix);
            }
            layer.gpuDirty = true;
            return layer;
        });
        this.app.layerManager.switchLayer(state.activeLayerIndex);
        
        const newActiveLayer = this.app.layerManager.getCurrentLayer();
        this.setCurrentLayer(newActiveLayer);
        
        this.app.layerUIManager.renderLayers?.();
        this.renderAllLayers();
    }

    undo() { if (this.historyIndex > 0) { this.historyIndex--; this.restoreState(this.history[this.historyIndex]); } }
    redo() { if (this.historyIndex < this.history.length - 1) { this.historyIndex++; this.restoreState(this.history[this.historyIndex]); } }

    updateCursor(coords) {
        if (this.isLayerTransforming) { this.canvasArea.style.cursor = 'move'; return; }
        if (this.isPanning) { this.canvasArea.style.cursor = 'grabbing'; return; }
        if (this.isSpaceDown) { this.canvasArea.style.cursor = 'grab'; return; }
        const activeLayer = this.app.layerManager.getCurrentLayer();
        if (activeLayer && coords && this._isPointOnLayer(coords, activeLayer)) {
            switch (this.app.toolManager.currentTool) {
                case 'pen': this.canvasArea.style.cursor = 'crosshair'; break;
                case 'eraser': this.canvasArea.style.cursor = 'cell'; break;
                case 'bucket': this.canvasArea.style.cursor = 'copy'; break;
                default: this.canvasArea.style.cursor = 'crosshair';
            }
        } else {
            this.canvasArea.style.cursor = 'not-allowed';
        }
    }

    applyViewTransform() { const t = this.viewTransform; this.canvasContainer.style.transform = `translate(${t.left}px, ${t.top}px) scale(${t.scale * t.flipX}, ${t.scale * t.flipY}) rotate(${t.rotation}deg)`; }
    flipHorizontal() { this.viewTransform.flipX *= -1; this.applyViewTransform(); }
    flipVertical() { this.viewTransform.flipY *= -1; this.applyViewTransform(); }
    zoom(factor) { this.viewTransform.scale = Math.max(0.1, this.viewTransform.scale * factor); this.applyViewTransform(); }
    rotate(degrees) { this.viewTransform.rotation = (this.viewTransform.rotation + degrees) % 360; this.applyViewTransform(); }
    resetView() { this.viewTransform = { scale: 1, rotation: 0, flipX: 1, flipY: 1, left: 0, top: 0 }; this.applyViewTransform(); }
    handleWheel(e) { e.preventDefault(); if (e.shiftKey) { this.rotate(-e.deltaY * 0.2); } else { this.zoom(e.deltaY > 0 ? 1 / 1.05 : 1.05); } }
    exportMergedImage() { /* ... */ }
}

// --- Application Initialization ---
window.addEventListener('load', async () => {
    if (window.toshinkaTegakiInitialized) return;
    window.toshinkaTegakiInitialized = true;

    console.log("🛠️ アプリケーションの初期化を開始します...");

    const app = {};
    app.canvasManager = new CanvasManager(app);
    app.layerManager = new LayerManager(app);
    app.toolManager = new ToolManager(app);
    app.layerUIManager = new LayerUIManager(app);
    app.penSettingsManager = new PenSettingsManager(app);
    app.colorManager = new ColorManager(app);
    app.topBarManager = new TopBarManager(app);
    app.shortcutManager = new ShortcutManager(app);
    app.bucketTool = new BucketTool(app);
    window.toshinkaTegakiTool = app;

    app.canvasManager.onDrawEnd = async (layer) => {
        if (!layer) return;
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = layer.imageData.width;
        tempCanvas.height = layer.imageData.height;
        tempCanvas.getContext('2d').putImageData(layer.imageData, 0, 0);
        const dataURL = tempCanvas.toDataURL();
        await saveLayerToIndexedDB(layer.id, layer.name, dataURL);
    };

    console.log("💾 IndexedDBからレイヤーデータの復元を試みます...");
    const storedLayers = await loadLayersFromIndexedDB();

    if (storedLayers && storedLayers.length > 0) {
        app.layerManager.layers = [];
        
        const loadPromises = storedLayers.map(layerData => {
            const layer = new Layer(layerData.name, app.canvasManager.width, app.canvasManager.height, layerData.id);
            app.layerManager.layers.push(layer);

            return new Promise((resolve, reject) => {
                if (!layerData.imageData) {
                    resolve();
                    return;
                }
                const img = new Image();
                img.onload = () => {
                    const tempCtx = document.createElement('canvas').getContext('2d');
                    tempCtx.canvas.width = layer.imageData.width;
                    tempCtx.canvas.height = layer.imageData.height;
                    
                    tempCtx.imageSmoothingEnabled = false;
                    tempCtx.webkitImageSmoothingEnabled = false;
                    tempCtx.mozImageSmoothingEnabled = false;
                    tempCtx.msImageSmoothingEnabled = false;

                    tempCtx.drawImage(img, 0, 0);
                    layer.imageData = tempCtx.getImageData(0, 0, tempCtx.canvas.width, tempCtx.canvas.height);
                    layer.gpuDirty = true;
                    resolve();
                };
                img.onerror = reject;
                img.src = layerData.imageData;
            });
        });
        
        try {
            await Promise.all(loadPromises);
            console.log(`✅ ${storedLayers.length}件のレイヤーをDBから復元しました。`);
            app.layerManager.switchLayer(app.layerManager.layers.length - 1);
        } catch(error) {
             console.error("レイヤーの復元中にエラーが発生したため、初期状態で起動します。", error);
             await app.layerManager.setupInitialLayers();
        }

    } else {
        console.log("DBにデータがないため、初期レイヤーを作成します。");
        await app.layerManager.setupInitialLayers();
    }
    
    const initialLayer = app.layerManager.getCurrentLayer();
    if (initialLayer) {
        app.canvasManager.setCurrentLayer(initialLayer);
    }

    app.shortcutManager.initialize();
    app.layerUIManager.renderLayers?.();
    app.canvasManager.renderAllLayers();
    app.toolManager.setTool('pen');
    app.canvasManager.saveState();

    console.log("✅ アプリケーションの初期化が完了しました。");
});