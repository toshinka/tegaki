// ===== ui-panels.js - Phase1: AlbumPopupトグル対応版 =====
// 🎯 責務: UIイベント処理、ポップアップ管理、統一されたインターフェース
// 🔥 Phase1: AlbumPopupにトグル動作を追加

// 🔥 重要: 既存のTegakiUI名前空間を保持
window.TegakiUI = window.TegakiUI || {};

// 🔥 UIControllerクラス定義
window.TegakiUI.UIController = class {
    constructor(drawingEngine, layerManager, app) {
        this.drawingEngine = drawingEngine;
        this.layerManager = layerManager;
        this.app = app;
        this.activePopup = null;
        this.toolbarIconClickMode = false;
        this.albumPopup = null;
        this.settingsPopup = null;
        
        try {
            this.validateCoreRuntime();
            
            this.setupEventDelegation();
            
            // 🔥 EventBusリスナー登録（最優先で実行）
            this.setupEventBusListeners();
            
            this.setupSliders();
            this.setupCanvasResize();
            this.setupFlipButtons();
            
            // SettingsPopupの初期化（EventBusリスナー登録後）
            this.initializeSettingsPopup();
            
            window.TegakiUI.setupPanelStyles();
            
            console.log('✅ UIController initialized successfully (Phase1)');
        } catch (error) {
            console.error('❌ UIController initialization failed:', error);
            throw error;
        }
    }
    
    validateCoreRuntime() {
        if (!window.CoreRuntime) {
            throw new Error('CoreRuntime dependency missing');
        }
        
        if (!window.CoreRuntime.api) {
            throw new Error('CoreRuntime.api not initialized');
        }
    }
    
    initializeSettingsPopup() {
        console.log('🔧 initializeSettingsPopup called');
        console.log('🔍 window.TegakiUI.SettingsPopup:', typeof window.TegakiUI.SettingsPopup);
        
        if (!window.TegakiUI.SettingsPopup) {
            console.warn('⚠️ SettingsPopup class not found');
            return false;
        }
        
        // 既に初期化済みの場合はスキップ
        if (this.settingsPopup) {
            console.log('✅ SettingsPopup already initialized');
            return true;
        }
        
        try {
            this.settingsPopup = new window.TegakiUI.SettingsPopup(this.drawingEngine);
            
            // 🔥 グローバルにも公開（keyboard-handlerからのアクセス用）
            window.TegakiUI.uiController = this;
            
            console.log('✅ SettingsPopup initialized successfully');
            return true;
        } catch (error) {
            console.error('❌ SettingsPopup initialization failed:', error);
            return false;
        }
    }
    
    initializeAlbumPopup(animationSystem) {
        if (!window.AlbumPopup) {
            return false;
        }
        
        if (!animationSystem) {
            return false;
        }
        
        try {
            this.albumPopup = new window.AlbumPopup(
                this.app,
                this.layerManager,
                animationSystem
            );
            console.log('✅ AlbumPopup initialized (Phase1: isVisible対応)');
            return true;
        } catch (error) {
            return false;
        }
    }
    
    // 🆕 EventBusリスナー設定
    setupEventBusListeners() {
        const eventBus = window.TegakiEventBus;
        if (!eventBus) {
            console.error('❌ EventBus not found');
            return;
        }
        
        console.log('📡 Setting up EventBus listeners for UI...');
        
        // 設定ポップアップの表示切替（ショートカット対応）
        eventBus.on('ui:toggle-settings', () => {
            console.log('🎯 ui:toggle-settings event received');
            if (this.settingsPopup) {
                if (this.settingsPopup.isVisible) {
                    this.settingsPopup.hide();
                } else {
                    this.closeAllPopups();
                    this.settingsPopup.show();
                }
            } else {
                console.warn('⚠️ settingsPopup not initialized yet');
            }
        });
        
        // 🔥 設定ポップアップの直接表示（keyboard-handler用）
        eventBus.on('ui:show-settings', () => {
            console.log('🎯 ui:show-settings event received');
            if (this.settingsPopup) {
                this.closeAllPopups();
                this.settingsPopup.show();
            } else {
                console.warn('⚠️ settingsPopup not initialized yet');
            }
        });
        
        console.log('✅ EventBus listeners registered');
    }
    
    setupEventDelegation() {
        document.addEventListener('click', (e) => {
            const toolButton = e.target.closest('.tool-button');
            if (toolButton) {
                this.toolbarIconClickMode = true;
                this.handleToolClick(toolButton);
                this.toolbarIconClickMode = false;
                return;
            }

            const layerAddBtn = e.target.closest('#add-layer-btn');
            if (layerAddBtn) {
                const layerCount = this.getLayerCount();
                const result = window.CoreRuntime.api.createLayer(`レイヤー${layerCount}`);
                if (result) {
                    window.CoreRuntime.api.setActiveLayer(result.index);
                }
                return;
            }
            
            const folderAddBtn = e.target.closest('#add-folder-btn');
            if (folderAddBtn) {
                alert('フォルダ機能は準備中です');
                return;
            }

            // 🔥 画面外クリック処理（AlbumPopup除外）
            // AlbumPopupは独自のオーバーレイクリック処理を持つため、ここでは処理しない
            if (!e.target.closest('.popup-panel') && 
                !e.target.closest('.layer-transform-panel') &&
                !e.target.closest('.tool-button') &&
                !e.target.closest('.layer-panel-container')) {
                // AlbumPopup以外を閉じる
                if (this.settingsPopup && this.settingsPopup.isVisible) {
                    this.settingsPopup.hide();
                }
                const exportPopup = window.TEGAKI_EXPORT_POPUP || window.exportPopup;
                if (exportPopup && exportPopup.isVisible) {
                    exportPopup.hide();
                }
                // DOM直接操作
                document.querySelectorAll('.popup-panel').forEach(popup => {
                    popup.classList.remove('show');
                });
                this.activePopup = null;
            }
        });
    }
    
    getLayerCount() {
        try {
            return this.layerManager?.layers?.length || 1;
        } catch (error) {
            return 1;
        }
    }

    handleToolClick(button) {
        const toolId = button.id;
        console.log('🔧 Tool clicked:', toolId);
        
        const toolMap = {
            'pen-tool': () => {
                const success = window.CoreRuntime.api.setTool('pen');
                if (!success) return;
                
                window.CoreRuntime.api.exitLayerMoveMode();
                
                if (!this.toolbarIconClickMode) {
                    this.togglePopup('pen-settings');
                }
                this.updateToolUI('pen');
            },
            'eraser-tool': () => {
                const success = window.CoreRuntime.api.setTool('eraser');
                if (!success) return;
                
                window.CoreRuntime.api.exitLayerMoveMode();
                
                this.closeAllPopups();
                this.updateToolUI('eraser');
            },
            'resize-tool': () => {
                this.togglePopup('resize-settings');
            },
            'gif-animation-tool': () => {
                if (window.TegakiEventBus) {
                    window.TegakiEventBus.emit('ui:toggle-timeline');
                }
                
                this.closeAllPopups();
                this.updateToolUI('gif-animation');
            },
            // 🔥 Phase1: AlbumPopupトグル動作実装（デバッグ強化版v2）
            'library-tool': () => {
                console.log('📚 Library tool clicked');
                console.log('albumPopup instance:', this.albumPopup);
                console.log('albumPopup constructor:', this.albumPopup?.constructor.name);
                
                if (!this.albumPopup) {
                    console.error('❌ AlbumPopup not initialized');
                    alert('アルバムシステムが初期化されていません');
                    return;
                }
                
                console.log('Before - AlbumPopup.isVisible:', this.albumPopup.isVisible);
                
                if (this.albumPopup.isVisible) {
                    console.log('→ Hiding album popup...');
                    this.albumPopup.hide();
                    console.log('After hide - isVisible:', this.albumPopup.isVisible);
                } else {
                    console.log('→ Showing album popup...');
                    console.log('Step 1: Calling closeAllPopups...');
                    this.closeAllPopups(this.albumPopup);
                    console.log('Step 2: Calling albumPopup.show()...');
                    this.albumPopup.show();
                    console.log('Step 3: After show - isVisible:', this.albumPopup.isVisible);
                    console.log('Step 4: Checking overlay in DOM...');
                    const overlay = document.body.querySelector('div[style*="position: fixed"]');
                    console.log('Overlay found:', !!overlay);
                    if (overlay) {
                        console.log('Overlay display:', overlay.style.display);
                        console.log('Overlay z-index:', overlay.style.zIndex);
                    }
                }
            },
            // 🔥 Phase2: ExportPopupトグル動作実装（デバッグ強化版）
            'export-tool': () => {
                console.log('📤 Export tool clicked');
                const popup = window.TEGAKI_EXPORT_POPUP || window.exportPopup;
                console.log('ExportPopup instance:', popup);
                console.log('window.TEGAKI_EXPORT_POPUP:', window.TEGAKI_EXPORT_POPUP);
                console.log('window.exportPopup:', window.exportPopup);
                
                if (!popup) {
                    console.error('❌ ExportPopup not initialized');
                    alert('エクスポートシステムが初期化されていません');
                    return;
                }
                
                console.log('Before - ExportPopup.isVisible:', popup.isVisible);
                console.log('ExportPopup.show type:', typeof popup.show);
                console.log('ExportPopup.hide type:', typeof popup.hide);
                
                if (popup.isVisible) {
                    console.log('→ Hiding export popup...');
                    popup.hide();
                    console.log('After hide - isVisible:', popup.isVisible);
                } else {
                    console.log('→ Showing export popup...');
                    console.log('Step 1: Calling closeAllPopups...');
                    this.closeAllPopups(popup);
                    console.log('Step 2: Calling popup.show()...');
                    popup.show();
                    console.log('Step 3: After show - isVisible:', popup.isVisible);
                    console.log('Step 4: Checking DOM element...');
                    const exportEl = document.getElementById('export-popup');
                    console.log('Export popup element:', exportEl);
                    if (exportEl) {
                        console.log('Element classList:', exportEl.classList);
                        console.log('Element display:', exportEl.style.display);
                    }
                }
            },
            // 🔥 Phase3: SettingsPopupトグル動作実装（修正版）
            'settings-tool': () => {
                if (!this.settingsPopup) {
                    console.warn('⚠️ settingsPopup not initialized');
                    return;
                }
                
                if (this.settingsPopup.isVisible) {
                    // 既に表示中なら閉じる（トグル動作）
                    this.settingsPopup.hide();
                } else {
                    // 表示していない場合は他を閉じてから開く
                    this.closeAllPopups(this.settingsPopup);
                    this.settingsPopup.show();
                }
            }
        };
        
        const handler = toolMap[toolId];
        if (handler) handler();
    }

    updateToolUI(tool) {
        document.querySelectorAll('.tool-button').forEach(btn => btn.classList.remove('active'));
        const toolBtn = document.getElementById(tool + '-tool');
        if (toolBtn) toolBtn.classList.add('active');

        const toolNames = { 
            pen: 'ベクターペン', 
            eraser: '消しゴム', 
            'gif-animation': 'GIFアニメーション'
        };
        const toolElement = document.getElementById('current-tool');
        if (toolElement) {
            toolElement.textContent = toolNames[tool] || tool;
        }
    }

    togglePopup(popupId) {
        const popup = document.getElementById(popupId);
        if (!popup) return;
        
        if (this.activePopup && this.activePopup !== popup) {
            this.activePopup.classList.remove('show');
        }
        
        const isVisible = popup.classList.contains('show');
        popup.classList.toggle('show', !isVisible);
        this.activePopup = isVisible ? null : popup;
    }

    // 🔥 Phase4: closeAllPopups() 最適化版（修正版v3）
    closeAllPopups(exceptPopup = null) {
        console.log('🧹 closeAllPopups called, except:', exceptPopup?.constructor?.name);
        
        // 管理されたポップアップを順次閉じる（exceptPopupは除外）
        const popups = [
            { name: 'settings', instance: this.settingsPopup },
            { name: 'album', instance: this.albumPopup },
            { name: 'export', instance: window.TEGAKI_EXPORT_POPUP || window.exportPopup }
        ];
        
        popups.forEach(({ name, instance }) => {
            // exceptPopupで指定されたポップアップはスキップ
            if (instance && instance !== exceptPopup) {
                if (instance.isVisible) {
                    console.log(`Closing ${name} popup (isVisible: true)...`);
                    instance.hide();
                }
            } else if (instance === exceptPopup) {
                console.log(`Skipping ${name} popup (except)`);
            }
        });
        
        // 🔥 DOM直接操作 - exceptPopupのDOM要素は除外
        const exportPopup = window.TEGAKI_EXPORT_POPUP || window.exportPopup;
        document.querySelectorAll('.popup-panel').forEach(popup => {
            // exportPopupが除外対象の場合、export-popupはスキップ
            if (exceptPopup === exportPopup && popup.id === 'export-popup') {
                console.log('Skipping export-popup DOM manipulation');
                return;
            }
            popup.classList.remove('show');
        });
        
        this.activePopup = null;
    }

    setupSliders() {
        const CONFIG = window.TEGAKI_CONFIG;
        
        window.TegakiUI.createSlider('pen-size-slider', 0.1, 100, CONFIG.pen.size, (value) => {
            const success = window.CoreRuntime.api.setBrushSize(value);
            return value.toFixed(1) + 'px';
        });
        
        window.TegakiUI.createSlider('pen-opacity-slider', 0, 100, CONFIG.pen.opacity * 100, (value) => {
            const success = window.CoreRuntime.api.setBrushOpacity(value / 100);
            return value.toFixed(1) + '%';
        });
    }

    setupCanvasResize() {
        const applyBtn = document.getElementById('apply-resize');
        if (applyBtn) {
            applyBtn.addEventListener('click', () => {
                const widthInput = document.getElementById('canvas-width');
                const heightInput = document.getElementById('canvas-height');
                
                if (widthInput && heightInput) {
                    const newWidth = parseInt(widthInput.value);
                    const newHeight = parseInt(heightInput.value);
                    
                    if (newWidth > 0 && newHeight > 0) {
                        this.resizeCanvas(newWidth, newHeight);
                        this.closeAllPopups();
                    }
                }
            });
        }
    }

    setupFlipButtons() {
        const flipHorizontalBtn = document.getElementById('flip-horizontal-btn');
        const flipVerticalBtn = document.getElementById('flip-vertical-btn');
        
        if (flipHorizontalBtn) {
            flipHorizontalBtn.addEventListener('click', () => {
                if (this.layerManager && typeof this.layerManager.flipActiveLayer === 'function') {
                    this.layerManager.flipActiveLayer('horizontal');
                }
            });
        }
        
        if (flipVerticalBtn) {
            flipVerticalBtn.addEventListener('click', () => {
                if (this.layerManager && typeof this.layerManager.flipActiveLayer === 'function') {
                    this.layerManager.flipActiveLayer('vertical');
                }
            });
        }
    }

    resizeCanvas(newWidth, newHeight) {
        try {
            const success = window.CoreRuntime.api.resizeCanvas(newWidth, newHeight);
        } catch (error) {
        }
    }
};

