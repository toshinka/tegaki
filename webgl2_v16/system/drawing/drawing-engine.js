/**
 * ============================================================================
 * drawing-engine.js - Phase 1 Debug Version
 * ============================================================================
 * 責務: PointerEvent受信・座標変換実行・BrushCoreへの描画命令委譲
 * 
 * 親依存:
 *   - coordinate-system.js (CoordinateSystem)
 *   - system/camera-system.js (cameraSystem)
 *   - system/layer-system.js (layerManager)
 *   - system/drawing/brush-core.js (BrushCore)
 *   - system/drawing/pointer-handler.js (PointerHandler)
 * 
 * 子依存:
 *   - core-engine.js (初期化呼び出し元)
 * 
 * 変更履歴:
 *   v8.14.1: WebGL2移行版
 *   Phase 1: デバッグログ追加・エラーハンドリング強化・CoordinateSystem初期化確認
 * ============================================================================
 */

class DrawingEngine {
  constructor() {
    this.initialized = false;
    this.isDrawing = false;
    this.currentMode = 'pen';
    
    // 依存関係
    this.coordSystem = null;
    this.cameraSystem = null;
    this.layerManager = null;
    this.brushCore = null;
    this.pointerHandler = null;
    this.eventBus = null;
    
    // Pointer管理
    this.pendingPoints = [];
    this.maxPendingPoints = 3;
    this.lastFlushTime = 0;
    this.flushInterval = 16; // ~60fps
    
    // デバッグフラグ
    this.DEBUG_TRANSFORM = false;
    
    // WebGL2キャンバス参照
    this.glCanvas = null;
  }

  /**
   * 初期化
   */
  initialize(dependencies) {
    if (this.initialized) {
      console.warn('[DrawingEngine] Already initialized');
      return;
    }

    const {
      coordSystem,
      cameraSystem,
      layerManager,
      brushCore,
      pointerHandler,
      eventBus,
      glCanvas
    } = dependencies;

    // 必須依存関係チェック
    const missing = [];
    if (!coordSystem) missing.push('coordSystem');
    if (!cameraSystem) missing.push('cameraSystem');
    if (!layerManager) missing.push('layerManager');
    if (!brushCore) missing.push('brushCore');
    if (!pointerHandler) missing.push('pointerHandler');
    if (!eventBus) missing.push('eventBus');
    if (!glCanvas) missing.push('glCanvas');

    if (missing.length > 0) {
      console.error('[DrawingEngine] Missing dependencies:', missing);
      return;
    }

    this.coordSystem = coordSystem;
    this.cameraSystem = cameraSystem;
    this.layerManager = layerManager;
    this.brushCore = brushCore;
    this.pointerHandler = pointerHandler;
    this.eventBus = eventBus;
    this.glCanvas = glCanvas;

    // CoordinateSystem初期化確認
    if (!this.coordSystem.initialized) {
      console.error('[DrawingEngine] CoordinateSystem is not initialized!');
      console.log('[DrawingEngine] Attempting to initialize CoordinateSystem...');
      
      // Pixiアプリ取得
      const pixiApp = window.pixiApp || window.app;
      if (pixiApp && this.glCanvas && this.eventBus) {
        this.coordSystem.initialize(this.glCanvas, pixiApp, this.eventBus);
        
        if (!this.coordSystem.initialized) {
          console.error('[DrawingEngine] Failed to initialize CoordinateSystem');
          return;
        }
        console.log('[DrawingEngine] ✅ CoordinateSystem initialized successfully');
      } else {
        console.error('[DrawingEngine] Cannot initialize CoordinateSystem - missing dependencies', {
          pixiApp: !!pixiApp,
          glCanvas: !!this.glCanvas,
          eventBus: !!this.eventBus
        });
        return;
      }
    }

    this._setupPointerHandlers();
    this._setupEventListeners();
    
    this.initialized = true;
    console.log('[DrawingEngine] Initialized', {
      coordSystemReady: this.coordSystem.initialized,
      glCanvasSize: { 
        width: this.glCanvas.width, 
        height: this.glCanvas.height 
      }
    });
  }

