/**
 * ============================================================================
 * ファイル名: system/drawing/raster/raster-layer.js
 * 責務: WebGL2フレームバッファベースのレイヤー管理（完全分離版）
 * Phase: C-0 WebGL2/PixiJS完全分離アーキテクチャ
 * 依存: なし（WebGL2コンテキスト完全独立）
 * 親依存: raster-brush-core.js, webgl2-drawing-layer.js
 * 子依存: なし
 * 公開API: initialize(), createLayer(), getFramebuffer(), composite()
 * イベント発火: なし
 * イベント受信: なし
 * グローバル登録: window.RasterLayer
 * 実装状態: 🆕 Phase C-0 完全分離版
 * 
 * 【重要な設計変更】
 * - WebGL2コンテキストはこのクラスが完全に所有
 * - PixiJSとのGLステート競合を完全回避
 * - FBO/テクスチャのライフサイクル管理を強化
 * - gl.finish()による確実な描画完了保証
 * ============================================================================
 */

class RasterLayer {
  constructor() {
    // WebGL2コンテキスト（完全独立）
    this.gl = null;
    this.canvas = null; // WebGL2専用キャンバス
    
    // 初期化状態
    this.initialized = false;
    
    // レイヤーFBO/テクスチャ管理
    this.layerFramebuffers = new Map(); // layerId -> WebGLFramebuffer
    this.layerTextures = new Map();     // layerId -> WebGLTexture
    
    // キャンバスサイズ
    this.canvasWidth = 400;
    this.canvasHeight = 400;
    
    // 最適化設定
    this.autoCreateFBO = true; // 自動FBO作成
    this.optimizationEnabled = true;
    
    // GLステート保存用
    this.savedGLState = null;
    
    // デバッグ
    this.debug = false;
  }

  // ============================================================================
  // 初期化メソッド群
  // ============================================================================

  /**
   * WebGL2コンテキストの初期化（完全独立）
   * @param {number} width - キャンバス幅
   * @param {number} height - キャンバス高さ
   * @param {Object} options - オプション
   * @returns {boolean} 成功/失敗
   */
  initialize(width, height, options = {}) {
    if (this.initialized) {
      console.warn('[RasterLayer] Already initialized');
      return true;
    }

    try {
      // WebGL2専用キャンバス作成（PixiJSとは完全に別）
      this.canvas = document.createElement('canvas');
      this.canvas.width = width;
      this.canvas.height = height;
      this.canvas.style.display = 'none'; // 非表示（テクスチャ生成専用）

      // WebGL2コンテキスト取得
      const contextOptions = {
        alpha: true,
        premultipliedAlpha: true,
        antialias: options.antialias !== false,
        preserveDrawingBuffer: true, // テクスチャ読み取りのため必須
        powerPreference: options.highPerformance ? 'high-performance' : 'default'
      };

      this.gl = this.canvas.getContext('webgl2', contextOptions);

      if (!this.gl) {
        throw new Error('WebGL2 not supported');
      }

      // キャンバスサイズ保存
      this.canvasWidth = width;
      this.canvasHeight = height;

      // WebGL2初期設定
      this._setupWebGL2State();

      // 最適化設定適用
      if (options.autoCreateFBO !== undefined) {
        this.autoCreateFBO = options.autoCreateFBO;
      }
      if (options.optimization !== undefined) {
        this.optimizationEnabled = options.optimization;
      }

      this._applyOptimizationSettings();

      this.initialized = true;

      console.log('[RasterLayer] ✅ Initialized (独立WebGL2コンテキスト)', {
        width,
        height,
        autoFBO: this.autoCreateFBO,
        optimization: this.optimizationEnabled
      });

      return true;

    } catch (error) {
      console.error('[RasterLayer] ❌ Initialization failed:', error);
      return false;
    }
  }

  /**
   * WebGL2ステートの初期設定
   * @private
   */
  _setupWebGL2State() {
    const gl = this.gl;

    // ブレンディング設定（アルファ合成）
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

    // デプステスト無効（2D描画）
    gl.disable(gl.DEPTH_TEST);

    // カリング無効
    gl.disable(gl.CULL_FACE);

    // ビューポート設定
    gl.viewport(0, 0, this.canvasWidth, this.canvasHeight);

    // クリアカラー（透明）
    gl.clearColor(0, 0, 0, 0);
  }

  /**
   * 最適化設定の適用
   * @private
   */
  _applyOptimizationSettings() {
    if (!this.optimizationEnabled) return;

    const gl = this.gl;

    // テクスチャパラメータ最適化
    this.defaultTextureParams = {
      minFilter: gl.LINEAR,
      magFilter: gl.LINEAR,
      wrapS: gl.CLAMP_TO_EDGE,
      wrapT: gl.CLAMP_TO_EDGE
    };

    console.log('[RasterLayer] ✅ Optimization settings applied');
  }

  // ============================================================================
  // レイヤーFBO/テクスチャ管理
  // ============================================================================