// 🔥 ユーティリティ関数をTegakiUI名前空間に追加
window.TegakiUI.createSlider = function(sliderId, min, max, initial, callback) {
    const container = document.getElementById(sliderId);
    if (!container) return;

    const track = container.querySelector('.slider-track');
    const handle = container.querySelector('.slider-handle');
    const valueDisplay = container.parentNode.querySelector('.slider-value');

    if (!track || !handle || !valueDisplay) return;

    let value = initial;
    let dragging = false;

    const update = (newValue) => {
        value = Math.max(min, Math.min(max, newValue));
        const percentage = ((value - min) / (max - min)) * 100;
        
        track.style.width = percentage + '%';
        handle.style.left = percentage + '%';
        valueDisplay.textContent = callback(value);
    };

    const getValue = (clientX) => {
        const rect = container.getBoundingClientRect();
        const percentage = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
        return min + (percentage * (max - min));
    };

    container.addEventListener('mousedown', (e) => {
        dragging = true;
        update(getValue(e.clientX));
        e.preventDefault();
    });

    document.addEventListener('mousemove', (e) => {
        if (dragging) update(getValue(e.clientX));
    });

    document.addEventListener('mouseup', () => {
        dragging = false;
    });

    update(initial);
};

window.TegakiUI.setupPanelStyles = function() {
    const slimStyle = document.createElement('style');
    slimStyle.textContent = `
        .flip-section {
            gap: 2px !important;
            height: 56px;
            display: flex !important;
            flex-direction: column !important;
            justify-content: space-between !important;
        }
        
        .flip-button {
            padding: 4px 8px !important;
            font-size: 10px !important;
            white-space: nowrap !important;
            min-width: auto !important;
            width: auto !important;
            height: 26px !important;
            display: flex !important;
            align-items: center !important;
            justify-content: center !important;
            line-height: 1 !important;
        }
        
        .layer-item {
            width: 180px;
            height: 64px;
            background:  var(--futaba-background);
            opacity: 0.7;  
            border: 1px solid var(--futaba-light-medium);
            border-radius: 6px;
            padding: 6px 8px;
            cursor: pointer;
            transition: background-color 0.2s ease, border-color 0.2s ease;
            display: grid;
            grid-template-columns: 20px 1fr auto;
            grid-template-rows: 1fr 1fr;
            gap: 4px 8px;
            align-items: center;
            user-select: none;
            position: relative;
            box-shadow: 0 1px 2px rgba(128, 0, 0, 0.05);
            min-width: 180px;
            max-width: 180px;
        }
        
        .layer-thumbnail {
            grid-column: 3;
            grid-row: 1 / 3;
            min-width: 24px;
            max-width: 72px;
            height: 48px;
            background: var(--futaba-background);
            border: 1px solid var(--futaba-light-medium);
            border-radius: 4px;
            overflow: hidden;
            position: relative;
            display: flex;
            align-items: center;
            justify-content: center;
            align-self: center;
            transition: width 0.2s ease;
            flex-shrink: 0;
        }
        
        .layer-thumbnail img {
            width: 100%;
            height: 100%;
            object-fit: cover;
            border-radius: 3px;
            transition: opacity 0.2s ease;
        }
        
        .layer-name {
            grid-column: 2;
            grid-row: 2;
            font-size: 9px;
            color: var(--text-primary);
            font-weight: 500;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
            align-self: end;
            margin-bottom: 2px;
            max-width: calc(100% - 8px);
        }
        
        .crosshair-sight {
            display: none !important;
        }
        
        .camera-guide-lines {
            position: absolute;
            pointer-events: none;
            z-index: 1500;
            opacity: 0;
            transition: opacity 0.2s ease;
        }
        
        .camera-guide-lines.show {
            opacity: 1;
        }
        
        .camera-guide-line {
            position: absolute;
            background: var(--futaba-maroon);
            box-shadow: 0 0 2px rgba(255, 255, 255, 0.8);
            opacity: 0.8;
        }
        
        .camera-guide-line.horizontal {
            height: 1px;
            width: 100%;
            top: 50%;
            left: 0;
            transform: translateY(-50%);
        }
        
        .camera-guide-line.vertical {
            width: 1px;
            height: 100%;
            left: 50%;
            top: 0;
            transform: translateX(-50%);
        }
        
        .layer-transform-panel {
            background: rgba(240, 224, 214, 0.95) !important;
            backdrop-filter: blur(12px);
            top: 20px !important;
            left: 50% !important;
            transform: translateX(-50%) !important;
        }
        
        .layer-transform-panel.show {
            animation: slideDown 0.25s ease-out;
        }
        
        @keyframes slideDown {
            from { 
                opacity: 0; 
                transform: translateX(-50%) translateY(-15px) scale(0.95); 
            }
            to { 
                opacity: 1; 
                transform: translateX(-50%) translateY(0) scale(1); 
            }
        }
        
        .panel-sections {
            grid-template-columns: 1fr 1fr auto !important;
            min-width: 480px !important;
        }
        
        .compact-slider-group {
            height: 56px;
            display: flex !important;
            flex-direction: column !important;
            justify-content: space-between !important;
        }
        
        .compact-slider {
            height: 26px;
            display: flex !important;
            align-items: center !important;
            gap: 6px !important;
        }
    `;
    document.head.appendChild(slimStyle);
    
    setTimeout(() => {
        const flipHBtn = document.getElementById('flip-horizontal-btn');
        const flipVBtn = document.getElementById('flip-vertical-btn');
        if (flipHBtn) flipHBtn.textContent = '水平反転';
        if (flipVBtn) flipVBtn.textContent = '垂直反転';
    }, 100);
};

