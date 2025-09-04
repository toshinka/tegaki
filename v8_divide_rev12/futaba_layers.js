/**
 * 🎨 ふたば☆ちゃんねる風ベクターお絵かきツール - レイヤーシステム
 * AIが把握しやすいレイヤー管理専用モジュール
 */

// ==== LayerSystem: レイヤー管理の責務を集約 ====
class LayerSystem {
    constructor(bridge) {
        this.bridge = bridge;
        this.layers = new Map();
        this.layerOrder = [];
        this.activeLayerId = null;
        this.nextLayerId = 1;
        this.undoStack = [];
        this.ui = null;
    }
    
    // === 基本レイヤー操作 ===
    createLayer(options = {}) {
        const { name = null, isBackground = false, opacity = 1.0 } = options;
        const layerId = isBackground ? 0 : this.nextLayerId++;
        const layerName = name || `レイヤー${layerId}`;
        
        const layer = this.buildLayer(layerId, layerName, isBackground, opacity);
        this.registerLayer(layer, isBackground);
        
        if (this.activeLayerId === null || !isBackground) {
            this.activeLayerId = layerId;
        }
        
        this.updateDisplay();
        return layer;
    }
    
    buildLayer(layerId, layerName, isBackground, opacity) {
        const container = new PIXI.Container();
        container.name = layerName;
        container.visible = true;
        container.alpha = opacity;
        
        if (isBackground) {
            const backgroundGraphics = new PIXI.Graphics();
            backgroundGraphics.rect(0, 0, window.APP_CONFIG.canvas.width, window.APP_CONFIG.canvas.height);
            backgroundGraphics.fill(0xf0e0d6);
            container.addChild(backgroundGraphics);
        }
        
        return {
            id: layerId,
            name: layerName,
            container: container,
            visible: "open",
            opacity: opacity,
            isBackground: isBackground,
            paths: []
        };
    }
    
    registerLayer(layer, isBackground) {
        this.layers.set(layer.id, layer);
        
        if (isBackground) {
            this.layerOrder.unshift(layer.id);
        } else {
            this.layerOrder.push(layer.id);
        }
        
        this.bridge.addContainer(layer.container);
        this.reorderContainers();
    }
    
    deleteLayer(layerId, recordUndo = true) {
        if (layerId === 0 || this.layers.size <= 1) return;
        
        const layer = this.layers.get(layerId);
        if (!layer) return;
        
        if (recordUndo) {
            this.recordUndo('delete', layer);
        }
        
        this.destroyLayer(layer);
        this.adjustActiveLayer(layerId);
        this.updateDisplay();
    }
    
    destroyLayer(layer) {
        layer.paths.forEach(path => path.graphics.destroy());
        this.bridge.removeContainer(layer.container);
        
        const orderIndex = this.layerOrder.indexOf(layer.id);
        if (orderIndex !== -1) {
            this.layerOrder.splice(orderIndex, 1);
        }
        
        this.layers.delete(layer.id);
    }
    
    adjustActiveLayer(deletedLayerId) {
        if (this.activeLayerId === deletedLayerId) {
            const orderIndex = this.layerOrder.indexOf(deletedLayerId);
            const newActiveIndex = Math.max(0, orderIndex - 1);
            this.activeLayerId = this.layerOrder[newActiveIndex];
        }
    }
    
    // === レイヤー状態管理 ===
    setActiveLayer(layerId) {
        if (this.layers.has(layerId)) {
            this.activeLayerId = layerId;
            this.updateDisplay();
        }
    }
    
    toggleLayerVisibility(layerId) {
        const layer = this.layers.get(layerId);
        if (!layer) return;
        
        const states = ["open", "closed", "disabled"];
        const currentIndex = states.indexOf(layer.visible);
        const nextIndex = (currentIndex + 1) % states.length;
        layer.visible = states[nextIndex];
        
        this.updateContainerVisibility(layer);
        this.updateDisplay();
    }
    
    updateContainerVisibility(layer) {
        layer.container.visible = (layer.visible === "open");
        layer.container.alpha = layer.visible === "disabled" ? 0.3 : layer.opacity;
    }
    
    setLayerOpacity(layerId, opacity) {
        const layer = this.layers.get(layerId);
        if (!layer) return;
        
        layer.opacity = Math.max(0, Math.min(1, opacity));
        layer.container.alpha = layer.visible === "disabled" ? 0.3 : layer.opacity;
        this.updateDisplay();
    }
    
