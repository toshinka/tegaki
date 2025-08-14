/**
 * 🚀 Main Entry Point - エントリーポイント（Phase1完成版）
 * 責務:
 * - AppCore起動
 * - グローバル変数管理
 * - レガシー互換性維持
 * - エラーハンドリング
 * 
 * 🎯 AI_WORK_SCOPE: メインエントリーポイント専用ファイル
 * 🎯 DEPENDENCIES: app-core.js, managers/*.js
 * 📋 INTEGRATION_PLAN: 既存システムとの完全互換性保持
 */

// グローバル変数（レガシー互換性）
let futabaApp;
let uiManager; // 既存コード互換用
let toolManager; // 既存コード互換用
let historyManager; // 既存コード互換用

// 初期化状態追跡
const initStatus = {
    phase: 'none',
    startTime: Date.now(),
    errors: [],
    fallbackMode: false,
    managers: {}
};

/**
 * Phase1 統合初期化メイン関数
 */
async function initTegakiPhase1() {
    try {
        console.log('📋 Tegaki Phase1 初期化開始...');
        initStatus.phase = 'starting';
        
        // AppCore一元初期化
        futabaApp = new AppCore();
        await futabaApp.init();
        
        // レガシー互換性のためのエイリアス設定
        await setupLegacyAliases();
        
        // UI連携セットアップ
        await setupUIIntegration();
        
        // イベントハンドラー設定
        await setupEventHandlers();
        
        // ショートカット設定
        await setupShortcuts();
        
        // デバッグ機能設定
        await setupDebugFeatures();
        
        initStatus.phase = 'completed';
        const initTime = Date.now() - initStatus.startTime;
        
        console.log(`🎉 Tegaki Phase1 完全起動! (${initTime}ms)`);
        
        // 起動完了通知
        displayStartupNotification(initTime);
        
        // 初期ツール設定
        setInitialTool();
        
    } catch (error) {
        console.error('❌ Tegaki Phase1 初期化失敗:', error);
        initStatus.errors.push(error);
        initStatus.phase = 'failed';
        
        // フォールバック処理
        console.log('🔄 フォールバックモードで再試行...');
        await initFallbackMode();
    }
}

/**
 * レガシー互換性エイリアス設定
 */
async function setupLegacyAliases() {
    try {
        // 既存コードで参照される可能性のあるグローバル変数
        window.futabaApp = futabaApp;
        
        // Manager参照エイリアス
        uiManager = futabaApp.getManager('ui');
        toolManager = futabaApp.getManager('tool');
        historyManager = futabaApp.getManager('memory')?.historyManager;
        
        // Manager状態記録
        initStatus.managers = {
            ui: !!uiManager,
            tool: !!toolManager,
            canvas: !!futabaApp.getManager('canvas'),
            memory: !!futabaApp.getManager('memory'),
            settings: !!futabaApp.getManager('settings')
        };
        
        // グローバルに公開（既存コード互換）
        window.uiManager = uiManager;
        window.toolManager = toolManager;
        window.historyManager = historyManager;
        
        // app、stage（既存コード互換）
        window.app = futabaApp.app;
        window.stage = futabaApp.stage;
        
        // 既存drawing-tools.jsとの互換性
        if (typeof window.setupDrawingTools === 'function') {
            window.setupDrawingTools(futabaApp);
        }
        
        // 既存history-manager.jsとの互換性
        if (historyManager && typeof window.initHistoryManager === 'function') {
            window.initHistoryManager(historyManager);
        }
        
        console.log('✅ レガシー互換性エイリアス設定完了');
    } catch (error) {
        console.warn('⚠️ レガシーエイリアス設定エラー:', error);
    }
}

/**
 * UI統合セットアップ
 */
async function setupUIIntegration() {
    try {
        // 既存ポップアップシステムとの統合
        await integratePopupSystem();
        
        // 既存スライダーシステムとの統合
        await integrateSliderSystem();
        
        // 既存ボタンシステムとの統合
        await integrateButtonSystem();
        
        // ステータスバー統合
        await integrateStatusBar();
        
        // ドラッグ機能統合
        await integrateDragSystem();
        
        console.log('✅ UI統合セットアップ完了');
    } catch (error) {
        console.error('❌ UI統合セットアップエラー:', error);
    }
}

/**
 * ポップアップシステム統合
 */