window.TegakiUI.initializeSortable = function(layerManager) {
    const layerList = document.getElementById('layer-list');
    if (!layerList || typeof Sortable === 'undefined') {
        return;
    }
    
    if (layerList.sortableInstance) {
        layerList.sortableInstance.destroy();
        layerList.sortableInstance = null;
    }
    
    layerList.sortableInstance = Sortable.create(layerList, {
        animation: 150,
        ghostClass: 'sortable-ghost',
        chosenClass: 'sortable-chosen',
        handle: '.layer-item',
        onEnd: function(evt) {
            const uiOldIndex = evt.oldIndex;
            const uiNewIndex = evt.newIndex;
            
            const layers = layerManager.getLayers();
            const fromIndex = layers.length - 1 - uiOldIndex;
            const toIndex = layers.length - 1 - uiNewIndex;
            
            if (fromIndex !== toIndex) {
                const success = layerManager.reorderLayers(fromIndex, toIndex);
                
                if (success) {
                    layerManager.updateLayerPanelUI();
                } else {
                    layerManager.updateLayerPanelUI();
                }
            }
        }
    });
};

console.log('✅ ui-panels.js (Phase1-4完了: 全ポップアップ統一完了版) loaded');
console.log('✅ All popups now support: isVisible property + toggle() method');
console.log('✅ window.TegakiUI.UIController:', typeof window.TegakiUI.UIController);