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
 * 🔧 修正内容:
 * - レジストリ実行タイミング修正（DOM準備後）
 * - ブリッジ設定順序修正（エラーハンドリング強化）
 * - キャンバス初期化順序保証（CanvasManager→ToolManager）
 * - ツール登録エラー回避（クラス存在確認強化）
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
     * スライダー制御設定
     */
    setupSliderControls(panel) {
        try {
            const sliders = panel.querySelectorAll('.slider');
            sliders.forEach(slider => {
                const handle = slider.querySelector('.slider-handle');
                const track = slider.querySelector('.slider-track');
                const valueDisplay = slider.nextElementSibling;
                
                if (handle && track) {
                    let isDragging = false;
                    
                    handle.addEventListener('pointerdown', (e) => {
                        isDragging = true;
                        handle.setPointerCapture(e.pointerId);
                    });
                    
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
        } catch (error) {
            console.error('❌ スライダー設定エラー:', error);
        }
    }

    /**
     * スライダー値更新
     */
    updateSliderValue(sliderId, percentage) {
        try {
            const valueElement = document.getElementById(sliderId.replace('-slider', '-value'));
            if (!valueElement) return;
            
            let value, unit = '';
            
            switch (sliderId) {
                case 'pen-size-slider':
                    value = ((percentage / 100) * 32).toFixed(1); // 0-32px
                    unit = 'px';
                    if (Tegaki.ToolManagerInstance) {
                        Tegaki.ToolManagerInstance.updateToolSetting('pen', 'size', parseFloat(value));
                    }
                    break;
                    
                case 'pen-opacity-slider':
                    value = (percentage).toFixed(1);
                    unit = '%';
                    if (Tegaki.ToolManagerInstance) {
                        Tegaki.ToolManagerInstance.updateToolSetting('pen', 'opacity', percentage / 100);
                    }
                    break;
                    
                case 'pen-pressure-slider':
                    value = (percentage).toFixed(1);
                    unit = '%';
                    if (Tegaki.ToolManagerInstance) {
                        Tegaki.ToolManagerInstance.updateToolSetting('pen', 'pressure', percentage / 100);
                    }
                    break;
                    
                case 'pen-smoothing-slider':
                    value = (percentage).toFixed(1);
                    unit = '%';
                    if (Tegaki.ToolManagerInstance) {
                        Tegaki.ToolManagerInstance.updateToolSetting('pen', 'smoothing', percentage / 100);
                    }
                    break;
                    
                default:
                    value = percentage.toFixed(1);
                    unit = '%';
            }
            
            valueElement.textContent = `${value}${unit}`;
        } catch (error) {
            console.error('❌ スライダー値更新エラー:', error);
        }
    }

    /**
     * リサイズ設定パネル
     */
    setupResizeSettings(panel) {
        try {
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
        } catch (error) {
            console.error('❌ リサイズ設定エラー:', error);
        }
    }

    /**
     * ドラッグ可能ポップアップ設定（保持機能）
     */
    setupDraggablePopups() {
        try {
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
        } catch (error) {
            console.error('❌ ドラッグ可能ポップアップ設定エラー:', error);
        }
    }

    /**
     * ステータスパネル初期化
     */
    initializeStatusPanel() {
        try {
            // 初期値設定
            this.updateCanvasInfo(400, 400);
            this.updateCurrentTool('ベクターペン');
            this.updateCurrentColor('#800000');
            this.updateCoordinateDisplay(0, 0);
            this.updatePressureDisplay(0);
            
            // パフォーマンス情報の更新開始
            this.startPerformanceMonitoring();
        } catch (error) {
            console.error('❌ ステータスパネル初期化エラー:', error);
        }
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
        try {
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
        } catch (error) {
            console.error('❌ パフォーマンス監視エラー:', error);
        }
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
                Tegaki.CoordinateManagerInstance.updateCanvasSize?.(width, height);
            }
            
            this.updateCanvasInfo(width, height);
            console.log(`✅ キャンバスリサイズ完了: ${width}x${height}`);
        } catch (error) {
            console.error('❌ キャンバスリサイズエラー:', error);
            if (Tegaki.ErrorManagerInstance) {
                Tegaki.ErrorManagerInstance.handle(error, 'TegakiApplication.resizeCanvas');
            }
        }
    }

    /**
     * アクティブツールボタン設定
     */
    setActiveToolButton(activeToolId) {
        try {
            document.querySelectorAll('.tool-button').forEach(btn => {
                btn.classList.remove('active');
            });
            
            const activeButton = document.getElementById(activeToolId);
            if (activeButton) {
                activeButton.classList.add('active');
            }
        } catch (error) {
            console.error('❌ ツールボタン設定エラー:', error);
        }
    }
}

