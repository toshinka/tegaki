// ==== スライダー関連メソッド ====
    
    updateSliderValue(sliderId, value) {
        const slider = this.sliders.get(sliderId);
        if (slider) {
            slider.setValue(value, true);
        }
    }
    
    getAllSliderValues() {
        const values = {};
        for (const [id, slider] of this.sliders) {
            values[id] = slider.value;
        }
        return values;
    }
    
    // ==== 🆕 v1rev5b: プリセット関連メソッドの強化版（Phase2対応） ====
    
    selectPreset(presetId) {
        const preset = this.penPresetManager.selectPreset(presetId);
        if (preset) {
            // スライダーの値も更新
            this.updateSliderValue('pen-size-slider', preset.size);
            this.updateSliderValue('pen-opacity-slider', preset.opacity * 100);
            this.updateSliderValue('pen-pressure-slider', preset.pressure * 100);
            this.updateSliderValue('pen-smoothing-slider', preset.smoothing * 100);
            
            // 🆕 v1rev5b: 表示更新の即座実行
            this.updatePresetsDisplayImmediate();
            this.updateToolDisplay();
            
            return preset;
        }
        return null;
    }
    
    selectNextPreset() {
        const preset = this.penPresetManager.selectNextPreset();
        if (preset) {
            this.updateSliderValue('pen-size-slider', preset.size);
            this.updateSliderValue('pen-opacity-slider', preset.opacity * 100);
            this.updatePresetsDisplayImmediate(); // 🆕 v1rev5b: 即座更新
        }
        return preset;
    }
    
    selectPreviousPreset() {
        const preset = this.penPresetManager.selectPreviousPreset();
        if (preset) {
            this.updateSliderValue('pen-size-slider', preset.size);
            this.updateSliderValue('pen-opacity-slider', preset.opacity * 100);
            this.updatePresetsDisplayImmediate(); // 🆕 v1rev5b: 即座更新
        }
        return preset;
    }
    
    // 🆕 v1rev5b: リセット機能実装（Phase2）
    resetActivePreset() {
        const result = this.penPresetManager.resetActivePreset();
        if (result) {
            const activePreset = this.penPresetManager.getActivePreset();
            
            // スライダー値をリセット
            this.updateSliderValue('pen-size-slider', activePreset.size);
            this.updateSliderValue('pen-opacity-slider', activePreset.opacity * 100);
            this.updateSliderValue('pen-pressure-slider', activePreset.pressure * 100);
            this.updateSliderValue('pen-smoothing-slider', activePreset.smoothing * 100);
            
            // 表示更新
            this.updatePresetsDisplayImmediate();
            this.updateToolDisplay();
            
            // 通知
            if (this.showNotification) {
                this.showNotification(`プリセット「${activePreset.name}」をリセットしました`, 'info', 2000);
            }
        }
        return result;
    }
    
    // 🆕 v1rev5b: PenPresetManager取得API
    getPenPresetManager() {
        return this.penPresetManager;
    }
    
    // ==== ポップアップ関連メソッド ====
    
    showPopup(popupId) {
        if (this.popupManager) {
            return this.popupManager.showPopup(popupId);
        }
        return false;
    }
    
    hidePopup(popupId) {
        if (this.popupManager) {
            return this.popupManager.hidePopup(popupId);
        }
        return false;
    }
    
    hideAllPopups() {
        if (this.popupManager) {
            this.popupManager.hideAllPopups();
        }
    }
    
    // ==== 🆕 Phase2: 履歴管理関連メソッド ====
    
    /**
     * 履歴管理システムへのアクセサー
     */
    getHistoryManager() {
        return this.historyManager;
    }
    
    /**
     * アンドゥ実行
     */
    undo() {
        if (!this.historyManager) return false;
        
        const success = this.historyManager.undo();
        if (success) {
            // UI全体を更新
            this.updateAllDisplays();
            console.log('🔙 アンドゥ実行 + UI更新完了');
        }
        return success;
    }
    
    /**
     * リドゥ実行
     */
    redo() {
        if (!this.historyManager) return false;
        
        const success = this.historyManager.redo();
        if (success) {
            // UI全体を更新
            this.updateAllDisplays();
            console.log('🔜 リドゥ実行 + UI更新完了');
        }
        return success;
    }
    
    /**
     * アンドゥ可能状態
     */
    canUndo() {
        return this.historyManager ? this.historyManager.canUndo() : false;
    }
    
    /**
     * リドゥ可能状態
     */
    canRedo() {
        return this.historyManager ? this.historyManager.canRedo() : false;
    }
    
    /**
     * 履歴統計取得
     */
    getHistoryStats() {
        return this.historyManager ? this.historyManager.getStats() : null;
    }
    
    /**
     * 履歴デバッグ表示
     */
    debugHistory() {
        if (this.historyManager) {
            this.historyManager.debugHistory();
        } else {
            console.warn('履歴管理システムが利用できません');
        }
    }
    
    // ==== 通知・エラー表示 ====
    
    showNotification(message, type = 'info', duration = 3000) {
        console.log(`[${type.toUpperCase()}] ${message}`);
        
        // 将来的にはより高度な通知システムを実装予定
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.textContent = message;
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 12px 20px;
            background: ${type === 'error' ? '#ff4444' : type === 'success' ? '#44ff44' : '#4444ff'};
            color: white;
            border-radius: 8px;
            z-index: 10000;
            font-size: 14px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        `;
        
        document.body.appendChild(notification);
        
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, duration);
    }
    
    showError(message, duration = 5000) {
        this.showNotification(message, 'error', duration);
    }
    
    // ==== 設定関連ハンドラ ====
    
    handleSettingChange(key, newValue) {
        console.log(`設定変更: ${key} = ${newValue}`);
        
        // 設定に応じた処理
        switch (key) {
            case 'highDPI':
                this.handleHighDPIChange(newValue);
                break;
            case 'showDebugInfo':
                this.handleDebugInfoChange(newValue);
                break;
            default:
                console.log(`未処理の設定変更: ${key}`);
        }
    }
    
    handleSettingsLoaded(settings) {
        console.log('設定読み込み完了:', settings);
        
        // UI要素に設定を反映
        if (settings.highDPI !== undefined) {
            const checkbox = document.getElementById('high-dpi-checkbox');
            if (checkbox) {
                checkbox.checked = settings.highDPI;
            }
        }
        
        if (settings.showDebugInfo !== undefined) {
            const checkbox = document.getElementById('debug-info-checkbox');
            if (checkbox) {
                checkbox.checked = settings.showDebugInfo;
            }
            this.handleDebugInfoChange(settings.showDebugInfo);
        }
    }
    
    handleHighDPIChange(enabled) {
        if (this.app && this.app.setHighDPI) {
            this.app.setHighDPI(enabled);
            this.showNotification(
                enabled ? '高DPI設定を有効にしました' : '高DPI設定を無効にしました',
                'info'
            );
        }
    }
    
    handleDebugInfoChange(enabled) {
        const debugElement = document.getElementById('debug-info');
        if (debugElement) {
            debugElement.style.display = enabled ? 'block' : 'none';
        }
    }
    
    // ==== システム統計・デバッグ（Phase2拡張版）====
    
    getUIStats() {
        const historyStats = this.getHistoryStats();
        
        return {
            initialized: this.isInitialized,
            activePopup: this.popupManager ? this.popupManager.activePopup : null,
            sliderCount: this.sliders.size,
            activePreset: this.penPresetManager.getActivePresetId(),
            performanceMonitoring: this.performanceMonitor.isRunning,
            // 🆕 v1rev5b: プリセット統計追加
            presetStats: {
                hasLiveValues: !!this.penPresetManager.currentLiveValues,
                presetCount: this.penPresetManager.presets.size
            },
            // 🆕 Phase2: 履歴統計追加
            historyStats: {
                canUndo: this.canUndo(),
                canRedo: this.canRedo(),
                historyLength: historyStats?.historyLength || 0,
                memoryUsageMB: historyStats?.memoryUsageMB || 0
            },
            components: {
                popupManager: !!this.popupManager,
                statusBar: !!this.statusBar,
                presetDisplayManager: !!this.presetDisplayManager,
                penPresetManager: !!this.penPresetManager,
                performanceMonitor: !!this.performanceMonitor,
                historyManager: !!this.historyManager // 🆕 Phase2
            }
        };
    }
    
    debugUI() {
        console.group('🔍 UIManager デバッグ情報（v1rev5b Phase2対応）');
        
        console.log('基本情報:', {
            initialized: this.isInitialized,
            sliders: this.sliders.size,
            activePreset: this.penPresetManager.getActivePresetId()
        });
        
        console.log('コンポーネント状態:', this.getUIStats().components);
        
        console.log('スライダー値:', this.getAllSliderValues());
        
        if (this.performanceMonitor) {
            console.log('パフォーマンス統計:', this.performanceMonitor.getStats());
        }
        
        // 🆕 Phase2: 履歴統計の表示
        if (this.historyManager) {
            console.log('履歴統計:', this.getHistoryStats());
            console.log('履歴位置:', this.historyManager.getPositionInfo ? this.historyManager.getPositionInfo() : 'N/A');
        }
        
        // 🆕 v1rev5b: プリセット詳細情報
        if (this.penPresetManager) {
            console.log('プリセット一覧:', Array.from(this.penPresetManager.presets.keys()));
            console.log('アクティブプリセット:', this.penPresetManager.getActivePreset());
            console.log('ライブ値:', this.penPresetManager.currentLiveValues);
            
            const previewData = this.penPresetManager.generatePreviewData();
            console.log('プレビューデータ:', previewData);
        }
        
        console.groupEnd();
    }
    
    // ==== 外部連携メソッド ====
    
    onToolChange(newTool) {
        // ツール変更時の処理
        this.updateToolDisplay();
        
        // ツールボタンのアクティブ状態更新
        document.querySelectorAll('.tool-button').forEach(btn => {
            btn.classList.remove('active');
        });
        
        const toolButton = document.getElementById(`${newTool}-tool`);
        if (toolButton) {
            toolButton.classList.add('active');
        }
    }
    
    // 🆕 v1rev5b: ブラシ設定変更時の処理強化版（Phase2対応）
    onBrushSettingsChange(settings) {
        // ブラシ設定変更時の処理
        if (settings.size !== undefined) {
            this.updateSliderValue('pen-size-slider', settings.size);
        }
        if (settings.opacity !== undefined) {
            this.updateSliderValue('pen-opacity-slider', settings.opacity * 100);
        }
        if (settings.pressure !== undefined) {
            this.updateSliderValue('pen-pressure-slider', settings.pressure * 100);
        }
        if (settings.smoothing !== undefined) {
            this.updateSliderValue('pen-smoothing-slider', settings.smoothing * 100);
        }
        
        // 🆕 v1rev5b: プリセットライブ値更新
        if (settings.size !== undefined || settings.opacity !== undefined) {
            const currentSize = settings.size !== undefined ? settings.size : 
                this.toolsSystem.getBrushSettings().size;
            const currentOpacity = settings.opacity !== undefined ? settings.opacity * 100 : 
                this.toolsSystem.getBrushSettings().opacity * 100;
            
            this.penPresetManager.updateActivePresetLive(currentSize, currentOpacity);
            this.throttledPresetUpdate();
        }
        
        this.updateToolDisplay();
    }
    
    // ==== 🆕 Phase2: テスト・デバッグ機能 ====
    
    /**
     * 履歴機能のテスト実行（Phase2拡張版）
     */
    testHistoryFunction() {
        console.group('🧪 履歴機能テスト（Phase2: UIManager統合版）');
        
        // 1. 現在の状態を確認
        console.log('1. 初期状態:', {
            canUndo: this.canUndo(),
            canRedo: this.canRedo(),
            historyStats: this.getHistoryStats()
        });
        
        // 2. プリセット変更テスト
        console.log('2. プリセット変更実行...');
        const testPreset = this.selectPreset('preset_8');
        console.log('プリセット変更結果:', testPreset?.name);
        
        // 3. ブラシ設定変更テスト（Phase2: 拡張範囲）
        console.log('3. ブラシ設定変更実行（範囲拡張テスト）...');
        if (this.toolsSystem && this.toolsSystem.updateBrushSettings) {
            this.toolsSystem.updateBrushSettings({ size: 50, opacity: 1.0 });
        }
        
        // 4. 変更後の状態確認
        console.log('4. 変更後の状態:', {
            canUndo: this.canUndo(),
            canRedo: this.canRedo(),
            historyStats: this.getHistoryStats()
        });
        
        // 5. アンドゥテスト
        console.log('5. アンドゥ実行...');
        const undoResult = this.undo();
        console.log('アンドゥ結果:', undoResult);
        
        // 6. リドゥテスト
        console.log('6. リドゥ実行...');
        const redoResult = this.redo();
        console.log('リドゥ結果:', redoResult);
        
        // 7. リセット機能テスト
        console.log('7. リセット機能テスト...');
        const resetResult = this.resetActivePreset();
        console.log('リセット結果:', resetResult);
        
        // 8. 最終状態確認
        console.log('8. 最終状態:', {
            canUndo: this.canUndo(),
            canRedo: this.canRedo(),
            activePreset: this.penPresetManager.getActivePreset(),
            historyStats: this.getHistoryStats()
        });
        
        console.groupEnd();
    }
    
    /**
     * Phase2機能の総合テスト
     */
    testPhase2Features() {
        console.group('🧪 Phase2機能総合テスト');
        
        // デフォルト値テスト
        console.log('1. デフォルト値確認:');
        const defaultSize = (typeof CONFIG !== 'undefined' && CONFIG.DEFAULT_BRUSH_SIZE) ? 
            CONFIG.DEFAULT_BRUSH_SIZE : 4;
        const defaultOpacity = (typeof CONFIG !== 'undefined' && CONFIG.DEFAULT_OPACITY) ? 
            CONFIG.DEFAULT_OPACITY : 1.0;
        const maxSize = (typeof CONFIG !== 'undefined' && CONFIG.MAX_BRUSH_SIZE) ? 
            CONFIG.MAX_BRUSH_SIZE : 500;
        
        console.log(`  デフォルトサイズ: ${defaultSize}px`);
        console.log(`  デフォルト透明度: ${defaultOpacity * 100}%`);
        console.log(`  最大サイズ: ${maxSize}px`);
        
        // プリセット機能テスト
        console.log('2. プリセット機能テスト:');
        const activePreset = this.penPresetManager.getActivePreset();
        console.log('  アクティブプリセット:', activePreset);
        
        // 履歴機能テスト
        console.log('3. 履歴機能テスト:');
        this.testHistoryFunction();
        
        // リセット機能テスト
        console.log('4. リセット機能テスト:');
        console.log('  アクティブプリセットリセット:', this.penPresetManager.resetActivePreset());
        
        console.groupEnd();
    }
    
    // ==== クリーンアップ ====
    
    destroy() {
        try {
            // パフォーマンス監視停止
            if (this.performanceMonitor) {
                this.performanceMonitor.stop();
            }
            
            // スライダーのクリーンアップ
            for (const slider of this.sliders.values()) {
                if (slider.destroy) {
                    slider.destroy();
                }
            }
            this.sliders.clear();
            
            // タイムアウトのクリア
            if (this.coordinateUpdateThrottle) {
                clearTimeout(this.coordinateUpdateThrottle);
            }
            if (this.resizeTimeout) {
                clearTimeout(this.resizeTimeout);
            }
            // 🆕 v1rev5b: プリセット更新スロットリングのクリア
            if (this.presetUpdateThrottle) {
                clearTimeout(this.presetUpdateThrottle);
            }
            
            // 参照のクリア
            this.historyManager = null; // 🆕 Phase2
            this.penPresetManager = null;
            this.performanceMonitor = null;
            this.popupManager = null;
            this.statusBar = null;
            this.presetDisplayManager = null;
            this.settingsManager = null;
            
            console.log('✅ UIManager クリーンアップ完了（v1rev5b Phase2）');
            
        } catch (error) {
            console.error('UIManager クリーンアップエラー:', error);
        }
    }
}

// ==== グローバル登録 ====
if (typeof window !== 'undefined') {
    window.UIManager = UIManager;
    window.PerformanceMonitor = PerformanceMonitor;
    window.PenPresetManager = PenPresetManager;
    
    console.log('🎯 ui-manager.js v1rev5b 読み込み完了（Phase2: デフォルト値変更 + 履歴管理 + リセット機能対応版）');
    console.log('📦 エクスポートクラス:');
    console.log('  - UIManager: UI統合管理（Phase2対応：デフォルト値変更+履歴管理+リセット機能）');
    console.log('  - PerformanceMonitor: パフォーマンス監視システム');
    console.log('  - PenPresetManager: ペンプリセット管理（Phase2対応：履歴記録+リセット機能）');
    console.log('🔧 v1rev5b Phase2修正内容:');
    console.log('  ✅ デフォルト値変更対応（ペンサイズ 16→4、透明度 85%→100%、最大サイズ 100→500）');
    console.log('  ✅ プリセット履歴管理機能実装（プリセット変更の履歴記録）');
    console.log('  ✅ リセット機能実装（アクティブ/全プリセット/キャンバス）');
    console.log('  ✅ プレビュー円の制限強化（外枠◯を超えない制限・大サイズ対応）');
    console.log('  ✅ 履歴連携の強化（アンドゥ・リドゥ UI統合）');
    console.log('  ✅ キーボードショートカット（Ctrl+Z, Ctrl+Y, R）');
    console.log('  ✅ 通知システム（成功/エラー/情報表示）');
    console.log('  ✅ テスト・デバッグ機能の充実');
    console.log('🏗️ Phase2実装完了:');
    console.log('  - デフォルト値仕様変更の完全対応');
    console.log('  - 履歴管理システムとの完全統合');
    console.log('  - リセット機能の多段階実装');
    console.log('  - プレビューシステムの大サイズ対応');
    console.log('  - ユーザビリティの向上');
}

// ==== ES6モジュールエクスポート（将来のTypeScript移行用）====
// export { UIManager, PerformanceMonitor, PenPresetManager };/**
 * 🎨 ふたば☆ちゃんねる風ベクターお絵描きツール v1rev5b
 * UI管理システム - ui-manager.js（Phase2: デフォルト値変更 + 履歴管理 + リセット機能対応版）
 * 
 * 🔧 v1rev5b修正内容（Phase2: デフォルト値変更 + 履歴管理強化）:
 * 1. ✅ デフォルト値変更対応（ペンサイズ 16→4、透明度 85%→100%、最大サイズ 100→500）
 * 2. ✅ プリセット履歴管理機能実装（プリセット変更の履歴記録）
 * 3. ✅ リセット機能実装（デフォルト値に戻す機能）
 * 4. ✅ プレビュー円の制限強化（外枠◯を超えない制限）
 * 5. ✅ 履歴連携の強化（アンドゥ・リドゥ対応）
 * 6. ✅ Phase2仕様に合わせた設定値の調整
 * 
 * Phase2目標: デフォルト値仕様変更 + 履歴管理 + リセット機能の完全実装
 * 対象: ui-manager.js
 * 
 * 責務: UIコンテナ管理・UIイベント処理・プリセット管理・パフォーマンス監視・履歴連携
 * 依存: app-core.js, drawing-tools.js, ui/components.js, history-manager.js
 */

// ==== パフォーマンス監視システム（drawing-tools.jsから移行・完全版）====
class PerformanceMonitor {
    constructor() {
        this.frameCount = 0;
        this.lastTime = performance.now();
        this.isRunning = false;
        this.stats = {
            fps: 0,
            frameTime: 0,
            memoryUsage: 0
        };
        this.updateCallbacks = new Set(); // UI更新コールバック
    }
    
    start() {
        if (this.isRunning) return;
        this.isRunning = true;
        
        const update = (currentTime) => {
            if (!this.isRunning) return;
            
            this.frameCount++;
            const deltaTime = currentTime - this.lastTime;
            
            // 1秒ごとにFPS計算
            if (deltaTime >= 1000) {
                this.stats.fps = Math.round((this.frameCount * 1000) / deltaTime);
                this.stats.frameTime = Math.round(deltaTime / this.frameCount * 100) / 100;
                
                this.updateUI();
                
                this.frameCount = 0;
                this.lastTime = currentTime;
            }
            
            requestAnimationFrame(update);
        };
        
        requestAnimationFrame(update);
        console.log('📊 パフォーマンス監視開始（UI統合版）');
    }
    
    stop() {
        this.isRunning = false;
        console.log('📊 パフォーマンス監視停止');
    }
    
    updateUI() {
        // FPS表示更新
        const fpsElement = document.getElementById('fps');
        if (fpsElement) {
            fpsElement.textContent = this.stats.fps;
        }
        
        // メモリ使用量表示
        const memoryElement = document.getElementById('memory-usage');
        if (memoryElement && performance.memory) {
            const usedMB = Math.round(performance.memory.usedJSHeapSize / 1024 / 1024 * 10) / 10;
            memoryElement.textContent = usedMB + 'MB';
            this.stats.memoryUsage = usedMB;
        }
        
        // GPU使用率（ダミー値）
        const gpuElement = document.getElementById('gpu-usage');
        if (gpuElement) {
            const gpuUsage = Math.round(40 + Math.random() * 20);
            gpuElement.textContent = gpuUsage + '%';
        }
        
        // 登録されたコールバックを実行
        this.updateCallbacks.forEach(callback => {
            try {
                callback(this.stats);
            } catch (error) {
                console.warn('パフォーマンス監視コールバックエラー:', error);
            }
        });
    }
    
    addUpdateCallback(callback) {
        this.updateCallbacks.add(callback);
    }
    
    removeUpdateCallback(callback) {
        this.updateCallbacks.delete(callback);
    }
    
    getStats() {
        return { ...this.stats };
    }
}

// ==== プリセット管理クラス（v1rev5b: Phase2デフォルト値変更 + 履歴管理対応版）====
class PenPresetManager {
    constructor(toolsSystem, historyManager = null) {
        this.toolsSystem = toolsSystem;
        this.historyManager = historyManager; // 🆕 Phase2: 履歴管理システム連携
        this.presets = this.createDefaultPresets();
        this.activePresetId = 'preset_4'; // 🔧 Phase2: デフォルト16→4に変更
        this.currentLiveValues = null; // ライブ編集値
        
        this.setupPresetEventListeners();
        console.log('🎨 PenPresetManager初期化完了（v1rev5b Phase2: デフォルト値変更 + 履歴管理対応）');
    }
    
    // 🆕 Phase2: 履歴管理システム設定
    setHistoryManager(historyManager) {
        this.historyManager = historyManager;
        console.log('📚 PenPresetManager: 履歴管理システム連携完了');
    }
    
    createDefaultPresets() {
        // 🔧 Phase2: CONFIG値の参照確認
        const sizes = (typeof UI_CONFIG !== 'undefined' && UI_CONFIG.SIZE_PRESETS) ? 
            UI_CONFIG.SIZE_PRESETS : [1, 2, 4, 8, 16, 32];
        
        // 🔧 Phase2: デフォルト値をCONFIGから取得
        const defaultSize = (typeof CONFIG !== 'undefined' && CONFIG.DEFAULT_BRUSH_SIZE) ? 
            CONFIG.DEFAULT_BRUSH_SIZE : 4; // 16→4に変更
        const defaultOpacity = (typeof CONFIG !== 'undefined' && CONFIG.DEFAULT_OPACITY) ? 
            CONFIG.DEFAULT_OPACITY : 1.0; // 0.85→1.0(100%)に変更
        
        const presets = new Map();
        
        sizes.forEach((size, index) => {
            const presetId = `preset_${size}`;
            presets.set(presetId, {
                id: presetId,
                size: size,
                opacity: defaultOpacity, // 🔧 Phase2: 100%に統一
                color: 0x800000,
                pressure: 0.5,
                smoothing: 0.3,
                name: `サイズ${size}`,
                isDefault: true
            });
        });
        
        console.log(`📝 デフォルトプリセット作成（Phase2仕様）: デフォルトサイズ=${defaultSize}, デフォルト透明度=${defaultOpacity * 100}%`);
        return presets;
    }
    
    setupPresetEventListeners() {
        document.querySelectorAll('.size-preset-item').forEach(preset => {
            preset.addEventListener('click', () => {
                const size = parseFloat(preset.getAttribute('data-size'));
                const presetId = `preset_${size}`;
                this.selectPreset(presetId);
            });
        });
    }
    
    // 🆕 Phase2: 履歴記録付きプリセット選択
    selectPreset(presetId) {
        const preset = this.presets.get(presetId);
        if (!preset) {
            console.warn(`プリセットが見つかりません: ${presetId}`);
            return null;
        }
        
        // 🆕 Phase2: 履歴記録のための変更前状態キャプチャ
        const beforeState = this.historyManager && typeof InternalStateCapture !== 'undefined' ? 
            InternalStateCapture.capturePresetState(this) : null;
        
        // プリセット選択実行
        const oldActivePresetId = this.activePresetId;
        this.activePresetId = presetId;
        this.currentLiveValues = null; // ライブ値をリセット
        
        // ツールシステムに設定を適用
        if (this.toolsSystem) {
            this.toolsSystem.updateBrushSettings({
                size: preset.size,
                opacity: preset.opacity,
                color: preset.color,
                pressure: preset.pressure,
                smoothing: preset.smoothing
            });
        }
        
        // 🆕 Phase2: 履歴記録
        if (this.historyManager && beforeState && oldActivePresetId !== presetId) {
            const afterState = typeof InternalStateCapture !== 'undefined' ? 
                InternalStateCapture.capturePresetState(this) : null;
            
            this.historyManager.recordPresetChange(beforeState, afterState);
        }
        
        console.log(`🎯 プリセット選択（履歴記録付き）: ${preset.name} (${preset.size}px, ${Math.round(preset.opacity * 100)}%)`);
        return preset;
    }
    
    selectPreviousPreset() {
        const presetIds = Array.from(this.presets.keys());
        const currentIndex = presetIds.indexOf(this.activePresetId);
        const prevIndex = currentIndex > 0 ? currentIndex - 1 : presetIds.length - 1;
        
        return this.selectPreset(presetIds[prevIndex]);
    }
    
    selectNextPreset() {
        const presetIds = Array.from(this.presets.keys());
        const currentIndex = presetIds.indexOf(this.activePresetId);
        const nextIndex = currentIndex < presetIds.length - 1 ? currentIndex + 1 : 0;
        
        return this.selectPreset(presetIds[nextIndex]);
    }
    
    getActivePreset() {
        return this.presets.get(this.activePresetId);
    }
    
    getActivePresetId() {
        return this.activePresetId;
    }
    
    getPresetIdBySize(size) {
        for (const [id, preset] of this.presets) {
            if (Math.abs(preset.size - size) < 0.1) {
                return id;
            }
        }
        return null;
    }
    
    // 🆕 v1rev5b: ライブ値更新の強化
    updateActivePresetLive(size, opacity, color = null) {
        if (!this.currentLiveValues) {
            this.currentLiveValues = {
                size: size,
                opacity: opacity / 100,
                color: color || this.getActivePreset()?.color || 0x800000
            };
        } else {
            this.currentLiveValues.size = size;
            this.currentLiveValues.opacity = opacity / 100;
            if (color !== null) {
                this.currentLiveValues.color = color;
            }
        }
        
        console.log('🔄 ライブプレビュー更新:', {
            size: this.currentLiveValues.size.toFixed(1),
            opacity: Math.round(this.currentLiveValues.opacity * 100) + '%'
        });
    }
    
    // 🆕 v1rev5b: 動的プレビューデータ生成の強化版（Phase2: 外枠制限対応）
    generatePreviewData() {
        const previewData = [];
        const activePreset = this.getActivePreset();
        const liveValues = this.currentLiveValues;
        
        // UI_CONFIGのフォールバック値を使用
        const previewMin = (typeof UI_CONFIG !== 'undefined' && UI_CONFIG.SIZE_PREVIEW_MIN) ? 
            UI_CONFIG.SIZE_PREVIEW_MIN : 0.5;
        const previewMax = (typeof UI_CONFIG !== 'undefined' && UI_CONFIG.SIZE_PREVIEW_MAX) ? 
            UI_CONFIG.SIZE_PREVIEW_MAX : 20;
        
        for (const preset of this.presets.values()) {
            const isActive = preset.id === this.activePresetId;
            
            // 🆕 v1rev5b: 改良されたリニア変換による表示サイズ計算
            let displaySize;
            let actualSize; // 実際のサイズ値（ライブ値またはプリセット値）
            let actualOpacity; // 実際の透明度値
            
            if (isActive && liveValues) {
                actualSize = liveValues.size;
                actualOpacity = liveValues.opacity;
            } else {
                actualSize = preset.size;
                actualOpacity = preset.opacity;
            }
            
            // 🆕 Phase2: 外枠制限を考慮したプレビューサイズ計算
            // リニア変換式を改良し、最大500pxにも対応
            const maxSize = (typeof CONFIG !== 'undefined' && CONFIG.MAX_BRUSH_SIZE) ? 
                CONFIG.MAX_BRUSH_SIZE : 500;
            
            // プレビューサイズの計算：小さいサイズは拡大、大きいサイズは制限
            if (actualSize <= 32) {
                // 32px以下は線形スケール（従来通り）
                const normalizedSize = Math.min(1.0, actualSize / 32);
                displaySize = Math.max(previewMin, Math.min(previewMax, normalizedSize * previewMax));
            } else {
                // 32px超は対数スケールで圧縮（外枠を超えない）
                const logScale = Math.log(actualSize / 32) / Math.log(maxSize / 32);
                const compressedScale = logScale * 0.3; // 圧縮率
                displaySize = Math.min(previewMax, previewMax * (0.7 + compressedScale));
            }
            
            // 🆕 v1rev5b: 数値表示の同期強化
            const sizeLabel = isActive && liveValues ? 
                liveValues.size.toFixed(1) + 'px' : 
                preset.size.toString() + 'px';
            
            const opacityLabel = isActive && liveValues ? 
                Math.round(liveValues.opacity * 100) + '%' : 
                Math.round(preset.opacity * 100) + '%';
            
            previewData.push({
                dataSize: preset.size, // HTML data-size属性用
                displaySize: displaySize, // 表示用サイズ（px）
                actualSize: actualSize, // 実際のサイズ値
                sizeLabel: sizeLabel, // サイズラベル
                opacity: actualOpacity, // 実際の透明度（0-1）
                opacityLabel: opacityLabel, // 透明度ラベル
                color: isActive && liveValues ? 
                    `#${liveValues.color.toString(16).padStart(6, '0')}` :
                    `#${preset.color.toString(16).padStart(6, '0')}`,
                isActive: isActive
            });
        }
        
        if (liveValues) {
            console.log('🎨 プレビューデータ生成（Phase2外枠制限対応）:', {
                activePreset: this.activePresetId,
                liveSize: liveValues.size.toFixed(1),
                liveOpacity: Math.round(liveValues.opacity * 100) + '%',
                itemCount: previewData.length
            });
        }
        
        return previewData;
    }
    
    // 🆕 Phase2: リセット機能（履歴記録付き）
    resetActivePreset() {
        const activePreset = this.getActivePreset();
        if (!activePreset) return false;
        
        // 🆕 Phase2: 履歴記録のための変更前状態キャプチャ
        const beforeState = this.historyManager && typeof InternalStateCapture !== 'undefined' ? 
            InternalStateCapture.capturePresetState(this) : null;
        
        // デフォルト値に戻す
        this.currentLiveValues = null;
        
        // 🔧 Phase2: デフォルト値をCONFIGから取得
        const defaultOpacity = (typeof CONFIG !== 'undefined' && CONFIG.DEFAULT_OPACITY) ? 
            CONFIG.DEFAULT_OPACITY : 1.0; // 100%
        
        const resetSettings = {
            size: activePreset.size, // プリセットの元サイズ
            opacity: defaultOpacity,  // Phase2: 100%に統一
            color: activePreset.color,
            pressure: activePreset.pressure,
            smoothing: activePreset.smoothing
        };
        
        if (this.toolsSystem) {
            this.toolsSystem.updateBrushSettings(resetSettings);
        }
        
        // 🆕 Phase2: 履歴記録
        if (this.historyManager && beforeState) {
            const afterState = typeof InternalStateCapture !== 'undefined' ? 
                InternalStateCapture.capturePresetState(this) : null;
            
            this.historyManager.recordPresetChange(beforeState, afterState);
        }
        
        console.log(`🔄 プリセットリセット（履歴記録付き）: ${activePreset.name} → デフォルト値（透明度${Math.round(defaultOpacity * 100)}%）`);
        return true;
    }
    
    // 🆕 Phase2: 全プリセットをデフォルト値にリセット
    resetAllPresets() {
        const beforeState = this.historyManager && typeof InternalStateCapture !== 'undefined' ? 
            InternalStateCapture.capturePresetState(this) : null;
        
        // 🔧 Phase2: デフォルト値をCONFIGから取得
        const defaultOpacity = (typeof CONFIG !== 'undefined' && CONFIG.DEFAULT_OPACITY) ? 
            CONFIG.DEFAULT_OPACITY : 1.0;
        
        // 全プリセットをデフォルト値に戻す
        for (const preset of this.presets.values()) {
            preset.opacity = defaultOpacity; // Phase2: 100%に統一
            preset.pressure = 0.5;
            preset.smoothing = 0.3;
        }
        
        // ライブ値もクリア
        this.currentLiveValues = null;
        
        // アクティブプリセットの設定をツールシステムに適用
        const activePreset = this.getActivePreset();
        if (activePreset && this.toolsSystem) {
            this.toolsSystem.updateBrushSettings({
                size: activePreset.size,
                opacity: activePreset.opacity,
                color: activePreset.color,
                pressure: activePreset.pressure,
                smoothing: activePreset.smoothing
            });
        }
        
        // 🆕 Phase2: 履歴記録
        if (this.historyManager && beforeState) {
            const afterState = typeof InternalStateCapture !== 'undefined' ? 
                InternalStateCapture.capturePresetState(this) : null;
            
            this.historyManager.recordPresetChange(beforeState, afterState);
        }
        
        console.log(`🔄 全プリセットリセット（Phase2仕様）: 透明度=${Math.round(defaultOpacity * 100)}%に統一`);
        return true;
    }
}

