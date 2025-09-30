// ===== ui-panels.js - Phase2改修版: タイムライン表示修正 =====
// CHG: アニメアイコン → タイムライン表示イベント発火機能追加

/*
=== Phase2改修完了ヘッダー ===

【改修内容】
✅ gif-animation-toolクリック → ui:toggle-timelineイベント発火
✅ タイムライン表示トリガー実装
✅ 既存機能の非破壊的改修

【変更箇所】
- handleToolClick内のgif-animation-tool処理にEventBus発火追加
- updateToolUI内のgif-animationツール認識追加

=== Phase2改修完了ヘッダー終了 ===
*/

window.TegakiUI = {
    
    // === UI制御クラス（Phase2改修版：タイムライン表示修正） ===
    UIController: class {
        constructor(drawingEngine, layerManager, app) {
            // ⚠️ Phase1.5改修：Engine参照は初期化時のみ保持・直接呼び出し禁止
            this.drawingEngine = drawingEngine; // 初期化時の参照のみ（直接呼び出し禁止）
            this.layerManager = layerManager;   // 初期化時の参照のみ（直接呼び出し禁止）
            this.app = app;
            this.activePopup = null;
            this.toolbarIconClickMode = false;
            
            // CoreRuntime依存性確認
            this.validateCoreRuntime();
            
            this.setupEventDelegation();
            this.setupSliders();
            this.setupCanvasResize();
            window.TegakiUI.setupPanelStyles();
        }
        
        // Phase1.5改修：CoreRuntime依存性確認
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
                    // ✅ Phase1.5改修：CoreRuntime統一API使用
                    const layerCount = this.getLayerCount();
                    const result = window.CoreRuntime.api.createLayer(`レイヤー${layerCount}`);
                    if (result) {
                        window.CoreRuntime.api.setActiveLayer(result.index);
                    }
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
        
        // Phase1.5改修：レイヤー数取得（CoreRuntime経由）
        getLayerCount() {
            try {
                // layerManagerからの情報取得（直接呼び出しではなく参照のみ）
                return this.layerManager?.layers?.length || 1;
            } catch (error) {
                console.warn('UIController: Failed to get layer count, using fallback');
                return 1;
            }
        }

        // CHG: Phase2改修 - タイムライン表示機能追加
        handleToolClick(button) {
            const toolId = button.id;
            const CONFIG = window.TEGAKI_CONFIG;
            
            const toolMap = {
                'pen-tool': () => {
                    // ✅ Phase1.5改修：CoreRuntime統一API使用
                    const success = window.CoreRuntime.api.setTool('pen');
                    if (!success) {
                        console.error('UIController: Failed to set pen tool');
                        return;
                    }
                    
                    // レイヤー移動モード終了もCoreRuntime経由
                    window.CoreRuntime.api.exitLayerMoveMode();
                    
                    if (!this.toolbarIconClickMode) {
                        this.togglePopup('pen-settings');
                    }
                    this.updateToolUI('pen');
                },
                'eraser-tool': () => {
                    // ✅ Phase1.5改修：CoreRuntime統一API使用
                    const success = window.CoreRuntime.api.setTool('eraser');
                    if (!success) {
                        console.error('UIController: Failed to set eraser tool');
                        return;
                    }
                    
                    // レイヤー移動モード終了もCoreRuntime経由
                    window.CoreRuntime.api.exitLayerMoveMode();
                    
                    this.closeAllPopups();
                    this.updateToolUI('eraser');
                },
                'resize-tool': () => {
                    this.togglePopup('resize-settings');
                },
                // CHG: Phase2改修 - GIFアニメーションツール→タイムライン表示
                'gif-animation-tool': () => {
                    // CHG: タイムライン表示イベント発火
                    if (window.TegakiEventBus) {
                        window.TegakiEventBus.emit('ui:toggle-timeline');
                        console.log('🎬 Timeline toggle event emitted');
                    } else {
                        console.error('UIController: TegakiEventBus not available');
                    }
                    
                    this.closeAllPopups();
                    this.updateToolUI('gif-animation');
                }
            };
            
            const handler = toolMap[toolId];
            if (handler) handler();
        }

        // CHG: Phase2改修 - gif-animationツール認識追加
        updateToolUI(tool) {
            document.querySelectorAll('.tool-button').forEach(btn => btn.classList.remove('active'));
            const toolBtn = document.getElementById(tool + '-tool');
            if (toolBtn) toolBtn.classList.add('active');

            // CHG: gif-animationツール名追加
            const toolNames = { 
                pen: 'ベクターペン', 
                eraser: '消しゴム', 
                'gif-animation': 'GIFアニメーション' // CHG: 追加
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
            
            // ✅ Phase1.5改修：CoreRuntime統一API使用
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

        // ✅ Phase1.5改修完了版：CoreRuntime統一API経由のキャンバスリサイズ
        resizeCanvas(newWidth, newHeight) {
            console.log('UIController: Requesting canvas resize via CoreRuntime API:', newWidth, 'x', newHeight);
            
            try {
                // CoreRuntime統一API使用
                const success = window.CoreRuntime.api.resizeCanvas(newWidth, newHeight);
                
                if (success) {
                    console.log('✅ UIController: Canvas resize completed successfully via CoreRuntime');
                } else {
                    console.error('❌ UIController: Canvas resize failed via CoreRuntime');
                    // フォールバック禁止・エラー状態のまま継続
                }
                
            } catch (error) {
                console.error('UIController: Canvas resize error via CoreRuntime:', error);
                // フォールバック禁止・エラー情報のみログ
            }
        }
    },

    // === スライダー作成関数（変更なし） ===
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

    // === パネルスタイル設定（変更なし） ===
    setupPanelStyles: function() {
        // 修正版：サムネイル枠のはみ出し対策＋十字ガイド改善
        const slimStyle = document.createElement('style');
        slimStyle.textContent = `
            /* 反転ボタンスリム化：隣のスライダー2つ分の縦幅に合わせる */
            .flip-section {
                gap: 2px !important;
                height: 56px; /* スライダー2つ分の高さ：28px × 2 */
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
                height: 26px !important; /* スライダー1つ分の高さに近づける */
                display: flex !important;
                align-items: center !important;
                justify-content: center !important;
                line-height: 1 !important;
            }
            
            /* 修正版：レイヤーアイテム全体の幅をパネルに合わせて調整 */
            .layer-item {
                width: 180px; /* パネル幅に合わせて固定 */
                height: 64px;
                background: var(--futaba-cream);
                border: 1px solid var(--futaba-light-medium);
                border-radius: 6px;
                padding: 6px 8px;
                cursor: pointer;
                transition: background-color 0.2s ease, border-color 0.2s ease;
                display: grid;
                grid-template-columns: 20px 1fr auto; /* 3列目を auto に変更 */
                grid-template-rows: 1fr 1fr;
                gap: 4px 8px;
                align-items: center;
                user-select: none;
                position: relative;
                box-shadow: 0 1px 2px rgba(128, 0, 0, 0.05);
                min-width: 180px; /* 最小幅を保証 */
                max-width: 180px; /* 最大幅を制限 */
            }
            
            /* 修正1: サムネイル枠のアスペクト比対応（固定幅削除） */
            .layer-thumbnail {
                grid-column: 3;
                grid-row: 1 / 3;
                min-width: 24px; /* 縦長時の最小幅 */
                max-width: 72px; /* 横長時の最大幅（パネルから出ない範囲） */
                /* width: 48px; 修正1: 固定幅を削除してJavaScript制御に委譲 */
                height: 48px; /* 高さは固定 */
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
                flex-shrink: 0; /* 縮小を防ぐ */
            }
            
            .layer-thumbnail img {
                width: 100%;
                height: 100%;
                object-fit: cover;
                border-radius: 3px;
                transition: opacity 0.2s ease;
            }
            
            /* レイヤー名の調整：サムネイルサイズに応じて幅を調整 */
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
                max-width: calc(100% - 8px); /* サムネイル幅に応じて動的に調整 */
            }
            
            /* 修正版：十字ガイドを削除し、カメラフレーム内のガイドライン表示 */
            .crosshair-sight {
                display: none !important; /* 十字サイトを無効化 */
            }
            
            /* カメラフレーム内ガイドライン用のスタイル */
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
                height: 56px; /* 反転ボタンと同じ高さ */
                display: flex !important;
                flex-direction: column !important;
                justify-content: space-between !important;
            }
            
            .compact-slider {
                height: 26px; /* 反転ボタン1つと同じ高さ */
                display: flex !important;
                align-items: center !important;
                gap: 6px !important;
            }
        `;
        document.head.appendChild(slimStyle);
        
        // 反転ボタンのテキストを確実に設定
        setTimeout(() => {
            const flipHBtn = document.getElementById('flip-horizontal-btn');
            const flipVBtn = document.getElementById('flip-vertical-btn');
            if (flipHBtn) flipHBtn.textContent = '水平反転';
            if (flipVBtn) flipVBtn.textContent = '垂直反転';
        }, 100);
    },

    // === SortableJS統合（変更なし） ===
    initializeSortable: function(layerManager) {
        const layerList = document.getElementById('layer-list');
        if (layerList && typeof Sortable !== 'undefined') {
            Sortable.create(layerList, {
                animation: 150,
                ghostClass: 'sortable-ghost',
                chosenClass: 'sortable-chosen',
                onEnd: function(evt) {
                    const fromIndex = layerManager.layers.length - 1 - evt.oldIndex;
                    const toIndex = layerManager.layers.length - 1 - evt.newIndex;
                    
                    if (fromIndex !== toIndex) {
                        const layer = layerManager.layers.splice(fromIndex, 1)[0];
                        layerManager.layers.splice(toIndex, 0, layer);
                        
                        layerManager.layersContainer.removeChild(layer);
                        layerManager.layersContainer.addChildAt(layer, toIndex);
                        
                        if (layerManager.activeLayerIndex === fromIndex) {
                            layerManager.activeLayerIndex = toIndex;
                        } else if (layerManager.activeLayerIndex > fromIndex && layerManager.activeLayerIndex <= toIndex) {
                            layerManager.activeLayerIndex--;
                        } else if (layerManager.activeLayerIndex < fromIndex && layerManager.activeLayerIndex >= toIndex) {
                            layerManager.activeLayerIndex++;
                        }
                        
                        layerManager.updateLayerPanelUI();
                    }
                }
            });
        }
    }
};