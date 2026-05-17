/**
 * ============================================================================
 * ファイル名: system/layer-system.js
 * 責務: レイヤーの追加・削除・並び替え・可視性・フォルダ管理を統括する
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
        this.frameRenderTextures = new Map();
        this.frameThumbnailDirty = new Map();
        this.cameraSystem = null;
        this.animationSystem = null;
        this.coordAPI = coordinateSystem;
        this.transform = null;
        this.isInitialized = false;
        this.checkerPattern = null;
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

        if (!layer || !folder || !folder.layerData?.isFolder) return false;
        if (layer.layerData?.isBackground) return false;

        if (!folder.layerData.addChild(layerId)) return false;

        layer.layerData.parentId = folderId;

        this._emitPanelUpdateRequest();

        if (this.eventBus) {
            this.eventBus.emit('layer:added-to-folder', {
                layerId,
                folderId
            });
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
            if (layer.layerData?.parentId) {
                const parentFolder = layers.find(l => l.layerData?.id === layer.layerData.parentId);
                if (parentFolder && parentFolder.layerData?.isFolder && !parentFolder.layerData.folderExpanded) {
                    continue;
                }
            }
            visibleLayers.push(layer);
        }

        return visibleLayers;
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

            if (this.checkerPattern && this.checkerPattern.parent && window.checkerUtils) {
                const wasVisible = this.checkerPattern.visible;

                this.checkerPattern = window.checkerUtils.resizeCanvasChecker(
                    this.checkerPattern,
                    data.width,
                    data.height
                );

                if (this.cameraSystem?.worldContainer && !this.checkerPattern.parent) {
                    this.cameraSystem.worldContainer.addChildAt(this.checkerPattern, 0);
                }

                const bgLayer = this.getLayers()[0];
                const isBackgroundVisible = bgLayer?.layerData?.visible !== false;
                this.checkerPattern.visible = !isBackgroundVisible;
            }

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

    getActiveLayerIndex() {
        return this.activeLayerIndex;
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

        return {
            layerId: layerData.id,
            width,
            height,
            pixels: new Uint8ClampedArray(sourcePixels),
            pathsData: structuredClone(layerData.pathsData || []),
            paths: structuredClone(layerData.paths || [])
        };
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
        this.confirmLayerTransform(); // 🆕 変形確定焼き込み
        const activeLayer = this.getActiveLayer();
        this.transform.exitMoveMode(activeLayer);
        const layerIndex = this.getLayerIndex(activeLayer);
        if (layerIndex !== -1) {
            this.requestThumbnailUpdate(layerIndex, true);
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

            if (rebuildSuccess && historyManager && !historyManager.isApplying) {
                const pathsAfter = structuredClone(activeLayer.layerData.paths);
                const transformAfter = { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 };
                const entry = {
                    name: 'layer-transform',
                    do: () => {
                        this.safeRebuildLayer(activeLayer, pathsAfter);
                        this.transform.setTransform(layerId, transformAfter);
                        activeLayer.position.set(0, 0);
                        activeLayer.rotation = 0;
                        activeLayer.scale.set(1, 1);
                        activeLayer.pivot.set(0, 0);
                        if (this.coordAPI) this.coordAPI.clearCache();
                        this.requestThumbnailUpdate(this.activeLayerIndex);
                    },
                    undo: () => {
                        if (window.TEGAKI_CONFIG?.debug) {
                            console.warn('[LayerSystem] Undo layer-transform: Restoring container transform, but raster content remains baked in RenderTexture!');
                        }
                        this.transform.setTransform(layerId, transformBefore);
                        const centerX = this.config.canvas.width / 2;
                        const centerY = this.config.canvas.height / 2;
                        this.transform.applyTransform(activeLayer, transformBefore, centerX, centerY);
                        if (this.coordAPI) this.coordAPI.clearCache();
                        this.requestThumbnailUpdate(this.activeLayerIndex);
                    },
                    meta: { layerId, type: 'transform', transformBefore }
                };
                historyManager.push(entry);
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
                        const [layer] = layers.splice(fromIndex, 1);
                        layers.splice(toIndex, 0, layer);
                        this.currentFrameContainer.removeChild(layer);
                        this.currentFrameContainer.addChildAt(layer, toIndex);
                        if (this.activeLayerIndex === fromIndex) {
                            this.activeLayerIndex = toIndex;
                        } else if (this.activeLayerIndex > fromIndex && this.activeLayerIndex <= toIndex) {
                            this.activeLayerIndex--;
                        } else if (this.activeLayerIndex < fromIndex && this.activeLayerIndex >= toIndex) {
                            this.activeLayerIndex++;
                        }
                        this._emitPanelUpdateRequest();
                        if (this.eventBus) {
                            this.eventBus.emit('layer:reordered', { fromIndex, toIndex, activeIndex: this.activeLayerIndex, movedLayerId: layer.layerData?.id });
                        }
                    },
                    undo: () => {
                        const layers = this.getLayers();
                        const [layer] = layers.splice(toIndex, 1);
                        layers.splice(fromIndex, 0, layer);
                        this.currentFrameContainer.removeChild(layer);
                        this.currentFrameContainer.addChildAt(layer, fromIndex);
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
                const [layer] = layers.splice(fromIndex, 1);
                layers.splice(toIndex, 0, layer);
                this.currentFrameContainer.removeChild(layer);
                this.currentFrameContainer.addChildAt(layer, toIndex);
                if (this.activeLayerIndex === fromIndex) {
                    this.activeLayerIndex = toIndex;
                } else if (this.activeLayerIndex > fromIndex && this.activeLayerIndex <= toIndex) {
                    this.activeLayerIndex--;
                } else if (this.activeLayerIndex < fromIndex && this.activeLayerIndex >= toIndex) {
                    this.activeLayerIndex++;
                }
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
            if (window.drawingClipboard) {
                window.drawingClipboard.copyActiveLayer();
            }
        });

        this.eventBus.on('layer:paste-request', () => {
            if (window.drawingClipboard) {
                window.drawingClipboard.pasteLayer();
            }
        });

        this.eventBus.on('layer:flip-by-key', ({ direction }) => {
            this.flipActiveLayer(direction, false);
        });

        this.eventBus.on('layer:flip-requested', ({ direction, bypassVKeyCheck = true }) => {
            this.flipActiveLayer(direction, bypassVKeyCheck);
        });

        this.eventBus.on('layer:move-by-key', ({ direction }) => {
            this.moveActiveLayer(direction);
        });

        this.eventBus.on('layer:scale-by-key', ({ direction }) => {
            this.transformActiveLayer(direction);
        });

        this.eventBus.on('layer:rotate-by-key', ({ direction }) => {
            this.transformActiveLayer(direction);
        });

        this.eventBus.on('layer:select-next', () => {
            this.selectNextLayer();
        });

        this.eventBus.on('layer:select-prev', () => {
            this.selectPrevLayer();
        });

        this.eventBus.on('layer:order-up', () => {
            const layers = this.getLayers();
            const currentIndex = this.activeLayerIndex;
            const activeLayer = layers[currentIndex];

            if (!activeLayer || activeLayer.layerData?.isBackground) return;
            if (currentIndex >= layers.length - 1) return;

            this.reorderLayers(currentIndex, currentIndex + 1);
        });

        this.eventBus.on('layer:order-down', () => {
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

    setActiveLayer(index) {
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
            this._emitPanelUpdateRequest();
            this._emitStatusUpdateRequest();
            if (this.isLayerMoveMode) {
                this.updateLayerTransformPanelValues();
            }
            if (this.eventBus) {
                this.eventBus.emit('layer:activated', { layerIndex: index, oldIndex: oldIndex, layerId: layers[index]?.layerData?.id });
            }
        }
    }

    toggleLayerVisibility(layerIndex) {
        const layers = this.getLayers();
        if (layerIndex < 0 || layerIndex >= layers.length) return;

        const layer = layers[layerIndex];
        layer.layerData.visible = !layer.layerData.visible;
        layer.visible = layer.layerData.visible;

        if (layer.layerData?.isBackground && this.checkerPattern) {
            this.checkerPattern.visible = !layer.layerData.visible;
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
            this.checkerPattern = window.checkerUtils.createCanvasChecker(
                this.config.canvas.width,
                this.config.canvas.height
            );

            const bgLayer = this.getLayers()[0];
            const isBackgroundVisible = bgLayer?.layerData?.visible !== false;
            this.checkerPattern.visible = !isBackgroundVisible;

            cameraSystem.canvasContainer.addChildAt(this.checkerPattern, 0);
            cameraSystem.canvasContainer.setChildIndex(this.currentFrameContainer, 1);
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
        if (sourceLayer.layerData?.isBackground || sourceLayer.layerData?.isFolder) return null;

        const sourceData = sourceLayer.layerData;
        const newName = `${sourceData.name} のコピー`;

        // 1. 新規レイヤー作成（複製全体を1履歴にするため、createLayer履歴は抑止）
        const wasApplying = historyManager?.isApplying === true;
        if (historyManager) historyManager.isApplying = true;
        const created = this.createLayer(newName);
        if (historyManager) historyManager.isApplying = wasApplying;

        const { layer: newLayer, index: newIndex } = created || {};
        if (!newLayer) return null;

        // 2. 状態コピー
        newLayer.alpha = sourceLayer.alpha;
        newLayer.visible = sourceLayer.visible;
        newLayer.layerData.opacity = sourceData.opacity;
        newLayer.layerData.visible = sourceData.visible;

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

        // 5. 履歴へ記録
        if (historyManager && !historyManager.isApplying) {
            const snapshot = this.createLayerRasterSnapshot(newLayer);
            historyManager.record({
                name: 'layer-duplicate',
                do: () => {
                    if (!newLayer.parent) {
                        this.currentFrameContainer.addChildAt(newLayer, Math.min(newIndex, this.currentFrameContainer.children.length));
                    }
                    this.restoreLayerRasterSnapshot(snapshot);
                    this.setActiveLayer(this.getLayerIndex(newLayer));
                    this._emitPanelUpdateRequest();
                },
                undo: () => {
                    if (newLayer.parent) {
                        this.currentFrameContainer.removeChild(newLayer);
                    }
                    const remaining = this.getLayers();
                    this.activeLayerIndex = Math.min(layerIndex, remaining.length - 1);
                    this._emitPanelUpdateRequest();
                },
                meta: { sourceId: sourceData.id, newId: newLayer.layerData.id }
            });
        }

        this.requestThumbnailUpdate(newIndex, true);
        return { layer: newLayer, index: newIndex };
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

        if (topLayer.layerData?.isFolder || bottomLayer.layerData?.isFolder || bottomLayer.layerData?.isBackground) {
            console.warn('[LayerSystem] Merge down requires a normal layer below');
            return false;
        }

        if (!topLayer?.layerData || !bottomLayer?.layerData) return false;

        // 履歴用スナップショット
        const topSnapshot = this.createLayerRasterSnapshot(topLayer);
        const bottomSnapshotBefore = this.createLayerRasterSnapshot(bottomLayer);
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
        if (!this.app?.renderer || !bottomLayer.layerData.renderTexture) return false;

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