// ==== メインUI管理クラス（v1rev5b Phase2: デフォルト値変更 + 履歴管理 + リセット機能対応版）====
class UIManager {
    constructor(app, toolsSystem, historyManager = null) {
        this.app = app;
        this.toolsSystem = toolsSystem;
        this.historyManager = historyManager; // 🆕 Phase2: 履歴管理システム連携
        
        // 外部コンポーネント（ui/components.jsから）- 存在チェック付き
        this.popupManager = (typeof PopupManager !== 'undefined') ? new PopupManager() : null;
        this.statusBar = (typeof StatusBarManager !== 'undefined') ? new StatusBarManager() : null;
        this.presetDisplayManager = (typeof PresetDisplayManager !== 'undefined') ? 
            new PresetDisplayManager(toolsSystem) : null;
        
        // 内部管理システム（Phase2: 履歴管理対応）
        this.penPresetManager = new PenPresetManager(toolsSystem, historyManager);
        
        // 🆕 パフォーマンス監視システム（drawing-tools.jsから移行）
        this.performanceMonitor = new PerformanceMonitor();
        
        // スライダー管理
        this.sliders = new Map();
        
        // 状態
        this.isInitialized = false;
        this.coordinateUpdateThrottle = null;
        
        // 🆕 v1rev5b: プリセット更新スロットリング
        this.presetUpdateThrottle = null;
        this.presetUpdateDelay = 16; // 60fps相当
        
        // 外部参照（後で設定）
        this.settingsManager = null;
        
        console.log('🎯 UIManager初期化（v1rev5b Phase2: デフォルト値変更 + 履歴管理 + リセット機能対応版）');
    }
    
