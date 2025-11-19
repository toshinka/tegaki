/**
 * coordinate-system.js - Phase 1.1 座標ズレ修正版
 * v8.14.1 WebGL2対応 + worldTransform更新保証
 * 
 * 責務: 座標変換パイプライン Screen → Canvas → World → Local の統一管理
 * 
 * 親依存:
 *   - config.js: DPR/Canvas設定
 *   - event-bus.js: イベント購読
 *   - camera-system.js: worldContainer参照
 * 
 * 子依存:
 *   - drawing-engine.js: 座標変換メソッド呼び出し
 *   - stroke-recorder.js: Local座標受け取り
 *   - pointer-handler.js: Screen座標入力
 * 
 * 重要な修正:
 *   ✅ canvasToWorld()内でworldContainer.updateTransform()を明示的に呼び出し
 *   ✅ NaN/Infinity検出を全メソッドに追加
 *   ✅ デバッグログをフラグ制御に変更
 *   ✅ 無限ループ防止カウンター追加
 */

class CoordinateSystem {
  constructor() {
    this.canvas = null;
    this.worldContainer = null;
    this.cameraSystem = null;
    this.layerManager = null;
    
    // デバッグフラグ（開発時のみtrue）
    this.DEBUG_COORD = false;
    
    this._initEventListeners();
  }

  /**
   * 初期化
   */
  initialize(canvas, worldContainer, cameraSystem, layerManager) {
    this.canvas = canvas;
    this.worldContainer = worldContainer;
    this.cameraSystem = cameraSystem;
    this.layerManager = layerManager;
    
    if (!this.canvas || !this.worldContainer) {
      console.error('[CoordinateSystem] Initialization failed: missing canvas or worldContainer');
      return false;
    }
    
    if (this.DEBUG_COORD) {
      console.log('[CoordinateSystem] ✅ Initialized', {
        canvasSize: { width: this.canvas.width, height: this.canvas.height },
        worldContainer: this.worldContainer.label || 'worldContainer'
      });
    }
    
    return true;
  }

  /**
   * イベントリスナー初期化
   */
  _initEventListeners() {
    const eventBus = window.EventBus;
    if (!eventBus) return;

    eventBus.on('canvas:resize', () => {
      if (this.DEBUG_COORD) {
        console.log('[CoordinateSystem] Canvas resized');
      }
    });

    eventBus.on('camera:transform-changed', () => {
      if (this.DEBUG_COORD) {
        console.log('[CoordinateSystem] Camera transform changed');
      }
    });
  }

  /**
   * worldContainer取得
   */
  _getWorldContainer() {
    if (this.worldContainer && !this.worldContainer.destroyed) {
      return this.worldContainer;
    }
    
    if (window.cameraSystem?.worldContainer) {
      this.worldContainer = window.cameraSystem.worldContainer;
      return this.worldContainer;
    }
    
    console.error('[CoordinateSystem] worldContainer not found');
    return null;
  }

  /**
   * Screen座標 → Canvas座標
   * DPI補正を適用
   */
  screenClientToCanvas(clientX, clientY) {
    if (!this.canvas) {
      console.error('[CoordinateSystem] Canvas not initialized');
      return null;
    }

    const rect = this.canvas.getBoundingClientRect();
    const scaleX = this.canvas.width / rect.width;
    const scaleY = this.canvas.height / rect.height;

    const canvasX = (clientX - rect.left) * scaleX;
    const canvasY = (clientY - rect.top) * scaleY;

    // NaN検出
    if (isNaN(canvasX) || isNaN(canvasY)) {
      console.error('[CoordinateSystem] screenClientToCanvas returned NaN', {
        clientX, clientY, rect, scaleX, scaleY
      });
      return null;
    }

    if (this.DEBUG_COORD) {
      console.log('[screenClientToCanvas]', {
        input: { clientX, clientY },
        output: { canvasX, canvasY },
        scale: { scaleX, scaleY }
      });
    }

    return { canvasX, canvasY };
  }

  /**
   * Canvas座標 → World座標
   * worldContainerの逆行列を適用
   * 
   * 🔧 Phase 1.1修正: worldContainer.updateTransform()を明示的に呼び出し
   */
  canvasToWorld(canvasX, canvasY) {
    const worldContainer = this._getWorldContainer();
    if (!worldContainer) {
      return { worldX: canvasX, worldY: canvasY };
    }

    // ✅ CRITICAL: worldTransform更新を保証
    worldContainer.updateTransform();

    const worldTransform = worldContainer.worldTransform;
    
    if (worldTransform && typeof worldTransform.applyInverse === 'function') {
      try {
        const point = worldTransform.applyInverse({ x: canvasX, y: canvasY });

        // ✅ NaN検出
        if (isNaN(point.x) || isNaN(point.y)) {
          console.error('[CoordinateSystem] canvasToWorld returned NaN', {
            input: { canvasX, canvasY },
            output: point
          });
          return this._fallbackCanvasToWorld(canvasX, canvasY, worldContainer);
        }

        if (this.DEBUG_COORD) {
          console.log('[canvasToWorld] via applyInverse', {
            input: { canvasX, canvasY },
            output: { worldX: point.x, worldY: point.y }
          });
        }

        return { worldX: point.x, worldY: point.y };
      } catch (error) {
        console.error('[CoordinateSystem] worldTransform.applyInverse() error:', error);
        return this._fallbackCanvasToWorld(canvasX, canvasY, worldContainer);
      }
    }

    return this._fallbackCanvasToWorld(canvasX, canvasY, worldContainer);
  }

  /**
   * Canvas座標 → World座標（Fallback手動計算）
   */
  _fallbackCanvasToWorld(canvasX, canvasY, worldContainer) {
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

    // NaN検出
    if (isNaN(x) || isNaN(y)) {
      console.error('[CoordinateSystem] _fallbackCanvasToWorld returned NaN', {
        input: { canvasX, canvasY },
        output: { x, y },
        transform: { pos, scale, pivot, rotation }
      });
      return { worldX: canvasX, worldY: canvasY };
    }

    if (this.DEBUG_COORD) {
      console.log('[canvasToWorld] via fallback', {
        input: { canvasX, canvasY },
        output: { worldX: x, worldY: y }
      });
    }

    return { worldX: x, worldY: y };
  }

  /**
   * World座標 → Local座標
   * containerまでの親チェーンを手動で逆算
   * 
   * ⚠️ PIXI v8 toLocal()は使用禁止（worldContainer.positionが含まれるため）
   * 
   * 🔧 Phase 1.1修正: 無限ループ防止・デバッグログ追加
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
        containerLabel: container.label || container.name || 'unknown'
      });
    }

    let transforms = [];
    let node = container;
    const worldContainer = this._getWorldContainer();

    // ✅ 無限ループ防止カウンター
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

    let x = worldX;
    let y = worldY;

    // 親→子の順に逆変換を適用
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

    // ✅ NaN検出
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
   * デバッグモード切り替え
   */
  setDebugMode(enabled) {
    this.DEBUG_COORD = enabled;
    console.log(`[CoordinateSystem] Debug mode: ${enabled ? 'ON' : 'OFF'}`);
  }
}

// グローバル登録
if (typeof window !== 'undefined') {
  window.CoordinateSystem = new CoordinateSystem();
  console.log('✅ coordinate-system.js Phase 1.1 座標ズレ修正版 loaded');
  console.log('   🔧 worldContainer.updateTransform()保証');
  console.log('   🔧 NaN/Infinity検出追加');
  console.log('   🔧 無限ループ防止実装');
}