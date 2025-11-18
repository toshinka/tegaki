/**
 * ================================================================================
 * system/drawing/stroke-renderer.js
 * Phase 3 WebGL2移行版
 * ================================================================================
 * 
 * 📁 親ファイル依存:
 *   - webgl2-drawing-layer.js (WebGL2DrawingLayer)
 *   - gl-msdf-pipeline.js (MSDF生成) [Phase 3で実装予定]
 *   - gl-texture-bridge.js (Texture→Sprite変換) [Phase 5で実装予定]
 * 
 * 📄 子ファイル依存:
 *   - brush-core.js (呼び出し元・renderMSDFPreview使用)
 * 
 * 【WebGL2移行対応】
 * 🔧 WebGPUDrawingLayer → WebGL2DrawingLayer
 * 🔧 WebGPUTextureBridge → GLTextureBridge
 * 🔧 msdfPipelineManager → glMSDFPipeline
 * 🔧 GPUTexture → WebGLTexture
 * ✅ API互換性維持（呼び出し側変更不要）
 * 
 * ================================================================================
 */

(function() {
  'use strict';

  class StrokeRenderer {
    constructor() {
      this.webgl2DrawingLayer = null;
      this.glMSDFPipeline = null;
      this.textureBridge = null;
      
      this.initialized = false;
      this.initializationPromise = null;
      this.msdfMode = false;
      this.pipelineInfo = null;
    }

    async initialize() {
      if (this.initialized) return;
      if (this.initializationPromise) return this.initializationPromise;

      this.initializationPromise = (async () => {
        let retries = 0;
        const maxRetries = 50;

        while (retries < maxRetries) {
          // 🔧 WebGL2参照に変更
          this.webgl2DrawingLayer = window.WebGL2DrawingLayer;
          this.textureBridge = window.GLTextureBridge;
          this.glMSDFPipeline = window.GLMSDFPipeline;

          // WebGL2DrawingLayerは必須、他はオプショナル
          if (this.webgl2DrawingLayer?.isInitialized()) {
            break;
          }

          await new Promise(resolve => setTimeout(resolve, 100));
          retries++;
        }

        if (!this.webgl2DrawingLayer?.isInitialized()) {
          throw new Error('WebGL2DrawingLayer not initialized');
        }

        // TextureBridgeとMSDFPipelineは後から初期化される可能性がある
        if (!this.textureBridge) {
          console.warn('[StrokeRenderer] GLTextureBridge not available yet (will retry later)');
        }
        if (!this.glMSDFPipeline) {
          console.warn('[StrokeRenderer] GLMSDFPipeline not available yet (will retry later)');
        }

        this.initialized = true;
        console.log('[StrokeRenderer] ✅ Initialized (WebGL2 mode)');

      })();

      return this.initializationPromise;
    }

    /**
     * MSDF Mode 初期化
     * 🔧 WebGL2対応: GPURenderPipeline → WebGLProgram
     * 
     * @param {WebGLProgram} program - WebGL Shader Program
     * @param {WebGL2RenderingContext} gl - WebGL2 Context
     * @param {string} format - Texture Format (互換用)
     */
    initMSDFMode(program, gl, format) {
      this.msdfMode = true;
      this.pipelineInfo = {
        program: program,
        gl: gl,
        format: format
      };
      console.log('✅ [StrokeRenderer] MSDF Mode enabled (WebGL2)');
    }

    /**
     * MSDF Preview描画
     * 🔧 WebGL2対応: GPUTexture → WebGLTexture
     * 
     * @param {WebGLTexture} msdfTexture - MSDF Texture
     * @param {Object} bounds - {minX, minY, maxX, maxY}
     * @param {Object} settings - {mode, color, opacity}
     * @param {PIXI.Container} container - Layer Container
     * @returns {PIXI.Sprite|null}
     */
    async renderMSDFPreview(msdfTexture, bounds, settings, container) {
      if (!this.msdfMode || !msdfTexture) {
        console.error('[StrokeRenderer] MSDF mode not enabled or invalid texture');
        return null;
      }

      // TextureBridge遅延初期化チェック
      if (!this.textureBridge) {
        this.textureBridge = window.GLTextureBridge;
      }

      if (!this.textureBridge) {
        console.error('[StrokeRenderer] GLTextureBridge not available');
        return null;
      }

      try {
        const width = Math.ceil(bounds.maxX - bounds.minX) + 4;
        const height = Math.ceil(bounds.maxY - bounds.minY) + 4;

        if (width <= 0 || height <= 0) return null;

        // 🔧 WebGL2: createSpriteFromGLTexture
        const sprite = await this.textureBridge.createSpriteFromGLTexture(
          msdfTexture,
          width,
          height
        );

        if (sprite) {
          sprite.x = bounds.minX - 2;
          sprite.y = bounds.minY - 2;
          container.addChild(sprite);
        }

        return sprite;

      } catch (error) {
        console.error('❌ [StrokeRenderer] MSDF preview render failed:', error);
        return null;
      }
    }

    /**
     * WebGL2コンテキスト取得（ヘルパー）
     */
    getGL() {
      return this.webgl2DrawingLayer?.getGL() || null;
    }

    /**
     * Canvas取得（ヘルパー）
     */
    getCanvas() {
      return this.webgl2DrawingLayer?.getCanvas() || null;
    }

    /**
     * 初期化状態確認
     */
    isInitialized() {
      return this.initialized;
    }

    /**
     * MSDF Mode状態確認
     */
    isMSDFModeEnabled() {
      return this.msdfMode;
    }

    /**
     * クリーンアップ
     */
    destroy() {
      this.initialized = false;
      this.msdfMode = false;
      this.pipelineInfo = null;
      this.webgl2DrawingLayer = null;
      this.glMSDFPipeline = null;
      this.textureBridge = null;
    }
  }

  // Singleton登録
  window.StrokeRenderer = StrokeRenderer;
  window.strokeRenderer = new StrokeRenderer();

  console.log('✅ stroke-renderer.js (WebGL2移行版) loaded');
  console.log('   🔧 WebGPU → WebGL2 参照変更完了');

})();