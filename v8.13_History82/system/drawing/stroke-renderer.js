/**
 * StrokeRenderer v4.0 - Phase 2: perfect-freehand + Mesh描画
 * 変更点:
 * - perfect-freehandアウトライン→Triangle Strip Mesh変換
 * - Graphics.lineStyle()描画を完全削除（二重実装防止）
 * - meshVerticesデータ構造追加
 * - Phase 1の最小幅保証を継承
 */

class StrokeRenderer {
  constructor(config, renderer = null) {
    this.config = config || {};
    this.renderer = renderer;
    
    // Mesh/Graphicsプール
    this.meshPool = [];
    this.graphicsPool = [];
    this.maxPoolSize = 50;
    
    // Phase 1継承: devicePixelRatio対応
    this.baseMinWidth = 1.0;
  }

  setRenderer(renderer) {
    this.renderer = renderer;
  }

  /**
   * Phase 1継承: devicePixelRatio対応の最小表示幅
   */
  getMinPhysicalWidth() {
    if (!this.renderer || !this.renderer.resolution) {
      const dpr = window.devicePixelRatio || 1;
      return this.baseMinWidth / dpr;
    }
    return 1.0 / this.renderer.resolution;
  }

  getPressureAdjustedWidth(pressure, baseSize) {
    const minWidth = this.getMinPhysicalWidth();
    if (pressure <= 0) return minWidth;
    return minWidth + (baseSize - minWidth) * pressure;
  }

  /**
   * ========== Phase 2: 中核機能 START ==========
   * perfect-freehand + Mesh描画
   * @param {Array} points - [{ x, y, pressure }]
   * @param {Object} strokeOptions - { size, thinning, smoothing, streamline, color, alpha }
   * @param {PIXI.Container} container - 描画先コンテナ（Mesh追加用）
   * @param {boolean} incremental - リアルタイム描画モード
   * @returns {Object} { mesh, meshVertices } - 生成されたMeshとその頂点データ
   */
  renderStroke(points, strokeOptions, container, incremental = false) {
    if (!points || points.length === 0 || !container) {
      return { mesh: null, meshVertices: null };
    }

    // perfect-freehand利用可能チェック
    if (typeof getStroke === 'undefined') {
      return this.renderStrokeWithCircles(points, strokeOptions, container);
    }

    try {
      // Phase 1: 最小幅保証
      const minWidth = this.getMinPhysicalWidth();
      const adjustedSize = Math.max(strokeOptions.size || 8, minWidth);

      // perfect-freehand設定（計画書準拠）
      const pfOptions = {
        size: adjustedSize,
        thinning: strokeOptions.thinning !== undefined ? strokeOptions.thinning : 0,
        smoothing: strokeOptions.smoothing !== undefined ? strokeOptions.smoothing : 0.5,
        streamline: strokeOptions.streamline !== undefined ? strokeOptions.streamline : 0.5,
        simulatePressure: strokeOptions.simulatePressure !== undefined ? strokeOptions.simulatePressure : false
      };

      // 入力形式変換: [{x,y,pressure}] → [[x, y, pressure]]
      const pfInput = points.map(pt => [
        pt.x,
        pt.y,
        pt.pressure !== undefined ? pt.pressure : 0.5
      ]);

      // アウトライン生成
      const outline = getStroke(pfInput, pfOptions);

      if (!outline || outline.length < 3) {
        return this.renderStrokeWithCircles(points, strokeOptions, container);
      }

      // Triangle Strip Mesh生成
      const meshData = this.createMeshFromOutline(
        outline,
        strokeOptions.color || 0x000000,
        strokeOptions.alpha !== undefined ? strokeOptions.alpha : 1.0
      );

      // Meshをコンテナに追加
      if (meshData.mesh) {
        container.addChild(meshData.mesh);
      }

      return meshData;

    } catch (error) {
      console.error('[StrokeRenderer] Mesh generation failed:', error);
      return this.renderStrokeWithCircles(points, strokeOptions, container);
    }
  }