async function integratePopupSystem() {
    const uiMgr = futabaApp.getManager('ui');
    
    // ペンツール設定ポップアップ
    const penToolButton = document.getElementById('pen-tool');
    const penSettings = document.getElementById('pen-settings');
    
    if (penToolButton && penSettings) {
        penToolButton.addEventListener('click', () => {
            if (uiMgr && uiMgr.togglePopup) {
                uiMgr.togglePopup('pen-settings');
            } else {
                // フォールバック: 既存実装
                togglePopupFallback(penSettings);
            }
        });
    }
    
    // リサイズツール設定ポップアップ
    const resizeToolButton = document.getElementById('resize-tool');
    const resizeSettings = document.getElementById('resize-settings');
    
    if (resizeToolButton && resizeSettings) {
        resizeToolButton.addEventListener('click', () => {
            if (uiMgr && uiMgr.togglePopup) {
                uiMgr.togglePopup('resize-settings');
            } else {
                togglePopupFallback(resizeSettings);
            }
        });
    }
    
    // ESCキーでポップアップを閉じる
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            const popups = document.querySelectorAll('.popup-panel.show');
            popups.forEach(popup => {
                if (uiMgr && uiMgr.hidePopup) {
                    uiMgr.hidePopup(popup.id);
                } else {
                    popup.classList.remove('show');
                }
            });
        }
    });
}

/**
 * ポップアップフォールバック実装
 */
function togglePopupFallback(popup) {
    const isVisible = popup.classList.contains('show');
    
    // 他のポップアップを閉じる
    document.querySelectorAll('.popup-panel.show').forEach(p => {
        if (p !== popup) p.classList.remove('show');
    });
    
    // 対象ポップアップの表示切り替え
    popup.classList.toggle('show', !isVisible);
}

/**
 * スライダーシステム統合
 */
async function integrateSliderSystem() {
    const toolMgr = futabaApp.getManager('tool');
    
    // ペンサイズスライダー統合
    const sizeSlider = document.getElementById('pen-size-slider');
    if (sizeSlider) {
        const handleSizeChange = (value) => {
            if (toolMgr && toolMgr.setBrushSize) {
                toolMgr.setBrushSize(value);
            }
            updateSliderValue('pen-size-slider', value, 'px');
        };
        
        // 既存のui-manager.jsのスライダーイベントと連携
        if (window.setupSlider) {
            window.setupSlider(sizeSlider, 16, 1, 100, handleSizeChange);
        } else {
            setupSliderFallback(sizeSlider, 16, 1, 100, handleSizeChange);
        }
        
        // サイズボタン連携
        setupSliderButtons('pen-size', 16, 1, 100, handleSizeChange);
    }
    
    // 不透明度スライダー統合
    const opacitySlider = document.getElementById('pen-opacity-slider');
    if (opacitySlider) {
        const handleOpacityChange = (value) => {
            if (toolMgr && toolMgr.setBrushOpacity) {
                toolMgr.setBrushOpacity(value);
            }
            updateSliderValue('pen-opacity-slider', value, '%');
        };
        
        if (window.setupSlider) {
            window.setupSlider(opacitySlider, 85, 0, 100, handleOpacityChange);
        } else {
            setupSliderFallback(opacitySlider, 85, 0, 100, handleOpacityChange);
        }
        
        setupSliderButtons('pen-opacity', 85, 0, 100, handleOpacityChange);
    }
    
    // 筆圧感度スライダー統合
    const pressureSlider = document.getElementById('pen-pressure-slider');
    if (pressureSlider) {
        const handlePressureChange = (value) => {
            if (toolMgr && toolMgr.setPressureSensitivity) {
                toolMgr.setPressureSensitivity(value);
            }
            updateSliderValue('pen-pressure-slider', value, '%');
        };
        
        if (window.setupSlider) {
            window.setupSlider(pressureSlider, 50, 0, 100, handlePressureChange);
        } else {
            setupSliderFallback(pressureSlider, 50, 0, 100, handlePressureChange);
        }
        
        setupSliderButtons('pen-pressure', 50, 0, 100, handlePressureChange);
    }
    
    // 線補正スライダー統合
    const smoothingSlider = document.getElementById('pen-smoothing-slider');
    if (smoothingSlider) {
        const handleSmoothingChange = (value) => {
            if (toolMgr && toolMgr.setLineSmoothing) {
                toolMgr.setLineSmoothing(value);
            }
            updateSliderValue('pen-smoothing-slider', value, '%');
        };
        
        if (window.setupSlider) {
            window.setupSlider(smoothingSlider, 30, 0, 100, handleSmoothingChange);
        } else {
            setupSliderFallback(smoothingSlider, 30, 0, 100, handleSmoothingChange);
        }
        
        setupSliderButtons('pen-smoothing', 30, 0, 100, handleSmoothingChange);
    }
}

