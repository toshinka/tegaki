// ===== system/layer-system.js - Phase 7対応版 =====

(function() {
    'use strict';

    class LayerSystem {
        constructor() {
            this.app = null;
            this.config = null;
            this.eventBus = null;
            
            this.currentCutContainer = null;
            this.activeLayerIndex = -1;
            
            this.cutRenderTextures = new Map();
            this.cutThumbnailDirty = new Map();
            
            this.layerTransforms = new Map();
            
            this.thumbnailUpdateQueue = new Set();
            this.thumbnailUpdateTimer = null;
            
            this.vKeyPressed = false;
            this.isLayerMoveMode = false;
            this.isLayerDragging = false;
            this.layerDragLastPoint = { x: 0, y: 0 };
            
            this.layerTransformPanel = null;
            
            this.cameraSystem = null;
            this.animationSystem = null;
            
            this.coordAPI = window.CoordinateSystem;
            if (!this.coordAPI) {
                console.warn('CoordinateSystem not available - fallback to basic transforms');
            }
        }

        init(canvasContainer, eventBus, config) {
            this.eventBus = eventBus;
            this.config = config || window.TEGAKI_CONFIG;
            
            if (!this.eventBus) {
                throw new Error('EventBus required for LayerSystem');
            }
            
            this.currentCutContainer = new PIXI.Container();
            this.currentCutContainer.label = 'temporary_cut_container';
            
            // Phase 4: 背景レイヤーもLayerModelを使用
            const bgLayer = new PIXI.Container();
            const bgLayerModel = new window.TegakiDataModels.LayerModel({
                id: 'temp_layer_bg_' + Date.now(),
                name: '背景',
                isBackground: true
            });
            
            bgLayer.label = bgLayerModel.id;
            bgLayer.layerData = bgLayerModel;
            
            const bg = new PIXI.Graphics();
            bg.rect(0, 0, this.config.canvas.width, this.config.canvas.height);
            bg.fill(this.config.background.color);
            bgLayer.addChild(bg);
            bgLayer.layerData.backgroundGraphics = bg;
            
            this.currentCutContainer.addChild(bgLayer);
            
            // Phase 4: レイヤー1もLayerModelを使用
            const layer1 = new PIXI.Container();
            const layer1Model = new window.TegakiDataModels.LayerModel({
                id: 'temp_layer_1_' + Date.now(),
                name: 'レイヤー1'
            });
            
            layer1.label = layer1Model.id;
            layer1.layerData = layer1Model;
            
            this.currentCutContainer.addChild(layer1);
            
            this.activeLayerIndex = 1;
            
            this._setupLayerOperations();
            this._setupLayerTransformPanel();
            this._setupAnimationSystemIntegration();
            this._startThumbnailUpdateProcess();
        }

        // ========== Phase 1: メモリリーク解消 ==========
rebuildPathGraphics(path) {
    try {
        // Phase 1: 既存のGraphicsを完全に破棄（子要素も含む）
        if (path.graphics) {
            try {
                if (path.graphics.destroy && typeof path.graphics.destroy === 'function') {
                    path.graphics.destroy({ 
                        children: true,      // 子要素も破棄
                        texture: false, 
                        baseTexture: false 
                    });
                }
            } catch (destroyError) {
            }
            path.graphics = null;
        }
        
        path.graphics = new PIXI.Graphics();
        
        if (!path.points || !Array.isArray(path.points) || path.points.length === 0) {
            return true;
        }
        
        // Perfect Freehandが利用可能かつstrokeOptionsがある場合
        if (path.strokeOptions && typeof getStroke !== 'undefined') {
            try {
                // Phase 2: スケール再計算を廃止（描画時のサイズを固定使用）
                const renderSize = path.size;
                
                const options = {
                    ...path.strokeOptions,
                    size: renderSize,
                    color: path.color,
                    alpha: path.opacity
                };
                
                const outlinePoints = getStroke(path.points, options);
                
                if (outlinePoints && outlinePoints.length > 0) {
                    path.graphics.poly(outlinePoints);
                    path.graphics.fill({ 
                        color: path.color || 0x000000, 
                        alpha: path.opacity || 1.0 
                    });
                    return true;
                }
            } catch (pfError) {
                // Perfect Freehand失敗時はフォールバック
            }
        }
        
        // 🔥 フォールバック: 筆圧対応の円の連続描画
        for (let point of path.points) {
            if (typeof point.x === 'number' && typeof point.y === 'number' &&
                isFinite(point.x) && isFinite(point.y)) {
                
                // 🔥 筆圧対応: 各ポイントに筆圧情報がある場合はそれを使用
                const pressure = (typeof point.pressure === 'number' && point.pressure > 0) 
                    ? point.pressure 
                    : 0.5;
                
                // 🔥 筆圧に応じてサイズを調整 (0.5倍～1.0倍の範囲)
                const pressureAdjustedSize = (path.size || 16) * (0.5 + pressure * 0.5);
                
                path.graphics.circle(point.x, point.y, pressureAdjustedSize / 2);
                path.graphics.fill({ 
                    color: path.color || 0x800000, 
                    alpha: path.opacity || 1.0 
                });
            }
        }
        
        return true;
        
    } catch (error) {
        path.graphics = null;
        return false;
    }
}
        // ========== Phase 7: ペンツール統合 ==========
        addPathToActiveLayer(path) {
            if (!this.getActiveLayer()) return;
            
            const activeLayer = this.getActiveLayer();
            const layerIndex = this.activeLayerIndex;
            
            // DataModel を通して追加
            if (activeLayer.layerData && activeLayer.layerData.paths) {
                activeLayer.layerData.paths.push(path);
            }
            // 互換性維持（既存の layer.paths にも追加）
            if (!activeLayer.layerData) {
                activeLayer.paths = activeLayer.paths || [];
                activeLayer.paths.push(path);
            }
            
            this.rebuildPathGraphics(path);
            
            if (path.graphics) {
                activeLayer.addChild(path.graphics);
            }
            
            this.requestThumbnailUpdate(layerIndex);
            
            // EventBus通知
            if (this.eventBus) {
                this.eventBus.emit('layer:stroke-added', { 
                    path, 
                    layerIndex,
                    layerId: activeLayer.label
                });
            }
        }

        // ========== 既存機能継承 (変更なし) ==========

        reorderLayers(fromIndex, toIndex) {
            const layers = this.getLayers();
            
            if (fromIndex < 0 || fromIndex >= layers.length || 
                toIndex < 0 || toIndex >= layers.length || 
                fromIndex === toIndex) {
                return false;
            }
            
            try {
                const movedLayer = layers[fromIndex];
                const oldActiveIndex = this.activeLayerIndex;
                
                if (window.History && !window.History._manager.isApplying) {
                    const entry = {
                        name: 'layer-reorder',
                        do: () => {
                            const layers = this.getLayers();
                            const [layer] = layers.splice(fromIndex, 1);
                            layers.splice(toIndex, 0, layer);
                            
                            this.currentCutContainer.removeChild(layer);
                            this.currentCutContainer.addChildAt(layer, toIndex);
                            
                            if (this.activeLayerIndex === fromIndex) {
                                this.activeLayerIndex = toIndex;
                            } else if (this.activeLayerIndex > fromIndex && this.activeLayerIndex <= toIndex) {
                                this.activeLayerIndex--;
                            } else if (this.activeLayerIndex < fromIndex && this.activeLayerIndex >= toIndex) {
                                this.activeLayerIndex++;
                            }
                            
                            this.updateLayerPanelUI();
                            
                            if (this.eventBus) {
                                this.eventBus.emit('layer:reordered', { 
                                    fromIndex, 
                                    toIndex, 
                                    activeIndex: this.activeLayerIndex,
                                    movedLayerId: layer.layerData?.id
                                });
                            }
                        },
                        undo: () => {
                            const layers = this.getLayers();
                            const [layer] = layers.splice(toIndex, 1);
                            layers.splice(fromIndex, 0, layer);
                            
                            this.currentCutContainer.removeChild(layer);
                            this.currentCutContainer.addChildAt(layer, fromIndex);
                            
                            this.activeLayerIndex = oldActiveIndex;
                            this.updateLayerPanelUI();
                            
                            if (this.eventBus) {
                                this.eventBus.emit('layer:reordered', { 
                                    fromIndex: toIndex, 
                                    toIndex: fromIndex, 
                                    activeIndex: this.activeLayerIndex,
                                    movedLayerId: layer.layerData?.id
                                });
                            }
                        },
                        meta: { fromIndex, toIndex }
                    };
                    window.History.push(entry);
                } else {
                    const [layer] = layers.splice(fromIndex, 1);
                    layers.splice(toIndex, 0, layer);
                    
                    this.currentCutContainer.removeChild(layer);
                    this.currentCutContainer.addChildAt(layer, toIndex);
                    
                    if (this.activeLayerIndex === fromIndex) {
                        this.activeLayerIndex = toIndex;
                    } else if (this.activeLayerIndex > fromIndex && this.activeLayerIndex <= toIndex) {
                        this.activeLayerIndex--;
                    } else if (this.activeLayerIndex < fromIndex && this.activeLayerIndex >= toIndex) {
                        this.activeLayerIndex++;
                    }
                    
                    this.updateLayerPanelUI();
                    
                    if (this.eventBus) {
                        this.eventBus.emit('layer:reordered', { 
                            fromIndex, 
                            toIndex, 
                            activeIndex: this.activeLayerIndex,
                            movedLayerId: movedLayer.layerData?.id
                        });
                    }
                }
                
                return true;
                
            } catch (error) {
                return false;
            }
        }

        setCurrentCutContainer(cutContainer) {
            this.currentCutContainer = cutContainer;
            
            const layers = this.getLayers();
            if (layers.length > 0) {
                this.activeLayerIndex = layers.length - 1;
            }
            
            this.updateLayerPanelUI();
            this.updateStatusDisplay();
            
            if (this.isLayerMoveMode) {
                this.updateLayerTransformPanelValues();
            }
        }
        
        createCutRenderTexture(cutId) {
            if (!this.app?.renderer) {
                return null;
            }
            
            const renderTexture = PIXI.RenderTexture.create({
                width: this.config.canvas.width,
                height: this.config.canvas.height
            });
            
            this.cutRenderTextures.set(cutId, renderTexture);
            this.cutThumbnailDirty.set(cutId, true);
            
            return renderTexture;
        }
        
        renderCutToTexture(cutId, cutContainer) {
            if (!this.app?.renderer) return;
            
            const renderTexture = this.cutRenderTextures.get(cutId);
            if (!renderTexture) {
                return;
            }
            
            const container = cutContainer || this.currentCutContainer;
            if (!container) return;
            
            this.app.renderer.render({
                container: container,
                target: renderTexture,
                clear: true
            });
            
            this.markCutThumbnailDirty(cutId);
        }
        
        markCutThumbnailDirty(cutId) {
            this.cutThumbnailDirty.set(cutId, true);
            
            if (this.eventBus) {
                this.eventBus.emit('cut:updated', { cutId: cutId });
            }
        }
        
        getCutRenderTexture(cutId) {
            return this.cutRenderTextures.get(cutId);
        }
        
        destroyCutRenderTexture(cutId) {
            const renderTexture = this.cutRenderTextures.get(cutId);
            if (renderTexture) {
                renderTexture.destroy(true);
                this.cutRenderTextures.delete(cutId);
                this.cutThumbnailDirty.delete(cutId);
            }
        }
        
        isCutThumbnailDirty(cutId) {
            return this.cutThumbnailDirty.get(cutId) || false;
        }
        
        clearCutThumbnailDirty(cutId) {
            this.cutThumbnailDirty.set(cutId, false);
        }
        
        getLayers() {
            return this.currentCutContainer ? this.currentCutContainer.children : [];
        }
        
        getActiveLayer() {
            const layers = this.getLayers();
            return this.activeLayerIndex >= 0 ? layers[this.activeLayerIndex] : null;
        }
        
        _setupAnimationSystemIntegration() {
            if (!this.eventBus) return;
            
            this.eventBus.on('animation:system-ready', () => {
                this._establishAnimationSystemConnection();
            });
            
            this.eventBus.on('animation:cut-applied', (data) => {
                setTimeout(() => {
                    this.updateLayerPanelUI();
                    this.updateStatusDisplay();
                    
                    if (this.isLayerMoveMode) {
                        this.updateLayerTransformPanelValues();
                    }
                }, 100);
            });
            
            this.eventBus.on('animation:cut-created', () => {
                setTimeout(() => {
                    this.updateLayerPanelUI();
                }, 100);
            });
            
            this.eventBus.on('animation:cut-deleted', () => {
                setTimeout(() => {
                    this.updateLayerPanelUI();
                }, 100);
            });
            
            // Phase 2: camera:scale-changed イベントリスナーは削除（不要）
        }
        
        _establishAnimationSystemConnection() {
            if (window.TegakiAnimationSystem && !this.animationSystem) {
                const possibleInstances = [
                    window.animationSystem,
                    window.coreEngine?.animationSystem,
                    window.TegakiCoreEngine?.animationSystem
                ];
                
                for (let instance of possibleInstances) {
                    if (instance && typeof instance.getCurrentCut === 'function') {
                        this.animationSystem = instance;
                        break;
                    }
                }
                
                if (this.animationSystem && this.animationSystem.layerSystem !== this) {
                    this.animationSystem.layerSystem = this;
                }
            }
        }

        // Phase 2: rebuildAllLayersForScaleChange メソッドは削除（不要）

        _setupLayerTransformPanel() {
            this.layerTransformPanel = document.getElementById('layer-transform-panel');
            
            if (!this.layerTransformPanel) {
                return;
            }
            
            this._setupLayerSlider('layer-x-slider', this.config.layer.minX, this.config.layer.maxX, 0, (value) => {
                this.updateActiveLayerTransform('x', value);
                return Math.round(value) + 'px';
            });
            
            this._setupLayerSlider('layer-y-slider', this.config.layer.minY, this.config.layer.maxY, 0, (value) => {
                this.updateActiveLayerTransform('y', value);
                return Math.round(value) + 'px';
            });
            
            this._setupLayerSlider('layer-rotation-slider', this.config.layer.minRotation, this.config.layer.maxRotation, 0, (value) => {
                this.updateActiveLayerTransform('rotation', value * Math.PI / 180);
                return Math.round(value) + '°';
            });
            
            this._setupLayerSlider('layer-scale-slider', this.config.layer.minScale, this.config.layer.maxScale, 1.0, (value) => {
                this.updateActiveLayerTransform('scale', value);
                return value.toFixed(2) + 'x';
            });
            
            const flipHorizontalBtn = document.getElementById('flip-horizontal-btn');
            const flipVerticalBtn = document.getElementById('flip-vertical-btn');
            
            if (flipHorizontalBtn) {
                flipHorizontalBtn.addEventListener('click', () => {
                    this.flipActiveLayer('horizontal');
                });
            }
            
            if (flipVerticalBtn) {
                flipVerticalBtn.addEventListener('click', () => {
                    this.flipActiveLayer('vertical');
                });
            }
        }

        _setupLayerSlider(sliderId, min, max, initial, callback) {
            const container = document.getElementById(sliderId);
            if (!container) return;

            const track = container.querySelector('.slider-track');
            const handle = container.querySelector('.slider-handle');
            const valueDisplay = container.parentNode.querySelector('.slider-value');

            if (!track || !handle || !valueDisplay) return;

            let value = initial;
            let dragging = false;

            const update = (newValue, fromSlider = false) => {
                value = Math.max(min, Math.min(max, newValue));
                const percentage = ((value - min) / (max - min)) * 100;
                
                track.style.width = percentage + '%';
                handle.style.left = percentage + '%';
                valueDisplay.textContent = callback(value, fromSlider);
            };

            const getValue = (clientX) => {
                const rect = container.getBoundingClientRect();
                const percentage = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
                return min + (percentage * (max - min));
            };

            container.addEventListener('mousedown', (e) => {
                dragging = true;
                update(getValue(e.clientX), true);
                e.preventDefault();
            });

            document.addEventListener('mousemove', (e) => {
                if (dragging) update(getValue(e.clientX), true);
            });

            document.addEventListener('mouseup', () => {
                dragging = false;
            });

            container.updateValue = (newValue) => {
                update(newValue, false);
            };

            update(initial);
        }
        
        updateActiveLayerTransform(property, value) {
            const activeLayer = this.getActiveLayer();
            if (!activeLayer?.layerData) return;
            
            const layerId = activeLayer.layerData.id;
            
            if (!this.layerTransforms.has(layerId)) {
                this.layerTransforms.set(layerId, {
                    x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1
                });
            }
            
            const transform = this.layerTransforms.get(layerId);
            
            const centerX = this.config.canvas.width / 2;
            const centerY = this.config.canvas.height / 2;
            
            switch(property) {
                case 'x':
                    transform.x = value;
                    break;
                case 'y':
                    transform.y = value;
                    break;
                case 'rotation':
                    transform.rotation = value;
                    break;
                case 'scale':
                    const hFlipped = transform.scaleX < 0;
                    const vFlipped = transform.scaleY < 0;
                    transform.scaleX = hFlipped ? -value : value;
                    transform.scaleY = vFlipped ? -value : value;
                    break;
            }
            
            if (this.coordAPI?.applyLayerTransform) {
                this.coordAPI.applyLayerTransform(activeLayer, transform, centerX, centerY);
            } else {
                this._applyTransformDirect(activeLayer, transform, centerX, centerY);
            }
            
            // Phase 3: Vキー押下中（ドラッグ操作中）はサムネイル更新をスキップ
            if (!this.isLayerDragging) {
                this.requestThumbnailUpdate(this.activeLayerIndex);
            }
            
            if (this.eventBus) {
                this.eventBus.emit('layer:updated', { layerId, transform });
            }
        }
        
        _applyTransformDirect(layer, transform, centerX, centerY) {
            if (transform.rotation !== 0 || Math.abs(transform.scaleX) !== 1 || 
                Math.abs(transform.scaleY) !== 1) {
                layer.pivot.set(centerX, centerY);
                layer.position.set(centerX + transform.x, centerY + transform.y);
                layer.rotation = transform.rotation;
                layer.scale.set(transform.scaleX, transform.scaleY);
            } else if (transform.x !== 0 || transform.y !== 0) {
                layer.pivot.set(0, 0);
                layer.position.set(transform.x, transform.y);
                layer.rotation = 0;
                layer.scale.set(1, 1);
            } else {
                layer.pivot.set(0, 0);
                layer.position.set(0, 0);
                layer.rotation = 0;
                layer.scale.set(1, 1);
            }
        }

        flipActiveLayer(direction) {
            const activeLayer = this.getActiveLayer();
            if (!activeLayer?.layerData) return;
            
            const layerId = activeLayer.layerData.id;
            
            if (!this.layerTransforms.has(layerId)) {
                this.layerTransforms.set(layerId, {
                    x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1
                });
            }
            
            const transform = this.layerTransforms.get(layerId);
            
            const centerX = this.config.canvas.width / 2;
            const centerY = this.config.canvas.height / 2;
            
            if (direction === 'horizontal') {
                transform.scaleX *= -1;
            } else if (direction === 'vertical') {
                transform.scaleY *= -1;
            }
            
            if (this.coordAPI?.applyLayerTransform) {
                this.coordAPI.applyLayerTransform(activeLayer, transform, centerX, centerY);
            } else {
                this._applyTransformDirect(activeLayer, transform, centerX, centerY);
            }
            
            this.updateFlipButtons();
            this.requestThumbnailUpdate(this.activeLayerIndex);
            
            if (this.eventBus) {
                this.eventBus.emit('layer:updated', { layerId, transform });
            }
        }

        updateFlipButtons() {
            const activeLayer = this.getActiveLayer();
            if (!activeLayer) return;
            
            const flipHorizontalBtn = document.getElementById('flip-horizontal-btn');
            const flipVerticalBtn = document.getElementById('flip-vertical-btn');
            
            if (flipHorizontalBtn) {
                flipHorizontalBtn.classList.toggle('active', activeLayer.scale.x < 0);
            }
            
            if (flipVerticalBtn) {
                flipVerticalBtn.classList.toggle('active', activeLayer.scale.y < 0);
            }
        }

        updateLayerTransformPanelValues() {
            const activeLayer = this.getActiveLayer();
            if (!activeLayer?.layerData) return;
            
            const layerId = activeLayer.layerData.id;
            const transform = this.layerTransforms.get(layerId) || {
                x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1
            };
            
            ['x', 'y', 'rotation', 'scale'].forEach(prop => {
                const slider = document.getElementById(`layer-${prop}-slider`);
                if (slider?.updateValue) {
                    let value = transform[prop];
                    if (prop === 'rotation') value = value * 180 / Math.PI;
                    if (prop === 'scale') value = Math.abs(transform.scaleX);
                    slider.updateValue(value);
                }
            });
            
            this.updateFlipButtons();
        }

        _setupLayerOperations() {
            document.addEventListener('keydown', (e) => {
                const activeElement = document.activeElement;
                if (activeElement && (
                    activeElement.tagName === 'INPUT' ||
                    activeElement.tagName === 'TEXTAREA' ||
                    activeElement.isContentEditable
                )) {
                    return;
                }

                const keymap = window.TEGAKI_KEYMAP;
                if (!keymap) return;

                const context = { vMode: this.vKeyPressed };
                const action = keymap.getAction(e, context);
                
                if (!action) return;

                switch(action) {
                    case 'LAYER_MOVE_MODE_TOGGLE':
                        this.toggleLayerMoveMode();
                        e.preventDefault();
                        break;

                    case 'GIF_PREV_FRAME':
                        if (this.animationSystem?.goToPreviousFrame) {
                            this.animationSystem.goToPreviousFrame();
                        }
                        if (this.eventBus) {
                            this.eventBus.emit('gif:prev-frame-requested');
                        }
                        e.preventDefault();
                        break;

                    case 'GIF_NEXT_FRAME':
                        if (this.animationSystem?.goToNextFrame) {
                            this.animationSystem.goToNextFrame();
                        }
                        if (this.eventBus) {
                            this.eventBus.emit('gif:next-frame-requested');
                        }
                        e.preventDefault();
                        break;

                    case 'LAYER_HIERARCHY_UP':
                        this.moveActiveLayerHierarchy('up');
                        e.preventDefault();
                        break;

                    case 'LAYER_HIERARCHY_DOWN':
                        this.moveActiveLayerHierarchy('down');
                        e.preventDefault();
                        break;

                    case 'TOOL_PEN':
                    case 'TOOL_ERASER':
                        if (this.isLayerMoveMode) {
                            this.exitLayerMoveMode();
                        }
                        e.preventDefault();
                        break;

                    case 'LAYER_MOVE_UP':
                        this.moveActiveLayer('ArrowUp');
                        e.preventDefault();
                        break;

                    case 'LAYER_MOVE_DOWN':
                        this.moveActiveLayer('ArrowDown');
                        e.preventDefault();
                        break;

                    case 'LAYER_MOVE_LEFT':
                        this.moveActiveLayer('ArrowLeft');
                        e.preventDefault();
                        break;

                    case 'LAYER_MOVE_RIGHT':
                        this.moveActiveLayer('ArrowRight');
                        e.preventDefault();
                        break;

                    case 'LAYER_SCALE_UP':
                        this.transformActiveLayer('ArrowUp');
                        e.preventDefault();
                        break;

                    case 'LAYER_SCALE_DOWN':
                        this.transformActiveLayer('ArrowDown');
                        e.preventDefault();
                        break;

                    case 'LAYER_ROTATE_LEFT':
                        this.transformActiveLayer('ArrowLeft');
                        e.preventDefault();
                        break;

                    case 'LAYER_ROTATE_RIGHT':
                        this.transformActiveLayer('ArrowRight');
                        e.preventDefault();
                        break;

                    case 'LAYER_FLIP_HORIZONTAL':
                        this.flipActiveLayer('horizontal');
                        e.preventDefault();
                        break;

                    case 'LAYER_FLIP_VERTICAL':
                        this.flipActiveLayer('vertical');
                        e.preventDefault();
                        break;
                }
            });
            
            window.addEventListener('blur', () => {
                if (this.vKeyPressed) {
                    this.exitLayerMoveMode();
                }
            });
            
            this._setupLayerDragEvents();
        }

        toggleLayerMoveMode() {
            if (this.isLayerMoveMode) {
                this.exitLayerMoveMode();
            } else {
                this.enterLayerMoveMode();
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
                if (newIndex >= layers.length) {
                    return;
                }
            } else if (direction === 'down') {
                newIndex = currentIndex - 1;
                if (newIndex < 0) {
                    return;
                }
                
                const targetLayer = layers[newIndex];
                if (targetLayer?.layerData?.isBackground) {
                    return;
                }
            } else {
                return;
            }
            
            if (window.History && !window.History._manager.isApplying) {
                const oldIndex = currentIndex;
                
                const entry = {
                    name: 'layer-hierarchy-move',
                    do: () => {
                        const layers = this.getLayers();
                        const layer = layers[oldIndex];
                        
                        this.currentCutContainer.removeChildAt(oldIndex);
                        this.currentCutContainer.addChildAt(layer, newIndex);
                        
                        this.activeLayerIndex = newIndex;
                        
                        this.updateLayerPanelUI();
                        
                        if (this.eventBus) {
                            this.eventBus.emit('layer:hierarchy-moved', { 
                                direction, 
                                oldIndex, 
                                newIndex,
                                layerId: layer.layerData?.id
                            });
                        }
                    },
                    undo: () => {
                        const layers = this.getLayers();
                        const layer = layers[newIndex];
                        
                        this.currentCutContainer.removeChildAt(newIndex);
                        this.currentCutContainer.addChildAt(layer, oldIndex);
                        
                        this.activeLayerIndex = oldIndex;
                        
                        this.updateLayerPanelUI();
                        
                        if (this.eventBus) {
                            this.eventBus.emit('layer:hierarchy-moved', { 
                                direction: direction === 'up' ? 'down' : 'up', 
                                oldIndex: newIndex, 
                                newIndex: oldIndex,
                                layerId: layer.layerData?.id
                            });
                        }
                    },
                    meta: { direction, oldIndex, newIndex }
                };
                
                window.History.push(entry);
            } else {
                this.currentCutContainer.removeChildAt(currentIndex);
                this.currentCutContainer.addChildAt(activeLayer, newIndex);
                this.activeLayerIndex = newIndex;
                
                this.updateLayerPanelUI();
                
                if (this.eventBus) {
                    this.eventBus.emit('layer:hierarchy-moved', { 
                        direction, 
                        oldIndex: currentIndex, 
                        newIndex,
                        layerId: activeLayer.layerData?.id
                    });
                }
            }
        }

        _setupLayerDragEvents() {
            const canvas = this._getSafeCanvas();
            if (!canvas) {
                return;
            }
            
            canvas.addEventListener('pointerdown', (e) => {
                if (this.vKeyPressed && e.button === 0) {
                    this.isLayerDragging = true;
                    this.layerDragLastPoint = { x: e.clientX, y: e.clientY };
                    canvas.style.cursor = 'move';
                    e.preventDefault();
                }
            });
            
            canvas.addEventListener('pointermove', (e) => {
                if (this.isLayerDragging && this.vKeyPressed) {
                    this._handleLayerDrag(e);
                }
            });
            
            canvas.addEventListener('pointerup', (e) => {
                if (this.isLayerDragging) {
                    this.isLayerDragging = false;
                    this.updateCursor();
                }
            });
        }

        _getSafeCanvas() {
            if (this.app?.canvas) {
                return this.app.canvas;
            }
            if (this.app?.view) {
                return this.app.view;
            }
            const canvasElements = document.querySelectorAll('canvas');
            if (canvasElements.length > 0) {
                return canvasElements[0];
            }
            return null;
        }

        _handleLayerDrag(e) {
            const activeLayer = this.getActiveLayer();
            if (!activeLayer?.layerData) return;

            const dx = e.clientX - this.layerDragLastPoint.x;
            const dy = e.clientY - this.layerDragLastPoint.y;
            
            const worldScale = this.cameraSystem ? this.cameraSystem.worldContainer.scale.x : 1;
            const adjustedDx = dx / worldScale;
            const adjustedDy = dy / worldScale;
            
            const layerId = activeLayer.layerData.id;
            
            if (!this.layerTransforms.has(layerId)) {
                this.layerTransforms.set(layerId, {
                    x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1
                });
            }
            
            const transform = this.layerTransforms.get(layerId);
            const centerX = this.config.canvas.width / 2;
            const centerY = this.config.canvas.height / 2;
            
            if (e.shiftKey) {
                if (Math.abs(dy) > Math.abs(dx)) {
                    const scaleFactor = 1 + (dy * -0.01);
                    const currentScale = Math.abs(transform.scaleX);
                    const newScale = Math.max(this.config.layer.minScale, 
                        Math.min(this.config.layer.maxScale, currentScale * scaleFactor));
                    
                    transform.scaleX = transform.scaleX < 0 ? -newScale : newScale;
                    transform.scaleY = transform.scaleY < 0 ? -newScale : newScale;
                    
                    const scaleSlider = document.getElementById('layer-scale-slider');
                    if (scaleSlider?.updateValue) {
                        scaleSlider.updateValue(newScale);
                    }
                } else {
                    transform.rotation += (dx * 0.02);
                    
                    const rotationSlider = document.getElementById('layer-rotation-slider');
                    if (rotationSlider?.updateValue) {
                        rotationSlider.updateValue(transform.rotation * 180 / Math.PI);
                    }
                }
                
                if (this.coordAPI?.applyLayerTransform) {
                    this.coordAPI.applyLayerTransform(activeLayer, transform, centerX, centerY);
                } else {
                    activeLayer.position.set(centerX + transform.x, centerY + transform.y);
                }
                
                const xSlider = document.getElementById('layer-x-slider');
                const ySlider = document.getElementById('layer-y-slider');
                if (xSlider?.updateValue) xSlider.updateValue(transform.x);
                if (ySlider?.updateValue) ySlider.updateValue(transform.y);
            } else {
                transform.x += adjustedDx;
                transform.y += adjustedDy;
                
                if (this.coordAPI?.applyLayerTransform) {
                    this.coordAPI.applyLayerTransform(activeLayer, transform, centerX, centerY);
                } else {
                    activeLayer.position.set(centerX + transform.x, centerY + transform.y);
                }
                
                const xSlider = document.getElementById('layer-x-slider');
                const ySlider = document.getElementById('layer-y-slider');
                if (xSlider?.updateValue) xSlider.updateValue(transform.x);
                if (ySlider?.updateValue) ySlider.updateValue(transform.y);
            }
            
            this.layerDragLastPoint = { x: e.clientX, y: e.clientY };
            this.requestThumbnailUpdate(this.activeLayerIndex);
            
            if (this.eventBus) {
                this.eventBus.emit('layer:updated', { layerId, transform });
            }
        }

        enterLayerMoveMode() {
            if (this.isLayerMoveMode) return;
            
            this.isLayerMoveMode = true;
            this.vKeyPressed = true;
            
            if (this.cameraSystem?.setVKeyPressed) {
                this.cameraSystem.setVKeyPressed(true);
                this.cameraSystem.showGuideLines();
            }
            
            if (this.layerTransformPanel) {
                this.layerTransformPanel.classList.add('show');
                this.updateLayerTransformPanelValues();
            }
            
            this.updateCursor();
            
            if (this.eventBus) {
                this.eventBus.emit('layer:move-mode-entered');
            }
        }
        
        exitLayerMoveMode() {
            if (!this.isLayerMoveMode) return;
            
            const activeLayer = this.getActiveLayer();
            const layerId = activeLayer?.layerData?.id;
            const transformBefore = layerId ? structuredClone(this.layerTransforms.get(layerId)) : null;
            
            this.isLayerMoveMode = false;
            this.vKeyPressed = false;
            this.isLayerDragging = false;
            
            if (this.cameraSystem?.setVKeyPressed) {
                this.cameraSystem.setVKeyPressed(false);
                this.cameraSystem.hideGuideLines();
            }
            
            if (this.layerTransformPanel) {
                this.layerTransformPanel.classList.remove('show');
            }
            
            this.updateCursor();
            this.confirmLayerTransform();
            
            // Phase 3: レイヤー移動モード終了時に一度だけサムネイル更新
            this.requestThumbnailUpdate(this.activeLayerIndex);
            
            if (activeLayer && layerId && transformBefore && this.isTransformNonDefault(transformBefore)) {
                const pathsAfter = structuredClone(activeLayer.layerData.paths);
                const transformAfter = { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 };
                
                if (window.History && !window.History._manager.isApplying) {
                    const entry = {
                        name: 'layer-transform',
                        do: () => {
                            this.safeRebuildLayer(activeLayer, pathsAfter);
                            this.layerTransforms.set(layerId, transformAfter);
                            activeLayer.position.set(0, 0);
                            activeLayer.rotation = 0;
                            activeLayer.scale.set(1, 1);
                            activeLayer.pivot.set(0, 0);
                            this.requestThumbnailUpdate(this.activeLayerIndex);
                        },
                        undo: () => {
                            this.layerTransforms.set(layerId, transformBefore);
                            const centerX = this.config.canvas.width / 2;
                            const centerY = this.config.canvas.height / 2;
                            if (this.coordAPI?.applyLayerTransform) {
                                this.coordAPI.applyLayerTransform(activeLayer, transformBefore, centerX, centerY);
                            } else {
                                this._applyTransformDirect(activeLayer, transformBefore, centerX, centerY);
                            }
                            this.requestThumbnailUpdate(this.activeLayerIndex);
                        },
                        meta: { layerId, type: 'transform' }
                    };
                    window.History.push(entry);
                }
            }
            
            if (this.eventBus) {
                this.eventBus.emit('layer:move-mode-exited');
            }
        }

        moveActiveLayer(keyCode) {
            const activeLayer = this.getActiveLayer();
            if (!activeLayer?.layerData) return;
            
            const layerId = activeLayer.layerData.id;
            
            if (!this.layerTransforms.has(layerId)) {
                this.layerTransforms.set(layerId, {
                    x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1
                });
            }
            
            const transform = this.layerTransforms.get(layerId);
            const moveAmount = 5;
            
            switch(keyCode) {
                case 'ArrowUp':    transform.y -= moveAmount; break;
                case 'ArrowDown':  transform.y += moveAmount; break;
                case 'ArrowLeft':  transform.x -= moveAmount; break;
                case 'ArrowRight': transform.x += moveAmount; break;
            }
            
            const centerX = this.config.canvas.width / 2;
            const centerY = this.config.canvas.height / 2;
            
            if (this.coordAPI?.applyLayerTransform) {
                this.coordAPI.applyLayerTransform(activeLayer, transform, centerX, centerY);
            } else {
                activeLayer.position.set(centerX + transform.x, centerY + transform.y);
            }
            
            const xSlider = document.getElementById('layer-x-slider');
            const ySlider = document.getElementById('layer-y-slider');
            if (xSlider?.updateValue) xSlider.updateValue(transform.x);
            if (ySlider?.updateValue) ySlider.updateValue(transform.y);
            
            this.requestThumbnailUpdate(this.activeLayerIndex);
            
            if (this.eventBus) {
                this.eventBus.emit('layer:updated', { layerId, transform });
            }
        }

        transformActiveLayer(keyCode) {
            const activeLayer = this.getActiveLayer();
            if (!activeLayer?.layerData) return;
            
            const layerId = activeLayer.layerData.id;
            
            if (!this.layerTransforms.has(layerId)) {
                this.layerTransforms.set(layerId, {
                    x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1
                });
            }
            
            const transform = this.layerTransforms.get(layerId);
            const centerX = this.config.canvas.width / 2;
            const centerY = this.config.canvas.height / 2;
            
            switch(keyCode) {
                case 'ArrowUp':
                    const scaleUpFactor = 1.1;
                    const currentScaleUp = Math.abs(transform.scaleX);
                    const newScaleUp = Math.min(this.config.layer.maxScale, currentScaleUp * scaleUpFactor);
                    transform.scaleX = transform.scaleX < 0 ? -newScaleUp : newScaleUp;
                    transform.scaleY = transform.scaleY < 0 ? -newScaleUp : newScaleUp;
                    
                    const scaleSliderUp = document.getElementById('layer-scale-slider');
                    if (scaleSliderUp?.updateValue) {
                        scaleSliderUp.updateValue(newScaleUp);
                    }
                    break;
                    
                case 'ArrowDown':
                    const scaleDownFactor = 0.9;
                    const currentScaleDown = Math.abs(transform.scaleX);
                    const newScaleDown = Math.max(this.config.layer.minScale, currentScaleDown * scaleDownFactor);
                    transform.scaleX = transform.scaleX < 0 ? -newScaleDown : newScaleDown;
                    transform.scaleY = transform.scaleY < 0 ? -newScaleDown : newScaleDown;
                    
                    const scaleSliderDown = document.getElementById('layer-scale-slider');
                    if (scaleSliderDown?.updateValue) {
                        scaleSliderDown.updateValue(newScaleDown);
                    }
                    break;
                    
                case 'ArrowLeft':
                    transform.rotation -= (15 * Math.PI) / 180;
                    
                    const rotationSliderLeft = document.getElementById('layer-rotation-slider');
                    if (rotationSliderLeft?.updateValue) {
                        rotationSliderLeft.updateValue(transform.rotation * 180 / Math.PI);
                    }
                    break;
                    
                case 'ArrowRight':
                    transform.rotation += (15 * Math.PI) / 180;
                    
                    const rotationSliderRight = document.getElementById('layer-rotation-slider');
                    if (rotationSliderRight?.updateValue) {
                        rotationSliderRight.updateValue(transform.rotation * 180 / Math.PI);
                    }
                    break;
            }
            
            if (this.coordAPI?.applyLayerTransform) {
                this.coordAPI.applyLayerTransform(activeLayer, transform, centerX, centerY);
            } else {
                this._applyTransformDirect(activeLayer, transform, centerX, centerY);
            }
            
            this.requestThumbnailUpdate(this.activeLayerIndex);
            
            if (this.eventBus) {
                this.eventBus.emit('layer:updated', { layerId, transform });
            }
        }

        confirmLayerTransform() {
            const activeLayer = this.getActiveLayer();
            if (!activeLayer?.layerData) return;
            
            const layerId = activeLayer.layerData.id;
            const transform = this.layerTransforms.get(layerId);
            
            if (this.isTransformNonDefault(transform)) {
                const success = this.safeApplyTransformToPaths(activeLayer, transform);
                
                if (success) {
                    activeLayer.position.set(0, 0);
                    activeLayer.rotation = 0;
                    activeLayer.scale.set(1, 1);
                    activeLayer.pivot.set(0, 0);
                    
                    this.layerTransforms.set(layerId, {
                        x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1
                    });
                    
                    this.updateFlipButtons();
                    this.requestThumbnailUpdate(this.activeLayerIndex);
                    
                    if (this.animationSystem?.generateCutThumbnail) {
                        const cutIndex = this.animationSystem.getCurrentCutIndex();
                        setTimeout(() => {
                            this.animationSystem.generateCutThumbnail(cutIndex);
                        }, 100);
                    }
                    
                    if (this.eventBus) {
                        this.eventBus.emit('layer:transform-confirmed', { layerId });
                    }
                }
            }
        }

        safeApplyTransformToPaths(layer, transform) {
            if (!layer.layerData?.paths || layer.layerData.paths.length === 0) {
                return true;
            }
            
            try {
                const centerX = this.config.canvas.width / 2;
                const centerY = this.config.canvas.height / 2;
                
                const matrix = this.createTransformMatrix(transform, centerX, centerY);
                
                const transformedPaths = [];
                
                for (let i = 0; i < layer.layerData.paths.length; i++) {
                    const path = layer.layerData.paths[i];
                    
                    if (!path?.points || !Array.isArray(path.points) || path.points.length === 0) {
                        continue;
                    }
                    
                    const transformedPoints = this.safeTransformPoints(path.points, matrix);
                    
                    if (transformedPoints.length === 0) {
                        continue;
                    }
                    
                    const transformedPath = {
                        id: path.id,
                        points: transformedPoints,
                        color: path.color,
                        size: path.size,
                        opacity: path.opacity,
                        tool: path.tool,
                        isComplete: path.isComplete || true,
                        strokeOptions: path.strokeOptions,
                        graphics: null
                    };
                    
                    transformedPaths.push(transformedPath);
                }
                
                const rebuildSuccess = this.safeRebuildLayer(layer, transformedPaths);
                return rebuildSuccess;
                
            } catch (error) {
                return false;
            }
        }

        createTransformMatrix(transform, centerX, centerY) {
            const matrix = new PIXI.Matrix();
            
            matrix.translate(-centerX, -centerY);
            matrix.scale(transform.scaleX, transform.scaleY);
            matrix.rotate(transform.rotation);
            matrix.translate(centerX + transform.x, centerY + transform.y);
            
            return matrix;
        }

        safeTransformPoints(points, matrix) {
            const transformedPoints = [];
            
            for (let i = 0; i < points.length; i++) {
                const point = points[i];
                
                if (typeof point.x !== 'number' || typeof point.y !== 'number' ||
                    !isFinite(point.x) || !isFinite(point.y)) {
                    continue;
                }
                
                try {
                    const transformed = matrix.apply(point);
                    
                    if (typeof transformed.x === 'number' && typeof transformed.y === 'number' &&
                        isFinite(transformed.x) && isFinite(transformed.y)) {
                        
                        const newPoint = {
                            x: transformed.x,
                            y: transformed.y
                        };
                        
                        if (point.pressure !== undefined) {
                            newPoint.pressure = point.pressure;
                        }
                        
                        transformedPoints.push(newPoint);
                    }
                    
                } catch (transformError) {
                    continue;
                }
            }
            
            return transformedPoints;
        }

        safeRebuildLayer(layer, newPaths) {
            try {
                const childrenToRemove = [];
                for (let child of layer.children) {
                    if (child !== layer.layerData.backgroundGraphics) {
                        childrenToRemove.push(child);
                    }
                }
                
                childrenToRemove.forEach(child => {
                    try {
                        layer.removeChild(child);
                        if (child.destroy && typeof child.destroy === 'function') {
                            child.destroy({ children: true, texture: false, baseTexture: false });
                        }
                    } catch (removeError) {
                    }
                });
                
                layer.layerData.paths = [];
                
                let addedCount = 0;
                for (let i = 0; i < newPaths.length; i++) {
                    const path = newPaths[i];
                    
                    try {
                        const rebuildSuccess = this.rebuildPathGraphics(path);
                        
                        if (rebuildSuccess && path.graphics) {
                            layer.layerData.paths.push(path);
                            layer.addChild(path.graphics);
                            addedCount++;
                        }
                        
                    } catch (pathError) {
                    }
                }
                
                return addedCount > 0 || newPaths.length === 0;
                
            } catch (error) {
                return false;
            }
        }

        isTransformNonDefault(transform) {
            if (!transform) return false;
            return (transform.x !== 0 || transform.y !== 0 || 
                    transform.rotation !== 0 || Math.abs(transform.scaleX) !== 1 || Math.abs(transform.scaleY) !== 1);
        }

        updateCursor() {
            const canvas = this._getSafeCanvas();
            if (!canvas) return;

            if (this.vKeyPressed) {
                canvas.style.cursor = 'grab';
            } else {
                canvas.style.cursor = 'default';
            }
        }

        createLayer(name, isBackground = false) {
            if (!this.currentCutContainer) {
                return null;
            }
            
            // Phase 4: DataModel を使用
            const layerModel = new window.TegakiDataModels.LayerModel({
                name: name || `レイヤー${this.currentCutContainer.children.length + 1}`,
                isBackground: isBackground
            });
            
            const layer = new PIXI.Container();
            layer.label = layerModel.id;
            layer.layerData = layerModel;

            this.layerTransforms.set(layerModel.id, {
                x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1
            });

            if (isBackground) {
                const bg = new PIXI.Graphics();
                bg.rect(0, 0, this.config.canvas.width, this.config.canvas.height);
                bg.fill(this.config.background.color);
                layer.addChild(bg);
                layer.layerData.backgroundGraphics = bg;
            }
            
            const newIndex = this.currentCutContainer.children.length;

            if (window.History && !window.History._manager.isApplying) {
                const entry = {
                    name: 'layer-create',
                    do: () => {
                        this.currentCutContainer.addChild(layer);
                        const layers = this.getLayers();
                        this.setActiveLayer(layers.length - 1);
                        this.updateLayerPanelUI();
                        this.updateStatusDisplay();
                    },
                    undo: () => {
                        this.currentCutContainer.removeChild(layer);
                        const layers = this.getLayers();
                        if (this.activeLayerIndex >= layers.length) {
                            this.activeLayerIndex = Math.max(0, layers.length - 1);
                        }
                        this.updateLayerPanelUI();
                        this.updateStatusDisplay();
                    },
                    meta: { layerId: layerModel.id, name: layerModel.name }
                };
                window.History.push(entry);
            } else {
                this.currentCutContainer.addChild(layer);
                const layers = this.getLayers();
                this.setActiveLayer(layers.length - 1);
                this.updateLayerPanelUI();
                this.updateStatusDisplay();
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
                const oldIndex = this.activeLayerIndex;
                this.activeLayerIndex = index;
                
                this.updateLayerPanelUI();
                this.updateStatusDisplay();
                
                if (this.isLayerMoveMode) {
                    this.updateLayerTransformPanelValues();
                }
                
                if (this.eventBus) {
                    this.eventBus.emit('layer:activated', { 
                        layerIndex: index, 
                        oldIndex: oldIndex,
                        layerId: layers[index]?.layerData?.id
                    });
                }
            }
        }

        toggleLayerVisibility(layerIndex) {
            const layers = this.getLayers();
            if (layerIndex >= 0 && layerIndex < layers.length) {
                const layer = layers[layerIndex];
                layer.layerData.visible = !layer.layerData.visible;
                layer.visible = layer.layerData.visible;
                
                this.updateLayerPanelUI();
                this.requestThumbnailUpdate(layerIndex);
                
                if (this.eventBus) {
                    this.eventBus.emit('layer:visibility-changed', { 
                        layerIndex, 
                        visible: layer.layerData.visible,
                        layerId: layer.layerData.id
                    });
                }
            }
        }

        addPathToLayer(layerIndex, path) {
            const layers = this.getLayers();
            if (layerIndex >= 0 && layerIndex < layers.length) {
                const layer = layers[layerIndex];
                
                layer.layerData.paths.push(path);
                layer.addChild(path.graphics);
                
                this.requestThumbnailUpdate(layerIndex);
                
                if (this.animationSystem?.generateCutThumbnail) {
                    const cutIndex = this.animationSystem.getCurrentCutIndex();
                    setTimeout(() => {
                        this.animationSystem.generateCutThumbnail(cutIndex);
                    }, 100);
                }
                
                if (this.eventBus) {
                    this.eventBus.emit('layer:path-added', { 
                        layerIndex, 
                        pathId: path.id,
                        layerId: layer.layerData.id
                    });
                }
            }
        }

        insertClipboard(data) {
            if (this.eventBus) {
                this.eventBus.emit('layer:clipboard-inserted', data);
            }
        }

        requestThumbnailUpdate(layerIndex) {
            const layers = this.getLayers();
            if (layerIndex >= 0 && layerIndex < layers.length) {
                this.thumbnailUpdateQueue.add(layerIndex);
                
                // Phase 3: デバウンス処理 - 既存タイマーをクリア
                if (this.thumbnailUpdateTimer) {
                    clearTimeout(this.thumbnailUpdateTimer);
                }
                
                this.thumbnailUpdateTimer = setTimeout(() => {
                    this.processThumbnailUpdates();
                    this.thumbnailUpdateTimer = null;
                }, 500);
            }
        }

        _startThumbnailUpdateProcess() {
            setInterval(() => {
                if (this.thumbnailUpdateQueue.size > 0) {
                    this.processThumbnailUpdates();
                }
            }, 500);
        }

        processThumbnailUpdates() {
            if (this.thumbnailUpdateQueue.size === 0) return;

            const toUpdate = Array.from(this.thumbnailUpdateQueue);
            toUpdate.forEach(layerIndex => {
                this.updateThumbnail(layerIndex);
                this.thumbnailUpdateQueue.delete(layerIndex);
            });
        }

        updateThumbnail(layerIndex) {
            if (!this.app?.renderer) return;
            
            const layers = this.getLayers();
            if (layerIndex < 0 || layerIndex >= layers.length) return;

            const layer = layers[layerIndex];
            const layerItems = document.querySelectorAll('.layer-item');
            const panelIndex = layers.length - 1 - layerIndex;
            
            if (panelIndex < 0 || panelIndex >= layerItems.length) return;
            
            const thumbnail = layerItems[panelIndex].querySelector('.layer-thumbnail');
            if (!thumbnail) return;

            try {
                const canvasAspectRatio = this.config.canvas.width / this.config.canvas.height;
                let thumbnailWidth, thumbnailHeight;
                const maxHeight = 48;
                const maxWidth = 72;

                if (canvasAspectRatio >= 1) {
                    if (maxHeight * canvasAspectRatio <= maxWidth) {
                        thumbnailWidth = maxHeight * canvasAspectRatio;
                        thumbnailHeight = maxHeight;
                    } else {
                        thumbnailWidth = maxWidth;
                        thumbnailHeight = maxWidth / canvasAspectRatio;
                    }
                } else {
                    thumbnailWidth = Math.max(24, maxHeight * canvasAspectRatio);
                    thumbnailHeight = maxHeight;
                }
                
                thumbnail.style.width = Math.round(thumbnailWidth) + 'px';
                thumbnail.style.height = Math.round(thumbnailHeight) + 'px';
                
                const renderScale = this.config.thumbnail?.RENDER_SCALE || 2;
                const renderTexture = PIXI.RenderTexture.create({
                    width: this.config.canvas.width * renderScale,
                    height: this.config.canvas.height * renderScale,
                    resolution: renderScale
                });
                
                const tempContainer = new PIXI.Container();
                
                const originalState = {
                    pos: { x: layer.position.x, y: layer.position.y },
                    scale: { x: layer.scale.x, y: layer.scale.y },
                    rotation: layer.rotation,
                    pivot: { x: layer.pivot.x, y: layer.pivot.y }
                };
                
                layer.position.set(0, 0);
                layer.scale.set(1, 1);
                layer.rotation = 0;
                layer.pivot.set(0, 0);
                
                tempContainer.addChild(layer);
                tempContainer.scale.set(renderScale);
                
                this.app.renderer.render({
                    container: tempContainer,
                    target: renderTexture
                });
                
                layer.position.set(originalState.pos.x, originalState.pos.y);
                layer.scale.set(originalState.scale.x, originalState.scale.y);
                layer.rotation = originalState.rotation;
                layer.pivot.set(originalState.pivot.x, originalState.pivot.y);
                
                tempContainer.removeChild(layer);
                this.currentCutContainer.addChildAt(layer, layerIndex);
                
                const sourceCanvas = this.app.renderer.extract.canvas(renderTexture);
                const targetCanvas = document.createElement('canvas');
                targetCanvas.width = Math.round(thumbnailWidth);
                targetCanvas.height = Math.round(thumbnailHeight);
                
                const ctx = targetCanvas.getContext('2d');
                ctx.imageSmoothingEnabled = true;
                ctx.imageSmoothingQuality = this.config.thumbnail?.QUALITY || 'high';
                ctx.drawImage(sourceCanvas, 0, 0, Math.round(thumbnailWidth), Math.round(thumbnailHeight));
                
                let img = thumbnail.querySelector('img');
                if (!img) {
                    img = document.createElement('img');
                    thumbnail.innerHTML = '';
                    thumbnail.appendChild(img);
                }
                img.src = targetCanvas.toDataURL();
                img.style.width = '100%';
                img.style.height = '100%';
                img.style.objectFit = 'cover';
                
                renderTexture.destroy();
                tempContainer.destroy();
                
            } catch (error) {
            }
        }

        updateLayerPanelUI() {
            const layerList = document.getElementById('layer-list');
            if (!layerList) return;

            layerList.innerHTML = '';
            
            const layers = this.getLayers();

            for (let i = layers.length - 1; i >= 0; i--) {
                const layer = layers[i];
                const isActive = (i === this.activeLayerIndex);
                
                const layerItem = document.createElement('div');
                layerItem.className = `layer-item ${isActive ? 'active' : ''}`;
                layerItem.dataset.layerId = layer.layerData.id;
                layerItem.dataset.layerIndex = i;

                layerItem.innerHTML = `
                    <div class="layer-visibility ${layer.layerData.visible ? '' : 'hidden'}">
                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            ${layer.layerData.visible ? 
                                '<path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/>' :
                                '<path d="m15 18-.722-3.25"/><path d="m2 2 20 20"/><path d="M6.71 6.71C3.4 8.27 2 12 2 12s3 7 10 7c1.59 0 2.84-.3 3.79-.73"/><path d="m8.5 10.5 7 7"/><path d="M9.677 4.677C10.495 4.06 11.608 4 12 4c7 0 10 7 10 7a13.16 13.16 0 0 1-.64.77"/>'}
                        </svg>
                    </div>
                    <div class="layer-opacity">${Math.round((layer.layerData.opacity || 1.0) * 100)}%</div>
                    <div class="layer-name">${layer.layerData.name}</div>
                    <div class="layer-thumbnail">
                        <div class="layer-thumbnail-placeholder"></div>
                    </div>
                    <div class="layer-delete-button">
                        <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
                            <path d="m18 6-12 12"/><path d="m6 6 12 12"/>
                        </svg>
                    </div>
                `;

                layerItem.addEventListener('click', (e) => {
                    const target = e.target.closest('[class*="layer-"]');
                    if (target) {
                        const action = target.className;
                        if (action.includes('layer-visibility')) {
                            this.toggleLayerVisibility(i);
                            e.stopPropagation();
                        } else if (action.includes('layer-delete')) {
                            this.deleteLayer(i);
                            e.stopPropagation();
                        } else {
                            this.setActiveLayer(i);
                        }
                    } else {
                        this.setActiveLayer(i);
                    }
                });

                layerList.appendChild(layerItem);
            }
            
            for (let i = 0; i < layers.length; i++) {
                this.requestThumbnailUpdate(i);
            }
            
            if (window.TegakiUI?.initializeSortable) {
                setTimeout(() => {
                    window.TegakiUI.initializeSortable(this);
                }, 50);
            }
        }

        updateStatusDisplay() {
            const statusElement = document.getElementById('current-layer');
            const layers = this.getLayers();
            
            if (statusElement && this.activeLayerIndex >= 0) {
                const layer = layers[this.activeLayerIndex];
                statusElement.textContent = layer.layerData.name;
            }
            
            if (this.eventBus) {
                this.eventBus.emit('ui:status-updated', {
                    currentLayer: this.activeLayerIndex >= 0 ? 
                        layers[this.activeLayerIndex].layerData.name : 'なし',
                    layerCount: layers.length,
                    activeIndex: this.activeLayerIndex
                });
            }
        }

        setCameraSystem(cameraSystem) {
            this.cameraSystem = cameraSystem;
        }

        setApp(app) {
            this.app = app;
        }

        setAnimationSystem(animationSystem) {
            this.animationSystem = animationSystem;
            
            if (animationSystem && animationSystem.layerSystem !== this) {
                animationSystem.layerSystem = this;
            }
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
            
            try {
                const previousActiveIndex = this.activeLayerIndex;
                
                if (window.History && !window.History._manager.isApplying) {
                    const entry = {
                        name: 'layer-delete',
                        do: () => {
                            this.currentCutContainer.removeChild(layer);
                            
                            if (layerId) {
                                this.layerTransforms.delete(layerId);
                            }
                            
                            const remainingLayers = this.getLayers();
                            if (remainingLayers.length === 0) {
                                this.activeLayerIndex = -1;
                            } else if (this.activeLayerIndex >= remainingLayers.length) {
                                this.activeLayerIndex = remainingLayers.length - 1;
                            }
                            
                            this.updateLayerPanelUI();
                            this.updateStatusDisplay();
                            
                            if (this.eventBus) {
                                this.eventBus.emit('layer:deleted', { layerId, layerIndex });
                            }
                        },
                        undo: () => {
                            this.currentCutContainer.addChildAt(layer, layerIndex);
                            this.activeLayerIndex = previousActiveIndex;
                            this.updateLayerPanelUI();
                            this.updateStatusDisplay();
                        },
                        meta: { layerId, layerIndex }
                    };
                    window.History.push(entry);
                } else {
                    this.currentCutContainer.removeChild(layer);
                    
                    if (layerId) {
                        this.layerTransforms.delete(layerId);
                    }
                    
                    const remainingLayers = this.getLayers();
                    if (remainingLayers.length === 0) {
                        this.activeLayerIndex = -1;
                    } else if (this.activeLayerIndex >= remainingLayers.length) {
                        this.activeLayerIndex = remainingLayers.length - 1;
                    }
                    
                    this.updateLayerPanelUI();
                    this.updateStatusDisplay();
                    
                    if (this.eventBus) {
                        this.eventBus.emit('layer:deleted', { layerId, layerIndex });
                    }
                }
                
                if (this.animationSystem?.generateCutThumbnail) {
                    const cutIndex = this.animationSystem.getCurrentCutIndex();
                    setTimeout(() => {
                        this.animationSystem.generateCutThumbnail(cutIndex);
                    }, 100);
                }
                
                return true;
                
            } catch (error) {
                return false;
            }
        }
    }

    window.TegakiLayerSystem = LayerSystem;

})();

console.log('✅ layer-system.js (Phase 7対応版) loaded');