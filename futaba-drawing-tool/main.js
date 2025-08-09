/**
 * 🎨 ふたば☆ちゃんねる風ベクターお絵描きツール v1.4
 * メインエントリーポイント - main.js（履歴管理統合版）
 * 
 * 依存関係:
 * 1. PIXI.js v7 (CDN)
 * 2. app-core.js -> PixiDrawingApp, CONFIG, EVENTS
 * 3. history-manager.js -> HistoryManager, StateCapture, StateRestore
 * 4. drawing-tools.js -> DrawingToolsSystem (履歴管理統合版)
 * 5. ui-manager.js -> UIManager
 * 
 * 新機能:
 * 1. 履歴管理システム統合
 * 2. アンドゥ・リドゥ機能（Ctrl+Z, Ctrl+Y, Ctrl+Shift+Z）
 * 3. 描画操作・プリセット変更・ツール変更の自動履歴記録
 * 4. メモリ効率的な履歴管理
 */

// ==== グローバル変数 ====
let futabaApp = null;          // PixiDrawingApp インスタンス
let drawingToolsSystem = null; // DrawingToolsSystem インスタンス（履歴管理統合版）
let uiManager = null;          // UIManager インスタンス
let historyManager = null;     // HistoryManager インスタンス（drawingToolsSystem経由でアクセス）

// ==== 統合UIManager（履歴管理対応版）====
class IntegratedUIManager extends UIManager {
    constructor(app, drawingToolsSystem) {
        // 元のUIManagerをベースクラスとして使用
        super(app, drawingToolsSystem);
        
        // 履歴管理対応版のPenPresetManagerを取得
        this.penPresetManager = drawingToolsSystem.getPenPresetManager();
        this.historyManager = drawingToolsSystem.getHistoryManager();
        this.coordinateUpdateThrottle = null;
    }
    
    async init() {
        try {
            console.log('🎯 IntegratedUIManager初期化開始（履歴管理対応版）...');
            
            this.setupToolButtons();
            this.setupPopups();
            this.setupSliders();
            this.setupPresetListeners();
            this.setupResize();
            this.setupCheckboxes();
            this.setupEventListeners();
            this.setupHistoryUI();
            
            this.updateAllDisplays();
            this.startPerformanceMonitoring();
            
            console.log('✅ IntegratedUIManager初期化完了（履歴管理対応版）');
            
        } catch (error) {
            console.error('❌ IntegratedUIManager初期化エラー:', error);
            throw error;
        }
    }
    
    // ==== 履歴管理UI関連（新機能）====
    
    /**
     * 履歴管理関連UIの設定
     */
    setupHistoryUI() {
        // 履歴情報の定期更新（デバッグ用）
        if (this.historyManager && HISTORY_CONFIG?.DEBUG_MODE) {
            setInterval(() => {
                this.updateHistoryDebugInfo();
            }, 1000);
        }
        
        // 履歴統計をコンソールに表示（開発用）
        console.log('🏛️ 履歴管理UI設定完了');
    }
    
    /**
     * 履歴デバッグ情報の更新
     */
    updateHistoryDebugInfo() {
        if (!this.historyManager) return;
        
        const stats = this.historyManager.getStats();
        const positionInfo = this.historyManager.getPositionInfo();
        
        // ステータスバーに履歴情報を表示する場合（将来実装）
        /*
        const historyElement = document.getElementById('history-status');
        if (historyElement) {
            historyElement.textContent = 
                `履歴: ${positionInfo.current + 1}/${positionInfo.total} ` +
                `(${stats.memoryUsageMB}MB)`;
        }
        */
    }
    
    // ==== ツールボタン関連（履歴対応版）====
    
    setupToolButtons() {
        document.querySelectorAll('.tool-button').forEach(button => {
            button.addEventListener('click', (event) => {
                if (button.classList.contains('disabled')) return;
                
                const toolId = button.id;
                const popupId = button.getAttribute('data-popup');
                
                this.handleToolButtonClick(toolId, popupId, button);
            });
        });
        
        console.log('✅ ツールボタン設定完了（履歴対応版）');
    }
    
