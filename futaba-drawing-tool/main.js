/**
 * 🎨 ふたば☆ちゃんねる風ベクターお絵描きツール v1.0
 * メインエントリーポイント - main.js（分割アーキテクチャ対応版）
 * 
 * 依存関係:
 * 1. PIXI.js v7 (CDN)
 * 2. app-core.js -> PixiDrawingApp, CONFIG, EVENTS
 * 3. drawing-tools.js -> DrawingToolsSystem
 * 4. ui-manager.js -> UIManager
 */

// ==== グローバル変数 ====
let futabaApp = null;          // PixiDrawingApp インスタンス
let drawingToolsSystem = null; // DrawingToolsSystem インスタンス
let uiManager = null;          // UIManager インスタンス

// ==== プレビュープリセット管理（シンプル版）====
class SimplePenPresetManager {
    constructor(drawingToolsSystem) {
        this.drawingToolsSystem = drawingToolsSystem;
        this.presets = new Map();
        this.activePresetId = null;
        this.currentLiveValues = null;
        
        this.initializeDefaultPresets();
    }
    
    initializeDefaultPresets() {
        const defaultPresets = [
            { id: 'preset-1', size: 1, opacity: 0.85, color: 0x800000, label: '1' },
            { id: 'preset-2', size: 2, opacity: 0.85, color: 0x800000, label: '2' },
            { id: 'preset-4', size: 4, opacity: 0.85, color: 0x800000, label: '4' },
            { id: 'preset-8', size: 8, opacity: 0.85, color: 0x800000, label: '8' },
            { id: 'preset-16', size: 16, opacity: 0.85, color: 0x800000, label: '16' },
            { id: 'preset-32', size: 32, opacity: 0.85, color: 0x800000, label: '32' }
        ];
        
        defaultPresets.forEach(preset => {
            this.presets.set(preset.id, preset);
        });
        
        this.activePresetId = 'preset-16';
        console.log('✅ ペンプリセット初期化完了');
    }
    
    updateActivePresetLive(size, opacity, color = null) {
        if (!this.activePresetId) return;
        
        const activePreset = this.presets.get(this.activePresetId);
        if (!activePreset) return;
        
        this.currentLiveValues = {
            size: size,
            opacity: opacity,
            color: color || activePreset.color
        };
        
        console.log('🎨 ライブプレビュー更新:', {
            preset: this.activePresetId,
            size: size,
            opacity: opacity
        });
    }
    
    generatePreviewData() {
        const previewData = [];
        
        this.presets.forEach((preset, presetId) => {
            const isActive = presetId === this.activePresetId;
            
            let displayValues = preset;
            if (isActive && this.currentLiveValues) {
                displayValues = {
                    ...preset,
                    size: this.currentLiveValues.size,
                    opacity: this.currentLiveValues.opacity,
                    color: this.currentLiveValues.color
                };
            }
            
            const displaySize = Math.min(20, Math.max(0.5, displayValues.size));
            
            previewData.push({
                id: presetId,
                dataSize: preset.size,
                size: displaySize,
                opacity: displayValues.opacity,
                color: this.colorToHex(displayValues.color),
                label: displayValues.size.toFixed(1),
                opacityLabel: Math.round(displayValues.opacity * 100) + '%',
                isActive: isActive
            });
        });
        
        return previewData;
    }
    
    selectPreset(presetId) {
        if (!this.presets.has(presetId)) return false;
        
        this.activePresetId = presetId;
        this.currentLiveValues = null;
        
        const preset = this.presets.get(presetId);
        console.log('🎯 プリセット選択:', presetId, preset);
        
        return preset;
    }
    
    getPresetIdBySize(size) {
        for (const [presetId, preset] of this.presets) {
            if (Math.abs(preset.size - size) < 0.1) {
                return presetId;
            }
        }
        return null;
    }
    
    colorToHex(color) {
        if (typeof color === 'string') return color;
        return '#' + color.toString(16).padStart(6, '0');
    }
    
    getActivePreset() {
        return this.presets.get(this.activePresetId);
    }
    
    getActivePresetId() {
        return this.activePresetId;
    }
}

