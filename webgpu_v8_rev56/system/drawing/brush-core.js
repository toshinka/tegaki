/**
 * ================================================================================
 * brush-core.js - Phase D-3完全修正版: GPU初期化確認強化
 * ================================================================================
 * 
 * 📁 親ファイル依存:
 *   - system/drawing/stroke-recorder.js (StrokeRecorder)
 *   - system/drawing/webgpu/gpu-stroke-processor.js (GPUStrokeProcessor)
 *   - system/drawing/webgpu/msdf-pipeline-manager.js (MSDFPipelineManager)
 *   - system/drawing/webgpu/webgpu-texture-bridge.js (WebGPUTextureBridge)
 *   - system/layer-system.js (LayerSystem)
 *   - system/event-bus.js (TegakiEventBus)
 *   - system/history.js (History)
 * 
 * 📄 子ファイル使用先:
 *   - core-engine.js (renderLoop内でrenderPreview呼び出し)
 *   - system/drawing/drawing-engine.js (startStroke/updateStroke/finalizeStroke)
 * 
 * 【Phase D-3完全修正内容】
 * 🔧 initialized フラグの再確認（プロパティ存在チェック追加）
 * 🔧 msdfAvailable判定の厳密化
 * 🔧 初期化失敗時の詳細ログ出力
 * 
 * 【責務】
 * - ストローク管理（開始/更新/確定）
 * - MSDF Pipeline統合
 * - プレビュー表示制御
 * - ペン/消しゴムモード切替
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
      if (this.initialized) {
        console.log('[BrushCore] Already initialized');
        return;
      }

      console.log('[BrushCore] Starting initialization...');

      this.strokeRecorder = window.strokeRecorder || window.StrokeRecorder;
      this.layerManager = window.layerManager || window.layerSystem;
      this.eventBus = window.TegakiEventBus || window.eventBus;

      if (!this.strokeRecorder) {
        throw new Error('[BrushCore] strokeRecorder not found');
      }
      if (!this.layerManager) {
        throw new Error('[BrushCore] layerManager not found');
      }

      console.log('[BrushCore] Basic dependencies OK');

      // 🔧 GPU依存の確認（プロパティ存在チェック追加）
      this.gpuStrokeProcessor = window.GPUStrokeProcessor;
      this.msdfPipelineManager = window.MSDFPipelineManager;
      this.textureBridge = window.WebGPUTextureBridge;

      console.log('[BrushCore] GPU Components:', {
        gpuStrokeProcessor: !!this.gpuStrokeProcessor,
        msdfPipelineManager: !!this.msdfPipelineManager,
        textureBridge: !!this.textureBridge
      });

      // 🔧 initialized プロパティの存在確認
      const hasInitializedProps = !!(
        this.gpuStrokeProcessor &&
        typeof this.gpuStrokeProcessor.initialized !== 'undefined' &&
        this.msdfPipelineManager &&
        typeof this.msdfPipelineManager.initialized !== 'undefined' &&
        this.textureBridge &&
        typeof this.textureBridge.initialized !== 'undefined'
      );

      if (!hasInitializedProps) {
        console.warn('[BrushCore] GPU components missing initialized property, retrying...');
        
        await new Promise(resolve => setTimeout(resolve, 100));
        
        this.gpuStrokeProcessor = window.GPUStrokeProcessor;
        this.msdfPipelineManager = window.MSDFPipelineManager;
        this.textureBridge = window.WebGPUTextureBridge;
      }

      // 🔧 msdfAvailable判定の厳密化
      this.msdfAvailable = !!(
        this.gpuStrokeProcessor?.initialized === true &&
        this.msdfPipelineManager?.initialized === true &&
        this.textureBridge?.initialized === true
      );

      console.log('[BrushCore] GPU Initialization Status:', {
        gpuStrokeProcessor: this.gpuStrokeProcessor?.initialized,
        msdfPipelineManager: this.msdfPipelineManager?.initialized,
        textureBridge: this.textureBridge?.initialized,
        msdfAvailable: this.msdfAvailable
      });

      if (!this.msdfAvailable) {
        console.error('[BrushCore] MSDF Pipeline not available after initialization');
        console.error('[BrushCore] Detailed status:', {
          gpuProcessor: {
            exists: !!this.gpuStrokeProcessor,
            initialized: this.gpuStrokeProcessor?.initialized,
            type: typeof this.gpuStrokeProcessor
          },
          msdfManager: {
            exists: !!this.msdfPipelineManager,
            initialized: this.msdfPipelineManager?.initialized,
            type: typeof this.msdfPipelineManager
          },
          textureBridge: {
            exists: !!this.textureBridge,
            initialized: this.textureBridge?.initialized,
            type: typeof this.textureBridge
          }
        });
      }

      this._setupEventListeners();
      this.initialized = true;
      this.isPreviewUpdating = false;
      
      console.log('✅ [BrushCore] Initialized, MSDF Available:', this.msdfAvailable);
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

      console.log('[BrushCore] startStroke called:', { localX, localY, pressure, msdfAvailable: this.msdfAvailable });

      const activeLayer = this.layerManager.getActiveLayer();
      if (!activeLayer) {
        console.error('[BrushCore] No active layer');
        return;
      }

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
      
      this.isDrawing = true;
      this.currentStroke = {
        layerId: layerId,
        startTime: Date.now()
      };
      
      this._ensurePreviewContainer(activeLayer);
      
      console.log('[BrushCore] Stroke started');
    }

    async updateStroke(localX, localY, pressure = 0.5) {
      if (!this.initialized || !this.isDrawing) return;
      
      this.strokeRecorder.addPoint(localX, localY, pressure);
      
      const historyManager = window.History;
      if (historyManager?.addPoint) {
        historyManager.addPoint(localX, localY, pressure);
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
        if (!this.msdfAvailable) {
          console.warn('[BrushCore] MSDF not available, skipping preview');
          return;
        }

        const vertexResult = this.gpuStrokeProcessor.createPolygonVertexBuffer(
          points,
          this.currentSettings.size
        );
        if (!vertexResult?.buffer) {
          console.warn('[BrushCore] VertexBuffer creation failed');
          return;
        }

        const edgeResult = this.gpuStrokeProcessor.createEdgeBuffer(
          points,
          this.currentSettings.size
        );
        if (!edgeResult?.buffer) {
          console.warn('[BrushCore] EdgeBuffer creation failed');
          return;
        }

        const uploadVertex = this.gpuStrokeProcessor.uploadToGPU(vertexResult.buffer, 'vertex', 7 * 4);
        const uploadEdge = this.gpuStrokeProcessor.uploadToGPU(edgeResult.buffer, 'storage', 8 * 4);

        const bounds = this.gpuStrokeProcessor.calculateBounds(points);

        const isEraser = this.currentSettings.mode === 'eraser';
        const previewSettings = {
          mode: this.currentSettings.mode,
          color: isEraser ? '#000000' : this.currentSettings.color,
          opacity: isEraser ? 0.5 : this.currentSettings.opacity * 0.7,
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
          console.warn('[BrushCore] MSDF generation failed');
          uploadEdge.gpuBuffer?.destroy();
          uploadVertex.gpuBuffer?.destroy();
          return;
        }

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
        console.error('[BrushCore] Preview error:', error);
        if (error.message && (error.message.includes('Device') || error.message.includes('CRITICAL'))) {
          this.cancelStroke();
        }
      } finally {
        this.isPreviewUpdating = false;
      }
    }

    async finalizeStroke() {
      if (!this.initialized || !this.isDrawing) return;

      console.log('[BrushCore] finalizeStroke called');

      const activeLayer = this.layerManager.getActiveLayer();
      
      if (!activeLayer) {
        console.error('[BrushCore] No active layer at finalize');
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
      
      console.log('[BrushCore] Points count:', points?.length);
      
      if (!points || points.length < 2) {
        console.warn('[BrushCore] Stroke too short, aborting');
        this.strokeRecorder.endStroke();
        this.isDrawing = false;
        
        const historyManager = window.History;
        if (historyManager?.endAction) {
          historyManager.endAction();
        }
        return;
      }

      if (this.msdfAvailable) {
        console.log('[BrushCore] Finalizing with MSDF');
        await this._finalizeMSDFStroke(points, activeLayer);
      } else {
        console.error('[BrushCore] MSDF not available, cannot finalize stroke');
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

        const isEraser = this.currentSettings.mode === 'eraser';
        
        const brushSettings = {
          mode: this.currentSettings.mode,
          color: isEraser ? '#000000' : this.currentSettings.color,
          opacity: isEraser ? 1.0 : this.currentSettings.opacity,
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
        
        if (isEraser) {
          sprite.blendMode = 'erase';
          sprite.alpha = 1.0;
        } else {
          sprite.blendMode = 'normal';
          sprite.alpha = this.currentSettings.opacity;
        }

        container.addChild(sprite);

        const pathData = {
          id: `path_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          type: isEraser ? 'stroke_erase' : 'stroke_msdf',
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

        console.log('[BrushCore] Stroke finalized successfully');

      } catch (error) {
        console.error('[BrushCore] Finalize error:', error);
        if (error.message && (error.message.includes('Device') || error.message.includes('CRITICAL'))) {
          this.cancelStroke();
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
      if (layer && Array.isArray(layer.children)) {
        return layer;
      }
      if (layer.drawingContainer) return layer.drawingContainer;
      if (layer.container) return layer.container;
      if (layer.sprite) return layer.sprite;
      return null;
    }

    _registerHistory(activeLayer, pathData, container) {
      const historyManager = window.History;
      if (!historyManager?.push) return;

      const layerId = this._getLayerId(activeLayer);
      if (!layerId) {
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

  console.log('✅ brush-core.js Phase D-3完全修正版 loaded');

})();