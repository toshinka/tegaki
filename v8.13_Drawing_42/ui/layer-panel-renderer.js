// ===== ui/layer-panel-renderer.js - サムネイル即座更新対応版 =====
// 責務: レイヤーパネルのDOM操作専用
// 規則: ロジック(layerSystem)とUI(DOM)を完全分離
// 修正: リアルタイムサムネイル更新機能追加

window.TegakiUI = window.TegakiUI || {};

window.TegakiUI.LayerPanelRenderer = class {
    constructor() {
        this.container = null;
        this.animationSystem = null;
        this.layerSystem = null;
        this.eventBus = window.TegakiEventBus;
        
        this._setupEventListeners();
    }

    init(container, layerSystem, animationSystem) {
        this.container = container || document.getElementById('layer-list');
        this.layerSystem = layerSystem;
        this.animationSystem = animationSystem;
        
        if (!this.container) {
            throw new Error('Layer panel container not found');
        }
    }
    
    _setupEventListeners() {
        if (!this.eventBus) return;
        
        this.eventBus.on('layer:thumbnails-need-update', () => {
            this.updateAllThumbnails();
        });
        
        this.eventBus.on('layer:path-added', () => {
            setTimeout(() => {
                this.updateAllThumbnails();
            }, 50);
        });
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

        const thumbnail = this.createThumbnail(layer, animationSystem);
        layerDiv.appendChild(thumbnail);

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

    createThumbnail(layer, animationSystem) {
        const thumbnail = document.createElement('div');
        thumbnail.className = 'layer-thumbnail';
        thumbnail.style.gridColumn = '3';
        thumbnail.style.gridRow = '1 / 3';

        if (layer.layerData?.isBackground) {
            const swatch = document.createElement('div');
            swatch.style.width = '100%';
            swatch.style.height = '100%';
            swatch.style.backgroundColor = '#F0E0D6';
            thumbnail.appendChild(swatch);
            return thumbnail;
        }

        const canvas = this.generateLayerThumbnailCanvas(layer);
        if (canvas) {
            const img = document.createElement('img');
            img.src = canvas.toDataURL('image/png');
            img.alt = 'Layer thumbnail';
            img.style.width = '100%';
            img.style.height = '100%';
            img.style.objectFit = 'contain';
            thumbnail.appendChild(img);
        }

        return thumbnail;
    }

    generateLayerThumbnailCanvas(layer) {
        if (!layer || !layer.layerData) return null;
        
        const paths = layer.layerData.paths;
        if (!paths || paths.length === 0) return null;
        
        const canvasWidth = window.TEGAKI_CONFIG?.canvas?.width || 800;
        const canvasHeight = window.TEGAKI_CONFIG?.canvas?.height || 600;
        
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        
        paths.forEach(path => {
            if (!path.points || path.points.length === 0) return;
            path.points.forEach(point => {
                if (point.x < minX) minX = point.x;
                if (point.y < minY) minY = point.y;
                if (point.x > maxX) maxX = point.x;
                if (point.y > maxY) maxY = point.y;
            });
        });
        
        if (!isFinite(minX) || !isFinite(minY) || !isFinite(maxX) || !isFinite(maxY)) {
            return null;
        }
        
        const padding = 10;
        minX = Math.max(0, minX - padding);
        minY = Math.max(0, minY - padding);
        maxX = Math.min(canvasWidth, maxX + padding);
        maxY = Math.min(canvasHeight, maxY + padding);
        
        const contentWidth = maxX - minX;
        const contentHeight = maxY - minY;
        
        if (contentWidth <= 0 || contentHeight <= 0) return null;
        
        const thumbSize = 64;
        const scale = Math.min(thumbSize / contentWidth, thumbSize / contentHeight);
        
        const canvas = document.createElement('canvas');
        canvas.width = thumbSize;
        canvas.height = thumbSize;
        const ctx = canvas.getContext('2d');
        
        ctx.clearRect(0, 0, thumbSize, thumbSize);
        
        const offsetX = (thumbSize - contentWidth * scale) / 2;
        const offsetY = (thumbSize - contentHeight * scale) / 2;
        
        paths.forEach(path => {
            if (!path.points || path.points.length === 0) return;
            
            const color = path.color || 0x800000;
            const r = (color >> 16) & 0xFF;
            const g = (color >> 8) & 0xFF;
            const b = color & 0xFF;
            const opacity = path.opacity || 1.0;
            
            ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${opacity})`;
            
            path.points.forEach(point => {
                const x = (point.x - minX) * scale + offsetX;
                const y = (point.y - minY) * scale + offsetY;
                const radius = (path.size || 16) * scale / 2;
                
                ctx.beginPath();
                ctx.arc(x, y, Math.max(1, radius), 0, Math.PI * 2);
                ctx.fill();
            });
        });
        
        return canvas;
    }

    getCanvasFromTexture(renderTexture) {
        try {
            if (!window.coreEngine?.app?.renderer) return null;
            
            const renderer = window.coreEngine.app.renderer;
            return renderer.extract?.canvas(renderTexture) || null;
        } catch (error) {
            return null;
        }
    }

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

    setActiveLayer(index) {
        if (!this.container) return;

        this.container.querySelectorAll('.layer-item').forEach((item, i) => {
            item.classList.toggle('active', i === index);
        });
    }

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
                    const content = newThumb.firstChild;
                    if (content) {
                        thumbnail.appendChild(content);
                    }
                }
            }
        }
    }

    updateAllThumbnails() {
        if (!this.container || !this.layerSystem) return;

        const items = this.container.querySelectorAll('.layer-item');
        const layers = this.layerSystem.getLayers();
        
        items.forEach((item, index) => {
            if (index >= layers.length) return;
            
            const layer = layers[index];
            const thumbnail = item.querySelector('.layer-thumbnail');
            
            if (thumbnail && layer) {
                thumbnail.innerHTML = '';
                const newThumb = this.createThumbnail(layer, this.animationSystem);
                const content = newThumb.firstChild;
                if (content) {
                    thumbnail.appendChild(content);
                }
            }
        });
    }

    updateAll(layers, activeIndex, animationSystem = null) {
        this.render(layers, activeIndex, animationSystem || this.animationSystem);
    }

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

    removeLayer(index) {
        if (!this.container) return;

        const items = this.container.querySelectorAll('.layer-item');
        if (index >= 0 && index < items.length) {
            items[index].remove();
        }

        this.initializeSortable();
    }

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

console.log('✅ layer-panel-renderer.js (サムネイル即座更新対応版) loaded');