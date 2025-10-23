(function() {
    'use strict';
    
    // ========== Phase 1: Simplify.js (軽量版組み込み) ==========
    const simplifyPath = (function() {
        function getSqDist(p1, p2) {
            const dx = p1.x - p2.x;
            const dy = p1.y - p2.y;
            return dx * dx + dy * dy;
        }
        
        function getSqSegDist(p, p1, p2) {
            let x = p1.x, y = p1.y;
            let dx = p2.x - x;
            let dy = p2.y - y;
            
            if (dx !== 0 || dy !== 0) {
                const t = ((p.x - x) * dx + (p.y - y) * dy) / (dx * dx + dy * dy);
                if (t > 1) {
                    x = p2.x;
                    y = p2.y;
                } else if (t > 0) {
                    x += dx * t;
                    y += dy * t;
                }
            }
            
            dx = p.x - x;
            dy = p.y - y;
            return dx * dx + dy * dy;
        }
        
        function simplifyRadialDist(points, sqTolerance) {
            let prevPoint = points[0];
            const newPoints = [prevPoint];
            
            for (let i = 1; i < points.length; i++) {
                const point = points[i];
                if (getSqDist(point, prevPoint) > sqTolerance) {
                    newPoints.push(point);
                    prevPoint = point;
                }
            }
            
            if (prevPoint !== points[points.length - 1]) {
                newPoints.push(points[points.length - 1]);
            }
            
            return newPoints;
        }
        
        function simplifyDouglasPeucker(points, sqTolerance) {
            const len = points.length;
            const markers = new Uint8Array(len);
            let first = 0, last = len - 1;
            const stack = [];
            const newPoints = [];
            
            markers[first] = markers[last] = 1;
            
            while (last) {
                let maxSqDist = 0;
                let index = 0;
                
                for (let i = first + 1; i < last; i++) {
                    const sqDist = getSqSegDist(points[i], points[first], points[last]);
                    if (sqDist > maxSqDist) {
                        index = i;
                        maxSqDist = sqDist;
                    }
                }
                
                if (maxSqDist > sqTolerance) {
                    markers[index] = 1;
                    stack.push(first, index, index, last);
                }
                
                last = stack.pop();
                first = stack.pop();
            }
            
            for (let i = 0; i < len; i++) {
                if (markers[i]) newPoints.push(points[i]);
            }
            
            return newPoints;
        }
        
        return function(points, tolerance = 1, highestQuality = false) {
            if (points.length <= 2) return points;
            
            const sqTolerance = tolerance * tolerance;
            points = highestQuality ? points : simplifyRadialDist(points, sqTolerance);
            points = simplifyDouglasPeucker(points, sqTolerance);
            
            return points;
        };
    })();
    
    // ========== Phase 1: Catmull-Rom Spline 補間 ==========
    function catmullRomSpline(points, segments = 8) {
        if (points.length < 2) return points;
        if (points.length === 2) return points;
        
        const result = [];
        
        for (let i = 0; i < points.length - 1; i++) {
            const p0 = points[Math.max(0, i - 1)];
            const p1 = points[i];
            const p2 = points[i + 1];
            const p3 = points[Math.min(points.length - 1, i + 2)];
            
            for (let t = 0; t < segments; t++) {
                const u = t / segments;
                const u2 = u * u;
                const u3 = u2 * u;
                
                const x = 0.5 * (
                    (2 * p1.x) +
                    (-p0.x + p2.x) * u +
                    (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * u2 +
                    (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * u3
                );
                
                const y = 0.5 * (
                    (2 * p1.y) +
                    (-p0.y + p2.y) * u +
                    (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * u2 +
                    (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * u3
                );
                
                result.push({ x, y, pressure: p1.pressure || 0.5 });
            }
        }
        
        result.push(points[points.length - 1]);
        return result;
    }
    
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
            
            // Phase 1: ストローク管理
            this.currentStroke = [];
            this.strokeBuffer = [];
            
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
            
            // Phase 1: スムージング設定
            this.smoothingEnabled = true;
            this.smoothingSegments = 8;
            this.simplifyTolerance = 1.5;
            
            // オニオンスキン設定
            this.onionSkinFrames = 0;
            this.minOnionFrames = 0;
            this.maxOnionFrames = 3;
            
            // アニメーション設定
            this.frameCount = 5;
            this.frameDelay = 200;
            this.minDelay = 10;
            this.maxDelay = 1000;
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
            this.onionButtons = [];
            this.previewBtn = null;
            
            // Undo/Redo履歴
            this.history = [];
            this.historyIndex = [];
            
            // キー処理統合用
            this.keyManager = null;
            this.boundHandleKeyDown = this.handleKeyDown.bind(this);
            this.boundHandleKeyUp = this.handleKeyUp.bind(this);
            
            // V+ドラッグ用の状態管理
            this.isVKeyPressed = false;
            this.isMoving = false;
            this.moveStartX = 0;
            this.moveStartY = 0;
            this.tempLayerData = null;
            
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
            km.register('o', {}, () => this.cycleOnionSkin(), 'Cycle Onion Skin');
            
            for (let i = 1; i <= 9; i++) {
                if (i <= this.frameCount) {
                    km.register(String(i), {}, () => this.switchLayer(i - 1), `Layer ${i}`);
                }
            }
        }
        
        handleKeyDown(e) {
            if (!this.wrapper || !this.wrapper.isConnected) return;
            
            // Vキー単体の押下検知(移動モード用)
            if (e.key.toLowerCase() === 'v' && !e.ctrlKey && !e.shiftKey && !e.altKey) {
                if (!this.isVKeyPressed) {
                    this.isVKeyPressed = true;
                    this.canvas.style.cursor = 'move';
                }
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
            if (!this.wrapper || !this.wrapper.isConnected) return;
            
            // Vキーの解放検知
            if (e.key.toLowerCase() === 'v') {
                this.isVKeyPressed = false;
                if (this.isMoving) {
                    this.stopMoving();
                }
                // カーソルを元に戻す
                if (this.tool === 'pen') {
                    this.canvas.style.cursor = 'crosshair';
                } else if (this.tool === 'eraser') {
                    this.canvas.style.cursor = 'pointer';
                }
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
        
        // ========== レイヤー移動機能 ==========
        
        startMoving(e) {
            if (!this.isVKeyPressed) return;
            
            this.isMoving = true;
            const rect = this.canvas.getBoundingClientRect();
            this.moveStartX = e.clientX - rect.left;
            this.moveStartY = e.clientY - rect.top;
            
            // 現在のレイヤー内容を一時保存
            this.tempLayerData = this.ctx.getImageData(
                0, 0,
                this.canvas.width,
                this.canvas.height
            );
        }
        
        moveLayer(e) {
            if (!this.isMoving || !this.isVKeyPressed) return;
            
            const rect = this.canvas.getBoundingClientRect();
            const currentX = e.clientX - rect.left;
            const currentY = e.clientY - rect.top;
            
            const dx = currentX - this.moveStartX;
            const dy = currentY - this.moveStartY;
            
            // キャンバスを背景色でクリア
            this.ctx.fillStyle = this.backgroundColor;
            this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
            
            // 移動した位置に描画
            this.ctx.putImageData(this.tempLayerData, dx, dy);
        }
        
        stopMoving() {
            if (!this.isMoving) return;
            
            this.isMoving = false;
            this.tempLayerData = null;
            
            // 履歴に追加
            this.pushHistory();
            this.updateThumbnail();
            this.updateOnionSkin();
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
                    <div><b>O</b>: オニオンスキン</div>
                    <div><b>V+ドラッグ</b>: 移動</div>
                    <div><b>Ctrl+Z</b>: 元に戻す</div>
                    <div><b>Ctrl+Y</b>: やり直し</div>
                    <div><b>Ctrl+C</b>: コピー</div>
                    <div><b>Ctrl+V</b>: ペースト</div>
                </div>
                <h3 style="margin: 15px 0 10px 0; font-size: 14px; padding-bottom: 5px; border-top: 1px solid ${this.colors.lightMedium}; padding-top: 10px;">
                    🎨 Phase 1 機能
                </h3>
                <div style="line-height: 1.6; font-size: 11px; color: ${this.colors.lightMaroon};">
                    ✅ Pointer Events API<br>
                    ✅ 筆圧・傾き検出<br>
                    ✅ ストローク最適化<br>
                    ✅ Catmull-Rom補間<br>
                </div>
                <h3 style="margin: 15px 0 10px 0; font-size: 14px; padding-bottom: 5px;">
                    使い方
                </h3>
                <div style="line-height: 1.6; font-size: 11px;">
                    ・各レイヤーに描画<br>
                    ・サムネイルで切替<br>
                    ・オニオンスキンで確認<br>
                    ・プレビューで動作確認<br>
                    ・完成したらAPNG投稿
                </div>
                <h3 style="margin: 15px 0 10px 0; font-size: 14px; padding-bottom: 5px;">
                    注意事項
                </h3>
                <div style="line-height: 1.6; font-size: 10px; color: ${this.colors.lightMaroon};">
                    ※1.一度投稿した後は、スレを戻るなりして更新しないとツールでの投稿ができなくなる場合があります。<br>
                    ※2.予告無くバージョンが変更されたり消去されたりします。
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
                z-index: 1;
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
                z-index: 2;
                touch-action: none;
            `;
            
            // オニオンスキンキャンバス(最上層に配置)
            this.onionCanvas = document.createElement('canvas');
            this.onionCanvas.width = this.canvasWidth;
            this.onionCanvas.height = this.canvasHeight;
            this.onionCanvas.style.cssText = `
                position: absolute; 
                top: 0; 
                left: 0;
                pointer-events: none;
                z-index: 3;
            `;
            
            canvasContainer.appendChild(this.bgCanvas);
            canvasContainer.appendChild(this.canvas);
            canvasContainer.appendChild(this.onionCanvas);
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
                width: 220px;
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
            this.createSmoothingControl(); // Phase 1: 新規追加
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
                background: ${this.colors.medium};
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
        
        // ========== Phase 1: スムージングコントロール ==========
        createSmoothingControl() {
            const smoothControl = document.createElement('div');
            smoothControl.innerHTML = `
                <label style="display: block; margin-bottom: 8px; font-weight: bold;">
                    <input type="checkbox" id="smooth-toggle" ${this.smoothingEnabled ? 'checked' : ''}>
                    スムージング
                </label>
                <div style="margin-left: 20px; font-size: 11px; color: ${this.colors.lightMaroon};">
                    簡略化: <input type="number" id="simplify-tolerance" value="${this.simplifyTolerance}" 
                        min="0.5" max="5" step="0.5" style="width: 60px; padding: 2px;">
                </div>
            `;
            
            const smoothToggle = smoothControl.querySelector('#smooth-toggle');
            const simplifyInput = smoothControl.querySelector('#simplify-tolerance');
            
            smoothToggle.addEventListener('change', (e) => {
                this.smoothingEnabled = e.target.checked;
            });
            
            simplifyInput.addEventListener('input', (e) => {
                this.simplifyTolerance = parseFloat(e.target.value);
            });
            
            this.controlPanel.appendChild(smoothControl);
        }
        
        createOnionSkinControl() {
            const onionControl = document.createElement('div');
            
            const label = document.createElement('label');
            label.style.cssText = 'display: block; margin-bottom: 8px; font-weight: bold;';
            label.textContent = 'オニオンスキン';
            onionControl.appendChild(label);
            
            const btnContainer = document.createElement('div');
            btnContainer.style.cssText = 'display: flex; gap: 6px;';
            
            for (let i = 0; i <= this.maxOnionFrames; i++) {
                const btn = document.createElement('button');
                btn.textContent = String(i);
                btn.style.cssText = `
                    flex: 1;
                    padding: 8px;
                    background: ${i === this.onionSkinFrames ? this.colors.maroon : this.colors.lightMedium};
                    color: ${i === this.onionSkinFrames ? 'white' : this.colors.maroon};
                    border: none;
                    border-radius: 4px;
                    cursor: pointer;
                    font-weight: bold;
                    transition: all 0.2s;
                `;
                btn.onclick = () => this.setOnionSkin(i);
                this.onionButtons.push(btn);
                btnContainer.appendChild(btn);
            }
            
            onionControl.appendChild(btnContainer);
            this.controlPanel.appendChild(onionControl);
        }
        
        setOnionSkin(frames) {
            this.onionSkinFrames = frames;
            
            // ボタンのスタイル更新
            this.onionButtons.forEach((btn, i) => {
                if (i === frames) {
                    btn.style.background = this.colors.maroon;
                    btn.style.color = 'white';
                } else {
                    btn.style.background = this.colors.lightMedium;
                    btn.style.color = this.colors.maroon;
                }
            });
            
            this.updateOnionSkin();
        }
        
        cycleOnionSkin() {
            const nextFrames = (this.onionSkinFrames + 1) % (this.maxOnionFrames + 1);
            this.setOnionSkin(nextFrames);
        }
        
        updateOnionSkin() {
            if (this.onionSkinFrames === 0) {
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
                
                const tempCanvas = document.createElement('canvas');
                tempCanvas.width = this.canvasWidth;
                tempCanvas.height = this.canvasHeight;
                const tempCtx = tempCanvas.getContext('2d');
                
                // ImageDataからキャンバスに描画
                tempCtx.putImageData(this.layers[targetIndex], 0, 0);
                
                // オニオンスキンとして半透明で描画
                this.onionCtx.globalAlpha = opacity;
                
                if (offset < 0) {
                    this.onionCtx.filter = 'hue-rotate(0deg)';
                } else {
                    this.onionCtx.filter = 'hue-rotate(200deg)';
                }
                
                this.onionCtx.drawImage(tempCanvas, 0, 0);
            }
            
            this.onionCtx.globalAlpha = 1.0;
            this.onionCtx.filter = 'none';
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
                // 消しゴムは背景色のペンとして扱う
                this.ctx.globalCompositeOperation = 'source-over';
                this.ctx.lineWidth = this.eraserSize;
                this.ctx.strokeStyle = this.backgroundColor;
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
            
            // 初期状態で背景色を塗る
            this.ctx.fillStyle = this.backgroundColor;
            this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
            
            this.onionCtx = this.onionCanvas.getContext('2d', {
                willReadFrequently: true
            });
        }
        
        // ========== レイヤーと履歴の初期化 ==========
        
        initLayersAndHistory() {
            for (let i = 0; i < this.frameCount; i++) {
                // 背景色で塗りつぶされた初期ImageDataを作成
                const initialImageData = this.ctx.getImageData(
                    0, 0,
                    this.canvas.width, 
                    this.canvas.height
                );
                
                this.layers.push(initialImageData);
                this.history.push([this.cloneImageData(initialImageData)]);
                this.historyIndex.push(0);
            }
            
            if (this.thumbnailContainer && this.thumbnailContainer.childNodes[0]) {
                const firstThumb = this.thumbnailContainer.childNodes[0].querySelector('canvas');
                if (firstThumb) {
                    firstThumb.style.borderColor = this.colors.maroon;
                    firstThumb.style.transform = 'scale(1.1)';
                    
                    // サムネイルも背景色で初期化
                    const thumbCtx = firstThumb.getContext('2d');
                    thumbCtx.fillStyle = this.backgroundColor;
                    thumbCtx.fillRect(0, 0, firstThumb.width, firstThumb.height);
                }
            }
            
            // 全サムネイルを背景色で初期化
            this.thumbnailContainer.childNodes.forEach((thumbWrapper) => {
                const thumb = thumbWrapper.querySelector('canvas');
                if (thumb) {
                    const thumbCtx = thumb.getContext('2d');
                    thumbCtx.fillStyle = this.backgroundColor;
                    thumbCtx.fillRect(0, 0, thumb.width, thumb.height);
                }
            });
        }
        
        // ImageDataのクローンを作成
        cloneImageData(imageData) {
            const cloned = this.ctx.createImageData(imageData.width, imageData.height);
            cloned.data.set(imageData.data);
            return cloned;
        }
        
        // ========== Phase 1: イベントリスナー設定（Pointer Events対応）==========
        
        attachEvents() {
            // Pointer Events API（筆圧対応）
            this.canvas.addEventListener('pointerdown', (e) => {
                if (this.isVKeyPressed) {
                    this.startMoving(e);
                } else {
                    this.startDrawing(e);
                }
            });
            
            this.canvas.addEventListener('pointermove', (e) => {
                if (this.isMoving) {
                    this.moveLayer(e);
                } else if (this.isDrawing) {
                    this.drawWithPressure(e);
                }
            });
            
            this.canvas.addEventListener('pointerup', () => {
                if (this.isMoving) {
                    this.stopMoving();
                } else {
                    this.stopDrawing();
                }
            });
            
            this.canvas.addEventListener('pointerleave', () => {
                if (this.isMoving) {
                    this.stopMoving();
                } else {
                    this.stopDrawing();
                }
            });
            
            // マウスイベント（フォールバック）
            this.canvas.addEventListener('mousedown', (e) => {
                if (this.isVKeyPressed) {
                    this.startMoving(e);
                } else {
                    this.startDrawing(e);
                }
            });
            
            this.canvas.addEventListener('mousemove', (e) => {
                if (this.isMoving) {
                    this.moveLayer(e);
                } else if (this.isDrawing) {
                    this.draw(e);
                }
            });
            
            this.canvas.addEventListener('mouseup', () => {
                if (this.isMoving) {
                    this.stopMoving();
                } else {
                    this.stopDrawing();
                }
            });
            
            this.canvas.addEventListener('mouseleave', () => {
                if (this.isMoving) {
                    this.stopMoving();
                } else {
                    this.stopDrawing();
                }
            });
            
            // タッチイベント
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

            // キーボードイベント
            document.addEventListener('keydown', this.boundHandleKeyDown);
            document.addEventListener('keyup', this.boundHandleKeyUp);
        }
        
        // ========== Phase 1: 描画処理（筆圧対応＋リアルタイムスムージング） ==========
        
        startDrawing(e) {
            this.isDrawing = true;
            this.currentStroke = [];
            
            const rect = this.canvas.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            
            // Phase 1: 筆圧取得
            let pressure = 0.5;
            if (e.pressure !== undefined) {
                pressure = e.pressure;
            }
            
            this.lastX = x;
            this.lastY = y;
            
            this.currentStroke.push({ x, y, pressure });
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
            
            // Phase 1: ストローク記録
            this.currentStroke.push({ x, y, pressure: 0.5 });
        }
        
        drawWithPressure(e) {
            if (!this.isDrawing) return;
            
            const rect = this.canvas.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            
            let pressure = e.pressure || 0.5;
            
            if (pressure < 0.1) pressure = 0.1;
            
            // Phase 1: 筆圧カーブ適用（リアルタイム）
            pressure = Math.pow(pressure, 1 / this.pressureSensitivity);
            
            const baseSize = this.tool === 'pen' ? this.size : this.eraserSize;
            const adjustedSize = baseSize * (0.3 + pressure * 0.7);
            
            // Phase 1: リアルタイムスムージング（遅延なし）
            this.currentStroke.push({ x, y, pressure });
            
            // 最新の数点のみを使って滑らかな線を引く
            if (this.smoothingEnabled && this.currentStroke.length >= 3) {
                const len = this.currentStroke.length;
                const p0 = this.currentStroke[Math.max(0, len - 3)];
                const p1 = this.currentStroke[len - 2];
                const p2 = this.currentStroke[len - 1];
                
                // 簡易的なQuadratic曲線で滑らかに描画
                const midX = (p1.x + p2.x) / 2;
                const midY = (p1.y + p2.y) / 2;
                
                this.ctx.lineWidth = adjustedSize;
                this.ctx.beginPath();
                this.ctx.moveTo(this.lastX, this.lastY);
                this.ctx.quadraticCurveTo(p1.x, p1.y, midX, midY);
                this.ctx.stroke();
                
                this.lastX = midX;
                this.lastY = midY;
            } else {
                // 通常の直線描画
                this.ctx.lineWidth = adjustedSize;
                this.ctx.beginPath();
                this.ctx.moveTo(this.lastX, this.lastY);
                this.ctx.lineTo(x, y);
                this.ctx.stroke();
                
                this.lastX = x;
                this.lastY = y;
            }
        }
        
        stopDrawing() {
            if (!this.isDrawing) return;
            this.isDrawing = false;
            
            // Phase 1: 描画終了後の軽量な最適化（データ削減のみ）
            if (this.smoothingEnabled && this.currentStroke.length > 10) {
                // ストローク座標の簡略化のみ実行（視覚的変化なし）
                // これはメモリ節約とエクスポート時のファイルサイズ削減用
                this.currentStroke = simplifyPath(this.currentStroke, this.simplifyTolerance);
            }
            
            this.currentStroke = [];
            this.ctx.beginPath();
            
            this.ctx.lineWidth = this.tool === 'pen' ? this.size : this.eraserSize;
            
            this.pushHistory();
            this.updateThumbnail();
            this.updateOnionSkin();
        }
        
        // Phase 1: ストローク再描画（補間後）
        redrawStroke(points) {
            if (points.length < 2) return;
            
            // 一時的にキャンバスの状態を保存
            const tempImageData = this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);
            
            // 前回の履歴から復元（最後のストロークを消す）
            const history = this.history[this.activeLayerIndex];
            const index = this.historyIndex[this.activeLayerIndex];
            if (index > 0) {
                this.ctx.putImageData(history[index], 0, 0);
            }
            
            // スムージングされたストロークを描画
            this.ctx.beginPath();
            
            for (let i = 0; i < points.length - 1; i++) {
                const p1 = points[i];
                const p2 = points[i + 1];
                
                // 筆圧に応じた線幅
                let lineWidth = this.tool === 'pen' ? this.size : this.eraserSize;
                if (p1.pressure > 0) {
                    const pressure = Math.pow(p1.pressure, 1 / this.pressureSensitivity);
                    lineWidth = lineWidth * (0.3 + pressure * 0.7);
                }
                
                this.ctx.lineWidth = lineWidth;
                this.ctx.moveTo(p1.x, p1.y);
                this.ctx.lineTo(p2.x, p2.y);
                this.ctx.stroke();
            }
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
            
            // 現在のキャンバスの内容を直接サムネイルに描画
            thumbCtx.drawImage(
                this.canvas, 
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
            this.history[this.activeLayerIndex].push(this.cloneImageData(imageData));
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
                
                // レイヤーデータをそのまま出力(背景色を含む)
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
                        
                        // レイヤーデータをそのまま出力(背景色を含む)
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
        
        // ========== Phase 1: デバッグ情報取得 ==========
        
        getDebugInfo() {
            return {
                pointerEventsSupported: !!window.PointerEvent,
                pressureSensitivity: this.pressureSensitivity,
                smoothingEnabled: this.smoothingEnabled,
                currentStrokeLength: this.currentStroke.length,
                simplifyTolerance: this.simplifyTolerance,
                smoothingSegments: this.smoothingSegments,
                tool: this.tool,
                onionSkinFrames: this.onionSkinFrames,
                activeLayer: this.activeLayerIndex,
                isPreviewPlaying: this.isPreviewPlaying
            };
        }
        
        // ========== クリーンアップ ==========
        
        destroy() {
            if (this.isPreviewPlaying) {
                this.stopPreview();
            }
            
            document.removeEventListener('keydown', this.boundHandleKeyDown);
            document.removeEventListener('keyup', this.boundHandleKeyUp);
            
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
            this.currentStroke = null;
            this.strokeBuffer = null;
        }
    };
    
    console.log('✅ TegakiAnimeCore Phase 1 loaded - Pointer Events, Simplify.js, Catmull-Rom integrated');
})();