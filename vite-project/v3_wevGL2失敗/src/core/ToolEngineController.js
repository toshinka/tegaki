/**
 * ToolEngineController.js - Phase2-A ツール・エンジン厳格連動制御
 * 責務: ツール選択 = エンジン起動の唯一トリガー（曖昧さ完全排除）
 * 
 * 🚨 重要原則:
 * - ペンツール = Bezier.jsエンジン 物理的強制連動
 * - ツール切り替え = エンジン完全切り替え
 * - Canvas2D誘惑の完全遮断
 */

export class ToolEngineController {
    constructor(container) {
        this.container = container;
        this.currentTool = 'pen';
        this.currentEngine = null;
        this.engineStates = new Map();
        
        // エンジン固定マッピング（Phase2-A: ペン=Bezier.js強制）
        // 🔧 修正: main.jsの登録名と一致させる
        this.toolEngineMapping = {
            'pen': 'BezierStrokeRenderer',      // 🎯 ペン = Bezier.js（強制・変更不可）
            'brush': 'Canvas2DRenderer',        // ブラシ = Canvas2D
            'eraser': 'Canvas2DRenderer'        // 消しゴム = Canvas2D
        };

        this.initializeController();
    }

    /**
     * コントローラー初期化
     */
    initializeController() {
        // デフォルトツール（ペン）を強制設定
        this.switchToTool('pen');
        console.log('✅ ToolEngineController: 初期化完了（デフォルト: ペンツール）');
    }

    /**
     * ツール切り替え（エンジン厳格連動）
     * 🚨 これが唯一のエンジン切り替えトリガー
     */
    switchToTool(toolName) {
        if (!this.toolEngineMapping[toolName]) {
            console.error(`❌ ToolEngineController: 未対応ツール "${toolName}"`);
            return false;
        }

        // 現在のエンジンを無効化
        if (this.currentEngine) {
            // 🔧 修正: deactivateメソッドの存在確認
            if (typeof this.currentEngine.deactivate === 'function') {
                this.currentEngine.deactivate();
            }
            console.log(`🔄 ToolEngineController: ${this.currentTool} エンジン無効化`);
        }

        // ツール・エンジン切り替え
        const previousTool = this.currentTool;
        this.currentTool = toolName;
        const engineKey = this.toolEngineMapping[toolName];
        
        try {
            this.currentEngine = this.container.resolve(engineKey);
            
            // 🔧 修正: activateメソッドの存在確認
            if (typeof this.currentEngine.activate === 'function') {
                this.currentEngine.activate();
            }
            
            // ツール設定復元
            this.restoreToolSettings(toolName);
            
            console.log(`✅ ToolEngineController: ${previousTool} → ${toolName} 切り替え完了`);
            console.log(`🎯 ToolEngineController: ${engineKey} エンジン起動`);
            
            // イベント発火（UI更新用）
            this.fireToolChangeEvent(previousTool, toolName);
            
            return true;
            
        } catch (error) {
            console.error(`❌ ToolEngineController: エンジン切り替え失敗`, error);
            return false;
        }
    }

    /**
     * 現在ツール取得
     */
    getCurrentTool() {
        return this.currentTool;
    }

    /**
     * 現在エンジン取得
     */
    getCurrentEngine() {
        return this.currentEngine;
    }

    /**
     * ツール設定更新（現在のエンジンに反映）
     */
    updateCurrentToolSettings(settings) {
        if (!this.currentEngine) {
            console.warn('⚠️ ToolEngineController: アクティブエンジンが存在しません');
            return;
        }

        // エンジンに設定反映
        if (typeof this.currentEngine.updateSettings === 'function') {
            this.currentEngine.updateSettings(settings);
        }
        
        // ツール状態保存
        this.saveToolSettings(this.currentTool, settings);
        
        console.log(`🔧 ToolEngineController: ${this.currentTool} 設定更新`, settings);
    }

