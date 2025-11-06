// ui/layer-panel-renderer.js - サムネイル位置安定化・名前編集修正版

(function() {
    'use strict';

    class LayerPanelRenderer {
        constructor(container, layerSystem, eventBus) {
            this.container = container;
            this.layerSystem = layerSystem;
            this.eventBus = eventBus;
            this.sortable = null;
            this._isInitialized = false;
            this._editingLayerIndex = -1;

            this._setupEventListeners();
            
            requestAnimationFrame(() => {
                this._initializeRender();
            });
        }

        _initializeRender() {
            if (this._isInitialized) return;
            
            const layers = this.layerSystem?.getLayers() || [];
            if (layers.length === 0) {
                setTimeout(() => this._initializeRender(), 50);
                return;
            }
            
            const activeIndex = this.layerSystem?.getActiveLayerIndex() || 0;
            const animationSystem = window.animationSystem || null;
            this.render(layers, activeIndex, animationSystem);
            this._isInitialized = true;
        }

        _setupEventListeners() {
            if (!this.eventBus) return;

            this.eventBus.on('layer:created', () => this.requestUpdate());
            this.eventBus.on('layer:deleted', () => this.requestUpdate());
            this.eventBus.on('layer:activated', () => this.requestUpdate());
            this.eventBus.on('layer:visibility-changed', () => this.requestUpdate());
            this.eventBus.on('layer:opacity-changed', () => this.requestUpdate());
            this.eventBus.on('layer:background-color-changed', () => this.requestUpdate());
            this.eventBus.on('layer:name-changed', () => this.requestUpdate());
            this.eventBus.on('animation:frame-changed', () => this.requestUpdate());
            
            this.eventBus.on('thumbnail:layer-updated', ({ data }) => {
                if (data && typeof data.layerIndex === 'number') {
                    this._updateSingleThumbnail(data.layerIndex);
                }
            });

            this.eventBus.on('ui:background-color-change-requested', ({ layerIndex, layerId }) => {
                if (this.layerSystem?.changeBackgroundLayerColor) {
                    this.layerSystem.changeBackgroundLayerColor(layerIndex, layerId);
                }
            });

            this.eventBus.on('ui:active-panel-changed', ({ activePanel }) => {
                this._updatePanelActiveState(activePanel === 'layer');
            });

            this.eventBus.on('ui:layer-selected', ({ layerIndex }) => {
                if (this.layerSystem?.setActiveLayer) {
                    this.layerSystem.setActiveLayer(layerIndex);
                }
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
            
            layerDiv.style.cssText = `
                width:170px;
                min-height:48px;
                background-color:#ffffee;
                opacity:0.9;
                border:1px solid #e9c2ba;
                border-radius:4px;
                padding:5px 7px;
                margin-bottom:4px;
                cursor:${isBackground ? 'default' : 'grab'};
                display:grid;
                grid-template-columns:18px 70px 74px;
                grid-template-rows:14px 14px 14px;
                gap:1px 4px;
                align-items:center;
                position:relative;
                backdrop-filter:blur(8px);
                transition:all 0.2s ease;
                touch-action:none;
                user-select:none;
            `;

            if (isActive) {
                layerDiv.style.borderColor = '#ff6600';
                layerDiv.style.borderWidth = '2px';
                layerDiv.style.padding = '4px 6px';
            }

            // 1行目: ◀100%▶（通常レイヤーのみ）
            if (!isBackground) {
                const opacityContainer = document.createElement('div');
                opacityContainer.className = 'layer-opacity-control';
                opacityContainer.style.cssText = 'grid-column:1/3;grid-row:1;display:flex;align-items:center;gap:2px;font-size:10px;user-select:none;justify-content:flex-start;height:14px';

                const decreaseBtn = document.createElement('button');
                decreaseBtn.textContent = '◀';
                decreaseBtn.style.cssText = 'padding:0;font-size:9px;line-height:1;height:14px;width:14px;cursor:pointer;border:none;background:transparent;color:#800000;flex-shrink:0';
                decreaseBtn.title = '透明度 -10%';
                decreaseBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    this._adjustLayerOpacity(index, -0.1);
                });

                const opacityValue = document.createElement('span');
                opacityValue.className = 'layer-opacity-value';
                const currentOpacity = layer.alpha !== undefined ? layer.alpha : 1.0;
                opacityValue.textContent = `${Math.round(currentOpacity * 100)}%`;
                opacityValue.style.cssText = 'min-width:34px;text-align:center;color:#800000;font-size:10px;font-weight:bold;flex-shrink:0';

                const increaseBtn = document.createElement('button');
                increaseBtn.textContent = '▶';
                increaseBtn.style.cssText = 'padding:0;font-size:9px;line-height:1;height:14px;width:14px;cursor:pointer;border:none;background:transparent;color:#800000;flex-shrink:0';
                increaseBtn.title = '透明度 +10%';
                increaseBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    this._adjustLayerOpacity(index, 0.1);
                });

                opacityContainer.appendChild(decreaseBtn);
                opacityContainer.appendChild(opacityValue);
                opacityContainer.appendChild(increaseBtn);
                layerDiv.appendChild(opacityContainer);
            }

            // 2行目: 目アイコン + バケツ（背景のみ）
            const visibilityIcon = document.createElement('div');
            visibilityIcon.className = 'layer-visibility';
            visibilityIcon.style.cssText = 'grid-column:1;grid-row:2;cursor:pointer;width:18px;height:14px;display:flex;align-items:center;justify-content:center;flex-shrink:0';
            
            const isVisible = layer.layerData?.visible !== false;
            visibilityIcon.innerHTML = isVisible ? 
                `<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#800000" stroke-width="2">
                    <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/>
                </svg>` :
                `<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#800000" stroke-width="2">
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
                bucketIcon.style.cssText = 'grid-column:2;grid-row:2;cursor:pointer;width:18px;height:14px;display:flex;align-items:center;justify-content:flex-start;padding-left:1px;flex-shrink:0';
                bucketIcon.innerHTML = `
                    <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" 
                         viewBox="0 0 24 24" fill="none" stroke="#800000" 
                         stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
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

            // 3行目: レイヤー名
            const nameSpan = document.createElement('span');
            nameSpan.className = 'layer-name';
            nameSpan.textContent = layer.layerData?.name || `レイヤー${index}`;
            nameSpan.style.cssText = `grid-column:1/3;grid-row:3;color:#800000;font-size:${isBackground?'9px':'10px'};font-weight:bold;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;text-align:left;cursor:${isBackground ? 'default' : 'text'};padding-left:0`;
            
            if (!isBackground) {
                nameSpan.addEventListener('dblclick', (e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    if (this._editingLayerIndex < 0) {
                        this._editLayerName(nameSpan, layer, index);
                    }
                });
            }
            
            layerDiv.appendChild(nameSpan);

            // サムネイル（1-3行目）- 固定配置でFlexbox中央揃え
            const thumbnail = this.createThumbnail(layer, index);
            thumbnail.style.cssText = 'grid-column:3;grid-row:1/4;display:flex;align-items:center;justify-content:center;';
            layerDiv.appendChild(thumbnail);

            // 削除ボタン（右上）- 通常レイヤーのみ
            if (!isBackground) {
                const deleteBtn = document.createElement('button');
                deleteBtn.className = 'layer-delete-button';
                deleteBtn.style.cssText = 'position:absolute;top:3px;right:3px;padding:0;width:13px;height:13px;display:flex;align-items:center;justify-content:center;cursor:pointer;border:none;border-radius:50%;background:#cf9c97;transition:background 0.2s,transform 0.1s,opacity 0.2s;z-index:10;opacity:0';
                deleteBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="#ffffee" stroke-width="4" stroke-linecap="round" stroke-linejoin="round">
                    <path d="m18 6-12 12"/><path d="m6 6 12 12"/>
                </svg>`;
                deleteBtn.title = 'レイヤーを削除';
                
                deleteBtn.addEventListener('mouseenter', function() {
                    this.style.backgroundColor = '#800000';
                    this.style.transform = 'scale(1.15)';
                });
                
                deleteBtn.addEventListener('mouseleave', function() {
                    this.style.backgroundColor = '#cf9c97';
                    this.style.transform = 'scale(1)';
                });
                
                deleteBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    if (this.layerSystem?.deleteLayer) {
                        this.layerSystem.deleteLayer(index);
                    }
                });
                
                layerDiv.appendChild(deleteBtn);
                
                layerDiv.addEventListener('mouseenter', () => {
                    deleteBtn.style.opacity = '1';
                });
                
                layerDiv.addEventListener('mouseleave', () => {
                    deleteBtn.style.opacity = '0';
                });
            }

            // クリックイベント
            layerDiv.addEventListener('click', (e) => {
                if (e.target.closest('.layer-delete-button') ||
                    e.target.closest('.layer-opacity-control button') ||
                    e.target.closest('.layer-visibility') ||
                    e.target.closest('.layer-background-color-button') ||
                    this._editingLayerIndex >= 0) {
                    return;
                }

                if (window.stateManager) {
                    window.stateManager.setLastActivePanel('layer');
                }

                if (this.layerSystem?.setActiveLayer) {
                    this.layerSystem.setActiveLayer(index);
                }
            });

            return layerDiv;
        }

        _editLayerName(nameSpan, layer, index) {
            if (layer.layerData?.isBackground || this._editingLayerIndex >= 0) {
                return;
            }

            this._editingLayerIndex = index;

            const originalName = nameSpan.textContent;
            const input = document.createElement('input');
            input.type = 'text';
            input.value = originalName;
            input.style.cssText = `grid-column:${nameSpan.style.gridColumn};grid-row:${nameSpan.style.gridRow};color:#800000;font-size:${nameSpan.style.fontSize};font-weight:bold;background:#fff;border:1px solid #800000;border-radius:2px;padding:1px 2px;width:100%;box-sizing:border-box;`;

            nameSpan.replaceWith(input);
            
            setTimeout(() => {
                input.focus();
                input.select();
            }, 0);

            const finishEdit = () => {
                if (this._editingLayerIndex < 0) return;
                this._editingLayerIndex = -1;

                const newName = input.value.trim();
                if (newName && newName !== originalName) {
                    if (layer.layerData) {
                        layer.layerData.name = newName;
                    }
                    if (this.eventBus) {
                        this.eventBus.emit('layer:name-changed', {
                            layerIndex: index,
                            layerId: layer.layerData?.id,
                            oldName: originalName,
                            newName: newName
                        });
                    }
                }
                input.replaceWith(nameSpan);
                nameSpan.textContent = newName || originalName;
            };

            input.addEventListener('blur', () => {
                setTimeout(finishEdit, 100);
            });
            
            input.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    finishEdit();
                } else if (e.key === 'Escape') {
                    e.preventDefault();
                    input.value = originalName;
                    finishEdit();
                }
                e.stopPropagation();
            });
        }

        createThumbnail(layer, index) {
            const maxWidth = 74;
            const maxHeight = 40;
            
            const canvasWidth = this.layerSystem?.config?.canvas?.width || 800;
            const canvasHeight = this.layerSystem?.config?.canvas?.height || 600;
            const aspectRatio = canvasWidth / canvasHeight;
            
            let thumbWidth, thumbHeight;
            if (aspectRatio >= maxWidth / maxHeight) {
                thumbWidth = maxWidth;
                thumbHeight = Math.round(maxWidth / aspectRatio);
            } else {
                thumbHeight = maxHeight;
                thumbWidth = Math.round(maxHeight * aspectRatio);
            }
            
            const thumbnailContainer = document.createElement('div');
            thumbnailContainer.className = 'layer-thumbnail';
            thumbnailContainer.dataset.layerIndex = index;
            
            thumbnailContainer.style.cssText = `
                width: ${thumbWidth}px;
                height: ${thumbHeight}px;
                box-sizing: border-box;
                border: 1px solid #cf9c97;
                border-radius: 2px;
                overflow: hidden;
                position: relative;
                flex-shrink: 0;
            `;
            
            const isBackground = layer.layerData?.isBackground || false;

            if (isBackground) {
                const swatch = document.createElement('div');
                swatch.className = 'background-color-swatch';
                swatch.style.cssText = `
                    width: 100%;
                    height: 100%;
                    position: absolute;
                    top: 0;
                    left: 0;
                `;
                
                const isVisible = layer.layerData?.visible !== false;
                
                if (!isVisible) {
                    if (window.checkerUtils) {
                        const dataUrl = window.checkerUtils.createThumbnailCheckerDataURL(thumbWidth - 2, thumbHeight - 2, 8);
                        swatch.style.backgroundImage = `url(${dataUrl})`;
                        swatch.style.backgroundSize = 'cover';
                        swatch.style.backgroundPosition = 'center';
                    } else {
                        swatch.style.backgroundColor = '#cccccc';
                    }
                } else {
                    const bgColor = layer.layerData.backgroundColor ?? 0xf0e0d6;
                    const colorHex = '#' + bgColor.toString(16).padStart(6, '0');
                    swatch.style.backgroundColor = colorHex;
                }
                
                thumbnailContainer.appendChild(swatch);
                return thumbnailContainer;
            }

            if (window.ThumbnailSystem && layer) {
                window.ThumbnailSystem.generateLayerThumbnail(layer, index, maxWidth, maxHeight)
                    .then(result => {
                        if (result && result.dataUrl) {
                            const img = document.createElement('img');
                            img.src = result.dataUrl;
                            img.style.cssText = `
                                width: ${thumbWidth}px;
                                height: ${thumbHeight}px;
                                display: block;
                                object-fit: contain;
                            `;
                            thumbnailContainer.innerHTML = '';
                            thumbnailContainer.appendChild(img);
                        }
                    })
                    .catch(() => {});
            }

            return thumbnailContainer;
        }

        async _updateSingleThumbnail(layerIndex) {
            const layers = this.layerSystem?.getLayers() || [];
            if (layerIndex < 0 || layerIndex >= layers.length) return;

            const reversedIndex = layers.length - 1 - layerIndex;
            const layerItems = this.container.querySelectorAll('.layer-item');
            if (reversedIndex < 0 || reversedIndex >= layerItems.length) return;

            const thumbnailContainer = layerItems[reversedIndex].querySelector('.layer-thumbnail');
            if (!thumbnailContainer) return;

            const layer = layers[layerIndex];
            const isBackground = layer?.layerData?.isBackground || false;
            
            const maxWidth = 74;
            const maxHeight = 40;
            
            const canvasWidth = this.layerSystem?.config?.canvas?.width || 800;
            const canvasHeight = this.layerSystem?.config?.canvas?.height || 600;
            const aspectRatio = canvasWidth / canvasHeight;
            
            let thumbWidth, thumbHeight;
            if (aspectRatio >= maxWidth / maxHeight) {
                thumbWidth = maxWidth;
                thumbHeight = Math.round(maxWidth / aspectRatio);
            } else {
                thumbHeight = maxHeight;
                thumbWidth = Math.round(maxHeight * aspectRatio);
            }
            
            thumbnailContainer.style.width = thumbWidth + 'px';
            thumbnailContainer.style.height = thumbHeight + 'px';
            
            if (isBackground) {
                thumbnailContainer.innerHTML = '';
                
                const swatch = document.createElement('div');
                swatch.className = 'background-color-swatch';
                swatch.style.cssText = `
                    width: 100%;
                    height: 100%;
                    position: absolute;
                    top: 0;
                    left: 0;
                `;
                
                const isVisible = layer.layerData?.visible !== false;
                
                if (!isVisible) {
                    if (window.checkerUtils) {
                        const dataUrl = window.checkerUtils.createThumbnailCheckerDataURL(thumbWidth - 2, thumbHeight - 2, 8);
                        swatch.style.backgroundImage = `url(${dataUrl})`;
                        swatch.style.backgroundSize = 'cover';
                        swatch.style.backgroundPosition = 'center';
                    } else {
                        swatch.style.backgroundColor = '#cccccc';
                    }
                } else {
                    const bgColor = layer.layerData.backgroundColor ?? 0xf0e0d6;
                    const colorHex = '#' + bgColor.toString(16).padStart(6, '0');
                    swatch.style.backgroundColor = colorHex;
                }
                
                thumbnailContainer.appendChild(swatch);
                return;
            }

            if (window.ThumbnailSystem) {
                try {
                    const result = await window.ThumbnailSystem.generateLayerThumbnail(layer, layerIndex, maxWidth, maxHeight);
                    if (result && result.dataUrl) {
                        const img = document.createElement('img');
                        img.src = result.dataUrl;
                        img.style.cssText = `
                            width: ${thumbWidth}px;
                            height: ${thumbHeight}px;
                            display: block;
                            object-fit: contain;
                        `;
                        thumbnailContainer.innerHTML = '';
                        thumbnailContainer.appendChild(img);
                    }
                } catch (error) {}
            }
        }

        async updateAllThumbnails() {
            const layers = this.layerSystem?.getLayers() || [];
            for (let i = 0; i < layers.length; i++) {
                await this._updateSingleThumbnail(i);
            }
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
                activeLayer.style.borderColor = '#ff6600';
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
                    animation: 200,
                    easing: 'cubic-bezier(0.25, 0.8, 0.25, 1)',
                    ghostClass: 'sortable-ghost',
                    dragClass: 'sortable-drag',
                    chosenClass: 'sortable-chosen',
                    forceFallback: false,
                    fallbackOnBody: false,
                    swapThreshold: 0.65,
                    delay: 0,
                    delayOnTouchOnly: false,

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
                        item.style.cursor = 'grabbing';
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
            } catch (error) {}
        }

        destroy() {
            if (this.sortable) {
                this.sortable.destroy();
                this.sortable = null;
            }
            if (this._updateTimeout) {
                clearTimeout(this._updateTimeout);
            }
            this._editingLayerIndex = -1;
        }
    }

    window.LayerPanelRenderer = LayerPanelRenderer;
})();