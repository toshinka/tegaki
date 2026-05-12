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

import * as PIXI from 'pixi.js';
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
            if (data.immediate) {
                this.generateLayerThumbnail(data.layerIndex, data.layerId);
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
                this.generateLayerThumbnail(index, layerId);
            }
        }

        requestAnimationFrame(() => this._processDirtyLayers());
    },

    async generateLayerThumbnail(layerIndex, layerId) {
        if (!this.app?.renderer) return null;

        const layerMgr = window.layerManager;
        const layer = layerMgr?.getLayerById(layerId);
        if (!layer) return null;

        try {
            const canvasWidth = window.TEGAKI_CONFIG?.canvas?.width || 400;
            const canvasHeight = window.TEGAKI_CONFIG?.canvas?.height || 400;
            
            const renderTexture = PIXI.RenderTexture.create({
                width: canvasWidth,
                height: canvasHeight
            });

            this.app.renderer.render({
                container: layer,
                target: renderTexture,
                clear: true
            });

            const sourceCanvas = this.app.renderer.extract.canvas(renderTexture);
            
            const thumbSize = 48;
            const thumbCanvas = document.createElement('canvas');
            thumbCanvas.width = thumbSize;
            thumbCanvas.height = thumbSize;
            const ctx = thumbCanvas.getContext('2d');

            if (ctx) {
                ctx.drawImage(sourceCanvas, 0, 0, sourceCanvas.width, sourceCanvas.height, 0, 0, thumbSize, thumbSize);
            }

            const dataURL = thumbCanvas.toDataURL('image/png');
            this.thumbnails.set(layerId, dataURL);

            if (this.eventBus) {
                this.eventBus.emit('thumbnail:updated', { layerId, layerIndex, dataURL });
            }

            renderTexture.destroy(true);
            return dataURL;

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
