/**
 * BrushSettings - ブラシ設定管理クラス（EventBus修正版）
 * 
 * 責務: ペンの色・サイズ・透明度を一元管理
 * 
 * ✅ 修正: EventBus nullチェック + typeof確認強化
 */

class BrushSettings {
    constructor(config, eventBus) {
        this.config = config || window.TEGAKI_CONFIG || {};
        this.eventBus = eventBus;

        // config.jsから初期値を取得
        const penConfig = this.config.pen || {};
        
        this.size = penConfig.size !== undefined ? penConfig.size : 3;
        this.color = penConfig.color !== undefined ? penConfig.color : 0x800000;
        this.alpha = penConfig.opacity !== undefined ? penConfig.opacity : 1.0;
        
        this.minPhysicalWidth = 1;

        // EventBus購読（安全チェック強化）
        this.subscribeToEvents();
    }

    /**
     * イベント購読（安全チェック強化）
     */
    subscribeToEvents() {
        // EventBusの存在確認 + onメソッドの確認
        if (!this.eventBus || typeof this.eventBus.on !== 'function') {
            return;
        }

        // サイズ変更
        this.eventBus.on('brush:size-changed', ({ size }) => {
            this.setSize(size);
        });

        // 色変更
        this.eventBus.on('brush:color-changed', ({ color }) => {
            this.setColor(color);
        });

        // 透明度変更（0.0-1.0形式）
        this.eventBus.on('brush:alpha-changed', ({ alpha }) => {
            this.setAlpha(alpha);
        });

        // 透明度変更（0-100%形式）
        this.eventBus.on('brush:opacity-changed', ({ opacity }) => {
            this.setOpacity(opacity);
        });
    }

    /**
     * サイズ取得
     */
    getSize() {
        return this.size;
    }

    /**
     * サイズ設定
     */
    setSize(size) {
        this.size = Math.max(0.1, Math.min(500, size));
    }

    /**
     * 色取得（0xRRGGBB形式）
     */
    getColor() {
        return this.color;
    }

    /**
     * 色設定
     */
    setColor(color) {
        if (typeof color === 'string') {
            this.color = parseInt(color, 16);
        } else {
            this.color = color;
        }
    }

    /**
     * 透明度取得（0.0-1.0）
     */
    getAlpha() {
        return this.alpha;
    }

    /**
     * 透明度設定（0.0-1.0）
     */
    setAlpha(alpha) {
        this.alpha = Math.max(0, Math.min(1, alpha));
    }

    /**
     * 透明度取得（0-100%）
     */
    getOpacity() {
        return this.alpha * 100;
    }

    /**
     * 透明度設定（0-100%）
     */
    setOpacity(opacity) {
        this.setAlpha(opacity / 100);
    }

    /**
     * 最小物理幅設定
     */
    setMinPhysicalWidth(width) {
        this.minPhysicalWidth = width;
    }

    /**
     * 最小物理幅取得
     */
    getMinPhysicalWidth() {
        return this.minPhysicalWidth;
    }

    /**
     * 現在の設定を一括取得
     */
    getCurrentSettings() {
        return {
            size: this.size,
            color: this.color,
            alpha: this.alpha,
            opacity: this.getOpacity(),
            minPhysicalWidth: this.minPhysicalWidth
        };
    }

    /**
     * 設定を一括設定
     */
    setCurrentSettings(settings) {
        if (settings.size !== undefined) this.setSize(settings.size);
        if (settings.color !== undefined) this.setColor(settings.color);
        if (settings.alpha !== undefined) this.setAlpha(settings.alpha);
        if (settings.opacity !== undefined) this.setOpacity(settings.opacity);
    }

    /**
     * デフォルトにリセット
     */
    resetToDefaults() {
        const penConfig = this.config.pen || {};
        this.size = penConfig.size !== undefined ? penConfig.size : 3;
        this.color = penConfig.color !== undefined ? penConfig.color : 0x800000;
        this.alpha = penConfig.opacity !== undefined ? penConfig.opacity : 1.0;
    }
}

// グローバル登録（TegakiDrawing名前空間）
if (typeof window.TegakiDrawing === 'undefined') {
    window.TegakiDrawing = {};
}
window.TegakiDrawing.BrushSettings = BrushSettings;