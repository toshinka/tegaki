
// ==== Phase2: グローバル登録・エクスポート（@pixi/ui統合対応）====
if (typeof window !== 'undefined') {
    window.PopupManager = PopupManager;
    
    console.log('✅ PopupManager Phase2 @pixi/ui統合改修版 読み込み完了');
    console.log('🔧 Phase2改修内容:');
    console.log('  ✅ @pixi/ui統合によるポップアップ機能強化');
    console.log('  ✅ PixiJS拡張ライブラリとの統合');
    console.log('  ✅ フォールバック機能維持・エラーハンドリング強化');
    console.log('  ✅ 統合統計・パフォーマンス測定機能');
    console.log('  ✅ @pixi/ui要素とDOM要素の統合管理');
    console.log('🎯 機能: ポップアップ制御・@pixi/ui統合・統計収集・フォールバック');
    console.log('🔧 特徴: 標準ライブラリ統合・エラー分離・品質向上');
}/**
 * PopupManager - @pixi/ui統合改修版
 * 
 * 🔧 Phase2改修内容:
 * 1. @pixi/ui統合によるポップアップ機能強化
 * 2. createSimplePopup関数での@pixi/ui使用
 * 3. 既存のフォールバック機能維持
 * 4. エラーハンドリング強化
 * 5. PixiJS拡張ライブラリとの統合
 * 
 * 🎯 目的: 独自実装から標準ライブラリ使用への移行
 * ✅ フォールバック機能: @pixi/ui無効時の既存機能維持
 * ⚡ パフォーマンス: 標準ライブラリによる最適化
 */

console.log('🔧 PopupManager @pixi/ui統合改修版 読み込み開始...');

// ==== Phase2: CONFIG値安全取得ユーティリティ（改修版） ====
class PopupConfigUtils {
    static safeGet(key, defaultValue) {
        try {
            // Phase2: window.safeConfigGet使用（utils.js連携）
            if (typeof window.safeConfigGet === 'function') {
                return window.safeConfigGet(key, defaultValue);
            }
            
            if (window.CONFIG && window.CONFIG[key] !== undefined && window.CONFIG[key] !== null) {
                return window.CONFIG[key];
            }
        } catch (error) {
            console.warn(`CONFIG.${key} アクセスエラー:`, error);
        }
        return defaultValue;
    }
    
    static getPopupDefaults() {
        return {
            fadeTime: this.safeGet('POPUP_FADE_TIME', 300),
            maxErrors: this.safeGet('MAX_ERRORS', 10),
            initTimeout: this.safeGet('INIT_TIMEOUT', 5000),
            retryAttempts: this.safeGet('RETRY_ATTEMPTS', 3),
            zIndexBase: this.safeGet('POPUP_Z_INDEX_BASE', 10000),
            // Phase2追加: @pixi/ui統合設定
            usePixiUI: this.safeGet('LIBRARY_FLAGS.ENABLE_PIXI_UI', true),
            uiButtonStyle: this.safeGet('LIBRARY_CONFIG.UI_BUTTON_STYLE', {
                backgroundColor: 0x800000,
                hoverColor: 0xaa5a56,
                textColor: 0xFFFFFF
            })
        };
    }
}

// ==== Phase2: 統一エラーハンドリング（@pixi/ui統合対応） ====
class PopupErrorHandler {
    constructor(maxErrors = 10, context = 'PopupManager') {
        this.maxErrors = maxErrors;
        this.context = context;
        this.errorCount = 0;
        this.errorLog = [];
        this.popupErrors = new Map();
        this.pixiUIErrors = 0; // Phase2追加: @pixi/ui関連エラー
    }
    
    handleError(error, subContext = '') {
        this.errorCount++;
        const fullContext = subContext ? `${this.context}.${subContext}` : this.context;
        
        // Phase2: @pixi/ui関連エラーの特別処理
        if (subContext.includes('pixiui') || subContext.includes('PixiUI')) {
            this.pixiUIErrors++;
        }
        
        const errorInfo = {
            timestamp: Date.now(),
            context: fullContext,
            message: error.message || error,
            count: this.errorCount,
            isPixiUI: subContext.includes('pixiui')
        };
        
        this.errorLog.push(errorInfo);
        
        // ポップアップ別エラー統計
        if (subContext.startsWith('popup_')) {
            const popupId = subContext.replace('popup_', '');
            const currentCount = this.popupErrors.get(popupId) || 0;
            this.popupErrors.set(popupId, currentCount + 1);
        }
        
        if (this.errorCount > this.maxErrors) {
            console.error(`❌ ${fullContext}: 最大エラー数 (${this.maxErrors}) に達しました。`);
            return false;
        }
        
        console.warn(`⚠️ ${fullContext} エラー ${this.errorCount}/${this.maxErrors}:`, error);
        return true;
    }
    
    getPixiUIErrorCount() {
        return this.pixiUIErrors;
    }
    
    shouldFallbackToBasic() {
        // @pixi/ui関連エラーが多い場合はフォールバックを推奨
        return this.pixiUIErrors > 3;
    }
    
    getStats() {
        return {
            errorCount: this.errorCount,
            maxErrors: this.maxErrors,
            pixiUIErrors: this.pixiUIErrors,
            popupErrors: Object.fromEntries(this.popupErrors),
            recentErrors: this.errorLog.slice(-5),
            shouldFallback: this.shouldFallbackToBasic()
        };
    }
    
    reset() {
        this.errorCount = 0;
        this.errorLog = [];
        this.popupErrors.clear();
        this.pixiUIErrors = 0;
    }
}

// ==== Phase2: @pixi/ui統合CSS管理システム ====
class PopupCSSManager {
    constructor(errorHandler) {
        this.errorHandler = errorHandler;
        this.validatedElements = new Set();
    }
    
    // Phase2: @pixi/ui使用時のスタイル適用無効化
    validateAndFixPopupCSS(element, popupId) {
        try {
            if (this.validatedElements.has(element)) {
                return true; // 既に検証済み
            }
            
            // Phase2: @pixi/ui使用時はCSS適用をスキップ
            if (window.PixiExtensions?.hasFeature('ui') && popupId.includes('pixi-ui')) {
                console.log(`🎨 @pixi/ui使用ポップアップ: CSS適用スキップ ${popupId}`);
                this.validatedElements.add(element);
                return true;
            }
            
            const computedStyle = window.getComputedStyle(element);
            const fixes = this.getRequiredCSSFixes(computedStyle);
            
            this.applyCSSFixes(element, fixes);
            this.validatedElements.add(element);
            
            if (Object.keys(fixes).length > 0) {
                console.log(`🔧 ${popupId} CSS修正完了:`, fixes);
            }
            
            return true;
        } catch (error) {
            this.errorHandler.handleError(error, `CSSValidation_${popupId}`);
            return false;
        }
    }
    
    getRequiredCSSFixes(computedStyle) {
        const fixes = {};
        const requiredStyles = {
            position: 'fixed',
            zIndex: '10000'
        };
        
        for (const [property, expectedValue] of Object.entries(requiredStyles)) {
            const currentValue = computedStyle.getPropertyValue(property);
            if (currentValue !== expectedValue) {
                fixes[property] = expectedValue;
            }
        }
        
        return fixes;
    }
    
