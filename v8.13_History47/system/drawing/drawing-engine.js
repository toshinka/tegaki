/**
 * DrawingEngine v3.0 (Phase 1完全対応版)
 * 🔥 新機能:
 * - Pointer Events API完全対応（tilt, twist）
 * - 傾きベースのブラシサイズ・不透明度調整
 * - 拡張ポインター情報の記録
 */

class DrawingEngine {
  constructor(cameraSystem, layerManager, eventBus, config) {
    this.cameraSystem = cameraSystem;
    this.layerManager = layerManager;
    this.eventBus = eventBus;
    this.config = config || {};

    // サブモジュール初期化
    if (window.TegakiDrawing) {
      this.settings = window.TegakiDrawing.BrushSettings ? 
        new window.TegakiDrawing.BrushSettings(config, eventBus) : null;
      this.recorder = window.TegakiDrawing.StrokeRecorder ? 
        new window.TegakiDrawing.StrokeRecorder(config) : null;
      this.renderer = window.TegakiDrawing.StrokeRenderer ? 
        new window.TegakiDrawing.StrokeRenderer(config) : null;
      this.pressureHandler = window.TegakiDrawing.PressureHandler ? 
        new window.TegakiDrawing.PressureHandler() : null;
      this.transformer = window.TegakiDrawing.StrokeTransformer ? 
        new window.TegakiDrawing.StrokeTransformer(config) : null;
    }

    // フォールバック: 基本設定
    this.brushSize = config?.pen?.size || 8;
    this.brushColor = config?.pen?.color || 0x000000;
    this.brushOpacity = config?.pen?.opacity || 1.0;

    // 描画状態
    this.isDrawing = false;
    this.currentTool = 'pen';
    this.currentPath = null;

    // 🔥 Phase 1: 拡張設定
    this.useTiltForSize = config?.pen?.useTiltForSize !== false; // デフォルトtrue
    this.useTiltForOpacity = config?.pen?.useTiltForOpacity !== false; // デフォルトtrue
    
    // 初回デバイス検出時にログ出力
    this._deviceReported = false;
  }

  /**
   * 描画開始
   * @param {number} screenX
   * @param {number} screenY
   * @param {PointerEvent} event - 完全なPointerEventを受け取る
   */
  startDrawing(screenX, screenY, event) {
    const canvasPoint = this.cameraSystem.screenToCanvas(screenX, screenY);
    
    // 🔥 Phase 1: 完全なポインター情報取得
    const pointerData = this.pressureHandler.getFullPointerData(event);

    // 🔥 初回デバイス検出時のログ
    if (!this._deviceReported && this.pressureHandler) {
      const caps = this.pressureHandler.getCapabilities();
      console.log('🖊️ Drawing Device Detected:', caps);
      this._deviceReported = true;
    }

    // 現在のズーム率取得
    const currentScale = this.cameraSystem.camera.scale || 1;

    // 🔥 Phase 1: 傾きベースのサイズ・不透明度調整
    let adjustedSize = this.settings.getBrushSize();
    let adjustedOpacity = this.settings.getBrushOpacity();

    if (this.useTiltForSize && pointerData.hasTilt) {
      adjustedSize = this.pressureHandler.getSizeFromTilt(
        pointerData.tiltX,
        pointerData.tiltY,
        adjustedSize
      );
    }

    if (this.useTiltForOpacity && pointerData.hasTilt) {
      adjustedOpacity = this.pressureHandler.getOpacityFromTilt(
        pointerData.tiltX,
        pointerData.tiltY,
        adjustedOpacity
      );
    }

    // ストロークオプション取得（ズーム対応サイズ）
    const strokeOptions = this.settings.getStrokeOptions();
    const scaledSize = this.renderer.getScaledSize(adjustedSize, currentScale);
    strokeOptions.size = scaledSize;

    // 🔥 Phase 1: 拡張情報を含む座標
    const startPoint = {
      x: canvasPoint.x,
      y: canvasPoint.y,
      pressure: pointerData.pressure
    };

    // 傾き情報があれば追加
    if (pointerData.hasTilt) {
      startPoint.tiltX = pointerData.tiltX;
      startPoint.tiltY = pointerData.tiltY;
    }

    // 回転情報があれば追加
    if (pointerData.hasTwist) {
      startPoint.twist = pointerData.twist;
    }

    // 新規パス開始
    this.currentPath = this.recorder.startNewPath(
      startPoint,
      this.currentTool === 'eraser' ? this.config.background.color : this.settings.getBrushColor(),
      adjustedSize,
      adjustedOpacity,
      this.currentTool,
      strokeOptions
    );

    // Phase 2: 元サイズとスケール記録
    this.currentPath.originalSize = this.settings.getBrushSize();
    this.currentPath.scaleAtDrawTime = currentScale;

    // 🔥 Phase 1: ポインター情報を記録
    this.currentPath.pointerInfo = {
      deviceType: pointerData.pointerType,
      hasRealPressure: pointerData.hasRealPressure,
      hasTilt: pointerData.hasTilt,
      hasTwist: pointerData.hasTwist
    };

    // Graphics作成
    this.currentPath.graphics = new PIXI.Graphics();
    
    this.isDrawing = true;
  }