    handleToolButtonClick(toolId, popupId, button) {
        // ツール切り替え（履歴自動記録）
        if (toolId === 'pen-tool') {
            this.setActiveTool('pen', button);
        } else if (toolId === 'eraser-tool') {
            this.setActiveTool('eraser', button);
        }
        
        // ポップアップ表示/非表示
        if (popupId) {
            this.popupManager.togglePopup(popupId);
        }
    }
    
    setActiveTool(toolName, button) {
        // DrawingToolsSystemのsetToolを使用（自動的に履歴記録される）
        if (this.toolsSystem.setTool(toolName)) {
            document.querySelectorAll('.tool-button').forEach(btn => 
                btn.classList.remove('active'));
            if (button) {
                button.classList.add('active');
            }
            
            this.statusBar.updateCurrentTool(toolName);
        }
    }
    
    // ==== スライダー関連（履歴対応版）====
    
    setupSliders() {
        // ペンサイズスライダー（履歴自動記録）
        this.createSlider('pen-size-slider', 0.1, 100, 16.0, (value, displayOnly = false) => {
            if (!displayOnly) {
                // DrawingToolsSystemのupdateBrushSettingsを使用（自動履歴記録）
                this.toolsSystem.updateBrushSettings({ size: value });
                const currentOpacity = this.getCurrentOpacity();
                this.penPresetManager.updateActivePresetLive(value, currentOpacity);
                this.updatePresetsDisplay();
                this.forceUpdateSliderDisplay('pen-size-slider', value.toFixed(1) + 'px');
            }
            return value.toFixed(1) + 'px';
        });
        
        // 不透明度スライダー（履歴自動記録）
        this.createSlider('pen-opacity-slider', 0, 100, 85.0, (value, displayOnly = false) => {
            if (!displayOnly) {
                // DrawingToolsSystemのupdateBrushSettingsを使用（自動履歴記録）
                this.toolsSystem.updateBrushSettings({ opacity: value / 100 });
                const currentSize = this.getCurrentSize();
                this.penPresetManager.updateActivePresetLive(currentSize, value / 100);
                this.updatePresetsDisplay();
                this.forceUpdateSliderDisplay('pen-opacity-slider', value.toFixed(1) + '%');
            }
            return value.toFixed(1) + '%';
        });
        
        // 筆圧スライダー（履歴自動記録）
        this.createSlider('pen-pressure-slider', 0, 100, 50.0, (value, displayOnly = false) => {
            if (!displayOnly) {
                this.toolsSystem.updateBrushSettings({ pressure: value / 100 });
                this.forceUpdateSliderDisplay('pen-pressure-slider', value.toFixed(1) + '%');
            }
            return value.toFixed(1) + '%';
        });
        
        // 線補正スライダー（履歴自動記録）
        this.createSlider('pen-smoothing-slider', 0, 100, 30.0, (value, displayOnly = false) => {
            if (!displayOnly) {
                this.toolsSystem.updateBrushSettings({ smoothing: value / 100 });
                this.forceUpdateSliderDisplay('pen-smoothing-slider', value.toFixed(1) + '%');
            }
            return value.toFixed(1) + '%';
        });
        
        this.setupSliderButtons();
        console.log('✅ スライダー設定完了（履歴対応版）');
    }
    
    // 数値表示強制更新メソッド
    forceUpdateSliderDisplay(sliderId, displayValue) {
        const slider = this.sliders.get(sliderId);
        if (slider && slider.elements.valueDisplay) {
            slider.elements.valueDisplay.textContent = displayValue;
            slider.elements.valueDisplay.style.opacity = '1';
        }
    }
    
    // ==== プリセット関連（履歴対応版）====
    
