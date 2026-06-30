/**
 * ============================================================================
 * ファイル名: system/drawing/fill-tool.js
 * 責務: バケツツール（塗りつぶし）のロジックを担当する。Flood Fill (BFS) および 投げ縄塗りを含む。
 * 依存: pixi.js, system/event-bus.js, config.js, system/history.js
 * 被依存: drawing-engine.js, brush-core.js
 * 公開API: FillTool
 * イベント発火: layer:filled, layer:restored
 * イベント受信: tool:select, tool:changed, brush:mode-changed, canvas:pointerdown
 * グローバル登録: window.FillTool
 * 実装状態: 🧪Phase 3f 表示中レイヤー参照有効化 (Flood Fill MVP + Lasso Fill 済)
 *
 * Phase 5p共通契約:
 * - 通常Layer / CAF working Layerとも、fill前に `current bounds ∪ Project frame` へRTを拡張する。
 * - CAFではboundary取得前にdrawing:stroke-startedを出し、working Layerを表示対象へ戻す。
 * - History用beforeとselection制限用beforeは分離し、selection制限はProject座標でbounds差を吸収する。
 * ============================================================================
 */

import { Container, Graphics, Sprite, Texture } from 'pixi.js';
import { TegakiEventBus } from '../event-bus.js';
import { normalizeRasterBounds } from '../raster-bounds.js';

// 塗りつぶしのしきい値定数 (Phase 3e 以降は設定UI化を検討)
const FILL_ALPHA_THRESHOLD = 24;  // これ以上の不透明度は「壁」とみなす
const FILL_COLOR_TOLERANCE = 8;   // 色の近似判定許容度 (RGB各チャンネルの合計差)

export class FillTool {
    constructor() {
        this.eventBus = TegakiEventBus;
        this.isActive = false;
        this.initialized = false;
        this.webgpuAvailable = false;
        this.lastClickLocalX = 0;
        this.lastClickLocalY = 0;

        // 🧪 Phase 3f: 表示中レイヤー参照をデフォルトで有効化
        this.settings = {
            referenceAllLayers: true,  // 表示中レイヤーすべてを参照するか
            gapClosePixels: 0,         // デフォルト: 隙間閉じOFF
            underpaintPixels: 1,       // デフォルト: 線の下へ弱めに潜り込ませる
            antialias: true            // 塗りの縁を少しぼかすか
        };
    }

    async initialize() {
        if (this.initialized) return;

        this._loadSettings();
        await this._checkWebGPUSupport();
        this._setupEventListeners();
        
        this.initialized = true;
    }

    _loadSettings() {
        const sm = window.TegakiSettingsManager;
        if (!sm) return;

        const current = sm.get();
        if (current.bucketGapClose !== undefined) this.settings.gapClosePixels = current.bucketGapClose;
        if (current.bucketUnderpaint !== undefined) this.settings.underpaintPixels = current.bucketUnderpaint;
        if (current.bucketReferenceAllLayers !== undefined) this.settings.referenceAllLayers = current.bucketReferenceAllLayers;
    }

    async _checkWebGPUSupport() {
        // Phase 1c 以降 WebGPU/SDF 経路は封印
        this.webgpuAvailable = false;
        return;
    }

    _setupEventListeners() {
        if (!this.eventBus) return;

        this.eventBus.on('tool:select', ({ tool }) => {
            this.isActive = (tool === 'fill' || tool === 'eraser-fill' || tool === 'lasso-fill');
        });

        this.eventBus.on('tool:changed', ({ tool }) => {
            this.isActive = (tool === 'fill' || tool === 'eraser-fill' || tool === 'lasso-fill');
        });

        this.eventBus.on('brush:mode-changed', (event) => {
            const mode = event?.data?.mode || event?.mode;
            this.isActive = (mode === 'fill' || mode === 'eraser-fill' || mode === 'lasso-fill');
        });

        this.eventBus.on('canvas:pointerdown', (event) => {
            if (!this.isActive) return;
            if (event.localX === undefined || event.localY === undefined) return;

            const currentMode = window.brushSettings?.getMode();
            if (currentMode !== 'fill' && currentMode !== 'eraser-fill') return;

            this.lastClickLocalX = event.localX;
            this.lastClickLocalY = event.localY;
            this.fill(event.localX, event.localY);
        });

        // 設定同期の購読
        this.eventBus.on('settings:bucket-gap-close', ({ value }) => {
            this.settings.gapClosePixels = value;
        });
        this.eventBus.on('settings:bucket-underpaint', ({ value }) => {
            this.settings.underpaintPixels = value;
        });
        this.eventBus.on('settings:bucket-reference-all-layers', ({ value }) => {
            this.settings.referenceAllLayers = value;
        });
        this.eventBus.on('settings:updated', (event) => {
            const settings = event?.settings || event;
            if (settings?.bucketReferenceAllLayers !== undefined) {
                this.settings.referenceAllLayers = settings.bucketReferenceAllLayers;
            }
        });
    }