  /**
   * Pointerハンドラー設定
   */
  _setupPointerHandlers() {
    if (!this.pointerHandler) return;

    // PointerDownイベント
    this.pointerHandler.on('pointerdown', (e) => {
      this._handlePointerDown(e);
    });

    // PointerMoveイベント
    this.pointerHandler.on('pointermove', (e) => {
      this._handlePointerMove(e);
    });

    // PointerUpイベント
    this.pointerHandler.on('pointerup', (e) => {
      this._handlePointerUp(e);
    });
  }

  /**
   * イベントリスナー設定
   */
  _setupEventListeners() {
    if (!this.eventBus) return;

    this.eventBus.on('tool:changed', (data) => {
      this.currentMode = data.tool;
      if (this.DEBUG_TRANSFORM) {
        console.log('[DrawingEngine] Tool changed:', this.currentMode);
      }
    });
  }

  /**
   * ============================================================================
   * Pointer Event Handlers
   * ============================================================================
   */

  /**
   * PointerDown処理
   */
  _handlePointerDown(e) {
    if (!this.initialized || !this.brushCore) return;

    const coords = this._transformPointerToLocal(e);
    if (!coords) {
      console.error('[DrawingEngine] Failed to transform pointer coords on pointerdown');
      return;
    }

    const pressure = e.pressure || 0.5;

    try {
      this.brushCore.startStroke(coords.localX, coords.localY, pressure);
      this.isDrawing = true;
      this.pendingPoints = [];
      this.lastFlushTime = performance.now();

      if (this.DEBUG_TRANSFORM) {
        console.log('[DrawingEngine] Stroke started', {
          local: { x: coords.localX, y: coords.localY },
          pressure
        });
      }
    } catch (error) {
      console.error('[DrawingEngine] Error starting stroke:', error);
      this.isDrawing = false;
    }
  }

  /**
   * PointerMove処理
   */
  _handlePointerMove(e) {
    if (!this.isDrawing || !this.initialized) return;

    const coords = this._transformPointerToLocal(e);
    if (!coords) {
      console.warn('[DrawingEngine] Failed to transform pointer coords on pointermove');
      return;
    }

    const pressure = e.pressure || 0.5;

    // Pending pointsにバッファリング
    this.pendingPoints.push({
      localX: coords.localX,
      localY: coords.localY,
      pressure: pressure,
      timestamp: performance.now()
    });

    // バッファサイズまたは時間間隔でフラッシュ
    const now = performance.now();
    if (
      this.pendingPoints.length >= this.maxPendingPoints ||
      now - this.lastFlushTime >= this.flushInterval
    ) {
      this.flushPendingPoints();
    }
  }

  /**
   * PointerUp処理
   */
  _handlePointerUp(e) {
    if (!this.isDrawing || !this.initialized) return;

    // 残りのポイントをフラッシュ
    this.flushPendingPoints();

    try {
      if (this.brushCore) {
        this.brushCore.finalizeStroke();
      }

      if (this.DEBUG_TRANSFORM) {
        console.log('[DrawingEngine] Stroke finalized');
      }
    } catch (error) {
      console.error('[DrawingEngine] Error finalizing stroke:', error);
    } finally {
      this.isDrawing = false;
      this.pendingPoints = [];
    }
  }

  /**
   * Pending pointsフラッシュ
   */
  flushPendingPoints() {
    if (!this.brushCore || this.pendingPoints.length === 0) return;

    try {
      for (const point of this.pendingPoints) {
        this.brushCore.updateStroke(point.localX, point.localY, point.pressure);
      }

      this.pendingPoints = [];
      this.lastFlushTime = performance.now();
    } catch (error) {
      console.error('[DrawingEngine] Error flushing points:', error);
      this.pendingPoints = [];
    }
  }

