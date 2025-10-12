(function() {
    'use strict';
    
    window.TegakiAnimeCore = class TegakiAnimeCore {
        constructor(container) {
            // DOM要素
            this.container = container;
            this.wrapper = null;
            this.canvas = null;
            this.ctx = null;
            this.bgCanvas = null;
            this.onionCanvas = null;
            this.onionCtx = null;
            
            // 茶色カラー定義
            this.colors = {
                maroon: '#800000',
                lightMaroon: '#aa5a56',
                medium: '#cf9c97',
                lightMedium: '#e9c2ba',
                cream: '#f0e0d6',
                background: '#ffffee'
            };
            
            // キャンバス設定
            this.canvasWidth = 400;
            this.canvasHeight = 400;
            this.backgroundColor = this.colors.cream;
            
            // 描画状態
            this.isDrawing = false;
            this.lastX = 0;
            this.lastY = 0;
            
            // ツール設定
            this.tool = 'pen';
            this.color = this.colors.maroon;
            this.size = 2;
            this.minSize = 1;
            this.maxSize = 20;
            this.eraserSize = 10;
            this.minEraserSize = 5;
            this.maxEraserSize = 50;
            
            // 筆圧設定
            this.pressureSensitivity = 1.0;
            this.minPressureSensitivity = 0.0;
            this.maxPressureSensitivity = 2.0;
            
            // オニオンスキン設定
            this.onionSkinEnabled = false;
            this.onionSkinFrames = 1;
            this.minOnionFrames = 1;
            this.maxOnionFrames = 3;
            
            // アニメーション設定
            this.frameCount = 5;
            this.frameDelay = 200;
            this.minDelay = 10;
            this.maxDelay = 2000;
            this.layers = [];
            this.thumbnailContainer = null;
            this.activeLayerIndex = 0;
            
            // プレビュー設定
            this.isPreviewPlaying = false;
            this.previewInterval = null;
            this.previewFrame = 0;
            
            // クリップボード
            this.clipboard = null;
            
            // UI要素
            this.controlPanel = null;
            this.sizeSlider = null;
            this.eraserSizeSlider = null;
            this.pressureSlider = null;
            this.delaySlider = null;
            this.onionFramesSlider = null;
            this.previewBtn = null;
            
            // Undo/Redo履歴
            this.history = [];
            this.historyIndex = [];
            
            // キー処理統合用
            this.keyManager = null;
            this.boundHandleKeyDown = this.handleKeyDown.bind(this);
            
            // リサイズ対応
            this.resizeObserver = null;
            
            this.init();
        }
        
        init() {
            this.createUI();
            this.setupCanvas();
            this.initLayersAndHistory();
            this.attachEvents();
            this.setupKeyManager();
            this.setupResizeObserver();
        }
        
        // ========== キー処理統合 ==========
        
        setupKeyManager() {
            this.keyManager = {
                handlers: new Map(),
                register: (key, modifier, handler, description) => {
                    const keyStr = this.normalizeKey(key, modifier);
                    this.keyManager.handlers.set(keyStr, { handler, description });
                },
                unregister: (key, modifier) => {
                    const keyStr = this.normalizeKey(key, modifier);
                    this.keyManager.handlers.delete(keyStr);
                },
                getAll: () => {
                    return Array.from(this.keyManager.handlers.entries());
                }
            };
            
            this.registerDefaultKeys();
        }
        
        normalizeKey(key, modifier = {}) {
            const parts = [];
            if (modifier.ctrl) parts.push('Ctrl');
            if (modifier.shift) parts.push('Shift');
            if (modifier.alt) parts.push('Alt');
            parts.push(key.toLowerCase());
            return parts.join('+');
        }
        
        registerDefaultKeys() {
            const km = this.keyManager;
            
            km.register('z', { ctrl: true }, () => this.undo(), 'Undo');
            km.register('y', { ctrl: true }, () => this.redo(), 'Redo');
            km.register('c', { ctrl: true }, () => this.copyLayer(), 'Copy');
            km.register('v', { ctrl: true }, () => this.pasteLayer(), 'Paste');
            km.register('p', {}, () => this.switchTool('pen'), 'Pen');
            km.register('e', {}, () => this.switchTool('eraser'), 'Eraser');
            
            for (let i = 1; i <= 9; i++) {
                if (i <= this.frameCount) {
                    km.register(String(i), {}, () => this.switchLayer(i - 1), `Layer ${i}`);
                }
            }
        }
        
        handleKeyDown(e) {
            if (!this.wrapper || !this.wrapper.isConnected) return;
            
            const keyStr = this.normalizeKey(e.key, {
                ctrl: e.ctrlKey,
                shift: e.shiftKey,
                alt: e.altKey
            });
            
            const binding = this.keyManager.handlers.get(keyStr);
            if (binding) {
                e.preventDefault();
                binding.handler();
            }
        }
        
        // ========== コピー＆ペースト ==========
        
        copyLayer() {
            const imageData = this.ctx.getImageData(
                0, 0,
                this.canvas.width,
                this.canvas.height
            );
            
            const copiedData = this.ctx.createImageData(imageData.width, imageData.height);
            copiedData.data.set(imageData.data);
            this.clipboard = copiedData;
            
            console.log('✅ Layer copied to clipboard');
        }
        
        pasteLayer() {
            if (!this.clipboard) {
                console.log('⚠️ Clipboard is empty');
                return;
            }
            
            this.ctx.putImageData(this.clipboard, 0, 0);
            this.pushHistory();
            this.updateThumbnail();
            this.updateOnionSkin();
            
            console.log('✅ Pasted from clipboard');
        }
        
        // ========== リサイズ対応 ==========
        
        setupResizeObserver() {
            if (typeof ResizeObserver !== 'undefined') {
                this.resizeObserver = new ResizeObserver(entries => {
                    for (const entry of entries) {
                        this.handleResize(entry.contentRect);
                    }
                });
                
                if (this.wrapper) {
                    this.resizeObserver.observe(this.wrapper);
                }
            }
        }
        
        handleResize(rect) {
            // 現状は固定サイズ
        }
        
        // ========== UI生成 ==========
        
        createUI() {
            this.wrapper = document.createElement('div');
            this.wrapper.style.cssText = `
                display: flex;
                flex-direction: row;
                width: 100%;
                height: 100%;
                background: ${this.colors.background};
                gap: 15px;
                padding: 15px;
                box-sizing: border-box;
            `;
            
            this.createShortcutPanel();
            this.createCanvasArea();
            this.createControlPanel();
            
            this.container.appendChild(this.wrapper);
        }
        
        createShortcutPanel() {
            const panel = document.createElement('div');
            panel.style.cssText = `
                width: 180px;
                background: transparent;
                padding: 10px;
                font-size: 12px;
                color: ${this.colors.maroon};
                overflow-y: auto;
                flex-shrink: 0;
            `;
            
            panel.innerHTML = `
                <h3 style="margin: 0 0 10px 0; font-size: 14px; padding-bottom: 5px;">
                    ショートカット
                </h3>
                <div style="line-height: 1.8;">
                    <div><b>1-5</b>: レイヤー切替</div>
                    <div><b>P</b>: ペン</div>
                    <div><b>E</b>: 消しゴム</div>
                    <div><b>Ctrl+Z</b>: 元に戻す</div>
                    <div><b>Ctrl+Y</b>: やり直し</div>
                    <div><b>Ctrl+C</b>: コピー</div>
                    <div><b>Ctrl+V</b>: ペースト</div>
                </div>
                <h3 style="margin: 15px 0 10px 0; font-size: 14px; padding-bottom: 5px;">
                    使い方
                </h3>
                <div style="line-height: 1.6; font-size: 11px;">
                    ・各レイヤーに描画<br>
                    ・サムネイルで切替<br>
                    ・オニオンスキンで確認<br>
                    ・プレビューで動作確認<br>
                    ・完成したらAPNG投稿<br>
                    ※予告無く仕様変更や消去されます
                </div>
            `;
            
            this.wrapper.appendChild(panel);
        }
        
        createCanvasArea() {
            const centerArea = document.createElement('div');
            centerArea.style.cssText = `
                flex: 1;
                display: flex;
                flex-direction: column;
                gap: 20px;
                min-width: 0;
            `;
            
            const canvasWrapper = document.createElement('div');
            canvasWrapper.style.cssText = `
                flex: 1;
                display: flex;
                justify-content: center;
                align-items: center;
                min-height: 0;
            `;
            
            const canvasContainer = document.createElement('div');
            canvasContainer.style.cssText = `
                position: relative;
                width: ${this.canvasWidth}px;
                height: ${this.canvasHeight}px;
                box-shadow: 0 2px 8px rgba(128, 0, 0, 0.2);
                flex-shrink: 0;
            `;
            
            // 背景キャンバス
            this.bgCanvas = document.createElement('canvas');
            this.bgCanvas.width = this.canvasWidth;
            this.bgCanvas.height = this.canvasHeight;
            const bgCtx = this.bgCanvas.getContext('2d');
            bgCtx.fillStyle = this.backgroundColor;
            bgCtx.fillRect(0, 0, this.canvasWidth, this.canvasHeight);
            this.bgCanvas.style.cssText = `
                position: absolute; 
                top: 0; 
                left: 0;
            `;
            
            // オニオンスキンキャンバス
            this.onionCanvas = document.createElement('canvas');
            this.onionCanvas.width = this.canvasWidth;
            this.onionCanvas.height = this.canvasHeight;
            this.onionCanvas.style.cssText = `
                position: absolute; 
                top: 0; 
                left: 0;
                pointer-events: none;
            `;
            
            // 描画キャンバス
            this.canvas = document.createElement('canvas');
            this.canvas.width = this.canvasWidth;
            this.canvas.height = this.canvasHeight;
            this.canvas.style.cssText = `
                position: absolute; 
                top: 0; 
                left: 0; 
                cursor: crosshair;
            `;
            
            canvasContainer.appendChild(this.bgCanvas);
            canvasContainer.appendChild(this.onionCanvas);
            canvasContainer.appendChild(this.canvas);
            canvasWrapper.appendChild(canvasContainer);
            
            // サムネイルエリア（中央下、より下に配置）
            this.thumbnailContainer = document.createElement('div');
            this.thumbnailContainer.style.cssText = `
                display: flex;
                justify-content: center;
                gap: 15px;
                padding: 20px;
                background: rgba(233, 194, 186, 0.3);
                border-radius: 4px;
                flex-shrink: 0;
            `;
            
            for (let i = 0; i < this.frameCount; i++) {
                const thumbWrapper = document.createElement('div');
                thumbWrapper.style.cssText = `
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    gap: 8px;
                `;
                
                const thumbNumber = document.createElement('div');
                thumbNumber.style.cssText = `
                    font-size: 14px;
                    font-weight: bold;
                    color: ${this.colors.maroon};
                    width: 60px;
                    text-align: center;
                `;
                thumbNumber.textContent = String(i + 1);
                
                const thumb = document.createElement('canvas');
                thumb.width = 60;
                thumb.height = 60;
                thumb.style.cssText = `
                    border: 3px solid ${this.colors.lightMaroon};
                    border-radius: 2px;
                    background: ${this.backgroundColor};
                    cursor: pointer;
                    transition: all 0.2s;
                `;
                thumb.title = `レイヤー ${i + 1} (${i + 1}キー)`;
                thumb.onclick = () => this.switchLayer(i);
                
                thumbWrapper.appendChild(thumbNumber);
                thumbWrapper.appendChild(thumb);
                this.thumbnailContainer.appendChild(thumbWrapper);
            }
            
            centerArea.appendChild(canvasWrapper);
            centerArea.appendChild(this.thumbnailContainer);
            this.wrapper.appendChild(centerArea);
        }
        
        createControlPanel() {
            this.controlPanel = document.createElement('div');
            this.controlPanel.style.cssText = `
                width: 200px;
                background: transparent;
                padding: 10px;
                font-size: 12px;
                color: ${this.colors.maroon};
                display: flex;
                flex-direction: column;
                gap: 20px;
                overflow-y: auto;
                flex-shrink: 0;
            `;
            
            this.createPreviewButton();
            this.createToolSelector();
            this.createPenSizeControl();
            this.createEraserSizeControl();
            this.createPressureControl();
            this.createOnionSkinControl();
            this.createDelayControl();
            
            this.wrapper.appendChild(this.controlPanel);
        }
        
        createPreviewButton() {
            this.previewBtn = document.createElement('button');
            this.previewBtn.textContent = 'プレビュー';
            this.previewBtn.style.cssText = `
                padding: 12px;
                background: ${this.colors.maroon};
                color: white;
                border: none;
                border-radius: 4px;
                cursor: pointer;
                font-weight: bold;
                font-size: 14px;
            `;
            this.previewBtn.onclick = () => this.togglePreview();
            
            this.controlPanel.appendChild(this.previewBtn);
        }
        
        createToolSelector() {
            const toolControl = document.createElement('div');
            
            const label = document.createElement('label');
            label.style.cssText = 'display: block; margin-bottom: 8px; font-weight: bold;';
            label.textContent = 'ツール';
            toolControl.appendChild(label);
            
            const btnContainer = document.createElement('div');
            btnContainer.style.cssText = 'display: flex; gap: 8px;';
            
            const penBtn = document.createElement('button');
            penBtn.textContent = 'ペン';
            penBtn.style.cssText = `
                flex: 1;
                padding: 8px;
                background: ${this.colors.maroon};
                color: white;
                border: none;
                border-radius: 4px;
                cursor: pointer;
                font-weight: bold;
            `;
            penBtn.onclick = () => this.switchTool('pen');
            
            const eraserBtn = document.createElement('button');
            eraserBtn.textContent = '消しゴム';
            eraserBtn.style.cssText = `
                flex: 1;
                padding: 8px;
                background: ${this.colors.lightMaroon};
                color: white;
                border: none;
                border-radius: 4px;
                cursor: pointer;
                font-weight: bold;
            `;
            eraserBtn.onclick = () => this.switchTool('eraser');
            
            this.penBtn = penBtn;
            this.eraserBtn = eraserBtn;
            
            btnContainer.appendChild(penBtn);
            btnContainer.appendChild(eraserBtn);
            toolControl.appendChild(btnContainer);
            this.controlPanel.appendChild(toolControl);
        }
        
        createPenSizeControl() {
            const sizeControl = document.createElement('div');
            sizeControl.innerHTML = `
                <label style="display: block; margin-bottom: 8px; font-weight: bold;">
                    ペンサイズ: <span id="pen-size-value">${this.size}</span>px
                </label>
                <input type="range" id="pen-size-slider" 
                    min="${this.minSize}" 
                    max="${this.maxSize}" 
                    value="${this.size}" 
                    style="width: 100%; accent-color: ${this.colors.maroon};">
            `;
            
            this.sizeSlider = sizeControl.querySelector('#pen-size-slider');
            const sizeValue = sizeControl.querySelector('#pen-size-value');
            this.sizeSlider.addEventListener('input', (e) => {
                this.size = parseInt(e.target.value);
                sizeValue.textContent = this.size;
                if (this.ctx && this.tool === 'pen') {
                    this.ctx.lineWidth = this.size;
                }
            });
            
            this.controlPanel.appendChild(sizeControl);
        }
        
        createEraserSizeControl() {
            const eraserControl = document.createElement('div');
            eraserControl.innerHTML = `
                <label style="display: block; margin-bottom: 8px; font-weight: bold;">
                    消しゴムサイズ: <span id="eraser-size-value">${this.eraserSize}</span>px
                </label>
                <input type="range" id="eraser-size-slider" 
                    min="${this.minEraserSize}" 
                    max="${this.maxEraserSize}" 
                    value="${this.eraserSize}" 
                    style="width: 100%; accent-color: ${this.colors.maroon};">
            `;
            
            this.eraserSizeSlider = eraserControl.querySelector('#eraser-size-slider');
            const eraserValue = eraserControl.querySelector('#eraser-size-value');
            this.eraserSizeSlider.addEventListener('input', (e) => {
                this.eraserSize = parseInt(e.target.value);
                eraserValue.textContent = this.eraserSize;
                if (this.ctx && this.tool === 'eraser') {
                    this.ctx.lineWidth = this.eraserSize;
                }
            });
            
            this.controlPanel.appendChild(eraserControl);
        }
        
        createPressureControl() {
            const pressureControl = document.createElement('div');
            pressureControl.innerHTML = `
                <label style="display: block; margin-bottom: 8px; font-weight: bold;">
                    筆圧感度: <span id="pressure-value">${this.pressureSensitivity.toFixed(1)}</span>
                </label>
                <input type="range" id="pressure-slider" 
                    min="${this.minPressureSensitivity * 10}" 
                    max="${this.maxPressureSensitivity * 10}" 
                    value="${this.pressureSensitivity * 10}" 
                    step="1"
                    style="width: 100%; accent-color: ${this.colors.maroon};">
                <div style="display: flex; justify-content: space-between; font-size: 10px; color: ${this.colors.lightMaroon}; margin-top: 4px;">
                    <span>弱</span>
                    <span>強</span>
                </div>
            `;
            
            this.pressureSlider = pressureControl.querySelector('#pressure-slider');
            const pressureValue = pressureControl.querySelector('#pressure-value');
            this.pressureSlider.addEventListener('input', (e) => {
                this.pressureSensitivity = parseInt(e.target.value) / 10;
                pressureValue.textContent = this.pressureSensitivity.toFixed(1);
            });
            
            this.controlPanel.appendChild(pressureControl);
        }
        
        createOnionSkinControl() {
            const onionControl = document.createElement('div');
            
            const headerDiv = document.createElement('div');
            headerDiv.style.cssText = 'display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;';
            
            const label = document.createElement('label');
            label.style.cssText = 'font-weight: bold;';
            label.textContent = 'オニオンスキン';
            
            const toggleBtn = document.createElement('button');
            toggleBtn.textContent = 'OFF';
            toggleBtn.style.cssText = `
                padding: 4px 8px;
                background: ${this.colors.lightMaroon};
                color: white;
                border: none;
                border-radius: 3px;
                cursor: pointer;
                font-size: 11px;
            `;
            toggleBtn.onclick = () => this.toggleOnionSkin(toggleBtn);
            this.onionToggleBtn = toggleBtn;
            
            headerDiv.appendChild(label);
            headerDiv.appendChild(toggleBtn);
            onionControl.appendChild(headerDiv);
            
            const sliderDiv = document.createElement('div');
            sliderDiv.innerHTML = `
                <label style="display: block; margin-bottom: 8px; font-size: 11px;">
                    表示コマ数: <span id="onion-frames-value">${this.onionSkinFrames}</span>
                </label>
                <input type="range" id="onion-frames-slider" 
                    min="${this.minOnionFrames}" 
                    max="${this.maxOnionFrames}" 
                    value="${this.onionSkinFrames}" 
                    style="width: 100%; accent-color: ${this.colors.maroon};">
            `;
            
            this.onionFramesSlider = sliderDiv.querySelector('#onion-frames-slider');
            const onionValue = sliderDiv.querySelector('#onion-frames-value');
            this.onionFramesSlider.addEventListener('input', (e) => {
                this.onionSkinFrames = parseInt(e.target.value);
                onionValue.textContent = this.onionSkinFrames;
                this.updateOnionSkin();
            });
            
            onionControl.appendChild(sliderDiv);
            this.controlPanel.appendChild(onionControl);
        }
        
        toggleOnionSkin(btn) {
            this.onionSkinEnabled = !this.onionSkinEnabled;
            
            if (this.onionSkinEnabled) {
                btn.textContent = 'ON';
                btn.style.background = this.colors.maroon;
                this.updateOnionSkin();
            } else {
                btn.textContent = 'OFF';
                btn.style.background = this.colors.lightMaroon;
                this.clearOnionSkin();
            }
        }
        
        updateOnionSkin() {
            if (!this.onionSkinEnabled) {
                this.clearOnionSkin();
                return;
            }
            
            this.onionCtx = this.onionCanvas.getContext('2d');
            this.onionCtx.clearRect(0, 0, this.onionCanvas.width, this.onionCanvas.height);
            
            for (let offset = -this.onionSkinFrames; offset <= this.onionSkinFrames; offset++) {
                if (offset === 0) continue;
                
                const targetIndex = this.activeLayerIndex + offset;
                if (targetIndex < 0 || targetIndex >= this.frameCount) continue;
                
                const opacity = 0.3 * (1 - Math.abs(offset) / (this.onionSkinFrames + 1));
                this.onionCtx.globalAlpha = opacity;
                
                if (offset < 0) {
                    this.onionCtx.globalCompositeOperation = 'source-over';
                    this.onionCtx.filter = 'hue-rotate(200deg)';
                } else {
                    this.onionCtx.globalCompositeOperation = 'source-over';
                    this.onionCtx.filter = 'hue-rotate(0deg)';
                }
                
                const tempCanvas = document.createElement('canvas');
                tempCanvas.width = this.canvasWidth;
                tempCanvas.height = this.canvasHeight;
                const tempCtx = tempCanvas.getContext('2d');
                tempCtx.putImageData(this.layers[targetIndex], 0, 0);
                
                this.onionCtx.drawImage(tempCanvas, 0, 0);
            }
            
            this.onionCtx.globalAlpha = 1.0;
            this.onionCtx.filter = 'none';
            this.onionCtx.globalCompositeOperation = 'source-over';
        }
        
        clearOnionSkin() {
            if (this.onionCtx) {
                this.onionCtx.clearRect(0, 0, this.onionCanvas.width, this.onionCanvas.height);
            }
        }
        
        createDelayControl() {
            const delayControl = document.createElement('div');
            delayControl.innerHTML = `
                <label style="display: block; margin-bottom: 8px; font-weight: bold;">
                    フレーム間隔: <span id="delay-value">${this.frameDelay}</span>ms
                </label>
                <input type="range" id="delay-slider" 
                    min="${this.minDelay}" 
                    max="${this.maxDelay}" 
                    value="${this.frameDelay}" 
                    step="10"
                    style="width: 100%; accent-color: ${this.colors.maroon};">
                <div style="display: flex; justify-content: space-between; font-size: 10px; color: ${this.colors.lightMaroon}; margin-top: 4px;">
                    <span>速い</span>
                    <span>遅い</span>
                </div>
            `;
            
            this.delaySlider = delayControl.querySelector('#delay-slider');
            const delayValue = delayControl.querySelector('#delay-value');
            this.delaySlider.addEventListener('input', (e) => {
                this.frameDelay = parseInt(e.target.value);
                delayValue.textContent = this.frameDelay;
            });
            
            this.controlPanel.appendChild(delayControl);
        }
        
        // ========== ツール切替 ==========
        
        switchTool(tool) {
            this.tool = tool;
            
            if (tool === 'pen') {
                this.ctx.globalCompositeOperation = 'source-over';
                this.ctx.lineWidth = this.size;
                this.ctx.strokeStyle = this.color;
                this.canvas.style.cursor = 'crosshair';
                
                this.penBtn.style.background = this.colors.maroon;
                this.eraserBtn.style.background = this.colors.lightMaroon;
            } else if (tool === 'eraser') {
                this.ctx.globalCompositeOperation = 'destination-out';
                this.ctx.lineWidth = this.eraserSize;
                this.canvas.style.cursor = 'pointer';
                
                this.penBtn.style.background = this.colors.lightMaroon;
                this.eraserBtn.style.background = this.colors.maroon;
            }
        }
        
        // ========== プレビュー機能 ==========
        
        togglePreview() {
            if (this.isPreviewPlaying) {
                this.stopPreview();
            } else {
                this.startPreview();
            }
        }
        
        startPreview() {
            this.layers[this.activeLayerIndex] = this.ctx.getImageData(
                0, 0, 
                this.canvas.width, 
                this.canvas.height
            );
            
            this.clearOnionSkin();
            
            this.isPreviewPlaying = true;
            this.previewFrame = 0;
            this.previewBtn.textContent = '停止';
            this.previewBtn.style.background = this.colors.medium;
            
            this.previewInterval = setInterval(() => {
                this.ctx.putImageData(this.layers[this.previewFrame], 0, 0);
                this.previewFrame = (this.previewFrame + 1) % this.frameCount;
            }, this.frameDelay);
        }
        
        stopPreview() {
            if (this.previewInterval) {
                clearInterval(this.previewInterval);
                this.previewInterval = null;
            }
            
            this.isPreviewPlaying = false;
            this.previewBtn.textContent = 'プレビュー';
            this.previewBtn.style.background = this.colors.maroon;
            
            this.ctx.putImageData(this.layers[this.activeLayerIndex], 0, 0);
            
            this.updateOnionSkin();
        }
        
        // ========== キャンバス設定 ==========
        
        setupCanvas() {
            if (!this.canvas) {
                console.error('Canvas not created yet!');
                return;
            }
            this.ctx = this.canvas.getContext('2d', {
                willReadFrequently: true
            });
            this.ctx.lineCap = 'round';
            this.ctx.lineJoin = 'round';
            this.ctx.strokeStyle = this.color;
            this.ctx.lineWidth = this.size;
            
            this.onionCtx = this.onionCanvas.getContext('2d', {
                willReadFrequently: true
            });
        }
        
        // ========== レイヤーと履歴の初期化 ==========
        
        initLayersAndHistory() {
            for (let i = 0; i < this.frameCount; i++) {
                const initialImageData = this.ctx.createImageData(
                    this.canvas.width, 
                    this.canvas.height
                );
                
                this.layers.push(initialImageData);
                this.history.push([initialImageData]);
                this.historyIndex.push(0);
            }
            
            if (this.thumbnailContainer && this.thumbnailContainer.childNodes[0]) {
                const firstThumb = this.thumbnailContainer.childNodes[0].querySelector('canvas');
                if (firstThumb) {
                    firstThumb.style.borderColor = this.colors.maroon;
                    firstThumb.style.transform = 'scale(1.1)';
                }
            }
        }
        
        // ========== イベントリスナー設定 ==========
        
        attachEvents() {
            this.canvas.addEventListener('mousedown', (e) => this.startDrawing(e));
            this.canvas.addEventListener('mousemove', (e) => this.draw(e));
            this.canvas.addEventListener('mouseup', () => this.stopDrawing());
            this.canvas.addEventListener('mouseleave', () => this.stopDrawing());
            
            this.canvas.addEventListener('touchstart', (e) => {
                e.preventDefault();
                const touch = e.touches[0];
                const mouseEvent = new MouseEvent('mousedown', {
                    clientX: touch.clientX,
                    clientY: touch.clientY
                });
                this.canvas.dispatchEvent(mouseEvent);
            }, { passive: false });
            
            this.canvas.addEventListener('touchmove', (e) => {
                e.preventDefault();
                const touch = e.touches[0];
                const mouseEvent = new MouseEvent('mousemove', {
                    clientX: touch.clientX,
                    clientY: touch.clientY
                });
                this.canvas.dispatchEvent(mouseEvent);
            }, { passive: false });
            
            this.canvas.addEventListener('touchend', (e) => {
                e.preventDefault();
                const mouseEvent = new MouseEvent('mouseup', {});
                this.canvas.dispatchEvent(mouseEvent);
            }, { passive: false });
            
            this.canvas.addEventListener('pointerdown', (e) => this.startDrawing(e));
            this.canvas.addEventListener('pointermove', (e) => this.drawWithPressure(e));
            this.canvas.addEventListener('pointerup', () => this.stopDrawing());
            this.canvas.addEventListener('pointerleave', () => this.stopDrawing());

            document.addEventListener('keydown', this.boundHandleKeyDown);
        }
        
        // ========== 描画処理 ==========
        
        startDrawing(e) {
            this.isDrawing = true;
            const rect = this.canvas.getBoundingClientRect();
            this.lastX = e.clientX - rect.left;
            this.lastY = e.clientY - rect.top;
        }
        
        draw(e) {
            if (!this.isDrawing) return;
            
            const rect = this.canvas.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            
            this.ctx.beginPath();
            this.ctx.moveTo(this.lastX, this.lastY);
            this.ctx.lineTo(x, y);
            this.ctx.stroke();
            
            this.lastX = x;
            this.lastY = y;
        }
        
        drawWithPressure(e) {
            if (!this.isDrawing) return;
            
            const rect = this.canvas.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            
            let pressure = e.pressure || 0.5;
            
            if (pressure < 0.1) pressure = 0.1;
            
            pressure = Math.pow(pressure, 1 / this.pressureSensitivity);
            
            const baseSize = this.tool === 'pen' ? this.size : this.eraserSize;
            const adjustedSize = baseSize * (0.3 + pressure * 0.7);
            this.ctx.lineWidth = adjustedSize;
            
            this.ctx.beginPath();
            this.ctx.moveTo(this.lastX, this.lastY);
            this.ctx.lineTo(x, y);
            this.ctx.stroke();
            
            this.lastX = x;
            this.lastY = y;
        }
        
        stopDrawing() {
            if (!this.isDrawing) return;
            this.isDrawing = false;
            this.ctx.beginPath();
            
            this.ctx.lineWidth = this.tool === 'pen' ? this.size : this.eraserSize;
            
            this.pushHistory();
            this.updateThumbnail();
            this.updateOnionSkin();
        }
        
        // ========== レイヤー管理 ==========
        
        switchLayer(index) {
            if (index === this.activeLayerIndex) return;
            
            if (this.isPreviewPlaying) {
                this.stopPreview();
            }
            
            this.layers[this.activeLayerIndex] = this.ctx.getImageData(
                0, 0, 
                this.canvas.width, 
                this.canvas.height
            );
            
            this.activeLayerIndex = index;
            this.ctx.putImageData(this.layers[index], 0, 0);
            
            this.thumbnailContainer.childNodes.forEach((thumbWrapper, i) => {
                const thumb = thumbWrapper.querySelector('canvas');
                if (thumb) {
                    thumb.style.borderColor = (i === index) ? this.colors.maroon : this.colors.lightMaroon;
                    thumb.style.transform = (i === index) ? 'scale(1.1)' : 'scale(1)';
                }
            });
            
            this.updateOnionSkin();
        }
        
        updateThumbnail() {
            const thumbWrapper = this.thumbnailContainer.childNodes[this.activeLayerIndex];
            if (!thumbWrapper) return;
            
            const thumbCanvas = thumbWrapper.querySelector('canvas');
            if (!thumbCanvas) return;
            
            const thumbCtx = thumbCanvas.getContext('2d', {
                willReadFrequently: true
            });
            thumbCtx.clearRect(0, 0, thumbCanvas.width, thumbCanvas.height);

            const tempCanvas = document.createElement('canvas');
            tempCanvas.width = this.canvas.width;
            tempCanvas.height = this.canvas.height;
            const tempCtx = tempCanvas.getContext('2d', {
                willReadFrequently: true
            });
            tempCtx.drawImage(this.bgCanvas, 0, 0);
            tempCtx.drawImage(this.canvas, 0, 0);
            
            thumbCtx.drawImage(
                tempCanvas, 
                0, 0, 
                thumbCanvas.width, 
                thumbCanvas.height
            );
        }
        
        // ========== Undo/Redo ==========
        
        pushHistory() {
            const history = this.history[this.activeLayerIndex];
            let index = this.historyIndex[this.activeLayerIndex];
            
            if (index < history.length - 1) {
                this.history[this.activeLayerIndex] = history.slice(0, index + 1);
            }
            
            const imageData = this.ctx.getImageData(
                0, 0, 
                this.canvas.width, 
                this.canvas.height
            );
            this.history[this.activeLayerIndex].push(imageData);
            this.historyIndex[this.activeLayerIndex]++;
        }

        undo() {
            let index = this.historyIndex[this.activeLayerIndex];
            if (index > 0) {
                index--;
                this.historyIndex[this.activeLayerIndex] = index;
                const imageData = this.history[this.activeLayerIndex][index];
                this.ctx.putImageData(imageData, 0, 0);
                this.updateThumbnail();
                this.updateOnionSkin();
            }
        }
        
        redo() {
            const history = this.history[this.activeLayerIndex];
            let index = this.historyIndex[this.activeLayerIndex];
            if (index < history.length - 1) {
                index++;
                this.historyIndex[this.activeLayerIndex] = index;
                const imageData = this.history[this.activeLayerIndex][index];
                this.ctx.putImageData(imageData, 0, 0);
                this.updateThumbnail();
                this.updateOnionSkin();
            }
        }
        
        // ========== エクスポート前処理 ==========
        
        prepareExport() {
            if (this.isPreviewPlaying) {
                this.stopPreview();
            }
            
            this.layers[this.activeLayerIndex] = this.ctx.getImageData(
                0, 0, 
                this.canvas.width, 
                this.canvas.height
            );
        }
        
        // ========== APNGエクスポート ==========
        
        async exportAsApng() {
            this.prepareExport();
            
            if (!window.UPNG || !window.Zlib) {
                alert('APNGエクスポートにはUPNG.jsとpako.jsが必要です。');
                return null;
            }
            
            const frames = [];
            
            for (const layerData of this.layers) {
                const frameCanvas = document.createElement('canvas');
                frameCanvas.width = this.canvas.width;
                frameCanvas.height = this.canvas.height;
                const frameCtx = frameCanvas.getContext('2d');
                
                frameCtx.drawImage(this.bgCanvas, 0, 0);
                frameCtx.putImageData(layerData, 0, 0);
                
                const imageData = frameCtx.getImageData(
                    0, 0, 
                    frameCanvas.width, 
                    frameCanvas.height
                );
                
                frames.push(imageData.data.buffer);
            }
            
            const delays = Array(this.frameCount).fill(this.frameDelay);
            
            const apngData = UPNG.encode(
                frames,
                this.canvas.width,
                this.canvas.height,
                0,
                delays
            );
            
            return new Blob([apngData], {type: 'image/png'});
        }
        
        // ========== GIFエクスポート ==========
        
        async exportAsGif(onProgress) {
            this.prepareExport();
            
            if (!window.GIF) {
                alert('GIFエクスポートにはgif.jsが必要です。');
                return null;
            }
            
            let workerUrl = window.GIF.prototype.options?.workerScript;
            
            if (!workerUrl || !workerUrl.startsWith('blob:')) {
                console.error('Worker URL not found:', workerUrl);
                alert('GIF Workerが初期化されていません。ページを再読み込みしてください。');
                return null;
            }

            return new Promise((resolve, reject) => {
                try {
                    const gif = new GIF({
                        workers: 2,
                        quality: 10,
                        width: this.canvas.width,
                        height: this.canvas.height,
                        workerScript: workerUrl,
                        debug: false
                    });
                    
                    if (onProgress && typeof onProgress === 'function') {
                        gif.on('progress', onProgress);
                    }

                    for (const layerData of this.layers) {
                        const frameCanvas = document.createElement('canvas');
                        frameCanvas.width = this.canvas.width;
                        frameCanvas.height = this.canvas.height;
                        const frameCtx = frameCanvas.getContext('2d');
                        
                        frameCtx.drawImage(this.bgCanvas, 0, 0);
                        frameCtx.putImageData(layerData, 0, 0);
                        
                        gif.addFrame(frameCanvas, { 
                            delay: this.frameDelay,
                            copy: true
                        });
                    }

                    gif.on('finished', (blob) => {
                        if (onProgress) {
                            gif.off('progress', onProgress);
                        }
                        resolve(blob);
                    });
                    
                    setTimeout(() => {
                        if (!gif.running) {
                            reject(new Error('GIF rendering timeout'));
                        }
                    }, 30000);
                    
                    gif.render();
                } catch (error) {
                    reject(error);
                }
            });
        }
        
        // ========== クリーンアップ ==========
        
        destroy() {
            if (this.isPreviewPlaying) {
                this.stopPreview();
            }
            
            document.removeEventListener('keydown', this.boundHandleKeyDown);
            
            if (this.resizeObserver) {
                this.resizeObserver.disconnect();
                this.resizeObserver = null;
            }
            
            if (this.wrapper && this.wrapper.parentNode) {
                this.wrapper.remove();
            }
            
            this.canvas = null;
            this.ctx = null;
            this.bgCanvas = null;
            this.onionCanvas = null;
            this.onionCtx = null;
            this.layers = null;
            this.history = null;
            this.keyManager = null;
            this.clipboard = null;
        }
    };
    
    console.log('✅ TegakiAnimeCore loaded (Enhanced version with improved layout)');
})()