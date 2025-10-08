/**
 * アルバムポップアップ
 * 通常スナップショット（レイヤー保持）とGIFスナップショット（ラスター化）の両対応
 */

class AlbumPopup {
  constructor(app, layerSystem, animationSystem) {
    this.app = app;
    this.layerSystem = layerSystem;
    this.animationSystem = animationSystem;
    
    this.overlay = null;
    this.popup = null;
    this.isOpen = false;
    this.snapshots = [];
    this.previewIntervals = new Map();
  }

  show() {
    if (this.isOpen) return;
    
    this._createPopup();
    this._loadSnapshots();
    this.isOpen = true;
  }

  hide() {
    if (!this.isOpen) return;
    
    this.previewIntervals.forEach(id => clearInterval(id));
    this.previewIntervals.clear();
    
    if (this.overlay) {
      this.overlay.remove();
      this.overlay = null;
    }
    this.popup = null;
    this.isOpen = false;
  }

  _createPopup() {
    this.overlay = document.createElement('div');
    this.overlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: transparent;
      z-index: 10000;
      display: flex;
      align-items: center;
      justify-content: center;
    `;

    this.popup = document.createElement('div');
    this.popup.style.cssText = `
      background: var(--futaba-cream);
      border: 2px solid var(--futaba-maroon);
      border-radius: 16px;
      box-shadow: 0 12px 32px rgba(128, 0, 0, 0.3);
      width: 80%;
      max-width: 900px;
      height: 80%;
      max-height: 700px;
      display: flex;
      flex-direction: column;
      color: var(--text-primary);
    `;

    const controls = document.createElement('div');
    controls.style.cssText = `
      padding: 16px 20px;
      border-bottom: 2px solid var(--futaba-light-medium);
      display: flex;
      gap: 12px;
      flex-shrink: 0;
    `;
    controls.innerHTML = `
      <button id="albumSave" style="padding: 8px 20px; border: 2px solid var(--futaba-maroon); border-radius: 8px; background: var(--futaba-background); color: var(--futaba-maroon); font-weight: 600; cursor: pointer; transition: all 0.2s; font-size: 14px;">現在の状態を保存</button>
      <button id="albumSaveGIF" style="padding: 8px 20px; border: 2px solid var(--futaba-maroon); border-radius: 8px; background: var(--futaba-background); color: var(--futaba-maroon); font-weight: 600; cursor: pointer; transition: all 0.2s; font-size: 14px;">GIF保存</button>
    `;

    const gallery = document.createElement('div');
    gallery.id = 'albumGallery';
    gallery.style.cssText = `
      flex: 1;
      overflow-y: scroll;
      overflow-x: hidden;
      padding: 16px;
      display: grid;
      grid-template-columns: repeat(6, 130px);
      gap: 12px;
      align-content: start;
      justify-content: start;
    `;

    this.popup.appendChild(controls);
    this.popup.appendChild(gallery);
    this.overlay.appendChild(this.popup);
    document.body.appendChild(this.overlay);

    const saveBtn = document.getElementById('albumSave');
    if (saveBtn) {
      saveBtn.onclick = () => this._saveSnapshot();
      this._setupButtonHover(saveBtn);
    }

    const saveGIFBtn = document.getElementById('albumSaveGIF');
    if (saveGIFBtn) {
      saveGIFBtn.onclick = () => this._saveAsGIF();
      this._setupButtonHover(saveGIFBtn);
    }
    
    this.overlay.onclick = (e) => {
      if (e.target === this.overlay) {
        this.hide();
      }
    };
    
    this.popup.onclick = (e) => {
      e.stopPropagation();
    };
  }

  _setupButtonHover(btn) {
    btn.onmouseenter = () => {
      btn.style.background = 'var(--futaba-maroon)';
      btn.style.color = 'var(--text-inverse)';
    };
    btn.onmouseleave = () => {
      btn.style.background = 'var(--futaba-background)';
      btn.style.color = 'var(--futaba-maroon)';
    };
  }

  async _saveSnapshot() {
    const snapshot = await this._captureSnapshot();
    this.snapshots.push(snapshot);
    this._saveToStorage();
    this._renderGallery();
  }

  async _saveAsGIF() {
    if (!this.animationSystem) return;

    const exportManager = window.TegakiCoreEngine?.exportManager;
    if (!exportManager || !exportManager.gifExporter) {
      alert('GIFエクスポーターが利用できません');
      return;
    }

    try {
      const blob = await exportManager.gifExporter.generateGifBlob();
      const dataUrl = await this._blobToDataURL(blob);
      
      const thumbnail = await this._createGIFThumbnail(dataUrl);

      const cuts = this.animationSystem.animationData.cuts || [];
      const frames = [];
      
      for (let i = 0; i < cuts.length; i++) {
        const renderTexture = PIXI.RenderTexture.create({
          width: this.app.screen.width,
          height: this.app.screen.height
        });

        this.app.renderer.render({
          container: cuts[i].container,
          target: renderTexture
        });

        const canvas = this.app.renderer.extract.canvas(renderTexture);
        const frameData = canvas.toDataURL('image/png');
        frames.push(frameData);
        
        renderTexture.destroy(true);
      }

      const snapshot = {
        id: Date.now(),
        type: 'gif',
        timestamp: Date.now(),
        thumbnail,
        frames,
        gifBlob: dataUrl,
        frameDelay: 100,
        loop: true
      };

      this.snapshots.push(snapshot);
      this._saveToStorage();
      this._renderGallery();
    } catch (error) {
      alert('GIF生成に失敗しました: ' + error.message);
    }
  }

  async _blobToDataURL(blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }

  async _createGIFThumbnail(dataUrl) {
    return dataUrl;
  }

  async _captureSnapshot() {
    const renderTexture = PIXI.RenderTexture.create({
      width: this.app.screen.width,
      height: this.app.screen.height
    });

    this.app.renderer.render({
      container: this.app.stage,
      target: renderTexture
    });

    const canvas = this.app.renderer.extract.canvas(renderTexture);
    const thumbnail = this._createThumbnail(canvas);
    
    renderTexture.destroy(true);

    const cutStates = [];
    if (this.animationSystem && this.animationSystem.animationData) {
      const cuts = this.animationSystem.animationData.cuts || [];
      cuts.forEach((cut, index) => {
        const layerStates = [];
        if (cut.container && cut.container.children) {
          cut.container.children.forEach(layer => {
            if (layer.layerData) {
              const layerState = {
                id: layer.layerData.id,
                name: layer.layerData.name,
                visible: layer.visible,
                opacity: layer.alpha,
                isBackground: layer.layerData.isBackground || false,
                paths: []
              };

              if (!layer.layerData.isBackground && layer.layerData.paths) {
                layerState.paths = layer.layerData.paths.map(p => ({
                  id: p.id,
                  points: structuredClone(p.points),
                  color: p.color,
                  size: p.size,
                  opacity: p.opacity,
                  tool: p.tool
                }));
              }

              layerStates.push(layerState);
            }
          });
        }
        cutStates.push({
          index,
          layerStates
        });
      });
    }

    return {
      id: Date.now(),
      type: 'layered',
      timestamp: Date.now(),
      thumbnail,
      currentCut: this.animationSystem ? this.animationSystem.getCurrentCutIndex() : 0,
      cutStates
    };
  }

  _createThumbnail(source) {
    let canvas;
    if (typeof source === 'string') {
      const img = new Image();
      img.src = source;
      canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth || this.app.screen.width;
      canvas.height = img.naturalHeight || this.app.screen.height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0);
    } else {
      canvas = source;
    }
    
    return canvas.toDataURL('image/png');
  }

  async _loadSnapshot(snapshot) {
    if (snapshot.type === 'gif') {
      await this._loadGIFSnapshot(snapshot);
      return;
    }

    if (!this.animationSystem) return;

    const cuts = this.animationSystem.animationData.cuts;
    
    while (cuts.length < snapshot.cutStates.length) {
      if (this.animationSystem.createNewEmptyCut) {
        this.animationSystem.createNewEmptyCut();
      } else if (this.animationSystem.addCut) {
        this.animationSystem.addCut();
      }
    }

    snapshot.cutStates.forEach((cutState, cutIndex) => {
      if (cutIndex >= cuts.length) return;
      
      const cut = cuts[cutIndex];
      if (!cut.container) return;

      while (cut.container.children.length > 0) {
        const child = cut.container.children[0];
        cut.container.removeChild(child);
        if (child.destroy) child.destroy({ children: true });
      }

      cutState.layerStates.forEach(layerState => {
        const layerContainer = new PIXI.Container();
        layerContainer.visible = layerState.visible !== false;
        layerContainer.alpha = layerState.opacity;
        layerContainer.label = layerState.name;
        
        layerContainer.layerData = {
          id: layerState.id,
          name: layerState.name,
          isBackground: layerState.isBackground || false,
          paths: []
        };

        if (layerState.isBackground) {
          const bg = new PIXI.Graphics();
          const CONFIG = window.TEGAKI_CONFIG;
          bg.rect(0, 0, CONFIG.canvas.width, CONFIG.canvas.height);
          bg.fill(CONFIG.background.color || 0xF0E0D6);
          layerContainer.addChild(bg);
          layerContainer.layerData.backgroundGraphics = bg;
        } else {
          layerState.paths.forEach(pathData => {
            const graphics = new PIXI.Graphics();
            pathData.points.forEach(point => {
              graphics.circle(point.x, point.y, pathData.size / 2);
              graphics.fill({ color: pathData.color, alpha: pathData.opacity });
            });
            
            const path = {
              id: pathData.id,
              graphics,
              points: pathData.points,
              color: pathData.color,
              size: pathData.size,
              opacity: pathData.opacity,
              tool: pathData.tool,
              isComplete: true
            };
            
            layerContainer.layerData.paths.push(path);
            layerContainer.addChild(graphics);
          });
        }

        cut.container.addChild(layerContainer);
      });

      if (this.animationSystem.generateCutThumbnail) {
        setTimeout(() => {
          this.animationSystem.generateCutThumbnail(cutIndex);
        }, 50 + cutIndex * 20);
      }
    });

    if (this.animationSystem.setCutIndex) {
      this.animationSystem.setCutIndex(snapshot.currentCut);
    }

    setTimeout(() => {
      if (this.layerSystem && this.layerSystem.updateLayerPanelUI) {
        this.layerSystem.updateLayerPanelUI();
      }
    }, 200);

    this.hide();
  }

  async _loadGIFSnapshot(snapshot) {
    if (!this.animationSystem) return;

    const cuts = this.animationSystem.animationData.cuts;
    
    while (cuts.length < snapshot.frames.length) {
      if (this.animationSystem.createNewEmptyCut) {
        this.animationSystem.createNewEmptyCut();
      } else if (this.animationSystem.addCut) {
        this.animationSystem.addCut();
      }
    }

    for (let i = 0; i < snapshot.frames.length; i++) {
      if (i >= cuts.length) break;
      
      const cut = cuts[i];
      if (!cut.container) continue;

      while (cut.container.children.length > 0) {
        const child = cut.container.children[0];
        cut.container.removeChild(child);
        if (child.destroy) child.destroy({ children: true });
      }

      const img = new Image();
      await new Promise(resolve => {
        img.onload = resolve;
        img.src = snapshot.frames[i];
      });

      const texture = PIXI.Texture.from(img);
      const sprite = new PIXI.Sprite(texture);

      const layerContainer = new PIXI.Container();
      layerContainer.label = 'GIFレイヤー';
      layerContainer.addChild(sprite);
      
      layerContainer.layerData = {
        id: Date.now() + i,
        name: 'GIFレイヤー',
        isBackground: false,
        paths: []
      };

      cut.container.addChild(layerContainer);

      if (this.animationSystem.generateCutThumbnail) {
        setTimeout(() => {
          this.animationSystem.generateCutThumbnail(i);
        }, 50 + i * 20);
      }
    }

    if (this.animationSystem.setCutIndex) {
      this.animationSystem.setCutIndex(0);
    }

    setTimeout(() => {
      if (this.layerSystem && this.layerSystem.updateLayerPanelUI) {
        this.layerSystem.updateLayerPanelUI();
      }
    }, 200);

    this.hide();
  }

  _fitImageToContainer(img, containerW, containerH) {
    const iw = img.naturalWidth || img.width || 1;
    const ih = img.naturalHeight || img.height || 1;
    const imgAspect = iw / ih;
    const containerAspect = containerW / containerH;
    
    if (imgAspect >= containerAspect) {
      img.style.width = '100%';
      img.style.height = 'auto';
    } else {
      img.style.width = 'auto';
      img.style.height = '100%';
    }
  }

  _renderGallery() {
    const gallery = document.getElementById('albumGallery');
    if (!gallery) return;

    if (this.previewIntervals && this.previewIntervals.size > 0) {
      for (const imgEl of Array.from(this.previewIntervals.keys())) {
        if (!document.body.contains(imgEl)) {
          clearInterval(this.previewIntervals.get(imgEl));
          this.previewIntervals.delete(imgEl);
        }
      }
    }

    gallery.innerHTML = '';

    this.snapshots.forEach(snapshot => {
      const card = document.createElement('div');
      card.style.cssText = `
        background: #ffffee;
        border: 1px solid var(--futaba-light-medium);
        border-radius: 6px;
        overflow: hidden;
        transition: all 0.2s;
        width: 130px;
        height: 130px;
        display: flex;
        flex-direction: column;
      `;
      
      const thumbnailContainer = document.createElement('div');
      thumbnailContainer.style.cssText = `
        width: 130px;
        height: 98px;
        display: flex;
        align-items: center;
        justify-content: center;
        overflow: hidden;
        background: #ffffee;
        flex-shrink: 0;
      `;

      const img = document.createElement('img');
      img.src = snapshot.thumbnail;
      img.style.cssText = `
        display: block;
        max-width: 100%;
        max-height: 100%;
        cursor: pointer;
      `;
      
      img.onload = () => {
        this._fitImageToContainer(img, 130, 98);
      };
      
      img.onclick = (e) => {
        e.stopPropagation();
        this._loadSnapshot(snapshot);
      };

      thumbnailContainer.appendChild(img);

      const actions = document.createElement('div');
      actions.style.cssText = `
        height: 32px;
        padding: 4px;
        display: flex;
        gap: 4px;
        border-top: 1px solid var(--futaba-light-medium);
        align-items: center;
        flex-shrink: 0;
      `;

      if (snapshot.type === 'gif') {
        card.onmouseenter = () => {
          card.style.transform = 'translateY(-2px)';
          card.style.borderColor = 'var(--futaba-maroon)';
          card.style.boxShadow = '0 4px 8px rgba(128, 0, 0, 0.2)';
          this._startGIFPreview(snapshot, img);
        };
        card.onmouseleave = () => {
          card.style.transform = 'translateY(0)';
          card.style.borderColor = 'var(--futaba-light-medium)';
          card.style.boxShadow = 'none';
          this._stopGIFPreview(snapshot, img);
        };
      } else {
        card.onmouseenter = () => {
          card.style.transform = 'translateY(-2px)';
          card.style.borderColor = 'var(--futaba-maroon)';
          card.style.boxShadow = '0 4px 8px rgba(128, 0, 0, 0.2)';
        };
        card.onmouseleave = () => {
          card.style.transform = 'translateY(0)';
          card.style.borderColor = 'var(--futaba-light-medium)';
          card.style.boxShadow = 'none';
        };
      }

      const downloadBtn = this._createIconButton(
        '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>',
        'var(--futaba-maroon)',
        () => snapshot.type === 'gif' ? this._downloadAsGIF(snapshot) : this._downloadAsPNG(snapshot)
      );
      
      const delBtn = this._createIconButton(
        '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#800000" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M10 11v6"/><path d="M14 11v6"/></svg>',
        '#800000',
        () => this._deleteSnapshot(snapshot.id)
      );

      actions.appendChild(downloadBtn);
      actions.appendChild(delBtn);

      card.appendChild(thumbnailContainer);
      card.appendChild(actions);
      gallery.appendChild(card);
    });
  }

  _createCompactButton(text, color, onClick) {
    const btn = document.createElement('button');
    btn.textContent = text;
    btn.style.cssText = `
      flex: 1;
      background: var(--futaba-background);
      border: 1px solid var(--futaba-light-medium);
      color: ${color};
      padding: 4px 6px;
      cursor: pointer;
      border-radius: 4px;
      font-size: 11px;
      font-weight: 600;
      transition: all 0.2s;
      height: 24px;
      white-space: nowrap;
    `;
    btn.onmouseenter = () => {
      btn.style.background = color;
      btn.style.color = 'var(--text-inverse)';
      btn.style.borderColor = color;
    };
    btn.onmouseleave = () => {
      btn.style.background = 'var(--futaba-background)';
      btn.style.color = color;
      btn.style.borderColor = 'var(--futaba-light-medium)';
    };
    btn.onclick = (e) => {
      e.stopPropagation();
      onClick();
    };
    return btn;
  }

  _createIconButton(svgContent, color, onClick) {
    const btn = document.createElement('button');
    btn.innerHTML = svgContent;
    btn.style.cssText = `
      background: var(--futaba-background);
      border: 1px solid var(--futaba-light-medium);
      color: ${color};
      padding: 4px;
      cursor: pointer;
      border-radius: 4px;
      transition: all 0.2s;
      width: 28px;
      height: 24px;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    `;
    
    const hoverColor = color === '#800000' ? '#d32f2f' : color;
    
    btn.onmouseenter = () => {
      btn.style.background = hoverColor;
      btn.style.borderColor = hoverColor;
      const svg = btn.querySelector('svg');
      if (svg) svg.setAttribute('stroke', 'white');
    };
    btn.onmouseleave = () => {
      btn.style.background = 'var(--futaba-background)';
      btn.style.borderColor = 'var(--futaba-light-medium)';
      const svg = btn.querySelector('svg');
      if (svg) svg.setAttribute('stroke', color);
    };
    btn.onclick = (e) => {
      e.stopPropagation();
      onClick();
    };
    return btn;
  }

  _startGIFPreview(snapshot, imgElement) {
    if (snapshot.type !== 'gif' || !snapshot.frames) return;
    
    this._stopGIFPreview(snapshot, imgElement);

    let frameIndex = 0;
    const intervalId = setInterval(() => {
      frameIndex = (frameIndex + 1) % snapshot.frames.length;
      imgElement.src = snapshot.frames[frameIndex];
    }, snapshot.frameDelay || 100);
    
    this.previewIntervals.set(imgElement, intervalId);
  }

  _stopGIFPreview(snapshot, imgElement) {
    const intervalId = this.previewIntervals.get(imgElement);
    if (intervalId) {
      clearInterval(intervalId);
      this.previewIntervals.delete(imgElement);
    }
    imgElement.src = snapshot.thumbnail;
  }

  _downloadAsPNG(snapshot) {
    const link = document.createElement('a');
    link.download = `snapshot_${snapshot.id}.png`;
    link.href = snapshot.thumbnail;
    link.click();
  }

  async _downloadAsGIF(snapshot) {
    if (!snapshot.gifBlob) {
      alert('GIFデータが見つかりません');
      return;
    }

    const link = document.createElement('a');
    link.download = `animation_${snapshot.id}.gif`;
    link.href = snapshot.gifBlob;
    link.click();
  }

  _deleteSnapshot(id) {
    this.snapshots = this.snapshots.filter(s => s.id !== id);
    this._saveToStorage();
    this._renderGallery();
  }

  _saveToStorage() {
    const data = this.snapshots.map(s => ({
      id: s.id,
      type: s.type || 'layered',
      timestamp: s.timestamp,
      thumbnail: s.thumbnail,
      currentCut: s.currentCut,
      cutStates: s.cutStates,
      frames: s.frames,
      gifBlob: s.gifBlob,
      frameDelay: s.frameDelay,
      loop: s.loop
    }));
    localStorage.setItem('tegaki_album', JSON.stringify(data));
  }

  _loadSnapshots() {
    const stored = localStorage.getItem('tegaki_album');
    if (stored) {
      try {
        this.snapshots = JSON.parse(stored);
        this.snapshots.forEach(s => {
          if (!s.type) s.type = 'layered';
        });
      } catch (e) {
        this.snapshots = [];
      }
    }
    this._renderGallery();
  }
}

window.AlbumPopup = AlbumPopup;