  /**
   * ============================================================================
   * 座標変換パイプライン実行
   * ============================================================================
   * PointerEvent → Local座標への変換
   * 
   * フロー:
   *   PointerEvent.clientX/Y
   *   → screenClientToCanvas() [DPI補正]
   *   → canvasToWorld() [worldContainer逆行列]
   *   → worldToLocal() [手動逆算・親チェーン遡査]
   *   → {localX, localY}
   */
  _transformPointerToLocal(e) {
    const coordSys = this.coordSystem;
    
    if (!coordSys || !coordSys.initialized) {
      console.error('[DrawingEngine] CoordinateSystem not initialized');
      return null;
    }

    if (this.DEBUG_TRANSFORM) {
      console.log('[_transformPointerToLocal] Input:', {
        clientX: e.clientX,
        clientY: e.clientY,
        pressure: e.pressure
      });
    }

    // Step 1: Screen → Canvas
    const canvasCoords = coordSys.screenClientToCanvas(e.clientX, e.clientY);
    if (!canvasCoords) {
      console.error('[DrawingEngine] screenClientToCanvas failed');
      return null;
    }

    if (this.DEBUG_TRANSFORM) {
      console.log('[_transformPointerToLocal] Canvas:', canvasCoords);
    }

    // NaN検出
    if (isNaN(canvasCoords.canvasX) || isNaN(canvasCoords.canvasY)) {
      console.error('[DrawingEngine] Canvas coords are NaN');
      return null;
    }

    // Step 2: Canvas → World
    const worldCoords = coordSys.canvasToWorld(canvasCoords.canvasX, canvasCoords.canvasY);
    if (!worldCoords) {
      console.error('[DrawingEngine] canvasToWorld failed');
      return null;
    }

    if (this.DEBUG_TRANSFORM) {
      console.log('[_transformPointerToLocal] World:', worldCoords);
    }

    // NaN検出
    if (isNaN(worldCoords.worldX) || isNaN(worldCoords.worldY)) {
      console.error('[DrawingEngine] World coords are NaN');
      return null;
    }

    // Step 3: activeLayer取得
    const activeLayer = this.layerManager ? this.layerManager.getActiveLayer() : null;
    if (!activeLayer) {
      console.error('[DrawingEngine] No active layer');
      return null;
    }

    // activeLayer検証
    if (this.DEBUG_TRANSFORM) {
      console.log('[_transformPointerToLocal] ActiveLayer:', {
        id: activeLayer.id,
        label: activeLayer.label || activeLayer.name,
        position: activeLayer.position,
        parent: activeLayer.parent?.label || activeLayer.parent?.name || 'none'
      });
    }

    // Step 4: World → Local
    const localCoords = coordSys.worldToLocal(
      worldCoords.worldX,
      worldCoords.worldY,
      activeLayer
    );

    if (!localCoords) {
      console.error('[DrawingEngine] worldToLocal failed');
      return null;
    }

    if (this.DEBUG_TRANSFORM) {
      console.log('[_transformPointerToLocal] Local:', localCoords);
    }

    // NaN検出
    if (isNaN(localCoords.localX) || isNaN(localCoords.localY)) {
      console.error('[DrawingEngine] Local coords are NaN', {
        canvasCoords,
        worldCoords,
        localCoords
      });
      return null;
    }

    return {
      localX: localCoords.localX,
      localY: localCoords.localY,
      worldX: worldCoords.worldX,
      worldY: worldCoords.worldY,
      canvasX: canvasCoords.canvasX,
      canvasY: canvasCoords.canvasY
    };
  }

  /**
   * ============================================================================
   * ユーティリティ
   * ============================================================================
   */

  /**
   * デバッグモード切り替え
   */
  setDebugMode(enabled) {
    this.DEBUG_TRANSFORM = enabled;
    console.log(`[DrawingEngine] Debug mode: ${enabled}`);
  }

  /**
   * 現在の座標変換をテスト
   */
  testCoordinateTransform(clientX, clientY) {
    console.group('[DrawingEngine] Coordinate Transform Test');
    
    const mockEvent = { clientX, clientY, pressure: 0.5 };
    const result = this._transformPointerToLocal(mockEvent);
    
    if (result) {
      console.log('✅ Transform successful:', result);
    } else {
      console.error('❌ Transform failed');
    }
    
    console.groupEnd();
    return result;
  }

