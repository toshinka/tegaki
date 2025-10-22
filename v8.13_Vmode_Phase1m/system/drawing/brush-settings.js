/**
 * BrushSettings - ブラシ設定管理クラス（config.js初期値対応版）
 * 
 * 責務: ペンの色・サイズ・透明度を一元管理
 * 
 * 修正:
 * 1. config.jsのpen設定から初期値を取得
 * 2. EventBusで色・サイズ・透明度の変更通知を受取
 * 3. DrawingEngineが常に最新値を参照可能
 */

class BrushSettings {
    constructor(config, eventBus) {
        this.config = config || window.TEGAKI_CONFIG || {};
        this.eventBus = eventBus;

        // config.jsから初期値を取得（デフォルト値を背後に配置）
        const penConfig = this.config.pen || {};
        
        // 🔧 修正: デフォルト値をconfig.jsから取得
        this.size = penConfig.size !== undefined ? penConfig.size : 3;
        this.color = penConfig.color !== undefined ? penConfig.color : 0x800000; // futaba-maroon
        this.alpha = penConfig.opacity !== undefined ? penConfig.opacity : 1.0;
        
        // devicePixelRatio対応最小幅
        this.minPhysicalWidth = 1;

        // EventBus購読
        this.subscribeToEvents();
    }

    /**
     * イベント購読
     */
    subscribeToEvents() {
        if (!this.eventBus) return;

        // サイズ変更
        this.eventBus.on('brush:size-changed', ({ size }) => {
            this.setSize(size);
        });

        // 色変更
        this.eventBus.on('brush:color-changed', ({ color }) => {
            this.setColor(color);
        });

        // 透明度変更
        this.eventBus.on('brush:alpha-changed', ({ alpha }) => {
            this.setAlpha(alpha);
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
        // 16進数値チェック
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
     * 透明度設定
     */
    setAlpha(alpha) {
        this.alpha = Math.max(0, Math.min(1, alpha));
    }

    /**
     * 最小物理幅設定（StrokeRendererから呼ばれる）
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

// グローバル登録
if (typeof window.TegakiDrawing === 'undefined') {
    window.TegakiDrawing = {};
}
window.TegakiDrawing.BrushSettings = BrushSettings;