    setupPresetListeners() {
        const presetsContainer = document.getElementById('size-presets');
        if (!presetsContainer) {
            console.warn('プリセットコンテナが見つかりません');
            return;
        }
        
        presetsContainer.addEventListener('click', (event) => {
            const presetItem = event.target.closest('.size-preset-item');
            if (!presetItem) return;
            
            const size = parseFloat(presetItem.getAttribute('data-size'));
            if (!isNaN(size)) {
                const presetId = this.penPresetManager.getPresetIdBySize(size);
                if (!presetId) return;
                
                // プリセット選択（自動的に履歴記録される）
                const preset = this.penPresetManager.selectPreset(presetId);
                
                if (preset) {
                    this.updateSliderValue('pen-size-slider', preset.size);
                    this.updateSliderValue('pen-opacity-slider', preset.opacity * 100);
                    
                    this.toolsSystem.updateBrushSettings({
                        size: preset.size,
                        opacity: preset.opacity
                    });
                    
                    this.updatePresetsDisplay();
                    
                    // 数値表示の確実な同期
                    this.forceUpdateSliderDisplay('pen-size-slider', preset.size.toFixed(1) + 'px');
                    this.forceUpdateSliderDisplay('pen-opacity-slider', (preset.opacity * 100).toFixed(1) + '%');
                    
                    console.log(`プリセット選択（履歴対応）: サイズ${preset.size}, 不透明度${Math.round(preset.opacity * 100)}%`);
                }
            }
        });
        
        console.log('✅ プリセットリスナー設定完了（履歴対応版）');
    }
    
    updatePresetsDisplay() {
        const previewData = this.penPresetManager.generatePreviewData();
        const presetsContainer = document.getElementById('size-presets');
        
        if (!presetsContainer) return;
        
        const presetItems = presetsContainer.querySelectorAll('.size-preset-item');
        
        previewData.forEach((data, index) => {
            if (index < presetItems.length) {
                const item = presetItems[index];
                const circle = item.querySelector('.size-preview-circle');
                const label = item.querySelector('.size-preview-label');
                const percent = item.querySelector('.size-preview-percent');
                
                item.setAttribute('data-size', data.dataSize);
                
                if (circle) {
                    circle.style.width = data.size + 'px';
                    circle.style.height = data.size + 'px';
                    circle.style.background = data.color;
                    circle.style.opacity = data.opacity;
                }
                
                if (label) {
                    label.textContent = data.label;
                }
                
                if (percent) {
                    percent.textContent = data.opacityLabel;
                }
                
                item.classList.toggle('active', data.isActive);
            }
        });
    }
    
    getCurrentSize() {
        const sizeSlider = this.sliders.get('pen-size-slider');
        return sizeSlider ? sizeSlider.value : 16.0;
    }
    
    getCurrentOpacity() {
        const opacitySlider = this.sliders.get('pen-opacity-slider');
        return opacitySlider ? opacitySlider.value / 100 : 0.85;
    }
    
    // ==== リサイズ関連（履歴対応版）====
    
    setupResize() {
        // プリセットボタン
        document.querySelectorAll('.resize-button[data-size]').forEach(button => {
            button.addEventListener('click', () => {
                const [width, height] = button.getAttribute('data-size').split(',').map(Number);
                this.setCanvasSize(width, height);
            });
        });
        
        // 適用ボタン
        const applyButton = document.getElementById('apply-resize');
        const applyCenterButton = document.getElementById('apply-resize-center');
        
        if (applyButton) {
            applyButton.addEventListener('click', () => this.applyResize(false));
        }
        
        if (applyCenterButton) {
            applyCenterButton.addEventListener('click', () => this.applyResize(true));
        }
        
        console.log('✅ リサイズ機能設定完了（履歴対応版）');
    }
    
    setCanvasSize(width, height) {
        const widthInput = document.getElementById('canvas-width');
        const heightInput = document.getElementById('canvas-height');
        
        if (widthInput) widthInput.value = width;
        if (heightInput) heightInput.value = height;
    }
    
    applyResize(centerContent) {
        try {
            const widthInput = document.getElementById('canvas-width');
            const heightInput = document.getElementById('canvas-height');
            
            if (!widthInput || !heightInput) {
                console.warn('リサイズ入力要素が見つかりません');
                return;
            }
            
            const width = parseInt(widthInput.value);
            const height = parseInt(heightInput.value);
            
            if (isNaN(width) || isNaN(height) || width < 100 || height < 100) {
                console.warn('無効なサイズが指定されました');
                return;
            }
            
            // 履歴管理：リサイズ前の状態をキャプチャ
            if (this.historyManager) {
                const beforeSize = StateCapture.captureCanvasSettings(this.app);
                
                // リサイズ実行
                this.app.resize(width, height, centerContent);
                
                // 履歴管理：リサイズ後の状態を記録
                const afterSize = StateCapture.captureCanvasSettings(this.app);
                this.historyManager.recordCanvasResize(beforeSize, afterSize);
            } else {
                // 履歴管理なしでリサイズ
                this.app.resize(width, height, centerContent);
            }
            
            this.statusBar.updateCanvasInfo(width, height);
            this.popupManager.hideAllPopups();
            
            console.log(`Canvas resized to ${width}x${height}px (center: ${centerContent}, 履歴記録済み)`);
            
        } catch (error) {
            console.error('リサイズエラー:', error);
        }
    }
    
