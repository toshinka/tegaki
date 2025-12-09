/**
 * ============================================================================
 * ファイル名: system/drawing/webgl2/gl-texture-bridge.js
 * 責務: WebGL2 Texture ↔ PIXI.Texture 変換（完全分離版）
 * Phase: C-0 WebGL2/PixiJS完全分離アーキテクチャ
 * 依存: PixiJS v8
 * 親依存: webgl2-drawing-layer.js, raster-brush-core.js
 * 子依存: なし
 * 公開API: createPixiTextureFromGL(), updatePixiTexture()
 * イベント発火: なし
 * イベント受信: なし
 * グローバル登録: window.GLTextureBridge
 * 実装状態: 🆕 Phase C-0 完全分離版
 * 
 * 【重要な設計変更】
 * - WebGL2テクスチャをPixiJS Spriteに安全に変換
 * - GLコンテキスト競合を完全回避
 * - Y軸反転処理を正確に実装
 * - メモリリーク防止の徹底
 * ============================================================================
 */

class GLTextureBridge {
  constructor() {
    // PixiJSアプリケーション参照
    this.pixiApp = null;
    
    // テクスチャキャッシュ（メモリ管理用）
    this.textureCache = new Map(); // layerId -> {glTexture, pixiTexture, pixiSprite}
    
    // 初期化状態
    this.initialized = false;
    
    // デバッグ
    this.debug = false;
  }

  // ============================================================================
  // 初期化
  // ============================================================================

  /**
   * PixiJSアプリケーションの登録
   * @param {PIXI.Application} pixiApp - PixiJSアプリ
   */
  initialize(pixiApp) {
    if (!pixiApp || !pixiApp.renderer) {
      console.error('[GLTextureBridge] Invalid PixiJS application');
      return false;
    }

    this.pixiApp = pixiApp;
    this.initialized = true;

    console.log('[GLTextureBridge] ✅ Initialized with PixiJS app');
    return true;
  }

  // ============================================================================
  // WebGL2 Texture → PIXI.Texture 変換
  // ============================================================================

