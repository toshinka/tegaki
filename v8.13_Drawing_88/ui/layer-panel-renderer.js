// ui/layer-panel-renderer.js - Phase 6完全改修版

(function() {
    'use strict';

    class LayerPanelRenderer {
        constructor(container, layerSystem, eventBus) {
            this.container = container;
            this.layerSystem = layerSystem;
            this.eventBus = eventBus;
            this.sortable = null;
            this.debugEnabled = false;

            this._setupEventListeners();
        }

        _setupEventListeners() {
            if (!this.eventBus) return;

            this.eventBus.on('layer:created', () => this.requestUpdate());
            this.eventBus.on('layer:deleted', () => this.requestUpdate());
            this.eventBus.on('layer:activated', () => this.requestUpdate());
            this.eventBus.on('layer:visibility-changed', () => this.requestUpdate());
            this.eventBus.on('layer:opacity-changed', () => this.requestUpdate());
            this.eventBus.on('layer:background-color-changed', () => this.requestUpdate());
            this.eventBus.on('animation:frame-changed', () => this.requestUpdate());

            this.eventBus.on('ui:background-color-change-requested', ({ layerIndex, layerId }) => {
                if (this.layerSystem?.changeBackgroundLayerColor) {
                    this.layerSystem.changeBackgroundLayerColor(layerIndex, layerId);
                }
            });

            this.eventBus.on('ui:active-panel-changed', ({ activePanel }) => {
                this._updatePanelActiveState(activePanel === 'layer');
            });
        }

        requestUpdate() {
            if (this._updateTimeout) return;
            this._updateTimeout = setTimeout(() => {
                this._updateTimeout = null;
                const layers = this.layerSystem?.getLayers() || [];
                const activeIndex = this.layerSystem?.getActiveLayerIndex() || 0;
                const animationSystem = window.animationSystem || null;
                this.render(layers, activeIndex, animationSystem);
            }, 16);
        }

        render(layers, activeIndex, animationSystem = null) {
            if (!this.container) return;
            if (!layers || layers.length === 0) return;

            this.container.innerHTML = '';

            const reversedLayers = [...layers].reverse();
            const reversedActiveIndex = layers.length - 1 - activeIndex;

            reversedLayers.forEach((layer, reversedIndex) => {
                const originalIndex = layers.length - 1 - reversedIndex;
                const isActive = reversedIndex === reversedActiveIndex;
                const layerElement = this.createLayerElement(layer, originalIndex, isActive, animationSystem);
                this.container.appendChild(layerElement);
            });

            this.initializeSortable();
        }

        createLayerElement(layer, index, isActive, animationSystem) {
            const layerDiv = document.createElement('div');
            layerDiv.className = 'layer-item';
            if (isActive) {
                layerDiv.classList.add('active');
            }
            layerDiv.dataset.layerIndex = index;

            const isBackground = layer.layerData?.isBackground || false;
            
            layerDiv.style.backgroundColor = '#ffffee';
            layerDiv.style.opacity = '0.9';
            layerDiv.style.border = '1px solid #e9c2ba';
            layerDiv.style.borderRadius = '4px';
            layerDiv.style.padding = '6px 8px';
            layerDiv.style.marginBottom = '6px';
            layerDiv.style.cursor = isBackground ? 'default' : 'grab';
            layerDiv.style.display = 'grid';
            layerDiv.style.gridTemplateColumns = '24px 1fr 56px';
            layerDiv.style.gridTemplateRows = '18px 18px 18px';
            layerDiv.style.gap = '4px 6px';
            layerDiv.style.alignItems = 'center';

            if (isActive && !isBackground) {
                layerDiv.style.borderColor = 'var(--futaba-accent, #ff6600)';
                layerDiv.style.borderWidth = '2px';
                layerDiv.style.padding = '5px 7px';
            }

            // 1行目: 透明度 + 削除ボタン
            if (!isBackground) {
                const opacityContainer = document.createElement('div');
                opacityContainer.className = 'layer-opacity-control';
                opacityContainer.style.gridColumn = '1 / 3';
                opacityContainer.style.gridRow = '1';
                opacityContainer.style.display = 'flex';
                opacityContainer.style.alignItems = 'center';
                opacityContainer.style.gap = '4px';
                opacityContainer.style.fontSize = '12px';
                opacityContainer.style.userSelect = 'none';
                opacityContainer.style.justifyContent = 'flex-start';

                const decreaseBtn = document.createElement('button');
                decreaseBtn.textContent = '◀';
                decreaseBtn.style.padding = '0';
                decreaseBtn.style.fontSize = '10px';
                decreaseBtn.style.lineHeight = '1';
                decreaseBtn.style.cursor = 'pointer';
                decreaseBtn.style.border = 'none';
                decreaseBtn.style.backgroundColor = 'transparent';
                decreaseBtn.style.color = '#800000';
                decreaseBtn.title = '透明度 -10%';
                decreaseBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    this._adjustLayerOpacity(index, -0.1);
                });

                const opacityValue = document.createElement('span');
                opacityValue.className = 'layer-opacity-value';
                const currentOpacity = layer.alpha !== undefined ? layer.alpha : 1.0;
                opacityValue.textContent = `${Math.round(currentOpacity * 100)}%`;
                opacityValue.style.cursor = 'text';
                opacityValue.style.minWidth = '36px';
                opacityValue.style.textAlign = 'center';
                opacityValue.style.color = '#800000';
                opacityValue.style.fontSize = '12px';
                opacityValue.style.fontWeight = 'bold';
                opacityValue.title = 'ダブルクリックで数値入力';
                this._setupOpacityInput(opacityValue, index);

                const increaseBtn = document.createElement('button');
                increaseBtn.textContent = '▶';
                increaseBtn.style.padding = '0';
                increaseBtn.style.fontSize = '10px';
                increaseBtn.style.lineHeight = '1';
                increaseBtn.style.cursor = 'pointer';
                increaseBtn.style.border = 'none';
                increaseBtn.style.backgroundColor = 'transparent';
                increaseBtn.style.color = '#800000';
                increaseBtn.title = '透明度 +10%';
                increaseBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    this._adjustLayerOpacity(index, 0.1);
                });

                opacityContainer.appendChild(decreaseBtn);
                opacityContainer.appendChild(opacityValue);
                opacityContainer.appendChild(increaseBtn);
                layerDiv.appendChild(opacityContainer);

                const deleteBtn = document.createElement('button');
                deleteBtn.className = 'layer-delete-button';
                deleteBtn.style.gridColumn = '3';
                deleteBtn.style.gridRow = '1';
                deleteBtn.style.padding = '0';
                deleteBtn.style.width = '20px';
                deleteBtn.style.height = '20px';
                deleteBtn.style.display = 'flex';
                deleteBtn.style.alignItems = 'center';
                deleteBtn.style.justifyContent = 'center';
                deleteBtn.style.cursor = 'pointer';
                deleteBtn.style.border = '2px solid #800000';
                deleteBtn.style.borderRadius = '50%';
                deleteBtn.style.backgroundColor = 'transparent';
                deleteBtn.style.transition = 'background-color 0.2s, transform 0.1s';
                deleteBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#ffffee" stroke-width="3">
                    <path d="m18 6-12 12"/><path d="m6 6 12 12"/>
                </svg>`;
                deleteBtn.title = 'レイヤーを削除';
                
                deleteBtn.addEventListener('mouseenter', function() {
                    this.style.backgroundColor = '#800000';
                    this.style.transform = 'scale(1.1)';
                });
                
                deleteBtn.addEventListener('mouseleave', function() {
                    this.style.backgroundColor = 'transparent';
                    this.style.transform = 'scale(1)';
                });
                
                deleteBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    if (this.layerSystem?.deleteLayer) {
                        this.layerSystem.deleteLayer(index);
                    }
                });
                
                layerDiv.appendChild(deleteBtn);
            }

            // 2行目: 目アイコン + バケツ（背景のみ）+ サムネイル開始
            const visibilityIcon = document.createElement('div');
            visibilityIcon.className = 'layer-visibility';
            visibilityIcon.style.gridColumn = '1';
            visibilityIcon.style.gridRow = '2';
            visibilityIcon.style.cursor = 'pointer';
            visibilityIcon.style.width = '24px';
            visibilityIcon.style.height = '18px';
            visibilityIcon.style.display = 'flex';
            visibilityIcon.style.alignItems = 'center';
            visibilityIcon.style.justifyContent = 'center';
            
            const isVisible = layer.layerData?.visible !== false;
            visibilityIcon.innerHTML = isVisible ? 
                `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#800000" stroke-width="2">
                    <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/>
                </svg>` :
                `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#800000" stroke-width="2">
                    <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/>
                    <path d="m2 2 20 20"/>
                </svg>`;
            
            visibilityIcon.addEventListener('click', (e) => {
                e.stopPropagation();
                if (this.layerSystem?.toggleLayerVisibility) {
                    this.layerSystem.toggleLayerVisibility(index);
                }
            });
            layerDiv.appendChild(visibilityIcon);

            if (isBackground) {
                const bucketIcon = document.createElement('div');
                bucketIcon.className = 'layer-background-color-button';
                bucketIcon.style.gridColumn = '2';
                bucketIcon.style.gridRow = '2';
                bucketIcon.style.cursor = 'pointer';
                bucketIcon.style.width = '24px';
                bucketIcon.style.height = '18px';
                bucketIcon.style.display = 'flex';
                bucketIcon.style.alignItems = 'center';
                bucketIcon.style.justifyContent = 'flex-start';
                bucketIcon.innerHTML = `
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" 
                         viewBox="0 0 24 24" fill="none" stroke="#800000" 
                         stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="m19 11-8-8-8.6 8.6a2 2 0 0 0 0 2.8l5.2 5.2c.8.8 2 .8 2.8 0L19 11Z"/>
                        <path d="m5 2 5 5"/>
                        <path d="M2 13h15"/>
                        <path d="M22 20a2 2 0 1 1-4 0c0-1.6 1.7-2.4 2-4 .3 1.6 2 2.4 2 4Z"/>
                    </svg>
                `;
                bucketIcon.title = '背景色を現在のペンカラーに変更';
                bucketIcon.addEventListener('click', (e) => {
                    e.stopPropagation();
                    if (this.eventBus) {
                        this.eventBus.emit('ui:background-color-change-requested', {
                            layerIndex: index,
                            layerId: layer.layerData?.id
                        });
                    }
                });
                layerDiv.appendChild(bucketIcon);
            }

            // サムネイル（2-3行目、中央配置）
            const thumbnail = this.createThumbnail(layer, index);
            thumbnail.style.gridColumn = '3';
            thumbnail.style.gridRow = '2 / 4';
            thumbnail.style.display = 'flex';
            thumbnail.style.alignItems = 'center';
            thumbnail.style.justifyContent = 'center';
            layerDiv.appendChild(thumbnail);

            // 3行目: レイヤー名
            const nameSpan = document.createElement('span');
            nameSpan.className = 'layer-name';
            nameSpan.textContent = layer.layerData?.name || `レイヤー${index}`;
            nameSpan.style.gridColumn = '1 / 3';
            nameSpan.style.gridRow = '3';
            nameSpan.style.color = '#800000';
            nameSpan.style.fontSize = '12px';
            nameSpan.style.fontWeight = 'bold';
            nameSpan.style.whiteSpace = 'nowrap';
            nameSpan.style.overflow = 'hidden';
            nameSpan.style.textOverflow = 'ellipsis';
            layerDiv.appendChild(nameSpan);

            // クリックイベント（背景レイヤーは選択不可）
            if (!isBackground) {
                layerDiv.addEventListener('click', (e) => {
                    if (window.stateManager) {
                        window.stateManager.setLastActivePanel('layer');
                    }

                    if (this.eventBus) {
                        this.eventBus.emit('ui:layer-selected', {
                            layerIndex: index,
                            layerId: layer.layerData?.id
                        });
                    }
                });
            }

            return layerDiv;
        }

        createThumbnail(layer, index) {
            const thumbnailContainer = document.createElement('div');
            thumbnailContainer.className = 'layer-thumbnail';
            
            const canvasAspectRatio = this.layerSystem.config.canvas.width / this.layerSystem.config.canvas.height;
            const maxSize = 56;
            let thumbnailWidth, thumbnailHeight;
            
            if (canvasAspectRatio >= 1) {
                thumbnailWidth = maxSize;
                thumbnailHeight = maxSize / canvasAspectRatio;
            } else {
                thumbnailWidth = maxSize * canvasAspectRatio;
                thumbnailHeight = maxSize;
            }
            
            thumbnailContainer.style.width = Math.round(thumbnailWidth) + 'px';
            thumbnailContainer.style.height = Math.round(thumbnailHeight) + 'px';
            thumbnailContainer.style.border = '1px solid #800000';
            thumbnailContainer.style.position = 'relative';
            thumbnailContainer.style.overflow = 'hidden';
            thumbnailContainer.style.borderRadius = '2px';

            const checkerPattern = this._createCheckerPattern(thumbnailWidth, thumbnailHeight);
            thumbnailContainer.appendChild(checkerPattern);

            if (window.ThumbnailSystem) {
                window.ThumbnailSystem.generateLayerThumbnail(layer, index)
                    .then(thumbnailData => {
                        if (thumbnailData && thumbnailData.dataUrl) {
                            const img = document.createElement('img');
                            img.src = thumbnailData.dataUrl;
                            img.style.position = 'absolute';
                            img.style.top = '0';
                            img.style.left = '0';
                            img.style.width = '100%';
                            img.style.height = '100%';
                            img.style.objectFit = 'contain';
                            thumbnailContainer.appendChild(img);
                        }
                    })
                    .catch(err => {
                        console.warn('Thumbnail generation failed:', err);
                    });
            }

            return thumbnailContainer;
        }

        _createCheckerPattern(width, height) {
            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            
            const squareSize = 4;
            const color1 = '#f0e0d6';
            const color2 = '#ffffee';
            
            for (let y = 0; y < height; y += squareSize) {
                for (let x = 0; x < width; x += squareSize) {
                    const isEvenX = Math.floor(x / squareSize) % 2 === 0;
                    const isEvenY = Math.floor(y / squareSize) % 2 === 0;
                    ctx.fillStyle = (isEvenX === isEvenY) ? color1 : color2;
                    ctx.fillRect(x, y, squareSize, squareSize);
                }
            }
            
            canvas.style.position = 'absolute';
            canvas.style.top = '0';
            canvas.style.left = '0';
            canvas.style.width = '100%';
            canvas.style.height = '100%';
            return canvas;
        }

        _setupOpacityInput(element, layerIndex) {
            let clickCount = 0;
            let clickTimer = null;

            element.addEventListener('click', (e) => {
                e.stopPropagation();
                clickCount++;
                
                if (clickTimer) {
                    clearTimeout(clickTimer);
                }

                if (clickCount === 2) {
                    clickCount = 0;
                    this._showOpacityInput(element, layerIndex);
                } else {
                    clickTimer = setTimeout(() => {
                        clickCount = 0;
                    }, 300);
                }
            });
        }

        _showOpacityInput(element, layerIndex) {
            const layer = this.layerSystem.getLayers()[layerIndex];
            const currentOpacity = layer.alpha !== undefined ? layer.alpha : 1.0;
            const currentValue = Math.round(currentOpacity * 100);

            const input = document.createElement('input');
            input.type = 'number';
            input.min = '0';
            input.max = '100';
            input.value = currentValue.toString();
            input.style.width = '36px';
            input.style.textAlign = 'center';
            input.style.fontSize = '12px';
            input.style.fontWeight = 'bold';
            input.style.color = '#800000';
            input.style.border = '1px solid #800000';
            input.style.borderRadius = '2px';
            input.style.backgroundColor = '#ffffee';
            input.style.padding = '0';

            const parent = element.parentNode;
            parent.replaceChild(input, element);
            input.focus();
            input.select();

            const finishEdit = () => {
                let value = parseInt(input.value, 10);
                if (isNaN(value)) value = currentValue;
                value = Math.max(0, Math.min(100, value));
                
                const newOpacity = value / 100;
                this._setLayerOpacity(layerIndex, newOpacity);

                element.textContent = `${value}%`;
                parent.replaceChild(element, input);
            };

            input.addEventListener('blur', finishEdit);
            input.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    finishEdit();
                } else if (e.key === 'Escape') {
                    e.preventDefault();
                    element.textContent = `${currentValue}%`;
                    parent.replaceChild(element, input);
                }
                e.stopPropagation();
            });
        }

        _adjustLayerOpacity(layerIndex, delta) {
            const layer = this.layerSystem.getLayers()[layerIndex];
            const currentOpacity = layer.alpha !== undefined ? layer.alpha : 1.0;
            const newOpacity = Math.max(0, Math.min(1, currentOpacity + delta));
            this._setLayerOpacity(layerIndex, newOpacity);
        }

        _setLayerOpacity(layerIndex, opacity) {
            if (this.layerSystem.setLayerOpacity) {
                this.layerSystem.setLayerOpacity(layerIndex, opacity);
            }

            const layers = this.layerSystem.getLayers();
            const reversedIndex = layers.length - 1 - layerIndex;
            const layerDiv = this.container.querySelectorAll('.layer-item')[reversedIndex];
            const opacityValue = layerDiv?.querySelector('.layer-opacity-value');
            if (opacityValue) {
                opacityValue.textContent = `${Math.round(opacity * 100)}%`;
            }
        }

        _updatePanelActiveState(isActive) {
            const activeLayer = this.container.querySelector('.layer-item.active');
            if (!activeLayer) return;

            if (isActive) {
                activeLayer.style.borderColor = 'var(--futaba-accent, #ff6600)';
            } else {
                activeLayer.style.borderColor = '#aa5a56';
            }
        }

        initializeSortable() {
            if (!window.Sortable) return;

            try {
                if (this.sortable) {
                    this.sortable.destroy();
                }

                this.sortable = window.Sortable.create(this.container, {
                    animation: 150,
                    ghostClass: 'sortable-ghost',
                    dragClass: 'sortable-drag',
                    chosenClass: 'sortable-chosen',
                    forceFallback: true,
                    fallbackOnBody: true,
                    swapThreshold: 0.65,

                    filter: (evt) => {
                        const item = evt.target.closest('.layer-item');
                        if (!item) return false;
                        const layerIndex = parseInt(item.dataset.layerIndex);
                        const layers = this.layerSystem?.getLayers() || [];
                        const layer = layers[layerIndex];
                        return layer?.layerData?.isBackground || false;
                    },

                    onChoose: (evt) => {
                        const item = evt.item;
                        const layerIndex = parseInt(item.dataset.layerIndex);
                        const layers = this.layerSystem?.getLayers() || [];
                        const layer = layers[layerIndex];
                        if (layer?.layerData?.isBackground) {
                            item.style.opacity = '1';
                        } else {
                            item.style.opacity = '0.5';
                        }
                    },

                    onStart: (evt) => {
                        const item = evt.item;
                        const layerIndex = parseInt(item.dataset.layerIndex);
                        const layers = this.layerSystem?.getLayers() || [];
                        const layer = layers[layerIndex];
                        if (!layer?.layerData?.isBackground) {
                            item.style.cursor = 'grabbing';
                        }
                    },

                    onEnd: (evt) => {
                        evt.item.style.opacity = '';
                        evt.item.style.cursor = '';

                        if (this.layerSystem?.reorderLayers) {
                            const layers = this.layerSystem.getLayers();
                            const oldIndex = layers.length - 1 - evt.oldIndex;
                            const newIndex = layers.length - 1 - evt.newIndex;
                            this.layerSystem.reorderLayers(oldIndex, newIndex);
                        }
                    }
                });
            } catch (error) {
                if (this.debugEnabled) {
                    console.warn('Sortable initialization failed:', error);
                }
            }
        }

        destroy() {
            if (this.sortable) {
                this.sortable.destroy();
                this.sortable = null;
            }
            if (this._updateTimeout) {
                clearTimeout(this._updateTimeout);
            }
        }
    }

    window.LayerPanelRenderer = LayerPanelRenderer;
})();