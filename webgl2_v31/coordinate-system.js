/**
 * ================================================================================
 * coordinate-system.js Phase 1.5 - Transform初期化完全修正版
 * ================================================================================
 * 
 * 【依存関係】
 * 親: drawing-engine.js, brush-core.js
 * 子: camera-system.js (worldContainer管理)
 * 
 * 【責務】
 * Screen → Canvas → World → Local 座標変換パイプライン
 * 
 * 【重要】
 * - updateTransform()実行BEFORE親Transform確認と初期化
 * - Pixi toLocal()/toGlobal()は使用禁止
 * - 手動逆行列計算による親チェーン遡査
 * 
 * 【改修履歴】
 * Phase 1.5: updateTransform()前の親Transform初期化を完全実装
 * Phase 1.4: worldTransform未初期化エラー修正（親Transform確実初期化）
 * Phase 1.3: 初期化失敗時の詳細診断ログ追加、worldContainer取得堅牢化
 * ================================================================================
 */

(function() {
  'use strict';

  const DEBUG = false; // 本番環境では false
  const MAX_PARENT_DEPTH = 20; // 無限ループ防止

  class CoordinateSystem {
    constructor() {
      this.canvas = null;
      this.worldContainer = null;
      this.initialized = false;
    }

    /**
     * 初期化
     * @param {HTMLCanvasElement} canvas - WebGL2キャンバス
     * @param {PIXI.Container} worldContainer - Pixiのworldコンテナ
     */
    initialize(canvas, worldContainer) {
      console.log('[CoordinateSystem] initialize() called', {
        canvas: !!canvas,
        worldContainer: !!worldContainer,
        canvasSize: canvas ? `${canvas.width}x${canvas.height}` : 'N/A'
      });

      if (!canvas) {
        console.error('[CoordinateSystem] ❌ canvas is null');
        return false;
      }

      if (!worldContainer) {
        console.error('[CoordinateSystem] ❌ worldContainer is null');
        return false;
      }

      this.canvas = canvas;
      this.worldContainer = worldContainer;
      this.initialized = true;

      console.log('[CoordinateSystem] ✅ Initialized successfully');
      return true;
    }

    /**
     * worldContainerを取得（遅延初期化対応）
     */
    _getWorldContainer() {
      if (this.worldContainer) {
        return this.worldContainer;
      }

      // cameraSystemから取得試行
      if (window.cameraSystem?.worldContainer) {
        this.worldContainer = window.cameraSystem.worldContainer;
        console.log('[CoordinateSystem] worldContainer acquired from cameraSystem');
        return this.worldContainer;
      }

      console.error('[CoordinateSystem] ❌ worldContainer not found');
      return null;
    }

    /**
     * コンテナのTransform初期化確認（Phase 1.5完全版）
     * @param {PIXI.Container} container
     * @returns {boolean}
     */
    _ensureTransformInitialized(container) {
      if (!container) {
        console.error('[CoordinateSystem] _ensureTransformInitialized: container is null');
        return false;
      }

      // 親チェーンを遡って収集
      const chain = [];
      let current = container;
      let depth = 0;

      while (current && depth < MAX_PARENT_DEPTH) {
        chain.push(current);
        current = current.parent;
        depth++;
      }

      if (depth >= MAX_PARENT_DEPTH) {
        console.error('[CoordinateSystem] ❌ infinite parent chain detected');
        return false;
      }

      // root（stage）から順に初期化
      for (let i = chain.length - 1; i >= 0; i--) {
        const node = chain[i];
        
        // worldTransformの存在確認
        if (!node.worldTransform) {
          if (DEBUG) {
            console.log(`[CoordinateSystem] Initializing worldTransform for node at depth ${chain.length - 1 - i}`);
          }
          
          // 親のworldTransformを先に初期化
          if (node.parent && node.parent.updateTransform) {
            try {
              node.parent.updateTransform();
            } catch (e) {
              console.error('[CoordinateSystem] ❌ Parent updateTransform failed:', e);
            }
          }
          
          // 自身のTransform初期化
          if (node.updateTransform) {
            try {
              node.updateTransform();
            } catch (e) {
              console.error('[CoordinateSystem] ❌ Node updateTransform failed:', e);
              return false;
            }
          }
        }
        // worldTransformは存在するがプロパティが未定義
        else if (typeof node.worldTransform.a === 'undefined') {
          if (DEBUG) {
            console.log(`[CoordinateSystem] Reinitializing incomplete worldTransform at depth ${chain.length - 1 - i}`);
          }
          
          if (node.updateTransform) {
            try {
              node.updateTransform();
            } catch (e) {
              console.error('[CoordinateSystem] ❌ Node updateTransform failed:', e);
              return false;
            }
          }
        }
      }

      // 最終検証
      if (!container.worldTransform || typeof container.worldTransform.a === 'undefined') {
        console.error('[CoordinateSystem] ❌ Transform initialization failed - worldTransform still invalid');
        return false;
      }

      return true;
    }

    /**
     * 状態ダンプ（デバッグ用）
     */
    dumpState() {
      const worldContainer = this._getWorldContainer();
      return {
        initialized: this.initialized,
        canvas: this.canvas ? `${this.canvas.width}x${this.canvas.height}` : null,
        worldContainer: worldContainer ? {
          exists: true,
          position: worldContainer.position ? `(${worldContainer.position.x}, ${worldContainer.position.y})` : 'N/A',
          scale: worldContainer.scale ? `(${worldContainer.scale.x}, ${worldContainer.scale.y})` : 'N/A',
          rotation: worldContainer.rotation || 0,
          worldTransform: worldContainer.worldTransform ? 'initialized' : 'uninitialized',
          parent: worldContainer.parent ? 'exists' : 'no parent',
          parentWorldTransform: worldContainer.parent?.worldTransform ? 'initialized' : 'uninitialized'
        } : null
      };
    }

    /**
     * Screen座標 → Canvas座標変換（DPI/CSS補正）
     * @param {number} clientX - PointerEvent.clientX
     * @param {number} clientY - PointerEvent.clientY
     * @returns {{canvasX: number, canvasY: number}|null}
     */
    screenClientToCanvas(clientX, clientY) {
      if (!this.canvas) {
        console.error('[CoordinateSystem] screenClientToCanvas: canvas not initialized');
        return null;
      }

      const rect = this.canvas.getBoundingClientRect();
      const scaleX = this.canvas.width / rect.width;
      const scaleY = this.canvas.height / rect.height;

      const canvasX = (clientX - rect.left) * scaleX;
      const canvasY = (clientY - rect.top) * scaleY;

      if (!isFinite(canvasX) || !isFinite(canvasY)) {
        console.error('[CoordinateSystem] ❌ screenClientToCanvas: NaN/Infinity detected', {
          clientX, clientY, canvasX, canvasY, scaleX, scaleY
        });
        return null;
      }

      if (DEBUG) {
        console.log('[CoordinateSystem] screenClientToCanvas:', {
          client: {x: clientX, y: clientY},
          canvas: {x: canvasX, y: canvasY},
          scale: {x: scaleX, y: scaleY}
        });
      }

      return { canvasX, canvasY };
    }

    /**
     * Canvas座標 → World座標変換（Phase 1.5完全版）
     * @param {number} canvasX - Canvas X座標
     * @param {number} canvasY - Canvas Y座標
     * @returns {{worldX: number, worldY: number}|null}
     */
    canvasToWorld(canvasX, canvasY) {
      const worldContainer = this._getWorldContainer();
      if (!worldContainer) {
        console.error('[CoordinateSystem] canvasToWorld: worldContainer not available');
        return null;
      }

      // 🔧 Phase 1.5: updateTransform()実行BEFORE Transform初期化確認
      if (!this._ensureTransformInitialized(worldContainer)) {
        console.error('[CoordinateSystem] ❌ Failed to initialize worldContainer transform');
        
        // 詳細診断
        console.error('[CoordinateSystem] Diagnostic:', {
          hasWorldContainer: !!worldContainer,
          hasParent: !!worldContainer.parent,
          parentType: worldContainer.parent?.constructor?.name,
          hasWorldTransform: !!worldContainer.worldTransform,
          hasParentWorldTransform: !!worldContainer.parent?.worldTransform
        });
        
        return null;
      }

      // 🔧 Phase 1.5: 初期化確認後にupdateTransform実行
      try {
        worldContainer.updateTransform();
      } catch (e) {
        console.error('[CoordinateSystem] ❌ updateTransform failed:', e);
        return null;
      }

      const worldTransform = worldContainer.worldTransform;
      if (!worldTransform || typeof worldTransform.a === 'undefined') {
        console.error('[CoordinateSystem] ❌ worldTransform invalid after updateTransform()', {
          hasWorldTransform: !!worldTransform,
          properties: worldTransform ? Object.keys(worldTransform) : []
        });
        return null;
      }

      // 逆行列変換
      let invertedPoint;
      try {
        invertedPoint = worldTransform.applyInverse({ x: canvasX, y: canvasY });
      } catch (e) {
        console.error('[CoordinateSystem] ❌ applyInverse failed:', e);
        return null;
      }

      const worldX = invertedPoint.x;
      const worldY = invertedPoint.y;

      if (!isFinite(worldX) || !isFinite(worldY)) {
        console.error('[CoordinateSystem] ❌ canvasToWorld: NaN/Infinity detected', {
          canvasX, canvasY, worldX, worldY
        });
        return null;
      }

      if (DEBUG) {
        console.log('[CoordinateSystem] canvasToWorld:', {
          canvas: {x: canvasX, y: canvasY},
          world: {x: worldX, y: worldY}
        });
      }

      return { worldX, worldY };
    }

    /**
     * World座標 → Local座標変換（手動逆算・Phase 1.5強化版）
     * @param {number} worldX - World X座標
     * @param {number} worldY - World Y座標
     * @param {PIXI.Container} container - ターゲットコンテナ
     * @returns {{localX: number, localY: number}|null}
     */
    worldToLocal(worldX, worldY, container) {
      if (!container) {
        console.error('[CoordinateSystem] worldToLocal: container is null');
        return null;
      }

      const worldContainer = this._getWorldContainer();
      if (!worldContainer) {
        console.error('[CoordinateSystem] worldToLocal: worldContainer not available');
        return null;
      }

      // 🔧 Phase 1.5: containerのTransform初期化確認
      if (!this._ensureTransformInitialized(container)) {
        console.error('[CoordinateSystem] ❌ Failed to initialize container transform');
        return null;
      }

      // 親チェーン収集（worldContainerまで）
      const parentChain = [];
      let current = container;
      let depth = 0;

      while (current && current !== worldContainer && depth < MAX_PARENT_DEPTH) {
        parentChain.push(current);
        current = current.parent;
        depth++;
      }

      if (depth >= MAX_PARENT_DEPTH) {
        console.error('[CoordinateSystem] ❌ worldToLocal: infinite parent chain detected');
        return null;
      }

      if (current !== worldContainer) {
        console.error('[CoordinateSystem] ❌ worldToLocal: container not child of worldContainer', {
          containerLabel: container.label || 'unknown',
          chainLength: parentChain.length
        });
        return null;
      }

      // 逆順に変換適用
      let x = worldX;
      let y = worldY;

      for (let i = parentChain.length - 1; i >= 0; i--) {
        const node = parentChain[i];

        // 回転の逆変換
        if (node.rotation) {
          const cos = Math.cos(-node.rotation);
          const sin = Math.sin(-node.rotation);
          const tx = x * cos - y * sin;
          const ty = x * sin + y * cos;
          x = tx;
          y = ty;
        }

        // スケールの逆変換
        if (node.scale) {
          x /= (node.scale.x || 1);
          y /= (node.scale.y || 1);
        }

        // 位置の逆変換
        if (node.position) {
          x -= node.position.x;
          y -= node.position.y;
        }
      }

      if (!isFinite(x) || !isFinite(y)) {
        console.error('[CoordinateSystem] ❌ worldToLocal: NaN/Infinity detected', {
          worldX, worldY, localX: x, localY: y
        });
        return null;
      }

      if (DEBUG) {
        console.log('[CoordinateSystem] worldToLocal:', {
          world: {x: worldX, y: worldY},
          local: {x, y},
          chainLength: parentChain.length
        });
      }

      return { localX: x, localY: y };
    }

    /**
     * 完全な座標変換パイプライン（デバッグ用）
     */
    transformScreenToLocal(clientX, clientY, container) {
      const canvas = this.screenClientToCanvas(clientX, clientY);
      if (!canvas) return null;

      const world = this.canvasToWorld(canvas.canvasX, canvas.canvasY);
      if (!world) return null;

      const local = this.worldToLocal(world.worldX, world.worldY, container);
      if (!local) return null;

      return {
        ...canvas,
        ...world,
        ...local
      };
    }
  }

  // シングルトンインスタンス
  window.CoordinateSystem = new CoordinateSystem();

  console.log('✅ coordinate-system.js Phase 1.5 Transform初期化完全修正版 loaded');
  console.log('   🔧 updateTransform()実行BEFORE親Transform初期化を完全実装');
  console.log('   🔧 _ensureTransformInitialized()エラーハンドリング強化');
  console.log('   🔧 worldToLocal()でもTransform初期化確認追加');

})();