    async fill(localX, localY) {
        const layerManager = window.layerManager;
        if (!layerManager) {
            console.error('❌ FillTool: LayerManager not found');
            return;
        }

        const brushSettings = window.brushSettings;
        if (!brushSettings) {
            console.error('❌ FillTool: BrushSettings not found');
            return;
        }

        const activeLayer = layerManager.getActiveLayer();
        if (!activeLayer || !activeLayer.layerData) {
            console.error('❌ FillTool: No active layer');
            return;
        }

        if (activeLayer.layerData.isBackground) {
            console.warn('⚠️ FillTool: Cannot fill background layer');
            return;
        }

        if (activeLayer.layerData.isFolder) {
            if (window.TEGAKI_CONFIG?.debug) {
                console.warn('⚠️ FillTool: Cannot fill folder layer');
            }
            return;
        }

        const fillColor = brushSettings.getColor();
        const fillAlpha = brushSettings.getOpacity();
        const isAnimationWorkingLayer = activeLayer.layerData?.isAnimationWorkingLayer === true;

        if (isAnimationWorkingLayer) {
            this._emitCafFillEvent('drawing:stroke-started', activeLayer, localX, localY);
        }

        const historyBeforeSnapshot = layerManager.createLayerRasterSnapshot?.(activeLayer) || null;
        this._ensureLayerRasterFrameForFill(activeLayer, layerManager);
        const workingBeforeSnapshot = layerManager.createLayerRasterSnapshot?.(activeLayer)
            || historyBeforeSnapshot;

        // 🧪 Phase 3e: 表示中レイヤー参照の判定
        let boundarySnapshot = null;
        if (this.settings.referenceAllLayers && layerManager.createCompositeDrawingSnapshot) {
            boundarySnapshot = await layerManager.createCompositeDrawingSnapshot();
        } else {
            boundarySnapshot = layerManager.createLayerRasterSnapshot?.(activeLayer);
        }

        if (!boundarySnapshot) {
            console.error('❌ FillTool: Failed to capture boundary snapshot');
            if (isAnimationWorkingLayer) {
                this.eventBus?.emit('drawing:stroke-cancelled', {
                    component: 'drawing',
                    action: 'stroke-cancelled',
                    data: {
                        layerId: activeLayer.layerData?.id,
                        mode: brushSettings.getMode?.() || 'fill'
                    }
                });
            }
            return;
        }

        try {
            this._fillLayerFloodFill(
                activeLayer,
                fillColor,
                fillAlpha,
                localX,
                localY,
                layerManager,
                boundarySnapshot,
                { historyBeforeSnapshot, workingBeforeSnapshot }
            );
            if (isAnimationWorkingLayer) {
                this._emitCafFillEvent('drawing:stroke-completed', activeLayer, localX, localY);
            }
        } catch (error) {
            if (isAnimationWorkingLayer) {
                this.eventBus?.emit('drawing:stroke-cancelled', {
                    component: 'drawing',
                    action: 'stroke-cancelled',
                    data: {
                        layerId: activeLayer.layerData?.id,
                        mode: brushSettings.getMode?.() || 'fill'
                    }
                });
            }
            throw error;
        }
    }

