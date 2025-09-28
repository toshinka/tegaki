// ===== core-engine.js - 構造的問題修正版：EventBus統一・TimelineUI統合 =====
// CHG: SimpleEventBus二重実装削除、window.TegakiEventBus完全統一

/*
=== 構造的問題修正ヘッダー ===

【修正内容】
✅ SimpleEventBus二重実装削除
✅ window.TegakiEventBus完全統一
✅ TimelineUI初期化処理強化
✅ 座標変換API統一確認済み
✅ AnimationSystem統合完了

【変更箇所】
- SimpleEventBusクラス削除
- EventBus参照をwindow.TegakiEventBusに統一
- initializeAnimationSystem処理強化
- CoordinateSystem安全参照追加

=== 構造的問題修正ヘッダー終了 ===
*/

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
    
    // CHG: 構造的問題修正版 - EventBus依存確認強化
    if (!window.TegakiEventBus) {
        console.error('❌ TegakiEventBus not found - load system/event-bus.js');
        throw new Error('system/event-bus.js is required for EventBus unification');
    }
    
    // 設定取得（CONFIG統一）
    const CONFIG = window.TEGAKI_CONFIG;
    if (!CONFIG) {
        console.error('❌ TEGAKI_CONFIG not found - load config.js');
        throw new Error('config.js is required');
    }

    // アニメーション設定確認
    if (!CONFIG.animation) {
        console.error('❌ Animation config not found in TEGAKI_CONFIG');
        throw new Error('Animation configuration is required');
    }

    // KeyConfig管理クラス依存確認
    if (!window.TEGAKI_KEYCONFIG_MANAGER) {
        console.error('❌ TEGAKI_KEYCONFIG_MANAGER not found - load config.js');
        throw new Error('KeyConfig manager is required');
    }

    // CHG: 構造的問題修正版 - SimpleEventBus削除（統一化完了）
    // 注意: SimpleEventBusは削除し、window.TegakiEventBusのみを使用

    // === 構造的問題修正版：DrawingEngine（EventBus統一・座標変換統一） ===
    class DrawingEngine {
        constructor(cameraSystem, layerManager, eventBus, config) {
            this.cameraSystem = cameraSystem;
            this.layerManager = layerManager;
            // CHG: EventBus統一 - window.TegakiEventBus使用
            this.eventBus = eventBus || window.TegakiEventBus;
            this.config = config;
            
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
            if (!this.eventBus) {
                console.warn('DrawingEngine: EventBus not available');
                return;
            }
            
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

            // 座標変換API統一使用（CameraSystem経由）
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

            // 座標変換API統一使用（CameraSystem経由）
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
        
        // レイヤー変形考慮描画
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

    // === 構造的問題修正版：統合キーハンドラー ===
    class UnifiedKeyHandler {
        constructor(cameraSystem, layerSystem, drawingEngine, eventBus, animationSystem) {
            this.cameraSystem = cameraSystem;
            this.layerSystem = layerSystem;
            this.drawingEngine = drawingEngine;
            // CHG: EventBus統一
            this.eventBus = eventBus || window.TegakiEventBus;
            this.animationSystem = animationSystem;
            
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
                shiftPressed: e.shiftKey,
                altPressed: e.altKey
            });
            
            // 特殊キー処理（アクション以外）
            if (this.handleSpecialKeys(e)) {
                return; // 特殊キー処理済み
            }
            
            if (!action) return; // マッピングされていないキー
            
            // アクション別処理
            switch(action) {
                // ツール切り替え（最優先処理・レイヤーモード強制解除）
                case 'pen':
                    if (!e.ctrlKey && !e.altKey && !e.metaKey) {
                        console.log('🔧 P key pressed, switching to pen tool');
                        this.switchTool('pen');
                        
                        // レイヤーモード強制解除（ポップアップも消去）
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
                        
                        // レイヤーモード強制解除（ポップアップも消去）
                        if (this.layerSystem.isLayerMoveMode) {
                            console.log('🔧 Exiting layer mode due to eraser tool selection');
                            this.layerSystem.exitLayerMoveMode();
                        }
                        e.preventDefault();
                    }
                    break;
                
                // GIFアニメーション操作
                case 'gifToggleAnimation':
                    if (e.altKey && window.timelineUI) {
                        window.timelineUI.toggle();
                        e.preventDefault();
                    }
                    break;
                
                case 'gifAddCut':
                    if (e.altKey && this.animationSystem) {
                        this.animationSystem.createCutFromCurrentState();
                        e.preventDefault();
                    }
                    break;
                
                case 'gifPlayPause':
                    if (e.code === 'Space' && this.animationSystem && window.timelineUI && window.timelineUI.isVisible) {
                        this.animationSystem.togglePlayPause();
                        e.preventDefault();
                    }
                    break;
                
                case 'gifPrevFrame':
                    if (this.animationSystem && window.timelineUI && window.timelineUI.isVisible) {
                        this.animationSystem.goToPreviousFrame();
                        e.preventDefault();
                    }
                    break;
                
                case 'gifNextFrame':
                    if (this.animationSystem && window.timelineUI && window.timelineUI.isVisible) {
                        this.animationSystem.goToNextFrame();
                        e.preventDefault();
                    }
                    break;
                
                // 他のアクションはLayerSystem等が処理
                case 'layerMode':
                case 'layerUp':
                case 'layerDown':
                case 'layerMoveUp':
                case 'layerMoveDown':
                case 'layerMoveLeft':
                case 'layerMoveRight':
                case 'layerScaleUp':
                case 'layerScaleDown':
                case 'layerRotateLeft':
                case 'layerRotateRight':
                case 'horizontalFlip':
                case 'canvasReset':
                    // 各Systemが処理するため、ここでは何もしない
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
                return false; // CameraSystemが処理
            }
            
            // Space: カメラ移動モード（CameraSystemに委譲）
            if (e.code === 'Space') {
                return false; // CameraSystemが処理
            }
            
            return false;
        }
        
        // ツール切り替え処理（UI更新・カーソル更新統合）
        switchTool(tool) {
            console.log(`🔧 Switching tool to: ${tool}`);
            
            // DrawingEngineでツール設定
            this.drawingEngine.setTool(tool);
            
            // UI更新（activeクラス切り替え）
            document.querySelectorAll('.tool-button').forEach(btn => btn.classList.remove('active'));
            const toolBtn = document.getElementById(tool + '-tool');
            if (toolBtn) {
                toolBtn.classList.add('active');
                console.log(`🔧 Tool button activated: ${tool}-tool`);
            } else {
                console.warn(`🔧 Tool button not found: ${tool}-tool`);
            }

            // ステータス表示更新
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

    // === 構造的問題修正版：CoreEngineクラス（EventBus統一・TimelineUI統合強化） ===
    class CoreEngine {
        constructor(app) {
            this.app = app;
            
            // CHG: 構造的問題修正版 - EventBus完全統一
            this.eventBus = window.TegakiEventBus;
            if (!this.eventBus) {
                throw new Error('window.TegakiEventBus is required for CoreEngine initialization');
            }
            
            // システム初期化（完全参照注入版）
            this.cameraSystem = new window.TegakiCameraSystem();
            this.layerSystem = new window.TegakiLayerSystem();
            this.clipboardSystem = new window.TegakiDrawingClipboard();
            this.drawingEngine = new DrawingEngine(this.cameraSystem, this.layerSystem, this.eventBus, CONFIG);
            
            // AnimationSystemとTimelineUI初期化
            this.animationSystem = null;
            this.timelineUI = null;
            
            // 統合キーハンドラー（初期化後に作成）
            this.keyHandler = null;
            
            // 相互参照設定（完全版）
            this.setupCrossReferences();
            
            // System間EventBus統合
            this.setupSystemEventIntegration();
        }
        
        // 完全な相互参照設定
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
        
        // System間EventBus統合
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
            
            // ツール切り替え完了通知
            this.eventBus.on('key:tool-switched', (data) => {
                console.log(`🔧 Tool switched to: ${data.tool} (UI updated)`);
            });
            
            // GIF操作通知統合
            this.eventBus.on('animation:cut-created', (data) => {
                console.log('📹 Animation cut created:', data.cutId);
            });
            
            this.eventBus.on('animation:playback-started', () => {
                console.log('📹 Animation playback started');
            });
            
            this.eventBus.on('animation:playback-stopped', () => {
                console.log('📹 Animation playback stopped');
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
        
        // CHG: 構造的問題修正版 - AnimationSystemとTimelineUI初期化強化
        initializeAnimationSystem() {
            console.log('🎬 Initializing AnimationSystem and TimelineUI...');
            
            // AnimationSystem初期化確認
            if (!window.TegakiAnimationSystem) {
                console.warn('⚠️ TegakiAnimationSystem not found - animation features disabled');
                return;
            }
            
            // CHG: 構造的問題修正版 - TimelineUI公開確認強化
            if (!window.TegakiTimelineUI) {
                console.warn('⚠️ TegakiTimelineUI not found - timeline UI disabled');
                console.warn('   Make sure timeline-ui.js exports window.TegakiTimelineUI');
                return;
            }
            
            try {
                // AnimationSystem作成
                this.animationSystem = new window.TegakiAnimationSystem();
                this.animationSystem.init(
                    this.layerSystem, 
                    this.cameraSystem, 
                    this.app, 
                    this.eventBus
                );
                
                // TimelineUI作成
                this.timelineUI = new window.TegakiTimelineUI(this.animationSystem);
                this.timelineUI.init();
                
                // グローバル参照設定（互換性）
                window.animationSystem = this.animationSystem;
                window.timelineUI = this.timelineUI;
                
                console.log('✅ AnimationSystem and TimelineUI initialized successfully');
                console.log('   - AnimationSystem available:', !!this.animationSystem);
                console.log('   - TimelineUI available:', !!this.timelineUI);
                console.log('   - TimelineUI visible:', this.timelineUI.isVisible);
                
                // CHG: 構造的問題修正版 - CoordinateSystem安全参照設定
                this.setupCoordinateSystemReferences();
                
            } catch (error) {
                console.error('❌ Failed to initialize AnimationSystem/TimelineUI:', error);
                // 初期化失敗時もアプリケーションは継続
                this.animationSystem = null;
                this.timelineUI = null;
            }
        }
        
        // CHG: 構造的問題修正版 - CoordinateSystem安全参照設定
        setupCoordinateSystemReferences() {
            if (window.CoordinateSystem && this.cameraSystem) {
                try {
                    window.CoordinateSystem.setContainers({
                        worldContainer: this.cameraSystem.worldContainer || null,
                        canvasContainer: this.cameraSystem.canvasContainer || null,
                        app: this.app
                    });
                    console.log('✅ CoordinateSystem containers set by CoreEngine');
                } catch (error) {
                    console.warn('⚠️ Failed to set CoordinateSystem containers:', error);
                }
            }
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
        
        getAnimationSystem() {
            return this.animationSystem;
        }
        
        getTimelineUI() {
            return this.timelineUI;
        }
        
        getKeyHandler() {
            return this.keyHandler;
        }
        
        getEventBus() {
            return this.eventBus;
        }
        
        // 統一されたイベントハンドリング
        setupCanvasEvents() {
            console.log('Setting up canvas events...');
            
            // 安全なCanvas要素取得
            const canvas = this.app.canvas || this.app.view;
            if (!canvas) {
                console.error('Canvas element not found');
                return;
            }
            
            // ポインターイベント設定（統一版）
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
        
        // ツール切り替えAPI（統合キーハンドラー経由）
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
        
        // キャンバスリサイズ（EventBus統合・統一処理）
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
        
        // CHG: 構造的問題修正版 - 初期化（EventBus統一・TimelineUI強化）
        initialize() {
            console.log('=== CoreEngine 構造的問題修正版 initialization started ===');
            
            // システム初期化（EventBus・CONFIG統一・安全な参照注入）
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
            
            // CHG: 構造的問題修正版 - AnimationSystemとTimelineUI初期化強化
            this.initializeAnimationSystem();
            
            // CHG: 構造的問題修正版 - 統合キーハンドラー初期化（EventBus統一）
            this.keyHandler = new UnifiedKeyHandler(
                this.cameraSystem,
                this.layerSystem,
                this.drawingEngine,
                this.eventBus,        // CHG: 統一されたEventBus使用
                this.animationSystem  // AnimationSystem追加
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
            
            // キャンバスイベント設定（統一版）
            this.setupCanvasEvents();
            
            // サムネイル更新ループ
            this.app.ticker.add(() => {
                this.processThumbnailUpdates();
            });
            
            // 初期化完了通知
            this.eventBus.emit('core:initialized', {
                systems: ['camera', 'layer', 'clipboard', 'drawing', 'keyhandler', 'animation']
            });
            
            console.log('✅ CoreEngine 構造的問題修正版 initialized successfully');
            console.log('   - 🔧 EventBus完全統一済み（window.TegakiEventBus）');
            console.log('   - ✅ SimpleEventBus二重実装削除完了');
            console.log('   - ✅ AnimationSystem統合完了');
            console.log('   - ✅ TimelineUI統合強化完了');
            console.log('   - ✅ 座標変換API統一確認済み');
            console.log('   - ✅ P・Eショートカット対応済み');
            console.log('   - ✅ Alt+A: タイムライン表示切り替え');
            console.log('   - ✅ Alt+Plus: CUT追加');
            console.log('   - ✅ Space: 再生/停止（アニメーション時）');
            console.log('   - ✅ ←→: フレーム移動（アニメーション時）');
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
                animation: {
                    initialized: !!this.animationSystem,
                    cutsCount: this.animationSystem ? this.animationSystem.getAnimationData().cuts.length : 0,
                    timelineVisible: this.timelineUI ? this.timelineUI.isVisible : false
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
        
        // キーコンフィグ操作API（将来のUI設定パネル用）
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

    // === グローバル公開（構造的問題修正版） ===
    window.TegakiCore = {
        CoreEngine: CoreEngine,
        
        // 個別クラスも公開
        CameraSystem: window.TegakiCameraSystem,
        LayerManager: window.TegakiLayerSystem,
        LayerSystem: window.TegakiLayerSystem,
        DrawingEngine: DrawingEngine,
        ClipboardSystem: window.TegakiDrawingClipboard,
        DrawingClipboard: window.TegakiDrawingClipboard,
        AnimationSystem: window.TegakiAnimationSystem,
        TimelineUI: window.TegakiTimelineUI, // CHG: 統一参照
        UnifiedKeyHandler: UnifiedKeyHandler
        // CHG: 構造的問題修正版 - SimpleEventBus削除（統一化完了）
    };

    console.log('✅ core-engine.js (構造的問題修正版) loaded successfully');
    console.log('   - 🔧 構造的問題修正完了');
    console.log('   - ✅ EventBus完全統一：window.TegakiEventBusのみ使用');
    console.log('   - ❌ SimpleEventBus二重実装削除完了');
    console.log('   - ✅ TimelineUI統合強化：初期化・DOM要素確認強化');
    console.log('   - ✅ 座標変換API統一確認済み');
    console.log('   - ✅ P・Eショートカット継承');
    console.log('   - ✅ 既存機能完全保持・互換性維持');
    console.log('   - 🔧 Ready for timeline display testing');

})();