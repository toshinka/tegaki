// ============================================
// LayerSystem - B案: CUT = フォルダ方式対応
// ============================================

class LayerSystem {
  constructor() {
    // ★★★ layersContainerは「現在のCUTコンテナ」への参照ポイント ★★★
    this.layersContainer = null;
    
    // layers配列は削除 → getter で layersContainer.children を返す
    
    this.activeLayerIndex = -1;
    this.layerTransforms = new Map();
    
    this.canvasContainer = null;
    this.config = null;
    this.eventBus = null;
    this.animationSystem = null;
  }

  // ★★★ layers は getter で定義（常に最新のchildren） ★★★
  get layers() {
    return this.layersContainer ? Array.from(this.layersContainer.children) : [];
  }

  init(canvasContainer, config, eventBus) {
    this.canvasContainer = canvasContainer;
    this.config = config;
    this.eventBus = eventBus;
  }

  setAnimationSystem(animationSystem) {
    this.animationSystem = animationSystem;
  }

  // ============================================
  // CUTコンテナ切替
  // ============================================

  switchToCutContainer(newCutContainer) {
    // ★★★ 参照先を切り替えるだけ（コピー不要） ★★★
    this.layersContainer = newCutContainer;

    // activeLayerIndex調整
    if (this.activeLayerIndex >= this.layers.length) {
      this.activeLayerIndex = Math.max(0, this.layers.length - 1);
    }

    this.updateLayerPanelUI();
    this.updateStatusDisplay();

    if (this.eventBus) {
      this.eventBus.emit('layer:container-switched', {
        layerCount: this.layers.length
      });
    }
  }

  // ============================================
  // Layer作成・削除
  // ============================================

  createLayer(name = null, isBackground = false) {
    if (!this.layersContainer) return null;

    const layer = new PIXI.Container();
    layer.label = 'layer_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);

    const layerName = name || `レイヤー${this.layers.length + 1}`;

    layer.layerData = {
      id: layer.label,
      name: layerName,
      visible: true,
      opacity: 1,
      isBackground: isBackground,
      paths: []
    };

    if (isBackground) {
      const bgGraphics = new PIXI.Graphics();
      bgGraphics.rect(0, 0, this.config.canvas.width, this.config.canvas.height);
      bgGraphics.fill(this.config.background.color);
      layer.addChild(bgGraphics);
      layer.layerData.backgroundGraphics = bgGraphics;
    }

    this.layersContainer.addChild(layer);

    const newIndex = this.layers.length - 1;
    this.setActiveLayer(newIndex);

    this.updateLayerPanelUI();

    if (this.eventBus) {
      this.eventBus.emit('layer:created', { layerIndex: newIndex });
    }

    return { layer, index: newIndex };
  }

  deleteLayer(layerIndex) {
    if (!this.layersContainer) return false;
    if (this.layers.length <= 1) return false;
    if (layerIndex < 0 || layerIndex >= this.layers.length) return false;

    const layer = this.layers[layerIndex];

    layer.children.forEach(child => {
      if (child.destroy) {
        child.destroy({ children: true, texture: false, baseTexture: false });
      }
    });

    this.layersContainer.removeChild(layer);
    layer.destroy({ children: true, texture: false, baseTexture: false });

    if (this.activeLayerIndex >= layerIndex) {
      this.activeLayerIndex = Math.max(0, this.activeLayerIndex - 1);
    }

    this.updateLayerPanelUI();

    if (this.eventBus) {
      this.eventBus.emit('layer:deleted', { layerIndex });
    }

    return true;
  }

  // ============================================
  // Path追加
  // ============================================

  addPathToActiveLayer(path) {
    if (!this.layersContainer || this.activeLayerIndex < 0) return;

    const activeLayer = this.layers[this.activeLayerIndex];
    if (!activeLayer) return;

    activeLayer.layerData.paths.push(path);
    activeLayer.addChild(path.graphics);

    // AnimationSystemに通知（サムネイル更新用）
    if (this.eventBus) {
      this.eventBus.emit('layer:path-added', {
        cutIndex: this.animationSystem ? this.animationSystem.activeCutIndex : 0,
        layerIndex: this.activeLayerIndex
      });
    }
  }

  // ============================================
  // Layer選択
  // ============================================

  setActiveLayer(index) {
    if (index < 0 || index >= this.layers.length) return;

    this.activeLayerIndex = index;
    this.updateLayerPanelUI();
    this.updateStatusDisplay();

    if (this.eventBus) {
      this.eventBus.emit('layer:active-changed', { layerIndex: index });
    }
  }

