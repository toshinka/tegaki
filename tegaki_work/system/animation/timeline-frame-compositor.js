/**
 * TimelineModel / ClipAsset から exporter 共通の Canvas フレーム列を生成する。
 * UI の preview DOM や現在選択中の Frame / CAF / Layer 状態には依存しない。
 */
import {
    CLIPPING_MODES,
    getClippingMode
} from '../clipping-mode.js';
import { normalizeRasterBounds } from '../raster-bounds.js';
import { sampleClipTransform } from './clip-transform-sampler.js';
import { compositeClipPixel } from './clip-blend-strength.js';
import {
    findInternalClippingOwner,
    findInternalClippingSource,
    getInternalFolderRasterDescendants
} from './internal-layer-clipping-contract.js';

export class TimelineFrameCompositor {
    constructor(model, layerSystem = null) {
        if (!model) throw new Error('TimelineFrameCompositor: model is required');
        this.model = model;
        this.layerSystem = layerSystem;
        this._snapshotCanvasCache = new Map();
    }

    getFrameCount() {
        const hasClips = (this.model.tracks || []).some(track => {
            return track.type !== 'folder'
                && track.isBackground !== true
                && track.visible !== false
                && Array.isArray(track.cels)
                && track.cels.length > 0;
        });
        return hasClips ? Math.max(1, this.model.totalFrames || 1) : 0;
    }

    getFps() {
        return Math.max(1, this.model.fps || 12);
    }

    async renderFrames(options = {}) {
        const frameCount = this.getFrameCount();
        if (frameCount === 0) return [];

        const startFrame = Math.max(0, options.startFrame ?? 0);
        const endFrame = Math.min(
            frameCount - 1,
            options.endFrame ?? frameCount - 1
        );
        if (endFrame < startFrame) return [];

        const frames = [];
        for (let frameIndex = startFrame; frameIndex <= endFrame; frameIndex++) {
            frames.push({
                index: frameIndex,
                canvas: this.renderFrame(frameIndex, options),
                delayMs: Math.round(1000 / this.getFps())
            });
            options.onProgress?.(frameIndex - startFrame + 1, endFrame - startFrame + 1);
            await this._yield();
        }
        return frames;
    }

    renderFrame(frameIndex, options = {}) {
        const configSize = window.TEGAKI_CONFIG?.canvas || {};
        const sourceWidth = options.sourceWidth || configSize.width || 400;
        const sourceHeight = options.sourceHeight || configSize.height || 400;
        const resolution = Math.max(0.01, options.resolution || 1);
        const width = Math.max(1, Math.round(sourceWidth * resolution));
        const height = Math.max(1, Math.round(sourceHeight * resolution));
        const canvas = this._createCanvas(width, height);
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error('Timeline frame canvas context is unavailable');

        this._renderBackground(ctx, width, height, options);
        ctx.save();
        ctx.scale(resolution, resolution);

        const frameTree = this.model.getFrameAssetTree(frameIndex, {
            laneIds: options.laneIds
        });
        this._renderLayerStack(ctx, frameTree, sourceWidth, sourceHeight, frameIndex);

        ctx.restore();
        return canvas;
    }

    _renderLayerStack(ctx, frameTree, width, height, frameIndex) {
        const clipByLaneId = new Map(frameTree.clips.map(clip => [clip.laneId, clip]));
        const trackBySourceLayerId = new Map(
            (this.model.tracks || [])
                .filter(track => track.type !== 'folder' && track.isBackground !== true && track.visible !== false)
                .map(track => [track.sourceLayerId || track.layerId, track])
        );
        const renderedLaneIds = new Set();
        const layers = this.layerSystem?.getLayers?.() || [];

        this._renderNormalLayerGroup(ctx, layers, null, width, height, {
            trackBySourceLayerId,
            clipByLaneId,
            renderedLaneIds,
            frameIndex
        });

        // source Layerが既に存在しないLane等もTimeline順で合成する。
        for (let index = frameTree.clips.length - 1; index >= 0; index--) {
            const clipEntry = frameTree.clips[index];
            if (renderedLaneIds.has(clipEntry.laneId)) continue;
            this._renderClipEntry(ctx, clipEntry, width, height, frameIndex);
        }
    }

