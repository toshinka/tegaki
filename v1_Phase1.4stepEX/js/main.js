/**
 * 🎨 Tegaki Project - Main Application Entry Point
 * ✅ TEGAKI_NAMESPACE: 完全統一版
 * 🔧 REGISTRY_SYSTEM: 初期化レジストリ実行対応
 * 🚫 COORDINATE_BUG_FIX: 座標バグ完全対策版
 * 📋 RESPONSIBILITY: 「アプリケーション統合初期化・起動制御」専門
 * 
 * 📏 DESIGN_PRINCIPLE: 改修手順書Phase1.4stepEX完全準拠
 * 🎯 BUG_PREVENTION: 堂々巡りエラー防止・依存関係順序保証
 * 🌈 UI_PRESERVATION: ふたばカラー・ポップアップ・レイアウト保持
 * 
 * 依存: 全Tegakiシステム統合
 * 公開: Tegaki.TegakiApplication, Tegaki.AppInstance
 */

// Tegaki名前空間初期化
window.Tegaki = window.Tegaki || {};

class TegakiApplication {
    constructor() {
        this.initialized = false;
        this.managers = {};
        this.config = {
            canvas: {
                width: 400,      // UI画像に合わせて
                height: 400,     // UI画像に合わせて
                backgroundColor: '#ffffee', // ふたば背景色
                antialias: true,
                preserveDrawingBuffer: true
            },
            drawing: {
                defaultTool: 'pen',
                smoothing: true,
                pressureSupport: true
            }
        };
    }

    /**
     * アプリケーション統合初期化（改修手順書準拠）
     */
    async initialize() {
        try {
            console.log('🎨 Tegaki Phase1.4stepEX 初期化開始...');

            // STEP 1: 根幹Manager初期化レジストリ実行
            this.executeInitializationRegistry();
            
            // STEP 2: キャンバスシステム初期化
            this.initializeCanvasSystem();
            
            // STEP 3: ツール登録・統合
            this.registerTools();
            
            // STEP 4: イベント統合・座標バインド
            this.bindEvents();
            
            // STEP 5: UI・ポップアップ統合
            this.initializeUI();
            
            this.initialized = true;
            console.log('✅ Tegaki Phase1.4stepEX 初期化完了');
            
            // 初期化完了イベント発火
            if (Tegaki.EventBusInstance) {
                Tegaki.EventBusInstance.emit('app:initialized');
            }
            
        } catch (error) {
            console.error('❌ Tegaki初期化エラー:', error);
            if (Tegaki.ErrorManagerInstance) {
                Tegaki.ErrorManagerInstance.handle(error, 'TegakiApplication.initialize');
            }
            throw error;
        }
    }

    /**
     * STEP 1: 初期化レジストリ実行（根幹Manager優先）
     */
    executeInitializationRegistry() {
        console.log('📡 初期化レジストリ実行中...');
        
        if (Tegaki._registry) {
            console.log(`🔧 ${Tegaki._registry.length}個の初期化処理を実行`);
            
            Tegaki._registry.forEach((initFunc, index) => {
                try {
                    initFunc();
                    console.log(`✅ Registry[${index}] 初期化完了`);
                } catch (error) {
                    console.error(`❌ Registry[${index}] 初期化エラー:`, error);
                    throw error;
                }
            });
            
            // レジストリを削除（一度だけ実行）
            delete Tegaki._registry;
            console.log('🗑️ 初期化レジストリ削除完了');
        }
        
        // 根幹Manager確認
        const coreManagers = [
            'ErrorManagerInstance',
            'ConfigManagerInstance', 
            'StateManagerInstance',
            'EventBusInstance'
        ];
        
        const missingManagers = coreManagers.filter(manager => !Tegaki[manager]);
        if (missingManagers.length > 0) {
            throw new Error(`根幹Manager初期化失敗: ${missingManagers.join(', ')}`);
        }
        
        console.log('✅ 根幹Manager初期化確認完了');
    }

    /**
     * STEP 2: キャンバスシステム初期化（座標バグ対策）
     */
    initializeCanvasSystem() {
        console.log('🎯 キャンバスシステム初期化中...');

        // キャンバスコンテナ取得
        const container = document.querySelector("#canvas-container");
        if (!container) {
            throw new Error("Canvas container (#canvas-container) が見つかりません");
        }

        // CanvasManager利用（Tegaki統一API）
        if (Tegaki.CanvasManagerInstance) {
            Tegaki.CanvasManagerInstance.initialize(container, this.config.canvas);
            console.log('✅ CanvasManagerInstance 初期化完了');
        }

        // CoordinateManager設定（座標バグ対策の要）
        if (Tegaki.CoordinateManagerInstance) {
            const canvasElement = container.querySelector('canvas');
            if (canvasElement) {
                Tegaki.CoordinateManagerInstance.setCanvasElement(canvasElement);
                console.log('✅ CoordinateManagerInstance キャンバス設定完了');
            }
        }

        console.log('✅ キャンバスシステム初期化完了');
    }

