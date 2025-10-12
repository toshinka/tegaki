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
            
            // キャンバス設定
            this.canvasWidth = 400;
            this.canvasHeight = 400;
            this.backgroundColor = '#f0e0d6';
            
            // 描画状態
            this.isDrawing = false;
            this.lastX = 0;
            this.lastY = 0;
            this.lastPressure = 0.5;
            
            // ツール設定
            this.currentTool = 'pen'; // 'pen' or 'eraser'
            this.color = '#800000';
            this.size = 2;
            this.minSize = 1;
            this.maxSize = 20;
            this.pressureSensitivity = 0.5; // 筆圧感度 0-1
            
            // クリップボード
            this.clipboard = null;
            
            // アニメーション設定
            this.frameCount = 5;
            this.frameDelay = 200;
            this.minDelay = 10;
            this.maxDelay = 2000;
            this.layers = [];
            this.thumbnailContainer = null;
            this.activeLayerIndex = 0;
            
            // UI要素
            this.controlPanel = null;
            this.sizeSlider = null;
            this.pressureSlider = null;
            this.delaySlider = null;
            this.penButton = null;
            this.eraserButton = null;
            
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
            
            // Undo/Redo
            km.register('z', { ctrl: true }, () => this.undo(), 'Undo');
            km.register('y', { ctrl: true }, () => this.redo(), 'Redo');
            
            // Copy/Paste
            km.register('c', { ctrl: true }, () => this.copyLayer(), 'Copy');
            km.register('v', { ctrl: true }, () => this.pasteLayer(), 'Paste');
            
            // レイヤー切替
            for (let i = 1; i <= 9; i++) {
                if (i <= this.frameCount) {
                    km.register(String(i), {}, () => this.switchLayer(i - 1), `Switch to layer ${i}`);
                }
            }
            
            // ツール切替
            km.register('p', {}, () => this.selectTool('pen'), 'Pen tool');
            km.register('e', {}, () => this.selectTool('eraser'), 'Eraser tool');
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
        
        // ========== コピー&ペースト ==========
        
        copyLayer() {
            this.clipboard = this.ctx.getImageData(
                0, 0, 
                this.canvas.width, 
                this.canvas.height
            );
            console.log('Layer copied to clipboard');
        }
        
        pasteLayer() {
            if (!this.clipboard) {
                console.log('No clipboard data');
                return;
            }
            
            this.ctx.putImageData(this.clipboard, 0, 0);
            this.pushHistory();
            this.updateThumbnail();
            console.log('Layer pasted from clipboard');
        }
        
        // ========== ツール選択 ==========
        
        selectTool(tool) {
            this.currentTool = tool;
            
            if (tool === 'pen') {
                this.canvas.style.cursor = 'crosshair';
                this.ctx.globalCompositeOperation = 'source-over';
                this.ctx.strokeStyle = this.color;
                if (this.penButton) this.penButton.style.background = '#800000';
                if (this.eraserButton) this.eraserButton.style.background = '#cf9c97';
            } else if (tool === 'eraser') {
                this.canvas.style.cursor = 'not-allowed';
                this.ctx.globalCompositeOperation = 'destination-out';
                if (this.penButton) this.penButton.style.background = '#cf9c97';
                if (this.eraserButton) this.eraserButton.style.background = '#800000';
            }
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
                background: #ffffee;
                gap: 10px;
                padding: 10px;
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
                background: rgba(240, 224, 214, 0.8);
                border: 2px solid #cf9c97;
                border-radius: 4px;
                padding: 10px;
                font-size: 12px;
                color: #800000;
                overflow-y: auto;
            `;
            
            panel.innerHTML = `
                <h3 style="margin: 0 0 10px 0; font-size: 14px; border-bottom: 1px solid #cf9c97; padding-bottom: 5px;">
                    ⌨️ ショートカット
                </h3>
                <div style="line-height: 1.8;">
                    <div><b>1-5</b>: レイヤー切替</div>
                    <div><b>P</b>: ペンツール</div>
                    <div><b>E</b>: 消しゴム</div>
                    <div><b>Ctrl+Z</b>: 元に戻す</div>
                    <div><b>Ctrl+Y</b>: やり直し</div>
                    <div><b>Ctrl+C</b>: コピー</div>
                    <div><b>Ctrl+V</b>: ペースト</div>
                </div>
                <h3 style="margin: 15px 0 10px 0; font-size: 14px; border-bottom: 1px solid #cf9c97; padding-bottom: 5px;">
                    ℹ️ 使い方
                </h3>
                <div style="line-height: 1.6; font-size: 11px;">
                    ・各レイヤーに描画<br>
                    ・下のサムネイルで切替<br>
                    ・右側でペン設定<br>
                    ・完成したらAPNG投稿
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
                gap: 10px;
            `;
            
            const canvasWrapper = document.createElement('div');
            canvasWrapper.style.cssText = `
                flex: 1;
                display: flex;
                justify-content: center;
                align-items: center;
            `;
            
            const canvasContainer = document.createElement('div');
            canvasContainer.style.cssText = `
                position: relative;
                width: ${this.canvasWidth}px;
                height: ${this.canvasHeight}px;
                box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
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
            canvasContainer.appendChild(this.canvas);
            canvasWrapper.appendChild(canvasContainer);
            
            // サムネイルエリア
            this.thumbnailContainer = document.createElement('div');
            this.thumbnailContainer.style.cssText = `
                display: flex;
                justify-content: center;
                gap: 10px;
                padding: 10px;
                background: rgba(240, 224, 214, 0.5);
                border-radius: 4px;
            `;
            
            for (let i = 0; i < this.frameCount; i++) {
                const thumbWrapper = document.createElement('div');
                thumbWrapper.style.cssText = `
                    position: relative;
                    display: inline-block;
                `;
                
                const thumb = document.createElement('canvas');
                thumb.width = 60;
                thumb.height = 60;
                thumb.style.cssText = `
                    border: 3px solid #aa5a56;
                    border-radius: 2px;
                    background: ${this.backgroundColor};
                    cursor: pointer;
                    transition: all 0.2s;
                    display: block;
                `;
                thumb.title = `レイヤー ${i + 1} (${i + 1}キー)`;
                thumb.onclick = () => this.switchLayer(i);
                
                const label = document.createElement('div');
                label.textContent = String(i + 1);
                label.style.cssText = `
                    position: absolute;
                    top: 2px;
                    left: 2px;
                    background: rgba(128, 0, 0, 0.8);
                    color: white;
                    font-size: 10px;
                    font-weight: bold;
                    padding: 2px 5px;
                    border-radius: 2px;
                    pointer-events: none;
                `;
                
                thumbWrapper.appendChild(thumb);
                thumbWrapper.appendChild(label);
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
                background: rgba(240, 224, 214, 0.8);
                border: 2px solid #cf9c97;
                border-radius: 4px;
                padding: 10px;
                font-size: 12px;
                color: #800000;
                display: flex;
                flex-direction: column;
                gap: 15px;
            `;
            
            // ツール選択ボタン
            const toolControl = document.createElement('div');
            toolControl.innerHTML = `
                <label style="display: block; margin-bottom: 5px; font-weight: bold;">
                    🖌️ ツール
                </label>
            `;
            
            const toolButtons = document.createElement('div');
            toolButtons.style.cssText = `
                display: flex;
                gap: 5px;
            `;
            
            this.penButton = document.createElement('button');
            this.penButton.innerHTML = `
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M13 21h8"/><path d="M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z"/>
                </svg>
            `;
            this.penButton.style.cssText = `
                flex: 1;
                padding: 8px;
                background: #800000;
                border: none;
                border-radius: 4px;
                cursor: pointer;
                display: flex;
                align-items: center;
                justify-content: center;
            `;
            this.penButton.onclick = () => this.selectTool('pen');
            this.penButton.title = 'ペンツール (P)';
            
            this.eraserButton = document.createElement('button');
            this.eraserButton.innerHTML = `
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M21 21H8a2 2 0 0 1-1.42-.587l-3.994-3.999a2 2 0 0 1 0-2.828l10-10a2 2 0 0 1 2.829 0l5.999 6a2 2 0 0 1 0 2.828L12.834 21"/>
                    <path d="m5.082 11.09 8.828 8.828"/>
                </svg>
            `;
            this.eraserButton.style.cssText = `
                flex: 1;
                padding: 8px;
                background: #cf9c97;
                border: none;
                border-radius: 4px;
                cursor: pointer;
                display: flex;
                align-items: center;
                justify-content: center;
            `;
            this.eraserButton.onclick = () => this.selectTool('eraser');
            this.eraserButton.title = '消しゴム (E)';
            
            toolButtons.appendChild(this.penButton);
            toolButtons.appendChild(this.eraserButton);
            toolControl.appendChild(toolButtons);
            
            // ペンサイズスライダー
            const sizeControl = document.createElement('div');
            sizeControl.innerHTML = `
                <label style="display: block; margin-bottom: 5px; font-weight: bold;">
                    ✏️ ペンサイズ: <span id="size-value">${this.size}</span>px
                </label>
                <input type="range" id="size-slider" 
                    min="${this.minSize}" 
                    max="${this.maxSize}" 
                    value="${this.size}" 
                    style="width: 100%; accent-color: #800000;">
            `;
            
            this.sizeSlider = sizeControl.querySelector('#size-slider');
            const sizeValue = sizeControl.querySelector('#size-value');
            this.sizeSlider.addEventListener('input', (e) => {
                this.size = parseInt(e.target.value);
                sizeValue.textContent = this.size;
                this.ctx.lineWidth = this.size;
            });
            
            // 筆圧スライダー
            const pressureControl = document.createElement('div');
            pressureControl.innerHTML = `
                <label style="display: block; margin-bottom: 5px; font-weight: bold;">
                    💪 筆圧感度: <span id="pressure-value">${Math.round(this.pressureSensitivity * 100)}</span>%
                </label>
                <input type="range" id="pressure-slider" 
                    min="0" 
                    max="100" 
                    value="${Math.round(this.pressureSensitivity * 100)}" 
                    style="width: 100%; accent-color: #800000;">
                <div style="display: flex; justify-content: space-between; font-size: 10px; color: #666; margin-top: 2px;">
                    <span>弱い</span>
                    <span>強い</span>
                </div>
            `;
            
            this.pressureSlider = pressureControl.querySelector('#pressure-slider');
            const pressureValue = pressureControl.querySelector('#pressure-value');
            this.pressureSlider.addEventListener('input', (e) => {
                this.pressureSensitivity = parseInt(e.target.value) / 100;
                pressureValue.textContent = e.target.value;
            });
            
            // アニメーション速度スライダー
            const delayControl = document.createElement('div');
            delayControl.innerHTML = `
                <label style="display: block; margin-bottom: 5px; font-weight: bold;">
                    ⏱️ フレーム間隔: <span id="delay-value">${this.frameDelay}</span>ms
                </label>
                <input type="range" id="delay-slider" 
                    min="${this.minDelay}" 
                    max="${this.maxDelay}" 
                    value="${this.frameDelay}" 
                    step="10"
                    style="width: 100%; accent-color: #800000;">
                <div style="display: flex; justify-content: space-between; font-size: 10px; color: #666; margin-top: 2px;">
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
            
            // プレビューボタン
            const previewBtn = document.createElement('button');
            previewBtn.textContent = '▶️ プレビュー';
            previewBtn.style.cssText = `
                padding: 8px;
                background: #4ade80;
                color: white;
                border: none;
                border-radius: 4px;
                cursor: pointer;
                font-weight: bold;
            `;
            previewBtn.onclick = () => this.previewAnimation();
            
            this.controlPanel.appendChild(toolControl);
            this.controlPanel.appendChild(sizeControl);
            this.controlPanel.appendChild(pressureControl);
            this.controlPanel.appendChild(delayControl);
            this.controlPanel.appendChild(previewBtn);
            
            this.wrapper.appendChild(this.controlPanel);
        }
        
        previewAnimation() {
            alert('プレビュー機能は今後実装予定です');
        }
        
        // ========== キャンバス設定 ==========
        
        setupCanvas() {
            this.ctx = this.canvas.getContext('2d', {
                willReadFrequently: true
            });
            this.ctx.lineCap = 'round';
            this.ctx.lineJoin = 'round';
            this.ctx.strokeStyle = this.color;
            this.ctx.lineWidth = this.size;
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
        }
        
        // ========== イベントリスナー設定 ==========
        
        attachEvents() {
            // マウスイベント
            this.canvas.addEventListener('mousedown', (e) => this.startDrawing(e));
            this.canvas.addEventListener('mousemove', (e) => this.draw(e));
            this.canvas.addEventListener('mouseup', () => this.stopDrawing());
            this.canvas.addEventListener('mouseleave', () => this.stopDrawing());
            
            // タッチイベント
            this.canvas.addEventListener('touchstart', (e) => {
                e.preventDefault();
                const touch = e.touches[0];
                const mouseEvent = new MouseEvent('mousedown', {
                    clientX: touch.clientX,
                    clientY: touch.clientY
                });
                this.canvas.dispatchEvent(mouseEvent);
            });
            
            this.canvas.addEventListener('touchmove', (e) => {
                e.preventDefault();
                const touch = e.touches[0];
                const mouseEvent = new MouseEvent('mousemove', {
                    clientX: touch.clientX,
                    clientY: touch.clientY
                });
                this.canvas.dispatchEvent(mouseEvent);
            });
            
            this.canvas.addEventListener('touchend', (e) => {
                e.preventDefault();
                const mouseEvent = new MouseEvent('mouseup', {});
                this.canvas.dispatchEvent(mouseEvent);
            });

            // キーボードイベント
            document.addEventListener('keydown', this.boundHandleKeyDown);
        }
        
        // ========== 描画処理 ==========
        
        getPressure(e) {
            // Pointer Events APIで筆圧取得を試みる
            if (e.pressure !== undefined && e.pressure > 0) {
                return e.pressure;
            }
            // タッチイベントの場合は固定値
            if (e.touches && e.touches.length > 0) {
                return 0.5;
            }
            // マウスの場合は固定値
            return 0.5;
        }
        
        startDrawing(e) {
            this.isDrawing = true;
            const rect = this.canvas.getBoundingClientRect();
            this.lastX = e.clientX - rect.left;
            this.lastY = e.clientY - rect.top;
            this.lastPressure = this.getPressure(e);
        }
        
        draw(e) {
            if (!this.isDrawing) return;
            
            const rect = this.canvas.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            const pressure = this.getPressure(e);
            
            // 筆圧を適用したペンサイズ計算
            const minWidth = this.size * 0.3; // 最小荷重時のサイズ
            const pressureFactor = this.pressureSensitivity * pressure + (1 - this.pressureSensitivity);
            const adjustedSize = minWidth + (this.size - minWidth) * pressureFactor;
            
            this.ctx.lineWidth = adjustedSize;
            
            this.ctx.beginPath();
            this.ctx.moveTo(this.lastX, this.lastY);
            this.ctx.lineTo(x, y);
            this.ctx.stroke();
            
            this.lastX = x;
            this.lastY = y;
            this.lastPressure = pressure;
        }
        
        stopDrawing() {
            if (!this.isDrawing) return;
            this.isDrawing = false;
            this.ctx.beginPath();
            this.pushHistory();
            this.updateThumbnail();
        }
        
        // ========== レイヤー管理 ==========
        
        switchLayer(index) {
            if (index === this.activeLayerIndex) return;
            
            this.layers[this.activeLayerIndex] = this.ctx.getImageData(
                0, 0, 
                this.canvas.width, 
                this.canvas.height
            );
            
            this.activeLayerIndex = index;
            this.ctx.putImageData(this.layers[index], 0, 0);
            
            // サムネイルのハイライトを更新
            const thumbs = this.thumbnailContainer.querySelectorAll('canvas');
            thumbs.forEach((thumb, i) => {
                thumb.style.borderColor = (i === index) ? '#800000' : '#aa5a56';
                thumb.style.transform = (i === index) ? 'scale(1.1)' : 'scale(1)';
            });
        }
        
        updateThumbnail() {
            const thumbs = this.thumbnailContainer.querySelectorAll('canvas');
            const thumbCanvas = thumbs[this.activeLayerIndex];
            if (!thumbCanvas) return;
            
            const thumbCtx = thumbCanvas.getContext('2d', {
                willReadFrequently: true
            });
            thumbCtx.clearRect(0, 0, thumbCanvas.width, thumbCanvas.height);

            // サムネイルには背景も合成して表示
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
            }
        }
        
        // ========== エクスポート前処理 ==========
        
        prepareExport() {
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
                alert('APNG生成ライブラリ(UPNG.js/pako.js)が読み込まれていません。');
                return null;
            }
            
            const frames = [];
            
            // 各レイヤーを背景と合成してフレーム化
            for (const layerData of this.layers) {
                const frameCanvas = document.createElement('canvas');
                frameCanvas.width = this.canvas.width;
                frameCanvas.height = this.canvas.height;
                const frameCtx = frameCanvas.getContext('2d');
                
                // 背景色で塗りつぶし (#f0e0d6)
                frameCtx.fillStyle = this.backgroundColor;
                frameCtx.fillRect(0, 0, frameCanvas.width, frameCanvas.height);
                
                // レイヤーを重ねる
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
                alert('GIF生成ライブラリが読み込まれていません。');
                return null;
            }
            
            let workerUrl = window.GIF.prototype.options?.workerScript;
            
            if (!workerUrl || !workerUrl.startsWith('blob:')) {
                console.warn('Worker URL not initialized, attempting to reinitialize...');
                
                if (window.__gifWorkerUrl && window.__gifWorkerUrl.startsWith('blob:')) {
                    workerUrl = window.__gifWorkerUrl;
                    console.log('Using cached worker URL:', workerUrl);
                } else {
                    console.error('Worker URL not found:', workerUrl);
                    alert('GIF Worker が初期化されていません。ページを再読み込みしてください。');
                    return null;
                }
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
                    
                    console.log('GIF instance created with worker:', workerUrl);
                    
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
                        
                        // 背景色で塗りつぶし (#f0e0d6)
                        frameCtx.fillStyle = this.backgroundColor;
                        frameCtx.fillRect(0, 0, frameCanvas.width, frameCanvas.height);
                        
                        // レイヤーを重ねる
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
            this.layers = null;
            this.history = null;
            this.keyManager = null;
        }
    };
    
    console.log('✅ TegakiAnimeCore loaded');
})();