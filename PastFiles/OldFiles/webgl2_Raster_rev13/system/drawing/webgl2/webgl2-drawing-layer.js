/**
 * ============================================================================
 * ファイル名: system/drawing/webgl2/webgl2-drawing-layer.js
 * Phase: B-Emergency-1
 * 責務: WebGL2描画Canvas管理・PixiJSから完全分離
 * 依存: なし（完全独立）
 * 親依存: core-initializer.js
 * 子依存: raster-layer.js, gl-texture-bridge.js
 * 公開API: initialize(), getDrawingCanvas(), getGLContext()
 * イベント発火: webgl2:initialized
 * イベント受信: なし
 * グローバル登録: window.WebGL2DrawingLayer, window.GLContext
 * 実装状態: 🔥 Phase B-Emergency-1 - 描画Canvas独立生成
 * 
 * 変更内容:
 *   🚨 BE-1: 描画Canvas独立生成（非表示・専用GLコンテキスト）
 *   🚨 BE-1: PixiJSから完全分離（GL競合の物理的排除）
 *   ❌ ticker制御削除（不要）
 *   ✅ シンプルな初期化フロー
 * ============================================================================
 */

(function() {
  'use strict';

  /**
   * WebGL2 描画レイヤー管理クラス（PixiJS完全分離版）
   * 
   * 責務:
   * - 描画専用Canvas生成・管理
   * - 独立したWebGL2コンテキスト管理
   * - RasterLayer初期化統合
   * - GLステート管理
   */
  class WebGL2DrawingLayer {
    constructor() {
      // 描画Canvas（非表示）
      this.drawingCanvas = null;
      
      // 独立GLコンテキスト
      this.gl = null;
      
      // キャンバスサイズ
      this.width = 0;
      this.height = 0;
      
      // 初期化状態
      this.initialized = false;
    }

    /**
     * 初期化: 描画Canvas生成・GLコンテキスト確立
     * 
     * @param {number} width - キャンバス幅
     * @param {number} height - キャンバス高さ
     * @returns {boolean} 初期化成功/失敗
     */
    initialize(width, height) {
      try {
        console.log('[WebGL2DrawingLayer] 🚀 Initializing separated drawing canvas...');
        console.log(`  Target size: ${width} x ${height}`);

        // Step 1: 描画Canvas生成（非表示）
        this._createDrawingCanvas(width, height);

        // Step 2: 独立GLコンテキスト取得
        this._initializeGLContext();

        // Step 3: グローバル登録
        this._registerGlobalContext();

        // Step 4: GLステート初期設定
        this._configureGLState();

        // Step 5: RasterLayer確認
        if (!window.rasterLayer) {
          throw new Error('[WebGL2DrawingLayer] ❌ RasterLayer not found');
        }

        // Step 6: RasterLayer初期化
        console.log('[WebGL2DrawingLayer] 🔧 Initializing RasterLayer...');
        window.rasterLayer.initialize(this.gl);

        this.initialized = true;

        console.log('[WebGL2DrawingLayer] ✅ Initialization complete!');
        console.log('  Drawing Canvas:', this.drawingCanvas);
        console.log('  GL Context:', this.gl);
        console.log('  Separated from PixiJS: true');

        // イベント発火
        window.EventBus?.emit('webgl2:initialized', {
          canvas: this.drawingCanvas,
          gl: this.gl,
          width: this.width,
          height: this.height
        });

        return true;

      } catch (error) {
        console.error('[WebGL2DrawingLayer] ❌ Initialization failed:', error);
        return false;
      }
    }

    /**
     * Step 1: 描画Canvas生成
     */
    _createDrawingCanvas(width, height) {
      console.log('[WebGL2DrawingLayer] 📐 Step 1: Creating drawing canvas...');

      // Canvas要素生成
      this.drawingCanvas = document.createElement('canvas');
      this.drawingCanvas.id = 'drawing-canvas-separated';
      this.drawingCanvas.width = width;
      this.drawingCanvas.height = height;

      // 非表示設定（描画専用）
      this.drawingCanvas.style.cssText = `
        position: fixed;
        top: -10000px;
        left: -10000px;
        pointer-events: none;
        visibility: hidden;
      `;

      // DOM追加
      document.body.appendChild(this.drawingCanvas);

      this.width = width;
      this.height = height;

      console.log('[WebGL2DrawingLayer] ✅ Step 1: Drawing canvas created (hidden)');
    }

    /**
     * Step 2: 独立GLコンテキスト取得
     */
    _initializeGLContext() {
      console.log('[WebGL2DrawingLayer] 🔧 Step 2: Creating independent GL context...');

      // WebGL2コンテキスト取得（PixiJSとは完全独立）
      this.gl = this.drawingCanvas.getContext('webgl2', {
        alpha: true,
        premultipliedAlpha: true,
        antialias: false,
        preserveDrawingBuffer: true, // 転送用に保持
        depth: false,
        stencil: false
      });

      if (!this.gl) {
        throw new Error('[WebGL2DrawingLayer] ❌ WebGL2 not supported');
      }

      console.log('[WebGL2DrawingLayer] ✅ Step 2: Independent GL context created');
      console.log('  Context:', this.gl);
      console.log('  Separated from PixiJS: true');
    }

    /**
     * Step 3: グローバルコンテキスト登録
     */
    _registerGlobalContext() {
      console.log('[WebGL2DrawingLayer] 📝 Step 3: Registering global context...');

      window.GLContext = {
        gl: this.gl,
        canvas: this.drawingCanvas,
        width: this.width,
        height: this.height
      };

      console.log('[WebGL2DrawingLayer] ✅ Step 3: Global GLContext registered');
    }

    /**
     * Step 4: GLステート初期設定
     */
    _configureGLState() {
      console.log('[WebGL2DrawingLayer] ⚙️ Step 4: Configuring GL state...');

      const gl = this.gl;

      // ブレンド設定
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

      // ビューポート設定
      gl.viewport(0, 0, this.width, this.height);

      // クリアカラー設定
      gl.clearColor(0, 0, 0, 0);

      console.log('[WebGL2DrawingLayer] ✅ Step 4: GL state configured');
    }

    /**
     * 描画Canvas取得
     * 
     * @returns {HTMLCanvasElement} 描画Canvas
     */
    getDrawingCanvas() {
      return this.drawingCanvas;
    }

    /**
     * GLコンテキスト取得
     * 
     * @returns {WebGL2RenderingContext} GLコンテキスト
     */
    getGLContext() {
      return this.gl;
    }

    /**
     * キャンバスサイズ取得
     * 
     * @returns {Object} {width, height}
     */
    getSize() {
      return {
        width: this.width,
        height: this.height
      };
    }

    /**
     * キャンバスリサイズ
     * 
     * @param {number} width - 新しい幅
     * @param {number} height - 新しい高さ
     */
    resize(width, height) {
      if (!this.drawingCanvas || !this.gl) {
        console.warn('[WebGL2DrawingLayer] ⚠️ Not initialized');
        return;
      }

      console.log(`[WebGL2DrawingLayer] 🔄 Resizing: ${width} x ${height}`);

      this.drawingCanvas.width = width;
      this.drawingCanvas.height = height;
      this.width = width;
      this.height = height;

      // ビューポート更新
      this.gl.viewport(0, 0, width, height);

      // グローバルコンテキスト更新
      window.GLContext.width = width;
      window.GLContext.height = height;

      console.log('[WebGL2DrawingLayer] ✅ Resize complete');
    }

    /**
     * クリーンアップ
     */
    dispose() {
      console.log('[WebGL2DrawingLayer] 🧹 Disposing...');

      // Canvas削除
      if (this.drawingCanvas && this.drawingCanvas.parentNode) {
        this.drawingCanvas.parentNode.removeChild(this.drawingCanvas);
      }

      // 参照クリア
      this.drawingCanvas = null;
      this.gl = null;
      this.initialized = false;

      console.log('[WebGL2DrawingLayer] ✅ Disposed');
    }
  }

  // グローバル登録
  window.WebGL2DrawingLayer = WebGL2DrawingLayer;

  console.log('✅ webgl2-drawing-layer.js Phase B-Emergency-1 loaded');
  console.log('   🚨 BE-1: 描画Canvas独立生成');
  console.log('   🚨 BE-1: PixiJSから完全分離');
  console.log('   ❌ ticker制御削除（不要）');

})();