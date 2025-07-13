// [モジュール責務] CanvasInteraction.js
// 目的：ユーザーのキャンバスに対するすべてのインタラクション（マウス、ペン、タッチ操作）を管理する。
// 主な役割は、ポインタイベントを解釈し、現在のツール（ペン、消しゴム、移動など）に応じて描画処理（drawLine, drawCircle）や
// 視点操作（パン、ズーム）、レイヤー変形といった具体的なアクションに変換すること。
// 実際の描画命令は直接行わず、RenderingBridgeを介して描画エンジンに依頼する。
// また、Undo/Redoのための状態管理（saveState）も担当する。

import { mat4 } from 'gl-matrix';
import { RenderingBridge } from '../../engine/RenderingBridge.js';
// 補足: transform-utils.js の新しいパスを想定して修正しています。
// 実際のパスに合わせて再修正が必要になる場合があります。
import { isValidMatrix, transformWorldToLocal } from '../../utils/transform-utils.js';

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

// --- Core Logic Class ---
export class CanvasInteraction {
    /**
     * [関数責務] constructor: CanvasInteractionを初期化し、RenderingBridgeの生成と非同期でのWebGL初期化を開始する。
     * @param {object} app - アプリケーション全体のインスタンス
     * @param {HTMLCanvasElement} canvas - 操作対象のcanvas要素
     */
    constructor(app, canvas) {
        this.app = app;
        this.canvas = canvas;
        this.isInitialized = false;

        if (!this.canvas) {
            console.error("❌ CanvasInteraction: canvasが見つかりません");
            return;
        }
        console.log("🖼️ CanvasInteraction: canvas取得", this.canvas);

        // RenderingBridge生成
        this.renderingBridge = new RenderingBridge(this.canvas, app.twgl, app.glMatrix);
        
        // 非同期初期化チェック開始
        this.initializeWebGL().then(() => {
            this.completeInitialization();
        }).catch(error => {
            console.error("❌ CanvasInteraction: WebGL初期化に失敗", error);
        });
    }

    /**
     * [関数責務] initializeWebGL: RenderingBridgeの非同期初期化が完了するのをポーリング（定期確認）して待つ。
     * @returns {Promise<void>} WebGLの初期化が完了すると解決されるPromise
     */
    async initializeWebGL() {
        let attempts = 0;
        const maxAttempts = 50;
        while (!this.renderingBridge?.isInitialized && attempts < maxAttempts) {
            await new Promise(resolve => setTimeout(resolve, 100));
            attempts++;
        }

        if (!this.renderingBridge?.isInitialized) {
            throw new Error("WebGL初期化がタイムアウトしました");
        }

        console.log("✅ CanvasInteraction: WebGL初期化完了");
    }

    /**
     * [関数責務] completeInitialization: WebGL初期化後に、CanvasInteractionのプロパティやイベントリスナーをセットアップする。
     */
    completeInitialization() {
        this.currentTool = null;
        this.currentLayer = null;
        this.currentColor = '#800000';
        this.brushSize = 10;
        
        this.canvasArea = document.getElementById('canvas-area');
        this.canvasContainer = document.getElementById('canvas-container');
        this.width = this.canvas.width;
        this.height = this.canvas.height;

        this.isDrawing = false;
        this.isPanning = false;

        this.isDraggingLayer = false;
        this.isLayerTransforming = false;
        this.layerTransformPending = false;
        this.transformDragStarted = false;
        this.isShiftDown = false;
        this.isSpaceDown = false;
        this.isVDown = false;
        this.lastPoint = null;
        this.transformStartWorldX = 0;
        this.transformStartWorldY = 0;
        this.transformOriginalModelMatrix = null;
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
        this.onDrawEnd = null;
        
        this.bindEvents();
        
        console.log("✅ CanvasInteraction: 初期化成功");
        this.isInitialized = true;
    }

    /**
     * [関数責務] waitForInitialization: 外部モジュールがCanvasInteractionの初期化完了を待つためのメソッド。
     * @returns {Promise<boolean>} 初期化が完了したらtrueで解決されるPromiseを返す。
     */
    async waitForInitialization() {
        while (!this.isInitialized) {
            await new Promise(resolve => setTimeout(resolve, 100));
        }
        return true;
    }
    