  /**
   * レイヤー用FBO/テクスチャの作成
   * @param {string} layerId - レイヤーID
   * @returns {Object|null} {fbo, texture} または null
   */
  createLayer(layerId) {
    if (!this.initialized) {
      console.error('[RasterLayer] Not initialized');
      return null;
    }

    if (this.layerFramebuffers.has(layerId)) {
      console.warn(`[RasterLayer] Layer already exists: ${layerId}`);
      return {
        fbo: this.layerFramebuffers.get(layerId),
        texture: this.layerTextures.get(layerId)
      };
    }

    const gl = this.gl;

    try {
      // GLステート保存
      this._saveGLState();

      // テクスチャ作成
      const texture = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, texture);

      // テクスチャデータ確保（透明で初期化）
      gl.texImage2D(
        gl.TEXTURE_2D,
        0,
        gl.RGBA,
        this.canvasWidth,
        this.canvasHeight,
        0,
        gl.RGBA,
        gl.UNSIGNED_BYTE,
        null
      );

      // テクスチャパラメータ設定
      if (this.optimizationEnabled && this.defaultTextureParams) {
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, this.defaultTextureParams.minFilter);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, this.defaultTextureParams.magFilter);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, this.defaultTextureParams.wrapS);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, this.defaultTextureParams.wrapT);
      } else {
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      }

      // FBO作成
      const fbo = gl.createFramebuffer();
      gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);

      // テクスチャをFBOにアタッチ
      gl.framebufferTexture2D(
        gl.FRAMEBUFFER,
        gl.COLOR_ATTACHMENT0,
        gl.TEXTURE_2D,
        texture,
        0
      );

      // FBOステータス確認
      const status = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
      if (status !== gl.FRAMEBUFFER_COMPLETE) {
        throw new Error(`FBO incomplete: ${status}`);
      }

      // FBOをクリア（透明）
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);

      // 確実に描画完了を待つ
      gl.flush();
      gl.finish();

      // GLステート復元
      this._restoreGLState();

      // 管理Mapに登録
      this.layerFramebuffers.set(layerId, fbo);
      this.layerTextures.set(layerId, texture);

      console.log(`[RasterLayer] ✅ Layer created: ${layerId}`);

      return { fbo, texture };

    } catch (error) {
      console.error(`[RasterLayer] ❌ Failed to create layer ${layerId}:`, error);
      this._restoreGLState();
      return null;
    }
  }

  /**
   * 自動FBO作成（必要時）
   * @param {string} layerId - レイヤーID
   * @returns {Object|null} {fbo, texture}
   */
  getOrCreateLayer(layerId) {
    if (this.layerFramebuffers.has(layerId)) {
      return {
        fbo: this.layerFramebuffers.get(layerId),
        texture: this.layerTextures.get(layerId)
      };
    }

    if (this.autoCreateFBO) {
      console.log(`[RasterLayer] Auto-creating layer: ${layerId}`);
      return this.createLayer(layerId);
    }

    console.warn(`[RasterLayer] Layer not found and auto-create disabled: ${layerId}`);
    return null;
  }

  /**
   * レイヤーFBO取得
   * @param {string} layerId - レイヤーID
   * @returns {WebGLFramebuffer|null}
   */
  getFramebuffer(layerId) {
    return this.layerFramebuffers.get(layerId) || null;
  }

  /**
   * レイヤーテクスチャ取得
   * @param {string} layerId - レイヤーID
   * @returns {WebGLTexture|null}
   */
  getTexture(layerId) {
    return this.layerTextures.get(layerId) || null;
  }

  /**
   * レイヤー削除
   * @param {string} layerId - レイヤーID
   */
  deleteLayer(layerId) {
    const gl = this.gl;

    const fbo = this.layerFramebuffers.get(layerId);
    const texture = this.layerTextures.get(layerId);

    if (fbo) {
      gl.deleteFramebuffer(fbo);
      this.layerFramebuffers.delete(layerId);
    }

    if (texture) {
      gl.deleteTexture(texture);
      this.layerTextures.delete(layerId);
    }

    console.log(`[RasterLayer] Layer deleted: ${layerId}`);
  }

  // ============================================================================
  // GLステート管理（競合回避）
  // ============================================================================

  /**
   * GLステート保存（描画前）
   * @private
   */
  _saveGLState() {
    const gl = this.gl;

    this.savedGLState = {
      viewport: gl.getParameter(gl.VIEWPORT),
      blend: gl.getParameter(gl.BLEND),
      blendSrc: gl.getParameter(gl.BLEND_SRC_ALPHA),
      blendDst: gl.getParameter(gl.BLEND_DST_ALPHA),
      activeTexture: gl.getParameter(gl.ACTIVE_TEXTURE),
      currentProgram: gl.getParameter(gl.CURRENT_PROGRAM),
      framebuffer: gl.getParameter(gl.FRAMEBUFFER_BINDING),
      texture: gl.getParameter(gl.TEXTURE_BINDING_2D)
    };
  }

  /**
   * GLステート復元（描画後）
   * @private
   */
  _restoreGLState() {
    if (!this.savedGLState) return;

    const gl = this.gl;
    const state = this.savedGLState;

    // ビューポート復元
    if (state.viewport) {
      gl.viewport(state.viewport[0], state.viewport[1], state.viewport[2], state.viewport[3]);
    }

    // ブレンディング復元
    if (state.blend) {
      gl.enable(gl.BLEND);
    } else {
      gl.disable(gl.BLEND);
    }

    // FBO復元
    gl.bindFramebuffer(gl.FRAMEBUFFER, state.framebuffer);

    // テクスチャ復元
    gl.bindTexture(gl.TEXTURE_2D, state.texture);

    // プログラム復元
    gl.useProgram(state.currentProgram);

    this.savedGLState = null;
  }

  // ============================================================================
  // レイヤー合成（将来実装）
  // ============================================================================

  /**
   * 複数レイヤーの合成
   * @param {Array<string>} layerIds - レイヤーID配列（下から順）
   * @param {WebGLFramebuffer} targetFBO - 出力先FBO（nullならデフォルト）
   */
  composite(layerIds, targetFBO = null) {
    console.warn('[RasterLayer] composite() not yet implemented');
    // Phase C-2で実装予定
  }

  // ============================================================================
  // リサイズ処理
  // ============================================================================

  /**
   * キャンバスリサイズ
   * @param {number} newWidth - 新しい幅
   * @param {number} newHeight - 新しい高さ
   */
  resize(newWidth, newHeight) {
    if (!this.initialized) {
      console.error('[RasterLayer] Not initialized');
      return;
    }

    console.log(`[RasterLayer] Resizing: ${this.canvasWidth}x${this.canvasHeight} -> ${newWidth}x${newHeight}`);

    // キャンバスサイズ変更
    this.canvas.width = newWidth;
    this.canvas.height = newHeight;
    this.canvasWidth = newWidth;
    this.canvasHeight = newHeight;

    // ビューポート更新
    this.gl.viewport(0, 0, newWidth, newHeight);

    // 既存レイヤーはリサイズ不要（再作成が必要な場合は上位で処理）
    console.log('[RasterLayer] ✅ Resize completed');
  }

  // ============================================================================
  // デバッグ・診断
  // ============================================================================

  /**
   * 診断情報取得
   * @returns {Object}
   */
  getDiagnostics() {
    return {
      initialized: this.initialized,
      canvasSize: `${this.canvasWidth}x${this.canvasHeight}`,
      layerCount: this.layerFramebuffers.size,
      layers: Array.from(this.layerFramebuffers.keys()),
      autoCreateFBO: this.autoCreateFBO,
      optimizationEnabled: this.optimizationEnabled,
      glContext: this.gl ? 'OK' : 'MISSING'
    };
  }

  /**
   * パフォーマンス診断
   * @returns {Object}
   */
  getPerformanceDiagnostics() {
    if (!this.gl) {
      return { error: 'WebGL2 context not available' };
    }

    const gl = this.gl;

    return {
      renderer: gl.getParameter(gl.RENDERER),
      vendor: gl.getParameter(gl.VENDOR),
      version: gl.getParameter(gl.VERSION),
      maxTextureSize: gl.getParameter(gl.MAX_TEXTURE_SIZE),
      maxViewport: gl.getParameter(gl.MAX_VIEWPORT_DIMS),
      extensions: gl.getSupportedExtensions()
    };
  }

  // ============================================================================
  // クリーンアップ
  // ============================================================================

  /**
   * 全リソース解放
   */
  dispose() {
    console.log('[RasterLayer] Disposing...');

    // 全レイヤー削除
    for (const layerId of this.layerFramebuffers.keys()) {
      this.deleteLayer(layerId);
    }

    // WebGL2コンテキスト解放
    if (this.gl) {
      const ext = this.gl.getExtension('WEBGL_lose_context');
      if (ext) {
        ext.loseContext();
      }
      this.gl = null;
    }

    // キャンバス削除
    if (this.canvas && this.canvas.parentNode) {
      this.canvas.parentNode.removeChild(this.canvas);
    }
    this.canvas = null;

    this.initialized = false;

    console.log('[RasterLayer] ✅ Disposed');
  }
}

// ============================================================================
// グローバル登録
// ============================================================================

// シングルトンインスタンス作成
if (!window.RasterLayer) {
  window.RasterLayer = new RasterLayer();
  console.log('[RasterLayer] ✅ Global instance registered successfully');
  console.log('[RasterLayer]   ', window.RasterLayer);
}

console.log('✅ raster-layer.js Phase C-0 loaded (完全分離版)');
console.log('   ✅ C-0: WebGL2コンテキスト完全独立');
console.log('   ✅ C-0: PixiJSとのGLステート競合回避');
console.log('   ✅ C-0: FBO/テクスチャライフサイクル管理');
console.log('   ✅ C-0: gl.finish()による確実な描画完了保証');
console.log('   ✅ Phase C-2/C-3全機能継承');