    // === 高度なレイヤー操作 ===
    duplicateLayer(layerId) {
        const sourceLayer = this.layers.get(layerId);
        if (!sourceLayer) return null;
        
        const newLayer = this.createLayer({ 
            name: `${sourceLayer.name} コピー`,
            opacity: sourceLayer.opacity
        });
        
        this.copyPaths(sourceLayer, newLayer);
        this.setActiveLayer(newLayer.id);
        
        return newLayer;
    }
    
    copyPaths(sourceLayer, targetLayer) {
        sourceLayer.paths.forEach(path => {
            const clonedPath = this.clonePath(path);
            targetLayer.container.addChild(clonedPath.graphics);
            targetLayer.paths.push(clonedPath);
        });
    }
    
    clonePath(originalPath) {
        const clonedGraphics = new PIXI.Graphics();
        
        originalPath.points.forEach(point => {
            clonedGraphics.circle(point.x, point.y, point.size / 2);
            clonedGraphics.fill({ 
                color: originalPath.color, 
                alpha: originalPath.opacity 
            });
        });
        
        return {
            id: `path_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            graphics: clonedGraphics,
            points: [...originalPath.points],
            color: originalPath.color,
            size: originalPath.size,
            opacity: originalPath.opacity,
            isComplete: originalPath.isComplete
        };
    }
    
    mergeLayerDown(layerId) {
        const layer = this.layers.get(layerId);
        const layerIndex = this.layerOrder.indexOf(layerId);
        
        if (!layer || layerIndex <= 0) return false;
        
        const belowLayerId = this.layerOrder[layerIndex - 1];
        const belowLayer = this.layers.get(belowLayerId);
        
        if (!belowLayer) return false;
        
        this.movePaths(layer, belowLayer);
        this.deleteLayer(layerId, false);
        
        return true;
    }
    
    movePaths(fromLayer, toLayer) {
        fromLayer.paths.forEach(path => {
            toLayer.container.addChild(path.graphics);
            toLayer.paths.push(path);
        });
    }
    
    // === コンテナ管理 ===
    reorderContainers() {
        this.layerOrder.forEach((layerId, index) => {
            const layer = this.layers.get(layerId);
            if (layer) {
                this.bridge.reorderContainer(layer.container, index);
            }
        });
    }
    
    // === 描画統合 ===
    addPathToActiveLayer(path) {
        const activeLayer = this.getActiveLayer();
        if (activeLayer) {
            activeLayer.paths.push(path);
            activeLayer.container.addChild(path.graphics);
        }
    }
    
    getActiveLayer() {
        return this.layers.get(this.activeLayerId);
    }
    
    clearAllLayers() {
        this.layers.forEach(layer => {
            layer.paths = [];
            layer.container.removeChildren();
        });
    }
    
    // === UNDO系統 ===
    recordUndo(type, layer) {
        this.undoStack.push({
            type: type,
            layer: this.serializeLayer(layer),
            order: this.layerOrder.indexOf(layer.id),
            timestamp: Date.now()
        });
        
        if (this.ui) {
            this.ui.showUndoNotification('レイヤーを削除しました');
        }
    }
    
    serializeLayer(layer) {
        return {
            id: layer.id,
            name: layer.name,
            visible: layer.visible,
            opacity: layer.opacity,
            isBackground: layer.isBackground,
            paths: layer.paths.map(path => this.serializePath(path))
        };
    }
    
    serializePath(path) {
        return {
            id: path.id,
            points: [...path.points],
            color: path.color,
            size: path.size,
            opacity: path.opacity,
            isComplete: path.isComplete
        };
    }
    
    // === 表示更新 ===
    updateDisplay() {
        if (this.ui) {
            this.ui.updateLayerUI();
            this.ui.updateStatusDisplay();
        }
        this.updateCheckerboard();
    }
    
    updateCheckerboard() {
        const backgroundLayer = this.layers.get(0);
        const shouldShow = !backgroundLayer || 
                           backgroundLayer.visible !== "open" || 
                           backgroundLayer.opacity < 1.0;
        
        const overlay = document.querySelector('.checkerboard-overlay');
        if (overlay) {
            overlay.style.opacity = shouldShow ? '1' : '0';
        }
    }
}

// ==== LayerUI: UI表示専用クラス ====
class LayerUI {
    constructor(layerSystem) {
        this.layers = layerSystem;
        this.popup = null;
        this.sliders = new Map();
    }
    
    initialize() {
        this.layers.ui = this;
        this.setupControls();
        this.setupPopup();
        this.updateLayerUI();
    }
    
    setupControls() {
        const addLayerBtn = document.getElementById('add-layer-btn');
        const addFileBtn = document.getElementById('add-file-btn');
        
        if (addLayerBtn) {
            // copy-plusアイコンに更新
            addLayerBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#800000" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-copy-plus-icon lucide-copy-plus"><line x1="15" x2="15" y1="12" y2="18"/><line x1="12" x2="18" y1="15" y2="15"/><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>`;
            addLayerBtn.addEventListener('click', () => {
                const newLayer = this.layers.createLayer({ opacity: 1.0 });
                this.layers.setActiveLayer(newLayer.id);
            });
        }
        
        if (addFileBtn) {
            // folder-plusアイコンに更新
            addFileBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#800000" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-folder-plus-icon lucide-folder-plus"><path d="M12 10v6"/><path d="M9 13h6"/><path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z"/></svg>`;
            addFileBtn.addEventListener('click', () => {
                console.log('📁 File adding feature - coming soon');
            });
        }
    }
    
