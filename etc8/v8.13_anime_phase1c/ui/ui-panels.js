// ===== ui/ui-panels.js - 段階3改修版: メソッド名不整合修正 =====
// GIF アニメーション機能 根本改修計画書 段階3実装
// 【改修完了】UIコントローラーメソッド名不整合修正
// 【改修完了】LayerSystem API統一対応
// Phase 0修正版ベース

(function() {
    'use strict';
    
    // UI Controller class
    class UIController {
        constructor(drawingEngine, layerSystem, app) {
            this.drawingEngine = drawingEngine;
            // 【改修】layerManager → layerSystem に統一
            this.layerSystem = layerSystem;
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
            this.setupKeyboardShortcuts();
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

            // GIFアニメーションツール
            const gifAnimationTool = document.getElementById('gif-animation-tool');
            if (gifAnimationTool) {
                gifAnimationTool.addEventListener('click', () => {
                    if (window.timelineUI) {
                        window.timelineUI.toggle();
                    }
                });
            }
        }
        
        // レイヤーパネルボタン設定（API統一版）
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
        
        // 【改修】新規レイヤー追加処理（LayerSystem API統一）
        addNewLayer() {
            if (!this.layerSystem) {
                console.error('❌ LayerSystem not available');
                return;
            }
            
            try {
                const layerCount = this.layerSystem.layers.length;
                const newLayerName = `レイヤー${layerCount}`;
                
                console.log(`🔧 Creating new layer: ${newLayerName}`);
                
                // LayerSystemのcreateLayer()を呼び出し
                this.layerSystem.createLayer(newLayerName, false);
                
                // 新しいレイヤーをアクティブに設定
                const newLayerIndex = this.layerSystem.layers.length - 1;
                this.layerSystem.setActiveLayer(newLayerIndex);
                
                // UI更新
                this.layerSystem.updateLayerPanelUI();
                this.layerSystem.updateStatusDisplay();
                
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
        
        // キーボードショートカット設定（Ctrl+Shift+N追加）
        setupKeyboardShortcuts() {
            document.addEventListener('keydown', (e) => {
                // Ctrl + Shift + N：新規レイヤー追加
                if (e.ctrlKey && e.shiftKey && e.key === 'N') {
                    e.preventDefault();
                    console.log('🔧 Ctrl+Shift+N: Adding new layer');
                    this.addNewLayer();
                    return;
                }
                
                // Alt + A：タイムライン表示切り替え（EventBusで統合処理）
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
        
        // 【改修】LayerSystem API統一版：レイヤー変形設定
        setupLayerTransformSettings() {
            if (!document.getElementById('layer-transform-panel')) return;
            
            this.setupSlider('layer-x', {
                min: -500,
                max: 500,
                value: 0,
                suffix: 'px',
                callback: (value) => {
                    // 【修正】正しいメソッド名使用
                    this.layerSystem?.updateActiveLayerTransform('x', value);
                }
            });
            
            this.setupSlider('layer-y', {
                min: -500,
                max: 500,
                value: 0,
                suffix: 'px',
                callback: (value) => {
                    // 【修正】正しいメソッド名使用
                    this.layerSystem?.updateActiveLayerTransform('y', value);
                }
            });
            
            this.setupSlider('layer-rotation', {
                min: -180,
                max: 180,
                value: 0,
                suffix: '°',
                callback: (value) => {
                    // 【修正】正しいメソッド名使用
                    this.layerSystem?.updateActiveLayerTransform('rotation', value * Math.PI / 180);
                }
            });
            
            this.setupSlider('layer-scale', {
                min: 0.1,
                max: 3,
                value: 1,
                suffix: 'x',
                decimals: 2,
                callback: (value) => {
                    // 【修正】正しいメソッド名使用・統一スケール適用
                    this.layerSystem?.updateActiveLayerTransform('scale', value);
                }
            });
            
            // 反転ボタン
            const flipHorizontal = document.getElementById('flip-horizontal-btn');
            const flipVertical = document.getElementById('flip-vertical-btn');
            
            if (flipHorizontal) {
                flipHorizontal.addEventListener('click', () => {
                    // 【修正】正しいメソッド名使用
                    this.layerSystem?.flipActiveLayer('horizontal');
                });
            }
            
            if (flipVertical) {
                flipVertical.addEventListener('click', () => {
                    // 【修正】正しいメソッド名使用
                    this.layerSystem?.flipActiveLayer('vertical');
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
        
        // 【改修】LayerSystem API統一版：レイヤー変形値同期
        syncLayerTransformValues() {
            const activeLayer = this.layerSystem?.getActiveLayer();
            if (!activeLayer) return;
            
            const layerId = activeLayer.layerData.id;
            const transform = this.layerSystem.layerTransforms.get(layerId) || 
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
                this.sliders['layer-scale'].value = Math.abs(transform.scaleX);
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
        
        // 【改修】LayerSystem API統一版：SortableJS初期化
        static initializeSortable(layerSystem) {
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
                    
                    if (evt.oldIndex !== evt.newIndex && layerSystem) {
                        // 【改修】LayerSystemに対応するレイヤー順序変更メソッドがあれば呼び出し
                        if (typeof layerSystem.reorderLayers === 'function') {
                            layerSystem.reorderLayers(evt.oldIndex, evt.newIndex);
                        } else {
                            console.warn('LayerSystem.reorderLayers method not implemented');
                        }
                    }
                }
            });
            
            console.log('✅ SortableJS initialized for layer drag & drop');
            return sortable;
        }
        
        // 【改修】デバッグ用：LayerSystem API確認
        debugLayerSystemAPI() {
            if (!this.layerSystem) {
                console.log('❌ LayerSystem not available');
                return { status: 'not_available' };
            }
            
            const apiCheck = {
                hasLayers: !!this.layerSystem.layers,
                layerCount: this.layerSystem.layers ? this.layerSystem.layers.length : 0,
                hasActiveLayer: typeof this.layerSystem.getActiveLayer === 'function',
                hasCreateLayer: typeof this.layerSystem.createLayer === 'function',
                hasUpdateActiveLayerTransform: typeof this.layerSystem.updateActiveLayerTransform === 'function',
                hasFlipActiveLayer: typeof this.layerSystem.flipActiveLayer === 'function',
                hasLayerTransforms: !!this.layerSystem.layerTransforms,
                hasUpdateLayerPanelUI: typeof this.layerSystem.updateLayerPanelUI === 'function',
                hasUpdateStatusDisplay: typeof this.layerSystem.updateStatusDisplay === 'function',
                hasAnimationSystem: !!this.layerSystem.animationSystem
            };
            
            console.log('UIController LayerSystem API Check:');
            console.log('- Has Layers:', apiCheck.hasLayers ? '✅' : '❌');
            console.log('- Layer Count:', apiCheck.layerCount);
            console.log('- Has getActiveLayer():', apiCheck.hasActiveLayer ? '✅' : '❌');
            console.log('- Has createLayer():', apiCheck.hasCreateLayer ? '✅' : '❌');
            console.log('- Has updateActiveLayerTransform():', apiCheck.hasUpdateActiveLayerTransform ? '✅' : '❌');
            console.log('- Has flipActiveLayer():', apiCheck.hasFlipActiveLayer ? '✅' : '❌');
            console.log('- Has layerTransforms:', apiCheck.hasLayerTransforms ? '✅' : '❌');
            console.log('- Has updateLayerPanelUI():', apiCheck.hasUpdateLayerPanelUI ? '✅' : '❌');
            console.log('- Has updateStatusDisplay():', apiCheck.hasUpdateStatusDisplay ? '✅' : '❌');
            console.log('- Has AnimationSystem:', apiCheck.hasAnimationSystem ? '✅' : '❌');
            
            return apiCheck;
        }
        
        // 【改修】互換性維持：レガシーメソッド名対応
        get layerManager() {
            console.warn('⚠️ layerManager is deprecated, use layerSystem instead');
            return this.layerSystem;
        }
        
        set layerManager(value) {
            console.warn('⚠️ layerManager is deprecated, use layerSystem instead');
            this.layerSystem = value;
        }
    }
    
    // グローバル公開（既存互換性維持）
    window.TegakiUI = {
        UIController: UIController,
        initializeSortable: UIController.initializeSortable
    };
    
    console.log('✅ ui/ui-panels.js loaded (段階3改修版: メソッド名不整合修正)');
    console.log('🔧 段階3改修完了:');
    console.log('  - 🔧 layerManager → layerSystem API統一');
    console.log('  - 🔧 updateLayerTransform → updateActiveLayerTransform 修正');
    console.log('  - 🔧 flipLayerHorizontal → flipActiveLayer(\'horizontal\') 修正');
    console.log('  - 🔧 flipLayerVertical → flipActiveLayer(\'vertical\') 修正');
    console.log('  - 🔧 レイヤー変形スライダー統一スケール適用修正');
    console.log('  - 🔧 SortableJS LayerSystem API対応');
    console.log('  - 🔧 レガシー互換性維持（layerManager getter/setter）');
    console.log('  - ✅ 既存機能継承完了');
    console.log('  - ✅ EventBus統合完了');

})();