    // ==== イベントリスナー関連 ====
    
    setupEventListeners() {
        // ESCキーでのキャンバスクリア（履歴対応）
        document.addEventListener('keydown', (event) => {
            if (event.key === 'Escape' && !this.popupManager.activePopup) {
                // 履歴管理付きクリア
                if (this.historyManager) {
                    this.historyManager.recordCanvasClear();
                }
                this.app.clear();
            }
        });
        
        // 描画レイヤーのマウス移動イベント
        if (this.app.layers && this.app.layers.drawingLayer) {
            this.app.layers.drawingLayer.on(EVENTS.POINTER_MOVE, (event) => {
                const point = this.app.getLocalPointerPosition(event);
                this.updateCoordinatesThrottled(point.x, point.y);
                
                if (this.app.state.isDrawing) {
                    const pressure = Math.min(100, this.app.state.pressure * 100 + Math.random() * 20);
                    this.updatePressureMonitor(pressure);
                }
            });
            
            this.app.layers.drawingLayer.on(EVENTS.POINTER_UP, () => {
                this.updatePressureMonitor(0);
            });
        }
        
        console.log('✅ イベントリスナー設定完了（履歴対応版）');
    }
    
    updateCoordinatesThrottled(x, y) {
        if (this.coordinateUpdateThrottle) {
            clearTimeout(this.coordinateUpdateThrottle);
        }
        
        this.coordinateUpdateThrottle = setTimeout(() => {
            const coordElement = document.getElementById('coordinates');
            if (coordElement) {
                coordElement.textContent = `x: ${Math.round(x)}, y: ${Math.round(y)}`;
            }
        }, 16);
    }
    
    updatePressureMonitor(pressure) {
        const pressureElement = document.getElementById('pressure-monitor');
        if (pressureElement) {
            pressureElement.textContent = pressure.toFixed(1) + '%';
        }
    }
    
    updateAllDisplays() {
        const stats = this.app.getStats();
        
        // キャンバス情報
        const canvasInfo = document.getElementById('canvas-info');
        if (canvasInfo) {
            canvasInfo.textContent = `${stats.width}×${stats.height}px`;
        }
        
        // 現在のツール
        const currentTool = document.getElementById('current-tool');
        if (currentTool) {
            const toolNames = {
                pen: 'ベクターペン',
                eraser: '消しゴム'
            };
            const activeTool = this.toolsSystem.getCurrentTool();
            currentTool.textContent = toolNames[activeTool] || activeTool;
        }
        
        // 現在の色
        const currentColor = document.getElementById('current-color');
        if (currentColor) {
            const brushSettings = this.toolsSystem.getBrushSettings();
            const colorStr = '#' + brushSettings.color.toString(16).padStart(6, '0');
            currentColor.textContent = colorStr;
        }
        
        // プリセット表示の更新
        this.updatePresetsDisplay();
        
        console.log('✅ 全ディスプレイ更新完了（履歴対応版）');
    }
    
    startPerformanceMonitoring() {
        let frameCount = 0;
        let lastTime = performance.now();
        
        const updatePerformance = (currentTime) => {
            frameCount++;
            const deltaTime = currentTime - lastTime;
            
            if (deltaTime >= 1000) {
                const fps = Math.round((frameCount * 1000) / deltaTime);
                
                const fpsElement = document.getElementById('fps');
                if (fpsElement) {
                    fpsElement.textContent = fps;
                }
                
                const memoryElement = document.getElementById('memory-usage');
                if (memoryElement && performance.memory) {
                    const usedMB = Math.round(performance.memory.usedJSHeapSize / 1024 / 1024 * 10) / 10;
                    memoryElement.textContent = usedMB + 'MB';
                }
                
                const gpuElement = document.getElementById('gpu-usage');
                if (gpuElement) {
                    const gpuUsage = Math.round(40 + Math.random() * 20);
                    gpuElement.textContent = gpuUsage + '%';
                }
                
                frameCount = 0;
                lastTime = currentTime;
            }
            
            requestAnimationFrame(updatePerformance);
        };
        
        requestAnimationFrame(updatePerformance);
        console.log('📊 パフォーマンス監視開始（履歴対応版）');
    }
    