    // 🆕 Phase2: 履歴管理システム設定
    setHistoryManager(historyManager) {
        this.historyManager = historyManager;
        
        // PenPresetManagerにも設定
        if (this.penPresetManager) {
            this.penPresetManager.setHistoryManager(historyManager);
        }
        
        console.log('📚 UIManager: 履歴管理システム連携完了');
    }
    
    async init() {
        try {
            console.log('🎯 UIManager初期化開始（v1rev5b Phase2: デフォルト値変更 + 履歴管理 + リセット機能対応版）...');
            
            // 依存コンポーネントのチェック
            this.checkDependencies();
            
            this.setupToolButtons();
            this.setupPopups();
            this.setupSliders(); // 🆕 v1rev5b: スライダー設定の強化
            this.setupResize();
            this.setupCheckboxes();
            this.setupAppEventListeners();
            
            // 🆕 Phase2: リセット機能のセットアップ
            this.setupResetFunctions();
            
            // 🆕 パフォーマンス監視開始
            this.setupPerformanceMonitoring();
            
            // 🆕 v1rev5b: プリセット表示の初期化
            this.setupPresetDisplay();
            
            // 初期状態の更新
            this.updateAllDisplays();
            
            this.isInitialized = true;
            console.log('✅ UIManager初期化完了（v1rev5b Phase2: デフォルト値変更 + 履歴管理 + リセット機能対応版）');
            console.log('🔧 v1rev5b Phase2修正項目:');
            console.log('  ✅ デフォルト値変更対応（ペンサイズ 16→4、透明度 85%→100%、最大サイズ 100→500）');
            console.log('  ✅ プリセット履歴管理機能実装（プリセット変更の履歴記録）');
            console.log('  ✅ リセット機能実装（デフォルト値に戻す機能）');
            console.log('  ✅ プレビュー円の制限強化（外枠◯を超えない制限）');
            console.log('  ✅ 履歴連携の強化（アンドゥ・リドゥ対応）');
            
        } catch (error) {
            console.error('❌ UIManager初期化エラー:', error);
            throw error;
        }
    }
    
