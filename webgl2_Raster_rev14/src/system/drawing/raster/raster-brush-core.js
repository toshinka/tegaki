/**
 * ============================================================================
 * ファイル名: system/drawing/raster/raster-brush-core.js
 * Phase: B-Emergency-2
 * 責務: ラスターブラシGPU描画（描画Canvas専用）
 * ============================================================================
 */

(function() {
  'use strict';

  class RasterBrushCore {
    constructor() {
      this.gl = null;
      this.rasterLayer = null;
      this.brushStamp = null;
      this.brushInterpolator = null;
      this.settingsManager = null;
      this.currentStroke = { active: false, layerId: null, isEraser: false, points: [], lastPoint: null };
      this.initialized = false;
    }

    initialize(drawingCanvas) {
      try {
        console.log('[RasterBrushCore] 🚀 Initializing...');
        this.gl = drawingCanvas.getContext('webgl2');
        if (!this.gl) throw new Error('[RasterBrushCore] ❌ WebGL2 not found');
        this.rasterLayer = window.rasterLayer || window.RasterLayer;
        this.brushStamp = window.brushStamp || window.BrushStamp;
        this.brushInterpolator = window.brushInterpolator || window.BrushInterpolator;
        this.settingsManager = window.settingsManager;
        this.initialized = true;
        console.log('[RasterBrushCore] ✅ Initialized');
      } catch (error) {
        console.error('[RasterBrushCore] ❌ Initialization failed:', error);
      }
    }

    startStroke(localX, localY, pressure, tiltX = 0, tiltY = 0, twist = 0) {
      if (!this.initialized) {
        // 再試行
        const canvas = document.getElementById('drawing-canvas-separated');
        if (canvas) this.initialize(canvas);
        if (!this.initialized) return;
      }
      try {
        const layerId = this._getCurrentLayerId();
        if (!layerId) return;
        const brushSettings = this._getBrushSettings();
        this.currentStroke = {
          active: true,
          layerId: layerId,
          isEraser: brushSettings.isEraser,
          points: [],
          lastPoint: { localX, localY, pressure, tiltX, tiltY, twist }
        };
        if (this.rasterLayer.bindFramebuffer(layerId)) {
          this._drawBrushStamp(localX, localY, pressure, tiltX, tiltY, twist, brushSettings);
          this.currentStroke.points.push({ localX, localY, pressure, tiltX, tiltY, twist });
        }
      } catch (error) {
        console.error('[RasterBrushCore] ❌ startStroke error:', error);
        this.currentStroke.active = false;
      }
    }

    addStrokePoint(localX, localY, pressure, tiltX = 0, tiltY = 0, twist = 0) {
      if (!this.currentStroke.active) return;
      try {
        const lastPoint = this.currentStroke.lastPoint;
        const dx = localX - lastPoint.localX;
        const dy = localY - lastPoint.localY;
        const distance = Math.sqrt(dx * dx + dy * dy);
        const brushSettings = this._getBrushSettings();
        const threshold = brushSettings.size * 0.25;
        if (distance > threshold) {
          const points = this.brushInterpolator.interpolate(lastPoint, { localX, localY, pressure, tiltX, tiltY, twist }, distance);
          for (const p of points) this._drawBrushStamp(p.localX, p.localY, p.pressure, p.tiltX, p.tiltY, p.twist, brushSettings);
        } else {
          this._drawBrushStamp(localX, localY, pressure, tiltX, tiltY, twist, brushSettings);
        }
        this.currentStroke.lastPoint = { localX, localY, pressure, tiltX, tiltY, twist };
      } catch (error) {
        console.error('[RasterBrushCore] ❌ addStrokePoint error:', error);
      }
    }

    async finalizeStroke() {
      if (!this.currentStroke.active) return false;
      try {
        const layerId = this.currentStroke.layerId;
        this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, null);
        this.currentStroke.active = false;
        if (window.glTextureBridge) await window.glTextureBridge.transferLayerToPixi(layerId);
        return true;
      } catch (error) {
        console.error('[RasterBrushCore] ❌ finalizeStroke error:', error);
        this.currentStroke.active = false;
        return false;
      }
    }

    _drawBrushStamp(localX, localY, pressure, tiltX, tiltY, twist, settings) {
      const pCurve = this._calculatePressureCurve(pressure);
      const size = settings.size * pCurve;
      const opacity = settings.opacity * pCurve;
      
      if (this.gl && this.brushStamp) {
        this.brushStamp.drawStamp(this.gl, localX, localY, size, opacity, settings.color, tiltX, tiltY, twist, settings.hardness, settings.flow, settings.isEraser);
        if (Math.random() < 0.01) console.log('[RasterBrushCore] 🖌️ Stamp drawn at', localX, localY);
      }
    }

    _calculatePressureCurve(p) {
      const min = this.settingsManager?.getPressureMinSize() || 0.1;
      const curve = this.settingsManager?.getPressureCurve() || 1.0;
      return min + (1 - min) * Math.pow(p, curve);
    }

    _getCurrentLayerId() {
      const active = (window.layerSystem || window.layerManager)?.getActiveLayer();
      return active ? active.id : null;
    }

    _getBrushSettings() {
      if (!this.settingsManager) return { size: 10, opacity: 1, color: { r: 0, g: 0, b: 0 }, isEraser: false, hardness: 0.8, flow: 1 };
      const mode = this.settingsManager.getCurrentMode?.() || 'pen';
      const colorHex = this.settingsManager.getBrushColor?.() || '#000000';
      return {
        size: this.settingsManager.getBrushSize?.() || 10,
        opacity: this.settingsManager.getBrushOpacity?.() || 1,
        color: this._hexToRgb(colorHex),
        isEraser: mode === 'eraser',
        hardness: this.settingsManager.getRasterStampHardness?.() || 0.8,
        flow: this.settingsManager.getBrushFlow?.() || 1
      };
    }

    _hexToRgb(hex) {
      const c = hex.startsWith('#') ? hex.slice(1) : hex;
      const r = parseInt(c.length === 3 ? c[0] + c[0] : c.slice(0, 2), 16) / 255;
      const g = parseInt(c.length === 3 ? c[1] + c[1] : c.slice(2, 4), 16) / 255;
      const b = parseInt(c.length === 3 ? c[2] + c[2] : c.slice(4, 6), 16) / 255;
      return { r: r || 0, g: g || 0, b: b || 0 };
    }
  }

  // Global registration
  if (!window.rasterBrushCore) {
    const instance = new RasterBrushCore();
    window.RasterBrushCore = instance;
    window.rasterBrushCore = instance;
    console.log('[RasterBrushCore] ✅ Global instance registered');
  }
})();
