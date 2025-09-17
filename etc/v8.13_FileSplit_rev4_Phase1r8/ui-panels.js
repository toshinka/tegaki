// ===== ui-panels.js =====
// UI制御システムを名前空間にまとめる（AI作業性最適化）

window.TegakiUI = {
    
    // === UI制御クラス（改修版：パネル操作最適化・サムネイルリサイズ対応） ===
    UIController: class {
        constructor(drawingEngine, layerManager, app) {
            this.drawingEngine = drawingEngine;
            this.layerManager = layerManager;
            this.app = app;
            this.activePopup = null;
            this.toolbarIconClickMode = false;
            this.setupEventDelegation();
            this.setupSliders();
            this.setupCanvasResize();
            window.TegakiUI.setupPanelStyles();
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
                    const layerCount = this.layerManager.layers.length;
                    const { layer, index } = this.layerManager.createLayer(`レイヤー${layerCount}`);
                    this.layerManager.setActiveLayer(index);
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

        handleToolClick(button) {
            const toolId = button.id;
            const CONFIG = window.TEGAKI_CONFIG;
            
            const toolMap = {
                'pen-tool': () => {
                    this.drawingEngine.setTool('pen');
                    
                    // レイヤー移動モードを終了
                    if (this.layerManager.isLayerMoveMode) {
                        this.layerManager.exitLayerMoveMode();
                    }
                    
                    if (!this.toolbarIconClickMode) {
                        this.togglePopup('pen-settings');
                    }
                    this.updateToolUI('pen');
                },
                'eraser-tool': () => {
                    this.drawingEngine.setTool('eraser');
                    
                    // レイヤー移動モードを終了
                    if (this.layerManager.isLayerMoveMode) {
                        this.layerManager.exitLayerMoveMode();
                    }
                    
                    this.closeAllPopups();
                    this.updateToolUI('eraser');
                },
                'resize-tool': () => {
                    this.togglePopup('resize-settings');
                }
            };
            
            const handler = toolMap[toolId];
            if (handler) handler();
        }

        updateToolUI(tool) {
            document.querySelectorAll('.tool-button').forEach(btn => btn.classList.remove('active'));
            const toolBtn = document.getElementById(tool + '-tool');
            if (toolBtn) toolBtn.classList.add('active');

            const toolNames = { pen: 'ベクターペン', eraser: '消しゴム' };
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
                this.drawingEngine.setBrushSize(value);
                return value.toFixed(1) + 'px';
            });
            
            window.TegakiUI.createSlider('pen-opacity-slider', 0, 100, CONFIG.pen.opacity * 100, (value) => {
                this.drawingEngine.setBrushOpacity(value / 100);
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

        // 修正版：キャンバスリサイズ時にサムネイル更新をトリガー
        resizeCanvas(newWidth, newHeight) {
            const CONFIG = window.TEGAKI_CONFIG;
            CONFIG.canvas.width = newWidth;
            CONFIG.canvas.height = newHeight;
            
            const cameraSystem = this.app.cameraSystem;
            if (cameraSystem && cameraSystem.canvasMask) {
                cameraSystem.canvasMask.clear();
                cameraSystem.canvasMask.rect(0, 0, newWidth, newHeight);
                cameraSystem.canvasMask.fill(0xffffff);
            }
            
            if (cameraSystem) {
                cameraSystem.drawCameraFrame();
            }
            
            this.layerManager.layers.forEach(layer => {
                if (layer.layerData.isBackground && layer.layerData.backgroundGraphics) {
                    layer.layerData.backgroundGraphics.clear();
                    layer.layerData.backgroundGraphics.rect(0, 0, newWidth, newHeight);
                    layer.layerData.backgroundGraphics.fill(CONFIG.background.color);
                }
            });
            
            const element = document.getElementById('canvas-info');
            if (element) {
                element.textContent = `${newWidth}×${newHeight}px`;
            }
            
            // 修正版：全レイヤーのサムネイル更新をトリガー（アスペクト比対応のため）
            for (let i = 0; i < this.layerManager.layers.length; i++) {
                this.layerManager.requestThumbnailUpdate(i);
            }
            
            console.log(`Canvas resized to ${newWidth}x${newHeight}`);
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

    // === パネルスタイル設定（反転ボタンスリム化・サムネイル枠動的サイズ対応） ===
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
            
            /* 修正版：サムネイル枠のパネルはみ出し対策 */
            .layer-thumbnail {
                grid-column: 3;
                grid-row: 1 / 3;
                min-width: 24px; /* 縦長時の最小幅 */
                max-width: 72px; /* 横長時の最大幅（パネルから出ない範囲） */
                width: 48px; /* デフォルト幅（正方形時） */
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
                font-size: 12px;
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

    // === SortableJS統合 ===
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