/**
 * ================================================================================
 * brush-core.js - WebGL2完全対応版 (Phase 6)
 * ================================================================================
 * 
 * 📁 親ファイル依存:
 *   - stroke-recorder.js (座標記録)
 *   - gl-stroke-processor.js (VertexBuffer/EdgeBuffer)
 *   - gl-msdf-pipeline.js (MSDF生成)
 *   - gl-texture-bridge.js (Sprite変換)
 *   - gl-mask-layer.js (消しゴムマスク処理) ✅ Phase 6追加
 *   - layer-system.js (レイヤー管理)
 *   - history.js (履歴管理)
 *   - system/event-bus.js (EventBus)
 * 
 * 📄 子ファイル依存:
 *   - drawing-engine.js (startStroke/updateStroke呼び出し元)
 *   - ui/quick-access-popup.js (設定変更イベント発火元)
 * 
 * 【Phase 6更新内容】
 * ✅ glMaskLayer参照追加
 * ✅ _applyEraserMask()をGLMaskLayer使用に完全改修
 * ✅ GPU処理による高速・高精度な消しゴム実装
 * 
 * 【機能】
 * ✅ PerfectFreehand + MSDF ポリゴンペン
 * ✅ リアルタイムプレビュー（フリッカーなし）
 * ✅ 筆圧完全反映
 * ✅ GPU消しゴムマスク処理（Phase 6）
 * 
 * ================================================================================
 */