    /**
     * STEP 3: ツール登録（改修手順書準拠）
     */
    registerTools() {
        console.log('🔧 ツール登録中...');

        if (Tegaki.ToolManagerInstance) {
            // デフォルトツール設定
            Tegaki.ToolManagerInstance.setTool("pen");
            console.log('✅ デフォルトツール設定完了: pen');
        }

        console.log('✅ ツール登録完了');
    }

    /**
     * STEP 4: イベント統合（座標バグ完全対策）
     */
    bindEvents() {
        console.log('🔗 イベント統合中...');

        const container = document.querySelector("#canvas-container");
        if (!container || !Tegaki.EventBusInstance) return;

        // ポインターイベント統合（座標バグの修正対象）
        container.addEventListener("pointerdown", (e) => {
            try {
                // CoordinateManagerで座標抽出（バグ修正の要）
                const coordInfo = Tegaki.CoordinateManagerInstance?.extractPointerCoordinates(
                    e, 
                    container.getBoundingClientRect(), 
                    null
                );
                
                if (coordInfo) {
                    // EventBus経由で通知（疎結合）
                    Tegaki.EventBusInstance.safeEmit('pointerdown', {
                        event: e,
                        coordinates: coordInfo,
                        timestamp: Date.now()
                    });
                }
            } catch (error) {
                if (Tegaki.ErrorManagerInstance) {
                    Tegaki.ErrorManagerInstance.handle(error, 'TegakiApplication.pointerdown');
                }
            }
        });

        container.addEventListener("pointermove", (e) => {
            try {
                const coordInfo = Tegaki.CoordinateManagerInstance?.extractPointerCoordinates(
                    e, 
                    container.getBoundingClientRect(), 
                    null
                );
                
                if (coordInfo) {
                    Tegaki.EventBusInstance.safeEmit('pointermove', {
                        event: e,
                        coordinates: coordInfo,
                        timestamp: Date.now()
                    });

                    // ステータス更新
                    this.updateCoordinateDisplay(coordInfo.x, coordInfo.y);
                }
            } catch (error) {
                if (Tegaki.ErrorManagerInstance) {
                    Tegaki.ErrorManagerInstance.handle(error, 'TegakiApplication.pointermove');
                }
            }
        });

        container.addEventListener("pointerup", (e) => {
            try {
                const coordInfo = Tegaki.CoordinateManagerInstance?.extractPointerCoordinates(
                    e, 
                    container.getBoundingClientRect(), 
                    null
                );
                
                if (coordInfo) {
                    Tegaki.EventBusInstance.safeEmit('pointerup', {
                        event: e,
                        coordinates: coordInfo,
                        timestamp: Date.now()
                    });
                }
            } catch (error) {
                if (Tegaki.ErrorManagerInstance) {
                    Tegaki.ErrorManagerInstance.handle(error, 'TegakiApplication.pointerup');
                }
            }
        });

        console.log('✅ イベント統合完了');
    }

    /**
     * STEP 5: UI・ポップアップ初期化（ふたば保持）
     */
    initializeUI() {
        console.log('🎨 UI・ポップアップ初期化中...');

        // ツールボタンイベント設定
        this.setupToolButtons();

        // ポップアップシステム設定（保持対象）
        this.setupPopupSystems();

        // ドラッグ可能ポップアップ設定
        this.setupDraggablePopups();

        // ステータスパネル初期化
        this.initializeStatusPanel();

        console.log('✅ UI・ポップアップ初期化完了');
    }

