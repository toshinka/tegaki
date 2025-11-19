/**
 * ============================================================================
 * coordinate-system.js - Phase 1 Debug Version
 * ============================================================================
 * 責務: 座標変換パイプライン Screen → Canvas → World → Local の統一管理
 * 
 * 親依存:
 *   - config.js (CONFIG)
 *   - system/event-bus.js (EventBus)
 *   - system/camera-system.js (cameraSystem)
 * 
 * 子依存:
 *   - system/drawing/drawing-engine.js
 *   - system/drawing/stroke-recorder.js
 *   - system/drawing/pointer-handler.js
 * 
 * 変更履歴:
 *   v8.14.0: WebGL2対応版
 *   Phase 1: デバッグログ追加・NaN検出・worldTransform更新保証
 * ============================================================================
 */

class CoordinateSystem {
  constructor() {
    this.initialized = false;
    this.canvas = null;
    this.pixiApp = null;
    this.worldContainer = null;
    this.eventBus = null;
    this.config = null;
    
    // デバッグフラグ (本番では false)
    this.DEBUG_COORD = false;
  }

  /**
   * 初期化
   */
  initialize(canvas, pixiApp, eventBus) {
    if (this.initialized) {
      console.warn('[CoordinateSystem] Already initialized');
      return;
    }

    this.canvas = canvas;
    this.pixiApp = pixiApp;
    this.eventBus = eventBus;
    this.config = window.CONFIG;

    if (!this.canvas || !this.pixiApp || !this.eventBus) {
      console.error('[CoordinateSystem] Missing dependencies', {
        canvas: !!this.canvas,
        pixiApp: !!this.pixiApp,
        eventBus: !!this.eventBus
      });
      return;
    }

    this.worldContainer = this._getWorldContainer();
    
    if (!this.worldContainer) {
      console.error('[CoordinateSystem] worldContainer not found');
      return;
    }

    this._setupEventListeners();
    this.initialized = true;
    
    console.log('[CoordinateSystem] Initialized', {
      canvasSize: { width: this.canvas.width, height: this.canvas.height },
      worldContainer: this.worldContainer.label || 'unnamed'
    });
  }

  /**
   * worldContainer取得（改善版）
   */
  _getWorldContainer() {
    // 優先順位1: window.worldContainer
    if (window.worldContainer && window.worldContainer.label === 'worldContainer') {
      return window.worldContainer;
    }

    // 優先順位2: cameraSystem経由
    if (window.cameraSystem?.worldContainer) {
      return window.cameraSystem.worldContainer;
    }

    // 優先順位3: pixiApp.stage検索
    if (this.pixiApp?.stage) {
      const found = this.pixiApp.stage.children.find(
        child => child.label === 'worldContainer' || 
                 child.name === 'worldContainer' ||
                 child.label === 'world_container' ||
                 child.name === 'world_container'
      );
      if (found) {
        console.log('[CoordinateSystem] Found worldContainer via pixiApp.stage search');
        return found;
      }
    }

    // 優先順位4: グローバルapp経由
    const app = window.pixiApp || window.app;
    if (app?.stage) {
      const found = app.stage.children.find(
        child => child.label === 'worldContainer' || 
                 child.name === 'worldContainer'
      );
      if (found) {
        console.log('[CoordinateSystem] Found worldContainer via app.stage search');
        return found;
      }
    }

    console.error('[CoordinateSystem] worldContainer not found in any location');
    console.log('[CoordinateSystem] Available:', {
      'window.worldContainer': !!window.worldContainer,
      'window.cameraSystem': !!window.cameraSystem,
      'window.cameraSystem.worldContainer': !!window.cameraSystem?.worldContainer,
      'pixiApp': !!this.pixiApp,
      'pixiApp.stage': !!this.pixiApp?.stage,
      'pixiApp.stage.children.length': this.pixiApp?.stage?.children?.length
    });
    
    return null;
  }

  /**
   * イベントリスナー設定
   */
  _setupEventListeners() {
    if (!this.eventBus) return;

    // キャンバスリサイズ
    this.eventBus.on('canvas:resize', () => {
      if (this.DEBUG_COORD) {
        console.log('[CoordinateSystem] canvas:resize event received');
      }
    });

    // カメラ変換変更
    this.eventBus.on('camera:transform-changed', () => {
      if (this.DEBUG_COORD) {
        console.log('[CoordinateSystem] camera:transform-changed event received');
      }
    });
  }

