// ===== ui-panels.js - 水平・垂直反転ボタン実装完了版 =====
// 🎯 改修内容：
// - flip-horizontal-btn, flip-vertical-btnのイベントハンドラ実装
// - layer-system.jsのflipActiveLayer()を呼び出し
// - SortableJS統合改善維持

window.TegakiUI = {
    
    // === UI制御クラス（水平・垂直反転ボタン実装版） ===
    UIController: class {
        constructor(drawingEngine, layerManager, app) {
            this.drawingEngine = drawingEngine;
            this.layerManager = layerManager;
            this.app = app;
            this.activePopup = null;
            this.toolbarIconClickMode = false;
            
            this.validateCoreRuntime();
            
            this.setupEventDelegation();
            this.setupSliders();
            this.setupCanvasResize();
            this.setupFlipButtons(); // 🆕 反転ボタンセットアップ
            window.TegakiUI.setupPanelStyles();
        }
        
        validateCoreRuntime() {
            if (!window.CoreRuntime) {
                console.error('UIController: CoreRuntime not available - UI operations may fail');
                throw new Error('CoreRuntime dependency missing');
            }
            
            if (!window.CoreRuntime.api) {
                console.error('UIController: CoreRuntime.api not available');
                throw new Error('CoreRuntime.api not initialized');
            }
            
            console.log('✅ UIController: CoreRuntime dependency validated');
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

                if (!e.target.closest('.popup-panel') && 
                    !e.target.closest('.layer-transform-panel') &&
                    !e.target.closest('.tool-button') &&
                    !e.target.closest('.layer-panel-container')) {
                    this.closeAllPopups();
                }
            });
        }
        
        getLayerCount() {
            try {
                return this.layerManager?.layers?.length || 1;
            } catch (error) {
                console.warn('UIController: Failed to get layer count, using fallback');
                return 1;
            }
        }

        handleToolClick(button) {
            const toolId = button.id;
            const CONFIG = window.TEGAKI_CONFIG;
            
            const toolMap = {
                'pen-tool': () => {
                    const success = window.CoreRuntime.api.setTool('pen');
                    if (!success) {
                        console.error('UIController: Failed to set pen tool');
                        return;
                    }
                    
                    window.CoreRuntime.api.exitLayerMoveMode();
                    
                    if (!this.toolbarIconClickMode) {
                        this.togglePopup('pen-settings');
                    }
                    this.updateToolUI('pen');
                },
                'eraser-tool': () => {
                    const success = window.CoreRuntime.api.setTool('eraser');
                    if (!success) {
                        console.error('UIController: Failed to set eraser tool');
                        return;
                    }
                    
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
                        console.log('🎬 Timeline toggle event emitted');
                    } else {
                        console.error('UIController: TegakiEventBus not available');
                    }
                    
                    this.closeAllPopups();
                    this.updateToolUI('gif-animation');
                },
                'library-tool': () => {
                    alert('アルバム保管機能は準備中です\n\n今後の実装予定:\n- ブラウザ内保存（localStorage/IndexedDB）\n- レイヤー構造含む復元\n- サムネイル表示\n- 削除機能');
                    this.closeAllPopups();
                },
                'export-tool': () => {
                    alert('画像・アニメ出力機能は準備中です\n\n対応予定フォーマット:\n- PNG（静止画）\n- APNG（アニメーション）\n- GIF（優先実装）\n- WEBP（アニメーション）\n- MP4（動画）\n- PDF（ドキュメント）');
                    this.closeAllPopups();
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

        closeAllPopups() {
            document.querySelectorAll('.popup-panel').forEach(popup => {
                popup.classList.remove('show');
            });
            this.activePopup = null;
        }

        setupSliders() {
            const CONFIG = window.TEGAKI_CONFIG;
            
            window.TegakiUI.createSlider('pen-size-slider', 0.1, 100, CONFIG.pen.size, (value) => {
                const success = window.CoreRuntime.api.setBrushSize(value);
                if (!success) {
                    console.error('UIController: Failed to set brush size');
                }
                return value.toFixed(1) + 'px';
            });
            
            window.TegakiUI.createSlider('pen-opacity-slider', 0, 100, CONFIG.pen.opacity * 100, (value) => {
                const success = window.CoreRuntime.api.setBrushOpacity(value / 100);
                if (!success) {
                    console.error('UIController: Failed to set brush opacity');
                }
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

        // 🆕 水平・垂直反転ボタンのイベントハンドラ設定
        setupFlipButtons() {
            const flipHorizontalBtn = document.getElementById('flip-horizontal-btn');
            const flipVerticalBtn = document.getElementById('flip-vertical-btn');
            
            if (flipHorizontalBtn) {
                flipHorizontalBtn.addEventListener('click', () => {
                    if (this.layerManager && typeof this.layerManager.flipActiveLayer === 'function') {
                        this.layerManager.flipActiveLayer('horizontal');
                        console.log('✅ Horizontal flip executed via UI button');
                    } else {
                        console.error('❌ UIController: LayerManager.flipActiveLayer not available');
                    }
                });
            } else {
                console.warn('UIController: flip-horizontal-btn not found in DOM');
            }
            
            if (flipVerticalBtn) {
                flipVerticalBtn.addEventListener('click', () => {
                    if (this.layerManager && typeof this.layerManager.flipActiveLayer === 'function') {
                        this.layerManager.flipActiveLayer('vertical');
                        console.log('✅ Vertical flip executed via UI button');
                    } else {
                        console.error('❌ UIController: LayerManager.flipActiveLayer not available');
                    }
                });
            } else {
                console.warn('UIController: flip-vertical-btn not found in DOM');
            }
        }

        resizeCanvas(newWidth, newHeight) {
            console.log('UIController: Requesting canvas resize via CoreRuntime API:', newWidth, 'x', newHeight);
            
            try {
                const success = window.CoreRuntime.api.resizeCanvas(newWidth, newHeight);
                
                if (success) {
                    console.log('✅ UIController: Canvas resize completed successfully via CoreRuntime');
                } else {
                    console.error('❌ UIController: Canvas resize failed via CoreRuntime');
                }
                
            } catch (error) {
                console.error('UIController: Canvas resize error via CoreRuntime:', error);
            }
        }
    },

    // === スライダー作成関数 ===
    createSlider: function(sliderId, min, max, initial, callback) {
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
    },

    // === パネルスタイル設定 ===
    setupPanelStyles: function() {
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
    },

    // === SortableJS統合完全修正版 ===
    initializeSortable: function(layerManager) {
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
                        console.log(`✅ Layer reordered: ${fromIndex} → ${toIndex}`);
                        layerManager.updateLayerPanelUI();
                    } else {
                        console.error('❌ Layer reorder failed');
                        layerManager.updateLayerPanelUI();
                    }
                }
            }
        });
        
        console.log('✅ Sortable initialized for layer panel');
    }
};

console.log('✅ ui-panels.js 水平・垂直反転ボタン実装完了版 loaded');
console.log('   - flip-horizontal-btn, flip-vertical-btnのイベントハンドラ実装');
console.log('   - layer-system.jsのflipActiveLayer()を呼び出し');