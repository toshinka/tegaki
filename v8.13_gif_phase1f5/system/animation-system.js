// ============================================
// AnimationSystem - B案: CUT = フォルダ方式
// ============================================

class AnimationSystem {
  constructor() {
    // ★★★ すべてのCUTを保持するコンテナ（非表示領域） ★★★
    this.cutsContainer = null;
    
    // ★★★ CUTメタデータ配列（表示順序・duration管理用） ★★★
    this.cutMetadata = [];
    
    // ★★★ 現在アクティブなCUTのIndex ★★★
    this.activeCutIndex = 0;
    
    // Playback用
    this.playbackState = {
      isPlaying: false,
      startTime: 0,
      currentTime: 0,
      loop: true
    };
    
    this.playbackTimer = null;
    this.thumbnailDebounceTimer = null;
    
    // 外部システム参照
    this.layerSystem = null;
    this.app = null;
    this.canvasContainer = null;
    this.eventBus = null;
    this.config = null;
  }

  init(layerSystem, app, canvasContainer, eventBus, config) {
    this.layerSystem = layerSystem;
    this.app = app;
    this.canvasContainer = canvasContainer;
    this.eventBus = eventBus;
    this.config = config;

    // ★★★ cutsContainer作成（非表示領域に配置） ★★★
    this.cutsContainer = new PIXI.Container();
    this.cutsContainer.label = 'AnimationSystem_CutsContainer';
    this.app.stage.addChild(this.cutsContainer);
    this.cutsContainer.visible = false;
    this.cutsContainer.renderable = false;
    this.cutsContainer.position.set(-999999, -999999);

    // 初期CUT作成
    this.createInitialCut();
    
    // 初期CUTをアクティブ化
    this.switchToActiveCut(0);

    // イベント登録
    this.setupEventListeners();
  }

  setupEventListeners() {
    if (!this.eventBus) return;

    this.eventBus.on('layer:path-added', (data) => {
      clearTimeout(this.thumbnailDebounceTimer);
      this.thumbnailDebounceTimer = setTimeout(() => {
        this.generateCutThumbnail(this.activeCutIndex);
      }, 100);
    });
  }

  // ============================================
  // CUT作成・管理
  // ============================================

  createInitialCut() {
    const cutContainer = new PIXI.Container();
    cutContainer.label = 'cut_001';

    // 背景Layer作成
    const bgLayer = this.createBackgroundLayer();
    cutContainer.addChild(bgLayer);

    // Layer1作成
    const layer1 = this.createEmptyLayer('レイヤー1');
    cutContainer.addChild(layer1);

    this.cutsContainer.addChild(cutContainer);
    cutContainer.visible = false;
    cutContainer.renderable = false;

    this.cutMetadata.push({
      cutId: cutContainer.label,
      name: 'CUT1',
      duration: 0.5,
      cutContainer: cutContainer,
      thumbnailCanvas: null,
      order: 0
    });
  }

  createBackgroundLayer() {
    const bgLayer = new PIXI.Container();
    bgLayer.label = 'bg_layer_' + Date.now();
    
    const bgGraphics = new PIXI.Graphics();
    bgGraphics.rect(0, 0, this.config.canvas.width, this.config.canvas.height);
    bgGraphics.fill(this.config.background.color);
    
    bgLayer.layerData = {
      id: bgLayer.label,
      name: '背景',
      visible: true,
      opacity: 1,
      isBackground: true,
      paths: [],
      backgroundGraphics: bgGraphics
    };
    
    bgLayer.addChild(bgGraphics);
    return bgLayer;
  }

  createEmptyLayer(name) {
    const layer = new PIXI.Container();
    layer.label = 'layer_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    
    layer.layerData = {
      id: layer.label,
      name: name,
      visible: true,
      opacity: 1,
      isBackground: false,
      paths: []
    };
    
    return layer;
  }

