/**
 * 🎨 ふたば☆ちゃんねる風ベクターお絵描きツール v1rev12
 * プレビュー連動専用コンポーネント - drawing-tools/ui/components/preview-sync.js
 * STEP 3: プレビュー連動機能移譲（モジュール分割版）
 * 
 * ⚠️ 【重要】開発・改修時の注意事項:
 * 必ずdebug/またはmonitoring/ディレクトリの既存モジュールを確認し、重複を避けてください。
 * - debug/debug-manager.js: デバッグ機能統合
 * - debug/diagnostics.js: システム診断
 * - debug/performance-logger.js: パフォーマンス測定
 * - monitoring/system-monitor.js: システム監視
 * これらの機能はこのファイルに重複実装しないでください。
 * 
 * 🏗️ STEP 3実装内容（SOLID・DRY原則準拠）:
 * 1. ✅ 単一責任原則：プレビュー連動処理のみ
 * 2. ✅ ui-manager.jsからのプレビュー機能完全分離
 * 3. ✅ リアルタイム同期処理の最適化
 * 4. ✅ エラーハンドリング強化
 * 5. ✅ スロットリング制御（パフォーマンス向上）
 * 6. ✅ 依存注入パターン採用
 * 
 * 責務: プレビュー連動・ライブ値同期・プレビュー更新制御のみ
 * 依存: PenPresetManager, PresetDisplayManager
 * 除外責務: デバッグ・監視・エラー分析（外部システムが担当）
 */

console.log('🔄 drawing-tools/ui/components/preview-sync.js STEP 3実装版読み込み開始...');

// CONFIG値安全取得（DRY原則準拠）
function safeConfigGet(key, defaultValue = null) {
    try {
        if (window.CONFIG && window.CONFIG[key] !== undefined && window.CONFIG[key] !== null) {
            return window.CONFIG[key];
        }
    } catch (error) {
        console.warn(`CONFIG.${key} アクセスエラー:`, error);
    }
    return defaultValue;
}

// ==== プレビュー連動専用コンポーネント（STEP 3移譲版）====
class PreviewSync {
    constructor(toolUI) {
        this.toolUI = toolUI;
        this.drawingSystem = toolUI.drawingToolsSystem;
        
        // 外部システム参照（依存注入）
        this.penPresetManager = null;
        this.presetDisplayManager = null;
        
        // プレビュー同期制御
        this.syncEnabled = true;
        this.updateThrottle = null;
        this.lastUpdate = 0;
        this.updateInterval = safeConfigGet('PRESET_UPDATE_THROTTLE', 16); // 60fps制限
        this.maxUpdateInterval = 100; // 最大更新間隔
        
        // 同期統計
        this.updateCount = 0;
        this.errorCount = 0;
        this.maxErrors = 5;
        
        // 状態管理
        this.isInitialized = false;
        this.syncInProgress = false;
        this.pendingUpdates = new Map();
        
        console.log('🔄 PreviewSync初期化準備（STEP 3移譲版・プレビュー連動専用）');
    }
    
    /**
     * 初期化
     */
    async init() {
        try {
            if (this.isInitialized) {
                console.warn('PreviewSync は既に初期化済みです');
                return true;
            }
            
            // 外部システムの取得・設定
            this.initializeExternalSystems();
            
            // 同期システム初期化
            this.initializeSyncSystem();
            
            // 初期同期実行
            if (this.syncEnabled) {
                this.performInitialSync();
            }
            
            this.isInitialized = true;
            console.log('✅ PreviewSync初期化完了（STEP 3移譲版・プレビュー連動専用）');
            
            return true;
            
        } catch (error) {
            console.error('❌ PreviewSync初期化エラー:', error);
            this.handleError(error);
            throw error;
        }
    }
    