    // --- Drawing Methods (as per instruction) ---

    /**
     * [関数責務] drawLine: 線の描画要求をRenderingBridgeに中継する。
     * @param {number} x0 - 開始点のX座標
     * @param {number} y0 - 開始点のY座標
     * @param {number} x1 - 終了点のX座標
     * @param {number} y1 - 終了点のY座標
     * @param {number} size - ブラシサイズ
     * @param {object} color - 色 (RGBAオブジェクト)
     * @param {boolean} isEraser - 消しゴムモードか
     * @param {number} p0 - 開始点の筆圧
     * @param {number} p1 - 終了点の筆圧
     * @param {function} pressureFunc - 筆圧計算関数
     * @param {object} layer - 対象レイヤー
     */
    drawLine(x0, y0, x1, y1, size, color, isEraser, p0, p1, pressureFunc, layer) {
      // ✅ 指示書 2: ログを挿入して動作確認可能に
      console.log(`➡️ CanvasInteraction.drawLine: 呼び出されました。 isEraser=${isEraser}`);
      this.renderingBridge.drawLine(x0, y0, x1, y1, size, color, isEraser, p0, p1, pressureFunc, layer);
    }

    /**
     * [関数責務] drawCircle: 円の描画要求をRenderingBridgeに中継する。
     * @param {number} centerX - 中心のX座標
     * @param {number} centerY - 中心のY座標
     * @param {number} radius - 半径
     * @param {object} color - 色 (RGBAオブジェクト)
     * @param {boolean} isEraser - 消しゴムモードか
     * @param {object} layer - 対象レイヤー
     */
    drawCircle(centerX, centerY, radius, color, isEraser, layer) {
      // ✅ 指示書 2: ログを挿入して動作確認可能に
      console.log(`➡️ CanvasInteraction.drawCircle: 呼び出されました。 isEraser=${isEraser}`);
      this.renderingBridge.drawCircle(centerX, centerY, radius, color, isEraser, layer);
    }

    // --- End of Drawing Methods ---

    /**
     * [関数責務] setCurrentTool: 現在使用するツール（ペン、消しゴムなど）を設定する。
     * @param {string | object | null} tool - 設定するツール名またはツールオブジェクト
     */
    setCurrentTool(tool) {
        this.currentTool = tool;
        console.log("🛠️ ツールを設定:", tool?.name ?? tool);
    }

    /**
     * [関数責務] setCurrentLayer: 現在の描画対象レイヤーを設定する。
     * @param {object} layer - 描画対象のレイヤーオブジェクト
     */
    setCurrentLayer(layer) {
        this.currentLayer = layer;
    }
    
    /**
     * [関数責務] setCurrentColor: 現在の描画色を設定する。
     * @param {string} color - 設定する色のHEX文字列（例: '#FF0000'）
     */
    setCurrentColor(color) {
      this.currentColor = color;
    }

    /**
     * [関数責務] setCurrentSize: 現在のブラシサイズを設定する。
     * @param {number} size - 設定するブラシのサイズ（ピクセル単位）
     */
    setCurrentSize(size) {
      this.brushSize = size;
    }

    /**
     * [関数責務] getCurrentLayer: 現在アクティブなレイヤーオブジェクトを返す。
     * @returns {object} 現在のレイヤーオブジェクト
     */
    getCurrentLayer() {
        return this.currentLayer;
    }

    /**
     * [関数責務] bindEvents: ポインターイベント（ダウン、ムーブ、アップ）などのDOMイベントリスナーを登録する。
     */
    bindEvents() {
        this.canvasArea.addEventListener('pointerdown', this.onPointerDown.bind(this));
        document.addEventListener('pointermove', this.onPointerMove.bind(this));
        document.addEventListener('pointerup', this.onPointerUp.bind(this));
        document.addEventListener('contextmenu', e => e.preventDefault());
        document.getElementById('saveMergedButton')?.addEventListener('click', () => this.exportMergedImage());
    }

