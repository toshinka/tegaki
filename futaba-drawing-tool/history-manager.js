/**
 * 🎨 ふたば☆ちゃんねる風ベクターお絵描きツール v1.2
 * 履歴管理システム - history-manager.js
 * 
 * 責務: アンドゥ・リドゥ・履歴管理
 * 依存: app-core.js, drawing-tools.js
 * 
 * 設計思想:
 * 1. 操作の種類に応じたカテゴライズ（描画、プリセット変更、キャンバスリサイズ等）
 * 2. 操作前後の状態をデータとして保存
 * 3. サムネイル画像による視覚的な履歴管理（将来実装）
 * 4. 最大履歴数制限によるメモリ使用量制御
 */

// ==== 履歴管理定数 ====
const HISTORY_CONFIG = {
    MAX_HISTORY_SIZE: 50,              // 最大履歴保存数
    THUMBNAIL_SIZE: 64,                // サムネイルサイズ（将来実装）
    AUTO_SAVE_INTERVAL: 1000,          // 自動保存間隔（ms）
    DEBUG_MODE: false                  // デバッグモード
};

const HISTORY_TYPES = {
    DRAWING: 'drawing',                // 描画操作
    PRESET_CHANGE: 'preset_change',    // プリセット変更
    CANVAS_RESIZE: 'canvas_resize',    // キャンバスリサイズ
    TOOL_CHANGE: 'tool_change',        // ツール変更
    BRUSH_SETTING: 'brush_setting',    // ブラシ設定変更
    CLEAR_CANVAS: 'clear_canvas',      // キャンバスクリア
    LAYER_OPERATION: 'layer_operation' // レイヤー操作（将来実装）
};

// ==== 履歴エントリクラス ====
class HistoryEntry {
    constructor(type, data, description = null) {
        this.id = Date.now() + Math.random().toString(36).substr(2, 9);
        this.timestamp = Date.now();
        this.type = type;
        this.data = data;
        this.description = description || this.generateDescription(type, data);
        this.thumbnail = null; // 将来実装用
    }
    
    /**
     * 履歴エントリの説明を自動生成
     */
    generateDescription(type, data) {
        switch (type) {
            case HISTORY_TYPES.DRAWING:
                return `描画: ${data.toolName || 'ペン'}ツール`;
            case HISTORY_TYPES.PRESET_CHANGE:
                return `プリセット変更: サイズ${data.after?.size || '不明'}`;
            case HISTORY_TYPES.CANVAS_RESIZE:
                return `キャンバス: ${data.after?.width}×${data.after?.height}px`;
            case HISTORY_TYPES.TOOL_CHANGE:
                return `ツール: ${data.after || '不明'}に切り替え`;
            case HISTORY_TYPES.BRUSH_SETTING:
                return `ブラシ設定変更`;
            case HISTORY_TYPES.CLEAR_CANVAS:
                return `キャンバスクリア`;
            default:
                return `操作: ${type}`;
        }
    }
}

// ==== 状態キャプチャユーティリティ ====
class StateCapture {
    /**
     * 描画状態をキャプチャ
     */
    static captureDrawingState(app) {
        if (!app || !app.layers) return null;
        
        try {
            // RenderTextureを使用してキャンバス状態をキャプチャ
            const renderTexture = PIXI.RenderTexture.create({
                width: app.app.screen.width,
                height: app.app.screen.height,
                resolution: app.app.renderer.resolution
            });
            
            app.app.renderer.render(app.layers.drawingLayer, { renderTexture });
            
            return {
                renderTexture: renderTexture,
                width: app.app.screen.width,
                height: app.app.screen.height,
                resolution: app.app.renderer.resolution,
                timestamp: Date.now()
            };
        } catch (error) {
            console.warn('描画状態キャプチャに失敗:', error);
            return null;
        }
    }
    
    /**
     * プリセット状態をキャプチャ
     */
    static capturePresetState(presetManager) {
        if (!presetManager) return null;
        
        return {
            activePresetId: presetManager.getActivePresetId(),
            activePreset: { ...presetManager.getActivePreset() },
            currentLiveValues: presetManager.currentLiveValues ? 
                { ...presetManager.currentLiveValues } : null
        };
    }
    
