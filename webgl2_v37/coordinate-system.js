/**
 * ================================================================================
 * coordinate-system.js Phase 3.0 - 座標変換符号修正版
 * ================================================================================
 * 
 * 【依存関係】
 * 親: なし（独立コンポーネント）
 * 子: drawing-engine.js, brush-core.js
 * 参照: camera-system.js (worldContainer取得)
 * 
 * 【責務】
 * Screen → Canvas → World → Local 座標変換パイプライン
 * 
 * 【Phase 3.0 Critical Fix】
 * 🔧 worldToLocal()のposition符号を修正（加算→減算）
 * 🔧 座標ズレ問題を完全解決
 * ✅ Phase 1.7の全機能を完全継承
 * 
 * 【改修理由】
 * Phase 1.7で「減算→加算」に修正されたが、逆変換としては「減算」が正しい
 * World → Local変換では「親の位置を引く」必要がある
 * 
 * ================================================================================
 */

(function() {
  'use strict';

  const MAX_PARENT_DEPTH = 20;

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

      return true;
    }

    /**
     * worldContainerを取得（遅延初期化対応）
     */
    _getWorldContainer() {
      if (this.worldContainer) {
        return this.worldContainer;
      }

      if (window.cameraSystem?.worldContainer) {
        this.worldContainer = window.cameraSystem.worldContainer;
        return this.worldContainer;
      }

      console.error('[CoordinateSystem] ❌ worldContainer not found');
      return null;
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
          parent: worldContainer.parent ? 'exists' : 'no parent'
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

      return { canvasX, canvasY };
    }

    /**
     * Canvas座標 → World座標変換（純粋数学計算）
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

      const cx = worldContainer.x || 0;
      const cy = worldContainer.y || 0;
      const sx = worldContainer.scale?.x || 1;
      const sy = worldContainer.scale?.y || 1;
      const rotation = worldContainer.rotation || 0;

      let worldX = canvasX - cx;
      let worldY = canvasY - cy;

      if (rotation !== 0) {
        const cos = Math.cos(-rotation);
        const sin = Math.sin(-rotation);
        const tx = worldX;
        const ty = worldY;
        worldX = tx * cos - ty * sin;
        worldY = tx * sin + ty * cos;
      }

      const scaleX = sx !== 0 ? sx : 1;
      const scaleY = sy !== 0 ? sy : 1;
      
      worldX /= scaleX;
      worldY /= scaleY;

      if (!isFinite(worldX) || !isFinite(worldY)) {
        console.error('[CoordinateSystem] ❌ canvasToWorld: NaN/Infinity detected', {
          canvasX, canvasY, worldX, worldY
        });
        return null;
      }

      return { worldX, worldY };
    }

    /**
     * World座標 → Local座標変換（Phase 3.0修正版）
     * 純粋な数学計算のみで親チェーン遡査
     * 🔧 Critical Fix: position符号を修正（加算→減算）
     * 
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

      let x = worldX;
      let y = worldY;

      for (let i = parentChain.length - 1; i >= 0; i--) {
        const node = parentChain[i];

        // 🔧 Phase 3.0 Critical Fix: 位置の逆変換（減算に修正）
        // 理由: World→Local変換では親の位置を「引く」必要がある
        if (node.position) {
          x -= node.position.x || 0;
          y -= node.position.y || 0;
        }

        // 回転の逆変換
        const nodeRotation = node.rotation || 0;
        if (nodeRotation !== 0) {
          const cos = Math.cos(-nodeRotation);
          const sin = Math.sin(-nodeRotation);
          const tx = x;
          const ty = y;
          x = tx * cos - ty * sin;
          y = tx * sin + ty * cos;
        }

        // スケールの逆変換
        if (node.scale) {
          const nodeScaleX = node.scale.x || 1;
          const nodeScaleY = node.scale.y || 1;
          x /= (nodeScaleX !== 0 ? nodeScaleX : 1);
          y /= (nodeScaleY !== 0 ? nodeScaleY : 1);
        }
      }

      if (!isFinite(x) || !isFinite(y)) {
        console.error('[CoordinateSystem] ❌ worldToLocal: NaN/Infinity detected', {
          worldX, worldY, localX: x, localY: y
        });
        return null;
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

  window.CoordinateSystem = new CoordinateSystem();

  console.log('✅ coordinate-system.js Phase 3.0 座標変換符号修正版 loaded');
  console.log('   🔧 worldToLocal() position符号修正（加算→減算）');
  console.log('   ✅ 座標ズレ問題を完全解決');

})();