/**
 * ============================================================================
 * ファイル名: core-engine.js
 * 責務: 各サブシステムの初期化、接続、ライフサイクル管理を担当する
 * 依存: pixi.js, config.js, system/event-bus.js, coordinate-system.js, system/drawing/brush-core.js, system/drawing/drawing-engine.js, system/camera-system.js, system/layer-system.js, system/history.js
 * 被依存: core-initializer.js
 * 公開API: CoreEngine
 * イベント発火: engine:initialized, engine:ready
 * イベント受信: なし
 * グローバル登録: window.TegakiCoreEngine
 * 実装状態: ♻️移植
 * ============================================================================
 */

import * as PIXI from 'pixi.js';
import { TEGAKI_CONFIG } from './config.js';
import { TegakiEventBus } from './system/event-bus.js';
import { coordinateSystem } from './coordinate-system.js';
import { brushCore } from './system/drawing/brush-core.js';
import { DrawingEngine } from './system/drawing/drawing-engine.js';
import { CameraSystem } from './system/camera-system.js';
import { LayerSystem } from './system/layer-system.js';
import { historyManager } from './system/history.js';
import { StrokeRenderer } from './system/drawing/stroke-renderer.js';
import { StrokeRecorder } from './system/drawing/stroke-recorder.js';
import { BrushSettings } from './system/drawing/brush-settings.js';
import { webglContext } from './system/drawing/webgl2/webgl2-drawing-layer.js';
import { glStrokeProcessor } from './system/drawing/webgl2/gl-stroke-processor.js';
import { glMSDFPipeline } from './system/drawing/webgl2/gl-msdf-pipeline.js';
import { glTextureBridge } from './system/drawing/webgl2/gl-texture-bridge.js';
import { glMaskLayer } from './system/drawing/webgl2/gl-mask-layer.js';
import { TegakiDebug } from './system/debug-utils.js';
import { DOMBuilder } from './ui/dom-builder.js';
import { PopupManager } from './system/popup-manager.js';
import { UIController } from './ui/ui-panels.js';
import { KeyboardHandler } from './ui/keyboard-handler.js';
import { ThumbnailSystem } from './system/drawing/thumbnail-system.js';

// ポップアップのインポート
import { SettingsPopup } from './ui/settings-popup.js';
import { QuickAccessPopup } from './ui/quick-access-popup.js';
import { ResizePopup } from './ui/resize-popup.js';
import { ExportPopup } from './ui/export-popup.js';
import { AlbumPopup } from './ui/album-popup.js';

export class CoreEngine {
    constructor(app, options = {}) {
        this.app = app;
        this.options = options;
        this.config = TEGAKI_CONFIG;
        this.eventBus = TegakiEventBus;
        
        this.coordinateSystem = coordinateSystem;
        this.brushCore = brushCore;
        this.cameraSystem = new CameraSystem();
        this.layerSystem = new LayerSystem();
        this.history = historyManager;
        this.strokeRenderer = null;
        this.strokeRecorder = new StrokeRecorder();
        this.brushSettings = new BrushSettings(this.config, this.eventBus);
        this.thumbnailSystem = ThumbnailSystem;
        this.exportManager = null;
        
        this.drawingEngine = null;
        
        // WebGL2 コンポーネント
        this.webglContext = webglContext;
        this.glStrokeProcessor = glStrokeProcessor;
        this.glMSDFPipeline = glMSDFPipeline;
        this.glTextureBridge = glTextureBridge;
        this.glMaskLayer = glMaskLayer;
        
        // UI コンポーネント
        this.popupManager = new PopupManager(this.eventBus);
        this.uiController = null;
        this.keyboardHandler = KeyboardHandler;
        
        // デバッグツール
        this.debug = TegakiDebug;
        
        // グローバル登録（互換性のため）
        window.strokeRecorder = this.strokeRecorder;
        window.brushSettings = this.brushSettings;
        window.PopupManager = this.popupManager;
        window.KeyboardHandler = this.keyboardHandler;
        window.layerManager = this.layerSystem;
        window.cameraSystem = this.cameraSystem;
        window.ThumbnailSystem = this.thumbnailSystem;
        window.History = this.history;
    }

