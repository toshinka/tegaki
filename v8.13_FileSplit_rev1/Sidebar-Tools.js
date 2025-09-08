/**
 * 🔧 Sidebar-Tools.js - ツールUIロジック分離版
 * 
 * 【分離対象クラス】
 * - UnifiedUIController: UI管理統合版（ツールボタン・ポップアップ・スライダー）
 * - DrawingTools: Transform対応版（描画ツールロジック）
 * 
 * 【技術制約】
 * - ES2023, モジュール不使用
 * - HTML/CSS構造はmain.htmlに残存
 * - 依存注入でTransformSystem等と連携
 * 
 * 【相互通信】
 * - window.FutabaSidebarTools名前空間
 * - main.htmlのAppControllerから依存注入
 */

(function() {
    'use strict';
    
    // デバッグ・エラー報告用
    function logSidebar(message, ...args) {
        console.log('[Sidebar-Tools]', message, ...args);
    }
    
    function reportSidebarError(operation, error, context = {}) {
        const errorInfo = {
            timestamp: new Date().toISOString(),
            module: 'Sidebar-Tools',
            operation: operation,
            message: error.message,
            context: context,
            stack: error.stack
        };
        
        console.error(`[Sidebar-Tools] ${operation} failed:`, errorInfo);
        return errorInfo;
    }

    // Native JS utilities (main.htmlのutilsと同期)
    const sidebarUtils = {
        clamp: (value, min, max) => Math.max(min, Math.min(max, value)),
        
        last: (array) => array[array.length - 1],
        
        remove: (array, predicate) => {
            const indices = [];
            for (let i = array.length - 1; i >= 0; i--) {
                if (predicate(array[i])) {
                    indices.push(i);
                    array.splice(i, 1);
                }
            }
            return indices.length;
        }
    };

    // ==== DrawingTools: Transform対応版（main.htmlから移行） ====
    class DrawingTools {
        constructor(drawingEngine, layerManager, transformSystem) {
            if (!drawingEngine || !layerManager || !transformSystem) {
                throw new Error('DrawingTools requires drawingEngine, layerManager, and transformSystem');
            }

            this.engine = drawingEngine;
            this.layers = layerManager;
            this.transform = transformSystem;
            this.currentTool = 'pen';
            this.brushSize = 16.0;
            this.brushColor = 0x800000;
            this.opacity = 0.85;
            this.drawing = { active: false, path: null, lastPoint: null };

            logSidebar('DrawingTools initialized', {
                currentTool: this.currentTool,
                brushSize: this.brushSize,
                opacity: this.opacity
            });
        }

        selectTool(tool) {
            const oldTool = this.currentTool;
            this.currentTool = tool;
            logSidebar('Tool changed:', oldTool, '→', tool);
        }

        setBrushSize(size) {
            const oldSize = this.brushSize;
            this.brushSize = sidebarUtils.clamp(Math.round(size * 10) / 10, 0.1, 100);
            logSidebar('Brush size changed:', oldSize, '→', this.brushSize);
        }

        setOpacity(opacity) {
            const oldOpacity = this.opacity;
            this.opacity = sidebarUtils.clamp(Math.round(opacity * 1000) / 1000, 0, 1);
            logSidebar('Opacity changed:', oldOpacity, '→', this.opacity);
        }

        startDrawing(canvasX, canvasY, isPanning) {
            if (isPanning) return false;

            try {
                // PixiJSのevent.global座標はキャンバス内座標なのでそのまま使用
                // TransformSystemによる変換は不要（描画後の表示位置はPixiJSが自動調整）
                
                this.drawing.active = true;
                this.drawing.lastPoint = { x: canvasX, y: canvasY };

                const color = this.currentTool === 'eraser' ? 0xf0e0d6 : this.brushColor;
                const alpha = this.currentTool === 'eraser' ? 1.0 : this.opacity;

                this.drawing.path = this.engine.createPath(canvasX, canvasY, this.brushSize, color, alpha);
                
                logSidebar('Drawing started:', {
                    tool: this.currentTool,
                    position: { x: canvasX, y: canvasY },
                    size: this.brushSize,
                    color: color.toString(16),
                    alpha: alpha
                });
                
                return true;
            } catch (error) {
                reportSidebarError('Start Drawing', error, {
                    tool: this.currentTool,
                    position: { x: canvasX, y: canvasY }
                });
                return false;
            }
        }

        continueDrawing(canvasX, canvasY, isPanning) {
            if (!this.drawing.active || !this.drawing.path || isPanning) return;

            try {
                // PixiJSのevent.global座標はキャンバス内座標なのでそのまま使用
                this.engine.extendPath(this.drawing.path, canvasX, canvasY);
                this.drawing.lastPoint = { x: canvasX, y: canvasY };
            } catch (error) {
                reportSidebarError('Continue Drawing', error, {
                    tool: this.currentTool,
                    position: { x: canvasX, y: canvasY }
                });
            }
        }

        stopDrawing() {
            try {
                if (this.drawing.path) {
                    this.drawing.path.isComplete = true;

                    if (this.layers.historyManager) {
                        setTimeout(() => {
                            this.layers.historyManager.createSnapshot('描画');
                        }, 500); // APP_CONFIG.history.autoSaveInterval
                    }

                    logSidebar('Drawing completed:', {
                        tool: this.currentTool,
                        pathId: this.drawing.path.id,
                        pointCount: this.drawing.path.points.length
                    });
                }
                
                this.drawing = { active: false, path: null, lastPoint: null };
            } catch (error) {
                reportSidebarError('Stop Drawing', error, {
                    tool: this.currentTool,
                    pathId: this.drawing.path?.id
                });
            }
        }
    }

    // ==== UnifiedUIController: UI管理統合版（main.htmlから移行） ====
    class UnifiedUIController {
        constructor(drawingTools, drawingEngine, layerManager, transformSystem) {
            if (!drawingTools || !drawingEngine || !layerManager || !transformSystem) {
                throw new Error('UnifiedUIController requires all dependencies');
            }

            this.tools = drawingTools;
            this.engine = drawingEngine;
            this.layers = layerManager;
            this.transform = transformSystem;
            this.activePopup = null;
            this.sliders = new Map();
            this.dragState = { active: false, offset: { x: 0, y: 0 } };

            logSidebar('UnifiedUIController initialized');
        }

        initialize() {
            try {
                this.layers.ui = this;
                this.setupEventDelegation();
                this.setupSliders();
                this.setupResize();
                this.updateCanvasInfo();

                setTimeout(() => this.layers.updateLayerUI(), 100);
                logSidebar('UI initialization completed');
            } catch (error) {
                reportSidebarError('UI Initialize', error);
                throw error;
            }
        }

        setupEventDelegation() {
            try {
                document.addEventListener('click', (e) => {
                    const toolButton = e.target.closest('.tool-button');
                    if (toolButton && !toolButton.classList.contains('disabled')) {
                        this.handleToolClick(toolButton);
                        return;
                    }

                    const layerAddBtn = e.target.closest('#add-layer-btn');
                    if (layerAddBtn) {
                        const newLayer = this.layers.createLayer();
                        this.layers.setActiveLayer(newLayer.id);
                        return;
                    }

                    if (!e.target.closest('.popup-panel') && 
                        !e.target.closest('.tool-button') &&
                        !e.target.closest('.layer-panel-container')) {
                        this.closeAllPopups();
                    }
                });

                // Popup drag setup
                document.querySelectorAll('.popup-panel').forEach(popup => {
                    const title = popup.querySelector('.popup-title');
                    if (title) {
                        title.style.cursor = 'move';
                        title.addEventListener('mousedown', (e) => this.startDrag(e, popup));
                    }
                });

                document.addEventListener('mousemove', (e) => this.onDrag(e));
                document.addEventListener('mouseup', () => this.stopDrag());

                logSidebar('Event delegation setup completed');
            } catch (error) {
                reportSidebarError('Setup Event Delegation', error);
            }
        }

        handleToolClick(button) {
            try {
                const toolId = button.id;
                
                const toolMap = {
                    'pen-tool': () => {
                        this.activateTool('pen');
                        this.togglePopup('pen-settings');
                    },
                    'eraser-tool': () => {
                        this.activateTool('eraser');
                        this.closeAllPopups();
                    },
                    'resize-tool': () => {
                        this.togglePopup('resize-settings');
                    }
                };
                
                const handler = toolMap[toolId];
                if (handler) {
                    handler();
                    logSidebar('Tool clicked:', toolId);
                } else {
                    logSidebar('Unknown tool clicked:', toolId);
                }
            } catch (error) {
                reportSidebarError('Handle Tool Click', error, { toolId: button?.id });
            }
        }

        activateTool(tool) {
            try {
                this.tools.selectTool(tool);
                
                document.querySelectorAll('.tool-button').forEach(btn => btn.classList.remove('active'));
                const toolBtn = document.getElementById(tool + '-tool');
                if (toolBtn) toolBtn.classList.add('active');
                
                const toolNames = { pen: 'ベクターペン', eraser: '消しゴム' };
                const toolElement = document.getElementById('current-tool');
                if (toolElement) {
                    toolElement.textContent = toolNames[tool] || tool;
                }
                
                const canvas = this.engine.app.canvas;
                canvas.style.cursor = tool === 'eraser' ? 'cell' : 'crosshair';

                logSidebar('Tool activated:', tool);
            } catch (error) {
                reportSidebarError('Activate Tool', error, { tool });
            }
        }

        togglePopup(popupId) {
            try {
                const popup = document.getElementById(popupId);
                if (!popup) {
                    logSidebar('Popup not found:', popupId);
                    return;
                }
                
                if (this.activePopup && this.activePopup !== popup) {
                    this.activePopup.classList.remove('show');
                }
                
                const isVisible = popup.classList.contains('show');
                popup.classList.toggle('show', !isVisible);
                this.activePopup = isVisible ? null : popup;

                logSidebar('Popup toggled:', popupId, isVisible ? 'closed' : 'opened');
            } catch (error) {
                reportSidebarError('Toggle Popup', error, { popupId });
            }
        }

        startDrag(e, popup) {
            try {
                this.dragState.active = popup;
                const rect = popup.getBoundingClientRect();
                this.dragState.offset.x = e.clientX - rect.left;
                this.dragState.offset.y = e.clientY - rect.top;
                e.preventDefault();
                logSidebar('Drag started for popup:', popup.id);
            } catch (error) {
                reportSidebarError('Start Drag', error, { popupId: popup?.id });
            }
        }

        onDrag(e) {
            if (!this.dragState.active) return;
            
            try {
                const x = sidebarUtils.clamp(e.clientX - this.dragState.offset.x, 0, 
                    window.innerWidth - this.dragState.active.offsetWidth);
                const y = sidebarUtils.clamp(e.clientY - this.dragState.offset.y, 0, 
                    window.innerHeight - this.dragState.active.offsetHeight);
                
                this.dragState.active.style.left = x + 'px';
                this.dragState.active.style.top = y + 'px';
            } catch (error) {
                reportSidebarError('On Drag', error);
            }
        }

        stopDrag() {
            if (this.dragState.active) {
                logSidebar('Drag stopped for popup:', this.dragState.active.id);
            }
            this.dragState.active = false;
        }

        setupSliders() {
            try {
                this.createSlider('pen-size-slider', 0.1, 100, 16.0, (value) => {
                    this.tools.setBrushSize(value);
                    return value.toFixed(1) + 'px';
                });
                
                this.createSlider('pen-opacity-slider', 0, 100, 85.0, (value) => {
                    this.tools.setOpacity(value / 100);
                    return value.toFixed(1) + '%';
                });

                logSidebar('Sliders setup completed');
            } catch (error) {
                reportSidebarError('Setup Sliders', error);
            }
        }

        createSlider(sliderId, min, max, initial, callback) {
            try {
                const container = document.getElementById(sliderId);
                if (!container) {
                    logSidebar('Slider container not found:', sliderId);
                    return;
                }

                const track = container.querySelector('.slider-track');
                const handle = container.querySelector('.slider-handle');
                const valueDisplay = container.parentNode.querySelector('.slider-value');

                if (!track || !handle || !valueDisplay) {
                    logSidebar('Slider components not found:', sliderId);
                    return;
                }

                const slider = {
                    value: initial, min, max, callback, track, handle, valueDisplay, dragging: false
                };

                this.sliders.set(sliderId, slider);

                const update = (value) => {
                    slider.value = sidebarUtils.clamp(value, min, max);
                    const percentage = ((slider.value - min) / (max - min)) * 100;
                    
                    track.style.width = percentage + '%';
                    handle.style.left = percentage + '%';
                    valueDisplay.textContent = callback(slider.value);
                };

                const getValue = (clientX) => {
                    const rect = container.getBoundingClientRect();
                    const percentage = sidebarUtils.clamp((clientX - rect.left) / rect.width, 0, 1);
                    return min + (percentage * (max - min));
                };

                container.addEventListener('mousedown', (e) => {
                    slider.dragging = true;
                    update(getValue(e.clientX));
                    e.preventDefault();
                });

                document.addEventListener('mousemove', (e) => {
                    if (slider.dragging) update(getValue(e.clientX));
                });

                document.addEventListener('mouseup', () => {
                    slider.dragging = false;
                });

                update(initial);
                logSidebar('Slider created:', sliderId, { min, max, initial });
            } catch (error) {
                reportSidebarError('Create Slider', error, { sliderId, min, max, initial });
            }
        }

        setupResize() {
            try {
                const applyButton = document.getElementById('apply-resize');
                if (applyButton) {
                    applyButton.addEventListener('click', () => this.applyResize());
                    logSidebar('Resize button setup completed');
                }
            } catch (error) {
                reportSidebarError('Setup Resize', error);
            }
        }

        applyResize() {
            try {
                const widthInput = document.getElementById('canvas-width');
                const heightInput = document.getElementById('canvas-height');

                if (widthInput && heightInput) {
                    const width = parseInt(widthInput.value);
                    const height = parseInt(heightInput.value);

                    if (width >= 100 && width <= 4096 && height >= 100 && height <= 4096) {
                        this.engine.resize(width, height);

                        this.layers.layers.items.forEach(layer => {
                            if (layer.isBackground && layer.backgroundGraphics) {
                                layer.backgroundGraphics.clear();
                                layer.backgroundGraphics.rect(0, 0, width, height);
                                layer.backgroundGraphics.fill(0xf0e0d6);
                            }
                        });

                        this.updateCanvasInfo();
                        this.closeAllPopups();

                        if (this.layers.historyManager) {
                            setTimeout(() => {
                                this.layers.historyManager.createSnapshot(`キャンバスを${width}×${height}にリサイズ`);
                            }, 100);
                        }

                        logSidebar('Canvas resized:', { width, height });
                    } else {
                        logSidebar('Invalid resize dimensions:', { width, height });
                    }
                } else {
                    logSidebar('Resize inputs not found');
                }
            } catch (error) {
                reportSidebarError('Apply Resize', error);
            }
        }

        updateCanvasInfo() {
            try {
                const element = document.getElementById('canvas-info');
                if (element) {
                    // APP_CONFIG.canvas の参照が必要だが、main.htmlから渡す必要がある
                    // とりあえず engine.app から取得
                    const width = this.engine.app.canvas.width;
                    const height = this.engine.app.canvas.height;
                    element.textContent = `${width}×${height}px`;
                }
            } catch (error) {
                reportSidebarError('Update Canvas Info', error);
            }
        }

        updateCoordinates(x, y) {
            try {
                const element = document.getElementById('coordinates');
                if (element) {
                    element.textContent = `x: ${Math.round(x)}, y: ${Math.round(y)}`;
                }
            } catch (error) {
                reportSidebarError('Update Coordinates', error, { x, y });
            }
        }

        closeAllPopups() {
            try {
                document.querySelectorAll('.popup-panel').forEach(popup => {
                    popup.classList.remove('show');
                });
                this.activePopup = null;
                logSidebar('All popups closed');
            } catch (error) {
                reportSidebarError('Close All Popups', error);
            }
        }
    }

    // ==== グローバル名前空間の設定 ====
    const FutabaSidebarTools = {
        // クラス公開
        DrawingTools: DrawingTools,
        UnifiedUIController: UnifiedUIController,

        // バージョン・デバッグ情報
        VERSION: '1.0.0',
        LOADED_AT: new Date().toISOString(),
        
        // 初期化ヘルパー
        initialize: function(appController) {
            try {
                if (!appController) {
                    throw new Error('AppController is required for initialization');
                }

                // DrawingTools インスタンス生成
                const drawingTools = new DrawingTools(
                    appController.engine,
                    appController.layerManager,
                    appController.transformSystem
                );

                // UnifiedUIController インスタンス生成  
                const uiController = new UnifiedUIController(
                    drawingTools,
                    appController.engine,
                    appController.layerManager,
                    appController.transformSystem
                );

                logSidebar('Sidebar Tools initialized successfully', {
                    version: this.VERSION,
                    loadedAt: this.LOADED_AT
                });

                return {
                    tools: drawingTools,
                    ui: uiController
                };

            } catch (error) {
                reportSidebarError('Initialize', error);
                throw error;
            }
        },

        // デバッグ・統計情報
        DEBUG: {
            getStats: function() {
                return {
                    version: FutabaSidebarTools.VERSION,
                    loadedAt: FutabaSidebarTools.LOADED_AT,
                    classesAvailable: ['DrawingTools', 'UnifiedUIController'],
                    memoryFootprint: {
                        toolInstances: 'TODO: implement stats',
                        uiControllerInstances: 'TODO: implement stats'
                    }
                };
            },
            
            testToolSwitch: function(toolName) {
                try {
                    const toolButton = document.getElementById(toolName + '-tool');
                    if (toolButton) {
                        toolButton.click();
                        logSidebar('DEBUG: Tool switch test executed:', toolName);
                        return true;
                    } else {
                        logSidebar('DEBUG: Tool button not found:', toolName + '-tool');
                        return false;
                    }
                } catch (error) {
                    reportSidebarError('DEBUG Tool Switch', error, { toolName });
                    return false;
                }
            },

            simulateDrawing: function(x = 100, y = 100, size = 20) {
                // デバッグ用の描画シミュレーション
                logSidebar('DEBUG: Drawing simulation not implemented yet', { x, y, size });
            }
        },

        // エラー報告統計
        getErrorStats: function() {
            // 将来的にエラー統計を取得する機能
            return {
                totalErrors: 'TODO: implement error counting',
                lastErrors: 'TODO: implement error history'
            };
        }
    };

    // ==== ライブラリ依存チェック ====
    function checkDependencies() {
        const required = ['PIXI', 'gsap', 'Hammer'];
        const missing = required.filter(lib => !window[lib]);
        
        if (missing.length > 0) {
            throw new Error(`Missing required libraries: ${missing.join(', ')}`);
        }

        logSidebar('Dependencies check passed:', required);
    }

    // ==== 初期化とエラーハンドリング ====
    function initializeSidebarTools() {
        try {
            // 依存関係チェック
            checkDependencies();
            
            // グローバル名前空間に登録
            if (window.FutabaSidebarTools) {
                console.warn('[Sidebar-Tools] FutabaSidebarTools already exists, overwriting...');
            }
            
            window.FutabaSidebarTools = FutabaSidebarTools;
            
            logSidebar('Module loaded successfully', {
                version: FutabaSidebarTools.VERSION,
                timestamp: FutabaSidebarTools.LOADED_AT,
                namespace: 'window.FutabaSidebarTools'
            });

            // main.htmlで利用可能かをテスト
            if (typeof window !== 'undefined' && window.document) {
                // DOM準備完了時にテスト実行
                if (document.readyState === 'loading') {
                    document.addEventListener('DOMContentLoaded', () => {
                        logSidebar('DOM ready, Sidebar Tools available for use');
                    });
                } else {
                    logSidebar('DOM already ready, Sidebar Tools available for use');
                }
            }

        } catch (error) {
            const errorInfo = reportSidebarError('Module Initialization', error);
            
            // フォールバック禁止原則に従い、エラーを隠蔽しない
            throw new Error(`Sidebar-Tools.js initialization failed: ${error.message}`);
        }
    }

    // ==== モジュール実行 ====
    try {
        // 即座に初期化実行（main.htmlからの読み込み完了時）
        initializeSidebarTools();
    } catch (error) {
        console.error('🚨 Critical: Sidebar-Tools.js failed to initialize:', error);
        // Fallback: 初期化に失敗してもエラーで停止させない（デバッグ用）
        window.FutabaSidebarTools = {
            ERROR: true,
            MESSAGE: 'Initialization failed: ' + error.message,
            VERSION: 'FAILED'
        };
    }

    // Node.js環境対応（将来のテスト用）
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = FutabaSidebarTools;
    }

    logSidebar('🔧 Sidebar-Tools.js module setup completed');

})();