    /**
     * CPUベースの Flood Fill (BFS) 実装
     * @param {Container} layer 塗り対象レイヤー
     * @param {number} color 塗り色
     * @param {number} alpha 塗り不透明度
     * @param {number} localX クリックX
     * @param {number} localY クリックY
     * @param {LayerSystem} layerManager
     * @param {Object} boundarySnapshot 境界判定に使用するピクセルデータ
     */
    _fillLayerFloodFill(layer, color, alpha, localX, localY, layerManager, boundarySnapshot, options = {}) {
        const CONFIG = window.TEGAKI_CONFIG;
        const layerData = layer.layerData;
        const app = layerManager.app;
        
        if (!layerData?.renderTexture || !app?.renderer) return;

        // 塗り前のスナップショット取得（履歴用）
        const historyBeforeSnapshot = options.historyBeforeSnapshot
            || layerManager.createLayerRasterSnapshot?.(layer)
            || null;
        const beforeSnapshot = options.workingBeforeSnapshot
            || historyBeforeSnapshot
            || null;
        if (!beforeSnapshot) return;

        const { pixels, width, height } = boundarySnapshot;
        const targetBounds = normalizeRasterBounds(beforeSnapshot.rasterBounds, {
            width: beforeSnapshot.width,
            height: beforeSnapshot.height
        });
        targetBounds.width = beforeSnapshot.width;
        targetBounds.height = beforeSnapshot.height;
        let boundaryBounds = normalizeRasterBounds(boundarySnapshot.rasterBounds, {
            x: this.settings.referenceAllLayers ? 0 : targetBounds.x,
            y: this.settings.referenceAllLayers ? 0 : targetBounds.y,
            width,
            height
        });
        boundaryBounds.width = width;
        boundaryBounds.height = height;
        const croppedBoundary = this._cropBoundarySnapshotToProjectFrame(
            { ...boundarySnapshot, width, height, pixels },
            boundaryBounds,
            layerManager,
            { x: localX, y: localY }
        );
        const workingPixels = croppedBoundary?.pixels || pixels;
        const workingWidth = croppedBoundary?.width || width;
        const workingHeight = croppedBoundary?.height || height;
        if (croppedBoundary?.rasterBounds) {
            boundaryBounds = croppedBoundary.rasterBounds;
        }
        const startX = Math.floor(localX - boundaryBounds.x);
        const startY = Math.floor(localY - boundaryBounds.y);
        const selectionBounds = window.CoreRuntime?.api?.selection
            ?.getBoundsForLayer?.(layerData.id);
        const selectionRect = selectionBounds ? {
            x0: Math.max(0, Math.floor(selectionBounds.x - boundaryBounds.x)),
            y0: Math.max(0, Math.floor(selectionBounds.y - boundaryBounds.y)),
            x1: Math.min(workingWidth, Math.ceil(selectionBounds.x + selectionBounds.width - boundaryBounds.x)),
            y1: Math.min(workingHeight, Math.ceil(selectionBounds.y + selectionBounds.height - boundaryBounds.y))
        } : null;
        const isInsideSelection = (x, y) => !selectionRect || (
            x >= selectionRect.x0
            && x < selectionRect.x1
            && y >= selectionRect.y0
            && y < selectionRect.y1
        );

        if (startX < 0 || startX >= workingWidth || startY < 0 || startY >= workingHeight) return;
        if (!isInsideSelection(startX, startY)) return;

        const gap = this.settings.gapClosePixels || 0;
        const underpaint = this.settings.underpaintPixels || 0;
        if (CONFIG.debug) {
            console.log(`[FillTool] FloodFill started at (${startX}, ${startY}), gap: ${gap}, underpaint: ${underpaint}, refAllLayers: ${this.settings.referenceAllLayers}`);
        }

        // 1. Flood Fill アルゴリズムの実行 (BFS)
        const mask = new Uint8Array(workingWidth * workingHeight);
        const stack = [[startX, startY]];
        
        const startIdx = (startY * workingWidth + startX) * 4;
        const startR = workingPixels[startIdx];
        const startG = workingPixels[startIdx + 1];
        const startB = workingPixels[startIdx + 2];
        const startA = workingPixels[startIdx + 3];

        const isStartTransparent = startA < FILL_ALPHA_THRESHOLD;

        while (stack.length > 0) {
            const [x, y] = stack.pop();
            const idx = y * workingWidth + x;

            if (mask[idx] || !isInsideSelection(x, y)) continue;
            
            // 境界判定 (Gap Close 対応: 周囲 gap ピクセル内に壁があるか)
            let isWall = false;
            if (gap > 0) {
                for (let ky = -gap; ky <= gap; ky++) {
                    for (let kx = -gap; kx <= gap; kx++) {
                        const nx = x + kx;
                        const ny = y + ky;
                        if (nx >= 0 && nx < workingWidth && ny >= 0 && ny < workingHeight) {
                            const nIdx = (ny * workingWidth + nx) * 4;
                            const na = workingPixels[nIdx + 3];
                            if (isStartTransparent) {
                                if (na >= FILL_ALPHA_THRESHOLD) { isWall = true; break; }
                            } else {
                                const nr = workingPixels[nIdx];
                                const ng = workingPixels[nIdx + 1];
                                const nb = workingPixels[nIdx + 2];
                                const diff = Math.abs(nr - startR) + Math.abs(ng - startG) + Math.abs(nb - startB);
                                if (diff >= FILL_COLOR_TOLERANCE * 3) { isWall = true; break; }
                            }
                        }
                    }
                    if (isWall) break;
                }
            } else {
                const pixIdx = idx * 4;
                const a = workingPixels[pixIdx + 3];
                if (isStartTransparent) {
                    if (a >= FILL_ALPHA_THRESHOLD) isWall = true;
                } else {
                    const r = workingPixels[pixIdx];
                    const g = workingPixels[pixIdx + 1];
                    const b = workingPixels[pixIdx + 2];
                    const diff = Math.abs(r - startR) + Math.abs(g - startG) + Math.abs(b - startB);
                    if (diff >= FILL_COLOR_TOLERANCE * 3) isWall = true;
                }
            }

            if (!isWall) {
                mask[idx] = 255;
                if (x > 0 && isInsideSelection(x - 1, y)) stack.push([x - 1, y]);
                if (x < workingWidth - 1 && isInsideSelection(x + 1, y)) stack.push([x + 1, y]);
                if (y > 0 && isInsideSelection(x, y - 1)) stack.push([x, y - 1]);
                if (y < workingHeight - 1 && isInsideSelection(x, y + 1)) stack.push([x, y + 1]);
            }
        }

        // 2. Gap Close dilation (if any)
        let maskAfterGap = mask;
        if (gap > 0) {
            maskAfterGap = new Uint8Array(workingWidth * workingHeight);
            for (let y = 0; y < workingHeight; y++) {
                for (let x = 0; x < workingWidth; x++) {
                    const idx = y * workingWidth + x;
                    if (mask[idx] === 0) {
                        // 周囲 gap ピクセル内に塗られたピクセルがあれば、自分も塗る (Dilation)
                        let shouldExpand = false;
                        for (let ky = -gap; ky <= gap; ky++) {
                            for (let kx = -gap; kx <= gap; kx++) {
                                const nx = x + kx;
                                const ny = y + ky;
                                if (nx >= 0 && nx < workingWidth && ny >= 0 && ny < workingHeight) {
                                    if (mask[ny * workingWidth + nx] === 255) { shouldExpand = true; break; }
                                }
                            }
                            if (shouldExpand) break;
                        }
                        if (shouldExpand) maskAfterGap[idx] = 255;
                    } else {
                        maskAfterGap[idx] = 255;
                    }
                }
            }
        }
        
        // 3. Underpaint dilation (expand fill slightly into interior)
        let finalMask = maskAfterGap;
        if (underpaint > 0) {
            finalMask = new Uint8Array(workingWidth * workingHeight);
            for (let y = 0; y < workingHeight; y++) {
                for (let x = 0; x < workingWidth; x++) {
                    const idx = y * workingWidth + x;
                    if (maskAfterGap[idx] === 0) {
                        let shouldExpand = false;
                        for (let ky = -underpaint; ky <= underpaint; ky++) {
                            for (let kx = -underpaint; kx <= underpaint; kx++) {
                                const nx = x + kx;
                                const ny = y + ky;
                                if (nx >= 0 && nx < workingWidth && ny >= 0 && ny < workingHeight) {
                                    if (maskAfterGap[ny * workingWidth + nx] === 255) { shouldExpand = true; break; }
                                }
                            }
                            if (shouldExpand) break;
                        }
                        if (shouldExpand) finalMask[idx] = 255;
                    } else {
                        finalMask[idx] = 255;
                    }
                }
            }
        }

        if (selectionRect) {
            for (let y = 0; y < workingHeight; y++) {
                for (let x = 0; x < workingWidth; x++) {
                    if (!isInsideSelection(x, y)) finalMask[y * workingWidth + x] = 0;
                }
            }
        }

        // 3. マスクテクスチャの生成
        const canvas = document.createElement('canvas');
        canvas.width = workingWidth;
        canvas.height = workingHeight;
        const ctx = canvas.getContext('2d');
        const maskImageData = ctx.createImageData(workingWidth, workingHeight);
        
        for (let i = 0; i < workingWidth * workingHeight; i++) {
            const v = finalMask[i];
            const ii = i * 4;
            maskImageData.data[ii] = 255;
            maskImageData.data[ii + 1] = 255;
            maskImageData.data[ii + 2] = 255;
            maskImageData.data[ii + 3] = v;
        }
        ctx.putImageData(maskImageData, 0, 0);

        const currentMode = window.brushSettings?.getMode() || 'fill';
        const isEraser = currentMode === 'eraser-fill';

        if (isEraser) {
            const afterSnapshot = {
                ...beforeSnapshot,
                pixels: new Uint8ClampedArray(beforeSnapshot.pixels),
                pathsData: structuredClone(beforeSnapshot.pathsData || []),
                paths: structuredClone(beforeSnapshot.paths || [])
            };

            for (let y = 0; y < workingHeight; y++) {
                const targetY = boundaryBounds.y + y - targetBounds.y;
                if (targetY < 0 || targetY >= afterSnapshot.height) continue;
                for (let x = 0; x < workingWidth; x++) {
                    if (finalMask[y * workingWidth + x] !== 255) continue;
                    const targetX = boundaryBounds.x + x - targetBounds.x;
                    if (targetX < 0 || targetX >= afterSnapshot.width) continue;
                    const ii = (targetY * afterSnapshot.width + targetX) * 4;
                    afterSnapshot.pixels[ii] = 0;
                    afterSnapshot.pixels[ii + 1] = 0;
                    afterSnapshot.pixels[ii + 2] = 0;
                    afterSnapshot.pixels[ii + 3] = 0;
                }
            }

            layerManager.restoreLayerRasterSnapshot(afterSnapshot);
            window.CoreRuntime?.api?.selection?.constrainLayer?.(layer, beforeSnapshot);
            this._recordRasterFillHistory(layer, layerManager, historyBeforeSnapshot, color, 0, 'eraser-fill');

            const layerIndex = layerManager.getLayerIndex(layer);
            layerManager.requestThumbnailUpdate(layerIndex, true);

            if (this.eventBus) {
                this.eventBus.emit('layer:filled', {
                    layerId: layerData.id,
                    color: 0,
                    alpha: 0,
                    method: 'eraser-fill'
                });
            }
            return;
        }

        const maskTexture = Texture.from(canvas);
        const maskSprite = new Sprite(maskTexture);
        maskSprite.position.set(boundaryBounds.x - targetBounds.x, boundaryBounds.y - targetBounds.y);
        maskSprite.renderable = false;
        maskSprite.eventMode = 'none';

        // 4. RenderTexture への焼き込み
        const fillGraphics = new Graphics();
        fillGraphics.rect(0, 0, targetBounds.width, targetBounds.height);
        fillGraphics.fill({ color, alpha });
        fillGraphics.mask = maskSprite;

        const renderContainer = new Container();
        renderContainer.addChild(maskSprite);
        renderContainer.addChild(fillGraphics);

        app.renderer.render({
            container: renderContainer,
            target: layerData.renderTexture,
            clear: false
        });

        // 5. 後始末
        renderContainer.removeChild(maskSprite);
        renderContainer.destroy({ children: true });
        maskSprite.destroy({ texture: true, baseTexture: true });

        // 6. 履歴・サムネイル更新
        const method = 'floodfill';
        window.CoreRuntime?.api?.selection?.constrainLayer?.(layer, beforeSnapshot);
        this._recordRasterFillHistory(layer, layerManager, historyBeforeSnapshot, color, alpha, method);
        
        const layerIndex = layerManager.getLayerIndex(layer);
        layerManager.requestThumbnailUpdate(layerIndex, true);

        if (this.eventBus) {
            this.eventBus.emit('layer:filled', {
                layerId: layerData.id,
                color,
                alpha,
                method: method
            });
        }
    }

