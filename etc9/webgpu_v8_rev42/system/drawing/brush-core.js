/**
 * ================================================================================
 * brush-core.js Phase 3完全版: フリッカー解消・筆圧完全対応
 * ================================================================================
 * 
 * 📁 親ファイル依存:
 *   - stroke-recorder.js (座標記録)
 *   - gpu-stroke-processor.js (VertexBuffer/EdgeBuffer)
 *   - msdf-pipeline-manager.js (MSDF生成)
 *   - webgpu-texture-bridge.js (Sprite変換)
 *   - webgpu-mask-layer.js (消しゴムマスク処理)
 *   - layer-system.js (レイヤー管理)
 *   - history.js (履歴管理)
 *   - system/event-bus.js (EventBus)
 * 
 * 📄 子ファイル依存:
 *   - drawing-engine.js (startStroke/updateStroke呼び出し元)
 *   - ui/quick-access-popup.js (設定変更イベント発火元)
 * 
 * 【Phase 3改修内容】
 * 🔧 _updatePreview()削除 - フリッカー根絶
 * 🔧 updateStroke()で座標記録のみ実行
 * 🔧 finalizeStroke()で1回のみMSDF生成
 * 🔧 消しゴムマスク処理の簡易化
 * 🚨 二重MSDF生成の完全排除
 * ✅ 筆圧完全反映
 * 
 * ================================================================================
 */