  createNewCut(sourceType = 'blank') {
    let cutContainer;

    if (sourceType === 'blank') {
      cutContainer = new PIXI.Container();
      cutContainer.label = 'cut_' + Date.now();

      const bgLayer = this.createBackgroundLayer();
      cutContainer.addChild(bgLayer);

      const layer1 = this.createEmptyLayer('レイヤー1');
      cutContainer.addChild(layer1);

    } else if (sourceType === 'copy_current') {
      const sourceCutData = this.cutMetadata[this.activeCutIndex];
      cutContainer = this.cloneCutContainer(sourceCutData.cutContainer);
    }

    this.cutsContainer.addChild(cutContainer);
    cutContainer.visible = false;
    cutContainer.renderable = false;

    const newCutData = {
      cutId: cutContainer.label,
      name: sourceType === 'copy_current' 
        ? this.cutMetadata[this.activeCutIndex].name + '_copy'
        : 'CUT' + (this.cutMetadata.length + 1),
      duration: sourceType === 'copy_current'
        ? this.cutMetadata[this.activeCutIndex].duration
        : 0.5,
      cutContainer: cutContainer,
      thumbnailCanvas: null,
      order: this.cutMetadata.length
    };

    this.cutMetadata.push(newCutData);

    const newIndex = this.cutMetadata.length - 1;
    this.switchToActiveCut(newIndex);

    requestAnimationFrame(() => {
      this.generateCutThumbnail(newIndex);
    });

    if (this.eventBus) {
      this.eventBus.emit('animation:cut-created', { cutIndex: newIndex });
    }

    return newCutData;
  }

  // ============================================
  // クローン処理
  // ============================================

  cloneCutContainer(sourceCutContainer) {
    const cloned = new PIXI.Container();
    cloned.label = 'cut_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);

    sourceCutContainer.children.forEach(sourceLayer => {
      const clonedLayer = this.cloneLayer(sourceLayer);
      cloned.addChild(clonedLayer);
    });

    cloned.position.set(sourceCutContainer.position.x, sourceCutContainer.position.y);
    cloned.scale.set(sourceCutContainer.scale.x, sourceCutContainer.scale.y);
    cloned.rotation = sourceCutContainer.rotation;
    cloned.alpha = sourceCutContainer.alpha;
    cloned.visible = false;
    cloned.renderable = false;

    return cloned;
  }

  cloneLayer(sourceLayer) {
    const clonedLayer = new PIXI.Container();
    clonedLayer.label = sourceLayer.label + '_clone_' + Date.now();

    clonedLayer.layerData = {
      id: clonedLayer.label,
      name: sourceLayer.layerData.name,
      visible: sourceLayer.layerData.visible,
      opacity: sourceLayer.layerData.opacity,
      isBackground: sourceLayer.layerData.isBackground,
      paths: []
    };

    clonedLayer.position.set(sourceLayer.position.x, sourceLayer.position.y);
    clonedLayer.pivot.set(sourceLayer.pivot.x, sourceLayer.pivot.y);
    clonedLayer.rotation = sourceLayer.rotation;
    clonedLayer.scale.set(sourceLayer.scale.x, sourceLayer.scale.y);
    clonedLayer.alpha = sourceLayer.alpha;
    clonedLayer.visible = sourceLayer.visible;

    if (sourceLayer.layerData.isBackground && sourceLayer.layerData.backgroundGraphics) {
      const clonedBg = new PIXI.Graphics();
      clonedBg.rect(0, 0, this.config.canvas.width, this.config.canvas.height);
      clonedBg.fill(this.config.background.color);
      clonedLayer.addChild(clonedBg);
      clonedLayer.layerData.backgroundGraphics = clonedBg;
    }

    if (sourceLayer.layerData.paths) {
      sourceLayer.layerData.paths.forEach(sourcePath => {
        const clonedPath = this.clonePath(sourcePath);
        clonedLayer.layerData.paths.push(clonedPath);
        clonedLayer.addChild(clonedPath.graphics);
      });
    }

    return clonedLayer;
  }

