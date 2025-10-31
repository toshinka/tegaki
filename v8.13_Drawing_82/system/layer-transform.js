// ===== system/layer-transform.js - Phase 1完全版 + Vキー座標ずれ修正 =====
// Phase 1: TransformStack統合完全版
// Phase 7: 座標同期完全版
// 🔧 Vキーモードでの拡大縮小時の座標ずれを修正

(function() {
    'use strict';

    class LayerTransform {
        constructor(config, coordAPI) {
            this.config = config;
            this.coordAPI = coordAPI;
            this.coordinateSystem = null;
            
            this.transforms = new Map();
            
            // Phase 1追加: TransformStack管理
            this.layerTransformStacks = new Map();
            
            this.isVKeyPressed = false;
            this.isDragging = false;
            this.dragLastPoint = { x: 0, y: 0 };
            this.dragStartPoint = { x: 0, y: 0 };
            
            // 🔧 拡大縮小時の座標補正用
            this.dragStartLayerPos = { x: 0, y: 0 };
            
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
            
            this.gsapAvailable = typeof gsap !== 'undefined';
            this.debugMode = false;
        }

        init(app, cameraSystem) {
            this.app = app;
            this.cameraSystem = cameraSystem;
            
            this.coordinateSystem = window.CoordinateSystem;
            
            if (!this.coordinateSystem) {
                console.error('[Transform] CoordinateSystem not found');
            }
            
            this._setupTransformPanel();
            this._setupDragEvents();
            this._setupFlipKeyEvents();
            this._setupWheelEvents();
            
            console.log('✅ LayerTransform Phase 1完全版 + Vキー座標ずれ修正');
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
            this._updateFlipButtonsAvailability(true);
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
            this._updateFlipButtonsAvailability(false);
        }
        
        toggleMoveMode(activeLayer) {
            if (this.isVKeyPressed) {
                this.exitMoveMode(activeLayer);
            } else {
                this.enterMoveMode();
            }
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
                    transform.rotation = Number(value) || 0;
                    break;
                case 'scale':
                    const hFlipped = transform.scaleX < 0;
                    const vFlipped = transform.scaleY < 0;
                    transform.scaleX = hFlipped ? -Number(value) : Number(value);
                    transform.scaleY = vFlipped ? -Number(value) : Number(value);
                    break;
            }
            
            this.applyTransform(layer, transform, centerX, centerY);
            
            if (this.onTransformUpdate) {
                this.onTransformUpdate(layer, transform);
            }
        }
        
        // Phase 1統合 + Phase 7強化版
        applyTransform(layer, transform, centerX, centerY) {
            if (this.gsapAvailable) {
                gsap.killTweensOf(layer);
            }
            
            if (this.coordAPI?.applyLayerTransform) {
                this.coordAPI.applyLayerTransform(layer, transform, centerX, centerY);
            } else {
                this._applyTransformDirect(layer, transform, centerX, centerY);
            }
            
            // Phase 1: TransformStackにも反映
            const layerId = layer.layerData?.id;
            if (layerId) {
                this.setTransform(layerId, transform);
            }
            
            // Phase 7: CoordinateSystemキャッシュクリア
            if (this.coordinateSystem) {
                if (typeof this.coordinateSystem.clearCache === 'function') {
                    this.coordinateSystem.clearCache();
                }
                if (typeof this.coordinateSystem._invalidateRectCache === 'function') {
                    this.coordinateSystem._invalidateRectCache();
                }
            }
            
            // イベント発火
            if (this.gsapAvailable) {
                gsap.delayedCall(0.016, () => {
                    this._emitTransformUpdated(layer.layerData.id, layer);
                });
            } else {
                requestAnimationFrame(() => {
                    this._emitTransformUpdated(layer.layerData.id, layer);
                });
            }
        }
        
        // Phase 1追加: Transform設定時のTransformStack自動生成・更新
        setTransform(layerId, transform) {
            this.transforms.set(layerId, { ...transform });
            
            // TransformStackにも反映（coordinateSystem初期化済みの場合のみ）
            if (!this.coordinateSystem) {
                // 初期化前の場合はTransformStackの登録をスキップ
                return;
            }
            
            let stack = this.layerTransformStacks.get(layerId);
            if (!stack) {
                stack = this.coordinateSystem.createTransformStack(
                    `layer-${layerId}`,
                    transform
                );
                this.layerTransformStacks.set(layerId, stack);
            } else {
                stack.setTransform(transform);
            }
        }
        
        getTransform(layerId) {
            return this.transforms.get(layerId) || null;
        }
        
        deleteTransform(layerId) {
            this.transforms.delete(layerId);
            
            // Phase 1: TransformStackも削除
            const stack = this.layerTransformStacks.get(layerId);
            if (stack) {
                this.coordinateSystem.removeTransformStack(`layer-${layerId}`);
                this.layerTransformStacks.delete(layerId);
            }
        }
        
        // Phase 1追加: レイヤーのWorldMatrix取得
        getLayerWorldMatrix(layerId) {
            const stack = this.layerTransformStacks.get(layerId);
            return stack ? stack.getWorldMatrix() : null;
        }
        
        _applyTransformDirect(layer, transform, centerX, centerY) {
            const x = Number(transform.x) || 0;
            const y = Number(transform.y) || 0;
            const rotation = Number(transform.rotation) || 0;
            const scaleX = Number(transform.scaleX) || 1;
            const scaleY = Number(transform.scaleY) || 1;
            
            if (!isFinite(x) || !isFinite(y) || !isFinite(rotation) || 
                !isFinite(scaleX) || !isFinite(scaleY)) {
                console.warn('[Transform] Invalid values', { x, y, rotation, scaleX, scaleY });
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

        flipLayer(layer, direction) {
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
            this.updateFlipButtons(layer);
            
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
            
            this.applyTransform(layer, transform, centerX, centerY);
            this.updateTransformPanelValues(layer);
            
            if (this.onTransformUpdate) {
                this.onTransformUpdate(layer, transform);
            }
        }

        confirmTransform(layer) {
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
            
            // Phase 1: TransformStackもリセット
            const stack = this.layerTransformStacks.get(layerId);
            if (stack) {
                stack.reset();
            }
            
            // Phase 7: 確定時もキャッシュクリア
            if (this.coordinateSystem) {
                if (typeof this.coordinateSystem.clearCache === 'function') {
                    this.coordinateSystem.clearCache();
                }
                if (typeof this.coordinateSystem._invalidateRectCache === 'function') {
                    this.coordinateSystem._invalidateRectCache();
                }
            }
            
            if (this.onRebuildRequired) {
                this.onRebuildRequired(layer, layer.layerData.paths);
            }
            
            if (this.onTransformComplete) {
                this.onTransformComplete(layer, pathsBackup);
            }
            
            this.updateFlipButtons(layer);
            
            if (this.eventBus) {
                const layerMgr = window.CoreRuntime?.internal?.layerManager;
                if (layerMgr) {
                    const layerIndex = layerMgr.getLayerIndex(layer);
                    
                    this.eventBus.emit('thumbnail:layer-updated', {
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

        // 🔧 ドラッグイベント設定（座標ずれ修正版）
        _setupDragEvents() {
            const canvas = this._getSafeCanvas();
            if (!canvas) return;
            
            canvas.addEventListener('pointerdown', (e) => {
                if (this.isVKeyPressed && e.button === 0) {
                    if (!this.coordinateSystem) {
                        console.warn('[Transform] coordinateSystem unavailable');
                        return;
                    }
                    
                    const world = this.coordinateSystem.screenClientToWorld(e.clientX, e.clientY);
                    
                    this.isDragging = true;
                    this.dragStartPoint = { x: world.worldX, y: world.worldY };
                    this.dragLastPoint = { x: world.worldX, y: world.worldY };
                    
                    // 🔧 ドラッグ開始時のレイヤー位置を記録
                    if (this.onGetActiveLayer) {
                        const activeLayer = this.onGetActiveLayer();
                        if (activeLayer?.layerData) {
                            const layerId = activeLayer.layerData.id;
                            const transform = this.transforms.get(layerId);
                            if (transform) {
                                this.dragStartLayerPos = { x: transform.x, y: transform.y };
                            } else {
                                this.dragStartLayerPos = { x: 0, y: 0 };
                            }
                        }
                    }
                    
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

        // 🔧 ドラッグハンドラ（座標ずれ修正版）
        _handleDrag(e) {
            if (!this.coordinateSystem) return;
            if (!this.onGetActiveLayer) return;
            
            const activeLayer = this.onGetActiveLayer();
            if (!activeLayer?.layerData) return;
            
            const layerId = activeLayer.layerData.id;
            const transform = this.transforms.get(layerId);
            if (!transform) return;
            
            // 🔧 修正: 現在のWorld座標を取得
            const currentWorld = this.coordinateSystem.screenClientToWorld(e.clientX, e.clientY);
            
            if (!isFinite(currentWorld.worldX) || !isFinite(currentWorld.worldY)) {
                return;
            }
            
            // 🔧 修正: ドラッグ開始点からの移動量を計算（World座標空間で）
            const worldDx = currentWorld.worldX - this.dragStartPoint.x;
            const worldDy = currentWorld.worldY - this.dragStartPoint.y;
            
            // 🔧 修正: レイヤーのスケール・回転を考慮して移動量を補正
            const currentScale = Math.abs(transform.scaleX);
            const rotation = transform.rotation;
            
            // 回転を考慮した移動量の逆変換
            let correctedDx = worldDx;
            let correctedDy = worldDy;
            
            if (Math.abs(rotation) > 1e-6) {
                const cos = Math.cos(-rotation);
                const sin = Math.sin(-rotation);
                correctedDx = worldDx * cos - worldDy * sin;
                correctedDy = worldDx * sin + worldDy * cos;
            }
            
            // スケールで補正（拡大されている場合は移動量を小さく）
            correctedDx /= currentScale;
            correctedDy /= currentScale;
            
            // 🔧 修正: ドラッグ開始時の位置に補正後の移動量を加算
            const newX = this.dragStartLayerPos.x + correctedDx;
            const newY = this.dragStartLayerPos.y + correctedDy;
            
            transform.x = newX;
            transform.y = newY;
            
            const centerX = this.config.canvas.width / 2;
            const centerY = this.config.canvas.height / 2;
            
            this.applyTransform(activeLayer, transform, centerX, centerY);
            this.updateTransformPanelValues(activeLayer);
            
            if (this.onTransformUpdate) {
                this.onTransformUpdate(activeLayer, transform);
            }
        }

        _setupFlipKeyEvents() {
            document.addEventListener('keydown', (e) => {
                if (!this.isVKeyPressed) return;
                
                const activeElement = document.activeElement;
                if (activeElement && (
                    activeElement.tagName === 'INPUT' ||
                    activeElement.tagName === 'TEXTAREA' ||
                    activeElement.isContentEditable
                )) {
                    return;
                }
                
                if (e.code === 'KeyH' && !e.ctrlKey && !e.altKey && !e.metaKey) {
                    if (e.shiftKey) {
                        if (this.onFlipRequest) {
                            this.onFlipRequest('vertical');
                        }
                    } else {
                        if (this.onFlipRequest) {
                            this.onFlipRequest('horizontal');
                        }
                    }
                    e.preventDefault();
                }
            });
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
                component: 'drawing',
                action: 'transform-applied',
                data: { layerIndex, layerId }
            });
            
            this._lastEmitTime = performance.now();
        }
        
        _updateFlipButtonsAvailability(isVMode) {
            const flipHorizontalBtn = document.getElementById('flip-horizontal-btn');
            const flipVerticalBtn = document.getElementById('flip-vertical-btn');
            
            if (flipHorizontalBtn) {
                if (isVMode) {
                    flipHorizontalBtn.removeAttribute('disabled');
                    flipHorizontalBtn.style.opacity = '1';
                    flipHorizontalBtn.style.cursor = 'pointer';
                } else {
                    flipHorizontalBtn.setAttribute('disabled', 'true');
                    flipHorizontalBtn.style.opacity = '0.4';
                    flipHorizontalBtn.style.cursor = 'not-allowed';
                }
            }
            
            if (flipVerticalBtn) {
                if (isVMode) {
                    flipVerticalBtn.removeAttribute('disabled');
                    flipVerticalBtn.style.opacity = '1';
                    flipVerticalBtn.style.cursor = 'pointer';
                } else {
                    flipVerticalBtn.setAttribute('disabled', 'true');
                    flipVerticalBtn.style.opacity = '0.4';
                    flipVerticalBtn.style.cursor = 'not-allowed';
                }
            }
        }
        
        _setupTransformPanel() {
            this.transformPanel = document.getElementById('layer-transform-panel');
            
            if (!this.transformPanel) return;
            
            this._setupSlider('layer-x-slider', this.config.layer.minX, this.config.layer.maxX, 0, (value) => {
                return Math.round(value) + 'px';
            });
            
            this._setupSlider('layer-y-slider', this.config.layer.minY, this.config.layer.maxY, 0, (value) => {
                return Math.round(value) + 'px';
            });
            
            this._setupSlider('layer-rotation-slider', this.config.layer.minRotation, this.config.layer.maxRotation, 0, (value) => {
                return Math.round(value) + '°';
            });
            
            this._setupSlider('layer-scale-slider', this.config.layer.minScale, this.config.layer.maxScale, 1.0, (value) => {
                return value.toFixed(2) + 'x';
            });
            
            const flipHorizontalBtn = document.getElementById('flip-horizontal-btn');
            const flipVerticalBtn = document.getElementById('flip-vertical-btn');
            
            if (flipHorizontalBtn) {
                flipHorizontalBtn.addEventListener('click', () => {
                    if (this.isVKeyPressed && this.onFlipRequest) {
                        this.onFlipRequest('horizontal');
                    }
                });
                flipHorizontalBtn.setAttribute('disabled', 'true');
                flipHorizontalBtn.style.opacity = '0.4';
                flipHorizontalBtn.style.cursor = 'not-allowed';
            }
            
            if (flipVerticalBtn) {
                flipVerticalBtn.addEventListener('click', () => {
                    if (this.isVKeyPressed && this.onFlipRequest) {
                        this.onFlipRequest('vertical');
                    }
                });
                flipVerticalBtn.setAttribute('disabled', 'true');
                flipVerticalBtn.style.opacity = '0.4';
                flipVerticalBtn.style.cursor = 'not-allowed';
            }
        }

        _setupSlider(sliderId, min, max, initial, formatCallback) {
            const container = document.getElementById(sliderId);
            if (!container) return;

            const track = container.querySelector('.slider-track');
            const handle = container.querySelector('.slider-handle');
            const valueDisplay = container.parentNode.querySelector('.slider-value');

            if (!track || !handle || !valueDisplay) return;

            let value = initial;
            let dragging = false;

            const update = (newValue) => {
                value = Math.max(min, Math.min(max, newValue));
                const percentage = ((value - min) / (max - min)) * 100;
                
                track.style.width = percentage + '%';
                handle.style.left = percentage + '%';
                valueDisplay.textContent = formatCallback(value);
            };

            const getValue = (clientX) => {
                const rect = container.getBoundingClientRect();
                const percentage = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
                return min + (percentage * (max - min));
            };

            container.addEventListener('mousedown', (e) => {
                dragging = true;
                const newValue = getValue(e.clientX);
                update(newValue);
                
                if (this.onSliderChange) {
                    this.onSliderChange(sliderId, newValue);
                }
                
                e.preventDefault();
            });

            document.addEventListener('mousemove', (e) => {
                if (dragging) {
                    const newValue = getValue(e.clientX);
                    update(newValue);
                    
                    if (this.onSliderChange) {
                        this.onSliderChange(sliderId, newValue);
                    }
                }
            });

            document.addEventListener('mouseup', () => {
                dragging = false;
            });

            container.updateValue = (newValue) => {
                update(newValue);
            };

            update(initial);
        }

        _getSafeCanvas() {
            if (this.app?.canvas) return this.app.canvas;
            if (this.app?.view) return this.app.view;
            
            const canvasElements = document.querySelectorAll('canvas');
            if (canvasElements.length > 0) {
                return canvasElements[0];
            }
            return null;
        }

        _createTransformMatrix(transform, centerX, centerY) {
            const matrix = new PIXI.Matrix();
            
            matrix.translate(-centerX, -centerY);
            matrix.scale(transform.scaleX, transform.scaleY);
            matrix.rotate(transform.rotation);
            matrix.translate(centerX + transform.x, centerY + transform.y);
            
            return matrix;
        }

        _transformPoints(points, matrix) {
            const transformedPoints = [];
            
            for (let point of points) {
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

        _isTransformNonDefault(transform) {
            if (!transform) return false;
            return (transform.x !== 0 || transform.y !== 0 || 
                    transform.rotation !== 0 || 
                    Math.abs(transform.scaleX) !== 1 || 
                    Math.abs(transform.scaleY) !== 1);
        }

        _updateCursor() {
            const canvas = this._getSafeCanvas();
            if (!canvas) return;

            if (this.isVKeyPressed) {
                canvas.style.cursor = 'grab';
            } else {
                canvas.style.cursor = 'default';
            }
        }

        updateTransformPanelValues(layer) {
            if (!layer?.layerData) return;
            
            const layerId = layer.layerData.id;
            const transform = this.transforms.get(layerId) || {
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
            
            this.updateFlipButtons(layer);
        }
        
        updateFlipButtons(layer) {
            if (!layer) return;
            
            const flipHorizontalBtn = document.getElementById('flip-horizontal-btn');
            const flipVerticalBtn = document.getElementById('flip-vertical-btn');
            
            if (flipHorizontalBtn) {
                flipHorizontalBtn.classList.toggle('active', layer.scale.x < 0);
            }
            
            if (flipVerticalBtn) {
                flipVerticalBtn.classList.toggle('active', layer.scale.y < 0);
            }
        }
    }

    window.TegakiLayerTransform = LayerTransform;

})();

console.log('✅ layer-transform.js (Phase 1完全版 + Vキー座標ずれ修正) loaded');
console.log('   🔧 Vキーモード拡大縮小時の座標ずれを修正');
console.log('   - Phase 1: TransformStack統合完全版');
console.log('   - Phase 7: 座標同期完全版');