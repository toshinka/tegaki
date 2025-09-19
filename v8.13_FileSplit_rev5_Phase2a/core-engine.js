// ===== core-engine.js - 統合コアエンジン（修正版：レイヤー変形確定処理非破壊化・アンドゥリドゥ復旧） =====
// CameraSystem + LayerManager + DrawingEngine + ClipboardSystem を統合
// 相互依存関係を内部化し、Claude改修効率を最大化

/*
=== 修正ヘッダー ===

【修正対象】
- LayerManager.confirmLayerTransform() の非破壊化（GPT5改修案対応）
- レイヤー変形確定時の画像消失問題解決
- 回転・拡縮情報の正しい保持
- アンドゥ・リドゥ機能の復旧

【ファイル間依存関係辞典】
- CONFIG: config.js のグローバル設定オブジェクト
- UIController: ui-panels.js のUI制御クラス
- TegakiUI.initializeSortable: ui-panels.js のSortableJS統合関数
- window.drawingAppResizeCanvas: index.html内main.js統合部分の関数

【主要クラス・メソッド一覧】
- CoreEngine: 統合制御クラス
  - initialize(): 初期化・レイヤー作成・UI統合
  - resizeCanvas(): キャンバスリサイズ統合処理
- CameraSystem: カメラ・ビューポート制御
  - screenToCanvasForDrawing(): ペン描画用座標変換（変形考慮なし）
  - updateGuideLinesForCanvasResize(): ガイドライン再作成
- LayerManager: レイヤー管理・変形処理
  - confirmLayerTransform(): 【修正】非破壊的変形確定処理
  - HistoryManager: 【新規】アンドゥ・リドゥ管理
- DrawingEngine: 描画制御
  - addPathToActiveLayer(): レイヤー変形逆変換適用
- ClipboardSystem: 非破壊コピー&ペースト
  - copyActiveLayer(): 変形状態考慮のコピー

【修正内容】
1. confirmLayerTransform()の完全非破壊化（GPT5改修案準拠）
2. positionのみ更新でscale/rotationを保持
3. HistoryManager追加でアンドゥ・リドゥ復旧
4. 変形情報の正確な保持・復元

=== 修正ヘッダー終了 ===
*/

