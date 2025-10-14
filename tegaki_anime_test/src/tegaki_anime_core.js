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
            
            // オニオンスキン設定（★改修：デフォルト1に変更）
            this.onionSkinMode = 1;
            this.onionSkinAlpha = 0.3;
            
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
            
            // ★改修：V+ドラッグ用の変数追加
            this.isDraggingCanvas = false;
            this.dragStartCanvasX = 0;
            
            // UI要素
            this.controlPanel = null;
            this.sizeSlider = null;
            this.eraserSizeSlider = null;
            this.pressureSlider = null;
            this.delaySlider = null;
            this.previewBtn = null;
            this.onionSkinButtons = [];
            
            // Undo/Redo履歴
            this.history = [];
            this.historyIndex = [];
            
            // キー処理統合用
            this.keyManager = null;
            this.boundHandleKeyDown = this.handleKeyDown.bind(this);
            this.vKeyPressed = false;
            
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
            
            // ★改修：Oキーでオニオンスキンサイクル追加
            km.register('o', {}, () => this.cycleOnionSkinMode(), 'Cycle Onion');
            
            for (let i = 1; i <= 9; i++) {
                if (i <= this.frameCount) {
                    km.register(String(i), {}, () => this.switchLayer(i - 1), `Layer ${i}`);
                }
            }
        }
        
        // ★改修：Oキーでオニオンスキン切替
        cycleOnionSkinMode() {
            this.onionSkinMode = (this.onionSkinMode + 1) % 4;
            this.setOnionSkinMode(this.onionSkinMode);
        }
        
        handleKeyDown(e) {
            if (!this.wrapper || !this.wrapper.isConnected) return;
            
            // V キー判定（レイヤードラッグ用）
            if (e.key.toLowerCase() === 'v' && !e.ctrlKey) {
                this.vKeyPressed = true;
                this.canvas.style.cursor = 'grab';
                return;
            }
            
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
        
        handleKeyUp(e) {
            if (e.key.toLowerCase() === 'v') {
                this.vKeyPressed = false;
                this.isDraggingLayer = false;
                this.canvas.style.cursor = this.tool === 'pen' ? 'crosshair' : 'pointer';
            }
        }
        
        // ========== コピー&ペースト ==========
        
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
        
        // ========== オニオンスキン制御 ==========
        
        setOnionSkinMode(mode) {
            if (mode < 0 || mode > 3) return;
            this.onionSkinMode = mode;
            
            // ★改修：ふたばカラー適用
            this.onionSkinButtons.forEach(({ btn, btnMode }) => {
                if (btnMode === mode) {
                    btn.style.background = this.colors.maroon;
                    btn.style.color = 'white';
                } else {
                    btn.style.background = this.colors.lightMedium;
                    btn.style.color = this.colors.maroon;
                }
            });
            
            this.updateOnionSkin();
        }
        
        // ★改修：オニオンスキン描画ロジック修正
        updateOnionSkin() {
            if (this.onionCtx) {
                this.onionCtx.clearRect(0, 0, this.onionCanvas.width, this.onionCanvas.height);
            }
            
            if (this.onionSkinMode === 0) return;
            
            this.onionCtx = this.onionCanvas.getContext('2d');
            
            // 過去フレーム（赤系・段々薄くなる）
            for (let i = 1; i <= this.onionSkinMode; i++) {
                const prevIndex = this.activeLayerIndex - i;
                if (prevIndex < 0) break;
                
                const prevLayer = this.layers[prevIndex];
                if (!prevLayer) continue;
                
                const opacity = this.onionSkinAlpha / i;
                
                // ★重要：lighten合成モードで透過を保持
                this.onionCtx.globalCompositeOperation = 'lighten';
                this.onionCtx.globalAlpha = opacity;
                this.onionCtx.filter = 'hue-rotate(0deg) saturate(1.2)';
                
                const tempCanvas = document.createElement('canvas');
                tempCanvas.width = this.canvas.width;
                tempCanvas.height = this.canvas.height;
                const tempCtx = tempCanvas.getContext('2d');
                tempCtx.putImageData(prevLayer, 0, 0);
                
                this.onionCtx.drawImage(tempCanvas, 0, 0);
            }
            
            // 未来フレーム（青系・段々薄くなる）
            for (let i = 1; i <= this.onionSkinMode; i++) {
                const nextIndex = this.activeLayerIndex + i;
                if (nextIndex >= this.frameCount) break;
                
                const nextLayer = this.layers[nextIndex];
                if (!nextLayer) continue;
                
                const opacity = this.onionSkinAlpha / i;
                
                // ★重要：lighten合成モードで透過を保持
                this.onionCtx.globalCompositeOperation = 'lighten';
                this.onionCtx.globalAlpha = opacity;
                this.onionCtx.filter = 'hue-rotate(200deg) saturate(1.2)';
                
                const tempCanvas = document.createElement('canvas');
                tempCanvas.width = this.canvas.width;
                tempCanvas.height = this.canvas.height;
                const tempCtx = tempCanvas.getContext('2d');
                tempCtx.putImageData(nextLayer, 0, 0);
                
                this.onionCtx.drawImage(tempCanvas, 0, 0);
            }
            
            this.onionCtx.globalAlpha = 1.0;
            this.onionCtx.filter = 'none';
            this.onionCtx.globalCompositeOperation = 'source-over';
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
                    <div><b>O</b>: オニオンスキン</div>
                    <div><b>P</b>: ペン</div>
                    <div><b>E</b>: 消しゴム</div>
                    <div><b>Ctrl+Z</b>: 元に戻す</div>
                    <div><b>Ctrl+Y</b>: やり直し</div>
                    <div><b>Ctrl+C</b>: コピー</div>
                    <div><b>Ctrl+V</b>: ペースト</div>
                    <div><b>V+ドラッグ</b>: レイヤー移動</div>
                </div>
 
                <h3 style="margin: 15px 0 10px 0; font-size: 14px; padding-bottom: 5px;">
                    注意事項
                </h3>
                <div style="line-height: 1.6; font-size: 11px;">
                    ※一度ツールを起動し添付した後は、二度目の添付を受け付けないことがあります。再度同じスレッドにおえかきをする際は、一度スレを閉じるか移動して更新してからツールを再起動してください。<BR>
                    ※本ツールは予告無く仕様変更・削除される事があります。
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
                touch-action: none;
            `;
            
            canvasContainer.appendChild(this.bgCanvas);
            canvasContainer.appendChild(this.onionCanvas);
            canvasContainer.appendChild(this.canvas);
            canvasWrapper.appendChild(canvasContainer);
            
            // サムネイルエリア
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
                thumb.layerIndex = i;
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
        
        // ★改修：ふたばカラー適用
        createOnionSkinControl() {
            const onionControl = document.createElement('div');
            
            const label = document.createElement('label');
            label.style.cssText = 'display: block; margin-bottom: 8px; font-weight: bold;';
            label.textContent = 'オニオンスキン';
            onionControl.appendChild(label);
            
            const btnGroup = document.createElement('div');
            btnGroup.style.cssText = 'display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px;';
            
            for (let i = 0; i <= 3; i++) {
                const btn = document.createElement('button');
                btn.textContent = i === 0 ? 'OFF' : String(i);
                btn.style.cssText = `
                    padding: 6px 4px;
                    background: ${i === this.onionSkinMode ? this.colors.maroon : this.colors.lightMedium};
                    color: ${i === this.onionSkinMode ? 'white' : this.colors.maroon};
                    border: none;
                    border-radius: 3px;
                    cursor: pointer;
                    font-size: 12px;
                    font-weight: bold;
                `;
                btn.onclick = () => this.setOnionSkinMode(i);
                btnGroup.appendChild(btn);
                this.onionSkinButtons.push({ btn, btnMode: i });
            }
            
            onionControl.appendChild(btnGroup);
            this.controlPanel.appendChild(onionControl);
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
                this.canvas.style.cursor = this.vKeyPressed ? 'grab' : 'crosshair';
                
                this.penBtn.style.background = this.colors.maroon;
                this.eraserBtn.style.background = this.colors.lightMaroon;
            } else if (tool === 'eraser') {
                this.ctx.globalCompositeOperation = 'destination-out';
                this.ctx.lineWidth = this.eraserSize;
                this.canvas.style.cursor = this.vKeyPressed ? 'grab' : 'pointer';
                
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
            
            this.canvas.style.touchAction = 'none';
            
            this.onionCtx = this.onionCanvas.getContext('2d', {
                willReadFrequently: true
            });
        }
        
        // ========== レイヤーと履歴の初期化 ==========
        
        initLayersAndHistory() {
            for (let i = 0; i < this.frameCount; i++) {
                // ★改修：透明背景で初期化（背景色を塗らない）
                const tempCanvas = document.createElement('canvas');
                tempCanvas.width = this.canvas.width;
                tempCanvas.height = this.canvas.height;
                const tempCtx = tempCanvas.getContext('2d');
                
                // 透明のまま（背景を塗らない）
                tempCtx.clearRect(0, 0, this.canvas.width, this.canvas.height);
                
                const initialImageData = tempCtx.getImageData(
                    0, 0,
                    this.canvas.width, 
                    this.canvas.height
                );
                
                this.layers.push(initialImageData);
                this.history.push([initialImageData]);
                this.historyIndex.push(0);
            }
            
            this.ctx.putImageData(this.layers[0], 0, 0);
            
            if (this.thumbnailContainer && this.thumbnailContainer.childNodes[0]) {
                const firstThumb = this.thumbnailContainer.childNodes[0].querySelector('canvas');
                if (firstThumb) {
                    firstThumb.style.borderColor = this.colors.maroon;
                    firstThumb.style.transform = 'scale(1.1)';
                }
                
                for (let i = 0; i < this.frameCount; i++) {
                    this.updateThumbnailByIndex(i);
                }
            }
        }
        
        // ========== イベントリスナー設定 ==========
        
        attachEvents() {
            // pointerイベントで統一（ペン・マウス・タッチ）
            this.canvas.addEventListener('pointerdown', (e) => {
                e.preventDefault();
                if (e.pointerType === 'mouse' && e.button !== 0) return;
                
                if (this.vKeyPressed) {
                    this.startCanvasDrag(e);
                    return;
                }
                
                this.startDrawing(e);
            });
            
            this.canvas.addEventListener('pointermove', (e) => {
                e.preventDefault();
                
                if (this.isDraggingCanvas) {
                    this.dragCanvas(e);
                    return;
                }
                
                if (this.isDrawing) {
                    this.draw(e);
                }
            });
            
            this.canvas.addEventListener('pointerup', (e) => {
                e.preventDefault();
                if (this.isDraggingCanvas) {
                    this.stopCanvasDrag();
                } else {
                    this.stopDrawing();
                }
            });
            
            this.canvas.addEventListener('pointerleave', () => {
                if (this.isDraggingCanvas) this.stopCanvasDrag();
                if (this.isDrawing) this.stopDrawing();
            });

            window.addEventListener('keydown', this.boundHandleKeyDown);
            window.addEventListener('keyup', (e) => this.handleKeyUp(e));
        }
        
        // ========== 描画処理 ==========
        
        startDrawing(e) {
            this.isDrawing = true;
            const rect = this.canvas.getBoundingClientRect();
            this.lastX = (e.clientX - rect.left) * (this.canvas.width / rect.width);
            this.lastY = (e.clientY - rect.top) * (this.canvas.height / rect.height);
            
            this.ctx.beginPath();
            this.ctx.moveTo(this.lastX, this.lastY);
            this.ctx.lineCap = 'round';
            this.ctx.lineJoin = 'round';
        }
        
        draw(e) {
            if (!this.isDrawing) return;
            
            const rect = this.canvas.getBoundingClientRect();
            const x = (e.clientX - rect.left) * (this.canvas.width / rect.width);
            const y = (e.clientY - rect.top) * (this.canvas.height / rect.height);
            
            this.ctx.lineTo(x, y);
            this.ctx.stroke();
            
            this.lastX = x;
            this.lastY = y;
        }
        
        stopDrawing() {
            if (!this.isDrawing) return;
            this.isDrawing = false;
            
            this.pushHistory();
            this.updateThumbnail();
            this.updateOnionSkin();
        }
        
        // ========== V+ドラッグでレイヤー移動 ==========
        
        startCanvasDrag(e) {
            this.isDraggingCanvas = true;
            this.dragStartCanvasX = e.clientX;
            this.canvas.style.cursor = 'grabbing';
        }
        
        dragCanvas(e) {
            if (!this.isDraggingCanvas) return;
            
            const deltaX = e.clientX - this.dragStartCanvasX;
            const threshold = 40;
            
            if (Math.abs(deltaX) > threshold) {
                const direction = deltaX > 0 ? 1 : -1;
                const targetIndex = this.activeLayerIndex + direction;
                
                if (targetIndex >= 0 && targetIndex < this.frameCount) {
                    this.switchLayer(targetIndex);
                    this.dragStartCanvasX = e.clientX;
                }
            }
        }
        
        stopCanvasDrag() {
            this.isDraggingCanvas = false;
            this.canvas.style.cursor = this.tool === 'pen' ? 'crosshair' : 'pointer';
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
            this.updateThumbnailByIndex(this.activeLayerIndex);
        }
        
        updateThumbnailByIndex(index) {
            const thumbWrapper = this.thumbnailContainer.childNodes[index];
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
            
            const layerCanvas = document.createElement('canvas');
            layerCanvas.width = this.canvas.width;
            layerCanvas.height = this.canvas.height;
            const layerCtx = layerCanvas.getContext('2d', {
                willReadFrequently: true
            });
            layerCtx.putImageData(this.layers[index], 0, 0);
            
            tempCtx.drawImage(layerCanvas, 0, 0);
            
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
            
            this.layers[this.activeLayerIndex] = imageData;
        }

        undo() {
            let index = this.historyIndex[this.activeLayerIndex];
            if (index > 0) {
                index--;
                this.historyIndex[this.activeLayerIndex] = index;
                const imageData = this.history[this.activeLayerIndex][index];
                this.ctx.putImageData(imageData, 0, 0);
                this.layers[this.activeLayerIndex] = imageData;
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
                this.layers[this.activeLayerIndex] = imageData;
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
            
            if (!window.UPNG) {
                console.error('Missing UPNG');
                alert('APNGエクスポートにはUPNG.jsが必要です。\nページを再読み込みしてください。');
                return null;
            }
            
            if (!window.pako) {
                console.error('Missing pako');
                alert('APNGエクスポートにはpako.jsが必要です。\nページを再読み込みしてください。');
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
            
            try {
                const apngData = window.UPNG.encode(
                    frames,
                    this.canvas.width,
                    this.canvas.height,
                    0,
                    delays
                );
                
                return new Blob([apngData], {type: 'image/png'});
            } catch (error) {
                console.error('APNG encoding failed:', error);
                alert('APNG生成中にエラーが発生しました:\n' + error.message);
                return null;
            }
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
                        const frameCtx = frameCanvas.getContext('2d', {
                            willReadFrequently: true
                        });
                        
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
            
            // ★修正：windowからイベント削除
            window.removeEventListener('keydown', this.boundHandleKeyDown);
            window.removeEventListener('keyup', (e) => this.handleKeyUp(e));
            
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
    
    console.log('✅ TegakiAnimeCore loaded (完全版・全機能継承)');
})();