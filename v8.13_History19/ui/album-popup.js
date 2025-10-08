/**
 * アルバムポップアップ
 * スナップショット保存・読み込み機能（シンプル版）
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
  }

  show() {
    if (this.isOpen) return;
    
    this._createPopup();
    this._loadSnapshots();
    this.isOpen = true;
  }

  hide() {
    if (!this.isOpen) return;
    
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

    const header = document.createElement('div');
    header.style.cssText = `
      padding: 16px 20px;
      border-bottom: 2px solid var(--futaba-light-medium);
      display: flex;
      justify-content: space-between;
      align-items: center;
    `;
    header.innerHTML = `
      <span style="font-size: 16px; font-weight: bold; color: var(--futaba-maroon);">アルバム</span>
    `;

    const controls = document.createElement('div');
    controls.style.cssText = `
      padding: 16px 20px;
      border-bottom: 2px solid var(--futaba-light-medium);
      display: flex;
      gap: 12px;
    `;
    controls.innerHTML = `
      <button id="albumSave" style="padding: 8px 20px; border: 2px solid var(--futaba-maroon); border-radius: 8px; background: var(--futaba-background); color: var(--futaba-maroon); font-weight: 600; cursor: pointer; transition: all 0.2s; font-size: 14px;">現在の状態を保存</button>
    `;

    const gallery = document.createElement('div');
    gallery.id = 'albumGallery';
    gallery.style.cssText = `
      flex: 1;
      overflow-y: auto;
      padding: 20px;
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
      gap: 16px;
      align-content: start;
    `;

    this.popup.appendChild(header);
    this.popup.appendChild(controls);
    this.popup.appendChild(gallery);
    this.overlay.appendChild(this.popup);
    document.body.appendChild(this.overlay);

    // DOM追加後にイベントリスナー設定
    const saveBtn = document.getElementById('albumSave');
    if (saveBtn) {
      saveBtn.onclick = () => this._saveSnapshot();
      saveBtn.onmouseenter = () => {
        saveBtn.style.background = 'var(--futaba-maroon)';
        saveBtn.style.color = 'var(--text-inverse)';
      };
      saveBtn.onmouseleave = () => {
        saveBtn.style.background = 'var(--futaba-background)';
        saveBtn.style.color = 'var(--futaba-maroon)';
      };
    }
    
    // 画面外クリックで閉じる
    this.overlay.onclick = (e) => {
      if (e.target === this.overlay) {
        this.hide();
      }
    };
    
    // ポップアップ内クリックは伝播を止める
    this.popup.onclick = (e) => {
      e.stopPropagation();
    };
  }

  async _saveSnapshot() {
    const snapshot = await this._captureSnapshot();
    this.snapshots.push(snapshot);
    this._saveToStorage();
    this._renderGallery();
    
    // 保存後もポップアップを閉じない
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
    const thumbnail = canvas.toDataURL('image/png');
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

              // 背景レイヤー以外のパスデータを保存
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
      timestamp: Date.now(),
      thumbnail,
      currentCut: this.animationSystem ? this.animationSystem.getCurrentCutIndex() : 0,
      cutStates
    };
  }

  async _loadSnapshot(snapshot) {
    if (!this.animationSystem) return;

    const cuts = this.animationSystem.animationData.cuts;
    
    // 必要なCUT数まで追加（正しいメソッド名を使用）
    while (cuts.length < snapshot.cutStates.length) {
      if (this.animationSystem.createNewEmptyCut) {
        this.animationSystem.createNewEmptyCut();
      } else if (this.animationSystem.addCut) {
        this.animationSystem.addCut();
      }
    }

    // 各CUTのレイヤーを復元
    snapshot.cutStates.forEach((cutState, cutIndex) => {
      if (cutIndex >= cuts.length) return;
      
      const cut = cuts[cutIndex];
      if (!cut.container) return;

      // 既存レイヤーをクリア
      while (cut.container.children.length > 0) {
        const child = cut.container.children[0];
        cut.container.removeChild(child);
        if (child.destroy) child.destroy({ children: true });
      }

      // レイヤーを復元
      cutState.layerStates.forEach(layerState => {
        const layerContainer = new PIXI.Container();
        layerContainer.visible = layerState.visible;
        layerContainer.alpha = layerState.opacity;
        layerContainer.label = layerState.name;
        
        layerContainer.layerData = {
          id: layerState.id,
          name: layerState.name,
          isBackground: layerState.isBackground || false,
          paths: []
        };

        // 背景レイヤーの場合
        if (layerState.isBackground) {
          const bg = new PIXI.Graphics();
          const CONFIG = window.TEGAKI_CONFIG;
          bg.rect(0, 0, CONFIG.canvas.width, CONFIG.canvas.height);
          bg.fill(CONFIG.background.color || 0xF0E0D6);
          layerContainer.addChild(bg);
          layerContainer.layerData.backgroundGraphics = bg;
        } else {
          // 通常レイヤー：パスを復元
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

    // 指定CUTに切り替え
    if (this.animationSystem.setCutIndex) {
      this.animationSystem.setCutIndex(snapshot.currentCut);
    }

    // レイヤーパネル更新（visibleを正しく反映）
    if (this.layerSystem && this.layerSystem.updateLayerPanelUI) {
      setTimeout(() => {
        this.layerSystem.updateLayerPanelUI();
        
        // 可視性アイコンを強制更新
        const layers = this.layerSystem.getLayers();
        layers.forEach((layer, index) => {
          const layerElement = document.querySelector(`[data-layer-index="${index}"]`);
          if (layerElement) {
            const visIcon = layerElement.querySelector('.layer-visibility svg');
            if (visIcon) {
              if (layer.visible) {
                visIcon.innerHTML = '<path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/>';
              } else {
                visIcon.innerHTML = '<path d="m2 2 20 20"/><path d="M6.71 6.71a10 10 0 0 0-3.71 5.29 10 10 0 0 0 3.71 5.29"/><path d="M14 14.12A3 3 0 0 1 9.88 10"/><path d="M17.29 17.29a10 10 0 0 0 3.71-5.29 10 10 0 0 0-3.71-5.29"/>';
              }
            }
          }
        });
      }, 100);
    }

    this.hide();
  }

  async _exportAsGIF(snapshot) {
    alert('GIF出力機能は準備中です');
  }

  _renderGallery() {
    const gallery = document.getElementById('albumGallery');
    if (!gallery) return;

    gallery.innerHTML = '';

    this.snapshots.forEach(snapshot => {
      const card = document.createElement('div');
      card.style.cssText = `
        background: var(--futaba-background);
        border: 2px solid var(--futaba-light-medium);
        border-radius: 8px;
        overflow: hidden;
        cursor: pointer;
        transition: all 0.2s;
      `;
      card.onmouseenter = () => {
        card.style.transform = 'translateY(-4px)';
        card.style.borderColor = 'var(--futaba-maroon)';
        card.style.boxShadow = '0 8px 16px rgba(128, 0, 0, 0.2)';
      };
      card.onmouseleave = () => {
        card.style.transform = 'translateY(0)';
        card.style.borderColor = 'var(--futaba-light-medium)';
        card.style.boxShadow = 'none';
      };

      const img = document.createElement('img');
      img.src = snapshot.thumbnail;
      img.style.cssText = `
        width: 100%;
        height: 160px;
        object-fit: cover;
        display: block;
        background: var(--light-medium);
      `;

      const info = document.createElement('div');
      info.style.cssText = `
        padding: 10px 12px;
        font-size: 11px;
        color: var(--text-secondary);
        border-top: 1px solid var(--futaba-light-medium);
        font-family: monospace;
      `;
      const date = new Date(snapshot.timestamp);
      info.textContent = `${date.toLocaleDateString()} ${date.toLocaleTimeString()}`;

      const actions = document.createElement('div');
      actions.style.cssText = `
        padding: 8px 12px 12px;
        display: flex;
        gap: 6px;
      `;

      const loadBtn = document.createElement('button');
      loadBtn.textContent = '読込';
      loadBtn.style.cssText = `
        flex: 1;
        background: var(--futaba-background);
        border: 2px solid var(--futaba-maroon);
        color: var(--futaba-maroon);
        padding: 6px;
        cursor: pointer;
        border-radius: 6px;
        font-size: 12px;
        font-weight: 600;
        transition: all 0.2s;
      `;
      loadBtn.onmouseenter = () => {
        loadBtn.style.background = 'var(--futaba-maroon)';
        loadBtn.style.color = 'var(--text-inverse)';
      };
      loadBtn.onmouseleave = () => {
        loadBtn.style.background = 'var(--futaba-background)';
        loadBtn.style.color = 'var(--futaba-maroon)';
      };
      loadBtn.onclick = (e) => {
        e.stopPropagation();
        this._loadSnapshot(snapshot);
      };

      const gifBtn = document.createElement('button');
      gifBtn.textContent = 'GIF';
      gifBtn.style.cssText = `
        flex: 1;
        background: var(--futaba-background);
        border: 2px solid var(--futaba-light-medium);
        color: var(--text-secondary);
        padding: 6px;
        cursor: pointer;
        border-radius: 6px;
        font-size: 12px;
        font-weight: 600;
        transition: all 0.2s;
      `;
      gifBtn.onmouseenter = () => {
        gifBtn.style.borderColor = 'var(--futaba-maroon)';
      };
      gifBtn.onmouseleave = () => {
        gifBtn.style.borderColor = 'var(--futaba-light-medium)';
      };
      gifBtn.onclick = (e) => {
        e.stopPropagation();
        this._exportAsGIF(snapshot);
      };

      const delBtn = document.createElement('button');
      delBtn.textContent = '削除';
      delBtn.style.cssText = `
        background: var(--futaba-background);
        border: 2px solid var(--futaba-light-medium);
        color: var(--text-secondary);
        padding: 6px 10px;
        cursor: pointer;
        border-radius: 6px;
        font-size: 12px;
        font-weight: 600;
        transition: all 0.2s;
      `;
      delBtn.onmouseenter = () => {
        delBtn.style.borderColor = 'var(--futaba-light-maroon)';
        delBtn.style.color = 'var(--futaba-light-maroon)';
      };
      delBtn.onmouseleave = () => {
        delBtn.style.borderColor = 'var(--futaba-light-medium)';
        delBtn.style.color = 'var(--text-secondary)';
      };
      delBtn.onclick = (e) => {
        e.stopPropagation();
        this._deleteSnapshot(snapshot.id);
      };

      actions.appendChild(loadBtn);
      actions.appendChild(gifBtn);
      actions.appendChild(delBtn);

      card.appendChild(img);
      card.appendChild(info);
      card.appendChild(actions);
      gallery.appendChild(card);

      card.onmouseenter = () => this._startPreview(snapshot, img);
      card.onmouseleave = () => this._stopPreview(img, snapshot);
    });
  }

  _startPreview(snapshot, imgElement) {
    // 簡易プレビュー（将来的に実装）
  }

  _stopPreview(imgElement, snapshot) {
    imgElement.src = snapshot.thumbnail;
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
      layers: s.layers,
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

// グローバルに登録
window.AlbumPopup = AlbumPopup;
console.log('✅ album-popup.js loaded - AlbumPopup class registered');