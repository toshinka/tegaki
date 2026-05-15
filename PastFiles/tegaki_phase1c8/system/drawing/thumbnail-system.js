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

import { RenderTexture, Sprite } from 'pixi.js';
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

        // [指示書 v6] Vキー変形中はスキップ（重さ防止）
        if (window.layerManager?.isLayerMoveMode) {
            return null;
        }

        const layerId = layer.layerData?.id || layer.label;
        
        try {
            const canvasWidth  = window.TEGAKI_CONFIG?.canvas?.width  || 400;
            const canvasHeight = window.TEGAKI_CONFIG?.canvas?.height || 400;

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

            if (isBackground) {
                // 背景は単色。ピクセルループ不要。後段で Canvas に塗りつぶす。
            } else {
                const sourceRT = layer.layerData?.renderTexture;
                if (!sourceRT) {
                    console.warn('[ThumbnailSystem] No renderTexture on layer', layerId);
                    return null;
                }
                // PixiJS v8: extract.pixels() は Uint8Array か Uint8ClampedArray を返す
                // Sprite でラップする（texture: false で Sprite 破棄時に RT を消さない）
                const _tempSprite = new Sprite(sourceRT);
                pixels = this.app.renderer.extract.pixels(_tempSprite);
                _tempSprite.destroy({ texture: false });
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
                const clampedPixels = pixels instanceof Uint8ClampedArray
                    ? pixels
                    : new Uint8ClampedArray(pixels.buffer || pixels);

                const fullCanvas = document.createElement('canvas');
                fullCanvas.width  = canvasWidth;
                fullCanvas.height = canvasHeight;
                const fullCtx = fullCanvas.getContext('2d');

                if (!fullCtx) return null;

                // [指示書 v6] WebGL は Y 軸が反転しているため flipY 補正
                const imageData = fullCtx.createImageData(canvasWidth, canvasHeight);
                const data = imageData.data;

                for (let row = 0; row < canvasHeight; row++) {
                    const srcRow = canvasHeight - 1 - row;
                    const srcBase = srcRow * canvasWidth * 4;
                    const dstBase = row    * canvasWidth * 4;

                    // 高速コピー
                    data.set(clampedPixels.subarray(srcBase, srcBase + canvasWidth * 4), dstBase);
                }
                fullCtx.putImageData(imageData, 0, 0);

                ctx.drawImage(fullCanvas, 0, 0, canvasWidth, canvasHeight,
                                          0, 0, thumbW, thumbH);
                }

                // ── ④ 確認ログ ──────────────────────────────────────────────
                // 中心付近のピクセルをチェック
                const checkX = Math.floor(thumbW / 2);
                const checkY = Math.floor(thumbH / 2);
                const px = ctx.getImageData(checkX, checkY, 1, 1).data;

                // 常に出力（透明か不透明かを問わず確認できるように）
                console.log(`[ThumbnailSystem] updated: ${layer.layerData?.name || 'layer'}, rgba: [${px.join(',')}]`);
            // ── ⑤ キャッシュ & イベント発火 ─────────────────────────────
            const dataUrl = thumbCanvas.toDataURL('image/png');
            this.thumbnails.set(layerId, dataUrl);

            if (this.eventBus) {
                this.eventBus.emit('thumbnail:updated', {
                    layerId, layerIndex, dataURL: dataUrl
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
 ThumbnailSystem;

// 下位互換性のためにグローバルに登録
window.ThumbnailSystem = ThumbnailSystem;
window.thumbnailSystem = ThumbnailSystem;