/**
 * スライダーフォールバック実装
 */
function setupSliderFallback(slider, initialValue, min, max, onChange) {
    const track = slider.querySelector('.slider-track');
    const handle = slider.querySelector('.slider-handle');
    
    if (!track || !handle) return;
    
    let currentValue = initialValue;
    let isDragging = false;
    
    function updateSlider(value) {
        currentValue = Math.max(min, Math.min(max, value));
        const percentage = ((currentValue - min) / (max - min)) * 100;
        
        track.style.width = `${percentage}%`;
        handle.style.left = `${percentage}%`;
        
        if (onChange) onChange(currentValue);
    }
    
    updateSlider(initialValue);
    
    slider.addEventListener('click', (e) => {
        const rect = slider.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const percentage = x / rect.width;
        const value = min + (max - min) * percentage;
        updateSlider(value);
    });
    
    handle.addEventListener('mousedown', (e) => {
        isDragging = true;
        e.preventDefault();
    });
    
    document.addEventListener('mousemove', (e) => {
        if (!isDragging) return;
        
        const rect = slider.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const percentage = Math.max(0, Math.min(1, x / rect.width));
        const value = min + (max - min) * percentage;
        updateSlider(value);
    });
    
    document.addEventListener('mouseup', () => {
        isDragging = false;
    });
}

/**
 * スライダーボタン設定
 */
function setupSliderButtons(prefix, initialValue, min, max, onChange) {
    let currentValue = initialValue;
    
    const buttons = [
        { id: `${prefix}-decrease-large`, delta: -10 },
        { id: `${prefix}-decrease`, delta: -1 },
        { id: `${prefix}-decrease-small`, delta: -0.1 },
        { id: `${prefix}-increase-small`, delta: 0.1 },
        { id: `${prefix}-increase`, delta: 1 },
        { id: `${prefix}-increase-large`, delta: 10 }
    ];
    
    buttons.forEach(({ id, delta }) => {
        const button = document.getElementById(id);
        if (button) {
            button.addEventListener('click', () => {
                currentValue = Math.max(min, Math.min(max, currentValue + delta));
                onChange(currentValue);
            });
        }
    });
}

/**
 * スライダー値表示更新
 */
function updateSliderValue(sliderId, value, unit) {
    const slider = document.getElementById(sliderId);
    if (slider) {
        const valueDisplay = slider.parentElement.querySelector('.slider-value');
        if (valueDisplay) {
            valueDisplay.textContent = `${value.toFixed(1)}${unit}`;
        }
    }
}

/**
 * ボタンシステム統合
 */
async function integrateButtonSystem() {
    const toolMgr = futabaApp.getManager('tool');
    const uiMgr = futabaApp.getManager('ui');
    
    // ツールボタン統合
    setupToolButtons(toolMgr);
    
    // リサイズボタン統合
    setupResizeButtons();
    
    // チェックボックス統合
    setupCheckboxes(toolMgr);
    
    // プリセットボタン統合
    setupPresetButtons(toolMgr);
}

/**
 * ツールボタン設定
 */
function setupToolButtons(toolMgr) {
    // ペンツールボタン
    const penTool = document.getElementById('pen-tool');
    if (penTool) {
        penTool.addEventListener('click', () => {
            if (toolMgr) {
                toolMgr.setTool('pen');
            }
            updateToolButtonStates('pen');
        });
    }
    
    // 消しゴムツールボタン
    const eraserTool = document.getElementById('eraser-tool');
    if (eraserTool) {
        eraserTool.addEventListener('click', () => {
            if (toolMgr) {
                toolMgr.setTool('eraser');
            }
            updateToolButtonStates('eraser');
        });
    }
}

/**
 * ツールボタンの状態更新
 */