    setupPopup() {
        this.popup = document.getElementById('layer-popup');
        if (!this.popup) return;
        
        this.createOpacitySlider();
        this.setupPopupButtons();
        this.setupPopupEvents();
    }
    
    createOpacitySlider() {
        this.createSlider('layer-opacity-slider', 0, 100, 100, (value) => {
            const currentLayerId = parseInt(this.popup.dataset.layerId);
            if (currentLayerId) {
                this.layers.setLayerOpacity(currentLayerId, value / 100);
            }
            return Math.round(value) + '%';
        });
    }
    
    setupPopupButtons() {
        const mergeBtn = document.getElementById('merge-layer-btn');
        const duplicateBtn = document.getElementById('duplicate-layer-btn');
        
        if (mergeBtn) {
            mergeBtn.addEventListener('click', () => {
                const currentLayerId = parseInt(this.popup.dataset.layerId);
                if (currentLayerId) {
                    this.layers.mergeLayerDown(currentLayerId);
                    this.hideLayerPopup();
                }
            });
        }
        
        if (duplicateBtn) {
            duplicateBtn.addEventListener('click', () => {
                const currentLayerId = parseInt(this.popup.dataset.layerId);
                if (currentLayerId) {
                    this.layers.duplicateLayer(currentLayerId);
                    this.hideLayerPopup();
                }
            });
        }
    }
    
    setupPopupEvents() {
        document.addEventListener('click', (e) => {
            if (this.popup.classList.contains('show') && 
                !this.popup.contains(e.target) && 
                !e.target.closest('.layer-item')) {
                this.hideLayerPopup();
            }
        });
    }
    
    updateLayerUI() {
        const layerList = document.getElementById('layer-list');
        if (!layerList) return;
        
        layerList.innerHTML = '';
        
        const displayOrder = [...this.layers.layerOrder].reverse();
        this.adjustLayerPanelHeight(displayOrder.length);
        
        displayOrder.forEach((layerId, index) => {
            const layer = this.layers.layers.get(layerId);
            const layerItem = this.createLayerItem(layer, index);
            layerList.appendChild(layerItem);
        });
    }
    
    createLayerItem(layer, index) {
        const layerItem = document.createElement('div');
        layerItem.className = `layer-item ${layer.id === this.layers.activeLayerId ? 'active' : ''}`;
        layerItem.dataset.layerId = layer.id;
        layerItem.dataset.layerIndex = index;
        
        const eyeIcon = this.getVisibilityIcon(layer.visible);
        
        layerItem.innerHTML = `
            <div class="layer-visibility ${layer.visible}" data-action="toggle-visibility">
                ${eyeIcon}
            </div>
            <div class="layer-name">${layer.name}</div>
            <div class="layer-opacity">${Math.round(layer.opacity * 100)}%</div>
        `;
        
        this.setupLayerItemEvents(layerItem, layer.id);
        return layerItem;
    }
    
