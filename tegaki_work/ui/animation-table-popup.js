/**
 * ============================================================================
 * ファイル名: ui/animation-table-popup.js
 * 責務: 動画ツール風アニメーションテーブル（ToonSquid風）のUIを提供する
 * 依存: system/event-bus.js, system/animation/animation-data-model.js
 * 被依存: core-engine.js, system/popup-manager.js
 * ============================================================================
 */

import { TegakiEventBus } from '../system/event-bus.js';
import { TimelineModel } from '../system/animation/animation-data-model.js';

export class AnimationTablePopup {
    constructor(dependencies = {}) {
        this.eventBus = TegakiEventBus;
        this.layerSystem = dependencies.layerSystem;
        this.animationSystem = dependencies.animationSystem;
        
        this.panel = null;
        this.isVisible = false;
        this.initialized = false;
        this._updateTimeout = null;
        
        this.model = new TimelineModel();
        this.selectedCelId = null;
        
        // 再生関連
        this.isPlaying = false;
        this._playTimer = null;
        
        this._ensurePanelElement();
    }

    initialize() {
        if (this.initialized) return;
        
        this._injectStyles();
        this._setupEventListeners();
        
        this.initialized = true;
    }

    show() {
        if (!this.initialized) this.initialize();
        if (this.isVisible) return;
        
        this.panel.style.display = 'flex';
        this.isVisible = true;
        this.render();
    }

    hide() {
        if (!this.panel) return;
        this.stop();
        this.panel.style.display = 'none';
        this.isVisible = false;
    }

    toggle() {
        if (this.isVisible) this.hide();
        else this.show();
    }

    play() {
        if (this.isPlaying) return;
        this.isPlaying = true;
        this._updatePlayButtonUI();

        const interval = 1000 / this.model.fps;
        this._playTimer = setInterval(() => {
            if (!this.model.advanceFrame()) {
                this.stop();
            } else {
                this.render();
            }
        }, interval);
    }

    stop() {
        if (!this.isPlaying) return;
        this.isPlaying = false;
        if (this._playTimer) {
            clearInterval(this._playTimer);
            this._playTimer = null;
        }
        this._updatePlayButtonUI();
        this.render();
    }

    togglePlayback() {
        if (this.isPlaying) this.stop();
        else this.play();
    }

    _updatePlayButtonUI() {
        if (!this.panel) return;
        const playBtn = this.panel.querySelector('#anim-play-toggle-btn');
        if (playBtn) {
            if (this.isPlaying) {
                playBtn.textContent = '■';
                playBtn.classList.add('playing');
                playBtn.title = 'Stop';
            } else {
                playBtn.textContent = '▶';
                playBtn.classList.remove('playing');
                playBtn.title = 'Play';
            }
        }
    }

    requestUpdate() {
        if (!this.isVisible) return;
        if (this._updateTimeout) return;
        this._updateTimeout = setTimeout(() => {
            this._updateTimeout = null;
            this.render();
        }, 32);
    }

    render() {
        if (!this.panel || !this.isVisible) return;
        
        // モデルを LayerSystem と同期
        const layers = this.layerSystem?.getLayers() || [];
        const activeIndex = this.layerSystem?.getActiveLayerIndex() || 0;
        this.model.syncWithLayers(layers, activeIndex);

        const trackList = this.panel.querySelector('.anim-track-list');
        const timelineGrid = this.panel.querySelector('.anim-timeline-grid');
        
        if (trackList) {
            let trackHtml = `<div class="anim-track-header">TRACKS</div>`;
            this.model.tracks.forEach(track => {
                const activeClass = track.active ? ' active' : '';
                trackHtml += `<div class="anim-track-item${activeClass}" data-track-id="${track.id}">${this._escapeHtml(track.name)}</div>`;
            });
            trackList.innerHTML = trackHtml;
        }
        
        if (timelineGrid) {
            const totalFrames = this.model.totalFrames;
            const currentFrame = this.model.playback.currentFrame;

            let headerHtml = `<div class="anim-timeline-header">`;
            for (let i = 0; i < totalFrames; i++) {
                const isCurrent = (i === currentFrame) ? ' current' : '';
                headerHtml += `<div class="anim-frame-num${isCurrent}" data-frame-index="${i}">${i + 1}</div>`;
            }
            headerHtml += `</div>`;

            let gridHtml = headerHtml;
            this.model.tracks.forEach(track => {
                const activeClass = track.active ? ' active' : '';
                gridHtml += `<div class="anim-timeline-row${activeClass}">`;
                for (let i = 0; i < totalFrames; i++) {
                    const isCurrent = (i === currentFrame) ? ' current-col' : '';
                    const cel = track.getCelAtFrame(i);
                    const hasCelClass = cel ? ' has-cel' : '';
                    const isSelected = cel && cel.id === this.selectedCelId ? ' selected' : '';
                    
                    // セルの開始位置かチェック（UIブロックを描画するため）
                    const isStart = cel && cel.startFrame === i;
                    
                    const durationClass = isStart ? ` duration-${Math.max(1, Math.min(cel.duration, totalFrames))}` : '';
                    gridHtml += `<div class="anim-cell-slot${isCurrent}${hasCelClass}${isSelected}" 
                                     data-track-id="${track.id}" 
                                     data-frame-index="${i}">
                                     ${isStart ? `<div class="anim-cel-block${isSelected}${durationClass}"></div>` : ''}
                                 </div>`;
                }
                gridHtml += `</div>`;
            });
            timelineGrid.innerHTML = gridHtml;
        }
    }

