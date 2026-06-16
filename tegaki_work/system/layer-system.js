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
    bakeTransform(layer) {
        if (!this.app?.renderer || !layer.layerData?.renderTexture) return;

        const renderer = this.app.renderer;
        const layerData = layer.layerData;
        const rt = layerData.renderTexture;

        if (window.TEGAKI_CONFIG?.debug) {
            console.log(`[LayerSystem] Baking transform for layer: ${layerData.name} into ${rt.width}x${rt.height} RT`);
        }

        // 1. 現在の状態を一時的なテクスチャに書き出す
        // Pixi v8 で Container を RenderTexture にレンダリングすると、
        // その Container のローカルトランスフォームが適用されます。
        const tempRT = RenderTexture.create({
            width: rt.width,
            height: rt.height
        });

        renderer.render({
            container: layer,
            target: tempRT,
            clear: true
        });

        // 2. レイヤーのトランスフォームをリセット
        layer.position.set(0, 0);
        layer.rotation = 0;
        layer.scale.set(1, 1);
        layer.pivot.set(0, 0);

        // 3. レイヤー管理上の変形データもリセット
        if (this.transform) {
            this.transform.setTransform(layerData.id, { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 });
        }

        // 4. 元の RenderTexture をクリアして、焼き付けた内容を書き戻す
        const tempSprite = new Sprite(tempRT);
        renderer.render({
            container: tempSprite,
            target: rt,
            clear: true
        });

        // 5. 後始末
        tempSprite.destroy();
        tempRT.destroy(true);

        if (this.config?.debug) {
            console.log(`[LayerSystem] Baked transform for layer: ${layerData.name}`);
        }
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

        const previousParentId = layer.layerData.parentId;
        if (previousParentId === folderId) return true;

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
        if (this.eventBus) {
            this.eventBus.emit('layer:added-to-folder', { layerId, folderId });
            this.eventBus.emit('folder:toggled', { folderId, expanded: true });
            this.eventBus.emit('layer:reordered', { fromIndex, toIndex, activeIndex: this.activeLayerIndex, movedLayerId: layerId });
        }

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

        layer.alpha = opacity;
        if (layer.layerData) {
            layer.layerData.opacity = opacity;
        }

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
        if (layer.layerData?.isBackground || layer.layerData?.isFolder) return false;

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

    setLayerClipping(layerIndex, clipping) {
        const layers = this.getLayers();
        if (layerIndex < 0 || layerIndex >= layers.length) return false;

        const layer = layers[layerIndex];
        if (layer.layerData?.isBackground || layer.layerData?.isFolder) return false;

        const nextClipping = clipping === true;
        if (layer.layerData) {
            layer.layerData.clipping = nextClipping;
        }
        this.refreshClippingMasks();

        if (this.eventBus) {
            this.eventBus.emit('layer:clipping-changed', {
                layerIndex,
                layerId: layer.layerData?.id,
                clipping: nextClipping
            });
            this._emitPanelUpdateRequest();
            this.requestThumbnailUpdate(layerIndex, true);
        }

        return true;
    }

    toggleLayerClipping(layerIndex) {
        const layer = this.getLayers()[layerIndex];
        if (!layer?.layerData) return false;
        return this.setLayerClipping(layerIndex, !layer.layerData.clipping);
    }

    refreshClippingMasks() {
        const layers = this.getLayers();
        if (!layers.length) return;

        for (const layer of layers) {
            this._clearLayerClippingMask(layer);
        }

        for (const layer of layers) {
            const data = layer.layerData;
            if (!data || data.isBackground || data.isFolder || data.clipping !== true) continue;
            if (!data.layerSprite || !data.renderTexture) continue;

            const sourceLayer = this._findClippingSourceLayer(layer, layers);
            if (!sourceLayer?.layerData?.renderTexture) {
                data.layerSprite.visible = false;
                data.effectiveClippingSourceId = null;
                continue;
            }

            const maskSprite = new Sprite(sourceLayer.layerData.renderTexture);
            maskSprite.label = 'clipping_mask_sprite';
            maskSprite.renderable = false;
            maskSprite.eventMode = 'none';
            layer.addChildAt(maskSprite, 0);

            data.layerSprite.mask = maskSprite;
            this._applyClippingMaskToLayerChildren(layer, maskSprite);
            data.layerSprite.visible = true;
            data.clippingMaskSprite = maskSprite;
            data.effectiveClippingSourceId = sourceLayer.layerData.id;
        }
    }

    _clearLayerClippingMask(layer) {
        const data = layer?.layerData;
        if (!data) return;

        if (data.layerSprite && data.clippingMaskSprite && data.layerSprite.mask === data.clippingMaskSprite) {
            data.layerSprite.mask = null;
        }
        if (data.clippingMaskSprite) {
            for (const child of layer.children || []) {
                if (child && child.mask === data.clippingMaskSprite) {
                    child.mask = null;
                }
            }
        }
        if (data.layerSprite && !data.isFolder && !data.isBackground) {
            data.layerSprite.visible = true;
        }
        if (data.clippingMaskSprite) {
            if (data.clippingMaskSprite.parent) {
                data.clippingMaskSprite.parent.removeChild(data.clippingMaskSprite);
            }
            data.clippingMaskSprite.destroy({ children: true, texture: false, baseTexture: false });
            data.clippingMaskSprite = null;
        }
        data.effectiveClippingSourceId = null;
    }

    _applyClippingMaskToLayerChildren(layer, maskSprite) {
        const data = layer?.layerData;
        if (!data || !maskSprite) return;

        for (const child of layer.children || []) {
            if (!child || child === maskSprite || child === data.maskSprite || child === data.backgroundGraphics) continue;
            child.mask = maskSprite;
        }
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
            if (data.isBackground || data.isFolder) return null;
            if (data.visible === false || candidate.visible === false) return null;
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
        const pixels = new Uint8ClampedArray(sourcePixels);
        this._unpremultiplyPixelBuffer(pixels);

        return {
            layerId: layerData.id,
            width,
            height,
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

        const layer = this.getLayers().find(candidate => candidate.layerData?.id === snapshot.layerId);
        if (!layer?.layerData) return false;

        const layerData = layer.layerData;
        const width = Math.max(1, Math.round(snapshot.width));
        const height = Math.max(1, Math.round(snapshot.height));

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

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) return false;

        const imageData = new ImageData(new Uint8ClampedArray(snapshot.pixels), width, height);
        ctx.putImageData(imageData, 0, 0);

        const texture = Texture.from(canvas);
        const sprite = new Sprite(texture);

        this.app.renderer.render({
            container: sprite,
            target: layerData.renderTexture,
            clear: true,
            clearColor: [0, 0, 0, 0]
        });

        sprite.destroy({ texture: true, baseTexture: true });

        layerData.pathsData = structuredClone(snapshot.pathsData || []);
        layerData.paths = structuredClone(snapshot.paths || []);

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

    _setupVKeyEvents() {
        if (!this.eventBus) return;

        this.eventBus.on('keyboard:vkey-state-changed', ({ pressed }) => {
            if (!this.transform) return;
            if (!this.transform.app && this.app && this.cameraSystem) {
                this.initTransform();
            }
            if (this._hasAnimationLayerContext()) {
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
                this.exitLayerMoveMode();
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
            this.transform.updateTransform(activeLayer, property, value);
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
        if (this.transform) this.transform.enterMoveMode();
    }

    exitLayerMoveMode() {
        if (!this.transform) return;
        const activeLayer = this.getActiveLayer();
        let transformConfirmed = false;

        try {
            this.confirmLayerTransform(); // 🆕 変形確定焼き込み
            transformConfirmed = true;
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
                    confirmed: transformConfirmed
                });
                this._emitPanelUpdateRequest();
            }
        }
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
        }
    }

    flipActiveLayer(direction, bypassVKeyCheck = false) {
        if (!this.transform) return;
        const activeLayer = this.getActiveLayer();
        if (!activeLayer?.layerData) return;
        if (activeLayer.layerData.isBackground || activeLayer.layerData.isFolder) return;

        if (!bypassVKeyCheck && !this.isLayerMoveMode) return;

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
        this.requestThumbnailUpdate(this.activeLayerIndex);
    }

    confirmLayerTransform() {
        if (!this.transform) return;
        const activeLayer = this.getActiveLayer();
        if (!activeLayer?.layerData) return;
        const layerId = activeLayer.layerData.id;
        const transformBefore = structuredClone(this.transform.getTransform(layerId));

        if (this.transform._isTransformNonDefault(transformBefore)) {
            const beforeSnapshot = this.createLayerRasterSnapshot(activeLayer);

            // 🆕 Raster 焼き込み実行
            this.bakeTransform(activeLayer);

            // 互換性のためパスデータも変形適用（ベクトルデータが残っている場合）
            if (activeLayer.layerData.paths && activeLayer.layerData.paths.length > 0) {
                this.transform.applyTransformToPaths(activeLayer, transformBefore);
            }

            // 焼き込み後の状態を反映させるためにリビルド（レイヤーSpriteは保護される）
            const rebuildSuccess = this.safeRebuildLayer(activeLayer, activeLayer.layerData.paths);

            // 座標変換キャッシュをクリア
            if (this.coordAPI) {
                this.coordAPI.clearCache();
            }

            if (rebuildSuccess && historyManager && !historyManager.isApplying && beforeSnapshot) {
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
                        undo: () => applyTransformSnapshot(beforeSnapshot, transformBefore),
                        meta: { layerId, type: 'transform', transformBefore, transformAfter }
                    };
                    historyManager.record(entry);
                }
            }
        }
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
        this.transform.applyTransform(activeLayer, transform, centerX, centerY);
        this.transform.updateTransformPanelValues(activeLayer);

        if (this.eventBus) {
            this.eventBus.emit('layer:updated', { layerId, transform });
            this.requestThumbnailUpdate(this.activeLayerIndex);
        }
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
            if (this._hasAnimationLayerContext()) return;
            if (window.drawingClipboard) {
                window.drawingClipboard.copyActiveLayer();
            }
        });

        this.eventBus.on('layer:paste-request', () => {
            if (this._hasAnimationLayerContext()) return;
            if (window.drawingClipboard) {
                window.drawingClipboard.pasteLayer();
            }
        });

        this.eventBus.on('layer:flip-by-key', ({ direction }) => {
            if (this._hasAnimationLayerContext()) return;
            this.flipActiveLayer(direction, false);
        });

        this.eventBus.on('layer:flip-requested', ({ direction, bypassVKeyCheck = true }) => {
            if (this._hasAnimationLayerContext()) return;
            this.flipActiveLayer(direction, bypassVKeyCheck);
        });

        this.eventBus.on('layer:move-by-key', ({ direction }) => {
            if (this._hasAnimationLayerContext()) return;
            this.moveActiveLayer(direction);
        });

        this.eventBus.on('layer:scale-by-key', ({ direction }) => {
            if (this._hasAnimationLayerContext()) return;
            this.transformActiveLayer(direction);
        });

        this.eventBus.on('layer:rotate-by-key', ({ direction }) => {
            if (this._hasAnimationLayerContext()) return;
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
                        this._emitPanelUpdateRequest();
                        this._emitStatusUpdateRequest();
                    },
                    meta: { layerId, layerIndex }
                };
                historyManager.push(entry);
            } else {
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
        newLayer.layerData.clipping = sourceData.clipping === true;
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

        if (!topLayer?.layerData || !bottomLayer?.layerData) return false;

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
                meta: { topId: topLayer.layerData.id, bottomId: bottomLayer.layerData.id }
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

        // 1. 上のレイヤーを下のレイヤーの RenderTexture に焼き込む
        // opacity や transform を維持したままレンダリング
        const renderContainer = new Container();
        const topSprite = topLayer.layerData.layerSprite
            ? new Sprite(topLayer.layerData.layerSprite.texture)
            : null;

        if (!topSprite) return false;

        topSprite.alpha = topLayer.alpha ?? topLayer.layerData.opacity ?? 1;
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