    async initialize() {
        console.log('[CoreEngine] Initializing sub-systems...');

        // 0. UI構造の構築
        const appElement = document.getElementById('app');
        if (appElement) {
            const mainLayout = DOMBuilder.buildMainLayout();
            appElement.appendChild(mainLayout);
            
            // PixiJSのキャンバスをcanvas-areaのdrawing-canvasに移動
            const drawingCanvasContainer = document.getElementById('drawing-canvas');
            if (drawingCanvasContainer) {
                drawingCanvasContainer.appendChild(this.app.canvas);
                
                // WebGL2キャンバスを同じ場所に配置（重なるように）
                const glCanvas = document.getElementById('webgl2-canvas');
                if (glCanvas) {
                    drawingCanvasContainer.appendChild(glCanvas);
                    glCanvas.width = this.config.canvas.width;
                    glCanvas.height = this.config.canvas.height;
                    glCanvas.style.width = '100%';
                    glCanvas.style.height = '100%';
                    glCanvas.style.pointerEvents = 'none';
                }
            }
            
            const statusPanel = DOMBuilder.buildStatusPanel();
            appElement.appendChild(statusPanel);
        }

        // 1. WebGL2 システムの初期化
        if (this.webglContext) {
            await this.webglContext.initialize();
            const gl = this.webglContext.getGL();
            
            if (gl) {
                this.glStrokeProcessor.initialize(gl);
                await this.glMSDFPipeline.initialize(gl);
                await this.glTextureBridge.initialize(gl, this.app);
                await this.glMaskLayer.initialize(this.config.canvas.width, this.config.canvas.height);
            }
        }

        // 2. 座標システムの初期化
        this.coordinateSystem.init(this.app, this.config, this.eventBus);
        
        // 3. カメラシステムの初期化
        this.cameraSystem.init(this.app.stage, this.eventBus, this.config);
        
        // 4. レイヤーシステムの初期化
        this.layerSystem.init(this.cameraSystem.canvasContainer, this.eventBus, this.config);
        this.layerSystem.setApp(this.app);
        this.layerSystem.setCameraSystem(this.cameraSystem);
        
        // 5. サムネイルシステムの初期化
        this.thumbnailSystem.app = this.app;
        this.thumbnailSystem.init(this.eventBus);

        // 6. ストロークレンダラーの初期化
        this.strokeRenderer = new StrokeRenderer(this.app, this.layerSystem, this.cameraSystem);
        window.strokeRenderer = this.strokeRenderer;
        
        if (this.webglContext?.isInitialized()) {
            await this.strokeRenderer.setWebGLLayer(this.webglContext);
        }

        // 7. 座標システムへの参照設定
        this.coordinateSystem.setContainers({
            worldContainer: this.cameraSystem.worldContainer,
            canvasContainer: this.cameraSystem.canvasContainer,
            app: this.app
        });
        this.coordinateSystem.setCameraSystem(this.cameraSystem);

        // globals 登録（brushCore.init() より前に行う）
        window.layerManager = this.layerSystem;
        window.cameraSystem = this.cameraSystem;
        window.drawingEngine = null; // 後で設定

        // 8. ブラシコアの初期化
        // ブラシコアに必要な参照を設定
        this.brushCore.coordinateSystem = this.coordinateSystem;
        this.brushCore.strokeRecorder = this.strokeRecorder;
        this.brushCore.layerManager = this.layerSystem;
        this.brushCore.strokeRenderer = this.strokeRenderer;
        this.brushCore.brushSettings = this.brushSettings;
        this.brushCore.eventBus = this.eventBus;
        
        this.brushCore.init();
        
        // 9. 描画エンジンの初期化
        this.drawingEngine = new DrawingEngine(
            this.app,
            this.layerSystem,
            this.cameraSystem,
            this.history
        );
        this.drawingEngine.setStrokeRenderer(this.strokeRenderer);
        this.drawingEngine.setBrushSettings(this.brushSettings);
        window.drawingEngine = this.drawingEngine;

        // 10. エクスポートマネージャーの初期化（アニメーションシステムが必要）
        // ※このフェーズでは暫定的に null チェック付きで作成
        if (window.animationSystem) {
            const { ExportManager } = await import('./system/export-manager.js');
            this.exportManager = new ExportManager(this.app, this.layerSystem, window.animationSystem, this.cameraSystem);
            window.exportManager = this.exportManager;
        }

        // 11. ポップアップの登録
        this.popupManager.register('settings', SettingsPopup, {
            drawingEngine: this.drawingEngine
        });
        this.popupManager.register('quickAccess', QuickAccessPopup, {
            brushSettings: this.brushSettings
        });
        this.popupManager.register('resize', ResizePopup, {
            coreEngine: this,
            history: this.history
        });
        this.popupManager.register('export', ExportPopup, {
            exportManager: this.exportManager
        });
        this.popupManager.register('album', AlbumPopup, {
            app: this.app,
            layerSystem: this.layerSystem,
            animationSystem: window.animationSystem
        });

        // 12. ポップアップの初期化実行
        this.popupManager.initializeAll();

        // 13. UI コントローラーの初期化
        this.uiController = new UIController(
            this.drawingEngine,
            this.layerSystem,
            this.app,
            this.popupManager
        );
        window.uiController = this.uiController;
        
        // 13. キーボードハンドラの初期化
        this.keyboardHandler.init();
        
        // 相互参照の解決
        this.cameraSystem.setDrawingEngine(this.drawingEngine);
        this.cameraSystem.setLayerManager(this.layerSystem);
        
        console.log('[CoreEngine] All sub-systems initialized.');
        
        if (this.eventBus) {
            this.eventBus.emit('engine:initialized', {
                timestamp: Date.now()
            });
        }
    }

    getApp() {
        return this.app;
    }

    getLayerSystem() {
        return this.layerSystem;
    }

    getCameraSystem() {
        return this.cameraSystem;
    }

    getDrawingEngine() {
        return this.drawingEngine;
    }

    getBrushCore() {
        return this.brushCore;
    }

    getHistory() {
        return this.history;
    }
}

// 下位互換性のためにグローバルに登録
window.TegakiCoreEngine = CoreEngine;
