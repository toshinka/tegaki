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
 * 実装状態: ♻️移植
 * ============================================================================
 */

import { RenderTexture } from 'pixi.js';
import { TegakiEventBus } from '../event-bus.js';

export const ThumbnailSystem = {
    app: null,
    eventBus: null,
    thumbnails: new Map(),
    dirtyLayers: new Set(),
    isProcessing: false,

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

            if (data.immediate) {
                this.generateLayerThumbnail(layer, data.layerIndex);
            } else {
                this.markLayerDirty(data.layerId);
            }
        });
    },

    markLayerDirty(layerId) {
        this.dirtyLayers.add(layerId);
        this._requestProcessing();
    },

    _requestProcessing() {
        if (this.isProcessing) return;
        this.isProcessing = true;
        
        requestAnimationFrame(() => this._processDirtyLayers());
    },

    _processDirtyLayers() {
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

    async generateLayerThumbnail(layer, layerIndex, maxWidth = 64, maxHeight = 44) {
        if (!this.app?.renderer) {
            console.warn('[ThumbnailSystem] Renderer not available');
            return null;
        }
        if (!layer) {
            console.warn('[ThumbnailSystem] Layer is null');
            return null;
        }

        const layerId = layer.layerData?.id || layer.label;
        
        try {
            const canvasWidth = window.TEGAKI_CONFIG?.canvas?.width || 400;
            const canvasHeight = window.TEGAKI_CONFIG?.canvas?.height || 400;
            
            // [指示書] 背景レイヤーは背景色、通常レイヤーは透明
            const clearRGBA = layer.layerData?.isBackground
                ? (() => {
                    const c = layer.layerData.backgroundColor || 0xf0e0d6;
                    return [
                        ((c >> 16) & 0xff) / 255,
                        ((c >> 8)  & 0xff) / 255,
                        ( c        & 0xff) / 255,
                        1.0
                    ];
                })()
                : [0, 0, 0, 0];

            const renderTexture = RenderTexture.create({
                width: canvasWidth,
                height: canvasHeight,
                clearColor: clearRGBA // [指示書] 作成時にクリア色を指定
            });

            this.app.renderer.render({
                container: layer,
                target: renderTexture,
                clear: true   // [指示書] boolean の true にすることで警告を回避
            });

            // [指示書] extract.canvas() は alpha を失うため pixels() を使用
            const pixels = this.app.renderer.extract.pixels(renderTexture);
            
            // アスペクト比を維持したサイズ計算
            const aspectRatio = canvasWidth / canvasHeight;
            let thumbW = maxWidth;
            let thumbH = maxWidth / aspectRatio;
            
            if (thumbH > maxHeight) {
                thumbH = maxHeight;
                thumbW = maxHeight * aspectRatio;
            }

            const thumbCanvas = document.createElement('canvas');
            thumbCanvas.width = Math.round(thumbW);
            thumbCanvas.height = Math.round(thumbH);
            const ctx = thumbCanvas.getContext('2d');

            if (ctx) {
                // フルサイズで一度 ImageData に変換してから縮小描画
                const fullCanvas = document.createElement('canvas');
                fullCanvas.width = canvasWidth;
                fullCanvas.height = canvasHeight;
                const fullCtx = fullCanvas.getContext('2d');

                // pixels の型を Uint8ClampedArray に統一
                const clampedPixels = pixels instanceof Uint8ClampedArray
                    ? pixels
                    : new Uint8ClampedArray(pixels.buffer ?? pixels);

                // [指示書] WebGL の上下反転を補正 (flipY)
                const imageData = fullCtx.createImageData(canvasWidth, canvasHeight);
                for (let row = 0; row < canvasHeight; row++) {
                    const srcRow = canvasHeight - 1 - row;  // 上下反転
                    for (let col = 0; col < canvasWidth; col++) {
                        const srcIdx = (srcRow * canvasWidth + col) * 4;
                        const dstIdx = (row   * canvasWidth + col) * 4;
                        imageData.data[dstIdx]     = clampedPixels[srcIdx];
                        imageData.data[dstIdx + 1] = clampedPixels[srcIdx + 1];
                        imageData.data[dstIdx + 2] = clampedPixels[srcIdx + 2];
                        imageData.data[dstIdx + 3] = clampedPixels[srcIdx + 3];
                    }
                }
                fullCtx.putImageData(imageData, 0, 0);

                // サムネイルサイズへ縮小
                ctx.clearRect(0, 0, thumbCanvas.width, thumbCanvas.height);
                ctx.drawImage(fullCanvas, 0, 0, canvasWidth, canvasHeight,
                                          0, 0, thumbCanvas.width, thumbCanvas.height);
                
                // [指示書] 確認ログ
                const px = ctx.getImageData(1, 1, 1, 1).data;
                console.log('[ThumbnailSystem] sample pixel', JSON.stringify({
                    layer: layer.layerData?.name,
                    isBackground: !!layer.layerData?.isBackground,
                    rgba: Array.from(px),
                    thumbW: thumbCanvas.width,
                    thumbH: thumbCanvas.height
                }));
            }

            const dataUrl = thumbCanvas.toDataURL('image/png');
            this.thumbnails.set(layerId, dataUrl);

            if (this.eventBus) {
                this.eventBus.emit('thumbnail:updated', { layerId, layerIndex, dataURL: dataUrl });
            }

            renderTexture.destroy(true);
            return { dataUrl, width: thumbCanvas.width, height: thumbCanvas.height };

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
