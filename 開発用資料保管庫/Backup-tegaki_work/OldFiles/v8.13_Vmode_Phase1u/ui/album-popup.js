// ===== album-popup.js - PopupManager対応改修版 + display修正 =====
// 責務: アルバムUI表示・スナップショット管理
// 🔥 改修: PopupManager統合、共通インターフェース適用、初期状態の明確化
// 🔧 修正: display:flex が常に表示される問題を解決

window.TegakiUI = window.TegakiUI || {};

window.TegakiUI.AlbumPopup = class {
    constructor(dependencies) {
        this.app = dependencies.app;
        this.layerSystem = dependencies.layerSystem;
        this.animationSystem = dependencies.animationSystem;
        
        this.popup = null;
        this.isVisible = false;
        this.snapshots = [];
        
        this._loadSnapshots();
        this._ensurePopupElement();
    }

    _ensurePopupElement() {
        this.popup = document.getElementById('album-popup');
        
        if (!this.popup) {
            this._createPopupElement();
        } else {
            // 既存要素の初期化（初期状態は非表示）
            this.popup.classList.remove('show');
            this.popup.style.display = 'none';
        }
    }

    _createPopupElement() {
        const container = document.querySelector('.canvas-area');
        if (!container) return;
        
        const popupDiv = document.createElement('div');
        popupDiv.id = 'album-popup';
        popupDiv.className = 'popup-panel';
        popupDiv.style.top = '60px';
        popupDiv.style.left = '60px';
        popupDiv.style.width = '80%';
        popupDiv.style.maxWidth = '900px';
        popupDiv.style.height = '80vh';
        popupDiv.style.maxHeight = '700px';
        popupDiv.style.flexDirection = 'column';
        // 🔧 修正: display: flex を削除し、初期状態を none に
        popupDiv.style.display = 'none';
        
        popupDiv.innerHTML = `
            <div class="popup-title" style="font-size: 16px; font-weight: 600; color: var(--futaba-maroon); margin-bottom: 16px; text-align: center; flex-shrink: 0;">
                アルバム
            </div>
            
            <div style="padding: 0 0 16px 0; border-bottom: 2px solid var(--futaba-light-medium); display: flex; gap: 12px; flex-shrink: 0;">
                <button id="albumSave" style="padding: 8px 20px; border: 2px solid var(--futaba-maroon); border-radius: 8px; background: var(--futaba-background); color: var(--futaba-maroon); font-weight: 600; cursor: pointer; transition: all 0.2s; font-size: 14px;">現在の状態を保存</button>
            </div>
            
            <div id="albumGallery" style="flex: 1; overflow-y: auto; overflow-x: hidden; padding: 16px 0; display: grid; grid-template-columns: repeat(auto-fill, 130px); gap: 12px; align-content: start; justify-content: start;"></div>
        `;
        
        container.appendChild(popupDiv);
        this.popup = popupDiv;
        
        const saveBtn = document.getElementById('albumSave');
        if (saveBtn) {
            saveBtn.onclick = () => this._saveSnapshot();
            this._setupButtonHover(saveBtn);
        }
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
        if (snapshot?.thumbnail) {
            this.snapshots.push(snapshot);
            this._saveToStorage();
            this._renderGallery();
        }
    }

    async _captureSnapshot() {
        if (!this.animationSystem?.animationData) {
            alert('アニメーションシステムが初期化されていません');
            return null;
        }

        const currentCutIndex = this.animationSystem.getCurrentCutIndex();
        const cuts = this.animationSystem.animationData.cuts || [];
        const currentCut = cuts[currentCutIndex];
        
        if (!currentCut?.container) {
            alert('現在のカットが見つかりません');
            return null;
        }

        const CONFIG = window.TEGAKI_CONFIG;
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

        const cutStates = [];
        cuts.forEach((cut, index) => {
            const layerStates = [];
            if (cut.container?.children) {
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

                        if (layerState.isBackground) {
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
            cutStates.push({ index, layerStates });
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
                layerContainer.label = layerState.name;
                
                const isVisible = layerState.visible !== false;
                layerContainer.visible = isVisible;
                layerContainer.alpha = layerState.opacity;
                
                layerContainer.layerData = {
                    id: layerState.id,
                    name: layerState.name,
                    visible: isVisible,
                    opacity: layerState.opacity,
                    isBackground: layerState.isBackground || false,
                    paths: []
                };

                if (layerState.isBackground) {
                    const bg = new PIXI.Graphics();
                    const CONFIG = window.TEGAKI_CONFIG;
                    const bgColor = layerState.backgroundColor || CONFIG.background.color || 0xF0E0D6;
                    bg.rect(0, 0, CONFIG.canvas.width, CONFIG.canvas.height);
                    bg.fill(bgColor);
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
            if (this.layerSystem?.updateLayerPanelUI) {
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
    }

    // ===== 必須インターフェース =====
    
    show() {
        if (!this.popup) {
            this._ensurePopupElement();
        }
        
        if (!this.popup) return;
        
        // 🔧 修正: display を flex に設定してから show クラスを追加
        this.popup.style.display = 'flex';
        this.popup.classList.add('show');
        this.isVisible = true;
        this._renderGallery();
    }

    hide() {
        if (!this.popup) return;
        
        this.popup.classList.remove('show');
        // 🔧 修正: display を none に設定
        this.popup.style.display = 'none';
        this.isVisible = false;
    }

    toggle() {
        if (this.isVisible) {
            this.hide();
        } else {
            this.show();
        }
    }
    
    isReady() {
        return !!this.popup && !!this.animationSystem;
    }
    
    destroy() {
        // cleanup if needed
    }
};

// グローバル公開
window.AlbumPopup = window.TegakiUI.AlbumPopup;

console.log('✅ album-popup.js (PopupManager対応版 + display修正) loaded');