    setupLayerItemEvents(layerItem, layerId) {
        layerItem.addEventListener('click', (e) => {
            const action = e.target.closest('[data-action]')?.dataset.action;
            if (action === 'toggle-visibility') {
                this.layers.toggleLayerVisibility(layerId);
            } else {
                this.layers.setActiveLayer(layerId);
            }
        });
        
        layerItem.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            this.showLayerPopup(layerId, e.clientX, e.clientY);
        });
        
        if (layerId !== 0) {
            this.setupLayerSwipe(layerItem, layerId);
        }
    }
    
    getVisibilityIcon(state) {
        const icons = {
            open: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#800000" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-eye-icon lucide-eye"><path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0"/><circle cx="12" cy="12" r="3"/></svg>`,
            closed: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#800000" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-eye-icon lucide-eye"><path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0"/><circle cx="12" cy="12" r="3" fill="#800000"/></svg>`,
            disabled: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#800000" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-eye-off-icon lucide-eye-off"><path d="M10.733 5.076a10.744 10.744 0 0 1 11.205 6.575 1 1 0 0 1 0 .696 10.747 10.747 0 0 1-1.444 2.49"/><path d="M14.084 14.158a3 3 0 0 1-4.242-4.242"/><path d="M17.479 17.499a10.75 10.75 0 0 1-15.417-5.151 1 1 0 0 1 0-.696 10.75 10.75 0 0 1 4.446-5.143"/><path d="m2 2 20 20"/></svg>`
        };
        return icons[state] || icons.open;
    }
    
    adjustLayerPanelHeight(layerCount) {
        const panel = document.getElementById('layer-panel');
        const layerList = document.getElementById('layer-list');
        if (!panel || !layerList) return;
        
        const itemHeight = 30;
        const headerHeight = 36;
        const padding = 12;
        const maxViewportHeight = Math.min(window.innerHeight * 0.8, 600);
        
        const requiredHeight = headerHeight + (layerCount * itemHeight) + padding;
        const finalHeight = Math.min(requiredHeight, maxViewportHeight);
        
        panel.style.height = finalHeight + 'px';
        layerList.style.maxHeight = (finalHeight - headerHeight - padding) + 'px';
        layerList.style.overflowY = requiredHeight > maxViewportHeight ? 'auto' : 'visible';
        
        if (parseInt(panel.style.top) + finalHeight > window.innerHeight - 20) {
            const newTop = Math.max(20, window.innerHeight - finalHeight - 20);
            panel.style.top = newTop + 'px';
        }
    }
    
    setupLayerSwipe(layerItem, layerId) {
        let startX = 0, currentX = 0, isDragging = false;
        const swipeThreshold = 80;
        
        const onPointerStart = (e) => {
            if (e.target.closest('[data-action]')) return;
            startX = currentX = e.clientX;
            isDragging = true;
            layerItem.style.transition = 'none';
            e.preventDefault();
        };
        
        const onPointerMove = (e) => {
            if (!isDragging) return;
            currentX = e.clientX;
            const deltaX = currentX - startX;
            
            if (Math.abs(deltaX) > 10) {
                layerItem.style.transform = `translateX(${deltaX}px)`;
                layerItem.classList.toggle('swipe-right', deltaX > swipeThreshold);
                layerItem.classList.toggle('swipe-left', deltaX < -swipeThreshold);
            }
        };
        
        const onPointerEnd = () => {
            if (!isDragging) return;
            isDragging = false;
            layerItem.style.transition = '';
            
            const deltaX = currentX - startX;
            
            if (Math.abs(deltaX) > swipeThreshold) {
                layerItem.style.transform = `translateX(${deltaX > 0 ? '100%' : '-100%'})`;
                layerItem.style.opacity = '0';
                setTimeout(() => this.layers.deleteLayer(layerId), 200);
            } else {
                layerItem.style.transform = '';
                layerItem.classList.remove('swipe-right', 'swipe-left');
            }
        };
        
        layerItem.addEventListener('pointerdown', onPointerStart);
        document.addEventListener('pointermove', onPointerMove);
        document.addEventListener('pointerup', onPointerEnd);
        document.addEventListener('pointercancel', onPointerEnd);
    }
    
    showLayerPopup(layerId, x, y) {
        if (!this.popup) return;
        
        const layer = this.layers.layers.get(layerId);
        if (!layer) return;
        
        const maxX = window.innerWidth - 240;
        const maxY = window.innerHeight - 200;
        
        this.popup.style.left = Math.min(x, maxX) + 'px';
        this.popup.style.top = Math.min(y, maxY) + 'px';
        this.popup.dataset.layerId = layerId;
        
        const title = this.popup.querySelector('.popup-title');
        if (title) {
            title.textContent = `${layer.name} の設定`;
        }
        
        this.updateOpacitySlider(layer.opacity * 100);
        this.updateMergeButton(layerId);
        
        this.popup.classList.add('show');
    }
    
    updateOpacitySlider(value) {
        const slider = this.sliders.get('layer-opacity-slider');
        if (slider) {
            const percentage = value;
            slider.track.style.width = percentage + '%';
            slider.handle.style.left = percentage + '%';
            slider.valueDisplay.textContent = Math.round(value) + '%';
            slider.value = value;
        }
    }
    
    updateMergeButton(layerId) {
        const mergeBtn = document.getElementById('merge-layer-btn');
        if (mergeBtn) {
            const canMerge = this.layers.layerOrder.indexOf(layerId) > 0;
            mergeBtn.style.opacity = canMerge ? '1' : '0.5';
            mergeBtn.style.pointerEvents = canMerge ? 'auto' : 'none';
        }
    }
    
    hideLayerPopup() {
        if (this.popup) {
            this.popup.classList.remove('show');
            delete this.popup.dataset.layerId;
        }
    }
    
    createSlider(sliderId, min, max, initial, callback) {
        const container = document.getElementById(sliderId);
        if (!container) return;
        
        const track = container.querySelector('.slider-track');
        const handle = container.querySelector('.slider-handle');
        const valueDisplay = container.parentNode.querySelector('.slider-value');
        
        if (!track || !handle || !valueDisplay) return;
        
        const slider = {
            value: initial, min, max, callback, track, handle, valueDisplay, dragging: false
        };
        
        this.sliders.set(sliderId, slider);
        
        const update = (value) => {
            slider.value = Math.max(min, Math.min(max, value));
            const percentage = ((slider.value - min) / (max - min)) * 100;
            
            track.style.width = percentage + '%';
            handle.style.left = percentage + '%';
            valueDisplay.textContent = callback(slider.value);
        };
        
        const getValue = (clientX) => {
            const rect = container.getBoundingClientRect();
            const percentage = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
            return min + (percentage * (max - min));
        };
        
        container.addEventListener('mousedown', (e) => {
            slider.dragging = true;
            update(getValue(e.clientX));
            e.preventDefault();
        });
        
        document.addEventListener('mousemove', (e) => {
            if (slider.dragging) update(getValue(e.clientX));
        });
        
        document.addEventListener('mouseup', () => {
            slider.dragging = false;
        });
        
        update(initial);
    }
    
    updateStatusDisplay() {
        const activeLayer = this.layers.getActiveLayer();
        const element = document.getElementById('current-layer');
        if (element && activeLayer) {
            element.textContent = activeLayer.name;
        }
    }
    
    showUndoNotification(message) {
        const notification = document.getElementById('undo-notification');
        if (notification) {
            notification.textContent = message;
            notification.classList.add('show');
            setTimeout(() => {
                notification.classList.remove('show');
            }, 3000);
        }
    }
}