    /**
     * 🆕 Phase 3d: 投げ縄（囲い）塗り
     */
    async performLassoFill(points, color, alpha, layer, layerManager, beforeSnapshot) {
        const app = layerManager.app;
        const layerData = layer.layerData;
        if (!layerData?.renderTexture || !app?.renderer) return;

        const lassoBounds = this._getPointBounds(points);
        const historyBeforeSnapshot = beforeSnapshot || layerManager.createLayerRasterSnapshot?.(layer);
        if (!historyBeforeSnapshot) return;
        if (lassoBounds && typeof layerManager.ensureLayerRasterBoundsForRect === 'function') {
            const expanded = layerManager.ensureLayerRasterBoundsForRect(layer, lassoBounds, { padding: 0 });
            if (expanded?.ok === false) return;
        }

        // スナップショットが渡されていない場合は作成
        const snapshot = historyBeforeSnapshot;
        if (!snapshot) return;

        const width = layerData.renderTexture.width;
        const height = layerData.renderTexture.height;
        const rasterBounds = normalizeRasterBounds(layerData.rasterBounds, {
            width,
            height
        });
        rasterBounds.width = width;
        rasterBounds.height = height;
        const localPoints = points.map(point => ({
            x: point.x - rasterBounds.x,
            y: point.y - rasterBounds.y
        }));

        // 1. マスクの作成 (Graphics.poly)
        const maskGraphics = new Graphics();
        maskGraphics.poly(localPoints);
        maskGraphics.fill({ color: 0xFFFFFF, alpha: 1.0 });

        // 2. 塗りつぶしの実行
        const fillGraphics = new Graphics();
        fillGraphics.rect(0, 0, width, height);
        fillGraphics.fill({ color, alpha });
        fillGraphics.mask = maskGraphics;

        app.renderer.render({
            container: fillGraphics,
            target: layerData.renderTexture,
            clear: false
        });

        // 3. 後始末
        fillGraphics.destroy({ children: true });
        maskGraphics.destroy({ children: true });

        // 4. 履歴記録
        window.CoreRuntime?.api?.selection?.constrainLayer?.(layer, snapshot);
        this._recordRasterFillHistory(layer, layerManager, snapshot, color, alpha, 'lasso-fill');

        // 5. サムネイル更新
        const layerIndex = layerManager.getLayerIndex(layer);
        layerManager.requestThumbnailUpdate(layerIndex, true);

        if (this.eventBus) {
            this.eventBus.emit('layer:filled', {
                layerId: layerData.id,
                color, alpha,
                method: 'lasso-fill'
            });
        }
    }

