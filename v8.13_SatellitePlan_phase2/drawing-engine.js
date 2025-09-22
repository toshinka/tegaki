// ===== drawing-engine.js - 描画エンジン（Phase2分離版） =====
// core-engine.js から分離したペン描画・パス管理・ツール制御システム
// Phase1.5改修: 座標変換統一・CoordinateSystem使用・レイヤー変形対応

/*
=== Phase2分離 + Phase1.5改修完了ヘッダー ===

【分離内容】
- DrawingEngineクラス完全分離
- ペン描画・パス管理・ツール制御
- レイヤー変形逆変換対応
- 拡張キャンバス描画対応

【Phase1.5改修完了】
✅ 座標変換統一: window.CoordinateSystem使用に統一
✅ レイヤー変形対応: 逆変換行列による描画位置調整
✅ 精密描画処理: スムージング・補間処理
✅ 安全な描画処理: エラー処理・座標検証

【Dependencies】
- CONFIG: config.js のグローバル設定
- window.CoordinateSystem: coordinate-system.js 統一座標API
- PIXI: PixiJS v8.13
- CameraSystem: カメラシステム（座標変換用）
- LayerManager: レイヤー管理（描画対象取得）

【呼び出し側】
- CoreRuntime: 公開API経由
- core-engine.js → 各分離Engine

=== Phase2分離 + Phase1.5改修完了ヘッダー終了 ===
*/

