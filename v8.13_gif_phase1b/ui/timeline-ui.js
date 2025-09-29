// ===== ui/timeline-ui.js - CUTコピペボタン追加・方向キー修正版 =====
// 【修正内容】
// - CUTコピー・ペーストボタン追加（+CUTの隣に+C&P）
// - 方向キー左右の動作修正（左右の方向が逆→正常化）
// - レイヤー消失問題修正（単純なアクティブCUT移動に変更）

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
            if (!this.eventBus) {
                console.error('TimelineUI: TegakiEventBus not available');
            }
        }
        
        init() {
            console.log('🎬 TimelineUI initialization starting (CUTコピペボタン追加・方向キー修正版)...');
            
            if (this.isInitialized) {
                console.warn('TimelineUI already initialized, skipping duplicate init');
                return;
            }
            
            this.removeExistingTimelineElements();
            this.createCompleteTimelineStructure();
            this.injectCompleteTimelineCSS();
            
            // GIF Exporter初期化
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
            console.log('✅ TimelineUI initialized (CUTコピペボタン追加・方向キー修正版)');
        }
        
        removeExistingTimelineElements() {
            console.log('🧹 Removing existing timeline elements to prevent duplication...');
            
            const existingElements = [
                'timeline-panel',
                'cuts-container', 
                'timeline-bottom',
                'timeline-controls',
                'export-progress'
            ];
            
            existingElements.forEach(id => {
                const element = document.getElementById(id);
                if (element && !element.dataset.source) {
                    console.log(`🧹 Removing duplicate element: ${id}`);
                    element.remove();
                }
            });
            
            const existingStyles = document.querySelectorAll('style[data-timeline]');
            existingStyles.forEach(style => {
                if (style.dataset.timeline !== 'timeline-ui') {
                    console.log('🧹 Removing duplicate timeline styles');
                    style.remove();
                }
            });
            
            console.log('✅ Existing timeline elements cleanup completed');
        }
        
        // 【修正】CUTコピー・ペーストボタン追加版タイムライン構造
        createCompleteTimelineStructure() {
            console.log('🏗️ Creating complete timeline structure with CUT copy/paste buttons...');
            
            if (this.domCreated) {
                console.warn('Timeline DOM already created, skipping duplicate creation');
                return;
            }
            
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
                    <label>FPS: 
                        <input type="number" id="fps-input" min="1" max="60" value="12">
                    </label>
                </div>
                
                <div class="timeline-controls">
                    <button id="repeat-btn" title="リピート ON/OFF (R)" class="repeat-active">
                        <svg xmlns="http://www.w3.org/2000/svg" width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                            <path d="m17 2 4 4-4 4"/>
                            <path d="M3 11v-1a4 4 0 0 1 4-4h14"/>
                            <path d="m7 22-4-4 4-4"/>
                            <path d="M21 13v1a4 4 0 0 1-4 4H3"/>
                        </svg>
                    </button>
                    <button id="play-btn" title="再生/停止 (Space)">▶</button>
                    <button id="add-cut-btn" title="CUT追加 (Alt+Plus)">+CUT</button>
                    <button id="copy-paste-cut-btn" title="CUTコピー・ペースト (Shift+C)" class="copy-paste-btn">+C&P</button>
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
                <div class="progress-bar">
                    <div class="progress-fill" id="progress-fill"></div>
                </div>
                <span id="progress-text">0%</span>
            `;
            
            this.timelinePanel.appendChild(this.cutsContainer);
            this.timelinePanel.appendChild(timelineBottom);
            this.timelinePanel.appendChild(exportProgress);
            
            document.body.appendChild(this.timelinePanel);
            
            this.domCreated = true;
            console.log('✅ Complete timeline structure created with CUT copy/paste buttons');
        }
        
        // 【修正】CSS更新 - CUTコピー・ペーストボタンスタイル追加
        injectCompleteTimelineCSS() {
            console.log('🎨 Injecting complete timeline CSS with copy/paste button styles...');
            
            const existingStyle = document.querySelector('style[data-timeline="timeline-ui"]');
            if (existingStyle) {
                console.log('Timeline CSS already injected, skipping duplicate injection');
                return;
            }
            
            const style = document.createElement('style');
            style.dataset.timeline = 'timeline-ui';
            style.textContent = `
                /* ===== TimelineUI修正CSS - CUTコピペボタン追加・方向キー修正版 ===== */
                
                .timeline-panel {
                    position: fixed !important;
                    bottom: 12px !important;
                    left: 70px !important;
                    right: 220px !important;
                    background: var(--futaba-cream) !important;
                    border: 2px solid var(--futaba-medium) !important;
                    border-radius: 12px !important;
                    padding: 8px 10px !important;
                    z-index: 1500 !important;
                    max-height: 180px !important;
                    display: none !important;
                    box-shadow: 0 6px 16px rgba(128, 0, 0, 0.25) !important;
                    backdrop-filter: blur(12px) !important;
                    background: rgba(240, 224, 214, 0.95) !important;
                }

                .timeline-panel.show {
                    display: block !important;
                    animation: slideUp 0.35s ease-out !important;
                }

                @keyframes slideUp {
                    from { opacity: 0; transform: translateY(25px) scale(0.96); }
                    to   { opacity: 1; transform: translateY(0) scale(1); }
                }

                .cuts-container {
                    display: flex !important;
                    gap: 6px !important;
                    overflow-x: auto !important;
                    padding: 3px 0 8px 0 !important;
                    margin-bottom: 8px !important;
                    max-height: 140px !important;
                }

                .cuts-container::-webkit-scrollbar {
                    height: 10px !important;
                }

                .cuts-container::-webkit-scrollbar-track {
                    background: var(--futaba-light-medium) !important;
                    border-radius: 5px !important;
                }

                .cuts-container::-webkit-scrollbar-thumb {
                    background: var(--futaba-maroon) !important;
                    border-radius: 5px !important;
                }

                .cuts-container::-webkit-scrollbar-thumb:hover {
                    background: var(--futaba-light-maroon) !important;
                }

                .cut-item {
                    min-width: 85px !important;
                    background: var(--futaba-background) !important;
                    border: 2px solid var(--futaba-light-medium) !important;
                    border-radius: 8px !important;
                    padding: 2px !important;
                    cursor: pointer !important;
                    position: relative !important;
                    transition: all 0.25s ease !important;
                    flex-shrink: 0 !important;
                    display: flex !important;
                    flex-direction: column !important;
                    align-items: center !important;
                    box-shadow: 0 2px 6px rgba(128, 0, 0, 0.12) !important;
                    user-select: none !important;
                }

                .cut-item:hover {
                    border-color: var(--futaba-medium) !important;
                    transform: translateY(-2px) scale(1.02) !important;
                    box-shadow: 0 4px 12px rgba(128, 0, 0, 0.2) !important;
                }

                .cut-item.active {
                    border-color: var(--futaba-maroon) !important;
                    background: var(--futaba-light-medium) !important;
                    box-shadow: 0 0 0 3px rgba(128, 0, 0, 0.3) !important;
                    transform: translateY(-2px) scale(1.02) !important;
                }

                .cut-thumbnail {
                    width: 72px !important;
                    height: 54px !important;
                    background: var(--futaba-background) !important;
                    border: 1px solid var(--futaba-light-medium) !important;
                    border-radius: 6px !important;
                    overflow: hidden !important;
                    margin-bottom: 3px !important;
                    position: relative !important;
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
                    background-size: 8px 8px !important;
                    background-position: 0 0, 0 4px, 4px -4px, -4px 0px !important;
                    display: flex !important;
                    align-items: center !important;
                    justify-content: center !important;
                    color: var(--futaba-maroon) !important;
                    font-size: 9px !important;
                    font-weight: bold !important;
                }

                .cut-name {
                    font-size: 10px !important;
                    color: var(--futaba-maroon) !important;
                    margin-bottom: 2px !important;
                    font-weight: 600 !important;
                    text-align: center !important;
                    white-space: nowrap !important;
                    overflow: hidden !important;
                    text-overflow: ellipsis !important;
                    max-width: 72px !important;
                    line-height: 1.3 !important;
                }

                .cut-duration-container {
                    display: flex !important;
                    align-items: center !important;
                    gap: 2px !important;
                    margin-bottom: 3px !important;
                }

                .cut-duration-input {
                    width: 30px !important;
                    height: 18px !important;
                    border: 1px solid var(--futaba-light-medium) !important;
                    border-radius: 3px !important;
                    background: var(--futaba-background) !important;
                    font-size: 8px !important;
                    font-family: monospace !important;
                    color: var(--futaba-maroon) !important;
                    font-weight: bold !important;
                    text-align: center !important;
                    outline: none !important;
                    transition: all 0.15s ease !important;
                    padding: 0 !important;
                    -moz-appearance: textfield !important;
                }

                .cut-duration-input:hover {
                    border-color: var(--futaba-medium) !important;
                    background: var(--futaba-light-medium) !important;
                }

                .cut-duration-input:focus {
                    border-color: var(--futaba-maroon) !important;
                    background: var(--futaba-cream) !important;
                }

                .cut-duration-input::-webkit-outer-spin-button,
                .cut-duration-input::-webkit-inner-spin-button {
                    -webkit-appearance: none !important;
                    margin: 0 !important;
                }

                .duration-nav-btn {
                    width: 16px !important;
                    height: 16px !important;
                    background: var(--futaba-medium) !important;
                    border: none !important;
                    border-radius: 2px !important;
                    color: var(--futaba-background) !important;
                    font-size: 10px !important;
                    line-height: 1 !important;
                    cursor: pointer !important;
                    transition: all 0.15s ease !important;
                    display: flex !important;
                    align-items: center !important;
                    justify-content: center !important;
                    font-weight: bold !important;
                    padding: 0 !important;
                    user-select: none !important;
                }

                .duration-nav-btn:hover {
                    background: var(--futaba-light-maroon) !important;
                    transform: scale(1.1) !important;
                }

                .duration-nav-btn:active {
                    transform: scale(0.95) !important;
                }

                .delete-cut-btn {
                    position: absolute !important;
                    top: -4px !important;
                    right: -4px !important;
                    width: 18px !important;
                    height: 18px !important;
                    background: rgba(128, 0, 0, 0.9) !important;
                    border: none !important;
                    border-radius: 50% !important;
                    color: white !important;
                    font-size: 10px !important;
                    line-height: 1 !important;
                    cursor: pointer !important;
                    opacity: 0 !important;
                    transition: all 0.25s ease !important;
                    display: flex !important;
                    align-items: center !important;
                    justify-content: center !important;
                    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.3) !important;
                    font-weight: bold !important;
                }

                .cut-item:hover .delete-cut-btn {
                    opacity: 1 !important;
                }

                .delete-cut-btn:hover {
                    background: rgba(128, 0, 0, 1) !important;
                    transform: scale(1.15) !important;
                }

                .timeline-bottom {
                    display: flex !important;
                    justify-content: space-between !important;
                    align-items: center !important;
                    gap: 25px !important;
                    height: 40px !important;
                    padding: 0 4px !important;
                }

                /* 【修正】タイムラインコントロール - CUTコピー・ペーストボタン追加 */
                .timeline-controls {
                    display: flex !important;
                    gap: 6px !important;  /* ボタン間隔を縮小 */
                    align-items: center !important;
                    flex: 1 !important;
                    justify-content: center !important;
                }

                .timeline-controls button {
                    padding: 10px 16px !important;
                    background: var(--futaba-background) !important;
                    border: 2px solid var(--futaba-medium) !important;
                    border-radius: 8px !important;
                    cursor: pointer !important;
                    transition: all 0.2s ease !important;
                    font-size: 12px !important;
                    color: var(--futaba-maroon) !important;
                    min-width: 45px !important;
                    height: 18px !important;
                    display: flex !important;
                    align-items: center !important;
                    justify-content: center !important;
                    font-weight: 600 !important;
                    box-shadow: 0 2px 4px rgba(128, 0, 0, 0.08) !important;
                }

                .timeline-controls button:hover {
                    background: var(--futaba-medium) !important;
                    border-color: var(--futaba-maroon) !important;
                    transform: translateY(-1px) !important;
                    box-shadow: 0 4px 8px rgba(128, 0, 0, 0.18) !important;
                }

                .timeline-controls button:active {
                    transform: translateY(0) !important;
                }

                .timeline-controls button:disabled {
                    opacity: 0.5 !important;
                    cursor: not-allowed !important;
                    transform: none !important;
                }

                /* 【新機能】CUTコピー・ペーストボタンスタイル */
                .copy-paste-btn {
                    background: var(--futaba-light-medium) !important;
                    color: var(--futaba-maroon) !important;
                    border-color: var(--futaba-medium) !important;
                    font-size: 11px !important;
                    font-weight: 700 !important;
                    min-width: 50px !important;
                }

                .copy-paste-btn:hover {
                    background: var(--futaba-maroon) !important;
                    color: var(--futaba-background) !important;
                    border-color: var(--futaba-maroon) !important;
                    transform: translateY(-2px) scale(1.05) !important;
                    box-shadow: 0 6px 12px rgba(128, 0, 0, 0.3) !important;
                }

                .copy-paste-btn:active {
                    transform: translateY(-1px) scale(1.02) !important;
                }

                #repeat-btn {
                    min-width: 40px !important;
                    padding: 8px !important;
                }

                #repeat-btn.repeat-active {
                    background: var(--futaba-maroon) !important;
                    color: var(--futaba-background) !important;
                    border-color: var(--futaba-maroon) !important;
                }

                #repeat-btn.repeat-inactive {
                    background: var(--futaba-background) !important;
                    color: var(--futaba-maroon) !important;
                    border-color: var(--futaba-medium) !important;
                    opacity: 0.6 !important;
                }

                #repeat-btn:hover.repeat-active {
                    background: var(--futaba-light-maroon) !important;
                }

                #repeat-btn:hover.repeat-inactive {
                    background: var(--futaba-light-medium) !important;
                }

                #repeat-btn svg {
                    width: 16px !important;
                    height: 16px !important;
                }

                .timeline-controls button#play-btn.playing {
                    background: var(--futaba-maroon) !important;
                    color: var(--text-inverse) !important;
                    border-color: var(--futaba-maroon) !important;
                }

                .timeline-settings {
                    display: flex !important;
                    gap: 15px !important;
                    font-size: 13px !important;
                    align-items: center !important;
                    color: var(--futaba-maroon) !important;
                }

                .timeline-settings label {
                    display: flex !important;
                    align-items: center !important;
                    gap: 8px !important;
                    white-space: nowrap !important;
                    font-weight: 600 !important;
                    color: var(--futaba-maroon) !important;
                }

                .timeline-settings input[type="number"] {
                    width: 55px !important;
                    height: 36px !important;
                    padding: 8px 10px !important;
                    border: 2px solid var(--futaba-light-medium) !important;
                    border-radius: 6px !important;
                    background: var(--futaba-background) !important;
                    text-align: center !important;
                    font-size: 13px !important;
                    font-family: monospace !important;
                    color: var(--futaba-maroon) !important;
                    font-weight: 600 !important;
                }

                .timeline-settings input[type="number"]:focus {
                    outline: none !important;
                    border-color: var(--futaba-light-maroon) !important;
                }

                .timeline-close {
                    background: none !important;
                    border: none !important;
                    font-size: 20px !important;
                    color: var(--futaba-maroon) !important;
                    cursor: pointer !important;
                    padding: 8px 12px !important;
                    border-radius: 8px !important;
                    transition: background-color 0.2s ease !important;
                    height: 36px !important;
                    display: flex !important;
                    align-items: center !important;
                    justify-content: center !important;
                    font-weight: bold !important;
                    min-width: 36px !important;
                }

                .timeline-close:hover {
                    background: var(--futaba-light-medium) !important;
                }

                /* GIF書き出しプログレス */
                .export-progress {
                    position: absolute !important;
                    bottom: -26px !important;
                    left: 0 !important;
                    right: 0 !important;
                    background: var(--futaba-cream) !important;
                    border: 2px solid var(--futaba-medium) !important;
                    border-radius: 0 0 12px 12px !important;
                    padding: 8px 12px !important;
                    display: none !important;
                    z-index: 1501 !important;
                    backdrop-filter: blur(8px) !important;
                }

                .progress-bar {
                    width: 100% !important;
                    height: 8px !important;
                    background: var(--futaba-light-medium) !important;
                    border-radius: 4px !important;
                    overflow: hidden !important;
                    margin-bottom: 6px !important;
                }

                .progress-fill {
                    height: 100% !important;
                    background: linear-gradient(90deg, var(--futaba-light-maroon), var(--futaba-maroon)) !important;
                    width: 0% !important;
                    transition: width 0.3s ease !important;
                    border-radius: 4px !important;
                }

                .export-progress span {
                    font-size: 11px !important;
                    color: var(--futaba-maroon) !important;
                    font-family: monospace !important;
                    font-weight: 600 !important;
                }

                .timeline-panel.exporting {
                    margin-bottom: 32px !important;
                }
            `;
            
            document.head.appendChild(style);
            console.log('✅ Complete timeline CSS injected with CUT copy/paste button styles');
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
        
        // 【修正】CUTコピー・ペーストボタン機能追加
        setupImprovedButtonListeners() {
            // リピートボタン
            const repeatBtn = document.getElementById('repeat-btn');
            if (repeatBtn) {
                repeatBtn.addEventListener('click', () => {
                    this.toggleRepeat();
                });
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
            
            // 【新機能】CUTコピー・ペーストボタン
            const copyPasteBtn = document.getElementById('copy-paste-cut-btn');
            if (copyPasteBtn) {
                copyPasteBtn.addEventListener('click', () => {
                    this.executeCutCopyPaste();
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
        
        // 【新機能】CUTコピー・ペースト実行（Shift+Cと同じ動作）
        executeCutCopyPaste() {
            if (this.eventBus) {
                // アクティブCUTをコピー
                this.eventBus.emit('cut:copy-current');
                // 即座に右隣に貼り付け
                setTimeout(() => {
                    this.eventBus.emit('cut:paste-right-adjacent');
                    // CUT一覧とインジケーターを更新
                    setTimeout(() => {
                        this.updateCutsList();
                        this.updateLayerPanelIndicator();
                    }, 100);
                }, 50);
                console.log('📋 CUT copy + paste right adjacent executed via +C&P button');
            }
        }
        
        toggleRepeat() {
            this.isLooping = !this.isLooping;
            this.animationSystem.updateSettings({ loop: this.isLooping });
            
            const repeatBtn = document.getElementById('repeat-btn');
            if (repeatBtn) {
                if (this.isLooping) {
                    repeatBtn.classList.remove('repeat-inactive');
                    repeatBtn.classList.add('repeat-active');
                } else {
                    repeatBtn.classList.remove('repeat-active');
                    repeatBtn.classList.add('repeat-inactive');
                }
            }
            
            if (this.eventBus) {
                this.eventBus.emit('animation:loop:set', this.isLooping);
            }
            
            console.log('🔄 Repeat toggled:', this.isLooping ? 'ON' : 'OFF');
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
        
        // 【修正】キーボードショートカット - 方向キー修正版
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
                        
                    case 'KeyR':
                        if (!e.ctrlKey && !e.altKey) {
                            this.toggleRepeat();
                            e.preventDefault();
                        }
                        break;
                        
                    // 【修正】方向キー左右の動作修正（左右方向正常化・レイヤー消失問題解決）
                    case 'ArrowLeft':
                        // 左キー：前のCUTに移動（単純なアクティブCUT切り替え）
                        this.goToPreviousCutSafe();
                        e.preventDefault();
                        break;
                        
                    case 'ArrowRight':
                        // 右キー：次のCUTに移動（単純なアクティブCUT切り替え）
                        this.goToNextCutSafe();
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
            
            console.log('✅ Timeline keyboard shortcuts updated - 方向キー左右修正完了');
        }
        
        // 【修正】安全な前のCUT移動（レイヤー消失問題解決）
        goToPreviousCutSafe() {
            const animData = this.animationSystem.getAnimationData();
            if (animData.cuts.length === 0) return;
            
            let newIndex = this.currentCutIndex - 1;
            if (newIndex < 0) {
                newIndex = animData.cuts.length - 1; // 最後のCUTに循環
            }
            
            // 【修正】単純なアクティブCUT切り替え（レイヤー状態を破壊しない）
            this.currentCutIndex = newIndex;
            this.animationSystem.animationData.playback.currentCutIndex = newIndex;
            
            // 安全なCUT切り替え（resetTransform = false でレイヤー状態保持）
            this.animationSystem.switchToActiveCutSafely(newIndex, false);
            
            // UI更新
            this.setActiveCut(newIndex);
            this.updateLayerPanelIndicator();
            
            console.log('⬅️ Previous CUT (safe):', newIndex, animData.cuts[newIndex]?.name);
            
            if (this.eventBus) {
                this.eventBus.emit('animation:cut-changed', { 
                    cutIndex: newIndex, 
                    direction: 'previous' 
                });
            }
        }
        
        // 【修正】安全な次のCUT移動（レイヤー消失問題解決）
        goToNextCutSafe() {
            const animData = this.animationSystem.getAnimationData();
            if (animData.cuts.length === 0) return;
            
            let newIndex = this.currentCutIndex + 1;
            if (newIndex >= animData.cuts.length) {
                newIndex = 0; // 最初のCUTに循環
            }
            
            // 【修正】単純なアクティブCUT切り替え（レイヤー状態を破壊しない）
            this.currentCutIndex = newIndex;
            this.animationSystem.animationData.playback.currentCutIndex = newIndex;
            
            // 安全なCUT切り替え（resetTransform = false でレイヤー状態保持）
            this.animationSystem.switchToActiveCutSafely(newIndex, false);
            
            // UI更新
            this.setActiveCut(newIndex);
            this.updateLayerPanelIndicator();
            
            console.log('➡️ Next CUT (safe):', newIndex, animData.cuts[newIndex]?.name);
            
            if (this.eventBus) {
                this.eventBus.emit('animation:cut-changed', { 
                    cutIndex: newIndex, 
                    direction: 'next' 
                });
            }
        }
        
        setupAnimationEvents() {
            if (!this.eventBus) return;
            
            this.eventBus.on('animation:play-toggle', () => {
                console.log('🎬 Received animation:play-toggle event');
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
            
            // 【修正】CUTコピー・ペースト後のUI更新
            this.eventBus.on('cut:pasted-right-adjacent', (data) => {
                this.currentCutIndex = data.cutIndex;
                this.updateCutsList();
                this.updateLayerPanelIndicator();
                console.log('📋 CUT pasted - UI updated');
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
                // 【修正】停止時に最初のCUTに戻らない
                // this.setActiveCut(0); // この行を削除
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
            
            // 【修正】レイヤーパネルのCUT移動も安全版に変更
            document.getElementById('cut-prev-btn')?.addEventListener('click', () => {
                this.goToPreviousCutSafe();
            });
            
            document.getElementById('cut-next-btn')?.addEventListener('click', () => {
                this.goToNextCutSafe();
            });
            
            this.updateLayerPanelIndicator();
            console.log('✅ Layer panel CUT indicator created with safe navigation');
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
            
            // 【修正】循環ナビゲーションなのでボタンは常に有効
            if (prevBtn) prevBtn.disabled = false;
            if (nextBtn) nextBtn.disabled = false;
        }
        
        // 【削除】goToPreviousCut, goToNextCut を削除（安全版に置き換え済み）
        
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
                <div class="cut-thumbnail" data-cut-index="${index}">
                    ${thumbnailHtml}
                </div>
                <div class="cut-name">${cut.name}</div>
                <div class="cut-duration-container">
                    <button class="duration-nav-btn duration-decrease" data-index="${index}" title="時間減少">◀</button>
                    <input type="number" class="cut-duration-input" 
                           value="${cut.duration}" 
                           min="0.1" max="10" step="0.1"
                           title="表示時間（秒）"
                           data-index="${index}">
                    <button class="duration-nav-btn duration-increase" data-index="${index}" title="時間増加">▶</button>
                </div>
                <button class="delete-cut-btn" data-index="${index}">×</button>
            `;
            
            // CUT選択
            cutItem.addEventListener('click', (e) => {
                if (!e.target.classList.contains('delete-cut-btn') &&
                    !e.target.classList.contains('cut-duration-input') &&
                    !e.target.classList.contains('duration-nav-btn')) {
                    // 【修正】CUT選択も安全版に変更
                    this.selectCutSafely(index);
                }
            });
            
            // 時間増減ボタン
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
            
            // 直接入力対応
            if (durationInput) {
                durationInput.addEventListener('change', (e) => {
                    const newDuration = parseFloat(e.target.value);
                    if (!isNaN(newDuration) && newDuration > 0) {
                        this.animationSystem.updateCutDuration(index, newDuration);
                        console.log(`🎬 CUT${index + 1} duration updated to ${newDuration}s`);
                    }
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
        
        // 【新機能】安全なCUT選択（レイヤー消失問題解決）
        selectCutSafely(index) {
            this.currentCutIndex = index;
            this.animationSystem.animationData.playback.currentCutIndex = index;
            
            // 安全なCUT切り替え（resetTransform = false でレイヤー状態保持）
            this.animationSystem.switchToActiveCutSafely(index, false);
            
            // UI更新
            this.setActiveCut(index);
            this.updateLayerPanelIndicator();
            
            console.log('🎯 CUT selected (safe):', index);
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
                hasCutsContainer: !!this.cutsContainer,
                isInitialized: this.isInitialized,
                domCreated: this.domCreated
            };
        }
    }
    
    // グローバル export
    window.TegakiTimelineUI = TimelineUI;
    console.log('✅ TegakiTimelineUI exported to global scope');
    console.log('✅ ui/timeline-ui.js loaded (CUTコピペボタン追加・方向キー修正版)');
    console.log('🔧 修正完了:');
    console.log('  - ✅ CUTコピー・ペーストボタン追加: +C&Pボタン (+CUTの隣に配置)');
    console.log('  - ✅ Shift+Cと同じ動作: アクティブCUTコピー + 右隣に貼り付け');
    console.log('  - ✅ 方向キー左右修正: 左右の方向を正常化 (左←前のCUT、右→次のCUT)');
    console.log('  - ✅ レイヤー消失問題解決: switchToActiveCutSafely(index, false) で状態保持');
    console.log('  - ✅ 単純なアクティブCUT移動: レイヤー状態を破壊しない安全なナビゲーション');
    console.log('  - ✅ 循環ナビゲーション: 最初/最後のCUTで循環移動');
    console.log('  - ✅ UI更新統合: CUTコピー・ペースト後の表示更新');
    console.log('  - ✅ レイヤーパネル連携: CUTインジケーター安全ナビゲーション');
    console.log('🎯 操作改善:');
    console.log('  - +C&Pボタン: ワンクリックでCUTコピー・ペースト');
    console.log('  - ←キー: 前のCUTに移動（レイヤー状態保持）');
    console.log('  - →キー: 次のCUTに移動（レイヤー状態保持）');
    console.log('  - CUTクリック: 安全な選択（レイヤー消失なし）');
    console.log('  - レイヤーパネル◀▶: 安全ナビゲーション');
    
    if (typeof window.TegakiUI === 'undefined') {
        window.TegakiUI = {};
    }
    window.TegakiUI.TimelineUI = TimelineUI;

})();