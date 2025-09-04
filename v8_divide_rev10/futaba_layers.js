/**
 * ふたば☆ちゃんねる風ベクターお絵かきツール v8rev9
 * レイヤー管理システム - Adobe Fresco風レイヤー操作
 */

// LayerManager: レイヤーの作成・削除・操作を管理
class LayerManager {
    constructor(layerBridge) {
        this.bridge = layerBridge;
        this.layers = new Map();
        this.layerOrder = [];
        this.activeLayerId = null;
        this.nextLayerId = 1;
        this.ui = null;
        this.undoStack = [];
        this.checkerboardVisible = false;
    }
    
    initialize() {
        this.createLayer({ name: '背景', isBackground: true, opacity: 1.0, withFill: true });
        this.updateCheckerboardVisibility();
    }
    
    createLayer(options = {}) {
        const { name = null, isBackground = false, opacity = 1.0, withFill = false } = options;
        
        const layerId = isBackground ? 0 : this.nextLayerId++;
        const layerName = name || `レイヤー${layerId}`;
        
        const container = new PIXI.Container();
        container.name = layerName;
        container.visible = true;
        container.alpha = opacity;
        
        const layer = {
            id: layerId,
            name: layerName,
            container: container,
            visible: "open",
            opacity: opacity,
            isBackground: isBackground,
            paths: []
        };
        
        // 背景レイヤーにはfutaba-cream色の塗りつぶしを追加
        if (withFill) {
            this.createBackgroundFill(container);
        }
        
        this.layers.set(layerId, layer);
        
        if (isBackground) {
            this.layerOrder.unshift(layerId);
        } else {
            this.layerOrder.push(layerId);
        }
        
        this.bridge.addContainer(container);
        this.reorderContainers();
        
        if (this.activeLayerId === null || isBackground) {
            this.activeLayerId = layerId;
        }
        
        this.updateLayerUI();
        this.updateCheckerboardVisibility();
        return layer;
    }
    
    createBackgroundFill(container) {
        const fillGraphics = new PIXI.Graphics();
        fillGraphics.rect(0, 0, window.CONFIG.canvas.width, window.CONFIG.canvas.height);
        fillGraphics.fill(0xf0e0d6); // futaba-cream
        container.addChild(fillGraphics);
        
        // 背景塗りつぶしをpathとして記録
        const fillPath = {
            id: `background_fill_${Date.now()}`,
            graphics: fillGraphics,
            points: [
                { x: 0, y: 0, size: 1 },
                { x: window.CONFIG.canvas.width, y: window.CONFIG.canvas.height, size: 1 }
            ],
            color: 0xf0e0d6,
            size: 1,
            opacity: 1.0,
            isComplete: true,
            isBackgroundFill: true
        };
        
        const layer = this.layers.get(0);
        if (layer) {
            layer.paths.push(fillPath);
        }
    }
    
    duplicateLayer(layerId) {
        const sourceLayer = this.layers.get(layerId);
        if (!sourceLayer) return null;
        
        const newLayer = this.createLayer({ 
            name: `${sourceLayer.name} コピー`,
            opacity: sourceLayer.opacity
        });
        
        sourceLayer.paths.forEach(path => {
            const newPath = this.clonePath(path);
            newLayer.container.addChild(newPath.graphics);
            newLayer.paths.push(newPath);
        });
        
        this.setActiveLayer(newLayer.id);
        return newLayer;
    }
    
    mergeLayerDown(layerId) {
        const layer = this.layers.get(layerId);
        const layerIndex = this.layerOrder.indexOf(layerId);
        
        if (!layer || layerIndex <= 0) return false;
        
        const belowLayerId = this.layerOrder[layerIndex - 1];
        const belowLayer = this.layers.get(belowLayerId);
        
        if (!belowLayer) return false;
        
        layer.paths.forEach(path => {
            belowLayer.container.addChild(path.graphics);
            belowLayer.paths.push(path);
        });
        
        this.deleteLayer(layerId, false);
        return true;
    }
    
