// ===== drawing-engine.js - 描画エンジンシステム =====

window.TegakiModules = window.TegakiModules || {};

// === 描画エンジン（改修版：ペン描画位置ズレ対策） ===
window.TegakiModules.DrawingEngine = class DrawingEngine {
    constructor(cameraSystem, layerManager) {
        this.cameraSystem = cameraSystem;
        this.layerManager = layerManager;
        this.currentTool = 'pen';
        this.brushSize = window.TEGAKI_CONFIG.pen.size;
        this.brushColor = window.TEGAKI_CONFIG.pen.color;
        this.brushOpacity = window.TEGAKI_CONFIG.pen.opacity;
        this.isDrawing = false;
        this.currentPath = null;
        this.lastPoint = null;
    }

    startDrawing(screenX, screenY) {
        if (this.isDrawing || this.cameraSystem.spacePressed || this.cameraSystem.isDragging || 
            this.layerManager.vKeyPressed) return;

        // 改修版：レイヤー変形を考慮しないキャンバス座標変換を使用
        const canvasPoint = this.cameraSystem.screenToCanvasForDrawing(screenX, screenY);
        
        if (!this.cameraSystem.isPointInExtendedCanvas(canvasPoint)) {
            return;
        }
        
        this.isDrawing = true;
        this.lastPoint = canvasPoint;

        const activeLayer = this.layerManager.getActiveLayer();
        if (!activeLayer) return;

        const color = this.currentTool === 'eraser' ? window.TEGAKI_CONFIG.background.color : this.brushColor;
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

        // 改修版：レイヤーのTransformを考慮して描画位置を調整
        this.addPathToActiveLayer(this.currentPath);
    }

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
    
    // 改修版：アクティブレイヤーのTransformを考慮してパスを追加
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
            const centerX = window.TEGAKI_CONFIG.canvas.width / 2;
            const centerY = window.TEGAKI_CONFIG.canvas.height / 2;
            
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

    setTool(tool) {
        this.currentTool = tool;
    }

    setBrushSize(size) {
        this.brushSize = Math.max(0.1, Math.min(100, size));
    }

    setBrushOpacity(opacity) {
        this.brushOpacity = Math.max(0, Math.min(1, opacity));
    }
};

