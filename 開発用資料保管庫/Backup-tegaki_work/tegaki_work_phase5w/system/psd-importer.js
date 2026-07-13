/**
 * ============================================================================
 * system/psd-importer.js
 * 責務: PSDをTegaki内部構造へ取り込む
 * 依存: ag-psd, system/animation/animation-data-model.js
 * 被依存: core-engine.js, image-importer.js
 * 公開API: PsdImporter
 * 実装状態: Active CAF import MVP
 * ============================================================================
 */

import { readPsd } from 'ag-psd';
import {
    ClipAssetInternalLayerModel,
    DrawingSnapshotModel
} from './animation/animation-data-model.js';
import { normalizeRasterBounds } from './raster-bounds.js';

export class PsdImporter {
    constructor(dependencies = {}) {
        this.eventBus = dependencies.eventBus || window.TegakiEventBus || null;
    }

    async importFileToActiveCaf(file, options = {}) {
        if (!file) return false;
        const table = this._getAnimationTable();
        const model = table?.model;
        const selectedEntry = table?.selectedCelId ? model?.findClipEntry?.(table.selectedCelId) : null;
        const selectedAssetId = table?.selectedAssetId || null;
        const selectedAssetEntry = selectedAssetId
            ? table?._findClipEntryByAssetId?.(selectedAssetId)
            : null;
        const targetEntry = selectedEntry?.clip?.assetId
            ? selectedEntry
            : (selectedAssetEntry || null);
        const targetAssetId = targetEntry?.clip?.assetId || selectedAssetId || null;
        const targetAsset = targetAssetId ? model?.getClipAsset?.(targetAssetId) : null;
        if (!table || !model || !targetAsset) {
            alert('PSDの取り込み先となるアクティブCAFを選択してください。');
            return false;
        }
        if (targetEntry?.clip && table.selectedCelId !== targetEntry.clip.id) {
            table._activateClipEntry?.(targetEntry, { saveCurrent: true });
        }
        if (targetEntry?.lane?.id) {
            table.activeLaneId = targetEntry.lane.id;
        }
        if (targetEntry?.clip?.id) {
            table.selectedCelId = targetEntry.clip.id;
        }
        table.selectedAssetId = targetAsset.id;
        table.selectedAssetFolderId = targetAsset.folderId || null;

        try {
            this._showOperation(`PSDを取り込み中... ${file.name || ''}`.trim());
            await this._nextFrame();
            const buffer = await file.arrayBuffer();
            const psd = readPsd(buffer, {
                useImageData: true,
                skipCompositeImageData: true,
                skipThumbnail: true
            });
            const placement = this._resolvePsdPlacement(psd, options);
            if (placement.mode === 'resize-canvas' && !this._resizeCanvasForPsdImport(placement, file)) {
                alert('PSDサイズに合わせたキャンバス変更に失敗しました。');
                return false;
            }

            const imported = this._buildActiveCafPayloadFromPsd(psd, file.name || 'PSD', placement);
            if (!imported.layers.length) {
                alert('PSD内に取り込めるRaster Layerがありません。');
                return false;
            }

            table._saveSelectedClipFromWorkingLayers?.();
            const beforeState = table._captureActiveCafAssetHistoryState?.(targetAsset)
                || table._captureTimelineHistoryState?.();
            table._resetCafPreviewRuntime?.('psd-import-active-caf-before-apply');

            imported.snapshots.forEach(snapshot => model.drawingSnapshots.push(snapshot));
            targetAsset.name = imported.name;
            targetAsset.type = 'raster';
            targetAsset.drawingSnapshotId = imported.layers.find(layer => layer.type !== 'folder')?.drawingSnapshotId || null;
            targetAsset.internalLayers = imported.layers;
            targetAsset.updatedAt = Date.now();

            table.selectedInternalLayerId = imported.layers.find(layer => layer.type !== 'folder')?.id || imported.layers[0]?.id || null;
            if (table._resetCafPreviewRuntime) {
                table._resetCafPreviewRuntime('psd-import-active-caf-after-apply');
            } else {
                table._invalidateSnapshotTextureCache?.({ immediate: true });
            }
            const syncOk = targetEntry?.clip
                ? table._syncClipAssetToWorkingLayers?.(targetEntry.clip, { forceRestore: true }) !== false
                : table._syncSelectedClipToWorkingLayers?.({ forceRestore: true }) !== false;
            if (!syncOk) {
                if (beforeState?.asset && table._restoreActiveCafAssetHistoryState) {
                    table._restoreActiveCafAssetHistoryState(targetAsset.id, beforeState);
                }
                alert('PSDの取り込み後にキャンバス表示へ同期できませんでした。');
                return false;
            }
            table.render?.();
            table._flushLayerPanelSync?.();

            const afterState = table._captureActiveCafAssetHistoryState?.(targetAsset)
                || table._captureTimelineHistoryState?.();
            if (table._recordActiveCafAssetHistoryFromStates && beforeState?.asset && afterState?.asset) {
                table._recordActiveCafAssetHistoryFromStates(targetAsset, beforeState, afterState, 'caf-import-psd-active-caf', {
                    type: 'caf-import-psd-active-caf',
                    source: 'psd',
                    fileName: file.name || null,
                    assetId: targetAsset.id,
                    placement
                });
            } else {
                table._recordTimelineHistory?.(beforeState, afterState, 'caf-import-psd-active-caf', {
                    type: 'caf-import-psd-active-caf',
                    source: 'psd',
                    fileName: file.name || null,
                    assetId: targetAsset.id,
                    placement
                });
            }
            this.eventBus?.emit?.('image:imported', {
                source: 'psd',
                mode: 'active-caf',
                fileName: file.name || null,
                placement
            });
            this._showToast(this._formatImportToast(placement));
            return true;
        } catch (error) {
            console.error('[PsdImporter] Active CAF PSD import failed:', error);
            alert('PSDの取り込みに失敗しました。');
            return false;
        } finally {
            this._hideOperation();
        }
    }

