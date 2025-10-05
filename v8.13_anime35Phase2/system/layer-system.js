// ================================================================================
// system/layer-system.js - Phase 2b-3完全修正版（依存チェック追加）
// ================================================================================

(function() {
    'use strict';

    class LayerSystem {
        constructor(pixiApp, config, stateManager, eventBus) {
            this.app = pixiApp || null;
            this.config = config || window.TEGAKI_CONFIG;
            this.stateManager = stateManager || null;
            this.eventBus = eventBus || window.TegakiEventBus;
            
            // Pixi描画用コンテナ（データは持たない）
            this.currentCutContainer = null;
            
            // UIのみの状態
            this.activeLayerIndex = -1;
            
            // CUTサムネイル管理
            this.cutRenderTextures = new Map();
            this.cutThumbnailDirty = new Map();
            
            // レイヤートランスフォーム（一時的な変形）
            this.layerTransforms = new Map();
            
            // サムネイル更新キュー
            this.thumbnailUpdateQueue = new Set();
            this.thumbnailUpdateTimer = null;
            
            // レイヤー移動モード
            this.vKeyPressed = false;
            this.isLayerMoveMode = false;
            this.isLayerDragging = false;
            this.layerDragLastPoint = { x: 0, y: 0 };
            
            // UI要素
            this.layerTransformPanel = null;
            
            // 他システム参照
            this.cameraSystem = null;
            this.animationSystem = null;
            
            // 座標システム
            this.coordAPI = window.CoordinateSystem;
            
            // StateManager変更監視（存在確認）
            if (this.stateManager && typeof this.stateManager.addListener === 'function') {
                this.stateManager.addListener((state, source) => {
                    this.onStateChanged(state, source);
                });
            }
            
            // 初期化は遅延実行（config確実にロード後）
            if (typeof requestAnimationFrame !== 'undefined') {
                requestAnimationFrame(() => {
                    this._setupLayerOperations();
                    this._setupLayerTransformPanel();
                    this._setupAnimationSystemIntegration();
                    this._startThumbnailUpdateProcess();
                });
            } else {
                setTimeout(() => {
                    this._setupLayerOperations();
                    this._setupLayerTransformPanel();
                    this._setupAnimationSystemIntegration();
                    this._startThumbnailUpdateProcess();
                }, 0);
            }
        }

        // ===== StateManager変更監視 =====
        
        onStateChanged(state, source) {
            if (source === 'history:undo' || source === 'history:redo') {
                this.rebuildFromState(state);
                return;
            }
            
            if (source === 'layer:added') {
                this.syncLayersFromState(state);
                this.updateLayerPanelUI();
                return;
            }
            
            if (source === 'layer:removed') {
                this.syncLayersFromState(state);
                this.updateLayerPanelUI();
                return;
            }
            
            if (source === 'layer:reordered') {
                this.syncLayersFromState(state);
                this.updateLayerPanelUI();
                return;
            }
            
            if (source === 'active-cut:changed') {
                this.rebuildFromState(state);
                return;
            }
            
            if (source === 'paths:cleared') {
                this.syncLayersFromState(state);
                this.updateLayerPanelUI();
                return;
            }
        }

        rebuildFromState(state) {
            if (!this.currentCutContainer) {
                this.currentCutContainer = new PIXI.Container();
            }
            
            while (this.currentCutContainer.children.length > 0) {
                const child = this.currentCutContainer.children[0];
                this.currentCutContainer.removeChild(child);
                child.destroy({ children: true });
            }
            
            const currentCut = state.cuts[state.currentCutIndex];
            if (!currentCut) return;
            
            currentCut.layers.forEach((layerData) => {
                const pixiLayer = this.createPixiLayerFromData(layerData);
                this.currentCutContainer.addChild(pixiLayer);
            });
            
            this.activeLayerIndex = Math.min(
                state.currentLayerIndex,
                currentCut.layers.length - 1
            );
            
            this.updateLayerPanelUI();
            this.updateStatusDisplay();
        }

        syncLayersFromState(state) {
            if (!this.currentCutContainer) return;
            
            const currentCut = state.cuts[state.currentCutIndex];
            if (!currentCut) return;
            
            while (this.currentCutContainer.children.length > 0) {
                const child = this.currentCutContainer.children[0];
                this.currentCutContainer.removeChild(child);
                child.destroy({ children: true });
            }
            
            currentCut.layers.forEach((layerData) => {
                const pixiLayer = this.createPixiLayerFromData(layerData);
                this.currentCutContainer.addChild(pixiLayer);
            });
            
            this.activeLayerIndex = Math.min(
                state.currentLayerIndex,
                currentCut.layers.length - 1
            );
        }

        createPixiLayerFromData(layerData) {
            const layer = new PIXI.Container();
            layer.label = layerData.id;
            layer.layerData = layerData;
            
            if (layerData.transform) {
                layer.position.set(layerData.transform.x, layerData.transform.y);
                layer.rotation = layerData.transform.rotation;
                layer.scale.set(layerData.transform.scaleX, layerData.transform.scaleY);
                layer.pivot.set(layerData.transform.pivotX, layerData.transform.pivotY);
            }
            
            layer.visible = layerData.visible;
            layer.alpha = layerData.opacity;
            
            if (layerData.isBackground) {
                const bg = new PIXI.Graphics();
                bg.rect(0, 0, this.config.canvas.width, this.config.canvas.height);
                bg.fill(this.config.background.color);
                layer.addChild(bg);
            }
            
            if (layerData.paths && Array.isArray(layerData.paths)) {
                layerData.paths.forEach(pathData => {
                    const graphics = this.createGraphicsFromPath(pathData);
                    if (graphics) {
                        layer.addChild(graphics);
                    }
                });
            }
            
            return layer;
        }

        createGraphicsFromPath(pathData) {
            if (!pathData || !pathData.points || pathData.points.length === 0) {
                return null;
            }
            
            const graphics = new PIXI.Graphics();
            
            pathData.points.forEach(point => {
                if (typeof point.x === 'number' && typeof point.y === 'number' &&
                    isFinite(point.x) && isFinite(point.y)) {
                    graphics.circle(point.x, point.y, (pathData.size || 16) / 2);
                    graphics.fill({
                        color: pathData.color || 0x800000,
                        alpha: pathData.opacity || 1.0
                    });
                }
            });
            
            return graphics;
        }

        // ===== レイヤー作成・削除（Command経由）=====
        
        createLayer(name, isBackground = false) {
            const layerData = {
                id: `layer_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                name: name,
                visible: true,
                opacity: 1.0,
                isBackground: isBackground,
                transform: {
                    x: 0, y: 0,
                    rotation: 0,
                    scaleX: 1, scaleY: 1,
                    pivotX: 0, pivotY: 0
                },
                paths: []
            };
            
            if (window.History && window.CreateLayerCommand && this.stateManager) {
                const command = new window.CreateLayerCommand(
                    this.stateManager,
                    this.eventBus,
                    this.stateManager.getCurrentCutIndex(),
                    layerData
                );
                
                window.History.executeCommand(command);
            }
            
            return layerData.id;
        }
        
        deleteLayer(layerIndex) {
            const layers = this.getLayers();
            
            if (layerIndex < 0 || layerIndex >= layers.length) {
                return false;
            }
            
            if (window.History && window.DeleteLayerCommand && this.stateManager) {
                const command = new window.DeleteLayerCommand(
                    this.stateManager,
                    this.eventBus,
                    this.stateManager.getCurrentCutIndex(),
                    layerIndex
                );
                
                window.History.executeCommand(command);
            }
            
            return true;
        }

        // ===== レイヤー取得 =====
        
        getLayers() {
            if (!this.currentCutContainer) return [];
            return this.currentCutContainer.children;
        }
        
        getActiveLayer() {
            const layers = this.getLayers();
            return this.activeLayerIndex >= 0 ? layers[this.activeLayerIndex] : null;
        }
        
        get layers() {
            return this.getLayers();
        }

        // ===== レイヤー選択 =====
        
        setActiveLayer(index) {
            if (!this.stateManager) return;
            
            const currentLayers = this.stateManager.getCurrentLayers();
            
            if (index < 0 || index >= currentLayers.length) {
                return;
            }
            
            this.activeLayerIndex = index;
            
            this.stateManager.setActiveLayer(
                this.stateManager.getCurrentCutIndex(),
                index
            );
            
            this.updateLayerPanelUI();
            this.updateStatusDisplay();
            
            if (this.isLayerMoveMode) {
                this.updateLayerTransformPanelValues();
            }
        }

        // ===== レイヤー並び替え =====
        
        reorderLayers(fromIndex, toIndex) {
            const layers = this.getLayers();
            
            if (fromIndex < 0 || fromIndex >= layers.length || 
                toIndex < 0 || toIndex >= layers.length || 
                fromIndex === toIndex) {
                return false;
            }
            
            if (window.History && window.ReorderLayersCommand && this.stateManager) {
                const command = new window.ReorderLayersCommand(
                    this.stateManager,
                    this.eventBus,
                    this.stateManager.getCurrentCutIndex(),
                    fromIndex,
                    toIndex
                );
                
                window.History.executeCommand(command);
            }
            return true;
        }

        // ===== レイヤー可視性切り替え =====
        
        toggleLayerVisibility(layerIndex) {
            if (!this.stateManager) return;
            
            const currentLayers = this.stateManager.getCurrentLayers();
            
            if (layerIndex < 0 || layerIndex >= currentLayers.length) {
                return;
            }
            
            const layer = currentLayers[layerIndex];
            
            if (window.History && window.UpdateLayerCommand) {
                const command = new window.UpdateLayerCommand(
                    this.stateManager,
                    this.eventBus,
                    this.stateManager.getCurrentCutIndex(),
                    layerIndex,
                    { visible: !layer.visible }
                );
                
                window.History.executeCommand(command);
            }
            
            this.requestThumbnailUpdate(layerIndex);
        }

        // ===== レイヤー階層移動 =====
        
        moveActiveLayerHierarchy(direction) {
            const layers = this.getLayers();
            if (layers.length <= 1) return;
            
            const currentIndex = this.activeLayerIndex;
            let newIndex;
            
            if (direction === 'up') {
                newIndex = Math.min(currentIndex + 1, layers.length - 1);
            } else if (direction === 'down') {
                newIndex = Math.max(currentIndex - 1, 0);
            } else {
                return;
            }
            
            if (newIndex !== currentIndex) {
                this.setActiveLayer(newIndex);
            }
        }

        // ===== Pathをレイヤーに追加 =====
        
        addPathToLayer(layerIndex, path) {
            if (!this.stateManager) return;
            
            const currentCutIndex = this.stateManager.getCurrentCutIndex();
            const pathId = this.stateManager.addPath(currentCutIndex, layerIndex, path);
            
            if (pathId) {
                const layers = this.getLayers();
                if (layerIndex >= 0 && layerIndex < layers.length) {
                    const pixiLayer = layers[layerIndex];
                    if (path.graphics) {
                        pixiLayer.addChild(path.graphics);
                    }
                }
                
                this.requestThumbnailUpdate(layerIndex);
                
                if (this.animationSystem?.generateCutThumbnail) {
                    setTimeout(() => {
                        this.animationSystem.generateCutThumbnail(currentCutIndex);
                    }, 100);
                }
            }
        }

        addPathToActiveLayer(path) {
            if (this.activeLayerIndex >= 0) {
                this.addPathToLayer(this.activeLayerIndex, path);
            }
        }

        // ===== CUT切り替え =====
        
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

        // ===== 初期化メソッド =====
        
        init(canvasContainer, eventBus, config) {
            this.currentCutContainer = canvasContainer;
            this.eventBus = eventBus || this.eventBus;
            this.config = config || this.config;
        }
        
        setApp(app) {
            this.app = app;
        }
        
        setCameraSystem(cameraSystem) {
            this.cameraSystem = cameraSystem;
        }

        // ===== CUTレンダーテクスチャ管理 =====
        
        createCutRenderTexture(cutId) {
            if (!this.app?.renderer) return null;
            
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
            if (!renderTexture) return;
            
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

        // ===== AnimationSystem統合 =====
        
        _setupAnimationSystemIntegration() {
            if (!this.eventBus) return;
            
            this.eventBus.on('animation:system-ready', () => {
                this._establishAnimationSystemConnection();
            });
            
            this.eventBus.on('animation:cut-applied', () => {
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
                
                if (this.animationSystem) {
                    if (this.animationSystem.layerSystem !== this) {
                        this.animationSystem.layerSystem = this;
                    }
                }
            }
        }

        // ===== レイヤートランスフォームパネル =====
        
        _setupLayerTransformPanel() {
            this.layerTransformPanel = document.getElementById('layer-transform-panel');
            
            if (!this.layerTransformPanel) return;
            
            if (!this.config?.layer) {
                console.error('LayerSystem: config.layer is undefined');
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
            if (!activeLayer) return;
            
            const layerId = activeLayer.label;
            
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
            
            this.requestThumbnailUpdate(this.activeLayerIndex);
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
            if (!activeLayer) return;
            
            const layerId = activeLayer.label;
            
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
            if (!activeLayer) return;
            
            const layerId = activeLayer.label;
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

        // ===== レイヤー操作（キーボード）=====
        
        _setupLayerOperations() {
            document.addEventListener('keydown', (e) => {
                const keyConfig = window.TEGAKI_KEYCONFIG_MANAGER;
                if (!keyConfig) return;
                
                const action = keyConfig.getActionForKey(e.code, {
                    vPressed: this.vKeyPressed,
                    shiftPressed: e.shiftKey
                });
                
                if (!action) return;
                
                switch(action) {
                    case 'layerMode':
                        if (!e.ctrlKey && !e.altKey && !e.metaKey) {
                            if (!this.vKeyPressed) {
                                this.enterLayerMoveMode();
                            }
                            e.preventDefault();
                        }
                        break;
                        
                    case 'gifPrevFrame':
                        if (!this.vKeyPressed && !e.shiftKey && !e.ctrlKey && !e.altKey && !e.metaKey) {
                            if (this.animationSystem?.goToPreviousFrame) {
                                this.animationSystem.goToPreviousFrame();
                            }
                            e.preventDefault();
                        }
                        break;
                        
                    case 'gifNextFrame':
                        if (!this.vKeyPressed && !e.shiftKey && !e.ctrlKey && !e.altKey && !e.metaKey) {
                            if (this.animationSystem?.goToNextFrame) {
                                this.animationSystem.goToNextFrame();
                            }
                            e.preventDefault();
                        }
                        break;
                    
                    case 'layerUp':
                        if (!this.vKeyPressed && !e.shiftKey && !e.ctrlKey && !e.altKey && !e.metaKey) {
                            this.moveActiveLayerHierarchy('up');
                            e.preventDefault();
                        }
                        break;
                        
                    case 'layerDown':
                        if (!this.vKeyPressed && !e.shiftKey && !e.ctrlKey && !e.altKey && !e.metaKey) {
                            this.moveActiveLayerHierarchy('down');
                            e.preventDefault();
                        }
                        break;
                    
                    case 'pen':
                    case 'eraser':
                        if (!e.ctrlKey && !e.altKey && !e.metaKey) {
                            if (this.isLayerMoveMode) {
                                this.exitLayerMoveMode();
                            }
                            e.preventDefault();
                        }
                        break;
                    
                    case 'layerMoveUp':
                        if (this.vKeyPressed && !e.shiftKey) {
                            this.moveActiveLayer('ArrowUp');
                            e.preventDefault();
                        }
                        break;
                        
                    case 'layerMoveDown':
                        if (this.vKeyPressed && !e.shiftKey) {
                            this.moveActiveLayer('ArrowDown');
                            e.preventDefault();
                        }
                        break;
                        
                    case 'layerMoveLeft':
                        if (this.vKeyPressed && !e.shiftKey) {
                            this.moveActiveLayer('ArrowLeft');
                            e.preventDefault();
                        }
                        break;
                        
                    case 'layerMoveRight':
                        if (this.vKeyPressed && !e.shiftKey) {
                            this.moveActiveLayer('ArrowRight');
                            e.preventDefault();
                        }
                        break;
                    
                    case 'layerScaleUp':
                        if (this.vKeyPressed && e.shiftKey) {
                            this.transformActiveLayer('ArrowUp');
                            e.preventDefault();
                        }
                        break;
                        
                    case 'layerScaleDown':
                        if (this.vKeyPressed && e.shiftKey) {
                            this.transformActiveLayer('ArrowDown');
                            e.preventDefault();
                        }
                        break;
                        
                    case 'layerRotateLeft':
                        if (this.vKeyPressed && e.shiftKey) {
                            this.transformActiveLayer('ArrowLeft');
                            e.preventDefault();
                        }
                        break;
                        
                    case 'layerRotateRight':
                        if (this.vKeyPressed && e.shiftKey) {
                            this.transformActiveLayer('ArrowRight');
                            e.preventDefault();
                        }
                        break;
                    
                    case 'horizontalFlip':
                        if (this.vKeyPressed && !e.ctrlKey && !e.altKey && !e.metaKey) {
                            if (e.shiftKey) {
                                this.flipActiveLayer('vertical');
                            } else {
                                this.flipActiveLayer('horizontal');
                            }
                            e.preventDefault();
                        }
                        break;
                }
            });
            
            document.addEventListener('keyup', (e) => {
                if (e.code === 'KeyV' && this.vKeyPressed) {
                    this.exitLayerMoveMode();
                    e.preventDefault();
                }
            });
            
            window.addEventListener('blur', () => {
                if (this.vKeyPressed) {
                    this.exitLayerMoveMode();
                }
            });
            
            this._setupLayerDragEvents();
        }

        _setupLayerDragEvents() {
            const canvas = this._getSafeCanvas();
            if (!canvas) return;
            
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
            
            canvas.addEventListener('pointerup', () => {
                if (this.isLayerDragging) {
                    this.isLayerDragging = false;
                    this.updateCursor();
                }
            });
        }

        _getSafeCanvas() {
            if (this.app?.canvas) return this.app.canvas;
            if (this.app?.view) return this.app.view;
            const canvasElements = document.querySelectorAll('canvas');
            if (canvasElements.length > 0) return canvasElements[0];
            return null;
        }

        _handleLayerDrag(e) {
            const activeLayer = this.getActiveLayer();
            if (!activeLayer) return;

            const dx = e.clientX - this.layerDragLastPoint.x;
            const dy = e.clientY - this.layerDragLastPoint.y;
            
            const worldScale = this.cameraSystem ? this.cameraSystem.worldContainer.scale.x : 1;
            const adjustedDx = dx / worldScale;
            const adjustedDy = dy / worldScale;
            
            const layerId = activeLayer.label;
            
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
                    const minScale = this.config?.layer?.minScale || 0.1;
                    const maxScale = this.config?.layer?.maxScale || 3.0;
                    const newScale = Math.max(minScale, Math.min(maxScale, currentScale * scaleFactor));
                    
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
            
            if (this.eventBus) {
                this.eventBus.emit('layer:move-mode-exited');
            }
        }

        moveActiveLayer(keyCode) {
            const activeLayer = this.getActiveLayer();
            if (!activeLayer) return;
            
            const layerId = activeLayer.label;
            
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
        }

        transformActiveLayer(keyCode) {
            const activeLayer = this.getActiveLayer();
            if (!activeLayer) return;
            
            if (!this.config?.layer) return;
            
            const layerId = activeLayer.label;
            
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
        }

        confirmLayerTransform() {
            const activeLayer = this.getActiveLayer();
            if (!activeLayer) return;
            
            const layerId = activeLayer.label;
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
            if (!this.stateManager) return true;
            
            const currentCutIndex = this.stateManager.getCurrentCutIndex();
            const layerIndex = this.activeLayerIndex;
            const layerData = this.stateManager.getLayer(currentCutIndex, layerIndex);
            
            if (!layerData || !layerData.paths || layerData.paths.length === 0) {
                return true;
            }
            
            try {
                const centerX = this.config.canvas.width / 2;
                const centerY = this.config.canvas.height / 2;
                
                const matrix = this.createTransformMatrix(transform, centerX, centerY);
                
                const transformedPaths = [];
                
                for (let i = 0; i < layerData.paths.length; i++) {
                    const path = layerData.paths[i];
                    
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
                        tool: path.tool
                    };
                    
                    transformedPaths.push(transformedPath);
                }
                
                if (window.History && window.UpdateLayerCommand) {
                    const command = new window.UpdateLayerCommand(
                        this.stateManager,
                        this.eventBus,
                        currentCutIndex,
                        layerIndex,
                        { paths: transformedPaths }
                    );
                    
                    window.History.executeCommand(command);
                }
                
                return true;
                
            } catch (error) {
                console.error('Error in safeApplyTransformToPaths:', error);
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
                        transformedPoints.push({
                            x: transformed.x,
                            y: transformed.y
                        });
                    }
                    
                } catch (transformError) {
                    continue;
                }
            }
            
            return transformedPoints;
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

        // ===== サムネイル更新 =====
        
        requestThumbnailUpdate(layerIndex) {
            const layers = this.getLayers();
            if (layerIndex >= 0 && layerIndex < layers.length) {
                this.thumbnailUpdateQueue.add(layerIndex);
                
                if (!this.thumbnailUpdateTimer) {
                    this.thumbnailUpdateTimer = setTimeout(() => {
                        this.processThumbnailUpdates();
                        this.thumbnailUpdateTimer = null;
                    }, 100);
                }
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
                console.warn(`Thumbnail update failed for layer ${layerIndex}:`, error);
            }
        }

        // ===== UI更新 =====
        
        updateLayerPanelUI() {
            const layerList = document.getElementById('layer-list');
            if (!layerList) return;

            layerList.innerHTML = '';
            
            if (!this.stateManager) return;
            
            const currentLayers = this.stateManager.getCurrentLayers();
            const layers = this.getLayers();

            for (let i = currentLayers.length - 1; i >= 0; i--) {
                const layerData = currentLayers[i];
                const isActive = (i === this.activeLayerIndex);
                
                const layerItem = document.createElement('div');
                layerItem.className = `layer-item ${isActive ? 'active' : ''}`;
                layerItem.dataset.layerId = layerData.id;
                layerItem.dataset.layerIndex = i;

                layerItem.innerHTML = `
                    <div class="layer-visibility ${layerData.visible ? '' : 'hidden'}">
                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            ${layerData.visible ? 
                                '<path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/>' :
                                '<path d="m15 18-.722-3.25"/><path d="m2 2 20 20"/><path d="M6.71 6.71C3.4 8.27 2 12 2 12s3 7 10 7c1.59 0 2.84-.3 3.79-.73"/><path d="m8.5 10.5 7 7"/><path d="M9.677 4.677C10.495 4.06 11.608 4 12 4c7 0 10 7 10 7a13.16 13.16 0 0 1-.64.77"/>'}
                        </svg>
                    </div>
                    <div class="layer-opacity">${Math.round((layerData.opacity || 1.0) * 100)}%</div>
                    <div class="layer-name">${layerData.name}</div>
                    <div class="layer-thumbnail">
                        <div class="layer-thumbnail-placeholder"></div>
                    </div>
                    <div class="layer-delete-button">
                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
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
                        } else if (action.includes('layer-delete-button')) {
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
                
                setTimeout(() => {
                    this.updateThumbnail(i);
                }, 50 * (currentLayers.length - i));
            }
        }

        updateStatusDisplay() {
            const activeLayer = this.getActiveLayer();
            if (!activeLayer || !activeLayer.layerData) return;

            const layerNameElement = document.getElementById('current-layer');
            if (layerNameElement) {
                layerNameElement.textContent = activeLayer.layerData.name;
            }

            const transformElement = document.getElementById('transform-info');
            if (transformElement) {
                const pos = activeLayer.position;
                const scale = activeLayer.scale;
                const rotation = activeLayer.rotation;
                
                transformElement.textContent = 
                    `x:${Math.round(pos.x)} y:${Math.round(pos.y)} ` +
                    `s:${scale.x.toFixed(1)} r:${Math.round(rotation * 180 / Math.PI)}°`;
            }
        }
    }

    // ===== グローバル公開 =====
    
    window.TegakiLayerSystem = LayerSystem;
    
    if (!window.layerSystem) {
        window.layerSystem = null;
    }

})();