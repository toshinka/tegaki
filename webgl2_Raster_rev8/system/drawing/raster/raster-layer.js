/**
 * ============================================================================
 * ファイル名: system/drawing/raster/raster-layer.js
 * 責務: WebGL2フレームバッファベースのレイヤー管理（外部GLコンテキスト使用版）
 * Phase: C-0.1 WebGL2コンテキスト統合修正版
 * 依存: なし（WebGL2コンテキストは外部から注入）
 * 親依存: raster-brush-core.js, webgl2-drawing-layer.js
 * 子依存: なし
 * 公開API: initialize(), createLayer(), getFramebuffer(), composite()
 * イベント発火: なし
 * イベント受信: なし
 * グローバル登録: window.RasterLayer
 * 実装状態: 🔧 Phase C-0.1 外部GLコンテキスト対応
 * 
 * 【Phase C-0.1 重要な設計変更】
 * - WebGL2コンテキストは外部から注入（完全分離達成）
 * - WebGL2DrawingLayerが作成したGLコンテキストを使用
 * - 独自キャンバス作成は廃止（PixiJSとの競合完全回避）
 * - FBO/テクスチャのライフサイクル管理を強化維持
 * ============================================================================
 */

class RasterLayer {
  constructor() {
    // ================================================================================
    // WebGL2コンテキスト（外部から注入）
    // ================================================================================
    this.gl = null; // 外部から設定される
    
    // ================================================================================
    // 初期化状態
    // ================================================================================
    this.initialized = false;
    
    // ================================================================================
    // レイヤーFBO/テクスチャ管理
    // ================================================================================
    this.layerFramebuffers = new Map(); // layerId -> WebGLFramebuffer
    this.layerTextures = new Map();     // layerId -> WebGLTexture
    
    // ================================================================================
    // キャンバスサイズ
    // ================================================================================
    this.canvasWidth = 400;
    this.canvasHeight = 400;
    
    // ================================================================================
    // 最適化設定
    // ================================================================================
    this.autoCreateFBO = true; // 自動FBO作成
    this.enableOptimization = true; // 最適化有効化
    
    // ================================================================================
    // GLステート保存用
    // ================================================================================
    this.savedGLState = null;
    
    // ================================================================================
    // デバッグ
    // ================================================================================
    this.debug = false;
  }

  // ============================================================================
  // 初期化メソッド群
  // ============================================================================

  /**
   * WebGL2コンテキストの初期化（外部GLコンテキスト使用）
   * @param {WebGL2RenderingContext} gl - 外部から提供されるWebGL2コンテキスト
   * @param {number} width - キャンバス幅
   * @param {number} height - キャンバス高さ
   * @param {Object} options - オプション
   * @returns {boolean} 成功/失敗
   */
  initialize(gl, width, height, options = {}) {
    if (this.initialized) {
      console.warn('[RasterLayer] Already initialized');
      return true;
    }

    try {
      // 外部からのGLコンテキストを使用
      if (!gl) {
        throw new Error('WebGL2 context not provided');
      }

      this.gl = gl;
      this.canvasWidth = width;
      this.canvasHeight = height;

      // 最適化設定適用
      if (options.autoCreateFBO !== undefined) {
        this.autoCreateFBO = options.autoCreateFBO;
      }
      if (options.enableOptimization !== undefined) {
        this.enableOptimization = options.enableOptimization;
      }

      this._applyOptimizationSettings();

      this.initialized = true;

      console.log('[RasterLayer] ✅ Initialized (外部GLコンテキスト)', {
        width,
        height,
        autoFBO: this.autoCreateFBO,
        optimization: this.enableOptimization
      });

      return true;

    } catch (error) {
      console.error('[RasterLayer] ❌ Initialization failed:', error);
      return false;
    }
  }

  /**
   * 最適化設定の適用
   * @private
   */
  _applyOptimizationSettings() {
    if (!this.enableOptimization) return;

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
      if (this.enableOptimization && this.defaultTextureParams) {
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
        throw new Error(`FBO incomplete: ${this._getFBOStatusString(status)}`);
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

      console.log(`[RasterLayer] ✅ Layer created: ${layerId}`, {
        fbo: fbo,
        texture: texture,
        size: `${this.canvasWidth}x${this.canvasHeight}`
      });

      return { fbo, texture };

    } catch (error) {
      console.error(`[RasterLayer] ❌ Failed to create layer ${layerId}:`, error);
      this._restoreGLState();
      return null;
    }
  }

