// ===== ui/timeline-ui.js - FRAME改修版 =====
// ✅ サムネイル自動更新: layer:modified, stroke:endリスナー追加
// ✅ UI改善: CUT→Frame表記、アクティブ枠#ff8c42、リピート色#aa5a56
// ✅ CUT→FRAME変換完了

(function() {
    'use strict';
    
    class TimelineUI {
        constructor(animationSystem) {
            this.animationSystem = animationSystem;
            this.timelinePanel = null;
            this.framesContainer = null;
            this.sortable = null;
            this.isVisible = false;
            this.currentFrameIndex = 0;
            this.isPlaying = false;
            this.isLooping = true;
            this.isInitialized = false;
            this.domCreated = false;
            
            this.eventBus = window.TegakiEventBus;
            
            this.thumbnailUpdateInProgress = false;
            this.playbackTimeUpdateRAF = null;
            this.frameListUpdateInProgress = false;
        }
        
        init() {
            if (this.isInitialized) return;
            
            this.removeExistingTimelineElements();
            this.createCompleteTimelineStructure();
            this.injectCompleteTimelineCSS();
            this.setupEventListeners();
            this.setupAnimationEvents();
            this.createLayerPanelFrameIndicator();
            this.ensureInitialFrame();
            
            this.setupThumbnailAutoUpdate();
            this.setupResizeEventListener();
            this.setupHistoryChangeListener();
            
            this.isInitialized = true;
        }
        
        setupHistoryChangeListener() {
            if (!this.eventBus) return;
            
            this.eventBus.on('history:changed', (data) => {
                if (!this.isVisible) return;
                
                const animData = this.animationSystem.getAnimationData();
                const totalFramesInDOM = this.framesContainer.querySelectorAll('.frame-item').length;
                
                if (animData.cuts.length !== totalFramesInDOM) {
                    this.updateFramesListImmediate();
                }
                
                this.updateLayerPanelIndicator();
            });
            
            this.eventBus.on('animation:frame-created', () => {
                if (this.isVisible) {
                    setTimeout(() => this.updateFramesListImmediate(), 50);
                }
            });
            
            this.eventBus.on('animation:frame-deleted', () => {
                if (this.isVisible) {
                    setTimeout(() => this.updateFramesListImmediate(), 50);
                }
            });
            
            this.eventBus.on('animation:frames-reordered', () => {
                if (this.isVisible) {
                    setTimeout(() => this.updateFramesListImmediate(), 50);
                }
            });
        }
        
        updateFramesListImmediate() {
            if (this.frameListUpdateInProgress) return;
            
            this.frameListUpdateInProgress = true;
            
            try {
                const animData = this.animationSystem.getAnimationData();
                this.framesContainer.innerHTML = '';
                
                animData.cuts.forEach((frame, index) => {
                    const frameItem = this.createImprovedFrameItem(frame, index);
                    this.framesContainer.appendChild(frameItem);
                });
                
                if (this.sortable) {
                    this.sortable.destroy();
                }
                
                if (window.Sortable) {
                    this.sortable = Sortable.create(this.framesContainer, {
                        animation: 150,
                        onEnd: (evt) => {
                            this.animationSystem.reorderCuts(evt.oldIndex, evt.newIndex);
                        }
                    });
                }
                
                this.setActiveFrame(this.currentFrameIndex);
            } finally {
                this.frameListUpdateInProgress = false;
            }
        }
        
        setupResizeEventListener() {
            if (!this.eventBus) return;
            
            this.eventBus.on('camera:resized', (data) => {
                this.requestAllThumbnailsUpdate();
            });
            
            this.eventBus.on('animation:thumbnails-need-update', () => {
                this.updateAllFrameThumbnails();
            });
        }
        
        requestAllThumbnailsUpdate() {
            if (this.allThumbnailUpdateTimer) {
                clearTimeout(this.allThumbnailUpdateTimer);
            }
            
            this.allThumbnailUpdateTimer = setTimeout(() => {
                this.updateAllFrameThumbnails();
            }, 300);
        }
        
        async updateAllFrameThumbnails() {
            if (this.thumbnailUpdateInProgress) return;
            if (!this.animationSystem?.animationData?.cuts) return;
            
            this.thumbnailUpdateInProgress = true;
            
            try {
                const frames = this.animationSystem.animationData.cuts;
                
                for (let i = 0; i < frames.length; i++) {
                    await this.animationSystem.generateCutThumbnailOptimized(i);
                    this.updateSingleFrameThumbnail(i);
                    
                    if (i < frames.length - 1) {
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
            
            this.eventBus.on('layer:modified', () => {
                this.requestThumbnailUpdate();
            });
            
            this.eventBus.on('stroke:end', () => {
                this.requestThumbnailUpdate();
            });
            
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
                this.updateCurrentFrameThumbnail();
            }, 150);
        }
        
        async updateCurrentFrameThumbnail() {
            if (this.thumbnailUpdateInProgress) return;
            
            const currentFrameIndex = this.animationSystem.animationData.playback.currentCutIndex;
            
            if (currentFrameIndex < 0 || currentFrameIndex >= this.animationSystem.animationData.cuts.length) {
                return;
            }
            
            this.thumbnailUpdateInProgress = true;
            
            try {
                await this.animationSystem.generateCutThumbnailOptimized(currentFrameIndex);
                this.updateSingleFrameThumbnail(currentFrameIndex);
            } catch (error) {
            } finally {
                this.thumbnailUpdateInProgress = false;
            }
        }
        
        removeExistingTimelineElements() {
            ['timeline-panel', 'frames-container', 'timeline-bottom', 'timeline-controls', 'timeline-header'].forEach(id => {
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
                    <button id="play-btn" title="再生/停止 (Ctrl+Space)">▶</button>
                    <span id="playback-time" class="playback-time">0:00:00</span>
                    <button id="add-frame-btn" title="新Frame追加 (Shift+N)" class="icon-btn">
                        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#800000" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                            <rect width="8" height="4" x="8" y="2" rx="1" ry="1"/>
                            <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/>
                            <path d="M9 14h6"/>
                            <path d="M12 17v-6"/>
                        </svg>
                    </button>
                    <button id="copy-paste-frame-btn" title="右にコピペ (Shift+C)" class="icon-btn">
                        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#800000" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M11 14h10"/>
                            <path d="M16 4h2a2 2 0 0 1 2 2v1.344"/>
                            <path d="m17 18 4-4-4-4"/>
                            <path d="M8 4H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 1.793-1.113"/>
                            <rect x="8" y="2" width="8" height="4" rx="1"/>
                        </svg>
                    </button>
                    <button id="rename-frames-btn" title="Frame番号整理" class="icon-btn">
                        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#800000" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M4 22h14a2 2 0 0 0 2-2V7l-5-5H6a2 2 0 0 0-2 2v4"/>
                            <path d="M14 2v4a2 2 0 0 0 2 2h4"/>
                            <rect width="4" height="6" x="2" y="12" rx="2"/>
                            <path d="M10 12h2v6"/>
                            <path d="M10 18h4"/>
                        </svg>
                    </button>
                    <div class="retime-group">
                        <label class="retime-label">全Frame時間</label>
                        <input type="number" id="retime-input" class="retime-input" value="0.5" min="0.01" max="10" step="0.01" title="秒数">
                        <button id="retime-frames-btn" title="全Frame時間変更" class="retime-btn">
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
            
            this.framesContainer = document.createElement('div');
            this.framesContainer.id = 'frames-container';
            this.framesContainer.className = 'frames-container';
            this.framesContainer.dataset.source = 'timeline-ui';
            
            this.timelinePanel.appendChild(timelineHeader);
            this.timelinePanel.appendChild(this.framesContainer);
            document.body.appendChild(this.timelinePanel);
            
            this.domCreated = true;
        }
        
        injectCompleteTimelineCSS() {
            if (document.querySelector('style[data-timeline="timeline-ui"]')) return;
            
            const style = document.createElement('style');
            style.dataset.timeline = 'timeline-ui';
            style.textContent = `
        .timeline-panel { position: fixed !important; bottom: 12px !important; left: 60px !important; right: 220px !important; 
            background: rgba(255, 255, 238, 0.5) !important; border: 2px solid var(--futaba-medium) !important; 
            border-radius: 12px !important; padding: 8px 10px 10px 10px !important; z-index: 1500 !important; max-height: 180px !important; 
            display: none !important; box-shadow: none !important; backdrop-filter: blur(12px) !important; }
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
        
        .frames-container { display: flex !important; gap: 6px !important; overflow-x: auto !important; 
            padding: 3px 0 8px 12px !important; margin-bottom: 8px !important; max-height: 200px !important; }
        .frames-container::-webkit-scrollbar { height: 10px !important; }
        .frames-container::-webkit-scrollbar-track { background: var(--futaba-light-medium) !important; border-radius: 5px !important; }
        .frames-container::-webkit-scrollbar-thumb { background: var(--futaba-maroon) !important; border-radius: 5px !important; }
        
        .frame-item { min-width: 85px !important; background: #ffffee !important; 
            border: 2px solid var(--futaba-light-medium) !important; border-radius: 8px !important; 
            padding: 2px 2px 2px 6px !important; 
            cursor: pointer !important; position: relative !important; transition: all 0.25s ease !important; flex-shrink: 0 !important; 
            display: flex !important; flex-direction: column !important; align-items: center !important; 
            box-shadow: none !important; user-select: none !important; }
        .frame-item:hover { border-color: var(--futaba-medium) !important; transform: translateY(-2px) scale(1.02) !important; 
            box-shadow: 0 4px 12px rgba(128, 0, 0, 0.2) !important; }
        .frame-item.active { border-width: 2px !important; border-color: #ff8c42 !important; background: #ffffee !important; 
            box-shadow: none !important; transform: translateY(-2px) scale(1.02) !important; }
        
        .frame-thumbnail { background: #ffffee !important; border: 1px solid var(--futaba-light-medium) !important; 
            border-radius: 6px !important; overflow: hidden !important; margin-bottom: 3px !important; position: relative !important; 
            display: flex !important; align-items: center !important; justify-content: center !important; }
        .frame-thumbnail img { width: 100% !important; height: 100% !important; object-fit: contain !important; }
        .frame-thumbnail-placeholder { width: 100% !important; height: 100% !important; 
            background: linear-gradient(45deg, var(--futaba-light-medium) 25%, transparent 25%), 
                        linear-gradient(-45deg, var(--futaba-light-medium) 25%, transparent 25%), 
                        linear-gradient(45deg, transparent 75%, var(--futaba-light-medium) 75%), 
                        linear-gradient(-45deg, transparent 75%, var(--futaba-light-medium) 75%) !important; 
            background-size: 8px 8px !important; background-position: 0 0, 0 4px, 4px -4px, -4px 0px !important; 
            display: flex !important; align-items: center !important; justify-content: center !important; 
            color: var(--futaba-maroon) !important; font-size: 9px !important; font-weight: bold !important; }
        
        .frame-name { font-size: 10px !important; color: var(--futaba-maroon) !important; margin-bottom: 2px !important; 
            font-weight: 600 !important; text-align: center !important; white-space: nowrap !important; overflow: hidden !important; 
            text-overflow: ellipsis !important; max-width: 72px !important; line-height: 1.3 !important; }
        
        .frame-duration-container { display: flex !important; align-items: center !important; gap: 2px !important; margin-bottom: 3px !important; }
        .frame-duration-input { width: 35px !important; height: 18px !important; border: 1px solid var(--futaba-light-medium) !important; 
            border-radius: 3px !important; background: #ffffee !important; font-size: 8px !important; 
            font-family: monospace !important; color: var(--futaba-maroon) !important; font-weight: bold !important; 
            text-align: center !important; outline: none !important; padding: 0 !important; -moz-appearance: textfield !important; }
        .frame-duration-input::-webkit-outer-spin-button, .frame-duration-input::-webkit-inner-spin-button { -webkit-appearance: none !important; margin: 0 !important; }
        
        .duration-nav-btn { width: 16px !important; height: 16px !important; 
            background: transparent !important; 
            border: none !important; 
            color: var(--futaba-maroon) !important; 
            font-size: 11px !important; cursor: pointer !important; display: flex !important; align-items: center !important; 
            justify-content: center !important; font-weight: bold !important; padding: 0 !important; transition: all 0.15s ease !important; }
        .duration-nav-btn:hover { color: var(--futaba-light-maroon) !important; transform: scale(1.2) !important; }
        
        .delete-frame-btn { position: absolute !important; top: 2px !important; right: -4px !important; width: 18px !important; 
            height: 18px !important; background: rgba(128, 0, 0, 0.9) !important; border: none !important; border-radius: 50% !important; 
            color: white !important; font-size: 10px !important; cursor: pointer !important; opacity: 0 !important; 
            display: flex !important; align-items: center !important; justify-content: center !important; font-weight: bold !important; }
        .frame-item:hover .delete-frame-btn { opacity: 1 !important; }
        .delete-frame-btn:hover { background: rgba(128, 0, 0, 1) !important; transform: scale(1.15) !important; }
        
        .timeline-controls { display: flex !important; gap: 6px !important; align-items: center !important; order: 1 !important; }
        .timeline-controls button { padding: 4px 12px !important; background: #ffffee !important; 
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
            border: none !important; 
            border-radius: 6px !important; 
            padding: 2px 6px !important; 
            background: transparent !important; 
            transition: none !important; 
            height: 28px !important; 
        }
        
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
            background: #ffffee !important; 
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
        #repeat-btn.repeat-active { background: #aa5a56 !important; color: var(--futaba-background) !important; }
        #repeat-btn.repeat-inactive { background: #ffffee !important; opacity: 0.6 !important; }
        #repeat-btn svg { width: 14px !important; height: 14px !important; }
        .timeline-controls button#play-btn.playing { background: var(--futaba-maroon) !important; color: white !important; }
    `;
            document.head.appendChild(style);
        }
        
        ensureInitialFrame() {
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
            document.getElementById('add-frame-btn')?.addEventListener('click', () => {
                this.animationSystem.createNewEmptyCut();
            });
            document.getElementById('copy-paste-frame-btn')?.addEventListener('click', () => this.executeFrameCopyPaste());
            document.getElementById('rename-frames-btn')?.addEventListener('click', () => this.executeRenameFrames());
            document.getElementById('retime-frames-btn')?.addEventListener('click', () => this.executeRetimeFrames());
            document.getElementById('close-timeline')?.addEventListener('click', () => this.hide());
        }
        
        executeFrameCopyPaste() {
            if (!this.eventBus) return;
            this.eventBus.emit('frame:copy-current');
            setTimeout(() => {
                this.eventBus.emit('frame:paste-right-adjacent');
                setTimeout(() => {
                    this.updateFramesListImmediate();
                    this.updateLayerPanelIndicator();
                }, 100);
            }, 50);
        }
        
        executeRenameFrames() {
            if (!this.animationSystem) return;
            this.animationSystem.renameCutsSequentially();
            this.updateFramesListImmediate();
            this.updateLayerPanelIndicator();
        }
        
        executeRetimeFrames() {
            if (!this.animationSystem) return;
            
            const retimeInput = document.getElementById('retime-input');
            if (!retimeInput) return;
            
            const newDuration = parseFloat(retimeInput.value);
            if (isNaN(newDuration) || newDuration <= 0) return;
            
            this.animationSystem.retimeAllCuts(newDuration);
            this.updateFramesListImmediate();
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
            
            this.updateFramesListImmediate();
            
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
        
        goToPreviousFrameSafe() {
            const animData = this.animationSystem.getAnimationData();
            if (animData.cuts.length === 0) return;
            
            let newIndex = this.currentFrameIndex - 1;
            if (newIndex < 0) newIndex = animData.cuts.length - 1;
            
            this.currentFrameIndex = newIndex;
            this.animationSystem.animationData.playback.currentCutIndex = newIndex;
            this.animationSystem.switchToActiveCutSafely(newIndex, false);
            this.setActiveFrame(newIndex);
            this.updateLayerPanelIndicator();
            
            if (this.eventBus) {
                this.eventBus.emit('animation:frame-changed', { frameIndex: newIndex, direction: 'previous' });
            }
        }
        
        goToNextFrameSafe() {
            const animData = this.animationSystem.getAnimationData();
            if (animData.cuts.length === 0) return;
            
            let newIndex = this.currentFrameIndex + 1;
            if (newIndex >= animData.cuts.length) newIndex = 0;
            
            this.currentFrameIndex = newIndex;
            this.animationSystem.animationData.playback.currentCutIndex = newIndex;
            this.animationSystem.switchToActiveCutSafely(newIndex, false);
            this.setActiveFrame(newIndex);
            this.updateLayerPanelIndicator();
            
            if (this.eventBus) {
                this.eventBus.emit('animation:frame-changed', { frameIndex: newIndex, direction: 'next' });
            }
        }
        
        setupAnimationEvents() {
            if (!this.eventBus) return;
            
            this.eventBus.on('animation:play-toggle', () => this.togglePlayStop());
            this.eventBus.on('animation:frame-created', () => {
                this.updateFramesListImmediate();
                this.updateLayerPanelIndicator();
            });
            this.eventBus.on('animation:frame-applied', (data) => {
                this.setActiveFrame(data.cutIndex);
                this.updateLayerPanelIndicator();
            });
            this.eventBus.on('frame:pasted-right-adjacent', (data) => {
                this.currentFrameIndex = data.cutIndex;
                this.updateFramesListImmediate();
                this.updateLayerPanelIndicator();
            });
            this.eventBus.on('animation:thumbnail-generated', (data) => {
                this.updateSingleFrameThumbnail(data.cutIndex);
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
            this.eventBus.on('animation:frame-changed', (data) => {
                this.currentFrameIndex = data.cutIndex;
                this.setActiveFrame(data.cutIndex);
                this.updateLayerPanelIndicator();
            });
            this.eventBus.on('animation:frames-renamed-sequentially', () => {
                this.updateFramesListImmediate();
                this.updateLayerPanelIndicator();
            });
        }
        
        createLayerPanelFrameIndicator() {
            const layerContainer = document.getElementById('layer-panel-container');
            if (!layerContainer) return;
            
            const existingIndicator = layerContainer.querySelector('.frame-indicator');
            if (existingIndicator) existingIndicator.remove();
            
            const frameIndicator = document.createElement('div');
            frameIndicator.className = 'frame-indicator';
            frameIndicator.innerHTML = `
                <button class="frame-nav-btn" id="frame-prev-btn">◀</button>
                <span class="frame-display" id="frame-display">FRAME1</span>
                <button class="frame-nav-btn" id="frame-next-btn">▶</button>
            `;
            
            layerContainer.insertBefore(frameIndicator, layerContainer.firstChild);
            
            document.getElementById('frame-prev-btn')?.addEventListener('click', () => this.goToPreviousFrameSafe());
            document.getElementById('frame-next-btn')?.addEventListener('click', () => this.goToNextFrameSafe());
            
            this.updateLayerPanelIndicator();
        }
        
        updateLayerPanelIndicator() {
            const frameDisplay = document.getElementById('frame-display');
            if (!frameDisplay) return;
            
            const animData = this.animationSystem.getAnimationData();
            const totalFrames = animData.cuts.length;
            
            if (totalFrames === 0) {
                frameDisplay.textContent = 'NO FRAME';
                document.getElementById('frame-prev-btn')?.setAttribute('disabled', 'true');
                document.getElementById('frame-next-btn')?.setAttribute('disabled', 'true');
                return;
            }
            
            const currentFrameName = animData.cuts[this.currentFrameIndex]?.name || `FRAME${this.currentFrameIndex + 1}`;
            frameDisplay.textContent = currentFrameName;
            
            document.getElementById('frame-prev-btn')?.removeAttribute('disabled');
            document.getElementById('frame-next-btn')?.removeAttribute('disabled');
        }
        
        updateFramesList() {
            this.updateFramesListImmediate();
        }
        
        createImprovedFrameItem(frame, index) {
            const frameItem = document.createElement('div');
            frameItem.className = 'frame-item';
            frameItem.dataset.frameIndex = index;
            
            const thumbnailHtml = this.generateFrameThumbnailHTML(frame, index);
            
            frameItem.innerHTML = `
                <div class="frame-thumbnail" data-frame-index="${index}">${thumbnailHtml}</div>
                <div class="frame-name">${frame.name}</div>
                <div class="frame-duration-container">
                    <button class="duration-nav-btn duration-decrease" data-index="${index}">◀</button>
                    <input type="number" class="frame-duration-input" value="${frame.duration.toFixed(2)}" min="0.01" max="10" step="0.01" data-index="${index}">
                    <button class="duration-nav-btn duration-increase" data-index="${index}">▶</button>
                </div>
                <button class="delete-frame-btn" data-index="${index}">×</button>
            `;
            
            this.applyFrameThumbnailAspectRatio(frameItem, index);
            
            frameItem.addEventListener('click', (e) => {
                if (!e.target.classList.contains('delete-frame-btn') &&
                    !e.target.classList.contains('frame-duration-input') &&
                    !e.target.classList.contains('duration-nav-btn')) {
                    this.selectFrameSafely(index);
                }
            });
            
            const decreaseBtn = frameItem.querySelector('.duration-decrease');
            const increaseBtn = frameItem.querySelector('.duration-increase');
            const durationInput = frameItem.querySelector('.frame-duration-input');
            
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
            
            const deleteBtn = frameItem.querySelector('.delete-frame-btn');
            if (deleteBtn) {
                deleteBtn.addEventListener('click', (e) => {
                    this.deleteFrameImmediate(index);
                    e.stopPropagation();
                });
            }
            
            return frameItem;
        }
        
        selectFrameSafely(index) {
            this.currentFrameIndex = index;
            this.animationSystem.animationData.playback.currentCutIndex = index;
            this.animationSystem.switchToActiveCutSafely(index, false);
            this.setActiveFrame(index);
            this.updateLayerPanelIndicator();
        }
        
        generateFrameThumbnailHTML(frame, index) {
            if (frame.thumbnailCanvas) {
                try {
                    const dataUrl = frame.thumbnailCanvas.toDataURL('image/png');
                    return `<img src="${dataUrl}" alt="F${index + 1}" />`;
                } catch (error) {
                    return `<div class="frame-thumbnail-placeholder">ERR</div>`;
                }
            } else {
                return `<div class="frame-thumbnail-placeholder">F${index + 1}</div>`;
            }
        }
        
        applyFrameThumbnailAspectRatio(frameItem, frameIndex) {
            const thumbnail = frameItem.querySelector('.frame-thumbnail');
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
        
        deleteFrameImmediate(index) {
            this.animationSystem.deleteCut(index);
            this.updateFramesListImmediate();
            this.updateLayerPanelIndicator();
        }
        
        setActiveFrame(index) {
            this.currentFrameIndex = index;
            
            this.framesContainer.querySelectorAll('.frame-item').forEach((item, i) => {
                item.classList.toggle('active', i === index);
            });
        }
        
        updateSingleFrameThumbnail(frameIndex) {
            const frameItem = this.framesContainer.querySelector(`[data-frame-index="${frameIndex}"]`);
            if (!frameItem) return;
            
            const thumbnail = frameItem.querySelector('.frame-thumbnail');
            if (!thumbnail) return;
            
            const animData = this.animationSystem.getAnimationData();
            const frame = animData.cuts[frameIndex];
            
            if (frame && frame.thumbnailCanvas) {
                try {
                    const dataUrl = frame.thumbnailCanvas.toDataURL('image/png');
                    thumbnail.innerHTML = `<img src="${dataUrl}" alt="F${frameIndex + 1}" />`;
                    this.applyFrameThumbnailAspectRatio(frameItem, frameIndex);
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

console.log('✅ timeline-ui.js (FRAME改修版) loaded');