// ===== ui/resize-popup.js - イベントリスナー参照修正版 =====
// 責務: キャンバスリサイズUI表示、ユーザー入力受付、History統合
// 🔥 修正: イベントハンドラーのthis参照をbindで固定

window.TegakiUI = window.TegakiUI || {};

window.TegakiUI.ResizePopup = class {
    constructor(dependencies) {
        this.coreEngine = dependencies.coreEngine;
        this.history = dependencies.history;
        this.eventBus = window.TegakiEventBus;
        
        this.popup = null;
        this.isVisible = false;
        this.initialized = false;
        
        this.isDraggingWidth = false;
        this.isDraggingHeight = false;
        
        this.elements = {};
        
        // 🔥 修正: アロー関数でthisを固定
        this.mouseMoveHandler = (e) => {
            if (this.isDraggingWidth) {
                const rect = this.elements.widthSlider.getBoundingClientRect();
                const percent = Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100));
                const value = this.MIN_SIZE + ((this.MAX_SIZE - this.MIN_SIZE) * percent / 100);
                this._updateWidthSlider(Math.round(value));
            }
            if (this.isDraggingHeight) {
                const rect = this.elements.heightSlider.getBoundingClientRect();
                const percent = Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100));
                const value = this.MIN_SIZE + ((this.MAX_SIZE - this.MIN_SIZE) * percent / 100);
                this._updateHeightSlider(Math.round(value));
            }
        };
        
        this.mouseUpHandler = () => {
            this.isDraggingWidth = false;
            this.isDraggingHeight = false;
        };
        
        this.currentWidth = 0;
        this.currentHeight = 0;
        this.horizontalAlign = 'center';
        this.verticalAlign = 'center';
        
        this.MIN_SIZE = 100;
        this.MAX_SIZE = 2000;
        
        this._ensurePopupElement();
    }
    
    _ensurePopupElement() {
        this.popup = document.getElementById('resize-settings');
        
        if (!this.popup) {
            this._createPopupElement();
        } else {
            this.popup.classList.remove('show');
            this.popup.style.display = '';
            
            if (this.popup.children.length === 0) {
                this._populateContent();
            }
        }
        
        if (this.popup) {
            this.popup.classList.add('resize-popup-compact');
            this.popup.style.top = '60px';
            this.popup.style.left = '60px';
        }
    }
    
    _createPopupElement() {
        const container = document.querySelector('.canvas-area');
        if (!container) return;
        
        const popupDiv = document.createElement('div');
        popupDiv.id = 'resize-settings';
        popupDiv.className = 'popup-panel resize-popup-compact';
        popupDiv.style.top = '60px';
        popupDiv.style.left = '60px';
        
        container.appendChild(popupDiv);
        this.popup = popupDiv;
        this._populateContent();
    }
    
    _populateContent() {
        if (!this.popup) return;
        
        this.popup.innerHTML = `
            <div class="popup-title" style="display: none;">キャンバスリサイズ</div>
            
            <div class="resize-compact-group">
                <div class="resize-compact-label">横配置</div>
                <div class="resize-align-row">
                    <button class="resize-align-btn" id="horizontal-align-left">←</button>
                    <button class="resize-align-btn active" id="horizontal-align-center">↔</button>
                    <button class="resize-align-btn" id="horizontal-align-right">→</button>
                </div>
            </div>
            
            <div class="resize-compact-group">
                <div class="resize-compact-label">幅</div>
                <div class="resize-slider-row">
                    <button class="resize-arrow-btn" id="width-decrease">◀</button>
                    <div class="resize-slider" id="canvas-width-slider">
                        <div class="resize-slider-track" id="canvas-width-track"></div>
                        <div class="resize-slider-handle" id="canvas-width-handle"></div>
                    </div>
                    <button class="resize-arrow-btn" id="width-increase">▶</button>
                </div>
                <div class="resize-value-row">
                    <div class="resize-value-display" id="canvas-width-display">344px</div>
                </div>
            </div>
            
            <div class="resize-compact-group">
                <div class="resize-compact-label">縦配置</div>
                <div class="resize-align-row">
                    <button class="resize-align-btn" id="vertical-align-top">↑</button>
                    <button class="resize-align-btn active" id="vertical-align-center">↕</button>
                    <button class="resize-align-btn" id="vertical-align-bottom">↓</button>
                </div>
            </div>
            
            <div class="resize-compact-group">
                <div class="resize-compact-label">高さ</div>
                <div class="resize-slider-row">
                    <button class="resize-arrow-btn" id="height-decrease">◀</button>
                    <div class="resize-slider" id="canvas-height-slider">
                        <div class="resize-slider-track" id="canvas-height-track"></div>
                        <div class="resize-slider-handle" id="canvas-height-handle"></div>
                    </div>
                    <button class="resize-arrow-btn" id="height-increase">▶</button>
                </div>
                <div class="resize-value-row">
                    <div class="resize-value-display" id="canvas-height-display">135px</div>
                </div>
            </div>
            
            <div class="resize-preset-group">
                <button class="resize-preset-btn" data-width="344" data-height="135">
                    ふたば<br>344×135
                </button>
                <button class="resize-preset-btn" data-width="1920" data-height="1080">
                    Full HD<br>1920×1080
                </button>
                <button class="resize-preset-btn" data-width="1280" data-height="720">
                    HD<br>1280×720
                </button>
            </div>
            
            <button class="resize-apply-btn" id="apply-resize">適用</button>
            
            <input type="number" class="resize-hidden-input" id="canvas-width-input">
            <input type="number" class="resize-hidden-input" id="canvas-height-input">
        `;
    }
    
    _cacheElements() {
        this.elements = {
            widthSlider: document.getElementById('canvas-width-slider'),
            widthTrack: document.getElementById('canvas-width-track'),
            widthHandle: document.getElementById('canvas-width-handle'),
            widthDisplay: document.getElementById('canvas-width-display'),
            widthDecrease: document.getElementById('width-decrease'),
            widthIncrease: document.getElementById('width-increase'),
            
            heightSlider: document.getElementById('canvas-height-slider'),
            heightTrack: document.getElementById('canvas-height-track'),
            heightHandle: document.getElementById('canvas-height-handle'),
            heightDisplay: document.getElementById('canvas-height-display'),
            heightDecrease: document.getElementById('height-decrease'),
            heightIncrease: document.getElementById('height-increase'),
            
            horizontalAlignLeft: document.getElementById('horizontal-align-left'),
            horizontalAlignCenter: document.getElementById('horizontal-align-center'),
            horizontalAlignRight: document.getElementById('horizontal-align-right'),
            verticalAlignTop: document.getElementById('vertical-align-top'),
            verticalAlignCenter: document.getElementById('vertical-align-center'),
            verticalAlignBottom: document.getElementById('vertical-align-bottom'),
            
            applyBtn: document.getElementById('apply-resize')
        };
    }
    
    initialize() {
        if (this.initialized) {
            this._cleanupEventListeners();
        }
        
        const config = window.TEGAKI_CONFIG;
        this.currentWidth = config?.canvas?.width || 344;
        this.currentHeight = config?.canvas?.height || 135;
        
        this._cacheElements();
        this._setupSliders();
        this._setupAlignmentButtons();
        this._setupPresetButtons();
        this._setupApplyButton();
        
        this._updateUI();
        
        this.initialized = true;
    }
    
    _cleanupEventListeners() {
        if (this.mouseMoveHandler) {
            document.removeEventListener('mousemove', this.mouseMoveHandler);
        }
        if (this.mouseUpHandler) {
            document.removeEventListener('mouseup', this.mouseUpHandler);
        }
    }
    
    _setupSliders() {
        document.addEventListener('mousemove', this.mouseMoveHandler);
        document.addEventListener('mouseup', this.mouseUpHandler);
        
        this.elements.widthHandle.addEventListener('mousedown', (e) => {
            this.isDraggingWidth = true;
            e.preventDefault();
        });
        
        this.elements.heightHandle.addEventListener('mousedown', (e) => {
            this.isDraggingHeight = true;
            e.preventDefault();
        });
        
        this.elements.widthSlider.addEventListener('click', (e) => {
            if (e.target === this.elements.widthHandle) return;
            const rect = this.elements.widthSlider.getBoundingClientRect();
            const percent = ((e.clientX - rect.left) / rect.width) * 100;
            const value = this.MIN_SIZE + ((this.MAX_SIZE - this.MIN_SIZE) * percent / 100);
            this._updateWidthSlider(Math.round(value));
        });
        
        this.elements.heightSlider.addEventListener('click', (e) => {
            if (e.target === this.elements.heightHandle) return;
            const rect = this.elements.heightSlider.getBoundingClientRect();
            const percent = ((e.clientX - rect.left) / rect.width) * 100;
            const value = this.MIN_SIZE + ((this.MAX_SIZE - this.MIN_SIZE) * percent / 100);
            this._updateHeightSlider(Math.round(value));
        });
        
        this.elements.widthDecrease.addEventListener('click', () => {
            this._updateWidthSlider(this.currentWidth - 1);
        });
        
        this.elements.widthIncrease.addEventListener('click', () => {
            this._updateWidthSlider(this.currentWidth + 1);
        });
        
        this.elements.heightDecrease.addEventListener('click', () => {
            this._updateHeightSlider(this.currentHeight - 1);
        });
        
        this.elements.heightIncrease.addEventListener('click', () => {
            this._updateHeightSlider(this.currentHeight + 1);
        });
    }
    
    _updateWidthSlider(value) {
        this.currentWidth = Math.max(this.MIN_SIZE, Math.min(this.MAX_SIZE, value));
        const percent = ((this.currentWidth - this.MIN_SIZE) / (this.MAX_SIZE - this.MIN_SIZE)) * 100;
        this.elements.widthTrack.style.width = percent + '%';
        this.elements.widthHandle.style.left = percent + '%';
        this.elements.widthDisplay.textContent = this.currentWidth + 'px';
    }
    
    _updateHeightSlider(value) {
        this.currentHeight = Math.max(this.MIN_SIZE, Math.min(this.MAX_SIZE, value));
        const percent = ((this.currentHeight - this.MIN_SIZE) / (this.MAX_SIZE - this.MIN_SIZE)) * 100;
        this.elements.heightTrack.style.width = percent + '%';
        this.elements.heightHandle.style.left = percent + '%';
        this.elements.heightDisplay.textContent = this.currentHeight + 'px';
    }
    
    _setupAlignmentButtons() {
        if (this.elements.horizontalAlignLeft) {
            this.elements.horizontalAlignLeft.addEventListener('click', () => this._setHorizontalAlign('left'));
        }
        if (this.elements.horizontalAlignCenter) {
            this.elements.horizontalAlignCenter.addEventListener('click', () => this._setHorizontalAlign('center'));
        }
        if (this.elements.horizontalAlignRight) {
            this.elements.horizontalAlignRight.addEventListener('click', () => this._setHorizontalAlign('right'));
        }
        
        if (this.elements.verticalAlignTop) {
            this.elements.verticalAlignTop.addEventListener('click', () => this._setVerticalAlign('top'));
        }
        if (this.elements.verticalAlignCenter) {
            this.elements.verticalAlignCenter.addEventListener('click', () => this._setVerticalAlign('center'));
        }
        if (this.elements.verticalAlignBottom) {
            this.elements.verticalAlignBottom.addEventListener('click', () => this._setVerticalAlign('bottom'));
        }
    }
    
    _setHorizontalAlign(align) {
        this.horizontalAlign = align;
        
        document.querySelectorAll('#horizontal-align-left, #horizontal-align-center, #horizontal-align-right').forEach(btn => {
            btn.classList.remove('active');
        });
        
        const btn = document.getElementById(`horizontal-align-${align}`);
        if (btn) btn.classList.add('active');
    }
    
    _setVerticalAlign(align) {
        this.verticalAlign = align;
        
        document.querySelectorAll('#vertical-align-top, #vertical-align-center, #vertical-align-bottom').forEach(btn => {
            btn.classList.remove('active');
        });
        
        const btn = document.getElementById(`vertical-align-${align}`);
        if (btn) btn.classList.add('active');
    }
    
    _setupPresetButtons() {
        const presetBtns = document.querySelectorAll('.resize-preset-btn');
        presetBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                const width = parseInt(btn.getAttribute('data-width'));
                const height = parseInt(btn.getAttribute('data-height'));
                
                this._updateWidthSlider(width);
                this._updateHeightSlider(height);
            });
        });
    }
    
    _setupApplyButton() {
        if (!this.elements.applyBtn) return;
        
        this.elements.applyBtn.addEventListener('click', () => {
            this._applyResize();
        });
    }
    
    _applyResize() {
        if (!this.coreEngine || !this.history) return;
        if (this.currentWidth <= 0 || this.currentHeight <= 0) return;
        
        const newWidth = this.currentWidth;
        const newHeight = this.currentHeight;
        
        const alignOptions = {
            horizontalAlign: this.horizontalAlign === 'left' ? 'right' : 
                             this.horizontalAlign === 'right' ? 'left' : 'center',
            verticalAlign: this.verticalAlign === 'top' ? 'bottom' : 
                           this.verticalAlign === 'bottom' ? 'top' : 'center'
        };
        
        const oldWidth = window.TEGAKI_CONFIG.canvas.width;
        const oldHeight = window.TEGAKI_CONFIG.canvas.height;
        const layerManager = this.coreEngine.getLayerManager();
        const layers = layerManager.getLayers();
        
        const layerSnapshots = layers.map(layer => ({
            id: layer.layerData.id,
            paths: layer.layerData.paths.map(this._serializePathForSnapshot.bind(this)),
            isBackground: layer.layerData.isBackground
        }));
        
        const command = {
            name: 'resize-canvas',
            do: () => {
                this.coreEngine.resizeCanvas(newWidth, newHeight, alignOptions);
            },
            undo: () => {
                window.TEGAKI_CONFIG.canvas.width = oldWidth;
                window.TEGAKI_CONFIG.canvas.height = oldHeight;
                this.coreEngine.getCameraSystem().resizeCanvas(oldWidth, oldHeight);
                
                const currentLayers = layerManager.getLayers();
                
                layerSnapshots.forEach(snapshot => {
                    const layer = currentLayers.find(l => l.layerData.id === snapshot.id);
                    if (!layer) return;
                    
                    layer.layerData.paths.forEach(path => {
                        if (path.graphics) {
                            layer.removeChild(path.graphics);
                            path.graphics.destroy();
                        }
                    });
                    
                    if (snapshot.isBackground && layer.layerData.backgroundGraphics) {
                        layer.layerData.backgroundGraphics.clear();
                        layer.layerData.backgroundGraphics.rect(0, 0, oldWidth, oldHeight);
                        layer.layerData.backgroundGraphics.fill(window.TEGAKI_CONFIG.background.color);
                    }
                    
                    layer.layerData.paths = snapshot.paths.map(pathData => {
                        const restoredPath = {
                            id: pathData.id,
                            points: pathData.points.map(p => ({ x: p.x, y: p.y, pressure: p.pressure })),
                            color: pathData.color,
                            size: pathData.size,
                            opacity: pathData.opacity,
                            tool: pathData.tool,
                            isComplete: pathData.isComplete,
                            graphics: null
                        };
                        
                        if (layerManager.rebuildPathGraphics) {
                            layerManager.rebuildPathGraphics(restoredPath);
                            if (restoredPath.graphics) {
                                layer.addChild(restoredPath.graphics);
                            }
                        }
                        
                        return restoredPath;
                    });
                });
                
                for (let i = 0; i < currentLayers.length; i++) {
                    layerManager.requestThumbnailUpdate(i);
                }
                
                const animSys = this.coreEngine.getAnimationSystem();
                if (animSys) {
                    setTimeout(() => {
                        const animData = animSys.getAnimationData();
                        if (animData && animData.cuts) {
                            for (let i = 0; i < animData.cuts.length; i++) {
                                if (animSys.generateCutThumbnailOptimized) {
                                    animSys.generateCutThumbnailOptimized(i);
                                }
                            }
                        }
                    }, 500);
                }
                
                const canvasInfoElement = document.getElementById('canvas-info');
                if (canvasInfoElement) {
                    canvasInfoElement.textContent = `${oldWidth}×${oldHeight}px`;
                }
            },
            meta: { 
                type: 'resize-canvas', 
                from: { width: oldWidth, height: oldHeight },
                to: { width: newWidth, height: newHeight },
                align: alignOptions
            }
        };
        
        this.history.push(command);
        this.hide();
    }
    
    _serializePathForSnapshot(path) {
        return {
            id: path.id,
            points: path.points ? path.points.map(p => ({ x: p.x, y: p.y, pressure: p.pressure })) : [],
            color: path.color,
            size: path.size,
            opacity: path.opacity,
            tool: path.tool,
            isComplete: path.isComplete
        };
    }
    
    _updateUI() {
        this._updateWidthSlider(this.currentWidth);
        this._updateHeightSlider(this.currentHeight);
        this._setHorizontalAlign(this.horizontalAlign);
        this._setVerticalAlign(this.verticalAlign);
    }
    
    show() {
        if (!this.popup) {
            this._ensurePopupElement();
        }
        
        if (!this.popup) return;
        
        this.popup.classList.add('show');
        this.isVisible = true;
        
        requestAnimationFrame(() => {
            const config = window.TEGAKI_CONFIG;
            this.currentWidth = config?.canvas?.width || 344;
            this.currentHeight = config?.canvas?.height || 135;
            
            if (!this.initialized) {
                this.initialize();
            } else {
                this._updateUI();
            }
        });
    }
    
    hide() {
        if (!this.popup) return;
        
        this.popup.classList.remove('show');
        this.isVisible = false;
    }
    
    toggle() {
        if (this.isVisible) {
            this.hide();
        } else {
            this.show();
        }
    }
    
    isReady() {
        return !!this.popup && this.initialized;
    }
    
    destroy() {
        this._cleanupEventListeners();
        this.elements = {};
        this.initialized = false;
        this.isDraggingWidth = false;
        this.isDraggingHeight = false;
    }
};

window.ResizePopup = window.TegakiUI.ResizePopup;

console.log('✅ resize-popup.js (イベントリスナー参照修正版) loaded');