/**
 * AnimationController - Storyboarder風アニメ制御（Phase3-4統合）
 * アニメフォルダ管理・カット切り替え・タイムライン・プレビュー再生制御
 */
export class AnimationController {
    constructor(eventStore, animationStore) {
        this.eventStore = eventStore;
        this.animationStore = animationStore;
        
        // アニメーション状態
        this.isAnimationMode = false;
        this.isPlaying = false;
        this.currentFrame = 0;
        this.fps = 12;
        this.frameInterval = 1000 / this.fps;
        
        // カット管理
        this.currentCut = 1;
        this.cuts = new Map();
        
        // タイムライン UI
        this.timelinePanel = null;
        this.timelineVisible = false;
        
        // 再生制御
        this.playbackTimer = null;
        this.loopPlayback = true;
        
        this.setupEventSubscriptions();
    }
    
    // アニメーションシステム初期化
    initializeAnimationSystem() {
        this.createDefaultCut();
        console.log('✅ Animation system initialized');
    }
    
    // アニメーションモード切り替え
    toggleAnimationMode() {
        this.isAnimationMode = !this.isAnimationMode;
        
        if (this.isAnimationMode) {
            this.enterAnimationMode();
        } else {
            this.exitAnimationMode();
        }
        
        console.log(`🎬 Animation mode: ${this.isAnimationMode ? 'ON' : 'OFF'}`);
    }
    
    // アニメーションモード開始
    enterAnimationMode() {
        this.createTimelinePanel();
        this.showTimelinePanel();
        
        // キャンバス領域調整
        this.adjustCanvasForTimeline();
        
        this.eventStore.emit(this.eventStore.eventTypes.ANIMATION_START, {
            mode: 'enter',
            currentCut: this.currentCut
        });
    }
    
    // アニメーションモード終了  
    exitAnimationMode() {
        this.stopPlayback();
        this.hideTimelinePanel();
        this.restoreCanvasLayout();
        
        this.eventStore.emit(this.eventStore.eventTypes.ANIMATION_STOP, {
            mode: 'exit'
        });
    }
    
    // デフォルトカット作成
    createDefaultCut() {
        const cut = {
            id: 1,
            name: 'カット1',
            frames: [],
            currentFrame: 0,
            frameCount: 24, // 2秒分（12fps）
            layers: [], // このカット専用のレイヤー構成
            created: Date.now()
        };
        
        // 初期フレーム作成
        for (let i = 0; i < cut.frameCount; i++) {
            cut.frames.push({
                index: i,
                thumbnail: null,
                layers: [],
                timestamp: Date.now()
            });
        }
        
        this.cuts.set(cut.id, cut);
        this.currentCut = cut.id;
        
        console.log('✅ Default cut created with', cut.frameCount, 'frames');
    }
    
    // 新しいカット作成
    createNewCut(name = null) {
        const cutId = this.cuts.size + 1;
        const cut = {
            id: cutId,
            name: name || `カット${cutId}`,
            frames: [],
            currentFrame: 0,
            frameCount: 24,
            layers: [],
            created: Date.now()
        };
        
        // フレーム初期化
        for (let i = 0; i < cut.frameCount; i++) {
            cut.frames.push({
                index: i,
                thumbnail: null,
                layers: [],
                timestamp: Date.now()
            });
        }
        
        this.cuts.set(cutId, cut);
        this.switchToCut(cutId);
        
        console.log(`➕ New cut created: ${cut.name}`);
        return cut;
    }
    
    // カット切り替え
    switchToCut(cutId) {
        const cut = this.cuts.get(cutId);
        if (!cut) return false;
        
        this.currentCut = cutId;
        this.currentFrame = cut.currentFrame;
        
        // レイヤーパネル更新（カット専用レイヤー表示）
        this.updateLayerPanelForCut(cut);
        
        // タイムライン UI 更新
        this.updateTimelineUI();
        
        this.eventStore.emit(this.eventStore.eventTypes.ANIMATION_FRAME_CHANGE, {
            cutId,
            frame: this.currentFrame,
            cut
        });
        
        console.log(`🎬 Switched to cut: ${cut.name}`);
        return true;
    }
    