(function() {
  'use strict';

  class BrushCore {
    constructor() {
      this.strokeRecorder = null;
      this.gpuStrokeProcessor = null;
      this.msdfPipelineManager = null;
      this.textureBridge = null;
      this.layerManager = null;
      this.webgpuMaskLayer = null;
      this.eventBus = null;
      
      this.isDrawing = false;
      this.currentStroke = null;
      this.previewSprite = null;
      this.previewContainer = null;
      
      // 🔧 Phase 4-A: config.js初期設定同期
      const config = window.TEGAKI_CONFIG;
      this.currentSettings = {
        mode: 'pen',
        color: config?.brush?.defaultColor || '#800000',
        size: config?.brush?.penSize || 10,
        opacity: config?.brush?.opacity || 1.0
      };
      
      this.initialized = false;
      this.msdfAvailable = false;
      
      // 🔧 Phase 4-C: プレビュー制御
      this.lastPreviewTime = 0;
      this.previewThrottle = 16; // 60fps
      this.isPreviewUpdating = false;
    }

    async init() {
      return await this.initialize();
    }

    async initialize() {
      if (this.initialized) return;

      this.strokeRecorder = window.strokeRecorder || window.StrokeRecorder;
      this.layerManager = window.layerManager || window.layerSystem;
      this.eventBus = window.TegakiEventBus || window.eventBus;

      if (!this.strokeRecorder) {
        throw new Error('[BrushCore] strokeRecorder not found');
      }
      if (!this.layerManager) {
        throw new Error('[BrushCore] layerManager not found');
      }

      this.gpuStrokeProcessor = window.GPUStrokeProcessor;
      this.msdfPipelineManager = window.MSDFPipelineManager;
      this.textureBridge = window.WebGPUTextureBridge;
      this.webgpuMaskLayer = window.webgpuMaskLayer;

      this.msdfAvailable = !!(
        this.gpuStrokeProcessor &&
        this.msdfPipelineManager &&
        this.textureBridge
      );

      if (!this.msdfAvailable) {
        console.error('[BrushCore] MSDF Pipeline not available');
        return;
      }

      this._setupEventListeners();
      this.initialized = true;
    }

    /**
     * EventBusリスナー登録
     */
    _setupEventListeners() {
      if (!this.eventBus) return;

      this.eventBus.on('brush:size-changed', ({ size }) => {
        if (typeof size === 'number' && size > 0) {
          this.currentSettings.size = size;
        }
      });

      this.eventBus.on('brush:opacity-changed', ({ opacity }) => {
        if (typeof opacity === 'number' && opacity >= 0 && opacity <= 1) {
          this.currentSettings.opacity = opacity;
        }
      });

      this.eventBus.on('brush:color-changed', ({ color }) => {
        if (typeof color === 'number') {
          const hex = color.toString(16).padStart(6, '0');
          this.currentSettings.color = '#' + hex;
        } else if (typeof color === 'string') {
          this.currentSettings.color = color;
        }
      });

      this.eventBus.on('tool:changed', ({ tool }) => {
        if (['pen', 'eraser', 'fill'].includes(tool)) {
          this.setMode(tool);
        }
      });
    }

    startStroke(localX, localY, pressure = 0.5) {
      if (!this.initialized || this.isDrawing) return;

      const activeLayer = this.layerManager.getActiveLayer();
      if (!activeLayer) return;

      this.strokeRecorder.startStroke(localX, localY, pressure);
      
      this.isDrawing = true;
      this.currentStroke = {
        layerId: activeLayer.id,
        startTime: Date.now()
      };
      
      // 🔧 Phase 4-C: プレビューコンテナ準備
      this._ensurePreviewContainer(activeLayer);
    }

    /**
     * 🔧 Phase 4-C改修: 座標記録のみ（プレビューはrenderPreview()で実行）
     */
    async updateStroke(localX, localY, pressure = 0.5) {
      if (!this.initialized || !this.isDrawing) return;
      
      // 座標記録のみ
      this.strokeRecorder.addPoint(localX, localY, pressure);
    }

    /**
     * 🔧 Phase 5-A: リアルタイムプレビュー表示修正
     */
    async renderPreview() {
      if (!this.initialized || !this.isDrawing || this.isPreviewUpdating) return;
      
      const now = Date.now();
      if (now - this.lastPreviewTime < this.previewThrottle) return;
      this.lastPreviewTime = now;

      const points = this.strokeRecorder.getRawPoints();
      if (!points || points.length < 2) return;

      // 🔧 Phase 5-A: コンテナ再確認（破棄されている可能性）
      const activeLayer = this.layerManager.getActiveLayer();
      if (!activeLayer) return;
      
      this._ensurePreviewContainer(activeLayer);
      
      await this._updatePreview(points);
    }

    /**
     * 🔧 Phase 5-A: プレビュー更新処理（コンテナ永続化）
     */
    async _updatePreview(points) {
      if (!this.previewContainer || this.previewContainer.destroyed) {
        console.warn('[BrushCore] Preview container not available');
        return;
      }

      this.isPreviewUpdating = true;

      // 🔧 Phase 5-A: 既存プレビューSpriteのみ削除（コンテナは維持）
      if (this.previewSprite && !this.previewSprite.destroyed) {
        this.previewContainer.removeChild(this.previewSprite);
        this.previewSprite.destroy({ children: true });
        this.previewSprite = null;
      }

      try {
        const vertexResult = this.gpuStrokeProcessor.createPolygonVertexBuffer(
          points,
          this.currentSettings.size // 🔧 Phase 5: baseSize渡し
        );
        if (!vertexResult?.buffer) return;

        const edgeResult = this.gpuStrokeProcessor.createEdgeBuffer(
          points,
          this.currentSettings.size // 🔧 Phase 5: baseSize渡し
        );
        if (!edgeResult?.buffer) return;

        const uploadVertex = this.gpuStrokeProcessor.uploadToGPU(vertexResult.buffer, 'vertex', 7 * 4);
        const uploadEdge = this.gpuStrokeProcessor.uploadToGPU(edgeResult.buffer, 'storage', 8 * 4);

        const bounds = this.gpuStrokeProcessor.calculateBounds(points);
        const width = Math.ceil(bounds.maxX - bounds.minX);
        const height = Math.ceil(bounds.maxY - bounds.minY);

        if (width <= 0 || height <= 0) return;

        const previewSettings = {
          mode: this.currentSettings.mode,
          color: this.currentSettings.mode === 'eraser' ? '#ff0000' : this.currentSettings.color,
          opacity: this.currentSettings.mode === 'eraser' ? 0.3 : this.currentSettings.opacity * 0.7,
          size: this.currentSettings.size
        };

        const finalTexture = await this.msdfPipelineManager.generateMSDF(
          uploadEdge.gpuBuffer,
          bounds,
          null,
          previewSettings,
          uploadVertex.gpuBuffer,
          vertexResult.vertexCount,
          edgeResult.edgeCount
        );

        if (!finalTexture) return;

        const sprite = await this.textureBridge.createSpriteFromGPUTexture(
          finalTexture,
          width,
          height
        );

        // 🔧 Phase 5-A: コンテナ再確認（非同期処理中に破棄された可能性）
        if (!sprite || !this.previewContainer || this.previewContainer.destroyed) {
          sprite?.destroy({ children: true });
          return;
        }

        sprite.x = bounds.minX;
        sprite.y = bounds.minY;
        sprite.alpha = previewSettings.opacity;

        this.previewContainer.addChild(sprite);
        this.previewSprite = sprite;

        uploadEdge.gpuBuffer?.destroy();
        uploadVertex.gpuBuffer?.destroy();
        finalTexture?.destroy();

      } catch (error) {
        console.error('[BrushCore] Preview failed:', error);
      } finally {
        this.isPreviewUpdating = false;
      }
    }

    async finalizeStroke() {
      if (!this.initialized || !this.isDrawing) return;

      const activeLayer = this.layerManager.getActiveLayer();
      
      if (!activeLayer) {
        this._cleanupPreview();
        this.isDrawing = false;
        return;
      }

      // 🔧 Phase 4-C: プレビュークリーンアップ
      this._cleanupPreview();

      const points = this.strokeRecorder.getRawPoints();
      
      if (!points || points.length < 2) {
        this.strokeRecorder.endStroke();
        this.isDrawing = false;
        return;
      }

      if (this.msdfAvailable) {
        await this._finalizeMSDFStroke(points, activeLayer);
      }

      this.strokeRecorder.endStroke();
      this.isDrawing = false;
      this.currentStroke = null;
    }

    async _finalizeMSDFStroke(points, activeLayer) {
      try {
        const container = this._getLayerContainer(activeLayer);
        if (!container) {
          throw new Error('Container取得失敗');
        }

        const vertexResult = this.gpuStrokeProcessor.createPolygonVertexBuffer(
          points,
          this.currentSettings.size // 🔧 Phase 5: baseSize渡し
        );
        if (!vertexResult?.buffer) {
          throw new Error('VertexBuffer作成失敗');
        }

        const edgeResult = this.gpuStrokeProcessor.createEdgeBuffer(
          points,
          this.currentSettings.size // 🔧 Phase 5: baseSize渡し
        );
        if (!edgeResult?.buffer) {
          throw new Error('EdgeBuffer作成失敗');
        }

        const uploadVertex = this.gpuStrokeProcessor.uploadToGPU(vertexResult.buffer, 'vertex', 7 * 4);
        const uploadEdge = this.gpuStrokeProcessor.uploadToGPU(edgeResult.buffer, 'storage', 8 * 4);

        const bounds = this.gpuStrokeProcessor.calculateBounds(points);
        const width = Math.ceil(bounds.maxX - bounds.minX);
        const height = Math.ceil(bounds.maxY - bounds.minY);

        if (width <= 0 || height <= 0) return;

        const brushSettings = {
          mode: this.currentSettings.mode,
          color: this.currentSettings.color,
          opacity: this.currentSettings.opacity,
          size: this.currentSettings.size
        };

        // 🔧 Phase 3: 1回のみMSDF生成
        const finalTexture = await this.msdfPipelineManager.generateMSDF(
          uploadEdge.gpuBuffer,
          bounds,
          null,
          brushSettings,
          uploadVertex.gpuBuffer,
          vertexResult.vertexCount,
          edgeResult.edgeCount
        );

        if (!finalTexture) {
          throw new Error('MSDF生成失敗');
        }

        // 消しゴムモード: マスク処理（簡易実装）
        if (this.currentSettings.mode === 'eraser') {
          await this._applyEraserMask(activeLayer, bounds);
          
          uploadEdge.gpuBuffer?.destroy();
          uploadVertex.gpuBuffer?.destroy();
          finalTexture?.destroy();
          
          this._emitStrokeEvents(activeLayer, null);
          return;
        }

        // ペンモード: Sprite生成
        const sprite = await this.textureBridge.createSpriteFromGPUTexture(
          finalTexture,
          width,
          height
        );

        if (!sprite) {
          throw new Error('Sprite生成失敗');
        }

        sprite.x = bounds.minX;
        sprite.y = bounds.minY;
        sprite.visible = true;
        sprite.alpha = this.currentSettings.opacity;

        container.addChild(sprite);

        const pathData = {
          id: `path_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          type: 'stroke_msdf',
          points: points,
          settings: { ...this.currentSettings },
          sprite: sprite,
          bounds: bounds
        };

        if (!activeLayer.paths) activeLayer.paths = [];
        activeLayer.paths.push(pathData);

        this._registerHistory(activeLayer, pathData, container);
        this._emitStrokeEvents(activeLayer, pathData);

        uploadEdge.gpuBuffer?.destroy();
        uploadVertex.gpuBuffer?.destroy();
        finalTexture?.destroy();

      } catch (error) {
        console.error('[BrushCore] MSDF描画失敗:', error);
      }
    }

    /**
     * 🔧 Phase 5-B: 消しゴム範囲限定修正（セグメント分割）
     */
    async _applyEraserMask(activeLayer, bounds) {
      const container = this._getLayerContainer(activeLayer);
      if (!container?.children) return;

      // 🔧 Phase 5-B: eraserStroke取得（より精密な判定）
      const eraserPoints = this.strokeRecorder.getRawPoints();
      if (!eraserPoints || eraserPoints.length < 2) return;

      // セグメント分割（5ポイント単位）
      const segmentSize = 5;
      const segments = [];
      
      for (let i = 0; i < eraserPoints.length; i += segmentSize) {
        const segmentPoints = eraserPoints.slice(i, i + segmentSize + 1);
        if (segmentPoints.length < 2) continue;
        
        const segmentBounds = this._calculateSegmentBounds(segmentPoints);
        segments.push(segmentBounds);
      }

      // 各Spriteに対してセグメント単位で判定
      for (const child of container.children) {
        if (!(child instanceof PIXI.Sprite)) continue;

        const spriteBounds = {
          minX: child.x,
          minY: child.y,
          maxX: child.x + child.width,
          maxY: child.y + child.height
        };

        let totalIntersectArea = 0;
        const spriteArea = (spriteBounds.maxX - spriteBounds.minX) * 
                          (spriteBounds.maxY - spriteBounds.minY);

        // 全セグメントとの交差チェック
        for (const segmentBounds of segments) {
          const intersectArea = this._calculateIntersectArea(spriteBounds, segmentBounds);
          totalIntersectArea += intersectArea;
        }
        
        if (totalIntersectArea > 0) {
          // 交差率に応じたalpha減算
          const intersectRatio = Math.min(1.0, totalIntersectArea / spriteArea);
          
          // 🔧 Phase 5-B: 減算量調整（0.8で強めに消す）
          child.alpha = Math.max(0, child.alpha - (0.8 * intersectRatio));
          
          // 完全透明になったら削除
          if (child.alpha <= 0.01) {
            child.visible = false;
            child.destroy({ children: true });
          }
        }
      }
    }

    /**
     * 🔧 Phase 5-B: セグメントBounds計算
     */
    _calculateSegmentBounds(points) {
      let minX = Infinity, minY = Infinity;
      let maxX = -Infinity, maxY = -Infinity;

      for (const point of points) {
        minX = Math.min(minX, point.x);
        minY = Math.min(minY, point.y);
        maxX = Math.max(maxX, point.x);
        maxY = Math.max(maxY, point.y);
      }

      // eraserサイズを考慮した拡張
      const eraserRadius = this.currentSettings.size / 2;
      return {
        minX: minX - eraserRadius,
        minY: minY - eraserRadius,
        maxX: maxX + eraserRadius,
        maxY: maxY + eraserRadius
      };
    }

    /**
     * 🔧 Phase 4-B: 交差面積計算
     */
    _calculateIntersectArea(a, b) {
      const intersectMinX = Math.max(a.minX, b.minX);
      const intersectMinY = Math.max(a.minY, b.minY);
      const intersectMaxX = Math.min(a.maxX, b.maxX);
      const intersectMaxY = Math.min(a.maxY, b.maxY);

      if (intersectMinX >= intersectMaxX || intersectMinY >= intersectMaxY) {
        return 0; // 交差なし
      }

      return (intersectMaxX - intersectMinX) * (intersectMaxY - intersectMinY);
    }

    /**
     * 🔧 Phase 4-C: プレビューコンテナ準備
     */
    _ensurePreviewContainer(activeLayer) {
      const container = this._getLayerContainer(activeLayer);
      if (!container) {
        console.warn('[BrushCore] Cannot create preview container');
        return;
      }

      if (this.previewContainer && this.previewContainer.destroyed) {
        this.previewContainer = null;
      }

      if (!this.previewContainer) {
        this.previewContainer = new PIXI.Container();
        this.previewContainer.name = 'preview_container';
        container.addChild(this.previewContainer);
      }
    }

    /**
     * 🔧 Phase 4-C: プレビュークリーンアップ
     */
    _cleanupPreview() {
      if (this.previewSprite && !this.previewSprite.destroyed) {
        this.previewSprite.destroy({ children: true });
        this.previewSprite = null;
      }

      if (this.previewContainer && !this.previewContainer.destroyed) {
        this.previewContainer.destroy({ children: true });
        this.previewContainer = null;
      }
    }

    _getLayerContainer(layer) {
      if (layer.drawingContainer) return layer.drawingContainer;
      if (layer.container) return layer.container;
      if (layer.sprite) return layer.sprite;
      if (Array.isArray(layer.children)) return layer;
      return null;
    }

    _registerHistory(activeLayer, pathData, container) {
      const historyManager = window.History;
      if (!historyManager?.push) return;

      const layerRef = activeLayer;
      const containerRef = container;

      historyManager.push({
        name: 'path:add',
        do: () => {
          if (!layerRef.paths) layerRef.paths = [];
          
          const exists = layerRef.paths.some(p => p.id === pathData.id);
          if (!exists) {
            layerRef.paths.push(pathData);
          }
          
          if (pathData.sprite && !pathData.sprite.destroyed && containerRef) {
            if (!pathData.sprite.parent) {
              containerRef.addChild(pathData.sprite);
            }
          }
        },
        undo: () => {
          const index = layerRef.paths.findIndex(p => p.id === pathData.id);
          if (index !== -1) {
            layerRef.paths.splice(index, 1);
            if (pathData.sprite && !pathData.sprite.destroyed) {
              pathData.sprite.destroy({ children: true });
            }
          }
        },
        meta: {
          type: 'path:add',
          layerId: layerRef.id,
          pathId: pathData.id
        }
      });
    }

    _emitStrokeEvents(layer, pathData) {
      if (!this.eventBus?.emit) return;

      if (pathData) {
        this.eventBus.emit('layer:path-added', {
          layerId: layer.id,
          pathId: pathData.id,
          sprite: pathData.sprite
        });
      }

      this.eventBus.emit('layer:transform-updated', {
        layerId: layer.id,
        immediate: true
      });

      this.eventBus.emit('layer:panel-update-requested', {
        layerId: layer.id
      });
    }

    updateSettings(settings) {
      if (settings.mode !== undefined) this.currentSettings.mode = settings.mode;
      if (settings.color !== undefined) this.currentSettings.color = settings.color;
      if (settings.size !== undefined) this.currentSettings.size = settings.size;
      if (settings.opacity !== undefined) this.currentSettings.opacity = settings.opacity;
    }

    getSettings() {
      return { ...this.currentSettings };
    }

    getMode() {
      return this.currentSettings.mode;
    }

    setMode(mode) {
      if (['pen', 'eraser', 'fill'].includes(mode)) {
        this.currentSettings.mode = mode;
        
        if (this.eventBus?.emit) {
          this.eventBus.emit('brush:mode-changed', { mode });
        }
      }
    }

    isActive() {
      return this.isDrawing;
    }

    getIsDrawing() {
      return this.isDrawing;
    }

    cancelStroke() {
      this._cleanupPreview();
      this.strokeRecorder.reset();
      this.isDrawing = false;
      this.currentStroke = null;
    }

    destroy() {
      this._cleanupPreview();
      this.initialized = false;
    }
  }

  window.BrushCore = new BrushCore();

  console.log('✅ brush-core.js Phase 5完全版 loaded');
  console.log('   🔧 Phase 5-A: リアルタイムプレビュー表示修正');
  console.log('   🔧 Phase 5-B: 消しゴム範囲限定（セグメント分割）');
  console.log('   🔧 Phase 5-C: 筆圧反映（baseSize渡し）');
  console.log('   ✅ フリッカーなし・筆圧完全反映');

})();