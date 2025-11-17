// ================================================================================
// webgl2-drawing-layer.js - Phase 1完成版
// ================================================================================
// 【親依存】
// - なし（基盤レイヤー）
// 【子依存】
// - core-initializer.js（初期化呼び出し）
// - drawing-engine.js（Canvas取得）
// - gl-stroke-processor.js（GL Context参照）
// ================================================================================
// 【責務】
// - WebGL2 Context初期化・管理
// - Canvas取得・Viewport設定
// - FBO生成・削除
// - Extension確認
// ================================================================================

(function() {
  'use strict';

  class WebGL2DrawingLayer {
    constructor() {
      this.canvas = null;
      this.gl = null;
      this.initialized = false;
      this.extensions = {};
      this.maxTextureSize = 0;
    }

    async initialize() {
      console.log('[WebGL2DrawingLayer] Initializing...');

      // Canvas取得（優先順位: webgpu-canvas → webgl2-canvas）
      this.canvas = document.getElementById('webgpu-canvas') || 
                    document.getElementById('webgl2-canvas');
      
      if (!this.canvas) {
        throw new Error('WebGL2 Canvas not found (id: webgpu-canvas or webgl2-canvas)');
      }

      // WebGL2 Context取得
      const contextOptions = {
        alpha: true,
        antialias: false,
        depth: false,
        stencil: false,
        premultipliedAlpha: true,
        preserveDrawingBuffer: false,
        powerPreference: 'high-performance',
        desynchronized: true
      };

      this.gl = this.canvas.getContext('webgl2', contextOptions);
      
      if (!this.gl) {
        throw new Error('WebGL2 is not supported in this browser');
      }

      // Viewport設定
      const dpr = 1; // DPR固定（ガイドライン準拠）
      this.canvas.width = this.canvas.clientWidth * dpr;
      this.canvas.height = this.canvas.clientHeight * dpr;
      this.gl.viewport(0, 0, this.canvas.width, this.canvas.height);

      // Extensions確認・有