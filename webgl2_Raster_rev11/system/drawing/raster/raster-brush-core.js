/**
 * ============================================================================
 * raster-brush-core.js - Phase B-Emergency-2
 * ============================================================================
 * 責務: ラスターブラシGPU描画（描画Canvas専用）
 * 変更内容:
 *   ❌ 削除: ticker制御系メソッド（180行削除）
 *   ✅ 簡素化: finalizeStroke() → 転送トリガーのみ
 *   ✅ 独立: PixiJS依存完全削除
 * 
 * 親依存: brush-core.js, drawing-engine.js
 * 子依存: raster-layer.js, brush-stamp.js, brush-interpolator.js
 * グローバル: window.RasterBrushCore, window.rasterBrushCore
 * ============================================================================
 */

class RasterBrushCore {
  constructor() {
    this.gl = null;
    this.rasterLayer = null;
    this.brushStamp = null;
    this.brushInterpolator = null;
    this.settingsManager = null;

    // シェーダープログラム
    this.brushProgram = null;
    this.eraserProgram = null;

    // ストローク状態
    this.isDrawing = false;
    this.currentStroke = null;
    this.currentMode = 'pen'; // 'pen' | 'eraser'

    // Uniform locations
    this.uniformLocations = {};
  }

  /**
   * 初期化（描画Canvas専用）
   * @param {HTMLCanvasElement} drawingCanvas - 独立描画Canvas
   */
  initialize(drawingCanvas) {
    console.log('[RasterBrushCore] 🚀 Initializing (separated mode)...');

    // GLコンテキスト取得
    this.gl = drawingCanvas.getContext('webgl2');
    if (!this.gl) {
      throw new Error('[RasterBrushCore] ❌ Failed to get WebGL2 context');
    }

    // 依存モジュール取得
    this.rasterLayer = window.rasterLayer;
    this.brushStamp = window.brushStamp;
    this.brushInterpolator = window.brushInterpolator;
    this.settingsManager = window.settingsManager;

    if (!this.rasterLayer || !this.brushStamp || !this.brushInterpolator) {
      throw new Error('[RasterBrushCore] ❌ Required modules not found');
    }

    console.log('[RasterBrushCore] ✅ Dependencies loaded');

    // シェーダー初期化
    this._initializeShaders();

    console.log('[RasterBrushCore] 🎉 Initialized successfully (separated mode)');
    console.log('   ✅ No PixiJS dependency');
    console.log('   ✅ No ticker control needed');
    console.log('   ✅ Pure WebGL2 drawing');
  }

  /**
   * シェーダー初期化
   */
  _initializeShaders() {
    const gl = this.gl;

    // ブラシシェーダー
    const vertexShader = this._compileShader(
      gl.VERTEX_SHADER,
      window.GLSL_SHADERS.BRUSH_STAMP_VERTEX
    );
    const fragmentShader = this._compileShader(
      gl.FRAGMENT_SHADER,
      window.GLSL_SHADERS.BRUSH_STAMP_FRAGMENT
    );

    this.brushProgram = gl.createProgram();
    gl.attachShader(this.brushProgram, vertexShader);
    gl.attachShader(this.brushProgram, fragmentShader);
    gl.linkProgram(this.brushProgram);

    if (!gl.getProgramParameter(this.brushProgram, gl.LINK_STATUS)) {
      throw new Error('[RasterBrushCore] Shader link failed: ' + 
        gl.getProgramInfoLog(this.brushProgram));
    }

    // Uniform locations取得
    gl.useProgram(this.brushProgram);
    this.uniformLocations = {
      u_matrix: gl.getUniformLocation(this.brushProgram, 'u_matrix'),
      u_position: gl.getUniformLocation(this.brushProgram, 'u_position'),
      u_size: gl.getUniformLocation(this.brushProgram, 'u_size'),
      u_color: gl.getUniformLocation(this.brushProgram, 'u_color'),
      u_opacity: gl.getUniformLocation(this.brushProgram, 'u_opacity'),
      u_hardness: gl.getUniformLocation(this.brushProgram, 'u_hardness'),
      u_rotation: gl.getUniformLocation(this.brushProgram, 'u_rotation')
    };

    // Attribute locations
    this.attribLocations = {
      a_position: gl.getAttribLocation(this.brushProgram, 'a_position')
    };

    console.log('[RasterBrushCore] ✅ Shaders initialized');
  }

