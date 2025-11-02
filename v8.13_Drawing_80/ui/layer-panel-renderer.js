// ===== ui/layer-panel-renderer.js - Phase 1: タブレットペン完全対応版 =====
// Phase 1改修: Sortable.js廃止 → PointerEvent統合
// タブレットペン・タッチ・マウス全対応のドラッグ＆ドロップ

window.TegakiUI = window.TegakiUI || {};

window.TegakiUI.LayerPanelRenderer = class {
    constructor() {
        this.container = null;
        this.animationSystem = null;
        this.layerSystem = null;
        this.eventBus = window.TegakiEventBus;
        this.thumbnailUpdateScheduled = false;
        this.thumbnailCanvases = new Map();
        
        // Phase 1: PointerEventベースドラッグ管理
        this.dragState = {
            isDragging: false,
            draggedElement: null,
            draggedIndex: null,
            pointerId: null,
            startY: 0,
            currentY: 0,
            placeholder: null
        };
        
        // throttle管理
        this.layerUpdateTimers = new Map();
        this.layerUpdateThrottle = 50;
        
        this.gsapAvailable = typeof gsap !== 'undefined';
    }

    init(container, layerSystem, animationSystem) {
        this.container = container || document.getElementById('layer-list');
        this.layerSystem = layerSystem;
        this.animationSystem = animationSystem;
        
        if (!this.container) {
            throw new Error('Layer panel container not found');
        }
        
        // Phase 1: PointerEvent設定
        this.container.style.touchAction = 'none';
        
        this._setupEventListeners();
        console.log('✅ LayerPanelRenderer initialized (Phase 1: Tablet Pen Support)');
    }
    
    _setupEventListeners() {
        if (!this.eventBus) return;
        
        // layer:transform-updated 購読
        this.eventBus.on('layer:transform-updated', ({ data }) => {
            const { layerIndex, layerId } = data || {};
            if (layerIndex === undefined && !layerId) return;
            
            const throttleKey = layerId || `index-${layerIndex}`;
            
            if (this.layerUpdateTimers.has(throttleKey)) {
                clearTimeout(this.layerUpdateTimers.get(throttleKey));
            }
            
            const timer = setTimeout(() => {
                if (this.gsapAvailable) {
                    gsap.delayedCall(0.016, () => {
                        this._updateLayerByIndexOrId(layerIndex, layerId);
                    });
                } else {
                    requestAnimationFrame(() => {
                        this._updateLayerByIndexOrId(layerIndex, layerId);
                    });
                }
                this.layerUpdateTimers.delete(throttleKey);
            }, this.layerUpdateThrottle);
            
            this.layerUpdateTimers.set(throttleKey, timer);
        });
        
        // thumbnail:layer-updated 購読
        this.eventBus.on('thumbnail:layer-updated', ({ data }) => {
            const { layerIndex, immediate } = data || {};
            
            if (immediate) {
                if (this.gsapAvailable) {
                    gsap.delayedCall(0.016, () => {
                        if (layerIndex !== undefined) {
                            this.updateLayerThumbnail(layerIndex);
                        } else {
                            this.updateAllThumbnails();
                        }
                    });
                } else {
                    requestAnimationFrame(() => {
                        if (layerIndex !== undefined) {
                            this.updateLayerThumbnail(layerIndex);
                        } else {
                            this.updateAllThumbnails();
                        }
                    });
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
    }

    _updateLayerByIndexOrId(layerIndex, layerId) {
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
    }

    createLayerElement(layer, index, isActive, animationSystem) {
        const layerDiv = document.createElement('div');
        layerDiv.className = isActive ? 'layer-item active' : 'layer-item';
        layerDiv.dataset.layerId = layer.layerData?.id || `layer-${index}`;
        layerDiv.dataset.layerIndex = index;

        // Phase 1: 背景レイヤーはドラッグ不可
        const isDraggable = !layer.layerData?.isBackground;

        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.className = 'layer-visibility-toggle';
        checkbox.checked = layer.visible !== false;
        checkbox.style.gridColumn = '1';
        checkbox.style.gridRow = '1 / 3';
        layerDiv.appendChild(checkbox);

        const nameSpan = document.createElement('span');
        nameSpan.className = 'layer-name';
        nameSpan.textContent = layer.layerData?.name || `Layer ${index}`;
        nameSpan.style.gridColumn = '2';
        nameSpan.style.gridRow = '2';
        layerDiv.appendChild(nameSpan);

        const thumbnail = this.createThumbnail(layer, index);
        layerDiv.appendChild(thumbnail);

        // Phase 1: PointerEventベースドラッグ実装
        if (isDraggable) {
            this._attachDragHandlers(layerDiv, index);
        }

        // レイヤー選択
        layerDiv.addEventListener('click', (e) => {
            if (e.target !== checkbox && !this.dragState.isDragging) {
                if (window.TegakiEventBus) {
                    window.TegakiEventBus.emit('ui:layer-selected', { 
                        layerIndex: index,
                        layerId: layer.layerData?.id
                    });
                }
            }
        });

        // 可視性トグル
        checkbox.addEventListener('change', (e) => {
            layer.visible = e.target.checked;
            if (window.TegakiEventBus) {
                window.TegakiEventBus.emit('ui:layer-visibility-changed', {
                    layerIndex: index,
                    visible: e.target.checked,
                    layerId: layer.layerData?.id
                });
            }
        });

        return layerDiv;
    }

    /**
     * Phase 1: PointerEventベースドラッグハンドラ
     */
    _attachDragHandlers(element, index) {
        element.style.cursor = 'grab';

        const onPointerDown = (e) => {
            // チェックボックスやサムネイルクリックは無視
            if (e.target.type === 'checkbox' || e.target.closest('.layer-thumbnail')) {
                return;
            }

            // 右クリック無視
            if (e.button === 2) {
                return;
            }

            this.dragState.isDragging = false;
            this.dragState.draggedElement = element;
            this.dragState.draggedIndex = index;
            this.dragState.pointerId = e.pointerId;
            this.dragState.startY = e.clientY;
            this.dragState.currentY = e.clientY;

            element.style.cursor = 'grabbing';
            
            // ポインターキャプチャ
            try {
                element.setPointerCapture(e.pointerId);
            } catch (err) {}

            e.preventDefault();
        };

        const onPointerMove = (e) => {
            if (!this.dragState.draggedElement || e.pointerId !== this.dragState.pointerId) {
                return;
            }

            this.dragState.currentY = e.clientY;
            const deltaY = this.dragState.currentY - this.dragState.startY;

            // 5pxを超えたらドラッグ開始
            if (!this.dragState.isDragging && Math.abs(deltaY) > 5) {
                this.dragState.isDragging = true;
                this._startDragVisuals(element);
            }

            if (this.dragState.isDragging) {
                this._updateDragPosition(element, deltaY);
                this._updatePlaceholderPosition(element);
            }

            e.preventDefault();
        };

        const onPointerUp = (e) => {
            if (e.pointerId !== this.dragState.pointerId) {
                return;
            }

            // ポインターキャプチャ解放
            try {
                element.releasePointerCapture(e.pointerId);
            } catch (err) {}

            if (this.dragState.isDragging) {
                this._endDrag();
            }

            element.style.cursor = 'grab';
            this.dragState.draggedElement = null;
            this.dragState.pointerId = null;

            e.preventDefault();
        };

        const onPointerCancel = (e) => {
            if (e.pointerId !== this.dragState.pointerId) {
                return;
            }

            try {
                element.releasePointerCapture(e.pointerId);
            } catch (err) {}

            if (this.dragState.isDragging) {
                this._cancelDrag();
            }

            element.style.cursor = 'grab';
            this.dragState.draggedElement = null;
            this.dragState.pointerId = null;
        };

        element.addEventListener('pointerdown', onPointerDown);
        element.addEventListener('pointermove', onPointerMove);
        element.addEventListener('pointerup', onPointerUp);
        element.addEventListener('pointercancel', onPointerCancel);
    }

    /**
     * ドラッグビジュアル開始
     */
    _startDragVisuals(element) {
        element.style.position = 'relative';
        element.style.zIndex = '1000';
        element.style.opacity = '0.8';
        element.style.pointerEvents = 'none';

        // プレースホルダー作成
        const placeholder = document.createElement('div');
        placeholder.className = 'layer-item-placeholder';
        placeholder.style.height = element.offsetHeight + 'px';
        placeholder.style.border = '2px dashed #666';
        placeholder.style.backgroundColor = 'rgba(100, 100, 100, 0.1)';
        
        element.parentNode.insertBefore(placeholder, element);
        this.dragState.placeholder = placeholder;
    }

    /**
     * ドラッグ位置更新
     */
    _updateDragPosition(element, deltaY) {
        element.style.transform = `translateY(${deltaY}px)`;
    }

    /**
     * プレースホルダー位置更新
     */
    _updatePlaceholderPosition(draggedElement) {
        const rect = draggedElement.getBoundingClientRect();
        const centerY = rect.top + rect.height / 2;

        const items = Array.from(this.container.children).filter(
            el => el !== draggedElement && el !== this.dragState.placeholder && el.classList.contains('layer-item')
        );

        let newIndex = this.dragState.draggedIndex;

        for (let i = 0; i < items.length; i++) {
            const itemRect = items[i].getBoundingClientRect();
            const itemCenterY = itemRect.top + itemRect.height / 2;

            if (centerY < itemCenterY) {
                newIndex = parseInt(items[i].dataset.layerIndex);
                break;
            }
        }

        // プレースホルダー移動
        if (this.dragState.placeholder && newIndex !== this.dragState.draggedIndex) {
            const targetElement = this.container.querySelector(`[data-layer-index="${newIndex}"]`);
            if (targetElement) {
                this.container.insertBefore(this.dragState.placeholder, targetElement);
            }
        }
    }

    /**
     * ドラッグ終了
     */
    _endDrag() {
        const draggedElement = this.dragState.draggedElement;
        const placeholder = this.dragState.placeholder;

        if (!draggedElement || !placeholder) {
            this._cancelDrag();
            return;
        }

        // 新しいインデックスを計算
        const allItems = Array.from(this.container.children).filter(
            el => el.classList.contains('layer-item') || el.classList.contains('layer-item-placeholder')
        );
        
        const newIndex = allItems.indexOf(placeholder);
        const oldIndex = this.dragState.draggedIndex;

        // スタイルリセット
        draggedElement.style.transform = '';
        draggedElement.style.position = '';
        draggedElement.style.zIndex = '';
        draggedElement.style.opacity = '';
        draggedElement.style.pointerEvents = '';

        // プレースホルダーを要素に置き換え
        placeholder.parentNode.replaceChild(draggedElement, placeholder);

        // レイヤーシステムに通知
        if (newIndex !== oldIndex && this.layerSystem?.reorderLayers) {
            // 逆順インデックスに変換（レイヤーリストは下から上）
            const layerCount = this.container.querySelectorAll('.layer-item').length;
            const actualOldIndex = layerCount - 1 - oldIndex;
            const actualNewIndex = layerCount - 1 - newIndex;
            
            this.layerSystem.reorderLayers(actualOldIndex, actualNewIndex);
        }

        this.dragState.isDragging = false;
        this.dragState.placeholder = null;
    }

    /**
     * ドラッグキャンセル
     */
    _cancelDrag() {
        const draggedElement = this.dragState.draggedElement;
        const placeholder = this.dragState.placeholder;

        if (draggedElement) {
            draggedElement.style.transform = '';
            draggedElement.style.position = '';
            draggedElement.style.zIndex = '';
            draggedElement.style.opacity = '';
            draggedElement.style.pointerEvents = '';
        }

        if (placeholder && placeholder.parentNode) {
            placeholder.parentNode.removeChild(placeholder);
        }

        this.dragState.isDragging = false;
        this.dragState.placeholder = null;
    }

    createThumbnail(layer, index) {
        const thumbnail = document.createElement('div');
        thumbnail.className = 'layer-thumbnail';
        thumbnail.style.gridColumn = '3';
        thumbnail.style.gridRow = '1 / 3';
        thumbnail.dataset.layerIndex = index;

        if (layer.layerData?.isBackground) {
            const swatch = document.createElement('div');
            swatch.style.width = '100%';
            swatch.style.height = '100%';
            swatch.style.backgroundColor = '#F0E0D6';
            thumbnail.appendChild(swatch);
            return thumbnail;
        }

        const img = document.createElement('img');
        img.alt = 'Layer thumbnail';
        img.style.width = '100%';
        img.style.height = '100%';
        img.style.objectFit = 'contain';
        img.style.display = 'none';
        img.dataset.layerIndex = index;

        thumbnail.appendChild(img);
        this._generateAndDisplayThumbnail(layer, index, img);

        return thumbnail;
    }

    async _generateAndDisplayThumbnail(layer, index, img) {
        try {
            if (!window.ThumbnailSystem) return;

            const bitmap = await window.ThumbnailSystem.generateLayerThumbnail(layer, 64, 64);
            if (!bitmap) return;

            const dataURL = window.ThumbnailSystem.canvasToDataURL(bitmap);
            if (dataURL) {
                img.src = dataURL;
                img.style.display = 'block';
            }
        } catch (error) {
            console.error(`Layer thumbnail generation failed for index ${index}:`, error);
        }
    }

    async updateLayerThumbnail(layerIndex) {
        if (!this.container) return;
        
        const layers = this.layerSystem?.getLayers?.();
        if (!layers || !layers[layerIndex]) return;

        const layer = layers[layerIndex];
        
        if (window.ThumbnailSystem && layer.layerData?.id) {
            window.ThumbnailSystem._invalidateLayerCacheByLayerId(layer.layerData.id);
        }
        
        const layerDiv = this.container.querySelector(
            `.layer-item[data-layer-index="${layerIndex}"]`
        );

        if (!layerDiv) return;

        const thumbnail = layerDiv.querySelector('.layer-thumbnail');
        const img = thumbnail?.querySelector('img');
        
        if (!img) return;

        await this._generateAndDisplayThumbnail(layer, layerIndex, img);
    }

    async updateAllThumbnails() {
        if (!this.container) return;
        
        const layers = this.layerSystem?.getLayers?.();
        if (!layers) return;

        if (window.ThumbnailSystem) {
            window.ThumbnailSystem.clearAllCache();
        }

        for (let i = 0; i < layers.length; i++) {
            await this.updateLayerThumbnail(i);
            if (i < layers.length - 1) {
                await new Promise(resolve => setTimeout(resolve, 10));
            }
        }
    }

    destroy() {
        for (const timer of this.layerUpdateTimers.values()) {
            clearTimeout(timer);
        }
        this.layerUpdateTimers.clear();
        this.thumbnailCanvases.clear();
    }
};

console.log('✅ ui/layer-panel-renderer.js (Phase 1: タブレットペン完全対応版) loaded');
console.log('   ✓ PointerEvent ベース実装（Sortable.js 不要）');
console.log('   ✓ タブレットペン・タッチ・マウス全対応');
console.log('   ✓ setPointerCapture/releasePointerCapture 実装');
console.log('   ✓ ドラッグ中のビジュアルフィードバック');
console.log('   ✓ 背景レイヤードラッグ防止');