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
            this.ensureInitialCut(); // 新機能：初期CUT1を確保
            
            console.log('✅ TimelineUI initialized (改修版: 一時停止削除、初期CUT1対応)');
        }
        
        // 新機能：初期状態でCUT1を作成
        ensureInitialCut() {
            const animData = this.animationSystem.getAnimationData();
            if (animData.cuts.length === 0) {
                // 初期CUT1を作成
                this.animationSystem.createCutFromCurrentState();
                console.log('🎬 Initial CUT1 created');
            }
            
            // レイヤーパネルのインジケータを初期化時から表示
            this.updateLayerPanelIndicator();
        }
        
        setupEventListeners() {
            // 改修版：再生/停止ボタン統合（一時停止削除）
            const playBtn = document.getElementById('play-btn');
            
            if (playBtn) {
                playBtn.addEventListener('click', () => {
                    if (this.isPlaying) {
                        // 再生中なら停止
                        this.animationSystem.stop();
                    } else {
                        // 停止中なら再生開始
                        this.animationSystem.play();
                    }
                });
            }
            
            // CUT追加
            const addCutBtn = document.getElementById('add-cut-btn');
            if (addCutBtn) {
                addCutBtn.addEventListener('click', () => {
                    this.animationSystem.createCutFromCurrentState();
                });
            }
            
            // GIF書き出し
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
            
            const loopCheckbox = document.getElementById('loop-checkbox');
            if (loopCheckbox) {
                loopCheckbox.addEventListener('change', (e) => {
                    this.animationSystem.updateSettings({ loop: e.target.checked });
                });
            }
        }
        
        setupKeyboardShortcuts() {
            document.addEventListener('keydown', (e) => {
                if (!this.isVisible) return;
                
                switch (e.code) {
                    case 'Space':
                        if (!e.ctrlKey && !e.altKey) {
                            // 改修版：再生/停止の統合
                            if (this.isPlaying) {
                                this.animationSystem.stop();
                            } else {
                                this.animationSystem.play();
                            }
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
                            this.animationSystem.createCutFromCurrentState();
                            e.preventDefault();
                        }
                        break;
                }
            });
        }
        
        setupAnimationEvents() {
            if (!this.eventBus) return;
            
            this.eventBus.on('animation:cut-created', () => {
                this.updateCutsList();
                this.updateLayerPanelIndicator();
            });
            
            this.eventBus.on('animation:cut-applied', (data) => {
                this.setActiveCut(data.cutIndex);
                this.updateLayerPanelIndicator();
            });
            
            this.eventBus.on('animation:thumbnail-generated', () => {
                this.updateCutsList();
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
        
        // 改修版：レイヤーパネル上部にCUT表示を追加（初期表示対応）
        createLayerPanelCutIndicator() {
            const layerContainer = document.getElementById('layer-panel-container');
            if (!layerContainer) return;
            
            // 既存のインジケータを削除
            const existingIndicator = layerContainer.querySelector('.cut-indicator');
            if (existingIndicator) {
                existingIndicator.remove();
            }
            
            // 新しいインジケータを作成
            const cutIndicator = document.createElement('div');
            cutIndicator.className = 'cut-indicator';
            cutIndicator.innerHTML = `
                <button class="cut-nav-btn" id="cut-prev-btn">◀</button>
                <span class="cut-display" id="cut-display">CUT1</span>
                <button class="cut-nav-btn" id="cut-next-btn">▶</button>
            `;
            
            // レイヤー追加ボタンの後に挿入
            const addButton = layerContainer.querySelector('.layer-add-button');
            if (addButton) {
                layerContainer.insertBefore(cutIndicator, addButton.nextSibling);
            }
            
            // イベントリスナー設定
            document.getElementById('cut-prev-btn')?.addEventListener('click', () => {
                this.goToPreviousCut();
            });
            
            document.getElementById('cut-next-btn')?.addEventListener('click', () => {
                this.goToNextCut();
            });
            
            // 初期表示設定
            this.updateLayerPanelIndicator();
            
            console.log('✅ Layer panel CUT indicator created (初期表示対応)');
        }
        
        // 改修版：レイヤーパネルのCUT表示を更新（初期CUT1対応）
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
        
        // CUT間のナビゲーション
        goToPreviousCut() {
            const animData = this.animationSystem.getAnimationData();
            if (this.currentCutIndex > 0) {
                const newIndex = this.currentCutIndex - 1;
                this.animationSystem.applyCutToLayers(newIndex);
            }
        }
        
        goToNextCut() {
            const animData = this.animationSystem.getAnimationData();
            if (this.currentCutIndex < animData.cuts.length - 1) {
                const newIndex = this.currentCutIndex + 1;
                this.animationSystem.applyCutToLayers(newIndex);
            }
        }
        
        updateCutsList() {
            const animData = this.animationSystem.getAnimationData();
            this.cutsContainer.innerHTML = '';
            
            animData.cuts.forEach((cut, index) => {
                const cutItem = this.createCutItem(cut, index);
                this.cutsContainer.appendChild(cutItem);
            });
            
            // Sortable.js でドラッグ＆ドロップ
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
        
        createCutItem(cut, index) {
            const cutItem = document.createElement('div');
            cutItem.className = 'cut-item';
            cutItem.dataset.cutIndex = index;
            
            // サムネイル表示
            let thumbnailHtml = '<div class="cut-thumbnail-placeholder">CUT</div>';
            if (cut.thumbnailTexture) {
                try {
                    const canvas = this.animationSystem.app.renderer.extract.canvas(cut.thumbnailTexture);
                    thumbnailHtml = `<img src="${canvas.toDataURL()}" alt="${cut.name}" />`;
                } catch (error) {
                    console.warn('Failed to generate thumbnail for cut:', index);
                }
            }
            
            cutItem.innerHTML = `
                <div class="cut-thumbnail">${thumbnailHtml}</div>
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
                    !e.target.classList.contains('cut-duration')) {
                    this.animationSystem.applyCutToLayers(index);
                    this.setActiveCut(index);
                }
            });
            
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
        
        setActiveCut(index) {
            this.currentCutIndex = index;
            
            document.querySelectorAll('.cut-item').forEach((item, i) => {
                if (i === index) {
                    item.classList.add('active');
                } else {
                    item.classList.remove('active');
                }
            });
            
            this.updateLayerPanelIndicator();
        }
        
        deleteCut(index) {
            const animData = this.animationSystem.getAnimationData();
            if (animData.cuts.length <= 1) {
                console.warn('Cannot delete the last remaining cut');
                return;
            }
            
            this.animationSystem.deleteCut(index);
            this.updateCutsList();
            this.updateLayerPanelIndicator();
        }
        
        // 改修版：再生/停止ボタンの状態切り替え
        updatePlaybackUI(isPlaying) {
            const playBtn = document.getElementById('play-btn');
            
            if (playBtn) {
                if (isPlaying) {
                    playBtn.textContent = '⏹';
                    playBtn.title = '停止 (Space)';
                    playBtn.classList.add('playing');
                } else {
                    playBtn.textContent = '▶';
                    playBtn.title = '再生 (Space)';
                    playBtn.classList.remove('playing');
                }
            }
        }
        
        async exportGIF() {
            if (!this.gifExporter) {
                console.warn('GIF Exporter not available');
                return;
            }
            
            const canExport = this.gifExporter.canExport();
            if (!canExport.canExport) {
                console.warn('Cannot export GIF:', canExport.reason);
                return;
            }
            
            this.showExportProgress();
            
            try {
                await this.gifExporter.exportGIF({
                    width: window.TEGAKI_CONFIG.canvas.width,
                    height: window.TEGAKI_CONFIG.canvas.height
                });
            } catch (error) {
                console.error('GIF export failed:', error);
                this.hideExportProgress();
            }
        }
        
        showExportProgress() {
            const progressEl = document.getElementById('export-progress');
            if (progressEl) {
                progressEl.style.display = 'block';
                this.timelinePanel.classList.add('exporting');
                this.updateExportProgress(0);
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
            const progressEl = document.getElementById('export-progress');
            if (progressEl) {
                progressEl.style.display = 'none';
                this.timelinePanel.classList.remove('exporting');
            }
        }
        
        show() {
            if (!this.timelinePanel) return;
            
            this.timelinePanel.classList.add('show');
            this.isVisible = true;
            
            // アニメーションモードに切り替え
            this.animationSystem.toggleAnimationMode();
            
            // 初期CUT1確保（タイムライン表示時にもチェック）
            this.ensureInitialCut();
            
            // CUTリスト更新
            this.updateCutsList();
            this.updateLayerPanelIndicator();
            
            // 設定値をUIに反映
            this.updateSettingsUI();
            
            // レイヤーパネルのインジケータを表示
            const cutIndicator = document.querySelector('.cut-indicator');
            if (cutIndicator) {
                cutIndicator.style.display = 'flex';
            }
            
            console.log('🎬 Timeline UI shown with initial CUT1');
        }
        
        hide() {
            if (!this.timelinePanel) return;
            
            this.timelinePanel.classList.remove('show');
            this.isVisible = false;
            
            // アニメーション停止
            if (this.isPlaying) {
                this.animationSystem.stop();
            }
            
            // アニメーションモード終了
            if (this.animationSystem.isAnimationMode) {
                this.animationSystem.toggleAnimationMode();
            }
            
            // レイヤーパネルのインジケータを隠す（完全には消さない）
            const cutIndicator = document.querySelector('.cut-indicator');
            if (cutIndicator) {
                cutIndicator.style.display = 'none';
            }
        }
        
        toggle() {
            if (this.isVisible) {
                this.hide();
            } else {
                this.show();
            }
        }
        
        updateSettingsUI() {
            const animData = this.animationSystem.getAnimationData();
            
            const fpsInput = document.getElementById('fps-input');
            if (fpsInput) {
                fpsInput.value = animData.settings.fps;
            }
            
            const loopCheckbox = document.getElementById('loop-checkbox');
            if (loopCheckbox) {
                loopCheckbox.checked = animData.settings.loop;
            }
        }
        
        // キャンバスとサムネイルの連動確認
        syncCanvasToThumbnail() {
            const animData = this.animationSystem.getAnimationData();
            const currentCut = animData.cuts[this.currentCutIndex];
            
            if (currentCut) {
                // 現在のレイヤー状態をCUTに保存
                this.animationSystem.saveCutFromCurrentState(this.currentCutIndex);
                
                // サムネイル更新
                this.updateCutsList();
                
                console.log(`🔄 Canvas synced to CUT${this.currentCutIndex + 1} thumbnail`);
            }
        }
        
        // デバッグ用
        debugInfo() {
            console.log('TimelineUI Debug Info (改修版):');
            console.log('- Visible:', this.isVisible);
            console.log('- Playing:', this.isPlaying);
            console.log('- Current Cut:', this.currentCutIndex);
            console.log('- Panel:', !!this.timelinePanel);
            console.log('- Container:', !!this.cutsContainer);
            console.log('- Sortable:', !!this.sortable);
            console.log('- GIF Exporter:', !!this.gifExporter);
            
            const animData = this.animationSystem.getAnimationData();
            console.log('- Total Cuts:', animData.cuts.length);
            console.log('- Initial CUT1 exists:', animData.cuts.length > 0);
            
            return {
                isVisible: this.isVisible,
                isPlaying: this.isPlaying,
                currentCutIndex: this.currentCutIndex,
                hasPanel: !!this.timelinePanel,
                hasContainer: !!this.cutsContainer,
                hasSortable: !!this.sortable,
                hasGIFExporter: !!this.gifExporter,
                totalCuts: animData.cuts.length,
                hasInitialCut: animData.cuts.length > 0
            };
        }
    }
    
    window.TegakiTimelineUI = TimelineUI;
    console.log('✅ timeline-ui.js loaded (改修版: 一時停止削除、初期CUT1対応、文字色統一)');
})();