    /**
     * ツールボタンイベント設定
     */
    setupToolButtons() {
        // ペンツールボタン
        const penTool = document.getElementById('pen-tool');
        if (penTool) {
            penTool.addEventListener('click', () => {
                if (Tegaki.ToolManagerInstance) {
                    Tegaki.ToolManagerInstance.setTool('pen');
                }
                this.setActiveToolButton('pen-tool');
            });
        }

        // 消しゴムツールボタン
        const eraserTool = document.getElementById('eraser-tool');
        if (eraserTool) {
            eraserTool.addEventListener('click', () => {
                if (Tegaki.ToolManagerInstance) {
                    Tegaki.ToolManagerInstance.setTool('eraser');
                }
                this.setActiveToolButton('eraser-tool');
            });
        }

        // ポップアップ付きツールボタン
        const popupTools = ['pen-tool', 'resize-tool'];
        popupTools.forEach(toolId => {
            const toolButton = document.getElementById(toolId);
            const popupId = toolId.replace('-tool', '-settings');
            const popup = document.getElementById(popupId);
            
            if (toolButton && popup) {
                toolButton.addEventListener('click', (e) => {
                    if (e.detail === 2) { // ダブルクリック
                        popup.style.display = popup.style.display === 'none' ? 'block' : 'none';
                    }
                });
            }
        });
    }

    /**
     * ポップアップシステム設定（保持機能）
     */
    setupPopupSystems() {
        // ベクターペンツール設定パネル
        const penSettings = document.getElementById('pen-settings');
        if (penSettings) {
            this.setupPenToolSettings(penSettings);
        }

        // リサイズ設定パネル
        const resizeSettings = document.getElementById('resize-settings');
        if (resizeSettings) {
            this.setupResizeSettings(resizeSettings);
        }
    }

    /**
     * ペンツール設定パネル
     */
    setupPenToolSettings(panel) {
        // サイズプリセット
        const sizePresets = panel.querySelectorAll('.size-preset-item');
        sizePresets.forEach(preset => {
            preset.addEventListener('click', () => {
                const size = parseFloat(preset.getAttribute('data-size'));
                if (size && Tegaki.PenToolInstance) {
                    Tegaki.PenToolInstance.updateSettings({ size });
                }
                
                // アクティブ表示切り替え
                sizePresets.forEach(p => p.classList.remove('active'));
                preset.classList.add('active');
            });
        });

        // スライダー設定（サイズ・不透明度・筆圧・線補正）
        this.setupSliderControls(panel);
    }

    /**
     * スライダー制御設定
     */
    setupSliderControls(panel) {
        const sliders = panel.querySelectorAll('.slider');
        sliders.forEach(slider => {
            const handle = slider.querySelector('.slider-handle');
            const track = slider.querySelector('.slider-track');
            const valueDisplay = slider.nextElementSibling;
            
            if (handle && track) {
                let isDragging = false;
                
                handle.addEventListener('pointermove', (e) => {
                    if (!isDragging) return;
                    
                    const rect = track.getBoundingClientRect();
                    const percentage = Math.max(0, Math.min(100, 
                        ((e.clientX - rect.left) / rect.width) * 100
                    ));
                    
                    handle.style.left = `${percentage}%`;
                    
                    // 値の更新
                    if (valueDisplay) {
                        const sliderId = slider.id;
                        this.updateSliderValue(sliderId, percentage);
                    }
                });
                
                handle.addEventListener('pointerup', (e) => {
                    isDragging = false;
                    handle.releasePointerCapture(e.pointerId);
                });
            }
        });
    }

    /**
     * スライダー値更新
     */
    updateSliderValue(sliderId, percentage) {
        const valueElement = document.getElementById(sliderId.replace('-slider', '-value'));
        if (!valueElement) return;
        
        let value, unit = '';
        
        switch (sliderId) {
            case 'pen-size-slider':
                value = ((percentage / 100) * 32).toFixed(1); // 0-32px
                unit = 'px';
                if (Tegaki.PenToolInstance) {
                    Tegaki.PenToolInstance.updateSettings({ size: parseFloat(value) });
                }
                break;
                
            case 'pen-opacity-slider':
                value = (percentage).toFixed(1);
                unit = '%';
                if (Tegaki.PenToolInstance) {
                    Tegaki.PenToolInstance.updateSettings({ opacity: percentage / 100 });
                }
                break;
                
            case 'pen-pressure-slider':
                value = (percentage).toFixed(1);
                unit = '%';
                if (Tegaki.PenToolInstance) {
                    Tegaki.PenToolInstance.updateSettings({ pressure: percentage / 100 });
                }
                break;
                
            case 'pen-smoothing-slider':
                value = (percentage).toFixed(1);
                unit = '%';
                if (Tegaki.PenToolInstance) {
                    Tegaki.PenToolInstance.updateSettings({ smoothing: percentage / 100 });
                }
                break;
                
            default:
                value = percentage.toFixed(1);
                unit = '%';
        }
        
        valueElement.textContent = `${value}${unit}`;
    }

