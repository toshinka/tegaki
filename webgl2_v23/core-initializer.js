/**
 * ================================================================================
 * core-initializer.js Phase 1.1 完全初期化版
 * ================================================================================
 * 責務: アプリケーション全体の初期化順序管理・依存関係注入
 * 親依存: config.js, PixiJS v8, WebGL2DrawingLayer
 * 子依存: 全システムファイル
 * 
 * Phase 1.1 改修内容:
 * ✅ 初期化順序の厳密化（座標系 → カメラ → レイヤー → 描画エンジン）
 * ✅ 依存関係の完全注入確認
 * ✅ 初期化失敗時の詳細エラーログ
 * ✅ CoordinateSystem.initialize() 実装確認・呼び出し
 * ✅ DrawingEngine 依存注入の確実化
 * 
 * 変更履歴:
 * - Phase 1.1: 初期化フロー完全修正（座標ズレ問題対応）
 * - Phase 1.0: WebGL2統合完了版
 * ================================================================================
 */

(function() {
  'use strict';

  const DEBUG = false; // デバッグモード（開発時のみtrue）

  // ================================================================================
  // 初期化状態管理
  // ================================================================================
  const InitState = {
    pixi: false,
    webgl2: false,
    coordinateSystem: false,
    cameraSystem: false,
    layerSystem: false,
    pointerHandler: false,
    pressureHandler: false,
    strokeRecorder: false,
    brushCore: false,
    drawingEngine: false,
    ui: false
  };

  // ================================================================================
  // グローバル参照チェック
  // ================================================================================
  function checkGlobalDependencies() {
    const required = {
      'PIXI': typeof PIXI !== 'undefined',
      'config': typeof window.config !== 'undefined',
      'EventBus': typeof window.EventBus !== 'undefined'
    };

    const missing = Object.keys(required).filter(key => !required[key]);
    
    if (missing.length > 0) {
      console.error('[Init] Missing global dependencies:', missing);
      return false;
    }

    if (DEBUG) {
      console.log('[Init] ✅ All global dependencies present');
    }
    return true;
  }

  // ================================================================================
  // Phase 1: PixiJS初期化
  // ================================================================================
  async function initializePixiJS() {
    if (InitState.pixi) {
      if (DEBUG) console.log('[Init] PixiJS already initialized');
      return true;
    }

    try {
      const canvas = document.getElementById('pixi-canvas');
      if (!canvas) {
        throw new Error('Canvas element #pixi-canvas not found');
      }

      const app = new PIXI.Application();
      await app.init({
        canvas: canvas,
        width: window.config.canvas.width,
        height: window.config.canvas.height,
        backgroundColor: 0xffffee,
        resolution: 1, // DPR=1固定
        autoDensity: false,
        antialias: true,
        powerPreference: 'high-performance',
        eventMode: 'passive' // Pixiのイベント管理を無効化
      });

      // グローバル登録
      window.pixiApp = app;
      window.pixiStage = app.stage;

      // worldContainer作成
      const worldContainer = new PIXI.Container();
      worldContainer.label = 'worldContainer';
      worldContainer.eventMode = 'none'; // イベント無効
      app.stage.addChild(worldContainer);
      window.worldContainer = worldContainer;

      // Ticker停止（WebGL2がマスター）
      app.ticker.stop();

      InitState.pixi = true;
      console.log('[Init] ✅ PixiJS initialized (DPR=1, Ticker stopped)');
      return true;

    } catch (error) {
      console.error('[Init] ❌ PixiJS initialization failed:', error);
      return false;
    }
  }

  // ================================================================================
  // Phase 2: WebGL2初期化
  // ================================================================================
  async function initializeWebGL2() {
    if (InitState.webgl2) {
      if (DEBUG) console.log('[Init] WebGL2 already initialized');
      return true;
    }

    try {
      const canvas = document.getElementById('webgl-canvas');
      if (!canvas) {
        throw new Error('Canvas element #webgl-canvas not found');
      }

      // WebGL2DrawingLayerインスタンス作成
      if (!window.WebGL2DrawingLayer) {
        throw new Error('WebGL2DrawingLayer class not loaded');
      }

      const drawingLayer = new window.WebGL2DrawingLayer();
      const initialized = drawingLayer.initialize(canvas, {
        width: window.config.canvas.width,
        height: window.config.canvas.height,
        dpr: 1
      });

      if (!initialized) {
        throw new Error('WebGL2DrawingLayer.initialize() returned false');
      }

      window.webgl2DrawingLayer = drawingLayer;
      console.log('[Init] ✅ WebGL2DrawingLayer initialized');

      // 各WebGL2コンポーネント初期化
      if (window.GLStrokeProcessor) {
        window.glStrokeProcessor = new window.GLStrokeProcessor();
        window.glStrokeProcessor.initialize(drawingLayer);
        console.log('[Init] ✅ GLStrokeProcessor initialized');
      }

      if (window.GLMSDFPipeline) {
        window.glMSDFPipeline = new window.GLMSDFPipeline();
        window.glMSDFPipeline.initialize(drawingLayer);
        console.log('[Init] ✅ GLMSDFPipeline initialized');
      }

      if (window.GLTextureBridge) {
        window.glTextureBridge = new window.GLTextureBridge();
        window.glTextureBridge.initialize(drawingLayer);
        console.log('[Init] ✅ GLTextureBridge initialized');
      }

      if (window.GLMaskLayer) {
        window.glMaskLayer = new window.GLMaskLayer();
        window.glMaskLayer.initialize(drawingLayer);
        console.log('[Init] ✅ GLMaskLayer initialized');
      }

      if (window.StrokeRenderer) {
        window.strokeRenderer = new window.StrokeRenderer();
        window.strokeRenderer.initialize({
          glStrokeProcessor: window.glStrokeProcessor,
          glMSDFPipeline: window.glMSDFPipeline,
          glTextureBridge: window.glTextureBridge
        });
        console.log('[Init] ✅ StrokeRenderer initialized');
      }

      InitState.webgl2 = true;
      console.log('[Init] ✅ WebGL2 subsystem complete');
      return true;

    } catch (error) {
      console.error('[Init] ❌ WebGL2 initialization failed:', error);
      return false;
    }
  }

  // ================================================================================
  // Phase 3: CoordinateSystem初期化
  // ================================================================================
  function initializeCoordinateSystem() {
    if (InitState.coordinateSystem) {
      if (DEBUG) console.log('[Init] CoordinateSystem already initialized');
      return true;
    }

    try {
      if (!window.CoordinateSystem) {
        throw new Error('CoordinateSystem not loaded');
      }

      // 🔧 Phase 1.1 重要: initialize()メソッドが存在する場合は呼び出す
      if (typeof window.CoordinateSystem.initialize === 'function') {
        const result = window.CoordinateSystem.initialize();
        if (!result) {
          throw new Error('CoordinateSystem.initialize() returned false');
        }
        console.log('[Init] ✅ CoordinateSystem.initialize() called');
      } else {
        console.warn('[Init] ⚠️ CoordinateSystem.initialize() not found (using static methods)');
      }

      // 必須メソッド確認
      const requiredMethods = [
        'screenClientToCanvas',
        'canvasToWorld',
        'worldToLocal'
      ];

      for (const method of requiredMethods) {
        if (typeof window.CoordinateSystem[method] !== 'function') {
          throw new Error(`CoordinateSystem.${method}() not found`);
        }
      }

      InitState.coordinateSystem = true;
      console.log('[Init] ✅ CoordinateSystem ready');
      return true;

    } catch (error) {
      console.error('[Init] ❌ CoordinateSystem initialization failed:', error);
      return false;
    }
  }

  // ================================================================================
  // Phase 4: CameraSystem初期化
  // ================================================================================
  function initializeCameraSystem() {
    if (InitState.cameraSystem) {
      if (DEBUG) console.log('[Init] CameraSystem already initialized');
      return true;
    }

    try {
      if (!window.CameraSystem) {
        throw new Error('CameraSystem not loaded');
      }

      if (!window.worldContainer) {
        throw new Error('worldContainer not found');
      }

      const cameraSystem = new window.CameraSystem(window.worldContainer);
      window.cameraSystem = cameraSystem;

      InitState.cameraSystem = true;
      console.log('[Init] ✅ CameraSystem initialized');
      return true;

    } catch (error) {
      console.error('[Init] ❌ CameraSystem initialization failed:', error);
      return false;
    }
  }

  // ================================================================================
  // Phase 5: LayerSystem初期化
  // ================================================================================
  function initializeLayerSystem() {
    if (InitState.layerSystem) {
      if (DEBUG) console.log('[Init] LayerSystem already initialized');
      return true;
    }

    try {
      if (!window.LayerSystem) {
        throw new Error('LayerSystem not loaded');
      }

      if (!window.worldContainer) {
        throw new Error('worldContainer not found');
      }

      const layerSystem = new window.LayerSystem(window.worldContainer);
      window.layerManager = layerSystem;

      // 初期レイヤー作成
      const initialLayer = layerSystem.addLayer({
        name: 'Layer 1',
        width: window.config.canvas.width,
        height: window.config.canvas.height
      });

      if (!initialLayer) {
        throw new Error('Failed to create initial layer');
      }

      layerSystem.setActiveLayer(initialLayer.id);

      InitState.layerSystem = true;
      console.log('[Init] ✅ LayerSystem initialized with initial layer');
      return true;

    } catch (error) {
      console.error('[Init] ❌ LayerSystem initialization failed:', error);
      return false;
    }
  }

  // ================================================================================
  // Phase 6: PointerHandler & PressureHandler初期化
  // ================================================================================
  function initializeInputHandlers() {
    if (InitState.pointerHandler && InitState.pressureHandler) {
      if (DEBUG) console.log('[Init] Input handlers already initialized');
      return true;
    }

    try {
      // PointerHandler
      if (window.PointerHandler && !window.pointerHandler) {
        window.pointerHandler = new window.PointerHandler();
        console.log('[Init] ✅ PointerHandler instance created');
      }

      // PressureHandler
      if (window.PressureHandler && !window.pressureHandler) {
        window.pressureHandler = new window.PressureHandler();
        console.log('[Init] ✅ PressureHandler instance created');
      }

      InitState.pointerHandler = !!window.pointerHandler;
      InitState.pressureHandler = !!window.pressureHandler;

      return InitState.pointerHandler && InitState.pressureHandler;

    } catch (error) {
      console.error('[Init] ❌ Input handlers initialization failed:', error);
      return false;
    }
  }

  // ================================================================================
  // Phase 7: StrokeRecorder初期化
  // ================================================================================
  function initializeStrokeRecorder() {
    if (InitState.strokeRecorder) {
      if (DEBUG) console.log('[Init] StrokeRecorder already initialized');
      return true;
    }

    try {
      if (!window.StrokeRecorder) {
        throw new Error('StrokeRecorder not loaded');
      }

      // StrokeRecorderはPhase 0完成版で自動初期化されているはず
      if (!window.strokeRecorder) {
        window.strokeRecorder = new window.StrokeRecorder();
      }

      InitState.strokeRecorder = true;
      console.log('[Init] ✅ StrokeRecorder ready');
      return true;

    } catch (error) {
      console.error('[Init] ❌ StrokeRecorder initialization failed:', error);
      return false;
    }
  }

  // ================================================================================
  // Phase 8: BrushCore初期化
  // ================================================================================
  function initializeBrushCore() {
    if (InitState.brushCore) {
      if (DEBUG) console.log('[Init] BrushCore already initialized');
      return true;
    }

    try {
      if (!window.BrushCore) {
        throw new Error('BrushCore not loaded');
      }

      // 必須依存確認
      const dependencies = {
        strokeRecorder: window.strokeRecorder,
        glStrokeProcessor: window.glStrokeProcessor,
        glMSDFPipeline: window.glMSDFPipeline,
        glTextureBridge: window.glTextureBridge,
        glMaskLayer: window.glMaskLayer,
        layerManager: window.layerManager
      };

      const missing = Object.keys(dependencies).filter(key => !dependencies[key]);
      if (missing.length > 0) {
        throw new Error(`BrushCore missing dependencies: ${missing.join(', ')}`);
      }

      const brushCore = new window.BrushCore();
      brushCore.initialize(dependencies);
      window.brushCore = brushCore;

      InitState.brushCore = true;
      console.log('[Init] ✅ BrushCore initialized with dependencies:', Object.keys(dependencies));
      return true;

    } catch (error) {
      console.error('[Init] ❌ BrushCore initialization failed:', error);
      return false;
    }
  }

  // ================================================================================
  // Phase 9: DrawingEngine初期化（最重要）
  // ================================================================================
  function initializeDrawingEngine() {
    if (InitState.drawingEngine) {
      if (DEBUG) console.log('[Init] DrawingEngine already initialized');
      return true;
    }

    try {
      if (!window.DrawingEngine) {
        throw new Error('DrawingEngine class not loaded');
      }

      // 🔧 Phase 1.1 重要: 依存関係の完全注入
      const dependencies = {
        coordSystem: window.CoordinateSystem,
        cameraSystem: window.cameraSystem,
        layerManager: window.layerManager,
        brushCore: window.brushCore,
        pointerHandler: window.pointerHandler,
        pressureHandler: window.pressureHandler,
        strokeRecorder: window.strokeRecorder
      };

      const missing = Object.keys(dependencies).filter(key => !dependencies[key]);
      if (missing.length > 0) {
        throw new Error(`DrawingEngine missing dependencies: ${missing.join(', ')}`);
      }

      // インスタンス作成
      if (!window.drawingEngine) {
        window.drawingEngine = new window.DrawingEngine();
      }

      // 初期化実行
      const initialized = window.drawingEngine.initialize(dependencies);
      if (!initialized) {
        throw new Error('DrawingEngine.initialize() returned false');
      }

      // 初期化状態確認
      if (!window.drawingEngine.initialized) {
        throw new Error('DrawingEngine.initialized flag is false');
      }

      InitState.drawingEngine = true;
      console.log('[Init] ✅ DrawingEngine initialized with complete dependencies');
      
      if (DEBUG) {
        console.log('[Init] DrawingEngine state:', {
          initialized: window.drawingEngine.initialized,
          coordSystem: !!window.drawingEngine.coordSystem,
          layerManager: !!window.drawingEngine.layerManager,
          brushCore: !!window.drawingEngine.brushCore
        });
      }

      return true;

    } catch (error) {
      console.error('[Init] ❌ DrawingEngine initialization failed:', error);
      return false;
    }
  }

  // ================================================================================
  // Phase 10: UI初期化
  // ================================================================================
  function initializeUI() {
    if (InitState.ui) {
      if (DEBUG) console.log('[Init] UI already initialized');
      return true;
    }

    try {
      // PopupManager初期化
      if (window.PopupManager && window.PopupManager.initialize) {
        window.PopupManager.initialize();
      }

      // UIパネル初期化（ui-panels.jsの初期化関数呼び出し）
      if (typeof window.initializeUIPanels === 'function') {
        window.initializeUIPanels();
      }

      // KeyboardHandler初期化
      if (window.KeyboardHandler && typeof window.KeyboardHandler.initialize === 'function') {
        window.KeyboardHandler.initialize();
      }

      InitState.ui = true;
      console.log('[Init] ✅ UI subsystem initialized');
      return true;

    } catch (error) {
      console.error('[Init] ❌ UI initialization failed:', error);
      return false;
    }
  }

  // ================================================================================
  // メイン初期化シーケンス
  // ================================================================================
  async function initializeApp() {
    console.log('[Init] 🚀 Starting application initialization (Phase 1.1)...');

    // グローバル依存チェック
    if (!checkGlobalDependencies()) {
      console.error('[Init] ❌ Global dependencies check failed');
      return false;
    }

    // 初期化シーケンス（順序厳守）
    const sequence = [
      { name: 'PixiJS', fn: initializePixiJS },
      { name: 'WebGL2', fn: initializeWebGL2 },
      { name: 'CoordinateSystem', fn: initializeCoordinateSystem },
      { name: 'CameraSystem', fn: initializeCameraSystem },
      { name: 'LayerSystem', fn: initializeLayerSystem },
      { name: 'InputHandlers', fn: initializeInputHandlers },
      { name: 'StrokeRecorder', fn: initializeStrokeRecorder },
      { name: 'BrushCore', fn: initializeBrushCore },
      { name: 'DrawingEngine', fn: initializeDrawingEngine },
      { name: 'UI', fn: initializeUI }
    ];

    for (const step of sequence) {
      console.log(`[Init] Initializing ${step.name}...`);
      const success = await step.fn();
      
      if (!success) {
        console.error(`[Init] ❌ ${step.name} initialization failed - stopping sequence`);
        return false;
      }
    }

    console.log('[Init] ✅ All systems initialized successfully');
    console.log('[Init] 📊 Initialization state:', InitState);

    // 最終検証
    return validateInitialization();
  }

  // ================================================================================
  // 初期化検証
  // ================================================================================
  function validateInitialization() {
    const checks = {
      'PixiJS app': !!window.pixiApp,
      'worldContainer': !!window.worldContainer,
      'WebGL2 layer': !!window.webgl2DrawingLayer,
      'CoordinateSystem': !!window.CoordinateSystem,
      'CameraSystem': !!window.cameraSystem,
      'LayerManager': !!window.layerManager,
      'DrawingEngine': !!window.drawingEngine,
      'DrawingEngine initialized': window.drawingEngine?.initialized === true,
      'BrushCore': !!window.brushCore
    };

    const failed = Object.keys(checks).filter(key => !checks[key]);

    if (failed.length > 0) {
      console.error('[Init] ❌ Validation failed:', failed);
      console.table(checks);
      return false;
    }

    console.log('[Init] ✅ Validation passed');
    return true;
  }

  // ================================================================================
  // DOMContentLoaded起動
  // ================================================================================
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeApp);
  } else {
    initializeApp();
  }

  // デバッグ用グローバル公開
  window.TegakiDebug = window.TegakiDebug || {};
  window.TegakiDebug.initState = InitState;
  window.TegakiDebug.reinitialize = initializeApp;

})();