    // フレーム移動
    goToFrame(frameIndex) {
        const cut = this.cuts.get(this.currentCut);
        if (!cut || frameIndex < 0 || frameIndex >= cut.frameCount) return false;
        
        this.currentFrame = frameIndex;
        cut.currentFrame = frameIndex;
        
        // フレーム表示更新
        this.displayFrame(cut, frameIndex);
        
        // タイムライン UI 更新
        this.updateFrameIndicator();
        
        this.eventStore.emit(this.eventStore.eventTypes.ANIMATION_FRAME_CHANGE, {
            cutId: this.currentCut,
            frame: frameIndex
        });
        
        return true;
    }
    
    // 次のフレーム
    nextFrame() {
        const cut = this.cuts.get(this.currentCut);
        if (!cut) return false;
        
        const nextIndex = (this.currentFrame + 1) % cut.frameCount;
        return this.goToFrame(nextIndex);
    }
    
    // 前のフレーム
    previousFrame() {
        const cut = this.cuts.get(this.currentCut);
        if (!cut) return false;
        
        const prevIndex = this.currentFrame - 1 < 0 ? cut.frameCount - 1 : this.currentFrame - 1;
        return this.goToFrame(prevIndex);
    }
    
    // アニメーション再生開始
    startPlayback() {
        if (this.isPlaying) return;
        
        this.isPlaying = true;
        this.playbackTimer = setInterval(() => {
            if (!this.nextFrame() && !this.loopPlayback) {
                this.stopPlayback();
            }
        }, this.frameInterval);
        
        this.updatePlaybackControls();
        console.log('▶️ Animation playback started');
    }
    
    // アニメーション再生停止
    stopPlayback() {
        if (!this.isPlaying) return;
        
        this.isPlaying = false;
        
        if (this.playbackTimer) {
            clearInterval(this.playbackTimer);
            this.playbackTimer = null;
        }
        
        this.updatePlaybackControls();
        console.log('⏸️ Animation playback stopped');
    }
    
    // 再生切り替え
    togglePlayback() {
        if (this.isPlaying) {
            this.stopPlayback();
        } else {
            this.startPlayback();
        }
    }
    
    // FPS 設定
    setFPS(fps) {
        this.fps = Math.max(1, Math.min(60, fps));
        this.frameInterval = 1000 / this.fps;
        
        // 再生中の場合は再設定
        if (this.isPlaying) {
            this.stopPlayback();
            this.startPlayback();
        }
        
        this.updateTimelineUI();
        console.log(`🎞️ FPS set to: ${this.fps}`);
    }
    
    // タイムラインパネル作成
    createTimelinePanel() {
        if (this.timelinePanel) return;
        
        this.timelinePanel = document.createElement('div');
        this.timelinePanel.id = 'timelinePanel';
        this.timelinePanel.className = 'timeline-panel';
        
        // キャンバス下部に配置
        const canvasArea = document.getElementById('canvasArea');
        if (canvasArea) {
            canvasArea.parentElement.insertBefore(this.timelinePanel, canvasArea.nextSibling);
        }
        
        this.updateTimelineUI();
        this.addTimelineStyles();
        this.setupTimelineEvents();
        
        console.log('✅ Timeline panel created');
    }
    
