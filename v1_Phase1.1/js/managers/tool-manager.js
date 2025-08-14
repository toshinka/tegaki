/**
 * 🛠️ ツール統括マネージャー - 描画ツール管理
 * 🎯 AI_WORK_SCOPE: ツール切り替え・描画制御・設定管理
 * 🎯 DEPENDENCIES: main.js, app-core.js, ui-manager.js
 * 🎯 CDN_USAGE: PIXI（描画）, Lodash（設定管理）
 * 🎯 ISOLATION_TEST: ✅ ツール単体テスト可能
 * 🎯 SPLIT_THRESHOLD: 300行超過時 → tool-settings.js分割
 * 
 * 📋 PHASE_TARGET: Phase1-2対応
 * 📋 V8_MIGRATION: PIXI Graphics API変更対応予定
 * 📋 PERFORMANCE_TARGET: ツール切り替え50ms以内
 */

export class ToolManager {
    constructor(appCore, uiManager) {
        this.appCore = appCore;
        this.uiManager = uiManager;
        this.app = appCore.app;
        
        // ツール管理
        this.tools = new Map();
        this.currentTool = null;
        this.currentToolName = 'pen';
        
        // 描画状態
        this.isDrawing = false;
        this.currentPath = null;
        this.lastPoint = null;
        
        // 設定管理
        this.settings = {
            pen: {
                size: 16.0,
                color: 0x800000,
                opacity: 0.85,
                pressure: 0.5,
                smoothing: 0.3
            },
            eraser: {
                size: 20.0,
                opacity: 1.0
            }
        };
        
        // Canvas Manager参照（後で設定）
        this.canvasManager = null;
        
        console.log('🛠️ ToolManager初期化完了');
    }

    /**
     * Canvas Manager参照設定
     */
    setCanvasManager(canvasManager) {
        this.canvasManager = canvasManager;
    }

    /**
     * ツール初期化・登録
     */
    async initializeTools() {
        console.log('🔧 ツール初期化開始');
        
        // ペンツール読み込み・登録
        const { PenTool } = await import('../tools/pen-tool.js');
        const penTool = new PenTool(this);
        this.tools.set('pen', penTool);
        
        // 消しゴムツール読み込み・登録
        const { EraserTool } = await import('../tools/eraser-tool.js');
        const eraserTool = new EraserTool(this);
        this.tools.set('eraser', eraserTool);
        
        // デフォルトツール設定
        this.setCurrentTool('pen');
        
        // 描画イベント設定
        this.setupDrawingEvents();
        
        console.log('✅ ツール初期化完了:', Array.from(this.tools.keys()));
    }

    /**
     * 現在のツール設定
     */
    setCurrentTool(toolName) {
        if (!this.tools.has(toolName)) {
            console.warn(`⚠️ ツール ${toolName} が見つかりません`);
            return;
        }

        // 前のツール終了処理
        if (this.currentTool && this.currentTool.onDeactivate) {
            this.currentTool.onDeactivate();
        }

        // 新しいツール設定
        this.currentTool = this.tools.get(toolName);
        this.currentToolName = toolName;

        // 新しいツール開始処理
        if (this.currentTool.onActivate) {
            this.currentTool.onActivate();
        }

        // UI更新
        this.updateToolUI();

        console.log(`🔄 ツール切り替え: ${toolName}`);
    }

    /**
     * 描画イベント設定
     */
    setupDrawingEvents() {
        if (!this.app || !this.app.stage) {
            console.error('❌ PixiJS Appが初期化されていません');
            return;
        }

        const target = this.appCore.viewport || this.app.stage;

        // ポインタダウン（描画開始）
        target.on('pointerdown', (event) => {
            if (this.shouldIgnoreEvent(event)) return;
            
            const point = this.getDrawingPoint(event);
            this.startDrawing(point.x, point.y);
        });

        // ポインタムーブ（描画継続）
        target.on('pointermove', (event) => {
            const point = this.getDrawingPoint(event);
            
            // 座標更新
            this.uiManager.updateCoordinates(point.x, point.y);
            
            // 描画継続
            if (this.isDrawing) {
                this.continueDrawing(point.x, point.y);
            }
        });

        // ポインタアップ（描画終了）
        target.on('pointerup', () => {
            this.stopDrawing();
        });

        // ポインタアウト（描画終了）
        target.on('pointerupoutside', () => {
            this.stopDrawing();
        });

        console.log('✅ 描画イベント設定完了');
    }