    _renderNormalLayerGroup(ctx, layers, parentId, width, height, context) {
        const siblings = (layers || []).filter(layer => {
            const data = layer?.layerData;
            if (!data || data.isBackground) return false;
            return (data.parentId || null) === (parentId || null);
        });
        let rendered = false;

        for (let index = siblings.length - 1; index >= 0; index--) {
            const layer = siblings[index];
            const layerData = layer.layerData;
            if (layerData.visible === false) continue;

            if (layerData.isFolder) {
                const folderCanvas = this._createCanvas(width, height);
                const folderCtx = folderCanvas.getContext('2d');
                if (!folderCtx) continue;
                const hasFolderContent = this._renderNormalLayerGroup(
                    folderCtx,
                    layers,
                    layerData.id,
                    width,
                    height,
                    context
                );
                const opacity = this._getOwnOpacity(layerData);
                if (!hasFolderContent || opacity <= 0) continue;

                ctx.save();
                ctx.globalAlpha = opacity;
                ctx.globalCompositeOperation = this._compositeMode(layerData.blendMode);
                ctx.drawImage(folderCanvas, 0, 0);
                ctx.restore();
                rendered = true;
                continue;
            }

            if (layerData.isAnimationWorkingLayer === true) continue;

            const track = context.trackBySourceLayerId.get(layerData.id);
            if (track) {
                const clipEntry = context.clipByLaneId.get(track.id);
                if (clipEntry) {
                    this._renderClipEntry(ctx, clipEntry, width, height, context.frameIndex);
                    context.renderedLaneIds.add(track.id);
                    rendered = true;
                }
                continue;
            }

            const layerRendered = this._renderStaticLayer(ctx, layer, width, height);
            rendered = layerRendered || rendered;
        }

        return rendered;
    }

    _renderClipEntry(ctx, clipEntry, width, height, frameIndex) {
        if (clipEntry.visible === false) return;
        const asset = this.model.getClipAsset(clipEntry.assetId);
        if (!asset) return;
        const assetCanvas = this._renderAsset(asset, width, height);
        if (!assetCanvas) return;
        this._drawTransformedClip(
            ctx,
            assetCanvas,
            sampleClipTransform(clipEntry, frameIndex),
            width,
            height
        );
    }

    _renderStaticLayer(ctx, layer, width, height) {
        const layerData = layer.layerData;
        if (!this._isNormalLayerEffectivelyVisible(layerData)) return;
        const snapshot = this.layerSystem?.createLayerRasterSnapshot?.(layer);
        if (!snapshot?.pixels) return;
        const canvas = this._createCanvas(snapshot.width || width, snapshot.height || height);
        const snapshotCtx = canvas.getContext('2d');
        snapshotCtx.putImageData(
            new ImageData(new Uint8ClampedArray(snapshot.pixels), canvas.width, canvas.height),
            0,
            0
        );

        ctx.save();
        ctx.globalAlpha = Number.isFinite(layerData.opacity) ? layerData.opacity : 1;
        ctx.globalCompositeOperation = this._compositeMode(layerData.blendMode);
        ctx.translate(layer.x || 0, layer.y || 0);
        ctx.rotate(layer.rotation || 0);
        ctx.scale(layer.scale?.x ?? 1, layer.scale?.y ?? 1);
        const rasterBounds = this._getSnapshotRasterBounds(snapshot);
        ctx.drawImage(canvas, rasterBounds.x, rasterBounds.y);
        ctx.restore();
        return true;
    }

