/**
 * ================================================================================
 * brush-core.js - Phase 8: GPUTexture Size Matching Complete
 * ================================================================================
 * 
 * 📁 親ファイル依存:
 *   - system/drawing/stroke-recorder.js
 *   - system/drawing/webgpu/gpu-stroke-processor.js
 *   - system/drawing/webgpu/msdf-pipeline-manager.js
 *   - system/drawing/webgpu/webgpu-texture-bridge.js
 *   - system/drawing/webgpu/webgpu-mask-layer.js
 *   - system/layer-system.js
 *   - system/event-bus.js
 *   - system/history.js
 * 
 * 📄 子ファイル使用先:
 *   - core-engine.js (renderPreview呼び出し元)
 *   - system/drawing/drawing-engine.js
 * 
 * 【Phase 8改修内容】
 * 🔥 boundsサイズ計算廃止 → GPUTexture.width/height直接使用
 * 🔥 CopyTextureToBuffer問題完全根絶
 * ✅ Phase 7機能完全継承（Device Lost対策・履歴統合）
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
      
      this.isPreviewUpdating = false;
      
      const config = window.TEGAKI_CONFIG;
      this.currentSettings = {
        mode: 'pen',
        color: config?.brush?.defaultColor || '#800000',
        size: config?.brush?.penSize || 10,
        opacity: config?.brush?.opacity || 1.0
      };
      
      this.initialized = false;
      this.msdfAvailable = false;
    }

    _getLayerId(layer) {
      if (!layer) return null;
      return layer.layerData?.id || layer.id || layer.label || null;
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
        console.warn('[BrushCore] MSDF Pipeline not fully available');
      }

      this._setupEventListeners();
      this.initialized = true;
      this.isPreviewUpdating = false;
    }

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

      const layerId = this._getLayerId(activeLayer);
      if (!layerId) {
        console.error('[BrushCore] Active layer has no valid ID');
        return;
      }

      const historyManager = window.History;
      if (historyManager?.beginAction) {
        const actionType = this.currentSettings.mode === 'eraser' ? 'erase' : 'stroke';
        historyManager.beginAction(actionType, {
          layerId: layerId,
          brushSize: this.currentSettings.size,
          color: this.currentSettings.color
        });
      }

      this.strokeRecorder.startStroke(localX, localY, pressure);
      
      if (this.gpuStrokeProcessor?.resetStream) {
        this.gpuStrokeProcessor.resetStream();
      }

      if (this.currentSettings.mode === 'eraser' && this.webgpuMaskLayer?.startErase) {
        this.webgpuMaskLayer.startErase();
      }
      
      this.isDrawing = true;
      this.currentStroke = {
        layerId: layerId,
        startTime: Date.now()
      };
      
      this._ensurePreviewContainer(activeLayer);
    }

    async updateStroke(localX, localY, pressure = 0.5) {
      if (!this.initialized || !this.isDrawing) return;
      
      this.strokeRecorder.addPoint(localX, localY, pressure);
      
      const historyManager = window.History;
      if (historyManager?.addPoint) {
        historyManager.addPoint(localX, localY, pressure);
      }

      if (this.currentSettings.mode === 'pen') {
        if (this.gpuStrokeProcessor?.appendPointToStream) {
          this.gpuStrokeProcessor.appendPointToStream(
            localX,
            localY,
            pressure,
            this.currentSettings.size
          );
        }
      }

      if (this.currentSettings.mode === 'eraser') {
        if (this.webgpuMaskLayer?.eraseAppendPoint) {
          this.webgpuMaskLayer.eraseAppendPoint(localX, localY, pressure);
        }
      }
    }

    async renderPreview() {
      if (!this.initialized || !this.isDrawing) return;
      if (this.isPreviewUpdating) return;

      const points = this.strokeRecorder.getRawPoints();
      if (!points || points.length < 2) return;

      const activeLayer = this.layerManager.getActiveLayer();
      if (!activeLayer) return;
      
      this._ensurePreviewContainer(activeLayer);
      
      await this._updatePreview(points);
    }

    async _updatePreview(points) {
      if (!this.previewContainer || this.previewContainer.destroyed) {
        return;
      }

      this.isPreviewUpdating = true;

      if (this.previewSprite && !this.previewSprite.destroyed) {
        this.previewContainer.removeChild(this.previewSprite);
        this.previewSprite.destroy({ children: true });
        this.previewSprite = null;
      }

      try {
        const vertexResult = this.gpuStrokeProcessor.createPolygonVertexBuffer(
          points,
          this.currentSettings.size
        );
        if (!vertexResult?.buffer) {
          return;
        }

        const edgeResult = this.gpuStrokeProcessor.createEdgeBuffer(
          points,
          this.currentSettings.size
        );
        if (!edgeResult?.buffer) {
          return;
        }

        const uploadVertex = this.gpuStrokeProcessor.uploadToGPU(vertexResult.buffer, 'vertex', 7 * 4);
        const uploadEdge = this.gpuStrokeProcessor.uploadToGPU(edgeResult.buffer, 'storage', 8 * 4);

        const bounds = this.gpuStrokeProcessor.calculateBounds(points);

        const previewSettings = {
          mode: this.currentSettings.mode,
          color: this.currentSettings.mode === 'eraser' ? '#ff0000' : this.currentSettings.color,
          opacity: this.currentSettings.mode === 'eraser' ? 0.3 : this.currentSettings.opacity * 0.7,
          size: this.currentSettings.size
        };

        const previewTexture = await this.msdfPipelineManager.generateMSDF(
          uploadEdge.gpuBuffer,
          bounds,
          null,
          previewSettings,
          uploadVertex.gpuBuffer,
          vertexResult.vertexCount,
          edgeResult.edgeCount
        );

        if (!previewTexture) {
          uploadEdge.gpuBuffer?.destroy();
          uploadVertex.gpuBuffer?.destroy();
          return;
        }

        // 🔥 Phase 8: GPUTexture実サイズ使用
        const actualWidth = previewTexture.width;
        const actualHeight = previewTexture.height;

        const sprite = await this.textureBridge.createSpriteFromGPUTexture(
          previewTexture,
          actualWidth,
          actualHeight
        );

        if (!sprite) {
          uploadEdge.gpuBuffer?.destroy();
          uploadVertex.gpuBuffer?.destroy();
          previewTexture?.destroy();
          return;
        }

        if (!this.previewContainer || this.previewContainer.destroyed) {
          sprite.destroy({ children: true });
          uploadEdge.gpuBuffer?.destroy();
          uploadVertex.gpuBuffer?.destroy();
          previewTexture?.destroy();
          return;
        }

        sprite.x = bounds.minX;
        sprite.y = bounds.minY;
        sprite.alpha = previewSettings.opacity;

        this.previewContainer.addChild(sprite);
        this.previewSprite = sprite;

        uploadEdge.gpuBuffer?.destroy();
        uploadVertex.gpuBuffer?.destroy();
        previewTexture?.destroy();

      } catch (error) {
        if (error.message && (error.message.includes('Device') || error.message.includes('CRITICAL'))) {
          console.error('[BrushCore] GPU Error:', error.message);
          this.cancelStroke();
        } else {
          console.error('[BrushCore] Preview failed:', error);
        }
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
        
        const historyManager = window.History;
        if (historyManager?.endAction) {
          historyManager.endAction();
        }
        return;
      }

      this._cleanupPreview();

      const points = this.strokeRecorder.getRawPoints();
      
      if (!points || points.length < 2) {
        this.strokeRecorder.endStroke();
        this.isDrawing = false;
        
        const historyManager = window.History;
        if (historyManager?.endAction) {
          historyManager.endAction();
        }
        return;
      }

      if (this.currentSettings.mode === 'pen' && this.gpuStrokeProcessor?.finalizeStroke) {
        this.gpuStrokeProcessor.finalizeStroke();
      }

      if (this.currentSettings.mode === 'eraser' && this.webgpuMaskLayer?.finalizeErase) {
        this.webgpuMaskLayer.finalizeErase();
      }

      if (this.msdfAvailable) {
        await this._finalizeMSDFStroke(points, activeLayer);
      }

      this.strokeRecorder.endStroke();
      this.isDrawing = false;
      this.currentStroke = null;

      const historyManager = window.History;
      if (historyManager?.endAction) {
        historyManager.endAction();
      }
    }

    async _finalizeMSDFStroke(points, activeLayer) {
      try {
        const container = this._getLayerContainer(activeLayer);
        if (!container) {
          throw new Error('Container取得失敗');
        }

        const vertexResult = this.gpuStrokeProcessor.createPolygonVertexBuffer(
          points,
          this.currentSettings.size
        );
        if (!vertexResult?.buffer) {
          throw new Error('VertexBuffer作成失敗');
        }

        const edgeResult = this.gpuStrokeProcessor.createEdgeBuffer(
          points,
          this.currentSettings.size
        );
        if (!edgeResult?.buffer) {
          throw new Error('EdgeBuffer作成失敗');
        }

        const uploadVertex = this.gpuStrokeProcessor.uploadToGPU(vertexResult.buffer, 'vertex', 7 * 4);
        const uploadEdge = this.gpuStrokeProcessor.uploadToGPU(edgeResult.buffer, 'storage', 8 * 4);

        const bounds = this.gpuStrokeProcessor.calculateBounds(points);

        const brushSettings = {
          mode: this.currentSettings.mode,
          color: this.currentSettings.color,
          opacity: this.currentSettings.opacity,
          size: this.currentSettings.size
        };

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

        if (this.currentSettings.mode === 'eraser') {
          const layerId = this._getLayerId(activeLayer);
          if (!layerId) {
            console.error('[BrushCore] Cannot register erase - layer has no ID');
            uploadEdge.gpuBuffer?.destroy();
            uploadVertex.gpuBuffer?.destroy();
            finalTexture?.destroy();
            return;
          }

          const beforeMask = activeLayer.maskTexture || null;
          
          await this._applyEraserMask(activeLayer, bounds);
          
          const afterMask = activeLayer.maskTexture || null;
          
          const historyManager = window.History;
          if (historyManager?.pushEraseMask) {
            historyManager.pushEraseMask(
              layerId,
              beforeMask,
              afterMask,
              bounds
            );
          }
          
          uploadEdge.gpuBuffer?.destroy();
          uploadVertex.gpuBuffer?.destroy();
          finalTexture?.destroy();
          
          this._emitStrokeEvents(activeLayer, null);
          return;
        }

        // 🔥 Phase 8: GPUTexture実サイズ使用
        const actualWidth = finalTexture.width;
        const actualHeight = finalTexture.height;

        const sprite = await this.textureBridge.createSpriteFromGPUTexture(
          finalTexture,
          actualWidth,
          actualHeight
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
        if (error.message && (error.message.includes('Device') || error.message.includes('CRITICAL'))) {
          console.error('[BrushCore] GPU Error:', error.message);
          this.cancelStroke();
        } else {
          console.error('[BrushCore] MSDF描画失敗:', error);
        }
      }
    }

    async _applyEraserMask(activeLayer, bounds) {
      if (!this.webgpuMaskLayer || !this.webgpuMaskLayer.isInitialized()) {
        console.warn('[BrushCore] WebGPUMaskLayer not available');
        return;
      }

      const eraserPoints = this.strokeRecorder.getRawPoints();
      if (!eraserPoints || eraserPoints.length < 2) return;

      try {
        const eraseMaskTexture = await this.webgpuMaskLayer.generateEraseMask(
          eraserPoints,
          this.currentSettings.size
        );

        if (!eraseMaskTexture) {
          console.error('[BrushCore] Erase mask generation failed');
          return;
        }

        if (!activeLayer.maskTexture) {
          activeLayer.maskTexture = eraseMaskTexture;
        } else {
          const composedMask = await this.webgpuMaskLayer.composeMasks(
            activeLayer.maskTexture,
            eraseMaskTexture,
            'add'
          );

          if (composedMask) {
            if (activeLayer.maskTexture?.destroy) {
              activeLayer.maskTexture.destroy();
            }
            activeLayer.maskTexture = composedMask;
          }

          if (eraseMaskTexture?.destroy) {
            eraseMaskTexture.destroy();
          }
        }

        const layerId = this._getLayerId(activeLayer);
        if (this.eventBus?.emit && layerId) {
          this.eventBus.emit('layer:mask-updated', {
            layerId: layerId,
            maskTexture: activeLayer.maskTexture,
            immediate: true
          });
        }

      } catch (error) {
        if (error.message && error.message.includes('Device')) {
          console.error('[BrushCore] GPU Device Lost during erase');
        } else {
          console.error('[BrushCore] Erase mask failed:', error);
        }
      }
    }

    _ensurePreviewContainer(activeLayer) {
      const container = this._getLayerContainer(activeLayer);
      if (!container) return;

      if (this.previewContainer && this.previewContainer.destroyed) {
        this.previewContainer = null;
      }

      if (!this.previewContainer) {
        this.previewContainer = new PIXI.Container();
        this.previewContainer.name = 'preview_container';
        container.addChild(this.previewContainer);
      }
    }

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

      const layerId = this._getLayerId(activeLayer);
      if (!layerId) {
        console.warn('[BrushCore] Cannot register history - no ID');
        return;
      }

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
          layerId: layerId,
          pathId: pathData.id
        }
      });
    }

    _emitStrokeEvents(layer, pathData) {
      if (!this.eventBus?.emit) return;

      const layerId = this._getLayerId(layer);
      if (!layerId) return;

      if (pathData) {
        this.eventBus.emit('layer:path-added', {
          layerId: layerId,
          pathId: pathData.id,
          sprite: pathData.sprite
        });
      }

      this.eventBus.emit('layer:transform-updated', {
        layerId: layerId,
        immediate: true
      });

      this.eventBus.emit('layer:panel-update-requested', {
        layerId: layerId
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

      const historyManager = window.History;
      if (historyManager?.endAction) {
        historyManager.endAction();
      }
    }

    destroy() {
      this._cleanupPreview();
      this.initialized = false;
    }
  }

  window.BrushCore = new BrushCore();

  console.log('✅ brush-core.js Phase 8完全版 loaded');
  console.log('   🔥 GPUTexture.width/height直接使用（bounds計算廃止）');

})();