  /**
   * 状態検査
   */
  inspect() {
    console.group('[DrawingEngine] State Inspection');
    
    console.log('Initialized:', this.initialized);
    console.log('IsDrawing:', this.isDrawing);
    console.log('CurrentMode:', this.currentMode);
    console.log('PendingPoints:', this.pendingPoints.length);
    
    console.log('Dependencies:', {
      coordSystem: !!this.coordSystem && this.coordSystem.initialized,
      cameraSystem: !!this.cameraSystem,
      layerManager: !!this.layerManager,
      brushCore: !!this.brushCore,
      pointerHandler: !!this.pointerHandler,
      eventBus: !!this.eventBus
    });
    
    console.log('GLCanvas:', {
      width: this.glCanvas?.width,
      height: this.glCanvas?.height
    });
    
    if (this.layerManager) {
      const activeLayer = this.layerManager.getActiveLayer();
      console.log('ActiveLayer:', {
        exists: !!activeLayer,
        id: activeLayer?.id,
        label: activeLayer?.label || activeLayer?.name
      });
    }
    
    console.groupEnd();
  }

  /**
   * ============================================================================
   * 欠落していたメソッド（元実装から復元）
   * ============================================================================
   */

  /**
   * ブラシ設定更新（CoreEngineから呼ばれる）
   */
  setBrushSettings(settings) {
    if (!this.brushCore) {
      console.warn('[DrawingEngine] BrushCore not available');
      return;
    }

    try {
      // BrushCoreに設定を委譲
      if (typeof this.brushCore.updateSettings === 'function') {
        this.brushCore.updateSettings(settings);
      } else if (typeof this.brushCore.setBrushSettings === 'function') {
        this.brushCore.setBrushSettings(settings);
      } else {
        console.warn('[DrawingEngine] BrushCore has no settings update method');
      }
    } catch (error) {
      console.error('[DrawingEngine] Error setting brush settings:', error);
    }
  }

  /**
   * カラー変更
   */
  setColor(color) {
    if (this.brushCore && typeof this.brushCore.setColor === 'function') {
      this.brushCore.setColor(color);
    }
  }

  /**
   * サイズ変更
   */
  setSize(size) {
    if (this.brushCore && typeof this.brushCore.setSize === 'function') {
      this.brushCore.setSize(size);
    }
  }

  /**
   * 不透明度変更
   */
  setOpacity(opacity) {
    if (this.brushCore && typeof this.brushCore.setOpacity === 'function') {
      this.brushCore.setOpacity(opacity);
    }
  }

  /**
   * ツール変更
   */
  setTool(tool) {
    this.currentMode = tool;
    if (this.brushCore && typeof this.brushCore.setMode === 'function') {
      this.brushCore.setMode(tool);
    }
  }

  /**
   * プレビューレンダリング（CoreEngineから呼ばれる）
   */
  renderPreview() {
    if (this.brushCore && typeof this.brushCore.renderPreview === 'function') {
      this.brushCore.renderPreview();
    }
  }

  /**
   * 描画中かどうか
   */
  getIsDrawing() {
    return this.isDrawing;
  }

  /**
   * クリーンアップ
   */
  destroy() {
    this.isDrawing = false;
    this.pendingPoints = [];
    
    // イベントリスナー解除は各ハンドラー側で実施
    
    this.initialized = false;
    this.coordSystem = null;
    this.cameraSystem = null;
    this.layerManager = null;
    this.brushCore = null;
    this.pointerHandler = null;
    this.eventBus = null;
    this.glCanvas = null;
    
    console.log('[DrawingEngine] Destroyed');
  }
}

// グローバル登録
if (typeof window !== 'undefined') {
  window.DrawingEngine = DrawingEngine;
  
  // デバッグ用グローバルコマンド追加
  window.TegakiDebug = window.TegakiDebug || {};
  window.TegakiDebug.drawing = {
    inspectEngine: () => window.drawingEngine?.inspect(),
    enableDebug: () => window.drawingEngine?.setDebugMode(true),
    disableDebug: () => window.drawingEngine?.setDebugMode(false),
    testTransform: (x, y) => window.drawingEngine?.testCoordinateTransform(x, y)
  };
}