    _buildActiveCafPayloadFromPsd(psd, fallbackName, placement = null) {
        const snapshots = [];
        const layers = [];
        const rootChildren = Array.isArray(psd?.children) ? psd.children : [];
        const baseName = String(fallbackName || 'PSD').replace(/\.psd$/i, '') || 'PSD';
        const resolvedPlacement = placement || this._resolvePsdPlacement(psd);

        const visitSiblings = (children, parentLayerId = null) => {
            children.slice().reverse().forEach(child => {
                if (!child) return;
                const isFolder = Array.isArray(child.children);
                if (isFolder) {
                    const folderLayer = new ClipAssetInternalLayerModel({
                        name: child.name || 'Folder',
                        type: 'folder',
                        parentLayerId,
                        visible: child.hidden !== true,
                        opacity: this._normalizeOpacity(child.opacity),
                        blendMode: this._convertBlendMode(child.blendMode, true)
                    });
                    layers.push(folderLayer);
                    visitSiblings(child.children, folderLayer.id);
                    return;
                }

                const imageData = this._extractImageData(child);
                if (!imageData) return;
                const left = Number.isFinite(child.left) ? Math.round(child.left) : 0;
                const top = Number.isFinite(child.top) ? Math.round(child.top) : 0;
                const trimmed = this._trimImageDataToAlphaBounds(imageData, left, top);
                if (!trimmed) return;
                const prepared = this._placeTrimmedLayer(trimmed, resolvedPlacement);
                if (!prepared) return;
                const snapshot = new DrawingSnapshotModel({
                    width: prepared.width,
                    height: prepared.height,
                    rasterBounds: {
                        x: prepared.left,
                        y: prepared.top,
                        width: prepared.width,
                        height: prepared.height
                    },
                    pixels: prepared.pixels,
                    isBlank: trimmed.isBlank
                });
                snapshots.push(snapshot);
                layers.push(new ClipAssetInternalLayerModel({
                    name: child.name || 'Layer',
                    type: 'raster',
                    parentLayerId,
                    visible: child.hidden !== true,
                    opacity: this._normalizeOpacity(child.opacity),
                    blendMode: this._convertBlendMode(child.blendMode, false),
                    clipping: child.clipping === true,
                    drawingSnapshotId: snapshot.id
                }));
            });
        };

        visitSiblings(rootChildren, null);
        this._bakeImportedClippingIntoSnapshots(layers, snapshots);
        return {
            name: baseName,
            layers,
            snapshots
        };
    }