    /**
     * 描画ポイント取得
     */
    getDrawingPoint(event) {
        if (this.appCore.viewport) {
            // Viewport使用時
            return this.appCore.viewport.toWorld(event.data.global);
        } else {
            // 基本キャンバス使用時
            const rect = this.app.view.getBoundingClientRect();
            const originalEvent = event.data.originalEvent;
            return {
                x: (originalEvent.clientX - rect.left) * (this.appCore.settings.width / rect.width),
                y: (originalEvent.clientY - rect.top) * (this.appCore.settings.height / rect.height)
            };
        }
    }

    /**
     * イベント無視判定
     */
    shouldIgnoreEvent(event) {
        // ポップアップが開いている場合は無視
        if (this.uiManager.activePopup) {
            return true;
        }

        // 右クリック等は無視（Viewport操作用）
        const originalEvent = event.data.originalEvent;
        if (originalEvent && originalEvent.button !== 0) {
            return true;
        }

        return false;
    }

    /**
     * 描画開始
     */
    startDrawing(x, y) {
        if (!this.currentTool) return;

        this.isDrawing = true;
        this.lastPoint = { x, y };

        // ツール固有の開始処理
        if (this.currentTool.startDrawing) {
            this.currentPath = this.currentTool.startDrawing(x, y);
        }

        // 筆圧監視更新
        this.updatePressureMonitor(0.5);

        console.log(`🖊️ 描画開始: ${this.currentToolName} at (${x}, ${y})`);
    }

    /**
     * 描画継続
     */
    continueDrawing(x, y) {
        if (!this.isDrawing || !this.currentTool) return;

        // 距離チェック（最小移動距離フィルター）
        if (this.lastPoint) {
            const distance = Math.sqrt(
                Math.pow(x - this.lastPoint.x, 2) + Math.pow(y - this.lastPoint.y, 2)
            );
            
            if (distance < 1.0) return; // 1px未満の移動は無視
        }

        // ツール固有の継続処理
        if (this.currentTool.continueDrawing) {
            this.currentTool.continueDrawing(x, y);
        }

        this.lastPoint = { x, y };

        // 筆圧監視更新（シミュレート）
        const pressure = this.calculateSimulatedPressure();
        this.updatePressureMonitor(pressure);
    }

    /**
     * 描画終了
     */
    stopDrawing() {
        if (!this.isDrawing) return;

        // ツール固有の終了処理
        if (this.currentTool && this.currentTool.stopDrawing) {
            this.currentTool.stopDrawing();
        }

        this.isDrawing = false;
        this.currentPath = null;
        this.lastPoint = null;

        // 筆圧監視リセット
        this.updatePressureMonitor(0);

        console.log(`🖊️ 描画終了: ${this.currentToolName}`);
    }

    /**
     * ツール設定更新
     */
    updateToolSettings(toolName, settings) {
        if (this.settings[toolName]) {
            // Lodash活用（利用可能な場合）
            if (window._ && _.merge) {
                _.merge(this.settings[toolName], settings);
            } else {
                Object.assign(this.settings[toolName], settings);
            }
            
            console.log(`🔧 ${toolName}ツール設定更新:`, settings);
            
            // 現在のツールの場合は即座に反映
            if (toolName === this.currentToolName && this.currentTool.updateSettings) {
                this.currentTool.updateSettings(this.settings[toolName]);
            }
        }
    }

    /**
     * ツール設定取得
     */
    getToolSettings(toolName) {
        return this.settings[toolName] || {};
    }

    /**
     * 現在のツール設定取得
     */
    getCurrentToolSettings() {
        return this.getToolSettings(this.currentToolName);
    }

    /**
     * UI更新
     */
    updateToolUI() {
        // ステータス更新
        this.uiManager.updateToolStatus(this.currentToolName);
        
        // 色情報更新
        const settings = this.getCurrentToolSettings();
        if (settings.color !== undefined) {
            const colorHex = '#' + settings.color.toString(16).padStart(6, '0');
            const colorElement = this.uiManager.statusElements.get('current-color');
            if (colorElement) {
                colorElement.textContent = colorHex;
            }
        }
    }

