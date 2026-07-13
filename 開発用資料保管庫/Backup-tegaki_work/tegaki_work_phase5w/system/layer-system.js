/**
 * ============================================================================
 * ファイル名: system/layer-system.js
 * 責務: レイヤーの追加・削除・並び替え・可視性・透明度・合成モード・クリッピング表示・フォルダ管理・履歴用ラスターsnapshotを統括する
 * 依存: pixi.js, config.js, system/event-bus.js, system/data-models.js, system/layer-transform.js, coordinate-system.js
 * 被依存: core-engine.js, drawing-engine.js, brush-core.js等
 * 公開API: LayerSystem
 * イベント発火: layer:*, folder:*, thumbnail:layer-updated, frame:updated
 * イベント受信: camera:resized, keyboard:vkey-state-changed, animation:*, layer:copy-request, layer:paste-request等
 * グローバル登録: window.TegakiLayerSystem, window.layerManager
 * 実装状態: ✅完成/整備
 * ============================================================================
 */

import { Container, Graphics, Mesh, RenderTexture, Sprite, Texture } from 'pixi.js';
import { TEGAKI_CONFIG } from '../config.js';
import { TegakiEventBus } from './event-bus.js';
import { LayerModel } from './data-models.js';
import { historyManager } from './history.js';
import { coordinateSystem } from '../coordinate-system.js';
import { LayerTransform } from './layer-transform.js';
import { resolveIntegerTranslation } from './raster-translation.js';
import { normalizeRasterBounds, normalizeRasterSnapshot, translateRasterBounds } from './raster-bounds.js';
import { applyTransformMatrix, createCenteredTransformMatrix } from './transform-math.js';
import {
    CLIPPING_MODES,
    applyClippingMode,
    cycleClippingMode,
    getClippingMode
} from './clipping-mode.js';

export class LayerSystem {
    constructor() {
        this.app = null;
        this.config = null;
        this.eventBus = null;
        this.currentFrameContainer = null;
        this.activeLayerIndex = -1;
        this.selectedLayerIds = new Set();
        this.selectionAnchorIndex = -1;
        this.frameRenderTextures = new Map();
        this.frameThumbnailDirty = new Map();
        this.cameraSystem = null;
        this.animationSystem = null;
        this.coordAPI = coordinateSystem;
        this.transform = null;
        this.isInitialized = false;
        this.checkerPattern = null;
        this._checkerTileScale = null;
        this._layerTransformSession = null;
        this._transformInteractionFrame = null;
        this._pendingTransformInteraction = null;
        this._clippingMaskSpritePool = [];
        this._clippingMaskTexturePool = [];
    }

    init(canvasContainer, eventBus, config) {
        this.eventBus = eventBus || TegakiEventBus;
        this.config = config || TEGAKI_CONFIG;
        if (!this.eventBus) throw new Error('EventBus required for LayerSystem');

        this.transform = new LayerTransform(this.config, this.coordAPI);

        this.currentFrameContainer = new Container();
        this.currentFrameContainer.label = 'temporary_frame_container';

        const bgLayer = new Container();
        const bgLayerModel = new LayerModel({
            id: 'temp_layer_bg_' + Date.now(),
            name: '背景',
            isBackground: true
        });
        bgLayer.label = bgLayerModel.id;
        bgLayer.layerData = bgLayerModel;
        bgLayer.id = bgLayerModel.id;

        // 🆕 背景テクスチャ初期化
        if (this.app?.renderer) {
            bgLayerModel.initializeTexture(this.config.canvas.width, this.config.canvas.height);
            if (bgLayerModel.layerSprite) {
                bgLayer.addChild(bgLayerModel.layerSprite);
            }
        }

        const bg = this._createSolidBackground(
            this.config.canvas.width,
            this.config.canvas.height,
            0xf0e0d6
        );
        bgLayer.addChild(bg);
        bgLayer.layerData.backgroundGraphics = bg;
        bgLayer.layerData.backgroundColor = 0xf0e0d6;
        this.currentFrameContainer.addChild(bgLayer);

        const layer1 = new Container();
        const layer1Model = new LayerModel({
            id: 'temp_layer_1_' + Date.now(),
            name: 'レイヤー1'
        });
        layer1.label = layer1Model.id;
        layer1.layerData = layer1Model;
        layer1.id = layer1Model.id;

        // 🆕 レイヤー1テクスチャ初期化
        if (this.app?.renderer) {
            layer1Model.initializeTexture(this.config.canvas.width, this.config.canvas.height);
            if (layer1Model.layerSprite) {
                layer1.addChild(layer1Model.layerSprite);
            }
        }

        if (this.transform) {
            this.transform.setTransform(layer1Model.id, { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 });
        }
        this.currentFrameContainer.addChild(layer1);
        this.activeLayerIndex = 1;
        this._setSingleLayerSelection(1);

        this._setupLayerOperations();
        this._setupAnimationSystemIntegration();
        this._setupVKeyEvents();
        this._setupResizeEvents();
        this.eventBus.on('drawing:stroke-completed', () => this.refreshClippingMasks());
        this.eventBus.on('layer:content-changed', () => this.refreshClippingMasks());

        this.isInitialized = true;

        // 初回描画を要求
        setTimeout(() => {
            this._emitPanelUpdateRequest();
            this._emitStatusUpdateRequest();
        }, 100);
    }

    /**
     * レイヤーの変形を RenderTexture に焼き付け、コンテナの変形をリセットする
     */
    bakeTransform(layer, transformOverride = null, sourceSnapshotOverride = null) {
        if (!this.app?.renderer || !layer?.layerData?.renderTexture) return false;

        const layerData = layer.layerData;
        const rawTransformState = structuredClone(
            transformOverride
                || this.transform?.getTransform?.(layerData.id)
                || { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 }
        );
        const transformState = this._normalizeTransformStateForBake(rawTransformState);
        if (!transformState) {
            console.warn('[LayerSystem] transform bake skipped: invalid transform state', {
                layerId: layerData.id,
                transform: rawTransformState
            });
            return false;
        }
        const sourceSnapshot = sourceSnapshotOverride || this.createLayerRasterSnapshot(layer);
        if (!sourceSnapshot?.pixels) return false;

        const sourceBounds = normalizeRasterBounds(sourceSnapshot.rasterBounds, {
            width: sourceSnapshot.width,
            height: sourceSnapshot.height
        });
        sourceBounds.width = Math.max(1, Math.round(sourceSnapshot.width || sourceBounds.width));
        sourceBounds.height = Math.max(1, Math.round(sourceSnapshot.height || sourceBounds.height));

        const targetBounds = this._calculateTransformedRasterBounds(sourceBounds, transformState);
        const maxTextureSize = this._getMaxRenderTextureSize();
        if (
            !targetBounds
            || targetBounds.width > maxTextureSize
            || targetBounds.height > maxTextureSize
            || !this._isRasterBakeSizeAllowed(targetBounds)
        ) {
            console.warn('[LayerSystem] transform bake skipped: exceeds max texture size', {
                layerId: layerData.id,
                targetBounds,
                maxTextureSize
            });
            return false;
        }

        const sourceCanvas = document.createElement('canvas');
        sourceCanvas.width = sourceBounds.width;
        sourceCanvas.height = sourceBounds.height;
        const sourceCtx = sourceCanvas.getContext('2d');
        if (!sourceCtx) return false;
        sourceCtx.putImageData(
            new ImageData(new Uint8ClampedArray(sourceSnapshot.pixels), sourceBounds.width, sourceBounds.height),
            0,
            0
        );

        const targetCanvas = document.createElement('canvas');
        targetCanvas.width = targetBounds.width;
        targetCanvas.height = targetBounds.height;
        const targetCtx = targetCanvas.getContext('2d');
        if (!targetCtx) return false;

        const centerX = this.config.canvas.width / 2;
        const centerY = this.config.canvas.height / 2;
        const matrix = createCenteredTransformMatrix(transformState, centerX, centerY);
        targetCtx.clearRect(0, 0, targetBounds.width, targetBounds.height);
        targetCtx.imageSmoothingEnabled = true;
        targetCtx.imageSmoothingQuality = 'high';
        targetCtx.setTransform(
            matrix.a,
            matrix.b,
            matrix.c,
            matrix.d,
            matrix.tx - targetBounds.x,
            matrix.ty - targetBounds.y
        );
        targetCtx.drawImage(sourceCanvas, sourceBounds.x, sourceBounds.y);

        const bakedPixels = targetCtx.getImageData(0, 0, targetBounds.width, targetBounds.height).data;
        const nextSnapshot = {
            ...sourceSnapshot,
            width: targetBounds.width,
            height: targetBounds.height,
            rasterBounds: { ...targetBounds },
            pixels: new Uint8ClampedArray(bakedPixels)
        };

        this._resetDisplayTransform(layer);
        this.transform?.setTransform?.(
            layerData.id,
            { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 }
        );

        const restored = this.restoreLayerRasterSnapshot(nextSnapshot);
        if (this.config?.debug && restored) {
            console.log(`[LayerSystem] Baked transform for layer: ${layerData.name}`, {
                sourceBounds,
                targetBounds,
                transform: transformState
            });
        }
        return restored;
    }

    canBakeLayerTransform(layer, transformOverride = null, sourceSnapshotOverride = null) {
        if (!this.app?.renderer || !layer?.layerData?.renderTexture) {
            return { ok: false, reason: 'missing-render-texture', targetBounds: null };
        }

        const layerData = layer.layerData;
        const rawTransformState = structuredClone(
            transformOverride
                || this.transform?.getTransform?.(layerData.id)
                || { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 }
        );
        const transformState = this._normalizeTransformStateForBake(rawTransformState);
        if (!transformState) {
            return { ok: false, reason: 'invalid-transform', transform: rawTransformState, targetBounds: null };
        }

        const sourceSnapshot = sourceSnapshotOverride || this.createLayerRasterSnapshot(layer);
        if (!sourceSnapshot?.pixels) {
            return { ok: false, reason: 'missing-source-snapshot', transform: transformState, targetBounds: null };
        }

        const sourceBounds = normalizeRasterBounds(sourceSnapshot.rasterBounds, {
            width: sourceSnapshot.width,
            height: sourceSnapshot.height
        });
        sourceBounds.width = Math.max(1, Math.round(sourceSnapshot.width || sourceBounds.width));
        sourceBounds.height = Math.max(1, Math.round(sourceSnapshot.height || sourceBounds.height));

        const targetBounds = this._calculateTransformedRasterBounds(sourceBounds, transformState);
        const maxTextureSize = this._getMaxRenderTextureSize();
        if (!targetBounds) {
            return { ok: false, reason: 'invalid-target-bounds', sourceBounds, transform: transformState, targetBounds };
        }
        if (targetBounds.width > maxTextureSize || targetBounds.height > maxTextureSize) {
            return { ok: false, reason: 'exceeds-max-texture-size', sourceBounds, transform: transformState, targetBounds, maxTextureSize };
        }
        if (!this._isRasterBakeSizeAllowed(targetBounds)) {
            return { ok: false, reason: 'exceeds-safe-pixel-count', sourceBounds, transform: transformState, targetBounds, maxTextureSize };
        }

        return { ok: true, sourceBounds, transform: transformState, targetBounds, maxTextureSize };
    }

    _calculateTransformedRasterBounds(sourceBounds, transformState) {
        const centerX = this.config.canvas.width / 2;
        const centerY = this.config.canvas.height / 2;
        const matrix = createCenteredTransformMatrix(transformState, centerX, centerY);
        const x0 = sourceBounds.x;
        const y0 = sourceBounds.y;
        const x1 = sourceBounds.x + sourceBounds.width;
        const y1 = sourceBounds.y + sourceBounds.height;
        const corners = [
            applyTransformMatrix(matrix, x0, y0),
            applyTransformMatrix(matrix, x1, y0),
            applyTransformMatrix(matrix, x1, y1),
            applyTransformMatrix(matrix, x0, y1)
        ];
        if (corners.some(point => !Number.isFinite(point.x) || !Number.isFinite(point.y))) {
            return null;
        }
        const minX = Math.min(...corners.map(point => point.x));
        const minY = Math.min(...corners.map(point => point.y));
        const maxX = Math.max(...corners.map(point => point.x));
        const maxY = Math.max(...corners.map(point => point.y));
        const padding = 2;
        const left = Math.floor(minX - padding);
        const top = Math.floor(minY - padding);
        const right = Math.ceil(maxX + padding);
        const bottom = Math.ceil(maxY + padding);
        return {
            x: left,
            y: top,
            width: Math.max(1, right - left),
            height: Math.max(1, bottom - top)
        };
    }

    _normalizeTransformStateForBake(transform) {
        const x = Number(transform?.x);
        const y = Number(transform?.y);
        const rotation = Number(transform?.rotation);
        const scaleX = Number(transform?.scaleX);
        const scaleY = Number(transform?.scaleY);
        if (
            !Number.isFinite(x)
            || !Number.isFinite(y)
            || !Number.isFinite(rotation)
            || !Number.isFinite(scaleX)
            || !Number.isFinite(scaleY)
            || Math.abs(scaleX) < 0.001
            || Math.abs(scaleY) < 0.001
        ) {
            return null;
        }
        return {
            x, y, rotation, scaleX, scaleY,
            anchorX: Number.isFinite(transform?.anchorX) ? transform.anchorX : undefined,
            anchorY: Number.isFinite(transform?.anchorY) ? transform.anchorY : undefined
        };
    }