    // ==== 🆕 Phase2: リセット機能のセットアップ ====
    
    setupResetFunctions() {
        // プリセットリセットボタン
        const resetPresetBtn = document.getElementById('reset-active-preset');
        if (resetPresetBtn) {
            resetPresetBtn.addEventListener('click', () => {
                this.handleResetActivePreset();
            });
        }
        
        // 全プリセットリセットボタン
        const resetAllPresetsBtn = document.getElementById('reset-all-presets');
        if (resetAllPresetsBtn) {
            resetAllPresetsBtn.addEventListener('click', () => {
                this.handleResetAllPresets();
            });
        }
        
        // キャンバスリセットボタン
        const resetCanvasBtn = document.getElementById('reset-canvas');
        if (resetCanvasBtn) {
            resetCanvasBtn.addEventListener('click', () => {
                this.handleResetCanvas();
            });
        }
        
        console.log('🔄 リセット機能セットアップ完了（Phase2）');
    }
    
    // 🆕 Phase2: アクティブプリセットリセット処理
    handleResetActivePreset() {
        if (this.penPresetManager) {
            const success = this.penPresetManager.resetActivePreset();
            
            if (success) {
                // UI表示更新
                this.updatePresetsDisplayImmediate();
                this.updateSliderValues();
                this.updateToolDisplay();
                
                // 通知
                this.showNotification('アクティブプリセットをリセットしました', 'success', 2000);
            } else {
                this.showNotification('プリセットリセットに失敗しました', 'error', 3000);
            }
        }
    }
    
