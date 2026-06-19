// ===== ui/layer-panel-renderer.js - Phase4 =====
// 責務: レイヤーパネルのDOM操作専用
// 規則: ロジック(layerSystem)とUI(DOM)を完全分離

window.TegakiUI = window.TegakiUI || {};

window.TegakiUI.LayerPanelRenderer = class {
    constructor() {
        this.container = null;
        this.animationSystem = null;
        this.layerSystem = null;
    }

    init(container, layerSystem, animationSystem) {
        this.container = container || document.getElementById('layer-list');
        this.layerSystem = layerSystem;
        this.animationSystem = animationSystem;
        
        if (!this.container) {
            throw new Error('Layer panel container not found');
        }
    }

    /**
     * レイヤーパネル全体をレンダリング
     */
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

    /**
     * 個別レイヤーアイテムを作成
     */
    createLayerElement(layer, index, isActive, animationSystem) {
        const layerDiv = document.createElement('div');
        layerDiv.className = isActive ? 'layer-item active' : 'layer-item';
        layerDiv.dataset.layerId = layer.layerData?.id || `layer-${index}`;

        // チェックボックス（表示/非表示）
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

        // サムネイル
        const thumbnail = this.createThumbnail(layer, animationSystem);
        layerDiv.appendChild(thumbnail);

        // アクティブレイヤーの選択リスナー
        layerDiv.addEventListener('click', (e) => {
            if (e.target !== checkbox) {
                if (window.TegakiEventBus) {
                    window.TegakiEventBus.emit('ui:layer-selected', { 
                        layerIndex: index,
                        layerId: layer.layerData?.id
                    });
                }
            }
        });

        // 表示/非表示トグル
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
     * レイヤーサムネイルを作成
     */
    createThumbnail(layer, animationSystem) {
        const thumbnail = document.createElement('div');
        thumbnail.className = 'layer-thumbnail';
        thumbnail.style.gridColumn = '3';
        thumbnail.style.gridRow = '1 / 3';

        if (layer.layerData?.renderTexture) {
            const canvas = this.getCanvasFromTexture(layer.layerData.renderTexture);
            if (canvas) {
                const img = document.createElement('img');
                img.src = canvas.toDataURL('image/png');
                img.alt = 'Layer thumbnail';
                thumbnail.appendChild(img);
            }
        } else if (layer.layerData?.isBackground) {
            const swatch = document.createElement('div');
            swatch.style.width = '100%';
            swatch.style.height = '100%';
            swatch.style.backgroundColor = '#F0E0D6';
            thumbnail.appendChild(swatch);
        }

        return thumbnail;
    }

    /**
     * Textureからcanvasを抽出
     */
    getCanvasFromTexture(renderTexture) {
        try {
            if (!window.coreEngine?.app?.renderer) return null;
            
            const renderer = window.coreEngine.app.renderer;
            return renderer.extract?.canvas(renderTexture) || null;
        } catch (error) {
            return null;
        }
    }

    /**
     * Sortable.jsの初期化
     */
    initializeSortable() {
        if (!this.container || typeof Sortable === 'undefined') return;
        
        if (this.container.sortableInstance) {
            this.container.sortableInstance.destroy();
            this.container.sortableInstance = null;
        }
        
        if (!this.layerSystem) return;

        this.container.sortableInstance = Sortable.create(this.container, {
            animation: 150,
            ghostClass: 'sortable-ghost',
            chosenClass: 'sortable-chosen',
            handle: '.layer-item',
            onEnd: (evt) => {
                if (window.TegakiEventBus) {
                    window.TegakiEventBus.emit('ui:layer-reorder-requested', {
                        fromIndex: evt.oldIndex,
                        toIndex: evt.newIndex
                    });
                }
            }
        });
    }

    /**
     * 指定インデックスのレイヤーをアクティブ化
     */
    setActiveLayer(index) {
        if (!this.container) return;

        this.container.querySelectorAll('.layer-item').forEach((item, i) => {
            item.classList.toggle('active', i === index);
        });
    }

    /**
     * レイヤーサムネイル更新
     */
    updateThumbnail(index) {
        if (!this.container || !this.layerSystem) return;

        const items = this.container.querySelectorAll('.layer-item');
        if (index >= 0 && index < items.length) {
            const layer = this.layerSystem.getLayers()[index];
            if (layer) {
                const thumbnail = items[index].querySelector('.layer-thumbnail');
                if (thumbnail) {
                    thumbnail.innerHTML = '';
                    const newThumb = this.createThumbnail(layer, this.animationSystem);
                    const img = newThumb.querySelector('img');
                    if (img) {
                        thumbnail.appendChild(img);
                    }
                }
            }
        }
    }

    /**
     * 全レイヤー情報更新
     */
    updateAll(layers, activeIndex, animationSystem = null) {
        this.render(layers, activeIndex, animationSystem || this.animationSystem);
    }

    /**
     * レイヤー追加時のDOM更新
     */
    addLayer(layer, index, isActive) {
        if (!this.container) return;

        const layerElement = this.createLayerElement(
            layer,
            index,
            isActive,
            this.animationSystem
        );
        
        this.container.insertBefore(layerElement, this.container.firstChild);
        this.initializeSortable();
    }

    /**
     * レイヤー削除時のDOM更新
     */
    removeLayer(index) {
        if (!this.container) return;

        const items = this.container.querySelectorAll('.layer-item');
        if (index >= 0 && index < items.length) {
            items[index].remove();
        }

        this.initializeSortable();
    }

    /**
     * レイヤー名更新
     */
    updateLayerName(index, newName) {
        if (!this.container) return;

        const items = this.container.querySelectorAll('.layer-item');
        if (index >= 0 && index < items.length) {
            const nameSpan = items[index].querySelector('.layer-name');
            if (nameSpan) {
                nameSpan.textContent = newName;
            }
        }
    }
};