    _getPointBounds(points = []) {
        if (!Array.isArray(points) || points.length < 1) return null;
        const xs = points.map(point => Number(point?.x)).filter(Number.isFinite);
        const ys = points.map(point => Number(point?.y)).filter(Number.isFinite);
        if (!xs.length || !ys.length) return null;
        const minX = Math.floor(Math.min(...xs));
        const minY = Math.floor(Math.min(...ys));
        const maxX = Math.ceil(Math.max(...xs));
        const maxY = Math.ceil(Math.max(...ys));
        return {
            x: minX,
            y: minY,
            width: Math.max(1, maxX - minX),
            height: Math.max(1, maxY - minY)
        };
    }

    _fillLayerLegacy(layer, color, alpha, layerManager) {
        const CONFIG = window.TEGAKI_CONFIG;
        const layerData = layer.layerData;
        const app = layerManager.app;
        const beforeSnapshot = layerManager.createLayerRasterSnapshot?.(layer) || null;

        if (!layerData?.renderTexture || !app?.renderer) return;

        const width = Math.round(layerData.renderTexture.width || CONFIG.canvas.width);
        const height = Math.round(layerData.renderTexture.height || CONFIG.canvas.height);

        const fillGraphics = new Graphics();
        fillGraphics.rect(0, 0, width, height);
        fillGraphics.fill({ color, alpha });

        app.renderer.render({
            container: fillGraphics,
            target: layerData.renderTexture,
            clear: false
        });

        fillGraphics.destroy({ children: true });
        window.CoreRuntime?.api?.selection?.constrainLayer?.(layer, beforeSnapshot);
        this._recordRasterFillHistory(layer, layerManager, beforeSnapshot, color, alpha, 'legacy-full');
        
        const layerIndex = layerManager.getLayerIndex(layer);
        layerManager.requestThumbnailUpdate(layerIndex, true);

        if (this.eventBus) {
            this.eventBus.emit('layer:filled', {
                layerId: layerData.id,
                color, alpha,
                method: 'legacy-full'
            });
        }
    }