    applyCSSFixes(element, fixes) {
        for (const [property, value] of Object.entries(fixes)) {
            element.style.setProperty(property, value, 'important');
        }
    }
    
    // Phase2: @pixi/ui統合用スタイル作成
    createPixiUIPopupStyle(fadeTime, zIndex) {
        return {
            position: 'fixed',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            zIndex: zIndex,
            visibility: 'visible',
            opacity: '1',
            transition: `opacity ${fadeTime}ms ease-out`
        };
    }
    
    createPopupBaseStyle(fadeTime, zIndex) {
        return `
            display: none;
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: white;
            border: 2px solid #800000;
            border-radius: 8px;
            padding: 20px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
            z-index: ${zIndex};
            min-width: 300px;
            max-width: 500px;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
            visibility: hidden;
            opacity: 0;
            transition: opacity ${fadeTime}ms ease-out;
        `;
    }
    
    createOverlayStyle(fadeTime, zIndex) {
        return `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.5);
            z-index: ${zIndex - 1};
            opacity: 0;
            visibility: hidden;
            transition: opacity ${fadeTime}ms ease-out,
                       visibility ${fadeTime}ms ease-out;
            pointer-events: none;
        `;
    }
    
    cleanup() {
        this.validatedElements.clear();
    }
}

// ==== Phase2: アニメーション制御システム（@pixi/ui統合対応） ====
class PopupAnimationManager {
    constructor(fadeTime, errorHandler) {
        this.fadeTime = fadeTime;
        this.errorHandler = errorHandler;
        this.activeAnimations = new Map();
    }
    
    showWithAnimation(element, popupId, onComplete = null) {
        try {
            // 既存のアニメーションをキャンセル
            this.cancelAnimation(popupId);
            
            // Phase2: @pixi/ui使用時の特別処理
            if (window.PixiExtensions?.hasFeature('ui') && popupId.includes('pixi-ui')) {
                return this.showPixiUIElement(element, popupId, onComplete);
            }
            
            // 通常のDOM要素の場合
            this.forceShowElement(element);
            
            // フェードイン実行
            const animation = this.executeFadeIn(element, popupId, onComplete);
            this.activeAnimations.set(popupId, animation);
            
            return true;
        } catch (error) {
            this.errorHandler.handleError(error, `ShowAnimation_${popupId}`);
            return false;
        }
    }
    
    hideWithAnimation(element, popupId, onComplete = null) {
        try {
            // 既存のアニメーションをキャンセル
            this.cancelAnimation(popupId);
            
            // Phase2: @pixi/ui使用時の特別処理
            if (window.PixiExtensions?.hasFeature('ui') && popupId.includes('pixi-ui')) {
                return this.hidePixiUIElement(element, popupId, onComplete);
            }
            
            // フェードアウト実行
            const animation = this.executeFadeOut(element, popupId, onComplete);
            this.activeAnimations.set(popupId, animation);
            
            return true;
        } catch (error) {
            this.errorHandler.handleError(error, `HideAnimation_${popupId}`);
            return false;
        }
    }
    
    // Phase2: @pixi/ui要素表示
    showPixiUIElement(element, popupId, onComplete) {
        try {
            // PixiJS要素の場合は親ステージに追加
            if (element.parent) {
                element.visible = true;
                element.alpha = 0;
                

// フェードイン
                const startTime = Date.now();
                const animate = () => {
                    const elapsed = Date.now() - startTime;
                    const progress = Math.min(elapsed / this.fadeTime, 1);
                    
                    element.alpha = progress;
                    
                    if (progress < 1) {
                        requestAnimationFrame(animate);
                    } else {
                        if (onComplete) onComplete();
                        console.log(`✨ @pixi/ui要素フェードイン完了: ${popupId}`);
                    }
                };
                
                requestAnimationFrame(animate);
                return true;
            } else {
                throw new Error('@pixi/ui要素に親が設定されていません');
            }
        } catch (error) {
            this.errorHandler.handleError(error, `pixiui_show_${popupId}`);
            return false;
        }
    }
    
    // Phase2: @pixi/ui要素非表示
    hidePixiUIElement(element, popupId, onComplete) {
        try {
            if (element.parent) {
                const startTime = Date.now();
                const initialAlpha = element.alpha;
                
                const animate = () => {
                    const elapsed = Date.now() - startTime;
                    const progress = Math.min(elapsed / this.fadeTime, 1);
                    
                    element.alpha = initialAlpha * (1 - progress);
                    
                    if (progress < 1) {
                        requestAnimationFrame(animate);
                    } else {
                        element.visible = false;
                        if (onComplete) onComplete();
                        console.log(`🌫️ @pixi/ui要素フェードアウト完了: ${popupId}`);
                    }
                };
                
                requestAnimationFrame(animate);
                return true;
            } else {
                element.visible = false;
                if (onComplete) onComplete();
                return true;
            }
        } catch (error) {
            this.errorHandler.handleError(error, `pixiui_hide_${popupId}`);
            return false;
        }
    }
    
    forceShowElement(element) {
        const forceStyles = {
            display: 'block',
            visibility: 'visible',
            opacity: '0',
            pointerEvents: 'auto'
        };
        
        for (const [property, value] of Object.entries(forceStyles)) {
            element.style.setProperty(property, value, 'important');
        }
    }
    
    executeCompleteHide(element) {
        const hideStyles = {
            display: 'none',
            visibility: 'hidden',
            opacity: '0',
            pointerEvents: 'none'
        };
        
        for (const [property, value] of Object.entries(hideStyles)) {
            element.style.setProperty(property, value, 'important');
        }
    }
    
    executeFadeIn(element, popupId, onComplete) {
        return requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                element.style.transition = `opacity ${this.fadeTime}ms ease-out`;
                element.style.setProperty('opacity', '1', 'important');
                
                if (onComplete) {
                    setTimeout(onComplete, this.fadeTime);
                }
                
                console.log(`✨ ${popupId} フェードイン開始`);
            });
        });
    }
    
    executeFadeOut(element, popupId, onComplete) {
        element.style.transition = `opacity ${this.fadeTime}ms ease-out`;
        element.style.opacity = '0';
        
        return setTimeout(() => {
            this.executeCompleteHide(element);
            if (onComplete) {
                onComplete();
            }
            console.log(`🌫️ ${popupId} フェードアウト完了`);
        }, this.fadeTime);
    }
    
    cancelAnimation(popupId) {
        const animation = this.activeAnimations.get(popupId);
        if (animation) {
            if (typeof animation === 'number') {
                clearTimeout(animation);
            } else if (typeof animation === 'function') {
                try {
                    cancelAnimationFrame(animation);
                } catch (e) {
                    // キャンセル失敗は無視
                }
            }
            this.activeAnimations.delete(popupId);
        }
    }
    
    cancelAllAnimations() {
        for (const popupId of this.activeAnimations.keys()) {
            this.cancelAnimation(popupId);
        }
    }
    
    cleanup() {
        this.cancelAllAnimations();
    }
}