  // ============================================
  // Layer可視性
  // ============================================

  toggleLayerVisibility(layerIndex) {
    if (layerIndex < 0 || layerIndex >= this.layers.length) return;

    const layer = this.layers[layerIndex];
    layer.visible = !layer.visible;
    layer.layerData.visible = layer.visible;

    this.updateLayerPanelUI();

    if (this.eventBus) {
      this.eventBus.emit('layer:visibility-changed', { layerIndex, visible: layer.visible });
    }
  }

  // ============================================
  // Transform管理
  // ============================================

  getTransformKey() {
    if (!this.animationSystem) return null;
    
    const cutData = this.animationSystem.getCurrentCutData();
    if (!cutData) return null;

    const layer = this.layers[this.activeLayerIndex];
    if (!layer) return null;

    return `${cutData.cutId}_${layer.layerData.id}`;
  }

  updateActiveLayerTransform(property, value) {
    if (this.activeLayerIndex < 0 || this.activeLayerIndex >= this.layers.length) return;

    const layer = this.layers[this.activeLayerIndex];
    const transformKey = this.getTransformKey();
    
    if (!transformKey) return;

    let transform = this.layerTransforms.get(transformKey);
    if (!transform) {
      transform = {
        x: 0,
        y: 0,
        rotation: 0,
        scaleX: 1,
        scaleY: 1
      };
      this.layerTransforms.set(transformKey, transform);
    }

    transform[property] = value;

    layer.position.set(transform.x, transform.y);
    layer.rotation = transform.rotation;
    layer.scale.set(transform.scaleX, transform.scaleY);

    this.updateStatusDisplay();
  }

  flipActiveLayer(direction) {
    if (this.activeLayerIndex < 0 || this.activeLayerIndex >= this.layers.length) return;

    const transformKey = this.getTransformKey();
    if (!transformKey) return;

    let transform = this.layerTransforms.get(transformKey);
    if (!transform) {
      transform = {
        x: 0,
        y: 0,
        rotation: 0,
        scaleX: 1,
        scaleY: 1
      };
      this.layerTransforms.set(transformKey, transform);
    }

    if (direction === 'horizontal') {
      transform.scaleX *= -1;
    } else if (direction === 'vertical') {
      transform.scaleY *= -1;
    }

    const layer = this.layers[this.activeLayerIndex];
    layer.scale.set(transform.scaleX, transform.scaleY);

    this.updateStatusDisplay();
  }

  confirmLayerTransform() {
    if (this.activeLayerIndex < 0 || this.activeLayerIndex >= this.layers.length) return;

    const layer = this.layers[this.activeLayerIndex];
    const transformKey = this.getTransformKey();
    
    if (!transformKey) return;

    const transform = this.layerTransforms.get(transformKey);
    if (!transform) return;

    // pathsにTransformをBake
    layer.layerData.paths.forEach(path => {
      const matrix = new PIXI.Matrix()
        .translate(-layer.pivot.x, -layer.pivot.y)
        .scale(transform.scaleX, transform.scaleY)
        .rotate(transform.rotation)
        .translate(layer.pivot.x + transform.x, layer.pivot.y + transform.y);

      path.points = path.points.map(p => {
        const point = matrix.apply({ x: p.x, y: p.y });
        return { x: point.x, y: point.y };
      });

      path.graphics.clear();
      path.points.forEach(point => {
        path.graphics.circle(point.x, point.y, path.size / 2);
        path.graphics.fill({
          color: path.color,
          alpha: path.opacity
        });
      });
    });

    // Transform初期化
    layer.position.set(0, 0);
    layer.rotation = 0;
    layer.scale.set(1, 1);

    this.layerTransforms.set(transformKey, {
      x: 0,
      y: 0,
      rotation: 0,
      scaleX: 1,
      scaleY: 1
    });

    this.updateStatusDisplay();

    if (this.eventBus) {
      this.eventBus.emit('layer:transform-confirmed', { layerIndex: this.activeLayerIndex });
    }
  }

  // ============================================
  // UI更新
  // ============================================

