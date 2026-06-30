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

export class PsdImporter {
    constructor(dependencies = {}) {
        this.eventBus = dependencies.eventBus || window.TegakiEventBus || null;
    }

    async importFileToActiveCaf(file) {
        if (!file) return false;
        const table = this._getAnimationTable();
        const model = table?.model;
        const targetAsset = table?.selectedAssetId ? model?.getClipAsset?.(table.selectedAssetId) : null;
        if (!table || !model || !targetAsset) {
            alert('PSDの取り込み先となるアクティブCAFを選択してください。');
            return false;
        }

        try {
            this._showOperation(`PSDを取り込み中... ${file.name || ''}`.trim());
            await this._nextFrame();
            const buffer = await file.arrayBuffer();
            const psd = readPsd(buffer, {
                useImageData: true,
                skipCompositeImageData: true,
                skipThumbnail: true
            });
            const imported = this._buildActiveCafPayloadFromPsd(psd, file.name || 'PSD');
            if (!imported.layers.length) {
                alert('PSD内に取り込めるRaster Layerがありません。');
                return false;
            }

            table._saveSelectedClipFromWorkingLayers?.({ force: true });
            const beforeState = table._captureTimelineHistoryState?.();

            imported.snapshots.forEach(snapshot => model.drawingSnapshots.push(snapshot));
            targetAsset.name = imported.name;
            targetAsset.type = 'raster';
            targetAsset.drawingSnapshotId = imported.layers.find(layer => layer.type !== 'folder')?.drawingSnapshotId || null;
            targetAsset.internalLayers = imported.layers;
            targetAsset.updatedAt = Date.now();

            table.selectedInternalLayerId = imported.layers.find(layer => layer.type !== 'folder')?.id || imported.layers[0]?.id || null;
            table._invalidateSnapshotTextureCache?.();
            table._syncSelectedClipToWorkingLayers?.({ forceRestore: true });
            table.render?.();
            table._flushLayerPanelSync?.();

            table._recordTimelineHistory?.(beforeState, table._captureTimelineHistoryState?.(), 'caf-import-psd-active-caf', {
                type: 'caf-import-psd-active-caf',
                source: 'psd',
                fileName: file.name || null,
                assetId: targetAsset.id
            });
            this.eventBus?.emit?.('image:imported', {
                source: 'psd',
                mode: 'active-caf',
                fileName: file.name || null
            });
            return true;
        } catch (error) {
            console.error('[PsdImporter] Active CAF PSD import failed:', error);
            alert('PSDの取り込みに失敗しました。');
            return false;
        } finally {
            this._hideOperation();
        }
    }

    _buildActiveCafPayloadFromPsd(psd, fallbackName) {
        const snapshots = [];
        const layers = [];
        const rootChildren = Array.isArray(psd?.children) ? psd.children : [];
        const baseName = String(fallbackName || 'PSD').replace(/\.psd$/i, '') || 'PSD';

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
                const snapshot = new DrawingSnapshotModel({
                    width: trimmed.width,
                    height: trimmed.height,
                    rasterBounds: {
                        x: trimmed.left,
                        y: trimmed.top,
                        width: trimmed.width,
                        height: trimmed.height
                    },
                    pixels: trimmed.pixels,
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
        return {
            name: baseName,
            layers,
            snapshots
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