  /**
   * Phase 2: アウトライン→Triangle Strip Mesh変換
   * @param {Array} outline - [[x, y], ...] アウトライン座標
   * @param {number} color - 0xRRGGBB
   * @param {number} alpha - 0.0～1.0
   * @returns {Object} { mesh, meshVertices }
   */
  createMeshFromOutline(outline, color, alpha) {
    if (!outline || outline.length < 3) {
      return { mesh: null, meshVertices: null };
    }

    // 頂点配列構築: outline座標をそのまま使用
    const vertices = [];
    const uvs = [];
    const indices = [];

    // アウトラインをTriangle Fan方式で三角形分割
    // 中心点として最初の点を使用
    const center = outline[0];
    vertices.push(center[0], center[1]);
    uvs.push(0.5, 0.5);

    // 外周点を追加
    for (let i = 0; i < outline.length; i++) {
      const pt = outline[i];
      vertices.push(pt[0], pt[1]);
      
      // UV座標（0-1範囲）
      const u = (i / outline.length);
      uvs.push(u, 0);
    }

    // インデックス生成: Triangle Fan
    for (let i = 1; i < outline.length; i++) {
      indices.push(0, i, i + 1);
    }
    // 最後の三角形：閉じる
    indices.push(0, outline.length, 1);

    // PIXI.Geometry生成
    const geometry = new PIXI.Geometry()
      .addAttribute('aVertexPosition', vertices, 2)
      .addAttribute('aTextureCoord', uvs, 2)
      .addIndex(indices);

    // 単色用シェーダー（PixiJS v8標準）
    const shader = PIXI.Shader.from(
      // Vertex Shader
      `
      precision mediump float;
      attribute vec2 aVertexPosition;
      attribute vec2 aTextureCoord;
      uniform mat3 projectionMatrix;
      uniform mat3 translationMatrix;
      varying vec2 vTextureCoord;
      
      void main() {
        vTextureCoord = aTextureCoord;
        gl_Position = vec4((projectionMatrix * translationMatrix * vec3(aVertexPosition, 1.0)).xy, 0.0, 1.0);
      }
      `,
      // Fragment Shader
      `
      precision mediump float;
      varying vec2 vTextureCoord;
      uniform vec4 uColor;
      
      void main() {
        gl_FragColor = uColor;
      }
      `,
      // Uniforms
      {
        uColor: this.hexToRGBA(color, alpha)
      }
    );

    // Mesh生成
    const mesh = new PIXI.Mesh({ geometry, shader });

    // meshVertices保存用データ
    const meshVertices = {
      vertices: Array.from(vertices),
      uvs: Array.from(uvs),
      indices: Array.from(indices),
      color: color,
      alpha: alpha
    };

    return { mesh, meshVertices };
  }

  /**
   * Hex color → RGBA配列変換
   */
  hexToRGBA(hex, alpha) {
    const r = ((hex >> 16) & 0xFF) / 255;
    const g = ((hex >> 8) & 0xFF) / 255;
    const b = (hex & 0xFF) / 255;
    return [r, g, b, alpha];
  }

  /**
   * ========== Phase 2: 中核機能 END ==========
   */

  /**
   * フォールバック: Graphicsで円描画
   * Phase 1の最小幅保証を継承
   */
  renderStrokeWithCircles(points, strokeOptions, container) {
    if (!points || points.length === 0 || !container) {
      return { mesh: null, meshVertices: null };
    }

    const graphics = this.getGraphicsFromPool();
    const minWidth = this.getMinPhysicalWidth();
    const size = Math.max(strokeOptions.size || 8, minWidth);
    const color = strokeOptions.color || 0x000000;
    const alpha = strokeOptions.alpha !== undefined ? strokeOptions.alpha : 1.0;

    for (const pt of points) {
      const pressure = pt.pressure || 0.5;
      const radius = this.getPressureAdjustedWidth(pressure, size) / 2;
      
      graphics.circle(pt.x, pt.y, radius);
      graphics.fill({ color, alpha });
    }

    container.addChild(graphics);
    
    return { 
      mesh: graphics, 
      meshVertices: null // Graphicsはmeshデータなし
    };
  }

