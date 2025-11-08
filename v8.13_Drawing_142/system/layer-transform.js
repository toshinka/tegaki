/**
 * @file system/layer-transform.js
 * @description レイヤートランスフォーム処理 - ペンタブレット対応版
 * 
 * 【改修履歴】
 * v8.13.4 - パネルドラッグ+反転機能の完全修正
 *   🔧 パネルドラッグ: passive:false + capture + 圧力判定削除
 *   🔧 反転ボタン: History二重登録防止、即座確定機能
 *   🔧 Console抑制: 不要なログを全削除
 * 
 * 【親ファイル (このファイルが依存)】
 * - event-bus.js (イベント通信)
 * - coordinate-system.js (座標変換・トランスフォーム適用)
 * - config.js (設定値)
 * - layer-system.js (レイヤー取得)
 * 
 * 【子ファイル (このファイルに依存)】
 * - layer-system.js (flipActiveLayer経由で呼ばれる)
 * - keyboard-handler.js (Vキー・反転ショートカット)
 */

(function() {
    'use strict';

    class LayerTransform {
        constructor(config, coordAPI) {
            this.config = config;
            this.coordAPI = coordAPI;
            this.coordinateSystem = null;
            
            this.transforms = new Map();
            this.isVKeyPressed = false;
            this.isDragging = false;
            this.isPanelDragging = false;
            this.panelDragPointerId = null;
            this.dragLastPoint = { x: 0, y: 0 };
            this.dragStartPoint = { x: 0, y: 0 };
            this.panelDragOffset = { x: 0, y: 0 };
            
            this.activeSliderPointerId = null;
            this.activeSliderElement = null;
            
            this.transformPanel = null;
            this.app = null;
            this.cameraSystem = null;
            this.eventBus = window.TegakiEventBus;
            
            this.onTransformComplete = null;
            this.onTransformUpdate = null;
            this.onFlipRequest = null;
            this.onDragRequest = null;
            this.onSliderChange = null;
            this.onRebuildRequired = null;
            this.onGetActiveLayer = null;
            
            this._lastEmitTime = 0;
            this._emitTimer = null;
        }

        init(app, cameraSystem) {
            this.app = app;
            this.cameraSystem = cameraSystem;
            this.coordinateSystem = window.CoordinateSystem;
            
            this._setupTransformPanel();
            this._setupDragEvents();
            this._setupWheelEvents();
            this._setupEventListeners();
        }

        _setupEventListeners() {
            if (!this.eventBus) return;
            
            this.eventBus.on('keyboard:vkey-pressed', ({ pressed }) => {
                if (pressed) {
                    this.enterMoveMode();
                } else {
                    const activeLayer = this.onGetActiveLayer ? this.onGetActiveLayer() : null;
                    this.exitMoveMode(activeLayer);
                }
            });
            
            this.eventBus.on('layer:flip-by-key', (data) => {
                if (this.isVKeyPressed && this.onFlipRequest) {
                    this.onFlipRequest(data.direction);
                }
            });
            
            this.eventBus.on('layer:reset-transform', () => {
                if (this.isVKeyPressed) {
                    this.resetTransform();
                }
            });
        }

        enterMoveMode() {
            if (this.isVKeyPressed) return;
            
            this.isVKeyPressed = true;
            
            if (this.cameraSystem?.setVKeyPressed) {
                this.cameraSystem.setVKeyPressed(true);
                this.cameraSystem.showGuideLines();
            }
            
            if (this.transformPanel) {
                this.transformPanel.classList.add('show');
            }
            
            this._updateCursor();
            this._initializeTransformForActiveLayer();
        }
        
        exitMoveMode(activeLayer) {
            if (!this.isVKeyPressed) return;
            
            this.isVKeyPressed = false;
            this.isDragging = false;
            
            if (this.cameraSystem?.setVKeyPressed) {
                this.cameraSystem.setVKeyPressed(false);
                this.cameraSystem.hideGuideLines();
            }
            
            if (this.transformPanel) {
                this.transformPanel.classList.remove('show');
            }
            
            this._updateCursor();
        }
        
        toggleMoveMode(activeLayer) {
            if (this.isVKeyPressed) {
                this.exitMoveMode(activeLayer);
            } else {
                this.enterMoveMode();
            }
        }
        
        _initializeTransformForActiveLayer() {
            if (!this.onGetActiveLayer) return;
            const activeLayer = this.onGetActiveLayer();
            if (!activeLayer?.layerData) return;
            
            const layerId = activeLayer.layerData.id;
            if (!this.transforms.has(layerId)) {
                this.transforms.set(layerId, {
                    x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1
                });
            }
            
            this.updateTransformPanelValues(activeLayer);
            this.updateFlipButtons(activeLayer);
        }

        resetTransform() {
            if (!this.onGetActiveLayer) return;
            const activeLayer = this.onGetActiveLayer();
            if (!activeLayer?.layerData) return;
            
            const layerId = activeLayer.layerData.id;
            this.transforms.set(layerId, {
                x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1
            });
            
            activeLayer.position.set(0, 0);
            activeLayer.rotation = 0;
            activeLayer.scale.set(1, 1);
            activeLayer.pivot.set(0, 0);
            
            this.updateTransformPanelValues(activeLayer);
            this.updateFlipButtons(activeLayer);
            this._emitTransformUpdated(layerId, activeLayer);
        }

        updateTransform(layer, property, value) {
            if (!layer?.layerData) return;
            
            const layerId = layer.layerData.id;
            
            if (!this.transforms.has(layerId)) {
                this.transforms.set(layerId, {
                    x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1
                });
            }
            
            const transform = this.transforms.get(layerId);
            const centerX = this.config.canvas.width / 2;
            const centerY = this.config.canvas.height / 2;
            
            switch(property) {
                case 'x':
                    transform.x = Number(value) || 0;
                    break;
                case 'y':
                    transform.y = Number(value) || 0;
                    break;
                case 'rotation':
                    if (this.config.layer.rotationLoop) {
                        const maxRot = this.config.layer.maxRotation * Math.PI / 180;
                        let rot = Number(value) || 0;
                        while (rot > maxRot) rot -= (maxRot * 2);
                        while (rot < -maxRot) rot += (maxRot * 2);
                        transform.rotation = rot;
                    } else {
                        transform.rotation = Number(value) || 0;
                    }
                    break;
                case 'scale':
                    const hFlipped = transform.scaleX < 0;
                    const vFlipped = transform.scaleY < 0;
                    const scaleVal = Math.max(this.config.layer.minScale, 
                                             Math.min(this.config.layer.maxScale, Number(value)));
                    transform.scaleX = hFlipped ? -scaleVal : scaleVal;
                    transform.scaleY = vFlipped ? -scaleVal : scaleVal;
                    break;
            }
            
            this.applyTransform(layer, transform, centerX, centerY);
            this._emitTransformUpdated(layerId, layer);
            
            if (this.onTransformUpdate) {
                this.onTransformUpdate(layer, transform);
            }
        }
        
        applyTransform(layer, transform, centerX, centerY) {
            if (this.coordAPI?.applyLayerTransform) {
                this.coordAPI.applyLayerTransform(layer, transform, centerX, centerY);
            } else {
                this._applyTransformDirect(layer, transform, centerX, centerY);
            }
        }
        
        _applyTransformDirect(layer, transform, centerX, centerY) {
            const x = Number(transform.x) || 0;
            const y = Number(transform.y) || 0;
            const rotation = Number(transform.rotation) || 0;
            const scaleX = Number(transform.scaleX) || 1;
            const scaleY = Number(transform.scaleY) || 1;
            
            if (!isFinite(x) || !isFinite(y) || !isFinite(rotation) || 
                !isFinite(scaleX) || !isFinite(scaleY)) {
                return;
            }
            
            if (rotation !== 0 || Math.abs(scaleX) !== 1 || Math.abs(scaleY) !== 1) {
                layer.pivot.set(centerX, centerY);
                layer.position.set(centerX + x, centerY + y);
                layer.rotation = rotation;
                layer.scale.set(scaleX, scaleY);
            } else if (x !== 0 || y !== 0) {
                layer.pivot.set(0, 0);
                layer.position.set(x, y);
                layer.rotation = 0;
                layer.scale.set(1, 1);
            } else {
                layer.pivot.set(0, 0);
                layer.position.set(0, 0);
                layer.rotation = 0;
                layer.scale.set(1, 1);
            }
        }

        /**
         * 🔧 反転処理: History二重登録を防ぐためHistoryフラグ使用
         */
        flipLayer(layer, direction, skipHistory = false) {
            if (!layer?.layerData) return;
            
            const layerId = layer.layerData.id;
            
            if (!this.transforms.has(layerId)) {
                this.transforms.set(layerId, {
                    x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1
                });
            }
            
            const transform = this.transforms.get(layerId);
            const centerX = this.config.canvas.width / 2;
            const centerY = this.config.canvas.height / 2;
            
            if (direction === 'horizontal') {
                transform.scaleX *= -1;
            } else if (direction === 'vertical') {
                transform.scaleY *= -1;
            }
            
            this.applyTransform(layer, transform, centerX, centerY);
            
            // 🔧 即座に実座標へ反映（非同期なし）
            this.confirmTransform(layer, skipHistory);
            
            this.updateFlipButtons(layer);
            this._emitTransformUpdated(layerId, layer);
            
            if (this.onTransformUpdate) {
                this.onTransformUpdate(layer, transform);
            }
        }

        moveLayer(layer, direction, amount = 5) {
            if (!layer?.layerData) return;
            
            const layerId = layer.layerData.id;
            
            if (!this.transforms.has(layerId)) {
                this.transforms.set(layerId, {
                    x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1
                });
            }
            
            const transform = this.transforms.get(layerId);
            
            switch(direction) {
                case 'ArrowUp':    transform.y -= amount; break;
                case 'ArrowDown':  transform.y += amount; break;
                case 'ArrowLeft':  transform.x -= amount; break;
                case 'ArrowRight': transform.x += amount; break;
            }
            
            const centerX = this.config.canvas.width / 2;
            const centerY = this.config.canvas.height / 2;
            
            this.applyTransform(layer, transform, centerX, centerY);
            this.updateTransformPanelValues(layer);
            this._emitTransformUpdated(layerId, layer);
            
            if (this.onTransformUpdate) {
                this.onTransformUpdate(layer, transform);
            }
        }

        scaleLayer(layer, keyCode) {
            if (!layer?.layerData) return;
            
            const layerId = layer.layerData.id;
            
            if (!this.transforms.has(layerId)) {
                this.transforms.set(layerId, {
                    x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1
                });
            }
            
            const transform = this.transforms.get(layerId);
            const centerX = this.config.canvas.width / 2;
            const centerY = this.config.canvas.height / 2;
            
            let currentScale = Math.abs(transform.scaleX);
            let newScale;
            
            if (keyCode === 'ArrowUp') {
                newScale = Math.min(this.config.layer.maxScale, currentScale * 1.1);
            } else if (keyCode === 'ArrowDown') {
                newScale = Math.max(this.config.layer.minScale, currentScale * 0.9);
            } else {
                return;
            }
            
            const hFlipped = transform.scaleX < 0;
            const vFlipped = transform.scaleY < 0;
            transform.scaleX = hFlipped ? -newScale : newScale;
            transform.scaleY = vFlipped ? -newScale : newScale;
            
            this.applyTransform(layer, transform, centerX, centerY);
            this.updateTransformPanelValues(layer);
            this._emitTransformUpdated(layerId, layer);
            
            if (this.onTransformUpdate) {
                this.onTransformUpdate(layer, transform);
            }
        }

        rotateLayer(layer, keyCode) {
            if (!layer?.layerData) return;
            
            const layerId = layer.layerData.id;
            
            if (!this.transforms.has(layerId)) {
                this.transforms.set(layerId, {
                    x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1
                });
            }
            
            const transform = this.transforms.get(layerId);
            const centerX = this.config.canvas.width / 2;
            const centerY = this.config.canvas.height / 2;
            
            const rotationAmount = (15 * Math.PI) / 180;
            
            if (keyCode === 'ArrowLeft') {
                transform.rotation -= rotationAmount;
            } else if (keyCode === 'ArrowRight') {
                transform.rotation += rotationAmount;
            } else {
                return;
            }
            
            if (this.config.layer.rotationLoop) {
                const maxRot = Math.PI;
                while (transform.rotation > maxRot) transform.rotation -= (maxRot * 2);
                while (transform.rotation < -maxRot) transform.rotation += (maxRot * 2);
            }
            
            this.applyTransform(layer, transform, centerX, centerY);
            this.updateTransformPanelValues(layer);
            this._emitTransformUpdated(layerId, layer);
            
            if (this.onTransformUpdate) {
                this.onTransformUpdate(layer, transform);
            }
        }

        /**
         * 🔧 変形確定: skipHistoryでHistory二重登録を防止
         */
        confirmTransform(layer, skipHistory = false) {
            if (!layer?.layerData) return false;
            
            const layerId = layer.layerData.id;
            const transform = this.transforms.get(layerId);
            
            if (!this._isTransformNonDefault(transform)) {
                return false;
            }
            
            const pathsBackup = structuredClone(layer.layerData.paths);
            const success = this.applyTransformToPaths(layer, transform);
            
            if (!success) return false;
            
            layer.position.set(0, 0);
            layer.rotation = 0;
            layer.scale.set(1, 1);
            layer.pivot.set(0, 0);
            
            this.transforms.set(layerId, {
                x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1
            });
            
            if (this.onRebuildRequired) {
                this.onRebuildRequired(layer, layer.layerData.paths);
            }
            
            // 🔧 skipHistory=trueの場合はHistory登録しない
            if (!skipHistory && this.onTransformComplete) {
                this.onTransformComplete(layer, pathsBackup);
            }
            
            this.updateFlipButtons(layer);
            
            if (this.eventBus) {
                const layerMgr = window.CoreRuntime?.internal?.layerManager;
                if (layerMgr) {
                    const layerIndex = layerMgr.getLayerIndex(layer);
                    
                    this.eventBus.emit('thumbnail:layer-updated', {
                component: 'drawing',
                action: 'transform-applied',
                data: { layerIndex, layerId }
            });
            
            this._lastEmitTime = performance.now();
        }
        
        _setupTransformPanel() {
            this.transformPanel = document.getElementById('layer-transform-panel');
            
            if (!this.transformPanel) return;
            
            if (!this.transformPanel.querySelector('.panel-header')) {
                const header = document.createElement('div');
                header.className = 'panel-header';
                header.textContent = 'TRANSFORM';
                this.transformPanel.insertBefore(header, this.transformPanel.firstChild);
            }
            
            this._setupSlider('layer-x-slider', this.config.layer.minX, this.config.layer.maxX, 0, (value) => {
                return Math.round(value) + 'px';
            }, 'x');
            
            this._setupSlider('layer-y-slider', this.config.layer.minY, this.config.layer.maxY, 0, (value) => {
                return Math.round(value) + 'px';
            }, 'y');
            
            this._setupSlider('layer-rotation-slider', this.config.layer.minRotation, this.config.layer.maxRotation, 0, (value) => {
                return Math.round(value) + '°';
            }, 'rotation');
            
            this._setupSlider('layer-scale-slider', this.config.layer.minScale, this.config.layer.maxScale, 1.0, (value) => {
                return value.toFixed(2) + 'x';
            }, 'scale');
            
            // 🔧 反転ボタン: layer-system経由で呼び出し
            const flipHorizontalBtn = document.getElementById('flip-horizontal-btn');
            const flipVerticalBtn = document.getElementById('flip-vertical-btn');
            
            if (flipHorizontalBtn) {
                flipHorizontalBtn.addEventListener('pointerdown', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    const layerSystem = window.drawingApp?.layerManager;
                    if (layerSystem?.flipActiveLayer) {
                        layerSystem.flipActiveLayer('horizontal', true);
                    }
                });
                flipHorizontalBtn.removeAttribute('disabled');
            }
            
            if (flipVerticalBtn) {
                flipVerticalBtn.addEventListener('pointerdown', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    const layerSystem = window.drawingApp?.layerManager;
                    if (layerSystem?.flipActiveLayer) {
                        layerSystem.flipActiveLayer('vertical', true);
                    }
                });
                flipVerticalBtn.removeAttribute('disabled');
            }
            
            this._setupPanelDrag();
        }

        _setupSlider(sli
                        component: 'layer-transform',
                        action: 'transform-confirmed',
                        data: {
                            layerIndex: layerIndex,
                            layerId: layer.layerData.id,
                            immediate: true
                        }
                    });
                }
            }
            
            return true;
        }
        
        applyTransformToPaths(layer, transform) {
            if (!layer.layerData?.paths || layer.layerData.paths.length === 0) {
                return true;
            }
            
            try {
                const centerX = this.config.canvas.width / 2;
                const centerY = this.config.canvas.height / 2;
                
                const matrix = this._createTransformMatrix(transform, centerX, centerY);
                const transformedPaths = [];
                
                for (let path of layer.layerData.paths) {
                    if (!path?.points || !Array.isArray(path.points) || path.points.length === 0) {
                        continue;
                    }
                    
                    const transformedPoints = this._transformPoints(path.points, matrix);
                    
                    if (transformedPoints.length === 0) {
                        continue;
                    }
                    
                    transformedPaths.push({
                        id: path.id,
                        points: transformedPoints,
                        color: path.color,
                        size: path.size,
                        opacity: path.opacity,
                        tool: path.tool,
                        isComplete: path.isComplete || true,
                        strokeOptions: path.strokeOptions,
                        graphics: null
                    });
                }
                
                layer.layerData.paths = transformedPaths;
                return true;
                
            } catch (error) {
                return false;
            }
        }

        _setupDragEvents() {
            const canvas = this._getSafeCanvas();
            if (!canvas) return;
            
            canvas.addEventListener('pointerdown', (e) => {
                if (this.isVKeyPressed && e.button === 0) {
                    if (!this.coordinateSystem) return;
                    
                    const world = this.coordinateSystem.screenClientToWorld(e.clientX, e.clientY);
                    
                    this.isDragging = true;
                    this.dragStartPoint = { x: world.worldX, y: world.worldY };
                    this.dragLastPoint = { x: world.worldX, y: world.worldY };
                    canvas.style.cursor = 'move';
                    e.preventDefault();
                }
            });
            
            canvas.addEventListener('pointermove', (e) => {
                if (this.isDragging && this.isVKeyPressed) {
                    this._handleDrag(e);
                }
            });
            
            canvas.addEventListener('pointerup', () => {
                if (this.isDragging) {
                    this.isDragging = false;
                    this._updateCursor();
                }
            });
        }

        /**
         * 🔧 パネルドラッグ完全修正版
         */
        _setupPanelDrag() {
            if (!this.transformPanel) return;
            
            const header = this.transformPanel.querySelector('.panel-header');
            if (!header) return;
            
            header.style.cursor = 'grab';
            header.style.touchAction = 'none';
            
            // 🔧 pointerdownでのみドラッグ開始
            header.addEventListener('pointerdown', (e) => {
                // スライダー・ボタン領域は除外
                if (e.target.closest('.slider-container') || 
                    e.target.closest('.slider') ||
                    e.target.closest('.slider-track') ||
                    e.target.closest('.slider-handle') ||
                    e.target.closest('button')) {
                    return;
                }
                
                this.isPanelDragging = true;
                this.panelDragPointerId = e.pointerId;
                header.style.cursor = 'grabbing';
                
                const rect = this.transformPanel.getBoundingClientRect();
                this.panelDragOffset = {
                    x: e.clientX - rect.left,
                    y: e.clientY - rect.top
                };
                
                // ポインターキャプチャ設定
                if (header.setPointerCapture) {
                    try {
                        header.setPointerCapture(e.pointerId);
                    } catch (err) {}
                }
                
                e.preventDefault();
                e.stopPropagation();
            }, { passive: false });
            
            // 🔧 CRITICAL: passive: false + capture で確実にpreventDefault
            document.addEventListener('pointermove', (e) => {
                if (!this.isPanelDragging) return;
                if (e.pointerId !== this.panelDragPointerId) return;
                
                const newLeft = e.clientX - this.panelDragOffset.x;
                const newTop = e.clientY - this.panelDragOffset.y;
                
                this.transformPanel.style.left = `${newLeft}px`;
                this.transformPanel.style.top = `${newTop}px`;
                this.transformPanel.style.transform = 'none';
                
                e.preventDefault();
                e.stopPropagation();
            }, { passive: false, capture: true });
            
            document.addEventListener('pointerup', (e) => {
                if (!this.isPanelDragging) return;
                if (e.pointerId !== this.panelDragPointerId) return;
                
                this.isPanelDragging = false;
                this.panelDragPointerId = null;
                header.style.cursor = 'grab';
                
                // ポインターキャプチャ解放
                if (header.releasePointerCapture) {
                    try {
                        header.releasePointerCapture(e.pointerId);
                    } catch (err) {}
                }
                
                e.stopPropagation();
            }, { capture: true });
            
            document.addEventListener('pointercancel', (e) => {
                if (!this.isPanelDragging) return;
                if (e.pointerId !== this.panelDragPointerId) return;
                
                this.isPanelDragging = false;
                this.panelDragPointerId = null;
                header.style.cursor = 'grab';
            }, { capture: true });
        }

        _handleDrag(e) {
            if (!this.coordinateSystem) return;
            
            const world = this.coordinateSystem.screenClientToWorld(e.clientX, e.clientY);
            
            if (!isFinite(world.worldX) || !isFinite(world.worldY)) {
                return;
            }
            
            const dx = world.worldX - this.dragLastPoint.x;
            const dy = world.worldY - this.dragLastPoint.y;
            
            this.dragLastPoint = { x: world.worldX, y: world.worldY };
            
            if (this.onDragRequest) {
                this.onDragRequest(dx, dy, e.shiftKey);
            }
        }

        _setupWheelEvents() {
            const canvas = this._getSafeCanvas();
            if (!canvas) return;
            
            canvas.addEventListener('wheel', (e) => {
                if (!this.isVKeyPressed) return;
                
                if (!this.onGetActiveLayer) return;
                const activeLayer = this.onGetActiveLayer();
                if (!activeLayer?.layerData) return;
                
                const layerId = activeLayer.layerData.id;
                
                if (!this.transforms.has(layerId)) {
                    this.transforms.set(layerId, {
                        x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1
                    });
                }
                
                const transform = this.transforms.get(layerId);
                const centerX = this.config.canvas.width / 2;
                const centerY = this.config.canvas.height / 2;
                
                if (e.shiftKey) {
                    const rotationDelta = e.deltaY > 0 ? 0.05 : -0.05;
                    transform.rotation += rotationDelta;
                    
                    if (this.config.layer.rotationLoop) {
                        const maxRot = Math.PI;
                        while (transform.rotation > maxRot) transform.rotation -= (maxRot * 2);
                        while (transform.rotation < -maxRot) transform.rotation += (maxRot * 2);
                    }
                } else {
                    const scaleDelta = e.deltaY > 0 ? 0.95 : 1.05;
                    const currentScale = Math.abs(transform.scaleX);
                    const newScale = Math.max(
                        this.config.layer.minScale,
                        Math.min(this.config.layer.maxScale, currentScale * scaleDelta)
                    );
                    
                    const hFlipped = transform.scaleX < 0;
                    const vFlipped = transform.scaleY < 0;
                    transform.scaleX = hFlipped ? -newScale : newScale;
                    transform.scaleY = vFlipped ? -newScale : newScale;
                }
                
                this.applyTransform(activeLayer, transform, centerX, centerY);
                this.updateTransformPanelValues(activeLayer);
                this._emitTransformUpdated(layerId, activeLayer);
                
                if (this.onTransformUpdate) {
                    this.onTransformUpdate(activeLayer, transform);
                }
                
                e.preventDefault();
            }, { passive: false });
        }

        _emitTransformUpdated(layerId, layer) {
            if (this.eventBus) {
                const layerMgr = window.CoreRuntime?.internal?.layerManager;
                if (layerMgr && layer) {
                    const layerIndex = layerMgr.getLayerIndex(layer);
                    
                    this.eventBus.emit('layer:updated', {
                        component: 'layer',
                        action: 'transform-changed',
                        data: { layerIndex, layerId }
                    });
                }
            }
            
            const now = performance.now();
            if (this._lastEmitTime && (now - this._lastEmitTime) < 100) {
                if (this._emitTimer) {
                    clearTimeout(this._emitTimer);
                }
                this._emitTimer = setTimeout(() => {
                    this._emitTransformUpdateImmediate(layerId, layer);
                }, 100);
                return;
            }
            
            this._emitTransformUpdateImmediate(layerId, layer);
        }
        
        _emitTransformUpdateImmediate(layerId, layer) {
            if (!this.eventBus) return;
            
            const layerMgr = window.CoreRuntime?.internal?.layerManager;
            if (!layerMgr || !layer) return;
            
            const layerIndex = layerMgr.getLayerIndex(layer);
            const transform = this.transforms.get(layerId);
            
            if (!transform) return;
            
            const transformPayload = {
                x: Number(transform.x) || 0,
                y: Number(transform.y) || 0,
                scaleX: Number(transform.scaleX) || 1,
                scaleY: Number(transform.scaleY) || 1,
                rotation: Number(transform.rotation) || 0
            };
            
            this.eventBus.emit('layer:transform-updated', {
                component: 'layer',
                action: 'transform-updated',
                data: { layerIndex, layerId, transform: transformPayload }
            });
            
            this.eventBus.emit('thumbnail:layer-updated', {