    // タイムライン UI 更新
    updateTimelineUI() {
        if (!this.timelinePanel) return;
        
        const cut = this.cuts.get(this.currentCut);
        if (!cut) return;
        
        const cutTabs = Array.from(this.cuts.values()).map(c => 
            `<div class="cut-tab ${c.id === this.currentCut ? 'active' : ''}" data-cut-id="${c.id}">
                ${c.name}
            </div>`
        ).join('');
        
        const framesList = cut.frames.map((frame, index) => 
            `<div class="frame-item ${index === this.currentFrame ? 'active' : ''}" 
                  data-frame-index="${index}">
                <div class="frame-thumbnail">
                    ${frame.thumbnail || '<div class="frame-placeholder">' + (index + 1) + '</div>'}
                </div>
                <div class="frame-number">${index + 1}</div>
            </div>`
        ).join('');
        
        this.timelinePanel.innerHTML = `
            <div class="timeline-header">
                <div class="cut-tabs">
                    ${cutTabs}
                    <button class="add-cut-btn" data-action="add-cut">+新規</button>
                </div>
                <div class="playback-controls">
                    <button class="control-btn" data-action="first-frame">⏮️</button>
                    <button class="control-btn" data-action="prev-frame">⏪</button>
                    <button class="control-btn play-pause" data-action="toggle-play">
                        ${this.isPlaying ? '⏸️' : '▶️'}
                    </button>
                    <button class="control-btn" data-action="next-frame">⏩</button>
                    <button class="control-btn" data-action="last-frame">⏭️</button>
                    <div class="fps-control">
                        FPS: <input type="number" class="fps-input" value="${this.fps}" min="1" max="60">
                    </div>
                    <div class="frame-info">
                        ${this.currentFrame + 1}/${cut.frameCount} 
                        (${(this.currentFrame / this.fps).toFixed(1)}s)
                    </div>
                </div>
            </div>
            <div class="timeline-content">
                <div class="frames-container">
                    ${framesList}
                </div>
            </div>
        `;
        
        this.setupTimelineEvents();
    }
    
    // タイムラインイベント設定
    setupTimelineEvents() {
        if (!this.timelinePanel) return;
        
        this.timelinePanel.addEventListener('click', (e) => {
            const action = e.target.getAttribute('data-action');
            const cutId = e.target.getAttribute('data-cut-id');
            const frameIndex = e.target.getAttribute('data-frame-index');
            
            switch (action) {
                case 'add-cut':
                    this.createNewCut();
                    break;
                case 'first-frame':
                    this.goToFrame(0);
                    break;
                case 'prev-frame':
                    this.previousFrame();
                    break;
                case 'toggle-play':
                    this.togglePlayback();
                    break;
                case 'next-frame':
                    this.nextFrame();
                    break;
                case 'last-frame':
                    const cut = this.cuts.get(this.currentCut);
                    if (cut) this.goToFrame(cut.frameCount - 1);
                    break;
            }
            
            if (cutId) {
                this.switchToCut(parseInt(cutId));
            }
            
            if (frameIndex !== null) {
                this.goToFrame(parseInt(frameIndex));
            }
        });
        
        // FPS 変更
        const fpsInput = this.timelinePanel.querySelector('.fps-input');
        if (fpsInput) {
            fpsInput.addEventListener('change', (e) => {
                this.setFPS(parseInt(e.target.value));
            });
        }
        
        // キーボードショートカット（タイムライン内）
        this.timelinePanel.addEventListener('keydown', (e) => {
            switch (e.key) {
                case 'ArrowLeft':
                    this.previousFrame();
                    e.preventDefault();
                    break;
                case 'ArrowRight':
                    this.nextFrame();
                    e.preventDefault();
                    break;
                case ' ':
                    this.togglePlayback();
                    e.preventDefault();
                    break;
            }
        });
    }
    
    // フレーム表示
    displayFrame(cut, frameIndex) {
        const frame = cut.frames[frameIndex];
        if (!frame) return;
        
        // 実際の実装では、フレームに保存されたレイヤー状態を復元
        // ここでは概念的な処理のみ
        console.log(`🖼️ Displaying frame ${frameIndex + 1} of cut ${cut.name}`);
    }
    
    // フレームインジケーター更新
    updateFrameIndicator() {
        if (!this.timelinePanel) return;
        
        // アクティブフレーム表示更新
        const frameItems = this.timelinePanel.querySelectorAll('.frame-item');
        frameItems.forEach((item, index) => {
            item.classList.toggle('active', index === this.currentFrame);
        });
        
        // フレーム情報更新
        const frameInfo = this.timelinePanel.querySelector('.frame-info');
        if (frameInfo) {
            const cut = this.cuts.get(this.currentCut);
            if (cut) {
                frameInfo.textContent = 
                    `${this.currentFrame + 1}/${cut.frameCount} (${(this.currentFrame / this.fps).toFixed(1)}s)`;
            }
        }
    }
    
    // 再生コントロール更新
    updatePlaybackControls() {
        const playPauseBtn = this.timelinePanel?.querySelector('.play-pause');
        if (playPauseBtn) {
            playPauseBtn.textContent = this.isPlaying ? '⏸️' : '▶️';
        }
    }
    
