// ===== ui/timeline-ui.js - Canvas直接使用+CSS動的調整版 =====
// 【改修完了】Canvas.toDataURL()直接使用（Texture往復排除）
// 【改修完了】CSS動的調整でキャンバス比率対応
// 【改修完了】構文エラー修正・PixiJS v8.13完全対応

(function() {
    'use strict';
    
    class TimelineUI {
        constructor(animationSystem) {
            this.animationSystem = animationSystem;
            this.timelinePanel = null;
            this.cutsContainer = null;
            this.sortable = null;
            this.isVisible = false;
            this.gifExporter = null;
            this.currentCutIndex = 0;
            this.isPlaying = false;
            this.isLooping = true;
            this.isInitialized = false;
            this.domCreated = false;
            
            this.eventBus = window.TegakiEventBus;
        }
        
        init() {
            if (this.isInitialized) return;
            
            this.removeExistingTimelineElements();
            this.createCompleteTimelineStructure();
            this.injectCompleteTimelineCSS();
            
            if (window.TegakiGIFExporter) {
                this.gifExporter = new window.TegakiGIFExporter(
                    this.animationSystem, 
                    this.animationSystem.app
                );
            }
            
            this.setupEventListeners();
            this.setupKeyboardShortcuts();
            this.setupAnimationEvents();
            this.createLayerPanelCutIndicator();
            this.ensureInitialCut();
            
            this.isInitialized = true;
            console.log('✅ TimelineUI: Canvas直接使用+CSS動的調整版 初期化完了');
        }
        
        removeExistingTimelineElements() {
            ['timeline-panel', 'cuts-container', 'timeline-bottom', 'timeline-controls', 'export-progress'].forEach(id => {
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
            
            this.cutsContainer = document.createElement('div');
            this.cutsContainer.id = 'cuts-container';
            this.cutsContainer.className = 'cuts-container';
            this.cutsContainer.dataset.source = 'timeline-ui';
            
            const timelineBottom = document.createElement('div');
            timelineBottom.className = 'timeline-bottom';
            timelineBottom.dataset.source = 'timeline-ui';
            timelineBottom.innerHTML = `
                <div class="timeline-settings">
                    <label>FPS: <input type="number" id="fps-input" min="1" max="60" value="12"></label>
                </div>
                <div class="timeline-controls">
                    <button id="repeat-btn" title="リピート (R)" class="repeat-active">
                        <svg xmlns="http://www.w3.org/2000/svg" width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                            <path d="m17 2 4 4-4 4"/><path d="M3 11v-1a4 4 0 0 1 4-4h14"/>
                            <path d="m7 22-4-4 4-4"/><path d="M21 13v1a4 4 0 0 1-4 4H3"/>
                        </svg>
                    </button>
                    <button id="play-btn" title="再生/停止 (Space)">▶</button>
                    <button id="add-cut-btn" title="CUT追加 (Alt+=)">+CUT</button>
                    <button id="copy-paste-cut-btn" title="CUTコピペ (Shift+C)" class="copy-paste-btn">+C&P</button>
                    <button id="export-gif-btn" title="GIF書き出し">GIF</button>
                </div>
                <button class="timeline-close" id="close-timeline">×</button>
            `;
            
            const exportProgress = document.createElement('div');
            exportProgress.className = 'export-progress';
            exportProgress.id = 'export-progress';
            exportProgress.dataset.source = 'timeline-ui';
            exportProgress.style.display = 'none';
            exportProgress.innerHTML = `
                <div class="progress-bar"><div class="progress-fill" id="progress-fill"></div></div>
                <span id="progress-text">0%</span>
            `;
            
            this.timelinePanel.appendChild(this.cutsContainer);
            this.timelinePanel.appendChild(timelineBottom);
            this.timelinePanel.appendChild(exportProgress);
            document.body.appendChild(this.timelinePanel);
            
            this.domCreated = true;
        }
        
        injectCompleteTimelineCSS() {
            if (document.querySelector('style[data-timeline="timeline-ui"]')) return;
            
            const style = document.createElement('style');
            style.dataset.timeline = 'timeline-ui';
            style.textContent = `
                .timeline-panel { position: fixed !important; bottom: 12px !important; left: 70px !important; right: 220px !important; 
                    background: rgba(240, 224, 214, 0.95) !important; border: 2px solid var(--futaba-medium) !important; 
                    border-radius: 12px !important; padding: 8px 10px !important; z-index: 1500 !important; max-height: 180px !important; 
                    display: none !important; box-shadow: 0 6px 16px rgba(128, 0, 0, 0.25) !important; backdrop-filter: blur(12px) !important; }
                .timeline-panel.show { display: block !important; animation: slideUp 0.35s ease-out !important; }
                @keyframes slideUp { from { opacity: 0; transform: translateY(25px) scale(0.96); } to { opacity: 1; transform: translateY(0) scale(1); } }
                .cuts-container { display: flex !important; gap: 6px !important; overflow-x: auto !important; padding: 3px 0 8px 0 !important; 
                    margin-bottom: 8px !important; max-height: 140px !important; }
                .cuts-container::-webkit-scrollbar { height: 10px !important; }
                .cuts-container::-webkit-scrollbar-track { background: var(--futaba-light-medium) !important; border-radius: 5px !important; }
                .cuts-container::-webkit-scrollbar-thumb { background: var(--futaba-maroon) !important; border-radius: 5px !important; }
                .cut-item { min-width: 85px !important; background: var(--futaba-background) !important; 
                    border: 2px solid var(--futaba-light-medium) !important; border-radius: 8px !important; padding: 2px !important; 
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
                .cut-duration-input { width: 30px !important; height: 18px !important; border: 1px solid var(--futaba-light-medium) !important; 
                    border-radius: 3px !important; background: var(--futaba-background) !important; font-size: 8px !important; 
                    font-family: monospace !important; color: var(--futaba-maroon) !important; font-weight: bold !important; 
                    text-align: center !important; outline: none !important; padding: 0 !important; -moz-appearance: textfield !important; }
                .cut-duration-input::-webkit-outer-spin-button, .cut-duration-input::-webkit-inner-spin-button { -webkit-appearance: none !important; margin: 0 !important; }
                .duration-nav-btn { width: 16px !important; height: 16px !important; background: var(--futaba-medium) !important; 
                    border: none !important; border-radius: 2px !important; color: var(--futaba-background) !important; 
                    font-size: 10px !important; cursor: pointer !important; display: flex !important; align-items: center !important; 
                    justify-content: center !important; font-weight: bold !important; padding: 0 !important; }
                .duration-nav-btn:hover { background: var(--futaba-light-maroon) !important; transform: scale(1.1) !important; }
                .delete-cut-btn { position: absolute !important; top: -4px !important; right: -4px !important; width: 18px !important; 
                    height: 18px !important; background: rgba(128, 0, 0, 0.9) !important; border: none !important; border-radius: 50% !important; 
                    color: white !important; font-size: 10px !important; cursor: pointer !important; opacity: 0 !important; 
                    display: flex !important; align-items: center !important; justify-content: center !important; font-weight: bold !important; }
                .cut-item:hover .delete-cut-btn { opacity: 1 !important; }
                .delete-cut-btn:hover { background: rgba(128, 0, 0, 1) !important; transform: scale(1.15) !important; }
                .timeline-bottom { display: flex !important; justify-content: space-between !important; align-items: center !important; 
                    gap: 25px !important; height: 40px !important; padding: 0 4px !important; }
                .timeline-controls { display: flex !important; gap: 6px !important; align-items: center !important; flex: 1 !important; justify-content: center !important; }
                .timeline-controls button { padding: 10px 16px !important; background: var(--futaba-background) !important; 
                    border: 2px solid var(--futaba-medium) !important; border-radius: 8px !important; cursor: pointer !important; 
                    font-size: 12px !important; color: var(--futaba-maroon) !important; min-width: 45px !important; height: 18px !important; 
                    display: flex !important; align-items: center !important; justify-content: center !important; font-weight: 600 !important; }
                .timeline-controls button:hover { background: var(--futaba-medium) !important; border-color: var(--futaba-maroon) !important; 
                    transform: translateY(-1px) !important; }
                .copy-paste-btn { background: var(--futaba-light-medium) !important; font-size: 11px !important; font-weight: 700 !important; min-width: 50px !important; }
                .copy-paste-btn:hover { background: var(--futaba-maroon) !important; color: var(--futaba-background) !important; transform: translateY(-2px) scale(1.05) !important; }
                #repeat-btn { min-width: 40px !important; padding: 8px !important; }
                #repeat-btn.repeat-active { background: var(--futaba-maroon) !important; color: var(--futaba-background) !important; }
                #repeat-btn.repeat-inactive { background: var(--futaba-background) !important; opacity: 0.6 !important; }
                #repeat-btn svg { width: 16px !important; height: 16px !important; }
                .timeline-controls button#play-btn.playing { background: var(--futaba-maroon) !important; color: white !important; }
                .timeline-settings { display: flex !important; gap: 15px !important; font-size: 13px !important; align-items: center !important; }
                .timeline-settings label { display: flex !important; align-items: center !important; gap: 8px !important; font-weight: 600 !important; color: var(--futaba-maroon) !important; }
                .timeline-settings input[type="number"] { width: 55px !important; height: 36px !important; padding: 8px 10px !important; 
                    border: 2px solid var(--futaba-light-medium) !important; border-radius: 6px !important; 
                    background: var(--futaba-background) !important; text-align: center !important; font-size: 13px !important; 
                    font-family: monospace !important; color: var(--futaba-maroon) !important; font-weight: 600 !important; }
                .timeline-close { background: none !important; border: none !important; font-size: 20px !important; 
                    color: var(--futaba-maroon) !important; cursor: pointer !important; padding: 8px 12px !important; 
                    border-radius: 8px !important; height: 36px !important; font-weight: bold !important; min-width: 36px !important; }
                .timeline-close:hover { background: var(--futaba-light-medium) !important; }
                .export-progress { position: absolute !important; bottom: -26px !important; left: 0 !important; right: 0 !important; 
                    background: var(--futaba-cream) !important; border: 2px solid var(--futaba-medium) !important; 
                    border-radius: 0 0 12px 12px !important; padding: 8px 12px !important; display: none !important; z-index: 1501 !important; }
                .progress-bar { width: 100% !important; height: 8px !important; background: var(--futaba-light-medium) !important; 
                    border-radius: 4px !important; overflow: hidden !important; margin-bottom: 6px !important; }
                .progress-fill { height: 100% !important; background: linear-gradient(90deg, var(--futaba-light-maroon), var(--futaba-maroon)) !important; 
                    width: 0% !important; transition: width 0.3s ease !important; border-radius: 4px !important; }
                .export-progress span { font-size: 11px !important; color: var(--futaba-maroon) !important; font-family: monospace !important; font-weight: 600 !important; }
            `;
            document.head.appendChild(style);
        }
        
        ensureInitialCut() {
            const animData = this.animationSystem.getAnimationData();
            if (animData.cuts.length === 0) {
                this.animationSystem.createNewCutFromCurrentLayers();
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
            document.getElementById('export-gif-btn')?.addEventListener('click', () => this.exportGIF());
            document.getElementById('close-timeline')?.addEventListener('click', () => this.hide());
            document.getElementById('fps-input')?.addEventListener('change', (e) => {
                this.animationSystem.updateSettings({ fps: parseInt(e.target.value) });
            });
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
                
                if (e.code === 'Space' && !e.ctrlKey && !e.altKey) {
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
            });
            this.eventBus.on('animation:playback-paused', () => {
                this.isPlaying = false;
                this.updatePlaybackUI(false);
            });
            this.eventBus.on('animation:playback-stopped', () => {
                this.isPlaying = false;
                this.updatePlaybackUI(false);
                this.updateLayerPanelIndicator();
            });
            this.eventBus.on('animation:cut-changed', (data) => {
                this.currentCutIndex = data.cutIndex;
                this.setActiveCut(data.cutIndex);
                this.updateLayerPanelIndicator();
            });
            this.eventBus.on('gif:export-progress', (data) => {
                this.updateExportProgress(data.progress);
            });
            this.eventBus.on('gif:export-completed', () => {
                this.hideExportProgress();
            });
            this.eventBus.on('gif:export-failed', () => {
                this.hideExportProgress();
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
            
            const addButton = layerContainer.querySelector('.layer-add-button');
            if (addButton) {
                layerContainer.insertBefore(cutIndicator, addButton.nextSibling);
            }
            
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
                    <input type="number" class="cut-duration-input" value="${cut.duration}" min="0.1" max="10" step="0.1" data-index="${index}">
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
                    const newValue = Math.max(0.1, currentValue - 0.1);
                    durationInput.value = newValue.toFixed(1);
                    this.animationSystem.updateCutDuration(index, newValue);
                });
            }
            
            if (increaseBtn) {
                increaseBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const currentValue = parseFloat(durationInput.value);
                    const newValue = Math.min(10, currentValue + 0.1);
                    durationInput.value = newValue.toFixed(1);
                    this.animationSystem.updateCutDuration(index, newValue);
                });
            }
            
            if (durationInput) {
                durationInput.addEventListener('change', (e) => {
                    const newDuration = parseFloat(e.target.value);
                    if (!isNaN(newDuration) && newDuration > 0) {
                        this.animationSystem.updateCutDuration(index, newDuration);
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
                    this.deleteCut(index);
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
                    console.error('Thumbnail conversion failed:', error);
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
        
        deleteCut(index) {
            if (!confirm('このCUTを削除しますか？')) return;
            
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
                    console.error('Thumbnail update failed:', error);
                }
            }
        }
        
        async refreshAllCutThumbnails() {
            const animData = this.animationSystem.getAnimationData();
            
            for (let i = 0; i < animData.cuts.length; i++) {
                await this.animationSystem.generateCutThumbnailOptimized(i);
                this.updateSingleCutThumbnail(i);
            }
        }
        
        updatePlaybackUI(isPlaying) {
            const playBtn = document.getElementById('play-btn');
            if (playBtn) {
                playBtn.textContent = isPlaying ? '⏸' : '▶';
                playBtn.classList.toggle('playing', isPlaying);
            }
        }
        
        exportGIF() {
            if (this.gifExporter) {
                const animData = this.animationSystem.getAnimationData();
                this.gifExporter.export(animData);
                this.showExportProgress();
            }
        }
        
        showExportProgress() {
            const progressPanel = document.getElementById('export-progress');
            if (progressPanel) {
                progressPanel.style.display = 'block';
                this.timelinePanel.classList.add('exporting');
            }
        }
        
        updateExportProgress(progress) {
            const progressFill = document.getElementById('progress-fill');
            const progressText = document.getElementById('progress-text');
            
            if (progressFill) {
                progressFill.style.width = progress + '%';
            }
            
            if (progressText) {
                progressText.textContent = Math.round(progress) + '%';
            }
        }
        
        hideExportProgress() {
            const progressPanel = document.getElementById('export-progress');
            if (progressPanel) {
                progressPanel.style.display = 'none';
                this.timelinePanel.classList.remove('exporting');
            }
        }
    }
    
    window.TegakiTimelineUI = TimelineUI;
    
    if (typeof window.TegakiUI === 'undefined') {
        window.TegakiUI = {};
    }
    window.TegakiUI.TimelineUI = TimelineUI;
    
    console.log('✅ timeline-ui.js loaded (Canvas直接使用+CSS動的調整版)');
    console.log('🔧 改修完了:');
    console.log('  - Canvas.toDataURL()直接使用（Texture往復排除）');
    console.log('  - applyCutThumbnailAspectRatio()でキャンバス比率対応');
    console.log('  - 構文エラー修正・PixiJS v8.13完全対応');

})();