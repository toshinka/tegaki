/**
 * TimelineModel / ClipAsset から exporter 共通の Canvas フレーム列を生成する。
 * UI の preview DOM や現在選択中の Frame / CAF / Layer 状態には依存しない。
 */
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
        this._renderLayerStack(ctx, frameTree, sourceWidth, sourceHeight);

        ctx.restore();
        return canvas;
    }

    _renderLayerStack(ctx, frameTree, width, height) {
        const clipByLaneId = new Map(frameTree.clips.map(clip => [clip.laneId, clip]));
        const trackBySourceLayerId = new Map(
            (this.model.tracks || [])
                .filter(track => track.type !== 'folder' && track.isBackground !== true)
                .map(track => [track.sourceLayerId || track.layerId, track])
        );
        const renderedLaneIds = new Set();
        const layers = this.layerSystem?.getLayers?.() || [];

        // LayerSystemも配列先頭が前面。通常Layerの位置へ対応CAFを差し込む。
        for (let index = layers.length - 1; index >= 0; index--) {
            const layer = layers[index];
            const layerData = layer?.layerData;
            if (!layerData || layerData.isBackground || layerData.isFolder) continue;
            // CAF編集用working Layerは選択CAFの最新内容を一時表示するミラー。
            // Timeline Snapshotと重ねると、そのCAFが全Frameへ焼き付くためexport対象外。
            if (layerData.isAnimationWorkingLayer === true) continue;

            const track = trackBySourceLayerId.get(layerData.id);
            if (track) {
                const clipEntry = clipByLaneId.get(track.id);
                if (clipEntry) {
                    this._renderClipEntry(ctx, clipEntry, width, height);
                    renderedLaneIds.add(track.id);
                }
                continue;
            }
            this._renderStaticLayer(ctx, layer, width, height);
        }

        // source Layerが既に存在しないLane等もTimeline順で合成する。
        for (let index = frameTree.clips.length - 1; index >= 0; index--) {
            const clipEntry = frameTree.clips[index];
            if (renderedLaneIds.has(clipEntry.laneId)) continue;
            this._renderClipEntry(ctx, clipEntry, width, height);
        }
    }

    _renderClipEntry(ctx, clipEntry, width, height) {
        if (clipEntry.visible === false) return;
        const asset = this.model.getClipAsset(clipEntry.assetId);
        if (!asset) return;
        const assetCanvas = this._renderAsset(asset, width, height);
        if (!assetCanvas) return;
        this._drawTransformedClip(ctx, assetCanvas, clipEntry.transform, width, height);
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
        ctx.drawImage(canvas, 0, 0);
        ctx.restore();
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

        const layers = asset.internalLayers || [];
        let rendered = false;
        for (let index = layers.length - 1; index >= 0; index--) {
            const layer = layers[index];
            if (layer.type === 'folder' || !this._isEffectivelyVisible(asset, layer)) continue;
            const opacity = Number.isFinite(layer.opacity) ? layer.opacity : 1;
            if (opacity <= 0) continue;

            const snapshot = this.model.getDrawingSnapshot(layer.drawingSnapshotId);
            const snapshotCanvas = this._getSnapshotCanvas(snapshot);
            if (!snapshotCanvas) continue;

            const layerCanvas = this._createCanvas(width, height);
            const layerCtx = layerCanvas.getContext('2d');
            layerCtx.drawImage(snapshotCanvas, 0, 0);
            this._applyClippingMask(asset, layer, layerCtx, width, height);

            ctx.save();
            ctx.globalAlpha = opacity;
            ctx.globalCompositeOperation = this._compositeMode(layer.blendMode);
            ctx.drawImage(layerCanvas, 0, 0);
            ctx.restore();
            rendered = true;
        }
        return rendered ? canvas : null;
    }

    _applyClippingMask(asset, layer, ctx, width, height) {
        const owner = this._findClippingOwner(asset, layer);
        const source = owner ? this._findClippingSource(asset, owner) : null;
        if (!source) return;

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
            maskCtx.drawImage(sourceCanvas, 0, 0);
            hasMask = true;
        });
        if (!hasMask) return;

        ctx.save();
        ctx.globalCompositeOperation = 'destination-in';
        ctx.drawImage(maskCanvas, 0, 0);
        ctx.restore();
    }

    _drawTransformedClip(ctx, canvas, transform = {}, width, height) {
        const scaleX = Number.isFinite(transform.scaleX) ? transform.scaleX : 1;
        const scaleY = Number.isFinite(transform.scaleY) ? transform.scaleY : 1;
        const rotation = Number.isFinite(transform.rotation) ? transform.rotation : 0;
        const x = Number.isFinite(transform.x) ? transform.x : 0;
        const y = Number.isFinite(transform.y) ? transform.y : 0;
        const anchorX = Number.isFinite(transform.anchorX) ? transform.anchorX : 0.5;
        const anchorY = Number.isFinite(transform.anchorY) ? transform.anchorY : 0.5;
        const pivotX = width * anchorX;
        const pivotY = height * anchorY;

        ctx.save();
        ctx.translate(pivotX + x, pivotY + y);
        ctx.rotate(rotation);
        ctx.scale(scaleX, scaleY);
        ctx.drawImage(canvas, -pivotX, -pivotY);
        ctx.restore();
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

    _findClippingOwner(asset, layer) {
        const byId = new Map((asset.internalLayers || []).map(item => [item.id, item]));
        let current = layer;
        const visited = new Set();
        while (current && !visited.has(current.id)) {
            visited.add(current.id);
            if (current.clipping === true) return current;
            current = current.parentLayerId ? byId.get(current.parentLayerId) : null;
        }
        return null;
    }

    _findClippingSource(asset, owner) {
        const layers = asset.internalLayers || [];
        const ownerIndex = layers.findIndex(item => item.id === owner.id);
        const parentId = owner.parentLayerId || null;
        for (let index = ownerIndex + 1; index < layers.length; index++) {
            const candidate = layers[index];
            if ((candidate.parentLayerId || null) !== parentId) continue;
            return this._isEffectivelyVisible(asset, candidate) ? candidate : null;
        }
        return null;
    }

    _getFolderRasterDescendants(asset, folderId) {
        const result = [];
        const collect = parentId => {
            (asset.internalLayers || []).forEach(layer => {
                if ((layer.parentLayerId || null) !== parentId) return;
                if (layer.type === 'folder') collect(layer.id);
                else result.push(layer);
            });
        };
        collect(folderId);
        return result;
    }

    _compositeMode(blendMode) {
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
