// ===== ui/layer-panel-renderer.js - Phase 5&6完全統合版 =====

window.TegakiUI = window.TegakiUI || {};

window.TegakiUI.LayerPanelRenderer = class {
    constructor() {
        this.container = null;
        this.animationSystem = null;
        this.layerSystem = null;
        this.eventBus = window.TegakiEventBus;
        this.thumbnailUpdateScheduled = false;
        this.thumbnailCanvases = new Map();
        
        this.layerUpdateTimers = new Map();
        this.layerUpdateThrottle = 50;
        
        this.updateQueue = new Set();
        this.isProcessingQueue = false;
        
        this._retryCounters = new Map();
        this._maxRetries = 3;
        
        this.gsapAvailable = typeof gsap !== 'undefined';
    }

    init(container, layerSystem, animationSystem) {
        this.container = container || document.getElementById('layer-list');
        this.layerSystem = layerSystem;
        this.animationSystem = animationSystem;
        
        if (!this.container) {
            throw new Error('Layer panel container not found');
        }
        
        this._setupEventListeners();
    }
    
    _setupEventListeners() {
        if (!this.eventBus) return;
        
        this.eventBus.on('layer:transform-updated', ({ data }) => {
            const { layerIndex, layerId, transform, immediate } = data || {};
            
            if (layerIndex === undefined && !layerId) return;
            
            if (immediate) {
                this._updateLayerByIndexOrIdImmediate(layerIndex, layerId);
                return;
            }
            
            const throttleKey = layerId || `index-${layerIndex}`;
            
            if (this.layerUpdateTimers.has(throttleKey)) {
                clearTimeout(this.layerUpdateTimers.get(throttleKey));
            }
            
            const timer = setTimeout(() => {
                this._updateLayerByIndexOrIdThrottled(layerIndex, layerId);
                this.layerUpdateTimers.delete(throttleKey);
            }, this.layerUpdateThrottle);
            
            this.layerUpdateTimers.set(throttleKey, timer);
        });
        
        this.eventBus.on('thumbnail:layer-updated', ({ data }) => {
            const { layerIndex, layerId, immediate } = data || {};
            
            if (immediate) {
                if (layerIndex !== undefined) {
                    this._updateLayerImmediate(layerIndex);
                } else {
                    this.updateAllThumbnails();
                }
                return;
            }
            
            if (this.thumbnailUpdateScheduled) return;
            this.thumbnailUpdateScheduled = true;
            
            requestAnimationFrame(() => {
                if (layerIndex !== undefined) {
                    this.updateLayerThumbnail(layerIndex);
                } else {
                    this.updateAllThumbnails();
                }
                this.thumbnailUpdateScheduled = false;
            });
        });
        
        this.eventBus.on('layer:path-added', ({ layerIndex }) => {
            if (this.thumbnailUpdateScheduled) return;
            this.thumbnailUpdateScheduled = true;
            
            requestAnimationFrame(() => {
                this.updateAllThumbnails();
                this.thumbnailUpdateScheduled = false;
            });
        });
        
        this.eventBus.on('camera:transform-changed', () => {
            if (this.thumbnailUpdateScheduled) return;
            this.thumbnailUpdateScheduled = true;
            
            requestAnimationFrame(() => {
                this.updateAllThumbnails();
                this.thumbnailUpdateScheduled = false;
            });
        });
        
        this.eventBus.on('camera:resized', ({ width, height }) => {
            if (this.thumbnailUpdateScheduled) return;
            this.thumbnailUpdateScheduled = true;
            
            requestAnimationFrame(() => {
                this.updateAllThumbnails();
                this.thumbnailUpdateScheduled = false;
            });
        });
    }

    _updateLayerByIndexOrIdImmediate(layerIndex, layerId) {
        if (this.gsapAvailable) {
            gsap.delayedCall(0.016, () => {
                this._doUpdateLayerByIndexOrId(layerIndex, layerId);
            });
        } else {
            requestAnimationFrame(() => {
                this._doUpdateLayerByIndexOrId(layerIndex, layerId);
            });
        }
    }
    
    _updateLayerByIndexOrIdThrottled(layerIndex, layerId) {
        if (this.gsapAvailable) {
            gsap.delayedCall(0.016, () => {
                this._doUpdateLayerByIndexOrId(layerIndex, layerId);
            });
        } else {
            requestAnimationFrame(() => {
                this._doUpdateLayerByIndexOrId(layerIndex, layerId);
            });
        }
    }

    _doUpdateLayerByIndexOrId(layerIndex, layerId) {
        if (layerIndex !== undefined) {
            this.updateLayerThumbnail(layerIndex);
        } else if (layerId) {
            const layers = this.layerSystem?.getLayers?.();
            if (layers) {
                const index = layers.findIndex(l => l.layerData?.id === layerId);
                if (index >= 0) {
                    this.updateLayerThumbnail(index);
                }
            }
        }
    }
    
    _updateLayerImmediate(layerIndex) {
        if (this.gsapAvailable) {
            gsap.delayedCall(0.016, () => {
                this.updateLayerThumbnail(layerIndex);
            });
        } else {
            requestAnimationFrame(() => {
                this.updateLayerThumbnail(layerIndex);
            });
        }
    }

    render(layers, activeIndex, animationSystem = null) {
        if (!this.container) return;
        if (!layers || layers.length === 0) return;

        this.container.innerHTML = '';

        layers.forEach((layer, index) => {
            const layerElement = this.createLayerElement(
                layer,
                index,
                index === activeIndex,
                animationSystem
            );
            this.container.insertBefore(layerElement, this.container.firstChild);
        });

        this.initializeSortable();
    }

    // Phase 5&6: 背景レイヤー色変更UI + 透明度UI
    createLayerElement(layer, index, isActive, animationSystem) {
        const layerDiv = document.createElement('div');
        layerDiv.className = isActive ? 'layer-item active' : 'layer-item';
        layerDiv.dataset.layerId = layer.layerData?.id || `layer-${index}`;
        layerDiv.dataset.layerIndex = String(index);

        // 表示/非表示チェックボックス
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.className = 'layer-visibility-toggle';
        checkbox.checked = layer.visible !== false;
        checkbox.style.gridColumn = '1';
        checkbox.style.gridRow = '1 / 3';
        layerDiv.appendChild(checkbox);

        // レイヤー名
        const nameSpan = document.createElement('span');
        nameSpan.className = 'layer-name';
        nameSpan.textContent = layer.layerData?.name || `Layer ${index}`;
        nameSpan.style.gridColumn = '2';
        nameSpan.style.gridRow = '2';
        layerDiv.appendChild(nameSpan);

        // Phase 5: 背景レイヤー専用UI
        if (layer.layerData?.isBackground) {
            // バケツアイコン（色変更）
            const bucketIcon = document.createElement('div');
            bucketIcon.className = 'layer-background-color-button';
            bucketIcon.style.gridColumn = '2';
            bucketIcon.style.gridRow = '1';
            bucketIcon.style.cursor = 'pointer';
            bucketIcon.style.display = 'flex';
            bucketIcon.style.alignItems = 'center';
            bucketIcon.style.gap = '4px';
            bucketIcon.style.fontSize = '11px';
            bucketIcon.style.userSelect = 'none';
            bucketIcon.innerHTML = `
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" 
                     viewBox="0 0 24 24" fill="none" stroke="#800000" 
                     stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                    <path d="m19 11-8-8-8.6 8.6a2 2 0 0 0 0 2.8l5.2 5.2c.8.8 2 .8 2.8 0L19 11Z"/>
                    <path d="m5 2 5 5"/>
                    <path d="M2 13h15"/>
                    <path d="M22 20a2 2 0 1 1-4 0c0-1.6 1.7-2.4 2-4 .3 1.6 2 2.4 2 4Z"/>
                </svg>
                <span style="font-weight: bold;">100%</span>
            `;
            bucketIcon.addEventListener('click', (e) => {
                e.stopPropagation();
                if (this.layerSystem && this.layerSystem.changeBackgroundLayerColor) {
                    this.layerSystem.changeBackgroundLayerColor(index, layer.layerData.id);
                }
            });
            layerDiv.appendChild(bucketIcon);
            
        } else {
            // Phase 6: 一般レイヤー透明度UI
            const opacityContainer = document.createElement('div');
            opacityContainer.className = 'layer-opacity-control';
            opacityContainer.style.gridColumn = '2';
            opacityContainer.style.gridRow = '1';
            opacityContainer.style.display = 'flex';
            opacityContainer.style.alignItems = 'center';
            opacityContainer.style.gap = '4px';
            opacityContainer.style.fontSize = '11px';
            opacityContainer.style.userSelect = 'none';
            
            // ◀ ボタン
            const decreaseBtn = document.createElement('button');
            decreaseBtn.textContent = '◀';
            decreaseBtn.className = 'layer-opacity-decrease';
            decreaseBtn.style.padding = '0 4px';
            decreaseBtn.style.fontSize = '10px';
            decreaseBtn.style.border = 'none';
            decreaseBtn.style.background = 'transparent';
            decreaseBtn.style.cursor = 'pointer';
            decreaseBtn.style.color = 'var(--futaba-maroon)';
            decreaseBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this._adjustLayerOpacity(index, -0.1);
            });
            
            // 透明度表示（ドラッグ可能）
            const opacityValue = document.createElement('span');
            opacityValue.className = 'layer-opacity-value';
            const currentOpacity = layer.alpha !== undefined ? layer.alpha : 1.0;
            opacityValue.textContent = `${Math.round(currentOpacity * 100)}%`;
            opacityValue.style.cursor = 'ew-resize';
            opacityValue.style.minWidth = '35px';
            opacityValue.style.textAlign = 'center';
            opacityValue.style.fontWeight = 'bold';
            this._setupOpacityDrag(opacityValue, index);
            
            // ▶ ボタン
            const increaseBtn = document.createElement('button');
            increaseBtn.textContent = '▶';
            increaseBtn.className = 'layer-opacity-increase';
            increaseBtn.style.padding = '0 4px';
            increaseBtn.style.fontSize = '10px';
            increaseBtn.style.border = 'none';
            increaseBtn.style.background = 'transparent';
            increaseBtn.style.cursor = 'pointer';
            increaseBtn.style.color = 'var(--futaba-maroon)';
            increaseBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this._adjustLayerOpacity(index, 0.1);
            });
            
            opacityContainer.appendChild(decreaseBtn);
            opacityContainer.appendChild(opacityValue);
            opacityContainer.appendChild(increaseBtn);
            layerDiv.appendChild(opacityContainer);
        }

        // サムネイル
        const thumbnail = this.createThumbnail(layer, index);
        layerDiv.appendChild(thumbnail);

        // Phase 5: 背景レイヤーは削除ボタン非表示
        if (!layer.layerData?.isBackground) {
            const deleteBtn = document.createElement('div');
            deleteBtn.className = 'layer-delete-button';
            deleteBtn.style.gridColumn = '4';
            deleteBtn.style.gridRow = '1 / 3';
            deleteBtn.style.cursor = 'pointer';
            deleteBtn.innerHTML = `
                <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" 
                     viewBox="0 0 24 24" fill="none" stroke="currentColor" 
                     stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
                    <path d="m18 6-12 12"/><path d="m6 6 12 12"/>
                </svg>
            `;
            deleteBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                if (this.layerSystem && this.layerSystem.deleteLayer) {
                    this.layerSystem.deleteLayer(index);
                }
            });
            layerDiv.appendChild(deleteBtn);
        }

        // クリックイベント
        layerDiv.addEventListener('click', (e) => {
            if (e.target !== checkbox && 
                !e.target.closest('.layer-opacity-control') &&
                !e.target.closest('.layer-background-color-button') &&
                !e.target.closest('.layer-delete-button')) {
                if (this.layerSystem && this.layerSystem.setActiveLayer) {
                    this.layerSystem.setActiveLayer(index);
                }
            }
        });

        checkbox.addEventListener('change', (e) => {
            if (this.layerSystem && this.layerSystem.toggleLayerVisibility) {
                this.layerSystem.toggleLayerVisibility(index);
            }
        });

        return layerDiv;
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
            e.stopPropagation();
            e.preventDefault();
        });
        
        element.addEventListener('pointermove', (e) => {
            if (!isDragging) return;
            const dx = e.clientX - startX;
            const delta = dx / 100; // 100pxで1.0変化
            const newOpacity = Math.max(0, Math.min(1, startOpacity + delta));
            this._setLayerOpacity(layerIndex, newOpacity);
            e.preventDefault();
        });
        
        element.addEventListener('pointerup', (e) => {
            if (!isDragging) return;
            isDragging = false;
            element.releasePointerCapture(e.pointerId);
            e.preventDefault();
        });
        
        element.addEventListener('pointercancel', (e) => {
            if (!isDragging) return;
            isDragging = false;
            element.releasePointerCapture(e.pointerId);
        });
    }

    // Phase 6: ボタンクリックで透明度調整
    _adjustLayerOpacity(layerIndex, delta) {
        const layer = this.layerSystem.getLayers()[layerIndex];
        if (!layer) return;
        
        const currentOpacity = layer.alpha !== undefined ? layer.alpha : 1.0;
        const newOpacity = Math.max(0, Math.min(1, currentOpacity + delta));
        this._setLayerOpacity(layerIndex, newOpacity);
    }

    // Phase 6: 透明度設定
    _setLayerOpacity(layerIndex, opacity) {
        if (this.layerSystem.setLayerOpacity) {
            this.layerSystem.setLayerOpacity(layerIndex, opacity);
        }
        
        // UI更新
        const layers = this.layerSystem.getLayers();
        const layerDiv = this.container.querySelector(
            `.layer-item[data-layer-index="${layerIndex}"]`
        );
        
        if (layerDiv) {
            const opacityValue = layerDiv.querySelector('.layer-opacity-value');
            if (opacityValue) {
                opacityValue.textContent = `${Math.round(opacity * 100)}%`;
            }
        }
    }

    createThumbnail(layer, index) {
        const thumbnail = document.createElement('div');
        thumbnail.className = 'layer-thumbnail';
        thumbnail.style.gridColumn = '3';
        thumbnail.style.gridRow = '1 / 3';
        thumbnail.dataset.layerIndex = String(index);
        thumbnail.style.borderRadius = '0';

        if (layer.layerData?.isBackground) {
            const swatch = document.createElement('div');
            swatch.className = 'layer-background-swatch';
            swatch.style.width = '100%';
            swatch.style.height = '100%';
            
            // 背景グラフィックスから色を取得
            const bg = layer.layerData.backgroundGraphics;
            if (bg && bg._fillStyle && bg._fillStyle.color !== undefined) {
                const color = bg._fillStyle.color;
                const hexColor = '#' + color.toString(16).padStart(6, '0');
                swatch.style.backgroundColor = hexColor;
            } else {
                swatch.style.backgroundColor = '#F0E0D6';
            }
            
            thumbnail.appendChild(swatch);
            return thumbnail;
        }

        const img = document.createElement('img');
        img.alt = `Layer ${index} thumbnail`;
        img.style.width = '100%';
        img.style.height = '100%';
        img.style.objectFit = 'contain';
        img.style.display = 'none';
        img.dataset.layerIndex = String(index);
        img.dataset.layerId = layer.layerData?.id || `layer-${index}`;

        thumbnail.appendChild(img);

        requestAnimationFrame(() => {
            this._generateAndDisplayThumbnail(layer, index, img);
        });

        return thumbnail;
    }

    async _generateAndDisplayThumbnail(layer, index, img) {
        try {
            if (!window.ThumbnailSystem) return;
            
            if (!window.ThumbnailSystem.isInitialized) {
                setTimeout(() => {
                    this._generateAndDisplayThumbnail(layer, index, img);
                }, 100);
                return;
            }

            const bitmap = await window.ThumbnailSystem.generateLayerThumbnail(
                layer,
                64,
                64
            );

            if (!bitmap) return;

            const dataURL = window.ThumbnailSystem.canvasToDataURL(bitmap);
            
            if (dataURL) {
                img.src = dataURL;
                img.style.display = 'block';
            }

        } catch (error) {
            // サイレント失敗
        }
    }

    async updateLayerThumbnail(layerIndex) {
        if (!this.container) return;
        
        const layers = this.layerSystem?.getLayers?.();
        if (!layers || !layers[layerIndex]) return;

        const layer = layers[layerIndex];
        
        // 背景レイヤーの色更新
        if (layer.layerData?.isBackground) {
            const layerDiv = this.container.querySelector(
                `.layer-item[data-layer-index="${layerIndex}"]`
            );
            if (layerDiv) {
                const swatch = layerDiv.querySelector('.layer-background-swatch');
                if (swatch) {
                    const bg = layer.layerData.backgroundGraphics;
                    if (bg && bg._fillStyle && bg._fillStyle.color !== undefined) {
                        const color = bg._fillStyle.color;
                        const hexColor = '#' + color.toString(16).padStart(6, '0');
                        swatch.style.backgroundColor = hexColor;
                    }
                }
            }
            return;
        }
        
        if (!window.ThumbnailSystem || !window.ThumbnailSystem.isInitialized) return;
        
        if (layer.layerData?.id) {
            window.ThumbnailSystem._invalidateLayerCacheByLayerId(layer.layerData.id);
        }
        
        let layerDiv = this.container.querySelector(
            `.layer-item[data-layer-index="${layerIndex}"]`
        );
        
        if (!layerDiv && layer.layerData?.id) {
            layerDiv = this.container.querySelector(
                `.layer-item[data-layer-id="${layer.layerData.id}"]`
            );
        }
        
        if (!layerDiv) {
            const allLayerDivs = this.container.querySelectorAll('.layer-item');
            const reverseIndex = allLayerDivs.length - 1 - layerIndex;
            if (reverseIndex >= 0 && reverseIndex < allLayerDivs.length) {
                layerDiv = allLayerDivs[reverseIndex];
            }
        }

        if (!layerDiv) return;

        const thumbnail = layerDiv.querySelector('.layer-thumbnail');
        let img = thumbnail?.querySelector('img');
        
        if (!img && thumbnail) {
            img = document.createElement('img');
            img.alt = `Layer ${layerIndex} thumbnail`;
            img.style.width = '100%';
            img.style.height = '100%';
            img.style.objectFit = 'contain';
            img.style.display = 'none';
            img.dataset.layerIndex = String(layerIndex);
            img.dataset.layerId = layer.layerData?.id || `layer-${layerIndex}`;
            thumbnail.appendChild(img);
        }

        if (!img) {
            const retryKey = `layer_${layerIndex}`;
            const retryCount = this._retryCounters.get(retryKey) || 0;
            
            if (retryCount < this._maxRetries) {
                this._retryCounters.set(retryKey, retryCount + 1);
                
                setTimeout(() => {
                    this.updateLayerThumbnail(layerIndex);
                }, 100 * (retryCount + 1));
                
                return;
            } else {
                this._retryCounters.delete(retryKey);
                return;
            }
        }

        this._retryCounters.delete(`layer_${layerIndex}`);

        await this._generateAndDisplayThumbnail(layer, layerIndex, img);
    }

    async updateAllThumbnails() {
        if (!this.container) return;
        
        const layers = this.layerSystem?.getLayers?.();
        if (!layers) return;

        if (!window.ThumbnailSystem || !window.ThumbnailSystem.isInitialized) {
            setTimeout(() => {
                this.updateAllThumbnails();
            }, 100);
            return;
        }

        window.ThumbnailSystem.clearAllCache();

        for (let i = 0; i < layers.length; i++) {
            await this.updateLayerThumbnail(i);
            
            if (i < layers.length - 1) {
                await new Promise(resolve => setTimeout(resolve, 10));
            }
        }
    }

    initializeSortable() {
        if (!window.Sortable) return;
        
        try {
            if (this.sortable) {
                this.sortable.destroy();
            }

            this.sortable = Sortable.create(this.container, {
                animation: 150,
                onEnd: (evt) => {
                    if (this.layerSystem?.reorderLayers) {
                        this.layerSystem.reorderLayers(evt.oldIndex, evt.newIndex);
                    }
                }
            });
        } catch (error) {
            // サイレント失敗
        }
    }
    
    destroy() {
        for (const timer of this.layerUpdateTimers.values()) {
            clearTimeout(timer);
        }
        this.layerUpdateTimers.clear();
        
        if (this.sortable) {
            this.sortable.destroy();
        }
        
        this.thumbnailCanvases.clear();
        this.updateQueue.clear();
        this._retryCounters.clear();
    }
};

console.log('✅ ui/layer-panel-renderer.js (Phase 5&6完全統合版) loaded');