    _ensurePanelElement() {
        this.panel = document.getElementById('animation-table-popup');
        if (this.panel) return;
        
        this.panel = document.createElement('div');
        this.panel.id = 'animation-table-popup';
        this.panel.className = 'animation-table-panel popup-panel--translucent';
        this.panel.style.display = 'none';
        
        this.panel.innerHTML = `
            <div class="anim-table-header">
                <div class="anim-table-header-left">
                    <button class="anim-tool-btn anim-play-btn" id="anim-play-toggle-btn" title="Play">▶</button>
                    <span class="anim-table-title">ANIMATION TABLE</span>
                </div>
                <div class="anim-table-header-center">
                    <div class="anim-duration-controls">
                        <span class="anim-control-label">DURATION:</span>
                        <button class="anim-tool-btn" id="anim-duration-dec" title="Decrease Duration">-</button>
                        <button class="anim-tool-btn" id="anim-duration-inc" title="Increase Duration">+</button>
                    </div>
                </div>
                <div class="anim-table-header-right">
                    <button class="ui-close-button" id="anim-table-close-btn">×</button>
                </div>
            </div>
            <div class="anim-table-content">
                <div class="anim-track-list"></div>
                <div class="anim-timeline-grid-container ui-scrollbar">
                    <div class="anim-timeline-grid"></div>
                </div>
            </div>
        `;
        
        document.body.appendChild(this.panel);
        
        const closeBtn = this.panel.querySelector('#anim-table-close-btn');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => this.hide());
        }

        const playBtn = this.panel.querySelector('#anim-play-toggle-btn');
        if (playBtn) {
            playBtn.addEventListener('click', () => this.togglePlayback());
        }

        const decBtn = this.panel.querySelector('#anim-duration-dec');
        const incBtn = this.panel.querySelector('#anim-duration-inc');
        
        if (decBtn) {
            decBtn.addEventListener('click', () => this._adjustSelectedCelDuration(-1));
        }
        if (incBtn) {
            incBtn.addEventListener('click', () => this._adjustSelectedCelDuration(1));
        }

        const timelineGrid = this.panel.querySelector('.anim-timeline-grid');
        if (timelineGrid) {
            timelineGrid.addEventListener('click', (e) => {
                // フレームヘッダークリックによる移動
                const frameNum = e.target.closest('.anim-frame-num');
                if (frameNum) {
                    const frameIndex = parseInt(frameNum.dataset.frameIndex, 10);
                    this.model.setCurrentFrame(frameIndex);
                    this.render();
                    return;
                }

                // セルスロットクリック
                const slot = e.target.closest('.anim-cell-slot');
                if (!slot) return;

                const trackId = slot.dataset.trackId;
                const frameIndex = parseInt(slot.dataset.frameIndex, 10);
                const track = this.model.tracks.find(t => t.id === trackId);
                if (!track) return;

                const existingCel = track.getCelAtFrame(frameIndex);

                // Alt+Click で削除（またはセルが存在する場合に反転）
                if (e.altKey || e.shiftKey) {
                    if (existingCel) {
                        if (this.selectedCelId === existingCel.id) this.selectedCelId = null;
                        track.removeCelAtFrame(existingCel.startFrame);
                    }
                } else {
                    // 通常クリック：選択 または 追加＆選択
                    if (existingCel) {
                        this.selectedCelId = existingCel.id;
                    } else {
                        const newCel = track.addCel({
                            layerId: track.layerId,
                            startFrame: frameIndex,
                            duration: 1
                        });
                        if (newCel) {
                            this.selectedCelId = newCel.id;
                        }
                    }
                }
                
                this.render();
            });
        }
    }

    _adjustSelectedCelDuration(delta) {
        if (!this.selectedCelId) return;

        // すべてのトラックから該当セルを探す
        for (const track of this.model.tracks) {
            const cel = track.cels.find(c => c.id === this.selectedCelId);
            if (cel) {
                const maxDuration = Math.max(1, this.model.totalFrames - cel.startFrame);
                const newDuration = Math.max(1, Math.min(maxDuration, cel.duration + delta));
                if (track.setCelDuration(cel.id, newDuration)) {
                    this.render();
                }
                break;
            }
        }
    }

    _injectStyles() {
        if (document.getElementById('animation-table-styles')) return;
        
        const style = document.createElement('style');
        style.id = 'animation-table-styles';
        style.textContent = `
            .animation-table-panel {
                position: fixed;
                bottom: 20px;
                left: 70px;
                right: 230px;
                height: 240px;
                z-index: 2000;
                display: flex;
                flex-direction: column;
                background: rgba(255, 255, 238, 0.85);
                backdrop-filter: blur(12px);
                border: 2px solid var(--futaba-maroon);
                border-radius: 12px;
                box-shadow: 0 10px 30px rgba(0,0,0,0.2);
                overflow: hidden;
            }

            .anim-table-header {
                padding: 4px 12px;
                background: var(--futaba-maroon);
                color: white;
                display: flex;
                justify-content: space-between;
                align-items: center;
                font-size: 11px;
                font-weight: bold;
                cursor: default;
            }

            .anim-table-header-center {
                flex: 1;
                display: flex;
                justify-content: center;
            }

            .anim-duration-controls {
                display: flex;
                align-items: center;
                gap: 8px;
                background: rgba(0,0,0,0.2);
                padding: 2px 8px;
                border-radius: 20px;
            }

            .anim-control-label {
                font-size: 9px;
                opacity: 0.8;
                margin-right: 4px;
            }

            .anim-tool-btn {
                background: rgba(255,255,255,0.1);
                border: 1px solid rgba(255,255,255,0.2);
                color: white;
                width: 20px;
                height: 20px;
                border-radius: 4px;
                display: flex;
                align-items: center;
                justify-content: center;
                cursor: pointer;
                font-weight: bold;
                transition: background 0.2s;
            }

            .anim-tool-btn:hover {
                background: rgba(255,255,255,0.3);
            }

            .anim-tool-btn:active {
                background: #ff6600;
                border-color: #ff6600;
            }

            .anim-play-btn {
                margin-right: 8px;
                width: 24px;
                height: 24px;
                font-size: 12px;
            }

            .anim-play-btn.playing {
                background: #ff6600;
                border-color: #ff6600;
                color: white;
            }

            .anim-table-content {
                display: flex;
                flex: 1;
                overflow: hidden;
            }

            .anim-track-list {
                width: 140px;
                border-right: 1px solid var(--futaba-light-medium);
                display: flex;
                flex-direction: column;
                background: rgba(128, 0, 0, 0.03);
            }

            .anim-track-header {
                height: 24px;
                padding: 4px 8px;
                font-size: 9px;
                color: var(--futaba-maroon);
                background: rgba(128, 0, 0, 0.05);
                border-bottom: 1px solid var(--futaba-light-medium);
                display: flex;
                align-items: center;
            }

            .anim-track-item {
                padding: 8px;
                font-size: 11px;
                border-bottom: 1px solid rgba(128, 0, 0, 0.1);
                color: var(--futaba-maroon);
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
                height: 32px;
                box-sizing: border-box;
                display: flex;
                align-items: center;
            }

            .anim-track-item.active {
                background: rgba(255, 102, 0, 0.15);
                font-weight: bold;
                border-left: 3px solid #ff6600;
                padding-left: 5px;
            }

            .anim-timeline-grid-container {
                flex: 1;
                overflow: auto;
            }

            .anim-timeline-grid {
                display: flex;
                flex-direction: column;
                min-width: 100%;
                background-image: 
                    linear-gradient(to right, rgba(128, 0, 0, 0.05) 1px, transparent 1px);
                background-size: 30px 100%;
            }

            .anim-timeline-header {
                display: flex;
                height: 24px;
                background: rgba(128, 0, 0, 0.05);
                border-bottom: 1px solid var(--futaba-light-medium);
                position: sticky;
                top: 0;
                z-index: 10;
            }

            .anim-frame-num {
                width: 30px;
                flex-shrink: 0;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 9px;
                font-family: monospace;
                border-right: 1px solid rgba(128, 0, 0, 0.1);
                color: var(--futaba-maroon);
            }

            .anim-frame-num:hover {
                background: rgba(128, 0, 0, 0.1);
                cursor: pointer;
            }

            .anim-frame-num.current {
                background: #ff6600;
                color: white;
                font-weight: bold;
            }

            .anim-timeline-row {
                display: flex;
                height: 32px;
                border-bottom: 1px solid rgba(128, 0, 0, 0.1);
                box-sizing: border-box;
            }

            .anim-timeline-row.active {
                background: rgba(255, 102, 0, 0.05);
            }

            .anim-cell-slot {
                width: 30px;
                flex-shrink: 0;
                border-right: 1px solid rgba(128, 0, 0, 0.05);
                box-sizing: border-box;
                display: flex;
                align-items: center;
                justify-content: flex-start;
                cursor: pointer;
                position: relative;
            }

            .anim-cell-slot:hover {
                background: rgba(128, 0, 0, 0.03);
            }

            .anim-cell-slot.current-col {
                background: rgba(255, 102, 0, 0.05);
            }

            .anim-cell-slot.selected {
                background: rgba(255, 102, 0, 0.1);
            }

            .anim-cel-block {
                width: 22px;
                height: 22px;
                background: var(--futaba-maroon);
                border-radius: 4px;
                box-shadow: 0 2px 4px rgba(0,0,0,0.1);
                transition: transform 0.1s ease;
                z-index: 5;
                margin-left: 4px;
                flex-shrink: 0;
            }

            .anim-cel-block.duration-1 { width: 22px; }
            .anim-cel-block.duration-2 { width: 52px; }
            .anim-cel-block.duration-3 { width: 82px; }
            .anim-cel-block.duration-4 { width: 112px; }
            .anim-cel-block.duration-5 { width: 142px; }
            .anim-cel-block.duration-6 { width: 172px; }
            .anim-cel-block.duration-7 { width: 202px; }
            .anim-cel-block.duration-8 { width: 232px; }
            .anim-cel-block.duration-9 { width: 262px; }
            .anim-cel-block.duration-10 { width: 292px; }
            .anim-cel-block.duration-11 { width: 322px; }
            .anim-cel-block.duration-12 { width: 352px; }
            .anim-cel-block.duration-13 { width: 382px; }
            .anim-cel-block.duration-14 { width: 412px; }
            .anim-cel-block.duration-15 { width: 442px; }
            .anim-cel-block.duration-16 { width: 472px; }
            .anim-cel-block.duration-17 { width: 502px; }
            .anim-cel-block.duration-18 { width: 532px; }
            .anim-cel-block.duration-19 { width: 562px; }
            .anim-cel-block.duration-20 { width: 592px; }
            .anim-cel-block.duration-21 { width: 622px; }
            .anim-cel-block.duration-22 { width: 652px; }
            .anim-cel-block.duration-23 { width: 682px; }
            .anim-cel-block.duration-24 { width: 712px; }

            .anim-cel-block.selected {
                background: #ff6600;
                transform: scaleY(1.1);
                box-shadow: 0 0 8px rgba(255, 102, 0, 0.5);
                border: 2px solid white;
            }

            .anim-timeline-row.active .anim-cel-block {
                background: #ff6600;
            }

            .anim-timeline-row.active .anim-cel-block.selected {
                background: #ff8c42;
                border-color: white;
            }
        `;
        document.head.appendChild(style);
    }

    _setupEventListeners() {
        if (!this.eventBus) return;
        
        // レイヤー系の更新を購読
        this.eventBus.on('layer:panel-update-requested', () => this.requestUpdate());
        this.eventBus.on('layer:created', () => this.requestUpdate());
        this.eventBus.on('layer:deleted', () => this.requestUpdate());
        this.eventBus.on('layer:activated', () => this.requestUpdate());
        this.eventBus.on('layer:reordered', () => this.requestUpdate());
        this.eventBus.on('layer:name-changed', () => this.requestUpdate());
        
        // アニメーション系
        this.eventBus.on('animation:frame-changed', () => this.requestUpdate());
    }

    _escapeHtml(str) {
        if (!str) return '';
        return str.replace(/[&<>"']/g, function(m) {
            return {
                '&': '&amp;',
                '<': '&lt;',
                '>': '&gt;',
                '"': '&quot;',
                "'": '&#39;'
            }[m];
        });
    }
}

// 下位互換性のためにグローバルに登録
window.AnimationTablePopup = AnimationTablePopup;