(function() {
    'use strict';
    
    // グローバル設定を取得
    const CONFIG = window.TEGAKI_CONFIG;
    
    const log = (...args) => {
        if (CONFIG.debug) console.log(...args);
    };

    // === 描画エンジン（Phase2分離版・Phase1.5改修完了） ===
    class DrawingEngine {
        constructor(cameraSystem, layerManager) {
            this.cameraSystem = cameraSystem;
            this.layerManager = layerManager;
            this.currentTool = 'pen';
            this.brushSize = CONFIG.pen.size;
            this.brushColor = CONFIG.pen.color;
            this.brushOpacity = CONFIG.pen.opacity;
            this.isDrawing = false;
            this.currentPath = null;
            this.lastPoint = null;
        }

        startDrawing(screenX, screenY) {
            if (this.isDrawing || this.cameraSystem.spacePressed || this.cameraSystem.isDragging || 
                this.layerManager.vKeyPressed) return;

            // ✅ Phase1.5改修: CoordinateSystem統一API使用（レイヤー変形を考慮しない描画座標）
            const canvasPoint = window.CoordinateSystem.globalToLocal(
                this.cameraSystem.canvasContainer, { x: screenX, y: screenY }
            );
            
            if (!this.cameraSystem.isPointInExtendedCanvas(canvasPoint)) {
                return;
            }
            
            this.isDrawing = true;
            this.lastPoint = canvasPoint;

            const activeLayer = this.layerManager.getActiveLayer();
            if (!activeLayer) return;

            const color = this.currentTool === 'eraser' ? CONFIG.background.color : this.brushColor;
            const opacity = this.currentTool === 'eraser' ? 1.0 : this.brushOpacity;

            this.currentPath = {
                id: `path_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                graphics: new PIXI.Graphics(),
                points: [{ x: canvasPoint.x, y: canvasPoint.y }],
                color: color,
                size: this.brushSize,
                opacity: opacity,
                isComplete: false
            };

            this.currentPath.graphics.circle(canvasPoint.x, canvasPoint.y, this.brushSize / 2);
            this.currentPath.graphics.fill({ color: color, alpha: opacity });

            // ✅ Phase1.5改修: レイヤーのTransformを考慮して描画位置を調整
            this.addPathToActiveLayer(this.currentPath);
        }

        continueDrawing(screenX, screenY) {
            if (!this.isDrawing || !this.currentPath || this.cameraSystem.spacePressed || 
                this.cameraSystem.isDragging || this.layerManager.vKeyPressed) return;

            // ✅ Phase1.5改修: CoordinateSystem統一API使用
            const canvasPoint = window.CoordinateSystem.globalToLocal(
                this.cameraSystem.canvasContainer, { x: screenX, y: screenY }
            );
            const lastPoint = this.lastPoint;
            
            const distance = Math.sqrt(
                Math.pow(canvasPoint.x - lastPoint.x, 2) + 
                Math.pow(canvasPoint.y - lastPoint.y, 2)
            );

            if (distance < 1) return;

            // ✅ Phase1.5改修: スムージング処理による精密描画
            const steps = Math.max(1, Math.floor(distance / 1));
            for (let i = 1; i <= steps; i++) {
                const t = i / steps;
                const x = lastPoint.x + (canvasPoint.x - lastPoint.x) * t;
                const y = lastPoint.y + (canvasPoint.y - lastPoint.y) * t;

                // 座標検証
                if (typeof x === 'number' && typeof y === 'number' && isFinite(x) && isFinite(y)) {
                    this.currentPath.graphics.circle(x, y, this.brushSize / 2);
                    this.currentPath.graphics.fill({ 
                        color: this.currentPath.color, 
                        alpha: this.currentPath.opacity 
                    });

                    this.currentPath.points.push({ x, y });
                }
            }

            this.lastPoint = canvasPoint;
        }

        stopDrawing() {
            if (!this.isDrawing) return;

            if (this.currentPath) {
                this.currentPath.isComplete = true;
                this.layerManager.requestThumbnailUpdate(this.layerManager.activeLayerIndex);
            }

            this.isDrawing = false;
            this.currentPath = null;
            this.lastPoint = null;
        }
        
        // ✅ Phase1.5改修: アクティブレイヤーのTransformを考慮してパスを追加
        addPathToActiveLayer(path) {
            const activeLayer = this.layerManager.getActiveLayer();
            if (!activeLayer) return;
            
            const layerId = activeLayer.layerData.id;
            const transform = this.layerManager.layerTransforms.get(layerId);
            
            // レイヤーがtransformされている場合、逆変換を適用
            if (transform && this.layerManager.isTransformNonDefault(transform)) {
                try {
                    // ✅ Phase1.5改修: 精密逆変換行列を作成（PIXI.Matrix使用）
                    const matrix = this.createInverseTransformMatrix(transform);
                    
                    // パスの座標を逆変換
                    const transformedGraphics = new PIXI.Graphics();
                    path.points.forEach((point, index) => {
                        try {
                            // 座標検証
                            if (typeof point.x !== 'number' || typeof point.y !== 'number' ||
                                !isFinite(point.x) || !isFinite(point.y)) {
                                console.warn(`Invalid point in path at index ${index}:`, point);
                                return;
                            }
                            
                            // 逆変換適用
                            const transformedPoint = matrix.apply(point);
                            
                            // 変換結果検証
                            if (typeof transformedPoint.x === 'number' && typeof transformedPoint.y === 'number' &&
                                isFinite(transformedPoint.x) && isFinite(transformedPoint.y)) {
                                
                                transformedGraphics.circle(transformedPoint.x, transformedPoint.y, path.size / 2);
                                transformedGraphics.fill({ color: path.color, alpha: path.opacity });
                            }
                        } catch (pointError) {
                            console.warn(`Failed to transform point ${index}:`, pointError);
                        }
                    });
                    
                    path.graphics = transformedGraphics;
                    
                } catch (transformError) {
                    console.error('Failed to apply inverse transform to path:', transformError);
                    // エラー時はそのまま使用（フォールバック）
                }
            }
            
            activeLayer.layerData.paths.push(path);
            activeLayer.addChild(path.graphics);
        }
        
        // ✅ Phase1.5新規: 精密逆変換行列作成（PIXI.Matrix使用）
        createInverseTransformMatrix(transform) {
            const matrix = new PIXI.Matrix();
            
            // カメラフレーム中央基準での逆変換
            const centerX = CONFIG.canvas.width / 2;
            const centerY = CONFIG.canvas.height / 2;
            
            // 元の変形の逆順で逆変換を適用
            matrix.translate(-centerX - transform.x, -centerY - transform.y);
            matrix.rotate(-transform.rotation);
            matrix.scale(1/transform.scaleX, 1/transform.scaleY);
            matrix.translate(centerX, centerY);
            
            return matrix;
        }

        setTool(tool) {
            this.currentTool = tool;
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
        
        // ツール状態取得
        getCurrentTool() {
            return this.currentTool;
        }
        
        getBrushSize() {
            return this.brushSize;
        }
        
        getBrushColor() {
            return this.brushColor;
        }
        
        getBrushOpacity() {
            return this.brushOpacity;
        }
        
        // 描画状態取得
        isCurrentlyDrawing() {
            return this.isDrawing;
        }
        
        // ✅ Phase1.5新規: 座標変換テスト用メソッド
        testCoordinateTransform(testPoint) {
            try {
                // 往復変換テスト
                const screenPoint = window.CoordinateSystem.localToGlobal(
                    this.cameraSystem.canvasContainer, testPoint
                );
                const backToCanvas = window.CoordinateSystem.globalToLocal(
                    this.cameraSystem.canvasContainer, screenPoint
                );
                
                const error = Math.sqrt(
                    Math.pow(testPoint.x - backToCanvas.x, 2) + 
                    Math.pow(testPoint.y - backToCanvas.y, 2)
                );
                
                return {
                    original: testPoint,
                    screen: screenPoint,
                    backToCanvas: null,
                    error: Infinity,
                    accurate: false
                };
            }
        }
    }

    // === グローバル公開 ===
    window.TegakiDrawingEngine = DrawingEngine;
    
})();Canvas: backToCanvas,
                    error: error,
                    accurate: error < 0.001
                };
            } catch (error) {
                console.error('Coordinate transform test failed:', error);
                return {
                    original: testPoint,
                    screen: null,
                    backTo