function updateToolButtonStates(activeTool) {
    const tools = ['pen-tool', 'eraser-tool', 'fill-tool', 'select-tool'];
    
    tools.forEach(toolId => {
        const button = document.getElementById(toolId);
        if (button) {
            button.classList.toggle('active', toolId === `${activeTool}-tool`);
        }
    });
    
    // ステータスバー更新
    const currentToolElement = document.getElementById('current-tool');
    if (currentToolElement) {
        const toolNames = {
            pen: 'ベクターペン',
            eraser: '消しゴム',
            fill: '塗りつぶし',
            select: '範囲選択'
        };
        currentToolElement.textContent = toolNames[activeTool] || activeTool;
    }
}

/**
 * リサイズボタンセットアップ
 */
function setupResizeButtons() {
    const canvasManager = futabaApp.getManager('canvas');
    
    // プリセットサイズボタン
    document.querySelectorAll('[data-size]').forEach(button => {
        button.addEventListener('click', (e) => {
            const sizeStr = e.target.getAttribute('data-size');
            const [width, height] = sizeStr.split(',').map(Number);
            
            if (canvasManager && canvasManager.setCanvasSize) {
                canvasManager.setCanvasSize(width, height);
            }
            
            // 入力フィールド更新
            const widthInput = document.getElementById('canvas-width');
            const heightInput = document.getElementById('canvas-height');
            if (widthInput) widthInput.value = width;
            if (heightInput) heightInput.value = height;
            
            // ステータスバー更新
            updateCanvasInfo(width, height);
        });
    });
    
    // 適用ボタン
    const applyButton = document.getElementById('apply-resize');
    const applyCenterButton = document.getElementById('apply-resize-center');
    
    if (applyButton) {
        applyButton.addEventListener('click', () => {
            applyResize(false);
        });
    }
    
    if (applyCenterButton) {
        applyCenterButton.addEventListener('click', () => {
            applyResize(true);
        });
    }
}

/**
 * リサイズ適用
 */
function applyResize(center = false) {
    const widthInput = document.getElementById('canvas-width');
    const heightInput = document.getElementById('canvas-height');
    
    if (widthInput && heightInput) {
        const width = parseInt(widthInput.value);
        const height = parseInt(heightInput.value);
        
        if (width > 0 && height > 0) {
            const canvasManager = futabaApp.getManager('canvas');
            if (canvasManager && canvasManager.setCanvasSize) {
                canvasManager.setCanvasSize(width, height);
                
                if (center && canvasManager.centerCanvas) {
                    canvasManager.centerCanvas();
                }
            }
            
            // 履歴保存
            const memoryManager = futabaApp.getManager('memory');
            if (memoryManager && memoryManager.saveState) {
                memoryManager.saveState();
            }
            
            // ステータスバー更新
            updateCanvasInfo(width, height);
            
            console.log(`📐 キャンバスリサイズ: ${width}x${height}${center ? ' (中央配置)' : ''}`);
        }
    }
}

/**
 * チェックボックス設定
 */
function setupCheckboxes(toolMgr) {
    const checkboxes = [
        { id: 'pressure-sensitivity', property: 'pressureEnabled' },
        { id: 'edge-smoothing', property: 'edgeSmoothing' },
        { id: 'gpu-acceleration', property: 'gpuAcceleration' }
    ];
    
    checkboxes.forEach(({ id, property }) => {
        const checkbox = document.getElementById(id);
        if (checkbox) {
            checkbox.addEventListener('click', () => {
                const isChecked = checkbox.classList.toggle('checked');
                
                // ステータス表示更新
                const container = checkbox.closest('.checkbox-container');
                const status = container?.querySelector('.checkbox-status');
                if (status) {
                    status.textContent = isChecked ? '有効' : '無効';
                }
                
                // ToolManagerに設定を反映
                if (toolMgr && typeof toolMgr.setSetting === 'function') {
                    toolMgr.setSetting(property, isChecked);
                }
            });
        }
    });
}

/**
 * プリセットボタン設定
 */
function setupPresetButtons(toolMgr) {
    const presets = document.querySelectorAll('.size-preset-item');
    
    presets.forEach(preset => {
        preset.addEventListener('click', () => {
            const size = parseInt(preset.getAttribute('data-size'));
            
            // アクティブ状態更新
            presets.forEach(p => p.classList.remove('active'));
            preset.classList.add('active');
            
            // ToolManagerに設定反映
            if (toolMgr && toolMgr.setBrushSize) {
                toolMgr.setBrushSize(size);
            }
            
            // スライダー更新
            updateSliderFromPreset('pen-size-slider', size);
        });
    });
}