(function() {
  'use strict';

  class BrushCore {
    constructor() {
      this.strokeRecorder = null;
      this.glStrokeProcessor = null;
      this.glMSDFPipeline = null;
      this.textureBridge = null;
      this.glMaskLayer = null; // Phase 6追加
      this.layerManager = null;
      this.eventBus = null;
      
      this.isDrawing = false;
      this.currentStroke = null;
      this.previewSprite = null;
      this.previewContainer = null;
      
      const config = window.TEGAKI_CONFIG;
      this.currentSettings = {
        mode: 'pen',
        color: config?.brush?.defaultColor || '#800000',
        size: config?.brush?.penSize || 10,
        opacity: config?.brush?.opacity || 1.0
      };
      
      this.initialized = false;
      this.msdfAvailable = false;
      this.maskAvailable = false; // Phase 6追加
      
      this.lastPreviewTime = 0;
      this.previewThrottle = 16;
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

      // WebGL2参照取得
      this.glStrokeProcessor = window.GLStrokeProcessor;
      this.glMSDFPipeline = window.GLMSDFPipeline;
      this.textureBridge = window.GLTextureBridge || window.WebGPUTextureBridge;
      this.glMaskLayer = window.GLMaskLayer; // Phase 6追加

      this.msdfAvailable = !!(
        this.glStrokeProcessor &&
        this.glMSDFPipeline &&
        this.textureBridge
      );

      this.maskAvailable = !!(this.glMaskLayer && this.glMaskLayer.initialized); // Phase 6追加

      if (!this.msdfAvailable) {
        console.warn('[BrushCore] WebGL2 MSDF Pipeline not fully available');
        console.warn('   GLStrokeProcessor:', !!this.glStrokeProcessor);
        console.warn('   GLMSDFPipeline:', !!this.glMSDFPipeline);
        console.warn('   GLTextureBridge:', !!this.textureBridge);
        return;
      }

      if (!this.maskAvailable) {
        console.warn('[BrushCore] GLMaskLayer not available (Eraser limited)');
      }

      this._setupEventListeners();
      this.initialized = true;

      console.log('[BrushCore] ✅ Initialized with WebGL2 Pipeline (Phase 6)');
      console.log('   ✅ Mask Layer:', this.maskAvailable ? 'Available' : 'Unavailable');
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
      
      this._ensurePreviewContainer(activeLayer);
    }

    /**
     * 座標記録のみ（プレビューはrenderPreview()で実行）
     */
    async updateStroke(localX, localY, pressure = 0.5) {
      if (!this.initialized || !this.isDrawing) return;
      this.strokeRecorder.addPoint(localX, localY, pressure);
    }

    /**
     * リアルタイムプレビュー表示
     */
    async renderPreview() {
      if (!this.initialized || !this.isDrawing || this.isPreviewUpdating) return;
      
      const now = Date.now();
      if (now - this.lastPreviewTime < this.previewThrottle) return;
      this.lastPreviewTime = now;

      const points = this.strokeRecorder.getRawPoints();
      if (!points || points.length < 2) return;

      const activeLayer = this.layerManager.getActiveLayer();
      if (!activeLayer) return;
      
      this._ensurePreviewContainer(activeLayer);
      await this._updatePreview(points);
    }

    /**
     * プレビュー更新処理
     * @private
     */
    async _updatePreview(points) {
      if (!this.previewContainer || this.previewContainer.destroyed) {
        console.warn('[BrushCore] Preview container not available');
        return;
      }

      this.isPreviewUpdating = true;

      // 既存プレビューSprite削除
      if (this.previewSprite && !this.previewSprite.destroyed) {
        this.previewContainer.removeChild(this.previewSprite);
        this.previewSprite.destroy({ children: true });
        this.previewSprite = null;
      }

      try {
        const vertexResult = this.glStrokeProcessor.createPolygonVertexBuffer(
          points,
          this.currentSettings.size
        );
        if (!vertexResult?.buffer) return;

        const edgeResult = this.glStrokeProcessor.createEdgeBuffer(
          points,
          this.currentSettings.size
        );
        if (!edgeResult?.buffer) return;

        const uploadVertex = this.glStrokeProcessor.uploadToGPU(vertexResult.buffer, 'vertex', 7 * 4);
        const uploadEdge = this.glStrokeProcessor.uploadToGPU(edgeResult.buffer, 'storage', 8 * 4);

        const bounds = this.glStrokeProcessor.calculateBounds(points);
        const width = Math.ceil(bounds.maxX - bounds.minX);
        const height = Math.ceil(bounds.maxY - bounds.minY);

        if (width <= 0 || height <= 0) return;

        const previewSettings = {
          mode: this.currentSettings.mode,
          color: this.currentSettings.mode === 'eraser' ? '#ff0000' : this.currentSettings.color,
          opacity: this.currentSettings.mode === 'eraser' ? 0.3 : this.currentSettings.opacity * 0.7,
          size: this.currentSettings.size
        };

        const msdfResult = await this.glMSDFPipeline.generateMSDF(
          uploadEdge.glBuffer,
          bounds,
          null,
          previewSettings,
          uploadVertex.glBuffer,
          vertexResult.vertexCount,
          edgeResult.edgeCount
        );

        if (!msdfResult || !msdfResult.texture) return;

        const sprite = await this.textureBridge.createSpriteFromGLTexture(
          msdfResult.texture,
          msdfResult.width,
          msdfResult.height
        );

        if (!sprite || !this.previewContainer || this.previewContainer.destroyed) {
          sprite?.destroy({ children: true });
          return;
        }

        sprite.x = bounds.minX;
        sprite.y = bounds.minY;
        sprite.alpha = previewSettings.opacity;

        this.previewContainer.addChild(sprite);
        this.previewSprite = sprite;

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

        const vertexResult = this.glStrokeProcessor.createPolygonVertexBuffer(
          points,
          this.currentSettings.size
        );
        if (!vertexResult?.buffer) {
          throw new Error('VertexBuffer作成失敗');
        }

        const edgeResult = this.glStrokeProcessor.createEdgeBuffer(
          points,
          this.currentSettings.size
        );
        if (!edgeResult?.buffer) {
          throw new Error('EdgeBuffer作成失敗');
        }

        const uploadVertex = this.glStrokeProcessor.uploadToGPU(vertexResult.buffer, 'vertex', 7 * 4);
        const uploadEdge = this.glStrokeProcessor.uploadToGPU(edgeResult.buffer, 'storage', 8 * 4);

        const bounds = this.glStrokeProcessor.calculateBounds(points);
        const width = Math.ceil(bounds.maxX - bounds.minX);
        const height = Math.ceil(bounds.maxY - bounds.minY);

        if (width <= 0 || height <= 0) return;

        const brushSettings = {
          mode: this.currentSettings.mode,
          color: this.currentSettings.color,
          opacity: this.currentSettings.opacity,
          size: this.currentSettings.size
        };

        const finalTexture = await this.glMSDFPipeline.generateMSDF(
          uploadEdge.glBuffer,
          bounds,
          null,
          brushSettings,
          uploadVertex.glBuffer,
          vertexResult.vertexCount,
          edgeResult.edgeCount
        );

        if (!finalTexture) {
          throw new Error('MSDF生成失敗');
        }

        // 消しゴムモード: GPU マスク処理（Phase 6）
        if (this.currentSettings.mode === 'eraser') {
          await this._applyEraserMask(activeLayer, points, bounds);
          this._emitStrokeEvents(activeLayer, null);
          return;
        }

        // ペンモード: Sprite生成
        const sprite = await this.textureBridge.createSpriteFromGLTexture(
          finalTexture.texture,
          finalTexture.width,
          finalTexture.height
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

      } catch (error) {
        console.error('[BrushCore] MSDF描画失敗:', error);
      }
    }

    /**
     * 消しゴムマスク処理（Phase 6 - GPU実装）
     * @private
     */
    async _applyEraserMask(activeLayer, points, bounds) {
      const container = this._getLayerContainer(activeLayer);
      if (!container?.children) return;

      // GLMaskLayer使用可能チェック
      if (!this.maskAvailable || !this.glMaskLayer) {
        console.warn('[BrushCore] GLMaskLayer not available, using fallback eraser');
        await this._applyEraserMaskFallback(activeLayer, bounds);
        return;
      }

      try {
        // マスククリア
        this.glMaskLayer.clearMask();

        // ストロークマスク生成
        this.glMaskLayer.renderStrokeMask(points, this.currentSettings.size);

        // 各Spriteに対してマスク適用判定
        for (const child of container.children) {
          if (!(child instanceof PIXI.Sprite)) continue;
          if (!child.texture?.baseTexture?.resource?.source) continue;

          const spriteBounds = {
            minX: child.x,
            minY: child.y,
            maxX: child.x + child.width,
            maxY: child.y + child.height
          };

          // Bounds交差判定
          const intersects = this._boundsIntersect(spriteBounds, bounds);
          if (!intersects) continue;

          // Sprite texture取得
          const gl = window.WebGL2DrawingLayer.getGL();
          if (!gl) continue;

          // Canvas→WebGLTexture変換
          const sourceCanvas = child.texture.baseTexture.resource.source;
          const sourceTexture = this._canvasToGLTexture(sourceCanvas, gl);
          if (!sourceTexture) continue;

          // Mask適用
          const outputFBO = window.WebGL2DrawingLayer.createFBO(
            sourceCanvas.width,
            sourceCanvas.height,
            { float: false }
          );

          if (!outputFBO) {
            gl.deleteTexture(sourceTexture);
            continue;
          }

          const applySuccess = this.glMaskLayer.applyMask(sourceTexture, outputFBO);

          if (applySuccess) {
            // 新しいSprite生成
            const newSprite = await this.textureBridge.createSpriteFromGLTexture(
              outputFBO.texture,
              outputFBO.width,
              outputFBO.height
            );

            if (newSprite) {
              newSprite.x = child.x;
              newSprite.y = child.y;
              newSprite.alpha = child.alpha;
              newSprite.visible = child.visible;

              // 既存Sprite置換
              const childIndex = container.getChildIndex(child);
              container.removeChild(child);
              container.addChildAt(newSprite, childIndex);
              child.destroy({ children: true });

              // pathData更新
              if (activeLayer.paths) {
                const pathData = activeLayer.paths.find(p => p.sprite === child);
                if (pathData) {
                  pathData.sprite = newSprite;
                }
              }
            }
          }

          // Cleanup
          gl.deleteTexture(sourceTexture);
          window.WebGL2DrawingLayer.deleteFBO(outputFBO);
        }

      } catch (error) {
        console.error('[BrushCore] GPU eraser mask failed:', error);
        await this._applyEraserMaskFallback(activeLayer, bounds);
      }
    }

    /**
     * Canvas→WebGLTexture変換ヘルパー
     * @private
     */
    _canvasToGLTexture(canvas, gl) {
      const texture = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, canvas);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.bindTexture(gl.TEXTURE_2D, null);
      return texture;
    }

    /**
     * Bounds交差判定
     * @private
     */
    _boundsIntersect(a, b) {
      return !(a.maxX < b.minX || a.minX > b.maxX || a.maxY < b.minY || a.minY > b.maxY);
    }

    /**
     * Fallback消しゴム処理（GLMaskLayer不使用時）
     * @private
     */
    async _applyEraserMaskFallback(activeLayer, bounds) {
      const container = this._getLayerContainer(activeLayer);
      if (!container?.children) return;

      const eraserRadius = this.currentSettings.size / 2;
      const expandedBounds = {
        minX: bounds.minX - eraserRadius,
        minY: bounds.minY - eraserRadius,
        maxX: bounds.maxX + eraserRadius,
        maxY: bounds.maxY + eraserRadius
      };

      for (const child of container.children) {
        if (!(child instanceof PIXI.Sprite)) continue;

        const spriteBounds = {
          minX: child.x,
          minY: child.y,
          maxX: child.x + child.width,
          maxY: child.y + child.height
        };

        const intersectArea = this._calculateIntersectArea(spriteBounds, expandedBounds);
        
        if (intersectArea > 0) {
          const spriteArea = (spriteBounds.maxX - spriteBounds.minX) * 
                            (spriteBounds.maxY - spriteBounds.minY);
          const intersectRatio = Math.min(1.0, intersectArea / spriteArea);
          child.alpha = Math.max(0, child.alpha - (0.7 * intersectRatio));
          
          if (child.alpha <= 0.01) {
            child.visible = false;
            child.destroy({ children: true });
          }
        }
      }
    }

    /**
     * 交差面積計算
     * @private
     */
    _calculateIntersectArea(a, b) {
      const intersectMinX = Math.max(a.minX, b.minX);
      const intersectMinY = Math.max(a.minY, b.minY);
      const intersectMaxX = Math.min(a.maxX, b.maxX);
      const intersectMaxY = Math.min(a.maxY, b.maxY);

      if (intersectMinX >= intersectMaxX || intersectMinY >= intersectMaxY) {
        return 0;
      }

      return (intersectMaxX - intersectMinX) * (intersectMaxY - intersectMinY);
    }

    /**
     * プレビューコンテナ準備
     * @private
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
     * プレビュークリーンアップ
     * @private
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

  console.log('✅ brush-core.js WebGL2完全対応版 (Phase 6) loaded');
  console.log('   ✅ WebGL2 Pipeline統合完了');
  console.log('   ✅ GLStrokeProcessor / GLMSDFPipeline / GLTextureBridge / GLMaskLayer対応');

})();