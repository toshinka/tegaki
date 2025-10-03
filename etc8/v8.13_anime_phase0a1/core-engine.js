// ===== core-engine.js - P・Eショートカット復活修正版 =====
// 各Systemモジュールを統合し、既存のindex.html・ui-panels.js・core-runtime.jsと完全互換
// 【修正完了】P・Eショートカット優先処理・レイヤーモード強制解除対応
// PixiJS v8.13 対応・改修計画書完全準拠版

(function() {
    'use strict';
    
    // システム依存チェック
    if (!window.TegakiCameraSystem) {
        console.error('❌ TegakiCameraSystem not found - load system/camera-system.js');
        throw new Error('system/camera-system.js is required');
    }
    
    if (!window.TegakiLayerSystem) {
        console.error('❌ TegakiLayerSystem not found - load system/layer-system.js');
        throw new Error('system/layer-system.js is required');
    }
    
    if (!window.TegakiDrawingClipboard) {
        console.error('❌ TegakiDrawingClipboard not found - load system/drawing-clipboard.js');
        throw new Error('system/drawing-clipboard.js is required');
    }
    
    // 設定取得（CONFIG統一）
    const CONFIG = window.TEGAKI_CONFIG;
    if (!CONFIG) {
        console.error('❌ TEGAKI_CONFIG not found - load config.js');
        throw new Error('config.js is required');
    }

    // KeyConfig管理クラス依存確認
    if (!window.TEGAKI_KEYCONFIG_MANAGER) {
        console.error('❌ TEGAKI_KEYCONFIG_MANAGER not found - load config.js');
        throw new Error('KeyConfig manager is required');
    }

    // === 改修版：EventBus実装（System間連携強化） ===
    class SimpleEventBus {
        constructor() {
            this.listeners = new Map();
            this.debug = CONFIG.debug || false;
        }
        
        on(event, callback) {
            if (!this.listeners.has(event)) {
                this.listeners.set(event, []);
            }
            this.listeners.get(event).push(callback);
            
            if (this.debug) {
                console.log(`EventBus: Registered listener for '${event}'`);
            }
        }
        
        emit(event, data) {
            if (this.debug && event !== 'ui:mouse-move') { // マウス移動は除外
                console.log(`EventBus: Emitting '${event}'`, data);
            }
            
            const callbacks = this.listeners.get(event);
            if (callbacks) {
                callbacks.forEach((callback, index) => {
                    try {
                        callback(data);
                    } catch (error) {
                        console.error(`EventBus error in ${event}[${index}]:`, error);
                    }
                });
            }
        }
        
        off(event, callback) {
            const callbacks = this.listeners.get(event);
            if (callbacks) {
                const index = callbacks.indexOf(callback);
                if (index > -1) {
                    callbacks.splice(index, 1);
                    if (this.debug) {
                        console.log(`EventBus: Removed listener for '${event}'`);
                    }
                }
            }
        }
        
        getRegisteredEvents() {
            return Array.from(this.listeners.keys());
        }
        
        getListenerCount(event) {
            const callbacks = this.listeners.get(event);
            return callbacks ? callbacks.length : 0;
        }
    }

    // === 改修版：DrawingEngine（EventBus統合・座標変換統一） ===
    class DrawingEngine {
        constructor(cameraSystem, layerManager, eventBus, config) {
            this.cameraSystem = cameraSystem;
            this.layerManager = layerManager;
            this.eventBus = eventBus;
            this.config = config; // CONFIG統一
            
            this.currentTool = 'pen';
            this.brushSize = this.config.pen.size;
            this.brushColor = this.config.pen.color;
            this.brushOpacity = this.config.pen.opacity;
            this.isDrawing = false;
            this.currentPath = null;
            this.lastPoint = null;
            
            this._setupEventBusListeners();
        }

        _setupEventBusListeners() {
            if (!this.eventBus) return;
            
            // UI側からの描画設定変更を監視
            this.eventBus.on('drawing:tool-changed', (data) => {
                this.setTool(data.tool);
            });
            
            this.eventBus.on('drawing:brush-size-changed', (data) => {
                this.setBrushSize(data.size);
            });
            
            this.eventBus.on('drawing:brush-color-changed', (data) => {
                this.setBrushColor(data.color);
            });
            
            this.eventBus.on('drawing:brush-opacity-changed', (data) => {
                this.setBrushOpacity(data.opacity);
            });
        }

        startDrawing(screenX, screenY) {
            if (this.isDrawing || this.cameraSystem.spacePressed || this.cameraSystem.isDragging || 
                this.layerManager.vKeyPressed) return;

            // 改修版：統一API使用（CameraSystem経由）
            const canvasPoint = this.cameraSystem.screenToCanvas(screenX, screenY, { forDrawing: true });
            
            if (!this.cameraSystem.isPointInExtendedCanvas(canvasPoint)) {
                return;
            }
            
            this.isDrawing = true;
            this.lastPoint = canvasPoint;

            const activeLayer = this.layerManager.getActiveLayer();
            if (!activeLayer) return;

            const color = this.currentTool === 'eraser' ? this.config.background.color : this.brushColor;
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

            // PixiJS v8.13 準拠：Graphics API統一
            this.currentPath.graphics.circle(canvasPoint.x, canvasPoint.y, this.brushSize / 2);
            this.currentPath.graphics.fill({ color: color, alpha: opacity });

            this.addPathToActiveLayer(this.currentPath);
            
            // EventBus通知
            if (this.eventBus) {
                this.eventBus.emit('drawing:started', {
                    tool: this.currentTool,
                    point: canvasPoint,
                    pathId: this.currentPath.id
                });
            }
        }

        continueDrawing(screenX, screenY) {
            if (!this.isDrawing || !this.currentPath || this.cameraSystem.spacePressed || 
                this.cameraSystem.isDragging || this.layerManager.vKeyPressed) return;

            // 改修版：統一API使用（CameraSystem経由）
            const canvasPoint = this.cameraSystem.screenToCanvas(screenX, screenY, { forDrawing: true });
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

                // PixiJS v8.13 準拠：Graphics API統一
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
                
                // EventBus通知
                if (this.eventBus) {
                    this.eventBus.emit('drawing:completed', {
                        pathId: this.currentPath.id,
                        pointCount: this.currentPath.points.length
                    });
                }
            }

            this.isDrawing = false;
            this.currentPath = null;
            this.lastPoint = null;
        }
        
        // 改修版：レイヤー変形考慮描画
        addPathToActiveLayer(path) {
            const activeLayer = this.layerManager.getActiveLayer();
            if (!activeLayer) return;
            
            const layerId = activeLayer.layerData.id;
            const transform = this.layerManager.layerTransforms.get(layerId);
            
            // レイヤーがtransformされている場合、逆変換を適用して座標を調整
            if (transform && this.layerManager.isTransformNonDefault(transform)) {
                try {
                    // 正しい逆変換行列を作成
                    const matrix = new PIXI.Matrix();
                    
                    const centerX = this.config.canvas.width / 2;
                    const centerY = this.config.canvas.height / 2;
                    
                    // 逆変換の正しい順序
                    matrix.translate(-centerX - transform.x, -centerY - transform.y);
                    matrix.rotate(-transform.rotation);
                    matrix.scale(1/transform.scaleX, 1/transform.scaleY);
                    matrix.translate(centerX, centerY);
                    
                    // 新しいGraphicsを作成し、逆変換した座標で描画
                    const transformedGraphics = new PIXI.Graphics();
                    
                    path.points.forEach((point, index) => {
                        try {
                            const transformedPoint = matrix.apply(point);
                            // 変換後の座標が有効な場合のみ描画
                            if (isFinite(transformedPoint.x) && isFinite(transformedPoint.y)) {
                                transformedGraphics.circle(transformedPoint.x, transformedPoint.y, path.size / 2);
                                transformedGraphics.fill({ color: path.color, alpha: path.opacity });
                            }
                        } catch (transformError) {
                            if (this.config.debug) {
                                console.warn(`Point transform failed for point ${index}:`, transformError);
                            }
                        }
                    });
                    
                    path.graphics = transformedGraphics;
                } catch (error) {
                    if (this.config.debug) {
                        console.error('Transform application failed, using original graphics:', error);
                    }
                    // 変形に失敗した場合は元のGraphicsを使用
                }
            }
            
            activeLayer.layerData.paths.push(path);
            activeLayer.addChild(path.graphics);
        }

        setTool(tool) {
            const oldTool = this.currentTool;
            this.currentTool = tool;
            
            if (this.eventBus && oldTool !== tool) {
                this.eventBus.emit('drawing:tool-set', { 
                    oldTool: oldTool, 
                    newTool: tool 
                });
            }
        }

        setBrushSize(size) {
            const oldSize = this.brushSize;
            this.brushSize = Math.max(0.1, Math.min(100, size));
            
            if (this.eventBus && oldSize !== this.brushSize) {
                this.eventBus.emit('drawing:brush-size-set', {
                    oldSize: oldSize,
                    newSize: this.brushSize
                });
            }
        }

        setBrushColor(color) {
            const oldColor = this.brushColor;
            this.brushColor = color;
            
            if (this.eventBus && oldColor !== color) {
                this.eventBus.emit('drawing:brush-color-set', {
                    oldColor: oldColor,
                    newColor: color
                });
            }
        }

        setBrushOpacity(opacity) {
            const oldOpacity = this.brushOpacity;
            this.brushOpacity = Math.max(0, Math.min(1, opacity));
            
            if (this.eventBus && oldOpacity !== this.brushOpacity) {
                this.eventBus.emit('drawing:brush-opacity-set', {
                    oldOpacity: oldOpacity,
                    newOpacity: this.brushOpacity
                });
            }
        }
    }

    // === 【修正完了】統合キーハンドラー（P・Eショートカット優先処理版） ===
    class UnifiedKeyHandler {
        constructor(cameraSystem, layerSystem, drawingEngine, eventBus) {
            this.cameraSystem = cameraSystem;
            this.layerSystem = layerSystem;
            this.drawingEngine = drawingEngine;
            this.eventBus = eventBus;
            
            this.keyConfig = window.TEGAKI_KEYCONFIG_MANAGER;
            
            // キーハンドリング重複回避のためのフラグ
            this.keyHandlingActive = true;
            
            this.setupKeyHandling();
        }
        
        setupKeyHandling() {
            console.log('UnifiedKeyHandler: Setting up unified key handling...');
            
            document.addEventListener('keydown', (e) => {
                if (!this.keyHandlingActive) return;
                
                this.handleKeyDown(e);
            });
            
            document.addEventListener('keyup', (e) => {
                if (!this.keyHandlingActive) return;
                
                this.handleKeyUp(e);
            });
            
            // フォーカス制御
            window.addEventListener('blur', () => {
                this.resetAllKeyStates();
            });
            
            window.addEventListener('focus', () => {
                this.resetAllKeyStates();
            });
        }
        
        handleKeyDown(e) {
            // KeyConfig管理経由でアクション取得
            const action = this.keyConfig.getActionForKey(e.code, {
                vPressed: this.layerSystem.vKeyPressed,
                shiftPressed: e.shiftKey
            });
            
            // 特殊キー処理（アクション以外）
            if (this.handleSpecialKeys(e)) {
                return; // 特殊キー処理済み
            }
            
            if (!action) return; // マッピングされていないキー
            
            // アクション別処理
            switch(action) {
                // 【修正完了】ツール切り替え（最優先処理・レイヤーモード強制解除）
                case 'pen':
                    if (!e.ctrlKey && !e.altKey && !e.metaKey) {
                        console.log('🔧 P key pressed, switching to pen tool');
                        this.switchTool('pen');
                        
                        // 【修正完了】レイヤーモード強制解除（ポップアップも消去）
                        if (this.layerSystem.isLayerMoveMode) {
                            console.log('🔧 Exiting layer mode due to pen tool selection');
                            this.layerSystem.exitLayerMoveMode();
                        }
                        e.preventDefault();
                    }
                    break;
                    
                case 'eraser':
                    if (!e.ctrlKey && !e.altKey && !e.metaKey) {
                        console.log('🔧 E key pressed, switching to eraser tool');
                        this.switchTool('eraser');
                        
                        // 【修正完了】レイヤーモード強制解除（ポップアップも消去）
                        if (this.layerSystem.isLayerMoveMode) {
                            console.log('🔧 Exiting layer mode due to eraser tool selection');
                            this.layerSystem.exitLayerMoveMode();
                        }
                        e.preventDefault();
                    }
                    break;
                
                // Vキー：レイヤーモードトグル（LayerSystemが処理）
                case 'layerMode':
                    // LayerSystemが処理するため、ここでは何もしない
                    break;
                
                // 素の方向キー：レイヤー階層移動＆GIF操作（LayerSystemが処理）
                case 'layerUp':
                case 'layerDown':
                case 'gifPrevFrame':
                case 'gifNextFrame':
                    // LayerSystemが処理するため、ここでは何もしない
                    break;
                
                // V + 方向キー：レイヤー移動（LayerSystemが処理）
                case 'layerMoveUp':
                case 'layerMoveDown':
                case 'layerMoveLeft':
                case 'layerMoveRight':
                    // LayerSystemが処理するため、ここでは何もしない
                    break;
                
                // V + Shift + 方向キー：レイヤー変形（LayerSystemが処理）
                case 'layerScaleUp':
                case 'layerScaleDown':
                case 'layerRotateLeft':
                case 'layerRotateRight':
                    // LayerSystemが処理するため、ここでは何もしない
                    break;
                
                // Hキー：反転処理（CameraSystem/LayerSystemが協調処理）
                case 'horizontalFlip':
                    // CameraSystem/LayerSystemが処理するため、ここでは何もしない
                    break;
                
                // キャンバスリセット（CameraSystemが処理）
                case 'canvasReset':
                    // CameraSystemが処理するため、ここでは何もしない
                    break;
            }
        }
        
        handleKeyUp(e) {
            // keyup処理は各Systemで個別に処理
        }
        
        // 特殊キー処理（CONFIG外のキー）
        handleSpecialKeys(e) {
            // Ctrl+0: キャンバスリセット（CameraSystemに委譲）
            if (e.ctrlKey && e.code === 'Digit0') {
                // CameraSystemが処理するため、ここでは何もしない
                return false;
            }
            
            // Space: カメラ移動モード（CameraSystemに委譲）
            if (e.code === 'Space') {
                // CameraSystemが処理するため、ここでは何もしない
                return false;
            }
            
            return false;
        }
        
        // 【修正完了】ツール切り替え処理（UI更新・カーソル更新統合）
        switchTool(tool) {
            console.log(`🔧 Switching tool to: ${tool}`);
            
            // DrawingEngineでツール設定
            this.drawingEngine.setTool(tool);
            
            // 【修正完了】UI更新（activeクラス切り替え）
            document.querySelectorAll('.tool-button').forEach(btn => btn.classList.remove('active'));
            const toolBtn = document.getElementById(tool + '-tool');
            if (toolBtn) {
                toolBtn.classList.add('active');
                console.log(`🔧 Tool button activated: ${tool}-tool`);
            } else {
                console.warn(`🔧 Tool button not found: ${tool}-tool`);
            }

            // 【修正完了】ステータス表示更新
            const toolNames = { pen: 'ベクターペン', eraser: '消しゴム' };
            const toolElement = document.getElementById('current-tool');
            if (toolElement) {
                toolElement.textContent = toolNames[tool] || tool;
                console.log(`🔧 Tool status updated: ${toolNames[tool]}`);
            }
            
            // カーソル更新
            this.cameraSystem.updateCursor();
            
            // EventBus通知
            if (this.eventBus) {
                this.eventBus.emit('key:tool-switched', { tool });
            }
        }
        
        resetAllKeyStates() {
            // 各Systemの状態リセット
            if (this.cameraSystem._resetAllKeyStates) {
                this.cameraSystem._resetAllKeyStates();
            }
        }
        
        // デバッグ用：キーハンドリング有効/無効
        setKeyHandlingActive(active) {
            this.keyHandlingActive = active;
            console.log(`UnifiedKeyHandler: Key handling ${active ? 'enabled' : 'disabled'}`);
        }
    }

    // === 統合CoreEngineクラス（P・Eショートカット修正対応版） ===
    class CoreEngine {
        constructor(app) {
            this.app = app;
            
            // EventBus作成（System間連携強化版）
            this.eventBus = new SimpleEventBus();
            
            // 【改修】システム初期化（完全参照注入版）
            this.cameraSystem = new window.TegakiCameraSystem();
            this.layerSystem = new window.TegakiLayerSystem();
            this.clipboardSystem = new window.TegakiDrawingClipboard();
            this.drawingEngine = new DrawingEngine(this.cameraSystem, this.layerSystem, this.eventBus, CONFIG);
            
            // 【修正完了】統合キーハンドラー（P・Eショートカット修正版）
            this.keyHandler = null; // 初期化後に作成
            
            // 【改修】相互参照設定（完全版）
            this.setupCrossReferences();
            
            // 【改修】System間EventBus統合
            this.setupSystemEventIntegration();
        }
        
        // 【改修】完全な相互参照設定
        setupCrossReferences() {
            console.log('Setting up cross-references...');
            
            // CameraSystemに参照設定
            this.cameraSystem.setLayerManager(this.layerSystem);
            this.cameraSystem.setDrawingEngine(this.drawingEngine);
            
            // LayerSystemに参照設定
            this.layerSystem.setCameraSystem(this.cameraSystem);
            this.layerSystem.setApp(this.app);
            
            // ClipboardSystemに参照設定
            this.clipboardSystem.setLayerManager(this.layerSystem);
            
            console.log('✅ Cross-references setup completed');
        }
        
        // 改修版：System間EventBus統合
        setupSystemEventIntegration() {
            // レイヤー変更時のクリップボード状態更新
            this.eventBus.on('layer:activated', (data) => {
                this.eventBus.emit('clipboard:get-info-request');
            });
            
            // カメラ変更時の座標表示更新
            this.eventBus.on('camera:changed', () => {
                // 座標表示の更新処理
            });
            
            // 描画完了時のUI更新通知
            this.eventBus.on('drawing:completed', (data) => {
                this.eventBus.emit('ui:drawing-completed', data);
            });
            
            // 【修正完了】ツール切り替え完了通知
            this.eventBus.on('key:tool-switched', (data) => {
                console.log(`🔧 Tool switched to: ${data.tool} (UI updated)`);
            });
            
            // GIF操作通知（将来実装用）
            this.eventBus.on('gif:prev-frame-requested', () => {
                console.log('🎞️ GIF Previous Frame requested (reserved)');
            });
            
            this.eventBus.on('gif:next-frame-requested', () => {
                console.log('🎞️ GIF Next Frame requested (reserved)');
            });
            
            // エラー処理統合
            this.eventBus.on('clipboard:copy-failed', (data) => {
                if (CONFIG.debug) {
                    console.error('Clipboard copy failed:', data.error);
                }
            });
            
            this.eventBus.on('clipboard:paste-failed', (data) => {
                if (CONFIG.debug) {
                    console.error('Clipboard paste failed:', data.error);
                }
            });
        }
        
        // === 既存互換API ===
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
        
        // 【修正完了】統合キーハンドラー取得
        getKeyHandler() {
            return this.keyHandler;
        }
        
        // 改修版：EventBus公開（System間連携用）
        getEventBus() {
            return this.eventBus;
        }
        
        // 【改修】統一されたイベントハンドリング
        setupCanvasEvents() {
            console.log('Setting up canvas events...');
            
            // 【改修】安全なCanvas要素取得
            const canvas = this.app.canvas || this.app.view;
            if (!canvas) {
                console.error('Canvas element not found');
                return;
            }
            
            // 【改修】ポインターイベント設定（統一版）
            canvas.addEventListener('pointerdown', (e) => {
                if (e.button !== 0) return;

                const rect = canvas.getBoundingClientRect();
                const x = e.clientX - rect.left;
                const y = e.clientY - rect.top;

                this.drawingEngine.startDrawing(x, y);
                e.preventDefault();
            });

            canvas.addEventListener('pointermove', (e) => {
                const rect = canvas.getBoundingClientRect();
                const x = e.clientX - rect.left;
                const y = e.clientY - rect.top;

                this.updateCoordinates(x, y);
                this.drawingEngine.continueDrawing(x, y);
                
                // EventBus通知
                this.eventBus.emit('ui:mouse-move', { x, y });
            });
            
            canvas.addEventListener('pointerup', (e) => {
                this.drawingEngine.stopDrawing();
            });
            
            canvas.addEventListener('pointerleave', (e) => {
                this.drawingEngine.stopDrawing();
            });
            
            console.log('✅ Canvas events setup completed');
        }
        
        // 【修正完了】ツール切り替えAPI（統合キーハンドラー経由）
        switchTool(tool) {
            console.log(`🔧 CoreEngine.switchTool() called with: ${tool}`);
            
            // 統合キーハンドラー経由でツール切り替え
            if (this.keyHandler) {
                this.keyHandler.switchTool(tool);
            } else {
                // フォールバック（初期化前の呼び出し対応）
                console.warn('🔧 KeyHandler not initialized, using fallback tool switch');
                this.drawingEngine.setTool(tool);
                this.cameraSystem.updateCursor();
            }
        }
        
        updateCoordinates(x, y) {
            this.cameraSystem.updateCoordinates(x, y);
        }
        
        processThumbnailUpdates() {
            this.layerSystem.processThumbnailUpdates();
        }
        
        // 改修版：キャンバスリサイズ（EventBus統合・統一処理）
        resizeCanvas(newWidth, newHeight) {
            if (CONFIG.debug) {
                console.log('CoreEngine: Canvas resize request received:', newWidth, 'x', newHeight);
            }
            
            // CONFIG更新
            CONFIG.canvas.width = newWidth;
            CONFIG.canvas.height = newHeight;
            
            // CameraSystemの更新
            this.cameraSystem.resizeCanvas(newWidth, newHeight);
            
            // LayerSystemの背景レイヤー更新
            this.layerSystem.layers.forEach(layer => {
                if (layer.layerData.isBackground && layer.layerData.backgroundGraphics) {
                    layer.layerData.backgroundGraphics.clear();
                    layer.layerData.backgroundGraphics.rect(0, 0, newWidth, newHeight);
                    layer.layerData.backgroundGraphics.fill(CONFIG.background.color);
                }
            });
            
            // 全レイヤーのサムネイル更新
            for (let i = 0; i < this.layerSystem.layers.length; i++) {
                this.layerSystem.requestThumbnailUpdate(i);
            }
            
            // EventBus通知
            this.eventBus.emit('canvas:resized', { 
                width: newWidth, 
                height: newHeight 
            });
            
            if (CONFIG.debug) {
                console.log('CoreEngine: Canvas resize completed');
            }
        }
        
        // 【修正完了】初期化（P・Eショートカット修正版）
        initialize() {
            console.log('=== CoreEngine initialization started ===');
            
            // 【改修】システム初期化（EventBus・CONFIG統一・安全な参照注入）
            this.cameraSystem.init(
                this.app.stage,    // stage直接渡し
                this.eventBus,
                CONFIG
            );
            
            this.layerSystem.init(
                this.cameraSystem.canvasContainer,  // 安全な参照
                this.eventBus,
                CONFIG
            );
            
            // ClipboardSystem初期化（EventBus・CONFIG統一）
            this.clipboardSystem.init(this.eventBus, CONFIG);
            
            // 【修正完了】統合キーハンドラー初期化（P・Eショートカット修正版）
            this.keyHandler = new UnifiedKeyHandler(
                this.cameraSystem,
                this.layerSystem,
                this.drawingEngine,
                this.eventBus
            );
            
            // 初期レイヤー作成
            this.layerSystem.createLayer('背景', true);
            this.layerSystem.createLayer('レイヤー1');
            this.layerSystem.setActiveLayer(1);
            
            this.layerSystem.updateLayerPanelUI();
            this.layerSystem.updateStatusDisplay();
            
            // UI初期化（SortableJS）
            if (window.TegakiUI && window.TegakiUI.initializeSortable) {
                window.TegakiUI.initializeSortable(this.layerSystem);
            }
            
            // 【改修】キャンバスイベント設定（統一版）
            this.setupCanvasEvents();
            
            // サムネイル更新ループ
            this.app.ticker.add(() => {
                this.processThumbnailUpdates();
            });
            
            // 初期化完了通知
            this.eventBus.emit('core:initialized', {
                systems: ['camera', 'layer', 'clipboard', 'drawing', 'keyhandler']
            });
            
            console.log('✅ CoreEngine initialized successfully (P・Eショートカット修正版)');
            console.log('   - 🔧 P・Eショートカット修正完了：最優先処理・レイヤーモード強制解除');
            console.log('   - 🔧 ツール切り替えUI更新完了：activeクラス・ステータス表示');
            console.log('   - ✅ UnifiedKeyHandler統合完了');
            console.log('   - ✅ System間キー処理重複完全回避');
            console.log('   - ✅ KeyConfig管理クラス連携');
            console.log('   - ✅ 素の方向キー↑↓: レイヤー階層移動');
            console.log('   - ✅ 素の方向キー←→: GIF操作予約');
            console.log('   - ✅ V + 方向キー: レイヤー変形（キープ）');
            console.log('   - 🔧 完全な参照注入・EventBus統合');
            console.log('   - Systems:', this.eventBus.getRegisteredEvents().length, 'events registered');
            console.log('   - 既存機能完全継承・互換性維持');
            
            return this;
        }
        
        // === デバッグ用API ===
        debugGetSystemStatus() {
            if (!CONFIG.debug) return null;
            
            return {
                camera: {
                    initialized: !!this.cameraSystem.app,
                    worldContainerPosition: this.cameraSystem.worldContainer ? {
                        x: this.cameraSystem.worldContainer.x,
                        y: this.cameraSystem.worldContainer.y
                    } : null,
                    scale: this.cameraSystem.worldContainer ? this.cameraSystem.worldContainer.scale.x : null,
                    hasCanvas: !!(this.app.canvas || this.app.view)
                },
                layer: {
                    initialized: !!this.layerSystem.layersContainer,
                    layerCount: this.layerSystem.layers.length,
                    activeLayer: this.layerSystem.activeLayerIndex
                },
                clipboard: {
                    hasData: this.clipboardSystem.hasClipboardData(),
                    summary: this.clipboardSystem.getClipboardSummary()
                },
                drawing: {
                    currentTool: this.drawingEngine.currentTool,
                    isDrawing: this.drawingEngine.isDrawing
                },
                keyHandler: {
                    initialized: !!this.keyHandler,
                    keyHandlingActive: this.keyHandler ? this.keyHandler.keyHandlingActive : false,
                    keyConfigAvailable: !!window.TEGAKI_KEYCONFIG_MANAGER
                },
                eventBus: {
                    registeredEvents: this.eventBus.getRegisteredEvents(),
                    totalListeners: this.eventBus.getRegisteredEvents().reduce((sum, event) => 
                        sum + this.eventBus.getListenerCount(event), 0)
                }
            };
        }
        
        debugEmitEvent(event, data) {
            if (CONFIG.debug) {
                console.log(`Debug: Emitting event '${event}'`, data);
                this.eventBus.emit(event, data);
            }
        }
        
        // 【新規】キーコンフィグ操作API（将来のUI設定パネル用）
        getKeyConfig() {
            return window.TEGAKI_KEYCONFIG_MANAGER.getKeyConfig();
        }
        
        updateKeyConfig(updates) {
            window.TEGAKI_KEYCONFIG_MANAGER.updateKeyConfig(updates);
            
            // EventBus通知
            this.eventBus.emit('keyconfig:updated', { updates });
        }
        
        resetKeyConfig() {
            window.TEGAKI_KEYCONFIG_MANAGER.resetToDefault();
            
            // EventBus通知
            this.eventBus.emit('keyconfig:reset');
        }
        
        checkKeyConflicts(newKey, targetAction) {
            return window.TEGAKI_KEYCONFIG_MANAGER.checkConflicts(newKey, targetAction);
        }
    }

    // === グローバル公開（P・Eショートカット修正対応版） ===
    window.TegakiCore = {
        CoreEngine: CoreEngine,
        
        // 個別クラスも公開
        CameraSystem: window.TegakiCameraSystem,
        LayerManager: window.TegakiLayerSystem,
        LayerSystem: window.TegakiLayerSystem,
        DrawingEngine: DrawingEngine,
        ClipboardSystem: window.TegakiDrawingClipboard,
        DrawingClipboard: window.TegakiDrawingClipboard,
        SimpleEventBus: SimpleEventBus,
        UnifiedKeyHandler: UnifiedKeyHandler // 修正版
    };

    console.log('✅ core-engine.js (P・Eショートカット復活修正版) loaded successfully');
    console.log('   - 🔧 P・Eショートカット修正完了：最優先処理・UI更新統合');
    console.log('   - 🔧 レイヤーモード強制解除：ツール切り替え時にexitLayerMoveMode()');
    console.log('   - 🔧 ツールボタンactiveクラス切り替え修正');
    console.log('   - 🔧 ステータス表示更新修正');
    console.log('   - ✅ UnifiedKeyHandler実装完了');
    console.log('   - ✅ System間キー処理重複完全排除');
    console.log('   - ✅ KeyConfig管理クラス統合');
    console.log('   - ✅ 素の方向キー処理の新規実装');
    console.log('   - ✅ GIF操作用キー予約完了');
    console.log('   - 🔧 System integration with enhanced EventBus');
    console.log('   - PixiJS v8.13 Graphics API準拠');
    console.log('   - Existing compatibility maintained');

})();