  /**
   * ============================================================================
   * Screen → Canvas 座標変換
   * ============================================================================
   * PointerEvent.clientX/Y (ブラウザウィンドウ基準) → Canvas座標 (DPI補正後)
   */
  screenClientToCanvas(clientX, clientY) {
    if (!this.canvas) {
      console.error('[CoordinateSystem] Canvas not available');
      return null;
    }

    const rect = this.canvas.getBoundingClientRect();
    
    // DPI補正係数計算
    const scaleX = this.canvas.width / rect.width;
    const scaleY = this.canvas.height / rect.height;

    const canvasX = (clientX - rect.left) * scaleX;
    const canvasY = (clientY - rect.top) * scaleY;

    // NaN検出
    if (isNaN(canvasX) || isNaN(canvasY)) {
      console.error('[CoordinateSystem] screenClientToCanvas returned NaN', {
        clientX, clientY,
        rect: { left: rect.left, top: rect.top, width: rect.width, height: rect.height },
        canvas: { width: this.canvas.width, height: this.canvas.height },
        scale: { scaleX, scaleY }
      });
      return null;
    }

    if (this.DEBUG_COORD) {
      console.log('[screenClientToCanvas]', {
        input: { clientX, clientY },
        rect: { left: rect.left, top: rect.top },
        scale: { scaleX, scaleY },
        output: { canvasX, canvasY }
      });
    }

    return { canvasX, canvasY };
  }

  /**
   * ============================================================================
   * Canvas → World 座標変換
   * ============================================================================
   * Canvas座標 → World座標 (worldContainer基準、ズーム・パン適用前)
   */
  canvasToWorld(canvasX, canvasY) {
    const worldContainer = this._getWorldContainer();
    
    if (!worldContainer) {
      console.warn('[CoordinateSystem] worldContainer not available, using canvas coords');
      return { worldX: canvasX, worldY: canvasY };
    }

    // 🔧 Phase 1修正: worldTransform更新保証
    worldContainer.updateTransform();

    const worldTransform = worldContainer.worldTransform;
    
    if (worldTransform && typeof worldTransform.applyInverse === 'function') {
      try {
        const point = worldTransform.applyInverse({ x: canvasX, y: canvasY });
        
        // NaN検出
        if (isNaN(point.x) || isNaN(point.y)) {
          console.error('[CoordinateSystem] canvasToWorld returned NaN', {
            input: { canvasX, canvasY },
            point,
            worldTransform: {
              a: worldTransform.a,
              b: worldTransform.b,
              c: worldTransform.c,
              d: worldTransform.d,
              tx: worldTransform.tx,
              ty: worldTransform.ty
            }
          });
          return this._fallbackCanvasToWorld(canvasX, canvasY, worldContainer);
        }

        if (this.DEBUG_COORD) {
          console.log('[canvasToWorld]', {
            input: { canvasX, canvasY },
            worldTransform: { tx: worldTransform.tx, ty: worldTransform.ty },
            output: { worldX: point.x, worldY: point.y }
          });
        }

        return { worldX: point.x, worldY: point.y };
        
      } catch (error) {
        console.error('[CoordinateSystem] worldTransform.applyInverse() error:', error);
        return this._fallbackCanvasToWorld(canvasX, canvasY, worldContainer);
      }
    }

    // worldTransform利用不可の場合はFallback
    return this._fallbackCanvasToWorld(canvasX, canvasY, worldContainer);
  }