    /**
     * ブラシ設定をキャプチャ
     */
    static captureBrushSettings(toolsSystem) {
        if (!toolsSystem) return null;
        
        return {
            ...toolsSystem.getBrushSettings(),
            currentTool: toolsSystem.getCurrentTool()
        };
    }
    
    /**
     * キャンバス設定をキャプチャ
     */
    static captureCanvasSettings(app) {
        if (!app) return null;
        
        return {
            width: app.app.screen.width,
            height: app.app.screen.height,
            backgroundColor: app.CONFIG.BG_COLOR,
            resolution: app.app.renderer.resolution
        };
    }
}

// ==== 履歴復元ユーティリティ ====
class StateRestore {
    /**
     * 描画状態を復元
     */
    static restoreDrawingState(app, capturedState) {
        if (!app || !capturedState || !capturedState.renderTexture) return false;
        
        try {
            // 現在の描画レイヤーをクリア
            app.layers.drawingLayer.removeChildren();
            
            // キャプチャされたRenderTextureからスプライトを作成
            const sprite = new PIXI.Sprite(capturedState.renderTexture);
            app.layers.drawingLayer.addChild(sprite);
            
            console.log('描画状態復元完了');
            return true;
        } catch (error) {
            console.error('描画状態復元に失敗:', error);
            return false;
        }
    }
    
    /**
     * プリセット状態を復元
     */
    static restorePresetState(presetManager, uiManager, capturedState) {
        if (!presetManager || !capturedState) return false;
        
        try {
            // プリセット選択を復元
            if (capturedState.activePresetId) {
                presetManager.selectPreset(capturedState.activePresetId);
            }
            
            // ライブ値を復元
            if (capturedState.currentLiveValues) {
                presetManager.currentLiveValues = { ...capturedState.currentLiveValues };
            }
            
            // UI表示を更新
            if (uiManager && uiManager.updatePresetsDisplay) {
                uiManager.updatePresetsDisplay();
            }
            
            console.log('プリセット状態復元完了');
            return true;
        } catch (error) {
            console.error('プリセット状態復元に失敗:', error);
            return false;
        }
    }
    
    /**
     * ブラシ設定を復元
     */
    static restoreBrushSettings(toolsSystem, uiManager, capturedState) {
        if (!toolsSystem || !capturedState) return false;
        
        try {
            // ツール変更
            if (capturedState.currentTool) {
                toolsSystem.setTool(capturedState.currentTool);
            }
            
            // ブラシ設定更新
            toolsSystem.updateBrushSettings({
                size: capturedState.size,
                opacity: capturedState.opacity,
                color: capturedState.color,
                pressure: capturedState.pressure,
                smoothing: capturedState.smoothing
            });
            
            // UI同期
            if (uiManager) {
                if (uiManager.updateSliderValue) {
                    uiManager.updateSliderValue('pen-size-slider', capturedState.size);
                    uiManager.updateSliderValue('pen-opacity-slider', capturedState.opacity * 100);
                    uiManager.updateSliderValue('pen-pressure-slider', (capturedState.pressure || 0.5) * 100);
                    uiManager.updateSliderValue('pen-smoothing-slider', (capturedState.smoothing || 0.3) * 100);
                }
                
                if (uiManager.updateStatusBar) {
                    uiManager.updateStatusBar({ 
                        tool: capturedState.currentTool, 
                        color: capturedState.color 
                    });
                }
            }
            
            console.log('ブラシ設定復元完了');
            return true;
        } catch (error) {
            console.error('ブラシ設定復元に失敗:', error);
            return false;
        }
    }
    
    /**
     * キャンバス設定を復元
     */
    static restoreCanvasSettings(app, uiManager, capturedState) {
        if (!app || !capturedState) return false;
        
        try {
            // キャンバスサイズを変更
            app.resize(capturedState.width, capturedState.height, false);
            
            // UI更新
            if (uiManager && uiManager.updateStatusBar) {
                uiManager.updateStatusBar({
                    canvasInfo: { 
                        width: capturedState.width, 
                        height: capturedState.height 
                    }
                });
            }
            
            console.log('キャンバス設定復元完了');
            return true;
        } catch (error) {
            console.error('キャンバス設定復元に失敗:', error);
            return false;
        }
    }
}

