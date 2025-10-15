// ========================================
// CanvasManager.js - キャンバス管理
// ========================================

(function() {
    'use strict';
    
    const CanvasManager = class CanvasManager {
        constructor(width, height, backgroundColor) {
            const config = window.TegakiConstants?.CANVAS_CONFIG || {};
            
            this.width = width || config.WIDTH || 400;
            this.height = height || config.HEIGHT || 400;
            this.backgroundColor = backgroundColor || config.BACKGROUND_COLOR || '#f0e0d6';
            
            this.canvas = null;
            this.ctx = null;
            this.bgCanvas = null;
            this.bgCtx = null;
            
            // 自動的にキャンバスを作成
            this.createCanvas();
            this.createBackgroundCanvas();
        }
        
        /**
         * メインキャンバスを作成
         */
        createCanvas() {
            // 描画キャンバス（透明）
            this.canvas = document.createElement('canvas');
            this.canvas.width = this.width;
            this.canvas.height = this.height;
            this.canvas.style.cssText = `
                position: absolute; 
                top: 0; 
                left: 0; 
                cursor: crosshair;
            `;
            
            this.ctx = this.canvas.getContext('2d', {
                willReadFrequently: true
            });
            
            this.setupContext(this.ctx);
            
            return this.canvas;
        }
        
        /**
         * 背景キャンバスを作成
         */
        createBackgroundCanvas() {
            this.bgCanvas = document.createElement('canvas');
            this.bgCanvas.width = this.width;
            this.bgCanvas.height = this.height;
            this.bgCanvas.style.cssText = `
                position: absolute; 
                top: 0; 
                left: 0;
            `;
            
            this.bgCtx = this.bgCanvas.getContext('2d', {
                willReadFrequently: true
            });
            
            // 背景色で塗りつぶし
            this.bgCtx.fillStyle = this.backgroundColor;
            this.bgCtx.fillRect(0, 0, this.width, this.height);
            
            return this.bgCanvas;
        }
        
        /**
         * コンテキストの初期設定
         */
        setupContext(ctx) {
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
        }
        
        /**
         * 描画コンテキストを取得
         */
        getDrawingContext() {
            return this.ctx;
        }
        
        /**
         * 背景コンテキストを取得
         */
        getBackgroundContext() {
            return this.bgCtx;
        }
        
        /**
         * キャンバスをクリア
         */
        clearCanvas() {
            if (this.ctx) {
                this.ctx.clearRect(0, 0, this.width, this.height);
            }
        }
        
        /**
         * クライアント座標をキャンバス座標に変換
         */
        getCanvasCoordinates(clientX, clientY) {
            if (!this.canvas) return { x: 0, y: 0 };
            
            const rect = this.canvas.getBoundingClientRect();
            return {
                x: Math.floor(clientX - rect.left),
                y: Math.floor(clientY - rect.top)
            };
        }
        
        /**
         * 空の ImageData を作成
         */
        createEmptyImageData() {
            return this.ctx.createImageData(this.width, this.height);
        }
        
        /**
         * ImageData のクローンを作成
         */
        cloneImageData(imageData) {
            const cloned = this.ctx.createImageData(imageData.width, imageData.height);
            cloned.data.set(imageData.data);
            return cloned;
        }
        
        /**
         * 現在のキャンバス内容を ImageData として取得
         */
        getImageData() {
            return this.ctx.getImageData(0, 0, this.width, this.height);
        }
        
        /**
         * ImageData をキャンバスに描画
         */
        putImageData(imageData) {
            this.ctx.putImageData(imageData, 0, 0);
        }
        
        /**
         * サムネイルキャンバスを作成
         */
        createThumbnailCanvas(size) {
            const thumbCanvas = document.createElement('canvas');
            thumbCanvas.width = size;
            thumbCanvas.height = size;
            return thumbCanvas;
        }
        
        /**
         * キャンバスをサムネイルに描画
         */
        drawToThumbnail(thumbnailCanvas, sourceCanvas) {
            const thumbCtx = thumbnailCanvas.getContext('2d', {
                willReadFrequently: true
            });
            thumbCtx.clearRect(0, 0, thumbnailCanvas.width, thumbnailCanvas.height);
            thumbCtx.drawImage(
                sourceCanvas,
                0, 0,
                thumbnailCanvas.width,
                thumbnailCanvas.height
            );
        }
        
        /**
         * 複数のキャンバスを合成してサムネイルに描画
         */
        drawCompositeToThumbnail(thumbnailCanvas, ...sourceCanvases) {
            const thumbCtx = thumbnailCanvas.getContext('2d', {
                willReadFrequently: true
            });
            thumbCtx.clearRect(0, 0, thumbnailCanvas.width, thumbnailCanvas.height);
            
            // 背景から順に合成
            sourceCanvases.forEach(canvas => {
                if (canvas) {
                    thumbCtx.drawImage(
                        canvas,
                        0, 0,
                        thumbnailCanvas.width,
                        thumbnailCanvas.height
                    );
                }
            });
        }
        
        /**
         * クリーンアップ
         */
        destroy() {
            this.canvas = null;
            this.ctx = null;
            this.bgCanvas = null;
            this.bgCtx = null;
        }
    };
    
    // window に公開
    if (typeof window !== 'undefined') {
        window.CanvasManager = CanvasManager;
        console.log('✅ CanvasManager loaded');
    }
})();