    _isNormalLayerEffectivelyVisible(layerData) {
        if (!layerData || layerData.visible === false) return false;
        const layers = this.layerSystem?.getLayers?.() || [];
        const byId = new Map(layers.map(layer => [layer.layerData?.id, layer.layerData]));
        let current = layerData;
        const visited = new Set();
        while (current?.parentId && !visited.has(current.id)) {
            visited.add(current.id);
            current = byId.get(current.parentId);
            if (!current || current.visible === false) return false;
        }
        return true;
    }

    _renderAsset(asset, width, height) {
        const canvas = this._createCanvas(width, height);
        const ctx = canvas.getContext('2d');
        if (!ctx) return null;

        const rendered = this._renderAssetLayerGroup(ctx, asset, null, width, height);
        return rendered ? canvas : null;
    }

    _renderAssetLayerGroup(ctx, asset, parentId, width, height) {
        const layers = asset.internalLayers || [];
        const siblings = layers.filter(layer => (layer.parentLayerId || null) === (parentId || null));
        let rendered = false;

        for (let index = siblings.length - 1; index >= 0; index--) {
            const layer = siblings[index];
            if (!layer || layer.visible === false) continue;

            if (layer.type === 'folder') {
                const folderCanvas = this._createCanvas(width, height);
                const folderCtx = folderCanvas.getContext('2d');
                if (!folderCtx) continue;
                const hasFolderContent = this._renderAssetLayerGroup(folderCtx, asset, layer.id, width, height);
                const opacity = this._getOwnOpacity(layer);
                if (!hasFolderContent || opacity <= 0) continue;

                ctx.save();
                ctx.globalAlpha = opacity;
                ctx.globalCompositeOperation = this._compositeMode(layer.blendMode);
                ctx.drawImage(folderCanvas, 0, 0);
                ctx.restore();
                rendered = true;
                continue;
            }

            const opacity = this._getOwnOpacity(layer);
            if (opacity <= 0) continue;

            const snapshot = this.model.getDrawingSnapshot(layer.drawingSnapshotId);
            const snapshotCanvas = this._getSnapshotCanvas(snapshot);
            if (!snapshotCanvas) continue;

            const layerCanvas = this._createCanvas(width, height);
            const layerCtx = layerCanvas.getContext('2d');
            if (!layerCtx) continue;
            const rasterBounds = this._getSnapshotRasterBounds(snapshot);
            layerCtx.drawImage(snapshotCanvas, rasterBounds.x, rasterBounds.y);
            this._applyClippingMask(asset, layer, layerCtx, width, height);

            ctx.save();
            ctx.globalAlpha = opacity;
            ctx.globalCompositeOperation = this._compositeMode(layer.blendMode);
            ctx.drawImage(layerCanvas, 0, 0);
            ctx.restore();
            rendered = true;
        }

        return rendered;
    }

    _applyClippingMask(asset, layer, ctx, width, height) {
        const owner = this._findClippingOwner(asset, layer);
        if (!owner) return;
        const source = owner ? this._findClippingSource(asset, owner) : null;
        if (!source) {
            ctx.clearRect(0, 0, width, height);
            return;
        }

        const maskCanvas = this._createCanvas(width, height);
        const maskCtx = maskCanvas.getContext('2d');
        const sourceLayers = source.type === 'folder'
            ? this._getFolderRasterDescendants(asset, source.id)
            : [source];

        let hasMask = false;
        sourceLayers.forEach(sourceLayer => {
            if (!this._isEffectivelyVisible(asset, sourceLayer)) return;
            const snapshot = this.model.getDrawingSnapshot(sourceLayer.drawingSnapshotId);
            const sourceCanvas = this._getSnapshotCanvas(snapshot);
            if (!sourceCanvas) return;
            const rasterBounds = this._getSnapshotRasterBounds(snapshot);
            maskCtx.drawImage(sourceCanvas, rasterBounds.x, rasterBounds.y);
            hasMask = true;
        });
        if (!hasMask) {
            ctx.clearRect(0, 0, width, height);
            return;
        }
        const maskImage = maskCtx.getImageData(0, 0, width, height);
        for (let offset = 0; offset < maskImage.data.length; offset += 4) {
            const alpha = maskImage.data[offset + 3] > 0 ? 255 : 0;
            maskImage.data[offset] = 255;
            maskImage.data[offset + 1] = 255;
            maskImage.data[offset + 2] = 255;
            maskImage.data[offset + 3] = alpha;
        }
        maskCtx.putImageData(maskImage, 0, 0);

        ctx.save();
        ctx.globalCompositeOperation = getClippingMode(owner) === CLIPPING_MODES.INVERSE
            ? 'destination-out'
            : 'destination-in';
        ctx.drawImage(maskCanvas, 0, 0);
        ctx.restore();
    }