// ==== メイン履歴管理クラス ====
class HistoryManager {
    constructor(app, toolsSystem, uiManager = null, maxHistorySize = HISTORY_CONFIG.MAX_HISTORY_SIZE) {
        this.app = app;
        this.toolsSystem = toolsSystem;
        this.uiManager = uiManager;
        this.maxHistorySize = maxHistorySize;
        
        // 履歴管理
        this.history = [];
        this.currentIndex = -1;
        this.isRecording = true;
        this.isRestoring = false;
        
        // 統計情報
        this.stats = {
            totalRecorded: 0,
            undoCount: 0,
            redoCount: 0,
            memoryUsage: 0
        };
        
        console.log('🏛️ HistoryManager初期化完了');
        
        // 初期状態を記録
        this.recordInitialState();
    }
    
    // ==== 初期化メソッド ====
    
    /**
     * 初期状態の記録
     */
    recordInitialState() {
        try {
            const drawingState = StateCapture.captureDrawingState(this.app);
            const brushSettings = StateCapture.captureBrushSettings(this.toolsSystem);
            const canvasSettings = StateCapture.captureCanvasSettings(this.app);
            
            this.recordHistory(HISTORY_TYPES.DRAWING, {
                before: null,
                after: drawingState,
                brushSettings: brushSettings,
                canvasSettings: canvasSettings
            }, '初期状態');
            
            console.log('📝 初期状態記録完了');
        } catch (error) {
            console.warn('初期状態記録に失敗:', error);
        }
    }
    
    // ==== 履歴記録メソッド ====
    
    /**
     * 履歴エントリを記録
     */
    recordHistory(type, data, description = null) {
        if (!this.isRecording || this.isRestoring) return false;
        
        try {
            const historyEntry = new HistoryEntry(type, data, description);
            
            // 現在位置より後の履歴を削除（分岐した履歴の管理）
            if (this.currentIndex < this.history.length - 1) {
                const removedEntries = this.history.splice(this.currentIndex + 1);
                this.cleanupRemovedEntries(removedEntries);
            }
            
            // 新しい履歴を追加
            this.history.push(historyEntry);
            this.currentIndex++;
            
            // 最大サイズを超えた場合は古い履歴を削除
            if (this.history.length > this.maxHistorySize) {
                const removed = this.history.shift();
                this.cleanupHistoryEntry(removed);
                this.currentIndex--;
            }
            
            // 統計更新
            this.stats.totalRecorded++;
            this.updateMemoryUsage();
            
            if (HISTORY_CONFIG.DEBUG_MODE) {
                console.log(`📚 履歴記録: ${type}`, {
                    id: historyEntry.id,
                    description: historyEntry.description,
                    index: this.currentIndex,
                    total: this.history.length
                });
            }
            
            return true;
            
        } catch (error) {
            console.error('履歴記録エラー:', error);
            return false;
        }
    }
    
    /**
     * 描画操作の記録
     */
    recordDrawingOperation(toolName, beforeState = null) {
        const afterState = StateCapture.captureDrawingState(this.app);
        const brushSettings = StateCapture.captureBrushSettings(this.toolsSystem);
        
        return this.recordHistory(HISTORY_TYPES.DRAWING, {
            toolName: toolName,
            before: beforeState,
            after: afterState,
            brushSettings: brushSettings
        });
    }
    
    /**
     * プリセット変更の記録
     */
    recordPresetChange(beforeState, afterState) {
        return this.recordHistory(HISTORY_TYPES.PRESET_CHANGE, {
            before: beforeState,
            after: afterState
        });
    }
    
    /**
     * ツール変更の記録
     */
    recordToolChange(beforeTool, afterTool) {
        return this.recordHistory(HISTORY_TYPES.TOOL_CHANGE, {
            before: beforeTool,
            after: afterTool
        });
    }
    