    _recordRasterFillHistory(layer, layerManager, beforeSnapshot, fillColor, fillAlpha, method) {
        const history = window.History;
        if (!history || history.isApplying || !beforeSnapshot) return;
        if (layer?.layerData?.isAnimationWorkingLayer === true) return;

        const afterSnapshot = layerManager.createLayerRasterSnapshot(layer);
        if (!afterSnapshot) return;

        const layerIndex = layerManager.getLayerIndex(layer);
        const layerId = layer.layerData?.id;

        history.record({
            name: `fill-layer-${method}`,
            do: () => {
                layerManager.restoreLayerRasterSnapshot(afterSnapshot);
            },
            undo: () => {
                layerManager.restoreLayerRasterSnapshot(beforeSnapshot);
            },
            meta: { layerId, layerIndex, fillColor, fillAlpha, method },
            byteSize: (beforeSnapshot.pixels?.byteLength || 0)
                + (afterSnapshot.pixels?.byteLength || 0)
        });
    }

    _ensureLayerRasterFrameForFill(activeLayer, layerManager) {
        if (!activeLayer?.layerData?.renderTexture) return null;
        if (typeof layerManager?.ensureLayerRasterBoundsForRect !== 'function') return null;

        const canvasConfig = layerManager.config?.canvas || window.TEGAKI_CONFIG?.canvas || {};
        const width = Math.max(
            1,
            Math.round(Number(canvasConfig.width || layerManager.canvasWidth || activeLayer.layerData.renderTexture.width || 1))
        );
        const height = Math.max(
            1,
            Math.round(Number(canvasConfig.height || layerManager.canvasHeight || activeLayer.layerData.renderTexture.height || 1))
        );
        return layerManager.ensureLayerRasterBoundsForRect(activeLayer, {
            x: 0,
            y: 0,
            width,
            height
        }, { padding: 0 });
    }

