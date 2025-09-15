/**
 * 🎨 ふたば☆ちゃんねる風ベクターお絵描きツール v1rev13
 * プレビュー連動専用システム - ui/preview-manager.js (Phase1新設)
 * 
 * ⚠️ 【重要】開発・改修時の注意事項:
 * 必ずdebug/またはmonitoring/ディレクトリの既存モジュールを確認し、重複を避けてください。
 * - debug/debug-manager.js: デバッグ機能統合
 * - debug/diagnostics.js: システム診断
 * - debug/performance-logger.js: パフォーマンス測定
 * - monitoring/system-monitor.js: システム監視
 * これらの機能はこのファイルに重複実装しないでください。
 * 
 * 🔧 Phase1改修: DRY・SOLID原則準拠
 * 1. ✅ ui-manager.jsからプレビュー連動機能分離（180行削減目標）
 * 2. ✅ 単一責任原則準拠（プレビュー連動のみ）
 * 3. ✅ 重複コード排除・DRY原則準拠
 * 4. ✅ 独立性の高いコンポーネント設計
 * 
 * 責務: プレビュー連動・ライブ値更新・プレビュー同期制御
 * 依存: ui/components.js (PresetDisplayManager), PenPresetManager
 * 除外責務: 監視・デバッグ・エラーハンドリング（他モジュールが担当）
 */

console.log('🔧 ui/preview-manager.js Phase1新設版読み込み開始...');

// ==== プレビュー連動専用クラス ====
class PreviewManager {
    constructor(penPresetManager = null, presetDisplayManager = null) {
        this.penPresetManager = penPresetManager;
        this.presetDisplayManager = presetDisplayManager;
        
        // プレビュー同期制御
        this.syncEnabled = true;
        this.updateThrottle = null;
        this.lastUpdate = 0;
        this.updateInterval = 16; // 60fps制限
        
        // 状態管理
        this.isInitialized = false;
        
        console.log('🎨 PreviewManager初期化（Phase1新設版・プレビュー連動専用）');
    }
    
    /**
     * 初期化
     */
    async init() {
        try {
            if (this.isInitialized) {
                console.warn('PreviewManager は既に初期化済みです');
                return true;
            }
            
            // 依存システム確認
            if (!this.penPresetManager) {
                console.warn('PenPresetManager が設定されていません');
            }
            
            if (!this.presetDisplayManager) {
                console.warn('PresetDisplayManager が設定されていません');
            }
            
            // 初期同期実行
            if (this.syncEnabled) {
                this.performInitialSync();
            }
            
            this.isInitialized = true;
            console.log('✅ PreviewManager初期化完了（プレビュー連動専用）');
            return true;
            
        } catch (error) {
            console.error('PreviewManager初期化エラー:', error);
            return false;
        }
    }
    
    /**
     * PenPresetManager設定
     */
    setPenPresetManager(penPresetManager) {
        this.penPresetManager = penPresetManager;
        console.log('🔗 PreviewManager: PenPresetManager連携完了');
        
        if (this.isInitialized && this.syncEnabled) {
            this.performInitialSync();
        }
    }
    
    /**
     * PresetDisplayManager設定
     */
    setPresetDisplayManager(presetDisplayManager) {
        this.presetDisplayManager = presetDisplayManager;
        console.log('🔗 PreviewManager: PresetDisplayManager連携完了');
        
        if (this.isInitialized && this.syncEnabled) {
            this.performInitialSync();
        }
    }
    
    /**
     * 初期同期実行
     */
    performInitialSync() {
        try {
            if (this.penPresetManager && this.presetDisplayManager) {
                const activePreset = this.penPresetManager.getActivePreset();
                if (activePreset) {
                    this.syncPreviewWithPreset(activePreset);
                }
            }
        } catch (error) {
            console.warn('初期プレビュー同期エラー:', error);
        }
    }
    
    /**
     * プリセットライブ値更新（ui-manager.jsから移管）
     */
    updatePresetLiveValues(size, opacity) {
        if (!this.penPresetManager?.updateActivePresetLive) {
            return false;
        }
        
        try {
            // 現在の設定値取得
            const toolsSystem = window.toolsSystem;
            if (!toolsSystem?.getBrushSettings) {
                console.warn('ToolsSystem が利用できません');
                return false;
            }
            
            const currentSettings = toolsSystem.getBrushSettings();
            const finalSize = size !== null ? size : currentSettings.size;
            const finalOpacity = opacity !== null ? opacity : (currentSettings.opacity * 100);
            
            const updated = this.penPresetManager.updateActivePresetLive(finalSize, finalOpacity);
            
            if (updated && this.syncEnabled) {
                console.log('🔄 プリセットライブ値更新:', {
                    size: finalSize.toFixed(1) + 'px',
                    opacity: finalOpacity.toFixed(1) + '%'
                });
                
                // プレビュー連動更新
                this.triggerPreviewUpdate(finalSize, finalOpacity);
            }
            
            return updated;
            
        } catch (error) {
            console.warn('プリセットライブ値更新エラー:', error);
            return false;
        }
    }
    