    /**
     * 外部システム取得・設定
     */
    initializeExternalSystems() {
        let systemCount = 0;
        
        // PenPresetManager取得
        if (window.penPresetManager) {
            this.penPresetManager = window.penPresetManager;
            systemCount++;
            console.log('🎨 PreviewSync: PenPresetManager連携完了');
        } else if (this.drawingSystem.getPenPresetManager) {
            this.penPresetManager = this.drawingSystem.getPenPresetManager();
            if (this.penPresetManager) {
                systemCount++;
                console.log('🎨 PreviewSync: DrawingSystem経由PenPresetManager取得完了');
            }
        }
        
        // PresetDisplayManager取得
        if (window.presetDisplayManager) {
            this.presetDisplayManager = window.presetDisplayManager;
            systemCount++;
            console.log('🎨 PreviewSync: PresetDisplayManager連携完了');
        } else if (window.PresetDisplayManager && this.drawingSystem) {
            try {
                this.presetDisplayManager = new window.PresetDisplayManager(this.drawingSystem);
                systemCount++;
                console.log('🎨 PreviewSync: 新規PresetDisplayManager作成完了');
            } catch (error) {
                console.warn('PresetDisplayManager作成エラー:', error);
            }
        }
        
        console.log(`📊 PreviewSync外部システム統合: ${systemCount}/2システム利用可能`);
        
        return systemCount >= 1; // 最低1システムが必要
    }
    
    /**
     * 同期システム初期化
     */
    initializeSyncSystem() {
        this.syncEnabled = true;
        this.syncInProgress = false;
        this.pendingUpdates.clear();
        
        // 更新間隔設定
        this.updateInterval = Math.max(16, Math.min(this.maxUpdateInterval, this.updateInterval));
        
        console.log(`⚙️ 同期システム初期化: 更新間隔${this.updateInterval}ms`);
    }
    
    /**
     * 初期同期実行
     */
    performInitialSync() {
        if (!this.syncEnabled) return;
        
        try {
            // 現在のブラシ設定を取得
            const brushSettings = this.drawingSystem.getBrushSettings();
            
            if (brushSettings) {
                this.syncWithBrushSettings(brushSettings);
                console.log('🔄 PreviewSync初期同期完了:', {
                    size: brushSettings.size + 'px',
                    opacity: (brushSettings.opacity * 100).toFixed(1) + '%'
                });
            }
            
        } catch (error) {
            console.warn('初期同期エラー:', error);
            this.handleError(error);
        }
    }
    
    /**
     * プリセットライブ値更新（ui-manager.jsから移譲）
     */
    updatePresetLiveValues(size = null, opacity = null) {
        if (!this.syncEnabled || !this.penPresetManager?.updateActivePresetLive) {
            return false;
        }
        
        try {
            // 現在の設定値取得
            const brushSettings = this.drawingSystem.getBrushSettings();
            if (!brushSettings) return false;
            
            const finalSize = size !== null ? size : brushSettings.size;
            const finalOpacity = opacity !== null ? opacity : (brushSettings.opacity * 100);
            
            // バリデーション
            const validatedSize = this.validateSize(finalSize);
            const validatedOpacity = this.validateOpacity(finalOpacity);
            
            const updated = this.penPresetManager.updateActivePresetLive(validatedSize, validatedOpacity);
            
            if (updated) {
                this.updateCount++;
                console.log(`🔄 プリセットライブ値更新 #${this.updateCount}:`, {
                    size: validatedSize.toFixed(1) + 'px',
                    opacity: validatedOpacity.toFixed(1) + '%'
                });
            }
            
            return updated;
            
        } catch (error) {
            console.warn('プリセットライブ値更新エラー:', error);
            this.handleError(error);
            return false;
        }
    }
    