    /**
     * リサイズ設定パネル
     */
    setupResizeSettings(panel) {
        // プリセットボタン
        const resizeButtons = panel.querySelectorAll('.resize-button[data-size]');
        resizeButtons.forEach(button => {
            button.addEventListener('click', () => {
                const size = button.getAttribute('data-size').split(',');
                const width = parseInt(size[0]);
                const height = parseInt(size[1]);
                
                this.resizeCanvas(width, height);
            });
        });

        // 適用ボタン
        const applyResize = panel.querySelector('#apply-resize');
        const applyResizeCenter = panel.querySelector('#apply-resize-center');
        
        if (applyResize) {
            applyResize.addEventListener('click', () => {
                const width = parseInt(document.getElementById('canvas-width')?.value || 400);
                const height = parseInt(document.getElementById('canvas-height')?.value || 400);
                this.resizeCanvas(width, height, false);
            });
        }
        
        if (applyResizeCenter) {
            applyResizeCenter.addEventListener('click', () => {
                const width = parseInt(document.getElementById('canvas-width')?.value || 400);
                const height = parseInt(document.getElementById('canvas-height')?.value || 400);
                this.resizeCanvas(width, height, true);
            });
        }
    }

    /**
     * ドラッグ可能ポップアップ設定（保持機能）
     */
    setupDraggablePopups() {
        const draggablePopups = document.querySelectorAll('.popup-panel.draggable');
        
        draggablePopups.forEach(popup => {
            const title = popup.querySelector('.popup-title');
            if (!title) return;
            
            let isDragging = false;
            let startX, startY, startLeft, startTop;
            
            title.addEventListener('pointerdown', (e) => {
                isDragging = true;
                startX = e.clientX;
                startY = e.clientY;
                
                const rect = popup.getBoundingClientRect();
                startLeft = rect.left;
                startTop = rect.top;
                
                title.setPointerCapture(e.pointerId);
                popup.style.zIndex = '1000';
            });
            
            document.addEventListener('pointermove', (e) => {
                if (!isDragging) return;
                
                const deltaX = e.clientX - startX;
                const deltaY = e.clientY - startY;
                
                popup.style.left = `${startLeft + deltaX}px`;
                popup.style.top = `${startTop + deltaY}px`;
            });
            
            title.addEventListener('pointerup', (e) => {
                isDragging = false;
                title.releasePointerCapture(e.pointerId);
                popup.style.zIndex = '';
            });
        });
    }

    /**
     * ステータスパネル初期化
     */
    initializeStatusPanel() {
        // 初期値設定
        this.updateCanvasInfo(400, 400);
        this.updateCurrentTool('ベクターペン');
        this.updateCurrentColor('#800000');
        this.updateCoordinateDisplay(0, 0);
        this.updatePressureDisplay(0);
        
        // パフォーマンス情報の更新開始
        this.startPerformanceMonitoring();
    }

    /**
     * キャンバス情報更新
     */
    updateCanvasInfo(width, height) {
        const canvasInfo = document.getElementById('canvas-info');
        if (canvasInfo) {
            canvasInfo.textContent = `${width}×${height}px`;
        }
    }

    /**
     * 現在のツール表示更新
     */
    updateCurrentTool(toolName) {
        const currentTool = document.getElementById('current-tool');
        if (currentTool) {
            currentTool.textContent = toolName;
        }
    }

    /**
     * 現在の色表示更新
     */
    updateCurrentColor(color) {
        const currentColor = document.getElementById('current-color');
        if (currentColor) {
            currentColor.textContent = color;
        }
    }

    /**
     * 座標表示更新
     */
    updateCoordinateDisplay(x, y) {
        const coordinates = document.getElementById('coordinates');
        if (coordinates) {
            coordinates.textContent = `x: ${Math.round(x)}, y: ${Math.round(y)}`;
        }
    }

    /**
     * 筆圧表示更新
     */
    updatePressureDisplay(pressure) {
        const pressureMonitor = document.getElementById('pressure-monitor');
        if (pressureMonitor) {
            pressureMonitor.textContent = `${(pressure * 100).toFixed(1)}%`;
        }
    }