    /**
     * [関数責務] _isPointOnLayer: 指定されたワールド座標が、レイヤーのバウンディングボックス内に存在するかどうかを判定する。
     * @private
     * @param {object} worldCoords - ワールド座標 {x, y}
     * @param {object} layer - 判定対象のレイヤー
     * @returns {boolean} 座標がレイヤー上にあればtrue
     */
    _isPointOnLayer(worldCoords, layer) {
        if (!layer || !layer.visible) return false;
        const sourceImage = layer.transformStage || layer.imageData;
        const currentActiveLayer = this.app.layerManager?.getCurrentLayer?.();
        if (!currentActiveLayer || !isValidMatrix(currentActiveLayer.modelMatrix)) return false;

        const SUPER_SAMPLING_FACTOR = this.renderingBridge.currentEngine?.SUPER_SAMPLING_FACTOR || 1.0;
        const superX = worldCoords.x * SUPER_SAMPLING_FACTOR;
        const superY = worldCoords.y * SUPER_SAMPLING_FACTOR;
        const local = transformWorldToLocal(superX, superY, layer.modelMatrix, mat4);
        const layerWidth = sourceImage.width * SUPER_SAMPLING_FACTOR;
        const layerHeight = sourceImage.height * SUPER_SAMPLING_FACTOR;
        return local.x >= 0 && local.x < layerWidth && local.y >= 0 && local.y < layerHeight;
    }

    /**
     * [関数責務] onPointerDown: ポインター（マウス、ペン、タッチ）が押されたときの処理を行う。
     * 描画の開始、視点移動（パン）の開始、レイヤー移動の開始など、現在の状態に応じて適切なアクションを起動する。
     * @param {PointerEvent} e - ポインターイベントオブジェクト
     */
    onPointerDown(e) {
        if (e.button !== 0) return;

        // ✅ 指示書 3: レイヤーは必ず layerManager.getActiveLayer() などで取得
        const activeLayer = this.app.layerManager?.getCurrentLayer?.();
        // 描画開始前に activeLayer の存在を厳密にチェック
        if (!activeLayer || !activeLayer.visible) {
            console.warn("🎨 CanvasInteraction.onPointerDown: 描画対象のアクティブレイヤーが見つからないか、非表示です。");
            return;
        }

        const coords = getCanvasCoordinates(e, this.canvas, this.viewTransform);
        
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
            this.transformStartWorldX = Math.round(coords.x);
            this.transformStartWorldY = Math.round(coords.y);
            return;
        }

        const SUPER_SAMPLING_FACTOR = this.renderingBridge.currentEngine?.SUPER_SAMPLING_FACTOR || 1.0;
        const superX = coords.x * SUPER_SAMPLING_FACTOR;
        const superY = coords.y * SUPER_SAMPLING_FACTOR;
        
        // ✅ 指示書 3: レイヤーのモデル行列を使ってローカル座標に変換
        const local = transformWorldToLocal(superX, superY, activeLayer.modelMatrix, mat4);
        this._resetDirtyRect();

        // ✅ 指示書 3: サイズ・色は penSettingsManager/colorManager で取得
        const currentColor = this.app.colorManager?.currentColor ?? '#000000';
        const currentSize = this.app.penSettingsManager?.currentSize ?? 10;
        const currentTool = this.app.toolManager.getTool(); // ✅ 指示書 1: getCurrentTool() を通じた描画情報の取得

        if (currentTool === 'bucket') {
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
        const size = this.calculatePressureSize(currentSize, this.lastPoint.pressure);
        this._updateDirtyRect(local.x, local.y, size);
        
        const isEraser = currentTool === 'eraser';
        // Use the new drawCircle method
        this.drawCircle(local.x, local.y, size / 2, hexToRgba(currentColor), isEraser, activeLayer);
        
        this._requestRender();
        document.documentElement.setPointerCapture(e.pointerId);
    }