    /**
     * アクティブプリセットプレビュー更新（ui-manager.jsから移譲・最適化）
     */
    updateActivePresetPreview(size = null, opacity = null) {
        if (!this.syncEnabled || this.syncInProgress) {
            // 同期進行中の場合は保留
            if (size !== null || opacity !== null) {
                this.pendingUpdates.set('preview', { size, opacity });
            }
            return false;
        }
        
        // スロットリング制御（パフォーマンス最適化）
        const now = performance.now();
        if (now - this.lastUpdate < this.updateInterval) {
            if (this.updateThrottle) clearTimeout(this.updateThrottle);
            
            this.updateThrottle = setTimeout(() => {
                this.updateActivePresetPreview(size, opacity);
            }, this.updateInterval);
            
            return false;
        }
        
        this.lastUpdate = now;
        this.syncInProgress = true;
        
        try {
            let updateSuccess = false;
            
            // PresetDisplayManager経由での更新（優先）
            if (this.presetDisplayManager?.updateActivePresetPreview) {
                updateSuccess = this.presetDisplayManager.updateActivePresetPreview(size, opacity);
                
                if (updateSuccess) {
                    console.log('🎨 PresetDisplayManager経由プレビュー更新完了');
                }
            }
            
            // PenPresetManager経由での更新（フォールバック）
            if (!updateSuccess && this.penPresetManager?.updateActivePresetPreview) {
                updateSuccess = this.penPresetManager.updateActivePresetPreview(size, opacity);
                
                if (updateSuccess) {
                    console.log('🎨 PenPresetManager経由プレビュー更新完了');
                }
            }
            
            // ライブ値同期（第3のオプション）
            if (!updateSuccess && this.presetDisplayManager?.syncPreviewWithLiveValues) {
                updateSuccess = this.presetDisplayManager.syncPreviewWithLiveValues();
                
                if (updateSuccess) {
                    console.log('🎨 ライブ値同期によるプレビュー更新完了');
                }
            }
            
            this.syncInProgress = false;
            
            // 保留中の更新を処理
            this.processPendingUpdates();
            
            return updateSuccess;
            
        } catch (error) {
            console.warn('アクティブプリセットプレビュー更新エラー:', error);
            this.handleError(error);
            this.syncInProgress = false;
            return false;
        }
    }
    
    /**
     * 保留中の更新処理
     */
    processPendingUpdates() {
        if (this.pendingUpdates.size === 0) return;
        
        const pendingPreview = this.pendingUpdates.get('preview');
        if (pendingPreview) {
            this.pendingUpdates.delete('preview');
            
            // 少し遅延して実行（無限ループ回避）
            setTimeout(() => {
                this.updateActivePresetPreview(pendingPreview.size, pendingPreview.opacity);
            }, 10);
        }
    }
    
    /**
     * ブラシ設定変更時の同期処理（PenToolUIから呼び出し）
     */
    syncWithBrushSettings(settings) {
        if (!this.syncEnabled || !settings) return false;
        
        try {
            const size = settings.size;
            const opacity = settings.opacity ? settings.opacity * 100 : null;
            
            let syncCount = 0;
            
            // ライブ値更新
            if (this.updatePresetLiveValues(size, opacity)) {
                syncCount++;
            }
            
            // プレビュー更新
            if (this.updateActivePresetPreview(size, opacity)) {
                syncCount++;
            }
            
            // 全プリセット表示更新
            if (this.updateAllPresetsDisplay()) {
                syncCount++;
            }
            
            console.log(`🔄 ブラシ設定同期完了: ${syncCount}/3システム更新`);
            return syncCount > 0;
            
        } catch (error) {
            console.error('ブラシ設定同期エラー:', error);
            this.handleError(error);
            return false;
        }
    }
    
    /**
     * 全プリセット表示更新
     */
    updateAllPresetsDisplay() {
        if (!this.presetDisplayManager?.updatePresetsDisplay) {
            return false;
        }
        
        try {
            const success = this.presetDisplayManager.updatePresetsDisplay();
            
            if (success) {
                console.log('📋 全プリセット表示更新完了');
            }
            
            return success;
            
        } catch (error) {
            console.warn('全プリセット表示更新エラー:', error);
            this.handleError(error);
            return false;
        }
    }
    
    /**
     * プリセット変更時の同期（PenToolUIから呼び出し）
     */
    syncWithPreset(preset) {
        if (!this.syncEnabled || !preset) return false;
        
        try {
            const size = preset.size || safeConfigGet('DEFAULT_BRUSH_SIZE', 4);
            const opacity = (preset.opacity !== undefined) ? preset.opacity * 100 : safeConfigGet('DEFAULT_OPACITY', 1.0) * 100;
            
            // プリセット値をプレビューに反映
            const success = this.updateActivePresetPreview(size, opacity);
            
            if (success) {
                console.log('🔄 プリセット同期完了:', {
                    preset: preset.id || 'active',
                    size: size.toFixed(1) + 'px',
                    opacity: opacity.toFixed(1) + '%'
                });
            }
            
            return success;
            
        } catch (error) {
            console.error('プリセット同期エラー:', error);
            this.handleError(error);
            return false;
        }
    }
    