    /**
     * 筆圧監視更新
     */
    updatePressureMonitor(pressure) {
        const pressureElement = this.uiManager.statusElements.get('pressure-monitor');
        if (pressureElement) {
            pressureElement.textContent = (pressure * 100).toFixed(1) + '%';
        }
    }

    /**
     * 筆圧シミュレート計算
     */
    calculateSimulatedPressure() {
        if (!this.lastPoint || !this.isDrawing) return 0;
        
        // 簡易筆圧シミュレート（速度ベース）
        const baseSettings = this.getCurrentToolSettings();
        const basePressure = baseSettings.pressure || 0.5;
        
        // ランダム要素追加（より自然な筆圧表現）
        const randomFactor = 0.8 + (Math.random() * 0.4); // 0.8-1.2
        
        return Math.min(1.0, basePressure * randomFactor);
    }

    /**
     * ブラシサイズ変更（ショートカット用）
     */
    changeBrushSize(delta) {
        const currentSettings = this.getCurrentToolSettings();
        if (currentSettings.size !== undefined) {
            const newSize = Math.max(0.1, Math.min(100, currentSettings.size + delta));
            this.updateToolSettings(this.currentToolName, { size: newSize });
            
            console.log(`🔧 ブラシサイズ変更: ${currentSettings.size} → ${newSize}`);
        }
    }

    /**
     * 透明度変更
     */
    changeOpacity(delta) {
        const currentSettings = this.getCurrentToolSettings();
        if (currentSettings.opacity !== undefined) {
            const newOpacity = Math.max(0.1, Math.min(1.0, currentSettings.opacity + delta));
            this.updateToolSettings(this.currentToolName, { opacity: newOpacity });
            
            console.log(`🔧 透明度変更: ${(currentSettings.opacity * 100).toFixed(1)}% → ${(newOpacity * 100).toFixed(1)}%`);
        }
    }

    /**
     * 色変更
     */
    changeColor(color) {
        this.updateToolSettings(this.currentToolName, { color: color });
        this.updateToolUI();
        console.log(`🎨 色変更: ${color.toString(16)}`);
    }

    /**
     * キーボードショートカット処理
     */
    handleKeyboardShortcut(event) {
        switch (event.key) {
            case '[':
                event.preventDefault();
                this.changeBrushSize(-1);
                break;
                
            case ']':
                event.preventDefault();
                this.changeBrushSize(1);
                break;
                
            case 'p':
                event.preventDefault();
                this.setCurrentTool('pen');
                this.uiManager.setActiveTool('pen');
                break;
                
            case 'e':
                event.preventDefault();
                this.setCurrentTool('eraser');
                this.uiManager.setActiveTool('eraser');
                break;
        }
    }

    /**
     * 全描画クリア
     */
    clearAll() {
        if (this.appCore && this.appCore.clearDrawing) {
            this.appCore.clearDrawing();
            console.log('🗑️ 全描画クリア');
        }
    }

    /**
     * Phase2準備: レイヤー対応
     */
    prepareLayerSupport() {
        // 📋 Phase2: レイヤー対応ツール機能実装予定
        console.log('📋 Phase2準備: レイヤー対応ツール機能');
    }

    /**
     * Phase2準備: 高度ツール読み込み
     */
    async loadAdvancedTools() {
        // 📋 Phase2: バケツツール、選択ツール等の動的読み込み予定
        console.log('📋 Phase2準備: 高度ツール動的読み込み');
        
        // const { BucketTool } = await import('../tools/bucket-tool.js');
        // const { SelectionTool } = await import('../tools/selection-tool.js');
    }

    /**
     * リソース解放
     */
    destroy() {
        // 描画中の場合は終了
        if (this.isDrawing) {
            this.stopDrawing();
        }

        // ツール個別リソース解放
        this.tools.forEach(tool => {
            if (tool.destroy) {
                tool.destroy();
            }
        });

        this.tools.clear();
        this.currentTool = null;

        console.log('🗑️ ToolManager リソース解放完了');
    }
}