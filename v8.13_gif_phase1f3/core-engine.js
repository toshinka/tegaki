// ============================================================
// Core Engine - 初期化とシステム連携
// ============================================================

class CoreEngine {
  constructor() {
    this.app = null;
    this.eventBus = null;
    this.coordinateSystem = null;
    this.layerSystem = null;
    this.cameraSystem = null;
    this.animationSystem = null;
    this.gifExporter = null;
    this.drawingClipboard = null;
    this.uiPanels = null;
    this.timelineUI = null;

    this.currentTool = 'pen';
    this.currentColor = '#ffffff';
    this.currentSize = 2;
    this.currentOpacity = 1;

    this.isDrawing = false;
    this.currentPath = null;
  }

  async initialize() {
    this._createPixiApp();
    this._initializeSystems();
    this._setupEventListeners();
    this._setupKeyboardShortcuts();
  }

  _createPixiApp() {
    this.app = new PIXI.Application();
    this.app.init({
      width: window.innerWidth,
      height: window.innerHeight,
      backgroundColor: 0x1a1a1a,
      resolution: window.devicePixelRatio || 1,
      autoDensity: true,
      antialias: true
    }).then(() => {
      document.body.appendChild(this.app.canvas);
      this.app.canvas.style.position = 'absolute';
      this.app.canvas.style.top = '0';
      this.app.canvas.style.left = '0';
    });
  }

  _initializeSystems() {
    this.eventBus = new EventBus();
    this.coordinateSystem = new CoordinateSystem(this.app);
    
    // LayerSystem初期化
    this.layerSystem = new LayerSystem(
      this.app,
      this.coordinateSystem,
      this.eventBus
    );

    // AnimationSystem初期化
    this.animationSystem = new AnimationSystem(
      this.layerSystem,
      this.coordinateSystem,
      this.eventBus
    );

    // ★相互参照の設定
    this.layerSystem.setAnimationSystem(this.animationSystem);

    // 初期同期
    const initialLayers = this.animationSystem.getCurrentCutLayers();
    this.layerSystem.syncFromAnimationSystem(initialLayers);

    // CameraSystem初期化
    this.cameraSystem = new CameraSystem(
      this.app,
      this.coordinateSystem,
      this.eventBus
    );

    // Stageに追加
    this.app.stage.addChild(this.cameraSystem.viewport);
    this.cameraSystem.viewport.addChild(this.layerSystem.getContainer());

    // その他システム
    this.drawingClipboard = new DrawingClipboard(
      this.layerSystem,
      this.eventBus
    );

    this.gifExporter = new GIFExporter(
      this.animationSystem,
      this.coordinateSystem
    );

    // UI初期化
    this.uiPanels = new UIPanels(
      this,
      this.layerSystem,
      this.cameraSystem,
      this.animationSystem,
      this.gifExporter,
      this.eventBus
    );

    this.timelineUI = new TimelineUI(
      this.animationSystem,
      this.eventBus
    );
  }

  _setupEventListeners() {
    const canvas = this.app.canvas;

    canvas.addEventListener('pointerdown', (e) => this._onPointerDown(e));
    canvas.addEventListener('pointermove', (e) => this._onPointerMove(e));
    canvas.addEventListener('pointerup', (e) => this._onPointerUp(e));
    canvas.addEventListener('pointercancel', (e) => this._onPointerUp(e));

    window.addEventListener('resize', () => this._onResize());
  }