    /**
     * 全プレビューリセット（ui-manager.jsから移譲）
     */
    resetAllPreviews() {
        try {
            let resetCount = 0;
            
            // PresetDisplayManager経由でのリセット
            if (this.presetDisplayManager?.resetAllPreviews) {
                const success = this.presetDisplayManager.resetAllPreviews();
                if (success) resetCount++;
            }
            
            // PenPresetManager経由でのリセット（フォールバック）
            if (this.penPresetManager?.resetAllPreviews) {
                const success = this.penPresetManager.resetAllPreviews();
                if (success) resetCount++;
            }
            
            if (resetCount > 0) {
                // 現在の設定でプレビューを再同期
                this.performInitialSync();
                
                console.log(`🔄 全プレビューリセット完了: ${resetCount}システム`);
                return true;
            } else {
                console.warn('プレビューリセット機能が利用できません');
                return false;
            }
            
        } catch (error) {
            console.error('全プレビューリセットエラー:', error);
            this.handleError(error);
            return false;
        }
    }
    
    /**
     * プレビュー同期制御
     */
    enableSync() {
        if (this.syncEnabled) {
            console.log('プレビュー同期は既に有効です');
            return;
        }
        
        this.syncEnabled = true;
        console.log('✅ プレビュー同期有効化');
        
        // 有効化時に即座に同期実行
        this.performInitialSync();
    }
    
    disableSync() {
        if (!this.syncEnabled) {
            console.log('プレビュー同期は既に無効です');
            return;
        }
        
        this.syncEnabled = false;
        console.log('❌ プレビュー同期無効化');
        
        // スロットリング中の更新をクリア
        if (this.updateThrottle) {
            clearTimeout(this.updateThrottle);
            this.updateThrottle = null;
        }
        
        // 保留中の更新をクリア
        this.pendingUpdates.clear();
        this.syncInProgress = false;
    }
    
    isSyncEnabled() {
        return this.syncEnabled;
    }
    
    /**
     * 設定更新
     */
    updateSettings(settings = {}) {
        if (settings.updateInterval !== undefined) {
            const newInterval = Math.max(16, Math.min(this.maxUpdateInterval, settings.updateInterval));
            this.updateInterval = newInterval;
            console.log(`⚙️ プレビュー更新間隔変更: ${newInterval}ms`);
        }
        
        if (settings.syncEnabled !== undefined) {
            if (settings.syncEnabled) {
                this.enableSync();
            } else {
                this.disableSync();
            }
        }
        
        if (settings.maxErrors !== undefined) {
            this.maxErrors = Math.max(1, settings.maxErrors);
            console.log(`⚙️ 最大エラー数変更: ${this.maxErrors}`);
        }
    }
    
    /**
     * 値のバリデーション
     */
    validateSize(size) {
        const numSize = parseFloat(size);
        if (isNaN(numSize)) return safeConfigGet('DEFAULT_BRUSH_SIZE', 4);
        return Math.max(
            safeConfigGet('MIN_BRUSH_SIZE', 0.1),
            Math.min(safeConfigGet('MAX_BRUSH_SIZE', 500), numSize)
        );
    }
    
    validateOpacity(opacity) {
        const numOpacity = parseFloat(opacity);
        if (isNaN(numOpacity)) return safeConfigGet('DEFAULT_OPACITY', 1.0) * 100;
        return Math.max(0, Math.min(100, numOpacity));
    }
    
    /**
     * エラーハンドリング
     */
    handleError(error) {
        this.errorCount++;
        
        if (this.errorCount > this.maxErrors) {
            console.error(`PreviewSync: 最大エラー数 (${this.maxErrors}) に達しました。同期を無効化します。`);
            this.disableSync();
            return false;
        }
        
        console.warn(`PreviewSync エラー ${this.errorCount}/${this.maxErrors}:`, error);
        return true;
    }
    
    /**
     * 統計取得
     */
    getStats() {
        return {
            isInitialized: this.isInitialized,
            syncEnabled: this.syncEnabled,
            syncInProgress: this.syncInProgress,
            updateCount: this.updateCount,
            errorCount: this.errorCount,
            maxErrors: this.maxErrors,
            lastUpdate: this.lastUpdate,
            updateInterval: this.updateInterval,
            throttling: {
                active: !!this.updateThrottle,
                interval: this.updateInterval
            },
            pendingUpdates: this.pendingUpdates.size,
            externalSystems: {
                penPresetManager: !!this.penPresetManager,
                presetDisplayManager: !!this.presetDisplayManager
            }
        };
    }
    
