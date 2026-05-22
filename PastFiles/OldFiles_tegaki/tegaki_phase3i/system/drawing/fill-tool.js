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
 * ============================================================================
 */

import { Container, Graphics, Sprite, Texture } from 'pixi.js';
import { TegakiEventBus } from '../event-bus.js';

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
            gapClosePixels: 1,         // 🧪 Phase 3g: 1px 隙間閉じを検証
            underpaintPixels: 1,       // 新規: 塗り領域を線の下へ少し広げる補正
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

        // 🧪 Phase 3e: 表示中レイヤー参照の判定
        let boundarySnapshot = null;
        if (this.settings.referenceAllLayers && layerManager.createCompositeDrawingSnapshot) {
            boundarySnapshot = await layerManager.createCompositeDrawingSnapshot();
        } else {
            boundarySnapshot = layerManager.createLayerRasterSnapshot?.(activeLayer);
        }

        if (!boundarySnapshot) {
            console.error('❌ FillTool: Failed to capture boundary snapshot');
            return;
        }

        this._fillLayerFloodFill(activeLayer, fillColor, fillAlpha, localX, localY, layerManager, boundarySnapshot);
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
    _fillLayerFloodFill(layer, color, alpha, localX, localY, layerManager, boundarySnapshot) {
        const CONFIG = window.TEGAKI_CONFIG;
        const layerData = layer.layerData;
        const app = layerManager.app;
        
        if (!layerData?.renderTexture || !app?.renderer) return;

        // 塗り前のスナップショット取得（履歴用）
        const beforeSnapshot = layerManager.createLayerRasterSnapshot?.(layer) || null;
        if (!beforeSnapshot) return;

        const { pixels, width, height } = boundarySnapshot;
        const startX = Math.floor(localX);
        const startY = Math.floor(localY);

        if (startX < 0 || startX >= width || startY < 0 || startY >= height) return;

        const gap = this.settings.gapClosePixels || 0;
        const underpaint = this.settings.underpaintPixels || 0;
        if (CONFIG.debug) {
            console.log(`[FillTool] FloodFill started at (${startX}, ${startY}), gap: ${gap}, underpaint: ${underpaint}, refAllLayers: ${this.settings.referenceAllLayers}`);
        }

        // 1. Flood Fill アルゴリズムの実行 (BFS)
        const mask = new Uint8Array(width * height);
        const stack = [[startX, startY]];
        
        const startIdx = (startY * width + startX) * 4;
        const startR = pixels[startIdx];
        const startG = pixels[startIdx + 1];
        const startB = pixels[startIdx + 2];
        const startA = pixels[startIdx + 3];

        const isStartTransparent = startA < FILL_ALPHA_THRESHOLD;

        while (stack.length > 0) {
            const [x, y] = stack.pop();
            const idx = y * width + x;

            if (mask[idx]) continue;
            
            // 境界判定 (Gap Close 対応: 周囲 gap ピクセル内に壁があるか)
            let isWall = false;
            if (gap > 0) {
                for (let ky = -gap; ky <= gap; ky++) {
                    for (let kx = -gap; kx <= gap; kx++) {
                        const nx = x + kx;
                        const ny = y + ky;
                        if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
                            const nIdx = (ny * width + nx) * 4;
                            const na = pixels[nIdx + 3];
                            if (isStartTransparent) {
                                if (na >= FILL_ALPHA_THRESHOLD) { isWall = true; break; }
                            } else {
                                const nr = pixels[nIdx];
                                const ng = pixels[nIdx + 1];
                                const nb = pixels[nIdx + 2];
                                const diff = Math.abs(nr - startR) + Math.abs(ng - startG) + Math.abs(nb - startB);
                                if (diff >= FILL_COLOR_TOLERANCE * 3) { isWall = true; break; }
                            }
                        }
                    }
                    if (isWall) break;
                }
            } else {
                const pixIdx = idx * 4;
                const a = pixels[pixIdx + 3];
                if (isStartTransparent) {
                    if (a >= FILL_ALPHA_THRESHOLD) isWall = true;
                } else {
                    const r = pixels[pixIdx];
                    const g = pixels[pixIdx + 1];
                    const b = pixels[pixIdx + 2];
                    const diff = Math.abs(r - startR) + Math.abs(g - startG) + Math.abs(b - startB);
                    if (diff >= FILL_COLOR_TOLERANCE * 3) isWall = true;
                }
            }

            if (!isWall) {
                mask[idx] = 255;
                if (x > 0) stack.push([x - 1, y]);
                if (x < width - 1) stack.push([x + 1, y]);
                if (y > 0) stack.push([x, y - 1]);
                if (y < height - 1) stack.push([x, y + 1]);
            }
        }

        // 2. Gap Close dilation (if any)
        let maskAfterGap = mask;
        if (gap > 0) {
            maskAfterGap = new Uint8Array(width * height);
            for (let y = 0; y < height; y++) {
                for (let x = 0; x < width; x++) {
                    const idx = y * width + x;
                    if (mask[idx] === 0) {
                        // 周囲 gap ピクセル内に塗られたピクセルがあれば、自分も塗る (Dilation)
                        let shouldExpand = false;
                        for (let ky = -gap; ky <= gap; ky++) {
                            for (let kx = -gap; kx <= gap; kx++) {
                                const nx = x + kx;
                                const ny = y + ky;
                                if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
                                    if (mask[ny * width + nx] === 255) { shouldExpand = true; break; }
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
            finalMask = new Uint8Array(width * height);
            for (let y = 0; y < height; y++) {
                for (let x = 0; x < width; x++) {
                    const idx = y * width + x;
                    if (maskAfterGap[idx] === 0) {
                        let shouldExpand = false;
                        for (let ky = -underpaint; ky <= underpaint; ky++) {
                            for (let kx = -underpaint; kx <= underpaint; kx++) {
                                const nx = x + kx;
                                const ny = y + ky;
                                if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
                                    if (maskAfterGap[ny * width + nx] === 255) { shouldExpand = true; break; }
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

        // 3. マスクテクスチャの生成
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        const maskImageData = ctx.createImageData(width, height);
        
        for (let i = 0; i < width * height; i++) {
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

            for (let i = 0; i < width * height; i++) {
                if (finalMask[i] !== 255) continue;
                const ii = i * 4;
                afterSnapshot.pixels[ii] = 0;
                afterSnapshot.pixels[ii + 1] = 0;
                afterSnapshot.pixels[ii + 2] = 0;
                afterSnapshot.pixels[ii + 3] = 0;
            }

            layerManager.restoreLayerRasterSnapshot(afterSnapshot);
            this._recordRasterFillHistory(layer, layerManager, beforeSnapshot, color, 0, 'eraser-fill');

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

        // 4. RenderTexture への焼き込み
        const fillGraphics = new Graphics();
        fillGraphics.rect(0, 0, width, height);
        fillGraphics.fill({ color, alpha });
        fillGraphics.mask = maskSprite;

        const renderContainer = new Container();
        renderContainer.addChild(fillGraphics);

        app.renderer.render({
            container: renderContainer,
            target: layerData.renderTexture,
            clear: false
        });

        // 5. 後始末
        renderContainer.destroy({ children: true });
        maskSprite.destroy({ texture: true, baseTexture: true });

        // 6. 履歴・サムネイル更新
        const method = 'floodfill';
        this._recordRasterFillHistory(layer, layerManager, beforeSnapshot, color, alpha, method);
        
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

        // スナップショットが渡されていない場合は作成
        const snapshot = beforeSnapshot || layerManager.createLayerRasterSnapshot?.(layer);
        if (!snapshot) return;

        const width = layerData.renderTexture.width;
        const height = layerData.renderTexture.height;

        // 1. マスクの作成 (Graphics.poly)
        const maskGraphics = new Graphics();
        maskGraphics.poly(points.map(p => ({ x: p.x, y: p.y })));
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
            meta: { layerId, layerIndex, fillColor, fillAlpha, method }
        });
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
