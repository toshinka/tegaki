import { mat4, vec4 } from 'gl-matrix';

// --- Utility Functions (from canvas-manager.js) ---

/**
 * 16進数カラーコードをRGBAオブジェクトに変換します。
 * @param {string} hex - #RRGGBB形式のカラーコード
 * @returns {{r: number, g: number, b: number, a: number}}
 */
function hexToRgba(hex) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16),
        a: 255
    } : { r: 0, g: 0, b: 0, a: 255 };
}

/**
 * イベント座標をキャンバス座標に変換します。
 * @param {PointerEvent} e - ポインタイベント
 * @param {HTMLCanvasElement} canvas - キャンバス要素
 * @param {object} viewTransform - 表示変形情報
 * @returns {{x: number, y: number}}
 */
function getCanvasCoordinates(e, canvas, viewTransform) {
    const rect = canvas.getBoundingClientRect();
    let x = e.clientX - rect.left;
    let y = e.clientY - rect.top;

    if (!canvas || !rect) return { x: 0, y: 0 };

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

// TODO: 明示的に承認されていない関数名
// transformWorldToLocal は、提供されていない utils/transform-utils.js 内で定義されています。
// これは、canvas-manager.js での使用方法に基づいた再実装です。
/**
 * ワールド座標をレイヤーのローカル座標に変換します。
 * @param {number} worldX - ワールドX座標
 * @param {number} worldY - ワールドY座標
 * @param {mat4} modelMatrix - レイヤーのモデル行列
 * @returns {{x: number, y: number}|null}
 */
function transformWorldToLocal(worldX, worldY, modelMatrix) {
    const invMatrix = mat4.create();
    if (mat4.invert(invMatrix, modelMatrix)) {
        const worldVec = [worldX, worldY, 0, 1];
        const localVec = [0, 0, 0, 1];
        vec4.transformMat4(localVec, worldVec, invMatrix);
        return { x: localVec[0], y: localVec[1] };
    }
    return null; // Inversion failed
}


export class ToolManager {
    constructor(app) {
        this.app = app;
        this.currentTool = 'pen'; // 初期ツール
        this.isDrawing = false;
        this.lastPoint = null;
        this.canvasArea = null;

        // CanvasManagerの初期化を待ってからイベントリスナーを登録
        this.app.canvasManager.waitForInitialization().then(() => {
            this.canvasArea = document.getElementById('canvas-area');
            this.bindEvents();
        });
    }

    bindEvents() {
        if (this.canvasArea) {
            this.canvasArea.addEventListener('pointerdown', this.onPointerDown.bind(this));
            document.addEventListener('pointermove', this.onPointerMove.bind(this));
            document.addEventListener('pointerup', this.onPointerUp.bind(this));
            console.log('🛠️ ToolManager: ポインタイベントの登録が完了しました。');
        } else {
            console.error('❌ ToolManager: #canvas-area が見つかりません。');
        }
    }

    setTool(toolName) {
        this.currentTool = toolName;
        if (this.app.canvasManager) {
            this.app.canvasManager.setCurrentTool(toolName);
        }
        console.log(`🛠️ ツールが '${toolName}' に設定されました。`);
    }

    getTool() {
        return this.currentTool;
    }

    onPointerDown(e) {
        // 左クリック以外、またはパンやレイヤー変形中は描画しない
        if (e.button !== 0 || this.app.canvasManager.isPanning || this.app.canvasManager.isLayerTransforming) {
            return;
        }

        const tool = this.getTool();
        // ペンか消しゴムでなければ何もしない
        if (tool !== 'pen' && tool !== 'eraser') {
            return;
        }

        const activeLayer = this.app.layerManager?.getCurrentLayer();
        if (!activeLayer || !active.visible) return;

        this.isDrawing = true;

        const canvas = this.app.canvasManager.canvas;
        const viewTransform = this.app.canvasManager.viewTransform;
        const coords = getCanvasCoordinates(e, canvas, viewTransform);

        const SUPER_SAMPLING_FACTOR = this.app.canvasManager.renderingBridge.currentEngine?.SUPER_SAMPLING_FACTOR || 1.0;
        const superX = coords.x * SUPER_SAMPLING_FACTOR;
        const superY = coords.y * SUPER_SAMPLING_FACTOR;

        const local = transformWorldToLocal(superX, superY, activeLayer.modelMatrix);
        if (!local) {
            this.isDrawing = false;
            return;
        }

        this.app.canvasManager._resetDirtyRect();

        const currentColor = this.app.colorManager?.currentColor ?? '#000000';
        const currentSize = this.app.penSettingsManager?.currentSize ?? 10;
        const isEraser = this.getTool() === 'eraser';

        const pressure = e.pressure > 0 ? e.pressure : 0.5;
        this.app.canvasManager.pressureHistory = [pressure];
        this.lastPoint = { ...local, pressure };

        const size = this.app.canvasManager.calculatePressureSize(currentSize, this.lastPoint.pressure);
        this.app.canvasManager._updateDirtyRect(local.x, local.y, size);

        // 最初の点を円で描画
        this.app.canvasManager.drawCircle(local.x, local.y, size / 2, hexToRgba(currentColor), isEraser, activeLayer);

        this.app.canvasManager._requestRender();
        document.documentElement.setPointerCapture(e.pointerId);
    }

    onPointerMove(e) {
        if (!this.isDrawing) return;

        const activeLayer = this.app.layerManager?.getCurrentLayer();
        if (!activeLayer) return;

        const canvas = this.app.canvasManager.canvas;
        const viewTransform = this.app.canvasManager.viewTransform;
        const coords = getCanvasCoordinates(e, canvas, viewTransform);

        const SUPER_SAMPLING_FACTOR = this.app.canvasManager.renderingBridge.currentEngine?.SUPER_SAMPLING_FACTOR || 1.0;
        const superX = coords.x * SUPER_SAMPLING_FACTOR;
        const superY = coords.y * SUPER_SAMPLING_FACTOR;

        const local = transformWorldToLocal(superX, superY, activeLayer.modelMatrix);
        if (!local) return;
        
        const currentPressure = e.pressure > 0 ? e.pressure : 0.5;
        const pressureHistory = this.app.canvasManager.pressureHistory;
        pressureHistory.push(currentPressure);
        if (pressureHistory.length > this.app.canvasManager.maxPressureHistory) {
            pressureHistory.shift();
        }

        const currentColor = this.app.colorManager?.currentColor ?? '#000000';
        const currentSize = this.app.penSettingsManager?.currentSize ?? 10;
        const isEraser = this.getTool() === 'eraser';

        const lastSize = this.app.canvasManager.calculatePressureSize(currentSize, this.lastPoint.pressure);
        const size = this.app.canvasManager.calculatePressureSize(currentSize, currentPressure);
        this.app.canvasManager._updateDirtyRect(this.lastPoint.x, this.lastPoint.y, lastSize);
        this.app.canvasManager._updateDirtyRect(local.x, local.y, size);
        
        // 線を描画
        this.app.canvasManager.drawLine(
            this.lastPoint.x, this.lastPoint.y, local.x, local.y,
            currentSize, hexToRgba(currentColor), isEraser,
            this.lastPoint.pressure, currentPressure,
            this.app.canvasManager.calculatePressureSize.bind(this.app.canvasManager),
            activeLayer
        );

        this.lastPoint = { ...local, pressure: currentPressure };
        this.app.canvasManager._requestRender();
    }

    async onPointerUp(e) {
        if (!this.isDrawing) return;
        
        this.isDrawing = false;
        const canvasManager = this.app.canvasManager;

        if (canvasManager.animationFrameId) {
            cancelAnimationFrame(canvasManager.animationFrameId);
            canvasManager.animationFrameId = null;
        }
        canvasManager._renderDirty();

        const activeLayer = this.app.layerManager?.getCurrentLayer();
        if (activeLayer) {
            canvasManager.renderingBridge.syncDirtyRectToImageData(activeLayer, canvasManager.dirtyRect);
            if (canvasManager.onDrawEnd) {
                 await canvasManager.onDrawEnd(activeLayer);
            }
        }
        this.lastPoint = null;
        canvasManager.saveState();
        
        if (document.documentElement.hasPointerCapture(e.pointerId)) {
            document.documentElement.releasePointerCapture(e.pointerId);
        }
    }
}