    _drawTransformedClip(ctx, canvas, transform = {}, width, height) {
        if (transform.blendMode && transform.blendMode !== 'normal') {
            const transformedCanvas = this._createCanvas(width, height);
            const transformedCtx = transformedCanvas.getContext('2d');
            this._drawTransformedClip(
                transformedCtx,
                canvas,
                { ...transform, blendMode: 'normal' },
                width,
                height
            );
            this._drawBlendClip(
                ctx,
                transformedCanvas,
                width,
                height,
                transform.blendMode,
                transform.blendStrength
            );
            return;
        }
        const scaleX = Number.isFinite(transform.scaleX) ? transform.scaleX : 1;
        const scaleY = Number.isFinite(transform.scaleY) ? transform.scaleY : 1;
        const rotation = Number.isFinite(transform.rotation) ? transform.rotation : 0;
        const opacity = Math.max(0, Math.min(1, Number.isFinite(transform.opacity) ? transform.opacity : 1));
        const x = Number.isFinite(transform.x) ? transform.x : 0;
        const y = Number.isFinite(transform.y) ? transform.y : 0;
        const anchorX = Number.isFinite(transform.anchorX) ? transform.anchorX : 0.5;
        const anchorY = Number.isFinite(transform.anchorY) ? transform.anchorY : 0.5;
        const pivotX = width * anchorX;
        const pivotY = height * anchorY;

        ctx.save();
        ctx.globalAlpha *= opacity;
        ctx.globalCompositeOperation = this._compositeMode(transform.blendMode);
        ctx.translate(pivotX + x, pivotY + y);
        ctx.rotate(rotation);
        ctx.scale(scaleX, scaleY);
        ctx.drawImage(canvas, -pivotX, -pivotY);
        ctx.restore();
    }

    _drawBlendClip(ctx, sourceCanvas, width, height, blendMode, blendStrength = 1) {
        const sourceCtx = sourceCanvas.getContext('2d');
        const sourceImage = sourceCtx.getImageData(0, 0, width, height);
        const destinationImage = ctx.getImageData(0, 0, width, height);
        const source = sourceImage.data;
        const destination = destinationImage.data;

        for (let index = 0; index < destination.length; index += 4) {
            if (source[index + 3] <= 0) continue;
            const result = compositeClipPixel(
                destination.subarray(index, index + 4),
                source.subarray(index, index + 4),
                blendMode,
                blendStrength
            );
            destination.set(result, index);
        }
        ctx.putImageData(destinationImage, 0, 0);
    }

    _renderBackground(ctx, width, height, options) {
        if (options.transparent === true) {
            ctx.clearRect(0, 0, width, height);
            return;
        }

        const background = this.layerSystem?.getLayers?.()
            ?.find(layer => layer.layerData?.isBackground);
        const color = background?.layerData?.visible === false
            ? 0xffffff
            : (background?.layerData?.backgroundColor ?? 0xf0e0d6);
        ctx.fillStyle = `#${Number(color).toString(16).padStart(6, '0').slice(-6)}`;
        ctx.fillRect(0, 0, width, height);
    }