  /**
   * History用: meshVerticesからMesh再構築
   * @param {Object} meshVertices - { vertices, uvs, indices, color, alpha }
   * @param {PIXI.Container} container
   * @returns {PIXI.Mesh}
   */
  rebuildMeshFromData(meshVertices, container) {
    if (!meshVertices || !meshVertices.vertices) {
      return null;
    }

    const geometry = new PIXI.Geometry()
      .addAttribute('aVertexPosition', meshVertices.vertices, 2)
      .addAttribute('aTextureCoord', meshVertices.uvs, 2)
      .addIndex(meshVertices.indices);

    const shader = PIXI.Shader.from(
      `
      precision mediump float;
      attribute vec2 aVertexPosition;
      attribute vec2 aTextureCoord;
      uniform mat3 projectionMatrix;
      uniform mat3 translationMatrix;
      varying vec2 vTextureCoord;
      
      void main() {
        vTextureCoord = aTextureCoord;
        gl_Position = vec4((projectionMatrix * translationMatrix * vec3(aVertexPosition, 1.0)).xy, 0.0, 1.0);
      }
      `,
      `
      precision mediump float;
      varying vec2 vTextureCoord;
      uniform vec4 uColor;
      
      void main() {
        gl_FragColor = uColor;
      }
      `,
      {
        uColor: this.hexToRGBA(meshVertices.color, meshVertices.alpha)
      }
    );

    const mesh = new PIXI.Mesh({ geometry, shader });
    
    if (container) {
      container.addChild(mesh);
    }

    return mesh;
  }

  /**
   * パスデータからMesh再構築 (Undo/Redo用)
   * Phase 2: meshVertices対応版
   */
  rebuildPathGraphics(pathData, container) {
    if (!pathData) {
      return null;
    }

    // meshVerticesがある場合はMesh再構築
    if (pathData.meshVertices) {
      return this.rebuildMeshFromData(pathData.meshVertices, container);
    }

    // フォールバック: 古い形式 or perfect-freehand不在
    if (pathData.points && pathData.points.length > 0) {
      const strokeOptions = {
        size: pathData.size || 8,
        color: pathData.color || 0x000000,
        alpha: pathData.opacity !== undefined ? pathData.opacity : 1.0,
        thinning: pathData.strokeOptions?.thinning || 0,
        smoothing: pathData.strokeOptions?.smoothing || 0.5,
        streamline: pathData.strokeOptions?.streamline || 0.5
      };

      return this.renderStrokeWithCircles(pathData.points, strokeOptions, container);
    }

    return null;
  }

  /**
   * Pool管理: Graphics
   */
  getGraphicsFromPool() {
    if (this.graphicsPool.length > 0) {
      const g = this.graphicsPool.pop();
      g.clear();
      return g;
    }
    const g = new PIXI.Graphics();
    if (g.antialias !== undefined) g.antialias = true;
    return g;
  }

  returnGraphicsToPool(graphics) {
    if (!graphics) return;
    if (this.graphicsPool.length < this.maxPoolSize) {
      graphics.clear();
      this.graphicsPool.push(graphics);
    } else {
      graphics.destroy({ children: true });
    }
  }

  /**
   * Pool管理: Mesh
   */
  getMeshFromPool() {
    if (this.meshPool.length > 0) {
      return this.meshPool.pop();
    }
    return null;
  }

  returnMeshToPool(mesh) {
    if (!mesh) return;
    if (this.meshPool.length < this.maxPoolSize) {
      mesh.geometry?.destroy();
      this.meshPool.push(mesh);
    } else {
      mesh.destroy({ children: true });
    }
  }

  clearPool() {
    for (const g of this.graphicsPool) {
      g.destroy({ children: true });
    }
    for (const m of this.meshPool) {
      m.destroy({ children: true });
    }
    this.graphicsPool = [];
    this.meshPool = [];
  }

  getDebugInfo() {
    return {
      graphicsPoolSize: this.graphicsPool.length,
      meshPoolSize: this.meshPool.length,
      maxPoolSize: this.maxPoolSize,
      devicePixelRatio: window.devicePixelRatio || 1,
      rendererResolution: this.renderer?.resolution || null,
      minPhysicalWidth: this.getMinPhysicalWidth(),
      perfectFreehandAvailable: typeof getStroke !== 'undefined'
    };
  }
}

// グローバル登録
if (typeof window.TegakiDrawing === 'undefined') {
  window.TegakiDrawing = {};
}
window.TegakiDrawing.StrokeRenderer = StrokeRenderer;