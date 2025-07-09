/*
 * ===================================================================================
 * Toshinka Tegaki Tool - Core Engine
 * Version: 3.0.0 (Phase 4A11B-9 - Transform Stabilized)
 *
 * - 変更点 (Phase 4A11B-9):
 * - 「📜 Phase4A11B-9」指示書に基づき、レイヤーの移動・変形処理を安定化。
 *
 * - 1. 変形モードの導入:
 * - Vキーによるレイヤー変形を「変形モード」として明確に管理。
 * `isLayerTransforming`, `cellBufferInitialized` フラグを導入。
 * - 変形開始(`startLayerTransform`), 確定(`commitLayerTransform`), 
 * キャンセル(`cancelLayerTransform`)の各関数を新設し、ロジックを整理。
 *
 * - 2. セルバッファと変形ロジックの改善:
 * - 変形中は、元のレイヤー内容をセルバッファに退避。
 * - マウスドラッグやキーボード操作で modelMatrix を更新し、変形後のプレビューを表示。
 * - 変形確定時に、`getTransformedImageData` で見た目通りの画像を生成してレイヤーに焼き付け、
 * レイヤーの modelMatrix は初期状態に戻すことで、座標の破綻を防ぐ。
 *
 * - 3. ショートカット連携の強化:
 * - `shortcut-manager`から呼び出されることを想定した`applyLayerTransform`関数を実装。
 * これにより、キーボードによる移動・拡縮・回転が可能に。
 *
 * - 4. コードのモジュール化:
 * - `transform-utils.js` から座標変換関数をインポートするように変更し、
 * `core-engine.js`内の重複したコードを削除。
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
// ★★★★★ 修正 (Phase 4A11B-9) ★★★★★
// transform-utils.jsから関数をインポート
import { isValidMatrix, transformWorldToLocal } from './core/utils/transform-utils.js';


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

// ★★★★★ 修正 (Phase 4A11B-9) ★★★★★
// 汎用関数は transform-utils.js に集約したため、ここの定義は削除

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
        this.isDraggingLayer = false; // マウスでのレイヤー移動中かどうかのフラグ

        // ★★★★★ 修正 (Phase 4A11B-9) ★★★★★
        // 変形モード用の状態フラグを定義
        this.isLayerTransforming = false; // VキーでON/OFFされる変形モード全体の状態
        this.cellBufferInitialized = false; // セルバッファが初期化されたか
        
        this.isSpaceDown = false;
        this.isVDown = false; // Vキーが押されているか
        
        // セルバッファ：変形対象のレイヤー情報を一時的に保持する場所
        this.cellBuffer = null; // { imageData, originalModelMatrix }
        
        this.lastPoint = null;
        
        // 変形開始時のマウス座標
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
        
        // Vキーの状態は shortcut-manager で管理・通知される
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

        // --- パンニング処理 ---
        if (this.isSpaceDown) {
            this.isPanning = true;
            this.dragStartX = e.clientX; 
            this.dragStartY = e.clientY; 
            this.canvasStartX = this.viewTransform.left; 
            this.canvasStartY = this.viewTransform.top;
            return;
        }

        // ★★★★★ 修正 (Phase 4A11B-9) ★★★★★
        // --- レイヤー移動開始処理 (マウスドラッグ) ---
        if (this.isLayerTransforming) {
            if (!activeLayer.visible) return;

            this.isDraggingLayer = true; // マウスでの移動を開始
            this.transformStartWorldX = coords.x;
            this.transformStartWorldY = coords.y;
            
            // `startLayerTransform`でバッファは初期化済みなので、ここでは何もしない
            // マウスの初期位置だけ記録する
            console.log("🖱️ レイヤーのドラッグ移動を開始します。");

            return; // 通常の描画処理は行わない
        }
        
        // --- 通常の描画開始処理 ---
        if (!activeLayer.visible || !this._isPointOnLayer(coords, activeLayer)) {
            return;
        }

        const SUPER_SAMPLING_FACTOR = this.renderingBridge.currentEngine?.SUPER_SAMPLING_FACTOR || 1.0;
        const superX = coords.x * SUPER_SAMPLING_FACTOR;
        const superY = coords.y * SUPER_SAMPLING_FACTOR;
        const local = transformWorldToLocal(superX, superY, activeLayer.modelMatrix);
        
        // ログの表示形式を指示書に合わせる
        console.log("📍 描画座標変換:", { world: coords, super: {x: superX, y: superY}, local: local });

        this._resetDirtyRect();
        
        // バケツツール処理
        if (this.app.toolManager.currentTool === 'bucket') {
            this.app.bucketTool.fill(activeLayer.imageData, Math.round(local.x), Math.round(local.y), hexToRgba(this.app.colorManager.currentColor));
            activeLayer.gpuDirty = true;
            this.renderAllLayers();
            this.saveState();
            return;
        }

        // ペン・消しゴム処理
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

        // --- パンニング中の処理 ---
        if (this.isPanning) {
            const dx = e.clientX - this.dragStartX; 
            const dy = e.clientY - this.dragStartY;
            this.viewTransform.left = this.canvasStartX + dx; 
            this.viewTransform.top = this.canvasStartY + dy;
            this.applyViewTransform(); 
            return;
        }

        // ★★★★★ 修正 (Phase 4A11B-9) ★★★★★
        // --- レイヤー移動中の処理 (マウスドラッグ) ---
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
            // 移動開始時の行列に、現在のマウス移動量を乗算
            mat4.multiply(newMatrix, translationMatrix, this.cellBuffer.originalModelMatrix);
            activeLayer.modelMatrix = newMatrix;

            // セルバッファから画像データを書き戻し、移動中の絵を表示
            activeLayer.imageData.data.set(this.cellBuffer.imageData.data);
            activeLayer.gpuDirty = true;
            
            this.renderAllLayers();
            return;
        }

        // --- 通常の描画中の処理 ---
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
        // --- 描画完了処理 ---
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
        
        // ★★★★★ 修正 (Phase 4A11B-9) ★★★★★
        // --- レイヤーのドラッグ移動完了 ---
        if (this.isDraggingLayer) {
            this.isDraggingLayer = false;
            console.log("🖱️ レイヤーのドラッグ移動が完了しました。Vキーを離すと位置が確定されます。");
            // Vキーを離すまで変形モードは続くので、ここでは何もしない
        }

        this.isPanning = false;
        if (document.documentElement.hasPointerCapture(e.pointerId)) {
            document.documentElement.releasePointerCapture(e.pointerId);
        }
    }

    // ★★★★★ 新設 (Phase 4A11B-9) ★★★★★
    /**
     * レイヤー変形モードを開始する
     */
    startLayerTransform() {
        if (this.isLayerTransforming) return; // すでにモード中の場合は何もしない

        const activeLayer = this.app.layerManager.getCurrentLayer();
        if (!activeLayer || !activeLayer.visible) {
            console.warn("⚠️ 変形対象の表示レイヤーがありません。");
            return;
        }

        this.isLayerTransforming = true;
        
        // 1. アクティブレイヤーの現在の内容と行列をセルバッファにコピーして退避
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

        // 2. アクティブレイヤーを一時的にクリアして「持ち上げた」見た目にする
        //    (変形プレビュー時にセルバッファの内容で上書きされる)
        activeLayer.clear();
        
        // 3. クリアした状態を画面に一度反映
        this.renderAllLayers();
        
        // 4. 元のレイヤーをセルバッファの内容で再度上書きして、変形開始前の状態に戻す
        //    これにより、ドラッグやキー操作をしなくても見た目が変わらない
        activeLayer.imageData.data.set(this.cellBuffer.imageData.data);
        activeLayer.gpuDirty = true;
        this.renderAllLayers();
    }

    /**
     * レイヤー変形を確定する
     */
    commitLayerTransform() {
        if (!this.isLayerTransforming) return;

        this.isLayerTransforming = false;
        
        const activeLayer = this.app.layerManager.getCurrentLayer();
        if (!this.cellBufferInitialized || !activeLayer) {
            this.cellBuffer = null;
            this.cellBufferInitialized = false;
            return;
        }
        
        console.log("📋 変形確定処理開始: セルバッファ → レイヤーへ転写します。");

        // 1. `getTransformedImageData`を使い、移動後の見た目通りの画像データを生成
        const transformedImageData = this.renderingBridge.getTransformedImageData(activeLayer);
        
        // 2. 転写が成功したかチェック
        if (transformedImageData) {
            // 3a. 成功：生成された画像データでレイヤーの内容を確定（焼き付け）
            activeLayer.imageData.data.set(transformedImageData.data);
            console.log("✅ 転写成功");
        } else {
            // 3b. 失敗：エラーを表示し、元の画像データを復元して操作をキャンセル
            console.error("❌ レイヤー転写に失敗: getTransformedImageDataがnullを返しました。");
            console.warn("変形前の状態に画像を復元します。");
            activeLayer.imageData.data.set(this.cellBuffer.imageData.data);
        }
        
        // 4. 変形は画像に焼き付けられたので、レイヤーの行列は初期状態（単位行列）に戻す
        //    これが座標系の破綻を防ぐための重要なステップ
        mat4.identity(activeLayer.modelMatrix);
        activeLayer.gpuDirty = true;
        
        // 5. セルバッファを破棄
        this.cellBuffer = null;
        this.cellBufferInitialized = false;
        console.log("🧹 セルバッファを破棄し、変形モードを終了しました。");
        
        // 6. 最終状態を画面に描画し、履歴に保存
        this.renderAllLayers();
        this.saveState();
    }

    /**
     * レイヤー変形をキャンセルする
     */
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
        // 退避しておいた元のデータと行列をレイヤーに戻す
        activeLayer.imageData.data.set(this.cellBuffer.imageData.data);
        activeLayer.modelMatrix = mat4.clone(this.cellBuffer.originalModelMatrix);
        activeLayer.gpuDirty = true;
        
        this.cellBuffer = null;
        this.cellBufferInitialized = false;

        this.renderAllLayers();
    }
    
    /**
     * キーボード操作によるレイヤー変形を適用する
     */
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
        
        // 回転や拡縮の中心を画像の中心にするための準備
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

        // 現在のレイヤーの行列に、今の変形操作を乗算する
        mat4.multiply(activeLayer.modelMatrix, transformMatrix, activeLayer.modelMatrix);

        // プレビューを更新
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
                // `isValidMatrix` をインポートしたものに置き換え
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

    restoreState(state) {
        this.app.layerManager.layers = state.layers.map(layerData => {
            const layer = new Layer(layerData.name, layerData.imageData.width, layerData.imageData.height);
            layer.visible = layerData.visible;
            layer.opacity = layerData.opacity ?? 100;
            layer.blendMode = layerData.blendMode ?? 'normal';
            layer.imageData.data.set(layerData.imageData.data);
            
            layer.modelMatrix = mat4.create();
            // `isValidMatrix` を使って、より厳密なチェックも可能だが、既存のロジックを維持
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
        // 変形モードが最優先
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
        if (this._isPointOnLayer(coords, activeLayer)) {
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
        this.layerManager.setupInitialLayers();
        this.toolManager.setTool('pen');
    }
}

window.addEventListener('DOMContentLoaded', () => {
    if (!window.toshinkaTegakiInitialized) {
        window.toshinkaTegakiInitialized = true;
        window.toshinkaTegakiTool = new ToshinkaTegakiTool();
    }
});