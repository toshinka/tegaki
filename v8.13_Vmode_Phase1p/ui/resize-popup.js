// ===== ui/resize-popup.js - PopupManager対応統一版 =====
// 責務: キャンバスリサイズUI表示、ユーザー入力受付、History統合
// 🔥 改修: IIFE→クラス型変換、PopupManager統合、settings-popup.jsパターン適用

window.TegakiUI = window.TegakiUI || {};

window.TegakiUI.ResizePopup = class {
    constructor(dependencies) {
        this.coreEngine = dependencies.coreEngine;
        this.history = dependencies.history;
        this.eventBus = window.TegakiEventBus;
        
        this.popup = null;
        this.isVisible = false;
        this.sliders = {};
        this.initialized = false;
        
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
            
            <!-- 横方向配置 -->
            <div class="resize-compact-group">
                <div class="resize-compact-label">横配置</div>
                <div class="resize-align-row">
                    <button class="resize-align-btn" id="horizontal-align-left">←</button>
                    <button class="resize-align-btn active" id="horizontal-align-center">↔</button>
                    <button class="resize-align-btn" id="horizontal-align-right">→</button>
                </div>
            </div>
            
            <!-- 幅スライダー -->
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
            
            <!-- 縦方向配置 -->
            <div class="resize-compact-group">
                <div class="resize-compact-label">縦配置</div>
                <div class="resize-align-row">
                    <button class="resize-align-btn" id="vertical-align-top">↑</button>
                    <button class="resize-align-btn active" id="vertical-align-center">↕</button>
                    <button class="resize-align-btn" id="vertical-align-bottom">↓</button>
                </div>
            </div>
            
            <!-- 高さスライダー -->
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
            
            <!-- プリセットボタン -->
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
            
            <!-- 適用ボタン -->
            <button class="resize-apply-btn" id="apply-resize">適用</button>
            
            <!-- 隠し入力欄（将来の拡張用） -->
            <input type="number" class="resize-hidden-input" id="canvas-width-input">
            <input type="number" class="resize-hidden-input" id="canvas-height-input">
        `;
    }
    
    initialize() {
        if (this.initialized) return;
        
        const config = window.TEGAKI_CONFIG;
        this.currentWidth = config?.canvas?.width || 344;
        this.currentHeight = config?.canvas?.height || 135;
        
        this._setupSliders();
        this._setupAlignmentButtons();
        this._setupStepButtons();
        this._setupPresetButtons();
        this._setupApplyButton();
        
        this._updateUI();
        
        this.initialized = true;
    }
    
    _setupSliders() {
        this.sliders.width = this._createSlider({
            container: document.getElementById('canvas-width-slider'),
            track: document.getElementById('canvas-width-track'),
            handle: document.getElementById('canvas-width-handle'),
            display: document.getElementById('canvas-width-display'),
            min: this.MIN_SIZE,
            max: this.MAX_SIZE,
            initial: this.currentWidth,
            format: (v) => `${v}px`,
            onChange: (v) => {
                this.currentWidth = v;
            }
        });
        
        this.sliders.height = this._createSlider({
            container: document.getElementById('canvas-height-slider'),
            track: document.getElementById('canvas-height-track'),
            handle: document.getElementById('canvas-height-handle'),
            display: document.getElementById('canvas-height-display'),
            min: this.MIN_SIZE,
            max: this.MAX_SIZE,
            initial: this.currentHeight,
            format: (v) => `${v}px`,
            onChange: (v) => {
                this.currentHeight = v;
            }
        });
    }
    
    _createSlider(options) {
        const { container, track, handle, display, min, max, initial, format, onChange } = options;
        
        if (!container || !track || !handle) return null;
        
        let currentValue = initial;
        let dragging = false;
        
        const updateUI = (newValue) => {
            currentValue = Math.max(min, Math.min(max, Math.round(newValue)));
            const percentage = ((currentValue - min) / (max - min)) * 100;
            
            track.style.width = percentage + '%';
            handle.style.left = percentage + '%';
            
            if (display) {
                display.textContent = format ? format(currentValue) : currentValue;
            }
        };
        
        const getValue = (clientX) => {
            const rect = container.getBoundingClientRect();
            const percentage = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
            return min + (percentage * (max - min));
        };
        
        const handleMouseDown = (e) => {
            dragging = true;
            const newValue = getValue(e.clientX);
            updateUI(newValue);
            if (onChange) onChange(currentValue);
            e.preventDefault();
        };
        
        const handleMouseMove = (e) => {
            if (!dragging) return;
            const newValue = getValue(e.clientX);
            updateUI(newValue);
            if (onChange) onChange(currentValue);
        };
        
        const handleMouseUp = () => {
            if (!dragging) return;
            dragging = false;
        };
        
        container.addEventListener('mousedown', handleMouseDown);
        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);
        
        updateUI(initial);
        
        return {
            getValue: () => currentValue,
            setValue: (v) => {
                updateUI(v);
                if (onChange) onChange(currentValue);
            },
            destroy: () => {
                container.removeEventListener('mousedown', handleMouseDown);
                document.removeEventListener('mousemove', handleMouseMove);
                document.removeEventListener('mouseup', handleMouseUp);
            }
        };
    }
    
    _setupAlignmentButtons() {
        const hLeft = document.getElementById('horizontal-align-left');
        const hCenter = document.getElementById('horizontal-align-center');
        const hRight = document.getElementById('horizontal-align-right');
        
        const vTop = document.getElementById('vertical-align-top');
        const vCenter = document.getElementById('vertical-align-center');
        const vBottom = document.getElementById('vertical-align-bottom');
        
        if (hLeft) hLeft.addEventListener('click', () => this._setHorizontalAlign('left'));
        if (hCenter) hCenter.addEventListener('click', () => this._setHorizontalAlign('center'));
        if (hRight) hRight.addEventListener('click', () => this._setHorizontalAlign('right'));
        
        if (vTop) vTop.addEventListener('click', () => this._setVerticalAlign('top'));
        if (vCenter) vCenter.addEventListener('click', () => this._setVerticalAlign('center'));
        if (vBottom) vBottom.addEventListener('click', () => this._setVerticalAlign('bottom'));
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
    
    _setupStepButtons() {
        const wDecrease = document.getElementById('width-decrease');
        const wIncrease = document.getElementById('width-increase');
        const hDecrease = document.getElementById('height-decrease');
        const hIncrease = document.getElementById('height-increase');
        
        if (wDecrease) wDecrease.addEventListener('click', () => {
            if (this.sliders.width) {
                this.sliders.width.setValue(this.currentWidth - 1);
            }
        });
        
        if (wIncrease) wIncrease.addEventListener('click', () => {
            if (this.sliders.width) {
                this.sliders.width.setValue(this.currentWidth + 1);
            }
        });
        
        if (hDecrease) hDecrease.addEventListener('click', () => {
            if (this.sliders.height) {
                this.sliders.height.setValue(this.currentHeight - 1);
            }
        });
        
        if (hIncrease) hIncrease.addEventListener('click', () => {
            if (this.sliders.height) {
                this.sliders.height.setValue(this.currentHeight + 1);
            }
        });
    }
    
    _setupPresetButtons() {
        const presetBtns = document.querySelectorAll('.resize-preset-btn');
        presetBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                const width = parseInt(btn.getAttribute('data-width'));
                const height = parseInt(btn.getAttribute('data-height'));
                
                if (this.sliders.width) this.sliders.width.setValue(width);
                if (this.sliders.height) this.sliders.height.setValue(height);
            });
        });
    }
    
    _setupApplyButton() {
        const applyBtn = document.getElementById('apply-resize');
        if (!applyBtn) return;
        
        applyBtn.addEventListener('click', () => {
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
        if (this.sliders.width) this.sliders.width.setValue(this.currentWidth);
        if (this.sliders.height) this.sliders.height.setValue(this.currentHeight);
        this._setHorizontalAlign(this.horizontalAlign);
        this._setVerticalAlign(this.verticalAlign);
    }
    
    // ===== 必須インターフェース =====
    
    show() {
        if (!this.popup) {
            this._ensurePopupElement();
        }
        
        if (!this.popup) return;
        
        if (!this.initialized) {
            this.initialize();
        }
        
        const config = window.TEGAKI_CONFIG;
        this.currentWidth = config?.canvas?.width || 344;
        this.currentHeight = config?.canvas?.height || 135;
        this._updateUI();
        
        this.popup.classList.add('show');
        this.isVisible = true;
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
        return !!this.popup;
    }
    
    destroy() {
        Object.values(this.sliders).forEach(slider => {
            if (slider?.destroy) {
                slider.destroy();
            }
        });
        this.sliders = {};
        this.initialized = false;
    }
};

// グローバル公開
window.ResizePopup = window.TegakiUI.ResizePopup;

console.log('✅ resize-popup.js (PopupManager統一版) loaded');