// ========================================
// DrawingEngine.js - 描画エンジン（スポイト対応版）
// ========================================

(function() {
    'use strict';
    
    class DrawingEngine {
        constructor(canvasManager) {
            const config = window.TegakiConstants && window.TegakiConstants.CANVAS_CONFIG ? window.TegakiConstants.CANVAS_CONFIG : {};
            const tools = window.TegakiConstants && window.TegakiConstants.TOOLS ? window.TegakiConstants.TOOLS : {};
            
            this.canvasManager = canvasManager;
            this.ctx = canvasManager.getDrawingContext();
            
            // 描画状態
            this.isDrawing = false;
            this.lastX = 0;
            this.lastY = 0;
            
            // ツール設定
            this.currentTool = tools.PEN || 'pen';
            this.color = config.DEFAULT_PEN_COLOR || '#800000';
            this.size = config.DEFAULT_PEN_SIZE || 2;
            this.minSize = config.MIN_PEN_SIZE || 1;
            this.maxSize = config.MAX_PEN_SIZE || 20;
            
            // スポイト用コールバック
            this.onColorPicked = null;
            
            // ツールタイプ
            this.TOOLS = tools;
        }
        
        /**
         * ツールを設定
         */
        setTool(tool) {
            this.currentTool = tool;
        }
        
        /**
         * 色を設定
         */
        setColor(color) {
            this.color = color;
        }
        
        /**
         * サイズを設定
         */
        setSize(size) {
            this.size = Math.max(this.minSize, Math.min(this.maxSize, size));
        }
        
        /**
         * スポイトコールバックを設定
         */
        setColorPickedCallback(callback) {
            this.onColorPicked = callback;
        }
        
        /**
         * 描画開始
         */
        startDrawing(clientX, clientY) {
            const coords = this.canvasManager.getCanvasCoordinates(clientX, clientY);
            this.lastX = coords.x;
            this.lastY = coords.y;
            this.isDrawing = true;
            
            // バケツツールの場合は即座に実行
            if (this.currentTool === this.TOOLS.BUCKET || this.currentTool === 'bucket') {
                this.applyBucket(coords.x, coords.y);
                this.isDrawing = false;
                return true; // 履歴に追加
            }
            
            // スポイトツールの場合
            if (this.currentTool === this.TOOLS.EYEDROPPER || this.currentTool === 'eyedropper') {
                this.pickColor(coords.x, coords.y);
                this.isDrawing = false;
                return false; // 履歴に追加しない
            }
            
            // ペン・消しゴムは点を描画
            this.drawPoint(coords.x, coords.y);
            return false; // まだ履歴に追加しない
        }
        
        /**
         * 描画中
         */
        draw(clientX, clientY) {
            if (!this.isDrawing) return;
            if (this.currentTool === this.TOOLS.BUCKET || this.currentTool === 'bucket') return;
            if (this.currentTool === this.TOOLS.EYEDROPPER || this.currentTool === 'eyedropper') return;
            
            const coords = this.canvasManager.getCanvasCoordinates(clientX, clientY);
            this.drawLine(this.lastX, this.lastY, coords.x, coords.y);
            
            this.lastX = coords.x;
            this.lastY = coords.y;
        }
        
        /**
         * 描画終了
         */
        stopDrawing() {
            if (!this.isDrawing) return false;
            
            this.isDrawing = false;
            this.ctx.beginPath();
            
            return true; // 履歴に追加
        }
        
        /**
         * 点を描画
         */
        drawPoint(x, y) {
            this.ctx.beginPath();
            
            if (this.currentTool === this.TOOLS.ERASER || this.currentTool === 'eraser') {
                // 消しゴム
                this.ctx.globalCompositeOperation = 'destination-out';
                this.ctx.arc(x, y, this.size / 2, 0, Math.PI * 2);
                this.ctx.fill();
                this.ctx.globalCompositeOperation = 'source-over';
            } else {
                // ペン
                this.ctx.strokeStyle = this.color;
                this.ctx.fillStyle = this.color;
                this.ctx.lineWidth = this.size;
                this.ctx.arc(x, y, this.size / 2, 0, Math.PI * 2);
                this.ctx.fill();
            }
        }
        
        /**
         * 線を描画
         */
        drawLine(x1, y1, x2, y2) {
            this.ctx.beginPath();
            
            if (this.currentTool === this.TOOLS.ERASER || this.currentTool === 'eraser') {
                // 消しゴム
                this.ctx.globalCompositeOperation = 'destination-out';
                this.ctx.lineWidth = this.size;
                this.ctx.lineCap = 'round';
                this.ctx.moveTo(x1, y1);
                this.ctx.lineTo(x2, y2);
                this.ctx.stroke();
                this.ctx.globalCompositeOperation = 'source-over';
            } else {
                // ペン
                this.ctx.strokeStyle = this.color;
                this.ctx.lineWidth = this.size;
                this.ctx.lineCap = 'round';
                this.ctx.moveTo(x1, y1);
                this.ctx.lineTo(x2, y2);
                this.ctx.stroke();
            }
        }
        
        /**
         * バケツツールを適用
         */
        applyBucket(x, y) {
            if (!window.TegakiHelpers) {
                console.error('TegakiHelpers not loaded');
                return;
            }
            
            // 整数座標に丸める
            x = Math.floor(x);
            y = Math.floor(y);
            
            // 現在のImageDataを取得
            const imageData = this.canvasManager.getImageData();
            
            // フラッドフィル実行
            window.TegakiHelpers.floodFill(imageData, x, y, this.color);
            
            // 結果を反映
            this.canvasManager.putImageData(imageData);
        }
        
        /**
         * スポイトツールで色を取得
         */
        pickColor(x, y) {
            // 整数座標に丸める
            x = Math.floor(x);
            y = Math.floor(y);
            
            const imageData = this.canvasManager.getImageData();
            const width = imageData.width;
            const height = imageData.height;
            
            // 範囲外チェック
            if (x < 0 || x >= width || y < 0 || y >= height) {
                console.warn('Eyedropper out of bounds');
                return;
            }
            
            const index = (y * width + x) * 4;
            const r = imageData.data[index];
            const g = imageData.data[index + 1];
            const b = imageData.data[index + 2];
            const a = imageData.data[index + 3];
            
            // 透明ピクセルの場合は何もしない
            if (a === 0) {
                console.log('Picked transparent pixel');
                return;
            }
            
            // RGBを16進数に変換
            const hex = '#' + 
                r.toString(16).padStart(2, '0') + 
                g.toString(16).padStart(2, '0') + 
                b.toString(16).padStart(2, '0');
            
            console.log(`Color picked: ${hex} at (${x}, ${y})`);
            
            // 色を設定
            this.color = hex;
            
            // コールバックを実行（UIに反映）
            if (this.onColorPicked) {
                this.onColorPicked(hex);
            }
            
            // 自動的にペンツールに戻る
            this.currentTool = this.TOOLS.PEN || 'pen';
        }
        
        /**
         * キャンバスをクリア
         */
        clear() {
            this.canvasManager.clearCanvas();
        }
        
        /**
         * クリーンアップ
         */
        destroy() {
            this.canvasManager = null;
            this.ctx = null;
            this.onColorPicked = null;
        }
    }
    
    // window に公開
    if (typeof window !== 'undefined') {
        window.DrawingEngine = DrawingEngine;
        console.log('✅ DrawingEngine (スポイト対応版) loaded');
    }
})();