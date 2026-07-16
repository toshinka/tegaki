/**
 * TimelineModel / ClipAsset から exporter 共通の Canvas フレーム列を生成する。
 * UI の preview DOM や現在選択中の Frame / CAF / Layer 状態には依存しない。
 */
import {
    CLIPPING_MODES,
    getClippingMode
} from '../clipping-mode.js';
import {
    normalizeRasterBounds,
    unionRasterBounds,
    validateRasterSurfaceSize
} from '../raster-bounds.js';
import { sampleClipTransform } from './clip-transform-sampler.js';
import { sampleClipDeformer } from './clip-deformer.js';
import { warpRgbaWithControlMesh } from './control-mesh-rasterizer.js';
import { warpRgbaWithGrid } from './warp-grid-rasterizer.js';
import { compositeClipPixel } from './clip-blend-strength.js';
import {
    findInternalClippingOwner,
    findInternalClippingSource,
    getInternalFolderRasterDescendants
} from './internal-layer-clipping-contract.js';

function finiteOr(value, fallback) {
    return Number.isFinite(value) ? value : fallback;
}

/** Clip Motion適用後のProject座標tight boundsを返す純粋helper。 */
export function calculateTransformedClipBounds(surfaceBounds, transform, frameWidth, frameHeight) {
    const bounds = normalizeRasterBounds(surfaceBounds, { width: 1, height: 1 });
    const width = Math.max(1, finiteOr(frameWidth, 1));
    const height = Math.max(1, finiteOr(frameHeight, 1));
    const scaleX = finiteOr(transform?.scaleX, 1);
    const scaleY = finiteOr(transform?.scaleY, 1);
    const rotation = finiteOr(transform?.rotation, 0);
    const anchorX = finiteOr(transform?.anchorX, 0.5);
    const anchorY = finiteOr(transform?.anchorY, 0.5);
    const translateX = width * anchorX + finiteOr(transform?.x, 0);
    const translateY = height * anchorY + finiteOr(transform?.y, 0);
    const pivotX = width * anchorX;
    const pivotY = height * anchorY;
    const cosine = Math.cos(rotation);
    const sine = Math.sin(rotation);
    const mapPoint = (x, y) => {
        const localX = (x - pivotX) * scaleX;
        const localY = (y - pivotY) * scaleY;
        return {
            x: translateX + localX * cosine - localY * sine,
            y: translateY + localX * sine + localY * cosine
        };
    };
    const corners = [
        mapPoint(bounds.x, bounds.y),
        mapPoint(bounds.x + bounds.width, bounds.y),
        mapPoint(bounds.x + bounds.width, bounds.y + bounds.height),
        mapPoint(bounds.x, bounds.y + bounds.height)
    ];
    const left = Math.floor(Math.min(...corners.map(point => point.x)));
    const top = Math.floor(Math.min(...corners.map(point => point.y)));
    const right = Math.ceil(Math.max(...corners.map(point => point.x)));
    const bottom = Math.ceil(Math.max(...corners.map(point => point.y)));
    return { x: left, y: top, width: Math.max(1, right - left), height: Math.max(1, bottom - top) };
}

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

    /**
     * 選択ClipだけをWarp -> Clip Motion順でtight surfaceへ評価する。
     * 背景、通常Layer、他Laneを混ぜず、Bakeはこのexport共通評価を再利用する。
     */
    renderClipFrameSurface(clipId, frameIndex, options = {}) {
        const entry = this.model.findClipEntry?.(clipId);
        if (!entry?.clip || frameIndex < entry.clip.startFrame
            || frameIndex >= entry.clip.startFrame + entry.clip.duration) {
            return null;
        }
        const asset = this.model.getClipAsset(entry.clip.assetId);
        if (!asset) return null;
        let surface = this._renderAsset(asset);
        if (!surface) return null;

        const deformer = sampleClipDeformer(
            entry.clip.deformer,
            frameIndex - entry.clip.startFrame,
            entry.clip.duration
        );
        if (deformer) surface = this._deformAssetSurface(surface, deformer, asset.id);

        const configSize = window.TEGAKI_CONFIG?.canvas || {};
        const frameWidth = options.sourceWidth || configSize.width || 400;
        const frameHeight = options.sourceHeight || configSize.height || 400;
        const transform = sampleClipTransform(entry.clip, frameIndex);
        const bounds = this._assertSurfaceSizeAllowed(
            calculateTransformedClipBounds(surface.bounds, transform, frameWidth, frameHeight),
            `Clip ${entry.clip.id} baked frame`
        );
        const canvas = this._createCanvas(bounds.width, bounds.height);
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error(`Clip ${entry.clip.id} baked frame context is unavailable`);
        ctx.translate(-bounds.x, -bounds.y);
        this._drawTransformedClip(ctx, surface, {
            ...transform,
            blendMode: 'normal',
            blendStrength: 1
        }, frameWidth, frameHeight);
        return {
            canvas,
            bounds,
            blendMode: transform.blendMode || 'normal',
            blendStrength: Number.isFinite(transform.blendStrength) ? transform.blendStrength : 1,
            clipId: entry.clip.id,
            frameIndex
        };
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
        let assetSurface = this._renderAsset(asset);
        if (!assetSurface) return;
        const deformer = sampleClipDeformer(
            clipEntry.deformer,
            frameIndex - clipEntry.startFrame,
            clipEntry.duration
        );
        if (deformer) {
            assetSurface = this._deformAssetSurface(assetSurface, deformer, asset.id);
        }
        this._drawTransformedClip(
            ctx,
            assetSurface,
            sampleClipTransform(clipEntry, frameIndex),
            width,
            height
        );
    }

    _deformAssetSurface(surface, deformer, assetId) {
        const sourceCtx = surface.canvas.getContext('2d');
        if (!sourceCtx) return surface;
        const maxAxis = this.layerSystem?._getMaxRenderTextureSize?.() || 8192;
        const renderDeformer = deformer.type === 'control-mesh'
            ? warpRgbaWithControlMesh
            : warpRgbaWithGrid;
        const result = renderDeformer({
            pixels: sourceCtx.getImageData(0, 0, surface.canvas.width, surface.canvas.height).data,
            width: surface.canvas.width,
            height: surface.canvas.height,
            sourceBounds: surface.bounds,
            deformer,
            maxAxis,
            maxPixels: 16 * 1024 * 1024
        });
        const canvas = this._createCanvas(result.width, result.height);
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error(`ClipAsset ${assetId || '(unknown)'} Warp Grid context is unavailable`);
        ctx.putImageData(new ImageData(result.pixels, result.width, result.height), 0, 0);
        return { canvas, bounds: result.bounds };
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

    _renderAsset(asset) {
        const bounds = this._getAssetRasterBounds(asset);
        if (!bounds) return null;
        this._assertSurfaceSizeAllowed(bounds, `ClipAsset ${asset.id || '(unknown)'}`);

        const canvas = this._createCanvas(bounds.width, bounds.height);
        const ctx = canvas.getContext('2d');
        if (!ctx) return null;

        const rendered = this._renderAssetLayerGroup(ctx, asset, null, bounds);
        return rendered ? { canvas, bounds } : null;
    }

    _renderAssetLayerGroup(ctx, asset, parentId, surfaceBounds) {
        const layers = asset.internalLayers || [];
        const siblings = layers.filter(layer => (layer.parentLayerId || null) === (parentId || null));
        let rendered = false;

        for (let index = siblings.length - 1; index >= 0; index--) {
            const layer = siblings[index];
            if (!layer || layer.visible === false) continue;

            if (layer.type === 'folder') {
                const folderCanvas = this._createCanvas(surfaceBounds.width, surfaceBounds.height);
                const folderCtx = folderCanvas.getContext('2d');
                if (!folderCtx) continue;
                const hasFolderContent = this._renderAssetLayerGroup(folderCtx, asset, layer.id, surfaceBounds);
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

            const layerCanvas = this._createCanvas(surfaceBounds.width, surfaceBounds.height);
            const layerCtx = layerCanvas.getContext('2d');
            if (!layerCtx) continue;
            const rasterBounds = this._getSnapshotRasterBounds(snapshot);
            layerCtx.drawImage(
                snapshotCanvas,
                rasterBounds.x - surfaceBounds.x,
                rasterBounds.y - surfaceBounds.y
            );
            this._applyClippingMask(asset, layer, layerCtx, surfaceBounds);

            ctx.save();
            ctx.globalAlpha = opacity;
            ctx.globalCompositeOperation = this._compositeMode(layer.blendMode);
            ctx.drawImage(layerCanvas, 0, 0);
            ctx.restore();
            rendered = true;
        }

        return rendered;
    }

    _applyClippingMask(asset, layer, ctx, surfaceBounds) {
        const owner = this._findClippingOwner(asset, layer);
        if (!owner) return;
        const source = owner ? this._findClippingSource(asset, owner) : null;
        if (!source) {
            ctx.clearRect(0, 0, surfaceBounds.width, surfaceBounds.height);
            return;
        }

        const maskCanvas = this._createCanvas(surfaceBounds.width, surfaceBounds.height);
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
            maskCtx.drawImage(
                sourceCanvas,
                rasterBounds.x - surfaceBounds.x,
                rasterBounds.y - surfaceBounds.y
            );
            hasMask = true;
        });
        if (!hasMask) {
            ctx.clearRect(0, 0, surfaceBounds.width, surfaceBounds.height);
            return;
        }
        const maskImage = maskCtx.getImageData(0, 0, surfaceBounds.width, surfaceBounds.height);
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

    _drawTransformedClip(ctx, surface, transform = {}, width, height) {
        const canvas = surface?.canvas || surface;
        const bounds = surface?.bounds || { x: 0, y: 0, width: canvas.width, height: canvas.height };
        if (transform.blendMode && transform.blendMode !== 'normal') {
            const transformedCanvas = this._createCanvas(width, height);
            const transformedCtx = transformedCanvas.getContext('2d');
            this._drawTransformedClip(
                transformedCtx,
                { canvas, bounds },
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
        ctx.drawImage(canvas, bounds.x - pivotX, bounds.y - pivotY);
        ctx.restore();
    }

    _getAssetRasterBounds(asset) {
        const bounds = [];
        for (const layer of asset?.internalLayers || []) {
            if (!layer || layer.type === 'folder' || !this._isEffectivelyVisible(asset, layer)) continue;
            const snapshot = this.model.getDrawingSnapshot(layer.drawingSnapshotId);
            if (!snapshot?.pixels || !snapshot.width || !snapshot.height) continue;
            bounds.push(this._getSnapshotRasterBounds(snapshot));
        }
        return unionRasterBounds(bounds);
    }

    _assertSurfaceSizeAllowed(bounds, label = 'Raster surface') {
        const maxAxis = this.layerSystem?._getMaxRenderTextureSize?.() || 8192;
        const result = validateRasterSurfaceSize(bounds, {
            maxAxis,
            maxPixels: 16 * 1024 * 1024
        });
        if (!result.ok) {
            throw new Error(
                `${label} union surface exceeds the safe raster limit `
                + `(${result.bounds?.width || 0}x${result.bounds?.height || 0}, ${result.reason})`
            );
        }
        return result.bounds;
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
