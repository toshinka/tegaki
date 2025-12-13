/**
 * ============================================================================
 * webgl2-drawing-layer.js - Phase B-Emergency-1
 * ============================================================================
 * 責務: 描画Canvas生成・独立GLコンテキスト管理
 * 変更内容:
 *   ✅ 描画Canvas生成（非表示・独立）
 *   ✅ PixiJSから完全分離されたGLコンテキスト
 *   ❌ ticker制御削除（不要）
 * 
 * 親依存: core-initializer.js
 * 子依存: raster-layer.js, gl-texture-bridge.js
 * グローバル: window.WebGL2DrawingLayer, window.webgl2Layer
 * ============================================================================
 */

class WebGL2DrawingLayer {
  constructor() {
    this.drawingCanvas = null;
    this.gl = null;
    this.rasterLayer = null;
    this.pixiApp = null;
    this.displayShaderProgram = null;
  }

  /**
   * 描画Canvas生成・WebGL2初期化
   * @param {number} width - Canvas幅
   * @param {number} height - Canvas高さ
   * @param {Object} options - 初期化オプション
   */
  initialize(width, height, options = {}) {
    console.log('[WebGL2DrawingLayer] 🚀 Initializing separated drawing canvas...');
    console.log(`  Target size: ${width} x ${height}`);

    // ========================================
    // Step 1: 描画Canvas生成（非表示）
    // ========================================
    this.drawingCanvas = document.createElement('canvas');
    this.drawingCanvas.width = width;
    this.drawingCanvas.height = height;
    this.drawingCanvas.style.position = 'absolute';
    this.drawingCanvas.style.display = 'none';
    this.drawingCanvas.id = 'drawing-canvas-separated';
    document.body.appendChild(this.drawingCanvas);

    console.log('[WebGL2DrawingLayer] ✅ Step 1: Drawing canvas created (hidden)');

    // ========================================
    // Step 2: 独立GLコンテキスト取得
    // ========================================
    const contextOptions = {
      alpha: true,
      premultipliedAlpha: true,
      antialias: false,
      preserveDrawingBuffer: true, // readPixels用
      powerPreference: 'high-performance'
    };

    this.gl = this.drawingCanvas.getContext('webgl2', contextOptions);

    if (!this.gl) {
      throw new Error('[WebGL2DrawingLayer] ❌ WebGL2 not supported');
    }

    console.log('[WebGL2DrawingLayer] ✅ Step 2: Independent GL context created');
    console.log('  Context:', this.gl);
    console.log('  Separated from PixiJS: true');

    // ========================================
    // Step 3: グローバル登録
    // ========================================
    window.GLContext = {
      gl: this.gl,
      canvas: this.drawingCanvas
    };

    console.log('[WebGL2DrawingLayer] ✅ Step 3: Global GLContext registered');

    // ========================================
    // Step 4: GL基本設定
    // ========================================
    this.gl.enable(this.gl.BLEND);
    this.gl.blendFunc(this.gl.SRC_ALPHA, this.gl.ONE_MINUS_SRC_ALPHA);
    this.gl.viewport(0, 0, width, height);
    this.gl.clearColor(0, 0, 0, 0);

    console.log('[WebGL2DrawingLayer] ✅ Step 4: GL state configured');

    // ========================================
    // Step 5: RasterLayer参照取得
    // ========================================
    this.rasterLayer = window.rasterLayer;
    if (!this.rasterLayer) {
      throw new Error('[WebGL2DrawingLayer] ❌ RasterLayer not found');
    }

    console.log('[WebGL2DrawingLayer] ✅ Step 5: RasterLayer reference obtained');

    // ========================================
    // Step 6: 最適化設定
    // ========================================
    if (options.optimization) {
      this._applyOptimizationSettings(options.optimization);
    }

    console.log('[WebGL2DrawingLayer] 🎉 Initialization completed (separated mode)');
    console.log('  Drawing canvas:', this.drawingCanvas);
    console.log('  GL context:', this.gl);
    console.log('  No PixiJS interference possible');

    return {
      success: true,
      canvas: this.drawingCanvas,
      gl: this.gl
    };
  }

  /**
   * PixiJSアプリ連携（表示専用・制御なし）
   * @param {PIXI.Application} pixiApp 
   */
  linkPixiApp(pixiApp) {
    this.pixiApp = pixiApp;
    console.log('[WebGL2DrawingLayer] ✅ Pixi.js app linked (display only)');
    console.log('  No ticker control needed (separated architecture)');
  }

  /**
   * 描画Canvas取得
   */
  getDrawingCanvas() {
    return this.drawingCanvas;
  }

  /**
   * 独立GLコンテキスト取得
   */
  getGLContext() {
    return this.gl;
  }

  /**
   * Canvas分離確認
   */
  isSeparated() {
    if (!this.pixiApp) return null;
    return this.drawingCanvas !== this.pixiApp.view;
  }

  /**
   * 最適化設定適用
   */
  _applyOptimizationSettings(optimization) {
    const gl = this.gl;

    if (optimization.disableDepthTest !== false) {
      gl.disable(gl.DEPTH_TEST);
    }

    if (optimization.disableStencilTest !== false) {
      gl.disable(gl.STENCIL_TEST);
    }

    if (optimization.disableDither !== false) {
      gl.disable(gl.DITHER);
    }

    console.log('[WebGL2DrawingLayer] ✅ Optimization settings applied');
  }

  /**
   * デバッグ情報取得
   */
  getDebugInfo() {
    const gl = this.gl;
    return {
      canvas: {
        width: this.drawingCanvas.width,
        height: this.drawingCanvas.height,
        visible: this.drawingCanvas.style.display !== 'none',
        separated: this.isSeparated()
      },
      gl: {
        version: gl.getParameter(gl.VERSION),
        vendor: gl.getParameter(gl.VENDOR),
        renderer: gl.getParameter(gl.RENDERER),
        maxTextureSize: gl.getParameter(gl.MAX_TEXTURE_SIZE),
        currentProgram: gl.getParameter(gl.CURRENT_PROGRAM)
      }
    };
  }

  /**
   * リソース解放
   */
  dispose() {
    if (this.displayShaderProgram) {
      this.gl.deleteProgram(this.displayShaderProgram);
    }

    if (this.drawingCanvas && this.drawingCanvas.parentNode) {
      this.drawingCanvas.parentNode.removeChild(this.drawingCanvas);
    }

    console.log('[WebGL2DrawingLayer] ✅ Resources disposed');
  }
}

// ============================================================================
// グローバル登録
// ============================================================================
window.WebGL2DrawingLayer = WebGL2DrawingLayer;
window.webgl2Layer = null; // core-initializerで初期化

console.log('✅ webgl2-drawing-layer.js Phase B-Emergency-1 loaded');
console.log('   🚨 BE-1: 描画Canvas独立生成');
console.log('   🚨 BE-1: PixiJSから完全分離');
console.log('   ❌ ticker制御削除（不要）');