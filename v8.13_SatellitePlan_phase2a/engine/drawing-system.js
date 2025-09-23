// ===== engine/drawing-system.js - Twin-Star Architecture =====
// 責任: 描画エンジン（ブラシ・ペン・レンダリング）

(function() {
    'use strict';
    
    const CONFIG = window.TegakiConfig;
    
    class DrawingSystem {
        constructor(app, coordinateSystem) {
            this.app = app;
            this.coord = coordinateSystem;
            
            // 描画状態
            this.isDrawing = false;
            this.currentStroke = null;
            this.currentGraphics = null;
            
            // ブラシ設定
            this.brushSettings = {
                size: CONFIG.brush.defaultSize,
                color: CONFIG.brush.defaultColor,
                opacity: CONFIG.brush.defaultOpacity,
                smoothing: CONFIG.brush.smoothing,
                pressureSensitive: CONFIG.brush.pressureSensitivity
            };
            
            // ツール設定
            this.currentTool = 'pen';
            
            // レンダーキャッシュ
            this.renderCache = new Map();
            this.maxCacheSize = CONFIG.performance.maxCacheSize;
        }
        
        // ブラシ設定
        setBrush(settings) {
            Object.assign(this.brushSettings, settings);
        }
        
        setTool(tool) {
            this.currentTool = tool;
            console.log('DrawingSystem: Tool changed to', tool);
        }
        
        setBrushSize(size) {
            this.brushSettings.size = window.TegakiUtils.clamp(size, 0.1, 100);
        }
        
        setBrushOpacity(opacity) {
            this.brushSettings.opacity = window.TegakiUtils.clamp(opacity, 0, 1);
        }
        
        // ストローク開始
        startStroke(screenX, screenY) {
            if (this.isDrawing) return false;
            
            this.isDrawing = true;
            
            // coord: screen -> world
            const worldPoint = this.coord.screenToWorld(screenX, screenY);
            
            // 新規ストローク作成
            this.currentStroke = {
                id: `stroke_${Date.now()}`,
                points: [{ x: worldPoint.x, y: worldPoint.y, pressure: 1.0 }],
                brush: { ...this.brushSettings },
                tool: this.currentTool
            };
            
            // Graphics作成
            this.currentGraphics = new PIXI.Graphics();
            
            // 描画開始
            this.drawStroke();
            
            return true;
        }
        
        // ストローク継続
        continueStroke(screenX, screenY, pressure = 1.0) {
            if (!this.isDrawing || !this.currentStroke) return false;
            
            // coord: screen -> world
            const worldPoint = this.coord.screenToWorld(screenX, screenY);
            
            // 距離チェック（最適化）
            const lastPoint = this.currentStroke.points[this.currentStroke.points.length - 1];
            const distance = Math.sqrt(
                Math.pow(worldPoint.x - lastPoint.x, 2) + 
                Math.pow(worldPoint.y - lastPoint.y, 2)
            );
            
            if (distance < 1) return false;
            
            // ポイント追加
            this.currentStroke.points.push({
                x: worldPoint.x,
                y: worldPoint.y,
                pressure: pressure
            });
            
            // スムージング適用
            if (this.brushSettings.smoothing) {
                this.smoothLastPoints();
            }
            
            // 再描画
            this.drawStroke();
            
            return true;
        }
        
        // ストローク終了
        endStroke() {
            if (!this.isDrawing) return null;
            
            this.isDrawing = false;
            
            const completedStroke = this.currentStroke;
            if (completedStroke) {
                completedStroke.isComplete = true;
            }
            
            // リセット
            this.currentStroke = null;
            this.currentGraphics = null;
            
            return completedStroke;
        }
        
        // ストローク描画
        drawStroke() {
            if (!this.currentGraphics || !this.currentStroke) return;
            
            const g = this.currentGraphics;
            const stroke = this.currentStroke;
            const points = stroke.points;
            
            g.clear();
            
            if (points.length < 1) return;
            
            const color = stroke.tool === 'eraser' ? CONFIG.background.color : stroke.brush.color;
            const opacity = stroke.tool === 'eraser' ? 1.0 : stroke.brush.opacity;
            
            // 点描画（各点を円で描画）
            points.forEach(point => {
                let size = stroke.brush.size;
                
                if (stroke.brush.pressureSensitive && point.pressure) {
                    size *= point.pressure;
                }
                
                g.circle(point.x, point.y, size / 2);
                g.fill({ color: color, alpha: opacity });
            });
        }
        
        // スムージング
        smoothLastPoints() {
            const points = this.currentStroke.points;
            if (points.length < 3) return;
            
            const smoothingFactor = 0.3;
            const i = points.length - 2;
            
            points[i].x += (points[i-1].x + points[i+1].x - 2 * points[i].x) * smoothingFactor;
            points[i].y += (points[i-1].y + points[i+1].y - 2 * points[i].y) * smoothingFactor;
        }
        
        // ストロークからGraphics再生成
        createGraphicsFromStroke(stroke) {
            const graphics = new PIXI.Graphics();
            
            if (!stroke.points || stroke.points.length === 0) {
                return graphics;
            }
            
            const color = stroke.tool === 'eraser' ? CONFIG.background.color : stroke.brush.color;
            const opacity = stroke.tool === 'eraser' ? 1.0 : stroke.brush.opacity;
            
            stroke.points.forEach(point => {
                let size = stroke.brush.size;
                
                if (stroke.brush.pressureSensitive && point.pressure) {
                    size *= point.pressure;
                }
                
                graphics.circle(point.x, point.y, size / 2);
                graphics.fill({ color: color, alpha: opacity });
            });
            
            return graphics;
        }
        
        // レイヤー再描画
        redrawLayer(layer) {
            // コンテナクリア（背景は保護）
            const childrenToRemove = [];
            for (let child of layer.children) {
                if (child !== layer.layerData?.backgroundGraphics) {
                    childrenToRemove.push(child);
                }
            }
            
            childrenToRemove.forEach(child => {
                layer.removeChild(child);
                if (child.destroy) {
                    child.destroy({ children: true, texture: false, baseTexture: false });
                }
            });
            
            // 全ストローク再描画
            if (layer.layerData?.strokes) {
                layer.layerData.strokes.forEach(stroke => {
                    const graphics = this.createGraphicsFromStroke(stroke);
                    stroke.graphics = graphics;
                    layer.addChild(graphics);
                });
            }
            
            // キャッシュ更新
            this.updateCache(layer.layerData?.id || 'unknown');
        }
        
        // パス変形処理（レイヤー変形時に使用）
        transformStroke(stroke, matrix) {
            if (!stroke.points || !matrix) return stroke;
            
            const transformedStroke = {
                ...stroke,
                points: stroke.points.map(point => {
                    const transformed = this.coord.applyMatrix(point, matrix);
                    return {
                        ...point,
                        x: transformed.x,
                        y: transformed.y
                    };
                }),
                graphics: null // 後で再生成
            };
            
            return transformedStroke;
        }
        
        // キャッシュ管理
        updateCache(layerId) {
            if (!CONFIG.performance.cacheEnabled) return;
            
            // 古いキャッシュ破棄
            if (this.renderCache.has(layerId)) {
                const oldCache = this.renderCache.get(layerId);
                if (oldCache.destroy) {
                    oldCache.destroy(true);
                }
            }
            
            // メモリ使用量チェック
            let totalCacheSize = 0;
            this.renderCache.forEach(cache => {
                if (cache.width && cache.height) {
                    totalCacheSize += cache.width * cache.height * 4; // RGBA
                }
            });
            
            if (totalCacheSize > this.maxCacheSize) {
                // 古いキャッシュから削除
                const entries = Array.from(this.renderCache.entries());
                const toDelete = Math.floor(entries.length * 0.3);
                
                for (let i = 0; i < toDelete; i++) {
                    const [key, cache] = entries[i];
                    if (cache.destroy) {
                        cache.destroy(true);
                    }
                    this.renderCache.delete(key);
                }
            }
        }
        
        // 描画統計情報
        getDrawingStats() {
            return {
                cacheSize: this.renderCache.size,
                isDrawing: this.isDrawing,
                currentTool: this.currentTool,
                brushSize: this.brushSettings.size,
                brushOpacity: this.brushSettings.opacity,
                currentStrokeLength: this.currentStroke ? this.currentStroke.points.length : 0
            };
        }
        
        // クリーンアップ
        cleanup() {
            // キャッシュクリア
            this.renderCache.forEach(cache => {
                if (cache.destroy) {
                    cache.destroy(true);
                }
            });
            this.renderCache.clear();
            
            // 現在の描画状態リセット
            this.isDrawing = false;
            this.currentStroke = null;
            
            if (this.currentGraphics) {
                if (this.currentGraphics.destroy) {
                    this.currentGraphics.destroy();
                }
                this.currentGraphics = null;
            }
        }
    }
    
    // === グローバル公開 ===
    window.DrawingSystem = DrawingSystem;
    
    console.log('✅ DrawingSystem loaded (Twin-Star Architecture)');
    
})();