    /**
     * アクティブプリセットプレビュー更新（ui-manager.jsから移管・最適化）
     */
    updateActivePresetPreview(size = null, opacity = null) {
        if (!this.syncEnabled || !this.presetDisplayManager) {
            return false;
        }
        
        // スロットリング制御（60fps制限）
        const now = performance.now();
        if (now - this.lastUpdate < this.updateInterval) {
            if (this.updateThrottle) clearTimeout(this.updateThrottle);
            this.updateThrottle = setTimeout(() => {
                this.updateActivePresetPreview(size, opacity);
            }, this.updateInterval);
            return false;
        }
        
        this.lastUpdate = now;
        
        try {
            let updated = false;
            
            // Method 1: 直接的なプレビュー更新
            if (this.presetDisplayManager.updateActivePresetPreview) {
                updated = this.presetDisplayManager.updateActivePresetPreview(size, opacity);
            } 
            // Method 2: ライブ値同期
            else if (this.presetDisplayManager.syncPreviewWithLiveValues) {
                updated = this.presetDisplayManager.syncPreviewWithLiveValues();
            }
            
            if (updated) {
                console.log('🎨 アクティブプリセットプレビュー更新完了');
            }
            
            return updated;
            
        } catch (error) {
            console.warn('アクティブプリセットプレビュー更新エラー:', error);
            return false;
        }
    }
    
    /**
     * プレビュー更新トリガー
     */
    triggerPreviewUpdate(size, opacity) {
        if (!this.syncEnabled) return;
        
        // アクティブプリセットプレビュー更新
        this.updateActivePresetPreview(size, opacity);
        
        // 全プリセット表示更新
        if (this.presetDisplayManager?.updatePresetsDisplay) {
            this.presetDisplayManager.updatePresetsDisplay();
        }
    }
    
    /**
     * プリセット同期
     */
    syncPreviewWithPreset(preset) {
        if (!preset || !this.syncEnabled) return false;
        
        try {
            const size = preset.size || 4;
            const opacity = preset.opacity || 100;
            
            // プリセット値をプレビューに反映
            this.updateActivePresetPreview(size, opacity);
            
            console.log('🔄 プリセット同期完了:', {
                preset: preset.id || 'active',
                size: size + 'px',
                opacity: opacity + '%'
            });
            
            return true;
            
        } catch (error) {
            console.warn('プリセット同期エラー:', error);
            return false;
        }
    }
    
    /**
     * 全プレビューリセット（ui-manager.jsから移管）
     */
    resetAllPreviews() {
        if (!this.presetDisplayManager?.resetAllPreviews) {
            console.warn('全プレビューリセット機能が利用できません');
            return false;
        }
        
        try {
            const success = this.presetDisplayManager.resetAllPreviews();
            
            if (success) {
                console.log('🔄 全プレビューリセット完了');
                
                // 現在の設定値で再同期
                if (this.penPresetManager) {
                    const activePreset = this.penPresetManager.getActivePreset();
                    if (activePreset) {
                        this.syncPreviewWithPreset(activePreset);
                    }
                }
            }
            
            return success;
            
        } catch (error) {
            console.error('全プレビューリセットエラー:', error);
            return false;
        }
    }
    
    /**
     * プレビュー同期制御
     */
    enableSync() {
        this.syncEnabled = true;
        console.log('✅ プレビュー同期有効化');
        
        // 有効化時に即座に同期実行
        if (this.penPresetManager) {
            const activePreset = this.penPresetManager.getActivePreset();
            if (activePreset) {
                this.syncPreviewWithPreset(activePreset);
            }
        }
    }
    
    disableSync() {
        this.syncEnabled = false;
        console.log('❌ プレビュー同期無効化');
        
        // スロットリング中の更新をクリア
        if (this.updateThrottle) {
            clearTimeout(this.updateThrottle);
            this.updateThrottle = null;
        }
    }
    
    isSyncEnabled() {
        return this.syncEnabled;
    }
    
    /**
     * プレビュー同期統計取得（ui-manager.jsから移管）
     */
    getPreviewSyncStats() {
        if (!this.penPresetManager) return null;
        
        try {
            const liveValuesStats = this.penPresetManager.getLiveValuesStats ? 
                this.penPresetManager.getLiveValuesStats() : null;
            
            const presetDisplayStats = this.presetDisplayManager ? 
                this.presetDisplayManager.getStatus() : null;
            
            return {
                enabled: this.syncEnabled,
                lastUpdate: this.lastUpdate,
                updateInterval: this.updateInterval,
                throttleActive: !!this.updateThrottle,
                liveValues: liveValuesStats,
                displayManager: presetDisplayStats,
                dependencies: {
                    penPresetManager: !!this.penPresetManager,
                    presetDisplayManager: !!this.presetDisplayManager
                }
            };
            
        } catch (error) {
            console.warn('プレビュー同期統計取得エラー:', error);
            return null;
        }
    }
    