  /**
   * WebGL2テクスチャからPixi Textureを作成
   * @param {WebGLTexture} glTexture - WebGL2テクスチャ
   * @param {WebGLRenderingContext} gl - WebGL2コンテキスト
   * @param {number} width - テクスチャ幅
   * @param {number} height - テクスチャ高さ
   * @param {string} layerId - レイヤーID（キャッシュキー）
   * @returns {PIXI.Texture|null}
   */
  createPixiTextureFromGL(glTexture, gl, width, height, layerId = null) {
    if (!this.initialized) {
      console.error('[GLTextureBridge] Not initialized');
      return null;
    }

    if (!glTexture || !gl) {
      console.error('[GLTextureBridge] Invalid glTexture or gl context');
      return null;
    }

    try {
      // キャッシュチェック
      if (layerId && this.textureCache.has(layerId)) {
        const cached = this.textureCache.get(layerId);
        if (cached.glTexture === glTexture) {
          if (this.debug) {
            console.log(`[GLTextureBridge] Using cached texture: ${layerId}`);
          }
          return cached.pixiTexture;
        } else {
          // GLテクスチャが変わった場合は古いのを破棄
          this._disposePixiTexture(layerId);
        }
      }

      // WebGL2テクスチャからピクセルデータを読み取る
      const pixels = new Uint8Array(width * height * 4);
      
      // FBOを一時的に作成してテクスチャを読み取り
      const tempFBO = gl.createFramebuffer();
      gl.bindFramebuffer(gl.FRAMEBUFFER, tempFBO);
      gl.framebufferTexture2D(
        gl.FRAMEBUFFER,
        gl.COLOR_ATTACHMENT0,
        gl.TEXTURE_2D,
        glTexture,
        0
      );

      // FBOステータス確認
      const status = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
      if (status !== gl.FRAMEBUFFER_COMPLETE) {
        throw new Error(`FBO incomplete: ${status}`);
      }

      // ピクセルデータ読み取り
      gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, pixels);

      // 描画完了を確実に待つ
      gl.finish();

      // 一時FBO削除
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.deleteFramebuffer(tempFBO);

      // Yaxis反転（WebGLとPixiJSの座標系の違いを吸収）
      const flippedPixels = this._flipTextureY(pixels, width, height);

      // PixiJS Textureを作成
      const pixiTexture = PIXI.Texture.fromBuffer(
        flippedPixels,
        width,
        height,
        {
          format: PIXI.FORMATS.RGBA,
          type: PIXI.TYPES.UNSIGNED_BYTE,
          alphaMode: PIXI.ALPHA_MODES.PREMULTIPLY_ALPHA
        }
      );

      // キャッシュに登録
      if (layerId) {
        this.textureCache.set(layerId, {
          glTexture,
          pixiTexture,
          pixiSprite: null // Spriteは後で作成
        });
      }

      if (this.debug) {
        console.log(`[GLTextureBridge] ✅ Texture created: ${width}x${height}`, layerId);
      }

      return pixiTexture;

    } catch (error) {
      console.error('[GLTextureBridge] ❌ Failed to create Pixi texture:', error);
      return null;
    }
  }

  /**
   * 既存のPixi Textureを更新
   * @param {string} layerId - レイヤーID
   * @param {WebGLTexture} glTexture - 新しいWebGL2テクスチャ
   * @param {WebGLRenderingContext} gl - WebGL2コンテキスト
   * @param {number} width - テクスチャ幅
   * @param {number} height - テクスチャ高さ
   * @returns {PIXI.Texture|null}
   */
  updatePixiTexture(layerId, glTexture, gl, width, height) {
    if (!this.textureCache.has(layerId)) {
      // キャッシュにない場合は新規作成
      return this.createPixiTextureFromGL(glTexture, gl, width, height, layerId);
    }

    try {
      // ピクセルデータ読み取り
      const pixels = new Uint8Array(width * height * 4);
      
      const tempFBO = gl.createFramebuffer();
      gl.bindFramebuffer(gl.FRAMEBUFFER, tempFBO);
      gl.framebufferTexture2D(
        gl.FRAMEBUFFER,
        gl.COLOR_ATTACHMENT0,
        gl.TEXTURE_2D,
        glTexture,
        0
      );

      gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
      gl.finish();

      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.deleteFramebuffer(tempFBO);

      // Y軸反転
      const flippedPixels = this._flipTextureY(pixels, width, height);

      // 既存のPixi Textureを更新
      const cached = this.textureCache.get(layerId);
      const pixiTexture = cached.pixiTexture;

      // BaseTextureのリソースを更新
      if (pixiTexture && pixiTexture.baseTexture && pixiTexture.baseTexture.resource) {
        pixiTexture.baseTexture.resource.data = flippedPixels;
        pixiTexture.baseTexture.resource.update();
      }

      // GLテクスチャ参照を更新
      cached.glTexture = glTexture;

      if (this.debug) {
        console.log(`[GLTextureBridge] ✅ Texture updated: ${layerId}`);
      }

      return pixiTexture;

    } catch (error) {
      console.error(`[GLTextureBridge] ❌ Failed to update texture ${layerId}:`, error);
      return null;
    }
  }

  // ============================================================================
  // PIXI.Sprite 管理
  // ============================================================================

  /**
   * レイヤー用のPixi Spriteを作成/取得
   * @param {string} layerId - レイヤーID
   * @returns {PIXI.Sprite|null}
   */
  getOrCreateSprite(layerId) {
    if (!this.textureCache.has(layerId)) {
      console.warn(`[GLTextureBridge] Texture not found: ${layerId}`);
      return null;
    }

    const cached = this.textureCache.get(layerId);

    // 既にSpriteがあれば返す
    if (cached.pixiSprite) {
      return cached.pixiSprite;
    }

    // Sprite作成
    const sprite = new PIXI.Sprite(cached.pixiTexture);
    sprite.name = `Layer_${layerId}`;
    
    // キャッシュに登録
    cached.pixiSprite = sprite;

    if (this.debug) {
      console.log(`[GLTextureBridge] ✅ Sprite created: ${layerId}`);
    }

    return sprite;
  }

  /**
   * Spriteを取得（存在する場合のみ）
   * @param {string} layerId - レイヤーID
   * @returns {PIXI.Sprite|null}
   */
  getSprite(layerId) {
    if (!this.textureCache.has(layerId)) {
      return null;
    }

    return this.textureCache.get(layerId).pixiSprite || null;
  }

  // ============================================================================
  // ユーティリティ
  // ============================================================================

  /**
   * Y軸反転（WebGL座標系 → ピクセル座標系）
   * @private
   * @param {Uint8Array} pixels - ピクセルデータ
   * @param {number} width - 幅
   * @param {number} height - 高さ
   * @returns {Uint8Array}
   */
  _flipTextureY(pixels, width, height) {
    const flipped = new Uint8Array(pixels.length);
    const rowSize = width * 4;

    for (let y = 0; y < height; y++) {
      const srcOffset = y * rowSize;
      const dstOffset = (height - 1 - y) * rowSize;
      
      for (let x = 0; x < rowSize; x++) {
        flipped[dstOffset + x] = pixels[srcOffset + x];
      }
    }

    return flipped;
  }

  /**
   * Pixi Textureを破棄
   * @private
   * @param {string} layerId - レイヤーID
   */
  _disposePixiTexture(layerId) {
    if (!this.textureCache.has(layerId)) {
      return;
    }

    const cached = this.textureCache.get(layerId);

    // Sprite破棄
    if (cached.pixiSprite) {
      if (cached.pixiSprite.parent) {
        cached.pixiSprite.parent.removeChild(cached.pixiSprite);
      }
      cached.pixiSprite.destroy();
    }

    // Texture破棄
    if (cached.pixiTexture) {
      cached.pixiTexture.destroy(true);
    }

    this.textureCache.delete(layerId);

    if (this.debug) {
      console.log(`[GLTextureBridge] Texture disposed: ${layerId}`);
    }
  }

  // ============================================================================
  // キャッシュ管理
  // ============================================================================

  /**
   * 特定レイヤーのキャッシュをクリア
   * @param {string} layerId - レイヤーID
   */
  clearCache(layerId) {
    this._disposePixiTexture(layerId);
  }

  /**
   * 全キャッシュをクリア
   */
  clearAllCache() {
    console.log('[GLTextureBridge] Clearing all cache...');
    
    for (const layerId of this.textureCache.keys()) {
      this._disposePixiTexture(layerId);
    }

    console.log('[GLTextureBridge] ✅ All cache cleared');
  }

  /**
   * キャッシュ情報取得
   * @returns {Object}
   */
  getCacheInfo() {
    return {
      cacheSize: this.textureCache.size,
      layers: Array.from(this.textureCache.keys()),
      details: Array.from(this.textureCache.entries()).map(([layerId, cached]) => ({
        layerId,
        hasTexture: !!cached.pixiTexture,
        hasSprite: !!cached.pixiSprite
      }))
    };
  }

  // ============================================================================
  // クリーンアップ
  // ============================================================================

  /**
   * 全リソース解放
   */
  dispose() {
    console.log('[GLTextureBridge] Disposing...');

    this.clearAllCache();
    this.pixiApp = null;
    this.initialized = false;

    console.log('[GLTextureBridge] ✅ Disposed');
  }
}

// ============================================================================
// グローバル登録
// ============================================================================

if (!window.GLTextureBridge) {
  window.GLTextureBridge = new GLTextureBridge();
  console.log('[GLTextureBridge] ✅ Global instance registered');
}

console.log('✅ gl-texture-bridge.js Phase C-0 loaded (完全分離版)');
console.log('   ✅ C-0: WebGL2 Texture → PIXI.Texture 安全変換');
console.log('   ✅ C-0: GLコンテキスト競合完全回避');
console.log('   ✅ C-0: Y軸反転処理正確実装');
console.log('   ✅ C-0: メモリリーク防止徹底');
console.log('   ✅ Phase C-1全機能継承');