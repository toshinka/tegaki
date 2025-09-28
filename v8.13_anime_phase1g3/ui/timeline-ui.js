// ===== ui/timeline-ui.js - サムネイル改善版: 不要ボタン削除・表示時間UI改善 =====
// 【修正完了】サムネイル上の不要な◀▶ボタン削除
// 【修正完了】表示時間入力を◀▶スタイルに変更
// 【修正完了】タイムラインUI窮屈さ解消

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
            
            this.eventBus = window.TegakiEventBus;
            if (!this.eventBus) {
                console.error('TimelineUI: TegakiEventBus not available');
            }
        }
        
        init() {
            console.log('🎬 TimelineUI initialization starting...');
            
            this.timelinePanel = document.getElementById('timeline-panel');
            this.cutsContainer = document.getElementById('cuts-container');
            
            if (!this.timelinePanel || !this.cutsContainer) {
                console.error('Timeline UI elements not found - DOM may not be ready');
                console.error('  - timeline-panel:', !!this.timelinePanel);
                console.error('  - cuts-container:', !!this.cutsContainer);
                
                if (document.readyState !== 'complete') {
                    console.log('🎬 Waiting for DOM ready...');
                    document.addEventListener('DOMContentLoaded', () => {
                        setTimeout(() => this.retryInit(), 100);
                    });
                    return;
                }
                
                this.createTimelineDOM();
            }
            
            this.isVisible = this.timelinePanel.classList.contains('show');
            console.log('🎬 TimelineUI initialized - initial visibility:', this.isVisible);
            
            // GIF Exporter初期化
            if (window.TegakiGIFExporter) {
                this.gifExporter = new window.TegakiGIFExporter(
                    this.animationSystem, 
                    this.animationSystem.app
                );
            }
            
            // 【修正】改善されたタイムラインレイアウト適用
            this.updateTimelineLayoutImproved();
            this.addImprovedTimelineCSS();
            
            this.setupEventListeners();
            this.setupKeyboardShortcuts();
            this.setupAnimationEvents();
            this.createLayerPanelCutIndicator();
            this.ensureInitialCut();
            
            console.log('✅ TimelineUI initialized (サムネイル改善版)');
        }
        
        createTimelineDOM() {
            console.log('🎬 Creating timeline DOM elements as fallback...');
            
            if (!this.timelinePanel) {
                this.timelinePanel = document.createElement('div');
                this.timelinePanel.id = 'timeline-panel';
                this.timelinePanel.className = 'timeline-panel';
                this.timelinePanel.style.cssText = 'display:none; position:fixed; left:10px; bottom:10px; z-index:1500;';
                
                const timelineHeader = document.createElement('div');
                timelineHeader.className = 'timeline-header';
                timelineHeader.innerHTML = `
                    <button id="close-timeline">×</button>
                    <div id="cut-display">CUT1</div>
                `;
                
                const timelineBody = document.createElement('div');
                timelineBody.className = 'timeline-body';
                
                const cutsContainer = document.createElement('div');
                cutsContainer.id = 'cuts-container';
                cutsContainer.className = 'cuts-container';
                timelineBody.appendChild(cutsContainer);
                
                const timelineBottom = document.createElement('div');
                timelineBottom.className = 'timeline-bottom';
                
                this.timelinePanel.appendChild(timelineHeader);
                this.timelinePanel.appendChild(timelineBody);
                this.timelinePanel.appendChild(timelineBottom);
                
                document.body.appendChild(this.timelinePanel);
                console.log('✅ Timeline panel DOM created');
            }
            
            if (!this.cutsContainer) {
                this.cutsContainer = document.getElementById('cuts-container') || 
                    this.timelinePanel.querySelector('#cuts-container');
            }
            
            if (!this.cutsContainer) {
                console.error('Failed to create cuts-container');
                return;
            }
            
            console.log('✅ Timeline DOM elements ready');
        }
        
        retryInit() {
            console.log('🎬 Retrying TimelineUI initialization...');
            this.timelinePanel = document.getElementById('timeline-panel');
            this.cutsContainer = document.getElementById('cuts-container');
            
            if (this.timelinePanel && this.cutsContainer) {
                this.init(); 
            } else {
                console.error('Timeline DOM elements still not available after retry');
            }
        }
        
        // 【修正】改善されたタイムラインレイアウト
        updateTimelineLayoutImproved() {
            const timelineBottom = this.timelinePanel.querySelector('.timeline-bottom');
            if (!timelineBottom) {
                console.error('Timeline bottom container not found');
                return;
            }
            
            timelineBottom.innerHTML = `
                <!-- 左側：FPS設定とCUT追加 -->
                <div class="timeline-settings">
                    <label>FPS: 
                        <input type="number" id="fps-input" min="1" max="60" value="12">
                    </label>
                    <button id="add-cut-btn" title="CUT追加 (Alt+Plus)">+CUT</button>
                </div>
                
                <!-- 中央：再生コントロール -->
                <div class="timeline-controls">
                    <button id="loop-btn" class="timeline-loop-btn" title="ループ切り替え">
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" 
                             stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                            <path d="m17 2 4 4-4 4"/>
                            <path d="M3 11v-1a4 4 0 0 1 4-4h14"/>
                            <path d="m7 22-4-4 4-4"/>
                            <path d="M21 13v1a4 4 0 0 1-4 4H3"/>
                        </svg>
                    </button>
                    
                    <button id="play-btn" title="再生/停止 (Space / Alt+Space)">▶</button>
                </div>
                
                <!-- 右側：GIF書き出し -->
                <div class="timeline-settings">
                    <button id="export-gif-btn" title="GIF書き出し">GIF</button>
                </div>
                
                <button class="timeline-close" id="close-timeline">×</button>
            `;
            
            console.log('✅ Timeline layout updated (改善版)');
        }
        
        // 【修正】改善されたタイムライン用CSS
        addImprovedTimelineCSS() {
            const style = document.createElement('style');
            style.textContent = `
                /* 【修正】改善されたタイムラインCSS - サムネイル不要ボタン削除・表示時間UI改善 */
                
                .timeline-loop-btn {
                    padding: 4px 8px !important;
                    background: var(--futaba-background) !important;
                    border: 1px solid var(--futaba-medium) !important;
                    border-radius: 4px !important;
                    cursor: pointer !important;
                    transition: all 0.2s ease !important;
                    font-size: 11px !important;
                    color: var(--futaba-maroon) !important;
                    min-width: 32px !important;
                    height: 24px !important;
                    display: flex !important;
                    align-items: center !important;
                    justify-content: center !important;
                    font-weight: 600 !important;
                    margin-right: 8px !important;
                }
                
                .timeline-loop-btn.active {
                    background: var(--futaba-maroon) !important;
                    color: var(--futaba-background) !important;
                    border-color: var(--futaba-maroon) !important;
                    box-shadow: 0 2px 4px rgba(128, 0, 0, 0.3) !important;
                }
                
                .timeline-loop-btn:hover {
                    background: var(--futaba-medium) !important;
                    border-color: var(--futaba-maroon) !important;
                    transform: translateY(-1px) !important;
                }
                
                .timeline-loop-btn svg {
                    width: 14px !important;
                    height: 14px !important;
                }
                
                .timeline-controls {
                    display: flex !important;
                    gap: 4px !important;
                    align-items: center !important;
                    flex: 1 !important;
                    justify-content: center !important;
                }
                
                .timeline-settings {
                    display: flex !important;
                    gap: 8px !important;
                    font-size: 10px !important;
                    align-items: center !important;
                    color: var(--futaba-maroon) !important;
                }
                
                #add-cut-btn {
                    padding: 4px 8px !important;
                    background: var(--futaba-background) !important;
                    border: 1px solid var(--futaba-medium) !important;
                    border-radius: 4px !important;
                    cursor: pointer !important;
                    transition: all 0.2s ease !important;
                    font-size: 11px !important;
                    color: var(--futaba-maroon) !important;
                    min-width: 32px !important;
                    height: 24px !important;
                    display: flex !important;
                    align-items: center !important;
                    justify-content: center !important;
                    font-weight: 600 !important;
                    margin-left: 8px !important;
                }
                
                #add-cut-btn:hover {
                    background: var(--futaba-medium) !important;
                    border-color: var(--futaba-maroon) !important;
                    transform: translateY(-1px) !important;
                }
                
                #export-gif-btn {
                    padding: 4px 8px !important;
                    background: var(--futaba-maroon) !important;
                    color: var(--futaba-background) !important;
                    border: 1px solid var(--futaba-maroon) !important;
                    border-radius: 4px !important;
                    cursor: pointer !important;
                    transition: all 0.2s ease !important;
                    font-size: 11px !important;
                    min-width: 32px !important;
                    height: 24px !important;
                    display: flex !important;
                    align-items: center !important;
                    justify-content: center !important;
                    font-weight: 600 !important;
                }
                
                #export-gif-btn:hover {
                    background: var(--futaba-light-maroon) !important;
                    transform: translateY(-1px) !important;
                }
                
                /* 【修正】改善されたCUTアイテムレイアウト - サムネイル不要ボタン削除 */
                .cut-item {
                    min-width: 52px !important;
                    background: var(--futaba-background) !important;
                    border: 1px solid var(--futaba-light-medium) !important;
                    border-radius: 4px !important;
                    padding: 3px !important;
                    cursor: pointer !important;
                    position: relative !important;
                    transition: all 0.2s ease !important;
                    flex-shrink: 0 !important;
                    display: flex !important;
                    flex-direction: column !important;
                    align-items: center !important;
                    box-shadow: 0 1px 3px rgba(128, 0, 0, 0.1) !important;
                }

                .cut-item:hover {
                    border-color: var(--futaba-medium) !important;
                    transform: translateY(-1px) !important;
                    box-shadow: 0 2px 6px rgba(128, 0, 0, 0.15) !important;
                }

                .cut-item.active {
                    border-color: var(--futaba-maroon) !important;
                    background: var(--futaba-light-medium) !important;
                    box-shadow: 0 0 0 2px rgba(128, 0, 0, 0.3) !important;
                    transform: translateY(-1px) !important;
                }

                .cut-thumbnail {
                    width: 46px !important;
                    height: 34px !important;
                    background: var(--futaba-background) !important;
                    border: 1px solid var(--futaba-light-medium) !important;
                    border-radius: 3px !important;
                    overflow: hidden !important;
                    margin-bottom: 2px !important;
                    position: relative !important;
                    /* 【修正】サムネイルナビゲーションボタンを削除 */
                }

                .cut-thumbnail img {
                    width: 100% !important;
                    height: 100% !important;
                    object-fit: cover !important;
                }

                .cut-thumbnail-placeholder {
                    width: 100% !important;
                    height: 100% !important;
                    background: linear-gradient(45deg, var(--futaba-light-medium) 25%, transparent 25%), 
                                linear-gradient(-45deg, var(--futaba-light-medium) 25%, transparent 25%), 
                                linear-gradient(45deg, transparent 75%, var(--futaba-light-medium) 75%), 
                                linear-gradient(-45deg, transparent 75%, var(--futaba-light-medium) 75%) !important;
                    background-size: 6px 6px !important;
                    background-position: 0 0, 0 3px, 3px -3px, -3px 0px !important;
                    display: flex !important;
                    align-items: center !important;
                    justify-content: center !important;
                    color: var(--futaba-maroon) !important;
                    font-size: 7px !important;
                    font-weight: bold !important;
                }

                .cut-name {
                    font-size: 8px !important;
                    color: var(--futaba-maroon) !important;
                    margin-bottom: 2px !important;
                    font-weight: 600 !important;
                    text-align: center !important;
                    white-space: nowrap !important;
                    overflow: hidden !important;
                    text-overflow: ellipsis !important;
                    max-width: 46px !important;
                    line-height: 1.2 !important;
                }

                /* 【修正】改善された表示時間入力 - ◀▶スタイル */
                .cut-duration-container {
                    width: 46px !important;
                    height: 16px !important;
                    display: flex !important;
                    align-items: center !important;
                    border: 1px solid var(--futaba-light-medium) !important;
                    border-radius: 3px !important;
                    background: var(--futaba-background) !important;
                    overflow: hidden !important;
                    margin-bottom: 2px !important;
                }
                
                .duration-decrease, .duration-increase {
                    width: 12px !important;
                    height: 100% !important;
                    background: var(--futaba-light-medium) !important;
                    border: none !important;
                    color: var(--futaba-maroon) !important;
                    font-size: 8px !important;
                    font-weight: bold !important;
                    cursor: pointer !important;
                    transition: all 0.15s ease !important;
                    display: flex !important;
                    align-items: center !important;
                    justify-content: center !important;
                    line-height: 1 !important;
                }
                
                .duration-decrease:hover, .duration-increase:hover {
                    background: var(--futaba-medium) !important;
                    color: var(--futaba-maroon) !important;
                }
                
                .duration-decrease:active, .duration-increase:active {
                    background: var(--futaba-maroon) !important;
                    color: var(--futaba-background) !important;
                }
                
                .cut-duration {
                    flex: 1 !important;
                    height: 100% !important;
                    border: none !important;
                    background: transparent !important;
                    text-align: center !important;
                    font-size: 7px !important;
                    font-family: monospace !important;
                    color: var(--futaba-maroon) !important;
                    padding: 0 1px !important;
                    outline: none !important;
                }
                
                .cut-duration:focus {
                    background: var(--futaba-cream) !important;
                }

                .delete-cut-btn {
                    position: absolute !important;
                    top: -3px !important;
                    right: -3px !important;
                    width: 14px !important;
                    height: 14px !important;
                    background: rgba(128, 0, 0, 0.9) !important;
                    border: none !important;
                    border-radius: 50% !important;
                    color: white !important;
                    font-size: 8px !important;
                    line-height: 1 !important;
                    cursor: pointer !important;
                    opacity: 0 !important;
                    transition: all 0.2s ease !important;
                    display: flex !important;
                    align-items: center !important;
                    justify-content: center !important;
                    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3) !important;
                }

                .cut-item:hover .delete-cut-btn {
                    opacity: 1 !important;
                }

                .delete-cut-btn:hover {
                    background: rgba(128, 0, 0, 1) !important;
                    transform: scale(1.1) !important;
                }
                
                /* 【削除】サムネイルナビゲーションボタン関連のCSS削除 */
                /* .thumb-nav-btn, .thumb-nav-left, .thumb-nav-right は削除 */
            `;
            
            document.head.appendChild(style);
            console.log('✅ Improved Timeline CSS added (サムネイル改善版)');
        }
        
        ensureInitialCut() {
            const animData = this.animationSystem.getAnimationData();
            if (animData.cuts.length === 0) {
                this.animationSystem.createNewCutFromCurrentLayers();
                console.log('🎬 Initial CUT1 created with improved structure');
            }
            
            this.updateLayerPanelIndicator();
        }
        
        setupEventListeners() {
            console.log('🎬 Setting up TimelineUI event listeners...');
            
            if (!this.eventBus) {
                console.error('TimelineUI: Cannot setup event listeners - EventBus not available');
                return;
            }
            
            this.eventBus.on('ui:toggle-timeline', () => {
                console.log('🎬 Received ui:toggle-timeline event');
                this.toggle();
            });
            
            this.eventBus.on('ui:show-timeline', () => {
                console.log('🎬 Received ui:show-timeline event');
                this.show();
            });
            
            this.eventBus.on('ui:hide-timeline', () => {
                console.log('🎬 Received ui:hide-timeline event');
                this.hide();
            });
            
            this.setupImprovedButtonListeners();
            
            console.log('✅ TimelineUI event listeners setup completed');
        }
        
        // 【修正】改善されたボタンリスナー
        setupImprovedButtonListeners() {
            // ループボタン
            const loopBtn = document.getElementById('loop-btn');
            if (loopBtn) {
                loopBtn.addEventListener('click', () => {
                    this.toggleLoop();
                });
                this.updateLoopButtonState();
            }
            
            // 再生/停止ボタン
            const playBtn = document.getElementById('play-btn');
            if (playBtn) {
                playBtn.addEventListener('click', () => {
                    this.togglePlayStop();
                });
            }
            
            // CUT追加ボタン
            const addCutBtn = document.getElementById('add-cut-btn');
            if (addCutBtn) {
                addCutBtn.addEventListener('click', () => {
                    const newCut = this.animationSystem.createNewEmptyCut();
                    const newCutIndex = this.animationSystem.getCutCount() - 1;
                    this.animationSystem.switchToActiveCut(newCutIndex);
                    console.log('🎬 New empty CUT created and switched');
                });
            }
            
            // GIF書き出しボタン
            const exportGifBtn = document.getElementById('export-gif-btn');
            if (exportGifBtn) {
                exportGifBtn.addEventListener('click', () => {
                    this.exportGIF();
                });
            }
            
            // パネル閉じる
            const closeBtn = document.getElementById('close-timeline');
            if (closeBtn) {
                closeBtn.addEventListener('click', () => {
                    this.hide();
                });
            }
            
            // 設定変更
            const fpsInput = document.getElementById('fps-input');
            if (fpsInput) {
                fpsInput.addEventListener('change', (e) => {
                    const fps = parseInt(e.target.value);
                    this.animationSystem.updateSettings({ fps: fps });
                });
            }
        }
        
        togglePlayStop() {
            if (this.isPlaying) {
                this.animationSystem.stop();
            } else {
                this.animationSystem.play();
            }
        }
        
        toggleLoop() {
            this.isLooping = !this.isLooping;
            this.updateLoopButtonState();
            
            this.animationSystem.updateSettings({ loop: this.isLooping });
            
            if (this.eventBus) {
                this.eventBus.emit('animation:loop:set', this.isLooping);
            }
            
            console.log('🔄 Loop toggled:', this.isLooping ? 'ON' : 'OFF');
        }
        
        updateLoopButtonState() {
            const loopBtn = document.getElementById('loop-btn');
            if (loopBtn) {
                loopBtn.classList.toggle('active', this.isLooping);
                loopBtn.title = `ループ: ${this.isLooping ? 'ON' : 'OFF'}`;
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
            if (!this.timelinePanel) {
                console.error('TimelineUI: Cannot show - timeline panel not found');
                return;
            }
            
            this.isVisible = true;
            this.timelinePanel.style.display = 'block';
            this.timelinePanel.classList.add('show');
            
            if (this.timelinePanel.style.zIndex < 1500) {
                this.timelinePanel.style.zIndex = '1500';
            }
            
            this.updateCutsList();
            console.log('✅ Timeline panel shown');
            
            if (this.eventBus) {
                this.eventBus.emit('timeline:shown');
            }
        }
        
        hide() {
            if (!this.timelinePanel) {
                return;
            }
            
            this.isVisible = false;
            this.timelinePanel.classList.remove('show');
            
            setTimeout(() => {
                if (!this.isVisible) {
                    this.timelinePanel.style.display = 'none';
                }
            }, 300);
            
            console.log('✅ Timeline panel hidden');
            
            if (this.eventBus) {
                this.eventBus.emit('timeline:hidden');
            }
        }
        
        setupKeyboardShortcuts() {
            document.addEventListener('keydown', (e) => {
                if (!this.isVisible) return;
                
                switch (e.code) {
                    case 'Space':
                        if (!e.ctrlKey && !e.altKey) {
                            this.togglePlayStop();
                            e.preventDefault();
                        }
                        break;
                        
                    case 'ArrowLeft':
                        this.animationSystem.goToPreviousFrame();
                        e.preventDefault();
                        break;
                        
                    case 'ArrowRight':
                        this.animationSystem.goToNextFrame();
                        e.preventDefault();
                        break;
                        
                    case 'Equal': // Plus key
                        if (e.altKey) {
                            const newCut = this.animationSystem.createNewEmptyCut();
                            const newCutIndex = this.animationSystem.getCutCount() - 1;
                            this.animationSystem.switchToActiveCut(newCutIndex);
                            e.preventDefault();
                        }
                        break;
                }
            });
            
            console.log('✅ Timeline keyboard shortcuts updated');
            console.log('   - Space: Play/Stop toggle (timeline visible only)');
            console.log('   - ALT+Space: Global play/stop toggle (via CoreRuntime)');
        }
        
        setupAnimationEvents() {
            if (!this.eventBus) return;
            
            this.eventBus.on('animation:play-toggle', () => {
                console.log('🎬 Received animation:play-toggle event from ALT+Space');
                this.togglePlayStop();
            });
            
            this.eventBus.on('animation:cut-created', () => {
                this.updateCutsList();
                this.updateLayerPanelIndicator();
            });
            
            this.eventBus.on('animation:cut-applied', (data) => {
                this.setActiveCut(data.cutIndex);
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
                this.setActiveCut(0);
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
            
            this.eventBus.on('gif:export-failed', (data) => {
                this.hideExportProgress();
                console.error('GIF export failed:', data.error);
            });
        }
        
        createLayerPanelCutIndicator() {
            const layerContainer = document.getElementById('layer-panel-container');
            if (!layerContainer) return;
            
            const existingIndicator = layerContainer.querySelector('.cut-indicator');
            if (existingIndicator) {
                existingIndicator.remove();
            }
            
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
            
            document.getElementById('cut-prev-btn')?.addEventListener('click', () => {
                this.goToPreviousCut();
            });
            
            document.getElementById('cut-next-btn')?.addEventListener('click', () => {
                this.goToNextCut();
            });
            
            this.updateLayerPanelIndicator();
            console.log('✅ Layer panel CUT indicator created');
        }
        
        updateLayerPanelIndicator() {
            const cutDisplay = document.getElementById('cut-display');
            const prevBtn = document.getElementById('cut-prev-btn');
            const nextBtn = document.getElementById('cut-next-btn');
            
            if (!cutDisplay) return;
            
            const animData = this.animationSystem.getAnimationData();
            const totalCuts = animData.cuts.length;
            
            if (totalCuts === 0) {
                cutDisplay.textContent = 'NO CUT';
                if (prevBtn) prevBtn.disabled = true;
                if (nextBtn) nextBtn.disabled = true;
                return;
            }
            
            const currentCutName = animData.cuts[this.currentCutIndex]?.name || `CUT${this.currentCutIndex + 1}`;
            cutDisplay.textContent = currentCutName;
            
            if (prevBtn) prevBtn.disabled = this.currentCutIndex <= 0;
            if (nextBtn) nextBtn.disabled = this.currentCutIndex >= totalCuts - 1;
        }
        
        goToPreviousCut() {
            const animData = this.animationSystem.getAnimationData();
            if (this.currentCutIndex > 0) {
                const newIndex = this.currentCutIndex - 1;
                this.animationSystem.switchToActiveCut(newIndex);
            }
        }
        
        goToNextCut() {
            const animData = this.animationSystem.getAnimationData();
            if (this.currentCutIndex < animData.cuts.length - 1) {
                const newIndex = this.currentCutIndex + 1;
                this.animationSystem.switchToActiveCut(newIndex);
            }
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
        
        // 【修正】改善されたCUTアイテム作成（サムネイルナビゲーションボタン削除）
        createImprovedCutItem(cut, index) {
            const cutItem = document.createElement('div');
            cutItem.className = 'cut-item';
            cutItem.dataset.cutIndex = index;
            
            const thumbnailHtml = this.generateCutThumbnailHTML(cut, index);
            
            cutItem.innerHTML = `
                <div class="cut-thumbnail" data-cut-index="${index}">
                    ${thumbnailHtml}
                </div>
                <div class="cut-name">${cut.name}</div>
                <div class="cut-duration-container">
                    <button class="duration-decrease" data-index="${index}" title="時間減少">◀</button>
                    <input type="number" class="cut-duration" 
                           value="${cut.duration}" 
                           min="0.1" max="10" step="0.1"
                           title="表示時間（秒）"
                           data-index="${index}">
                    <button class="duration-increase" data-index="${index}" title="時間増加">▶</button>
                </div>
                <button class="delete-cut-btn" data-index="${index}">×</button>
            `;
            
            // CUT選択
            cutItem.addEventListener('click', (e) => {
                if (!e.target.classList.contains('delete-cut-btn') &&
                    !e.target.classList.contains('cut-duration') &&
                    !e.target.classList.contains('duration-decrease') &&
                    !e.target.classList.contains('duration-increase')) {
                    this.animationSystem.switchToActiveCut(index);
                    this.setActiveCut(index);
                }
            });
            
            // 【修正】改善された表示時間制御
            const decreaseBtn = cutItem.querySelector('.duration-decrease');
            const increaseBtn = cutItem.querySelector('.duration-increase');
            const durationInput = cutItem.querySelector('.cut-duration');
            
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
                    this.animationSystem.updateCutDuration(index, newDuration);
                    e.stopPropagation();
                });
                
                durationInput.addEventListener('click', (e) => {
                    e.stopPropagation();
                });
            }
            
            // CUT削除
            const deleteBtn = cutItem.querySelector('.delete-cut-btn');
            deleteBtn.addEventListener('click', (e) => {
                this.deleteCut(index);
                e.stopPropagation();
            });
            
            return cutItem;
        }
        
        generateCutThumbnailHTML(cut, index) {
            if (cut.thumbnail) {
                return `<img src="${cut.thumbnail}" alt="CUT${index + 1}" />`;
            } else {
                return `<div class="cut-thumbnail-placeholder">CUT${index + 1}</div>`;
            }
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
            
            if (cut && cut.thumbnail) {
                thumbnail.innerHTML = `<img src="${cut.thumbnail}" alt="CUT${cutIndex + 1}" />`;
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
            } else {
                console.error('GIF Exporter not available');
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
        
        getDebugInfo() {
            return {
                isVisible: this.isVisible,
                isPlaying: this.isPlaying,
                isLooping: this.isLooping,
                currentCutIndex: this.currentCutIndex,
                hasEventBus: !!this.eventBus,
                hasAnimationSystem: !!this.animationSystem,
                hasTimelinePanel: !!this.timelinePanel,
                hasCutsContainer: !!this.cutsContainer
            };
        }
    }
    
    window.TegakiTimelineUI = TimelineUI;
    console.log('✅ TegakiTimelineUI exported to global scope');
    console.log('✅ ui/timeline-ui.js loaded (サムネイル改善版)');
    console.log('🔧 改善完了:');
    console.log('  - 🔧 サムネイル上の不要な◀▶ボタン削除');
    console.log('  - 🔧 表示時間入力を◀▶スタイルに変更');
    console.log('  - 🔧 タイムラインUI窮屈さ解消');
    console.log('  - 🔧 改善されたCUTアイテムレイアウト');
    console.log('  - ✅ 直感的な表示時間制御UI実装');
    
    if (typeof window.TegakiUI === 'undefined') {
        window.TegakiUI = {};
    }
    window.TegakiUI.TimelineUI = TimelineUI;

})();