    /**
     * [関数責務] onPointerMove: ポインターが移動したときの処理を行う。
     * 描画中であれば線を描画し、パン中であれば視点を移動し、レイヤー移動中であればレイヤーを動かす。
     * @param {PointerEvent} e - ポインターイベントオブジェクト
     */
    onPointerMove(e) {
        const coords = getCanvasCoordinates(e, this.canvas, this.viewTransform);
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

            const activeLayer = this.app.layerManager?.getCurrentLayer?.();
            if (!activeLayer || !activeLayer.transformStage || !this.transformDragStarted) return;
            
            const dx = coords.x - this.transformStartWorldX;
            const dy = coords.y - this.transformStartWorldY;
            const SUPER_SAMPLING_FACTOR = this.renderingBridge.currentEngine?.SUPER_SAMPLING_FACTOR || 1.0;

            const adjustedDx = Math.round(dx * SUPER_SAMPLING_FACTOR);
            const adjustedDy = Math.round(dy * SUPER_SAMPLING_FACTOR);

            const translationMatrix = mat4.create();
            mat4.fromTranslation(translationMatrix, [adjustedDx, adjustedDy, 0]);
            const newMatrix = mat4.create();
            mat4.multiply(newMatrix, translationMatrix, this.transformOriginalModelMatrix);
            activeLayer.modelMatrix = newMatrix;
            this.renderAllLayers();
            return;
        }
        if (this.isDrawing) {
            // ✅ 指示書 3: レイヤーは必ず layerManager.getActiveLayer() などで取得
            const activeLayer = this.app.layerManager?.getCurrentLayer?.();
            if (!activeLayer) return;
            
            // ✅ 指示書 3: サイズ・色は penSettingsManager/colorManager で取得
            const currentSize = this.app.penSettingsManager?.currentSize ?? 10;
            const currentColor = this.app.colorManager?.currentColor ?? '#000000';
            const currentTool = this.app.toolManager.getTool(); // ✅ 指示書 1: getCurrentTool() を通じた描画情報の取得

            const SUPER_SAMPLING_FACTOR = this.renderingBridge.currentEngine?.SUPER_SAMPLING_FACTOR || 1.0;
            const superX = coords.x * SUPER_SAMPLING_FACTOR;
            const superY = coords.y * SUPER_SAMPLING_FACTOR;

            // ✅ 指示書 3: レイヤーのモデル行列を使ってローカル座標に変換
            const local = transformWorldToLocal(superX, superY, activeLayer.modelMatrix, mat4);
            const currentPressure = e.pressure > 0 ? e.pressure : 0.5;
            this.pressureHistory.push(currentPressure);
            if (this.pressureHistory.length > this.maxPressureHistory) this.pressureHistory.shift();
            
            const lastSize = this.calculatePressureSize(currentSize, this.lastPoint.pressure);
            const size = this.calculatePressureSize(currentSize, currentPressure);
            this._updateDirtyRect(this.lastPoint.x, this.lastPoint.y, lastSize);
            this._updateDirtyRect(local.x, local.y, size);

            const isEraser = currentTool === 'eraser';
            // Use the new drawLine method
            // ✅ 指示書 1: canvasManager.drawLine(...) を呼ぶ
            this.drawLine(
                this.lastPoint.x, this.lastPoint.y, 
                local.x, local.y, 
                currentSize, hexToRgba(currentColor), isEraser, 
                this.lastPoint.pressure, currentPressure, 
                this.calculatePressureSize.bind(this), activeLayer
            );

            this.lastPoint = { ...local, pressure: currentPressure };
            this._requestRender();
            return;
        }
        this.updateCursor(coords);
    }

    /**
     * [関数責務] onPointerUp: ポインターが離されたときの処理を行う。
     * 描画を終了し、GPUからCPUへ描画結果を同期し、Undo履歴に現在の状態を保存する。
     * @param {PointerEvent} e - ポインターイベントオブジェクト
     */
    async onPointerUp(e) {
        if (this.isDrawing) {
            this.isDrawing = false;
            if (this.animationFrameId) {
                cancelAnimationFrame(this.animationFrameId);
                this.animationFrameId = null;
            }
            this._renderDirty();
            const activeLayer = this.app.layerManager?.getCurrentLayer?.();
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

    /**
     * [関数責務] performDelayedLayerClear: レイヤー変形開始時に、元のレイヤー描画をクリアするための準備を行う。
     * 実際にドラッグが開始されるまでクリア処理を遅延させるために使用される。
     */
    performDelayedLayerClear() {
        if (!this.layerTransformPending || this.transformDragStarted) return;
        const activeLayer = this.app.layerManager?.getCurrentLayer?.();
        if (!activeLayer) return;
        this.transformDragStarted = true;
    }

    /**
     * [関数責務] startLayerTransform: レイヤー変形モードを開始する。
     * 変形前のレイヤーの状態を`transformStage`にバックアップし、変形操作の準備を整える。
     */
    startLayerTransform() {
        if (this.isLayerTransforming) return;
        const activeLayer = this.app.layerManager?.getCurrentLayer?.();
        if (!activeLayer || !activeLayer.visible) return;

        this.isLayerTransforming = true;
        
        if (activeLayer.gpuDirty) {
            this.renderAllLayers();
        }

        const syncedImageData = this.renderingBridge.getTransformedImageData(activeLayer);

        if (syncedImageData) {
            activeLayer.transformStage = syncedImageData;
        } else {
            console.error("Failed to sync ImageData from GPU for transformStage. Aborting transform.");
            this.isLayerTransforming = false;
            return;
        }

        this.layerTransformPending = true;
        this.transformDragStarted = false;
        this.transformOriginalModelMatrix = mat4.clone(activeLayer.modelMatrix);
        this.updateCursor();
    }

    /**
     * [関数責務] commitLayerTransform: レイヤー変形を確定する。
     * GPU上で変形されたレイヤーの最終的な状態をImageDataとして取得し、元のレイヤーデータに焼き込む。
     */
    async commitLayerTransform() {
        if (!this.isLayerTransforming) return;
        const activeLayer = this.app.layerManager?.getCurrentLayer?.();

        if (this.layerTransformPending && !this.transformDragStarted) {
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
        finalMatrix[12] = Math.round(finalMatrix[12]);
        finalMatrix[13] = Math.round(finalMatrix[13]);
        
        const transformedImageData = this.renderingBridge.getTransformedImageData(activeLayer);
        
        if (!transformedImageData || transformedImageData.width === 0 || transformedImageData.height === 0) {
            console.warn("転写失敗: ImageDataが空のため、操作をキャンセルしてバックアップから復元します。");
            this.restoreLayerBackup();
        } else {
            activeLayer.imageData.data.set(transformedImageData.data);
            mat4.identity(activeLayer.modelMatrix);
            activeLayer.gpuDirty = true;
            await this.onDrawEnd?.(activeLayer);
        }
        
        activeLayer.transformStage = null;
        this.transformOriginalModelMatrix = null;
        this.layerTransformPending = false;
        this.transformDragStarted = false;

        this.setCurrentLayer(activeLayer);
        this.renderAllLayers();
        this.saveState();
        this.updateCursor();
    }

    /**
     * [関数責務] cancelLayerTransform: レイヤー変形をキャンセルする。レイヤーの状態を変形開始前の状態に戻す。
     */
    cancelLayerTransform() {
        if (!this.isLayerTransforming) return;
        const activeLayer = this.app.layerManager?.getCurrentLayer?.();

        if (this.layerTransformPending && !this.transformDragStarted) {
            this.isLayerTransforming = false;
            this.layerTransformPending = false;
            if (activeLayer) activeLayer.transformStage = null;
            this.transformOriginalModelMatrix = null;
            this.updateCursor();
            return;
        }
        
        this.isLayerTransforming = false;
        if (activeLayer && this.transformOriginalModelMatrix) {
            activeLayer.modelMatrix = mat4.clone(this.transformOriginalModelMatrix);
            activeLayer.gpuDirty = true;
            activeLayer.transformStage = null;
        }

        this.transformOriginalModelMatrix = null;
        this.layerTransformPending = false;
        this.transformDragStarted = false;
        
        this.renderAllLayers();
        this.updateCursor();
    }
    
    /**
     * [関数責務] restoreLayerBackup: 変形処理などで問題が発生した際に、変形開始前の状態にレイヤーを復元する。
     */
    restoreLayerBackup() {
        const activeLayer = this.app.layerManager?.getCurrentLayer?.();
        if (!this.transformOriginalModelMatrix || !activeLayer) return;

        activeLayer.modelMatrix = mat4.clone(this.transformOriginalModelMatrix);
        activeLayer.gpuDirty = true;
        activeLayer.transformStage = null;
        this.transformOriginalModelMatrix = null;
        
        this.renderAllLayers();
    }

    /**
     * [関数責務] applyLayerTransform: 現在変形中のレイヤーに対して、移動、拡大縮小、回転などの変形を適用する。
     * @param {object} transform - 適用する変形の情報 { translation, scale, rotation, flip }
     */
    applyLayerTransform({ translation = [0, 0, 0], scale = 1.0, rotation = 0, flip = null }) {
        if (!this.isLayerTransforming || !this.transformOriginalModelMatrix) return;
        this.performDelayedLayerClear();
        if (!this.transformDragStarted) {
             this.transformDragStarted = true;
        }

        const activeLayer = this.app.layerManager?.getCurrentLayer?.();
        if (!activeLayer) return;
        const SUPER_SAMPLING_FACTOR = this.renderingBridge.currentEngine?.SUPER_SAMPLING_FACTOR || 1.0;
        const adjustedTranslation = [translation[0] * SUPER_SAMPLING_FACTOR, translation[1] * SUPER_SAMPLING_FACTOR, translation[2]];
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
        
        this.renderAllLayers();
    }

    /**
     * [関数責務] _renderDirty: ダーティ矩形（更新が必要な領域）内のみを再描画する。
     * @private
     */
    _renderDirty() {
        const rect = this.dirtyRect;
        if (rect.minX > rect.maxX) return;
        // ✅ 指示書: ログを挿入
        console.log("➡️ CanvasInteraction.compositeLayers: 呼び出し");
        this.renderingBridge.compositeLayers(this.app.layerManager.layers, null, rect);
        this.renderingBridge.renderToDisplay(null, rect);
    }

    /**
     * [関数責務] renderAllLayers: キャンバス全体を強制的に再描画する。レイヤーの表示/非表示切り替えなど、全体に影響がある場合に使用する。
     */
    renderAllLayers() {
        const SUPER_SAMPLING_FACTOR = this.renderingBridge.currentEngine?.SUPER_SAMPLING_FACTOR || 1.0;
        this.dirtyRect = { minX: 0, minY: 0, maxX: this.width * SUPER_SAMPLING_FACTOR, maxY: this.height * SUPER_SAMPLING_FACTOR };
        this._requestRender();
    }

    /**
     * [関数責務] _requestRender: `requestAnimationFrame` を使用して、ブラウザの次の描画タイミングで効率的に再描画をスケジュールする。
     * @private
     */
    _requestRender() {
        if (!this.animationFrameId) {
            this.animationFrameId = requestAnimationFrame(() => {
                this._renderDirty();
                this.animationFrameId = null;
            });
        }
    }

    /**
     * [関数責務] _updateDirtyRect: 描画が行われた領域を元に、再描画が必要な矩形領域（ダーティ矩形）を更新する。
     * @private
     * @param {number} x - 描画点のX座標
     * @param {number} y - 描画点のY座標
     * @param {number} radius - 描画点の半径
     */
    _updateDirtyRect(x, y, radius) {
        const margin = Math.ceil(radius) + 2;
        this.dirtyRect.minX = Math.min(this.dirtyRect.minX, x - margin);
        this.dirtyRect.minY = Math.min(this.dirtyRect.minY, y - margin);
        this.dirtyRect.maxX = Math.max(this.dirtyRect.maxX, x + margin);
        this.dirtyRect.maxY = Math.max(this.dirtyRect.maxY, y + margin);
    }

    /**
     * [関数責務] _resetDirtyRect: ダーティ矩形の範囲をリセットする。新しい描画ストロークの開始時などに呼び出される。
     * @private
     */
    _resetDirtyRect() {
        this.dirtyRect = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity };
    }

    /**
     * [関数責務] calculatePressureSize: 筆圧の値（0～1）と設定を元に、実際のブラシ描画サイズを計算する。
     * 筆圧のスムージングや、最小/最大サイズ、カーブ補正などを考慮する。
     * @param {number} baseSizeInput - ユーザーが設定した基本のブラシサイズ
     * @param {number} pressure - 現在の筆圧 (0.0 - 1.0)
     * @returns {number} 筆圧が適用された最終的なブラシサイズ
     */
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

    /**
     * [関数責務] saveState: 現在の全レイヤーの状態（画像データ、可視性、行列など）をUndo/Redo用の履歴として保存する。
     */
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

    /**
     * [関数責務] restoreState: 指定された履歴の状態にアプリケーション全体（特にレイヤー）を復元する。Undo/Redo処理で使用される。
     * @param {object} state - `saveState`で保存された履歴オブジェクト
     */
    restoreState(state) {
        this.app.layerManager.layers = state.layers.map(layerData => {
            const layer = new this.app.Layer(layerData.name, layerData.imageData.width, layerData.imageData.height, layerData.id);
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
        this.setCurrentLayer(this.app.layerManager?.getCurrentLayer?.());
        this.app.layerUIManager.renderLayers?.();
        this.renderAllLayers();
    }

    /**
     * [関数責務] undo: 操作を1つ元に戻す。
     */
    undo() { if (this.historyIndex > 0) { this.historyIndex--; this.restoreState(this.history[this.historyIndex]); } }
    /**
     * [関数責務] redo: 元に戻した操作を1つやり直す。
     */
    redo() { if (this.historyIndex < this.history.length - 1) { this.historyIndex++; this.restoreState(this.history[this.historyIndex]); } }

    /**
     * [関数責務] updateCursor: 現在のツールやポインターの位置に応じて、マウスポインターの形状を変更する。
     * @param {object} coords - ポインターの現在のキャンバス座標 {x, y}
     */
    updateCursor(coords) {
        if (this.isLayerTransforming) { this.canvasArea.style.cursor = 'move'; return; }
        if (this.isPanning) { this.canvasArea.style.cursor = 'grabbing'; return; }
        if (this.isSpaceDown) { this.canvasArea.style.cursor = 'grab'; return; }
        const activeLayer = this.app.layerManager?.getCurrentLayer?.();
        if (activeLayer && coords && this._isPointOnLayer(coords, activeLayer)) {
            switch (this.app.toolManager.getTool()) {
                case 'pen': this.canvasArea.style.cursor = 'crosshair'; break;
                case 'eraser': this.canvasArea.style.cursor = 'cell'; break;
                case 'bucket': this.canvasArea.style.cursor = 'copy'; break;
                default: this.canvasArea.style.cursor = 'crosshair';
            }
        } else {
            this.canvasArea.style.cursor = 'not-allowed';
        }
    }

    /**
     * [関数責務] applyViewTransform: 視点（ビュー）の変形（移動、拡大縮小、回転）をCSS transformとしてキャンバスコンテナに適用する。
     */
    applyViewTransform() { const t = this.viewTransform; this.canvasContainer.style.transform = `translate(${t.left}px, ${t.top}px) scale(${t.scale * t.flipX}, ${t.scale * t.flipY}) rotate(${t.rotation}deg)`; }
    /**
     * [関数責務] flipHorizontal: 表示を水平に反転させる。
     */
    flipHorizontal() { this.viewTransform.flipX *= -1; this.applyViewTransform(); }
    /**
     * [関数責務] flipVertical: 表示を垂直に反転させる。
     */
    flipVertical() { this.viewTransform.flipY *= -1; this.applyViewTransform(); }
    /**
     * [関数責務] zoom: 表示を拡大・縮小する。
     * @param {number} factor - 拡大率
     */
    zoom(factor) { this.viewTransform.scale = Math.max(0.1, this.viewTransform.scale * factor); this.applyViewTransform(); }
    /**
     * [関数責務] rotate: 表示を回転させる。
     * @param {number} degrees - 回転させる角度
     */
    rotate(degrees) { this.viewTransform.rotation = (this.viewTransform.rotation + degrees) % 360; this.applyViewTransform(); }
    /**
     * [関数責務] resetView: 表示の変形をすべてリセットし、初期状態に戻す。
     */
    resetView() { this.viewTransform = { scale: 1, rotation: 0, flipX: 1, flipY: 1, left: 0, top: 0 }; this.applyViewTransform(); }
    /**
     * [関数責務] handleWheel: マウスホイールイベントを処理し、ズームや回転（Shiftキー同時押し）を行う。
     * @param {WheelEvent} e - ホイールイベントオブジェクト
     */
    handleWheel(e) { e.preventDefault(); if (this.isLayerTransforming) { return; } if (e.shiftKey) { this.rotate(-e.deltaY * 0.2); } else { this.zoom(e.deltaY > 0 ? 1 / 1.05 : 1.05); } }
    exportMergedImage() { /* ... */ }
}