  /**
   * シェーダーコンパイル
   */
  _compileShader(type, source) {
    const gl = this.gl;
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);

    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      const info = gl.getShaderInfoLog(shader);
      gl.deleteShader(shader);
      throw new Error('[RasterBrushCore] Shader compile failed: ' + info);
    }

    return shader;
  }

  /**
   * ストローク開始（簡素化版）
   */
  startStroke(localX, localY, pressure, tiltX, tiltY, twist) {
    console.log('[RasterBrushCore] ✏️ Starting stroke (separated mode)');

    this.isDrawing = true;

    // ストローク情報初期化
    this.currentStroke = {
      layerId: this._getCurrentLayerId(),
      points: [],
      startTime: Date.now()
    };

    // 初回ポイント記録
    this.currentStroke.points.push({
      x: localX,
      y: localY,
      pressure,
      tiltX,
      tiltY,
      twist
    });

    // FBOバインド
    this.rasterLayer.bindFramebuffer(this.currentStroke.layerId);

    // 初回スタンプ描画
    this._drawBrushStamp(localX, localY, pressure, tiltX, tiltY, twist);

    console.log('[RasterBrushCore] ✅ Stroke started');
  }

  /**
   * ストロークポイント追加（簡素化版）
   */
  addStrokePoint(localX, localY, pressure, tiltX, tiltY, twist) {
    if (!this.isDrawing || !this.currentStroke) return;

    const prevPoint = this.currentStroke.points[this.currentStroke.points.length - 1];

    // ポイント記録
    this.currentStroke.points.push({
      x: localX,
      y: localY,
      pressure,
      tiltX,
      tiltY,
      twist
    });

    // 補間＋描画
    const interpolated = this.brushInterpolator.interpolate(prevPoint, {
      x: localX,
      y: localY,
      pressure,
      tiltX,
      tiltY,
      twist
    });

    for (const point of interpolated) {
      this._drawBrushStamp(
        point.x,
        point.y,
        point.pressure,
        point.tiltX || 0,
        point.tiltY || 0,
        point.twist || 0
      );
    }
  }

  /**
   * ストローク完了（簡素化版 - 転送トリガーのみ）
   */
  finalizeStroke() {
    if (!this.isDrawing || !this.currentStroke) return;

    console.log('[RasterBrushCore] 🏁 Finalizing stroke (separated mode)');

    const layerId = this.currentStroke.layerId;

    // 1. FBO unbind
    this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, null);

    // 2. 描画完了
    this.isDrawing = false;
    const strokeData = { ...this.currentStroke };
    this.currentStroke = null;

    console.log('[RasterBrushCore] ✅ Stroke finalized');
    console.log('   Points:', strokeData.points.length);
    console.log('   Layer:', layerId);

    // 3. 転送トリガー
    console.log('[RasterBrushCore] 🔄 Triggering texture transfer...');
    
    if (window.glTextureBridge) {
      window.glTextureBridge.transferLayerToPixi(layerId);
      console.log('[RasterBrushCore] ✅ Transfer triggered');
    } else {
      console.warn('[RasterBrushCore] ⚠️ GLTextureBridge not ready');
    }

    return strokeData;
  }

  /**
   * ブラシスタンプ描画
   */
  _drawBrushStamp(x, y, pressure, tiltX, tiltY, twist) {
    const gl = this.gl;
    const settings = this.settingsManager.getBrushSettings();

    // サイズ計算
    const baseSize = settings.size;
    const minSize = settings.minPressureSize;
    const size = baseSize * (minSize + (1 - minSize) * pressure);

    // 色・不透明度
    const color = settings.color;
    const opacity = settings.opacity * pressure;

    // シェーダー使用
    gl.useProgram(this.brushProgram);

    // Uniform設定
    gl.uniform2f(this.uniformLocations.u_position, x, y);
    gl.uniform1f(this.uniformLocations.u_size, size);
    gl.uniform4f(this.uniformLocations.u_color, 
      color.r, color.g, color.b, opacity);
    gl.uniform1f(this.uniformLocations.u_hardness, settings.hardness || 0.8);
    gl.uniform1f(this.uniformLocations.u_rotation, twist || 0);

    // Quad描画
    this._renderQuad();
  }

  /**
   * Quad描画
   */
  _renderQuad() {
    const gl = this.gl;

    // 簡易Quad（VBOなし・毎回生成）
    const vertices = new Float32Array([
      -1, -1,
       1, -1,
      -1,  1,
       1,  1
    ]);

    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);

    gl.enableVertexAttribArray(this.attribLocations.a_position);
    gl.vertexAttribPointer(this.attribLocations.a_position, 2, gl.FLOAT, false, 0, 0);

    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

    // クリーンアップ
    gl.deleteBuffer(buffer);
  }

  /**
   * 現在レイヤーID取得
   */
  _getCurrentLayerId() {
    const layer = window.layerManager?.getActiveLayer();
    return layer?.id || 'layer_default';
  }

  /**
   * モード設定
   */
  setMode(mode) {
    this.currentMode = mode;
    console.log('[RasterBrushCore] Mode:', mode);
  }
}

// ============================================================================
// グローバル登録
// ============================================================================
window.RasterBrushCore = RasterBrushCore;
window.rasterBrushCore = null; // core-engineで初期化

console.log('✅ raster-brush-core.js Phase B-Emergency-2 loaded');
console.log('   🚨 BE-2: ticker制御系メソッド削除（180行）');
console.log('   🚨 BE-2: finalizeStroke()簡素化');
console.log('   🚨 BE-2: PixiJS依存完全削除');
console.log('   ✅ コード量: 約1/3に簡素化');