    _isRasterBakeSizeAllowed(bounds) {
        const width = Math.round(bounds?.width || 0);
        const height = Math.round(bounds?.height || 0);
        if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) return false;
        const maxPixels = 16 * 1024 * 1024;
        return width * height <= maxPixels;
    }

    createFolder(name) {
        // ... (rest of the file follows, but I need to make sure I replace accurately)

        if (!this.currentFrameContainer) return null;

        const folderName = name || this._generateNextFolderName();
        const folderModel = new LayerModel({
            name: folderName,
            isFolder: true,
            folderExpanded: true
        });

        const folder = new Container();
        folder.label = folderModel.id;
        folder.layerData = folderModel;
        folder.id = folderModel.id;

        if (this.transform) {
            this.transform.setTransform(folderModel.id, { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 });
        }

        if (historyManager && !historyManager.isApplying) {
            const entry = {
                name: 'folder-create',
                do: () => {
                    this.currentFrameContainer.addChild(folder);
                    const layers = this.getLayers();
                    this.setActiveLayer(layers.length - 1);
                    this._emitPanelUpdateRequest();
                },
                undo: () => {
                    this.currentFrameContainer.removeChild(folder);
                    const layers = this.getLayers();
                    if (this.activeLayerIndex >= layers.length) {
                        this.activeLayerIndex = Math.max(0, layers.length - 1);
                    }
                    this._emitPanelUpdateRequest();
                },
                meta: { folderId: folderModel.id, name: folderName }
            };
            historyManager.push(entry);
        } else {
            this.currentFrameContainer.addChild(folder);
            const layers = this.getLayers();
            this.setActiveLayer(layers.length - 1);
            this._emitPanelUpdateRequest();
        }

        if (this.eventBus) {
            this.eventBus.emit('folder:created', {
                folderId: folderModel.id,
                name: folderName
            });
        }

        const layers = this.getLayers();
        return { layer: folder, index: layers.length - 1 };
    }

    addLayerToFolder(layerId, folderId) {
        const layers = this.getLayers();
        const layer = layers.find(l => l.layerData?.id === layerId);
        const folder = layers.find(l => l.layerData?.id === folderId);

        if (!this._canPlaceInFolder(layer, folder)) return false;

        if (layer.layerData.parentId && layer.layerData.parentId !== folderId) {
            const previousFolder = layers.find(l => l.layerData?.id === layer.layerData.parentId);
            previousFolder?.layerData?.removeChild(layerId);
        }

        if (!folder.layerData.addChild(layerId)) return false;

        layer.layerData.parentId = folderId;
        folder.layerData.folderExpanded = true;

        this._emitPanelUpdateRequest();

        if (this.eventBus) {
            this.eventBus.emit('layer:added-to-folder', {
                layerId,
                folderId
            });
            this.eventBus.emit('folder:toggled', {
                folderId,
                expanded: true
            });
        }

        return true;
    }

    canPlaceLayerInFolder(layerId, folderId) {
        const layers = this.getLayers();
        const layer = layers.find(l => l.layerData?.id === layerId);
        const folder = layers.find(l => l.layerData?.id === folderId);
        return this._canPlaceInFolder(layer, folder);
    }

    moveLayerIntoFolder(layerId, folderId) {
        const layers = this.getLayers();
        const layer = layers.find(l => l.layerData?.id === layerId);
        const folder = layers.find(l => l.layerData?.id === folderId);

        if (!this._canPlaceInFolder(layer, folder)) return false;
        if (layer.layerData.parentId === folderId) return true;

        const beforeState = this._captureLayerPlacementState();
        const applyMove = () => this._applyMoveLayerIntoFolder(layerId, folderId);

        if (historyManager && !historyManager.isApplying) {
            const entry = {
                name: 'layer-move-into-folder',
                do: () => applyMove(),
                undo: () => {
                    const currentIndex = this.getLayers().findIndex(l => l.layerData?.id === layerId);
                    this._restoreLayerPlacementState(beforeState);
                    this._emitPanelUpdateRequest();
                    this._emitLayerPlacementChanged({
                        fromIndex: currentIndex,
                        toIndex: beforeState.order.indexOf(layerId),
                        movedLayerId: layerId
                    });
                },
                meta: { layerId, folderId }
            };
            historyManager.push(entry);
            return true;
        }

        return applyMove();
    }

    _applyMoveLayerIntoFolder(layerId, folderId) {
        const layers = this.getLayers();
        const layer = layers.find(l => l.layerData?.id === layerId);
        const folder = layers.find(l => l.layerData?.id === folderId);

        if (!this._canPlaceInFolder(layer, folder)) return false;

        const previousParentId = layer.layerData.parentId;

        if (previousParentId) {
            const previousFolder = layers.find(l => l.layerData?.id === previousParentId);
            previousFolder?.layerData?.removeChild(layerId);
        }

        folder.layerData.addChild(layerId);
        layer.layerData.parentId = folderId;
        folder.layerData.folderExpanded = true;

        let fromIndex = layers.indexOf(layer);
        let folderIndex = layers.indexOf(folder);
        let toIndex = Math.max(0, folderIndex - 1);

        if (fromIndex !== toIndex) {
            this._moveLayerObjectToIndex(layer, toIndex);
        }
        this._compactFolderChildren(folderId);

        this._emitPanelUpdateRequest();
        this._emitLayerPlacementChanged({
            layerId,
            folderId,
            fromIndex,
            toIndex: this.getLayerIndex(layer),
            movedLayerId: layerId,
            expanded: true
        });

        return true;
    }

    moveLayerNearLayerInFolder(layerId, referenceLayerId, placement) {
        if (!this._isLayerPositionPlacement(placement)) return false;

        const target = this._resolveLayerNearLayerInFolderTarget(layerId, referenceLayerId);
        if (!target) return false;

        const beforeState = this._captureLayerPlacementState();
        const applyMove = () => {
            const moved = this._applyLayerNearLayerInFolder(layerId, referenceLayerId, placement);
            if (moved) {
                this._emitPanelUpdateRequest();
            }
            return moved;
        };

        if (historyManager && !historyManager.isApplying) {
            const entry = {
                name: 'layer-move-into-folder-position',
                do: () => applyMove(),
                undo: () => {
                    const currentIndex = this.getLayers().findIndex(l => l.layerData?.id === layerId);
                    this._restoreLayerPlacementState(beforeState);
                    this._emitPanelUpdateRequest();
                    this._emitLayerPlacementChanged({
                        fromIndex: currentIndex,
                        toIndex: beforeState.order.indexOf(layerId),
                        movedLayerId: layerId
                    });
                },
                meta: { layerId, referenceLayerId, placement, folderId: target.folderId }
            };
            historyManager.push(entry);
            return true;
        }

        return applyMove();
    }

    _applyLayerNearLayerInFolder(layerId, referenceLayerId, placement) {
        const target = this._resolveLayerNearLayerInFolderTarget(layerId, referenceLayerId);
        if (!target) return false;

        const { layers, layer, referenceLayer, folder, folderId } = target;
        const previousParentId = layer.layerData.parentId || null;
        if (previousParentId && previousParentId !== folderId) {
            const previousFolder = layers.find(l => l.layerData?.id === previousParentId);
            previousFolder?.layerData?.removeChild(layerId);
        }

        folder.layerData.addChild(layerId);
        layer.layerData.parentId = folderId;
        folder.layerData.folderExpanded = true;

        const currentLayers = this.getLayers();
        const oldIndex = currentLayers.indexOf(layer);
        const targetIndex = currentLayers.indexOf(referenceLayer);
        const newIndex = this._resolveLayerIndexForPlacement(oldIndex, targetIndex, placement);
        if (newIndex === null) return false;

        this._moveLayerObjectToIndex(layer, newIndex);
        this._finalizeLayerReorder(layer);

        this._emitLayerPlacementChanged({
            layerId,
            folderId,
            fromIndex: oldIndex,
            toIndex: this.getLayerIndex(layer),
            movedLayerId: layerId,
            expanded: true
        });

        return true;
    }

    _resolveLayerNearLayerInFolderTarget(layerId, referenceLayerId) {
        if (!layerId || !referenceLayerId || layerId === referenceLayerId) return null;

        const layers = this.getLayers();
        const layer = layers.find(l => l.layerData?.id === layerId);
        const referenceLayer = layers.find(l => l.layerData?.id === referenceLayerId);
        const folderId = referenceLayer?.layerData?.parentId || null;
        const folder = layers.find(l => l.layerData?.id === folderId);

        if (!folderId || !this._canPlaceInFolder(layer, folder)) return null;

        return { layers, layer, referenceLayer, folder, folderId };
    }

    _emitLayerPlacementChanged({ layerId, folderId, fromIndex, toIndex, movedLayerId, expanded } = {}) {
        if (!this.eventBus) return;

        if (layerId && folderId) {
            this.eventBus.emit('layer:added-to-folder', { layerId, folderId });
        }
        if (folderId && expanded !== undefined) {
            this.eventBus.emit('folder:toggled', { folderId, expanded });
        }
        this.eventBus.emit('layer:reordered', {
            fromIndex,
            toIndex,
            activeIndex: this.activeLayerIndex,
            movedLayerId
        });
    }

    _resolveLayerIndexForPlacement(oldIndex, targetIndex, placement) {
        if (!this._isLayerPositionPlacement(placement)) return null;
        if (Number.isNaN(oldIndex) || Number.isNaN(targetIndex)) return null;
        const layers = this.getLayers();
        if (targetIndex < 0 || targetIndex >= layers.length) return null;

        let newIndex = placement === 'before' ? targetIndex + 1 : targetIndex;
        if (oldIndex < newIndex) {
            newIndex -= 1;
        }
        return Math.max(0, Math.min(layers.length - 1, newIndex));
    }

    _isLayerPositionPlacement(placement) {
        return placement === 'before' || placement === 'after';
    }

    _captureLayerPlacementState() {
        const layers = this.getLayers();
        return {
            order: this._captureLayerOrderState(layers),
            activeLayerId: layers[this.activeLayerIndex]?.layerData?.id || null,
            activeLayerIndex: this.activeLayerIndex,
            parents: this._captureLayerParentState(layers),
            folders: this._captureLayerFolderState(layers)
        };
    }

    _captureLayerOrderState(layers = this.getLayers()) {
        return layers.map(layer => layer.layerData?.id).filter(Boolean);
    }

    _captureLayerParentState(layers = this.getLayers()) {
        return layers.map(layer => ({
            id: layer.layerData?.id,
            parentId: layer.layerData?.parentId || null
        })).filter(entry => entry.id);
    }

    _captureLayerFolderState(layers = this.getLayers()) {
        return layers
            .filter(layer => layer.layerData?.isFolder)
            .map(folder => ({
                id: folder.layerData.id,
                children: [...(folder.layerData.children || [])],
                folderExpanded: folder.layerData.folderExpanded
            }));
    }

    _restoreLayerPlacementState(state) {
        if (!state || !this.currentFrameContainer) return false;

        const layers = this.getLayers();
        const byId = new Map(layers.map(layer => [layer.layerData?.id, layer]));

        this._restoreLayerParentState(state.parents, byId);
        this._restoreLayerFolderState(state.folders, byId);
        this._restoreLayerOrderState(state.order, byId);

        const restoredLayers = this.getLayers();
        const activeIndex = restoredLayers.findIndex(layer => layer.layerData?.id === state.activeLayerId);
        if (activeIndex >= 0) {
            this.activeLayerIndex = activeIndex;
        } else if (typeof state.activeLayerIndex === 'number') {
            this.activeLayerIndex = Math.max(0, Math.min(state.activeLayerIndex, restoredLayers.length - 1));
        }
        this.refreshClippingMasks();
        return true;
    }

    _restoreLayerParentState(parents, byId) {
        parents?.forEach(({ id, parentId }) => {
            const layer = byId.get(id);
            if (layer?.layerData) {
                layer.layerData.parentId = parentId || null;
            }
        });
    }

    _restoreLayerFolderState(folders, byId) {
        folders?.forEach(({ id, children, folderExpanded }) => {
            const folder = byId.get(id);
            if (folder?.layerData?.isFolder) {
                folder.layerData.children = Array.isArray(children) ? [...children] : [];
                folder.layerData.folderExpanded = folderExpanded;
            }
        });
    }

    _restoreLayerOrderState(order, byId) {
        order?.forEach((id, index) => {
            const layer = byId.get(id);
            if (!layer) return;
            if (layer.parent) {
                this.currentFrameContainer.removeChild(layer);
            }
            this.currentFrameContainer.addChildAt(layer, Math.min(index, this.currentFrameContainer.children.length));
        });
    }

    _placeDuplicatedLayer(newLayer, sourceLayer, sourceIndex) {
        if (!newLayer || !sourceLayer || !this.currentFrameContainer) return this.getLayerIndex(newLayer);

        const sourceParentId = sourceLayer.layerData?.parentId || null;
        newLayer.layerData.parentId = sourceParentId;
        if (sourceParentId) {
            const folder = this.getLayers().find(l => l.layerData?.id === sourceParentId);
            folder?.layerData?.addChild(newLayer.layerData.id);
        }

        const targetIndex = Math.min(sourceIndex + 1, this.getLayers().length - 1);
        this._moveLayerObjectToIndex(newLayer, targetIndex);
        return this.getLayerIndex(newLayer);
    }

    placeCreatedLayerNearReference(newLayer, referenceLayer) {
        if (!newLayer || !referenceLayer || !this.currentFrameContainer) return this.getLayerIndex(newLayer);

        const layers = this.getLayers();
        const referenceIndex = layers.indexOf(referenceLayer);
        if (referenceIndex < 0 || referenceLayer.layerData?.isBackground) {
            return this.getLayerIndex(newLayer);
        }

        let parentId = referenceLayer.layerData?.parentId || null;
        let targetIndex = referenceIndex + 1;

        if (parentId) {
            newLayer.layerData.parentId = parentId;
            const folder = this.getLayers().find(l => l.layerData?.id === parentId);
            folder?.layerData?.addChild(newLayer.layerData.id);
        } else {
            newLayer.layerData.parentId = null;
        }

        this._moveLayerObjectToIndex(newLayer, targetIndex);
        if (parentId) {
            this._compactFolderChildren(parentId);
        }
        return this.getLayerIndex(newLayer);
    }

    _moveLayerObjectToIndex(layer, targetIndex) {
        const layers = this.getLayers();
        const fromIndex = layers.indexOf(layer);
        if (fromIndex < 0) return false;

        const clampedTarget = Math.max(0, Math.min(targetIndex, layers.length - 1));
        if (fromIndex === clampedTarget) return true;

        this.currentFrameContainer.removeChild(layer);
        this.currentFrameContainer.addChildAt(layer, clampedTarget);
        this.activeLayerIndex = this.getLayerIndex(layer);
        return true;
    }

    _getDirectFolderChildren(folderId) {
        return this.getLayers().filter(l => l.layerData?.parentId === folderId);
    }

    _getFolderBlockRange(folderId) {
        const layers = this.getLayers();
        const folderIndex = layers.findIndex(l => l.layerData?.id === folderId);
        const childIndices = this._getDirectFolderChildren(folderId)
            .map(child => layers.indexOf(child))
            .filter(index => index >= 0);

        if (folderIndex < 0 || childIndices.length === 0) {
            return { min: folderIndex, max: folderIndex };
        }

        return {
            min: Math.min(...childIndices),
            max: folderIndex
        };
    }

    _compactFolderChildren(folderId) {
        const folder = this.getLayers().find(l => l.layerData?.id === folderId);
        if (!folder?.layerData?.isFolder) return;

        const children = this._getDirectFolderChildren(folderId)
            .sort((a, b) => this.getLayerIndex(a) - this.getLayerIndex(b));
        if (children.length === 0) return;

        for (const child of children) {
            if (child.parent) {
                this.currentFrameContainer.removeChild(child);
            }
        }

        const folderIndex = this.getLayerIndex(folder);
        children.forEach((child, offset) => {
            this.currentFrameContainer.addChildAt(child, folderIndex + offset);
        });
    }

    _finalizeLayerReorder(layer) {
        if (!layer?.layerData) return;

        const layers = this.getLayers();
        const layerIndex = layers.indexOf(layer);
        const parentId = layer.layerData.parentId;

        if (parentId) {
            const parentFolder = layers.find(l => l.layerData?.id === parentId);
            const parentFolderIndex = layers.indexOf(parentFolder);
            const siblingIndices = this._getDirectFolderChildren(parentId)
                .filter(child => child !== layer)
                .map(child => layers.indexOf(child))
                .filter(index => index >= 0);
            const minAllowedIndex = siblingIndices.length > 0
                ? Math.min(...siblingIndices)
                : parentFolderIndex - 1;
            const isOutsideParentBlock = parentFolderIndex < 0 ||
                layerIndex < minAllowedIndex ||
                layerIndex >= parentFolderIndex;

            if (isOutsideParentBlock) {
                parentFolder?.layerData?.removeChild(layer.layerData.id);
                layer.layerData.parentId = null;
            }
        } else {
            const folders = layers.filter(l => l.layerData?.isFolder);
            for (const folder of folders) {
                const range = this._getFolderBlockRange(folder.layerData.id);
                const currentIndex = this.getLayerIndex(layer);
                if (range.min >= 0 && currentIndex >= range.min && currentIndex < range.max) {
                    this._moveLayerObjectToIndex(layer, Math.max(0, range.min - 1));
                    break;
                }
            }
        }

        const folderIds = this.getLayers()
            .filter(l => l.layerData?.isFolder)
            .map(l => l.layerData.id);
        folderIds.forEach(id => this._compactFolderChildren(id));
        this.refreshClippingMasks();
    }

    _canPlaceInFolder(layer, folder) {
        if (!layer || !folder || !folder.layerData?.isFolder) return false;
        if (layer.layerData?.isBackground) return false;
        if (layer.layerData?.id === folder.layerData.id) return false;

        let currentParentId = folder.layerData.parentId;
        const layers = this.getLayers();
        while (currentParentId) {
            if (currentParentId === layer.layerData?.id) return false;
            const parent = layers.find(l => l.layerData?.id === currentParentId);
            currentParentId = parent?.layerData?.parentId || null;
        }

        return true;
    }

    removeLayerFromFolder(layerId) {
        const layers = this.getLayers();
        const layer = layers.find(l => l.layerData?.id === layerId);

        if (!layer || !layer.layerData?.parentId) return false;

        const folder = layers.find(l => l.layerData?.id === layer.layerData.parentId);
        if (!folder || !folder.layerData?.isFolder) return false;

        if (!folder.layerData.removeChild(layerId)) return false;

        layer.layerData.parentId = null;

        this._emitPanelUpdateRequest();

        if (this.eventBus) {
            this.eventBus.emit('layer:removed-from-folder', {
                layerId,
                folderId: folder.layerData.id
            });
        }

        return true;
    }

    toggleFolderExpand(folderId) {
        const layers = this.getLayers();
        const folder = layers.find(l => l.layerData?.id === folderId);

        if (!folder || !folder.layerData?.isFolder) return false;

        folder.layerData.toggleExpanded();

        this._emitPanelUpdateRequest();

        if (this.eventBus) {
            this.eventBus.emit('folder:toggled', {
                folderId,
                expanded: folder.layerData.folderExpanded
            });
        }

        return true;
    }

    getVisibleLayers() {
        const layers = this.getLayers();
        const visibleLayers = [];

        for (const layer of layers) {
            if (this._isLayerHiddenByClosedFolder(layer, layers)) continue;
            visibleLayers.push(layer);
        }

        return visibleLayers;
    }

    _isLayerHiddenByClosedFolder(layer, layers = this.getLayers()) {
        let parentId = layer.layerData?.parentId;
        const visited = new Set();

        while (parentId && !visited.has(parentId)) {
            visited.add(parentId);
            const parentFolder = layers.find(l => l.layerData?.id === parentId);
            if (parentFolder?.layerData?.isFolder && !parentFolder.layerData.folderExpanded) {
                return true;
            }
            parentId = parentFolder?.layerData?.parentId || null;
        }

        return false;
    }

    getFolderChildren(folderId) {
        const layers = this.getLayers();
        const folder = layers.find(l => l.layerData?.id === folderId);

        if (!folder || !folder.layerData?.isFolder) return [];

        return layers.filter(l => l.layerData?.parentId === folderId);
    }

    getFolderSelectionTargets(folderId) {
        const layers = this.getLayers();
        const rootFolder = layers.find(layer => {
            return layer.layerData?.id === folderId && layer.layerData.isFolder;
        });
        if (!rootFolder) return null;

        const byId = new Map(
            layers
                .filter(layer => layer.layerData?.id)
                .map(layer => [layer.layerData.id, layer])
        );
        const resolveDepth = layer => {
            let parentId = layer.layerData?.parentId || null;
            let depth = 0;
            const visited = new Set();
            while (parentId && !visited.has(parentId)) {
                if (parentId === folderId) return depth + 1;
                visited.add(parentId);
                const parent = byId.get(parentId);
                if (!parent?.layerData?.isFolder) return -1;
                parentId = parent.layerData.parentId || null;
                depth += 1;
            }
            return -1;
        };

        const entries = [];
        layers.forEach((layer, order) => {
            if (!layer?.layerData || layer === rootFolder) return;
            const depth = resolveDepth(layer);
            if (depth < 1) return;
            entries.push({
                layer,
                order,
                depth,
                parentId: layer.layerData.parentId || null,
                type: layer.layerData.isFolder ? 'folder' : 'raster'
            });
        });

        return {
            rootFolder,
            rootIndex: layers.indexOf(rootFolder),
            entries
        };
    }

    pasteFolderSelectionPayload(payload) {
        if (
            payload?.kind !== 'folder-pixel-selection'
            || payload.version !== 1
            || !payload.rootFolder
            || !Array.isArray(payload.entries)
            || !this.currentFrameContainer
        ) {
            return null;
        }

        const previousState = {
            activeLayerId: this.getLayers()[this.activeLayerIndex]?.layerData?.id || null,
            selectedLayerIds: this.getSelectedLayerIds()
        };
        const createdByKey = new Map();
        const createdRecords = [];
        const canvasWidth = Math.max(1, Math.round(this.config?.canvas?.width || 1));
        const canvasHeight = Math.max(1, Math.round(this.config?.canvas?.height || 1));
        const wasApplying = historyManager?.isApplying === true;

        try {
            if (historyManager) historyManager.isApplying = true;
            const rootResult = this.createFolder(`${payload.rootFolder.name || 'フォルダ'} のコピー`);
            const rootFolder = rootResult?.layer;
            if (!rootFolder?.layerData) return null;
            createdByKey.set('root', rootFolder);

            const sortedEntries = [...payload.entries].sort((a, b) => a.order - b.order);
            for (const entry of sortedEntries) {
                const result = entry.type === 'folder'
                    ? this.createFolder(entry.name)
                    : this.createLayer(entry.name);
                const layer = result?.layer;
                if (!layer?.layerData) throw new Error('Failed to create folder clipboard entry');
                createdByKey.set(entry.sourceKey, layer);
                createdRecords.push({ entry, layer });
            }

            const applied = this._applyFolderSelectionPasteState({
                payload,
                rootFolder,
                createdByKey,
                createdRecords,
                canvasWidth,
                canvasHeight
            });
            if (!applied) throw new Error('Failed to apply folder clipboard hierarchy');

            const byteSize = payload.entries.reduce((total, entry) => {
                return total + (entry.pixels?.byteLength || 0);
            }, 0);
            if (historyManager && !wasApplying) {
                historyManager.isApplying = false;
                historyManager.record({
                    name: 'folder-selection-paste',
                    do: () => {
                        this._applyFolderSelectionPasteState({
                            payload,
                            rootFolder,
                            createdByKey,
                            createdRecords,
                            canvasWidth,
                            canvasHeight
                        });
                    },
                    undo: () => {
                        this._removeFolderSelectionPasteState({
                            rootFolder,
                            createdRecords,
                            previousState
                        });
                    },
                    byteSize,
                    meta: {
                        type: 'folder-pixel-selection',
                        action: 'paste',
                        rootFolderId: rootFolder.layerData.id,
                        entryCount: createdRecords.length,
                        rasterCount: createdRecords.filter(record => record.entry.type === 'raster').length
                    }
                });
            }

            return {
                rootFolder,
                rootIndex: this.getLayerIndex(rootFolder),
                createdRecords
            };
        } catch (error) {
            const rootFolder = createdByKey.get('root');
            this._removeFolderSelectionPasteState({
                rootFolder,
                createdRecords,
                previousState
            });
            console.error('[LayerSystem] Folder selection paste failed:', error);
            return null;
        } finally {
            if (historyManager) historyManager.isApplying = wasApplying;
        }
    }

    pasteLayerBlockPayload(payload) {
        if (
            payload?.kind !== 'layer-block'
            || payload.version !== 1
            || !Array.isArray(payload.layers)
            || payload.layers.length === 0
            || !this.currentFrameContainer
        ) {
            return null;
        }

        const previousState = {
            activeLayerId: this.getLayers()[this.activeLayerIndex]?.layerData?.id || null,
            selectedLayerIds: this.getSelectedLayerIds()
        };
        const createdBySourceId = new Map();
        const createdRecords = [];
        const wasApplying = historyManager?.isApplying === true;

        try {
            if (historyManager) historyManager.isApplying = true;
            const sortedEntries = [...payload.layers].sort((a, b) => a.order - b.order);
            for (const entry of sortedEntries) {
                const result = entry.type === 'folder'
                    ? this.createFolder(entry.name)
                    : this.createLayer(entry.name);
                const layer = result?.layer;
                if (!layer?.layerData) throw new Error('Failed to create layer block entry');
                createdBySourceId.set(entry.sourceId, layer);
                createdRecords.push({ entry, layer });
            }

            const applied = this._applyLayerBlockPasteState({
                payload,
                createdBySourceId,
                createdRecords
            });
            if (!applied) throw new Error('Failed to apply layer block payload');

            const byteSize = payload.layers.reduce((total, entry) => {
                return total + (entry.rasterSnapshot?.pixels?.byteLength || 0);
            }, 0);
            if (historyManager && !wasApplying) {
                historyManager.isApplying = false;
                historyManager.record({
                    name: 'layer-block-paste',
                    do: () => {
                        this._applyLayerBlockPasteState({
                            payload,
                            createdBySourceId,
                            createdRecords
                        });
                    },
                    undo: () => {
                        this._removeLayerBlockPasteState({
                            createdRecords,
                            previousState
                        });
                    },
                    byteSize,
                    meta: {
                        type: 'layer-block',
                        action: 'paste',
                        rootSourceId: payload.rootSourceId || null,
                        rootLayerId: createdBySourceId.get(payload.rootSourceId)?.layerData?.id || null,
                        layerCount: createdRecords.length,
                        rasterCount: createdRecords.filter(record => record.entry.type === 'raster').length
                    }
                });
            }

            return {
                rootLayer: createdBySourceId.get(payload.rootSourceId) || createdRecords[0]?.layer || null,
                rootIndex: this.getLayerIndex(createdBySourceId.get(payload.rootSourceId) || createdRecords[0]?.layer),
                createdRecords
            };
        } catch (error) {
            this._removeLayerBlockPasteState({ createdRecords, previousState });
            console.error('[LayerSystem] Layer block paste failed:', error);
            return null;
        } finally {
            if (historyManager) historyManager.isApplying = wasApplying;
        }
    }

    _applyLayerBlockPasteState({ payload, createdBySourceId, createdRecords }) {
        if (!payload || !createdBySourceId || !Array.isArray(createdRecords)) return false;
        const orderedRecords = createdRecords.slice().sort((a, b) => a.entry.order - b.entry.order);

        orderedRecords.forEach(({ layer }) => {
            if (layer.parent) this.currentFrameContainer.removeChild(layer);
            this.currentFrameContainer.addChild(layer);
        });

        for (const { layer } of orderedRecords) {
            if (!layer?.layerData) continue;
            layer.layerData.parentId = null;
            if (layer.layerData.isFolder) layer.layerData.children = [];
        }

        for (const { entry, layer } of orderedRecords) {
            const data = layer.layerData;
            const isRoot = entry.sourceId === payload.rootSourceId;
            data.name = isRoot
                ? `${entry.name || (entry.type === 'folder' ? 'フォルダ' : 'レイヤー')} のコピー`
                : (entry.name || (entry.type === 'folder' ? 'フォルダ' : 'レイヤー'));
            data.visible = entry.visible !== false;
            layer.visible = data.visible;
            data.opacity = Number.isFinite(entry.opacity) ? entry.opacity : 1;
            layer.alpha = data.opacity;
            data.blendMode = entry.blendMode || 'normal';
            layer.blendMode = data.blendMode;
            if (data.layerSprite) data.layerSprite.blendMode = data.blendMode;
            applyClippingMode(
                data,
                entry.clippingMode || (entry.clipping === true ? CLIPPING_MODES.NORMAL : CLIPPING_MODES.NONE)
            );

            const parentLayer = createdBySourceId.get(entry.parentSourceId);
            if (parentLayer?.layerData?.isFolder) {
                data.parentId = parentLayer.layerData.id;
                parentLayer.layerData.addChild(data.id);
            }

            if (entry.type === 'folder') {
                data.folderExpanded = entry.folderExpanded !== false;
                continue;
            }

            if (entry.rasterSnapshot) {
                this.restoreLayerRasterSnapshot({
                    ...entry.rasterSnapshot,
                    layerId: data.id,
                    pixels: entry.rasterSnapshot.pixels
                        ? new Uint8ClampedArray(entry.rasterSnapshot.pixels)
                        : null,
                    rasterBounds: entry.rasterSnapshot.rasterBounds
                        ? { ...entry.rasterSnapshot.rasterBounds }
                        : null
                });
                if (data.layerSprite) data.layerSprite.blendMode = data.blendMode;
            }

            const transform = {
                x: Number(entry.transform?.x) || 0,
                y: Number(entry.transform?.y) || 0,
                rotation: Number(entry.transform?.rotation) || 0,
                scaleX: Number(entry.transform?.scaleX) || 1,
                scaleY: Number(entry.transform?.scaleY) || 1
            };
            this.transform?.setTransform?.(data.id, { ...transform });
            this.transform?.applyTransform?.(
                layer,
                transform,
                this.config.canvas.width / 2,
                this.config.canvas.height / 2
            );
            this.requestThumbnailUpdate(this.getLayerIndex(layer), true);
        }

        const rootLayer = createdBySourceId.get(payload.rootSourceId) || orderedRecords[0]?.layer || null;
        if (rootLayer) {
            this.activeLayerIndex = this.getLayerIndex(rootLayer);
            this._setSingleLayerSelection(this.activeLayerIndex);
        }
        this.refreshClippingMasks();
        this.coordAPI?.clearCache?.();
        this._emitPanelUpdateRequest();
        this._emitStatusUpdateRequest();
        return true;
    }

    _removeLayerBlockPasteState({ createdRecords, previousState }) {
        const createdLayers = (createdRecords || []).map(record => record.layer).filter(Boolean);
        for (const layer of createdLayers) {
            if (layer?.layerData?.parentId) {
                const parent = this.getLayers().find(candidate => candidate.layerData?.id === layer.layerData.parentId);
                parent?.layerData?.removeChild(layer.layerData.id);
            }
        }
        for (const layer of createdLayers) {
            if (layer?.parent === this.currentFrameContainer) {
                this.currentFrameContainer.removeChild(layer);
            }
        }
        const layers = this.getLayers();
        const previousActiveIndex = layers.findIndex(layer => layer.layerData?.id === previousState?.activeLayerId);
        this.activeLayerIndex = previousActiveIndex >= 0 ? previousActiveIndex : Math.min(this.activeLayerIndex, layers.length - 1);
        if (Array.isArray(previousState?.selectedLayerIds)) {
            this.selectedLayerIds = new Set(previousState.selectedLayerIds);
        }
        this.refreshClippingMasks();
        this.coordAPI?.clearCache?.();
        this._emitPanelUpdateRequest();
        this._emitStatusUpdateRequest();
    }

    _applyFolderSelectionPasteState({
        payload,
        rootFolder,
        createdByKey,
        createdRecords,
        canvasWidth,
        canvasHeight
    }) {
        if (!rootFolder?.layerData) return false;
        const orderedLayers = createdRecords
            .slice()
            .sort((a, b) => a.entry.order - b.entry.order)
            .map(record => record.layer);
        orderedLayers.push(rootFolder);
        orderedLayers.forEach(layer => {
            if (layer.parent) this.currentFrameContainer.removeChild(layer);
            this.currentFrameContainer.addChild(layer);
        });

        for (const layer of orderedLayers) {
            if (!layer?.layerData) continue;
            layer.layerData.parentId = null;
            if (layer.layerData.isFolder) layer.layerData.children = [];
        }

        rootFolder.layerData.name = `${payload.rootFolder.name || 'フォルダ'} のコピー`;
        rootFolder.layerData.visible = payload.rootFolder.visible !== false;
        rootFolder.visible = rootFolder.layerData.visible;
        rootFolder.layerData.opacity = Number.isFinite(payload.rootFolder.opacity)
            ? payload.rootFolder.opacity
            : 1;
        rootFolder.alpha = rootFolder.layerData.opacity;
        rootFolder.layerData.folderExpanded = payload.rootFolder.folderExpanded !== false;

        for (const record of createdRecords) {
            const { entry, layer } = record;
            const data = layer.layerData;
            const parent = createdByKey.get(entry.relativeParentKey);
            if (!parent?.layerData?.isFolder) return false;

            data.name = entry.name || (entry.type === 'folder' ? 'フォルダ' : 'レイヤー');
            data.parentId = parent.layerData.id;
            parent.layerData.addChild(data.id);
            data.visible = entry.visible !== false;
            layer.visible = data.visible;
            data.opacity = Number.isFinite(entry.opacity) ? entry.opacity : 1;
            layer.alpha = data.opacity;
            data.blendMode = entry.blendMode || 'normal';
            applyClippingMode(
                data,
                entry.clippingMode || (entry.clipping === true ? CLIPPING_MODES.NORMAL : CLIPPING_MODES.NONE)
            );
            layer.blendMode = data.blendMode;
            if (data.layerSprite) data.layerSprite.blendMode = data.blendMode;

            if (entry.type === 'folder') {
                data.folderExpanded = entry.folderExpanded !== false;
                continue;
            }

            const pixels = new Uint8ClampedArray(canvasWidth * canvasHeight * 4);
            const localBounds = entry.localBounds || {};
            const x = Math.max(0, Math.round(localBounds.x || 0));
            const y = Math.max(0, Math.round(localBounds.y || 0));
            const width = Math.max(1, Math.round(entry.width || 1));
            const height = Math.max(1, Math.round(entry.height || 1));
            for (let row = 0; row < height && y + row < canvasHeight; row++) {
                const sourceStart = row * width * 4;
                const copyWidth = Math.min(width, canvasWidth - x);
                if (copyWidth <= 0) break;
                const targetStart = ((y + row) * canvasWidth + x) * 4;
                pixels.set(
                    entry.pixels.subarray(sourceStart, sourceStart + copyWidth * 4),
                    targetStart
                );
            }
            this.restoreLayerRasterSnapshot({
                layerId: data.id,
                width: canvasWidth,
                height: canvasHeight,
                pixels,
                paths: [],
                pathsData: []
            });
            const transform = {
                x: Number(entry.transform?.x) || 0,
                y: Number(entry.transform?.y) || 0,
                rotation: Number(entry.transform?.rotation) || 0,
                scaleX: Number(entry.transform?.scaleX) || 1,
                scaleY: Number(entry.transform?.scaleY) || 1
            };
            this.transform?.setTransform?.(data.id, { ...transform });
            this.transform?.applyTransform?.(
                layer,
                transform,
                canvasWidth / 2,
                canvasHeight / 2
            );
            this.requestThumbnailUpdate(this.getLayerIndex(layer), true);
        }

        this.activeLayerIndex = this.getLayerIndex(rootFolder);
        this._setSingleLayerSelection(this.activeLayerIndex);
        this.refreshClippingMasks();
        this.coordAPI?.clearCache?.();
        this._emitPanelUpdateRequest();
        this._emitStatusUpdateRequest();
        this._emitMultiSelectionChanged('folder-selection-paste');
        this.eventBus?.emit('selection:folder-pasted', {
            folderId: rootFolder.layerData.id,
            entryCount: createdRecords.length,
            bounds: { ...(payload.canvasBounds || {}) }
        });
        return true;
    }

    _removeFolderSelectionPasteState({ rootFolder, createdRecords, previousState }) {
        const createdLayers = [
            ...createdRecords.map(record => record.layer),
            rootFolder
        ].filter(Boolean);
        for (const layer of createdLayers) {
            if (layer.parent === this.currentFrameContainer) {
                this.currentFrameContainer.removeChild(layer);
            }
        }

        const layers = this.getLayers();
        const previousActiveIndex = layers.findIndex(layer => {
            return layer.layerData?.id === previousState?.activeLayerId;
        });
        this.activeLayerIndex = previousActiveIndex >= 0
            ? previousActiveIndex
            : Math.max(0, layers.length - 1);
        this.selectedLayerIds = new Set(
            (previousState?.selectedLayerIds || []).filter(id => {
                return layers.some(layer => layer.layerData?.id === id);
            })
        );
        if (this.selectedLayerIds.size === 0) {
            this._setSingleLayerSelection(this.activeLayerIndex);
        }
        this.refreshClippingMasks();
        this.coordAPI?.clearCache?.();
        this._emitPanelUpdateRequest();
        this._emitStatusUpdateRequest();
        this._emitMultiSelectionChanged('folder-selection-paste-undo');
        this.eventBus?.emit('selection:folder-paste-undone', {
            folderId: rootFolder?.layerData?.id || null
        });
        return true;
    }

    _generateNextFolderName() {
        const layers = this.getLayers();
        const folderNames = layers
            .filter(l => l.layerData?.isFolder)
            .map(l => l.layerData.name);

        const numbers = folderNames
            .map(name => {
                const match = name.match(/^フォルダ(\d+)$/);
                return match ? parseInt(match[1], 10) : 0;
            })
            .filter(n => n > 0);

        const maxNumber = numbers.length > 0 ? Math.max(...numbers) : 0;
        return `フォルダ${maxNumber + 1}`;
    }

    getLayerById(layerId) {
        if (!layerId) return null;

        const layers = this.getLayers();
        return layers.find(layer => {
            return layer.id === layerId ||
                   layer.label === layerId ||
                   layer.layerData?.id === layerId;
        }) || null;
    }

    _createSolidBackground(width, height, color = 0xf0e0d6) {
        const g = new Graphics();
        g.rect(0, 0, width, height);
        g.fill({ color: color, alpha: 1.0 });
        g.label = 'backgroundFill';
        return g;
    }

    _setupResizeEvents() {
        if (!this.eventBus) return;

        this.eventBus.on('camera:resized', (data) => {
            // [指示書] 全レイヤーのテクスチャを新サイズへ拡張
            this.resizeLayerTextures(data.width, data.height, data.oldWidth, data.oldHeight, data.align);

            this._refreshCheckerPattern(true);

            const bgLayer = this.getLayers()[0];
            if (bgLayer?.layerData?.isBackground && bgLayer.layerData.backgroundGraphics) {
                const bg = bgLayer.layerData.backgroundGraphics;
                const currentColor = bgLayer.layerData.backgroundColor || 0xf0e0d6;

                bg.clear();
                bg.rect(0, 0, data.width, data.height);
                bg.fill({ color: currentColor, alpha: 1.0 });
            }

            // 全レイヤーのサムネイル更新を要求
            const layers = this.getLayers();
            for (let i = 0; i < layers.length; i++) {
                this.requestThumbnailUpdate(i);
            }
            this._emitPanelUpdateRequest();
        });

        this.eventBus.on('camera:transform-changed', () => {
            this._refreshCheckerPattern(false);
        });
    }

    _getCheckerTileScale() {
        const scale = Math.max(Math.abs(this.cameraSystem?.worldContainer?.scale?.x || 1), 0.01);
        return 1 / scale;
    }

    _refreshCheckerPattern(forceRecreate = false) {
        if (!window.checkerUtils || !this.cameraSystem?.canvasContainer) return;

        const bgLayer = this.getLayers()[0];
        const isBackgroundVisible = bgLayer?.layerData?.visible !== false;
        const tileScale = this._getCheckerTileScale();
        const shouldRecreate = forceRecreate ||
            !this.checkerPattern ||
            !this.checkerPattern.parent;

        if (shouldRecreate) {
            if (this.checkerPattern?.parent) {
                this.checkerPattern.parent.removeChild(this.checkerPattern);
                this.checkerPattern.destroy();
            }

            this.checkerPattern = window.checkerUtils.createCanvasChecker(
                this.config.canvas.width,
                this.config.canvas.height
            );
            this.cameraSystem.canvasContainer.addChildAt(this.checkerPattern, 0);
            if (this.currentFrameContainer?.parent === this.cameraSystem.canvasContainer) {
                this.cameraSystem.canvasContainer.setChildIndex(this.currentFrameContainer, 1);
            }
        }

        if (this.checkerPattern?.tileScale && Math.abs((this._checkerTileScale || 0) - tileScale) > 0.001) {
            this.checkerPattern.tileScale.set(tileScale);
            this._checkerTileScale = tileScale;
        }

        this.checkerPattern.visible = !isBackgroundVisible;
    }

    /**
     * [指示書] キャンバスリサイズに合わせて全レイヤーのテクスチャサイズを更新する
     */
    resizeLayerTextures(newWidth, newHeight, oldWidth, oldHeight, alignOptions) {
        const widthDiff = newWidth - oldWidth;
        const heightDiff = newHeight - oldHeight;

        let offsetX = 0;
        let offsetY = 0;

        const hAlign = alignOptions?.horizontal || 'center';
        const vAlign = alignOptions?.vertical || 'center';

        if (hAlign === 'center') offsetX = widthDiff / 2;
        else if (hAlign === 'right') offsetX = widthDiff;

        if (vAlign === 'center') offsetY = heightDiff / 2;
        else if (vAlign === 'bottom') offsetY = heightDiff;

        if (this.config?.debug) {
            console.log('[LayerSystem] Starting resizeLayerTextures', { newWidth, newHeight, offsetX, offsetY });
        }

        for (const layer of this.getLayers()) {
            // [指示書] 背景レイヤーとフォルダはスキップ（背景は別途 backgroundGraphics で処理済み）
            if (!layer.layerData || layer.layerData.isFolder || layer.layerData.isBackground) continue;
            this._resizeSingleLayerTexture(layer, newWidth, newHeight, offsetX, offsetY);
        }
    }

    /**
     * [指示書] 単一レイヤーの RenderTexture をリサイズし、内容をコピーする
     */
    _resizeSingleLayerTexture(layer, newWidth, newHeight, offsetX, offsetY) {
        const layerData = layer.layerData;
        if (!layerData || !this.app?.renderer) return;

        const oldRT = layerData.renderTexture;
        if (!oldRT) return;

        if (this.config?.debug) {
            console.log('[LayerSystem] resize layer texture', {
                layer: layerData.name,
                oldRT: `${oldRT.width}x${oldRT.height}`,
                newRT: `${newWidth}x${newHeight}`,
                offset: `${offsetX},${offsetY}`
            });
        }

        // 1. 新しい RenderTexture 作成
        const newRT = RenderTexture.create({
            width: newWidth,
            height: newHeight,
            antialias: true
        });

        // 2. 旧内容を新テクスチャへレンダリング
        const tempSprite = new Sprite(oldRT);
        tempSprite.position.set(offsetX, offsetY);

        this.app.renderer.render({
            container: tempSprite,
            target: newRT,
            clear: true,
            clearColor: [0, 0, 0, 0]   // 透明でクリアしてから旧内容を描画
        });

        // 3. データの差し替え
        layerData.renderTexture = newRT;
        if (layerData.layerSprite) {
            layerData.layerSprite.texture = newRT;
        } else {
            layerData.layerSprite = new Sprite(newRT);
            layerData.layerSprite.label = 'layer_raster_sprite';
            layer.addChildAt(layerData.layerSprite, 0);
        }

        // 4. マスクがある場合はマスクもリサイズ
        if (layerData.maskTexture) {
            layerData.initializeMask(newWidth, newHeight, this.app.renderer);
            // 注: 既存マスク内容は「全部塗りつぶし」にリセットされる。
            // もし複雑なマスク運用がある場合はここもコピーが必要だが、現状は初期化で十分とする。
        }

        // 5. 旧テクスチャ破棄
        oldRT.destroy(true);
        tempSprite.destroy({ texture: false, baseTexture: false });
    }

    changeBackgroundLayerColor(layerIndex, layerId, colorOverride = null) {
        const layers = this.getLayers();
        if (layerIndex < 0 || layerIndex >= layers.length) return;

        const layer = layers[layerIndex];
        if (!layer?.layerData?.isBackground) return;

        const color = colorOverride ?? window.brushSettings?.getColor() ?? 0xf0e0d6;

        layer.layerData.backgroundColor = color;

        const bg = layer.layerData.backgroundGraphics;
        if (bg) {
            bg.clear();
            bg.rect(0, 0, this.config.canvas.width, this.config.canvas.height);
            bg.fill({ color: color, alpha: 1.0 });
        }

        if (this.eventBus) {
            this.eventBus.emit('layer:background-color-changed', {
                layerIndex,
                layerId,
                color
            });
            this.requestThumbnailUpdate(layerIndex);
        }
    }

    setLayerOpacity(layerIndex, opacity) {
        const layers = this.getLayers();
        if (layerIndex < 0 || layerIndex >= layers.length) return;

        const layer = layers[layerIndex];
        if (layer.layerData?.isBackground) return;

        opacity = Math.max(0, Math.min(1, opacity));

        if (layer.layerData) {
            layer.layerData.opacity = opacity;
        }
        this._refreshLayerEffectiveAlpha();

        if (this.eventBus) {
            this.eventBus.emit('layer:opacity-changed', {
                layerIndex,
                layerId: layer.layerData?.id,
                opacity
            });
            this.requestThumbnailUpdate(layerIndex);
        }
    }

    setLayerBlendMode(layerIndex, blendMode) {
        const layers = this.getLayers();
        if (layerIndex < 0 || layerIndex >= layers.length) return false;

        const layer = layers[layerIndex];
        if (layer.layerData?.isBackground) return false;

        const allowedModes = new Set(['normal', 'multiply', 'add', 'overlay']);
        const nextMode = allowedModes.has(blendMode) ? blendMode : 'normal';

        layer.blendMode = nextMode;
        if (layer.layerData?.layerSprite) {
            layer.layerData.layerSprite.blendMode = nextMode;
        }
        if (layer.layerData) {
            layer.layerData.blendMode = nextMode;
        }

        if (this.eventBus) {
            this.eventBus.emit('layer:blend-mode-changed', {
                layerIndex,
                layerId: layer.layerData?.id,
                blendMode: nextMode
            });
            this.requestThumbnailUpdate(layerIndex);
        }

        return true;
    }

    setLayerClippingMode(layerIndex, clippingMode, options = {}) {
        const layers = this.getLayers();
        if (layerIndex < 0 || layerIndex >= layers.length) return false;

        const layer = layers[layerIndex];
        if (layer.layerData?.isBackground) return false;

        const layerId = layer.layerData.id;
        const previousMode = getClippingMode(layer.layerData);
        const nextMode = applyClippingMode({}, clippingMode);
        if (previousMode === nextMode) return false;

        const applyMode = (mode) => {
            const currentLayers = this.getLayers();
            const currentIndex = currentLayers.findIndex(candidate => candidate?.layerData?.id === layerId);
            const currentLayer = currentLayers[currentIndex];
            if (currentIndex < 0 || !currentLayer?.layerData) return false;

            const appliedMode = applyClippingMode(currentLayer.layerData, mode);
            this.refreshClippingMasks();
            if (this.eventBus) {
                this.eventBus.emit('layer:clipping-changed', {
                    layerIndex: currentIndex,
                    layerId,
                    clipping: appliedMode !== CLIPPING_MODES.NONE,
                    clippingMode: appliedMode,
                    inverse: appliedMode === CLIPPING_MODES.INVERSE
                });
                this._emitPanelUpdateRequest();
                this.requestThumbnailUpdate(currentIndex, true);
            }
            return true;
        };

        if (options.recordHistory !== false && historyManager && !historyManager.isApplying) {
            historyManager.push({
                name: 'layer-clipping-mode',
                do: () => applyMode(nextMode),
                undo: () => applyMode(previousMode),
                meta: { layerId, previousMode, nextMode }
            });
            return true;
        }

        applyMode(nextMode);
        return true;
    }

    setLayerClipping(layerIndex, clipping, options = {}) {
        return this.setLayerClippingMode(
            layerIndex,
            clipping === true ? CLIPPING_MODES.NORMAL : CLIPPING_MODES.NONE,
            options
        );
    }

    toggleLayerClipping(layerIndex) {
        const layer = this.getLayers()[layerIndex];
        if (!layer?.layerData) return false;
        return this.setLayerClippingMode(
            layerIndex,
            cycleClippingMode(getClippingMode(layer.layerData))
        );
    }

    refreshClippingMasks() {
        const layers = this.getLayers();
        if (!layers.length) return;

        this.clearClippingMasks();

        for (const layer of layers) {
            const data = layer.layerData;
            const displayClippingMode = data?.animationDisplayClippingMode
                || getClippingMode(data);
            if (!data || data.isBackground || displayClippingMode === CLIPPING_MODES.NONE) continue;
            if (!data.isFolder && (!data.layerSprite || !data.renderTexture)) continue;

            const sourceLayers = this._resolveClippingSourceLayers(layer, layers);
            if (sourceLayers.length === 0) {
                data.clippingDisplaySuppressed = true;
                if (data.isFolder) {
                    this._suppressFolderClippingTargets(layer);
                } else if (data.layerSprite) {
                    data.layerSprite.visible = false;
                }
                data.effectiveClippingSourceId = null;
                continue;
            }

            const maskTexture = this._createBinaryClippingMaskTexture(sourceLayers);
            if (!maskTexture) {
                data.clippingDisplaySuppressed = true;
                if (data.isFolder) {
                    this._suppressFolderClippingTargets(layer);
                } else if (data.layerSprite) {
                    data.layerSprite.visible = false;
                }
                data.effectiveClippingSourceId = null;
                continue;
            }

            const inverse = displayClippingMode === CLIPPING_MODES.INVERSE;
            data.clippingDisplaySuppressed = false;
            if (data.isFolder) {
                const targets = this._getFolderClippingSourceLayers(layer);
                data.folderClippingMaskSprites = targets.map(targetLayer => {
                    const maskSprite = this._createClippingMaskSprite(maskTexture);
                    // Folder maskはLayer一覧の正本であるcurrentFrameContainerへ入れない。
                    // owner Folder配下へ隔離し、内部maskを実Layerとして露出させない。
                    layer.addChild(maskSprite);
                    this._setClippingMask(targetLayer, maskSprite, inverse);
                    return { target: targetLayer, maskSprite };
                });
            } else {
                const maskSprite = this._createClippingMaskSprite(maskTexture);
                layer.addChildAt(maskSprite, 0);
                this._setClippingMask(data.layerSprite, maskSprite, inverse);
                this._applyClippingMaskToLayerChildren(layer, maskSprite, inverse);
                data.layerSprite.visible = true;
                data.clippingMaskSprite = maskSprite;
            }
            data.clippingMaskTexture = maskTexture;
            data.clippingMaskInverse = inverse;
            data.effectiveClippingSourceId = sourceLayers.map(source => source.layerData?.id).filter(Boolean).join(',') || null;
        }
    }

    _suppressFolderClippingTargets(folderLayer) {
        const data = folderLayer?.layerData;
        if (!data?.isFolder) return;

        data.folderClippingSuppressedTargets = this._getFolderClippingSourceLayers(folderLayer)
            .map(target => ({ target, previousVisible: target.visible }));
        for (const entry of data.folderClippingSuppressedTargets) {
            entry.target.visible = false;
        }
    }

    _clearLayerClippingMask(layer) {
        const data = layer?.layerData;
        if (!data) return;

        if (data.layerSprite && data.clippingMaskSprite) {
            this._setClippingMask(data.layerSprite, null, false);
        }
        if (data.clippingMaskSprite) {
            for (const child of data.clippingMaskedChildren || []) {
                if (child) this._setClippingMask(child, null, false);
            }
        }
        data.clippingMaskedChildren = null;
        data.clippingDisplaySuppressed = false;
        if (data.layerSprite && !data.isFolder && !data.isBackground) {
            data.layerSprite.visible = true;
        }
        if (data.clippingMaskSprite) {
            if (data.clippingMaskSprite.parent) {
                data.clippingMaskSprite.parent.removeChild(data.clippingMaskSprite);
            }
            data.clippingMaskSprite.renderable = false;
            this._clippingMaskSpritePool.push(data.clippingMaskSprite);
            data.clippingMaskSprite = null;
        }
        for (const entry of data.folderClippingMaskSprites || []) {
            if (entry?.target) {
                this._setClippingMask(entry.target, null, false);
            }
            if (entry?.maskSprite?.parent) entry.maskSprite.parent.removeChild(entry.maskSprite);
            if (entry?.maskSprite) {
                entry.maskSprite.renderable = false;
                this._clippingMaskSpritePool.push(entry.maskSprite);
            }
        }
        data.folderClippingMaskSprites = null;
        for (const entry of data.folderClippingSuppressedTargets || []) {
            if (entry?.target) entry.target.visible = entry.previousVisible !== false;
        }
        data.folderClippingSuppressedTargets = null;
        if (data.clippingMaskTexture) {
            this._clippingMaskTexturePool.push(data.clippingMaskTexture);
            data.clippingMaskTexture = null;
        }
        data.clippingMaskInverse = false;
        data.effectiveClippingSourceId = null;
    }

    _setClippingMask(target, maskSprite, inverse = false) {
        if (!target) return;
        if (!maskSprite) {
            // Pixi v8のmask setter自体がeffectを破棄する。
            // setMask({ mask: null })を重ねるとresource=nullのAlphaMaskEffectが
            // 再生成され、別targetへの描画時にAlphaMaskPipeが例外化する。
            target.mask = null;
            return;
        }
        if (typeof target.setMask === 'function') {
            target.setMask({ mask: maskSprite, inverse: inverse === true });
            // Pixi v8.17 evaluates mask bounds before AlphaMaskPipe copies
            // _maskOptions.inverse into the effect. Keep the effect in sync
            // immediately so the first inverse frame does not use normal bounds.
            if (target._maskEffect) {
                target._maskEffect.inverse = inverse === true;
            }
            return;
        }
        target.mask = maskSprite;
    }

    _applyClippingMaskToLayerChildren(layer, maskSprite, inverse = false) {
        const data = layer?.layerData;
        if (!data || !maskSprite) return;

        data.clippingMaskedChildren = [];
        for (const child of layer.children || []) {
            if (!child || child === maskSprite || child === data.maskSprite || child === data.backgroundGraphics) continue;
            this._setClippingMask(child, maskSprite, inverse);
            data.clippingMaskedChildren.push(child);
        }
    }

    _createClippingMaskSprite(texture) {
        const sprite = this._clippingMaskSpritePool.pop() || new Sprite(texture);
        sprite.texture = texture;
        sprite.label = 'clipping_mask_sprite';
        sprite.renderable = false;
        sprite.eventMode = 'none';
        sprite.position.set(0, 0);
        return sprite;
    }

    _createBinaryClippingMaskTexture(sourceLayers) {
        if (!Array.isArray(sourceLayers) || !this.app?.renderer) return null;
        if (sourceLayers.length === 0) return null;

        const width = Math.max(1, Math.round(this.config?.canvas?.width || 1));
        const height = Math.max(1, Math.round(this.config?.canvas?.height || 1));
        const pixels = new Uint8ClampedArray(width * height * 4);
        let hasMaskPixel = false;

        for (const rasterLayer of sourceLayers) {
            const snapshot = this.createLayerRasterSnapshot(rasterLayer);
            if (!snapshot?.pixels) continue;
            const bounds = normalizeRasterBounds(snapshot.rasterBounds, {
                width: snapshot.width,
                height: snapshot.height
            });
            for (let y = 0; y < snapshot.height; y++) {
                const targetY = bounds.y + y;
                if (targetY < 0 || targetY >= height) continue;
                for (let x = 0; x < snapshot.width; x++) {
                    if (snapshot.pixels[(y * snapshot.width + x) * 4 + 3] === 0) continue;
                    const targetX = bounds.x + x;
                    if (targetX < 0 || targetX >= width) continue;
                    const offset = (targetY * width + targetX) * 4;
                    pixels[offset] = 255;
                    pixels[offset + 1] = 255;
                    pixels[offset + 2] = 255;
                    pixels[offset + 3] = 255;
                    hasMaskPixel = true;
                }
            }
        }
        if (!hasMaskPixel) return null;

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const context = canvas.getContext('2d');
        context.putImageData(new ImageData(pixels, width, height), 0, 0);

        // CanvasSourceをAlphaMaskへ直結すると、Album/exportの別RenderTargetで
        // BindGroup resourceがnullになる場合がある。既存Raster maskと同じ
        // RenderTextureへ一度焼き込み、描画targetが変わっても再利用可能にする。
        const sourceTexture = Texture.from(canvas);
        const sourceSprite = new Sprite(sourceTexture);
        let maskTexture = this._clippingMaskTexturePool.pop() || null;
        if (maskTexture && (maskTexture.width !== width || maskTexture.height !== height)) {
            maskTexture.destroy(true);
            maskTexture = null;
        }
        maskTexture ||= RenderTexture.create({ width, height });
        try {
            this.app.renderer.render({
                container: sourceSprite,
                target: maskTexture,
                clear: true,
                clearColor: [0, 0, 0, 0]
            });
        } finally {
            sourceSprite.destroy({ texture: true, baseTexture: true });
        }
        return maskTexture;
    }

    _resolveClippingSourceLayers(layer, layers = this.getLayers()) {
        const requestedIds = layer?.layerData?.animationClippingSourceLayerIds;
        if (Array.isArray(requestedIds)) {
            const requestedIdSet = new Set(requestedIds);
            return layers.filter(candidate => {
                const data = candidate?.layerData;
                return data
                    && requestedIdSet.has(data.id)
                    && !data.isFolder
                    && !data.isBackground
                    && !!data.renderTexture
                    && this._isLayerPersistentlyVisible(candidate, layers);
            });
        }

        const sourceLayer = this._findClippingSourceLayer(layer, layers);
        if (!sourceLayer?.layerData) return [];
        return sourceLayer.layerData.isFolder
            ? this._getFolderClippingSourceLayers(sourceLayer)
            : [sourceLayer];
    }

    _getFolderClippingSourceLayers(folderLayer) {
        const folderId = folderLayer?.layerData?.id;
        if (!folderId || !folderLayer.layerData.isFolder) return [];

        return this._getFolderSubtreeLayers(folderId).filter(sourceLayer => {
            const data = sourceLayer?.layerData;
            return data
                && !data.isFolder
                && !data.isBackground
                && !!data.renderTexture
                && this._isLayerPersistentlyVisible(sourceLayer);
        });
    }

    _findClippingSourceLayer(layer, layers = this.getLayers()) {
        if (!layer?.layerData) return null;

        const layerIndex = layers.indexOf(layer);
        if (layerIndex <= 0) return null;

        const parentId = layer.layerData.parentId || null;
        for (let index = layerIndex - 1; index >= 0; index--) {
            const candidate = layers[index];
            const data = candidate?.layerData;
            if (!data) continue;
            if ((data.parentId || null) !== parentId) continue;
            if (!this._isLayerPersistentlyVisible(candidate, layers)) return null;
            if (data.isBackground) return null;
            if (data.isFolder) {
                return this._getFolderClippingSourceLayers(candidate).length > 0 ? candidate : null;
            }
            if (!data.renderTexture) return null;
            return candidate;
        }

        return null;
    }

    getActiveLayerIndex() {
        return this.activeLayerIndex;
    }

    getSelectedLayerIds() {
        this._syncSelectedLayerIds();
        return [...this.selectedLayerIds];
    }

    getSelectedLayerIndexes() {
        const selectedIds = new Set(this.getSelectedLayerIds());
        return this.getLayers()
            .map((layer, index) => selectedIds.has(layer.layerData?.id) ? index : -1)
            .filter(index => index >= 0);
    }

    isLayerSelected(layerIndex) {
        const layer = this.getLayers()[layerIndex];
        return !!layer?.layerData?.id && this.selectedLayerIds.has(layer.layerData.id);
    }

    _setSingleLayerSelection(layerIndex) {
        const layer = this.getLayers()[layerIndex];
        this.selectedLayerIds.clear();
        if (layer?.layerData?.id && !layer.layerData.isBackground) {
            this.selectedLayerIds.add(layer.layerData.id);
            this.selectionAnchorIndex = layerIndex;
        } else {
            this.selectionAnchorIndex = -1;
        }
    }

    _syncSelectedLayerIds() {
        const liveIds = new Set(
            this.getLayers()
                .map(layer => layer.layerData?.id)
                .filter(Boolean)
        );
        for (const id of [...this.selectedLayerIds]) {
            if (!liveIds.has(id)) {
                this.selectedLayerIds.delete(id);
            }
        }
    }

    _emitMultiSelectionChanged(reason = 'update') {
        this._syncSelectedLayerIds();
        if (this.eventBus) {
            this.eventBus.emit('layer:multi-selection-changed', {
                selectedLayerIds: this.getSelectedLayerIds(),
                selectedLayerIndexes: this.getSelectedLayerIndexes(),
                activeIndex: this.activeLayerIndex,
                reason
            });
        }
    }

    toggleLayerSelection(layerIndex) {
        const layers = this.getLayers();
        const layer = layers[layerIndex];
        if (!layer?.layerData || layer.layerData.isBackground) return false;

        if (this.activeLayerIndex !== layerIndex) {
            this.setActiveLayer(layerIndex, { preserveSelection: true });
        }

        const layerId = layer.layerData.id;
        if (this.selectedLayerIds.has(layerId) && this.selectedLayerIds.size > 1) {
            this.selectedLayerIds.delete(layerId);
        } else {
            this.selectedLayerIds.add(layerId);
            this.selectionAnchorIndex = layerIndex;
        }

        if (!this.selectedLayerIds.has(layerId)) {
            const fallbackId = this.getLayers()[this.activeLayerIndex]?.layerData?.id;
            if (fallbackId) this.selectedLayerIds.add(fallbackId);
        }

        this._emitPanelUpdateRequest();
        this._emitMultiSelectionChanged('toggle');
        return true;
    }

    selectLayerRange(layerIndex) {
        const layers = this.getLayers();
        const targetLayer = layers[layerIndex];
        if (!targetLayer?.layerData || targetLayer.layerData.isBackground) return false;

        const anchor = this.selectionAnchorIndex >= 0 ? this.selectionAnchorIndex : this.activeLayerIndex;
        if (anchor < 0 || anchor >= layers.length) {
            this._setSingleLayerSelection(layerIndex);
        } else {
            const start = Math.min(anchor, layerIndex);
            const end = Math.max(anchor, layerIndex);
            this.selectedLayerIds.clear();
            for (let index = start; index <= end; index++) {
                const layer = layers[index];
                if (layer?.layerData?.id && !layer.layerData.isBackground) {
                    this.selectedLayerIds.add(layer.layerData.id);
                }
            }
        }

        if (this.activeLayerIndex !== layerIndex) {
            this.setActiveLayer(layerIndex, { preserveSelection: true });
        } else {
            this._emitPanelUpdateRequest();
        }
        this._emitMultiSelectionChanged('range');
        return true;
    }

    createLayerRasterSnapshot(layer) {
        if (!layer?.layerData?.renderTexture || !this.app?.renderer) return null;

        const layerData = layer.layerData;
        const renderTexture = layerData.renderTexture;
        const tempSprite = new Sprite(renderTexture);
        let result = null;

        try {
            result = this.app.renderer.extract.pixels({
                target: tempSprite,
                clearColor: '#00000000'
            });
        } finally {
            tempSprite.destroy({ texture: false, baseTexture: false });
        }

        const sourcePixels = result?.pixels || (result instanceof Uint8ClampedArray ? result : new Uint8ClampedArray(result?.buffer || result));
        const width = Math.round(result?.width || renderTexture.width || this.config.canvas.width);
        const height = Math.round(result?.height || renderTexture.height || this.config.canvas.height);
        const rasterBounds = normalizeRasterBounds(layerData.rasterBounds, { width, height });
        rasterBounds.width = width;
        rasterBounds.height = height;
        layerData.rasterBounds = rasterBounds;
        if (layerData.layerSprite) {
            layerData.layerSprite.position.set(rasterBounds.x, rasterBounds.y);
        }
        const pixels = new Uint8ClampedArray(sourcePixels);
        this._unpremultiplyPixelBuffer(pixels);
        this._debugValidateRasterSnapshot({
            source: 'create',
            layerId: layerData.id,
            width,
            height,
            pixels,
            rasterBounds
        });

        return {
            layerId: layerData.id,
            width,
            height,
            rasterBounds: { ...rasterBounds },
            pixels,
            pathsData: structuredClone(layerData.pathsData || []),
            paths: structuredClone(layerData.paths || [])
        };
    }

    _unpremultiplyPixelBuffer(pixels) {
        if (!pixels) return pixels;

        for (let i = 0; i < pixels.length; i += 4) {
            const alpha = pixels[i + 3];
            if (alpha > 0 && alpha < 255) {
                pixels[i] = Math.min(255, Math.round(pixels[i] * 255 / alpha));
                pixels[i + 1] = Math.min(255, Math.round(pixels[i + 1] * 255 / alpha));
                pixels[i + 2] = Math.min(255, Math.round(pixels[i + 2] * 255 / alpha));
            }
        }

        return pixels;
    }

    /**
     * 🧪 Phase 3e 調査用: 表示中の全レイヤー（背景除く）を合成した snapshot を取得する
     */
    async createCompositeDrawingSnapshot() {
        if (!this.app?.renderer || !this.currentFrameContainer) return null;

        const width = this.config.canvas.width;
        const height = this.config.canvas.height;
        const tempRT = RenderTexture.create({ width, height });

        // 背景レイヤーとチェッカーを一時的に非表示にする
        const bgLayer = this.currentFrameContainer.children[0];
        const oldBgVisible = bgLayer ? bgLayer.visible : true;
        if (bgLayer) bgLayer.visible = false;

        const oldCheckerVisible = this.checkerPattern ? this.checkerPattern.visible : false;
        if (this.checkerPattern) this.checkerPattern.visible = false;

        try {
            // 合成レンダリング
            this.app.renderer.render({
                container: this.currentFrameContainer,
                target: tempRT,
                clear: true,
                clearColor: [0, 0, 0, 0]
            });

            // ピクセル抽出
            const result = this.app.renderer.extract.pixels({ target: tempRT });
            const sourcePixels = result?.pixels || (result instanceof Uint8ClampedArray ? result : new Uint8ClampedArray(result?.buffer || result));

            return {
                width,
                height,
                pixels: new Uint8ClampedArray(sourcePixels)
            };
        } catch (err) {
            console.error('❌ LayerSystem: Failed to create composite snapshot', err);
            return null;
        } finally {
            // 状態復元
            if (bgLayer) bgLayer.visible = oldBgVisible;
            if (this.checkerPattern) this.checkerPattern.visible = oldCheckerVisible;
            tempRT.destroy(true);
        }
    }

    restoreLayerRasterSnapshot(snapshot) {
        if (!snapshot || !this.app?.renderer) return false;

        const normalizedSnapshot = normalizeRasterSnapshot(snapshot, {
            width: this.config?.canvas?.width || 1,
            height: this.config?.canvas?.height || 1
        });
        const layer = this.getLayers().find(candidate => candidate.layerData?.id === normalizedSnapshot.layerId);
        if (!layer?.layerData) return false;

        const layerData = layer.layerData;
        const width = normalizedSnapshot.width;
        const height = normalizedSnapshot.height;
        const rasterBounds = normalizedSnapshot.rasterBounds;
        const maxTextureSize = this._getMaxRenderTextureSize();
        if (
            width > maxTextureSize
            || height > maxTextureSize
            || !this._isRasterBakeSizeAllowed({ width, height })
        ) {
            console.warn('[LayerSystem] raster snapshot restore skipped: exceeds safe texture size', {
                layerId: layerData.id,
                width,
                height,
                maxTextureSize
            });
            return false;
        }
        this._debugValidateRasterSnapshot({
            source: 'restore',
            layerId: layerData.id,
            width,
            height,
            pixels: normalizedSnapshot.pixels,
            rasterBounds
        });

        const expectedPixelBytes = width * height * 4;
        const pixels = new Uint8ClampedArray(normalizedSnapshot.pixels || []);
        if (pixels.length !== expectedPixelBytes) {
            console.warn('[LayerSystem] raster snapshot restore skipped: invalid pixel length', {
                layerId: layerData.id,
                width,
                height,
                expectedPixelBytes,
                actualPixelBytes: pixels.length
            });
            return false;
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) return false;

        try {
            const imageData = new ImageData(pixels, width, height);
            ctx.putImageData(imageData, 0, 0);
        } catch (error) {
            console.warn('[LayerSystem] raster snapshot restore skipped: failed to prepare ImageData', {
                layerId: layerData.id,
                width,
                height,
                error
            });
            return false;
        }

        if (!layerData.renderTexture || layerData.renderTexture.width !== width || layerData.renderTexture.height !== height) {
            if (layerData.renderTexture) {
                layerData.renderTexture.destroy(true);
            }
            layerData.renderTexture = RenderTexture.create({
                width,
                height,
                antialias: true
            });

            if (layerData.layerSprite) {
                layerData.layerSprite.texture = layerData.renderTexture;
            } else {
                layerData.layerSprite = new Sprite(layerData.renderTexture);
                layerData.layerSprite.label = 'layer_raster_sprite';
                layer.addChildAt(layerData.layerSprite, 0);
            }
        }
        layerData.rasterBounds = { ...rasterBounds };
        if (layerData.layerSprite) {
            layerData.layerSprite.position.set(rasterBounds.x, rasterBounds.y);
        }

        let sprite = null;
        try {
            const texture = Texture.from(canvas);
            sprite = new Sprite(texture);

            this.app.renderer.render({
                container: sprite,
                target: layerData.renderTexture,
                clear: true,
                clearColor: [0, 0, 0, 0]
            });
        } catch (error) {
            console.error('[LayerSystem] raster snapshot restore failed during render', {
                layerId: layerData.id,
                width,
                height,
                error
            });
            return false;
        } finally {
            sprite?.destroy({ texture: true, baseTexture: true });
        }

        layerData.pathsData = structuredClone(normalizedSnapshot.pathsData || []);
        layerData.paths = structuredClone(normalizedSnapshot.paths || []);

        const layerIndex = this.getLayerIndex(layer);
        if (layerIndex !== -1) {
            this.requestThumbnailUpdate(layerIndex, true);
        }
        if (this.coordAPI) {
            this.coordAPI.clearCache();
        }
        this._emitPanelUpdateRequest();

        return true;
    }

    ensureLayerRasterBoundsForRect(layer, rect, options = {}) {
        const layerData = layer?.layerData;
        const renderer = this.app?.renderer;
        const oldRT = layerData?.renderTexture;
        if (!layerData || !renderer || !oldRT || layerData.isFolder || layerData.isBackground) {
            return { ok: false, changed: false, bounds: null };
        }

        const padding = Math.max(0, Number(options.padding ?? 0) || 0);
        const rectX = Number(rect?.x);
        const rectY = Number(rect?.y);
        const rectWidth = Number(rect?.width);
        const rectHeight = Number(rect?.height);
        if (
            !Number.isFinite(rectX)
            || !Number.isFinite(rectY)
            || !Number.isFinite(rectWidth)
            || !Number.isFinite(rectHeight)
            || rectWidth <= 0
            || rectHeight <= 0
        ) {
            return { ok: false, changed: false, bounds: null };
        }

        const oldBounds = normalizeRasterBounds(layerData.rasterBounds, {
            width: oldRT.width,
            height: oldRT.height
        });
        oldBounds.width = Math.max(1, Math.round(oldRT.width));
        oldBounds.height = Math.max(1, Math.round(oldRT.height));

        const targetMinX = Math.floor(rectX - padding);
        const targetMinY = Math.floor(rectY - padding);
        const targetMaxX = Math.ceil(rectX + rectWidth + padding);
        const targetMaxY = Math.ceil(rectY + rectHeight + padding);
        const minX = Math.min(oldBounds.x, targetMinX);
        const minY = Math.min(oldBounds.y, targetMinY);
        const maxX = Math.max(oldBounds.x + oldBounds.width, targetMaxX);
        const maxY = Math.max(oldBounds.y + oldBounds.height, targetMaxY);
        const newBounds = {
            x: minX,
            y: minY,
            width: Math.max(1, maxX - minX),
            height: Math.max(1, maxY - minY)
        };

        const unchanged = newBounds.x === oldBounds.x
            && newBounds.y === oldBounds.y
            && newBounds.width === oldBounds.width
            && newBounds.height === oldBounds.height;
        if (unchanged) {
            layerData.rasterBounds = oldBounds;
            layerData.layerSprite?.position.set(oldBounds.x, oldBounds.y);
            return { ok: true, changed: false, bounds: { ...oldBounds } };
        }

        const maxTextureSize = this._getMaxRenderTextureSize();
        if (newBounds.width > maxTextureSize || newBounds.height > maxTextureSize) {
            console.warn('[LayerSystem] raster bounds expansion skipped: exceeds max texture size', {
                layerId: layerData.id,
                requested: newBounds,
                maxTextureSize
            });
            return { ok: false, changed: false, bounds: { ...oldBounds } };
        }

        const newRT = RenderTexture.create({
            width: newBounds.width,
            height: newBounds.height,
            antialias: true
        });
        const oldSprite = new Sprite(oldRT);
        oldSprite.position.set(oldBounds.x - newBounds.x, oldBounds.y - newBounds.y);

        renderer.render({
            container: oldSprite,
            target: newRT,
            clear: true,
            clearColor: [0, 0, 0, 0]
        });

        layerData.renderTexture = newRT;
        layerData.rasterBounds = { ...newBounds };
        if (layerData.layerSprite) {
            layerData.layerSprite.texture = newRT;
            layerData.layerSprite.position.set(newBounds.x, newBounds.y);
            layerData.layerSprite.blendMode = layerData.blendMode || layerData.layerSprite.blendMode;
        } else {
            layerData.layerSprite = new Sprite(newRT);
            layerData.layerSprite.label = 'layer_raster_sprite';
            layerData.layerSprite.position.set(newBounds.x, newBounds.y);
            layer.addChildAt(layerData.layerSprite, 0);
        }

        oldRT.destroy(true);
        oldSprite.destroy({ texture: false, baseTexture: false });

        if (this.coordAPI) this.coordAPI.clearCache();
        this.refreshClippingMasks();
        return { ok: true, changed: true, bounds: { ...newBounds } };
    }

    centerActiveLayerRasterInProjectFrame(options = {}) {
        return this.centerLayerRasterInProjectFrame(this.getActiveLayer(), options);
    }

    centerLayerRasterInProjectFrame(layer, options = {}) {
        const layerData = layer?.layerData;
        if (!layerData?.renderTexture || layerData.isBackground || layerData.isFolder) return false;

        const beforeSnapshot = this.createLayerRasterSnapshot(layer);
        if (!beforeSnapshot?.pixels) return false;

        const bounds = normalizeRasterBounds(beforeSnapshot.rasterBounds, {
            width: beforeSnapshot.width,
            height: beforeSnapshot.height
        });
        const frameWidth = Math.max(1, Math.round(this.config?.canvas?.width || bounds.width));
        const frameHeight = Math.max(1, Math.round(this.config?.canvas?.height || bounds.height));
        const nextBounds = {
            ...bounds,
            x: Math.round((frameWidth - bounds.width) / 2),
            y: Math.round((frameHeight - bounds.height) / 2)
        };

        if (nextBounds.x === bounds.x && nextBounds.y === bounds.y) return false;

        const layerId = layerData.id;
        const isAnimationWorkingLayer = layerData.isAnimationWorkingLayer === true;
        if (isAnimationWorkingLayer) {
            this.eventBus?.emit('drawing:stroke-started', {
                layerId,
                mode: 'raster-recenter',
                source: options.source || 'off-frame-badge'
            });
        }

        const afterSnapshot = {
            ...beforeSnapshot,
            rasterBounds: nextBounds,
            pixels: new Uint8ClampedArray(beforeSnapshot.pixels)
        };

        if (!this.restoreLayerRasterSnapshot(afterSnapshot)) {
            if (isAnimationWorkingLayer) {
                this.eventBus?.emit('drawing:stroke-cancelled', {
                    layerId,
                    mode: 'raster-recenter',
                    source: options.source || 'off-frame-badge'
                });
            }
            return false;
        }

        this.eventBus?.emit('layer:content-changed', {
            layerId,
            source: 'raster-recenter'
        });

        if (isAnimationWorkingLayer) {
            this.eventBus?.emit('drawing:stroke-completed', {
                layerId,
                mode: 'raster-recenter',
                source: options.source || 'off-frame-badge'
            });
            return true;
        }

        if (historyManager && !historyManager.isApplying) {
            const restoreSnapshot = (snapshot) => {
                this.restoreLayerRasterSnapshot(snapshot);
                this.eventBus?.emit('layer:content-changed', {
                    layerId,
                    source: 'raster-recenter-history'
                });
            };
            historyManager.record({
                name: 'layer-raster-recenter',
                do: () => restoreSnapshot(afterSnapshot),
                undo: () => restoreSnapshot(beforeSnapshot),
                meta: {
                    layerId,
                    source: options.source || 'off-frame-badge',
                    beforeBounds: beforeSnapshot.rasterBounds,
                    afterBounds: afterSnapshot.rasterBounds
                },
                byteSize: (beforeSnapshot.pixels?.byteLength || 0)
                    + (afterSnapshot.pixels?.byteLength || 0)
            });
        }

        return true;
    }

    _getMaxRenderTextureSize() {
        const renderer = this.app?.renderer;
        const candidates = [
            renderer?.limits?.maxTextureSize,
            renderer?.texture?.maxTextureSize,
            renderer?.renderPipes?.texture?.maxTextureSize
        ].map(value => Number(value)).filter(value => Number.isFinite(value) && value > 0);
        return Math.max(1, Math.min(...(candidates.length ? candidates : [8192])));
    }

    _debugValidateRasterSnapshot(snapshot) {
        if (!this.config?.debug || !snapshot) return;
        const expectedLength = snapshot.width * snapshot.height * 4;
        const actualLength = snapshot.pixels?.length || 0;
        if (actualLength > 0 && actualLength !== expectedLength) {
            console.warn('[LayerSystem] raster snapshot pixel length mismatch', {
                source: snapshot.source,
                layerId: snapshot.layerId,
                expectedLength,
                actualLength
            });
        }
        const bounds = snapshot.rasterBounds;
        if (!bounds || bounds.width !== snapshot.width || bounds.height !== snapshot.height) {
            console.warn('[LayerSystem] raster bounds size mismatch', {
                source: snapshot.source,
                layerId: snapshot.layerId,
                width: snapshot.width,
                height: snapshot.height,
                rasterBounds: bounds
            });
        }
    }

    _refreshLayerEffectiveAlpha() {
        const layers = this.getLayers();
        const byId = new Map(
            layers
                .filter(layer => layer?.layerData?.id)
                .map(layer => [layer.layerData.id, layer])
        );
        const effectiveAlphaById = new Map();
        const effectiveVisibilityById = new Map();

        const resolveVisibility = (layer) => {
            const data = layer?.layerData;
            if (!data) return false;
            if (effectiveVisibilityById.has(data.id)) return effectiveVisibilityById.get(data.id);

            let visible = data.visible !== false;
            const visited = new Set([data.id]);
            let parentId = data.parentId || null;
            while (visible && parentId && !visited.has(parentId)) {
                visited.add(parentId);
                const parent = byId.get(parentId);
                const parentData = parent?.layerData;
                if (!parentData?.isFolder) break;
                visible = parentData.visible !== false;
                parentId = parentData.parentId || null;
            }
            effectiveVisibilityById.set(data.id, visible);
            return visible;
        };

        const resolveAlpha = (layer) => {
            const data = layer?.layerData;
            if (!data) return 1;
            if (effectiveAlphaById.has(data.id)) return effectiveAlphaById.get(data.id);

            const ownOpacity = data.isAnimationWorkingLayer === true && Number.isFinite(data.effectiveOpacity)
                ? data.effectiveOpacity
                : Number.isFinite(data.opacity)
                ? data.opacity
                : (Number.isFinite(layer.alpha) ? layer.alpha : 1);
            let alpha = Math.max(0, Math.min(1, ownOpacity));
            const visited = new Set([data.id]);
            let parentId = data.parentId || null;

            while (parentId && !visited.has(parentId)) {
                visited.add(parentId);
                const parent = byId.get(parentId);
                const parentData = parent?.layerData;
                if (!parentData?.isFolder) break;
                const parentOpacity = Number.isFinite(parentData.opacity)
                    ? parentData.opacity
                    : (Number.isFinite(parent.alpha) ? parent.alpha : 1);
                alpha *= Math.max(0, Math.min(1, parentOpacity));
                parentId = parentData.parentId || null;
            }

            effectiveAlphaById.set(data.id, alpha);
            return alpha;
        };

        for (const layer of layers) {
            const data = layer?.layerData;
            if (!data || data.isBackground) continue;
            layer.alpha = resolveAlpha(layer);
            layer.visible = resolveVisibility(layer);
        }
    }

    _setupVKeyEvents() {
        if (!this.eventBus) return;

        this.eventBus.on('keyboard:vkey-state-changed', ({ pressed, cancelled = false }) => {
            if (!this.transform) return;
            if (!this.transform.app && this.app && this.cameraSystem) {
                this.initTransform();
            }
            if (this._hasAnimationLayerContext() && !this._canTransformActiveAnimationWorkingLayer()) {
                this.exitLayerMoveMode();
                return;
            }

            if (pressed) {
                this.enterLayerMoveMode();
                const activeLayer = this.getActiveLayer();
                if (activeLayer) {
                    this.transform.updateTransformPanelValues(activeLayer);
                }
            } else {
                this.exitLayerMoveMode({ cancelled });
            }
        });
    }

    initTransform() {
        if (!this.transform || !this.app) return;
        this.transform.init(this.app, this.cameraSystem);
        this.transform.onTransformComplete = (layer) => {
            this.eventBus.emit('layer:transform-confirmed', {layerId: layer.layerData.id});
            this.requestThumbnailUpdate(this.getLayerIndex(layer));
            if (this.animationSystem?.generateFrameThumbnail) {
                const frameIndex = this.animationSystem.getCurrentFrameIndex();
                setTimeout(() => {
                    this.animationSystem.generateFrameThumbnail(frameIndex);
                }, 100);
            }
        };
        this.transform.onTransformUpdate = (layer, transform) => {
            this.requestThumbnailUpdate(this.getLayerIndex(layer));
            this.eventBus.emit('layer:updated', {layerId: layer.layerData.id, transform});
        };
        this.transform.onSliderChange = (sliderId, value) => {
            const activeLayer = this.getActiveLayer();
            if (!activeLayer) return;
            const property = sliderId.replace('layer-', '').replace('-slider', '');
            if (property === 'rotation') {
                value = value * Math.PI / 180;
            }
            this.updateActiveLayerTransform(property, value);
            this.requestThumbnailUpdate(this.activeLayerIndex);
        };
        this.transform.onFlipRequest = (direction) => {
            this.flipActiveLayer(direction, false);
        };
        this.transform.onDragRequest = (dx, dy, shiftKey, dragTransformMode) => {
            this._handleLayerDrag(dx, dy, shiftKey, dragTransformMode);
        };
        this.transform.onGetActiveLayer = () => {
            return this.getActiveLayer();
        };
        this.transform.onRebuildRequired = (layer, paths) => {
            this.safeRebuildLayer(layer, paths);
        };
    }

    getLayerIndex(layer) {
        const layers = this.getLayers();
        return layers.indexOf(layer);
    }

    rebuildPathGraphics(path) {
        try {
            if (path.graphics) {
                try {
                    if (path.graphics.destroy && typeof path.graphics.destroy === 'function') {
                        path.graphics.destroy({ children: true, texture: false, baseTexture: false });
                    }
                } catch (destroyError) {}
                path.graphics = null;
                }
                path.graphics = new Graphics();
                if (!path.points || !Array.isArray(path.points) || path.points.length === 0) {
                return true;
            }

            // WebGL2版ではMeshを使用するため、ここはLegacyフォールバック用
            for (let point of path.points) {
                if (typeof point.x === 'number' && typeof point.y === 'number' &&
                    isFinite(point.x) && isFinite(point.y)) {
                    path.graphics.circle(point.x, point.y, (path.size || 16) / 2);
                    path.graphics.fill({ color: path.color || 0x800000, alpha: path.opacity || 1.0 });
                }
            }
            return true;
        } catch (error) {
            path.graphics = null;
            return false;
        }
    }

    _applyMaskToLayerGraphics(layer) {
        if (!layer.layerData || !layer.layerData.maskSprite) return;

        for (const child of layer.children) {
            if (child === layer.layerData.maskSprite ||
                child === layer.layerData.backgroundGraphics) {
                continue;
            }

            if (child instanceof Graphics || child instanceof Mesh) {
                child.mask = layer.layerData.maskSprite;
            }
        }
    }

    addPathToActiveLayer(path) {
        if (!this.getActiveLayer()) return;
        const activeLayer = this.getActiveLayer();
        const layerIndex = this.activeLayerIndex;

        if (activeLayer.layerData?.isBackground || activeLayer.layerData?.isFolder) return;

        if (activeLayer.layerData && activeLayer.layerData.paths) {
            activeLayer.layerData.paths.push(path);
        }

        this.rebuildPathGraphics(path);
        if (path.graphics) {
            if (activeLayer.layerData && activeLayer.layerData.maskSprite) {
                path.graphics.mask = activeLayer.layerData.maskSprite;
            }
            activeLayer.addChild(path.graphics);
        }

        if (this.eventBus) {
            this.eventBus.emit('layer:stroke-added', { path, layerIndex, layerId: activeLayer.label });
            this.requestThumbnailUpdate(layerIndex);
        }
    }

    addPathToLayer(layerIndex, path) {
        const layers = this.getLayers();
        if (layerIndex >= 0 && layerIndex < layers.length) {
            const layer = layers[layerIndex];

            if (layer.layerData?.isBackground || layer.layerData?.isFolder) return;

            layer.layerData.paths.push(path);
            layer.addChild(path.graphics);

            if (this.eventBus) {
                this.eventBus.emit('layer:path-added', { layerIndex, pathId: path.id, layerId: layer.layerData.id });
                this.requestThumbnailUpdate(layerIndex);
            }
        }
    }

    enterLayerMoveMode() {
        if (!this.transform) return;
        const activeLayer = this.getActiveLayer();
        if (!activeLayer?.layerData || activeLayer.layerData.isBackground) return;
        if (activeLayer.layerData.isFolder && !this._isFolderWithRasterTargets(activeLayer)) return;

        const layerId = activeLayer.layerData.id;
        const transform = this.transform.getTransform(layerId)
            || { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 };
        this._layerTransformSession = {
            layerId,
            transform: structuredClone(transform),
            targetLayerTransforms: this._captureFolderTargetTransformState(activeLayer)
        };
        this.transform.enterMoveMode();
    }

    _isFolderWithRasterTargets(folderLayer) {
        return this._getFolderRasterLayers(folderLayer).length > 0;
    }

    _getFolderRasterLayers(folderLayer) {
        const folderId = folderLayer?.layerData?.id;
        if (!folderId || !folderLayer.layerData.isFolder) return [];
        const targets = this.getFolderSelectionTargets(folderId);
        return (targets?.entries || [])
            .filter(entry => entry.type === 'raster' && entry.layer?.layerData?.renderTexture)
            .map(entry => entry.layer);
    }

    _captureFolderTargetTransformState(folderLayer) {
        if (!folderLayer?.layerData?.isFolder) return [];
        const layers = [folderLayer, ...this._getFolderRasterLayers(folderLayer)];
        return layers.map(layer => ({
            layerId: layer.layerData.id,
            transform: structuredClone(
                this.transform?.getTransform?.(layer.layerData.id)
                    || { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 }
            ),
            display: {
                x: layer.position?.x || 0,
                y: layer.position?.y || 0,
                rotation: layer.rotation || 0,
                scaleX: layer.scale?.x || 1,
                scaleY: layer.scale?.y || 1,
                pivotX: layer.pivot?.x || 0,
                pivotY: layer.pivot?.y || 0
            }
        }));
    }

    _restoreFolderTargetTransformState(records = []) {
        if (!Array.isArray(records) || records.length === 0) return;
        const byId = new Map(
            this.getLayers()
                .filter(layer => layer?.layerData?.id)
                .map(layer => [layer.layerData.id, layer])
        );
        for (const record of records) {
            const layer = byId.get(record.layerId);
            if (!layer) continue;
            this.transform?.setTransform?.(record.layerId, structuredClone(record.transform));
            const display = record.display || {};
            layer.position?.set?.(display.x || 0, display.y || 0);
            layer.rotation = display.rotation || 0;
            layer.scale?.set?.(
                Number.isFinite(display.scaleX) ? display.scaleX : 1,
                Number.isFinite(display.scaleY) ? display.scaleY : 1
            );
            layer.pivot?.set?.(display.pivotX || 0, display.pivotY || 0);
        }
    }

    _resetDisplayTransform(layer) {
        if (!layer) return;
        layer.position?.set?.(0, 0);
        layer.rotation = 0;
        layer.scale?.set?.(1, 1);
        layer.pivot?.set?.(0, 0);
    }

    _applyFolderPreviewTransform(folderLayer, transform) {
        if (!folderLayer?.layerData?.isFolder || !this.transform) return false;
        const layerId = folderLayer.layerData.id;
        const nextTransform = structuredClone(transform || this.transform.getTransform(layerId)
            || { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 });
        this.transform.setTransform(layerId, nextTransform);
        this._resetDisplayTransform(folderLayer);

        const centerX = this.config.canvas.width / 2;
        const centerY = this.config.canvas.height / 2;
        for (const targetLayer of this._getFolderRasterLayers(folderLayer)) {
            this.transform.setTransform(targetLayer.layerData.id, structuredClone(nextTransform));
            this.transform.applyTransform(targetLayer, nextTransform, centerX, centerY);
        }
        this.transform.updateTransformPanelValues(folderLayer);
        this.transform.updateFlipButtons(folderLayer);
        this.coordAPI?.clearCache?.();
        this.eventBus?.emit('layer:updated', { layerId, transform: structuredClone(nextTransform) });
        return true;
    }

    exitLayerMoveMode(options = {}) {
        if (!this.transform) return;
        const cancelled = options.cancelled === true;
        const sessionLayer = this._layerTransformSession?.layerId
            ? this.getLayers().find(layer => layer.layerData?.id === this._layerTransformSession.layerId)
            : null;
        const activeLayer = sessionLayer || this.getActiveLayer();
        if (!cancelled && !options.deferredForBusyIndicator && !this._folderTransformConfirmDeferred && activeLayer?.layerData?.isFolder) {
            const targetCount = this._getFolderRasterLayers(activeLayer).length;
            if (targetCount > 1) {
                this._folderTransformConfirmDeferred = true;
                this._showOperationIndicator(`フォルダ変形を確定中... ${targetCount} layers`);
                requestAnimationFrame(() => {
                    setTimeout(() => {
                        this.exitLayerMoveMode({
                            ...options,
                            deferredForBusyIndicator: true
                        });
                    }, 0);
                });
                return;
            }
        }
        let transformConfirmed = false;

        try {
            if (cancelled) {
                this._restoreLayerTransformSession(activeLayer);
            } else {
                transformConfirmed = this.confirmLayerTransform() === true;
            }
        } catch (error) {
            console.error('[LayerSystem] Failed to confirm layer transform:', error);
        } finally {
            this.transform.exitMoveMode(activeLayer);
            if (this.cameraSystem?.setVKeyPressed) {
                this.cameraSystem.setVKeyPressed(false);
            }
            const layerIndex = this.getLayerIndex(activeLayer);
            if (layerIndex !== -1) {
                this.requestThumbnailUpdate(layerIndex, true);
            }
            if (this.coordAPI) {
                this.coordAPI.clearCache();
            }
            if (this.eventBus) {
                this.eventBus.emit('layer:transform-exit', {
                    layerId: activeLayer?.layerData?.id || null,
                    confirmed: transformConfirmed,
                    cancelled
                });
                this._emitPanelUpdateRequest();
            }
            this._layerTransformSession = null;
            this._folderTransformConfirmDeferred = false;
            this._hideOperationIndicator();
        }
    }

    _showOperationIndicator(message) {
        if (typeof document === 'undefined') return;
        let indicator = document.getElementById('tegaki-operation-indicator');
        if (!indicator) {
            indicator = document.createElement('div');
            indicator.id = 'tegaki-operation-indicator';
            indicator.className = 'tegaki-operation-indicator';
            indicator.innerHTML = '<span class="tegaki-operation-spinner"></span><span class="tegaki-operation-text"></span>';
            document.body.appendChild(indicator);
        }
        const text = indicator.querySelector('.tegaki-operation-text');
        if (text) text.textContent = message || '処理中...';
        indicator.classList.add('show');
    }

    _hideOperationIndicator() {
        const indicator = typeof document !== 'undefined'
            ? document.getElementById('tegaki-operation-indicator')
            : null;
        indicator?.classList.remove('show');
    }

    clearClippingMasks() {
        for (const layer of this.getLayers()) {
            this._clearLayerClippingMask(layer);
        }
    }

    _restoreLayerTransformSession(layer) {
        const session = this._layerTransformSession;
        if (!session || !layer?.layerData || layer.layerData.id !== session.layerId) return false;
        if (layer.layerData.isFolder) {
            this._restoreFolderTargetTransformState(session.targetLayerTransforms);
            this.transform.updateTransformPanelValues(layer);
            this.transform.updateFlipButtons(layer);
            this.coordAPI?.clearCache?.();
            this.requestThumbnailUpdate(this.getLayerIndex(layer), true);
            return true;
        }

        const transform = structuredClone(session.transform);
        this.transform.setTransform(session.layerId, transform);
        if (this.transform._isTransformNonDefault(transform)) {
            this.transform.applyTransform(
                layer,
                transform,
                this.config.canvas.width / 2,
                this.config.canvas.height / 2
            );
        } else {
            layer.position.set(0, 0);
            layer.rotation = 0;
            layer.scale.set(1, 1);
            layer.pivot.set(0, 0);
        }
        this.transform.updateTransformPanelValues(layer);
        this.transform.updateFlipButtons(layer);
        this.coordAPI?.clearCache?.();
        this.requestThumbnailUpdate(this.getLayerIndex(layer), true);
        return true;
    }

    toggleLayerMoveMode() {
        if (!this.transform) return;
        if (this.isLayerMoveMode) {
            this.exitLayerMoveMode();
        } else {
            this.enterLayerMoveMode();
        }
    }

    get isLayerMoveMode() {
        return this.transform?.isVKeyPressed || false;
    }

    get vKeyPressed() {
        return this.transform?.isVKeyPressed || false;
    }

    updateActiveLayerTransform(property, value) {
        if (!this.transform) return;
        const activeLayer = this.getActiveLayer();
        if (activeLayer) {
            this.transform.updateTransform(activeLayer, property, value);
            if (activeLayer.layerData?.isFolder) {
                const transform = this.transform.getTransform(activeLayer.layerData.id);
                this._applyFolderPreviewTransform(activeLayer, transform);
            }
        }
    }

    flipActiveLayer(direction, bypassVKeyCheck = false) {
        if (!this.transform) return;
        const activeLayer = this.getActiveLayer();
        if (!activeLayer?.layerData) return;
        if (activeLayer.layerData.isBackground) return;

        if (!bypassVKeyCheck && !this.isLayerMoveMode) return;

        if (activeLayer.layerData.isFolder) {
            const layerId = activeLayer.layerData.id;
            const transformBefore = structuredClone(
                this.transform.getTransform(layerId)
                    || { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 }
            );
            const transformAfter = structuredClone(transformBefore);
            if (direction === 'horizontal') {
                transformAfter.scaleX *= -1;
            } else if (direction === 'vertical') {
                transformAfter.scaleY *= -1;
            } else {
                return;
            }
            this._applyFolderPreviewTransform(activeLayer, transformAfter);
            this.eventBus?.emit('layer:transform-updated', { layerId });
            return;
        }

        const layerId = activeLayer.layerData.id;
        const layerIndex = this.activeLayerIndex;
        const centerX = this.config.canvas.width / 2;
        const centerY = this.config.canvas.height / 2;
        const createDefaultTransform = () => ({ x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 });
        const applyFlipState = (transformState) => {
            const nextState = structuredClone(transformState);
            this.transform.setTransform(layerId, nextState);
            this.transform.applyTransform(activeLayer, nextState, centerX, centerY);
            this.transform.updateTransformPanelValues?.(activeLayer);
            this.transform.updateFlipButtons?.(activeLayer);
            try {
                this.app?.renderer?.render?.({ container: this.app.stage });
            } catch (error) {
                if (this.config?.debug) {
                    console.warn('[LayerSystem] Immediate flip render failed:', error);
                }
            }
            this.requestThumbnailUpdate(layerIndex, true);

            if (this.eventBus) {
                this.eventBus.emit('layer:transform-updated', { layerId });
                this.eventBus.emit('layer:updated', {
                    layerId,
                    transform: structuredClone(nextState)
                });
            }
        };

        if (historyManager && !historyManager.isApplying) {
            const transformBefore = structuredClone(this.transform.getTransform(layerId) || createDefaultTransform());

            const transform = structuredClone(transformBefore);

            if (direction === 'horizontal') {
                transform.scaleX *= -1;
            } else if (direction === 'vertical') {
                transform.scaleY *= -1;
            }

            const transformAfter = structuredClone(transform);
            applyFlipState(transformAfter);

            historyManager.record({
                name: `layer-flip-${direction}`,
                do: () => applyFlipState(transformAfter),
                undo: () => applyFlipState(transformBefore),
                meta: {
                    layerId,
                    layerIndex,
                    direction
                }
            });
        } else {
            const transform = structuredClone(this.transform.getTransform(layerId) || createDefaultTransform());
            if (direction === 'horizontal') {
                transform.scaleX *= -1;
            } else if (direction === 'vertical') {
                transform.scaleY *= -1;
            }
            applyFlipState(transform);
        }
    }

    moveActiveLayer(keyCode) {
        if (!this.transform) return;
        const activeLayer = this.getActiveLayer();
        if (activeLayer) {
            this.transform.moveLayer(activeLayer, keyCode);
            if (activeLayer.layerData?.isFolder) {
                const transform = this.transform.getTransform(activeLayer.layerData.id);
                this._applyFolderPreviewTransform(activeLayer, transform);
            }
            this.requestThumbnailUpdate(this.activeLayerIndex);
        }
    }

    transformActiveLayer(keyCode) {
        if (!this.transform) return;
        const activeLayer = this.getActiveLayer();
        if (!activeLayer) return;
        if (keyCode === 'ArrowUp' || keyCode === 'ArrowDown') {
            this.transform.scaleLayer(activeLayer, keyCode);
        } else if (keyCode === 'ArrowLeft' || keyCode === 'ArrowRight') {
            this.transform.rotateLayer(activeLayer, keyCode);
        }
        if (activeLayer.layerData?.isFolder) {
            const transform = this.transform.getTransform(activeLayer.layerData.id);
            this._applyFolderPreviewTransform(activeLayer, transform);
        }
        this.requestThumbnailUpdate(this.activeLayerIndex);
    }

    confirmLayerTransform(layerOverride = null) {
        if (!this.transform) return false;
        const activeLayer = layerOverride || this.getActiveLayer();
        if (!activeLayer?.layerData) return false;
        if (activeLayer.layerData.isFolder) {
            return this._confirmFolderTransform(activeLayer);
        }
        const layerId = activeLayer.layerData.id;
        const transformBefore = structuredClone(this.transform.getTransform(layerId));

        if (this.transform._isTransformNonDefault(transformBefore)) {
            const beforeSnapshot = this.createLayerRasterSnapshot(activeLayer);
            const integerTranslation = resolveIntegerTranslation(transformBefore);

            if (integerTranslation && beforeSnapshot) {
                if (integerTranslation.dx === 0 && integerTranslation.dy === 0) {
                    activeLayer.position.set(0, 0);
                    activeLayer.rotation = 0;
                    activeLayer.scale.set(1, 1);
                    activeLayer.pivot.set(0, 0);
                    this.transform.setTransform(
                        layerId,
                        { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 }
                    );
                    return true;
                }
                const roundedTransform = {
                    x: integerTranslation.dx,
                    y: integerTranslation.dy,
                    rotation: 0,
                    scaleX: 1,
                    scaleY: 1
                };
                const translatedSnapshot = {
                    ...beforeSnapshot,
                    rasterBounds: translateRasterBounds(
                        beforeSnapshot.rasterBounds,
                        integerTranslation.dx,
                        integerTranslation.dy,
                        {
                            width: beforeSnapshot.width,
                            height: beforeSnapshot.height
                        }
                    ),
                    pixels: new Uint8ClampedArray(beforeSnapshot.pixels)
                };

                if (activeLayer.layerData.paths && activeLayer.layerData.paths.length > 0) {
                    this.transform.applyTransformToPaths(activeLayer, roundedTransform);
                    translatedSnapshot.paths = structuredClone(activeLayer.layerData.paths);
                }

                activeLayer.position.set(0, 0);
                activeLayer.rotation = 0;
                activeLayer.scale.set(1, 1);
                activeLayer.pivot.set(0, 0);
                this.transform.setTransform(
                    layerId,
                    { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 }
                );
                if (!this.restoreLayerRasterSnapshot(translatedSnapshot)) {
                    this.restoreLayerRasterSnapshot(beforeSnapshot);
                    return false;
                }
            } else {
                // 回転・拡縮・flip・複合変形は、変形後AABBへ拡張して焼き込む。
                if (!this.bakeTransform(activeLayer, transformBefore, beforeSnapshot)) {
                    this.restoreLayerRasterSnapshot(beforeSnapshot);
                    return false;
                }

                // 互換性のためパスデータも変形適用（ベクトルデータが残っている場合）
                if (activeLayer.layerData.paths && activeLayer.layerData.paths.length > 0) {
                    this.transform.applyTransformToPaths(activeLayer, transformBefore);
                }
            }

            // 焼き込み後の状態を反映させるためにリビルド（レイヤーSpriteは保護される）
            const rebuildSuccess = this.safeRebuildLayer(activeLayer, activeLayer.layerData.paths);
            this.refreshClippingMasks();

            // 座標変換キャッシュをクリア
            if (this.coordAPI) {
                this.coordAPI.clearCache();
            }

            const shouldRecordNormalLayerHistory = activeLayer.layerData.isAnimationWorkingLayer !== true;
            if (shouldRecordNormalLayerHistory && rebuildSuccess && historyManager && !historyManager.isApplying && beforeSnapshot) {
                const afterSnapshot = this.createLayerRasterSnapshot(activeLayer);
                const transformAfter = { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 };

                if (afterSnapshot) {
                    const applyTransformSnapshot = (snapshot, transformState) => {
                        const targetLayer = this.getLayers().find(layer => layer.layerData?.id === layerId);
                        if (!targetLayer?.layerData) return;

                        this.restoreLayerRasterSnapshot(snapshot);
                        this.transform.setTransform(layerId, structuredClone(transformState));
                        if (this.transform._isTransformNonDefault(transformState)) {
                            const centerX = this.config.canvas.width / 2;
                            const centerY = this.config.canvas.height / 2;
                            this.transform.applyTransform(targetLayer, transformState, centerX, centerY);
                        } else {
                            targetLayer.position.set(0, 0);
                            targetLayer.rotation = 0;
                            targetLayer.scale.set(1, 1);
                            targetLayer.pivot.set(0, 0);
                        }
                        this.refreshClippingMasks();
                        if (this.coordAPI) this.coordAPI.clearCache();
                        this.requestThumbnailUpdate(this.getLayerIndex(targetLayer), true);
                    };

                    const entry = {
                        name: 'layer-transform',
                        do: () => applyTransformSnapshot(afterSnapshot, transformAfter),
                        undo: () => applyTransformSnapshot(beforeSnapshot, transformAfter),
                        meta: {
                            layerId,
                            type: 'transform',
                            requestedTransform: transformBefore,
                            transformBefore: transformAfter,
                            transformAfter
                        },
                        byteSize: (beforeSnapshot.pixels?.byteLength || 0)
                            + (afterSnapshot.pixels?.byteLength || 0)
                    };
                    historyManager.record(entry);
                }
            }
            return rebuildSuccess;
        }
        return false;
    }

    _confirmFolderTransform(folderLayer) {
        if (!folderLayer?.layerData?.isFolder || !this.transform) return false;
        const folderId = folderLayer.layerData.id;
        const transformBefore = structuredClone(
            this.transform.getTransform(folderId)
                || { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 }
        );
        if (!this.transform._isTransformNonDefault(transformBefore)) return false;

        const targets = this._getFolderRasterLayers(folderLayer);
        if (targets.length === 0) return false;

        const beforeSnapshots = targets
            .map(layer => this.createLayerRasterSnapshot(layer))
            .filter(Boolean);
        if (beforeSnapshots.length !== targets.length) return false;

        const integerTranslation = resolveIntegerTranslation(transformBefore);
        const centerX = this.config.canvas.width / 2;
        const centerY = this.config.canvas.height / 2;
        const affectedLayerIds = targets.map(layer => layer.layerData.id);
        const resetTransform = { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 };
        let success = true;

        if (integerTranslation) {
            for (let index = 0; index < targets.length; index++) {
                const targetLayer = targets[index];
                const beforeSnapshot = beforeSnapshots[index];
                const translatedSnapshot = {
                    ...beforeSnapshot,
                    rasterBounds: translateRasterBounds(
                        beforeSnapshot.rasterBounds,
                        integerTranslation.dx,
                        integerTranslation.dy,
                        {
                            width: beforeSnapshot.width,
                            height: beforeSnapshot.height
                        }
                    ),
                    pixels: new Uint8ClampedArray(beforeSnapshot.pixels)
                };

                if (targetLayer.layerData.paths && targetLayer.layerData.paths.length > 0) {
                    this.transform.applyTransformToPaths(targetLayer, transformBefore);
                    translatedSnapshot.paths = structuredClone(targetLayer.layerData.paths);
                }

                this._resetDisplayTransform(targetLayer);
                this.transform.setTransform(targetLayer.layerData.id, structuredClone(resetTransform));
                success = this.restoreLayerRasterSnapshot(translatedSnapshot) && success;
            }
        } else {
            for (let index = 0; index < targets.length; index++) {
                const targetLayer = targets[index];
                const beforeSnapshot = beforeSnapshots[index];
                this.transform.setTransform(targetLayer.layerData.id, structuredClone(transformBefore));
                if (!this.bakeTransform(targetLayer, transformBefore, beforeSnapshot)) {
                    this.transform.setTransform(targetLayer.layerData.id, structuredClone(resetTransform));
                    this._resetDisplayTransform(targetLayer);
                    success = false;
                    continue;
                }
                if (targetLayer.layerData.paths && targetLayer.layerData.paths.length > 0) {
                    this.transform.applyTransformToPaths(targetLayer, transformBefore);
                }
                success = this.safeRebuildLayer(targetLayer, targetLayer.layerData.paths) && success;
                this.transform.setTransform(targetLayer.layerData.id, structuredClone(resetTransform));
                this._resetDisplayTransform(targetLayer);
            }
        }

        this.transform.setTransform(folderId, structuredClone(resetTransform));
        this._resetDisplayTransform(folderLayer);
        this.refreshClippingMasks();
        this.coordAPI?.clearCache?.();

        if (!success) {
            for (const snapshot of beforeSnapshots) {
                this.restoreLayerRasterSnapshot(snapshot);
                this.transform.setTransform(snapshot.layerId, structuredClone(resetTransform));
                const targetLayer = this.getLayers().find(layer => layer.layerData?.id === snapshot.layerId);
                this._resetDisplayTransform(targetLayer);
            }
            this.transform.setTransform(folderId, structuredClone(resetTransform));
            this._resetDisplayTransform(folderLayer);
            return false;
        }

        const afterSnapshots = targets
            .map(layer => this.createLayerRasterSnapshot(layer))
            .filter(Boolean);

        const restoreSnapshots = (snapshots) => {
            let restoredAll = true;
            for (const snapshot of snapshots) {
                restoredAll = this.restoreLayerRasterSnapshot(snapshot) && restoredAll;
                this.transform.setTransform(snapshot.layerId, structuredClone(resetTransform));
                const targetLayer = this.getLayers().find(layer => layer.layerData?.id === snapshot.layerId);
                this._resetDisplayTransform(targetLayer);
                this.requestThumbnailUpdate(this.getLayerIndex(targetLayer), true);
            }
            this.transform.setTransform(folderId, structuredClone(resetTransform));
            this._resetDisplayTransform(folderLayer);
            this.refreshClippingMasks();
            this.coordAPI?.clearCache?.();
            this._emitPanelUpdateRequest();
            return restoredAll;
        };

        if (afterSnapshots.length === targets.length && historyManager && !historyManager.isApplying) {
            historyManager.record({
                name: 'folder-transform',
                do: () => restoreSnapshots(afterSnapshots),
                undo: () => restoreSnapshots(beforeSnapshots),
                byteSize: beforeSnapshots.reduce((total, snapshot, index) => {
                    return total
                        + (snapshot.pixels?.byteLength || 0)
                        + (afterSnapshots[index]?.pixels?.byteLength || 0);
                }, 0),
                meta: {
                    type: 'folder-transform',
                    folderId,
                    layerIds: affectedLayerIds,
                    requestedTransform: transformBefore
                }
            });
        }

        for (const layerId of affectedLayerIds) {
            this.eventBus?.emit('layer:content-changed', {
                layerId,
                source: 'folder-transform'
            });
        }
        this.eventBus?.emit('layer:transform-confirmed', { layerId: folderId });
        this._emitPanelUpdateRequest();
        return true;
    }

    updateLayerTransformPanelValues() {
        if (!this.transform) return;
        const activeLayer = this.getActiveLayer();
        if (activeLayer) {
            this.transform.updateTransformPanelValues(activeLayer);
        }
    }

    updateFlipButtons() {
        if (!this.transform) return;
        const activeLayer = this.getActiveLayer();
        if (activeLayer) {
            this.transform.updateFlipButtons(activeLayer);
        }
    }

    updateCursor() {
        if (this.transform) {
            this.transform._updateCursor();
        }
    }

    _handleLayerDrag(dx, dy, shiftKey, dragTransformMode = null) {
        if (!this.transform) return;
        const activeLayer = this.getActiveLayer();
        if (!activeLayer?.layerData) return;
        const layerId = activeLayer.layerData.id;
        let transform = this.transform.getTransform(layerId);
        if (!transform) {
            transform = { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 };
            this.transform.setTransform(layerId, transform);
        }
        const centerX = this.config.canvas.width / 2;
        const centerY = this.config.canvas.height / 2;
        if (shiftKey) {
            if (dragTransformMode === 'scale') {
                const scaleFactor = 1 + (dy * -0.01);
                const currentScale = Math.abs(transform.scaleX);
                const newScale = Math.max(this.config.layer.minScale, Math.min(this.config.layer.maxScale, currentScale * scaleFactor));
                transform.scaleX = transform.scaleX < 0 ? -newScale : newScale;
                transform.scaleY = transform.scaleY < 0 ? -newScale : newScale;
            } else if (dragTransformMode === 'rotate') {
                transform.rotation += (dx * 0.02);
            } else {
                return;
            }
        } else {
            transform.x += dx;
            transform.y += dy;
        }
        if (activeLayer.layerData.isFolder) {
            this._applyFolderPreviewTransform(activeLayer, transform);
        } else {
            this.transform.applyTransform(activeLayer, transform, centerX, centerY);
            this._scheduleTransformInteractionUpdate(layerId, transform);
        }
    }

    _scheduleTransformInteractionUpdate(layerId, transform) {
        this._pendingTransformInteraction = {
            layerId,
            transform: {
                x: Number(transform?.x) || 0,
                y: Number(transform?.y) || 0,
                rotation: Number(transform?.rotation) || 0,
                scaleX: Number(transform?.scaleX) || 1,
                scaleY: Number(transform?.scaleY) || 1
            }
        };
        if (this._transformInteractionFrame !== null) return;

        this._transformInteractionFrame = requestAnimationFrame(() => {
            this._transformInteractionFrame = null;
            const pending = this._pendingTransformInteraction;
            this._pendingTransformInteraction = null;
            if (!pending) return;

            const layer = this.getLayerById?.(pending.layerId) || null;
            if (!layer) return;
            const currentTransform = this.transform?.getTransform?.(pending.layerId)
                || pending.transform;
            this.transform?.updateTransformPanelValues?.(layer);
            this.eventBus?.emit('layer:updated', {
                layerId: pending.layerId,
                transform: {
                    x: Number(currentTransform?.x) || 0,
                    y: Number(currentTransform?.y) || 0,
                    rotation: Number(currentTransform?.rotation) || 0,
                    scaleX: Number(currentTransform?.scaleX) || 1,
                    scaleY: Number(currentTransform?.scaleY) || 1
                }
            });
            this.requestThumbnailUpdate(this.getLayerIndex(layer));
        });
    }

    safeRebuildLayer(layer, newPaths) {
        try {
            const childrenToRemove = [];
            for (let child of layer.children) {
                if (child !== layer.layerData.backgroundGraphics &&
                    child !== layer.layerData.maskSprite &&
                    child !== layer.layerData.layerSprite) { // 🆕 Raster Spriteを保護
                    childrenToRemove.push(child);
                }
            }
            childrenToRemove.forEach(child => {
                try {
                    layer.removeChild(child);
                    if (child.destroy && typeof child.destroy === 'function') {
                        child.destroy({ children: true, texture: false, baseTexture: false });
                    }
                } catch (removeError) {}
            });
            layer.layerData.paths = [];
            let addedCount = 0;
            for (let i = 0; i < newPaths.length; i++) {
                const path = newPaths[i];
                try {
                    const rebuildSuccess = this.rebuildPathGraphics(path);
                    if (rebuildSuccess && path.graphics) {
                        if (layer.layerData && layer.layerData.maskSprite) {
                            path.graphics.mask = layer.layerData.maskSprite;
                        }
                        layer.layerData.paths.push(path);
                        layer.addChild(path.graphics);
                        addedCount++;
                    }
                } catch (pathError) {}
            }
            return addedCount > 0 || newPaths.length === 0;
        } catch (error) {
            return false;
        }
    }
    reorderLayers(fromIndex, toIndex) {
        const layers = this.getLayers();
        if (fromIndex < 0 || fromIndex >= layers.length || toIndex < 0 || toIndex >= layers.length || fromIndex === toIndex) {
            return false;
        }
        try {
            const movedLayer = layers[fromIndex];
            const oldActiveIndex = this.activeLayerIndex;
            if (historyManager && !historyManager.isApplying) {
                const entry = {
                    name: 'layer-reorder',
                    do: () => {
                        const layers = this.getLayers();
                        const layer = layers[fromIndex];
                        this._moveLayerObjectToIndex(layer, toIndex);
                        this._finalizeLayerReorder(layer);
                        this._emitPanelUpdateRequest();
                        if (this.eventBus) {
                            this.eventBus.emit('layer:reordered', { fromIndex, toIndex, activeIndex: this.activeLayerIndex, movedLayerId: layer.layerData?.id });
                        }
                    },
                    undo: () => {
                        const layers = this.getLayers();
                        const layer = layers.find(l => l.layerData?.id === movedLayer.layerData?.id);
                        this._moveLayerObjectToIndex(layer, fromIndex);
                        this._finalizeLayerReorder(layer);
                        this.activeLayerIndex = oldActiveIndex;
                        this._emitPanelUpdateRequest();
                        if (this.eventBus) {
                            this.eventBus.emit('layer:reordered', { fromIndex: toIndex, toIndex: fromIndex, activeIndex: this.activeLayerIndex, movedLayerId: layer.layerData?.id });
                        }
                    },
                    meta: { fromIndex, toIndex }
                };
                historyManager.push(entry);
            } else {
                this._moveLayerObjectToIndex(movedLayer, toIndex);
                this._finalizeLayerReorder(movedLayer);
                this._emitPanelUpdateRequest();
                if (this.eventBus) {
                    this.eventBus.emit('layer:reordered', { fromIndex, toIndex, activeIndex: this.activeLayerIndex, movedLayerId: movedLayer.layerData?.id });
                }
            }
            return true;
        } catch (error) {
            return false;
        }
    }

    setCurrentFrameContainer(frameContainer) {
        this.currentFrameContainer = frameContainer;
        const layers = this.getLayers();
        if (layers.length > 0) {
            this.activeLayerIndex = layers.length - 1;
        }

        this._emitPanelUpdateRequest();
        this._emitStatusUpdateRequest();
        if (this.isLayerMoveMode) {
            this.updateLayerTransformPanelValues();
        }
    }

    createFrameRenderTexture(frameId) {
        if (!this.app?.renderer) return null;
        const renderTexture = RenderTexture.create({
            width: this.config.canvas.width,
            height: this.config.canvas.height
        });
        this.frameRenderTextures.set(frameId, renderTexture);
        this.frameThumbnailDirty.set(frameId, true);
        return renderTexture;
    }

    renderFrameToTexture(frameId, frameContainer) {
        if (!this.app?.renderer) return;

        const currentWidth = this.config.canvas.width;
        const currentHeight = this.config.canvas.height;

        const oldTexture = this.frameRenderTextures.get(frameId);
        if (oldTexture) {
            oldTexture.destroy(true);
        }

        const renderTexture = RenderTexture.create({
            width: currentWidth,
            height: currentHeight
        });

        this.frameRenderTextures.set(frameId, renderTexture);

        const container = frameContainer || this.currentFrameContainer;
        if (!container) return;

        this.app.renderer.render({
            container: container,
            target: renderTexture,
            clear: true
        });

        this.markFrameThumbnailDirty(frameId);
    }

    markFrameThumbnailDirty(frameId) {
        this.frameThumbnailDirty.set(frameId, true);
        if (this.eventBus) {
            this.eventBus.emit('frame:updated', { frameId: frameId });
        }
    }

    getFrameRenderTexture(frameId) {
        return this.frameRenderTextures.get(frameId);
    }

    destroyFrameRenderTexture(frameId) {
        const renderTexture = this.frameRenderTextures.get(frameId);
        if (renderTexture) {
            renderTexture.destroy(true);
            this.frameRenderTextures.delete(frameId);
            this.frameThumbnailDirty.delete(frameId);
        }
    }

    isFrameThumbnailDirty(frameId) {
        return this.frameThumbnailDirty.get(frameId) || false;
    }

    clearFrameThumbnailDirty(frameId) {
        this.frameThumbnailDirty.set(frameId, false);
    }

    getLayers() {
        return this.currentFrameContainer ? this.currentFrameContainer.children : [];
    }

    getActiveLayer() {
        const layers = this.getLayers();
        return this.activeLayerIndex >= 0 && this.activeLayerIndex < layers.length ? layers[this.activeLayerIndex] : null;
    }

    _setupAnimationSystemIntegration() {
        if (!this.eventBus) return;
        this.eventBus.on('animation:system-ready', () => {
            this._establishAnimationSystemConnection();
        });
        this.eventBus.on('animation:frame-applied', () => {
            setTimeout(() => {
                this._emitPanelUpdateRequest();
                this._emitStatusUpdateRequest();
                if (this.isLayerMoveMode) {
                    this.updateLayerTransformPanelValues();
                }
            }, 100);
        });
        this.eventBus.on('animation:frame-created', () => {
            setTimeout(() => {
                this._emitPanelUpdateRequest();
            }, 100);
        });
        this.eventBus.on('animation:frame-deleted', () => {
            setTimeout(() => {
                this._emitPanelUpdateRequest();
            }, 100);
        });
    }

    _establishAnimationSystemConnection() {
        if (window.TegakiAnimationSystem && !this.animationSystem) {
            const possibleInstances = [
                window.animationSystem,
                window.coreEngine?.animationSystem,
                window.TegakiCoreEngine?.animationSystem
            ];
            for (let instance of possibleInstances) {
                if (instance && typeof instance.getCurrentFrame === 'function') {
                    this.animationSystem = instance;
                    break;
                }
            }
            if (this.animationSystem && this.animationSystem.layerSystem !== this) {
                this.animationSystem.layerSystem = this;
            }
        }
    }

    _setupLayerOperations() {
        if (!this.eventBus) return;

        this.eventBus.on('layer:copy-request', () => {
            if (this._hasAnimationLayerContext()) {
                const table = window.PopupManager?.get?.('animationTable')
                    || window.coreEngine?.popupManager?.get?.('animationTable');
                table?.copyInternalLayer?.();
                return;
            }
            if (window.drawingClipboard) {
                window.drawingClipboard.copyActiveLayer();
            }
        });

        this.eventBus.on('layer:paste-request', () => {
            if (this._hasAnimationLayerContext()) {
                const table = window.PopupManager?.get?.('animationTable')
                    || window.coreEngine?.popupManager?.get?.('animationTable');
                table?.pasteInternalLayer?.();
                return;
            }
            if (window.drawingClipboard) {
                window.drawingClipboard.pasteLayer();
            }
        });

        this.eventBus.on('layer:flip-by-key', ({ direction }) => {
            if (this._hasAnimationLayerContext() && !this._canTransformActiveAnimationWorkingLayer()) return;
            this.flipActiveLayer(direction, false);
        });

        this.eventBus.on('layer:flip-requested', ({ direction, bypassVKeyCheck = true }) => {
            if (this._hasAnimationLayerContext() && !this._canTransformActiveAnimationWorkingLayer()) return;
            this.flipActiveLayer(direction, bypassVKeyCheck);
        });

        this.eventBus.on('layer:move-by-key', ({ direction }) => {
            if (this._hasAnimationLayerContext() && !this._canTransformActiveAnimationWorkingLayer()) return;
            this.moveActiveLayer(direction);
        });

        this.eventBus.on('layer:scale-by-key', ({ direction }) => {
            if (this._hasAnimationLayerContext() && !this._canTransformActiveAnimationWorkingLayer()) return;
            this.transformActiveLayer(direction);
        });

        this.eventBus.on('layer:rotate-by-key', ({ direction }) => {
            if (this._hasAnimationLayerContext() && !this._canTransformActiveAnimationWorkingLayer()) return;
            this.transformActiveLayer(direction);
        });

        this.eventBus.on('layer:select-next', () => {
            if (this._hasAnimationLayerContext()) return;
            this.selectNextLayer();
        });

        this.eventBus.on('layer:select-prev', () => {
            if (this._hasAnimationLayerContext()) return;
            this.selectPrevLayer();
        });

        this.eventBus.on('layer:order-up', () => {
            if (this._hasAnimationLayerContext()) return;
            const layers = this.getLayers();
            const currentIndex = this.activeLayerIndex;
            const activeLayer = layers[currentIndex];

            if (!activeLayer || activeLayer.layerData?.isBackground) return;
            if (currentIndex >= layers.length - 1) return;

            this.reorderLayers(currentIndex, currentIndex + 1);
        });

        this.eventBus.on('layer:order-down', () => {
            if (this._hasAnimationLayerContext()) return;
            const layers = this.getLayers();
            const currentIndex = this.activeLayerIndex;
            const activeLayer = layers[currentIndex];

            if (!activeLayer || activeLayer.layerData?.isBackground) return;
            if (currentIndex <= 0) return;

            const targetLayer = layers[currentIndex - 1];
            if (targetLayer?.layerData?.isBackground) return;
            this.reorderLayers(currentIndex, currentIndex - 1);
        });

        this.eventBus.on('layer:toggle-move-mode', () => {
            this.toggleLayerMoveMode();
        });

        this.eventBus.on('tool:select', () => {
            if (this.isLayerMoveMode) {
                this.exitLayerMoveMode();
            }
        });

        window.addEventListener('blur', () => {
            if (this.vKeyPressed) {
                this.exitLayerMoveMode();
            }
        });
    }

    _hasAnimationLayerContext() {
        const animationTable = window.PopupManager?.get?.('animationTable')
            || window.coreEngine?.popupManager?.get?.('animationTable');
        return !!(
            animationTable?.model &&
            (
                (animationTable.model.tracks?.length || 0) > 0 ||
                (animationTable.model.clipAssets?.length || 0) > 0
            )
        );
    }

    _canTransformActiveAnimationWorkingLayer() {
        const activeLayer = this.getActiveLayer();
        return activeLayer?.layerData?.isAnimationWorkingLayer === true;
    }

    selectNextLayer() {
        const layers = this.getLayers();
        if (layers.length <= 1) return;

        const currentIndex = this.activeLayerIndex;
        let newIndex = currentIndex + 1;

        if (newIndex >= layers.length) return;

        const targetLayer = layers[newIndex];
        if (targetLayer?.layerData?.isBackground) return;

        this.setActiveLayer(newIndex);

        if (this.eventBus) {
            this.eventBus.emit('layer:selection-changed', {
                oldIndex: currentIndex,
                newIndex: newIndex,
                layerId: targetLayer?.layerData?.id
            });
        }
    }

    selectPrevLayer() {
        const layers = this.getLayers();
        if (layers.length <= 1) return;

        const currentIndex = this.activeLayerIndex;
        let newIndex = currentIndex - 1;

        if (newIndex < 0) return;

        const targetLayer = layers[newIndex];
        if (targetLayer?.layerData?.isBackground) return;

        this.setActiveLayer(newIndex);

        if (this.eventBus) {
            this.eventBus.emit('layer:selection-changed', {
                oldIndex: currentIndex,
                newIndex: newIndex,
                layerId: targetLayer?.layerData?.id
            });
        }
    }

    moveActiveLayerHierarchy(direction) {
        const layers = this.getLayers();
        if (layers.length <= 1) return;
        const currentIndex = this.activeLayerIndex;
        const activeLayer = layers[currentIndex];
        if (activeLayer?.layerData?.isBackground) return;
        let newIndex;
        if (direction === 'up') {
            newIndex = currentIndex + 1;
            if (newIndex >= layers.length) return;
        } else if (direction === 'down') {
            newIndex = currentIndex - 1;
            if (newIndex < 0) return;
            const targetLayer = layers[newIndex];
            if (targetLayer?.layerData?.isBackground) return;
        } else {
            return;
        }
        if (historyManager && !historyManager.isApplying) {
            const oldIndex = currentIndex;
            const entry = {
                name: 'layer-hierarchy-move',
                do: () => {
                    const layers = this.getLayers();
                    const layer = layers[oldIndex];
                    this.currentFrameContainer.removeChildAt(oldIndex);
                    this.currentFrameContainer.addChildAt(layer, newIndex);
                    this.activeLayerIndex = newIndex;
                    this._emitPanelUpdateRequest();
                    if (this.eventBus) {
                        this.eventBus.emit('layer:hierarchy-moved', { direction, oldIndex, newIndex, layerId: layer.layerData?.id });
                    }
                },
                undo: () => {
                    const layers = this.getLayers();
                    const layer = layers[newIndex];
                    this.currentFrameContainer.removeChildAt(newIndex);
                    this.currentFrameContainer.addChildAt(layer, oldIndex);
                    this.activeLayerIndex = oldIndex;
                    this._emitPanelUpdateRequest();
                    if (this.eventBus) {
                        this.eventBus.emit('layer:hierarchy-moved', { direction: direction === 'up' ? 'down' : 'up', oldIndex: newIndex, newIndex: oldIndex, layerId: layer.layerData?.id });
                    }
                },
                meta: { direction, oldIndex, newIndex }
            };
            historyManager.push(entry);
        } else {
            this.currentFrameContainer.removeChildAt(currentIndex);
            this.currentFrameContainer.addChildAt(activeLayer, newIndex);
            this.activeLayerIndex = newIndex;
            this._emitPanelUpdateRequest();
            if (this.eventBus) {
                this.eventBus.emit('layer:hierarchy-moved', { direction, oldIndex: currentIndex, newIndex, layerId: activeLayer.layerData?.id });
            }
        }
    }

    _generateNextLayerName() {
        const layers = this.getLayers();
        const layerNames = layers
            .filter(l => l.layerData && !l.layerData.isBackground && !l.layerData.isFolder)
            .map(l => l.layerData.name);

        const numbers = layerNames
            .map(name => {
                const match = name.match(/^レイヤー(\d+)$/);
                return match ? parseInt(match[1], 10) : 0;
            })
            .filter(n => n > 0);

        const maxNumber = numbers.length > 0 ? Math.max(...numbers) : 0;
        const nextNumber = maxNumber + 1;

        return `レイヤー${nextNumber}`;
    }

    createLayer(name, isBackground = false) {
        if (!this.currentFrameContainer) return null;

        const layerModel = new LayerModel({
            name: name || (isBackground ? '背景' : this._generateNextLayerName()),
            isBackground: isBackground
        });
        const layer = new Container();
        layer.label = layerModel.id;
        layer.layerData = layerModel;
        layer.id = layerModel.id;

        // 🆕 レイヤー用テクスチャの初期化
        if (this.app?.renderer) {
            layerModel.initializeTexture(this.config.canvas.width, this.config.canvas.height);
            if (layerModel.layerSprite) {
                layer.addChild(layerModel.layerSprite);
            }
        }

        if (this.app && this.app.renderer && !isBackground) {
            const success = layerModel.initializeMask(
                this.config.canvas.width,
                this.config.canvas.height,
                this.app.renderer
            );
            if (success && layerModel.maskSprite) {
                layer.addChild(layerModel.maskSprite);
            }
        }

        if (this.transform) {
            this.transform.setTransform(layerModel.id, { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 });
        }

        if (isBackground) {
            const bg = this._createSolidBackground(
                this.config.canvas.width,
                this.config.canvas.height,
                0xf0e0d6
            );
            layer.addChild(bg);
            layer.layerData.backgroundGraphics = bg;
            layer.layerData.backgroundColor = 0xf0e0d6;
        }

        if (historyManager && !historyManager.isApplying) {
            const entry = {
                name: 'layer-create',
                do: () => {
                    this.currentFrameContainer.addChild(layer);
                    const layers = this.getLayers();
                    this.setActiveLayer(layers.length - 1);
                    this._emitPanelUpdateRequest();
                    this._emitStatusUpdateRequest();
                },
                undo: () => {
                    if (layer.layerData) {
                        layer.layerData.destroyMask();
                    }
                    this.currentFrameContainer.removeChild(layer);
                    const layers = this.getLayers();
                    if (this.activeLayerIndex >= layers.length) {
                        this.activeLayerIndex = Math.max(0, layers.length - 1);
                    }
                    this._emitPanelUpdateRequest();
                    this._emitStatusUpdateRequest();
                },
                meta: { layerId: layerModel.id, name: layerModel.name }
            };
            historyManager.push(entry);
        } else {
            this.currentFrameContainer.addChild(layer);
            const layers = this.getLayers();
            this.setActiveLayer(layers.length - 1);
            this._emitPanelUpdateRequest();
            this._emitStatusUpdateRequest();
        }
        if (this.eventBus) {
            this.eventBus.emit('layer:created', { layerId: layerModel.id, name: layerModel.name, isBackground });
        }
        const layers = this.getLayers();
        return { layer, index: layers.length - 1 };
    }

    setActiveLayer(index, options = {}) {
        const layers = this.getLayers();
        if (index >= 0 && index < layers.length) {
            const layer = layers[index];
            if (layer?.layerData?.isBackground) {
                return;
            }

            const oldIndex = this.activeLayerIndex;
            if (oldIndex !== index && this.isLayerMoveMode) {
                this.exitLayerMoveMode();
            }
            this.activeLayerIndex = index;
            if (!options.preserveSelection) {
                this._setSingleLayerSelection(index);
            }
            this._emitPanelUpdateRequest();
            this._emitStatusUpdateRequest();
            if (this.isLayerMoveMode) {
                this.updateLayerTransformPanelValues();
            }
            if (this.eventBus) {
                this.eventBus.emit('layer:activated', { layerIndex: index, oldIndex: oldIndex, layerId: layers[index]?.layerData?.id });
            }
            this._emitMultiSelectionChanged(options.preserveSelection ? 'active-preserve' : 'single');
        }
    }

    toggleLayerVisibility(layerIndex) {
        const layers = this.getLayers();
        if (layerIndex < 0 || layerIndex >= layers.length) return;

        const layer = layers[layerIndex];
        layer.layerData.visible = !layer.layerData.visible;
        layer.visible = layer.layerData.visible;

        if (layer.layerData?.isBackground) {
            this._refreshCheckerPattern(false);
        }

        this._emitPanelUpdateRequest();
        if (this.eventBus) {
            this.eventBus.emit('layer:visibility-changed', { layerIndex, visible: layer.layerData.visible, layerId: layer.layerData.id });
            this.requestThumbnailUpdate(layerIndex);
        }
    }

    insertClipboard(data) {
        if (this.eventBus) {
            this.eventBus.emit('layer:clipboard-inserted', data);
        }
    }

    _emitPanelUpdateRequest() {
        this._refreshLayerEffectiveAlpha();
        this.refreshClippingMasks();
        if (this.eventBus) {
            this.eventBus.emit('layer:panel-update-requested', {
                timestamp: Date.now(),
                layers: this.getLayers(),
                activeIndex: this.activeLayerIndex
            });
        }
    }

    _emitStatusUpdateRequest() {
        const layers = this.getLayers();
        const currentLayerName = this.activeLayerIndex >= 0 ? layers[this.activeLayerIndex]?.layerData?.name : 'なし';

        if (this.eventBus) {
            this.eventBus.emit('layer:status-update-requested', {
                currentLayer: currentLayerName,
                layerCount: layers.length,
                activeIndex: this.activeLayerIndex
            });
        }
    }

    setApp(app) {
        this.app = app;

        if (this.transform && !this.transform.app && this.cameraSystem) {
            this.initTransform();
        }
    }

    setCameraSystem(cameraSystem) {
        this.cameraSystem = cameraSystem;

        if (cameraSystem?.canvasContainer && this.currentFrameContainer) {
            const currentParent = this.currentFrameContainer.parent;

            if (!currentParent) {
                cameraSystem.canvasContainer.addChildAt(this.currentFrameContainer, 0);
            } else if (currentParent !== cameraSystem.canvasContainer) {
                currentParent.removeChild(this.currentFrameContainer);
                cameraSystem.canvasContainer.addChildAt(this.currentFrameContainer, 0);
            }

            const isChild = this.currentFrameContainer.parent === cameraSystem.canvasContainer;
            if (!isChild) {
                console.error('[LayerSystem] ❌ Failed to establish parent-child relationship');
            }
        }

        if (cameraSystem?.canvasContainer && window.checkerUtils) {
            this._refreshCheckerPattern(true);
        }

        if (this.transform && this.app && !this.transform.app) {
            this.initTransform();
        }
    }

    verifyParentChain() {
        if (!this.currentFrameContainer) {
            console.error('[LayerSystem] currentFrameContainer not found');
            return false;
        }

        const activeLayer = this.getActiveLayer();
        if (!activeLayer) {
            console.error('[LayerSystem] No active layer');
            return false;
        }

        console.log('[LayerSystem] Parent Chain Verification:');

        let current = activeLayer;
        let depth = 0;
        let foundWorldContainer = false;

        while (current && depth < 10) {
            const label = current.label || current.constructor.name;
            console.log(`  [${depth}] ${label}`);

            if (current === this.cameraSystem?.worldContainer) {
                foundWorldContainer = true;
                console.log('  ✅ worldContainer found in chain at depth', depth);
                break;
            }

            current = current.parent;
            depth++;
        }

        if (!foundWorldContainer) {
            console.error('  ❌ worldContainer NOT found in chain');
            console.error('  Chain ended at:', current ? (current.label || current.constructor.name) : 'null');
            return false;
        }

        console.log('[LayerSystem] ✅ Parent chain is valid');
        return true;
    }

    deleteLayer(layerIndex) {
        const layers = this.getLayers();
        if (layerIndex < 0 || layerIndex >= layers.length) {
            return false;
        }
        const layer = layers[layerIndex];
        const layerId = layer.layerData?.id;
        if (layer.layerData?.isBackground) {
            return false;
        }

        if (layer.layerData?.isFolder) {
            const children = this.getFolderChildren(layerId);
            children.forEach(child => {
                const childIndex = this.getLayerIndex(child);
                if (childIndex >= 0) {
                    this.deleteLayer(childIndex);
                }
            });
        }

        try {
            const previousActiveIndex = this.activeLayerIndex;
            if (historyManager && !historyManager.isApplying) {
                const entry = {
                    name: 'layer-delete',
                    do: () => {
                        this.clearClippingMasks();
                        if (layer.layerData) {
                            layer.layerData.destroyMask();
                        }
                        this.currentFrameContainer.removeChild(layer);
                        if (layerId && this.transform) {
                            this.transform.clearTransform(layerId);
                        }
                        const remainingLayers = this.getLayers();
                        if (remainingLayers.length === 0) {
                            this.activeLayerIndex = -1;
                        } else if (this.activeLayerIndex >= remainingLayers.length) {
                            this.activeLayerIndex = remainingLayers.length - 1;
                        }
                        this.refreshClippingMasks();
                        this._emitPanelUpdateRequest();
                        this._emitStatusUpdateRequest();
                        if (this.eventBus) {
                            this.eventBus.emit('layer:deleted', { layerId, layerIndex });
                        }
                    },
                    undo: () => {
                        if (layer.layerData && this.app && this.app.renderer && !layer.layerData.isFolder) {
                            layer.layerData.initializeMask(
                                this.config.canvas.width,
                                this.config.canvas.height,
                                this.app.renderer
                            );
                            if (layer.layerData.maskSprite) {
                                layer.addChildAt(layer.layerData.maskSprite, 0);
                                this._applyMaskToLayerGraphics(layer);
                            }
                        }
                        this.currentFrameContainer.addChildAt(layer, layerIndex);
                        this.activeLayerIndex = previousActiveIndex;
                        this.refreshClippingMasks();
                        this._emitPanelUpdateRequest();
                        this._emitStatusUpdateRequest();
                    },
                    meta: { layerId, layerIndex }
                };
                historyManager.push(entry);
            } else {
                this.clearClippingMasks();
                if (layer.layerData) {
                    layer.layerData.destroyMask();
                }
                this.currentFrameContainer.removeChild(layer);
                if (layerId && this.transform) {
                    this.transform.clearTransform(layerId);
                }
                const remainingLayers = this.getLayers();
                if (remainingLayers.length === 0) {
                    this.activeLayerIndex = -1;
                } else if (this.activeLayerIndex >= remainingLayers.length) {
                    this.activeLayerIndex = remainingLayers.length - 1;
                }
                this.refreshClippingMasks();
                this._emitPanelUpdateRequest();
                this._emitStatusUpdateRequest();
                if (this.eventBus) {
                    this.eventBus.emit('layer:deleted', { layerId, layerIndex });
                }
            }
            if (this.animationSystem?.generateFrameThumbnail) {
                const frameIndex = this.animationSystem.getCurrentFrameIndex();
                setTimeout(() => {
                    this.animationSystem.generateFrameThumbnail(frameIndex);
                }, 100);
            }
            return true;
        } catch (error) {
            return false;
        }
    }

    requestThumbnailUpdate(layerIndex, immediate = false) {
        if (this.eventBus) {
            const layer = this.getLayers()[layerIndex];
            if (!layer?.layerData?.id || layer.layerData.isFolder) return;
            this.eventBus.emit('thumbnail:layer-updated', {
                layerIndex,
                layerId: layer?.layerData?.id,
                immediate
            });
        }
    }

    /**
     * 🆕 レイヤー複製
     */
    duplicateLayer(layerIndex) {
        const layers = this.getLayers();
        if (layerIndex < 0 || layerIndex >= layers.length) return null;

        const sourceLayer = layers[layerIndex];
        if (sourceLayer.layerData?.isBackground) return null;
        if (sourceLayer.layerData?.isFolder) {
            const wasApplying = historyManager?.isApplying === true;
            if (historyManager) historyManager.isApplying = true;
            const result = this.createFolder(`${sourceLayer.layerData.name} のコピー`);
            if (historyManager) historyManager.isApplying = wasApplying;
            if (result?.layer?.layerData) {
                result.layer.layerData.folderExpanded = sourceLayer.layerData.folderExpanded;
                result.index = this._placeDuplicatedLayer(result.layer, sourceLayer, layerIndex);
                this.setActiveLayer(result.index);
                this._emitPanelUpdateRequest();
            }
            return result;
        }

        const sourceData = sourceLayer.layerData;
        const newName = `${sourceData.name} のコピー`;

        // 1. 新規レイヤー作成（複製全体を1履歴にするため、createLayer履歴は抑止）
        const wasApplying = historyManager?.isApplying === true;
        if (historyManager) historyManager.isApplying = true;
        const created = this.createLayer(newName);
        if (historyManager) historyManager.isApplying = wasApplying;

        const { layer: newLayer } = created || {};
        if (!newLayer) return null;

        // 2. 状態コピー
        newLayer.alpha = sourceLayer.alpha;
        newLayer.visible = sourceLayer.visible;
        newLayer.layerData.opacity = sourceData.opacity;
        newLayer.layerData.visible = sourceData.visible;
        newLayer.layerData.blendMode = sourceData.blendMode || 'normal';
        applyClippingMode(newLayer.layerData, getClippingMode(sourceData));
        newLayer.blendMode = newLayer.layerData.blendMode;
        if (newLayer.layerData.layerSprite) {
            newLayer.layerData.layerSprite.blendMode = newLayer.layerData.blendMode;
        }

        // 3. ラスター内容コピー
        if (sourceData.renderTexture && newLayer.layerData.renderTexture && this.app?.renderer) {
            const tempSprite = new Sprite(sourceData.renderTexture);
            this.app.renderer.render({
                container: tempSprite,
                target: newLayer.layerData.renderTexture,
                clear: true,
                clearColor: [0, 0, 0, 0]
            });
            tempSprite.destroy({ texture: false, baseTexture: false });
            const rasterBounds = normalizeRasterBounds(sourceData.rasterBounds, {
                width: newLayer.layerData.renderTexture.width,
                height: newLayer.layerData.renderTexture.height
            });
            rasterBounds.width = newLayer.layerData.renderTexture.width;
            rasterBounds.height = newLayer.layerData.renderTexture.height;
            newLayer.layerData.rasterBounds = rasterBounds;
            newLayer.layerData.layerSprite?.position.set(rasterBounds.x, rasterBounds.y);
        }

        // 4. トランスフォームコピー
        if (this.transform) {
            const sourceTransform = this.transform.getTransform(sourceData.id);
            if (sourceTransform) {
                this.transform.setTransform(newLayer.layerData.id, structuredClone(sourceTransform));
                // コンテナのプロパティも同期
                newLayer.position.copyFrom(sourceLayer.position);
                newLayer.scale.copyFrom(sourceLayer.scale);
                newLayer.rotation = sourceLayer.rotation;
                newLayer.pivot.copyFrom(sourceLayer.pivot);
            }
        }

        const finalIndex = this._placeDuplicatedLayer(newLayer, sourceLayer, layerIndex);
        this.setActiveLayer(finalIndex);

        // 5. 履歴へ記録
        if (historyManager && !historyManager.isApplying) {
            const snapshot = this.createLayerRasterSnapshot(newLayer);
            historyManager.record({
                name: 'layer-duplicate',
                do: () => {
                    if (!newLayer.parent) {
                        this.currentFrameContainer.addChildAt(newLayer, Math.min(finalIndex, this.currentFrameContainer.children.length));
                    }
                    this.restoreLayerRasterSnapshot(snapshot);
                    this._placeDuplicatedLayer(newLayer, sourceLayer, layerIndex);
                    this.setActiveLayer(this.getLayerIndex(newLayer));
                    this._emitPanelUpdateRequest();
                },
                undo: () => {
                    if (newLayer.parent) {
                        this.currentFrameContainer.removeChild(newLayer);
                    }
                    if (newLayer.layerData?.parentId) {
                        const folder = this.getLayers().find(l => l.layerData?.id === newLayer.layerData.parentId);
                        folder?.layerData?.removeChild(newLayer.layerData.id);
                    }
                    const remaining = this.getLayers();
                    this.activeLayerIndex = Math.min(layerIndex, remaining.length - 1);
                    this._emitPanelUpdateRequest();
                },
                meta: { sourceId: sourceData.id, newId: newLayer.layerData.id }
            });
        }

        this.requestThumbnailUpdate(finalIndex, true);
        return { layer: newLayer, index: finalIndex };
    }

    _createRasterLayerContainer(name) {
        const layerModel = new LayerModel({
            name: name || this._generateNextLayerName()
        });
        const layer = new Container();
        layer.label = layerModel.id;
        layer.layerData = layerModel;
        layer.id = layerModel.id;

        if (this.app?.renderer) {
            layerModel.initializeTexture(this.config.canvas.width, this.config.canvas.height);
            if (layerModel.layerSprite) {
                layer.addChild(layerModel.layerSprite);
            }
            const success = layerModel.initializeMask(
                this.config.canvas.width,
                this.config.canvas.height,
                this.app.renderer
            );
            if (success && layerModel.maskSprite) {
                layer.addChild(layerModel.maskSprite);
            }
        }

        if (this.transform) {
            this.transform.setTransform(layerModel.id, { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 });
        }

        return layer;
    }

    _getLayerSubtreeIds(folderId) {
        const layers = this.getLayers();
        const ids = new Set([folderId]);
        let changed = true;
        while (changed) {
            changed = false;
            layers.forEach(layer => {
                const data = layer?.layerData;
                if (data?.parentId && ids.has(data.parentId) && !ids.has(data.id)) {
                    ids.add(data.id);
                    changed = true;
                }
            });
        }
        return ids;
    }

    _getFolderSubtreeLayers(folderId) {
        const ids = this._getLayerSubtreeIds(folderId);
        return this.getLayers().filter(layer => ids.has(layer.layerData?.id));
    }

    _isLayerEffectivelyVisible(layer) {
        const data = layer?.layerData;
        if (!data || layer.visible === false || data.visible === false) return false;

        const byId = new Map(this.getLayers().map(item => [item.layerData?.id, item]));
        const visited = new Set();
        let parentId = data.parentId || null;
        while (parentId && !visited.has(parentId)) {
            visited.add(parentId);
            const parent = byId.get(parentId);
            if (!parent) break;
            if (parent.visible === false || parent.layerData?.visible === false) return false;
            parentId = parent.layerData?.parentId || null;
        }
        return true;
    }

    _isLayerPersistentlyVisible(layer, layers = this.getLayers()) {
        const data = layer?.layerData;
        if (!data || data.visible === false) return false;

        const byId = new Map(layers.map(item => [item.layerData?.id, item]));
        const visited = new Set();
        let parentId = data.parentId || null;
        while (parentId && !visited.has(parentId)) {
            visited.add(parentId);
            const parent = byId.get(parentId);
            if (!parent) break;
            if (parent.layerData?.visible === false) return false;
            parentId = parent.layerData?.parentId || null;
        }
        return true;
    }

    canMergeFolderToLayer(layerIndex) {
        const folderLayer = this.getLayers()[layerIndex];
        if (!folderLayer?.layerData?.isFolder || !this.app?.renderer || !this.currentFrameContainer) return false;
        if (!this._isLayerEffectivelyVisible(folderLayer)) return false;
        return this._getFolderSubtreeLayers(folderLayer.layerData.id)
            .some(layer => layer?.layerData?.renderTexture && !layer.layerData.isBackground && !layer.layerData.isFolder);
    }

    _createFolderCompositeSnapshot(folderLayer, targetLayerId) {
        if (!folderLayer?.layerData?.isFolder || !targetLayerId || !this.app?.renderer || !this.currentFrameContainer) {
            return null;
        }

        const width = Math.max(1, Math.round(this.config?.canvas?.width || 1));
        const height = Math.max(1, Math.round(this.config?.canvas?.height || 1));
        const maxTextureSize = this._getMaxRenderTextureSize();
        if (width > maxTextureSize || height > maxTextureSize || !this._isRasterBakeSizeAllowed({ width, height })) {
            console.warn('[LayerSystem] Folder merge skipped: composite target is too large', { width, height, maxTextureSize });
            return null;
        }

        const subtreeIds = this._getLayerSubtreeIds(folderLayer.layerData.id);
        const visibilityState = this.getLayers().map(layer => ({ layer, visible: layer.visible }));
        const visibleById = new Map(visibilityState.map(({ layer, visible }) => [layer.layerData?.id, visible]));
        const dataVisibleById = new Map(this.getLayers().map(layer => [layer.layerData?.id, layer.layerData?.visible !== false]));
        const byId = new Map(this.getLayers().map(layer => [layer.layerData?.id, layer]));
        const wasEffectivelyVisible = (layer) => {
            const data = layer?.layerData;
            if (!data || visibleById.get(data.id) === false || dataVisibleById.get(data.id) === false) return false;
            const visited = new Set();
            let parentId = data.parentId || null;
            while (parentId && !visited.has(parentId)) {
                visited.add(parentId);
                const parent = byId.get(parentId);
                if (!parent) break;
                const parentIdValue = parent.layerData?.id;
                if (visibleById.get(parentIdValue) === false || dataVisibleById.get(parentIdValue) === false) return false;
                parentId = parent.layerData?.parentId || null;
            }
            return true;
        };
        const checkerVisible = this.checkerPattern ? this.checkerPattern.visible : null;
        const tempRT = RenderTexture.create({ width, height, antialias: true });

        try {
            if (this.checkerPattern) this.checkerPattern.visible = false;
            this.getLayers().forEach(layer => {
                const id = layer.layerData?.id;
                layer.visible = subtreeIds.has(id) && wasEffectivelyVisible(layer);
            });

            this.app.renderer.render({
                container: this.currentFrameContainer,
                target: tempRT,
                clear: true,
                clearColor: [0, 0, 0, 0]
            });

            const result = this.app.renderer.extract.pixels({ target: tempRT });
            const sourcePixels = result?.pixels || (result instanceof Uint8ClampedArray ? result : new Uint8ClampedArray(result?.buffer || result));
            const pixels = new Uint8ClampedArray(sourcePixels);
            this._unpremultiplyPixelBuffer(pixels);
            const hasPixels = pixels.some((value, index) => index % 4 === 3 && value > 0);
            if (!hasPixels) return null;

            return {
                layerId: targetLayerId,
                width,
                height,
                rasterBounds: { x: 0, y: 0, width, height },
                pixels,
                pathsData: [],
                paths: []
            };
        } finally {
            visibilityState.forEach(({ layer, visible }) => {
                layer.visible = visible;
            });
            if (this.checkerPattern && checkerVisible !== null) {
                this.checkerPattern.visible = checkerVisible;
            }
            tempRT.destroy(true);
        }
    }

    _replaceLayerInParentFolder(parentId, oldLayerId, newLayerId) {
        if (!parentId || !oldLayerId || !newLayerId) return;
        const parent = this.getLayers().find(layer => layer.layerData?.id === parentId);
        const children = parent?.layerData?.children;
        if (!Array.isArray(children)) return;
        const index = children.indexOf(oldLayerId);
        if (index >= 0) {
            children.splice(index, 1, newLayerId);
        } else if (!children.includes(newLayerId)) {
            children.push(newLayerId);
        }
    }

    _executeFolderMergeToLayer({ folderId, mergedLayer, snapshot, subtreeLayers, insertIndex, parentId }) {
        if (!folderId || !mergedLayer?.layerData || !snapshot || !this.currentFrameContainer) return false;
        const subtreeIds = new Set((subtreeLayers || []).map(layer => layer.layerData?.id).filter(Boolean));
        if (!subtreeIds.has(folderId)) return false;

        (subtreeLayers || []).forEach(layer => {
            if (layer?.parent) {
                this.currentFrameContainer.removeChild(layer);
            }
        });

        if (mergedLayer.parent) {
            this.currentFrameContainer.removeChild(mergedLayer);
        }
        mergedLayer.layerData.parentId = parentId || null;
        mergedLayer.layerData.opacity = 1;
        mergedLayer.alpha = 1;
        this.currentFrameContainer.addChildAt(mergedLayer, Math.min(insertIndex, this.currentFrameContainer.children.length));
        this._replaceLayerInParentFolder(parentId, folderId, mergedLayer.layerData.id);

        if (!this.restoreLayerRasterSnapshot(snapshot)) return false;

        const mergedIndex = this.getLayerIndex(mergedLayer);
        this.setActiveLayer(mergedIndex);
        this.refreshClippingMasks();
        this.requestThumbnailUpdate(mergedIndex, true);
        this._emitPanelUpdateRequest();
        if (this.eventBus) {
            this.eventBus.emit('layer:folder-merged', {
                folderId,
                layerId: mergedLayer.layerData.id,
                layerIndex: mergedIndex
            });
        }
        return true;
    }

    _restoreFolderMergeState({ beforeState, mergedLayer, subtreeLayers }) {
        if (!beforeState || !this.currentFrameContainer) return false;
        if (mergedLayer?.parent) {
            this.currentFrameContainer.removeChild(mergedLayer);
        }
        (subtreeLayers || []).forEach(layer => {
            if (!layer?.parent) {
                this.currentFrameContainer.addChild(layer);
            }
        });
        const restored = this._restoreLayerPlacementState(beforeState);
        this._emitPanelUpdateRequest();
        return restored;
    }

    mergeFolderToLayer(layerIndex) {
        const layers = this.getLayers();
        const folderLayer = layers[layerIndex];
        if (!folderLayer?.layerData?.isFolder) return false;
        if (!this.canMergeFolderToLayer(layerIndex)) {
            console.warn('[LayerSystem] Folder merge requires a visible raster layer inside the folder');
            return false;
        }

        const folderId = folderLayer.layerData.id;
        const beforeState = this._captureLayerPlacementState();
        const subtreeLayers = this._getFolderSubtreeLayers(folderId);
        const parentId = folderLayer.layerData.parentId || null;
        const insertIndex = layerIndex;
        const mergedLayer = this._createRasterLayerContainer(`${folderLayer.layerData.name || 'Folder'} 結合`);
        const snapshot = this._createFolderCompositeSnapshot(folderLayer, mergedLayer.layerData.id);
        if (!mergedLayer || !snapshot) return false;

        const applyMerge = () => this._executeFolderMergeToLayer({
            folderId,
            mergedLayer,
            snapshot,
            subtreeLayers,
            insertIndex,
            parentId
        });
        const undoMerge = () => this._restoreFolderMergeState({
            beforeState,
            mergedLayer,
            subtreeLayers
        });

        if (historyManager && !historyManager.isApplying) {
            historyManager.push({
                name: 'folder-merge-to-layer',
                do: applyMerge,
                undo: undoMerge,
                meta: {
                    folderId,
                    layerId: mergedLayer.layerData.id,
                    layerCount: subtreeLayers.length
                },
                byteSize: snapshot.pixels?.byteLength || 0
            });
            return true;
        }

        return applyMerge();
    }

    /**
     * 🆕 下のレイヤーと結合
     */
    mergeLayerDown(layerIndex) {
        const layers = this.getLayers();
        // 下に通常レイヤーが必要。背景レイヤーは不透明な背景塗りを持つ特殊レイヤーなので、
        // RenderTexture に焼き込むとキャンバス上では隠れてしまう。
        if (layerIndex <= 0 || layerIndex >= layers.length) return false;

        const topLayer = layers[layerIndex];
        const bottomLayer = layers[layerIndex - 1];

        if (!topLayer?.layerData) return false;

        if (topLayer.layerData?.isFolder) {
            return this.mergeFolderToLayer(layerIndex);
        }

        if (!bottomLayer?.layerData) return false;

        if (topLayer.layerData?.isFolder || bottomLayer.layerData?.isFolder || bottomLayer.layerData?.isBackground) {
            console.warn('[LayerSystem] Merge down requires a normal layer below');
            return false;
        }

        if (!topLayer.layerData.renderTexture || !bottomLayer.layerData.renderTexture) {
            console.warn('[LayerSystem] Merge down requires raster layers');
            return false;
        }

        // 履歴用スナップショット
        const topSnapshot = this.createLayerRasterSnapshot(topLayer);
        const bottomSnapshotBefore = this.createLayerRasterSnapshot(bottomLayer);
        if (!topSnapshot || !bottomSnapshotBefore) {
            console.warn('[LayerSystem] Merge down snapshot failed');
            return false;
        }
        const topOriginalIndex = layerIndex;

        if (historyManager && !historyManager.isApplying) {
            const entry = {
                name: 'layer-merge-down',
                do: () => {
                    this._executeMergeDownById(topSnapshot.layerId, bottomSnapshotBefore.layerId);
                },
                undo: () => {
                    // 1. 下のレイヤーを復元
                    this.restoreLayerRasterSnapshot(bottomSnapshotBefore);
                    // 2. 上のレイヤーを再挿入
                    if (!topLayer.parent) {
                        this.currentFrameContainer.addChildAt(topLayer, Math.min(topOriginalIndex, this.currentFrameContainer.children.length));
                    }
                    this.restoreLayerRasterSnapshot(topSnapshot);
                    this.setActiveLayer(this.getLayerIndex(topLayer));
                    this._emitPanelUpdateRequest();
                },
                meta: { topId: topLayer.layerData.id, bottomId: bottomLayer.layerData.id },
                byteSize: (topSnapshot.pixels?.byteLength || 0)
                    + (bottomSnapshotBefore.pixels?.byteLength || 0)
            };

            historyManager.push(entry);
            return true;
        }

        return this._executeMergeDown(layerIndex);
    }

    _executeMergeDown(layerIndex) {
        const layers = this.getLayers();
        const topLayer = layers[layerIndex];
        const bottomLayer = layers[layerIndex - 1];
        return this._executeMergeDownLayers(topLayer, bottomLayer);
    }

    _executeMergeDownById(topLayerId, bottomLayerId) {
        const layers = this.getLayers();
        const topLayer = layers.find(layer => layer.layerData?.id === topLayerId);
        const bottomLayer = layers.find(layer => layer.layerData?.id === bottomLayerId);
        return this._executeMergeDownLayers(topLayer, bottomLayer);
    }

    _executeMergeDownLayers(topLayer, bottomLayer) {
        if (!topLayer?.layerData || !bottomLayer?.layerData) return false;
        if (topLayer.layerData.isFolder || bottomLayer.layerData.isFolder || bottomLayer.layerData.isBackground) return false;
        if (!this.app?.renderer || !topLayer.layerData.renderTexture || !bottomLayer.layerData.renderTexture) return false;

        const topBounds = normalizeRasterBounds(topLayer.layerData.rasterBounds, {
            width: topLayer.layerData.renderTexture.width,
            height: topLayer.layerData.renderTexture.height
        });
        topBounds.width = topLayer.layerData.renderTexture.width;
        topBounds.height = topLayer.layerData.renderTexture.height;

        const expanded = this.ensureLayerRasterBoundsForRect(bottomLayer, topBounds, { padding: 0 });
        if (!expanded.ok) {
            console.warn('[LayerSystem] Merge down skipped: destination bounds cannot expand', {
                topLayerId: topLayer.layerData.id,
                bottomLayerId: bottomLayer.layerData.id,
                topBounds
            });
            return false;
        }
        const bottomBounds = normalizeRasterBounds(bottomLayer.layerData.rasterBounds, {
            width: bottomLayer.layerData.renderTexture.width,
            height: bottomLayer.layerData.renderTexture.height
        });
        bottomBounds.width = bottomLayer.layerData.renderTexture.width;
        bottomBounds.height = bottomLayer.layerData.renderTexture.height;

        // 1. 上のレイヤーを下のレイヤーの RenderTexture に焼き込む
        // opacity や transform を維持したままレンダリング
        const renderContainer = new Container();
        const topSprite = topLayer.layerData.layerSprite
            ? new Sprite(topLayer.layerData.layerSprite.texture)
            : null;

        if (!topSprite) return false;

        topSprite.alpha = topLayer.alpha ?? topLayer.layerData.opacity ?? 1;
        topSprite.position.set(topBounds.x - bottomBounds.x, topBounds.y - bottomBounds.y);
        renderContainer.addChild(topSprite);

        this.app.renderer.render({
            container: renderContainer,
            target: bottomLayer.layerData.renderTexture,
            clear: false
        });

        renderContainer.destroy({ children: true, texture: false, baseTexture: false });

        // 2. 上のレイヤーを削除
        if (topLayer.parent) {
            this.currentFrameContainer.removeChild(topLayer);
        }

        // 3. 下のレイヤーをアクティブに
        const bottomIndex = this.getLayerIndex(bottomLayer);
        this.setActiveLayer(bottomIndex);
        this.requestThumbnailUpdate(bottomIndex, true);
        this._emitPanelUpdateRequest();

        return true;
    }
}

// 下位互換性のためにグローバルに登録
window.TegakiLayerSystem = LayerSystem;
