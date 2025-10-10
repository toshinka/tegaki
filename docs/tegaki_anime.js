// ==================================================
// tegaki_anime.js
// アニメーションお絵かき機能本体
// ==================================================

(function() {
    'use strict';
    
    // ===== Tegakiコアクラス (アニメーション対応版) =====
    window.TegakiAnimeCore = class TegakiAnimeCore {
        constructor(container) {
            this.container = container;
            this.wrapper = null;
            this.canvas = null; // 描画用メインキャンバス
            this.ctx = null;
            this.bgCanvas = null; // 背景表示用キャンバス
            this.bgCtx = null;
            
            // 描画状態
            this.isDrawing = false;
            this.lastX = 0;
            this.lastY = 0;
            
            // 固定ツール設定
            this.color = '#800000';
            this.size = 2;
            
            // アニメーション設定
            this.frameCount = 5;
            this.frameDelay = 200; // 1フレームあたりの表示時間 (ms) 0.2s
            this.layers = []; // 各フレームのImageDataを保持
            this.thumbnailContainer = null;
            this.activeLayerIndex = 0;
            
            // Undo/Redo履歴
            this.history = []; // 各レイヤーの履歴を保持する2次元配列
            this.historyIndex = []; // 各レイヤーの現在の履歴位置
            
            this.init();
        }
        
        // ===== 初期化 =====
        init() {
            this.createUI();
            this.setupCanvas();
            this.initLayersAndHistory();
            this.attachEvents();
            this.switchLayer(0); // 最初のレイヤーをアクティブに
        }
        
        // ===== UI作成 =====
        createUI() {
            // ラッパー
            this.wrapper = document.createElement('div');
            this.wrapper.style.cssText = `
                display: flex;
                flex-direction: column;
                width: 100%;
                height: 100%;
                background: #ffffee;
                padding-top: 20px;
            `;
            
            // キャンバスエリア
            const canvasArea = document.createElement('div');
            canvasArea.style.cssText = `
                flex: 1;
                display: flex;
                justify-content: center;
                align-items: center;
                position: relative;
            `;
            
            // キャンバスコンテナ
            const canvasContainer = document.createElement('div');
            canvasContainer.style.cssText = `
                position: relative;
                width: 400px;
                height: 400px;
                box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
            `;
            
            // 背景キャンバス（レイヤー0）
            this.bgCanvas = document.createElement('canvas');
            this.bgCanvas.width = 400;
            this.bgCanvas.height = 400;
            this.bgCanvas.style.cssText = `
                position: absolute; top: 0; left: 0; background: #f0e0d6;
            `;
            
            // 描画キャンバス（レイヤー1・透明）
            this.canvas = document.createElement('canvas');
            this.canvas.width = 400;
            this.canvas.height = 400;
            this.canvas.style.cssText = `
                position: absolute; top: 0; left: 0; cursor: crosshair;
            `;
            
            canvasContainer.appendChild(this.bgCanvas);
            canvasContainer.appendChild(this.canvas);
            canvasArea.appendChild(canvasContainer);
            
            // サムネイルエリア
            this.thumbnailContainer = document.createElement('div');
            this.thumbnailContainer.style.cssText = `
                display: flex;
                justify-content: center;
                gap: 10px;
                padding: 15px 0;
            `;
            
            for (let i = 0; i < this.frameCount; i++) {
                const thumb = document.createElement('canvas');
                thumb.width = 60;
                thumb.height = 60;
                thumb.style.cssText = `
                    border: 3px solid #aa5a56;
                    border-radius: 4px;
                    background: #f0e0d6;
                    cursor: pointer;
                    transition: all 0.2s;
                `;
                thumb.title = `レイヤー ${i + 1}`;
                thumb.onclick = () => this.switchLayer(i);
                this.thumbnailContainer.appendChild(thumb);
            }
            
            this.wrapper.appendChild(canvasArea);
            this.wrapper.appendChild(this.thumbnailContainer);
            this.container.appendChild(this.wrapper);
        }
        
        // ===== キャンバスとコンテキスト設定 =====
        setupCanvas() {
            this.ctx = this.canvas.getContext('2d');
            this.ctx.lineCap = 'round';
            this.ctx.lineJoin = 'round';
            this.ctx.strokeStyle = this.color;
            this.ctx.lineWidth = this.size;
        }

        // ===== レイヤーと履歴の初期化 =====
        initLayersAndHistory() {
            for (let i = 0; i < this.frameCount; i++) {
                const initialImageData = this.ctx.createImageData(this.canvas.width, this.canvas.height);
                this.layers.push(initialImageData);
                this.history.push([initialImageData]); // 初期状態を履歴の最初に追加
                this.historyIndex.push(0);
            }
        }
        
        // ===== イベント設定 =====
        attachEvents() {
            this.canvas.addEventListener('mousedown', (e) => this.startDrawing(e));
            this.canvas.addEventListener('mousemove', (e) => this.draw(e));
            this.canvas.addEventListener('mouseup', () => this.stopDrawing());
            this.canvas.addEventListener('mouseleave', () => this.stopDrawing());
            
            // タッチイベント
            this.canvas.addEventListener('touchstart', (e) => {
                e.preventDefault();
                this.canvas.dispatchEvent(new MouseEvent('mousedown', { clientX: e.touches[0].clientX, clientY: e.touches[0].clientY }));
            });
            this.canvas.addEventListener('touchmove', (e) => {
                e.preventDefault();
                this.canvas.dispatchEvent(new MouseEvent('mousemove', { clientX: e.touches[0].clientX, clientY: e.touches[0].clientY }));
            });
            this.canvas.addEventListener('touchend', (e) => {
                e.preventDefault();
                this.canvas.dispatchEvent(new MouseEvent('mouseup', {}));
            });

            // キーボードイベント (Undo/Redo)
            document.addEventListener('keydown', (e) => this.handleKeyDown(e));
        }
        
        // ===== 描画処理 =====
        startDrawing(e) {
            this.isDrawing = true;
            const rect = this.canvas.getBoundingClientRect();
            [this.lastX, this.lastY] = [e.clientX - rect.left, e.clientY - rect.top];
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
            
            [this.lastX, this.lastY] = [x, y];
        }
        
        stopDrawing() {
            if (!this.isDrawing) return;
            this.isDrawing = false;
            this.ctx.beginPath();
            this.pushHistory();
            this.updateThumbnail();
        }

        // ===== レイヤー管理 =====
        switchLayer(index) {
            if (index === this.activeLayerIndex) return;
            
            // 現在のレイヤーの描画内容を保存
            this.layers[this.activeLayerIndex] = this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);
            
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
            const thumbCtx = thumbCanvas.getContext('2d');
            thumbCtx.clearRect(0, 0, thumbCanvas.width, thumbCanvas.height);
            thumbCtx.drawImage(this.canvas, 0, 0, thumbCanvas.width, thumbCanvas.height);
        }

        // ===== Undo/Redo 機能 =====
        handleKeyDown(e) {
            // TegakiのUIが表示されている時だけUndo/Redoを有効にする
            if (!this.wrapper || !this.wrapper.isConnected) return;
            
            if (e.ctrlKey && e.key.toLowerCase() === 'z') {
                e.preventDefault();
                this.undo();
            }
            if (e.ctrlKey && e.key.toLowerCase() === 'y') {
                e.preventDefault();
                this.redo();
            }
        }

        pushHistory() {
            const history = this.history[this.activeLayerIndex];
            let index = this.historyIndex[this.activeLayerIndex];
            
            // 現在のインデックス以降の履歴（Redo用の履歴）を削除
            if (index < history.length - 1) {
                this.history[this.activeLayerIndex] = history.slice(0, index + 1);
            }
            
            const imageData = this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);
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

        // ===== エクスポート処理 =====
        // 実行前にアクティブなレイヤーの状態を保存する
        prepareExport() {
             this.layers[this.activeLayerIndex] = this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);
        }

        // APNGとしてエクスポート (要 UPNG.js)
        async exportAsApng() {
            this.prepareExport();
            if (!window.UPNG) {
                alert('APNG生成ライブラリが読み込まれていません。');
                return null;
            }
            
            const frames = this.layers.map(imageData => imageData.data.buffer);
            const delays = Array(this.frameCount).fill(this.frameDelay);
            
            const apngData = UPNG.encode(frames, this.canvas.width, this.canvas.height, 0, delays);
            return new Blob([apngData], {type: 'image/apng'});
        }

        // GIFとしてエクスポート (要 gif.js)
        async exportAsGif() {
            this.prepareExport();
            if (!window.GIF) {
                alert('GIF生成ライブラリが読み込まれていません。');
                return null;
            }

            return new Promise((resolve) => {
                const gif = new GIF({
                    workers: 2,
                    quality: 10,
                    width: this.canvas.width,
                    height: this.canvas.height
                });

                // 背景と各レイヤーを合成してフレームを作成
                for (const layerData of this.layers) {
                    const frameCanvas = document.createElement('canvas');
                    frameCanvas.width = this.canvas.width;
                    frameCanvas.height = this.canvas.height;
                    const frameCtx = frameCanvas.getContext('2d');
                    
                    frameCtx.drawImage(this.bgCanvas, 0, 0); // 背景を描画
                    frameCtx.putImageData(layerData, 0, 0);   // レイヤーを重ねる
                    
                    gif.addFrame(frameCanvas, { delay: this.frameDelay });
                }

                gif.on('finished', (blob) => resolve(blob));
                gif.render();
            });
        }
        
        // ===== 破棄処理 =====
        destroy() {
            if (this.wrapper && this.wrapper.parentNode) {
                this.wrapper.remove();
            }
            document.removeEventListener('keydown', this.handleKeyDown);
        }
    };
    
    console.log('✅ tegaki_anime.js (TegakiAnimeCore) loaded');
})();