/**
 * @file system/layer-transform.js
 * @description レイヤートランスフォーム処理 - ペンタブレット完全対応版
 * 
 * 【改修履歴】
 * v8.13.5 - Vキー・ペンタブレット・反転ボタン完全修正
 *   🔧 Vキー復旧: keyboard:vkey-pressed イベント確実受信
 *   🔧 ペンドラッグ: passive:false + capture + pointer判定強化
 *   🔧 反転ボタン: layer-system経由でHistory一元管理
 *   🔧 Console削減: 不要なログ完全削除
 * 
 * 【親ファイル (このファイルが依存)】
 * - event-bus.js (イベント通信 - window.TegakiEventBus)
 * - coordinate-system.js (座標変換・トランスフォーム適用)
 * - config.js (設定値 - window.TEGAKI_CONFIG)
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
            if (!this.eventBus) {
                console.error('[LayerTransform] EventBus not found - retrying...');
                setTimeout(() => {
                    this.eventBus = window.TegakiEventBus;
                    if (this.eventBus) {
                        this._setupEventListeners();
                    }
                }, 100);
                return;
            }
            
            // 🔧 Vキー押下イベント
            this.eventBus.on('keyboard:vkey-pressed', ({ pressed }) => {
                if (pressed) {
                    this.enterMoveMode();
                } else {
                    const activeLayer = this.onGetActiveLayer ? this.onGetActiveLayer() : null;
                    this.exitMoveMode(activeLayer);
                }
            });
            
            // 反転ショートカット
            this.eventBus.on('layer:flip-by-key', (data) => {
                if (this.isVKeyPressed && this.onFlipRequest) {
                    this.onFlipRequest(data.direction);
                }
            });
            
            // トランスフォームリセット
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
         * 🔧 反転処理: History二重登録を防ぐためskipHistoryフラグ使用
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
            
            // 🔧 即座に実座標へ反映
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
                console.error('[LayerTransform] Transform failed:', error);
                return false;
            }
        }

        _createTransformMatrix(transform, centerX, centerY) {
            const x = Number(transform.x) || 0;
            const y = Number(transform.y) || 0;
            const rotation = Number(transform.rotation) || 0;
            const scaleX = Number(transform.scaleX) || 1;
            const scaleY = Number(transform.scaleY) || 1;
            
            const cos = Math.cos(rotation);
            const sin = Math.sin(rotation);
            
            return {
                a: scaleX * cos,
                b: scaleX * sin,
                c: -scaleY * sin,
                d: scaleY * cos,
                tx: x + centerX * (1 - scaleX * cos) + centerY * scaleY * sin,
                ty: y + centerY * (1 - scaleY * cos) - centerX * scaleX * sin
            };
        }
        
        _transformPoints(points, matrix) {
            return points.map(p => {
                const localX = Number(p.localX) || 0;
                const localY = Number(p.localY) || 0;
                
                return {
                    localX: matrix.a * localX + matrix.c * localY + matrix.tx,
                    localY: matrix.b * localX + matrix.d * localY + matrix.ty,
                    pressure: p.pressure || 0.5,
                    timestamp: p.timestamp || 0
                };
            });
        }
        
        _isTransformNonDefault(transform) {
            if (!transform) return false;
            return (
                Math.abs(transform.x) > 0.01 ||
                Math.abs(transform.y) > 0.01 ||
                Math.abs(transform.rotation) > 0.001 ||
                Math.abs(Math.abs(transform.scaleX) - 1) > 0.01 ||
                Math.abs(Math.abs(transform.scaleY) - 1) > 0.01
            );
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

        _setupSlider(sliderId, min, max, defaultValue, formatValue, property) {
            const sliderContainer = document.getElementById(sliderId);
            if (!sliderContainer) return;
            
            const handle = sliderContainer.querySelector('.slider-handle');
            const track = sliderContainer.querySelector('.slider-track');
            const label = sliderContainer.querySelector('.slider-label');
            
            if (!handle || !track || !label) return;
            
            const updateValue = (clientX) => {
                const rect = track.getBoundingClientRect();
                let ratio = (clientX - rect.left) / rect.width;
                ratio = Math.max(0, Math.min(1, ratio));
                
                let value = min + ratio * (max - min);
                
                if (property === 'rotation') {
                    value = value * Math.PI / 180;
                }
                
                handle.style.left = `${ratio * 100}%`;
                label.textContent = formatValue(property === 'rotation' ? (value * 180 / Math.PI) : value);
                
                if (this.onSliderChange) {
                    this.onSliderChange(property, value);
                }
            };
            
            handle.addEventListener('pointerdown', (e) => {
                if (this.activeSliderPointerId !== null) return;
                
                this.activeSliderPointerId = e.pointerId;
                this.activeSliderElement = handle;
                handle.style.cursor = 'grabbing';
                
                if (handle.setPointerCapture) {
                    try {
                        handle.setPointerCapture(e.pointerId);
                    } catch (err) {}
                }
                
                e.preventDefault();
                e.stopPropagation();
            });
            
            document.addEventListener('pointermove', (e) => {
                if (this.activeSliderPointerId === e.pointerId && this.activeSliderElement === handle) {
                    updateValue(e.clientX);
                    e.preventDefault();
                }
            }, { passive: false, capture: true });
            
            document.addEventListener('pointerup', (e) => {
                if (this.activeSliderPointerId === e.pointerId && this.activeSliderElement === handle) {
                    this.activeSliderPointerId = null;
                    this.activeSliderElement = null;
                    handle.style.cursor = 'grab';
                    
                    if (handle.releasePointerCapture) {
                        try {
                            handle.releasePointerCapture(e.pointerId);
                        } catch (err) {}
                    }
                }
            }, { capture: true });
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
         * 🔧 パネルドラッグ完全修正版 - ペンタブレット対応
         */
        _setupPanelDrag() {
            if (!this.transformPanel) return;
            
            const header = this.transformPanel.querySelector('.panel-header');
            if (!header) return;
            
            header.style.cursor = 'grab';
            header.style.touchAction = 'none';
            
            // 🔧 pointerdownでのみドラッグ開始（圧力判定なし）
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
                component: 'layer-transform',
                action: 'transform-changed',
                data: { layerIndex, layerId }
            });
            
            this._lastEmitTime = performance.now();
        }

        updateTransformPanelValues(layer) {
            if (!layer?.layerData || !this.transformPanel) return;
            
            const layerId = layer.layerData.id;
            const transform = this.transforms.get(layerId);
            
            if (!transform) return;
            
            this._updateSliderValue('layer-x-slider', transform.x, (v) => Math.round(v) + 'px');
            this._updateSliderValue('layer-y-slider', transform.y, (v) => Math.round(v) + 'px');
            this._updateSliderValue('layer-rotation-slider', transform.rotation * 180 / Math.PI, (v) => Math.round(v) + '°');
            this._updateSliderValue('layer-scale-slider', Math.abs(transform.scaleX), (v) => v.toFixed(2) + 'x');
        }
        
        _updateSliderValue(sliderId, value, formatValue) {
            const sliderContainer = document.getElementById(sliderId);
            if (!sliderContainer) return;
            
            const handle = sliderContainer.querySelector('.slider-handle');
            const label = sliderContainer.querySelector('.slider-label');
            const track = sliderContainer.querySelector('.slider-track');
            
            if (!handle || !label || !track) return;
            
            let min, max;
            if (sliderId === 'layer-x-slider') {
                min = this.config.layer.minX;
                max = this.config.layer.maxX;
            } else if (sliderId === 'layer-y-slider') {
                min = this.config.layer.minY;
                max = this.config.layer.maxY;
            } else if (sliderId === 'layer-rotation-slider') {
                min = this.config.layer.minRotation;
                max = this.config.layer.maxRotation;
            } else if (sliderId === 'layer-scale-slider') {
                min = this.config.layer.minScale;
                max = this.config.layer.maxScale;
            }
            
            const ratio = (value - min) / (max - min);
            const clampedRatio = Math.max(0, Math.min(1, ratio));
            
            handle.style.left = `${clampedRatio * 100}%`;
            label.textContent = formatValue(value);
        }

        updateFlipButtons(layer) {
            if (!layer?.layerData || !this.transformPanel) return;
            
            const layerId = layer.layerData.id;
            const transform = this.transforms.get(layerId);
            
            if (!transform) return;
            
            const flipHBtn = document.getElementById('flip-horizontal-btn');
            const flipVBtn = document.getElementById('flip-vertical-btn');
            
            if (flipHBtn) {
                if (transform.scaleX < 0) {
                    flipHBtn.classList.add('active');
                } else {
                    flipHBtn.classList.remove('active');
                }
            }
            
            if (flipVBtn) {
                if (transform.scaleY < 0) {
                    flipVBtn.classList.add('active');
                } else {
                    flipVBtn.classList.remove('active');
                }
            }
        }

        _getSafeCanvas() {
            return this.app?.canvas || document.querySelector('canvas');
        }

        _updateCursor() {
            const canvas = this._getSafeCanvas();
            if (!canvas) return;
            
            if (this.isVKeyPressed && !this.isDragging) {
                canvas.style.cursor = 'move';
            } else if (this.isDragging) {
                canvas.style.cursor = 'grabbing';
            } else {
                canvas.style.cursor = 'crosshair';
            }
        }

        getTransform(layerId) {
            return this.transforms.get(layerId);
        }

        setTransform(layerId, transform) {
            this.transforms.set(layerId, transform);
        }

        hasTransform(layerId) {
            return this.transforms.has(layerId);
        }

        clearTransform(layerId) {
            this.transforms.delete(layerId);
        }

        destroy() {
            if (this._emitTimer) {
                clearTimeout(this._emitTimer);
            }
            this.transforms.clear();
        }
    }

    window.LayerTransform = LayerTransform;
    window.TegakiLayerTransform = LayerTransform; // 🔧 後方互換性のため両方エクスポート

})();

console.log('✅ layer-transform.js (v8.13.5: Vキー・ペンタブレット・反転完全修正版) loaded');