    /**
     * 状態取得
     */
    getStatus() {
        return {
            initialized: this.isInitialized,
            syncEnabled: this.syncEnabled,
            lastUpdate: this.lastUpdate,
            updateInterval: this.updateInterval,
            dependencies: {
                penPresetManager: !!this.penPresetManager,
                presetDisplayManager: !!this.presetDisplayManager,
                toolsSystem: !!window.toolsSystem
            },
            throttling: {
                active: !!this.updateThrottle,
                interval: this.updateInterval
            }
        };
    }
    
    /**
     * 設定更新
     */
    updateSettings(settings = {}) {
        if (settings.updateInterval !== undefined) {
            this.updateInterval = Math.max(16, Math.min(100, settings.updateInterval));
            console.log(`⚙️ プレビュー更新間隔変更: ${this.updateInterval}ms`);
        }
        
        if (settings.syncEnabled !== undefined) {
            if (settings.syncEnabled) {
                this.enableSync();
            } else {
                this.disableSync();
            }
        }
    }
    
    /**
     * ブラシ設定変更時の連動処理
     */
    onBrushSettingsChange(settings) {
        if (!this.syncEnabled || !settings) return;
        
        const size = settings.size;
        const opacity = settings.opacity ? settings.opacity * 100 : null;
        
        // ライブ値更新
        this.updatePresetLiveValues(size, opacity);
        
        // プレビュー更新
        this.triggerPreviewUpdate(size, opacity);
    }
    
    /**
     * プリセット変更時の連動処理
     */
    onPresetChange(preset) {
        if (!this.syncEnabled || !preset) return;
        
        this.syncPreviewWithPreset(preset);
    }
    
    /**
     * クリーンアップ
     */
    destroy() {
        try {
            // スロットリングクリア
            if (this.updateThrottle) {
                clearTimeout(this.updateThrottle);
                this.updateThrottle = null;
            }
            
            // 参照クリア
            this.penPresetManager = null;
            this.presetDisplayManager = null;
            
            this.isInitialized = false;
            this.syncEnabled = false;
            
            console.log('🧹 PreviewManager クリーンアップ完了');
            
        } catch (error) {
            console.error('PreviewManager クリーンアップエラー:', error);
        }
    }
}

// ==== グローバル登録・エクスポート ====
if (typeof window !== 'undefined') {
    window.PreviewManager = PreviewManager;
    
    // グローバル関数として登録（ui-manager.jsからの移管対応）
    window.resetAllPreviews = function() {
        if (window.previewManager && window.previewManager.resetAllPreviews) {
            return window.previewManager.resetAllPreviews();
        } else {
            console.warn('PreviewManager が利用できません');
            return false;
        }
    };
    
    window.togglePreviewSync = function() {
        if (window.previewManager) {
            if (window.previewManager.isSyncEnabled()) {
                window.previewManager.disableSync();
                console.log('プレビュー同期を無効化しました');
                return false;
            } else {
                window.previewManager.enableSync();
                console.log('プレビュー同期を有効化しました');
                return true;
            }
        } else {
            console.warn('PreviewManager が利用できません');
            return false;
        }
    };
    
    window.debugPreviewSync = function() {
        if (window.previewManager) {
            const stats = window.previewManager.getPreviewSyncStats();
            const status = window.previewManager.getStatus();
            
            console.group('🔍 プレビュー連動デバッグ情報');
            console.log('プレビュー同期統計:', stats);
            console.log('PreviewManager状態:', status);
            console.groupEnd();
        } else {
            console.warn('PreviewManager が利用できません');
        }
    };
    
    console.log('✅ ui/preview-manager.js Phase1新設版 読み込み完了');
    console.log('📦 エクスポート完了:');
    console.log('  ✅ PreviewManager クラス（単一責務：プレビュー連動のみ）');
    console.log('  ✅ window.resetAllPreviews() - 全プレビューリセット');
    console.log('  ✅ window.togglePreviewSync() - プレビュー同期切り替え');
    console.log('  ✅ window.debugPreviewSync() - プレビューデバッグ');
    console.log('🔧 Phase1改修効果:');
    console.log('  ✅ ui-manager.jsから180行相当の機能分離');
    console.log('  ✅ プレビュー連動機能の独立性向上');
    console.log('  ✅ 単一責任原則準拠（プレビュー連動のみ）');
    console.log('  ✅ 重複コード排除・DRY原則準拠');
    console.log('🎯 責務範囲: プレビュー連動・ライブ値更新・同期制御のみ');
    console.log('❌ 除外責務: 監視・デバッグ・エラーハンドリング（他モジュール担当）');
}

console.log('🏆 ui/preview-manager.js Phase1新設版 初期化完了');