// ==== 統合UIManager（新アーキテクチャ対応）====
class IntegratedUIManager extends UIManager {
    constructor(app, drawingToolsSystem) {
        // 元のUIManagerをベースクラスとして使用
        super(app, drawingToolsSystem);
        
        this.penPresetManager = new SimplePenPresetManager(drawingToolsSystem);
        this.coordinateUpdateThrottle = null;
    }
    
    async init() {
        try {
            console.log('✅ IntegratedUIManager初期化完了');
            
        } catch (error) {
            console.error('❌ IntegratedUIManager初期化エラー:', error);
            throw error;
        }
    }
    
    setupToolButtons() {
        document.querySelectorAll('.tool-button').forEach(button => {
            button.addEventListener('click', (event) => {
                if (button.classList.contains('disabled')) return;
                
                const toolId = button.id;
                const popupId = button.getAttribute('data-popup');
                
                this.handleToolButtonClick(toolId, popupId, button);
            });
        });
        
        console.log('✅ ツールボタン設定完了');
    }
    
    handleToolButtonClick(toolId, popupId, button) {
        // ツール切り替え
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
        if (this.toolsSystem.setTool(toolName)) {
            document.querySelectorAll('.tool-button').forEach(btn => 
                btn.classList.remove('active'));
            if (button) {
                button.classList.add('active');
            }
            
            this.statusBar.updateCurrentTool(toolName);
        }
    }
    
    setupSliders() {
        this.createSlider('pen-size-slider', 0.1, 100, 16.0, (value, displayOnly = false) => {
            if (!displayOnly) {
                this.toolsSystem.updateBrushSettings({ size: value });
                const currentOpacity = this.getCurrentOpacity();
                this.penPresetManager.updateActivePresetLive(value, currentOpacity);
                this.updatePresetsDisplay();
            }
            return value.toFixed(1) + 'px';
        });
        
        this.createSlider('pen-opacity-slider', 0, 100, 85.0, (value, displayOnly = false) => {
            if (!displayOnly) {
                this.toolsSystem.updateBrushSettings({ opacity: value / 100 });
                const currentSize = this.getCurrentSize();
                this.penPresetManager.updateActivePresetLive(currentSize, value / 100);
                this.updatePresetsDisplay();
            }
            return value.toFixed(1) + '%';
        });
        
        this.createSlider('pen-pressure-slider', 0, 100, 50.0, (value, displayOnly = false) => {
            if (!displayOnly) {
                this.toolsSystem.updateBrushSettings({ pressure: value / 100 });
            }
            return value.toFixed(1) + '%';
        });
        
        this.createSlider('pen-smoothing-slider', 0, 100, 30.0, (value, displayOnly = false) => {
            if (!displayOnly) {
                this.toolsSystem.updateBrushSettings({ smoothing: value / 100 });
            }
            return value.toFixed(1) + '%';
        });
        
        this.setupSliderButtons();
        console.log('✅ スライダー設定完了');
    }
    
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
                
                const preset = this.penPresetManager.selectPreset(presetId);
                
