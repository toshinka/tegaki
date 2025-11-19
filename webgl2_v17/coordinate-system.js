/**
 * ================================================================================
 * coordinate-system.js - Phase 1.3 最終修正版
 * ================================================================================
 * 責務: 座標変換パイプライン Screen → Canvas → World → Local の統一管理
 * 親依存: config.js, event-bus.js, camera-system.js
 * 子依存: drawing-engine.js, stroke-recorder.js, pointer-handler.js
 * 
 * 🔧 Phase 1.3 修正内容:
 *   - _updateCanvasSize() のロバスト化（rect fallback追加）
 *   - worldContainer グローバル登録の強化
 *   - screenClientToCanvas() の Canvas未初期化時の防御
 *   - updateTransform() 呼び出しを完全削除（fallback専用化）
 * ================================================================================
 */

window.CoordinateSystem = (function() {
  'use strict';

  // ================================================================================
  // 🔧 Private State
  // ================================================================================
  let _initialized = false;
  let _glCanvas = null;
  let _pixiApp = null;
  let _eventBus = null;
  let _cachedWorldContainer = null;
  let _canvasSize = { width: 0, height: 0 };

  // ================================================================================
  // 🔧 worldContainer取得（安全性強化版）
  // ================================================================================
  function _getWorldContainer() {
    // キャッシュ有効性チェック
    if (_cachedWorldContainer && !_cachedWorldContainer.destroyed) {
      return _cachedWorldContainer;
    }

    // 複数の取得経路を試行
    const candidates = [
      window.worldContainer,
      window.cameraSystem?.worldContainer,
      _pixiApp?.stage?.children?.find(c => c.label === 'worldContainer' || c.name === 'worldContainer')
    ];

    for (const container of candidates) {
      if (container && !container.destroyed) {
        // 🔧 親チェーンの健全性検証
        if (!_validateContainerHierarchy(container)) {
          console.warn('[CoordinateSystem] Container found but hierarchy invalid:', container.label || 'unnamed');
          continue;
        }
        
        _cachedWorldContainer = container;
        return container;
      }
    }

    console.error('[CoordinateSystem] worldContainer not found in any location');
    return null;
  }

  // ================================================================================
  // 🔧 NEW: コンテナ階層の健全性検証
  // ================================================================================
  function _validateContainerHierarchy(container) {
    if (!container) return false;
    
    // 必須プロパティの存在確認（rotationは数値でなくてもOK）
    const requiredProps = ['position', 'scale', 'pivot', 'worldTransform'];
    for (const prop of requiredProps) {
      if (!container[prop]) {
        console.warn(`[CoordinateSystem] Container missing property: ${prop}`);
        return false;
      }
    }

    // position/scale/pivotのx/y存在確認
    const requiredSubProps = ['position', 'scale', 'pivot'];
    for (const prop of requiredSubProps) {
      if (container[prop].x === undefined || container[prop].y === undefined) {
        console.warn(`[CoordinateSystem] Container.${prop} missing x or y`);
        return false;
      }
    }

    // rotation は存在しなければ0として扱う（検証不要）
    return true;
  }

  // ================================================================================
  // 🔧 NEW: 親チェーンの修復試行
  // ================================================================================
  function _repairParentChain(container) {
    if (!container || !container.parent) return false;

    let node = container.parent;
    let repaired = false;

    // 親チェーンを遡って未定義プロパティを初期化
    while (node && node !== _pixiApp?.stage) {
      if (!node.position || node.position.x === undefined) {
        console.warn('[CoordinateSystem] Repairing parent.position:', node.label || 'unnamed');
        node.position = { x: 0, y: 0 };
        repaired = true;
      }
      if (!node.scale || node.scale.x === undefined) {
        console.warn('[CoordinateSystem] Repairing parent.scale:', node.label || 'unnamed');
        node.scale = { x: 1, y: 1 };
        repaired = true;
      }
      if (!node.pivot || node.pivot.x === undefined) {
        console.warn('[CoordinateSystem] Repairing parent.pivot:', node.label || 'unnamed');
        node.pivot = { x: 0, y: 0 };
        repaired = true;
      }
      if (node.rotation === undefined) {
        console.warn('[CoordinateSystem] Repairing parent.rotation:', node.label || 'unnamed');
        node.rotation = 0;
        repaired = true;
      }
      node = node.parent;
    }

    return repaired;
  }

  // ================================================================================
  // 🔧 Initialization
  // ================================================================================
  function initialize(glCanvas, pixiApp, eventBus) {
    if (_initialized) {
      console.warn('[CoordinateSystem] Already initialized');
      return true;
    }

    // 🔧 引数検証（eventBusの型チェック追加）
    if (!glCanvas) {
      console.error('[CoordinateSystem] Missing glCanvas');
      return false;
    }
    if (!pixiApp) {
      console.error('[CoordinateSystem] Missing pixiApp');
      return false;
    }
    if (!eventBus) {
      console.error('[CoordinateSystem] Missing eventBus');
      return false;
    }

    // 🔧 EventBus インスタンス検証（クラスではなくインスタンスか確認）
    if (typeof eventBus === 'function') {
      console.error('[CoordinateSystem] eventBus is a class, not an instance. Use window.cameraSystem.eventBus instead.');
      return false;
    }
    if (typeof eventBus.on !== 'function') {
      console.error('[CoordinateSystem] eventBus.on is not a function. Invalid EventBus instance.');
      return false;
    }

    _glCanvas = glCanvas;
    _pixiApp = pixiApp;
    _eventBus = eventBus;

    // Canvas初期サイズ取得
    _updateCanvasSize();

    // worldContainer初期検証
    const worldContainer = _getWorldContainer();
    if (!worldContainer) {
      console.error('[CoordinateSystem] Failed to initialize: worldContainer not found');
      return false;
    }

    // 🔧 worldContainer をグローバルに登録
    if (!window.worldContainer) {
      window.worldContainer = worldContainer;
      console.log('[CoordinateSystem] Registered window.worldContainer');
    }

    // 🔧 親チェーン修復試行
    if (_repairParentChain(worldContainer)) {
      console.log('[CoordinateSystem] Parent chain repaired');
    }

    // イベント購読
    _subscribeEvents();

    _initialized = true;

    console.log('[CoordinateSystem] Initialized', {
      canvasSize: _canvasSize,
      worldContainer: worldContainer.label || 'worldContainer'
    });

    return true;
  }

  // ================================================================================
  // 🔧 Canvas Size Update
  // ================================================================================
  function _updateCanvasSize() {
    if (!_glCanvas) {
      console.warn('[CoordinateSystem] _updateCanvasSize: Canvas not available');
      return;
    }

    // 🔧 複数の取得方法を試行
    let width = _glCanvas.width;
    let height = _glCanvas.height;

    // canvas.width/height が取得できない場合はclientWidth/Heightを使用
    if (!width || !height) {
      width = _glCanvas.clientWidth;
      height = _glCanvas.clientHeight;
    }

    // それでも取得できない場合はrectから取得
    if (!width || !height) {
      const rect = _glCanvas.getBoundingClientRect();
      width = rect.width;
      height = rect.height;
    }

    _canvasSize.width = width || 1920;  // fallback値
    _canvasSize.height = height || 1080;

    if (!width || !height) {
      console.warn('[CoordinateSystem] Canvas size fallback used:', _canvasSize);
    }
  }

  // ================================================================================
  // 🔧 Event Subscriptions
  // ================================================================================
  function _subscribeEvents() {
    if (!_eventBus) return;

    const events = [
      'canvas:resize',
      'camera:resized',
      'camera:transform-changed',
      'layer:transform-updated',
      'layer:transform-changed'
    ];

    events.forEach(event => {
      _eventBus.on(event, () => {
        _updateCanvasSize();
        // worldContainerキャッシュをクリア（再取得を強制）
        _cachedWorldContainer = null;
      });
    });
  }

  // ================================================================================
  // 🔧 Coordinate Transformation Pipeline
  // ================================================================================

  /**
   * Screen Client → Canvas 座標変換
   * @param {number} clientX - PointerEvent.clientX
   * @param {number} clientY - PointerEvent.clientY
   * @returns {{canvasX: number, canvasY: number}}
   */
  function screenClientToCanvas(clientX, clientY) {
    if (!_glCanvas) {
      console.error('[CoordinateSystem] Canvas not initialized');
      return { canvasX: clientX, canvasY: clientY };
    }

    // 🔧 Canvas サイズが未取得の場合は再取得
    if (_canvasSize.width === 0 || _canvasSize.height === 0) {
      console.warn('[CoordinateSystem] Canvas size not initialized, updating...');
      _updateCanvasSize();
    }

    const rect = _glCanvas.getBoundingClientRect();
    const scaleX = _canvasSize.width / (rect.width || 1);
    const scaleY = _canvasSize.height / (rect.height || 1);

    const canvasX = (clientX - rect.left) * scaleX;
    const canvasY = (clientY - rect.top) * scaleY;

    return { canvasX, canvasY };
  }

  /**
   * Canvas → World 座標変換
   * @param {number} canvasX
   * @param {number} canvasY
   * @returns {{worldX: number, worldY: number}}
   */
  function canvasToWorld(canvasX, canvasY) {
    const worldContainer = _getWorldContainer();
    if (!worldContainer) {
      console.error('[CoordinateSystem] worldContainer not available');
      return { worldX: canvasX, worldY: canvasY };
    }

    // 🔧 worldTransform が既に有効か確認（手動更新は危険なのでスキップ）
    const worldTransform = worldContainer.worldTransform;
    
    // 🔧 worldTransform.applyInverse() を試行
    if (worldTransform && typeof worldTransform.applyInverse === 'function') {
      try {
        // updateTransform()を呼ばずに既存のworldTransformを使用
        const point = worldTransform.applyInverse({ x: canvasX, y: canvasY });

        // NaN検出
        if (isNaN(point.x) || isNaN(point.y)) {
          console.warn('[CoordinateSystem] canvasToWorld returned NaN, using fallback');
          return _fallbackCanvasToWorld(canvasX, canvasY, worldContainer);
        }

        return { worldX: point.x, worldY: point.y };
      } catch (error) {
        console.warn('[CoordinateSystem] worldTransform.applyInverse() failed, using fallback:', error.message);
        return _fallbackCanvasToWorld(canvasX, canvasY, worldContainer);
      }
    }

    // worldTransform が使用できない場合は手動変換
    return _fallbackCanvasToWorld(canvasX, canvasY, worldContainer);
  }

  /**
   * 🔧 Fallback手動変換（既存コード分離）
   */
  function _fallbackCanvasToWorld(canvasX, canvasY, worldContainer) {
    const pos = worldContainer.position || { x: 0, y: 0 };
    const scale = worldContainer.scale || { x: 1, y: 1 };
    const pivot = worldContainer.pivot || { x: 0, y: 0 };
    const rotation = worldContainer.rotation || 0;

    let x = canvasX - pos.x;
    let y = canvasY - pos.y;

    if (Math.abs(rotation) > 1e-6) {
      const cos = Math.cos(-rotation);
      const sin = Math.sin(-rotation);
      const rx = x * cos - y * sin;
      const ry = x * sin + y * cos;
      x = rx;
      y = ry;
    }

    if (Math.abs(scale.x) > 1e-6) x = x / scale.x;
    if (Math.abs(scale.y) > 1e-6) y = y / scale.y;

    x = x + pivot.x;
    y = y + pivot.y;

    return { worldX: x, worldY: y };
  }

  /**
   * World → Local 座標変換
   * @param {number} worldX
   * @param {number} worldY
   * @param {PIXI.Container} container - 変換先コンテナ（通常はactiveLayer）
   * @returns {{localX: number, localY: number}}
   */
  function worldToLocal(worldX, worldY, container) {
    if (!container) {
      console.warn('[CoordinateSystem] worldToLocal: container is null');
      return { localX: worldX, localY: worldY };
    }

    let transforms = [];
    let node = container;
    const worldContainer = _getWorldContainer();

    // 🔧 無限ループ防止カウンター（Phase 1修正）
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

    let x = worldX;
    let y = worldY;

    for (let i = transforms.length - 1; i >= 0; i--) {
      const t = transforms[i];

      x -= t.pos.x;
      y -= t.pos.y;

      if (Math.abs(t.rotation) > 1e-6) {
        const cos = Math.cos(-t.rotation);
        const sin = Math.sin(-t.rotation);
        const rx = x * cos - y * sin;
        const ry = x * sin + y * cos;
        x = rx;
        y = ry;
      }

      if (Math.abs(t.scale.x) > 1e-6) x /= t.scale.x;
      if (Math.abs(t.scale.y) > 1e-6) y /= t.scale.y;

      x += t.pivot.x;
      y += t.pivot.y;
    }

    // 🔧 NaN検出（Phase 1修正）
    if (isNaN(x) || isNaN(y)) {
      console.error('[CoordinateSystem] worldToLocal returned NaN', {
        input: { worldX, worldY },
        output: { x, y },
        transforms: transforms
      });
      return { localX: worldX, localY: worldY };
    }

    return { localX: x, localY: y };
  }

  // ================================================================================
  // 🔧 Debug Utilities
  // ================================================================================
  const TegakiDebug = {
    coord: {
      enableDebug: function() {
        console.log('[CoordinateSystem] Debug mode: true');
      },

      testFullPipeline: function(clientX, clientY) {
        console.log('[CoordinateSystem] Full Pipeline Test');
        console.log('Input (Screen):', { clientX, clientY });

        const canvas = screenClientToCanvas(clientX, clientY);
        console.log('Step 1 (Canvas):', canvas);

        const world = canvasToWorld(canvas.canvasX, canvas.canvasY);
        console.log('Step 2 (World):', world);

        const worldContainer = _getWorldContainer();
        if (worldContainer) {
          const local = worldToLocal(world.worldX, world.worldY, worldContainer);
          console.log('Step 3 (Local):', local);
        } else {
          console.error('Cannot complete test: worldContainer not found');
        }
      },

      inspectCoordSystem: function() {
        console.group('🔍 CoordinateSystem State');
        console.log('Initialized:', _initialized);
        console.log('Canvas Size:', _canvasSize);
        
        const worldContainer = _getWorldContainer();
        if (worldContainer) {
          console.log('worldContainer:', {
            label: worldContainer.label || 'unnamed',
            position: worldContainer.position,
            scale: worldContainer.scale,
            rotation: worldContainer.rotation,
            parent: worldContainer.parent?.label || 'none'
          });
        } else {
          console.error('worldContainer: NOT FOUND');
        }
        console.groupEnd();
      }
    }
  };

  if (!window.TegakiDebug) {
    window.TegakiDebug = TegakiDebug;
  }

  // ================================================================================
  // 🔧 Public API
  // ================================================================================
  return {
    initialize,
    screenClientToCanvas,
    canvasToWorld,
    worldToLocal,
    
    // Getters
    get initialized() { return _initialized; },
    get canvasSize() { return { ..._canvasSize }; },
    
    // Debug
    _getWorldContainer, // テスト用公開
    _validateContainerHierarchy, // テスト用公開
  };
})();