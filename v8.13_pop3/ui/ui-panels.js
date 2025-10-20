// ===== ui-panels.js - 改修版 =====
// 責務: UIイベント管理、ポップアップ制御の一元化
// 🔥 改修: ペンアイコンクリック修正、排他制御統一、エクスポートポップアップ初期化修正
// 🔥 FIX: エクスポートポップアップをDOM直接操作で確実に表示

window.TegakiUI = window.TegakiUI || {};

window.TegakiUI.UIController = class {
    constructor(drawingEngine, layerManager, app) {
        this.drawingEngine = drawingEngine;
        this.layerManager = layerManager;
        this.app = app;
        this.activePopup = null;
        
        // ポップアップ参照（遅延初期化対応）
        this.albumPopup = null;
        this.settingsPopup = null;
        this.exportPopup = null;
        this.quickAccessPopup = null;
        
        this.validateCoreRuntime();
        this.setupEventDelegation();
        this.setupEventBusListeners();
        this.setupSliders();
        this.setupCanvasResize();
        this.setupFlipButtons();
        this.initializeSettingsPopup();
        this.initializeQuickAccessPopup();
        this.initializeStatusPanel();
        window.TegakiUI.setupPanelStyles();
    }
    
    validateCoreRuntime() {
        if (!window.CoreRuntime?.api) {
            throw new Error('CoreRuntime dependency missing');
        }
    }
    
    // ===== ポップアップ参照管理 =====
    
    getExportPopup() {
        // 🔥 FIX: 複数の参照先を順番にチェック
        if (!this.exportPopup) {
            this.exportPopup = 
                window.TEGAKI_EXPORT_POPUP || 
                window.exportPopup || 
                window.exportPopupInstance ||
                window.TegakiUI?.exportPopup;
            
            if (!this.exportPopup) {
                console.warn('⚠️ Export popup instance not found, attempting to create...');
                // 🔥 FIX: ExportManagerが存在すれば手動作成を試みる
                if (window.TEGAKI_EXPORT_MANAGER && window.ExportPopup) {
                    try {
                        this.exportPopup = new window.ExportPopup(window.TEGAKI_EXPORT_MANAGER);
                        window.TEGAKI_EXPORT_POPUP = this.exportPopup;
                        window.exportPopup = this.exportPopup;
                        console.log('✅ Export popup created manually in UIController');
                    } catch (error) {
                        console.error('❌ Failed to create export popup:', error);
                    }
                }
            }
        }
        return this.exportPopup;
    }
    
    getSettingsPopup() {
        return this.settingsPopup;
    }
    
    getAlbumPopup() {
        return this.albumPopup;
    }
    
    getQuickAccessPopup() {
        return this.quickAccessPopup;
    }
    
    initializeAlbumPopup(animationSystem) {
        if (!window.TegakiUI.AlbumPopup || !animationSystem) {
            return false;
        }
        // 🔥 FIX: 既存のインスタンスがある場合は破棄
        if (this.albumPopup && typeof this.albumPopup.hide === 'function') {
            this.albumPopup.hide();
        }
        try {
            this.albumPopup = new window.TegakiUI.AlbumPopup(this.app, this.layerManager, animationSystem);
            // 🔥 FIX: グローバル参照も更新
            window.albumPopupInstance = this.albumPopup;
            return true;
        } catch (error) {
            return false;
        }
    }
    
    initializeSettingsPopup() {
        if (!window.TegakiUI.SettingsPopup) {
            return false;
        }
        if (this.settingsPopup) {
            return true;
        }
        try {
            this.settingsPopup = new window.TegakiUI.SettingsPopup(this.drawingEngine);
            window.TegakiUI.uiController = this;
            return true;
        } catch (error) {
            return false;
        }
    }
    
    initializeQuickAccessPopup() {
        if (!window.TegakiUI.QuickAccessPopup) {
            return false;
        }
        if (this.quickAccessPopup) {
            return true;
        }
        try {
            this.quickAccessPopup = new window.TegakiUI.QuickAccessPopup(this.drawingEngine);
            return true;
        } catch (error) {
            return false;
        }
    }
    
    initializeStatusPanel() {
        const statusPanel = document.querySelector('.status-panel');
        if (statusPanel) {
            statusPanel.style.display = 'none';
        }
    }
    
    // ===== EventBusリスナー =====
    
    setupEventBusListeners() {
        const eventBus = window.TegakiEventBus;
        if (!eventBus) return;
        
        eventBus.on('ui:toggle-settings', () => {
            if (this.settingsPopup) {
                this.settingsPopup.isVisible ? this.settingsPopup.hide() : this.showPopup(this.settingsPopup);
            }
        });
        
        eventBus.on('ui:show-settings', () => {
            if (this.settingsPopup) {
                this.showPopup(this.settingsPopup);
            }
        });
        
        // 🔥 NEW: クイックアクセストグル
        eventBus.on('ui:toggle-quick-access', () => {
            if (this.quickAccessPopup) {
                this.quickAccessPopup.toggle();
            }
        });
        
        // 🔥 NEW: エクスポートマネージャー初期化完了時にポップアップ取得を再試行
        eventBus.on('export:manager:initialized', () => {
            console.log('🔧 ExportManager initialized, refreshing popup reference...');
            this.exportPopup = null; // 参照をクリア
            this.getExportPopup(); // 再取得
        });
    }
    
    // ===== ポップアップ制御 =====
    
    /**
     * ポップアップを表示（他を自動的に閉じる）
     */
    showPopup(popup) {
        if (!popup) return;
        
        this.closeAllPopups(popup);
        
        if (typeof popup.show === 'function') {
            popup.show();
        } else {
            console.error('Popup show method not found:', popup);
        }
    }
    
    /**
     * 全ポップアップを閉じる（除外指定可能）
     */
    closeAllPopups(exceptPopup = null) {
        const popups = [
            this.settingsPopup,
            this.quickAccessPopup,
            this.albumPopup,
            this.getExportPopup()
        ];
        
        popups.forEach(instance => {
            if (instance && instance !== exceptPopup) {
                if (typeof instance.hide === 'function') {
                    instance.hide();
                }
                instance.isVisible = false;
            }
        });
        
        // リサイズポップアップも排他制御対象に
        const resizePopup = document.getElementById('resize-settings');
        if (resizePopup && resizePopup.classList.contains('show') && exceptPopup !== 'resize') {
            resizePopup.classList.remove('show');
        }
        
        // 🔥 FIX: エクスポートポップアップもDOM直接操作で確実に閉じる
        const exportPopupEl = document.getElementById('export-popup');
        if (exportPopupEl && exportPopupEl !== exceptPopup && exceptPopup !== 'export') {
            exportPopupEl.classList.remove('show');
        }
        
        // DOM直接操作で確実に閉じる
        document.querySelectorAll('.popup-panel').forEach(popup => {
            if (popup === exceptPopup?.popup) return;
            if (exceptPopup === 'resize' && popup.id === 'resize-settings') return;
            if (exceptPopup === 'export' && popup.id === 'export-popup') return;
            
            popup.classList.remove('show');
        });
        
        // オーバーレイも削除
        const overlay = document.querySelector('.album-overlay');
        if (overlay && exceptPopup !== this.albumPopup) {
            overlay.remove();
        }
        
        this.activePopup = null;
    }
    
    // ===== イベント委譲 =====
    
    setupEventDelegation() {
        document.addEventListener('click', (e) => {
            const toolButton = e.target.closest('.tool-button');
            if (toolButton) {
                this.handleToolClick(toolButton);
                return;
            }

            const layerAddBtn = e.target.closest('#add-layer-btn');
            if (layerAddBtn) {
                const layerCount = this.layerManager?.layers?.length || 1;
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

            if (!e.target.closest('.popup-panel') && 
                !e.target.closest('.album-overlay') &&
                !e.target.closest('.layer-transform-panel') &&
                !e.target.closest('.tool-button') &&
                !e.target.closest('.layer-panel-container')) {
                this.closeAllPopups();
            }
        });
    }
    
    // ===== ツール処理 =====
    
    handleToolClick(button) {
        const toolId = button.id;
        const toolMap = {
            'pen-tool': () => {
                if (!window.CoreRuntime.api.setTool('pen')) return;
                window.CoreRuntime.api.exitLayerMoveMode();
                
                // 🔥 FIX: ペンアイコンクリックでクイックアクセスポップアップをトグル
                if (this.quickAccessPopup) {
                    this.quickAccessPopup.toggle();
                }
                this.updateToolUI('pen');
            },
            'eraser-tool': () => {
                if (!window.CoreRuntime.api.setTool('eraser')) return;
                window.CoreRuntime.api.exitLayerMoveMode();
                this.closeAllPopups();
                this.updateToolUI('eraser');
            },
            'resize-tool': () => {
                const resizePopup = document.getElementById('resize-settings');
                if (resizePopup) {
                    const isVisible = resizePopup.classList.contains('show');
                    if (isVisible) {
                        resizePopup.classList.remove('show');
                    } else {
                        this.closeAllPopups('resize');
                        resizePopup.classList.add('show');
                    }
                }
            },
            'gif-animation-tool': () => {
                if (window.TegakiEventBus) {
                    window.TegakiEventBus.emit('ui:toggle-timeline');
                }
                this.closeAllPopups();
                this.updateToolUI('gif-animation');
            },
            'library-tool': () => {
                if (!this.albumPopup) {
                    alert('アルバムシステムが初期化されていません');
                    return;
                }
                if (this.albumPopup.isVisible) {
                    this.albumPopup.hide();
                } else {
                    this.showPopup(this.albumPopup);
                }
            },
            'export-tool': () => {
                // 🔥 FIX: DOM直接操作でエクスポートポップアップを確実に表示
                const exportPopupEl = document.getElementById('export-popup');
                
                if (!exportPopupEl) {
                    console.error('❌ Export popup DOM element not found');
                    alert('エクスポートポップアップが見つかりません。\nページをリロードしてください。');
                    return;
                }
                
                // 🔥 FIX: DOM要素から直接状態を取得（インスタンスの状態は無視）
                const isCurrentlyVisible = exportPopupEl.classList.contains('show');
                
                console.log('🔧 Export popup toggle:', {
                    domHasShowClass: isCurrentlyVisible,
                    computedDisplay: window.getComputedStyle(exportPopupEl).display,
                    hasExportManager: !!window.TEGAKI_EXPORT_MANAGER,
                    hasExportPopupInstance: !!this.getExportPopup()
                });
                
                if (isCurrentlyVisible) {
                    // 非表示にする
                    console.log('→ Hiding export popup');
                    exportPopupEl.classList.remove('show');
                    
                    // インスタンスがあればそちらも更新
                    const popupInstance = this.getExportPopup();
                    if (popupInstance) {
                        popupInstance.isVisible = false;
                    }
                } else {
                    // 表示する
                    console.log('→ Showing export popup');
                    
                    // 他のポップアップを閉じる
                    this.closeAllPopups('export');
                    
                    // 🔥 FIX: 確実にshowクラスを追加
                    exportPopupEl.classList.add('show');
                    
                    // 強制的にdisplay: blockを設定（CSSが効かない場合の保険）
                    if (window.getComputedStyle(exportPopupEl).display === 'none') {
                        exportPopupEl.style.display = 'block';
                        console.log('⚠️ Forced display:block (CSS not working)');
                    }
                    
                    // インスタンスがあればそちらも更新
                    const popupInstance = this.getExportPopup();
                    if (popupInstance) {
                        popupInstance.isVisible = true;
                        // インスタンスの初期化メソッドがあれば呼ぶ
                        if (typeof popupInstance.selectFormat === 'function') {
                            popupInstance.selectFormat(popupInstance.selectedFormat || 'png');
                        }
                    }
                    
                    console.log('✅ Export popup shown via DOM manipulation');
                }
            },
            'settings-tool': () => {
                if (this.settingsPopup) {
                    this.settingsPopup.isVisible ? this.settingsPopup.hide() : this.showPopup(this.settingsPopup);
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
        
        const isVisible = popup.classList.contains('show');
        popup.classList.toggle('show', !isVisible);
        this.activePopup = isVisible ? null : popup;
    }
    
    // ===== スライダー・リサイズ =====
    
    setupSliders() {
        const CONFIG = window.TEGAKI_CONFIG;
        
        window.TegakiUI.createSlider('pen-size-slider', 0.1, 100, CONFIG.pen.size, (value) => {
            window.CoreRuntime.api.setBrushSize(value);
            return value.toFixed(1) + 'px';
        });
        
        window.TegakiUI.createSlider('pen-opacity-slider', 0, 100, CONFIG.pen.opacity * 100, (value) => {
            window.CoreRuntime.api.setBrushOpacity(value / 100);
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
                        window.CoreRuntime.api.resizeCanvas(newWidth, newHeight);
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
                if (this.layerManager?.flipActiveLayer) {
                    this.layerManager.flipActiveLayer('horizontal');
                }
            });
        }
        
        if (flipVerticalBtn) {
            flipVerticalBtn.addEventListener('click', () => {
                if (this.layerManager?.flipActiveLayer) {
                    this.layerManager.flipActiveLayer('vertical');
                }
            });
        }
    }
};

// ===== ユーティリティ関数 =====

window.TegakiUI.createSlider = function(sliderId, min, max, initial, callback) {
    const container = document.getElementById(sliderId);
    if (!container) return;

    const track = container.querySelector('.slider-track');
    const handle = container.querySelector('.slider-handle');
    const valueDisplay = container.parentNode?.querySelector('.slider-value');

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
    const style = document.createElement('style');
    style.textContent = `
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
            height: 26px !important;
            display: flex !important;
            align-items: center !important;
            justify-content: center !important;
            line-height: 1 !important;
        }
        
        .layer-item {
            width: 180px;
            height: 64px;
            background: var(--futaba-background);
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
    `;
    document.head.appendChild(style);
    
    setTimeout(() => {
        const flipHBtn = document.getElementById('flip-horizontal-btn');
        const flipVBtn = document.getElementById('flip-vertical-btn');
        if (flipHBtn) flipHBtn.textContent = '水平反転';
        if (flipVBtn) flipVBtn.textContent = '垂直反転';
    }, 100);
};

window.TegakiUI.initializeSortable = function(layerManager) {
    const layerList = document.getElementById('layer-list');
    if (!layerList || typeof Sortable === 'undefined') return;
    
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
            const layers = layerManager.getLayers();
            const fromIndex = layers.length - 1 - evt.oldIndex;
            const toIndex = layers.length - 1 - evt.newIndex;
            
            if (fromIndex !== toIndex) {
                layerManager.reorderLayers(fromIndex, toIndex);
                layerManager.updateLayerPanelUI();
            }
        }
    });
};