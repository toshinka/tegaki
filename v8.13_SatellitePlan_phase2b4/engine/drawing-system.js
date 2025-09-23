// ===== engine/drawing-system.js - 緊急修正版（描画機能復旧） =====
// 責任: 描画処理・ストローク管理・ツール管理

(function() {
    'use strict';
    
    const CONFIG = window.TEGAKI_CONFIG;
    if (!CONFIG) {
        throw new Error('drawing-system.js requires config.js');
    }
    
    class DrawingSystem {
        constructor(app, coordinateSystem) {
            this.app = app;
            this.coord = coordinateSystem;
            
            // 描画状態
            this.isDrawing = false;
            this.currentStroke = null;
            this.lastPoint = null;
            
            // ツール設定
            this.currentTool = 'pen';
            this.brushSize = CONFIG.pen.size;
            this.brushColor = CONFIG.pen.color;
            this.brushOpacity = CONFIG.pen.opacity;
            
            // 外部参照
            this.layerSystem = null;
            this.cameraSystem = null;
            
            console.log('DrawingSystem initialized');
        }
        
        // 外部システム設定
        setLayerSystem(layerSystem) {
            this.layerSystem = layerSystem;
            console.log('DrawingSystem: LayerSystem reference set');
        }
        
        setCameraSystem(cameraSystem) {
            this.cameraSystem = cameraSystem;
            console.log('DrawingSystem: CameraSystem reference set');
        }
        
        // === 【緊急修正】描画制御 - 座標変換とレイヤー統合を改善 ===
        startDrawing(screenX, screenY) {
            console.log('DrawingSystem: startDrawing called', screenX, screenY);
            
            if (this.isDrawing) {
                console.log('Already drawing, ignoring');
                return;
            }
            
            // カメラ操作中は描画しない
            if (this.cameraSystem?.spacePressed || this.cameraSystem?.isDragging) {
                console.log('Camera operation active, skipping drawing');
                return;
            }
            
            // レイヤー移動モード中は描画しない
            if (this.layerSystem?.vKeyPressed) {
                console.log('Layer move mode active, skipping drawing');
                return;
            }
            
            // 座標変換（緊急修正: シンプルな変換を使用）
            let canvasPoint;
            if (this.cameraSystem && this.cameraSystem.screenToCanvasForDrawing) {
                canvasPoint = this.cameraSystem.screenToCanvasForDrawing(screenX, screenY);
            } else if (this.cameraSystem && this.cameraSystem.screenToCanvas) {
                canvasPoint = this.cameraSystem.screenToCanvas(screenX, screenY);
            } else {
                // フォールバック: 直接座標を使用
                canvasPoint = { x: screenX, y: screenY };
            }
            
            console.log('Canvas point:', canvasPoint);
            
            if (!this.isPointInValidArea(canvasPoint)) {
                console.log('Point outside valid area');
                return;
            }
            
            // アクティブレイヤー取得
            const activeLayer = this.layerSystem?.getActiveLayer();
            if (!activeLayer) {
                console.warn('No active layer for drawing');
                return;
            }
            
            console.log('Active layer:', activeLayer.id);
            
            this.isDrawing = true;
            this.lastPoint = canvasPoint;
            
            // ツールに応じた色・透明度設定
            const color = this.currentTool === 'eraser' ? CONFIG.background.color : this.brushColor;
            const opacity = this.currentTool === 'eraser' ? 1.0 : this.brushOpacity;
            
            // 新規ストローク作成
            this.currentStroke = {
                id: `stroke_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                tool: this.currentTool,
                points: [{ x: canvasPoint.x, y: canvasPoint.y }],
                color: color,
                size: this.brushSize,
                opacity: opacity,
                isComplete: false,
                graphics: new PIXI.Graphics()
            };
            
            console.log('Created stroke:', this.currentStroke.id);
            
            // 初期描画
            this.drawStrokePoint(this.currentStroke, canvasPoint);
            
            // レイヤーに追加
            this.addStrokeToActiveLayer(this.currentStroke);
        }
        
        continueDrawing(screenX, screenY) {
            if (!this.isDrawing || !this.currentStroke) return;
            
            // カメラ操作中は描画継続しない
            if (this.cameraSystem?.spacePressed || this.cameraSystem?.isDragging) return;
            if (this.layerSystem?.vKeyPressed) return;
            
            // 座標変換
            let canvasPoint;
            if (this.cameraSystem && this.cameraSystem.screenToCanvasForDrawing) {
                canvasPoint = this.cameraSystem.screenToCanvasForDrawing(screenX, screenY);
            } else if (this.cameraSystem && this.cameraSystem.screenToCanvas) {
                canvasPoint = this.cameraSystem.screenToCanvas(screenX, screenY);
            } else {
                canvasPoint = { x: screenX, y: screenY };
            }
            
            const lastPoint = this.lastPoint;
            
            // 距離チェック（スムージング）
            const distance = Math.sqrt(
                Math.pow(canvasPoint.x - lastPoint.x, 2) + 
                Math.pow(canvasPoint.y - lastPoint.y, 2)
            );
            
            if (distance < 1) return;
            
            // 補間描画（滑らかな線）
            const steps = Math.max(1, Math.floor(distance / 1));
            for (let i = 1; i <= steps; i++) {
                const t = i / steps;
                const x = lastPoint.x + (canvasPoint.x - lastPoint.x) * t;
                const y = lastPoint.y + (canvasPoint.y - lastPoint.y) * t;
                
                this.drawStrokePoint(this.currentStroke, { x, y });
                this.currentStroke.points.push({ x, y });
            }
            
            this.lastPoint = canvasPoint;
        }
        
        endDrawing() {
            if (!this.isDrawing) return;
            
            console.log('DrawingSystem: ending drawing');
            
            if (this.currentStroke) {
                this.currentStroke.isComplete = true;
                
                // レイヤーシステムに完了通知
                if (this.layerSystem && this.layerSystem.recordHistory) {
                    this.layerSystem.recordHistory('stroke', {
                        layerId: this.layerSystem.activeLayerId,
                        stroke: this.currentStroke
                    });
                }
                
                // サムネイル更新要求
                if (this.layerSystem) {
                    const activeLayer = this.layerSystem.getActiveLayer();
                    if (activeLayer) {
                        const layerIndex = this.layerSystem.getLayerIndex ? 
                            this.layerSystem.getLayerIndex(activeLayer.id) : 0;
                        if (this.layerSystem.requestThumbnailUpdate) {
                            this.layerSystem.requestThumbnailUpdate(layerIndex);
                        }
                    }
                }
                
                console.log('Stroke completed:', this.currentStroke.points.length, 'points');
            }
            
            this.isDrawing = false;
            this.currentStroke = null;
            this.lastPoint = null;
        }
        
        // 互換性メソッド
        startStroke(screenX, screenY) { return this.startDrawing(screenX, screenY); }
        continueStroke(screenX, screenY) { return this.continueDrawing(screenX, screenY); }
        endStroke() { return this.endDrawing(); }
        stopDrawing() { return this.endDrawing(); }
        
        // === 【緊急修正】描画処理 - ストローク描画の改善 ===
        drawStrokePoint(stroke, point) {
            if (!stroke.graphics) return;
            
            try {
                stroke.graphics.circle(point.x, point.y, stroke.size / 2);
                stroke.graphics.fill({ 
                    color: stroke.color, 
                    alpha: stroke.opacity 
                });
            } catch (error) {
                console.error('Error drawing stroke point:', error);
            }
        }
        
        // === 【緊急修正】レイヤー統合処理 - LayerSystemとの連携改善 ===
        addStrokeToActiveLayer(stroke) {
            if (!this.layerSystem) {
                console.error('LayerSystem not available');
                return;
            }
            
            const activeLayer = this.layerSystem.getActiveLayer();
            if (!activeLayer) {
                console.error('No active layer');
                return;
            }
            
            console.log('Adding stroke to layer:', activeLayer.id);
            
            try {
                // LayerSystemのaddStrokeToLayerメソッドを使用
                if (this.layerSystem.addStrokeToLayer) {
                    this.layerSystem.addStrokeToLayer(activeLayer.id, stroke);
                } else {
                    // フォールバック：直接追加
                    console.log('Using fallback stroke addition');
                    
                    // ストロークリストに追加
                    if (!activeLayer.strokes) {
                        activeLayer.strokes = [];
                    }
                    activeLayer.strokes.push(stroke);
                    
                    // グラフィックスをレイヤーコンテナに追加
                    if (activeLayer.container && stroke.graphics) {
                        activeLayer.container.addChild(stroke.graphics);
                        console.log('Graphics added to layer container');
                    } else {
                        console.warn('Layer container or graphics not available');
                    }
                }
                
                console.log('Stroke added successfully');
                
            } catch (error) {
                console.error('Error adding stroke to layer:', error);
            }
        }
        
        // === ツール管理 ===
        setTool(tool) {
            console.log('DrawingSystem: setting tool to', tool);
            this.currentTool = tool;
        }
        
        setBrushSize(size) {
            this.brushSize = Math.max(0.1, Math.min(100, size));
            console.log('Brush size set to:', this.brushSize);
        }
        
        setBrushOpacity(opacity) {
            this.brushOpacity = Math.max(0, Math.min(1, opacity));
            console.log('Brush opacity set to:', this.brushOpacity);
        }
        
        setBrushColor(color) {
            this.brushColor = color;
            console.log('Brush color set to:', this.brushColor);
        }
        
        // === 座標検証 ===
        isPointInValidArea(canvasPoint, margin = 50) {
            const width = CONFIG.canvas.width || CONFIG.canvas.defaultWidth || 400;
            const height = CONFIG.canvas.height || CONFIG.canvas.defaultHeight || 400;
            
            return canvasPoint.x >= -margin && 
                   canvasPoint.x <= width + margin &&
                   canvasPoint.y >= -margin && 
                   canvasPoint.y <= height + margin;
        }
        
        // === デバッグ・診断 ===
        getDebugInfo() {
            return {
                isDrawing: this.isDrawing,
                currentTool: this.currentTool,
                brushSize: this.brushSize,
                brushColor: this.brushColor,
                brushOpacity: this.brushOpacity,
                currentStroke: this.currentStroke ? {
                    id: this.currentStroke.id,
                    pointCount: this.currentStroke.points?.length || 0,
                    isComplete: this.currentStroke.isComplete
                } : null,
                hasLayerSystem: !!this.layerSystem,
                hasCameraSystem: !!this.cameraSystem,
                activeLayer: this.layerSystem?.getActiveLayer()?.id || 'none'
            };
        }
    }
    
    // === グローバル公開 ===
    window.DrawingSystem = DrawingSystem;
    
    console.log('✅ drawing-system.js Emergency Fix loaded');
    
})();