    /**
     * ブラシ設定変更の記録
     */
    recordBrushSettingChange(beforeSettings, afterSettings) {
        return this.recordHistory(HISTORY_TYPES.BRUSH_SETTING, {
            before: beforeSettings,
            after: afterSettings
        });
    }
    
    /**
     * キャンバスリサイズの記録
     */
    recordCanvasResize(beforeSize, afterSize) {
        const beforeDrawingState = StateCapture.captureDrawingState(this.app);
        
        return this.recordHistory(HISTORY_TYPES.CANVAS_RESIZE, {
            before: beforeSize,
            after: afterSize,
            drawingState: beforeDrawingState
        });
    }
    
    /**
     * キャンバスクリアの記録
     */
    recordCanvasClear() {
        const beforeState = StateCapture.captureDrawingState(this.app);
        
        return this.recordHistory(HISTORY_TYPES.CLEAR_CANVAS, {
            before: beforeState,
            after: null
        });
    }
    
    // ==== アンドゥ・リドゥメソッド ====
    
    /**
     * アンドゥ実行
     */
    undo() {
        if (!this.canUndo()) {
            console.log('アンドゥできません: 履歴がありません');
            return false;
        }
        
        try {
            this.isRestoring = true;
            
            const currentEntry = this.history[this.currentIndex];
            const success = this.applyHistoryEntry(currentEntry, 'undo');
            
            if (success) {
                this.currentIndex--;
                this.stats.undoCount++;
                
                console.log(`🔙 アンドゥ実行: ${currentEntry.description}`);
                
                // UI通知
                if (this.uiManager && this.uiManager.showNotification) {
                    this.uiManager.showNotification(`アンドゥ: ${currentEntry.description}`, 'info', 2000);
                }
                
                return true;
            }
            
            return false;
            
        } catch (error) {
            console.error('アンドゥ実行エラー:', error);
            return false;
        } finally {
            this.isRestoring = false;
        }
    }
    
    /**
     * リドゥ実行
     */
    redo() {
        if (!this.canRedo()) {
            console.log('リドゥできません: 履歴がありません');
            return false;
        }
        
        try {
            this.isRestoring = true;
            
            this.currentIndex++;
            const nextEntry = this.history[this.currentIndex];
            const success = this.applyHistoryEntry(nextEntry, 'redo');
            
            if (success) {
                this.stats.redoCount++;
                
                console.log(`🔜 リドゥ実行: ${nextEntry.description}`);
                
                // UI通知
                if (this.uiManager && this.uiManager.showNotification) {
                    this.uiManager.showNotification(`リドゥ: ${nextEntry.description}`, 'info', 2000);
                }
                
                return true;
            } else {
                this.currentIndex--; // 失敗時は戻す
                return false;
            }
            
        } catch (error) {
            console.error('リドゥ実行エラー:', error);
            this.currentIndex--; // エラー時も戻す
            return false;
        } finally {
            this.isRestoring = false;
        }
    }
    
    // ==== 履歴適用メソッド ====
    
    /**
     * 履歴エントリを適用
     */
    applyHistoryEntry(entry, direction) {
        if (!entry) return false;
        
        try {
            switch (entry.type) {
                case HISTORY_TYPES.DRAWING:
                    return this.applyDrawingChange(entry, direction);
                    
                case HISTORY_TYPES.PRESET_CHANGE:
                    return this.applyPresetChange(entry, direction);
                    
                case HISTORY_TYPES.TOOL_CHANGE:
                    return this.applyToolChange(entry, direction);
                    
                case HISTORY_TYPES.BRUSH_SETTING:
                    return this.applyBrushSettingChange(entry, direction);
                    
                case HISTORY_TYPES.CANVAS_RESIZE:
                    return this.applyCanvasResize(entry, direction);
                    
                case HISTORY_TYPES.CLEAR_CANVAS:
                    return this.applyClearCanvas(entry, direction);
                    
                default:
                    console.warn('未対応の履歴タイプ:', entry.type);
                    return false;
            }
        } catch (error) {
            console.error('履歴適用エラー:', error);
            return false;
        }
    }
    
