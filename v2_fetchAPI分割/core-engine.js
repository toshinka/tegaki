/**
 * 🎨 ふたば☆ちゃんねる風ベクターお絵描きツール v0.7
 * 描画エンジン基盤 - core-engine.js
 */

class DrawingEngine {
    constructor(width, height) {
        this.width = width;
        this.height = height;
        this.app = null;
        this.drawingContainer = null;
        this.paths = [];
        this.backgroundColor = 0xf0e0d6;
    }
    
    async init() {
        try {
            console.log('🎯 DrawingEngine初期化開始...');
            
            // PIXI.js v7の正しい初期化方法
            this.app = new PIXI.Application({
                width: this.width,
                height: this.height,
                backgroundColor: this.backgroundColor,
                antialias: true,
                resolution: 1,
                autoDensity: false
            });
            
            // キャンバス要素をDOMに追加
            const canvasContainer = document.getElementById('drawing-canvas');
            if (!canvasContainer) {
                throw new Error('drawing-canvas要素が見つかりません');
            }
            
            canvasContainer.appendChild(this.app.view);
            
            // 描画用コンテナ
            this.drawingContainer = new PIXI.Container();
            this.app.stage.addChild(this.drawingContainer);
            
            this.setupInteraction();
            
            console.log('✅ DrawingEngine初期化完了');
            return this.app;
            
        } catch (error) {
            console.error('❌ DrawingEngine初期化エラー:', error);
            throw error;
        }
    }
    
    setupInteraction() {
        // PIXI.js v7のイベント設定
        this.app.stage.eventMode = 'static';
        this.app.stage.hitArea = new PIXI.Rectangle(0, 0, this.width, this.height);
    }
    
    getLocalPointerPosition(event) {
        try {
            const rect = this.app.view.getBoundingClientRect();
            const originalEvent = event.data.originalEvent;
            const x = (originalEvent.clientX - rect.left) * (this.width / rect.width);
            const y = (originalEvent.clientY - rect.top) * (this.height / rect.height);
            return { x, y };
        } catch (error) {
            console.warn('座標取得エラー:', error);
            return { x: 0, y: 0 };
        }
    }
    
    createPath(x, y, size, color, opacity, tool = 'pen') {
        const path = {
            id: `path_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            graphics: new PIXI.Graphics(),
            points: [],
            color: tool === 'eraser' ? this.backgroundColor : color,
            size: size,
            opacity: tool === 'eraser' ? 1.0 : opacity,
            tool: tool,
            isComplete: false
        };
        
        // 初回描画: 円形ブラシで点を描画
        path.graphics.beginFill(path.color, path.opacity);
        path.graphics.drawCircle(x, y, size / 2);
        path.graphics.endFill();
        
        path.points.push({ x, y, size });
        
        this.drawingContainer.addChild(path.graphics);
        this.paths.push(path);
        return path;
    }
    
    drawLine(path, x, y) {
        if (!path || path.points.length === 0) return;
        
        const lastPoint = path.points[path.points.length - 1];
        const distance = Math.sqrt((x - lastPoint.x) ** 2 + (y - lastPoint.y) ** 2);
        
        // 最小距離フィルタ
        if (distance < 1.5) return;
        
        // 連続する円形で線を描画
        const steps = Math.max(1, Math.ceil(distance / 1.5));
        for (let i = 1; i <= steps; i++) {
            const t = i / steps;
            const px = lastPoint.x + (x - lastPoint.x) * t;
            const py = lastPoint.y + (y - lastPoint.y) * t;
            
            path.graphics.beginFill(path.color, path.opacity);
            path.graphics.drawCircle(px, py, path.size / 2);
            path.graphics.endFill();
        }
        
        path.points.push({ x, y, size: path.size });
    }
    
    resize(newWidth, newHeight, centerContent = false) {
        const oldWidth = this.width;
        const oldHeight = this.height;
        
        this.width = newWidth;
        this.height = newHeight;
        
        this.app.renderer.resize(newWidth, newHeight);
        this.app.stage.hitArea = new PIXI.Rectangle(0, 0, newWidth, newHeight);
        
        if (centerContent && this.paths.length > 0) {
            const offsetX = (newWidth - oldWidth) / 2;
            const offsetY = (newHeight - oldHeight) / 2;
            
            this.paths.forEach(path => {
                path.graphics.x += offsetX;
                path.graphics.y += offsetY;
            });
        }
    }
    
    clear() {
        this.paths.forEach(path => {
            if (path.graphics && path.graphics.parent) {
                this.drawingContainer.removeChild(path.graphics);
                path.graphics.destroy();
            }
        });
        this.paths = [];
    }
    
    // デバッグ用メソッド
    getStats() {
        return {
            width: this.width,
            height: this.height,
            pathCount: this.paths.length,
            isInitialized: this.app !== null
        };
    }
}

// グローバル公開
if (typeof window !== 'undefined') {
    window.DrawingEngine = DrawingEngine;
}