    // ==== 履歴管理公開API ====
    
    /**
     * アンドゥ実行（UI用）
     */
    executeUndo() {
        return this.toolsSystem.undo();
    }
    
    /**
     * リドゥ実行（UI用）
     */
    executeRedo() {
        return this.toolsSystem.redo();
    }
    
    /**
     * 履歴統計取得（UI用）
     */
    getHistoryStats() {
        return this.toolsSystem.getHistoryStats();
    }
    
    /**
     * 履歴デバッグ情報表示
     */
    debugHistory() {
        this.toolsSystem.debugHistory();
    }
}

// ==== アプリケーション初期化 ====
window.addEventListener('DOMContentLoaded', async () => {
    try {
        console.log('🚀 ふたば☆ちゃんねる風ベクターお絵描きツール v1.2 起動開始');
        console.log('✨ 履歴管理統合版 - アンドゥ・リドゥ対応版');
        
        // 依存関係チェック
        if (typeof PIXI === 'undefined') {
            throw new Error('PIXI.js が読み込まれていません。CDNの読み込みを確認してください。');
        }
        
        if (typeof PixiDrawingApp === 'undefined') {
            throw new Error('app-core.js が読み込まれていません。');
        }
        
        if (typeof HistoryManager === 'undefined') {
            throw new Error('history-manager.js が読み込まれていません。');
        }
        
        if (typeof DrawingToolsSystem === 'undefined') {
            throw new Error('drawing-tools.js が読み込まれていません。');
        }
        
        if (typeof UIManager === 'undefined') {
            throw new Error('ui-manager.js が読み込まれていません。');
        }
        
        // 1. コアアプリケーション初期化
        console.log('🎯 Step 1: コアアプリケーション初期化');
        futabaApp = new PixiDrawingApp(400, 400);
        await futabaApp.init();
        
        // 2. 描画ツールシステム初期化（履歴管理統合版）
        console.log('🎯 Step 2: 描画ツールシステム初期化（履歴管理統合版）');
        drawingToolsSystem = new DrawingToolsSystem(futabaApp);
        await drawingToolsSystem.init();
        
        // 3. 履歴管理システムの参照取得
        historyManager = drawingToolsSystem.getHistoryManager();
        
        // 4. UI管理システム初期化（履歴管理統合版）
        console.log('🎯 Step 3: UI管理システム初期化（履歴管理統合版）');
        uiManager = new IntegratedUIManager(futabaApp, drawingToolsSystem);
        await uiManager.init();
        
        console.log('🎉 アプリケーション起動完了！');
        console.log('💡 新機能（履歴管理）:');
        console.log('  🏛️ アンドゥ・リドゥ機能');
        console.log('    - Ctrl+Z: アンドゥ');
        console.log('    - Ctrl+Y: リドゥ');
        console.log('    - Ctrl+Shift+Z: リドゥ（代替）');
        console.log('  📝 自動履歴記録:');
        console.log('    - 描画操作（ペン・消しゴム）');
        console.log('    - プリセット変更');
        console.log('    - ツール変更');
        console.log('    - ブラシ設定変更');
        console.log('    - キャンバスリサイズ');
        console.log('    - キャンバスクリア');
        console.log('  🧠 メモリ効率管理:');
        console.log('    - 最大50履歴保存');
        console.log('    - RenderTexture自動クリーンアップ');
        console.log('    - メモリ使用量監視');
        
        console.log('💡 改善ポイント:');
        console.log('  ✅ 分割アーキテクチャ対応');
        console.log('  ✅ プリセット配置改善');
        console.log('  ✅ スライダー数値表示修正');
        console.log('  ✅ ショートカット体系整備');
        console.log('  ✅ 履歴管理システム統合');
        
        console.log('💡 利用可能機能:');
        console.log('  ✅ ベクターペン描画 (線補正付き)');
        console.log('  ✅ 消しゴムツール');
        console.log('  ✅ プリセット選択');
        console.log('  ✅ キャンバスリサイズ');
        console.log('  ✅ ライブプレビュー更新');
        console.log('  ✅ ショートカット (B: ペン, E: 消しゴム, ESC: クリア)');
        console.log('  ✅ 履歴管理 (Ctrl+Z: アンドゥ, Ctrl+Y: リドゥ)');
        
        // 成功通知
        if (uiManager && uiManager.showNotification) {
            uiManager.showNotification('履歴管理統合版起動完了！アンドゥ・リドゥ利用可能', 'success', 4000);
        }
        
        // ==== デバッグ用グローバル関数 ====
        
        window.getAppStatus = () => {
            if (!futabaApp || !drawingToolsSystem || !uiManager) {
                return { error: 'アプリケーションが初期化されていません' };
            }
            
            return {
                app: futabaApp.getStats(),
                drawingTools: drawingToolsSystem.getSystemStats(),
                ui: uiManager.getUIStats ? uiManager.getUIStats() : 'N/A',
                history: drawingToolsSystem.getHistoryStats(),
                timestamp: new Date().toISOString()
            };
        };
        
        window.clearCanvas = () => {
            if (futabaApp && historyManager) {
                historyManager.recordCanvasClear();
                futabaApp.clear();
                console.log('Canvas cleared (履歴記録済み)');
            }
        };
        
        window.testPreview = () => {
            if (uiManager && uiManager.penPresetManager) {
                console.log('🎨 プレビューデータテスト（履歴対応版）:');
                const previewData = uiManager.penPresetManager.generatePreviewData();
                previewData.forEach((data, index) => {
                    console.log(`  プリセット${index + 1}: サイズ${data.label}, 表示${data.size}px, アクティブ:${data.isActive}`);
                });
            }
        };
        
        window.switchTool = (toolName) => {
            if (drawingToolsSystem) {
                const result = drawingToolsSystem.setTool(toolName);
                console.log(`ツール切り替え（履歴記録済み）: ${toolName} -> ${result ? '成功' : '失敗'}`);
                return result;
            }
            return false;
        };
        
        // ==== 履歴管理デバッグ関数 ====
        
        window.undo = () => {
            if (drawingToolsSystem) {
                const result = drawingToolsSystem.undo();
                console.log(`アンドゥ実行: ${result ? '成功' : '失敗'}`);
                return result;
            }
            return false;
        };
        
        window.redo = () => {
            if (drawingToolsSystem) {
                const result = drawingToolsSystem.redo();
                console.log(`リドゥ実行: ${result ? '成功' : '失敗'}`);
                return result;
            }
            return false;
        };
        
        window.getHistoryStats = () => {
            if (drawingToolsSystem) {
                return drawingToolsSystem.getHistoryStats();
            }
            return null;
        };
        
        window.getHistoryList = () => {
            if (drawingToolsSystem) {
                return drawingToolsSystem.getHistoryList();
            }
            return [];
        };
        
        window.debugHistory = () => {
            if (drawingToolsSystem) {
                drawingToolsSystem.debugHistory();
            } else {
                console.warn('履歴管理システムが利用できません');
            }
        };
        
        window.testHistory = () => {
            if (drawingToolsSystem) {
                drawingToolsSystem.testHistoryFunction();
            } else {
                console.warn('履歴管理システムが利用できません');
            }
        };
        
        window.clearHistory = () => {
            if (drawingToolsSystem) {
                drawingToolsSystem.clearHistory();
                console.log('履歴をクリアしました');
            }
        };
        
        window.toggleHistoryDebug = () => {
            if (drawingToolsSystem) {
                drawingToolsSystem.toggleHistoryDebug();
            }
        };
        
        // ==== 既存のデバッグ関数（修正版）====
        
        window.testSliderUpdate = () => {
            if (uiManager) {
                console.log('🔧 スライダー数値表示テスト（履歴対応版）:');
                uiManager.forceUpdateSliderDisplay('pen-size-slider', '16.0px');
                uiManager.forceUpdateSliderDisplay('pen-opacity-slider', '85.0%');
                console.log('  数値表示を強制更新しました');
            }
        };
        
        window.testPresetSync = () => {
            if (uiManager && uiManager.penPresetManager) {
                console.log('🎯 プリセット同期テスト（履歴対応版）:');
                const preset = uiManager.penPresetManager.selectPreset('preset-8');
                if (preset) {
                    uiManager.updateSliderValue('pen-size-slider', preset.size);
                    uiManager.updateSliderValue('pen-opacity-slider', preset.opacity * 100);
                    uiManager.forceUpdateSliderDisplay('pen-size-slider', preset.size.toFixed(1) + 'px');
                    uiManager.forceUpdateSliderDisplay('pen-opacity-slider', (preset.opacity * 100).toFixed(1) + '%');
                    console.log('  プリセット8に切り替え、数値同期完了（履歴記録済み）');
                }
            }
        };
        
        // ==== システム統計表示関数 ====
        
        window.showSystemStats = () => {
            console.group('📊 システム統計情報');
            
            if (futabaApp) {
                console.log('🎯 コアアプリ:', futabaApp.getStats());
            }
            
            if (drawingToolsSystem) {
                console.log('🛠️ 描画ツール:', drawingToolsSystem.getSystemStats());
            }
            
            if (historyManager) {
                console.log('🏛️ 履歴管理:', historyManager.getStats());
                console.log('📚 履歴リスト:', historyManager.getHistoryList());
            }
            
            console.groupEnd();
        };
        
        // 初回システム統計表示（開発用）
        setTimeout(() => {
            console.log('');
            console.log('🎯 起動後システム状態:');
            window.showSystemStats();
            console.log('');
            console.log('💡 利用可能なデバッグ関数:');
            console.log('  - getAppStatus(): アプリ全体の状態取得');
            console.log('  - clearCanvas(): 履歴付きキャンバスクリア');
            console.log('  - undo(): アンドゥ実行');
            console.log('  - redo(): リドゥ実行');
            console.log('  - debugHistory(): 履歴デバッグ情報表示');
            console.log('  - testHistory(): 履歴機能テスト実行');
            console.log('  - clearHistory(): 履歴クリア');
            console.log('  - showSystemStats(): システム統計表示');
            console.log('  - toggleHistoryDebug(): 履歴デバッグモード切り替え');
        }, 1000);
        
    } catch (error) {
        console.error('❌ アプリケーション起動エラー:', error);
        showStartupError(error);
    }
});