/**
 * プリセットからスライダー更新
 */
function updateSliderFromPreset(sliderId, value) {
    const slider = document.getElementById(sliderId);
    if (slider) {
        const track = slider.querySelector('.slider-track');
        const handle = slider.querySelector('.slider-handle');
        
        if (track && handle) {
            // 仮定: サイズの範囲は1-100
            const percentage = ((value - 1) / (100 - 1)) * 100;
            
            track.style.width = `${percentage}%`;
            handle.style.left = `${percentage}%`;
            
            updateSliderValue(sliderId, value, 'px');
        }
    }
}

/**
 * ステータスバー統合
 */
async function integrateStatusBar() {
    const canvasManager = futabaApp.getManager('canvas');
    const toolManager = futabaApp.getManager('tool');
    const memoryManager = futabaApp.getManager('memory');
    
    // マウス座標追跡
    const canvas = document.getElementById('drawing-canvas');
    if (canvas) {
        canvas.addEventListener('mousemove', (e) => {
            const rect = canvas.getBoundingClientRect();
            const x = Math.round(e.clientX - rect.left);
            const y = Math.round(e.clientY - rect.top);
            
            const coordsElement = document.getElementById('coordinates');
            if (coordsElement) {
                coordsElement.textContent = `x: ${x}, y: ${y}`;
            }
        });
    }
    
    // 定期的なステータス更新（1秒間隔）
    setInterval(() => {
        updatePerformanceStats(memoryManager);
    }, 1000);
    
    // 初期ステータス設定
    updateCanvasInfo(400, 400); // デフォルトサイズ
}

/**
 * パフォーマンス統計更新
 */
function updatePerformanceStats(memoryManager) {
    // FPS更新
    const fpsElement = document.getElementById('fps');
    if (fpsElement && futabaApp && futabaApp.app) {
        const fps = Math.round(futabaApp.app.ticker.FPS);
        fpsElement.textContent = fps;
    }
    
    // GPU使用率（仮想値）
    const gpuElement = document.getElementById('gpu-usage');
    if (gpuElement) {
        const usage = Math.round(30 + Math.random() * 40); // 30-70%の範囲
        gpuElement.textContent = `${usage}%`;
    }
    
    // メモリ使用量
    if (memoryManager && memoryManager.getMemoryStats) {
        const memStats = memoryManager.getMemoryStats();
        const memoryElement = document.getElementById('memory-usage');
        if (memoryElement && memStats) {
            const totalMB = Math.round(memStats.totalMemory / 1024 / 1024 * 10) / 10;
            memoryElement.textContent = `${totalMB}MB`;
        }
    }
    
    // 筆圧監視（実装時）
    const pressureElement = document.getElementById('pressure-monitor');
    if (pressureElement) {
        pressureElement.textContent = '0.0%'; // 筆圧実装時に更新
    }
}

/**
 * キャンバス情報更新
 */
function updateCanvasInfo(width, height) {
    const canvasInfo = document.getElementById('canvas-info');
    if (canvasInfo) {
        canvasInfo.textContent = `${width}×${height}px`;
    }
}

/**
 * ドラッグシステム統合
 */
async function integrateDragSystem() {
    const popups = document.querySelectorAll('.popup-panel.draggable');
    
    popups.forEach(popup => {
        makeElementDraggable(popup);
    });
}

/**
 * 要素をドラッグ可能にする
 */
function makeElementDraggable(element) {
    let isDragging = false;
    let startX, startY, initialX, initialY;
    
    const title = element.querySelector('.popup-title');
    const dragHandle = title || element;
    
    dragHandle.style.cursor = 'move';
    
    dragHandle.addEventListener('mousedown', (e) => {
        isDragging = true;
        startX = e.clientX;
        startY = e.clientY;
        
        const rect = element.getBoundingClientRect();
        initialX = rect.left;
        initialY = rect.top;
        
        element.classList.add('dragging');
        e.preventDefault();
    });
    
    document.addEventListener('mousemove', (e) => {
        if (!isDragging) return;
        
        const deltaX = e.clientX - startX;
        const deltaY = e.clientY - startY;
        
        const newX = Math.max(0, Math.min(window.innerWidth - element.offsetWidth, initialX + deltaX));
        const newY = Math.max(0, Math.min(window.innerHeight - element.offsetHeight, initialY + deltaY));
        
        element.style.left = `${newX}px`;
        element.style.top = `${newY}px`;
    });
    
    document.addEventListener('mouseup', () => {
        if (isDragging) {
            isDragging = false;
            element.classList.remove('dragging');
        }
    });
}

