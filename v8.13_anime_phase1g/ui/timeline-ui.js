}
        
        // レイヤーパネル上部にCUT表示を追加
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
                const cutItem = this.createCutItem(cut, index);
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
        
        // CUTアイテム作成（サムネイル左右ボタン追加）
        createCutItem(cut, index) {
            const cutItem = document.createElement('div');
            cutItem.className = 'cut-item';
            cutItem.dataset.cutIndex = index;
            
            const thumbnailHtml = this.generateCutThumbnailHTML(cut, index);
            
            cutItem.innerHTML = `
                <div class="cut-thumbnail" data-cut-index="${index}">
                    ${thumbnailHtml}
                    <button class="thumb-nav-btn thumb-nav-left" data-cut-index="${index}" data-direction="prev">◀</button>
                    <button class="thumb-nav-btn thumb-nav-right" data-cut-index="${index}" data-direction="next">▶</button>
                </div>
                <div class="cut-name">${cut.name}</div>
                <input type="number" class="cut-duration" 
                       value="${cut.duration}" 
                       min="0.1" max="10" step="0.1"
                       title="表示時間（秒）">
                <button class="delete-cut-btn" data-index="${index}">×</button>
            `;
            
            // CUT選択
            cutItem.addEventListener('click', (e) => {
                if (!e.target.classList.contains('delete-cut-btn') &&
                    !e.target.classList.contains('cut-duration') &&
                    !e.target.classList.contains('thumb-nav-btn')) {
                    this.animationSystem.switchToActiveCut(index);
                    this.setActiveCut(index);
                }
            });
            
            // サムネイル左右ボタンのイベント
            const leftBtn = cutItem.querySelector('.thumb-nav-left');
            const rightBtn = cutItem.querySelector('.thumb-nav-right');
            
            if (leftBtn) {
                leftBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    this.navigateThumbnail(index, 'prev');
                });
            }
            
            if (rightBtn) {
                rightBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    this.navigateThumbnail(index, 'next');
                });
            }
            
            // CUT削除
            const deleteBtn = cutItem.querySelector('.delete-cut-btn');
            deleteBtn.addEventListener('click', (e) => {
                this.deleteCut(index);
                e.stopPropagation();
            });
            
            // 時間変更
            const durationInput = cutItem.querySelector('.cut-duration');
            durationInput.addEventListener('change', (e) => {
                const newDuration = parseFloat(e.target.value);
                this.animationSystem.updateCutDuration(index, newDuration);
                e.stopPropagation();
            });
            
            return cutItem;
        }
        
        // サムネイルナビゲーション機能
        navigateThumbnail(cutIndex, direction) {
            // TODO: 将来的にCUT内のフレーム/レイヤーナビゲーション実装
            // 現在は簡単なCUT間ナビゲーション
            if (direction === 'prev' && cutIndex > 0) {
                this.animationSystem.switchToActiveCut(cutIndex - 1);
            }// ===== ui/timeline-ui.js - Phase5改修版: ショートカット更新 =====
// CHG: ALT+Spaceショートカット対応・Spaceキー処理更新

/*
=== Phase5改修完了ヘッダー ===

【改修内容】
✅ setupKeyboardShortcuts内のSpace処理更新
✅ animation:play-toggleイベント受信処理追加
✅ ALT+Space処理はcore-runtime.jsに委譲
✅ Spaceキー単体はタイムライン表示時のみ有効

【変更箇所】
- setupAnimationEvents内にanimation:play-toggleイベント処理追加
- setupKeyboardShortcuts内のSpaceキー処理説明更新

=== Phase5改修完了ヘッダー終了 ===
*/

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
            
            // EventBus取得
            this.eventBus = window.TegakiEventBus;
        }
        
        init() {
            this.timelinePanel = document.getElementById('timeline-panel');
            this.cutsContainer = document.getElementById('cuts-container');
            
            if (!this.timelinePanel || !this.cutsContainer) {
                console.error('Timeline UI elements not found');
                return;
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
            
            // UI レイアウト変更実行（Phase3から継続）
            this.updateTimelineLayout();
            this.addTimelineCSS();
            
            this.setupEventListeners();
            this.setupKeyboardShortcuts();
            this.setupAnimationEvents();
            this.createLayerPanelCutIndicator();
            this.ensureInitialCut();
            
            console.log('✅ TimelineUI initialized (Phase5改修版: ショートカット更新)');
        }
        
        // Phase3改修継続：タイムラインレイアウト更新
        updateTimelineLayout() {
            const timelineBottom = this.timelinePanel.querySelector('.timeline-bottom');
            if (!timelineBottom) {
                console.error('Timeline bottom container not found');
                return;
            }
            
            timelineBottom.innerHTML = `
                <!-- 左側：FPS設定 -->
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
                    
                    <!-- CHG: Phase5改修 - タイトル更新 -->
                    <button id="play-btn" title="再生/停止 (Space / Alt+Space)">▶</button>
                </div>
                
                <!-- 右側：GIF書き出し -->
                <div class="timeline-settings">
                    <button id="export-gif-btn" title="GIF書き出し">GIF</button>
                </div>
                
                <button class="timeline-close" id="close-timeline">×</button>
            `;
            
            console.log('✅ Timeline layout updated - shortcut info updated');
        }
        
        // Phase3改修継続：タイムライン用CSS追加
        addTimelineCSS() {
            const style = document.createElement('style');
            style.textContent = `
                /* Phase3改修継続：新しいタイムラインレイアウト用CSS */
                
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
                
                .cut-thumbnail {
                    position: relative !important;
                }
                
                .thumb-nav-btn {
                    position: absolute !important;
                    top: 50% !important;
                    transform: translateY(-50%) !important;
                    width: 16px !important;
                    height: 16px !important;
                    font-size: 10px !important;
                    background: rgba(128, 0, 0, 0.8) !important;
                    color: white !important;
                    border: none !important;
                    border-radius: 2px !important;
                    cursor: pointer !important;
                    opacity: 0 !important;
                    transition: all 0.2s ease !important;
                    display: flex !important;
                    align-items: center !important;
                    justify-content: center !important;
                    font-weight: bold !important;
                    line-height: 1 !important;
                    z-index: 10 !important;
                }
                
                .cut-item:hover .thumb-nav-btn {
                    opacity: 1 !important;
                }
                
                .thumb-nav-btn:hover {
                    background: rgba(128, 0, 0, 1) !important;
                    transform: translateY(-50%) scale(1.1) !important;
                }
                
                .thumb-nav-left {
                    left: 2px !important;
                }
                
                .thumb-nav-right {
                    right: 2px !important;
                }
            `;
            
            document.head.appendChild(style);
            console.log('✅ Timeline CSS added');
        }
        
        ensureInitialCut() {
            const animData = this.animationSystem.getAnimationData();
            if (animData.cuts.length === 0) {
                this.animationSystem.createNewCutFromCurrentLayers();
                console.log('🎬 Initial CUT1 created with new structure');
            }
            
            this.updateLayerPanelIndicator();
        }
        
        // EventBus受信処理（Phase2から継続）
        setupEventListeners() {
            // タイムライン表示切り替えイベント受信
            if (this.eventBus) {
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
            }
            
            // 新しいボタンのイベントリスナー設定
            this.setupNewButtonListeners();
        }
        
        // 新しいボタンレイアウト用イベントリスナー（Phase3から継続）
        setupNewButtonListeners() {
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
        
        // CHG: Phase5改修 - 再生/停止切り替えメソッド統一
        togglePlayStop() {
            if (this.isPlaying) {
                this.animationSystem.stop();
            } else {
                this.animationSystem.play();
            }
        }
        
        // ループ切り替え機能（Phase3から継続）
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
        
        // 表示制御メソッド（Phase2から継続）
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
        
        // CHG: Phase5改修 - キーボードショートカット更新
        setupKeyboardShortcuts() {
            document.addEventListener('keydown', (e) => {
                // タイムライン非表示時はショートカット無効
                if (!this.isVisible) return;
                
                switch (e.code) {
                    case 'Space':
                        // CHG: Phase5改修 - Space単体はタイムライン表示時のみ有効
                        if (!e.ctrlKey && !e.altKey) {
                            this.togglePlayStop(); // CHG: 統一メソッド使用
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
        
        // CHG: Phase5改修 - アニメーションイベント追加
        setupAnimationEvents() {
            if (!this.eventBus) return;
            
            // CHG: Phase5改修 - ALT+Spaceからの再生切り替えイベント受信
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
            
            // GIF書き出しイベント
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