// Tegaki名前空間にクラスを登録
Tegaki.TegakiApplication = TegakiApplication;

/**
 * DOM読み込み完了後の統合初期化（修正：エラーハンドリング強化）
 */
document.addEventListener("DOMContentLoaded", async () => {
    try {
        console.log('📋 DOMContentLoaded - Tegaki Phase1.4stepEX 起動開始');
        
        // PIXI存在確認（修正：事前確認）
        if (typeof PIXI === 'undefined') {
            console.error('❌ PIXI.js が読み込まれていません');
            return;
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
            CoordinateManager: !!Tegaki.CoordinateManagerInstance,
            CanvasManager: !!Tegaki.CanvasManagerInstance,
            ToolManager: !!Tegaki.ToolManagerInstance
        });
        
    } catch (error) {
        console.error('💥 Tegaki起動失敗:', error);
        
        // フォールバック：ErrorManager未初期化でも動作
        if (Tegaki.ErrorManagerInstance) {
            Tegaki.ErrorManagerInstance.handle(error, 'DOMContentLoaded');
        } else {
            console.error("Fatal Error:", error);
            
            // エラー詳細表示（デバッグ用）
            if (error.stack) {
                console.error("Error Stack:", error.stack);
            }
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
            Tegaki.ConfigManagerInstance.save?.();
        }
    }
});

/**
 * グローバルエラーハンドリング（Tegaki統合版）
 */
window.addEventListener('error', (event) => {
    if (Tegaki.ErrorManagerInstance) {
        Tegaki.ErrorManagerInstance.handle(event.error, 'Global Error Handler');
    } else {
        console.error('Global Error:', event.error);
    }
});

window.addEventListener('unhandledrejection', (event) => {
    if (Tegaki.ErrorManagerInstance) {
        Tegaki.ErrorManagerInstance.handle(event.reason, 'Unhandled Promise Rejection');
    } else {
        console.error('Unhandled Promise Rejection:', event.reason);
    }
});