    _getSnapshotCanvas(snapshot) {
        if (!snapshot?.pixels || !snapshot.width || !snapshot.height) return null;
        const cacheKey = snapshot.id || snapshot;
        if (this._snapshotCanvasCache.has(cacheKey)) {
            return this._snapshotCanvasCache.get(cacheKey);
        }

        const canvas = this._createCanvas(snapshot.width, snapshot.height);
        const ctx = canvas.getContext('2d');
        const pixels = snapshot.pixels instanceof Uint8ClampedArray
            ? snapshot.pixels
            : new Uint8ClampedArray(snapshot.pixels);
        ctx.putImageData(new ImageData(pixels, snapshot.width, snapshot.height), 0, 0);
        this._snapshotCanvasCache.set(cacheKey, canvas);
        return canvas;
    }

    _getSnapshotRasterBounds(snapshot) {
        return normalizeRasterBounds(snapshot?.rasterBounds, {
            x: 0,
            y: 0,
            width: snapshot?.width || 1,
            height: snapshot?.height || 1
        });
    }

    _isEffectivelyVisible(asset, layer) {
        if (!layer || layer.visible === false) return false;
        const byId = new Map((asset.internalLayers || []).map(item => [item.id, item]));
        let current = layer;
        const visited = new Set();
        while (current?.parentLayerId && !visited.has(current.id)) {
            visited.add(current.id);
            current = byId.get(current.parentLayerId);
            if (!current || current.visible === false) return false;
        }
        return true;
    }

    _getEffectiveOpacity(asset, layer) {
        if (!layer) return 1;
        const byId = new Map((asset?.internalLayers || []).map(item => [item.id, item]));
        let opacity = Number.isFinite(layer.opacity) ? layer.opacity : 1;
        let current = layer;
        const visited = new Set();
        while (current?.parentLayerId && !visited.has(current.id)) {
            visited.add(current.id);
            current = byId.get(current.parentLayerId);
            if (!current) break;
            const parentOpacity = Number.isFinite(current.opacity) ? current.opacity : 1;
            opacity *= parentOpacity;
        }
        return Math.max(0, Math.min(1, opacity));
    }

    _getOwnOpacity(layer) {
        return Math.max(0, Math.min(1, Number.isFinite(layer?.opacity) ? layer.opacity : 1));
    }

    _getEffectiveBlendMode(asset, layer) {
        if (!layer) return 'normal';
        if (layer.blendMode && layer.blendMode !== 'normal') return layer.blendMode;
        const byId = new Map((asset?.internalLayers || []).map(item => [item.id, item]));
        let current = layer;
        const visited = new Set();
        while (current?.parentLayerId && !visited.has(current.id)) {
            visited.add(current.id);
            current = byId.get(current.parentLayerId);
            if (!current) break;
            if (current.blendMode && current.blendMode !== 'normal') return current.blendMode;
        }
        return 'normal';
    }

    _findClippingOwner(asset, layer) {
        return findInternalClippingOwner(asset, layer);
    }

    _findClippingSource(asset, owner) {
        return findInternalClippingSource(
            asset,
            owner,
            candidate => this._isEffectivelyVisible(asset, candidate)
        );
    }

    _getFolderRasterDescendants(asset, folderId) {
        return getInternalFolderRasterDescendants(asset, folderId);
    }

    _compositeMode(blendMode) {
        if (blendMode === 'add') return 'lighter';
        const supported = new Set([
            'multiply', 'screen', 'overlay', 'darken', 'lighten',
            'color-dodge', 'color-burn', 'hard-light', 'soft-light',
            'difference', 'exclusion', 'hue', 'saturation', 'color', 'luminosity'
        ]);
        return supported.has(blendMode) ? blendMode : 'source-over';
    }

    _createCanvas(width, height) {
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        return canvas;
    }

    _yield() {
        return new Promise(resolve => setTimeout(resolve, 0));
    }
}
