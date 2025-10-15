// ========================================
// DrawingEngine.js - 描画エンジン
// ========================================

(function() {
    'use strict';
    
    class DrawingEngine {
        constructor(canvasManager) {
            const config = window.TegakiConstants?.CANVAS_CONFIG || {};
            const tools = window.TegakiConstants?.TOOLS || {};
            
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
         * 描画開始
         */
        startDrawing(clientX, clientY) {
            const coords = this.canvasManager.getCanvasCoordinates(clientX, clientY);
            this.lastX = coords.x;
            this.lastY = coords.y;
            this.isDrawing = true;
            
            // バケツツールの場合は即座に実行
            if (this.currentTool === this.TOOLS.BUCKET) {
                this.applyBucket(coords.x, coords.y);
                this.isDrawing = false;
                return true; // 履歴に追加
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
            if (this.currentTool === this.TOOLS.BUCKET) return; // バケツは連続描画しない
            
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
            
            if (this.currentTool === this.TOOLS.ERASER) {
                // 消しゴム
                this.ctx.globalCompositeOperation = 'destination-out';
                this.ctx.arc(x, y, this.size / 2, 0, Math.PI * 2);
                this.ctx.fill();
                this.ctx.globalCompositeOperation = 'source-over';
            } else {
                // ペン
                this.ctx.strokeStyle = this.color;
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
            
            if (this.currentTool === this.TOOLS.ERASER) {
                // 消しゴム
                this.ctx.globalCompositeOperation = 'destination-out';
                this.ctx.lineWidth = this.size;
                this.ctx.moveTo(x1, y1);
                this.ctx.lineTo(x2, y2);
                this.ctx.stroke();
                this.ctx.globalCompositeOperation = 'source-over';
            } else {
                // ペン
                this.ctx.strokeStyle = this.color;
                this.ctx.lineWidth = this.size;
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
            
            // 現在のImageDataを取得
            const imageData = this.canvasManager.getImageData();
            
            // フラッドフィル実行
            window.TegakiHelpers.floodFill(imageData, x, y, this.color);
            
            // 結果を反映
            this.canvasManager.putImageData(imageData);
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
        }
    }
    
    // window に公開
    if (typeof window !== 'undefined') {
        window.DrawingEngine = DrawingEngine;
        console.log('✅ DrawingEngine loaded');
    }
})();