    _bakeImportedClippingIntoSnapshots(layers, snapshots) {
        if (!Array.isArray(layers) || !Array.isArray(snapshots)) return;

        const snapshotById = new Map(snapshots.map(snapshot => [snapshot.id, snapshot]));
        let bakedCount = 0;
        layers.forEach(layer => {
            if (!layer || layer.type === 'folder' || layer.clipping !== true) return;
            const snapshot = snapshotById.get(layer.drawingSnapshotId);
            const sourceItem = this._findImportedClippingSourceItem(layers, layer);
            if (snapshot?.pixels && sourceItem) {
                const sourceSnapshots = this._collectImportedMaskSnapshots(layers, snapshotById, sourceItem);
                if (sourceSnapshots.length > 0 && this._applyMaskSnapshotsToImportedSnapshot(snapshot, sourceSnapshots)) {
                    bakedCount++;
                }
            }

            // PSD由来のクリッピングは取り込み時点でピクセルへ焼き込み、CAF作業レイヤーへ
            // Pixi maskを持ち込まない。互換性より連続ロード時の安定性を優先する。
            layer.clipping = false;
            layer.updatedAt = Date.now();
        });

        if (bakedCount > 0 && window.TEGAKI_CONFIG?.debug?.enabled) {
            console.info('[PsdImporter] Baked PSD clipping into raster snapshots', { bakedCount });
        }
    }

    _findImportedClippingSourceItem(layers, clippingOwner) {
        if (!Array.isArray(layers) || !clippingOwner) return null;

        const layerIndex = layers.findIndex(item => item.id === clippingOwner.id);
        if (layerIndex < 0) return null;

        const parentId = clippingOwner.parentLayerId || null;
        for (let index = layerIndex + 1; index < layers.length; index++) {
            const candidate = layers[index];
            if (!candidate) continue;
            if ((candidate.parentLayerId || null) !== parentId) continue;
            if (!this._isImportedLayerEffectivelyVisible(layers, candidate)) return null;
            return candidate;
        }

        return null;
    }

    _collectImportedMaskSnapshots(layers, snapshotById, sourceItem) {
        if (!sourceItem || !snapshotById) return [];
        const sourceLayers = sourceItem.type === 'folder'
            ? this._getImportedFolderDescendantRasterLayers(layers, sourceItem.id)
            : [sourceItem];

        return sourceLayers.map(layer => {
            if (!this._isImportedLayerEffectivelyVisible(layers, layer)) return null;
            const snapshot = snapshotById.get(layer.drawingSnapshotId);
            return snapshot?.pixels ? snapshot : null;
        }).filter(Boolean);
    }

    _getImportedFolderDescendantRasterLayers(layers, folderId) {
        const result = [];
        const collect = (parentId) => {
            layers.forEach(layer => {
                if ((layer.parentLayerId || null) !== parentId) return;
                if (layer.type === 'folder') {
                    collect(layer.id);
                    return;
                }
                result.push(layer);
            });
        };
        collect(folderId);
        return result;
    }

    _isImportedLayerEffectivelyVisible(layers, layer) {
        if (!layer || layer.visible === false) return false;
        const byId = new Map((layers || []).map(item => [item.id, item]));
        let current = layer.parentLayerId ? byId.get(layer.parentLayerId) : null;
        const visited = new Set();

        while (current && !visited.has(current.id)) {
            visited.add(current.id);
            if (current.visible === false) return false;
            current = current.parentLayerId ? byId.get(current.parentLayerId) : null;
        }

        return true;
    }

