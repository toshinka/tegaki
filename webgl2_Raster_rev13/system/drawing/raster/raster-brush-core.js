/**
 * ============================================================================
 * ファイル名: system/drawing/raster/raster-brush-core.js
 * Phase: B-Emergency-2
 * 責務: ラスターブラシGPU描画（描画Canvas専用）
 * 依存: raster-layer.js, brush-stamp.js, brush-interpolator.js
 * 親依存: brush-core.js, drawing-engine.js
 * 子依存: shader-inline.js
 * 公開API: initialize(), startStroke(), addStrokePoint(), finalizeStroke()
 * イベント発火: なし
 * イベント受信: なし
 * グローバル登録: window.RasterBrushCore
 * 実装状態: 🚨 Phase B-Emergency-2 - PixiJS依存完全削除
 * 
 * 変更内容:
 *   🚨 BE-2: ticker制御系メソッド削除（180行削除）
 *   🚨 BE-2: finalizeStroke()簡素化
 *   🚨 BE-2: PixiJS依存完全削除
 *   ✅ コード量: 約1/3に簡素化
 * ============================================================================
 */

(function() {
  'use strict';

  /**
   * ラスターブラシコア - GPU描画エンジン（PixiJS完全分離版）
   * 
   * 責務:
   * - ブラシストロークのGPU描画
   * - 補間・アンチエイリアス
   * - フレームバッファ管理
   * - 転送トリガー
   */
  class RasterBrushCore {
    constructor() {
      // WebGL2コンテキスト
      this.gl = null;

      // RasterLayerインスタンス
      this.rasterLayer = null;

      // BrushStampインスタンス
      this.brushStamp = null;

      // BrushInterpolatorインスタンス
      this.brushInterpolator = null;

      // SettingsManagerインスタンス
      this.settingsManager = null;

      // 現在のストローク状態
      this.currentStroke = {
        active: false,
        layerId: null,
        points: [],
        lastPoint: null
      };

      // 初期化状態
      this.initialized = false;
    }

    // ============================================================================
    // 初期化
    // ============================================================================

    /**
     * 初期化（描画Canvas専用）
     * 
     * @param {HTMLCanvasElement} drawingCanvas - 描画Canvas
     */
    initialize(drawingCanvas) {
      try {
        console.log('[RasterBrushCore] 🚀 Initializing (separated mode)...');

        // GLコンテキスト取得
        this.gl = drawingCanvas.getContext('webgl2');
        if (!this.gl) {
          throw new Error('[RasterBrushCore] ❌ WebGL2 context not found');
        }

        // RasterLayer取得
        this.rasterLayer = window.rasterLayer;
        if (!this.rasterLayer) {
          throw new Error('[RasterBrushCore] ❌ RasterLayer not found');
        }

        // BrushStamp取得
        this.brushStamp = window.brushStamp;
        if (!this.brushStamp) {
          throw new Error('[RasterBrushCore] ❌ BrushStamp not found');
        }

        // BrushInterpolator取得
        this.brushInterpolator = window.brushInterpolator;
        if (!this.brushInterpolator) {
          throw new Error('[RasterBrushCore] ❌ BrushInterpolator not found');
        }

        // SettingsManager取得
        this.settingsManager = window.settingsManager;
        if (!this.settingsManager) {
          throw new Error('[RasterBrushCore] ❌ SettingsManager not found');
        }

        this.initialized = true;

        console.log('[RasterBrushCore] ✅ Initialized (separated mode)');
        console.log('  GL Context:', this.gl);
        console.log('  No Pixi ticker control needed');

      } catch (error) {
        console.error('[RasterBrushCore] ❌ Initialization failed:', error);
        throw error;
      }
    }

    // ============================================================================
    // ストローク描画
    // ============================================================================

    /**
     * ストローク開始
     * 
     * @param {number} localX - ローカルX座標
     * @param {number} localY - ローカルY座標
     * @param {number} pressure - 筆圧 (0-1)
     * @param {number} tiltX - ペン傾きX
     * @param {number} tiltY - ペン傾きY
     * @param {number} twist - ペン回転
     */
    startStroke(localX, localY, pressure, tiltX = 0, tiltY = 0, twist = 0) {
      if (!this.initialized) {
        console.error('[RasterBrushCore] ❌ Not initialized');
        return;
      }

      try {
        console.log('[RasterBrushCore] ✏️ Starting stroke (separated mode)');

        // レイヤーID取得
        const layerId = this._getCurrentLayerId();
        if (!layerId) {
          throw new Error('[RasterBrushCore] ❌ No active layer');
        }

        // ストローク状態初期化
        this.currentStroke = {
          active: true,
          layerId: layerId,
          points: [],
          lastPoint: { localX, localY, pressure, tiltX, tiltY, twist }
        };

        // フレームバッファバインド
        this.rasterLayer.bindFramebuffer(layerId);

        // ブラシ設定取得
        const brushSettings = this._getBrushSettings();

        // 初回スタンプ描画
        this._drawBrushStamp(localX, localY, pressure, tiltX, tiltY, twist, brushSettings);

        // ポイント記録
        this.currentStroke.points.push({ localX, localY, pressure, tiltX, tiltY, twist });

      } catch (error) {
        console.error('[RasterBrushCore] ❌ startStroke error:', error);
        this.currentStroke.active = false;
      }
    }

    /**
     * ストロークポイント追加
     * 
     * @param {number} localX - ローカルX座標
     * @param {number} localY - ローカルY座標
     * @param {number} pressure - 筆圧 (0-1)
     * @param {number} tiltX - ペン傾きX
     * @param {number} tiltY - ペン傾きY
     * @param {number} twist - ペン回転
     */
    addStrokePoint(localX, localY, pressure, tiltX = 0, tiltY = 0, twist = 0) {
      if (!this.currentStroke.active) {
        return;
      }

      try {
        const lastPoint = this.currentStroke.lastPoint;

        // 距離計算
        const dx = localX - lastPoint.localX;
        const dy = localY - lastPoint.localY;
        const distance = Math.sqrt(dx * dx + dy * dy);

        // ブラシ設定取得
        const brushSettings = this._getBrushSettings();

        // 補間が必要か判定
        const interpolationThreshold = brushSettings.size * 0.5;

        if (distance > interpolationThreshold) {
          // 補間ポイント生成
          const interpolatedPoints = this.brushInterpolator.interpolate(
            lastPoint,
            { localX, localY, pressure, tiltX, tiltY, twist },
            distance
          );

          // 各補間ポイントにスタンプ描画
          for (const point of interpolatedPoints) {
            this._drawBrushStamp(
              point.localX,
              point.localY,
              point.pressure,
              point.tiltX,
              point.tiltY,
              point.twist,
              brushSettings
            );
          }
        } else {
          // 補間不要 - 直接描画
          this._drawBrushStamp(localX, localY, pressure, tiltX, tiltY, twist, brushSettings);
        }

        // 最終ポイント更新
        this.currentStroke.lastPoint = { localX, localY, pressure, tiltX, tiltY, twist };

        // ポイント記録
        this.currentStroke.points.push({ localX, localY, pressure, tiltX, tiltY, twist });

      } catch (error) {
        console.error('[RasterBrushCore] ❌ addStrokePoint error:', error);
      }
    }

    /**
     * ストローク完了
     */
    async finalizeStroke() {
      if (!this.currentStroke.active) {
        return;
      }

      try {
        console.log('[RasterBrushCore] 🏁 Finalizing stroke (separated mode)');

        const layerId = this.currentStroke.layerId;

        // フレームバッファのバインド解除
        this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, null);

        // ストローク状態リセット
        this.currentStroke = {
          active: false,
          layerId: null,
          points: [],
          lastPoint: null
        };

        // 転送トリガー（GLTextureBridgeに委譲）
        if (window.glTextureBridge) {
          await window.glTextureBridge.transferLayerToPixi(layerId);
        } else {
          console.warn('[RasterBrushCore] ⚠️ GLTextureBridge not found');
        }

        console.log('[RasterBrushCore] ✅ Stroke finalized and transferred');

      } catch (error) {
        console.error('[RasterBrushCore] ❌ finalizeStroke error:', error);
        
        // エラー時も状態リセット
        this.currentStroke.active = false;
        this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, null);
      }
    }

    // ============================================================================
    // プライベートメソッド - 描画
    // ============================================================================

    /**
     * ブラシスタンプ描画
     */
    _drawBrushStamp(localX, localY, pressure, tiltX, tiltY, twist, brushSettings) {
      // ブラシサイズ計算（筆圧適用）
      const pressureCurve = this._calculatePressureCurve(pressure);
      const size = brushSettings.size * pressureCurve;

      // 不透明度計算
      const opacity = brushSettings.opacity * pressureCurve;

      // スタンプ描画
      this.brushStamp.drawStamp(
        this.gl,
        localX,
        localY,
        size,
        opacity,
        brushSettings.color,
        tiltX,
        tiltY,
        twist,
        brushSettings.hardness,
        brushSettings.flow
      );
    }

    /**
     * 筆圧カーブ計算
     */
    _calculatePressureCurve(pressure) {
      // 筆圧カーブ設定取得
      const minSize = this.settingsManager?.getPressureMinSize() || 0.1;
      const curve = this.settingsManager?.getPressureCurve() || 1.0;

      // カーブ適用
      const curvedPressure = Math.pow(pressure, curve);

      // サイズ範囲適用
      return minSize + (1 - minSize) * curvedPressure;
    }

    // ============================================================================
    // プライベートメソッド - ユーティリティ
    // ============================================================================

    /**
     * 現在のレイヤーID取得
     */
    _getCurrentLayerId() {
      const layerSystem = window.layerSystem;
      if (!layerSystem) {
        console.error('[RasterBrushCore] ❌ LayerSystem not found');
        return null;
      }

      const activeLayer = layerSystem.getActiveLayer();
      if (!activeLayer) {
        console.error('[RasterBrushCore] ❌ No active layer');
        return null;
      }

      return activeLayer.id;
    }

    /**
     * ブラシ設定取得
     */
    _getBrushSettings() {
      if (!this.settingsManager) {
        return {
          size: 10,
          opacity: 1.0,
          color: { r: 0, g: 0, b: 0 },
          hardness: 0.8,
          flow: 1.0
        };
      }

      return {
        size: this.settingsManager.getBrushSize(),
        opacity: this.settingsManager.getBrushOpacity(),
        color: this.settingsManager.getBrushColor(),
        hardness: this.settingsManager.getBrushHardness ? 
                 this.settingsManager.getBrushHardness() : 0.8,
        flow: this.settingsManager.getBrushFlow ? 
              this.settingsManager.getBrushFlow() : 1.0
      };
    }

    // ============================================================================
    // パブリックユーティリティ
    // ============================================================================

    /**
     * 初期化状態確認
     */
    isInitialized() {
      return this.initialized;
    }

    /**
     * ストローク状態確認
     */
    isStrokeActive() {
      return this.currentStroke.active;
    }

    /**
     * クリーンアップ
     */
    dispose() {
      console.log('[RasterBrushCore] 🧹 Disposing...');

      // ストローク強制終了
      if (this.currentStroke.active) {
        this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, null);
        this.currentStroke.active = false;
      }

      // 参照クリア
      this.gl = null;
      this.rasterLayer = null;
      this.brushStamp = null;
      this.brushInterpolator = null;
      this.settingsManager = null;
      this.initialized = false;

      console.log('[RasterBrushCore] ✅ Disposed');
    }
  }

  // グローバル登録
  window.RasterBrushCore = RasterBrushCore;

  console.log('✅ raster-brush-core.js Phase B-Emergency-2 loaded');
  console.log('   🚨 BE-2: ticker制御系メソッド削除（180行）');
  console.log('   🚨 BE-2: finalizeStroke()簡素化');
  console.log('   🚨 BE-2: PixiJS依存完全削除');
  console.log('   ✅ コード量: 約1/3に簡素化');

})();