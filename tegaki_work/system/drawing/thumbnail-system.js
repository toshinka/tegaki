/**
 * ============================================================================
 * ファイル名: system/drawing/thumbnail-system.js
 * 責務: レイヤーおよびフレームのサムネイル生成・更新を管理する
 * 依存: pixi.js, system/event-bus.js
 * 被依存: layer-system.js, ui-panels.js等
 * 公開API: ThumbnailSystem, thumbnailSystem
 * イベント発火: thumbnail:updated
 * イベント受信: thumbnail:layer-updated, frame:updated
 * グローバル登録: window.ThumbnailSystem, window.thumbnailSystem
 * 実装状態: ✅完成/整備
 * ============================================================================
 */

import { Sprite } from 'pixi.js';
import { TegakiEventBus } from '../event-bus.js';
import { normalizeRasterBounds } from '../raster-bounds.js';

export const ThumbnailSystem = {
    app: null,
    eventBus: null,
    thumbnails: new Map(),
    dirtyLayers: new Set(),
    isProcessing: false,
    isDrawingSuspended: false,

    init(eventBus) {
        this.eventBus = eventBus || TegakiEventBus;
        this._setupEventListeners();
    },

    _setupEventListeners() {
        if (!this.eventBus) return;

        this.eventBus.on('thumbnail:layer-updated', (data) => {
            const layerMgr = window.layerManager;
            const layer = layerMgr?.getLayerById(data.layerId);
            if (!layer) return;
            if (layer.layerData?.isAnimationWorkingLayer) return;
            if (this._isDrawingActive()) {
                this.markLayerDirty(data.layerId);
                return;
            }

            if (data.immediate) {
                this.generateLayerThumbnail(layer, data.layerIndex);
            } else {
                this.markLayerDirty(data.layerId);
            }
        });

        this.eventBus.on('drawing:stroke-started', () => {
            this.isDrawingSuspended = true;
        });
        const resume = () => {
            this.isDrawingSuspended = false;
            if (this.dirtyLayers.size > 0) {
                this._requestProcessing();
            }
        };
        this.eventBus.on('drawing:stroke-completed', resume);
        this.eventBus.on('drawing:stroke-cancelled', resume);
    },

    markLayerDirty(layerId) {
        this.dirtyLayers.add(layerId);
        this._requestProcessing();
    },

    _requestProcessing() {
        if (this.isProcessing || this._isDrawingActive()) return;
        this.isProcessing = true;
        
        requestAnimationFrame(() => this._processDirtyLayers());
    },

    _processDirtyLayers() {
        if (this._isDrawingActive()) {
            this.isProcessing = false;
            return;
        }
        if (this.dirtyLayers.size === 0) {
            this.isProcessing = false;
            return;
        }

        const layerId = this.dirtyLayers.values().next().value;
        this.dirtyLayers.delete(layerId);

        const layerMgr = window.layerManager;
        if (layerMgr) {
            const layer = layerMgr.getLayerById(layerId);
            const index = layerMgr.getLayerIndex(layer);
            if (index !== -1) {
                this.generateLayerThumbnail(layer, index);
            }
        }

        requestAnimationFrame(() => this._processDirtyLayers());
    },

    _isDrawingActive() {
        return this.isDrawingSuspended === true
            || window.drawingEngine?.isDrawing === true
            || window.BrushCore?.isDrawing === true;
    },

    async generateLayerThumbnail(layer, layerIndex, maxWidth = 64, maxHeight = 44) {
        if (!this.app?.renderer) {
            console.warn('[ThumbnailSystem] Renderer not available');
            return null;
        }
        if (!layer) {
            console.warn('[ThumbnailSystem] Layer is null');
            return null;
        }

        // [指示書 v6] Vキー変形中はスキップ（重さ防止）
        if (window.layerManager?.isLayerMoveMode) {
            return null;
        }
        if (this._isDrawingActive()) {
            const layerId = layer.layerData?.id || layer.label;
            if (layerId) this.markLayerDirty(layerId);
            return null;
        }

        const layerId = layer.layerData?.id || layer.label;
        if (layer.layerData?.isFolder) {
            return null;
        }
        
        try {
            const canvasWidth = window.TEGAKI_CONFIG?.canvas?.width || 400;
            const canvasHeight = window.TEGAKI_CONFIG?.canvas?.height || 400;
            const projectFrame = { x: 0, y: 0, width: canvasWidth, height: canvasHeight };

            const aspectRatio = canvasWidth / canvasHeight;
            let thumbW = maxWidth;
            let thumbH = maxWidth / aspectRatio;
            if (thumbH > maxHeight) {
                thumbH = maxHeight;
                thumbW = maxHeight * aspectRatio;
            }
            thumbW = Math.round(thumbW);
            thumbH = Math.round(thumbH);

            // ── ① ソーステクスチャを決定 ──────────────────────────────────
            // 通常レイヤー: layer.layerData.renderTexture から直接抽出
            // 背景レイヤー: backgroundGraphics が RenderTexture を持たないため単一色で塗る
            const isBackground = !!layer.layerData?.isBackground;
            let pixels = null;
            let sourceWidth = canvasWidth;
            let sourceHeight = canvasHeight;
            let rasterBounds = projectFrame;
            let hasOffFramePixels = false;

            if (isBackground) {
                // 背景は単色。ピクセルループ不要。後段で Canvas に塗りつぶす。
            } else {
                const sourceRT = layer.layerData?.renderTexture;
                if (!sourceRT) {
                    console.warn('[ThumbnailSystem] No renderTexture on layer', layerId);
                    return null;
                }
                // PixiJS v8.17.0: extract.pixels() は { pixels, width, height } を返す場合がある
                // Sprite でラップする（texture: false で Sprite 破棄時に RT を消さない）
                const _tempSprite = new Sprite(sourceRT);
                const result = this.app.renderer.extract.pixels({
                    target: _tempSprite,
                    clearColor: '#00000000'
                });
                _tempSprite.destroy({ texture: false });

                // result が直接 Uint8ClampedArray の場合と、{ pixels, width, height } の場合の両方に対応
                pixels = result?.pixels || (result instanceof Uint8ClampedArray ? result : new Uint8ClampedArray(result?.buffer || result));
                sourceWidth = Math.round(result?.width || sourceRT.width || canvasWidth);
                sourceHeight = Math.round(result?.height || sourceRT.height || canvasHeight);
                rasterBounds = normalizeRasterBounds(layer.layerData?.rasterBounds, {
                    width: sourceWidth,
                    height: sourceHeight
                });
                rasterBounds.width = sourceWidth;
                rasterBounds.height = sourceHeight;
            }

            // ── ② サムネイル Canvas を生成 ────────────────────────────────
            const thumbCanvas = document.createElement('canvas');
            thumbCanvas.width  = thumbW;
            thumbCanvas.height = thumbH;
            const ctx = thumbCanvas.getContext('2d');
            if (!ctx) return null;

            ctx.clearRect(0, 0, thumbW, thumbH);

            if (isBackground) {
                // 背景レイヤーは単色で塗る
                const c = layer.layerData.backgroundColor || 0xf0e0d6;
                const r = (c >> 16) & 0xff;
                const g = (c >> 8)  & 0xff;
                const b =  c        & 0xff;
                ctx.fillStyle = `rgb(${r},${g},${b})`;
                ctx.fillRect(0, 0, thumbW, thumbH);
            } else {
                // ── ③ pixels → フルサイズ Canvas → 縮小転写 ─────────────
                const clampedPixels = pixels;

                const expectedLength = sourceWidth * sourceHeight * 4;
                if (clampedPixels.length < expectedLength) {
                    console.warn('[ThumbnailSystem] pixel length mismatch', {
                        layer: layer.layerData?.name,
                        expectedLength,
                        actualLength: clampedPixels.length,
                        sourceWidth,
                        sourceHeight
                    });
                }

                const fullCanvas = document.createElement('canvas');
                fullCanvas.width = sourceWidth;
                fullCanvas.height = sourceHeight;
                const fullCtx = fullCanvas.getContext('2d');

                if (!fullCtx) return null;

                // Pixi の extract.pixels() 経由では表示向きで取得されるため、
                // ここでは Y 軸反転を入れない。
                const imageData = fullCtx.createImageData(sourceWidth, sourceHeight);
                const data = imageData.data;
                let nonTransparentPixels = 0;
                let offFramePixels = 0;
                let maxAlpha = 0;

                for (let row = 0; row < sourceHeight; row++) {
                    const srcBase = row * sourceWidth * 4;
                    const dstBase = row * sourceWidth * 4;
                    const projectY = rasterBounds.y + row;
                    const rowOutsideFrame = projectY < projectFrame.y
                        || projectY >= projectFrame.y + projectFrame.height;

                    // 高速コピー
                    const rowData = clampedPixels.subarray(srcBase, srcBase + sourceWidth * 4);
                    data.set(rowData, dstBase);

                    for (let i = 3, col = 0; i < rowData.length; i += 4, col++) {
                        const alpha = rowData[i];
                        if (alpha > 0) nonTransparentPixels++;
                        if (alpha > maxAlpha) maxAlpha = alpha;
                        if (alpha > 0) {
                            const projectX = rasterBounds.x + col;
                            if (
                                rowOutsideFrame
                                || projectX < projectFrame.x
                                || projectX >= projectFrame.x + projectFrame.width
                            ) {
                                offFramePixels++;
                            }
                        }
                    }
                }
                hasOffFramePixels = offFramePixels > 0;
                fullCtx.putImageData(imageData, 0, 0);

                const projectCanvas = document.createElement('canvas');
                projectCanvas.width = canvasWidth;
                projectCanvas.height = canvasHeight;
                const projectCtx = projectCanvas.getContext('2d');
                if (!projectCtx) return null;

                projectCtx.clearRect(0, 0, canvasWidth, canvasHeight);
                projectCtx.drawImage(fullCanvas, rasterBounds.x, rasterBounds.y);

                ctx.drawImage(projectCanvas, 0, 0, canvasWidth, canvasHeight,
                                             0, 0, thumbW, thumbH);

                layer._thumbnailDebug = {
                    nonTransparentPixels,
                    maxAlpha,
                    sourceWidth,
                    sourceHeight,
                    rasterBounds,
                    offFramePixels,
                    hasOffFramePixels
                };
            }

            // ── ④ 確認ログ ──────────────────────────────────────────────
            // 中心付近のピクセルをチェック
            const checkX = Math.floor(thumbW / 2);
            const checkY = Math.floor(thumbH / 2);
            const px = ctx.getImageData(checkX, checkY, 1, 1).data;
            const debug = layer._thumbnailDebug || { nonTransparentPixels: 'bg', maxAlpha: px[3], sourceWidth, sourceHeight };

            if (window.TEGAKI_CONFIG?.debug) {
                console.log('[ThumbnailSystem] updated', JSON.stringify({
                    layer: layer.layerData?.name,
                    isBackground,
                    source: `${debug.sourceWidth}x${debug.sourceHeight}`,
                    rasterBounds: debug.rasterBounds,
                    offFramePixels: debug.offFramePixels,
                    hasOffFramePixels: !!debug.hasOffFramePixels,
                    thumb: `${thumbW}x${thumbH}`,
                    nonTransparentPixels: debug.nonTransparentPixels,
                    maxAlpha: debug.maxAlpha,
                    centerRGBA: Array.from(px)
                }));
            }
            // ── ⑤ キャッシュ & イベント発火 ─────────────────────────────
            const dataUrl = thumbCanvas.toDataURL('image/png');
            this.thumbnails.set(layerId, dataUrl);

            if (this.eventBus) {
                this.eventBus.emit('thumbnail:updated', {
                    layerId,
                    layerIndex,
                    dataURL: dataUrl,
                    rasterBounds,
                    hasOffFramePixels
                });
            }

            return { dataUrl, width: thumbW, height: thumbH };

        } catch (error) {
            console.error('[ThumbnailSystem] Error:', error);
            return null;
        }
    },

    getThumbnail(layerId) {
        return this.thumbnails.get(layerId);
    }
};

export const thumbnailSystem = ThumbnailSystem;

// 下位互換性のためにグローバルに登録
window.ThumbnailSystem = ThumbnailSystem;
window.thumbnailSystem = ThumbnailSystem;
