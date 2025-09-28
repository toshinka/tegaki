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
            
            // EventBus取得（グローバル）
            this.eventBus = window.TegakiEventBus || this.createSimpleEventBus();
        }
        
        init() {
            this.timelinePanel = document.getElementById('timeline-panel');
            this.cutsContainer = document.getElementById('cuts-container');
            
            if (!this.timelinePanel || !this.cutsContainer) {
                console.error('Timeline UI elements not found');
                return;
            }
            
            // GIF Exporter初期化
            this.gifExporter = new window.TegakiGIFExporter(
                this.animationSystem, 
                this.animationSystem.app
            );
            
            this.setupEventListeners();
            this.setupKeyboardShortcuts();
            this.setupAnimationEvents();
            
            console.log('✅ TimelineUI initialized');
        }
        
        setupEventListeners() {
            // 再生制御
            const playBtn = document.getElementById('play-btn');
            const pauseBtn = document.getElementById('pause-btn');
            const stopBtn = document.getElementById('stop-btn');
            
            if (playBtn) {
                playBtn.addEventListener('click', () => {
                    this.animationSystem.play();
                });
            }
            
            if (pauseBtn) {
                pauseBtn.addEventListener('click', () => {
                    this.animationSystem.pause();
                });
            }
            
            if (stopBtn) {
                stopBtn.addEventListener('click', () => {
                    this.animationSystem.stop();
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
                // アニメーションモード時のみ有効
                if (!this.isVisible) return;
                
                const keyConfig = window.TEGAKI_KEYCONFIG;
                const action = window.TEGAKI_KEYCONFIG_MANAGER.getActionForKey(e.code, {
                    vPressed: false,
                    shiftPressed: e.shiftKey,
                    altPressed: e.altKey
                });
                
                switch (action) {
                    case 'gifPlayPause':
                        if (e.code === 'Space' && !e.ctrlKey && !e.altKey) {
                            this.animationSystem.togglePlayPause();
                            e.preventDefault();
                        }
                        break;
                        
                    case 'gifPrevFrame':
                        this.animationSystem.goToPreviousFrame();
                        e.preventDefault();
                        break;
                        
                    case 'gifNextFrame':
                        this.animationSystem.goToNextFrame();
                        e.preventDefault();
                        break;
                        
                    case 'gifAddCut':
                        if (e.altKey) {
                            this.animationSystem.createCutFromCurrentState();
                            e.preventDefault();
                        }
                        break;
                }
            });
        }
        
        setupAnimationEvents() {
            // AnimationSystemからのイベント監視
            this.eventBus.on('animation:cut-created', () => {
                this.updateCutsList();
            });
            
            this.eventBus.on('animation:cut-applied', (data) => {
                this.setActiveCut(data.cutIndex);
            });
            
            this.eventBus.on('animation:thumbnail-generated', () => {
                this.updateCutsList();
            });
            
            this.eventBus.on('animation:playback-started', () => {
                this.updatePlaybackUI(true);
            });
            
            this.eventBus.on('animation:playback-paused', () => {
                this.updatePlaybackUI(false);
            });
            
            this.eventBus.on('animation:playback-stopped', () => {
                this.updatePlaybackUI(false);
                this.setActiveCut(0);
            });
            
            this.eventBus.on('animation:cut-changed', (data) => {
                this.setActiveCut(data.cutIndex);
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
            
            this.sortable = Sortable.create(this.cutsContainer, {
                animation: 150,
                onEnd: (evt) => {
                    this.animationSystem.reorderCuts(evt.oldIndex, evt.newIndex);
                }
            });
        }
        
        createCutItem(cut, index) {
            const cutItem = document.createElement('div');
            cutItem.className = 'cut-item';
            cutItem.dataset.cutIndex = index;
            
            // サムネイル表示
            let thumbnailHtml = '<div class="cut-thumbnail-placeholder"></div>';
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
                <div class="cut-info">
                    <div class="cut-name">${cut.name}</div>
                    <input type="number" class="cut-duration" 
                           value="${cut.duration}" 
                           min="0.1" max="10" step="0.1">
                </div>
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
            document.querySelectorAll('.cut-item').forEach((item, i) => {
                if (i === index) {
                    item.classList.add('active');
                } else {
                    item.classList.remove('active');
                }
            });
        }
        
        deleteCut(index) {
            this.animationSystem.deleteCut(index);
            this.updateCutsList();
        }
        
        updatePlaybackUI(isPlaying) {
            const playBtn = document.getElementById('play-btn');
            const pauseBtn = document.getElementById('pause-btn');
            const stopBtn = document.getElementById('stop-btn');
            
            if (playBtn) playBtn.disabled = isPlaying;
            if (pauseBtn) pauseBtn.disabled = !isPlaying;
            if (stopBtn) stopBtn.disabled = !isPlaying;
        }
        
        async exportGIF() {
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
                progressText.textContent = progress + '%';
            }
        }
        
        hideExportProgress() {
            const progressEl = document.getElementById('export-progress');
            if (progressEl) {
                progressEl.style.display = 'none';
            }
        }
        
        show() {
            if (!this.timelinePanel) return;
            
            this.timelinePanel.classList.add('show');
            this.isVisible = true;
            
            // アニメーションモードに切り替え
            this.animationSystem.toggleAnimationMode();
            
            // 初回表示時はCUTリスト更新
            this.updateCutsList();
            
            // 設定値をUIに反映
            this.updateSettingsUI();
        }
        
        hide() {
            if (!this.timelinePanel) return;
            
            this.timelinePanel.classList.remove('show');
            this.isVisible = false;
            
            // アニメーションモード終了
            if (this.animationSystem.isAnimationMode) {
                this.animationSystem.toggleAnimationMode();
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
        
        // 簡易EventBus実装（フォールバック）
        createSimpleEventBus() {
            const events = {};
            return {
                emit: (event, data) => {
                    if (events[event]) {
                        events[event].forEach(callback => callback(data));
                    }
                },
                on: (event, callback) => {
                    if (!events[event]) events[event] = [];
                    events[event].push(callback);
                },
                off: (event, callback) => {
                    if (events[event]) {
                        events[event] = events[event].filter(cb => cb !== callback);
                    }
                }
            };
        }
        
        // デバッグ用
        debugInfo() {
            console.log('TimelineUI Debug Info:');
            console.log('- Visible:', this.isVisible);
            console.log('- Panel:', !!this.timelinePanel);
            console.log('- Container:', !!this.cutsContainer);
            console.log('- Sortable:', !!this.sortable);
            console.log('- GIF Exporter:', !!this.gifExporter);
            
            return {
                isVisible: this.isVisible,
                hasPanel: !!this.timelinePanel,
                hasContainer: !!this.cutsContainer,
                hasSortable: !!this.sortable,
                hasGIFExporter: !!this.gifExporter
            };
        }
    }
    
    window.TegakiTimelineUI = TimelineUI;
    console.log('✅ timeline-ui.js loaded');
})();