    deleteLayer(layerId, recordUndo = true) {
        if (layerId === 0) return;
        if (this.layers.size <= 1) return;
        
        const layer = this.layers.get(layerId);
        if (!layer) return;
        
        if (recordUndo) {
            this.undoStack.push({
                type: 'delete',
                layer: this.serializeLayer(layer),
                order: this.layerOrder.indexOf(layerId),
                timestamp: Date.now()
            });
            this.showUndoNotification('レイヤーを削除しました');
        }
        
        layer.paths.forEach(path => {
            path.graphics.destroy();
        });
        
        this.bridge.removeContainer(layer.container);
        
        const orderIndex = this.layerOrder.indexOf(layerId);
        if (orderIndex !== -1) {
            this.layerOrder.splice(orderIndex, 1);
        }
        
        this.layers.delete(layerId);
        
        if (this.activeLayerId === layerId) {
            const newActiveIndex = Math.max(0, orderIndex - 1);
            this.activeLayerId = this.layerOrder[newActiveIndex];
        }
        
        this.updateLayerUI();
        this.updateCheckerboardVisibility();
    }
    
    setActiveLayer(layerId) {
        if (this.layers.has(layerId)) {
            this.activeLayerId = layerId;
            this.updateLayerUI();
            this.updateStatusDisplay();
        }
    }
    
    toggleLayerVisibility(layerId) {
        const layer = this.layers.get(layerId);
        if (!layer) return;
        
        const states = ["open", "closed", "disabled"];
        const currentIndex = states.indexOf(layer.visible);
        const nextIndex = (currentIndex + 1) % states.length;
        layer.visible = states[nextIndex];
        
        layer.container.visible = (layer.visible === "open");
        layer.container.alpha = layer.visible === "disabled" ? 0.3 : layer.opacity;
        
        this.updateLayerUI();
        this.updateCheckerboardVisibility();
    }
    
    setLayerOpacity(layerId, opacity) {
        const layer = this.layers.get(layerId);
        if (!layer) return;
        
        layer.opacity = Math.max(0, Math.min(1, opacity));
        layer.container.alpha = layer.visible === "disabled" ? 0.3 : layer.opacity;
        
        this.updateLayerUI();
    }
    
    reorderLayers(fromIndex, toIndex) {
        if (fromIndex < 0 || fromIndex >= this.layerOrder.length ||
            toIndex < 0 || toIndex >= this.layerOrder.length ||
            fromIndex === toIndex) return;
        
        const fromLayerId = this.layerOrder[fromIndex];
        const toLayerId = this.layerOrder[toIndex];
        
        if (fromLayerId === 0 || toLayerId === 0) return;
        
        const layerId = this.layerOrder.splice(fromIndex, 1)[0];
        this.layerOrder.splice(toIndex, 0, layerId);
        
        this.reorderContainers();
        this.updateLayerUI();
    }
    
    reorderContainers() {
        this.layerOrder.forEach((layerId, index) => {
            const layer = this.layers.get(layerId);
            if (layer) {
                this.bridge.reorderContainer(layer.container, index);
            }
        });
    }
    
    getActiveLayer() {
        return this.layers.get(this.activeLayerId);
    }
    
    addPathToActiveLayer(path) {
        const activeLayer = this.getActiveLayer();
        if (activeLayer) {
            activeLayer.paths.push(path);
            activeLayer.container.addChild(path.graphics);
        }
    }
    
    clearAllLayers() {
        this.layers.forEach(layer => {
            layer.paths = [];
            layer.container.removeChildren();
        });
    }
    
    updateCheckerboardVisibility() {
        const backgroundLayer = this.layers.get(0);
        const shouldShow = !backgroundLayer || 
                           backgroundLayer.visible !== "open" || 
                           backgroundLayer.opacity < 1.0;
        
        if (shouldShow !== this.checkerboardVisible) {
            this.checkerboardVisible = shouldShow;
            const overlay = document.querySelector('.checkerboard-overlay');
            if (overlay) {
                overlay.style.opacity = shouldShow ? '1' : '0';
            }
        }
    }
    