(function() {
    'use strict';
    
    // グローバル設定を取得
    const CONFIG = window.TEGAKI_CONFIG;
    
    const log = (...args) => {
        if (CONFIG.debug) console.log(...args);
    };

    // === 履歴管理システム（新規追加：アンドゥ・リドゥ復旧） ===
    class HistoryManager {
        constructor(layerManager) {
            this.layerManager = layerManager;
            this.history = [];
            this.currentIndex = -1;
            this.maxHistorySize = 50;
            
            this.setupKeyboardEvents();
            
            // 初期状態を保存
            this.saveState();
        }
        
        setupKeyboardEvents() {
            document.addEventListener('keydown', (e) => {
                // Ctrl+Z: アンドゥ
                if (e.ctrlKey && e.code === 'KeyZ' && !e.shiftKey && !e.altKey && !e.metaKey) {
                    this.undo();
                    e.preventDefault();
                }
                
                // Ctrl+Y または Ctrl+Shift+Z: リドゥ
                if ((e.ctrlKey && e.code === 'KeyY') || 
                    (e.ctrlKey && e.shiftKey && e.code === 'KeyZ')) {
                    this.redo();
                    e.preventDefault();
                }
            });
        }
        
        saveState() {
            try {
                // 現在のレイヤー状態をシリアライズ
                const state = {
                    layers: this.layerManager.layers.map(layer => ({
                        id: layer.layerData.id,
                        name: layer.layerData.name,
                        visible: layer.layerData.visible,
                        opacity: layer.layerData.opacity,
                        isBackground: layer.layerData.isBackground,
                        paths: (layer.layerData.paths || []).map(path => ({
                            id: path.id,
                            points: path.points.map(p => ({ x: p.x, y: p.y })),
                            color: path.color,
                            size: path.size,
                            opacity: path.opacity,
                            isComplete: path.isComplete
                        }))
                    })),
                    transforms: Object.fromEntries(this.layerManager.layerTransforms),
                    activeLayerIndex: this.layerManager.activeLayerIndex,
                    timestamp: Date.now()
                };
                
                // 履歴を追加
                if (this.currentIndex < this.history.length - 1) {
                    // 現在位置以降の履歴を削除
                    this.history = this.history.slice(0, this.currentIndex + 1);
                }
                
                this.history.push(state);
                this.currentIndex++;
                
                // 履歴サイズ制限
                if (this.history.length > this.maxHistorySize) {
                    this.history.shift();
                    this.currentIndex--;
                }
                
                this.updateHistoryDisplay();
                
            } catch (error) {
                console.error('Failed to save state:', error);
            }
        }
        
        undo() {
            if (this.currentIndex > 0) {
                this.currentIndex--;
                this.restoreState(this.history[this.currentIndex]);
                console.log('Undo executed. Index:', this.currentIndex);
            }
        }
        
        redo() {
            if (this.currentIndex < this.history.length - 1) {
                this.currentIndex++;
                this.restoreState(this.history[this.currentIndex]);
                console.log('Redo executed. Index:', this.currentIndex);
            }
        }
        
        restoreState(state) {
            try {
                console.log('Restoring state:', state);
                
                // レイヤーをクリア
                this.layerManager.layers.forEach(layer => {
                    this.layerManager.layersContainer.removeChild(layer);
                    layer.destroy();
                });
                this.layerManager.layers = [];
                this.layerManager.layerTransforms.clear();
                
                // レイヤーを復元
                state.layers.forEach((layerData, index) => {
                    const layer = new PIXI.Container();
                    layer.label = layerData.id;
                    layer.layerData = {
                        id: layerData.id,
                        name: layerData.name,
                        visible: layerData.visible,
                        opacity: layerData.opacity,
                        isBackground: layerData.isBackground,
                        paths: []
                    };
                    
                    // 背景レイヤーの場合
                    if (layerData.isBackground) {
                        const bg = new PIXI.Graphics();
                        bg.rect(0, 0, CONFIG.canvas.width, CONFIG.canvas.height);
                        bg.fill(CONFIG.background.color);
                        layer.addChild(bg);
                        layer.layerData.backgroundGraphics = bg;
                    }
                    
                    // パスを復元
                    layerData.paths.forEach(pathData => {
                        const path = {
                            id: pathData.id,
                            points: pathData.points.map(p => ({ x: p.x, y: p.y })),
                            color: pathData.color,
                            size: pathData.size,
                            opacity: pathData.opacity,
                            isComplete: pathData.isComplete,
                            graphics: new PIXI.Graphics()
                        };
                        
                        // Graphics再生成
                        path.points.forEach(point => {
                            path.graphics.circle(point.x, point.y, path.size / 2);
                            path.graphics.fill({ color: path.color, alpha: path.opacity });
                        });
                        
                        layer.layerData.paths.push(path);
                        layer.addChild(path.graphics);
                    });
                    
                    // レイヤーの可視性・不透明度設定
                    layer.visible = layerData.visible;
                    layer.alpha = layerData.opacity;
                    
                    this.layerManager.layers.push(layer);
                    this.layerManager.layersContainer.addChild(layer);
                });
                
                // 変形データを復元
                Object.entries(state.transforms).forEach(([layerId, transform]) => {
                    this.layerManager.layerTransforms.set(layerId, transform);
                });
                
                // アクティブレイヤーを復元
                this.layerManager.activeLayerIndex = state.activeLayerIndex;
                
                // UI更新
                this.layerManager.updateLayerPanelUI();
                this.layerManager.updateStatusDisplay();
                this.updateHistoryDisplay();
                
                console.log('State restored successfully');
                
            } catch (error) {
                console.error('Failed to restore state:', error);
            }
        }
        
        updateHistoryDisplay() {
            const element = document.getElementById('history-info');
            if (element) {
                element.textContent = `${this.currentIndex + 1}/${this.history.length}`;
            }
        }
    }

    // === クリップボード管理システム（非破壊版） ===
    class ClipboardSystem {
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

        // 修正版：効果的変形状態を考慮したコピー処理
        copyActiveLayer() {
            const layerManager = this.layerManager; // 内部参照
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
                console.log('Non-destructive copy with effective transform started');
                
                // ✅ 修正版：効果的な変形状態を取得（表示状態 + 編集中変形）
                const effectiveTransform = layerManager.getEffectiveTransform(activeLayer);
                console.log('Effective transform for copy:', effectiveTransform);
                
                let pathsToStore;
                
                if (layerManager.isTransformNonDefault(effectiveTransform)) {
                    // 変形中の場合：効果的変形を適用した座標を生成
                    console.log('Layer has effective transforms - generating transformed paths');
                    pathsToStore = this.getTransformedPathsWithEffectiveTransform(activeLayer, effectiveTransform);
                } else {
                    // 未変形の場合：そのままコピー
                    console.log('Layer has no effective transforms - copying original paths');
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
                        originalId: activeLayer.layerData.id,
                        copiedAt: Date.now(),
                        pathCount: pathsToStore.length,
                        isNonDestructive: true, // 非破壊フラグ
                        hasEffectiveTransforms: layerManager.isTransformNonDefault(effectiveTransform),
                        effectiveTransform: effectiveTransform // 効果的変形を記録
                    },
                    timestamp: Date.now()
                };

                console.log(`Effective transform copy completed: ${pathsToStore.length} paths preserved`);
                console.log('Copy metadata:', this.clipboardData.metadata);
                
            } catch (error) {
                console.error('Failed to copy layer with effective transform:', error);
            }
        }

        // ✅ 修正版：効果的変形状態を適用した座標を仮想計算
        getTransformedPathsWithEffectiveTransform(layer, effectiveTransform) {
            const centerX = CONFIG.canvas.width / 2;
            const centerY = CONFIG.canvas.height / 2;
            
            // 効果的変形行列作成
            const matrix = new PIXI.Matrix();
            matrix.translate(centerX + effectiveTransform.x, centerY + effectiveTransform.y);
            matrix.rotate(effectiveTransform.rotation);
            matrix.scale(effectiveTransform.scaleX, effectiveTransform.scaleY);
            matrix.translate(-centerX, -centerY);
            
            // パスに効果的変形を適用（元データは変更しない）
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
            const layerManager = this.layerManager; // 内部参照
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
                    bg.rect(0, 0, CONFIG.canvas.width, CONFIG.canvas.height);
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

                // 履歴保存
                if (layerManager.historyManager) {
                    layerManager.historyManager.saveState();
                }

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
        
        // 内部参照設定用（CoreEngineから呼び出し）
        setLayerManager(layerManager) {
            this.layerManager = layerManager;
        }
    }

    // === カメラシステム（改修版：座標変換修正・ペン描画ズレ対策） ===
    class CameraSystem {
        constructor(app) {
            this.app = app;
            this.isDragging = false;
            this.isScaleRotateDragging = false;
            this.lastPoint = { x: 0, y: 0 };
            this.panSpeed = CONFIG.camera.dragMoveSpeed;
            this.zoomSpeed = CONFIG.camera.wheelZoomSpeed;
            this.rotation = 0;
            this.horizontalFlipped = false;
            this.verticalFlipped = false;
            
            // 初期状態の記憶（Ctrl+0リセット用）
            this.initialState = {
                position: null,
                scale: CONFIG.camera.initialScale,
                rotation: 0,
                horizontalFlipped: false,
                verticalFlipped: false
            };
            
            this.worldContainer = new PIXI.Container();
            this.worldContainer.label = 'worldContainer';
            app.stage.addChild(this.worldContainer);
            
            this.canvasContainer = new PIXI.Container();
            this.canvasContainer.label = 'canvasContainer';
            this.worldContainer.addChild(this.canvasContainer);
            
            this.cameraFrame = new PIXI.Graphics();
            this.cameraFrame.label = 'cameraFrame';
            this.worldContainer.addChild(this.cameraFrame);
            
            // 修正版：カメラフレーム内ガイドライン用コンテナ
            this.guideLines = new PIXI.Container();
            this.guideLines.label = 'guideLines';
            this.worldContainer.addChild(this.guideLines);
            this.createGuideLines();
            
            this.canvasMask = new PIXI.Graphics();
            this.canvasMask.rect(0, 0, CONFIG.canvas.width, CONFIG.canvas.height);
            this.canvasMask.fill(0xffffff);
            this.worldContainer.addChild(this.canvasMask);
            this.canvasContainer.mask = this.canvasMask;
            
            // キー状態管理
            this.spacePressed = false;
            this.shiftPressed = false;
            this.vKeyPressed = false;
            
            // 内部参照（後で設定）
            this.layerManager = null;
            this.drawingEngine = null;
            
            this.setupEvents();
            this.initializeCamera();
            this.drawCameraFrame();
        }
        
        // 修正2: ガイドライン作成の完全修正版（キャンバスサイズ変更対応）
        createGuideLines() {
            this.guideLines.removeChildren();
            
            // デバッグ：現在のキャンバスサイズを確認
            console.log('Creating guide lines for canvas:', CONFIG.canvas.width, 'x', CONFIG.canvas.height);
            
            // 修正2: カメラフレーム中央の座標を動的に計算
            const centerX = CONFIG.canvas.width / 2;
            const centerY = CONFIG.canvas.height / 2;
            
            console.log('Guide line center coordinates:', centerX, centerY);
            
            // 縦線（カメラフレームの中央）
            const verticalLine = new PIXI.Graphics();
            verticalLine.rect(centerX - 0.5, 0, 1, CONFIG.canvas.height);
            verticalLine.fill({ color: 0x800000, alpha: 0.8 });
            this.guideLines.addChild(verticalLine);
            
            // 横線（カメラフレームの中央）
            const horizontalLine = new PIXI.Graphics();
            horizontalLine.rect(0, centerY - 0.5, CONFIG.canvas.width, 1);
            horizontalLine.fill({ color: 0x800000, alpha: 0.8 });
            this.guideLines.addChild(horizontalLine);
            
            this.guideLines.visible = false; // 初期は非表示
            
            console.log('Guide lines created. Children count:', this.guideLines.children.length);
        }
        
        // 修正2: キャンバスサイズ変更時のガイドライン再作成（完全版）
        updateGuideLinesForCanvasResize() {
            console.log('Updating guide lines for canvas resize to', CONFIG.canvas.width, 'x', CONFIG.canvas.height);
            this.createGuideLines();
            this.drawCameraFrame();
            // マスクも更新
            this.canvasMask.clear();
            this.canvasMask.rect(0, 0, CONFIG.canvas.width, CONFIG.canvas.height);
            this.canvasMask.fill(0xffffff);
        }
        
        // 追加: 外部からのキャンバスリサイズ処理（UIController用）
        resizeCanvas(newWidth, newHeight) {
            console.log('CameraSystem: Resizing canvas from', CONFIG.canvas.width, 'x', CONFIG.canvas.height, 'to', newWidth, 'x', newHeight);
            
            // CONFIG更新（外部で既に更新済みだが念のため）
            CONFIG.canvas.width = newWidth;
            CONFIG.canvas.height = newHeight;
            
            // カメラフレーム、マスク、ガイドライン更新
            this.updateGuideLinesForCanvasResize();
            
            console.log('CameraSystem: Canvas resize completed');
        }
        
        // 修正版：ガイドラインの表示・非表示（デバッグログ追加）
        showGuideLines() {
            this.guideLines.visible = true;
            console.log('Guide lines shown. Visible:', this.guideLines.visible);
        }
        
        hideGuideLines() {
            this.guideLines.visible = false;
            console.log('Guide lines hidden. Visible:', this.guideLines.visible);
        }
        
        initializeCamera() {
            const centerX = this.app.screen.width / 2;
            const centerY = this.app.screen.height / 2;
            
            this.canvasContainer.position.set(0, 0);
            
            const initialX = centerX - CONFIG.canvas.width / 2;
            const initialY = centerY - CONFIG.canvas.height / 2;
            this.worldContainer.position.set(initialX, initialY);
            this.worldContainer.scale.set(CONFIG.camera.initialScale);
            
            this.initialState.position = { x: initialX, y: initialY };
        }
        
        resetCanvas() {
            this.worldContainer.position.set(
                this.initialState.position.x,
                this.initialState.position.y
            );
            this.worldContainer.scale.set(this.initialState.scale);
            this.worldContainer.rotation = 0;
            
            this.rotation = 0;
            this.horizontalFlipped = false;
            this.verticalFlipped = false;
            
            this.updateTransformDisplay();
        }
        
        setupEvents() {
            this.app.canvas.addEventListener('contextmenu', (e) => e.preventDefault());
            
            // === マウス操作 ===
            this.app.canvas.addEventListener('pointerdown', (e) => {
                if (this.vKeyPressed) return; // レイヤー操作中は無視
                
                if ((e.button === 2 || this.spacePressed) && !this.shiftPressed) {
                    // Space + ドラッグ: 移動
                    this.isDragging = true;
                    this.lastPoint = { x: e.clientX, y: e.clientY };
                    this.app.canvas.style.cursor = 'move';
                    e.preventDefault();
                } else if ((e.button === 2 || this.spacePressed) && this.shiftPressed) {
                    // Shift + Space + ドラッグ: 拡縮・回転
                    this.isScaleRotateDragging = true;
                    this.lastPoint = { x: e.clientX, y: e.clientY };
                    this.app.canvas.style.cursor = 'grab';
                    e.preventDefault();
                }
            });
            
            this.app.canvas.addEventListener('pointermove', (e) => {
                if (this.isDragging) {
                    // 移動
                    const dx = (e.clientX - this.lastPoint.x) * this.panSpeed;
                    const dy = (e.clientY - this.lastPoint.y) * this.panSpeed;
                    
                    this.worldContainer.x += dx;
                    this.worldContainer.y += dy;
                    
                    this.lastPoint = { x: e.clientX, y: e.clientY };
                    this.updateTransformDisplay();
                } else if (this.isScaleRotateDragging) {
                    // 拡縮・回転
                    const dx = e.clientX - this.lastPoint.x;
                    const dy = e.clientY - this.lastPoint.y;
                    
                    const centerX = CONFIG.canvas.width / 2;
                    const centerY = CONFIG.canvas.height / 2;
                    const worldCenter = this.worldContainer.toGlobal({ x: centerX, y: centerY });
                    
                    if (Math.abs(dx) > Math.abs(dy)) {
                        // 水平方向優先: 回転
                        this.rotation += (dx * CONFIG.camera.dragRotationSpeed);
                        this.worldContainer.rotation = (this.rotation * Math.PI) / 180;
                        
                        const newWorldCenter = this.worldContainer.toGlobal({ x: centerX, y: centerY });
                        this.worldContainer.x += worldCenter.x - newWorldCenter.x;
                        this.worldContainer.y += worldCenter.y - newWorldCenter.y;
                    } else {
                        // 垂直方向優先: 拡縮
                        const scaleFactor = 1 + (dy * CONFIG.camera.dragScaleSpeed);
                        const newScale = this.worldContainer.scale.x * scaleFactor;
                        
                        if (newScale >= CONFIG.camera.minScale && newScale <= CONFIG.camera.maxScale) {
                            this.worldContainer.scale.set(newScale);
                            const newWorldCenter = this.worldContainer.toGlobal({ x: centerX, y: centerY });
                            this.worldContainer.x += worldCenter.x - newWorldCenter.x;
                            this.worldContainer.y += worldCenter.y - newWorldCenter.y;
                        }
                    }
                    
                    this.lastPoint = { x: e.clientX, y: e.clientY };
                    this.updateTransformDisplay();
                }
            });
            
            this.app.canvas.addEventListener('pointerup', (e) => {
                if (this.isDragging && (e.button === 2 || this.spacePressed)) {
                    this.isDragging = false;
                    this.updateCursor();
                }
                if (this.isScaleRotateDragging && (e.button === 2 || this.spacePressed)) {
                    this.isScaleRotateDragging = false;
                    this.updateCursor();
                }
                
                if (e.button !== 0) return;
                if (this.drawingEngine) {
                    this.drawingEngine.stopDrawing();
                }
            });

            this.app.canvas.addEventListener('pointerenter', () => {
                this.updateCursor();
            });
            
            // === マウスホイール操作 ===
            this.app.canvas.addEventListener('wheel', (e) => {
                e.preventDefault();
                
                if (this.vKeyPressed) return; // レイヤー操作中は無視
                
                const centerX = CONFIG.canvas.width / 2;
                const centerY = CONFIG.canvas.height / 2;
                
                if (this.shiftPressed) {
                    // Shift + ホイール: 回転
                    const rotationDelta = e.deltaY < 0 ? 
                        CONFIG.camera.keyRotationDegree : -CONFIG.camera.keyRotationDegree;
                    
                    const worldCenter = this.worldContainer.toGlobal({ x: centerX, y: centerY });
                    
                    this.rotation += rotationDelta;
                    this.worldContainer.rotation = (this.rotation * Math.PI) / 180;
                    
                    const newWorldCenter = this.worldContainer.toGlobal({ x: centerX, y: centerY });
                    this.worldContainer.x += worldCenter.x - newWorldCenter.x;
                    this.worldContainer.y += worldCenter.y - newWorldCenter.y;
                } else {
                    // ホイール: 拡縮
                    const scaleFactor = e.deltaY < 0 ? 1 + this.zoomSpeed : 1 - this.zoomSpeed;
                    const newScale = this.worldContainer.scale.x * scaleFactor;
                    
                    if (newScale >= CONFIG.camera.minScale && newScale <= CONFIG.camera.maxScale) {
                        const worldCenter = this.worldContainer.toGlobal({ x: centerX, y: centerY });
                        
                        this.worldContainer.scale.set(newScale);
                        
                        const newWorldCenter = this.worldContainer.toGlobal({ x: centerX, y: centerY });
                        this.worldContainer.x += worldCenter.x - newWorldCenter.x;
                        this.worldContainer.y += worldCenter.y - newWorldCenter.y;
                    }
                }
                
                this.updateTransformDisplay();
            });
            
            // === キーボード操作 ===
            document.addEventListener('keydown', (e) => {
                // Ctrl+0: キャンバスリセット
                if (e.ctrlKey && e.code === 'Digit0') {
                    this.resetCanvas();
                    e.preventDefault();
                    return;
                }
                
                // キー状態更新
                if (e.code === 'Space') {
                    this.spacePressed = true;
                    this.updateCursor();
                    e.preventDefault();
                }
                if (e.shiftKey) this.shiftPressed = true;
                
                // 以下、レイヤー操作中（V押下中）は処理しない
                if (this.vKeyPressed) return;
                
                // === キャンバス移動: Space + 方向キー ===
                if (this.spacePressed && !this.shiftPressed && ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) {
                    const moveAmount = CONFIG.camera.keyMoveAmount;
                    switch(e.code) {
                        case 'ArrowDown':    this.worldContainer.y += moveAmount; break;
                        case 'ArrowUp':  this.worldContainer.y -= moveAmount; break;
                        case 'ArrowRight':  this.worldContainer.x += moveAmount; break;
                        case 'ArrowLeft': this.worldContainer.x -= moveAmount; break;
                    }
                    this.updateTransformDisplay();
                    e.preventDefault();
                }
                
                // === キャンバス拡縮・回転: Shift + Space + 方向キー ===
                if (this.spacePressed && this.shiftPressed && ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) {
                    const centerX = CONFIG.canvas.width / 2;
                    const centerY = CONFIG.canvas.height / 2;
                    const worldCenter = this.worldContainer.toGlobal({ x: centerX, y: centerY });
                    
                    switch(e.code) {
                        case 'ArrowUp':
                            const scaleUpFactor = 1 + CONFIG.camera.wheelZoomSpeed;
                            const newScaleUp = this.worldContainer.scale.x * scaleUpFactor;
                            if (newScaleUp <= CONFIG.camera.maxScale) {
                                this.worldContainer.scale.set(newScaleUp);
                                const newWorldCenterUp = this.worldContainer.toGlobal({ x: centerX, y: centerY });
                                this.worldContainer.x += worldCenter.x - newWorldCenterUp.x;
                                this.worldContainer.y += worldCenter.y - newWorldCenterUp.y;
                            }
                            break;
                            
                        case 'ArrowDown':
                            const scaleDownFactor = 1 - CONFIG.camera.wheelZoomSpeed;
                            const newScaleDown = this.worldContainer.scale.x * scaleDownFactor;
                            if (newScaleDown >= CONFIG.camera.minScale) {
                                this.worldContainer.scale.set(newScaleDown);
                                const newWorldCenterDown = this.worldContainer.toGlobal({ x: centerX, y: centerY });
                                this.worldContainer.x += worldCenter.x - newWorldCenterDown.x;
                                this.worldContainer.y += worldCenter.y - newWorldCenterDown.y;
                            }
                            break;
                            
                        case 'ArrowLeft':
                            this.rotation -= CONFIG.camera.keyRotationDegree;
                            this.worldContainer.rotation = (this.rotation * Math.PI) / 180;
                            const newWorldCenterLeft = this.worldContainer.toGlobal({ x: centerX, y: centerY });
                            this.worldContainer.x += worldCenter.x - newWorldCenterLeft.x;
                            this.worldContainer.y += worldCenter.y - newWorldCenterLeft.y;
                            break;
                            
                        case 'ArrowRight':
                            this.rotation += CONFIG.camera.keyRotationDegree;
                            this.worldContainer.rotation = (this.rotation * Math.PI) / 180;
                            const newWorldCenterRight = this.worldContainer.toGlobal({ x: centerX, y: centerY });
                            this.worldContainer.x += worldCenter.x - newWorldCenterRight.x;
                            this.worldContainer.y += worldCenter.y - newWorldCenterRight.y;
                            break;
                    }
                    
                    this.updateTransformDisplay();
                    e.preventDefault();
                }
                
                // === キャンバス反転: H / Shift+H（レイヤー操作中以外） ===
                if (!this.vKeyPressed && e.code === 'KeyH' && !e.ctrlKey && !e.altKey && !e.metaKey) {
                    const centerX = CONFIG.canvas.width / 2;
                    const centerY = CONFIG.canvas.height / 2;
                    const worldCenter = this.worldContainer.toGlobal({ x: centerX, y: centerY });
                    
                    if (e.shiftKey) {
                        // Shift+H: 垂直反転
                        this.verticalFlipped = !this.verticalFlipped;
                        this.worldContainer.scale.y *= -1;
                    } else {
                        // H: 水平反転
                        this.horizontalFlipped = !this.horizontalFlipped;
                        this.worldContainer.scale.x *= -1;
                    }
                    
                    const newWorldCenter = this.worldContainer.toGlobal({ x: centerX, y: centerY });
                    this.worldContainer.x += worldCenter.x - newWorldCenter.x;
                    this.worldContainer.y += worldCenter.y - newWorldCenter.y;
                    
                    this.updateTransformDisplay();
                    e.preventDefault();
                }
            });
            
            document.addEventListener('keyup', (e) => {
                if (e.code === 'Space') {
                    this.spacePressed = false;
                    this.updateCursor();
                }
                if (!e.shiftKey) this.shiftPressed = false;
            });
        }
        
        // レイヤー操作システムからの呼び出し用
        setVKeyPressed(pressed) {
            this.vKeyPressed = pressed;
        }

        switchTool(tool) {
            if (this.drawingEngine) {
                this.drawingEngine.setTool(tool);
            }
            
            // レイヤー移動モードを終了
            if (this.layerManager && this.layerManager.isLayerMoveMode) {
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
            if (this.layerManager && this.layerManager.vKeyPressed) {
                // レイヤー操作中はLayerManagerが制御
                return;
            }
            
            if (this.vKeyPressed) {
                // レイヤー操作中
                this.app.canvas.style.cursor = 'grab';
            } else if (this.isDragging || (this.spacePressed && !this.shiftPressed)) {
                this.app.canvas.style.cursor = 'move';
            } else if (this.isScaleRotateDragging || (this.spacePressed && this.shiftPressed)) {
                this.app.canvas.style.cursor = 'grab';
            } else {
                const tool = this.drawingEngine ? this.drawingEngine.currentTool : 'pen';
                this.app.canvas.style.cursor = tool === 'eraser' ? 'cell' : 'crosshair';
            }
        }
        
        // 改修版：ペン描画用のキャンバス座標変換（レイヤー変形を考慮しない）
        screenToCanvasForDrawing(screenX, screenY) {
            const globalPoint = { x: screenX, y: screenY };
            return this.canvasContainer.toLocal(globalPoint);
        }
        
        // レイヤー操作用の座標変換（レイヤー変形を考慮）
        screenToCanvas(screenX, screenY) {
            const globalPoint = { x: screenX, y: screenY };
            return this.canvasContainer.toLocal(globalPoint);
        }
        
        canvasToScreen(canvasX, canvasY) {
            const canvasPoint = { x: canvasX, y: canvasY };
            return this.canvasContainer.toGlobal(canvasPoint);
        }
        
        isPointInExtendedCanvas(canvasPoint, margin = 50) {
            return canvasPoint.x >= -margin && canvasPoint.x <= CONFIG.canvas.width + margin &&
                   canvasPoint.y >= -margin && canvasPoint.y <= CONFIG.canvas.height + margin;
        }

        updateCoordinates(x, y) {
            const element = document.getElementById('coordinates');
            if (element) {
                element.textContent = `x: ${Math.round(x)}, y: ${Math.round(y)}`;
            }
        }
        
        updateTransformDisplay() {
            const element = document.getElementById('transform-info');
            if (element) {
                const x = Math.round(this.worldContainer.x);
                const y = Math.round(this.worldContainer.y);
                const s = Math.abs(this.worldContainer.scale.x).toFixed(2);
                const r = Math.round(this.rotation % 360);
                element.textContent = `x:${x} y:${y} s:${s} r:${r}°`;
            }
        }
        
        drawCameraFrame() {
            this.cameraFrame.clear();
            this.cameraFrame.rect(0, 0, CONFIG.canvas.width, CONFIG.canvas.height);
            this.cameraFrame.stroke({ width: 2, color: 0xff0000, alpha: 0.5 });
        }

        // 修正：カメラフレーム中央の絶対座標を取得
        getCameraFrameCenter() {
            const centerX = CONFIG.canvas.width / 2;
            const centerY = CONFIG.canvas.height / 2;
            return this.worldContainer.toGlobal({ x: centerX, y: centerY });
        }
        
        // 内部参照設定用（CoreEngineから呼び出し）
        setLayerManager(layerManager) {
            this.layerManager = layerManager;
        }
        
        setDrawingEngine(drawingEngine) {
            this.drawingEngine = drawingEngine;
        }
    }

    // === レイヤー管理システム（修正版：GPT5改修案準拠の非破壊変形確定処理） ===
    class LayerManager {
        constructor(canvasContainer, app, cameraSystem) {
            this.canvasContainer = canvasContainer;
            this.app = app;
            this.cameraSystem = cameraSystem;
            this.layers = [];
            this.activeLayerIndex = -1;
            this.layerCounter = 0;
            this.thumbnailUpdateQueue = new Set();
            
            this.layersContainer = new PIXI.Container();
            this.layersContainer.label = 'layersContainer';
            this.canvasContainer.addChild(this.layersContainer);
            
            // レイヤー移動モード関連（修正版）
            this.vKeyPressed = false;
            this.isLayerMoveMode = false;
            this.isLayerDragging = false;
            this.layerDragLastPoint = { x: 0, y: 0 };
            
            // 修正：レイヤー変形データの保持
            this.layerTransforms = new Map(); // layerId -> { x, y, rotation, scaleX, scaleY }
            
            // UI要素
            this.layerTransformPanel = null;
            
            // 履歴管理システム追加
            this.historyManager = null;
            
            this.setupLayerOperations();
            this.setupLayerTransformPanel();
        }
        
        // 履歴管理システムの初期化（CoreEngineから呼び出し）
        initializeHistoryManager() {
            this.historyManager = new HistoryManager(this);
        }
        
        setupLayerTransformPanel() {
            this.layerTransformPanel = document.getElementById('layer-transform-panel');
            
            if (!this.layerTransformPanel) return;
            
            // スライダー設定
            this.setupLayerSlider('layer-x-slider', CONFIG.layer.minX, CONFIG.layer.maxX, 0, (value) => {
                this.updateActiveLayerTransform('x', value);
                return Math.round(value) + 'px';
            });
            
            this.setupLayerSlider('layer-y-slider', CONFIG.layer.minY, CONFIG.layer.maxY, 0, (value) => {
                this.updateActiveLayerTransform('y', value);
                return Math.round(value) + 'px';
            });
            
            this.setupLayerSlider('layer-rotation-slider', CONFIG.layer.minRotation, CONFIG.layer.maxRotation, 0, (value) => {
                this.updateActiveLayerTransform('rotation', value * Math.PI / 180);
                return Math.round(value) + '°';
            });
            
            this.setupLayerSlider('layer-scale-slider', CONFIG.layer.minScale, CONFIG.layer.maxScale, 1.0, (value) => {
                this.updateActiveLayerTransform('scale', value);
                return value.toFixed(2) + 'x';
            });
            
            // 反転ボタン
            const flipHorizontalBtn = document.getElementById('flip-horizontal-btn');
            const flipVerticalBtn = document.getElementById('flip-vertical-btn');
            
            if (flipHorizontalBtn) {
                flipHorizontalBtn.addEventListener('click', () => {
                    this.flipActiveLayer('horizontal');
                });
            }
            
            if (flipVerticalBtn) {
                flipVerticalBtn.addEventListener('click', () => {
                    this.flipActiveLayer('vertical');
                });
            }
        }
        
        setupLayerSlider(sliderId, min, max, initial, callback) {
            const container = document.getElementById(sliderId);
            if (!container) return;

            const track = container.querySelector('.slider-track');
            const handle = container.querySelector('.slider-handle');
            const valueDisplay = container.parentNode.querySelector('.slider-value');

            if (!track || !handle || !valueDisplay) return;

            let value = initial;
            let dragging = false;

            const update = (newValue, fromSlider = false) => {
                value = Math.max(min, Math.min(max, newValue));
                const percentage = ((value - min) / (max - min)) * 100;
                
                track.style.width = percentage + '%';
                handle.style.left = percentage + '%';
                valueDisplay.textContent = callback(value, fromSlider);
            };

            const getValue = (clientX) => {
                const rect = container.getBoundingClientRect();
                const percentage = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
                return min + (percentage * (max - min));
            };

            container.addEventListener('mousedown', (e) => {
                dragging = true;
                update(getValue(e.clientX), true);
                e.preventDefault();
            });

            document.addEventListener('mousemove', (e) => {
                if (dragging) update(getValue(e.clientX), true);
            });

            document.addEventListener('mouseup', () => {
                dragging = false;
            });

            // 外部からの値更新用
            container.updateValue = (newValue) => {
                update(newValue, false);
            };

            update(initial);
        }
        
        // 修正3: レイヤー変形データを保持して累積的に適用（カメラフレーム中央基準完全対応）
        updateActiveLayerTransform(property, value) {
            const activeLayer = this.getActiveLayer();
            if (!activeLayer) return;
            
            const layerId = activeLayer.layerData.id;
            
            // 変形データを取得または初期化
            if (!this.layerTransforms.has(layerId)) {
                this.layerTransforms.set(layerId, {
                    x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1
                });
            }
            
            const transform = this.layerTransforms.get(layerId);
            
            // 修正3: カメラフレーム中央を基準点として設定（動的計算）
            const centerX = CONFIG.canvas.width / 2;
            const centerY = CONFIG.canvas.height / 2;
            
            switch(property) {
                case 'x':
                    transform.x = value;
                    activeLayer.position.set(centerX + value, centerY + transform.y);
                    break;
                case 'y':
                    transform.y = value;
                    activeLayer.position.set(centerX + transform.x, centerY + value);
                    break;
                case 'rotation':
                    transform.rotation = value;
                    activeLayer.pivot.set(centerX, centerY);
                    activeLayer.position.set(centerX + transform.x, centerY + transform.y);
                    activeLayer.rotation = value;
                    break;
                case 'scale':
                    const hFlipped = transform.scaleX < 0;
                    const vFlipped = transform.scaleY < 0;
                    transform.scaleX = hFlipped ? -value : value;
                    transform.scaleY = vFlipped ? -value : value;
                    
                    activeLayer.pivot.set(centerX, centerY);
                    activeLayer.position.set(centerX + transform.x, centerY + transform.y);
                    activeLayer.scale.set(transform.scaleX, transform.scaleY);
                    break;
            }
            
            this.requestThumbnailUpdate(this.activeLayerIndex);
        }
        
        // 修正3: 反転時もカメラフレーム中央基準で座標を維持
        flipActiveLayer(direction) {
            const activeLayer = this.getActiveLayer();
            if (!activeLayer) return;
            
            const layerId = activeLayer.layerData.id;
            
            if (!this.layerTransforms.has(layerId)) {
                this.layerTransforms.set(layerId, {
                    x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1
                });
            }
            
            const transform = this.layerTransforms.get(layerId);
            
            // 修正3: カメラフレーム中央を動的に計算して基準点に設定
            const centerX = CONFIG.canvas.width / 2;
            const centerY = CONFIG.canvas.height / 2;
            
            activeLayer.pivot.set(centerX, centerY);
            activeLayer.position.set(centerX + transform.x, centerY + transform.y);
            
            if (direction === 'horizontal') {
                transform.scaleX *= -1;
                activeLayer.scale.x = transform.scaleX;
            } else if (direction === 'vertical') {
                transform.scaleY *= -1;
                activeLayer.scale.y = transform.scaleY;
            }
            
            this.updateFlipButtons();
            this.requestThumbnailUpdate(this.activeLayerIndex);
        }
        
        updateFlipButtons() {
            const activeLayer = this.getActiveLayer();
            if (!activeLayer) return;
            
            const flipHorizontalBtn = document.getElementById('flip-horizontal-btn');
            const flipVerticalBtn = document.getElementById('flip-vertical-btn');
            
            if (flipHorizontalBtn) {
                if (activeLayer.scale.x < 0) {
                    flipHorizontalBtn.classList.add('active');
                } else {
                    flipHorizontalBtn.classList.remove('active');
                }
            }
            
            if (flipVerticalBtn) {
                if (activeLayer.scale.y < 0) {
                    flipVerticalBtn.classList.add('active');
                } else {
                    flipVerticalBtn.classList.remove('active');
                }
            }
        }
        
        // 修正版：変形データから現在値を取得してスライダー更新（効果的変形状態対応）
        updateLayerTransformPanelValues() {
            const activeLayer = this.getActiveLayer();
            if (!activeLayer) return;
            
            // ✅ 修正版：効果的な変形状態を取得（表示状態考慮）
            const effectiveTransform = this.getEffectiveTransform(activeLayer);
            
            console.log('Updating panel with effective transform:', effectiveTransform);
            
            // X位置スライダー更新
            const xSlider = document.getElementById('layer-x-slider');
            if (xSlider && xSlider.updateValue) {
                xSlider.updateValue(effectiveTransform.x);
            }
            
            // Y位置スライダー更新
            const ySlider = document.getElementById('layer-y-slider');
            if (ySlider && ySlider.updateValue) {
                ySlider.updateValue(effectiveTransform.y);
            }
            
            // 回転スライダー更新
            const rotationSlider = document.getElementById('layer-rotation-slider');
            if (rotationSlider && rotationSlider.updateValue) {
                rotationSlider.updateValue(effectiveTransform.rotation * 180 / Math.PI);
            }
            
            // 拡縮スライダー更新
            const scaleSlider = document.getElementById('layer-scale-slider');
            if (scaleSlider && scaleSlider.updateValue) {
                scaleSlider.updateValue(Math.abs(effectiveTransform.scaleX));
            }
            
            this.updateFlipButtons();
        }
        
        // 改修版：Vキートグル方式でのレイヤー移動モード
        toggleLayerMoveMode() {
            if (this.isLayerMoveMode) {
                this.exitLayerMoveMode();
            } else {
                this.enterLayerMoveMode();
            }
        }
        
        enterLayerMoveMode() {
            if (this.isLayerMoveMode) return;
            
            this.isLayerMoveMode = true;
            this.vKeyPressed = true;
            this.cameraSystem.setVKeyPressed(true);
            
            // パネルとガイドライン表示
            if (this.layerTransformPanel) {
                this.layerTransformPanel.classList.add('show');
                this.updateLayerTransformPanelValues();
            }
            
            // 修正版：ガイドライン表示
            this.cameraSystem.showGuideLines();
            
            this.updateCursor();
        }
        
        // 改修版：V解除が確定（確定ボタン削除）
        exitLayerMoveMode() {
            if (!this.isLayerMoveMode) return;
            
            this.isLayerMoveMode = false;
            this.vKeyPressed = false;
            this.isLayerDragging = false;
            this.cameraSystem.setVKeyPressed(false);
            
            // パネルとガイドライン非表示
            if (this.layerTransformPanel) {
                this.layerTransformPanel.classList.remove('show');
            }
            
            // 修正版：ガイドライン非表示
            this.cameraSystem.hideGuideLines();
            
            this.updateCursor();
            
            // 改修版：V解除時に自動確定（レイヤー変形をベイク）
            this.confirmLayerTransform();
        }
        
        // === 【修正版】変形状態保持対応の確定処理 ===
        confirmLayerTransform() {
            const activeLayer = this.getActiveLayer();
            if (!activeLayer) return;
            
            const layerId = activeLayer.layerData.id;
            const currentTransform = this.layerTransforms.get(layerId);
            
            // レイヤーのtransformが初期状態でない場合のみ処理
            if (this.isTransformNonDefault(currentTransform) || this.isDisplayTransformNonDefault(activeLayer)) {
                try {
                    console.log('=== 変形状態保持対応：確定処理開始 ===');
                    console.log('Current transform:', currentTransform);
                    console.log('Display state:', {
                        position: { x: activeLayer.position.x, y: activeLayer.position.y },
                        rotation: activeLayer.rotation,
                        scale: { x: activeLayer.scale.x, y: activeLayer.scale.y }
                    });
                    
                    // ✅ 修正版：表示状態を変形データに保存
                    this.confirmTransformWithStatePreservation(activeLayer);
                    
                    // 履歴保存
                    if (this.historyManager) {
                        this.historyManager.saveState();
                    }
                    
                    console.log('=== 変形状態保持対応：確定処理完了 ===');
                    
                } catch (error) {
                    console.error('Transform confirmation error:', error);
                }
            } else {
                console.log('Transform already at default - no confirmation needed');
            }
        }
        
        // ✅ 修正版：表示状態を変形データに保存する確定処理
        confirmTransformWithStatePreservation(layer) {
            console.log('Transform confirmation with state preservation');
            
            const layerId = layer.layerData.id;
            
            try {
                // === 現在の表示状態を変形データに反映 ===
                const centerX = CONFIG.canvas.width / 2;
                const centerY = CONFIG.canvas.height / 2;
                
                // 現在の表示状態から変形データを計算
                const preservedTransform = {
                    x: layer.position.x - centerX,
                    y: layer.position.y - centerY,
                    rotation: layer.rotation,
                    scaleX: layer.scale.x,
                    scaleY: layer.scale.y
                };
                
                // ✅ 変形データに現在の表示状態を保存（リセットしない）
                this.layerTransforms.set(layerId, preservedTransform);
                
                console.log('Transform state preserved:', preservedTransform);
                
                // 反転ボタン状態を更新
                this.updateFlipButtons();
                
                // サムネイル更新
                this.requestThumbnailUpdate(this.activeLayerIndex);
                
                console.log('State preservation completed');
                
            } catch (error) {
                console.error('State preservation failed:', error);
                throw error;
            }
        }
        
        // ✅ 新規：表示状態が初期状態以外かチェック
        isDisplayTransformNonDefault(layer) {
            const centerX = CONFIG.canvas.width / 2;
            const centerY = CONFIG.canvas.height / 2;
            
            return (Math.abs(layer.position.x - centerX) > 0.1 ||
                    Math.abs(layer.position.y - centerY) > 0.1 ||
                    Math.abs(layer.rotation) > 0.001 ||
                    Math.abs(Math.abs(layer.scale.x) - 1) > 0.001 ||
                    Math.abs(Math.abs(layer.scale.y) - 1) > 0.001);
        }
        
        // ✅ 新規：効果的な変形状態を取得（表示状態 + 編集中変形の合成）
        getEffectiveTransform(layer) {
            const layerId = layer.layerData.id;
            const storedTransform = this.layerTransforms.get(layerId) || {
                x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1
            };
            
            // 現在の表示状態を考慮した実効変形を返す
            // （編集中は表示状態、確定済みは保存済み変形データ）
            if (this.isLayerMoveMode && this.activeLayerIndex === this.layers.indexOf(layer)) {
                // 編集中は表示状態を返す
                const centerX = CONFIG.canvas.width / 2;
                const centerY = CONFIG.canvas.height / 2;
                return {
                    x: layer.position.x - centerX,
                    y: layer.position.y - centerY,
                    rotation: layer.rotation,
                    scaleX: layer.scale.x,
                    scaleY: layer.scale.y
                };
            } else {
                // 確定済みは保存データを返す
                return storedTransform;
            }
        }
        
        // 変形が初期状態以外かチェック
        isTransformNonDefault(transform) {
            if (!transform) return false;
            return (transform.x !== 0 || transform.y !== 0 || 
                    transform.rotation !== 0 || Math.abs(transform.scaleX) !== 1 || Math.abs(transform.scaleY) !== 1);
        }
        
        setupLayerOperations() {
            document.addEventListener('keydown', (e) => {
                // 改修版：Vキートグル方式
                if (e.code === 'KeyV' && !e.ctrlKey && !e.altKey && !e.metaKey) {
                    this.toggleLayerMoveMode();
                    e.preventDefault();
                }
                
                // Pキー: ペンツールに切り替え（レイヤー移動モード終了）
                if (e.code === 'KeyP' && !e.ctrlKey && !e.altKey && !e.metaKey) {
                    if (this.isLayerMoveMode) {
                        this.exitLayerMoveMode();
                    }
                    e.preventDefault();
                }
                
                // Eキー: 消しゴムツールに切り替え（レイヤー移動モード終了）
                if (e.code === 'KeyE' && !e.ctrlKey && !e.altKey && !e.metaKey) {
                    if (this.isLayerMoveMode) {
                        this.exitLayerMoveMode();
                    }
                    e.preventDefault();
                }
                
                // === V + 方向キー: アクティブレイヤー移動 ===
                if (this.vKeyPressed && !e.shiftKey && ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) {
                    this.moveActiveLayer(e.code);
                    e.preventDefault();
                }
                
                // === V + Shift + 方向キー: アクティブレイヤー拡縮・回転 ===
                if (this.vKeyPressed && e.shiftKey && ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) {
                    this.transformActiveLayer(e.code);
                    e.preventDefault();
                }
                
                // === V + H / V + Shift + H: アクティブレイヤー反転 ===
                if (this.vKeyPressed && e.code === 'KeyH' && !e.ctrlKey && !e.altKey && !e.metaKey) {
                    if (e.shiftKey) {
                        // V + Shift + H: 垂直反転
                        this.flipActiveLayer('vertical');
                    } else {
                        // V + H: 水平反転
                        this.flipActiveLayer('horizontal');
                    }
                    e.preventDefault();
                }
            });
            
            // === V + ドラッグ: アクティブレイヤー移動・変形 ===
            this.app.canvas.addEventListener('pointerdown', (e) => {
                if (this.vKeyPressed && e.button === 0) {
                    this.isLayerDragging = true;
                    this.layerDragLastPoint = { x: e.clientX, y: e.clientY };
                    this.app.canvas.style.cursor = 'move';
                    e.preventDefault();
                }
            });
            
            this.app.canvas.addEventListener('pointermove', (e) => {
                if (this.isLayerDragging && this.vKeyPressed) {
                    const activeLayer = this.getActiveLayer();
                    if (activeLayer) {
                        const dx = e.clientX - this.layerDragLastPoint.x;
                        const dy = e.clientY - this.layerDragLastPoint.y;
                        
                        const worldScale = this.cameraSystem.worldContainer.scale.x;
                        const adjustedDx = dx / worldScale;
                        const adjustedDy = dy / worldScale;
                        
                        const layerId = activeLayer.layerData.id;
                        
                        if (!this.layerTransforms.has(layerId)) {
                            this.layerTransforms.set(layerId, {
                                x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1
                            });
                        }
                        
                        const transform = this.layerTransforms.get(layerId);
                        
                        if (e.shiftKey) {
                            // 修正4: V + Shift + ドラッグの操作方向修正（直感的に変更）
                            const centerX = CONFIG.canvas.width / 2;
                            const centerY = CONFIG.canvas.height / 2;
                            
                            // 基準点をカメラ中央に設定
                            activeLayer.pivot.set(centerX, centerY);
                            activeLayer.position.set(centerX + transform.x, centerY + transform.y);
                            
                            if (Math.abs(dy) > Math.abs(dx)) {
                                // 垂直方向優先: 拡縮（修正4: 上ドラッグ→拡大、下ドラッグ→縮小）
                                const scaleFactor = 1 + (dy * -0.01); // 修正4: 方向を逆転（-0.01）
                                const currentScale = Math.abs(transform.scaleX);
                                const newScale = Math.max(CONFIG.layer.minScale, Math.min(CONFIG.layer.maxScale, currentScale * scaleFactor));
                                
                                transform.scaleX = transform.scaleX < 0 ? -newScale : newScale;
                                transform.scaleY = transform.scaleY < 0 ? -newScale : newScale;
                                activeLayer.scale.set(transform.scaleX, transform.scaleY);
                                
                                // スライダー更新
                                const scaleSlider = document.getElementById('layer-scale-slider');
                                if (scaleSlider && scaleSlider.updateValue) {
                                    scaleSlider.updateValue(newScale);
                                }
                            } else {
                                // 水平方向優先: 回転（修正4: 右ドラッグ→右回転、左ドラッグ→左回転）
                                transform.rotation += (dx * 0.02); // 修正4: dxを使用（正の方向）
                                activeLayer.rotation = transform.rotation;
                                
                                // スライダー更新
                                const rotationSlider = document.getElementById('layer-rotation-slider');
                                if (rotationSlider && rotationSlider.updateValue) {
                                    rotationSlider.updateValue(transform.rotation * 180 / Math.PI);
                                }
                            }
                        } else {
                            // V + ドラッグ: 移動（座標累積）
                            transform.x += adjustedDx;
                            transform.y += adjustedDy;
                            
                            // 位置を更新
                            const centerX = CONFIG.canvas.width / 2;
                            const centerY = CONFIG.canvas.height / 2;
                            activeLayer.position.set(centerX + transform.x, centerY + transform.y);
                            
                            // スライダー更新
                            const xSlider = document.getElementById('layer-x-slider');
                            const ySlider = document.getElementById('layer-y-slider');
                            if (xSlider && xSlider.updateValue) {
                                xSlider.updateValue(transform.x);
                            }
                            if (ySlider && ySlider.updateValue) {
                                ySlider.updateValue(transform.y);
                            }
                        }
                        
                        this.layerDragLastPoint = { x: e.clientX, y: e.clientY };
                        this.requestThumbnailUpdate(this.activeLayerIndex);
                    }
                }
            });
            
            this.app.canvas.addEventListener('pointerup', (e) => {
                if (this.isLayerDragging) {
                    this.isLayerDragging = false;
                    this.updateCursor();
                }
            });
        }
        
        // 修正版：キーボードによる移動（座標累積）
        moveActiveLayer(keyCode) {
            const activeLayer = this.getActiveLayer();
            if (!activeLayer) return;
            
            const layerId = activeLayer.layerData.id;
            
            if (!this.layerTransforms.has(layerId)) {
                this.layerTransforms.set(layerId, {
                    x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1
                });
            }
            
            const transform = this.layerTransforms.get(layerId);
            const moveAmount = 5;
            
            switch(keyCode) {
                case 'ArrowUp':    transform.y -= moveAmount; break;
                case 'ArrowDown':  transform.y += moveAmount; break;
                case 'ArrowLeft':  transform.x -= moveAmount; break;
                case 'ArrowRight': transform.x += moveAmount; break;
            }
            
            // 位置を更新
            const centerX = CONFIG.canvas.width / 2;
            const centerY = CONFIG.canvas.height / 2;
            activeLayer.position.set(centerX + transform.x, centerY + transform.y);
            
            // スライダー値更新
            const xSlider = document.getElementById('layer-x-slider');
            const ySlider = document.getElementById('layer-y-slider');
            if (xSlider && xSlider.updateValue) {
                xSlider.updateValue(transform.x);
            }
            if (ySlider && ySlider.updateValue) {
                ySlider.updateValue(transform.y);
            }
            
            this.requestThumbnailUpdate(this.activeLayerIndex);
        }
        
        // 修正3: キーボードによる変形（カメラフレーム中央基準で座標維持）
        transformActiveLayer(keyCode) {
            const activeLayer = this.getActiveLayer();
            if (!activeLayer) return;
            
            const layerId = activeLayer.layerData.id;
            
            if (!this.layerTransforms.has(layerId)) {
                this.layerTransforms.set(layerId, {
                    x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1
                });
            }
            
            const transform = this.layerTransforms.get(layerId);
            
            // 修正3: カメラフレーム中央を動的に計算
            const centerX = CONFIG.canvas.width / 2;
            const centerY = CONFIG.canvas.height / 2;
            
            // 基準点とポジションを設定
            activeLayer.pivot.set(centerX, centerY);
            activeLayer.position.set(centerX + transform.x, centerY + transform.y);
            
            switch(keyCode) {
                case 'ArrowUp': // 拡大
                    const scaleUpFactor = 1.1;
                    const currentScaleUp = Math.abs(transform.scaleX);
                    const newScaleUp = Math.min(CONFIG.layer.maxScale, currentScaleUp * scaleUpFactor);
                    transform.scaleX = transform.scaleX < 0 ? -newScaleUp : newScaleUp;
                    transform.scaleY = transform.scaleY < 0 ? -newScaleUp : newScaleUp;
                    activeLayer.scale.set(transform.scaleX, transform.scaleY);
                    
                    // スライダー更新
                    const scaleSliderUp = document.getElementById('layer-scale-slider');
                    if (scaleSliderUp && scaleSliderUp.updateValue) {
                        scaleSliderUp.updateValue(newScaleUp);
                    }
                    break;
                    
                case 'ArrowDown': // 縮小
                    const scaleDownFactor = 0.9;
                    const currentScaleDown = Math.abs(transform.scaleX);
                    const newScaleDown = Math.max(CONFIG.layer.minScale, currentScaleDown * scaleDownFactor);
                    transform.scaleX = transform.scaleX < 0 ? -newScaleDown : newScaleDown;
                    transform.scaleY = transform.scaleY < 0 ? -newScaleDown : newScaleDown;
                    activeLayer.scale.set(transform.scaleX, transform.scaleY);
                    
                    // スライダー更新
                    const scaleSliderDown = document.getElementById('layer-scale-slider');
                    if (scaleSliderDown && scaleSliderDown.updateValue) {
                        scaleSliderDown.updateValue(newScaleDown);
                    }
                    break;
                    
                case 'ArrowLeft': // 左回転
                    transform.rotation -= (15 * Math.PI) / 180; // 15度
                    activeLayer.rotation = transform.rotation;
                    
                    // スライダー更新
                    const rotationSliderLeft = document.getElementById('layer-rotation-slider');
                    if (rotationSliderLeft && rotationSliderLeft.updateValue) {
                        rotationSliderLeft.updateValue(transform.rotation * 180 / Math.PI);
                    }
                    break;
                    
                case 'ArrowRight': // 右回転
                    transform.rotation += (15 * Math.PI) / 180; // 15度
                    activeLayer.rotation = transform.rotation;
                    
                    // スライダー更新
                    const rotationSliderRight = document.getElementById('layer-rotation-slider');
                    if (rotationSliderRight && rotationSliderRight.updateValue) {
                        rotationSliderRight.updateValue(transform.rotation * 180 / Math.PI);
                    }
                    break;
            }
            
            this.requestThumbnailUpdate(this.activeLayerIndex);
        }
        
        updateCursor() {
            if (this.vKeyPressed) {
                this.app.canvas.style.cursor = 'grab';
            }
        }

        createLayer(name, isBackground = false) {
            const layer = new PIXI.Container();
            const layerId = `layer_${this.layerCounter++}`;
            
            layer.label = layerId;
            layer.layerData = {
                id: layerId,
                name: name,
                visible: true,
                opacity: 1.0,
                isBackground: isBackground,
                paths: []
            };

            // 変形データを初期化
            this.layerTransforms.set(layerId, {
                x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1
            });

            if (isBackground) {
                const bg = new PIXI.Graphics();
                bg.rect(0, 0, CONFIG.canvas.width, CONFIG.canvas.height);
                bg.fill(CONFIG.background.color);
                layer.addChild(bg);
                layer.layerData.backgroundGraphics = bg;
            }

            this.layers.push(layer);
            this.layersContainer.addChild(layer);
            return { layer, index: this.layers.length - 1 };
        }

        setActiveLayer(index) {
            if (index >= 0 && index < this.layers.length) {
                this.activeLayerIndex = index;
                this.updateLayerPanelUI();
                this.updateStatusDisplay();
                
                // レイヤー移動モードが有効な場合、スライダー値を更新
                if (this.isLayerMoveMode) {
                    this.updateLayerTransformPanelValues();
                }
            }
        }

        getActiveLayer() {
            return this.activeLayerIndex >= 0 ? this.layers[this.activeLayerIndex] : null;
        }

        addPathToLayer(layerIndex, path) {
            if (layerIndex >= 0 && layerIndex < this.layers.length) {
                const layer = this.layers[layerIndex];
                layer.layerData.paths.push(path);
                layer.addChild(path.graphics);
                this.requestThumbnailUpdate(layerIndex);
                
                // 履歴保存
                if (this.historyManager) {
                    this.historyManager.saveState();
                }
            }
        }

        requestThumbnailUpdate(layerIndex) {
            this.thumbnailUpdateQueue.add(layerIndex);
        }

        processThumbnailUpdates() {
            if (!this.app?.renderer || this.thumbnailUpdateQueue.size === 0) return;

            this.thumbnailUpdateQueue.forEach(layerIndex => {
                this.updateThumbnail(layerIndex);
            });
            this.thumbnailUpdateQueue.clear();
        }

        // 修正1: レイヤー変形を考慮したサムネイル生成・完全アスペクト比対応・パネルはみ出し対策
        updateThumbnail(layerIndex) {
            if (!this.app?.renderer || layerIndex < 0 || layerIndex >= this.layers.length) return;

            const layer = this.layers[layerIndex];
            const layerItems = document.querySelectorAll('.layer-item');
            const panelIndex = this.layers.length - 1 - layerIndex;
            
            if (panelIndex < 0 || panelIndex >= layerItems.length) return;
            
            const thumbnail = layerItems[panelIndex].querySelector('.layer-thumbnail');
            if (!thumbnail) return;

            try {
                // 修正1: 完全アスペクト比対応版（パネルはみ出し対策強化）
                const canvasAspectRatio = CONFIG.canvas.width / CONFIG.canvas.height;
                let thumbnailWidth, thumbnailHeight;
                const maxHeight = 48;
                const maxWidth = 72; // パネル幅制限

                if (canvasAspectRatio >= 1) {
                    // 横長または正方形の場合
                    // 横幅制限を優先し、縦を比例縮小
                    if (maxHeight * canvasAspectRatio <= maxWidth) {
                        thumbnailWidth = maxHeight * canvasAspectRatio;
                        thumbnailHeight = maxHeight;
                    } else {
                        // 修正1: 横長過ぎる場合は横幅制限を優先して縦を縮小
                        thumbnailWidth = maxWidth;
                        thumbnailHeight = maxWidth / canvasAspectRatio;
                    }
                } else {
                    // 縦長の場合
                    thumbnailWidth = Math.max(24, maxHeight * canvasAspectRatio);
                    thumbnailHeight = maxHeight;
                }
                
                // 修正1: サムネイル枠のサイズを動的に更新
                thumbnail.style.width = Math.round(thumbnailWidth) + 'px';
                thumbnail.style.height = Math.round(thumbnailHeight) + 'px';
                
                console.log(`Thumbnail updated: ${Math.round(thumbnailWidth)}x${Math.round(thumbnailHeight)} (aspect: ${canvasAspectRatio.toFixed(2)})`);
                
                // レンダリング用の高解像度テクスチャ作成
                const renderTexture = PIXI.RenderTexture.create({
                    width: CONFIG.canvas.width * CONFIG.thumbnail.RENDER_SCALE,
                    height: CONFIG.canvas.height * CONFIG.thumbnail.RENDER_SCALE,
                    resolution: CONFIG.thumbnail.RENDER_SCALE
                });
                
                // 修正版：レイヤーの現在の変形状態を保持してサムネイル生成
                const layerId = layer.layerData.id;
                const transform = this.layerTransforms.get(layerId);
                
                // 一時的なコンテナを作成してレイヤーをコピー
                const tempContainer = new PIXI.Container();
                
                // レイヤーの現在の変形状態を保存
                const originalPos = { x: layer.position.x, y: layer.position.y };
                const originalScale = { x: layer.scale.x, y: layer.scale.y };
                const originalRotation = layer.rotation;
                const originalPivot = { x: layer.pivot.x, y: layer.pivot.y };
                
                // サムネイル用の変形をリセット
                layer.position.set(0, 0);
                layer.scale.set(1, 1);
                layer.rotation = 0;
                layer.pivot.set(0, 0);
                
                tempContainer.addChild(layer);
                tempContainer.scale.set(CONFIG.thumbnail.RENDER_SCALE);
                
                // レンダリング実行
                this.app.renderer.render(tempContainer, { renderTexture });
                
                // レイヤーの変形状態を復元
                layer.position.set(originalPos.x, originalPos.y);
                layer.scale.set(originalScale.x, originalScale.y);
                layer.rotation = originalRotation;
                layer.pivot.set(originalPivot.x, originalPivot.y);
                
                // レイヤーを元のコンテナに戻す
                tempContainer.removeChild(layer);
                this.layersContainer.addChildAt(layer, layerIndex);
                
                // Canvas APIで高品質ダウンスケール
                const sourceCanvas = this.app.renderer.extract.canvas(renderTexture);
                const targetCanvas = document.createElement('canvas');
                targetCanvas.width = Math.round(thumbnailWidth);
                targetCanvas.height = Math.round(thumbnailHeight);
                
                const ctx = targetCanvas.getContext('2d');
                ctx.imageSmoothingEnabled = true;
                ctx.imageSmoothingQuality = CONFIG.thumbnail.QUALITY;
                ctx.drawImage(sourceCanvas, 0, 0, Math.round(thumbnailWidth), Math.round(thumbnailHeight));
                
                // UI更新
                let img = thumbnail.querySelector('img');
                if (!img) {
                    img = document.createElement('img');
                    thumbnail.innerHTML = '';
                    thumbnail.appendChild(img);
                }
                img.src = targetCanvas.toDataURL();
                img.style.width = '100%';
                img.style.height = '100%';
                img.style.objectFit = 'cover';
                
                // リソース解放
                renderTexture.destroy();
                tempContainer.destroy();
                
            } catch (error) {
                console.warn('Thumbnail update failed:', error);
            }
        }

        updateLayerPanelUI() {
            const layerList = document.getElementById('layer-list');
            if (!layerList) return;

            layerList.innerHTML = '';

            for (let i = this.layers.length - 1; i >= 0; i--) {
                const layer = this.layers[i];
                const layerItem = document.createElement('div');
                layerItem.className = `layer-item ${i === this.activeLayerIndex ? 'active' : ''}`;
                layerItem.dataset.layerId = layer.layerData.id;
                layerItem.dataset.layerIndex = i;

                layerItem.innerHTML = `
                    <div class="layer-visibility ${layer.layerData.visible ? '' : 'hidden'}">
                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            ${layer.layerData.visible ? 
                                '<path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/>' :
                                '<path d="m15 18-.722-3.25"/><path d="m2 2 20 20"/><path d="M6.71 6.71C3.4 8.27 2 12 2 12s3 7 10 7c1.59 0 2.84-.3 3.79-.73"/><path d="m8.5 10.5 7 7"/><path d="M9.677 4.677C10.495 4.06 11.608 4 12 4c7 0 10 7 10 7a13.16 13.16 0 0 1-.64.77"/>'}
                        </svg>
                    </div>
                    <div class="layer-opacity">100%</div>
                    <div class="layer-name">${layer.layerData.name}</div>
                    <div class="layer-thumbnail">
                        <div class="layer-thumbnail-placeholder"></div>
                    </div>
                    <div class="layer-delete-button">
                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <path d="m18 6-12 12"/><path d="m6 6 12 12"/>
                        </svg>
                    </div>
                `;

                layerItem.addEventListener('click', (e) => {
                    const target = e.target.closest('[class*="layer-"]');
                    if (target) {
                        const action = target.className;
                        if (action.includes('layer-visibility')) {
                            this.toggleLayerVisibility(i);
                            e.stopPropagation();
                        } else if (action.includes('layer-delete')) {
                            this.deleteLayer(i);
                            e.stopPropagation();
                        } else {
                            this.setActiveLayer(i);
                        }
                    } else {
                        this.setActiveLayer(i);
                    }
                });

                layerList.appendChild(layerItem);
            }
            
            for (let i = 0; i < this.layers.length; i++) {
                this.requestThumbnailUpdate(i);
            }
        }

        toggleLayerVisibility(layerIndex) {
            if (layerIndex >= 0 && layerIndex < this.layers.length) {
                const layer = this.layers[layerIndex];
                layer.layerData.visible = !layer.layerData.visible;
                layer.visible = layer.layerData.visible;
                this.updateLayerPanelUI();
                
                // 履歴保存
                if (this.historyManager) {
                    this.historyManager.saveState();
                }
            }
        }

        deleteLayer(layerIndex) {
            if (this.layers.length <= 1) return;
            if (layerIndex < 0 || layerIndex >= this.layers.length) return;

            const layer = this.layers[layerIndex];
            const layerId = layer.layerData.id;
            
            layer.layerData.paths.forEach(path => {
                if (path.graphics && path.graphics.destroy) {
                    path.graphics.destroy();
                }
            });

            // 変形データも削除
            this.layerTransforms.delete(layerId);

            this.layersContainer.removeChild(layer);
            layer.destroy();
            this.layers.splice(layerIndex, 1);

            if (this.activeLayerIndex === layerIndex) {
                this.activeLayerIndex = Math.min(this.activeLayerIndex, this.layers.length - 1);
            } else if (this.activeLayerIndex > layerIndex) {
                this.activeLayerIndex--;
            }

            this.updateLayerPanelUI();
            this.updateStatusDisplay();
            
            // 履歴保存
            if (this.historyManager) {
                this.historyManager.saveState();
            }
        }

        updateStatusDisplay() {
            const statusElement = document.getElementById('current-layer');
            if (statusElement && this.activeLayerIndex >= 0) {
                const layer = this.layers[this.activeLayerIndex];
                statusElement.textContent = layer.layerData.name;
            }
        }
        
        // Graphics再生成（安全版）
        rebuildPathGraphics(path) {
            try {
                // 既存Graphics削除
                if (path.graphics) {
                    try {
                        if (path.graphics.destroy && typeof path.graphics.destroy === 'function') {
                            path.graphics.destroy();
                        }
                    } catch (destroyError) {
                        console.warn('Graphics destroy failed:', destroyError);
                    }
                    path.graphics = null;
                }
                
                // 新しいGraphics作成
                path.graphics = new PIXI.Graphics();
                
                // パスの点から描画を再構築
                if (path.points && Array.isArray(path.points) && path.points.length > 0) {
                    for (let point of path.points) {
                        if (typeof point.x === 'number' && typeof point.y === 'number' &&
                            isFinite(point.x) && isFinite(point.y)) {
                            
                            path.graphics.circle(point.x, point.y, (path.size || 16) / 2);
                            path.graphics.fill({ 
                                color: path.color || 0x800000, 
                                alpha: path.opacity || 1.0 
                            });
                        }
                    }
                }
                
                return true;
                
            } catch (error) {
                console.error('Error in rebuildPathGraphics:', error);
                path.graphics = null;
                return false;
            }
        }
    }

    // === 描画エンジン（改修版：ペン描画位置ズレ対策） ===
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

            // 改修版：レイヤー変形を考慮しないキャンバス座標変換を使用
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
                
                // 履歴保存
                if (this.layerManager.historyManager) {
                    this.layerManager.historyManager.saveState();
                }
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

    // === 統合コアエンジンクラス ===
    class CoreEngine {
        constructor(app) {
            this.app = app;
            
            // コア機能を初期化
            this.cameraSystem = new CameraSystem(app);
            this.layerManager = new LayerManager(this.cameraSystem.canvasContainer, app, this.cameraSystem);
            this.drawingEngine = new DrawingEngine(this.cameraSystem, this.layerManager);
            this.clipboardSystem = new ClipboardSystem();
            
            // 相互参照を設定
            this.setupCrossReferences();
        }
        
        setupCrossReferences() {
            // CameraSystemに参照を設定
            this.cameraSystem.setLayerManager(this.layerManager);
            this.cameraSystem.setDrawingEngine(this.drawingEngine);
            
            // ClipboardSystemに参照を設定
            this.clipboardSystem.setLayerManager(this.layerManager);
        }
        
        // === 公開API（main.jsから使用） ===
        getCameraSystem() {
            return this.cameraSystem;
        }
        
        getLayerManager() {
            return this.layerManager;
        }
        
        getDrawingEngine() {
            return this.drawingEngine;
        }
        
        getClipboardSystem() {
            return this.clipboardSystem;
        }
        
        // === 統合インタラクション処理 ===
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
            
            // ツール切り替えキー
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
        
        switchTool(tool) {
            this.cameraSystem.switchTool(tool);
        }
        
        updateCoordinates(x, y) {
            this.cameraSystem.updateCoordinates(x, y);
        }
        
        // サムネイル更新処理
        processThumbnailUpdates() {
            this.layerManager.processThumbnailUpdates();
        }
        
        // キャンバスリサイズ統合処理
        resizeCanvas(newWidth, newHeight) {
            console.log('CoreEngine: Canvas resize request received:', newWidth, 'x', newHeight);
            
            // CONFIG更新
            CONFIG.canvas.width = newWidth;
            CONFIG.canvas.height = newHeight;
            
            // CameraSystemの更新
            this.cameraSystem.resizeCanvas(newWidth, newHeight);
            
            // LayerManagerの背景レイヤー更新
            this.layerManager.layers.forEach(layer => {
                if (layer.layerData.isBackground && layer.layerData.backgroundGraphics) {
                    layer.layerData.backgroundGraphics.clear();
                    layer.layerData.backgroundGraphics.rect(0, 0, newWidth, newHeight);
                    layer.layerData.backgroundGraphics.fill(CONFIG.background.color);
                }
            });
            
            // 全レイヤーのサムネイル更新
            for (let i = 0; i < this.layerManager.layers.length; i++) {
                this.layerManager.requestThumbnailUpdate(i);
            }
            
            console.log('CoreEngine: Canvas resize completed');
        }
        
        // 初期化処理
        initialize() {
            // 初期レイヤー作成
            this.layerManager.createLayer('背景', true);
            this.layerManager.createLayer('レイヤー1');
            this.layerManager.setActiveLayer(1);
            
            // 履歴管理システム初期化
            this.layerManager.initializeHistoryManager();
            
            this.layerManager.updateLayerPanelUI();
            this.layerManager.updateStatusDisplay();
            
            // UI初期化（SortableJS）
            if (window.TegakiUI && window.TegakiUI.initializeSortable) {
                window.TegakiUI.initializeSortable(this.layerManager);
            }
            
            // キャンバスイベント設定
            this.setupCanvasEvents();
            
            // サムネイル更新ループ
            this.app.ticker.add(() => {
                this.processThumbnailUpdates();
            });
            
            console.log('✅ CoreEngine initialized successfully with History Manager');
            return this;
        }
    }

    // === グローバル公開 ===
    window.TegakiCore = {
        CoreEngine: CoreEngine,
        
        // 個別クラスも公開（必要に応じて）
        CameraSystem: CameraSystem,
        LayerManager: LayerManager,
        DrawingEngine: DrawingEngine,
        ClipboardSystem: ClipboardSystem,
        HistoryManager: HistoryManager
    };

})();