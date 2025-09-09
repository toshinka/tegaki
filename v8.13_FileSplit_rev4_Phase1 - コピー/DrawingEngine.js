/**
 * DrawingEngine.js - Core Drawing Engine (Phase2対応版)
 * Phase2: レイヤー順序変更API実装 + ペンドラッグ対応
 * 
 * 実装内容:
 * - reorderLayer APIの完全実装
 * - PixiJS zIndex + sortChildren による描画順序制御
 * - レイヤー配列とPixiJS表示の完全同期
 * - サムネイル生成の最適化とリニア描画保持
 */
(function() {
    'use strict';
    
    // === ENGINE CONFIGURATION ===
    const ENGINE_CONFIG = {
        version: '8.0-Phase2-LayerReorder',
        canvas: { width: 400, height: 400 },
        rendering: { antialias: true, resolution: 1 },
        debug: false,
        history: { maxSize: 10, autoSaveInterval: 500 },
        transform: { minScale: 0.1, maxScale: 5.0, initialScale: 1.0 },
        thumbnail: { 
            size: 48, 
            updateThrottle: 100,
            pointDensity: 1.5
        }
    };
    
    const log = (message, ...args) => {
        if (ENGINE_CONFIG.debug) console.log(message, ...args);
    };

    // === NATIVE JS UTILITIES ===
    const utils = {
        clamp: (value, min, max) => Math.max(min, Math.min(max, value)),
        last: (array) => array[array.length - 1],
        remove: (array, predicate) => {
            const indices = [];
            for (let i = array.length - 1; i >= 0; i--) {
                if (predicate(array[i])) {
                    indices.push(i);
                    array.splice(i, 1);
                }
            }
            return indices.length;
        },
        reverse: (array) => [...array].reverse(),
        throttle: (func, delay) => {
            let timeoutId;
            let lastExecTime = 0;
            return function (...args) {
                const currentTime = Date.now();
                
                if (currentTime - lastExecTime > delay) {
                    func.apply(this, args);
                    lastExecTime = currentTime;
                } else {
                    clearTimeout(timeoutId);
                    timeoutId = setTimeout(() => {
                        func.apply(this, args);
                        lastExecTime = Date.now();
                    }, delay - (currentTime - lastExecTime));
                }
            };
        }
    };

    // === IMPROVED THUMBNAIL MANAGER ===
    class LayerThumbnailManager {
        constructor(drawingEngine) {
            this.engine = drawingEngine;
            this.thumbnailCache = new Map();
            this.updateThrottledMap = new Map();
        }

        /**
         * レイヤー個別のサムネイル生成（修正版）
         * メインキャンバス全体ではなく、指定レイヤーのパスのみを描画
         */
        generateLayerThumbnail(layerId) {
            if (!this.engine?.layerManager) return null;

            try {
                const layer = this.engine.layerManager.layers.items.find(l => l.id === layerId);
                if (!layer) return null;

                // オフスクリーンキャンバス作成
                const canvas = document.createElement('canvas');
                canvas.width = ENGINE_CONFIG.thumbnail.size;
                canvas.height = ENGINE_CONFIG.thumbnail.size;
                const ctx = canvas.getContext('2d');

                // スケール計算
                const scaleX = ENGINE_CONFIG.thumbnail.size / ENGINE_CONFIG.canvas.width;
                const scaleY = ENGINE_CONFIG.thumbnail.size / ENGINE_CONFIG.canvas.height;
                const scale = Math.min(scaleX, scaleY);

                // 背景描画
                if (layer.isBackground) {
                    ctx.fillStyle = '#f0e0d6';
                    ctx.fillRect(0, 0, ENGINE_CONFIG.thumbnail.size, ENGINE_CONFIG.thumbnail.size);
                } else {
                    ctx.clearRect(0, 0, ENGINE_CONFIG.thumbnail.size, ENGINE_CONFIG.thumbnail.size);
                }

                // レイヤーのパスを個別に描画
                if (layer.paths && layer.paths.length > 0) {
                    layer.paths.forEach(path => {
                        this.drawPathToThumbnail(ctx, path, scale);
                    });
                }

                const dataUrl = canvas.toDataURL();
                this.thumbnailCache.set(layerId, dataUrl);

                // UI通知
                if (window.UICallbacks?.onLayerThumbnailUpdated) {
                    window.UICallbacks.onLayerThumbnailUpdated(layerId, dataUrl);
                }

                log('📸 Layer thumbnail generated:', layerId);
                return dataUrl;

            } catch (error) {
                console.error('[ThumbnailManager] Generation failed for layer:', layerId, error);
                return null;
            }
        }

        /**
         * パスをサムネイルキャンバスに描画
         */
        drawPathToThumbnail(ctx, path, scale) {
            if (!path.points || path.points.length === 0) return;

            // カラーをRGBAに変換
            const color = this.colorToRgba(path.color, path.opacity);
            ctx.fillStyle = color;

            // パスのポイントを描画
            path.points.forEach(point => {
                const x = point.x * scale;
                const y = point.y * scale;
                const radius = (path.size / 2) * scale;

                if (radius > 0.1) { // 極小サイズは描画スキップ
                    ctx.beginPath();
                    ctx.arc(x, y, radius, 0, Math.PI * 2);
                    ctx.fill();
                }
            });
        }

        /**
         * 色値をRGBA文字列に変換
         */
        colorToRgba(color, opacity) {
            const r = (color >> 16) & 0xFF;
            const g = (color >> 8) & 0xFF;
            const b = color & 0xFF;
            return `rgba(${r}, ${g}, ${b}, ${opacity})`;
        }

        /**
         * スロットリング付きサムネイル更新
         */
        generateLayerThumbnailThrottled(layerId) {
            if (!this.updateThrottledMap.has(layerId)) {
                this.updateThrottledMap.set(layerId, utils.throttle(() => {
                    this.generateLayerThumbnail(layerId);
                }, ENGINE_CONFIG.thumbnail.updateThrottle));
            }
            
            this.updateThrottledMap.get(layerId)();
        }

        /**
         * 全レイヤーのサムネイル更新
         */
        updateAllThumbnails() {
            if (!this.engine?.layerManager) return;
            
            const layers = this.engine.layerManager.getLayerList();
            layers.forEach(layer => {
                this.generateLayerThumbnail(layer.id);
            });
        }

        /**
         * キャッシュクリア
         */
        clearCache() {
            this.thumbnailCache.clear();
        }
    }

    // === TRANSFORM SYSTEM ===
    class TransformSystem {
        constructor() {
            this.viewportTransform = {
                x: 0, y: 0,
                targetX: 0, targetY: 0,
                scale: ENGINE_CONFIG.transform.initialScale,
                targetScale: ENGINE_CONFIG.transform.initialScale
            };
            this.updateScheduled = false;
        }

        screenToWorld(screenPoint) {
            const viewport = this.viewportTransform;
            return {
                x: (screenPoint.x - viewport.x) / viewport.scale,
                y: (screenPoint.y - viewport.y) / viewport.scale
            };
        }

        worldToScreen(worldPoint) {
            const viewport = this.viewportTransform;
            return {
                x: worldPoint.x * viewport.scale + viewport.x,
                y: worldPoint.y * viewport.scale + viewport.y
            };
        }

        layerToWorld(layerPoint, layerTransform = null) {
            if (!layerTransform) return layerPoint;
            
            const cos = Math.cos(layerTransform.rotation || 0);
            const sin = Math.sin(layerTransform.rotation || 0);
            const scale = layerTransform.scale || 1;
            
            return {
                x: layerPoint.x * scale * cos - layerPoint.y * scale * sin + (layerTransform.x || 0),
                y: layerPoint.x * scale * sin + layerPoint.y * scale * cos + (layerTransform.y || 0)
            };
        }

        worldToLayer(worldPoint, layerTransform = null) {
            if (!layerTransform) return worldPoint;
            
            const offsetX = worldPoint.x - (layerTransform.x || 0);
            const offsetY = worldPoint.y - (layerTransform.y || 0);
            
            const cos = Math.cos(-(layerTransform.rotation || 0));
            const sin = Math.sin(-(layerTransform.rotation || 0));
            const scale = 1 / (layerTransform.scale || 1);
            
            return {
                x: (offsetX * cos - offsetY * sin) * scale,
                y: (offsetX * sin + offsetY * cos) * scale
            };
        }

        moveViewport(deltaX, deltaY) {
            this.viewportTransform.targetX += deltaX;
            this.viewportTransform.targetY += deltaY;
            
            const maxOffset = {
                x: (window.innerWidth - 310) / 2,
                y: window.innerHeight / 2
            };
            
            this.viewportTransform.targetX = utils.clamp(
                this.viewportTransform.targetX, 
                -maxOffset.x * 2, 
                maxOffset.x * 2
            );
            this.viewportTransform.targetY = utils.clamp(
                this.viewportTransform.targetY, 
                -maxOffset.y * 2, 
                maxOffset.y * 2
            );
            
            this.scheduleUpdate();
        }

        scaleViewport(scaleDelta, centerPoint = null) {
            this.viewportTransform.targetScale = utils.clamp(
                this.viewportTransform.targetScale * scaleDelta,
                ENGINE_CONFIG.transform.minScale,
                ENGINE_CONFIG.transform.maxScale
            );
            this.scheduleUpdate();
        }

        resetViewport() {
            this.viewportTransform.targetX = 0;
            this.viewportTransform.targetY = 0;
            this.viewportTransform.targetScale = ENGINE_CONFIG.transform.initialScale;
            this.scheduleUpdate();
        }

        scheduleUpdate() {
            this.updateScheduled = true;
        }

        updateTransforms() {
            if (!this.updateScheduled) return;

            const vt = this.viewportTransform;
            
            vt.x = vt.x + (vt.targetX - vt.x) * 0.2;
            vt.y = vt.y + (vt.targetY - vt.y) * 0.2;
            vt.scale = vt.scale + (vt.targetScale - vt.scale) * 0.2;

            this.applyViewportTransform();

            if (Math.abs(vt.targetX - vt.x) < 0.1 && 
                Math.abs(vt.targetY - vt.y) < 0.1 &&
                Math.abs(vt.targetScale - vt.scale) < 0.001) {
                vt.x = vt.targetX;
                vt.y = vt.targetY;
                vt.scale = vt.targetScale;
                this.updateScheduled = false;
            }
        }

        applyViewportTransform() {
            const container = document.getElementById('canvas-container');
            if (!container) return;

            const vt = this.viewportTransform;
            const viewportCenter = {
                x: (window.innerWidth - 310) / 2,
                y: window.innerHeight / 2
            };

            const offset = {
                x: viewportCenter.x + vt.x,
                y: viewportCenter.y + vt.y
            };

            container.style.transform = 
                `translate3d(${offset.x}px, ${offset.y}px, 0) translate(-50%, -50%) scale(${vt.scale})`;
            container.style.left = '0px';
            container.style.top = '0px';

            this._notifyTransformUpdated();
        }

        _notifyTransformUpdated() {
            if (window.UICallbacks?.onTransformUpdated) {
                window.UICallbacks.onTransformUpdated({
                    scale: this.viewportTransform.scale.toFixed(2)
                });
            }
        }

        getTransformState() {
            return {
                viewport: { ...this.viewportTransform }
            };
        }

        restoreTransformState(state) {
            if (state.viewport) {
                this.viewportTransform = { ...state.viewport };
                this.applyViewportTransform();
            }
        }
    }

    // === TRANSFORM HISTORY MANAGER ===
    class TransformHistoryManager {
        constructor(transformSystem, layerManager) {
            this.transform = transformSystem;
            this.layers = layerManager;
            this.history = [];
            this.currentIndex = -1;
            this.maxSize = ENGINE_CONFIG.history.maxSize;
            this.isPerformingOperation = false;
        }

        createSnapshot(actionName = 'Unknown Action', changedLayerId = null) {
            if (this.isPerformingOperation) return;

            const snapshot = {
                id: `snap_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
                timestamp: Date.now(),
                actionName: actionName,
                transformState: this.transform.getTransformState(),
                activeLayerId: this.layers.layers.activeId,
                changedLayers: changedLayerId ? 
                    this.serializeLayer(changedLayerId) : 
                    this.serializeActiveLayers(),
                // Phase2追加: レイヤー順序の保存
                layerOrder: this.layers.layers.items.map(l => ({ id: l.id, zIndex: l.container.zIndex }))
            };

            this.history = this.history.slice(0, this.currentIndex + 1);
            this.history.push(snapshot);

            if (this.history.length > this.maxSize) {
                this.history.shift();
            } else {
                this.currentIndex++;
            }

            this._notifyHistoryUpdated();
            log('📸 Snapshot:', actionName, 'Index:', this.currentIndex);
        }

        serializeActiveLayers() {
            const activeLayer = this.layers.getActiveLayer();
            if (!activeLayer) return {};

            return {
                [activeLayer.id]: {
                    id: activeLayer.id,
                    name: activeLayer.name,
                    visible: activeLayer.visible,
                    recentPaths: activeLayer.paths.slice(-5).map(path => ({
                        id: path.id,
                        points: [...path.points],
                        color: path.color,
                        size: path.size,
                        opacity: path.opacity,
                        isComplete: path.isComplete
                    }))
                }
            };
        }

        serializeLayer(layerId) {
            const layer = this.layers.layers.items.find(l => l.id === layerId);
            if (!layer) return {};

            return {
                [layerId]: {
                    id: layer.id,
                    name: layer.name,
                    visible: layer.visible,
                    paths: layer.paths.map(path => ({
                        id: path.id,
                        points: [...path.points],
                        color: path.color,
                        size: path.size,
                        opacity: path.opacity,
                        isComplete: path.isComplete
                    }))
                }
            };
        }

        undo() {
            if (this.currentIndex <= 0) return false;

            this.currentIndex--;
            this.restoreSnapshot(this.history[this.currentIndex]);
            log('↶ Undo to:', this.currentIndex);
            return true;
        }

        redo() {
            if (this.currentIndex >= this.history.length - 1) return false;

            this.currentIndex++;
            this.restoreSnapshot(this.history[this.currentIndex]);
            log('↷ Redo to:', this.currentIndex);
            return true;
        }

        restoreSnapshot(snapshot) {
            this.isPerformingOperation = true;

            try {
                this.transform.restoreTransformState(snapshot.transformState);
                this.restoreLayersFromSnapshot(snapshot.changedLayers);
                
                // Phase2追加: レイヤー順序の復元
                if (snapshot.layerOrder) {
                    this.restoreLayerOrder(snapshot.layerOrder);
                }
                
                this.layers.setActiveLayer(snapshot.activeLayerId);
            } finally {
                this.isPerformingOperation = false;
            }

            this._notifyHistoryUpdated();
        }

        restoreLayersFromSnapshot(changedLayers) {
            Object.values(changedLayers).forEach(layerData => {
                const existingLayer = this.layers.layers.items.find(l => l.id === layerData.id);
                if (existingLayer) {
                    existingLayer.visible = layerData.visible;
                    existingLayer.container.visible = layerData.visible;

                    if (layerData.paths || layerData.recentPaths) {
                        const pathsToRestore = layerData.paths || layerData.recentPaths;
                        this.restoreLayerPaths(existingLayer, pathsToRestore);
                    }
                }
            });

            if (window.UICallbacks?.onLayerListUpdated) {
                window.UICallbacks.onLayerListUpdated(this.layers.getLayerList());
            }
        }

        // Phase2追加: レイヤー順序復元機能
        restoreLayerOrder(layerOrder) {
            layerOrder.forEach(orderData => {
                const layer = this.layers.layers.items.find(l => l.id === orderData.id);
                if (layer) {
                    layer.container.zIndex = orderData.zIndex;
                }
            });
            
            // PixiJS描画順序更新
            if (this.layers.engine?.containers?.world) {
                this.layers.engine.containers.world.sortChildren();
            }
        }

        restoreLayerPaths(layer, pathsData) {
            layer.paths.forEach(path => {
                if (path.graphics && path.graphics.destroy) {
                    path.graphics.destroy();
                }
            });
            layer.container.removeChildren();

            if (layer.isBackground && layer.backgroundGraphics) {
                layer.container.addChild(layer.backgroundGraphics);
            }

            layer.paths = pathsData.map(pathData => {
                const path = {
                    id: pathData.id,
                    graphics: new PIXI.Graphics(),
                    points: [...pathData.points],
                    color: pathData.color,
                    size: pathData.size,
                    opacity: pathData.opacity,
                    isComplete: pathData.isComplete
                };

                this.redrawPath(path);
                layer.container.addChild(path.graphics);
                
                return path;
            });
        }

        redrawPath(path) {
            path.graphics.clear();
            if (path.points.length === 0) return;

            path.points.forEach(point => {
                path.graphics.circle(point.x, point.y, path.size / 2);
                path.graphics.fill({ color: path.color, alpha: path.opacity });
            });
        }

        _notifyHistoryUpdated() {
            if (window.UICallbacks?.onHistoryUpdated) {
                window.UICallbacks.onHistoryUpdated(this.currentIndex + 1, this.history.length);
            }
        }

        initialize() {
            this.createSnapshot('初期状態');
        }
    }

    // === LAYER MANAGER - Phase2拡張 ===
    class LayerManager {
        constructor(drawingEngine, transformSystem) {
            this.engine = drawingEngine;
            this.transform = transformSystem;
            this.layers = {
                items: [],
                activeId: null,
                nextId: 1
            };
            this.historyManager = null;
        }

        setHistoryManager(historyManager) {
            this.historyManager = historyManager;
        }

        initialize() {
            this.createBackgroundLayer();
            this.createLayer('レイヤー1');
            this.setActiveLayer(1);
        }

        createBackgroundLayer() {
            const layer = this._createLayerObject(0, '背景', true);

            const backgroundGraphics = new PIXI.Graphics();
            backgroundGraphics.rect(0, 0, ENGINE_CONFIG.canvas.width, ENGINE_CONFIG.canvas.height);
            backgroundGraphics.fill(0xf0e0d6);
            layer.container.addChild(backgroundGraphics);
            layer.backgroundGraphics = backgroundGraphics;

            // Phase2: 背景レイヤーのzIndex設定
            layer.container.zIndex = 0;

            this.layers.items.push(layer);
            this.engine.containers.world.addChild(layer.container);
            this.layers.activeId = layer.id;

            return layer;
        }

        createLayer(name = null) {
            const layer = this._createLayerObject(
                this.layers.nextId++, 
                name || `レイヤー${this.layers.nextId - 1}`, 
                false
            );

            // Phase2: 新レイヤーのzIndex設定（最上位に配置）
            layer.container.zIndex = this.layers.items.length;

            this.layers.items.push(layer);
            this.engine.containers.world.addChild(layer.container);
            
            // Phase2: 描画順序更新
            this.engine.containers.world.sortChildren();
            
            if (this.historyManager) {
                setTimeout(() => {
                    this.historyManager.createSnapshot(`レイヤー「${layer.name}」追加`, layer.id);
                }, 100);
            }

            this._notifyLayerCreated(layer);
            return layer;
        }

        _createLayerObject(id, name, isBackground) {
            const container = new PIXI.Container();
            container.name = name;
            container.visible = true;

            return {
                id,
                name,
                container,
                visible: true,
                paths: [],
                isBackground,
                layerTransform: {
                    x: 0, y: 0,
                    rotation: 0,
                    scaleX: 1, scaleY: 1
                }
            };
        }

        deleteLayer(layerId) {
            if (this.layers.items.length <= 1) return false;

            const layer = this.layers.items.find(l => l.id === layerId);
            if (!layer) return false;

            layer.paths.forEach(path => path.graphics.destroy());
            this.engine.containers.world.removeChild(layer.container);
            layer.container.destroy();

            utils.remove(this.layers.items, l => l.id === layerId);

            // Phase2: 削除後のzIndex再計算
            this._updateAllZIndices();

            if (this.layers.activeId === layerId) {
                const lastLayer = utils.last(this.layers.items);
                this.layers.activeId = lastLayer ? lastLayer.id : null;
            }

            if (this.historyManager) {
                setTimeout(() => {
                    this.historyManager.createSnapshot(`レイヤー「${layer.name}」削除`);
                }, 100);
            }

            this._notifyLayerDeleted(layerId);
            this._notifyActiveLayerChanged();
            return true;
        }

        /**
         * Phase2: レイヤー順序変更の核心機能
         * UI側の配列操作とPixiJS描画順序を完全同期
         */
        reorderLayer(layerId, fromIndex, toIndex) {
            if (fromIndex === toIndex || fromIndex < 0 || toIndex < 0) return false;
            if (fromIndex >= this.layers.items.length || toIndex >= this.layers.items.length) return false;
            
            log('🔄 Layer reorder request:', { layerId, fromIndex, toIndex });

            // 配列操作: レイヤーを移動
            const layer = this.layers.items[fromIndex];
            if (!layer || layer.id !== layerId) {
                console.error('[LayerManager] Layer ID mismatch in reorder operation');
                return false;
            }

            // 配列から削除して新位置に挿入
            this.layers.items.splice(fromIndex, 1);
            this.layers.items.splice(toIndex, 0, layer);

            // Phase2: PixiJS zIndex更新（重要: 配列インデックスと同期）
            this._updateAllZIndices();

            // 描画順序をPixiJSに反映
            this.engine.containers.world.sortChildren();

            // レイヤーリスト更新通知
            this._notifyLayerListUpdated();

            // 履歴スナップショット作成
            if (this.historyManager) {
                setTimeout(() => {
                    this.historyManager.createSnapshot(`レイヤー「${layer.name}」順序変更`, layer.id);
                }, 100);
            }

            log('✅ Layer reorder completed:', { 
                layerId, 
                newOrder: this.layers.items.map(l => ({ id: l.id, zIndex: l.container.zIndex }))
            });

            return true;
        }

        /**
         * Phase2: 全レイヤーのzIndex更新
         * 配列インデックスをそのままzIndexに設定してPixiJS描画順序制御
         */
        _updateAllZIndices() {
            this.layers.items.forEach((layer, index) => {
                layer.container.zIndex = index;
            });
            log('📊 ZIndex updated:', this.layers.items.map(l => `${l.name}:${l.container.zIndex}`));
        }

        setActiveLayer(layerId) {
            const layer = this.layers.items.find(l => l.id === layerId);
            if (layer) {
                this.layers.activeId = layerId;
                this._notifyActiveLayerChanged();
                return true;
            }
            return false;
        }

        toggleLayerVisibility(layerId) {
            const layer = this.layers.items.find(l => l.id === layerId);
            if (layer) {
                layer.visible = !layer.visible;
                layer.container.visible = layer.visible;

                if (this.historyManager) {
                    const action = layer.visible ? '表示' : '非表示';
                    setTimeout(() => {
                        this.historyManager.createSnapshot(`レイヤー「${layer.name}」${action}`, layer.id);
                    }, 100);
                }

                this._notifyLayerVisibilityChanged(layerId, layer.visible);
                return true;
            }
            return false;
        }

        getActiveLayer() {
            return this.layers.items.find(l => l.id === this.layers.activeId);
        }

        getLayerList() {
            return this.layers.items.map(layer => ({
                id: layer.id,
                name: layer.name,
                visible: layer.visible,
                isActive: layer.id === this.layers.activeId
            }));
        }

        /**
         * パスをアクティブレイヤーに追加（修正版）
         * リアルタイム描画のため、即座にレイヤーに追加
         */
        addPathToActiveLayer(path) {
            const activeLayer = this.getActiveLayer();
            if (activeLayer) {
                activeLayer.paths.push(path);
                activeLayer.container.addChild(path.graphics);

                // リアルタイムでサムネイル更新（スロットリング付き）
                if (this.engine.thumbnailManager) {
                    this.engine.thumbnailManager.generateLayerThumbnailThrottled(activeLayer.id);
                }

                if (path.isComplete && this.historyManager) {
                    setTimeout(() => {
                        this.historyManager.createSnapshot('描画', activeLayer.id);
                    }, ENGINE_CONFIG.history.autoSaveInterval);
                }
            }
        }

        _notifyLayerCreated(layer) {
            if (window.UICallbacks?.onLayerCreated) {
                window.UICallbacks.onLayerCreated({
                    id: layer.id,
                    name: layer.name,
                    visible: layer.visible
                });
            }
        }

        _notifyLayerDeleted(layerId) {
            if (window.UICallbacks?.onLayerDeleted) {
                window.UICallbacks.onLayerDeleted(layerId);
            }
        }

        _notifyActiveLayerChanged() {
            const activeLayer = this.getActiveLayer();
            if (activeLayer && window.UICallbacks?.onActiveLayerChanged) {
                window.UICallbacks.onActiveLayerChanged(activeLayer.id, activeLayer.name);
            }
        }

        _notifyLayerVisibilityChanged(layerId, visible) {
            if (window.UICallbacks?.onLayerVisibilityChanged) {
                window.UICallbacks.onLayerVisibilityChanged(layerId, visible);
            }
        }

        // Phase2追加: レイヤーリスト更新通知
        _notifyLayerListUpdated() {
            if (window.UICallbacks?.onLayerListUpdated) {
                window.UICallbacks.onLayerListUpdated(this.getLayerList());
            }
        }
    }

    // === IMPROVED DRAWING TOOLS ===
    class DrawingTools {
        constructor(drawingEngine, layerManager, transformSystem) {
            this.engine = drawingEngine;
            this.layers = layerManager;
            this.transform = transformSystem;
            this.currentTool = 'pen';
            this.brushSize = 16.0;
            this.brushColor = 0x800000;
            this.opacity = 0.85;
            this.drawing = { active: false, path: null, lastPoint: null };
        }

        selectTool(tool) {
            this.currentTool = tool;
            this._notifyToolChanged();
        }

        setBrushSize(size) {
            this.brushSize = utils.clamp(Math.round(size * 10) / 10, 0.1, 100);
        }

        setOpacity(opacity) {
            this.opacity = utils.clamp(Math.round(opacity * 1000) / 1000, 0, 1);
        }

        getToolSettings(toolType = null) {
            const tool = toolType || this.currentTool;
            return {
                size: this.brushSize,
                opacity: this.opacity,
                color: this.brushColor
            };
        }

        /**
         * 描画開始（修正版）
         * 即座にアクティブレイヤーにパスを追加してリアルタイム描画を実現
         */
        startDrawing(canvasX, canvasY, isPanning) {
            if (isPanning) return false;
            
            this.drawing.active = true;
            this.drawing.lastPoint = { x: canvasX, y: canvasY };

            const color = this.currentTool === 'eraser' ? 0xf0e0d6 : this.brushColor;
            const alpha = this.currentTool === 'eraser' ? 1.0 : this.opacity;

            this.drawing.path = this.engine.createPath(canvasX, canvasY, this.brushSize, color, alpha);
            
            // 即座にアクティブレイヤーに追加（リニア描画の核心）
            const activeLayer = this.layers.getActiveLayer();
            if (activeLayer) {
                activeLayer.paths.push(this.drawing.path);
                activeLayer.container.addChild(this.drawing.path.graphics);
                
                // 描画開始時にサムネイル更新開始
                if (this.engine.thumbnailManager) {
                    this.engine.thumbnailManager.generateLayerThumbnailThrottled(activeLayer.id);
                }
            }
            
            return true;
        }

        /**
         * 描画継続（修正版）
         * パスがすでにレイヤーに追加済みなので、継続的に拡張するだけ
         */
        continueDrawing(canvasX, canvasY, isPanning) {
            if (!this.drawing.active || !this.drawing.path || isPanning) return;

            this.engine.extendPath(this.drawing.path, canvasX, canvasY);
            
            // リアルタイムでサムネイル更新（スロットリング付き）
            const activeLayer = this.layers.getActiveLayer();
            if (activeLayer && this.engine.thumbnailManager) {
                this.engine.thumbnailManager.generateLayerThumbnailThrottled(activeLayer.id);
            }
            
            this.drawing.lastPoint = { x: canvasX, y: canvasY };
        }

        /**
         * 描画終了（修正版）
         * パスを完了状態にし、履歴スナップショットを作成
         */
        stopDrawing() {
            if (this.drawing.path) {
                this.drawing.path.isComplete = true;
                
                const activeLayer = this.layers.getActiveLayer();
                if (activeLayer) {
                    // 描画完了時に最終サムネイル更新
                    if (this.engine.thumbnailManager) {
                        setTimeout(() => {
                            this.engine.thumbnailManager.generateLayerThumbnail(activeLayer.id);
                        }, 50);
                    }
                    
                    // 履歴スナップショット作成
                    if (this.layers.historyManager) {
                        setTimeout(() => {
                            this.layers.historyManager.createSnapshot('描画', activeLayer.id);
                        }, ENGINE_CONFIG.history.autoSaveInterval);
                    }
                }
            }
            this.drawing = { active: false, path: null, lastPoint: null };
        }

        _notifyToolChanged() {
            if (window.UICallbacks?.onToolChanged) {
                const toolNames = { pen: 'ベクターペン', eraser: '消しゴム' };
                window.UICallbacks.onToolChanged(this.currentTool, toolNames[this.currentTool]);
            }
        }
    }

    // === SYSTEM MONITOR ===
    class SystemMonitor {
        constructor() {
            this.frameCount = 0;
            this.lastTime = performance.now();
        }

        start() {
            const update = () => {
                this.frameCount++;
                const currentTime = performance.now();

                if (currentTime - this.lastTime >= 1000) {
                    const fps = Math.round((this.frameCount * 1000) / (currentTime - this.lastTime));
                    
                    if (window.UICallbacks?.onFPSUpdated) {
                        window.UICallbacks.onFPSUpdated(fps);
                    }

                    this.frameCount = 0;
                    this.lastTime = currentTime;
                }

                requestAnimationFrame(update);
            };

            update();
        }
    }

    // === DRAWING ENGINE ===
    class DrawingEngine {
        constructor(transformSystem) {
            this.transform = transformSystem;
            this.app = null;
            this.containers = { camera: null, world: null, ui: null };
            this.paths = [];
            this.tools = null;
            this.layerManager = null;
            this.thumbnailManager = null;
        }

        async initialize() {
            this.app = new PIXI.Application();
            await this.app.init({
                width: ENGINE_CONFIG.canvas.width,
                height: ENGINE_CONFIG.canvas.height,
                background: 0xf0e0d6,
                backgroundAlpha: 1,
                antialias: ENGINE_CONFIG.rendering.antialias,
                resolution: ENGINE_CONFIG.rendering.resolution,
                autoDensity: false
            });

            this.setupContainers();
            this.setupInteraction();

            // 改良版サムネイル管理初期化
            this.thumbnailManager = new LayerThumbnailManager(this);

            return true;
        }

        setupContainers() {
            this.containers.camera = new PIXI.Container();
            this.containers.world = new PIXI.Container();
            this.containers.ui = new PIXI.Container();

            // Phase2: world containerにソート機能を設定
            this.containers.world.sortableChildren = true;

            const maskGraphics = new PIXI.Graphics();
            maskGraphics.rect(0, 0, ENGINE_CONFIG.canvas.width, ENGINE_CONFIG.canvas.height);
            maskGraphics.fill(0x000000);
            this.app.stage.addChild(maskGraphics);
            this.containers.camera.mask = maskGraphics;

            this.containers.camera.addChild(this.containers.world);
            this.app.stage.addChild(this.containers.camera);
            this.app.stage.addChild(this.containers.ui);

            this.containers.world.x = 0;
            this.containers.world.y = 0;
            this.containers.world.scale.set(1);
        }

        setupInteraction() {
            this.containers.camera.eventMode = "static";
            this.containers.camera.hitArea = new PIXI.Rectangle(0, 0, ENGINE_CONFIG.canvas.width, ENGINE_CONFIG.canvas.height);

            this.containers.camera.on('pointerdown', (e) => this.onPointerDown(e));
            this.containers.camera.on('pointermove', (e) => this.onPointerMove(e));
            this.containers.camera.on('pointerup', (e) => this.onPointerUp(e));
            this.containers.camera.on('pointerupoutside', (e) => this.onPointerUp(e));
            this.containers.camera.on('pointercancel', (e) => this.onPointerUp(e));
        }

        onPointerDown(event) {
            const spacePressed = window.DrawingEngineAPI._spacePressed;
            const originalEvent = event.data.originalEvent;

            if (spacePressed) {
                event.stopPropagation();
            } else {
                if (originalEvent.pointerType === 'pen' && originalEvent.pressure === 0) {
                    return;
                }

                this.tools.startDrawing(event.global.x, event.global.y, spacePressed);
            }
        }

        onPointerMove(event) {
            const spacePressed = window.DrawingEngineAPI._spacePressed;
            const originalEvent = event.data.originalEvent;

            if (spacePressed) {
                this._notifyCoordinatesUpdated(event.global.x, event.global.y);
                return;
            } else {
                if (originalEvent.pointerType === 'pen' && originalEvent.pressure === 0) {
                    return;
                }

                this.tools.continueDrawing(event.global.x, event.global.y, spacePressed);
                this._notifyCoordinatesUpdated(event.global.x, event.global.y);
            }
        }

        onPointerUp(event) {
            const spacePressed = window.DrawingEngineAPI._spacePressed;

            if (!spacePressed) {
                this.tools.stopDrawing();
            }
        }

        /**
         * パス作成（修正版）
         * 密度調整でパフォーマンス最適化
         */
        createPath(x, y, size, color, opacity) {
            const path = {
                id: `path_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                graphics: new PIXI.Graphics(),
                points: [],
                color, size, opacity,
                isComplete: false
            };

            path.graphics.circle(x, y, size / 2);
            path.graphics.fill({ color: path.color, alpha: path.opacity });

            path.points.push({ x, y, size });

            this.paths.push(path);
            return path;
        }

        /**
         * パス拡張（修正版）
         * 点密度調整でスムーズな描画とパフォーマンス両立
         */
        extendPath(path, x, y) {
            if (!path || path.points.length === 0) return;

            const lastPoint = utils.last(path.points);
            const distance = Math.sqrt((x - lastPoint.x) ** 2 + (y - lastPoint.y) ** 2);

            if (distance < ENGINE_CONFIG.thumbnail.pointDensity) return;

            const steps = Math.max(1, Math.ceil(distance / ENGINE_CONFIG.thumbnail.pointDensity));
            for (let i = 1; i <= steps; i++) {
                const t = i / steps;
                const px = lastPoint.x + (x - lastPoint.x) * t;
                const py = lastPoint.y + (y - lastPoint.y) * t;

                path.graphics.circle(px, py, path.size / 2);
                path.graphics.fill({ color: path.color, alpha: path.opacity });

                path.points.push({ x: px, y: py, size: path.size });
            }
        }

        resize(newWidth, newHeight) {
            ENGINE_CONFIG.canvas.width = newWidth;
            ENGINE_CONFIG.canvas.height = newHeight;

            this.app.renderer.resize(newWidth, newHeight);

            if (this.containers.camera.mask) {
                this.containers.camera.mask.clear();
                this.containers.camera.mask.rect(0, 0, newWidth, newHeight);
                this.containers.camera.mask.fill(0x000000);
            }

            this.containers.camera.hitArea = new PIXI.Rectangle(0, 0, newWidth, newHeight);

            // Update background layer
            this.layerManager.layers.items.forEach(layer => {
                if (layer.isBackground && layer.backgroundGraphics) {
                    layer.backgroundGraphics.clear();
                    layer.backgroundGraphics.rect(0, 0, newWidth, newHeight);
                    layer.backgroundGraphics.fill(0xf0e0d6);
                }
            });

            // 全レイヤーのサムネイル更新
            setTimeout(() => {
                this.thumbnailManager.updateAllThumbnails();
            }, 200);

            if (window.UICallbacks?.onCanvasResized) {
                window.UICallbacks.onCanvasResized(newWidth, newHeight);
            }
        }

        clear() {
            this.paths.forEach(path => path.graphics.destroy());
            this.paths = [];

            this.layerManager.layers.items.forEach(layer => {
                layer.paths = [];
                layer.container.removeChildren();
                if (layer.isBackground && layer.backgroundGraphics) {
                    layer.container.addChild(layer.backgroundGraphics);
                }
            });

            // サムネイルキャッシュクリア & 更新
            this.thumbnailManager.clearCache();
            setTimeout(() => {
                this.thumbnailManager.updateAllThumbnails();
            }, 100);
        }

        _notifyCoordinatesUpdated(x, y) {
            if (window.UICallbacks?.onCoordinatesUpdated) {
                window.UICallbacks.onCoordinatesUpdated(Math.round(x), Math.round(y));
            }
        }
    }

    // === ENGINE INSTANCE ===
    let engineInstance = null;

    // === API IMPLEMENTATION - Phase2拡張 ===
    window.DrawingEngineAPI = {
        _spacePressed: false,

        // === 初期化 ===
        initialize: async (containerElement) => {
            if (engineInstance) {
                console.error('[DrawingEngine] Already initialized');
                return false;
            }

            try {
                const transformSystem = new TransformSystem();
                const drawingEngine = new DrawingEngine(transformSystem);
                
                await drawingEngine.initialize();
                
                containerElement.appendChild(drawingEngine.app.canvas);

                const layerManager = new LayerManager(drawingEngine, transformSystem);
                const drawingTools = new DrawingTools(drawingEngine, layerManager, transformSystem);
                const historyManager = new TransformHistoryManager(transformSystem, layerManager);
                const systemMonitor = new SystemMonitor();

                // 相互参照設定
                drawingEngine.tools = drawingTools;
                drawingEngine.layerManager = layerManager;
                layerManager.setHistoryManager(historyManager);

                // 初期化
                layerManager.initialize();
                systemMonitor.start();
                historyManager.initialize();

                // Ticker追加
                drawingEngine.app.ticker.add(() => transformSystem.updateTransforms());

                engineInstance = {
                    transformSystem,
                    drawingEngine,
                    layerManager,
                    drawingTools,
                    historyManager,
                    systemMonitor
                };

                log('🎨 DrawingEngine initialized (Phase2-LayerReorder)');
                return true;

            } catch (error) {
                console.error('[DrawingEngine] Initialization failed:', error.message);
                return false;
            }
        },

        destroy: () => {
            if (!engineInstance) return;

            try {
                if (engineInstance.drawingEngine?.thumbnailManager) {
                    engineInstance.drawingEngine.thumbnailManager.clearCache();
                }
                if (engineInstance.drawingEngine?.app) {
                    engineInstance.drawingEngine.app.destroy(true);
                }
                engineInstance = null;
                log('🎨 DrawingEngine destroyed');
            } catch (error) {
                console.error('[DrawingEngine] Destroy failed:', error.message);
            }
        },

        // === キャンバス制御 ===
        resize: (width, height) => {
            if (!engineInstance) return false;
            try {
                engineInstance.drawingEngine.resize(width, height);
                return true;
            } catch (error) {
                console.error('[DrawingEngine] Resize failed:', error.message);
                return false;
            }
        },

        clear: () => {
            if (!engineInstance) return false;
            try {
                engineInstance.drawingEngine.clear();
                return true;
            } catch (error) {
                console.error('[DrawingEngine] Clear failed:', error.message);
                return false;
            }
        },

        // === ツール制御 ===
        setActiveTool: (toolType, settings = {}) => {
            if (!engineInstance) return false;
            try {
                engineInstance.drawingTools.selectTool(toolType);
                
                if (settings.size !== undefined) {
                    engineInstance.drawingTools.setBrushSize(settings.size);
                }
                if (settings.opacity !== undefined) {
                    engineInstance.drawingTools.setOpacity(settings.opacity);
                }
                
                return true;
            } catch (error) {
                console.error('[DrawingEngine] SetActiveTool failed:', error.message);
                return false;
            }
        },

        getActiveTool: () => {
            if (!engineInstance) return null;
            return engineInstance.drawingTools.currentTool;
        },

        getToolSettings: (toolType = null) => {
            if (!engineInstance) return {};
            return engineInstance.drawingTools.getToolSettings(toolType);
        },

        // === レイヤー制御 ===
        createLayer: (name = null) => {
            if (!engineInstance) return null;
            try {
                const layer = engineInstance.layerManager.createLayer(name);
                return layer ? layer.id : null;
            } catch (error) {
                console.error('[DrawingEngine] CreateLayer failed:', error.message);
                return null;
            }
        },

        deleteLayer: (layerId) => {
            if (!engineInstance) return false;
            try {
                return engineInstance.layerManager.deleteLayer(layerId);
            } catch (error) {
                console.error('[DrawingEngine] DeleteLayer failed:', error.message);
                return false;
            }
        },

        setActiveLayer: (layerId) => {
            if (!engineInstance) return false;
            try {
                return engineInstance.layerManager.setActiveLayer(layerId);
            } catch (error) {
                console.error('[DrawingEngine] SetActiveLayer failed:', error.message);
                return false;
            }
        },

        toggleLayerVisibility: (layerId) => {
            if (!engineInstance) return false;
            try {
                return engineInstance.layerManager.toggleLayerVisibility(layerId);
            } catch (error) {
                console.error('[DrawingEngine] ToggleLayerVisibility failed:', error.message);
                return false;
            }
        },

        getLayerList: () => {
            if (!engineInstance) return [];
            try {
                return engineInstance.layerManager.getLayerList();
            } catch (error) {
                console.error('[DrawingEngine] GetLayerList failed:', error.message);
                return [];
            }
        },

        // === Phase2: レイヤー順序変更API ===
        reorderLayer: (layerId, fromIndex, toIndex) => {
            if (!engineInstance) return false;
            try {
                const success = engineInstance.layerManager.reorderLayer(layerId, fromIndex, toIndex);
                
                if (success && window.UICallbacks?.onLayerListUpdated) {
                    window.UICallbacks.onLayerListUpdated(engineInstance.layerManager.getLayerList());
                }
                
                return success;
            } catch (error) {
                console.error('[DrawingEngine] ReorderLayer failed:', error.message);
                return false;
            }
        },

        // === 座標変換 ===
        resetViewport: () => {
            if (!engineInstance) return false;
            try {
                engineInstance.transformSystem.resetViewport();
                return true;
            } catch (error) {
                console.error('[DrawingEngine] ResetViewport failed:', error.message);
                return false;
            }
        },

        moveViewport: (deltaX, deltaY) => {
            if (!engineInstance) return false;
            try {
                engineInstance.transformSystem.moveViewport(deltaX, deltaY);
                return true;
            } catch (error) {
                console.error('[DrawingEngine] MoveViewport failed:', error.message);
                return false;
            }
        },

        getTransformState: () => {
            if (!engineInstance) return null;
            try {
                return engineInstance.transformSystem.getTransformState();
            } catch (error) {
                console.error('[DrawingEngine] GetTransformState failed:', error.message);
                return null;
            }
        },

        screenToWorld: (x, y) => {
            if (!engineInstance) return { x, y };
            try {
                return engineInstance.transformSystem.screenToWorld({ x, y });
            } catch (error) {
                console.error('[DrawingEngine] ScreenToWorld failed:', error.message);
                return { x, y };
            }
        },

        worldToScreen: (x, y) => {
            if (!engineInstance) return { x, y };
            try {
                return engineInstance.transformSystem.worldToScreen({ x, y });
            } catch (error) {
                console.error('[DrawingEngine] WorldToScreen failed:', error.message);
                return { x, y };
            }
        },

        // === 履歴制御 ===
        undo: () => {
            if (!engineInstance) return false;
            try {
                return engineInstance.historyManager.undo();
            } catch (error) {
                console.error('[DrawingEngine] Undo failed:', error.message);
                return false;
            }
        },

        redo: () => {
            if (!engineInstance) return false;
            try {
                return engineInstance.historyManager.redo();
            } catch (error) {
                console.error('[DrawingEngine] Redo failed:', error.message);
                return false;
            }
        },

        createSnapshot: (actionName = 'Unknown Action') => {
            if (!engineInstance) return false;
            try {
                engineInstance.historyManager.createSnapshot(actionName);
                return true;
            } catch (error) {
                console.error('[DrawingEngine] CreateSnapshot failed:', error.message);
                return false;
            }
        },

        // === 改良版サムネイル制御 ===
        updateThumbnail: (layerId) => {
            if (!engineInstance?.drawingEngine?.thumbnailManager) return false;
            try {
                engineInstance.drawingEngine.thumbnailManager.generateLayerThumbnail(layerId);
                return true;
            } catch (error) {
                console.error('[DrawingEngine] UpdateThumbnail failed:', error.message);
                return false;
            }
        },

        updateAllThumbnails: () => {
            if (!engineInstance?.drawingEngine?.thumbnailManager) return false;
            try {
                engineInstance.drawingEngine.thumbnailManager.updateAllThumbnails();
                return true;
            } catch (error) {
                console.error('[DrawingEngine] UpdateAllThumbnails failed:', error.message);
                return false;
            }
        },

        // === Space key状態管理 ===
        setSpacePressed: (pressed) => {
            window.DrawingEngineAPI._spacePressed = pressed;
        }
    };

    // === デバッグ用 DevTools ===
    if (ENGINE_CONFIG.debug) {
        window.DrawingEngineDevTools = {
            getEngineInstance: () => engineInstance,
            getConfig: () => ENGINE_CONFIG,
            forceSnapshot: (name) => engineInstance?.historyManager.createSnapshot(name || 'Debug Snapshot'),
            getLayerData: () => engineInstance?.layerManager.layers,
            getTransformData: () => engineInstance?.transformSystem.viewportTransform,
            getThumbnailManager: () => engineInstance?.drawingEngine.thumbnailManager,
            generateThumbnailDebug: (layerId) => {
                console.log('=== THUMBNAIL DEBUG ===');
                const result = engineInstance?.drawingEngine.thumbnailManager.generateLayerThumbnail(layerId);
                console.log('Result:', result ? 'SUCCESS' : 'FAILED');
                return result;
            },
            // Phase2追加: レイヤー順序デバッグ
            debugLayerOrder: () => {
                console.log('=== LAYER ORDER DEBUG ===');
                const layers = engineInstance?.layerManager.layers.items || [];
                layers.forEach((layer, index) => {
                    console.log(`[${index}] ${layer.name} (ID: ${layer.id}, zIndex: ${layer.container.zIndex})`);
                });
                return layers.map(l => ({ name: l.name, id: l.id, zIndex: l.container.zIndex }));
            },
            forceReorderTest: (fromIndex, toIndex) => {
                const layers = engineInstance?.layerManager.layers.items || [];
                if (layers[fromIndex]) {
                    const layerId = layers[fromIndex].id;
                    console.log(`Testing reorder: Layer ${layerId} from ${fromIndex} to ${toIndex}`);
                    return engineInstance?.layerManager.reorderLayer(layerId, fromIndex, toIndex);
                }
                return false;
            }
        };
    }

    log('🎨 DrawingEngine.js loaded (Phase2 - レイヤー順序変更API実装完了)');

})();