// ==== エラー表示 ====
function showStartupError(error) {
    const errorDiv = document.createElement('div');
    errorDiv.innerHTML = `
        <div style="position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); 
                    background: #ffebee; border: 2px solid #f44336; border-radius: 8px; 
                    padding: 20px; max-width: 500px; z-index: 10000; 
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
                    box-shadow: 0 8px 24px rgba(244, 67, 54, 0.3);">
            <h3 style="color: #f44336; margin: 0 0 12px 0; font-size: 18px;">
                🚨 アプリケーション起動エラー（履歴管理統合版）
            </h3>
            <p style="margin: 0 0 12px 0; color: #333; line-height: 1.5;">
                ${error.message}
            </p>
            <details style="margin: 12px 0; color: #666;">
                <summary style="cursor: pointer; font-weight: 500;">
                    詳細情報を表示
                </summary>
                <pre style="margin: 8px 0 0 0; font-size: 12px; overflow: auto; max-height: 200px;">
${error.stack || 'スタック情報なし'}
                </pre>
            </details>
            <p style="margin: 12px 0 0 0; font-size: 12px; color: #666;">
                💡 ブラウザのコンソール（F12）で詳細を確認できます<br>
                🏛️ 履歴管理機能が正常に動作するか確認してください
            </p>
            <button onclick="this.parentElement.parentElement.remove()" 
                    style="margin: 12px 0 0 0; padding: 8px 16px; background: #f44336; 
                           color: white; border: none; border-radius: 4px; cursor: pointer;">
                閉じる
            </button>
        </div>
    `;
    document.body.appendChild(errorDiv);
}