    _applyMaskSnapshotsToImportedSnapshot(targetSnapshot, sourceSnapshots) {
        if (!targetSnapshot?.pixels || !Array.isArray(sourceSnapshots) || sourceSnapshots.length === 0) {
            return false;
        }

        const width = Math.max(1, Math.round(targetSnapshot.width || 0));
        const height = Math.max(1, Math.round(targetSnapshot.height || 0));
        if (targetSnapshot.pixels.length < width * height * 4) return false;

        const targetBounds = normalizeRasterBounds(targetSnapshot.rasterBounds, {
            x: 0,
            y: 0,
            width,
            height
        });
        const maskAlpha = new Uint8ClampedArray(width * height);

        sourceSnapshots.forEach(sourceSnapshot => {
            const sourceWidth = Math.max(1, Math.round(sourceSnapshot.width || 0));
            const sourceHeight = Math.max(1, Math.round(sourceSnapshot.height || 0));
            const sourcePixels = sourceSnapshot.pixels;
            if (!sourcePixels || sourcePixels.length < sourceWidth * sourceHeight * 4) return;

            const sourceBounds = normalizeRasterBounds(sourceSnapshot.rasterBounds, {
                x: 0,
                y: 0,
                width: sourceWidth,
                height: sourceHeight
            });
            for (let targetY = 0; targetY < height; targetY++) {
                const sourceY = targetBounds.y + targetY - sourceBounds.y;
                if (sourceY < 0 || sourceY >= sourceHeight) continue;
                for (let targetX = 0; targetX < width; targetX++) {
                    const sourceX = targetBounds.x + targetX - sourceBounds.x;
                    if (sourceX < 0 || sourceX >= sourceWidth) continue;
                    const sourceAlpha = sourcePixels[(sourceY * sourceWidth + sourceX) * 4 + 3];
                    const maskIndex = targetY * width + targetX;
                    if (sourceAlpha > maskAlpha[maskIndex]) {
                        maskAlpha[maskIndex] = sourceAlpha;
                    }
                }
            }
        });

        const pixels = targetSnapshot.pixels instanceof Uint8ClampedArray
            ? new Uint8ClampedArray(targetSnapshot.pixels)
            : new Uint8ClampedArray(targetSnapshot.pixels);
        let changed = false;
        for (let alphaIndex = 3, maskIndex = 0; alphaIndex < pixels.length; alphaIndex += 4, maskIndex++) {
            const nextAlpha = Math.round((pixels[alphaIndex] * maskAlpha[maskIndex]) / 255);
            if (nextAlpha !== pixels[alphaIndex]) {
                pixels[alphaIndex] = nextAlpha;
                changed = true;
            }
        }

        if (!changed) return false;
        targetSnapshot.pixels = pixels;
        targetSnapshot.updatedAt = Date.now();
        targetSnapshot.isBlank = !pixels.some((value, index) => index % 4 === 3 && value > 0);
        return true;
    }