    /**
     * 描画変更の適用
     */
    applyDrawingChange(entry, direction) {
        const targetState = direction === 'undo' ? entry.data.before : entry.data.after;
        
        if (!targetState) {
            // beforeがnullの場合はキャンバスクリア
            this.app.clear();
            return true;
        }
        
        return StateRestore.restoreDrawingState(this.app, targetState);
    }
    
    /**
     * プリセット変更の適用
     */
    applyPresetChange(entry, direction) {
        const targetState = direction === 'undo' ? entry.data.before : entry.data.after;
        
        if (!targetState) return false;
        
        const presetManager = this.toolsSystem.getPenPresetManager ? 
            this.toolsSystem.getPenPresetManager() : null;
        
        if (!presetManager) {
            console.warn('PenPresetManagerが見つかりません');
            return false;
        }
        
        return StateRestore.restorePresetState(presetManager, this.uiManager, targetState);
    }
    
    /**
     * ツール変更の適用
     */
    applyToolChange(entry, direction) {
        const targetTool = direction === 'undo' ? entry.data.before : entry.data.after;
        
        if (!targetTool) return false;
        
        const success = this.toolsSystem.setTool(targetTool);
        
        if (success && this.uiManager) {
            this.uiManager.updateStatusBar({ tool: targetTool });
        }
        
        return success;
    }
    
    /**
     * ブラシ設定変更の適用
     */
    applyBrushSettingChange(entry, direction) {
        const targetSettings = direction === 'undo' ? entry.data.before : entry.data.after;
        
        if (!targetSettings) return false;
        
        return StateRestore.restoreBrushSettings(this.toolsSystem, this.uiManager, targetSettings);
    }
    
    /**
     * キャンバスリサイズの適用
     */
    applyCanvasResize(entry, direction) {
        const targetSize = direction === 'undo' ? entry.data.before : entry.data.after;
        
        if (!targetSize) return false;
        
        return StateRestore.restoreCanvasSettings(this.app, this.uiManager, targetSize);
    }
    
    /**
     * キャンバスクリアの適用
     */
    applyClearCanvas(entry, direction) {
        if (direction === 'undo') {
            // クリア前の状態を復元
            return StateRestore.restoreDrawingState(this.app, entry.data.before);
        } else {
            // 再度クリア
            this.app.clear();
            return true;
        }
    }
    
    // ==== ユーティリティメソッド ====
    
    /**
     * アンドゥ可能かチェック
     */
    canUndo() {
        return this.currentIndex > 0;
    }
    
    /**
     * リドゥ可能かチェック
     */
    canRedo() {
        return this.currentIndex < this.history.length - 1;
    }
    
    /**
     * 記録状態の制御
     */
    setRecording(recording) {
        const wasRecording = this.isRecording;
        this.isRecording = recording;
        
        if (HISTORY_CONFIG.DEBUG_MODE) {
            console.log(`履歴記録: ${recording ? 'ON' : 'OFF'}`);
        }
        
        return wasRecording;
    }
    
    /**
     * 履歴のクリア
     */
    clearHistory() {
        this.cleanupRemovedEntries(this.history);
        this.history = [];
        this.currentIndex = -1;
        
        this.stats = {
            totalRecorded: 0,
            undoCount: 0,
            redoCount: 0,
            memoryUsage: 0
        };
        
        console.log('履歴をクリアしました');
    }
    
    /**
     * 履歴エントリのクリーンアップ
     */
    cleanupHistoryEntry(entry) {
        if (!entry) return;
        
        try {
            // RenderTextureのクリーンアップ
            if (entry.data) {
                if (entry.data.before?.renderTexture) {
                    entry.data.before.renderTexture.destroy(true);
                }
                if (entry.data.after?.renderTexture) {
                    entry.data.after.renderTexture.destroy(true);
                }
                if (entry.data.drawingState?.renderTexture) {
                    entry.data.drawingState.renderTexture.destroy(true);
                }
            }
        } catch (error) {
            console.warn('履歴エントリクリーンアップエラー:', error);
        }
    }
    