    getLayerVisibilityIcon(state) {
        const icons = {
            open: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#800000" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                     <path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0"/>
                     <circle cx="12" cy="12" r="3"/>
                   </svg>`,
            closed: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#800000" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                       <path d="M10.733 5.076a10.744 10.744 0 0 1 11.205 6.575 1 1 0 0 1 0 .696 10.747 10.747 0 0 1-1.444 2.49"/>
                       <path d="M14.084 14.158a3 3 0 0 1-4.242-4.242"/>
                       <path d="M17.479 17.499a10.75 10.75 0 0 1-15.417-5.151 1 1 0 0 1 0-.696 10.75 10.75 0 0 1 4.446-5.143"/>
                       <path d="m2 2 20 20"/>
                     </svg>`,
            disabled: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#800000" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                         <path d="M10.733 5.076a10.744 10.744 0 0 1 11.205 6.575 1 1 0 0 1 0 .696 10.747 10.747 0 0 1-1.444 2.49"/>
                         <path d="M14.084 14.158a3 3 0 0 1-4.242-4.242"/>
                         <path d="M17.479 17.499a10.75 10.75 0 0 1-15.417-5.151 1 1 0 0 1 0-.696 10.75 10.75 0 0 1 4.446-5.143"/>
                         <path d="m2 2 20 20"/>
                       </svg>`
        };
        return icons[state] || icons.open;
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
    
    clonePath(originalPath) {
        const clonedGraphics = new PIXI.Graphics();
        
        if (originalPath.isBackgroundFill) {
            clonedGraphics.rect(0, 0, window.CONFIG.canvas.width, window.CONFIG.canvas.height);
            clonedGraphics.fill(originalPath.color);
        } else {
            originalPath.points.forEach((point, index) => {
                clonedGraphics.circle(point.x, point.y, point.size / 2);
                clonedGraphics.fill({ 
                    color: originalPath.color, 
                    alpha: originalPath.opacity 
                });
            });
        }
        
        return {
            id: `path_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            graphics: clonedGraphics,
            points: [...originalPath.points],
            color: originalPath.color,
            size: originalPath.size,
            opacity: originalPath.opacity,
            isComplete: originalPath.isComplete,
            isBackgroundFill: originalPath.isBackgroundFill || false
        };
    }
    
    showUndoNotification(message) {
        if (!this.ui) return;
        this.ui.showUndoNotification(message);
    }
    
    updateLayerUI() {
        if (!this.ui) return;
        this.ui.updateLayerList(this.layers, this.layerOrder, this.activeLayerId);
    }
    
    updateStatusDisplay() {
        const activeLayer = this.getActiveLayer();
        const element = document.getElementById('current-layer');
        if (element && activeLayer) {
            element.textContent = activeLayer.name;
        }
    }
}

// LayerUI: レイヤーパネルUI管理
class LayerUI {
    constructor(layerManager) {
        this.layerManager = layerManager;
        this.layerPopup = null;
        this.sliders = new Map();
    }
    
    initialize() {
        this.createLayerPanel();
        this.setupLayerPopup();
        this.layerManager.ui = this;
    }
    