    _resolvePsdPlacement(psd, options = {}) {
        const mode = this._normalizePlacementMode(options.placementMode);
        const sourceSize = this._getPsdDocumentSize(psd);
        const canvasConfig = window.TEGAKI_CONFIG?.canvas || {};
        const currentWidth = Math.max(1, Math.round(canvasConfig.width || sourceSize.width));
        const currentHeight = Math.max(1, Math.round(canvasConfig.height || sourceSize.height));
        const maxCanvasSize = Math.max(1, Math.round(canvasConfig.maxSize || 2500));
        const maxTextureSize = this._getMaxRenderTextureSize();
        const maxPixels = this._getMaxLayerPixels();
        const sourcePixels = sourceSize.width * sourceSize.height;
        const safeScale = Math.min(
            1,
            maxTextureSize / sourceSize.width,
            maxTextureSize / sourceSize.height,
            Math.sqrt(maxPixels / Math.max(1, sourcePixels))
        );

        if (mode === 'fit-canvas') {
            const scale = Math.min(
                safeScale,
                currentWidth / sourceSize.width,
                currentHeight / sourceSize.height
            );
            const targetWidth = Math.max(1, Math.round(sourceSize.width * scale));
            const targetHeight = Math.max(1, Math.round(sourceSize.height * scale));
            return {
                mode,
                sourceWidth: sourceSize.width,
                sourceHeight: sourceSize.height,
                targetCanvasWidth: currentWidth,
                targetCanvasHeight: currentHeight,
                scale,
                offsetX: Math.round((currentWidth - targetWidth) / 2),
                offsetY: Math.round((currentHeight - targetHeight) / 2),
                constrained: scale < 0.999
            };
        }

        if (mode === 'resize-canvas') {
            const scale = Math.min(
                safeScale,
                maxCanvasSize / sourceSize.width,
                maxCanvasSize / sourceSize.height
            );
            return {
                mode,
                sourceWidth: sourceSize.width,
                sourceHeight: sourceSize.height,
                targetCanvasWidth: Math.max(1, Math.round(sourceSize.width * scale)),
                targetCanvasHeight: Math.max(1, Math.round(sourceSize.height * scale)),
                scale,
                offsetX: 0,
                offsetY: 0,
                constrained: scale < 0.999
            };
        }

        return {
            mode,
            sourceWidth: sourceSize.width,
            sourceHeight: sourceSize.height,
            targetCanvasWidth: currentWidth,
            targetCanvasHeight: currentHeight,
            scale: safeScale,
            offsetX: 0,
            offsetY: 0,
            constrained: safeScale < 0.999
        };
    }

    _getPsdDocumentSize(psd) {
        const width = Math.max(1, Math.round(Number(psd?.width) || 0));
        const height = Math.max(1, Math.round(Number(psd?.height) || 0));
        if (width > 1 || height > 1) {
            return { width, height };
        }

        const bounds = { minX: 0, minY: 0, maxX: 1, maxY: 1 };
        const visit = (children = []) => {
            children.forEach(child => {
                if (!child) return;
                if (Array.isArray(child.children)) {
                    visit(child.children);
                    return;
                }
                const imageData = child.imageData || child.canvas || null;
                const childWidth = Math.max(0, Math.round(Number(imageData?.width) || 0));
                const childHeight = Math.max(0, Math.round(Number(imageData?.height) || 0));
                const left = Number.isFinite(child.left) ? Math.round(child.left) : 0;
                const top = Number.isFinite(child.top) ? Math.round(child.top) : 0;
                bounds.minX = Math.min(bounds.minX, left);
                bounds.minY = Math.min(bounds.minY, top);
                bounds.maxX = Math.max(bounds.maxX, left + childWidth);
                bounds.maxY = Math.max(bounds.maxY, top + childHeight);
            });
        };
        visit(Array.isArray(psd?.children) ? psd.children : []);
        return {
            width: Math.max(1, bounds.maxX - bounds.minX),
            height: Math.max(1, bounds.maxY - bounds.minY)
        };
    }

    _placeTrimmedLayer(trimmed, placement) {
        if (!trimmed?.pixels || !placement) return null;
        const scale = Number.isFinite(placement.scale) && placement.scale > 0
            ? placement.scale
            : 1;
        const targetWidth = Math.max(1, Math.round(trimmed.width * scale));
        const targetHeight = Math.max(1, Math.round(trimmed.height * scale));
        if (!this._isLayerSizeSafe(targetWidth, targetHeight)) {
            console.warn('[PsdImporter] PSD layer skipped: scaled layer exceeds safe texture size', {
                width: targetWidth,
                height: targetHeight,
                sourceWidth: trimmed.width,
                sourceHeight: trimmed.height,
                scale
            });
            return null;
        }

        const left = Math.round((placement.offsetX || 0) + trimmed.left * scale);
        const top = Math.round((placement.offsetY || 0) + trimmed.top * scale);
        if (trimmed.isBlank) {
            return {
                width: 1,
                height: 1,
                left,
                top,
                pixels: new Uint8ClampedArray(4)
            };
        }
        if (Math.abs(scale - 1) < 0.0001 && targetWidth === trimmed.width && targetHeight === trimmed.height) {
            return {
                width: trimmed.width,
                height: trimmed.height,
                left,
                top,
                pixels: trimmed.pixels
            };
        }
        return this._scalePixels(trimmed, targetWidth, targetHeight, left, top);
    }

