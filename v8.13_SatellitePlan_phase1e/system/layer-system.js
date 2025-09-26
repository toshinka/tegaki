// ===== system/layer-system.js - レイヤー管理専用モジュール =====
// レイヤー管理（生成・削除・並び替え・回転・反転・透明度・表示/非表示）
// PixiJS v8.13 対応

(function() {
    'use strict';

    class LayerSystem {
        constructor() {
            this.canvasContainer = null;
            this.app = null;
            this.cameraSystem = null;
            this.eventBus = null;
            this.config = null;
            
            // レイヤー管理
            this.layers = [];
            this.activeLayerIndex = -1;
            this.layerCounter = 0;
            this.thumbnailUpdateQueue = new Set();
            
            this.layersContainer = null;
            
            // レイヤー移動モード関連
            this.vKeyPressed = false;
            this.isLayerMoveMode = false;
            this.isLayerDragging = false;
            this.layerDragLastPoint = { x: 0, y: 0 };
            
            // レイヤー変形データの保持
            this.layerTransforms = new Map(); // layerId -> { x, y, rotation, scaleX, scaleY }
            
            // UI要素
            this.layerTransformPanel = null;
        }

        init(canvasContainer, app, eventBus, config) {
            this.canvasContainer = canvasContainer;
            this.app = app;
            this.eventBus = eventBus;
            this.config = config || window.TEGAKI_CONFIG;
            
            this.layersContainer = new PIXI.Container();
            this.layersContainer.label = 'layersContainer';
            this.canvasContainer.addChild(this.layersContainer);
            
            this._setupLayerOperations();
            this._setupLayerTransformPanel();
            
            // EventBus監視
            this.eventBus.on('ui:create-layer', (name) => this.createLayer(name));
            this.eventBus.on('ui:delete-layer', (index) => this.deleteLayer(index));
            this.eventBus.on('ui:set-active-layer', (index) => this.setActiveLayer(index));
            this.eventBus.on('ui:toggle-layer-visibility', (index) => this.toggleLayerVisibility(index));
            
            console.log('✅ LayerSystem initialized');
        }

        _setupLayerTransformPanel() {
            this.layerTransformPanel = document.getElementById('layer-transform-panel');
            
            if (!this.layerTransformPanel) return;
            
            // スライダー設定
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
            
            // 反転ボタン
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

            // 外部からの値更新用
            container.updateValue = (newValue) => {
                update(newValue, false);
            };

            update(initial);
        }

        // レイヤー変形データを保持して累積的に適用
        updateActiveLayerTransform(property, value) {
            const activeLayer = this.getActiveLayer();
            if (!activeLayer) return;
            
            const layerId = activeLayer.layerData.id;
            
            // 変形データを初期化
            this.layerTransforms.set(layerId, {
                x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1
            });

            if (isBackground) {
                const bg = new PIXI.Graphics();
                bg.rect(0, 0, this.config.canvas.width, this.config.canvas.height);
                bg.fill(this.config.background.color);
                layer.addChild(bg);
                layer.layerData.backgroundGraphics = bg;
            }

            this.layers.push(layer);
            this.layersContainer.addChild(layer);
            
            this.eventBus.emit('layer:created', { layerId, name, isBackground });
            return { layer, index: this.layers.length - 1 };
        }

        setActiveLayer(index) {
            if (index >= 0 && index < this.layers.length) {
                this.activeLayerIndex = index;
                this.updateLayerPanelUI();
                this.updateStatusDisplay();
                
                if (this.isLayerMoveMode) {
                    this.updateLayerTransformPanelValues();
                }
                
                this.eventBus.emit('layer:active-changed', { index, layerId: this.layers[index].layerData.id });
            }
        }

        getActiveLayer() {
            return this.activeLayerIndex >= 0 ? this.layers[this.activeLayerIndex] : null;
        }

        addPathToLayer(layerIndex, path) {
            if (layerIndex >= 0 && layerIndex < this.layers.length) {
                const layer = this.layers[layerIndex];
                layer.layerData.paths.push(path);
                layer.addChild(path.graphics);
                this.requestThumbnailUpdate(layerIndex);
                this.eventBus.emit('layer:path-added', { layerIndex, pathId: path.id });
            }
        }

        moveLayer(layerId, delta) {
            // レイヤーの並び替え処理
            const layerIndex = this.layers.findIndex(layer => layer.layerData.id === layerId);
            if (layerIndex === -1) return;
            
            const newIndex = Math.max(0, Math.min(this.layers.length - 1, layerIndex + delta.index));
            if (newIndex === layerIndex) return;
            
            const layer = this.layers.splice(layerIndex, 1)[0];
            this.layers.splice(newIndex, 0, layer);
            
            // PixiJS コンテナでも並び替え
            this.layersContainer.removeChild(layer);
            this.layersContainer.addChildAt(layer, newIndex);
            
            // アクティブレイヤーインデックス調整
            if (this.activeLayerIndex === layerIndex) {
                this.activeLayerIndex = newIndex;
            } else if (layerIndex < this.activeLayerIndex && newIndex >= this.activeLayerIndex) {
                this.activeLayerIndex--;
            } else if (layerIndex > this.activeLayerIndex && newIndex <= this.activeLayerIndex) {
                this.activeLayerIndex++;
            }
            
            this.updateLayerPanelUI();
            this.eventBus.emit('layer:moved', { layerId, oldIndex: layerIndex, newIndex });
        }

        rotateLayer(layerId, degrees) {
            const layer = this.layers.find(layer => layer.layerData.id === layerId);
            if (!layer) return;
            
            if (!this.layerTransforms.has(layerId)) {
                this.layerTransforms.set(layerId, {
                    x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1
                });
            }
            
            const transform = this.layerTransforms.get(layerId);
            transform.rotation += (degrees * Math.PI) / 180;
            
            const centerX = this.config.canvas.width / 2;
            const centerY = this.config.canvas.height / 2;
            layer.pivot.set(centerX, centerY);
            layer.position.set(centerX + transform.x, centerY + transform.y);
            layer.rotation = transform.rotation;
            
            const layerIndex = this.layers.indexOf(layer);
            this.requestThumbnailUpdate(layerIndex);
            this.eventBus.emit('layer:rotated', { layerId, degrees });
        }

        setVisibility(layerId, visible) {
            const layer = this.layers.find(layer => layer.layerData.id === layerId);
            if (!layer) return;
            
            layer.layerData.visible = visible;
            layer.visible = visible;
            
            this.updateLayerPanelUI();
            this.eventBus.emit('layer:visibility-changed', { layerId, visible });
        }

        deleteLayer(layerIndex) {
            if (this.layers.length <= 1) return;
            if (layerIndex < 0 || layerIndex >= this.layers.length) return;

            const layer = this.layers[layerIndex];
            const layerId = layer.layerData.id;
            
            // パスのGraphicsを削除
            layer.layerData.paths.forEach(path => {
                if (path.graphics && path.graphics.destroy) {
                    path.graphics.destroy();
                }
            });

            // 変形データも削除
            this.layerTransforms.delete(layerId);

            this.layersContainer.removeChild(layer);
            layer.destroy();
            this.layers.splice(layerIndex, 1);

            // アクティブレイヤーインデックス調整
            if (this.activeLayerIndex === layerIndex) {
                this.activeLayerIndex = Math.min(this.activeLayerIndex, this.layers.length - 1);
            } else if (this.activeLayerIndex > layerIndex) {
                this.activeLayerIndex--;
            }

            this.updateLayerPanelUI();
            this.updateStatusDisplay();
            this.eventBus.emit('layer:deleted', { layerId, index: layerIndex });
        }

        toggleLayerVisibility(layerIndex) {
            if (layerIndex >= 0 && layerIndex < this.layers.length) {
                const layer = this.layers[layerIndex];
                layer.layerData.visible = !layer.layerData.visible;
                layer.visible = layer.layerData.visible;
                this.updateLayerPanelUI();
                this.eventBus.emit('layer:visibility-toggled', { 
                    layerId: layer.layerData.id, 
                    visible: layer.layerData.visible 
                });
            }
        }

        requestThumbnailUpdate(layerIndex) {
            this.thumbnailUpdateQueue.add(layerIndex);
        }

        processThumbnailUpdates() {
            if (!this.app?.renderer || this.thumbnailUpdateQueue.size === 0) return;

            this.thumbnailUpdateQueue.forEach(layerIndex => {
                this.updateThumbnail(layerIndex);
            });
            this.thumbnailUpdateQueue.clear();
        }

        // レイヤー変形を考慮したサムネイル生成
        updateThumbnail(layerIndex) {
            if (!this.app?.renderer || layerIndex < 0 || layerIndex >= this.layers.length) return;

            const layer = this.layers[layerIndex];
            const layerItems = document.querySelectorAll('.layer-item');
            const panelIndex = this.layers.length - 1 - layerIndex;
            
            if (panelIndex < 0 || panelIndex >= layerItems.length) return;
            
            const thumbnail = layerItems[panelIndex].querySelector('.layer-thumbnail');
            if (!thumbnail) return;

            try {
                // 完全アスペクト比対応版
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
                
                // レンダリング用の高解像度テクスチャ作成
                const renderScale = this.config.thumbnail?.RENDER_SCALE || 2;
                const renderTexture = PIXI.RenderTexture.create({
                    width: this.config.canvas.width * renderScale,
                    height: this.config.canvas.height * renderScale,
                    resolution: renderScale
                });
                
                // レイヤーの現在の変形状態を保持してサムネイル生成
                const layerId = layer.layerData.id;
                
                // 一時的なコンテナを作成してレイヤーをコピー
                const tempContainer = new PIXI.Container();
                
                // レイヤーの現在の変形状態を保存
                const originalPos = { x: layer.position.x, y: layer.position.y };
                const originalScale = { x: layer.scale.x, y: layer.scale.y };
                const originalRotation = layer.rotation;
                const originalPivot = { x: layer.pivot.x, y: layer.pivot.y };
                
                // サムネイル用の変形をリセット
                layer.position.set(0, 0);
                layer.scale.set(1, 1);
                layer.rotation = 0;
                layer.pivot.set(0, 0);
                
                tempContainer.addChild(layer);
                tempContainer.scale.set(renderScale);
                
                // レンダリング実行
                this.app.renderer.render(tempContainer, { renderTexture });
                
                // レイヤーの変形状態を復元
                layer.position.set(originalPos.x, originalPos.y);
                layer.scale.set(originalScale.x, originalScale.y);
                layer.rotation = originalRotation;
                layer.pivot.set(originalPivot.x, originalPivot.y);
                
                // レイヤーを元のコンテナに戻す
                tempContainer.removeChild(layer);
                this.layersContainer.addChildAt(layer, layerIndex);
                
                // Canvas APIで高品質ダウンスケール
                const sourceCanvas = this.app.renderer.extract.canvas(renderTexture);
                const targetCanvas = document.createElement('canvas');
                targetCanvas.width = Math.round(thumbnailWidth);
                targetCanvas.height = Math.round(thumbnailHeight);
                
                const ctx = targetCanvas.getContext('2d');
                ctx.imageSmoothingEnabled = true;
                ctx.imageSmoothingQuality = this.config.thumbnail?.QUALITY || 'high';
                ctx.drawImage(sourceCanvas, 0, 0, Math.round(thumbnailWidth), Math.round(thumbnailHeight));
                
                // UI更新
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
                
                // リソース解放
                renderTexture.destroy();
                tempContainer.destroy();
                
            } catch (error) {
                console.warn('Thumbnail update failed:', error);
            }
        }

        updateLayerPanelUI() {
            const layerList = document.getElementById('layer-list');
            if (!layerList) return;

            layerList.innerHTML = '';

            for (let i = this.layers.length - 1; i >= 0; i--) {
                const layer = this.layers[i];
                const layerItem = document.createElement('div');
                layerItem.className = `layer-item ${i === this.activeLayerIndex ? 'active' : ''}`;
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
                    <div class="layer-opacity">100%</div>
                    <div class="layer-name">${layer.layerData.name}</div>
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
            
            // 全レイヤーのサムネイル更新をリクエスト
            for (let i = 0; i < this.layers.length; i++) {
                this.requestThumbnailUpdate(i);
            }
        }

        updateStatusDisplay() {
            const statusElement = document.getElementById('current-layer');
            if (statusElement && this.activeLayerIndex >= 0) {
                const layer = this.layers[this.activeLayerIndex];
                statusElement.textContent = layer.layerData.name;
            }
        }

        // レイヤーリサイズ処理（背景レイヤー用）
        resizeLayers(newWidth, newHeight) {
            this.layers.forEach(layer => {
                if (layer.layerData.isBackground && layer.layerData.backgroundGraphics) {
                    layer.layerData.backgroundGraphics.clear();
                    layer.layerData.backgroundGraphics.rect(0, 0, newWidth, newHeight);
                    layer.layerData.backgroundGraphics.fill(this.config.background.color);
                }
            });
            
            // 全レイヤーのサムネイル更新
            for (let i = 0; i < this.layers.length; i++) {
                this.requestThumbnailUpdate(i);
            }
        }

        // 内部参照設定
        setCameraSystem(cameraSystem) {
            this.cameraSystem = cameraSystem;
        }
    }

    // グローバル公開
    window.TegakiLayerSystem = LayerSystem;

})();形データを取得または初期化
            if (!this.layerTransforms.has(layerId)) {
                this.layerTransforms.set(layerId, {
                    x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1
                });
            }
            
            const transform = this.layerTransforms.get(layerId);
            
            // カメラフレーム中央を基準点として設定
            const centerX = this.config.canvas.width / 2;
            const centerY = this.config.canvas.height / 2;
            
            switch(property) {
                case 'x':
                    transform.x = value;
                    activeLayer.position.set(centerX + value, centerY + transform.y);
                    break;
                case 'y':
                    transform.y = value;
                    activeLayer.position.set(centerX + transform.x, centerY + value);
                    break;
                case 'rotation':
                    transform.rotation = value;
                    activeLayer.pivot.set(centerX, centerY);
                    activeLayer.position.set(centerX + transform.x, centerY + transform.y);
                    activeLayer.rotation = value;
                    break;
                case 'scale':
                    const hFlipped = transform.scaleX < 0;
                    const vFlipped = transform.scaleY < 0;
                    transform.scaleX = hFlipped ? -value : value;
                    transform.scaleY = vFlipped ? -value : value;
                    
                    activeLayer.pivot.set(centerX, centerY);
                    activeLayer.position.set(centerX + transform.x, centerY + transform.y);
                    activeLayer.scale.set(transform.scaleX, transform.scaleY);
                    break;
            }
            
            this.requestThumbnailUpdate(this.activeLayerIndex);
            this.eventBus.emit('layer:updated', { layerId, transform });
        }

        // 反転時もカメラフレーム中央基準で座標を維持
        flipActiveLayer(direction) {
            const activeLayer = this.getActiveLayer();
            if (!activeLayer) return;
            
            const layerId = activeLayer.layerData.id;
            
            if (!this.layerTransforms.has(layerId)) {
                this.layerTransforms.set(layerId, {
                    x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1
                });
            }
            
            const transform = this.layerTransforms.get(layerId);
            
            // カメラフレーム中央を動的に計算して基準点に設定
            const centerX = this.config.canvas.width / 2;
            const centerY = this.config.canvas.height / 2;
            
            activeLayer.pivot.set(centerX, centerY);
            activeLayer.position.set(centerX + transform.x, centerY + transform.y);
            
            if (direction === 'horizontal') {
                transform.scaleX *= -1;
                activeLayer.scale.x = transform.scaleX;
            } else if (direction === 'vertical') {
                transform.scaleY *= -1;
                activeLayer.scale.y = transform.scaleY;
            }
            
            this._updateFlipButtons();
            this.requestThumbnailUpdate(this.activeLayerIndex);
            this.eventBus.emit('layer:flipped', { layerId, direction });
        }

        _updateFlipButtons() {
            const activeLayer = this.getActiveLayer();
            if (!activeLayer) return;
            
            const flipHorizontalBtn = document.getElementById('flip-horizontal-btn');
            const flipVerticalBtn = document.getElementById('flip-vertical-btn');
            
            if (flipHorizontalBtn) {
                if (activeLayer.scale.x < 0) {
                    flipHorizontalBtn.classList.add('active');
                } else {
                    flipHorizontalBtn.classList.remove('active');
                }
            }
            
            if (flipVerticalBtn) {
                if (activeLayer.scale.y < 0) {
                    flipVerticalBtn.classList.add('active');
                } else {
                    flipVerticalBtn.classList.remove('active');
                }
            }
        }

        // 変形データから現在値を取得してスライダー更新
        updateLayerTransformPanelValues() {
            const activeLayer = this.getActiveLayer();
            if (!activeLayer) return;
            
            const layerId = activeLayer.layerData.id;
            const transform = this.layerTransforms.get(layerId) || {
                x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1
            };
            
            // X位置スライダー更新
            const xSlider = document.getElementById('layer-x-slider');
            if (xSlider && xSlider.updateValue) {
                xSlider.updateValue(transform.x);
            }
            
            // Y位置スライダー更新
            const ySlider = document.getElementById('layer-y-slider');
            if (ySlider && ySlider.updateValue) {
                ySlider.updateValue(transform.y);
            }
            
            // 回転スライダー更新
            const rotationSlider = document.getElementById('layer-rotation-slider');
            if (rotationSlider && rotationSlider.updateValue) {
                rotationSlider.updateValue(transform.rotation * 180 / Math.PI);
            }
            
            // 拡縮スライダー更新
            const scaleSlider = document.getElementById('layer-scale-slider');
            if (scaleSlider && scaleSlider.updateValue) {
                scaleSlider.updateValue(Math.abs(transform.scaleX));
            }
            
            this._updateFlipButtons();
        }

        // Vキートグル方式でのレイヤー移動モード
        toggleLayerMoveMode() {
            if (this.isLayerMoveMode) {
                this.exitLayerMoveMode();
            } else {
                this.enterLayerMoveMode();
            }
        }

        enterLayerMoveMode() {
            if (this.isLayerMoveMode) return;
            
            this.isLayerMoveMode = true;
            this.vKeyPressed = true;
            
            // CameraSystemに通知
            if (this.cameraSystem) {
                this.cameraSystem.setVKeyPressed(true);
            }
            
            // パネルとガイドライン表示
            if (this.layerTransformPanel) {
                this.layerTransformPanel.classList.add('show');
                this.updateLayerTransformPanelValues();
            }
            
            // ガイドライン表示
            if (this.cameraSystem) {
                this.cameraSystem.showGuideLines();
            }
            
            this._updateCursor();
            this.eventBus.emit('layer:move-mode-entered');
        }

        exitLayerMoveMode() {
            if (!this.isLayerMoveMode) return;
            
            this.isLayerMoveMode = false;
            this.vKeyPressed = false;
            this.isLayerDragging = false;
            
            // CameraSystemに通知
            if (this.cameraSystem) {
                this.cameraSystem.setVKeyPressed(false);
            }
            
            // パネルとガイドライン非表示
            if (this.layerTransformPanel) {
                this.layerTransformPanel.classList.remove('show');
            }
            
            // ガイドライン非表示
            if (this.cameraSystem) {
                this.cameraSystem.hideGuideLines();
            }
            
            this._updateCursor();
            
            // V解除時に自動確定（レイヤー変形をベイク）
            this.confirmLayerTransform();
            this.eventBus.emit('layer:move-mode-exited');
        }

        // 非破壊的レイヤー変形確定処理
        confirmLayerTransform() {
            const activeLayer = this.getActiveLayer();
            if (!activeLayer) return;
            
            const layerId = activeLayer.layerData.id;
            const transform = this.layerTransforms.get(layerId);
            
            // レイヤーのtransformが初期状態でない場合、パスデータに変形を適用
            if (this._isTransformNonDefault(transform)) {
                try {
                    const success = this._safeApplyTransformToPaths(activeLayer, transform);
                    
                    if (success) {
                        // 表示transformをリセット（視覚的変化なし）
                        activeLayer.position.set(0, 0);
                        activeLayer.rotation = 0;
                        activeLayer.scale.set(1, 1);
                        activeLayer.pivot.set(0, 0);
                        
                        // 変形データをクリア（確定完了）
                        this.layerTransforms.set(layerId, {
                            x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1
                        });
                        
                        // 反転ボタンもリセット
                        this._updateFlipButtons();
                        
                        // サムネイル更新
                        this.requestThumbnailUpdate(this.activeLayerIndex);
                        
                        this.eventBus.emit('layer:transform-confirmed', { layerId });
                    }
                    
                } catch (error) {
                    console.error('Critical error in confirmLayerTransform:', error);
                }
            }
        }

        // 安全なパス変形適用処理
        _safeApplyTransformToPaths(layer, transform) {
            if (!layer.layerData?.paths || layer.layerData.paths.length === 0) {
                return true;
            }
            
            try {
                const centerX = this.config.canvas.width / 2;
                const centerY = this.config.canvas.height / 2;
                
                // 変形行列作成
                const matrix = this._createTransformMatrix(transform, centerX, centerY);
                
                // パスごとに安全に処理
                const transformedPaths = [];
                let successCount = 0;
                
                for (let i = 0; i < layer.layerData.paths.length; i++) {
                    const path = layer.layerData.paths[i];
                    
                    try {
                        if (!path || !Array.isArray(path.points) || path.points.length === 0) {
                            continue;
                        }
                        
                        // 座標変形
                        const transformedPoints = this._safeTransformPoints(path.points, matrix);
                        
                        if (transformedPoints.length === 0) {
                            continue;
                        }
                        
                        // 新しいパスオブジェクト作成
                        const transformedPath = {
                            id: path.id,
                            points: transformedPoints,
                            color: path.color,
                            size: path.size,
                            opacity: path.opacity,
                            isComplete: path.isComplete || true,
                            graphics: null
                        };
                        
                        transformedPaths.push(transformedPath);
                        successCount++;
                        
                    } catch (pathError) {
                        console.error(`Error processing path ${i}:`, pathError);
                    }
                }
                
                if (successCount === 0) {
                    console.error('No paths could be transformed');
                    return false;
                }
                
                // レイヤー再構築
                const rebuildSuccess = this._safeRebuildLayer(layer, transformedPaths);
                
                return rebuildSuccess;
                
            } catch (error) {
                console.error('Critical error in _safeApplyTransformToPaths:', error);
                return false;
            }
        }

        // 精密変形行列作成
        _createTransformMatrix(transform, centerX, centerY) {
            const matrix = new PIXI.Matrix();
            
            matrix.translate(centerX + transform.x, centerY + transform.y);
            matrix.rotate(transform.rotation);
            matrix.scale(transform.scaleX, transform.scaleY);
            matrix.translate(-centerX, -centerY);
            
            return matrix;
        }

        // 安全な座標変形処理
        _safeTransformPoints(points, matrix) {
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
                    console.warn(`Point transform failed for index ${i}:`, transformError);
                }
            }
            
            return transformedPoints;
        }

        // 安全なレイヤー再構築
        _safeRebuildLayer(layer, newPaths) {
            try {
                // 既存描画要素の安全な削除（背景は保護）
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
                        console.warn('Failed to remove child:', removeError);
                    }
                });
                
                // 新しいパスデータを設定
                layer.layerData.paths = [];
                
                // パスごとにGraphicsを再生成・追加
                let addedCount = 0;
                for (let i = 0; i < newPaths.length; i++) {
                    const path = newPaths[i];
                    
                    try {
                        // Graphics再生成
                        const rebuildSuccess = this._rebuildPathGraphics(path);
                        
                        if (rebuildSuccess && path.graphics) {
                            layer.layerData.paths.push(path);
                            layer.addChild(path.graphics);
                            addedCount++;
                        }
                        
                    } catch (pathError) {
                        console.error(`Error adding path ${i}:`, pathError);
                    }
                }
                
                const success = addedCount > 0 || newPaths.length === 0;
                
                return success;
                
            } catch (error) {
                console.error('Critical error in _safeRebuildLayer:', error);
                return false;
            }
        }

        // パスGraphics再生成（安全版）
        _rebuildPathGraphics(path) {
            try {
                // 既存Graphics削除
                if (path.graphics) {
                    try {
                        if (path.graphics.destroy && typeof path.graphics.destroy === 'function') {
                            path.graphics.destroy();
                        }
                    } catch (destroyError) {
                        console.warn('Graphics destroy failed:', destroyError);
                    }
                    path.graphics = null;
                }
                
                // 新しいGraphics作成
                path.graphics = new PIXI.Graphics();
                
                // パスの点から描画を再構築
                if (path.points && Array.isArray(path.points) && path.points.length > 0) {
                    for (let point of path.points) {
                        if (typeof point.x === 'number' && typeof point.y === 'number' &&
                            isFinite(point.x) && isFinite(point.y)) {
                            
                            path.graphics.circle(point.x, point.y, (path.size || 16) / 2);
                            path.graphics.fill({ 
                                color: path.color || 0x800000, 
                                alpha: path.opacity || 1.0 
                            });
                        }
                    }
                }
                
                return true;
                
            } catch (error) {
                console.error('Error in _rebuildPathGraphics:', error);
                path.graphics = null;
                return false;
            }
        }

        // 変形が初期状態以外かチェック
        _isTransformNonDefault(transform) {
            if (!transform) return false;
            return (transform.x !== 0 || transform.y !== 0 || 
                    transform.rotation !== 0 || Math.abs(transform.scaleX) !== 1 || Math.abs(transform.scaleY) !== 1);
        }

        _setupLayerOperations() {
            document.addEventListener('keydown', (e) => {
                // Vキートグル方式
                if (e.code === 'KeyV' && !e.ctrlKey && !e.altKey && !e.metaKey) {
                    this.toggleLayerMoveMode();
                    e.preventDefault();
                }
                
                // Pキー: ペンツール（レイヤー移動モード終了）
                if (e.code === 'KeyP' && !e.ctrlKey && !e.altKey && !e.metaKey) {
                    if (this.isLayerMoveMode) {
                        this.exitLayerMoveMode();
                    }
                    e.preventDefault();
                }
                
                // Eキー: 消しゴムツール（レイヤー移動モード終了）
                if (e.code === 'KeyE' && !e.ctrlKey && !e.altKey && !e.metaKey) {
                    if (this.isLayerMoveMode) {
                        this.exitLayerMoveMode();
                    }
                    e.preventDefault();
                }
                
                // V + 方向キー: アクティブレイヤー移動
                if (this.vKeyPressed && !e.shiftKey && ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) {
                    this._moveActiveLayer(e.code);
                    e.preventDefault();
                }
                
                // V + Shift + 方向キー: アクティブレイヤー拡縮・回転
                if (this.vKeyPressed && e.shiftKey && ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) {
                    this._transformActiveLayer(e.code);
                    e.preventDefault();
                }
                
                // V + H / V + Shift + H: アクティブレイヤー反転
                if (this.vKeyPressed && e.code === 'KeyH' && !e.ctrlKey && !e.altKey && !e.metaKey) {
                    if (e.shiftKey) {
                        this.flipActiveLayer('vertical');
                    } else {
                        this.flipActiveLayer('horizontal');
                    }
                    e.preventDefault();
                }
            });
            
            // V + ドラッグ: アクティブレイヤー移動・変形
            this._setupLayerDragEvents();
        }

        _setupLayerDragEvents() {
            if (!this.app?.stage?.canvas) return;

            this.app.stage.canvas.addEventListener('pointerdown', (e) => {
                if (this.vKeyPressed && e.button === 0) {
                    this.isLayerDragging = true;
                    this.layerDragLastPoint = { x: e.clientX, y: e.clientY };
                    this.app.stage.canvas.style.cursor = 'move';
                    e.preventDefault();
                }
            });
            
            this.app.stage.canvas.addEventListener('pointermove', (e) => {
                if (this.isLayerDragging && this.vKeyPressed) {
                    this._handleLayerDrag(e);
                }
            });
            
            this.app.stage.canvas.addEventListener('pointerup', (e) => {
                if (this.isLayerDragging) {
                    this.isLayerDragging = false;
                    this._updateCursor();
                }
            });
        }

        _handleLayerDrag(e) {
            const activeLayer = this.getActiveLayer();
            if (!activeLayer) return;

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
            
            if (e.shiftKey) {
                this._handleLayerTransformDrag(activeLayer, transform, dx, dy);
            } else {
                this._handleLayerMoveDrag(activeLayer, transform, adjustedDx, adjustedDy);
            }
            
            this.layerDragLastPoint = { x: e.clientX, y: e.clientY };
            this.requestThumbnailUpdate(this.activeLayerIndex);
        }

        _handleLayerTransformDrag(activeLayer, transform, dx, dy) {
            const centerX = this.config.canvas.width / 2;
            const centerY = this.config.canvas.height / 2;
            
            activeLayer.pivot.set(centerX, centerY);
            activeLayer.position.set(centerX + transform.x, centerY + transform.y);
            
            if (Math.abs(dy) > Math.abs(dx)) {
                // 垂直方向優先: 拡縮（上ドラッグ→拡大、下ドラッグ→縮小）
                const scaleFactor = 1 + (dy * -0.01);
                const currentScale = Math.abs(transform.scaleX);
                const newScale = Math.max(this.config.layer.minScale, Math.min(this.config.layer.maxScale, currentScale * scaleFactor));
                
                transform.scaleX = transform.scaleX < 0 ? -newScale : newScale;
                transform.scaleY = transform.scaleY < 0 ? -newScale : newScale;
                activeLayer.scale.set(transform.scaleX, transform.scaleY);
                
                const scaleSlider = document.getElementById('layer-scale-slider');
                if (scaleSlider && scaleSlider.updateValue) {
                    scaleSlider.updateValue(newScale);
                }
            } else {
                // 水平方向優先: 回転（右ドラッグ→右回転、左ドラッグ→左回転）
                transform.rotation += (dx * 0.02);
                activeLayer.rotation = transform.rotation;
                
                const rotationSlider = document.getElementById('layer-rotation-slider');
                if (rotationSlider && rotationSlider.updateValue) {
                    rotationSlider.updateValue(transform.rotation * 180 / Math.PI);
                }
            }
        }

        _handleLayerMoveDrag(activeLayer, transform, adjustedDx, adjustedDy) {
            // V + ドラッグ: 移動（座標累積）
            transform.x += adjustedDx;
            transform.y += adjustedDy;
            
            const centerX = this.config.canvas.width / 2;
            const centerY = this.config.canvas.height / 2;
            activeLayer.position.set(centerX + transform.x, centerY + transform.y);
            
            const xSlider = document.getElementById('layer-x-slider');
            const ySlider = document.getElementById('layer-y-slider');
            if (xSlider && xSlider.updateValue) {
                xSlider.updateValue(transform.x);
            }
            if (ySlider && ySlider.updateValue) {
                ySlider.updateValue(transform.y);
            }
        }

        // キーボードによる移動（座標累積）
        _moveActiveLayer(keyCode) {
            const activeLayer = this.getActiveLayer();
            if (!activeLayer) return;
            
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
            activeLayer.position.set(centerX + transform.x, centerY + transform.y);
            
            const xSlider = document.getElementById('layer-x-slider');
            const ySlider = document.getElementById('layer-y-slider');
            if (xSlider && xSlider.updateValue) {
                xSlider.updateValue(transform.x);
            }
            if (ySlider && ySlider.updateValue) {
                ySlider.updateValue(transform.y);
            }
            
            this.requestThumbnailUpdate(this.activeLayerIndex);
        }

        // キーボードによる変形
        _transformActiveLayer(keyCode) {
            const activeLayer = this.getActiveLayer();
            if (!activeLayer) return;
            
            const layerId = activeLayer.layerData.id;
            
            if (!this.layerTransforms.has(layerId)) {
                this.layerTransforms.set(layerId, {
                    x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1
                });
            }
            
            const transform = this.layerTransforms.get(layerId);
            
            const centerX = this.config.canvas.width / 2;
            const centerY = this.config.canvas.height / 2;
            
            activeLayer.pivot.set(centerX, centerY);
            activeLayer.position.set(centerX + transform.x, centerY + transform.y);
            
            switch(keyCode) {
                case 'ArrowUp': // 拡大
                    this._scaleActiveLayer(1.1, transform, activeLayer);
                    break;
                case 'ArrowDown': // 縮小
                    this._scaleActiveLayer(0.9, transform, activeLayer);
                    break;
                case 'ArrowLeft': // 左回転
                    this._rotateActiveLayer(-15, transform, activeLayer);
                    break;
                case 'ArrowRight': // 右回転
                    this._rotateActiveLayer(15, transform, activeLayer);
                    break;
            }
            
            this.requestThumbnailUpdate(this.activeLayerIndex);
        }

        _scaleActiveLayer(scaleFactor, transform, activeLayer) {
            const currentScale = Math.abs(transform.scaleX);
            const newScale = Math.max(this.config.layer.minScale, Math.min(this.config.layer.maxScale, currentScale * scaleFactor));
            transform.scaleX = transform.scaleX < 0 ? -newScale : newScale;
            transform.scaleY = transform.scaleY < 0 ? -newScale : newScale;
            activeLayer.scale.set(transform.scaleX, transform.scaleY);
            
            const scaleSlider = document.getElementById('layer-scale-slider');
            if (scaleSlider && scaleSlider.updateValue) {
                scaleSlider.updateValue(newScale);
            }
        }

        _rotateActiveLayer(degrees, transform, activeLayer) {
            transform.rotation += (degrees * Math.PI) / 180;
            activeLayer.rotation = transform.rotation;
            
            const rotationSlider = document.getElementById('layer-rotation-slider');
            if (rotationSlider && rotationSlider.updateValue) {
                rotationSlider.updateValue(transform.rotation * 180 / Math.PI);
            }
        }

        _updateCursor() {
            if (this.vKeyPressed && this.app?.stage?.canvas) {
                this.app.stage.canvas.style.cursor = 'grab';
            }
        }

        // === 公開API ===
        createLayer(name, isBackground = false) {
            const layer = new PIXI.Container();
            const layerId = `layer_${this.layerCounter++}`;
            
            layer.label = layerId;
            layer.layerData = {
                id: layerId,
                name: name,
                visible: true,
                opacity: 1.0,
                isBackground: isBackground,
                paths: []
            };

            // 変