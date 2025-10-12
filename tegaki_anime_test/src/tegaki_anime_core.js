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
            this.backgroundColor = '#f0e0d6'; // 背景色（ふたば風）
            
            // 描画状態
            this.isDrawing = false;
            this.lastX = 0;
            this.lastY = 0;
            
            // ツール設定
            this.color = '#800000';
            this.size = 2;
            this.minSize = 1;
            this.maxSize = 20;
            
            // アニメーション設定
            this.frameCount = 5;
            this.frameDelay = 200; // ミリ秒
            this.minDelay = 10;
            this.maxDelay = 2000;
            this.layers = [];
            this.thumbnailContainer = null;
            this.activeLayerIndex = 0;
            
            // UI要素
            this.controlPanel = null;
            this.sizeSlider = null;
            this.delaySlider = null;
            
            // Undo/Redo履歴
            this.history = [];
            this.historyIndex = [];
            
            // Phase 5: キー処理統合用
            this.keyManager = null;
            this.boundHandleKeyDown = this.handleKeyDown.bind(this);
            
            // Phase 5: リサイズ対応
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
        
        // ========== Phase 5: キー処理統合 ==========
        
        setupKeyManager() {
            // キーマネージャーの初期化
            // 全てのキー処理をここで一元管理
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
            
            // デフォルトキーバインド登録
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
            
            // レイヤー切替（数字キー1-9）
            for (let i = 1; i <= 9; i++) {
                if (i <= this.frameCount) {
                    km.register(String(i), {}, () => this.switchLayer(i - 1), `Switch to layer ${i}`);
                }
            }
            
            // ツール切替（今後の拡張用）
            // km.register('p', {}, () => this.selectTool('pen'), 'Pen tool');
            // km.register('e', {}, () => this.selectTool('eraser'), 'Eraser tool');
        }
        
        handleKeyDown(e) {
            // UIが存在しない場合は処理しない（メモリリーク対策）
            if (!this.wrapper || !this.wrapper.isConnected) return;
            
            // キーマネージャーに委譲
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
        
        // ========== Phase 5: リサイズ対応 ==========
        
        setupResizeObserver() {
            // ResizeObserverでコンテナサイズ変化を監視
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
            // リサイズ処理（今後実装）
            // 現状は固定サイズ（400x400）
            // 将来的に可変サイズ対応時に実装
        }
        
        // ========== UI生成 ==========
        
        createUI() {
            // ラッパー作成
            this.wrapper = document.createElement('div');
            this.wrapper.style.cssText = `
                display: flex;
                flex-direction: column;
                width: 100%;
                height: 100%;
                background: #ffffee;
                padding: 10px 0 20px 0;
            `;
            
            // キャンバスエリア作成
            const canvasArea = document.createElement('div');
            canvasArea.style.cssText = `
                flex: 1;
                display: flex;
                justify-content: center;
                align-items: center;
                position: relative;
            `;
            
            // キャンバスコンテナ（背景+描画の2層構造）
            const canvasContainer = document.createElement('div');
            canvasContainer.style.cssText = `
                position: relative;
                width: ${this.canvasWidth}px;
                height: ${this.canvasHeight}px;
                box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
            `;
            
            // 背景キャンバス（レイヤー0）
            this.bgCanvas = document.createElement('canvas');
            this.bgCanvas.width = this.canvasWidth;
            this.bgCanvas.height = this.canvasHeight;
            const bgCtx = this.bgCanvas.getContext('2d');
            bgCtx.fillStyle = '#f0e0d6';
            bgCtx.fillRect(0, 0, this.canvasWidth, this.canvasHeight);
            this.bgCanvas.style.cssText = `
                position: absolute; 
                top: 0; 
                left: 0;
            `;
            
            // 描画キャンバス（レイヤー1・透明）
            this.canvas = document.createElement('canvas');
            this.canvas.width = this.canvasWidth;
            this.canvas.height = this.canvasHeight;
            this.canvas.style.cssText = `
                position: absolute; 
                top: 0; 
                left: 0; 
                cursor: crosshair;
            `;
            
            // 組み立て
            canvasContainer.appendChild(this.bgCanvas);
            canvasContainer.appendChild(this.canvas);
            canvasArea.appendChild(canvasContainer);
            
            // サムネイルエリア作成
            this.thumbnailContainer = document.createElement('div');
            this.thumbnailContainer.style.cssText = `
                display: flex;
                justify-content: center;
                gap: 10px;
                padding: 5px 0;
            `;
            
            // サムネイル個別作成（フレーム数分）
            for (let i = 0; i < this.frameCount; i++) {
                const thumb = document.createElement('canvas');
                thumb.width = 60;
                thumb.height = 60;
                thumb.style.cssText = `
                    border: 3px solid #aa5a56;
                    border-radius: 2px;
                    background: #f0e0d6;
                    cursor: pointer;
                    transition: all 0.2s;
                `;
                thumb.title = `レイヤー ${i + 1} (${i + 1}キー)`;
                thumb.onclick = () => this.switchLayer(i);
                this.thumbnailContainer.appendChild(thumb);
            }
            
            // DOMに追加
            this.wrapper.appendChild(canvasArea);
            this.wrapper.appendChild(this.thumbnailContainer);
            this.container.appendChild(this.wrapper);
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
                // 透明な ImageData を作成
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
            
            // タッチイベント（モバイル対応）
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

            // キーボードイベント（Undo/Redo）
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
            
            // 現在のレイヤーの描画内容を保存
            this.layers[this.activeLayerIndex] = this.ctx.getImageData(
                0, 0, 
                this.canvas.width, 
                this.canvas.height
            );
            
            // 新しいレイヤーに切り替え
            this.activeLayerIndex = index;
            this.ctx.putImageData(this.layers[index], 0, 0);
            
            // サムネイルのハイライトを更新
            this.thumbnailContainer.childNodes.forEach((thumb, i) => {
                thumb.style.borderColor = (i === index) ? '#800000' : '#aa5a56';
                thumb.style.transform = (i === index) ? 'scale(1.1)' : 'scale(1)';
            });
        }
        
        updateThumbnail() {
            const thumbCanvas = this.thumbnailContainer.childNodes[this.activeLayerIndex];
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
            
            // 現在位置より後の履歴を削除（分岐を防ぐ）
            if (index < history.length - 1) {
                this.history[this.activeLayerIndex] = history.slice(0, index + 1);
            }
            
            // 現在の状態を履歴に追加
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
            // 現在編集中のレイヤーの内容を保存
            this.layers[this.activeLayerIndex] = this.ctx.getImageData(
                0, 0, 
                this.canvas.width, 
                this.canvas.height
            );
        }
        
        // ========== APNGエクスポート ==========
        
        async exportAsApng() {
            this.prepareExport();
            
            // ライブラリの存在確認
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
                
                // 背景を描画
                frameCtx.drawImage(this.bgCanvas, 0, 0);
                
                // レイヤーを重ねる
                frameCtx.putImageData(layerData, 0, 0);
                
                // ImageData の data プロパティ（Uint8ClampedArray）を取得
                const imageData = frameCtx.getImageData(
                    0, 0, 
                    frameCanvas.width, 
                    frameCanvas.height
                );
                
                // ArrayBuffer に変換して frames 配列に追加
                frames.push(imageData.data.buffer);
            }
            
            // 各フレームの表示時間（ミリ秒）
            const delays = Array(this.frameCount).fill(this.frameDelay);
            
            // UPNG.encode でAPNGバイナリを生成
            const apngData = UPNG.encode(
                frames,
                this.canvas.width,
                this.canvas.height,
                0,
                delays
            );
            
            // Blob に変換して返す
            return new Blob([apngData], {type: 'image/png'});
        }
        
        // ========== GIFエクスポート ==========
        
        async exportAsGif(onProgress) {
            this.prepareExport();
            
            // ライブラリの存在確認
            if (!window.GIF) {
                alert('GIF生成ライブラリが読み込まれていません。');
                return null;
            }
            
            // Worker URL の取得と確認
            let workerUrl = window.GIF.prototype.options?.workerScript;
            
            // Worker URL が正しく設定されていない場合は再初期化
            if (!workerUrl || !workerUrl.startsWith('blob:')) {
                console.warn('Worker URL not initialized, attempting to reinitialize...');
                
                // グローバルに保存されたWorker URLを確認
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
                    // GIF.js インスタンスを作成（workerScriptを明示的に指定）
                    const gif = new GIF({
                        workers: 2,
                        quality: 10,
                        width: this.canvas.width,
                        height: this.canvas.height,
                        workerScript: workerUrl,
                        debug: false
                    });
                    
                    console.log('GIF instance created with worker:', workerUrl);
                    
                    // 進捗コールバックを登録
                    if (onProgress && typeof onProgress === 'function') {
                        gif.on('progress', onProgress);
                    }

                    // 各レイヤーを背景と合成してフレーム追加
                    for (const layerData of this.layers) {
                        const frameCanvas = document.createElement('canvas');
                        frameCanvas.width = this.canvas.width;
                        frameCanvas.height = this.canvas.height;
                        const frameCtx = frameCanvas.getContext('2d', {
                            willReadFrequently: true
                        });
                        
                        // 背景を描画
                        frameCtx.drawImage(this.bgCanvas, 0, 0);
                        
                        // レイヤーを重ねる
                        frameCtx.putImageData(layerData, 0, 0);
                        
                        // GIF にフレームを追加
                        gif.addFrame(frameCanvas, { 
                            delay: this.frameDelay,
                            copy: true
                        });
                    }

                    // 生成完了イベント
                    gif.on('finished', (blob) => {
                        // 進捗コールバックを解除（メモリリーク対策）
                        if (onProgress) {
                            gif.off('progress', onProgress);
                        }
                        resolve(blob);
                    });
                    
                    // エラーハンドリング
                    setTimeout(() => {
                        if (!gif.running) {
                            reject(new Error('GIF rendering timeout'));
                        }
                    }, 30000);
                    
                    // GIF生成を開始
                    gif.render();
                } catch (error) {
                    reject(error);
                }
            });
        }
        
        // ========== クリーンアップ ==========
        
        destroy() {
            // イベントリスナーを解除（メモリリーク対策）
            document.removeEventListener('keydown', this.boundHandleKeyDown);
            
            // ResizeObserver解除
            if (this.resizeObserver) {
                this.resizeObserver.disconnect();
                this.resizeObserver = null;
            }
            
            // DOM要素を削除
            if (this.wrapper && this.wrapper.parentNode) {
                this.wrapper.remove();
            }
            
            // 参照をクリア
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