    _scalePixels(trimmed, targetWidth, targetHeight, left, top) {
        const sourceCanvas = document.createElement('canvas');
        sourceCanvas.width = trimmed.width;
        sourceCanvas.height = trimmed.height;
        const sourceCtx = sourceCanvas.getContext('2d', { willReadFrequently: true });
        if (!sourceCtx) return null;
        sourceCtx.putImageData(
            new ImageData(new Uint8ClampedArray(trimmed.pixels), trimmed.width, trimmed.height),
            0,
            0
        );

        const targetCanvas = document.createElement('canvas');
        targetCanvas.width = targetWidth;
        targetCanvas.height = targetHeight;
        const targetCtx = targetCanvas.getContext('2d', { willReadFrequently: true });
        if (!targetCtx) return null;
        targetCtx.clearRect(0, 0, targetWidth, targetHeight);
        targetCtx.imageSmoothingEnabled = true;
        targetCtx.imageSmoothingQuality = 'high';
        targetCtx.drawImage(sourceCanvas, 0, 0, trimmed.width, trimmed.height, 0, 0, targetWidth, targetHeight);
        const scaled = targetCtx.getImageData(0, 0, targetWidth, targetHeight);
        return {
            width: targetWidth,
            height: targetHeight,
            left,
            top,
            pixels: new Uint8ClampedArray(scaled.data)
        };
    }

    _extractImageData(layer) {
        const imageData = layer?.imageData;
        if (imageData?.data && imageData.width && imageData.height) {
            return {
                width: Math.max(1, Math.round(imageData.width)),
                height: Math.max(1, Math.round(imageData.height)),
                data: imageData.data
            };
        }
        const canvas = layer?.canvas;
        const ctx = canvas?.getContext?.('2d');
        if (ctx && canvas.width && canvas.height) {
            return ctx.getImageData(0, 0, canvas.width, canvas.height);
        }
        return null;
    }

    _trimImageDataToAlphaBounds(imageData, left = 0, top = 0) {
        const width = Math.max(1, Math.round(imageData?.width || 0));
        const height = Math.max(1, Math.round(imageData?.height || 0));
        const data = imageData?.data;
        const expectedLength = width * height * 4;
        if (!data || data.length < expectedLength) return null;

        let minX = width;
        let minY = height;
        let maxX = -1;
        let maxY = -1;

        for (let y = 0; y < height; y++) {
            const rowStart = y * width * 4;
            for (let x = 0; x < width; x++) {
                if (data[rowStart + x * 4 + 3] === 0) continue;
                if (x < minX) minX = x;
                if (y < minY) minY = y;
                if (x > maxX) maxX = x;
                if (y > maxY) maxY = y;
            }
        }

        if (maxX < minX || maxY < minY) {
            return {
                width: 1,
                height: 1,
                left,
                top,
                pixels: new Uint8ClampedArray(4),
                isBlank: true
            };
        }

        const trimmedWidth = maxX - minX + 1;
        const trimmedHeight = maxY - minY + 1;
        const pixels = new Uint8ClampedArray(trimmedWidth * trimmedHeight * 4);
        for (let y = 0; y < trimmedHeight; y++) {
            const sourceStart = ((minY + y) * width + minX) * 4;
            const targetStart = y * trimmedWidth * 4;
            pixels.set(data.subarray(sourceStart, sourceStart + trimmedWidth * 4), targetStart);
        }

        return {
            width: trimmedWidth,
            height: trimmedHeight,
            left: left + minX,
            top: top + minY,
            pixels,
            isBlank: false
        };
    }

    _normalizeOpacity(opacity) {
        const value = Number(opacity);
        if (!Number.isFinite(value)) return 1;
        return Math.max(0, Math.min(1, value > 1 ? value / 255 : value));
    }