    createLayerPanel() {
        const container = document.getElementById('layer-panel-container');
        if (!container) return;
        
        container.innerHTML = `
            <div class="layer-panel" id="layer-panel">
                <div class="layer-header">
                    <span>レイヤー</span>
                    <div class="layer-controls">
                        <div class="layer-add-btn" id="add-layer-btn" title="レイヤー追加">
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#800000" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                                <line x1="15" x2="15" y1="12" y2="18"/>
                                <line x1="12" x2="18" y1="15" y2="15"/>
                                <rect width="14" height="14" x="8" y="8" rx="2" ry="2"/>
                                <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>
                            </svg>
                        </div>
                        <div class="layer-add-btn" id="add-file-btn" title="ファイル追加">
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#800000" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                                <path d="M12 10v6"/>
                                <path d="M9 13h6"/>
                                <path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z"/>
                            </svg>
                        </div>
                    </div>
                </div>
                <div class="layer-list" id="layer-list">
                </div>
            </div>
            
            <!-- レイヤー操作ポップアップ -->
            <div class="layer-popup" id="layer-popup">
                <div class="popup-title">レイヤー設定</div>
                
                <div class="setting-group">
                    <div class="setting-label">不透明度</div>
                    <div class="slider-container">
                        <div class="slider" id="layer-opacity-slider">
                            <div class="slider-track" id="layer-opacity-track"></div>
                            <div class="slider-handle" id="layer-opacity-handle"></div>
                        </div>
                        <div class="slider-value" id="layer-opacity-value">100%</div>
                    </div>
                </div>
                
                <div class="action-buttons">
                    <div class="action-button" id="merge-layer-btn">下と結合</div>
                    <div class="action-button" id="duplicate-layer-btn">複製</div>
                </div>
            </div>
            
            <!-- UNDO通知 -->
            <div class="undo-notification" id="undo-notification">
                レイヤーを削除しました
            </div>
        `;
        
        this.addLayerPanelStyles();
        this.setupLayerControls();
    }
    
