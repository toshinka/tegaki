/**
 * ================================================================================
 * system/exporters/psd-exporter.js - PSD出力
 * ================================================================================
 * 
 * 【依存関係 - Parents】
 *   - export-manager.js (統括管理)
 *   - event-bus.js (イベント発行)
 * 
 * 【依存関係 - Children】
 *   - ag-psd
 * 
 * 【責務】
 *   - PSD形式でのレイヤー構造保持出力
 *   - レイヤー階層・ブレンドモード・不透明度の保持
 * 
 * ================================================================================
 */

import { writePsdUint8Array } from 'ag-psd';
import { normalizeRasterBounds } from '../raster-bounds.js';
import { CLIPPING_MODES, getClippingMode } from '../clipping-mode.js';

window.PSDExporter = (function() {
    'use strict';
    
    class PSDExporter {
        constructor(exportManager) {
            if (!exportManager) {
                throw new Error('PSDExporter: exportManager is required');
            }
            this.manager = exportManager;
        }
        
        async export(options = {}) {
            if (window.TegakiEventBus) {
                window.TegakiEventBus.emit('export:started', { format: 'psd' });
            }
            
            try {
                const blob = await this.generateBlob(options);
                const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
                const filename = options.filename || `tegaki_${timestamp}.psd`;
                if (!options.skipDownload) {
                    this.manager.downloadFile(blob, filename);
                }
                if (window.TegakiEventBus) {
                    window.TegakiEventBus.emit('export:completed', {
                        format: 'psd',
                        size: blob.size,
                        filename
                    });
                }
                return { blob, filename, format: 'psd' };
            } catch (error) {
                if (window.TegakiEventBus) {
                    window.TegakiEventBus.emit('export:failed', { 
                        format: 'psd',
                        error: error.message
                    });
                }
                throw error;
            }
        }

        async generateBlob(options = {}) {
            if (!this.manager?.layerSystem) {
                throw new Error('LayerSystem not available');
            }

            await this._waitFrame();
            if (options.psdScope === 'active-caf') {
                this._saveActiveCafWorkingLayers();
            }
            const psd = this._buildPsdStructure(options);
            const bytes = writePsdUint8Array(psd, {
                invalidateTextLayers: true,
                trimImageData: false
            });
            return new Blob([bytes], {
                type: 'application/octet-stream'
            });
        }

        _waitFrame() {
            return new Promise(resolve => requestAnimationFrame(resolve));
        }

        _buildPsdStructure(options = {}) {
            if (options.psdScope === 'active-caf') {
                return this._buildActiveCafPsdStructure(options);
            }

            const CONFIG = window.TEGAKI_CONFIG;
            const width = Math.max(1, Math.round(options.width || CONFIG?.canvas?.width || 400));
            const height = Math.max(1, Math.round(options.height || CONFIG?.canvas?.height || 400));
            const layers = this.manager.layerSystem.getLayers?.() || [];
            const children = this._buildPsdChildren(layers, null);
            const compositeCanvas = this.manager.renderToCanvas?.({
                width,
                height,
                resolution: 1,
                transparent: false
            });

            return {
                width,
                height,
                children,
                canvas: compositeCanvas || undefined
            };
        }

        _buildActiveCafPsdStructure(options = {}) {
            const CONFIG = window.TEGAKI_CONFIG;
            const width = Math.max(1, Math.round(options.width || CONFIG?.canvas?.width || 400));
            const height = Math.max(1, Math.round(options.height || CONFIG?.canvas?.height || 400));
            const animationTable = this._getAnimationTable();
            const model = animationTable?.model;
            const asset = animationTable?.selectedAssetId
                ? model?.getClipAsset?.(animationTable.selectedAssetId)
                : null;

            if (!asset) {
                throw new Error('アクティブCAFが選択されていません');
            }

            const children = this._buildCafPsdChildren(asset, model, null);
            const compositeCanvas = this._renderActiveCafComposite(asset, model, width, height);

            return {
                width,
                height,
                children,
                canvas: compositeCanvas || undefined
            };
        }

        _buildPsdChildren(layers, parentId) {
            const siblings = (layers || []).filter(layer => {
                const data = layer?.layerData;
                if (!data || data.isBackground) return false;
                return (data.parentId || null) === (parentId || null);
            });

            // LayerSystemはPixi描画順と同じく背面 -> 前面で保持する。
            // Clip Studio実機とTegaki PSD importerが扱うPSD record順も
            // 背面 -> 前面なので、ここでは反転しない。
            return siblings
                .map(layer => this._createPsdLayer(layer, layers))
                .filter(Boolean);
        }

        _createPsdLayer(layer, allLayers) {
            const data = layer?.layerData;
            if (!data || data.isBackground) return null;

            if (data.isFolder) {
                return {
                    name: this._sanitizeLayerName(data.name || 'Folder'),
                    children: this._buildPsdChildren(allLayers, data.id),
                    opened: data.folderExpanded !== false,
                    hidden: data.visible === false || layer.visible === false,
                    opacity: this._normalizeOpacity(data.opacity),
                    blendMode: this._convertBlendMode(data.blendMode, true)
                };
            }

            const snapshot = this.manager.layerSystem.createLayerRasterSnapshot?.(layer);
            if (!snapshot?.pixels || !snapshot.width || !snapshot.height) {
                return null;
            }

            const imageData = new ImageData(
                new Uint8ClampedArray(snapshot.pixels),
                snapshot.width,
                snapshot.height
            );
            const rasterBounds = normalizeRasterBounds(snapshot.rasterBounds, {
                x: 0,
                y: 0,
                width: snapshot.width,
                height: snapshot.height
            });

            return {
                name: this._sanitizeLayerName(data.name || 'Layer'),
                left: Math.round(rasterBounds.x),
                top: Math.round(rasterBounds.y),
                imageData,
                opacity: this._normalizeOpacity(data.opacity),
                blendMode: this._convertBlendMode(data.blendMode, false),
                hidden: data.visible === false || layer.visible === false,
                clipping: getClippingMode(data) === CLIPPING_MODES.NORMAL
            };
        }

        _buildCafPsdChildren(asset, model, parentId) {
            const layers = asset?.internalLayers || [];
            const siblings = layers.filter(layer => {
                if (!layer || layer.isBackground) return false;
                return (layer.parentLayerId || null) === (parentId || null);
            });

            // ClipAsset.internalLayersはLayer Panel順（前面 -> 背面）。
            // 通常Layer exportと同じPSD record順（背面 -> 前面）へ揃える。
            return siblings
                .slice()
                .reverse()
                .map(layer => this._createCafPsdLayer(asset, model, layer))
                .filter(Boolean);
        }

        _createCafPsdLayer(asset, model, layer) {
            if (!layer || layer.isBackground) return null;

            if (layer.type === 'folder') {
                return {
                    name: this._sanitizeLayerName(layer.name || 'Folder'),
                    children: this._buildCafPsdChildren(asset, model, layer.id),
                    opened: layer.folderExpanded !== false,
                    hidden: layer.visible === false,
                    opacity: this._normalizeOpacity(layer.opacity),
                    blendMode: this._convertBlendMode(layer.blendMode, true)
                };
            }

            const snapshot = model?.getDrawingSnapshot?.(layer.drawingSnapshotId);
            if (!snapshot?.pixels || !snapshot.width || !snapshot.height) {
                return null;
            }

            const pixels = snapshot.pixels instanceof Uint8ClampedArray
                ? snapshot.pixels
                : new Uint8ClampedArray(snapshot.pixels);
            const imageData = new ImageData(
                new Uint8ClampedArray(pixels),
                snapshot.width,
                snapshot.height
            );
            const rasterBounds = normalizeRasterBounds(snapshot.rasterBounds, {
                x: 0,
                y: 0,
                width: snapshot.width,
                height: snapshot.height
            });

            return {
                name: this._sanitizeLayerName(layer.name || 'Layer'),
                left: Math.round(rasterBounds.x),
                top: Math.round(rasterBounds.y),
                imageData,
                opacity: this._normalizeOpacity(layer.opacity),
                blendMode: this._convertBlendMode(layer.blendMode, false),
                hidden: layer.visible === false,
                clipping: getClippingMode(layer) === CLIPPING_MODES.NORMAL
            };
        }

        _renderActiveCafComposite(asset, model, width, height) {
            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            if (!ctx) return null;

            const rendered = this._renderCafLayerGroup(ctx, asset, model, null, width, height);
            return rendered ? canvas : null;
        }

        _renderCafLayerGroup(ctx, asset, model, parentId, width, height) {
            const layers = asset?.internalLayers || [];
            const siblings = layers.filter(layer => (layer.parentLayerId || null) === (parentId || null));
            let rendered = false;

            for (let index = siblings.length - 1; index >= 0; index--) {
                const layer = siblings[index];
                if (!layer || layer.visible === false) continue;

                if (layer.type === 'folder') {
                    const folderCanvas = document.createElement('canvas');
                    folderCanvas.width = width;
                    folderCanvas.height = height;
                    const folderCtx = folderCanvas.getContext('2d');
                    if (!folderCtx) continue;
                    const hasFolderContent = this._renderCafLayerGroup(folderCtx, asset, model, layer.id, width, height);
                    const opacity = this._normalizeOpacity(layer.opacity);
                    if (!hasFolderContent || opacity <= 0) continue;

                    ctx.save();
                    ctx.globalAlpha = opacity;
                    ctx.globalCompositeOperation = this._compositeMode(layer.blendMode);
                    ctx.drawImage(folderCanvas, 0, 0);
                    ctx.restore();
                    rendered = true;
                    continue;
                }

                const snapshot = model?.getDrawingSnapshot?.(layer.drawingSnapshotId);
                const snapshotCanvas = this._createSnapshotCanvas(snapshot);
                if (!snapshotCanvas) continue;
                const rasterBounds = normalizeRasterBounds(snapshot.rasterBounds, {
                    width: snapshot.width,
                    height: snapshot.height
                });

                ctx.save();
                ctx.globalAlpha = this._normalizeOpacity(layer.opacity);
                ctx.globalCompositeOperation = this._compositeMode(layer.blendMode);
                ctx.drawImage(snapshotCanvas, rasterBounds.x, rasterBounds.y);
                ctx.restore();
                rendered = true;
            }

            return rendered;
        }

        _createSnapshotCanvas(snapshot) {
            if (!snapshot?.pixels || !snapshot.width || !snapshot.height) return null;
            const canvas = document.createElement('canvas');
            canvas.width = snapshot.width;
            canvas.height = snapshot.height;
            const ctx = canvas.getContext('2d');
            if (!ctx) return null;
            const pixels = snapshot.pixels instanceof Uint8ClampedArray
                ? snapshot.pixels
                : new Uint8ClampedArray(snapshot.pixels);
            ctx.putImageData(new ImageData(new Uint8ClampedArray(pixels), snapshot.width, snapshot.height), 0, 0);
            return canvas;
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

        _getAnimationTable() {
            return window.PopupManager?.get?.('animationTable')
                || window.PopupManager?.popups?.get?.('animationTable')?.instance
                || window.coreEngine?.popupManager?.get?.('animationTable')
                || null;
        }

        _saveActiveCafWorkingLayers() {
            const animationTable = this._getAnimationTable();
            animationTable?._saveSelectedClipFromWorkingLayers?.({ force: true });
        }

        _sanitizeLayerName(name) {
            return String(name || 'Layer').slice(0, 255);
        }

        _normalizeOpacity(opacity) {
            return Math.max(0, Math.min(1, Number.isFinite(opacity) ? opacity : 1));
        }

        _convertBlendMode(blendMode, isFolder = false) {
            const blendModeMap = {
                'normal': isFolder ? 'pass through' : 'normal',
                'multiply': 'multiply',
                'screen': 'screen',
                'overlay': 'overlay',
                'add': 'linear dodge',
                'subtract': 'subtract',
                'lighten': 'lighten',
                'darken': 'darken',
                'color-dodge': 'color dodge',
                'color-burn': 'color burn',
                'hard-light': 'hard light',
                'soft-light': 'soft light',
                'difference': 'difference',
                'exclusion': 'exclusion'
            };

            return blendModeMap[blendMode] || (isFolder ? 'pass through' : 'normal');
        }
    }
    
    return PSDExporter;
})();

console.log('✅ psd-exporter.js loaded');
