// ===== engine/drawing-system.js - 修正版（元版機能継承） =====
// 描画エンジン：ペン・消しゴム・座標変換・ストローク管理

(function() {
    'use strict';
    
    const CONFIG = window.TEGAKI_CONFIG;
    if (!CONFIG) {
        console.error('CRITICAL: TEGAKI_CONFIG not found');
        throw new Error('TEGAKI_CONFIG is required for DrawingSystem');
    }
    
    class DrawingSystem {
        constructor(app, coordinateSystem) {
            this.app = app;
            this.coord = coordinateSystem;
            
            // 描画状態
            this.currentTool = 'pen';
            this.isDrawing = false;
            this.currentStroke = null;
            this.lastPoint = null;
            
            // ブラシ設定
            this.brushSize = CONFIG.pen.size;
            this.brushColor = CONFIG.pen.color;
            this.brushOpacity = CONFIG.pen.opacity;
            
            // システム参照（後で設定）
            this.layerSystem = null;
            this.cameraSystem = null;
            
            console.log('DrawingSystem initialized');
        }

        // === Phase1指示対応：座標系統一 ===
        startDrawing(screenX, screenY) {
            if (this.isDrawing || !this.cameraSystem || !this.layerSystem) return;
            
            // カメラシステムによる制約チェック
            if (this.cameraSystem.spacePressed || this.cameraSystem.isDragging ||
                this.layerSystem.vKeyPressed) {
                return;
            }

            // Phase1指示：screenToCanvasForDrawing使用（レイヤー変形を考慮しない）
            const canvasPoint = this.cameraSystem.screenToCanvasForDrawing(screenX, screenY);
            
            if (!this.cameraSystem.isPointInExtendedCanvas(canvasPoint)) {
                return;
            }
            
            this.isDrawing = true;
            this.lastPoint = canvasPoint;

            const activeLayer = this.layerSystem.getActiveLayer();
            if (!activeLayer) return;

            // ツールに応じた色・不透明度設定
            const color = this.currentTool === 'eraser' ? CONFIG.background.color : this.brushColor;
            const opacity = this.currentTool === 'eraser' ? 1.0 : this.brushOpacity;

            // 新しいストローク作成
            this.currentStroke = {
                id: `stroke_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                graphics: new PIXI.Graphics(),
                points: [{ x: canvasPoint.x, y: canvasPoint.y }],
                color: color,
                size: this.brushSize,
                opacity: opacity,
                isComplete: false,
                tool: this.currentTool
            };

            // 初期点を描画
            this.currentStroke.graphics.circle(canvasPoint.x, canvasPoint.y, this.brushSize / 2);
            this.currentStroke.graphics.fill({ color: color, alpha: opacity });

            // レイヤーに追加
            this.addStrokeToActiveLayer(this.currentStroke);
            
            console.log('Drawing started at:', canvasPoint);
        }

        continueDrawing(screenX, screenY) {
            if (!this.isDrawing || !this.currentStroke || !this.cameraSystem) return;
            
            // カメラシステムによる制約チェック
            if (this.cameraSystem.spacePressed || this.cameraSystem.isDragging ||
                this.layerSystem.vKeyPressed) {
                return;
            }

            const canvasPoint = this.cameraSystem.screenToCanvasForDrawing(screenX, screenY);
            const lastPoint = this.lastPoint;
            
            // 距離チェック（スムージング）
            const distance = Math.sqrt(
                Math.pow(canvasPoint.x - lastPoint.x, 2) + 
                Math.pow(canvasPoint.y - lastPoint.y, 2)
            );

            if (distance < 1) return;

            // 補間描画
            const steps = Math.max(1, Math.floor(distance / 1));
            for (let i = 1; i <= steps; i++) {
                const t = i / steps;
                const x = lastPoint.x + (canvasPoint.x - lastPoint.x) * t;
                const y = lastPoint.y + (canvasPoint.y - lastPoint.y) * t;

                this.currentStroke.graphics.circle(x, y, this.brushSize / 2);
                this.currentStroke.graphics.fill({ 
                    color: this.currentStroke.color, 
                    alpha: this.currentStroke.opacity 
                });

                this.currentStroke.points.push({ x, y });
            }

            this.lastPoint = canvasPoint;
        }

        endDrawing() {
            if (!this.isDrawing) return;

            console.log('Drawing ended');

            if (this.currentStroke) {
                this.currentStroke.isComplete = true;
                
                // レイヤーシステムに完了を通知
                if (this.layerSystem && this.layerSystem.requestThumbnailUpdate) {
                    const activeLayer = this.layerSystem.getActiveLayer();
                    if (activeLayer) {
                        const layerIndex = this.layerSystem.getLayerIndex(activeLayer.id);
                        this.layerSystem.requestThumbnailUpdate(layerIndex);
                    }
                }
            }

            this.isDrawing = false;
            this.currentStroke = null;
            this.lastPoint = null;
        }

        // === Phase1指示対応：レイヤー変形考慮のストローク追加 ===
        addStrokeToActiveLayer(stroke) {
            const activeLayer = this.layerSystem.getActiveLayer();
            if (!activeLayer) return;
            
            // レイヤーの現在の変形状態を取得
            const layerId = activeLayer.id;
            const transform = this.layerSystem.layerTransforms?.get(layerId);
            
            // レイヤーが変形されている場合、逆変換を適用
            if (transform && this.isTransformNonDefault(transform)) {
                this.applyInverseTransformToStroke(stroke, transform);
            }
            
            // レイヤーのstrokesに追加
            if (!activeLayer.strokes) {
                activeLayer.strokes = [];
            }
            activeLayer.strokes.push(stroke);
            
            // コンテナに追加
            if (activeLayer.container) {
                activeLayer.container.addChild(stroke.graphics);
            }
            
            // 互換性：pathsにも追加
            if (!activeLayer.paths) {
                activeLayer.paths = [];
            }
            activeLayer.paths.push({
                id: stroke.id,
                points: [...stroke.points],
                color: stroke.color,
                size: stroke.size,
                opacity: stroke.opacity,
                isComplete: stroke.isComplete,
                graphics: stroke.graphics
            });
        }

        // Phase1指示対応：変形逆変換の実装
        applyInverseTransformToStroke(stroke, transform) {
            try {
                const centerX = CONFIG.canvas.width / 2;
                const centerY = CONFIG.canvas.height / 2;
                
                // 逆変形行列を作成
                const matrix = new PIXI.Matrix();
                matrix.translate(-centerX - transform.x, -centerY - transform.y);
                matrix.rotate(-transform.rotation);
                matrix.scale(1/transform.scaleX, 1/transform.scaleY);
                matrix.translate(centerX, centerY);
                
                // 新しいGraphicsを作成して逆変換を適用
                const transformedGraphics = new PIXI.Graphics();
                stroke.points.forEach(point => {
                    const transformedPoint = matrix.apply(point);
                    transformedGraphics.circle(transformedPoint.x, transformedPoint.y, stroke.size / 2);
                    transformedGraphics.fill({ color: stroke.color, alpha: stroke.opacity });
                });
                
                // 元のGraphicsを置き換え
                if (stroke.graphics && stroke.graphics.destroy) {
                    stroke.graphics.destroy();
                }
                stroke.graphics = transformedGraphics;
                
            } catch (error) {
                console.error('Failed to apply inverse transform:', error);
            }
        }

        isTransformNonDefault(transform) {
            if (!transform) return false;
            return (transform.x !== 0 || transform.y !== 0 || 
                    transform.rotation !== 0 || 
                    Math.abs(transform.scaleX) !== 1 || 
                    Math.abs(transform.scaleY) !== 1);
        }

        // === ツール・設定管理 ===
        setTool(tool) {
            this.currentTool = tool;
            console.log('Tool changed to:', tool);
        }

        setBrushSize(size) {
            this.brushSize = Math.max(0.1, Math.min(100, size));
        }

        setBrushColor(color) {
            this.brushColor = color;
        }

        setBrushOpacity(opacity) {
            this.brushOpacity = Math.max(0, Math.min(1, opacity));
        }

        // === システム参照設定 ===
        setLayerSystem(layerSystem) {
            this.layerSystem = layerSystem;
        }

        setCameraSystem(cameraSystem) {
            this.cameraSystem = cameraSystem;
        }

        // === 互換性メソッド（元版との互換性） ===
        startStroke(screenX, screenY) {
            return this.startDrawing(screenX, screenY);
        }

        continueStroke(screenX, screenY) {
            return this.continueDrawing(screenX, screenY);
        }

        endStroke() {
            return this.endDrawing();
        }

        stopDrawing() {
            return this.endDrawing();
        }

        // === デバッグ・診断 ===
        getDebugInfo() {
            return {
                currentTool: this.currentTool,
                isDrawing: this.isDrawing,
                brushSize: this.brushSize,
                brushColor: this.brushColor,
                brushOpacity: this.brushOpacity,
                hasCurrentStroke: !!this.currentStroke,
                strokePoints: this.currentStroke ? this.currentStroke.points.length : 0,
                hasLayerSystem: !!this.layerSystem,
                hasCameraSystem: !!this.cameraSystem
            };
        }

        // === パフォーマンス最適化 ===
        optimizeStroke(stroke) {
            if (!stroke || !stroke.points || stroke.points.length <= 2) return;

            // ダグラス・ピューカー アルゴリズムによる点削減
            const optimizedPoints = this.simplifyPath(stroke.points, 0.5);
            
            if (optimizedPoints.length < stroke.points.length) {
                stroke.points = optimizedPoints;
                this.rebuildStrokeGraphics(stroke);
            }
        }

        simplifyPath(points, tolerance = 1.0) {
            if (points.length <= 2) return points;

            // 簡易版の点削減
            const simplified = [points[0]];
            
            for (let i = 1; i < points.length - 1; i++) {
                const prev = points[i - 1];
                const curr = points[i];
                const next = points[i + 1];
                
                const dist = this.distanceToLine(curr, prev, next);
                if (dist > tolerance) {
                    simplified.push(curr);
                }
            }
            
            simplified.push(points[points.length - 1]);
            return simplified;
        }

        distanceToLine(point, lineStart, lineEnd) {
            const A = point.x - lineStart.x;
            const B = point.y - lineStart.y;
            const C = lineEnd.x - lineStart.x;
            const D = lineEnd.y - lineStart.y;
            
            const dot = A * C + B * D;
            const lenSq = C * C + D * D;
            
            if (lenSq === 0) return Math.sqrt(A * A + B * B);
            
            const param = dot / lenSq;
            let xx, yy;
            
            if (param < 0) {
                xx = lineStart.x;
                yy = lineStart.y;
            } else if (param > 1) {
                xx = lineEnd.x;
                yy = lineEnd.y;
            } else {
                xx = lineStart.x + param * C;
                yy = lineStart.y + param * D;
            }
            
            const dx = point.x - xx;
            const dy = point.y - yy;
            return Math.sqrt(dx * dx + dy * dy);
        }

        rebuildStrokeGraphics(stroke) {
            if (!stroke.graphics) return;

            stroke.graphics.clear();
            
            stroke.points.forEach(point => {
                stroke.graphics.circle(point.x, point.y, stroke.size / 2);
                stroke.graphics.fill({ color: stroke.color, alpha: stroke.opacity });
            });
        }

        // === エラー処理・回復 ===
        recoverFromError() {
            console.warn('DrawingSystem: Attempting error recovery');
            
            this.isDrawing = false;
            this.currentStroke = null;
            this.lastPoint = null;
            
            // カーソルをリセット
            if (this.app.canvas) {
                this.app.canvas.style.cursor = this.currentTool === 'eraser' ? 'cell' : 'crosshair';
            }
        }

        // === クリーンアップ ===
        destroy() {
            this.isDrawing = false;
            this.currentStroke = null;
            this.lastPoint = null;
            this.layerSystem = null;
            this.cameraSystem = null;
            
            console.log('DrawingSystem destroyed');
        }
    }
    
    // === グローバル公開 ===
    window.DrawingSystem = DrawingSystem;
    
    console.log('✅ DrawingSystem loaded - Full feature inheritance from original version');
    
})();