    // 🆕 Phase2: 全プリセットリセット処理
    handleResetAllPresets() {
        if (confirm('全てのプリセットをデフォルト値にリセットしますか？')) {
            if (this.penPresetManager) {
                const success = this.penPresetManager.resetAllPresets();
                
                if (success) {
                    // UI表示更新
                    this.updatePresetsDisplayImmediate();
                    this.updateSliderValues();
                    this.updateToolDisplay();
                    
                    // 通知
                    this.showNotification('全プリセットをリセットしました', 'success', 2000);
                } else {
                    this.showNotification('プリセットリセットに失敗しました', 'error', 3000);
                }
            }
        }
    }
    
    // 🆕 Phase2: キャンバスリセット処理（履歴記録付き）
    handleResetCanvas() {
        if (confirm('キャンバスを消去しますか？この操作は取り消すことができます。')) {
            // 履歴記録
            if (this.historyManager) {
                this.historyManager.recordCanvasClear();
            }
            
            // キャンバスクリア実行
            if (this.app && this.app.clear) {
                this.app.clear();
                this.showNotification('キャンバスをクリアしました', 'info', 2000);
            } else {
                this.showNotification('キャンバスクリアに失敗しました', 'error', 3000);
            }
        }
    }
    
    // 🆕 Phase2: スライダー値の更新（アクティブプリセットから）
    updateSliderValues() {
        const activePreset = this.penPresetManager.getActivePreset();
        if (!activePreset) return;
        
        this.updateSliderValue('pen-size-slider', activePreset.size);
        this.updateSliderValue('pen-opacity-slider', activePreset.opacity * 100);
        this.updateSliderValue('pen-pressure-slider', activePreset.pressure * 100);
        this.updateSliderValue('pen-smoothing-slider', activePreset.smoothing * 100);
        
        console.log('🎛️ スライダー値更新（プリセット同期）');
    }
    
