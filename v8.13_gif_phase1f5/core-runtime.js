// ============================================
// core-runtime.js - B案: CUT = フォルダ方式完全移行版
// ============================================
// PixiJS v8.13 対応
// A案（2次元マトリクス管理）完全削除
// B案（Container = フォルダ管理）に統一

(function() {
  'use strict';

  const CONFIG = window.TEGAKI_CONFIG;
  if (!CONFIG) {
    throw new Error('config.js dependency missing');
  }

  const CoreRuntime = {
    internal: {
      app: null,
      worldContainer: null,
      canvasContainer: null,
      cameraSystem: null,
      layerSystem: null,
      animationSystem: null,
      drawingEngine: null,
      initialized: false
    },

    init(options) {
      console.log('=== CoreRuntime B案完全移行版 初期化開始 ===');

      Object.assign(this.internal, options);

      if (window.CoordinateSystem?.setContainers) {
        window.CoordinateSystem.setContainers({
          worldContainer: this.internal.worldContainer,
          canvasContainer: this.internal.canvasContainer,
          app: this.internal.app
        });
      }

      // AnimationSystem初期化
      if (this.internal.animationSystem && this.internal.layerSystem) {
        this.internal.animationSystem.init(
          this.internal.layerSystem,
          this.internal.app,
          this.internal.canvasContainer,
          window.TegakiEventBus,
          CONFIG
        );

        this.internal.layerSystem.setAnimationSystem(this.internal.animationSystem);
      }

      this.setupLegacyCompatibility();

      this.internal.initialized = true;

      console.log('✅ CoreRuntime B案完全移行版 初期化完了');
      console.log('  - CUT = フォルダ方式実装完了');
      console.log('  - LayerSystem getter方式実装完了');
      console.log('  - 参照管理の単純化完了');

      return this;
    },

    setupLegacyCompatibility() {
      window.drawingApp = {
        pixiApp: this.internal.app,
        cameraSystem: this.internal.cameraSystem,
        layerManager: this.internal.layerSystem,
        layerSystem: this.internal.layerSystem,
        animationSystem: this.internal.animationSystem,
        drawingEngine: this.internal.drawingEngine
      };

      window.drawingAppResizeCanvas = (w, h) => {
        return this.updateCanvasSize(w, h);
      };
    },

    updateCanvasSize(w, h) {
      console.log('CoreRuntime: キャンバスサイズ変更:', w, 'x', h);

      CONFIG.canvas.width = w;
      CONFIG.canvas.height = h;

      if (this.internal.cameraSystem?.resizeCanvas) {
        this.internal.cameraSystem.resizeCanvas(w, h);
      }

      // 全CUTの背景Layerを更新
      if (this.internal.animationSystem) {
        this.internal.animationSystem.cutMetadata.forEach(cutData => {
          const bgLayer = cutData.cutContainer.children[0];
          if (bgLayer && bgLayer.layerData?.isBackground) {
            const bgGraphics = bgLayer.layerData.backgroundGraphics;
            if (bgGraphics) {
              bgGraphics.clear();
              bgGraphics.rect(0, 0, w, h);
              bgGraphics.fill(CONFIG.background.color);
            }
          }
        });

        // サムネイル再生成
        this.internal.animationSystem.cutMetadata.forEach((cutData, index) => {
          this.internal.animationSystem.generateCutThumbnail(index);
        });
      }

      if (window.TegakiEventBus) {
        window.TegakiEventBus.emit('camera:resized', { width: w, height: h });
      }

      console.log('✅ キャンバスサイズ変更完了');
      return true;
    },

    // ============================================
    // API (統一インターフェース)
    // ============================================

    api: {
      setTool(toolName) {
        if (CoreRuntime.internal.drawingEngine?.setTool) {
          CoreRuntime.internal.drawingEngine.setTool(toolName);
          if (CoreRuntime.internal.cameraSystem?.switchTool) {
            CoreRuntime.internal.cameraSystem.switchTool(toolName);
          }
          return true;
        }
        return false;
      },

      setBrushSize(size) {
        if (CoreRuntime.internal.drawingEngine?.setBrushSize) {
          CoreRuntime.internal.drawingEngine.setBrushSize(size);
          return true;
        }
        return false;
      },

      setBrushOpacity(opacity) {
        if (CoreRuntime.internal.drawingEngine?.setBrushOpacity) {
          CoreRuntime.internal.drawingEngine.setBrushOpacity(opacity);
          return true;
        }
        return false;
      },

      panCamera(dx, dy) {
        if (CoreRuntime.internal.cameraSystem) {
          CoreRuntime.internal.cameraSystem.worldContainer.x += dx;
          CoreRuntime.internal.cameraSystem.worldContainer.y += dy;
          CoreRuntime.internal.cameraSystem.updateTransformDisplay();
          return true;
        }
        return false;
      },

      zoomCamera(factor, centerX = null, centerY = null) {
        if (!CoreRuntime.internal.cameraSystem) return false;

        const currentScale = CoreRuntime.internal.cameraSystem.worldContainer.scale.x;
        const newScale = currentScale * factor;

        if (newScale >= CONFIG.camera.minScale && newScale <= CONFIG.camera.maxScale) {
          const cx = centerX !== null ? centerX : CONFIG.canvas.width / 2;
          const cy = centerY !== null ? centerY : CONFIG.canvas.height / 2;

          const worldCenter = window.CoordinateSystem.localToGlobal(
            CoreRuntime.internal.cameraSystem.worldContainer, { x: cx, y: cy }
          );

          CoreRuntime.internal.cameraSystem.worldContainer.scale.set(newScale);

          const newWorldCenter = window.CoordinateSystem.localToGlobal(
            CoreRuntime.internal.cameraSystem.worldContainer, { x: cx, y: cy }
          );

          CoreRuntime.internal.cameraSystem.worldContainer.x += worldCenter.x - newWorldCenter.x;
          CoreRuntime.internal.cameraSystem.worldContainer.y += worldCenter.y - newWorldCenter.y;
          CoreRuntime.internal.cameraSystem.updateTransformDisplay();

          return true;
        }
        return false;
      },

      resizeCanvas(w, h) {
        return CoreRuntime.updateCanvasSize(w, h);
      },

      getActiveLayer() {
        return CoreRuntime.internal.layerSystem?.getActiveLayer() || null;
      },

      createLayer(name, isBackground = false) {
        if (CoreRuntime.internal.layerSystem) {
          const result = CoreRuntime.internal.layerSystem.createLayer(name, isBackground);
          return result;
        }
        return null;
      },

      setActiveLayer(index) {
        if (CoreRuntime.internal.layerSystem) {
          CoreRuntime.internal.layerSystem.setActiveLayer(index);
          return true;
        }
        return false;
      },

      enterLayerMoveMode() {
        if (CoreRuntime.internal.layerSystem?.enterLayerMoveMode) {
          CoreRuntime.internal.layerSystem.enterLayerMoveMode();
          return true;
        }
        return false;
      },

      exitLayerMoveMode() {
        if (CoreRuntime.internal.layerSystem?.exitLayerMoveMode) {
          CoreRuntime.internal.layerSystem.exitLayerMoveMode();
          return true;
        }
        return true;
      },

      // Animation API
      createNewCut(sourceType = 'blank') {
        if (CoreRuntime.internal.animationSystem) {
          return CoreRuntime.internal.animationSystem.createNewCut(sourceType);
        }
        return null;
      },

      switchToActiveCut(cutIndex) {
        if (CoreRuntime.internal.animationSystem) {
          CoreRuntime.internal.animationSystem.switchToActiveCut(cutIndex);
          return true;
        }
        return false;
      },

      deleteCut(cutIndex) {
        if (CoreRuntime.internal.animationSystem) {
          return CoreRuntime.internal.animationSystem.deleteCut(cutIndex);
        }
        return false;
      },

      play() {
        if (CoreRuntime.internal.animationSystem) {
          CoreRuntime.internal.animationSystem.play();
          return true;
        }
        return false;
      },

      stop() {
        if (CoreRuntime.internal.animationSystem) {
          CoreRuntime.internal.animationSystem.stop();
          return true;
        }
        return false;
      }
    },

    coord: window.CoordinateSystem,

    getEngines() {
      return {
        camera: this.internal.cameraSystem,
        layer: this.internal.layerSystem,
        animation: this.internal.animationSystem,
        drawing: this.internal.drawingEngine
      };
    },

    getCameraSystem() { return this.internal.cameraSystem; },
    getLayerSystem() { return this.internal.layerSystem; },
    getAnimationSystem() { return this.internal.animationSystem; },
    getDrawingEngine() { return this.internal.drawingEngine; },

    isInitialized() { return this.internal.initialized; }
  };

  window.CoreRuntime = CoreRuntime;

  console.log('✅ core-runtime.js B案完全移行版 loaded');
  console.log('  - A案（2次元マトリクス）完全削除');
  console.log('  - B案（フォルダ方式）統一実装');
  console.log('  - 参照管理の単純化完了');
})();