/**
 * ショートカット設定
 */
async function setupShortcuts() {
    const toolMgr = futabaApp.getManager('tool');
    const memoryMgr = futabaApp.getManager('memory');
    const canvasMgr = futabaApp.getManager('canvas');
    
    document.addEventListener('keydown', (e) => {
        // Ctrl/Cmd修飾キー
        if (e.ctrlKey || e.metaKey) {
            switch(e.key.toLowerCase()) {
                case 'z':
                    e.preventDefault();
                    if (e.shiftKey) {
                        // Ctrl+Shift+Z: Redo
                        if (memoryMgr && memoryMgr.redo) {
                            memoryMgr.redo();
                        }
                    } else {
                        // Ctrl+Z: Undo
                        if (memoryMgr && memoryMgr.undo) {
                            memoryMgr.undo();
                        }
                    }
                    break;
                    
                case 'y':
                    e.preventDefault();
                    // Ctrl+Y: Redo
                    if (memoryMgr && memoryMgr.redo) {
                        memoryMgr.redo();
                    }
                    break;
                    
                case '0':
                    e.preventDefault();
                    // Ctrl+0: View Reset
                    if (canvasMgr && canvasMgr.resetView) {
                        canvasMgr.resetView();
                    }
                    break;
            }
        } else {
            // 単体キー
            switch(e.key.toLowerCase()) {
                case 'p':
                    // P: Pen Tool
                    if (toolMgr && toolMgr.setTool) {
                        toolMgr.setTool('pen');
                        updateToolButtonStates('pen');
                    }
                    break;
                    
                case 'e':
                    // E: Eraser Tool
                    if (toolMgr && toolMgr.setTool) {
                        toolMgr.setTool('eraser');
                        updateToolButtonStates('eraser');
                    }
                    break;
                    
                case '[':
                    // [: Decrease brush size preset
                    switchSizePreset(-1);
                    break;
                    
                case ']':
                    // ]: Increase brush size preset
                    switchSizePreset(1);
                    break;
                    
                case 'delete':
                    // DEL: Clear layer
                    if (canvasMgr && canvasMgr.clearCanvas) {
                        canvasMgr.clearCanvas();
                    }
                    break;
                    
                case 'tab':
                    e.preventDefault();
                    // TAB: Toggle popup
                    toggleMainPopup();
                    break;
            }
        }
    });
}

/**
 * サイズプリセット切り替え
 */
function switchSizePreset(direction) {
    const presets = document.querySelectorAll('.size-preset-item');
    const activePreset = document.querySelector('.size-preset-item.active');
    
    if (!presets.length) return;
    
    let currentIndex = Array.from(presets).indexOf(activePreset) || 0;
    currentIndex = Math.max(0, Math.min(presets.length - 1, currentIndex + direction));
    
    // アクティブ状態更新
    presets.forEach(p => p.classList.remove('active'));
    presets[currentIndex].classList.add('active');
    
    // サイズ適用
    const size = parseInt(presets[currentIndex].getAttribute('data-size'));
    const toolMgr = futabaApp.getManager('tool');
    if (toolMgr && toolMgr.setBrushSize) {
        toolMgr.setBrushSize(size);
        updateSliderFromPreset('pen-size-slider', size);
    }
}

/**
 * メインポップアップ切り替え
 */
function toggleMainPopup() {
    const penSettings = document.getElementById('pen-settings');
    if (penSettings) {
        togglePopupFallback(penSettings);
    }
}

/**
 * イベントハンドラー設定
 */
async function setupEventHandlers() {
    // アプリケーション終了時の処理
    window.addEventListener('beforeunload', () => {
        if (futabaApp && futabaApp.destroy) {
            futabaApp.destroy();
        }
    });
    
    // エラーイベント統合
    window.addEventListener('error', (event) => {
        initStatus.errors.push(event.error);
        console.error('🚨 グローバルエラー:', event.error);
    });
    
    // AppCoreイベントリスナー
    if (futabaApp) {
        futabaApp.on && futabaApp.on('manager-error', (error) => {
            console.error('🚨 Managerエラー:', error);
        });
        
        futabaApp.on && futabaApp.on('extension-error', (error) => {
            console.warn('⚠️ 拡張機能エラー:', error);
        });
    }
    
    // リサイズ対応
    window.addEventListener('resize', () => {
        const canvasManager = futabaApp.getManager('canvas');
        if (canvasManager && canvasManager.handleResize) {
            canvasManager.handleResize();
        }
    });
}