    // レイヤーパネル更新（カット専用）
    updateLayerPanelForCut(cut) {
        // 実際の実装では LayerProcessor と連携してカット専用レイヤーを表示
        console.log(`📚 Layer panel updated for cut: ${cut.name}`);
    }
    
    // タイムラインパネル表示
    showTimelinePanel() {
        if (!this.timelinePanel) this.createTimelinePanel();
        
        this.timelinePanel.style.display = 'block';
        this.timelineVisible = true;
        
        // アニメーション表示
        requestAnimationFrame(() => {
            this.timelinePanel.classList.add('visible');
        });
    }
    
    // タイムラインパネル非表示
    hideTimelinePanel() {
        if (!this.timelinePanel) return;
        
        this.timelinePanel.classList.remove('visible');
        this.timelineVisible = false;
        
        setTimeout(() => {
            this.timelinePanel.style.display = 'none';
        }, 300);
    }
    
    // キャンバス領域調整（タイムライン分）
    adjustCanvasForTimeline() {
        const canvasArea = document.getElementById('canvasArea');
        if (canvasArea) {
            canvasArea.style.marginBottom = '200px';
        }
    }
    
    // キャンバスレイアウト復元
    restoreCanvasLayout() {
        const canvasArea = document.getElementById('canvasArea');
        if (canvasArea) {
            canvasArea.style.marginBottom = '0';
        }
    }
    
    // フレーム保存（現在の描画状態）
    saveCurrentFrame() {
        const cut = this.cuts.get(this.currentCut);
        if (!cut) return false;
        
        const frame = cut.frames[this.currentFrame];
        if (!frame) return false;
        
        // 現在の描画状態をフレームに保存
        frame.layers = []; // 実際は現在のレイヤー状態をコピー
        frame.thumbnail = this.generateFrameThumbnail();
        frame.timestamp = Date.now();
        
        // UI 更新
        this.updateTimelineUI();
        
        console.log(`💾 Frame ${this.currentFrame + 1} saved`);
        return true;
    }
    
    // フレームサムネイル生成
    generateFrameThumbnail() {
        // 実際の実装では現在のキャンバス内容から小さなプレビュー画像を生成
        return null; // プレースホルダー
    }
    
    // アニメーション書き出し
    exportAnimation(format = 'gif') {
        const cut = this.cuts.get(this.currentCut);
        if (!cut) return null;
        
        console.log(`📤 Exporting animation as ${format}:`, cut.name);
        
        // 実際の実装では各フレームを画像として書き出し、
        // GIF/MP4/WebM等の形式で結合
        
        return {
            cutName: cut.name,
            frameCount: cut.frameCount,
            fps: this.fps,
            format: format,
            duration: cut.frameCount / this.fps
        };
    }
    
    // オニオンスキン表示（前後フレーム薄表示）
    toggleOnionSkin() {
        // 実装は OGL 描画エンジンと連携
        console.log('🧅 Onion skin toggled');
    }
    