  /**
   * 描画継続
   * @param {number} screenX
   * @param {number} screenY
   * @param {PointerEvent} event
   */
  continueDrawing(screenX, screenY, event) {
    if (!this.isDrawing || !this.currentPath) return;

    const canvasPoint = this.cameraSystem.screenToCanvas(screenX, screenY);
    
    // 🔥 Phase 1: 完全なポインター情報取得
    const pointerData = this.pressureHandler.getFullPointerData(event);

    // 🔥 Phase 1: 拡張情報を含む座標
    const point = {
      x: canvasPoint.x,
      y: canvasPoint.y,
      pressure: pointerData.pressure
    };

    // 傾き情報があれば追加
    if (pointerData.hasTilt) {
      point.tiltX = pointerData.tiltX;
      point.tiltY = pointerData.tiltY;
    }

    // 回転情報があれば追加
    if (pointerData.hasTwist) {
      point.twist = pointerData.twist;
    }

    // 座標追加
    this.recorder.addPoint(this.currentPath, point);

    // リアルタイム描画
    const options = {
      ...this.currentPath.strokeOptions,
      color: this.currentPath.color,
      alpha: this.currentPath.opacity
    };

    this.renderer.renderStroke(
      this.currentPath.points,
      options,
      this.currentPath.graphics
    );
  }

  /**
   * 描画終了 (History統合 + Simplify最適化)
   */
  stopDrawing() {
    if (!this.isDrawing || !this.currentPath) return;

    // 🔥 Phase 1: パス確定（最適化含む）
    this.recorder.finalizePath(this.currentPath);

    // 最終描画
    const options = {
      ...this.currentPath.strokeOptions,
      color: this.currentPath.color,
      alpha: this.currentPath.opacity
    };

    this.renderer.renderStroke(
      this.currentPath.points,
      options,
      this.currentPath.graphics
    );

    // History統合
    if (this.currentPath && this.currentPath.points.length > 0) {
      const path = this.currentPath;
      const layerIndex = this.layerManager.activeLayerIndex;
      
      // History に記録
      if (window.History && !window.History._manager.isApplying) {
        const command = {
          name: 'stroke-added',
          do: () => {
            this.layerManager.addPathToActiveLayer(path);
          },
          undo: () => {
            const activeLayer = this.layerManager.getActiveLayer();
            if (activeLayer?.layerData?.paths) {
              activeLayer.layerData.paths = 
                activeLayer.layerData.paths.filter(p => p !== path);
            }
            if (activeLayer?.paths) {
              activeLayer.paths = activeLayer.paths.filter(p => p !== path);
            }
            
            if (path.graphics) {
              try {
                if (activeLayer) {
                  activeLayer.removeChild(path.graphics);
                }
                path.graphics.destroy({ children: true, texture: false, baseTexture: false });
              } catch (e) {}
            }
            
            this.layerManager.requestThumbnailUpdate(layerIndex);
          },
          meta: { type: 'stroke', layerIndex }
        };
        
        window.History.push(command);
      } else {
        this.layerManager.addPathToActiveLayer(path);
      }
    }

    // 筆圧ハンドラーリセット
    this.pressureHandler.reset();

    this.isDrawing = false;
    this.currentPath = null;
  }

  /**
   * ツール設定
   * @param {string} tool - 'pen' | 'eraser'
   */
  setTool(tool) {
    if (tool === 'pen' || tool === 'eraser') {
      this.currentTool = tool;
      
      if (this.eventBus) {
        this.eventBus.emit('toolChanged', { tool });
      }
    }
  }

  /**
   * ブラシサイズ設定
   * @param {number} size
   */
  setBrushSize(size) {
    this.settings.setBrushSize(size);
  }

  /**
   * ブラシ色設定
   * @param {number} color
   */
  setBrushColor(color) {
    this.settings.setBrushColor(color);
  }

  /**
   * ブラシ不透明度設定
   * @param {number} opacity
   */
  setBrushOpacity(opacity) {
    this.settings.setBrushOpacity(opacity);
  }

  /**
   * 🔥 Phase 1: 傾き機能の有効/無効切り替え
   * @param {boolean} enabled
   */
  setTiltForSize(enabled) {
    this.useTiltForSize = enabled;
  }

  /**
   * 🔥 Phase 1: 傾きによる不透明度調整の有効/無効
   * @param {boolean} enabled
   */
  setTiltForOpacity(enabled) {
    this.useTiltForOpacity = enabled;
  }

  /**
   * 現在のツール取得
   * @returns {string}
   */
  getCurrentTool() {
    return this.currentTool;
  }

  /**
   * 描画中かチェック
   * @returns {boolean}
   */
  getIsDrawing() {
    return this.isDrawing;
  }

  /**
   * 🔥 Phase 1: デバイス情報取得
   * @returns {Object}
   */
  getDeviceCapabilities() {
    if (!this.pressureHandler) {
      return { deviceType: 'unknown', hasPressure: false, hasTilt: false, hasTwist: false };
    }
    return this.pressureHandler.getCapabilities();
  }
}

// グローバル登録
if (typeof window.TegakiDrawing === 'undefined') {
  window.TegakiDrawing = {};
}
window.TegakiDrawing.DrawingEngine = DrawingEngine;

console.log('✅ drawing-engine.js v3.0 (Phase 1完全対応版) loaded');
console.log('   - 🔥 Pointer Events API完全対応');
console.log('   - 🔥 傾きベースのサイズ・不透明度調整');
console.log('   - 🔥 拡張ポインター情報記録');