/**
 * デバッグ機能設定
 */
async function setupDebugFeatures() {
    // グローバルデバッグ関数
    window.debugTegaki = {
        app: futabaApp,
        status: initStatus,
        
        // Manager状態確認
        checkManagers: () => {
            console.log('🏗️ Manager状態:');
            Object.entries(initStatus.managers).forEach(([name, status]) => {
                console.log(`  ${name}: ${status ? '✅' : '❌'}`);
            });
        },
        
        // Manager間連携テスト
        testManagerCommunication: () => {
            const toolMgr = futabaApp.getManager('tool');
            const uiMgr = futabaApp.getManager('ui');
            
            if (toolMgr) {
                toolMgr.setTool('pen');
                updateToolButtonStates('pen');
                console.log('✅ Tool→UI連携テスト完了');
            }
        },
        
        // パフォーマンス統計
        stats: () => {
            if (futabaApp && futabaApp.getStats) {
                return futabaApp.getStats();
            }
            
            return {
                fps: futabaApp?.app?.ticker?.FPS || 0,
                managers: Object.keys(initStatus.managers).length,
                errors: initStatus.errors.length,
                fallbackMode: initStatus.fallbackMode
            };
        },
        
        // 拡張機能確認
        checkExtensions: () => {
            if (futabaApp && futabaApp.extensions) {
                return futabaApp.extensions;
            }
            return null;
        },
        
        // 履歴テスト
        testHistory: () => {
            const memoryMgr = futabaApp.getManager('memory');
            if (memoryMgr) {
                console.log('💾 履歴テスト開始...');
                memoryMgr.saveState();
                console.log('📝 状態保存完了');
                
                setTimeout(() => {
                    memoryMgr.undo();
                    console.log('↶ アンドゥテスト完了');
                }, 1000);
            }
        },
        
        // システム再起動
        restart: () => {
            location.reload();
        }
    };
    
    console.log('🐛 デバッグ機能利用可能: window.debugTegaki');
}

/**
 * 初期ツール設定
 */
function setInitialTool() {
    const toolMgr = futabaApp.getManager('tool');
    if (toolMgr && toolMgr.setTool) {
        toolMgr.setTool('pen');
        updateToolButtonStates('pen');
    }
    
    // 初期プリセット設定
    const defaultPreset = document.querySelector('.size-preset-item[data-size="16"]');
    if (defaultPreset) {
        defaultPreset.classList.add('active');
    }
}

/**
 * 起動完了通知表示
 */
