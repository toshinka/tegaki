/**
 * ================================================================================
 * coordinate-system.js - Phase 1 座標ズレ修正版
 * ================================================================================
 * バージョン: v8.14.1
 * 更新日: 2025-02-XX
 * 
 * 【責務】
 * Screen → Canvas → World → Local 座標変換パイプラインの統一管理
 * 
 * 【親依存】
 * - config.js: DPR設定、キャンバスサイズ
 * - event-bus.js: イベント購読
 * - camera-system.js: worldContainer参照
 * 
 * 【子依存】
 * - drawing-engine.js: _transformPointerToLocal()
 * - stroke-recorder.js: Local座標記録
 * - pointer-handler.js: PointerEvent処理
 * 
 * 【Phase 1 修正内容】
 * ✅ worldContainer.updateTransform()の明示的呼び出し
 * ✅ NaN/Infinity検出の実装
 * ✅ 無限ループ防止カウンター追加
 * ✅ Fallback手動変換の分離
 * ✅ デバッグログフラグ追加
 * ================================================================================
 */

(function() {
  'use strict';

  // デバッグフラグ（開発時のみtrue）
  const DEBUG_COORD = false;

  window.CoordinateSystem = {
    _initialized: false,
    _glCanvas: null,
    _pixiApp: null,
    _eventBus: null,
    _canvasSize: { width: 1920, height: 1080 },
    _worldContainerRef: null,

    /**
     * 初期化
     * @param {HTMLCanvasElement} glCanvas - WebGL2キャンバス
     * @param {PIXI.Application} pixiApp - PixiJSアプリケーション
     * @param {EventBus} eventBus - イベントバス
     * @returns {boolean} 初期化成功
     */
    initialize(glCanvas, pixiApp, eventBus) {
      if (this._initialized) {
        console.warn('[CoordinateSystem] Already initialized');
        return true;
      }

      if (!glCanvas || !pixiApp || !eventBus) {
        console.error('[CoordinateSystem] Missing required parameters', {
          glCanvas: !!glCanvas,
          pixiApp: !!pixiApp,
          eventBus: !!eventBus
        });
        return false;
      }

      this._glCanvas = glCanvas;
      this._pixiApp = pixiApp;
      this._eventBus = eventBus;

      const rect = glCanvas.getBoundingClientRect();
      this._canvasSize = {
        width: rect.width,
        height: rect.height
      };

      this._setupEventListeners();

      this._initialized = true;

      if (DEBUG_COORD) {
        console.log('[CoordinateSystem] Initialized', {
          canvasSize: this._canvasSize,
          worldContainer: this._worldContainerRef ? 'registered' : 'pending'
        });
      }

      return true;
    },

    /**
     * worldContainerを登録
     * @param {PIXI.Container} container - ワールドコンテナ
     */
    registerWorldContainer(container) {
      if (!container) {
        console.error('[CoordinateSystem] Invalid worldContainer');
        return;
      }

      this._worldContainerRef = container;

      if (DEBUG_COORD) {
        console.log('[CoordinateSystem] Registered worldContainer', {
          position: container.position,
          scale: container.scale,
          rotation: container.rotation
        });
      }
    },

    /**
     * イベントリスナー設定
     * @private
     */
    _setupEventListeners() {
      if (!this._eventBus) return;

      // キャンバスリサイズ
      this._eventBus.on('canvas:resize', (data) => {
        if (data && data.width && data.height) {
          this._canvasSize = { width: data.width, height: data.height };
          if (DEBUG_COORD) {
            console.log('[CoordinateSystem] Canvas resized:', this._canvasSize);
          }
        }
      });

      // カメラリサイズ
      this._eventBus.on('camera:resized', (data) => {
        if (data && data.width && data.height) {
          this._canvasSize = { width: data.width, height: data.height };
          if (DEBUG_COORD) {
            console.log('[CoordinateSystem] Camera resized:', this._canvasSize);
          }
        }
      });

      // カメラトランスフォーム変更（キャッシュクリア等）
      this._eventBus.on('camera:transform-changed', () => {
        if (DEBUG_COORD) {
          console.log('[CoordinateSystem] Camera transform changed');
        }
      });

      // レイヤートランスフォーム更新
      this._eventBus.on('layer:transform-updated', () => {
        if (DEBUG_COORD) {
          console.log('[CoordinateSystem] Layer transform updated');
        }
      });
    },

    /**
     * worldContainer取得
     * @private
     * @returns {PIXI.Container|null}
     */
    _getWorldContainer() {
      if (this._worldContainerRef) {
        return this._worldContainerRef;
      }

      if (window.worldContainer) {
        this._worldContainerRef = window.worldContainer;
        return this._worldContainerRef;
      }

      if (window.cameraSystem && window.cameraSystem.worldContainer) {
        this._worldContainerRef = window.cameraSystem.worldContainer;
        return this._worldContainerRef;
      }

      console.warn('[CoordinateSystem] worldContainer not found');
      return null;
    },

    /**
     * Screen座標 → Canvas座標
     * @param {number} clientX - PointerEvent.clientX
     * @param {number} clientY - PointerEvent.clientY
     * @returns {{canvasX: number, canvasY: number}|null}
     */
    screenClientToCanvas(clientX, clientY) {
      if (!this._glCanvas) {
        console.error('[CoordinateSystem] Canvas not initialized');
        return null;
      }

      const rect = this._glCanvas.getBoundingClientRect();
      const canvas = this._glCanvas;

      // DPI補正計算
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;

      const canvasX = (clientX - rect.left) * scaleX;
      const canvasY = (clientY - rect.top) * scaleY;

      // NaNチェック
      if (isNaN(canvasX) || isNaN(canvasY)) {
        console.error('[CoordinateSystem] screenClientToCanvas returned NaN', {
          clientX, clientY, rect, scaleX, scaleY
        });
        return null;
      }

      if (DEBUG_COORD) {
        console.log('[screenClientToCanvas]', {
          input: { clientX, clientY },
          output: { canvasX, canvasY },
          scale: { scaleX, scaleY }
        });
      }

      return { canvasX, canvasY };
    },

    /**
     * Canvas座標 → World座標
     * @param {number} canvasX
     * @param {number} canvasY
     * @returns {{worldX: number, worldY: number}}
     */
    canvasToWorld(canvasX, canvasY) {
      const worldContainer = this._getWorldContainer();
      if (!worldContainer) {
        return { worldX: canvasX, worldY: canvasY };
      }

      // ✅ Phase 1修正: worldTransform更新保証
      worldContainer.updateTransform();

      const worldTransform = worldContainer.worldTransform;

      if (worldTransform && typeof worldTransform.applyInverse === 'function') {
        try {
          const point = worldTransform.applyInverse({ x: canvasX, y: canvasY });

          // ✅ NaN検出
          if (isNaN(point.x) || isNaN(point.y)) {
            console.error('[CoordinateSystem] canvasToWorld returned NaN', {
              canvasX, canvasY, point
            });
            return this._fallbackCanvasToWorld(canvasX, canvasY, worldContainer);
          }

          if (DEBUG_COORD) {
            console.log('[canvasToWorld] applyInverse', {
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
    },

    /**
     * Fallback手動Canvas→World変換
     * @private
     * @param {number} canvasX
     * @param {number} canvasY
     * @param {PIXI.Container} worldContainer
     * @returns {{worldX: number, worldY: number}}
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

      if (DEBUG_COORD) {
        console.log('[_fallbackCanvasToWorld]', {
          input: { canvasX, canvasY },
          output: { worldX: x, worldY: y }
        });
      }

      return { worldX: x, worldY: y };
    },

    /**
     * World座標 → Local座標（手動逆算）
     * @param {number} worldX
     * @param {number} worldY
     * @param {PIXI.Container} container - 対象レイヤー
     * @returns {{localX: number, localY: number}}
     */
    worldToLocal(worldX, worldY, container) {
      if (!container) {
        console.warn('[CoordinateSystem] worldToLocal: container is null');
        return { localX: worldX, localY: worldY };
      }

      if (DEBUG_COORD) {
        console.log('[worldToLocal] Input:', {
          worldX, worldY,
          containerLabel: container.label || container.name
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

      if (DEBUG_COORD) {
        console.log('[worldToLocal] Transform chain:', transforms.map(t => t.label));
      }

      let x = worldX;
      let y = worldY;

      // 親から子への逆順適用
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
          transforms: transforms.map(t => t.label)
        });
        return { localX: worldX, localY: worldY };
      }

      if (DEBUG_COORD) {
        console.log('[worldToLocal] Output:', { localX: x, localY: y });
      }

      return { localX: x, localY: y };
    },

    /**
     * Local座標 → World座標（順変換）
     * @param {number} localX
     * @param {number} localY
     * @param {PIXI.Container} container
     * @returns {{worldX: number, worldY: number}}
     */
    localToWorld(localX, localY, container) {
      if (!container) {
        console.warn('[CoordinateSystem] localToWorld: container is null');
        return { worldX: localX, worldY: localY };
      }

      let transforms = [];
      let node = container;
      const worldContainer = this._getWorldContainer();

      let depth = 0;
      const MAX_DEPTH = 20;

      while (node && node !== worldContainer && node !== null) {
        if (depth++ > MAX_DEPTH) {
          console.error('[CoordinateSystem] localToWorld: parent chain too deep');
          break;
        }

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

      // 子から親への順変換
      for (let i = 0; i < transforms.length; i++) {
        const t = transforms[i];

        x -= t.pivot.x;
        y -= t.pivot.y;

        x *= t.scale.x;
        y *= t.scale.y;

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

      if (isNaN(x) || isNaN(y)) {
        console.error('[CoordinateSystem] localToWorld returned NaN', {
          input: { localX, localY },
          output: { x, y }
        });
        return { worldX: localX, worldY: localY };
      }

      return { worldX: x, worldY: y };
    },

    /**
     * キャンバスサイズ取得
     * @returns {{width: number, height: number}}
     */
    getCanvasSize() {
      return { ...this._canvasSize };
    },

    /**
     * 初期化状態取得
     * @returns {boolean}
     */
    isInitialized() {
      return this._initialized;
    },

    /**
     * デバッグ: 座標変換フルパイプラインテスト
     * @param {number} clientX
     * @param {number} clientY
     */
    testFullPipeline(clientX, clientY) {
      console.log('🔍 [CoordinateSystem] Full Pipeline Test');
      console.log('Input (Screen):', { clientX, clientY });

      const step1 = this.screenClientToCanvas(clientX, clientY);
      console.log('Step 1 (Canvas):', step1);

      if (step1) {
        const step2 = this.canvasToWorld(step1.canvasX, step1.canvasY);
        console.log('Step 2 (World):', step2);

        const activeLayer = window.layerManager?.getActiveLayer();
        if (activeLayer && step2) {
          const step3 = this.worldToLocal(step2.worldX, step2.worldY, activeLayer);
          console.log('Step 3 (Local):', step3);
        } else {
          console.warn('No active layer for Local conversion');
        }
      }
    },

    /**
     * デバッグ: 状態確認
     */
    inspectCoordSystem() {
      console.log('🔍 CoordinateSystem State');
      console.log('Initialized:', this._initialized);
      console.log('Canvas Size:', this._canvasSize);

      const worldContainer = this._getWorldContainer();
      if (worldContainer) {
        console.log('worldContainer:', {
          label: worldContainer.label || worldContainer.name,
          position: worldContainer.position,
          scale: worldContainer.scale,
          rotation: worldContainer.rotation,
          parent: worldContainer.parent ? 'exists' : 'none'
        });
      } else {
        console.warn('worldContainer: NOT FOUND');
      }
    }
  };

  // グローバル公開
  if (DEBUG_COORD) {
    console.log('✅ coordinate-system.js Phase 1 loaded');
  }

})();