    /**
     * 描画開始
     */
    startStroke(x, y, pressure) {
        if (!this.currentEngine) {
            console.error('❌ ToolEngineController: アクティブエンジンが存在しません');
            return;
        }

        if (typeof this.currentEngine.startStroke === 'function') {
            this.currentEngine.startStroke(x, y, pressure);
        }
        console.log(`🎨 ToolEngineController: ${this.currentTool} 描画開始 (${x}, ${y})`);
    }

    /**
     * 描画継続
     */
    continueStroke(x, y, pressure) {
        if (!this.currentEngine) return;
        if (typeof this.currentEngine.continueStroke === 'function') {
            this.currentEngine.continueStroke(x, y, pressure);
        }
    }

    /**
     * 描画終了
     */
    endStroke() {
        if (!this.currentEngine) return;
        if (typeof this.currentEngine.endStroke === 'function') {
            this.currentEngine.endStroke();
        }
        console.log(`🏁 ToolEngineController: ${this.currentTool} 描画終了`);
    }

    /**
     * 🆕 ポインターイベント統一処理
     */
    handlePointerDown(pointerData) {
        this.startStroke(pointerData.x, pointerData.y, pointerData.pressure);
    }

    handlePointerMove(pointerData) {
        this.continueStroke(pointerData.x, pointerData.y, pointerData.pressure);
    }

    handlePointerUp() {
        this.endStroke();
    }

    /**
     * ツール設定保存
     */
    saveToolSettings(toolName, settings) {
        if (!this.engineStates.has(toolName)) {
            this.engineStates.set(toolName, {});
        }
        
        const currentState = this.engineStates.get(toolName);
        this.engineStates.set(toolName, { ...currentState, ...settings });
    }

    /**
     * ツール設定復元
     */
    restoreToolSettings(toolName) {
        if (!this.engineStates.has(toolName)) {
            // デフォルト設定を適用
            const defaultSettings = this.getDefaultSettings(toolName);
            if (typeof this.currentEngine.updateSettings === 'function') {
                this.currentEngine.updateSettings(defaultSettings);
            }
            this.engineStates.set(toolName, defaultSettings);
        } else {
            const savedSettings = this.engineStates.get(toolName);
            if (typeof this.currentEngine.updateSettings === 'function') {
                this.currentEngine.updateSettings(savedSettings);
            }
        }
    }

    /**
     * デフォルト設定取得
     */
    getDefaultSettings(toolName) {
        const defaults = {
            pen: { size: 3, opacity: 1.0, color: '#800000' },
            brush: { size: 10, opacity: 0.8, color: '#800000' },
            eraser: { size: 15, opacity: 1.0 }
        };
        return defaults[toolName] || {};
    }

    /**
     * ツール変更イベント発火
     */
    fireToolChangeEvent(previousTool, newTool) {
        const event = new CustomEvent('toolChange', {
            detail: { previousTool, newTool, controller: this }
        });
        document.dispatchEvent(event);
    }

    /**
     * エンジンマッピング取得（デバッグ用）
     */
    getToolEngineMapping() {
        return { ...this.toolEngineMapping };
    }

    /**
     * 利用可能ツール一覧
     */
    getAvailableTools() {
        return Object.keys(this.toolEngineMapping);
    }

    /**
     * ツール・エンジン対応確認
     */
    isToolSupported(toolName) {
        return this.toolEngineMapping.hasOwnProperty(toolName);
    }

    /**
     * 現在状態取得（デバッグ用）
     */
    getCurrentState() {
        return {
            currentTool: this.currentTool,
            currentEngine: this.currentEngine?.constructor?.name || 'none',
            engineStates: Object.fromEntries(this.engineStates),
            toolEngineMapping: this.toolEngineMapping
        };
    }

    /**
     * デバッグ情報出力
     */
    debugInfo() {
        const state = this.getCurrentState();
        console.log('🔍 ToolEngineController Debug Info:');
        console.log('  現在ツール:', state.currentTool);
        console.log('  現在エンジン:', state.currentEngine);
        console.log('  エンジンマッピング:', state.toolEngineMapping);
        console.log('  保存された設定:', state.engineStates);
        return state;
    }
}