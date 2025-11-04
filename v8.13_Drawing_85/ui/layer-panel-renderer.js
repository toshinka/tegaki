// ===== ui/layer-panel-renderer.js - Phase 5/6完全版 =====
// Phase 5改修: 背景レイヤーにバケツアイコン実装
// Phase 6改修: 透明度UI実装（◀ 100% ▶形式）

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
        this.debugEnabled = false;
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
        
        // レイヤー変形更新
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
        
        // サムネイル更新リクエスト
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
        
        // 描画イベント
        this.eventBus.on('layer:path-added', ({ layerIndex }) => {
            if (this.thumbnailUpdateScheduled) return;
            this.thumbnailUpdateScheduled = true;
            
            requestAnimationFrame(() => {
                this.updateAllThumbnails();
                this.thumbnailUpdateScheduled = false;
            });
        });
        
        // カメラ変形
        this.eventBus.on('camera:transform-changed', () => {
            if (this.thumbnailUpdateScheduled) return;
            this.thumbnailUpdateScheduled = true;
            
            requestAnimationFrame(() => {
                this.updateAllThumbnails();
                this.thumbnailUpdateScheduled = false;
            });
        });
        
        // カメラリサイズ
        this.eventBus.on('camera:resized', ({ width, height }) => {
            if (this.thumbnailUpdateScheduled) return;
            this.thumbnailUpdateScheduled = true;
            
            requestAnimationFrame(() => {
                this.updateAllThumbnails();
                this.thumbnailUpdateScheduled = false;
            });
        });

        // ★ Phase 5: 背景色変更リクエスト
        this.eventBus.on('ui:background-color-change-requested', ({ layerIndex, layerId }) => {
            if (this.layerSystem && this.layerSystem._changeBackgroundLayerColor) {
                this.layerSystem._changeBackgroundLayerColor(layerIndex, layerId);
            }
        });

        // ★ Phase 6: 透明度変更リクエスト
        this.eventBus.on('ui:layer-opacity-change-requested', ({ layerIndex, opacity }) => {
            if (this.layerSystem && this.layerSystem.setLayerOpacity) {
                this.layerSystem.setLayerOpacity(layerIndex, opacity);
            }
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

    createLayerElement(layer, index, isActive, animationSystem) {
        const layerDiv = document.createElement('div');
        layerDiv.className = isActive ? 'layer-item active' : 'layer-item';
        layerDiv.dataset.layerId = layer.layerData?.id || `layer-${index}`;
        layerDiv.dataset.layerIndex = String(index);

        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.className = 'layer-visibility-toggle';
        checkbox.checked = layer.visible !== false;
        checkbox.style.gridColumn = '1';
        checkbox.style.gridRow = '1 / 3';
        layerDiv.appendChild(checkbox);

        // ★ Phase 5: 背景レイヤーの場合はバケツアイコンを追加
        if (layer.layerData?.isBackground) {
            const bucketIcon = document.createElement('div');
            bucketIcon.className = 'layer-background-color-button';
            bucketIcon.innerHTML = `
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" 
                     viewBox="0 0 24 24" fill="none" stroke="#800000" 
                     stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                    <path d="m19 11-8-8-8.6 8.6a2 2 0 0 0 0 2.8l5.2 5.2c.8.8 2 .8 2.8 0L19 11Z"/>
                    <path d="m5 2 5 5"/>
                    <path d="M2 13h15"/>
                    <path d="M22 20a2 2 0 1 1-4 0c0-1.6 1.7-2.4 2-4 .3 1.6 2 2.4 2 4Z"/>
                </svg>
            `;
            bucketIcon.style.gridColumn = '2';
            bucketIcon.style.gridRow = '1';
            bucketIcon.style.cursor = 'pointer';
            bucketIcon.style.display = 'flex';
            bucketIcon.style.alignItems = 'center';
            bucketIcon.style.justifyContent = 'center';
            bucketIcon.style.padding = '2px';
            bucketIcon.title = '背景色を変更';
            
            bucketIcon.addEventListener('click', (e) => {
                e.stopPropagation();
                if (this.eventBus) {
                    this.eventBus.emit('ui:background-color-change-requested', {
                        layerIndex: index,
                        layerId: layer.layerData.id
                    });
                }
            });
            
            layerDiv.appendChild(bucketIcon);
        } else {
            // ★ Phase 6: 一般レイヤーの透明度UI実装
            const opacityContainer = document.createElement('div');
            opacityContainer.className = 'layer-opacity-control';
            opacityContainer.style.gridColumn = '2';
            opacityContainer.style.gridRow = '1';
            opacityContainer.style.display = 'flex';
            opacityContainer.style.alignItems = 'center';
            opacityContainer.style.justifyContent = 'center';
            opacityContainer.style.gap = '2px';
            opacityContainer.style.fontSize = '10px';
            
            // ◀ ボタン
            const decreaseBtn = document.createElement('button');
            decreaseBtn.textContent = '◀';
            decreaseBtn.className = 'layer-opacity-decrease';
            decreaseBtn.style.border = 'none';
            decreaseBtn.style.background = 'transparent';
            decreaseBtn.style.color = '#800000';
            decreaseBtn.style.cursor = 'pointer';
            decreaseBtn.style.padding = '0 2px';
            decreaseBtn.style.fontSize = '10px';
            decreaseBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this._adjustLayerOpacity(index, -0.1);
            });
            
            // 透明度表示（100%）
            const opacityValue = document.createElement('span');
            opacityValue.className = 'layer-opacity-value';
            const currentOpacity = layer.alpha !== undefined ? layer.alpha : 1.0;
            opacityValue.textContent = `${Math.round(currentOpacity * 100)}%`;
            opacityValue.style.fontSize = '10px';
            opacityValue.style.color = '#800000';
            opacityValue.style.fontWeight = 'bold';
            opacityValue.style.minWidth = '30px';
            opacityValue.style.textAlign = 'center';
            opacityValue.dataset.layerIndex = String(index);
            
            // ▶ ボタン
            const increaseBtn = document.createElement('button');
            increaseBtn.textContent = '▶';
            increaseBtn.className = 'layer-opacity-increase';
            increaseBtn.style.border = 'none';
            increaseBtn.style.background = 'transparent';
            increaseBtn.style.color = '#800000';
            increaseBtn.style.cursor = 'pointer';
            increaseBtn.style.padding = '0 2px';
            increaseBtn.style.fontSize = '10px';
            increaseBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this._adjustLayerOpacity(index, 0.1);
            });
            
            opacityContainer.appendChild(decreaseBtn);
            opacityContainer.appendChild(opacityValue);
            opacityContainer.appendChild(increaseBtn);
            layerDiv.appendChild(opacityContainer);
        }

        const nameSpan = document.createElement('span');
        nameSpan.className = 'layer-name';
        nameSpan.textContent = layer.layerData?.name || `Layer ${index}`;
        nameSpan.style.gridColumn = '2';
        nameSpan.style.gridRow = '2';
        nameSpan.style.textAlign = 'left';
        nameSpan.style.paddingLeft = '4px';
        
        // ★ Phase 5: ダブルクリックでレイヤー名編集
        let clickTimer = null;
        nameSpan.addEventListener('click', (e) => {
            if (clickTimer) {
                clearTimeout(clickTimer);
                clickTimer = null;
                // ダブルクリック
                e.stopPropagation();
                this._editLayerName(nameSpan, layer, index);
            } else {
                clickTimer = setTimeout(() => {
                    clickTimer = null;
                }, 300);
            }
        });
        
        layerDiv.appendChild(nameSpan);

        const thumbnail = this.createThumbnail(layer, index);
        layerDiv.appendChild(thumbnail);

        layerDiv.addEventListener('click', (e) => {
            if (e.target !== checkbox) {
                if (this.eventBus) {
                    this.eventBus.emit('ui:layer-selected', { 
                        layerIndex: index,
                        layerId: layer.layerData?.id
                    });
                }
            }
        });

        checkbox.addEventListener('change', (e) => {
            layer.visible = e.target.checked;
            if (this.eventBus) {
                this.eventBus.emit('ui:layer-visibility-changed', {
                    layerIndex: index,
                    visible: e.target.checked,
                    layerId: layer.layerData?.id
                });
            }
        });

        return layerDiv;
    }

    // ★ Phase 5: レイヤー名編集
    _editLayerName(nameSpan, layer, index) {
        const originalName = nameSpan.textContent;
        
        const input = document.createElement('input');
        input.type = 'text';
        input.value = originalName;
        input.style.width = '100%';
        input.style.fontSize = '10px';
        input.style.border = '1px solid #800000';
        input.style.padding = '2px';
        
        nameSpan.replaceWith(input);
        input.focus();
        input.select();
        
        const finishEdit = () => {
            const newName = input.value.trim() || originalName;
            
            if (layer.layerData) {
                layer.layerData.name = newName;
            }
            
            const newNameSpan = document.createElement('span');
            newNameSpan.className = 'layer-name';
            newNameSpan.textContent = newName;
            newNameSpan.style.gridColumn = '2';
            newNameSpan.style.gridRow = '2';
            newNameSpan.style.textAlign = 'left';
            newNameSpan.style.paddingLeft = '4px';
            
            // ダブルクリックイベントを再設定
            let clickTimer = null;
            newNameSpan.addEventListener('click', (e) => {
                if (clickTimer) {
                    clearTimeout(clickTimer);
                    clickTimer = null;
                    e.stopPropagation();
                    this._editLayerName(newNameSpan, layer, index);
                } else {
                    clickTimer = setTimeout(() => {
                        clickTimer = null;
                    }, 300);
                }
            });
            
            input.replaceWith(newNameSpan);
            
            if (this.eventBus) {
                this.eventBus.emit('layer:name-changed', {
                    layerIndex: index,
                    layerId: layer.layerData?.id,
                    oldName: originalName,
                    newName
                });
            }
        };
        
        input.addEventListener('blur', finishEdit);
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                finishEdit();
            } else if (e.key === 'Escape') {
                input.value = originalName;
                finishEdit();
            }
        });
    }

    // ★ Phase 6: 透明度調整
    _adjustLayerOpacity(layerIndex, delta) {
        const layers = this.layerSystem?.getLayers?.();
        if (!layers || !layers[layerIndex]) return;
        
        const layer = layers[layerIndex];
        const currentOpacity = layer.alpha !== undefined ? layer.alpha : 1.0;
        const newOpacity = Math.max(0, Math.min(1, currentOpacity + delta));
        
        this._setLayerOpacity(layerIndex, newOpacity);
    }

    _setLayerOpacity(layerIndex, opacity) {
        if (this.eventBus) {
            this.eventBus.emit('ui:layer-opacity-change-requested', {
                layerIndex,
                opacity
            });
        }
        
        // UI即座更新
        const layerDivs = this.container.querySelectorAll('.layer-item');
        const reverseIndex = layerDivs.length - 1 - layerIndex;
        if (reverseIndex >= 0 && reverseIndex < layerDivs.length) {
            const layerDiv = layerDivs[reverseIndex];
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

        // 背景レイヤーの場合は色見本を表示
        if (layer.layerData?.isBackground) {
            const swatch = document.createElement('div');
            swatch.style.width = '100%';
            swatch.style.height = '100%';
            
            // 背景Graphicsから色を取得
            const bgGraphics = layer.layerData.backgroundGraphics;
            let bgColor = '#F0E0D6';
            if (bgGraphics && bgGraphics.geometry && bgGraphics.geometry.graphicsData) {
                // 色情報を取得（実装依存）
                bgColor = '#F0E0D6';
            }
            swatch.style.backgroundColor = bgColor;
            thumbnail.appendChild(swatch);
            return thumbnail;
        }

        // 通常レイヤー: <img>要素を作成
        const img = document.createElement('img');
        img.alt = `Layer ${index} thumbnail`;
        img.style.width = '100%';
        img.style.height = '100%';
        img.style.objectFit = 'contain';
        img.style.display = 'none';
        img.dataset.layerIndex = String(index);
        img.dataset.layerId = layer.layerData?.id || `layer-${index}`;

        thumbnail.appendChild(img);

        // 非同期でサムネイル生成・表示
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
            if (this.debugEnabled) {
                console.error(`[Panel] Layer thumbnail generation failed for index ${index}:`, error);
            }
        }
    }

    async updateLayerThumbnail(layerIndex) {
        if (!this.container) return;
        
        const layers = this.layerSystem?.getLayers?.();
        if (!layers || !layers[layerIndex]) return;

        const layer = layers[layerIndex];
        
        if (!window.ThumbnailSystem || !window.ThumbnailSystem.isInitialized) return;
        
        // キャッシュ無効化
        if (layer.layerData?.id) {
            window.ThumbnailSystem._invalidateLayerCacheByLayerId(layer.layerData.id);
        }
        
        // DOM要素検索
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
            if (this.debugEnabled) {
                console.warn('Sortable initialization failed:', error);
            }
        }
    }

    setDebugMode(enabled) {
        this.debugEnabled = enabled;
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

console.log('✅ ui/layer-panel-renderer.js Phase 5/6 loaded');