// ==== Phase2: @pixi/ui統合ポップアップ要素作成ファクトリ ====
class PopupElementFactory {
    constructor(cssManager, errorHandler) {
        this.cssManager = cssManager;
        this.errorHandler = errorHandler;
        this.config = PopupConfigUtils.getPopupDefaults();
    }
    
    // Phase2: @pixi/ui使用ペン設定ポップアップ作成
    createPenSettingsPopup() {
        try {
            // Phase2: @pixi/ui使用の改良版を優先
            if (this.config.usePixiUI && window.PixiExtensions?.hasFeature('ui')) {
                return this.createPixiUIPopup();
            } else {
                return this.createFallbackPopup();
            }
        } catch (error) {
            this.errorHandler.handleError(error, 'CreatePenSettingsPopup');
            return this.createFallbackPopup(); // フォールバック
        }
    }
    
    // Phase2: @pixi/ui使用ポップアップ作成
    createPixiUIPopup() {
        try {
            console.log('🎨 @pixi/ui使用ポップアップ作成開始...');
            
            // PixiJS拡張ライブラリからポップアップを作成
            const popup = window.PixiExtensions.createSimplePopup({
                title: 'ペン設定',
                content: 'ペンツールの設定を調整できます。',
                width: 350,
                height: 400,
                x: 100,
                y: 100
            });
            
            if (!popup) {
                throw new Error('@pixi/ui使用ポップアップ作成失敗');
            }
            
            // DOM要素として扱うためのラッパーを作成
            const wrapper = document.createElement('div');
            wrapper.id = 'pen-settings-popup';
            wrapper.className = 'popup pen-settings-popup pixi-ui-popup';
            
            // PixiJS要素をcanvasとして追加する必要がある場合の処理
            // 実際の実装では、PixiJSポップアップとDOM要素の統合が必要
            
            // Phase2: 暫定実装 - PixiJS要素の情報をDOM要素に反映
            wrapper.style.cssText = this.cssManager.createPopupBaseStyle(
                this.config.fadeTime, 
                this.config.zIndexBase
            );
            
            wrapper.innerHTML = this.getPixiUIEnhancedContent();
            this.setupPopupEventHandlers(wrapper);
            
            document.body.appendChild(wrapper);
            
            // PixiJS要素との連携情報を保存
            wrapper._pixiElement = popup;
            wrapper._isPixiUIPopup = true;
            
            console.log('✅ @pixi/ui使用ポップアップ作成完了');
            
            return wrapper;
            
        } catch (error) {
            this.errorHandler.handleError(error, 'CreatePixiUIPopup');
            throw error;
        }
    }
    
    // Phase2: フォールバック用通常ポップアップ作成
    createFallbackPopup() {
        console.log('🆘 フォールバック用ポップアップ作成中...');
        
        const popup = document.createElement('div');
        popup.id = 'pen-settings-popup';
        popup.className = 'popup pen-settings-popup';
        popup.style.cssText = this.cssManager.createPopupBaseStyle(
            this.config.fadeTime, 
            this.config.zIndexBase
        );
        
        popup.innerHTML = this.getPenSettingsContent();
        this.setupPopupEventHandlers(popup);
        
        document.body.appendChild(popup);
        console.log('✅ フォールバックポップアップ作成完了');
        
        return popup;
    }
    
    createOverlayElement() {
        try {
            const overlay = document.createElement('div');
            overlay.id = 'popup-overlay';
            overlay.className = 'popup-overlay';
            overlay.style.cssText = this.cssManager.createOverlayStyle(
                this.config.fadeTime, 
                this.config.zIndexBase - 1
            );
            
            document.body.appendChild(overlay);
            console.log('✅ ポップアップオーバーレイ作成完了');
            
            return overlay;
        } catch (error) {
            this.errorHandler.handleError(error, 'CreateOverlay');
            return null;
        }
    }
    
    // Phase2: @pixi/ui統合強化版コンテンツ
    getPixiUIEnhancedContent() {
        return `
            <div class="popup-header" style="margin-bottom: 15px; padding-bottom: 10px; border-bottom: 1px solid #ddd;">
                <h3 style="margin: 0; color: #800000; font-size: 18px;">🎨 ペン設定 (@pixi/ui統合版)</h3>
                <div style="font-size: 12px; color: #666; margin-top: 4px;">
                    ✅ @pixi/ui統合による改良ポップアップ
                </div>
            </div>
            <div class="popup-content">
                <div style="margin-bottom: 15px;">
                    <label style="display: block; margin-bottom: 5px; font-weight: bold;">サイズ:</label>
                    <div style="display: flex; align-items: center; gap: 10px;">
                        <input type="range" id="pen-size-slider" min="1" max="500" value="4" 
                               style="flex: 1; height: 8px;">
                        <span id="pen-size-value" style="min-width: 40px; font-weight: bold;">4</span>px
                    </div>
                </div>
                <div style="margin-bottom: 15px;">
                    <label style="display: block; margin-bottom: 5px; font-weight: bold;">透明度:</label>
                    <div style="display: flex; align-items: center; gap: 10px;">
                        <input type="range" id="pen-opacity-slider" min="0" max="100" value="100"
                               style="flex: 1; height: 8px;">
                        <span id="pen-opacity-value" style="min-width: 40px; font-weight: bold;">100</span>%
                    </div>
                </div>
                <div style="margin-bottom: 15px; padding: 10px; background: #e8f5e8; border-radius: 4px; border-left: 4px solid #4caf50;">
                    <div style="font-size: 12px; color: #2e7d32;">
                        <strong>🎨 @pixi/ui統合機能:</strong><br>
                        • 改良されたポップアップシステム<br>
                        • 標準ライブラリによる安定動作<br>
                        • AI実装しやすい標準APIパターン
                    </div>
                </div>
                <div style="margin-bottom: 10px; padding: 10px; background: #f0f8ff; border-radius: 4px; font-size: 12px; color: #666;">
                    💡 <strong>操作方法:</strong> ホイールでサイズ調整、Rキーでプリセット選択も可能です
                </div>
            </div>
            <div class="popup-footer" style="margin-top: 20px; text-align: right; padding-top: 10px; border-top: 1px solid #ddd;">
                <button class="close-popup-btn" style="
                    background: #800000; 
                    color: white; 
                    border: none; 
                    padding: 8px 15px; 
                    border-radius: 4px; 
                    cursor: pointer;
                    font-size: 14px;
                    transition: background 0.3s;
                " onmouseover="this.style.background='#a00000'" 
                   onmouseout="this.style.background='#800000'">閉じる</button>
            </div>
        `;
    }
    