// === クリップボード管理システム（非破壊版） ===
window.TegakiModules.ClipboardSystem = class ClipboardSystem {
    constructor() {
        this.clipboardData = null;
        this.setupKeyboardEvents();
    }

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

    // 非破壊版：アクティブレイヤーのコピー
    copyActiveLayer() {
        const layerManager = window.drawingApp?.layerManager;
        if (!layerManager) {
            console.warn('LayerManager not available');
            return;
        }

        const activeLayer = layerManager.getActiveLayer();
        if (!activeLayer) {
            console.warn('No active layer to copy');
            return;
        }

        try {
            console.log('Non-destructive copy started');
            
            // ✅ 現在の変形状態を取得
            const layerId = activeLayer.layerData.id;
            const currentTransform = layerManager.layerTransforms.get(layerId);
            
            let pathsToStore;
            
            if (layerManager.isTransformNonDefault(currentTransform)) {
                // 変形中の場合：仮想的に変形適用した座標を生成
                console.log('Layer has active transforms - generating virtual transformed paths');
                pathsToStore = this.getTransformedPaths(activeLayer, currentTransform);
            } else {
                // 未変形の場合：そのままコピー
                console.log('Layer has no transforms - copying original paths');
                pathsToStore = activeLayer.layerData.paths || [];
            }
            
            // レイヤーデータのディープコピー
            const layerData = activeLayer.layerData;
            
            // 背景データのコピー（背景レイヤーの場合）
            let backgroundData = null;
            if (layerData.isBackground) {
                backgroundData = {
                    isBackground: true,
                    color: window.TEGAKI_CONFIG.background.color
                };
            }

            // ✅ 完全なパスデータをクリップボードに保存
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

            console.log(`Non-destructive copy completed: ${pathsToStore.length} paths preserved`);
            console.log('Copy metadata:', this.clipboardData.metadata);
            
        } catch (error) {
            console.error('Failed to copy layer non-destructively:', error);
        }
    }

    // 現在の変形状態を適用した座標を仮想計算
    getTransformedPaths(layer, transform) {
        const centerX = window.TEGAKI_CONFIG.canvas.width / 2;
        const centerY = window.TEGAKI_CONFIG.canvas.height / 2;
        
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

    // パスデータの完全ディープコピー
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

    // 非破壊版：レイヤーのペースト
    pasteLayer() {
        const layerManager = window.drawingApp?.layerManager;
        if (!layerManager) {
            console.warn('LayerManager not available');
            return;
        }

        if (!this.clipboardData) {
            console.warn('No clipboard data to paste');
            return;
        }

        try {
            const clipData = this.clipboardData;
            
            // ✅ 非破壊コピーの検証
            if (!clipData.metadata?.isNonDestructive) {
                console.warn('Pasting potentially degraded data');
            } else {
                console.log('Pasting non-destructive data:', clipData.metadata);
            }
            
            // 一意なレイヤー名を生成
            const layerName = this.generateUniqueLayerName(clipData.layerData.name, layerManager);

            // 新規レイヤーを作成
            const { layer, index } = layerManager.createLayer(layerName, false);

            // 背景データが存在する場合は背景として再構築
            if (clipData.layerData.backgroundData) {
                const bg = new PIXI.Graphics();
                bg.rect(0, 0, window.TEGAKI_CONFIG.canvas.width, window.TEGAKI_CONFIG.canvas.height);
                bg.fill(clipData.layerData.backgroundData.color);
                layer.addChild(bg);
                layer.layerData.backgroundGraphics = bg;
                layer.layerData.isBackground = true;
            }

            // ✅ パスデータ完全復元
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

            console.log(`Non-destructive paste completed: ${clipData.layerData.paths.length} paths restored`);
            
        } catch (error) {
            console.error('Failed to paste layer non-destructively:', error);
        }
    }

    // 一意なレイヤー名を生成
    generateUniqueLayerName(baseName, layerManager) {
        let name = baseName;
        let counter = 1;
        
        while (layerManager.layers.some(layer => layer.layerData.name === name)) {
            name = `${baseName}_${counter}`;
            counter++;
        }
        
        return name;
    }
};

// === インタラクション管理 ===
window.TegakiModules.InteractionManager = class InteractionManager {
    constructor(app, drawingEngine, layerManager) {
        this.app = app;
        this.drawingEngine = drawingEngine;
        this.layerManager = layerManager;
        this.setupKeyboardEvents();
        this.setupCanvasEvents();
        
        // 初期ツール設定
        this.switchTool('pen');
    }

    setupKeyboardEvents() {
        document.addEventListener('keydown', (e) => {
            if (e.key.toLowerCase() === 'p' && !e.ctrlKey && !e.altKey && !e.metaKey) {
                this.switchTool('pen');
                e.preventDefault();
            }
            if (e.key.toLowerCase() === 'e' && !e.ctrlKey && !e.altKey && !e.metaKey) {
                this.switchTool('eraser');
                e.preventDefault();
            }
        });
    }

    setupCanvasEvents() {
        this.app.canvas.addEventListener('pointerdown', (e) => {
            if (e.button !== 0) return;

            const rect = this.app.canvas.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;

            this.drawingEngine.startDrawing(x, y);
            e.preventDefault();
        });

        this.app.canvas.addEventListener('pointermove', (e) => {
            const rect = this.app.canvas.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;

            this.updateCoordinates(x, y);
            this.drawingEngine.continueDrawing(x, y);
        });
    }

    switchTool(tool) {
        this.drawingEngine.setTool(tool);
        
        // レイヤー移動モードを終了
        if (this.layerManager.isLayerMoveMode) {
            this.layerManager.exitLayerMoveMode();
        }
        
        document.querySelectorAll('.tool-button').forEach(btn => btn.classList.remove('active'));
        const toolBtn = document.getElementById(tool + '-tool');
        if (toolBtn) toolBtn.classList.add('active');

        const toolNames = { pen: 'ベクターペン', eraser: '消しゴム' };
        const toolElement = document.getElementById('current-tool');
        if (toolElement) {
            toolElement.textContent = toolNames[tool] || tool;
        }

        this.updateCursor();
    }

    updateCursor() {
        if (this.layerManager.vKeyPressed) {
            // レイヤー操作中はLayerManagerが制御
            return;
        }
        
        const tool = this.drawingEngine.currentTool;
        this.app.canvas.style.cursor = tool === 'eraser' ? 'cell' : 'crosshair';
    }

    updateCoordinates(x, y) {
        const element = document.getElementById('coordinates');
        if (element) {
            element.textContent = `x: ${Math.round(x)}, y: ${Math.round(y)}`;
        }
    }
};