    /**
     * 複数の履歴エントリのクリーンアップ
     */
    cleanupRemovedEntries(entries) {
        if (!Array.isArray(entries)) return;
        
        entries.forEach(entry => this.cleanupHistoryEntry(entry));
    }
    
    /**
     * メモリ使用量の更新（概算）
     */
    updateMemoryUsage() {
        let usage = 0;
        
        this.history.forEach(entry => {
            // エントリの基本サイズ
            usage += JSON.stringify(entry).length;
            
            // RenderTextureのサイズ（概算）
            if (entry.data?.after?.renderTexture) {
                usage += entry.data.after.width * entry.data.after.height * 4; // RGBA
            }
            if (entry.data?.before?.renderTexture) {
                usage += entry.data.before.width * entry.data.before.height * 4; // RGBA
            }
        });
        
        this.stats.memoryUsage = usage;
    }
    
    // ==== 統計・情報取得メソッド ====
    
    /**
     * 履歴統計の取得
     */
    getStats() {
        this.updateMemoryUsage();
        
        return {
            ...this.stats,
            currentIndex: this.currentIndex,
            historyLength: this.history.length,
            canUndo: this.canUndo(),
            canRedo: this.canRedo(),
            memoryUsageMB: Math.round(this.stats.memoryUsage / 1024 / 1024 * 100) / 100
        };
    }
    
    /**
     * 履歴リストの取得（デバッグ用）
     */
    getHistoryList() {
        return this.history.map((entry, index) => ({
            index: index,
            id: entry.id,
            type: entry.type,
            description: entry.description,
            timestamp: new Date(entry.timestamp).toLocaleTimeString(),
            isCurrent: index === this.currentIndex
        }));
    }
    
    /**
     * 現在の履歴ポジション情報
     */
    getPositionInfo() {
        return {
            current: this.currentIndex,
            total: this.history.length,
            canUndo: this.canUndo(),
            canRedo: this.canRedo(),
            undoDescription: this.canUndo() ? this.history[this.currentIndex].description : null,
            redoDescription: this.canRedo() ? this.history[this.currentIndex + 1].description : null
        };
    }
    
    // ==== デバッグメソッド ====
    
    /**
     * 履歴の詳細表示（デバッグ用）
     */
    debugHistory() {
        console.group('🔍 履歴デバッグ情報');
        console.log('統計:', this.getStats());
        console.log('履歴リスト:', this.getHistoryList());
        console.log('現在位置:', this.getPositionInfo());
        console.groupEnd();
    }
    
    /**
     * デバッグモードの切り替え
     */
    toggleDebugMode() {
        HISTORY_CONFIG.DEBUG_MODE = !HISTORY_CONFIG.DEBUG_MODE;
        console.log(`履歴デバッグモード: ${HISTORY_CONFIG.DEBUG_MODE ? 'ON' : 'OFF'}`);
        
        if (HISTORY_CONFIG.DEBUG_MODE) {
            this.debugHistory();
        }
    }
    
    // ==== クリーンアップ ====
    
    /**
     * HistoryManagerの破棄
     */
    destroy() {
        console.log('🏛️ HistoryManager破棄開始');
        
        // 全履歴のクリーンアップ
        this.cleanupRemovedEntries(this.history);
        
        // 参照のクリア
        this.history = null;
        this.app = null;
        this.toolsSystem = null;
        this.uiManager = null;
        
        console.log('🏛️ HistoryManager破棄完了');
    }
}

// ==== エクスポート ====
if (typeof window !== 'undefined') {
    window.HistoryManager = HistoryManager;
    window.StateCapture = StateCapture;
    window.StateRestore = StateRestore;
    window.HistoryEntry = HistoryEntry;
    window.HISTORY_TYPES = HISTORY_TYPES;
    window.HISTORY_CONFIG = HISTORY_CONFIG;
}

// ES6 module export (将来のTypeScript移行用)
// export { 
//     HistoryManager, 
//     StateCapture, 
//     StateRestore, 
//     HistoryEntry, 
//     HISTORY_TYPES, 
//     HISTORY_CONFIG 
// };