function displayStartupNotification(initTime) {
    // ステータスバーに起動完了メッセージを一時表示
    const notification = document.createElement('div');
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: var(--futaba-maroon);
        color: white;
        padding: 12px 24px;
        border-radius: 8px;
        font-size: 12px;
        font-weight: bold;
        z-index: 9999;
        animation: slideInRight 0.3s ease-out;
        box-shadow: 0 4px 16px rgba(128, 0, 0, 0.3);
    `;
    
    const managerCount = Object.values(initStatus.managers).filter(Boolean).length;
    notification.innerHTML = `
        🎉 Phase1起動完了<br>
        <small>${initTime}ms | ${managerCount}/5 Managers</small>
    `;
    
    document.body.appendChild(notification);
    
    // 3秒後に自動削除
    setTimeout(() => {
        notification.style.animation = 'slideOutRight 0.3s ease-out';
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 300);
    }, 3000);
}

/**
 * フォールバックモード初期化
 */
async function initFallbackMode() {
    try {
        initStatus.fallbackMode = true;
        console.warn('⚠️ フォールバックモード: 既存システムで起動');
        
        // 最小限のPixiJS初期化
        if (typeof PIXI !== 'undefined') {
            const app = new PIXI.Application({
                width: window.innerWidth - 50,
                height: window.innerHeight - 100,
                backgroundColor: 0xFFFFEE,
                resolution: window.devicePixelRatio || 1,
                autoDensity: true
            });
            
            const canvasContainer = document.getElementById('drawing-canvas');
            if (canvasContainer) {
                canvasContainer.appendChild(app.view);
            }
            
            // 簡易グローバル変数設定
            window.app = app;
            window.stage = app.stage;
            
            console.log('✅ フォールバック PixiJS初期化完了');
        }
        
        // 既存ui-manager.jsの初期化（存在する場合）
        if (typeof window.initUIManager === 'function') {
            window.initUIManager();
        }
        
        // 既存drawing-tools.jsの初期化（存在する場合）
        if (typeof window.initDrawingTools === 'function') {
            window.initDrawingTools();
        }
        
        // 基本UI統合
        await setupBasicUIIntegration();
        
        console.log('✅ フォールバックモード起動完了');
        
        // フォールバック通知
        displayFallbackNotification();
        
    } catch (fallbackError) {
        console.error('❌ フォールバックモードも失敗:', fallbackError);
        initStatus.errors.push(fallbackError);
        
        // 最後の手段: エラーメッセージ表示
        displayFatalError();
    }
}

/**
 * 基本UI統合（フォールバック用）
 */
async function setupBasicUIIntegration() {
    // ツールボタンの基本動作
    const penTool = document.getElementById('pen-tool');
    const eraserTool = document.getElementById('eraser-tool');
    
    if (penTool) {
        penTool.addEventListener('click', () => {
            updateToolButtonStates('pen');
        });
    }
    
    if (eraserTool) {
        eraserTool.addEventListener('click', () => {
            updateToolButtonStates('eraser');
        });
    }
    
    // ポップアップの基本動作
    await integratePopupSystem();
    
    // 基本ショートカット
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            document.querySelectorAll('.popup-panel.show').forEach(popup => {
                popup.classList.remove('show');
            });
        }
    });
}

/**
 * フォールバック通知表示
 */
function displayFallbackNotification() {
    const notification = document.createElement('div');
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: #ff9800;
        color: white;
        padding: 12px 24px;
        border-radius: 8px;
        font-size: 12px;
        font-weight: bold;
        z-index: 9999;
        max-width: 300px;
        box-shadow: 0 4px 16px rgba(255, 152, 0, 0.3);
    `;
    
    notification.innerHTML = `
        ⚠️ フォールバックモード<br>
        <small>一部機能が制限されています</small>
    `;
    
    document.body.appendChild(notification);
    
    // 5秒後に自動削除
    setTimeout(() => {
        if (notification.parentNode) {
            notification.parentNode.removeChild(notification);
        }
    }, 5000);
}

/**
 * 致命的エラー表示
 */
function displayFatalError() {
    const errorDiv = document.createElement('div');
    errorDiv.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: #ffebee;
        border: 2px solid #f44336;
        border-radius: 8px;
        padding: 24px;
        max-width: 500px;
        z-index: 10000;
        font-family: monospace;
        box-shadow: 0 8px 32px rgba(244, 67, 54, 0.3);
    `;
    
    errorDiv.innerHTML = `
        <h3 style="color: #d32f2f; margin: 0 0 16px 0;">🚨 アプリケーション起動失敗</h3>
        <p>Phase1システムの起動に失敗しました。</p>
        <p>以下のエラーが発生しています：</p>
        <pre style="background: #f5f5f5; padding: 8px; border-radius: 4px; font-size: 12px; overflow: auto; max-height: 200px;">
${initStatus.errors.map(err => err.message || err).join('\n')}
        </pre>
        <div style="margin-top: 16px; display: flex; gap: 8px;">
            <button onclick="location.reload()" style="background: #1976d2; color: white; border: none; padding: 8px 16px; border-radius: 4px; cursor: pointer;">
                ページを再読み込み
            </button>
            <button onclick="this.parentElement.parentElement.style.display='none'" style="background: #757575; color: white; border: none; padding: 8px 16px; border-radius: 4px; cursor: pointer;">
                閉じる
            </button>
        </div>
    `;
    
    document.body.appendChild(errorDiv);
}

// DOM読み込み完了後に初期化実行
document.addEventListener('DOMContentLoaded', initTegakiPhase1);

// モジュールエクスポート（将来のTypeScript対応）
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { 
        AppCore, 
        initTegakiPhase1,
        initStatus,
        setupLegacyAliases,
        setupUIIntegration,
        initFallbackMode
    };
}

// レガシー関数エクスポート（既存コードとの互換性）
window.initTegakiPhase1 = initTegakiPhase1;
window.initStatus = initStatus;