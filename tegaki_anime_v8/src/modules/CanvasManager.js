// ========================================
// CanvasManager.js - キャンバス管理（改修版）
// 座標系統一・World座標対応
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
            
            // 座標変換パラメータ（将来の拡張用）
            this.transform = {
                offsetX: 0,
                offsetY: 0,
                scale: 1.0,
                rotation: 0
            };
            
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
         * クライアント座標をキャンバス座標に変換（統一メソッド）
         * 将来的な変換・回転・拡縮に対応
         */
        getCanvasCoordinates(clientX, clientY) {
            if (!this.canvas) return { x: 0, y: 0 };
            
            const rect = this.canvas.getBoundingClientRect();
            
            // スクリーン座標からキャンバスローカル座標へ
            let x = clientX - rect.left;
            let y = clientY - rect.top;
            
            // 将来的な変換パラメータを適用
            // 現在はスケール1.0、オフセット0、回転0なので実質何もしない
            x = (x - this.transform.offsetX) / this.transform.scale;
            y = (y - this.transform.offsetY) / this.transform.scale;
            
            // TODO: 回転が実装された場合はここで逆回転を適用
            // if (this.transform.rotation !== 0) { ... }
            
            return {
                x: Math.floor(x),
                y: Math.floor(y)
            };
        }
        
        /**
         * キャンバス座標からWorld座標への変換（将来の拡張用）
         */
        canvasToWorld(canvasX, canvasY) {
            // 現在は変換なし
            return { x: canvasX, y: canvasY };
        }
        
        /**
         * World座標からキャンバス座標への変換（将来の拡張用）
         */
        worldToCanvas(worldX, worldY) {
            // 現在は変換なし
            return { x: worldX, y: worldY };
        }
        
        /**
         * 変換パラメータを設定（将来の拡張用）
         */
        setTransform(offsetX, offsetY, scale, rotation) {
            this.transform.offsetX = offsetX || 0;
            this.transform.offsetY = offsetY || 0;
            this.transform.scale = scale || 1.0;
            this.transform.rotation = rotation || 0;
        }
        
        /**
         * 変換パラメータをリセット
         */
        resetTransform() {
            this.transform.offsetX = 0;
            this.transform.offsetY = 0;
            this.transform.scale = 1.0;
            this.transform.rotation = 0;
        }
        
        /**
         * 空の ImageData を作成
         */
        createEmptyImageData() {
            return this.ctx.createImageData(this.width, this.height);
        }
        
        /**
         * ImageData のクローンを作成（ディープコピー）
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
        console.log('✅ CanvasManager (改修版) loaded');
    }
})();