  /**
   * Fallback手動変換 (worldTransform利用不可時)
   */
  _fallbackCanvasToWorld(canvasX, canvasY, worldContainer) {
    const pos = worldContainer.position || { x: 0, y: 0 };
    const scale = worldContainer.scale || { x: 1, y: 1 };
    const pivot = worldContainer.pivot || { x: 0, y: 0 };
    const rotation = worldContainer.rotation || 0;

    let x = canvasX - pos.x;
    let y = canvasY - pos.y;

    // 回転補正
    if (Math.abs(rotation) > 1e-6) {
      const cos = Math.cos(-rotation);
      const sin = Math.sin(-rotation);
      const rx = x * cos - y * sin;
      const ry = x * sin + y * cos;
      x = rx;
      y = ry;
    }

    // スケール補正
    if (Math.abs(scale.x) > 1e-6) x = x / scale.x;
    if (Math.abs(scale.y) > 1e-6) y = y / scale.y;

    // Pivot補正
    x = x + pivot.x;
    y = y + pivot.y;

    if (this.DEBUG_COORD) {
      console.log('[_fallbackCanvasToWorld]', {
        input: { canvasX, canvasY },
        transform: { pos, scale, rotation, pivot },
        output: { worldX: x, worldY: y }
      });
    }

    return { worldX: x, worldY: y };
  }

  /**
   * ============================================================================
   * World → Local 座標変換
   * ============================================================================
   * World座標 → Local座標 (container基準、親チェーン遡査による手動逆変換)
   * 
   * 注意: PIXI v8 toLocal()は使用禁止 (worldContainer.positionが混入するため)
   */
  worldToLocal(worldX, worldY, container) {
    if (!container) {
      console.warn('[CoordinateSystem] worldToLocal: container is null');
      return { localX: worldX, localY: worldY };
    }

    if (this.DEBUG_COORD) {
      console.log('[worldToLocal] Input:', {
        worldX,
        worldY,
        containerLabel: container.label || container.name || 'unnamed'
      });
    }

    const transforms = [];
    let node = container;
    const worldContainer = this._getWorldContainer();

    // 親チェーン遡査 (無限ループ防止)
    let depth = 0;
    const MAX_DEPTH = 20;

    while (node && node !== worldContainer && node !== null) {
      if (depth++ > MAX_DEPTH) {
        console.error('[CoordinateSystem] worldToLocal: parent chain too deep (infinite loop?)');
        break;
      }

      transforms.push({
        pos: node.position || { x: 0, y: 0 },
        scale: node.scale || { x: 1, y: 1 },
        rotation: node.rotation || 0,
        pivot: node.pivot || { x: 0, y: 0 },
        label: node.label || node.name || 'unknown'
      });

      node = node.parent;
    }

    if (this.DEBUG_COORD) {
      console.log('[worldToLocal] Transform chain:', transforms.map(t => t.label));
    }

    // 親から子へ逆順に変換適用
    let x = worldX;
    let y = worldY;

    for (let i = transforms.length - 1; i >= 0; i--) {
      const t = transforms[i];

      // Position逆適用
      x -= t.pos.x;
      y -= t.pos.y;

      // Rotation逆適用
      if (Math.abs(t.rotation) > 1e-6) {
        const cos = Math.cos(-t.rotation);
        const sin = Math.sin(-t.rotation);
        const rx = x * cos - y * sin;
        const ry = x * sin + y * cos;
        x = rx;
        y = ry;
      }

      // Scale逆適用
      if (Math.abs(t.scale.x) > 1e-6) x /= t.scale.x;
      if (Math.abs(t.scale.y) > 1e-6) y /= t.scale.y;

      // Pivot逆適用
      x += t.pivot.x;
      y += t.pivot.y;
    }

    // NaN検出
    if (isNaN(x) || isNaN(y)) {
      console.error('[CoordinateSystem] worldToLocal returned NaN', {
        input: { worldX, worldY },
        output: { x, y },
        transforms: transforms
      });
      return { localX: worldX, localY: worldY };
    }

    if (this.DEBUG_COORD) {
      console.log('[worldToLocal] Output:', { localX: x, localY: y });
    }

    return { localX: x, localY: y };
  }

  /**
   * ============================================================================
   * ユーティリティメソッド
   * ============================================================================
   */