    /**
     * パフォーマンス監視開始
     */
    startPerformanceMonitoring() {
        setInterval(() => {
            // FPS更新（模擬）
            const fps = document.getElementById('fps');
            if (fps) {
                fps.textContent = '60'; // UI画像に合わせて
            }
            
            // GPU使用率更新（模擬）
            const gpuUsage = document.getElementById('gpu-usage');
            if (gpuUsage) {
                gpuUsage.textContent = '45%'; // UI画像に合わせて
            }
            
            // メモリ使用量更新（模擬）
            const memoryUsage = document.getElementById('memory-usage');
            if (memoryUsage) {
                memoryUsage.textContent = '1.2GB'; // UI画像に合わせて
            }
            
            // レイヤー数更新
            const layerCount = document.getElementById('layer-count');
            if (layerCount) {
                layerCount.textContent = '1'; // UI画像に合わせて
            }
        }, 1000);
    }

    /**
     * キャンバスリサイズ実行
     */
    resizeCanvas(width, height, centerContent = false) {
        try {
            if (Tegaki.CanvasManagerInstance) {
                Tegaki.CanvasManagerInstance.resize(width, height, centerContent);
            }
            
            if (Tegaki.CoordinateManagerInstance) {
                Tegaki.CoordinateManagerInstance.updateCanvasSize(width, height);
            }
            
            this.updateCanvasInfo(width, height);
            console.log(`✅ キャンバスリサイズ完了: ${width}x${height}`);
        } catch (error) {
            if (Tegaki.ErrorManagerInstance) {
                Tegaki.ErrorManagerInstance.handle(error, 'TegakiApplication.resizeCanvas');
            }
        }
    }

    /**
     * アクティブツールボタン設定
     */
    setActiveToolButton(activeToolId) {
        document.querySelectorAll('.tool-button').forEach(btn => {
            btn.classList.remove('active');
        });
        
        const activeButton = document.getElementById(activeToolId);
        if (activeButton) {
            activeButton.classList.add('active');
        }
    }
}

// Tegaki名前空間にクラスを登録
Tegaki.TegakiApplication = TegakiApplication;

/**
 * DOM読み込み完了後の統合初期化（改修手順書準拠）
 */
document.addEventListener("DOMContentLoaded", async () => {
    try {
        console.log('📋 DOMContentLoaded - Tegaki Phase1.4stepEX 起動開始');
        
        // 改修手順書テンプレート：根幹Manager初期化レジストリ実行
        if (Tegaki._registry) {
            console.log('🔧 根幹Manager初期化レジストリ実行中...');
            Tegaki._registry.forEach(init => init());
            delete Tegaki._registry;
            console.log('✅ 根幹Manager初期化レジストリ実行完了');
        }
        
        // アプリケーション統合初期化
        const app = new Tegaki.TegakiApplication();
        await app.initialize();
        
        // Tegaki名前空間にアプリインスタンス登録
        Tegaki.AppInstance = app;
        
        console.log('🎉 Tegaki Phase1.4stepEX 起動完了');
        console.log('根幹Manager初期化完了:', {
            ErrorManager: !!Tegaki.ErrorManagerInstance,
            ConfigManager: !!Tegaki.ConfigManagerInstance, 
            StateManager: !!Tegaki.StateManagerInstance,
            EventBus: !!Tegaki.EventBusInstance,
            CoordinateManager: !!Tegaki.CoordinateManagerInstance
        });
        
    } catch (error) {
        console.error('💥 Tegaki起動失敗:', error);
        
        // フォールバック：ErrorManager未初期化でも動作
        if (Tegaki.ErrorManagerInstance) {
            Tegaki.ErrorManagerInstance.handle(error, 'DOMContentLoaded');
        } else {
            console.error("Fatal Error:", error);
        }
    }
});

/**
 * ページ離脱時のクリーンアップ
 */
window.addEventListener('beforeunload', () => {
    if (Tegaki.AppInstance && Tegaki.AppInstance.initialized) {
        console.log('🧹 Tegakiクリーンアップ実行');
        
        // 設定保存
        if (Tegaki.ConfigManagerInstance) {
            Tegaki.ConfigManagerInstance.save();
        }
    }
});

/**
 * グローバルエラーハンドリング（Tegaki統合版）
 */
window.addEventListener('error', (event) => {
    if (Tegaki.ErrorManagerInstance) {
        Tegaki.ErrorManagerInstance.handle(event.error, 'Global Error Handler');
    }
});

window.addEventListener('unhandledrejection', (event) => {
    if (Tegaki.ErrorManagerInstance) {
        Tegaki.ErrorManagerInstance.handle(event.reason, 'Unhandled Promise Rejection');
    }
});

console.log('[Main] ✅ Tegaki統合初期化スクリプト読み込み完了');