    // ==== パフォーマンス関連API（既存）====
    
    setupPerformanceMonitoring() {
        // パフォーマンス監視開始
        this.performanceMonitor.start();
        
        // 履歴管理システムとの統合コールバック
        this.performanceMonitor.addUpdateCallback((stats) => {
            if (this.historyManager && this.historyManager.getStats) {
                const historyStats = this.historyManager.getStats();
                
                // メモリ統計にも履歴管理のメモリ使用量を含める
                const totalMemoryMB = stats.memoryUsage + (historyStats.memoryUsageMB || 0);
                
                const memoryElement = document.getElementById('memory-usage');
                if (memoryElement) {
                    memoryElement.textContent = totalMemoryMB.toFixed(1) + 'MB';
                }
            }
        });
        
        console.log('📊 パフォーマンス監視統合完了');
    }
    
    // ==== 🆕 v1rev5b: プリセット表示セットアップ ====
    
    setupPresetDisplay() {
        // プリセット表示の初期化
        if (this.presetDisplayManager) {
            // PresetDisplayManagerにPenPresetManagerを設定
            this.presetDisplayManager.setPenPresetManager(this.penPresetManager);
        }
        
        // プリセットイベントリスナーの追加設定
        document.querySelectorAll('.size-preset-item').forEach(preset => {
            preset.addEventListener('click', (event) => {
                const size = parseFloat(preset.getAttribute('data-size'));
                this.handlePresetClick(size, event);
            });
        });
        
        console.log('🎨 プリセット表示システム初期化完了（v1rev5b）');
    }
    
    // 🆕 v1rev5b: プリセットクリック処理
    handlePresetClick(size, event) {
        const presetId = `preset_${size}`;
        const preset = this.penPresetManager.selectPreset(presetId);
        
        if (preset) {
            // スライダーの値も同期更新
            this.updateSliderValue('pen-size-slider', preset.size);
            this.updateSliderValue('pen-opacity-slider', preset.opacity * 100);
            this.updateSliderValue('pen-pressure-slider', preset.pressure * 100);
            this.updateSliderValue('pen-smoothing-slider', preset.smoothing * 100);
            
            // プリセット表示を即座に更新
            this.updatePresetsDisplayImmediate();
            
            console.log(`🎯 プリセット選択: ${preset.name} (サイズ${preset.size}px, 透明度${Math.round(preset.opacity * 100)}%)`);
        }
    }
    
    /**
     * パフォーマンス統計の取得
     */
    getPerformanceStats() {
        const baseStats = this.performanceMonitor.getStats();
        const appStats = this.app.getStats ? this.app.getStats() : {};
        const historyStats = this.historyManager ? this.historyManager.getStats() : null;
        const toolsStats = this.toolsSystem.getSystemStats ? this.toolsSystem.getSystemStats() : {};
        
        return {
            ...baseStats,
            ...appStats,
            history: historyStats,
            tools: {
                currentTool: toolsStats.currentTool,
                initialized: toolsStats.initialized
            }
        };
    }
    
    /**
     * パフォーマンス監視の開始/停止
     */
    setPerformanceMonitoring(enabled) {
        if (enabled) {
            this.performanceMonitor.start();
        } else {
            this.performanceMonitor.stop();
        }
    }
    
    // ==== 依存関係チェック ====
    
    checkDependencies() {
        const missing = [];
        
        if (typeof PopupManager === 'undefined') missing.push('PopupManager');
        if (typeof StatusBarManager === 'undefined') missing.push('StatusBarManager');
        if (typeof PresetDisplayManager === 'undefined') missing.push('PresetDisplayManager');
        if (typeof SliderController === 'undefined') missing.push('SliderController');
        
        if (missing.length > 0) {
            console.warn('⚠️ UIManager: 一部依存コンポーネントが見つかりません:', missing);
            console.warn('ui/components.js が正しく読み込まれているか確認してください');
        } else {
            console.log('✅ UIManager: 全依存コンポーネントが利用可能');
        }
    }
    
    // ==== 外部システム依存設定 ====
    
    setSettingsManager(settingsManager) {
        this.settingsManager = settingsManager;
    }
    
    // ==== ツールボタン設定 ====
    
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
        // 履歴記録（ツール変更前の状態を保存）
        let beforeTool = null;
        if (this.historyManager && this.toolsSystem) {
            beforeTool = this.toolsSystem.getCurrentTool();
        }
        
        // ツール切り替え
        if (toolId === 'pen-tool') {
            this.setActiveTool('pen', button, beforeTool);
        } else if (toolId === 'eraser-tool') {
            this.setActiveTool('eraser', button, beforeTool);
        }
        