    _emitCafFillEvent(type, layer, localX, localY) {
        const mode = window.brushSettings?.getMode?.() || 'fill';
        this.eventBus?.emit(type, {
            component: 'drawing',
            action: type.replace('drawing:', ''),
            data: {
                mode,
                layerId: layer.layerData?.id,
                localX,
                localY,
                pressure: 1
            }
        });
    }

    _cropBoundarySnapshotToProjectFrame(snapshot, bounds, layerManager, point) {
        const canvasConfig = layerManager?.config?.canvas || window.TEGAKI_CONFIG?.canvas || {};
        const projectFrame = {
            x: 0,
            y: 0,
            width: Math.max(1, Math.round(Number(canvasConfig.width || snapshot.width || 1))),
            height: Math.max(1, Math.round(Number(canvasConfig.height || snapshot.height || 1)))
        };
        if (
            point.x < projectFrame.x
            || point.y < projectFrame.y
            || point.x >= projectFrame.x + projectFrame.width
            || point.y >= projectFrame.y + projectFrame.height
        ) {
            return null;
        }

        const x0 = Math.max(bounds.x, projectFrame.x);
        const y0 = Math.max(bounds.y, projectFrame.y);
        const x1 = Math.min(bounds.x + bounds.width, projectFrame.x + projectFrame.width);
        const y1 = Math.min(bounds.y + bounds.height, projectFrame.y + projectFrame.height);
        const cropWidth = Math.max(0, x1 - x0);
        const cropHeight = Math.max(0, y1 - y0);
        if (
            cropWidth <= 0
            || cropHeight <= 0
            || (cropWidth === snapshot.width && cropHeight === snapshot.height && x0 === bounds.x && y0 === bounds.y)
        ) {
            return null;
        }

        const source = snapshot.pixels;
        const cropped = new Uint8ClampedArray(cropWidth * cropHeight * 4);
        for (let row = 0; row < cropHeight; row++) {
            const sourceY = y0 - bounds.y + row;
            const sourceX = x0 - bounds.x;
            const sourceOffset = (sourceY * snapshot.width + sourceX) * 4;
            const targetOffset = row * cropWidth * 4;
            cropped.set(source.subarray(sourceOffset, sourceOffset + cropWidth * 4), targetOffset);
        }

        return {
            ...snapshot,
            width: cropWidth,
            height: cropHeight,
            pixels: cropped,
            rasterBounds: {
                x: x0,
                y: y0,
                width: cropWidth,
                height: cropHeight
            }
        };
    }

    isToolActive() {
        return this.isActive;
    }

    destroy() {
        this.isActive = false;
        this.initialized = false;
    }
}

export const fillTool = new FillTool();
window.FillTool = fillTool;

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        fillTool.initialize();
    });
} else {
    fillTool.initialize();
}