  clonePath(sourcePath) {
    const clonedGraphics = new PIXI.Graphics();

    const clonedPoints = sourcePath.points.map(p => ({
      x: p.x,
      y: p.y
    }));

    clonedPoints.forEach(point => {
      clonedGraphics.circle(point.x, point.y, sourcePath.size / 2);
      clonedGraphics.fill({
        color: sourcePath.color,
        alpha: sourcePath.opacity
      });
    });

    return {
      id: 'path_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
      points: clonedPoints,
      size: sourcePath.size,
      color: sourcePath.color,
      opacity: sourcePath.opacity,
      tool: sourcePath.tool,
      graphics: clonedGraphics
    };
  }

  // ============================================
  // CUT切替
  // ============================================

  switchToActiveCut(newIndex) {
    if (this.activeCutIndex === newIndex) return;
    if (newIndex < 0 || newIndex >= this.cutMetadata.length) return;

    const oldCutData = this.cutMetadata[this.activeCutIndex];
    const newCutData = this.cutMetadata[newIndex];

    // ★★★ 旧CUTを非表示領域へ戻す ★★★
    if (oldCutData.cutContainer.parent === this.canvasContainer) {
      this.canvasContainer.removeChild(oldCutData.cutContainer);
      this.cutsContainer.addChild(oldCutData.cutContainer);
      oldCutData.cutContainer.visible = false;
      oldCutData.cutContainer.renderable = false;
    }

    // ★★★ 新CUTを表示領域へ移動 ★★★
    if (newCutData.cutContainer.parent === this.cutsContainer) {
      this.cutsContainer.removeChild(newCutData.cutContainer);
      this.canvasContainer.addChild(newCutData.cutContainer);
      newCutData.cutContainer.visible = true;
      newCutData.cutContainer.renderable = true;
      newCutData.cutContainer.position.set(0, 0);
    }

    // ★★★ LayerSystemの参照先を切替 ★★★
    this.layerSystem.switchToCutContainer(newCutData.cutContainer);

    this.activeCutIndex = newIndex;

    if (this.eventBus) {
      this.eventBus.emit('animation:cut-applied', {
        cutIndex: newIndex,
        cutId: newCutData.cutId
      });
    }
  }

  // ============================================
  // CUT削除
  // ============================================

  deleteCut(cutIndex) {
    if (this.cutMetadata.length <= 1) return false;

    const cutData = this.cutMetadata[cutIndex];
    const cutContainer = cutData.cutContainer;

    // Container完全破棄
    cutContainer.children.forEach(layer => {
      layer.children.forEach(child => {
        if (child.destroy) {
          child.destroy({ children: true, texture: false, baseTexture: false });
        }
      });
      layer.destroy({ children: true, texture: false, baseTexture: false });
    });

    if (cutContainer.parent) {
      cutContainer.parent.removeChild(cutContainer);
    }
    cutContainer.destroy({ children: true, texture: false, baseTexture: false });

    // Transform情報削除
    const cutId = cutData.cutId;
    for (let key of this.layerSystem.layerTransforms.keys()) {
      if (key.startsWith(cutId + '_')) {
        this.layerSystem.layerTransforms.delete(key);
      }
    }

    this.cutMetadata.splice(cutIndex, 1);

    // アクティブIndex調整
    if (this.activeCutIndex >= cutIndex) {
      this.activeCutIndex = Math.max(0, this.activeCutIndex - 1);
    }

    this.switchToActiveCut(this.activeCutIndex);

    if (this.eventBus) {
      this.eventBus.emit('animation:cut-deleted', { cutIndex });
    }

    return true;
  }

  // ============================================
  // サムネイル生成
  // ============================================