    // タイムライン用スタイル追加
    addTimelineStyles() {
        if (document.getElementById('timeline-styles')) return;
        
        const style = document.createElement('style');
        style.id = 'timeline-styles';
        style.textContent = `
            .timeline-panel {
                position: fixed;
                bottom: 0;
                left: 0;
                right: 0;
                height: 200px;
                background: #1a1a1a;
                border-top: 1px solid #444;
                display: none;
                transform: translateY(100%);
                transition: transform 0.4s ease-out;
                z-index: 1000;
            }
            
            .timeline-panel.visible {
                transform: translateY(0);
            }
            
            .timeline-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding: 8px 16px;
                background: #2a2a2a;
                border-bottom: 1px solid #444;
            }
            
            .cut-tabs {
                display: flex;
                gap: 4px;
                align-items: center;
            }
            
            .cut-tab {
                padding: 6px 12px;
                background: #444;
                border-radius: 4px;
                color: #ccc;
                cursor: pointer;
                font-size: 12px;
                transition: all 0.2s ease;
            }
            
            .cut-tab.active {
                background: var(--main-color);
                color: white;
            }
            
            .cut-tab:hover:not(.active) {
                background: #555;
            }
            
            .add-cut-btn {
                padding: 6px 12px;
                background: #555;
                border: none;
                border-radius: 4px;
                color: #ccc;
                cursor: pointer;
                font-size: 12px;
            }
            
            .add-cut-btn:hover {
                background: #666;
            }
            
            .playback-controls {
                display: flex;
                align-items: center;
                gap: 8px;
            }
            
            .control-btn {
                width: 32px;
                height: 32px;
                background: #444;
                border: none;
                border-radius: 4px;
                color: white;
                cursor: pointer;
                display: flex;
                align-items: center;
                justify-content: center;
                transition: background 0.2s ease;
            }
            
            .control-btn:hover {
                background: #555;
            }
            
            .control-btn.play-pause {
                background: var(--main-color);
            }
            
            .fps-control {
                display: flex;
                align-items: center;
                gap: 4px;
                color: #ccc;
                font-size: 12px;
            }
            
            .fps-input {
                width: 50px;
                padding: 4px;
                background: #333;
                border: 1px solid #555;
                border-radius: 3px;
                color: white;
                text-align: center;
            }
            
            .frame-info {
                color: #ccc;
                font-size: 12px;
                font-family: monospace;
            }
            
            .timeline-content {
                flex: 1;
                overflow-x: auto;
                padding: 8px;
            }
            
            .frames-container {
                display: flex;
                gap: 4px;
                min-width: 100%;
            }
            
            .frame-item {
                flex-shrink: 0;
                width: 80px;
                background: #333;
                border: 2px solid transparent;
                border-radius: 4px;
                cursor: pointer;
                transition: all 0.2s ease;
            }
            
            .frame-item.active {
                border-color: var(--main-color);
            }
            
            .frame-item:hover:not(.active) {
                border-color: #555;
            }
            
            .frame-thumbnail {
                width: 76px;
                height: 56px;
                background: #444;
                border-radius: 2px;
                margin: 2px;
                display: flex;
                align-items: center;
                justify-content: center;
            }
            
            .frame-placeholder {
                color: #666;
                font-size: 14px;
                font-weight: bold;
            }
            
            .frame-number {
                text-align: center;
                padding: 4px;
                color: #ccc;
                font-size: 10px;
            }
        `;
        
        document.head.appendChild(style);
    }
    
    // イベント購読設定
    setupEventSubscriptions() {
        // アニメーションモード切り替え要求
        this.eventStore.on(this.eventStore.eventTypes.ANIMATION_START, (data) => {
            if (data.payload.mode === 'toggle') {
                this.toggleAnimationMode();
            }
        });
        
        // キーボードショートカット連携
        document.addEventListener('keydown', (e) => {
            if (!this.timelineVisible) return;
            
            // グローバルアニメーションショートカット
            if (e.key === 'Enter') {
                e.preventDefault();
                this.saveCurrentFrame();
            }
        });
    }
    
    // アニメーション準備状態チェック
    isReady() {
        return this.cuts.size > 0;
    }
    
    // アニメーション開始（外部API）
    startAnimation(config = {}) {
        this.isAnimationMode = true;
        
        if (config.cutId) {
            this.switchToCut(config.cutId);
        }
        
        if (config.frame !== undefined) {
            this.goToFrame(config.frame);
        }
        
        if (config.autoPlay) {
            this.startPlayback();
        }
        
        this.enterAnimationMode();
    }
    
    // 統計情報取得
    getAnimationStats() {
        return {
            cutCount: this.cuts.size,
            currentCut: this.currentCut,
            currentFrame: this.currentFrame,
            fps: this.fps,
            isPlaying: this.isPlaying,
            totalFrames: Array.from(this.cuts.values()).reduce((sum, cut) => sum + cut.frameCount, 0)
        };
    }
    
    // デバッグ情報
    getDebugInfo() {
        return {
            isAnimationMode: this.isAnimationMode,
            isPlaying: this.isPlaying,
            stats: this.getAnimationStats(),
            timelineVisible: this.timelineVisible
        };
    }
    
    // クリーンアップ
    destroy() {
        this.stopPlayback();
        
        if (this.timelinePanel) {
            this.timelinePanel.remove();
        }
        
        this.cuts.clear();
        
        console.log('✅ Animation controller destroyed');
    }
}