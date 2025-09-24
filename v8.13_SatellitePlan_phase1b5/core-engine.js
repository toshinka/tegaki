// ===== core-engine.js - 最小互換ラッパー版（Phase2分離完了後） =====
// LayerSystem & CameraSystem分離完了・互換性維持のための最小ラッパー
// 将来的にはDrawingEngineとClipboardSystemも分離予定

/*
=== 互換ラッパー版ヘッダー ===

【分離済み】
✅ LayerManager → LayerSystem（layer-system.js）
✅ CameraSystem → CameraSystem（camera-system.js）

【残存システム】
- DrawingEngine: 描画制御（将来分離予定）
- ClipboardSystem: コピー&ペースト（将来分離予定）

【責務】
- 既存コードとの互換性維持
- DrawingEngine・ClipboardSystemの管理
- CoreRuntimeとの統合ブリッジ

【移行完了後の削除予定】
このファイルは段階的移行完了後に削除され、
全ての機能がCoreRuntime経由でアクセスされるようになる予定

=== 互換ラッパー版ヘッダー終了 ===
*/

(function() {
    'use strict';
    
    // === 設定確認 ===
    const CONFIG = window.TEGAKI_CONFIG;
    if (!CONFIG) {
        throw new Error('TEGAKI_CONFIG is required');
    }
    
    const debug = (message, ...args) => {
        if (CONFIG.debug) {
            console.log(`[CoreEngine-Compat] ${message}`, ...args);
        }
    };

    // === ClipboardSystem（分離予定・暫定保持） ===
    class ClipboardSystem {
        constructor() {
            this.clipboardData = null;
            this.setupKeyboardEvents();
        }

        setupKeyboardEvents() {
            document.addEventListener('keydown', (e) => {
                if (e.ctrlKey && e.code === 'KeyC' && !e.altKey && !e.metaKey) {
                    this.copyActiveLayer();
                    e.preventDefault();
                }
                
                if (e.ctrlKey && e.code === 'KeyV' && !e.altKey && !e.metaKey) {
                    this.pasteLayer();
                    e.preventDefault();
                }
            });
        }

        copyActiveLayer() {
            // LayerSystemから取得
            const layerSystem = window.CoreRuntime?.getLayerSystem();
            if (!layerSystem) {
                console.warn('LayerSystem not available for copy');
                return;
            }

            const activeLayer = layerSystem.getActiveLayer();
            if (!activeLayer) {
                console.warn('No active layer to copy');
                return;
            }

            try {
                debug('Copying active layer');
                
                const layerState = activeLayer.layerState;
                
                // レイヤーデータの完全コピー
                this.clipboardData = {
                    layerData: {
                        name: layerState.name.includes('_copy') ? 
                              layerState.name : layerState.name + '_copy',
                        visible: layerState.visible,
                        alpha: layerState.alpha,
                        paths: this.deepCopyPaths(layerState.paths),
                        isBackground: layerState.isBackground
                    },
                    transform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 },
                    timestamp: Date.now()
                };

                debug(`Layer copied: ${layerState.paths.length} paths`);
                
            } catch (error) {
                console.error('Failed to copy layer:', error);
            }
        }

        pasteLayer() {
            const layerSystem = window.CoreRuntime?.getLayerSystem();
            if (!layerSystem || !this.clipboardData) {
                console.warn('Cannot paste - LayerSystem or clipboard data not available');
                return;
            }

            try {
                debug('Pasting layer');
                
                const clipData = this.clipboardData;
                const uniqueName = this.generateUniqueLayerName(clipData.layerData.name, layerSystem);

                // 新しいレイヤーを作成
                const { layerId } = layerSystem.createLayer(uniqueName, false);

                // パスデータを復元
                clipData.layerData.paths.forEach(pathData => {
                    if (pathData.points && pathData.points.length > 0) {
                        layerSystem.addPath(layerId, {
                            id: pathData.id,
                            points: [...pathData.points],
                            color: pathData.color,
                            size: pathData.size,
                            opacity: pathData.opacity,
                            isComplete: true
                        });
                    }
                });

                // レイヤー設定の復元
                layerSystem.setAlpha(layerId, clipData.layerData.alpha);
                layerSystem.setActiveLayer(layerId);

                debug('Layer pasted successfully');
                
            } catch (error) {
                console.error('Failed to paste layer:', error);
            }
        }

        deepCopyPaths(paths) {
            return (paths || []).map(path => ({
                id: `path_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                points: (path.points || []).map(point => ({ x: point.x, y: point.y })),
                color: path.color,
                size: path.size,
                opacity: path.opacity,
                isComplete: path.isComplete || true
            }));
        }

        generateUniqueLayerName(baseName, layerSystem) {
            let name = baseName;
            let counter = 1;
            
            const existingLayers = layerSystem.listLayers();
            while (existingLayers.some(l => l.layerState.name === name)) {
                name = `${baseName}_${counter}`;
                counter++;
            }
            
            return name;
        }
    }

    // === DrawingEngine（分離予定・暫定保持） ===
    class DrawingEngine {
        constructor(cameraSystem, layerSystem) {
            this.cameraSystem = cameraSystem;
            this.layerSystem = layerSystem;
            this.currentTool = 'pen';
            this.brushSize = CONFIG.pen.size;
            this.brushColor = CONFIG.pen.color;
            this.brushOpacity = CONFIG.pen.opacity;
            this.isDrawing = false;
            this.currentPath = null;
            this.lastPoint = null;
        }

        startDrawing(screenX, screenY) {
            if (this.isDrawing || this.cameraSystem.spacePressed || 
                this.cameraSystem.isDragging || this.layerSystem.transformMode) {
                return;
            }

            const canvasPoint = this.cameraSystem.screenToCanvas(screenX, screenY);
            
            if (!this.cameraSystem.isPointInExtendedCanvas(canvasPoint)) {
                return;
            }
            
            this.isDrawing = true;
            this.lastPoint = canvasPoint;

            const activeLayer = this.layerSystem.getActiveLayer();
            if (!activeLayer) return;

            const color = this.currentTool === 'eraser' ? CONFIG.background.color : this.brushColor;
            const opacity = this.currentTool === 'eraser' ? 1.0 : this.brushOpacity;

            this.currentPath = {
                id: `path_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                points: [{ x: canvasPoint.x, y: canvasPoint.y }],
                color: color,
                size: this.brushSize,
                opacity: opacity,
                isComplete: false
            };

            debug('Drawing started');
        }

        continueDrawing(screenX, screenY) {
            if (!this.isDrawing || !this.currentPath || 
                this.cameraSystem.spacePressed || this.layerSystem.transformMode) {
                return;
            }

            const canvasPoint = this.cameraSystem.screenToCanvas(screenX, screenY);
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

                this.currentPath.points.push({ x, y });
            }

            this.lastPoint = canvasPoint;
        }

        stopDrawing() {
            if (!this.isDrawing || !this.currentPath) return;

            this.currentPath.isComplete = true;
            
            // LayerSystemにパスを追加
            const activeLayer = this.layerSystem.getActiveLayer();
            if (activeLayer) {
                this.layerSystem.addPath(activeLayer.layerState.id, this.currentPath);
                debug('Drawing completed and added to layer');
            }

            this.isDrawing = false;
            this.currentPath = null;
            this.lastPoint = null;
        }

        setTool(tool) {
            this.currentTool = tool;
            debug(`Tool set to: ${tool}`);
        }

        setBrushSize(size) {
            this.brushSize = Math.max(0.1, Math.min(100, size));
            debug(`Brush size set to: ${this.brushSize}`);
        }

        setBrushOpacity(opacity) {
            this.brushOpacity = Math.max(0, Math.min(1, opacity));
            debug(`Brush opacity set to: ${this.brushOpacity}`);
        }
    }

    // === CoreEngine（互換ラッパー版） ===
    class CoreEngine {
        constructor(app) {
            this.app = app;
            
            // 分離されたシステムへの参照
            this.cameraSystem = null;
            this.layerSystem = null;
            
            // 残存システム
            this.drawingEngine = null;
            this.clipboardSystem = new ClipboardSystem();
            
            debug('CoreEngine compatibility wrapper created');
        }
        
        /**
         * CoreRuntimeとの統合初期化
         */
        initialize() {
            // CoreRuntimeから分離されたシステムを取得
            if (window.CoreRuntime) {
                this.cameraSystem = window.CoreRuntime.getCameraSystem();
                this.layerSystem = window.CoreRuntime.getLayerSystem();
                
                if (this.cameraSystem && this.layerSystem) {
                    // DrawingEngineを初期化
                    this.drawingEngine = new DrawingEngine(this.cameraSystem, this.layerSystem);
                    
                    // CoreRuntimeに登録
                    window.CoreRuntime.internal = window.CoreRuntime.internal || {};
                    window.CoreRuntime.internal.drawingEngine = this.drawingEngine;
                }
            }
            
            // 初期レイヤー作成
            if (this.layerSystem) {
                this.layerSystem.createLayer('背景', true);
                this.layerSystem.createLayer('レイヤー1');
                const layers = this.layerSystem.listLayers();
                if (layers.length >= 2) {
                    this.layerSystem.setActiveLayer(layers[1].layerId);
                }
            }
            
            // UI統合
            this.setupUIIntegration();
            
            // キャンバスイベント設定
            this.setupCanvasEvents();
            
            debug('CoreEngine initialized with CoreRuntime integration');
            
            return this;
        }
        
        /**
         * UI統合の設定
         */
        setupUIIntegration() {
            // SortableJS統合
            if (window.TegakiUI && window.TegakiUI.initializeSortable && this.layerSystem) {
                window.TegakiUI.initializeSortable(this.layerSystem);
                debug('SortableJS integration established');
            }
        }
        
        /**
         * キャンバスイベントの設定
         */
        setupCanvasEvents() {
            if (!this.app.canvas || !this.drawingEngine) return;
            
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
            
            debug('Canvas events set up');
        }
        
        /**
         * ツール切り替え
         */
        switchTool(tool) {
            if (this.drawingEngine) {
                this.drawingEngine.setTool(tool);
            }
            
            // UI更新
            document.querySelectorAll('.tool-button').forEach(btn => btn.classList.remove('active'));
            const toolBtn = document.getElementById(tool + '-tool');
            if (toolBtn) toolBtn.classList.add('active');

            const toolNames = { pen: 'ベクターペン', eraser: '消しゴム' };
            const toolElement = document.getElementById('current-tool');
            if (toolElement) {
                toolElement.textContent = toolNames[tool] || tool;
            }
        }
        
        /**
         * サムネイル更新処理（互換性のため）
         */
        processThumbnailUpdates() {
            if (this.layerSystem) {
                this.layerSystem.processThumbnailUpdates();
            }
        }
        
        /**
         * キャンバスリサイズ（互換性のため）
         */
        resizeCanvas(newWidth, newHeight) {
            if (window.CoreRuntime && window.CoreRuntime.api.resizeCanvas) {
                return window.CoreRuntime.api.resizeCanvas(newWidth, newHeight);
            }
            return false;
        }
        
        // === レガシー互換メソッド（段階的削除予定） ===
        
        getCameraSystem() {
            return this.cameraSystem;
        }
        
        getLayerManager() {
            return this.layerSystem;
        }
        
        getDrawingEngine() {
            return this.drawingEngine;
        }
        
        getClipboardSystem() {
            return this.clipboardSystem;
        }
    }

    // === グローバル公開（互換性維持） ===
    window.TegakiCore = {
        CoreEngine: CoreEngine,
        
        // 個別システムも公開（互換性のため）
        DrawingEngine: DrawingEngine,
        ClipboardSystem: ClipboardSystem
    };

    debug('CoreEngine compatibility wrapper loaded');
    console.log('⚠️  CoreEngine is now a compatibility wrapper');
    console.log('   - LayerSystem & CameraSystem moved to separate files');
    console.log('   - DrawingEngine & ClipboardSystem remain here temporarily');
    console.log('   - Use CoreRuntime.api for new development');

})();