    addLayerPanelStyles() {
        const style = document.createElement('style');
        style.textContent = `
            .layer-panel {
                background: rgba(240, 224, 214, 0.95);
                border: 1px solid rgba(207, 156, 151, 0.3);
                border-radius: 12px;
                backdrop-filter: blur(8px);
                box-shadow: 0 8px 24px rgba(128, 0, 0, 0.15);
                height: 100%;
                display: flex;
                flex-direction: column;
                overflow: hidden;
            }
            
            .layer-header {
                background: rgba(128, 0, 0, 0.1);
                padding: 8px 12px;
                border-bottom: 1px solid rgba(207, 156, 151, 0.3);
                font-weight: 600;
                color: var(--futaba-maroon);
                font-size: 11px;
                display: flex;
                justify-content: space-between;
                align-items: center;
            }
            
            .layer-controls {
                display: flex;
                gap: 6px;
            }
            
            .layer-add-btn {
                width: 20px;
                height: 20px;
                border: 1px solid rgba(207, 156, 151, 0.3);
                background: rgba(255, 255, 238, 0.9);
                border-radius: 4px;
                display: flex;
                align-items: center;
                justify-content: center;
                cursor: pointer;
                transition: all 0.15s ease;
            }
            
            .layer-add-btn:hover {
                background: var(--futaba-light-medium);
                transform: scale(1.05);
            }
            
            .layer-list {
                flex: 1;
                overflow-y: auto;
                padding: 6px;
                display: flex;
                flex-direction: column;
                gap: 2px;
            }
            
            .layer-item {
                background: rgba(255, 255, 238, 0.9);
                border: 1px solid transparent;
                border-radius: 6px;
                padding: 6px 8px;
                cursor: pointer;
                transition: all 0.15s ease;
                display: flex;
                align-items: center;
                gap: 6px;
                user-select: none;
                position: relative;
                height: 28px;
                font-size: 11px;
            }
            
            .layer-item:hover {
                border-color: rgba(207, 156, 151, 0.3);
                background: rgba(255, 255, 238, 1);
            }
            
            .layer-item.active {
                border-color: var(--futaba-maroon);
                background: rgba(170, 90, 86, 0.2);
                box-shadow: 0 1px 4px rgba(128, 0, 0, 0.2);
            }
            
            .layer-visibility {
                width: 16px;
                height: 16px;
                border: none;
                background: transparent;
                border-radius: 3px;
                display: flex;
                align-items: center;
                justify-content: center;
                cursor: pointer;
                transition: all 0.15s ease;
            }
            
            .layer-visibility:hover {
                background: rgba(128, 0, 0, 0.1);
            }
            
            .layer-visibility.closed, .layer-visibility.disabled {
                opacity: 0.6;
            }
            
            .layer-name {
                flex: 1;
                font-size: 11px;
                color: var(--text-primary);
                font-weight: 500;
                overflow: hidden;
                text-overflow: ellipsis;
                white-space: nowrap;
            }
            
            .layer-opacity {
                font-size: 10px;
                color: var(--text-secondary);
                font-family: monospace;
                min-width: 32px;
                text-align: right;
            }
            
            .layer-popup {
                position: fixed;
                background: rgba(247, 237, 226, 0.98);
                border: 1px solid var(--futaba-maroon);
                border-radius: 12px;
                box-shadow: 0 12px 32px rgba(128, 0, 0, 0.25);
                padding: 16px;
                z-index: 2000;
                backdrop-filter: blur(12px);
                display: none;
                user-select: none;
                min-width: 220px;
                font-size: 12px;
            }
            
            .layer-popup.show {
                display: block;
                animation: fadeInScale 0.2s ease-out;
            }
            
            @keyframes fadeInScale {
                from { opacity: 0; transform: scale(0.9); }
                to   { opacity: 1; transform: scale(1); }
            }
            
            .popup-title {
                font-size: 13px;
                font-weight: 600;
                color: var(--futaba-maroon);
                margin-bottom: 12px;
                text-align: center;
                border-bottom: 1px solid rgba(207, 156, 151, 0.3);
                padding-bottom: 6px;
            }
            
            .setting-group {
                margin-bottom: 12px;
            }
            
            .setting-label {
                font-size: 11px;
                color: var(--text-primary);
                margin-bottom: 6px;
                font-weight: 500;
            }
            
            .slider-container {
                display: flex;
                align-items: center;
                gap: 8px;
                margin-bottom: 8px;
            }
            
            .slider {
                flex: 1;
                height: 4px;
                background: rgba(207, 156, 151, 0.3);
                border-radius: 2px;
                position: relative;
                cursor: pointer;
            }
            
            .slider-track {
                height: 100%;
                background: var(--futaba-maroon);
                border-radius: 2px;
                transition: width 0.1s ease;
            }
            
            .slider-handle {
                width: 12px;
                height: 12px;
                background: var(--futaba-maroon);
                border: 2px solid var(--futaba-background);
                border-radius: 50%;
                position: absolute;
                top: 50%;
                transform: translate(-50%, -50%);
                cursor: grab;
                box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
            }
            
            .slider-handle:active {
                cursor: grabbing;
                transform: translate(-50%, -50%) scale(1.1);
            }
            
            .slider-value {
                font-size: 10px;
                color: var(--text-secondary);
                font-family: monospace;
                min-width: 40px;
                text-align: right;
            }
            
            .action-buttons {
                display: flex;
                gap: 8px;
            }
            
            .action-button {
                flex: 1;
                padding: 8px 12px;
                border: 1px solid var(--futaba-maroon);
                border-radius: 6px;
                background: rgba(255, 255, 238, 0.9);
                color: var(--futaba-maroon);
                font-weight: 600;
                cursor: pointer;
                transition: all 0.15s ease;
                text-align: center;
                font-size: 11px;
            }
            
            .action-button:hover {
                background: var(--futaba-maroon);
                color: var(--text-inverse);
            }
            
            .undo-notification {
                position: fixed;
                top: 20px;
                right: 20px;
                background: rgba(128, 0, 0, 0.9);
                color: white;
                padding: 8px 16px;
                border-radius: 8px;
                font-size: 12px;
                font-weight: 600;
                z-index: 3000;
                opacity: 0;
                transform: translateY(-20px);
                transition: all 0.3s ease;
            }
            
            .undo-notification.show {
                opacity: 1;
                transform: translateY(0);
            }
        `;
        document.head.appendChild(style);
    }
    