// ==== LayerBridge: 主星との通信インターフェース ====
class LayerBridge {
    constructor(drawingEngine) {
        this.engine = drawingEngine;
        this.layerSystem = null;
    }
    
    initializeLayerSystem() {
        this.layerSystem = new LayerSystem(this);
        const layerUI = new LayerUI(this.layerSystem);
        
        // 背景レイヤー作成（初期アクティブはレイヤー1）
        this.layerSystem.createLayer({ name: '背景', isBackground: true, opacity: 1.0 });
        const layer1 = this.layerSystem.createLayer({ name: 'レイヤー1', opacity: 1.0 });
        this.layerSystem.setActiveLayer(layer1.id);
        
        layerUI.initialize();
        
        return { layerSystem: this.layerSystem, layerUI: layerUI };
    }
    
    addContainer(container) {
        if (this.engine.containers.world) {
            this.engine.containers.world.addChild(container);
        }
    }
    
    removeContainer(container) {
        if (this.engine.containers.world) {
            this.engine.containers.world.removeChild(container);
            container.destroy();
        }
    }
    
    reorderContainer(container, index) {
        if (this.engine.containers.world) {
            this.engine.containers.world.removeChild(container);
            this.engine.containers.world.addChildAt(container, index);
        }
    }
}

// ==== モジュールエクスポート ====
if (typeof window !== 'undefined') {
    window.FutabaLayers = {
        LayerSystem,
        LayerUI,
        LayerBridge
    };
}