  _setupKeyboardShortcuts() {
    document.addEventListener('keydown', (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

      // ペンツール
      if (e.key === 'p' || e.key === 'P') {
        this.currentTool = 'pen';
        this.eventBus.emit('tool:changed', { tool: 'pen' });
      }

      // 消しゴムツール
      if (e.key === 'e' || e.key === 'E') {
        this.currentTool = 'eraser';
        this.eventBus.emit('tool:changed', { tool: 'eraser' });
      }

      // レイヤークリア
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (e.shiftKey) {
          this.layerSystem.clearAllLayers();
        } else {
          this.layerSystem.clearCurrentLayer();
        }
        e.preventDefault();
      }

      // アニメーション再生/停止
      if (e.key === ' ') {
        this.animationSystem.togglePlayPause();
        e.preventDefault();
      }

      // CUT追加
      if (e.key === 'n' && e.ctrlKey) {
        this.animationSystem.addNewCut();
        e.preventDefault();
      }

      // カメラリセット
      if (e.key === '0') {
        this.cameraSystem.resetCamera();
      }

      // レイヤー切替
      if (e.key >= '1' && e.key <= '9') {
        const layerIndex = parseInt(e.key) - 1;
        this.layerSystem.setCurrentLayer(layerIndex);
      }

      // Transform Mode
      if (e.key === 't' || e.key === 'T') {
        const isEnabled = !this.layerSystem.isTransformMode;
        this.layerSystem.setTransformMode(isEnabled);
      }

      // Layer移動（Transform Mode時）
      if (this.layerSystem.isTransformMode) {
        const moveSpeed = e.shiftKey ? 10 : 1;
        if (e.key === 'ArrowUp') {
          this.layerSystem.moveLayer(0, -moveSpeed);
          e.preventDefault();
        }
        if (e.key === 'ArrowDown') {
          this.layerSystem.moveLayer(0, moveSpeed);
          e.preventDefault();
        }
        if (e.key === 'ArrowLeft') {
          this.layerSystem.moveLayer(-moveSpeed, 0);
          e.preventDefault();
        }
        if (e.key === 'ArrowRight') {
          this.layerSystem.moveLayer(moveSpeed, 0);
          e.preventDefault();
        }

        // Layer回転
        if (e.key === 'r' || e.key === 'R') {
          const angle = e.shiftKey ? -Math.PI / 12 : Math.PI / 12;
          this.layerSystem.rotateLayer(angle);
        }

        // Layer反転
        if (e.key === 'h' || e.key === 'H') {
          this.layerSystem.flipLayerHorizontal();
        }
        if (e.key === 'v' || e.key === 'V') {
          this.layerSystem.flipLayerVertical();
        }
      }
    });
  }

  _onPointerDown(e) {
    if (e.button !== 0) return;

    const worldPos = this.coordinateSystem.screenToWorld(e.clientX, e.clientY);

    if (this.currentTool === 'pen' || this.currentTool === 'eraser') {
      this.isDrawing = true;
      this.currentPath = {
        id: `path_${Date.now()}_${Math.random()}`,
        points: [worldPos.x, worldPos.y],
        color: this.currentTool === 'eraser' ? '#000000' : this.currentColor,
        size: this.currentSize,
        opacity: this.currentTool === 'eraser' ? 0 : this.currentOpacity,
        tool: this.currentTool
      };
    }
  }

  _onPointerMove(e) {
    if (!this.isDrawing || !this.currentPath) return;

    const worldPos = this.coordinateSystem.screenToWorld(e.clientX, e.clientY);
    this.currentPath.points.push(worldPos.x, worldPos.y);

    // リアルタイム描画更新
    this._updateCurrentPathGraphics();
  }

  _onPointerUp(e) {
    if (!this.isDrawing || !this.currentPath) return;

    this.isDrawing = false;

    if (this.currentPath.points.length >= 4) {
      // LayerSystemに追加
      this.layerSystem.addPath(this.currentPath);
      
      // 完了イベント
      this.eventBus.emit('draw:complete', {
        path: this.currentPath
      });
    }

    this.currentPath = null;
  }

  _updateCurrentPathGraphics() {
    if (!this.currentPath || this.currentPath.points.length < 4) return;

    const currentLayer = this.layerSystem.getCurrentLayer();
    if (!currentLayer) return;

    // 既存の一時Graphicsを削除
    const tempGraphics = currentLayer.children.find(
      child => child.label === 'temp_drawing'
    );
    if (tempGraphics) {
      currentLayer.removeChild(tempGraphics);
      tempGraphics.destroy();
    }

    // 新しい一時Graphics作成
    const graphics = new PIXI.Graphics();
    graphics.label = 'temp_drawing';

    const color = this.layerSystem._parseColor(this.currentPath.color);
    graphics.moveTo(this.currentPath.points[0], this.currentPath.points[1]);
    graphics.stroke({
      width: this.currentPath.size,
      color: color,
      alpha: this.currentPath.opacity,
      cap: 'round',
      join: 'round'
    });

    for (let i = 2; i < this.currentPath.points.length; i += 2) {
      graphics.lineTo(this.currentPath.points[i], this.currentPath.points[i + 1]);
    }

    currentLayer.addChild(graphics);
  }

  _onResize() {
    this.app.renderer.resize(window.innerWidth, window.innerHeight);
    this.coordinateSystem.updateCanvasSize();
  }

  // ============================================================
  // ツール設定
  // ============================================================
  setTool(tool) {
    this.currentTool = tool;
    this.eventBus.emit('tool:changed', { tool });
  }

  setColor(color) {
    this.currentColor = color;
  }

  setSize(size) {
    this.currentSize = size;
  }

  setOpacity(opacity) {
    this.currentOpacity = opacity;
  }
}

// ============================================================
// アプリケーション起動
// ============================================================
window.addEventListener('DOMContentLoaded', async () => {
  const engine = new CoreEngine();
  await engine.initialize();
  window.coreEngine = engine;
  console.log('✅ CoreEngine initialized');
});