    setupLayerControls() {
        const addLayerBtn = document.getElementById('add-layer-btn');
        const addFileBtn = document.getElementById('add-file-btn');
        
        if (addLayerBtn) {
            addLayerBtn.addEventListener('click', () => {
                const newLayer = this.layerManager.createLayer({ opacity: 1.0 });
                this.layerManager.setActiveLayer(newLayer.id);
            });
        }
        
        if (addFileBtn) {
            addFileBtn.addEventListener('click', () => {
                console.log('ファイル追加機能は将来実装予定');
            });
        }
    }
    
    setupLayerPopup() {
        this.layerPopup = document.getElementById('layer-popup');
        if (!this.layerPopup) return;
        
        this.createSlider('layer-opacity-slider', 0, 100, 100, (value) => {
            const currentLayerId = parseInt(this.layerPopup.dataset.layerId);
            if (currentLayerId) {
                this.layerManager.setLayerOpacity(currentLayerId, value / 100);
            }
            return Math.round(value) + '%';
        });
        
        const mergeBtn = document.getElementById('merge-layer-btn');
        const duplicateBtn = document.getElementById('duplicate-layer-btn');
        
        if (mergeBtn) {
            mergeBtn.addEventListener('click', () => {
                const currentLayerId = parseInt(this.layerPopup.dataset.layerId);
                if (currentLayerId) {
                    this.layerManager.mergeLayerDown(currentLayerId);
                    this.hideLayerPopup();
                }
            });
        }
        
        if (duplicateBtn) {
            duplicateBtn.addEventListener('click', () => {
                const currentLayerId = parseInt(this.layerPopup.dataset.layerId);
                if (currentLayerId) {
                    this.layerManager.duplicateLayer(currentLayerId);
                    this.hideLayerPopup();
                }
            });
        }
        
        document.addEventListener('click', (e) => {
            if (this.layerPopup.classList.contains('show') && 
                !this.layerPopup.contains(e.target) && 
                !e.target.closest('.layer-item')) {
                this.hideLayerPopup();
            }
        });
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
    
    showLayerPopup(layerId, x, y) {
        if (!this.layerPopup) return;
        
        const layer = this.layerManager.layers.get(layerId);
        if (!layer) return;
        
        const maxX = window.innerWidth - 240;
        const maxY = window.innerHeight - 200;
        
        this.layerPopup.style.left = Math.min(x, maxX) + 'px';
        this.layerPopup.style.top = Math.min(y, maxY) + 'px';
        
        this.layerPopup.dataset.layerId = layerId;
        
        const title = this.layerPopup.querySelector('.popup-title');
        if (title) {
            title.textContent = `${layer.name} の設定`;
        }
        
        const opacitySlider = this.sliders.get('layer-opacity-slider');
        if (opacitySlider) {
            const value = layer.opacity * 100;
            const percentage = value;
            
            opacitySlider.track.style.width = percentage + '%';
            opacitySlider.handle.style.left = percentage + '%';
            opacitySlider.valueDisplay.textContent = Math.round(value) + '%';
            opacitySlider.value = value;
        }
        
        const mergeBtn = document.getElementById('merge-layer-btn');
        if (mergeBtn) {
            const canMerge = this.layerManager.layerOrder.indexOf(layerId) > 0;
            mergeBtn.style.opacity = canMerge ? '1' : '0.5';
            mergeBtn.style.pointerEvents = canMerge ? 'auto' : 'none';
        }
        
        this.layerPopup.classList.add('show');
    }
    
    hideLayerPopup() {
        if (this.layerPopup) {
            this.layerPopup.classList.remove('show');
            delete this.layerPopup.dataset.layerId;
        }
    }
    
    updateLayerList(layers, layerOrder, activeLayerId) {
        const layerList = document.getElementById('layer-list');
        if (!layerList) return;
        
        layerList.innerHTML = '';
        
        const displayOrder = [...layerOrder].reverse();
        
        displayOrder.forEach((layerId, index) => {
            const layer = layers.get(layerId);
            const layerItem = document.createElement('div');
            layerItem.className = `layer-item ${layerId === activeLayerId ? 'active' : ''}`;
            layerItem.dataset.layerId = layerId;
            layerItem.dataset.layerIndex = index;
            
            const eyeIcon = this.layerManager.getLayerVisibilityIcon(layer.visible);
            
            layerItem.innerHTML = `
                <div class="layer-visibility ${layer.visible}" data-action="toggle-visibility">
                    ${eyeIcon}
                </div>
                <div class="layer-name">${layer.name}</div>
                <div class="layer-opacity">${Math.round(layer.opacity * 100)}%</div>
            `;
            
            layerItem.addEventListener('click', (e) => {
                const action = e.target.closest('[data-action]')?.dataset.action;
                if (action === 'toggle-visibility') {
                    this.layerManager.toggleLayerVisibility(layerId);
                } else {
                    this.layerManager.setActiveLayer(layerId);
                }
            });
            
            layerItem.addEventListener('contextmenu', (e) => {
                e.preventDefault();
                this.showLayerPopup(layerId, e.clientX, e.clientY);
            });
            
            if (layerId !== 0) {
                this.setupLayerSwipe(layerItem, layerId);
            }
            
            layerList.appendChild(layerItem);
        });
    }
    
    setupLayerSwipe(layerItem, layerId) {
        let startX = 0;
        let currentX = 0;
        let isDragging = false;
        const swipeThreshold = 80;
        
        const onPointerStart = (e) => {
            if (e.target.closest('[data-action]')) return;
            
            startX = e.clientX;
            currentX = e.clientX;
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
                
                if (Math.abs(deltaX) > swipeThreshold) {
                    layerItem.style.backgroundColor = '#ffcccc';
                } else {
                    layerItem.style.backgroundColor = '';
                }
            }
        };
        
        const onPointerEnd = (e) => {
            if (!isDragging) return;
            
            isDragging = false;
            layerItem.style.transition = '';
            
            const deltaX = currentX - startX;
            
            if (Math.abs(deltaX) > swipeThreshold) {
                layerItem.style.transform = `translateX(${deltaX > 0 ? '100%' : '-100%'})`;
                layerItem.style.opacity = '0';
                
                setTimeout(() => {
                    this.layerManager.deleteLayer(layerId);
                }, 200);
            } else {
                layerItem.style.transform = '';
                layerItem.style.backgroundColor = '';
            }
        };
        
        layerItem.addEventListener('pointerdown', onPointerStart);
        document.addEventListener('pointermove', onPointerMove);
        document.addEventListener('pointerup', onPointerEnd);
        document.addEventListener('pointercancel', onPointerEnd);
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

// 初期化とグローバルエクスポート
function initializeLayerSystem() {
    console.log('レイヤーシステム初期化開始');
    
    if (!window.futabaApp?.engine?.layerBridge) {
        console.error('LayerBridge not found - main app not ready');
        return false;
    }
    
    const layerManager = new LayerManager(window.futabaApp.engine.layerBridge);
    const layerUI = new LayerUI(layerManager);
    
    console.log('LayerManager作成完了');
    
    layerManager.initialize();
    console.log('LayerManager初期化完了');
    
    layerUI.initialize();
    console.log('LayerUI初期化完了');
    
    // グローバルアクセス
    window.FutabaLayers = { LayerManager, LayerUI, layerManager, layerUI };
    
    console.log('レイヤーシステム初期化完了');
    
    // tools.jsに通知
    if (window.initializeToolsAfterLayers) {
        window.initializeToolsAfterLayers(layerManager, layerUI);
    } else {
        console.log('ツール初期化関数待機中...');
        // ツール初期化関数を待機
        window.pendingLayerManager = layerManager;
        window.pendingLayerUI = layerUI;
    }
    
    return true;
}

// 自動初期化
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        setTimeout(initializeLayerSystem, 100);
    });
} else {
    setTimeout(initializeLayerSystem, 100);
}