  /**
   * Local → World 座標変換 (参考実装、通常は使用しない)
   */
  localToWorld(localX, localY, container) {
    if (!container) {
      return { worldX: localX, worldY: localY };
    }

    const transforms = [];
    let node = container;
    const worldContainer = this._getWorldContainer();

    while (node && node !== worldContainer && node !== null) {
      transforms.push({
        pos: node.position || { x: 0, y: 0 },
        scale: node.scale || { x: 1, y: 1 },
        rotation: node.rotation || 0,
        pivot: node.pivot || { x: 0, y: 0 }
      });
      node = node.parent;
    }

    let x = localX;
    let y = localY;

    // 子から親へ順に変換適用
    for (let i = 0; i < transforms.length; i++) {
      const t = transforms[i];

      x -= t.pivot.x;
      y -= t.pivot.y;

      if (Math.abs(t.scale.x) > 1e-6) x *= t.scale.x;
      if (Math.abs(t.scale.y) > 1e-6) y *= t.scale.y;

      if (Math.abs(t.rotation) > 1e-6) {
        const cos = Math.cos(t.rotation);
        const sin = Math.sin(t.rotation);
        const rx = x * cos - y * sin;
        const ry = x * sin + y * cos;
        x = rx;
        y = ry;
      }

      x += t.pos.x;
      y += t.pos.y;
    }

    return { worldX: x, worldY: y };
  }

  /**
   * デバッグモード切り替え
   */
  setDebugMode(enabled) {
    this.DEBUG_COORD = enabled;
    console.log(`[CoordinateSystem] Debug mode: ${enabled}`);
  }

  /**
   * 座標変換パイプライン全体テスト
   */
  testFullPipeline(clientX, clientY) {
    console.group('[CoordinateSystem] Full Pipeline Test');
    
    console.log('Input (Screen):', { clientX, clientY });
    
    const canvas = this.screenClientToCanvas(clientX, clientY);
    console.log('Step 1 (Canvas):', canvas);
    
    if (!canvas) {
      console.groupEnd();
      return;
    }
    
    const world = this.canvasToWorld(canvas.canvasX, canvas.canvasY);
    console.log('Step 2 (World):', world);
    
    const activeLayer = window.layerManager?.getActiveLayer();
    if (activeLayer) {
      const local = this.worldToLocal(world.worldX, world.worldY, activeLayer);
      console.log('Step 3 (Local):', local);
      
      // 逆変換テスト
      const worldReverse = this.localToWorld(local.localX, local.localY, activeLayer);
      console.log('Reverse (World):', worldReverse);
      console.log('World diff:', {
        dx: Math.abs(world.worldX - worldReverse.worldX),
        dy: Math.abs(world.worldY - worldReverse.worldY)
      });
    } else {
      console.warn('ActiveLayer not found for Local conversion');
    }
    
    console.groupEnd();
  }

  /**
   * 状態検査
   */
  inspect() {
    console.group('[CoordinateSystem] State Inspection');
    
    console.log('Initialized:', this.initialized);
    console.log('Canvas:', {
      width: this.canvas?.width,
      height: this.canvas?.height,
      rect: this.canvas?.getBoundingClientRect()
    });
    
    const worldContainer = this._getWorldContainer();
    if (worldContainer) {
      console.log('WorldContainer:', {
        label: worldContainer.label || worldContainer.name,
        position: worldContainer.position,
        scale: worldContainer.scale,
        rotation: worldContainer.rotation,
        pivot: worldContainer.pivot,
        worldTransform: worldContainer.worldTransform ? {
          a: worldContainer.worldTransform.a,
          b: worldContainer.worldTransform.b,
          c: worldContainer.worldTransform.c,
          d: worldContainer.worldTransform.d,
          tx: worldContainer.worldTransform.tx,
          ty: worldContainer.worldTransform.ty
        } : null
      });
    } else {
      console.warn('WorldContainer not found');
    }
    
    console.groupEnd();
  }

  /**
   * クリーンアップ
   */
  destroy() {
    this.initialized = false;
    this.canvas = null;
    this.pixiApp = null;
    this.worldContainer = null;
    this.eventBus = null;
    this.config = null;
    console.log('[CoordinateSystem] Destroyed');
  }
}

// グローバル登録
if (typeof window !== 'undefined') {
  window.CoordinateSystem = new CoordinateSystem();
  
  // デバッグ用グローバルコマンド
  window.TegakiDebug = window.TegakiDebug || {};
  window.TegakiDebug.coord = {
    testFullPipeline: (x, y) => window.CoordinateSystem.testFullPipeline(x, y),
    inspectCoordSystem: () => window.CoordinateSystem.inspect(),
    enableDebug: () => window.CoordinateSystem.setDebugMode(true),
    disableDebug: () => window.CoordinateSystem.setDebugMode(false)
  };
}