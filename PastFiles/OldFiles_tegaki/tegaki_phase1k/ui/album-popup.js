/**
 * ============================================================================
 * ファイル名: ui/album-popup.js
 * 責務: 作品のスナップショット（アルバム）の保存、表示、復元UIを提供する
 * 依存: pixi.js, system/event-bus.js, system/animation-system.js
 * 被依存: core-engine.js, system/popup-manager.js
 * 公開API: AlbumPopup
 * イベント発火: なし
 * イベント受信: なし
 * グローバル登録: window.AlbumPopup, window.TegakiUI.AlbumPopup
 * 実装状態: ♻️移植
 * ============================================================================
 */

import { Container, Graphics, RenderTexture } from 'pixi.js';

import { UI_ICONS } from './ui-icons.js';

export class AlbumPopup {
    constructor(dependencies = {}) {
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
            this.popup.classList.remove('show');
            this.popup.style.display = 'none';
        }
    }

    _createPopupElement() {
        const container = document.querySelector('.canvas-area') || document.body;
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
        const projectData = await window.projectManager?.exportProject?.();
        const thumbnail = await this._captureCurrentThumbnail();
        if (!thumbnail) {
            alert('現在の状態を保存できませんでした');
            return null;
        }
        return {
            id: Date.now(),
            timestamp: Date.now(),
            thumbnail,
            currentFrame: this.animationSystem?.getCurrentFrameIndex?.() ?? null,
            frameStates: [],
            projectData: projectData || null
        };
    }

    async _loadSnapshot(snapshot) {
        if (snapshot?.projectData && window.projectManager?.loadProject) {
            await window.projectManager.loadProject(snapshot.projectData);
            this.hide();
            return;
        }

        if (!this.animationSystem) return;

        const frames = this.animationSystem.animationData.frames;
        
        while (frames.length < snapshot.frameStates.length) {
            if (this.animationSystem.createNewEmptyFrame) {
                this.animationSystem.createNewEmptyFrame();
            }
        }

        snapshot.frameStates.forEach((frameState, frameIndex) => {
            if (frameIndex >= frames.length) return;
            
            const frame = frames[frameIndex];
            if (!frame.container) return;

            while (frame.container.children.length > 0) {
                const child = frame.container.children[0];
                frame.container.removeChild(child);
                if (child.destroy) child.destroy({ children: true });
            }

            frameState.layerStates.forEach(layerState => {
                const layerContainer = new Container();
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
                    const bg = new Graphics();
                    const CONFIG = window.TEGAKI_CONFIG;
                    const bgColor = layerState.backgroundColor || CONFIG.background.color || 0xF0E0D6;
                    bg.rect(0, 0, CONFIG.canvas.width, CONFIG.canvas.height);
                    bg.fill(bgColor);
                    layerContainer.addChild(bg);
                    layerContainer.layerData.backgroundGraphics = bg;
                } else {
                    layerState.paths.forEach(pathData => {
                        const graphics = new Graphics();
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

                frame.container.addChild(layerContainer);
            });

            if (this.animationSystem.generateFrameThumbnail) {
                setTimeout(() => {
                    this.animationSystem.generateFrameThumbnail(frameIndex);
                }, 50 + frameIndex * 20);
            }
        });

        if (this.animationSystem.switchToActiveFrame) {
            this.animationSystem.switchToActiveFrame(snapshot.currentFrame);
        }

        this.hide();
    }

    async _captureCurrentThumbnail() {
        try {
            const result = await window.exportManager?.generatePreview?.('png', {
                resolution: 1,
                transparent: false
            });
            const blob = result?.blob || result;
            if (blob instanceof Blob) {
                return await this._blobToDataURL(blob);
            }
        } catch (error) {
            console.warn('[AlbumPopup] export preview capture failed, falling back to renderer extract:', error);
        }

        const target = this.layerSystem?.currentFrameContainer;
        if (!this.app?.renderer || !target) return null;

        const canvas = this.app.renderer.extract.canvas({
            target,
            clearColor: '#00000000'
        });
        return canvas?.toDataURL?.('image/png') || null;
    }

    _blobToDataURL(blob) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
        });
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
                UI_ICONS.download,
                'var(--futaba-maroon)',
                () => this._downloadAsPNG(snapshot)
            );
            
            const delBtn = this._createIconButton(
                UI_ICONS.trash,
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
            currentFrame: s.currentFrame,
            frameStates: s.frameStates,
            projectData: s.projectData || null
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

    show() {
        if (!this.popup) {
            this._ensurePopupElement();
        }
        
        if (!this.popup) return;
        
        this.popup.style.display = 'flex';
        this.popup.classList.add('show');
        this.isVisible = true;
        this._renderGallery();
    }

    hide() {
        if (!this.popup) return;
        
        this.popup.classList.remove('show');
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
}

// 下位互換性のためにグローバルに登録
window.AlbumPopup = AlbumPopup;
window.TegakiUI = window.TegakiUI || {};
window.TegakiUI.AlbumPopup = AlbumPopup;
