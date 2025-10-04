// ===== ui/timeline-ui.js - CSS高さ修正完全版 =====
// 【修正】全カット時間UIを他のボタンと同じ高さ28pxに統一
// 【維持】全既存機能

(function() {
    'use strict';
    
    class TimelineUI {
        constructor(animationSystem) {
            this.animationSystem = animationSystem;
            this.timelinePanel = null;
            this.cutsContainer = null;
            this.sortable = null;
            this.isVisible = false;
            this.currentCutIndex = 0;
            this.isPlaying = false;
            this.isLooping = true;
            this.isInitialized = false;
            this.domCreated = false;
            
            this.eventBus = window.TegakiEventBus;
            
            this.thumbnailUpdateInProgress = false;
            this.playbackTimeUpdateRAF = null;
        }
        
        init() {
            if (this.isInitialized) return;
            
            this.removeExistingTimelineElements();
            this.createCompleteTimelineStructure();
            this.injectCompleteTimelineCSS();
            this.setupEventListeners();
            this.setupKeyboardShortcuts();
            this.setupAnimationEvents();
            this.createLayerPanelCutIndicator();
            this.ensureInitialCut();
            
            this.setupThumbnailAutoUpdate();
            this.setupResizeEventListener();
            
            this.isInitialized = true;
        }
        
        setupResizeEventListener() {
            if (!this.eventBus) return;
            
            this.eventBus.on('camera:resized', (data) => {
                this.requestAllThumbnailsUpdate();
            });
            
            this.eventBus.on('animation:thumbnails-need-update', () => {
                this.updateAllCutThumbnails();
            });
        }
        
        requestAllThumbnailsUpdate() {
            if (this.allThumbnailUpdateTimer) {
                clearTimeout(this.allThumbnailUpdateTimer);
            }
            
            this.allThumbnailUpdateTimer = setTimeout(() => {
                this.updateAllCutThumbnails();
            }, 300);
        }
        
        async updateAllCutThumbnails() {
            if (this.thumbnailUpdateInProgress) return;
            if (!this.animationSystem?.animationData?.cuts) return;
            
            this.thumbnailUpdateInProgress = true;
            
            try {
                const cuts = this.animationSystem.animationData.cuts;
                
                for (let i = 0; i < cuts.length; i++) {
                    await this.animationSystem.generateCutThumbnailOptimized(i);
                    this.updateSingleCutThumbnail(i);
                    
                    if (i < cuts.length - 1) {
                        await new Promise(resolve => setTimeout(resolve, 50));
                    }
                }
            } catch (error) {
            } finally {
                this.thumbnailUpdateInProgress = false;
            }
        }
        
        setupThumbnailAutoUpdate() {
            if (!this.eventBus) return;
            
            this.eventBus.on('layer:updated', () => {
                this.requestThumbnailUpdate();
            });
            
            this.eventBus.on('layer:path-added', () => {
                this.requestThumbnailUpdate();
            });
            
            this.eventBus.on('layer:visibility-changed', () => {
                this.requestThumbnailUpdate();
            });
            
            this.eventBus.on('layer:opacity-changed', () => {
                this.requestThumbnailUpdate();
            });
            
            this.eventBus.on('drawing:path-completed', () => {
                this.requestThumbnailUpdate();
            });
            
            this.eventBus.on('drawing:erase-completed', () => {
                this.requestThumbnailUpdate();
            });
        }
        
        requestThumbnailUpdate() {
            if (this.thumbnailUpdateInProgress) return;
            
            if (this.thumbnailUpdateTimer) {
                clearTimeout(this.thumbnailUpdateTimer);
            }
            
            this.thumbnailUpdateTimer = setTimeout(() => {
                this.updateCurrentCutThumbnail();
            }, 150);
        }
        
        async updateCurrentCutThumbnail() {
            if (this.thumbnailUpdateInProgress) return;
            
            const currentCutIndex = this.animationSystem.animationData.playback.currentCutIndex;
            
            if (currentCutIndex < 0 || currentCutIndex >= this.animationSystem.animationData.cuts.length) {
                return;
            }
            
            this.thumbnailUpdateInProgress = true;
            
            try {
                await this.animationSystem.generateCutThumbnailOptimized(currentCutIndex);
                this.updateSingleCutThumbnail(currentCutIndex);
            } catch (error) {
            } finally {
                this.thumbnailUpdateInProgress = false;
            }
        }
        
        removeExistingTimelineElements() {
            ['timeline-panel', 'cuts-container', 'timeline-bottom', 'timeline-controls', 'timeline-header'].forEach(id => {
                const element = document.getElementById(id);
                if (element && !element.dataset.source) {
                    element.remove();
                }
            });
            
            document.querySelectorAll('style[data-timeline]').forEach(style => {
                if (style.dataset.timeline !== 'timeline-ui') {
                    style.remove();
                }
            });
        }
        
        createCompleteTimelineStructure() {
            if (this.domCreated) return;
            
            this.timelinePanel = document.createElement('div');
            this.timelinePanel.id = 'timeline-panel';
            this.timelinePanel.className = 'timeline-panel';
            this.timelinePanel.dataset.source = 'timeline-ui';
            this.timelinePanel.style.display = 'none';
            
            const timelineHeader = document.createElement('div');
            timelineHeader.className = 'timeline-header';
            timelineHeader.dataset.source = 'timeline-ui';
            timelineHeader.innerHTML = `
                <div class="timeline-controls">
                    <button id="repeat-btn" title="リピート (R)" class="repeat-active">
                        <svg xmlns="http://www.w3.org/2000/svg" width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                            <path d="m17 2 4 4-4 4"/><path d="M3 11v-1a4 4 0 0 1 4-4h14"/>
                            <path d="m7 22-4-4 4-4"/><path d="M21 13v1a4 4 0 0 1-4 4H3"/>
                        </svg>
                    </button>
                    <button id="play-btn" title="再生/停止 (K)">▶</button>
                    <span id="playback-time" class="playback-time">0:00:00</span>
                    <button id="add-cut-btn" title="CUT追加 (Alt+=)" class="icon-btn">
                        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#800000" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                            <rect width="8" height="4" x="8" y="2" rx="1" ry="1"/>
                            <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/>
                            <path d="M9 14h6"/>
                            <path d="M12 17v-6"/>
                        </svg>
                    </button>
                    <button id="copy-paste-cut-btn" title="CUTコピペ (Shift+C)" class="icon-btn">
                        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#800000" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M11 14h10"/>
                            <path d="M16 4h2a2 2 0 0 1 2 2v1.344"/>
                            <path d="m17 18 4-4-4-4"/>
                            <path d="M8 4H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 1.793-1.113"/>
                            <rect x="8" y="2" width="8" height="4" rx="1"/>
                        </svg>
                    </button>
                    <button id="rename-cuts-btn" title="CUTリナンバー" class="icon-btn">
                        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#800000" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M4 22h14a2 2 0 0 0 2-2V7l-5-5H6a2 2 0 0 0-2 2v4"/>
                            <path d="M14 2v4a2 2 0 0 0 2 2h4"/>
                            <rect width="4" height="6" x="2" y="12" rx="2"/>
                            <path d="M10 12h2v6"/>
                            <path d="M10 18h4"/>
                        </svg>
                    </button>
                    <div class="retime-group">
                        <label class="retime-label">全カット時間</label>
                        <input type="number" id="retime-input" class="retime-input" value="0.5" min="0.01" max="10" step="0.01" title="秒数">
                        <button id="retime-cuts-btn" title="全カット時間変更" class="retime-btn">
                            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#800000" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                                <path d="M5 22h14"/>
                                <path d="M5 2h14"/>
                                <path d="M17 22v-4.172a2 2 0 0 0-.586-1.414L12 12l-4.414 4.414A2 2 0 0 0 7 17.828V22"/>
                                <path d="M7 2v4.172a2 2 0 0 0 .586 1.414L12 12l4.414-4.414A2 2 0 0 0 17 6.172V2"/>
                            </svg>
                        </button>
                    </div>
                </div>
                <button class="timeline-close" id="close-timeline" title="タイムラインを閉じる">×</button>
            `;
            
            this.cutsContainer = document.createElement('div');
            this.cutsContainer.id = 'cuts-container';
            this.cutsContainer.className = 'cuts-container';
            this.cutsContainer.dataset.source = 'timeline-ui';
            
            this.timelinePanel.appendChild(timelineHeader);
            this.timelinePanel.appendChild(this.cutsContainer);
            document.body.appendChild(this.timelinePanel);
            
            this.domCreated = true;
        }
        
        injectCompleteTimelineCSS() {
            if (document.querySelector('style[data-timeline="timeline-ui"]')) return;
            
            const style = document.createElement('style');
            style.dataset.timeline = 'timeline-ui';
            style.textContent = `
                .timeline-panel { position: fixed !important; bottom: 12px !important; left: 60px !important; right: 220px !important; 
                    background: rgba(240, 224, 214, 0.95) !important; border: 2px solid var(--futaba-medium) !important; 
                    border-radius: 12px !important; padding: 8px 10px 10px 10px !important; z-index: 1500 !important; max-height: 180px !important; 
                    display: none !important; box-shadow: 0 6px 16px rgba(128, 0, 0, 0.25) !important; backdrop-filter: blur(12px) !important; }
                .timeline-panel.show { display: block !important; animation: slideUp 0.35s ease-out !important; }
                @keyframes slideUp { from { opacity: 0; transform: translateY(25px) scale(0.96); } to { opacity: 1; transform: translateY(0) scale(1); } }
                
                .timeline-header { display: flex !important; align-items: center !important; justify-content: space-between !important; 
                    height: 32px !important; padding: 4px 6px !important; margin-bottom: 6px !important; 
                    border-bottom: 1px solid var(--futaba-light-medium) !important; }
                
                .timeline-close { background: none !important; border: none !important; font-size: 18px !important; 
                    color: var(--futaba-maroon) !important; cursor: pointer !important; padding: 4px 8px !important; 
                    border-radius: 6px !important; height: 28px !important; min-width: 28px !important; font-weight: bold !important; 
                    flex-shrink: 0 !important; transition: all 0.2s ease !important; order: 2 !important; }
                .timeline-close:hover { background: var(--futaba-light-medium) !important; }
                
                .cuts-container { display: flex !important; gap: 6px !important; overflow-x: auto !important; 
                    padding: 3px 0 8px 12px !important; margin-bottom: 8px !important; max-height: 105px !important; }
                .cuts-container::-webkit-scrollbar { height: 10px !important; }
                .cuts-container::-webkit-scrollbar-track { background: var(--futaba-light-medium) !important; border-radius: 5px !important; }
                .cuts-container::-webkit-scrollbar-thumb { background: var(--futaba-maroon) !important; border-radius: 5px !important; }
                
                .cut-item { min-width: 85px !important; background: var(--futaba-background) !important; 
                    border: 2px solid var(--futaba-light-medium) !important; border-radius: 8px !important; 
                    padding: 2px 2px 2px 6px !important; 
                    cursor: pointer !important; position: relative !important; transition: all 0.25s ease !important; flex-shrink: 0 !important; 
                    display: flex !important; flex-direction: column !important; align-items: center !important; 
                    box-shadow: 0 2px 6px rgba(128, 0, 0, 0.12) !important; user-select: none !important; }
                .cut-item:hover { border-color: var(--futaba-medium) !important; transform: translateY(-2px) scale(1.02) !important; 
                    box-shadow: 0 4px 12px rgba(128, 0, 0, 0.2) !important; }
                .cut-item.active { border-color: var(--futaba-maroon) !important; background: var(--futaba-light-medium) !important; 
                    box-shadow: 0 0 0 3px rgba(128, 0, 0, 0.3) !important; transform: translateY(-2px) scale(1.02) !important; }
                
                .cut-thumbnail { background: var(--futaba-background) !important; border: 1px solid var(--futaba-light-medium) !important; 
                    border-radius: 6px !important; overflow: hidden !important; margin-bottom: 3px !important; position: relative !important; 
                    display: flex !important; align-items: center !important; justify-content: center !important; }
                .cut-thumbnail img { width: 100% !important; height: 100% !important; object-fit: contain !important; }
                .cut-thumbnail-placeholder { width: 100% !important; height: 100% !important; 
                    background: linear-gradient(45deg, var(--futaba-light-medium) 25%, transparent 25%), 
                                linear-gradient(-45deg, var(--futaba-light-medium) 25%, transparent 25%), 
                                linear-gradient(45deg, transparent 75%, var(--futaba-light-medium) 75%), 
                                linear-gradient(-45deg, transparent 75%, var(--futaba-light-medium) 75%) !important; 
                    background-size: 8px 8px !important; background-position: 0 0, 0 4px, 4px -4px, -4px 0px !important; 
                    display: flex !important; align-items: center !important; justify-content: center !important; 
                    color: var(--futaba-maroon) !important; font-size: 9px !important; font-weight: bold !important; }
                
                .cut-name { font-size: 10px !important; color: var(--futaba-maroon) !important; margin-bottom: 2px !important; 
                    font-weight: 600 !important; text-align: center !important; white-space: nowrap !important; overflow: hidden !important; 
                    text-overflow: ellipsis !important; max-width: 72px !important; line-height: 1.3 !important; }
                
                .cut-duration-container { display: flex !important; align-items: center !important; gap: 2px !important; margin-bottom: 3px !important; }
                .cut-duration-input { width: 35px !important; height: 18px !important; border: 1px solid var(--futaba-light-medium) !important; 
                    border-radius: 3px !important; background: var(--futaba-background) !important; font-size: 8px !important; 
                    font-family: monospace !important; color: var(--futaba-maroon) !important; font-weight: bold !important; 
                    text-align: center !important; outline: none !important; padding: 0 !important; -moz-appearance: textfield !important; }
                .cut-duration-input::-webkit-outer-spin-button, .cut-duration-input::-webkit-inner-spin-button { -webkit-appearance: none !important; margin: 0 !important; }
                
                .duration-nav-btn { width: 16px !important; height: 16px !important; 
                    background: transparent !important; 
                    border: none !important; 
                    color: var(--futaba-maroon) !important; 
                    font-size: 11px !important; cursor: pointer !important; display: flex !important; align-items: center !important; 
                    justify-content: center !important; font-weight: bold !important; padding: 0 !important; transition: all 0.15s ease !important; }
                .duration-nav-btn:hover { color: var(--futaba-light-maroon) !important; transform: scale(1.2) !important; }
                
                .delete-cut-btn { position: absolute !important; top: -4px !important; right: -4px !important; width: 18px !important; 
                    height: 18px !important; background: rgba(128, 0, 0, 0.9) !important; border: none !important; border-radius: 50% !important; 
                    color: white !important; font-size: 10px !important; cursor: pointer !important; opacity: 0 !important; 
                    display: flex !important; align-items: center !important; justify-content: center !important; font-weight: bold !important; }
                .cut-item:hover .delete-cut-btn { opacity: 1 !important; }
                .delete-cut-btn:hover { background: rgba(128, 0, 0, 1) !important; transform: scale(1.15) !important; }
                
                .timeline-controls { display: flex !important; gap: 6px !important; align-items: center !important; order: 1 !important; }
                .timeline-controls button { padding: 4px 12px !important; background: var(--futaba-background) !important; 
                    border: 2px solid var(--futaba-medium) !important; border-radius: 6px !important; cursor: pointer !important; 
                    font-size: 11px !important; color: var(--futaba-maroon) !important; min-width: 40px !important; height: 28px !important; 
                    display: flex !important; align-items: center !important; justify-content: center !important; font-weight: 600 !important; 
                    transition: all 0.2s ease !important; }
                .timeline-controls button:hover { background: var(--futaba-medium) !important; border-color: var(--futaba-maroon) !important; 
                    transform: translateY(-1px) !important; }
                
                .icon-btn { padding: 4px 8px !important; min-width: 32px !important; }
                .icon-btn svg { width: 14px !important; height: 14px !important; }
                
                .playback-time { font-family: monospace !important; font-size: 11px !important; font-weight: bold !important; 
                    color: var(--futaba-maroon) !important; padding: 0 8px !important; min-width: 60px !important; 
                    text-align: center !important; height: 28px !important; display: flex !important; align-items: center !important; 
                    justify-content: center !important; background: var(--futaba-light-medium) !important; 
                    border-radius: 4px !important; }
                
                .retime-group { 
                    display: flex !important; 
                    align-items: center !important; 
                    gap: 3px !important; 
                    border: 2px solid var(--futaba-medium) !important; 
                    border-radius: 6px !important; 
                    padding: 2px 6px !important; 
                    background: var(--futaba-background) !important; 
                    transition: border-color 0.2s ease !important; 
                    height: 28px !important; 
                }
                .retime-group:hover { border-color: var(--futaba-maroon) !important; }
                
                .retime-label { 
                    font-size: 9px !important; 
                    font-weight: 600 !important; 
                    color: var(--futaba-maroon) !important; 
                    white-space: nowrap !important; 
                    flex-shrink: 0 !important; 
                    line-height: 1 !important; 
                }
                
                .retime-input { 
                    width: 48px !important; 
                    height: 20px !important; 
                    border: 1px solid var(--futaba-light-medium) !important; 
                    border-radius: 4px !important; 
                    background: var(--futaba-background) !important; 
                    font-size: 10px !important; 
                    font-family: monospace !important; 
                    color: var(--futaba-maroon) !important; 
                    font-weight: bold !important; 
                    text-align: center !important; 
                    outline: none !important; 
                    padding: 0 4px !important; 
                    -moz-appearance: textfield !important; 
                    flex-shrink: 0 !important; 
                }
                .retime-input::-webkit-outer-spin-button, 
                .retime-input::-webkit-inner-spin-button { 
                    -webkit-appearance: none !important; 
                    margin: 0 !important; 
                }
                .retime-input:focus { background: white !important; box-shadow: 0 0 0 2px rgba(128, 0, 0, 0.2) !important; }
                
                .retime-btn { 
                    background: transparent !important; 
                    border: none !important; 
                    padding: 2px 4px !important; 
                    cursor: pointer !important; 
                    display: flex !important; 
                    align-items: center !important; 
                    justify-content: center !important; 
                    transition: all 0.2s ease !important; 
                    border-radius: 4px !important; 
                    min-width: 20px !important; 
                    height: 20px !important; 
                    flex-shrink: 0 !important; 
                }
                .retime-btn:hover { 
                    background: var(--futaba-maroon) !important; 
                }
                .retime-btn:hover svg { stroke: white !important; }
                .retime-btn svg { width: 12px !important; height: 12px !important; stroke: #800000 !important; transition: stroke 0.2s ease !important; }
                
                #repeat-btn { min-width: 34px !important; padding: 6px !important; }
                #repeat-btn.repeat-active { background: var(--futaba-maroon) !important; color: var(--futaba-background) !important; }
                #repeat-btn.repeat-inactive { background: var(--futaba-background) !important; opacity: 0.6 !important; }
                #repeat-btn svg { width: 14px !important; height: 14px !important; }
                .timeline-controls button#play-btn.playing { background: var(--futaba-maroon) !important; color: white !important; }
            `;
            document.head.appendChild(style);
        }
        
        ensureInitialCut() {
            const animData = this.animationSystem.getAnimationData();
            
            if (animData.cuts.length > 0) {
                this.updateLayerPanelIndicator();
                return;
            }
            
            if (!this.animationSystem.layerSystem?.layers || 
                this.animationSystem.layerSystem.layers.length === 0) {
                return;
            }
            
            let hasDrawnContent = false;
            for (const layer of this.animationSystem.layerSystem.layers) {
                if (layer.layerData?.paths && layer.layerData.paths.length > 0) {
                    hasDrawnContent = true;
                    break;
                }
            }
            
            if (hasDrawnContent) {
                this.animationSystem.createNewCutFromCurrentLayers();
            } else {
                this.animationSystem.createNewBlankCut();
            }
            
            this.updateLayerPanelIndicator();
        }
        
        setupEventListeners() {
            if (!this.eventBus) return;
            
            this.eventBus.on('ui:toggle-timeline', () => this.toggle());
            this.eventBus.on('ui:show-timeline', () => this.show());
            this.eventBus.on('ui:hide-timeline', () => this.hide());
            
            this.setupImprovedButtonListeners();
        }
        
        setupImprovedButtonListeners() {
            document.getElementById('repeat-btn')?.addEventListener('click', () => this.toggleRepeat());
            document.getElementById('play-btn')?.addEventListener('click', () => this.togglePlayStop());
            document.getElementById('add-cut-btn')?.addEventListener('click', () => {
                this.animationSystem.createNewEmptyCut();
            });
            document.getElementById('copy-paste-cut-btn')?.addEventListener('click', () => this.executeCutCopyPaste());
            document.getElementById('rename-cuts-btn')?.addEventListener('click', () => this.executeRenameCuts());
            document.getElementById('retime-cuts-btn')?.addEventListener('click', () => this.executeRetimeCuts());
            document.getElementById('close-timeline')?.addEventListener('click', () => this.hide());
        }
        
        executeCutCopyPaste() {
            if (!this.eventBus) return;
            this.eventBus.emit('cut:copy-current');
            setTimeout(() => {
                this.eventBus.emit('cut:paste-right-adjacent');
                setTimeout(() => {
                    this.updateCutsList();
                    this.updateLayerPanelIndicator();
                }, 100);
            }, 50);
        }
        
        executeRenameCuts() {
            if (!this.animationSystem) return;
            this.animationSystem.renameCutsSequentially();
            this.updateCutsList();
            this.updateLayerPanelIndicator();
        }
        
        executeRetimeCuts() {
            if (!this.animationSystem) return;
            
            const retimeInput = document.getElementById('retime-input');
            if (!retimeInput) return;
            
            const newDuration = parseFloat(retimeInput.value);
            if (isNaN(newDuration) || newDuration <= 0) return;
            
            this.animationSystem.retimeAllCuts(newDuration);
            this.updateCutsList();
        }
        
        toggleRepeat() {
            this.isLooping = !this.isLooping;
            this.animationSystem.updateSettings({ loop: this.isLooping });
            
            const repeatBtn = document.getElementById('repeat-btn');
            if (repeatBtn) {
                repeatBtn.classList.toggle('repeat-active', this.isLooping);
                repeatBtn.classList.toggle('repeat-inactive', !this.isLooping);
            }
            
            if (this.eventBus) {
                this.eventBus.emit('animation:loop:set', this.isLooping);
            }
        }
        
        togglePlayStop() {
            if (this.isPlaying) {
                this.animationSystem.stop();
            } else {
                this.animationSystem.play();
            }
        }
        
        startPlaybackTimeUpdate() {
            const updateTime = () => {
                if (!this.isPlaying) return;
                
                const playbackTime = this.animationSystem.getPlaybackTime();
                this.updatePlaybackTimeDisplay(playbackTime);
                
                this.playbackTimeUpdateRAF = requestAnimationFrame(updateTime);
            };
            
            updateTime();
        }
        
        stopPlaybackTimeUpdate() {
            if (this.playbackTimeUpdateRAF) {
                cancelAnimationFrame(this.playbackTimeUpdateRAF);
                this.playbackTimeUpdateRAF = null;
            }
        }
        
        updatePlaybackTimeDisplay(timeInSeconds) {
            const timeDisplay = document.getElementById('playback-time');
            if (!timeDisplay) return;
            
            const totalMs = Math.floor(timeInSeconds * 1000);
            const minutes = Math.floor(totalMs / 60000);
            const seconds = Math.floor((totalMs % 60000) / 1000);
            const centiseconds = Math.floor((totalMs % 1000) / 10);
            
            const formatted = `${minutes}:${seconds.toString().padStart(2, '0')}:${centiseconds.toString().padStart(2, '0')}`;
            timeDisplay.textContent = formatted;
        }
        
        toggle() {
            if (this.isVisible) {
                this.hide();
            } else {
                this.show();
            }
        }
        
        show() {
            if (!this.timelinePanel) return;
            
            this.isVisible = true;
            this.timelinePanel.style.display = 'block';
            this.timelinePanel.classList.add('show');
            this.timelinePanel.style.zIndex = '1500';
            
            this.updateCutsList();
            
            if (this.eventBus) {
                this.eventBus.emit('timeline:shown');
            }
        }
        
        hide() {
            if (!this.timelinePanel) return;
            
            this.isVisible = false;
            this.timelinePanel.classList.remove('show');
            
            setTimeout(() => {
                if (!this.isVisible) {
                    this.timelinePanel.style.display = 'none';
                }
            }, 300);
            
            if (this.eventBus) {
                this.eventBus.emit('timeline:hidden');
            }
        }
        
        setupKeyboardShortcuts() {
            document.addEventListener('keydown', (e) => {
                if (!this.isVisible) return;
                
                if (e.code === 'Space' && e.shiftKey && !e.ctrlKey && !e.altKey) {
                    this.togglePlayStop();
                    e.preventDefault();
                } else if (e.code === 'KeyR' && !e.ctrlKey && !e.altKey) {
                    this.toggleRepeat();
                    e.preventDefault();
                } else if (e.code === 'ArrowLeft') {
                    this.goToPreviousCutSafe();
                    e.preventDefault();
                } else if (e.code === 'ArrowRight') {
                    this.goToNextCutSafe();
                    e.preventDefault();
                } else if (e.code === 'Equal' && e.altKey) {
                    this.animationSystem.createNewEmptyCut();
                    e.preventDefault();
                }
            });
        }
        
        goToPreviousCutSafe() {
            const animData = this.animationSystem.getAnimationData();
            if (animData.cuts.length === 0) return;
            
            let newIndex = this.currentCutIndex - 1;
            if (newIndex < 0) newIndex = animData.cuts.length - 1;
            
            this.currentCutIndex = newIndex;
            this.animationSystem.animationData.playback.currentCutIndex = newIndex;
            this.animationSystem.switchToActiveCutSafely(newIndex, false);
            this.setActiveCut(newIndex);
            this.updateLayerPanelIndicator();
            
            if (this.eventBus) {
                this.eventBus.emit('animation:cut-changed', { cutIndex: newIndex, direction: 'previous' });
            }
        }
        
        goToNextCutSafe() {
            const animData = this.animationSystem.getAnimationData();
            if (animData.cuts.length === 0) return;
            
            let newIndex = this.currentCutIndex + 1;
            if (newIndex >= animData.cuts.length) newIndex = 0;
            
            this.currentCutIndex = newIndex;
            this.animationSystem.animationData.playback.currentCutIndex = newIndex;
            this.animationSystem.switchToActiveCutSafely(newIndex, false);
            this.setActiveCut(newIndex);
            this.updateLayerPanelIndicator();
            
            if (this.eventBus) {
                this.eventBus.emit('animation:cut-changed', { cutIndex: newIndex, direction: 'next' });
            }
        }
        
        setupAnimationEvents() {
            if (!this.eventBus) return;
            
            this.eventBus.on('animation:play-toggle', () => this.togglePlayStop());
            this.eventBus.on('animation:cut-created', () => {
                this.updateCutsList();
                this.updateLayerPanelIndicator();
            });
            this.eventBus.on('animation:cut-applied', (data) => {
                this.setActiveCut(data.cutIndex);
                this.updateLayerPanelIndicator();
            });
            this.eventBus.on('cut:pasted-right-adjacent', (data) => {
                this.currentCutIndex = data.cutIndex;
                this.updateCutsList();
                this.updateLayerPanelIndicator();
            });
            this.eventBus.on('animation:thumbnail-generated', (data) => {
                this.updateSingleCutThumbnail(data.cutIndex);
            });
            this.eventBus.on('animation:playback-started', () => {
                this.isPlaying = true;
                this.updatePlaybackUI(true);
                this.startPlaybackTimeUpdate();
            });
            this.eventBus.on('animation:playback-paused', () => {
                this.isPlaying = false;
                this.updatePlaybackUI(false);
                this.stopPlaybackTimeUpdate();
            });
            this.eventBus.on('animation:playback-stopped', () => {
                this.isPlaying = false;
                this.updatePlaybackUI(false);
                this.stopPlaybackTimeUpdate();
                this.updatePlaybackTimeDisplay(0);
                this.updateLayerPanelIndicator();
            });
            this.eventBus.on('animation:cut-changed', (data) => {
                this.currentCutIndex = data.cutIndex;
                this.setActiveCut(data.cutIndex);
                this.updateLayerPanelIndicator();
            });
            this.eventBus.on('animation:cuts-renamed-sequentially', () => {
                this.updateCutsList();
                this.updateLayerPanelIndicator();
            });
        }
        
        createLayerPanelCutIndicator() {
            const layerContainer = document.getElementById('layer-panel-container');
            if (!layerContainer) return;
            
            const existingIndicator = layerContainer.querySelector('.cut-indicator');
            if (existingIndicator) existingIndicator.remove();
            
            const cutIndicator = document.createElement('div');
            cutIndicator.className = 'cut-indicator';
            cutIndicator.innerHTML = `
                <button class="cut-nav-btn" id="cut-prev-btn">◀</button>
                <span class="cut-display" id="cut-display">CUT1</span>
                <button class="cut-nav-btn" id="cut-next-btn">▶</button>
            `;
            
            layerContainer.insertBefore(cutIndicator, layerContainer.firstChild);
            
            document.getElementById('cut-prev-btn')?.addEventListener('click', () => this.goToPreviousCutSafe());
            document.getElementById('cut-next-btn')?.addEventListener('click', () => this.goToNextCutSafe());
            
            this.updateLayerPanelIndicator();
        }
        
        updateLayerPanelIndicator() {
            const cutDisplay = document.getElementById('cut-display');
            if (!cutDisplay) return;
            
            const animData = this.animationSystem.getAnimationData();
            const totalCuts = animData.cuts.length;
            
            if (totalCuts === 0) {
                cutDisplay.textContent = 'NO CUT';
                document.getElementById('cut-prev-btn')?.setAttribute('disabled', 'true');
                document.getElementById('cut-next-btn')?.setAttribute('disabled', 'true');
                return;
            }
            
            const currentCutName = animData.cuts[this.currentCutIndex]?.name || `CUT${this.currentCutIndex + 1}`;
            cutDisplay.textContent = currentCutName;
            
            document.getElementById('cut-prev-btn')?.removeAttribute('disabled');
            document.getElementById('cut-next-btn')?.removeAttribute('disabled');
        }
        
        updateCutsList() {
            const animData = this.animationSystem.getAnimationData();
            this.cutsContainer.innerHTML = '';
            
            animData.cuts.forEach((cut, index) => {
                const cutItem = this.createImprovedCutItem(cut, index);
                this.cutsContainer.appendChild(cutItem);
            });
            
            if (this.sortable) {
                this.sortable.destroy();
            }
            
            if (window.Sortable) {
                this.sortable = Sortable.create(this.cutsContainer, {
                    animation: 150,
                    onEnd: (evt) => {
                        this.animationSystem.reorderCuts(evt.oldIndex, evt.newIndex);
                    }
                });
            }
        }
        
        createImprovedCutItem(cut, index) {
            const cutItem = document.createElement('div');
            cutItem.className = 'cut-item';
            cutItem.dataset.cutIndex = index;
            
            const thumbnailHtml = this.generateCutThumbnailHTML(cut, index);
            
            cutItem.innerHTML = `
                <div class="cut-thumbnail" data-cut-index="${index}">${thumbnailHtml}</div>
                <div class="cut-name">${cut.name}</div>
                <div class="cut-duration-container">
                    <button class="duration-nav-btn duration-decrease" data-index="${index}">◀</button>
                    <input type="number" class="cut-duration-input" value="${cut.duration.toFixed(2)}" min="0.01" max="10" step="0.01" data-index="${index}">
                    <button class="duration-nav-btn duration-increase" data-index="${index}">▶</button>
                </div>
                <button class="delete-cut-btn" data-index="${index}">×</button>
            `;
            
            this.applyCutThumbnailAspectRatio(cutItem, index);
            
            cutItem.addEventListener('click', (e) => {
                if (!e.target.classList.contains('delete-cut-btn') &&
                    !e.target.classList.contains('cut-duration-input') &&
                    !e.target.classList.contains('duration-nav-btn')) {
                    this.selectCutSafely(index);
                }
            });
            
            const decreaseBtn = cutItem.querySelector('.duration-decrease');
            const increaseBtn = cutItem.querySelector('.duration-increase');
            const durationInput = cutItem.querySelector('.cut-duration-input');
            
            if (decreaseBtn) {
                decreaseBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const currentValue = parseFloat(durationInput.value);
                    const newValue = Math.max(0.01, currentValue - 0.01);
                    durationInput.value = newValue.toFixed(2);
                    this.animationSystem.updateCutDuration(index, newValue);
                });
            }
            
            if (increaseBtn) {
                increaseBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const currentValue = parseFloat(durationInput.value);
                    const newValue = Math.min(10, currentValue + 0.01);
                    durationInput.value = newValue.toFixed(2);
                    this.animationSystem.updateCutDuration(index, newValue);
                });
            }
            
            if (durationInput) {
                durationInput.addEventListener('change', (e) => {
                    const newDuration = parseFloat(e.target.value);
                    if (!isNaN(newDuration) && newDuration > 0) {
                        this.animationSystem.updateCutDuration(index, newDuration);
                        e.target.value = newDuration.toFixed(2);
                    }
                    e.stopPropagation();
                });
                
                durationInput.addEventListener('click', (e) => {
                    e.stopPropagation();
                });
            }
            
            const deleteBtn = cutItem.querySelector('.delete-cut-btn');
            if (deleteBtn) {
                deleteBtn.addEventListener('click', (e) => {
                    this.deleteCutImmediate(index);
                    e.stopPropagation();
                });
            }
            
            return cutItem;
        }
        
        selectCutSafely(index) {
            this.currentCutIndex = index;
            this.animationSystem.animationData.playback.currentCutIndex = index;
            this.animationSystem.switchToActiveCutSafely(index, false);
            this.setActiveCut(index);
            this.updateLayerPanelIndicator();
        }
        
        generateCutThumbnailHTML(cut, index) {
            if (cut.thumbnailCanvas) {
                try {
                    const dataUrl = cut.thumbnailCanvas.toDataURL('image/png');
                    return `<img src="${dataUrl}" alt="CUT${index + 1}" />`;
                } catch (error) {
                    return `<div class="cut-thumbnail-placeholder">ERR</div>`;
                }
            } else {
                return `<div class="cut-thumbnail-placeholder">CUT${index + 1}</div>`;
            }
        }
        
        applyCutThumbnailAspectRatio(cutItem, cutIndex) {
            const thumbnail = cutItem.querySelector('.cut-thumbnail');
            if (!thumbnail) return;
            
            const canvasWidth = this.animationSystem.layerSystem?.config?.canvas?.width || 800;
            const canvasHeight = this.animationSystem.layerSystem?.config?.canvas?.height || 600;
            const aspectRatio = canvasWidth / canvasHeight;
            
            const maxWidth = 72;
            const maxHeight = 54;
            let thumbWidth, thumbHeight;
            
            if (aspectRatio >= maxWidth / maxHeight) {
                thumbWidth = maxWidth;
                thumbHeight = Math.round(maxWidth / aspectRatio);
            } else {
                thumbHeight = maxHeight;
                thumbWidth = Math.round(maxHeight * aspectRatio);
            }
            
            thumbnail.style.width = thumbWidth + 'px';
            thumbnail.style.height = thumbHeight + 'px';
        }
        
        deleteCutImmediate(index) {
            this.animationSystem.deleteCut(index);
            this.updateCutsList();
            this.updateLayerPanelIndicator();
        }
        
        setActiveCut(index) {
            this.currentCutIndex = index;
            
            this.cutsContainer.querySelectorAll('.cut-item').forEach((item, i) => {
                item.classList.toggle('active', i === index);
            });
        }
        
        updateSingleCutThumbnail(cutIndex) {
            const cutItem = this.cutsContainer.querySelector(`[data-cut-index="${cutIndex}"]`);
            if (!cutItem) return;
            
            const thumbnail = cutItem.querySelector('.cut-thumbnail');
            if (!thumbnail) return;
            
            const animData = this.animationSystem.getAnimationData();
            const cut = animData.cuts[cutIndex];
            
            if (cut && cut.thumbnailCanvas) {
                try {
                    const dataUrl = cut.thumbnailCanvas.toDataURL('image/png');
                    thumbnail.innerHTML = `<img src="${dataUrl}" alt="CUT${cutIndex + 1}" />`;
                    this.applyCutThumbnailAspectRatio(cutItem, cutIndex);
                } catch (error) {
                }
            }
        }
        
        updatePlaybackUI(isPlaying) {
            const playBtn = document.getElementById('play-btn');
            if (playBtn) {
                playBtn.textContent = isPlaying ? '⏸' : '▶';
                playBtn.classList.toggle('playing', isPlaying);
            }
        }
    }
    
    window.TegakiTimelineUI = TimelineUI;
    
    if (typeof window.TegakiUI === 'undefined') {
        window.TegakiUI = {};
    }
    window.TegakiUI.TimelineUI = TimelineUI;
})();