  async generateCutThumbnail(cutIndex) {
    if (cutIndex < 0 || cutIndex >= this.cutMetadata.length) return;

    const cutData = this.cutMetadata[cutIndex];
    const cutContainer = cutData.cutContainer;

    const wasVisible = cutContainer.visible;
    const originalParent = cutContainer.parent;

    if (!wasVisible) {
      if (originalParent) originalParent.removeChild(cutContainer);
      this.app.stage.addChild(cutContainer);
      cutContainer.visible = true;
      cutContainer.renderable = true;
      cutContainer.position.set(-10000, -10000);
    }

    await new Promise(resolve => requestAnimationFrame(resolve));

    const renderTexture = PIXI.RenderTexture.create({
      width: this.config.canvas.width,
      height: this.config.canvas.height
    });

    this.app.renderer.render({
      container: cutContainer,
      target: renderTexture
    });

    const canvas = this.app.renderer.extract.canvas(renderTexture);

    const thumbCanvas = document.createElement('canvas');
    thumbCanvas.width = 72;
    thumbCanvas.height = 54;

    const ctx = thumbCanvas.getContext('2d');
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(canvas, 0, 0, 72, 54);

    renderTexture.destroy();

    cutData.thumbnailCanvas = thumbCanvas;

    if (!wasVisible) {
      this.app.stage.removeChild(cutContainer);
      if (originalParent) originalParent.addChild(cutContainer);
      cutContainer.visible = false;
      cutContainer.renderable = false;
    }
    cutContainer.position.set(0, 0);

    if (this.eventBus) {
      this.eventBus.emit('animation:thumbnail-generated', { cutIndex });
    }
  }

  // ============================================
  // Playback制御
  // ============================================

  play() {
    if (this.playbackState.isPlaying) return;

    this.playbackState.isPlaying = true;
    this.playbackState.startTime = performance.now();
    this.playbackState.currentTime = 0;

    this.playbackTimer = setInterval(() => {
      this.updatePlayback();
    }, 16);

    if (this.eventBus) {
      this.eventBus.emit('animation:playback-started');
    }
  }

  stop() {
    if (!this.playbackState.isPlaying) return;

    this.playbackState.isPlaying = false;
    clearInterval(this.playbackTimer);
    this.playbackTimer = null;

    if (this.eventBus) {
      this.eventBus.emit('animation:playback-stopped');
    }
  }

  updatePlayback() {
    const elapsed = (performance.now() - this.playbackState.startTime) / 1000;
    this.playbackState.currentTime = elapsed;

    let totalDuration = 0;
    for (let i = 0; i < this.cutMetadata.length; i++) {
      totalDuration += this.cutMetadata[i].duration;
      if (elapsed < totalDuration) {
        if (this.activeCutIndex !== i) {
          this.switchToActiveCut(i);
        }
        return;
      }
    }

    if (this.playbackState.loop) {
      this.playbackState.startTime = performance.now();
      this.switchToActiveCut(0);
    } else {
      this.stop();
    }
  }

  goToNextFrame() {
    const nextIndex = (this.activeCutIndex + 1) % this.cutMetadata.length;
    this.switchToActiveCut(nextIndex);
  }

  goToPreviousFrame() {
    const prevIndex = (this.activeCutIndex - 1 + this.cutMetadata.length) % this.cutMetadata.length;
    this.switchToActiveCut(prevIndex);
  }

  // ============================================
  // CUT設定
  // ============================================

  updateCutDuration(cutIndex, duration) {
    if (cutIndex < 0 || cutIndex >= this.cutMetadata.length) return;
    this.cutMetadata[cutIndex].duration = Math.max(0.1, duration);

    if (this.eventBus) {
      this.eventBus.emit('animation:cut-duration-updated', { cutIndex, duration });
    }
  }

  reorderCuts(oldIndex, newIndex) {
    if (oldIndex === newIndex) return;
    
    const [moved] = this.cutMetadata.splice(oldIndex, 1);
    this.cutMetadata.splice(newIndex, 0, moved);

    this.cutMetadata.forEach((cut, i) => {
      cut.order = i;
    });

    if (this.activeCutIndex === oldIndex) {
      this.activeCutIndex = newIndex;
    } else if (this.activeCutIndex > oldIndex && this.activeCutIndex <= newIndex) {
      this.activeCutIndex--;
    } else if (this.activeCutIndex < oldIndex && this.activeCutIndex >= newIndex) {
      this.activeCutIndex++;
    }

    if (this.eventBus) {
      this.eventBus.emit('animation:cuts-reordered');
    }
  }

  // ============================================
  // Getter
  // ============================================

  getCurrentCutData() {
    return this.cutMetadata[this.activeCutIndex];
  }

  getTotalDuration() {
    return this.cutMetadata.reduce((sum, cut) => sum + cut.duration, 0);
  }
}