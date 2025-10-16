/**
 * アルバムポップアップ
 * 通常スナップショット（レイヤー保持）専用
 * カメラフレーム内のみキャプチャ
 * 🔥 Phase1: isOpen → isVisible に統一
 */

class AlbumPopup {
  constructor(app, layerSystem, animationSystem) {
    this.app = app;
    this.layerSystem = layerSystem;
    this.animationSystem = animationSystem;
    
    this.overlay = null;
    this.popup = null;
    this.isVisible = false; // 🔥 isOpen から isVisible に変更
    this.snapshots = [];
  }

  show() {
    if (this.isVisible) return; // 🔥 isOpen → isVisible
    
    this._createPopup();
    this._loadSnapshots();
    this.isVisible = true; // 🔥 isOpen → isVisible
  }

  hide() {
    if (!this.isVisible) return; // 🔥 isOpen → isVisible
    
    if (this.overlay) {
      this.overlay.remove();
      this.overlay = null;
    }
    this.popup = null;
    this.isVisible = false; // 🔥 isOpen → isVisible
  }

  // 🆕 toggle()メソッド追加
  toggle() {
    if (this.isVisible) {
      this.hide();
    } else {
      this.show();
    }
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
    `;

    const gallery = document.createElement('div');
    gallery.id = 'albumGallery';
    gallery.style.cssText = `
      flex: 1;
      overflow-y: scroll;
      overflow-x: hidden;
      padding: 16px;
      display: grid;
      grid-template-columns: repeat(auto-fill, 130px);
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
    if (snapshot && snapshot.thumbnail) {
      this.snapshots.push(snapshot);
      this._saveToStorage();
      this._renderGallery();
    }
  }

  async _captureSnapshot() {
    // AnimationSystemから現在のカットコンテナを取得
    if (!this.animationSystem || !this.animationSystem.animationData) {
      alert('アニメーションシステムが初期化されていません');
      return null;
    }

    const currentCutIndex = this.animationSystem.getCurrentCutIndex();
    const cuts = this.animationSystem.animationData.cuts || [];
    const currentCut = cuts[currentCutIndex];
    
    if (!currentCut || !currentCut.container) {
      alert('現在のカットが見つかりません');
      return null;
    }

    const CONFIG = window.TEGAKI_CONFIG;
    
    // カットコンテナ全体をレンダリング（背景レイヤー含む）
    const renderTexture = PIXI.RenderTexture.create({
      width: CONFIG.canvas.width,
      height: CONFIG.canvas.height
    });

    this.app.renderer.render({
      container: currentCut.container,
      target: renderTexture
    });

    const canvas = this.app.renderer.extract.canvas(renderTexture);
    const thumbnail = canvas.toDataURL('image/png');
    
    renderTexture.destroy(true);

    // レイヤー情報の保存（背景レイヤー含む）
    const cutStates = [];
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

            // 背景レイヤーの情報も保存
            if (layer.layerData.isBackground) {
              layerState.backgroundColor = CONFIG.background.color || 0xF0E0D6;
            } else if (layer.layerData.paths) {
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

    return {
      id: Date.now(),
      timestamp: Date.now(),
      thumbnail,
      currentCut: currentCutIndex,
      cutStates
    };
  }

  async _loadSnapshot(snapshot) {
    if (!this.animationSystem) return;

    const cuts = this.animationSystem.animationData.cuts;
    
    // 必要なカット数を確保
    while (cuts.length < snapshot.cutStates.length) {
      if (this.animationSystem.createNewEmptyCut) {
        this.animationSystem.createNewEmptyCut();
      } else if (this.animationSystem.addCut) {
        this.animationSystem.addCut();
      }
    }

    // 各カットのレイヤーを復元
    snapshot.cutStates.forEach((cutState, cutIndex) => {
      if (cutIndex >= cuts.length) return;
      
      const cut = cuts[cutIndex];
      if (!cut.container) return;

      // 既存のレイヤーをすべて削除
      while (cut.container.children.length > 0) {
        const child = cut.container.children[0];
        cut.container.removeChild(child);
        if (child.destroy) child.destroy({ children: true });
      }

      // レイヤーを復元
      cutState.layerStates.forEach(layerState => {
        const layerContainer = new PIXI.Container();
        layerContainer.label = layerState.name;
        
        // 表示状態を正しく設定
        const isVisible = layerState.visible !== false;
        layerContainer.visible = isVisible;
        layerContainer.alpha = layerState.opacity;
        
        layerContainer.layerData = {
          id: layerState.id,
          name: layerState.name,
          visible: isVisible, // layerDataにも明示的に設定
          opacity: layerState.opacity,
          isBackground: layerState.isBackground || false,
          paths: []
        };

        if (layerState.isBackground) {
          // 背景レイヤーを復元
          const bg = new PIXI.Graphics();
          const CONFIG = window.TEGAKI_CONFIG;
          const bgColor = layerState.backgroundColor || CONFIG.background.color || 0xF0E0D6;
          bg.rect(0, 0, CONFIG.canvas.width, CONFIG.canvas.height);
          bg.fill(bgColor);
          layerContainer.addChild(bg);
          layerContainer.layerData.backgroundGraphics = bg;
        } else {
          // 通常レイヤーのパスを復元
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

      // サムネイル更新
      if (this.animationSystem.generateCutThumbnail) {
        setTimeout(() => {
          this.animationSystem.generateCutThumbnail(cutIndex);
        }, 50 + cutIndex * 20);
      }
    });

    // カット切り替え
    if (this.animationSystem.setCutIndex) {
      this.animationSystem.setCutIndex(snapshot.currentCut);
    }

    // レイヤーパネル更新
    setTimeout(() => {
      if (this.layerSystem && this.layerSystem.updateLayerPanelUI) {
        this.layerSystem.updateLayerPanelUI();
      }
    }, 200);

    this.hide();
  }

  _renderGallery() {
    const gallery = document.getElementById('albumGallery');
    if (!gallery) return;

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
        width: 100%;
        height: 100%;
        object-fit: contain;
        cursor: pointer;
      `;
      
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

      const downloadBtn = this._createIconButton(
        '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>',
        'var(--futaba-maroon)',
        () => this._downloadAsPNG(snapshot)
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

  _downloadAsPNG(snapshot) {
    const link = document.createElement('a');
    link.download = `snapshot_${snapshot.id}.png`;
    link.href = snapshot.thumbnail;
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
      timestamp: s.timestamp,
      thumbnail: s.thumbnail,
      currentCut: s.currentCut,
      cutStates: s.cutStates
    }));
    localStorage.setItem('tegaki_album', JSON.stringify(data));
  }

  _loadSnapshots() {
    const stored = localStorage.getItem('tegaki_album');
    if (stored) {
      try {
        this.snapshots = JSON.parse(stored);
      } catch (e) {
        this.snapshots = [];
      }
    }
    this._renderGallery();
  }
}

window.AlbumPopup = AlbumPopup;

console.log('✅ album-popup.js (Phase1: isVisible統一版) loaded');