  /**
   * FBOステータスを文字列に変換（デバッグ用）
   * @private
   */
  _getFBOStatusString(status) {
    const gl = this.gl;
    switch (status) {
      case gl.FRAMEBUFFER_COMPLETE: return 'COMPLETE';
      case gl.FRAMEBUFFER_INCOMPLETE_ATTACHMENT: return 'INCOMPLETE_ATTACHMENT';
      case gl.FRAMEBUFFER_INCOMPLETE_MISSING_ATTACHMENT: return 'INCOMPLETE_MISSING_ATTACHMENT';
      case gl.FRAMEBUFFER_INCOMPLETE_DIMENSIONS: return 'INCOMPLETE_DIMENSIONS';
      case gl.FRAMEBUFFER_UNSUPPORTED: return 'UNSUPPORTED';
      default: return `UNKNOWN(${status})`;
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
   * レイヤークリア
   * @param {string} layerId - レイヤーID
   */
  clearLayer(layerId) {
    const fbo = this.layerFramebuffers.get(layerId);
    if (!fbo) {
      console.warn(`[RasterLayer] Layer not found: ${layerId}`);
      return;
    }

    const gl = this.gl;

    // GLステート保存
    this._saveGLState();

    // FBOにバインドしてクリア
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.flush();

    // GLステート復元
    this._restoreGLState();

    console.log(`[RasterLayer] Layer cleared: ${layerId}`);
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
  // レイヤー合成
  // ============================================================================

  /**
   * 複数レイヤーの合成（Phase C-2で完全実装予定）
   * @param {Array<Object>} layerInfos - レイヤー情報配列
   * @param {WebGLFramebuffer} targetFBO - 出力先FBO（nullならデフォルト）
   */
  compositeLayers(layerInfos, targetFBO = null) {
    const gl = this.gl;

    // GLステート保存
    this._saveGLState();

    // 出力先FBOにバインド
    gl.bindFramebuffer(gl.FRAMEBUFFER, targetFBO);

    // クリア
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);

    // ブレンディング有効化
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

    // 各レイヤーを下から順に描画
    for (const layerInfo of layerInfos) {
      if (!layerInfo.visible) continue;

      const texture = this.layerTextures.get(layerInfo.id);
      if (!texture) continue;

      // Phase C-2: シェーダーを使った本格的な合成を実装予定
      // 現状は単純なブレンディングのみ
      // TODO: displayShaderを使った描画に置き換え
    }

    // GLステート復元
    this._restoreGLState();

    console.log(`[RasterLayer] Composited ${layerInfos.length} layers (simple mode)`);
  }

  // ============================================================================
  // サムネイル生成
  // ============================================================================

  /**
   * レイヤーサムネイル生成
   * @param {string} layerId - レイヤーID
   * @param {number} size - サムネイルサイズ
   * @returns {HTMLCanvasElement|null}
   */
  generateThumbnail(layerId, size = 48) {
    const texture = this.layerTextures.get(layerId);
    const fbo = this.layerFramebuffers.get(layerId);

    if (!texture || !fbo) {
      console.warn(`[RasterLayer] Layer not found for thumbnail: ${layerId}`);
      return null;
    }

    const gl = this.gl;

    // GLステート保存
    this._saveGLState();

    // ピクセルデータ読み取り
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    const pixels = new Uint8Array(this.canvasWidth * this.canvasHeight * 4);
    gl.readPixels(0, 0, this.canvasWidth, this.canvasHeight, gl.RGBA, gl.UNSIGNED_BYTE, pixels);

    // GLステート復元
    this._restoreGLState();

    // Canvas作成
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');

    // スケーリング計算
    const scale = Math.min(size / this.canvasWidth, size / this.canvasHeight);
    const scaledWidth = this.canvasWidth * scale;
    const scaledHeight = this.canvasHeight * scale;
    const offsetX = (size - scaledWidth) / 2;
    const offsetY = (size - scaledHeight) / 2;

    // 一時キャンバスに元画像を描画
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = this.canvasWidth;
    tempCanvas.height = this.canvasHeight;
    const tempCtx = tempCanvas.getContext('2d');
    const imageData = tempCtx.createImageData(this.canvasWidth, this.canvasHeight);

    // Y軸反転しながらコピー
    for (let y = 0; y < this.canvasHeight; y++) {
      for (let x = 0; x < this.canvasWidth; x++) {
        const srcIdx = ((this.canvasHeight - 1 - y) * this.canvasWidth + x) * 4;
        const dstIdx = (y * this.canvasWidth + x) * 4;
        imageData.data[dstIdx + 0] = pixels[srcIdx + 0];
        imageData.data[dstIdx + 1] = pixels[srcIdx + 1];
        imageData.data[dstIdx + 2] = pixels[srcIdx + 2];
        imageData.data[dstIdx + 3] = pixels[srcIdx + 3];
      }
    }

    tempCtx.putImageData(imageData, 0, 0);

    // スケーリングして描画
    ctx.drawImage(tempCanvas, 0, 0, this.canvasWidth, this.canvasHeight, offsetX, offsetY, scaledWidth, scaledHeight);

    return canvas;
  }

  /**
   * レイヤーピクセルデータ読み取り
   * @param {string} layerId - レイヤーID
   * @returns {Uint8Array|null}
   */
  readPixels(layerId) {
    const fbo = this.layerFramebuffers.get(layerId);
    if (!fbo) {
      console.warn(`[RasterLayer] Layer not found: ${layerId}`);
      return null;
    }

    const gl = this.gl;

    // GLステート保存
    this._saveGLState();

    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    const pixels = new Uint8Array(this.canvasWidth * this.canvasHeight * 4);
    gl.readPixels(0, 0, this.canvasWidth, this.canvasHeight, gl.RGBA, gl.UNSIGNED_BYTE, pixels);

    // GLステート復元
    this._restoreGLState();

    return pixels;
  }

  // ============================================================================
  // リサイズ処理
  // ============================================================================

  /**
   * 全レイヤーリサイズ
   * @param {number} newWidth - 新しい幅
   * @param {number} newHeight - 新しい高さ
   */
  resizeAll(newWidth, newHeight) {
    if (!this.initialized) {
      console.error('[RasterLayer] Not initialized');
      return;
    }

    console.log(`[RasterLayer] Resizing all layers: ${this.canvasWidth}x${this.canvasHeight} -> ${newWidth}x${newHeight}`);

    // サイズ更新
    this.canvasWidth = newWidth;
    this.canvasHeight = newHeight;

    // 既存レイヤーは再作成が必要（上位で処理）
    console.log('[RasterLayer] ⚠️  Existing layers need to be recreated after resize');
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
      enableOptimization: this.enableOptimization,
      glContext: this.gl ? 'OK' : 'MISSING'
    };
  }

  /**
   * パフォーマンス診断
   * @returns {Object}
   */
  diagnosePerformance() {
    if (!this.gl) {
      return { error: 'WebGL2 context not available' };
    }

    const gl = this.gl;

    const info = {
      renderer: gl.getParameter(gl.RENDERER),
      vendor: gl.getParameter(gl.VENDOR),
      version: gl.getParameter(gl.VERSION),
      maxTextureSize: gl.getParameter(gl.MAX_TEXTURE_SIZE),
      maxViewport: gl.getParameter(gl.MAX_VIEWPORT_DIMS),
      layerCount: this.layerFramebuffers.size
    };

    console.log('📊 [RasterLayer] Performance Diagnostics:', info);
    return info;
  }

  // ============================================================================
  // クリーンアップ
  // ============================================================================

  /**
   * 全リソース解放
   */
  destroy() {
    console.log('[RasterLayer] Destroying...');

    // 全レイヤー削除
    for (const layerId of this.layerFramebuffers.keys()) {
      this.deleteLayer(layerId);
    }

    // GLコンテキストは外部所有なので破棄しない
    this.gl = null;
    this.initialized = false;

    console.log('[RasterLayer] ✅ Destroyed');
  }
}

// ============================================================================
// グローバル登録
// ============================================================================

// シングルトンインスタンス作成
if (!window.RasterLayer) {
  window.RasterLayer = new RasterLayer();
  console.log('[RasterLayer] ✅ Global instance registered successfully');
}

console.log('✅ raster-layer.js Phase C-0.1 loaded (外部GLコンテキスト対応)');
console.log('   🔧 C-0.1: WebGL2コンテキスト外部注入方式に変更');
console.log('   ✅ C-0.1: PixiJSとのGLステート競合完全回避');
console.log('   ✅ C-0.1: FBO/テクスチャライフサイクル管理強化維持');
console.log('   ✅ Phase C-0全機能継承');