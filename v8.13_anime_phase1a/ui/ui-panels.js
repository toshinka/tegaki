// ===== ui/ui-panels.js - Phase 0修正版 =====
// レイヤー追加ボタンイベントハンドリング修正
// Ctrl + Shift + N ショートカット追加
// Phase 0対応：既存機能を壊さずに改修

(function() {
    'use strict';
    
    // UI Controller class
    class UIController {
        constructor(drawingEngine, layerManager, app) {
            this.drawingEngine = drawingEngine;
            this.layerManager = layerManager;
            this.app = app;
            this.eventBus = window.TegakiEventBus;
            
            this.popupStates = {
                pen: false,
                resize: false,
                layerTransform: false
            };
            
            this.sliders = {};
            this.isDragging = false;
            
            this.setupToolButtons();
            this.setupLayerPanelButtons();
            this.setupPopupPanels();
            this.setupKeyboardShortcuts(); // 修正版ショートカット
        }
        
        setupToolButtons() {
            // ペンツールボタン
            const penTool = document.getElementById('pen-tool');
            if (penTool) {
                penTool.addEventListener('click', () => {
                    this.switchTool('pen');
                });
                
                penTool.addEventListener('contextmenu', (e) => {
                    this.togglePopup('pen');
                    e.preventDefault();
                });
            }
            
            // 消しゴムツールボタン
            const eraserTool = document.getElementById('eraser-tool');
            if (eraserTool) {
                eraserTool.addEventListener('click', () => {
                    this.switchTool('eraser');
                });
            }
            
            // リサイズツールボタン
            const resizeTool = document.getElementById('resize-tool');
            if (resizeTool) {
                resizeTool.addEventListener('click', () => {
                    this.togglePopup('resize');
                });
            }

            // Phase 0: GIFアニメーションツール
            const gifAnimationTool = document.getElementById('gif-animation-tool');
            if (gifAnimationTool) {
                gifAnimationTool.addEventListener('click', () => {
                    if (window.timelineUI) {
                        window.timelineUI.toggle();
                    }
                });
            }
        }
        
        // 修正版：レイヤーパネルボタン設定
        setupLayerPanelButtons() {
            // レイヤー追加ボタン：イベントハンドリング修正
            const addLayerBtn = document.getElementById('add-layer-btn');
            if (addLayerBtn) {
                // 既存のイベントリスナーをクリア
                const newBtn = addLayerBtn.cloneNode(true);
                addLayerBtn.parentNode.replaceChild(newBtn, addLayerBtn);
                
                // 新しいイベントリスナーを設定
                newBtn.addEventListener('click', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    console.log('🔧 Add layer button clicked');
                    this.addNewLayer();
                });
                
                console.log('✅ Layer add button event handler setup completed');
            } else {
                console.warn('⚠️ Add layer button not found');
            }
        }
        
        // 修正版：新規レイヤー追加処理
        addNewLayer() {
            if (!this.layerManager) {
                console.error('❌ LayerManager not available');
                return;
            }
            
            try {
                const layerCount = this.layerManager.layers.length;
                const newLayerName = `レイヤー${layerCount}`;
                
                console.log(`🔧 Creating new layer: ${newLayerName}`);
                
                // LayerSystemのcreateLayer()を呼び出し
                this.layerManager.createLayer(newLayerName, false);
                
                // 新しいレイヤーをアクティブに設定
                const newLayerIndex = this.layerManager.layers.length - 1;
                this.layerManager.setActiveLayer(newLayerIndex);
                
                // UI更新
                this.layerManager.updateLayerPanelUI();
                this.layerManager.updateStatusDisplay();
                
                // EventBus通知
                if (this.eventBus) {
                    this.eventBus.emit('ui:layer-added', { 
                        layerName: newLayerName, 
                        layerIndex: newLayerIndex 
                    });
                }
                
                console.log(`✅ Layer added successfully: ${newLayerName} (index: ${newLayerIndex})`);
                
            } catch (error) {
                console.error('❌ Failed to add new layer:', error);
            }
        }
        
        setupPopupPanels() {
            this.setupPenSettings();
            this.setupResizeSettings();
            this.setupLayerTransformSettings();
            
            // ポップアップ外クリックで閉じる
            document.addEventListener('click', (e) => {
                if (!e.target.closest('.popup-panel') && 
                    !e.target.closest('.layer-transform-panel') && 
                    !e.target.classList.contains('tool-button')) {
                    this.closeAllPopups();
                }
            });
        }
        
        // 修正版：キーボードショートカット設定（Ctrl+Shift+N追加）
        setupKeyboardShortcuts() {
            document.addEventListener('keydown', (e) => {
                // Ctrl + Shift + N：新規レイヤー追加
                if (e.ctrlKey && e.shiftKey && e.key === 'N') {
                    e.preventDefault();
                    console.log('🔧 Ctrl+Shift+N: Adding new layer');
                    this.addNewLayer();
                    return;
                }
                
                // Phase 0: Alt + A：タイムライン表示切り替え（EventBusで統合処理）
                if (e.altKey && e.key === 'a') {
                    if (window.timelineUI) {
                        window.timelineUI.toggle();
                        e.preventDefault();
                    }
                }
            });
            
            console.log('✅ UI keyboard shortcuts setup completed');
            console.log('   - Ctrl+Shift+N: Add new layer');
            console.log('   - Alt+A: Toggle timeline');
        }
        
        setupPenSettings() {
            const penSettings = document.getElementById('pen-settings');
            if (!penSettings) return;
            
            this.setupSlider('pen-size', {
                min: 0.5,
                max: 100,
                value: 16,
                suffix: 'px',
                callback: (value) => {
                    this.drawingEngine.setBrushSize(value);
                }
            });
            
            this.setupSlider('pen-opacity', {
                min: 0,
                max: 1,
                value: 0.85,
                suffix: '%',
                multiplier: 100,
                callback: (value) => {
                    this.drawingEngine.setBrushOpacity(value);
                }
            });
        }
        
        setupResizeSettings() {
            const applyResize = document.getElementById('apply-resize');
            if (applyResize) {
                applyResize.addEventListener('click', () => {
                    const width = parseInt(document.getElementById('canvas-width').value);
                    const height = parseInt(document.getElementById('canvas-height').value);
                    
                    if (width > 0 && height > 0 && window.drawingAppResizeCanvas) {
                        window.drawingAppResizeCanvas(width, height);
                    }
                    
                    this.togglePopup('resize');
                });
            }
        }
        
        setupLayerTransformSettings() {
            if (!document.getElementById('layer-transform-panel')) return;
            
            this.setupSlider('layer-x', {
                min: -500,
                max: 500,
                value: 0,
                suffix: 'px',
                callback: (value) => this.layerManager?.updateLayerTransform('x', value)
            });
            
            this.setupSlider('layer-y', {
                min: -500,
                max: 500,
                value: 0,
                suffix: 'px',
                callback: (value) => this.layerManager?.updateLayerTransform('y', value)
            });
            
            this.setupSlider('layer-rotation', {
                min: -180,
                max: 180,
                value: 0,
                suffix: '°',
                callback: (value) => this.layerManager?.updateLayerTransform('rotation', value * Math.PI / 180)
            });
            
            this.setupSlider('layer-scale', {
                min: 0.1,
                max: 3,
                value: 1,
                suffix: 'x',
                decimals: 2,
                callback: (value) => {
                    this.layerManager?.updateLayerTransform('scaleX', value);
                    this.layerManager?.updateLayerTransform('scaleY', value);
                }
            });
            
            // 反転ボタン
            const flipHorizontal = document.getElementById('flip-horizontal-btn');
            const flipVertical = document.getElementById('flip-vertical-btn');
            
            if (flipHorizontal) {
                flipHorizontal.addEventListener('click', () => {
                    this.layerManager?.flipLayerHorizontal();
                });
            }
            
            if (flipVertical) {
                flipVertical.addEventListener('click', () => {
                    this.layerManager?.flipLayerVertical();
                });
            }
        }
        
        setupSlider(id, config) {
            const slider = document.getElementById(id + '-slider');
            const track = slider?.querySelector('.slider-track');
            const handle = slider?.querySelector('.slider-handle');
            const valueDisplay = document.getElementById(id + '-value');
            
            if (!slider || !track || !handle || !valueDisplay) return;
            
            const sliderConfig = {
                min: config.min || 0,
                max: config.max || 100,
                value: config.value || 0,
                suffix: config.suffix || '',
                multiplier: config.multiplier || 1,
                decimals: config.decimals || 1,
                callback: config.callback || (() => {})
            };
            
            this.sliders[id] = sliderConfig;
            
            const updateSlider = (value) => {
                const percentage = ((value - sliderConfig.min) / (sliderConfig.max - sliderConfig.min)) * 100;
                track.style.width = percentage + '%';
                handle.style.left = percentage + '%';
                
                const displayValue = sliderConfig.multiplier === 100 ? 
                    (value * 100).toFixed(sliderConfig.decimals) : 
                    value.toFixed(sliderConfig.decimals);
                valueDisplay.textContent = displayValue + sliderConfig.suffix;
                
                sliderConfig.callback(value);
            };
            
            const onMouseDown = (e) => {
                this.isDragging = true;
                const rect = slider.getBoundingClientRect();
                const percentage = Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100));
                const value = sliderConfig.min + (percentage / 100) * (sliderConfig.max - sliderConfig.min);
                sliderConfig.value = value;
                updateSlider(value);
                
                e.preventDefault();
            };
            
            const onMouseMove = (e) => {
                if (!this.isDragging) return;
                
                const rect = slider.getBoundingClientRect();
                const percentage = Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100));
                const value = sliderConfig.min + (percentage / 100) * (sliderConfig.max - sliderConfig.min);
                sliderConfig.value = value;
                updateSlider(value);
            };
            
            const onMouseUp = () => {
                this.isDragging = false;
            };
            
            slider.addEventListener('mousedown', onMouseDown);
            handle.addEventListener('mousedown', onMouseDown);
            document.addEventListener('mousemove', onMouseMove);
            document.addEventListener('mouseup', onMouseUp);
            
            updateSlider(sliderConfig.value);
        }
        
        switchTool(tool) {
            // ツール切り替え処理をCoreEngineに委譲
            if (window.TegakiCore?.CoreEngine && window.drawingApp?.switchTool) {
                window.drawingApp.switchTool(tool);
            } else if (this.drawingEngine) {
                this.drawingEngine.setTool(tool);
                this.updateToolUI(tool);
            }
        }
        
        updateToolUI(tool) {
            document.querySelectorAll('.tool-button').forEach(btn => btn.classList.remove('active'));
            const toolBtn = document.getElementById(tool + '-tool');
            if (toolBtn) {
                toolBtn.classList.add('active');
            }
            
            const toolNames = { pen: 'ベクターペン', eraser: '消しゴム' };
            const toolElement = document.getElementById('current-tool');
            if (toolElement) {
                toolElement.textContent = toolNames[tool] || tool;
            }
        }
        
        togglePopup(popupId) {
            const wasOpen = this.popupStates[popupId];
            this.closeAllPopups();
            
            if (!wasOpen) {
                this.showPopup(popupId);
            }
        }
        
        showPopup(popupId) {
            const popup = document.getElementById(popupId + '-settings') || 
                         document.getElementById(popupId + '-panel') ||
                         document.getElementById('layer-transform-panel');
            
            if (popup) {
                popup.classList.add('show');
                this.popupStates[popupId] = true;
                
                // レイヤー変形パネルの場合、現在の値を同期
                if (popupId === 'layerTransform') {
                    this.syncLayerTransformValues();
                }
            }
        }
        
        hidePopup(popupId) {
            const popup = document.getElementById(popupId + '-settings') || 
                         document.getElementById(popupId + '-panel') ||
                         document.getElementById('layer-transform-panel');
            
            if (popup) {
                popup.classList.remove('show');
                this.popupStates[popupId] = false;
            }
        }
        
        closeAllPopups() {
            Object.keys(this.popupStates).forEach(popupId => {
                if (this.popupStates[popupId]) {
                    this.hidePopup(popupId);
                }
            });
        }
        
        syncLayerTransformValues() {
            const activeLayer = this.layerManager?.getActiveLayer();
            if (!activeLayer) return;
            
            const layerId = activeLayer.layerData.id;
            const transform = this.layerManager.layerTransforms.get(layerId) || 
                            { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 };
            
            // スライダー値を同期
            if (this.sliders['layer-x']) {
                this.sliders['layer-x'].value = transform.x;
                this.updateSliderDisplay('layer-x');
            }
            
            if (this.sliders['layer-y']) {
                this.sliders['layer-y'].value = transform.y;
                this.updateSliderDisplay('layer-y');
            }
            
            if (this.sliders['layer-rotation']) {
                this.sliders['layer-rotation'].value = transform.rotation * 180 / Math.PI;
                this.updateSliderDisplay('layer-rotation');
            }
            
            if (this.sliders['layer-scale']) {
                this.sliders['layer-scale'].value = transform.scaleX;
                this.updateSliderDisplay('layer-scale');
            }
        }
        
        updateSliderDisplay(id) {
            const config = this.sliders[id];
            if (!config) return;
            
            const slider = document.getElementById(id + '-slider');
            const track = slider?.querySelector('.slider-track');
            const handle = slider?.querySelector('.slider-handle');
            const valueDisplay = document.getElementById(id + '-value');
            
            if (!slider || !track || !handle || !valueDisplay) return;
            
            const percentage = ((config.value - config.min) / (config.max - config.min)) * 100;
            track.style.width = percentage + '%';
            handle.style.left = percentage + '%';
            
            const displayValue = config.multiplier === 100 ? 
                (config.value * 100).toFixed(config.decimals) : 
                config.value.toFixed(config.decimals);
            valueDisplay.textContent = displayValue + config.suffix;
        }
        
        // SortableJS初期化（レイヤードラッグ＆ドロップ）
        static initializeSortable(layerManager) {
            const layerList = document.getElementById('layer-list');
            if (!layerList || !window.Sortable) return;
            
            const sortable = Sortable.create(layerList, {
                animation: 150,
                ghostClass: 'sortable-ghost',
                chosenClass: 'sortable-chosen',
                onStart: () => {
                    document.body.classList.add('dragging-layer');
                },
                onEnd: (evt) => {
                    document.body.classList.remove('dragging-layer');
                    
                    if (evt.oldIndex !== evt.newIndex && layerManager) {
                        layerManager.reorderLayers(evt.oldIndex, evt.newIndex);
                    }
                }
            });
            
            console.log('✅ SortableJS initialized for layer drag & drop');
            return sortable;
        }
    }
    
    // Phase 0: グローバル公開（既存互換性維持）
    window.TegakiUI = {
        UIController: UIController,
        initializeSortable: UIController.initializeSortable
    };
    
    console.log('✅ ui/ui-panels.js loaded (Phase 0修正版)');
    console.log('   - ✅ レイヤー追加ボタン修正完了');
    console.log('   - ✅ Ctrl+Shift+N ショートカット追加');
    console.log('   - ✅ Alt+A タイムライン切り替え');
    console.log('   - ✅ EventBus統合完了');
    console.log('   - ✅ 既存機能継承完了');

})();