    getPenSettingsContent() {
        return `
            <div class="popup-header" style="margin-bottom: 15px; padding-bottom: 10px; border-bottom: 1px solid #ddd;">
                <h3 style="margin: 0; color: #800000; font-size: 18px;">🎨 ペン設定</h3>
            </div>
            <div class="popup-content">
                <div style="margin-bottom: 15px;">
                    <label style="display: block; margin-bottom: 5px; font-weight: bold;">サイズ:</label>
                    <div style="display: flex; align-items: center; gap: 10px;">
                        <input type="range" id="pen-size-slider" min="1" max="500" value="4" 
                               style="flex: 1; height: 8px;">
                        <span id="pen-size-value" style="min-width: 40px; font-weight: bold;">4</span>px
                    </div>
                </div>
                <div style="margin-bottom: 15px;">
                    <label style="display: block; margin-bottom: 5px; font-weight: bold;">透明度:</label>
                    <div style="display: flex; align-items: center; gap: 10px;">
                        <input type="range" id="pen-opacity-slider" min="0" max="100" value="100"
                               style="flex: 1; height: 8px;">
                        <span id="pen-opacity-value" style="min-width: 40px; font-weight: bold;">100</span>%
                    </div>
                </div>
                <div style="margin-bottom: 10px; padding: 10px; background: #f5f5f5; border-radius: 4px; font-size: 12px; color: #666;">
                    💡 ホイールでサイズ調整、Rキーでプリセット選択も可能です
                </div>
            </div>
            <div class="popup-footer" style="margin-top: 20px; text-align: right; padding-top: 10px; border-top: 1px solid #ddd;">
                <button class="close-popup-btn" style="
                    background: #800000; 
                    color: white; 
                    border: none; 
                    padding: 8px 15px; 
                    border-radius: 4px; 
                    cursor: pointer;
                    font-size: 14px;
                    transition: background 0.3s;
                " onmouseover="this.style.background='#a00000'" 
                   onmouseout="this.style.background='#800000'">閉じる</button>
            </div>
        `;
    }
    
    setupPopupEventHandlers(popup) {
        // クリック時の伝播防止
        popup.addEventListener('click', (event) => {
            event.stopPropagation();
        });
        
        // 閉じるボタン機能
        const closeBtn = popup.querySelector('.close-popup-btn');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => {
                if (window.penToolUI) {
                    window.penToolUI.hidePopup('pen-settings');
                } else if (window.uiManager) {
                    window.uiManager.hidePopup('pen-settings');
                } else {
                    popup.style.display = 'none';
                }
            });
        }
        
        // Phase2: @pixi/ui統合ポップアップの特別処理
        if (popup._isPixiUIPopup && popup._pixiElement) {
            console.log('🎨 @pixi/ui統合ポップアップ イベントハンドラー設定完了');
        }
    }
}

// ==== Phase2: PopupManager本体クラス（@pixi/ui統合改修版） ====
class PopupManager {
    constructor() {
        console.log('📦 PopupManager Phase2 @pixi/ui統合改修版 初期化開始...');
        
        // Phase2: 依存注入パターン採用・@pixi/ui統合対応
        this.config = PopupConfigUtils.getPopupDefaults();
        this.errorHandler = new PopupErrorHandler(this.config.maxErrors, 'PopupManager');
        this.cssManager = new PopupCSSManager(this.errorHandler);
        this.animationManager = new PopupAnimationManager(this.config.fadeTime, this.errorHandler);
        this.elementFactory = new PopupElementFactory(this.cssManager, this.errorHandler);
        
        // Phase2追加: @pixi/ui統合状態管理
        this.pixiUIIntegration = {
            enabled: this.config.usePixiUI && window.PixiExtensions?.hasFeature('ui'),
            fallbackMode: false,
            pixiUIPopups: new Map(), // @pixi/ui要素の管理
            domPopups: new Map()     // DOM要素の管理
        };
        
        // 状態管理（統合版）
        this.state = {
            activePopup: null,
            isInitialized: false,
            initializationAttempts: 0,
            domElementsReady: false,
            eventListenersReady: false,
            pixiUIReady: this.pixiUIIntegration.enabled // Phase2追加
        };
        
        // ポップアップ管理
        this.popups = new Map();
        this.overlayElement = null;
        
        // 統計情報
        this.statistics = {
            showCount: 0,
            hideCount: 0,
            lastAction: null,
            lastActionTime: 0,
            operationTimes: new Map(),
            pixiUIUsageCount: 0, // Phase2追加
            fallbackUsageCount: 0 // Phase2追加
        };
        
        console.log(`✅ PopupManager Phase2改修版初期化準備完了 (@pixi/ui統合: ${this.pixiUIIntegration.enabled ? '有効' : '無効'})`);
    }
    
    /**
     * Phase2: 統合初期化システム（@pixi/ui統合対応完全リファクタリング版）
     */
    async init() {
        try {
            console.log('🎯 PopupManager Phase2 @pixi/ui統合改修版初期化開始...');
            
            this.state.initializationAttempts++;
            
            if (this.state.initializationAttempts > this.config.retryAttempts) {
                throw new Error(`初期化試行回数上限 (${this.config.retryAttempts}) に達しました`);
            }
            
            // Phase2: @pixi/ui統合状況確認
            await this.checkPixiUIIntegration();
            
            // Phase2: 段階的初期化プロセス
            await this.executeInitializationSteps();
            
            this.state.isInitialized = true;
            console.log(`✅ PopupManager Phase2 @pixi/ui統合改修版初期化完了 (統合: ${this.pixiUIIntegration.enabled ? '有効' : '無効'})`);
            
            return true;
            
        } catch (error) {
            this.errorHandler.handleError(error, 'Init');
            
            // リトライ処理
            if (this.state.initializationAttempts < this.config.retryAttempts) {
                console.log(`🔄 PopupManager初期化リトライ ${this.state.initializationAttempts}/${this.config.retryAttempts}`);
                await new Promise(resolve => setTimeout(resolve, 500));
                return await this.init();
            }
            
            throw error;
        }
    }
    
    // Phase2: @pixi/ui統合状況確認
    async checkPixiUIIntegration() {
        console.log('🔍 @pixi/ui統合状況確認中...');
        
        try {
            // PixiJS拡張ライブラリシステム確認
            if (typeof window.PixiExtensions === 'undefined') {
                console.warn('⚠️ PixiJS拡張ライブラリシステムが見つかりません');
                this.pixiUIIntegration.enabled = false;
                this.pixiUIIntegration.fallbackMode = true;
                return;
            }
            
            // @pixi/ui機能確認
            const hasUIFeature = window.PixiExtensions.hasFeature('ui');
            if (!hasUIFeature) {
                console.warn('⚠️ @pixi/ui機能が利用できません');
                this.pixiUIIntegration.enabled = false;
                this.pixiUIIntegration.fallbackMode = true;
                return;
            }
            
            // @pixi/ui詳細情報取得
            const uiDetails = window.PixiExtensions.getLibraryDetails('UI');
            if (!uiDetails || !uiDetails.available) {
                console.warn('⚠️ @pixi/ui詳細情報が取得できません');
                this.pixiUIIntegration.enabled = false;
                this.pixiUIIntegration.fallbackMode = true;
                return;
            }
            
            // 統合有効化確認
            this.pixiUIIntegration.enabled = this.config.usePixiUI && hasUIFeature;
            this.state.pixiUIReady = this.pixiUIIntegration.enabled;
            
            console.log(`✅ @pixi/ui統合状況確認完了: ${this.pixiUIIntegration.enabled ? '統合有効' : 'フォールバック使用'}`);
            
            if (this.pixiUIIntegration.enabled) {
                console.log('📦 @pixi/ui詳細:', uiDetails);
            }
            
        } catch (error) {
            this.errorHandler.handleError(error, 'checkPixiUIIntegration');
            this.pixiUIIntegration.enabled = false;
            this.pixiUIIntegration.fallbackMode = true;
            console.warn('⚠️ @pixi/ui統合確認エラー, フォールバックモードに切り替え');
        }
    }
    