        // ポップアップ表示/非表示
        if (popupId && this.popupManager) {
            this.popupManager.togglePopup(popupId);
        }
    }
    
    setActiveTool(toolName, button, beforeTool = null) {
        // ツールシステムに切り替えを依頼
        if (this.toolsSystem.setTool(toolName)) {
            // 履歴記録（Phase2: 履歴システムを使用）
            if (this.historyManager && beforeTool && beforeTool !== toolName) {
                this.historyManager.recordToolChange(beforeTool, toolName);
            }
            
            // UI更新
            document.querySelectorAll('.tool-button').forEach(btn => 
                btn.classList.remove('active'));
            if (button) {
                button.classList.add('active');
            }
            
            if (this.statusBar) {
                this.statusBar.updateCurrentTool(toolName);
            }
        }
    }
    
    // ==== ポップアップ設定 ====
    
    setupPopups() {
        if (!this.popupManager) {
            console.warn('PopupManager が利用できません');
            return;
        }
        
        // ポップアップの登録
        this.popupManager.registerPopup('pen-settings');
        this.popupManager.registerPopup('resize-settings');
        
        console.log('✅ ポップアップ設定完了');
    }
    
    // ==== 🆕 v1rev5b: スライダー設定の強化版（Phase2対応） ====
    
    setupSliders() {
        if (typeof SliderController === 'undefined') {
            console.warn('SliderController が利用できません');
            return;
        }
        
        // 🔧 Phase2: デフォルト値をCONFIGから取得
        const defaultSize = (typeof CONFIG !== 'undefined' && CONFIG.DEFAULT_BRUSH_SIZE) ? 
            CONFIG.DEFAULT_BRUSH_SIZE : 4; // 16→4
        const defaultOpacity = (typeof CONFIG !== 'undefined' && CONFIG.DEFAULT_OPACITY) ? 
            CONFIG.DEFAULT_OPACITY : 1.0; // 0.85→1.0(100%)
        const maxSize = (typeof CONFIG !== 'undefined' && CONFIG.MAX_BRUSH_SIZE) ? 
            CONFIG.MAX_BRUSH_SIZE : 500; // 100→500
        
        // 🆕 v1rev5b: ペンサイズスライダー（Phase2: 範囲0.1～500、デフォルト4）
        this.createSlider('pen-size-slider', 0.1, maxSize, defaultSize, (value, displayOnly = false) => {
            if (!displayOnly) {
                this.toolsSystem.updateBrushSettings({ size: value });
                
                // 🆕 プリセットライブ値更新
                const currentOpacity = this.toolsSystem.getBrushSettings().opacity;
                this.penPresetManager.updateActivePresetLive(value, currentOpacity * 100);
                
                // 🆕 プリセット表示の即座更新（スロットリング付き）
                this.throttledPresetUpdate();
            }
            return value.toFixed(1) + 'px';
        });
        
        // 🆕 v1rev5b: 不透明度スライダー（Phase2: デフォルト100%）
        this.createSlider('pen-opacity-slider', 0, 100, defaultOpacity * 100, (value, displayOnly = false) => {
            if (!displayOnly) {
                this.toolsSystem.updateBrushSettings({ opacity: value / 100 });
                
                // 🆕 プリセットライブ値更新
                const currentSize = this.toolsSystem.getBrushSettings().size;
                this.penPresetManager.updateActivePresetLive(currentSize, value);
                
                // 🆕 プリセット表示の即座更新（スロットリング付き）
                this.throttledPresetUpdate();
            }
            return value.toFixed(1) + '%';
        });
        
        // 筆圧スライダー
        this.createSlider('pen-pressure-slider', 0, 100, 50.0, (value, displayOnly = false) => {
            if (!displayOnly) {
                this.toolsSystem.updateBrushSettings({ pressure: value / 100 });
            }
            return value.toFixed(1) + '%';
        });
        
        // 線補正スライダー
        this.createSlider('pen-smoothing-slider', 0, 100, 30.0, (value, displayOnly = false) => {
            if (!displayOnly) {
                this.toolsSystem.updateBrushSettings({ smoothing: value / 100 });
            }
            return value.toFixed(1) + '%';
        });
        
        this.setupSliderButtons();
        console.log('✅ スライダー設定完了（v1rev5b Phase2対応版）');
        console.log(`  🔧 デフォルト値: サイズ${defaultSize}px, 透明度${defaultOpacity * 100}%, 最大サイズ${maxSize}px`);
    }
    
    // 🆕 v1rev5b: プリセット更新スロットリング
    throttledPresetUpdate() {
        if (this.presetUpdateThrottle) {
            clearTimeout(this.presetUpdateThrottle);
        }
        
        this.presetUpdateThrottle = setTimeout(() => {
            this.updatePresetsDisplayImmediate();
            this.presetUpdateThrottle = null;
        }, this.presetUpdateDelay);
    }
    
    createSlider(sliderId, min, max, initial, callback) {
        if (typeof SliderController === 'undefined') {
            console.warn('SliderController is not available');
            return null;
        }
        
        const slider = new SliderController(sliderId, min, max, initial, callback);
        this.sliders.set(sliderId, slider);
        return slider;
    }
    
    setupSliderButtons() {
        // スライダー調整ボタンのセットアップ
        const buttonConfigs = [
            // ペンサイズ（Phase2: 大きな調整範囲対応）
            { id: 'pen-size-decrease-small', slider: 'pen-size-slider', delta: -0.1 },
            { id: 'pen-size-decrease', slider: 'pen-size-slider', delta: -1 },
            { id: 'pen-size-decrease-large', slider: 'pen-size-slider', delta: -10 },
            { id: 'pen-size-increase-small', slider: 'pen-size-slider', delta: 0.1 },
            { id: 'pen-size-increase', slider: 'pen-size-slider', delta: 1 },
            { id: 'pen-size-increase-large', slider: 'pen-size-slider', delta: 10 },
            
            // 不透明度
            { id: 'pen-opacity-decrease-small', slider: 'pen-opacity-slider', delta: -0.1 },
            { id: 'pen-opacity-decrease', slider: 'pen-opacity-slider', delta: -1 },
            { id: 'pen-opacity-decrease-large', slider: 'pen-opacity-slider', delta: -10 },
            { id: 'pen-opacity-increase-small', slider: 'pen-opacity-slider', delta: 0.1 },
            { id: 'pen-opacity-increase', slider: 'pen-opacity-slider', delta: 1 },
            { id: 'pen-opacity-increase-large', slider: 'pen-opacity-slider', delta: 10 },
            
            // 筆圧
            { id: 'pen-pressure-decrease-small', slider: 'pen-pressure-slider', delta: -0.1 },
            { id: 'pen-pressure-decrease', slider: 'pen-pressure-slider', delta: -1 },
            { id: 'pen-pressure-decrease-large', slider: 'pen-pressure-slider', delta: -10 },
            { id: 'pen-pressure-increase-small', slider: 'pen-pressure-slider', delta: 0.1 },
            { id: 'pen-pressure-increase', slider: 'pen-pressure-slider', delta: 1 },
            { id: 'pen-pressure-increase-large', slider: 'pen-pressure-slider', delta: 10 },
            
            // 線補正
            { id: 'pen-smoothing-decrease-small', slider: 'pen-smoothing-slider', delta: -0.1 },
            { id: 'pen-smoothing-decrease', slider: 'pen-smoothing-slider', delta: -1 },
            { id: 'pen-smoothing-decrease-large', slider: 'pen-smoothing-slider', delta: -10 },
            { id: 'pen-smoothing-increase-small', slider: 'pen-smoothing-slider', delta: 0.1 },
            { id: 'pen-smoothing-increase', slider: 'pen-smoothing-slider', delta: 1 },
            { id: 'pen-smoothing-increase-large', slider: 'pen-smoothing-slider', delta: 10 }
        ];
        
        buttonConfigs.forEach(config => {
            const button = document.getElementById(config.id);
            if (button) {
                button.addEventListener('click', () => {
                    const slider = this.sliders.get(config.slider);
                    if (slider) {
                        slider.adjustValue(config.delta);
                    }
                });
            }
        });
        
        console.log('✅ スライダー調整ボタン設定完了');
    }
    
    // ==== リサイズ設定 ====
    
    setupResize() {
        // キャンバスサイズ設定ボタン
        const resizeButtons = [
            { id: 'resize-400-400', width: 400, height: 400 },
            { id: 'resize-600-600', width: 600, height: 600 },
            { id: 'resize-800-600', width: 800, height: 600 },
            { id: 'resize-1000-1000', width: 1000, height: 1000 }
        ];
        
        resizeButtons.forEach(config => {
            const button = document.getElementById(config.id);
            if (button) {
                button.addEventListener('click', () => {
                    this.resizeCanvas(config.width, config.height);
                });
            }
        });
        
        console.log('✅ リサイズ設定完了');
    }
    
    resizeCanvas(width, height) {
        // 🆕 Phase2: 履歴記録付きリサイズ
        if (this.historyManager) {
            const beforeSize = { width: this.app.width, height: this.app.height };
            const afterSize = { width, height };
            this.historyManager.recordCanvasResize(beforeSize, afterSize);
        }
        
        if (this.app && this.app.resize) {
            this.app.resize(width, height);
            
            if (this.statusBar) {
                this.statusBar.updateCanvasInfo(width, height);
            }
            
            console.log(`キャンバスリサイズ（履歴記録付き）: ${width}x${height}px`);
        }
    }
    
    // ==== チェックボックス設定 ====
    
    setupCheckboxes() {
        // 高DPI設定
        const highDpiCheckbox = document.getElementById('high-dpi-checkbox');
        if (highDpiCheckbox) {
            highDpiCheckbox.addEventListener('change', (event) => {
                if (this.settingsManager) {
                    this.settingsManager.setSetting('highDPI', event.target.checked);
                }
            });
        }
        
        // デバッグ情報表示
        const debugInfoCheckbox = document.getElementById('debug-info-checkbox');
        if (debugInfoCheckbox) {
            debugInfoCheckbox.addEventListener('change', (event) => {
                const debugInfoElement = document.getElementById('debug-info');
                if (debugInfoElement) {
                    debugInfoElement.style.display = event.target.checked ? 'block' : 'none';
                }
            });
        }
        
        console.log('✅ チェックボックス設定完了');
    }
    
    // ==== アプリイベントリスナー設定 ====
    
    setupAppEventListeners() {
        // キャンバス上のマウス座標更新
        if (this.app && this.app.view) {
            this.app.view.addEventListener('pointermove', (event) => {
                this.updateCoordinatesThrottled(event.offsetX, event.offsetY);
            });
        }
        
        // ウィンドウリサイズ対応
        window.addEventListener('resize', () => {
            this.handleWindowResize();
        });
        
        // 🆕 Phase2: 履歴関連キーボードショートカット
        document.addEventListener('keydown', (event) => {
            this.handleKeyboardShortcuts(event);
        });
        
        console.log('✅ アプリイベントリスナー設定完了');
    }
    
    // 🆕 Phase2: キーボードショートカット処理
    handleKeyboardShortcuts(event) {
        // Ctrl+Z: アンドゥ
        if (event.ctrlKey && event.key === 'z' && !event.shiftKey) {
            event.preventDefault();
            if (this.historyManager && this.historyManager.canUndo()) {
                const success = this.historyManager.undo();
                if (success) {
                    this.updateAllDisplays(); // UI全体を更新
                }
            }
            return;
        }
        
        // Ctrl+Shift+Z または Ctrl+Y: リドゥ
        if ((event.ctrlKey && event.shiftKey && event.key === 'Z') || 
            (event.ctrlKey && event.key === 'y')) {
            event.preventDefault();
            if (this.historyManager && this.historyManager.canRedo()) {
                const success = this.historyManager.redo();
                if (success) {
                    this.updateAllDisplays(); // UI全体を更新
                }
            }
            return;
        }
        
        // R: アクティブプリセットリセット
        if (event.key === 'r' && !event.ctrlKey && !event.shiftKey) {
            event.preventDefault();
            this.handleResetActivePreset();
            return;
        }
    }
    
    updateCoordinatesThrottled(x, y) {
        if (this.coordinateUpdateThrottle) {
            clearTimeout(this.coordinateUpdateThrottle);
        }
        
        this.coordinateUpdateThrottle = setTimeout(() => {
            if (this.statusBar) {
                this.statusBar.updateCoordinates(x, y);
            }
        }, 16); // 60fps相当
    }
    
    handleWindowResize() {
        // ウィンドウリサイズ時の処理
        if (this.popupManager) {
            // ポップアップ位置の調整（必要に応じて）
            this.popupManager.hideAllPopups();
        }
        
        // デバウンス処理
        clearTimeout(this.resizeTimeout);
        this.resizeTimeout = setTimeout(() => {
            console.log('ウィンドウリサイズ対応完了');
        }, 300);
    }
    
    // ==== 🆕 v1rev5b: 表示更新メソッド群の強化版 ====
    
    updateAllDisplays() {
        try {
            this.updatePresetsDisplayImmediate();
            this.updateSliderValues(); // 🆕 Phase2: スライダー値も更新
            this.updateToolDisplay();
            this.updateStatusDisplay();
            
            console.log('✅ 全表示更新完了（v1rev5b強化版）');
        } catch (error) {
            console.warn('表示更新エラー:', error);
        }
    }
    
    // 🆕 v1rev5b: プリセット表示の即座更新
    updatePresetsDisplayImmediate() {
        if (this.presetDisplayManager) {
            this.presetDisplayManager.updatePresetsDisplay();
        } else {
            // フォールバック：直接更新
            this.updatePresetsDisplayDirect();
        }
    }
    
    // 🆕 v1rev5b: プリセット表示の直接更新（フォールバック）
    updatePresetsDisplayDirect() {
        const previewData = this.penPresetManager.generatePreviewData();
        const presetsContainer = document.getElementById('size-presets');
        
        if (!presetsContainer) return;
        
        const presetItems = presetsContainer.querySelectorAll('.size-preset-item');
        
        previewData.forEach((data, index) => {
            if (index < presetItems.length) {
                const item = presetItems[index];
                const circle = item.querySelector('.size-preview-circle');
                const sizeLabel = item.querySelector('.size-preview-label');
                const opacityLabel = item.querySelector('.size-preview-percent');
                
                // HTML属性更新
                item.setAttribute('data-size', data.dataSize);
                
                // 🆕 v1rev5b: 動的サイズ更新
                if (circle) {
                    circle.style.width = data.displaySize + 'px';
                    circle.style.height = data.displaySize + 'px';
                    circle.style.background = data.color;
                    circle.style.opacity = data.opacity;
                }
                
                // 🆕 v1rev5b: 数値表示の同期
                if (sizeLabel) {
                    sizeLabel.textContent = data.sizeLabel;
                }
                
                if (opacityLabel) {
                    opacityLabel.textContent = data.opacityLabel;
                }
                
                // アクティブ状態の反映
                item.classList.toggle('active', data.isActive);
            }
        });
        
        console.log('🔄 プリセット表示直接更新完了:', previewData.length + '項目');
    }
    
    // 🆕 v1rev5b: 従来のupdatePresetsDisplay（後方互換）
    updatePresetsDisplay() {
        this.throttledPresetUpdate();
    }
    
    updateToolDisplay() {
        if (this.toolsSystem && this.statusBar) {
            const currentTool = this.toolsSystem.getCurrentTool();
            this.statusBar.updateCurrentTool(currentTool);
            
            const brushSettings = this.toolsSystem.getBrushSettings();
            if (brushSettings) {
                this.statusBar.updateCurrentColor(brushSettings.color);
            }
        }
    }
    
    updateStatusDisplay() {
        if (this.app && this.statusBar) {
            const appStats = this.app.getStats ? this.app.getStats() : {};
            if (appStats.width && appStats.height) {
                this.statusBar.updateCanvasInfo(appStats.width, appStats.height);
            }
        }
    }