console.log('[Main] ✅ Tegaki統合初期化スクリプト読み込み完了（修正版）');
    /**
     * アプリケーション統合初期化（改修手順書準拠）
     */
    Tegaki.AppCoreInstance.initialize(); {
        try {
            console.log('🎨 Tegaki Phase1.4stepEX 初期化開始...');

            // STEP 1: 根幹Manager初期化レジストリ実行（修正：エラーハンドリング強化）
            await this.executeInitializationRegistry();

            // STEP 2: グローバルブリッジ設定（修正：レジストリ後に実行）
            this.setupGlobalBridge();

            // STEP 3: キャンバスシステム初期化（修正：順序保証）
            await this.initializeCanvasSystem();

            // STEP 4: ツール登録・統合（修正：初期化完了後に実行）
            await this.registerTools();

            // STEP 5: イベント統合・座標バインド
            this.bindEvents();

            // STEP 6: UI・ポップアップ統合
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
}
    /**
     * STEP 1: 初期化レジストリ実行（修正：エラーハンドリング強化）
     */
    async executeInitializationRegistry() {
        console.log('📡 初期化レジストリ実行中...');
        
        if (!Tegaki._registry || !Array.isArray(Tegaki._registry)) {
            console.warn('⚠️ 初期化レジストリが未定義または空です');
            return;
        }
        
        console.log(`🔧 ${Tegaki._registry.length}個の初期化処理を実行`);
        
        for (let i = 0; i < Tegaki._registry.length; i++) {
            try {
                const initFunc = Tegaki._registry[i];
                if (typeof initFunc === 'function') {
                    await initFunc();
                    console.log(`✅ Registry[${i}] 初期化完了`);
                } else {
                    console.warn(`⚠️ Registry[${i}] は関数ではありません:`, typeof initFunc);
                }
            } catch (error) {
                console.error(`❌ Registry[${i}] 初期化エラー:`, error);
                // エラーがあっても他の初期化を続行
            }
        }
        
        // レジストリを削除（一度だけ実行）
        delete Tegaki._registry;
        console.log('🗑️ 初期化レジストリ削除完了');
        
        // 根幹Manager確認（修正：詳細な確認）
        const coreManagers = [
            'ErrorManagerInstance',
            'ConfigManagerInstance', 
            'StateManagerInstance',
            'EventBusInstance',
            'CoordinateManagerInstance',
            'CanvasManagerInstance',
            'ToolManagerInstance'
        ];
        
        const missingManagers = coreManagers.filter(manager => !Tegaki[manager]);
        if (missingManagers.length > 0) {
            console.warn(`⚠️ 一部Manager初期化未完了: ${missingManagers.join(', ')}`);
        } else {
            console.log('✅ 全根幹Manager初期化確認完了');
        }
    }

    /**
     * グローバルブリッジ設定（修正：レジストリ後の実行保証）
     */
    setupGlobalBridge() {
        console.log('🌉 グローバルブリッジ設定中...');
        
        try {
            // Tegaki → window ブリッジ（下位互換）
            const bridgeMap = [
                ['ErrorManagerInstance', 'ErrorManager'],
                ['EventBusInstance', 'EventBus'],
                ['StateManagerInstance', 'StateManager'],
                ['ConfigManagerInstance', 'ConfigManager'],
                ['CoordinateManagerInstance', 'CoordinateManager']
            ];
            
            bridgeMap.forEach(([tegakiKey, windowKey]) => {
                if (Tegaki[tegakiKey]) {
                    window[windowKey] = Tegaki[tegakiKey];
                    console.log(`✅ ブリッジ設定: ${tegakiKey} → window.${windowKey}`);
                } else {
                    console.warn(`⚠️ ブリッジ未設定: ${tegakiKey} が存在しません`);
                }
            });
            
            console.log('✅ グローバルブリッジ設定完了');
        } catch (error) {
            console.error('❌ グローバルブリッジ設定エラー:', error);
        }
    }

    /**
     * STEP 3: キャンバスシステム初期化（修正：null チェック強化）
     */
    async initializeCanvasSystem() {
        console.log('🎯 キャンバスシステム初期化中...');

        try {
            // キャンバスコンテナ取得（修正：複数ID対応）
            let container = document.querySelector("#canvas-container");
            if (!container) {
                container = document.querySelector("#drawing-canvas");
            }
            if (!container) {
                container = document.querySelector(".canvas-container");
            }
            
            if (!container) {
                throw new Error("Canvas container が見つかりません（#canvas-container, #drawing-canvas, .canvas-container）");
            }

            // CanvasManager利用（修正：存在確認強化）
            if (!Tegaki.CanvasManagerInstance) {
                throw new Error('CanvasManagerInstance が初期化されていません');
            }
            
            const initResult = Tegaki.CanvasManagerInstance.initialize(container, this.config.canvas);
            if (!initResult) {
                throw new Error('CanvasManager の初期化に失敗しました');
            }
            
            console.log('✅ CanvasManagerInstance 初期化完了');

            // CoordinateManager設定（修正：キャンバス要素確認強化）
            if (Tegaki.CoordinateManagerInstance) {
                // PIXIキャンバス要素を取得
                const pixiApp = Tegaki.CanvasManagerInstance.getPixiApp();
                if (pixiApp && pixiApp.view) {
                    Tegaki.CoordinateManagerInstance.setCanvasElement(pixiApp.view);
                    console.log('✅ CoordinateManagerInstance キャンバス設定完了');
                } else {
                    console.warn('⚠️ PIXI キャンバス要素が見つかりません');
                }
            }

            console.log('✅ キャンバスシステム初期化完了');
            
        } catch (error) {
            console.error('❌ キャンバスシステム初期化エラー:', error);
            throw error;
        }
    }

    /**
     * STEP 4: ツール登録（修正：初期化確認・エラーハンドリング強化）
     */
    async registerTools() {
        console.log('🔧 ツール登録中...');

        try {
            if (!Tegaki.ToolManagerInstance) {
                throw new Error('ToolManagerInstance が初期化されていません');
            }

            if (!Tegaki.CanvasManagerInstance) {
                throw new Error('CanvasManagerInstance が初期化されていません');
            }

            if (!Tegaki.CoordinateManagerInstance) {
                throw new Error('CoordinateManagerInstance が初期化されていません');
            }

            // ToolManager に CanvasManager と CoordinateManager を設定
            const toolInitResult = Tegaki.ToolManagerInstance.initialize(
                Tegaki.CanvasManagerInstance,
                Tegaki.CoordinateManagerInstance
            );
            
            if (!toolInitResult) {
                throw new Error('ToolManager の初期化に失敗しました');
            }

            // デフォルトツール設定（修正：利用可能ツール確認後に実行）
            const availableTools = Tegaki.ToolManagerInstance.getAvailableTools();
            console.log('🔧 利用可能ツール:', availableTools);
            
            if (availableTools.length > 0) {
                const defaultTool = availableTools.includes('pen') ? 'pen' : availableTools[0];
                const setResult = Tegaki.ToolManagerInstance.setTool(defaultTool);
                if (setResult) {
                    console.log(`✅ デフォルトツール設定完了: ${defaultTool}`);
                } else {
                    console.warn(`⚠️ デフォルトツール設定失敗: ${defaultTool}`);
                }
            } else {
                console.warn('⚠️ 利用可能なツールがありません');
            }

            console.log('✅ ツール登録完了');
            
        } catch (error) {
            console.error('❌ ツール登録エラー:', error);
            throw error;
        }
    }

    /**
     * STEP 5: イベント統合（座標バグ完全対策）
     */
    bindEvents() {
        console.log('🔗 イベント統合中...');

        try {
            const container = document.querySelector("#canvas-container") || 
                            document.querySelector("#drawing-canvas") ||
                            document.querySelector(".canvas-container");
            
            if (!container || !Tegaki.EventBusInstance) {
                console.warn('⚠️ コンテナまたはEventBusが見つかりません');
                return;
            }

            // ポインターイベント統合（座標バグの修正対象）
            container.addEventListener("pointerdown", (e) => {
                this.handlePointerEvent(e, 'pointerdown');
            });

            container.addEventListener("pointermove", (e) => {
                this.handlePointerEvent(e, 'pointermove');
            });

            container.addEventListener("pointerup", (e) => {
                this.handlePointerEvent(e, 'pointerup');
            });

            console.log('✅ イベント統合完了');
            
        } catch (error) {
            console.error('❌ イベント統合エラー:', error);
        }
    }

    /**
     * ポインターイベント処理（修正：エラーハンドリング強化）
     */
    handlePointerEvent(event, eventType) {
        try {
            // CoordinateManagerで座標抽出（バグ修正の要）
            if (!Tegaki.CoordinateManagerInstance) {
                console.warn('⚠️ CoordinateManager が利用できません');
                return;
            }

            const container = event.currentTarget;
            const rect = container.getBoundingClientRect();
            const pixiApp = Tegaki.CanvasManagerInstance?.getPixiApp();

            const coordInfo = Tegaki.CoordinateManagerInstance.extractPointerCoordinates(
                event, 
                rect, 
                pixiApp
            );
            
            if (coordInfo && Tegaki.EventBusInstance) {
                // EventBus経由で通知（疎結合）
                Tegaki.EventBusInstance.emit(`canvas:${eventType}`, {
                    event: event,
                    coordinates: coordInfo,
                    timestamp: Date.now()
                });

                // ToolManagerに委譲
                if (Tegaki.ToolManagerInstance) {
                    Tegaki.ToolManagerInstance.handlePointerEvent(event, eventType);
                }

                // ステータス更新
                if (eventType === 'pointermove') {
                    this.updateCoordinateDisplay(coordInfo.x, coordInfo.y);
                }
            }
        } catch (error) {
            console.error(`❌ ${eventType} イベント処理エラー:`, error);
            if (Tegaki.ErrorManagerInstance) {
                Tegaki.ErrorManagerInstance.handle(error, `TegakiApplication.${eventType}`);
            }
        }
    }

    /**
     * STEP 6: UI・ポップアップ初期化（ふたば保持）
     */
    initializeUI() {
        console.log('🎨 UI・ポップアップ初期化中...');

        try {
            // ツールボタンイベント設定
            this.setupToolButtons();

            // ポップアップシステム設定（保持対象）
            this.setupPopupSystems();

            // ドラッグ可能ポップアップ設定
            this.setupDraggablePopups();

            // ステータスパネル初期化
            this.initializeStatusPanel();

            console.log('✅ UI・ポップアップ初期化完了');
            
        } catch (error) {
            console.error('❌ UI初期化エラー:', error);
        }
    }

    /**
     * ツールボタンイベント設定（修正：エラーハンドリング追加）
     */
    setupToolButtons() {
        try {
            // ペンツールボタン
            const penTool = document.getElementById('pen-tool');
            if (penTool) {
                penTool.addEventListener('click', () => {
                    if (Tegaki.ToolManagerInstance) {
                        const result = Tegaki.ToolManagerInstance.setTool('pen');
                        if (result) {
                            this.setActiveToolButton('pen-tool');
                            this.updateCurrentTool('ペン');
                        }
                    }
                });
            }

            // 消しゴムツールボタン
            const eraserTool = document.getElementById('eraser-tool');
            if (eraserTool) {
                eraserTool.addEventListener('click', () => {
                    if (Tegaki.ToolManagerInstance) {
                        const result = Tegaki.ToolManagerInstance.setTool('eraser');
                        if (result) {
                            this.setActiveToolButton('eraser-tool');
                            this.updateCurrentTool('消しゴム');
                        } else {
                            console.warn('⚠️ 消しゴムツールの切り替えに失敗しました');
                        }
                    }
                });
            }

            // ポップアップ付きツールボタン
            this.setupPopupButtons();
            
        } catch (error) {
            console.error('❌ ツールボタン設定エラー:', error);
        }
    }

    /**
     * ポップアップボタン設定
     */
    setupPopupButtons() {
        const popupTools = [
            { toolId: 'pen-tool', popupId: 'pen-settings' },
            { toolId: 'resize-tool', popupId: 'resize-settings' }
        ];
        
        popupTools.forEach(({toolId, popupId}) => {
            const toolButton = document.getElementById(toolId);
            const popup = document.getElementById(popupId);
            
            if (toolButton && popup) {
                toolButton.addEventListener('dblclick', (e) => {
                    const isVisible = popup.style.display !== 'none';
                    popup.style.display = isVisible ? 'none' : 'block';
                    console.log(`📋 ${popupId} ${isVisible ? '非表示' : '表示'}`);
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
        try {
            // サイズプリセット
            const sizePresets = panel.querySelectorAll('.size-preset-item');
            sizePresets.forEach(preset => {
                preset.addEventListener('click', () => {
                    const size = parseFloat(preset.getAttribute('data-size'));
                    if (size && Tegaki.ToolManagerInstance) {
                        Tegaki.ToolManagerInstance.updateToolSetting('pen', 'size', size);
                        
                        // アクティブ表示切り替え
                        sizePresets.forEach(p => p.classList.remove('active'));
                        preset.classList.add('active');
                    }
                });
            });

            // スライダー設定（サイズ・不透明度・筆圧・線補正）
            this.setupSliderControls(panel);
            
        } catch (error) {
            console.error('❌ ペンツール設定エラー:', error);
        }
    }

    /**