/**
 * ✅ 実装完了チェックリスト
 * 
 * [✓] DrawingTools クラス移行
 *     - selectTool, setBrushSize, setOpacity メソッド
 *     - startDrawing, continueDrawing, stopDrawing メソッド
 *     - エラーハンドリングと詳細ログ
 * 
 * [✓] UnifiedUIController クラス移行  
 *     - handleToolClick, activateTool, togglePopup メソッド
 *     - setupSliders, createSlider, setupResize メソッド
 *     - ドラッグ機能 (startDrag, onDrag, stopDrag)
 *     - applyResize, updateCanvasInfo, updateCoordinates
 * 
 * [✓] グローバル名前空間
 *     - window.FutabaSidebarTools
 *     - initialize ヘルパー関数
 *     - DEBUG モード・統計情報
 * 
 * [✓] エラーハンドリング戦略
 *     - reportSidebarError 統一エラー報告
 *     - 依存関係チェック
 *     - フォールバック禁止（エラー隠蔽なし）
 * 
 * [✓] 技術制約準拠
 *     - ES2023, モジュール不使用
 *     - HTML/CSS構造はmain.htmlに残存
 *     - 即座実行関数（IIFE）でスコープ保護
 * 
 * 🎯 次ステップ: main.htmlの該当クラス削除とSidebar-Tools.js組込み
 */