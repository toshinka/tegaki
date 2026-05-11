// ==================================================
// tegaki.js - Phase 9: UI改善版（中央揃え・額縁・移動対応）
// ==================================================

(function() {
    'use strict';
    
    // Perfect-freehandの確認
    if (!window.perfectFreehand) {
        console.error('[Tegaki] perfect-freehand not loaded!');
    }
    
    class HistoryManager {
        constructor(maxSteps = 50) { 
            this.undoStack = []; 
            this.redoStack = []; 
            this.maxSteps = maxSteps; 
        }
        saveState(layersData) { 
            this.undoStack.push(layersData); 
            if (this.undoStack.length > this.maxSteps) { 
                this.undoStack.shift(); 
            } 
            this.redoStack = []; 
        }
        canUndo() { return this.undoStack.length > 0; }
        canRedo() { return this.redoStack.length > 0; }
        undo(currentState) { 
            if (!this.canUndo()) return null; 
            this.redoStack.push(currentState); 
            return this.undoStack.pop(); 
        }
        redo(currentState) { 
            if (!this.canRedo()) return null; 
            this.undoStack.push(currentState); 
            return this.redoStack.pop(); 
        }
        clear() { 
            this.undoStack = []; 
            this.redoStack = []; 
        }
    }

    class Layer {
        constructor(id, name, width = 400, height = 400, isBackground = false) { 
            this.id = id; 
            this.name = name; 
            this.visible = true; 
            this.isBackground = isBackground; 
            this.canvas = document.createElement('canvas'); 
            this.canvas.width = width; 
            this.canvas.height = height; 
            this.ctx = this.canvas.getContext('2d'); 
            if (isBackground) { 
                this.ctx.fillStyle = '#f0e0d6'; 
                this.ctx.fillRect(0, 0, width, height); 
            } 
        }
        clear() { 
            this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height); 
            if (this.isBackground) { 
                this.ctx.fillStyle = '#f0e0d6'; 
                this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height); 
            } 
        }
        getImageData() { return this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height); }
        putImageData(imageData) { this.ctx.putImageData(imageData, 0, 0); }
    }
    
    window.TegakiCore = class TegakiCore {
        constructor(container) {
            this.container = container;
            this.wrapper = null;
            this.displayCanvas = null;
            this.displayCtx = null;
            this.previewCanvas = null;
            this.previewCtx = null;
            this.canvasContainer = null;
            this.frameOverlay = null;
            this.layers = [];
            this.activeLayerIndex = 0;
            this.layerIdCounter = 0;
            this.history = new HistoryManager(50);
            this.isRestoringState = false;
            this.isDrawing = false;
            this.isPanning = false;
            this.lastPanX = 0;
            this.lastPanY = 0;
            this.spacePressed = false;
            
            // Tool properties
            this.tool = 'pen';
            this.color = '#800000';
            this.size = 3;
            this.opacity = 1.0;
            
            // perfect-freehand
            this.strokePoints = [];
            this.smoothing = 0.5;
            this.pressureSensitivity = 0.5;
            this.activeSizeButton = null;
            
            // Canvas transform
            this.scale = 1.0;
            this.rotation = 0;
            this.offsetX = 0;
            this.offsetY = 0;
            
            this.colors = ['#800000', '#aa5a56', '#cf9c97', '#e9c2ba', '#f0e0d6', '#ffffee'];
            this.icons = {
                pen: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#800000" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z"/></svg>`,
                eraser: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#800000" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 21H8a2 2 0 0 1-1.42-.587l-3.994-3.999a2 2 0 0 1 0-2.828l10-10a2 2 0 0 1 2.829 0l5.999 6a2 2 0 0 1 0 2.828L12.834 21"/><path d="m5.082 11.09 8.828 8.828"/></svg>`,
                bucket: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#800000" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m19 11-8-8-8.6 8.6a2 2 0 0 0 0 2.8l5.2 5.2c.8.8 2 .8 2.8 0L19 11Z"/><path d="m5 2 5 5"/><path d="M2 13h15"/></svg>`,
                eye: `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#800000" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0"/><circle cx="12" cy="12" r="3"/></svg>`,
                eyeOff: `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#800000" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.733 5.076a10.744 10.744 0 0 1 11.205 6.575 1 1 0 0 1 0 .696 10.747 10.747 0 0 1-1.444 2.49"/><path d="M14.084 14.158a3 3 0 0 1-4.242-4.242"/><path d="M17.479 17.499a10.75 10.75 0 0 1-15.417-5.151 1 1 0 0 1 0-.696 10.75 10.75 0 0 1 4.446-5.143"/><path d="m2 2 20 20"/></svg>`,
                addLayer: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#800000" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="15" x2="15" y1="12" y2="18"/><line x1="12" x2="18" y1="15" y2="15"/><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>`,
                deleteLayer: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#800000" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 11v6"/><path d="M14 11v6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M3 6h18"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>`,
                trash: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#800000" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 11v6"/><path d="M14 11v6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M3 6h18"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>`,
                undo: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#800000" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 14 4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 5.5 5.5a5.5 5.5 0 0 1-5.5 5.5H11"/></svg>`,
                redo: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#800000" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m15 14 5-5-5-5"/><path d="M20 9H9.5A5.5 5.5 0 0 0 4 14.5A5.5 5.5 0 0 0 9.5 20H13"/></svg>`,
                flipH: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#800000" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="m3 7 5 5-5 5V7"/><path d="m21 7-5 5 5 5V7"/><path d="M12 20v2"/><path d="M12 14v2"/><path d="M12 8v2"/><path d="M12 2v2"/></svg>`,
                flipV: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#800000" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="m17 3-5 5-5-5h10"/><path d="m17 21-5-5-5 5h10"/><path d="M4 12H2"/><path d="M10 12H8"/><path d="M16 12h-2"/><path d="M22 12h-2"/></svg>`,
                rotateCcw: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#800000" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>`,
                rotateCw: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#800000" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/></svg>`,
                refresh: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#800000" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8"/><path d="M3 10a2 2 0 0 1 .709-1.528l7-6a2 2 0 0 1 2.582 0l7 6A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg>`
            };
            
            this.init();
        }
        
        init() {
            console.log('[Tegaki Core] Initializing Phase 9...');
            this.createUI();
            this.initLayers();
            this.updateLayerPanel();
            this.attachEvents();
            this.renderLayers();
            this.captureState();
            console.log('[Tegaki Core] ✓ Phase 9 initialized');
        }
        
        captureState() { 
            if (this.isRestoringState) return; 
            const state = { 
                layers: this.layers.map(layer => ({ 
                    id: layer.id, 
                    name: layer.name, 
                    visible: layer.visible, 
                    isBackground: layer.isBackground, 
                    imageData: layer.getImageData() 
                })), 
                activeLayerIndex: this.activeLayerIndex 
            }; 
            this.history.saveState(state); 
            this.updateUndoRedoButtons(); 
        }
        
        restoreState(state) { 
            if (!state) return; 
            this.isRestoringState = true; 
            this.layers = state.layers.map(layerData => { 
                const layer = new Layer(layerData.id, layerData.name, 400, 400, layerData.isBackground); 
                layer.visible = layerData.visible; 
                layer.putImageData(layerData.imageData); 
                return layer; 
            }); 
            this.activeLayerIndex = state.activeLayerIndex; 
            this.updateLayerPanel(); 
            this.renderLayers(); 
            this.updateUndoRedoButtons(); 
            this.isRestoringState = false; 
        }
        
        undo() { 
            const currentState = { 
                layers: this.layers.map(layer => ({ 
                    id: layer.id, name: layer.name, visible: layer.visible, 
                    isBackground: layer.isBackground, imageData: layer.getImageData() 
                })), 
                activeLayerIndex: this.activeLayerIndex 
            }; 
            const prevState = this.history.undo(currentState); 
            if (prevState) this.restoreState(prevState); 
        }
        
        redo() { 
            const currentState = { 
                layers: this.layers.map(layer => ({ 
                    id: layer.id, name: layer.name, visible: layer.visible, 
                    isBackground: layer.isBackground, imageData: layer.getImageData() 
                })), 
                activeLayerIndex: this.activeLayerIndex 
            }; 
            const nextState = this.history.redo(currentState); 
            if (nextState) this.restoreState(nextState); 
        }
        
        updateUndoRedoButtons() { 
            const undoBtn = document.getElementById('tegaki-undo-btn'); 
            const redoBtn = document.getElementById('tegaki-redo-btn'); 
            const trashBtn = document.getElementById('tegaki-trash-btn'); 
            if (undoBtn) { 
                undoBtn.disabled = !this.history.canUndo(); 
                undoBtn.style.opacity = this.history.canUndo() ? '1' : '0.5'; 
            } 
            if (redoBtn) { 
                redoBtn.disabled = !this.history.canRedo(); 
                redoBtn.style.opacity = this.history.canRedo() ? '1' : '0.5'; 
            } 
            if (trashBtn) { 
                const canClear = this.layers.length > 1;
                trashBtn.disabled = !canClear; 
                trashBtn.style.opacity = canClear ? '1' : '0.5'; 
            } 
        }
        
        initLayers() { 
            const bgLayer = new Layer(this.layerIdCounter++, '背景', 400, 400, true); 
            this.layers.push(bgLayer); 
            const layer1 = new Layer(this.layerIdCounter++, 'レイヤー1', 400, 400, false); 
            this.layers.push(layer1); 
            this.activeLayerIndex = 1; 
        }
        
        addLayer() { 
            const newLayer = new Layer(this.layerIdCounter++, `レイヤー${this.layers.length}`, 400, 400, false); 
            this.layers.splice(this.activeLayerIndex + 1, 0, newLayer); 
            this.setActiveLayer(this.activeLayerIndex + 1); 
            this.renderLayers(); 
            this.captureState(); 
        }
        
        deleteLayer(index) { 
            if (this.layers[index].isBackground) return alert('背景レイヤーは削除できません'); 
            if (this.layers.length <= 2) return alert('これ以上レイヤーは削除できません'); 
            this.layers.splice(index, 1); 
            if (this.activeLayerIndex >= index) { 
                this.setActiveLayer(Math.max(1, this.activeLayerIndex - 1)); 
            } 
            this.updateLayerPanel(); 
            this.renderLayers(); 
            this.captureState(); 
        }
        
        setActiveLayer(index) { 
            if (index > 0 && index < this.layers.length) { 
                this.activeLayerIndex = index; 
                this.updateLayerPanel(); 
                this.updateUndoRedoButtons(); 
            } 
        }
        
        toggleLayerVisibility(index) { 
            this.layers[index].visible = !this.layers[index].visible; 
            this.updateLayerPanel(); 
            this.renderLayers(); 
            this.captureState(); 
        }
        
        clearActiveLayer() { 
            if (this.activeLayerIndex === 0) { 
                alert('背景レイヤーはクリアできません。'); 
                return; 
            } 
            if (confirm('現在選択中のレイヤーの内容をすべて削除しますか?\nこの操作は元に戻せます。')) { 
                const activeLayer = this.layers[this.activeLayerIndex]; 
                activeLayer.clear(); 
                this.renderLayers(); 
                this.captureState(); 
            } 
        }
        
        clearAllLayers() {
            if (confirm('すべてのレイヤーをクリアしますか?\nこの操作は元に戻せます。')) {
                this.layers.forEach((layer, i) => {
                    if (i > 0) {
                        layer.clear();
                    }
                });
                this.renderLayers();
                this.captureState();
            }
        }
        
        flipHorizontal() {
            this.layers.forEach(layer => {
                const tempCanvas = document.createElement('canvas');
                tempCanvas.width = layer.canvas.width;
                tempCanvas.height = layer.canvas.height;
                const tempCtx = tempCanvas.getContext('2d');
                tempCtx.save();
                tempCtx.translate(tempCanvas.width, 0);
                tempCtx.scale(-1, 1);
                tempCtx.drawImage(layer.canvas, 0, 0);
                tempCtx.restore();
                layer.clear();
                layer.ctx.drawImage(tempCanvas, 0, 0);
            });
            this.renderLayers();
            this.captureState();
        }
        
        flipVertical() {
            this.layers.forEach(layer => {
                const tempCanvas = document.createElement('canvas');
                tempCanvas.width = layer.canvas.width;
                tempCanvas.height = layer.canvas.height;
                const tempCtx = tempCanvas.getContext('2d');
                tempCtx.save();
                tempCtx.translate(0, tempCanvas.height);
                tempCtx.scale(1, -1);
                tempCtx.drawImage(layer.canvas, 0, 0);
                tempCtx.restore();
                layer.clear();
                layer.ctx.drawImage(tempCanvas, 0, 0);
            });
            this.renderLayers();
            this.captureState();
        }
        
        rotateCanvas(delta) {
            this.rotation += delta;
            this.applyTransform();
        }
        
        scaleCanvas(delta) {
            const factor = delta > 0 ? 1.1 : 0.9;
            this.scale = Math.max(0.1, Math.min(5, this.scale * factor));
            this.applyTransform();
        }
        
        resetTransform() {
            this.scale = 1.0;
            this.rotation = 0;
            this.offsetX = 0;
            this.offsetY = 0;
            this.applyTransform();
        }
        
        applyTransform() {
            if (this.canvasContainer) {
                this.canvasContainer.style.transform = `translate(${this.offsetX}px, ${this.offsetY}px) scale(${this.scale}) rotate(${this.rotation}deg)`;
            }
        }
        
        renderLayers() { 
            this.displayCtx.clearRect(0, 0, 400, 400); 
            this.layers.forEach(layer => { 
                if (layer.visible) { 
                    this.displayCtx.drawImage(layer.canvas, 0, 0); 
                } 
            }); 
        }

        createUI() {
            this.wrapper = document.createElement('div');
            this.wrapper.style.cssText = `display: flex; width: 100%; height: 100%; background: #ffffee; position: relative;`;
            this.wrapper.appendChild(this.createShortcutGuide());
            this.wrapper.appendChild(this.createToolPanel());
            this.wrapper.appendChild(this.createCanvasArea());
            this.wrapper.appendChild(this.createLayerSidebar());
            this.container.appendChild(this.wrapper);
            
            const parentTopBar = this.findParentTopBar();
            if (parentTopBar) {
                this.createTopBarControls(parentTopBar);
            }
        }
        
        createShortcutGuide() {
            const guide = document.createElement('div');
            guide.style.cssText = `
                position: absolute;
                top: 20px;
                left: 90px;
                background: rgba(240, 224, 214, 0.9);
                border: 1px solid #aa5a56;
                border-radius: 4px;
                padding: 12px;
                font-size: 11px;
                color: #800000;
                line-height: 1.6;
                z-index: 1;
                pointer-events: none;
            `;
            guide.innerHTML = `
                <div style="font-weight: bold; margin-bottom: 6px; font-size: 12px;">ショートカット</div>
                <div><b>P</b>: ペン / <b>E</b>: 消しゴム / <b>G</b>: バケツ</div>
                <div><b>Ctrl+Z</b>: 元に戻す / <b>Ctrl+Y</b>: やり直す</div>
                <div><b>H</b>: 左右反転 / <b>Shift+H</b>: 上下反転</div>
                <div><b>スクロール</b>: 拡縮 / <b>Shift+スクロール</b>: 回転</div>
                <div><b>Ctrl+0</b>: 表示リセット</div>
                <div><b>Space+ドラッグ</b> or <b>額縁ドラッグ</b>: 移動</div>
                <div><b>Del/BS</b>: レイヤークリア</div>
            `;
            return guide;
        }
        
        findParentTopBar() {
            let element = this.container;
            while (element) {
                const topBar = element.querySelector('#top-bar');
                if (topBar) return topBar;
                element = element.parentElement;
            }
            return document.querySelector('#top-bar');
        }

        createToolPanel() {
            const panel = document.createElement('div');
            panel.id = 'tegaki-tool-panel';
            panel.style.cssText = `width: 70px; background: #e9c2ba; padding: 8px 6px; display: flex; flex-direction: column; align-items: center; gap: 6px; border-right: 2px solid #cf9c97; overflow-y: auto; z-index: 10;`;
            
            // カラーパレット（2列グリッド）
            const colorPalette = document.createElement('div');
            colorPalette.style.cssText = 'display: grid; grid-template-columns: 1fr 1fr; gap: 4px; width: 100%;';
            this.colors.forEach(c => { 
                const colorBtn = document.createElement('button'); 
                colorBtn.style.cssText = `width: 100%; aspect-ratio: 1; border: 2px solid transparent; border-radius: 2px; padding: 0; background: ${c}; cursor: pointer; transition: border 0.15s;`;
                colorBtn.dataset.color = c; 
                colorBtn.title = c;
                colorBtn.onclick = () => this.setColor(c); 
                colorPalette.appendChild(colorBtn); 
            });
            panel.appendChild(colorPalette);
            panel.appendChild(this.createSeparator());
            
            // ツールボタン（2列グリッド）
            const toolGrid = document.createElement('div');
            toolGrid.style.cssText = 'display: grid; grid-template-columns: 1fr 1fr; gap: 4px; width: 100%;';
            
            this.createToolButton(toolGrid, 'pen', this.icons.pen, 'ペン (P)');
            this.createToolButton(toolGrid, 'eraser', this.icons.eraser, '消しゴム (E)');
            this.createToolButton(toolGrid, 'bucket', this.icons.bucket, 'バケツ (G)');
            
            panel.appendChild(toolGrid);
            panel.appendChild(this.createSeparator());
            
            // サイズプリセット（2列グリッド）
            const sizeGrid = document.createElement('div');
            sizeGrid.style.cssText = 'display: grid; grid-template-columns: 1fr 1fr; gap: 4px; width: 100%;';
            [1, 3, 5, 10, 30].forEach(size => this.createSizePreset(sizeGrid, size));
            panel.appendChild(sizeGrid);
            
            return panel;
        }

        createSizePreset(parent, size) {
            const btn = document.createElement('button');
            btn.dataset.size = size;
            btn.dataset.preset = size;
            btn.title = `${size}px`;
            btn.style.cssText = `width: 100%; aspect-ratio: 1; border-radius: 2px; border: 2px solid transparent; background-color: #f0e0d6; color: #800000; font-size: 13px; font-weight: bold; cursor: pointer; position: relative; display: flex; align-items: center; justify-content: center; transition: border 0.15s;`;
            btn.textContent = size;
            
            const trigger = document.createElement('div');
            trigger.innerHTML = '▼';
            trigger.style.cssText = `position: absolute; bottom: 2px; right: 2px; font-size: 8px; color: #800000; cursor: pointer; background: rgba(240,224,214,0.9); width: 12px; height: 12px; display: flex; align-items: center; justify-content: center; border-radius: 2px; line-height: 1;`;
            btn.appendChild(trigger);
            
            btn.onclick = (e) => {
                this.activeSizeButton = btn;
                if (e.target === trigger || trigger.contains(e.target)) {
                    this.showSizeOpacityPopup(btn);
                } else {
                    this.setSize(parseFloat(btn.dataset.preset));
                    this.updateSizeUI();
                }
            };
            parent.appendChild(btn);
        }
        
        createToolButton(parent, toolName, svgHTML, title) {
            const btn = this.createIconButton(svgHTML, title, null, this.tool === toolName);
            btn.dataset.tool = toolName;
            btn.style.width = '100%';
            btn.style.aspectRatio = '1';
            btn.style.borderRadius = '2px';
            btn.style.position = 'relative';
            btn.onclick = (e) => { this.setTool(toolName); };
            
            if (toolName === 'pen') {
                const trigger = document.createElement('div');
                trigger.innerHTML = '▼';
                trigger.style.cssText = `position: absolute; bottom: 2px; right: 2px; font-size: 8px; color: #800000; cursor: pointer; background: rgba(240,224,214,0.9); width: 12px; height: 12px; display: flex; align-items: center; justify-content: center; border-radius: 2px; line-height: 1;`;
                trigger.onclick = (e) => { e.stopPropagation(); this.setTool(toolName); this.showPenSettingsPopup(btn); };
                btn.appendChild(trigger);
            }
            parent.appendChild(btn);
        }

        showPopup(targetButton, contentCreator) {
            this.closePopup();
            const rect = targetButton.getBoundingClientRect();
            const popup = document.createElement('div');
            popup.id = 'tegaki-popup';
            popup.style.cssText = `position: fixed; left: ${rect.right + 5}px; top: ${rect.top}px; background: #e9c2ba; border: 2px solid #cf9c97; padding: 10px; border-radius: 4px; z-index: 100; display: flex; flex-direction: column; gap: 10px; box-shadow: 2px 2px 5px rgba(0,0,0,0.2);`;
            
            const createSlider = (label, min, max, step, value, onInput) => {
                const container = document.createElement('div');
                const labelEl = document.createElement('div');
                const updateLabel = (val) => { labelEl.textContent = `${label}: ${parseFloat(val).toFixed(step < 1 ? 1 : 0)}`; };
                updateLabel(value);
                labelEl.style.cssText = 'font-size: 12px; color: #800000;';
                const slider = document.createElement('input');
                slider.type = 'range'; slider.min = min; slider.max = max; slider.step = step; slider.value = value;
                slider.style.cssText = 'width: 120px; accent-color: #800000;';
                slider.oninput = () => { onInput(parseFloat(slider.value)); updateLabel(slider.value); };
                container.appendChild(labelEl); container.appendChild(slider);
                return container;
            };
            contentCreator(popup, createSlider);
            document.body.appendChild(popup);
            setTimeout(() => { document.addEventListener('pointerdown', this.closePopup, { once: true }); }, 0);
        }

        showSizeOpacityPopup(targetButton) {
            this.showPopup(targetButton, (popup, createSlider) => {
                popup.appendChild(createSlider('サイズ', 0.5, 100, 0.5, this.size, (val) => this.setSize(val)));
                popup.appendChild(createSlider('不透明度', 0.1, 1, 0.1, this.opacity, (val) => this.setOpacity(val)));
            });
        }

        showPenSettingsPopup(targetButton) {
            this.showPopup(targetButton, (popup, createSlider) => {
                popup.appendChild(createSlider('筆圧感度', 0.1, 2, 0.1, this.pressureSensitivity, (val) => this.pressureSensitivity = val));
                popup.appendChild(createSlider('手ブレ補正', 0, 0.9, 0.1, this.smoothing, (val) => this.smoothing = val));
            });
        }
        
        closePopup(e) {
            const popup = document.getElementById('tegaki-popup');
            if (popup && (!e || !popup.contains(e.target))) { popup.remove(); }
        }
        
        createSeparator() { const sep = document.createElement('div'); sep.style.cssText = 'width: 90%; height: 1px; background: #cf9c97; margin: 2px 0;'; return sep; }
        
        createIconButton(svgHTML, title, onClick, isSelected = false) { 
            const btn = document.createElement('button'); 
            btn.innerHTML = svgHTML; 
            btn.title = title; 
            btn.style.cssText = `width: 32px; height: 32px; border-radius: 2px; border: 2px solid ${isSelected ? '#800000' : 'transparent'}; background-color: ${isSelected ? '#f0e0d6' : 'transparent'}; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: all 0.15s; padding: 0;`; 
            btn.onmouseover = () => { if(btn.style.borderColor === 'transparent') btn.style.backgroundColor = 'rgba(240,224,214,0.5)'; }; 
            btn.onmouseout = () => { if(btn.style.borderColor === 'transparent') btn.style.backgroundColor = 'transparent'; }; 
            if (onClick) btn.onclick = onClick; 
            return btn; 
        }
        
        createCanvasArea() { 
            const area = document.createElement('div'); 
            area.style.cssText = `flex: 1; display: flex; justify-content: center; align-items: center; overflow: auto; padding: 20px; position: relative;`; 
            
            // 額縁を含むラッパー
            const frameWrapper = document.createElement('div');
            frameWrapper.style.cssText = `position: relative; padding: 30px; background: white; box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3); cursor: grab;`;
            frameWrapper.id = 'tegaki-frame-wrapper';
            
            this.canvasContainer = document.createElement('div'); 
            this.canvasContainer.style.cssText = `position: relative; width: 400px; height: 400px; flex-shrink: 0; transition: transform 0.1s ease-out;`; 
            
            this.displayCanvas = document.createElement('canvas'); 
            this.displayCanvas.width = 400; 
            this.displayCanvas.height = 400; 
            this.displayCanvas.style.cssText = `position: absolute; top: 0; left: 0; background-color: #fff;`; 
            this.displayCtx = this.displayCanvas.getContext('2d'); 
            
            this.previewCanvas = document.createElement('canvas'); 
            this.previewCanvas.width = 400; 
            this.previewCanvas.height = 400; 
            this.previewCanvas.style.cssText = `position: absolute; top: 0; left: 0; cursor: crosshair; touch-action: none;`; 
            this.previewCtx = this.previewCanvas.getContext('2d'); 
            
            // 額縁用の透明オーバーレイ（描画可能領域を拡張）
            this.frameOverlay = document.createElement('canvas');
            this.frameOverlay.width = 460;
            this.frameOverlay.height = 460;
            this.frameOverlay.style.cssText = `position: absolute; top: -30px; left: -30px; pointer-events: none;`;
            
            this.canvasContainer.appendChild(this.displayCanvas); 
            this.canvasContainer.appendChild(this.previewCanvas);
            this.canvasContainer.appendChild(this.frameOverlay);
            
            frameWrapper.appendChild(this.canvasContainer);
            area.appendChild(frameWrapper); 
            return area; 
        }
        
        createLayerSidebar() { 
            const sidebar = document.createElement('div'); 
            sidebar.style.cssText = `width: 180px; background: transparent; padding: 8px 6px; display: flex; flex-direction: column; gap: 12px; border-left: 2px solid #cf9c97; overflow-y: auto; z-index: 10;`; 
            sidebar.appendChild(this.createLayerPanel()); 
            return sidebar; 
        }
        
        createLayerPanel() { 
            const panel = document.createElement('div'); 
            panel.id = 'tegaki-layer-panel'; 
            panel.style.cssText = `display: flex; flex-direction: column; gap: 6px;`; 
            
            const label = this.createLabel('レイヤー'); 
            
            const controls = document.createElement('div'); 
            controls.style.cssText = `display: grid; grid-template-columns: 1fr 1fr; gap: 4px;`; 
            
            const addBtn = this.createIconButton(this.icons.addLayer, 'レイヤー追加', () => this.addLayer()); 
            const delBtn = this.createIconButton(this.icons.deleteLayer, 'レイヤー削除', () => { if (confirm('選択中のレイヤーを削除しますか?')) this.deleteLayer(this.activeLayerIndex); }); 
            controls.appendChild(addBtn); 
            controls.appendChild(delBtn); 
            
            const layerList = document.createElement('div'); 
            layerList.id = 'tegaki-layer-list'; 
            layerList.style.cssText = `display: flex; flex-direction: column-reverse; gap: 3px;`; 
            
            panel.appendChild(label); 
            panel.appendChild(controls); 
            panel.appendChild(layerList); 
            return panel; 
        }
        
        createTopBarControls(topBar) {
            if (!topBar) {
                console.warn('[Tegaki] No top bar found, skipping top bar controls');
                return;
            }
            
            const oldPostBtn = topBar.querySelector('#post-button');
            if (oldPostBtn) oldPostBtn.remove();
            
            const buttonGroup = topBar.querySelector('.button-group');
            if (!buttonGroup) {
                console.warn('[Tegaki] No button group found in top bar');
                return;
            }
            buttonGroup.innerHTML = '';
            buttonGroup.style.cssText = 'display: flex; align-items: center; justify-content: center; gap: 6px; width: 100%;';
            
            const createBtn = (id, html, title, onClick, color = '#f0e0d6') => { 
                const btn = document.createElement('button'); 
                btn.id = id; 
                btn.innerHTML = html; 
                btn.title = title; 
                btn.style.cssText = `padding: 6px 10px; background: ${color}; color: #800000; border: 1px solid #aa5a56; border-radius: 4px; cursor: pointer; font-size: 14px; transition: all 0.2s; display: flex; align-items: center; justify-content: center;`; 
                btn.onmouseover = () => { if (!btn.disabled) btn.style.background = '#e9c2ba'; }; 
                btn.onmouseout = () => btn.style.background = color; 
                btn.onclick = onClick; 
                return btn; 
            };
            
            const trashBtn = createBtn('tegaki-trash-btn', this.icons.trash, 'すべてクリア (Del)', () => this.clearAllLayers());
            const undoBtn = createBtn('tegaki-undo-btn', this.icons.undo, '元に戻す (Ctrl+Z)', () => this.undo());
            const redoBtn = createBtn('tegaki-redo-btn', this.icons.redo, 'やり直す (Ctrl+Y)', () => this.redo());
            const flipHBtn = createBtn('tegaki-fliph-btn', this.icons.flipH, '左右反転 (H)', () => this.flipHorizontal());
            const flipVBtn = createBtn('tegaki-flipv-btn', this.icons.flipV, '上下反転 (Shift+H)', () => this.flipVertical());
            const rotateCcwBtn = createBtn('tegaki-rotateccw-btn', this.icons.rotateCcw, '反時計回り (Shift+スクロール)', () => this.rotateCanvas(-90));
            const rotateCwBtn = createBtn('tegaki-rotatecw-btn', this.icons.rotateCw, '時計回り', () => this.rotateCanvas(90));
            const resetBtn = createBtn('tegaki-reset-btn', this.icons.refresh, 'リセット (Ctrl+0)', () => this.resetTransform());
            
            buttonGroup.appendChild(trashBtn);
            buttonGroup.appendChild(undoBtn);
            buttonGroup.appendChild(redoBtn);
            buttonGroup.appendChild(flipHBtn);
            buttonGroup.appendChild(flipVBtn);
            buttonGroup.appendChild(rotateCcwBtn);
            buttonGroup.appendChild(rotateCwBtn);
            buttonGroup.appendChild(resetBtn);
            
            this.updateUndoRedoButtons(); 
        }
        
        createLabel(text) { 
            const label = document.createElement('div'); 
            label.textContent = text; 
            label.style.cssText = `font-size: 11px; color: #800000; font-weight: bold; text-align: center; padding: 3px 0; background: #f0e0d6; border-radius: 2px;`; 
            return label; 
        }
        
        updateLayerPanel() { 
            const layerList = document.getElementById('tegaki-layer-list'); 
            if (!layerList) return; 
            layerList.innerHTML = ''; 
            this.layers.forEach((layer, i) => { 
                const isActive = i === this.activeLayerIndex; 
                const item = document.createElement('div'); 
                item.style.cssText = `display: flex; align-items: center; gap: 4px; padding: 4px; background: ${isActive ? '#800000' : 'rgba(240, 224, 214, 0.5)'}; color: ${isActive ? 'white' : '#800000'}; border: 1px solid ${isActive ? '#800000' : '#aa5a56'}; border-radius: 2px; cursor: ${layer.isBackground ? 'default' : 'pointer'}; font-size: 11px; transition: background 0.15s;`; 
                
                const visibilityToggle = document.createElement('span'); 
                visibilityToggle.innerHTML = layer.visible ? this.icons.eye : this.icons.eyeOff; 
                visibilityToggle.style.cursor = 'pointer'; 
                visibilityToggle.onclick = (e) => { e.stopPropagation(); this.toggleLayerVisibility(i); }; 
                
                const name = document.createElement('span'); 
                name.textContent = layer.name; 
                name.style.cssText = `flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;`; 
                
                if (!layer.isBackground) item.onclick = () => this.setActiveLayer(i); 
                item.appendChild(visibilityToggle); 
                item.appendChild(name); 
                layerList.appendChild(item); 
            }); 
        }
        
        setTool(toolName) { 
            this.tool = toolName; 
            document.querySelectorAll('#tegaki-tool-panel button[data-tool]').forEach(btn => { 
                const isSelected = btn.dataset.tool === toolName; 
                btn.style.borderColor = isSelected ? '#800000' : 'transparent'; 
                btn.style.backgroundColor = isSelected ? '#f0e0d6' : 'transparent'; 
            }); 
            this.closePopup(); 
        }
        
        setSize(size) { 
            this.size = Math.max(0.5, size); 
            if (this.activeSizeButton) { 
                const sizeStr = Number.isInteger(size) ? size : size.toFixed(1); 
                const trigger = this.activeSizeButton.querySelector('div'); 
                this.activeSizeButton.textContent = sizeStr; 
                if (trigger) this.activeSizeButton.appendChild(trigger); 
                this.activeSizeButton.dataset.preset = size;
            } 
            this.updateSizeUI(); 
        }
        
        setOpacity(opacity) { 
            this.opacity = Math.max(0, Math.min(1, opacity)); 
        }
        
        updateSizeUI() { 
            let isPresetActive = false; 
            document.querySelectorAll('#tegaki-tool-panel button[data-size]').forEach(btn => { 
                const presetSize = parseFloat(btn.dataset.preset); 
                if (Math.abs(presetSize - this.size) < 0.1) { 
                    btn.style.borderColor = '#800000'; 
                    btn.style.borderWidth = '3px';
                    isPresetActive = true; 
                } else { 
                    btn.style.borderColor = 'transparent'; 
                    btn.style.borderWidth = '2px';
                } 
            }); 
            if (!isPresetActive && this.activeSizeButton) { 
                this.activeSizeButton.style.borderColor = '#800000'; 
                this.activeSizeButton.style.borderWidth = '3px';
            } 
        }
        
        setColor(color) { 
            this.color = color; 
            document.querySelectorAll('[data-color]').forEach(el => { 
                if (el.dataset.color === color) {
                    el.style.borderColor = '#800000';
                    el.style.borderWidth = '3px';
                } else {
                    el.style.borderColor = 'transparent';
                    el.style.borderWidth = '2px';
                }
            }); 
        }

        attachEvents() {
            // 額縁エリアでのパン操作
            const frameWrapper = document.getElementById('tegaki-frame-wrapper');
            if (frameWrapper) {
                frameWrapper.addEventListener('pointerdown', (e) => {
                    const rect = this.previewCanvas.getBoundingClientRect();
                    const isOutsideCanvas = 
                        e.clientX < rect.left || e.clientX > rect.right ||
                        e.clientY < rect.top || e.clientY > rect.bottom;
                    
                    if (isOutsideCanvas || this.spacePressed) {
                        e.preventDefault();
                        this.isPanning = true;
                        this.lastPanX = e.clientX;
                        this.lastPanY = e.clientY;
                        frameWrapper.style.cursor = 'grabbing';
                        frameWrapper.setPointerCapture(e.pointerId);
                    }
                });
                
                frameWrapper.addEventListener('pointermove', (e) => {
                    if (this.isPanning) {
                        const dx = e.clientX - this.lastPanX;
                        const dy = e.clientY - this.lastPanY;
                        this.offsetX += dx;
                        this.offsetY += dy;
                        this.lastPanX = e.clientX;
                        this.lastPanY = e.clientY;
                        this.applyTransform();
                    }
                });
                
                frameWrapper.addEventListener('pointerup', (e) => {
                    if (this.isPanning) {
                        this.isPanning = false;
                        frameWrapper.style.cursor = 'grab';
                        frameWrapper.releasePointerCapture(e.pointerId);
                    }
                });
            }
            
            // キャンバス描画イベント
            this.previewCanvas.addEventListener('pointerdown', (e) => this.startDrawing(e));
            this.previewCanvas.addEventListener('pointermove', (e) => this.draw(e));
            this.previewCanvas.addEventListener('pointerup', (e) => this.stopDrawing(e));
            this.previewCanvas.addEventListener('pointerleave', (e) => this.stopDrawing(e));
            
            // キーボードショートカット
            document.addEventListener('keydown', (e) => {
                // Space押下検知
                if (e.code === 'Space' && !this.isDrawing) {
                    e.preventDefault();
                    this.spacePressed = true;
                    if (frameWrapper) frameWrapper.style.cursor = 'grab';
                }
                
                if ((e.ctrlKey || e.metaKey) && !e.shiftKey) { 
                    if (e.key === 'z') { e.preventDefault(); this.undo(); } 
                    if (e.key === 'y') { e.preventDefault(); this.redo(); }
                    if (e.key === '0') { e.preventDefault(); this.resetTransform(); }
                }
                
                if (!e.ctrlKey && !e.metaKey && !e.altKey) {
                    if (e.key === 'p' || e.key === 'P') { e.preventDefault(); this.setTool('pen'); }
                    if (e.key === 'e' || e.key === 'E') { e.preventDefault(); this.setTool('eraser'); }
                    if (e.key === 'g' || e.key === 'G') { e.preventDefault(); this.setTool('bucket'); }
                    if (e.key === 'h' && !e.shiftKey) { e.preventDefault(); this.flipHorizontal(); }
                    if (e.key === 'H' && e.shiftKey) { e.preventDefault(); this.flipVertical(); }
                    if (e.key === 'Delete' || e.key === 'Backspace') { 
                        e.preventDefault(); 
                        this.clearActiveLayer(); 
                    }
                }
            });
            
            document.addEventListener('keyup', (e) => {
                if (e.code === 'Space') {
                    this.spacePressed = false;
                    if (frameWrapper && !this.isPanning) frameWrapper.style.cursor = 'grab';
                }
            });
            
            // マウスホイールで拡縮・回転
            this.previewCanvas.addEventListener('wheel', (e) => {
                e.preventDefault();
                if (e.shiftKey) {
                    this.rotateCanvas(e.deltaY > 0 ? 5 : -5);
                } else {
                    this.scaleCanvas(e.deltaY < 0 ? 1 : -1);
                }
            }, { passive: false });
            
            this.closePopup = this.closePopup.bind(this);
        }
        
        startDrawing(e) {
            if (!e.isPrimary || this.layers[this.activeLayerIndex].isBackground || this.spacePressed) return;
            
            // 額縁領域を含めた座標計算
            const canvasRect = this.previewCanvas.getBoundingClientRect();
            const x = e.clientX - canvasRect.left; 
            const y = e.clientY - canvasRect.top;
            
            if (this.tool === 'bucket') { 
                if (x >= 0 && x < 400 && y >= 0 && y < 400) {
                    this.floodFill(x, y); 
                }
                return; 
            }
            
            this.isDrawing = true;
            this.previewCanvas.setPointerCapture(e.pointerId);
            this.strokePoints = [[x, y, e.pressure > 0 ? e.pressure * this.pressureSensitivity : 0.5]];
            this.draw(e);
        }
        
        draw(e) {
            if (!this.isDrawing || !e.isPrimary) return;
            
            const canvasRect = this.previewCanvas.getBoundingClientRect();
            const x = e.clientX - canvasRect.left; 
            const y = e.clientY - canvasRect.top;
            
            this.strokePoints.push([x, y, e.pressure > 0 ? e.pressure * this.pressureSensitivity : 0.5]);
            
            this.previewCtx.clearRect(0, 0, 400, 400);
            
            if (!window.perfectFreehand || !window.perfectFreehand.getStroke) {
                console.error('[Tegaki] perfect-freehand not available, falling back to basic drawing');
                this.previewCtx.strokeStyle = this.color;
                this.previewCtx.globalAlpha = this.opacity;
                this.previewCtx.lineWidth = this.size;
                this.previewCtx.lineCap = 'round';
                this.previewCtx.lineJoin = 'round';
                this.previewCtx.globalCompositeOperation = this.tool === 'eraser' ? 'destination-out' : 'source-over';
                this.previewCtx.beginPath();
                if (this.strokePoints.length > 1) {
                    this.previewCtx.moveTo(this.strokePoints[0][0], this.strokePoints[0][1]);
                    for (let i = 1; i < this.strokePoints.length; i++) {
                        this.previewCtx.lineTo(this.strokePoints[i][0], this.strokePoints[i][1]);
                    }
                }
                this.previewCtx.stroke();
                return;
            }
            
            const stroke = window.perfectFreehand.getStroke(this.strokePoints, {
                size: this.size,
                thinning: 0.5,
                smoothing: this.smoothing,
                streamline: 0.5,
                easing: (t) => t,
                start: { taper: 0, cap: true },
                end: { taper: 0, cap: true }
            });

            if (!stroke.length) return;

            this.previewCtx.fillStyle = this.color;
            this.previewCtx.globalAlpha = this.opacity;
            this.previewCtx.globalCompositeOperation = this.tool === 'eraser' ? 'destination-out' : 'source-over';
            
            const path = new Path2D();
            const [firstPoint, ...rest] = stroke;
            path.moveTo(firstPoint[0], firstPoint[1]);
            rest.forEach(([x, y]) => path.lineTo(x, y));
            path.closePath();
            this.previewCtx.fill(path);
        }
        
        stopDrawing(e) {
            if (this.isDrawing) {
                this.isDrawing = false;
                const activeCtx = this.layers[this.activeLayerIndex].ctx;
                activeCtx.drawImage(this.previewCanvas, 0, 0);
                this.previewCtx.clearRect(0, 0, 400, 400);
                this.renderLayers();
                this.captureState();
                if (e) this.previewCanvas.releasePointerCapture(e.pointerId);
            }
        }

        floodFill(startX, startY) {
            const x = Math.floor(startX);
            const y = Math.floor(startY);
            const layer = this.layers[this.activeLayerIndex];
            const imageData = layer.getImageData();
            const pixels = imageData.data;
            const width = imageData.width;
            const height = imageData.height;
            
            if (x < 0 || x >= width || y < 0 || y >= height) return;
            
            const targetColor = this.getPixelColor(pixels, x, y, width);
            const fillColor = this.hexToRgb(this.color);
            if (!fillColor) return;
            
            const fillColorArray = [fillColor.r, fillColor.g, fillColor.b, Math.round(this.opacity * 255)];
            
            if (this.colorsMatch(targetColor, fillColorArray)) return;
            
            const stack = [[x, y]];
            const visited = new Set();
            
            while (stack.length > 0) {
                const [cx, cy] = stack.pop();
                const key = `${cx},${cy}`;
                
                if (visited.has(key)) continue;
                if (cx < 0 || cx >= width || cy < 0 || cy >= height) continue;
                
                const currentColor = this.getPixelColor(pixels, cx, cy, width);
                if (!this.colorsMatch(currentColor, targetColor)) continue;
                
                visited.add(key);
                this.setPixelColor(pixels, cx, cy, width, fillColorArray);
                
                stack.push([cx + 1, cy]);
                stack.push([cx - 1, cy]);
                stack.push([cx, cy + 1]);
                stack.push([cx, cy - 1]);
            }
            
            layer.putImageData(imageData);
            this.renderLayers();
            this.captureState();
        }
        
        getPixelColor(pixels, x, y, width) {
            const index = (y * width + x) * 4;
            return [pixels[index], pixels[index + 1], pixels[index + 2], pixels[index + 3]];
        }
        
        setPixelColor(pixels, x, y, width, color) {
            const index = (y * width + x) * 4;
            pixels[index] = color[0];
            pixels[index + 1] = color[1];
            pixels[index + 2] = color[2];
            pixels[index + 3] = color[3];
        }
        
        colorsMatch(c1, c2) { 
            return c1[0] === c2[0] && c1[1] === c2[1] && c1[2] === c2[2] && c1[3] === c2[3]; 
        }
        
        hexToRgb(hex) { 
            const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex); 
            return result ? { 
                r: parseInt(result[1], 16), 
                g: parseInt(result[2], 16), 
                b: parseInt(result[3], 16) 
            } : null; 
        }
        
        exportAsBlob() {
            return new Promise((resolve) => {
                this.displayCanvas.toBlob((blob) => {
                    resolve(blob);
                }, 'image/png');
            });
        }
        
        destroy() {
            if (this.wrapper && this.wrapper.parentNode) {
                this.wrapper.remove();
            }
            this.displayCanvas = null;
            this.displayCtx = null;
            this.previewCanvas = null;
            this.previewCtx = null;
        }
    };
    
    console.log('✅ tegaki.js Phase 9 loaded');
})();