    /**
     * デバッグ情報
     */
    debugSync() {
        console.group('🔍 PreviewSync デバッグ情報（STEP 3移譲版）');
        
        const stats = this.getStats();
        console.log('基本状態:', {
            initialized: stats.isInitialized,
            syncEnabled: stats.syncEnabled,
            syncInProgress: stats.syncInProgress,
            updateCount: stats.updateCount,
            errorCount: `${stats.errorCount}/${stats.maxErrors}`
        });
        
        console.log('パフォーマンス:', {
            updateInterval: stats.updateInterval + 'ms',
            lastUpdate: stats.lastUpdate,
            throttleActive: stats.throttling.active,
            pendingUpdates: stats.pendingUpdates
        });
        
        console.log('外部システム連携:', stats.externalSystems);
        
        // 実際の同期テスト
        console.log('🧪 同期テスト実行中...');
        const brushSettings = this.drawingSystem.getBrushSettings();
        if (brushSettings) {
            this.syncWithBrushSettings(brushSettings);
            console.log('✅ 同期テスト完了');
        } else {
            console.warn('❌ ブラシ設定が取得できません');
        }
        
        console.groupEnd();
    }
    
    /**
     * クリーンアップ
     */
    destroy() {
        try {
            console.log('🧹 PreviewSync クリーンアップ開始（STEP 3移譲版）');
            
            // 同期無効化
            this.disableSync();
            
            // スロットリングクリア
            if (this.updateThrottle) {
                clearTimeout(this.updateThrottle);
                this.updateThrottle = null;
            }
            
            // 保留中の更新をクリア
            this.pendingUpdates.clear();
            
            // 参照クリア
            this.penPresetManager = null;
            this.presetDisplayManager = null;
            this.toolUI = null;
            this.drawingSystem = null;
            
            this.isInitialized = false;
            console.log('✅ PreviewSync クリーンアップ完了');
            
        } catch (error) {
            console.error('PreviewSync クリーンアップエラー:', error);
        }
    }
}

// ==== グローバル登録・エクスポート ====
if (typeof window !== 'undefined') {
    window.PreviewSync = PreviewSync;
    
    // グローバルデバッグ関数
    window.debugPreviewSync = function() {
        if (window.toolsSystem?.penToolUI?.previewSync) {
            window.toolsSystem.penToolUI.previewSync.debugSync();
        } else {
            console.warn('PreviewSync が見つかりません');
        }
    };
    
    window.togglePreviewSync = function() {
        const previewSync = window.toolsSystem?.penToolUI?.previewSync;
        if (previewSync) {
            if (previewSync.isSyncEnabled()) {
                previewSync.disableSync();
                console.log('プレビュー同期を無効化しました');
                return false;
            } else {
                previewSync.enableSync();
                console.log('プレビュー同期を有効化しました');
                return true;
            }
        } else {
            console.warn('PreviewSync が利用できません');
            return false;
        }
    };
    
    console.log('✅ drawing-tools/ui/components/preview-sync.js STEP 3実装版 読み込み完了');
    console.log('📦 エクスポートクラス:');
    console.log('  ✅ PreviewSync: プレビュー連動処理専用（完全分離版）');
    console.log('🎨 STEP 3実装効果:');
    console.log('  ✅ 単一責任原則準拠（プレビュー連動処理のみ）');
    console.log('  ✅ ui-manager.jsからのプレビュー機能完全移譲');
    console.log('  ✅ リアルタイム同期処理の最適化');
    console.log('  ✅ エラーハンドリング強化（安全な例外処理）');
    console.log('  ✅ スロットリング制御（60fps制限でパフォーマンス向上）');
    console.log('  ✅ 依存注入パターン採用（外部システム統合）');
    console.log('🐛 デバッグ関数:');
    console.log('  - window.debugPreviewSync() - プレビュー連動デバッグ');
    console.log('  - window.togglePreviewSync() - プレビュー同期切り替え');
    console.log('📊 責務範囲:');
    console.log('  ✅ プレビュー連動・ライブ値同期・プレビュー更新制御のみ');
    console.log('  ❌ デバッグ・監視・エラー分析は外部システムが担当');
}

console.log('🏆 drawing-tools/ui/components/preview-sync.js STEP 3実装版 初期化完了');