  updateLayerPanelUI() {
    const layerListElement = document.getElementById('layer-list');
    if (!layerListElement) return;

    layerListElement.innerHTML = '';

    this.layers.forEach((layer, index) => {
      const layerItem = document.createElement('div');
      layerItem.className = 'layer-item' + (index === this.activeLayerIndex ? ' active' : '');
      layerItem.dataset.layerIndex = index;

      const visibilityBtn = document.createElement('button');
      visibilityBtn.className = 'layer-visibility-btn';
      visibilityBtn.textContent = layer.visible ? '👁' : '🚫';
      visibilityBtn.onclick = (e) => {
        e.stopPropagation();
        this.toggleLayerVisibility(index);
      };

      const layerName = document.createElement('span');
      layerName.className = 'layer-name';
      layerName.textContent = layer.layerData.name;

      layerItem.appendChild(visibilityBtn);
      layerItem.appendChild(layerName);

      layerItem.onclick = () => this.setActiveLayer(index);

      layerListElement.appendChild(layerItem);
    });
  }

  updateStatusDisplay() {
    const statusElement = document.getElementById('layer-status');
    if (!statusElement) return;

    if (this.activeLayerIndex < 0 || this.activeLayerIndex >= this.layers.length) {
      statusElement.textContent = 'レイヤーなし';
      return;
    }

    const layer = this.layers[this.activeLayerIndex];
    const transformKey = this.getTransformKey();
    const transform = transformKey ? this.layerTransforms.get(transformKey) : null;

    let statusText = `${layer.layerData.name}`;
    
    if (transform) {
      if (transform.x !== 0 || transform.y !== 0) {
        statusText += ` | XY: ${Math.round(transform.x)}, ${Math.round(transform.y)}`;
      }
      if (transform.rotation !== 0) {
        statusText += ` | R: ${Math.round(transform.rotation * 180 / Math.PI)}°`;
      }
      if (transform.scaleX !== 1 || transform.scaleY !== 1) {
        statusText += ` | S: ${transform.scaleX.toFixed(2)}, ${transform.scaleY.toFixed(2)}`;
      }
    }

    statusElement.textContent = statusText;
  }

  // ============================================
  // レイヤーサムネイル更新（個別）
  // ============================================

  async updateThumbnail(layerIndex) {
    if (layerIndex < 0 || layerIndex >= this.layers.length) return;

    const layer = this.layers[layerIndex];

    const renderTexture = PIXI.RenderTexture.create({
      width: this.config.canvas.width,
      height: this.config.canvas.height
    });

    const tempApp = new PIXI.Application();
    await tempApp.init({ width: 1, height: 1 });

    tempApp.renderer.render({
      container: layer,
      target: renderTexture
    });

    const canvas = tempApp.renderer.extract.canvas(renderTexture);

    const thumbCanvas = document.createElement('canvas');
    thumbCanvas.width = 48;
    thumbCanvas.height = 36;

    const ctx = thumbCanvas.getContext('2d');
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(canvas, 0, 0, 48, 36);

    renderTexture.destroy();
    tempApp.destroy(true);

    const layerItem = document.querySelector(`[data-layer-index="${layerIndex}"]`);
    if (layerItem) {
      let thumbImg = layerItem.querySelector('.layer-thumbnail');
      if (!thumbImg) {
        thumbImg = document.createElement('img');
        thumbImg.className = 'layer-thumbnail';
        layerItem.insertBefore(thumbImg, layerItem.firstChild);
      }
      thumbImg.src = thumbCanvas.toDataURL();
    }
  }

  // ============================================
  // Utility
  // ============================================

  getActiveLayer() {
    if (this.activeLayerIndex < 0 || this.activeLayerIndex >= this.layers.length) {
      return null;
    }
    return this.layers[this.activeLayerIndex];
  }

  clearActiveLayer() {
    const layer = this.getActiveLayer();
    if (!layer) return;

    layer.layerData.paths.forEach(path => {
      if (path.graphics && path.graphics.destroy) {
        path.graphics.destroy({ children: true, texture: false, baseTexture: false });
      }
    });

    layer.children.forEach(child => {
      layer.removeChild(child);
      if (child.destroy && child !== layer.layerData.backgroundGraphics) {
        child.destroy({ children: true, texture: false, baseTexture: false });
      }
    });

    layer.layerData.paths = [];

    if (layer.layerData.isBackground && layer.layerData.backgroundGraphics) {
      layer.addChild(layer.layerData.backgroundGraphics);
    }

    if (this.eventBus) {
      this.eventBus.emit('layer:cleared', { layerIndex: this.activeLayerIndex });
    }
  }
}