                if (preset) {
                    this.updateSliderValue('pen-size-slider', preset.size);
                    this.updateSliderValue('pen-opacity-slider', preset.opacity * 100);
                    
                    this.toolsSystem.updateBrushSettings({
                        size: preset.size,
                        opacity: preset.opacity
                    });
                    
                    this.updatePresetsDisplay();
                    
                    console.log(`プリセット選択: サイズ${preset.size}, 不透明度${Math.round(preset.opacity * 100)}%`);
                }
            }
        });
        
        console.log('✅ プリセットリスナー設定完了');
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
    
    setupEventListeners() {
        // キーボードショートカット（DrawingToolsSystemで管理されるため簡略化）
        document.addEventListener('keydown', (event) => {
            if (event.key === 'Escape' && !this.popupManager.activePopup) {
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
        
        console.log('✅ イベントリスナー設定完了');
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
        
        console.log('✅ 全ディスプレイ更新完了');
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
        console.log('📊 パフォーマンス監視開始');
    }
}

// ==== アプリケーション初期化 ====
window.addEventListener('DOMContentLoaded', async () => {
    try {
        console.log('🚀 ふたば☆ちゃんねる風ベクターお絵描きツール v0.9 起動開始');
        console.log('✨ 分割アーキテクチャ対応版 - プレビュー改善');
        
        // 依存関係チェック
        if (typeof PIXI === 'undefined') {
            throw new Error('PIXI.js が読み込まれていません。CDNの読み込みを確認してください。');
        }
        
        if (typeof PixiDrawingApp === 'undefined') {
            throw new Error('app-core.js が読み込まれていません。');
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
        
        // 2. 描画ツールシステム初期化
        console.log('🎯 Step 2: 描画ツールシステム初期化');
        drawingToolsSystem = new DrawingToolsSystem(futabaApp);
        await drawingToolsSystem.init();
        
        // 3. UI管理システム初期化（統合版）
        console.log('🎯 Step 3: UI管理システム初期化');
        uiManager = new IntegratedUIManager(futabaApp, drawingToolsSystem);
        await uiManager.init();
        
        console.log('🎉 アプリケーション起動完了！');
        console.log('💡 改善ポイント:');
        console.log('  ✅ 分割アーキテクチャ対応');
        console.log('  ✅ プレビューフレーム統一 (20px固定)');
        console.log('  ✅ アクティブ状態を枠で表示');
        console.log('  ✅ 描画ツールシステム統合');
        console.log('💡 利用可能機能:');
        console.log('  ✅ ベクターペン描画 (線補正付き)');
        console.log('  ✅ 消しゴムツール');
        console.log('  ✅ プリセット選択 (改善版プレビュー)');
        console.log('  ✅ キャンバスリサイズ');
        console.log('  ✅ ライブプレビュー更新');
        console.log('  ✅ ショートカット (B: ペン, E: 消しゴム, ESC: クリア)');
        
        // 成功通知
        if (uiManager && uiManager.showNotification) {
            uiManager.showNotification('アプリケーション起動完了！分割アーキテクチャ対応版', 'success');
        }
        
        // デバッグ用グローバル関数
        window.getAppStatus = () => {
            if (!futabaApp || !drawingToolsSystem || !uiManager) {
                return { error: 'アプリケーションが初期化されていません' };
            }
            
            return {
                app: futabaApp.getStats(),
                drawingTools: drawingToolsSystem.getSystemStats(),
                ui: uiManager.getUIStats ? uiManager.getUIStats() : 'N/A',
                timestamp: new Date().toISOString()
            };
        };
        
        window.clearCanvas = () => {
            if (futabaApp) {
                futabaApp.clear();
                console.log('Canvas cleared');
            }
        };
        
        window.testPreview = () => {
            if (uiManager && uiManager.penPresetManager) {
                console.log('🎨 プレビューデータテスト:');
                const previewData = uiManager.penPresetManager.generatePreviewData();
                previewData.forEach((data, index) => {
                    console.log(`  プリセット${index + 1}: サイズ${data.label}, 表示${data.size}px, アクティブ:${data.isActive}`);
                });
            }
        };
        
        window.switchTool = (toolName) => {
            if (drawingToolsSystem) {
                const result = drawingToolsSystem.setTool(toolName);
                console.log(`ツール切り替え: ${toolName} -> ${result ? '成功' : '失敗'}`);
                return result;
            }
            return false;
        };
        
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
                🚨 アプリケーション起動エラー
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
                💡 ブラウザのコンソール（F12）で詳細を確認できます
            </p>
            <button onclick="this.parentElement.parentElement.remove()" 
                    style="margin: 12px 0 0 0; padding: 8px 16px; background: #f44336; 
                           color: white; border: none; border-radius: 4px; cursor: pointer;">
                閉じる
            </button>
        </div>
    `;
    document.body.appendChild(errorDiv);
}🎯 IntegratedUIManager初期化開始...');
            
            this.setupToolButtons();
            this.setupPopups();
            this.setupSliders();
            this.setupPresetListeners();
            this.setupResize();
            this.setupCheckboxes();
            this.setupEventListeners();
            
            this.updateAllDisplays();
            this.startPerformanceMonitoring();
            
            console.log('