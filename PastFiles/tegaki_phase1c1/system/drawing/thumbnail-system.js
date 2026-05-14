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
        console.log(`[ThumbnailSystem] Generating for layer: ${layerId}, index: ${layerIndex}`);

        try {
            const canvasWidth = window.TEGAKI_CONFIG?.canvas?.width || 400;
            const canvasHeight = window.TEGAKI_CONFIG?.canvas?.height || 400;
            
            const renderTexture = RenderTexture.create({
                width: canvasWidth,
                height: canvasHeight
            });

            this.app.renderer.render({
                container: layer,
                target: renderTexture,
                clear: true
            });

            const sourceCanvas = this.app.renderer.extract.canvas(renderTexture);
            console.log(`[ThumbnailSystem] Extracted canvas size: ${sourceCanvas.width}x${sourceCanvas.height}`);
            
            // アスペクト比を維持したサイズ計算
            const aspectRatio = canvasWidth / canvasHeight;
            let thumbW = maxWidth;
            let thumbH = maxWidth / aspectRatio;
            
            if (thumbH > maxHeight) {
                thumbH = maxHeight;
                thumbW = maxHeight * aspectRatio;
            }

            const thumbCanvas = document.createElement('canvas');
            thumbCanvas.width = thumbW;
            thumbCanvas.height = thumbH;
            const ctx = thumbCanvas.getContext('2d');

            if (ctx) {
                ctx.drawImage(sourceCanvas, 0, 0, sourceCanvas.width, sourceCanvas.height, 0, 0, thumbW, thumbH);
            }

            const dataUrl = thumbCanvas.toDataURL('image/png');
            this.thumbnails.set(layerId, dataUrl);

            if (this.eventBus) {
                this.eventBus.emit('thumbnail:updated', { layerId, layerIndex, dataURL: dataUrl });
            }

            renderTexture.destroy(true);
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
