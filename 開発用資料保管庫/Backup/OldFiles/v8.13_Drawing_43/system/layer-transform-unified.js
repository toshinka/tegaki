// ===== system/layer-transform.js - 統合座標版 =====
/**
 * LayerTransform - レイヤー変形機能（CoordinateUnification統合版）
 * 
 * 改修: CoordinateUnificationを統合し、変形と描画座標を完全同期
 * - Vモード中の変形操作は即座にpathsに反映
 * - confirmTransformで変形を焼き込み、以降の操作に支障なし
 * - 描画判定とペン位置の乖離を根絶
 */

(function() {
    'use strict';

    class LayerTransform {
        constructor(config, coordUnification) {
            this.config = config;
            this.coordUnification = coordUnification; // 統合座標API
            
            this.isVKeyPressed = false;
            this.isDragging = false;
            this.dragLastPoint = { x: 0, y: 0 };
            
            this.transformPanel = null;
            
            this.app = null;
            this.cameraSystem = null;
            
            // コールバック
            this.onTransformComplete = null;
            this.onTransformUpdate = null;
            this.onFlipRequest = null;
            this.onDragRequest = null;
            this.onSliderChange = null;
            this.onGetActiveLayer = null;
        }

        // ========== 初期化 =====

        init(app, cameraSystem) {
            this.app = app;
            this.cameraSystem = cameraSystem;
            
            this._setupTransformPanel();
            this._setupDragEvents();
            this._setupFlipKeyEvents();
            this._setupWheelEvents();
        }

        // ========== モード制御 =====

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
        }
        
        exitMoveMode() {
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
        
        toggleMoveMode() {
            if (this.isVKeyPressed) {
                this.exitMoveMode();
            } else {
                this.enterMoveMode();
            }
        }

        // ========== 変形操作（統合座標版） =====

        updateTransform(layer, property, value) {
            if (!layer?.layerData || !this.coordUnification) return;
            
            switch(property) {
                case 'x':
                    this.coordUnification.moveLayer(layer, value, 0);
                    break;
                case 'y':
                    this.coordUnification.moveLayer(layer, 0, value);
                    break;
                case 'rotation':
                    this.coordUnification.rotateLayer(layer, value, true);
                    break;
                case 'scale':
                    this.coordUnification.scaleLayer(layer, value, true);
                    break;
            }
            
            this.updateTransformPanelValues(layer);
            
            if (this.onTransformUpdate) {
                this.onTransformUpdate(layer, this.coordUnification.getTransform(layer.layerData.id));
            }
        }

        flipLayer(layer, direction) {
            if (!layer?.layerData || !this.coordUnification) return;
            
            this.coordUnification.flipLayer(layer, direction);
            this.updateFlipButtons(layer);
            
            if (this.onTransformUpdate) {
                this.onTransformUpdate(layer, this.coordUnification.getTransform(layer.layerData.id));
            }
        }

        moveLayer(layer, direction, amount = 5) {
            if (!layer?.layerData || !this.coordUnification) return;
            
            let deltaX = 0, deltaY = 0;
            
            switch(direction) {
                case 'ArrowUp':    deltaY = -amount; break;
                case 'ArrowDown':  deltaY = amount;  break;
                case 'ArrowLeft':  deltaX = -amount; break;
                case 'ArrowRight': deltaX = amount;  break;
            }
            
            this.coordUnification.moveLayer(layer, deltaX, deltaY);
            this.updateTransformPanelValues(layer);
            
            if (this.onTransformUpdate) {
                this.onTransformUpdate(layer, this.coordUnification.getTransform(layer.layerData.id));
            }
        }

        scaleLayer(layer, keyCode) {
            if (!layer?.layerData || !this.coordUnification) return;
            
            const transform = this.coordUnification.getTransform(layer.layerData.id);
            if (!transform) return;
            
            let currentScale = Math.abs(transform.scaleX);
            let newScale;
            
            if (keyCode === 'ArrowUp') {
                newScale = Math.min(this.config.layer.maxScale, currentScale * 1.1);
            } else if (keyCode === 'ArrowDown') {
                newScale = Math.max(this.config.layer.minScale, currentScale * 0.9);
            } else {
                return;
            }
            
            this.coordUnification.scaleLayer(layer, newScale, true);
            this.updateTransformPanelValues(layer);
            
            if (this.onTransformUpdate) {
                this.onTransformUpdate(layer, this.coordUnification.getTransform(layer.layerData.id));
            }
        }

        rotateLayer(layer, keyCode) {
            if (!layer?.layerData || !this.coordUnification) return;
            
            const rotationAmount = (15 * Math.PI) / 180;
            let rotationDelta = 0;
            
            if (keyCode === 'ArrowLeft') {
                rotationDelta = -rotationAmount;
            } else if (keyCode === 'ArrowRight') {
                rotationDelta = rotationAmount;
            } else {
                return;
            }
            
            this.coordUnification.rotateLayer(layer, rotationDelta, true);
            this.updateTransformPanelValues(layer);
            
            if (this.onTransformUpdate) {
                this.onTransformUpdate(layer, this.coordUnification.getTransform(layer.layerData.id));
            }
        }

        // ========== 変形確定 =====

        confirmTransform(layer) {
            if (!layer?.layerData || !this.coordUnification) return false;
            
            const transform = this.coordUnification.getTransform(layer.layerData.id);
            
            if (!this._isTransformNonDefault(transform)) {
                return false;
            }
            
            const success = this.coordUnification.confirmTransform(layer);
            
            if (!success) return false;
            
            this.updateFlipButtons(layer);
            
            if (this.onTransformComplete) {
                this.onTransformComplete(layer);
            }
            
            return true;
        }

        // ========== 内部UI設定 =====

        _setupTransformPanel() {
            this.transformPanel = document.getElementById('layer-transform-panel');
            
            if (!this.transformPanel) {
                return;
            }
            
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
                    if (this.onFlipRequest) {
                        this.onFlipRequest('horizontal');
                    }
                });
            }
            
            if (flipVerticalBtn) {
                flipVerticalBtn.addEventListener('click', () => {
                    if (this.onFlipRequest) {
                        this.onFlipRequest('vertical');
                    }
                });
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
        
        _setupDragEvents() {
            const canvas = this._getSafeCanvas();
            if (!canvas) return;
            
            canvas.addEventListener('pointerdown', (e) => {
                if (this.isVKeyPressed && e.button === 0) {
                    this.isDragging = true;
                    this.dragLastPoint = { x: e.clientX, y: e.clientY };
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
                if (!activeLayer?.layerData || !this.coordUnification) return;
                
                if (e.shiftKey) {
                    // Shift+ホイール: 回転
                    const rotationDelta = e.deltaY > 0 ? 0.05 : -0.05;
                    this.coordUnification.rotateLayer(activeLayer, rotationDelta, true);
                } else {
                    // ホイールのみ: 拡大縮小
                    const transform = this.coordUnification.getTransform(activeLayer.layerData.id);
                    if (!transform) return;
                    
                    const scaleDelta = e.deltaY > 0 ? 0.95 : 1.05;
                    const currentScale = Math.abs(transform.scaleX);
                    const newScale = Math.max(
                        this.config.layer.minScale,
                        Math.min(this.config.layer.maxScale, currentScale * scaleDelta)
                    );
                    
                    this.coordUnification.scaleLayer(activeLayer, newScale, true);
                }
                
                this.updateTransformPanelValues(activeLayer);
                
                if (this.onTransformUpdate) {
                    this.onTransformUpdate(activeLayer, this.coordUnification.getTransform(activeLayer.layerData.id));
                }
                
                e.preventDefault();
            }, { passive: false });
        }

        _handleDrag(e) {
            if (this.onDragRequest) {
                const dx = e.clientX - this.dragLastPoint.x;
                const dy = e.clientY - this.dragLastPoint.y;
                this.dragLastPoint = { x: e.clientX, y: e.clientY };
                
                this.onDragRequest(dx, dy, e.shiftKey);
            }
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

        // ========== UI更新 =====
        
        updateTransformPanelValues(layer) {
            if (!layer?.layerData || !this.coordUnification) return;
            
            const transform = this.coordUnification.getTransform(layer.layerData.id);
            if (!transform) return;
            
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
            if (!layer || !this.coordUnification) return;
            
            const transform = this.coordUnification.getTransform(layer.layerData.id);
            if (!transform) return;
            
            const flipHorizontalBtn = document.getElementById('flip-horizontal-btn');
            const flipVerticalBtn = document.getElementById('flip-vertical-btn');
            
            if (flipHorizontalBtn) {
                flipHorizontalBtn.classList.toggle('active', transform.scaleX < 0);
            }
            
            if (flipVerticalBtn) {
                flipVerticalBtn.classList.toggle('active', transform.scaleY < 0);
            }
        }
    }

    window.TegakiLayerTransform = LayerTransform;

})();