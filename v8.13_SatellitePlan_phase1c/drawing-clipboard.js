// ===== drawing-clipboard.js - Phase2分離版：描画エンジン＋クリップボード統合 =====
// core-engine.jsから分離・密結合システムの統合保持・PixiJS v8.13完全対応

/*
=== Phase2分離版 描画エンジン＋クリップボード統合システム ===

【分離内容】
✅ core-engine.jsからDrawingEngine + ClipboardSystem統合分離
✅ 描画とクリップボードの密結合を維持（設計判断）
✅ レイヤー変形逆変換対応
✅ 非破壊コピー&ペーストシステム

【責務】
- ベクターペン・消しゴム描画処理
- パス座標の記録・管理
- レイヤー変形考慮の描画座標調整
- 非破壊レイヤーコピー・ペースト
- キーボードショートカット（Ctrl+C/V）

【API境界】
- 入力: マウス・タッチイベント、キーボードイベント
- 出力: パスデータ、レイヤー操作
- 連携: CameraSystem、LayerManager、CoordinateSystem

【統合理由】
- コピー時の座標変換とペースト時の描画処理が密結合
- パスデータ構造の共通性
- メモリ効率とパフォーマンス最適化
*/

(function() {
    'use strict';
    
    // 依存関係確認
    const CONFIG = window.TEGAKI_CONFIG;
    if (!CONFIG) {
        throw new Error('drawing-clipboard.js: CONFIG dependency missing');
    }
    
    if (!window.CoordinateSystem) {
        throw new Error('drawing-clipboard.js: CoordinateSystem dependency missing');
    }
    
    // === 描画エンジン（Phase2分離版・レイヤー変形対応） ===
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
            
            console.log('✅ DrawingEngine initialized (Phase2 separated)');
        }

        // === 描画開始 ===
        startDrawing(screenX, screenY) {
            if (this.isDrawing || this.cameraSystem.spacePressed || this.cameraSystem.isDragging || 
                this.layerManager.vKeyPressed) return;

            // レイヤー変形を考慮しないキャンバス座標変換を使用
            const canvasPoint = this.cameraSystem.screenToCanvasForDrawing(screenX, screenY);
            
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

            // PixiJS v8.13対応の描画
            this.currentPath.graphics.circle(canvasPoint.x, canvasPoint.y, this.brushSize / 2);
            this.currentPath.graphics.fill({ color: color, alpha: opacity });

            // レイヤーのTransformを考慮して描画位置を調整
            this.addPathToActiveLayer(this.currentPath);
        }

        // === 描画継続 ===
        continueDrawing(screenX, screenY) {
            if (!this.isDrawing || !this.currentPath || this.cameraSystem.spacePressed || 
                this.cameraSystem.isDragging || this.layerManager.vKeyPressed) return;

            const canvasPoint = this.cameraSystem.screenToCanvasForDrawing(screenX, screenY);
            const lastPoint = this.lastPoint;
            
            const distance = Math.sqrt(
                Math.pow(canvasPoint.x - lastPoint.x, 2) + 
                Math.pow(canvasPoint.y - lastPoint.y, 2)
            );

            if (distance < 1) return;

            const steps = Math.max(1, Math.floor(distance / 1));
            for (let i = 1; i <= steps; i++) {
                const t = i / steps;
                const x = lastPoint.x + (canvasPoint.x - lastPoint.x) * t;
                const y = lastPoint.y + (canvasPoint.y - lastPoint.y) * t;

                this.currentPath.graphics.circle(x, y, this.brushSize / 2);
                this.currentPath.graphics.fill({ 
                    color: this.currentPath.color, 
                    alpha: this.currentPath.opacity 
                });

                this.currentPath.points.push({ x, y });
            }

            this.lastPoint = canvasPoint;
        }

        // === 描画終了 ===
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
        
        // === アクティブレイヤーのTransformを考慮してパスを追加 ===
        addPathToActiveLayer(path) {
            const activeLayer = this.layerManager.getActiveLayer();
            if (!activeLayer) return;
            
            const layerId = activeLayer.layerData.id;
            const transform = this.layerManager.layerTransforms.get(layerId);
            
            // レイヤーがtransformされている場合、逆変換を適用
            if (transform && (transform.x !== 0 || transform.y !== 0 || 
                transform.rotation !== 0 || Math.abs(transform.scaleX) !== 1 || Math.abs(transform.scaleY) !== 1)) {
                
                // 逆変換行列を作成
                const matrix = new PIXI.Matrix();
                
                // カメラフレーム中央基準での逆変換
                const centerX = CONFIG.canvas.width / 2;
                const centerY = CONFIG.canvas.height / 2;
                
                matrix.translate(-centerX - transform.x, -centerY - transform.y);
                matrix.rotate(-transform.rotation);
                matrix.scale(1/transform.scaleX, 1/transform.scaleY);
                matrix.translate(centerX, centerY);
                
                // パスの座標を逆変換
                const transformedGraphics = new PIXI.Graphics();
                path.points.forEach((point, index) => {
                    const transformedPoint = matrix.apply(point);
                    transformedGraphics.circle(transformedPoint.x, transformedPoint.y, path.size / 2);
                    transformedGraphics.fill({ color: path.color, alpha: path.opacity });
                });
                
                path.graphics = transformedGraphics;
            }
            
            activeLayer.layerData.paths.push(path);
            activeLayer.addChild(path.graphics);
        }

        // === ツール設定 ===
        setTool(tool) {
            this.currentTool = tool;
        }

        setBrushSize(size) {
            this.brushSize = Math.max(0.1, Math.min(100, size));
        }

        setBrushOpacity(opacity) {
            this.brushOpacity = Math.max(0, Math.min(1, opacity));
        }
    }

    // === クリップボードシステム（Phase2分離版・非破壊対応） ===
    class ClipboardSystem {
        constructor() {
            this.clipboardData = null;
            // 外部システム参照（後で設定）
            this.layerManager = null;
            this.setupKeyboardEvents();
            
            console.log('✅ ClipboardSystem initialized (Phase2 separated)');
        }

        // === キーボードイベント設定 ===
        setupKeyboardEvents() {
            document.addEventListener('keydown', (e) => {
                // Ctrl+C: コピー
                if (e.ctrlKey && e.code === 'KeyC' && !e.altKey && !e.metaKey) {
                    this.copyActiveLayer();
                    e.preventDefault();
                }
                
                // Ctrl+V: ペースト
                if (e.ctrlKey && e.code === 'KeyV' && !e.altKey && !e.metaKey) {
                    this.pasteLayer();
                    e.preventDefault();
                }
            });
        }

        // === 非破壊版：アクティブレイヤーのコピー ===
        copyActiveLayer() {
            const layerManager = this.layerManager;
            if (!layerManager) {
                console.warn('ClipboardSystem: LayerManager not available');
                return;
            }

            const activeLayer = layerManager.getActiveLayer();
            if (!activeLayer) {
                console.warn('ClipboardSystem: No active layer to copy');
                return;
            }

            try {
                if (CONFIG.debug) {
                    console.log('Non-destructive copy started');
                }
                
                // 現在の変形状態を取得
                const layerId = activeLayer.layerData.id;
                const currentTransform = layerManager.layerTransforms.get(layerId);
                
                let pathsToStore;
                
                if (layerManager.isTransformNonDefault(currentTransform)) {
                    // 変形中の場合：仮想的に変形適用した座標を生成
                    if (CONFIG.debug) {
                        console.log('Layer has active transforms - generating virtual transformed paths');
                    }
                    pathsToStore = this.getTransformedPaths(activeLayer, currentTransform);
                } else {
                    // 未変形の場合：そのままコピー
                    if (CONFIG.debug) {
                        console.log('Layer has no transforms - copying original paths');
                    }
                    pathsToStore = activeLayer.layerData.paths || [];
                }
                
                // レイヤーデータのディープコピー
                const layerData = activeLayer.layerData;
                
                // 背景データのコピー（背景レイヤーの場合）
                let backgroundData = null;
                if (layerData.isBackground) {
                    backgroundData = {
                        isBackground: true,
                        color: CONFIG.background.color
                    };
                }

                // 完全なパスデータをクリップボードに保存
                this.clipboardData = {
                    layerData: {
                        name: layerData.name.includes('_copy') ? 
                              layerData.name : layerData.name + '_copy',
                        visible: layerData.visible,
                        opacity: layerData.opacity,
                        paths: this.deepCopyPaths(pathsToStore),
                        backgroundData: backgroundData
                    },
                    // 変形情報はリセット（ペースト時は初期状態）
                    transform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 },
                    metadata: {
                        originalId: layerId,
                        copiedAt: Date.now(),
                        pathCount: pathsToStore.length,
                        isNonDestructive: true, // 非破壊フラグ
                        hasTransforms: layerManager.isTransformNonDefault(currentTransform)
                    },
                    timestamp: Date.now()
                };

                if (CONFIG.debug) {
                    console.log(`Non-destructive copy completed: ${pathsToStore.length} paths preserved`);
                    console.log('Copy metadata:', this.clipboardData.metadata);
                }
                
            } catch (error) {
                console.error('Failed to copy layer non-destructively:', error);
            }
        }

        // === 現在の変形状態を適用した座標を仮想計算 ===
        getTransformedPaths(layer, transform) {
            const centerX = CONFIG.canvas.width / 2;
            const centerY = CONFIG.canvas.height / 2;
            
            // 変形行列作成
            const matrix = new PIXI.Matrix();
            matrix.translate(centerX + transform.x, centerY + transform.y);
            matrix.rotate(transform.rotation);
            matrix.scale(transform.scaleX, transform.scaleY);
            matrix.translate(-centerX, -centerY);
            
            // パスに仮想変形を適用（元データは変更しない）
            return (layer.layerData.paths || []).map(path => ({
                id: `${path.id}_transformed_${Date.now()}`,
                points: (path.points || []).map(point => matrix.apply(point)),
                color: path.color,
                size: path.size,
                opacity: path.opacity,
                isComplete: path.isComplete
            }));
        }

        // === パスデータの完全ディープコピー ===
        deepCopyPaths(paths) {
            return (paths || []).map(path => ({
                id: `path_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`, // 新しいID
                points: (path.points || []).map(point => ({ x: point.x, y: point.y })), // 座標完全コピー
                color: path.color,
                size: path.size,
                opacity: path.opacity,
                isComplete: path.isComplete || true
            }));
        }

        // === 非破壊版：レイヤーのペースト ===
        pasteLayer() {
            const layerManager = this.layerManager;
            if (!layerManager) {
                console.warn('ClipboardSystem: LayerManager not available');
                return;
            }

            if (!this.clipboardData) {
                console.warn('ClipboardSystem: No clipboard data to paste');
                return;
            }

            try {
                const clipData = this.clipboardData;
                
                // 非破壊コピーの検証
                if (!clipData.metadata?.isNonDestructive) {
                    console.warn('Pasting potentially degraded data');
                } else if (CONFIG.debug) {
                    console.log('Pasting non-destructive data:', clipData.metadata);
                }
                
                // 一意なレイヤー名を生成
                const layerName = this.generateUniqueLayerName(clipData.layerData.name, layerManager);

                // 新規レイヤーを作成
                const { layer, index } = layerManager.createLayer(layerName, false);

                // 背景データが存在する場合は背景として再構築
                if (clipData.layerData.backgroundData) {
                    const bg = new PIXI.Graphics();
                    bg.rect(0, 0, CONFIG.canvas.width, CONFIG.canvas.height);
                    bg.fill(clipData.layerData.backgroundData.color);
                    layer.addChild(bg);
                    layer.layerData.backgroundGraphics = bg;
                    layer.layerData.isBackground = true;
                }

                // パスデータ完全復元
                clipData.layerData.paths.forEach(pathData => {
                    if (pathData.points && pathData.points.length > 0) {
                        const newPath = {
                            id: pathData.id,
                            points: [...pathData.points], // 座標完全コピー
                            color: pathData.color,
                            size: pathData.size,
                            opacity: pathData.opacity,
                            isComplete: true,
                            graphics: null // 後で生成
                        };
                        
                        // パスGraphicsを生成
                        layerManager.rebuildPathGraphics(newPath);
                        
                        // レイヤーに追加
                        layer.layerData.paths.push(newPath);
                        layer.addChild(newPath.graphics);
                    }
                });

                // レイヤー変形データを初期化
                const newLayerId = layer.layerData.id;
                layerManager.layerTransforms.set(newLayerId, {
                    x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1
                });

                // レイヤーの可視性と不透明度を復元
                layer.layerData.visible = clipData.layerData.visible;
                layer.layerData.opacity = clipData.layerData.opacity;
                layer.visible = clipData.layerData.visible;
                layer.alpha = clipData.layerData.opacity;

                // 新しいレイヤーをアクティブに設定
                layerManager.setActiveLayer(index);
                
                // UI更新
                layerManager.updateLayerPanelUI();
                layerManager.updateStatusDisplay();
                
                // サムネイル更新
                layerManager.requestThumbnailUpdate(index);

                if (CONFIG.debug) {
                    console.log(`Non-destructive paste completed: ${clipData.layerData.paths.length} paths restored`);
                }
                
            } catch (error) {
                console.error('Failed to paste layer non-destructively:', error);
            }
        }

        // === 一意なレイヤー名を生成 ===
        generateUniqueLayerName(baseName, layerManager) {
            let name = baseName;
            let counter = 1;
            
            while (layerManager.layers.some(layer => layer.layerData.name === name)) {
                name = `${baseName}_${counter}`;
                counter++;
            }
            
            return name;
        }
        
        // === 外部システム参照設定（依存注入） ===
        setLayerManager(layerManager) {
            this.layerManager = layerManager;
        }
    }

    // === 統合システム（Phase2分離版・DrawingEngine + ClipboardSystem統合） ===
    class DrawingClipboardSystem {
        constructor(cameraSystem, layerManager) {
            this.drawingEngine = new DrawingEngine(cameraSystem, layerManager);
            this.clipboardSystem = new ClipboardSystem();
            
            // クロス参照設定
            this.clipboardSystem.setLayerManager(layerManager);
            
            console.log('✅ DrawingClipboardSystem initialized (Phase2 separated - integrated)');
        }
        
        // === DrawingEngine API委譲 ===
        startDrawing(screenX, screenY) {
            return this.drawingEngine.startDrawing(screenX, screenY);
        }
        
        continueDrawing(screenX, screenY) {
            return this.drawingEngine.continueDrawing(screenX, screenY);
        }
        
        stopDrawing() {
            return this.drawingEngine.stopDrawing();
        }
        
        setTool(tool) {
            return this.drawingEngine.setTool(tool);
        }
        
        setBrushSize(size) {
            return this.drawingEngine.setBrushSize(size);
        }
        
        setBrushOpacity(opacity) {
            return this.drawingEngine.setBrushOpacity(opacity);
        }
        
        // === ClipboardSystem API委譲 ===
        copyActiveLayer() {
            return this.clipboardSystem.copyActiveLayer();
        }
        
        pasteLayer() {
            return this.clipboardSystem.pasteLayer();
        }
        
        // === プロパティアクセス ===
        get currentTool() {
            return this.drawingEngine.currentTool;
        }
        
        get brushSize() {
            return this.drawingEngine.brushSize;
        }
        
        get brushOpacity() {
            return this.drawingEngine.brushOpacity;
        }
        
        get isDrawing() {
            return this.drawingEngine.isDrawing;
        }
        
        // === 個別システム取得（必要時） ===
        getDrawingEngine() {
            return this.drawingEngine;
        }
        
        getClipboardSystem() {
            return this.clipboardSystem;
        }
    }
    
    // === グローバル公開 ===
    window.TegakiDrawingClipboardSeparated = {
        DrawingEngine: DrawingEngine,
        ClipboardSystem: ClipboardSystem,
        DrawingClipboardSystem: DrawingClipboardSystem
    };
    
    console.log('✅ drawing-clipboard.js loaded (Phase2 separated - integrated system)');
    console.log('   - DrawingEngine: Pen/Eraser drawing with layer transform support');
    console.log('   - ClipboardSystem: Non-destructive copy/paste with transform handling');
    console.log('   - Integrated system maintains tight coupling for performance');
    
})();