    _convertBlendMode(blendMode, isFolder = false) {
        const mode = String(blendMode || '').toLowerCase();
        const map = {
            'normal': 'normal',
            'pass through': 'normal',
            'multiply': 'multiply',
            'screen': 'screen',
            'overlay': 'overlay',
            'linear dodge': 'add',
            'color dodge': 'color-dodge',
            'color burn': 'color-burn',
            'hard light': 'hard-light',
            'soft light': 'soft-light',
            'darken': 'darken',
            'lighten': 'lighten',
            'difference': 'difference',
            'exclusion': 'exclusion'
        };
        return map[mode] || (isFolder ? 'normal' : 'normal');
    }

    _normalizePlacementMode(mode) {
        return ['fit-canvas', 'original', 'resize-canvas'].includes(mode)
            ? mode
            : 'fit-canvas';
    }

    _resizeCanvasForPsdImport(placement, file) {
        const width = Math.max(1, Math.round(placement?.targetCanvasWidth || 0));
        const height = Math.max(1, Math.round(placement?.targetCanvasHeight || 0));
        if (!width || !height) return false;

        const currentWidth = Math.max(1, Math.round(window.TEGAKI_CONFIG?.canvas?.width || 0));
        const currentHeight = Math.max(1, Math.round(window.TEGAKI_CONFIG?.canvas?.height || 0));
        if (currentWidth === width && currentHeight === height) return true;

        if (window.imageImporter?._resizeCanvasForImport) {
            return window.imageImporter._resizeCanvasForImport(width, height, {
                source: 'psd',
                name: file?.name || null
            });
        }

        const camera = window.coreEngine?.getCameraSystem?.() || window.cameraSystem || null;
        if (!camera?.resizeCanvas) return false;
        camera.resizeCanvas(width, height, { horizontal: 'center', vertical: 'center' });
        return true;
    }

    _getMaxRenderTextureSize() {
        const layerSystem = window.layerManager || window.coreEngine?.layerSystem || null;
        const value = Number(layerSystem?._getMaxRenderTextureSize?.());
        return Number.isFinite(value) && value > 0 ? value : 8192;
    }

    _getMaxLayerPixels() {
        return 16 * 1024 * 1024;
    }

    _isLayerSizeSafe(width, height) {
        const maxTextureSize = this._getMaxRenderTextureSize();
        const safeWidth = Math.max(1, Math.round(width || 0));
        const safeHeight = Math.max(1, Math.round(height || 0));
        return safeWidth <= maxTextureSize
            && safeHeight <= maxTextureSize
            && safeWidth * safeHeight <= this._getMaxLayerPixels();
    }

    _formatImportToast(placement) {
        const scale = Number(placement?.scale || 1);
        if (placement?.mode === 'resize-canvas') {
            return placement.constrained
                ? `PSDを縮小してCAFへ取り込みました (${Math.round(scale * 100)}%)`
                : 'PSDをCAFへ取り込み、キャンバスをPSDサイズへ変更しました';
        }
        if (placement?.mode === 'fit-canvas') {
            return `PSDをキャンバス内へ収めてCAFへ取り込みました (${Math.round(scale * 100)}%)`;
        }
        return placement?.constrained
            ? `PSDを安全サイズへ縮小してCAFへ取り込みました (${Math.round(scale * 100)}%)`
            : 'PSDを原寸でCAFへ取り込みました';
    }

    _showToast(message) {
        window.projectManager?._showSaveToast?.(message);
    }

    _getAnimationTable() {
        return window.PopupManager?.get?.('animationTable')
            || window.PopupManager?.popups?.get?.('animationTable')?.instance
            || window.coreEngine?.popupManager?.get?.('animationTable')
            || null;
    }

    _showOperation(message) {
        const layerSystem = window.layerManager || window.coreEngine?.layerSystem || null;
        layerSystem?._showOperationIndicator?.(message || 'PSDを取り込み中...');
    }

    _hideOperation() {
        const layerSystem = window.layerManager || window.coreEngine?.layerSystem || null;
        layerSystem?._hideOperationIndicator?.();
    }

    _nextFrame() {
        return new Promise(resolve => requestAnimationFrame(() => resolve()));
    }
}

window.PsdImporter = PsdImporter;
