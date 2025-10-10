// ==================================================
// tegaki.js - Phase 2: アンドゥ/リドゥシステム追加
// お絵かき機能本体 - ふたば風デザイン
// ==================================================

(function() {
    'use strict';
    
    // ===== HistoryManagerクラス =====
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
            console.log('[History] State saved, undo stack:', this.undoStack.length);
        }
        
        canUndo() {
            return this.undoStack.length > 0;
        }
        
        canRedo() {
            return this.redoStack.length > 0;
        }
        
        undo(currentState) {
            if (!this.canUndo()) return null;
            this.redoStack.push(currentState);
            const prevState = this.undoStack.pop();
            console.log('[History] Undo executed');
            return prevState;
        }
        
        redo(currentState) {
            if (!this.canRedo()) return null;
            this.undoStack.push(currentState);
            const nextState = this.redoStack.pop();
            console.log('[History] Redo executed');
            return nextState;
        }
        
        clear() {
            this.undoStack = [];
            this.redoStack = [];
        }
    }
    
    // ===== Layerクラス =====
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
        
        getImageData() {
            return this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);
        }
        
        putImageData(imageData) {
            this.ctx.putImageData(imageData, 0, 0);
        }
    }
    
    // ===== TegakiCoreクラス =====
    window.TegakiCore = class TegakiCore {
        constructor(container) {
            this.container = container;
            this.wrapper = null;
            this.displayCanvas = null;
            this.displayCtx = null;
            
            this.layers = [];
            this.activeLayerIndex = 0;
            this.layerIdCounter = 0;
            
            this.history = new HistoryManager(50);
            this.isRestoringState = false;
            
            this.isDrawing = false;
            this.lastX = 0;
            this.lastY = 0;
            
            this.tool = 'pen';
            this.color = '#800000';
            this.size = 2;
            
            this.colors = [
                '#800000', '#aa5a56', '#cf9c97',
                '#e9c2ba', '#f0e0d6', '#ffffee'
            ];
            
            this.init();
        }
        
        init() {
            console.log('[Tegaki Core] Initializing Phase 2...');
            this.createUI();
            this.initLayers();
            this.setupCanvas();
            this.attachEvents();
            this.renderLayers();
            this.captureState();
            console.log('[Tegaki Core] ✓ Phase 2 initialized');
        }
        
        // ===== 履歴管理 =====
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
            
            // レイヤー再構築
            this.layers = state.layers.map(layerData => {
                const layer = new Layer(
                    layerData.id,
                    layerData.name,
                    400,
                    400,
                    layerData.isBackground
                );
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
                    id: layer.id,
                    name: layer.name,
                    visible: layer.visible,
                    isBackground: layer.isBackground,
                    imageData: layer.getImageData()
                })),
                activeLayerIndex: this.activeLayerIndex
            };
            
            const prevState = this.history.undo(currentState);
            if (prevState) {
                this.restoreState(prevState);
            }
        }
        
        redo() {
            const currentState = {
                layers: this.layers.map(layer => ({
                    id: layer.id,
                    name: layer.name,
                    visible: layer.visible,
                    isBackground: layer.isBackground,
                    imageData: layer.getImageData()
                })),
                activeLayerIndex: this.activeLayerIndex
            };
            
            const nextState = this.history.redo(currentState);
            if (nextState) {
                this.restoreState(nextState);
            }
        }
        
        updateUndoRedoButtons() {
            const undoBtn = document.getElementById('tegaki-undo-btn');
            const redoBtn = document.getElementById('tegaki-redo-btn');
            
            if (undoBtn) {
                undoBtn.disabled = !this.history.canUndo();
                undoBtn.style.opacity = this.history.canUndo() ? '1' : '0.3';
            }
            if (redoBtn) {
                redoBtn.disabled = !this.history.canRedo();
                redoBtn.style.opacity = this.history.canRedo() ? '1' : '0.3';
            }
        }
        
        // ===== レイヤー管理 =====
        initLayers() {
            const bgLayer = new Layer(this.layerIdCounter++, '背景', 400, 400, true);
            this.layers.push(bgLayer);
            
            const layer1 = new Layer(this.layerIdCounter++, 'レイヤー1', 400, 400, false);
            this.layers.push(layer1);
            
            this.activeLayerIndex = 1;
            console.log('[Tegaki Core] ✓ Layers initialized');
        }
        
        addLayer() {
            const newLayer = new Layer(
                this.layerIdCounter++,
                `レイヤー${this.layerIdCounter}`,
                400, 400, false
            );
            this.layers.push(newLayer);
            this.activeLayerIndex = this.layers.length - 1;
            this.updateLayerPanel();
            this.renderLayers();
            this.captureState();
        }
        
        deleteLayer(index) {
            if (this.layers[index].isBackground) {
                alert('背景レイヤーは削除できません');
                return;
            }
            if (this.layers.length <= 2) {
                alert('レイヤーは最低1枚必要です');
                return;
            }
            
            this.layers.splice(index, 1);
            if (this.activeLayerIndex >= this.layers.length) {
                this.activeLayerIndex = this.layers.length - 1;
            }
            
            this.updateLayerPanel();
            this.renderLayers();
            this.captureState();
        }
        
        setActiveLayer(index) {
            if (index >= 0 && index < this.layers.length) {
                this.activeLayerIndex = index;
                this.updateLayerPanel();
            }
        }
        
        toggleLayerVisibility(index) {
            this.layers[index].visible = !this.layers[index].visible;
            this.updateLayerPanel();
            this.renderLayers();
        }
        
        renderLayers() {
            this.displayCtx.clearRect(0, 0, 400, 400);
            for (let i = 0; i < this.layers.length; i++) {
                if (this.layers[i].visible) {
                    this.displayCtx.drawImage(this.layers[i].canvas, 0, 0);
                }
            }
        }
        
        // ===== UI作成 =====
        createUI() {
            this.wrapper = document.createElement('div');
            this.wrapper.style.cssText = `
                display: flex;
                width: 100%;
                height: 100%;
                background: #ffffee;
            `;
            
            const sidebar = this.createSidebar();
            const canvasArea = document.createElement('div');
            canvasArea.style.cssText = `
                flex: 1;
                display: flex;
                justify-content: center;
                align-items: center;
                background: #ffffee;
            `;
            
            const canvasContainer = document.createElement('div');
            canvasContainer.style.cssText = `
                position: relative;
                width: 400px;
                height: 400px;
                box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
            `;
            
            this.displayCanvas = document.createElement('canvas');
            this.displayCanvas.width = 400;
            this.displayCanvas.height = 400;
            this.displayCanvas.style.cssText = `
                position: absolute;
                top: 0;
                left: 0;
                cursor: crosshair;
            `;
            this.displayCtx = this.displayCanvas.getContext('2d');
            
            canvasContainer.appendChild(this.displayCanvas);
            canvasArea.appendChild(canvasContainer);
            
            this.wrapper.appendChild(sidebar);
            this.wrapper.appendChild(canvasArea);
            this.container.appendChild(this.wrapper);
            
            // トップバーにアンドゥ/リドゥボタンを追加
            this.addUndoRedoToTopBar();
        }
        
        addUndoRedoToTopBar() {
            // トップバーを探す（ローダー側で作成済み）
            const topBar = this.container.parentElement.querySelector('div');
            if (!topBar) return;
            
            // ボタングループを探す
            const buttonGroup = topBar.querySelector('div:last-child');
            if (!buttonGroup) return;
            
            // アンドゥボタン
            const undoBtn = document.createElement('button');
            undoBtn.id = 'tegaki-undo-btn';
            undoBtn.innerHTML = '↶';
            undoBtn.title = '元に戻す (Ctrl+Z)';
            undoBtn.style.cssText = `
                padding: 8px 12px;
                background: #f0e0d6;
                color: #800000;
                border: 1px solid #aa5a56;
                border-radius: 4px;
                cursor: pointer;
                font-size: 16px;
                font-weight: bold;
                transition: all 0.2s;
            `;
            undoBtn.onmouseover = () => {
                if (!undoBtn.disabled) undoBtn.style.background = '#e9c2ba';
            };
            undoBtn.onmouseout = () => undoBtn.style.background = '#f0e0d6';
            undoBtn.onclick = () => this.undo();
            
            // リドゥボタン
            const redoBtn = document.createElement('button');
            redoBtn.id = 'tegaki-redo-btn';
            redoBtn.innerHTML = '↷';
            redoBtn.title = 'やり直す (Ctrl+U)';
            redoBtn.style.cssText = `
                padding: 8px 12px;
                background: #f0e0d6;
                color: #800000;
                border: 1px solid #aa5a56;
                border-radius: 4px;
                cursor: pointer;
                font-size: 16px;
                font-weight: bold;
                transition: all 0.2s;
            `;
            redoBtn.onmouseover = () => {
                if (!redoBtn.disabled) redoBtn.style.background = '#e9c2ba';
            };
            redoBtn.onmouseout = () => redoBtn.style.background = '#f0e0d6';
            redoBtn.onclick = () => this.redo();
            
            // 投稿ボタンの前に挿入
            const postBtn = buttonGroup.querySelector('button');
            buttonGroup.insertBefore(undoBtn, postBtn);
            buttonGroup.insertBefore(redoBtn, postBtn);
            
            this.updateUndoRedoButtons();
        }
        
        createSidebar() {
            const sidebar = document.createElement('div');
            sidebar.style.cssText = `
                width: 80px;
                background: #e9c2ba;
                padding: 12px 8px;
                display: flex;
                flex-direction: column;
                gap: 16px;
                border-right: 2px solid #cf9c97;
                overflow-y: auto;
            `;
            
            sidebar.appendChild(this.createColorSection());
            sidebar.appendChild(this.createToolSection());
            sidebar.appendChild(this.createSizeSection());
            sidebar.appendChild(this.createLayerPanel());
            
            return sidebar;
        }
        
        createColorSection() {
            const section = document.createElement('div');
            section.style.cssText = `display: flex; flex-direction: column; gap: 6px;`;
            
            const label = this.createLabel('色');
            const palette = document.createElement('div');
            palette.style.cssText = `display: grid; grid-template-columns: repeat(2, 1fr); gap: 4px;`;
            
            this.colors.forEach((color, index) => {
                const colorBtn = document.createElement('button');
                colorBtn.style.cssText = `
                    width: 100%;
                    height: 24px;
                    background: ${color};
                    border: 2px solid ${index === 0 ? '#800000' : '#aa5a56'};
                    border-radius: 3px;
                    cursor: pointer;
                `;
                colorBtn.onclick = () => {
                    this.color = color;
                    palette.querySelectorAll('button').forEach(btn => {
                        btn.style.border = '2px solid #aa5a56';
                    });
                    colorBtn.style.border = '2px solid #800000';
                };
                palette.appendChild(colorBtn);
            });
            
            section.appendChild(label);
            section.appendChild(palette);
            return section;
        }
        
        createToolSection() {
            const section = document.createElement('div');
            section.style.cssText = `display: flex; flex-direction: column; gap: 6px;`;
            
            const label = this.createLabel('ツール');
            const penBtn = this.createToolButton('🖊️', 'ペン', true);
            const eraserBtn = this.createToolButton('🧹', '消しゴム', false);
            
            penBtn.onclick = () => {
                this.tool = 'pen';
                penBtn.style.background = '#800000';
                penBtn.style.color = 'white';
                eraserBtn.style.background = '#cf9c97';
                eraserBtn.style.color = '#800000';
            };
            
            eraserBtn.onclick = () => {
                this.tool = 'eraser';
                eraserBtn.style.background = '#800000';
                eraserBtn.style.color = 'white';
                penBtn.style.background = '#cf9c97';
                penBtn.style.color = '#800000';
            };
            
            section.appendChild(label);
            section.appendChild(penBtn);
            section.appendChild(eraserBtn);
            return section;
        }
        
        createSizeSection() {
            const section = document.createElement('div');
            section.style.cssText = `display: flex; flex-direction: column; gap: 6px;`;
            
            const label = this.createLabel('サイズ');
            const sizeValue = document.createElement('div');
            sizeValue.textContent = '2px';
            sizeValue.style.cssText = `
                color: #800000;
                font-size: 11px;
                text-align: center;
                font-weight: bold;
            `;
            
            const slider = document.createElement('input');
            slider.type = 'range';
            slider.min = '1';
            slider.max = '50';
            slider.value = '2';
            slider.style.cssText = `width: 100%; cursor: pointer; accent-color: #800000;`;
            slider.oninput = (e) => {
                this.size = parseInt(e.target.value);
                sizeValue.textContent = `${this.size}px`;
            };
            
            section.appendChild(label);
            section.appendChild(sizeValue);
            section.appendChild(slider);
            return section;
        }
        
        createLayerPanel() {
            const panel = document.createElement('div');
            panel.id = 'tegaki-layer-panel';
            panel.style.cssText = `display: flex; flex-direction: column; gap: 6px; margin-top: auto;`;
            
            const label = this.createLabel('レイヤー');
            
            const controls = document.createElement('div');
            controls.style.cssText = `display: flex; gap: 4px;`;
            
            const addBtn = document.createElement('button');
            addBtn.textContent = '➕';
            addBtn.title = 'レイヤー追加';
            addBtn.style.cssText = `
                flex: 1; padding: 6px; background: #cf9c97;
                border: 1px solid #aa5a56; border-radius: 3px;
                cursor: pointer; font-size: 14px;
            `;
            addBtn.onclick = () => this.addLayer();
            
            const delBtn = document.createElement('button');
            delBtn.textContent = '➖';
            delBtn.title = 'レイヤー削除';
            delBtn.style.cssText = `
                flex: 1; padding: 6px; background: #cf9c97;
                border: 1px solid #aa5a56; border-radius: 3px;
                cursor: pointer; font-size: 14px;
            `;
            delBtn.onclick = () => {
                if (confirm('選択中のレイヤーを削除しますか？')) {
                    this.deleteLayer(this.activeLayerIndex);
                }
            };
            
            controls.appendChild(addBtn);
            controls.appendChild(delBtn);
            
            const layerList = document.createElement('div');
            layerList.id = 'tegaki-layer-list';
            layerList.style.cssText = `
                display: flex; flex-direction: column-reverse;
                gap: 4px; max-height: 150px; overflow-y: auto;
            `;
            
            panel.appendChild(label);
            panel.appendChild(controls);
            panel.appendChild(layerList);
            
            this.updateLayerPanel();
            return panel;
        }
        
        updateLayerPanel() {
            const layerList = document.getElementById('tegaki-layer-list');
            if (!layerList) return;
            
            layerList.innerHTML = '';
            
            for (let i = this.layers.length - 1; i >= 0; i--) {
                const layer = this.layers[i];
                const isActive = i === this.activeLayerIndex;
                
                const item = document.createElement('div');
                item.style.cssText = `
                    display: flex; align-items: center; gap: 4px;
                    padding: 4px;
                    background: ${isActive ? '#800000' : 'transparent'};
                    color: ${isActive ? 'white' : '#800000'};
                    border: 1px solid ${isActive ? '#800000' : '#aa5a56'};
                    border-radius: 3px; cursor: pointer; font-size: 10px;
                `;
                
                const checkbox = document.createElement('input');
                checkbox.type = 'checkbox';
                checkbox.checked = layer.visible;
                checkbox.style.cursor = 'pointer';
                checkbox.onclick = (e) => {
                    e.stopPropagation();
                    this.toggleLayerVisibility(i);
                };
                
                const name = document.createElement('span');
                name.textContent = layer.name;
                name.style.cssText = `
                    flex: 1; overflow: hidden;
                    text-overflow: ellipsis; white-space: nowrap;
                `;
                
                item.onclick = () => this.setActiveLayer(i);
                item.appendChild(checkbox);
                item.appendChild(name);
                layerList.appendChild(item);
            }
        }
        
        createToolButton(emoji, label, isActive) {
            const btn = document.createElement('button');
            btn.innerHTML = `
                <div style="font-size: 18px;">${emoji}</div>
                <div style="font-size: 9px; margin-top: 2px;">${label}</div>
            `;
            btn.style.cssText = `
                background: ${isActive ? '#800000' : '#cf9c97'};
                color: ${isActive ? 'white' : '#800000'};
                border: 1px solid #aa5a56; padding: 6px;
                border-radius: 3px; cursor: pointer;
                display: flex; flex-direction: column;
                align-items: center; font-weight: bold;
            `;
            return btn;
        }
        
        createLabel(text) {
            const label = document.createElement('div');
            label.textContent = text;
            label.style.cssText = `
                font-size: 10px; color: #800000;
                font-weight: bold; text-align: center;
                padding: 3px 0; background: #f0e0d6;
                border-radius: 2px;
            `;
            return label;
        }
        
        // ===== キャンバス設定とイベント =====
        setupCanvas() {
            this.layers.forEach(layer => {
                layer.ctx.lineCap = 'round';
                layer.ctx.lineJoin = 'round';
            });
        }
        
        attachEvents() {
            this.displayCanvas.addEventListener('mousedown', (e) => this.startDrawing(e));
            this.displayCanvas.addEventListener('mousemove', (e) => this.draw(e));
            this.displayCanvas.addEventListener('mouseup', () => this.stopDrawing());
            this.displayCanvas.addEventListener('mouseleave', () => this.stopDrawing());
            
            // キーボードショートカット
            document.addEventListener('keydown', (e) => {
                if (e.ctrlKey && e.key === 'z') {
                    e.preventDefault();
                    this.undo();
                } else if (e.ctrlKey && e.key === 'u') {
                    e.preventDefault();
                    this.redo();
                }
            });
        }
        
        startDrawing(e) {
            this.isDrawing = true;
            const rect = this.displayCanvas.getBoundingClientRect();
            this.lastX = e.clientX - rect.left;
            this.lastY = e.clientY - rect.top;
        }
        
        draw(e) {
            if (!this.isDrawing) return;
            
            const rect = this.displayCanvas.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            
            const activeLayer = this.layers[this.activeLayerIndex];
            const ctx = activeLayer.ctx;
            
            ctx.beginPath();
            ctx.moveTo(this.lastX, this.lastY);
            ctx.lineTo(x, y);
            
            if (this.tool === 'pen') {
                ctx.globalCompositeOperation = 'source-over';
                ctx.strokeStyle = this.color;
                ctx.lineWidth = this.size;
            } else if (this.tool === 'eraser') {
                ctx.globalCompositeOperation = 'destination-out';
                ctx.lineWidth = this.size;
            }
            
            ctx.stroke();
            this.lastX = x;
            this.lastY = y;
            this.renderLayers();
        }
        
        stopDrawing() {
            if (this.isDrawing) {
                this.isDrawing = false;
                this.captureState(); // 描画完了時に履歴保存
            }
        }
        
        clearCanvas() {
            const activeLayer = this.layers[this.activeLayerIndex];
            activeLayer.clear();
            this.renderLayers();
            this.captureState();
        }
        
        async exportAsBlob() {
            const tempCanvas = document.createElement('canvas');
            tempCanvas.width = 400;
            tempCanvas.height = 400;
            const tempCtx = tempCanvas.getContext('2d');
            
            for (let i = 0; i < this.layers.length; i++) {
                if (this.layers[i].visible) {
                    tempCtx.drawImage(this.layers[i].canvas, 0, 0);
                }
            }
            
            return new Promise((resolve) => {
                tempCanvas.toBlob((blob) => resolve(blob), 'image/png');
            });
        }
        
        destroy() {
            if (this.wrapper && this.wrapper.parentNode) {
                this.wrapper.remove();
            }
            this.layers = [];
            this.history.clear();
        }
    };
    
    console.log('✅ tegaki.js Phase 2 (Undo/Redo) loaded');
    
})();