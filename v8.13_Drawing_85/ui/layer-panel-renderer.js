// ui/layer-panel-renderer.js - Phase 5, 6 完全実装版
// レイヤーパネルのUI描画とインタラクション管理
// Phase 5: 背景レイヤー仕様（バケツアイコン、透明度非表示、削除ボタン非表示）
// Phase 6: 一般レイヤー透明度UI（◀ 100% ▶、ドラッグ対応）

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

            // Phase 5: 背景色変更リクエスト処理
            this.eventBus.on('ui:background-color-change-requested', ({ layerIndex, layerId }) => {
                if (this.layerSystem?.changeBackgroundLayerColor) {
                    this.layerSystem.changeBackgroundLayerColor(layerIndex, layerId);
                }
            });

            // Phase 8用: アクティブパネル切り替え
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
            const layerColor = isBackground ? '#f0e0d6' : '#ffffee';
            layerDiv.style.backgroundColor = layerColor;
            layerDiv.style.display = 'flex';
            layerDiv.style.alignItems = 'center';
            layerDiv.style.padding = '4px 8px';
            layerDiv.style.gap = '8px';
            layerDiv.style.minHeight = '72px';

            // 表示/非表示アイコン
            const visibilityIcon = document.createElement('div');
            visibilityIcon.className = 'layer-visibility';
            visibilityIcon.style.cursor = 'pointer';
            visibilityIcon.style.width = '24px';
            visibilityIcon.style.height = '24px';
            visibilityIcon.style.display = 'flex';
            visibilityIcon.style.alignItems = 'center';
            visibilityIcon.style.justifyContent = 'center';
            visibilityIcon.innerHTML = layer.layerData?.visible !== false ? 
                `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#800000" stroke-width="2">
                    <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/>
                </svg>` :
                `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#800000" stroke-width="2">
                    <path d="m15 18-.722-3.25"/><path d="m2 2 20 20"/><path d="M6.71 6.71C3.4 8.27 2 12 2 12s3 7 10 7c1.59 0 2.84-.3 3.79-.73"/>
                </svg>`;
            visibilityIcon.addEventListener('click', (e) => {
                e.stopPropagation();
                if (this.layerSystem?.toggleLayerVisibility) {
                    this.layerSystem.toggleLayerVisibility(index);
                }
            });
            layerDiv.appendChild(visibilityIcon);

            // Phase 5: 背景レイヤーの場合はバケツアイコン
            if (isBackground) {
                const bucketIcon = document.createElement('div');
                bucketIcon.className = 'layer-background-color-button';
                bucketIcon.style.cursor = 'pointer';
                bucketIcon.style.width = '24px';
                bucketIcon.style.height = '24px';
                bucketIcon.style.display = 'flex';
                bucketIcon.style.alignItems = 'center';
                bucketIcon.style.justifyContent = 'center';
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
                bucketIcon.title = '背景色を変更（現在のペンカラー）';
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
            } else {
                // Phase 6: 一般レイヤーの透明度UI
                const opacityContainer = document.createElement('div');
                opacityContainer.className = 'layer-opacity-control';
                opacityContainer.style.display = 'flex';
                opacityContainer.style.alignItems = 'center';
                opacityContainer.style.gap = '2px';
                opacityContainer.style.fontSize = '11px';
                opacityContainer.style.userSelect = 'none';

                const decreaseBtn = document.createElement('button');
                decreaseBtn.textContent = '◀';
                decreaseBtn.className = 'layer-opacity-btn';
                decreaseBtn.style.padding = '0';
                decreaseBtn.style.width = '16px';
                decreaseBtn.style.height = '16px';
                decreaseBtn.style.fontSize = '9px';
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
                opacityValue.style.cursor = 'ew-resize';
                opacityValue.style.minWidth = '32px';
                opacityValue.style.textAlign = 'center';
                opacityValue.style.color = '#800000';
                opacityValue.style.fontSize = '11px';
                opacityValue.title = 'ドラッグで透明度調整';
                this._setupOpacityDrag(opacityValue, index);

                const increaseBtn = document.createElement('button');
                increaseBtn.textContent = '▶';
                increaseBtn.className = 'layer-opacity-btn';
                increaseBtn.style.padding = '0';
                increaseBtn.style.width = '16px';
                increaseBtn.style.height = '16px';
                increaseBtn.style.fontSize = '9px';
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
            }

            // レイヤー名
            const nameSpan = document.createElement('span');
            nameSpan.className = 'layer-name';
            nameSpan.textContent = layer.layerData?.name || `レイヤー${index}`;
            nameSpan.style.flex = '1';
            nameSpan.style.color = '#800000';
            nameSpan.style.fontSize = '13px';
            nameSpan.style.whiteSpace = 'nowrap';
            nameSpan.style.overflow = 'hidden';
            nameSpan.style.textOverflow = 'ellipsis';
            layerDiv.appendChild(nameSpan);

            // サムネイル
            const thumbnail = this.createThumbnail(layer, index);
            layerDiv.appendChild(thumbnail);

            // 削除ボタン（背景レイヤー以外）
            if (!isBackground) {
                const deleteBtn = document.createElement('button');
                deleteBtn.className = 'layer-delete-button';
                deleteBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#800000" stroke-width="2.5">
                    <path d="m18 6-12 12"/><path d="m6 6 12 12"/>
                </svg>`;
                deleteBtn.style.padding = '4px';
                deleteBtn.style.width = '20px';
                deleteBtn.style.height = '20px';
                deleteBtn.style.display = 'flex';
                deleteBtn.style.alignItems = 'center';
                deleteBtn.style.justifyContent = 'center';
                deleteBtn.style.cursor = 'pointer';
                deleteBtn.style.border = 'none';
                deleteBtn.style.backgroundColor = 'transparent';
                deleteBtn.title = 'レイヤーを削除';
                deleteBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    if (this.layerSystem?.deleteLayer) {
                        this.layerSystem.deleteLayer(index);
                    }
                });
                layerDiv.appendChild(deleteBtn);
            }

            // レイヤークリックでアクティブ化
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

            return layerDiv;
        }

        createThumbnail(layer, index) {
            const thumbnailContainer = document.createElement('div');
            thumbnailContainer.className = 'layer-thumbnail';
            thumbnailContainer.style.width = '64px';
            thumbnailContainer.style.height = '64px';
            thumbnailContainer.style.marginLeft = '8px';
            thumbnailContainer.style.border = '1px solid #800000';
            thumbnailContainer.style.backgroundColor = '#ffffff';
            thumbnailContainer.style.position = 'relative';
            thumbnailContainer.style.overflow = 'hidden';

            // サムネイル画像を生成
            if (window.ThumbnailSystem) {
                window.ThumbnailSystem.generateLayerThumbnail(layer, index)
                    .then(thumbnailData => {
                        if (thumbnailData && thumbnailData.dataUrl) {
                            const img = document.createElement('img');
                            img.src = thumbnailData.dataUrl;
                            img.style.width = '100%';
                            img.style.height = '100%';
                            img.style.objectFit = 'contain';
                            thumbnailContainer.innerHTML = '';
                            thumbnailContainer.appendChild(img);
                        }
                    })
                    .catch(err => {
                        console.warn('Thumbnail generation failed:', err);
                    });
            }

            return thumbnailContainer;
        }

        // Phase 6: 透明度ドラッグ処理
        _setupOpacityDrag(element, layerIndex) {
            let isDragging = false;
            let startX = 0;
            let startOpacity = 0;

            element.addEventListener('pointerdown', (e) => {
                isDragging = true;
                startX = e.clientX;
                const layer = this.layerSystem.getLayers()[layerIndex];
                startOpacity = layer.alpha !== undefined ? layer.alpha : 1.0;
                element.setPointerCapture(e.pointerId);
                element.style.cursor = 'ew-resize';
                e.stopPropagation();
            });

            element.addEventListener('pointermove', (e) => {
                if (!isDragging) return;
                const dx = e.clientX - startX;
                const delta = dx / 200; // 200pxで100%変化
                const newOpacity = Math.max(0, Math.min(1, startOpacity + delta));
                this._setLayerOpacity(layerIndex, newOpacity);
                e.stopPropagation();
            });

            element.addEventListener('pointerup', (e) => {
                if (!isDragging) return;
                isDragging = false;
                element.releasePointerCapture(e.pointerId);
                element.style.cursor = 'ew-resize';
                e.stopPropagation();
            });

            element.addEventListener('pointercancel', (e) => {
                if (!isDragging) return;
                isDragging = false;
                element.releasePointerCapture(e.pointerId);
                element.style.cursor = 'ew-resize';
            });
            
            // ホバー時のカーソル
            element.addEventListener('pointerenter', () => {
                if (!isDragging) {
                    element.style.cursor = 'ew-resize';
                }
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

        // Phase 8: アクティブパネル状態更新
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
                        evt.item.style.opacity = '0.5';
                    },

                    onStart: (evt) => {
                        evt.item.style.cursor = 'grabbing';
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