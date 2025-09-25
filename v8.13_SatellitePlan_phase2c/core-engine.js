// ===== core-engine.js - 改修版：座標系統一＋非破壊変形確定 =====
// GPT5案.txt準拠：座標系の不一致とレイヤー変形確定処理の完全修正版
// システム分割対応、EventBus統一、座標変換API厳格化

(function() {
    'use strict';
    
    // === グローバルシステム登録 ===
    window.TegakiSystems = window.TegakiSystems || {
        _registry: {},
        Register: function(name, impl) {
            this._registry[name] = impl;
            console.log(`TegakiSystems: Registered ${name}`);
        },
        get: function(name) { 
            return this._registry[name]; 
        },
        waitFor: function(names, callback) {
            const check = () => {
                const missing = names.filter(n => !this._registry[n]);
                if (missing.length === 0) {
                    callback();
                } else {
                    console.log(`TegakiSystems: Waiting for ${missing.join(', ')}`);
                    setTimeout(check, 10);
                }
            };
            check();
        }
    };

    // === EventBus統一実装 ===
    window.Tegaki = window.Tegaki || {};
    window.Tegaki.EventBus = (function(){
        const handlers = {};
        return {
            on: function(evt, fn) { 
                (handlers[evt] || (handlers[evt] = [])).push(fn); 
            },
            off: function(evt, fn) { 
                if (!handlers[evt]) return; 
                handlers[evt] = handlers[evt].filter(f => f !== fn); 
            },
            emit: function(evt, data) { 
                (handlers[evt] || []).slice().forEach(f => { 
                    try { 
                        f(data); 
                    } catch(e) { 
                        console.warn('EventBus error:', e); 
                    } 
                }); 
            }
        };
    })();

    // === 座標変換API統一（GPT5案準拠） ===
    window.Tegaki.Coords = {
        // スクリーン→ワールド変換
        screenToWorld: function(screenPoint) {
            const cameraSystem = window.TegakiSystems.get('CameraSystem');
            if (cameraSystem) {
                return cameraSystem.screenToWorld(screenPoint);
            }
            console.warn('CameraSystem not available for screenToWorld');
            return { x: 0, y: 0 };
        },
        
        // ワールド→キャンバス変換
        worldToCanvas: function(worldPoint) {
            const cameraSystem = window.TegakiSystems.get('CameraSystem');
            if (cameraSystem) {
                return cameraSystem.worldToCanvas(worldPoint);
            }
            console.warn('CameraSystem not available for worldToCanvas');
            return { x: 0, y: 0 };
        },
        
        // スクリーン→キャンバス変換（合成）
        screenToCanvas: function(screenPoint) {
            const worldPoint = this.screenToWorld(screenPoint);
            return this.worldToCanvas(worldPoint);
        },
        
        // キャンバス→ワールド変換
        canvasToWorld: function(canvasPoint) {
            const cameraSystem = window.TegakiSystems.get('CameraSystem');
            if (cameraSystem) {
                return cameraSystem.canvasToWorld(canvasPoint);
            }
            console.warn('CameraSystem not available for canvasToWorld');
            return { x: 0, y: 0 };
        }
    };

    // === DrawingEngine（改修版：座標系統一） ===
    class DrawingEngine {
        constructor(cameraSystem, layerSystem) {
            this.cameraSystem = cameraSystem;
            this.layerSystem = layerSystem;
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
                this.layerSystem.vKeyPressed) return;

            // GPT5案準拠：canonical座標を取得
            const canvasPoint = window.Tegaki.Coords.screenToCanvas({ x: screenX, y: screenY });
            
            if (!this.cameraSystem.isPointInExtendedCanvas(canvasPoint)) {
                return;
            }
            
            this.isDrawing = true;
            this.lastPoint = canvasPoint;

            const activeLayer = this.layerSystem.getActiveLayer();
            if (!activeLayer) return;

            const color = this.currentTool === 'eraser' ? 
                         window.TEGAKI_CONFIG.background.color : this.brushColor;
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

            this.addPathToActiveLayer(this.currentPath);
        }

        continueDrawing(screenX, screenY) {
            if (!this.isDrawing || !this.currentPath || this.cameraSystem.spacePressed || 
                this.cameraSystem.isDragging || this.layerSystem.vKeyPressed) return;

            const canvasPoint = window.Tegaki.Coords.screenToCanvas({ x: screenX, y: screenY });
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

                // GPT5案準拠：パスはcanonical座標で保存
                this.currentPath.points.push({ x, y });
            }

            this.lastPoint = canvasPoint;
        }

        stopDrawing() {
            if (!this.isDrawing) return;

            if (this.currentPath) {
                this.currentPath.isComplete = true;
                this.layerSystem.requestThumbnailUpdate(this.layerSystem.activeLayerIndex);
                
                // EventBus通知
                window.Tegaki.EventBus.emit('drawing:completed', {
                    layerId: this.layerSystem.getActiveLayer().layerData.id,
                    pathId: this.currentPath.id
                });
            }

            this.isDrawing = false;
            this.currentPath = null;
            this.lastPoint = null;
        }
        
        // GPT5案準拠：パスをcanonical座標でレイヤーに追加
        addPathToActiveLayer(path) {
            const activeLayer = this.layerSystem.getActiveLayer();
            if (!activeLayer) return;
            
            // パスはcanonical座標で保存（変形は後でレイヤーレベルで処理）
            activeLayer.layerData.paths.push(path);
            activeLayer.addChild(path.graphics);
            
            console.log('Path added in canonical coordinates:', path.points.slice(0, 3));
        }

        setTool(tool) {
            this.currentTool = tool;
            
            // EventBus通知
            window.Tegaki.EventBus.emit('tool:changed', { tool });
        }

        setBrushSize(size) {
            this.brushSize = Math.max(0.1, Math.min(100, size));
        }

        setBrushOpacity(opacity) {
            this.brushOpacity = Math.max(0, Math.min(1, opacity));
        }
    }

    // === システムファイル動的読み込み ===
    function loadSystemFiles(callback) {
        const scripts = [
            'systems/camera-system.js',
            'systems/layer-system.js', 
            'systems/drawing-clipboard.js'
        ];
        
        let loaded = 0;
        const errors = [];
        
        console.log('CoreEngine: Loading system files...');
        
        scripts.forEach(src => {
            const script = document.createElement('script');
            script.src = src;
            script.onload = () => {
                loaded++;
                console.log(`CoreEngine: Loaded ${src} (${loaded}/${scripts.length})`);
                if (loaded === scripts.length) {
                    callback(errors.length === 0);
                }
            };
            script.onerror = (error) => {
                console.error(`CoreEngine: Failed to load ${src}:`, error);
                errors.push(src);
                loaded++;
                if (loaded === scripts.length) {
                    callback(false);
                }
            };
            document.head.appendChild(script);
        });
    }

    // === 統合CoreEngine（改修版） ===
    class CoreEngine {
        constructor(app) {
            this.app = app;
            this.CONFIG = window.TEGAKI_CONFIG;
            
            // 定義チェック：CONFIG必須項目の検証
            if (!this.CONFIG) {
                console.error('CoreEngine: TEGAKI_CONFIG not found');
                return;
            }
            
            if (!this.CONFIG.canvas || !this.CONFIG.pen || !this.CONFIG.camera || !this.CONFIG.layer) {
                console.error('CoreEngine: Missing required CONFIG sections');
                return;
            }
            
            // システム参照
            this.cameraSystem = null;
            this.layerSystem = null;
            this.clipboardSystem = null;
            this.drawingEngine = null;
        }

        // 初期化：システム統合とEventBus設定
        initialize() {
            console.log('CoreEngine: Starting system integration with EventBus...');
            
            // EventBusリスナー設定
            this.setupEventBusListeners();
            
            // システムファイル読み込み
            loadSystemFiles((success) => {
                if (!success) {
                    console.error('CoreEngine: System files loading failed');
                    return;
                }
                
                // システム初期化完了を待機
                window.TegakiSystems.waitFor(['CameraSystem', 'LayerSystem', 'ClipboardSystem'], () => {
                    console.log('CoreEngine: All systems ready, initializing...');
                    this.initializeSystems();
                });
            });
        }

        // EventBusリスナー設定
        setupEventBusListeners() {
            // レイヤー変形確定時
            window.Tegaki.EventBus.on('layer:transform:confirmed', (data) => {
                console.log('Layer transform confirmed:', data.layerId);
                this.layerSystem.requestThumbnailUpdate(data.layerIndex);
            });

            // カメラリサイズ時
            window.Tegaki.EventBus.on('camera:resize', (data) => {
                console.log('Camera resized:', data.width, 'x', data.height);
                this.updateBackgroundLayers(data.width, data.height);
            });

            // レイヤーパス変更時
            window.Tegaki.EventBus.on('layer:paths:changed', (data) => {
                console.log('Layer paths changed:', data.layerId);
                // 必要に応じて追加処理
            });
        }

        // システム初期化と相互参照設定
        initializeSystems() {
            try {
                // CameraSystem初期化
                const CameraSystem = window.TegakiSystems.get('CameraSystem');
                CameraSystem.init({ app: this.app });
                this.cameraSystem = CameraSystem;

                // LayerSystem初期化
                const LayerSystem = window.TegakiSystems.get('LayerSystem');
                LayerSystem.init({
                    app: this.app,
                    rootContainer: this.cameraSystem.canvasContainer
                });
                this.layerSystem = LayerSystem;

                // ClipboardSystem初期化
                const ClipboardSystem = window.TegakiSystems.get('ClipboardSystem');
                ClipboardSystem.init({
                    app: this.app,
                    layerSystem: this.layerSystem
                });
                this.clipboardSystem = ClipboardSystem;

                // DrawingEngine初期化
                this.drawingEngine = new DrawingEngine(this.cameraSystem, this.layerSystem);

                // 相互参照設定
                this.setupCrossReferences();

                // 後方互換API設定
                this.setupBackwardCompatibility();

                // キャンバスイベント設定
                this.setupCanvasEvents();

                // 初期レイヤー作成
                this.createInitialLayers();

                // UI統合
                this.setupUI();

                // サムネイル更新ループ
                this.setupThumbnailUpdates();

                console.log('✅ CoreEngine: System integration completed successfully');
                
            } catch (error) {
                console.error('❌ CoreEngine: System initialization failed:', error);
            }
        }

        // 相互参照設定（EventBus経由で疎結合）
        setupCrossReferences() {
            this.cameraSystem.setLayerSystem(this.layerSystem);
            this.cameraSystem.setDrawingEngine(this.drawingEngine);
            this.layerSystem.setCameraSystem(this.cameraSystem);
        }

        // 後方互換API設定
        setupBackwardCompatibility() {
            window.App = this.app;
            window.Tegaki = window.Tegaki || {};
            window.Tegaki.stage = this.app.stage;
            window.Tegaki.renderer = this.app.renderer;

            // キャンバスリサイズ統合
            window.drawingAppResizeCanvas = (newWidth, newHeight) => {
                return this.resizeCanvas(newWidth, newHeight);
            };
        }

        // キャンバスイベント設定
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
                if (e.code === 'KeyP' && !e.ctrlKey && !e.altKey && !e.metaKey) {
                    this.switchTool('pen');
                    e.preventDefault();
                }
                if (e.code === 'KeyE' && !e.ctrlKey && !e.altKey && !e.metaKey) {
                    this.switchTool('eraser');
                    e.preventDefault();
                }
            });
        }

        // 初期レイヤー作成
        createInitialLayers() {
            this.layerSystem.createLayer('背景', true);
            this.layerSystem.createLayer('レイヤー1');
            this.layerSystem.setActiveLayer(1);
            
            this.layerSystem.updateLayerPanelUI();
            this.layerSystem.updateStatusDisplay();
        }

        // UI統合
        setupUI() {
            if (window.TegakiUI && window.TegakiUI.initializeSortable) {
                window.TegakiUI.initializeSortable(this.layerSystem);
            }
        }

        // サムネイル更新ループ
        setupThumbnailUpdates() {
            this.app.ticker.add(() => {
                this.layerSystem.processThumbnailUpdates();
            });
        }

        // 背景レイヤー更新
        updateBackgroundLayers(newWidth, newHeight) {
            this.layerSystem.layers.forEach(layer => {
                if (layer.layerData.isBackground && layer.layerData.backgroundGraphics) {
                    layer.layerData.backgroundGraphics.clear();
                    layer.layerData.backgroundGraphics.rect(0, 0, newWidth, newHeight);
                    layer.layerData.backgroundGraphics.fill(this.CONFIG.background.color);
                }
            });
        }

        // 公開API
        getCameraSystem() { return this.cameraSystem; }
        getLayerManager() { return this.layerSystem; }
        getDrawingEngine() { return this.drawingEngine; }
        getClipboardSystem() { return this.clipboardSystem; }
        
        switchTool(tool) {
            this.cameraSystem.switchTool(tool);
        }
        
        updateCoordinates(x, y) {
            this.cameraSystem.updateCoordinates(x, y);
        }
        
        // キャンバスリサイズ統合処理（EventBus対応）
        resizeCanvas(newWidth, newHeight) {
            console.log('CoreEngine: Canvas resize request:', newWidth, 'x', newHeight);
            
            // CONFIG更新
            this.CONFIG.canvas.width = newWidth;
            this.CONFIG.canvas.height = newHeight;
            
            // EventBus通知
            window.Tegaki.EventBus.emit('camera:resize', { 
                width: newWidth, 
                height: newHeight 
            });
            
            // CameraSystem更新
            this.cameraSystem.resizeCanvas(newWidth, newHeight);
            
            // 全レイヤーのサムネイル更新
            for (let i = 0; i < this.layerSystem.layers.length; i++) {
                this.layerSystem.requestThumbnailUpdate(i);
            }
            
            console.log('CoreEngine: Canvas resize completed');
        }
    }

    // グローバル公開
    window.TegakiCore = {
        CoreEngine: CoreEngine
    };

})();