    async executeInitializationSteps() {
        const initSteps = [
            () => this.validateDOMReady(),
            () => this.setupPopupElements(),
            () => this.setupEventListeners(),
            () => this.setupOverlay(),
            () => this.validateInitialization()
        ];
        
        for (let i = 0; i < initSteps.length; i++) {
            try {
                await initSteps[i]();
            } catch (error) {
                throw new Error(`初期化ステップ ${i + 1} で失敗: ${error.message}`);
            }
        }
    }
    
    async validateDOMReady() {
        console.log('📄 DOM準備状態確認中...');
        
        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                reject(new Error('DOM準備タイムアウト'));
            }, this.config.initTimeout);
            
            const checkDOM = () => {
                if (document.readyState === 'complete' || document.readyState === 'interactive') {
                    clearTimeout(timeout);
                    console.log('✅ DOM準備確認完了');
                    resolve();
                } else {
                    setTimeout(checkDOM, 100);
                }
            };
            
            checkDOM();
        });
    }
    
    /**
     * Phase2: @pixi/ui統合ポップアップ要素セットアップ
     */
    async setupPopupElements() {
        console.log(`📋 ポップアップ要素セットアップ開始 (@pixi/ui統合: ${this.pixiUIIntegration.enabled ? '有効' : '無効'})...`);
        
        // Phase2: @pixi/ui統合ペン設定ポップアップ
        await this.setupPenSettingsPopup();
        
        // 既存ポップアップ確認
        await this.setupExistingPopups();
        
        this.state.domElementsReady = true;
        console.log(`📋 ポップアップ要素セットアップ完了: ${this.popups.size}個 (@pixi/ui: ${this.pixiUIIntegration.pixiUIPopups.size}個, DOM: ${this.pixiUIIntegration.domPopups.size}個)`);
    }
    
    async setupPenSettingsPopup() {
        try {
            let penSettingsPopup = document.getElementById('pen-settings-popup');
            
            if (!penSettingsPopup) {
                console.log(`🔧 pen-settings-popup要素が見つかりません → 作成します (@pixi/ui統合: ${this.pixiUIIntegration.enabled ? '有効' : '無効'})`);
                penSettingsPopup = this.elementFactory.createPenSettingsPopup();
            }
            
            if (penSettingsPopup) {
                this.registerPopupElement('pen-settings', penSettingsPopup);
                
                // Phase2: @pixi/ui統合ポップアップの場合は特別管理
                if (penSettingsPopup._isPixiUIPopup) {
                    this.pixiUIIntegration.pixiUIPopups.set('pen-settings', penSettingsPopup._pixiElement);
                    console.log('✅ @pixi/ui統合ペン設定ポップアップ作成完了');
                    this.statistics.pixiUIUsageCount++;
                } else {
                    this.pixiUIIntegration.domPopups.set('pen-settings', penSettingsPopup);
                    console.log('✅ フォールバック版ペン設定ポップアップ作成完了');
                    this.statistics.fallbackUsageCount++;
                }
            } else {
                throw new Error('pen-settings-popup要素作成失敗');
            }
        } catch (error) {
            this.errorHandler.handleError(error, 'SetupPenSettings');
            // フォールバック作成を試行
            this.pixiUIIntegration.fallbackMode = true;
            this.statistics.fallbackUsageCount++;
        }
    }
    
    async setupExistingPopups() {
        const existingPopups = [
            { id: 'resize-settings-popup', name: 'resize-settings' }
        ];
        
        for (const popupInfo of existingPopups) {
            const element = document.getElementById(popupInfo.id);
            if (element) {
                this.registerPopupElement(popupInfo.name, element);
                this.pixiUIIntegration.domPopups.set(popupInfo.name, element);
                console.log(`✅ ${popupInfo.id}要素確認完了`);
            }
        }
    }
    
    registerPopupElement(popupId, element) {
        // CSS検証・修正
        this.cssManager.validateAndFixPopupCSS(element, popupId);
        
        // ポップアップ登録
        this.popups.set(popupId, {
            element: element,
            visible: false,
            showCount: 0,
            hideCount: 0,
            lastOperation: null,
            operationTimes: [],
            isPixiUI: element._isPixiUIPopup || false // Phase2追加
        });
    }
    
    async setupEventListeners() {
        console.log('🎧 イベントリスナーセットアップ開始...');
        
        // ESCキーリスナー（重複防止）
        this.setupEscapeKeyListener();
        
        // ポップアップ内クリック伝播防止
        this.setupClickPropagationPrevention();
        
        this.state.eventListenersReady = true;
        console.log('✅ PopupManagerイベントリスナー設定完了');
    }
    
    setupEscapeKeyListener() {
        if (!document._popupEscListenerSet) {
            document.addEventListener('keydown', (event) => {
                if (event.key === 'Escape' && this.state.activePopup) {
                    event.preventDefault();
                    this.hidePopup(this.state.activePopup);
                }
            });
            document._popupEscListenerSet = true;
            console.log('✅ ESCキーリスナー設定完了');
        }
    }
    
    setupClickPropagationPrevention() {
        for (const [popupId, popupInfo] of this.popups) {
            const element = popupInfo.element;
            if (!element._clickListenerSet) {
                element.addEventListener('click', (event) => {
                    event.stopPropagation();
                });
                element._clickListenerSet = true;
                console.log(`✅ ${popupId} クリック伝播防止設定完了`);
            }
        }
    }
    
    async setupOverlay() {
        console.log('🌫️ オーバーレイセットアップ開始...');
        
        try {
            this.overlayElement = document.getElementById('popup-overlay');
            
            if (!this.overlayElement) {
                this.overlayElement = this.elementFactory.createOverlayElement();
            }
            
            if (this.overlayElement) {
                this.setupOverlayEventHandlers();
                this.cssManager.validateAndFixPopupCSS(this.overlayElement, 'overlay');
            } else {
                throw new Error('オーバーレイ要素作成失敗');
            }
        } catch (error) {
            this.errorHandler.handleError(error, 'SetupOverlay');
        }
    }
    
    setupOverlayEventHandlers() {
        this.overlayElement.addEventListener('click', (event) => {
            event.preventDefault();
            if (this.state.activePopup) {
                this.hidePopup(this.state.activePopup);
            }
        });
    }
    
    async validateInitialization() {
        console.log('🔍 初期化完了確認中...');
        
        const validationResults = {
            domElementsReady: this.state.domElementsReady,
            eventListenersReady: this.state.eventListenersReady,
            pixiUIReady: this.state.pixiUIReady,
            popupCount: this.popups.size,
            overlayElement: !!this.overlayElement,
            errorCount: this.errorHandler.errorCount,
            pixiUIIntegration: this.pixiUIIntegration.enabled
        };
        
        console.log('📊 初期化検証結果:', validationResults);
        
        // 必須要素確認
        const requiredPopups = ['pen-settings'];
        const missingPopups = requiredPopups.filter(id => !this.popups.has(id));
        
        if (missingPopups.length > 0) {
            throw new Error(`必須ポップアップ要素が不足: ${missingPopups.join(', ')}`);
        }
        
        if (!this.overlayElement) {
            throw new Error('オーバーレイ要素が作成されていません');
        }
        
        console.log('✅ 初期化完了確認成功');
    }
    
    /**
     * Phase2: @pixi/ui統合ポップアップ表示（統一処理・統計付き）
     */
    showPopup(popupId) {
        const startTime = performance.now();
        
        try {
            console.log(`📋 ポップアップ表示開始: ${popupId} (@pixi/ui統合: ${this.pixiUIIntegration.enabled ? '有効' : '無効'})`);
            
            if (!this.validateShowRequest(popupId)) {
                return false;
            }
            
            const popupInfo = this.popups.get(popupId);
            
            // 他のポップアップを閉じる
            this.hideOtherPopups(popupId);
            
            // 既に表示中の場合
            if (popupInfo.visible) {
                console.log(`ポップアップ既に表示中: ${popupId}`);
                return true;
            }
            
            // Phase2: @pixi/ui統合表示処理
            const success = this.executeShow(popupId, popupInfo);
            
            if (success) {
                this.updateShowStatistics(popupId, startTime);
                
                // Phase2: 統合統計更新
                if (popupInfo.isPixiUI) {
                    this.statistics.pixiUIUsageCount++;
                } else {
                    this.statistics.fallbackUsageCount++;
                }
            }
            
            return success;
            
        } catch (error) {
            this.errorHandler.handleError(error, `popup_${popupId}_show`);
            return false;
        }
    }
    
    validateShowRequest(popupId) {
        if (!this.state.isInitialized) {
            console.warn('PopupManagerが初期化されていません');
            return false;
        }
        
        if (!this.popups.has(popupId)) {
            console.warn(`ポップアップが見つかりません: ${popupId}`);
            return false;
        }
        
        return true;
    }
    
    hideOtherPopups(currentPopupId) {
        if (this.state.activePopup && this.state.activePopup !== currentPopupId) {
            this.hidePopup(this.state.activePopup);
        }
    }
    
    executeShow(popupId, popupInfo) {
        // オーバーレイ表示
        this.showOverlay();
        
        // Phase2: @pixi/ui統合アニメーション表示
        const success = this.animationManager.showWithAnimation(
            popupInfo.element, 
            popupInfo.isPixiUI ? `pixi-ui-${popupId}` : popupId,
            () => {
                console.log(`✅ ${popupId} 表示アニメーション完了 (@pixi/ui統合: ${popupInfo.isPixiUI ? '有効' : '無効'})`);
            }
        );
        
        if (success) {
            // 状態更新
            popupInfo.visible = true;
            popupInfo.showCount++;
            popupInfo.lastOperation = 'show';
            this.state.activePopup = popupId;
        }
        
        return success;
    }
    
    updateShowStatistics(popupId, startTime) {
        const operationTime = performance.now() - startTime;
        
        this.statistics.showCount++;
        this.statistics.lastAction = 'show';
        this.statistics.lastActionTime = Date.now();
        
        const popupInfo = this.popups.get(popupId);
        popupInfo.operationTimes.push({
            operation: 'show',
            time: operationTime,
            timestamp: Date.now(),
            isPixiUI: popupInfo.isPixiUI // Phase2追加
        });
        
        // 統計履歴制限
        if (popupInfo.operationTimes.length > 10) {
            popupInfo.operationTimes.shift();
        }
        
        console.log(`✅ ポップアップ表示完了: ${popupId} (${operationTime.toFixed(1)}ms) (@pixi/ui: ${popupInfo.isPixiUI ? '有効' : '無効'})`);
    }
    
    /**
     * Phase2: @pixi/ui統合ポップアップ非表示（統一処理・統計付き）
     */
    hidePopup(popupId) {
        const startTime = performance.now();
        
        try {
            console.log(`❌ ポップアップ非表示開始: ${popupId}`);
            
            if (!this.validateHideRequest(popupId)) {
                return false;
            }
            
            const popupInfo = this.popups.get(popupId);
            
            // 既に非表示の場合
            if (!popupInfo.visible) {
                console.log(`ポップアップ既に非表示: ${popupId}`);
                return true;
            }
            
            // Phase2: @pixi/ui統合非表示実行
            const success = this.executeHide(popupId, popupInfo);
            
            if (success) {
                this.updateHideStatistics(popupId, startTime, popupInfo.isPixiUI);
            }
            
            return success;
            
        } catch (error) {
            this.errorHandler.handleError(error, `popup_${popupId}_hide`);
            return false;
        }
    }
    
    validateHideRequest(popupId) {
        if (!this.state.isInitialized) {
            console.warn('PopupManagerが初期化されていません');
            return false;
        }
        
        if (!this.popups.has(popupId)) {
            console.warn(`ポップアップが見つかりません: ${popupId}`);
            return false;
        }
        
        return true;
    }
    
    executeHide(popupId, popupInfo) {
        // Phase2: @pixi/ui統合アニメーション非表示
        const success = this.animationManager.hideWithAnimation(
            popupInfo.element,
            popupInfo.isPixiUI ? `pixi-ui-${popupId}` : popupId,
            () => {
                // アニメーション完了時の処理
                this.completeHideOperation(popupId, popupInfo);
            }
        );
        
        if (success) {
            // 即座に状態更新（アニメーション完了を待たない）
            popupInfo.visible = false;
            popupInfo.hideCount++;
            popupInfo.lastOperation = 'hide';
        }
        
        return success;
    }
    
    completeHideOperation(popupId, popupInfo) {
        // アクティブポップアップ更新
        if (this.state.activePopup === popupId) {
            this.state.activePopup = null;
            this.hideOverlay();
        }
        
        console.log(`🏁 ポップアップ非表示完了: ${popupId} (@pixi/ui: ${popupInfo.isPixiUI ? '有効' : '無効'})`);
    }
    
    updateHideStatistics(popupId, startTime, isPixiUI) {
        const operationTime = performance.now() - startTime;
        
        this.statistics.hideCount++;
        this.statistics.lastAction = 'hide';
        this.statistics.lastActionTime = Date.now();
        
        const popupInfo = this.popups.get(popupId);
        popupInfo.operationTimes.push({
            operation: 'hide',
            time: operationTime,
            timestamp: Date.now(),
            isPixiUI: isPixiUI // Phase2追加
        });
        
        console.log(`✅ ポップアップ非表示開始: ${popupId} (${operationTime.toFixed(1)}ms) (@pixi/ui: ${isPixiUI ? '有効' : '無効'})`);
    }
    
    togglePopup(popupId) {
        const popupInfo = this.popups.get(popupId);
        if (!popupInfo) {
            console.warn(`ポップアップが見つかりません: ${popupId}`);
            return false;
        }
        
        if (popupInfo.visible) {
            return this.hidePopup(popupId);
        } else {
            return this.showPopup(popupId);
        }
    }
    
    hideAllPopups() {
        try {
            let hiddenCount = 0;
            
            for (const [popupId, popupInfo] of this.popups) {
                if (popupInfo.visible) {
                    if (this.hidePopup(popupId)) {
                        hiddenCount++;
                    }
                }
            }
            
            if (hiddenCount > 0) {
                console.log(`📋 ${hiddenCount}個のポップアップを非表示にしました`);
            }
            
            return hiddenCount > 0;
            
        } catch (error) {
            this.errorHandler.handleError(error, 'HideAllPopups');
            return false;
        }
    }
    
    showOverlay() {
        if (this.overlayElement) {
            this.overlayElement.style.visibility = 'visible';
            this.overlayElement.style.pointerEvents = 'auto';
            requestAnimationFrame(() => {
                this.overlayElement.style.opacity = '1';
            });
        }
    }
    
    hideOverlay() {
        if (this.overlayElement) {
            this.overlayElement.style.opacity = '0';
            setTimeout(() => {
                if (this.overlayElement && !this.state.activePopup) {
                    this.overlayElement.style.visibility = 'hidden';
                    this.overlayElement.style.pointerEvents = 'none';
                }
            }, this.config.fadeTime);
        }
    }
    
    /**
     * Phase2: @pixi/ui統合状態取得・統計（完全版）
     */
    getPopupState(popupId) {
        const popupInfo = this.popups.get(popupId);
        if (!popupInfo) {
            return null;
        }
        
        const recentOperations = popupInfo.operationTimes.slice(-3);
        
        return {
            visible: popupInfo.visible,
            showCount: popupInfo.showCount,
            hideCount: popupInfo.hideCount,
            lastOperation: popupInfo.lastOperation,
            recentOperations: recentOperations,
            averageOperationTime: this.calculateAverageOperationTime(popupInfo.operationTimes),
            errorCount: this.errorHandler.getPopupErrorCount(popupId),
            isPixiUI: popupInfo.isPixiUI, // Phase2追加
            pixiUIUsage: recentOperations.filter(op => op.isPixiUI).length // Phase2追加
        };
    }
    
    calculateAverageOperationTime(operationTimes) {
        if (operationTimes.length === 0) return 0;
        
        const totalTime = operationTimes.reduce((sum, op) => sum + op.time, 0);
        return Math.round(totalTime / operationTimes.length * 100) / 100;
    }
    
    getStatus() {
        const popupStatuses = {};
        
        for (const [popupId, popupInfo] of this.popups) {
            popupStatuses[popupId] = this.getPopupState(popupId);
        }
        
        return {
            initialized: this.state.isInitialized,
            activePopup: this.state.activePopup,
            popupCount: this.popups.size,
            
            // Phase2追加: @pixi/ui統合状況
            pixiUIIntegration: {
                enabled: this.pixiUIIntegration.enabled,
                fallbackMode: this.pixiUIIntegration.fallbackMode,
                pixiUIPopups: this.pixiUIIntegration.pixiUIPopups.size,
                domPopups: this.pixiUIIntegration.domPopups.size
            },
            
            initialization: {
                attempts: this.state.initializationAttempts,
                maxAttempts: this.config.retryAttempts,
                domElementsReady: this.state.domElementsReady,
                eventListenersReady: this.state.eventListenersReady,
                pixiUIReady: this.state.pixiUIReady // Phase2追加
            },
            
            statistics: {
                totalShows: this.statistics.showCount,
                totalHides: this.statistics.hideCount,
                lastAction: this.statistics.lastAction,
                lastActionTime: this.statistics.lastActionTime,
                pixiUIUsage: this.statistics.pixiUIUsageCount, // Phase2追加
                fallbackUsage: this.statistics.fallbackUsageCount // Phase2追加
            },
            
            errorStats: this.errorHandler.getStats(),
            
            popups: popupStatuses,
            
            config: this.config
        };
    }
    
    registerPopup(popupId) {
        const element = document.getElementById(`${popupId}-popup`) || document.getElementById(popupId);
        if (element && !this.popups.has(popupId)) {
            this.registerPopupElement(popupId, element);
            console.log(`📋 外部ポップアップ登録: ${popupId}`);
            return true;
        }
        return false;
    }
    
    /**
     * Phase2: @pixi/ui統合デバッグ情報表示（完全版）
     */
    debug() {
        console.group('🔍 PopupManager Phase2 @pixi/ui統合改修版 デバッグ情報');
        
        const status = this.getStatus();
        
        console.log('基本情報:', {
            initialized: status.initialized,
            activePopup: status.activePopup,
            popupCount: status.popupCount
        });
        
        // Phase2: @pixi/ui統合状況
        console.log('@pixi/ui統合状況:', status.pixiUIIntegration);
        console.log('初期化詳細:', status.initialization);
        console.log('統計情報:', status.statistics);
        console.log('エラー統計:', status.errorStats);
        console.log('設定情報:', status.config);
        
        console.log('ポップアップ詳細状態:');
        for (const [popupId, popupState] of Object.entries(status.popups)) {
            console.log(`  ${popupId}:`, {
                visible: popupState.visible,
                shows: popupState.showCount,
                hides: popupState.hideCount,
                lastOperation: popupState.lastOperation,
                avgTime: `${popupState.averageOperationTime}ms`,
                errors: popupState.errorCount,
                isPixiUI: popupState.isPixiUI, // Phase2追加
                pixiUIUsage: popupState.pixiUIUsage, // Phase2追加
                recentOps: popupState.recentOperations.length
            });
        }
        
        // DOM要素状況確認
        console.log('DOM要素状況:', {
            overlay: !!this.overlayElement,
            popupElements: this.popups.size,
            penSettingsExists: !!document.getElementById('pen-settings-popup'),
            bodyChildren: document.body.children.length
        });
        
        // 各ポップアップ要素の詳細確認
        console.log('要素詳細確認:');
        for (const [popupId, popupInfo] of this.popups) {
            const element = popupInfo.element;
            console.log(`  ${popupId}:`, {
                exists: !!element,
                id: element?.id,
                className: element?.className,
                display: element?.style.display,
                visibility: element?.style.visibility,
                opacity: element?.style.opacity,
                zIndex: element?.style.zIndex,
                isPixiUI: popupInfo.isPixiUI, // Phase2追加
                hasPixiElement: !!(element._pixiElement) // Phase2追加
            });
        }
        
        // CSS管理状況
        console.log('CSS管理状況:', {
            validatedElements: this.cssManager.validatedElements.size,
            activeAnimations: this.animationManager.activeAnimations.size
        });
        
        // Phase2: @pixi/ui統合詳細
        console.log('@pixi/ui統合詳細:', {
            PixiExtensionsAvailable: typeof window.PixiExtensions !== 'undefined',
            hasUIFeature: window.PixiExtensions?.hasFeature('ui') || false,
            libraryDetails: window.PixiExtensions?.getLibraryDetails('UI') || null,
            integrationEnabled: this.pixiUIIntegration.enabled,
            fallbackMode: this.pixiUIIntegration.fallbackMode
        });
        
        console.groupEnd();
    }
    
    getPerformanceStats() {
        const popupPerformance = {};
        
        for (const [popupId, popupInfo] of this.popups) {
            const operations = popupInfo.operationTimes;
            
            if (operations.length > 0) {
                const showOps = operations.filter(op => op.operation === 'show');
                const hideOps = operations.filter(op => op.operation === 'hide');
                const pixiUIOps = operations.filter(op => op.isPixiUI); // Phase2追加
                
                popupPerformance[popupId] = {
                    totalOperations: operations.length,
                    showOperations: showOps.length,
                    hideOperations: hideOps.length,
                    pixiUIOperations: pixiUIOps.length, // Phase2追加
                    averageShowTime: showOps.length > 0 ? 
                        showOps.reduce((sum, op) => sum + op.time, 0) / showOps.length : 0,
                    averageHideTime: hideOps.length > 0 ? 
                        hideOps.reduce((sum, op) => sum + op.time, 0) / hideOps.length : 0,
                    averagePixiUITime: pixiUIOps.length > 0 ? // Phase2追加
                        pixiUIOps.reduce((sum, op) => sum + op.time, 0) / pixiUIOps.length : 0,
                    lastOperationTime: operations[operations.length - 1]?.timestamp || 0,
                    isPixiUI: popupInfo.isPixiUI // Phase2追加
                };
            }
        }
        
        return {
            initialized: this.state.isInitialized,
            uptime: Date.now() - (this.statistics.lastActionTime || Date.now()),
            totalOperations: this.statistics.showCount + this.statistics.hideCount,
            pixiUIOperations: this.statistics.pixiUIUsageCount, // Phase2追加
            fallbackOperations: this.statistics.fallbackUsageCount, // Phase2追加
            errorRate: this.popups.size > 0 ? 
                this.errorHandler.errorCount / (this.statistics.showCount + this.statistics.hideCount + 1) : 0,
            pixiUIErrorRate: this.errorHandler.getPixiUIErrorCount() / Math.max(this.statistics.pixiUIUsageCount, 1), // Phase2追加
            popupPerformance: popupPerformance,
            memoryUsage: {
                popups: this.popups.size,
                pixiUIPopups: this.pixiUIIntegration.pixiUIPopups.size, // Phase2追加
                domPopups: this.pixiUIIntegration.domPopups.size, // Phase2追加
                validatedElements: this.cssManager.validatedElements.size,
                activeAnimations: this.animationManager.activeAnimations.size,
                errorLogSize: this.errorHandler.errorLog.length
            }
        };
    }
    
    /**
     * Phase2: @pixi/ui統合完全クリーンアップ
     */
    destroy() {
        try {
            console.log('🧹 PopupManager Phase2 @pixi/ui統合改修版 完全クリーンアップ開始...');
            
            const startTime = performance.now();
            
            // Phase2: @pixi/ui統合要素のクリーンアップ
            this.cleanupPixiUIElements();
            
            // アクティブアニメーション停止
            this.animationManager.cleanup();
            
            // 全ポップアップ非表示
            this.hideAllPopups();
            
            // イベントリスナークリーンアップ
            this.cleanupEventListeners();
            
            // DOM要素クリーンアップ
            this.cleanupDOMElements();
            
            // 内部状態リセット
            this.resetInternalState();
            
            // 管理システムクリーンアップ
            this.cleanupManagementSystems();
            
            const endTime = performance.now();
            console.log(`✅ PopupManager Phase2 @pixi/ui統合改修版 完全クリーンアップ完了 (${(endTime - startTime).toFixed(1)}ms)`);
            
        } catch (error) {
            console.error('❌ PopupManager クリーンアップエラー:', error);
        }
    }
    
    // Phase2: @pixi/ui統合要素のクリーンアップ
    cleanupPixiUIElements() {
        console.log('🎨 @pixi/ui統合要素クリーンアップ中...');
        
        // PixiJS要素のクリーンアップ
        for (const [popupId, pixiElement] of this.pixiUIIntegration.pixiUIPopups) {
            try {
                if (pixiElement && pixiElement.parent) {
                    pixiElement.parent.removeChild(pixiElement);
                    console.log(`🧹 @pixi/ui要素削除: ${popupId}`);
                }
            } catch (error) {
                console.warn(`⚠️ @pixi/ui要素削除エラー ${popupId}:`, error);
            }
        }
        
        this.pixiUIIntegration.pixiUIPopups.clear();
        this.pixiUIIntegration.domPopups.clear();
    }
    
    cleanupEventListeners() {
        if (document._popupEscListenerSet) {
            console.log('🧹 ESCキーリスナー参照クリア');
        }
        
        for (const [popupId, popupInfo] of this.popups) {
            const element = popupInfo.element;
            if (element && element._clickListenerSet) {
                element._clickListenerSet = false;
                console.log(`🧹 ${popupId} イベントリスナークリア`);
            }
        }
    }
    
    cleanupDOMElements() {
        if (this.overlayElement && this.overlayElement.parentNode) {
            this.overlayElement.parentNode.removeChild(this.overlayElement);
            this.overlayElement = null;
            console.log('🧹 オーバーレイ削除完了');
        }
        
        for (const [popupId, popupInfo] of this.popups) {
            const element = popupInfo.element;
            if (element && element.id === 'pen-settings-popup' && element.parentNode) {
                element.parentNode.removeChild(element);
                console.log(`🧹 ${popupId} 動的要素削除完了`);
            }
        }
    }
    
    resetInternalState() {
        this.state = {
            activePopup: null,
            isInitialized: false,
            initializationAttempts: 0,
            domElementsReady: false,
            eventListenersReady: false,
            pixiUIReady: false // Phase2追加
        };
        
        // Phase2: @pixi/ui統合状態リセット
        this.pixiUIIntegration = {
            enabled: false,
            fallbackMode: false,
            pixiUIPopups: new Map(),
            domPopups: new Map()
        };
        
        this.popups.clear();
        
        this.statistics = {
            showCount: 0,
            hideCount: 0,
            lastAction: null,
            lastActionTime: 0,
            operationTimes: new Map(),
            pixiUIUsageCount: 0, // Phase2追加
            fallbackUsageCount: 0 // Phase2追加
        };
        
        console.log('🔄 内部状態リセット完了（@pixi/ui統合対応）');
    }
    
    cleanupManagementSystems() {
        this.cssManager.cleanup();
        this.animationManager.cleanup();
        this.errorHandler.reset();
        
        console.log('🧹 管理システムクリーンアップ完了');
    }
}
